import * as THREE from 'three';
import { FONT, LAYOUT as L, ICON_LIST, iconURL, clockText } from './icons.js';

/**
 * Draws an imitation of the HTML OS onto a 4:3 canvas used as the CRT texture.
 * The region the camera will frame at the end of the zoom is laid out at the
 * real viewport's CSS size, so it lines up with the HTML version pixel for pixel.
 * Anything outside that region is dark CRT overscan.
 */
export function createScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d');

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const state = { dialog: true, hover: false, pressed: false };

  const imgs = {};
  const ready = Promise.all(
    ICON_LIST.map(
      ({ id }) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = img.onerror = res;
          img.src = iconURL(id);
          imgs[id] = img;
        })
    )
  );

  const dots = document.createElement('canvas');
  dots.width = dots.height = 6;
  const dctx = dots.getContext('2d');
  dctx.fillStyle = 'rgba(255,255,255,0.09)';
  dctx.fillRect(2, 2, 1.4, 1.4);
  const dotPattern = ctx.createPattern(dots, 'repeat');

  function draw(vw = window.innerWidth, vh = window.innerHeight) {
    const CW = canvas.width, CH = canvas.height;
    const A = vw / vh, SA = CW / CH;
    const rw = A >= SA ? CW : CH * A;
    const rh = A >= SA ? CW / A : CH;
    const s = rw / vw;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c100f';
    ctx.fillRect(0, 0, CW, CH);

    ctx.save();
    ctx.translate((CW - rw) / 2, (CH - rh) / 2);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.rect(0, 0, vw, vh);
    ctx.clip();

    // Desktop
    ctx.fillStyle = L.desktop;
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = dotPattern;
    ctx.fillRect(0, 0, vw, vh);

    drawMenubar(vw);
    drawIcons();
    if (state.dialog) drawDialog(vw, vh);

    ctx.restore();
    tex.needsUpdate = true;
  }

  function drawMenubar(vw) {
    ctx.fillStyle = L.menu;
    ctx.fillRect(0, 0, vw, L.menuH);
    ctx.fillStyle = L.ink;
    ctx.fillRect(0, L.menuH - 2, vw, 2);
    ctx.textBaseline = 'middle';
    const y = (L.menuH - 2) / 2 + 0.5;

    let x = 12;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText('◐ DummyOS', x, y);
    const gap = vw < 480 ? 14 : 20;
    x += ctx.measureText('◐ DummyOS').width + gap;
    ctx.font = `400 13px ${FONT}`;
    for (const item of vw < 480 ? ['File'] : ['File', 'Edit', 'Special']) {
      ctx.fillText(item, x, y);
      x += ctx.measureText(item).width + gap;
    }

    // Right side: power button then clock
    ctx.font = `400 12px ${FONT}`;
    const label = '⏻ Power';
    const bw = ctx.measureText(label).width + 20 + 4;
    const bx = vw - 8 - bw;
    roundRect(bx, 4, bw, 20, 10);
    ctx.fillStyle = L.cream;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = L.ink;
    ctx.stroke();
    ctx.fillStyle = L.ink;
    ctx.fillText(label, bx + 12, 14.5);

    ctx.font = `400 13px ${FONT}`;
    const clock = clockText();
    ctx.fillText(clock, bx - 20 - ctx.measureText(clock).width, y);
  }

  function drawIcons() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `400 12px ${FONT}`;
    ICON_LIST.forEach(({ id, label }, i) => {
      const x = L.iconX, y = L.iconY + i * L.iconStep;
      const img = imgs[id];
      ctx.imageSmoothingEnabled = false;
      if (img?.complete) ctx.drawImage(img, x + (L.iconW - L.iconSize) / 2, y, L.iconSize, L.iconSize);
      ctx.imageSmoothingEnabled = true;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(20,30,28,0.55)';
      ctx.fillRect(x + (L.iconW - tw) / 2, y + L.iconSize + 6, tw, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + L.iconW / 2, y + L.iconSize + 8);
    });
    ctx.textAlign = 'left';
  }

  function drawDialog(vw, vh) {
    const w = Math.min(320, vw - 40), h = 150;
    const x = Math.round((vw - w) / 2), y = Math.round((vh - h) / 2);
    ctx.fillStyle = 'rgba(20,16,12,0.35)';
    ctx.fillRect(x + 5, y + 5, w, h);
    ctx.fillStyle = L.cream;
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = L.ink;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    // Striped title bar
    ctx.fillStyle = L.ink;
    for (let ly = y + 5; ly < y + 22; ly += 3) ctx.fillRect(x + 6, ly, w - 12, 1);
    ctx.fillRect(x, y + 24, w, 2);
    ctx.font = `700 13px ${FONT}`;
    const title = 'welcome';
    const tw = ctx.measureText(title).width + 14;
    ctx.fillStyle = L.cream;
    ctx.fillRect(x + (w - tw) / 2, y + 3, tw, 19);
    ctx.fillStyle = L.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + w / 2, y + 13);

    ctx.font = `400 13px ${FONT}`;
    ctx.fillText('This little computer is a door.', x + w / 2, y + 54);

    const bw = 132, bh = 32, bx = x + (w - bw) / 2, by = y + h - 52;
    const fill = state.pressed ? L.coral : state.hover ? L.ink : L.cream;
    roundRect(bx, by, bw, bh, 6);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = L.ink;
    ctx.stroke();
    ctx.fillStyle = state.hover || state.pressed ? L.cream : L.ink;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText('Start  ▸', bx + bw / 2, by + bh / 2 + 1);
    ctx.textAlign = 'left';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r);
  }

  return { tex, state, ready, draw };
}
