// 사격장 배경: 밤 옥상 네온 사격장(오리지널). 이미지 파일 없이 캔버스로 텍스처를 그린다.
import * as THREE from 'three';

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 반사용 환경맵: 네온 패널이 있는 어두운 방
export function makeEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x07040f);
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: 0x0d0820, side: THREE.BackSide }));
  s.add(room);
  const panel = (w, h, color, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m);
  };
  panel(14, 3, new THREE.Color(2.2, 2.1, 2.4), 0, 4.9, 0, 0, Math.PI / 2);
  panel(0.6, 7, new THREE.Color(4, 0.4, 1.6), -9.9, 1, -3, Math.PI / 2);
  panel(0.6, 7, new THREE.Color(0.3, 3, 4), 9.9, 1, 3, -Math.PI / 2);
  panel(10, 0.5, new THREE.Color(1.5, 0.6, 3), 0, -2, -9.9);
  panel(8, 2, new THREE.Color(0.8, 0.8, 1.2), 0, 2, 9.9, Math.PI);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.03).texture;
  pm.dispose();
  return tex;
}

function floorTex() {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#16131f'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 18 + Math.random() * 22; x.fillStyle = `rgba(${v},${v - 2},${v + 8},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(120,90,200,.35)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h);
    x.strokeStyle = 'rgba(80,60,140,.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
  });
}

function windowTex() {
  return canvasTex(64, 128, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    const cols = ['#ffcf7a', '#8fe9ff', '#ff7ac3', '#b9a4ff', '#ffffff'];
    for (let yy = 4; yy < h - 4; yy += 8) for (let xx = 4; xx < w - 4; xx += 8) {
      if (Math.random() < 0.38) { x.globalAlpha = 0.35 + Math.random() * 0.65; x.fillStyle = cols[Math.floor(Math.random() * cols.length)]; x.fillRect(xx, yy, 5, 5); }
    }
  });
}

export function textTex(text, { w = 512, h = 128, color = '#ff2e88', font = 'bold 72px sans-serif', glow = 18 } = {}) {
  return canvasTex(w, h, (x) => {
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = color; x.shadowBlur = glow; x.fillStyle = color;
    x.fillText(text, w / 2, h / 2); x.shadowBlur = 0; x.fillStyle = '#fff'; x.globalAlpha = 0.85; x.fillText(text, w / 2, h / 2);
  });
}

export function buildWorld(scene, q) {
  const colliders = [];
  const anim = [];
  scene.fog = new THREE.FogExp2(0x120a26, 0.0062);

  // 하늘
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vp;void main(){float y=vp.y;vec3 top=vec3(.006,.004,.025);vec3 mid=vec3(.05,.015,.11);vec3 hor=vec3(.42,.07,.32);' +
      'vec3 c=mix(hor,mid,smoothstep(-.02,.16,y));c=mix(c,top,smoothstep(.16,.7,y));gl_FragColor=vec4(c,1.);}',
  }));
  scene.add(sky);
  // 별
  const sp = [];
  for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3; sp.push(Math.cos(a) * Math.cos(e) * 800, Math.sin(e) * 800, Math.sin(a) * Math.cos(e) * 800); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  // 달
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, '#fff6ff'); g.addColorStop(0.42, '#ffd9f3'); g.addColorStop(0.5, 'rgba(255,120,220,.35)'); g.addColorStop(1, 'rgba(255,80,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }), fog: false, depthWrite: false }));
  moon.scale.set(90, 90, 1); moon.position.set(-260, 230, -620); scene.add(moon);

  // 바닥
  const ft = floorTex(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(10, 40);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 260), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.42, metalness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -120; floor.receiveShadow = true;
  scene.add(floor); colliders.push(floor);
  // 바깥 지면(멀리)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: 0x0a0714, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);

  const neon = (c, i = 3) => new THREE.MeshStandardMaterial({ color: 0, emissive: c, emissiveIntensity: i });
  const cyan = neon(0x22e5ff), pink = neon(0xff2e88), violet = neon(0x8b5cff, 2.5), gold = neon(0xffd23f, 2.5);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1d1733, roughness: 0.7, metalness: 0.2 });

  // 양쪽 벽 + 네온 띠
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 240), wallMat);
    wall.position.set(sx * 15.5, 1.6, -118); wall.receiveShadow = true; scene.add(wall); colliders.push(wall);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 240), sx < 0 ? pink : cyan); s1.position.set(sx * 15.17, 2.9, -118); scene.add(s1);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 240), violet); s2.position.set(sx * 15.17, 0.35, -118); scene.add(s2);
  }
  // 거리 표지판
  for (const d of [10, 25, 50, 75, 100, 150]) {
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: textTex(d + 'M', { w: 256, h: 96, color: d >= 75 ? '#ff2e88' : '#22e5ff', font: '900 64px sans-serif', glow: 14 }), transparent: true, toneMapped: false }));
      m.position.set(sx * 15.15, 2.0, -d); m.rotation.y = -sx * Math.PI / 2; scene.add(m);
    }
    const line = new THREE.Mesh(new THREE.BoxGeometry(30, 0.02, 0.08), d >= 75 ? pink : violet); line.position.set(0, 0.01, -d); scene.add(line);
  }
  // 네온 아치(깊이감)
  for (const [z, m] of [[-32, cyan], [-62, pink], [-104, violet], [-152, cyan]]) {
    const g = new THREE.Group();
    const post = new THREE.BoxGeometry(0.22, 7.5, 0.22), beam = new THREE.BoxGeometry(30, 0.22, 0.22);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(post, m); p.position.set(sx * 14.6, 3.75, 0); g.add(p); }
    const b = new THREE.Mesh(beam, m); b.position.y = 7.5; g.add(b);
    g.position.z = z; scene.add(g);
  }
  // 뒤쪽 흙벽 + 표적판 뒤 가림막
  const berm = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1b1428, roughness: 0.95 }));
  berm.position.set(0, 4, -175); scene.add(berm); colliders.push(berm);
  const bermLine = new THREE.Mesh(new THREE.BoxGeometry(34, 0.14, 0.14), pink); bermLine.position.set(0, 8, -171.9); scene.add(bermLine);

  // 도시 스카이라인
  const wt = windowTex(); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(3, 8);
  const bmat = new THREE.MeshStandardMaterial({ color: 0x0d0a18, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 1.25, roughness: 0.8, fog: true });
  const N = q.low ? 110 : 190;
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bmat, N);
  const o = new THREE.Object3D();
  let r = 12345; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const ang = -Math.PI / 2 + (rnd() * 2 - 1) * 1.25, dist = 230 + rnd() * 260;
    const h = 25 + rnd() * rnd() * 150, w = 14 + rnd() * 26;
    o.position.set(Math.cos(ang) * dist * 1.4, h / 2 - 2, Math.sin(ang) * dist); o.scale.set(w, h, w); o.rotation.y = rnd(); o.updateMatrix();
    city.setMatrixAt(i, o.matrix);
  }
  scene.add(city);
  // 간판(5락실 사격장)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(90, 22), new THREE.MeshBasicMaterial({ map: textTex('5락실 RANGE', { w: 1024, h: 256, color: '#ff2e88', font: '900 150px sans-serif', glow: 30 }), transparent: true, toneMapped: false, fog: false, depthWrite: false }));
  sign.position.set(40, 95, -420); scene.add(sign);
  anim.push((t) => { sign.material.opacity = 0.85 + 0.15 * Math.sin(t * 3) * (Math.sin(t * 17) > 0.96 ? -3 : 1); });

  // 사로(앞 카운터와 칸막이)
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x2a2440, metalness: 0.6, roughness: 0.38 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.7), counterMat); counter.position.set(0, 1.05, -0.95); scene.add(counter);
  const front = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.05, 0.06), wallMat); front.position.set(0, 0.52, -1.3); scene.add(front);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.015, 0.015), neon(0x22e5ff, 1.2)); edge.position.set(0, 1.09, -1.31); scene.add(edge);

  // 조명
  scene.add(new THREE.HemisphereLight(0x7a6cff, 0x140a20, 0.75));
  const moonL = new THREE.DirectionalLight(0xb7b6ff, 1.1); moonL.position.set(-20, 40, 10); moonL.target.position.set(0, 0, -40);
  if (!q.low) {
    moonL.castShadow = true; moonL.shadow.mapSize.set(1024, 1024);
    Object.assign(moonL.shadow.camera, { left: -18, right: 18, top: 40, bottom: -40, near: 1, far: 120 });
    moonL.shadow.camera.updateProjectionMatrix(); moonL.shadow.bias = -0.0008;
  }
  scene.add(moonL, moonL.target);
  const pls = [[0xff2e88, -9, 4, -22, 30], [0x22e5ff, 9, 4, -42, 30], [0x8b5cff, 0, 6, -85, 60]];
  for (const [c, x, y, z, dist] of pls) { const l = new THREE.PointLight(c, dist > 10 ? 60 : 3, dist, 1.6); l.position.set(x, y, z); scene.add(l); }

  return { colliders, update: (t) => anim.forEach((f) => f(t)) };
}

// ---------- 표적 ----------
function ringTex(gold) {
  return canvasTex(256, 256, (x) => {
    const cx = 128;
    const rings = gold ? ['#3a2600', '#ffd23f', '#3a2600', '#ffe98a', '#ff9f1c'] : ['#141020', '#f4f0ff', '#141020', '#f4f0ff', '#ff2e88'];
    const rs = [128, 104, 80, 56, 28];
    rings.forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(cx, cx, rs[i], 0, 7); x.fill(); });
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cx, 7, 0, 7); x.fill();
    x.strokeStyle = gold ? '#7a5200' : '#7a6aa8'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, 6); x.lineTo(cx, 250); x.moveTo(6, cx); x.lineTo(250, cx); x.globalAlpha = 0.5; x.stroke();
  });
}

export function targetKit() {
  const tex = ringTex(false), gtex = ringTex(true);
  const face = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 });
  const gface = new THREE.MeshStandardMaterial({ map: gtex, emissiveMap: gtex, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.3 });
  const side = new THREE.MeshStandardMaterial({ color: 0x2b2f37, metalness: 0.8, roughness: 0.35 });
  const post = new THREE.MeshStandardMaterial({ color: 0x39334f, metalness: 0.6, roughness: 0.5 });
  const rim = { plate: new THREE.MeshBasicMaterial({ color: 0x22e5ff, toneMapped: false }), slider: new THREE.MeshBasicMaterial({ color: 0x8b5cff, toneMapped: false }), far: new THREE.MeshBasicMaterial({ color: 0xff2e88, toneMapped: false }), gold: new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false }) };
  const beacon = new THREE.SpriteMaterial({ map: canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,60,130,.9)'); g.addColorStop(1, 'rgba(255,40,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });

  function plate(type) {
    const R = type === 'far' ? 0.62 : 0.45;
    const pivot = new THREE.Group();
    const h = type === 'far' ? 1.9 : 1.15;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 8), post); p.position.y = h / 2; p.castShadow = true; pivot.add(p);
    const g = new THREE.CylinderGeometry(R, R, 0.05, 40); g.rotateX(Math.PI / 2);
    const disc = new THREE.Mesh(g, [side, type === 'gold' ? gface : face, side]); disc.position.y = h + R * 0.92; disc.castShadow = true; pivot.add(disc);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.022, 8, 48), rim[type]); torus.position.copy(disc.position); pivot.add(torus);
    if (type === 'far') { const b = new THREE.Sprite(beacon); b.scale.set(1.6, 1.6, 1); b.position.y = h + R * 2 + 0.7; pivot.add(b); pivot.userData.beacon = b; }
    if (type === 'slider') { const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), post); base.position.y = 0.06; pivot.add(base); }
    disc.userData.R = R;
    return { pivot, hit: [disc], disc };
  }

  const droneBody = new THREE.MeshStandardMaterial({ color: 0x24202f, metalness: 0.85, roughness: 0.3 });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xff2e88, toneMapped: false });
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x22e5ff, transparent: true, opacity: 0.35, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
  function drone() {
    const pivot = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 12), droneBody); body.scale.set(1, 0.36, 1); pivot.add(body);
    const rotors = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.07), droneBody); arm.position.set(Math.cos(a) * 0.42, 0.04, Math.sin(a) * 0.42); arm.rotation.y = -a; pivot.add(arm);
      const rotor = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), rotorMat); rotor.rotation.x = -Math.PI / 2; rotor.position.set(Math.cos(a) * 0.72, 0.1, Math.sin(a) * 0.72); pivot.add(rotor); rotors.push(rotor);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 12), coreMat); core.position.set(0, -0.04, 0.3); pivot.add(core);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 32), rim.plate); eye.position.copy(core.position); pivot.add(eye);
    body.castShadow = true;
    return { pivot, hit: [core, body], core, rotors };
  }
  // 네온 좀비: 각진 만화풍(오리지널). 피 없음 — 맞으면 빛 조각으로 흩어진다.
  const skinBase = new THREE.MeshStandardMaterial({ color: 0x6fae6a, roughness: 0.6, metalness: 0.05, emissive: 0x1d5a26, emissiveIntensity: 1 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x6a4fb0, roughness: 0.8, emissive: 0x24104a, emissiveIntensity: 1 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1f2433, roughness: 0.9 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 0.8), toneMapped: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 0.6), toneMapped: false });
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  function zombie() {
    const skin = skinBase.clone();
    const pivot = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 0.95; pivot.add(body);
    const torso = new THREE.Mesh(B(0.52, 0.66, 0.3), shirt); torso.position.y = 0.38; torso.rotation.x = 0.22; torso.castShadow = true; body.add(torso);
    const rib = new THREE.Mesh(B(0.53, 0.04, 0.31), glowMat); rib.position.set(0, 0.5, 0.02); rib.rotation.x = 0.22; body.add(rib);
    const neck = new THREE.Group(); neck.position.set(0, 0.74, 0.12); body.add(neck);
    const head = new THREE.Mesh(B(0.34, 0.36, 0.34), skin); head.position.y = 0.2; head.castShadow = true; neck.add(head);
    const jaw = new THREE.Mesh(B(0.28, 0.08, 0.3), skin); jaw.position.set(0, 0.0, 0.03); neck.add(jaw);
    for (const x of [-0.08, 0.08]) { const eye = new THREE.Mesh(B(0.075, 0.05, 0.02), eyeMat); eye.position.set(x, 0.24, 0.175); neck.add(eye); }
    const mouth = new THREE.Mesh(B(0.16, 0.025, 0.02), glowMat); mouth.position.set(0, 0.1, 0.175); neck.add(mouth);
    const arms = [], legs = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.33, 0.62, 0.08); body.add(sh);
      const up = new THREE.Mesh(B(0.14, 0.14, 0.62), skin); up.position.z = 0.3; sh.add(up);
      const hand = new THREE.Mesh(B(0.15, 0.1, 0.14), skin); hand.position.z = 0.66; sh.add(hand);
      sh.rotation.x = -0.15; arms.push(sh);
      const hip = new THREE.Group(); hip.position.set(sx * 0.14, 0, 0); body.add(hip);
      const leg = new THREE.Mesh(B(0.18, 0.92, 0.2), pants); leg.position.y = -0.46; leg.castShadow = true; hip.add(leg);
      const foot = new THREE.Mesh(B(0.2, 0.08, 0.3), pants); foot.position.set(0, -0.9, 0.05); hip.add(foot);
      legs.push(hip);
    }
    head.userData.part = 'head';
    return { pivot, hit: [head, torso, ...arms.map((a) => a.children[0]), ...legs.map((l) => l.children[0])], head, body, neck, arms, legs, mats: [skin] };
  }
  return { plate, drone, zombie };
}
