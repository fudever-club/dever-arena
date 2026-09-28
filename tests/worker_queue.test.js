import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JudgeWorkerQueue, QUEUE_PRIORITIES } from '../src/engine/workerQueue.js';
import { executeTestcase, evaluateSubmission, VERDICTS, compareOutputs, normalizeOutput } from '../src/engine/isolateRunner.js';

describe('DEVER Judge Worker Queue & Priority Engine Tests', () => {
  it('Phải ưu tiên xử lý HIGH (P1) trước DEFAULT (P2) và BATCH (P3)', () => {
    const queue = new JudgeWorkerQueue();

    // Enqueue ngược thứ tự ưu tiên: BATCH -> DEFAULT -> HIGH
    queue.enqueue({ id: 'batch_job_1', priority: QUEUE_PRIORITIES.BATCH });
    queue.enqueue({ id: 'default_job_1', priority: QUEUE_PRIORITIES.DEFAULT });
    queue.enqueue({ id: 'high_job_1', priority: QUEUE_PRIORITIES.HIGH });
    queue.enqueue({ id: 'default_job_2', priority: QUEUE_PRIORITIES.DEFAULT });
    queue.enqueue({ id: 'high_job_2', priority: QUEUE_PRIORITIES.HIGH });

    assert.equal(queue.getQueueStats().totalWaiting, 5);
    assert.equal(queue.getQueueStats().byPriority.high, 2);
    assert.equal(queue.getQueueStats().byPriority.default, 2);
    assert.equal(queue.getQueueStats().byPriority.batch, 1);

    // Dequeue lần lượt
    assert.equal(queue.dequeue().id, 'high_job_1');
    assert.equal(queue.dequeue().id, 'high_job_2');
    assert.equal(queue.dequeue().id, 'default_job_1');
    assert.equal(queue.dequeue().id, 'default_job_2');
    assert.equal(queue.dequeue().id, 'batch_job_1');
    assert.equal(queue.dequeue(), null);
  });

  it('Thống kê hàng đợi và bắt lỗi khi thiếu id hoặc priority sai', () => {
    const queue = new JudgeWorkerQueue();
    assert.throws(() => queue.enqueue({}), /Invalid job/);
    assert.throws(() => queue.enqueue({ id: 'job_invalid', priority: 99 }), /Invalid priority level/);

    queue.enqueue({ id: 'job_ok_1', priority: QUEUE_PRIORITIES.DEFAULT });
    assert.equal(queue.getQueueStats().totalWaiting, 1);
    queue.clear();
    assert.equal(queue.getQueueStats().totalWaiting, 0);
  });

  it('Xử lý job tự động qua queue và ghi nhận lịch sử chấm', async () => {
    const queue = new JudgeWorkerQueue();

    const validCode = `
      function solve(input) {
        const n = parseInt(input.trim(), 10);
        return String(n * 2);
      }
    `;

    queue.enqueue({
      id: 'sub_test_1',
      priority: QUEUE_PRIORITIES.DEFAULT,
      sourceCode: validCode,
      language: 'javascript',
      testcases: [
        { stdin: '5', expectedStdout: '10' },
        { stdin: '12', expectedStdout: '24' }
      ]
    });

    const result = await queue.processNext();
    assert.ok(result);
    assert.equal(result.jobId, 'sub_test_1');
    assert.equal(result.verdict, VERDICTS.AC);
    assert.equal(queue.processedCount, 1);
    assert.equal(queue.history.length, 1);
    assert.equal(queue.history[0].verdict, VERDICTS.AC);
  });
});

describe('DEVER Isolate Sandbox Runner Tests', () => {
  it('Chuẩn hóa output và đối soát so sánh chuẩn xác', () => {
    assert.equal(normalizeOutput('  hello world  \r\n'), 'hello world');
    assert.equal(normalizeOutput('line 1  \nline 2   \n'), 'line 1\nline 2');
    assert.ok(compareOutputs('10 20\r\n', '10 20\n'));
    assert.ok(compareOutputs('42\n\n', '42'));
    assert.ok(!compareOutputs('42', '43'));
  });

  it('Chặn đứng các API nguy hiểm bảo vệ môi trường Sandbox (Security Guard)', async () => {
    const dangerousCode = `
      function solve(input) {
        const cp = require('child_process');
        return 'hacked';
      }
    `;

    const res = await executeTestcase(dangerousCode, 'javascript', '1', '1');
    assert.equal(res.verdict, VERDICTS.RTE);
    assert.ok(res.message.includes('Security Policy Violation'));
  });

  it('Cơ chế dừng sớm (Fail-Fast) khi gặp Wrong Answer ở testcase đầu tiên', async () => {
    const wrongCode = `
      function solve(input) {
        const n = parseInt(input.trim(), 10);
        if (n === 2) return "WA_VAL";
        return String(n);
      }
    `;

    const testcases = [
      { stdin: '1', expectedStdout: '1' },
      { stdin: '2', expectedStdout: '2' }, // Sẽ fail tại đây
      { stdin: '3', expectedStdout: '3' }
    ];

    const res = await evaluateSubmission(wrongCode, 'javascript', testcases);
    assert.equal(res.verdict, VERDICTS.WA);
    assert.equal(res.failedTestIndex, 2);
    assert.equal(res.passedCount, 1);
    assert.equal(res.totalCount, 3);
  });

  it('Mã nguồn rỗng phải trả về Compilation Error (CE)', async () => {
    const res = await executeTestcase('', 'javascript', '', '');
    assert.equal(res.verdict, VERDICTS.CE);
  });
});
