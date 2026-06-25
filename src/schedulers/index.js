import * as windows from './windows.js';

// Phase 1 implements Windows. Linux (cron) and macOS (launchd) are planned (phase 2).
export function getScheduler() {
  if (process.platform === 'win32') return windows;

  const notYet = (name) => () => {
    throw new Error(
      `${process.platform} scheduler not implemented yet (planned: ${process.platform === 'darwin' ? 'launchd' : 'cron'}). ` +
        `For now run \`usagerush tick\` from your own ${process.platform === 'darwin' ? 'launchd agent / cron' : 'crontab'} every few minutes.`,
    );
  };
  return {
    installTick: notYet('install'),
    removeTick: notYet('remove'),
    statusTick: () => ({ state: 'unsupported-platform' }),
    needsElevationForNoLogin: false,
  };
}
