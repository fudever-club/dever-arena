/**
 * DEVER Arena — Judge pool: hàng đợi FIFO + N worker processes (fork).
 * - API không bao giờ chạy code thí sinh trên event-loop của nó.
 * - Worker chết/timeout → respawn trong suốt, job lỗi trả về caller.
 * - Quy mô local dev (đa máy thật cần Redis/RabbitMQ — xem JUDGE_ARCHITECTURE).
 */
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_COUNT = Math.max(1, Math.min(4, Number(process.env.DEVER_JUDGE_WORKERS || 2)));
const JOB_TIMEOUT_MS = Number(process.env.DEVER_JUDGE_TIMEOUT_MS || 60000);

const workers = []; // { proc, busy, job }
const queue = [];   // [{ op, payload, resolve, reject, timer }]
let seq = 1;
let started = false;

function spawnWorker() {
  const proc = fork(join(HERE, 'judgeWorker.js'), { silent: true });
  const w = { proc, busy: false, job: null };
  // Không giữ process test/server khi xong việc (kèm shutdown tường minh).
  proc.unref();
  proc.on('message', (msg) => {
    const job = w.job;
    w.busy = false;
    w.job = null;
    if (job && msg && msg.id === job.id) {
      clearTimeout(job.timer);
      if (msg.ok) job.resolve(msg.result);
      else job.reject(new Error(msg.error || 'Judge worker lỗi'));
    }
    pump();
  });
  proc.on('exit', () => {
    const idx = workers.indexOf(w);
    if (idx >= 0) workers.splice(idx, 1);
    if (w.job) {
      clearTimeout(w.job.timer);
      w.job.reject(new Error('Judge worker chết giữa chừng, thử nộp lại.'));
      w.job = null;
    }
    // Respawn để pool luôn đủ (trừ khi đang shutdown)
    if (started) {
      const replacement = spawnWorker();
      workers.push(replacement);
      pump();
    }
  });
  return w;
}

function ensureStarted() {
  if (started) return;
  started = true;
  const n = Number.isFinite(WORKER_COUNT) && WORKER_COUNT > 0 ? WORKER_COUNT : 2;
  for (let i = 0; i < n; i++) workers.push(spawnWorker());
}

function pump() {
  if (queue.length === 0) return;
  const w = workers.find((x) => !x.busy);
  if (!w) return;
  const job = queue.shift();
  w.busy = true;
  w.job = job;
  job.timer = setTimeout(() => {
    try { w.proc.kill('SIGKILL'); } catch {}
    // on exit sẽ reject job + respawn
  }, JOB_TIMEOUT_MS);
  w.proc.send({ id: job.id, op: job.op, payload: job.payload });
}

function run(op, payload) {
  ensureStarted();
  return new Promise((resolve, reject) => {
    queue.push({ id: seq++, op, payload, resolve, reject, timer: null });
    pump();
  });
}

export const judgeQueue = {
  judgeTests: (args) => run('judgeTests', args),
  executeOne: (args) => run('executeOne', args),
  stats: () => ({ workers: workers.length, busy: workers.filter((w) => w.busy).length, queued: queue.length }),
};

export function shutdownJudge() {
  started = false;
  for (const w of workers) {
    try { w.proc.kill('SIGTERM'); } catch {}
  }
  workers.length = 0;
  while (queue.length > 0) {
    const job = queue.shift();
    clearTimeout(job.timer);
    job.reject(new Error('Judge pool đang tắt.'));
  }
}
