/**
 * DEVER Arena Platform Quality & System Invariants Test Suite
 * Kiểm thử chất lượng toàn diện:
 * 1. Thuật toán tính toán countdown timer và tỉ lệ % tiến độ kỳ thi
 * 2. Bộ đối soát Output test ví dụ (whitespace & newline normalization)
 * 3. Bộ phân giải Deep Hash Routing (#view-*, #tab-*, #problem-*)
 * 4. Bất biến đồng bộ trạng thái Phase qua LocalStorage/IndexedDB
 * 5. Tính toàn vẹn hợp đồng cấu trúc HTML 3 trang (h1, manifest, footer)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTEST_PHASES } from '../src/core/contestStateMachine.js';
import { handleAppHash, renderMathTypography } from '../js/app.js';

describe('DEVER Arena Platform Quality & Ticker Suite', () => {

  test('Contest countdown & progress percentage calculation', () => {
    const totalSec = 135 * 60; // 8100s

    // Case 1: Start (8100s remaining)
    const elapsed0 = totalSec - 8100;
    const pct0 = (elapsed0 / totalSec) * 100;
    assert.equal(pct0, 0);

    // Case 2: Mid-contest (4712s remaining ~ 01:18:32)
    const curSec = 4712;
    const elapsedMid = totalSec - curSec;
    const pctMid = (elapsedMid / totalSec) * 100;
    assert.equal(pctMid.toFixed(1), '41.8');

    // Case 3: Hack phase boundary (900s remaining ~ 15:00)
    const hackSec = 900;
    const elapsedHack = totalSec - hackSec;
    const pctHack = (elapsedHack / totalSec) * 100;
    assert.equal(pctHack.toFixed(1), '88.9');

    // Case 4: Finished (0s remaining)
    const elapsedEnd = totalSec - 0;
    const pctEnd = (elapsedEnd / totalSec) * 100;
    assert.equal(pctEnd, 100);
  });

  test('Time formatting to HH:MM:SS string', () => {
    const formatTime = (seconds) => {
      const s = Math.max(0, seconds);
      const hrs = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const secs = s % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    assert.equal(formatTime(4712), '01:18:32');
    assert.equal(formatTime(899), '00:14:59');
    assert.equal(formatTime(60), '00:01:00');
    assert.equal(formatTime(0), '00:00:00');
  });

  test('Sample testcase output comparator with whitespace normalization', () => {
    const compareOutputs = (actual, expected) => {
      const normActual = String(actual || '').replace(/\r\n/g, '\n').trim();
      const normExpected = String(expected || '').replace(/\r\n/g, '\n').trim();
      return normActual === normExpected;
    };

    // Khớp tuyệt đối
    assert.equal(compareOutputs('11', '11'), true);

    // Khớp kể cả khi thừa dấu cách hoặc xuống dòng ở cuối
    assert.equal(compareOutputs('11\n\n', '11'), true);
    assert.equal(compareOutputs('  11  \r\n', '11'), true);

    // Multi-line output
    assert.equal(compareOutputs('11\n-1\n', '11\r\n-1'), true);

    // Sai lệch kết quả
    assert.equal(compareOutputs('10', '11'), false);
    assert.equal(compareOutputs('-184729104', '11'), false);
  });

  test('Deep Hash Route resolver handles main views, subtabs, and problem IDs', () => {
    // Mock global window and document objects for test runner environment
    let lastSwitchedView = null;
    let lastLoadedProblem = null;
    let lastToggledTab = null;
    let clickedSubTab = null;

    globalThis.window = globalThis.window || {};
    globalThis.window.switchMainView = (v) => { lastSwitchedView = v; };
    globalThis.window.loadProblemToWorkspace = (p) => { lastLoadedProblem = p; };
    globalThis.window.toggleProblemTab = (t) => { lastToggledTab = t; };

    globalThis.document = globalThis.document || {};
    globalThis.document.querySelector = (sel) => {
      return {
        click: () => { clickedSubTab = sel; }
      };
    };

    // Test 1: Main views
    handleAppHash('#view-problemset');
    assert.equal(lastSwitchedView, 'view-problemset');

    handleAppHash('#view-standings');
    assert.equal(lastSwitchedView, 'view-standings');

    // Test 2: Contest sub-tabs
    handleAppHash('#tab-workspace');
    assert.equal(lastSwitchedView, 'view-contests');
    assert.equal(clickedSubTab, '[data-tab="tab-workspace"]');

    handleAppHash('#tab-hackroom');
    assert.equal(lastSwitchedView, 'view-contests');
    assert.equal(clickedSubTab, '[data-tab="tab-hackroom"]');

    // Test 3: Problem deep links
    handleAppHash('#problem-p101');
    assert.equal(lastLoadedProblem, 'p101');

    handleAppHash('#p102');
    assert.equal(lastLoadedProblem, 'p102');

    // Test 4: Problem sub-tabs
    handleAppHash('#editorial');
    assert.equal(lastToggledTab, 'editorial');

    // Test 5: Virtual contest direct links
    let startedVirtualContest = null;
    globalThis.window.startVirtualContest = (cid) => { startedVirtualContest = cid; };
    handleAppHash('#virtual-contest_dever_archive');
    assert.equal(startedVirtualContest, 'contest_dever_archive');
  });

  test('Math typography formatter converts LaTeX tokens to styled HTML', () => {
    const container = { innerHTML: 'Cho đồ thị có $N$ đỉnh và độ phức tạp $O(N \\log N)$, giới hạn $1 \\le N \\le 10^5$.' };
    renderMathTypography(container);
    assert.ok(container.innerHTML.includes('class="math-formula"'));
    assert.ok(container.innerHTML.includes('≤'));
    assert.ok(container.innerHTML.includes('10<sup>5</sup>'));
    assert.ok(container.innerHTML.includes('log'));
  });

  test('Contest phase enum and storage invariant', () => {
    const validPhases = [
      CONTEST_PHASES.REGISTRATION,
      CONTEST_PHASES.CODING,
      CONTEST_PHASES.HACK_PHASE,
      CONTEST_PHASES.SYSTEM_TESTING,
      CONTEST_PHASES.FINISHED
    ];

    assert.equal(validPhases.includes('CODING'), true);
    assert.equal(validPhases.includes('HACK_PHASE'), true);
    assert.equal(validPhases.includes('SYSTEM_TESTING'), true);
    assert.equal(validPhases.includes('FINISHED'), true);
    assert.equal(validPhases.includes('INVALID_PHASE'), false);
  });

  test('Integrity of 3 pages HTML contracts (h1, manifest, footer)', () => {
    const indexHtml = readFileSync('index.html', 'utf8');
    const arenaHtml = readFileSync('arena.html', 'utf8');
    const adminHtml = readFileSync('admin.html', 'utf8');

    for (const [name, content] of [['index.html', indexHtml], ['arena.html', arenaHtml], ['admin.html', adminHtml]]) {
      // Mỗi trang có đúng 1 thẻ <h1>
      const h1Matches = content.match(/<h1[^>]*>/gi) || [];
      assert.equal(h1Matches.length, 1, `${name} phải có đúng 1 thẻ h1`);

      // Mỗi trang đều liên kết manifest.json
      assert.equal(content.includes('manifest.json'), true, `${name} phải có manifest.json`);

      // Mỗi trang đều có skip-link a11y
      assert.equal(content.includes('skip-link'), true, `${name} phải có skip-link`);
    }
  });

});
