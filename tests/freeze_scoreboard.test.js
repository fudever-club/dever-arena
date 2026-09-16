import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isScoreboardFrozen,
  createFrozenStandings,
  generateUnfreezeStepSequence,
  applyUnfreezeStep
} from '../src/core/scoreboardFreeze.js';

describe('DEVER Scoreboard Freeze Engine Tests', () => {
  it('Xác định chính xác thời điểm đóng băng bảng điểm (Freeze Condition)', () => {
    // Contest 120 phút, đóng băng 30 phút cuối (từ phút 90)
    assert.equal(isScoreboardFrozen(120, 89, 30), false);
    assert.equal(isScoreboardFrozen(120, 90, 30), true);
    assert.equal(isScoreboardFrozen(120, 115, 30), true);

    // Contest 300 phút (ICPC), đóng băng 60 phút cuối (từ phút 240)
    assert.equal(isScoreboardFrozen(300, 239, 60), false);
    assert.equal(isScoreboardFrozen(300, 240, 60), true);
  });

  it('Tạo bảng điểm đóng băng: ẩn điểm bài nộp sau freeze và hiển thị dấu ?', () => {
    const rawStandings = [
      {
        user_id: 'u1',
        username: 'alice',
        score: 1500,
        problems: {
          A: { solved: true, minute: 20, points: 500 },
          B: { solved: true, minute: 105, points: 1000 } // Nộp sau phút 90
        }
      },
      {
        user_id: 'u2',
        username: 'bob',
        score: 500,
        problems: {
          A: { solved: true, minute: 40, points: 500 }
        }
      }
    ];

    const submissions = [
      { user_id: 'u1', problem_id: 'B', contest_minute: 105, verdict: 'AC' }
    ];

    const frozen = createFrozenStandings(rawStandings, submissions, 90);

    // Alice bài A mở (500đ), bài B bị đóng băng (ẩn 1000đ)
    const alice = frozen.find(c => c.user_id === 'u1');
    assert.ok(alice);
    assert.equal(alice.score, 500); // Chỉ tính điểm bài A
    assert.equal(alice.problems.A.is_frozen, false);
    assert.equal(alice.problems.B.is_frozen, true);
    assert.ok(alice.problems.B.display.includes('?'));

    // Bob giải bài A trước freeze nên điểm giữ nguyên 500
    const bob = frozen.find(c => c.user_id === 'u2');
    assert.equal(bob.score, 500);
    assert.equal(bob.problems.A.is_frozen, false);
  });

  it('Sinh chuỗi giải mã kịch tính (ICPC Dramatic Unfreeze) và ghi nhận pha nhảy hạng', () => {
    // Alice đang đứng dưới do bài B (1000đ) bị đóng băng
    // Bob đang đứng trên với 800đ (không có bài đóng băng)
    const frozenStandings = [
      {
        user_id: 'u_bob',
        username: 'bob',
        score: 800,
        rank: 1,
        problems: {
          A: { is_frozen: false, points: 800 }
        }
      },
      {
        user_id: 'u_alice',
        username: 'alice',
        score: 500,
        rank: 2,
        problems: {
          A: { is_frozen: false, points: 500 },
          B: { is_frozen: true, actual_solved: true, actual_points: 1000, display: '? 1' }
        }
      }
    ];

    const sequence = generateUnfreezeStepSequence(frozenStandings);

    assert.equal(sequence.length, 1);
    const step = sequence[0];
    assert.equal(step.username, 'alice');
    assert.equal(step.problemCode, 'B');
    assert.equal(step.isAccepted, true);
    assert.equal(step.oldScore, 500);
    assert.equal(step.newScore, 1500);
    assert.equal(step.oldRank, 2);
    assert.equal(step.newRank, 1);
    assert.equal(step.isJump, true); // Alice nhảy từ rank 2 lên rank 1!
    assert.equal(step.rankDelta, 1);
  });

  it('Thực thi áp dụng bước unfreeze (applyUnfreezeStep) cập nhật bảng điểm tức thời', () => {
    const currentStandings = [
      { user_id: 'u_bob', username: 'bob', score: 800, rank: 1, problems: {} },
      { user_id: 'u_alice', username: 'alice', score: 500, rank: 2, problems: { B: { is_frozen: true } } }
    ];

    const step = {
      userId: 'u_alice',
      problemCode: 'B',
      isAccepted: true,
      pointsGained: 1000,
      newScore: 1500
    };

    const nextStandings = applyUnfreezeStep(currentStandings, step);
    assert.equal(nextStandings[0].user_id, 'u_alice'); // Alice lên Hạng 1
    assert.equal(nextStandings[0].score, 1500);
    assert.equal(nextStandings[1].user_id, 'u_bob');   // Bob xuống Hạng 2
    assert.equal(nextStandings[1].score, 800);
  });
});
