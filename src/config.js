import fs from 'node:fs';
import { CONFIG, DIR } from './paths.js';

export const DEFAULT_CONFIG = {
  tickIntervalMin: 5,
  bufferSec: 90,
  authFailThreshold: 3,
  notify: { actionableOnly: true, onAnchorPreempted: false },
  providers: {
    claude: {
      enabled: true,
      mode: 'fixed',
      windowSec: 18000,
      fixed: { anchors: ['09:00', '15:00', '21:00', '03:00'], graceMin: 30 },
    },
    codex: {
      // Disabled by default: Codex window length is ASSUMED 5h (needs verification)
      // and the headless ping (`codex exec`) is experimental. Opt in via `usagerush setup`.
      enabled: false,
      mode: 'chain',
      windowSec: 18000,
      fixed: { anchors: ['09:00', '15:00', '21:00', '03:00'], graceMin: 30 },
    },
  },
};

function isObj(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

function merge(base, over) {
  const out = isObj(base) ? { ...base } : base;
  for (const k of Object.keys(over || {})) {
    out[k] = isObj(base?.[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

export function configExists() {
  try {
    fs.accessSync(CONFIG);
    return true;
  } catch {
    return false;
  }
}

// Loaded config merged over defaults (loaded values win; defaults fill gaps). null if absent.
export function loadConfig() {
  try {
    return merge(DEFAULT_CONFIG, JSON.parse(fs.readFileSync(CONFIG, 'utf8')));
  } catch {
    return null;
  }
}

export function saveConfig(cfg) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
}
