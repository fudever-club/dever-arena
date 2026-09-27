import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useContest } from '../context/ContestContext';
import { api, getToken } from '../lib/apiClient';

// Thang màu rank 7 bậc — copy từ Navbar (cyan chỉ dùng cho màu rank).
const getRankBadgeColor = (role, rating) => {
  if (role === 'ADMIN') return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (rating >= 2400) return 'text-red-500 bg-red-500/10 border-red-500/30';
  if (rating >= 2200) return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
  if (rating >= 1900) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
  if (rating >= 1600) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  if (rating >= 1400) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
  if (rating >= 1200) return 'text-green-400 bg-green-500/10 border-green-500/30';
  return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
};

const getTierName = (role, rating) => {
  if (role === 'ADMIN') return 'Giám Khảo';
  if (rating >= 2400) return 'Grandmaster';
  if (rating >= 2200) return 'Master';
  if (rating >= 1900) return 'Candidate Master';
  if (rating >= 1600) return 'Expert';
  if (rating >= 1400) return 'Specialist';
  if (rating >= 1200) return 'Pupil';
  return 'Newbie';
};

const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};

const verdictBadge = (verdict) => {
  const v = String(verdict || '—').toUpperCase();
  if (v === 'AC' || v === 'ACCEPTED') {
    return 'px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold';
  }
  if (v === 'WA' || v === 'TLE' || v === 'RE' || v === 'MLE' || v === 'HACKED' || v === 'FST') {
    return 'px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 font-mono font-bold';
  }
  return 'px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-mono font-bold';
};

export const ProfilePage = () => {
  const { user } = useAuth();
  const { contestId, contestSlug } = useContest();

  const rating = Number(user?.rating ?? 0);
  const maxRating = Number(user?.max_rating ?? user?.maxRating ?? rating);
  const team = user?.team || user?.clan || 'Chưa có đội';
  const tierName = getTierName(user?.role, rating);

  const [standing, setStanding] = useState(null);
  const [standingNote, setStandingNote] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [subsNote, setSubsNote] = useState('');

  // Stats contest hiện tại: hàng standings của chính user qua api.getStandings(slug).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getToken() || !contestSlug) {
          if (!cancelled) setStandingNote('Chưa kết nối backend — hiển thị 0 cho số liệu contest.');
          return;
        }
        const data = await api.getStandings(contestSlug);
        const rows = Array.isArray(data?.standings) ? data.standings : [];
        const row = rows.find((r) => r.user_id === user?.id || r.username === user?.username) || null;
        if (!cancelled) {
          setStanding(row);
          setStandingNote(row ? '' : 'Chưa có dữ liệu standings cho tài khoản này.');
        }
      } catch {
        if (!cancelled) setStandingNote('Không tải được standings (offline/demo).');
      }
    })();
    return () => { cancelled = true; };
  }, [contestSlug, user?.id, user?.username]);

  // Bài nộp gần nhất: api.listSubmissions(contestId) lọc theo user, tối đa 10.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getToken() || !contestId) {
          if (!cancelled) setSubsNote('Cần đăng nhập backend để xem bài nộp.');
          return;
        }
        const data = await api.listSubmissions(contestId);
        const rows = Array.isArray(data?.submissions) ? data.submissions : [];
        const mine = rows.filter((s) => s.user_id === user?.id || s.username === user?.username);
        if (!cancelled) {
          setSubmissions(mine.slice(0, 10));
          setSubsNote(mine.length === 0 ? 'Chưa có bài nộp nào trong contest hiện tại.' : '');
        }
      } catch {
        if (!cancelled) {
          setSubmissions([]);
          setSubsNote('Không tải được bài nộp (offline/demo).');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [contestId, user?.id, user?.username]);

  const solvedCount = standing
    ? Object.values(standing.problems || {}).filter((p) => p?.status === 'AC').length
    : 0;
  const totalPoints = standing ? Number(standing.total ?? 0) : 0;

  const history = Array.isArray(user?.rating_history) ? user.rating_history : [];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      {/* 1. Header: username / team / rank tier */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user?.username || 'avatar'}
              className="w-14 h-14 rounded-full border border-[#23252a] bg-[#141516] object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full border border-[#23252a] bg-[#141516] flex items-center justify-center text-lg font-bold text-slate-300">
              {(user?.username || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-white tracking-tight truncate">
                {user?.username || '—'}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getRankBadgeColor(user?.role, rating)}`}>
                {tierName} • {rating} Elo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {user?.name || user?.full_name || user?.username || '—'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Đội: {team}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Stats: rating hiện tại/max + AC + tổng điểm contest hiện tại */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-4">
          <div className="text-[11px] text-slate-500 font-medium">Rating hiện tại</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">{rating}</div>
        </div>
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-4">
          <div className="text-[11px] text-slate-500 font-medium">Max rating</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">{maxRating}</div>
        </div>
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-4">
          <div className="text-[11px] text-slate-500 font-medium">Số bài đã AC</div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">{solvedCount}</div>
        </div>
        <div className="rounded-xl bg-[#0f1011] border border-[#23252a] p-4">
          <div className="text-[11px] text-slate-500 font-medium">Tổng điểm</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">{totalPoints}</div>
        </div>
      </div>
      {standingNote && (
        <p className="text-[11px] text-slate-500 font-mono">{standingNote}</p>
      )}

      {/* 3. Lịch sử rating */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#23252a]">
          <h2 className="text-sm font-semibold text-white">Lịch sử rating</h2>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-6 text-xs text-slate-500">Chưa có lịch sử rated</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[520px]">
              <thead className="bg-[#141516] border-b border-[#23252a] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-5">Thời gian</th>
                  <th className="py-3 px-4">Kỳ thi</th>
                  <th className="py-3 px-4 text-right">Rating</th>
                  <th className="py-3 px-4 text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((e, idx) => {
                  const at = e?.at || e?.time || e?.created_at || e?.date || '';
                  const label = e?.contest_id || e?.contest || e?.contestId || e?.title || '—';
                  const value = e?.new ?? e?.newRating ?? e?.rating ?? e?.value ?? '—';
                  const delta = Number(e?.delta ?? e?.change ?? 0);
                  return (
                    <tr key={e?.contest_id ? `${e.contest_id}-${idx}` : idx} className="hover:bg-white/5 transition">
                      <td className="py-3 px-5 font-mono text-slate-300">{formatTime(at)}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{String(label)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{value}</td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {delta > 0 ? `+${delta}` : `${delta}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Bài nộp gần nhất (tối đa 10): giờ / verdict / điểm */}
      <div className="rounded-xl bg-[#0f1011] border border-[#23252a] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#23252a]">
          <h2 className="text-sm font-semibold text-white">Bài nộp gần nhất</h2>
        </div>
        {submissions.length === 0 ? (
          <p className="px-5 py-6 text-xs text-slate-500">{subsNote || 'Chưa có bài nộp nào.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="bg-[#141516] border-b border-[#23252a] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-5">Giờ nộp</th>
                  <th className="py-3 px-4">Bài</th>
                  <th className="py-3 px-4">Verdict</th>
                  <th className="py-3 px-4 text-right">Điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {submissions.map((s) => (
                  <tr key={s.id || `${s.problem_id}-${s.submitted_at}`} className="hover:bg-white/5 transition">
                    <td className="py-3 px-5 font-mono text-slate-300">{formatTime(s.submitted_at || s.created_at)}</td>
                    <td className="py-3 px-4 font-mono text-slate-200">{s.problem_code || s.problem_id || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={verdictBadge(s.verdict)}>{String(s.verdict || '—')}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {Number(s.points_awarded ?? s.points ?? 0)}
                    </td>
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
