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
  // Buffer stdin lines in a queue so none are lost between prompts (readline drops
  // lines that arrive while no question is pending — happens with piped/redirected
  // input). On EOF, pending prompts resolve to '' (i.e. take the default).
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const queue = [];
  let resolver = null;
  rl.on('line', (line) => {
    if (resolver) {
      const r = resolver;
      resolver = null;
      r(line);
    } else {
      queue.push(line);
    }
  });
  rl.on('close', () => {
    if (resolver) {
      const r = resolver;
      resolver = null;
      r('');
    }
  });
  const nextLine = () =>
    new Promise((resolve) => {
      if (queue.length) resolve(queue.shift());
      else resolver = resolve;
    });
  const ask = async (q, def) => {
    process.stdout.write(`${q}${def != null ? ` [${def}]` : ''}: `);
    const a = (await nextLine()).trim();
    return a || (def != null ? String(def) : '');
  };
  const yn = async (q, def = true) => (await ask(q, def ? 'y' : 'n')).toLowerCase().startsWith('y');

  try {
    console.log('（提示：setup 只写配置，不会真正开始调度；最后跑 `usagerush install` 才上线。随时可按 Ctrl+C 取消。）');
    for (const id of allProviderIds()) {
      const provider = getProvider(id);
      const pc = cfg.providers[id] || clone(DEFAULT_CONFIG.providers[id]);
      const installed = provider.detectInstalled();
      console.log(`\n=== ${provider.displayName}${provider.experimental ? ' (实验性)' : ''} ===`);
      console.log(`  CLI 已安装: ${installed ? '是' : '否'}`);
      if (!installed) {
        pc.enabled = false;
        cfg.providers[id] = pc;
        console.log(`  → 未检测到 ${provider.displayName} CLI，跳过`);
        continue;
      }
      if (provider.experimental) {
        console.log('  ⚠ 实验性：保活 ping 会消耗该工具的【周】用量限额，建议有余量再开');
      }
      pc.enabled = await yn(`  保活 ${provider.displayName}？(y=启用 / n=跳过)`, pc.enabled);
      if (!pc.enabled) {
        cfg.providers[id] = pc;
        console.log(`  → 已跳过 ${provider.displayName}（保持禁用，不会被调度）`);
        continue;
      }
      detectAndShow(id, pc, now);
      console.log('  刷新模式：');
      console.log('    fixed = 每天【固定时刻】刷新，可预测好记（每个 5h 窗口后约 1h 空档）');
      console.log('    chain = 【背靠背】最大吞吐，窗口不间断（但刷新时刻每天漂移约 1h）');
      pc.mode = (await ask('  选模式 (fixed/chain)', pc.mode)).toLowerCase() === 'chain' ? 'chain' : 'fixed';
      if (pc.mode === 'fixed') {
        if (await yn('  用「每 6 小时从某时刻」预设?', true)) {
          const start = await ask('  起始时刻 HH:MM（例如上班时间）', pc.fixed.anchors?.[0] || '09:00');
          pc.fixed.anchors = preset6h(start);
        } else {
          const custom = await ask('  自定义刷新时刻（逗号分隔 HH:MM）', (pc.fixed.anchors || []).join(','));
          pc.fixed.anchors = custom.split(',').map((s) => s.trim()).filter(Boolean);
        }
        const windowSec = pc.windowSec || provider.defaultWindowSec;
        console.log(renderTable(pc.fixed.anchors, windowSec));
        const { window } = detectAndShow(id, pc, now);
        console.log(renderProjection(project({ mode: 'fixed', anchors: pc.fixed.anchors, windowSec, window, now, bufferSec: cfg.bufferSec }), 'fixed'));
      } else {
        console.log(`  chain：每个窗口过期后约 ${cfg.bufferSec}s 自动开下一个。`);
      }
      cfg.providers[id] = pc;
    }
    cfg.tickIntervalMin = Number(await ask('\ntick 检查间隔(分钟)', cfg.tickIntervalMin)) || cfg.tickIntervalMin;

    console.log('\n即将保存：');
    for (const id of allProviderIds()) {
      const pc = cfg.providers[id];
      if (!pc) continue;
      const name = getProvider(id).displayName;
      console.log(
        pc.enabled
          ? `  ${name}：启用 · ${pc.mode}${pc.mode === 'fixed' ? ' · ' + (pc.fixed.anchors || []).join('/') : ''}`
          : `  ${name}：跳过`,
      );
    }
    if (!(await yn('\n保存以上设置?', true))) {
      console.log('已取消，未写入任何配置。');
      return;
    }
    saveConfig(cfg);
    console.log('\n✓ 配置已保存到 ~/.usagerush/config.json');
    console.log('注意：现在【还没开始调度】。运行 `usagerush install` 才会真正定时保活（无登录加 --no-login，需管理员）；再用 `usagerush status` 查看。');
  } finally {
    rl.close();
  }
}
