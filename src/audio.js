// Tiny WebAudio synth. No audio files. Browsers only allow sound after a user
// gesture, so nothing plays until unlockAudio() runs inside an input handler.

let ctx = null;
let master = null;
let noise = null;
let hum = null;
let muted = false;
const VOLUME = 0.8;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return false;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  master.connect(ctx.destination);
  const len = ctx.sampleRate;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return true; // first unlock
}

export const audioReady = () => !!ctx;

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.04);
}

function gainEnv(t0, attack, peak, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(master);
  return g;
}

function noiseBurst(t0, dur, type, freq, peak, q = 0.7) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(gainEnv(t0, 0.002, peak, dur));
  src.start(t0, Math.random() * 0.5, dur + 0.05);
  return f;
}

function tone(t0, type, f0, f1, dur, peak) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  o.connect(gainEnv(t0, 0.004, peak, dur));
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export function sClick() {
  if (!ctx) return;
  const t = ctx.currentTime;
  noiseBurst(t, 0.03, 'highpass', 2500, 0.25);
  tone(t, 'square', 1900, 900, 0.025, 0.04);
}

export function sLamp() {
  if (!ctx) return;
  const t = ctx.currentTime;
  noiseBurst(t, 0.035, 'bandpass', 3200, 0.5, 1.2);
  noiseBurst(t + 0.05, 0.03, 'bandpass', 1800, 0.25, 1.2);
}

export function sPowerOn() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, 'sine', 90, 38, 0.45, 0.55); // thunk
  noiseBurst(t, 0.25, 'lowpass', 500, 0.35); // static
  noiseBurst(t + 0.05, 0.6, 'highpass', 6000, 0.05); // crackle
}

export function sWhoosh(dur, reverse = false) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.9;
  const [a, b] = reverse ? [2400, 260] : [260, 2400];
  f.frequency.setValueAtTime(a, t);
  f.frequency.exponentialRampToValueAtTime(b, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Faint CRT hum: mains buzz + a quiet high flyback whine. */
export function humStart() {
  if (!ctx || hum) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 0.8);
  out.connect(master);

  const buzz = ctx.createOscillator();
  buzz.type = 'sawtooth';
  buzz.frequency.value = 60;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  const gb = ctx.createGain();
  gb.gain.value = 0.035;
  buzz.connect(lp).connect(gb).connect(out);

  const whine = ctx.createOscillator();
  whine.frequency.value = 15200;
  const gw = ctx.createGain();
  gw.gain.value = 0.004;
  whine.connect(gw).connect(out);

  buzz.start(t);
  whine.start(t);
  hum = { out, oscs: [buzz, whine] };
}

export function humStop(fade = 0.5) {
  if (!ctx || !hum) return;
  const t = ctx.currentTime;
  const h = hum;
  hum = null;
  h.out.gain.cancelScheduledValues(t);
  h.out.gain.setValueAtTime(h.out.gain.value, t);
  h.out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  h.oscs.forEach((o) => o.stop(t + fade + 0.05));
}
