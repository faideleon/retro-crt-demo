export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, t) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
// In-out with a longer, softer landing than a symmetric curve.
export const easeDive = (t) =>
  t < 0.42 ? 0.5 * Math.pow(t / 0.42, 3) : 1 - 0.5 * Math.pow((1 - t) / 0.58, 2.4);
/** Frame-rate independent damping factor. */
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
