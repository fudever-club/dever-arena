import React, { useState, useEffect } from 'react';
import { useContest } from '../context/ContestContext';
import { validateInput } from '../engine/testlibValidator.js';
import { api, getToken } from '../lib/apiClient';

const ROOM_PARTICIPANTS = [
  {
    id: 'u_buggy',
    username: 'buggy_coder',
    name: 'Phạm Quốc Bảo',
    rating: 1490,
    solvedProblems: [
      { code: 'A', points: 440, solved: true, isHacked: false },
      { 
        code: 'B', 
        points: 940, 
        solved: true, 
        isHacked: false, 
        language: 'cpp',
        codeContent: `// Solution by buggy_coder for Problem B
#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<int> a(n);
    int sum = 0;
    int sumSq = 0;
    for (int i = 0; i < n; i++) {
        cin >> a[i];
        sum += a[i];       // WARNING: Buggy overflow with int32!
        sumSq += a[i]*a[i];// WARNING: Overflow here!
    }
    // S = (sum^2 - sumSq) / 2
    int ans = (sum * sum - sumSq) / 2;
    cout << ans << "\\n";
    return 0;
}`
      }
    ]
  },
  {
    id: 'u_alice',
    username: 'alice_ninja',
    name: 'Trần Thị Mai',
    rating: 1540,
    solvedProblems: [
      { code: 'A', points: 490, solved: true, isHacked: false },
      { 
        code: 'B', 
        points: 910, 
        solved: true, 
        isHacked: false, 
        language: 'python',
        codeContent: `# Solution by alice_ninja for Problem B
import sys

def solve():
    n = int(sys.stdin.readline())
    a = list(map(int, sys.stdin.readline().split()))
    s = sum(a)
    sq = sum(x*x for x in a)
    print((s*s - sq) // 2)

if __name__ == '__main__':
    solve()`
      }
    ]
  },
  {
    id: 'u_hacker',
    username: 'hacker_pro',
    name: 'Lê Hoàng Nam',
    rating: 1680,
    solvedProblems: [
      { code: 'A', points: 460, solved: true, isHacked: false },
      { code: 'B', points: 890, solved: true, isHacked: false }
    ]
  }
];

export const HackRoomPage = () => {
  const { phase, formattedTime, contestId, contestSlug } = useContest();

  const [selectedCoder, setSelectedCoder] = useState(ROOM_PARTICIPANTS[0]);
  const [selectedProblemCode, setSelectedProblemCode] = useState('B');
  const [counterTestcase, setCounterTestcase] = useState('3\n100000 100000 100000\n');
  const [testlibResult, setTestlibResult] = useState({ isValid: true, error: null });
  const [hackStatus, setHackStatus] = useState(null); // 'SUCCESS' | 'FAILED' | null
  const [isExecuting, setIsExecuting] = useState(false);
  const [roomData, setRoomData] = useState(ROOM_PARTICIPANTS);
  const [dataSource, setDataSource] = useState('demo'); // demo | live
  const [myId, setMyId] = useState(null);
  const [hackHistory, setHackHistory] = useState([]);
  const canHack = phase === 'HACK_PHASE';

  const loadRoom = async () => {
    try {
      const token = getToken();
      if (!token) return false;
      // Giải mã payload JWT (không cần secret) để biết user id của mình
      let id = null;
      try { id = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))?.sub || null; } catch {}
      setMyId(id);
      const st = await api.getStandings(contestSlug);
      const rows = st.standings || [];
      const myRow = id ? rows.find((r) => r.user_id === id) : null;
      const roomId = myRow?.room_id || [...new Set(rows.map((r) => r.room_id).filter(Boolean))][0];
      if (!roomId) return false;
      const room = await api.getRoom(contestSlug, roomId);
      if (!room?.members?.length) return false;
      const mapped = room.members.map((m) => ({
        id: m.user_id,
        username: m.username,
        rating: m.rating,
        solvedProblems: (m.submissions || []).map((s) => ({
          code: s.problem_code,
          points: s.points,
          solved: true,
          isHacked: Boolean(s.is_hacked),
          language: s.language,
          codeContent: s.source_code,
          submissionId: s.id,
        })),
      })).filter((m) => m.solvedProblems.length > 0);
      if (mapped.length > 0) {
        setRoomData(mapped);
        setSelectedCoder((prev) => mapped.find((m) => m.id === prev.id) || mapped[0]);
        setDataSource('live');
        return true;
      }
      return false;
    } catch { return false; }
  };

  // Phòng thật từ backend (cần đăng nhập). Không có → giữ demo local.
  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadRoom(); })();
    return () => { cancelled = true; };
  }, [contestSlug]);

  const activeProblem = selectedCoder.solvedProblems?.find((p) => p.code === selectedProblemCode) || selectedCoder.solvedProblems?.[0];
  const isSelf = Boolean(myId && selectedCoder.id === myId);
  const openChallenges = roomData.reduce((n, c) => n + c.solvedProblems.filter((p) => !p.isHacked).length, 0);

  const pushHistory = (entry) => setHackHistory((h) => [{ at: new Date().toISOString(), ...entry }, ...h].slice(0, 20));

  const handleTestcaseChange = (val) => {
    setCounterTestcase(val);
    // Live Testlib Validator
    const validation = validateInput(val, {
      minN: 1,
      maxN: 200000,
      minVal: -1000000000,
      maxVal: 1000000000,
      requireTrailingNewline: true,
      disallowTrailingSpaces: true
    });
    setTestlibResult(validation);
  };

  const handleExecuteHack = async () => {
    if (!testlibResult.isValid) {
      setHackStatus({
        type: 'FAILED',
        message: 'Testcase chưa hợp lệ!',
        details: `Testlib Validator: "${testlibResult.error}". Hãy sửa lại format để tránh mất -50 điểm phạt!`
      });
      return;
    }

    // Chế độ live: chấm thật trên máy chủ
    if (dataSource === 'live' && activeProblem?.submissionId) {
      setIsExecuting(true);
      setHackStatus(null);
      try {
        const res = await api.executeHack({
          contest_id: contestId, target_submission_id: activeProblem.submissionId, test_payload: counterTestcase,
        });
        if (res.success) {
          setHackStatus({
            type: 'SUCCESS',
            message: 'Hack thành công (+100đ)!',
            details: `Code đối thủ sai trên testcase của bạn (máy chấm: ${res.victim_verdict || 'sai output'}). Bài nộp đã bị vô hiệu hóa.`
          });
          pushHistory({ target: selectedCoder.username, problem: selectedProblemCode, result: 'SUCCESS', delta: 100, mode: 'live' });
          await loadRoom();
        } else {
          setHackStatus({
            type: 'FAILED',
            message: 'Hack thất bại (−50đ)!',
            details: 'Code đối thủ vẫn đúng trên testcase của bạn. Bạn bị trừ 50 điểm.'
          });
          pushHistory({ target: selectedCoder.username, problem: selectedProblemCode, result: 'FAILED', delta: -50, mode: 'live' });
        }
      } catch (err) {
        setHackStatus({ type: 'FAILED', message: 'Không gửi được đòn hack', details: err?.message || 'Lỗi kết nối máy chủ.' });
      } finally {
        setIsExecuting(false);
      }
      return;
    }

    // Demo local (không có backend): mô phỏng
    setIsExecuting(true);
    setHackStatus(null);

    setTimeout(() => {
      setIsExecuting(false);

      // In problem B: buggy_coder uses int (overflow with 100000) -> Hack Success!
      // alice_ninja uses python -> Hack Failed!
      const isVictimBuggy = selectedCoder.username === 'buggy_coder' && selectedProblemCode === 'B';

      if (isVictimBuggy) {
        setHackStatus({
          type: 'SUCCESS',
          message: 'Hack thành công (+100đ, demo)!',
          details: 'Code mẫu này dùng số nguyên 32-bit nên tràn số với input lớn. Bài nộp demo bị vô hiệu hóa.'
        });
        pushHistory({ target: selectedCoder.username, problem: selectedProblemCode, result: 'SUCCESS', delta: 100, mode: 'demo' });

        // Update victim problem state
        setRoomData((prev) =>
          prev.map((c) => {
            if (c.id === selectedCoder.id) {
              return {
                ...c,
                solvedProblems: c.solvedProblems.map((p) =>
                  p.code === selectedProblemCode ? { ...p, isHacked: true } : p
                )
              };
            }
            return c;
          })
        );
      } else {
        setHackStatus({
          type: 'FAILED',
          message: 'Hack thất bại (−50đ, demo)!',
          details: 'Ở chế độ demo, chỉ tài khoản buggy_coder bài B mới bẻ được. Chạy backend và thi Hack Phase thật để chấm điểm.'
        });
        pushHistory({ target: selectedCoder.username, problem: selectedProblemCode, result: 'FAILED', delta: -50, mode: 'demo' });
      }
    }, 800);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      
      {/* 1. Room Header Banner */}
      <div className="p-6 rounded-xl bg-[#0f1011] border border-[#23252a] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              Hack Room
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${dataSource === 'live' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-white/10'}`}>
              {dataSource === 'live' ? `Phòng thật (${phase})` : 'Demo local'}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Phòng Thách Đấu
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Sau giờ làm bài, mỗi người được đọc code cùng phòng và gửi input để chứng minh code đối thủ sai. Hack đúng +100 điểm, hack sai −50 điểm.
          </p>
          {!canHack && (
            <p className="mt-2 inline-block px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-[11px] font-semibold" role="status">
              Đòn hack chỉ mở trong Hack Phase (hiện tại: {phase}). Ngoài giờ thi, form gửi bị khóa.
            </p>
          )}
        </div>

        <div className="bg-[#0f1011] p-4 rounded-xl border border-[#23252a] shrink-0 text-right font-mono">
          <span className="text-[11px] text-slate-400 block">Thời gian Hack Phase</span>
          <span className="text-2xl font-black text-red-400 tracking-wider">
            {formattedTime}
          </span>
        </div>
      </div>

      {/* 2. Main 2-Column Split Hack Chamber */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: 25 Room Participants List (4 Cols)          */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 bg-[#0f1011] border border-[#23252a] rounded-xl p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-[#23252a] pb-2 text-xs font-bold text-slate-300">
            <span>Danh sách đấu thủ cùng phòng</span>
            <span className="font-mono text-[10px] text-slate-500">{openChallenges} còn bẻ được</span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[560px] pr-1">
            {roomData.map((coder) => {
              const isSelected = coder.id === selectedCoder.id;
              return (
                <div
                  key={coder.id}
                  className={`p-3 rounded-xl border transition ${
                    isSelected
                      ? 'bg-[#141516] border-[#ff6600]/40'
                      : 'bg-white/[0.02] border-[#23252a] hover:border-[#34343a]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-orange-400">
                        {coder.username[0].toUpperCase()}
                      </div>
                      <div className="text-left leading-none">
                        <span className="font-bold text-white text-xs block">{coder.username}{myId === coder.id ? ' (bạn)' : ''}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{coder.rating} Elo</span>
                      </div>
                    </div>
                    {!isSelected && (
                      <button
                        onClick={() => setSelectedCoder(coder)}
                        aria-label={`Chọn ${coder.username} làm mục tiêu`}
                        className="px-2 py-1 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#34343a] text-slate-300 text-[11px] transition"
                      >
                        Chọn
                      </button>
                    )}
                  </div>

                  {/* Problems status pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {coder.solvedProblems?.map((prob) => (
                      <button
                        key={prob.code}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCoder(coder);
                          setSelectedProblemCode(prob.code);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition flex items-center gap-1 ${
                          prob.isHacked
                            ? 'bg-red-950/40 text-slate-500 line-through border border-red-900/40'
                            : prob.code === selectedProblemCode && isSelected
                            ? 'bg-[#ff6600] text-white border border-orange-400'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {prob.isHacked ? `Bài ${prob.code} (bị hack)` : `Bài ${prob.code} (+${prob.points})`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Code Inspection & Hack Chamber (8 Cols)   */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 bg-[#0f1011] border border-[#23252a] rounded-xl p-6 flex flex-col space-y-5">

          {/* Victim Header */}
          <div className="flex items-center justify-between border-b border-[#23252a] pb-4">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Mục tiêu bẻ khóa:</span>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{selectedCoder.username}</span>
                <span className="text-slate-500">•</span>
                <span className="text-[#ff6600]">Bài {selectedProblemCode}</span>
                {activeProblem?.isHacked ? (
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
                    Đã bị bẻ khóa
                  </span>
                ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                Qua pretest ({activeProblem?.points || 0}đ)
              </span>
                )}
              </h2>
              {isSelf && (
                <p className="mt-1 text-[11px] text-yellow-300 font-semibold" role="status">
                  Đây là bài của chính bạn — không thể tự hack (luật Codeforces).
                </p>
              )}
            </div>

            <div className="text-right text-xs font-mono text-slate-400">
              Ngôn ngữ: <b className="text-slate-200 uppercase">{activeProblem?.language || 'cpp'}</b>
            </div>
          </div>

          {/* Victim Source Code Viewer */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
              <span>Mã nguồn đối thủ (chế độ đọc):</span>
            </div>
            <pre className="p-4 rounded-xl bg-[#010102] border border-[#23252a] font-mono text-xs text-slate-300 overflow-x-auto max-h-60 leading-relaxed">
              {activeProblem?.codeContent || (dataSource === 'live'
                ? `// Code đối thủ chỉ mở trong Hack Phase (hiện tại: ${phase}).`
                : '// Không có mã nguồn khả dụng cho bài này.')}
            </pre>
          </div>

          {/* Counter-Testcase Input & Live Testlib Validator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Nhập input để bẻ khóa bài trên:</span>
              {testlibResult.isValid ? (
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Testlib Validator: Hợp lệ
                </span>
              ) : (
                <span className="text-[11px] text-red-400 font-semibold">
                  Testlib Error: {testlibResult.error}
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={counterTestcase}
              onChange={(e) => handleTestcaseChange(e.target.value)}
              disabled={!canHack}
              aria-label="Input để bẻ khóa (chỉ mở trong Hack Phase)"
              className="w-full p-3 rounded-xl bg-[#010102] border border-[#23252a] font-mono text-xs text-slate-200 focus:border-[#ff6600] outline-none disabled:opacity-50"
              placeholder="VD: 3\n100000 100000 100000\n"
            />
            <p className="text-[11px] text-slate-500">
              Input phải đúng định dạng đề bài: kết thúc bằng một ký tự xuống dòng, không dư khoảng trắng cuối dòng.
              Đang kiểm tra theo N trong [1, 200000], phần tử trong ±10⁹ (đổi theo từng bài trong bản Polygon đầy đủ).
            </p>
          </div>

          {/* Hack Result Banner */}
          {hackStatus && (
            <div className={`p-4 rounded-xl border animate-fadeIn ${
              hackStatus.type === 'SUCCESS'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              <div>
                <h4 className="font-bold text-sm">{hackStatus.message}</h4>
                <p className="text-xs mt-0.5 opacity-90">{hackStatus.details}</p>
              </div>
            </div>
          )}

          {/* Hack Action Button */}
          <div className="pt-2">
            <button
              onClick={handleExecuteHack}
              disabled={isExecuting || !testlibResult.isValid || activeProblem?.isHacked || isSelf || !canHack || (dataSource === 'live' && !activeProblem?.submissionId)}
              className="w-full py-3 px-6 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] font-medium text-sm text-white transition disabled:opacity-50"
            >
              {isExecuting ? 'Đang chấm...' : 'Tung đòn hack (−50đ / +100đ)'}
            </button>
          </div>

          {/* Lịch sử hack của tôi */}
          {hackHistory.length > 0 && (
            <div className="rounded-xl border border-[#23252a] overflow-hidden">
              <div className="px-4 py-2 bg-[#141516] text-[11px] font-bold text-slate-300 uppercase tracking-wider">Lịch sử hack của tôi</div>
              <ul className="divide-y divide-[#23252a] text-xs font-mono">
                {hackHistory.map((h, i) => (
                  <li key={i} className="px-4 py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-400 truncate">{h.target} · Bài {h.problem} · {new Date(h.at).toLocaleTimeString('vi-VN')}</span>
                    <span className={`font-bold shrink-0 ${h.result === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {h.result === 'SUCCESS' ? `+${h.delta}` : h.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
