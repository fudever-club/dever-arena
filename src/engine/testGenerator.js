/**
 * DEVER Arena — Test Generator Engine (chuẩn Polygon: generator + script).
 * Thuần JS, không DOM — dùng chung browser (Studio) và Node (server stress).
 *
 * Phạm vi v1: bài dạng `N` + dãy `A[1..N]` (khớp testlibValidator).
 * Mọi suite luôn gồm bẫy biên: N min, N max, N=1, toàn bằng nhau, tràn số.
 * Seeded PRNG (mulberry32) → cùng seed sinh cùng bộ test (tái hiện được).
 */

/** Băm chuỗi seed thành số nguyên 32-bit. */
export function hashSeed(seed) {
  const s = String(seed ?? 'dever');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG mulberry32 determinist. */
export function mulberry32(seedInt) {
  let a = seedInt >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/**
 * Sinh 1 testcase mảng.
 * @param {object} o
 * @param {number} o.n Số phần tử
 * @param {number} [o.minVal=-1e9] [o.maxVal=1e9]
 * @param {'random'|'sorted-asc'|'sorted-desc'|'all-equal'|'alternating'|'extreme'} [o.pattern='random']
 * @param {Function} o.rnd PRNG
 * @returns {{ stdin: string, strategy: string }}
 */
export function generateArrayCase({ n, minVal = -1000000000, maxVal = 1000000000, pattern = 'random', rnd }) {
  const next = rnd || Math.random;
  let arr = [];
  if (pattern === 'all-equal') {
    const v = randInt(next, minVal, maxVal);
    arr = new Array(n).fill(v);
  } else if (pattern === 'alternating') {
    const a = randInt(next, minVal, maxVal);
    const b = a === maxVal ? a - 1 : a + 1;
    arr = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a : b));
  } else if (pattern === 'extreme') {
    // Bẫy tràn số 32-bit: xen kẽ biên âm/dương cực đại
    arr = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? minVal : maxVal));
  } else {
    arr = Array.from({ length: n }, () => randInt(next, minVal, maxVal));
    if (pattern === 'sorted-asc') arr.sort((a, b) => a - b);
    if (pattern === 'sorted-desc') arr.sort((a, b) => b - a);
  }
  return { stdin: `${n}\n${arr.join(' ')}\n`, strategy: `array:${pattern}:n=${n}` };
}

/**
 * Sinh bộ suite đầy đủ: bẫy biên trước, random/pattern sau.
 * @param {object} o
 * @param {number} [o.count=12] Tổng số case (tối thiểu 5 để đủ bẫy)
 * @param {string|number} [o.seed='dever']
 * @param {number} [o.minN=1] [o.maxN=100000]
 * @param {number} [o.minVal=-1e9] [o.maxVal=1e9]
 * @returns {Array<{ stdin: string, strategy: string }>}
 */
export function generateSuite({ count = 12, seed = 'dever', minN = 1, maxN = 100000, minVal = -1000000000, maxVal = 1000000000 } = {}) {
  const n = Math.max(5, Math.min(200, Math.floor(count) || 12));
  const base = hashSeed(seed);
  const suite = [];
  const traps = [
    { n: minN, pattern: 'random', tag: 'trap:n-min' },
    { n: 1, pattern: 'random', tag: 'trap:n-1' },
    { n: Math.min(maxN, 20), pattern: 'all-equal', tag: 'trap:all-equal' },
    { n: Math.min(maxN, 50), pattern: 'extreme', tag: 'trap:overflow' },
    { n: maxN, pattern: 'random', tag: 'trap:n-max' },
  ];
  traps.forEach((t, i) => {
    const rnd = mulberry32((base + i * 7919) >>> 0);
    const c = generateArrayCase({ n: t.n, minVal, maxVal, pattern: t.pattern, rnd });
    suite.push({ ...c, strategy: t.tag });
  });
  const patterns = ['random', 'random', 'sorted-asc', 'sorted-desc', 'alternating'];
  for (let i = suite.length; i < n; i++) {
    const rnd = mulberry32((base + i * 7919) >>> 0);
    const span = Math.max(2, maxN - minN);
    const size = minN + Math.floor(Math.pow(rnd(), 2) * span); // thiên về N nhỏ-vừa
    const c = generateArrayCase({ n: Math.min(maxN, size), minVal, maxVal, pattern: patterns[i % patterns.length], rnd });
    suite.push(c);
  }
  return suite;
}
