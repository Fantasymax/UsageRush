import { execFileSync } from 'node:child_process';

// Linux scheduler via the user's crontab. cron runs via the cron daemon regardless of
// interactive login, so this is inherently "no-login" (requires cron installed/running).
// NOTE: implemented but not exercised on the author's machine — reports welcome.

const TAG = 'usagerush-tick';

function readCron() {
  try {
    return execFileSync('crontab', ['-l'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return ''; // "no crontab for user" / not yet created
  }
}

function writeCron(text) {
  execFileSync('crontab', ['-'], { input: text.endsWith('\n') ? text : `${text}\n` });
}

// Keep every line that isn't ours (preserves the user's other cron entries).
function withoutOurs(text) {
  return text.split('\n').filter((l) => !l.includes(TAG) && l.trim() !== '');
}

export function installTick({ node, cli, intervalMin = 5 }) {
  const lines = withoutOurs(readCron());
  lines.push(`*/${intervalMin} * * * * "${node}" "${cli}" tick # ${TAG}`);
  writeCron(lines.join('\n'));
  return 'INSTALLED (cron)';
}

export function removeTick() {
  const text = readCron();
  if (!text.includes(TAG)) return 'NOTFOUND';
  const lines = withoutOurs(text);
  writeCron(lines.length ? lines.join('\n') : '');
  return 'REMOVED';
}

export function statusTick() {
  return readCron().includes(TAG)
    ? { state: 'Installed (cron)', next: '', last: '' }
    : { state: 'NotInstalled' };
}

export const needsElevationForNoLogin = false;
