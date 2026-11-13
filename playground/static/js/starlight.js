/* 5락실 '별빛 요격대' — 오리지널 세로 슈팅 게임. 그림·소리 모두 코드로 생성(외부 파일 없음). */
(function () {
'use strict';
const W = 360, H = 640, TAU = Math.PI * 2;
const C = { cy: '#22d3ee', pk: '#ff3d9a', ye: '#ffd23f', gr: '#3ddc84', or: '#ff8a3d', pu: '#b06bff', wh: '#ffffff', rd: '#ff4d5e' };
const FONT_N = "'Press Start 2P',monospace", FONT_K = "'Black Han Sans',system-ui,sans-serif";
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const DEBUG = /sldebug/.test(location.hash);

/* ---------- 스프라이트(미리 그려 두고 drawImage만 → 첫 판부터 가볍게) ---------- */
let RES = 3, SP = null;
function sprite(w, h, fn) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
  const x = c.getContext('2d'); x.scale(RES, RES); x.translate(w / 2, h / 2); x.lineJoin = 'round'; x.lineCap = 'round'; fn(x);
  return { c, w, h };
}
function poly(x, pts) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); }
function glowStroke(x, col, lw, blur) { x.shadowColor = col; x.shadowBlur = blur || 8; x.strokeStyle = col; x.lineWidth = lw; x.stroke(); x.shadowBlur = 0; }
function dot(col, r) {
  return sprite(r * 2, r * 2, x => { const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(.25, col); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); });
}
function buildSprites() {
  const S = {};
  // 적 1: 글리치 드론(청록 화살촉)
  S.drone = [0, 1].map(f => sprite(34, 30, x => {
    const k = f ? 3 : 0; poly(x, [0, 11, 13, -6 + k, 6, -2, 0, -9, -6, -2, -13, -6 + k]); x.fillStyle = '#05242c'; x.fill(); glowStroke(x, C.cy, 2);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 3, 0, TAU); x.fill(); x.fillStyle = C.pk; x.beginPath(); x.arc(0, 1, 1.5, 0, TAU); x.fill();
  }));
  // 적 2: 네온 해파리(분홍)
  S.jelly = [0, 1].map(f => sprite(34, 34, x => {
    x.beginPath(); x.arc(0, -3, 11, Math.PI, 0); x.quadraticCurveTo(11, 3, 0, 3); x.quadraticCurveTo(-11, 3, -11, -3); x.closePath(); x.fillStyle = '#2a0618'; x.fill(); glowStroke(x, C.pk, 2);
    x.beginPath(); for (let i = -1.5; i <= 1.5; i++) { const bx = i * 6; x.moveTo(bx, 3); x.quadraticCurveTo(bx + (f ? 4 : -4), 8, bx, 13); } glowStroke(x, C.pk, 1.6, 6);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(-4, -4, 2.2, 0, TAU); x.arc(4, -4, 2.2, 0, TAU); x.fill();
  }));
  // 적 3: 프리즘(노랑, 2발)
  const prism = (col, crack) => [0, 1].map(f => sprite(30, 34, x => {
    poly(x, [0, -13, 10, 0, 0, 13, -10, 0]); x.fillStyle = '#2a2203'; x.fill(); glowStroke(x, col, 2);
    x.beginPath(); x.moveTo(0, -13); x.lineTo(0, 13); x.moveTo(-10, 0); x.lineTo(10, 0); x.strokeStyle = col + (f ? 'cc' : '66'); x.lineWidth = 1; x.stroke();
    if (crack) { x.beginPath(); x.moveTo(-4, -8); x.lineTo(1, -2); x.lineTo(-2, 3); x.lineTo(3, 9); x.strokeStyle = '#fff'; x.lineWidth = 1.4; x.stroke(); }
  }));
  S.prism = prism(C.ye, false); S.prism1 = prism(C.ye, true);
  // 적 4: 가디언(초록 육각, 3발)
  const guard = (col, core) => [0, 1].map(f => sprite(42, 40, x => {
    const p = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; p.push(Math.cos(a) * 13, Math.sin(a) * 13); } poly(x, p); x.fillStyle = '#062616'; x.fill(); glowStroke(x, col, 2);
    poly(x, [-13, -4, -19, -9 + (f ? 3 : 0), -17, 6, -12, 5]); glowStroke(x, col, 1.6, 6); poly(x, [13, -4, 19, -9 + (f ? 3 : 0), 17, 6, 12, 5]); glowStroke(x, col, 1.6, 6);
    x.shadowColor = core; x.shadowBlur = 10; x.fillStyle = core; x.beginPath(); x.arc(0, 1, 5, 0, TAU); x.fill(); x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 1, 2, 0, TAU); x.fill();
  }));
  S.guard = guard(C.gr, C.or); S.guard1 = guard(C.or, C.rd);
  // 보스: 마더 헥스
  S.boss = sprite(130, 120, x => {
    const p = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; p.push(Math.cos(a) * 46, Math.sin(a) * 40); } poly(x, p); x.fillStyle = '#14062a'; x.fill(); glowStroke(x, C.pu, 3, 14);
    const q = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; q.push(Math.cos(a) * 30, Math.sin(a) * 26); } poly(x, q); glowStroke(x, C.pk, 1.5, 8);
    for (const s of [-1, 1]) { poly(x, [s * 44, -10, s * 62, -22, s * 60, 18, s * 44, 12]); x.fillStyle = '#14062a'; x.fill(); glowStroke(x, C.pu, 2, 8); x.fillStyle = C.cy; x.fillRect(s * 54 - 3, 8, 6, 10); }
    x.fillStyle = C.cy; x.fillRect(-14, 34, 6, 10); x.fillRect(8, 34, 6, 10);
  });
  S.bossRing = sprite(150, 150, x => { x.setLineDash([10, 8]); x.beginPath(); x.arc(0, 0, 66, 0, TAU); glowStroke(x, C.pu + 'aa', 2, 6); });
  // 플레이어: NX-7 반딧불
  S.ship = sprite(34, 36, x => {
    poly(x, [0, -16, 5, -6, 5, 4, 14, 10, 14, 14, 4, 11, 0, 14, -4, 11, -14, 14, -14, 10, -5, 4, -5, -6]); x.fillStyle = '#0b1a3a'; x.fill(); glowStroke(x, C.cy, 2, 10);
    x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke(); x.fillStyle = C.ye; x.beginPath(); x.ellipse(0, -5, 2.4, 4.5, 0, 0, TAU); x.fill();
    x.fillStyle = C.pk; x.fillRect(-13, 9, 3, 3); x.fillRect(10, 9, 3, 3);
  });
  S.pb = sprite(10, 22, x => { x.shadowColor = C.cy; x.shadowBlur = 8; x.fillStyle = C.cy; x.fillRect(-2, -8, 4, 16); x.shadowBlur = 0; x.fillStyle = '#fff'; x.fillRect(-1, -7, 2, 14); });
  S.eb = sprite(16, 16, x => { x.shadowColor = C.pk; x.shadowBlur = 8; x.fillStyle = C.pk; x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill(); x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 2, 0, TAU); x.fill(); });
  S.cap = { P: [C.ye, 'P'], S: [C.cy, 'S'] };
  for (const k in S.cap) { const [col, t] = S.cap[k]; S.cap[k] = sprite(26, 20, x => { x.beginPath(); x.roundRect ? x.roundRect(-10, -7, 20, 14, 5) : x.rect(-10, -7, 20, 14); x.fillStyle = '#111'; x.fill(); glowStroke(x, col, 2); x.fillStyle = col; x.font = "bold 10px " + FONT_N; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 0.5, 1); }); }
  S.dot = {}; for (const k in C) S.dot[k] = dot(C[k], 8);
  S.flame = dot(C.or, 7);
  // 배경 성운(위아래 이어지게)
  const neb = document.createElement('canvas'); neb.width = W; neb.height = H; const n = neb.getContext('2d');
  n.fillStyle = '#04020d'; n.fillRect(0, 0, W, H);
  const blobs = [[60, 120, 160, '#5b1aa855'], [300, 330, 190, '#0e6a8a44'], [140, 520, 170, '#a81a6a40'], [330, 40, 120, '#2a1a8a44']];
  for (const [bx, by, r, col] of blobs) for (const oy of [-H, 0, H]) { const g = n.createRadialGradient(bx, by + oy, 0, bx, by + oy, r); g.addColorStop(0, col); g.addColorStop(1, '#00000000'); n.fillStyle = g; n.fillRect(0, 0, W, H); }
  n.strokeStyle = '#ffffff08'; n.lineWidth = 1; for (let gx = 0; gx <= W; gx += 40) { n.beginPath(); n.moveTo(gx, 0); n.lineTo(gx, H); n.stroke(); } for (let gy = 0; gy < H; gy += 40) { n.beginPath(); n.moveTo(0, gy); n.lineTo(W, gy); n.stroke(); }
  S.neb = neb;
  return S;
}
function spr(x, s, px, py, rot, sc, alpha) {
  const w = s.w * (sc || 1), h = s.h * (sc || 1);
  if (alpha !== undefined) x.globalAlpha = alpha;
  if (rot) { x.save(); x.translate(px, py); x.rotate(rot); x.drawImage(s.c, -w / 2, -h / 2, w, h); x.restore(); }
  else x.drawImage(s.c, px - w / 2, py - h / 2, w, h);
  if (alpha !== undefined) x.globalAlpha = 1;
}

/* ---------- 경로(베지어 곡선을 미리 점으로) ---------- */
function mkPath(segs) {
  const pts = [segs[0][0]];
  for (const [a, b, c, d] of segs) for (let i = 1; i <= 18; i++) {
    const t = i / 18, u = 1 - t;
    pts.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, L, len: L[L.length - 1] };
}
function pathAt(p, e) {
  const d = e.d; if (d >= p.len) { const q = p.pts[p.pts.length - 1]; e.x = q[0]; e.y = q[1]; return true; }
  while (e.pi < p.L.length - 2 && p.L[e.pi + 1] < d) e.pi++;
  const a = p.pts[e.pi], b = p.pts[e.pi + 1], f = (d - p.L[e.pi]) / ((p.L[e.pi + 1] - p.L[e.pi]) || 1);
  e.x = a[0] + (b[0] - a[0]) * f; e.y = a[1] + (b[1] - a[1]) * f; return false;
}
const M = (m, x, y) => [W / 2 + m * (x - W / 2), y];
const ENTRY = [
  m => mkPath([[M(m, -30, 60), M(m, 130, 40), M(m, 250, 260), M(m, 200, 300)], [M(m, 200, 300), M(m, 150, 340), M(m, 70, 280), M(m, 120, 220)]]),
  m => mkPath([[M(m, 110, -30), M(m, 110, 140), M(m, 310, 200), M(m, 280, 270)], [M(m, 280, 270), M(m, 250, 320), M(m, 170, 290), M(m, 200, 220)]]),
  m => mkPath([[M(m, -30, 330), M(m, 90, 330), M(m, 220, 270), M(m, 210, 190)], [M(m, 210, 190), M(m, 200, 120), M(m, 90, 140), M(m, 120, 220)]]),
  m => mkPath([[M(m, 390, 110), M(m, 220, 90), M(m, 50, 180), M(m, 90, 250)], [M(m, 90, 250), M(m, 130, 320), M(m, 270, 290), M(m, 230, 210)]]),
];

/* ---------- 소리(Web Audio로 합성) ---------- */
const A = { ctx: null, muted: false, next: 0, step: 0, lastShot: 0 };
try { A.muted = localStorage.getItem('sl_mute') === '1'; } catch (e) {}
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = A.ctx = new AC(); A.master = c.createGain(); A.master.gain.value = A.muted ? 0 : .5; A.master.connect(c.destination);
    A.sfx = c.createGain(); A.sfx.gain.value = .7; A.sfx.connect(A.master); A.mus = c.createGain(); A.mus.gain.value = .32; A.mus.connect(A.master);
    const b = A.noise = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.next = c.currentTime + .1;
  } catch (e) { A.ctx = null; }
}
function tone(type, f0, f1, dur, vol, at, out) {
  const c = A.ctx; if (!c) return; const t = at || c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(out || A.sfx); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, vol, freq, type, at, out) {
  const c = A.ctx; if (!c) return; const t = at || c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = A.noise; f.type = type || 'lowpass'; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out || A.sfx); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
}
const SFX = {
  shot() { const c = A.ctx; if (!c || c.currentTime - A.lastShot < .09) return; A.lastShot = c.currentTime; tone('triangle', 1300, 600, .05, .05); },
  hit() { tone('square', 340, 220, .04, .04); },
  kill() { noise(.28, .3, 1600); tone('sawtooth', 240, 60, .18, .05); },
  big() { noise(1.1, .5, 900); tone('sawtooth', 160, 30, 1, .12); },
  die() { noise(.9, .45, 1200); tone('sawtooth', 500, 40, .9, .1); },
  power() { const t = A.ctx && A.ctx.currentTime; [660, 880, 1320].forEach((f, i) => tone('square', f, f, .08, .06, t + i * .06)); },
  shield() { tone('sine', 300, 900, .3, .12); },
  life() { const t = A.ctx && A.ctx.currentTime; [523, 659, 784, 1046, 1318].forEach((f, i) => tone('square', f, f, .1, .06, t + i * .07)); },
  stage() { const t = A.ctx && A.ctx.currentTime; [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, .16, .12, t + i * .1)); },
  warn() { const t = A.ctx && A.ctx.currentTime; for (let i = 0; i < 4; i++) tone('square', i % 2 ? 330 : 440, i % 2 ? 330 : 440, .18, .07, t + i * .2); },
};
// 배경음: 직접 만든 4마디 신스 베이스(Am-F-C-G) + 킥 + 하이햇
const BASS = [45, 41, 48, 43], PAT = [0, 0, 12, 0, 0, 7, 12, 0];
function music(fast) {
  const c = A.ctx; if (!c || A.muted) return; const st = 60 / (fast ? 132 : 116) / 4;
  if (A.next < c.currentTime) A.next = c.currentTime + .05;
  while (A.next < c.currentTime + .25) {
    const s = A.step % 32, root = BASS[s >> 3], n = root + PAT[s & 7], f = 440 * Math.pow(2, (n - 69) / 12), t = A.next;
    const o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 700;
    g.gain.setValueAtTime(.09, t); g.gain.exponentialRampToValueAtTime(.001, t + st * .9); o.connect(fl); fl.connect(g); g.connect(A.mus); o.start(t); o.stop(t + st);
    if (s % 4 === 0) tone('sine', 130, 45, .14, .35, t, A.mus);
    if (s % 2 === 1) noise(.04, .05, 7000, 'highpass', t, A.mus);
    A.next += st; A.step++;
  }
}

/* ---------- 화면 ---------- */
let ov, cv, x, hudBtns, panel, opts, G = null, raf = 0, paused = false, last = 0, lay = { s: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
let stars = [];
function css() {
  const st = document.createElement('style');
  st.textContent = '.sl-ov{position:fixed;inset:0;z-index:9999;background:#02010a;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}.sl-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.sl-btns{position:absolute;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));display:flex;gap:6px;z-index:2}.sl-btns button{width:38px;height:38px;border-radius:10px;border:1px solid #ffffff44;background:#0c0620cc;color:#fff;font-size:16px;cursor:pointer}'
    + '.sl-pn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;background:#02010acc}.sl-pn>div{width:min(320px,86vw);text-align:center;color:#fff;background:#0c0620;border:2px solid #ff3d9a;border-radius:16px;padding:20px 16px;box-shadow:0 0 30px #ff3d9a66}'
    + '.sl-pn h3{font-family:' + FONT_N + ';font-size:18px;color:#ffd23f;margin:4px 0 14px;text-shadow:0 0 12px #ffd23f}.sl-pn .sc{font-family:' + FONT_N + ';font-size:22px;color:#22d3ee;margin:6px 0;text-shadow:0 0 10px #22d3ee}.sl-pn p{margin:6px 0;font-size:14px;color:#cfc8ff}'
    + '.sl-pn button{display:block;width:100%;margin:8px 0 0;padding:12px;border-radius:12px;border:0;font-size:16px;font-weight:800;cursor:pointer}.sl-pn .p1{background:#ffd23f;color:#1a0f00;box-shadow:0 4px 0 #b8860b}.sl-pn .p2{background:#ff3d9a;color:#fff}.sl-pn .p3{background:#ffffff1a;color:#fff}';
  document.head.appendChild(st);
}
function mkDom() {
  css();
  ov = document.createElement('div'); ov.className = 'sl-ov'; ov.hidden = true;
  cv = document.createElement('canvas'); x = cv.getContext('2d', { alpha: false }); ov.appendChild(cv);
  hudBtns = document.createElement('div'); hudBtns.className = 'sl-btns';
  hudBtns.innerHTML = '<button type="button" data-k="m" aria-label="소리"></button><button type="button" data-k="p" aria-label="일시정지">Ⅱ</button><button type="button" data-k="x" aria-label="나가기">✕</button>';
  ov.appendChild(hudBtns);
  panel = document.createElement('div'); panel.className = 'sl-pn'; panel.hidden = true; ov.appendChild(panel);
  document.body.appendChild(ov);
  const mb = hudBtns.querySelector('[data-k=m]'); mb.textContent = A.muted ? '🔇' : '🔊';
  hudBtns.addEventListener('pointerdown', e => e.stopPropagation());
  hudBtns.onclick = e => {
    const k = e.target.dataset.k;
    if (k === 'm') { A.muted = !A.muted; mb.textContent = A.muted ? '🔇' : '🔊'; try { localStorage.setItem('sl_mute', A.muted ? '1' : '0'); } catch (er) {} if (A.master) A.master.gain.value = A.muted ? 0 : .5; }
    if (k === 'p') pause(!paused);
    if (k === 'x') close();
  };
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  addEventListener('resize', () => { if (!ov.hidden) layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode === 'play') pause(true); });
  addEventListener('blur', () => { if (!ov.hidden && G && G.mode === 'play' && !DEBUG) pause(true); });
  input();
  for (let i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random(), l: i % 3 });
}
function layout() {
  const cw = ov.clientWidth || innerWidth, ch = ov.clientHeight || innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2); if (cw * ch * dpr * dpr > 3.6e6) dpr = Math.sqrt(3.6e6 / (cw * ch)); // 픽셀 수 상한(고해상도 노트북 렉 방지)
  const s = Math.min(cw / W, ch / H);
  lay = { s, dpr, cw, ch, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2 };
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const r = clamp(Math.ceil(s * dpr), 2, 4); if (r !== RES || !SP) { RES = r; SP = buildSprites(); }
}

/* ---------- 입력 ---------- */
const keys = {}; let ptr = null;
function toField(e) { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left - lay.ox) / lay.s, (e.clientY - b.top - lay.oy) / lay.s]; }
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; const k = e.key;
    if (/^Arrow|^[wasdWASD ]$/.test(k)) e.preventDefault();
    if (k === 'Escape' || k === 'p' || k === 'P') { if (G && G.mode === 'play') pause(!paused); return; }
    keys[k.length === 1 ? k.toLowerCase() : k] = 1; if (paused && G && G.mode === 'play' && k !== 'Escape') pause(false);
  });
  addEventListener('keyup', e => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = 0; });
  ov.addEventListener('pointerdown', e => {
    if (paused) { pause(false); return; }
    audioInit(); const [fx, fy] = toField(e);
    ptr = { id: e.pointerId, mouse: e.pointerType === 'mouse', sx: fx, sy: fy, px: G ? G.px : 0, py: G ? G.py : 0, tx: fx, ty: fy };
    try { ov.setPointerCapture(e.pointerId); } catch (er) {}
  });
  ov.addEventListener('pointermove', e => {
    const [fx, fy] = toField(e);
    if (e.pointerType === 'mouse') { if (!ptr || !ptr.mouse) ptr = { mouse: true, tx: fx, ty: fy, free: true }; ptr.tx = fx; ptr.ty = fy; ptr.active = true; return; }
    if (ptr && ptr.id === e.pointerId) { ptr.tx = fx; ptr.ty = fy; }
  });
  const up = e => { if (ptr && !ptr.mouse && ptr.id === e.pointerId) ptr = null; };
  ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
  ov.addEventListener('contextmenu', e => e.preventDefault());
}

/* ---------- 게임 ---------- */
const TYPES = {
  drone: { hp: 1, pts: 100, r: 11, col: 'cy' }, jelly: { hp: 1, pts: 160, r: 11, col: 'pk' },
  prism: { hp: 2, pts: 300, r: 11, col: 'ye' }, guard: { hp: 3, pts: 500, r: 14, col: 'gr' },
};
const SPX = 36, SPY = 30, TOP = 96, COLS = 8;
function diff(n) {
  return {
    enter: Math.min(330, 215 + n * 8), diveGap: Math.max(.75, 2.9 - n * .17), divers: Math.min(8, 1 + Math.ceil(n / 1.5)),
    dive: Math.min(300, 165 + n * 10), bullet: Math.min(300, 135 + n * 10), formFire: n >= 4 ? Math.min(1.2, (n - 3) * .12) : 0,
    mult: 1 + (n - 1) * .1,
  };
}
function newGame() {
  G = { mode: 'play', stage: 0, score: 0, disp: 0, lives: 3, power: 1, shield: false, px: W / 2, py: H - 70, inv: 0, fireT: 0, dead: 0,
    en: [], pb: [], eb: [], parts: [], caps: [], texts: [], q: [], t: 0, shake: 0, nextLife: 30000, shots: 0, hits: 0, kills: 0, boss: null, debug: DEBUG, god: false };
  try { G.best = +localStorage.getItem('nr_best_starlight_' + window.KST_SL) || 0; } catch (e) { G.best = 0; }
  startStage(1);
}
function startStage(n) {
  G.stage = n; G.st = 0; G.clearT = 0; G.miss = 0; G.D = diff(n); G.R = opts.rng(n); G.diveT = 2.5; G.formT = 0; G.eb = []; G.q = []; G.boss = null;
  const R = G.R, D = G.D;
  SFX.stage();
  if (n % 5 === 0) { // 보스 스테이지
    G.boss = { x: W / 2, y: -80, hp: 70 + n * 10, max: 70 + n * 10, t: 0, ph: 0, pt: 3, enter: true, hitT: 0 };
    setTimeout(() => SFX.warn(), 600);
    return;
  }
  // 편대 구성: 아래 두 줄 드론, 가운데 해파리(3단계부터 일부 프리즘), 맨 위 가디언(2단계부터)
  const slots = [];
  const gN = n >= 4 ? 4 : n >= 2 ? 2 : 0; for (let i = 0; i < gN; i++) slots.push({ type: 'guard', col: gN === 4 ? 2 + i : 3 + i, row: 0 });
  const prisms = n >= 3 ? Math.min(8, 2 + (n - 3) * 2) : 0; let pc = 0;
  for (const row of n >= 2 ? [1, 2] : [2]) for (let c = 0; c < COLS; c++) {
    const isP = row === 1 && pc < prisms && (c % 2 === (n & 1) || prisms > 4) ? (pc++, true) : false;
    slots.push({ type: isP ? 'prism' : 'jelly', col: c, row });
  }
  for (const row of [3, 4]) for (let c = 0; c < COLS; c++) slots.push({ type: 'drone', col: c, row });
  // 아이템 운반: P 2개, 3단계부터 S 1개
  const carry = ['P', 'P']; if (n >= 3) carry.push('S');
  for (const k of carry) { const s = slots[Math.floor(R() * slots.length)]; if (!s.cap) s.cap = k; }
  // 비행 그룹(최대 8)으로 나눠 입장
  const groups = []; for (let i = 0; i < slots.length; i += 8) groups.push(slots.slice(i, i + 8));
  let t = 1.6;
  groups.forEach((g, gi) => {
    const tpl = Math.floor(R() * ENTRY.length), m = gi % 2 ? -1 : 1, dual = n >= 2 && R() < .5;
    g.forEach((s, i) => {
      const mm = dual ? (i % 2 ? -m : m) : m, k = dual ? i >> 1 : i;
      const fire = n >= 3 && R() < Math.min(.5, .1 * (n - 2)) ? .5 + R() * .3 : -1;
      G.q.push({ t: t + k * .15, e: { ...s, hp: TYPES[s.type].hp, st: 'enter', path: ENTRY[tpl](mm), d: 0, pi: 0, x: -99, y: -99, rot: 0, fire, hitT: 0, ph: R() * TAU } });
    });
    t += dual ? 1.3 + (g.length >> 1) * .15 : 1.4 + g.length * .15;
  });
  G.q.sort((a, b) => a.t - b.t);
}
function slotPos(e) {
  const br = 1 + .06 * Math.sin(G.t * 1.3), sway = Math.sin(G.t * .55) * 22;
  return [W / 2 + (e.col - (COLS - 1) / 2) * SPX * br + sway, TOP + e.row * SPY * (1 + .03 * Math.sin(G.t * 1.3))];
}
function aimShot(sx, sy, spd, spread) {
  const a = Math.atan2(G.py - sy, G.px - sx) + (spread || 0);
  G.eb.push({ x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd });
}
function startDive(e) {
  const R = G.R, D = G.D, m = e.x < W / 2 ? -1 : 1, tx = clamp(G.px + (R() - .5) * 70, 30, W - 30);
  const segs = [[[e.x, e.y], [e.x + m * 40, e.y - 50], [e.x + m * 85, e.y + 5], [e.x + m * 55, e.y + 60]]];
  const b = [e.x + m * 55, e.y + 60];
  if (e.type === 'prism' && G.stage >= 5) segs.push([b, [b[0] - m * 20, b[1] + 160], [tx, H * .78], [tx - m * 30, H * .72]], [[tx - m * 30, H * .72], [tx - m * 80, H * .55], [tx - m * 60, 120], [tx - m * 40, -40]]);
  else segs.push([b, [b[0] - m * 25, b[1] + 180], [tx, H * .6], [clamp(tx + (R() - .5) * 140, 10, W - 10), H + 40]]);
  e.path = mkPath(segs); e.d = 0; e.pi = 0; e.st = 'dive'; e.spd = D.dive * (e.type === 'drone' ? 1.05 : 1);
  const n = G.stage, shots = n === 1 ? (R() < .35 ? 1 : 0) : n < 4 ? 1 : n < 7 ? 1 + (R() < .5 ? 1 : 0) : 2 + (R() < .4 ? 1 : 0);
  e.shots = []; for (let i = 0; i < shots; i++) e.shots.push((.25 + R() * .3 + i * .08) * e.path.len);
}
function kill(e, byShip) {
  const T = TYPES[e.type], diving = e.st === 'dive', base = T.pts * (diving ? 2 : 1);
  const pts = Math.round(base * G.D.mult / 10) * 10; addScore(pts);
  if (diving || e.type === 'guard') G.texts.push({ x: e.x, y: e.y, t: 0, s: '' + pts, col: C.ye });
  boom(e.x, e.y, T.col, e.type === 'guard' ? 26 : 16); SFX.kill(); G.kills++;
  if (e.cap) G.caps.push({ x: e.x, y: e.y, k: e.cap, t: 0 });
  e.dead = true;
}
function addScore(p) {
  G.score += p;
  if (G.score >= G.nextLife) { G.nextLife += 80000; if (G.lives < 5) { G.lives++; SFX.life(); G.texts.push({ x: W / 2, y: H * .45, t: 0, s: '1UP!', col: C.gr, big: 1 }); } }
}
function boom(px, py, col, n) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 40 + Math.random() * 170; if (G.parts.length < 420) G.parts.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, m: .35 + Math.random() * .45, k: Math.random() < .3 ? 'wh' : col, sz: .6 + Math.random() * .9 }); }
  G.parts.push({ ring: 1, x: px, y: py, l: 0, m: .3, k: col });
}
function hitPlayer() {
  if (G.inv > 0 || G.dead > 0 || G.god) return;
  if (G.shield) { G.shield = false; G.inv = 1; SFX.shield(); G.parts.push({ ring: 1, x: G.px, y: G.py, l: 0, m: .4, k: 'cy' }); return; }
  boom(G.px, G.py, 'cy', 40); boom(G.px, G.py, 'or', 20); SFX.die(); G.shake = .5; G.lives--; G.miss++; G.dead = 1.8; G.power = Math.max(1, G.power - 1); G.eb = [];
}
function fire() {
  const p = G.power, y = G.py - 14, S = 640;
  const add = (dx, a) => { G.pb.push({ x: G.px + dx, y, vx: Math.sin(a) * S, vy: -Math.cos(a) * S }); G.shots++; };
  if (p === 1) add(0, 0); else if (p === 2) { add(-6, 0); add(6, 0); } else if (p === 3) { add(0, 0); add(-6, -.14); add(6, .14); } else { add(-5, 0); add(5, 0); add(-8, -.16); add(8, .16); add(-10, -.32); add(10, .32); }
  SFX.shot();
}
function update(dt) {
  G.t += dt; G.st += dt; const D = G.D;
  if (G.mode !== 'play') { stepFx(dt); return; }
  // 플레이어
  if (G.dead > 0) {
    G.dead -= dt;
    if (G.dead <= 0) { if (G.lives <= 0) return gameOver(); G.px = W / 2; G.py = H - 70; G.inv = 2.2; if (ptr && !ptr.mouse) { ptr.sx = ptr.tx; ptr.sy = ptr.ty; ptr.px = G.px; ptr.py = G.py; } }
  } else {
    const sp = 260; let mx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), my = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (mx || my) { G.px += mx * sp * dt; G.py += my * sp * dt; if (ptr && ptr.mouse) ptr.active = false; }
    else if (ptr && ptr.mouse && ptr.active) { const dx = ptr.tx - G.px, dy = ptr.ty - G.py, d = Math.hypot(dx, dy), mv = Math.min(d, 620 * dt); if (d > .5) { G.px += dx / d * mv; G.py += dy / d * mv; } }
    else if (ptr && !ptr.mouse) { G.px = ptr.px + (ptr.tx - ptr.sx) * 1.15; G.py = ptr.py + (ptr.ty - ptr.sy) * 1.15; }
    const nx = clamp(G.px, 14, W - 14), ny = clamp(G.py, H * .45, H - 26);
    if (ptr && !ptr.mouse && (nx !== G.px || ny !== G.py)) { ptr.px += nx - G.px; ptr.py += ny - G.py; }
    G.px = nx; G.py = ny;
    G.inv = Math.max(0, G.inv - dt);
    G.fireT -= dt; if (G.fireT <= 0 && G.clearT <= 0) { fire(); G.fireT = [0, .2, .18, .17, .16][G.power]; }
  }
  // 입장 대기열
  while (G.q.length && G.q[0].t <= G.st) G.en.push(G.q.shift().e);
  // 적
  let diving = 0, formed = [];
  for (const e of G.en) {
    if (e.dead) continue; const ox = e.x, oy = e.y; e.hitT = Math.max(0, e.hitT - dt);
    if (e.st === 'enter' || e.st === 'dive') {
      e.d += (e.st === 'enter' ? D.enter : e.spd) * dt; const done = pathAt(e.path, e);
      if (e.type === 'jelly' && e.st === 'dive') e.x += Math.sin(e.d / 26 + e.ph) * 1.4;
      if (e.st === 'enter' && e.fire > 0 && e.d > e.fire * e.path.len && e.y > 0 && e.y < H * .6) { e.fire = -1; aimShot(e.x, e.y, D.bullet * .85); }
      if (e.st === 'dive') {
        diving++;
        while (e.shots.length && e.d >= e.shots[0]) { e.shots.shift(); if (e.y > 0 && e.y < G.py - 60) { if (e.type === 'guard') for (const s of [-.22, 0, .22]) aimShot(e.x, e.y, D.bullet, s); else aimShot(e.x, e.y, D.bullet, (G.R() - .5) * .1); } }
      }
      if (done) { if (e.oneShot) { e.dead = true; e.gone = true; continue; } if (e.st === 'dive') { e.x = slotPos(e)[0]; e.y = -30; } e.st = 'join'; }
    } else if (e.st === 'join') {
      const [sx, sy] = slotPos(e), dx = sx - e.x, dy = sy - e.y, d = Math.hypot(dx, dy), mv = D.enter * dt;
      if (d <= mv + 1) { e.st = 'form'; e.x = sx; e.y = sy; } else { e.x += dx / d * mv; e.y += dy / d * mv; }
    } else { const p = slotPos(e); e.x = p[0]; e.y = p[1]; formed.push(e); }
    const vx = e.x - ox, vy = e.y - oy;
    const tr = e.st === 'form' ? 0 : (vx || vy) ? Math.atan2(vy, vx) - Math.PI / 2 : e.rot;
    let dr = tr - e.rot; dr = ((dr + Math.PI) % TAU + TAU) % TAU - Math.PI; e.rot += dr * Math.min(1, dt * 10);
    // 몸통 충돌
    if (G.dead <= 0 && e.y > 0 && Math.hypot(e.x - G.px, e.y - G.py) < TYPES[e.type].r * .7 + 7) { if (G.inv <= 0 && !G.god) { kill(e); hitPlayer(); } }
  }
  // 급강하 명령
  const qEmpty = !G.q.length;
  if (formed.length && G.dead <= 0 && G.clearT <= 0) {
    G.diveT -= dt * (qEmpty ? 1 : .5);
    const maxD = formed.length + diving <= 4 ? Math.max(D.divers, 3) : D.divers;
    if (G.diveT <= 0 && diving < maxD) { const e = formed[Math.floor(G.R() * formed.length)]; startDive(e); G.diveT = D.diveGap * (.6 + G.R() * .8); }
    if (D.formFire && qEmpty) { G.formT += dt * D.formFire; if (G.formT >= 1) { G.formT -= 1; const e = formed[Math.floor(G.R() * formed.length)]; aimShot(e.x, e.y, D.bullet * .8, (G.R() - .5) * .2); } }
  }
  if (G.boss) updBoss(dt);
  // 내 총알
  for (const b of G.pb) {
    b.x += b.vx * dt; b.y += b.vy * dt; if (b.y < -20 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }
    for (const e of G.en) { if (e.dead || e.y < 4) continue; const r = TYPES[e.type].r; if (Math.abs(b.x - e.x) < r + 2 && Math.abs(b.y - e.y) < r + 6) { b.dead = true; G.hits++; e.hp--; e.hitT = .08; if (e.hp <= 0) kill(e); else SFX.hit(); break; } }
    const B = G.boss; if (!b.dead && B && !B.enter && B.hp > 0 && Math.abs(b.x - B.x) < 48 && Math.abs(b.y - B.y) < 40) { b.dead = true; G.hits++; B.hp--; B.hitT = .06; if (B.hp <= 0) bossDown(); else if (Math.random() < .3) SFX.hit(); }
  }
  G.pb = G.pb.filter(b => !b.dead); G.en = G.en.filter(e => !e.dead);
  // 적 총알
  for (const b of G.eb) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.y > H + 10 || b.y < -20 || b.x < -10 || b.x > W + 10) b.dead = true; else if (G.dead <= 0 && Math.hypot(b.x - G.px, b.y - G.py) < 7) { b.dead = true; hitPlayer(); } }
  G.eb = G.eb.filter(b => !b.dead);
  // 아이템
  for (const c of G.caps) {
    c.t += dt; c.y += 85 * dt; c.x += Math.sin(c.t * 3) * 20 * dt;
    if (G.dead <= 0 && Math.hypot(c.x - G.px, c.y - G.py) < 22) {
      c.dead = true;
      if (c.k === 'P') { if (G.power < 4) { G.power++; G.texts.push({ x: c.x, y: c.y, t: 0, s: 'POWER UP', col: C.ye }); } else { addScore(1000); G.texts.push({ x: c.x, y: c.y, t: 0, s: '1000', col: C.ye }); } SFX.power(); }
      else { G.shield = true; SFX.shield(); G.texts.push({ x: c.x, y: c.y, t: 0, s: 'SHIELD', col: C.cy }); }
    } else if (c.y > H + 20) c.dead = true;
  }
  G.caps = G.caps.filter(c => !c.dead);
  // 클리어
  if (G.clearT > 0) { G.clearT -= dt; if (G.clearT <= 0) startStage(G.stage + 1); }
  else if (!G.q.length && !G.en.length && !G.boss && G.st > 1) {
    const bonus = 300 * G.stage + (G.miss ? 0 : 1000 * Math.ceil(G.stage / 2)); addScore(bonus);
    G.clearT = 2.6; G.clearBonus = bonus; G.eb = []; SFX.life();
  }
  stepFx(dt);
}
function updBoss(dt) {
  const B = G.boss, n = G.stage, D = G.D; B.t += dt; B.hitT = Math.max(0, B.hitT - dt);
  if (B.hp <= 0) return;
  if (B.enter) { B.y += 70 * dt; if (B.y >= 130) B.enter = false; return; }
  B.x = W / 2 + Math.sin(B.t * .6) * 95; B.y = 130 + Math.sin(B.t * 1.1) * 12;
  B.pt -= dt; if (B.pt > 0 || G.dead > 0) return;
  const rage = B.hp < B.max / 2; B.pt = Math.max(1.3, 2.6 - n * .05) * (rage ? .8 : 1);
  B.ph = (B.ph + 1) % 3;
  if (B.ph === 0) { const k = n >= 10 ? 7 : 5; for (let i = 0; i < k; i++) aimShot(B.x, B.y + 30, D.bullet, (i - (k - 1) / 2) * .17); }
  else if (B.ph === 1) { const k = 14 + Math.floor(n / 5) * 2, sp = Math.min(200, 115 + n * 3); for (let i = 0; i < k; i++) { const a = i / k * TAU + B.t; G.eb.push({ x: B.x, y: B.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); } }
  else { for (const s of [-1, 1]) { const e = { type: 'drone', hp: 1, col: 0, row: 0, st: 'dive', x: B.x + s * 54, y: B.y + 10, rot: 0, hitT: 0, ph: 0, oneShot: true }; G.en.push(e); startDive(e); } }
}
function bossDown() {
  const B = G.boss; addScore(4000 + 1000 * G.stage); G.texts.push({ x: B.x, y: B.y, t: 0, s: '' + (4000 + 1000 * G.stage), col: C.ye, big: 1 });
  for (let i = 0; i < 5; i++) boom(B.x + (Math.random() - .5) * 80, B.y + (Math.random() - .5) * 60, ['pu', 'pk', 'cy', 'ye', 'wh'][i], 24);
  SFX.big(); G.shake = .7; G.eb = []; G.boss = null; G.en.forEach(e => { if (e.oneShot) { boom(e.x, e.y, 'cy', 8); e.dead = true; } });
}
function stepFx(dt) {
  for (const p of G.parts) { p.l += dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; } }
  G.parts = G.parts.filter(p => p.l < p.m);
  for (const t of G.texts) t.t += dt; G.texts = G.texts.filter(t => t.t < 1.1);
  G.shake = Math.max(0, G.shake - dt); G.disp += (G.score - G.disp) * Math.min(1, dt * 10);
  for (const s of stars) { s.y += dt * [.02, .05, .11][s.l]; if (s.y > 1) { s.y -= 1; s.x = Math.random(); } }
}

/* ---------- 그리기 ---------- */
function draw() {
  const { s, dpr, ox, oy, cw, ch } = lay;
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = '#02010a'; x.fillRect(0, 0, cw, ch);
  if (ox > 160) sidePanels();
  const sh = G.shake > 0 ? G.shake * 8 : 0, kx = sh ? (Math.random() - .5) * sh : 0, ky = sh ? (Math.random() - .5) * sh : 0;
  x.setTransform(s * dpr, 0, 0, s * dpr, (ox + kx * s) * dpr, (oy + ky * s) * dpr);
  x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
  const ny = (G.t * 12) % H; x.drawImage(SP.neb, 0, ny - H, W, H); x.drawImage(SP.neb, 0, ny, W, H);
  for (const st of stars) { x.fillStyle = ['#ffffff55', '#ffffff99', '#ffffffee'][st.l]; const z = st.l + 1; x.fillRect(st.x * W, st.y * H, z * .8, z * (G.clearT > 0 ? 6 : 1.4)); }
  for (const c of G.caps) spr(x, SP.cap[c.k], c.x, c.y, 0, 1, .75 + .25 * Math.sin(c.t * 10));
  const fr = (G.t * 2.5 | 0) % 2;
  for (const e of G.en) {
    let sp = SP[e.type][fr]; if (e.type === 'prism' && e.hp === 1) sp = SP.prism1[fr]; if (e.type === 'guard' && e.hp < 3) sp = SP.guard1[fr];
    spr(x, sp, e.x, e.y, e.rot, 1, e.hitT > 0 ? .4 : undefined);
    if (e.cap && (G.t * 4 | 0) % 2) spr(x, SP.dot[e.cap === 'P' ? 'ye' : 'cy'], e.x, e.y - 14, 0, .7);
  }
  const B = G.boss;
  if (B) {
    spr(x, SP.bossRing, B.x, B.y, B.t * .5); spr(x, SP.boss, B.x, B.y, 0, 1, B.hitT > 0 ? .55 : undefined);
    const pr = 1 + .15 * Math.sin(B.t * 6); spr(x, SP.dot[B.hp < B.max / 2 ? 'rd' : 'pk'], B.x, B.y, 0, 1.8 * pr);
  }
  if (G.dead <= 0 && G.mode === 'play' && !(G.inv > 0 && (G.t * 12 | 0) % 2)) {
    const fl = .8 + Math.random() * .5; spr(x, SP.flame, G.px - 4, G.py + 15, 0, fl * .8); spr(x, SP.flame, G.px + 4, G.py + 15, 0, fl * .8);
    spr(x, SP.ship, G.px, G.py);
    if (G.shield) { x.strokeStyle = C.cy + 'aa'; x.lineWidth = 2; x.beginPath(); x.arc(G.px, G.py, 21 + Math.sin(G.t * 8), 0, TAU); x.stroke(); }
  }
  for (const b of G.pb) spr(x, SP.pb, b.x, b.y, b.vx ? Math.atan2(b.vx, -b.vy) : 0);
  for (const b of G.eb) spr(x, SP.eb, b.x, b.y);
  x.globalCompositeOperation = 'lighter';
  for (const p of G.parts) {
    const f = 1 - p.l / p.m;
    if (p.ring) { x.globalAlpha = f; x.strokeStyle = C[p.k]; x.lineWidth = 3 * f + .5; x.beginPath(); x.arc(p.x, p.y, 6 + (1 - f) * 34, 0, TAU); x.stroke(); }
    else spr(x, SP.dot[p.k], p.x, p.y, 0, p.sz * (0.5 + f * .7), f);
  }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  for (const t of G.texts) { x.globalAlpha = 1 - t.t / 1.1; x.fillStyle = t.col; x.font = (t.big ? '14px ' : '8px ') + FONT_N; x.textAlign = 'center'; x.fillText(t.s, t.x, t.y - t.t * 30); }
  x.globalAlpha = 1;
  hud();
  x.restore();
  x.strokeStyle = '#ff3d9a55'; x.lineWidth = 1.5 / s; if (ox > 2) { x.beginPath(); x.moveTo(0, 0); x.lineTo(0, H); x.moveTo(W, 0); x.lineTo(W, H); x.stroke(); }
}
function neon(t, px, py, size, col, font, align) {
  x.font = size + 'px ' + (font || FONT_N); x.textAlign = align || 'center'; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 12; x.fillText(t, px, py); x.shadowBlur = 0;
}
function hud() {
  x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '11px ' + FONT_N;
  x.fillText(Math.round(G.disp).toLocaleString(), 10, 24);
  x.fillStyle = '#ffd23f'; x.font = '7px ' + FONT_N; x.fillText('HI ' + Math.max(G.best, G.score).toLocaleString(), 10, 38);
  x.textAlign = 'center'; x.fillStyle = C.pk; x.font = '8px ' + FONT_N; x.fillText('STAGE ' + G.stage, W / 2, 22);
  for (let i = 0; i < Math.min(G.lives - (G.dead > 0 ? 0 : 1), 5); i++) spr(x, SP.ship, 16 + i * 18, H - 14, 0, .45);
  for (let i = 0; i < 4; i++) { x.fillStyle = i < G.power ? C.ye : '#ffffff22'; x.fillRect(W - 60 + i * 12, H - 18, 9, 8); }
  x.fillStyle = '#ffffff88'; x.font = '6px ' + FONT_N; x.textAlign = 'right'; x.fillText('PWR', W - 64, H - 11);
  const B = G.boss; if (B && !B.enter) { x.fillStyle = '#ffffff22'; x.fillRect(W / 2 - 80, 30, 160, 5); x.fillStyle = B.hp < B.max / 2 ? C.rd : C.pu; x.fillRect(W / 2 - 80, 30, 160 * B.hp / B.max, 5); }
  if (G.mode === 'play' && G.st < 2.2 && G.clearT <= 0) {
    const a = Math.min(1, (2.2 - G.st) * 2); x.globalAlpha = a;
    neon('STAGE ' + G.stage, W / 2, H * .42, 18, C.ye);
    neon(G.boss ? '⚠ 마더 헥스 출현' : G.stage === 1 ? '편대를 모두 격추하라!' : '준비!', W / 2, H * .42 + 32, 17, G.boss ? C.rd : C.cy, FONT_K);
    if (G.stage === 1 && G.t < 4) { x.fillStyle = '#ffffffcc'; x.font = '14px ' + FONT_K; x.fillText(matchMedia('(pointer:coarse)').matches ? '화면 아무 데나 끌어서 이동 · 자동 발사' : '마우스나 방향키로 이동 · 자동 발사', W / 2, H * .42 + 62); }
    x.globalAlpha = 1;
  }
  if (G.clearT > 0) { neon('STAGE CLEAR', W / 2, H * .4, 16, C.gr); neon('+' + G.clearBonus.toLocaleString(), W / 2, H * .4 + 28, 12, C.ye); if (!G.miss) neon('NO MISS 보너스', W / 2, H * .4 + 56, 15, C.cy, FONT_K); }
  if (paused) { x.fillStyle = '#02010aaa'; x.fillRect(0, 0, W, H); neon('PAUSE', W / 2, H * .45, 20, C.cy); x.fillStyle = '#fff'; x.font = '15px ' + FONT_K; x.fillText('화면을 누르면 계속', W / 2, H * .45 + 34); }
}
function sidePanels() {
  const { ox, ch, cw } = lay, lx = ox / 2;
  x.textAlign = 'center'; neon('별빛 요격대', lx, ch * .3, Math.min(40, ox / 6), C.pk, FONT_K); neon('STARLIGHT', lx, ch * .3 + 34, 12, C.cy);
  x.fillStyle = '#ffffff99'; x.font = '15px ' + FONT_K;
  ['마우스 또는 방향키·WASD: 이동', '자동 발사', 'P·Esc: 일시정지', '', 'P 캡슐: 무기 강화', 'S 캡슐: 보호막 1회', '5단계마다 보스'].forEach((t, i) => x.fillText(t, lx, ch * .3 + 80 + i * 26));
  const rx = cw - ox / 2; neon('TODAY', rx, ch * .3, 12, C.ye);
  x.fillStyle = '#fff'; x.font = '14px ' + FONT_N; x.fillText(Math.max(G.best, G.score).toLocaleString(), rx, ch * .3 + 34);
  x.fillStyle = '#ffffff99'; x.font = '15px ' + FONT_K; x.fillText('오늘 내 최고 점수', rx, ch * .3 + 62); x.fillText('매일 0시 새 판', rx, ch * .3 + 88);
}

/* ---------- 흐름 ---------- */
function loop(now) {
  raf = requestAnimationFrame(loop);
  let dt = Math.min(.05, (now - last) / 1000 || 0); last = now; if (window.__slDtMax) dt = Math.min(dt, window.__slDtMax);
  if (!paused) { const n = Math.ceil(dt / (1 / 90)); for (let i = 0; i < n; i++) update(dt / n); if (A.ctx) music(!!G.boss); }
  draw();
}
function pause(p) {
  if (!G || G.mode !== 'play') return; paused = p;
  if (A.ctx) { if (p) A.ctx.suspend(); else { A.ctx.resume(); A.next = 0; } }
  last = performance.now();
}
function gameOver() {
  G.mode = 'over'; const acc = G.shots ? Math.round(G.hits / G.shots * 100) : 0, s = G.score;
  const res = { score: s, stage: G.stage, acc }; G.result = res;
  if (!G.debug && s > 0) { opts.submit(s); }
  if (s > G.best) G.best = s;
  panel.innerHTML = '<div><h3>GAME OVER</h3><div class="sc">' + s.toLocaleString() + '</div><p>STAGE ' + G.stage + ' · 명중률 ' + acc + '% · 격추 ' + G.kills + '</p><p>오늘 내 최고 ' + G.best.toLocaleString() + '점</p>'
    + '<button type="button" class="p1" data-k="r">▶ 다시 출격</button><button type="button" class="p2" data-k="s">결과 공유</button><button type="button" class="p3" data-k="x">나가기</button></div>';
  panel.hidden = false;
  panel.onclick = e => { const k = e.target.dataset.k; if (k === 'r') { panel.hidden = true; audioInit(); newGame(); } else if (k === 's') opts.share(s, res); else if (k === 'x') close(); };
}
function fs() {
  const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return;
  const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return;
  try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(() => { try { screen.orientation.lock('portrait').catch(() => {}); } catch (e) {} layout(); }).catch(() => {}); } catch (e) {}
}
function open() {
  ov.hidden = false; document.documentElement.style.overflow = 'hidden';
  fs(); layout(); audioInit(); paused = false; panel.hidden = true; newGame();
  last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function close() {
  cancelAnimationFrame(raf); ov.hidden = true; document.documentElement.style.overflow = ''; panel.hidden = true;
  if (A.ctx) A.ctx.suspend();
  const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} }
  const r = G && G.result; opts.onExit(r || null); G = null; paused = false;
}
function warm() { // 시작 전에 글꼴·스프라이트를 미리 준비 → 첫 프레임 끊김 방지
  RES = clamp(Math.ceil(Math.min(innerWidth / W, innerHeight / H) * Math.min(window.devicePixelRatio || 1, 2)), 2, 4); SP = buildSprites();
  try { document.fonts && document.fonts.load('10px "Press Start 2P"'); document.fonts && document.fonts.load('16px "Black Han Sans"', '별빛'); } catch (e) {}
  ENTRY.forEach(f => f(1));
}
window.StarlightGame = {
  boot(o) {
    opts = o; window.KST_SL = o.day; if (!ov) { mkDom(); warm(); }
    const api = { open };
    if (DEBUG) window.__sl = { open, G: () => G, stage(n) { startStage(n); }, god(b) { G.god = b; }, pause, close, draw: () => draw() };
    return api;
  },
};
})();
