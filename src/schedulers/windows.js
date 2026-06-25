import { execFileSync } from 'node:child_process';

const TASK = 'UsageRush';

// Run a PowerShell script via -EncodedCommand (UTF-16LE base64) to avoid quoting issues.
function pwsh(script) {
  // Suppress the "Preparing modules for first use" progress stream (leaks as CLIXML
  // when stdout is redirected) and drop stderr so only our intended output returns.
  const full = `$ProgressPreference='SilentlyContinue';\n${script}`;
  const b64 = Buffer.from(full, 'utf16le').toString('base64');
  return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

// Install/refresh a recurring task that runs `node "<cli>" tick` every intervalMin.
// noLogin=true → S4U principal (runs without an interactive logon; requires elevation).
function buildInstallScript({ node, cli, intervalMin, noLogin, taskName }) {
  const principal = noLogin
    ? `$pr = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType S4U -RunLevel Highest`
    : `$pr = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType Interactive`;
  return `
$ErrorActionPreference='Stop'
$act = New-ScheduledTaskAction -Execute '${node}' -Argument '"${cli}" tick'
$trg = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes ${intervalMin})
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -WakeToRun
${principal}
Register-ScheduledTask -TaskName '${taskName}' -Action $act -Trigger $trg -Settings $set -Principal $pr -Force | Out-Null
Start-ScheduledTask -TaskName '${taskName}'
'INSTALLED'`;
}

// Register the recurring tick. If task creation is denied (locked-down / non-elevated),
// relaunch the registration elevated via a one-time UAC prompt.
export function installTick({ node, cli, intervalMin = 5, noLogin = false, taskName = TASK }) {
  const script = buildInstallScript({ node, cli, intervalMin, noLogin, taskName });
  try {
    return pwsh(script).trim();
  } catch {
    const b64 = Buffer.from(`$ProgressPreference='SilentlyContinue';\n${script}`, 'utf16le').toString('base64');
    try {
      execFileSync(
        'powershell',
        ['-NoProfile', '-Command', `Start-Process powershell -Verb RunAs -Wait -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand','${b64}')`],
        { stdio: 'inherit', windowsHide: false },
      );
      return 'INSTALLED (elevated via UAC)';
    } catch {
      throw new Error('需要管理员权限；UAC 被取消/不可用。请在「管理员 PowerShell」里重跑 install。');
    }
  }
}

export function removeTick({ taskName = TASK } = {}) {
  return pwsh(
    `try { Unregister-ScheduledTask -TaskName '${taskName}' -Confirm:$false -ErrorAction Stop; 'REMOVED' } catch { 'NOTFOUND' }`,
  ).trim();
}

export function statusTick({ taskName = TASK } = {}) {
  const script = `
try {
  $t = Get-ScheduledTask -TaskName '${taskName}' -ErrorAction Stop
  $i = Get-ScheduledTaskInfo -TaskName '${taskName}'
  [pscustomobject]@{ state="$($t.State)"; last="$($i.LastRunTime)"; next="$($i.NextRunTime)"; lastResult=$i.LastTaskResult } | ConvertTo-Json -Compress
} catch { '{"state":"NotInstalled"}' }`;
  try {
    return JSON.parse(pwsh(script).trim());
  } catch {
    return { state: 'unknown' };
  }
}

export const needsElevationForNoLogin = true;
