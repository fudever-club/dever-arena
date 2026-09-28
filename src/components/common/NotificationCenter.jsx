import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';

const KIND_STYLE = {
  success: 'border-emerald-500/30 text-emerald-300',
  verdict: 'border-red-500/30 text-red-300',
  phase: 'border-[#ff6600]/40 text-[#ff6600]',
  announcement: 'border-blue-500/30 text-blue-300',
  info: 'border-white/10 text-slate-300',
};

/** Task 109 — Chuông thông báo trên Navbar: badge unread + dropdown, zero-dependency. */
export const NotificationCenter = () => {
  const { notifications, unread, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open) markAllRead(); }}
        aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ''}`}
        aria-expanded={open}
        className="relative px-2 py-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60"
      >
        {/* Bell SVG inline zero-dependency */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ff6600] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-[#0f1011] border border-[#23252a] shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#23252a] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông báo</span>
            {notifications.length > 0 && (
              <button onClick={clearAll} className="text-[10px] text-slate-500 hover:text-slate-300 transition">Xóa hết</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-xs text-slate-500 text-center">Chưa có thông báo nào.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setOpen(false); if (n.href) navigate(n.href); }}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60"
                >
                  <span className={`text-[11px] font-semibold block ${KIND_STYLE[n.kind] || KIND_STYLE.info}`}>{n.title}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 line-clamp-2">{n.body}</span>
                  <span className="text-[10px] text-slate-600 block mt-1 font-mono">{new Date(n.at).toLocaleTimeString('vi-VN')}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
