import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ContestManager, CONTEST_PHASES } from '../src/core/contestStateMachine.js';

describe('DEVER Arena Contest State Machine Tests (3 phase — ADR-005)', () => {
  test('Khởi tạo contest ở trạng thái REGISTRATION và cho phép đăng ký', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1 (Div. 3)' });
    assert.equal(contest.currentPhase, CONTEST_PHASES.REGISTRATION);

    contest.registerUser('alice');
    contest.registerUser('bob');
    assert.equal(contest.registeredUsers.size, 2);
  });

  test('Bắt đầu Coding Phase và cho phép nộp bài', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1 (Div. 3)' });
    for (let i = 1; i <= 30; i++) {
      contest.registerUser(`user_${i}`);
    }

    contest.startCodingPhase();
    assert.equal(contest.currentPhase, CONTEST_PHASES.CODING);
    assert.equal(contest.canSubmitSolution(), true);
    // Không còn phân phòng (ADR-005)
    assert.equal(contest.rooms, undefined);
  });

  test('Trong Coding Phase: cấm xem code của đối thủ', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1' });
    contest.registerUser('alice');
    contest.registerUser('bob');
    contest.startCodingPhase();

    // Alice chỉ được xem code của chính mình
    assert.equal(contest.canViewSourceCode('alice', 'alice'), true);
    assert.equal(contest.canViewSourceCode('alice', 'bob'), false);
  });

  test('Quy trình chuyển phase nghiêm ngặt (không được nhảy cóc)', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1' });
    contest.registerUser('alice');

    // Đang ở REGISTRATION mà đòi kết thúc phải báo lỗi
    assert.throws(() => contest.finishContest(), /Chỉ có thể kết thúc contest/);

    contest.startCodingPhase();
    // Đang ở CODING mà đòi bắt đầu lại CODING phải báo lỗi
    assert.throws(() => contest.startCodingPhase(), /Chỉ có thể bắt đầu Coding Phase/);

    contest.finishContest();
    assert.equal(contest.currentPhase, CONTEST_PHASES.FINISHED);
    assert.equal(contest.canSubmitSolution(), false);
  });

  test('FINISHED: mở upsolving — ai cũng xem được code', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1' });
    contest.registerUser('alice');
    contest.registerUser('bob');
    contest.startCodingPhase();
    contest.finishContest();

    assert.equal(contest.canViewSourceCode('alice', 'bob'), true);
    assert.equal(contest.canViewSourceCode('bob', 'alice'), true);
    assert.equal(contest.canViewSourceCode('guest', 'alice'), true);
  });

  test('Đăng ký sau khi contest đã bắt đầu bị từ chối', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1' });
    contest.startCodingPhase();
    assert.throws(() => contest.registerUser('late_user'), /Chỉ có thể đăng ký/);
    contest.finishContest();
    assert.throws(() => contest.registerUser('later_user'), /Chỉ có thể đăng ký/);
  });
});
