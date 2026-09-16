import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProblemScore, calculateHackScore, calculateTotalScore } from '../src/core/scoring.js';

describe('DEVER-Forces Scoring Engine Tests', () => {
  test('Nộp ngay phút 0 không sai lần nào phải nhận trọn vẹn điểm tối đa', () => {
    assert.equal(calculateProblemScore(500, 0, 0), 500);
    assert.equal(calculateProblemScore(1000, 0, 0), 1000);
    assert.equal(calculateProblemScore(1500, 0, 0), 1500);
  });

  test('Nộp ở phút thứ 50 không sai lần nào điểm phải giảm tương ứng', () => {
    // Với 500 điểm, mỗi phút giảm 500/250 = 2 điểm. 50 phút giảm 100 điểm => 400 điểm
    assert.equal(calculateProblemScore(500, 50, 0), 400);

    // Với 1000 điểm, mỗi phút giảm 1000/250 = 4 điểm. 50 phút giảm 200 điểm => 800 điểm
    assert.equal(calculateProblemScore(1000, 50, 0), 800);
  });

  test('Mỗi lần nộp sai (Wrong Answer) bị trừ đúng 50 điểm', () => {
    // Phút 10: trừ 20 điểm thời gian. Sai 2 lần: trừ 100 điểm. 500 - 20 - 100 = 380 điểm
    assert.equal(calculateProblemScore(500, 10, 2), 380);
  });

  test('Điểm không bao giờ bị giảm xuống dưới mức sàn 30% maxPoints', () => {
    // 500 điểm, sàn 30% là 150 điểm. Dù nộp ở phút 119 và sai 10 lần thì vẫn không dưới 150
    assert.equal(calculateProblemScore(500, 119, 10), 150);
  });

  test('Điểm Hack được tính chính xác (+100 hack đúng, -50 hack sai)', () => {
    assert.equal(calculateHackScore(0, 0), 0);
    assert.equal(calculateHackScore(2, 0), 200);
    assert.equal(calculateHackScore(1, 1), 50);
    assert.equal(calculateHackScore(0, 2), -100); // Hack trượt 2 lần bị phạt âm 100đ
  });

  test('Tính tổng điểm toàn contest kết hợp bài nộp và điểm hack', () => {
    const submissions = [
      { maxPoints: 500, elapsedMinutes: 10, wrongAttempts: 0, solved: true },  // 500 - 20 = 480
      { maxPoints: 1000, elapsedMinutes: 45, wrongAttempts: 1, solved: true }, // 1000 - 180 - 50 = 770
      { maxPoints: 1500, elapsedMinutes: 90, wrongAttempts: 3, solved: false } // Chưa giải được => 0
    ];
    // 480 + 770 = 1250 điểm bài. Hack: 1 trúng (+100), 1 trượt (-50) => +50 điểm.
    // Tổng = 1300 điểm
    assert.equal(calculateTotalScore(submissions, 1, 1), 1300);
  });
});
