/**
 * DEVER Arena — Core Virtual Contest Engine
 * Hỗ trợ tham gia thi đấu lại contest quá khứ với đồng hồ ảo cá nhân và
 * mô phỏng replay bài nộp của đối thủ lịch sử (Ghost Submissions Replay).
 */

import { calculateProblemScore } from './scoring.js';

/**
 * Khởi tạo một phiên thi ảo
 * @param {string} contestId - ID kỳ thi gốc
 * @param {string} userId - ID của thí sinh thi ảo
 * @param {number} durationMinutes - Thời lượng thi (mặc định 120 phút)
 * @param {number} startTime - Mốc thời gian bắt đầu (mặc định Date.now())
 * @returns {object} Session object
 */
export function createVirtualSession(contestId, userId, durationMinutes = 120, startTime = Date.now()) {
  if (!contestId || !userId) {
    throw new Error('contestId và userId là bắt buộc');
  }
  const duration = Math.max(1, durationMinutes);
  return {
    id: `vsession_${contestId}_${userId}_${startTime}`,
    contestId,
    userId,
    startTime,
    durationMinutes: duration,
    isFinished: false
  };
}

/**
 * Tính toán số phút đã trôi qua trong phiên thi ảo
 * @param {object} session - Phiên thi ảo
 * @param {number} currentTimestamp - Thời điểm hiện tại (mặc định Date.now())
 * @returns {number} Số phút đã trôi qua (bị chặn trên bởi durationMinutes)
 */
export function getVirtualElapsedMinutes(session, currentTimestamp = Date.now()) {
  if (!session || typeof session.startTime !== 'number') return 0;
  const elapsedMs = Math.max(0, currentTimestamp - session.startTime);
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  return Math.min(session.durationMinutes, elapsedMinutes);
}

/**
 * Lọc các bài nộp lịch sử (Ghost Submissions) xuất hiện trước hoặc đúng phút elapsedMinutes
 * @param {Array<object>} historicalSubmissions - Toàn bộ bài nộp của contest gốc
 * @param {number} elapsedMinutes - Số phút đã trôi qua của phiên thi ảo
 * @returns {Array<object>} Danh sách bài nộp hiển thị tại mốc thời gian ảo
 */
export function filterGhostSubmissions(historicalSubmissions, elapsedMinutes) {
  if (!Array.isArray(historicalSubmissions)) return [];
  const t = Math.max(0, elapsedMinutes);
  return historicalSubmissions.filter(sub => {
    // sub có thể có thuộc tính contest_minute hoặc minute_offset
    const minute = typeof sub.contest_minute === 'number' 
      ? sub.contest_minute 
      : (typeof sub.minute_offset === 'number' ? sub.minute_offset : 0);
    return minute <= t;
  });
}

/**
 * Tính bảng xếp hạng Standings kết hợp giữa bài nộp của Thí sinh ảo và các bài nộp Ghost
 * @param {object} options
 * @param {object} options.virtualUser - Thông tin thí sinh ảo ({ id, username, name, rating, clan })
 * @param {Array<object>} options.virtualSubmissions - Danh sách bài nộp của thí sinh ảo
 * @param {Array<object>} options.ghostSubmissions - Toàn bộ bài nộp lịch sử của contest gốc
 * @param {number} options.elapsedMinutes - Số phút ảo hiện tại
 * @param {Array<object>} options.problems - Danh sách bài toán của kỳ thi
 * @returns {Array<object>} Danh sách standings đã sắp xếp từ cao xuống thấp kèm rank
 */
export function calculateVirtualStandings({
  virtualUser,
  virtualSubmissions = [],
  ghostSubmissions = [],
  elapsedMinutes = 0,
  problems = []
}) {
  const visibleGhosts = filterGhostSubmissions(ghostSubmissions, elapsedMinutes);
  
  // Bản đồ điểm bài toán mặc định (nếu không truyền problems, dùng fallback)
  const problemPointsMap = {};
  problems.forEach(p => {
    problemPointsMap[p.id] = p.base_points || p.points || 500;
  });

  // Gom nhóm bài nộp theo user
  const userMap = {};

  // Đưa virtual user vào danh sách
  if (virtualUser && virtualUser.id) {
    userMap[virtualUser.id] = {
      id: virtualUser.id,
      username: virtualUser.username || 'Virtual_Contestant',
      name: virtualUser.name || 'Thí sinh Ảo',
      rating: virtualUser.rating || 1500,
      clan: virtualUser.clan || 'DEVER',
      isVirtual: true,
      problems: {},
      totalScore: 0
    };
  }

  // Khởi tạo các user từ ghost submissions
  visibleGhosts.forEach(sub => {
    const uid = sub.user_id;
    if (!userMap[uid]) {
      userMap[uid] = {
        id: uid,
        username: sub.username || uid,
        name: sub.name || uid,
        rating: sub.rating || 1500,
        clan: sub.clan || 'DEVER',
        isVirtual: false,
        problems: {},
        totalScore: 0
      };
    }
  });

  // Xử lý ghost submissions
  visibleGhosts.forEach(sub => {
    const u = userMap[sub.user_id];
    if (!u) return;
    const pid = sub.problem_id;
    const subMinute = typeof sub.contest_minute === 'number' ? sub.contest_minute : (sub.minute_offset || 0);

    if (!u.problems[pid]) {
      u.problems[pid] = {
        verdict: sub.verdict,
        score: 0,
        attempts: 0,
        solvedMinute: null
      };
    }

    if (sub.verdict === 'OK' || sub.verdict === 'ACCEPTED') {
      if (u.problems[pid].verdict !== 'OK' && u.problems[pid].verdict !== 'ACCEPTED') {
        const basePts = problemPointsMap[pid] || 500;
        const score = typeof sub.points_awarded === 'number'
          ? sub.points_awarded
          : calculateProblemScore(basePts, subMinute, u.problems[pid].attempts);
        u.problems[pid].verdict = 'OK';
        u.problems[pid].score = score;
        u.problems[pid].solvedMinute = subMinute;
      }
    } else {
      if (u.problems[pid].verdict !== 'OK' && u.problems[pid].verdict !== 'ACCEPTED') {
        u.problems[pid].attempts += 1;
        u.problems[pid].verdict = sub.verdict;
      }
    }
  });

  // Xử lý virtual submissions
  if (virtualUser && virtualUser.id) {
    const vu = userMap[virtualUser.id];
    virtualSubmissions.forEach(sub => {
      const pid = sub.problem_id;
      const subMinute = Math.min(elapsedMinutes, typeof sub.contest_minute === 'number' ? sub.contest_minute : (sub.minute_offset || 0));

      if (!vu.problems[pid]) {
        vu.problems[pid] = {
          verdict: sub.verdict,
          score: 0,
          attempts: 0,
          solvedMinute: null
        };
      }

      if (sub.verdict === 'OK' || sub.verdict === 'ACCEPTED') {
        if (vu.problems[pid].verdict !== 'OK' && vu.problems[pid].verdict !== 'ACCEPTED') {
          const basePts = problemPointsMap[pid] || 500;
          const score = typeof sub.points_awarded === 'number'
            ? sub.points_awarded
            : calculateProblemScore(basePts, subMinute, vu.problems[pid].attempts);
          vu.problems[pid].verdict = 'OK';
          vu.problems[pid].score = score;
          vu.problems[pid].solvedMinute = subMinute;
        }
      } else {
        if (vu.problems[pid].verdict !== 'OK' && vu.problems[pid].verdict !== 'ACCEPTED') {
          vu.problems[pid].attempts += 1;
          vu.problems[pid].verdict = sub.verdict;
        }
      }
    });
  }

  // Tính tổng điểm cho mỗi user
  const standings = Object.values(userMap).map(u => {
    let totalScore = 0;
    let solvedCount = 0;
    Object.values(u.problems).forEach(prob => {
      if (prob.verdict === 'OK' || prob.verdict === 'ACCEPTED') {
        totalScore += prob.score;
        solvedCount += 1;
      }
    });
    return {
      ...u,
      totalScore,
      solvedCount
    };
  });

  // Sắp xếp: tổng điểm giảm dần, sau đó đến số bài giải được giảm dần
  standings.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    return a.username.localeCompare(b.username);
  });

  // Gán rank 1, 2, 3...
  standings.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return standings;
}
