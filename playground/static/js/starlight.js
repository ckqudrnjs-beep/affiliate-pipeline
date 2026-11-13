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
function hexPts(rx, ry, rot) { const p = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + (rot || 0); p.push(Math.cos(a) * rx, Math.sin(a) * ry); } return p; }
function dot(col, r) {
  return sprite(r * 2, r * 2, x => { const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(.25, col); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); });
}
/* 출석 보너스 '내 네온 색'(스킨): 요격기 테두리 색만 바뀌는 꾸미기. 점수·능력과 무관 */
function skinCol() { try { const k = opts && opts.skin && opts.skin(); return (k && k.c && k.c[1]) || C.cy; } catch (e) { return C.cy; } }
function skinDes() { try { return (opts && opts.design && opts.design()) || 'base'; } catch (e) { return 'base'; } }
/* 전설 디자인 '오로라 세라프'(🪙50): 날개 3겹 색이 흐르고(색상별로 미리 그린 12장 돌려 보기) 지나간 자리에 무지개 가루. 판정 동일 */
function auroraFrame(h) {
  return sprite(50, 46, x => {
    const wing = (s, hh, a, l) => { x.beginPath(); x.moveTo(0, -4); x.quadraticCurveTo(s * l * .6, -14 + a, s * l, -2 + a); x.quadraticCurveTo(s * l * .7, 6 + a, s * 4, 8); x.closePath(); x.fillStyle = `hsla(${hh % 360},100%,62%,.45)`; x.fill(); glowStroke(x, `hsl(${hh % 360},100%,70%)`, 1, 6); };
    for (const s of [-1, 1]) { wing(s, h, 6, 22); wing(s, h + 90, 2, 18); wing(s, h + 140, -2, 14); }
    poly(x, [0, -20, 5, -4, 3, 12, 0, 9, -3, 12, -5, -4]); x.fillStyle = '#10163a'; x.fill(); glowStroke(x, '#ffffff', 1.1, 8);
    const g = x.createLinearGradient(0, -12, 0, 0); g.addColorStop(0, '#aef7ff'); g.addColorStop(1, '#d58bff'); x.fillStyle = g; poly(x, [0, -14, 2.4, -5, 0, -1, -2.4, -5]); x.fill();
    x.fillStyle = C.ye; x.beginPath(); x.arc(0, -20.5, 1.3, 0, TAU); x.fill();
  });
}
function setShip(S, c, d) { S.shipCol = c; S.shipDes = d; S.auro = d === 'aurora' ? Array.from({ length: 12 }, (_, i) => auroraFrame(190 + i * 30)) : null; S.ship = S.auro ? S.auro[0] : shipSprite(c, d); }
function shipSprite(col, des) {
  // 디자인 스킨(겉모습만, 맞는 범위 동일): 드래곤 파이터 / 냥냥 요격기 / 원반 UFO
  if (des === 'dragon') return sprite(36, 38, x => {
    poly(x, [0, -17, 3, -11, 7, -16, 6, -7, 5, -1, 16, -6, 13, 3, 17, 8, 9, 9, 5, 13, 0, 18, -5, 13, -9, 9, -17, 8, -13, 3, -16, -6, -5, -1, -6, -7, -7, -16, -3, -11]);
    x.fillStyle = '#1a0b2e'; x.fill(); glowStroke(x, col, 2, 10); x.strokeStyle = '#fff'; x.lineWidth = .8; x.stroke();
    x.strokeStyle = col + 'aa'; x.lineWidth = 1; x.beginPath(); x.moveTo(5, -1); x.lineTo(12, 6); x.moveTo(5, 3); x.lineTo(10, 9); x.moveTo(-5, -1); x.lineTo(-12, 6); x.moveTo(-5, 3); x.lineTo(-10, 9); x.stroke();
    x.fillStyle = C.ye; poly(x, [-3.6, -9, -1, -7.6, -1.4, -6.4, -3.6, -7.4]); x.fill(); poly(x, [3.6, -9, 1, -7.6, 1.4, -6.4, 3.6, -7.4]); x.fill();
    x.fillStyle = C.or; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(0, -2 + i * 4, 1.2, 0, TAU); x.fill(); }
  });
  if (des === 'cat') return sprite(36, 36, x => {
    poly(x, [-9, -17, -3, -10, 3, -10, 9, -17, 10, -5, 15, 6, 14, 12, 5, 10, 0, 13, -5, 10, -14, 12, -15, 6, -10, -5]);
    x.fillStyle = '#0b1a3a'; x.fill(); glowStroke(x, col, 2, 10); x.strokeStyle = '#fff'; x.lineWidth = .8; x.stroke();
    x.fillStyle = '#ff9ec4'; poly(x, [-7.5, -14, -4, -10.5, -8.5, -9.5]); x.fill(); poly(x, [7.5, -14, 4, -10.5, 8.5, -9.5]); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = C.ye; x.beginPath(); x.ellipse(s * 3.6, -5, 2.4, 2.8, 0, 0, TAU); x.fill(); x.fillStyle = '#111'; x.fillRect(s * 3.6 - .5, -7.2, 1, 4.4); }
    x.fillStyle = '#ff9ec4'; poly(x, [-1.4, -1.2, 1.4, -1.2, 0, .6]); x.fill();
    x.strokeStyle = '#ffffffcc'; x.lineWidth = .7; x.beginPath(); for (const s of [-1, 1]) { x.moveTo(s * 5, -.5); x.lineTo(s * 14, -2.5); x.moveTo(s * 5, 1); x.lineTo(s * 14, 2); } x.stroke();
  });
  if (des === 'ufo') return sprite(38, 30, x => {
    x.beginPath(); x.arc(0, -2, 7.5, Math.PI, 0); x.closePath(); x.fillStyle = col + '55'; x.fill(); glowStroke(x, col, 1.5, 8);
    x.fillStyle = '#ffffffaa'; x.beginPath(); x.ellipse(-2.6, -5.5, 1.6, 2.6, -.5, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(0, 2, 17, 6, 0, 0, TAU); x.fillStyle = '#16102e'; x.fill(); glowStroke(x, col, 2, 10); x.strokeStyle = '#fff'; x.lineWidth = .8; x.stroke();
    for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? C.pk : C.ye; x.beginPath(); x.arc(-11 + i * 5.5, 3 + (i === 0 || i === 4 ? -1 : 0), 1.5, 0, TAU); x.fill(); }
    x.fillStyle = col + '88'; x.beginPath(); x.ellipse(0, 9.5, 6, 2, 0, 0, TAU); x.fill();
  });
  return sprite(34, 36, x => {
    poly(x, [0, -16, 5, -6, 5, 4, 14, 10, 14, 14, 4, 11, 0, 14, -4, 11, -14, 14, -14, 10, -5, 4, -5, -6]); x.fillStyle = '#0b1a3a'; x.fill(); glowStroke(x, col, 2, 10);
    x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke(); x.fillStyle = col === C.ye ? C.cy : C.ye; x.beginPath(); x.ellipse(0, -5, 2.4, 4.5, 0, 0, TAU); x.fill();
    x.fillStyle = col === C.pk ? C.cy : C.pk; x.fillRect(-13, 9, 3, 3); x.fillRect(10, 9, 3, 3);
  });
}
function buildSprites() {
  const S = {};
  S.drone = [0, 1].map(f => sprite(34, 30, x => {
    const k = f ? 3 : 0; poly(x, [0, 11, 13, -6 + k, 6, -2, 0, -9, -6, -2, -13, -6 + k]); x.fillStyle = '#05242c'; x.fill(); glowStroke(x, C.cy, 2);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 3, 0, TAU); x.fill(); x.fillStyle = C.pk; x.beginPath(); x.arc(0, 1, 1.5, 0, TAU); x.fill();
  }));
  S.jelly = [0, 1].map(f => sprite(34, 34, x => {
    x.beginPath(); x.arc(0, -3, 11, Math.PI, 0); x.quadraticCurveTo(11, 3, 0, 3); x.quadraticCurveTo(-11, 3, -11, -3); x.closePath(); x.fillStyle = '#2a0618'; x.fill(); glowStroke(x, C.pk, 2);
    x.beginPath(); for (let i = -1.5; i <= 1.5; i++) { const bx = i * 6; x.moveTo(bx, 3); x.quadraticCurveTo(bx + (f ? 4 : -4), 8, bx, 13); } glowStroke(x, C.pk, 1.6, 6);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(-4, -4, 2.2, 0, TAU); x.arc(4, -4, 2.2, 0, TAU); x.fill();
  }));
  const prism = (crack) => [0, 1].map(f => sprite(30, 34, x => {
    poly(x, [0, -13, 10, 0, 0, 13, -10, 0]); x.fillStyle = '#2a2203'; x.fill(); glowStroke(x, C.ye, 2);
    x.beginPath(); x.moveTo(0, -13); x.lineTo(0, 13); x.moveTo(-10, 0); x.lineTo(10, 0); x.strokeStyle = C.ye + (f ? 'cc' : '66'); x.lineWidth = 1; x.stroke();
    if (crack) { x.beginPath(); x.moveTo(-4, -8); x.lineTo(1, -2); x.lineTo(-2, 3); x.lineTo(3, 9); x.strokeStyle = '#fff'; x.lineWidth = 1.4; x.stroke(); }
  }));
  S.prism = prism(false); S.prism1 = prism(true);
  const guard = (col, core) => [0, 1].map(f => sprite(42, 40, x => {
    poly(x, hexPts(13, 13, Math.PI / 6)); x.fillStyle = '#062616'; x.fill(); glowStroke(x, col, 2);
    poly(x, [-13, -4, -19, -9 + (f ? 3 : 0), -17, 6, -12, 5]); glowStroke(x, col, 1.6, 6); poly(x, [13, -4, 19, -9 + (f ? 3 : 0), 17, 6, 12, 5]); glowStroke(x, col, 1.6, 6);
    x.shadowColor = core; x.shadowBlur = 10; x.fillStyle = core; x.beginPath(); x.arc(0, 1, 5, 0, TAU); x.fill(); x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 1, 2, 0, TAU); x.fill();
  }));
  S.guard = guard(C.gr, C.or); S.guard1 = guard(C.or, C.rd);
  // 스플리터(주황 삼각, 터지면 둘로 갈라짐)
  const split = (hurt) => [0, 1].map(f => sprite(34, 32, x => {
    poly(x, [0, 12, 13, -9, 0, -4, -13, -9]); x.fillStyle = '#2a1203'; x.fill(); glowStroke(x, hurt ? C.rd : C.or, 2);
    x.beginPath(); x.moveTo(0, -4); x.lineTo(0, 12); x.strokeStyle = (hurt ? C.rd : C.or) + 'aa'; x.lineWidth = 1.2; x.stroke();
    x.fillStyle = f ? '#fff' : C.ye; x.beginPath(); x.arc(-4, -3, 1.8, 0, TAU); x.arc(4, -3, 1.8, 0, TAU); x.fill();
  }));
  S.split = split(false); S.split1 = split(true);
  S.mini = [0, 1].map(f => sprite(20, 20, x => { poly(x, [0, 7, 7, -5, 0, -2, -7, -5]); x.fillStyle = '#2a1203'; x.fill(); glowStroke(x, C.or, 1.6, 6); x.fillStyle = f ? '#fff' : C.ye; x.fillRect(-1, -2, 2, 2); }));
  // 저격 포드(보라, 조준 연사)
  const sniper = (hurt) => [0, 1].map(f => sprite(34, 34, x => {
    x.beginPath(); x.arc(0, -2, 10, 0, TAU); x.fillStyle = '#1a0630'; x.fill(); glowStroke(x, hurt ? C.rd : C.pu, 2);
    x.fillStyle = '#1a0630'; x.fillRect(-2.5, 6, 5, 9); x.strokeStyle = hurt ? C.rd : C.pu; x.lineWidth = 1.5; x.strokeRect(-2.5, 6, 5, 9);
    x.shadowColor = C.pk; x.shadowBlur = 8; x.fillStyle = f ? '#fff' : C.pk; x.beginPath(); x.arc(0, -2, 4, 0, TAU); x.fill(); x.shadowBlur = 0;
  }));
  S.sniper = sniper(false); S.sniper1 = sniper(true);
  // 모선 1: 마더 헥스
  const hexBoss = (rage) => sprite(130, 120, x => {
    poly(x, hexPts(46, 40)); x.fillStyle = '#14062a'; x.fill(); glowStroke(x, rage ? C.rd : C.pu, 3, 14);
    poly(x, hexPts(30, 26)); glowStroke(x, C.pk, 1.5, 8);
    for (const s of [-1, 1]) { poly(x, [s * 44, -10, s * 62, -22, s * 60, 18, s * 44, 12]); x.fillStyle = '#14062a'; x.fill(); glowStroke(x, rage ? C.or : C.pu, 2, 8); x.fillStyle = C.cy; x.fillRect(s * 54 - 3, 8, 6, 10); }
    x.fillStyle = C.cy; x.fillRect(-14, 34, 6, 10); x.fillRect(8, 34, 6, 10);
    if (rage) { x.beginPath(); x.moveTo(-20, -30); x.lineTo(-8, -12); x.lineTo(-14, 0); x.moveTo(24, 20); x.lineTo(12, 8); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); }
  });
  S.boss0 = [hexBoss(false), hexBoss(true)];
  // 모선 2: 트윈 캐논(가로로 긴 전함, 레이저 포)
  const twin = (rage) => sprite(180, 90, x => {
    poly(x, [-80, -6, -50, -26, 50, -26, 80, -6, 60, 20, -60, 20]); x.fillStyle = '#04182a'; x.fill(); glowStroke(x, rage ? C.rd : C.cy, 3, 14);
    poly(x, [-30, -26, 0, -38, 30, -26]); glowStroke(x, C.cy, 2, 8);
    for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 52, 8, 13, 0, TAU); x.fillStyle = '#04182a'; x.fill(); glowStroke(x, rage ? C.or : C.ye, 2, 8); x.fillStyle = rage ? C.or : C.ye; x.fillRect(s * 52 - 4, 16, 8, 16); }
    poly(x, [-20, 20, 0, 34, 20, 20]); glowStroke(x, C.pk, 2, 8);
    if (rage) { x.beginPath(); x.moveTo(-40, -20); x.lineTo(-28, -4); x.lineTo(-36, 8); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); }
  });
  S.boss1 = [twin(false), twin(true)];
  // 모선 3: 오비트 코어(궤도 방패를 두른 구체)
  const orbit = (rage) => sprite(110, 110, x => {
    x.beginPath(); x.arc(0, 0, 34, 0, TAU); x.fillStyle = '#062616'; x.fill(); glowStroke(x, rage ? C.rd : C.gr, 3, 14);
    x.beginPath(); x.arc(0, 0, 24, 0, TAU); glowStroke(x, C.ye, 1.5, 8);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.beginPath(); x.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); x.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); x.strokeStyle = (rage ? C.rd : C.gr) + 'aa'; x.lineWidth = 1.5; x.stroke(); }
  });
  S.boss2 = [orbit(false), orbit(true)];
  S.orb = sprite(26, 26, x => { x.beginPath(); x.arc(0, 0, 8, 0, TAU); x.fillStyle = '#062616'; x.fill(); glowStroke(x, C.gr, 2, 8); x.fillStyle = C.gr; x.beginPath(); x.arc(0, 0, 3, 0, TAU); x.fill(); });
  S.bossRing = sprite(150, 150, x => { x.setLineDash([10, 8]); x.beginPath(); x.arc(0, 0, 66, 0, TAU); glowStroke(x, C.pu + 'aa', 2, 6); });
  setShip(S, skinCol(), skinDes());
  S.pod = sprite(18, 18, x => { poly(x, [0, -7, 6, 4, 0, 2, -6, 4]); x.fillStyle = '#1a0630'; x.fill(); glowStroke(x, C.pu, 1.6, 8); x.fillStyle = '#fff'; x.fillRect(-1, -2, 2, 2); });
  S.pb = sprite(10, 22, x => { x.shadowColor = C.cy; x.shadowBlur = 8; x.fillStyle = C.cy; x.fillRect(-2, -8, 4, 16); x.shadowBlur = 0; x.fillStyle = '#fff'; x.fillRect(-1, -7, 2, 14); });
  S.lz = sprite(10, 34, x => { x.shadowColor = C.pk; x.shadowBlur = 8; x.fillStyle = C.pk; x.fillRect(-1.8, -15, 3.6, 30); x.shadowBlur = 0; x.fillStyle = '#fff'; x.fillRect(-.8, -14, 1.6, 28); });
  S.ms = sprite(14, 20, x => { poly(x, [0, -7, 3, -2, 3, 6, -3, 6, -3, -2]); x.fillStyle = '#062616'; x.fill(); glowStroke(x, C.gr, 1.5, 6); x.fillStyle = C.or; x.fillRect(-1.5, 6, 3, 3); });
  S.eb = sprite(16, 16, x => { x.shadowColor = C.pk; x.shadowBlur = 8; x.fillStyle = C.pk; x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill(); x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 2, 0, TAU); x.fill(); });
  S.eb2 = sprite(16, 16, x => { x.shadowColor = C.ye; x.shadowBlur = 8; x.fillStyle = C.ye; x.beginPath(); x.arc(0, 0, 3.5, 0, TAU); x.fill(); x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 1.6, 0, TAU); x.fill(); });
  S.cap = {}; for (const k in CAPS) { const [col, t] = CAPS[k]; S.cap[k] = sprite(26, 20, x => { x.beginPath(); x.roundRect ? x.roundRect(-10, -7, 20, 14, 5) : x.rect(-10, -7, 20, 14); x.fillStyle = '#111'; x.fill(); glowStroke(x, col, 2); x.fillStyle = col; x.font = "bold 10px " + FONT_N; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 0.5, 1); }); }
  S.dot = {}; for (const k in C) S.dot[k] = dot(C[k], 8);
  S.flame = dot(C.or, 7);
  const neb = document.createElement('canvas'); neb.width = W; neb.height = H; const n = neb.getContext('2d');
  n.fillStyle = '#04020d'; n.fillRect(0, 0, W, H);
  const blobs = [[60, 120, 160, '#5b1aa855'], [300, 330, 190, '#0e6a8a44'], [140, 520, 170, '#a81a6a40'], [330, 40, 120, '#2a1a8a44']];
  for (const [bx, by, r, col] of blobs) for (const oy of [-H, 0, H]) { const g = n.createRadialGradient(bx, by + oy, 0, bx, by + oy, r); g.addColorStop(0, col); g.addColorStop(1, '#00000000'); n.fillStyle = g; n.fillRect(0, 0, W, H); }
  n.strokeStyle = '#ffffff08'; n.lineWidth = 1; for (let gx = 0; gx <= W; gx += 40) { n.beginPath(); n.moveTo(gx, 0); n.lineTo(gx, H); n.stroke(); } for (let gy = 0; gy < H; gy += 40) { n.beginPath(); n.moveTo(0, gy); n.lineTo(W, gy); n.stroke(); }
  S.neb = neb;
  return S;
}
// 캡슐: P 화력, L 레이저(관통), M 유도 미사일, S 보호막, B 필살기 +1, O 보조기
const CAPS = { P: [C.ye, 'P'], L: [C.pk, 'L'], M: [C.gr, 'M'], S: [C.cy, 'S'], B: [C.or, 'B'], O: [C.pu, 'O'] };
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
// 입장 경로: 전부 화면 위에서 내려온다(BK 11/13). 앞의 2개는 초반용 완만한 길.
const ENTRY = [
  /* S자 폭포 */ m => mkPath([[M(m, 90, -30), M(m, 90, 120), M(m, 300, 140), M(m, 270, 260)], [M(m, 270, 260), M(m, 240, 330), M(m, 120, 300), M(m, 150, 220)]]),
  /* 중앙 분수 */ m => mkPath([[M(m, 180, -30), M(m, 180, 200), M(m, 330, 220), M(m, 300, 120)], [M(m, 300, 120), M(m, 280, 60), M(m, 200, 90), M(m, 200, 160)]]),
  /* 회오리 */ m => mkPath([[M(m, 60, -30), M(m, 60, 200), M(m, 300, 260), M(m, 260, 150)], [M(m, 260, 150), M(m, 230, 80), M(m, 140, 130), M(m, 170, 200)]]),
  /* 교차 */ m => mkPath([[M(m, 300, -30), M(m, 250, 150), M(m, 80, 250), M(m, 70, 300)], [M(m, 70, 300), M(m, 60, 360), M(m, 200, 380), M(m, 200, 260)]]),
  /* 지그재그 */ m => mkPath([[M(m, 40, -30), M(m, 40, 60), M(m, 320, 60), M(m, 320, 140)], [M(m, 320, 140), M(m, 320, 220), M(m, 60, 200), M(m, 60, 280)], [M(m, 60, 280), M(m, 60, 340), M(m, 200, 330), M(m, 180, 250)]]),
  /* 나선 */ m => mkPath([[M(m, 180, -30), M(m, 180, 80), M(m, 320, 120), M(m, 260, 220)], [M(m, 260, 220), M(m, 180, 300), M(m, 80, 220), M(m, 130, 150)], [M(m, 130, 150), M(m, 170, 100), M(m, 230, 160), M(m, 190, 200)]]),
];
const LAYOUTS = ['grid', 'v', 'arc', 'wave'];

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
const now = () => A.ctx && A.ctx.currentTime;
const SFX = {
  shot(k) { const c = A.ctx; if (!c || c.currentTime - A.lastShot < .09) return; A.lastShot = c.currentTime; if (k === 'L') tone('sawtooth', 2000, 1200, .05, .03); else if (k === 'M') noise(.08, .06, 2500, 'bandpass'); else tone('triangle', 1300, 600, .05, .05); },
  hit() { tone('square', 340, 220, .04, .04); },
  block() { tone('square', 900, 700, .03, .03); },
  kill() { noise(.28, .3, 1600); tone('sawtooth', 240, 60, .18, .05); },
  big() { noise(1.1, .5, 900); tone('sawtooth', 160, 30, 1, .12); },
  die() { noise(.9, .45, 1200); tone('sawtooth', 500, 40, .9, .1); },
  power() { const t = now(); [660, 880, 1320].forEach((f, i) => tone('square', f, f, .08, .06, t + i * .06)); },
  shield() { tone('sine', 300, 900, .3, .12); },
  life() { const t = now(); [523, 659, 784, 1046, 1318].forEach((f, i) => tone('square', f, f, .1, .06, t + i * .07)); },
  stage() { const t = now(); [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, .16, .12, t + i * .1)); },
  warn() { const t = now(); for (let i = 0; i < 4; i++) tone('square', i % 2 ? 330 : 440, i % 2 ? 330 : 440, .18, .07, t + i * .2); },
  nova() { noise(1.4, .6, 600); tone('sine', 80, 30, 1.2, .3); const t = now(); [1046, 1318, 1568].forEach((f, i) => tone('triangle', f, f / 2, .5, .07, t + i * .05)); },
  beam() { tone('sawtooth', 120, 90, .7, .08); noise(.7, .12, 3000, 'highpass'); },
  charge() { tone('sine', 200, 800, .8, .05); },
};
const BASS = [45, 41, 48, 43], PAT = [0, 0, 12, 0, 0, 7, 12, 0];
function music(fast) {
  const c = A.ctx; if (!c || A.muted) return; const st = 60 / (fast ? 132 : 116) / 4;
  if (A.next < c.currentTime) A.next = c.currentTime + .05;
  while (A.next < c.currentTime + .25) {
    const s = A.step % 32, root = BASS[s >> 3] + (fast ? 2 : 0), n = root + PAT[s & 7], f = 440 * Math.pow(2, (n - 69) / 12), t = A.next;
    const o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 700;
    g.gain.setValueAtTime(.09, t); g.gain.exponentialRampToValueAtTime(.001, t + st * .9); o.connect(fl); fl.connect(g); g.connect(A.mus); o.start(t); o.stop(t + st);
    if (s % 4 === 0) tone('sine', 130, 45, .14, .35, t, A.mus);
    if (s % 2 === 1) noise(.04, .05, 7000, 'highpass', t, A.mus);
    A.next += st; A.step++;
  }
}

/* ---------- 화면 ---------- */
let ov, cv, x, hudBtns, bombBtn, panel, opts, G = null, raf = 0, paused = false, last = 0, lay = { s: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
let stars = [];
function css() {
  const st = document.createElement('style');
  st.textContent = '.sl-ov{position:fixed;inset:0;z-index:9999;background:#02010a;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}.sl-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.sl-btns{position:absolute;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));display:flex;gap:6px;z-index:2}.sl-btns button{width:38px;height:38px;border-radius:10px;border:1px solid #ffffff44;background:#0c0620cc;color:#fff;font-size:16px;cursor:pointer}'
    + '.sl-bomb{position:absolute;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));z-index:2;width:58px;height:58px;opacity:.85;border-radius:50%;border:2px solid #ff8a3d;background:#2a1203aa;color:#fff;font:800 13px/1.15 system-ui,sans-serif;box-shadow:0 0 16px #ff8a3d88;cursor:pointer;touch-action:none}.sl-bomb b{display:block;font-size:17px}.sl-bomb[disabled]{opacity:.35;box-shadow:none}'
    + '.sl-pn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;background:#02010acc}.sl-pn>div{width:min(320px,86vw);text-align:center;color:#fff;background:#0c0620;border:2px solid #ff3d9a;border-radius:16px;padding:20px 16px;box-shadow:0 0 30px #ff3d9a66}'
    + '.sl-pn h3{font-family:' + FONT_N + ';font-size:18px;color:#ffd23f;margin:4px 0 14px;text-shadow:0 0 12px #ffd23f}.sl-pn .sc{font-family:' + FONT_N + ';font-size:22px;color:#22d3ee;margin:6px 0;text-shadow:0 0 10px #22d3ee}.sl-pn p{margin:6px 0;font-size:14px;color:#cfc8ff}'
    + '.sl-pn button{display:block;width:100%;margin:8px 0 0;padding:12px;border-radius:12px;border:0;font-size:16px;font-weight:800;cursor:pointer}.sl-pn .p1{background:#ffd23f;color:#1a0f00;box-shadow:0 4px 0 #b8860b}.sl-pn .p2{background:#ff3d9a;color:#fff}.sl-pn .p3{background:#ffffff1a;color:#fff}.sl-pn .p4{background:#3ddc84;color:#04220f;box-shadow:0 4px 0 #15803d}.sl-pn .p5{font-size:12px;color:#ffd23f;margin:10px 0 0}';
  document.head.appendChild(st);
}
function mkDom() {
  css();
  ov = document.createElement('div'); ov.className = 'sl-ov'; ov.hidden = true;
  cv = document.createElement('canvas'); x = cv.getContext('2d', { alpha: false }); ov.appendChild(cv);
  hudBtns = document.createElement('div'); hudBtns.className = 'sl-btns';
  hudBtns.innerHTML = '<button type="button" data-k="m" aria-label="소리"></button><button type="button" data-k="p" aria-label="일시정지">Ⅱ</button><button type="button" data-k="x" aria-label="나가기">✕</button>';
  ov.appendChild(hudBtns);
  bombBtn = document.createElement('button'); bombBtn.type = 'button'; bombBtn.className = 'sl-bomb'; bombBtn.setAttribute('aria-label', '필살기');
  ov.appendChild(bombBtn);
  bombBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); audioInit(); if (paused) pause(false); else bomb(); });
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
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode === 'play' && !paused) pause(true, true); });
  addEventListener('blur', () => { if (!ov.hidden && G && G.mode === 'play' && !paused && !DEBUG) pause(true, true); });
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
  bombBtn.style.display = matchMedia('(pointer:coarse)').matches ? '' : 'none';
}

/* ---------- 입력 ---------- */
const keys = {}; let ptr = null;
function toField(e) { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left - lay.ox) / lay.s, (e.clientY - b.top - lay.oy) / lay.s]; }
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; const k = e.key;
    if (/^Arrow|^[wasdWASD ]$/.test(k)) e.preventDefault();
    if (k === 'Escape' || k === 'p' || k === 'P') { if (G && G.mode === 'play') pause(!paused); return; }
    if (paused && G && G.mode === 'play') { pause(false); return; }
    if ((k === ' ' || k === 'x' || k === 'X' || k === 'b' || k === 'B') && !e.repeat) { bomb(); return; }
    keys[k.length === 1 ? k.toLowerCase() : k] = 1;
  });
  addEventListener('keyup', e => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = 0; });
  ov.addEventListener('pointerdown', e => {
    if (paused) { pause(false); return; }
    audioInit(); const [fx, fy] = toField(e);
    if (e.pointerType === 'mouse' && e.button === 2) { bomb(); return; }
    if (e.pointerType !== 'mouse' && ptr && !ptr.mouse) return; // 두 번째 손가락은 무시
    ptr = { id: e.pointerId, mouse: e.pointerType === 'mouse', sx: fx, sy: fy, px: G ? G.px : 0, py: G ? G.py : 0, tx: fx, ty: fy, active: true };
    try { ov.setPointerCapture(e.pointerId); } catch (er) {}
  });
  ov.addEventListener('pointermove', e => {
    const [fx, fy] = toField(e);
    if (e.pointerType === 'mouse') { if (!ptr || !ptr.mouse) ptr = { mouse: true, tx: fx, ty: fy }; ptr.tx = fx; ptr.ty = fy; ptr.active = true; return; }
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
  split: { hp: 2, pts: 250, r: 12, col: 'or' }, mini: { hp: 1, pts: 80, r: 8, col: 'or' },
  sniper: { hp: 2, pts: 400, r: 11, col: 'pu' },
};
const BOSSES = [
  { name: '마더 헥스', col: C.pu, w: 48, h: 40 },
  { name: '트윈 캐논', col: C.cy, w: 80, h: 26 },
  { name: '오비트 코어', col: C.gr, w: 34, h: 34 },
];
const SPX = 36, SPY = 30, TOP = 96, COLS = 8;
// 졸개 난이도: 1~10단계는 기존 그대로, 11단계부터 단계마다 조금씩 계속 오른다(BK 11/13: 보스만 강해지고 졸개는 그대로라는 피드백).
function diff(n) {
  const k = Math.max(0, n - 10); // 10단계 이후 초과분
  return {
    enter: Math.min(380, 215 + Math.min(n, 15) * 8 + Math.max(0, n - 15) * 3),
    diveGap: n <= 10 ? Math.max(.7, 2.9 - n * .18) : Math.max(.3, .85 - k * .028),
    divers: n <= 10 ? Math.min(8, 1 + Math.ceil(n / 1.5)) : Math.min(14, 8 + Math.floor(k / 2)),
    dive: n <= 10 ? Math.min(300, 165 + n * 10) : Math.min(370, 265 + k * 5),
    bullet: n <= 10 ? Math.min(295, 135 + n * 10) : Math.min(360, 235 + k * 5),
    formFire: n < 4 ? 0 : n <= 10 ? Math.min(1.2, (n - 3) * .12) : Math.min(2.6, .84 + k * .09),
    enterFire: n < 3 ? 0 : Math.min(.9, .1 * (n - 2)),
    extraShots: Math.min(3, Math.floor(k / 5)),          // 15·20·25단계마다 돌진 사격 +1발
    spread: n >= 13,                                     // 13단계부터 드론·해파리도 2~3갈래 사격
    burst: Math.min(6, 3 + Math.floor(k / 5)),           // 저격 포드 연사 수
    ringN: n <= 10 ? Math.min(14, (6 + n) >> 1 << 1) : Math.min(20, 14 + (k >> 2) * 2),               // 가디언 원형탄 수
    mult: 1 + (n - 1) * .1, hpUp: n >= 25 ? 2 : n >= 15 ? 1 : 0, hpAll: n >= 30 ? 1 : 0,
  };
}
function newGame() {
  G = { mode: 'play', stage: 0, score: 0, disp: 0, lives: 3, power: 1, wpn: 'P', pods: 0, bombs: 2, charge: 0, shield: false, px: W / 2, py: H - 70, inv: 0, fireT: 0, dead: 0,
    en: [], pb: [], eb: [], beams: [], parts: [], caps: [], texts: [], q: [], t: 0, shake: 0, flash: 0, nova: null, nextLife: 30000, shots: 0, hits: 0, kills: 0, boss: null, debug: DEBUG, god: false,
    podPos: [[W / 2, H - 70], [W / 2, H - 70]], pauseLeft: 1, cd: 0, autoP: false };
  try { G.best = +localStorage.getItem('nr_best_starlight_' + window.KST_SL) || 0; } catch (e) { G.best = 0; }
  startStage(1);
}
function startStage(n) {
  if (n >= 5 && !G.debug && opts.bonus && opts.bonus.ach) opts.bonus.ach('sl5'); // 업적 보너스 코인(1번만)
  G.stage = n; G.st = 0; G.clearT = 0; G.miss = 0; G.D = diff(n); G.R = opts.rng(n); G.diveT = 2.5; G.formT = 0; G.eb = []; G.beams = []; G.q = []; G.boss = null;
  G.layout = LAYOUTS[(n - 1) % LAYOUTS.length];
  const R = G.R, D = G.D;
  SFX.stage();
  if (n % 5 === 0) { // 모선 스테이지: 3종 순환, 바퀴마다 강해짐
    const k = (n / 5 - 1) % 3, tier = Math.floor((n / 5 - 1) / 3), hp = 70 + n * 10;
    G.boss = { kind: k, tier, x: W / 2, y: -90, hp, max: hp, t: 0, ph: 0, pt: 3, enter: true, hitT: 0, rage: false, spin: 0, spiral: 0, orbs: k === 2 ? 6 + tier * 2 : 0, vx: 0 };
    setTimeout(() => SFX.warn(), 600);
    return;
  }
  // 편대 구성
  const slots = [];
  const gN = n >= 4 ? 4 : n >= 2 ? 2 : 0; for (let i = 0; i < gN; i++) slots.push({ type: 'guard', col: gN === 4 ? 2 + i : 3 + i, row: 0 });
  const prisms = n >= 3 ? Math.min(8, 2 + (n - 3) * 2) : 0; let pc = 0;
  const snipers = n >= 9 ? (n >= 13 ? 4 : 2) : 0;
  for (const row of n >= 2 ? [1, 2] : [2]) for (let c = 0; c < COLS; c++) {
    let type = 'jelly';
    if (row === 1 && snipers && (c === 0 || c === 7 || (snipers > 2 && (c === 1 || c === 6)))) type = 'sniper';
    else if (row === 1 && pc < prisms && (c % 2 === (n & 1) || prisms > 4)) { pc++; type = 'prism'; }
    slots.push({ type, col: c, row });
  }
  const splits = n >= 7 ? Math.min(8, 2 + (n - 7)) : 0;
  for (const row of [3, 4]) for (let c = 0; c < COLS; c++) slots.push({ type: row === 4 && c < splits ? (c % 2 ? 'split' : 'split') : 'drone', col: row === 4 && c < splits ? [3, 4, 2, 5, 1, 6, 0, 7][c] : c, row });
  // 스플리터 열 배치가 겹치지 않게 정리
  const used = new Set(); for (const s of slots) { const key = s.row + ':' + s.col; if (used.has(key)) { for (let c = 0; c < COLS; c++) if (!used.has(s.row + ':' + c)) { s.col = c; break; } } used.add(s.row + ':' + s.col); }
  // 아이템 운반: P 1개 + 무기(L/M) 1개(2단계~), S(3단계~), B(2단계~), O(4단계~ 짝수 단계)
  const carry = ['P']; if (n >= 2) carry.push(R() < .5 ? 'L' : 'M', 'B'); else carry.push('P'); if (n >= 3) carry.push('S'); if (n >= 4 && n % 2 === 0) carry.push('O');
  for (const k of carry) { for (let tries = 0; tries < 10; tries++) { const s = slots[Math.floor(R() * slots.length)]; if (!s.cap) { s.cap = k; break; } } }
  // 비행 그룹(최대 8)으로 나눠 입장
  const groups = []; for (let i = 0; i < slots.length; i += 8) groups.push(slots.slice(i, i + 8));
  let t = 1.6; const nT = n <= 2 ? 2 : n <= 5 ? 5 : ENTRY.length;
  groups.forEach((g, gi) => {
    const tpl = Math.floor(R() * nT), m = gi % 2 ? -1 : 1, dual = n >= 2 && R() < .5;
    g.forEach((s, i) => {
      const mm = dual ? (i % 2 ? -m : m) : m, k = dual ? i >> 1 : i;
      const fire = n >= 3 && R() < D.enterFire ? .5 + R() * .3 : -1;
      G.q.push({ t: t + k * .15, e: { ...s, hp: TYPES[s.type].hp + (s.type !== 'drone' && s.type !== 'jelly' ? D.hpUp : D.hpAll), st: 'enter', path: ENTRY[tpl](mm), d: 0, pi: 0, x: -99, y: -99, rot: 0, fire, hitT: 0, ph: R() * TAU, snT: 2 + R() * 3 } });
    });
    t += dual ? 1.3 + (g.length >> 1) * .15 : 1.4 + g.length * .15;
  });
  G.q.sort((a, b) => a.t - b.t);
}
function slotPos(e) {
  const br = 1 + .06 * Math.sin(G.t * 1.3), sway = Math.sin(G.t * .55) * 22, dc = e.col - (COLS - 1) / 2;
  let dy = 0; const L = G.layout;
  if (L === 'v') dy = Math.abs(dc) * 7; else if (L === 'arc') dy = -dc * dc * 2 + 24; else if (L === 'wave') dy = Math.sin(e.col * .9 + G.t * 1.6) * 9;
  return [W / 2 + dc * SPX * br + sway, TOP + e.row * SPY * (1 + .03 * Math.sin(G.t * 1.3)) + dy];
}
function aimShot(sx, sy, spd, spread, alt) {
  const a = Math.atan2(G.py - sy, G.px - sx) + (spread || 0);
  G.eb.push({ x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alt });
}
function ring(sx, sy, k, spd, off) { for (let i = 0; i < k; i++) { const a = i / k * TAU + (off || 0); G.eb.push({ x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd }); } }
function startDive(e, tx0, delay) {
  const R = G.R, D = G.D, n = G.stage, m = e.x < W / 2 ? -1 : 1, tx = tx0 !== undefined ? tx0 : clamp(G.px + (R() - .5) * 70, 30, W - 30);
  const p0 = [e.x, e.y], b = [e.x + m * 55, e.y + 60];
  const hop = [p0, [e.x + m * 40, e.y - 50], [e.x + m * 85, e.y + 5], b];
  let segs, kind = 'std';
  if (e.type === 'split' || e.type === 'mini') { // 자폭 돌진: 짧게 떠올랐다가 내 위치로 직진
    const ax = clamp(G.px, 20, W - 20), dx = ax - e.x, dy = G.py - e.y, k = (H + 60 - e.y) / Math.max(40, dy);
    segs = [[p0, [e.x, e.y - 30], [e.x + dx * .2, e.y], [e.x + dx * .4, e.y + dy * .4]], [[e.x + dx * .4, e.y + dy * .4], [e.x + dx * .7, e.y + dy * .7], [e.x + dx * k * .9, e.y + dy * k * .9], [e.x + dx * k, H + 50]]];
    kind = 'kami';
  } else if (e.type === 'guard' && n >= 6) { // 호버 사격: 화면 중간에 멈춰 원형탄
    segs = [hop, [b, [b[0] - m * 20, b[1] + 120], [tx, H * .45 - 60], [tx, H * .45]]]; kind = 'hover';
  } else if (e.type === 'prism' && n >= 4) { // 바닥 튕기기
    segs = [hop, [b, [b[0] - m * 20, b[1] + 160], [tx, H * .78], [tx - m * 30, H * .72]], [[tx - m * 30, H * .72], [tx - m * 80, H * .55], [tx - m * 60, 120], [tx - m * 40, -40]]];
  } else if (e.type === 'jelly' && n >= 8) { // 루프 비행
    const cy = H * .42;
    segs = [hop, [b, [b[0], b[1] + 100], [tx, cy - 80], [tx, cy]], [[tx, cy], [tx, cy + 55], [tx + m * 70, cy + 55], [tx + m * 70, cy]], [[tx + m * 70, cy], [tx + m * 70, cy - 55], [tx, cy - 55], [tx, cy]], [[tx, cy], [tx, cy + 120], [tx - m * 40, H * .8], [tx - m * 60, H + 40]]];
  } else segs = [hop, [b, [b[0] - m * 25, b[1] + 180], [tx, H * .6], [clamp(tx + (R() - .5) * 140, 10, W - 10), H + 40]]];
  e.path = mkPath(segs); e.d = -(delay || 0); e.pi = 0; e.st = 'dive'; e.kind = kind; e.spd = D.dive * (e.type === 'drone' ? 1.05 : kind === 'kami' ? 1.35 : 1);
  const shots = kind === 'kami' ? 0 : n === 1 ? (R() < .35 ? 1 : 0) : n < 4 ? 1 : n < 7 ? 1 + (R() < .5 ? 1 : 0) : 2 + (R() < (n > 10 ? .7 : .4) ? 1 : 0) + D.extraShots;
  e.shots = []; for (let i = 0; i < shots; i++) e.shots.push((.25 + R() * .3 + i * .08) * e.path.len);
}
function addScore(p) {
  G.score += p;
  if (G.score >= G.nextLife) { G.nextLife += 80000; if (G.lives < 5) { G.lives++; SFX.life(); G.texts.push({ x: W / 2, y: H * .45, t: 0, s: '1UP!', col: C.gr, big: 1 }); } }
}
function kill(e, quiet) {
  const T = TYPES[e.type], diving = e.st === 'dive' || e.st === 'hover', base = T.pts * (diving && !quiet ? 2 : 1);
  const pts = Math.round(base * G.D.mult / 10) * 10; addScore(pts);
  if (!quiet && (diving || e.type === 'guard' || e.type === 'sniper')) G.texts.push({ x: e.x, y: e.y, t: 0, s: '' + pts, col: C.ye });
  boom(e.x, e.y, T.col, e.type === 'guard' ? 26 : 16); if (!quiet) SFX.kill(); G.kills++;
  if (e.cap) G.caps.push({ x: e.x, y: e.y, k: e.cap, t: 0 });
  if (e.type === 'split' && e.y > 0) for (const s of [-1, 1]) { const m = { type: 'mini', hp: 1, col: 0, row: 0, st: 'dive', x: e.x + s * 8, y: e.y, rot: 0, hitT: 0, ph: 0, oneShot: true }; G.en.push(m); startDive(m, clamp(G.px + s * 40, 20, W - 20)); }
  e.dead = true;
  if (++G.charge >= 40) { G.charge = 0; if (G.bombs < 5) { G.bombs++; SFX.charge(); G.texts.push({ x: G.px, y: G.py - 30, t: 0, s: '필살기 +1', col: C.or, k: 1 }); } }
}
function boom(px, py, col, n) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 40 + Math.random() * 170; if (G.parts.length < 420) G.parts.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, m: .35 + Math.random() * .45, k: Math.random() < .3 ? 'wh' : col, sz: .6 + Math.random() * .9 }); }
  G.parts.push({ ring: 1, x: px, y: py, l: 0, m: .3, k: col });
}
function hitPlayer() {
  if (G.inv > 0 || G.dead > 0 || G.god) return;
  if (G.shield) { G.shield = false; G.inv = 1; SFX.shield(); G.parts.push({ ring: 1, x: G.px, y: G.py, l: 0, m: .4, k: 'cy' }); return; }
  boom(G.px, G.py, 'cy', 40); boom(G.px, G.py, 'or', 20); SFX.die(); G.shake = .5; G.lives--; G.miss++; G.dead = 1.8; G.power = Math.max(1, G.power - 1); G.pods = 0; G.eb = []; G.beams = [];
}
// 필살기 '노바 버스트': 화면의 적탄 삭제 + 모든 적 큰 피해 + 보스 체력 8%
function bomb() {
  if (!G || G.mode !== 'play' || paused || G.cd > 0 || G.dead > 0 || G.bombs <= 0 || G.nova) return;
  G.bombs--; G.nova = { x: G.px, y: G.py, t: 0 }; G.inv = Math.max(G.inv, 1.4); G.flash = .35; G.shake = .4;
  for (const b of G.eb) boom(b.x, b.y, 'pk', 2);
  G.eb = []; G.beams = []; SFX.nova();
}
function novaHit() {
  for (const e of G.en) if (!e.dead && e.y > -5) { e.hp -= 4; if (e.hp <= 0) kill(e, true); else e.hitT = .2; }
  const B = G.boss; if (B && !B.enter && B.hp > 0) { B.hp -= Math.ceil(B.max * .08); B.hitT = .3; if (B.hp <= 0) bossDown(); }
}
function nearest(px, py) {
  let best = null, bd = 1e9; for (const e of G.en) { if (e.dead || e.y < 0) continue; const d = (e.x - px) ** 2 + (e.y - py) ** 2; if (d < bd) { bd = d; best = e; } }
  const B = G.boss; if (B && !B.enter && B.hp > 0) { const d = (B.x - px) ** 2 + (B.y - py) ** 2; if (d < bd || !best) best = B; }
  return best;
}
function fire() {
  const p = G.power, y = G.py - 14, w = G.wpn;
  const add = (dx, a, k, S, dmg) => { G.pb.push({ x: G.px + dx, y, vx: Math.sin(a) * S, vy: -Math.cos(a) * S, k, dmg: dmg || 1, hitList: k === 'L' ? [] : null }); G.shots++; };
  if (w === 'L') { // 레이저: 관통, 빠름
    const S = 900; if (p === 1) add(0, 0, 'L', S); else if (p === 2) { add(-5, 0, 'L', S); add(5, 0, 'L', S); } else if (p === 3) { add(0, 0, 'L', S); add(-9, -.05, 'L', S); add(9, .05, 'L', S); } else { add(-4, 0, 'L', S); add(4, 0, 'L', S); add(-11, -.09, 'L', S); add(11, .09, 'L', S); }
  } else if (w === 'M') { // 유도 미사일 + 기본탄
    add(0, 0, 'P', 640);
    G.mT = (G.mT || 0) + 1; if (G.mT % 2 === 0) { const k = p >= 3 ? 4 : 2; for (let i = 0; i < k; i++) { const s = i % 2 ? 1 : -1, a = s * (.5 + (i >> 1) * .35); G.pb.push({ x: G.px + s * 8, y: G.py, vx: Math.sin(a) * 260, vy: -Math.cos(a) * 260, k: 'M', dmg: 2, tt: 0 }); G.shots++; } }
    if (p >= 2) { add(-8, -.1, 'P', 640); add(8, .1, 'P', 640); }
  } else {
    const S = 640;
    if (p === 1) add(0, 0, 'P', S); else if (p === 2) { add(-6, 0, 'P', S); add(6, 0, 'P', S); } else if (p === 3) { add(0, 0, 'P', S); add(-6, -.14, 'P', S); add(6, .14, 'P', S); } else { add(-5, 0, 'P', S); add(5, 0, 'P', S); add(-8, -.16, 'P', S); add(8, .16, 'P', S); add(-10, -.32, 'P', S); add(10, .32, 'P', S); }
  }
  for (let i = 0; i < G.pods; i++) { const [qx, qy] = G.podPos[i]; G.pb.push({ x: qx, y: qy - 8, vx: 0, vy: -620, k: 'P', dmg: 1 }); G.shots++; }
  SFX.shot(w);
}
function takeCap(c) {
  const k = c.k; let txt = '';
  if (k === 'P') { if (G.power < 4) { G.power++; txt = 'POWER UP'; } else { addScore(1000); txt = '1000'; } SFX.power(); }
  else if (k === 'L' || k === 'M') { if (G.wpn === k) { if (G.power < 4) G.power++; else addScore(1000); } G.wpn = k; txt = k === 'L' ? 'LASER' : 'MISSILE'; SFX.power(); }
  else if (k === 'S') { G.shield = true; SFX.shield(); txt = 'SHIELD'; }
  else if (k === 'B') { if (G.bombs < 5) G.bombs++; else addScore(1000); SFX.charge(); txt = 'BOMB +1'; }
  else if (k === 'O') { if (G.pods < 2) { G.pods++; G.podPos[G.pods - 1] = [G.px, G.py]; } else addScore(1000); SFX.power(); txt = 'OPTION'; }
  G.texts.push({ x: c.x, y: c.y, t: 0, s: txt, col: CAPS[k][0] });
}
function update(dt) {
  G.t += dt; G.st += dt; const D = G.D;
  if (G.mode !== 'play') { stepFx(dt); return; }
  // 플레이어
  if (G.dead > 0) {
    G.dead -= dt;
    if (G.dead <= 0) { if (G.lives <= 0) return gameOver(); G.px = W / 2; G.py = H - 70; G.inv = 2.2; G.bombs = Math.max(G.bombs, 2); if (ptr && !ptr.mouse) { ptr.sx = ptr.tx; ptr.sy = ptr.ty; ptr.px = G.px; ptr.py = G.py; } }
  } else {
    const sp = 260; let mx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), my = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (mx || my) { G.px += mx * sp * dt; G.py += my * sp * dt; if (ptr && ptr.mouse) ptr.active = false; }
    else if (ptr && ptr.mouse && ptr.active) { const dx = ptr.tx - G.px, dy = ptr.ty - G.py, d = Math.hypot(dx, dy), mv = Math.min(d, 620 * dt); if (d > .5) { G.px += dx / d * mv; G.py += dy / d * mv; } }
    else if (ptr && !ptr.mouse) { G.px = ptr.px + (ptr.tx - ptr.sx) * 1.15; G.py = ptr.py + (ptr.ty - ptr.sy) * 1.15; }
    const nx = clamp(G.px, 14, W - 14), ny = clamp(G.py, H * .45, H - 26);
    if (ptr && !ptr.mouse && (nx !== G.px || ny !== G.py)) { ptr.px += nx - G.px; ptr.py += ny - G.py; }
    G.px = nx; G.py = ny;
    G.inv = Math.max(0, G.inv - dt);
    for (let i = 0; i < G.pods; i++) { const tx = G.px + (i ? 26 : -26), ty = G.py + 10, q = G.podPos[i], f = Math.min(1, dt * 9); q[0] += (tx - q[0]) * f; q[1] += (ty - q[1]) * f; }
    G.fireT -= dt; if (G.fireT <= 0 && G.clearT <= 0) { fire(); G.fireT = G.wpn === 'L' ? [0, .15, .14, .13, .13][G.power] : [0, .2, .18, .17, .16][G.power]; }
  }
  // 필살기 파동
  if (G.nova) { const nv = G.nova; nv.t += dt; if (!nv.hit && nv.t > .12) { nv.hit = 1; novaHit(); } if (nv.t > .8) G.nova = null; }
  G.flash = Math.max(0, G.flash - dt);
  while (G.q.length && G.q[0].t <= G.st) G.en.push(G.q.shift().e);
  // 적
  let diving = 0; const formed = [];
  for (const e of G.en) {
    if (e.dead) continue; const ox = e.x, oy = e.y; e.hitT = Math.max(0, e.hitT - dt);
    if (e.st === 'dive' && e.d < 0) { e.d += e.spd * dt; if (e.d < 0) { const p = slotPos(e); e.x = p[0]; e.y = p[1]; diving++; continue; } }
    if (e.st === 'enter' || e.st === 'dive') {
      e.d += (e.st === 'enter' ? D.enter : e.spd) * dt; const done = pathAt(e.path, e);
      if (e.type === 'jelly' && e.st === 'dive') e.x += Math.sin(e.d / 26 + e.ph) * 1.4;
      if (e.st === 'enter' && e.fire > 0 && e.d > e.fire * e.path.len && e.y > 0 && e.y < H * .6) { e.fire = -1; aimShot(e.x, e.y, D.bullet * .85); }
      if (e.st === 'dive') {
        diving++;
        while (e.shots.length && e.d >= e.shots[0]) { e.shots.shift(); if (e.y > 0 && e.y < G.py - 60) { if (e.type === 'guard') for (const s of [-.22, 0, .22]) aimShot(e.x, e.y, D.bullet, s); else if (D.spread) { const k = G.stage >= 20 ? 3 : 2; for (let i = 0; i < k; i++) aimShot(e.x, e.y, D.bullet, (i - (k - 1) / 2) * .2); } else aimShot(e.x, e.y, D.bullet, (G.R() - .5) * .1); } }
      }
      if (done) {
        if (e.oneShot) { e.dead = true; continue; }
        if (e.st === 'dive' && e.kind === 'hover') { e.st = 'hover'; e.ht = 1.4; e.hf = 0; }
        else { if (e.st === 'dive') { e.x = slotPos(e)[0]; e.y = -30; } e.st = 'join'; }
      }
    } else if (e.st === 'hover') {
      diving++; e.ht -= dt; e.x += Math.sin(G.t * 3) * .4;
      if (!e.hf && e.ht < .8) { e.hf = 1; ring(e.x, e.y, D.ringN, Math.min(230, 110 + G.stage * 4), G.t); }
      if (e.ht <= 0) { const m = e.x < W / 2 ? 1 : -1; e.path = mkPath([[[e.x, e.y], [e.x, e.y + 60], [e.x + m * 90, H * .7], [e.x + m * 120, H + 40]]]); e.d = 0; e.pi = 0; e.st = 'dive'; e.kind = 'std'; e.shots = []; }
    } else if (e.st === 'join') {
      const [sx, sy] = slotPos(e), dx = sx - e.x, dy = sy - e.y, d = Math.hypot(dx, dy), mv = D.enter * dt;
      if (d <= mv + 1) { e.st = 'form'; e.x = sx; e.y = sy; } else { e.x += dx / d * mv; e.y += dy / d * mv; }
    } else {
      const p = slotPos(e); e.x = p[0]; e.y = p[1]; formed.push(e);
      if (e.type === 'sniper' && G.clearT <= 0 && G.dead <= 0) { e.snT -= dt; if (e.snT <= 0) { e.snT = Math.max(1.8, 4 - G.stage * .1) + G.R() * 1.5; e.burst = D.burst; e.bt = .45; } }
    }
    if (e.burst) { e.bt -= dt; if (e.bt <= 0) { e.burst--; e.bt = .12; if (e.y > 0) aimShot(e.x, e.y + 8, D.bullet * 1.25, 0, 1); } }
    const vx = e.x - ox, vy = e.y - oy;
    const tr = e.st === 'form' || e.st === 'hover' ? 0 : (vx || vy) ? Math.atan2(vy, vx) - Math.PI / 2 : e.rot;
    let dr = tr - e.rot; dr = ((dr + Math.PI) % TAU + TAU) % TAU - Math.PI; e.rot += dr * Math.min(1, dt * 10);
    if (G.dead <= 0 && e.y > 0 && Math.hypot(e.x - G.px, e.y - G.py) < TYPES[e.type].r * .7 + 7) { if (G.inv <= 0 && !G.god) { kill(e); hitPlayer(); } }
  }
  // 급강하 명령
  const qEmpty = !G.q.length;
  if (formed.length && G.dead <= 0 && G.clearT <= 0) {
    G.diveT -= dt * (qEmpty ? 1 : .5);
    const maxD = formed.length + diving <= 4 ? Math.max(D.divers, 3) : D.divers;
    if (G.diveT <= 0 && diving < maxD) {
      const cand = formed.filter(e => e.type !== 'sniper'); const e = cand.length ? cand[Math.floor(G.R() * cand.length)] : null;
      if (e) {
        const tx = clamp(G.px + (G.R() - .5) * 70, 30, W - 30); startDive(e, tx);
        // 6단계부터: 이웃 2기와 편대 돌진
        if (G.stage >= 6 && e.type !== 'guard' && G.R() < (G.stage > 10 ? .65 : .45)) {
          let k = 0; for (const f of formed) if (f !== e && f.st === 'form' && f.row === e.row && Math.abs(f.col - e.col) === 1 && f.type !== 'sniper' && k < 2) { startDive(f, tx + (f.col - e.col) * 30, 40 * ++k); }
        }
      }
      G.diveT = D.diveGap * (.6 + G.R() * .8);
    }
    if (D.formFire && qEmpty) { G.formT += dt * D.formFire; if (G.formT >= 1) { G.formT -= 1; const e = formed[Math.floor(G.R() * formed.length)]; aimShot(e.x, e.y, D.bullet * .8, (G.R() - .5) * .2); } }
  }
  if (G.boss) updBoss(dt);
  // 레이저 경고·발사
  for (const b of G.beams) { b.t += dt; if (b.t > b.warn && b.t < b.warn + b.dur && G.dead <= 0 && Math.abs(G.px - b.x) < b.w / 2 + 4 && G.py > b.y0) hitPlayer(); if (!b.snd && b.t > b.warn) { b.snd = 1; SFX.beam(); } }
  G.beams = G.beams.filter(b => b.t < b.warn + b.dur);
  // 내 총알
  for (const b of G.pb) {
    if (b.k === 'M') { // 유도
      b.tt -= dt; if (b.tt <= 0 || !b.tg || b.tg.dead || b.tg.hp <= 0) { b.tg = nearest(b.x, b.y); b.tt = .15; }
      const sp = Math.min(520, Math.hypot(b.vx, b.vy) + 500 * dt); let a = Math.atan2(b.vy, b.vx);
      if (b.tg) { const ta = Math.atan2(b.tg.y - b.y, b.tg.x - b.x); let da = ((ta - a + Math.PI) % TAU + TAU) % TAU - Math.PI; a += clamp(da, -7 * dt, 7 * dt); }
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; if (b.y < -30 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }
    for (const e of G.en) {
      if (e.dead || e.y < 4) continue; const r = TYPES[e.type].r;
      if (Math.abs(b.x - e.x) < r + 2 && Math.abs(b.y - e.y) < r + (b.k === 'L' ? 14 : 6)) {
        if (b.hitList) { if (b.hitList.includes(e)) continue; b.hitList.push(e); } else b.dead = true;
        G.hits++; e.hp -= b.dmg; e.hitT = .08; if (e.hp <= 0) kill(e); else SFX.hit(); if (b.dead) break;
      }
    }
    const B = G.boss;
    if (!b.dead && B && !B.enter && B.hp > 0) {
      const bd = BOSSES[B.kind];
      if (B.kind === 2 && B.orbs) { for (let i = 0; i < B.orbs; i++) { const a = B.spin + i / B.orbs * TAU, ox = B.x + Math.cos(a) * 52, oy = B.y + Math.sin(a) * 52; if (Math.hypot(b.x - ox, b.y - oy) < 11) { b.dead = true; SFX.block(); break; } } }
      if (!b.dead && Math.abs(b.x - B.x) < bd.w && Math.abs(b.y - B.y) < bd.h) {
        if (b.hitList) { if (b.hitList.includes(B)) continue; b.hitList.push(B); } else b.dead = true;
        G.hits++; B.hp -= b.dmg; B.hitT = .06; if (B.hp <= 0) bossDown(); else if (Math.random() < .3) SFX.hit();
      }
    }
  }
  G.pb = G.pb.filter(b => !b.dead); G.en = G.en.filter(e => !e.dead);
  // 적 총알
  for (const b of G.eb) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.y > H + 10 || b.y < -30 || b.x < -10 || b.x > W + 10) b.dead = true; else if (G.dead <= 0 && Math.hypot(b.x - G.px, b.y - G.py) < 7) { b.dead = true; hitPlayer(); } }
  G.eb = G.eb.filter(b => !b.dead);
  // 아이템
  for (const c of G.caps) {
    c.t += dt; c.y += 85 * dt; c.x += Math.sin(c.t * 3) * 20 * dt;
    if (G.dead <= 0 && Math.hypot(c.x - G.px, c.y - G.py) < 22) { c.dead = true; takeCap(c); }
    else if (c.y > H + 20) c.dead = true;
  }
  G.caps = G.caps.filter(c => !c.dead);
  // 클리어
  if (G.clearT > 0) { G.clearT -= dt; if (G.clearT <= 0) startStage(G.stage + 1); }
  else if (!G.q.length && !G.en.length && !G.boss && G.st > 1) {
    const bonus = 300 * G.stage + (G.miss ? 0 : 1000 * Math.ceil(G.stage / 2)); addScore(bonus);
    G.clearT = 2.6; G.clearBonus = bonus; G.eb = []; G.beams = []; SFX.life();
  }
  stepFx(dt);
}
function updBoss(dt) {
  const B = G.boss, n = G.stage, D = G.D, T = B.tier; B.t += dt; B.hitT = Math.max(0, B.hitT - dt);
  if (B.hp <= 0) return;
  B.spin += dt * (B.rage ? 1.6 : .9);
  if (B.enter) { B.y += 70 * dt; if (B.y >= 130) B.enter = false; return; }
  if (!B.rage && B.hp < B.max / 2) { // 2페이즈 변신
    B.rage = true; B.pt = 1.2; G.shake = .4; SFX.warn(); boom(B.x, B.y, 'rd', 30);
    G.texts.push({ x: W / 2, y: H * .4, t: 0, s: '모선 변신! 2페이즈', col: C.rd, k: 1, big: 1 });
    if (B.kind === 2) B.orbs += 2;
  }
  const sp = B.rage ? 1.5 : 1;
  if (B.kind === 0) { B.x = W / 2 + Math.sin(B.t * .6 * sp) * 95; B.y = 130 + Math.sin(B.t * 1.1) * 12; }
  else if (B.kind === 1) { const tx = W / 2 + Math.sin(B.t * .45 * sp) * 70; B.x += (tx - B.x) * Math.min(1, dt * 3); B.y = 110 + Math.sin(B.t * .8) * 8; }
  else { B.x = W / 2 + Math.cos(B.t * .5 * sp) * 80; B.y = 150 + Math.sin(B.t * 1 * sp) * 40; }
  // 나선탄(지속 패턴)
  if (B.spiral > 0) { B.spiral -= dt; B.sT = (B.sT || 0) - dt; if (B.sT <= 0) { B.sT = B.rage ? .07 : .1; const a = B.t * 4.2, s2 = Math.min(190, 120 + n * 2); const arms = B.rage ? 2 + (T > 0 ? 1 : 0) : 1 + (T > 0 ? 1 : 0); for (let i = 0; i < arms; i++) { const aa = a + i / arms * TAU; G.eb.push({ x: B.x, y: B.y, vx: Math.cos(aa) * s2, vy: Math.sin(aa) * s2 }); } } }
  B.pt -= dt; if (B.pt > 0 || G.dead > 0) return;
  B.pt = Math.max(1.2, 2.6 - n * .04) * (B.rage ? .75 : 1);
  B.ph++;
  const fan = (k, y0) => { for (let i = 0; i < k; i++) aimShot(B.x, B.y + (y0 || 30), D.bullet, (i - (k - 1) / 2) * .17); };
  const launch = (type, k) => { for (let i = 0; i < k; i++) { const s = i % 2 ? 1 : -1; const e = { type, hp: TYPES[type].hp, col: 0, row: 0, st: 'dive', x: B.x + s * 40, y: B.y + 10, rot: 0, hitT: 0, ph: 0, oneShot: true }; G.en.push(e); startDive(e, clamp(G.px + s * (20 + i * 15), 20, W - 20), i * 30); } };
  if (B.kind === 0) { // 마더 헥스: 부채꼴 → 원형 → 드론 출격 (+2페이즈 나선)
    const p = B.ph % (B.rage ? 4 : 3);
    if (p === 0) fan((n >= 10 ? 7 : 5) + T * 2);
    else if (p === 1) ring(B.x, B.y, 14 + Math.floor(n / 5) * 2, Math.min(200, 115 + n * 3), B.t);
    else if (p === 2) launch('drone', 2 + (B.rage ? 2 : 0));
    else { B.spiral = 1.6; B.pt += .6; }
  } else if (B.kind === 1) { // 트윈 캐논: 양쪽 포대 연사 → 레이저 낙하 → 쌍 레이저
    const p = B.ph % 3;
    if (p === 0) { for (const s of [-1, 1]) for (let i = 0; i < 3 + T; i++) setTimeout(() => { if (G && G.boss === B && B.hp > 0) aimShot(B.x + s * 52, B.y + 24, D.bullet * 1.1, 0, 1); }, i * 110); }
    else if (p === 1) { G.beams.push({ x: clamp(G.px, 20, W - 20), y0: B.y + 30, w: 22, t: 0, warn: .9, dur: .7 }); if (B.rage) G.beams.push({ x: clamp(G.px + (G.px < W / 2 ? 90 : -90), 20, W - 20), y0: B.y + 30, w: 22, t: 0, warn: .9, dur: .7 }); }
    else { fan(5 + T * 2, 20); if (B.rage) launch('split', 2); }
  } else { // 오비트 코어: 나선 → 해파리 소환 → 3방향 조준
    const p = B.ph % 3;
    if (p === 0) { B.spiral = 2; B.pt += .8; }
    else if (p === 1) launch('jelly', 3 + (B.rage ? 1 : 0));
    else { for (let i = 0; i < (B.rage ? 3 : 2); i++) setTimeout(() => { if (G && G.boss === B && B.hp > 0) fan(3 + T); }, i * 260); }
  }
}
function bossDown() {
  const B = G.boss; const pts = 4000 + 1000 * G.stage; addScore(pts); G.texts.push({ x: B.x, y: B.y, t: 0, s: '' + pts, col: C.ye, big: 1 });
  for (let i = 0; i < 5; i++) boom(B.x + (Math.random() - .5) * 80, B.y + (Math.random() - .5) * 60, ['pu', 'pk', 'cy', 'ye', 'wh'][i], 24);
  SFX.big(); G.shake = .7; G.flash = .25; G.eb = []; G.beams = []; G.boss = null;
  G.caps.push({ x: B.x - 20, y: B.y, k: 'P', t: 0 }, { x: B.x + 20, y: B.y, k: 'B', t: 1 });
  G.en.forEach(e => { if (e.oneShot) { boom(e.x, e.y, 'cy', 8); e.dead = true; } });
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
  for (const b of G.beams) { // 경고선 → 레이저 기둥
    if (b.t < b.warn) { x.globalAlpha = .35 + .35 * Math.sin(b.t * 30); x.fillStyle = C.rd; x.fillRect(b.x - 1, b.y0, 2, H); x.globalAlpha = 1; }
    else { const f = 1 - (b.t - b.warn) / b.dur; x.globalAlpha = .5 + .5 * f; x.fillStyle = C.cy; x.fillRect(b.x - b.w / 2, b.y0, b.w, H); x.fillStyle = '#fff'; x.fillRect(b.x - b.w / 5, b.y0, b.w / 2.5, H); x.globalAlpha = 1; }
  }
  for (const c of G.caps) spr(x, SP.cap[c.k], c.x, c.y, 0, 1, .75 + .25 * Math.sin(c.t * 10));
  const fr = (G.t * 2.5 | 0) % 2;
  for (const e of G.en) {
    let sp = SP[e.type][fr]; const hurt = e.hp < TYPES[e.type].hp;
    if (hurt) { if (e.type === 'prism') sp = SP.prism1[fr]; else if (e.type === 'guard') sp = SP.guard1[fr]; else if (e.type === 'split') sp = SP.split1[fr]; else if (e.type === 'sniper') sp = SP.sniper1[fr]; }
    spr(x, sp, e.x, e.y, e.rot, 1, e.hitT > 0 ? .4 : undefined);
    if (e.burst) spr(x, SP.dot.pk, e.x, e.y + 10, 0, .9);
    if (e.st === 'hover' && e.ht > .8) { x.strokeStyle = C.or; x.globalAlpha = .6; x.lineWidth = 1.5; x.beginPath(); x.arc(e.x, e.y, 10 + (1.4 - e.ht) * 30, 0, TAU); x.stroke(); x.globalAlpha = 1; }
    if (e.cap && (G.t * 4 | 0) % 2) spr(x, SP.dot[{ P: 'ye', L: 'pk', M: 'gr', S: 'cy', B: 'or', O: 'pu' }[e.cap]], e.x, e.y - 14, 0, .7);
  }
  const B = G.boss;
  if (B) {
    const bs = SP['boss' + B.kind][B.rage ? 1 : 0], al = B.hitT > 0 ? .55 : undefined;
    if (B.kind === 0) { spr(x, SP.bossRing, B.x, B.y, B.spin * .5); spr(x, bs, B.x, B.y, 0, 1, al); const pr = 1 + .15 * Math.sin(B.t * 6); spr(x, SP.dot[B.rage ? 'rd' : 'pk'], B.x, B.y, 0, 1.8 * pr); }
    else if (B.kind === 1) { spr(x, bs, B.x, B.y, 0, 1, al); spr(x, SP.dot[B.rage ? 'rd' : 'cy'], B.x, B.y - 8, 0, 1.3 + .2 * Math.sin(B.t * 8)); }
    else { spr(x, bs, B.x, B.y, B.spin * .3, 1, al); spr(x, SP.dot[B.rage ? 'rd' : 'gr'], B.x, B.y, 0, 2 + .3 * Math.sin(B.t * 5)); for (let i = 0; i < B.orbs; i++) { const a = B.spin + i / B.orbs * TAU; spr(x, SP.orb, B.x + Math.cos(a) * 52, B.y + Math.sin(a) * 52); } }
  }
  if (G.dead <= 0 && G.mode === 'play' && !(G.inv > 0 && !G.nova && (G.t * 12 | 0) % 2)) {
    const fl = .8 + Math.random() * .5; spr(x, SP.flame, G.px - 4, G.py + 15, 0, fl * .8); spr(x, SP.flame, G.px + 4, G.py + 15, 0, fl * .8);
    if (SP.auro) {
      const tr = G.atr || (G.atr = []); tr.unshift([G.px, G.py + 12]); if (tr.length > 22) tr.length = 22;
      x.globalCompositeOperation = 'lighter';
      for (let i = 1; i < tr.length; i++) { const f = 1 - i / tr.length; x.globalAlpha = f * .7; x.fillStyle = `hsl(${(G.t * 120 + i * 16) % 360 | 0},100%,62%)`; x.beginPath(); x.arc(tr[i][0] + Math.sin(G.t * 9 + i * .7) * 2.5 * f, tr[i][1] + i * 2.2, 1 + 3.2 * f, 0, TAU); x.fill(); }
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      spr(x, SP.auro[(G.t * 8 | 0) % 12], G.px, G.py);
    } else spr(x, SP.ship, G.px, G.py);
    for (let i = 0; i < G.pods; i++) spr(x, SP.pod, G.podPos[i][0], G.podPos[i][1]);
    if (G.shield) { x.strokeStyle = C.cy + 'aa'; x.lineWidth = 2; x.beginPath(); x.arc(G.px, G.py, 21 + Math.sin(G.t * 8), 0, TAU); x.stroke(); }
  }
  for (const b of G.pb) { const s2 = b.k === 'L' ? SP.lz : b.k === 'M' ? SP.ms : SP.pb; spr(x, s2, b.x, b.y, b.k === 'M' ? Math.atan2(b.vx, -b.vy) : b.vx ? Math.atan2(b.vx, -b.vy) : 0); }
  for (const b of G.eb) spr(x, b.alt ? SP.eb2 : SP.eb, b.x, b.y);
  x.globalCompositeOperation = 'lighter';
  for (const p of G.parts) {
    const f = 1 - p.l / p.m;
    if (p.ring) { x.globalAlpha = f; x.strokeStyle = C[p.k]; x.lineWidth = 3 * f + .5; x.beginPath(); x.arc(p.x, p.y, 6 + (1 - f) * 34, 0, TAU); x.stroke(); }
    else spr(x, SP.dot[p.k], p.x, p.y, 0, p.sz * (0.5 + f * .7), f);
  }
  if (G.nova) { const f = G.nova.t / .8; x.globalAlpha = 1 - f; x.strokeStyle = C.or; x.lineWidth = 14 * (1 - f) + 2; x.beginPath(); x.arc(G.nova.x, G.nova.y, 20 + f * 700, 0, TAU); x.stroke(); x.strokeStyle = C.ye; x.lineWidth = 4; x.beginPath(); x.arc(G.nova.x, G.nova.y, 10 + f * 560, 0, TAU); x.stroke(); }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  if (G.flash > 0) { x.globalAlpha = G.flash * 1.6; x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
  for (const t of G.texts) { x.globalAlpha = 1 - t.t / 1.1; x.fillStyle = t.col; x.font = t.k ? (t.big ? '20px ' : '14px ') + FONT_K : (t.big ? '14px ' : '8px ') + FONT_N; x.textAlign = 'center'; x.fillText(t.s, t.x, t.y - t.t * 30); }
  x.globalAlpha = 1;
  hud();
  x.restore();
  x.strokeStyle = '#ff3d9a55'; x.lineWidth = 1.5 / s; if (ox > 2) { x.beginPath(); x.moveTo(0, 0); x.lineTo(0, H); x.moveTo(W, 0); x.lineTo(W, H); x.stroke(); }
  { const pb = hudBtns.children[1], o = G.pauseLeft > 0 || paused ? '1' : '.35'; if (pb.style.opacity !== o) pb.style.opacity = o; }
  if (bombBtn.style.display !== 'none') { const t = '<b>💥</b>필살기 ' + G.bombs; if (bombBtn._t !== t) { bombBtn._t = t; bombBtn.innerHTML = t; } bombBtn.disabled = G.bombs <= 0; }
}
function neon(t, px, py, size, col, font, align) {
  x.font = size + 'px ' + (font || FONT_N); x.textAlign = align || 'center'; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 12; x.fillText(t, px, py); x.shadowBlur = 0;
}
const WNAME = { P: 'BLASTER', L: 'LASER', M: 'MISSILE' };
function hud() {
  x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '11px ' + FONT_N;
  x.fillText(Math.round(G.disp).toLocaleString(), 10, 24);
  x.fillStyle = '#ffd23f'; x.font = '7px ' + FONT_N; x.fillText('HI ' + Math.max(G.best, G.score).toLocaleString(), 10, 38);
  x.textAlign = 'center'; x.fillStyle = C.pk; x.font = '8px ' + FONT_N; x.fillText('STAGE ' + G.stage, W / 2, 22);
  for (let i = 0; i < Math.min(G.lives - (G.dead > 0 ? 0 : 1), 5); i++) spr(x, SP.ship, 16 + i * 18, H - 14, 0, .45);
  // 무기·화력 / 필살기
  const wc = { P: C.ye, L: C.pk, M: C.gr }[G.wpn];
  x.textAlign = 'left'; x.fillStyle = wc; x.font = '6px ' + FONT_N; x.fillText(WNAME[G.wpn], 10, 52);
  for (let i = 0; i < 4; i++) { x.fillStyle = i < G.power ? wc : '#ffffff22'; x.fillRect(10 + i * 10, 56, 7, 5); }
  x.fillStyle = C.or; x.font = '7px ' + FONT_N; x.textAlign = 'left'; x.fillText('B×' + G.bombs, 16 + Math.min(Math.max(G.lives - 1, 0), 5) * 18 + 4, H - 11);
  x.fillStyle = '#ffffff22'; x.fillRect(10, H - 6, 60, 2); x.fillStyle = C.or; x.fillRect(10, H - 6, 60 * G.charge / 40, 2);
  const B = G.boss;
  if (B && !B.enter) { x.fillStyle = '#ffffff22'; x.fillRect(W / 2 - 80, 30, 160, 5); x.fillStyle = B.rage ? C.rd : BOSSES[B.kind].col; x.fillRect(W / 2 - 80, 30, 160 * Math.max(0, B.hp) / B.max, 5); x.fillStyle = '#ffffffaa'; x.font = '11px ' + FONT_K; x.textAlign = 'center'; x.fillText(BOSSES[B.kind].name + (B.tier ? ' Mk.' + (B.tier + 1) : ''), W / 2, 48); }
  if (G.mode === 'play' && G.st < 2.2 && G.clearT <= 0) {
    const a = Math.min(1, (2.2 - G.st) * 2); x.globalAlpha = a;
    neon('STAGE ' + G.stage, W / 2, H * .42, 18, C.ye);
    neon(G.boss ? '⚠ 모선 ' + BOSSES[G.boss.kind].name + ' 출현' : G.stage === 1 ? '편대를 모두 격추하라!' : '준비!', W / 2, H * .42 + 32, 17, G.boss ? C.rd : C.cy, FONT_K);
    if (G.stage === 1 && G.t < 4) { x.fillStyle = '#ffffffcc'; x.font = '14px ' + FONT_K; const touch = matchMedia('(pointer:coarse)').matches; x.fillText(touch ? '화면을 끌어서 이동 · 자동 발사' : '마우스나 방향키로 이동 · 자동 발사', W / 2, H * .42 + 62); x.fillText(touch ? '💥 버튼: 필살기' : '스페이스·우클릭: 필살기', W / 2, H * .42 + 84); }
    x.globalAlpha = 1;
  }
  if (G.clearT > 0) { neon('STAGE CLEAR', W / 2, H * .4, 16, C.gr); neon('+' + G.clearBonus.toLocaleString(), W / 2, H * .4 + 28, 12, C.ye); if (!G.miss) neon('NO MISS 보너스', W / 2, H * .4 + 56, 15, C.cy, FONT_K); }
  if (paused) { // 멈춘 동안은 화면을 가려 총알 위치를 미리 볼 수 없게
    x.fillStyle = '#02010a'; x.fillRect(0, 0, W, H); neon('PAUSE', W / 2, H * .42, 20, C.cy); x.fillStyle = '#fff'; x.font = '15px ' + FONT_K; x.textAlign = 'center';
    x.fillText('화면을 누르면 3초 뒤 계속', W / 2, H * .42 + 34); x.fillStyle = '#ffffff88'; x.font = '13px ' + FONT_K;
    x.fillText(G.autoP ? '자동 멈춤은 횟수에 들어가지 않아요' : '남은 멈춤 ' + G.pauseLeft + '회 (한 판에 1번)', W / 2, H * .42 + 60);
  } else if (G.cd > 0) { x.fillStyle = '#02010a66'; x.fillRect(0, 0, W, H); neon('' + Math.ceil(G.cd), W / 2, H * .45, 40, C.ye); x.fillStyle = '#fff'; x.font = '14px ' + FONT_K; x.fillText('준비!', W / 2, H * .45 + 34); }
}
function sidePanels() {
  const { ox, ch, cw } = lay, lx = ox / 2;
  x.textAlign = 'center'; neon('별빛 요격대', lx, ch * .25, Math.min(40, ox / 6), C.pk, FONT_K); neon('STARLIGHT', lx, ch * .25 + 34, 12, C.cy);
  x.fillStyle = '#ffffff99'; x.font = '15px ' + FONT_K;
  ['마우스 또는 방향키·WASD: 이동', '자동 발사', '스페이스·우클릭: 필살기', 'P·Esc: 일시정지'].forEach((t, i) => x.fillText(t, lx, ch * .25 + 76 + i * 24));
  const items = [['P', '화력 강화'], ['L', '관통 레이저'], ['M', '유도 미사일'], ['S', '보호막 1회'], ['B', '필살기 +1'], ['O', '보조기']];
  items.forEach(([k, t], i) => { spr(x, SP.cap[k], lx - 56, ch * .25 + 186 + i * 26 - 5, 0, 1); x.textAlign = 'left'; x.fillStyle = '#ffffffbb'; x.fillText(t, lx - 36, ch * .25 + 186 + i * 26); });
  x.textAlign = 'center';
  const rx = cw - ox / 2; neon('TODAY', rx, ch * .3, 12, C.ye);
  x.fillStyle = '#fff'; x.font = '14px ' + FONT_N; x.fillText(Math.max(G.best, G.score).toLocaleString(), rx, ch * .3 + 34);
  x.fillStyle = '#ffffff99'; x.font = '15px ' + FONT_K; x.fillText('오늘 내 최고 점수', rx, ch * .3 + 62); x.fillText('매일 0시 새 판', rx, ch * .3 + 88); x.fillText('5단계마다 모선 3종 순환', rx, ch * .3 + 114);
}

/* ---------- 흐름 ---------- */
function loop(t) {
  raf = requestAnimationFrame(loop);
  let dt = Math.min(.05, (t - last) / 1000 || 0); last = t; if (window.__slDtMax) dt = Math.min(dt, window.__slDtMax);
  if (!paused && G.cd > 0) { G.cd -= dt; if (G.cd <= 0) { G.cd = 0; if (A.ctx) { A.ctx.resume(); A.next = 0; } } }
  else if (!paused) { const n = Math.ceil(dt / (1 / 90)); for (let i = 0; i < n; i++) update(dt / n); if (A.ctx) music(!!G.boss); }
  draw();
}
// 멈춤: 손으로 멈추는 건 한 판에 1번(BK 11/13, 순위 공정성). 전화·탭 전환 같은 자동 멈춤은 횟수에 안 셈. 다시 시작은 항상 3초 카운트다운.
function pause(p, auto) {
  if (!G || G.mode !== 'play') return;
  if (p) {
    if (paused || G.cd > 0) return;
    if (!auto) { if (G.pauseLeft <= 0) { G.texts.push({ x: W / 2, y: H * .3, t: 0, s: '멈춤은 한 판에 1번!', col: C.rd, k: 1 }); return; } G.pauseLeft--; }
    paused = true; G.autoP = !!auto; if (A.ctx) A.ctx.suspend();
  } else { if (!paused) return; paused = false; G.cd = 3; }
  last = performance.now();
}
function gameOver() {
  G.mode = 'over'; const acc = G.shots ? Math.min(100, Math.round(G.hits / G.shots * 100)) : 0, s = G.score;
  const res = { score: s, stage: G.stage, acc }; G.result = res;
  if (!G.debug && s > 0) { opts.submit(s); }
  if (s > G.best) G.best = s;
  panel.innerHTML = '<div><h3>GAME OVER</h3><div class="sc">' + s.toLocaleString() + '</div><p>STAGE ' + G.stage + ' · 명중률 ' + acc + '% · 격추 ' + G.kills + '</p><p>오늘 내 최고 ' + G.best.toLocaleString() + '점</p>'
    + contBtn()
    + '<button type="button" class="p1" data-k="r">▶ 다시 출격</button><button type="button" class="p2" data-k="s">결과 공유</button><button type="button" class="p3" data-k="x">나가기</button></div>';
  panel.hidden = false;
  panel.onclick = e => { const k = e.target.dataset.k; if (k === 'c') { if (cont()) return; } if (k === 'r') { panel.hidden = true; audioInit(); newGame(); } else if (k === 's') opts.share(s, res); else if (k === 'x') close(); };
}
/* 출석 코인 이어하기: 한 판에 한 번, 코인 1개 → 그 자리에서 목숨 3개로 계속(점수·단계 유지). 코인 없어도 게임은 끝까지 무료 */
function contBtn() {
  const B = opts.bonus; if (!B || G.cont) return '';
  const n = B.coins();
  return n > 0 ? '<button type="button" class="p4" data-k="c">🪙 코인 1개로 이어하기 (보유 ' + n + ')</button>'
    : '<p class="p5">🪙 코인이 있으면 여기서 이어할 수 있어요. 코인은 매일 <b>출석체크</b>로 1개씩 무료!</p>';
}
function cont() {
  if (!G || G.mode !== 'over' || G.cont || !opts.bonus || !opts.bonus.spend()) return false;
  G.cont = 1; G.mode = 'play'; G.lives = 3; G.dead = 0; G.inv = 3; G.px = W / 2; G.py = H - 70; G.eb = []; G.beams = []; G.bombs = Math.max(G.bombs, 2);
  if (ptr && !ptr.mouse) { ptr.sx = ptr.tx; ptr.sy = ptr.ty; ptr.px = G.px; ptr.py = G.py; }
  G.texts.push({ x: W / 2, y: H * .45, t: 0, s: 'CONTINUE!', col: C.ye, big: 1 }); SFX.life();
  panel.hidden = true; panel.onclick = null; last = performance.now(); return true;
}
function fs() {
  const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return;
  const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return;
  try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(() => { try { screen.orientation.lock('portrait').catch(() => {}); } catch (e) {} layout(); }).catch(() => {}); } catch (e) {}
}
function open() {
  ov.hidden = false; document.documentElement.style.overflow = 'hidden';
  if (SP) { const c = skinCol(), d = skinDes(); if (c !== SP.shipCol || d !== SP.shipDes) setShip(SP, c, d); }
  fs(); layout(); audioInit(); paused = false; panel.hidden = true; newGame();
  last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function close() {
  cancelAnimationFrame(raf); ov.hidden = true; document.documentElement.style.overflow = ''; panel.hidden = true;
  if (A.ctx) A.ctx.suspend();
  const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} }
  const r = G && G.result; opts.onExit(r || null); G = null; paused = false;
}
function warm() { // 시작 전에 글꼴·스프라이트·경로를 미리 준비 → 첫 프레임 끊김 방지
  RES = clamp(Math.ceil(Math.min(innerWidth / W, innerHeight / H) * Math.min(window.devicePixelRatio || 1, 2)), 2, 4); SP = buildSprites();
  try { document.fonts && document.fonts.load('10px "Press Start 2P"'); document.fonts && document.fonts.load('16px "Black Han Sans"', '별빛'); } catch (e) {}
  ENTRY.forEach(f => f(1));
}
window.StarlightGame = {
  boot(o) {
    opts = o; window.KST_SL = o.day; if (!ov) { mkDom(); warm(); }
    const api = { open };
    if (DEBUG) window.__sl = { open, G: () => G, stage(n) { startStage(n); }, god(b) { G.god = b; }, pause, close, bomb, give(k) { takeCap({ k, x: G.px, y: G.py }); }, draw: () => draw() };
    return api;
  },
};
})();
