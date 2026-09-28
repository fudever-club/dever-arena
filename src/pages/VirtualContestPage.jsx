import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getToken } from '../lib/apiClient';

/**
 * Task 111 — Virtual Contest UI cho member.
 * Bấm "Thi ảo" từ contest FINISHED (ContestHub) → POST /virtual tạo phiên, rồi trang này:
 * - HUD đồng hồ ảo (elapsed / duration) tick mỗi giây từ start_time của phiên.
 * - Ghost standings tự động "phát lại" theo timeline thật (GET /virtual mỗi 5s).
 * Không đụng participants thật — backend đã tính riêng từ ghost submissions.
 */
export const VirtualContestPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null); // { session_id, duration_minutes, startedAtMs }
  const [board, setBoard] = useState(null); // { elapsedMinutes, standings }
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Tick đồng hồ hiển thị mỗi giây
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Tạo phiên ảo khi vào trang (idempotent theo UX: tạo 1 lần/lần mount)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) { navigate('/login?redirect=/arena'); return; }
      try {
        const [contest, s] = await Promise.all([
          api.getContest(slug),
          api.createVirtual(slug),
        ]);
        if (cancelled) return;
        setTitle(contest?.contest?.title || slug);
        const startedAtMs = new Date(s.start_time).getTime();
        setSession({ session_id: s.session_id, duration_minutes: s.duration_minutes || 120, startedAtMs });
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Không tạo được phiên thi ảo (contest phải FINISHED).');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, navigate]);

  // Poll ghost standings mỗi 5s
  useEffect(() => {
    if (!session?.session_id) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const v = await api.getVirtual(slug, session.session_id);
        if (!cancelled) setBoard(v);
      } catch { /* giữ bảng cũ */ }
    };
    pull();
    const t = setInterval(pull, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [slug, session?.session_id]);

  const elapsedMs = session ? Math.max(0, now - session.startedAtMs) : 0;
  const durationMs = (session?.duration_minutes || 120) * 60000;
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const done = remainingMs === 0;
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const pct = Math.min(100, (elapsedMs / durationMs) * 100);

  const rows = useMemo(() => board?.standings || [], [board]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="border-b border-[#23252a] pb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">VIRTUAL</span>
          <span className="text-[13px] font-medium tracking-[0.4px] text-slate-400 uppercase">Ghost Replay</span>
        </div>
        <h1 className="text-[28px] leading-[1.2] tracking-[-0.6px] font-semibold text-white mt-1.5">{title || 'Đang tải…'}</h1>
        <p className="text-sm text-slate-400 mt-1.5">Bảng điểm mô phỏng theo timeline thật của kỳ thi.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#0f1011] border border-[#23252a] text-red-400 text-sm" role="alert">
          {error}
          <button onClick={() => navigate('/arena')} className="ml-3 underline text-slate-300">← Về Kỳ Thi</button>
        </div>
      )}

      {loading && <p className="text-xs text-slate-500">Đang tạo phiên thi ảo…</p>}

      {session && (
        <>
          {/* HUD timer ảo — surface-1 + hairline, progress nằm trong card (Linear: 1 panel 1 chủ thể) */}
          <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400">{done ? 'Phiên đã kết thúc' : 'Thời gian ảo còn lại'}</p>
                <p className={`font-mono text-[40px] leading-[1.15] tracking-[-1px] font-semibold tabular-nums mt-1 ${done ? 'text-slate-500' : 'text-[#ff6600]'}`}>{fmt(remainingMs)}</p>
              </div>
              <div className="text-right text-xs text-slate-400 font-mono tabular-nums">
                Đã trôi {Math.floor(elapsedMs / 60000)}/{session.duration_minutes}′<br />
                Phiên {session.session_id.slice(0, 12)}…
              </div>
            </div>
            <div className="mt-4 h-1 rounded-full bg-[#010102] border border-[#23252a] overflow-hidden">
              <div className="h-full bg-[#ff6600]" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Ghost standings */}
          <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-[#141516] border-b border-[#23252a] text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4 w-14">#</th>
                  <th className="py-3 px-4">Thí sinh (ghost)</th>
                  <th className="py-3 px-4 w-24 text-right">Điểm</th>
                  <th className="py-3 px-4 text-center">Bài</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-500">Chưa có ghost nào nộp bài ở phút này…</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.user_id || i} className={i < 3 ? 'bg-white/[0.03]' : ''}>
                    <td className="py-3 px-4 font-mono font-bold text-slate-300">{i + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{r.username}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#ff6600] tabular-nums">{r.total}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-400">
                      {Object.entries(r.problems || {}).map(([code, p]) => (
                        <span key={code} className={`mx-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border ${p.status === 'AC' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : p.attempts ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-slate-600'}`}>
                          {code}{p.status === 'AC' ? '✓' : p.attempts ? `-${p.attempts}` : ''}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default VirtualContestPage;
