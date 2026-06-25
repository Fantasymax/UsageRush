import os from 'node:os';
import path from 'node:path';

// All runtime data lives under ~/.usagerush (resolved at runtime; never hardcoded).
export const HOME = os.homedir();
export const DIR = process.env.USAGERUSH_DIR || path.join(HOME, '.usagerush');
export const CONFIG = path.join(DIR, 'config.json');
export const LOG = path.join(DIR, 'usagerush.log');
export const statePath = (id) => path.join(DIR, `state-${id}.json`);
