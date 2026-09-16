import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, checkOutput } from '../src/engine/testlibValidator.js';

describe('DEVER Polygon Testlib Input Validator Tests', () => {
  it('Chấp nhận testcase đầu vào hợp lệ và chuẩn format', () => {
    const validStdin = '5\n10 20 30 40 50\n';
    const res = validateInput(validStdin, { minN: 1, maxN: 1000 });
    assert.equal(res.isValid, true);
    assert.equal(res.error, null);
  });

  it('Bắt lỗi thiếu ký tự xuống dòng ở cuối file (No newline at EOF)', () => {
    const noEofNewline = '3\n1 2 3';
    const res = validateInput(noEofNewline, { requireTrailingNewline: true });
    assert.equal(res.isValid, false);
    assert.ok(res.error.includes('newline'));
  });

  it('Bắt lỗi khoảng trắng thừa ở cuối dòng (Trailing Whitespace)', () => {
    const trailingSpace = '3 \n1 2 3\n';
    const res = validateInput(trailingSpace, { disallowTrailingSpaces: true });
    assert.equal(res.isValid, false);
    assert.ok(res.error.includes('Trailing whitespace'));
  });

  it('Bắt lỗi N vượt quá giới hạn đề bài quy định', () => {
    const outOfBoundsN = '200000\n1 2 3\n';
    const res = validateInput(outOfBoundsN, { minN: 1, maxN: 100000 });
    assert.equal(res.isValid, false);
    assert.ok(res.error.includes('Invalid N'));
  });

  it('Bắt lỗi số lượng phần tử không khớp với N (Count Mismatch)', () => {
    const countMismatch = '4\n10 20 30\n'; // N = 4 nhưng chỉ có 3 số
    const res = validateInput(countMismatch, { minN: 1, maxN: 100 });
    assert.equal(res.isValid, false);
    assert.ok(res.error.includes('count mismatch'));
  });

  it('Bắt lỗi phần tử mảng vượt quá giá trị cực đại (Element Out of Range)', () => {
    const outOfRange = '2\n5 9999999999\n';
    const res = validateInput(outOfRange, { minVal: -1000, maxVal: 1000 });
    assert.equal(res.isValid, false);
    assert.ok(res.error.includes('out of range'));
  });
});

describe('DEVER Polygon Custom Checker Engine Tests', () => {
  it('Checker so khớp Token chuẩn xác (bỏ qua khoảng trắng/xuống dòng)', () => {
    const participant = '42   100\n200\n';
    const jury = '42 100 200';
    const res = checkOutput(participant, jury, 'exact');
    assert.equal(res.isCorrect, true);
    assert.equal(res.verdict, 'AC');

    const wrongRes = checkOutput('42 99 200', jury, 'exact');
    assert.equal(wrongRes.isCorrect, false);
    assert.equal(wrongRes.verdict, 'WA');
  });

  it('Checker so khớp số thực với sai số epsilon (Float Tolerance Checker)', () => {
    const jury = '3.1415926535';
    // Sai số 1e-8 (nằm trong giới hạn 1e-6)
    const goodParticipant = '3.1415927';
    const resGood = checkOutput(goodParticipant, jury, 'float_tolerance', { epsilon: 1e-6 });
    assert.equal(resGood.isCorrect, true);
    assert.equal(resGood.verdict, 'AC');

    // Sai số lớn 1e-3 (vượt quá 1e-6)
    const badParticipant = '3.142';
    const resBad = checkOutput(badParticipant, jury, 'float_tolerance', { epsilon: 1e-6 });
    assert.equal(resBad.isCorrect, false);
    assert.equal(resBad.verdict, 'WA');
  });

  it('Checker hỗ trợ bài toán nhiều nghiệm (Multiple Solutions Custom Verifier)', () => {
    // Bài toán: Tìm 2 số có tích bằng 12
    const customJudge = (pOut) => {
      const tokens = pOut.trim().split(/\s+/).map(Number);
      if (tokens.length !== 2) return false;
      return tokens[0] * tokens[1] === 12;
    };

    // Nghiệm 3 4
    const res1 = checkOutput('3 4', '2 6', 'multiple_solutions', { customJudgeFn: customJudge });
    assert.equal(res1.isCorrect, true);
    assert.equal(res1.verdict, 'AC');

    // Nghiệm 2 6
    const res2 = checkOutput('2 6', '3 4', 'multiple_solutions', { customJudgeFn: customJudge });
    assert.equal(res2.isCorrect, true);

    // Nghiệm sai: 5 2 (tích bằng 10 != 12)
    const resFail = checkOutput('5 2', '2 6', 'multiple_solutions', { customJudgeFn: customJudge });
    assert.equal(resFail.isCorrect, false);
    assert.equal(resFail.verdict, 'WA');
  });
});
