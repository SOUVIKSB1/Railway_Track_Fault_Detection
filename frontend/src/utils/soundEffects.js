/**
 * Silent sound engine stub to keep the UI clean, quiet, and minimal.
 */

class SoundEngine {
  init() {}
  toggleSound() { return false; }
  playPassChime() {}
  playCriticalAlarm() {}
  playWarningTone() {}
  playScanPing() {}
  playClick() {}
}

export const soundFx = new SoundEngine();
