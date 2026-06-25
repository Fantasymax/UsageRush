#!/usr/bin/env node
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runTick } from './commands/tick.js';
import { runSetup } from './commands/setup.js';
import { runStatus } from './commands/status.js';
import { runDoctor } from './commands/doctor.js';
import { getScheduler } from './schedulers/index.js';
import { loadConfig } from './config.js';

const CLI = fileURLToPath(import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function parseFlags(args) {
  const f = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (t.startsWith('--')) {
      const k = t.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) f[k] = args[++i];
      else f[k] = true;
    } else f._.push(t);
  }
  return f;
}

const HELP = `UsageRush ${pkg.version} — keep Claude / Codex usage windows on a schedule you choose.

Usage: usagerush <command> [options]

Commands:
  setup            Interactive wizard: detect windows, pick mode/anchors, show the
                   resulting refresh table, save config. (flags below for scripting)
  install          Install the OS scheduler tick (--no-login for S4U, needs admin;
                   --interval <min> to override)
  uninstall        Remove the scheduler tick
  tick             Run the engine once (used by the scheduler; --force to ping now)
  ping             Force a ping now for all enabled providers
  status           Show windows, refresh table, idle projection, recent pings (read-only)
  doctor           Self-check + self-heal + actionable issue summary
  version | help

setup flags (non-interactive):
  --provider <id>  claude | codex
  --mode <m>       fixed | chain
  --anchors <a,b>  comma-separated HH:MM (fixed mode)
  --enable | --disable
  --window <sec>   override window length
  --interval <min> tick interval
  --yes            apply without prompts

Data: ~/.usagerush/  (config.json, state-*.json, usagerush.log)`;

async function main() {
  const cmd = process.argv[2] || 'help';
  const flags = parseFlags(process.argv.slice(3));

  switch (cmd) {
    case 'tick':
      await runTick({ force: !!flags.force });
      break;
    case 'ping':
      await runTick({ force: true });
      break;
    case 'setup':
      await runSetup(flags);
      break;
    case 'status':
      await runStatus();
      break;
    case 'doctor':
      await runDoctor();
      break;
    case 'install': {
      const cfg = loadConfig();
      const intervalMin = Number(flags.interval) || cfg?.tickIntervalMin || 5;
      try {
        const r = getScheduler().installTick({
          node: process.execPath,
          cli: CLI,
          intervalMin,
          noLogin: !!flags['no-login'],
        });
        console.log(`scheduler: ${r} (tick 每 ${intervalMin}min${flags['no-login'] ? '，无登录 S4U' : '，登录态'})`);
        console.log('查看: usagerush status');
      } catch (e) {
        console.error(`安装失败: ${String(e.message || e)}`);
        if (flags['no-login']) console.error('提示: --no-login 需要在「管理员 PowerShell」里运行。');
        process.exit(1);
      }
      break;
    }
    case 'uninstall':
      console.log(`scheduler: ${getScheduler().removeTick()}`);
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log(`usagerush ${pkg.version}`);
      break;
    default:
      console.log(HELP);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
