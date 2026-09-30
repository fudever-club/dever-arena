/**
 * Cài git config cho repo sau npm install (commit template + hooksPath).
 * An toàn container: chạy được cả khi git CLI vắng mặt (bỏ qua lỗi, exit 0) —
 * bản build Docker không cần git; hook chỉ có ý nghĩa trên máy dev.
 */
import { execFileSync } from 'node:child_process';

function git(args) {
  try {
    return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch {
    return null; // git không tồn tại hoặc không phải repo — bỏ qua
  }
}

if (!git(['rev-parse', '--is-inside-work-tree'])) {
  console.log('[setup-git-hooks] Không phải git repo (bỏ qua — môi trường build/CI).');
  process.exit(0);
}

if (!git(['config', 'commit.template', '.gitmessage'])) {
  console.error('[setup-git-hooks] Không đặt được commit.template — git có lỗi cấu hình. Bỏ qua.');
  process.exit(0);
}
git(['config', 'core.hooksPath', '.githooks']);
console.log('[setup-git-hooks] Đã cài commit template (.gitmessage) + hooksPath (.githooks).');
