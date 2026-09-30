/**
 * DEVER Arena — regression test validator với input CỰC LỚN (Vòng 37.2).
 * Bug: allTokens.push(...lineTokens) nổ "Maximum call stack size exceeded" khi 1 dòng
 * có ~200k tokens (giới hạn spread của V8 ~65k tham số) — bắt được khi nạp testcases
 * stress n=200000 cho Round #2. Fix: push vòng for thường.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from '../src/engine/testlibValidator.js';

test('validateInput: dòng 200k token KHÔNG nổ call stack (regression Vòng 37.2)', () => {
  const n = 200000;
  const values = Array.from({ length: n }, (_, i) => String(i + 1)).join(' ');
  const stdin = `${n}\n${values}\n`;
  const v = validateInput(stdin, { minN: 1, maxN: 200000, minVal: 1, maxVal: 1000000000 });
  assert.equal(v.isValid, true, v.error || 'hợp lệ');
});

test('validateInput: 200k token nhưng N lệch → lỗi count mismatch (không nổ stack)', () => {
  const values = Array.from({ length: 199999 }, (_, i) => String(i + 1)).join(' ');
  const v = validateInput(`200000\n${values}\n`, { minN: 1, maxN: 200000, minVal: 1, maxVal: 1000000000 });
  assert.equal(v.isValid, false);
  assert.match(v.error, /count mismatch/);
});
