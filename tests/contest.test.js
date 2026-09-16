import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ContestManager, CONTEST_PHASES } from '../src/core/contestStateMachine.js';

describe('DEVER-Forces Contest State Machine Tests', () => {
  test('Khởi tạo contest ở trạng thái REGISTRATION và cho phép đăng ký', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1 (Div. 3)' });
    assert.equal(contest.currentPhase, CONTEST_PHASES.REGISTRATION);

    contest.registerUser('alice');
    contest.registerUser('bob');
    assert.equal(contest.registeredUsers.size, 2);
  });

  test('Phân phối thí sinh vào các Room khi bắt đầu Coding Phase', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1 (Div. 3)' });
    for (let i = 1; i <= 30; i++) {
      contest.registerUser(`user_${i}`);
    }

    contest.startCodingPhase();
    assert.equal(contest.currentPhase, CONTEST_PHASES.CODING);
    assert.equal(contest.canSubmitSolution(), true);

    // 30 người chia làm 2 phòng (25 và 5)
    assert.equal(contest.rooms.size, 2);
    assert.equal(contest.getRoomForUser('user_1'), 'Room #1');
    assert.equal(contest.getRoomForUser('user_26'), 'Room #2');
  });

  test('Trong Coding Phase: Cấm xem code của đối thủ và cấm Hack', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1' });
    contest.registerUser('alice');
    contest.registerUser('bob');
    contest.startCodingPhase();

    // Alice chỉ được xem code của chính mình
    assert.equal(contest.canViewSourceCode('alice', 'alice'), true);
    assert.equal(contest.canViewSourceCode('alice', 'bob'), false);

    // Không được hack khi đang làm bài
    const hackCheck = contest.canPerformHack('alice', 'bob');
    assert.equal(hackCheck.allowed, false);
  });

  test('Trong Hack Phase: Được xem code và hack người cùng Room, cấm người khác Room', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1' });
    // Tạo 30 người
    for (let i = 1; i <= 30; i++) {
      contest.registerUser(`u_${i}`);
    }
    contest.startCodingPhase();
    contest.startHackPhase();

    assert.equal(contest.currentPhase, CONTEST_PHASES.HACK_PHASE);
    assert.equal(contest.canSubmitSolution(), false); // Cấm nộp code mới trong hack phase

    // u_1 và u_2 cùng ở Room #1
    assert.equal(contest.canViewSourceCode('u_1', 'u_2'), true);
    const hackSameRoom = contest.canPerformHack('u_1', 'u_2');
    assert.equal(hackSameRoom.allowed, true);

    // u_1 (Room 1) và u_26 (Room 2) khác phòng -> Cấm hack
    const hackDiffRoom = contest.canPerformHack('u_1', 'u_26');
    assert.equal(hackDiffRoom.allowed, false);
  });

  test('Quy trình chuyển phase nghiêm ngặt (không được nhảy cóc)', () => {
    const contest = new ContestManager({ id: 'round-1', title: 'DEVER Round #1' });
    contest.registerUser('alice');

    // Đang ở REGISTRATION mà đòi startHackPhase phải báo lỗi
    assert.throws(() => contest.startHackPhase(), /Chỉ có thể chuyển sang Hack Phase/);

    contest.startCodingPhase();
    // Đang ở CODING mà đòi System Testing phải báo lỗi
    assert.throws(() => contest.startSystemTesting(), /Chỉ có thể chạy System Testing/);

    contest.startHackPhase();
    contest.startSystemTesting();
    contest.finishContest();
    assert.equal(contest.currentPhase, CONTEST_PHASES.FINISHED);
  });
});
