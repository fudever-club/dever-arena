/**
 * DEVER Arena — Gate Vòng 32/33: contract UI cho Task 108/109/111/112.
 * Kiểm tra file thật (App.jsx routes, ContestHub nút, CSS print, NotificationCenter) — không cần browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJsx = readFileSync('src/App.jsx', 'utf8');
const contestHub = readFileSync('src/pages/ContestHub.jsx', 'utf8');
const navbar = readFileSync('src/components/layout/Navbar.jsx', 'utf8');
const indexCss = readFileSync('src/index.css', 'utf8');
const notifCenter = readFileSync('src/components/common/NotificationCenter.jsx', 'utf8');
const useNotifs = readFileSync('src/hooks/useNotifications.js', 'utf8');
const comparePage = readFileSync('src/pages/ComparePage.jsx', 'utf8');
const virtualPage = readFileSync('src/pages/VirtualContestPage.jsx', 'utf8');
const summaryPage = readFileSync('src/pages/ContestSummaryPage.jsx', 'utf8');

test('Vòng 32/33: App.jsx có đủ routes mới (/compare, /virtual/:slug, /contest/:slug/summary)', () => {
  for (const route of ['path="/compare"', 'path="/virtual/:slug"', 'path="/contest/:slug/summary"']) {
    assert.ok(appJsx.includes(route), `App.jsx phải có ${route}`);
  }
  for (const page of ['ComparePage', 'VirtualContestPage', 'ContestSummaryPage']) {
    assert.ok(appJsx.includes(page), `App.jsx phải lazy-import ${page}`);
  }
});

test('Task 111: ContestHub có nút Thi ảo điều hướng /virtual/ và nút Tổng kết', () => {
  assert.ok(contestHub.includes('navigate(`/virtual/${c.slug}`)'), 'nút Thi ảo → /virtual/:slug');
  assert.ok(contestHub.includes('navigate(`/contest/${c.slug}/summary`)'), 'nút Tổng kết → /contest/:slug/summary');
  assert.ok(!contestHub.includes('startVirtual'), 'không còn hàm startVirtual cũ (ghost inline)');
});

test('Task 109: NotificationCenter gắn Navbar + zero-dep SVG bell + localStorage persist', () => {
  assert.ok(navbar.includes('<NotificationCenter />'), 'Navbar phải render NotificationCenter');
  assert.ok(navbar.includes('isAuthenticated && <NotificationCenter'), 'chỉ hiện khi đăng nhập');
  assert.ok(notifCenter.includes('useNotifications'), 'dùng hook useNotifications');
  assert.ok(useNotifs.includes("'dever.notifs'"), 'persist localStorage key dever.notifs');
  assert.ok(useNotifs.includes('EVENT_PHASE_CHANGED'), 'lắng nghe SSE phase change');
  assert.ok(!notifCenter.includes('lucide'), 'không dùng lucide (ADR icon SVG)');
  assert.ok(notifCenter.includes('<svg'), 'bell là SVG inline');
});

test('Task 112: print stylesheet cho trang tổng kết (@media print + no-print)', () => {
  assert.ok(indexCss.includes('@media print'), 'index.css có @media print');
  assert.ok(indexCss.includes('.no-print'), 'index.css có .no-print');
  assert.ok(summaryPage.includes('window.print()'), 'trang tổng kết có nút In/PDF');
  assert.ok(summaryPage.includes('no-print'), 'ẩn chrome khi in');
});

test('Task 108: ComparePage dùng RatingChartOverlay + parse ?a=&b= từ hash', () => {
  assert.ok(comparePage.includes('RatingChartOverlay'));
  assert.ok(comparePage.includes('head_to_head'));
  assert.ok(comparePage.includes('window.location.hash'));
});

test('Task 111: VirtualContestPage tạo phiên + poll ghost standings', () => {
  assert.ok(virtualPage.includes('api.createVirtual'));
  assert.ok(virtualPage.includes('api.getVirtual'));
  assert.ok(virtualPage.includes('Ghost Replay'));
});
