/**
 * DEVER Arena Polygon Testlib Validator & Custom Checker
 * Bộ công cụ kiểm thử chuẩn Polygon / testlib.h cho Ban Chuyên Môn ra đề:
 * 1. Input Validator: Kiểm tra testcase đầu vào có tuân thủ chặt chẽ ràng buộc đề bài (bounds, formatting, EOF)
 * 2. Token / Float / Multiple-Solution Checker: So khớp đáp án thí sinh với đáp án ban giám khảo.
 */

/**
 * Kiểm tra tính hợp lệ của dữ liệu đầu vào (Input Validator)
 * @param {string} stdin Nội dung testcase
 * @param {object} rules Bộ ràng buộc đề bài
 * @param {number} [rules.minN=1] Giá trị N nhỏ nhất
 * @param {number} [rules.maxN=100000] Giá trị N lớn nhất
 * @param {number} [rules.minVal=-1000000000] Giá trị phần tử nhỏ nhất
 * @param {number} [rules.maxVal=1000000000] Giá trị phần tử lớn nhất
 * @param {boolean} [rules.requireTrailingNewline=true] Bắt buộc kết thúc bằng đúng 1 ký tự xuống dòng
 * @param {boolean} [rules.disallowTrailingSpaces=true] Cấm khoảng trắng thừa ở cuối mỗi dòng
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateInput(stdin, rules = {}) {
  const {
    minN = 1,
    maxN = 100000,
    minVal = -1000000000,
    maxVal = 1000000000,
    requireTrailingNewline = true,
    disallowTrailingSpaces = true
  } = rules;

  if (typeof stdin !== 'string' || stdin.length === 0) {
    return { isValid: false, error: 'Empty input' };
  }

  // 1. Kiểm tra format kết thúc file (EOF)
  if (requireTrailingNewline && !stdin.endsWith('\n')) {
    return { isValid: false, error: 'Input does not terminate with a newline character (\\n)' };
  }
  if (requireTrailingNewline && stdin.endsWith('\n\n')) {
    return { isValid: false, error: 'Input contains excessive trailing newlines at EOF' };
  }

  const lines = stdin.replace(/\r/g, '').split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop(); // Bỏ dòng trống sau dấu \n cuối cùng
  }

  // 2. Kiểm tra khoảng trắng cuối dòng
  if (disallowTrailingSpaces) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].endsWith(' ') || lines[i].endsWith('\t')) {
        return { isValid: false, error: `Trailing whitespace detected on line ${i + 1}` };
      }
    }
  }

  // 3. Đọc số lượng N ở dòng đầu tiên
  const firstLineTokens = lines[0].trim().split(/\s+/);
  if (!firstLineTokens[0]) {
    return { isValid: false, error: 'Missing first token (N)' };
  }

  const n = Number(firstLineTokens[0]);
  if (!Number.isInteger(n) || n < minN || n > maxN) {
    return { isValid: false, error: `Invalid N: ${firstLineTokens[0]}. Must be integer in range [${minN}, ${maxN}]` };
  }

  // 4. Nếu có mảng phần tử ở các dòng tiếp theo
  if (lines.length > 1) {
    const allTokens = [];
    for (let i = 1; i < lines.length; i++) {
      const lineTokens = lines[i].trim().split(/\s+/).filter(Boolean);
      allTokens.push(...lineTokens);
    }

    // Kiểm tra số lượng phần tử
    if (allTokens.length > 0 && allTokens.length !== n) {
      return { isValid: false, error: `Element count mismatch: expected ${n} elements, found ${allTokens.length}` };
    }

    // Kiểm tra phạm vi giá trị từng phần tử
    for (let i = 0; i < allTokens.length; i++) {
      const val = Number(allTokens[i]);
      if (Number.isNaN(val) || val < minVal || val > maxVal) {
        return { isValid: false, error: `Element #${i + 1} (${allTokens[i]}) out of range [${minVal}, ${maxVal}]` };
      }
    }
  }

  return { isValid: true, error: null };
}

/**
 * So sánh đáp án thí sinh với đáp án Ban Giám Khảo (Custom Checker)
 * @param {string} participantOutput Output từ thí sinh
 * @param {string} juryOutput Output chuẩn từ ban giám khảo
 * @param {'exact' | 'float_tolerance' | 'multiple_solutions'} [checkerType='exact']
 * @param {object} [options]
 * @param {number} [options.epsilon=1e-6] Sai số thực cho phép
 * @param {Function} [options.customJudgeFn] Hàm kiểm tra bài có nhiều nghiệm
 * @param {string} [options.stdin] Input gốc của bài toán
 * @returns {{ isCorrect: boolean, verdict: 'AC' | 'WA', message: string, maxDiff?: number }}
 */
export function checkOutput(participantOutput, juryOutput, checkerType = 'exact', options = {}) {
  const pStr = (participantOutput || '').trim();
  const jStr = (juryOutput || '').trim();

  // 1. Exact Token Match (Chuẩn hóa khoảng trắng)
  if (checkerType === 'exact') {
    const pTokens = pStr.split(/\s+/).filter(Boolean);
    const jTokens = jStr.split(/\s+/).filter(Boolean);

    if (pTokens.length !== jTokens.length) {
      return {
        isCorrect: false,
        verdict: 'WA',
        message: `Token count mismatch: expected ${jTokens.length}, got ${pTokens.length}`
      };
    }

    for (let i = 0; i < jTokens.length; i++) {
      if (pTokens[i] !== jTokens[i]) {
        return {
          isCorrect: false,
          verdict: 'WA',
          message: `Token mismatch at index ${i + 1}: expected "${jTokens[i]}", got "${pTokens[i]}"`
        };
      }
    }

    return { isCorrect: true, verdict: 'AC', message: 'All tokens matched exactly' };
  }

  // 2. Float Tolerance Checker (|A - B| <= eps HOẶC |A - B| / max(1, |B|) <= eps)
  if (checkerType === 'float_tolerance') {
    const eps = options.epsilon || 1e-6;
    const pTokens = pStr.split(/\s+/).filter(Boolean);
    const jTokens = jStr.split(/\s+/).filter(Boolean);

    if (pTokens.length !== jTokens.length) {
      return {
        isCorrect: false,
        verdict: 'WA',
        message: `Token count mismatch: expected ${jTokens.length}, got ${pTokens.length}`
      };
    }

    let maxDiff = 0;
    for (let i = 0; i < jTokens.length; i++) {
      const pVal = parseFloat(pTokens[i]);
      const jVal = parseFloat(jTokens[i]);

      if (Number.isNaN(pVal) || Number.isNaN(jVal)) {
        if (pTokens[i] !== jTokens[i]) {
          return { isCorrect: false, verdict: 'WA', message: `Token #${i + 1} not a valid float and does not match string` };
        }
        continue;
      }

      const diff = Math.abs(pVal - jVal);
      const relDiff = diff / Math.max(1, Math.abs(jVal));
      const effectiveDiff = Math.min(diff, relDiff);
      maxDiff = Math.max(maxDiff, effectiveDiff);

      if (diff > eps && relDiff > eps) {
        return {
          isCorrect: false,
          verdict: 'WA',
          message: `Float precision exceeded at token #${i + 1}: expected ${jVal}, got ${pVal} (diff: ${effectiveDiff.toExponential(2)} > ${eps})`,
          maxDiff
        };
      }
    }

    return {
      isCorrect: true,
      verdict: 'AC',
      message: `All ${jTokens.length} floats within tolerance (maxDiff: ${maxDiff.toExponential(2)})`,
      maxDiff
    };
  }

  // 3. Multiple Solutions Checker (Custom Verifier)
  if (checkerType === 'multiple_solutions') {
    if (typeof options.customJudgeFn !== 'function') {
      return { isCorrect: false, verdict: 'WA', message: 'Missing customJudgeFn in options' };
    }

    try {
      const judgeRes = options.customJudgeFn(participantOutput, juryOutput, options.stdin);
      const isOk = typeof judgeRes === 'object' ? Boolean(judgeRes.isCorrect) : Boolean(judgeRes);
      return {
        isCorrect: isOk,
        verdict: isOk ? 'AC' : 'WA',
        message: (typeof judgeRes === 'object' && judgeRes.message) ? judgeRes.message : (isOk ? 'Solution verified valid' : 'Custom validator rejected solution')
      };
    } catch (err) {
      return { isCorrect: false, verdict: 'WA', message: `Custom validator error: ${err.message}` };
    }
  }

  return { isCorrect: false, verdict: 'WA', message: `Unknown checker type: ${checkerType}` };
}
