import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useContest } from '../../context/ContestContext';
import { MathRenderer } from '../common/MathRenderer';
import { api } from '../../lib/apiClient';

export const AdminLayout = ({ children }) => {
  const { user, isAdmin, logout } = useAuth();
  const { 
    phase, formattedTime, changePhaseRemote, frozen, toggleFrozen,
    problems = [], addProblem, updateProblem, deleteProblem, resetProblems, loadProblemsFromServer 
  } = useContest();
  const navigate = useNavigate();

  const handlePhaseChange = async (newPhase) => {
    const res = await changePhaseRemote(newPhase);
    if (!res.ok) setAdminNotice(`Đã chuyển tab local sang ${newPhase}. Máy chủ: ${res.error}`);
    else setAdminNotice('');
  };

  const [activeTab, setActiveTab] = useState('phase'); // phase | anticheat | polygon | telemetry | rooms

  // Polygon Problem Studio States
  const [polygonView, setPolygonView] = useState('list'); // 'list' | 'editor'
  const [editingId, setEditingId] = useState(null);
  const [polygonNotification, setPolygonNotification] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [targetContestId, setTargetContestId] = useState('contest_dever_round1');
  const [contestOptions, setContestOptions] = useState([]);

  useEffect(() => {
    if (activeTab === 'polygon') {
      try { loadProblemsFromServer?.(); } catch {}
      (async () => {
        try {
          const data = await api.getContests();
          if (Array.isArray(data?.contests)) setContestOptions(data.contests);
        } catch { /* backend chưa chạy */ }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const [adminNotice, setAdminNotice] = useState('');

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

  const handleSaveProblem = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.statement.trim()) {
      setPolygonNotification({ type: 'error', message: 'Vui lòng nhập đầy đủ tiêu đề và nội dung đề bài!' });
      return;
    }

    const tagList = formData.tags.split(',').map(s => s.trim()).filter(Boolean);
    const payload = {
      contest_id: targetContestId,
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
    };

    let backendOnline = false;
    try {
      await api.getProblems({ contest_id: 'contest_dever_round1' });
      backendOnline = true;
    } catch {
      backendOnline = false;
    }

    if (backendOnline) {
      try {
        if (editingId) {
          const data = await api.updateProblem(editingId, payload);
          const saved = data?.problem || { id: editingId, ...payload, solvedCount: problems.find(p => p.id === editingId)?.solvedCount || 0 };
          updateProblem({ ...saved, solvedCount: saved.solvedCount ?? problems.find(p => p.id === editingId)?.solvedCount ?? 0 });
          setPolygonNotification(`Đã lưu lên máy chủ bài ${saved.code}: ${saved.title}.`);
        } else {
          const data = await api.createProblem(payload);
          const saved = data?.problem || { id: 'p' + (100 + problems.length + 1) + '_' + Date.now().toString(36).slice(-4), ...payload, solvedCount: 0 };
          addProblem({ ...saved, solvedCount: saved.solvedCount ?? 0 });
          setPolygonNotification(`Đã lưu lên máy chủ đề mới bài ${saved.code}: ${saved.title}.`);
        }
        setPolygonView('list');
        setTimeout(() => setPolygonNotification(null), 5000);
        return;
      } catch (err) {
        setPolygonNotification({ type: 'error', message: err?.message || 'Lưu lên máy chủ thất bại.' });
        return;
      }
    }

    // Server-only: đề thi sống trên máy chủ, không lưu local nữa.
    setPolygonNotification({ type: 'error', message: 'Chưa kết nối máy chủ — đề thi chỉ lưu được lên máy chủ (npm run server).' });
    return;
  };

  // Protected Route Check
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070a12] p-4 text-center">
        <div className="max-w-md p-8 rounded-2xl bg-[#0c101d] border border-red-500/30 shadow-2xl space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Khu vực hạn chế quản trị</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Khu vực này chỉ dành cho ban tổ chức và ban giám khảo CLB FU-DEVER.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => navigate('/login?redirect=/admin')}
              className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition"
            >
              Đăng nhập tài khoản giám khảo
            </button>
            <button
              onClick={() => navigate('/arena')}
              className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition border border-white/10"
            >
              Quay lại đấu trường thí sinh
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
            <img src="/brand/icon-192.png" alt="DEVER Arena" className="w-8 h-8 rounded-lg ring-1 ring-red-500/30" />
            <div>
              <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                DEVER<span className="text-red-500">ADMIN</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono block leading-none">Ban giám khảo</span>
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
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'phase'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            1. Điều khiển phase
          </button>

          <button
            onClick={() => setActiveTab('anticheat')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'anticheat'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            2. Soát gian lận AST
          </button>

          <button
            onClick={() => setActiveTab('polygon')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'polygon'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            3. Soạn đề thi
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'telemetry'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            4. Giám sát máy chấm
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'rooms'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            5. Thí sinh và phòng hack
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'accounts'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            6. Cấp tài khoản
          </button>
        </nav>

        {/* Sidebar Footer: Switch to Contestant View & Logout */}
        <div className="p-3 border-t border-white/10 bg-[#080b15] space-y-2 text-xs">
          {/* Switch to Contestant Mode Button */}
          <Link
            to="/arena"
            className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-medium transition group"
          >
            Xem góc nhìn thí sinh →
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
                <span className="text-[10px] text-red-400 font-mono">Giám khảo ({user.rating} Elo)</span>
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="px-2 py-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition text-xs"
              title="Đăng xuất khỏi trang quản trị"
            >
              Đăng xuất
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
            <h1 className="text-base font-extrabold text-white tracking-tight">
              <span>Bảng điều hành ban giám khảo</span>
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => toggleFrozen()}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
                frozen
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              {frozen ? 'Đang đóng băng bảng điểm' : 'Đóng băng bảng điểm'}
            </button>

            <button
              onClick={() => setAdminNotice('Chức năng thông báo khẩn chưa được kết nối tới máy chủ.')}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition"
            >
              Thông báo khẩn
            </button>
          </div>
          {adminNotice && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold" role="status">
              {adminNotice}
            </div>
          )}
        </header>

        {/* Tab Content Display */}
        <div className="p-6 lg:p-8 space-y-6">
          
          {/* TAB 1: PHASE ORCHESTRATOR */}
          {activeTab === 'phase' && (
            <div className="space-y-6">
              <CreateContestPanel />
              <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white">Điều khiển tiến trình kỳ thi</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chuyển phase sẽ đồng bộ tới các tab thí sinh đang mở qua backend
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
                      onClick={() => handlePhaseChange('CODING')}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                    >
                      Kích Hoạt CODING
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border transition ${phase === 'HACK_PHASE' ? 'bg-orange-500/10 border-orange-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-[#ff6600] mb-1">2. Hack Phase (15')</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Mở code trong Room 25 người, cho phép bẻ khóa.</p>
                    <button
                      onClick={() => handlePhaseChange('HACK_PHASE')}
                      className="w-full py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition"
                    >
                      Kích Hoạt HACK
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border transition ${phase === 'SYSTEM_TESTING' ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-yellow-400 mb-1">3. System Testing</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Chạy 45 test ẩn, chốt điểm chung cuộc.</p>
                    <button
                      onClick={() => handlePhaseChange('SYSTEM_TESTING')}
                      className="w-full py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-xs transition"
                    >
                      Chạy System Test
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border transition ${phase === 'FINISHED' ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-[#00f0ff] mb-1">4. Finished (Rating)</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Đóng giải, tính toán cập nhật Elo 7 bậc.</p>
                    <button
                      onClick={() => handlePhaseChange('FINISHED')}
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
                  <h2 className="text-base font-bold text-white">Soát gian lận mã nguồn (AST)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    So khớp cây cú pháp trừu tượng, phát hiện đổi tên biến và xóa comment (demo)
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20">
                  1 cặp nghi vấn trên 85% (demo)
                </span>
              </div>

              <div className="p-4 rounded-lg bg-black/40 border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Cặp bài: <span className="text-red-400 font-mono">u_cheater_x</span> và <span className="text-red-400 font-mono">u_cheater_y</span> (Bài B)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Dữ liệu minh họa — quét thật cần máy chủ chấm.
                  </span>
                </div>
                <button
                  onClick={() => setAdminNotice('Chức năng truất quyền thi đấu chưa được kết nối tới máy chủ.')}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shrink-0"
                >
                  Truất quyền thi đấu
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: POLYGON PROBLEMSETTER STUDIO */}
          {activeTab === 'polygon' && (
            <div className="space-y-6">
              
              {/* Notification Banner */}
              {polygonNotification && (
                <div className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between animate-fade-in ${
                  typeof polygonNotification === 'object'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  <span>{typeof polygonNotification === 'string' ? polygonNotification : polygonNotification.message}</span>
                  <button 
                    onClick={() => setPolygonNotification(null)}
                    className="px-2 py-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white text-[11px]"
                  >
                    Đóng
                  </button>
                </div>
              )}

              {/* Header Strip with Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#0d1222] border border-white/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ff6600]/10 text-[#ff6600] border border-[#ff6600]/30 uppercase">
                      Soạn đề
                    </span>
                    <span className="text-xs text-slate-400">
                      Bản nháp lưu trên trình duyệt
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white">Soạn và quản lý đề thi</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Soạn đề bằng Markdown và công thức toán, xem trước trực tiếp
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {polygonView === 'editor' ? (
                    <button
                      onClick={() => setPolygonView('list')}
                      className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition border border-white/10"
                    >
                      ← Quay lại danh sách
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={async () => {
                          if (confirmReset) {
                            await loadProblemsFromServer();
                            setPolygonNotification('Đã tải lại danh sách đề từ máy chủ.');
                            setConfirmReset(false);
                          } else {
                            setConfirmReset(true);
                            setTimeout(() => setConfirmReset(false), 4000);
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-semibold text-xs transition border border-white/10"
                        title="Tải lại danh sách đề từ máy chủ"
                      >
                        {confirmReset ? 'Nhấn lại để xác nhận' : 'Tải lại từ máy chủ'}
                      </button>

                      <button
                        onClick={handleOpenCreateProblem}
                        className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition shadow-lg shadow-orange-500/20"
                      >
                        + Soạn đề bài mới
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
                              <div>{prob.timeLimit || '1.0s'}</div>
                              <div>{prob.memoryLimit || '256 MB'}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
                                Nháp
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  to={`/problem/${prob.id}`}
                                  className="px-2 py-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-[#00f0ff] transition text-[11px]"
                                  title="Xem giao diện workspace"
                                >
                                  Xem
                                </Link>
                                <button
                                  onClick={() => handleOpenEditProblem(prob)}
                                  className="px-2 py-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-orange-400 transition text-[11px]"
                                  title="Chỉnh sửa đề bài"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirmDeleteId === prob.id) {
                                      try {
                                        await api.deleteProblem(prob.id);
                                        await loadProblemsFromServer();
                                        setPolygonNotification(`Đã xóa bài ${prob.code} trên máy chủ.`);
                                      } catch (err) {
                                        setPolygonNotification({ type: 'error', message: err?.message || `Không thể xóa bài ${prob.code} trên máy chủ.` });
                                      }
                                      setConfirmDeleteId(null);
                                      setTimeout(() => setPolygonNotification(null), 5000);
                                    } else {
                                      setConfirmDeleteId(prob.id);
                                      setTimeout(() => setConfirmDeleteId((v) => (v === prob.id ? null : v)), 4000);
                                    }
                                  }}
                                  className="px-2 py-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition text-[11px]"
                                  title="Xóa đề bài"
                                >
                                  {confirmDeleteId === prob.id ? 'Xác nhận xóa?' : 'Xóa'}
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
                    <div className="text-emerald-400 font-bold">
                      <span>Kiểm tra chất lượng test:</span>
                    </div>
                    <div className="text-slate-400 text-[11px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                      <div className="p-2 rounded bg-black/40 border border-white/5">Không dư khoảng trắng cuối dòng</div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">Kết thúc bằng xuống dòng</div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">Giới hạn và biên hợp lệ</div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">So số thực theo sai số</div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: FULL PROBLEMSETTER FORM WITH LATEX LIVE PREVIEW */}
              {polygonView === 'editor' && (
                <form onSubmit={handleSaveProblem} className="space-y-6">
                  
                  {/* Basic Metadata */}
                  <div className="p-5 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
                      <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                        <span>1. Thông tin cơ bản</span>
                      </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 text-xs">
                      {/* Target contest */}
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-300 mb-1">Kỳ thi đích:</label>
                        <select
                          value={targetContestId}
                          onChange={(e) => setTargetContestId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-white/15 text-white text-xs font-semibold focus:border-[#ff6600] outline-none"
                        >
                          <option value="contest_dever_round1">DEVER Round #1 (mặc định)</option>
                          {contestOptions.filter((c) => c.id !== 'contest_dever_round1').map((c) => (
                            <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
                          ))}
                        </select>
                      </div>
                      {/* Code */}
                      <div className="sm:col-span-1">
                        <label className="block font-semibold text-slate-300 mb-1">Mã bài:</label>
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
                        <label className="block font-semibold text-slate-300 mb-1">Tên bài toán:</label>
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
                        <label className="block font-semibold text-slate-300 mb-1">Điểm cơ sở:</label>
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
                        <label className="block font-semibold text-slate-300 mb-1">Thẻ phân loại (cách nhau bằng dấu phẩy):</label>
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
                        <label className="block font-semibold text-slate-300 mb-1">Giới hạn thời gian:</label>
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
                        <label className="block font-semibold text-slate-300 mb-1">Giới hạn bộ nhớ:</label>
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
                      <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                        <span>2. Nội dung đề bài (Markdown và công thức toán)</span>
                      </h3>
                      <span className="text-[11px] text-cyan-400 font-mono">
                        Xem trước trực tiếp
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                      {/* Left: Input Textarea */}
                      <div className="flex flex-col space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400">Soạn thảo:</span>
                        <textarea
                          rows={10}
                          required
                          value={formData.statement}
                          onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                          className="w-full p-3 rounded-lg bg-[#070a12] border border-white/15 text-slate-200 font-mono text-xs leading-relaxed focus:border-[#ff6600] outline-none"
                          placeholder="Mô tả đề bài. Dùng $N$ cho công thức trong dòng, $$...$$ cho công thức khối."
                        />
                      </div>

                      {/* Right: Live KaTeX Math Preview */}
                      <div className="flex flex-col space-y-1">
                        <span className="text-[11px] font-semibold text-emerald-400">Xem trước:</span>
                        <div className="p-4 rounded-lg bg-[#070a12] border border-white/10 min-h-[160px] max-h-[260px] overflow-y-auto">
                          <MathRenderer content={formData.statement || 'Chưa có nội dung đề bài...'} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sample Testcases */}
                  <div className="p-5 rounded-xl bg-[#0d1222] border border-white/10 space-y-3">
                    <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                      3. Test mẫu
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Input mẫu:</label>
                        <textarea
                          rows={3}
                          value={formData.sampleInput}
                          onChange={(e) => setFormData({ ...formData, sampleInput: e.target.value })}
                          className="w-full p-2.5 rounded-lg bg-[#070a12] border border-white/15 text-emerald-400 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="3\n1 2 3"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Output mẫu:</label>
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
                      4. Lời giải
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                      <div className="flex flex-col space-y-1">
                        <textarea
                          rows={5}
                          value={formData.editorial}
                          onChange={(e) => setFormData({ ...formData, editorial: e.target.value })}
                          className="w-full p-3 rounded-lg bg-[#070a12] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="Hướng dẫn giải và phân tích độ phức tạp..."
                        />
                      </div>

                      <div className="p-3 rounded-lg bg-[#070a12] border border-white/10 max-h-[140px] overflow-y-auto">
                        <MathRenderer content={formData.editorial || 'Chưa có lời giải...'} />
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
                      Hủy bỏ
                    </button>

                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition shadow-xl shadow-orange-500/20"
                    >
                      {editingId ? 'Lưu thay đổi' : 'Xuất bản đề bài'}
                    </button>
                  </div>

                </form>
              )}

            </div>
          )}


          {/* TAB 4: TELEMETRY */}
          {activeTab === 'telemetry' && (
            <TelemetryPanel />
          )}

          {/* TAB 5: ROOMS */}
          {activeTab === 'rooms' && (
            <RoomsPanel />
          )}

          {activeTab === 'accounts' && (
            <AccountsPanel />
          )}

        </div>

      </main>

    </div>
  );
};

/** Tạo kỳ thi mới (mở đăng ký REGISTRATION, admin gán đề sau). */
const CreateContestPanel = () => {
  const [form, setForm] = useState({ title: '', format: 'CODEFORCES', start: '', duration: 135, minRating: '', maxRating: '' });
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg(''); setOk(false);
    try {
      const data = await api.createContest({
        title: form.title.trim(),
        contest_format: form.format,
        start_time: form.start ? new Date(form.start).toISOString() : new Date().toISOString(),
        duration_minutes: Number(form.duration) || 135,
        min_rating: form.minRating === '' ? null : Number(form.minRating),
        max_rating: form.maxRating === '' ? null : Number(form.maxRating),
      });
      setOk(true);
      setMsg(`Đã tạo kỳ thi “${data.contest.title}”, đang mở đăng ký. Gán đề bằng tab Soạn đề.`);
      setForm({ title: '', format: 'CODEFORCES', start: '', duration: 135, minRating: '', maxRating: '' });
    } catch (err) {
      setMsg(err?.message || 'Tạo kỳ thi thất bại.');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-slate-500 outline-none focus:border-[#ff6600]';

  return (
    <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">Mở kỳ thi mới</h2>
        <p className="text-xs text-slate-400 mt-0.5">Kỳ thi tạo ra ở trạng thái mở đăng ký. Đề thi gán sau ở tab Soạn đề.</p>
      </div>
      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <input className={inputCls} placeholder="Tên kỳ thi (vd: DEVER Round #3)" value={form.title} onChange={set('title')} required />
        <select className={inputCls} value={form.format} onChange={set('format')}>
          <option value="CODEFORCES">Codeforces (điểm giảm theo giờ + hack)</option>
          <option value="ICPC">ICPC (số bài + phạt giờ)</option>
          <option value="IOI">IOI (điểm subtask)</option>
        </select>
        <input className={inputCls} type="datetime-local" value={form.start} onChange={set('start')} title="Giờ bắt đầu (bỏ trống = ngay bây giờ)" />
        <input className={inputCls} type="number" min={15} value={form.duration} onChange={set('duration')} title="Thời lượng (phút)" />
        <input className={inputCls} type="number" min={0} value={form.minRating} onChange={set('minRating')} placeholder="Rating tối thiểu (trống = không giới hạn)" />
        <input className={inputCls} type="number" min={0} value={form.maxRating} onChange={set('maxRating')} placeholder="Rating tối đa (trống = không giới hạn)" />
        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition">
            Mở kỳ thi
          </button>
        </div>
      </form>
      {msg && (
        <div className={`p-3 rounded-lg border text-xs font-semibold ${ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`} role="status">
          {msg}
        </div>
      )}
    </div>
  );
};

/** Số liệu máy chấm thật từ API (số bài nộp theo verdict, số thí sinh). */
const TelemetryPanel = () => {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [confirmRejudgeId, setConfirmRejudgeId] = useState(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const [subs, st] = await Promise.all([
        api.listSubmissions('contest_dever_round1'),
        api.getStandings('dever-round-1-div3'),
      ]);
      const byVerdict = {};
      (subs.submissions || []).forEach((s) => { byVerdict[s.verdict] = (byVerdict[s.verdict] || 0) + 1; });
      setStats({ total: (subs.submissions || []).length, byVerdict, participants: (st.standings || []).length });
      setRecent((subs.submissions || []).slice(0, 20));
    } catch { /* giữ null */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRejudge = async (id) => {
    if (confirmRejudgeId !== id) {
      setConfirmRejudgeId(id);
      setTimeout(() => setConfirmRejudgeId((v) => (v === id ? null : v)), 4000);
      return;
    }
    setConfirmRejudgeId(null);
    try {
      const data = await api.rejudge(id);
      setNotice(`Đã chấm lại ${id}: ${data.submission.verdict} (${data.submission.points_awarded}đ).`);
      load();
    } catch (err) {
      setNotice(err?.message || 'Chấm lại thất bại.');
    }
  };

  const cells = stats
    ? [
        ['Tổng bài nộp', String(stats.total)],
        ['Qua pretest (AC)', String(stats.byVerdict.AC || 0)],
        ['Sai đáp án (WA)', String(stats.byVerdict.WA || 0)],
        ['Quá giờ / lỗi chạy', String((stats.byVerdict.TLE || 0) + (stats.byVerdict.RTE || 0))],
        ['Lỗi biên dịch', String(stats.byVerdict.CE || 0)],
        ['Rớt system test', String(stats.byVerdict.FST || 0)],
        ['Bị hack', String(stats.byVerdict.HACKED || 0)],
        ['Thí sinh', String(stats.participants)],
      ]
    : [];

  return (
    <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
      <h2 className="text-base font-bold text-white">Giám sát máy chấm</h2>
      {!stats ? (
        <p className="text-xs text-slate-400">Chưa kết nối được máy chủ (npm run server). Số liệu sẽ hiện ở đây khi online.</p>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          {cells.map(([label, value]) => (
            <div key={label} className="p-3 rounded bg-black/40 border border-white/5">
              <span className="text-slate-500 block text-[11px]">{label}:</span>
              <span className="text-slate-100 font-bold text-base">{value}</span>
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-300 mb-2">Bài nộp gần nhất (chấm lại khi nghi ngờ test)</h3>
          {notice && (
            <div className="mb-2 p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300" role="status">
              {notice}
            </div>
          )}
          <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3">Bài nộp</th>
                  <th className="py-2 px-3">Verdict</th>
                  <th className="py-2 px-3 text-right">Điểm</th>
                  <th className="py-2 px-3 text-right">Chấm lại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 px-3 text-slate-300">{s.id.slice(0, 14)}…</td>
                    <td className="py-2 px-3 text-slate-200">{s.verdict}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{s.points_awarded}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleRejudge(s.id)}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] transition"
                      >
                        {confirmRejudgeId === s.id ? 'Nhấn lại để xác nhận' : 'Chấm lại'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

/** Phòng thi thật từ API (nhóm theo room_id). */
const RoomsPanel = () => {
  const [rooms, setRooms] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const st = await api.getStandings('dever-round-1-div3');
        if (cancelled) return;
        const groups = {};
        (st.standings || []).forEach((r) => {
          const id = r.room_id || 'Chưa xếp phòng';
          if (!groups[id]) groups[id] = { id, members: [], ratings: [] };
          groups[id].members.push(r.username);
          groups[id].ratings.push(r.rating);
        });
        setRooms(Object.values(groups));
      } catch { /* giữ null */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-4">
      <h2 className="text-base font-bold text-white">Phân phối phòng thi</h2>
      <p className="text-xs text-slate-400">Mỗi phòng tối đa 25 thí sinh. Phòng dùng để bẻ khóa bài nhau trong Hack Phase.</p>
      {!rooms ? (
        <p className="text-xs text-slate-400">Chưa kết nối được máy chủ (npm run server).</p>
      ) : rooms.length === 0 ? (
        <p className="text-xs text-slate-400">Chưa có thí sinh đăng ký.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rooms.map((room) => (
            <div key={room.id} className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs">
              <div className="flex items-center justify-between font-bold text-white mb-1">
                <span>{room.id}</span>
                <span className="text-emerald-400">{room.members.length}/25 thí sinh</span>
              </div>
              <span className="text-[11px] text-slate-500 block">{room.members.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Cấp tài khoản cá nhân / đội thi (admin phát trước giờ thi). Không icon trang trí. */
const AccountsPanel = () => {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'PARTICIPANT', rating: 1200, team: '', members: '' });
  const [backendUp, setBackendUp] = useState(true);
  const [resetId, setResetId] = useState(null);
  const [newPw, setNewPw] = useState('');

  const load = async () => {
    try {
      const data = await api.listUsers();
      setUsers(data.users || []);
      setBackendUp(true);
    } catch {
      setBackendUp(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg(''); setOk(false);
    try {
      const data = await api.createUser({
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim() || form.username.trim(),
        role: form.role,
        rating: Number(form.rating) || 1200,
        team: form.team.trim() || null,
        members: form.members.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setOk(true);
      setMsg(`Đã cấp tài khoản ${data.user.username} (${data.user.role === 'ADMIN' ? 'giám khảo' : data.user.team ? `đội ${data.user.team}` : 'cá nhân'}).`);
      setForm({ username: '', password: '', full_name: '', role: 'PARTICIPANT', rating: 1200, team: '', members: '' });
      load();
    } catch (err) {
      setMsg(err?.message || 'Tạo tài khoản thất bại.');
    }
  };

  const handleResetPw = async (u) => {
    if (resetId !== u.id) {
      setResetId(u.id);
      setNewPw('');
      setMsg(''); setOk(false);
      return;
    }
    try {
      await api.resetPassword(u.id, newPw);
      setOk(true);
      setMsg(`Đã đặt lại mật khẩu cho ${u.username}. Báo mật khẩu mới cho chủ tài khoản qua kênh riêng.`);
      setResetId(null);
      setNewPw('');
    } catch (err) {
      setOk(false);
      setMsg(err?.message || 'Đặt lại mật khẩu thất bại.');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-slate-500 outline-none focus:border-[#ff6600]';

  return (
    <div className="p-6 rounded-xl bg-[#0d1222] border border-white/10 space-y-5">
      <div>
        <h2 className="text-base font-bold text-white">Cấp tài khoản thi đấu</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Admin chủ động tạo tài khoản cá nhân hoặc đội thi trước giờ contest. Không có đăng ký công khai.
        </p>
      </div>

      {!backendUp && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs" role="alert">
          Backend chưa chạy (npm run server) — không thể quản lý tài khoản.
        </div>
      )}

      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <input className={inputCls} placeholder="Username (vd: team_rong)" value={form.username} onChange={set('username')} required minLength={3} />
        <input className={inputCls} type="password" placeholder="Mật khẩu (≥ 6 ký tự)" value={form.password} onChange={set('password')} required minLength={6} />
        <input className={inputCls} placeholder="Tên hiển thị (vd: Đội Rồng Lửa)" value={form.full_name} onChange={set('full_name')} />
        <select className={inputCls} value={form.role} onChange={set('role')}>
          <option value="PARTICIPANT">Thí sinh / Đội thi</option>
          <option value="ADMIN">Giám khảo</option>
        </select>
        <input className={inputCls} type="number" placeholder="Rating khởi điểm" value={form.rating} onChange={set('rating')} min={0} />
        <input className={inputCls} placeholder="Tên đội (bỏ trống = cá nhân)" value={form.team} onChange={set('team')} />
        <input className={`${inputCls} sm:col-span-2 lg:col-span-3`} placeholder="Thành viên đội, cách nhau bằng dấu phẩy" value={form.members} onChange={set('members')} />
        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition">
            Cấp tài khoản
          </button>
        </div>
      </form>

      {msg && (
        <div className={`p-3 rounded-lg border text-xs font-semibold ${ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`} role="status">
          {msg}
        </div>
      )}

      <div className="bg-[#0e1424] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0c101c] border-b border-white/10 text-slate-400 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Username</th>
              <th className="py-2.5 px-4">Tên hiển thị</th>
              <th className="py-2.5 px-4">Vai trò</th>
              <th className="py-2.5 px-4">Rating</th>
              <th className="py-2.5 px-4">Đội / Thành viên</th>
              <th className="py-2.5 px-4 text-right">Mật khẩu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/5">
                <td className="py-2.5 px-4 font-mono font-bold text-white">{u.username}</td>
                <td className="py-2.5 px-4 text-slate-300">{u.full_name}</td>
                <td className="py-2.5 px-4 text-slate-400">{u.role}</td>
                <td className="py-2.5 px-4 font-mono text-orange-400">{u.rating}</td>
                <td className="py-2.5 px-4 text-slate-400">{u.team ? `${u.team} (${(u.members || []).join(', ')})` : '—'}</td>
                <td className="py-2.5 px-4 text-right">
                  {resetId === u.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="Mật khẩu mới ≥ 6 ký tự"
                        className="w-44 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[11px] outline-none focus:border-[#ff6600]"
                      />
                      <button onClick={() => handleResetPw(u)} className="px-2 py-1 rounded bg-[#ff6600] hover:bg-[#ff771a] text-white text-[11px] font-bold transition">
                        Lưu
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => handleResetPw(u)} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[11px] transition">
                      Đặt lại
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
