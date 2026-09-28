/**
 * DEVER Arena Judge Worker Queue Protocol
 * Hàng đợi ưu tiên 3 cấp độ chuẩn hóa theo docs/JUDGE_ARCHITECTURE.md
 * Cấp 1 (HIGH: hack-oracle đổi thành job ưu tiên cao/chấm thủ công) > Cấp 2 (DEFAULT: nộp bài thi) > Cấp 3 (BATCH: chấm lại hàng loạt)
 * Ghi chú ADR-005: không còn hàng đợi Hack; cấp 1 dành cho job ưu tiên cao tương lai (chấm xét duyệt, custom test).
 */

import { evaluateSubmission } from './isolateRunner.js';

export const QUEUE_PRIORITIES = {
  HIGH: 1,      // Cấp ưu tiên cao nhất (phản hồi < 3s: custom test / tác vụ ưu tiên)
  DEFAULT: 2,   // Cấp mặc định (nộp bài trong contest)
  BATCH: 3      // Cấp thấp / chạy hàng loạt (rejudge, chấm lại toàn contest)
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
      [QUEUE_PRIORITIES.HIGH]: [],
      [QUEUE_PRIORITIES.DEFAULT]: [],
      [QUEUE_PRIORITIES.BATCH]: []
    };
  }

  /**
   * Đưa job chấm bài vào hàng đợi
   * @param {object} job
   * @param {string} job.id
   * @param {number} [job.priority=QUEUE_PRIORITIES.DEFAULT]
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

    const priority = job.priority || QUEUE_PRIORITIES.DEFAULT;
    if (!this.queues[priority]) {
      throw new Error(`Invalid priority level: ${priority}. Must be 1 (HIGH), 2 (DEFAULT), or 3 (BATCH)`);
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
    // 1. Kiểm tra hàng ưu tiên cao (Priority 1)
    if (this.queues[QUEUE_PRIORITIES.HIGH].length > 0) {
      return this.queues[QUEUE_PRIORITIES.HIGH].shift();
    }
    // 2. Kiểm tra hàng nộp bài thường (Priority 2)
    if (this.queues[QUEUE_PRIORITIES.DEFAULT].length > 0) {
      return this.queues[QUEUE_PRIORITIES.DEFAULT].shift();
    }
    // 3. Kiểm tra hàng chạy hàng loạt (Priority 3)
    if (this.queues[QUEUE_PRIORITIES.BATCH].length > 0) {
      return this.queues[QUEUE_PRIORITIES.BATCH].shift();
    }

    return null;
  }

  /**
   * Thống kê trạng thái hàng đợi
   * @returns {{ totalWaiting: number, byPriority: { high: number, default: number, batch: number }, activeWorkers: number, processedCount: number }}
   */
  getQueueStats() {
    const highCount = this.queues[QUEUE_PRIORITIES.HIGH].length;
    const defaultCount = this.queues[QUEUE_PRIORITIES.DEFAULT].length;
    const batchCount = this.queues[QUEUE_PRIORITIES.BATCH].length;

    return {
      totalWaiting: highCount + defaultCount + batchCount,
      byPriority: {
        high: highCount,
        default: defaultCount,
        batch: batchCount
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
    this.queues[QUEUE_PRIORITIES.HIGH] = [];
    this.queues[QUEUE_PRIORITIES.DEFAULT] = [];
    this.queues[QUEUE_PRIORITIES.BATCH] = [];
  }
}
