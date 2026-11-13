// 무기 모델: 외부 모델·이미지 없이 코드로 만든 오리지널 디자인(실존 총기·브랜드 복제 아님).
// 좌표: u = 총구 방향(앞), v = 위. 측면 윤곽(2D)을 두께만큼 밀어(Extrude) 모서리를 둥글게 깎는다.
import * as THREE from 'three';

function rshape(pts, r, S = THREE.Shape) {
  const s = new S();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const d0x = p0[0] - p1[0], d0y = p0[1] - p1[1], d2x = p2[0] - p1[0], d2y = p2[1] - p1[1];
    const l0 = Math.hypot(d0x, d0y), l2 = Math.hypot(d2x, d2y);
    const k0 = Math.min(r, l0 / 2.2) / l0, k2 = Math.min(r, l2 / 2.2) / l2;
    const ax = p1[0] + d0x * k0, ay = p1[1] + d0y * k0, bx = p1[0] + d2x * k2, by = p1[1] + d2y * k2;
    if (i === 0) s.moveTo(ax, ay); else s.lineTo(ax, ay);
    s.quadraticCurveTo(p1[0], p1[1], bx, by);
  }
  s.closePath();
  return s;
}

function noiseTex(seed, base, amp) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d'), d = x.createImageData(128, 128);
  let h = seed;
  for (let i = 0; i < d.data.length; i += 4) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const v = base + ((h >> 8) % 255) / 255 * amp;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

export function materials() {
  const rough = noiseTex(7, 150, 70);
  const rough2 = noiseTex(11, 120, 110);
  const M = {
    metal: new THREE.MeshStandardMaterial({ color: 0x2b2f37, metalness: 0.85, roughness: 0.34, roughnessMap: rough }),
    metal2: new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.75, roughness: 0.42, roughnessMap: rough }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6d7380, metalness: 1, roughness: 0.22 }),
    poly: new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.05, roughness: 0.62, roughnessMap: rough2 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: 0, roughness: 0.92 }),
    purple: new THREE.MeshStandardMaterial({ color: 0x2c2346, metalness: 0.25, roughness: 0.48, roughnessMap: rough2 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x9a7432, metalness: 1, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.3, roughness: 0.7 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x22e5ff, emissiveIntensity: 2.6 }),
    pink: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2e88, emissiveIntensity: 2.6 }),
    red: new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xc8bfff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.1, clearcoat: 1, iridescence: 1, side: THREE.DoubleSide, depthWrite: false }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x2a1866, metalness: 0.6, roughness: 0.04, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6 }),
  };
  return M;
}

class Kit {
  constructor(root) { this.root = root; }
  add(geo, mat, parent = this.root) { const m = new THREE.Mesh(geo, mat); m.castShadow = false; parent.add(m); return m; }
  ext(pts, depth, mat, { r = 0.006, bevel = 0.0025, holes = [], x = 0, parent } = {}) {
    const s = rshape(pts, r);
    for (const h of holes) s.holes.push(rshape(h, r * 0.8, THREE.Path));
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 5 });
    g.translate(0, 0, -(depth - bevel * 2) / 2);
    g.rotateY(Math.PI / 2);
    g.translate(x, 0, 0);
    return this.add(g, mat, parent);
  }
  // 총열 방향 원통: rBack(뒤) rFront(앞), u0~u0+len
  cyl(rBack, rFront, u0, len, v, mat, { seg = 20, x = 0, flat = false, open = false, parent } = {}) {
    const g = new THREE.CylinderGeometry(rBack, rFront, len, seg, 1, open);
    g.rotateX(Math.PI / 2);
    const m = this.add(g, flat ? Object.assign(mat.clone(), { flatShading: true }) : mat, parent);
    m.position.set(x, v, -(u0 + len / 2));
    return m;
  }
  box(w, h, u0, len, v, mat, { x = 0, parent } = {}) {
    const m = this.add(new THREE.BoxGeometry(w, h, len), mat, parent);
    m.position.set(x, v, -(u0 + len / 2));
    return m;
  }
  rail(u0, u1, v, w, mat) {
    this.box(w * 0.8, 0.008, u0, u1 - u0, v, mat);
    const n = Math.floor((u1 - u0) / 0.016);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w, 0.006, 0.007), mat, n);
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) { o.position.set(0, v + 0.006, -(u0 + 0.008 + i * 0.016)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    this.root.add(im);
  }
}

function flashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.18, 'rgba(255,220,120,0.95)'); g.addColorStop(0.45, 'rgba(255,120,40,0.35)'); g.addColorStop(1, 'rgba(255,60,0,0)');
  x.fillStyle = g;
  x.translate(64, 64);
  for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(-7, 0); x.lineTo(0, -62); x.lineTo(7, 0); x.fill(); }
  x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeFlash(muzzle, scale) {
  const tex = flashTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.16 * scale, 0.16 * scale), mat);
  g.add(front);
  for (let i = 0; i < 2; i++) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.1 * scale, 0.26 * scale), mat);
    side.rotation.set(Math.PI / 2, i * Math.PI / 2, 0);
    side.position.z = -0.1 * scale;
    g.add(side);
  }
  g.visible = false;
  muzzle.add(g);
  return g;
}

// 돌격소총 "RK-5 번개"
export function buildRifle(M) {
  const root = new THREE.Group();
  const k = new Kit(root);
  // 위 리시버
  k.ext([[-0.02, 0], [0.30, 0], [0.30, 0.056], [0.275, 0.068], [0.02, 0.068], [-0.02, 0.06]], 0.052, M.metal, { r: 0.006 });
  // 아래 리시버 + 탄창 삽입구
  k.ext([[-0.02, 0.002], [0.225, 0.002], [0.225, -0.018], [0.2, -0.05], [0.115, -0.05], [0.1, -0.03], [0.02, -0.03], [-0.02, -0.012]], 0.047, M.metal2, { r: 0.005 });
  // 탄창(휘어진 모양)
  k.ext([[0.122, -0.045], [0.188, -0.045], [0.205, -0.12], [0.232, -0.205], [0.168, -0.222], [0.142, -0.13]], 0.03, M.poly, { r: 0.006 });
  k.ext([[0.164, -0.218], [0.236, -0.2], [0.24, -0.212], [0.168, -0.232]], 0.036, M.metal2, { r: 0.003 });
  const magStrip = k.ext([[0.15, -0.075], [0.16, -0.075], [0.178, -0.165], [0.168, -0.167]], 0.032, M.cyan, { r: 0.002, bevel: 0.001 });
  // 손잡이
  k.ext([[0.03, -0.03], [0.092, -0.03], [0.074, -0.07], [0.05, -0.168], [-0.004, -0.17], [0.008, -0.07]], 0.034, M.poly, { r: 0.012 });
  // 방아쇠 + 울
  k.ext([[0.104, -0.03], [0.114, -0.03], [0.11, -0.056], [0.122, -0.068], [0.112, -0.071], [0.1, -0.058]], 0.008, M.steel, { r: 0.003, bevel: 0.001 });
  k.ext([[0.09, -0.072], [0.17, -0.072], [0.17, -0.05], [0.178, -0.05], [0.178, -0.08], [0.088, -0.081]], 0.012, M.metal2, { r: 0.003, bevel: 0.001 });
  // 핸드가드(측면 구멍으로 총열이 보임)
  const slots = [];
  for (let u = 0.34; u < 0.6; u += 0.052) slots.push([[u, 0.016], [u + 0.034, 0.016], [u + 0.034, 0.038], [u, 0.038]]);
  k.ext([[0.296, -0.01], [0.665, -0.01], [0.665, 0.07], [0.296, 0.07]], 0.064, M.metal2, { r: 0.012, holes: slots });
  k.box(0.0665, 0.004, 0.32, 0.33, 0.004, M.cyan);
  k.box(0.0665, 0.003, 0.32, 0.33, 0.056, M.pink);
  // 상단 레일
  k.rail(-0.02, 0.66, 0.072, 0.026, M.metal2);
  // 총열 · 가스블록 · 소염기
  k.cyl(0.012, 0.011, 0.3, 0.52, 0.03, M.metal);
  k.box(0.03, 0.03, 0.67, 0.03, 0.035, M.metal2);
  k.cyl(0.019, 0.019, 0.8, 0.065, 0.03, M.metal2, { seg: 8, flat: true });
  for (let i = 0; i < 3; i++) k.box(0.04, 0.006, 0.81 + i * 0.018, 0.006, 0.047, M.dark);
  k.cyl(0.021, 0.021, 0.79, 0.008, 0.03, M.cyan);
  // 개머리판(골격형)
  k.cyl(0.016, 0.016, -0.24, 0.23, 0.032, M.metal);
  k.ext([[-0.385, -0.085], [-0.345, -0.085], [-0.13, 0.0], [-0.1, 0.0], [-0.1, 0.064], [-0.385, 0.074]], 0.04, M.poly,
    { r: 0.012, holes: [[[-0.33, -0.05], [-0.17, 0.012], [-0.33, 0.035]]] });
  k.box(0.046, 0.17, -0.405, 0.024, -0.005, M.rubber);
  k.box(0.0405, 0.004, -0.37, 0.25, 0.066, M.pink);
  // 장전손잡이 · 배출구 · 전진기
  k.box(0.07, 0.012, -0.035, 0.03, 0.062, M.metal2);
  k.box(0.004, 0.026, 0.07, 0.09, 0.03, M.dark, { x: 0.027 });
  k.box(0.003, 0.028, 0.07, 0.07, 0.03, M.steel, { x: 0.0285 });
  // 수직 손잡이
  const fg = k.add(new THREE.CylinderGeometry(0.015, 0.017, 0.085, 16), M.poly);
  fg.position.set(0, -0.05, -0.53);
  const fgRing = k.add(new THREE.CylinderGeometry(0.0175, 0.0175, 0.006, 16), M.cyan);
  fgRing.position.set(0, -0.08, -0.53);
  // 도트사이트
  k.box(0.03, 0.016, 0.1, 0.06, 0.084, M.metal2);
  k.cyl(0.021, 0.021, 0.1, 0.058, 0.114, Object.assign(M.metal.clone(), { side: THREE.DoubleSide }), { open: true, seg: 28 });
  k.cyl(0.024, 0.024, 0.152, 0.008, 0.114, M.metal2, { open: true, seg: 28 });
  k.cyl(0.024, 0.024, 0.098, 0.006, 0.114, M.metal2, { open: true, seg: 28 });
  const lens = k.add(new THREE.CircleGeometry(0.02, 28), M.glass);
  lens.position.set(0, 0.114, -0.155);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 10, 10), M.red);
  dot.position.set(0, 0.114, -0.15);
  root.add(dot);
  k.box(0.012, 0.012, 0.12, 0.02, 0.139, M.metal2);

  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, -0.875); root.add(muzzle);
  const eject = new THREE.Object3D(); eject.position.set(0.03, 0.03, -0.11); root.add(eject);
  return {
    id: 'rifle', name: 'RK-5 번개', kind: '돌격소총', root, muzzle, eject, flash: makeFlash(muzzle, 1),
    sight: { v: 0.114, u: 0.1 }, center: 0.24, length: 1.3, accent: '#22e5ff',
    hip: new THREE.Vector3(0.16, -0.18, -0.4), ads: new THREE.Vector3(0, -0.114, -0.2 + 0.1),
    stats: { 위력: 3, 연사: 5, 정확도: 3, 장탄: 5 },
    mag: 30, rate: 0.092, reloadTime: 1.7, auto: true, damage: 1, adsFov: 46,
    spreadHip: 0.014, spreadAds: 0.0022, bloomAdd: 0.0035, bloomMax: 0.028, kick: 0.0075, magMesh: magStrip,
  };
}

// 저격소총 "SR-1 매눈"
export function buildSniper(M) {
  const root = new THREE.Group();
  const k = new Kit(root);
  // 섀시 + 개머리판(엄지 구멍)
  const vents = [];
  for (let u = 0.06; u < 0.3; u += 0.05) vents.push([[u, -0.03], [u + 0.034, -0.03], [u + 0.034, -0.016], [u, -0.016]]);
  k.ext([[-0.64, -0.115], [-0.22, -0.098], [-0.15, -0.195], [-0.09, -0.195], [-0.058, -0.04], [0.33, -0.04], [0.355, -0.018], [0.355, 0.012],
    [-0.04, 0.012], [-0.11, 0.052], [-0.44, 0.058], [-0.64, 0.068]], 0.054, M.purple,
  { r: 0.014, holes: [[[-0.33, -0.022], [-0.155, -0.022], [-0.128, -0.072], [-0.2, -0.082], [-0.31, -0.066]], ...vents] });
  k.box(0.058, 0.18, -0.665, 0.026, -0.024, M.rubber);
  k.box(0.0545, 0.004, -0.6, 0.45, -0.098, M.pink);
  k.box(0.0545, 0.004, 0.02, 0.32, -0.036, M.pink);
  k.box(0.04, 0.012, -0.42, 0.26, 0.06, M.metal2); // 볼 받침
  // 방아쇠
  k.ext([[-0.07, -0.04], [-0.06, -0.04], [-0.064, -0.064], [-0.053, -0.078], [-0.063, -0.08], [-0.075, -0.066]], 0.008, M.steel, { r: 0.003, bevel: 0.001 });
  // 리시버 · 레일
  k.cyl(0.025, 0.025, -0.07, 0.3, 0.036, M.metal, { seg: 28 });
  k.rail(-0.07, 0.25, 0.06, 0.024, M.metal2);
  // 볼트
  const bolt = new THREE.Group(); bolt.position.set(0.0, 0.036, 0.02); root.add(bolt);
  const arm = k.add(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 10), M.steel, bolt);
  arm.rotation.z = Math.PI / 2 - 0.5; arm.position.set(0.042, -0.012, 0);
  const knob = k.add(new THREE.SphereGeometry(0.011, 16, 12), M.metal2, bolt);
  knob.position.set(0.064, -0.026, 0);
  // 총열(홈 파인 느낌) · 제퇴기
  k.cyl(0.018, 0.012, 0.23, 0.8, 0.036, M.metal, { seg: 10, flat: true });
  k.box(0.042, 0.034, 1.03, 0.085, 0.036, M.metal2);
  for (let i = 0; i < 3; i++) k.box(0.044, 0.02, 1.04 + i * 0.024, 0.012, 0.036, M.dark);
  k.cyl(0.02, 0.02, 1.0, 0.03, 0.036, M.metal2);
  k.cyl(0.0205, 0.0205, 1.012, 0.006, 0.036, M.pink);
  // 접힌 양각대
  k.box(0.024, 0.014, 0.33, 0.04, -0.05, M.metal2);
  for (const x of [-0.012, 0.012]) k.cyl(0.005, 0.004, 0.37, 0.26, -0.055, M.metal, { x, seg: 8 });
  // 탄창
  k.box(0.034, 0.05, 0.03, 0.09, -0.06, M.metal2);
  // 조준경
  const sv = 0.112;
  k.cyl(0.0165, 0.0165, -0.06, 0.33, sv, M.metal, { seg: 32 });
  k.cyl(0.0165, 0.031, 0.27, 0.05, sv, M.metal, { seg: 32 });
  k.cyl(0.031, 0.031, 0.32, 0.085, sv, M.metal, { seg: 32 });
  k.cyl(0.0315, 0.0315, 0.395, 0.008, sv, M.pink, { seg: 32 });
  k.cyl(0.023, 0.0165, -0.11, 0.05, sv, M.metal, { seg: 32 });
  k.cyl(0.023, 0.023, -0.17, 0.06, sv, M.rubber, { seg: 32 });
  const fl = k.add(new THREE.CircleGeometry(0.028, 32), M.lens); fl.position.set(0, sv, -0.406); fl.rotation.y = Math.PI;
  const rl = k.add(new THREE.CircleGeometry(0.02, 32), M.lens); rl.position.set(0, sv, 0.171);
  const tTop = k.add(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 24), Object.assign(M.metal2.clone(), { flatShading: true }));
  tTop.position.set(0, sv + 0.03, -0.1);
  const tTopCap = k.add(new THREE.CylinderGeometry(0.0145, 0.0145, 0.004, 24), M.pink); tTopCap.position.set(0, sv + 0.04, -0.1);
  const tSide = k.add(new THREE.CylinderGeometry(0.013, 0.013, 0.028, 24), Object.assign(M.metal2.clone(), { flatShading: true }));
  tSide.rotation.z = Math.PI / 2; tSide.position.set(0.03, sv, -0.1);
  k.box(0.03, 0.02, 0.07, 0.06, sv, M.metal); // 터렛 받침
  for (const u of [-0.02, 0.2]) {
    const ring = k.add(new THREE.TorusGeometry(0.019, 0.0045, 10, 32), M.metal2); ring.position.set(0, sv, -u);
    k.box(0.03, 0.04, u - 0.008, 0.016, 0.083, M.metal2);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.036, -1.12); root.add(muzzle);
  const eject = new THREE.Object3D(); eject.position.set(0.03, 0.04, -0.06); root.add(eject);
  return {
    id: 'sniper', name: 'SR-1 매눈', kind: '저격소총', root, muzzle, eject, bolt, flash: makeFlash(muzzle, 1.5),
    sight: { v: sv, u: -0.17 }, center: 0.22, length: 1.85, accent: '#ff2e88',
    hip: new THREE.Vector3(0.17, -0.2, -0.5), ads: new THREE.Vector3(0, -sv, -0.3),
    stats: { 위력: 5, 연사: 1, 정확도: 5, 장탄: 1 },
    mag: 5, rate: 1.05, reloadTime: 2.4, auto: false, damage: 3, adsFov: 9,
    spreadHip: 0.05, spreadAds: 0, bloomAdd: 0, bloomMax: 0, kick: 0.03,
  };
}
