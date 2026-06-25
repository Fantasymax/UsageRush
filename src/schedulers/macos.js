import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// macOS scheduler via a launchd LaunchAgent (runs while the user is logged in).
// NOTE: implemented but not exercised on the author's machine — please report issues.
// True no-login on macOS requires a LaunchDaemon (root); not done automatically.

const LABEL = 'com.usagerush.tick';
const plistPath = () => path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const uid = () => (typeof process.getuid === 'function' ? process.getuid() : 0);

function buildPlist({ node, cli, intervalMin }) {
  const dir = path.join(os.homedir(), '.usagerush');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(node)}</string>
    <string>${esc(cli)}</string>
    <string>tick</string>
  </array>
  <key>StartInterval</key><integer>${intervalMin * 60}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${esc(path.join(dir, 'launchd.out.log'))}</string>
  <key>StandardErrorPath</key><string>${esc(path.join(dir, 'launchd.err.log'))}</string>
</dict>
</plist>`;
}

export function installTick({ node, cli, intervalMin = 5, noLogin = false }) {
  if (noLogin) {
    throw new Error('macOS 无登录需 LaunchDaemon(root)，未自动支持；去掉 --no-login 用 LaunchAgent（登录后运行）。');
  }
  const p = plistPath();
  mkdirSync(path.dirname(p), { recursive: true });
  mkdirSync(path.join(os.homedir(), '.usagerush'), { recursive: true });
  writeFileSync(p, buildPlist({ node, cli, intervalMin }), 'utf8');
  const u = uid();
  try {
    execFileSync('launchctl', ['bootout', `gui/${u}/${LABEL}`], { stdio: 'ignore' });
  } catch {
    /* not loaded yet */
  }
  execFileSync('launchctl', ['bootstrap', `gui/${u}`, p], { stdio: 'pipe' });
  try {
    execFileSync('launchctl', ['enable', `gui/${u}/${LABEL}`], { stdio: 'ignore' });
  } catch {
    /* best effort */
  }
  return 'INSTALLED (launchd LaunchAgent)';
}

export function removeTick() {
  const u = uid();
  try {
    execFileSync('launchctl', ['bootout', `gui/${u}/${LABEL}`], { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
  try {
    if (existsSync(plistPath())) unlinkSync(plistPath());
  } catch {
    /* ignore */
  }
  return 'REMOVED';
}

export function statusTick() {
  const u = uid();
  try {
    execFileSync('launchctl', ['print', `gui/${u}/${LABEL}`], { encoding: 'utf8', stdio: 'pipe' });
    return { state: 'Ready', next: '', last: '' };
  } catch {
    return { state: 'NotInstalled' };
  }
}

export const needsElevationForNoLogin = true;
