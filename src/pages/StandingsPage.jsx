import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useContest } from '../context/ContestContext';
import { sound } from '../engine/sound.js';
import { 
  Trophy, Search, Filter, Play, SkipForward, RotateCcw, 
  Sparkles, Award, ArrowUp, ArrowDown, HelpCircle, Check, X 
} from 'lucide-react';

const INITIAL_STANDINGS = [
  {
    id: 'u1',
    rank: 1,
    username: 'dever_hero',
    name: 'Nguyễn Anh Tuấn',
    clan: 'House of Buggy (K19)',
    rating: 1742,
    role: 'PARTICIPANT',
    hackScore: 100,
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
    clan: 'Cyber Warriors (K20)',
    rating: 1680,
    role: 'PARTICIPANT',
    hackScore: -50,
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
    clan: 'AI & Data Lab (K21)',
    rating: 1540,
    role: 'PARTICIPANT',
    hackScore: 0,
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
    clan: 'House of Buggy (K19)',
    rating: 1490,
    role: 'PARTICIPANT',
    hackScore: 100,
    problems: {
      A: { points: 440, status: 'AC', attempts: 2 },
      B: { points: 0, status: 'HACKED', attempts: 1 }, // Hacked by dever_hero
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
    clan: 'AI & Data Lab (K21)',
    rating: 1180,
    role: 'PARTICIPANT',
    hackScore: 0,
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
  const { phase } = useContest();

  const [standings, setStandings] = useState(INITIAL_STANDINGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClan, setSelectedClan] = useState('ALL');
  const [isFrozenMode, setIsFrozenMode] = useState(true);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [unfreezeMessage, setUnfreezeMessage] = useState('');
  const autoPlayTimerRef = useRef(null);

  // Helper to compute total points
  const calculateTotal = (participant) => {
    let sum = participant.hackScore || 0;
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
      setUnfreezeMessage('🎉 Đã giải mã thành công 100% bảng điểm! Vòng thi kết thúc.');
      setIsAutoPlaying(false);
      clearInterval(autoPlayTimerRef.current);
      sound.playAccepted();
      return;
    }

    // Simulate verdict: 70% AC, 30% WA
    const isAC = Math.random() > 0.3;
    const earnedPoints = isAC ? 1250 : 0;
    const newStatus = isAC ? 'AC' : 'WA';

    // Play unfreeze sound effect
    sound.playUnfreezeStep();

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
    setUnfreezeMessage(`🔍 Giải mã Bài ${targetProbKey} của [${targetCoder.username}]: ${resultText}!`);
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

  const filteredStandings = standings.filter((coder) => {
    const matchesName = coder.username.toLowerCase().includes(searchTerm.toLowerCase()) || coder.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClan = selectedClan === 'ALL' || coder.clan === selectedClan;
    return matchesName && matchesClan;
  });

  const getProblemBadge = (prob) => {
    if (prob.status === 'AC') {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold">
          +{prob.points}
        </span>
      );
    }
    if (prob.status === 'FROZEN') {
      return (
        <span className="px-2 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-mono font-bold animate-pulse inline-flex items-center gap-1">
          <HelpCircle className="w-3 h-3" /> ? ({prob.attempts})
        </span>
      );
    }
    if (prob.status === 'HACKED') {
      return (
        <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-slate-500 line-through font-mono">
          Bị Hack
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
    <div className="min-h-[calc(100vh-3rem)] bg-[#0b0f19] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-[#ff6600] border border-orange-500/30">
              Live Standings
            </span>
            <span className="text-xs text-slate-400">DEVER Round #1 (Div. 3)</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#ff6600]" />
            Bảng Xếp Hạng Kỳ Thi
          </h1>
        </div>

        {/* ICPC Dramatic Unfreeze Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0c101d] p-2 rounded-xl border border-white/10">
          <button
            onClick={handleToggleAutoPlay}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              isAutoPlaying
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            {isAutoPlaying ? 'Tạm Dừng' : '▶ Chạy Giải Mã Tự Động'}
          </button>

          <button
            onClick={stepUnfreeze}
            disabled={isAutoPlaying}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <SkipForward className="w-3.5 h-3.5 text-[#00f0ff]" />
            Lật Từng Bước
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="Đặt lại bảng ban đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Unfreeze Live Ticker Alert */}
      {unfreezeMessage && (
        <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-[#ff6600] shrink-0" />
          <span>{unfreezeMessage}</span>
        </div>
      )}

      {/* 2. Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc handle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-[#ff6600] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedClan}
            onChange={(e) => setSelectedClan(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 outline-none focus:border-[#ff6600]"
          >
            <option value="ALL">Tất cả Bang Hội (Clans)</option>
            <option value="House of Buggy (K19)">House of Buggy (K19)</option>
            <option value="Cyber Warriors (K20)">Cyber Warriors (K20)</option>
            <option value="AI & Data Lab (K21)">AI & Data Lab (K21)</option>
          </select>
        </div>
      </div>

      {/* 3. Standings Table */}
      <div className="bg-[#0e1424] border border-white/10 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0c101c] border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-3 w-12 text-center">#</th>
              <th className="py-3 px-4">Thí Sinh</th>
              <th className="py-3 px-3 w-28 text-right">Tổng Điểm</th>
              <th className="py-3 px-3 w-20 text-center">Hack</th>
              <th className="py-3 px-3 text-center">Bài A</th>
              <th className="py-3 px-3 text-center">Bài B</th>
              <th className="py-3 px-3 text-center">Bài C</th>
              <th className="py-3 px-3 text-center">Bài D</th>
              <th className="py-3 px-3 text-center">Bài E</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredStandings.map((coder) => {
              const total = calculateTotal(coder);
              const isCurrentUser = coder.username === user.username;
              return (
                <tr 
                  key={coder.id}
                  className={`transition ${isCurrentUser ? 'bg-orange-500/10 hover:bg-orange-500/15' : 'hover:bg-white/5'}`}
                >
                  <td className="py-3.5 px-3 text-center font-bold font-mono text-sm">
                    {coder.rank === 1 ? '🥇 1' : coder.rank === 2 ? '🥈 2' : coder.rank === 3 ? '🥉 3' : coder.rank}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm hover:underline cursor-pointer">
                        {coder.username}
                      </span>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-[#ff6600] font-bold text-[10px]">
                          Bạn
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">{coder.clan}</span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-extrabold text-sm text-orange-400">
                    {total}đ
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-bold">
                    {coder.hackScore > 0 ? (
                      <span className="text-emerald-400">+{coder.hackScore}</span>
                    ) : coder.hackScore < 0 ? (
                      <span className="text-red-400">{coder.hackScore}</span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-center">{getProblemBadge(coder.problems.A)}</td>
                  <td className="py-3.5 px-3 text-center">{getProblemBadge(coder.problems.B)}</td>
                  <td className="py-3.5 px-3 text-center">{getProblemBadge(coder.problems.C)}</td>
                  <td className="py-3.5 px-3 text-center">{getProblemBadge(coder.problems.D)}</td>
                  <td className="py-3.5 px-3 text-center">{getProblemBadge(coder.problems.E)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};
