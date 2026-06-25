import fs from 'node:fs';
import { statePath, DIR } from './paths.js';

export function loadState(id) {
  try {
    const st = JSON.parse(fs.readFileSync(statePath(id), 'utf8'));
    if (!Array.isArray(st.recentPings)) st.recentPings = [];
    return st;
  } catch {
    return { recentPings: [], consecutiveAuthFails: 0 };
  }
}

export function saveState(id, st) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(statePath(id), JSON.stringify(st, null, 2), 'utf8');
}

// Append a ping record to the ring buffer (keeps the most recent `keep`).
export function pushPing(st, entry, keep = 60) {
  if (!Array.isArray(st.recentPings)) st.recentPings = [];
  st.recentPings.push(entry);
  if (st.recentPings.length > keep) st.recentPings = st.recentPings.slice(-keep);
}

// ISO times of recent successful pings (used by drift classification).
export function ourPingTimes(st) {
  return (st.recentPings || []).filter((p) => p.result === 'ok').map((p) => p.at);
}
