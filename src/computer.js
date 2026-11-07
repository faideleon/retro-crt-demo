import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Visible screen area, exactly 4:3. The CRT texture maps 1:1 onto it. */
export const SCREEN = { w: 0.62, h: 0.465 };

/** Procedural beige desktop PC: case, monitor, keyboard. */
export function createComputer(screenMaterial) {
  const group = new THREE.Group();

  const beige = new THREE.MeshStandardMaterial({ color: '#d9cdb0', roughness: 0.55 });
  const beigeShade = new THREE.MeshStandardMaterial({ color: '#c6b893', roughness: 0.6 });
  const keyMat = new THREE.MeshStandardMaterial({ color: '#e7ddc5', roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#272320', roughness: 0.7 });
  const bezel = new THREE.MeshStandardMaterial({ color: '#1a1917', roughness: 0.3 });
  const coral = new THREE.MeshStandardMaterial({ color: '#e8735a', roughness: 0.4 });

  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Desktop case
  add(new RoundedBoxGeometry(1.15, 0.2, 0.95, 4, 0.035), beige, 0, 0.1, 0);
  add(new RoundedBoxGeometry(0.3, 0.024, 0.02, 2, 0.008), dark, 0.3, 0.11, 0.476); // floppy slot
  add(new THREE.BoxGeometry(0.05, 0.006, 0.01), beigeShade, 0.3, 0.075, 0.478); // eject button
  for (let i = 0; i < 6; i++) {
    add(new THREE.BoxGeometry(0.008, 0.085, 0.01), dark, -0.22 + i * 0.024, 0.1, 0.474); // vents
  }
  const ledMat = new THREE.MeshStandardMaterial({ color: '#ff8a6a', emissive: '#ff5a3c', emissiveIntensity: 0 });
  add(new THREE.SphereGeometry(0.012, 16, 8), ledMat, -0.45, 0.1, 0.474);

  // Plinth + monitor
  add(new RoundedBoxGeometry(0.5, 0.04, 0.4, 2, 0.015), beigeShade, 0, 0.215, 0.02);
  const monY = 0.235 + 0.38;
  const front = 0.02 + 0.31;
  add(new RoundedBoxGeometry(0.86, 0.76, 0.62, 5, 0.06), beige, 0, monY, 0.02);
  add(new RoundedBoxGeometry(0.62, 0.56, 0.42, 4, 0.06), beigeShade, 0, monY + 0.02, -0.4);

  const screenY = monY + 0.04;
  add(new RoundedBoxGeometry(SCREEN.w + 0.07, SCREEN.h + 0.07, 0.02, 3, 0.03), bezel, 0, screenY, front);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMaterial);
  screen.position.set(0, screenY, front + 0.014);
  group.add(screen);

  add(new THREE.BoxGeometry(0.07, 0.014, 0.004), coral, -0.32, monY - 0.315, front + 0.001); // badge
  for (let i = 0; i < 2; i++) {
    const knob = add(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), beigeShade, 0.3 + i * 0.045, monY - 0.315, front + 0.004);
    knob.rotation.x = Math.PI / 2;
  }

  // Keyboard
  const kb = new THREE.Group();
  kb.position.set(0, 0, 0.98);
  kb.rotation.x = 0.05;
  group.add(kb);
  add(new RoundedBoxGeometry(1.06, 0.05, 0.36, 3, 0.02), beige, 0, 0.03, 0, kb);

  const COLS = 14, ROWS = 4, STEP = 0.066;
  const keyGeo = new RoundedBoxGeometry(0.056, 0.03, 0.056, 2, 0.01);
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, COLS * ROWS);
  const m = new THREE.Matrix4();
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      m.makeTranslation(-0.43 + c * STEP + (r % 2) * 0.012, 0.065, -0.13 + r * STEP);
      keys.setMatrixAt(n++, m);
    }
  }
  keys.castShadow = keys.receiveShadow = true;
  kb.add(keys);
  add(new RoundedBoxGeometry(0.42, 0.03, 0.056, 2, 0.01), keyMat, 0, 0.065, 0.135, kb); // spacebar

  return { group, screen, setPowerLed: (v) => (ledMat.emissiveIntensity = v * 2.5) };
}
