import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useContest } from '../../context/ContestContext';
import { MathRenderer } from '../common/MathRenderer';
import { api } from '../../lib/apiClient';
import { generateSuite } from '../../engine/testGenerator';

/** Tiêu đề chuẩn cho mỗi module quản trị: eyebrow + tên + mô tả một dòng. */
const AdminSection = ({ eyebrow, title, desc }) => (
  <div>
    <div className="text-[10px] font-semibold tracking-widest text-[#62666d] uppercase mb-1">{eyebrow}</div>
    <h2 className="text-lg font-semibold text-[#f7f8f8] tracking-tight">{title}</h2>
    {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
  </div>
);

/** Panel stress test Polygon: sinh bộ test seeded → chạy model vs brute → gợi ý TL → lưu pretests. */
const StressPanel = ({ problems, notify, refresh }) => {
  const [language, setLanguage] = useState('python');
  const [model, setModel] = useState('');
  const [brute, setBrute] = useState('');
  const [count, setCount] = useState(12);
  const [seed, setSeed] = useState('round-1');
  const [maxN, setMaxN] = useState(2000);
  const [preview, setPreview] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);

  const doPreview = () => {
    try {
      const suite = generateSuite({ count: Number(count) || 12, seed, maxN: Number(maxN) || 2000 });
      setPreview(suite.map((c) => c.strategy));
    } catch (e) {
      notify?.({ type: 'error', message: e.message });
    }
  };
  const doStress = async () => {
    if (!model.trim() || !brute.trim()) {
      notify?.({ type: 'error', message: 'Nhập cả lời giải model và brute-force.' }); return;
    }
    setRunning(true); setResult(null);
    try {
      const r = await api.stressRun({
        language, model_source: model, brute_source: brute,
        count: Number(count) || 12, seed,
        rules: { maxN: Number(maxN) || 2000 },
      });
      setResult(r);
    } catch (e) {
      notify?.({ type: 'error', message: e?.message || 'Stress thất bại.' });
    } finally {
      setRunning(false);
    }
  };
  const applyTL = async () => {
    if (!targetId || !result) return;
    try {
      await api.updateProblem(targetId, { timeLimit: `${result.suggestedTimeLimitS.toFixed(1)}s` });
      notify?.(`Đã đặt time limit ${result.suggestedTimeLimitS.toFixed(1)}s cho đề.`);
      refresh?.();
    } catch (e) {
      notify?.({ type: 'error', message: e?.message || 'Không đặt được time limit.' });
    }
  };
  const saveTests = async () => {
    if (!targetId || !result?.outputs?.length) return;
    setSaving(true);
    try {
      let ok = 0;
      for (const o of result.outputs) {
        await api.saveTestcase({ problem_id: targetId, stdin: o.stdin, expected_stdout: o.expected_stdout, strategy: o.strategy });
        ok++;
      }
      notify?.(`Đã lưu ${ok} test vào bộ test chấm (đáp án từ brute-force).`);
    } catch (e) {
      notify?.({ type: 'error', message: e?.message || 'Lưu test thất bại.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-widest text-[#62666d] uppercase mb-1">Polygon · Stress</div>
        <h3 className="text-sm font-bold text-white">Stress test model vs brute-force</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Cùng bộ test seeded (luôn có bẫy N min/max, tràn số). Lệch nhau là FAIL. Kèm gợi ý time limit = 2× model chậm nhất.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <textarea value={model} onChange={(e) => setModel(e.target.value)} rows={6} spellCheck="false"
          placeholder="Lời giải model (tối ưu) — Python/JS"
          className="w-full p-3 rounded-lg bg-[#141516] border border-[#23252a] text-slate-200 font-mono text-xs outline-none resize-none" />
        <textarea value={brute} onChange={(e) => setBrute(e.target.value)} rows={6} spellCheck="false"
          placeholder="Lời giải brute-force (trâu, đúng với N nhỏ)"
          className="w-full p-3 rounded-lg bg-[#141516] border border-[#23252a] text-slate-200 font-mono text-xs outline-none resize-none" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white outline-none">
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
        </select>
        <label className="text-slate-400">Số test <input value={count} onChange={(e) => setCount(e.target.value)} type="number" min="5" max="30"
          className="w-16 ml-1 px-2 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white outline-none" /></label>
        <label className="text-slate-400">Seed <input value={seed} onChange={(e) => setSeed(e.target.value)}
          className="w-28 ml-1 px-2 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white outline-none" /></label>
        <label className="text-slate-400">N max <input value={maxN} onChange={(e) => setMaxN(e.target.value)} type="number" min="10"
          className="w-24 ml-1 px-2 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white outline-none" /></label>
        <button onClick={doPreview} className="px-3 py-2 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#23252a] text-slate-300">
          Xem trước bộ test
        </button>
        <button onClick={doStress} disabled={running}
          className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium disabled:opacity-50">
          {running ? 'Đang stress...' : 'Chạy stress'}
        </button>
      </div>
      {preview && (
        <div className="flex flex-wrap gap-1.5">
          {preview.map((s, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-400 font-mono border border-white/5">{s}</span>
          ))}
        </div>
      )}
      {result && (
        <div className="p-4 rounded-lg bg-[#010102] border border-[#23252a] space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${result.verdict === 'PASS'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {result.verdict} — {result.passed}/{result.ran} khớp
            </span>
            <span className="text-slate-400 font-mono">model chậm nhất {result.modelMaxMs}ms → gợi ý TL {result.suggestedTimeLimitS}s</span>
          </div>
          {result.mismatches?.length > 0 && (
            <div className="space-y-2">
              {result.mismatches.map((m, i) => (
                <details key={i} className="p-2 rounded bg-red-500/5 border border-red-500/20">
                  <summary className="cursor-pointer text-red-300 font-mono text-[11px]">{m.strategy} — model:{m.model_verdict} brute:{m.brute_verdict}</summary>
                  <pre className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap font-mono">in: {m.stdin.slice(0, 300)}{m.stdin.length > 300 ? '…' : ''}{'\n'}model: {(m.model_stdout || '').slice(0, 200)}{'\n'}brute: {(m.brute_stdout || '').slice(0, 200)}</pre>
                </details>
              ))}
            </div>
          )}
          {result.verdict === 'PASS' && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white outline-none">
                <option value="">— Chọn đề để áp dụng —</option>
                {(problems || []).map((p) => (<option key={p.id} value={p.id}>{p.code} · {p.title}</option>))}
              </select>
              <button onClick={applyTL} disabled={!targetId} className="px-3 py-2 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#23252a] text-slate-200 disabled:opacity-50">
                Áp dụng time limit
              </button>
              <button onClick={saveTests} disabled={!targetId || saving} className="px-3 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium disabled:opacity-50">
                {saving ? 'Đang lưu...' : `Lưu ${result.outputs.length} test vào bộ test chấm`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Badge trạng thái kiểm duyệt mù của đề. */
const WorkflowBadge = ({ status }) => {  const s = status || 'DRAFT';
  const cls = s === 'APPROVED'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : s === 'IN_TESTING'
      ? 'bg-[#ff6600]/10 text-[#ff6600] border-[#ff6600]/30'
      : 'bg-white/5 text-slate-400 border-white/10';
  const label = s === 'APPROVED' ? 'Đã duyệt' : s === 'IN_TESTING' ? 'Đang kiểm duyệt' : 'Nháp';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  );
};

/** Dashboard tổng quan: phase hiện tại + số contests/problems/submissions + shortcuts. */
const OverviewPanel = ({ phase, onJump }) => {
  const [loading, setLoading] = useState(true);
  const [contestTitle, setContestTitle] = useState('');
  const [stats, setStats] = useState({ contests: 0, problems: 0, submissions: 0, accepted: 0, participants: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cData = await api.getContests();
        const contests = Array.isArray(cData?.contests) ? cData.contests : [];
        const main = contests.find((c) => c.id === 'contest_dever_round1') || contests[0] || null;
        if (!main) { if (!cancelled) setLoading(false); return; }
        if (!cancelled) setContestTitle(main.title || main.slug || main.id);
        const [pData, sData, stData] = await Promise.all([
          api.getProblems({ contest_id: main.id }).catch(() => ({ problems: [] })),
          api.listSubmissions(main.id).catch(() => ({ submissions: [] })),
          main.slug ? api.getStandings(main.slug).catch(() => ({ standings: [] })) : Promise.resolve({ standings: [] }),
        ]);
        if (cancelled) return;
        const subs = sData?.submissions || [];
        setStats({
          contests: contests.length,
          problems: (pData?.problems || []).length,
          submissions: subs.length,
          accepted: subs.filter((s) => s.verdict === 'AC').length,
          participants: (stData?.standings || []).length,
        });
      } catch { /* giữ số 0 khi offline */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    ['Pha hiện tại', String(phase || '—')],
    ['Kỳ thi', String(stats.contests)],
    ['Đề thi', String(stats.problems)],
    ['Bài nộp', String(stats.submissions)],
    ['Accepted', String(stats.accepted)],
    ['Thí sinh', String(stats.participants)],
  ];
  const shortcuts = [
    ['phase', 'Điều khiển phase'],
    ['polygon', 'Soạn đề thi'],
    ['telemetry', 'Giám sát máy chấm'],
    ['anticheat', 'Soát gian lận AST'],
    ['accounts', 'Cấp tài khoản'],
  ];

  return (
    <div className="space-y-6">
      <AdminSection eyebrow="Tổng quan" title="Dashboard điều hành" desc={contestTitle ? `Contest trọng tâm: ${contestTitle}. Số liệu live từ máy chủ.` : 'Số liệu live từ máy chủ (getContests / getProblems / submissions / standings).'} />
      {loading ? (
        <p className="text-xs text-slate-400">Đang tải số liệu tổng quan…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {cards.map(([label, value]) => (
            <div key={label} className="p-4 rounded-xl bg-[#0f1011] border border-[#23252a]">
              <span className="text-[11px] text-slate-400 block">{label}</span>
              <span className="text-lg font-bold text-white font-mono">{value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="p-5 rounded-xl bg-[#0f1011] border border-[#23252a]">
        <h3 className="text-sm font-bold text-white mb-3">Lối tắt tác vụ</h3>
        <div className="flex flex-wrap gap-2">
          {shortcuts.map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => onJump?.(tab)}
              className="px-3 py-2 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#23252a] text-slate-200 text-xs font-medium transition"
            >
              {label} →
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/** CRUD testcase cho đề đang chọn. Sample do server giữ (409 khi xóa). */
const TestcasePanel = ({ problems, notify }) => {
  const [problemId, setProblemId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ stdin: '', expected_stdout: '', strategy: 'manual' });
  const [saving, setSaving] = useState(false);

  const activeId = problemId || (problems?.[0]?.id ?? '');
  useEffect(() => {
    if (!problemId && problems?.length) setProblemId(problems[0].id);
  }, [problems, problemId]);

  const load = async (pid) => {
    const id = pid || activeId;
    if (!id) return;
    setLoading(true); setMsg('');
    try {
      const data = await api.listTestcases(id);
      setRows(data?.testcases || []);
    } catch (e) {
      setMsg(e?.message || 'Không tải được testcase (cần backend + đăng nhập admin).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeId) load(activeId);
  }, [activeId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeId || !form.stdin) {
      setMsg('Chọn đề và nhập stdin trước khi lưu.');
      return;
    }
    setSaving(true); setMsg('');
    try {
      await api.saveTestcase({
        problem_id: activeId,
        stdin: form.stdin,
        expected_stdout: form.expected_stdout,
        strategy: form.strategy.trim() || 'manual',
      });
      setForm({ stdin: '', expected_stdout: '', strategy: 'manual' });
      await load(activeId);
      notify?.('Đã lưu testcase.');
    } catch (err) {
      setMsg(err?.message || 'Lưu testcase thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tc) => {
    if (tc.is_sample) {
      setMsg('Test mẫu sửa qua đề bài (tab Soạn đề), không xóa lẻ — máy chủ trả 409.');
      return;
    }
    if (!window.confirm(`Xóa testcase ${tc.id.slice(0, 12)}…?`)) return;
    try {
      await api.deleteTestcase(tc.id);
      await load(activeId);
    } catch (err) {
      setMsg(err?.message || 'Xóa testcase thất bại.');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-slate-200 font-mono text-xs outline-none';

  return (
    <div className="p-5 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-[#62666d] uppercase mb-1">Polygon · Testcase</div>
          <h3 className="text-sm font-bold text-white">Bộ test chấm của đề đang chọn</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Mọi test đều dùng chấm full-suite. Test mẫu (is_sample) không xóa lẻ.</p>
        </div>
        <select value={activeId} onChange={(e) => setProblemId(e.target.value)} className="px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white text-xs outline-none">
          {(problems || []).map((p) => (<option key={p.id} value={p.id}>{p.code} · {p.title}</option>))}
        </select>
      </div>
      {msg && <div className="p-2.5 rounded-lg bg-white/5 border border-[#23252a] text-[11px] text-slate-300" role="status">{msg}</div>}
      {loading ? (
        <p className="text-xs text-slate-400">Đang tải testcase…</p>
      ) : (
        <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-left text-[11px]">
            <thead className="text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-2 px-3">Testcase</th>
                <th className="py-2 px-3">Strategy</th>
                <th className="py-2 px-3">Sample?</th>
                <th className="py-2 px-3 text-right">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-3 px-3 text-slate-500">Chưa có testcase cho đề này.</td></tr>
              )}
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 px-3 text-slate-300">{t.id.slice(0, 16)}… <span className="text-slate-500">#{t.order_index ?? '-'}</span></td>
                  <td className="py-2 px-3 text-slate-200">{t.strategy || 'manual'}</td>
                  <td className="py-2 px-3 text-slate-400">{t.is_sample ? 'sample' : '—'}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleDelete(t)}
                      disabled={!!t.is_sample}
                      title={t.is_sample ? 'Test mẫu: sửa qua đề bài, không xóa lẻ (409)' : 'Xóa testcase'}
                      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] transition disabled:opacity-40"
                    >
                      {t.is_sample ? 'Khóa' : 'Xóa'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <textarea value={form.stdin} onChange={(e) => setForm((f) => ({ ...f, stdin: e.target.value }))} rows={3} placeholder="stdin (bắt buộc)"
          className={`${inputCls} resize-none`} />
        <textarea value={form.expected_stdout} onChange={(e) => setForm((f) => ({ ...f, expected_stdout: e.target.value }))} rows={3} placeholder="expected_stdout (có thể trống)"
          className={`${inputCls} resize-none`} />
        <div className="flex items-center gap-2">
          <input value={form.strategy} onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))} placeholder="strategy (vd: edge-min, random)"
            className={inputCls} />
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium shrink-0 disabled:opacity-50">
            {saving ? 'Đang lưu…' : 'Thêm test'}
          </button>
        </div>
      </form>
    </div>
  );
};

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

  const [activeTab, setActiveTab] = useState('overview'); // overview | phase | anticheat | polygon | telemetry | accounts

  // Polygon Problem Studio States
  const [polygonView, setPolygonView] = useState('list'); // 'list' | 'editor'
  const [editingId, setEditingId] = useState(null);
  const [polygonNotification, setPolygonNotification] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [targetContestId, setTargetContestId] = useState('contest_dever_round1');
  const [contestOptions, setContestOptions] = useState([]);
  // Thanh gửi duyệt / duyệt đề (blind-tester workflow)
  const [reviewBar, setReviewBar] = useState(null); // { mode:'assign'|'review', problem, users, testerId, decision, note, busy, msg }

  const openAssignBar = async (prob) => {
    setReviewBar({ mode: 'assign', problem: prob, users: [], testerId: '', note: '', busy: true, msg: '' });
    try {
      const data = await api.listUsers();
      const users = (data?.users || []).filter((u) => u.role !== 'ADMIN');
      setReviewBar((v) => v && ({ ...v, users, busy: false }));
    } catch (e) {
      setReviewBar((v) => v && ({ ...v, busy: false, msg: e?.message || 'Không tải được danh sách.' }));
    }
  };
  const openReviewBar = (prob, decision) => {
    setReviewBar({ mode: 'review', problem: prob, users: [], testerId: '', decision, note: '', busy: false, msg: '' });
  };
  const confirmReviewBar = async () => {
    if (!reviewBar || reviewBar.busy) return;
    setReviewBar((v) => ({ ...v, busy: true, msg: '' }));
    try {
      if (reviewBar.mode === 'assign') {
        if (!reviewBar.testerId) throw new Error('Chọn tester.');
        await api.submitTesting(reviewBar.problem.id, reviewBar.testerId);
        setPolygonNotification(`Đã gửi bài ${reviewBar.problem.code} cho tester kiểm duyệt mù.`);
      } else {
        await api.reviewProblem(reviewBar.problem.id, reviewBar.decision, reviewBar.note);
        setPolygonNotification(reviewBar.decision === 'APPROVED'
          ? `Đã duyệt bài ${reviewBar.problem.code}.`
          : `Đã trả bài ${reviewBar.problem.code} về nháp.`);
      }
      await loadProblemsFromServer();
      setReviewBar(null);
      setTimeout(() => setPolygonNotification(null), 5000);
    } catch (e) {
      setReviewBar((v) => v && ({ ...v, busy: false, msg: e?.message || 'Thất bại.' }));
    }
  };

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
    }, [activeTab]);
  const [adminNotice, setAdminNotice] = useState('');

  const [formData, setFormData] = useState({
    code: 'F',
    title: '',
    rating: 1200,
    tags: 'math, data-structures',
    timeLimit: '1.0s',
    memoryLimit: '256 MB',
    minN: 1,
    maxN: 200000,
    minVal: -1000000000,
    maxVal: 1000000000,
    statement: `Cho số nguyên $N$ ($1 \\le N \\le 10^5$). Tính giá trị:\n$$S = \\sum_{i=1}^N (i^2 + 2i)$$\nIn ra kết quả theo modulo $10^9 + 7$.`,
    sampleInput: '3',
    sampleOutput: '26',
    editorial: `### Hướng dẫn giải:\nÁp dụng công thức tổng bình phương:\n$$\\sum_{i=1}^N i^2 = \\frac{N(N+1)(2N+1)}{6}$$`
  });
  const [touched, setTouched] = useState({});
  const [submitTried, setSubmitTried] = useState(false);
  const markTouched = (k) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const fieldError = (k) => {
    if (k === 'code' && !String(formData.code || '').trim()) return 'Nhập mã bài (vd: A, B, C).';
    if (k === 'title' && !String(formData.title || '').trim()) return 'Nhập tên bài toán.';
    if (k === 'rating') {
      const v = Number(formData.rating);
      if (!Number.isFinite(v) || v < 500 || v > 3500) return 'Điểm cơ sở 500–3500.';
    }
    if (k === 'statement' && !String(formData.statement || '').trim()) return 'Nhập nội dung đề bài.';
    return '';
  };
  const showError = (k) => (touched[k] || submitTried) && !!fieldError(k);
  const errCls = 'mt-1 text-[11px] text-red-400 font-medium';

  const handleOpenCreateProblem = () => {
    const nextCode = String.fromCharCode(65 + problems.length);
    setFormData({
      code: nextCode,
      title: '',
      rating: 1200,
      tags: 'math, implementation',
      timeLimit: '1.0s',
      memoryLimit: '256 MB',
      minN: 1,
      maxN: 200000,
      minVal: -1000000000,
      maxVal: 1000000000,
      statement: `Cho dãy gồm $N$ số nguyên $A_1, A_2, \\dots, A_N$.\nTính tổng tất cả các phần tử chẵn trong dãy.`,
      sampleInput: `4\n1 2 3 4`,
      sampleOutput: `6`,
      editorial: `Duyệt tuần tự qua mảng với độ phức tạp $O(N)$.`
    });
    setEditingId(null);
    setTouched({});
    setSubmitTried(false);
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
      minN: prob.minN ?? prob.min_n ?? 1,
      maxN: prob.maxN ?? prob.max_n ?? 200000,
      minVal: prob.minVal ?? prob.min_val ?? -1000000000,
      maxVal: prob.maxVal ?? prob.max_val ?? 1000000000,
      statement: prob.statement || '',
      sampleInput: prob.sampleInput || '',
      sampleOutput: prob.sampleOutput || '',
      editorial: prob.editorial || ''
    });
    setEditingId(prob.id);
    setTouched({});
    setSubmitTried(false);
    setPolygonView('editor');
  };

  const handleSaveProblem = async (e) => {
    e.preventDefault();
    setSubmitTried(true);
    setTouched({ code: true, title: true, rating: true, statement: true });
    const inlineErrors = ['code', 'title', 'rating', 'statement']
      .map((k) => {
        if (k === 'code' && !String(formData.code || '').trim()) return 'Nhập mã bài (vd: A, B, C).';
        if (k === 'title' && !String(formData.title || '').trim()) return 'Nhập tên bài toán.';
        if (k === 'rating') {
          const v = Number(formData.rating);
          if (!Number.isFinite(v) || v < 500 || v > 3500) return 'Điểm cơ sở 500–3500.';
        }
        if (k === 'statement' && !String(formData.statement || '').trim()) return 'Nhập nội dung đề bài.';
        return '';
      })
      .filter(Boolean);
    if (inlineErrors.length > 0) {
      setPolygonNotification({ type: 'error', message: inlineErrors[0] });
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
      minN: Number(formData.minN) || 0,
      maxN: Number(formData.maxN) || 0,
      minVal: Number(formData.minVal) || 0,
      maxVal: Number(formData.maxVal) || 0,
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
      <div className="min-h-screen flex items-center justify-center bg-[#010102] p-4 text-center">
        <div className="max-w-md p-8 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-4">
          <h2 className="text-xl font-semibold text-[#f7f8f8] tracking-tight">Khu vực hạn chế quản trị</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Khu vực này chỉ dành cho ban tổ chức và ban giám khảo CLB FU-DEVER.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => navigate('/login?redirect=/admin')}
              className="w-full py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium text-xs transition"
            >
              Đăng nhập tài khoản giám khảo
            </button>
            <button
              onClick={() => navigate('/arena')}
              className="w-full py-2 rounded-lg bg-[#141516] hover:bg-[#18191a] text-slate-300 font-medium text-xs transition border border-[#23252a]"
            >
              Quay lại đấu trường thí sinh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010102] text-slate-100 flex flex-col lg:flex-row font-sans">
      
      {/* ======================================================== */}
      {/* DEDICATED ADMIN SIDEBAR                                  */}
      {/* ======================================================== */}
      <aside className="w-full lg:w-64 bg-[#0f1011] border-r border-[#23252a] flex flex-col shrink-0 select-none">

        {/* Admin Header / Brand */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#23252a] bg-[#0f1011]">
          <div className="flex items-center gap-2">
            <img src="/brand/icon-192.png" alt="DEVER Arena" className="w-8 h-8 rounded-lg ring-1 ring-[#34343a]" />
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                DEVER<span className="text-[#ff6600]">ADMIN</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono block leading-none">Ban giám khảo</span>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#141516] text-[#8a8f98] border border-[#34343a] uppercase">
            Root
          </span>
        </div>

        {/* Contest Info Ticker */}
        <div className="p-3 bg-[#010102] border-b border-[#23252a] text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Vòng thi:</span>
            <span className="font-semibold text-slate-200">DEVER Round #1</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Pha:</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {phase}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono">
            <span className="text-[11px] text-slate-400">Thời gian:</span>
            <span className="text-[#ff6600] font-bold">{formattedTime}</span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto text-xs">
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-[#62666d] uppercase">
            Quản trị
          </div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'overview'
                ? 'bg-[#141516] text-white border border-[#34343a]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            0. Tổng quan
          </button>

          <button
            onClick={() => setActiveTab('phase')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'phase'
                ? 'bg-[#141516] text-white border border-[#34343a]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            1. Điều khiển phase
          </button>

          <button
            onClick={() => setActiveTab('anticheat')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'anticheat'
                ? 'bg-[#141516] text-white border border-[#34343a]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            2. Soát gian lận AST
          </button>

          <button
            onClick={() => setActiveTab('polygon')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'polygon'
                ? 'bg-[#141516] text-white border border-[#34343a]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            3. Soạn đề thi
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'telemetry'
                ? 'bg-[#141516] text-white border border-[#34343a]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            4. Giám sát máy chấm
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`w-full px-3 py-2.5 rounded-lg font-semibold transition text-left ${
              activeTab === 'accounts'
                ? 'bg-[#141516] text-white border border-[#34343a]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            5. Cấp tài khoản
          </button>
        </nav>

        {/* Sidebar Footer: Switch to Contestant View & Logout */}
        <div className="p-3 border-t border-[#23252a] bg-[#0f1011] space-y-2 text-xs">
          {/* Switch to Contestant Mode Button */}
          <Link
            to="/arena"
            className="w-full py-2 px-3 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#23252a] text-slate-300 hover:text-white font-medium transition group"
          >
            Xem góc nhìn thí sinh →
          </Link>

          {/* Admin Profile & Logout */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-7 h-7 rounded-full border border-[#34343a] bg-slate-800"
              />
              <div className="text-left leading-none">
                <span className="font-bold text-white text-xs block">{user.username}</span>
                <span className="text-[10px] text-[#ff6600] font-mono">Giám khảo</span>
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
      <main className="flex-1 flex flex-col bg-[#010102] overflow-y-auto">

        {/* Admin Topbar */}
        <header className="h-14 bg-[#010102] border-b border-[#23252a] px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-[#f7f8f8] tracking-tight">
              <span>Bảng điều hành ban giám khảo</span>
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => toggleFrozen()}
              className={`px-3 py-1.5 rounded-lg border font-medium transition ${
                frozen
                  ? 'bg-[#ff6600]/10 text-[#ff6600] border-[#ff6600]/30'
                  : 'bg-[#141516] text-slate-300 border-[#23252a] hover:bg-[#18191a]'
              }`}
            >
              {frozen ? 'Đang đóng băng bảng điểm' : 'Đóng băng bảng điểm'}
            </button>

            <button
              onClick={() => setAdminNotice('Chức năng thông báo khẩn chưa được kết nối tới máy chủ.')}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition"
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
          
          {/* TAB 0: OVERVIEW DASHBOARD */}
          {activeTab === 'overview' && (
            <OverviewPanel phase={phase} onJump={setActiveTab} />
          )}

          {/* TAB 1: PHASE ORCHESTRATOR */}
          {activeTab === 'phase' && (
            <div className="space-y-6">
              <AdminSection eyebrow="Điều hành" title="Điều khiển tiến trình kỳ thi" desc="Mở kỳ thi, chuyển phase — đồng bộ tới tab thí sinh qua backend." />
              <CreateContestPanel />
              <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className={`p-4 rounded-xl border transition ${phase === 'REGISTRATION' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-emerald-400 mb-1">1. Registration</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Mở đăng ký, thí sinh vào danh sách trước giờ thi.</p>
                    <button
                      onClick={() => handlePhaseChange('REGISTRATION')}
                      className="w-full py-2 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#34343a] text-emerald-400 font-medium text-xs transition"
                    >
                      Đang mở đăng ký
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border transition ${phase === 'CODING' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-emerald-400 mb-1">2. Coding Phase (120')</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Mở nộp bài, chấm full-suite trả verdict cuối, khóa xem code đối thủ.</p>
                    <button
                      onClick={() => handlePhaseChange('CODING')}
                      className="w-full py-2 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#34343a] text-emerald-400 font-medium text-xs transition"
                    >
                      Kích Hoạt CODING
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border transition ${phase === 'FINISHED' ? 'bg-white/5 border-[#34343a]' : 'bg-white/5 border-white/10'}`}>
                    <h4 className="text-xs font-bold text-[#8a8f98] mb-1">3. Finished (Rating)</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Đóng giải, mở editorial, tính toán cập nhật Elo 7 bậc.</p>
                    <button
                      onClick={() => handlePhaseChange('FINISHED')}
                      className="w-full py-2 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#34343a] text-slate-200 font-medium text-xs transition"
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
            <div className="space-y-6">
              <AdminSection eyebrow="Liêm chính" title="Soát gian lận mã nguồn" desc="Quét AST toàn contest, gắn cờ khi tương đồng vượt ngưỡng." />
            <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-4">
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
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition shrink-0"
                >
                  Truất quyền thi đấu
                </button>
              </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#0f1011] border border-[#23252a]">
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
                        className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium text-xs transition"
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
                  {/* Thanh gửi duyệt / duyệt đề (blind-tester) */}
                  {reviewBar && (
                    <div className="p-4 rounded-xl bg-[#0f1011] border border-[#34343a] flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                      <span className="font-bold text-white shrink-0">
                        {reviewBar.mode === 'assign'
                          ? `Gửi bài ${reviewBar.problem.code} kiểm duyệt mù:`
                          : `${reviewBar.decision === 'APPROVED' ? 'Duyệt' : 'Từ chối'} bài ${reviewBar.problem.code}:`}
                      </span>
                      {reviewBar.mode === 'assign' ? (
                        <select
                          value={reviewBar.testerId}
                          onChange={(e) => setReviewBar((v) => ({ ...v, testerId: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white outline-none"
                        >
                          <option value="">— Chọn tester (không phải tác giả) —</option>
                          {reviewBar.users.map((u) => (
                            <option key={u.id} value={u.id}>{u.username} ({u.rating} Elo)</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={reviewBar.note}
                          onChange={(e) => setReviewBar((v) => ({ ...v, note: e.target.value }))}
                          placeholder="Ghi chú duyệt (tùy chọn)"
                          className="flex-1 px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white placeholder-slate-500 outline-none"
                        />
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={confirmReviewBar}
                          disabled={reviewBar.busy}
                          className="px-3 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium disabled:opacity-50"
                        >
                          {reviewBar.busy ? 'Đang gửi...' : 'Xác nhận'}
                        </button>
                        <button
                          onClick={() => setReviewBar(null)}
                          className="px-3 py-2 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#23252a] text-slate-300"
                        >
                          Hủy
                        </button>
                      </div>
                      {reviewBar.msg && <span className="text-red-400">{reviewBar.msg}</span>}
                    </div>
                  )}
                  {/* Table */}
                  <div className="bg-[#0f1011] border border-[#23252a] rounded-xl overflow-hidden">
                    <div className="h-10 bg-[#141516] px-4 flex items-center justify-between border-b border-white/10 text-xs">
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
                              <WorkflowBadge status={prob.workflow_status} />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {(!prob.workflow_status || prob.workflow_status === 'DRAFT') && (
                                  <button
                                    onClick={() => openAssignBar(prob)}
                                    className="px-2 py-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-[#ff6600] transition text-[11px]"
                                    title="Gửi tester kiểm duyệt mù"
                                  >
                                    Gửi duyệt
                                  </button>
                                )}
                                {prob.workflow_status === 'IN_TESTING' && (
                                  <>
                                    <button
                                      onClick={() => openReviewBar(prob, 'APPROVED')}
                                      className="px-2 py-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition text-[11px]"
                                      title="Duyệt đề"
                                    >
                                      Duyệt
                                    </button>
                                    <button
                                      onClick={() => openReviewBar(prob, 'REJECTED')}
                                      className="px-2 py-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition text-[11px]"
                                      title="Trả về nháp"
                                    >
                                      Từ chối
                                    </button>
                                  </>
                                )}
                                <Link
                                  to={`/problem/${prob.id}`}
                                  className="px-2 py-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition text-[11px]"
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

                  {/* Stress test: model vs brute + gợi ý TL + lưu pretests */}
                  <StressPanel
                    problems={problems}
                    notify={(m) => { setPolygonNotification(m); setTimeout(() => setPolygonNotification(null), 5000); }}
                    refresh={loadProblemsFromServer}
                  />

                  {/* CRUD pretests/system tests cho đề đang chọn */}
                  <TestcasePanel
                    problems={problems}
                    notify={(m) => { setPolygonNotification(m); setTimeout(() => setPolygonNotification(null), 5000); }}
                  />
                </div>
              )}

              {/* VIEW 2: FULL PROBLEMSETTER FORM WITH LATEX LIVE PREVIEW */}
              {polygonView === 'editor' && (
                <form onSubmit={handleSaveProblem} className="space-y-6">
                  
                  {/* Basic Metadata */}
                  <div className="p-5 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-4">
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
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-white text-xs font-semibold focus:border-[#ff6600] outline-none"
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
                          onBlur={() => markTouched('code')}
                          aria-invalid={showError('code')}
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-white font-mono font-bold text-sm text-center focus:border-[#ff6600] outline-none"
                          placeholder="F"
                        />
                        {showError('code') && <p className={errCls} role="alert">{fieldError('code')}</p>}
                      </div>

                      {/* Title */}
                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-slate-300 mb-1">Tên bài toán:</label>
                        <input
                          type="text"
                          required
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          onBlur={() => markTouched('title')}
                          aria-invalid={showError('title')}
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-white text-xs font-semibold focus:border-[#ff6600] outline-none"
                          placeholder="Ví dụ: Da Nang Bridge Network Maximum Flow"
                        />
                        {showError('title') && <p className={errCls} role="alert">{fieldError('title')}</p>}
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
                          onBlur={() => markTouched('rating')}
                          aria-invalid={showError('rating')}
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono font-bold text-xs focus:border-[#ff6600] outline-none"
                        />
                        {showError('rating') && <p className={errCls} role="alert">{fieldError('rating')}</p>}
                      </div>

                      {/* Tags */}
                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-slate-300 mb-1">Thẻ phân loại (cách nhau bằng dấu phẩy):</label>
                        <input
                          type="text"
                          value={formData.tags}
                          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
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
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
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
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="256 MB"
                        />
                      </div>

                      {/* Ràng buộc sinh test (server hỗ trợ sau, cứ gửi kèm) */}
                      <div className="sm:col-span-1.5">
                        <label className="block font-semibold text-slate-300 mb-1">N tối thiểu:</label>
                        <input
                          type="number"
                          value={formData.minN}
                          onChange={(e) => setFormData({ ...formData, minN: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-1.5">
                        <label className="block font-semibold text-slate-300 mb-1">N tối đa:</label>
                        <input
                          type="number"
                          value={formData.maxN}
                          onChange={(e) => setFormData({ ...formData, maxN: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-1.5">
                        <label className="block font-semibold text-slate-300 mb-1">Giá trị tối thiểu:</label>
                        <input
                          type="number"
                          value={formData.minVal}
                          onChange={(e) => setFormData({ ...formData, minVal: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-1.5">
                        <label className="block font-semibold text-slate-300 mb-1">Giá trị tối đa:</label>
                        <input
                          type="number"
                          value={formData.maxVal}
                          onChange={(e) => setFormData({ ...formData, maxVal: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Statement Editor with Live KaTeX Preview */}
                  <div className="p-5 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-3">
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
                          onBlur={() => markTouched('statement')}
                          aria-invalid={showError('statement')}
                          className="w-full p-3 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs leading-relaxed focus:border-[#ff6600] outline-none"
                          placeholder="Mô tả đề bài. Dùng $N$ cho công thức trong dòng, $$...$$ cho công thức khối."
                        />
                        {showError('statement') && <p className={errCls} role="alert">{fieldError('statement')}</p>}
                      </div>

                      {/* Right: Live KaTeX Math Preview */}
                      <div className="flex flex-col space-y-1">
                        <span className="text-[11px] font-semibold text-emerald-400">Xem trước:</span>
                        <div className="p-4 rounded-lg bg-[#141516] border border-white/10 min-h-[160px] max-h-[260px] overflow-y-auto">
                          <MathRenderer content={formData.statement || 'Chưa có nội dung đề bài...'} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sample Testcases */}
                  <div className="p-5 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-3">
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
                          className="w-full p-2.5 rounded-lg bg-[#141516] border border-white/15 text-emerald-400 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="3\n1 2 3"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Output mẫu:</label>
                        <textarea
                          rows={3}
                          value={formData.sampleOutput}
                          onChange={(e) => setFormData({ ...formData, sampleOutput: e.target.value })}
                          className="w-full p-2.5 rounded-lg bg-[#141516] border border-white/15 text-orange-400 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="6"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Editorial */}
                  <div className="p-5 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-3">
                    <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                      4. Lời giải
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                      <div className="flex flex-col space-y-1">
                        <textarea
                          rows={5}
                          value={formData.editorial}
                          onChange={(e) => setFormData({ ...formData, editorial: e.target.value })}
                          className="w-full p-3 rounded-lg bg-[#141516] border border-white/15 text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none"
                          placeholder="Hướng dẫn giải và phân tích độ phức tạp..."
                        />
                      </div>

                      <div className="p-3 rounded-lg bg-[#141516] border border-white/10 max-h-[140px] overflow-y-auto">
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
                      className="px-6 py-2.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium text-xs transition"
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
            <div className="space-y-6">
              <AdminSection eyebrow="Vận hành" title="Giám sát máy chấm" desc="Hàng đợi judge, worker và bài nộp theo thời gian thực." />
              <TelemetryPanel />
            </div>
          )}

          {/* TAB 5: ACCOUNTS */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <AdminSection eyebrow="Tài khoản" title="Cấp tài khoản" desc="Tạo và reset tài khoản cá nhân, đội thi — không đăng ký công khai." />
              <AccountsPanel />
            </div>
          )}

        </div>

      </main>

    </div>
  );
};

/** Tạo kỳ thi mới (mở đăng ký REGISTRATION, admin gán đề sau). */
const CreateContestPanel = () => {
  const [form, setForm] = useState({ title: '', format: 'ICPC', start: '', duration: 135, minRating: '', maxRating: '' });
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
      setForm({ title: '', format: 'ICPC', start: '', duration: 135, minRating: '', maxRating: '' });
    } catch (err) {
      setMsg(err?.message || 'Tạo kỳ thi thất bại.');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-slate-500 outline-none focus:border-[#ff6600]';

  return (
    <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">Mở kỳ thi mới</h2>
        <p className="text-xs text-slate-400 mt-0.5">Kỳ thi tạo ra ở trạng thái mở đăng ký. Đề thi gán sau ở tab Soạn đề.</p>
      </div>
      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <input className={inputCls} placeholder="Tên kỳ thi (vd: DEVER Round #3)" value={form.title} onChange={set('title')} required />
        <select className={inputCls} value={form.format} onChange={set('format')}>
          <option value="CODEFORCES">Codeforces (điểm giảm theo phút làm bài)</option>
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

/** Số liệu máy chấm thật từ API (số bài nộp theo verdict, số thí sinh). Chọn contest qua dropdown. */
const TelemetryPanel = () => {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [confirmRejudgeId, setConfirmRejudgeId] = useState(null);
  const [notice, setNotice] = useState('');
  const [contests, setContests] = useState([]);
  const [contestId, setContestId] = useState('contest_dever_round1');

  const load = async (cid) => {
    const id = cid || contestId;
    try {
      const contest = contests.find((c) => c.id === id);
      const slug = contest?.slug || (id === 'contest_dever_round1' ? 'dever-round-1-div3' : null);
      const [subs, st] = await Promise.all([
        api.listSubmissions(id),
        slug ? api.getStandings(slug) : Promise.resolve({ standings: [] }),
      ]);
      const byVerdict = {};
      (subs.submissions || []).forEach((s) => { byVerdict[s.verdict] = (byVerdict[s.verdict] || 0) + 1; });
      setStats({ total: (subs.submissions || []).length, byVerdict, participants: (st.standings || []).length });
      setRecent((subs.submissions || []).slice(0, 20));
    } catch { /* giữ null */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getContests();
        if (cancelled) return;
        const list = Array.isArray(data?.contests) ? data.contests : [];
        setContests(list);
        if (list.length && !list.some((c) => c.id === contestId)) setContestId(list[0].id);
      } catch { /* giữ mặc định khi offline */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(contestId); })();
    return () => { cancelled = true; };
  }, [contestId, contests.length]);

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
      load(contestId);
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
        ['Thí sinh', String(stats.participants)],
      ]
    : [];

  return (
    <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-bold text-white">Giám sát máy chấm</h2>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Kỳ thi:
          <select
            value={contestId}
            onChange={(e) => setContestId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white outline-none"
          >
            {contests.length === 0 && <option value={contestId}>DEVER Round #1 (mặc định)</option>}
            {contests.map((c) => (
              <option key={c.id} value={c.id}>{c.title || c.slug || c.id} ({c.status})</option>
            ))}
          </select>
        </label>
      </div>
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
    <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-5">
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
          <thead className="bg-[#141516] border-b border-white/10 text-slate-400 uppercase tracking-wider text-[11px]">
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
