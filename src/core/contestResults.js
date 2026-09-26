/**
 * DEVER Arena — Contest Results (pure core).
 *
 * Module thuật toán THUẦN: không IO, không Date/Math.random,
 * không import backend/UI. Chỉ tính toán trên dữ liệu truyền vào
 * và trả về dữ liệu mới (không mutate input).
 */

/**
 * @typedef {object} FreezeProblemIn
 * @property {number} [points] - Điểm hiển thị của bài.
 * @property {string} [status] - Trạng thái (VD: 'AC', 'WA', ...).
 * @property {number} [attempts] - Số lần nộp.
 * @property {number} [minute] - Phút nộp bài giải đúng (có thể undefined).
 */

/**
 * @typedef {object} FreezeRowIn
 * @property {string} user_id
 * @property {string} username
 * @property {number} [total] - Tổng điểm hiển thị (sẽ tính lại).
 * @property {number} [hackDelta] - Điểm hack cộng thêm (giữ nguyên nếu có).
 * @property {Record<string, FreezeProblemIn>} [problems]
 */

/**
 * @typedef {object} ApplyFreezeOpts
 * @property {number} freezeMinute - Mốc phút bắt đầu freeze (che khi minute > mốc).
 * @property {number} [elapsedMinute] - Phút hiện tại (nhận vào nhưng KHÔNG dùng để đoán khi thiếu minute).
 * @property {string[]} [problemCodes] - Nếu có, chỉ xét freeze các code này; nếu thiếu, xét mọi code trong row.
 */

/**
 * Đóng băng standings: che các bài giải sau mốc freeze.
 *
 * Quy tắc:
 * - Chỉ che khi `minute` là number và `minute > freezeMinute`.
 * - Thiếu `minute` (undefined) thì GIỮ NGUYÊN, kể cả khi `status === 'AC'`
 *   và `elapsedMinute > freezeMinute` (không đoán).
 * - Bài bị che thành `{ points: 0, status: 'FROZEN', attempts }`.
 * - `total` tính lại = tổng `points` các bài còn hiện + `hackDelta` (0 nếu row không có).
 * - Không mutate input (deep clone qua JSON).
 *
 * @param {FreezeRowIn[]} standings - Bảng điểm đầu vào.
 * @param {ApplyFreezeOpts} opts - Tùy chọn freeze.
 * @returns {FreezeRowIn[]} Standings mới đã đóng băng.
 *
 * @example
 * applyFreeze(rows, { freezeMinute: 90, elapsedMinute: 100 });
 * applyFreeze(rows, { freezeMinute: 90, elapsedMinute: 100, problemCodes: ['A', 'B'] });
 */
export function applyFreeze(standings, opts) {
  if (!Array.isArray(standings)) return [];
  const freezeMinute = opts?.freezeMinute;
  const problemCodes = opts?.problemCodes;
  // elapsedMinute được nhận vào theo chữ ký nhưng cố ý KHÔNG dùng để suy đoán
  // khi thiếu minute (giữ nguyên bài đó).

  const cloned = JSON.parse(JSON.stringify(standings));
  const codeSet = Array.isArray(problemCodes) ? new Set(problemCodes) : null;

  for (const row of cloned) {
    const problems = row.problems ?? {};
    let sum = 0;
    for (const [code, prob] of Object.entries(problems)) {
      if (codeSet !== null && !codeSet.has(code)) {
        sum += typeof prob?.points === 'number' ? prob.points : 0;
        continue;
      }
      const minute = prob?.minute;
      const shouldHide =
        typeof freezeMinute === 'number' &&
        typeof minute === 'number' &&
        minute > freezeMinute;
      if (shouldHide) {
        const attempts = typeof prob?.attempts === 'number' ? prob.attempts : (prob?.attempts ?? 0);
        problems[code] = { points: 0, status: 'FROZEN', attempts };
      } else {
        sum += typeof prob?.points === 'number' ? prob.points : 0;
      }
    }
    row.problems = problems;
    const hackDelta = typeof row.hackDelta === 'number' ? row.hackDelta : 0;
    row.total = sum + hackDelta;
  }

  return cloned;
}

/**
 * @typedef {object} IcpcSolveIn
 * @property {string} code
 * @property {number} [minute]
 * @property {number} [wrongAttempts]
 * @property {boolean} solved
 */

/**
 * @typedef {object} IcpcRowIn
 * @property {string} user_id
 * @property {string} username
 * @property {IcpcSolveIn[]} [solves]
 */

/**
 * @typedef {IcpcRowIn & { solved: number, penalty: number, rank: number }} IcpcRowOut
 */

/**
 * Xếp hạng ICPC: solved giảm dần, rồi penalty tăng dần.
 *
 * - `penalty` = tổng trên các bài `solved` của `(minute + 20 * wrongAttempts)`
 *   (thiếu `minute`/`wrongAttempts` coi như 0; giá trị âm kẹp về 0).
 * - Bài `solved` falsy thì bỏ qua (không cộng penalty).
 * - Đồng `solved` + `penalty` thì cùng `rank` (competition ranking: 1,2,2,4).
 * - Không mutate input.
 *
 * @param {IcpcRowIn[]} rows - Danh sách thí sinh + chi tiết từng bài.
 * @returns {IcpcRowOut[]} Mảng đã sắp xếp, mỗi row thêm `{ solved, penalty, rank }`.
 *
 * @example
 * computeIcpcStandings([{ user_id: 'u1', username: 'a', solves: [{ code: 'A', minute: 20, wrongAttempts: 1, solved: true }] }]);
 * computeIcpcStandings(rows).map(r => [r.username, r.solved, r.penalty, r.rank]);
 */
export function computeIcpcStandings(rows) {
  if (!Array.isArray(rows)) return [];
  const cloned = JSON.parse(JSON.stringify(rows));

  const scored = cloned.map((row) => {
    const solves = Array.isArray(row.solves) ? row.solves : [];
    let solved = 0;
    let penalty = 0;
    for (const s of solves) {
      if (s && s.solved) {
        solved += 1;
        const minute = typeof s.minute === 'number' ? Math.max(0, s.minute) : 0;
        const wa = typeof s.wrongAttempts === 'number' ? Math.max(0, s.wrongAttempts) : 0;
        penalty += minute + 20 * wa;
      }
    }
    return { ...row, solves, solved, penalty };
  });

  scored.sort((a, b) => {
    if (b.solved !== a.solved) return b.solved - a.solved;
    return a.penalty - b.penalty;
  });

  let rank = 0;
  for (let i = 0; i < scored.length; i++) {
    if (
      i > 0 &&
      scored[i].solved === scored[i - 1].solved &&
      scored[i].penalty === scored[i - 1].penalty
    ) {
      scored[i].rank = rank;
    } else {
      rank = i + 1;
      scored[i].rank = rank;
    }
  }

  return scored;
}
