import { parseAnchor, anchorOnDate, nextAnchorAfter, fmtHM } from './time.js';

// Build a one-day window/reset table for fixed anchors. Pure.
// Returns { rows:[{start,reset}], gaps:[{from,to,hours}], warnings:[string] }
export function buildTable(anchors, windowSec, ref = new Date()) {
  const W = windowSec * 1000;
  const insts = anchors.map((a) => anchorOnDate(parseAnchor(a), ref)).sort((x, y) => x - y);
  const rows = insts.map((start) => ({ start, reset: new Date(start.getTime() + W) }));
  const dayMs = 24 * 3600 * 1000;
  const warnings = [];
  const gaps = [];
  for (let i = 0; i < insts.length; i++) {
    const a = insts[i];
    const b = i + 1 < insts.length ? insts[i + 1] : new Date(insts[0].getTime() + dayMs);
    const resetA = a.getTime() + W;
    const spacing = b.getTime() - a.getTime();
    if (spacing < W) {
      warnings.push(
        `锚点 ${fmtHM(a)} → 下一个 ${fmtHM(b)} 间隔 ${(spacing / 3600000).toFixed(2)}h < 窗口 ${(windowSec / 3600).toFixed(1)}h：窗口重叠，刷新点不会落在该锚点`,
      );
    } else if (b.getTime() > resetA) {
      gaps.push({ from: new Date(resetA), to: new Date(b.getTime()), hours: (b.getTime() - resetA) / 3600000 });
    }
  }
  return { rows, gaps, warnings };
}

// Project upcoming reset times assuming the user is IDLE from `now` onward.
// fixed → converges back to the anchor grid; chain → drifts by buffer each cycle.
// Returns { resets:[{at,kind,anchorAt?}], convergesAt:Date|null }
export function project({ mode, anchors, windowSec, window, now, bufferSec = 90, steps = 6 }) {
  const W = windowSec * 1000;
  const out = [];
  const curReset = window && window.reset.getTime() > now.getTime() ? window.reset : null;
  if (curReset) out.push({ at: curReset, kind: 'current' });

  if (mode === 'chain') {
    let prev = curReset ? curReset.getTime() : null;
    while (out.length < steps) {
      const reset = (prev === null ? now.getTime() : prev) + bufferSec * 1000 + W;
      out.push({ at: new Date(reset), kind: 'projected' });
      prev = reset;
    }
    return { resets: out, convergesAt: null };
  }

  // fixed
  let convergesAt = null;
  let from = curReset || now;
  while (out.length < steps) {
    const A = nextAnchorAfter(anchors, from);
    if (!A) break;
    out.push({ at: new Date(A.getTime() + W), kind: 'projected', anchorAt: A });
    if (convergesAt === null) convergesAt = A; // first anchor-aligned ping = back on grid
    from = new Date(A.getTime() + W);
  }
  return { resets: out, convergesAt };
}

// Classify the actual current window vs the intended schedule.
// ourPings: array of ISO strings (times this tool pinged), from state.
// Returns { state, detail }  state ∈ on-grid | user-driven | idle
export function classify({ mode, window, anchors = [], ourPings = [], toleranceMin = 10 }) {
  if (!window) return { state: 'idle', detail: '近窗口无活动' };
  const tol = toleranceMin * 60 * 1000;
  const startMs = window.start.getTime();

  const byUs = ourPings.some((p) => Math.abs(new Date(p).getTime() - startMs) <= tol);
  if (byUs) return { state: 'on-grid', detail: '窗口由本工具 ping 开启' };

  if (mode === 'fixed') {
    const nearAnchor = anchors.some((raw) => {
      const ai = anchorOnDate(parseAnchor(raw), window.start);
      return Math.abs(ai.getTime() - startMs) <= tol;
    });
    if (nearAnchor) return { state: 'on-grid', detail: '窗口起点 ≈ 锚点' };
    return { state: 'user-driven', detail: '窗口由你自己的使用开启（锚点被抢占，正常）' };
  }
  return { state: 'user-driven', detail: '窗口由活动开启' };
}
