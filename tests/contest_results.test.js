import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyFreeze, computeIcpcStandings } from '../src/core/contestResults.js';

describe('DEVER Contest Results (freeze + ICPC) Tests', () => {
  it('Freeze che đúng bài nộp sau mốc thành FROZEN', () => {
    const standings = [
      {
        user_id: 'u1', username: 'alice', total: 1500,
        problems: { B: { points: 1000, status: 'AC', attempts: 2, minute: 105 } }
      }
    ];
    const out = applyFreeze(standings, { freezeMinute: 90, elapsedMinute: 110 });
    assert.equal(out[0].problems.B.status, 'FROZEN');
    assert.equal(out[0].problems.B.points, 0);
    assert.equal(out[0].problems.B.attempts, 2);
  });

  it('Freeze giữ nguyên bài nộp trước mốc (kể cả đúng bằng mốc)', () => {
    const standings = [
      {
        user_id: 'u1', username: 'alice', total: 1500,
        problems: {
          A: { points: 500, status: 'AC', attempts: 1, minute: 20 },
          B: { points: 1000, status: 'AC', attempts: 1, minute: 90 }
        }
      }
    ];
    const out = applyFreeze(standings, { freezeMinute: 90, elapsedMinute: 110 });
    assert.equal(out[0].problems.A.status, 'AC');
    assert.equal(out[0].problems.A.points, 500);
    assert.equal(out[0].problems.B.status, 'AC');
    assert.equal(out[0].problems.B.points, 1000);
  });

  it('Freeze tính lại total = tổng bài còn hiện + hackDelta', () => {
    const standings = [
      {
        user_id: 'u1', username: 'alice', total: 9999, hackDelta: 100,
        problems: {
          A: { points: 500, status: 'AC', attempts: 1, minute: 20 },
          B: { points: 1000, status: 'AC', attempts: 1, minute: 105 }
        }
      }
    ];
    const out = applyFreeze(standings, { freezeMinute: 90, elapsedMinute: 110 });
    // A còn hiện (500) + hackDelta (100) = 600; B bị che (0)
    assert.equal(out[0].total, 600);
    assert.equal(out[0].hackDelta, 100);
  });

  it('Freeze không mutate input (deep clone qua JSON)', () => {
    const standings = [
      {
        user_id: 'u1', username: 'alice', total: 1500,
        problems: { B: { points: 1000, status: 'AC', attempts: 1, minute: 105 } }
      }
    ];
    const snapshot = JSON.parse(JSON.stringify(standings));
    const out = applyFreeze(standings, { freezeMinute: 90, elapsedMinute: 110 });
    assert.deepEqual(standings, snapshot);
    assert.notEqual(out, standings);
    assert.equal(standings[0].problems.B.status, 'AC');
  });

  it('Freeze thiếu minute thì giữ nguyên, không đoán (dù elapsedMinute > freeze)', () => {
    const standings = [
      {
        user_id: 'u1', username: 'alice', total: 1000,
        problems: { B: { points: 1000, status: 'AC', attempts: 1 } }
      }
    ];
    const out = applyFreeze(standings, { freezeMinute: 90, elapsedMinute: 110 });
    assert.equal(out[0].problems.B.status, 'AC');
    assert.equal(out[0].problems.B.points, 1000);
    assert.equal(out[0].total, 1000);
  });

  it('Freeze chỉ xét các code trong problemCodes khi được truyền', () => {
    const standings = [
      {
        user_id: 'u1', username: 'alice', total: 1500,
        problems: {
          A: { points: 500, status: 'AC', attempts: 1, minute: 105 },
          B: { points: 1000, status: 'AC', attempts: 1, minute: 105 }
        }
      }
    ];
    const out = applyFreeze(standings, { freezeMinute: 90, elapsedMinute: 110, problemCodes: ['B'] });
    assert.equal(out[0].problems.A.status, 'AC');
    assert.equal(out[0].problems.B.status, 'FROZEN');
    assert.equal(out[0].total, 500);
  });

  it('ICPC xếp nhiều bài giải đúng lên trước', () => {
    const rows = [
      { user_id: 'u1', username: 'alice', solves: [{ code: 'A', minute: 200, wrongAttempts: 0, solved: true }] },
      {
        user_id: 'u2', username: 'bob',
        solves: [
          { code: 'A', minute: 10, wrongAttempts: 0, solved: true },
          { code: 'B', minute: 20, wrongAttempts: 0, solved: true }
        ]
      }
    ];
    const out = computeIcpcStandings(rows);
    assert.equal(out[0].username, 'bob');
    assert.equal(out[0].solved, 2);
    assert.equal(out[1].username, 'alice');
  });

  it('ICPC cùng số bài thì ít penalty xếp trên', () => {
    const rows = [
      { user_id: 'u1', username: 'slow', solves: [{ code: 'A', minute: 100, wrongAttempts: 0, solved: true }] },
      { user_id: 'u2', username: 'fast', solves: [{ code: 'A', minute: 10, wrongAttempts: 0, solved: true }] }
    ];
    const out = computeIcpcStandings(rows);
    assert.equal(out[0].username, 'fast');
    assert.equal(out[0].penalty, 10);
    assert.equal(out[1].username, 'slow');
  });

  it('ICPC đồng solved + penalty thì đồng hạng cùng rank', () => {
    const rows = [
      { user_id: 'u1', username: 'a', solves: [{ code: 'A', minute: 20, wrongAttempts: 0, solved: true }] },
      { user_id: 'u2', username: 'b', solves: [{ code: 'A', minute: 20, wrongAttempts: 0, solved: true }] },
      { user_id: 'u3', username: 'c', solves: [{ code: 'A', minute: 50, wrongAttempts: 0, solved: true }] }
    ];
    const out = computeIcpcStandings(rows);
    assert.equal(out[0].rank, 1);
    assert.equal(out[1].rank, 1);
    assert.equal(out[2].rank, 3);
  });

  it('ICPC penalty = minute + 20*WA (bài fail không tính)', () => {
    const rows = [
      {
        user_id: 'u1', username: 'alice',
        solves: [
          { code: 'A', minute: 30, wrongAttempts: 2, solved: true }, // 30 + 40 = 70
          { code: 'B', minute: 10, wrongAttempts: 5, solved: false }, // bỏ qua
          { code: 'C', minute: 15, wrongAttempts: 1, solved: true } // 15 + 20 = 35
        ]
      }
    ];
    const out = computeIcpcStandings(rows);
    assert.equal(out[0].solved, 2);
    assert.equal(out[0].penalty, 105);
    assert.equal(out[0].rank, 1);
  });

  it('ICPC không mutate input', () => {
    const rows = [
      { user_id: 'u2', username: 'bob', solves: [{ code: 'A', minute: 100, wrongAttempts: 0, solved: true }] },
      { user_id: 'u1', username: 'alice', solves: [{ code: 'A', minute: 10, wrongAttempts: 0, solved: true }] }
    ];
    const snapshot = JSON.parse(JSON.stringify(rows));
    const out = computeIcpcStandings(rows);
    assert.deepEqual(rows, snapshot);
    assert.equal(out[0].username, 'alice');
    assert.equal(rows[0].username, 'bob'); // thứ tự gốc giữ nguyên
  });
});
