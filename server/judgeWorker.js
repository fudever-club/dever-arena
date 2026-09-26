/**
 * DEVER Arena — Judge worker (child process).
 * Chạy code thí sinh TÁCH KHỎI process API để submit đồng loạt không block event-loop.
 * Giao thức: parent post { id, op, payload } → worker post { id, ok, result|error }.
 * Ops: 'judgeTests' { language, source, tests, timeLimitMs }, 'executeOne' { language, source, stdin, timeLimitMs }.
 */
import { judgeTests, executeOne } from './judge.js';

process.on('message', async (msg) => {
  if (!msg || msg.id === undefined) return;
  try {
    let result;
    if (msg.op === 'judgeTests') {
      result = judgeTests(msg.payload);
    } else if (msg.op === 'executeOne') {
      result = executeOne(msg.payload);
    } else {
      throw new Error(`Op không hỗ trợ: ${msg.op}`);
    }
    process.send({ id: msg.id, ok: true, result });
  } catch (err) {
    process.send({ id: msg.id, ok: false, error: String(err?.message || err) });
  }
});

// Sống đến khi parent đóng/kill; không giữ gì thêm.
process.on('disconnect', () => process.exit(0));
