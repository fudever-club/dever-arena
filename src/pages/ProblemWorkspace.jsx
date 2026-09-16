import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { PROBLEMS_DB } from '../data/problems.js';
import { useAuth } from '../context/AuthContext';
import { useContest } from '../context/ContestContext';
import { MathRenderer } from '../components/common/MathRenderer';
import { 
  Play, Send, RotateCcw, Copy, Check, ChevronLeft, ChevronRight, 
  Terminal, CheckCircle, XCircle, Clock, AlertTriangle, Maximize2, 
  Minimize2, FileText, Lightbulb, History, MessageSquare, Sparkles,
  GripVertical, GripHorizontal, Columns, Layout, X, Eye, EyeOff
} from 'lucide-react';

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
  const { getDynamicScore, formattedTime, phase, problems = [] } = useContest();

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
        return;
      }
    } catch (e) {}
    setCode(STARTER_CODE[language] || STARTER_CODE.cpp);
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

  const handleResetCode = () => {
    if (window.confirm('Bạn có chắc muốn đặt lại mã nguồn về mẫu khởi tạo ban đầu?')) {
      const initial = STARTER_CODE[language] || STARTER_CODE.cpp;
      setCode(initial);
      localStorage.setItem(`dever_code_${currentProblem.id}_${language}`, initial);
      setAutoSaveStatus('Đã đặt lại');
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

  // Run Code (Custom Testcase simulation with auto-open console)
  const handleRunCode = () => {
    setIsRunning(true);
    setIsConsoleOpen(true);
    if (consoleHeight < 160) setConsoleHeight(220);
    setRunResult(null);

    setTimeout(() => {
      setIsRunning(false);
      const activeCase = testCases[activeCaseIndex];
      const isPassed = !code.includes('throw') && code.length > 50;
      setRunResult({
        status: isPassed ? 'ACCEPTED' : 'WRONG_ANSWER',
        actual: isPassed ? activeCase.expected : '0\n[Output mismatch]',
        expected: activeCase.expected,
        executionTime: Math.floor(Math.random() * 25) + 12,
        memory: (Math.random() * 1.5 + 2.1).toFixed(1),
        input: activeCase.input
      });
    }, 600);
  };

  // Submit Code (Pretests simulation with Codeforces scoring)
  const handleSubmit = () => {
    if (!isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    setIsSubmitting(true);
    setIsConsoleOpen(true);
    if (consoleHeight < 160) setConsoleHeight(220);
    setSubmissionVerdict(null);

    setTimeout(() => {
      setIsSubmitting(false);
      const earned = getDynamicScore(currentProblem.rating || 1000);
      setSubmissionVerdict({
        status: 'PASSED',
        verdict: 'Accepted (Passed Pretests)',
        points: earned,
        passedTests: '12 / 12 pretests',
        time: '34ms',
        memory: '3.2MB'
      });
      setActiveTab('submissions');
    }, 1200);
  };

  const isZenActive = zenMode !== 'none';
  const isZenEditorOnly = zenMode === 'editor';

  return (
    <div 
      className={`flex flex-col bg-[#0b0f19] text-slate-100 select-none ${
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
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-[#00f0ff]/40 text-xs shadow-2xl backdrop-blur-md animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse"></span>
          <span className="text-slate-200 font-semibold">
            {isZenEditorOnly ? 'Zen Mode: Editor Only' : 'Zen Mode: Split View'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-[11px] text-slate-400">Nhấn <kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Esc</kbd> để thoát</span>
          <button
            onClick={() => setZenMode('none')}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition ml-1"
            title="Thoát Zen Mode"
          >
            <X className="w-3.5 h-3.5" />
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
              className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Bài trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => nextProblem && navigate(`/problem/${nextProblem.id}`)}
              disabled={!nextProblem}
              className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Bài tiếp theo"
            >
              <ChevronRight className="w-4 h-4" />
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
          <Sparkles className="w-3 h-3 text-[#ff6600]" />
          <span className="font-bold">+{getDynamicScore(currentProblem.rating || 1000)}đ</span>
          <span className="text-[10px] text-orange-300/70">(Giảm theo phút)</span>
        </div>

        {/* Right: ERGONOMIC LAYOUT CONTROLS & ZEN MODE */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          
          {/* Preset Buttons (50:50, 40:60, 60:40) */}
          <div className="hidden lg:flex items-center gap-1 bg-[#090d18] p-0.5 rounded-lg border border-white/10">
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
              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition ${
                isZenActive
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              title="Chế độ tập trung Zen Mode"
            >
              <Layout className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span className="hidden sm:inline">Zen Mode</span>
            </button>

            {/* Zen Mode Dropdown Menu */}
            {showZenMenu && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-[#0c101d] border border-white/15 shadow-2xl p-1 z-50 text-xs space-y-0.5">
                <button
                  onClick={() => { setZenMode('split'); setShowZenMenu(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 flex items-center justify-between transition"
                >
                  <span>🧘 Zen Split (Ẩn Navbar)</span>
                  {zenMode === 'split' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
                <button
                  onClick={() => { setZenMode('editor'); setShowZenMenu(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 flex items-center justify-between transition"
                >
                  <span>🎯 Zen Editor (Chỉ Code)</span>
                  {zenMode === 'editor' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
                {isZenActive && (
                  <button
                    onClick={() => { setZenMode('none'); setShowZenMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 flex items-center justify-between transition border-t border-white/5"
                  >
                    <span>✕ Thoát Zen Mode</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
            title={isFullscreen ? 'Thoát toàn màn hình (Esc)' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Contest Clock */}
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 pl-2 border-l border-white/10">
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-mono text-slate-200 font-medium">{formattedTime}</span>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. RESIZABLE MULTI-PANE WORKSPACE CONTAINER             */}
      {/* ======================================================== */}
      <div 
        ref={workspaceRef}
        className="flex-1 flex flex-col lg:flex-row overflow-hidden relative"
      >
        
        {/* ======================================================== */}
        {/* PANE 1: Problem Statement & Tabs (Left)                  */}
        {/* ======================================================== */}
        {!isZenEditorOnly && (
          <div 
            style={{ width: `${splitRatio}%` }}
            className="hidden lg:flex flex-col bg-[#0b0f19] border-r border-white/10 overflow-hidden shrink-0"
          >
            {/* Tabs Header */}
            <div className="h-9 bg-[#0c101c] border-b border-white/10 flex items-center px-2 gap-1 shrink-0 select-none">
              <button
                onClick={() => setActiveTab('statement')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'statement'
                    ? 'bg-white/10 text-white border-b-2 border-[#ff6600]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#ff6600]" />
                Đề Bài
              </button>
              <button
                onClick={() => setActiveTab('editorial')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'editorial'
                    ? 'bg-white/10 text-white border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                Hướng Dẫn
              </button>
              <button
                onClick={() => setActiveTab('submissions')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'submissions'
                    ? 'bg-white/10 text-white border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                Lịch Sử Nộp
              </button>
              <button
                onClick={() => setActiveTab('discussion')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'discussion'
                    ? 'bg-white/10 text-white border-b-2 border-purple-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                Thảo Luận
              </button>
            </div>

            {/* Tab Content Body */}
            <div className="flex-1 overflow-y-auto p-5 text-slate-300 text-sm leading-relaxed space-y-5">
              {activeTab === 'statement' && (
                <>
                  <div>
                    <h2 className="text-xl font-extrabold text-white mb-1">
                      {currentProblem.code}. {currentProblem.title}
                    </h2>
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-mono mt-1">
                      <span>⏱️ Giới hạn thời gian: <b className="text-slate-300">{currentProblem.timeLimit || '1.0s'}</b></span>
                      <span>💾 Giới hạn bộ nhớ: <b className="text-slate-300">{currentProblem.memoryLimit || '256 MB'}</b></span>
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
                  <div className="mt-4 p-4 rounded-xl bg-[#111827] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span>Ví Dụ 1 (Sample Testcase)</span>
                      <button
                        onClick={handleCopyInput}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition text-[11px]"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Đã sao chép' : 'Sao chép Input'}
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">Input mẫu:</span>
                      <pre className="p-2.5 rounded-lg bg-[#080b13] border border-white/5 font-mono text-xs text-emerald-400 overflow-x-auto">
                        {currentProblem.sampleInput || '3\n1 2 3'}
                      </pre>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">Output mẫu:</span>
                      <pre className="p-2.5 rounded-lg bg-[#080b13] border border-white/5 font-mono text-xs text-orange-400 overflow-x-auto">
                        {currentProblem.sampleOutput || '11'}
                      </pre>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'editorial' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <Lightbulb className="w-4 h-4 shrink-0" />
                    Hướng dẫn giải chi tiết và phân tích độ phức tạp chuẩn thi đấu.
                  </div>
                  <MathRenderer content={currentProblem.editorial || 'Lời giải bài này sẽ được mở tự động sau khi kỳ thi kết thúc.'} />
                </div>
              )}


              {activeTab === 'submissions' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lịch Sử Nộp Bài Của Bạn</h3>
                  {submissionVerdict ? (
                    <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <div>
                          <span className="text-xs font-bold text-emerald-300 block">{submissionVerdict.verdict}</span>
                          <span className="text-[11px] text-emerald-400/80">{submissionVerdict.passedTests} • {submissionVerdict.time}</span>
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-400">+{submissionVerdict.points}đ</span>
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg bg-white/5 border border-white/5 text-center text-xs text-slate-500">
                      Chưa có bài nộp nào cho bài toán này. Hãy nhấn Submit để chấm Pretests!
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'discussion' && (
                <div className="p-6 rounded-lg bg-white/5 border border-white/5 text-center text-xs text-slate-500 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p>Kênh trao đổi ý tưởng thuật toán giữa các thành viên CLB FU-DEVER.</p>
                  <p className="text-[11px] text-slate-600">Vui lòng không chia sẻ toàn bộ code AC trong suốt thời gian diễn ra Contest Rated!</p>
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
            className={`hidden lg:flex w-2 bg-[#0a0e1a] hover:bg-[#00f0ff]/40 cursor-col-resize transition-colors items-center justify-center relative group z-20 ${
              isDraggingHorizontal ? 'bg-[#00f0ff] shadow-lg shadow-[#00f0ff]/50' : 'border-r border-white/10'
            }`}
            title="Kéo sang trái/phải để điều chỉnh độ rộng (Nhấp đúp chuột để về 50:50)"
          >
            <div className="w-1 h-8 rounded-full bg-slate-600 group-hover:bg-[#00f0ff] transition" />
            
            {/* Splitter ratio tooltip while dragging */}
            {isDraggingHorizontal && (
              <div className="absolute top-10 -left-12 px-2 py-0.5 rounded bg-black/90 border border-[#00f0ff] text-[10px] font-mono font-bold text-[#00f0ff] whitespace-nowrap shadow-xl z-50">
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
          className="flex-1 flex flex-col bg-[#0d1220] overflow-hidden"
        >
          
          {/* Editor Toolbar */}
          <div className="h-10 bg-[#0e1424] border-b border-white/10 px-3 flex items-center justify-between shrink-0 select-none">
            {/* Language dropdown & Controls */}
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-2 py-1 rounded bg-[#1f2937] border border-white/10 text-xs text-slate-200 font-mono outline-none focus:border-[#ff6600]"
              >
                <option value="cpp">C++ 20 (GCC 13)</option>
                <option value="python">Python 3.11</option>
                <option value="java">Java 17 (OpenJDK)</option>
                <option value="javascript">JavaScript (Node.js 20)</option>
              </select>

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
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 ml-2 transition"
                title="Khôi phục mã nguồn ban đầu"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Auto-Save Indicator */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>{autoSaveStatus}</span>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden bg-[#080b13]">
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
            className={`h-1.5 bg-[#0a0e1a] hover:bg-[#ff6600]/50 cursor-row-resize transition-colors flex items-center justify-center relative group z-20 ${
              isDraggingVertical ? 'bg-[#ff6600] shadow-lg shadow-[#ff6600]/50' : 'border-t border-white/10'
            }`}
            title="Kéo lên/xuống để điều chỉnh độ cao Console (Nhấp đúp chuột để về 220px)"
          >
            <div className="w-8 h-1 rounded-full bg-slate-600 group-hover:bg-[#ff6600] transition" />
            
            {/* Height tooltip while dragging */}
            {isDraggingVertical && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-[#ff6600] text-[10px] font-mono font-bold text-[#ff6600] whitespace-nowrap shadow-xl z-50">
                Cao: {consoleHeight}px
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* PANE 3: Testcase & Diff Console Drawer                   */}
          {/* ======================================================== */}
          <div className="bg-[#0a0e1a] shrink-0 flex flex-col transition-all duration-150">
            {/* Drawer Toggle Header */}
            <div className="h-8 bg-[#0d1222] border-b border-white/10 px-3 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition"
                >
                  <Terminal className="w-3.5 h-3.5 text-[#ff6600]" />
                  Console & Testcases {isConsoleOpen ? '▲' : '▼'}
                </button>

                {isConsoleOpen && (
                  <div className="flex items-center gap-1 ml-4">
                    {testCases.map((tc, idx) => (
                      <button
                        key={tc.id}
                        onClick={() => setActiveCaseIndex(idx)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                          activeCaseIndex === idx
                            ? 'bg-[#ff6600] text-white'
                            : 'bg-white/5 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tc.name}
                      </button>
                    ))}
                    <button
                      onClick={handleAddTestCase}
                      className="px-2 py-0.5 rounded text-[11px] bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                      title="Thêm testcase tùy biến"
                    >
                      + Thêm Case
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
                className="p-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#090d18]"
              >
                {/* Testcase Input */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-1 shrink-0">
                    <span className="text-slate-400 font-semibold text-[11px]">Đầu vào (Custom Input):</span>
                  </div>
                  <textarea
                    value={testCases[activeCaseIndex]?.input || ''}
                    onChange={(e) => {
                      const updated = [...testCases];
                      updated[activeCaseIndex].input = e.target.value;
                      setTestCases(updated);
                    }}
                    className="w-full flex-1 p-2 rounded-lg bg-[#050811] border border-white/10 text-emerald-400 font-mono text-xs focus:border-[#ff6600] outline-none resize-none"
                    placeholder="Nhập testcase đầu vào..."
                  />
                </div>

                {/* Diff View Result */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-1 shrink-0">
                    <span className="text-slate-400 font-semibold text-[11px]">Kết quả thực thi (Execution Diff):</span>
                    {runResult && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        runResult.status === 'ACCEPTED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {runResult.status === 'ACCEPTED' ? '✓ KHỚP KẾT QUẢ' : '✗ OUTPUT SAI KHÁC'}
                      </span>
                    )}
                  </div>

                  {runResult ? (
                    <div className="flex-1 p-2.5 rounded-lg bg-[#050811] border border-white/10 font-mono text-xs space-y-1.5 overflow-y-auto">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-white/5 pb-1">
                        <span>Thời gian: <b className="text-slate-300">{runResult.executionTime}ms</b></span>
                        <span>Bộ nhớ: <b className="text-slate-300">{runResult.memory}MB</b></span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Actual Output:</span>
                        <pre className={runResult.status === 'ACCEPTED' ? 'text-emerald-400' : 'text-red-400'}>
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
                    <div className="flex-1 rounded-lg bg-[#050811] border border-white/10 flex flex-col items-center justify-center text-slate-500 text-xs">
                      <Terminal className="w-5 h-5 mb-1 opacity-40" />
                      <span>Nhấn "Chạy Thử" để kiểm tra kết quả</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pinned Action Bar (Run & Submit) */}
            <div className="h-11 bg-[#0c101c] border-t border-white/10 px-4 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Pretests Mode: Chấm 12 testcases ban đầu</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-1.5 border border-white/10 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  {isRunning ? 'Đang chạy...' : 'Chạy Thử'}
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isRunning || isSubmitting}
                  className="px-5 py-1.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Đang chấm...' : 'NỘP BÀI'}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
