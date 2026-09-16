import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useContest } from '../context/ContestContext';
import { Shield, Zap, AlertOctagon, Terminal, CheckCircle, RefreshCw, Lock } from 'lucide-react';

export const AdminDashboard = () => {
  const { user, isAdmin, loginWithPreset } = useAuth();
  const { phase, changePhase, formattedTime } = useContest();

  const [astSimilarity, setAstSimilarity] = useState(92);
  const [selectedPair, setSelectedPair] = useState('c1');
  const [isFrozen, setIsFrozen] = useState(false);

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center bg-[#0b0f19] p-4 text-center">
        <div className="max-w-md p-8 rounded-2xl bg-slate-900 border border-red-500/30 shadow-2xl space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Yêu Cầu Quyền Admin</h2>
          <p className="text-xs text-slate-400">
            Khu vực này chỉ dành cho Ban Tổ Chức & Ban Giám Khảo CLB FU-DEVER để điều khiển Phase kỳ thi, quét gian lận AST và quản lý Polygon.
          </p>
          <div className="pt-2">
            <button
              onClick={() => loginWithPreset('ADMIN')}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-lg shadow-red-500/20"
            >
              👑 Chuyển Sang Vai Trò Admin (1-Click)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#0b0f19] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
              Admin Portal
            </span>
            <span className="text-xs text-slate-400 font-mono">Contest: DEVER Round #1</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            👑 Ban Giám Khảo — Admin Command Center
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 ${
              isFrozen
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            ❄️ {isFrozen ? 'Bảng Điểm Đang Freeze' : 'Đóng Băng Bảng Điểm (Freeze)'}
          </button>
        </div>
      </div>

      {/* Phase Controller Module */}
      <div className="p-6 rounded-xl bg-slate-900 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">1. Điều Khiển Tiến Trình Vòng Thi (Phase Orchestrator)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Chuyển đổi trạng thái kỳ thi lập tức phát sóng đến toàn bộ thí sinh qua kênh BroadcastChannel
            </p>
          </div>
          <span className="px-3 py-1 rounded bg-[#ff6600]/10 text-[#ff6600] border border-[#ff6600]/30 font-bold text-xs">
            Pha hiện tại: {phase}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div className={`p-4 rounded-lg border transition ${phase === 'CODING' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/5 border-white/10'}`}>
            <h4 className="text-xs font-bold text-emerald-400 mb-1">1. Coding Phase (120')</h4>
            <p className="text-[11px] text-slate-400 mb-3">Mở nộp bài, chấm Pretests, khóa xem code đối thủ.</p>
            <button
              onClick={() => changePhase('CODING')}
              className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
            >
              Kích Hoạt CODING
            </button>
          </div>

          <div className={`p-4 rounded-lg border transition ${phase === 'HACK_PHASE' ? 'bg-orange-500/10 border-orange-500/40' : 'bg-white/5 border-white/10'}`}>
            <h4 className="text-xs font-bold text-[#ff6600] mb-1">2. Hack Phase (15')</h4>
            <p className="text-[11px] text-slate-400 mb-3">Mở code trong Room 25 người, cho phép bẻ khóa.</p>
            <button
              onClick={() => changePhase('HACK_PHASE')}
              className="w-full py-1.5 rounded bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition"
            >
              Kích Hoạt HACK
            </button>
          </div>

          <div className={`p-4 rounded-lg border transition ${phase === 'SYSTEM_TESTING' ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-white/5 border-white/10'}`}>
            <h4 className="text-xs font-bold text-yellow-400 mb-1">3. System Testing</h4>
            <p className="text-[11px] text-slate-400 mb-3">Chạy 45 test ẩn, chốt điểm chung cuộc.</p>
            <button
              onClick={() => changePhase('SYSTEM_TESTING')}
              className="w-full py-1.5 rounded bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-xs transition"
            >
              Chạy System Test
            </button>
          </div>

          <div className={`p-4 rounded-lg border transition ${phase === 'FINISHED' ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-white/5 border-white/10'}`}>
            <h4 className="text-xs font-bold text-[#00f0ff] mb-1">4. Finished (Rating)</h4>
            <p className="text-[11px] text-slate-400 mb-3">Đóng giải, tính toán cập nhật Elo 7 bậc.</p>
            <button
              onClick={() => changePhase('FINISHED')}
              className="w-full py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
            >
              Chốt Điểm & Tính Elo
            </button>
          </div>
        </div>
      </div>

      {/* AST Anti-Cheat Radar Module */}
      <div className="p-6 rounded-xl bg-slate-900 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">2. AST Anti-Cheat Radar (Phát Hiện Gian Lận Mã Nguồn)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Thuật toán Winnowing 3-gram chuẩn hóa AST, khử đổi tên biến và comment
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20">
            Similarity: {astSimilarity}% (CẢNH BÁO CAO)
          </span>
        </div>

        <div className="p-4 rounded-lg bg-black/40 border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-200 block">
              Phát hiện cặp bài trùng khớp: <span className="text-red-400 font-mono">u_cheater_x</span> vs <span className="text-red-400 font-mono">u_cheater_y</span> (Bài B)
            </span>
            <span className="text-[11px] text-slate-500">
              Hai bài nộp dùng cùng giải thuật O(N) nhưng đã đổi tên 14 biến và xóa comment.
            </span>
          </div>
          <button
            onClick={() => alert('Đã truất quyền thi đấu của thí sinh vi phạm và hủy kết quả tính Elo!')}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shrink-0"
          >
            ⛔ Truất Quyền Thi Đấu (Disqualify)
          </button>
        </div>
      </div>

    </div>
  );
};
