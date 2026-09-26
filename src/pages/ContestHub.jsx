import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContest } from '../context/ContestContext';
import { api, getToken } from '../lib/apiClient';
import { MathRenderer } from '../components/common/MathRenderer';

/** Hàng chờ kiểm duyệt mù: tester tự giải độc lập rồi nộp báo cáo (không thấy editorial). */
const TestingQueue = () => {
  const [queue, setQueue] = useState(null);
  const [forms, setForms] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api.testingQueue();
        if (!cancelled) setQueue(d.queue || []);
      } catch { if (!cancelled) setQueue([]); }
    })();
    return () => { cancelled = true; };
  }, []);
  if (!queue || queue.length === 0) return null;
  const set = (id, patch) => setForms((f) => ({ ...f, [id]: { solved: false, minutes: '', feedback: '', ...(f[id] || {}), ...patch } }));
  const submit = async (p) => {
    const f = forms[p.id] || {};
    set(p.id, { busy: true, msg: '' });
    try {
      await api.submitTestReport({ problem_id: p.id, solved: Boolean(f.solved), minutes_spent: Number(f.minutes) || 0, feedback: f.feedback || '' });
      set(p.id, { busy: false, done: true });
    } catch (e) {
      set(p.id, { busy: false, msg: e?.message || 'Gửi thất bại.' });
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#f7f8f8] tracking-tight">Bài chờ tôi kiểm duyệt</h2>
        <p className="text-xs text-slate-400">Giải độc lập (mù, không xem editorial), rồi nộp báo cáo cho coordinator.</p>
      </div>
      {queue.map((p) => {
        const f = forms[p.id] || {};
        return (
          <div key={p.id} className="p-5 rounded-xl bg-[#0f1011] border border-[#ff6600]/30 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#ff6600] text-sm">{p.code}</span>
              <span className="font-bold text-white text-sm">{p.title}</span>
              <span className="text-[10px] text-slate-500 font-mono">TL {p.timeLimit} · {p.memoryLimit}</span>
            </div>
            <MathRenderer content={p.statement || ''} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-[#010102] border border-[#23252a]"><div className="text-slate-500 text-[10px]">Input mẫu</div><pre className="text-slate-300 whitespace-pre-wrap">{p.sampleInput}</pre></div>
              <div className="p-2 rounded bg-[#010102] border border-[#23252a]"><div className="text-slate-500 text-[10px]">Output mẫu</div><pre className="text-slate-300 whitespace-pre-wrap">{p.sampleOutput}</pre></div>
            </div>
            {f.done ? (
              <div className="text-xs text-emerald-400 font-semibold">Đã gửi báo cáo. Cảm ơn bạn đã kiểm duyệt.</div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 text-xs">
                <label className="flex items-center gap-1.5 text-slate-300 shrink-0">
                  <input type="checkbox" checked={Boolean(f.solved)} onChange={(e) => set(p.id, { solved: e.target.checked })} />
                  Tôi giải được
                </label>
                <input value={f.minutes || ''} onChange={(e) => set(p.id, { minutes: e.target.value })} type="number" min="0" placeholder="Số phút đã giải"
                  className="w-32 px-2 py-1.5 rounded-lg bg-[#141516] border border-[#23252a] text-white outline-none" />
                <input value={f.feedback || ''} onChange={(e) => set(p.id, { feedback: e.target.value })} placeholder="Nhận xét (độ khó, test mẫu...)"
                  className="flex-1 px-2 py-1.5 rounded-lg bg-[#141516] border border-[#23252a] text-white placeholder-slate-500 outline-none" />
                <button onClick={() => submit(p)} disabled={f.busy}
                  className="px-3 py-1.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium disabled:opacity-50 shrink-0">
                  {f.busy ? 'Đang gửi...' : 'Nộp báo cáo'}
                </button>
                {f.msg && <span className="text-red-400">{f.msg}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const ContestHub = () => {
  const { phase, formattedTime, getDynamicScore, problems = [] } = useContest();
  const navigate = useNavigate();

  const [virtual, setVirtual] = useState(null); // { session_id, elapsedMinutes, standings }
  const [virtualSupported, setVirtualSupported] = useState(false);
  const [virtualLoading, setVirtualLoading] = useState(false);
  const [contests, setContests] = useState(null);
  const [regMsg, setRegMsg] = useState('');

  // Danh sách kỳ thi thật từ backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getContests();
        if (!cancelled && Array.isArray(data?.contests)) setContests(data.contests);
      } catch { /* backend chưa chạy → ẩn danh sách */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Virtual Contest: chỉ hiện khi backend reachable
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.getContest('dever-round-0-archive');
        if (!cancelled) setVirtualSupported(true);
      } catch { /* backend chưa chạy → ẩn thẻ ảo */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const startVirtual = async () => {
    if (!getToken()) { navigate('/login?redirect=/arena'); return; }
    setVirtualLoading(true);
    try {
      const s = await api.createVirtual('dever-round-0-archive');
      const v = await api.getVirtual('dever-round-0-archive', s.session_id);
      setVirtual(v);
    } catch { /* im lặng, giữ thẻ */ }
    finally { setVirtualLoading(false); }
  };

  const handleRegister = async (slug) => {
    if (!getToken()) { navigate('/login?redirect=/arena'); return; }
    setRegMsg('');
    try {
      const data = await api.register(slug);
      setRegMsg(`Đã đăng ký thành công, xếp vào ${data.participant.room_id}.`);
    } catch (err) {
      setRegMsg(err?.message || 'Đăng ký thất bại.');
    }
  };
  const getDifficultyColor = (rating) => {
    if (rating <= 800) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (rating <= 1200) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (rating <= 1600) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      
      {/* Contest Hero Banner */}
      <div className="relative rounded-xl bg-[#0f1011] border border-[#23252a] p-6 lg:p-8 overflow-hidden">

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

            <h1 className="text-2xl lg:text-3xl font-semibold text-[#f7f8f8] tracking-tight">
              DEVER Round #1 (Div. 3) — đấu trường thuật toán
            </h1>

            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-xl">
              2 giờ 15 phút thi đấu chuẩn Codeforces: 120 phút Coding, 15 phút Bẻ khóa Hack Room, và chốt điểm qua 45 System Tests.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-[#010102] p-4 rounded-xl border border-[#23252a] shrink-0">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-medium block">Thời gian còn lại</span>
              <span className="font-mono text-2xl font-bold text-[#ff6600] tracking-wider">
                {formattedTime}
              </span>
            </div>
            <div className="h-8 border-r border-[#23252a]"></div>
            <Link
              to="/problem/p102"
              className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] font-medium text-xs text-white transition"
            >
              Vào Workspace →
            </Link>
          </div>
        </div>
      </div>

      {/* Contests Roster (từ máy chủ) */}
      {contests && contests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white tracking-tight">Các kỳ thi</h2>
          {regMsg && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300" role="status">
              {regMsg}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contests.map((c) => (
              <div key={c.id} className="p-5 rounded-2xl bg-[#0e1424] border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white text-sm">{c.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white/5 text-slate-300 border-white/10">
                    {c.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {c.contest_format} • {c.duration_minutes} phút
                  {c.min_rating != null && ` • từ ${c.min_rating} Elo`}
                  {c.max_rating != null && ` • đến ${c.max_rating} Elo`}
                </div>
                {['REGISTRATION', 'CODING'].includes(c.status) && (
                  <button
                    onClick={() => handleRegister(c.slug)}
                    className="px-3 py-1.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition"
                  >
                    Đăng ký thi
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hàng chờ kiểm duyệt mù (chỉ hiện khi có bài giao cho tôi) */}
      <TestingQueue />

      {/* Problems Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Danh sách bài tập của vòng thi</h2>
            <p className="text-xs text-slate-400">Chọn một bài để mở không gian làm bài</p>
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
                <th className="py-3 px-4">Tên bài toán</th>
                <th className="py-3 px-4 w-28">Độ khó</th>
                <th className="py-3 px-4 w-32">Điểm tối đa</th>
                <th className="py-3 px-4 w-32">Điểm hiện tại</th>
                <th className="py-3 px-4 w-28 text-center">Đã giải</th>
                <th className="py-3 px-4 w-28 text-right">Thao tác</th>
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

      {/* Virtual Contest (Archive) */}
      {virtualSupported && (
        <div className="p-6 rounded-2xl bg-[#0e1424] border border-cyan-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-bold text-white">DEVER Round #0 (Archive) — Thi đấu ảo</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">Ghost Replay</span>
            </div>
            <p className="text-xs text-slate-400">
              {virtual
                ? `Phiên ${virtual.session_id} • đã trôi qua ${virtual.elapsedMinutes}′ • ${virtual.standings?.length || 0} ghost trên bảng. Mở bài bất kỳ để làm song song.`
                : 'Thi lại contest đã kết thúc với đồng hồ cá nhân, ghost submissions hiện đúng timeline lịch sử.'}
            </p>
          </div>
          <button
            onClick={startVirtual}
            disabled={virtualLoading}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shrink-0 disabled:opacity-50"
          >
            {virtualLoading ? 'Đang tạo phiên...' : virtual ? 'Tạo phiên mới' : 'Bắt đầu thi ảo'}
          </button>
        </div>
      )}

    </div>
  );
};
