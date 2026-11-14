/* 네온 레이드 — 5락실 오리지널 횡스크롤 액션 RPG 체험판 (2026-11-14)
   직업 5종(기사·요정·마법사·아처·부두술사), 던전 1개(4방 + 보스), 꼬마 동료·모험단 레벨·도감.
   그림·소리·음악 모두 코드로 생성. 특정 기존 게임의 이름·캐릭터·그림·스킬·UI·음악을 쓰지 않는다. */
(function () {
'use strict';
const DEBUG = /nrdebug/.test(location.hash);
const TAU = Math.PI * 2, STEP = 1 / 60;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
const FONT_K = '"Black Han Sans","Noto Sans KR",system-ui,sans-serif', FONT_N = '"Press Start 2P",monospace';

/* =================== 그림: 곡선 실루엣 + 셀 음영 + 림 라이트 + 외곽선 =================== */
function lg(g, x0, y0, x1, y1, st) { const q = g.createLinearGradient(x0, y0, x1, y1); for (const s of st) q.addColorStop(s[0], s[1]); return q; }
function rg(g, x, y, r0, r1, st) { const q = g.createRadialGradient(x, y, r0, x, y, r1); for (const s of st) q.addColorStop(s[0], s[1]); return q; }
function smooth(g, p, closed, t) {
  t = t == null ? .5 : t; const n = p.length; g.moveTo(p[0][0], p[0][1]);
  const get = i => closed ? p[(i + n) % n] : p[clamp(i, 0, n - 1)], m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3, p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3, p2[0], p2[1]);
  }
  if (closed) g.closePath();
}
function shape(g, p, fill, t) { g.beginPath(); smooth(g, p, true, t); g.fillStyle = fill; g.fill(); }
function curve(g, p, col, w) { g.beginPath(); smooth(g, p, false); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
function limb(g, a, b, r1, r2, fill, bulge) {
  bulge = bulge || 1.12; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  const rm = (r1 + r2) / 2 * bulge, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  shape(g, [[a[0] + nx * r1, a[1] + ny * r1], [mx + nx * rm, my + ny * rm], [b[0] + nx * r2, b[1] + ny * r2], [b[0] + ux * r2 * .9, b[1] + uy * r2 * .9], [b[0] - nx * r2, b[1] - ny * r2], [mx - nx * rm * .92, my - ny * rm * .92], [a[0] - nx * r1, a[1] - ny * r1], [a[0] - ux * r1 * .8, a[1] - uy * r1 * .8]], fill);
}
function dot(g, x, y, r, col) { g.save(); g.shadowColor = col; g.shadowBlur = r * 3; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore(); }
function face(g, skin, eye, noEye) { // 머리 좌표계: 원점 = 머리 중심
  shape(g, [[1, -15], [-9, -11], [-11, -1], [-7, 9], [2, 13], [9, 10], [12, 3], [12, -6], [9, -13]], skin);
  g.fillStyle = 'rgba(120,60,60,.18)'; g.beginPath(); g.ellipse(6, 5, 4, 2.4, 0, 0, TAU); g.fill();
  if (noEye) return;
  g.fillStyle = '#1a1426'; g.beginPath(); g.ellipse(7, -1, 2.6, 3.4, 0, 0, TAU); g.fill();
  g.fillStyle = eye; g.beginPath(); g.ellipse(7.3, 0, 1.8, 2.2, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(6.4, -1.8, .9, 0, TAU); g.fill();
  curve(g, [[3, -6], [7, -7], [10.5, -5.5]], 'rgba(30,20,40,.85)', 1.3);
}
function boot(g, f, col) { shape(g, [[f[0] - 8, f[1] - 9], [f[0] + 12, f[1] - 9], [f[0] + 15, f[1]], [f[0] - 9, f[1]]], col); }

/* ---------- 자세(뼈대). 발 = (0,0), 오른쪽 보기, 키 약 180 ---------- */
// aF/aB: [팔꿈치 - 어깨, 손 - 팔꿈치], 다리는 절대 좌표
const POSE = {
  idle: { hip: [0, -88], lean: 0, aB: [[-6, 24], [4, 22]], aF: [[8, 24], [8, 16]], kB: [-8, -48], fB: [-12, 0], kF: [10, -46], fF: [14, 0], w: -.25, cape: 0 },
  idle2: { hip: [0, -86], lean: .02, aB: [[-6, 24], [5, 21]], aF: [[8, 23], [9, 15]], kB: [-8, -47], fB: [-12, 0], kF: [11, -45], fF: [14, 0], w: -.22, cape: .1 },
  run0: { hip: [2, -90], lean: .16, aB: [[10, 20], [12, 6]], aF: [[-12, 20], [-4, 18]], kB: [-14, -52], fB: [-34, -14], kF: [22, -54], fF: [26, -4], w: .5, cape: 1 },
  run1: { hip: [2, -94], lean: .14, aB: [[2, 24], [10, 12]], aF: [[-4, 24], [4, 18]], kB: [-4, -56], fB: [-8, -22], kF: [10, -50], fF: [4, 0], w: .2, cape: .8 },
  run2: { hip: [2, -90], lean: .16, aB: [[-12, 20], [-4, 18]], aF: [[10, 20], [12, 6]], kB: [22, -54], fB: [26, -4], kF: [-14, -52], fF: [-34, -14], w: -.6, cape: 1 },
  run3: { hip: [2, -94], lean: .14, aB: [[-4, 24], [4, 18]], aF: [[2, 24], [10, 12]], kB: [10, -50], fB: [4, 0], kF: [-4, -56], fF: [-8, -22], w: -.2, cape: .8 },
  jump: { hip: [0, -96], lean: -.05, aB: [[-14, 14], [-8, -12]], aF: [[14, 10], [14, -8]], kB: [-12, -64], fB: [-22, -36], kF: [14, -70], fF: [8, -40], w: -.9, cape: .7 },
  fall: { hip: [0, -92], lean: .08, aB: [[-14, 18], [-10, 14]], aF: [[16, 14], [14, 14]], kB: [-8, -52], fB: [-16, -14], kF: [16, -58], fF: [16, -18], w: .3, cape: 1 },
  hurt: { hip: [-6, -84], lean: -.3, aB: [[-14, 18], [-12, 16]], aF: [[-4, 22], [-12, 12]], kB: [-12, -44], fB: [-22, 0], kF: [6, -44], fF: [14, 0], w: .6, cape: .6, hurt: 1 },
  dash: { hip: [6, -76], lean: .45, aB: [[-14, 12], [-16, 6]], aF: [[-10, 16], [-16, 10]], kB: [-26, -40], fB: [-50, -6], kF: [26, -38], fF: [30, 0], w: 1.2, cape: 1 },
  c1a: { hip: [-2, -86], lean: -.1, aB: [[-10, 20], [8, 6]], aF: [[-14, -6], [-10, -18]], kB: [-12, -46], fB: [-22, 0], kF: [12, -46], fF: [20, 0], w: -2.4, cape: .3 },
  c1b: { hip: [6, -80], lean: .3, aB: [[-14, 14], [-14, 10]], aF: [[16, 10], [22, 6]], kB: [-22, -42], fB: [-40, 0], kF: [24, -42], fF: [32, 0], w: .25, cape: 1 },
  c2a: { hip: [2, -84], lean: .2, aB: [[-14, 14], [-10, 12]], aF: [[14, 14], [10, 18]], kB: [-18, -44], fB: [-32, 0], kF: [20, -44], fF: [28, 0], w: 1.3, cape: .8 },
  c2b: { hip: [4, -82], lean: .05, aB: [[-6, 22], [6, 10]], aF: [[16, -10], [16, -14]], kB: [-20, -44], fB: [-34, 0], kF: [22, -44], fF: [30, 0], w: -1.1, cape: 1 },
  c3a: { hip: [-4, -88], lean: -.2, aB: [[-16, 6], [-12, -12]], aF: [[6, -18], [-4, -18]], kB: [-12, -48], fB: [-20, 0], kF: [10, -48], fF: [16, 0], w: -2.0, cape: .4 },
  c3b: { hip: [10, -70], lean: .55, aB: [[-14, 16], [-18, 8]], aF: [[18, 12], [22, 16]], kB: [-28, -36], fB: [-50, 0], kF: [28, -36], fF: [36, 0], w: .9, cape: 1 },
  cast: { hip: [-2, -88], lean: -.06, aB: [[-10, 22], [-2, 18]], aF: [[18, 2], [20, -2]], kB: [-14, -46], fB: [-22, 0], kF: [12, -46], fF: [18, 0], w: -.1, cape: .5, cast: 1 },
  up: { hip: [2, -92], lean: -.12, aB: [[-12, 18], [-8, 16]], aF: [[12, -16], [6, -20]], kB: [-12, -50], fB: [-18, 0], kF: [14, -52], fF: [20, -6], w: -1.7, cape: .8 },
  spin: { hip: [0, -84], lean: 0, aB: [[-20, 0], [-20, 2]], aF: [[20, 0], [22, 2]], kB: [-16, -44], fB: [-26, 0], kF: [16, -44], fF: [26, 0], w: 0, cape: 1 },
  ult: { hip: [0, -92], lean: -.08, aB: [[-14, -14], [-6, -20]], aF: [[12, -16], [4, -20]], kB: [-14, -48], fB: [-22, 0], kF: [14, -48], fF: [22, 0], w: -1.57, cape: 1, cast: 1 },
};
const FRAMES = Object.keys(POSE);
function rot(J, p) { const c = Math.cos(J.lean), s = Math.sin(J.lean); return [J.hip[0] + p[0] * c - p[1] * s, J.hip[1] + p[0] * s + p[1] * c]; }
function joints(name) {
  const P = POSE[name], J = { hip: P.hip, lean: P.lean, w: P.w, cape: P.cape, cast: P.cast, hurt: P.hurt, name };
  J.sF = rot(J, [14, -48]); J.sB = rot(J, [-12, -46]); J.hd = rot(J, [3, -72]);
  J.eF = [J.sF[0] + P.aF[0][0], J.sF[1] + P.aF[0][1]]; J.hF = [J.eF[0] + P.aF[1][0], J.eF[1] + P.aF[1][1]];
  J.eB = [J.sB[0] + P.aB[0][0], J.sB[1] + P.aB[0][1]]; J.hB = [J.eB[0] + P.aB[1][0], J.eB[1] + P.aB[1][1]];
  J.rF = rot(J, [6, 2]); J.rB = rot(J, [-6, 2]); J.kF = P.kF; J.fF = P.fF; J.kB = P.kB; J.fB = P.fB; return J;
}
function body(g, J) { g.translate(J.hip[0], J.hip[1]); g.rotate(J.lean); g.translate(0, 88); } // 원래 좌표 그대로 그리기
function headT(g, J) { g.translate(J.hd[0], J.hd[1]); g.rotate(J.lean * .5 + (J.hurt ? -.25 : 0)); }
function legs(g, J, cB, cF, shoe, rB, rF) {
  limb(g, J.rB, J.kB, rB || 9, 7, cB); limb(g, J.kB, J.fB, 7, 6, cB); boot(g, J.fB, shoe);
  J._front = () => { limb(g, J.rF, J.kF, rF || 10, 8, cF); limb(g, J.kF, J.fF, 8, 6, cF); boot(g, J.fF, shoe); };
}
function arm(g, s, e, h, cU, cL, hand, r) { r = r || 7; limb(g, s, e, r, r - 1.5, cU); limb(g, e, h, r - 1.5, r - 2, cL); if (hand) { g.fillStyle = hand; g.beginPath(); g.arc(h[0], h[1], r - 2.6, 0, TAU); g.fill(); } }
function cape(g, J, a, b, fill) { const t = J.cape || 0; shape(g, a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]), fill); }

const ART = {};
ART.knight = (g, J) => {
  g.save(); body(g, J); cape(g, J, [[-14, -138], [-28, -110], [-36, -60], [-40, -8], [-18, -14], [-4, -40], [4, -92], [8, -136]], [[-14, -138], [-40, -120], [-72, -80], [-92, -30], [-70, -24], [-48, -48], [-30, -70], [-8, -96], [8, -136]], lg(g, 0, -140, 0, 0, [[0, '#b3203f'], [1, '#5a0c22']])); g.restore();
  legs(g, J, '#3b4766', '#8e9cc0', '#232b42');
  arm(g, J.sB, J.eB, J.hB, '#566586', '#4a5878', '#3a4462');
  g.save(); body(g, J);
  shape(g, [[-14, -140], [0, -144], [16, -140], [19, -124], [13, -104], [16, -88], [0, -82], [-14, -88], [-12, -104], [-17, -124]], lg(g, -16, 0, 18, 0, [[0, '#7d8db3'], [.55, '#c9d6ef'], [1, '#8f9fc4']]));
  curve(g, [[-2, -140], [1, -118], [0, -94]], 'rgba(40,50,80,.5)', 1.4); curve(g, [[-12, -104], [0, -101], [13, -104]], '#5cf2ff', 2); dot(g, 1, -122, 3, '#5cf2ff');
  shape(g, [[-15, -92], [16, -92], [22, -66], [4, -62], [-16, -66]], lg(g, 0, -92, 0, -62, [[0, '#6c7ba0'], [1, '#3d4a6c']]));
  g.restore(); J._front();
  g.save(); body(g, J); shape(g, [[6, -146], [22, -147], [28, -136], [22, -126], [8, -130]], lg(g, 0, -148, 0, -126, [[0, '#e2ebff'], [1, '#7f90b8']])); shape(g, [[-6, -148], [10, -147], [12, -141], [-6, -140]], '#5a6788'); g.restore();
  g.save(); headT(g, J); face(g, '#f0c8a6', '#5cf2ff');
  shape(g, [[-15, -3], [-9, -16], [3, -18], [12, -11], [11, -3], [6, -7], [1, -2], [-5, -7], [-11, 3], [-15, 10]], '#c99a52'); curve(g, [[-7, -14], [0, -7]], 'rgba(255,240,200,.6)', 1.2); g.restore();
  arm(g, J.sF, J.eF, J.hF, '#9aa9cc', '#8494bb', '#5a6788', 8);
  g.save(); g.translate(J.hF[0], J.hF[1]); g.rotate(J.w + Math.PI / 2 + .3);
  g.fillStyle = '#3b2a1e'; g.fillRect(-3.5, -2, 7, 22); g.fillStyle = '#d9b45a'; g.beginPath(); g.roundRect(-14, -8, 28, 6, 3); g.fill();
  g.shadowColor = '#7df9ff'; g.shadowBlur = 16; shape(g, [[-6, -8], [6, -8], [5, -92], [0, -108], [-5, -92]], lg(g, -6, 0, 6, 0, [[0, '#bfefff'], [.5, '#ffffff'], [1, '#7fd8ff']])); g.restore();
};
ART.fairy = (g, J) => {
  g.save(); g.translate(0, -16); // 늘 살짝 떠 있음
  g.save(); body(g, J); const fl = J.name === 'idle2' || J.name.startsWith('run1') || J.name === 'run3' ? 1 : 0;
  [[-4, -120, -70, -170 + fl * 14, -56, -118, 'rgba(140,255,220,.5)'], [-4, -112, -62, -82 - fl * 8, -26, -92, 'rgba(190,150,255,.5)']].forEach(w => {
    g.save(); g.shadowColor = '#8ffff0'; g.shadowBlur = 12; shape(g, [[w[0], w[1]], [w[2] * .6, w[3] * .8 + 20], [w[2], w[3]], [w[4], w[5]], [w[0] - 6, w[1] + 6]], w[6]); g.restore();
    curve(g, [[w[0], w[1]], [w[2] * .7, w[3] * .85 + 12], [w[2] * .95, w[3] * .98]], 'rgba(230,255,250,.7)', 1);
  }); g.restore();
  legs(g, J, '#e9c4a6', '#f3d1b4', '#2f8f74', 7, 7);
  arm(g, J.sB, J.eB, J.hB, '#e2bc9e', '#e2bc9e', '#e2bc9e', 5.5);
  g.save(); body(g, J);
  shape(g, [[-11, -138], [12, -138], [10, -112], [18, -90], [26, -70], [10, -76], [2, -66], [-8, -76], [-24, -70], [-14, -92], [-10, -112]], lg(g, 0, -138, 0, -66, [[0, '#5df0c0'], [.6, '#22a88a'], [1, '#147060']]));
  curve(g, [[0, -110], [-6, -90], [-14, -74]], 'rgba(220,255,240,.5)', 1.2); curve(g, [[2, -108], [10, -88], [18, -74]], 'rgba(220,255,240,.5)', 1.2); dot(g, 1, -128, 2.4, '#ffe8a0');
  g.restore(); J._front();
  g.save(); headT(g, J);
  shape(g, [[-14, -12], [0, -20], [12, -12], [10, 8], [2, 8], [-10, 16], [-24, 40], [-32, 46], [-22, 18]], lg(g, 0, -20, 0, 46, [[0, '#ffd6f5'], [1, '#b78bff']]));
  face(g, '#f6d5bb', '#8f6bff');
  shape(g, [[-12, -8], [-4, -18], [8, -16], [14, -6], [8, -8], [2, -2], [-2, -8], [-10, 0]], '#ffc6ee'); curve(g, [[-2, -17], [5, -9]], 'rgba(255,255,255,.7)', 1.2);
  dot(g, -10, -12, 2.2, '#ffb3e6'); dot(g, -6, -14, 2, '#ffe8a0'); g.restore();
  arm(g, J.sF, J.eF, J.hF, '#f6d5bb', '#f6d5bb', '#f6d5bb', 5.5);
  g.save(); g.translate(J.hF[0], J.hF[1]); g.rotate(J.w * .7); g.shadowColor = '#a8fff0'; g.shadowBlur = 14;
  g.fillStyle = '#e9fff9'; g.fillRect(-46, -1.5, 100, 3); shape(g, [[52, -5], [72, 0], [52, 5], [56, 0]], '#ffffff'); g.restore();
  g.restore();
};
ART.mage = (g, J) => {
  g.save(); g.translate(J.hB[0], J.hB[1]); g.rotate(-.12 + J.lean * .5 + (J.cast ? -.2 : 0));
  g.fillStyle = '#4e3520'; g.beginPath(); g.roundRect(-2.5, -70, 5, 160, 2); g.fill();
  shape(g, [[0, -76], [-9, -84], [-8, -98], [0, -90], [8, -98], [9, -84]], '#d9b45a');
  g.shadowColor = '#c17dff'; g.shadowBlur = 22; shape(g, [[0, -118], [8, -100], [0, -86], [-8, -100]], lg(g, 0, -118, 0, -86, [[0, '#ffffff'], [.4, '#e3b8ff'], [1, '#8a3dff']])); g.restore();
  arm(g, J.sB, J.eB, J.hB, '#3a2466', '#3a2466', '#f0c8a6', 6.5);
  // 로브는 다리까지 덮음 → 다리는 신발만
  boot(g, J.fB, '#1e1236'); boot(g, J.fF, '#1e1236');
  g.save(); body(g, J); const sw = (J.fF[0] - J.fB[0]) * .3;
  shape(g, [[-12, -142], [12, -142], [18, -118], [16, -94], [24 + sw, -50], [32 + sw, -6], [8, -2], [-6, -6], [-22 - sw, -2], [-30 - sw, -8], [-20, -52], [-16, -96], [-18, -120]], lg(g, -30, 0, 32, 0, [[0, '#2a1650'], [.5, '#4b2a8c'], [1, '#2e185a']]));
  curve(g, [[2, -120], [6, -70], [10, -4]], '#e3c36a', 2.2); curve(g, [[-6, -96], [-12, -52], [-18, -6]], 'rgba(20,8,40,.6)', 2);
  shape(g, [[-14, -100], [16, -100], [16, -94], [-14, -94]], '#d9b45a'); dot(g, 2, -97, 2.6, '#c17dff');
  shape(g, [[-14, -146], [-20, -162], [-8, -150], [8, -150], [14, -160], [12, -144]], '#5d36a6'); g.restore();
  g.save(); headT(g, J); face(g, '#f0c8a6', '#c17dff');
  shape(g, [[-15, 2], [-13, -14], [-1, -20], [11, -14], [13, -4], [5, -8], [-3, -2], [-7, -6], [-11, 10], [-17, 20]], '#2b2f4f'); curve(g, [[-5, -18], [5, -10]], 'rgba(200,210,255,.5)', 1.2); g.restore();
  arm(g, J.sF, J.eF, J.hF, '#5232a0', '#5232a0', '#f0c8a6', 7);
  if (J.cast) { dot(g, J.hF[0] + 10, J.hF[1], 5, '#f3dcff'); g.strokeStyle = 'rgba(210,160,255,.7)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(J.hF[0] + 12, J.hF[1], 7, 14, 0, 0, TAU); g.stroke(); }
};
ART.archer = (g, J) => {
  g.save(); body(g, J); cape(g, J, [[-12, -140], [-30, -118], [-38, -92], [-22, -96], [-8, -110], [6, -138]], [[-12, -140], [-40, -124], [-58, -100], [-36, -100], [-12, -112], [6, -138]], lg(g, 0, -140, 0, -92, [[0, '#2f5a3a'], [1, '#173322']]));
  shape(g, [[-16, -142], [-6, -146], [-20, -100], [-28, -104]], '#6b4a2e'); [[-12, -150], [-8, -152], [-15, -148]].forEach(a => curve(g, [[a[0], a[1]], [a[0] - 1, a[1] + 8]], '#d8f0c8', 2)); g.restore();
  legs(g, J, '#4a3a2a', '#5c4834', '#2a1e14');
  const draw = J.cast || /^c\db$/.test(J.name) || J.name === 'up';
  // 시위 당기는 손은 뒤 팔
  const hB = draw ? [J.sF[0] - 6, J.sF[1] + 4] : J.hB, eB = draw ? [J.sB[0] - 2, J.sB[1] + 10] : J.eB;
  arm(g, J.sB, eB, hB, '#8a6646', '#eec4a0', '#eec4a0', 6.5);
  g.save(); body(g, J);
  shape(g, [[-12, -140], [12, -141], [16, -122], [11, -100], [13, -86], [-11, -84], [-11, -102], [-15, -124]], lg(g, -14, 0, 16, 0, [[0, '#5b4330'], [.55, '#8a6646'], [1, '#5f4632']]));
  curve(g, [[-10, -136], [12, -96]], '#3a2a1c', 3); dot(g, 1, -118, 2.2, '#9dff8a'); shape(g, [[-13, -94], [14, -94], [18, -74], [-14, -74]], '#3f5a34'); g.restore();
  J._front();
  g.save(); headT(g, J); face(g, '#eec4a0', '#9dff8a');
  shape(g, [[-18, 0], [-14, -16], [0, -22], [12, -14], [14, -2], [8, -8], [0, -10], [-6, -4], [-10, 10], [-14, 18], [-22, 14]], lg(g, 0, -22, 0, 18, [[0, '#3f7a4e'], [1, '#21422b']])); shape(g, [[-2, -10], [6, -10], [10, 0], [4, -3]], '#c46a3a'); g.restore();
  const bh = draw ? [J.sF[0] + 22, J.sF[1] + 6] : J.hF;
  arm(g, J.sF, draw ? [J.sF[0] + 12, J.sF[1] + 4] : J.eF, bh, '#8a6646', '#eec4a0', '#eec4a0', 6.5);
  g.save(); g.translate(bh[0], bh[1]); g.rotate(draw ? J.lean * .3 : .35 + J.w * .2);
  curve(g, [[-4, -50], [9, -26], [12, 0], [9, 26], [-4, 50]], '#4a2e18', 4.5); curve(g, [[-4, -50], [9, -26], [12, 0], [9, 26], [-4, 50]], '#c49a5a', 1.8);
  const sx = draw ? hB[0] - bh[0] : -5; g.strokeStyle = 'rgba(230,240,255,.85)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-4, -50); g.lineTo(sx, 0); g.lineTo(-4, 50); g.stroke();
  if (draw) { g.shadowColor = '#9dff8a'; g.shadowBlur = 14; g.fillStyle = '#eaffdf'; g.fillRect(sx, -1.2, 60 - sx * .2, 2.4); shape(g, [[56, -5], [68, 0], [56, 5]], '#ffffff'); }
  g.restore();
};
ART.voodoo = (g, J) => {
  for (let i = 0; i < 3; i++) { const fx = J.hd[0] - 30 + i * 8, fy = J.hd[1] + 12 - i * 18; g.save(); g.shadowColor = '#7dff9a'; g.shadowBlur = 16; shape(g, [[fx, fy - 13], [fx + 6, fy - 2], [fx + 4, fy + 6], [fx - 4, fy + 6], [fx - 6, fy - 2]], lg(g, 0, fy - 13, 0, fy + 6, [[0, '#eaffef'], [1, '#3cd47a']])); g.restore(); }
  g.save(); g.translate(J.hB[0], J.hB[1]); g.rotate(-.2 + J.lean * .5); g.fillStyle = '#e8dcc0'; g.beginPath(); g.roundRect(-2.5, -60, 5, 150, 2); g.fill();
  shape(g, [[0, -78], [-10, -70], [-8, -56], [0, -62], [8, -56], [10, -70]], '#ece2cc'); g.fillStyle = '#1a1426'; g.beginPath(); g.arc(-4, -68, 2, 0, TAU); g.arc(4, -68, 2, 0, TAU); g.fill();
  shape(g, [[6, -54], [22, -44], [14, -42], [24, -34], [6, -44]], '#8a3dff'); shape(g, [[-6, -54], [-18, -38], [-8, -44]], '#3cd47a'); g.restore();
  arm(g, J.sB, J.eB, J.hB, '#3c2a4a', '#8a5a4a', '#8a5a4a', 6);
  legs(g, J, '#2a2234', '#342a42', '#1a1420');
  g.save(); body(g, J);
  shape(g, [[-13, -142], [13, -142], [18, -118], [14, -96], [22, -66], [26, -36], [10, -44], [-4, -36], [-20, -40], [-22, -66], [-15, -96], [-18, -120]], lg(g, -20, 0, 26, 0, [[0, '#3a2448'], [.5, '#5c3a6e'], [1, '#3a2448']]));
  g.strokeStyle = '#d8c8a0'; g.lineWidth = 1.2; for (let i = 0; i < 7; i++) { const yy = -130 + i * 13; g.beginPath(); g.moveTo(-2, yy); g.lineTo(4, yy + 4); g.stroke(); }
  shape(g, [[-14, -100], [14, -100], [15, -94], [-14, -94]], '#2a1834'); dot(g, 0, -97, 2.4, '#7dff9a');
  [[-6, -138], [-2, -134], [3, -133], [8, -136]].forEach(b => dot(g, b[0], b[1], 1.6, '#b48bff')); g.restore();
  J._front();
  g.save(); headT(g, J); face(g, '#c99878', '#7dff9a', 1);
  shape(g, [[-5, -12], [9, -10], [12, 2], [9, 12], [-1, 10], [-4, 0]], '#efe6d2'); g.fillStyle = '#1a1426'; g.beginPath(); g.ellipse(5, 0, 2.6, 3.2, 0, 0, TAU); g.fill(); dot(g, 5, 0, 1.4, '#7dff9a');
  curve(g, [[1, 7], [9, 7]], '#8a3dff', 1.4);
  shape(g, [[-17, -2], [-13, -18], [1, -24], [13, -18], [15, -10], [5, -14], [-5, -12], [-9, 4], [-17, 16], [-25, 10]], lg(g, 0, -24, 0, 16, [[0, '#6b2a5a'], [1, '#3a1434']])); g.restore();
  arm(g, J.sF, J.eF, J.hF, '#4a3058', '#8a5a4a', '#8a5a4a', 6.5);
  const dx = J.hF[0] + 16, dy = J.hF[1] - 14; g.save(); g.translate(dx, dy); g.rotate(.15 + (J.cast ? -.3 : 0)); g.shadowColor = '#7dff9a'; g.shadowBlur = 10;
  shape(g, [[0, -14], [8, -10], [8, -2], [14, 2], [10, 6], [6, 4], [7, 16], [2, 16], [0, 8], [-2, 16], [-7, 16], [-6, 4], [-10, 6], [-14, 2], [-8, -2], [-8, -10]], '#c8a878'); g.shadowBlur = 0;
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3, -9); g.lineTo(-1, -7); g.moveTo(-1, -9); g.lineTo(-3, -7); g.stroke(); dot(g, 3, -8, 1.3, '#7dff9a'); curve(g, [[-6, 0], [0, 2], [6, 0]], '#8a3dff', 1.2); g.restore();
};
/* ---------- 적 그림 ---------- */
function gruntArt(pal) {
  return (g, f) => { // f: {ph: 걷기 위상, arm: 렌치 각도, hurt}
    const lp = Math.sin(f.ph || 0) * 10, lean = f.hurt ? -.25 : f.lean || 0; g.save(); g.rotate(lean * .4);
    limb(g, [-8, -50], [-12 - lp * .5, -24], 10, 8, pal[3]); limb(g, [-12 - lp * .5, -24], [-14 - lp, 0], 8, 7, pal[3]);
    limb(g, [-24, -104], [-36, -76], 9, 8, pal[3]);
    if (f.shield) { shape(g, [[-48, -136], [-26, -140], [-24, -40], [-46, -34]], lg(g, -48, 0, -24, 0, [[0, '#2a3346'], [1, '#56627e']])); curve(g, [[-36, -130], [-36, -46]], '#ffb070', 2); }
    shape(g, [[-30, -112], [-6, -128], [24, -124], [36, -100], [32, -62], [14, -46], [-18, -46], [-34, -66], [-38, -92]], lg(g, -30, 0, 36, 0, [[0, pal[0]], [.55, pal[1]], [1, pal[0]]]));
    shape(g, [[-14, -148], [8, -152], [22, -140], [20, -120], [-4, -116], [-18, -124]], pal[2]);
    g.save(); g.shadowColor = pal[4]; g.shadowBlur = 14; shape(g, [[-4, -138], [18, -138], [19, -132], [-4, -131]], pal[5]); g.restore();
    [[-14, -94], [8, -82], [20, -104], [-6, -66]].forEach(r => { g.fillStyle = 'rgba(120,60,30,.4)'; g.beginPath(); g.ellipse(r[0], r[1], 5, 3, .4, 0, TAU); g.fill(); });
    curve(g, [[-28, -80], [0, -76], [30, -80]], pal[4] + '88', 2);
    limb(g, [8, -50], [14 + lp * .5, -24], 10, 8, pal[3]); limb(g, [14 + lp * .5, -24], [18 + lp, 0], 8, 7, pal[3]);
    const a = f.arm == null ? .5 : f.arm; limb(g, [26, -104], [26 + Math.cos(a - .6) * 26, -104 + Math.sin(a - .6) * 26], 10, 8, pal[1]);
    g.save(); g.translate(26 + Math.cos(a - .6) * 26, -104 + Math.sin(a - .6) * 26); g.rotate(a); g.fillStyle = '#9aa0ae'; g.beginPath(); g.roundRect(-3, -4, 40, 8, 3); g.fill(); g.beginPath(); g.arc(40, 0, 10, .8, 5.5); g.lineTo(40, 0); g.fill(); g.restore();
    g.restore();
  };
}
const EART = {
  grunt: gruntArt(['#5a4a40', '#8a705c', '#3a3230', '#4a3f3a', '#ff6a00', '#ffb070']),
  shield: gruntArt(['#3f4658', '#6c7690', '#2a2f3c', '#363c4c', '#ff9a3d', '#ffd0a0']),
  elite: gruntArt(['#4a2030', '#8a3a50', '#2a1018', '#3a1a24', '#ff2a6a', '#ff9ac0']),
};
/* ---------- 굽기: 평면 → 외곽선 → 음영 → 림 라이트 ---------- */
function mkc(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
function bake(fn, arg, k, rim, rim2, box) {
  box = box || [250, 240, 30]; const W = Math.ceil(box[0] * k), H = Math.ceil(box[1] * k), ox = W / 2, oy = H - box[2] * k;
  const flat = mkc(W, H), f = flat.getContext('2d'); f.translate(ox, oy); f.scale(k, k); fn(f, arg);
  const sil = mkc(W, H), si = sil.getContext('2d'); si.drawImage(flat, 0, 0); si.globalCompositeOperation = 'source-in'; si.fillStyle = 'rgba(10,6,22,.92)'; si.fillRect(0, 0, W, H);
  const out = mkc(W, H), o = out.getContext('2d'), lw = Math.max(1, 2.1 * k);
  for (let a = 0; a < 8; a++) o.drawImage(sil, Math.cos(a * Math.PI / 4) * lw, Math.sin(a * Math.PI / 4) * lw);
  o.drawImage(flat, 0, 0); o.globalCompositeOperation = 'source-atop';
  o.fillStyle = lg(o, ox - 80 * k, oy - 200 * k, ox + 80 * k, oy, [[0, 'rgba(255,255,255,.14)'], [.5, 'rgba(0,0,0,0)'], [1, 'rgba(10,0,30,.36)']]); o.fillRect(0, 0, W, H);
  o.fillStyle = lg(o, 0, oy - 50 * k, 0, oy, [[0, 'rgba(0,0,20,0)'], [1, 'rgba(0,0,20,.32)']]); o.fillRect(0, 0, W, H);
  const rm = (col, dx, dy, al) => { const c = mkc(W, H), r = c.getContext('2d'); r.drawImage(sil, 0, 0); r.globalCompositeOperation = 'source-in'; r.fillStyle = col; r.fillRect(0, 0, W, H); r.globalCompositeOperation = 'destination-out'; r.drawImage(sil, dx * k, dy * k); o.globalAlpha = al; o.drawImage(c, 0, 0); };
  rm(rim, -3, 2, .6); rm(rim2 || '#ff8fd8', 3, 1, .28); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  // 맞았을 때 하얗게 번쩍이는 판
  const wh = mkc(W, H), w2 = wh.getContext('2d'); w2.drawImage(flat, 0, 0); w2.globalCompositeOperation = 'source-in'; w2.fillStyle = '#fff'; w2.fillRect(0, 0, W, H);
  return { c: out, wh, ox: ox / k, oy: oy / k, w: W / k, h: H / k };
}
function put(g, sp, x, y, dir, sc, flash, rotA) {
  g.save(); g.translate(x, y); if (rotA) g.rotate(rotA); g.scale(dir * sc, sc); g.drawImage(sp.c, -sp.ox, -sp.oy, sp.w, sp.h);
  if (flash > 0) { g.globalAlpha = Math.min(1, flash); g.drawImage(sp.wh, -sp.ox, -sp.oy, sp.w, sp.h); } g.restore();
}

/* ---------- 3D 렌더 캐릭터 아틀라스 (원본 src3d/chars, 모델 KayKit CC0) ---------- */
// 5x4 칸, 칸 360x320px, 발 (155,295), 1 게임 단위 = 1.2px. 칸 순서 = ATL.F. 못 불러오면 예전 코드 그림을 쓴다.
const ATL = { CW: 360, CH: 320, FX: 155, FY: 295, PXU: 1.2, V: 1, F: ['idle', 'idle2', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall', 'hurt', 'dash', 'c1a', 'c1b', 'c2a', 'c2b', 'c3a', 'c3b', 'cast', 'up', 'spin', 'ult'], p: {}, sp: {} };
function atlasLoad(cls) {
  if (!ATL.p[cls]) ATL.p[cls] = new Promise(ok => { const im = new Image(); im.decoding = 'async'; im.onload = () => { try { ATL.sp[cls] = atlasCut(im); } catch (e) {} ok(!!ATL.sp[cls]); }; im.onerror = () => ok(false); im.src = '/img/raid/' + cls + '.webp?v=' + ATL.V; });
  return ATL.p[cls];
}
function atlasCut(im) {
  const { CW, CH, FX, FY, PXU } = ATL, o = {};
  ATL.F.forEach((f, i) => {
    const c = mkc(CW, CH), g = c.getContext('2d'); g.drawImage(im, (i % 5) * CW, Math.floor(i / 5) * CH, CW, CH, 0, 0, CW, CH);
    const wh = mkc(CW, CH), w2 = wh.getContext('2d'); w2.drawImage(c, 0, 0); w2.globalCompositeOperation = 'source-in'; w2.fillStyle = '#fff'; w2.fillRect(0, 0, CW, CH);
    o[f] = { c, wh, ox: FX / PXU, oy: FY / PXU, w: CW / PXU, h: CH / PXU };
  });
  for (const f of FRAMES) if (!o[f]) o[f] = o.idle; // 새 자세가 생기면 대기 자세로
  return o;
}
function atlasAll() { return Promise.all(CLS.map(atlasLoad)); }

/* =================== 직업·기술 데이터 =================== */
// 공격 판정 h: x0..x1 앞쪽 거리, dy 깊이 허용, z0..z1 높이, d 피해 배율, kb 밀기, lift 띄우기, st 경직, stop 히트스톱, sh 흔들림, n 다단 수, iv 간격
const H = (o) => Object.assign({ x0: 0, x1: 70, dy: 24, z0: 0, z1: 100, d: 1, kb: 70, lift: 0, st: .32, stop: .055, sh: 2, s: 'slash' }, o);
const CL = {
  knight: {
    name: '기사', col: '#7df9ff', col2: '#ff6b8a', hp: 420, mp: 100, atk: 30, spd: 118, desc: '묵직한 대검 · 넓게 베고 끝까지 버텨요', tag: '입문 추천', stars: [3, 4, 3],
    combo: [
      { a: 'c1a', b: 'c1b', t: .34, at: .11, h: H({ x1: 82, d: 1, kb: 60 }), fx: ['arc', -.9, .9, 74] },
      { a: 'c2a', b: 'c2b', t: .36, at: .12, h: H({ x1: 82, d: 1.1, kb: 50, lift: 150 }), fx: ['arc', 1, -1.3, 74] },
      { a: 'c3a', b: 'c3b', t: .55, at: .2, h: H({ x1: 92, d: 2, kb: 230, st: .55, stop: .11, sh: 6, s: 'heavy' }), fx: ['arc', -1.8, .7, 90], step: 40 },
    ],
    sk: [
      { name: '돌진 베기', icon: '➶', mp: 12, cd: 4, a: 'dash', b: 'c1b', t: .42, at: .05, move: 300, mt: .22, h: H({ x0: -20, x1: 60, d: 1.6, kb: 120, n: 3, iv: .07, s: 'slash' }), fx: ['dash'] },
      { name: '하늘 가르기', icon: '⤴', mp: 14, cd: 5, a: 'c2a', b: 'up', t: .5, at: .14, h: H({ x1: 76, d: 2.2, kb: 20, lift: 330, st: .6, stop: .09, sh: 4 }), fx: ['arc', 1.2, -1.6, 84] },
      { name: '대지 파동', icon: '≋', mp: 18, cd: 7, a: 'c3a', b: 'c3b', t: .6, at: .2, proj: { k: 'wave', spd: 360, life: .9, r: 30, d: 2.4, kb: 160, lift: 160, pierce: 99 }, fx: ['slam'] },
      { name: '회오리 베기', icon: '✺', mp: 24, cd: 9, a: 'spin', b: 'spin', t: .9, at: .05, h: H({ x0: -80, x1: 80, d: .9, kb: 30, lift: 60, n: 7, iv: .11, st: .3, stop: .03 }), fx: ['spin'] },
    ],
    ult: { name: '성검 낙하', a: 'ult', b: 'c3b', t: 1.1, at: .55, area: { dx: 120, r: 170, d: 14, lift: 380, kb: 200, k: 'sword', delay: 0 } },
  },
  fairy: {
    name: '요정', col: '#8ffff0', col2: '#ffc6ee', hp: 330, mp: 120, atk: 26, spd: 140, desc: '날개로 날며 빛 창을 빠르게 찔러요', tag: '빠름', stars: [5, 5, 2],
    combo: [
      { a: 'c2a', b: 'c1b', t: .22, at: .07, h: H({ x1: 100, d: .7, kb: 30, dy: 18 }), fx: ['thrust', 100] },
      { a: 'c2a', b: 'c1b', t: .22, at: .07, h: H({ x1: 100, d: .7, kb: 30, dy: 18 }), fx: ['thrust', 100] },
      { a: 'c1a', b: 'c2b', t: .26, at: .09, h: H({ x1: 90, d: .9, kb: 20, lift: 170 }), fx: ['arc', 1, -1.4, 70] },
      { a: 'c3a', b: 'c3b', t: .4, at: .14, h: H({ x1: 110, d: 1.6, kb: 210, st: .5, stop: .09, sh: 5, s: 'heavy' }), fx: ['thrust', 120], step: 50 },
    ],
    sk: [
      { name: '빛살 돌진', icon: '➵', mp: 10, cd: 3.5, a: 'dash', b: 'c1b', t: .34, at: .04, move: 420, mt: .2, inv: 1, h: H({ x0: -40, x1: 50, d: 1.8, kb: 60, n: 2, iv: .08 }), fx: ['dash'] },
      { name: '꽃잎 회오리', icon: '❀', mp: 16, cd: 6, a: 'cast', b: 'cast', t: .55, at: .12, area: { dx: 80, r: 60, d: .8, lift: 220, kb: 0, k: 'petal', n: 6, iv: .08 } },
      { name: '빛 창 투척', icon: '➹', mp: 12, cd: 4, a: 'c1a', b: 'c1b', t: .4, at: .14, proj: { k: 'spear', spd: 620, life: .8, r: 16, d: 2.4, kb: 120, pierce: 99 } },
      { name: '별가루 연무', icon: '✦', mp: 22, cd: 8, a: 'c2a', b: 'c1b', t: .9, at: .05, h: H({ x1: 105, d: .55, kb: 10, n: 9, iv: .08, st: .25, stop: .025, dy: 22 }), fx: ['rapid'] },
    ],
    ult: { name: '별비', a: 'ult', b: 'ult', t: 1.2, at: .3, area: { dx: 0, r: 400, d: 1.1, lift: 140, kb: 20, k: 'stars', n: 12, iv: .07 } },
  },
  mage: {
    name: '마법사', col: '#c17dff', col2: '#7df9ff', hp: 300, mp: 160, atk: 34, spd: 108, desc: '멀리서 불·얼음·번개로 한꺼번에', tag: '범위', stars: [2, 3, 5],
    combo: [
      { a: 'c1a', b: 'c1b', t: .32, at: .11, h: H({ x1: 60, d: .8, kb: 50, s: 'blunt' }), fx: ['arc', -.8, .8, 56] },
      { a: 'cast', b: 'cast', t: .34, at: .12, proj: { k: 'bolt', spd: 520, life: .7, r: 14, d: 1, kb: 60 } },
      { a: 'cast', b: 'cast', t: .44, at: .14, proj: { k: 'bolt', spd: 520, life: .7, r: 18, d: 1.6, kb: 140, ex: { r: 50, d: .8, lift: 120 } } },
    ],
    sk: [
      { name: '화염구', icon: '☄', mp: 14, cd: 3.5, a: 'cast', b: 'cast', t: .45, at: .16, proj: { k: 'fire', spd: 420, life: .9, r: 18, d: 1.4, kb: 80, ex: { r: 80, d: 2.2, lift: 200 } } },
      { name: '얼음 기둥', icon: '❄', mp: 18, cd: 6, a: 'up', b: 'up', t: .55, at: .2, area: { dx: 120, r: 60, d: 2.6, lift: 360, kb: 0, k: 'ice', delay: .15, frz: 1.2 } },
      { name: '번개 사슬', icon: 'ϟ', mp: 18, cd: 6, a: 'cast', b: 'cast', t: .5, at: .14, chain: { n: 5, d: 1.8, range: 260 } },
      { name: '순간 이동', icon: '⟲', mp: 10, cd: 4, a: 'cast', b: 'idle', t: .3, at: .02, blink: 150, area: { dx: 0, r: 70, d: 1, lift: 140, kb: 160, k: 'nova', back: 1 } },
    ],
    ult: { name: '유성 낙하', a: 'ult', b: 'ult', t: 1.3, at: .4, area: { dx: 150, r: 190, d: 18, lift: 400, kb: 240, k: 'meteor', delay: .55 } },
  },
  archer: {
    name: '아처', col: '#9dff8a', col2: '#ffd166', hp: 290, mp: 110, atk: 28, spd: 132, desc: '거리를 두고 꿰뚫는 화살로 압박', tag: '원거리', stars: [4, 4, 3],
    combo: [
      { a: 'idle', b: 'c1b', t: .24, at: .07, proj: { k: 'arrow', spd: 760, life: .6, r: 10, d: .8, kb: 40 } },
      { a: 'idle', b: 'c2b', t: .24, at: .07, proj: { k: 'arrow', spd: 760, life: .6, r: 10, d: .8, kb: 40 } },
      { a: 'cast', b: 'cast', t: .4, at: .15, proj: { k: 'arrow', spd: 820, life: .7, r: 12, d: 1.4, kb: 160, n: 3, spread: 16 } },
    ],
    sk: [
      { name: '물러서며 쏘기', icon: '⇤', mp: 10, cd: 3.5, a: 'jump', b: 'cast', t: .45, at: .2, move: -320, mt: .25, hop: 260, inv: 1, proj: { k: 'arrow', spd: 800, life: .6, r: 12, d: 1.1, kb: 80, n: 3, spread: 20 } },
      { name: '관통 화살', icon: '➳', mp: 14, cd: 5, a: 'cast', b: 'cast', t: .6, at: .32, proj: { k: 'pierce', spd: 1000, life: .8, r: 18, d: 3.2, kb: 200, pierce: 99, stop: .1 } },
      { name: '화살비', icon: '⇊', mp: 18, cd: 7, a: 'up', b: 'up', t: .5, at: .16, area: { dx: 170, r: 90, d: .55, lift: 0, kb: 10, k: 'rain', n: 10, iv: .09, delay: .2 } },
      { name: '덫 화살', icon: '✸', mp: 14, cd: 6, a: 'cast', b: 'cast', t: .4, at: .12, area: { dx: 60, r: 70, d: 2.6, lift: 300, kb: 60, k: 'trap', delay: .5 } },
    ],
    ult: { name: '폭풍 화살', a: 'cast', b: 'cast', t: 1.4, at: .1, proj: { k: 'arrow', spd: 900, life: .7, r: 12, d: 1.1, kb: 50, n: 2, spread: 30, rep: 16, iv: .07 } },
  },
  voodoo: {
    name: '부두술사', col: '#7dff9a', col2: '#b48bff', hp: 300, mp: 140, atk: 29, spd: 116, desc: '저주 인형으로 약하게 만들고 영혼을 부려요', tag: '저주·소환', stars: [3, 3, 4],
    combo: [
      { a: 'c1a', b: 'cast', t: .3, at: .1, proj: { k: 'needle', spd: 600, life: .35, r: 12, d: .8, kb: 30 } },
      { a: 'c1a', b: 'cast', t: .3, at: .1, proj: { k: 'needle', spd: 600, life: .35, r: 12, d: .8, kb: 30 } },
      { a: 'up', b: 'cast', t: .42, at: .15, area: { dx: 90, r: 50, d: 1.6, lift: 180, kb: 40, k: 'hex' } },
    ],
    sk: [
      { name: '저주 표식', icon: '⛧', mp: 12, cd: 5, a: 'cast', b: 'cast', t: .4, at: .14, area: { dx: 100, r: 90, d: .6, lift: 0, kb: 0, k: 'curse', curse: 6 } },
      { name: '영혼 불꽃', icon: '♨', mp: 16, cd: 5, a: 'cast', b: 'cast', t: .45, at: .14, proj: { k: 'wisp', spd: 300, life: 2.2, r: 14, d: 1.5, kb: 60, n: 3, spread: 40, home: 1, ex: { r: 40, d: .6, lift: 80 } } },
      { name: '토템 소환', icon: '♆', mp: 22, cd: 12, a: 'up', b: 'up', t: .5, at: .2, totem: { t: 7, iv: .55, d: .8 } },
      { name: '바늘 폭발', icon: '✳', mp: 20, cd: 7, a: 'spin', b: 'cast', t: .6, at: .25, pull: 160, area: { dx: 70, r: 100, d: 2.6, lift: 240, kb: 30, k: 'needles', delay: .15 } },
    ],
    ult: { name: '거대 인형 강림', a: 'ult', b: 'ult', t: 1.4, at: .5, area: { dx: 140, r: 180, d: 15, lift: 380, kb: 220, k: 'giant', delay: .45 } },
  },
};
const CLS = Object.keys(CL);

/* ---------- 적 ---------- */
const ET = {
  grunt: { name: '녹슨 정비병', hp: 160, atk: 16, spd: 70, w: 22, h: 86, sc: .56, rim: '#ff9a5a', exp: 12, desc: '균열 빛을 먹고 깨어난 정비 로봇. 렌치를 크게 휘둘러요.' },
  shield: { name: '방패 수리공', hp: 260, atk: 18, spd: 58, w: 26, h: 90, sc: .6, rim: '#ffb070', exp: 20, guard: 1, desc: '앞쪽 공격은 거의 막아요. 뒤로 돌아가거나 띄우세요.' },
  drone: { name: '전선 드론', hp: 90, atk: 14, spd: 90, w: 18, h: 30, fly: 70, rim: '#4fd8ff', exp: 10, desc: '공중에 떠서 전기 줄기를 내려요. 점프 공격이 잘 맞아요.' },
  elite: { name: '고압 정비반장', hp: 1500, atk: 26, spd: 62, w: 34, h: 120, sc: .82, rim: '#ff2a6a', exp: 120, armor: 1, desc: '맞아도 잘 밀리지 않는 덩치. 바닥 내려찍기를 조심하세요.' },
  boss: { name: '궤도 포식자 마그나 레일', hp: 9000, atk: 30, spd: 0, w: 70, h: 120, rim: '#ff2244', exp: 600, desc: '버려진 열차들이 엉켜 만든 거대 기계 지네. 돌진 뒤에 코어가 드러나요.' },
};
/* ---------- 방 ---------- */
const ROOMS = [
  { name: '승강장', L: 1000, waves: [['grunt', 'grunt', 'grunt'], ['grunt', 'drone', 'grunt', 'drone']], tip: '공격을 이어 누르면 콤보! 콤보 중에 기술을 누르면 끊고 이어져요' },
  { name: '선로 터널', L: 1100, haz: 'train', waves: [['shield', 'grunt', 'grunt'], ['drone', 'drone', 'shield', 'grunt']], tip: '빨간 줄이 깜빡이면 유령 열차가 지나가요. 위아래로 피하세요' },
  { name: '변전실', L: 1000, haz: 'volt', waves: [['grunt', 'drone', 'grunt'], ['elite', 'grunt']], tip: '바닥이 노랗게 깜빡이면 곧 전기가 흘러요' },
  { name: '화물 창고', L: 1100, crates: 1, waves: [['grunt', 'grunt', 'shield'], ['drone', 'drone', 'grunt', 'grunt'], ['shield', 'elite', 'drone']], tip: '상자를 부수면 회복 구슬과 재료가 나와요' },
  { name: '보스', L: 900, boss: 1, waves: [], tip: '돌진이 끝나면 코어가 드러나요. 그때 띄워서 몰아치세요!' },
];
/* ---------- 장비·동료·도감 ---------- */
const GRADE = [['일반', '#c9cfe0'], ['고급', '#6bff9a'], ['희귀', '#5aa8ff'], ['전설', '#ffa53d']];
const SLOT = { w: '무기', a: '옷', r: '장신구' };
const GEAR = {
  w: ['녹슨 날', '네온 날', '루멘 날', '별빛 날', '균열 파쇄기'],
  a: ['정비공 작업복', '방전 망토', '루멘 코트', '은하 갑주', '균열 수호복'],
  r: ['구리 반지', '전류 목걸이', '루멘 귀걸이', '별 조각 팔찌', '균열 심장'],
};
const PET = { name: '뭉치', forms: ['알', '아기 뭉치', '꼬마 뭉치', '큰 뭉치'], need: [0, 1, 5, 10], desc: '균열 빛을 좋아하는 솜뭉치 정령. 젤리를 먹고 자라요.' };

/* =================== 소리 (웹오디오 합성) =================== */
const A = { ctx: null, master: null, muted: false, last: {}, nb: null, next: 0, step: 0 };
try { A.muted = localStorage.getItem('raid_mute') === '1'; } catch (e) {}
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    A.ctx = new AC(); A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : .5;
    const comp = A.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; A.master.connect(comp); comp.connect(A.ctx.destination);
    A.mus = A.ctx.createGain(); A.mus.gain.value = .22; A.mus.connect(A.master);
    const n = A.ctx.sampleRate * .5, b = A.ctx.createBuffer(1, n, A.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; A.nb = b;
  } catch (e) { A.ctx = null; }
}
function tone(type, f, t, a, dur, f2, dest) {
  const o = A.ctx.createOscillator(), g = A.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * .85);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .004); g.gain.exponentialRampToValueAtTime(.0005, t + dur); o.connect(g); g.connect(dest || A.master); o.start(t); o.stop(t + dur + .02);
}
function noise(t, a, dur, ft, f0, f1, q) {
  const s = A.ctx.createBufferSource(); s.buffer = A.nb; const fl = A.ctx.createBiquadFilter(); fl.type = ft; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q || 1;
  const g = A.ctx.createGain(); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(.0005, t + dur); s.connect(fl); fl.connect(g); g.connect(A.master); s.start(t, Math.random() * .3); s.stop(t + dur + .02);
}
function sfx(k, p) {
  if (!A.ctx || A.muted) return; const t = A.ctx.currentTime; if (A.last[k] && t - A.last[k] < .03) return; A.last[k] = t; p = p || 1;
  if (k === 'swing') noise(t, .12, .13, 'bandpass', 900, 3800, 1.4);
  else if (k === 'slash') { noise(t, .5 * p, .07, 'highpass', 2400, 0, 1); tone('sine', 150 * p, t, .55, .13, 48); tone('square', 900, t, .05, .03, 300); }
  else if (k === 'blunt') { tone('sine', 120, t, .6, .16, 40); noise(t, .45, .09, 'lowpass', 1400, 300, 1); }
  else if (k === 'heavy') { tone('sine', 90, t, .9, .32, 30); noise(t, .7, .2, 'lowpass', 2200, 200, 1); noise(t, .35, .06, 'highpass', 3000, 0, 1); tone('sawtooth', 60, t, .2, .2, 35); }
  else if (k === 'magic') { tone('sawtooth', 600, t, .14, .2, 1500); tone('sine', 900, t, .12, .25, 300); }
  else if (k === 'boom') { tone('sine', 70, t, 1, .5, 25); noise(t, .8, .45, 'lowpass', 1600, 120, 1); }
  else if (k === 'arrow') { noise(t, .18, .08, 'highpass', 3000, 6000, 1); tone('triangle', 1200, t, .05, .05, 700); }
  else if (k === 'zap') { tone('sawtooth', 1400, t, .12, .16, 200); noise(t, .2, .12, 'bandpass', 4000, 1500, 3); }
  else if (k === 'ice') { tone('triangle', 1800, t, .12, .3, 900); noise(t, .3, .25, 'highpass', 5000, 2500, 1); tone('sine', 110, t, .5, .2, 50); }
  else if (k === 'jump') tone('triangle', 260, t, .1, .1, 520);
  else if (k === 'dash') noise(t, .25, .16, 'bandpass', 600, 2400, 1);
  else if (k === 'hurt') { tone('square', 200, t, .22, .2, 80); noise(t, .3, .1, 'lowpass', 1800, 400, 1); }
  else if (k === 'block') { tone('square', 1300, t, .12, .06, 900); tone('triangle', 2600, t, .07, .08, 2400); }
  else if (k === 'die') { tone('sine', 300, t, .3, .5, 60); noise(t, .4, .4, 'lowpass', 3000, 200, 1); }
  else if (k === 'pick') [880, 1320].forEach((f, i) => tone('sine', f, t + i * .05, .14, .12));
  else if (k === 'lv') [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, t + i * .07, .14, .22));
  else if (k === 'ult') { tone('sawtooth', 110, t, .3, .8, 440); [784, 988, 1175].forEach((f, i) => tone('sine', f, t + .1 + i * .08, .1, .4)); }
  else if (k === 'warn') [0, .18].forEach(d => tone('square', 660, t + d, .08, .12));
  else if (k === 'train') { noise(t, .6, .9, 'lowpass', 300, 1200, 1); tone('sawtooth', 70, t, .3, .9, 140); }
  else if (k === 'clear') [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, t + i * .08, .14, .3));
  else if (k === 'roar') { tone('sawtooth', 90, t, .4, 1.2, 50); tone('sawtooth', 96, t, .3, 1.2, 46); noise(t, .4, 1, 'lowpass', 800, 200, 1); }
  else if (k === 'pet') [1047, 1568].forEach((f, i) => tone('sine', f, t + i * .04, .08, .1));
}
// 배경음: 어두운 신스 베이스 + 하이햇. 보스 때 빨라짐
const PRG = [[38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 52, 55], [33, 45, 48, 52]];
function music(boss) {
  if (!A.ctx || A.muted) return; const bpm = boss ? 150 : 118, sp = 60 / bpm / 2, now = A.ctx.currentTime; if (A.next < now) A.next = now + .05;
  while (A.next < now + .2) {
    const s = A.step++, ch = PRG[(s >> 4) % 4], t = A.next, mf = n => 440 * Math.pow(2, (n - 69) / 12);
    if (s % 2 === 0) tone('sawtooth', mf(ch[0] - 12 + (s % 8 === 6 ? 12 : 0)), t, .35, sp * 1.6, 0, A.mus);
    if (s % 4 === 2) noise(t, .1, .04, 'highpass', 7000, 0, 1);
    if (s % 8 === 4 && boss) noise(t, .25, .12, 'bandpass', 1500, 400, 1);
    if (s % 8 === 0) tone('sine', 60, t, .6, .16, 40, A.mus);
    if (s % 3 === 0) tone('triangle', mf(ch[1 + (s >> 1) % 3] + 12), t, .08, sp * 1.2, 0, A.mus);
    A.next += sp;
  }
}

/* =================== 저장 (이 기기) =================== */
const SV = (() => { let s = null; try { s = JSON.parse(localStorage.getItem('raid_save') || 'null'); } catch (e) {} return s; })() || {};
function svFix() {
  SV.v = 1; SV.lv = SV.lv || {}; SV.xp = SV.xp || {}; for (const k of CLS) { SV.lv[k] = SV.lv[k] || 1; SV.xp[k] = SV.xp[k] || 0; }
  SV.gear = SV.gear || []; SV.eq = SV.eq || {}; SV.mats = Object.assign({ jelly: 0, stone: 0, gold: 0 }, SV.mats || {}); SV.ex = SV.ex || { d: '', n: 0 };
  SV.pet = Object.assign({ lv: 0, xp: 0 }, SV.pet || {}); SV.dex = Object.assign({ m: {}, g: {}, p: {} }, SV.dex || {}); SV.gid = SV.gid || 1; SV.clears = SV.clears || 0; SV.last = SV.last || 'knight';
}
svFix();
function save() { try { localStorage.setItem('raid_save', JSON.stringify(SV)); } catch (e) {} }
const need = lv => Math.round(120 * Math.pow(lv, 1.5));
const MAXLV = 20;
function guildLv() { let s = 0; for (const k of CLS) s += SV.lv[k] - 1; return 1 + Math.floor(s / 2); }
function gearOf(id) { return SV.gear.find(q => q.id === id); }
function gearVal(q) { const b = 4 + q.g * 5 + q.t * 2; return Math.round(b * (1 + q.p * .08)); }
function gearStat() { const r = { atk: 0, hp: 0 }; for (const s in SV.eq) { const q = gearOf(SV.eq[s]); if (!q) continue; const v = gearVal(q); if (s === 'w') r.atk += v; else if (s === 'a') r.hp += v; else { r.atk += v / 2; r.hp += v / 2; } } return r; }
function stats(k) {
  const c = CL[k], lv = SV.lv[k], gs = gearStat(), gl = guildLv(), dex = Object.keys(SV.dex.m).length;
  return { hp: Math.round(c.hp * (1 + .08 * (lv - 1)) * (1 + gs.hp / 100) * (1 + gl * .01)), atk: Math.round(c.atk * (1 + .07 * (lv - 1)) * (1 + gs.atk / 100) * (1 + gl * .01 + dex * .005)), mp: c.mp, spd: c.spd };
}
function power(k) { const s = stats(k); return Math.round(s.atk * 12 + s.hp * 1.5 + SV.pet.lv * 20); }
const KDAY = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), EX_MAX = 5, EX_GOLD = 300;
function petForm() { const l = SV.pet.lv; return l <= 0 ? 0 : l < 5 ? 1 : l < 10 ? 2 : 3; }
function addGear(slot, g, t) { const q = { id: SV.gid++, s: slot, g, t, p: 0 }; SV.gear.push(q); SV.dex.g[slot + t + '_' + g] = 1; const cur = gearOf(SV.eq[slot]); if (!cur || gearVal(q) > gearVal(cur)) SV.eq[slot] = q.id; if (SV.gear.length > 40) { SV.gear.sort((a, b) => gearVal(b) - gearVal(a)); const keep = new Set(Object.values(SV.eq)); SV.gear = SV.gear.filter((q2, i) => i < 36 || keep.has(q2.id)); } return q; }
function gearName(q) { return GEAR[q.s][q.t] + (q.p ? ' +' + q.p : ''); }

/* =================== 상태 =================== */
let opts, ov, cv, x, panel, btnBar, lay, G = null, raf = 0, last = 0, acc = 0, paused = false, SPR = {}, SPK = 0, BG = {};
let VW = 640; const VH = 360, FY0 = 236, FY1 = 342;
const keys = {}, touch = { on: false, stick: null, btn: {} };
let inp = { mx: 0, my: 0, atk: 0, atkH: 0, jump: 0, dash: 0, sk: [0, 0, 0, 0], ult: 0 };

/* =================== 스프라이트 준비 =================== */
function sprK() { return clamp(.5 * lay.s * lay.dpr, .5, 1.5); }
function buildSprites(cls) {
  const k = sprK(); if (SPR.cls === cls && SPK === k) return; SPK = k; const c = CL[cls];
  SPR = { cls, p: {}, e: {} };
  if (ATL.sp[cls]) SPR.p = ATL.sp[cls]; else for (const f of FRAMES) SPR.p[f] = bake(ART[cls], joints(f), k, c.col, c.col2, [360, 300, 30]);
  for (const t of ['grunt', 'shield', 'elite']) {
    const fn = EART[t], sh = t === 'shield', ek = lay.s * lay.dpr * ET[t].sc;
    SPR.e[t] = {
      w0: bake(fn, { ph: 0, shield: sh }, ek, ET[t].rim, '#7df9ff'), w1: bake(fn, { ph: 1.6, shield: sh }, ek, ET[t].rim, '#7df9ff'), w2: bake(fn, { ph: -1.6, shield: sh }, ek, ET[t].rim, '#7df9ff'),
      wind: bake(fn, { ph: 0, arm: -1.9, lean: -.2, shield: sh }, ek, ET[t].rim, '#7df9ff'), hit: bake(fn, { ph: .8, arm: 1.3, lean: .3, shield: sh }, ek, ET[t].rim, '#7df9ff'),
      hurt: bake(fn, { ph: .4, hurt: 1, arm: .9, shield: sh }, ek, ET[t].rim, '#7df9ff'),
    };
  }
  SPR.car = bake(carArt, 0, lay.s * lay.dpr * .66, '#ff5a7a', '#7df9ff', [190, 150, 20]); SPR.head = bake(headArt, 0, lay.s * lay.dpr * .8, '#ff5a7a', '#7df9ff', [320, 200, 20]);
  SPR.crate = bake(crateArt, 0, k, '#ffb070', '#7df9ff', [90, 90, 10]);
  for (const k2 of CLS) if (!SPR['por_' + k2]) SPR['por_' + k2] = ATL.sp[k2] ? ATL.sp[k2].idle : bake(ART[k2], joints('idle'), k * .8, CL[k2].col, CL[k2].col2);
}
function carArt(g) {
  shape(g, [[-70, -110], [64, -114], [78, -96], [76, -34], [62, -22], [-66, -22], [-78, -36], [-80, -96]], lg(g, 0, -114, 0, -22, [[0, '#4d5578'], [.5, '#2a304a'], [1, '#141828']]));
  for (let i = 0; i < 4; i++) { g.save(); g.shadowColor = '#ff2244'; g.shadowBlur = 10; shape(g, [[-58 + i * 32, -92], [-36 + i * 32, -92], [-36 + i * 32, -70], [-58 + i * 32, -70]], '#ff3d5a', 0); g.restore(); }
  curve(g, [[-74, -56], [74, -56]], 'rgba(255,90,110,.6)', 2); g.fillStyle = '#0a0b12';
  [[-44, -16], [44, -16]].forEach(w => { g.beginPath(); g.arc(w[0], w[1], 15, 0, TAU); g.fill(); dot(g, w[0], w[1], 4, '#ff6a6a'); });
  shape(g, [[-14, -128], [14, -128], [16, -112], [-16, -112]], '#2b2f44'); dot(g, 0, -122, 3, '#ffb347');
}
function headArt(g) {
  shape(g, [[80, -150], [-30, -160], [-96, -110], [-120, -50], [-110, -10], [-40, 6], [80, -6], [96, -60]], lg(g, 0, -160, 0, 6, [[0, '#5a6288'], [.6, '#262b42'], [1, '#121522']]));
  shape(g, [[-104, -30], [-150, -8], [-138, 14], [-40, 14], [-50, -14]], '#202436');
  for (let i = 0; i < 7; i++) shape(g, [[-138 + i * 14, 2], [-131 + i * 14, 18], [-124 + i * 14, 2]], '#d9deef', 0);
  g.save(); g.shadowColor = '#ff2244'; g.shadowBlur = 24; shape(g, [[-80, -96], [-40, -108], [-28, -90], [-70, -78]], '#ff2244'); g.restore(); dot(g, -56, -94, 5, '#fff');
  curve(g, [[40, -144], [-20, -136]], 'rgba(255,90,110,.6)', 2.5); curve(g, [[60, -20], [-30, -12]], 'rgba(255,90,110,.6)', 2.5);
  for (let i = 0; i < 3; i++) dot(g, 20 + i * 18, -80, 3, '#ffb347');
}
function crateArt(g) {
  shape(g, [[-34, -64], [34, -66], [36, 0], [-36, 0]], lg(g, 0, -66, 0, 0, [[0, '#8a6a46'], [1, '#4e3a26']]), .2);
  curve(g, [[-30, -60], [30, -4]], '#3a2a1a', 4); curve(g, [[30, -60], [-30, -4]], '#3a2a1a', 4); curve(g, [[-34, -33], [34, -33]], '#3a2a1a', 3);
  dot(g, 0, -33, 3, '#7df9ff');
}

/* =================== 판 시작·방 =================== */
function newRun(cls) {
  SV.last = cls; save(); buildSprites(cls); const st = stats(cls);
  G = { cls, c: CL[cls], st, t: 0, room: -1, kills: 0, combo: 0, comboT: 0, maxCombo: 0, score: 0, rooms: 0, hitN: 0, shake: 0, stop: 0, slow: 0, flash: 0, fade: 0, mode: 'play', cont: 0, drops: { gear: [], jelly: 0, stone: 0, xp: 0, gold: 0 }, pauseLeft: NET.on ? 0 : 1, petT: 1, bossDead: 0, eid: 0,
    P: { x: 120, y: 290, z: 0, vx: 0, vz: 0, f: 1, hp: st.hp, mp: st.mp, ult: 0, act: null, ci: 0, cq: 0, cd: [0, 0, 0, 0], inv: 0, hurt: 0, down: 0, run: 0, dashT: 0, lastTap: {}, air: 0 },
    pet: petForm() ? { x: 80, y: 280, z: 30, t: 0 } : null,
  };
  nextRoom();
}
function nextRoom() {
  G.room++; const R = ROOMS[G.room]; G.R = R; G.L = R.L; G.wave = -1; G.en = []; G.pr = []; G.ar = []; G.fx = []; G.tx = []; G.it = []; G.ep = []; G.haz = []; G.totems = [];
  G.camX = 0; G.gate = 0; G.roomT = 0; G.roomHits = 0; G.tipT = 5; G.hazT = 3; G.boss = null;
  const P = G.P; P.x = 90 - (NET.on ? NET.slot() * 22 : 0); P.y = 292 - (NET.on ? NET.slot() * 16 : 0); P.z = 0; P.vx = 0; P.vz = 0; P.f = 1; P.act = null; G.fade = 1;
  if (P.ghost) { P.ghost = 0; P.hp = Math.round(G.st.hp * .5); P.inv = 2; P.down = 0; P.hurt = 0; tx(P.x, P.y - 120, '다시 일어났어요!', '#6bff9a', 14); }
  if (NET.guest) return; // 협동 손님: 적은 방장이 보내 준다
  if (R.crates) for (let i = 0; i < 5; i++) G.en.push(mkEnemy('crate', 300 + i * 160, FY0 + 20 + (i * 37) % 80));
  if (R.boss) { const b = mkEnemy('boss', 760, 296); G.boss = b; G.en.push(b); b.st = 'enter'; b.tm = 2.2; sfx('roar'); G.shake = 8; }
  else spawnWave();
}
function mkEnemy(t, ex, ey) {
  if (t === 'crate') return { id: ++G.eid, t, x: ex, y: ey, z: 0, vx: 0, vz: 0, f: -1, hp: 60, mhp: 60, w: 26, h: 50, st: 'idle', tm: 0, fl: 0, crate: 1 };
  const d = ET[t], m = 1 + G.room * .12;
  const e = { id: ++G.eid, t, x: ex, y: ey, z: d.fly || 0, vx: 0, vz: 0, f: -1, hp: Math.round(d.hp * m), mhp: Math.round(d.hp * m), w: d.w, h: d.h, st: 'walk', tm: rnd(.3, 1), fl: 0, stun: 0, jug: 0, curse: 0, frz: 0, ph: 0, cdA: rnd(.8, 1.6) };
  if (t === 'boss') { e.segs = []; for (let i = 0; i < 6; i++) e.segs.push({ x: ex + 70 + i * 64, y: ey - 20 + Math.sin(i) * 14 }); e.ph2 = 0; e.core = 0; e.cool = 2; e.hp = e.mhp = Math.round(d.hp * (1 + (SV.lv[G.cls] - 1) * .05)); }
  return e;
}
function spawnWave() {
  G.wave++; const W = G.R.waves[G.wave]; if (!W) return false;
  W.forEach((t, i) => { const side = i % 2 === 0 ? 1 : -1, ex = side > 0 ? G.camX + VW + 30 + i * 30 : Math.max(-20, G.camX - 40 - i * 20), ey = FY0 + 12 + ((i * 47 + G.wave * 23) % (FY1 - FY0 - 24)); const e = mkEnemy(t, side < 0 && G.camX < 40 ? G.camX + VW + 60 + i * 25 : ex, ey); e.spawnT = .4; G.en.push(e); });
  return true;
}

/* =================== 플레이어 =================== */
function startAct(def, kind, idx) {
  const P = G.P; P.act = { def, t: 0, kind, idx, did: 0, hitN: 0, rep: 0, hitSet: new Set() }; P.run = 0;
  if (def.move) { P.vx = def.move * P.f; P.mt = def.mt; }
  if (def.hop) { P.vz = def.hop; P.air = 1; }
  if (def.inv) P.inv = Math.max(P.inv, .3);
  if (def.blink) { P.x = clamp(P.x - P.f * def.blink, 20, G.L - 20); burst(P.x, P.y, 60, G.c.col, 18, 160); }
  if (def.step) P.vx = def.step * P.f * 4;
  if (kind !== 'combo' || def.proj) sfx(def.proj ? (def.proj.k === 'arrow' || def.proj.k === 'pierce' ? 'arrow' : 'magic') : 'swing'); else sfx('swing');
}
function playerUpdate(dt) {
  const P = G.P, c = G.c; P.inv -= dt; P.hurt -= dt; for (let i = 0; i < 4; i++) P.cd[i] -= dt; P.ultCd = (P.ultCd || 0) - dt;
  P.mp = Math.min(G.st.mp, P.mp + dt * 6);
  if (P.ghost) { P.act = null; physics(P, dt, 1); return; }
  if (P.down > 0) { P.down -= dt; physics(P, dt, 1); return; }
  const mx = inp.mx, my = inp.my, A_ = P.act;
  // 입력: 기술(취소 가능), 필살기, 공격
  const canCancel = !A_ || (A_.t >= A_.def.at && !A_.isUlt);
  for (let i = 0; i < 4; i++) if (inp.sk[i]) {
    const s = c.sk[i]; inp.sk[i] = 0;
    if (P.hurt > 0) continue;
    if (P.cd[i] > 0) { tip(P, '⏳'); continue; } if (P.mp < s.mp) { tip(P, '기력 부족'); continue; }
    if (canCancel && !(A_ && A_.kind === 'sk' && A_.idx === i)) { if (mx) P.f = Math.sign(mx); P.mp -= s.mp; P.cd[i] = s.cd; startAct(s, 'sk', i); G.flash = Math.max(G.flash, .08); }
  }
  if (inp.ult) { inp.ult = 0; if (P.ult >= 100 && canCancel && P.hurt <= 0) { P.ult = 0; startAct(c.ult, 'ult', 0); P.act.isUlt = 1; P.inv = c.ult.t + .3; G.slow = .5; G.ultFx = 1; sfx('ult'); G.shake = 5; } else if (P.ult < 100) tip(P, '필살기 ' + Math.floor(P.ult) + '%'); }
  if (inp.atk || inp.atkH) {
    if (!P.act && P.hurt <= 0) { P.ci = 0; if (mx) P.f = Math.sign(mx); startAct(c.combo[0], 'combo', 0); inp.atk = 0; }
    else if (P.act && P.act.kind === 'combo' && P.act.t > P.act.def.at * .6) P.cq = 1;
    inp.atk = 0;
  }
  if (inp.jump && !P.air && !P.act && P.hurt <= 0) { P.vz = 360; P.air = 1; sfx('jump'); }
  inp.jump = 0;
  if (inp.dash && P.hurt <= 0 && (!P.act || canCancel) && (P.dashT || 0) <= 0) { if (mx) P.f = Math.sign(mx); P.act = null; P.dashT = .45; P.dashing = .2; P.vx = 380 * P.f; P.inv = Math.max(P.inv, .22); sfx('dash'); burst(P.x, P.y, 10, '#ffffff', 6, 80); }
  inp.dash = 0; P.dashT -= dt;
  if (P.dashing > 0) { P.dashing -= dt; physics(P, dt, 0); return; }
  if (P.act) actUpdate(dt);
  else if (P.hurt <= 0) {
    const sp = G.st.spd; P.vx = mx * sp; P.vy = my * sp * .6; if (mx) P.f = Math.sign(mx);
    P.y = clamp(P.y + P.vy * dt, FY0, FY1); P.run = (mx || my) ? P.run + dt : 0;
  }
  physics(P, dt, 0);
  P.x = clamp(P.x, 16, G.L - 16);
}
function physics(o, dt, fric) {
  if (o.mt > 0) { o.mt -= dt; if (o.mt <= 0) o.vx *= .2; }
  o.x += o.vx * dt;
  if (o.z > 0 || o.vz) { o.vz -= 1100 * dt; o.z += o.vz * dt; if (o.z <= 0) { o.z = 0; o.vz = 0; if (o.air) { o.air = 0; } } }
  if (o === G.P && !o.act && o.hurt <= 0 && !(o.dashing > 0)) { if (o.z <= 0) o.vx = inp.mx * G.st.spd; }
  else if (!(o.mt > 0) && !(o.dashing > 0)) o.vx *= Math.pow(fric ? .02 : .0009, dt);
}
function actUpdate(dt) {
  const P = G.P, A_ = P.act, d = A_.def; A_.t += dt;
  if (!A_.did && A_.t >= d.at) { A_.did = 1; fire(d); }
  if (A_.did && d.h && d.h.n > 1 && A_.hitN < d.h.n && A_.t >= d.at + A_.hitN * d.h.iv) { A_.hitSet.clear(); melee(d, A_); }
  if (d.proj && d.proj.rep && A_.rep < d.proj.rep && A_.t >= d.at + A_.rep * d.proj.iv) { A_.rep++; shoot(d.proj); }
  if (d.area && d.area.n > 1 && A_.areaN < d.area.n && A_.t >= d.at + A_.areaN * d.area.iv) { A_.areaN++; area(d.area, A_.areaN); }
  if (A_.t >= d.t) {
    P.act = null;
    if (A_.kind === 'combo' && (P.cq || inp.atkH) && A_.idx < G.c.combo.length - 1) { P.cq = 0; startAct(G.c.combo[A_.idx + 1], 'combo', A_.idx + 1); }
    else P.cq = 0;
  }
}
function fire(d) {
  const P = G.P, A_ = P.act;
  if (d.h) melee(d, A_);
  if (d.proj && !d.proj.rep) shoot(d.proj); else if (d.proj && d.proj.rep) { A_.rep = 1; shoot(d.proj); }
  if (d.area) { A_.areaN = 1; area(d.area, 1); }
  if (d.chain) chain(d.chain);
  if (d.totem) { G.totems.push({ x: P.x + P.f * 40, y: P.y, t: d.totem.t, iv: d.totem.iv, cd: .2, d: d.totem.d }); burst(P.x + P.f * 40, P.y, 40, G.c.col, 14, 120); }
  if (d.pull) for (const e of G.en) if (!e.crate && e.t !== 'boss' && Math.abs(e.x - P.x) < d.pull && Math.abs(e.y - P.y) < 60) { e.x = lerp(e.x, P.x + P.f * 60, .7); e.y = lerp(e.y, P.y, .6); }
  if (d.fx) slashFx(d.fx);
}
function melee(d, A_) {
  const P = G.P, h = d.h; A_.hitN++;
  for (const e of G.en) {
    if (e.dead || e.spawnT > 0 || A_.hitSet.has(e)) continue;
    if (e.t === 'boss') { if (!bossHit(e, P.x, P.f, h)) continue; }
    else { const rx = (e.x - P.x) * P.f; if (rx < h.x0 - e.w || rx > h.x1 + e.w) continue; if (Math.abs(e.y - P.y) > h.dy) continue; if (e.z > h.z1 + P.z || e.z + e.h < h.z0 + P.z) continue; }
    A_.hitSet.add(e); hit(e, h, P.f, (e.x + P.x) / 2 + P.f * 14);
  }
}
function shoot(p) {
  const P = G.P, n = p.n || 1;
  for (let i = 0; i < n; i++) {
    const off = n > 1 ? (i - (n - 1) / 2) * (p.spread || 10) : 0;
    G.pr.push({ k: p.k, x: P.x + P.f * 30, y: P.y + off * .6, z: P.z + 52 + (p.k === 'wave' ? -46 : 0) + off * .3, vx: P.f * p.spd, vy: off * (p.home ? 3 : .4), f: P.f, life: p.life, p, hit: new Set(), t: 0 });
  }
  if (NET.on) NET.cast({ k: 'pr', a: G.pr.slice(-n).map(q => ({ k: q.k, x: q.x | 0, y: q.y | 0, z: q.z | 0, vx: q.vx | 0, vy: q.vy | 0, f: q.f, life: q.life, p: { k: p.k, r: p.r, spd: p.spd } })) });
  if (p.k === 'wave') { G.shake = Math.max(G.shake, 5); sfx('heavy'); }
}
function area(a, nIdx) {
  const P = G.P; let ax = P.x + P.f * (a.dx || 0), ay = P.y;
  if (a.k === 'stars' || a.k === 'rain' || a.k === 'petal') { ax += rnd(-1, 1) * (a.k === 'stars' ? 260 : a.k === 'rain' ? a.r * .8 : 20); ay = clamp(ay + rnd(-30, 30), FY0, FY1); if (a.k === 'stars') ax = clamp(ax, G.camX + 20, G.camX + VW - 20); }
  if (a.back) ax = P.x + P.f * 150;
  G.ar.push({ a, x: ax, y: ay, t: -(a.delay || 0), done: 0, f: P.f });
}
function areaUpdate(dt) {
  for (const r of G.ar) {
    r.t += dt; if (r.done || r.t < 0) continue; r.done = 1; const a = r.a;
    const big = a.k === 'sword' || a.k === 'meteor' || a.k === 'giant';
    for (const e of G.en) {
      if (e.dead || e.spawnT > 0) continue; const dx = e.x - r.x, dy = (e.y - r.y) * 1.8;
      if (e.t === 'boss' ? Math.abs(dx) > a.r + 70 : dx * dx + dy * dy > (a.r + e.w) * (a.r + e.w)) continue;
      const h = H({ d: a.d, kb: a.kb, lift: a.lift, st: .5, stop: big ? .16 : a.n ? .03 : .08, sh: big ? 12 : a.n ? 1 : 4, s: big ? 'heavy' : a.k === 'ice' ? 'ice' : a.n ? 'slash' : 'blunt' });
      hit(e, h, Math.sign(dx) || r.f, e.x);
      if (a.frz) e.frz = a.frz; if (a.curse) { e.curse = a.curse; tx(e.x, e.y - e.h - 20, '저주!', '#7dff9a', 12); }
    }
    if (big) { G.flash = .6; G.shake = 14; G.slow = .4; sfx('boom'); burst(r.x, r.y, 20, G.c.col, 40, 380); ring(r.x, r.y, a.r, G.c.col); }
    else if (a.k === 'ice') { sfx('ice'); burst(r.x, r.y, 60, '#bdf6ff', 18, 200); }
    else if (a.k === 'trap' || a.k === 'needles' || a.k === 'hex' || a.k === 'nova') { sfx(a.k === 'nova' ? 'magic' : 'blunt'); burst(r.x, r.y, 30, G.c.col, 16, 200); ring(r.x, r.y, a.r, G.c.col); }
    else if (a.k === 'curse') { sfx('magic'); ring(r.x, r.y, a.r, '#7dff9a'); }
    G.fx.push({ k: 'area', a, x: r.x, y: r.y, t: 0, life: big ? 1 : a.k === 'ice' ? .8 : .45, f: r.f });
  }
  G.ar = G.ar.filter(r => !r.done || r.t < 0);
}
function chain(c) {
  const P = G.P; let from = { x: P.x + P.f * 30, y: P.y, z: P.z + 60 }; const used = new Set(); sfx('zap');
  for (let i = 0; i < c.n; i++) {
    let best = null, bd = c.range; for (const e of G.en) { if (e.dead || e.crate || used.has(e) || e.spawnT > 0) continue; const d = Math.hypot(e.x - from.x, (e.y - from.y) * 1.5); if (d < bd && (i > 0 || (e.x - P.x) * P.f > -20)) { bd = d; best = e; } }
    if (!best) break; used.add(best); const to = { x: best.x, y: best.y, z: best.z + best.h * .6 };
    G.fx.push({ k: 'bolt', x: from.x, y: from.y - from.z, x2: to.x, y2: to.y - to.z, t: 0, life: .25 });
    hit(best, H({ d: c.d, kb: 40, lift: 60, st: .5, stop: .05, sh: 2, s: 'zap' }), Math.sign(best.x - P.x) || 1, best.x); from = to;
  }
}
function tip(P, s) { if (G.tipCd > 0) return; G.tipCd = .6; tx(P.x, P.y - P.z - 110, s, '#ffd166', 12); }

/* =================== 타격 =================== */
function hit(e, h, dir, hx) {
  const P = G.P; if (e.dead) return;
  let dmg = G.st.atk * h.d * rnd(.92, 1.08); const crit = Math.random() < .1; if (crit) dmg *= 1.6;
  if (e.curse > 0) dmg *= 1.3; if (e.t === 'boss' && e.core > 0) dmg *= 1.6;
  let blocked = false;
  if (ET[e.t] && ET[e.t].guard && e.z <= 0 && e.st !== 'hurt' && e.st !== 'down' && Math.sign(e.f) === -dir && !h.lift && h.d < 2.5) { dmg *= .15; blocked = true; }
  dmg = Math.max(1, Math.round(dmg)); e.hp -= dmg; e.fl = .09; G.roomHits++;
  if (NET.guest) NET.hit(e, dmg, h, dir, blocked);
  const big = h.s === 'heavy' || h.d >= 2;
  if (blocked) { sfx('block'); spark(hx, e.y - e.z - e.h * .55, '#ffd0a0', 10); tx(e.x, e.y - e.z - e.h - 8, '막힘', '#ffd0a0', 11); e.vx = dir * 40; G.stop = Math.max(G.stop, .03); return; }
  sfx(h.s === 'heavy' ? 'heavy' : h.s, big ? 1.2 : 1);
  // 히트스톱·흔들림
  G.stop = Math.max(G.stop, h.stop * (crit ? 1.4 : 1)); G.shake = Math.max(G.shake, h.sh * (crit ? 1.5 : 1));
  const hy = e.y - e.z - e.h * .55; spark(hx, hy, G.c.col, big ? 26 : 16); if (big) G.fx.push({ k: 'impact', x: hx, y: hy, t: 0, life: .18, col: G.c.col });
  shards(hx, hy, big ? 14 : 7, e.crate ? '#c49a5a' : ET[e.t] ? ET[e.t].rim : '#fff', dir);
  tx(e.x + rnd(-10, 10), e.y - e.z - e.h - 14, dmg.toLocaleString(), crit ? '#ffd166' : '#ffffff', crit ? 22 : big ? 18 : 15, crit);
  G.combo++; G.comboT = 2; G.maxCombo = Math.max(G.maxCombo, G.combo); P.ult = Math.min(100, P.ult + (G.P.act && G.P.act.isUlt ? 0 : 1.6)); P.mp = Math.min(G.st.mp, P.mp + 1);
  react(e, h, dir, big);
}
// 맞은 뒤 밀림·띄우기·쓰러짐 (내 타격과 협동 동료의 타격이 같이 쓴다)
function react(e, h, dir, big) {
  if (e.crate) { dieCheck(e, dir); return; }
  if (!ET[e.t]) return;
  const armor = ET[e.t].armor || e.t === 'boss';
  if (e.t === 'boss') { dieCheck(e, dir); return; }
  const kbm = armor && e.st !== 'stun' ? .25 : 1;
  e.vx = dir * h.kb * kbm * 2.2; e.f = -dir;
  if ((h.lift || e.z > 0) && !(armor && e.z <= 0 && h.lift < 300)) {
    const decay = Math.pow(.86, e.jug); e.vz = Math.max(e.vz, (h.lift || 120) * decay * (e.t === 'drone' ? .6 : 1)); e.jug++; e.st = 'air'; e.air = 1;
  } else if (!armor || big) { e.st = 'hurt'; e.tm = h.st * (armor ? .4 : 1); }
  e.stun = 0;
  dieCheck(e, dir);
}
// 협동 손님은 처치를 정하지 않는다(방장이 처치 신호를 보냄)
function dieCheck(e, dir) { if (e.hp > 0) return; if (NET.guest) { e.hp = 1; return; } kill(e, dir); }
function kill(e, dir) {
  if (e.dead) return; if (NET.host && e.id) NET.cast({ k: 'kill', id: e.id, dir });
  e.dead = 1; G.kills++; const ex = e.x, ey = e.y - e.z - e.h * .5;
  if (e.crate) { burst(ex, ey, 20, '#c49a5a', 18, 220); sfx('blunt'); const r = Math.random(); G.it.push({ k: r < .5 ? 'orb' : r < .8 ? 'jelly' : 'stone', x: ex, y: e.y, z: 20, vz: 200, t: 0 }); return; }
  SV.dex.m[e.t] = (SV.dex.m[e.t] || 0) + 1;
  G.drops.xp += ET[e.t].exp; burst(ex, ey, 30, ET[e.t].rim, e.t === 'boss' ? 80 : 26, e.t === 'boss' ? 420 : 260); sfx('die');
  // 빛 조각으로 흩어짐(잔인한 표현 없음)
  G.fx.push({ k: 'ghost', e, x: e.x, y: e.y, z: e.z, t: 0, life: .45, f: e.f, dir });
  const lastOne = !G.en.some(o => !o.dead && !o.crate);
  if (lastOne || e.t === 'elite' || e.t === 'boss') { G.slow = e.t === 'boss' ? 1.6 : .7; G.stop = Math.max(G.stop, .12); G.shake = Math.max(G.shake, 10); }
  const dr = (k, n) => { for (let i = 0; i < n; i++) G.it.push({ k, x: e.x + rnd(-20, 20), y: clamp(e.y + rnd(-10, 10), FY0, FY1), z: 20, vz: rnd(180, 280), t: 0 }); };
  { const gv = e.t === 'boss' ? 800 : e.t === 'elite' ? 200 : Math.round(rnd(18, 36)); G.it.push({ k: 'gold', v: gv, x: e.x, y: e.y, z: 20, vz: 240, t: 0 }); }
  if (Math.random() < .35) dr('jelly', 1); if (Math.random() < .15) dr('stone', 1);
  const gp = e.t === 'boss' ? 1 : e.t === 'elite' ? .6 : .05; if (Math.random() < gp) dr('gear', 1); if (e.t === 'boss') { dr('gear', 1); dr('jelly', 4); dr('stone', 3); }
}
function bossHit(b, px, f, h) {
  // 머리 + 드러난 코어만 맞음
  const hx = b.x - b.f * 20; const rx = (hx - px) * f; if (rx > h.x0 - 90 && rx < h.x1 + 90 && Math.abs(b.y - G.P.y) < h.dy + 30) return true;
  if (b.core > 0) { const c = b.segs[2]; if (c) { const r2 = (c.x - px) * f; if (r2 > h.x0 - 50 && r2 < h.x1 + 50 && Math.abs(c.y - G.P.y) < h.dy + 30) return true; } }
  return false;
}
/* =================== 적 =================== */
function hurtP(dmg, dir, knock, src) {
  const P = G.P; if (P.inv > 0 || G.mode !== 'play' || G.god || P.ghost) return false;
  P.hp -= dmg; P.inv = knock ? 1.1 : .55; P.hurt = knock ? .5 : .3; P.act = null; P.vx = dir * (knock ? 260 : 120); G.combo = 0; G.roomHits += 0; G.hurtN = (G.hurtN || 0) + 1;
  if (knock) { P.vz = 260; P.air = 1; P.down = .75; }
  sfx('hurt'); G.shake = Math.max(G.shake, 6); G.stop = Math.max(G.stop, .06); G.redT = .35; tx(P.x, P.y - P.z - 110, '-' + dmg, '#ff5e7e', 16);
  if (P.hp <= 0) { P.hp = 0; sfx('die'); if (NET.on) { P.ghost = 1; P.act = null; tx(P.x, P.y - 130, '쓰러짐… 동료가 방을 정리하면 다시 일어나요', '#ffb3c6', 12); NET.dead(); } else { G.mode = 'dying'; G.deadT = 1.4; G.slow = 1.2; } }
  return true;
}
function enemyUpdate(e, dt) {
  const P = NET.on ? tgt(e) : G.P, d = ET[e.t]; e.fl -= dt; e.curse -= dt;
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  if (e.frz > 0) { e.frz -= dt; physE(e, dt); return; }
  if (e.st === 'air') { physE(e, dt); if (e.z <= 0 && e.vz <= 0) { e.st = 'down'; e.tm = .55; e.jug = 0; G.shake = Math.max(G.shake, 2); burst(e.x, e.y, 6, '#ffffff', 5, 60); } return; }
  if (e.st === 'down') { e.tm -= dt; physE(e, dt); if (e.tm <= 0) { e.st = 'walk'; e.tm = .3; } return; }
  if (e.st === 'hurt') { e.tm -= dt; physE(e, dt); if (e.tm <= 0) { e.st = 'walk'; e.tm = rnd(.1, .4); } return; }
  physE(e, dt); e.tm -= dt; const dx = P.x - e.x, dy = P.y - e.y;
  if (e.t === 'drone') {
    e.z = lerp(e.z, d.fly + Math.sin(G.t * 3 + e.x) * 8, .1);
    if (e.st === 'walk') { const tx2 = P.x - Math.sign(dx || 1) * 90; e.x += clamp(tx2 - e.x, -1, 1) * d.spd * dt; e.y += clamp(dy, -1, 1) * d.spd * .5 * dt; e.f = Math.sign(dx) || 1; if (e.tm <= 0 && Math.abs(dx) < 220) { e.st = 'wind'; e.tm = .8; } }
    else if (e.st === 'wind' && e.tm <= 0) { e.st = 'walk'; e.tm = rnd(1.6, 2.6); epush({ k: 'zap', x: e.x, y: e.y, z: e.z, vx: e.f * 260, vy: clamp(dy, -60, 60), life: 1.4, d: d.atk, t: 0 }); sfx('zap'); }
    return;
  }
  const rng = e.t === 'elite' ? 70 : 50;
  if (e.st === 'walk') {
    e.f = Math.sign(dx) || e.f; const far = Math.abs(dx) > rng || Math.abs(dy) > 12;
    if (far) { const sp = d.spd * (e.curse > 0 ? .7 : 1); e.x += clamp(dx - Math.sign(dx) * (rng - 10), -1, 1) * sp * dt; e.y += clamp(dy, -1, 1) * sp * .6 * dt; e.ph += dt * 7; }
    if (!far && e.tm <= 0) { e.st = 'wind'; e.tm = e.t === 'elite' ? .7 : .5; }
  } else if (e.st === 'wind') {
    if (e.tm <= 0) { e.st = 'swing'; e.tm = .35; e.slam = e.t === 'elite' && Math.random() < .5 ? 1 : 0; swingHit(e); }
  } else if (e.st === 'swing') { if (e.tm <= 0) { e.st = 'walk'; e.tm = rnd(.9, 1.6); } }
  e.y = clamp(e.y, FY0, FY1);
}
// 적이 휘두르는 순간: 이 기기의 내 캐릭터만 판정(협동에서는 각자 자기 몸을 판정)
function swingHit(e) {
  const P = G.P, d = ET[e.t], rng = e.t === 'elite' ? 70 : 50; sfx('swing');
  if (e.slam) { G.fx.push({ k: 'slam', x: e.x + e.f * 40, y: e.y, t: 0, life: .5 }); G.shake = Math.max(G.shake, 6); sfx('heavy'); if (Math.abs(P.x - e.x - e.f * 40) < 110 && Math.abs(P.y - e.y) < 40 && P.z < 20) hurtP(d.atk + 8, Math.sign(P.x - e.x) || 1, 1); }
  else if (Math.abs(P.x - e.x) < rng + 26 && (P.x - e.x) * e.f > -10 && Math.abs(P.y - e.y) < 22 && P.z < 60) hurtP(d.atk, e.f, e.t === 'elite');
}
function epush(q) { G.ep.push(q); if (NET.host) NET.cast({ k: 'ep', q }); }
function physE(e, dt) {
  e.x += e.vx * dt; e.vx *= Math.pow(e.z > 0 ? .3 : .004, dt);
  if (e.st === 'air' || e.z > 0 && e.t !== 'drone') { e.vz -= 1100 * dt * (e.jug > 6 ? 1.4 : 1); e.z += e.vz * dt; if (e.z < 0) { e.z = 0; } }
  e.x = clamp(e.x, 10, G.L - 10);
}
/* =================== 보스: 궤도 포식자 =================== */
function bossUpdate(b, dt) {
  const P = NET.on ? tgt(b) : G.P, d = ET.boss; b.fl -= dt; b.core -= dt; b.curse -= dt;
  // 몸통 칸: 앞 칸을 일정 간격으로 따라감(밧줄처럼)
  let prev = { x: b.x - b.f * 70, y: b.y }; for (const s2 of b.segs) { const dx = s2.x - prev.x, dy = (s2.y - prev.y), l = Math.hypot(dx, dy) || 1, D = 64; if (l > D) { s2.x = prev.x + dx / l * D; s2.y = prev.y + dy / l * D; } s2.y = clamp(s2.y, FY0 - 40, FY1); prev = s2; }
  if (!b.ph2 && b.hp < b.mhp * .5) { b.ph2 = 1; b.st = 'roar'; b.tm = 1.2; sfx('roar'); G.shake = 10; tx(b.x, b.y - 170, '분노!', '#ff2244', 20); }
  b.tm -= dt;
  if (b.st === 'enter') { b.x -= 140 * dt; b.f = -1; if (b.tm <= 0) { b.st = 'idle'; b.tm = 1.5; } return; }
  if (b.st === 'roar') { if (b.tm <= 0) { b.st = 'idle'; b.tm = .8; } return; }
  if (b.st === 'idle') {
    const tx2 = clamp(P.x + 230 * (b.x > P.x ? 1 : -1), 160, G.L - 160); b.x += clamp(tx2 - b.x, -1, 1) * 70 * dt; b.y += clamp(P.y - b.y, -1, 1) * 40 * dt; b.f = P.x < b.x ? -1 : 1;
    if (b.tm <= 0) { const r = Math.random(), opts2 = b.ph2 ? ['charge', 'volley', 'laser', 'summon'] : ['charge', 'volley', 'charge', 'summon']; b.st = opts2[(Math.random() * opts2.length) | 0]; if (b.st === 'summon' && G.en.filter(e => !e.dead && e.t !== 'boss').length > 2) b.st = 'volley';
      if (b.st === 'charge') { b.tm = .95; b.lane = P.y; sfx('warn'); b.dir = P.x < b.x ? -1 : 1; }
      if (b.st === 'volley') { b.tm = 1.4; b.n = b.ph2 ? 7 : 5; b.iv = 0; }
      if (b.st === 'laser') { b.tm = 2.2; b.cols = [P.x + rnd(-30, 30), P.x - 170, P.x + 170].map(v => clamp(v, 40, G.L - 40)); sfx('warn'); }
      if (b.st === 'summon') { b.tm = 1; for (let i = 0; i < 2; i++) { const e = mkEnemy(i ? 'drone' : 'grunt', b.x + rnd(-60, 60), clamp(b.y + rnd(-40, 40), FY0, FY1)); e.spawnT = .5; G.en.push(e); } sfx('roar'); }
    }
    return;
  }
  if (b.st === 'charge') {
    if (b.tm > 0) { b.y += clamp(b.lane - b.y, -1, 1) * 120 * dt; return; }
    b.x += b.dir * (b.ph2 ? 640 : 540) * dt; b.f = b.dir; G.shake = Math.max(G.shake, 2); bossHurt(b);
    if ((b.dir > 0 && b.x > G.L - 110) || (b.dir < 0 && b.x < 110)) { b.st = 'stun'; b.tm = 2.6; b.core = 2.6; G.shake = 12; sfx('boom'); burst(b.x + b.dir * 60, b.y - 50, 20, '#ffb347', 30, 300); tx(b.x, b.y - 170, '코어 노출!', '#ffd166', 18); }
    return;
  }
  if (b.st === 'stun') { if (b.tm <= 0) { b.st = 'idle'; b.tm = b.ph2 ? .9 : 1.4; } return; }
  if (b.st === 'volley') {
    b.iv -= dt; if (b.iv <= 0 && b.n > 0) { b.n--; b.iv = .2; const tx2 = clamp(P.x + rnd(-90, 90), 30, G.L - 30), ty = clamp(P.y + rnd(-30, 30), FY0, FY1); epush({ k: 'bomb', x: b.x, y: b.y, z: 140, tx: tx2, ty, life: .9, T: .9, d: d.atk * .8, t: 0, sx: b.x, sy: b.y }); sfx('arrow'); }
    if (b.tm <= 0) { b.st = 'idle'; b.tm = 1.2; } return;
  }
  if (b.st === 'laser') {
    if (b.tm < 1.1 && !b.fired) { b.fired = 1; sfx('zap'); G.shake = 6; }
    bossHurt(b);
    if (b.tm <= 0) { b.st = 'idle'; b.tm = 1; b.fired = 0; } return;
  }
  if (b.st === 'summon') { if (b.tm <= 0) { b.st = 'idle'; b.tm = 1.2; } }
}
// 보스 돌진·레이저: 이 기기의 내 캐릭터만 판정(방장·손님 모두)
function bossHurt(b) {
  const P = G.P, d = ET.boss;
  if (b.st === 'charge' && b.tm <= 0 && Math.abs(P.x - b.x) < 70 && Math.abs(P.y - b.y) < 34 && P.z < 80) hurtP(d.atk, b.dir, 1);
  if (b.st === 'laser' && b.cols && b.tm < 1.1 && b.tm > .4) for (const cx of b.cols) if (Math.abs(P.x - cx) < 26) hurtP(d.atk, Math.sign(P.x - cx) || 1, 0);
}
/* =================== 투사체·위험·토템·동료·아이템 =================== */
function projUpdate(dt) {
  for (const p of G.pr) {
    p.t += dt; p.life -= dt;
    if (p.p.home) { let best = null, bd = 300; for (const e of G.en) { if (e.dead || e.crate) continue; const dd = Math.hypot(e.x - p.x, e.y - p.y); if (dd < bd) { bd = dd; best = e; } } if (best && p.t > .15) { const a = Math.atan2(best.y - p.y, best.x - p.x); p.vx = lerp(p.vx, Math.cos(a) * p.p.spd, .08); p.vy = lerp(p.vy, Math.sin(a) * p.p.spd * .6, .08); p.z = lerp(p.z, best.z + best.h * .5, .05); } }
    p.x += p.vx * dt; p.y += (p.vy || 0) * dt;
    if (p.vis) continue; // 협동 동료의 투사체(보이기만)
    for (const e of G.en) {
      if (e.dead || e.spawnT > 0 || p.hit.has(e)) continue;
      const h = H({ d: p.p.d, kb: p.p.kb, lift: p.p.lift || 0, st: .35, stop: p.p.stop || (p.k === 'wave' ? .07 : .04), sh: p.p.d >= 2 ? 4 : 1.5, s: p.k === 'arrow' || p.k === 'pierce' || p.k === 'needle' ? 'slash' : p.k === 'wave' ? 'heavy' : 'blunt' });
      let ok = false; if (e.t === 'boss') ok = bossHit(e, p.x - p.f * 20, p.f, H({ x0: -10, x1: 20, dy: 14 }));
      else ok = Math.abs(e.x - p.x) < e.w + p.p.r && Math.abs(e.y - p.y) < 22 + p.p.r * .4 && p.z > e.z - 10 && p.z < e.z + e.h + 10 || (p.k === 'wave' && Math.abs(e.x - p.x) < e.w + 26 && Math.abs(e.y - p.y) < 30 && e.z < 40);
      if (!ok) continue; p.hit.add(e); hit(e, h, p.f, p.x);
      if (p.p.ex) { boom(p.x, p.y, p.p.ex, p.f); p.life = 0; break; }
      if (!p.p.pierce) { p.life = 0; break; }
    }
    if (p.life <= 0 && p.p.ex && !p.boomed && !p.vis) { p.boomed = 1; boom(p.x, p.y, p.p.ex, p.f); }
  }
  G.pr = G.pr.filter(p => p.life > 0);
  // 적 투사체
  const P = G.P;
  for (const q of G.ep) {
    q.t += dt; q.life -= dt;
    if (q.k === 'zap') { q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.max(20, q.z - 40 * dt); if (Math.abs(P.x - q.x) < 16 && Math.abs(P.y - q.y) < 16 && P.z < q.z + 30 && P.z + 90 > q.z) { if (hurtP(q.d, Math.sign(q.vx), 0)) q.life = 0; } }
    if (q.k === 'bomb') { const u = 1 - q.life / q.T; q.x = lerp(q.sx, q.tx, u); q.y = lerp(q.sy, q.ty, u); q.z = 140 * (1 - u) + Math.sin(u * Math.PI) * 120; if (q.life <= 0) { burst(q.tx, q.ty, 10, '#ff8a3d', 18, 200); sfx('blunt'); G.shake = Math.max(G.shake, 3); if (Math.hypot(P.x - q.tx, (P.y - q.ty) * 1.8) < 44 && P.z < 40) hurtP(q.d, Math.sign(P.x - q.tx) || 1, 0); } }
  }
  G.ep = G.ep.filter(q => q.life > 0);
}
function boom(bx, by, ex, f) { sfx('boom'); G.shake = Math.max(G.shake, 5); burst(bx, by, 40, G.c.col, 20, 240); ring(bx, by, ex.r, G.c.col); for (const e of G.en) { if (e.dead || e.spawnT > 0) continue; if (Math.hypot(e.x - bx, (e.y - by) * 1.8) < ex.r + e.w) hit(e, H({ d: ex.d, kb: 80, lift: ex.lift, st: .4, stop: .05, sh: 3, s: 'blunt' }), Math.sign(e.x - bx) || f, e.x); } }
function hazUpdate(dt) {
  const R = G.R, P = G.P; if (!R.haz || G.gate) { G.haz = []; return; }
  G.hazT -= dt;
  if (G.hazT <= 0 && !NET.guest) {
    if (R.haz === 'train') { const ly = clamp(P.y + rnd(-14, 14), FY0 + 14, FY1 - 14); hpush({ k: 'train', y: ly, t: 0, warn: 1.1, dir: Math.random() < .5 ? 1 : -1 }); G.hazT = rnd(6, 8); sfx('warn'); }
    if (R.haz === 'volt') { const xs = []; for (let i = 0; i < 3; i++) xs.push(G.camX + 80 + i * (VW - 160) / 2 + rnd(-40, 40)); hpush({ k: 'volt', xs, t: 0, warn: 1.2 }); G.hazT = rnd(5, 7); sfx('warn'); }
  }
  for (const h of G.haz) {
    h.t += dt;
    if (h.k === 'train' && h.t > h.warn && !h.go) { h.go = 1; sfx('train'); G.shake = 6; }
    if (h.k === 'train' && h.go && h.t < h.warn + .5 && Math.abs(P.y - h.y) < 18 && P.z < 60) hurtP(24 + G.room * 3, h.dir, 1);
    if (h.k === 'train' && h.go && h.t < h.warn + .5 && !NET.guest) for (const e of G.en) if (!e.dead && !e.crate && e.t !== 'boss' && Math.abs(e.y - h.y) < 18 && e.z < 40 && !e.trainHit) { e.trainHit = 1; hit(e, H({ d: 2, kb: 300, lift: 260, st: .6, stop: .02, sh: 0, s: 'blunt' }), h.dir, e.x); }
    if (h.k === 'volt' && h.t > h.warn && h.t < h.warn + 1.2) { if (!h.z) { h.z = 1; sfx('zap'); } for (const vx of h.xs) if (Math.abs(P.x - vx) < 44 && P.z < 10) hurtP(14 + G.room * 2, Math.sign(P.x - vx) || 1, 0); }
  }
  G.haz = G.haz.filter(h => h.t < h.warn + 1.4);
}
function hpush(h) { G.haz.push(h); if (NET.host) NET.cast({ k: 'haz', h }); }
function totemUpdate(dt) {
  for (const t of G.totems) {
    t.t -= dt; t.cd -= dt;
    if (t.cd <= 0) { t.cd = t.iv; let best = null, bd = 320; for (const e of G.en) { if (e.dead || e.crate || e.spawnT > 0) continue; const d = Math.hypot(e.x - t.x, e.y - t.y); if (d < bd) { bd = d; best = e; } }
      if (best) { G.pr.push({ k: 'wisp', x: t.x, y: t.y, z: 60, vx: Math.sign(best.x - t.x) * 300, vy: 0, f: Math.sign(best.x - t.x) || 1, life: 1.4, p: { k: 'wisp', spd: 300, r: 12, d: t.d, kb: 30, home: 1 }, hit: new Set(), t: 0 }); } }
  }
  G.totems = G.totems.filter(t => t.t > 0);
}
function petUpdate(dt) {
  const p = G.pet; if (!p) return; const P = G.P, form = petForm();
  const tx2 = P.x - P.f * 46, ty = P.y - 10; p.x = lerp(p.x, tx2, Math.min(1, dt * 4)); p.y = lerp(p.y, ty, Math.min(1, dt * 4)); p.z = 46 + Math.sin(G.t * 4) * 6; p.f = P.f;
  G.petT -= dt;
  if (G.petT <= 0) {
    G.petT = [3, 2.6, 2.2, 1.7][form]; let best = null, bd = 260; for (const e of G.en) { if (e.dead || e.crate || e.spawnT > 0) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    if (best) { G.fx.push({ k: 'petz', x: p.x, y: p.y - p.z, x2: best.x, y2: best.y - best.z - best.h * .5, t: 0, life: .3 }); sfx('pet'); const h = H({ d: .25 + form * .12 + SV.pet.lv * .02, kb: 20, st: .15, stop: .015, sh: 0, s: 'blunt' }); hit(best, h, Math.sign(best.x - p.x) || 1, best.x); }
  }
}
function itemUpdate(dt) {
  const P = G.P, mag = G.pet ? 70 + petForm() * 30 : 40;
  for (const q of G.it) {
    q.t += dt; if (q.z > 0 || q.vz > 0) { q.vz -= 900 * dt; q.z = Math.max(0, q.z + q.vz * dt); if (q.z === 0) q.vz = q.vz < -120 ? -q.vz * .3 : 0; }
    const dx = P.x - q.x, dy = P.y - q.y, d = Math.hypot(dx, dy);
    if (q.t > .5 && d < mag) { q.x += dx * dt * 8; q.y += dy * dt * 8; }
    if (q.t > .4 && d < 20 && !P.ghost) {
      q.got = 1; sfx('pick');
      if (q.k === 'orb') { const v = Math.round(G.st.hp * .25); P.hp = Math.min(G.st.hp, P.hp + v); tx(P.x, P.y - 110, '+' + v, '#6bff9a', 14); }
      if (q.k === 'gold') { G.drops.gold += q.v; tx(P.x, P.y - 100, '+' + q.v + 'G', '#ffd166', 12); }
      if (q.k === 'jelly') { G.drops.jelly++; tx(P.x, P.y - 110, '반짝 젤리', '#ffb3e6', 12); }
      if (q.k === 'stone') { G.drops.stone++; tx(P.x, P.y - 110, '강화석', '#7df9ff', 12); }
      if (q.k === 'gear') { const slot = ['w', 'a', 'r'][(Math.random() * 3) | 0], r = Math.random(), g = G.room >= 4 ? (r < .3 ? 3 : r < .8 ? 2 : 1) : (r < .55 ? 0 : r < .85 ? 1 : r < .97 ? 2 : 3), t = clamp(Math.floor(G.room / 1.5 + rnd(0, 1.5)), 0, 4); const q2 = addGear(slot, g, t); G.drops.gear.push(q2); tx(P.x, P.y - 120, GRADE[g][0] + ' · ' + gearName(q2), GRADE[g][1], 13); save(); }
    }
  }
  G.it = G.it.filter(q => !q.got);
}
/* =================== 효과 =================== */
function burst(bx, by, h, col, n, sp) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(.3, 1) * sp; G.fx.push({ k: 'p', x: bx, y: by - h * rnd(.3, 1), vx: Math.cos(a) * v, vy: Math.sin(a) * v * .7 - 60, t: 0, life: rnd(.3, .7), col, r: rnd(1.5, 3.5) }); } }
function spark(sx, sy, col, sz) { G.fx.push({ k: 'spark', x: sx, y: sy, t: 0, life: .14, col, sz, a: rnd(0, TAU) }); }
function shards(sx, sy, n, col, dir) { for (let i = 0; i < n; i++) { const a = rnd(-.9, .9) + (dir > 0 ? 0 : Math.PI), v = rnd(120, 380); G.fx.push({ k: 'shard', x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: rnd(.25, .5), col, r: rnd(2, 5), rot: rnd(0, TAU) }); } }
function ring(rx, ry, r, col) { G.fx.push({ k: 'ring', x: rx, y: ry, r, t: 0, life: .4, col }); }
function tx(tx0, ty, s, col, sz, crit) { G.tx.push({ x: tx0, y: ty, s, col, sz, t: 0, crit }); }
function slashFx(fx) { const P = G.P; G.fx.push({ k: fx[0], a0: fx[1], a1: fx[2], r: fx[3] || fx[1], x: P.x, y: P.y, z: P.z, f: P.f, t: 0, life: fx[0] === 'spin' ? .9 : fx[0] === 'rapid' ? .9 : .16, col: G.c.col, col2: G.c.col2 }); }
function fxUpdate(dt) {
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.k === 'shard' ? 900 : 300) * dt; f.vx *= .96; } if (f.k === 'spin' || f.k === 'rapid' || f.k === 'dash') { f.x = G.P.x; f.y = G.P.y; f.z = G.P.z; f.f = G.P.f; } }
  G.fx = G.fx.filter(f => f.t < f.life); for (const t of G.tx) { t.t += dt; t.y -= dt * (t.t < .15 ? 160 : 30); } G.tx = G.tx.filter(t => t.t < .9);
}
/* =================== 방 진행·끝 =================== */
function roomUpdate(dt) {
  G.roomT += dt; const alive = G.en.filter(e => !e.dead && !e.crate).length;
  if (!NET.guest && !G.gate && alive === 0 && !G.R.boss) { if (!spawnWave()) { G.gate = 1; roomClear(); if (NET.host) NET.cast({ k: 'gate' }); } }
  if (G.R.boss && G.boss && G.boss.dead && !G.bossDead) { G.bossDead = 1; G.endT = 2.4; }
  if (G.bossDead) { G.endT -= dt; if (G.endT <= 0 && G.mode === 'play') finish(true); }
  if (!NET.guest && G.gate && G.room < ROOMS.length - 1 && (G.P.x > G.L - 40 || NET.atGate())) { nextRoom(); if (NET.host) NET.cast({ k: 'room', n: G.room }); }
}
function roomClear() {
  G.rooms++; const t = G.roomT, hits = G.hurtN || 0; G.hurtN = 0; const sc = (t < 40 ? 3 : t < 70 ? 2 : 1) + (hits === 0 ? 2 : hits < 3 ? 1 : 0) + (G.maxCombo > 30 ? 1 : 0);
  const rk = sc >= 5 ? 'S' : sc >= 4 ? 'A' : sc >= 3 ? 'B' : 'C'; G.rank = { r: rk, t: 2.2 }; G.score += { S: 8000, A: 6000, B: 4500, C: 3000 }[rk]; G.ranks = (G.ranks || '') + rk;
  sfx('clear');
  if (G.room === 0 && SV.pet.lv === 0) { SV.pet.lv = 1; SV.dex.p['1'] = 1; save(); G.pet = { x: G.P.x - 40, y: G.P.y, z: 40, t: 0 }; G.hatch = 2.5; burst(G.P.x - 40, G.P.y, 50, '#ffd6f5', 40, 200); sfx('lv'); }
}
function finish(clear) {
  if (G.mode === 'over') return; G.mode = 'over'; const P = G.P;
  const tSec = G.t; let score = G.score + G.kills * 60 + G.maxCombo * 30; if (clear) score += 40000 + Math.max(0, 40000 - Math.round(tSec * 60));
  G.result = { clear, score: Math.round(score), time: tSec, ranks: G.ranks || '', kills: G.kills, combo: G.maxCombo, cls: G.cls };
  // 경험치·젤리·강화석 반영
  const k = G.cls, xpGain = Math.round(G.drops.xp * (clear ? 1.5 : 1)); const lv0 = SV.lv[k]; SV.xp[k] += xpGain;
  while (SV.lv[k] < MAXLV && SV.xp[k] >= need(SV.lv[k])) { SV.xp[k] -= need(SV.lv[k]); SV.lv[k]++; }
  SV.mats.jelly += G.drops.jelly; SV.mats.stone += G.drops.stone; SV.mats.gold += G.drops.gold; if (clear) SV.clears++; save();
  G.result.xp = xpGain; G.result.lvUp = SV.lv[k] - lv0;
  if (!G.debug && G.result.score > 0 && opts.submit) opts.submit(G.result.score);
  if (G.bot) return; showResult();
}

/* =================== 그리기 =================== */
const THEME = [
  { wall: ['#16183a', '#0d0e24'], stripe: '#2bd4c4', lamp: '#ffcf7a', floor: ['#1a1b38', '#08080f'], sign: '7 루멘 광장', glow: 'rgba(170,90,255,.2)' },
  { wall: ['#1a1622', '#0b0910'], stripe: '#ff5a7a', lamp: '#ff9a6b', floor: ['#17141c', '#070609'], sign: '선로 B-2', glow: 'rgba(255,60,90,.14)' },
  { wall: ['#14202e', '#0a1018'], stripe: '#ffd23f', lamp: '#bdf6ff', floor: ['#132030', '#070b10'], sign: '변전실 ⚡', glow: 'rgba(80,200,255,.18)' },
  { wall: ['#221a14', '#100c08'], stripe: '#ff9a3d', lamp: '#ffd8a0', floor: ['#1f1912', '#090705'], sign: '화물 창고 3', glow: 'rgba(255,150,60,.14)' },
  { wall: ['#220c18', '#0e050a'], stripe: '#ff2244', lamp: '#ff6a8a', floor: ['#1e0d16', '#08040a'], sign: '균열 심부', glow: 'rgba(255,40,80,.25)' },
];
function buildBg(i) {
  const T = THEME[i], k = lay.s * lay.dpr, W = 640, Hh = FY0, c = mkc(W * k, Hh * k), g = c.getContext('2d'); g.scale(k, k);
  g.fillStyle = lg(g, 0, 0, 0, Hh, [[0, '#05060f'], [.4, T.wall[0]], [1, T.wall[1]]]); g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#07081a'; g.fillRect(0, 0, W, 54); for (let b = 0; b < 4; b++) { g.fillStyle = '#0c0d22'; g.fillRect(20 + b * 160, 0, 18, 60); }
  for (let l = 0; l < 3; l++) { const lx = 40 + l * 220; g.save(); g.shadowColor = T.lamp; g.shadowBlur = 16; g.fillStyle = l === 1 && i === 1 ? '#3a2a30' : T.lamp; g.fillRect(lx, 56, 80, 4); g.restore();
    g.fillStyle = lg(g, 0, 60, 0, Hh, [[0, T.lamp + '30'], [1, T.lamp + '00']]); g.beginPath(); g.moveTo(lx, 60); g.lineTo(lx + 80, 60); g.lineTo(lx + 130, Hh); g.lineTo(lx - 50, Hh); g.fill(); }
  g.strokeStyle = 'rgba(160,170,255,.07)'; g.lineWidth = 1;
  for (let y = 70; y < Hh; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let y = 70, r = 0; y < Hh; y += 16, r++) for (let xx = (r % 2) * 16; xx < W; xx += 32) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + 16); g.stroke(); }
  for (let n = 0; n < 40; n++) { g.fillStyle = 'rgba(0,0,0,' + rnd(.08, .2) + ')'; g.beginPath(); g.ellipse(rnd(0, W), rnd(70, Hh), rnd(10, 50), rnd(4, 20), 0, 0, TAU); g.fill(); }
  g.fillStyle = T.stripe; g.globalAlpha = .55; g.fillRect(0, 150, W, 6); g.globalAlpha = .2; g.fillRect(0, 149, W, 1); g.globalAlpha = 1;
  // 기둥
  for (let p = 0; p < 2; p++) { const px = 120 + p * 320; g.fillStyle = lg(g, px, 0, px + 34, 0, [[0, '#0b0c1e'], [.5, '#1d1f44'], [1, '#090a18']]); g.fillRect(px, 54, 34, Hh - 54); g.fillStyle = T.stripe + '55'; g.fillRect(px + 3, 160, 28, 2); }
  // 표지판
  g.save(); g.fillStyle = 'rgba(8,20,24,.9)'; g.beginPath(); g.roundRect(250, 86, 150, 34, 6); g.fill(); g.shadowColor = T.stripe; g.shadowBlur = 10; g.strokeStyle = T.stripe; g.lineWidth = 1.5; g.stroke(); g.restore();
  g.fillStyle = '#eafffb'; g.font = '700 15px ' + FONT_K; g.textAlign = 'center'; g.fillText(T.sign, 325, 109);
  // 균열(배경)
  g.save(); g.translate(540, 110); g.fillStyle = rg(g, 0, 0, 0, 90, [[0, T.glow.replace(/[\d.]+\)$/, '.6)')], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.arc(0, 0, 90, 0, TAU); g.fill();
  g.shadowColor = '#b46bff'; g.shadowBlur = 20; shape(g, [[0, -60], [8, -30], [2, 0], [10, 30], [0, 58], [-6, 28], [-2, 0], [-10, -30]], lg(g, 0, -60, 0, 60, [[0, '#7df9ff'], [.5, '#f1e3ff'], [1, '#c084ff']]), .3); g.restore();
  return c;
}
function draw() {
  const g = x; g.setTransform(lay.dpr * lay.s, 0, 0, lay.dpr * lay.s, lay.ox * lay.dpr, lay.oy * lay.dpr); g.save(); g.beginPath(); g.rect(0, 0, VW, VH); g.clip(); g.imageSmoothingEnabled = true;
  if (!G) { g.fillStyle = '#07061a'; g.fillRect(0, 0, VW, VH); g.restore(); return; }
  const sh = G.shake > .3 ? G.shake : 0, cx = G.camX + rnd(-sh, sh), cy = rnd(-sh, sh) * .6;
  const T = THEME[G.room] || THEME[0];
  // 배경(시차)
  if (!BG[G.room] || BG.k !== lay.s * lay.dpr) { if (BG.k !== lay.s * lay.dpr) BG = { k: lay.s * lay.dpr }; BG[G.room] = buildBg(G.room); }
  const bg = BG[G.room], px = -(cx * .55) % 640;
  for (let i = -1; i < VW / 640 + 1; i++) g.drawImage(bg, px + i * 640, cy, 640, FY0);
  g.fillStyle = lg(g, 0, FY0 - 12, 0, VH, [[0, T.floor[0]], [1, T.floor[1]]]); g.fillRect(0, FY0 - 12 + cy, VW, VH);
  g.fillStyle = T.stripe; g.globalAlpha = .7; g.fillRect(0, FY0 - 12 + cy, VW, 3); g.globalAlpha = 1;
  g.strokeStyle = 'rgba(160,170,255,.07)'; g.lineWidth = 1; const off = -cx % 60;
  for (let i = -2; i < VW / 60 + 3; i++) { const lx = off + i * 60; g.beginPath(); g.moveTo(lx, FY0 - 9 + cy); g.lineTo(lx + (lx - VW / 2) * .5, VH); g.stroke(); }
  for (const yy of [FY0 + 14, FY0 + 40, FY0 + 72, FY0 + 108]) { g.beginPath(); g.moveTo(0, yy + cy); g.lineTo(VW, yy + cy); g.stroke(); }
  g.fillStyle = rg(g, VW * .5, FY0 + 50, 0, VW * .6, [[0, T.glow], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, FY0 - 12, VW, VH);
  g.save(); g.translate(-cx, cy);
  // 위험 표시
  for (const h of G.haz) {
    if (h.k === 'train') { if (h.t < h.warn) { g.fillStyle = 'rgba(255,40,70,' + (.12 + .12 * Math.sin(h.t * 30)) + ')'; g.fillRect(cx - 20, h.y - 16, VW + 40, 32); g.strokeStyle = 'rgba(255,60,90,.8)'; g.setLineDash([8, 6]); g.strokeRect(cx - 20, h.y - 16, VW + 40, 32); g.setLineDash([]); }
      else { const u = (h.t - h.warn) / .5, tx0 = h.dir > 0 ? cx - 600 + u * (VW + 1200) : cx + VW + 600 - u * (VW + 1200); g.save(); g.globalAlpha = .85; g.fillStyle = lg(g, tx0 - 300, 0, tx0 + 300, 0, [[0, 'rgba(255,60,90,0)'], [.5, 'rgba(255,220,230,.95)'], [1, 'rgba(255,60,90,0)']]); g.fillRect(tx0 - 300, h.y - 60, 600, 62); g.restore(); } }
    if (h.k === 'volt') for (const vx of h.xs) { const on = h.t > h.warn; g.fillStyle = on ? 'rgba(255,230,90,' + (.35 + .3 * Math.random()) + ')' : 'rgba(255,210,63,' + (.1 + .12 * Math.sin(h.t * 24)) + ')'; g.beginPath(); g.ellipse(vx, (FY0 + FY1) / 2, 44, (FY1 - FY0) / 2 + 6, 0, 0, TAU); g.fill(); if (on) { g.strokeStyle = '#fff6b0'; g.lineWidth = 1.5; for (let z = 0; z < 3; z++) { g.beginPath(); let yy = FY0; g.moveTo(vx + rnd(-30, 30), yy); while (yy < FY1) { yy += 14; g.lineTo(vx + rnd(-36, 36), yy); } g.stroke(); } } }
  }
  if (G.boss && G.boss.st === 'charge' && G.boss.tm > 0) { const b = G.boss; g.fillStyle = 'rgba(255,40,70,' + (.15 + .15 * Math.sin(G.t * 30)) + ')'; g.fillRect(cx - 20, b.lane - 26, VW + 40, 52); }
  if (G.boss && G.boss.st === 'laser') for (const lx of G.boss.cols) { const on = G.boss.tm < 1.1 && G.boss.tm > .4; g.fillStyle = on ? 'rgba(255,80,120,.55)' : 'rgba(255,40,70,' + (.12 + .1 * Math.sin(G.t * 26)) + ')'; g.fillRect(lx - 26, 0, 52, VH); if (on) { g.fillStyle = 'rgba(255,240,245,.9)'; g.fillRect(lx - 6, 0, 12, VH); } }
  for (const q of G.ep) if (q.k === 'bomb') { g.strokeStyle = 'rgba(255,90,60,.8)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(q.tx, q.ty, 40 * (1 - q.life / q.T) + 6, 12, 0, 0, TAU); g.stroke(); }
  // 깊이 순서대로
  const L = []; for (const e of G.en) if (!e.dead) L.push(e); L.push(G.P); for (const q of peerShadows()) L.push(q); if (G.pet) L.push(G.pet); for (const t of G.totems) L.push({ totem: t, y: t.y }); for (const q of G.it) L.push({ item: q, y: q.y });
  L.sort((a, b) => a.y - b.y);
  for (const o of L) { g.fillStyle = 'rgba(0,0,0,.45)'; const sw = o === G.P || o.peer ? 26 : o.t === 'boss' ? 90 : o.w || 12; if (!o.item && !o.totem) { g.beginPath(); g.ellipse(o.x, o.y, sw * (1 - Math.min(.5, (o.z || 0) / 300)), 6, 0, 0, TAU); g.fill(); } }
  for (const o of L) { if (o === G.P) drawP(g); else if (o.peer) drawPeer(g, o.peer); else if (o === G.pet) drawPet(g, o); else if (o.item) drawItem(g, o.item); else if (o.totem) drawTotem(g, o.totem); else if (o.t === 'boss') drawBoss(g, o); else drawE(g, o); }
  for (const p of G.pr) drawProj(g, p);
  for (const q of G.ep) { if (q.k === 'zap') { dot(g, q.x, q.y - q.z, 6, '#7ff3ff'); } if (q.k === 'bomb') { dot(g, q.x, q.y - q.z, 7, '#ff8a3d'); } }
  drawFx(g);
  for (const t of G.tx) { const sc = t.t < .1 ? 1 + (1 - t.t / .1) * .8 : 1; g.save(); g.globalAlpha = t.t > .6 ? 1 - (t.t - .6) / .3 : 1; g.translate(t.x, t.y); g.scale(sc, sc); g.font = '400 ' + t.sz + 'px ' + FONT_K; g.textAlign = 'center'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(t.s, 0, 0); g.fillStyle = t.col; g.fillText(t.s, 0, 0); if (t.crit) { g.font = '400 9px ' + FONT_K; g.fillStyle = '#ff5e7e'; g.fillText('치명타', 0, -t.sz); } g.restore(); }
  if (G.gate && G.room < ROOMS.length - 1) { const ax = G.L - 60, pulse = Math.sin(G.t * 6) * 6; g.save(); g.shadowColor = '#7df9ff'; g.shadowBlur = 16; g.fillStyle = '#7df9ff'; g.font = '400 26px ' + FONT_K; g.textAlign = 'center'; g.fillText('GO ▶', ax + pulse, FY0 - 30); g.restore(); }
  g.restore();
  // 화면 효과
  if (G.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(.6, G.flash) + ')'; g.fillRect(0, 0, VW, VH); }
  if (G.redT > 0) { g.fillStyle = rg(g, VW / 2, VH / 2, VH * .3, VW * .7, [[0, 'rgba(255,0,40,0)'], [1, 'rgba(255,0,40,' + G.redT + ')']]); g.fillRect(0, 0, VW, VH); }
  if (G.ultFx > 0) { g.fillStyle = 'rgba(0,0,0,' + G.ultFx * .35 + ')'; g.fillRect(0, 0, VW, VH); g.save(); g.globalAlpha = Math.min(1, G.ultFx * 2); g.fillStyle = G.c.col; g.font = '400 30px ' + FONT_K; g.textAlign = 'center'; g.shadowColor = G.c.col; g.shadowBlur = 20; g.fillText(G.c.ult.name + '!', VW / 2, 120); g.restore(); }
  g.fillStyle = rg(g, VW / 2, VH / 2, VH * .45, VW * .72, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.55)']]); g.fillRect(0, 0, VW, VH);
  hud(g);
  if (G.fade > 0) { g.fillStyle = 'rgba(4,3,12,' + G.fade + ')'; g.fillRect(0, 0, VW, VH); }
  if (paused || G.cnt > 0) { g.fillStyle = 'rgba(4,3,12,' + (paused ? .9 : .5) + ')'; g.fillRect(0, 0, VW, VH); g.fillStyle = '#fff'; g.font = '400 28px ' + FONT_K; g.textAlign = 'center'; g.fillText(paused ? '일시정지' : String(Math.ceil(G.cnt)), VW / 2, VH / 2); if (paused) { g.font = '400 13px ' + FONT_K; g.fillStyle = '#cfc8ff'; g.fillText(G.autoP ? '화면을 누르면 다시 시작해요' : 'Ⅱ 버튼을 누르면 다시 시작해요', VW / 2, VH / 2 + 30); } }
  g.restore();
}
function pFrame() {
  const P = G.P, A_ = P.act;
  if (G.mode === 'dying' || P.down > 0 || P.ghost) return P.z > 0 ? 'hurt' : 'hurt';
  if (P.hurt > 0) return 'hurt'; if (P.dashing > 0) return 'dash';
  if (A_) { const d = A_.def; return A_.t < d.at ? d.a : d.b; }
  if (P.z > 0) return P.vz > 0 ? 'jump' : 'fall';
  if (P.run > 0) return 'run' + (Math.floor(P.run * 10) % 4);
  return Math.floor(G.t * 1.6) % 2 ? 'idle2' : 'idle';
}
function drawP(g) {
  const P = G.P, sp = SPR.p[pFrame()]; let rot = 0; if (P.down > 0 && P.z <= 0) rot = -P.f * 1.2;
  if (P.ghost) { g.globalAlpha = .35; rot = -P.f * 1.2; } else if (P.inv > 0 && P.hurt <= 0 && !(P.act && P.act.isUlt) && Math.floor(G.t * 20) % 2) g.globalAlpha = .55;
  if (P.dashing > 0) { g.save(); g.globalAlpha = .25; put(g, sp, P.x - P.f * 24, P.y - P.z, P.f, .5, 0); put(g, sp, P.x - P.f * 48, P.y - P.z, P.f, .5, 0); g.restore(); }
  put(g, sp, P.x, P.y - P.z, P.f, .5, 0, rot); g.globalAlpha = 1;
}
function drawE(g, e) {
  if (e.spawnT > 0) { g.save(); g.globalAlpha = 1 - e.spawnT / .4; g.fillStyle = rg(g, e.x, e.y - 40, 0, 50, [[0, 'rgba(190,120,255,.8)'], [1, 'rgba(190,120,255,0)']]); g.beginPath(); g.arc(e.x, e.y - 40, 50, 0, TAU); g.fill(); g.restore(); if (e.spawnT > .2) return; }
  if (e.crate) { put(g, SPR.crate, e.x + (e.fl > 0 ? rnd(-2, 2) : 0), e.y, 1, .5, e.fl > 0 ? e.fl * 8 : 0); return; }
  if (e.t === 'drone') { drawDrone(g, e); return; }
  const S = SPR.e[e.t]; if (!S) return; let sp = S.w0;
  if (e.st === 'walk') sp = [S.w0, S.w1, S.w0, S.w2][Math.floor(e.ph) % 4]; else if (e.st === 'wind') sp = S.wind; else if (e.st === 'swing') sp = S.hit; else if (e.st === 'hurt' || e.st === 'air' || e.st === 'down') sp = S.hurt;
  let rot = 0; if (e.st === 'air') rot = -e.f * clamp(e.vz / -400 + .4, -.2, 1.3); if (e.st === 'down') rot = -e.f * 1.45;
  const shk = e.fl > 0 ? rnd(-2, 2) : 0, sc = ET[e.t].sc;
  if (e.st === 'wind') { g.save(); g.globalAlpha = .5 + .5 * Math.sin(G.t * 40); dot(g, e.x, e.y - e.h - 18, 4, '#ff5e7e'); g.restore(); }
  put(g, sp, e.x + shk, e.y - e.z - (e.st === 'down' ? 8 : 0), e.f, sc, e.fl > 0 ? Math.min(.55, e.fl * 9) : e.frz > 0 ? .35 : 0, rot);
  if (e.frz > 0) { g.fillStyle = 'rgba(180,240,255,.35)'; g.beginPath(); g.roundRect(e.x - e.w - 4, e.y - e.h - 6, e.w * 2 + 8, e.h + 8, 6); g.fill(); }
  if (e.curse > 0) dot(g, e.x, e.y - e.z - e.h - 12, 3, '#7dff9a');
  if (e.hp < e.mhp) { const w = e.t === 'elite' ? 60 : 36; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(e.x - w / 2, e.y - e.z - e.h - 8, w, 4); g.fillStyle = e.t === 'elite' ? '#ff2a6a' : '#ff8a5a'; g.fillRect(e.x - w / 2, e.y - e.z - e.h - 8, w * Math.max(0, e.hp / e.mhp), 4); }
}
function drawDrone(g, e) {
  const y = e.y - e.z, f = e.fl > 0; g.save(); g.translate(e.x + (f ? rnd(-2, 2) : 0), y); if (e.st === 'air' || e.st === 'down') g.rotate(e.f * .8);
  if (e.st === 'wind') { g.strokeStyle = 'rgba(127,243,255,' + (.4 + .4 * Math.random()) + ')'; g.lineWidth = 1.5; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(0, 6); g.lineTo(rnd(-10, 10), 16); g.lineTo(rnd(-6, 6), 26); g.stroke(); } }
  g.fillStyle = 'rgba(10,6,22,.9)'; g.beginPath(); g.ellipse(0, 0, 23, 10, 0, 0, TAU); g.fill();
  g.fillStyle = f ? '#fff' : lg(g, 0, -9, 0, 9, [[0, '#56688f'], [1, '#1c2238']]); g.beginPath(); g.ellipse(0, 0, 21, 8, 0, 0, TAU); g.fill();
  g.fillStyle = '#232b44'; g.fillRect(-34, -8, 14, 3); g.fillRect(20, -8, 14, 3);
  g.fillStyle = 'rgba(180,230,255,.4)'; const sp = Math.sin(G.t * 50) * 10 + 12; g.beginPath(); g.ellipse(-27, -9, sp, 2, 0, 0, TAU); g.ellipse(27, -9, sp, 2, 0, 0, TAU); g.fill();
  dot(g, e.f * 6, 1, 3.5, '#4fd8ff'); g.restore();
  if (e.hp < e.mhp) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(e.x - 16, y - 20, 32, 3); g.fillStyle = '#4fd8ff'; g.fillRect(e.x - 16, y - 20, 32 * Math.max(0, e.hp / e.mhp), 3); }
}
function drawBoss(g, b) {
  for (let i = b.segs.length - 1; i >= 0; i--) { const s = b.segs[i], bob = Math.sin(G.t * 6 + i) * 3, isCore = i === 2 && b.core > 0;
    put(g, SPR.car, s.x, s.y + bob, s.x < (i ? b.segs[i - 1].x : b.x) ? 1 : -1, .66 * (1 - i * .04), b.fl > 0 ? .25 : 0);
    if (isCore) { g.save(); const r = 46 + Math.sin(G.t * 10) * 4; g.fillStyle = rg(g, s.x, s.y - 50, 0, r, [[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,214,102,.9)'], [1, 'rgba(255,120,0,0)']]); g.beginPath(); g.arc(s.x, s.y - 50, r, 0, TAU); g.fill(); g.restore(); } }
  put(g, SPR.head, b.x, b.y + (b.st === 'stun' ? 6 : 0), -b.f, .8, b.fl > 0 ? Math.min(.75, b.fl * 8) : 0, b.st === 'stun' ? b.f * .08 : 0);
  if (b.st === 'stun') for (let i = 0; i < 3; i++) dot(g, b.x + Math.cos(G.t * 5 + i * 2) * 40, b.y - 150 + Math.sin(G.t * 5 + i * 2) * 8, 3, '#ffd166');
}
function drawPet(g, p) {
  const form = petForm(), s = [0, .7, .95, 1.25][form], y = p.y - p.z; g.save(); g.translate(p.x, y); g.scale(p.f * s, s);
  if (G.hatch > 0) { g.globalAlpha = 1; }
  g.fillStyle = rg(g, 0, 0, 0, 30, [[0, 'rgba(255,214,245,.35)'], [1, 'rgba(255,214,245,0)']]); g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
  g.fillStyle = 'rgba(10,6,22,.9)'; g.beginPath(); g.ellipse(0, 0, 17, 15, 0, 0, TAU); g.fill();
  g.fillStyle = lg(g, -10, -14, 10, 14, [[0, '#fff2fb'], [1, '#d6b8ff']]); g.beginPath(); g.ellipse(0, 0, 15.5, 13.5, 0, 0, TAU); g.fill();
  // 귀
  g.beginPath(); g.ellipse(-9, -12, 4, 7, -.5, 0, TAU); g.ellipse(9, -12, 4, 7, .5, 0, TAU); g.fill(); if (form >= 3) { dot(g, 0, -18, 2.5, '#ffe28a'); }
  g.fillStyle = '#2a1a3a'; const bl = Math.floor(G.t * 3) % 9 === 0; if (bl) { g.fillRect(-7, -1, 5, 1.5); g.fillRect(3, -1, 5, 1.5); } else { g.beginPath(); g.arc(-4.5, -1, 2.2, 0, TAU); g.arc(5.5, -1, 2.2, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-5.2, -1.8, .8, 0, TAU); g.arc(4.8, -1.8, .8, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,120,170,.5)'; g.beginPath(); g.ellipse(-9, 4, 3, 1.6, 0, 0, TAU); g.ellipse(10, 4, 3, 1.6, 0, 0, TAU); g.fill();
  if (form >= 2) { g.fillStyle = 'rgba(190,240,255,.6)'; g.beginPath(); g.ellipse(-16, 2, 6, 3, .6, 0, TAU); g.ellipse(16, 2, 6, 3, -.6, 0, TAU); g.fill(); }
  g.restore();
}
function drawItem(g, q) {
  const y = q.y - q.z - 6 - Math.sin(G.t * 4 + q.x) * 2;
  if (q.k === 'gear') { g.fillStyle = lg(g, 0, y - 120, 0, y, [[0, 'rgba(255,165,61,0)'], [1, 'rgba(255,165,61,.4)']]); g.fillRect(q.x - 2, y - 120, 4, 120); g.save(); g.translate(q.x, y); g.rotate(G.t * 2); g.shadowColor = '#ffa53d'; g.shadowBlur = 14; g.fillStyle = '#ffd08a'; g.fillRect(-6, -6, 12, 12); g.restore(); }
  else if (q.k === 'gold') { g.save(); g.shadowColor = '#ffd166'; g.shadowBlur = 10; g.fillStyle = '#ffd166'; g.beginPath(); g.ellipse(q.x, y, 5 * Math.abs(Math.cos(G.t * 5 + q.x)) + 1, 5, 0, 0, TAU); g.fill(); g.restore(); }
  else if (q.k === 'orb') dot(g, q.x, y, 6, '#6bff9a');
  else if (q.k === 'jelly') { g.save(); g.shadowColor = '#ffb3e6'; g.shadowBlur = 10; shape(g, [[q.x - 6, y + 4], [q.x - 5, y - 4], [q.x, y - 7], [q.x + 5, y - 4], [q.x + 6, y + 4]], '#ffb3e6'); g.restore(); }
  else if (q.k === 'stone') { g.save(); g.shadowColor = '#7df9ff'; g.shadowBlur = 10; shape(g, [[q.x, y - 8], [q.x + 6, y], [q.x, y + 6], [q.x - 6, y]], '#bdf6ff', 0); g.restore(); }
}
function drawTotem(g, t) { g.save(); g.translate(t.x, t.y); g.fillStyle = '#3a2448'; g.beginPath(); g.roundRect(-7, -60, 14, 60, 4); g.fill(); shape(g, [[-12, -76], [12, -76], [10, -58], [-10, -58]], '#efe6d2'); dot(g, -4, -68, 2, '#7dff9a'); dot(g, 4, -68, 2, '#7dff9a'); g.globalAlpha = Math.min(1, t.t); dot(g, 0, -86, 5 + Math.sin(G.t * 8) * 1.5, '#7dff9a'); g.restore(); }
function drawProj(g, p) {
  const y = p.y - p.z, c = G.c.col; g.save(); g.translate(p.x, y); g.scale(p.f, 1);
  if (p.k === 'arrow' || p.k === 'pierce') { const L = p.k === 'pierce' ? 46 : 26; g.fillStyle = lg(g, -L * 2, 0, 0, 0, [[0, 'rgba(157,255,138,0)'], [1, 'rgba(157,255,138,.6)']]); g.fillRect(-L * 2, -1.5, L * 2, 3); g.shadowColor = c; g.shadowBlur = 10; g.fillStyle = '#efffe8'; g.fillRect(-L, -1.2, L, 2.4); shape(g, [[0, -4], [9, 0], [0, 4]], '#fff', 0); }
  else if (p.k === 'spear') { g.shadowColor = c; g.shadowBlur = 14; g.fillStyle = '#e9fff9'; g.fillRect(-50, -1.5, 50, 3); shape(g, [[0, -5], [18, 0], [0, 5]], '#fff', 0); }
  else if (p.k === 'wave') { g.globalAlpha = Math.min(1, p.life * 3); g.fillStyle = lg(g, -40, 0, 20, 0, [[0, 'rgba(125,249,255,0)'], [1, 'rgba(225,255,255,.9)']]); g.beginPath(); g.moveTo(-40, 0); g.quadraticCurveTo(0, -60, 18, -46); g.lineTo(22, 0); g.closePath(); g.fill(); }
  else if (p.k === 'needle') { g.fillStyle = '#e8dcc0'; g.fillRect(-14, -1, 16, 2); dot(g, 2, 0, 2, '#7dff9a'); }
  else if (p.k === 'wisp') { g.shadowColor = '#7dff9a'; g.shadowBlur = 16; shape(g, [[-14, 0], [-2, -8], [8, -4], [10, 0], [8, 4], [-2, 8]], '#bfffd0'); dot(g, 4, 0, 4, '#ffffff'); }
  else { const r = p.k === 'fire' ? 10 : 7, col = p.k === 'fire' ? '#ff8a3d' : '#d9b0ff'; g.fillStyle = lg(g, -40, 0, 0, 0, [[0, 'rgba(255,255,255,0)'], [1, col]]); g.globalAlpha = .6; g.fillRect(-40, -r * .6, 40, r * 1.2); g.globalAlpha = 1; dot(g, 0, 0, r, col); dot(g, 0, 0, r * .45, '#fff'); }
  g.restore();
}
function drawFx(g) {
  for (const f of G.fx) {
    const u = f.t / f.life;
    if (f.k === 'p') { g.globalAlpha = 1 - u; g.fillStyle = f.col; g.beginPath(); g.arc(f.x, f.y, f.r * (1 - u * .5), 0, TAU); g.fill(); g.globalAlpha = 1; }
    else if (f.k === 'shard') { g.save(); g.globalAlpha = 1 - u; g.translate(f.x, f.y); g.rotate(f.rot + f.t * 12); g.fillStyle = f.col; g.fillRect(-f.r, -1, f.r * 2, 2); g.restore(); }
    else if (f.k === 'spark') { g.save(); g.translate(f.x, f.y); g.rotate(f.a); g.globalAlpha = 1 - u; g.shadowColor = f.col; g.shadowBlur = 16; g.fillStyle = '#fff'; const s = f.sz * (1 + u); for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4 * (i ? 2 : 1)); g.beginPath(); g.moveTo(-s, 0); g.lineTo(0, -2); g.lineTo(s, 0); g.lineTo(0, 2); g.fill(); } g.restore(); }
    else if (f.k === 'impact') { g.save(); g.globalAlpha = 1 - u; g.strokeStyle = '#fff'; g.lineWidth = 3 * (1 - u); g.beginPath(); g.arc(f.x, f.y, 10 + u * 50, 0, TAU); g.stroke(); g.strokeStyle = f.col; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.moveTo(f.x + Math.cos(a) * (14 + u * 30), f.y + Math.sin(a) * (14 + u * 30)); g.lineTo(f.x + Math.cos(a) * (30 + u * 60), f.y + Math.sin(a) * (30 + u * 60)); g.stroke(); } g.restore(); }
    else if (f.k === 'ring') { g.save(); g.globalAlpha = 1 - u; g.strokeStyle = f.col; g.lineWidth = 3; g.beginPath(); g.ellipse(f.x, f.y, f.r * (.4 + u * .7), f.r * .3 * (.4 + u * .7), 0, 0, TAU); g.stroke(); g.restore(); }
    else if (f.k === 'arc') { const cxx = f.x + f.f * 18, cyy = f.y - f.z - 50; g.save(); g.translate(cxx, cyy); g.scale(f.f, 1); g.globalAlpha = 1 - u * u; g.shadowColor = f.col; g.shadowBlur = 18;
      const a0 = f.a0, a1 = lerp(f.a0, f.a1, Math.min(1, u * 2.5 + .3)), R = f.r; g.beginPath(); g.arc(0, 0, R, Math.min(a0, a1), Math.max(a0, a1)); g.arc(0, 0, R * .55, Math.max(a0, a1), Math.min(a0, a1), true); g.closePath(); g.fillStyle = lg(g, -R, -R, R, R, [[0, f.col + '00'], [.6, f.col + 'aa'], [1, '#ffffff']]); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, R, Math.min(a0, a1), Math.max(a0, a1)); g.stroke(); g.restore(); }
    else if (f.k === 'thrust') { g.save(); g.translate(f.x + f.f * 20, f.y - f.z - 60); g.scale(f.f, 1); g.globalAlpha = 1 - u; g.shadowColor = f.col; g.shadowBlur = 16; g.fillStyle = lg(g, 0, 0, f.a0, 0, [[0, f.col + '00'], [1, '#ffffff']]); g.beginPath(); g.moveTo(0, -6 * (1 - u)); g.lineTo(f.a0, 0); g.lineTo(0, 6 * (1 - u)); g.fill(); g.restore(); }
    else if (f.k === 'spin') { g.save(); g.translate(f.x, f.y - f.z - 45); g.globalAlpha = .8 * (1 - u * .5); g.shadowColor = f.col; g.shadowBlur = 18; g.strokeStyle = f.col; g.lineWidth = 4; for (let i = 0; i < 2; i++) { const a = f.t * 22 + i * Math.PI; g.beginPath(); g.ellipse(0, 0, 80, 26, 0, a, a + 2.2); g.stroke(); } g.restore(); }
    else if (f.k === 'rapid') { if (Math.floor(f.t * 30) % 2) { const yy = f.y - f.z - 55 + rnd(-14, 14); g.save(); g.shadowColor = f.col; g.shadowBlur = 12; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(f.x + f.f * 20, yy); g.lineTo(f.x + f.f * rnd(80, 110), yy + rnd(-6, 6)); g.stroke(); g.restore(); } }
    else if (f.k === 'dash') { g.save(); g.globalAlpha = .6 * (1 - u); g.fillStyle = f.col; for (let i = 0; i < 5; i++) g.fillRect(f.x - f.f * (20 + i * 22), f.y - f.z - 30 - i * 9, -f.f * 40, 2); g.restore(); }
    else if (f.k === 'slam') { g.save(); g.globalAlpha = 1 - u; g.strokeStyle = '#ff2a6a'; g.lineWidth = 4; g.beginPath(); g.ellipse(f.x, f.y, 30 + u * 90, 10 + u * 26, 0, 0, TAU); g.stroke(); g.restore(); }
    else if (f.k === 'bolt' || f.k === 'petz') { g.save(); g.globalAlpha = 1 - u; g.shadowColor = f.k === 'bolt' ? '#e3b8ff' : '#ffd6f5'; g.shadowBlur = 14; g.strokeStyle = '#fff'; g.lineWidth = f.k === 'bolt' ? 2.5 : 1.5; g.beginPath(); g.moveTo(f.x, f.y); for (let i = 1; i < 6; i++) g.lineTo(lerp(f.x, f.x2, i / 6) + rnd(-8, 8), lerp(f.y, f.y2, i / 6) + rnd(-8, 8)); g.lineTo(f.x2, f.y2); g.stroke(); g.restore(); }
    else if (f.k === 'ghost') { const e = f.e; g.save(); g.globalAlpha = (1 - u) * .8; g.globalCompositeOperation = 'lighter'; if (e.t === 'drone') dot(g, f.x, f.y - f.z, 20 * (1 + u), '#4fd8ff'); else if (SPR.e[e.t]) put(g, SPR.e[e.t].hurt, f.x + f.dir * u * 30, f.y - f.z - u * 20, f.f, ET[e.t].sc * (1 + u * .3), .5); g.restore(); }
    else if (f.k === 'area') drawArea(g, f, u);
  }
}
function drawArea(g, f, u) {
  const a = f.a, c = G.c.col; g.save(); g.translate(f.x, f.y);
  if (a.k === 'sword') { const drop = Math.min(1, f.t * 6); g.save(); g.translate(0, -360 * (1 - drop)); g.shadowColor = c; g.shadowBlur = 30; g.globalAlpha = 1 - Math.max(0, u - .6) / .4; shape(g, [[-18, -40], [18, -40], [14, -300], [0, -340], [-14, -300]], lg(g, -18, 0, 18, 0, [[0, '#bfefff'], [.5, '#ffffff'], [1, '#7fd8ff']]), .1); g.fillStyle = '#d9b45a'; g.fillRect(-40, -46, 80, 12); g.restore(); }
  if (a.k === 'meteor') { const drop = Math.min(1, f.t * 3); g.save(); g.translate(-200 * (1 - drop), -380 * (1 - drop)); g.globalAlpha = 1 - Math.max(0, u - .5) * 2; g.fillStyle = rg(g, 0, -20, 0, 60, [[0, '#fff'], [.3, '#ffb347'], [1, 'rgba(255,60,0,0)']]); g.beginPath(); g.arc(0, -20, 60, 0, TAU); g.fill(); g.restore(); }
  if (a.k === 'giant') { g.globalAlpha = 1 - Math.max(0, u - .6) / .4; const s = Math.min(1, f.t * 4) * 2.2; g.scale(s, s); g.shadowColor = '#7dff9a'; g.shadowBlur = 20; shape(g, [[0, -60], [16, -50], [16, -30], [30, -24], [22, -14], [16, -18], [18, 0], [6, 0], [0, -14], [-6, 0], [-18, 0], [-16, -18], [-22, -14], [-30, -24], [-16, -30], [-16, -50]], '#c8a878'); dot(g, 6, -46, 3, '#7dff9a'); }
  if (a.k === 'ice') { const h = Math.min(1, f.t * 8) * 110; g.globalAlpha = 1 - Math.max(0, u - .7) / .3; g.shadowColor = '#bdf6ff'; g.shadowBlur = 16; for (let i = -1; i <= 1; i++) shape(g, [[i * 22 - 14, 0], [i * 22, -h * (i ? .7 : 1)], [i * 22 + 14, 0]], 'rgba(200,245,255,.85)', 0); }
  if (a.k === 'petal' || a.k === 'stars' || a.k === 'rain' || a.k === 'needles' || a.k === 'hex' || a.k === 'trap' || a.k === 'nova' || a.k === 'curse') {
    g.globalAlpha = 1 - u; const col = a.k === 'curse' || a.k === 'hex' || a.k === 'needles' ? '#7dff9a' : c;
    if (a.k === 'stars' || a.k === 'rain') { g.strokeStyle = '#fff'; g.shadowColor = col; g.shadowBlur = 12; g.lineWidth = 2; g.beginPath(); g.moveTo(-20 * (1 - u), -200 * (1 - u) - 30); g.lineTo(0, -10); g.stroke(); dot(g, 0, -10, 6 * (1 - u) + 2, col); }
    else { g.strokeStyle = col; g.lineWidth = 2.5; g.shadowColor = col; g.shadowBlur = 14; g.beginPath(); g.ellipse(0, 0, a.r * (.5 + u * .6), a.r * .3 * (.5 + u * .6), 0, 0, TAU); g.stroke(); if (a.k === 'petal') for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + f.t * 8; dot(g, Math.cos(an) * 30, -40 + Math.sin(an) * 30 - u * 30, 3, '#ffc6ee'); } }
  }
  g.restore();
}
/* ---------- HUD ---------- */
function hud(g) {
  const P = G.P, c = G.c;
  g.save(); g.fillStyle = 'rgba(8,10,26,.72)'; g.beginPath(); g.roundRect(10, 10, 204, 52, 10); g.fill(); g.strokeStyle = c.col + '66'; g.lineWidth = 1; g.stroke();
  g.save(); g.beginPath(); g.arc(34, 36, 18, 0, TAU); g.fillStyle = '#121a38'; g.fill(); g.clip(); put(g, SPR['por_' + G.cls], 33, 80, 1, .3, 0); g.restore();
  g.strokeStyle = c.col; g.lineWidth = 1.5; g.beginPath(); g.arc(34, 36, 18, 0, TAU); g.stroke();
  g.fillStyle = '#fff'; g.font = '400 11px ' + FONT_K; g.textAlign = 'left'; g.fillText(c.name + '  Lv.' + SV.lv[G.cls], 58, 24);
  bar(g, 58, 29, 148, 8, P.hp / G.st.hp, '#ff5e7e', '#ff9a6b'); bar(g, 58, 41, 148, 5, P.mp / G.st.mp, '#4f8bff', '#7df9ff');
  g.fillStyle = '#ffd166'; g.fillRect(58, 50, 148 * P.ult / 100, 3); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(58 + 148 * P.ult / 100, 50, 148 * (1 - P.ult / 100), 3);
  g.font = '400 8px ' + FONT_K; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(Math.ceil(P.hp) + ' / ' + G.st.hp, 62, 36);
  // 방 지도
  const mx = VW - 176; g.fillStyle = 'rgba(8,10,26,.72)'; g.beginPath(); g.roundRect(mx, 10, 166, 34, 8); g.fill();
  ROOMS.forEach((r, i) => { const bx = mx + 8 + i * 31, cur = i === G.room; g.fillStyle = cur ? c.col + '55' : i < G.room ? c.col + '22' : 'rgba(255,255,255,.05)'; g.beginPath(); g.roundRect(bx, 17, 26, 20, 4); g.fill(); g.strokeStyle = i === 4 ? '#ff4f8b' : cur ? c.col : 'rgba(255,255,255,.18)'; g.stroke(); g.fillStyle = cur ? '#fff' : 'rgba(255,255,255,.55)'; g.font = '400 7.5px ' + FONT_K; g.textAlign = 'center'; g.fillText(i === 4 ? '보스' : r.name.slice(0, 2), bx + 13, 30); });
  g.textAlign = 'right'; g.font = '400 9px ' + FONT_N; g.fillStyle = 'rgba(255,255,255,.6)'; const tt = Math.floor(G.t); g.fillText(Math.floor(tt / 60) + ':' + String(tt % 60).padStart(2, '0'), VW - 12, 56);
  // 콤보
  if (G.combo > 2) { g.save(); g.translate(VW - 20, 96); const pop = 1 + Math.max(0, .25 - (2 - G.comboT)) * 2; g.scale(pop, pop); g.textAlign = 'right'; g.font = 'italic 400 34px ' + FONT_K; g.shadowColor = c.col; g.shadowBlur = 14; g.fillStyle = '#fff'; g.fillText(G.combo, -28, 0); g.shadowBlur = 0; g.font = '400 11px ' + FONT_K; g.fillStyle = c.col; g.fillText('HIT', 0, -2); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(-100, 6, 100, 2); g.fillStyle = c.col; g.fillRect(-100 * G.comboT / 2, 6, 100 * G.comboT / 2, 2); g.restore(); }
  // 방 평가
  if (G.rank && G.rank.t > 0) { g.save(); const u = 1 - G.rank.t / 2.2; g.globalAlpha = Math.min(1, G.rank.t * 2); g.textAlign = 'center'; g.font = '400 14px ' + FONT_K; g.fillStyle = '#fff'; g.fillText('방 정리!', VW / 2, 120); g.font = '400 ' + (54 + Math.max(0, .15 - u) * 200) + 'px ' + FONT_K; g.shadowColor = '#ffb703'; g.shadowBlur = 20; g.fillStyle = '#ffd166'; g.fillText(G.rank.r, VW / 2, 172); g.restore(); }
  if (G.hatch > 0) { g.save(); g.globalAlpha = Math.min(1, G.hatch); g.textAlign = 'center'; g.font = '400 15px ' + FONT_K; g.fillStyle = '#ffd6f5'; g.fillText('🥚 알에서 꼬마 동료 \'뭉치\'가 태어났어요!', VW / 2, 206); g.restore(); }
  if (G.tipT > 0 && G.R.tip) { g.save(); g.globalAlpha = Math.min(1, G.tipT); g.fillStyle = 'rgba(8,10,26,.7)'; g.font = '400 11px ' + FONT_K; const w = g.measureText(G.R.tip).width + 24; g.beginPath(); g.roundRect(VW / 2 - w / 2, 46, w, 22, 8); g.fill(); g.fillStyle = '#e8f6ff'; g.textAlign = 'center'; g.fillText(G.R.tip, VW / 2, 61); g.restore(); }
  // 보스 체력
  if (G.boss && !G.boss.dead && G.boss.st !== 'enter') { const b = G.boss, w = Math.min(380, VW - 240), bx = (VW - w) / 2; g.fillStyle = 'rgba(12,6,14,.78)'; g.beginPath(); g.roundRect(bx - 8, 52, w + 16, 30, 8); g.fill(); g.fillStyle = '#ffd0d8'; g.font = '400 10px ' + FONT_K; g.textAlign = 'left'; g.fillText(ET.boss.name + (b.ph2 ? ' · 분노' : ''), bx, 64); bar(g, bx, 68, w, 8, b.hp / b.mhp, '#ff2244', '#ff8a3d'); }
  g.restore();
  if (touch.on) drawTouch(g); else skillBar(g);
}
function bar(g, bx, by, bw, bh, v, c1, c2) { v = clamp(v, 0, 1); g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.fill(); if (v > 0) { g.fillStyle = lg(g, bx, 0, bx + bw, 0, [[0, c1], [1, c2]]); g.beginPath(); g.roundRect(bx, by, Math.max(bh, bw * v), bh, bh / 2); g.fill(); } }
function skBtn(g, bx, by, r, i, key) {
  const P = G.P, c = G.c, s = i < 4 ? c.sk[i] : null, cd = s ? Math.max(0, P.cd[i]) / s.cd : 0, ok = s ? P.mp >= s.mp : P.ult >= 100;
  g.save(); g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fillStyle = 'rgba(10,12,30,.82)'; g.fill(); g.strokeStyle = s ? c.col : '#ffd166'; g.globalAlpha = ok ? 1 : .45; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = s ? c.col : '#ffd166'; g.font = '400 ' + (r * .9) + 'px ' + FONT_K; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s ? s.icon : '★', bx, by + 1);
  if (!s) { g.strokeStyle = '#ffd166'; g.lineWidth = 3; g.beginPath(); g.arc(bx, by, r + 2, -Math.PI / 2, -Math.PI / 2 + TAU * P.ult / 100); g.stroke(); }
  g.globalAlpha = 1; if (cd > 0) { g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.moveTo(bx, by); g.arc(bx, by, r, -Math.PI / 2, -Math.PI / 2 + TAU * cd); g.fill(); g.fillStyle = '#fff'; g.font = '400 ' + (r * .6) + 'px ' + FONT_K; g.fillText(P.cd[i].toFixed(1), bx, by + 1); }
  if (key) { g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '400 8px ' + FONT_N; g.fillText(key, bx, by + r + 8); }
  g.restore();
}
function skillBar(g) { const y = VH - 30, x0 = VW / 2 - 100; ['A', 'S', 'D', 'F'].forEach((k, i) => skBtn(g, x0 + i * 42, y, 15, i, k)); skBtn(g, x0 + 4 * 42 + 14, y, 17, 4, 'V'); g.fillStyle = 'rgba(255,255,255,.4)'; g.font = '400 8px ' + FONT_K; g.textAlign = 'left'; g.fillText('←→↑↓ 이동 · Z 공격 · X 점프 · C 대시', 12, VH - 10); }
function touchLayout() { const r = VW - 64, b = VH - 62, A = (deg, R) => [r + Math.cos(deg * Math.PI / 180) * R, b + Math.sin(deg * Math.PI / 180) * R]; return { atk: [r, b, 34], s0: [...A(175, 80), 20], s1: [...A(205, 80), 20], s2: [...A(235, 80), 20], s3: [...A(265, 80), 20], dash: [...A(296, 80), 18], jump: [r - 110, b + 42, 20], ult: [r - 166, b + 20, 21] }; }
function drawTouch(g) {
  const T = touchLayout();
  if (touch.stick) { const s = touch.stick; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.arc(s.x0, s.y0, 46, 0, TAU); g.fill(); g.strokeStyle = 'rgba(125,249,255,.35)'; g.stroke(); g.fillStyle = 'rgba(125,249,255,.4)'; g.beginPath(); g.arc(s.x0 + s.dx * 34, s.y0 + s.dy * 34, 20, 0, TAU); g.fill(); }
  else { g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.arc(80, VH - 80, 46, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.font = '400 9px ' + FONT_K; g.textAlign = 'center'; g.fillText('여기를 대고 끌어 이동', 80, VH - 77); }
  const [ax, ay, ar] = T.atk; g.save(); g.beginPath(); g.arc(ax, ay, ar, 0, TAU); g.fillStyle = rg(g, ax, ay - 10, 4, ar, [[0, G.c.col + '99'], [1, 'rgba(20,10,40,.8)']]); g.fill(); g.strokeStyle = G.c.col; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff'; g.font = '400 13px ' + FONT_K; g.textAlign = 'center'; g.fillText('공격', ax, ay + 4); g.restore();
  for (const [k, lab] of [['jump', '점프'], ['dash', '대시']]) { const [bx, by, r] = T[k]; g.fillStyle = 'rgba(10,12,30,.75)'; g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.stroke(); g.fillStyle = '#fff'; g.font = '400 9px ' + FONT_K; g.textAlign = 'center'; g.fillText(lab, bx, by + 3); }
  for (let i = 0; i < 4; i++) { const [bx, by, r] = T['s' + i]; skBtn(g, bx, by, r, i); } const [ux, uy, ur] = T.ult; skBtn(g, ux, uy, ur, 4);
}

/* =================== 협동 2~4인 (BK 11/14) ===================
   방 서버(Durable Object)는 메시지만 전달. 방장 브라우저가 적·보스·방 진행을 계산하고 0.1초마다 적 상태를 보낸다.
   각자 자기 캐릭터를 움직이고, 자기 몸이 맞았는지도 각자 판정한다. 손님의 타격은 방장에게 보내 체력을 깎는다.
   아이템·경험치·골드는 각자 따로(서로 뺏지 않음). 쓰러지면 다음 방에서 다시 일어나고, 모두 쓰러지면 끝. */
const ST = ['walk', 'wind', 'swing', 'hurt', 'air', 'down', 'idle', 'enter', 'roar', 'charge', 'stun', 'volley', 'laser', 'summon'], ETN = ['grunt', 'shield', 'drone', 'elite', 'boss', 'crate'];
const NET = {
  on: false, host: false, guest: false, ws: null, id: '', room: '', peers: new Map(), order: [], state: 'idle', msg: '', sT: 0, pT: 0, ready: false,
  slot() { const l = [NET.id, ...NET.peers.keys()].sort(); return Math.max(0, l.indexOf(NET.id)); },
  connect(code) {
    NET.leave(true); NET.room = code; NET.state = 'conn'; NET.msg = '연결 중…';
    let nick = '모험가'; try { nick = localStorage.getItem('nr_nick') || nick; } catch (e) {}
    const u = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/coop?r=' + code + '&n=' + encodeURIComponent(nick.slice(0, 16)) + '&c=' + (pick || 'knight');
    let ws; try { ws = new WebSocket(u); } catch (e) { NET.state = 'idle'; NET.msg = '연결하지 못했어요.'; lobby(); return; }
    NET.ws = ws; NET.nick = nick;
    ws.onmessage = ev => { let o; try { o = JSON.parse(ev.data); } catch (e) { return; } NET.recv(o); };
    ws.onclose = () => { if (NET.ws !== ws) return; const was = NET.on; NET.ws = null; NET.on = NET.guest = NET.host = false; NET.peers.clear(); NET.state = 'idle';
      if (G && G.mode === 'play' && was) tx(G.P.x, G.P.y - 130, '연결이 끊겨 혼자 이어 가요', '#ffd166', 13); else { NET.msg = NET.msg === '연결 중…' ? '방에 들어가지 못했어요. 코드가 맞는지, 이미 출발했거나 4명이 꽉 찼는지 확인해 주세요.' : NET.msg || '방에서 나왔어요.'; if (!G) lobby(); } };
    ws.onerror = () => {};
  },
  leave(silent) { const ws = NET.ws; NET.ws = null; NET.on = NET.guest = NET.host = false; NET.peers.clear(); NET.state = 'idle'; if (ws) try { ws.close(); } catch (e) {} if (!silent) NET.msg = ''; },
  send(o) { if (NET.ws && NET.ws.readyState === 1) try { NET.ws.send(JSON.stringify(o)); } catch (e) {} },
  cast(o) { if (NET.on) NET.send(o); },
  setHost(h) { NET.hostId = h; NET.host = h === NET.id; NET.guest = !NET.host; },
  recv(o) {
    const k = o.k, pr = o.f && NET.peers.get(o.f);
    if (k === 'hello') { NET.id = o.id; NET.state = 'room'; NET.msg = ''; for (const p of o.peers) NET.peers.set(p.id, { id: p.id, name: p.name, cls: p.cls }); NET.setHost(o.host || o.id); if (!G) lobby(); return; }
    if (k === 'join') { NET.peers.set(o.id, { id: o.id, name: o.name, cls: o.cls }); NET.setHost(o.host); sfx('pick'); if (!G) lobby(); return; }
    if (k === 'leave') { const p = NET.peers.get(o.id); NET.peers.delete(o.id); const wasGuest = NET.guest; NET.setHost(o.host || NET.id);
      if (G && G.mode === 'play') { if (p) tx(G.P.x, G.P.y - 130, p.name + ' 님이 나갔어요', '#cfc8ff', 12); if (wasGuest && NET.host) NET.becomeHost(); if (!NET.peers.size) { NET.on = false; NET.guest = NET.host = false; } }
      else if (!G) lobby(); return; }
    if (k === 'cls') { if (pr) { pr.cls = o.c; if (!G) lobby(); } return; }
    if (k === 'start') { if (G && G.mode === 'play') return; G = null; NET.on = true; NET.setHost(o.f); start(pick); return; }
    if (!G || !NET.on) return;
    if (k === 'p') { if (pr) NET.peerState(pr, o); return; }
    if (k === 's' && NET.guest) { NET.snap(o); return; }
    if (k === 'hit' && NET.host) { const e = G.en.find(q => q.id === o.id && !q.dead); if (e) NET.rhit(e, o, pr); return; }
    if (k === 'kill' && NET.guest) { const e = G.en.find(q => q.id === o.id); if (e && !e.dead) { e.hp = 0; kill(e, o.dir || 1); } return; }
    if (k === 'ep' && NET.guest) { G.ep.push(o.q); return; }
    if (k === 'haz' && NET.guest) { G.haz.push(o.h); if (o.h.k) sfx('warn'); return; }
    if (k === 'gate' && NET.guest) { if (!G.gate) { G.gate = 1; roomClear(); } return; }
    if (k === 'room' && NET.guest) { while (G.room < o.n) nextRoom(); return; }
    if (k === 'pr') { if (pr) for (const q of o.a) G.pr.push(Object.assign(q, { vis: 1, hit: new Set(), t: 0, col: CL[pr.cls] && CL[pr.cls].col })); return; }
    if (k === 'over') { if (G.mode === 'play') finish(false); return; }
  },
  // 동료 위치: 받은 값으로 부드럽게 따라감
  peerState(pr, o) {
    if (!pr.s) { pr.s = { x: o.x, y: o.y, z: o.z }; buildPeer(pr.cls); }
    Object.assign(pr, { tx: o.x, ty: o.y, tz: o.z, dd: o.d, fr: o.fr, hp: o.hp, mh: o.mh, gh: o.gh, inv: o.inv, cls: o.c || pr.cls, seen: G.t });
  },
  tgtList() { const l = [G.P]; for (const p of NET.peers.values()) if (p.s && !p.gh && p.hp > 0 && G.t - (p.seen || 0) < 3) l.push(p.s); return l.filter(o => !(o === G.P && G.P.ghost)); },
  atGate() { for (const p of NET.peers.values()) if (p.s && p.s.x > G.L - 40) return true; return false; },
  dead() { NET.cast({ k: 'p', ...NET.me() }); NET.checkOver(); },
  checkOver() { if (!NET.host) return; const alive = !G.P.ghost || [...NET.peers.values()].some(p => p.s && !p.gh && p.hp > 0); if (!alive) { NET.cast({ k: 'over' }); finish(false); } },
  me() { const P = G.P; return { x: Math.round(P.x), y: Math.round(P.y), z: Math.round(P.z), d: P.f, fr: P.ghost ? 'hurt' : pFrame(), hp: Math.round(P.hp), mh: G.st.hp, gh: P.ghost ? 1 : 0, inv: P.inv > 0 ? 1 : 0, c: G.cls }; },
  tick(dt) {
    for (const p of NET.peers.values()) if (p.s) { const a = Math.min(1, dt * 14); p.s.x = lerp(p.s.x, p.tx, a); p.s.y = lerp(p.s.y, p.ty, a); p.s.z = lerp(p.s.z, p.tz, a); }
    NET.pT -= dt; if (NET.pT <= 0) { NET.pT = 1 / 12; NET.send({ k: 'p', ...NET.me() }); }
    if (NET.host) { NET.sT -= dt; if (NET.sT <= 0) { NET.sT = .1; NET.send(NET.mkSnap()); NET.checkOver(); } }
  },
  mkSnap() {
    const en = [];
    for (const e of G.en) { if (e.dead) continue; en.push([e.id, ETN.indexOf(e.crate ? 'crate' : e.t), Math.round(e.x), Math.round(e.y), Math.round(e.z), e.f, Math.round(e.hp), e.mhp, ST.indexOf(e.st), e.spawnT > 0 ? 1 : 0, e.slam ? 1 : 0, Math.round((e.tm || 0) * 100), e.frz > 0 ? 1 : 0, e.curse > 0 ? 1 : 0]); }
    const o = { k: 's', r: G.room, w: G.wave, g: G.gate, en };
    const b = G.boss; if (b && !b.dead) o.b = { id: b.id, lane: Math.round(b.lane || 0), dir: b.dir || 0, core: b.core > 0 ? Math.round(b.core * 100) : 0, ph2: b.ph2, cols: b.cols, segs: b.segs.map(s => [Math.round(s.x), Math.round(s.y)]) };
    return o;
  },
  snap(o) {
    if (o.r !== G.room) return; G.wave = o.w; const seen = new Set();
    for (const a of o.en) {
      const [id, ti, ex, ey, ez, f, hp, mhp, si, sp, slam, tm, frz, cur] = a, t = ETN[ti]; seen.add(id);
      let e = G.en.find(q => q.id === id);
      if (!e) { e = mkEnemy(t, ex, ey); e.id = id; e.z = ez; e.hp = hp; e.mhp = mhp; G.en.push(e); if (t === 'boss') { G.boss = e; sfx('roar'); G.shake = 8; } }
      if (e.dead) continue;
      const st = ST[si] || 'walk', st0 = e.st;
      e.tx = ex; e.ty = ey; e.tz = ez; e.f = f; if (hp < e.hp - 1 && !(e.fl > 0)) e.fl = .09; e.hp = hp; e.mhp = mhp; e.spawnT = sp ? Math.max(e.spawnT || 0, .1) : 0; e.slam = slam; e.tm = tm / 100; e.frz = frz ? .2 : 0; e.curse = cur ? .2 : 0;
      if (st !== st0) { e.st = st; if (st === 'swing') swingHit(e); if (st === 'roar') { sfx('roar'); G.shake = 10; tx(e.x, e.y - 170, '분노!', '#ff2244', 20); } if (st === 'stun' && t === 'boss') { G.shake = 12; sfx('boom'); burst(e.x + e.f * 60, e.y - 50, 20, '#ffb347', 30, 300); tx(e.x, e.y - 170, '코어 노출!', '#ffd166', 18); } if (st === 'charge' || st === 'laser') sfx('warn'); if (st === 'down') burst(e.x, e.y, 6, '#ffffff', 5, 60); }
    }
    if (o.b) { const b = G.en.find(q => q.id === o.b.id); if (b) { b.lane = o.b.lane; b.dir = o.b.dir; b.core = o.b.core / 100; b.ph2 = o.b.ph2; b.cols = o.b.cols; b.tsegs = o.b.segs; } }
    for (const e of G.en) if (!e.dead && !seen.has(e.id)) e.dead = 1; // 방장 쪽에서 이미 사라진 적
    if (o.g && !G.gate) { G.gate = 1; roomClear(); }
  },
  // 손님: 적을 받은 위치로 부드럽게 옮기고 깜빡임·애니메이션만 진행
  enemyFrame(dt) {
    const a = Math.min(1, dt * 12);
    for (const e of G.en) {
      if (e.dead) continue; e.fl -= dt; e.tm -= dt; if (e.spawnT > 0) e.spawnT -= dt;
      if (e.tx != null) { const ox = e.x; e.x = lerp(e.x, e.tx, a); e.y = lerp(e.y, e.ty, a); e.z = lerp(e.z, e.tz, a); if (e.st === 'walk') e.ph += Math.abs(e.x - ox) * .06 + dt * 2; }
      if (e.t === 'boss') { if (e.tsegs) e.segs.forEach((s, i) => { const q = e.tsegs[i]; if (q) { s.x = lerp(s.x, q[0], a); s.y = lerp(s.y, q[1], a); } }); e.core -= dt; bossHurt(e); }
    }
  },
  hit(e, dmg, h, dir, bl) { if (!e.id) return; NET.send({ k: 'hit', to: NET.hostId, id: e.id, dmg, dir, bl: bl ? 1 : 0, h: { d: h.d, kb: h.kb, lift: h.lift || 0, st: h.st, s: h.s } }); },
  rhit(e, o, pr) {
    const col = pr && CL[pr.cls] ? CL[pr.cls].col : '#ffffff', h = o.h || {}, dmg = Math.max(0, Math.min(99999, +o.dmg || 0));
    e.hp -= dmg; e.fl = .09; const hy = e.y - e.z - e.h * .55; spark(e.x, hy, col, 14); tx(e.x + rnd(-10, 10), e.y - e.z - e.h - 14, dmg.toLocaleString(), col, 13);
    if (o.bl) { e.vx = o.dir * 40; dieCheck(e, o.dir); return; }
    react(e, H({ d: h.d || 1, kb: h.kb || 40, lift: h.lift || 0, st: h.st || .3, s: h.s || 'slash' }), o.dir || 1, h.s === 'heavy' || h.d >= 2);
  },
  becomeHost() { tx(G.P.x, G.P.y - 140, '이제 내가 방장이에요', '#7df9ff', 13); for (const e of G.en) { e.tx = null; if (e.t === 'boss') { e.tsegs = null; if (!e.st) e.st = 'idle'; } } },
};
// 적이 쫓을 대상: 가장 가까운 살아 있는 동료(방장 계산용)
function tgt(e) { let best = G.P, bd = 1e9; for (const o of NET.tgtList()) { const d = Math.abs(o.x - e.x) + Math.abs(o.y - e.y) * 2; if (d < bd) { bd = d; best = o; } } return best; }
// 동료 직업 그림(필요한 직업만 한 번 굽기)
const PSPR = {};
function buildPeer(cls) { const k = sprK(); if (!CL[cls]) return; if (PSPR[cls] && PSPR[cls].k === k) return; const c = CL[cls], o = { k, p: {} }; if (ATL.sp[cls]) { o.p = ATL.sp[cls]; PSPR[cls] = o; return; } for (const f of FRAMES) o.p[f] = bake(ART[cls], joints(f), k, c.col, c.col2, [360, 300, 30]); PSPR[cls] = o; }
function drawPeer(g, pr) {
  const s = pr.s, S = PSPR[pr.cls]; if (!S) return; const sp = S.p[pr.fr] || S.p.idle; if (!sp) return;
  g.save(); if (pr.gh) g.globalAlpha = .35; else if (pr.inv && Math.floor(G.t * 20) % 2) g.globalAlpha = .6;
  put(g, sp, s.x, s.y - s.z, pr.dd || 1, .5, 0, pr.gh ? -(pr.dd || 1) * 1.2 : 0); g.globalAlpha = 1;
  const ny = s.y - s.z - 118; g.font = '400 11px ' + FONT_K; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(pr.name, s.x, ny); g.fillStyle = CL[pr.cls].col; g.fillText(pr.name, s.x, ny);
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(s.x - 18, ny + 4, 36, 4); g.fillStyle = '#6bff9a'; g.fillRect(s.x - 18, ny + 4, 36 * Math.max(0, (pr.hp || 0) / (pr.mh || 1)), 4); g.restore();
}
function peerShadows() { const L = []; if (NET.on) for (const p of NET.peers.values()) if (p.s) L.push({ peer: p, x: p.s.x, y: p.s.y, z: p.s.z, w: 26 }); return L; }
// 로비 '협동' 탭
function coopTab() {
  let h = '<div class="nr-box"><h3>🤝 협동 던전 (2~4명)</h3>';
  if (NET.avail === undefined) { NET.avail = null; fetch('/api/coop?r=TEST').then(r => r.json()).then(j => { NET.avail = !!j.on; }).catch(() => { NET.avail = false; }).then(() => { if (!G && tab === 'coop') lobby(); }); }
  if (NET.avail === false && NET.state === 'idle' && !/^(localhost|127\.)/.test(location.hostname)) return h + '<p class="nr-note">🛠️ 협동 방 서버를 준비하고 있어요. 곧 열려요!</p></div>';
  if (NET.state === 'idle' || NET.state === 'conn') {
    h += '<p class="nr-note">친구와 같은 던전에 들어가요. 방을 만들고 코드를 알려 주거나, 받은 코드로 들어가세요. 각자 고른 직업으로 싸우고, 얻은 아이템·골드는 각자 가져가요.</p>'
      + '<div class="nr-row"><span>새 방</span><button type="button" class="nr-sb" data-co="new"' + (NET.state === 'conn' ? ' disabled' : '') + '>방 만들기</button></div>'
      + '<div class="nr-row"><span><input id="nr-code" maxlength="6" placeholder="방 코드" autocomplete="off" style="width:110px;font:inherit;padding:6px 8px;border-radius:8px;border:2px solid #4b3a8a;background:#0d0a22;color:#fff;text-transform:uppercase"></span><button type="button" class="nr-sb g" data-co="join"' + (NET.state === 'conn' ? ' disabled' : '') + '>참가</button></div>';
    if (NET.msg) h += '<p class="nr-note" style="color:#ffb3c6">' + NET.msg + '</p>';
  } else {
    const me = { id: NET.id, name: NET.nick + ' (나)', cls: pick }, all = [me, ...NET.peers.values()];
    h += '<div class="nr-row"><span>방 코드 <b style="font-size:22px;letter-spacing:4px;color:#ffd166">' + NET.room + '</b></span><button type="button" class="nr-sb" data-co="share">초대 링크 복사</button></div>';
    h += all.map(p => '<div class="nr-row"><span>' + (p.id === NET.hostId ? '👑 ' : '') + esc(p.name) + '</span><span style="color:' + (CL[p.cls] ? CL[p.cls].col : '#fff') + '">' + (CL[p.cls] ? CL[p.cls].name : '?') + '</span></div>').join('');
    h += '<p class="nr-note">직업은 「출발」 탭에서 바꿀 수 있어요. ' + all.length + ' / 4명</p>';
    h += NET.host ? '<button type="button" class="nr-go" data-co="start">함께 출발 ▶</button>' : '<p class="nr-note">👑 방장이 출발하면 같이 시작해요.</p>';
    h += '<div class="nr-row"><span></span><button type="button" class="nr-sb" data-co="leave">방 나가기</button></div>';
    if (NET.msg) h += '<p class="nr-note" style="color:#ffb3c6">' + NET.msg + '</p>';
  }
  return h + '</div>';
}
function coopClick(k) {
  if (k === 'new') { const A2 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 4; i++) c += A2[(Math.random() * A2.length) | 0]; NET.connect(c); lobby(); return; }
  if (k === 'join') { const v = (document.getElementById('nr-code') || {}).value || ''; const c = v.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length < 4) { NET.msg = '방 코드 4자리를 넣어 주세요.'; lobby(); return; } NET.connect(c); lobby(); return; }
  if (k === 'leave') { NET.leave(); lobby(); return; }
  if (k === 'start') { if (!NET.host) return; NET.on = true; NET.setHost(NET.id); NET.send({ k: 'start' }); start(pick); return; }
  if (k === 'share') { const u = location.origin + location.pathname + '#coop=' + NET.room; try { navigator.clipboard.writeText(u); NET.msg = '초대 링크를 복사했어요: ' + u; } catch (e) { NET.msg = u; } lobby(); }
}
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* =================== 화면·입력 =================== */
function css() {
  const st = document.createElement('style'); const K = FONT_K;
  st.textContent = '.nr-ov{position:fixed;inset:0;z-index:9999;background:#05040c;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;font-family:system-ui,sans-serif}.nr-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.nr-btns{position:absolute;top:max(6px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2}.nr-btns button{width:34px;height:34px;border-radius:10px;border:1px solid #ffffff33;background:#0c0620cc;color:#fff;font-size:14px;cursor:pointer}'
    + '.nr-pn{position:absolute;inset:0;z-index:3;background:radial-gradient(120% 90% at 50% 100%,#2a1458 0%,#0b0820 55%,#05040c 100%);overflow:auto;color:#eee;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 16px max(12px,env(safe-area-inset-left))}'
    + '.nr-pn .nr-t{display:block;font-family:' + K + ';font-weight:400;text-align:center;margin:4px 0 2px;font-size:30px;background:linear-gradient(#fff,#c9a6ff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 10px #b46bff88)}.nr-sub{text-align:center;color:#7df9ff;font-size:11px;letter-spacing:.3em;margin:0 0 8px}'
    + '.nr-tabs{display:flex;gap:6px;justify-content:center;margin:0 0 10px}.nr-tabs button{border:1px solid #ffffff2a;background:#ffffff0d;color:#cfc8ff;border-radius:999px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}.nr-tabs button.on{background:#7df9ff;color:#06101a;border-color:#7df9ff;font-weight:700}'
    + '.nr-cls{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;max-width:900px;margin:0 auto}@media (max-width:640px) and (orientation:portrait){.nr-cls{grid-template-columns:repeat(3,1fr)}}'
    + '.nr-c{position:relative;border-radius:14px;border:1.5px solid #ffffff22;background:linear-gradient(#18163a,#0a0918);padding:6px 6px 8px;cursor:pointer;text-align:center;color:#fff;font:inherit}.nr-c.on{border-color:var(--c);box-shadow:0 0 18px color-mix(in srgb,var(--c) 50%,transparent)}.nr-c canvas{position:static;width:100%;height:auto;aspect-ratio:1/1.1}.nr-c b{display:block;font-family:' + K + ';font-weight:400;font-size:17px;color:var(--c)}.nr-c small{display:block;font-size:11px;color:#bbb;line-height:1.3;min-height:2.6em}.nr-c i{position:absolute;top:6px;right:6px;font-style:normal;font-size:10px;background:#ffffff1a;border-radius:8px;padding:1px 6px}'
    + '.nr-go{display:block;margin:12px auto 4px;padding:13px 34px;border:0;border-radius:999px;font-family:' + K + ';font-size:19px;color:#0a0618;background:linear-gradient(90deg,#7df9ff,#b46bff);box-shadow:0 0 22px #b46bff88;cursor:pointer}.nr-note{text-align:center;color:#9f97c9;font-size:12px;margin:6px 0}'
    + '.nr-box{max-width:620px;margin:0 auto;background:#0f0c26cc;border:1px solid #ffffff1a;border-radius:14px;padding:12px 14px}.nr-box h3{font-family:' + K + ';font-weight:400;margin:2px 0 8px;color:#ffd166;font-size:18px}.nr-row{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ffffff10;font-size:13px}.nr-row:last-child{border:0}'
    + '.nr-sb{border:0;border-radius:10px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;background:#7df9ff;color:#06101a;font-weight:700;white-space:nowrap}.nr-sb.g{background:#ffffff1a;color:#fff}.nr-sb:disabled{opacity:.4}'
    + '.nr-bar{height:8px;background:#ffffff14;border-radius:4px;overflow:hidden}.nr-bar>i{display:block;height:100%;background:linear-gradient(90deg,#ff8fd8,#ffd6f5)}.nr-dex{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}.nr-dex div{background:#ffffff0a;border-radius:10px;padding:8px;font-size:12px;text-align:center}.nr-dex .no{color:#666}'
    + '.nr-res h2{all:unset;display:block;font-family:'+K+';font-size:26px;color:#fff;margin:6px 0}.nr-res{max-width:420px;margin:4vh auto 0;text-align:center}.nr-res .sc{font-family:' + FONT_N + ';font-size:22px;color:#7df9ff;margin:8px 0;text-shadow:0 0 10px #7df9ff}.nr-res p{margin:5px 0;font-size:14px;color:#cfc8ff}.nr-res button{display:block;width:100%;margin:7px 0 0;padding:12px;border-radius:12px;border:0;font:inherit;font-size:15px;font-weight:800;cursor:pointer}.p1{background:#ffd23f;color:#1a0f00}.p2{background:#ff3d9a;color:#fff}.p3{background:#ffffff1a;color:#fff}.p4{background:#3ddc84;color:#04220f}'
    + '.nr-rot{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;text-align:center;color:#fff;font-family:' + K + ';font-size:20px;background:#05040cf2;padding:20px}@media (orientation:portrait) and (pointer:coarse){.nr-ov.play .nr-rot{display:flex}}';
  document.head.appendChild(st);
}
function mkDom() {
  css(); ov = document.createElement('div'); ov.className = 'nr-ov'; ov.hidden = true;
  cv = document.createElement('canvas'); x = cv.getContext('2d', { alpha: false }); ov.appendChild(cv);
  btnBar = document.createElement('div'); btnBar.className = 'nr-btns'; btnBar.innerHTML = '<button type="button" data-k="m" aria-label="소리"></button><button type="button" data-k="p" aria-label="일시정지">Ⅱ</button><button type="button" data-k="x" aria-label="나가기">✕</button>'; ov.appendChild(btnBar);
  panel = document.createElement('div'); panel.className = 'nr-pn'; panel.hidden = true; ov.appendChild(panel);
  const rot = document.createElement('div'); rot.className = 'nr-rot'; rot.innerHTML = '📱↻<br>휴대폰을 가로로 돌려 주세요'; ov.appendChild(rot);
  document.body.appendChild(ov);
  const mb = btnBar.querySelector('[data-k=m]'); mb.textContent = A.muted ? '🔇' : '🔊';
  btnBar.addEventListener('pointerdown', e => e.stopPropagation());
  btnBar.onclick = e => { const k = e.target.dataset.k; if (k === 'm') { A.muted = !A.muted; mb.textContent = A.muted ? '🔇' : '🔊'; try { localStorage.setItem('raid_mute', A.muted ? '1' : '0'); } catch (er) {} if (A.master) A.master.gain.value = A.muted ? 0 : .5; } if (k === 'p') pause(!paused); if (k === 'x') { if (G && G.mode === 'play') { G = null; lobby(); } else close(); } };
  addEventListener('resize', () => { if (!ov.hidden) layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode === 'play' && !paused) pause(true, true); });
  addEventListener('blur', () => { if (!ov.hidden && G && G.mode === 'play' && !paused && !DEBUG) pause(true, true); });
  input();
}
function layout() {
  const cw = ov.clientWidth || innerWidth, ch = ov.clientHeight || innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2); if (cw * ch * dpr * dpr > 3.6e6) dpr = Math.sqrt(3.6e6 / (cw * ch));
  let s = ch / VH; VW = clamp(cw / s, 480, 760); s = Math.min(s, cw / VW);
  lay = { s, dpr, cw, ch, ox: (cw - VW * s) / 2, oy: (ch - VH * s) / 2 };
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  touch.on = matchMedia('(pointer:coarse)').matches || DEBUG && /touch/.test(location.hash);
  if (G) buildSprites(G.cls);
}
const KEYMAP = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', KeyZ: 'atk', KeyJ: 'atk', KeyX: 'jump', KeyK: 'jump', KeyC: 'dash', KeyL: 'dash', KeyA: 's0', KeyS: 's1', KeyD: 's2', KeyF: 's3', KeyV: 'ult', Space: 'ult' };
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; if (e.code === 'KeyP' || e.code === 'Escape') { pause(!paused); return; }
    if (paused && G && G.autoP) { pause(false); return; }
    const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); if (e.repeat) return; keys[k] = 1;
    if (k === 'l' || k === 'r') { const now = performance.now(); if (keys['last' + k] && now - keys['last' + k] < 260) inp.dash = 1; keys['last' + k] = now; }
    if (k === 'atk') inp.atk = 1; if (k === 'jump') inp.jump = 1; if (k === 'dash') inp.dash = 1; if (k[0] === 's' && k.length === 2) inp.sk[+k[1]] = 1; if (k === 'ult') inp.ult = 1;
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = 0; });
  const toL = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) - lay.ox) / lay.s, ((e.clientY - r.top) - lay.oy) / lay.s]; };
  cv.addEventListener('pointerdown', e => {
    audioInit(); if (!G) return; if (paused && G.autoP) { pause(false); return; }
    const [lx, ly] = toL(e); touch.on = touch.on || e.pointerType === 'touch'; if (!touch.on) return;
    const T = touchLayout(); for (const k in T) { const [bx, by, r] = T[k]; if (Math.hypot(lx - bx, ly - by) < r + 8) { touch.btn[e.pointerId] = k; if (k === 'atk') { inp.atk = 1; inp.atkH = 1; } else if (k === 'jump') inp.jump = 1; else if (k === 'dash') inp.dash = 1; else if (k === 'ult') inp.ult = 1; else inp.sk[+k[1]] = 1; return; } }
    if (lx < VW * .55 && !touch.stick) touch.stick = { id: e.pointerId, x0: lx, y0: ly, dx: 0, dy: 0 };
  });
  cv.addEventListener('pointermove', e => { const s = touch.stick; if (!s || s.id !== e.pointerId) return; const [lx, ly] = toL(e); let dx = (lx - s.x0) / 34, dy = (ly - s.y0) / 34; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } if (l > 2.2) { s.x0 = lx - dx * 34; s.y0 = ly - dy * 34; } s.dx = dx; s.dy = dy; });
  const up = e => { if (touch.stick && touch.stick.id === e.pointerId) touch.stick = null; if (touch.btn[e.pointerId] === 'atk') inp.atkH = 0; delete touch.btn[e.pointerId]; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
function readMove() {
  let mx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), my = (keys.d ? 1 : 0) - (keys.u ? 1 : 0); inp.atkH = inp.atkH && (keys.atk || Object.values(touch.btn).includes('atk')) ? 1 : 0; if (keys.atk) inp.atkH = 1;
  if (touch.stick) { const s = touch.stick; mx = Math.abs(s.dx) > .25 ? s.dx : 0; my = Math.abs(s.dy) > .3 ? s.dy : 0; }
  if (G && G.bot) { const b = botInput(); mx = b[0]; my = b[1]; }
  inp.mx = clamp(mx, -1, 1); inp.my = clamp(my, -1, 1);
}
function botInput() {
  const P = G.P; let best = null, bd = 1e9; for (const e of G.en) { if (e.dead || e.spawnT > 0) continue; const d = Math.abs(e.x - P.x) + Math.abs(e.y - P.y) * 2; if (d < bd) { bd = d; best = e; } }
  if (!best) return [G.gate ? 1 : 0, 0];
  const rng = /arrow|bolt|needle/.test(JSON.stringify(G.c.combo[0])) ? 150 : 55; let side = Math.sign(P.x - best.x) || 1; if (best.x + side * rng * .8 < 20 || best.x + side * rng * .8 > G.L - 20) side = -side; const dx = best.x + side * rng * .8 - P.x, dy = best.y - P.y;
  if (Math.abs(dx) < 30 && Math.abs(dy) < 14) { P.f = Math.sign(best.x - P.x) || 1; inp.atkH = 1; for (let i = 0; i < 4; i++) if (P.cd[i] <= 0 && P.mp > 40 && Math.random() < .03) inp.sk[i] = 1; if (P.ult >= 100) inp.ult = 1; return [0, 0]; }
  return [Math.abs(dx) > 8 ? Math.sign(dx) : 0, Math.abs(dy) > 6 ? Math.sign(dy) : 0];
}
/* =================== 진행 =================== */
function update(dt) {
  G.tipCd = (G.tipCd || 0) - dt; G.shake = Math.max(0, G.shake - dt * 30); G.flash = Math.max(0, G.flash - dt * 3); G.fade = Math.max(0, G.fade - dt * 2.5); G.redT = Math.max(0, (G.redT || 0) - dt);
  if (G.stop > 0) { G.stop -= dt; return; }
  const real = dt; if (G.slow > 0) { G.slow -= real; dt *= .3; }
  G.t += dt; G.ultFx = Math.max(0, (G.ultFx || 0) - real * 1.2); G.tipT -= dt; if (G.rank) G.rank.t -= real; if (G.hatch > 0) G.hatch -= real;
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  if (G.mode === 'dying') { G.deadT -= real; fxUpdate(dt); for (const e of G.en) if (!e.dead && e.t !== 'boss') physE(e, dt); if (G.deadT <= 0) finish(false); return; }
  playerUpdate(dt);
  if (NET.guest) NET.enemyFrame(dt);
  else for (const e of G.en) { if (e.dead) continue; if (e.t === 'boss') bossUpdate(e, dt); else if (!e.crate) enemyUpdate(e, dt); else e.fl -= dt; }
  if (NET.on) NET.tick(dt);
  projUpdate(dt); areaUpdate(dt); hazUpdate(dt); totemUpdate(dt); petUpdate(dt); itemUpdate(dt); fxUpdate(dt); roomUpdate(dt);
  G.en = G.en.filter(e => !e.dead);
  const tc = clamp(G.P.x - VW * .42, 0, Math.max(0, G.L - VW)); G.camX = lerp(G.camX, tc, Math.min(1, dt * 8));
}
function loop(now) {
  raf = requestAnimationFrame(loop); let dt = Math.min(.05, (now - last) / 1000); last = now; if (!G) { drawIdle(); return; }
  readMove(); if (G.fast) dt *= G.fast;
  if (G.cnt > 0 && !paused) { G.cnt -= dt; }
  else if (!paused && (G.mode === 'play' || G.mode === 'dying')) { acc += dt; let n = 0; while (acc >= STEP && n < 8) { update(STEP); acc -= STEP; n++; if (G.mode === 'over') { acc = 0; break; } } if (n >= 8) acc = 0; if (A.ctx) music(G.R && G.R.boss); }
  else acc = 0;
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#05040c'; x.fillRect(0, 0, cv.width, cv.height);
  draw();
}
function drawIdle() { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#05040c'; x.fillRect(0, 0, cv.width, cv.height); }
function pause(p, auto) {
  if (!G || G.mode !== 'play' || NET.on) return;
  if (p) { if (paused || G.cnt > 0) return; if (!auto) { if (G.pauseLeft <= 0) { tx(G.P.x, G.P.y - 120, '멈춤은 한 판에 1번!', '#ff5e7e', 13); return; } G.pauseLeft--; } paused = true; G.autoP = !!auto; if (A.ctx) A.ctx.suspend(); }
  else { if (!paused) return; paused = false; G.cnt = 3; if (A.ctx) A.ctx.resume(); }
  touch.stick = null; for (const k in keys) keys[k] = 0; last = performance.now();
}
/* =================== 로비: 출발·동료·장비·도감 =================== */
let tab = 'go', pick = null;
function portrait(k, w) { const c = document.createElement('canvas'), h = w * 1.1, d = Math.min(2, window.devicePixelRatio || 1); c.width = w * d; c.height = h * d; const g = c.getContext('2d'); g.scale(d, d); const pf = k === 'archer' ? 'cast' : 'c1b', sp = ATL.sp[k] ? ATL.sp[k][pf] : bake(ART[k], joints(pf), .7 * d / d * 1.4, CL[k].col, CL[k].col2); g.fillStyle = rg(g, w / 2, h * .8, 4, w * .7, [[0, CL[k].col + '33'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h); put(g, sp, w / 2 - 4, h * .96 - (k === 'fairy' ? 0 : 0), 1, w / 260, 0); return c; }
function lobby() {
  ov.classList.remove('play'); panel.hidden = false; btnBar.hidden = true; pick = pick || SV.last || 'knight'; const gl = guildLv();
  let h = '<div class="nr-t">네온 레이드</div><p class="nr-sub">NEON RAID · 체험판</p><p class="nr-note">💰 ' + SV.mats.gold.toLocaleString() + 'G · 💎 강화석 ' + SV.mats.stone + ' · 🍬 젤리 ' + SV.mats.jelly + '</p><div class="nr-tabs">' + [['go', '출발'], ['coop', '협동' + (NET.state === 'room' ? ' ' + (NET.peers.size + 1) + '명' : '')], ['pet', '동료'], ['gear', '장비'], ['shop', '상점'], ['dex', '도감']].map(t => '<button type="button" data-t="' + t[0] + '"' + (tab === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>').join('') + '<button type="button" data-t="exit">나가기</button></div>';
  if (tab === 'go') {
    h += '<div class="nr-cls">' + CLS.map(k => '<button type="button" class="nr-c' + (pick === k ? ' on' : '') + '" data-c="' + k + '" style="--c:' + CL[k].col + '"><i>' + CL[k].tag + '</i><span class="pc" data-p="' + k + '"></span><b>' + CL[k].name + '</b><small>Lv.' + SV.lv[k] + ' · ' + CL[k].desc + '</small></button>').join('') + '</div>';
    const st = stats(pick), c = CL[pick];
    h += '<button type="button" class="nr-go" data-go="1">균열 속으로 ▶</button><p class="nr-note">⚡ 전투력 <b style="color:#ffd166">' + power(pick).toLocaleString() + '</b> · ' + c.name + ' 체력 ' + st.hp + ' · 공격 ' + st.atk + ' · 기술: ' + c.sk.map(s => s.name).join(' · ') + ' · 필살기 ' + c.ult.name + '</p><p class="nr-note">🛡️ 모험단 Lv.' + gl + ' (모든 직업 +' + gl + '%) · 직업을 골고루 키우면 모험단이 자라요</p>';
  } else if (tab === 'coop') { h += coopTab();
  } else if (tab === 'pet') {
    const f = petForm(), lv = SV.pet.lv, nd = lv * 2 + 1;
    h += '<div class="nr-box"><h3>🐾 꼬마 동료 · ' + PET.name + '</h3>';
    if (!lv) h += '<p>아직 알 상태예요. 던전 <b>첫 방</b>을 정리하면 알에서 깨어나요!</p>';
    else h += '<div class="nr-row"><span>' + PET.forms[f] + ' · Lv.' + lv + '</span><span>다음 모습: ' + (f < 3 ? PET.forms[f + 1] + ' (Lv.' + PET.need[f + 1] + ')' : '최종 모습') + '</span></div><div class="nr-bar"><i style="width:' + Math.round(SV.pet.xp / nd * 100) + '%"></i></div>'
      + '<div class="nr-row"><span>반짝 젤리 ' + SV.mats.jelly + '개</span><button type="button" class="nr-sb" data-feed="1"' + (SV.mats.jelly ? '' : ' disabled') + '>젤리 주기</button></div>'
      + '<p class="nr-note">전투에서 ' + PET.name + '가 ' + ['', '3초', '2.6초', '2.2초', '1.7초'][f + 1] + '마다 적을 콕 찌르고, 떨어진 재료를 끌어와 줘요. 자랄수록 더 자주, 더 세게!</p>';
    h += '<p class="nr-note">' + PET.desc + '</p></div>';
  } else if (tab === 'gear') {
    const gs = gearStat(); h += '<div class="nr-box"><h3>⚔️ 장비 (모든 직업 공용)</h3><p class="nr-note">공격 +' + Math.round(gs.atk) + '% · 체력 +' + Math.round(gs.hp) + '% · 강화석 ' + SV.mats.stone + '개 · 강화는 실패하지 않아요</p>';
    for (const s of ['w', 'a', 'r']) { const q = gearOf(SV.eq[s]); h += '<div class="nr-row"><span>' + SLOT[s] + ' · ' + (q ? '<b style="color:' + GRADE[q.g][1] + '">' + gearName(q) + '</b> (' + (s === 'w' ? '공격' : s === 'a' ? '체력' : '공격·체력 절반') + ' +' + gearVal(q) + '%)' : '<span style="color:#777">비어 있음</span>') + '</span>' + (q && q.p < 10 ? '<button type="button" class="nr-sb" data-up="' + q.id + '"' + (SV.mats.stone > q.p && SV.mats.gold >= (q.p + 1) * 100 ? '' : ' disabled') + '>강화 💎' + (q.p + 1) + ' · ' + (q.p + 1) * 100 + 'G</button>' : '') + '</div>'; }
    const inv = SV.gear.filter(q => !Object.values(SV.eq).includes(q.id)).sort((a, b) => gearVal(b) - gearVal(a)).slice(0, 12);
    h += inv.length ? '<h3 style="margin-top:10px">가방</h3>' + inv.map(q => '<div class="nr-row"><span>' + SLOT[q.s] + ' · <b style="color:' + GRADE[q.g][1] + '">' + gearName(q) + '</b> +' + gearVal(q) + '%</span><button type="button" class="nr-sb g" data-eq="' + q.id + '">장착</button></div>').join('') : '<p class="nr-note">던전에서 장비를 주우면 여기에 쌓여요. 더 좋은 장비는 자동으로 장착돼요.</p>';
    h += '</div>';
  } else if (tab === 'shop') {
    if (SV.ex.d !== KDAY()) SV.ex = { d: KDAY(), n: 0 }; const B = opts.bonus, coins = B ? B.coins() : 0, left = EX_MAX - SV.ex.n;
    h += '<div class="nr-box"><h3>💰 골드 상점</h3><p class="nr-note">골드는 던전에서 떨어지고, 5락실 코인으로도 바꿀 수 있어요.</p>'
      + '<div class="nr-row"><span>🪙 코인 1개 → ' + EX_GOLD + 'G <small>(오늘 ' + left + '번 남음 · 보유 코인 ' + coins + ')</small></span><button type="button" class="nr-sb" data-ex="1"' + (left > 0 && coins > 0 ? '' : ' disabled') + '>바꾸기</button></div>'
      + '<div class="nr-row"><span>💎 강화석 1개 · 150G</span><button type="button" class="nr-sb" data-buy="stone"' + (SV.mats.gold >= 150 ? '' : ' disabled') + '>사기</button></div>'
      + '<div class="nr-row"><span>🍬 반짝 젤리 1개 · 80G</span><button type="button" class="nr-sb" data-buy="jelly"' + (SV.mats.gold >= 80 ? '' : ' disabled') + '>사기</button></div>'
      + '<p class="nr-note">코인은 출석·미션·다른 5락실 게임으로 무료로 모아요. 하루 ' + EX_MAX + '개까지만 바꿀 수 있어요.</p></div>';
  } else if (tab === 'dex') {
    const m = SV.dex.m, gN = Object.keys(SV.dex.g).length; h += '<div class="nr-box"><h3>📖 도감</h3><p class="nr-note">처음 쓰러뜨린 몬스터 1종마다 공격 +0.5% · 장비 ' + gN + ' / 60 · 동료 ' + (petForm() ? petForm() : 0) + ' / 3</p><div class="nr-dex">';
    for (const t of ['grunt', 'shield', 'drone', 'elite', 'boss']) h += m[t] ? '<div><b>' + ET[t].name + '</b><br><small>' + ET[t].desc + '</small><br>처치 ' + m[t] + '</div>' : '<div class="no">???<br><small>아직 만나지 못했어요</small></div>';
    for (let i = 1; i <= 3; i++) h += petForm() >= i ? '<div><b>' + PET.forms[i] + '</b><br><small>꼬마 동료의 ' + i + '번째 모습</small></div>' : '<div class="no">???<br><small>동료를 키워 보세요</small></div>';
    h += '</div></div>';
  }
  panel.innerHTML = h;
  panel.querySelectorAll('.pc').forEach(sp => sp.appendChild(portrait(sp.dataset.p, 150)));
  panel.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; audioInit();
    if (b.dataset.t) { if (b.dataset.t === 'exit') { close(); return; } tab = b.dataset.t; lobby(); return; }
    if (b.dataset.co) { coopClick(b.dataset.co); return; }
    if (b.dataset.c) { pick = b.dataset.c; if (NET.state === 'room') NET.send({ k: 'cls', c: pick }); lobby(); return; }
    if (b.dataset.go) { if (NET.state === 'room') { tab = 'coop'; lobby(); return; } start(pick); return; }
    if (b.dataset.feed) { if (SV.mats.jelly > 0) { SV.mats.jelly--; SV.pet.xp++; sfx('pet'); const nd = SV.pet.lv * 2 + 1; if (SV.pet.xp >= nd) { SV.pet.xp -= nd; const f0 = petForm(); SV.pet.lv++; sfx('lv'); if (petForm() > f0) SV.dex.p[petForm()] = 1; } save(); lobby(); } return; }
    if (b.dataset.up) { const q = gearOf(+b.dataset.up); if (q && SV.mats.stone > q.p && SV.mats.gold >= (q.p + 1) * 100 && q.p < 10) { SV.mats.stone -= q.p + 1; SV.mats.gold -= (q.p + 1) * 100; q.p++; sfx('lv'); save(); lobby(); } return; }
    if (b.dataset.ex) { if (SV.ex.d !== KDAY()) SV.ex = { d: KDAY(), n: 0 }; if (SV.ex.n < EX_MAX && opts.bonus && opts.bonus.spend(1)) { SV.ex.n++; SV.mats.gold += EX_GOLD; sfx('lv'); save(); } lobby(); return; }
    if (b.dataset.buy) { const cost = b.dataset.buy === 'stone' ? 150 : 80; if (SV.mats.gold >= cost) { SV.mats.gold -= cost; SV.mats[b.dataset.buy]++; sfx('pick'); save(); } lobby(); return; }
    if (b.dataset.eq) { const q = gearOf(+b.dataset.eq); if (q) { SV.eq[q.s] = q.id; sfx('pick'); save(); lobby(); } return; }
  };
}
function start(cls) { panel.hidden = true; btnBar.hidden = false; ov.classList.add('play'); paused = false; if (!DEBUG) fs(); layout(); audioInit(); newRun(cls); last = performance.now(); acc = 0; }
function showResult() {
  const r = G.result, mm = Math.floor(r.time / 60), ss = Math.floor(r.time % 60); let best = 0; try { best = +localStorage.getItem('raid_best_' + opts.day) || 0; if (r.score > best) { best = r.score; localStorage.setItem('raid_best_' + opts.day, best); } } catch (e) {}
  const drops = G.drops.gear.map(q => '<b style="color:' + GRADE[q.g][1] + '">' + gearName(q) + '</b>').join(', ');
  panel.innerHTML = '<div class="nr-res"><h2>' + (r.clear ? '🎉 균열 정리 완료!' : '쓰러졌어요') + '</h2><div class="sc">' + r.score.toLocaleString() + '</div>'
    + '<p>' + CL[r.cls].name + ' · ' + mm + ':' + String(ss).padStart(2, '0') + ' · 방 평가 ' + (r.ranks || '-') + ' · 최대 ' + r.combo + '콤보</p>'
    + '<p>경험치 +' + r.xp + (r.lvUp ? ' · <b style="color:#ffd166">레벨 업! Lv.' + SV.lv[r.cls] + '</b>' : '') + ' · 💰 +' + G.drops.gold + 'G · 젤리 +' + G.drops.jelly + ' · 강화석 +' + G.drops.stone + '</p><p>⚡ 전투력 ' + power(r.cls).toLocaleString() + '</p>' + (drops ? '<p>얻은 장비: ' + drops + '</p>' : '') + '<p>오늘 내 최고 ' + best.toLocaleString() + '점</p>'
    + contBtn() + '<button type="button" class="p1" data-k="r">▶ 다시 도전</button><button type="button" class="p3" data-k="l">로비 (동료·장비·도감)</button><button type="button" class="p2" data-k="s">결과 공유</button><button type="button" class="p3" data-k="x">나가기</button></div>';
  panel.hidden = false; btnBar.hidden = true;
  panel.onclick = e => { const k = e.target.dataset.k; if (!k) return; if (k === 'c') { cont(); return; } if (k === 'r') { if (NET.state === 'room') { NET.on = false; G = null; tab = 'coop'; lobby(); } else start(G.cls); } if (k === 'l') { NET.on = false; G = null; tab = NET.state === 'room' ? 'coop' : 'go'; lobby(); } if (k === 's') opts.share(r.score, r); if (k === 'x') close(); };
}
function contBtn() { const B = opts.bonus; if (!B || G.cont || G.result.clear || NET.state === 'room') return ''; const n = B.coins(); return n > 0 ? '<button type="button" class="p4" data-k="c">🪙 코인 1개로 이어하기 (보유 ' + n + ')</button>' : '<p class="nr-note">🪙 코인이 있으면 쓰러진 자리에서 이어할 수 있어요. 코인은 매일 출석체크로 무료!</p>'; }
function cont() { if (!G || G.cont || !opts.bonus || !opts.bonus.spend(1)) return; G.cont = 1; G.mode = 'play'; G.P.hp = Math.round(G.st.hp * .6); G.P.down = 0; G.P.hurt = 0; G.P.inv = 3; G.result = null; G.ep = []; panel.hidden = true; btnBar.hidden = false; for (const e of G.en) if (e.t !== 'boss' && !e.crate && Math.abs(e.x - G.P.x) < 200) { e.vx = Math.sign(e.x - G.P.x) * 500; e.vz = 300; e.st = 'air'; } tx(G.P.x, G.P.y - 120, 'CONTINUE!', '#ffd166', 18); last = performance.now(); }
function fs() { const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return; const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return; try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(() => layout()).catch(() => {}); } catch (e) {} }
function open() { ov.hidden = false; document.documentElement.style.overflow = 'hidden'; layout(); audioInit(); G = null; tab = 'go'; const m = location.hash.match(/coop=([A-Za-z0-9]{4,6})/); if (m) { tab = 'coop'; NET.connect(m[1].toUpperCase()); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} } lobby(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
function close(why) { NET.leave(); cancelAnimationFrame(raf); ov.hidden = true; document.documentElement.style.overflow = ''; panel.hidden = true; if (A.ctx) A.ctx.suspend(); const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} } const r = G && G.result; G = null; paused = false; opts.onExit(r || null, why); }
window.RaidGame = {
  boot(o) {
    opts = o; if (!ov) mkDom();
    atlasAll().then(() => { SPK = 0; for (const k2 of CLS) delete SPR['por_' + k2]; for (const k2 in PSPR) delete PSPR[k2]; if (G) buildSprites(G.cls); if (panel) panel.querySelectorAll('.pc').forEach(el => { const old = el.querySelector('canvas'); if (old) old.replaceWith(portrait(el.dataset.p, 150)); }); });
    if (DEBUG) window.__nr = { open, close, start, G: () => G, SV, bot(b) { G.bot = b; }, fast(n) { G.fast = n; }, god(b) { G.god = b; }, room(i) { G.room = i - 1; nextRoom(); }, ult() { G.P.ult = 100; }, step(n) { for (let i = 0; i < n && G && G.mode !== 'over'; i++) { readMove(); update(STEP); } }, draw: () => draw(), lobby, layout, finish, PSPR, SPR: () => SPR, NET };
    return { open };
  },
};
})();
