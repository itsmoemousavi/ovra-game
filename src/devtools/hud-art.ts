// Dev only: sculpts the HUD frame pieces in 3D and renders them to transparent images.
// Open /hud-art.html?v=<piece>; window.hudArt() returns the PNG as a data URL.
// Units are CSS pixels; each piece is centred on (0, 0). Style: dark iron, polished gold, gold laurel, rubies.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SCALE = 3; // iPhone pixel ratio
const V = new URLSearchParams(location.search).get('v') ?? 'medallion';

/** Each piece: its size in CSS px and how to build it. */
const PIECES: Record<string, { w: number; h: number; build: () => void }> = {
  medallion: { w: 104, h: 104, build: medallion },
  ring: { w: 100, h: 100, build: ring },
  clock: { w: 54, h: 54, build: clock },
  panel: { w: 120, h: 72, build: () => plate(120, 72, 5, 5, true) },
  plate: { w: 60, h: 36, build: () => plate(60, 36, 2.5, 3, false) },
  slot: { w: 40, h: 40, build: slot },
  mmframe: { w: 150, h: 150, build: mmframe },
};
const piece = PIECES[V];

const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.style.width = `${piece.w * 3}px`;
canvas.style.height = `${piece.h * 3}px`;
const gl = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
gl.setPixelRatio(SCALE);
gl.setSize(piece.w, piece.h, false);
gl.toneMapping = THREE.ACESFilmicToneMapping;
gl.toneMappingExposure = 1.05;
gl.outputColorSpace = THREE.SRGBColorSpace;
gl.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;
const cam = new THREE.OrthographicCamera(-piece.w / 2, piece.w / 2, piece.h / 2, -piece.h / 2, -500, 500);
cam.position.set(0, 0, 200);
const light = (c: number, i: number, x: number, y: number, z: number) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); scene.add(l); };
light(0xffe2b8, 3.0, -80, 120, 140); // warm key from the upper left
light(0x8fa8ff, 0.6, 120, -40, 80);  // cool fill
light(0xff9a50, 1.2, 60, 90, -120);  // rim
light(0xfff0d0, 1.3, -30, 40, 200);  // front, so flat gold faces still shine

function noiseTex(scale: number) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const img = x.createImageData(256, 256);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 256 * 256; i++) { const v = 150 + rnd() * 80; img.data.set([v, v, v, 255], i * 4); }
  x.putImageData(img, 0, 0);
  for (let k = 0; k < 90; k++) { x.strokeStyle = `rgba(40,40,40,${0.15 + rnd() * 0.3})`; x.lineWidth = 0.6 + rnd(); x.beginPath(); const a = rnd() * 256, b = rnd() * 256; x.moveTo(a, b); x.lineTo(a + (rnd() - 0.5) * 40, b + (rnd() - 0.5) * 40); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(scale, scale); return t;
}
const wear = noiseTex(0.05);
const gold = new THREE.MeshStandardMaterial({ color: 0xc8963e, metalness: 1, roughness: 0.3, bumpMap: wear, bumpScale: 0.5, roughnessMap: wear });
const bright = new THREE.MeshStandardMaterial({ color: 0xe0b35a, metalness: 1, roughness: 0.22, bumpMap: wear, bumpScale: 0.3 });
const satin = new THREE.MeshStandardMaterial({ color: 0xd3a24c, metalness: 0.9, roughness: 0.42, bumpMap: wear, bumpScale: 0.4 });
const iron = new THREE.MeshStandardMaterial({ color: 0x24211e, metalness: 0.75, roughness: 0.58, bumpMap: wear, bumpScale: 1.2, roughnessMap: wear, side: THREE.DoubleSide });
const ironFace = new THREE.MeshStandardMaterial({ color: 0x1b1916, metalness: 0.6, roughness: 0.7, bumpMap: noiseTex(0.08), bumpScale: 1.6 });
const ruby = new THREE.MeshStandardMaterial({ color: 0xc0182a, emissive: 0xc0182a, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.08, flatShading: true });

const add = (g: THREE.BufferGeometry, m: THREE.Material, f?: (o: THREE.Mesh) => void) => { const o = new THREE.Mesh(g, m); f?.(o); scene.add(o); return o; };
const deg = (d: number) => (d * Math.PI) / 180;

function jewel(r: number, x: number, y: number, z = 5) {
  const g = new THREE.LatheGeometry([[0, -r * 0.5], [r, 0], [r * 0.62, r * 0.42], [0, r * 0.46]].map(([a, b]) => new THREE.Vector2(a, b)), 10);
  add(g, ruby, (o) => { o.rotation.x = Math.PI / 2; o.position.set(x, y, z); });
  add(new THREE.TorusGeometry(r + 0.4, Math.max(0.4, r * 0.16), 8, 30), gold, (o) => o.position.set(x, y, z - 0.4));
}
/** Leaf: a bevelled blade from (0,0) along +y, curled so light rolls across it, with a raised midrib. */
function leaf(len: number, wid: number, m: THREE.Material, x: number, y: number, ang: number, z = 0, tilt = 0) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(wid, len * 0.42, 0, len); s.quadraticCurveTo(-wid * 0.8, len * 0.42, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.6, bevelSize: Math.min(0.6, wid * 0.2), bevelSegments: 3, curveSegments: 14 });
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { const px = pa.getX(i), py = pa.getY(i); pa.setZ(i, pa.getZ(i) - (px * px) / (wid * 1.6) + Math.sin((py / len) * Math.PI) * 0.8); }
  g.computeVertexNormals();
  add(g, m, (o) => { o.position.set(x, y, z); o.rotation.set(tilt, 0, ang); });
  add(new THREE.CylinderGeometry(0.12, 0.3, len * 0.7, 6), bright, (o) => {
    o.position.set(x - Math.sin(ang) * len * 0.45, y + Math.cos(ang) * len * 0.45, z + 1.4);
    o.rotation.set(0, 0, ang);
  });
}
/** Round bezel: gold inner rim, iron band, gold outer rim. */
function bezel(r0: number, r1: number) {
  const mid = (r0 + r1) / 2, t = r1 - r0;
  add(new THREE.LatheGeometry([[r0 + t * 0.15, -1], [r0 + t * 0.3, 1.4], [mid, 2.2], [r1 - t * 0.3, 1.4], [r1 - t * 0.15, -1]].map(([r, z]) => new THREE.Vector2(r, z)), 96), iron, (o) => (o.rotation.x = Math.PI / 2));
  add(new THREE.TorusGeometry(r0 + t * 0.12, t * 0.13, 14, 128), bright, (o) => (o.position.z = 1.4));
  add(new THREE.TorusGeometry(r1 - t * 0.12, t * 0.15, 14, 128), gold, (o) => (o.position.z = 1.2));
}

// ---------------------------------------------------------------- pieces
/** Portrait medallion: face inside r 30.5; bezel 30.5-37; laurel on both sides from low left/right up to the shoulders. */
function medallion() {
  bezel(30.5, 37);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const a = deg(-44 + i * 12.8);                    // about -44 to 58 degrees
      const x = Math.cos(a) * 37.8 * side, y = Math.sin(a) * 37.8;
      const along = side > 0 ? a : Math.PI - a;
      const up = along + (side > 0 ? Math.PI / 2 : -Math.PI / 2) - Math.PI / 2;
      const len = 7.6 - i * 0.18;
      leaf(len, 3.2, i % 2 ? satin : gold, x, y, up + side * deg(-26), 1 + (i % 2) * 0.5);
      leaf(len * 0.88, 3, i % 2 ? gold : satin, x, y, up + side * deg(36), 0.4);
      if (i % 3 === 1) add(new THREE.SphereGeometry(1, 14, 10), ruby, (o) => o.position.set(x * 1.02, y * 1.02, 3));
    }
  }
}
/** Rim for any round button, drawn inside its edge (outer radius = half the image). */
function ring() {
  bezel(44.5, 50);
}
/** Clock disc: iron face, gold bezel, a small ruby at the bottom. */
function clock() {
  add(new THREE.CircleGeometry(23, 64), ironFace);
  bezel(22.5, 27);
  jewel(2.2, 0, -24.8, 4);
}
/** Plate for 9-slice stretching: iron face, bevelled gold rim of width `rim`, ruby studs in the corners. */
function plate(w: number, h: number, rim: number, corner: number, studs: boolean) {
  const rr = (s: THREE.Shape | THREE.Path, hw: number, hh: number, r: number) => {
    s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r); s.lineTo(hw, hh - r);
    s.quadraticCurveTo(hw, hh, hw - r, hh); s.lineTo(-hw + r, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - r); s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  };
  const hw = w / 2 - 0.6, hh = h / 2 - 0.6;
  add(new THREE.PlaneGeometry(w - rim, h - rim), ironFace, (o) => (o.position.z = -1));
  const frame = new THREE.Shape(); rr(frame, hw - rim * 0.25, hh - rim * 0.25, corner);
  const hole = new THREE.Path(); rr(hole, hw - rim + rim * 0.25, hh - rim + rim * 0.25, Math.max(0.5, corner - rim * 0.6)); frame.holes.push(hole);
  add(new THREE.ExtrudeGeometry(frame, { depth: 0.4, bevelEnabled: true, bevelThickness: rim * 0.35, bevelSize: rim * 0.25, bevelSegments: 4, curveSegments: 12 }), gold);
  // a thin dark groove just inside the rim gives the face depth
  const groove = new THREE.Shape(); rr(groove, hw - rim - 0.2, hh - rim - 0.2, Math.max(0.5, corner - rim)); const gh = new THREE.Path(); rr(gh, hw - rim - 1.2, hh - rim - 1.2, Math.max(0.5, corner - rim - 1)); groove.holes.push(gh);
  add(new THREE.ShapeGeometry(groove, 12), new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.7 }), (o) => (o.position.z = -0.5));
  if (studs) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) jewel(rim * 0.42, sx * (hw - rim / 2), sy * (hh - rim / 2), rim * 0.6);
}
/** Item slot: a recessed iron socket with a thin dark-gold lip. */
function slot() {
  add(new THREE.PlaneGeometry(38, 38), ironFace, (o) => (o.position.z = -2));
  const s = new THREE.Shape(); s.moveTo(-19.4, -19.4); s.lineTo(19.4, -19.4); s.lineTo(19.4, 19.4); s.lineTo(-19.4, 19.4); s.closePath();
  const h = new THREE.Path(); h.moveTo(-17.6, -17.6); h.lineTo(17.6, -17.6); h.lineTo(17.6, 17.6); h.lineTo(-17.6, 17.6); h.closePath(); s.holes.push(h);
  add(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.35, bevelSegments: 3 }), satin);
  // inner shadow along the top and left edges: the socket is sunk into the panel
  add(new THREE.PlaneGeometry(35, 3), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }), (o) => o.position.set(0, 16, -1));
  add(new THREE.PlaneGeometry(3, 35), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }), (o) => o.position.set(-16, 0, -1));
}
/** Minimap frame: hollow, 6 px gold-and-iron border, laurel sprigs and a ruby at the bottom corners. */
function mmframe() {
  const s = new THREE.Shape(); const o = 74.4, i = 68.6;
  s.moveTo(-o, -o); s.lineTo(o, -o); s.lineTo(o, o); s.lineTo(-o, o); s.closePath();
  const h = new THREE.Path(); h.moveTo(-i, -i); h.lineTo(i, -i); h.lineTo(i, i); h.lineTo(-i, i); h.closePath(); s.holes.push(h);
  add(new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 0.9, bevelSegments: 4 }), iron);
  for (const r of [73.6, 69.4]) {
    const g = new THREE.Shape(); g.moveTo(-r, -r); g.lineTo(r, -r); g.lineTo(r, r); g.lineTo(-r, r); g.closePath();
    const gh = new THREE.Path(); const q = r - 0.9; gh.moveTo(-q, -q); gh.lineTo(q, -q); gh.lineTo(q, q); gh.lineTo(-q, q); gh.closePath(); g.holes.push(gh);
    add(new THREE.ExtrudeGeometry(g, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.45, bevelSegments: 3 }), r > 70 ? gold : bright, (m) => (m.position.z = 1.4));
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) jewel(2.4, sx * 71.5, sy * 71.5, 3.4);
}

piece.build();
gl.render(scene, cam);
(window as any).hudArt = () => canvas.toDataURL('image/png');
(window as any).hudReady = true;
