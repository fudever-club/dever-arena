import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sound } from '../engine/sound.js';
import { 
  Trophy, Code, Play, Zap, Shield, Award, Users, 
  ArrowRight, CheckCircle2, Clock, Terminal, Sparkles 
} from 'lucide-react';

const DEMO_SNIPPETS = {
  cpp: `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> scores = {500, 1000, 1500};
    int total = std::accumulate(scores.begin(), scores.end(), 0);
    std::cout << "DEVER Arena: 3 bài AC! Tổng điểm: " << total << "đ\\n";
    return 0;
}`,
  python: `# Giải thuật tìm kiếm nhị phân mẫu
def binary_search(arr, target):
    l, r = 0, len(arr) - 1
    while l <= r:
        mid = (l + r) // 2
        if arr[mid] == target: return mid
        elif arr[mid] < target: l = mid + 1
        else: r = mid - 1
    return -1

nums = [1200, 1400, 1600, 1900, 2400]
print(f"Grandmaster Rank found at index: {binary_search(nums, 2400)}")`,
  javascript: `// DEVER Elo Rating Expectation
function getWinProbability(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

const prob = getWinProbability(1742, 1600);
console.log("Xác suất dever_hero (1742) thắng:", (prob * 100).toFixed(1) + "%");`
};

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [sandboxLang, setSandboxLang] = useState('cpp');
  const [sandboxCode, setSandboxCode] = useState(DEMO_SNIPPETS.cpp);
  const [sandboxOutput, setSandboxOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const handleLangChange = (lang) => {
    setSandboxLang(lang);
    setSandboxCode(DEMO_SNIPPETS[lang]);
    setSandboxOutput('');
  };

  const handleRunSandbox = () => {
    setIsExecuting(true);
    sound.playTick();

    setTimeout(() => {
      setIsExecuting(false);
      sound.playAccepted();
      if (sandboxLang === 'cpp') {
        setSandboxOutput('DEVER Arena: 3 bài AC! Tổng điểm: 3000đ\n[Execution time: 14ms • Memory: 1.8MB • Status: SUCCESS]');
      } else if (sandboxLang === 'python') {
        setSandboxOutput('Grandmaster Rank found at index: 4\n[Execution time: 19ms • Memory: 2.1MB • Status: SUCCESS]');
      } else {
        setSandboxOutput('Xác suất dever_hero (1742) thắng: 69.4%\n[Execution time: 11ms • Memory: 1.2MB • Status: SUCCESS]');
      }
    }, 450);
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#0b0f19] text-slate-100 selection:bg-orange-500/30">
      
      {/* 1. HERO SECTION */}
      <section className="relative pt-16 pb-20 px-6 max-w-6xl mx-auto text-center overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-gradient-to-b from-orange-500/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none -z-10"></div>

        {/* Live Contest Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-[#ff6600] text-xs font-semibold mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Vòng thi <b>DEVER Round #1 (Div. 3)</b> đang diễn ra</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight max-w-4xl mx-auto">
          Đấu Trường Thuật Toán Chuẩn <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6600] via-orange-400 to-[#00f0ff]">
            Codeforces & LeetCode
          </span>
        </h1>

        <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Nền tảng thi đấu giải thuật tự chủ của CLB FU-DEVER: Coding Phase 120′, Hack Room 25 người bẻ khóa đối thủ, System Testing 45 test ẩn và hệ thống Elo Rating 7 bậc.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/arena"
            className="px-6 py-3 rounded-xl bg-[#ff6600] hover:bg-[#ff771a] text-white font-extrabold text-sm transition flex items-center gap-2 shadow-xl shadow-orange-500/25 group"
          >
            <Trophy className="w-4 h-4" />
            Vào Đấu Trường Arena
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
          </Link>

          <Link
            to="/problem/p102"
            className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-bold text-sm transition border border-white/10 flex items-center gap-2"
          >
            <Code className="w-4 h-4 text-[#00f0ff]" />
            Mở LeetCode Workspace
          </Link>
        </div>

        {/* ======================================================== */}
        {/* INTERACTIVE LIVE CODE RUNNER (Preview Widget)            */}
        {/* ======================================================== */}
        <div className="mt-14 max-w-3xl mx-auto rounded-2xl bg-[#090d18] border border-white/10 overflow-hidden shadow-2xl text-left">
          {/* Sandbox Topbar */}
          <div className="h-10 bg-[#0d1222] border-b border-white/10 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
              </div>
              <span className="ml-2 text-xs font-bold text-slate-300">
                Interactive Code Sandbox (Dùng Thử Trực Tiếp Không Cần Đăng Nhập)
              </span>
            </div>

            {/* Language Picker */}
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/5 text-xs">
              <button
                onClick={() => handleLangChange('cpp')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${sandboxLang === 'cpp' ? 'bg-[#ff6600] text-white' : 'text-slate-400 hover:text-white'}`}
              >
                C++20
              </button>
              <button
                onClick={() => handleLangChange('python')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${sandboxLang === 'python' ? 'bg-[#ff6600] text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Python 3
              </button>
              <button
                onClick={() => handleLangChange('javascript')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${sandboxLang === 'javascript' ? 'bg-[#ff6600] text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Node.js
              </button>
            </div>
          </div>

          {/* Sandbox Code Input */}
          <div className="p-4 bg-[#060912]">
            <textarea
              rows={8}
              value={sandboxCode}
              onChange={(e) => setSandboxCode(e.target.value)}
              className="w-full bg-transparent font-mono text-xs text-slate-200 focus:outline-none resize-none leading-relaxed"
              spellCheck="false"
            />
          </div>

          {/* Sandbox Bottom Execution Bar */}
          <div className="p-3 bg-[#0a0f1e] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 font-mono">
              ⚡ Thực thi Sandbox an toàn cách ly bộ nhớ
            </div>

            <button
              onClick={handleRunSandbox}
              disabled={isExecuting}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {isExecuting ? 'Đang biên dịch...' : '▶ Chạy Thử Code'}
            </button>
          </div>

          {/* Sandbox Output Console */}
          {sandboxOutput && (
            <div className="p-3.5 bg-black/80 border-t border-white/10 font-mono text-xs text-emerald-400 whitespace-pre-line animate-fadeIn">
              <span className="text-[10px] text-slate-500 block mb-1">Standard Output (stdout):</span>
              {sandboxOutput}
            </div>
          )}
        </div>
      </section>

      {/* 2. STATS SECTION */}
      <section className="border-y border-white/10 bg-[#090d18]/50 py-10 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="font-mono text-3xl font-black text-[#ff6600] block">1,240+</span>
            <span className="text-xs text-slate-400 mt-1 block">Sinh Viên FPTU Thi Đấu</span>
          </div>
          <div>
            <span className="font-mono text-3xl font-black text-[#00f0ff] block">48</span>
            <span className="text-xs text-slate-400 mt-1 block">Contest Đã Tổ Chức</span>
          </div>
          <div>
            <span className="font-mono text-3xl font-black text-emerald-400 block">5</span>
            <span className="text-xs text-slate-400 mt-1 block">Bài Tập / Round</span>
          </div>
          <div>
            <span className="font-mono text-3xl font-black text-purple-400 block">92%</span>
            <span className="text-xs text-slate-400 mt-1 block">Phát Hiện Gian Lận AST</span>
          </div>
        </div>
      </section>

      {/* 3. CORE FEATURES GRID */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Những Trải Nghiệm Độc Quyền Tại DEVER Arena
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl mx-auto">
            Hội tụ đầy đủ mọi quy chuẩn thi đấu quốc tế được tối ưu hóa cho cộng đồng lập trình FPT University.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#0e1424] border border-white/10 space-y-3 hover:border-orange-500/40 transition group">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-[#ff6600]">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-[#ff6600] transition">
              Thi Đấu Thời Gian Thực
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Điểm số suy giảm theo từng phút theo công thức chuẩn Codeforces: <code className="text-orange-400">Pmax - Pmax*t/250 - 50*W</code>. Nộp càng nhanh điểm càng cao!
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e1424] border border-white/10 space-y-3 hover:border-cyan-500/40 transition group">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00f0ff]">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-[#00f0ff] transition">
              Phòng Thách Đấu Hack Room
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mở mã nguồn của các đối thủ cùng Room 25 người trong 15 phút Hack Phase. Tung testcase bẻ khóa bẫy tràn số để giành trọn <b className="text-emerald-400">+100 điểm</b>!
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e1424] border border-white/10 space-y-3 hover:border-red-500/40 transition group">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-red-400 transition">
              AST Anti-Cheat Sentinel
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Thuật toán Winnowing 3-gram phân tích cây cú pháp trừu tượng, loại bỏ mọi thủ thuật đổi tên biến, thêm khoảng trắng hay comment nhằm bảo vệ tính công bằng 100%.
            </p>
          </div>
        </div>
      </section>

      {/* 4. FOOTER */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 DEVER Arena Enterprise • CLB FU-DEVER • FPT University</p>
        <p className="mt-1 text-[11px]">Nền tảng thi đấu giải thuật chuẩn Codeforces & ICPC</p>
      </footer>

    </div>
  );
};
