import { ICON_LIST, iconURL, clockText, LAYOUT as L } from './icons.js';

const CONTENT = {
  about: {
    title: 'About',
    width: 320,
    html: `
      <h2>Alex Doe</h2>
      <p class="muted">Placeholder Designer &amp; Tinkerer</p>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>
      <p class="muted">Based somewhere nice. Likes tea, synths and small machines.</p>`,
  },
  projects: {
    title: 'Projects',
    width: 340,
    html: `
      <ul>
        <li><span class="swatch" style="background:#e8735a"></span><span><b>Project One</b><br><span class="muted">A placeholder app · 2026</span></span></li>
        <li><span class="swatch" style="background:#e9b949"></span><span><b>Project Two</b><br><span class="muted">Dummy brand system · 2025</span></span></li>
        <li><span class="swatch" style="background:#7fb7c9"></span><span><b>Project Three</b><br><span class="muted">Fake hardware toy · 2024</span></span></li>
      </ul>`,
  },
  notes: {
    title: 'Notes.txt',
    width: 280,
    html: `<pre>todo:
- water the plants
- replace this dummy text
- swap in real Blender renders?
- ship it</pre>`,
  },
  trash: { title: 'Trash', width: 240, html: `<p class="muted">Trash is empty.</p>` },
};

/** The real, interactive retro desktop shown after the zoom. */
export function createOS(root, { onPower, onClickSound }) {
  root.innerHTML = `
    <div class="menubar">
      <b>◐ DummyOS</b><span>File</span><span class="opt">Edit</span><span class="opt">Special</span>
      <div class="spacer"></div>
      <span class="clock"></span>
      <button class="power" type="button" aria-label="Power off and leave">⏻ Power</button>
    </div>`;

  const clock = root.querySelector('.clock');
  const tickClock = () => (clock.textContent = clockText());
  tickClock();
  setInterval(tickClock, 10_000);

  root.querySelector('.power').addEventListener('click', () => onPower());

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let z = 10;
  const open = new Map();

  ICON_LIST.forEach(({ id, label }, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon';
    btn.style.left = L.iconX + 'px';
    btn.style.top = L.iconY + i * L.iconStep + 'px';
    btn.innerHTML = `<img src="${iconURL(id)}" alt=""><span>${label}</span>`;
    btn.addEventListener('click', () => {
      root.querySelectorAll('.icon.selected').forEach((el) => el.classList.remove('selected'));
      btn.classList.add('selected');
      if (coarse) openWindow(id, i);
    });
    btn.addEventListener('dblclick', () => openWindow(id, i));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); openWindow(id, i); }
    });
    root.appendChild(btn);
  });

  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) root.querySelectorAll('.icon.selected').forEach((el) => el.classList.remove('selected'));
  });

  function openWindow(id, i) {
    onClickSound?.();
    if (open.has(id)) return focus(open.get(id));
    const c = CONTENT[id];
    const win = document.createElement('section');
    win.className = 'win';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', c.title);
    const w = Math.min(c.width, window.innerWidth - 24);
    win.style.width = w + 'px';
    const left = coarse ? 12 : Math.min(140 + i * 36, window.innerWidth - w - 12);
    const top = Math.min(60 + i * 30, window.innerHeight - 200);
    win.style.left = Math.max(12, left) + 'px';
    win.style.top = Math.max(40, top) + 'px';
    win.innerHTML = `
      <div class="win-title"><button class="win-close" type="button" aria-label="Close"></button><b>${c.title}</b></div>
      <div class="win-body">${c.html}</div>`;
    root.appendChild(win);
    open.set(id, win);
    focus(win);

    win.addEventListener('pointerdown', () => focus(win));
    win.querySelector('.win-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeWindow(id);
    });
    makeDraggable(win, win.querySelector('.win-title'));
    win.querySelector('.win-close').focus({ preventScroll: true });
  }

  function focus(win) {
    win.style.zIndex = ++z;
  }

  function closeWindow(id) {
    const win = open.get(id);
    if (!win) return Promise.resolve();
    open.delete(id);
    onClickSound?.();
    return new Promise((res) => {
      win.classList.add('closing');
      const done = () => { win.remove(); res(); };
      win.addEventListener('animationend', done, { once: true });
      setTimeout(done, 250);
    });
  }

  function makeDraggable(win, handle) {
    let sx, sy, ox, oy;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.win-close')) return;
      handle.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      ox = win.offsetLeft; oy = win.offsetTop;
    });
    handle.addEventListener('pointermove', (e) => {
      if (!handle.hasPointerCapture(e.pointerId)) return;
      const maxX = window.innerWidth - 60, maxY = window.innerHeight - 30;
      win.style.left = Math.min(maxX, Math.max(-win.offsetWidth + 60, ox + e.clientX - sx)) + 'px';
      win.style.top = Math.min(maxY, Math.max(L.menuH, oy + e.clientY - sy)) + 'px';
    });
  }

  return {
    show() {
      root.hidden = false;
      document.body.classList.add('inside');
      requestAnimationFrame(() => root.classList.add('show'));
    },
    hide() {
      root.classList.remove('show');
      document.body.classList.remove('inside');
      return new Promise((res) => setTimeout(() => { root.hidden = true; res(); }, 230));
    },
    closeAll() {
      root.querySelectorAll('.icon.selected').forEach((el) => el.classList.remove('selected'));
      return Promise.all([...open.keys()].map(closeWindow));
    },
  };
}
