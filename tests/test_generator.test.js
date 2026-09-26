/**
 * DEVER Arena — Test Generator Engine tests.
 * Khóa: determinism (cùng seed → cùng suite), đủ bẫy biên, khớp validator.
 */
import test from 'node:test';
import assert from 'node:assert';
import { hashSeed, mulberry32, generateArrayCase, generateSuite } from '../src/engine/testGenerator.js';
import { validateInput } from '../src/engine/testlibValidator.js';

test('cùng seed sinh cùng suite (tái hiện được)', () => {
  const a = generateSuite({ count: 12, seed: 'round1' });
  const b = generateSuite({ count: 12, seed: 'round1' });
  assert.deepEqual(a.map((c) => c.stdin), b.map((c) => c.stdin));
  assert.deepEqual(a, b);
});

test('khác seed sinh suite khác nhau', () => {
  const a = generateSuite({ count: 12, seed: 'alpha' });
  const b = generateSuite({ count: 12, seed: 'beta' });
  assert.ok(JSON.stringify(a) !== JSON.stringify(b));
});

test('suite luôn có đủ 5 bẫy biên', () => {
  const s = generateSuite({ count: 12, seed: 'x', minN: 1, maxN: 1000 });
  const tags = s.map((c) => c.strategy);
  for (const t of ['trap:n-min', 'trap:n-1', 'trap:all-equal', 'trap:overflow', 'trap:n-max']) {
    assert.ok(tags.includes(t), `thiếu ${t}`);
  }
});

test('mọi case đều qua validator với cùng rules', () => {
  const rules = { minN: 1, maxN: 1000, minVal: -1000000000, maxVal: 1000000000 };
  const s = generateSuite({ count: 15, seed: 'valid', ...rules });
  for (const c of s) {
    const r = validateInput(c.stdin, rules);
    assert.equal(r.isValid, true, `${c.strategy}: ${r.error}`);
  }
});

test('pattern sorted/all-equal/extreme đúng hình dạng', () => {
  const rnd = mulberry32(hashSeed('p'));
  const asc = generateArrayCase({ n: 10, minVal: 0, maxVal: 100, pattern: 'sorted-asc', rnd });
  const vals = asc.stdin.trim().split(/\s+/).slice(1).map(Number);
  assert.ok(vals.every((v, i) => i === 0 || vals[i - 1] <= v));
  const eq = generateArrayCase({ n: 5, minVal: 0, maxVal: 100, pattern: 'all-equal', rnd });
  const ev = eq.stdin.trim().split(/\s+/).slice(1).map(Number);
  assert.ok(ev.every((v) => v === ev[0]));
});

test('count bị chặn trong [5, 200]', () => {
  assert.equal(generateSuite({ count: 1 }).length, 5);
  assert.equal(generateSuite({ count: 500 }).length, 200);
});
