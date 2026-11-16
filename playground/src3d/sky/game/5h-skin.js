// 게임 전용 꾸미기(5락실 '🛒 이 게임 상점', 2026-11-16 BK "새 게임이 올라오면 스킨도"): 겉모습만 — 능력·판정 영향 없음.
// 발밑 오라(au): wind 바람 고리 · bloom 꽃잎 고리 · sun 황금 햇무리 / 걸음 흔적(tr): feather 깃털 · star 별가루. 사이트 코인으로 사고 Bonus.gitem('sky', k) 로 읽는다.
let SKN = { au: '', tr: '', t: -9 }, STR = [];
function skinNow() {
  if (G.t - SKN.t < 1 && SKN.t <= G.t) return SKN; SKN.t = G.t;
  const B = opts.bonus; try { SKN.au = B && B.gitem ? B.gitem('sky', 'au') : ''; SKN.tr = B && B.gitem ? B.gitem('sky', 'tr') : ''; } catch (e) { SKN.au = SKN.tr = ''; }
  return SKN;
}
function drawSkinUnder(P, sx, sy) {
  const S = skinNow(), t = G.t; 
  if (S.tr) { // 걸음 흔적: 0.4칸마다 하나, 1.6초 동안 옅어짐
    const l = STR[STR.length - 1]; if (!l || hyp(l.x - P.x, l.y - P.y) > .4) { STR.push({ x: P.x, y: P.y, t, r: Math.random() * TAU }); if (STR.length > 18) STR.shift(); }
    for (const f of STR) { const k = (t - f.t) / 2.2; if (k > 1 || k < 0) continue; const [fx, fy] = iso(f.x, f.y); x.globalAlpha = (1 - k) * .85;
      if (S.tr === 'feather') { x.save(); x.translate(fx, fy - 2 - k * 6); x.rotate(f.r); const g = x.createLinearGradient(-7, 0, 7, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#bfe6ff'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 7, 2.6, 0, 0, TAU); x.fill(); x.strokeStyle = '#7fb4d8'; x.lineWidth = .8; x.beginPath(); x.moveTo(-7, 0); x.lineTo(7, 0); x.stroke(); x.restore(); }
      else { const s = 5.4 * (1 - k * .5) * (.8 + Math.sin(t * 12 + f.r * 5) * .2); x.fillStyle = 'rgba(255,220,90,.35)'; x.beginPath(); x.arc(fx, fy - 3, s * 2.6, 0, TAU); x.fill(); x.fillStyle = k < .3 ? '#ffffff' : '#ffe58a'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = f.r + i * Math.PI / 4, rr = i % 2 ? s * .35 : s * 1.6; x.lineTo(fx + Math.cos(a) * rr, fy - 3 + Math.sin(a) * rr * .8); } x.closePath(); x.fill(); x.strokeStyle = 'rgba(170,110,0,.8)'; x.lineWidth = 1; x.stroke(); } }
    x.globalAlpha = 1;
  } else if (STR.length) STR.length = 0;
  if (!S.au) return;
  x.save(); x.translate(sx, sy); x.scale(1.3, 1.3); x.translate(-sx, -sy);
  if (S.au === 'wind') { // 바람 고리: 도는 바람 줄기 두 겹
    for (let j = 0; j < 2; j++) { const r = 22 + j * 6, sp = (j ? -1 : 1) * t * 2.4; x.strokeStyle = j ? 'rgba(190,240,255,.55)' : 'rgba(120,220,255,.85)'; x.lineWidth = j ? 1.6 : 2.4; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy, r, r * .48, 0, sp + i * TAU / 3, sp + i * TAU / 3 + 1.2); x.stroke(); } }
    for (let i = 0; i < 3; i++) { const k = (t * .9 + i / 3) % 1, a = i * 2.1 + t; x.globalAlpha = (1 - k) * .7; x.fillStyle = '#e8fbff'; x.beginPath(); x.ellipse(sx + Math.cos(a) * 20, sy - k * 30, 3.5 * (1 - k) + 1, 1.2, 0, 0, TAU); x.fill(); } x.globalAlpha = 1;
  } else if (S.au === 'bloom') { // 꽃잎 고리: 분홍 꽃잎 6장이 발밑을 돈다
    const g = x.createRadialGradient(sx, sy, 2, sx, sy, 26); g.addColorStop(0, 'rgba(255,170,210,.45)'); g.addColorStop(1, 'rgba(255,170,210,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(sx, sy, 26, 13, 0, 0, TAU); x.fill();
    for (let i = 0; i < 6; i++) { const a = t * 1.3 + i * TAU / 6, px = sx + Math.cos(a) * 22, py = sy + Math.sin(a) * 10.5; x.save(); x.translate(px, py); x.rotate(a * 2); x.fillStyle = i % 2 ? '#ffb3d1' : '#ff8fbf'; x.beginPath(); x.ellipse(0, 0, 4.6, 2.4, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(-1.3, -.5, 1.6, .8, 0, 0, TAU); x.fill(); x.restore(); }
  } else if (S.au === 'sun') { // 황금 햇무리: 금빛 원판 + 도는 빛살 + 피어오르는 금가루
    const pu = .5 + Math.sin(t * 3) * .5, g = x.createRadialGradient(sx, sy, 2, sx, sy, 30); g.addColorStop(0, `rgba(255,226,120,${.5 + pu * .2})`); g.addColorStop(1, 'rgba(255,200,60,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(sx, sy, 30, 15, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,214,90,.9)'; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy, 20 + pu * 2, 9.5 + pu, 0, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,240,180,.6)'; x.lineWidth = 1.4; for (let i = 0; i < 8; i++) { const a = t * .7 + i * TAU / 8; x.beginPath(); x.moveTo(sx + Math.cos(a) * 23, sy + Math.sin(a) * 11); x.lineTo(sx + Math.cos(a) * 31, sy + Math.sin(a) * 15); x.stroke(); }
    for (let i = 0; i < 5; i++) { const k = (t * .7 + i / 5) % 1, a = i * 1.9; x.globalAlpha = (1 - k); x.fillStyle = '#ffe27a'; x.beginPath(); x.arc(sx + Math.cos(a) * 14, sy - 4 - k * 52, 1.8, 0, TAU); x.fill(); } x.globalAlpha = 1;
  }
  x.restore();
}
