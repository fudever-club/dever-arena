import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useContest } from '../context/ContestContext';
import { Trophy, Clock, Code, Award, ChevronRight, Zap, CheckCircle2 } from 'lucide-react';

export const ContestHub = () => {
  const { user } = useAuth();
  const { phase, formattedTime, getDynamicScore, problems = [] } = useContest();
  const navigate = useNavigate();

  const getDifficultyColor = (rating) => {
    if (rating <= 800) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (rating <= 1200) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (rating <= 1600) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#0b0f19] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      
      {/* Contest Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-[#10172a] to-slate-900 border border-white/10 p-6 lg:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-[#ff6600] border border-orange-500/30">
                Div. 3 & Div. 4 Rated
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {phase}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              DEVER Round #1 (Div. 3) — Đấu Trường Thuật Toán
            </h1>

            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-xl">
              2 giờ 15 phút thi đấu chuẩn Codeforces: 120 phút Coding, 15 phút Bẻ khóa Hack Room, và chốt điểm qua 45 System Tests.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-white/10 shrink-0">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-medium block">Thời gian còn lại</span>
              <span className="font-mono text-2xl font-black text-orange-400 tracking-wider">
                {formattedTime}
              </span>
            </div>
            <div className="h-8 border-r border-white/10"></div>
            <Link
              to="/problem/p102"
              className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] font-bold text-xs text-white transition flex items-center gap-1.5 shadow-md shadow-orange-500/20"
            >
              Vào Workspace
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Problems Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Danh Sách Bài Tập Của Vòng Thi</h2>
            <p className="text-xs text-slate-400">Nhấn vào bài bất kỳ để mở không gian làm bài LeetCode 3 phân vùng</p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded border border-white/10">
            {problems.length} Bài Tập • Tổng {problems.reduce((sum, p) => sum + (p.rating || 1000), 0)}đ
          </span>
        </div>

        <div className="bg-[#0e1424] border border-white/10 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0c101c] border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-16">Mã</th>
                <th className="py-3 px-4">Tên Bài Toán</th>
                <th className="py-3 px-4 w-28">Độ Khó</th>
                <th className="py-3 px-4 w-32">Điểm Tối Đa</th>
                <th className="py-3 px-4 w-32">Điểm Hiện Tại</th>
                <th className="py-3 px-4 w-28 text-center">Đã Giải</th>
                <th className="py-3 px-4 w-28 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {problems.map((prob) => {
                const dynamicScore = getDynamicScore(prob.rating || 1000);
                return (
                  <tr 
                    key={prob.id}
                    onClick={() => navigate(`/problem/${prob.id}`)}
                    className="hover:bg-white/5 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-black text-white text-sm group-hover:text-[#ff6600]">
                      {prob.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-200 group-hover:text-white text-sm">
                        {prob.title}
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {prob.tags?.map((t) => (
                          <span key={t} className="text-[10px] text-slate-500 font-mono">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getDifficultyColor(prob.rating)}`}>
                        {prob.rating} Elo
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">
                      {prob.rating || 1000}đ
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-orange-400">
                      +{dynamicScore}đ
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {prob.solvedCount || 0}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/problem/${prob.id}`);
                        }}
                        className="px-3 py-1 rounded bg-white/5 hover:bg-[#ff6600] text-slate-300 hover:text-white font-semibold text-[11px] transition border border-white/10 hover:border-[#ff6600]"
                      >
                        Làm Bài →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
