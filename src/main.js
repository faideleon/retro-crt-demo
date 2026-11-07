import * as THREE from 'three';
import { createScene } from './scene.js';
import { createComputer, SCREEN } from './computer.js';
import { createCrtMaterial } from './crtMaterial.js';
import { createScreenTexture } from './screenTexture.js';
import { createOS } from './os.js';
import * as sfx from './audio.js';
import { createGyro } from './gyro.js';
import { clamp01, lerp, smoothstep, easeOutCubic, easeDive, damp } from './tween.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const noHover = window.matchMedia('(hover: none)').matches;
const slow = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('slow')) || 1 : 1;
const ZOOM_DUR = (reduced ? 0.35 : 1.6) * slow;

const S = createScene(document.getElementById('stage'), { reduced });
const screenTex = createScreenTexture();
const crt = createCrtMaterial(screenTex.tex);
const pc = createComputer(crt);
S.scene.add(pc.group);

const hint = document.getElementById('hint');
const prism = document.getElementById('prism');
const muteBtn = document.getElementById('mute');

// Gyro tilt on phones. iOS hides motion data behind a permission tap,
// so show a small button there; Android starts listening right away.
const gyro = createGyro();
const tiltBtn = document.getElementById('tilt');
if (gyro.needsPermission && noHover) {
  // Only ask if no tilt data shows up on its own (iOS).
  setTimeout(() => { if (!gyro.state.active) tiltBtn.hidden = false; }, 1200);
  tiltBtn.addEventListener('click', async () => {
    sfx.unlockAudio();
    const ok = await gyro.requestPermission();
    tiltBtn.textContent = ok ? 'tilt: on' : 'tilt: blocked';
    setTimeout(() => (tiltBtn.hidden = true), 1200);
  });
}
const os = createOS(document.getElementById('os'), { onPower: zoomOut, onClickSound: sfx.sClick });
document.getElementById('os').prepend(prism);

// ---------------------------------------------------------------- state
// intro → idle → zoomIn → inside → zoomOut → idle
let state = 'intro';
let introStart = performance.now();
let last = introStart;
let running = true;
let anim = null; // { from, to, rot0, start, dir }
let lampOnPlayed = false;
let powerPlayed = false;

const mouse = new THREE.Vector2();
const ndc = new THREE.Vector2(9, 9);
const ray = new THREE.Raycaster();
let hover = false;
let hoverAmt = 0;
const camTarget = new THREE.Vector3();

// ---------------------------------------------------------------- poses
function idlePose() {
  const A = window.innerWidth / window.innerHeight;
  const target = new THREE.Vector3(0, 0.52, 0.3);
  const dir = new THREE.Vector3(0.3, 0.22, 1).normalize();
  const dist = 3.1 * Math.max(1, Math.pow(1.35 / A, 0.75));
  // Keep the fog behind the computer however far back the camera sits.
  S.scene.fog.near = dist + 1.2;
  S.scene.fog.far = dist + 6.5;
  return { pos: target.clone().addScaledVector(dir, dist), target };
}

/** Camera pose where the screen exactly covers the viewport. */
function screenPose() {
  const rot = pc.group.rotation.y;
  pc.group.rotation.y = 0;
  pc.group.updateMatrixWorld(true);
  const center = pc.screen.getWorldPosition(new THREE.Vector3());
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(pc.screen.getWorldQuaternion(new THREE.Quaternion()));
  pc.group.rotation.y = rot;
  pc.group.updateMatrixWorld(true);

  const A = window.innerWidth / window.innerHeight;
  const SA = SCREEN.w / SCREEN.h;
  const visH = A >= SA ? SCREEN.w / A : SCREEN.h;
  const d = visH / 2 / Math.tan(THREE.MathUtils.degToRad(S.camera.fov / 2));
  return { pos: center.clone().addScaledVector(normal, d), target: center };
}

const bezier = (a, c, b, t, out) => {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z
  );
};

// ---------------------------------------------------------------- init
{
  const p = idlePose();
  S.camera.position.copy(p.pos);
  camTarget.copy(p.target);
  S.camera.lookAt(camTarget);
}
screenTex.ready.then(() => screenTex.draw());

/**
 * Pick a scanline count so each line is ~3 CSS px tall in the idle view:
 * fewer, chunkier lines on phones, more on big screens. Set once per viewport
 * size (not per frame) so lines simply grow during the zoom instead of sliding.
 */
const PX_PER_LINE = 3;
function updateScanlines() {
  const p = idlePose();
  const cam = S.camera.clone();
  cam.position.copy(p.pos);
  cam.lookAt(p.target);
  cam.updateMatrixWorld();
  pc.group.updateMatrixWorld(true);
  const top = pc.screen.localToWorld(new THREE.Vector3(0, SCREEN.h / 2, 0)).project(cam);
  const bot = pc.screen.localToWorld(new THREE.Vector3(0, -SCREEN.h / 2, 0)).project(cam);
  const px = (Math.abs(top.y - bot.y) / 2) * window.innerHeight;
  crt.uniforms.uLines.value = Math.round(Math.min(230, Math.max(40, px / PX_PER_LINE)));
}
updateScanlines();
setInterval(() => { if (state !== 'inside') screenTex.draw(); }, 10_000);

// ---------------------------------------------------------------- input
window.addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  ndc.set(mouse.x, -mouse.y);
});

window.addEventListener('pointerdown', (e) => {
  if (sfx.unlockAudio() && (state === 'idle' || state === 'zoomIn')) sfx.humStart();
  if (state !== 'idle' || e.target !== S.renderer.domElement) return;
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  if (hitScreen()) zoomIn();
});

hint.addEventListener('click', () => {
  sfx.unlockAudio();
  if (state === 'idle') zoomIn();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state === 'inside') zoomOut();
});

muteBtn.addEventListener('click', () => {
  const m = muteBtn.getAttribute('aria-pressed') !== 'true';
  muteBtn.setAttribute('aria-pressed', String(m));
  muteBtn.textContent = m ? 'sound: off' : 'sound: on';
  sfx.setMuted(m);
});

window.addEventListener('resize', () => {
  S.resize();
  updateScanlines();
  screenTex.draw();
  if (state === 'inside') {
    const p = screenPose();
    S.camera.position.copy(p.pos);
    camTarget.copy(p.target);
    S.camera.lookAt(camTarget);
  }
});

function hitScreen() {
  ray.setFromCamera(ndc, S.camera);
  return ray.intersectObject(pc.screen, false).length > 0;
}

// ---------------------------------------------------------------- transitions
function zoomIn() {
  state = 'zoomIn';
  hint.classList.remove('show');
  document.body.style.cursor = '';
  screenTex.state.pressed = true;
  screenTex.draw();
  sfx.sClick();
  setTimeout(() => {
    screenTex.state.dialog = false;
    screenTex.state.pressed = false;
    screenTex.state.hover = false;
    screenTex.draw();
  }, 150);
  sfx.sWhoosh(ZOOM_DUR + 0.1);
  sfx.humStop(ZOOM_DUR);
  anim = {
    from: { pos: S.camera.position.clone(), target: camTarget.clone() },
    to: screenPose(),
    rot0: pc.group.rotation.y,
    start: performance.now() + 120,
    dir: 1,
  };
}

function finishZoomIn() {
  state = 'inside';
  anim = null;
  os.show();
  prism.classList.remove('bloom');
  void prism.offsetWidth;
  prism.classList.add('bloom');
  setTimeout(() => { if (state === 'inside') running = false; }, 300);
}

async function zoomOut() {
  if (state !== 'inside') return;
  state = 'zoomOut';
  await os.closeAll();
  screenTex.state.dialog = true;
  screenTex.draw();
  crt.uniforms.uCrt.value = 0;
  startLoop();
  prism.classList.remove('bloom');
  await os.hide();
  sfx.sClick();
  sfx.sWhoosh(ZOOM_DUR, true);
  const idle = idlePose();
  anim = {
    from: idle,
    to: screenPose(),
    rot0: 0,
    start: performance.now(),
    dir: -1,
  };
}

function finishZoomOut() {
  state = 'idle';
  anim = null;
  hint.classList.add('show');
  sfx.humStart();
}

/** t: 0 = idle pose, 1 = inside the screen. */
function applyZoom(t) {
  const e = easeDive(t);
  const { from, to } = anim;
  const ctrl = new THREE.Vector3(to.pos.x + 0.05, to.pos.y + 0.08, to.pos.z + 1.0);
  bezier(from.pos, ctrl, to.pos, e, S.camera.position);
  camTarget.lerpVectors(from.target, to.target, easeOutCubic(clamp01(e * 1.5)));
  S.camera.lookAt(camTarget);
  pc.group.rotation.y = lerp(anim.rot0, 0, easeOutCubic(clamp01(t * 2)));
  crt.uniforms.uCrt.value = 1 - smoothstep(0.55, 1, t);
}

// ---------------------------------------------------------------- loop
function lampLevel(t) {
  if (reduced) return t > 0.3 ? 1 : 0;
  if (t < 0.45) return 0;
  if (t < 0.5) return 0.7;
  if (t < 0.58) return 0.05;
  if (t < 0.63) return 0.9;
  if (t < 0.78) return 0.15;
  return Math.min(1, 0.65 + (t - 0.78) * 1.6);
}

function startLoop() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;
  const it = (now - introStart) / 1000;

  // Intro: lamp flickers on, then the monitor powers on.
  const lamp = lampLevel(it);
  S.setLamp(lamp);
  if (lamp > 0 && !lampOnPlayed) { lampOnPlayed = true; sfx.sLamp(); }
  const power = clamp01((it - 1.5) / (reduced ? 0.2 : 1.0));
  crt.uniforms.uPower.value = power;
  pc.setPowerLed(power > 0 ? 1 : 0);
  if (power > 0 && !powerPlayed) { powerPlayed = true; sfx.sPowerOn(); sfx.humStart(); }
  if (state === 'intro' && it > 2.7) {
    state = 'idle';
    hint.classList.add('show');
  }

  crt.uniforms.uTime.value = time;
  const flicker = reduced ? 0 : Math.sin(time * 37) * 0.04 + Math.sin(time * 11.3) * 0.05;
  S.glow.intensity = power * (0.55 + flicker * 0.5) * (1 - smoothstep(0.5, 1, anim ? clamp01((now - anim.start) / 1000 / ZOOM_DUR) : 0));
  const sp = pc.screen.getWorldPosition(new THREE.Vector3());
  S.glow.position.set(sp.x, sp.y - 0.05, sp.z + 0.45);
  S.updateDust(time);

  if (state === 'intro' || state === 'idle') {
    // Turn toward the cursor (or sway on touch devices).
    let yaw = 0, camX = 0, camY = 0;
    if (!reduced) {
      if (gyro.state.active) {
        tiltBtn.hidden = true;
        // Phone tilt: same feel as the mouse, a touch stronger.
        yaw = gyro.state.x * 0.18;
        camX = gyro.state.x * 0.12;
        camY = -gyro.state.y * 0.1;
      } else if (noHover) {
        yaw = Math.sin(time * 0.35) * 0.07;
        camY = Math.sin(time * 0.23) * 0.03;
      } else {
        yaw = mouse.x * 0.14;
        camX = mouse.x * 0.08;
        camY = -mouse.y * 0.08;
      }
    }
    const k = damp(4, dt);
    pc.group.rotation.y += (yaw - pc.group.rotation.y) * k;
    const p = idlePose();
    S.camera.position.x += (p.pos.x + camX - S.camera.position.x) * k;
    S.camera.position.y += (p.pos.y + camY - S.camera.position.y) * k;
    S.camera.position.z += (p.pos.z - S.camera.position.z) * k;
    camTarget.lerp(p.target, k);
    S.camera.lookAt(camTarget);

    // Hover on the screen
    const h = state === 'idle' && !noHover && hitScreen();
    if (h !== hover) {
      hover = h;
      document.body.style.cursor = h ? 'pointer' : '';
      screenTex.state.hover = h;
      screenTex.draw();
    }
  }
  hoverAmt += ((hover ? 1 : 0) - hoverAmt) * damp(10, dt);
  crt.uniforms.uHover.value = hoverAmt;

  if (anim) {
    const raw = clamp01((now - anim.start) / 1000 / ZOOM_DUR);
    const t = anim.dir === 1 ? raw : 1 - raw;
    applyZoom(t);
    if (raw >= 1) anim.dir === 1 ? finishZoomIn() : finishZoomOut();
  }

  S.renderer.render(S.scene, S.camera);
}

requestAnimationFrame(loop);

if (import.meta.env.DEV) window.__demo = { S, pc, crt, screenTex, get state() { return state; } };
