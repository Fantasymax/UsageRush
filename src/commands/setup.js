import readline from 'node:readline/promises';
import process from 'node:process';
import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../config.js';
import { getProvider, allProviderIds } from '../providers/index.js';
import { detectWindow } from '../core/window.js';
import { project } from '../core/schedule.js';
import { renderTable, renderProjection, preset6h } from '../render.js';
import { fmtLocal, fmtDur } from '../core/time.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

function detectAndShow(id, pc, now) {
  const provider = getProvider(id);
  const windowSec = pc.windowSec || provider.defaultWindowSec;
  const ts = provider.readActivityTimestamps(now.getTime() - 2 * windowSec * 1000);
  const window = detectWindow(ts, windowSec);
  if (window) {
    const open = window.reset.getTime() > now.getTime();
    console.log(`  检测: 当前窗口 ${fmtLocal(window.start)} → ${fmtLocal(window.reset)} (${open ? `开，${fmtDur(window.reset - now)}后刷新` : '已过期'})`);
  } else {
    console.log('  检测: 无近期活动');
  }
  return { window, windowSec };
}

export async function runSetup(flags = {}) {
  const cfg = loadConfig() || clone(DEFAULT_CONFIG);
  const now = new Date();
  console.log('UsageRush setup\n');

  // ---------- non-interactive (flags / scripting / CI) ----------
  if (flags.yes || flags.provider || flags.mode || flags.anchors || flags.enable || flags.disable) {
    const id = flags.provider || 'claude';
    const pc = cfg.providers[id] || clone(DEFAULT_CONFIG.providers[id]);
    if (flags.enable) pc.enabled = true;
    if (flags.disable) pc.enabled = false;
    if (flags.mode) pc.mode = String(flags.mode) === 'chain' ? 'chain' : 'fixed';
    if (flags.anchors) pc.fixed.anchors = String(flags.anchors).split(',').map((s) => s.trim()).filter(Boolean);
    if (flags.window) pc.windowSec = Number(flags.window);
    if (flags.interval) cfg.tickIntervalMin = Number(flags.interval);
    cfg.providers[id] = pc;
    saveConfig(cfg);
    const windowSec = pc.windowSec || getProvider(id).defaultWindowSec;
    console.log(`✓ 已写入: ${id} enabled=${pc.enabled} mode=${pc.mode}${pc.mode === 'fixed' ? ` anchors=${pc.fixed.anchors.join(',')}` : ''}`);
    if (pc.mode === 'fixed') console.log(renderTable(pc.fixed.anchors, windowSec));
    console.log('\n下一步: `usagerush install`（无登录加 --no-login，需管理员）→ `usagerush status`');
    return;
  }

  // ---------- interactive ----------
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, def) => {
    const a = (await rl.question(`${q}${def != null ? ` [${def}]` : ''}: `)).trim();
    return a || (def != null ? String(def) : '');
  };
  const yn = async (q, def = true) => (await ask(q, def ? 'y' : 'n')).toLowerCase().startsWith('y');

  try {
    for (const id of allProviderIds()) {
      const provider = getProvider(id);
      const pc = cfg.providers[id] || clone(DEFAULT_CONFIG.providers[id]);
      const installed = provider.detectInstalled();
      console.log(`\n=== ${provider.displayName}${provider.experimental ? ' (experimental)' : ''} ===`);
      console.log(`  CLI 安装: ${installed ? '是' : '否'}`);
      if (!installed) {
        pc.enabled = false;
        cfg.providers[id] = pc;
        console.log('  跳过（未安装）');
        continue;
      }
      pc.enabled = await yn('  启用?', pc.enabled);
      if (!pc.enabled) {
        cfg.providers[id] = pc;
        continue;
      }
      detectAndShow(id, pc, now);
      pc.mode = (await ask('  模式 fixed/chain', pc.mode)).toLowerCase() === 'chain' ? 'chain' : 'fixed';
      if (pc.mode === 'fixed') {
        if (await yn('  用「每6h从某时刻」预设?', true)) {
          const start = await ask('  起始时刻 HH:MM', pc.fixed.anchors?.[0] || '09:00');
          pc.fixed.anchors = preset6h(start);
        } else {
          const custom = await ask('  自定义锚点(逗号分隔 HH:MM)', (pc.fixed.anchors || []).join(','));
          pc.fixed.anchors = custom.split(',').map((s) => s.trim()).filter(Boolean);
        }
        const windowSec = pc.windowSec || provider.defaultWindowSec;
        console.log(renderTable(pc.fixed.anchors, windowSec));
        const { window } = detectAndShow(id, pc, now);
        console.log(renderProjection(project({ mode: 'fixed', anchors: pc.fixed.anchors, windowSec, window, now, bufferSec: cfg.bufferSec }), 'fixed'));
        await yn('  采用这个刷新表?', true);
      }
      cfg.providers[id] = pc;
    }
    cfg.tickIntervalMin = Number(await ask('\ntick 间隔(分钟)', cfg.tickIntervalMin)) || cfg.tickIntervalMin;
    saveConfig(cfg);
    console.log('\n✓ 配置已保存到 ~/.usagerush/config.json');
    console.log('下一步: `usagerush install`（无登录加 --no-login，需管理员）→ `usagerush status`');
  } finally {
    rl.close();
  }
}
