import { loadConfig } from '../config.js';
import { getProvider } from '../providers/index.js';
import { detectWindow } from '../core/window.js';
import { classify, project } from '../core/schedule.js';
import { loadState, ourPingTimes } from '../state.js';
import { renderTable, renderProjection } from '../render.js';
import { fmtLocal, fmtDur } from '../core/time.js';
import { getScheduler } from '../schedulers/index.js';

export async function runStatus({ now = new Date() } = {}) {
  const cfg = loadConfig();
  if (!cfg) {
    console.log('未配置 — 先运行 `usagerush setup`');
    return;
  }
  const task = getScheduler().statusTick();
  console.log(`UsageRush · tick 每 ${cfg.tickIntervalMin}min · buffer ${cfg.bufferSec}s`);
  console.log(`计划任务: ${task.state}${task.next ? ` · 下次 ${task.next}` : ''}${task.last ? ` · 上次 ${task.last}` : ''}`);

  for (const [id, pc] of Object.entries(cfg.providers)) {
    const provider = getProvider(id);
    if (!provider) continue;
    const tag = `${pc.enabled ? 'on' : 'off'} · ${pc.mode}${provider.experimental ? ' · experimental' : ''}`;
    console.log(`\n[${provider.displayName}] ${tag}`);
    if (!pc.enabled) continue;

    const windowSec = pc.windowSec || provider.defaultWindowSec;
    const ts = provider.readActivityTimestamps(now.getTime() - 2 * windowSec * 1000);
    const window = detectWindow(ts, windowSec);
    const st = loadState(id);
    const cls = classify({ mode: pc.mode, window, anchors: pc.fixed?.anchors || [], ourPings: ourPingTimes(st) });

    if (window) {
      const open = window.reset.getTime() > now.getTime();
      console.log(`  当前窗口: ${fmtLocal(window.start)} → ${fmtLocal(window.reset)} (${open ? `开，${fmtDur(window.reset - now)}后刷新` : '已过期'})`);
      console.log(`  状态: ${cls.state} — ${cls.detail}`);
    } else {
      console.log('  当前窗口: 无近期活动');
    }

    if (pc.mode === 'fixed' && pc.fixed?.anchors?.length) console.log(renderTable(pc.fixed.anchors, windowSec));
    const proj = project({ mode: pc.mode, anchors: pc.fixed?.anchors || [], windowSec, window, now, bufferSec: cfg.bufferSec });
    console.log(renderProjection(proj, pc.mode));

    if (st.lastPingAt) {
      console.log(`  上次 ping: ${fmtLocal(new Date(st.lastPingAt))} (${st.lastPingResult}${st.lastPingCost != null ? `, $${Number(st.lastPingCost).toFixed(4)}` : ''})`);
    }
    const dayAgo = now.getTime() - 86400000;
    const recent = (st.recentPings || []).filter((p) => new Date(p.at).getTime() >= dayAgo && p.result === 'ok');
    const cost = recent.reduce((s, p) => s + (p.cost || 0), 0);
    console.log(`  近24h: ${recent.length} pings · ~$${cost.toFixed(3)}`);
    if ((st.consecutiveAuthFails || 0) > 0) console.log(`  ⚠ 连续认证失败 ${st.consecutiveAuthFails}`);
  }
}
