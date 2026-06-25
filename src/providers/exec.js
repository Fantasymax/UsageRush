import path from 'node:path';
import os from 'node:os';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Resolve an executable on PATH, trying platform extensions.
export function resolveBin(name) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', '.ps1', ''] : [''];
  for (const d of (process.env.PATH || '').split(path.delimiter)) {
    if (!d) continue;
    for (const ext of exts) {
      const p = path.join(d, name + ext);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

// Run a provider's headless ping. Returns { ok, cost, raw } | { ok:false, err, auth }.
// Cost is parsed best-effort from JSON stdout (Claude --output-format json).
export function runPing(name, args, { timeoutMs = 120000 } = {}) {
  const bin = resolveBin(name);
  if (!bin) return { ok: false, cost: null, err: `${name} not found on PATH`, auth: false };

  const opts = {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  let cmd = bin;
  let cmdArgs = args;
  if (bin.toLowerCase().endsWith('.ps1')) {
    cmd = 'powershell';
    cmdArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bin, ...args];
  } else if (/\.(cmd|bat)$/i.test(bin)) {
    opts.shell = true;
    cmd = `"${bin}"`;
  }

  try {
    const out = String(execFileSync(cmd, cmdArgs, opts) || '');
    let cost = null;
    try {
      const j = JSON.parse(out);
      cost = j.total_cost_usd ?? j.cost_usd ?? j.cost ?? null;
    } catch {
      /* non-JSON output is fine */
    }
    return { ok: true, cost, raw: out.slice(0, 160) };
  } catch (e) {
    const msg = String((e && (e.stderr || e.message)) || '');
    const auth = /unauth|forbidden|\b401\b|\b403\b|not logged|please login|expired|credential|invalid api key/i.test(msg);
    return { ok: false, cost: null, err: msg.slice(0, 300), auth };
  }
}
