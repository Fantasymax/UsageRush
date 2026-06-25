import { spawn } from 'node:child_process';

// Best-effort, non-blocking cross-platform desktop notification.
// Never throws; failure to notify must not affect the tick.
export function notify(title, message) {
  try {
    if (process.platform === 'win32') return notifyWindows(title, message);
    if (process.platform === 'darwin') return notifyMac(title, message);
    return notifyLinux(title, message);
  } catch {
    /* ignore */
  }
}

function detach(cmd, args) {
  const p = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
  p.on('error', () => {});
  p.unref();
}

function notifyWindows(title, message) {
  // WinRT toast via PowerShell, passed as Base64 (UTF-16LE) to avoid quoting issues.
  const esc = (s) => String(s).replace(/[`"$]/g, ' ').replace(/\r?\n/g, ' ');
  const ps = `
$ErrorActionPreference='Stop'
$null=[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]
$tpl=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$t=$tpl.GetElementsByTagName('text')
$t.Item(0).AppendChild($tpl.CreateTextNode("${esc(title)}"))|Out-Null
$t.Item(1).AppendChild($tpl.CreateTextNode("${esc(message)}"))|Out-Null
$toast=[Windows.UI.Notifications.ToastNotification]::new($tpl)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("UsageRush").Show($toast)`;
  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  detach('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64]);
}

function notifyMac(title, message) {
  const esc = (s) => String(s).replace(/"/g, '\\"');
  detach('osascript', ['-e', `display notification "${esc(message)}" with title "${esc(title)}"`]);
}

function notifyLinux(title, message) {
  detach('notify-send', [String(title), String(message)]);
}
