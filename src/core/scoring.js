/**
 * DEVER-Forces Core Scoring Engine
 * Triển khai công thức tính điểm đa thể thức: Codeforces Dynamic Decay, ICPC 20-minute Penalty, và IOI Subtasks.
 */

// ==========================================
// 1. THỂ THỨC CODEFORCES (DYNAMIC POINT DECAY)
// ==========================================

/**
 * Tính điểm thực nhận khi giải thành công một bài toán tại phút thứ t với W lần nộp sai.
 * @param {number} maxPoints - Điểm ban đầu của bài (VD: 500, 1000, 1500, 2000, 2500)
 * @param {number} elapsedMinutes - Số phút trôi qua từ lúc bắt đầu contest (0 <= t <= contestDuration)
 * @param {number} wrongAttempts - Số lần nộp sai trên Pretest trước khi Accepted (W >= 0)
 * @returns {number} Điểm thực nhận được làm tròn xuống
 */
export function calculateProblemScore(maxPoints, elapsedMinutes, wrongAttempts = 0) {
  if (maxPoints <= 0) return 0;
  const t = Math.max(0, elapsedMinutes);
  const w = Math.max(0, wrongAttempts);

  // Điểm sàn tối thiểu (30% maxPoints)
  const floorPoints = Math.floor(0.3 * maxPoints);

  // Suy giảm theo thời gian: mỗi phút mất (maxPoints / 250)
  const timePenalty = Math.floor((maxPoints * t) / 250);

  // Phạt mỗi lần nộp sai 50 điểm
  const wrongPenalty = w * 50;

  const calculated = maxPoints - timePenalty - wrongPenalty;
  return Math.max(floorPoints, calculated);
}

/**
 * Tính điểm từ hoạt động Hack trong Room
 * @param {number} successfulHacks - Số lần hack thành công (+100đ mỗi lần)
 * @param {number} unsuccessfulHacks - Số lần hack thất bại (-50đ mỗi lần)
 * @returns {number} Điểm hack ròng (có thể âm nếu hack trượt nhiều)
 */
export function calculateHackScore(successfulHacks = 0, unsuccessfulHacks = 0) {
  const succ = Math.max(0, successfulHacks);
  const unsucc = Math.max(0, unsuccessfulHacks);
  return (succ * 100) - (unsucc * 50);
}

/**
 * Tính tổng điểm của một thí sinh trong contest chuẩn Codeforces
 * @param {Array<{ maxPoints: number, elapsedMinutes: number, wrongAttempts: number, solved: boolean }>} submissions 
 * @param {number} successfulHacks 
 * @param {number} unsuccessfulHacks 
 * @returns {number} Tổng điểm cuối cùng
 */
export function calculateTotalScore(submissions = [], successfulHacks = 0, unsuccessfulHacks = 0) {
  let problemScore = 0;
  for (const sub of submissions) {
    if (sub.solved) {
      problemScore += calculateProblemScore(sub.maxPoints, sub.elapsedMinutes, sub.wrongAttempts);
    }
  }
  const hackScore = calculateHackScore(successfulHacks, unsuccessfulHacks);
  return problemScore + hackScore;
}

// ==========================================
// 2. THỂ THỨC ICPC (SOLVED COUNT & 20-MIN PENALTY)
// ==========================================

/**
 * Tính kết quả thi đấu theo thể thức ICPC quốc tế
 * @param {Array<{ solved: boolean, elapsedMinutes: number, wrongAttempts: number }>} problemResults 
 * @returns {{ solvedCount: number, totalPenalty: number }}
 */
export function calculateIcpcScore(problemResults = []) {
  let solvedCount = 0;
  let totalPenalty = 0;

  for (const prob of problemResults) {
    if (prob.solved) {
      solvedCount += 1;
      // Penalty = Phút AC + (20 phút x số lần nộp sai trước khi AC)
      const problemPenalty = Math.max(0, prob.elapsedMinutes) + (Math.max(0, prob.wrongAttempts) * 20);
      totalPenalty += problemPenalty;
    }
    // Chú ý: Bài không giải được thì KHÔNG bị tính penalty
  }

  return { solvedCount, totalPenalty };
}

/**
 * So sánh thứ hạng 2 đội theo thể thức ICPC
 * Đội nào giải nhiều bài hơn thì xếp trên. Nếu bằng bài, đội ít penalty hơn xếp trên.
 * @returns {number} < 0 nếu A xếp trên B, > 0 nếu B xếp trên A, 0 nếu hòa hoàn toàn
 */
export function compareIcpcRanking(teamA, teamB) {
  if (teamA.solvedCount !== teamB.solvedCount) {
    return teamB.solvedCount - teamA.solvedCount; // Nhiều bài hơn xếp trên
  }
  return teamA.totalPenalty - teamB.totalPenalty; // Ít penalty hơn xếp trên
}

// ==========================================
// 3. THỂ THỨC IOI / SUBTASKS (0-100 ĐIỂM)
// ==========================================

/**
 * Tính điểm theo thể thức Olympic Tin học IOI (tổng điểm các Subtask hợp lệ)
 * @param {Array<{ subtaskId: number, points: number, passed: boolean }>} subtasks 
 * @returns {number} Tổng điểm đạt được (từ 0 đến 100)
 */
export function calculateIoiScore(subtasks = []) {
  let total = 0;
  for (const st of subtasks) {
    if (st.passed) {
      total += Math.max(0, st.points);
    }
  }
  return Math.min(100, total);
}
