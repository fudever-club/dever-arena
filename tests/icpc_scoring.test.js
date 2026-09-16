import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateIcpcScore, compareIcpcRanking, calculateIoiScore } from '../src/core/scoring.js';

describe('DEVER Multi-Format Scoring Engine Tests', () => {
  test('Thể thức ICPC: Tính đúng số bài AC và thời gian phạt penalty', () => {
    const problems = [
      // Bài A: AC ở phút 15, không sai lần nào => Penalty = 15
      { solved: true, elapsedMinutes: 15, wrongAttempts: 0 },
      // Bài B: AC ở phút 45, sai 2 lần trước đó => Penalty = 45 + 2 * 20 = 85
      { solved: true, elapsedMinutes: 45, wrongAttempts: 2 },
      // Bài C: Không giải được dù đã nộp sai 4 lần => Không tính penalty bài này
      { solved: false, elapsedMinutes: 0, wrongAttempts: 4 }
    ];

    const result = calculateIcpcScore(problems);
    assert.equal(result.solvedCount, 2);
    assert.equal(result.totalPenalty, 15 + 85); // 100 phút
  });

  test('So sánh thứ tự xếp hạng ICPC: Nhiều bài hơn luôn thắng, bằng bài xét penalty', () => {
    const teamA = { name: 'DEVER_Alpha', solvedCount: 3, totalPenalty: 350 };
    const teamB = { name: 'DEVER_Beta', solvedCount: 4, totalPenalty: 600 };
    const teamC = { name: 'DEVER_Gamma', solvedCount: 3, totalPenalty: 280 };

    // Team B giải 4 bài > Team A giải 3 bài => B xếp trên A
    assert.ok(compareIcpcRanking(teamB, teamA) < 0);

    // Team C và Team A cùng 3 bài, nhưng Team C ít penalty hơn (280 < 350) => C xếp trên A
    assert.ok(compareIcpcRanking(teamC, teamA) < 0);
  });

  test('Thể thức IOI Subtasks: Tổng điểm chuẩn xác giữa các subtasks', () => {
    const subtasks = [
      { subtaskId: 1, points: 20, passed: true },
      { subtaskId: 2, points: 30, passed: true },
      { subtaskId: 3, points: 50, passed: false } // Subtask 3 TLE
    ];

    assert.equal(calculateIoiScore(subtasks), 50);
  });
});
