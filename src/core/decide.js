import { latestAnchorAtOrBefore } from './time.js';

// Decide whether a ping is due now for one provider. Pure function.
//
// inputs:
//   mode      "chain" | "fixed"
//   now       Date
//   window    { start, reset } | null   (from detectWindow)
//   bufferSec  number   (fire this long AFTER reset, never before)
//   fixed     { anchors:["HH:MM"...], graceMin }   (fixed mode only)
//   state     { lastFiredAnchor:ISO|null }
//
// returns { due:boolean, reason:string, anchor?:Date }
export function decide({ mode, now, window, bufferSec = 90, fixed, state = {} }) {
  const reset = window ? window.reset : null;

  if (mode === 'chain') {
    if (!reset) return { due: true, reason: 'chain:no-window' };
    const due = now.getTime() >= reset.getTime() + bufferSec * 1000;
    return { due, reason: due ? 'chain:expired' : 'chain:open' };
  }

  if (mode === 'fixed') {
    if (!fixed || !Array.isArray(fixed.anchors) || fixed.anchors.length === 0)
      return { due: false, reason: 'fixed:no-anchors' };
    const A = latestAnchorAtOrBefore(fixed.anchors, now);
    if (!A) return { due: false, reason: 'fixed:before-first-anchor' };

    // Window already open (started by the user's own usage) → anchor preempted.
    // Not a failure: a live window exists; we don't ping redundantly.
    const windowOpen = !!reset && reset.getTime() > now.getTime();
    if (windowOpen) return { due: false, reason: 'fixed:preempted', anchor: A };

    const already = state.lastFiredAnchor &&
      new Date(state.lastFiredAnchor).getTime() === A.getTime();
    if (already) return { due: false, reason: 'fixed:already-fired', anchor: A };

    const graceMs = (fixed.graceMin ?? 30) * 60 * 1000;
    if (now.getTime() - A.getTime() > graceMs)
      return { due: false, reason: 'fixed:grace-exceeded', anchor: A };

    return { due: true, reason: 'fixed:anchor-due', anchor: A };
  }

  return { due: false, reason: `unknown-mode:${mode}` };
}
