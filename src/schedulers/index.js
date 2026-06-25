import * as windows from './windows.js';
import * as macos from './macos.js';

// Windows (Task Scheduler) and macOS (launchd) implemented. Linux (cron) is planned.
export function getScheduler() {
  if (process.platform === 'win32') return windows;
  if (process.platform === 'darwin') return macos;

  const notYet = () => {
    throw new Error(
      'Linux scheduler not implemented yet (planned: cron). For now add a crontab entry, e.g.:\n' +
        '  */5 * * * * <node> <path-to>/usagerush/src/cli.js tick',
    );
  };
  return {
    installTick: notYet,
    removeTick: notYet,
    statusTick: () => ({ state: 'unsupported-platform' }),
    needsElevationForNoLogin: false,
  };
}
