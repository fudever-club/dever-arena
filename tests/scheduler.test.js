/**
 * DEVER Arena — Task 103: Auto-phase scheduler tests.
 * Unit thuần: mock db/finish/broadcast + inject now() → không sleep thật, không đụng db.json.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../server/scheduler.js';

function mockDb(contests) {
  return {
    data: { contests },
    update(store, pred, patch) {
      const row = this.data[store].find(pred);
      if (row) Object.assign(row, patch);
    },
  };
}

const ISO = (ms) => new Date(ms).toISOString();

test('scheduler: REGISTRATION → CODING đúng start_time, không chuyển sớm', () => {
  const t0 = 1_000_000_000;
  const db = mockDb([{ id: 'c1', status: 'REGISTRATION', start_time: ISO(t0), duration_minutes: 120 }]);
  const s = createScheduler({ db, finishContest: () => assert.fail('không được finish'), now: () => t0 - 1 });
  assert.equal(s.tick(), 0, 'trước start_time: không đổi');
  assert.equal(db.data.contests[0].status, 'REGISTRATION');

  const s2 = createScheduler({ db, finishContest: () => assert.fail('không được finish'), now: () => t0 });
  assert.equal(s2.tick(), 1, 'đúng start_time: chuyển CODING');
  assert.equal(db.data.contests[0].status, 'CODING');
});

test('scheduler: CODING → FINISHED hết duration, gọi finishContest đúng 1 lần', () => {
  const t0 = 1_000_000_000;
  const db = mockDb([{ id: 'c2', status: 'CODING', start_time: ISO(t0), duration_minutes: 120 }]);
  const finished = [];
  const s = createScheduler({ db, finishContest: (c) => finished.push(c.id), now: () => t0 + 120 * 60000 - 1 });
  assert.equal(s.tick(), 0, 'còn 1ms: chưa finish');

  // finishContest của server sẽ tự set status FINISHED — mock làm y vậy
  const s2 = createScheduler({
    db,
    finishContest: (c) => { finished.push(c.id); db.update('contests', (x) => x.id === c.id, { status: 'FINISHED' }); },
    now: () => t0 + 120 * 60000,
  });
  assert.equal(s2.tick(), 1);
  assert.equal(db.data.contests[0].status, 'FINISHED');
  assert.deepEqual(finished, ['c2']);
});

test('scheduler: broadcast EVENT_PHASE_CHANGED kèm by=scheduler', () => {
  const t0 = 1_000_000_000;
  const db = mockDb([{ id: 'c3', status: 'REGISTRATION', start_time: ISO(t0), duration_minutes: 60 }]);
  const events = [];
  const s = createScheduler({
    db,
    finishContest: () => {},
    broadcast: (contestId, event, payload) => events.push({ contestId, event, payload }),
    now: () => t0,
  });
  s.tick();
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'EVENT_PHASE_CHANGED');
  assert.equal(events[0].payload.phase, 'CODING');
  assert.equal(events[0].payload.by, 'scheduler');
});

test('scheduler: không downgrade FINISHED, không re-finish contest đã xong (idempotent)', () => {
  const t0 = 1_000_000_000;
  const db = mockDb([
    { id: 'c4', status: 'FINISHED', start_time: ISO(t0), duration_minutes: 60 },
    { id: 'c5', status: 'CODING', start_time: ISO(t0), duration_minutes: 0 },
  ]);
  let finishes = 0;
  const s = createScheduler({
    db,
    finishContest: (c) => { finishes += 1; db.update('contests', (x) => x.id === c.id, { status: 'FINISHED' }); },
    now: () => t0 + 3_600_000,
  });
  assert.equal(s.tick(), 1, 'chỉ c5 được finish');
  assert.equal(s.tick(), 0, 'tick lần 2: không làm gì nữa');
  assert.equal(finishes, 1);
  assert.equal(db.data.contests[0].status, 'FINISHED');
});

test('scheduler: admin override tôn trọng — contest admin bấm tay FINISHED sớm không bị đụng', () => {
  const t0 = 1_000_000_000;
  const db = mockDb([{ id: 'c6', status: 'FINISHED', start_time: ISO(t0), duration_minutes: 120 }]);
  const s = createScheduler({ db, finishContest: () => assert.fail('không được đụng'), now: () => t0 + 60000 });
  assert.equal(s.tick(), 0);
});

test('scheduler: start/stop chu kỳ hoạt động và không giữ process (unref)', async () => {
  const t0 = Date.now();
  const db = mockDb([{ id: 'c7', status: 'REGISTRATION', start_time: ISO(t0 - 1000), duration_minutes: 60 }]);
  const s = createScheduler({ db, finishContest: () => {}, now: () => Date.now() });
  assert.equal(s.running, false);
  s.start(20);
  assert.equal(s.running, true);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(db.data.contests[0].status, 'CODING', 'tick tự động đã chạy');
  s.stop();
  assert.equal(s.running, false);
});
