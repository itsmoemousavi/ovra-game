// Dev only: the Ovra app icon, sculpted in 3D. A weathered round stone tower split between the blue and red
// teams by a glowing ember crack, with team banners and a fire burning in a brazier on top, at night.
// Open /icon-art.html; window.iconPng(size) returns the icon as a PNG data URL at that size.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const S = 1024;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
gl.setPixelRatio(1);
gl.setSize(S, S, false);
gl.toneMapping = THREE.NeutralToneMapping;
gl.toneMappingExposure = 1.0;
gl.outputColorSpace = THREE.SRGBColorSpace;

let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const deg = (d: number) => (d * Math.PI) / 180;
/** Smooth value noise in 3D, for chipping stones and roughening ground. */
const hash = (x: number, y: number, z: number) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
function noise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// ---------------------------------------------------------------- sky: night, warm glow low behind the tower, team light at the edges, mountains
const sky = document.createElement('canvas'); sky.width = sky.height = 1024;
{
  const x = sky.getContext('2d')!;
  let g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#05070d'); g.addColorStop(0.55, '#141018'); g.addColorStop(0.78, '#3a1c12'); g.addColorStop(1, '#120a08');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  g = x.createRadialGradient(512, 760, 20, 512, 760, 520); g.addColorStop(0, 'rgba(255,120,50,0.35)'); g.addColorStop(1, 'rgba(255,120,50,0)');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  g = x.createLinearGradient(0, 0, 380, 0); g.addColorStop(0, 'rgba(40,90,200,0.32)'); g.addColorStop(1, 'rgba(40,90,200,0)');
  x.fillStyle = g; x.fillRect(0, 0, 380, 1024);
  g = x.createLinearGradient(1024, 0, 644, 0); g.addColorStop(0, 'rgba(200,40,30,0.32)'); g.addColorStop(1, 'rgba(200,40,30,0)');
  x.fillStyle = g; x.fillRect(644, 0, 380, 1024);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.55})`; const r = rnd() * 1.3 + 0.3; x.beginPath(); x.arc(rnd() * 1024, rnd() * 560, r, 0, 7); x.fill(); }
  // two ranges of mountains, the far one lighter
  for (const [base, amp, col] of [[700, 120, '#1a1418'], [770, 90, '#0e0b0c']] as const) {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, 1024);
    for (let px = 0; px <= 1024; px += 8) x.lineTo(px, base - amp * (0.5 * noise(px / 140, base, 0) + 0.35 * noise(px / 50, base, 3) + 0.15 * noise(px / 18, base, 7)));
    x.lineTo(1024, 1024); x.fill();
  }
}
const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = skyTex;
scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.12;
scene.fog = new THREE.Fog(0x120c0c, 22, 40);

const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
cam.position.set(2.4, 1.8, 16.6);
cam.lookAt(0, 4.6, 0);

const dir = (c: number, i: number, x: number, y: number, z: number) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); scene.add(l); return l; };
dir(0x9fb8ff, 0.9, -6, 8, 6);   // moonlight from the upper left
dir(0x5a86ff, 2.4, -9, 3, 2);  // blue rim on the left
dir(0xff4a34, 1.6, 9, 3, 2);   // red rim on the right
scene.add(new THREE.HemisphereLight(0x1d2436, 0x1a0e08, 0.5));

// ---------------------------------------------------------------- stone
function stoneBump() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d')!; const img = x.createImageData(512, 512);
  for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
    const v = 110 + 90 * (0.55 * noise(i / 24, j / 24, 1) + 0.3 * noise(i / 8, j / 8, 2) + 0.15 * noise(i / 3, j / 3, 3));
    img.data.set([v, v, v, 255], (j * 512 + i) * 4);
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const bump = stoneBump();
const BLUE = new THREE.Color(0x3d5f9e), RED = new THREE.Color(0x87483e), GREY = new THREE.Color(0x5b5650);
function stoneMat(team: THREE.Color) {
  const c = GREY.clone().lerp(team, 0.75 + rnd() * 0.25);
  c.offsetHSL((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.1);
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, bumpMap: bump, bumpScale: 3.5 });
}
/** One cut stone: a box with chipped, uneven faces. */
function stone(w: number, h: number, d: number, team: THREE.Color) {
  const g = new THREE.BoxGeometry(w, h, d, 6, 4, 3);
  const p = g.attributes.position; const k = rnd() * 100;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const edge = Math.max(Math.abs(x) / (w / 2), Math.abs(y) / (h / 2), Math.abs(z) / (d / 2));
    const n = noise(x * 6 + k, y * 6, z * 6) - 0.5;
    const s = 1 + n * 0.12 * edge - (edge > 0.98 ? 0.04 * rnd() : 0);
    p.setXYZ(i, x * s, y * (1 + n * 0.1 * edge), z * s);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, stoneMat(team));
}

// ---------------------------------------------------------------- the tower: round, tapering, stone by stone
const H = 6.2, R0 = 1.75, R1 = 1.45;
const radius = (y: number) => R0 + (R1 - R0) * (y / H);
const crackAt = (y: number) => deg(90) + 0.07 * Math.sin(y * 3.1) + 0.05 * Math.sin(y * 7.3 + 1.2); // angle of the crack, front and centre
const GAP = 0.055; // radians each side of the crack
const placeStone = (a0: number, a1: number, y: number, h: number, r: number, d: number, team: THREE.Color) => {
  const span = a1 - a0; if (span < 0.05) return;
  const a = (a0 + a1) / 2;
  const m = stone(span * r * 0.95, h * 0.9, d, team);
  m.position.set(Math.cos(a) * (r - d / 2 + (rnd() - 0.5) * 0.04), y + (rnd() - 0.5) * 0.02, Math.sin(a) * (r - d / 2 + (rnd() - 0.5) * 0.04));
  m.rotation.y = -a + Math.PI / 2 + (rnd() - 0.5) * 0.03;
  m.rotation.z = (rnd() - 0.5) * 0.025;
  scene.add(m);
};
const ringOfStones = (y: number, h: number, r: number, d: number, crackY: number | null, step = 0.62) => {
  const c = crackY === null ? deg(90) : crackAt(crackY);
  const start = c + (crackY === null ? 0 : GAP), end = c + Math.PI * 2 - (crackY === null ? 0 : GAP);
  let a = start; const offs = rnd() * 0.5;
  let first = true;
  while (a < end - 0.02) {
    const len = (step * (0.7 + rnd() * 0.6) * (first ? offs + 0.5 : 1)) / r;
    first = false;
    let b = Math.min(a + len, end);
    // keep stones from crossing the team line at the back
    const back = c + Math.PI;
    if (a < back && b > back) b = back;
    placeStone(a, b, y, h, r, d, a < back ? BLUE : RED);
    a = b;
  }
};
// plinth: two wider courses
ringOfStones(0.22, 0.44, R0 + 0.35, 0.5, 0.2, 0.8);
ringOfStones(0.62, 0.36, R0 + 0.18, 0.45, 0.6, 0.75);
let y = 0.8;
while (y < H) {
  const h = 0.3 + rnd() * 0.12;
  ringOfStones(y + h / 2, h, radius(y + h / 2), 0.38, y + h / 2);
  y += h;
}
// dark core so the crack shows only glow
const core = new THREE.Mesh(new THREE.CylinderGeometry(R1 - 0.3, R0 - 0.3, H, 32), new THREE.MeshBasicMaterial({ color: 0x0a0504 }));
core.position.y = H / 2; scene.add(core);
// corbels and the crenellated top
const TOP = H;
for (let i = 0; i < 22; i++) {
  const a = crackAt(TOP) + GAP + (i / 22) * (Math.PI * 2 - GAP * 2);
  const team = a < crackAt(TOP) + Math.PI ? BLUE : RED;
  const m = stone(0.22, 0.34, 0.45, team);
  m.position.set(Math.cos(a) * (R1 + 0.05), TOP + 0.05, Math.sin(a) * (R1 + 0.05)); m.rotation.y = -a + Math.PI / 2; scene.add(m);
}
ringOfStones(TOP + 0.38, 0.32, R1 + 0.3, 0.42, TOP, 0.7);
ringOfStones(TOP + 0.7, 0.3, R1 + 0.3, 0.42, TOP, 0.7);
for (let i = 0; i < 12; i++) {
  if (i % 2) continue; // gaps between merlons
  const a0 = crackAt(TOP) + GAP + (i / 12) * (Math.PI * 2 - GAP * 2), a1 = a0 + (Math.PI * 2 - GAP * 2) / 12;
  placeStone(a0, a1, TOP + 1.07, 0.48, R1 + 0.3, 0.4, a0 < crackAt(TOP) + Math.PI ? BLUE : RED);
}
// arrow slits
for (const [a, yy] of [[deg(118), 3.4], [deg(62), 3.4], [deg(132), 1.9], [deg(48), 1.9]]) {
  const r = radius(yy) + 0.01;
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.55), new THREE.MeshBasicMaterial({ color: 0x040202 }));
  s.position.set(Math.cos(a) * r, yy, Math.sin(a) * r); s.rotation.y = -a + Math.PI / 2; scene.add(s);
}

// ---------------------------------------------------------------- the ember crack: molten light in the seam, spilling onto the stones
const seamPts: THREE.Vector3[] = [];
for (let i = 0; i <= 60; i++) { const yy = 0.05 + (i / 60) * (H + 1.2); const a = crackAt(Math.min(yy, H)); const r = radius(Math.min(yy, H)) - 0.22; seamPts.push(new THREE.Vector3(Math.cos(a) * r, yy, Math.sin(a) * r)); }
const seamCurve = new THREE.CatmullRomCurve3(seamPts);
scene.add(new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 240, 0.06, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2, 0.4) })));
scene.add(new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 240, 0.11, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.3, 0.05), transparent: true, opacity: 0.35 })));
for (let i = 0; i < 7; i++) {
  const t = (i + 0.5) / 7; const p = seamCurve.getPointAt(t);
  const l = new THREE.PointLight(0xff6a22, 0.7, 1.2, 2); l.position.set(p.x * 1.18, p.y, p.z * 1.18); scene.add(l);
}

// ---------------------------------------------------------------- banners: blue on the left, red on the right, hanging from the parapet
function bannerTex(team: string) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 320;
  const x = c.getContext('2d')!;
  x.fillStyle = team; x.fillRect(0, 0, 128, 320);
  const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 320);
  x.strokeStyle = '#c9a052'; x.lineWidth = 6; x.strokeRect(9, 9, 110, 290);
  // a simple tower sigil in gold
  x.fillStyle = '#d6b163';
  x.fillRect(46, 120, 36, 70); x.fillRect(40, 108, 12, 14); x.fillRect(58, 108, 12, 14); x.fillRect(76, 108, 12, 14);
  x.beginPath(); x.moveTo(64, 70); x.quadraticCurveTo(80, 92, 64, 104); x.quadraticCurveTo(48, 92, 64, 70); x.fill();
  // cut tails
  x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.moveTo(0, 320); x.lineTo(64, 270); x.lineTo(128, 320); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
for (const [a, col] of [[deg(128), '#1d3c86'], [deg(52), '#8a1d18']] as const) {
  const g = new THREE.PlaneGeometry(0.9, 2.3, 8, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const yy = p.getY(i), xx = p.getX(i); p.setZ(i, Math.sin(yy * 2.4 + xx * 1.5) * 0.06 + (1.15 - yy) * 0.02); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: bannerTex(col), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }));
  const r = radius(H - 1.3) + 0.06;
  m.position.set(Math.cos(a) * r, H - 1.25, Math.sin(a) * r); m.rotation.y = -a + Math.PI / 2; scene.add(m);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 8), new THREE.MeshStandardMaterial({ color: 0x8a6428, metalness: 1, roughness: 0.35 }));
  rod.position.set(Math.cos(a) * (r + 0.02), H - 0.08, Math.sin(a) * (r + 0.02)); rod.rotation.y = -a + Math.PI / 2; rod.rotateZ(Math.PI / 2); scene.add(rod);
}

// ---------------------------------------------------------------- brazier and fire on top
const ironMat = new THREE.MeshStandardMaterial({ color: 0x241e1a, metalness: 0.85, roughness: 0.5, bumpMap: bump, bumpScale: 1 });
const bowl = new THREE.LatheGeometry([[0, 0], [0.5, 0.05], [0.75, 0.3], [0.82, 0.48], [0.76, 0.5], [0.66, 0.34], [0, 0.3]].map(([a, b]) => new THREE.Vector2(a, b)), 32);
const by = TOP + 1.0;
const bw = new THREE.Mesh(bowl, ironMat); bw.position.set(0, by, 0); scene.add(bw);
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.9, 12), ironMat); stem.position.set(0, by - 0.42, 0); scene.add(stem);
// flames: soft additive tongues with a hot core, drawn from one flame-shaped texture
const ft = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 190, 4, 64, 170, 120);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(64, 0); x.bezierCurveTo(118, 120, 118, 210, 64, 250); x.bezierCurveTo(10, 210, 10, 120, 64, 0); x.fill();
  return new THREE.CanvasTexture(c);
})();
const flame = (w: number, h: number, c: THREE.Color, x: number, z: number, tilt: number, yo = 0) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ft, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.set(x, by + 0.35 + h * 0.42 + yo, z); m.lookAt(cam.position.x, m.position.y, cam.position.z); m.rotateZ(tilt); scene.add(m);
};
for (let i = 0; i < 9; i++) flame(0.85 + rnd() * 0.6, 1.75 + rnd() * 1.3, new THREE.Color(1.8, 0.45, 0.08), (rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.45);
for (let i = 0; i < 5; i++) flame(0.6 + rnd() * 0.35, 1.25 + rnd() * 0.7, new THREE.Color(3, 1.3, 0.3), (rnd() - 0.5) * 0.4, 0.2, (rnd() - 0.5) * 0.3);
flame(0.55, 1.0, new THREE.Color(4, 3, 1.4), 0, 0.3, 0, -0.05);
const fire = new THREE.PointLight(0xff8a3a, 7, 6, 2); fire.position.set(0, by + 1.1, 0.6); scene.add(fire);
// sparks rising
for (let i = 0; i < 40; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.018 + rnd() * 0.02, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6 + rnd(), 0.4) }));
  const t = rnd(); s.position.set((rnd() - 0.5) * (0.6 + t * 2.4), by + 1 + t * 3.2, (rnd() - 0.2) * 1.2); scene.add(s);
}

// ---------------------------------------------------------------- ground: a rough hill with rocks
const gg = new THREE.PlaneGeometry(40, 30, 160, 120); gg.rotateX(-Math.PI / 2);
{
  const p = gg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
    p.setY(i, -0.05 + 0.5 * Math.exp(-d * d / 30) - d * 0.05 + 0.35 * (noise(x * 0.8, 0, z * 0.8) - 0.5) + 0.1 * (noise(x * 3, 1, z * 3) - 0.5));
  }
  gg.computeVertexNormals();
}
scene.add(new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: 0x2a2219, roughness: 1, bumpMap: bump, bumpScale: 4 })));
for (let i = 0; i < 26; i++) {
  const a = rnd() * Math.PI * 2, d = 2.2 + rnd() * 5;
  const r = stone(0.2 + rnd() * 0.5, 0.15 + rnd() * 0.3, 0.2 + rnd() * 0.5, GREY);
  r.position.set(Math.cos(a) * d, 0.1 + 0.4 * Math.exp(-d * d / 30) - d * 0.05, Math.sin(a) * d * 0.7 + 0.8); r.rotation.set(rnd(), rnd() * 3, rnd()); scene.add(r);
}

const comp = new EffectComposer(gl);
comp.setPixelRatio(1); comp.setSize(S, S);
comp.addPass(new RenderPass(scene, cam));
comp.addPass(new UnrealBloomPass(new THREE.Vector2(S, S), 0.5, 0.3, 1.6));
comp.addPass(new OutputPass());
comp.render();

(window as any).iconPng = (size: number) => {
  let src: HTMLCanvasElement = canvas, cur = S;
  while (cur / 2 >= size) {
    const c = document.createElement('canvas'); c.width = c.height = cur / 2;
    const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, cur / 2, cur / 2);
    src = c; cur /= 2;
  }
  const out = document.createElement('canvas'); out.width = out.height = size;
  const x = out.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, size, size);
  return out.toDataURL('image/png');
};
(window as any).iconReady = true;
