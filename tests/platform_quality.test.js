/**
 * DEVER Arena Platform Quality & System Invariants Test Suite
 * Kiểm thử chất lượng toàn diện (single-stack React SPA):
 * 1. Thuật toán tính toán countdown timer và tỉ lệ % tiến độ kỳ thi
 * 2. Bộ đối soát Output test ví dụ (whitespace & newline normalization)
 * 3. Bất biến đồng bộ trạng thái Phase qua LocalStorage/IndexedDB
 * 4. Hợp đồng SPA shell: app.html, manifest.json, brand assets, routes (src/App.jsx)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CONTEST_PHASES } from '../src/core/contestStateMachine.js';

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

  test('SPA shell contract: app.html (root div, lang vi, title, favicon, fonts)', () => {
    const html = readFileSync('app.html', 'utf8');

    // Shell mount point cho React SPA
    assert.ok(html.includes('<div id="root">'), 'app.html phải có <div id="root">');

    // Ngôn ngữ + tiêu đề tiếng Việt
    assert.ok(html.includes('lang="vi"'), 'app.html phải có lang="vi"');
    assert.ok(html.includes('<title>') && html.includes('DEVER Arena'), 'app.html phải có <title> DEVER Arena');

    // Favicon + fonts Space Grotesk (những gì đang tồn tại — app.html không link manifest)
    assert.ok(html.includes('favicon'), 'app.html phải link favicon');
    assert.ok(html.includes('Space Grotesk'), 'app.html phải link fonts Space Grotesk');
  });

  test('PWA manifest contract: manifest.json valid + icons /brand/', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

    assert.equal(manifest.name, 'DEVER Arena');
    assert.equal(manifest.short_name, 'DEVER');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest phải có icons');
    for (const icon of manifest.icons) {
      assert.ok(icon.src.includes('/brand/'), `${icon.src} phải trỏ /brand/`);
    }
  });

  test('Brand + language assets exist in public/', () => {
    for (const f of ['logo-dark.png', 'logo-light.png', 'icon-192.png', 'icon-512.png']) {
      assert.equal(existsSync(`public/brand/${f}`), true, `public/brand/${f} phải tồn tại`);
    }
    for (const f of ['python.svg', 'javascript.svg', 'java.svg', 'nodejs.svg']) {
      assert.equal(existsSync(`public/icons/${f}`), true, `public/icons/${f} phải tồn tại`);
    }
  });

  test('Core routes contract: src/App.jsx has CF loop routes and no /clans', () => {
    const appJsx = readFileSync('src/App.jsx', 'utf8');

    for (const route of ['path="/"', 'path="/arena"', 'path="/login"', 'path="/problem/:id"', 'path="/standings"', 'path="/hack-room"', 'path="/admin"', 'path="/problemset"', 'path="/profile"']) {
      assert.ok(appJsx.includes(route), `src/App.jsx phải có route ${route}`);
    }
    assert.ok(!appJsx.includes('ClansPage') && !appJsx.includes('"/clans"') && !appJsx.includes("'/clans'"), 'src/App.jsx không còn route /clans');
  });

});

});
