import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { scanTimestamps } from './logscan.js';
import { resolveBin, runPing } from './exec.js';

const logDir = () => path.join(os.homedir(), '.codex', 'sessions');

// Codex provider. EXPERIMENTAL:
//  - Window length is ASSUMED 5h (configurable; verify against your plan).
//  - Headless ping uses `codex exec` (alias `e`); it runs a real non-interactive
//    turn, so a short prompt is used. Disabled by default until you confirm it
//    behaves on your setup via `usagerush setup`.
export default {
  id: 'codex',
  displayName: 'Codex',
  defaultWindowSec: 18000,
  experimental: true,

  detectInstalled() {
    return resolveBin('codex') != null;
  },

  authHealthy() {
    // Codex stores auth under ~/.codex; we can't reliably introspect it, so treat
    // "installed" as healthy and rely on the ping's auth-error detection.
    try {
      const f = path.join(os.homedir(), '.codex', 'auth.json');
      if (fs.existsSync(f)) return true;
    } catch {
      /* ignore */
    }
    return this.detectInstalled();
  },

  // Codex session logs are date-partitioned jsonl with a "timestamp" field.
  readActivityTimestamps(sinceMs) {
    return scanTimestamps(logDir(), sinceMs);
  },

  ping() {
    return runPing('codex', ['exec', 'hi'], { timeoutMs: 150000 });
  },
};
