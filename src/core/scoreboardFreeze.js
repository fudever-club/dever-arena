/**
 * DEVER Arena Scoreboard Freeze & ICPC Dramatic Unfreeze Simulator
 * Cơ chế đóng băng bảng xếp hạng trong giai đoạn cuối contest (30 hoặc 60 phút cuối)
 * và sinh kịch bản giải mã bảng điểm kịch tính từng bước (ICPC World Finals Style).
 */

/**
 * Kiểm tra xem bảng điểm có đang trong trạng thái đóng băng hay không
 * @param {number} contestDurationMinutes Thời lượng contest (ví dụ 120 phút)
 * @param {number} elapsedMinutes Số phút đã trôi qua
 * @param {number} [freezeDurationMinutes=30] Số phút đóng băng cuối contest
 * @returns {boolean}
 */
export function isScoreboardFrozen(contestDurationMinutes, elapsedMinutes, freezeDurationMinutes = 30) {
  const freezeStartMinute = Math.max(0, contestDurationMinutes - freezeDurationMinutes);
  return elapsedMinutes >= freezeStartMinute;
}

/**
 * Tạo bảng điểm đóng băng từ danh sách standings và bài nộp
 * @param {Array<object>} standings Bảng điểm hiện tại
 * @param {Array<object>} submissions Danh sách toàn bộ bài nộp
 * @param {number} freezeMinute Mốc phút bắt đầu đóng băng (ví dụ: phút 90 trong contest 120p)
 * @returns {Array<object>} Bảng điểm đóng băng với các bài nộp sau freeze chuyển thành '?'
 */
export function createFrozenStandings(standings, submissions = [], freezeMinute = 90) {
  if (!Array.isArray(standings)) return [];

  // Tạo map tra cứu các bài nộp sau mốc freeze theo `user_id` và `problem_id`
  const postFreezeSubmissions = new Map();
  for (const sub of submissions) {
    const subMinute = sub.contest_minute ?? (sub.submitted_at ? Math.round((sub.submitted_at - (sub.contest_start_time || sub.submitted_at)) / 60000) : 0);
    if (subMinute > freezeMinute) {
      const key = `${sub.user_id}_${sub.problem_id}`;
      const list = postFreezeSubmissions.get(key) || [];
      list.push(sub);
      postFreezeSubmissions.set(key, list);
    }
  }

  const frozenList = standings.map(coder => {
    const frozenProblems = {};
    let frozenScore = 0;
    let preFreezeScore = 0;

    const coderProblems = coder.problems || {};
    for (const [probCode, probData] of Object.entries(coderProblems)) {
      const solvedMinute = probData.solved_minute ?? probData.minute ?? 0;
      const subKey = `${coder.user_id}_${probData.problem_id || probCode}`;
      const postSubs = postFreezeSubmissions.get(subKey) || [];

      if (probData.solved && solvedMinute <= freezeMinute) {
        // Bài giải đúng trước mốc freeze: hiển thị công khai
        frozenProblems[probCode] = {
          ...probData,
          is_frozen: false,
          display: `+${probData.points || probData.score || 1}`
        };
        frozenScore += (probData.points || probData.score || 0);
        preFreezeScore += (probData.points || probData.score || 0);
      } else if (postSubs.length > 0 || (probData.solved && solvedMinute > freezeMinute)) {
        // Có bài nộp trong lúc đóng băng: che giấu kết quả
        const attemptsCount = postSubs.length || (probData.wrong_attempts || 0) + 1;
        frozenProblems[probCode] = {
          ...probData,
          is_frozen: true,
          display: `? ${attemptsCount}`,
          frozen_attempts: attemptsCount,
          actual_solved: probData.solved,
          actual_points: probData.points || probData.score || 0
        };
      } else {
        // Không nộp hoặc sai trước freeze
        frozenProblems[probCode] = {
          ...probData,
          is_frozen: false,
          display: probData.wrong_attempts ? `-${probData.wrong_attempts}` : '.'
        };
      }
    }

    const hackScore = coder.hack_score || 0;

    return {
      ...coder,
      score: frozenScore + hackScore,
      frozen_score: frozenScore + hackScore,
      pre_freeze_score: preFreezeScore + hackScore,
      actual_final_score: coder.score,
      problems: frozenProblems,
      has_frozen_problems: Object.values(frozenProblems).some(p => p.is_frozen)
    };
  });

  // Sắp xếp lại thứ hạng theo điểm số bị đóng băng
  frozenList.sort((a, b) => b.score - a.score);
  return frozenList.map((coder, idx) => ({ ...coder, rank: idx + 1 }));
}

/**
 * Sinh chuỗi kịch bản giải mã bảng xếp hạng (ICPC Dramatic Unfreeze Sequence)
 * Đi từ đội có thứ hạng thấp nhất có bài bị đóng băng, lần lượt lật mở kết quả
 * và tính toán các pha nhảy vọt thứ hạng (Rank Jump).
 * @param {Array<object>} frozenStandings Bảng điểm đã đóng băng
 * @returns {Array<object>} Danh sách các bước unfreeze tuần tự
 */
export function generateUnfreezeStepSequence(frozenStandings) {
  if (!Array.isArray(frozenStandings)) return [];

  // Tạo bản sao làm việc của bảng điểm
  const currentBoard = frozenStandings.map(c => ({
    ...c,
    problems: { ...c.problems }
  }));

  const sequence = [];
  let stepIndex = 1;

  // Lặp cho đến khi không còn bài toán nào bị đóng băng
  while (true) {
    // Sắp xếp bảng điểm theo điểm hiện tại
    currentBoard.sort((a, b) => b.score - a.score);
    currentBoard.forEach((c, idx) => { c.rank = idx + 1; });

    // Tìm thí sinh ở vị trí thấp nhất (rank lớn nhất) vẫn còn bài toán bị đóng băng
    let candidateIndex = -1;
    for (let i = currentBoard.length - 1; i >= 0; i--) {
      const hasFrozen = Object.values(currentBoard[i].problems).some(p => p.is_frozen);
      if (hasFrozen) {
        candidateIndex = i;
        break;
      }
    }

    // Nếu không còn thí sinh nào có bài đóng băng -> Hoàn tất kịch bản!
    if (candidateIndex === -1) break;

    const team = currentBoard[candidateIndex];
    const oldRank = team.rank;

    // Tìm bài toán bị đóng băng đầu tiên của thí sinh này
    const frozenEntry = Object.entries(team.problems).find(([, p]) => p.is_frozen);
    if (!frozenEntry) continue;

    const [probCode, probData] = frozenEntry;
    const isAccepted = Boolean(probData.actual_solved);
    const pointsGained = isAccepted ? (probData.actual_points || 500) : 0;

    // Cập nhật trạng thái bài toán sau khi lật mở
    probData.is_frozen = false;
    probData.display = isAccepted ? `+${pointsGained}` : `-${probData.frozen_attempts || 1}`;

    // Cập nhật điểm của thí sinh
    team.score += pointsGained;

    // Tính toán thứ hạng mới sau khi cộng điểm
    const prospectiveBoard = currentBoard.map(c => ({ ...c }));
    prospectiveBoard.sort((a, b) => b.score - a.score);
    const newRank = prospectiveBoard.findIndex(c => c.user_id === team.user_id) + 1;

    const isJump = newRank < oldRank;

    sequence.push({
      stepIndex: stepIndex++,
      userId: team.user_id,
      username: team.username,
      problemCode: probCode,
      isAccepted,
      pointsGained,
      oldScore: team.score - pointsGained,
      newScore: team.score,
      oldRank,
      newRank,
      rankDelta: oldRank - newRank, // Số bậc nhảy lên (+3, +5 bậc)
      isJump,
      narration: isAccepted 
        ? (isJump ? `🔥 ${team.username} AC bài ${probCode}! Nhảy từ Hạng ${oldRank} lên Hạng ${newRank}!` : `✨ ${team.username} AC bài ${probCode} (+${pointsGained}đ) giữ Hạng ${newRank}.`)
        : `❌ ${team.username} không vượt qua bài ${probCode} (Wrong Answer).`
    });

    // Cập nhật lại rank thực tế
    team.rank = newRank;
  }

  return sequence;
}

/**
 * Thực hiện 1 bước giải mã (Unfreeze Step) trên bảng xếp hạng đang hiển thị
 * @param {Array<object>} standings Bảng điểm hiện tại
 * @param {object} step Bước giải mã từ generateUnfreezeStepSequence
 * @returns {Array<object>} Bảng điểm mới sau khi thực thi bước đó
 */
export function applyUnfreezeStep(standings, step) {
  if (!Array.isArray(standings) || !step) return standings;

  const nextStandings = standings.map(coder => {
    if (coder.user_id === step.userId) {
      const updatedProblems = { ...coder.problems };
      if (updatedProblems[step.problemCode]) {
        updatedProblems[step.problemCode] = {
          ...updatedProblems[step.problemCode],
          is_frozen: false,
          display: step.isAccepted ? `+${step.pointsGained}` : `WA`
        };
      }
      return {
        ...coder,
        score: step.newScore,
        problems: updatedProblems
      };
    }
    return { ...coder };
  });

  // Tái sắp xếp và đánh lại thứ hạng
  nextStandings.sort((a, b) => b.score - a.score);
  return nextStandings.map((c, idx) => ({ ...c, rank: idx + 1 }));
}
