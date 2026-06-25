import fs from 'node:fs';
import { DIR, LOG } from './paths.js';
import { fmtLocal } from './core/time.js';

export function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

// Append a line to the rotating log and (optionally) echo to stderr.
export function log(msg, echo = false) {
  try {
    ensureDir();
    fs.appendFileSync(LOG, `[${fmtLocal(new Date())}] ${msg}\n`, 'utf8');
  } catch {
    /* logging must never throw */
  }
  if (echo) process.stderr.write(`${msg}\n`);
}

// Keep the log from growing without bound (trim to last ~2000 lines occasionally).
export function trimLog(maxLines = 2000) {
  try {
    const txt = fs.readFileSync(LOG, 'utf8');
    const lines = txt.split('\n');
    if (lines.length > maxLines * 1.5) {
      fs.writeFileSync(LOG, lines.slice(-maxLines).join('\n'), 'utf8');
    }
  } catch {
    /* ignore */
  }
}
