// Phone tilt → normalized x/y in [-1, 1].
// Neutral is whatever angle you hold the phone at; it slowly re-centers so a
// new resting angle becomes the new neutral after a few seconds.
// iOS needs DeviceOrientationEvent.requestPermission() from a tap; Android doesn't.

const RANGE_DEG = 22;
const RECENTER = 0.004; // per event (~60/s) → a few seconds
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

export function createGyro() {
  const state = { active: false, x: 0, y: 0 };
  let base = null;
  let listening = false;

  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    // Map to "left/right" and "toward/away" for the current screen rotation.
    let lr = e.gamma, fb = e.beta;
    if (angle === 90) { lr = e.beta; fb = -e.gamma; }
    else if (angle === -90 || angle === 270) { lr = -e.beta; fb = e.gamma; }
    else if (angle === 180) { lr = -e.gamma; fb = -e.beta; }

    if (!base) base = { lr, fb };
    base.lr += (lr - base.lr) * RECENTER;
    base.fb += (fb - base.fb) * RECENTER;
    state.x = clamp1((lr - base.lr) / RANGE_DEG);
    state.y = clamp1((fb - base.fb) / RANGE_DEG);
    state.active = true;
  }

  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener('deviceorientation', onOrient);
  }

  function reattach() {
    window.removeEventListener('deviceorientation', onOrient);
    window.addEventListener('deviceorientation', onOrient);
  }

  // Some browsers (Chrome, too) expose requestPermission but still send events
  // without it, so always listen; the caller only asks if nothing arrives.
  const needsPermission =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

  listen();

  /** Must be called from a tap/click handler on iOS. Resolves true if granted. */
  async function requestPermission() {
    if (!needsPermission) return true;
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === 'granted') reattach();
      return res === 'granted';
    } catch {
      return false;
    }
  }

  return { state, needsPermission, requestPermission };
}
