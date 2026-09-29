import { useEffect, useState } from 'react';
import { useParams as useRouteParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/apiClient';
import {
  RatingChart, Heatmap, VerdictBars, LanguageBars, TagStrength,
  getRankBadgeColor, getTierName, verdictBadge, getRankColor,
} from '../components/profile/charts.jsx';

const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};

const StatCard = ({ label, value, accent = 'text-white' }) => (
  <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-4">
    <div className="text-[11px] text-slate-500 font-medium">{label}</div>
    <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
  </div>
);

export const ProfilePage = () => {
  const { user: viewer } = useAuth();
  const routeParams = useRouteParams();
  const navigate = useNavigate();
  const username = routeParams.username || viewer?.username || null;
  const isMe = !routeParams.username || routeParams.username === viewer?.username;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    setError('');
    setData(null);
    (async () => {
      try {
        const res = await api.getUserProfile(username);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Không tải được profile từ máy chủ.');
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  if (error) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-10 max-w-5xl mx-auto">
        <div className="rounded-xl bg-[#0f1011] border border-red-500/30 p-8 text-center">
          <p className="text-sm text-red-400 font-mono">{error}</p>
          <Link to="/arena" className="inline-block mt-4 text-xs text-slate-400 hover:text-white underline">← Về Kỳ Thi</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-10 max-w-5xl mx-auto">
        <p className="text-sm text-slate-400 font-mono animate-pulse">Đang tải profile…</p>
      </div>
    );
  }

  const { user, stats, rating_history, heatmap, verdicts, tags, languages, per_contest, recent_submissions } = data;
  const rating = Number(user?.rating ?? 0);
  const maxRating = Number(user?.max_rating ?? rating);
  const team = user?.team || 'Chưa có đội';
  const tierName = getTierName(user?.role, rating);
  const filtered = filter === 'ALL' ? recent_submissions : recent_submissions.filter((s) => String(s.verdict || '').toUpperCase() === filter);
  const upsolveBadge = (s) => (s.is_upsolve ? (
    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[9px] font-mono font-bold align-middle" title="Nộp sau khi contest kết thúc — không tính điểm">UPSOLVE</span>
  ) : null);
  const finishedContests = per_contest.filter((c) => c.status === 'FINISHED');
  const activeContests = per_contest.filter((c) => c.status !== 'FINISHED');

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-5xl mx-auto space-y-6">

      {/* 1. Header */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-full border border-[#23252a] bg-[#141516] flex items-center justify-center text-lg font-bold text-slate-300">
            {(user?.username || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={`text-xl font-semibold tracking-tight truncate ${getRankColor(rating)}`}>
                {user?.username || '—'}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getRankBadgeColor(user?.role, rating)}`}>
                {tierName} • {rating} Elo
              </span>
              {maxRating > rating && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono border border-white/10 text-slate-400">
                  max {maxRating}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">{user?.full_name || user?.name || user?.username || '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">Đội: {team}</p>
          </div>
          {isMe && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <p className="text-[11px] text-slate-500">Thứ hạng tốt nhất</p>
                <p className="font-mono text-2xl font-bold text-[#ff6600]">
                  {stats.best_rank != null ? `#${stats.best_rank}` : '—'}
                </p>
              </div>
              {/* Task 108: share + compare nhanh */}
              <button
                onClick={() => { try { navigator.clipboard?.writeText(window.location.href); } catch {} }}
                title="Copy link profile"
                className="px-2 py-1.5 rounded-lg bg-[#141516] border border-[#23252a] text-slate-400 hover:text-white transition text-[11px]"
              >
                Chia sẻ
              </button>
              <button
                onClick={() => navigate(`/compare?a=${encodeURIComponent(username)}&b=`)}
                title="So sánh với thí sinh khác"
                className="px-2 py-1.5 rounded-lg bg-[#141516] border border-[#23252a] text-slate-400 hover:text-white transition text-[11px]"
              >
                So sánh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Stats tổng */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Bài nộp" value={stats.submissions} />
        <StatCard label="Bài đã solved" value={stats.solved} accent="text-emerald-400" />
        <StatCard label="Tỉ lệ AC" value={`${stats.acceptance_rate}%`} />
        <StatCard label="Kỳ thi đã chơi" value={stats.contests_played} />
      </div>

      {/* 3. Rating chart */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#23252a] flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Lịch sử rating</h2>
          <span className="text-[11px] font-mono text-slate-500">{rating_history.length} kỳ thi rated</span>
        </div>
        <RatingChart history={rating_history} />
      </div>

      {/* 4. Heatmap 26 tuần */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#23252a]">
          <h2 className="text-sm font-semibold text-white">Nhịp độ luyện tập — 26 tuần</h2>
        </div>
        <Heatmap cells={heatmap} />
      </div>

      {/* 5. Verdicts + Languages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#23252a]">
            <h2 className="text-sm font-semibold text-white">Phân bố verdict</h2>
          </div>
          <VerdictBars verdicts={verdicts} />
        </div>
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#23252a]">
            <h2 className="text-sm font-semibold text-white">Ngôn ngữ sử dụng</h2>
          </div>
          <LanguageBars languages={languages} />
        </div>
      </div>

      {/* 6. Tag strength */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#23252a]">
          <h2 className="text-sm font-semibold text-white">Sức mạnh theo chủ đề</h2>
        </div>
        <TagStrength tags={tags} />
      </div>

      {/* 7. Kỳ thi đã tham gia */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#23252a]">
          <h2 className="text-sm font-semibold text-white">Kỳ thi đã tham gia</h2>
        </div>
        {per_contest.length === 0 ? (
          <p className="px-5 py-6 text-xs text-slate-500">Chưa tham gia kỳ thi nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="bg-[#141516] border-b border-[#23252a] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-5">Kỳ thi</th>
                  <th className="py-3 px-4">Thể thức</th>
                  <th className="py-3 px-4 text-center">Solved</th>
                  <th className="py-3 px-4 text-center">Nộp</th>
                  <th className="py-3 px-4 text-right">Điểm</th>
                  <th className="py-3 px-4 text-right">Hạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...finishedContests, ...activeContests].map((c) => (
                  <tr key={c.contest_id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-5">
                      <span className="font-semibold text-slate-200">{c.title}</span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono border ${c.status === 'FINISHED' ? 'text-slate-400 border-white/10' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{c.contest_format}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold tabular-nums text-emerald-400">{c.solved}</td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-400">{c.submissions}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-white">{c.total}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {c.rank ? (
                        <span className="font-bold text-[#ff6600]">#{c.rank}<span className="text-slate-500 font-normal">/{c.entrants}</span></span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. Bài nộp gần nhất + filter verdict */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#23252a] flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Bài nộp gần nhất</h2>
          <div className="flex items-center gap-1.5">
            {['ALL', 'AC', 'WA', 'TLE', 'RTE', 'CE'].map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60 ${filter === v ? 'bg-[#ff6600] border-[#ff6600] text-black' : 'border-white/10 text-slate-400 hover:text-white'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-6 text-xs text-slate-500">
            {filter === 'ALL' ? 'Chưa có bài nộp nào.' : `Không có bài nộp verdict ${filter}.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="bg-[#141516] border-b border-[#23252a] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-5">Giờ nộp</th>
                  <th className="py-3 px-4">Bài</th>
                  <th className="py-3 px-4">Ngôn ngữ</th>
                  <th className="py-3 px-4">Verdict</th>
                  <th className="py-3 px-4 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((s) => (
                  <tr key={s.id || `${s.problem_id}-${s.submitted_at}`} className="hover:bg-white/5 transition">
                    <td className="py-3 px-5 font-mono text-slate-300">{formatTime(s.submitted_at || s.created_at)}</td>
                    <td className="py-3 px-4 font-mono text-slate-200">
                      {s.problem_code ? `${s.problem_code} — ${s.problem_title || ''}` : (s.problem_id || '—')}
                      {upsolveBadge(s)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{s.language || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={verdictBadge(s.verdict)}>{String(s.verdict || '—')}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">{s.time_ms != null ? `${s.time_ms} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
