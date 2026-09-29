import React, { createContext, useContext, useState, useEffect } from 'react';
import { calculateProblemScore } from '../core/scoring.js';
import { PROBLEMS_DB } from '../data/problems.js';
import { api, getToken } from '../lib/apiClient';

const CONTEST_SLUG = 'dever-round-1-div3';
const CONTEST_ID = 'contest_dever_round1';

const ContestContext = createContext(null);

export const ContestProvider = ({ children }) => {
  const [phase, setPhase] = useState(() => {
    return localStorage.getItem('dever_contest_phase') || 'CODING';
  });

  // Problems: server-only. Khởi đầu từ đề mẫu bundle, mount effect sẽ
  // thay bằng đề máy chủ khi online (merge giữ nháp local chưa publish).
  const [problems, setProblems] = useState(() => PROBLEMS_DB);

  // Contest timer in seconds (fallback demo khi chưa nối backend)
  const [remainingSeconds, setRemainingSeconds] = useState(4890);
  const [elapsedMinutes, setElapsedMinutes] = useState(38);
  const [serverOnline, setServerOnline] = useState(false);

  // Đồng bộ đồng hồ + phase từ máy chủ (backend là nguồn thật khi online)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getContest(CONTEST_SLUG);
        if (cancelled || !data?.contest) return;
        const c = data.contest;
        const totalSecs = (c.duration_minutes || 135) * 60;
        const elapsedSecs = Math.max(0, Math.floor((Date.now() - new Date(c.start_time).getTime()) / 1000));
        setRemainingSeconds(Math.max(0, totalSecs - elapsedSecs));
        setElapsedMinutes(Math.floor(elapsedSecs / 60));
        if (c.status && c.status !== phase) {
          setPhase(c.status);
          try { localStorage.setItem('dever_contest_phase', c.status); } catch {}
        }
        setServerOnline(true);
        // Online: đề thi lấy từ máy chủ làm chuẩn (merge giữ nháp local)
        loadProblemsFromServer().catch(() => {});
      } catch { /* giữ fallback demo */ }
    })();
    return () => { cancelled = true; };
    }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
      setElapsedMinutes((prev) => prev + 1 / 60);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // BroadcastChannel for cross-tab phase & problems & freeze sync
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('dever_arena_bus');
        channel.onmessage = (event) => {
          if (event.data?.type === 'CONTEST_PHASE_CHANGED') {
            setPhase(event.data.payload);
          }
          if (event.data?.type === 'PROBLEMS_UPDATED') {
            setProblems(event.data.payload);
          }
          if (event.data?.type === 'FREEZE_CHANGED') {
            setFrozen(!!event.data.payload);
          }
        };
      }
    } catch (e) {
      console.warn('Contest BroadcastChannel error:', e);
    }
    return () => {
      if (channel) channel.close();
    };
  }, []);

  const toggleFrozen = (value) => {
    const next = value !== undefined ? !!value : !frozen;
    setFrozen(next);
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('dever_arena_bus');
        channel.postMessage({ type: 'FREEZE_CHANGED', payload: next });
        channel.close();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const changePhase = (newPhase) => {
    setPhase(newPhase);
    try { localStorage.setItem('dever_contest_phase', newPhase); } catch {}
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('dever_arena_bus');
        channel.postMessage({ type: 'CONTEST_PHASE_CHANGED', payload: newPhase });
        channel.close();
      }
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Đổi phase đồng bộ local + máy chủ. Trả về { ok, error }.
   * Không token admin hoặc rớt mạng → chỉ đổi local, báo rõ lý do.
   */
  const changePhaseRemote = async (newPhase) => {
    changePhase(newPhase);
    if (!getToken()) return { ok: false, error: 'Cần đăng nhập tài khoản giám khảo để đổi phase trên máy chủ.' };
    try {
      await api.setPhase(CONTEST_ID, newPhase);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || 'Không đổi được phase trên máy chủ.' };
    }
  };

  // Đề thi sống trên máy chủ (server-only). Các hàm dưới chỉ phản chiếu
  // dữ liệu server vào state + broadcast cross-tab, KHÔNG persist local.
  const broadcastProblems = (updated) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('dever_arena_bus');
        channel.postMessage({ type: 'PROBLEMS_UPDATED', payload: updated });
        channel.close();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addProblem = (newProb) => {
    const updated = [...problems, newProb];
    setProblems(updated);
    broadcastProblems(updated);
  };

  const updateProblem = (updatedProb) => {
    const updated = problems.map((p) => (p.id === updatedProb.id ? updatedProb : p));
    setProblems(updated);
    broadcastProblems(updated);
  };

  const deleteProblem = (probId) => {
    const updated = problems.filter((p) => p.id !== probId);
    setProblems(updated);
    broadcastProblems(updated);
  };

  const resetProblems = () => {
    setProblems(PROBLEMS_DB);
    broadcastProblems(PROBLEMS_DB);
  };

  // Tải đề từ máy chủ (TẤT CẢ các kỳ — không neo kỳ demo cũ), MERGE với nháp trong memory
  // (server thắng khi trùng id, nháp chưa publish giữ lại trong phiên để không mất việc đang soạn).
  const loadProblemsFromServer = async () => {
    try {
      const data = await api.getProblems({});
      if (data?.problems && Array.isArray(data.problems) && data.problems.length > 0) {
        const serverIds = new Set(data.problems.map((p) => p.id));
        setProblems((prev) => {
          // Server là nguồn thật: giữ lại CHỈ nháp local chưa từng có trên server.
          const localOnly = (prev || []).filter((p) => !serverIds.has(p.id));
          const merged = [...data.problems, ...localOnly];
          broadcastProblems(merged);
          return merged;
        });
        return data.problems;
      }
    } catch {
      return null;
    }
  };

  const formatTimer = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getDynamicScore = (basePoints = 500, wrongAttempts = 0) => {
    return calculateProblemScore(basePoints, Math.floor(elapsedMinutes), wrongAttempts);
  };

  return (
    <ContestContext.Provider value={{
      phase,
      changePhase,
      changePhaseRemote,
      frozen,
      toggleFrozen,
      serverOnline,
      contestId: CONTEST_ID,
      contestSlug: CONTEST_SLUG,
      problems,
      addProblem,
      updateProblem,
      deleteProblem,
      resetProblems,
      loadProblemsFromServer,
      remainingSeconds,
      formattedTime: formatTimer(remainingSeconds),
      elapsedMinutes: Math.floor(elapsedMinutes),
      getDynamicScore
    }}>
      {children}
    </ContestContext.Provider>
  );
};

export const useContest = () => {
  const context = useContext(ContestContext);
  if (!context) throw new Error('useContest must be used within ContestProvider');
  return context;
};
