import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useContest } from '../context/ContestContext';
import { api, getToken } from '../lib/apiClient';
import { Link } from 'react-router-dom';

const INITIAL_STANDINGS = [
  {
    id: 'u1',
    rank: 1,
    username: 'dever_hero',
    name: 'Nguyễn Anh Tuấn',
    team: null,
    rating: 1742,
    role: 'PARTICIPANT',
    problems: {
      A: { points: 480, status: 'AC', attempts: 1 },
      B: { points: 940, status: 'AC', attempts: 1 },
      C: { points: 1420, status: 'AC', attempts: 1 },
      D: { points: 0, status: 'FROZEN', attempts: 2 }, // Pending reveal
      E: { points: 0, status: 'UNATTEMPTED', attempts: 0 }
    }
  },
  {
    id: 'u2',
    rank: 2,
    username: 'hacker_pro',
    name: 'Lê Hoàng Nam',
    team: null,
    rating: 1680,
    role: 'PARTICIPANT',
    problems: {
      A: { points: 460, status: 'AC', attempts: 1 },
      B: { points: 910, status: 'AC', attempts: 2 },
      C: { points: 0, status: 'FROZEN', attempts: 3 }, // Pending reveal
      D: { points: 0, status: 'WA', attempts: 2 },
      E: { points: 0, status: 'UNATTEMPTED', attempts: 0 }
    }
  },
  {
    id: 'u3',
    rank: 3,
    username: 'alice_ninja',
    name: 'Trần Thị Mai',
    team: null,
    rating: 1540,
    role: 'PARTICIPANT',
    problems: {
      A: { points: 490, status: 'AC', attempts: 1 },
      B: { points: 0, status: 'FROZEN', attempts: 1 }, // Pending reveal
      C: { points: 0, status: 'UNATTEMPTED', attempts: 0 },
      D: { points: 0, status: 'UNATTEMPTED', attempts: 0 },
      E: { points: 0, status: 'UNATTEMPTED', attempts: 0 }
    }
  },
  {
    id: 'u4',
    rank: 4,
    username: 'buggy_coder',
    name: 'Phạm Quốc Bảo',
    team: null,
    rating: 1490,
    role: 'PARTICIPANT',
    problems: {
      A: { points: 440, status: 'AC', attempts: 2 },
      B: { points: 0, status: 'WA', attempts: 1 },
      C: { points: 0, status: 'UNATTEMPTED', attempts: 0 },
      D: { points: 0, status: 'UNATTEMPTED', attempts: 0 },
      E: { points: 0, status: 'UNATTEMPTED', attempts: 0 }
    }
  },
  {
    id: 'u5',
    rank: 5,
    username: 'newbie_fpt',
    name: 'Đặng Minh Khôi',
    team: null,
    rating: 1180,
    role: 'PARTICIPANT',
    problems: {
      A: { points: 0, status: 'FROZEN', attempts: 4 }, // Pending reveal
      B: { points: 0, status: 'WA', attempts: 3 },
      C: { points: 0, status: 'UNATTEMPTED', attempts: 0 },
      D: { points: 0, status: 'UNATTEMPTED', attempts: 0 },
      E: { points: 0, status: 'UNATTEMPTED', attempts: 0 }
    }
  }
];

export const StandingsPage = () => {
  const { user } = useAuth();
  const { frozen, activeContest } = useContest();

  const [standings, setStandings] = useState(INITIAL_STANDINGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [unfreezeMessage, setUnfreezeMessage] = useState('');
  const [dataSource, setDataSource] = useState('demo'); // demo | live
  const [refreshIn, setRefreshIn] = useState(30);
  const autoPlayTimerRef = useRef(null);
  const FRIENDS_KEY = 'dever_friends';
  const [friends, setFriends] = useState(() => {
    try {
      const raw = localStorage.getItem(FRIENDS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch { return []; }
  });
  const [friendsOnly, setFriendsOnly] = useState(false);

  const toggleFriend = (username) => {
    setFriends((prev) => {
      const next = prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username];
      try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(next)); } catch { /* quota riêng tư: giữ state ram */ }
      return next;
    });
  };

  // Màu rank 7 bậc Codeforces (đồng bộ Navbar)
  const rankColor = (rating) => {
    if (rating >= 2400) return 'text-red-500';
    if (rating >= 2200) return 'text-orange-500';
    if (rating >= 1900) return 'text-purple-400';
    if (rating >= 1600) return 'text-blue-400';
    if (rating >= 1400) return 'text-cyan-400';
    if (rating >= 1200) return 'text-green-400';
    return 'text-gray-400';
  };

  const mapBackendRow = (r) => ({
    id: r.user_id,
    rank: r.rank,
    username: r.username,
    name: r.username,
    team: r.team || null,
    rating: r.rating,
    role: 'PARTICIPANT',
    problems: r.problems || {},
    solved: r.solved ?? null,
    penalty: r.penalty ?? null,
  });

  const fetchBoard = async () => {
    try {
      // Kỳ thi THẬT đang active từ context (CODING → REGISTRATION → FINISHED) — hết slug demo cứng
      // (bug 9, Vòng 37.4: slug cũ 404 sau khi dọn prod → trang rơi về demo local với user ma).
      const slug = activeContest?.slug;
      if (!slug) return null;
      const data = await api.getStandings(slug, frozen ? { frozen: 1 } : {});
      if (!data?.standings?.length) return null;
      setStandings(data.standings.map(mapBackendRow));
      setBoardFormat(data.format || 'CODEFORCES');
      setDataSource(getToken() ? 'live' : 'backend');
      return data;
    } catch { return null; }
  };

  // Backend thật: standings + SSE live; rớt mạng → giữ demo local.
  // Khi admin bật đóng băng, tải bản frozen từ máy chủ.
  const [boardFormat, setBoardFormat] = useState('CODEFORCES');
  useEffect(() => {
    let es = null;
    let cancelled = false;
    (async () => {
      const data = await fetchBoard();
      if (cancelled) return;
      if (data && getToken() && typeof EventSource !== 'undefined' && !frozen) {
        try {
          es = api.streamContest(data.contest_id, (ev, payload) => {
            if (ev === 'EVENT_STANDINGS_UPDATE' && payload?.standings) {
              setStandings(payload.standings.map(mapBackendRow));
              setDataSource('live');
            }
          });
          es.onerror = () => { try { es.close(); } catch {} };
        } catch { /* giữ polling */ }
      }
    })();
    return () => { cancelled = true; try { es?.close(); } catch {} };
  }, [frozen, activeContest?.slug]);

  // Tự làm mới 30s (tạm dừng khi đóng băng để giữ bảng freeze)
  useEffect(() => {
    if (frozen) return;
    setRefreshIn(30);
    const t = setInterval(() => {
      setRefreshIn((v) => {
        if (v <= 1) { fetchBoard(); return 30; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [frozen]);

  // Helper to compute total points
  const calculateTotal = (participant) => {
    let sum = 0;
    Object.values(participant.problems).forEach((p) => {
      if (p.status === 'AC') sum += p.points;
    });
    return sum;
  };

  // Check if any frozen problem remains
  const hasRemainingFrozen = () => {
    return standings.some((coder) => 
      Object.values(coder.problems).some((p) => p.status === 'FROZEN')
    );
  };

  // Step unfreeze logic: Pick lowest rank with 'FROZEN' problem
  const stepUnfreeze = () => {
    // Find bottom-most candidate with frozen problem
    const sorted = [...standings].sort((a, b) => b.rank - a.rank);
    let targetCoder = null;
    let targetProbKey = null;

    for (const coder of sorted) {
      for (const [probKey, probData] of Object.entries(coder.problems)) {
        if (probData.status === 'FROZEN') {
          targetCoder = coder;
          targetProbKey = probKey;
          break;
        }
      }
      if (targetCoder) break;
    }

    if (!targetCoder) {
      setUnfreezeMessage('Đã giải mã thành công 100% bảng điểm! Vòng thi kết thúc.');
      setIsAutoPlaying(false);
      clearInterval(autoPlayTimerRef.current);
      return;
    }

    // Simulate verdict: 70% AC, 30% WA
    const isAC = Math.random() > 0.3;
    const earnedPoints = isAC ? 1250 : 0;
    const newStatus = isAC ? 'AC' : 'WA';

    const updated = standings.map((coder) => {
      if (coder.id === targetCoder.id) {
        const nextProblems = {
          ...coder.problems,
          [targetProbKey]: {
            ...coder.problems[targetProbKey],
            status: newStatus,
            points: earnedPoints
          }
        };
        return {
          ...coder,
          problems: nextProblems
        };
      }
      return coder;
    });

    // Re-rank
    updated.sort((a, b) => calculateTotal(b) - calculateTotal(a));
    const reRanked = updated.map((coder, idx) => ({ ...coder, rank: idx + 1 }));

    setStandings(reRanked);
    const resultText = isAC ? `ACCEPTED (+${earnedPoints}đ)` : 'WRONG ANSWER';
    setUnfreezeMessage(`Giải mã Bài ${targetProbKey} của [${targetCoder.username}]: ${resultText}!`);
  };

  // Handle Auto-Play
  const handleToggleAutoPlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      clearInterval(autoPlayTimerRef.current);
    } else {
      setIsAutoPlaying(true);
      autoPlayTimerRef.current = setInterval(() => {
        stepUnfreeze();
      }, 2200);
    }
  };

  useEffect(() => {
    return () => clearInterval(autoPlayTimerRef.current);
  }, []);

  const handleReset = () => {
    setIsAutoPlaying(false);
    clearInterval(autoPlayTimerRef.current);
    setStandings(INITIAL_STANDINGS);
    setUnfreezeMessage('');
  };

  // Cột bài thi suy ra từ dữ liệu (mặc định A–E cho demo)
  const problemCodes = [...new Set(standings.flatMap((r) => Object.keys(r.problems || {})))].sort();
  if (problemCodes.length === 0) problemCodes.push('A', 'B', 'C', 'D', 'E');

  const filteredStandings = standings.filter((coder) => {
    const matchesName = coder.username.toLowerCase().includes(searchTerm.toLowerCase()) || coder.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFriend = !friendsOnly || friends.includes(coder.username);
    return matchesName && matchesFriend;
  });
  const pageCount = Math.max(1, Math.ceil(filteredStandings.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedStandings = filteredStandings.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const solvedCountOf = (coder) => Object.values(coder.problems || {}).filter((p) => p.status === 'AC').length;

  // First-blood mỗi cột bài: minute AC nhỏ nhất (guard khi thiếu minute).
  const firstBloodMinuteByProblem = {};
  problemCodes.forEach((code) => {
    let best = null;
    standings.forEach((coder) => {
      const p = (coder.problems || {})[code];
      if (p && p.status === 'AC' && p.minute != null && Number.isFinite(Number(p.minute))) {
        const m = Number(p.minute);
        if (best === null || m < best) best = m;
      }
    });
    if (best !== null) firstBloodMinuteByProblem[code] = best;
  });

  const escapeCsvCell = (value) => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const problemCellToCsv = (prob) => {
    if (!prob) return '';
    if (prob.status === 'AC') return String(prob.points);
    if (prob.status === 'FROZEN') return '?';
    if (prob.status === 'WA') return `-${prob.attempts ?? 0}`;
    return '';
  };

  const handleExportCsv = () => {
    const header = ['rank', 'username', 'rating', 'total', 'solved', ...problemCodes];
    const lines = [header.join(',')];
    filteredStandings.forEach((coder) => {
      const row = [
        coder.rank,
        coder.username,
        coder.rating ?? '',
        calculateTotal(coder),
        solvedCountOf(coder),
        ...problemCodes.map((code) => problemCellToCsv((coder.problems || {})[code])),
      ].map(escapeCsvCell).join(',');
      lines.push(row);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'standings.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getProblemBadge = (prob, code) => {
    if (!prob) return <span className="text-slate-600 font-mono">-</span>;
    if (prob.status === 'AC') {
      const extra = [prob.attempts > 1 ? `${prob.attempts} lần` : null, prob.minute != null ? `${prob.minute}′` : null].filter(Boolean).join(' • ');
      const isFirstBlood = code != null
        && prob.minute != null
        && Number.isFinite(Number(prob.minute))
        && firstBloodMinuteByProblem[code] != null
        && Number(prob.minute) === firstBloodMinuteByProblem[code];
      return (
        <span>
          <span
            title={isFirstBlood ? 'First blood' : undefined}
            className={isFirstBlood
              ? 'px-2 py-0.5 rounded bg-emerald-500/15 border-2 border-emerald-400 text-emerald-300 font-mono font-bold'
              : 'px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold'}
          >
            +{prob.points}
          </span>
          {extra && <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{extra}</span>}
        </span>
      );
    }
    if (prob.status === 'FROZEN') {
      return (
        <span className="px-2 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-mono font-bold">
          ? ({prob.attempts})
        </span>
      );
    }
    if (prob.status === 'WA') {
      return (
        <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 font-mono">
          -{prob.attempts}
        </span>
      );
    }
    return <span className="text-slate-600 font-mono">-</span>;
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#23252a] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-[#ff6600] border border-orange-500/30">
              Live Standings
            </span>
            <span className="text-xs text-slate-400">DEVER Round #1 (Div. 3)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${dataSource === 'demo' ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
              {dataSource === 'demo' ? 'Demo local' : dataSource === 'live' ? '● LIVE API' : 'Backend API'}
            </span>
            {frozen ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
                Đang đóng băng
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">làm mới sau {refreshIn}s</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Bảng Xếp Hạng Kỳ Thi
          </h1>
        </div>

        {/* Mô phỏng lật bảng (chỉ demo local — dữ liệu thật không bao giờ bịa verdict) */}
        {dataSource === 'demo' && (
        <div className="flex flex-wrap items-center gap-2 bg-[#0f1011] p-2 rounded-xl border border-[#23252a]">
          <button
            onClick={handleToggleAutoPlay}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              isAutoPlaying
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isAutoPlaying ? 'Tạm Dừng' : 'Chạy Giải Mã Tự Động'}
          </button>

          <button
            onClick={stepUnfreeze}
            disabled={isAutoPlaying}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition disabled:opacity-40"
          >
            Lật Từng Bước
          </button>

          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition text-xs"
            title="Đặt lại bảng ban đầu"
          >
            Đặt lại
          </button>
        </div>
        )}
      </div>

      {/* Unfreeze Live Ticker Alert */}
      {unfreezeMessage && (
        <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-semibold animate-fadeIn">
          <span>{unfreezeMessage}</span>
        </div>
      )}

      {/* 2. Search filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc handle..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-[#ff6600] outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={friendsOnly}
              onChange={(e) => { setFriendsOnly(e.target.checked); setPage(0); }}
              className="accent-amber-500"
            />
            Chỉ bạn bè
          </label>
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 font-semibold border border-white/10 transition"
          >
            Xuất CSV
          </button>
        </div>
      </div>

      {/* 3. Standings Table */}
      <div className="bg-[#0f1011] border border-[#23252a] rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[760px]">
          <thead className="bg-[#141516] border-b border-[#23252a] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-3 w-12 text-center">#</th>
              <th className="py-3 px-4">Thí sinh</th>
              {boardFormat === 'ICPC' && dataSource !== 'demo' ? (
                <>
                  <th className="py-3 px-3 w-28 text-center">Giải được</th>
                  <th className="py-3 px-3 w-28 text-right">Penalty (phút)</th>
                </>
              ) : (
                <>
                  <th className="py-3 px-3 w-28 text-right">Tổng điểm</th>
                  <th className="py-3 px-3 w-20 text-center">Giải được</th>
                  {problemCodes.map((code) => (
                    <th key={code} className="py-3 px-3 text-center">Bài {code}</th>
                  ))}
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pagedStandings.map((coder) => {
              const total = calculateTotal(coder);
              const isCurrentUser = coder.username === user?.username;
              const isFriend = friends.includes(coder.username);
              return (
                <tr
                  key={coder.id}
                  className={`transition border-l-2 ${isCurrentUser ? 'bg-orange-500/10 hover:bg-orange-500/15' : isFriend ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-white/5'} ${isFriend ? 'border-l-amber-400/60' : 'border-l-transparent'}`}
                >
                  <td className="py-3.5 px-3 text-center font-bold font-mono text-sm">
                    {coder.rank}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFriend(coder.username)}
                        aria-label={isFriend ? `Bỏ theo dõi ${coder.username}` : `Theo dõi ${coder.username}`}
                        title={isFriend ? 'Bỏ bạn bè' : 'Thêm bạn bè'}
                        className={`text-sm leading-none transition ${isFriend ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'}`}
                      >
                        {isFriend ? '★' : '☆'}
                      </button>
                      <Link to={`/profile/${coder.username}`} className={`font-bold text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60 rounded-sm ${rankColor(coder.rating)}`}>
                        {coder.username}
                      </Link>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-[#ffb066] font-bold text-[10px]">
                          Bạn
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">{coder.team ? `Đội ${coder.team}` : coder.name}</span>
                  </td>
                  {boardFormat === 'ICPC' && dataSource !== 'demo' ? (
                    <>
                      <td className="py-3.5 px-3 text-center font-mono font-extrabold text-sm text-emerald-400">
                        {coder.solved ?? 0}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-sm text-slate-300">
                        {coder.penalty ?? 0}
                      </td>
                    </>
                  ) : (
                    <>
                  <td className="py-3.5 px-3 text-right font-mono font-extrabold text-sm text-orange-400">
                    {total}đ
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-bold text-sm text-emerald-400">
                    {solvedCountOf(coder)}
                  </td>
                  {problemCodes.map((code) => (
                    <td key={code} className="py-3.5 px-3 text-center">{getProblemBadge(coder.problems[code], code)}</td>
                  ))}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Phân trang */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">Trang {safePage + 1}/{pageCount} • {filteredStandings.length} thí sinh</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-3 py-1.5 rounded-lg bg-[#141516] border border-[#23252a] hover:bg-[#18191a] disabled:opacity-40"
            >
              ← Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="px-3 py-1.5 rounded-lg bg-[#141516] border border-[#23252a] hover:bg-[#18191a] disabled:opacity-40"
            >
              Sau →
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
