import { fmtHM } from './core/time.js';
import { buildTable } from './core/schedule.js';

// Render the daily fixed-anchor window/reset table + gaps + warnings.
export function renderTable(anchors, windowSec) {
  const { rows, gaps, warnings } = buildTable(anchors, windowSec);
  const out = ['  每日窗口 → 刷新点:'];
  for (const r of rows) out.push(`    ${fmtHM(r.start)} → ${fmtHM(r.reset)}`);
  if (gaps.length) out.push('  空档: ' + gaps.map((g) => `${fmtHM(g.from)}–${fmtHM(g.to)} (${g.hours.toFixed(1)}h)`).join('  '));
  for (const w of warnings) out.push('  ⚠ ' + w);
  return out.join('\n');
}

// Render the "assuming idle from now" reset projection + convergence point.
export function renderProjection(proj, mode) {
  const seq = proj.resets.map((r) => `${fmtHM(r.at)}${r.kind === 'current' ? '*' : ''}`).join(' → ');
  const lines = ['  若此后空闲，刷新点: ' + seq + (mode === 'chain' ? ' …(每日漂移)' : '')];
  if (proj.convergesAt) lines.push(`  → 自 ${fmtHM(proj.convergesAt)} 起回到固定网格`);
  return lines.join('\n');
}

// Generate fixed anchors every 6h from a start "HH:MM" (4 anchors; 6h divides 24h → stable daily grid).
export function preset6h(startHHMM) {
  const [h, m] = startHHMM.split(':').map(Number);
  return [0, 6, 12, 18].map((off) => {
    const t = (h * 60 + m + off * 60) % (24 * 60);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  });
}
