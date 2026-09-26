import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { PROBLEMS_DB } from '../data/problems.js';
import { useAuth } from '../context/AuthContext';
import { useContest } from '../context/ContestContext';
import { MathRenderer } from '../components/common/MathRenderer';
import { executeCodeInBrowser } from '../engine/runner.js';
import { compareOutputs } from '../engine/isolateRunner.js';
import { api, getToken } from '../lib/apiClient';

const STARTER_CODE = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Viết giải thuật của bạn tại đây
    int n;
    if (cin >> n) {
        cout << n << "\\n";
    }
    return 0;
}
`,
  python: `import sys

def solve():
    # Viết giải thuật của bạn tại đây
    line = sys.stdin.readline().strip()
    if line:
        print(line)

if __name__ == '__main__':
    solve()
`,
  java: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNext()) {
            System.out.println(sc.next());
        }
    }
}
`,
  javascript: `const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    // Viết giải thuật của bạn tại đây
    console.log(line);
});
`
};

export const ProblemWorkspace = () => {
  const { id = 'p102' } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { getDynamicScore, formattedTime, problems = [], contestId, contestSlug } = useContest();
  const [editorialOpen, setEditorialOpen] = useState(false);

  // Lời giải chỉ mở khi vòng thi đã kết thúc (mặc định khóa để chống lộ đề)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getContest(contestSlug);
        if (!cancelled && data?.contest?.status === 'FINISHED') setEditorialOpen(true);
      } catch { /* giữ khóa */ }
    })();
    return () => { cancelled = true; };
  }, [contestSlug]);

  // Find problem or fallback to p102
  const currentProblem = problems.find((p) => p.id === id) || problems[0] || PROBLEMS_DB[1];
  const problemIndex = problems.findIndex((p) => p.id === currentProblem.id);
  const prevProblem = problemIndex > 0 ? problems[problemIndex - 1] : null;
  const nextProblem = problemIndex < problems.length - 1 ? problems[problemIndex + 1] : null;

  // Workspace UI State
  const [activeTab, setActiveTab] = useState('statement'); // statement | editorial | submissions | discussion
  const [language, setLanguage] = useState('cpp');
  const [fontSize, setFontSize] = useState(14);
  const [copied, setCopied] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('Đã lưu');

  // =====================================================================
  // ERGONOMIC LAYOUT & SPLITTER STATE (Persisted in LocalStorage)
  // =====================================================================
  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      const saved = localStorage.getItem('dever_workspace_split_ratio');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 20 && val <= 80) return val;
      }
    } catch (e) {}
    return 45; // Default: Statement 45%, Editor 55%
  });

  const [consoleHeight, setConsoleHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('dever_workspace_console_height');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 80 && val <= 520) return val;
      }
    } catch (e) {}
    return 220; // Default console height: 220px
  });

  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [zenMode, setZenMode] = useState('none'); // 'none' | 'split' | 'editor'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showZenMenu, setShowZenMenu] = useState(false);
  const [confirmResetCode, setConfirmResetCode] = useState(false);

  const workspaceRef = useRef(null);
  const rightPaneRef = useRef(null);

  // Code state with localStorage Auto-Save
  const [code, setCode] = useState(() => {
    try {
      const saved = localStorage.getItem(`dever_code_${currentProblem.id}_${language}`);
      if (saved) return saved;
    } catch (e) {}
    return STARTER_CODE[language] || STARTER_CODE.cpp;
  });

  // When problem or language changes, reload corresponding draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`dever_code_${currentProblem.id}_${language}`);
      if (saved) {
        setCode(saved);
      } else {
        setCode(STARTER_CODE[language] || STARTER_CODE.cpp);
      }
    } catch (e) {
      setCode(STARTER_CODE[language] || STARTER_CODE.cpp);
    }
    // Reset console theo bài mới (không giữ testcase/verdict bài cũ)
    setTestCases([
      { id: 1, name: 'Case 1', input: currentProblem.sampleInput || '', expected: currentProblem.sampleOutput || '' },
    ]);
    setActiveCaseIndex(0);
    setRunResult(null);
    setSubmissionVerdict(null);
    setActiveTab('statement');
  }, [currentProblem.id, language]);

  // Auto-Save effect
  const handleCodeChange = (newCode) => {
    const value = newCode || '';
    setCode(value);
    setAutoSaveStatus('Đang lưu...');
    try {
      localStorage.setItem(`dever_code_${currentProblem.id}_${language}`, value);
      setTimeout(() => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setAutoSaveStatus(`Đã lưu lúc ${timeStr}`);
      }, 300);
    } catch (e) {}
  };

  // Testcase Console State
  const [testCases, setTestCases] = useState([
    { id: 1, name: 'Case 1', input: currentProblem.sampleInput || '3\n1 2 3', expected: currentProblem.sampleOutput || '11' },
    { id: 2, name: 'Case 2', input: '4\n2 3 4 5', expected: '71' }
  ]);
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [submissionVerdict, setSubmissionVerdict] = useState(null);
  const [copiedOut, setCopiedOut] = useState(false);
  const [runAll, setRunAll] = useState(null); // { [index]: { ok, ms } }
  const [runAllBusy, setRunAllBusy] = useState(false);
  const [mobilePane, setMobilePane] = useState('code'); // 'problem' | 'code' (mobile <lg)
  const [history, setHistory] = useState(null); // lịch sử nộp bài từ API

  // =====================================================================
  // SPLITTER DRAG HANDLERS WITH SMOOTH MOUSE CAPTURE
  // =====================================================================
  useEffect(() => {
    const handleMouseMove = (e) => {
      // 1. Horizontal Splitter (Statement vs Editor)
      if (isDraggingHorizontal && workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        const clientX = e.clientX;
        const newRatio = ((clientX - rect.left) / rect.width) * 100;
        const clamped = Math.min(Math.max(newRatio, 20), 80);
        setSplitRatio(clamped);
      }

      // 2. Vertical Splitter (Editor vs Console)
      if (isDraggingVertical && rightPaneRef.current) {
        const rect = rightPaneRef.current.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;
        const clamped = Math.min(Math.max(newHeight, 80), 520);
        setConsoleHeight(clamped);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingHorizontal) {
        setIsDraggingHorizontal(false);
        try {
          localStorage.setItem('dever_workspace_split_ratio', splitRatio.toString());
        } catch (e) {}
      }
      if (isDraggingVertical) {
        setIsDraggingVertical(false);
        try {
          localStorage.setItem('dever_workspace_console_height', consoleHeight.toString());
        } catch (e) {}
      }
    };

    if (isDraggingHorizontal || isDraggingVertical) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHorizontal, isDraggingVertical, splitRatio, consoleHeight]);

  // Double-Click Resets
  const handleResetHorizontalSplit = () => {
    setSplitRatio(50);
    try {
      localStorage.setItem('dever_workspace_split_ratio', '50');
    } catch (e) {}
  };

  const handleResetVerticalSplit = () => {
    setConsoleHeight(220);
    setIsConsoleOpen(true);
    try {
      localStorage.setItem('dever_workspace_console_height', '220');
    } catch (e) {}
  };

  // Preset Ratio Applier
  const applyPreset = (ratio) => {
    setSplitRatio(ratio);
    try {
      localStorage.setItem('dever_workspace_split_ratio', ratio.toString());
    } catch (e) {}
  };

  // Keyboard Shortcuts (Ctrl + Enter = Submit, Ctrl + ' = Run Code, Esc = Exit Zen)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        handleRunCode();
      }
      if (e.key === 'Escape') {
        if (zenMode !== 'none') {
          setZenMode('none');
        }
        if (isFullscreen) {
          setIsFullscreen(false);
        }
        setShowZenMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, activeCaseIndex, zenMode, isFullscreen]);

  const handleCopyInput = () => {
    if (currentProblem.sampleInput) {
      navigator.clipboard.writeText(currentProblem.sampleInput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyOutput = () => {
    if (currentProblem.sampleOutput) {
      navigator.clipboard.writeText(currentProblem.sampleOutput);
      setCopiedOut(true);
      setTimeout(() => setCopiedOut(false), 2000);
    }
  };

  // Phân loại verdict chạy thử theo chuẩn CF từ runner engine
  const classifyRun = (res, matched) => {
    const st = String(res.status || '');
    if (st === 'OK' && matched) return { code: 'AC', label: 'Accepted — khớp kết quả' };
    if (st.startsWith('Time Limit')) return { code: 'TLE', label: st };
    if (st.startsWith('Compilation Error')) return { code: 'CE', label: st };
    if (st.startsWith('Security Error')) return { code: 'BLOCKED', label: st };
    if (st.startsWith('Wrong Answer')) return { code: 'WA', label: st };
    if (st === 'OK') return { code: 'WA', label: 'Wrong Answer — output sai khác' };
    return { code: 'RE', label: st || 'Runtime Error' };
  };

  const handleResetCode = () => {
    if (confirmResetCode) {
      const initial = STARTER_CODE[language] || STARTER_CODE.cpp;
      setCode(initial);
      localStorage.setItem(`dever_code_${currentProblem.id}_${language}`, initial);
      setAutoSaveStatus('Đã đặt lại');
      setConfirmResetCode(false);
    } else {
      setConfirmResetCode(true);
      setTimeout(() => setConfirmResetCode(false), 4000);
    }
  };

  const handleAddTestCase = () => {
    const newId = testCases.length + 1;
    const newCase = {
      id: newId,
      name: `Case ${newId}`,
      input: '',
      expected: ''
    };
    setTestCases([...testCases, newCase]);
    setActiveCaseIndex(testCases.length);
  };

  // Run Code: thực thi thật qua runner local (JS chạy thật, các ngôn ngữ khác mô phỏng)
  const handleRunCode = async () => {
    setIsRunning(true);
    setIsConsoleOpen(true);
    if (consoleHeight < 160) setConsoleHeight(220);
    setRunResult(null);

    try {
      const activeCase = testCases[activeCaseIndex];
      const res = await executeCodeInBrowser(language, code, activeCase.input || '');
      const matched = res.status === 'OK' && compareOutputs(res.stdout, activeCase.expected || '');
      const v = classifyRun(res, matched);
      setRunResult({
        status: v.code,
        label: v.label,
        actual: res.stdout || res.status,
        expected: activeCase.expected,
        executionTime: res.executionTimeMs,
        memory: res.memoryKb ? (res.memoryKb / 1024).toFixed(1) : '—',
        input: activeCase.input
      });
    } catch (e) {
      setRunResult({ status: 'RE', label: String(e.message || e), actual: String(e.message || e), expected: testCases[activeCaseIndex]?.expected || '', executionTime: 0, memory: '—', input: '' });
    } finally {
      setIsRunning(false);
    }
  };

  // Run All: chấm hết testcase, báo pass/fail + time từng case
  const handleRunAll = async () => {
    if (runAllBusy) return;
    setRunAllBusy(true);
    setIsConsoleOpen(true);
    const acc = {};
    for (let i = 0; i < testCases.length; i++) {
      try {
        const tc = testCases[i];
        const res = await executeCodeInBrowser(language, code, tc.input || '');
        const matched = res.status === 'OK' && compareOutputs(res.stdout, tc.expected || '');
        acc[i] = { ...classifyRun(res, matched), ms: res.executionTimeMs };
      } catch (e) {
        acc[i] = { code: 'RE', label: String(e.message || e), ms: 0 };
      }
    }
    setRunAll(acc);
    setRunAllBusy(false);
  };

  // Lịch sử nộp bài thật từ API (lọc theo đề đang mở)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getToken() || !contestId) { if (!cancelled) setHistory([]); return; }
        const data = await api.listSubmissions(contestId);
        const rows = (data.submissions || []).filter((s) => s.problem_id === currentProblem.id);
        if (!cancelled) setHistory(rows);
      } catch { if (!cancelled) setHistory([]); }
    })();
    return () => { cancelled = true; };
  }, [currentProblem.id, contestId, submissionVerdict]);

  // Submit Code: chấm thật trên máy chủ (pretest). Rớt mạng → báo rõ, không bịa điểm.
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    setIsSubmitting(true);
    setIsConsoleOpen(true);
    if (consoleHeight < 160) setConsoleHeight(220);
    setSubmissionVerdict(null);

    try {
      if (!getToken()) throw Object.assign(new Error('Phiên đăng nhập local, chưa có token máy chủ. Hãy đăng nhập lại.'), { code: 'NO_TOKEN' });
      const data = await api.createSubmission({
        contest_id: contestId, problem_id: currentProblem.id, language, source_code: code,
      });
      const s = data.submission;
      const passed = data.pretests_passed;
      setSubmissionVerdict({
        ok: passed,
        verdict: passed ? `Qua pretest (+${s.points_awarded}đ)` : `Chưa qua: ${s.verdict}`,
        detail: passed ? `Thời gian ${s.time_ms ?? '—'}ms` : (s.detail || s.verdict),
        points: passed ? s.points_awarded : 0,
      });
      setActiveTab('submissions');
    } catch (err) {
      setSubmissionVerdict({
        ok: false,
        verdict: 'Nộp bài thất bại',
        detail: err?.message || 'Không kết nối được máy chấm. Kiểm tra npm run server.',
        points: 0,
      });
      setActiveTab('submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isZenActive = zenMode !== 'none';
  const isZenEditorOnly = zenMode === 'editor';

  return (
    <div 
      className={`flex flex-col bg-[#010102] text-slate-100 select-none ${
        isZenActive || isFullscreen ? 'fixed inset-0 z-50' : 'h-[calc(100vh-3rem)]'
      }`}
    >
      {/* Invisible drag overlay to prevent Monaco Editor mouse capture while dragging */}
      {(isDraggingHorizontal || isDraggingVertical) && (
        <div 
          className={`fixed inset-0 z-[100] ${
            isDraggingHorizontal ? 'cursor-col-resize' : 'cursor-row-resize'
          }`} 
        />
      )}

      {/* Floating Zen Mode Exit Pill */}
      {isZenActive && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-3 py-1 rounded-full bg-[#141516] border border-[#34343a] text-xs backdrop-blur-md animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#ff6600] animate-pulse"></span>
          <span className="text-slate-200 font-semibold">
            {isZenEditorOnly ? 'Chế độ tập trung: chỉ khung code' : 'Chế độ tập trung: chia đôi'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-[11px] text-slate-400">Nhấn <kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Esc</kbd> để thoát</span>
          <button
            onClick={() => setZenMode('none')}
            className="px-2 py-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition ml-1 text-[11px]"
            title="Thoát chế độ tập trung"
          >
            Thoát
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. PROBLEM HEADER NAVIGATION & ERGONOMIC TOOLBAR         */}
      {/* ======================================================== */}
      <div className="h-10 bg-[#0e1424] border-b border-white/10 px-4 flex items-center justify-between text-xs shrink-0 select-none">
        
        {/* Left: Problem Title & Prev/Next */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => prevProblem && navigate(`/problem/${prevProblem.id}`)}
              disabled={!prevProblem}
              className="px-1.5 py-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition font-mono"
              title="Bài trước"
            >
              ‹
            </button>
            <button
              onClick={() => nextProblem && navigate(`/problem/${nextProblem.id}`)}
              disabled={!nextProblem}
              className="px-1.5 py-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition font-mono"
              title="Bài tiếp theo"
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#ff6600] text-sm">
              Bài {currentProblem.code}:
            </span>
            <span className="font-bold text-white text-sm truncate max-w-[180px] sm:max-w-none">
              {currentProblem.title}
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {currentProblem.rating} Điểm
            </span>
          </div>
        </div>

        {/* Center: Dynamic Decay Points Ticker */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
          <span className="font-bold">+{getDynamicScore(currentProblem.rating || 1000)}đ</span>
          <span className="text-[10px] text-orange-300/70">(giảm theo phút)</span>
        </div>

        {/* Right: ERGONOMIC LAYOUT CONTROLS & ZEN MODE */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          
          {/* Preset Buttons (50:50, 40:60, 60:40) */}
          <div className="hidden lg:flex items-center gap-1 bg-[#010102] p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => applyPreset(50)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                Math.round(splitRatio) === 50
                  ? 'bg-[#ff6600] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Chia đôi màn hình 50:50"
            >
              50:50
            </button>
            <button
              onClick={() => applyPreset(40)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                Math.round(splitRatio) === 40
                  ? 'bg-[#ff6600] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Đề 40% - Code 60%"
            >
              40:60
            </button>
            <button
              onClick={() => applyPreset(60)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                Math.round(splitRatio) === 60
                  ? 'bg-[#ff6600] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Đề 60% - Code 40%"
            >
              60:40
            </button>
          </div>

          {/* Zen Mode Selector */}
          <div className="relative">
            <button
              onClick={() => setShowZenMenu(!showZenMenu)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition ${
                isZenActive
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              title="Chế độ tập trung"
            >
              <span className="hidden sm:inline">Tập trung</span>
              <span className="sm:hidden">TT</span>
            </button>

            {/* Zen Mode Dropdown Menu */}
            {showZenMenu && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-[#0c101d] border border-white/15 shadow-2xl p-1 z-50 text-xs space-y-0.5">
                <button
                  onClick={() => { setZenMode('split'); setShowZenMenu(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 transition"
                >
                  Chia đôi (ẩn navbar){zenMode === 'split' && ' — đang bật'}
                </button>
                <button
                  onClick={() => { setZenMode('editor'); setShowZenMenu(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 transition"
                >
                  Chỉ khung code{zenMode === 'editor' && ' — đang bật'}
                </button>
                {isZenActive && (
                  <button
                    onClick={() => { setZenMode('none'); setShowZenMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 transition border-t border-white/5"
                  >
                    Thoát chế độ tập trung
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-2 py-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition text-[11px]"
            title={isFullscreen ? 'Thoát toàn màn hình (Esc)' : 'Toàn màn hình'}
          >
            {isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
          </button>

          {/* Contest Clock */}
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 pl-2 border-l border-white/10">
            <span className="font-mono text-slate-200 font-medium">{formattedTime}</span>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. RESIZABLE MULTI-PANE WORKSPACE CONTAINER             */}
      {/* ======================================================== */}
        {/* Mobile pane tabs (Đề bài / Code) — desktop dùng split-pane */}
        <div className="lg:hidden flex items-center gap-1 px-3 py-2 border-b border-[#23252a] bg-[#010102] shrink-0">
          {[{ id: 'problem', label: 'Đề bài' }, { id: 'code', label: 'Code & Console' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setMobilePane(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mobilePane === t.id ? 'bg-[#ff6600] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          ref={workspaceRef}
          className="flex-1 flex flex-col lg:flex-row overflow-hidden relative"
        >
        
        {/* ======================================================== */}
        {/* PANE 1: Problem Statement & Tabs (Left)                  */}
        {/* ======================================================== */}
        {!isZenEditorOnly && (
          <div
            style={mobilePane === 'problem' ? { width: '100%' } : { width: `${splitRatio}%` }}
            className={`${mobilePane === 'problem' ? 'flex' : 'hidden'} lg:flex ws-pane flex-col bg-[#010102] border-r border-[#23252a] overflow-hidden shrink-0 max-lg:flex-1`}
          >
            {/* Tabs Header */}
            <div className="h-9 bg-[#141516] border-b border-[#23252a] flex items-center px-2 gap-1 shrink-0 select-none">
              <button
                onClick={() => setActiveTab('statement')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  activeTab === 'statement'
                    ? 'bg-white/10 text-white border-b-2 border-[#ff6600]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Đề Bài
              </button>
              <button
                onClick={() => setActiveTab('editorial')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  activeTab === 'editorial'
                    ? 'bg-white/10 text-white border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Hướng Dẫn
              </button>
              <button
                onClick={() => setActiveTab('submissions')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  activeTab === 'submissions'
                    ? 'bg-white/10 text-white border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Lịch Sử Nộp
              </button>
              <button
                onClick={() => setActiveTab('discussion')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  activeTab === 'discussion'
                    ? 'bg-white/10 text-white border-b-2 border-purple-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Thảo Luận
              </button>
            </div>

            {/* Tab Content Body */}
            <div className="flex-1 overflow-y-auto p-5 text-slate-300 text-sm leading-relaxed space-y-5">
              {activeTab === 'statement' && (
                <>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-2">
                      {currentProblem.code}. {currentProblem.title}
                    </h2>
                    {/* Limits kiểu Codeforces: box hairline, mono bold */}
                    <div className="inline-flex items-center gap-4 px-3 py-1.5 rounded-lg bg-[#0f1011] border border-[#23252a] text-xs font-mono">
                      <span className="text-slate-500">time limit <b className="text-slate-200">{currentProblem.timeLimit || '1.0s'}</b></span>
                      <span className="w-px h-3 bg-[#23252a]" />
                      <span className="text-slate-500">memory limit <b className="text-slate-200">{currentProblem.memoryLimit || '256 MB'}</b></span>
                    </div>
                  </div>

                  {/* Problem Statement Text (KaTeX Math Rendered) */}
                  <MathRenderer content={currentProblem.statement} className="mt-2" />

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    {currentProblem.tags?.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-slate-400 font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Example 1 */}
                  <div className="mt-4 p-4 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span>Ví dụ mẫu</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleCopyInput}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition text-[11px]"
                        >
                          {copied ? 'Đã sao chép input' : 'Sao chép input'}
                        </button>
                        <button
                          onClick={handleCopyOutput}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition text-[11px]"
                        >
                          {copiedOut ? 'Đã sao chép output' : 'Sao chép output'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">Input mẫu:</span>
                      <pre className="p-2.5 rounded-lg bg-[#010102] border border-[#23252a] font-mono text-xs text-slate-200 overflow-x-auto">
                        {currentProblem.sampleInput || '3\n1 2 3'}
                      </pre>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">Output mẫu:</span>
                      <pre className="p-2.5 rounded-lg bg-[#010102] border border-[#23252a] font-mono text-xs text-slate-200 overflow-x-auto">
                        {currentProblem.sampleOutput || '11'}
                      </pre>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'editorial' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    Hướng dẫn giải và phân tích độ phức tạp.
                  </div>
                  <MathRenderer content={editorialOpen ? (currentProblem.editorial || 'Chưa có lời giải cho bài này.') : 'Lời giải sẽ mở sau khi vòng thi kết thúc.'} />
                </div>
              )}


              {activeTab === 'submissions' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lịch Sử Nộp Bài Của Bạn</h3>
                  {submissionVerdict ? (
                    <div className={`p-3.5 rounded-lg border flex items-center justify-between ${
                      submissionVerdict.ok
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div>
                        <span className={`text-xs font-bold block ${submissionVerdict.ok ? 'text-emerald-300' : 'text-red-300'}`}>{submissionVerdict.verdict}</span>
                        <span className="text-[11px] opacity-80">{submissionVerdict.detail}</span>
                      </div>
                      {submissionVerdict.ok && (
                        <span className="text-sm font-extrabold text-emerald-400">+{submissionVerdict.points}đ</span>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg bg-white/5 border border-white/5 text-center text-xs text-slate-500">
                      Chưa có bài nộp nào. Nhấn Nộp bài để chấm pretest.
                    </div>
                  )}
                  {history && history.length > 0 && (
                    <div className="rounded-lg border border-[#23252a] overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#141516] text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="py-2 px-3">Giờ nộp</th>
                            <th className="py-2 px-3">Ngôn ngữ</th>
                            <th className="py-2 px-3">Verdict</th>
                            <th className="py-2 px-3 text-right">Điểm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#23252a] font-mono">
                          {history.slice(0, 10).map((s) => (
                            <tr key={s.id}>
                              <td className="py-2 px-3 text-slate-400">{new Date(s.submitted_at).toLocaleTimeString('vi-VN')}</td>
                              <td className="py-2 px-3 text-slate-300">{s.language}</td>
                              <td className={`py-2 px-3 font-bold ${s.verdict === 'AC' ? 'text-emerald-400' : 'text-red-400'}`}>{s.verdict}</td>
                              <td className="py-2 px-3 text-right text-slate-200">+{s.points_awarded || 0}đ</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'discussion' && (
                <div className="p-6 rounded-lg bg-white/5 border border-white/5 text-center text-xs text-slate-500 space-y-2">
                  <p>Kênh trao đổi ý tưởng thuật toán giữa các thành viên CLB FU-DEVER.</p>
                  <p className="text-[11px] text-slate-600">Không chia sẻ code lời giải trong thời gian contest tính điểm.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VERTICAL RESIZABLE SPLITTER (STATEMENT vs EDITOR)        */}
        {/* ======================================================== */}
        {!isZenEditorOnly && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingHorizontal(true);
            }}
            onDoubleClick={handleResetHorizontalSplit}
            className={`hidden lg:flex w-2 bg-[#010102] hover:bg-[#34343a] cursor-col-resize transition-colors items-center justify-center relative group z-20 ${
              isDraggingHorizontal ? 'bg-[#ff6600]' : 'border-r border-[#23252a]'
            }`}
          >
            <div className="w-1 h-8 rounded-full bg-slate-600 group-hover:bg-[#8a8f98] transition" />
            
            {/* Splitter ratio tooltip while dragging */}
            {isDraggingHorizontal && (
              <div className="absolute top-10 -left-12 px-2 py-0.5 rounded bg-black/90 border border-[#34343a] text-[10px] font-mono font-bold text-[#d0d6e0] whitespace-nowrap z-50">
                {splitRatio.toFixed(0)}% : {(100 - splitRatio).toFixed(0)}%
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PANE 2 & 3: Monaco Code Editor + Testcase Drawer (Right) */}
        {/* ======================================================== */}
        <div
          ref={rightPaneRef}
          style={{ width: isZenEditorOnly ? '100%' : `${100 - splitRatio}%` }}
          className={`${mobilePane === 'code' ? 'flex' : 'hidden'} lg:flex ws-pane flex-1 flex-col bg-[#010102] overflow-hidden`}
        >

          {/* Editor Toolbar */}
          <div className="h-10 bg-[#141516] border-b border-[#23252a] px-3 flex items-center justify-between shrink-0 select-none">
            {/* Language dropdown & Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1" role="group" aria-label="Chọn ngôn ngữ">
                {[
                  { id: 'cpp', label: 'C++', title: 'C++20' },
                  { id: 'python', label: 'Python', logo: '/icons/python.svg', title: 'Python 3' },
                  { id: 'java', label: 'Java', logo: '/icons/java.svg', title: 'Java 17' },
                  { id: 'javascript', label: 'JS', logo: '/icons/javascript.svg', title: 'JavaScript (Node.js)' },
                ].map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLanguage(l.id)}
                    title={l.title}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition flex items-center gap-1 ${
                      language === l.id
                        ? 'bg-[#ff6600] text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {l.logo && <img src={l.logo} alt="" className="h-3.5 w-3.5" />}
                    {l.label}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-1 ml-2 text-xs">
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                  title="Giảm cỡ chữ"
                >
                  A-
                </button>
                <span className="font-mono text-slate-400 text-[11px]">{fontSize}px</span>
                <button
                  onClick={() => setFontSize(Math.min(22, fontSize + 1))}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                  title="Tăng cỡ chữ"
                >
                  A+
                </button>
              </div>

              <button
                onClick={handleResetCode}
                className="px-2 py-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10 ml-2 transition text-[11px]"
                title="Khôi phục mã nguồn ban đầu"
              >
                {confirmResetCode ? 'Nhấn lại để xác nhận' : 'Đặt lại'}
              </button>
            </div>

            {/* Auto-Save Indicator */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>{autoSaveStatus}</span>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden bg-[#010102]">
            <Editor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language === 'python' ? 'python' : language === 'java' ? 'java' : 'javascript'}
              theme="vs-dark"
              value={code}
              onChange={handleCodeChange}
              options={{
                minimap: { enabled: false },
                fontSize: fontSize,
                fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 4,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                padding: { top: 10, bottom: 10 }
              }}
            />
          </div>

          {/* ======================================================== */}
          {/* HORIZONTAL RESIZABLE SPLITTER (EDITOR vs CONSOLE)        */}
          {/* ======================================================== */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingVertical(true);
            }}
            onDoubleClick={handleResetVerticalSplit}
            className={`h-1.5 bg-[#010102] hover:bg-[#34343a] cursor-row-resize transition-colors flex items-center justify-center relative group z-20 ${
              isDraggingVertical ? 'bg-[#ff6600]' : 'border-t border-[#23252a]'
            }`}
            title="Kéo lên/xuống để điều chỉnh độ cao Console (Nhấp đúp chuột để về 220px)"
          >
            <div className="w-8 h-1 rounded-full bg-slate-600 group-hover:bg-[#8a8f98] transition" />

            {/* Height tooltip while dragging */}
            {isDraggingVertical && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-[#34343a] text-[10px] font-mono font-bold text-[#d0d6e0] whitespace-nowrap z-50">
                Cao: {consoleHeight}px
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* PANE 3: Testcase & Diff Console Drawer                   */}
          {/* ======================================================== */}
          <div className="bg-[#010102] shrink-0 flex flex-col transition-all duration-150">
            {/* Drawer Toggle Header */}
            <div className="h-8 bg-[#141516] border-b border-[#23252a] px-3 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                  className="text-xs font-bold text-slate-300 hover:text-white transition"
                >
                  Console và testcase {isConsoleOpen ? '(thu gọn)' : '(mở rộng)'}
                </button>

                {isConsoleOpen && (
                  <div className="flex items-center gap-1 ml-4">
                    {testCases.map((tc, idx) => (
                      <button
                        key={tc.id}
                        onClick={() => setActiveCaseIndex(idx)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition border ${
                          activeCaseIndex === idx
                            ? 'bg-[#ff6600] text-white border-[#ff6600]'
                            : runAll?.[idx]
                              ? runAll[idx].code === 'AC'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/10 text-red-400 border-red-500/30'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200 border-transparent'
                        }`}
                        title={runAll?.[idx] ? `${runAll[idx].code} • ${runAll[idx].ms}ms` : tc.name}
                      >
                        {tc.name}{runAll?.[idx] ? ` ${runAll[idx].ms}ms` : ''}
                      </button>
                    ))}
                    <button
                      onClick={handleAddTestCase}
                      className="px-2 py-0.5 rounded text-[11px] bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                      title="Thêm testcase tùy biến"
                    >
                      + Thêm Case
                    </button>
                    <button
                      onClick={handleRunAll}
                      disabled={runAllBusy || isRunning}
                      className="px-2 py-0.5 rounded text-[11px] bg-[#141516] hover:bg-[#18191a] border border-[#34343a] text-slate-200 transition disabled:opacity-50"
                      title="Chạy hết testcase"
                    >
                      {runAllBusy ? 'Đang chạy...' : 'Chạy hết'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="hidden sm:inline">Phím tắt: <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono">Ctrl + '</kbd> Chạy thử • <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono">Ctrl + Enter</kbd> Nộp bài</span>
              </div>
            </div>

            {/* Drawer Body (when open, dynamic height) */}
            {isConsoleOpen && (
              <div 
                style={{ height: `${consoleHeight}px` }}
                className="p-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#010102]"
              >
                {/* Testcase Input + Expected */}
                <div className="flex flex-col h-full gap-2">
                  <div className="flex-1 flex flex-col min-h-0">
                    <span className="text-slate-400 font-semibold text-[11px] mb-1 shrink-0">Đầu vào (Custom Input):</span>
                    <textarea
                      value={testCases[activeCaseIndex]?.input || ''}
                      onChange={(e) => {
                        const updated = [...testCases];
                        updated[activeCaseIndex].input = e.target.value;
                        setTestCases(updated);
                      }}
                      className="w-full flex-1 p-2 rounded-lg bg-[#010102] border border-[#23252a] text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none resize-none"
                      placeholder="Nhập testcase đầu vào..."
                    />
                  </div>
                  <div className="shrink-0">
                    <span className="text-slate-400 font-semibold text-[11px] mb-1 block">Kết quả mong đợi (Expected):</span>
                    <textarea
                      value={testCases[activeCaseIndex]?.expected || ''}
                      rows={2}
                      onChange={(e) => {
                        const updated = [...testCases];
                        updated[activeCaseIndex].expected = e.target.value;
                        setTestCases(updated);
                      }}
                      className="w-full p-2 rounded-lg bg-[#010102] border border-[#23252a] text-slate-200 font-mono text-xs focus:border-[#ff6600] outline-none resize-none"
                      placeholder="Output đúng để đối soát..."
                    />
                  </div>
                </div>

                  {/* Diff View Result */}
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-1 shrink-0">
                      <span className="text-slate-400 font-semibold text-[11px]">Kết quả chạy thử:</span>
                      {runResult && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          runResult.status === 'AC'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : runResult.status === 'TLE'
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {runResult.status} — {runResult.status === 'AC' ? 'khớp kết quả' : runResult.label}
                        </span>
                      )}
                    </div>

                  {runResult ? (
                    <div className="flex-1 p-2.5 rounded-lg bg-[#010102] border border-[#23252a] font-mono text-xs space-y-1.5 overflow-y-auto">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-white/5 pb-1">
                        <span>Thời gian: <b className="text-slate-300">{runResult.executionTime}ms</b></span>
                        <span>Bộ nhớ: <b className="text-slate-300">{runResult.memory === '—' ? '—' : `${runResult.memory}MB`}</b></span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Actual Output:</span>
                        <pre className={runResult.status === 'AC' ? 'text-emerald-400' : runResult.status === 'TLE' ? 'text-yellow-400' : 'text-red-400'}>
                          {runResult.actual}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Expected Output:</span>
                        <pre className="text-slate-300">
                          {runResult.expected}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 rounded-lg bg-[#010102] border border-[#23252a] flex flex-col items-center justify-center text-slate-500 text-xs">
                      <span>Nhấn “Chạy thử” để kiểm tra kết quả</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pinned Action Bar (Run & Submit) */}
            <div className="h-11 bg-[#141516] border-t border-[#23252a] px-4 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Chế độ pretest: chấm trên bộ test mẫu</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition border border-white/10 disabled:opacity-50"
                >
                  {isRunning ? 'Đang chạy...' : 'Chạy thử'}
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isRunning || isSubmitting}
                  className="px-5 py-1.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium text-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang chấm...' : 'Nộp bài'}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
