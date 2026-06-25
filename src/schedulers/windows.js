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
export function installTick({ node, cli, intervalMin = 5, noLogin = false, taskName = TASK }) {
  const principal = noLogin
    ? `$pr = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType S4U -RunLevel Highest`
    : `$pr = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType Interactive`;
  const script = `
$ErrorActionPreference='Stop'
$act = New-ScheduledTaskAction -Execute '${node}' -Argument '"${cli}" tick'
$trg = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes ${intervalMin})
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -WakeToRun
${principal}
Register-ScheduledTask -TaskName '${taskName}' -Action $act -Trigger $trg -Settings $set -Principal $pr -Force | Out-Null
Start-ScheduledTask -TaskName '${taskName}'
'INSTALLED'`;
  return pwsh(script).trim();
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
