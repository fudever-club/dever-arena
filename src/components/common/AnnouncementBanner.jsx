import React, { useCallback, useEffect, useState } from 'react';
import { useContest } from '../../context/ContestContext.jsx';
import { getToken } from '../../lib/apiClient.js';

const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

function dismissedKey(contestId) {
  return `dever_announcements_dismissed:${contestId || 'global'}`;
}

function readDismissed(contestId) {
  try {
    const raw = localStorage.getItem(dismissedKey(contestId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function normalize(item) {
  if (!item || typeof item !== 'object') return null;
  const id = item.id ?? item.announcement_id ?? item.uuid;
  if (id === undefined || id === null || id === '') return null;
  return {
    id: String(id),
    title: item.title ?? item.subject ?? 'Thông báo từ jury',
    message: item.message ?? item.content ?? item.text ?? item.body ?? '',
    createdAt: item.created_at ?? item.createdAt ?? item.time ?? null,
  };
}

/**
 * AnnouncementBanner — banner thông báo jury realtime (luxury-minimal).
 * - Lần đầu: GET /api/v1/announcements?contest_id= (fetch trực tiếp + getToken()).
 * - Realtime: EventSource riêng tới /api/v1/stream/contests/{id}?token=, nghe EVENT_ANNOUNCEMENT.
 * - Rỗng → render null (E2E an toàn). Mỗi thông báo dismiss được (persist localStorage).
 */
export const AnnouncementBanner = () => {
  const { contestId } = useContest();
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(() => readDismissed(contestId));

  useEffect(() => {
    setDismissed(readDismissed(contestId));
  }, [contestId]);

  // Lần đầu: tải danh sách thông báo của contest hiện tại.
  useEffect(() => {
    if (!contestId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = getToken();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(
          `${API_BASE}/api/v1/announcements?contest_id=${encodeURIComponent(contestId)}`,
          { headers },
        );
        if (!res.ok) return;
        let data = null;
        try {
          data = await res.json();
        } catch {
          return;
        }
        const raw = Array.isArray(data)
          ? data
          : data?.announcements ?? data?.data ?? data?.items ?? [];
        if (!Array.isArray(raw)) return;
        const normalized = raw.map(normalize).filter(Boolean);
        if (!cancelled && normalized.length > 0) {
          setItems((prev) => {
            const seen = new Set(prev.map((a) => a.id));
            const fresh = normalized.filter((a) => !seen.has(a.id));
            return fresh.length > 0 ? [...fresh, ...prev] : prev;
          });
        }
      } catch {
        // Backend chưa có / offline → im lặng, render null (E2E an toàn).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contestId]);

  // Realtime: kênh SSE riêng, chỉ nghe EVENT_ANNOUNCEMENT.
  useEffect(() => {
    if (!contestId || typeof EventSource === 'undefined') return undefined;
    let es = null;
    try {
      const token = getToken() || '';
      const url =
        `${API_BASE}/api/v1/stream/contests/${encodeURIComponent(contestId)}` +
        `?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      const onAnnouncement = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const item = normalize(payload?.announcement ?? payload);
          if (!item) return;
          setItems((prev) => {
            if (prev.some((a) => a.id === item.id)) return prev;
            return [item, ...prev];
          });
        } catch {
          // Bỏ qua event hỏng.
        }
      };
      es.addEventListener('EVENT_ANNOUNCEMENT', onAnnouncement);
    } catch {
      // Không mở được SSE → giữ list đã fetch.
    }
    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, [contestId]);

  const handleDismiss = useCallback(
    (id) => {
      const key = String(id);
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(key);
        try {
          localStorage.setItem(dismissedKey(contestId), JSON.stringify([...next]));
        } catch {}
        return next;
      });
    },
    [contestId],
  );

  const visible = items.filter((a) => !dismissed.has(String(a.id)));
  if (visible.length === 0) return null;

  return (
    <div className="bg-[#0f1011] border-b border-[#23252a]" data-testid="announcement-banner">
      <div className="mx-auto max-w-6xl px-4 py-2 space-y-2">
        {visible.map((a) => (
          <div
            key={a.id}
            role="status"
            className="flex items-start gap-3 rounded-lg border border-[#23252a] bg-[#0f1011] px-3 py-2"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff6600]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-100">{a.title}</p>
              {a.message ? (
                <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-300">
                  {a.message}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => handleDismiss(a.id)}
              aria-label={`Ẩn thông báo: ${a.title}`}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementBanner;
