/**
 * DEVER Arena Judge Worker Queue Protocol
 * Hàng đợi ưu tiên 3 cấp độ chuẩn hóa theo docs/JUDGE_ARCHITECTURE.md
 * Cấp 1 (HACK) > Cấp 2 (PRETEST) > Cấp 3 (SYSTEM_TEST)
 */

import { evaluateSubmission } from './isolateRunner.js';

export const QUEUE_PRIORITIES = {
  HACK: 1,        // Cấp ưu tiên cao nhất (Instant Hack Queue: phản hồi < 3s)
  PRETEST: 2,     // Cấp ưu tiên trung bình (Pretest Queue trong Coding Phase)
  SYSTEM_TEST: 3  // Cấp ưu tiên thấp / chạy hàng loạt (System Test Queue sau contest)
};

export class JudgeWorkerQueue {
  /**
   * @param {object} options 
   * @param {number} options.maxConcurrency 
   */
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 2;
    this.activeWorkers = 0;
    this.processedCount = 0;
    this.history = [];

    // 3 hàng đợi độc lập cho 3 tầng ưu tiên
    this.queues = {
      [QUEUE_PRIORITIES.HACK]: [],
      [QUEUE_PRIORITIES.PRETEST]: [],
      [QUEUE_PRIORITIES.SYSTEM_TEST]: []
    };
  }

  /**
   * Đưa job chấm bài hoặc hack vào hàng đợi
   * @param {object} job 
   * @param {string} job.id 
   * @param {number} [job.priority=QUEUE_PRIORITIES.PRETEST] 
   * @param {string} job.sourceCode 
   * @param {string} job.language 
   * @param {Array<{ stdin: string, expectedStdout: string }>} job.testcases 
   * @param {object} [job.limits] 
   * @returns {{ jobId: string, priority: number, queuePosition: number, status: string }}
   */
  enqueue(job) {
    if (!job || !job.id) {
      throw new Error('Invalid job: job must have an id');
    }

    const priority = job.priority || QUEUE_PRIORITIES.PRETEST;
    if (!this.queues[priority]) {
      throw new Error(`Invalid priority level: ${priority}. Must be 1 (HACK), 2 (PRETEST), or 3 (SYSTEM_TEST)`);
    }

    const jobItem = {
      ...job,
      priority,
      enqueuedAt: Date.now(),
      status: 'QUEUED'
    };

    this.queues[priority].push(jobItem);

    // Tính toán số lượng job đang chờ trước job này
    let position = 0;
    for (let p = 1; p < priority; p++) {
      position += this.queues[p].length;
    }
    position += this.queues[priority].length;

    return {
      jobId: job.id,
      priority,
      queuePosition: position,
      status: 'QUEUED'
    };
  }

  /**
   * Lấy job tiếp theo có mức độ ưu tiên cao nhất (Strict Priority FIFO)
   * @returns {object | null}
   */
  dequeue() {
    // 1. Kiểm tra Instant Hack Queue (Priority 1)
    if (this.queues[QUEUE_PRIORITIES.HACK].length > 0) {
      return this.queues[QUEUE_PRIORITIES.HACK].shift();
    }
    // 2. Kiểm tra Pretest Queue (Priority 2)
    if (this.queues[QUEUE_PRIORITIES.PRETEST].length > 0) {
      return this.queues[QUEUE_PRIORITIES.PRETEST].shift();
    }
    // 3. Kiểm tra System Test Queue (Priority 3)
    if (this.queues[QUEUE_PRIORITIES.SYSTEM_TEST].length > 0) {
      return this.queues[QUEUE_PRIORITIES.SYSTEM_TEST].shift();
    }

    return null;
  }

  /**
   * Thống kê trạng thái hàng đợi
   * @returns {{ totalWaiting: number, byPriority: { hack: number, pretest: number, systemTest: number }, activeWorkers: number, processedCount: number }}
   */
  getQueueStats() {
    const hackCount = this.queues[QUEUE_PRIORITIES.HACK].length;
    const pretestCount = this.queues[QUEUE_PRIORITIES.PRETEST].length;
    const systemTestCount = this.queues[QUEUE_PRIORITIES.SYSTEM_TEST].length;

    return {
      totalWaiting: hackCount + pretestCount + systemTestCount,
      byPriority: {
        hack: hackCount,
        pretest: pretestCount,
        systemTest: systemTestCount
      },
      activeWorkers: this.activeWorkers,
      processedCount: this.processedCount
    };
  }

  /**
   * Xử lý 1 job tiếp theo trong hàng đợi
   * @param {Function} [customExecutor] Hàm thực thi tùy chọn
   * @returns {Promise<object | null>}
   */
  async processNext(customExecutor) {
    const job = this.dequeue();
    if (!job) return null;

    this.activeWorkers++;
    job.status = 'RUNNING';
    job.startedAt = Date.now();

    try {
      let result;
      if (typeof customExecutor === 'function') {
        result = await customExecutor(job);
      } else {
        result = await evaluateSubmission(
          job.sourceCode,
          job.language || 'javascript',
          job.testcases || [],
          job.limits || {}
        );
      }

      job.status = 'COMPLETED';
      job.finishedAt = Date.now();
      job.durationMs = job.finishedAt - job.startedAt;
      job.result = result;

      this.processedCount++;
      this.history.push({
        id: job.id,
        priority: job.priority,
        verdict: result.verdict,
        durationMs: job.durationMs
      });

      return {
        jobId: job.id,
        status: 'COMPLETED',
        verdict: result.verdict,
        details: result,
        durationMs: job.durationMs
      };
    } catch (err) {
      job.status = 'FAILED';
      job.error = err.message;
      return {
        jobId: job.id,
        status: 'FAILED',
        error: err.message
      };
    } finally {
      this.activeWorkers--;
    }
  }

  /**
   * Xử lý toàn bộ các jobs hiện có trong hàng đợi theo thứ tự ưu tiên
   * @param {Function} [customExecutor] 
   * @returns {Promise<Array<object>>}
   */
  async processAll(customExecutor) {
    const results = [];
    while (this.getQueueStats().totalWaiting > 0) {
      const res = await this.processNext(customExecutor);
      if (res) results.push(res);
    }
    return results;
  }

  /**
   * Xóa sạch toàn bộ hàng đợi
   */
  clear() {
    this.queues[QUEUE_PRIORITIES.HACK] = [];
    this.queues[QUEUE_PRIORITIES.PRETEST] = [];
    this.queues[QUEUE_PRIORITIES.SYSTEM_TEST] = [];
  }
}
