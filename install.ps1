# UsageRush one-line installer for Windows (no clone, no npm; needs Node >= 18).
#
#   irm https://raw.githubusercontent.com/Fantasymax/UsageRush/master/install.ps1 | iex
#
# Env overrides: USAGERUSH_HOME (install dir), USAGERUSH_BIN (launcher dir), USAGERUSH_BRANCH.
$ErrorActionPreference = 'Stop'

$repo   = 'Fantasymax/UsageRush'
$branch = if ($env:USAGERUSH_BRANCH) { $env:USAGERUSH_BRANCH } else { 'master' }
$dest   = if ($env:USAGERUSH_HOME)   { $env:USAGERUSH_HOME }   else { Join-Path $env:USERPROFILE '.usagerush-app' }
$bin    = if ($env:USAGERUSH_BIN)    { $env:USAGERUSH_BIN }    else { Join-Path $env:USERPROFILE '.local\bin' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'UsageRush needs Node.js >= 18, plus the claude/codex CLI you want to keep alive.'
}

Write-Host "-> Downloading UsageRush ($branch)..."
New-Item -ItemType Directory -Force -Path $dest, $bin | Out-Null
$tgz = Join-Path $env:TEMP 'usagerush.tar.gz'
Invoke-WebRequest "https://github.com/$repo/archive/refs/heads/$branch.tar.gz" -OutFile $tgz
tar -xzf $tgz --strip-components=1 -C $dest   # tar.exe ships with Windows 10+
Remove-Item $tgz -Force -ErrorAction SilentlyContinue

$launcher = Join-Path $bin 'usagerush.cmd'
"@echo off`r`nnode `"$dest\src\cli.js`" %*" | Set-Content -Path $launcher -Encoding ascii

# Add launcher dir to the user PATH if missing (reopen terminal to take effect).
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $bin) {
  [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $bin), 'User')
  Write-Host "  Added $bin to your user PATH (reopen the terminal)."
}
Write-Host "OK Installed to $dest  ->  run: usagerush setup"
