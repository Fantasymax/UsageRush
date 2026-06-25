// Local-clock anchor helpers. Anchors are "HH:MM" strings in the machine's local time.

export function parseAnchor(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) throw new Error(`invalid anchor time: "${s}" (expected HH:MM)`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) throw new Error(`anchor out of range: "${s}"`);
  return { h, m: min };
}

// A Date at the given anchor clock-time on the same local date as `ref`.
export function anchorOnDate(anchor, ref) {
  const d = new Date(ref);
  d.setHours(anchor.h, anchor.m, 0, 0);
  return d;
}

// Latest anchor instant <= now (searches today and yesterday). Returns Date|null.
export function latestAnchorAtOrBefore(anchors, now) {
  let best = null;
  for (const raw of anchors) {
    const a = parseAnchor(raw);
    for (const dayOffset of [0, -1]) {
      const ref = new Date(now);
      ref.setDate(ref.getDate() + dayOffset);
      const inst = anchorOnDate(a, ref);
      if (inst.getTime() <= now.getTime() && (!best || inst.getTime() > best.getTime())) best = inst;
    }
  }
  return best;
}

// Earliest anchor instant strictly > ref (searches today and tomorrow). Returns Date|null.
export function nextAnchorAfter(anchors, ref) {
  let best = null;
  for (const raw of anchors) {
    const a = parseAnchor(raw);
    for (const dayOffset of [0, 1]) {
      const r = new Date(ref);
      r.setDate(r.getDate() + dayOffset);
      const inst = anchorOnDate(a, r);
      if (inst.getTime() > ref.getTime() && (!best || inst.getTime() < best.getTime())) best = inst;
    }
  }
  return best;
}

const pad = (n) => String(n).padStart(2, '0');

export function fmtLocal(d) {
  if (!d) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtHM(d) {
  if (!d) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDur(ms) {
  const sign = ms < 0 ? '-' : '';
  let s = Math.abs(Math.round(ms / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  if (h > 0) return `${sign}${h}h${pad(m)}m`;
  if (m > 0) return `${sign}${m}m${pad(s)}s`;
  return `${sign}${s}s`;
}
