import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/apiClient';

// Podium: số hạng mono trên badge pill thay emoji (taste: zero emoji trang trí)

/**
 * Task 112 — Trang tổng kết kỳ thi `/contest/:slug/summary`.
 * Standings cuối (format ICPC), podium top 3, thống kê per-problem (solve rate).
 * In PDF = Ctrl+P: stylesheet @media print ẩn chrome, giữ bảng — zero dependency.
 */
export const ContestSummaryPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [contest, setContest] = useState(null);
  const [standings, setStandings] = useState([]);
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cd, st] = await Promise.all([
          api.getContest(slug),
          api.getStandings(slug, { format: 'ICPC' }),
        ]);
        if (cancelled) return;
        setContest(cd?.contest || null);
        setProblems(cd?.problems || []);
        setStandings(st?.standings || []);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Không tải được tổng kết kỳ thi.');
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const totalSubs = problems.reduce((s, p) => s + (p.solvedCount || 0), 0);
  // ICPC row: { rank, username, solved: số bài, penalty, solves: mảng per-problem {code, solved, ...} }
  const topSolve = Math.max(0, ...standings.map((s) => Number(s.solved) || 0));

  if (error) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-10 max-w-3xl mx-auto">
        <div className="p-4 rounded-xl bg-[#0f1011] border border-[#23252a] text-red-400 text-sm" role="alert">
          {error}
          <button onClick={() => navigate('/arena')} className="ml-3 underline text-slate-300">← Về Kỳ Thi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-5xl mx-auto space-y-6 print:bg-white print:text-black">
      {/* Header + nút in (ẩn khi print) */}
      <div className="border-b border-[#23252a] pb-5 print:border-black/20 print:no-break-after no-print">
        <span className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400">Tổng kết kỳ thi</span>
        <h1 className="text-[28px] leading-[1.2] tracking-[-0.6px] font-semibold text-white mt-1.5 print:text-black">{contest?.title || 'Đang tải…'}</h1>
        <p className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums print:text-black/60">
          {contest ? `${contest.contest_format} • ${contest.duration_minutes} phút • ${new Date(contest.start_time).toLocaleString('vi-VN')}` : ''}
          {contest?.status !== 'FINISHED' && ' • (kỳ thi chưa kết thúc, số liệu tạm thời)'}
        </p>
      </div>

      <button
        onClick={() => window.print()}
        className="no-print inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-slate-200 text-xs font-semibold hover:bg-[#18191a] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60"
      >
        {/* Icon in: SVG đơn giản thay emoji */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        In / Lưu PDF
      </button>

      {/* Podium top 3 — grid responsive 3/1, rank badge mono thay emoji */}
      {standings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
          {standings.slice(0, 3).map((r, i) => (
            <div key={r.user_id || r.username || i} className="rounded-xl bg-[#0f1011] border border-[#23252a] p-6 text-center">
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-mono font-bold border ${
                i === 0 ? 'bg-[#ff6600] text-[#010102] border-[#ff6600]'
                : i === 1 ? 'bg-white/10 text-slate-200 border-[#34343a]'
                : 'bg-white/5 text-[#9ba3ae] border-[#23252a]'}`}
              >
                {i + 1}
              </span>
              <button
                onClick={() => r.username && navigate(`/profile/${r.username}`)}
                className="mt-2 block w-full text-sm font-semibold text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60 rounded truncate"
              >
                {r.username || 'ẩn danh'}
              </button>
              <p className="text-xs text-slate-400 font-mono mt-1 tabular-nums">
                {r.solved ?? 0} bài {Number(r.penalty) > 0 ? `• ${r.penalty} phạt` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-6 print:bg-white print:border-black/20">
          <div className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400 print:text-black/50">Thí sinh</div>
          <div className="mt-1.5 font-mono text-[28px] leading-[1.2] tracking-[-0.6px] font-semibold text-white print:text-black tabular-nums">{standings.length}</div>
        </div>
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-6 print:bg-white print:border-black/20">
          <div className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400 print:text-black/50">Số bài</div>
          <div className="mt-1.5 font-mono text-[28px] leading-[1.2] tracking-[-0.6px] font-semibold text-white print:text-black tabular-nums">{problems.length}</div>
        </div>
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-6 print:bg-white print:border-black/20">
          <div className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400 print:text-black/50">Top solve</div>
          <div className="mt-1.5 font-mono text-[28px] leading-[1.2] tracking-[-0.6px] font-semibold text-[#ff6600] print:text-black tabular-nums">{topSolve}</div>
        </div>
      </div>

      {/* Bảng xếp hạng cuối */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-x-auto print:bg-white print:border-black/20">
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead className="bg-[#141516] border-b border-[#23252a] text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400 print:bg-white print:text-black/60 print:border-black/20">
            <tr>
              <th className="py-3 px-4 w-14">Hạng</th>
              <th className="py-3 px-4">Thí sinh</th>
              <th className="py-3 px-4 w-20 text-right">Solved</th>
              <th className="py-3 px-4 w-24 text-right">Phạt</th>
              <th className="py-3 px-4 text-center">Bài</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 print:divide-black/10">
            {standings.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">Chưa có dữ liệu standings.</td></tr>
            ) : standings.map((r, i) => (
              <tr key={r.user_id || r.username || i}>
                <td className="py-3 px-4 font-mono font-bold text-slate-300 print:text-black">{i + 1}</td>
                <td className="py-3 px-4 font-semibold text-slate-200 print:text-black">{r.username || 'ẩn danh'}</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-[#ff6600] print:text-black tabular-nums">{r.solved ?? 0}</td>
                <td className="py-3 px-4 text-right font-mono text-slate-400 print:text-black/70 tabular-nums">{r.penalty ?? 0}</td>
                <td className="py-3 px-4 text-center font-mono text-slate-400 print:text-black/70">
                  {(r.solves || []).map((p) => (
                    <span key={p.code} className={`mx-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border ${p.solved ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 print:bg-white print:text-black' : 'bg-white/5 border-white/10 text-slate-600 print:border-black/20'}`}>
                      {p.code}{p.solved ? '✓' : ''}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContestSummaryPage;
