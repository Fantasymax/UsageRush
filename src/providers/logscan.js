import fs from 'node:fs';
import path from 'node:path';

// Recursively collect *.jsonl files under dir.
function walk(dir, acc) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.jsonl')) acc.push(p);
  }
  return acc;
}

// Scan jsonl logs under `dir` for ISO `timestamp` fields >= sinceMs.
// Returns an array of epoch-ms numbers. Skips files whose mtime is well before
// the cutoff so we don't read the whole history every tick.
export function scanTimestamps(dir, sinceMs, re = /"timestamp"\s*:\s*"([^"]+)"/g) {
  const out = [];
  const slackMs = 6 * 3600 * 1000;
  const files = walk(dir, []);
  for (const f of files) {
    let st;
    try {
      st = fs.statSync(f);
    } catch {
      continue;
    }
    if (st.mtimeMs < sinceMs - slackMs) continue;
    let content;
    try {
      content = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const ms = Date.parse(m[1]);
      if (!Number.isNaN(ms) && ms >= sinceMs) out.push(ms);
    }
  }
  return out;
}
