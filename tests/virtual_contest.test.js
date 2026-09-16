import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  createVirtualSession,
  getVirtualElapsedMinutes,
  filterGhostSubmissions,
  calculateVirtualStandings
} from '../src/core/virtualContest.js';

describe('DEVER Virtual Contest Simulator Engine Tests', () => {
  test('Khởi tạo phiên thi ảo hợp lệ', () => {
    const session = createVirtualSession('contest_dever_round1', 'user_test', 120);
    assert.strictEqual(session.contestId, 'contest_dever_round1');
    assert.strictEqual(session.userId, 'user_test');
    assert.strictEqual(session.durationMinutes, 120);
    assert.strictEqual(session.isFinished, false);
    assert.ok(session.id.startsWith('vsession_'));
  });

  test('Throw lỗi khi thiếu contestId hoặc userId', () => {
    assert.throws(() => createVirtualSession('', 'user_test'), /contestId và userId là bắt buộc/);
    assert.throws(() => createVirtualSession('contest_1', ''), /contestId và userId là bắt buộc/);
  });

  test('Tính toán số phút ảo đã trôi qua chính xác và không vượt quá thời lượng', () => {
    const startTime = 1000000;
    const session = createVirtualSession('c1', 'u1', 120, startTime);

    // Tại phút 0
    assert.strictEqual(getVirtualElapsedMinutes(session, startTime), 0);

    // Tại phút 45 (45 * 60 * 1000 ms sau)
    assert.strictEqual(getVirtualElapsedMinutes(session, startTime + 45 * 60 * 1000), 45);

    // Vượt quá 120 phút (150 phút sau) -> bị chặn trần ở 120 phút
    assert.strictEqual(getVirtualElapsedMinutes(session, startTime + 150 * 60 * 1000), 120);
  });

  test('Lọc Ghost Submissions theo timeline từng phút thực tế', () => {
    const historicalSubmissions = [
      { id: 'sub_1', user_id: 'user_a', contest_minute: 5, problem_id: 'p101', verdict: 'OK' },
      { id: 'sub_2', user_id: 'user_b', contest_minute: 25, problem_id: 'p101', verdict: 'OK' },
      { id: 'sub_3', user_id: 'user_c', contest_minute: 45, problem_id: 'p102', verdict: 'OK' },
      { id: 'sub_4', user_id: 'user_a', contest_minute: 80, problem_id: 'p102', verdict: 'OK' }
    ];

    // Tại phút 10: Chỉ thấy sub_1
    const at10 = filterGhostSubmissions(historicalSubmissions, 10);
    assert.strictEqual(at10.length, 1);
    assert.strictEqual(at10[0].id, 'sub_1');

    // Tại phút 30: Thấy sub_1 và sub_2
    const at30 = filterGhostSubmissions(historicalSubmissions, 30);
    assert.strictEqual(at30.length, 2);

    // Tại phút 90: Thấy toàn bộ 4 bài
    const at90 = filterGhostSubmissions(historicalSubmissions, 90);
    assert.strictEqual(at90.length, 4);
  });

  test('Tính toán Standings ảo phối hợp giữa thí sinh ảo và ghost participants', () => {
    const virtualUser = {
      id: 'user_virtual_1',
      username: 'VirtualPro',
      name: 'Nguyễn Văn Ảo',
      rating: 1650,
      clan: 'K20-Dev'
    };

    const problems = [
      { id: 'p101', base_points: 500 },
      { id: 'p102', base_points: 1000 }
    ];

    const ghostSubmissions = [
      { user_id: 'ghost_1', username: 'GhostMaster', contest_minute: 10, problem_id: 'p101', verdict: 'OK' },
      { user_id: 'ghost_2', username: 'GhostNoob', contest_minute: 30, problem_id: 'p101', verdict: 'WRONG_ANSWER' },
      { user_id: 'ghost_1', username: 'GhostMaster', contest_minute: 70, problem_id: 'p102', verdict: 'OK' }
    ];

    // User ảo giải được p101 tại phút 15, giải p102 tại phút 40
    const virtualSubmissions = [
      { problem_id: 'p101', contest_minute: 15, verdict: 'OK' },
      { problem_id: 'p102', contest_minute: 40, verdict: 'OK' }
    ];

    // Tại phút 50:
    // GhostMaster chỉ mới nộp p101 (chưa tới phút 70 nên chưa có p102)
    // VirtualPro đã nộp cả p101 và p102
    // Do đó VirtualPro phải đứng Hạng 1 (Rank 1)
    const standingsAt50 = calculateVirtualStandings({
      virtualUser,
      virtualSubmissions,
      ghostSubmissions,
      elapsedMinutes: 50,
      problems
    });

    assert.strictEqual(standingsAt50.length, 3);
    assert.strictEqual(standingsAt50[0].id, 'user_virtual_1');
    assert.strictEqual(standingsAt50[0].rank, 1);
    assert.strictEqual(standingsAt50[0].solvedCount, 2);

    assert.strictEqual(standingsAt50[1].id, 'ghost_1');
    assert.strictEqual(standingsAt50[1].rank, 2);
    assert.strictEqual(standingsAt50[1].solvedCount, 1);
  });
});
