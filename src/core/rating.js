/**
 * DEVER-Forces Core Rating Engine
 * Triển khai thuật toán tính biến động Elo / Rating chuẩn Codeforces
 */

export const RATING_TIERS = [
  { name: 'Newbie', min: 0, max: 1199, color: '#808080', badge: 'Bug Finder' },
  { name: 'Pupil', min: 1200, max: 1399, color: '#008000', badge: 'Code Crafter' },
  { name: 'Specialist', min: 1400, max: 1599, color: '#03A89E', badge: 'Algorithm Adept' },
  { name: 'Expert', min: 1600, max: 1899, color: '#0000FF', badge: 'Arena Warrior' },
  { name: 'Candidate Master', min: 1900, max: 2199, color: '#AA00AA', badge: 'Grand Strategist' },
  { name: 'Master', min: 2200, max: 2399, color: '#FF8C00', badge: 'DEVER Legend' },
  { name: 'Grandmaster', min: 2400, max: 9999, color: '#FF0000', badge: 'Code Overlord' }
];

/**
 * Lấy thông tin Tier dựa vào điểm Rating hiện tại
 * @param {number} rating 
 * @returns {object} Thông tin tier (name, color, badge)
 */
export function getRatingTier(rating) {
  const r = Math.max(0, Math.round(rating));
  for (const tier of RATING_TIERS) {
    if (r >= tier.min && r <= tier.max) {
      return tier;
    }
  }
  return RATING_TIERS[RATING_TIERS.length - 1];
}

/**
 * Xác suất người chơi B có điểm cao hơn người chơi A
 * @param {number} ratingA 
 * @param {number} ratingB 
 * @returns {number} Giá trị trong khoảng (0, 1)
 */
export function getWinProbability(ratingA, ratingB) {
  return 1.0 / (1.0 + Math.pow(10.0, (ratingA - ratingB) / 400.0));
}

/**
 * Tính seed (thứ hạng kỳ vọng) của một thí sinh với mức rating giả định
 * @param {number} targetRating 
 * @param {Array<number>} allRatings 
 * @param {number} selfIndex 
 * @returns {number}
 */
export function calculateSeed(targetRating, allRatings, selfIndex) {
  let seed = 1.0;
  for (let i = 0; i < allRatings.length; i++) {
    if (i !== selfIndex) {
      seed += getWinProbability(targetRating, allRatings[i]);
    }
  }
  return seed;
}

/**
 * Tìm mức rating tương ứng với một thứ hạng mục tiêu bằng Binary Search
 * @param {number} targetRank 
 * @param {Array<number>} allRatings 
 * @param {number} selfIndex 
 * @returns {number}
 */
export function getRatingForRank(targetRank, allRatings, selfIndex) {
  let low = 1;
  let high = 5000;

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (calculateSeed(mid, allRatings, selfIndex) < targetRank) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return low;
}

/**
 * Tính toán biến động Rating (Delta) cho toàn bộ thí sinh sau một kỳ thi
 * @param {Array<{ id: string, name: string, oldRating: number, points: number }>} participants 
 * @returns {Array<{ id: string, name: string, oldRating: number, newRating: number, delta: number, rank: number }>}
 */
export function calculateContestRatingChanges(participants) {
  if (!participants || participants.length === 0) return [];
  if (participants.length === 1) {
    return [{
      ...participants[0],
      rank: 1,
      delta: 0,
      newRating: participants[0].oldRating
    }];
  }

  // 1. Sắp xếp thí sinh theo điểm giảm dần
  const sorted = [...participants].sort((a, b) => b.points - a.points);
  const n = sorted.length;

  // 2. Gán thứ hạng thực tế (xử lý đồng điểm bằng trung bình thứ hạng)
  const actualRanks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && sorted[j].points === sorted[i].points) {
      j++;
    }
    // Những người từ i đến j-1 có cùng điểm
    const avgRank = (i + 1 + j) / 2.0;
    for (let k = i; k < j; k++) {
      actualRanks[k] = avgRank;
    }
    i = j;
  }

  const ratings = sorted.map(p => p.oldRating);

  // 3. Tính Delta sơ bộ cho từng người
  const deltas = new Array(n);
  for (let idx = 0; idx < n; idx++) {
    const seed = calculateSeed(ratings[idx], ratings, idx);
    const geometricMeanRank = Math.sqrt(seed * actualRanks[idx]);
    const performanceRating = getRatingForRank(geometricMeanRank, ratings, idx);
    deltas[idx] = Math.round((performanceRating - ratings[idx]) / 2.0);
  }

  // 4. Điều chỉnh chống lạm phát điểm (Zero-sum balance)
  const sumDelta = deltas.reduce((acc, d) => acc + d, 0);
  const adjustment = Math.round(-sumDelta / n - 1);

  return sorted.map((p, idx) => {
    const finalDelta = deltas[idx] + adjustment;
    const newRating = Math.max(1, p.oldRating + finalDelta);
    return {
      id: p.id,
      name: p.name,
      oldRating: p.oldRating,
      newRating,
      delta: finalDelta,
      rank: actualRanks[idx],
      tier: getRatingTier(newRating)
    };
  });
}
