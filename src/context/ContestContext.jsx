import React, { createContext, useContext, useState, useEffect } from 'react';
import { calculateProblemScore } from '../core/scoring.js';
import { PROBLEMS_DB } from '../data/problems.js';

const ContestContext = createContext(null);

export const ContestProvider = ({ children }) => {
  const [phase, setPhase] = useState(() => {
    return localStorage.getItem('dever_contest_phase') || 'CODING';
  });

  // Problems state with LocalStorage persistence & BroadcastChannel sync
  const [problems, setProblems] = useState(() => {
    try {
      const saved = localStorage.getItem('dever_problems');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return PROBLEMS_DB;
  });

  // Contest timer in seconds (e.g. 120 mins = 7200s, starts at 4800s remaining for demo)
  const [remainingSeconds, setRemainingSeconds] = useState(4890);
  const [elapsedMinutes, setElapsedMinutes] = useState(38);

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

  // BroadcastChannel for cross-tab phase & problems change sync
  useEffect(() => {
    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('dever_arena_bus');
        channel.onmessage = (event) => {
          if (event.data?.type === 'CONTEST_PHASE_CHANGED') {
            console.log('[BroadcastChannel] Phase updated:', event.data.payload);
            setPhase(event.data.payload);
          }
          if (event.data?.type === 'PROBLEMS_UPDATED') {
            console.log('[BroadcastChannel] Problems updated:', event.data.payload);
            setProblems(event.data.payload);
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

  const changePhase = (newPhase) => {
    setPhase(newPhase);
    localStorage.setItem('dever_contest_phase', newPhase);
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

  const addProblem = (newProb) => {
    const updated = [...problems, newProb];
    setProblems(updated);
    try {
      localStorage.setItem('dever_problems', JSON.stringify(updated));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('dever_arena_bus');
        channel.postMessage({ type: 'PROBLEMS_UPDATED', payload: updated });
        channel.close();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateProblem = (updatedProb) => {
    const updated = problems.map((p) => (p.id === updatedProb.id ? updatedProb : p));
    setProblems(updated);
    try {
      localStorage.setItem('dever_problems', JSON.stringify(updated));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('dever_arena_bus');
        channel.postMessage({ type: 'PROBLEMS_UPDATED', payload: updated });
        channel.close();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteProblem = (probId) => {
    const updated = problems.filter((p) => p.id !== probId);
    setProblems(updated);
    try {
      localStorage.setItem('dever_problems', JSON.stringify(updated));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('dever_arena_bus');
        channel.postMessage({ type: 'PROBLEMS_UPDATED', payload: updated });
        channel.close();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetProblems = () => {
    setProblems(PROBLEMS_DB);
    try {
      localStorage.removeItem('dever_problems');
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('dever_arena_bus');
        channel.postMessage({ type: 'PROBLEMS_UPDATED', payload: PROBLEMS_DB });
        channel.close();
      }
    } catch (e) {
      console.error(e);
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
      problems,
      addProblem,
      updateProblem,
      deleteProblem,
      resetProblems,
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
