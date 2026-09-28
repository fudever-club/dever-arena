import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken } from '../lib/apiClient';

const STORAGE_KEY = 'dever.notifs';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function save(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-50))); } catch {}
}

/**
 * Task 109 — Notification center (in-app, zero-dependency):
 * - Nguồn 1: SSE mọi contest LIVE (EVENT_PHASE_CHANGED / EVENT_ANNOUNCEMENT / EVENT_STANDINGS_UPDATE đầu tiên).
 * - Nguồn 2: poll GET /submissions?user_id=me mỗi 30s khi có token → thông báo verdict bài nộp mới.
 * - Lưu localStorage (tối đa 50), đã đọc tính theo seenAt; tự tắt khi tab ẩn (visibilitychange).
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState(load);
  const [seenAt, setSeenAt] = useState(() => {
    try { return Number(localStorage.getItem('dever.notifs.seenAt') || 0); } catch { return 0; }
  });
  const sourcesRef = useRef([]);
  const lastSubAtRef = useRef(0);

  const push = useCallback((n) => {
    setNotifications((prev) => {
      if (prev.some((x) => x.id === n.id)) return prev;
      const next = [{ id: n.id, title: n.title, body: n.body, kind: n.kind || 'info', at: n.at || Date.now(), href: n.href || null }, ...prev].slice(0, 50);
      save(next);
      return next;
    });
  }, []);

  // Nguồn SSE: subscribe mọi contest LIVE/REGISTRATION đang có (reconnect nhẹ khi contests đổi ít).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) return;
      try {
        const d = await api.getContests();
        if (cancelled || !Array.isArray(d?.contests)) return;
        const live = d.contests.filter((c) => c.status !== 'FINISHED').slice(0, 4);
        for (const c of live) {
          const es = api.streamContest(c.id, (ev, payload) => {
            if (ev === 'EVENT_PHASE_CHANGED') {
              push({ id: `phase-${c.id}-${payload.phase}-${Date.now()}`, kind: 'phase', title: `${c.title}`, body: `Kỳ thi chuyển sang ${payload.phase}`, href: '/arena' });
            } else if (ev === 'EVENT_ANNOUNCEMENT') {
              push({ id: `ann-${payload.announcement?.id}`, kind: 'announcement', title: 'Thông báo ban tổ chức', body: payload.announcement?.message || '', href: '/arena' });
            }
          });
          sourcesRef.current.push(es);
        }
      } catch { /* backend offline */ }
    })();
    return () => {
      cancelled = true;
      sourcesRef.current.forEach((es) => { try { es.close(); } catch {} });
      sourcesRef.current = [];
    };
  }, [push]);

  // Nguồn poll: bài nộp mới của tôi (verdict sau chấm). 30s, bỏ qua khi tab ẩn.
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    const tick = async () => {
      if (document.hidden || !alive) return;
      try {
        const d = await api.listSubmissions('');
        const mine = (d.submissions || []).filter((s) => s.user_id && s.submitted_at);
        for (const s of mine.slice(0, 5)) {
          const at = new Date(s.submitted_at).getTime();
          if (at <= lastSubAtRef.current) continue;
          lastSubAtRef.current = Math.max(lastSubAtRef.current, at);
          const ac = String(s.verdict).toUpperCase() === 'AC';
          push({
            id: `sub-${s.id}`,
            kind: ac ? 'success' : 'verdict',
            title: ac ? 'Accepted! 🎉' : `Kết quả: ${String(s.verdict).toUpperCase()}`,
            body: `Bài nộp ${s.id} • ${s.language}`,
            href: s.problem_id ? `/problem/${s.problem_id}` : '/arena',
          });
        }
      } catch { /* im lặng */ }
    };
    lastSubAtRef.current = Date.now(); // chỉ báo bài nộp MỚI sau khi mở app
    tick();
    const t = setInterval(tick, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [push]);

  const unread = notifications.filter((n) => n.at > seenAt).length;
  const markAllRead = useCallback(() => {
    const t = Date.now();
    try { localStorage.setItem('dever.notifs.seenAt', String(t)); } catch {}
    setSeenAt(t);
  }, []);
  const clearAll = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setNotifications([]);
  }, []);

  return { notifications, unread, markAllRead, clearAll, push };
}
