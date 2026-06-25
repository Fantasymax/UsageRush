import { loadConfig } from '../config.js';
import { getProvider } from '../providers/index.js';
import { detectWindow } from '../core/window.js';
import { decide } from '../core/decide.js';
import { classify } from '../core/schedule.js';
import { loadState, saveState, pushPing, ourPingTimes } from '../state.js';
import { log, trimLog } from '../log.js';
import { notify } from '../notify.js';
import { fmtHM } from '../core/time.js';

const fmtCost = (c) => (c == null ? '?' : `$${Number(c).toFixed(4)}`);

// One engine run. Called every tickIntervalMin by the OS scheduler (and by `ping`/`status`).
// Stateless across runs: everything needed is reloaded from config + state + provider logs.
export async function runTick({ now = new Date(), force = false, dryRun = false } = {}) {
  const cfg = loadConfig();
  if (!cfg) {
    log('tick: no config — run `usagerush setup` first', true);
    return { error: 'no-config' };
  }
  const results = [];

  for (const [id, pc] of Object.entries(cfg.providers)) {
    if (!pc.enabled) continue;
    const provider = getProvider(id);
    if (!provider) continue;

    const windowSec = pc.windowSec || provider.defaultWindowSec;
    const st = loadState(id);
    const lookbackMs = 2 * windowSec * 1000;
    const ts = provider.readActivityTimestamps(now.getTime() - lookbackMs);
    const window = detectWindow(ts, windowSec);

    const d = force
      ? { due: true, reason: 'forced' }
      : decide({ mode: pc.mode, now, window, bufferSec: cfg.bufferSec, fixed: pc.fixed, state: st });

    st.lastTickAt = now.toISOString();
    st.currentWindowStart = window ? window.start.toISOString() : null;
    st.currentReset = window ? window.reset.toISOString() : null;

    const cls = classify({ mode: pc.mode, window, anchors: pc.fixed?.anchors || [], ourPings: ourPingTimes(st) });
    st.lastClassify = cls.state;

    if (d.due && !dryRun) {
      const r = provider.ping();
      const at = new Date().toISOString();
      pushPing(st, { at, result: r.ok ? 'ok' : 'fail', cost: r.cost ?? null, reason: d.reason });
      if (r.ok) {
        st.lastPingAt = at;
        st.lastPingResult = 'ok';
        st.lastPingCost = r.cost ?? null;
        st.consecutiveAuthFails = 0;
        if (d.anchor) st.lastFiredAnchor = d.anchor.toISOString();
        log(`[${id}] due(${d.reason}) → ping OK cost=${fmtCost(r.cost)}`);
      } else {
        st.lastPingResult = 'fail';
        if (r.auth) st.consecutiveAuthFails = (st.consecutiveAuthFails || 0) + 1;
        log(`[${id}] due(${d.reason}) → ping FAIL: ${r.err}`);
        if (r.auth && (st.consecutiveAuthFails || 0) >= (cfg.authFailThreshold || 3)) {
          notify('UsageRush', `${provider.displayName} 认证失效，请重新登录（${id}）`);
        }
      }
      results.push({ id, action: 'ping', ok: r.ok, reason: d.reason });
    } else {
      if (d.reason === 'fixed:preempted' && cfg.notify?.onAnchorPreempted && !dryRun) {
        notify('UsageRush', `${provider.displayName}：${d.anchor ? fmtHM(d.anchor) : ''} 锚点被你的使用抢占（已有活窗口）`);
      }
      log(`[${id}] skip(${d.reason}) class=${cls.state}`);
      results.push({ id, action: dryRun && d.due ? 'would-ping' : 'skip', reason: d.reason });
    }

    saveState(id, st);
  }

  trimLog();
  return { results };
}
