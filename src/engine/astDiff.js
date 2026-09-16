/**
 * DEVER-Forces Anti-Cheat AST & Token Normalizer
 * Thuật toán phát hiện sao chép mã nguồn bất chấp đổi tên biến, đảo vòng lặp hay chèn comment rác.
 */

// Bảng từ khóa cấu trúc
const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'int', 'long', 'double', 'float', 'char', 'string', 'bool',
  'void', 'auto', 'vector', 'cin', 'cout', 'endl', 'include', 'main'
]);

/**
 * Chuẩn hóa mã nguồn về chuỗi Token cấu trúc
 * @param {string} sourceCode 
 * @returns {Array<string>} Chuỗi tokens đã khử ngụy trang
 */
export function tokenizeCode(sourceCode) {
  if (!sourceCode) return [];

  // 1. Xóa comments (một dòng và nhiều dòng)
  let cleanCode = sourceCode
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*/g, ' ');

  // 2. Tách từ bằng regex
  const rawTokens = cleanCode.match(/[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+|==|!=|<=|>=|\+\+|--|<<|>>|[+\-*\/%=<>!&|^~?:;,\.\[\]{}()]/g) || [];

  const varMap = new Map();
  let varCounter = 0;

  const normalizedTokens = [];

  for (const token of rawTokens) {
    if (token === 'for' || token === 'while') {
      normalizedTokens.push('TOK_LOOP');
    } else if (KEYWORDS.has(token)) {
      normalizedTokens.push(`TOK_${token.toUpperCase()}`);
    } else if (/^[0-9]+$/.test(token)) {
      normalizedTokens.push('TOK_CONST_NUM');
    } else if (/^[a-zA-Z_]/.test(token)) {
      // Identifier: Map mọi tên biến ngụy trang về ID chuẩn
      if (!varMap.has(token)) {
        varMap.set(token, `ID_${varCounter++}`);
      }
      normalizedTokens.push(varMap.get(token));
    } else {
      normalizedTokens.push(`OP_${token}`);
    }
  }

  return normalizedTokens;
}

/**
 * Thống kê chi tiết AST cho admin telemetry (không phá logic calculateCodeSimilarity)
 * @param {string} codeA
 * @param {string} codeB
 * @param {number} nGramSize
 * @returns {{ tokensA: number, tokensB: number, jaccard: number, ngramsA: number, ngramsB: number }}
 */
export function getAstStats(codeA, codeB, nGramSize = 3) {
  const tokensAArr = tokenizeCode(codeA);
  const tokensBArr = tokenizeCode(codeB);
  const getNGrams = (tokens, n) => {
    const s = new Set();
    for (let i = 0; i <= tokens.length - n; i++) {
      s.add(tokens.slice(i, i + n).join(' '));
    }
    return s;
  };
  const ngramsASet = getNGrams(tokensAArr, nGramSize);
  const ngramsBSet = getNGrams(tokensBArr, nGramSize);
  let inter = 0;
  for (const g of ngramsASet) if (ngramsBSet.has(g)) inter++;
  const union = ngramsASet.size + ngramsBSet.size - inter;
  const jaccard = union === 0 ? 0 : Math.round((inter / union) * 100);
  return {
    tokensA: tokensAArr.length,
    tokensB: tokensBArr.length,
    jaccard,
    ngramsA: ngramsASet.size,
    ngramsB: ngramsBSet.size
  };
}

/**
 * Tính toán độ tương đồng (0 đến 100%) giữa 2 đoạn mã nguồn bằng thuật toán Token Jaccard N-gram
 * @param {string} codeA 
 * @param {string} codeB 
 * @param {number} nGramSize - Độ dài n-gram (mặc định 3 tokens)
 * @returns {{ similarity: number, verdict: string, tokenCountA: number, tokenCountB: number }}
 */
export function calculateCodeSimilarity(codeA, codeB, nGramSize = 3) {
  const tokensA = tokenizeCode(codeA);
  const tokensB = tokenizeCode(codeB);

  if (tokensA.length === 0 || tokensB.length === 0) {
    return { similarity: 0, verdict: 'CLEAR', tokenCountA: tokensA.length, tokenCountB: tokensB.length };
  }

  // Sinh n-grams
  const getNGrams = (tokens, n) => {
    const ngrams = new Set();
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.add(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  };

  const ngramsA = getNGrams(tokensA, nGramSize);
  const ngramsB = getNGrams(tokensB, nGramSize);

  if (ngramsA.size === 0 || ngramsB.size === 0) {
    return { similarity: 0, verdict: 'CLEAR', tokenCountA: tokensA.length, tokenCountB: tokensB.length };
  }

  // Tính Jaccard similarity = |A ∩ B| / |A ∪ B|
  let intersectionCount = 0;
  for (const item of ngramsA) {
    if (ngramsB.has(item)) {
      intersectionCount++;
    }
  }

  const unionSize = ngramsA.size + ngramsB.size - intersectionCount;
  const similarityScore = Math.round((intersectionCount / unionSize) * 100);

  let verdict = 'CLEAR';
  if (similarityScore >= 80) {
    verdict = 'PLAGIARISM_CONFIRMED';
  } else if (similarityScore >= 60) {
    verdict = 'SUSPICIOUS_REVIEW';
  }

  return {
    similarity: similarityScore,
    verdict,
    tokenCountA: tokensA.length,
    tokenCountB: tokensB.length
  };
}
