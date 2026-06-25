// Detect the current rolling window from activity timestamps.
//
// Rule (verified for Claude; assumed for Codex): a usage window begins with the
// FIRST message and lasts `windowSec`. A message sent >= windowSec after the
// window start opens a NEW window. So we sort timestamps and walk forward,
// re-anchoring whenever a timestamp lands beyond the current window.

function toMs(t) {
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  return Date.parse(t);
}

// timestamps: array of Date | ISO string | epoch-ms.
// Returns { start: Date, reset: Date } of the most recent window, or null if no activity.
// Note: reset may be in the past (window already expired / closed).
export function detectWindow(timestamps, windowSec) {
  const W = windowSec * 1000;
  const ts = [];
  for (const t of timestamps) {
    const ms = toMs(t);
    if (!Number.isNaN(ms)) ts.push(ms);
  }
  if (ts.length === 0) return null;
  ts.sort((a, b) => a - b);
  let winStart = ts[0];
  for (const t of ts) if (t >= winStart + W) winStart = t;
  return { start: new Date(winStart), reset: new Date(winStart + W) };
}
