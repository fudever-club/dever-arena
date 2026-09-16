import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useContest } from '../../context/ContestContext';
import { MathRenderer } from '../common/MathRenderer';
import { 
  Shield, Activity, FileCode, Users, Terminal, LogOut, 
  ExternalLink, Clock, AlertTriangle, CheckCircle, ChevronRight,
  Radio, Lock, Database, Plus, Trash2, Edit3, Save, X, RotateCcw, 
  Eye, Sparkles, CheckCircle2, ArrowLeft
} from 'lucide-react';

export const AdminLayout = ({ children }) => {
  const { user, isAdmin, logout } = useAuth();
  const { 
    phase, formattedTime, changePhase, 
    problems = [], addProblem, updateProblem, deleteProblem, resetProblems 
  } = useContest();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('phase'); // phase | anticheat | polygon | telemetry | rooms
  const [isFrozen, setIsFrozen] = useState(false);

  // Polygon Problem Studio States
  const [polygonView, setPolygonView] = useState('list'); // 'list' | 'editor'
  const [editingId, setEditingId] = useState(null);
  const [polygonNotification, setPolygonNotification] = useState(null);

  const [formData, setFormData] = useState({
    code: 'F',
    title: '',
    rating: 1200,
    tags: 'math, data-structures',
    timeLimit: '1.0s',
    memoryLimit: '256 MB',
    statement: `Cho số nguyên $N$ ($1 \\le N \\le 10^5$). Tính giá trị:\n$$S = \\sum_{i=1}^N (i^2 + 2i)$$\nIn ra kết quả theo modulo $10^9 + 7$.`,
    sampleInput: '3',
    sampleOutput: '26',
    editorial: `### Hướng dẫn giải:\nÁp dụng công thức tổng bình phương:\n$$\\sum_{i=1}^N i^2 = \\frac{N(N+1)(2N+1)}{6}$$`
  });

  const handleOpenCreateProblem = () => {
    const nextCode = String.fromCharCode(65 + problems.length);
    setFormData({
      code: nextCode,
      title: '',
      rating: 1200,
      tags: 'math, implementation',
      timeLimit: '1.0s',
      memoryLimit: '256 MB',
      statement: `Cho dãy gồm $N$ số nguyên $A_1, A_2, \\dots, A_N$.\nTính tổng tất cả các phần tử chẵn trong dãy.`,
      sampleInput: `4\n1 2 3 4`,
      sampleOutput: `6`,
      editorial: `Duyệt tuần tự qua mảng với độ phức tạp $O(N)$.`
    });
    setEditingId(null);
    setPolygonView('editor');
  };

  const handleOpenEditProblem = (prob) => {
    setFormData({
      code: prob.code,
      title: prob.title,
      rating: prob.rating || 1000,
      tags: Array.isArray(prob.tags) ? prob.tags.join(', ') : prob.tags || '',
      timeLimit: prob.timeLimit || '1.0s',
      memoryLimit: prob.memoryLimit || '256 MB',
      statement: prob.statement || '',
      sampleInput: prob.sampleInput || '',
      sampleOutput: prob.sampleOutput || '',
      editorial: prob.editorial || ''
    });
    setEditingId(prob.id);
    setPolygonView('editor');
  };

  const handleSaveProblem = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.statement.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung đề bài!');
      return;
    }

    const tagList = formData.tags.split(',').map(s => s.trim()).filter(Boolean);

    if (editingId) {
      updateProblem({
        id: editingId,
        code: formData.code.toUpperCase(),
        title: formData.title.trim(),
        rating: Number(formData.rating) || 1000,
        tags: tagList,
        timeLimit: formData.timeLimit,
        memoryLimit: formData.memoryLimit,
        statement: formData.statement,
        sampleInput: formData.sampleInput,
        sampleOutput: formData.sampleOutput,
        editorial: formData.editorial,
        solvedCount: problems.find(p => p.id === editingId)?.solvedCount || 0
      });
      setPolygonNotification(`✓ Đã cập nhật [Bài ${formData.code}: ${formData.title}] thành công!`);
    } else {
      const newId = 'p' + (100 + problems.length + 1) + '_' + Date.now().toString(36).slice(-4);
      addProblem({
        id: newId,
        code: formData.code.toUpperCase(),
        title: formData.title.trim(),
        rating: Number(formData.rating) || 1000,
        tags: tagList,
        timeLimit: formData.timeLimit,
        memoryLimit: formData.memoryLimit,
        statement: formData.statement,
        sampleInput: formData.sampleInput,
        sampleOutput: formData.sampleOutput,
        editorial: formData.editorial,
        solvedCount: 0
      });
      setPolygonNotification(`✓ Đã xuất bản đề mới [Bài ${formData.code}: ${formData.title}] thành công vào kỳ thi!`);
    }

    setPolygonView('list');
    setTimeout(() => setPolygonNotification(null), 5000);
  };

  // Protected Route Check
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070a12] p-4 text-center">
        <div className="max-w-md p-8 rounded-2xl bg-[#0c101d] border border-red-500/30 shadow-2xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Khu Vực Hạn Chế Quản Trị</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cổng Command Center chỉ dành riêng cho Ban Tổ Chức & Ban Giám Khảo CLB FU-DEVER. Thí sinh không có quyền truy cập vào đây.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => navigate('/login?redirect=/admin')}
              className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition"
            >
              🔑 Đăng Nhập Với Tài Khoản Ban Giám Khảo
            </button>
            <button
              onClick={() => navigate('/arena')}
              className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition border border-white/10"
            >
              ← Quay Lại Đấu Trường Thí Sinh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col lg:flex-row font-sans">
      
      {/* ======================================================== */}
      {/* DEDICATED ADMIN SIDEBAR                                  */}
      {/* ======================================================== */}
      <aside className="w-full lg:w-64 bg-[#0a0e1a] border-r border-white/10 flex flex-col shrink-0 select-none">
        
        {/* Admin Header / Brand */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-[#080b15]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                DEVER<span className="text-red-500">ADMIN</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono block leading-none">Command Center</span>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
            Root
          </span>
        </div>

        {/* Contest Info Ticker */}
        <div className="p-3 bg-red-500/5 border-b border-white/5 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Vòng thi:</span>
            <span className="font-bold text-slate-200">DEVER Round #1</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Pha:</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {phase}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono">
            <span className="text-[11px] text-slate-400">Thời gian:</span>
            <span className="text-orange-400 font-bold">{formattedTime}</span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto text-xs">
          <button
            onClick={() => setActiveTab('phase')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold flex items-center gap-2.5 transition text-left ${
              activeTab === 'phase'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            1. Phase Orchestrator
          </button>

          <button
            onClick={() => setActiveTab('anticheat')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold flex items-center gap-2.5 transition text-left ${
              activeTab === 'anticheat'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4 text-red-400" />
            2. AST Anti-Cheat Radar
          </button>

          <button
            onClick={() => setActiveTab('polygon')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold flex items-center gap-2.5 transition text-left ${
              activeTab === 'polygon'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileCode className="w-4 h-4 text-[#ff6600]" />
            3. Polygon Problem Studio
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold flex items-center gap-2.5 transition text-left ${
              activeTab === 'telemetry'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4 text-[#00f0ff]" />
            4. Telemetry & Judge Queue
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold flex items-center gap-2.5 transition text-left ${
              activeTab === 'rooms'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4 text-purple-400" />
            5. Thí Sinh & Hack Rooms
          </button>
        </nav>

        {/* Sidebar Footer: Switch to Contestant View & Logout */}
        <div className="p-3 border-t border-white/10 bg-[#080b15] space-y-2 text-xs">
          {/* Switch to Contestant Mode Button */}
          <Link
            to="/arena"
            className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-medium flex items-center justify-between transition group"
          >
            <span className="flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-[#ff6600]" />
              Xem góc nhìn Thí Sinh
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
          </Link>

          {/* Admin Profile & Logout */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-7 h-7 rounded-full border border-red-500/40 bg-slate-800"
              />
              <div className="text-left leading-none">
                <span className="font-bold text-white text-xs block">{user.username}</span>
                <span className="text-[10px] text-red-400 font-mono">Giám Khảo (2450)</span>
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition"
              title="Đăng xuất khỏi Admin Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* ======================================================== */}
      {/* MAIN ADMIN WORKSPACE VIEW                                */}
      {/* ======================================================== */}
      <main className="flex-1 flex flex-col bg-[#070a12] overflow-y-auto">
        
        {/* Admin Topbar */}
        <header className="h-14 bg-[#090d18] border-b border-white/10 px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Bảng Điều Hành Ban Giám Khảo</span>
            </h1>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-600"></span>
            <span className="hidden sm:inline-block text-xs text-slate-400 font-mono">
              Worker Pool: 3/3 Active (Isolate Sandboxed)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setIsFrozen(!isFrozen)}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
                isFrozen
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              ❄️ {isFrozen ? 'Bảng Điểm Đang Freeze' : 'Đóng Băng Bảng Điểm (Freeze)'}
            </button>

            <button
              onClick={() => alert('Đã phát sóng thông báo khẩn tới toàn bộ phòng thi!')}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition flex items-center gap-1.5"
            >
              📢 Thông Báo Khẩn
            </button>
          </div>
        </header>

        {/* Tab Content Display */}
        <div className="p-6 lg:p-8 space-y-6">
          
          {/* TAB 1: PHASE ORCHESTRATOR */}
          {activeTab === 'phase' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white">Điều Khiển Tiến Trình Kỳ Thi (BroadcastChannel Sync)</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chuyển phase tức thì đến tất cả thí sinh đang mở tab làm bài mà không cần tải lại trang
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded bg-[#ff6600]/10 text-[#ff6600] border border-[#ff6600]/30 font-bold text-xs">
                    Pha hiện tại: {phase}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <div className={`p-4 rounded-xl border transition ${phase === 'CODING' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-emerald-400 mb-1">1. Coding Phase (120')</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Mở nộp bài, chấm Pretests, khóa xem code đối thủ.</p>
                    <button
                      onClick={() => changePhase('CODING')}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                    >
                      Kích Hoạt CODING
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border transition ${phase === 'HACK_PHASE' ? 'bg-orange-500/10 border-orange-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-[#ff6600] mb-1">2. Hack Phase (15')</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Mở code trong Room 25 người, cho phép bẻ khóa.</p>
                    <button
                      onClick={() => changePhase('HACK_PHASE')}
                      className="w-full py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition"
                    >
                      Kích Hoạt HACK
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border transition ${phase === 'SYSTEM_TESTING' ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-yellow-400 mb-1">3. System Testing</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Chạy 45 test ẩn, chốt điểm chung cuộc.</p>
                    <button
                      onClick={() => changePhase('SYSTEM_TESTING')}
                      className="w-full py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-xs transition"
                    >
                      Chạy System Test
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border transition ${phase === 'FINISHED' ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-[#00f0ff] mb-1">4. Finished (Rating)</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Đóng giải, tính toán cập nhật Elo 7 bậc.</p>
                    <button
                      onClick={() => changePhase('FINISHED')}
                      className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
                    >
                      Chốt Điểm & Tính Elo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AST ANTI-CHEAT */}
          {activeTab === 'anticheat' && (
            <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">AST Anti-Cheat Radar (Thuật Toán Winnowing 3-Gram)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Quét tương đồng cây cú pháp AST, loại trừ đổi tên biến, thêm khoảng trắng và comment
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20">
                  Phát hiện: 1 cặp nghi vấn &gt;85%
                </span>
              </div>

              <div className="p-4 rounded-lg bg-black/40 border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Cặp bài: <span className="text-red-400 font-mono">u_cheater_x</span> và <span className="text-red-400 font-mono">u_cheater_y</span> (Bài B: Big Product)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Mức độ tương đồng AST: <b className="text-red-400">92%</b> • Đã đổi 14 biến và xóa comment.
                  </span>
                </div>
                <button
                  onClick={() => alert('Đã truất quyền thi đấu của thí sinh vi phạm và hủy kết quả thi!')}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shrink-0"
                >
                  ⛔ Truất Quyền Thi Đấu (Disqualify)
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: POLYGON PROBLEMSETTER STUDIO */}
          {activeTab === 'polygon' && (
            <div className="space-y-6">
              
              {/* Notification Banner */}
              {polygonNotification && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{polygonNotification}</span>
                  </div>
                  <button 
                    onClick={() => setPolygonNotification(null)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Header Strip with Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#0d1222] border border-white/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ff6600]/10 text-[#ff6600] border border-[#ff6600]/30 uppercase">
                      Problemsetter Studio
                    </span>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Testlib v1.2 Active
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white">Soạn & Quản Lý Đề Bài Kỳ Thi (Polygon Engine)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Thêm đề mới với công thức toán KaTeX Live Preview, xuất bản tức thì sang Đấu Trường Thí Sinh
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {polygonView === 'editor' ? (
                    <button
                      onClick={() => setPolygonView('list')}
                      className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition border border-white/10 flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Quay Lại Danh Sách
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (window.confirm('Khôi phục danh mục về 5 bài toán mặc định ban đầu?')) {
                            resetProblems();
                            setPolygonNotification('Đã khôi phục về danh mục 5 bài mặc định.');
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-semibold text-xs transition border border-white/10 flex items-center gap-1.5"
                        title="Khôi phục danh mục 5 bài mặc định ban đầu"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Khôi Phục Mặc Định
                      </button>

                      <button
                        onClick={handleOpenCreateProblem}
                        className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
                      >
                        <Plus className="w-4 h-4" />
                        + Soạn Đề Bài Mới
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* VIEW 1: PROBLEMS TABLE */}
              {polygonView === 'list' && (
                <div className="space-y-6">
                  {/* Table */}
                  <div className="bg-[#0e1424] border border-white/10 rounded-xl overflow-hidden shadow-xl">
                    <div className="h-10 bg-[#0c101c] px-4 flex items-center justify-between border-b border-white/10 text-xs">
                      <span className="font-bold text-slate-200">
                        Danh sách {problems.length} bài toán đang trong vòng thi
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Tổng điểm: {problems.reduce((sum, p) => sum + (p.rating || 1000), 0)}đ
                      </span>
                    </div>

                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/20 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-white/5">
                        <tr>
                          <th className="py-3 px-4 w-14">Mã</th>
                          <th className="py-3 px-4">Tên Bài Toán & Phân Loại</th>
                          <th className="py-3 px-4 w-28">Độ Khó</th>
                          <th className="py-3 px-4 w-32">Giới Hạn</th>
                          <th className="py-3 px-4 w-24 text-center">Trạng Thái</th>
                          <th className="py-3 px-4 w-44 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {problems.map((prob) => (
                          <tr key={prob.id} className="hover:bg-white/5 transition">
                            <td className="py-3 px-4 font-black text-white text-sm">
                              <span className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-[#ff6600]">
                                {prob.code}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-white text-sm">
                                {prob.title}
                              </div>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {prob.tags?.map((t) => (
                                  <span key={t} className="px-1.5 py-0.2 rounded bg-white/5 text-[10px] text-slate-400 font-mono border border-white/5">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {prob.rating || 1000} Điểm
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                              <div>⏱️ {prob.timeLimit || '1.0s'}</div>
                              <div>💾 {prob.memoryLimit || '256 MB'}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Đã duyệt
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  to={`/problem/${prob.id}`}
                                  className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-[#00f0ff] transition"
                                  title="Xem giao diện Workspace"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Link>
                                <button
                                  onClick={() => handleOpenEditProblem(prob)}
                                  className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-orange-400 transition"
                                  title="Chỉnh sửa đề bài"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Xóa bài ${prob.code}: ${prob.title} khỏi vòng thi?`)) {
                                      deleteProblem(prob.id);
                                      setPolygonNotification(`Đã xóa bài ${prob.code} khỏi vòng thi.`);
                                    }
                                  }}
                                  className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                                  title="Xóa đề bài"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Testlib Quality Badge */}
                  <div className="p-4 rounded-xl bg-[#090d18] border border-white/5 text-xs text-slate-300 font-mono space-y-2">
                    <div className="text-emerald-400 font-bold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Polygon Testlib Validator Trực Tuyến:</span>
                    </div>
                    <div className="text-slate-400 text-[11px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                      <div className="p-2 rounded bg-black/40 border border-white/5">✓ Trailing Whitespace Lint</div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">✓ EOF Newline Enforcement</div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">✓ Limits & Bounds Check</div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">✓ Epsilon Float Verifier</div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: FULL PROBLEMSETTER FORM WITH LATEX LIVE PREVIEW */}
              {polygonView === 'editor' && (
                <form onSubmit={handleSaveProblem} className="space-y-6">
                  
                  {/* Basic Metadata */}
                  <div className="p-5 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                      <span>1. Thông Tin Cơ Bản Của Bài Toán</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 text-xs">
                      {/* Code */}
                      <div className="sm:col-span-1">
                        <label className="block font-semibold text-slate-300 mb-1">Mã Bài (Code):</label>
                        <input
                          type="text"
                          required
                          maxLength={3}
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-white/15 text-white font-mono font-bold text-sm text-center focus:border-[#ff6600] outline-none"
                          placeholder="F"
                        />
                      </div>

                      {/* Title */}
                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-slate-300 mb-1">Tên Bài Toán (Title):</label>
                        <input
                          type="text"
                          required
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-white/15 text-white text-xs font-semibold focus:border-[#ff6600] outline-none"
                          placeholder="Ví dụ: Da Nang Bridge Network Maximum Flow"
                        />
                      </div>

                      {/* Rating */}
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-300 mb-1">Điểm Cơ Sở / Elo Rating:</label>
                        <input
                          type="number"
                          required
                          min={500}
                          max={3500}
                          step={100}
                          value={formData.rating}
                          onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-white/15 text-[#00f0ff] font-mono font-bold text-xs focus:border-[#ff6600] outline-none"
                        />
                      </div>

                      {/* Tags */}
                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-slate-300 mb-1">Thẻ Phân Loại (Tags, cách nhau bằng dấu phẩy):</label>
                        <input
                          type="text"
                          value={formData.tags}
                          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="math, dynamic-programming, greedy"
                        />
                      </div>

                      {/* Time Limit */}
                      <div className="sm:col-span-1.5">
                        <label className="block font-semibold text-slate-300 mb-1">Giới Hạn Thời Gian:</label>
                        <input
                          type="text"
                          value={formData.timeLimit}
                          onChange={(e) => setFormData({ ...formData, timeLimit: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="1.0s"
                        />
                      </div>

                      {/* Memory Limit */}
                      <div className="sm:col-span-1.5">
                        <label className="block font-semibold text-slate-300 mb-1">Giới Hạn Bộ Nhớ:</label>
                        <input
                          type="text"
                          value={formData.memoryLimit}
                          onChange={(e) => setFormData({ ...formData, memoryLimit: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="256 MB"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Statement Editor with Live KaTeX Preview */}
                  <div className="p-5 rounded-xl bg-[#0d1222] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>2. Nội Dung Đề Bài (Hỗ Trợ LaTeX $...$ & $$...$$)</span>
                      </h3>
                      <span className="text-[11px] text-cyan-400 font-mono">
                        KaTeX Live Preview Bật
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                      {/* Left: Input Textarea */}
                      <div className="flex flex-col space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400">Mã nguồn đề bài (Markdown & LaTeX):</span>
                        <textarea
                          rows={10}
                          required
                          value={formData.statement}
                          onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                          className="w-full p-3 rounded-lg bg-[#070a12] border border-white/15 text-slate-200 font-mono text-xs leading-relaxed focus:border-[#ff6600] outline-none"
                          placeholder="Nhập mô tả đề bài... dùng $N$ cho inline math và $$...$$ cho công thức khối."
                        />
                      </div>

                      {/* Right: Live KaTeX Math Preview */}
                      <div className="flex flex-col space-y-1">
                        <span className="text-[11px] font-semibold text-emerald-400">Xem trước kết xuất thực tế (Live Preview):</span>
                        <div className="p-4 rounded-lg bg-[#070a12] border border-white/10 min-h-[160px] max-h-[260px] overflow-y-auto">
                          <MathRenderer content={formData.statement || 'Chưa có nội dung đề bài...'} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sample Testcases */}
                  <div className="p-5 rounded-xl bg-[#0d1222] border border-white/10 space-y-3">
                    <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                      3. Bộ Testcase Mẫu (Sample I/O)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Sample Input (Đầu vào mẫu):</label>
                        <textarea
                          rows={3}
                          value={formData.sampleInput}
                          onChange={(e) => setFormData({ ...formData, sampleInput: e.target.value })}
                          className="w-full p-2.5 rounded-lg bg-[#070a12] border border-white/15 text-emerald-400 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="3\n1 2 3"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Sample Output (Đầu ra mẫu):</label>
                        <textarea
                          rows={3}
                          value={formData.sampleOutput}
                          onChange={(e) => setFormData({ ...formData, sampleOutput: e.target.value })}
                          className="w-full p-2.5 rounded-lg bg-[#070a12] border border-white/15 text-orange-400 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="6"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Editorial */}
                  <div className="p-5 rounded-xl bg-[#0d1222] border border-white/10 space-y-3">
                    <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                      4. Lời Giải Chi Tiết (Editorial & Phân Tích Độ Phức Tạp)
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                      <div className="flex flex-col space-y-1">
                        <textarea
                          rows={5}
                          value={formData.editorial}
                          onChange={(e) => setFormData({ ...formData, editorial: e.target.value })}
                          className="w-full p-3 rounded-lg bg-[#070a12] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="Nhập hướng dẫn giải và phân tích $O(N)$..."
                        />
                      </div>

                      <div className="p-3 rounded-lg bg-[#070a12] border border-white/10 max-h-[140px] overflow-y-auto">
                        <MathRenderer content={formData.editorial || 'Chưa có hướng dẫn giải...'} />
                      </div>
                    </div>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPolygonView('list')}
                      className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition border border-white/10"
                    >
                      Hủy Bỏ
                    </button>

                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition flex items-center gap-2 shadow-xl shadow-orange-500/20"
                    >
                      <Save className="w-4 h-4" />
                      {editingId ? 'Lưu Thay Đổi Bài Toán' : '💾 Xuất Bản Bài Toán Vào Đấu Trường'}
                    </button>
                  </div>

                </form>
              )}

            </div>
          )}


          {/* TAB 4: TELEMETRY */}
          {activeTab === 'telemetry' && (
            <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
              <h2 className="text-base font-bold text-white">Telemetry & Judge Worker Queue</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded bg-black/40 border border-white/5">
                  <span className="text-slate-500 block text-[11px]">Hàng Đợi P1 (Instant Hack):</span>
                  <span className="text-emerald-400 font-bold text-base">0 jobs (0ms wait)</span>
                </div>
                <div className="p-3 rounded bg-black/40 border border-white/5">
                  <span className="text-slate-500 block text-[11px]">Hàng Đợi P2 (Pretests):</span>
                  <span className="text-[#00f0ff] font-bold text-base">2 jobs (18ms latency)</span>
                </div>
                <div className="p-3 rounded bg-black/40 border border-white/5">
                  <span className="text-slate-500 block text-[11px]">Hàng Đợi P3 (System Testing):</span>
                  <span className="text-yellow-400 font-bold text-base">45 queued tests</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ROOMS */}
          {activeTab === 'rooms' && (
            <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
              <h2 className="text-base font-bold text-white">Phân Phối Phòng Thi (Room 25 Người Chuẩn Codeforces)</h2>
              <p className="text-xs text-slate-400">Thí sinh được phân vào phòng theo dải Elo tương đương để đảm bảo tính sư phạm khi Hack.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs">
                  <div className="flex items-center justify-between font-bold text-white mb-1">
                    <span>Room #1 (Expert & CM)</span>
                    <span className="text-emerald-400">25/25 Thí sinh</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Rating trung bình: 1780 Elo</span>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs">
                  <div className="flex items-center justify-between font-bold text-white mb-1">
                    <span>Room #2 (Specialist)</span>
                    <span className="text-emerald-400">25/25 Thí sinh</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Rating trung bình: 1520 Elo</span>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs">
                  <div className="flex items-center justify-between font-bold text-white mb-1">
                    <span>Room #3 (Pupil & Newbie)</span>
                    <span className="text-emerald-400">22/25 Thí sinh</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Rating trung bình: 1240 Elo</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </main>

    </div>
  );
};
