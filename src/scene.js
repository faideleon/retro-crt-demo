import * as THREE from 'three';

const NIGHT = '#0b0d16';
export const LAMP_INTENSITY = 24;

/** Renderer, camera, desk, lamp, moonlight window and dust motes. */
export function createScene(container, { reduced }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.Fog(NIGHT, 4.5, 10);

  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 30);

  // Desk surface: warm dark wood that disappears into the fog.
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.82 })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);

  // Base fill so the room is never pure black.
  const hemi = new THREE.HemisphereLight('#3a3a5c', '#1a120c', 0.0);
  scene.add(hemi);

  // Cool moonlight rim from behind, plus a faint window shape far back.
  const moon = new THREE.DirectionalLight('#7f99ff', 0.55);
  moon.position.set(2.2, 3, -3.2);
  scene.add(moon);

  const win = new THREE.Group();
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.1),
    new THREE.MeshBasicMaterial({ color: '#22336b', fog: true })
  );
  win.add(pane);
  const barMat = new THREE.MeshBasicMaterial({ color: '#0e1222' });
  const vBar = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 2.1), barMat);
  const hBar = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.06), barMat);
  vBar.position.z = hBar.position.z = 0.01;
  win.add(vBar, hBar);
  win.position.set(2.4, 1.7, -4.2);
  win.rotation.y = -0.35;
  scene.add(win);

  // Desk lamp: base, two arm segments, shade, bulb.
  const lampGroup = new THREE.Group();
  const lampMat = new THREE.MeshStandardMaterial({ color: '#2f4a46', roughness: 0.45, metalness: 0.3 });
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    lampGroup.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 32), lampMat, 0, 0.025, 0);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 12), lampMat, 0.08, 0.44, 0, 0, -0.2);
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 12), lampMat, 0.35, 0.98, 0, 0, -1.25);
  const shade = add(new THREE.ConeGeometry(0.17, 0.24, 32, 1, true), lampMat, 0.62, 1.0, 0, 0, 0.75);
  shade.material = lampMat.clone();
  shade.material.side = THREE.DoubleSide;
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff1d6', emissive: '#ffcf8a', emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), bulbMat);
  bulb.position.set(0.66, 0.96, 0);
  lampGroup.add(bulb);
  lampGroup.position.set(-1.55, 0, 0.35);
  lampGroup.rotation.y = -0.15;
  scene.add(lampGroup);

  // Warm lamp light (the key light).
  const lamp = new THREE.SpotLight('#ffb36b', 0, 0, 0.75, 0.75, 1.6);
  lampGroup.updateMatrixWorld(true);
  lamp.position.copy(bulb.getWorldPosition(new THREE.Vector3()));
  lamp.target.position.set(0.15, 0.45, 0.35);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0004;
  lamp.shadow.normalBias = 0.02;
  lamp.shadow.radius = 4;
  scene.add(lamp, lamp.target);

  // Cool spill from the CRT onto the keyboard and desk.
  const glow = new THREE.PointLight('#c4e6dc', 0, 2.6, 2);
  scene.add(glow);

  // Dust motes drifting through the lamp beam.
  const DUST = reduced ? 0 : 160;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST * 4);
  for (let i = 0; i < DUST; i++) {
    dustSeed[i * 4] = THREE.MathUtils.randFloat(-1.15, 0.35);
    dustSeed[i * 4 + 1] = THREE.MathUtils.randFloat(0.15, 1.35);
    dustSeed[i * 4 + 2] = THREE.MathUtils.randFloat(-0.3, 0.9);
    dustSeed[i * 4 + 3] = Math.random() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 0.014,
    map: makeDotTexture(),
    color: '#ffd9a6',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  function updateDust(time) {
    for (let i = 0; i < DUST; i++) {
      const s = dustSeed[i * 4 + 3];
      dustPos[i * 3] = dustSeed[i * 4] + Math.sin(time * 0.13 + s) * 0.08;
      dustPos[i * 3 + 1] = dustSeed[i * 4 + 1] + Math.sin(time * 0.09 + s * 1.7) * 0.1;
      dustPos[i * 3 + 2] = dustSeed[i * 4 + 2] + Math.cos(time * 0.11 + s * 0.6) * 0.08;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  /** level: lamp brightness 0..1 */
  function setLamp(level) {
    lamp.intensity = level * LAMP_INTENSITY;
    bulbMat.emissiveIntensity = level * 4;
    hemi.intensity = 0.06 + level * 0.22;
    dustMat.opacity = level * 0.55;
  }
  setLamp(0);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return { renderer, scene, camera, glow, setLamp, updateDust, resize };
}

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
