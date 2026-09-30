import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import {
  getRankColor, getRankBadgeColor, getTierName, RatingChartOverlay,
} from '../components/profile/charts';

const DIFF_KEYS = [
  ['rating', 'Elo hiện tại'],
  ['solved', 'Bài đã solved'],
  ['submissions', 'Tổng bài nộp'],
  ['acceptance_rate', 'Tỷ lệ AC (%)'],
  ['contests_played', 'Số kỳ thi'],
  ['best_rank', 'Thứ hạng tốt nhất'],
];

const StatCell = ({ a, b, k }) => {
  const va = a?.[k];
  const vb = b?.[k];
  const num = (v) => (typeof v === 'number' ? v : 0);
  const better = k === 'best_rank'
    ? (num(va) && num(vb) ? (num(va) < num(vb) ? 'a' : num(vb) < num(va) ? 'b' : null) : null)
    : (num(va) > num(vb) ? 'a' : num(vb) > num(va) ? 'b' : null);
  return (
    <td className={`py-3 px-4 text-right tabular-nums font-mono text-sm ${better === 'a' ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>{va ?? 'chưa có'}</td>
  );
};

export const ComparePage = () => {
  const navigate = useNavigate();
  const [aName, setAName] = useState('');
  const [bName, setBName] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const runCompare = async (ua, ub) => {
    if (!ua || !ub || ua === ub) { setError('Nhập 2 username khác nhau.'); return; }
    setLoading(true);
    setError('');
    try {
      const d = await api.compareUsers(ua, ub);
      setData(d);
    } catch (e) {
      setData(null);
      setError(e?.message || 'Không lấy được dữ liệu so sánh.');
    } finally {
      setLoading(false);
    }
  };

  // Đọc ?a=&b= từ hash router: #/compare?a=x&b=y → useLocation search không hoạt động với hash-query,
  // nên parse trực tiếp location.hash.
  useEffect(() => {
    const h = window.location.hash || '';
    const qi = h.indexOf('?');
    if (qi < 0) return;
    const q = new URLSearchParams(h.slice(qi + 1));
    const ua = q.get('a') || '';
    const ub = q.get('b') || '';
    if (ua && ub) { setAName(ua); setBName(ub); runCompare(ua, ub); }
  }, []);

  const a = data?.a;
  const b = data?.b;
  const unionTags = (() => {
    if (!a || !b) return [];
    const map = new Map();
    for (const t of [...(a.tags || []), ...(b.tags || [])]) {
      const e = map.get(t.tag) || { tag: t.tag, a: 0, b: 0 };
      if (a.tags?.some((x) => x.tag === t.tag)) e.a = t.solved;
      if (b.tags?.some((x) => x.tag === t.tag)) e.b = t.solved;
      map.set(t.tag, e);
    }
    return [...map.values()];
  })();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="border-b border-[#23252a] pb-6">
        <span className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400">Head-to-head</span>
        <h1 className="text-[28px] leading-[1.2] tracking-[-0.6px] font-semibold text-white mt-1.5">So sánh 2 thí sinh</h1>
        <p className="text-sm text-slate-400 mt-1.5 max-w-[65ch]">Elo, hiệu suất và thành tích đối đầu theo rank thật trong các kỳ thi chung.</p>
      </div>

      <div className="bg-[#0f1011] border border-[#23252a] rounded-xl p-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
        <div className="flex-1">
          <label htmlFor="cmp-a" className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400 block mb-1.5">Thí sinh A</label>
          <input id="cmp-a" value={aName} onChange={(e) => setAName(e.target.value.trim())} placeholder="username A"
            className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white placeholder-slate-500 outline-none font-mono text-sm focus-visible:ring-2 focus-visible:ring-[#ff6600]/60" />
        </div>
        <div className="flex-1">
          <label htmlFor="cmp-b" className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400 block mb-1.5">Thí sinh B</label>
          <input id="cmp-b" value={bName} onChange={(e) => setBName(e.target.value.trim())} placeholder="username B"
            className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white placeholder-slate-500 outline-none font-mono text-sm focus-visible:ring-2 focus-visible:ring-[#ff6600]/60" />
        </div>
        <button
          onClick={() => runCompare(aName, bName)}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-semibold text-sm transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60"
        >
          {loading ? 'Đang so…' : 'So sánh'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#0f1011] border border-[#23252a] text-red-400 text-sm" role="status">{error}</div>
      )}

      {data && a && b && (
        <>
          {/* Header 2 cột — card-title 22px/500/-0.4px theo Linear */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-[#0f1011] border border-[#23252a] rounded-xl p-6">
            <button onClick={() => navigate(`/profile/${a.user.username}`)} className="text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60 rounded-lg">
              <span className={`block text-[22px] leading-[1.25] tracking-[-0.4px] font-medium group-hover:underline ${getRankColor(a.user.rating)}`}>{a.user.username}</span>
              <span className={`text-[11px] border px-2 py-0.5 rounded-full inline-block mt-1.5 ${getRankBadgeColor(a.user.role, a.user.rating)}`}>
                {getTierName(a.user.role, a.user.rating)} • {a.user.rating}
              </span>
            </button>
            <span className="text-[#8a8f98] text-xs font-semibold tracking-[0.4px] uppercase">vs</span>
            <button onClick={() => navigate(`/profile/${b.user.username}`)} className="text-right group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60 rounded-lg">
              <span className={`block text-[22px] leading-[1.25] tracking-[-0.4px] font-medium group-hover:underline ${getRankColor(b.user.rating)}`}>{b.user.username}</span>
              <span className={`text-[11px] border px-2 py-0.5 rounded-full inline-block mt-1.5 ${getRankBadgeColor(b.user.role, b.user.rating)}`}>
                {getTierName(b.user.role, b.user.rating)} • {b.user.rating}
              </span>
            </button>
          </div>

          {/* Elo overlay */}
          <div className="bg-[#0f1011] border border-[#23252a] rounded-xl overflow-hidden">
            <div className="px-6 pt-5 text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400">Lịch sử Elo</div>
            <RatingChartOverlay
              series={[
                { label: a.user.username, history: a.rating_history, color: '#ff6600' },
                { label: b.user.username, history: b.rating_history, color: '#3b82f6' },
              ]}
            />
          </div>

          {/* Stats diff */}
          <div className="bg-[#0f1011] border border-[#23252a] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#141516] border-b border-[#23252a] text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4 text-left">Chỉ số</th>
                  <th className="py-3 px-4 text-right text-[#ff6600]">{a.user.username}</th>
                  <th className="py-3 px-4 text-right text-blue-400">{b.user.username}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {DIFF_KEYS.map(([k, label]) => (
                  <tr key={k}>
                    <td className="py-3 px-4 text-slate-400">{label}</td>
                    <StatCell a={a.stats} b={b.stats} k={k} />
                    <td className={`py-3 px-4 text-right tabular-nums font-mono text-sm ${
                      (k === 'best_rank'
                        ? (a.stats?.[k] && b.stats?.[k] && b.stats[k] < a.stats[k])
                        : (b.stats?.[k] > a.stats?.[k]))
                        ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}
                    >
                      {b.stats?.[k] ?? 'chưa có'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Head-to-head */}
          <div className="bg-[#0f1011] border border-[#23252a] rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400">Đối đầu ({data.head_to_head.contests.length} kỳ chung)</h2>
              <span className="text-xs font-mono">
                <span className="text-[#ff6600] font-bold">{data.head_to_head.wins_a}</span>
                <span className="text-slate-500"> : </span>
                <span className="text-blue-400 font-bold">{data.head_to_head.wins_b}</span>
              </span>
            </div>
            {data.head_to_head.contests.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có kỳ thi nào cả hai cùng có rank trong standings.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-white/5">
                  {data.head_to_head.contests.map((c) => (
                    <tr key={c.contest_id}>
                      <td className="py-3 text-slate-300">{c.title}</td>
                      <td className={`py-3 text-right font-mono font-bold ${c.rank_a < c.rank_b ? 'text-emerald-400' : 'text-slate-400'}`}>#{c.rank_a}</td>
                      <td className="py-3 text-center text-slate-600 w-8">vs</td>
                      <td className={`py-3 text-right font-mono font-bold ${c.rank_b < c.rank_a ? 'text-emerald-400' : 'text-slate-400'}`}>#{c.rank_b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Tags union */}
          <div className="bg-[#0f1011] border border-[#23252a] rounded-xl p-6 space-y-3">
            <h2 className="text-[13px] font-medium tracking-[0.4px] uppercase text-slate-400">Sức mạnh theo tag (solved)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {unionTags.map((t) => (
                <div key={t.tag} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 truncate mr-2">{t.tag}</span>
                  <span className="font-mono">
                    <span className="text-[#ff6600] font-bold">{t.a}</span>
                    <span className="text-slate-600"> / </span>
                    <span className="text-blue-400 font-bold">{t.b}</span>
                  </span>
                </div>
              ))}
              {unionTags.length === 0 && <p className="text-xs text-slate-500">Chưa có dữ liệu tag.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ComparePage;
