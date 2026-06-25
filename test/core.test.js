import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectWindow } from '../src/core/window.js';
import { decide } from '../src/core/decide.js';
import { buildTable, project, classify } from '../src/core/schedule.js';

const W = 18000; // 5h
const D = (h, m = 0, s = 0) => new Date(2026, 5, 25, h, m, s, 0); // local June 25 2026

test('detectWindow: empty → null', () => {
  assert.equal(detectWindow([], W), null);
});

test('detectWindow: single cluster → start + 5h', () => {
  const w = detectWindow([D(9), D(10), D(11)], W);
  assert.equal(w.start.getHours(), 9);
  assert.equal(w.reset.getHours(), 14);
});

test('detectWindow: gap > 5h opens new window', () => {
  const w = detectWindow([D(9), D(9, 30), D(15)], W);
  assert.equal(w.start.getHours(), 15);
  assert.equal(w.reset.getHours(), 20);
});

test('detectWindow: activity within 5h keeps original start', () => {
  const w = detectWindow([D(9), D(13, 59)], W);
  assert.equal(w.start.getHours(), 9);
  assert.equal(w.reset.getHours(), 14);
});

test('decide chain: no window → due', () => {
  const r = decide({ mode: 'chain', now: D(12), window: null, bufferSec: 90 });
  assert.equal(r.due, true);
});

test('decide chain: window open → not due', () => {
  const r = decide({ mode: 'chain', now: D(12), window: { start: D(11), reset: D(16) }, bufferSec: 90 });
  assert.equal(r.due, false);
  assert.equal(r.reason, 'chain:open');
});

test('decide chain: expired past buffer → due', () => {
  const now = D(14, 5);
  const r = decide({ mode: 'chain', now, window: { start: D(9), reset: D(14) }, bufferSec: 90 });
  assert.equal(r.due, true);
});

test('decide chain: expired within buffer → not due', () => {
  const now = D(14, 0, 30); // 30s after reset, buffer 90s
  const r = decide({ mode: 'chain', now, window: { start: D(9), reset: D(14) }, bufferSec: 90 });
  assert.equal(r.due, false);
});

const ANCH = ['09:00', '15:00', '21:00', '03:00'];

test('decide fixed: anchor due (idle, not fired, in grace)', () => {
  const r = decide({ mode: 'fixed', now: D(9, 5), window: null, fixed: { anchors: ANCH, graceMin: 30 }, state: {} });
  assert.equal(r.due, true);
  assert.equal(r.anchor.getHours(), 9);
});

test('decide fixed: window open → preempted, not due', () => {
  const r = decide({ mode: 'fixed', now: D(9, 5), window: { start: D(8, 38), reset: D(13, 38) }, fixed: { anchors: ANCH, graceMin: 30 }, state: {} });
  assert.equal(r.due, false);
  assert.equal(r.reason, 'fixed:preempted');
});

test('decide fixed: already fired → not due', () => {
  const r = decide({ mode: 'fixed', now: D(9, 5), window: null, fixed: { anchors: ANCH, graceMin: 30 }, state: { lastFiredAnchor: D(9).toISOString() } });
  assert.equal(r.due, false);
  assert.equal(r.reason, 'fixed:already-fired');
});

test('decide fixed: grace exceeded → not due', () => {
  const r = decide({ mode: 'fixed', now: D(9, 40), window: null, fixed: { anchors: ANCH, graceMin: 30 }, state: {} });
  assert.equal(r.due, false);
  assert.equal(r.reason, 'fixed:grace-exceeded');
});

test('buildTable: 6h grid → 1h gaps, no overlap warnings', () => {
  const t = buildTable(['00:00', '06:00', '12:00', '18:00'], W, D(0));
  assert.equal(t.warnings.length, 0);
  assert.equal(t.gaps.length, 4);
  assert.ok(Math.abs(t.gaps[0].hours - 1) < 1e-9);
});

test('buildTable: <5h spacing → overlap warnings', () => {
  const t = buildTable(['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'], W, D(0));
  assert.ok(t.warnings.length > 0);
});

test('project fixed: preempted window converges at next anchor', () => {
  const now = D(12);
  const p = project({ mode: 'fixed', anchors: ANCH, windowSec: W, window: { start: D(8, 38), reset: D(13, 38) }, now });
  assert.equal(p.resets[0].kind, 'current');
  assert.equal(p.resets[0].at.getHours(), 13);
  assert.equal(p.convergesAt.getHours(), 15);
  assert.equal(p.resets[1].at.getHours(), 20); // 15:00 + 5h
});

test('project chain: drifts ~5h+buffer each cycle', () => {
  const now = D(12);
  const p = project({ mode: 'chain', anchors: ANCH, windowSec: W, window: { start: D(9), reset: D(14) }, now, bufferSec: 90 });
  // first is current 14:00; subsequent gaps ≈ 5h + 90s
  const gap = p.resets[2].at.getTime() - p.resets[1].at.getTime();
  assert.ok(Math.abs(gap - (W * 1000 + 90000)) < 1000);
});

test('classify: window started by our ping → on-grid', () => {
  const c = classify({ mode: 'fixed', window: { start: D(9, 0, 20), reset: D(14, 0, 20) }, anchors: ANCH, ourPings: [D(9, 0, 15).toISOString()] });
  assert.equal(c.state, 'on-grid');
});

test('classify: user-driven off-anchor window → user-driven', () => {
  const c = classify({ mode: 'fixed', window: { start: D(8, 38), reset: D(13, 38) }, anchors: ANCH, ourPings: [] });
  assert.equal(c.state, 'user-driven');
});
