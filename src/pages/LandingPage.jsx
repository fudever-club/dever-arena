import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { executeCodeInBrowser } from '../engine/runner.js';
import { api } from '../lib/apiClient';

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
  const [sandboxLang, setSandboxLang] = useState('cpp');
  const [sandboxCode, setSandboxCode] = useState(DEMO_SNIPPETS.cpp);
  const [sandboxOutput, setSandboxOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [stats, setStats] = useState({ contests: null, problems: null });
  const [contests, setContests] = useState([]);
  const [topProblems, setTopProblems] = useState([]);

  // Số liệu thật từ backend; chưa chạy backend thì hiện dấu gạch ngang
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, p] = await Promise.all([api.getContests(), api.getProblems()]);
        if (cancelled) return;
        setStats({ contests: c.contests?.length ?? null, problems: p.problems?.length ?? null });
        setContests(Array.isArray(c.contests) ? c.contests : []);
        const probs = Array.isArray(p.problems) ? [...p.problems].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5) : [];
        setTopProblems(probs);
      } catch { /* giữ gạch ngang */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const nextContest = contests.find((c) => ['CODING', 'REGISTRATION'].includes(c.status))
    || [...contests].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)).find((c) => new Date(c.start_time) > new Date())
    || null;

  const handleLangChange = (lang) => {
    setSandboxLang(lang);
    setSandboxCode(DEMO_SNIPPETS[lang]);
    setSandboxOutput('');
  };

  const handleRunSandbox = async () => {
    setIsExecuting(true);
    setSandboxOutput('Đang thực thi...');

    try {
      if (sandboxLang === 'javascript') {
        const res = await executeCodeInBrowser('javascript', sandboxCode, '');
        setSandboxOutput(`${res.stdout || res.status}\n[Time: ${res.executionTimeMs}ms • Status: ${res.status}]`);
      } else if (sandboxLang === 'python') {
        setSandboxOutput('Grandmaster Rank found at index: 4\n[Demo mô phỏng • Time: 19ms • Chạy thật trong Workspace]');
      } else {
        setSandboxOutput('DEVER Arena: 3 bài AC! Tổng điểm: 3000đ\n[Demo mô phỏng • Time: 14ms • Chạy thật trong Workspace]');
      }
    } catch (e) {
      setSandboxOutput(`Runtime Error: ${String(e.message).slice(0, 200)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 selection:bg-orange-500/30">

      {/* 1. HERO SECTION */}
      <section className="relative pt-16 pb-20 px-6 max-w-6xl mx-auto text-center overflow-hidden">
        {/* Live Contest Pill */}
        <img
          src="/brand/logo-dark.png"
          alt="CLB FU-DEVER — Work hard, Play hard"
          className="h-24 w-24 rounded-2xl object-cover ring-1 ring-[#23252a] mx-auto mb-6"
        />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141516] border border-[#23252a] text-[#d0d6e0] text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-[#ff6600] animate-pulse"></span>
          <span>Vòng thi đấu thuật toán của CLB FU-DEVER</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold text-[#f7f8f8] tracking-tight leading-tight max-w-4xl mx-auto">
          Đấu trường thuật toán theo thể thức <br className="hidden sm:inline" />
          <span className="text-[#ff6600]">
            Codeforces
          </span>
        </h1>

        <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Nền tảng thi đấu giải thuật của CLB FU-DEVER: làm bài 120 phút, bẻ khóa bài đối thủ cùng phòng, chấm lại toàn bộ test ẩn và xếp hạng Elo.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/arena"
            className="px-6 py-3 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium text-sm transition"
          >
            Vào Đấu Trường Arena
          </Link>

          <Link
            to="/problem/p102"
            className="px-6 py-3 rounded-lg bg-[#0f1011] hover:bg-[#141516] text-slate-200 hover:text-white font-medium text-sm transition border border-[#23252a]"
          >
            Mở Workspace Làm Bài
          </Link>
        </div>

        {/* ======================================================== */}
        {/* INTERACTIVE LIVE CODE RUNNER (Preview Widget)            */}
        {/* ======================================================== */}
        <div className="mt-14 max-w-3xl mx-auto rounded-2xl bg-[#0f1011] border border-[#23252a] overflow-hidden text-left">
          {/* Sandbox Topbar */}
          <div className="h-10 bg-[#141516] border-b border-[#23252a] px-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Chạy thử code ngay, không cần đăng nhập
            </span>

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
          <div className="p-4 bg-[#010102]">
            <textarea
              rows={8}
              value={sandboxCode}
              onChange={(e) => setSandboxCode(e.target.value)}
              className="w-full bg-transparent font-mono text-xs text-slate-200 focus:outline-none resize-none leading-relaxed"
              spellCheck="false"
            />
          </div>

          {/* Sandbox Bottom Execution Bar */}
          <div className="p-3 bg-[#141516] border-t border-[#23252a] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 font-mono">
              Chạy thử trực tiếp trên trang, không cách ly như máy chấm thi
            </div>

            <button
              onClick={handleRunSandbox}
              disabled={isExecuting}
              className="px-4 py-1.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium text-xs transition disabled:opacity-50"
            >
              {isExecuting ? 'Đang biên dịch...' : 'Chạy Thử Code'}
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

      {/* 2. CONTESTS SECTION (Upcoming + Past, kiểu Codeforces) */}
      <section className="border-y border-[#23252a] bg-[#0f1011] py-10 px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {nextContest && (
            <div className="p-5 rounded-xl bg-[#010102] border border-[#ff6600]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold tracking-widest text-[#62666d] uppercase mb-1">Kỳ thi tiếp theo</div>
                <div className="font-bold text-white">{nextContest.title}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Bắt đầu {new Date(nextContest.start_time).toLocaleString('vi-VN')} • {nextContest.duration_minutes} phút • {nextContest.contest_format}
                </div>
              </div>
              <Link to="/arena" className="px-4 py-2 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium text-xs transition shrink-0">
                Xem & Đăng ký →
              </Link>
            </div>
          )}
          {contests.length > 0 ? (
            <div className="rounded-xl border border-[#23252a] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141516] text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-[#23252a]">
                  <tr>
                    <th className="py-3 px-4">Kỳ thi</th>
                    <th className="py-3 px-4">Bắt đầu</th>
                    <th className="py-3 px-4">Thời lượng</th>
                    <th className="py-3 px-4 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#23252a]">
                  {contests.slice(0, 8).map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-4 font-bold text-slate-200">{c.title}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{new Date(c.start_time).toLocaleString('vi-VN')}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{c.duration_minutes}′</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white/5 text-slate-300 border-white/10">{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <span className="font-mono text-3xl font-bold text-[#ff6600] block">{stats.contests ?? '—'}</span>
                <span className="text-xs text-slate-400 mt-1 block">Kỳ thi trên hệ thống</span>
              </div>
              <div>
                <span className="font-mono text-3xl font-bold text-[#f7f8f8] block">{stats.problems ?? '—'}</span>
                <span className="text-xs text-slate-400 mt-1 block">Bài tập trong kho đề</span>
              </div>
              <div>
                <span className="font-mono text-3xl font-bold text-[#f7f8f8] block">JS · Py</span>
                <span className="text-xs text-slate-400 mt-1 block">Ngôn ngữ chấm thật (local)</span>
              </div>
              <div>
                <span className="font-mono text-3xl font-bold text-[#f7f8f8] block">5</span>
                <span className="text-xs text-slate-400 mt-1 block">Giai đoạn một vòng thi</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2b. PROBLEMSET PREVIEW */}
      {topProblems.length > 0 && (
        <section className="py-14 px-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#f7f8f8] tracking-tight">Bài nổi bật</h2>
            <Link to="/arena" className="text-xs text-[#ff6600] hover:underline">Xem kho đề →</Link>
          </div>
          <div className="rounded-xl border border-[#23252a] overflow-hidden divide-y divide-[#23252a]">
            {topProblems.map((p) => (
              <Link key={p.id} to="/arena" className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition">
                <span className="font-mono font-bold text-[#ff6600] text-sm w-10">{p.code}</span>
                <span className="flex-1 font-medium text-slate-200 text-sm truncate">{p.title}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10 font-mono">{p.rating || 1000}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. CORE FEATURES GRID */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            Thể thức thi đấu
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl mx-auto">
            Luật thi theo vòng: làm bài tính giờ, bẻ khóa bài đối thủ, chấm lại toàn bộ rồi xếp hạng Elo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-3 hover:border-[#34343a] transition group">
            <div className="font-mono text-xs font-bold text-[#ff6600]">01</div>
            <h3 className="text-base font-medium text-white tracking-tight">
              Thi đấu tính giờ
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Điểm mỗi bài giảm dần theo từng phút: <code className="text-[#ff6600]">Pmax - Pmax*t/250 - 50*W</code>. Nộp càng sớm điểm càng cao.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-3 hover:border-[#34343a] transition group">
            <div className="font-mono text-xs font-bold text-[#8a8f98]">02</div>
            <h3 className="text-base font-medium text-white tracking-tight">
              Phòng thách đấu
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sau giờ làm bài, mỗi phòng được xem code của nhau trong 15 phút. Tìm input làm code đối thủ sai để được <b className="text-slate-200">+100 điểm</b>.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] space-y-3 hover:border-[#34343a] transition group">
            <div className="font-mono text-xs font-bold text-[#8a8f98]">03</div>
            <h3 className="text-base font-medium text-white tracking-tight">
              Chống gian lận mã nguồn
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              So khớp cây cú pháp để phát hiện bài sao chép dù đã đổi tên biến hay xóa chú thích. Bài vi phạm bị hủy kết quả.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};
