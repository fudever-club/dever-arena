// DEVER Arena — ESLint flat config (ESLint v9+).
// Mục tiêu gate: bắt lỗi cú pháp + lỗi logic cơ bản (no-undef, no-redeclare...).
// Cảnh báo (warn) không làm đỏ gate; chỉ error mới fail. Xem `npm run lint:js`.
//
// Lưu ý: src/core + src/engine chạy cả 2 môi trường (Node server + browser SPA)
// nên khai báo gộp globals Node + Browser — no-undef vẫn bắt typo identifier lạ.
const runtimeGlobals = {
  // Node 20+ / chung
  console: 'readonly', process: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  fetch: 'readonly', Headers: 'readonly', Request: 'readonly', Response: 'readonly', FormData: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  queueMicrotask: 'readonly', Buffer: 'readonly', structuredClone: 'readonly', crypto: 'readonly',
  AbortController: 'readonly', AbortSignal: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly',
  ReadableStream: 'readonly', Blob: 'readonly', performance: 'readonly', globalThis: 'readonly',
  // Browser SPA
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
  localStorage: 'readonly', sessionStorage: 'readonly', requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly', BroadcastChannel: 'readonly', AudioContext: 'readonly',
  IntersectionObserver: 'readonly', ResizeObserver: 'readonly', alert: 'readonly',
  indexedDB: 'readonly', CustomEvent: 'readonly', EventSource: 'readonly', WebSocket: 'readonly',
  MutationObserver: 'readonly', getComputedStyle: 'readonly', matchMedia: 'readonly',
  atob: 'readonly', btoa: 'readonly', FileReader: 'readonly', DOMParser: 'readonly',
};

export default [
  {
    files: ['server/**/*.js', 'src/**/*.{js,jsx}', 'scripts/**/*.mjs', 'tests/**/*.js', 'detect.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: runtimeGlobals,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'prefer-const': 'warn',
      'no-console': 'off',
    },
  },
];
