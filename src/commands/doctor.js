import { loadConfig } from '../config.js';
import { getScheduler } from '../schedulers/index.js';
import { getProvider } from '../providers/index.js';
import { loadState } from '../state.js';
import { runTick } from './tick.js';
import { runStatus } from './status.js';

// Self-check + self-heal + actionable issue summary.
export async function runDoctor() {
  const cfg = loadConfig();
  if (!cfg) {
    console.log('未配置 — 先运行 `usagerush setup`');
    return;
  }
  console.log('UsageRush doctor — 自检 + 自愈\n');
  const issues = [];

  const task = getScheduler().statusTick();
  if (task.state === 'NotInstalled') issues.push('计划任务未安装 → `usagerush install`（无登录加 --no-login，需管理员）');
  else if (task.state === 'unsupported-platform') issues.push(`本平台(${process.platform})调度待实现(phase 2)；可自行用 cron/launchd 调用 \`usagerush tick\``);
  else if (typeof task.lastResult === 'number' && ![0, 267011, 267009].includes(task.lastResult))
    issues.push(`计划任务上次返回码 ${task.lastResult}（非0/非"运行中"，查日志 ~/.usagerush/usagerush.log）`);

  // self-heal: a tick pings if due and recomputes state
  console.log('· 运行一次 tick 自愈…');
  const r = await runTick({});
  if (r?.results) for (const x of r.results) console.log(`  ${x.id}: ${x.action}${x.reason ? ` (${x.reason})` : ''}`);

  for (const [id, pc] of Object.entries(cfg.providers)) {
    if (!pc.enabled) continue;
    const provider = getProvider(id);
    if (!provider) continue;
    if (!provider.detectInstalled()) issues.push(`${id}: CLI 未安装 / 不在 PATH`);
    else if (!provider.authHealthy()) issues.push(`${id}: 认证可能失效，建议重新登录`);
    const st = loadState(id);
    if ((st.consecutiveAuthFails || 0) >= (cfg.authFailThreshold || 3)) issues.push(`${id}: 连续认证失败 ${st.consecutiveAuthFails} 次 → 重新登录`);
    if (st.lastClassify === 'user-driven') console.log(`  note: ${id} 窗口由你自己的使用驱动（锚点被抢占，正常，会在下个空闲锚点自动收敛）`);
  }

  console.log('\n=== 健康摘要 ===');
  await runStatus();

  console.log('\n=== 待处理问题 ===');
  if (issues.length === 0) console.log('  ✓ 未发现需要你出手的问题');
  else issues.forEach((i) => console.log('  ⚠ ' + i));
}
