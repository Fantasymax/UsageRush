import * as windows from './windows.js';
import * as macos from './macos.js';
import * as linux from './linux.js';

// Windows (Task Scheduler), macOS (launchd), Linux (cron) all implemented.
export function getScheduler() {
  if (process.platform === 'win32') return windows;
  if (process.platform === 'darwin') return macos;
  if (process.platform === 'linux') return linux;

  const unsupported = () => {
    throw new Error(`unsupported platform: ${process.platform}. Run \`usagerush tick\` from your own scheduler every few minutes.`);
  };
  return {
    installTick: unsupported,
    removeTick: unsupported,
    statusTick: () => ({ state: 'unsupported-platform' }),
    needsElevationForNoLogin: false,
  };
}
