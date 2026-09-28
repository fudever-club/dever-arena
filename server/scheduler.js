/**
 * DEVER Arena — Auto-phase scheduler (Task 103, ADR-005: 3 phase).
 * Thuần Node (setInterval, zero dependency): kỳ thi tự chuyển phase theo thời gian:
 *   REGISTRATION → CODING  khi now >= start_time
 *   CODING → FINISHED      khi now >= start_time + duration_minutes
 * Admin vẫn ghi đè tay qua POST /api/v1/admin/phase — scheduler chỉ đọc `status` hiện tại
 * nên mọi can thiệp tay đều được tôn trọng (idempotent theo status, không downgrade).
 * `now()` inject được để test giả lập thời gian không phải sleep thật.
 */

/**
 * @param {object} deps
 * @param {object} deps.db            store có .data.contests và .update(store, pred, patch)
 * @param {(c: object) => void} deps.finishContest  chấm Elo (nếu rated) + set status FINISHED — dùng chung với admin phase
 * @param {(contestId: string, event: string, payload: object) => void} [deps.broadcast]
 * @param {() => number} [deps.now]
 * @param {(...args: unknown[]) => void} [deps.log]
 */
export function createScheduler({ db, finishContest, broadcast, now = () => Date.now(), log = () => {} }) {
  function tick() {
    const t = now();
    let changed = 0;
    for (const c of db.data.contests || []) {
      const startMs = new Date(c.start_time).getTime();
      if (Number.isNaN(startMs)) continue;
      if (c.status === 'REGISTRATION' && t >= startMs) {
        db.update('contests', (x) => x.id === c.id, { status: 'CODING' });
        broadcast?.(c.id, 'EVENT_PHASE_CHANGED', { phase: 'CODING', by: 'scheduler' });
        changed += 1;
        log(`[scheduler] ${c.id}: REGISTRATION → CODING (đến giờ start_time)`);
      } else if (c.status === 'CODING' && t >= startMs + (Number(c.duration_minutes) || 0) * 60000) {
        finishContest(c);
        broadcast?.(c.id, 'EVENT_PHASE_CHANGED', { phase: 'FINISHED', by: 'scheduler' });
        broadcast?.(c.id, 'EVENT_STANDINGS_UPDATE', {});
        changed += 1;
        log(`[scheduler] ${c.id}: CODING → FINISHED (hết ${c.duration_minutes} phút)`);
      }
    }
    return changed;
  }

  let timer = null;
  return {
    tick,
    /** Bắt đầu chu kỳ. Mặc định 30s tick/lần. Lần boot đầu server tự tick 1 phát để bắt kịp giờ. */
    start(intervalMs = 30000) {
      if (timer) return;
      timer = setInterval(() => {
        try { tick(); } catch (e) { log('[scheduler] tick lỗi:', e?.message || e); }
      }, Math.max(10, intervalMs));
      // Không giữ process test/server vì scheduler (shutdown tường minh qua stop()).
      timer.unref?.();
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
    },
    get running() { return timer !== null; },
  };
}
