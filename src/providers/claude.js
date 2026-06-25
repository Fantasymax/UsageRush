import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { scanTimestamps } from './logscan.js';
import { resolveBin, runPing } from './exec.js';

const logDir = () => path.join(os.homedir(), '.claude', 'projects');

// Claude Code provider. Window mechanics verified (5h rolling from first message).
export default {
  id: 'claude',
  displayName: 'Claude',
  defaultWindowSec: 18000,
  experimental: false,

  detectInstalled() {
    return resolveBin('claude') != null;
  },

  // ~/.claude/.credentials.json holds the subscription OAuth token (plaintext).
  authHealthy() {
    try {
      const f = path.join(os.homedir(), '.claude', '.credentials.json');
      const o = JSON.parse(fs.readFileSync(f, 'utf8'));
      return !!(o && (o.claudeAiOauth || o.oauth || o.accessToken));
    } catch {
      return false;
    }
  },

  readActivityTimestamps(sinceMs) {
    return scanTimestamps(logDir(), sinceMs);
  },

  // --safe-mode skips CLAUDE.md/skills/hooks/MCP (avoids unrelated hooks blocking the
  // headless call and keeps token use minimal); auth works normally. json → cost parse.
  ping() {
    return runPing('claude', ['-p', 'hi', '--safe-mode', '--output-format', 'json']);
  },
};
