import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useContest } from '../context/ContestContext';
import { sound } from '../engine/sound.js';
import { validateInput } from '../engine/testlibValidator.js';
import { 
  Zap, Shield, AlertTriangle, CheckCircle, XCircle, 
  Terminal, User, FileCode, Flame, Sparkles, Send 
} from 'lucide-react';

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
  const { user, isAuthenticated } = useAuth();
  const { phase, formattedTime } = useContest();

  const [selectedCoder, setSelectedCoder] = useState(ROOM_PARTICIPANTS[0]);
  const [selectedProblemCode, setSelectedProblemCode] = useState('B');
  const [counterTestcase, setCounterTestcase] = useState('3\n100000 100000 100000\n');
  const [testlibResult, setTestlibResult] = useState({ isValid: true, error: null });
  const [hackStatus, setHackStatus] = useState(null); // 'SUCCESS' | 'FAILED' | null
  const [isExecuting, setIsExecuting] = useState(false);
  const [roomData, setRoomData] = useState(ROOM_PARTICIPANTS);

  const activeProblem = selectedCoder.solvedProblems?.find((p) => p.code === selectedProblemCode) || selectedCoder.solvedProblems?.[0];

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

  const handleExecuteHack = () => {
    if (!testlibResult.isValid) {
      alert(`Không thể tung đòn Hack: Testlib Validator phát hiện lỗi "${testlibResult.error}". Hãy sửa lại format để tránh mất -50 điểm phạt!`);
      return;
    }

    setIsExecuting(true);
    setHackStatus(null);
    sound.playTick();

    setTimeout(() => {
      setIsExecuting(false);

      // In problem B: buggy_coder uses int (overflow with 100000) -> Hack Success!
      // alice_ninja uses python -> Hack Failed!
      const isVictimBuggy = selectedCoder.username === 'buggy_coder' && selectedProblemCode === 'B';

      if (isVictimBuggy) {
        sound.playHackSuccess();
        setHackStatus({
          type: 'SUCCESS',
          message: '🎯 HACK THÀNH CÔNG (+100đ)!',
          details: 'Mã nguồn đối thủ bị tràn số kiểu số nguyên 32-bit (Integer Overflow). Điểm bài nộp của đối thủ đã bị vô hiệu hóa!'
        });

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
        sound.playHackFailed();
        setHackStatus({
          type: 'FAILED',
          message: '❌ HACK THẤT BẠI (-50đ)!',
          details: 'Mã nguồn đối thủ đã xử lý đúng testcase của bạn và cho ra kết quả hoàn hảo. Bạn bị trừ 50 điểm phạt!'
        });
      }
    }, 800);
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#0b0f19] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      
      {/* 1. Room Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#131124] to-slate-900 border border-red-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-red-500" />
              Hack Room #1 (Phòng 25 Người)
            </span>
            <span className="text-xs text-slate-400 font-mono">Rating trung bình: 1680 Elo</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            ⚔️ Phòng Thách Đấu — Đấu Trường Bẻ Khóa Mã Nguồn
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Trong 15 phút Hack Phase, hãy mở code của các đối thủ cùng phòng, tìm bẫy tràn số hoặc ca biên và tung counter-testcase để ghi điểm!
          </p>
        </div>

        <div className="bg-black/60 p-4 rounded-xl border border-white/10 shrink-0 text-right font-mono">
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
        <div className="lg:col-span-4 bg-[#0e1424] border border-white/10 rounded-2xl p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs font-bold text-slate-300">
            <span>Danh Sách Đấu Thủ Cùng Phòng</span>
            <span className="text-slate-500 font-mono">25 Coder</span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[560px] pr-1">
            {roomData.map((coder) => {
              const isSelected = coder.id === selectedCoder.id;
              return (
                <div
                  key={coder.id}
                  onClick={() => setSelectedCoder(coder)}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-red-500/10 border-red-500/40 shadow-md'
                      : 'bg-white/5 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-orange-400">
                        {coder.username[0].toUpperCase()}
                      </div>
                      <div className="text-left leading-none">
                        <span className="font-bold text-white text-xs block">{coder.username}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{coder.rating} Elo</span>
                      </div>
                    </div>
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
                        {prob.isHacked ? `Bài ${prob.code} ✗` : `Bài ${prob.code} (+${prob.points})`}
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
        <div className="lg:col-span-8 bg-[#0e1424] border border-white/10 rounded-2xl p-6 flex flex-col space-y-5">
          
          {/* Victim Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Mục tiêu bẻ khóa:</span>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>{selectedCoder.username}</span>
                <span className="text-slate-500">•</span>
                <span className="text-[#ff6600]">Bài {selectedProblemCode}</span>
                {activeProblem?.isHacked ? (
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
                    ĐÃ BỊ BẺ KHÓA
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    Passed Pretests ({activeProblem?.points || 0}đ)
                  </span>
                )}
              </h2>
            </div>

            <div className="text-right text-xs font-mono text-slate-400">
              Ngôn ngữ: <b className="text-slate-200 uppercase">{activeProblem?.language || 'cpp'}</b>
            </div>
          </div>

          {/* Victim Source Code Viewer */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
              <span>Mã nguồn đối thủ (Chế độ đọc):</span>
              <span className="text-[11px] text-orange-400">⚠️ Tìm lỗi tràn int32 hoặc chia cho 0</span>
            </div>
            <pre className="p-4 rounded-xl bg-[#060912] border border-white/10 font-mono text-xs text-slate-300 overflow-x-auto max-h-60 leading-relaxed">
              {activeProblem?.codeContent || `// Không có mã nguồn khả dụng cho bài tập này.`}
            </pre>
          </div>

          {/* Counter-Testcase Input & Live Testlib Validator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Nhập dữ liệu bẻ khóa (Counter-Testcase):</span>
              {testlibResult.isValid ? (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> Testlib Validator: Hợp lệ
                </span>
              ) : (
                <span className="text-[11px] text-red-400 flex items-center gap-1 font-semibold">
                  <XCircle className="w-3.5 h-3.5" /> Testlib Error: {testlibResult.error}
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={counterTestcase}
              onChange={(e) => handleTestcaseChange(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#060912] border border-white/10 font-mono text-xs text-emerald-400 focus:border-red-500 outline-none"
              placeholder="VD: 3\n100000 100000 100000\n"
            />
            <p className="text-[11px] text-slate-500">
              * Quy chuẩn Testlib: Kết thúc bằng đúng một ký tự xuống dòng (\n), không có khoảng trắng thừa ở cuối dòng.
            </p>
          </div>

          {/* Hack Result Banner */}
          {hackStatus && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 animate-fadeIn ${
              hackStatus.type === 'SUCCESS'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {hackStatus.type === 'SUCCESS' ? (
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
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
              disabled={isExecuting || !testlibResult.isValid || activeProblem?.isHacked}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 font-extrabold text-sm text-white transition flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {isExecuting ? 'Đang kích hoạt Isolate Sandbox...' : '⚡ TUNG ĐÒN HACK (-50đ / +100đ)'}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
