
/* =================== 그리기 =================== */
let ov, cv, x, lay = { Z: 1, dpr: 1, cw: 800, ch: 450 }, IM = {}, NPCK = [];
const HC = [112, 120, 56, 100], HF = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'atk0', 'atk1', 'atk2', 'atk3', 'cast0', 'cast1', 'cast2', 'hurt', 'dodge', 'die0', 'die1'];
const MC = { fluff: [96, 96, 48, 84], fluffking: [224, 224, 112, 200], seed: [96, 104, 48, 92], bird: [104, 132, 52, 120] };
function loadImg(k, src) { return new Promise(ok => { const im = new Image(); im.onload = () => { IM[k] = im; ok(); }; im.onerror = () => ok(); im.src = src; }); }
let assetsP = null;
function assets() {
  if (assetsP) return assetsP; const v = '?v=1';
  assetsP = Promise.all([...['warden', 'windcaller', 'fluff', 'fluffking', 'seed', 'bird', 'npc', 'props', 'icons'].map(k => loadImg(k, IMG + k + '.webp' + v)),
    fetch(IMG + 'props.json' + v).then(r => r.json()).then(j => { PM = j; }), fetch(IMG + 'npc.json' + v).then(r => r.json()).then(j => { NPCK = j; }), fetch(IMG + 'icons.json' + v).then(r => r.json()).then(j => { ICM = j; }).catch(() => {})]);
  return assetsP;
}
let ICM = {}; const DIRT = [];
function sprite(im, cw, ch, ax, ay, fr, row, X, Y, sc, flash, alpha) {
  if (!im) return; const w = cw * sc, h = ch * sc; if (alpha != null) x.globalAlpha = alpha;
  x.drawImage(im, fr * cw, row * ch, cw, ch, X - ax * sc, Y - ay * sc, w, h);
  if (flash) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.min(1, flash * 6) * .7; x.drawImage(im, fr * cw, row * ch, cw, ch, X - ax * sc, Y - ay * sc, w, h); x.globalCompositeOperation = 'source-over'; }
  x.globalAlpha = 1;
}
function heroFrame(P) {
  const a = P.an, t = P.at;
  if (a === 'run') return 2 + Math.floor((P.runT || 0) * 10) % 6;
  if (a === 'atk') return 8 + Math.min(3, Math.floor(t / (P.atkDur || .35) * 4));
  if (a === 'cast') return 12 + Math.min(2, Math.floor(t / (P.atkDur || .35) * 3));
  if (a === 'dodge') return 16; if (a === 'die') return t > .35 ? 18 : 17; if (P.hurt > .12) return 15;
  return Math.floor(G.t / .6) % 2;
}
function mobFrame(m) {
  const a = m.an, t = m.at;
  if (a === 'move') return 2 + Math.floor(t * (m.D.fly ? 8 : 6)) % 4;
  if (a === 'atk') { const w = m.D.boss ? .8 : .35; return 6 + Math.min(2, Math.floor(t / (w + .3) * 3)); }
  if (a === 'hurt') return 9; if (a === 'die') return t > .25 ? 11 : 10;
  return m.D.fly ? 2 + Math.floor(t * 8) % 4 : Math.floor(t / .5) % 2;
}
// 바닥 칸 해시(장식 위치 고정)
const hsh = (a, b) => { let h = a * 374761393 + b * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function drawSky(cw, ch) {
  const g = x.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, '#7fb8e8'); g.addColorStop(.55, '#b9dcf2'); g.addColorStop(1, '#e8f2f6'); x.fillStyle = g; x.fillRect(0, 0, cw, ch);
  // 구름바다: 화면 기준 느린 시차
  const [cx, cy] = G ? iso(G.cam[0], G.cam[1]) : [0, 0], px = -cx * .25 + (G ? G.t : performance.now() / 1000) * 6, py = -cy * .25;
  x.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 14; i++) { const bx = ((hsh(i, 1) * 2400 + px) % 2400 + 2400) % 2400 - 400, by = ((hsh(i, 2) * 1400 + py) % 1400 + 1400) % 1400 - 200, r = 60 + hsh(i, 3) * 120;
    x.beginPath(); x.ellipse(bx * cw / 1600, by * ch / 900, r * 1.8, r * .55, 0, 0, TAU); x.fill(); }
}
function view() { const { Z, cw, ch } = lay, [cx, cy] = iso(G.cam[0], G.cam[1]), sh = G.shake; return { ox: cw / 2 - cx * Z + (sh ? rnd(-sh, sh) : 0), oy: ch / 2 - cy * Z + (sh ? rnd(-sh, sh) : 0) - 30 * Z, Z }; }
function draw() {
  const { cw, ch, dpr } = lay; x.setTransform(dpr, 0, 0, dpr, 0, 0); drawSky(cw, ch);
  if (!G) return; const Wd = G.Wd, P = G.P, V = view(), Z = V.Z;
  x.setTransform(dpr * Z, 0, 0, dpr * Z, dpr * V.ox, dpr * V.oy);
  // 화면에 보이는 칸 범위
  const corners = [[0, 0], [cw, 0], [0, ch + 200], [cw, ch + 200]].map(([sx, sy]) => unIso((sx - V.ox) / Z, (sy - V.oy) / Z));
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 1), x1 = Math.min(Wd.W - 1, Math.ceil(Math.max(...corners.map(c => c[0]))) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 1), y1 = Math.min(Wd.H - 1, Math.ceil(Math.max(...corners.map(c => c[1]))) + 1);
  // 구름 소품(섬 아래, 시차)
  const T = TILES;
  for (let s = x0 + y0; s <= x1 + y1; s++) for (let yy = Math.max(y0, s - x1); yy <= Math.min(y1, s - x0); yy++) {
    const xx = s - yy, i = Wd.id(xx, yy), t = Wd.g[i]; if (!t) continue; const [sx, sy] = iso(xx, yy), h = hsh(xx, yy);
    if (t === 3 || t === 4) { const vert = (Wd.g[Wd.id(xx, yy - 1)] >= 3 || Wd.g[Wd.id(xx, yy + 1)] >= 3) && !(Wd.g[Wd.id(xx - 1, yy)] >= 3 || Wd.g[Wd.id(xx + 1, yy)] >= 3); const im = (t === 3 ? T.bridge : T.broken)[vert ? 1 : 0]; x.drawImage(im, sx - TW / 2, sy, TW, TH + 12); continue; }
    // 낭떠러지 면
    const isl = Wd.islands[Wd.isl[i]] || { r: 3 }, hb = clamp(Math.floor(isl.r / 3.2 + Wd.nz(xx * .3, yy * .3) * 1.6), 0, 4);
    if (!Wd.g[Wd.id(xx + 1, yy)] || xx + 1 >= Wd.W) x.drawImage(T.faceR[hb], sx, sy + TH / 2, TW / 2 + 2, TH / 2 + [26, 38, 52, 68, 86][hb] + 6);
    if (!Wd.g[Wd.id(xx, yy + 1)] || yy + 1 >= Wd.H) x.drawImage(T.faceL[hb], sx - TW / 2, sy + TH / 2, TW / 2 + 2, TH / 2 + [26, 38, 52, 68, 86][hb] + 6);
    let im; if (t === 2) { const c = Wd.nz(xx * .18 + 3, yy * .18) * 6; x.drawImage(T.grass[clamp(Math.floor(c), 0, 5) * 2], sx - TW / 2, sy, TW, TH); DIRT.push([sx, sy, Math.floor(h * 3)]); continue; } else if (t === 5) im = T.plaza[Math.floor(h * 3)]; else { const c = Wd.nz(xx * .18 + 3, yy * .18) * 6; im = T.grass[clamp(Math.floor(c), 0, 5) * 2 + (h > .5 ? 1 : 0)]; }
    x.drawImage(im, sx - TW / 2, sy, TW, TH);
    if (t === 1) { if (h < .22) x.drawImage(T.tuft[Math.floor(h * 18) % 4], sx - 8 + (hsh(yy, xx) - .5) * 30, sy + 8 + hsh(xx + 7, yy) * 12, 16, 12); else if (h > .93 && Wd.isl[i] !== Wd.town) x.drawImage(T.flower[Math.floor(h * 100) % 3], sx - 7 + (hsh(yy, xx) - .5) * 26, sy + 6 + hsh(xx + 3, yy) * 12, 14, 14); }
  }
  for (const [dx, dy, v] of DIRT) x.drawImage(T.dirt[v], dx - TW * .8, dy + TH / 2 - TH * .8, TW * 1.6, TH * 1.6); DIRT.length = 0;
  // 바닥 효과(안개·깃발 범위·경고)
  for (const a of G.areas) {
    if (a.k === 'mist') { const [ax, ay] = iso(a.x, a.y), al = Math.min(1, a.t * 3, (a.life - a.t) * 2); x.fillStyle = `rgba(235,242,250,${.45 * al})`; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(ax + Math.sin(G.t + k) * 10, ay + Math.cos(G.t * .7 + k) * 5, a.r * TW / 2 * (.7 + k * .08), a.r * TH / 2 * (.7 + k * .08), 0, 0, TAU); x.fill(); } }
    if (a.k === 'flag') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = 'rgba(160,220,255,.6)'; x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41, a.r * TH / 2 * 1.41, 0, 0, TAU); x.stroke(); x.setLineDash([]); }
    if (a.k === 'warn') { const [ax, ay] = iso(a.x, a.y), k = a.t / a.life; x.fillStyle = `rgba(255,90,70,${.15 + k * .25})`; x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41 * k, a.r * TH / 2 * 1.41 * k, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,120,90,.8)'; x.lineWidth = 2; x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41, a.r * TH / 2 * 1.41, 0, 0, TAU); x.stroke(); }
  }
  for (const w of Wd.wps) { const [ax, ay] = iso(w.x, w.y); x.fillStyle = w.on ? 'rgba(160,230,255,.35)' : 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(ax, ay, 26, 13, 0, 0, TAU); x.fill(); x.strokeStyle = w.on ? '#9fe4ff' : '#d8d2c4'; x.lineWidth = 2; x.beginPath(); x.ellipse(ax, ay, 26 + (w.on ? Math.sin(G.t * 3) * 2 : 0), 13, 0, 0, TAU); x.stroke(); }
  // 정렬해서 그리기
  const L = [], vis = (ex, ey) => ex >= x0 - 3 && ex <= x1 + 3 && ey >= y0 - 3 && ey <= y1 + 3;
  for (const p of Wd.props) if (vis(p.x, p.y)) L.push([p.x + p.y, 0, p]);
  for (const m of G.mobs) if (vis(m.x, m.y)) L.push([m.x + m.y, 1, m]);
  for (const k in Wd.npcAt) { const [nx, ny] = Wd.npcAt[k]; if (vis(nx, ny)) L.push([nx + ny, 2, k]); }
  for (const d of G.drops) if (vis(d.x, d.y)) L.push([d.x + d.y - .3, 3, d]);
  for (const w of Wd.wps) L.push([w.x + w.y, 5, w]);
  L.push([P.x + P.y, 4, P]); L.sort((a, b) => a[0] - b[0]);
  const hs = .5; // 2배 아틀라스 → 1배
  for (const [, k, o] of L) {
    if (k === 0) { const m = PM[o.k]; if (!m) continue; const [sx, sy] = iso(o.x, o.y); const fade = hyp(o.x - P.x, o.y - P.y) < 2.6 && o.x + o.y > P.x + P.y && m[3] > 220 ? .55 : 1; x.globalAlpha = fade; x.drawImage(IM.props, m[0], m[1], m[2], m[3], sx - m[4] * hs, sy - m[5] * hs, m[2] * hs, m[3] * hs); x.globalAlpha = 1; }
    else if (k === 1) drawMob(o);
    else if (k === 2) { const [sx, sy] = iso(G.Wd.npcAt[o][0], G.Wd.npcAt[o][1]); shadow(sx, sy, 12); sprite(IM.npc, HC[0], HC[1], HC[2], HC[3], Math.floor(G.t / .7 + o.length) % 2, NPCK.indexOf(o), sx, sy, hs); const Q = questMark(o); if (Q) { x.font = 'bold 15px system-ui'; x.textAlign = 'center'; x.fillStyle = Q === '?' ? '#ffd166' : '#fff'; x.strokeStyle = '#3a2a10'; x.lineWidth = 3; x.strokeText(Q, sx, sy - 54 + Math.sin(G.t * 4) * 2); x.fillText(Q, sx, sy - 54 + Math.sin(G.t * 4) * 2); } }
    else if (k === 3) drawDrop(o);
    else if (k === 4) drawHero(o);
    else if (k === 5) { const [sx, sy] = iso(o.x, o.y); drawVane(sx, sy, o.on); }
  }
  // 투사체·효과
  for (const p of G.proj) drawProj(p); for (const f of G.fx) drawFx(f);
  for (const a of G.areas) if (a.k === 'flag') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax, ay - 46); x.stroke(); x.fillStyle = a.fk === 0 ? '#9fe4ff' : '#b6f0a0'; x.beginPath(); x.moveTo(ax, ay - 46); x.quadraticCurveTo(ax + 14, ay - 46 + Math.sin(G.t * 6) * 3, ax + 26, ay - 40); x.lineTo(ax, ay - 32); x.fill(); }
  // 이름표
  x.textAlign = 'center';
  for (const d of G.drops) { if (!vis(d.x, d.y) || d.gold) continue; const [sx, sy] = iso(d.x, d.y), it = d.it; x.font = '600 10px system-ui'; const s = itemName(it), w = x.measureText(s).width + 8; x.fillStyle = 'rgba(20,16,10,.72)'; rr(sx - w / 2, sy - 24, w, 14, 4); x.fill(); x.fillStyle = itemColor(it); x.fillText(s, sx, sy - 13.5); }
  for (const t of G.txt) { const [sx, sy] = iso(t.x, t.y), a = 1 - t.t; x.globalAlpha = a; x.font = (t.big ? '800 17px ' : t.small ? '700 10px ' : '800 13px ') + 'system-ui'; x.lineWidth = 3; x.strokeStyle = 'rgba(30,20,10,.8)'; const yy = sy - 40 - t.z * 10 - t.t * 26; x.strokeText(t.s, sx, yy); x.fillStyle = t.c; x.fillText(t.s, sx, yy); x.globalAlpha = 1; }
  x.setTransform(dpr, 0, 0, dpr, 0, 0); hud();
}
function rr(X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function shadow(sx, sy, r) { x.fillStyle = 'rgba(30,40,20,.28)'; x.beginPath(); x.ellipse(sx, sy, r, r * .5, 0, 0, TAU); x.fill(); }
function drawVane(sx, sy, on) { // 바람개비 표지: 나무 기둥 + 네 날개
  x.strokeStyle = '#6a4a2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx, sy - 52); x.stroke(); x.strokeStyle = '#8a6a3a'; x.lineWidth = 2; x.stroke();
  const a0 = on ? G.t * 4 : .3; for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2; x.fillStyle = i % 2 ? '#f6f0e0' : (on ? '#6fc8f0' : '#c8c0b0'); x.beginPath(); x.moveTo(sx, sy - 52); x.quadraticCurveTo(sx + Math.cos(a) * 14 - Math.sin(a) * 6, sy - 52 + Math.sin(a) * 9 + Math.cos(a) * 3, sx + Math.cos(a + .5) * 18, sy - 52 + Math.sin(a + .5) * 11); x.closePath(); x.fill(); x.strokeStyle = 'rgba(40,30,20,.5)'; x.lineWidth = 1; x.stroke(); }
  x.fillStyle = '#c8a24a'; x.beginPath(); x.arc(sx, sy - 52, 3, 0, TAU); x.fill();
}
function drawHero(P) {
  const [sx, sy] = iso(P.x, P.y); shadow(sx, sy, 13);
  if (P.buf.cloud) { x.fillStyle = 'rgba(240,248,255,.35)'; x.beginPath(); x.ellipse(sx, sy - 20, 22, 28, 0, 0, TAU); x.fill(); }
  if (P.buf.hold) { x.strokeStyle = 'rgba(255,210,120,.7)'; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy, 18, 9, 0, 0, TAU); x.stroke(); }
  const a = P.dodge > 0 ? .75 : P.inv0 > 0 ? .6 + Math.sin(G.t * 30) * .3 : 1;
  sprite(IM[P.cls], HC[0], HC[1], HC[2], HC[3], heroFrame(P), P.dir, sx, sy, .5, P.hurt > .15 ? .1 : 0, a);
}
function drawMob(m) {
  const D = m.D, c = MC[D.spr], [sx, sy0] = iso(m.x, m.y), sy = sy0 + (m.fy || 0) * 30;
  const a = m.dead ? Math.max(0, 1 - Math.max(0, m.at - .5) * 1.6) * (m.fl ? Math.max(0, 1 - m.fy * .4) : 1) : 1;
  if (!m.fl) shadow(sx, sy0, D.boss ? 36 : D.fly ? 9 : 11);
  if (m.elite && !m.dead) { x.strokeStyle = m.E[1]; x.globalAlpha = .7; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy0, 16, 8, 0, 0, TAU); x.stroke(); x.globalAlpha = 1; }
  sprite(IM[D.spr], c[0], c[1], c[2], c[3], mobFrame(m), m.dir, sx, sy, .5 * (m.fl ? Math.max(.2, 1 - m.fy * .25) : 1), m.flash, a);
  if (!m.dead && (m.hp < m.mhp || m.elite) && !D.boss) { const w = 26, f = m.hp / m.mhp, top = sy - c[3] * .5 - 2; x.fillStyle = 'rgba(20,14,10,.7)'; x.fillRect(sx - w / 2 - 1, top - 1, w + 2, 5); x.fillStyle = m.elite ? m.E[1] : '#e85a4a'; x.fillRect(sx - w / 2, top, w * f, 3);
    if (m.elite) { x.font = '700 9px system-ui'; x.textAlign = 'center'; x.fillStyle = m.E[1]; x.strokeStyle = 'rgba(20,14,10,.8)'; x.lineWidth = 2.5; const s = m.E[0] + ' ' + D.n; x.strokeText(s, sx, top - 4); x.fillText(s, sx, top - 4); } }
  if (m.stun > 0 && !m.dead) { x.fillStyle = '#ffe08a'; for (let i = 0; i < 3; i++) { const a2 = G.t * 5 + i * TAU / 3; x.beginPath(); x.arc(sx + Math.cos(a2) * 9, sy - c[3] * .42 + Math.sin(a2) * 3, 2, 0, TAU); x.fill(); } }
}
function drawDrop(d) {
  const [sx, sy] = iso(d.x, d.y), b = Math.max(0, .35 - d.t) * 60;
  if (d.gold) { x.fillStyle = '#ffd166'; x.strokeStyle = '#8a6a1a'; x.lineWidth = 1; for (let i = 0; i < Math.min(4, 1 + d.gold / 10); i++) { x.beginPath(); x.ellipse(sx - 4 + i * 3, sy - 3 - b - i * 1.5, 4, 2.4, 0, 0, TAU); x.fill(); x.stroke(); } return; }
  const it = d.it, col = itemColor(it); x.fillStyle = col; x.globalAlpha = .25 + Math.sin(G.t * 4) * .1; x.beginPath(); x.ellipse(sx, sy, 12, 6, 0, 0, TAU); x.fill(); x.globalAlpha = 1;
  drawIcon(it, sx - 11, sy - 18 - b, 22);
}
function drawIcon(it, X, Y, s, g) { g = g || x; const k = it.g ? GOODS[it.g].ic : BASE[it.b].ic, m = ICM[k];
  if (m && IM.icons) { g.drawImage(IM.icons, m[0], m[1], m[2], m[3], X, Y, s, s); return; }
  g.fillStyle = itemColor(it); g.beginPath(); g.arc(X + s / 2, Y + s / 2, s * .32, 0, TAU); g.fill(); }
function drawProj(p) {
  const [sx, sy] = iso(p.x, p.y), Y = sy - 22;
  if (p.k === 'wind') { x.strokeStyle = 'rgba(230,248,255,.9)'; x.lineWidth = 2.2; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(sx, Y, 4 + i * 3, G.t * 12 + i, G.t * 12 + i + 2.2); x.stroke(); } }
  else if (p.k === 'bolt') { const [ex, ey] = iso(p.x - p.vx * .04, p.y - p.vy * .04); x.strokeStyle = '#fff6b0'; x.lineWidth = 3; x.shadowColor = '#ffe066'; x.shadowBlur = 10; x.beginPath(); x.moveTo(ex, ey - 22); x.lineTo(sx, Y); x.stroke(); x.shadowBlur = 0; }
  else if (p.k === 'twister') { for (let i = 0; i < 7; i++) { const r = 6 + i * 3.2, yy = sy - i * 7; x.strokeStyle = `rgba(225,242,252,${.85 - i * .08})`; x.lineWidth = 2.4; x.beginPath(); x.ellipse(sx + Math.sin(G.t * 9 + i) * 3, yy, r, r * .38, 0, G.t * 14 + i, G.t * 14 + i + 4.4); x.stroke(); } }
}
function drawFx(f) {
  if (f.t < 0) return; const k = f.t / f.life, [sx, sy] = iso(f.x, f.y);
  if (f.k === 'ring') { x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 3; x.beginPath(); x.ellipse(sx, sy, f.r * TW / 2 * 1.41 * (.4 + k * .6), f.r * TH / 2 * 1.41 * (.4 + k * .6), 0, 0, TAU); x.stroke(); x.globalAlpha = 1; }
  else if (f.k === 'thrust') { const [ex, ey] = iso(f.x + f.dx * f.len, f.y + f.dy * f.len); x.strokeStyle = `rgba(255,250,235,${1 - k})`; x.lineWidth = 4 * (1 - k) + 1; x.beginPath(); x.moveTo(sx, sy - 20); x.lineTo(ex, ey - 20); x.stroke(); }
  else if (f.k === 'gust' || f.k === 'bash') { const a0 = Math.atan2(...(() => { const [ax, ay] = iso(f.dx, f.dy); return [ay, ax]; })()); x.strokeStyle = f.k === 'gust' ? `rgba(230,246,255,${.9 - k})` : `rgba(255,220,150,${.9 - k})`; x.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { const a = a0 + (i / 5 - .5) * f.arc, r = f.r * 32 * (.4 + k * .7); x.beginPath(); x.ellipse(sx, sy - 14, r, r * .5, 0, a - .15, a + .15); x.stroke(); } }
  else if (f.k === 'zap') { const [ex, ey] = iso(f.x2, f.y2); x.strokeStyle = `rgba(255,246,170,${1 - k})`; x.lineWidth = 2.5; x.shadowColor = '#ffe066'; x.shadowBlur = 8; x.beginPath(); x.moveTo(sx, sy - 22); for (let i = 1; i < 6; i++) { const t = i / 6; x.lineTo(lerp(sx, ex, t) + rnd(-6, 6), lerp(sy, ey, t) - 22 + rnd(-6, 6)); } x.lineTo(ex, ey - 22); x.stroke(); x.shadowBlur = 0; }
  else if (f.k === 'pop') { x.fillStyle = f.c; x.globalAlpha = 1 - k; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.beginPath(); x.arc(sx + Math.cos(a) * k * 14, sy - 20 + Math.sin(a) * k * 9, 2.4 * (1 - k) + .5, 0, TAU); x.fill(); } x.globalAlpha = 1; }
  else if (f.k === 'aura') { x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy - k * 30 - i * 8, 16 - i * 3, 7 - i, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  else if (f.k === 'lvl') { x.strokeStyle = '#ffd166'; x.globalAlpha = 1 - k; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy - k * 50 - i * 12, 20 + i * 4, 9 + i * 2, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  else if (f.k === 'sail') { x.fillStyle = `rgba(240,248,255,${.5 * (1 - k)})`; x.beginPath(); x.ellipse(sx, sy - 18, 16 + k * 10, 8, 0, 0, TAU); x.fill(); }
}
function questMark(k) { const P = G.P; for (const id in QUESTS) { const Q = QUESTS[id]; if (Q.from !== k) continue; const q = P.q[id]; if (q && q.s === 2) return '?'; if (!q && qAvail(id)) return '!'; } return ''; }
function qAvail(id) { const q = G.P.q; if (id === 'q1') return true; if (id === 'q2') return true; if (id === 'q4') return true; if (id === 'q3') return q.q1 && q.q1.s === 3; return false; }

/* ---------- 화면 위 정보(HUD) ---------- */
let BTN = [];
function hud() {
  if (G.noHud) return;
  const { cw, ch } = lay, P = G.P, touch = TOUCH.on; BTN = [];
  const s = clamp(Math.min(cw, ch * 1.8) / 900, .8, 1.25);
  // 왼쪽 위: 이름·레벨·생명·바람
  const bx = 10 + SAFE_L(), by = 10, bw = 170 * s;
  x.fillStyle = 'rgba(30,24,18,.55)'; rr(bx, by, bw + 16, 64 * s, 10); x.fill();
  x.font = `800 ${12 * s}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText(CLASSES[P.cls].name + ' · ' + P.lv + '레벨', bx + 8, by + 15 * s);
  x.font = `600 ${10 * s}px system-ui`; x.fillStyle = '#ffd166'; x.textAlign = 'right'; x.fillText(P.gold.toLocaleString() + 'G', bx + bw + 8, by + 15 * s);
  bar(bx + 8, by + 22 * s, bw, 12 * s, P.hp / P.mhp, '#e8604e', '#ff9a7a', Math.ceil(P.hp) + ' / ' + P.mhp, s);
  bar(bx + 8, by + 38 * s, bw, 10 * s, P.wind / P.mwind, '#4aa8d8', '#9fe4ff', Math.floor(P.wind) + ' / ' + P.mwind, s);
  const xf = P.xp / xpNeed(P.lv); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(bx + 8, by + 52 * s, bw, 4); x.fillStyle = '#b6f0a0'; x.fillRect(bx + 8, by + 52 * s, bw * xf, 4);
  if (P.rested > 1) { x.fillStyle = 'rgba(159,228,255,.6)'; x.fillRect(bx + 8 + bw * xf, by + 52 * s, Math.min(bw * (1 - xf), bw * P.rested / xpNeed(P.lv)), 4); x.font = `600 ${8.5 * s}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#9fe4ff'; x.fillText('순풍 ×2', bx + 8, by + 64 * s); }
  if (P.pts || P.skp) { x.font = `700 ${9.5 * s}px system-ui`; x.textAlign = 'right'; x.fillStyle = '#ffd166'; x.fillText((P.pts ? '스탯 ' + P.pts + ' ' : '') + (P.skp ? '스킬 ' + P.skp : ''), bx + bw + 8, by + 64 * s); }
  // 보스 체력
  const boss = G.mobs.find(m => m.D.boss && !m.dead && m.st !== 'idle'); if (boss) { const w = Math.min(420, cw * .36); x.fillStyle = 'rgba(30,24,18,.7)'; rr(cw / 2 - w / 2 - 6, 8, w + 12, 30, 8); x.fill(); x.font = '800 12px system-ui'; x.textAlign = 'center'; x.fillStyle = '#ffe4c8'; x.fillText(boss.D.n, cw / 2, 21); x.fillStyle = '#3a2a20'; x.fillRect(cw / 2 - w / 2, 26, w, 7); x.fillStyle = '#e8604e'; x.fillRect(cw / 2 - w / 2, 26, w * boss.hp / boss.mhp, 7); }
  // 메시지
  x.textAlign = 'center'; G.msg.forEach((m, i) => { const a = Math.min(1, 4.5 - m.t); x.globalAlpha = a; x.font = `700 ${12.5 * s}px system-ui`; const w = x.measureText(m.s).width + 20, yy = (boss ? 48 : 14) + i * 24 * s; x.fillStyle = 'rgba(30,24,18,.62)'; rr(cw / 2 - w / 2, yy, w, 20 * s, 8); x.fill(); x.fillStyle = m.c; x.fillText(m.s, cw / 2, yy + 14 * s); x.globalAlpha = 1; });
  minimap(cw - 10 - SAFE_R(), 10, s);
  // 퀘스트 알림
  questTracker(cw - 10 - SAFE_R(), 10 + 112 * s + 8, s);
  // 아래: 스킬·물약·피하기·메뉴
  const bsz = (touch ? 50 : 42) * s, gap = 6 * s;
  if (touch) {
    const A0 = bsz * 1.5, cx = cw - SAFE_R() - 14 - A0 / 2, cy = ch - 12 - A0 / 2, rho = A0 / 2 + bsz * .78;
    btn('atk', cx - A0 / 2, cy - A0 / 2, A0, '', '공격');
    [180, 215, 250, 285].forEach((deg, i) => { const a = deg * Math.PI / 180; skillBtn(i, P.slots[i], cx + Math.cos(a) * rho - bsz / 2, cy + Math.sin(a) * rho - bsz / 2, bsz); });
    const sm = bsz * .82, lx = cx - rho - bsz * .5 - sm - 10;
    btn('dodge', lx, ch - 12 - sm, sm, '', '돛'); btn('pot', lx - sm - 8, ch - 12 - sm, sm, '', '차 ' + count('pot')); btn('wpot', lx - (sm + 8) * 2, ch - 12 - sm, sm, '', '사탕 ' + count('wpot'));
    // 왼쪽 막대(가상 패드)
    if (TOUCH.pad) { const p = TOUCH.pad; x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(p.x0, p.y0, 46, 0, TAU); x.stroke(); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(p.x0 + p.dx * 40, p.y0 + p.dy * 40, 20, 0, TAU); x.fill(); }
  } else {
    const n = 4, tw = n * bsz + (n - 1) * gap, X0 = cw / 2 - tw / 2 - bsz, Y0 = ch - bsz - 12;
    P.slots.forEach((id, i) => skillBtn(i, id, X0 + bsz + i * (bsz + gap), Y0, bsz, String(i + 1)));
    btn('pot', X0 - gap - bsz * .2, Y0, bsz, 'Q', '차 ' + count('pot')); btn('wpot', X0 + bsz + tw + gap, Y0, bsz, 'R', '사탕 ' + count('wpot')); btn('dodge', X0 + bsz * 2 + tw + gap * 2, Y0, bsz, '␣', '돛');
  }
  // 메뉴 버튼(위 가운데 오른쪽)
  const mb = 30 * s, my = 8, mx = cw - SAFE_R() - 10 - 112 * s - 8 - (mb + 4) * 4;
  [['inv', '가방', 'I'], ['char', '능력', 'C'], ['skill', '스킬', 'K'], ['menu', '≡', '']].forEach(([k, l, key], i) => { const X = mx + i * (mb + 4); x.fillStyle = 'rgba(30,24,18,.6)'; rr(X, my, mb, mb, 7); x.fill(); x.fillStyle = (k === 'char' && P.pts) || (k === 'skill' && P.skp) ? '#ffd166' : '#fff'; x.font = `700 ${(l.length > 1 ? 10 : 15) * s}px system-ui`; x.textAlign = 'center'; x.fillText(l, X + mb / 2, my + mb / 2 + 4 * s); BTN.push({ k, x: X, y: my, w: mb, h: mb }); });
  // 상호작용
  if (G.near) { x.font = `800 ${12.5 * s}px system-ui`; const t = (touch ? '' : 'F  ') + G.near.label, w = x.measureText(t).width + 26, X = cw / 2 - w / 2, Y = ch - (touch ? 70 : 110) * s; x.fillStyle = 'rgba(255,240,200,.92)'; rr(X, Y, w, 28 * s, 14); x.fill(); x.fillStyle = '#3a2a10'; x.textAlign = 'center'; x.fillText(t, cw / 2, Y + 18.5 * s); BTN.push({ k: 'use', x: X, y: Y, w, h: 28 * s }); }
}
const SAFE_L = () => 0, SAFE_R = () => 0;
function bar(X, Y, w, h, f, c1, c2, label, s) { x.fillStyle = 'rgba(0,0,0,.4)'; rr(X, Y, w, h, h / 2); x.fill(); const g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, c2); g.addColorStop(1, c1); x.fillStyle = g; if (f > 0) { rr(X, Y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); x.fill(); } x.font = `700 ${h * .78}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(label, X + w / 2, Y + h * .8); }
function btn(k, X, Y, sz, key, label) { x.fillStyle = 'rgba(30,24,18,.55)'; x.beginPath(); x.arc(X + sz / 2, Y + sz / 2, sz / 2, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,240,210,.5)'; x.lineWidth = 1.5; x.stroke();
  const P = G.P; if (k === 'dodge' && P.dcd > 0) { x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.moveTo(X + sz / 2, Y + sz / 2); x.arc(X + sz / 2, Y + sz / 2, sz / 2, -Math.PI / 2, -Math.PI / 2 + TAU * P.dcd / P.sail[1]); x.fill(); }
  if (k === 'atk') { const ic = CLASSES[P.cls].melee ? 'spear' : 'staff'; if (ICM[ic]) x.drawImage(IM.icons, ...ICM[ic], X + sz * .2, Y + sz * .2, sz * .6, sz * .6); }
  if (k === 'pot' || k === 'wpot') { const m = ICM[k]; if (m) x.drawImage(IM.icons, ...m, X + sz * .22, Y + sz * .12, sz * .56, sz * .56); }
  if (k === 'dodge') { const m = ICM.sail; if (m) x.drawImage(IM.icons, ...m, X + sz * .22, Y + sz * .12, sz * .56, sz * .56); }
  x.font = `700 ${Math.max(9, sz * .2)}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 2.5; if (label) { x.strokeText(label, X + sz / 2, Y + sz * .9); x.fillText(label, X + sz / 2, Y + sz * .9); }
  if (key) { x.fillStyle = '#ffd166'; x.fillText(key, X + sz * .18, Y + sz * .26); }
  BTN.push({ k, x: X, y: Y, w: sz, h: sz });
}
const SKC = { pierce: '#ffe9c0', sweep: '#ffd59a', bash: '#ffd27a', hold: '#f2c26a', shout: '#ffb48a', flag: '#b6f0a0', gust: '#dff4ff', twister: '#c8ecff', bolt: '#fff3a0', chain: '#ffe066', cloud: '#f4f8ff', mist: '#d8e6f0' };
function skillBtn(i, id, X, Y, sz, key) {
  const P = G.P; x.fillStyle = 'rgba(30,24,18,.6)'; rr(X, Y, sz, sz, sz * .22); x.fill(); x.strokeStyle = 'rgba(255,240,210,.45)'; x.lineWidth = 1.5; x.stroke();
  if (id) { const s = SKILLS[P.cls].find(q => q.id === id); drawSkillIcon(x, s, X, Y, sz, P.cls); const cd = P.cds[id] || 0; if (cd > 0) { x.fillStyle = 'rgba(0,0,0,.55)'; rr(X, Y + sz * (1 - cd / s.cd), sz, sz * cd / s.cd, sz * .2); x.fill(); } if (P.wind < s.cost) { x.fillStyle = 'rgba(20,60,120,.4)'; rr(X, Y, sz, sz, sz * .22); x.fill(); } }
  if (key) { x.font = `700 ${sz * .24}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#ffd166'; x.fillText(key, X + 4, Y + sz * .28); }
  BTN.push({ k: 's' + i, x: X, y: Y, w: sz, h: sz });
}
// 스킬 그림: 갈래 색 바탕 + 동작 그림(코드)
function drawSkillIcon(g, s, X, Y, sz, cls) {
  const col = [['#3a6a8a', '#7aa0b8'], ['#8a6a3a', '#c8a26a'], ['#6a4a7a', '#a88ac0']][s.br], gr = g.createLinearGradient(X, Y, X + sz, Y + sz); gr.addColorStop(0, col[1]); gr.addColorStop(1, col[0]);
  g.save(); g.beginPath(); rrp(g, X + 3, Y + 3, sz - 6, sz - 6, sz * .18); g.fillStyle = gr; g.fill(); g.clip(); const c = SKC[s.id] || '#fff', cx = X + sz / 2, cy = Y + sz / 2, r = sz * .3;
  g.strokeStyle = c; g.fillStyle = c; g.lineWidth = sz * .07; g.lineCap = 'round';
  const L = (a, b, c2, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); };
  switch (s.id) {
    case 'pierce': L(cx - r, cy + r, cx + r, cy - r); g.beginPath(); g.moveTo(cx + r * 1.2, cy - r * 1.2); g.lineTo(cx + r * .55, cy - r * .9); g.lineTo(cx + r * .9, cy - r * .55); g.fill(); L(cx - r * .9, cy - r * .1, cx + r * .1, cy - r * 1.1); break;
    case 'sweep': g.beginPath(); g.arc(cx, cy, r, .3, TAU - .6); g.stroke(); g.beginPath(); g.moveTo(cx + r * .9, cy - r * .7); g.lineTo(cx + r * 1.2, cy - r * .1); g.lineTo(cx + r * .5, cy - r * .3); g.fill(); break;
    case 'bash': g.beginPath(); g.arc(cx - r * .2, cy, r * .8, 0, TAU); g.fill(); g.fillStyle = col[0]; g.beginPath(); g.arc(cx - r * .2, cy, r * .3, 0, TAU); g.fill(); g.strokeStyle = c; for (let i = 0; i < 3; i++) L(cx + r * .8, cy - r * .6 + i * r * .6, cx + r * 1.3, cy - r * .7 + i * r * .7); break;
    case 'hold': g.beginPath(); g.moveTo(cx, cy - r * 1.1); g.lineTo(cx + r, cy - r * .5); g.quadraticCurveTo(cx + r, cy + r * .6, cx, cy + r * 1.1); g.quadraticCurveTo(cx - r, cy + r * .6, cx - r, cy - r * .5); g.closePath(); g.fill(); break;
    case 'shout': for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx - r * .6, cy, r * (.5 + i * .4), -.7, .7); g.stroke(); } break;
    case 'flag': L(cx - r * .5, cy + r * 1.1, cx - r * .5, cy - r * 1.1); g.beginPath(); g.moveTo(cx - r * .5, cy - r * 1.1); g.quadraticCurveTo(cx + r * .3, cy - r * 1.3, cx + r, cy - r * .7); g.lineTo(cx - r * .5, cy - r * .2); g.fill(); break;
    case 'gust': for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - r, cy - r * .6 + i * r * .6); g.quadraticCurveTo(cx + r * .4, cy - r * .9 + i * r * .6, cx + r, cy - r * .4 + i * r * .55); g.stroke(); } break;
    case 'twister': for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(cx + (i % 2 ? 2 : -2), cy - r + i * r * .6, r * (1 - i * .2), r * .28, 0, 0, TAU); g.stroke(); } break;
    case 'bolt': case 'chain': g.beginPath(); g.moveTo(cx + r * .3, cy - r * 1.2); g.lineTo(cx - r * .6, cy + r * .1); g.lineTo(cx, cy + r * .1); g.lineTo(cx - r * .3, cy + r * 1.2); g.lineTo(cx + r * .7, cy - r * .2); g.lineTo(cx + r * .1, cy - r * .2); g.closePath(); g.fill(); if (s.id === 'chain') { g.beginPath(); g.arc(cx + r * .9, cy + r * .8, r * .25, 0, TAU); g.arc(cx - r * .9, cy - r * .8, r * .25, 0, TAU); g.fill(); } break;
    case 'cloud': case 'mist': g.beginPath(); g.arc(cx - r * .45, cy + r * .1, r * .45, 0, TAU); g.arc(cx + r * .1, cy - r * .2, r * .58, 0, TAU); g.arc(cx + r * .6, cy + r * .2, r * .4, 0, TAU); g.fill(); if (s.id === 'mist') { g.globalAlpha = .6; g.fillRect(cx - r * 1.1, cy + r * .6, r * 2.2, r * .2); g.globalAlpha = 1; } break;
  }
  g.restore();
}
function rrp(g, X, Y, w, h, r) { g.moveTo(X + r, Y); g.arcTo(X + w, Y, X + w, Y + h, r); g.arcTo(X + w, Y + h, X, Y + h, r); g.arcTo(X, Y + h, X, Y, r); g.arcTo(X, Y, X + w, Y, r); g.closePath(); }
let MINI = null;
function minimap(R, T, s) {
  const Wd = G.Wd, w = 112 * s, h = 112 * s, X = R - w;
  if (!MINI || MINI.v !== (Wd.bridges[Wd.bq].broken ? 0 : 1)) { const c = document.createElement('canvas'); c.width = Wd.W * 2; c.height = Wd.H * 2; const g = c.getContext('2d');
    for (let y = 0; y < Wd.H; y++) for (let xx = 0; xx < Wd.W; xx++) { const t = Wd.g[Wd.id(xx, y)]; if (!t) continue; g.fillStyle = t === 3 ? '#c8a070' : t === 4 ? '#8a6a50' : t === 5 ? '#d8d0c0' : t === 2 ? '#d8c08a' : Wd.block[Wd.id(xx, y)] ? '#5a8a4a' : '#9ccc7a'; g.fillRect(xx * 2, y * 2, 2, 2); }
    MINI = { c, v: Wd.bridges[Wd.bq].broken ? 0 : 1 }; }
  x.save(); x.fillStyle = 'rgba(30,24,18,.55)'; rr(X, T, w, h, 10); x.fill(); x.beginPath(); rr(X + 3, T + 3, w - 6, h - 6, 8); x.clip();
  const sc = 1.6 * s, P = G.P; x.translate(X + w / 2, T + h / 2); x.rotate(Math.PI / 4); x.scale(sc * .72, sc * .72 * .5 / .5); x.scale(1, 1);
  x.translate(-P.x * 2, -P.y * 2); x.drawImage(MINI.c, 0, 0);
  for (const m of G.mobs) if (!m.dead) { x.fillStyle = m.D.boss ? '#ff4a3a' : m.elite ? m.E[1] : '#e85a4a'; x.fillRect(m.x * 2 - 1.5, m.y * 2 - 1.5, 3, 3); }
  for (const k in Wd.npcAt) { x.fillStyle = '#ffd166'; x.fillRect(Wd.npcAt[k][0] * 2 - 1.5, Wd.npcAt[k][1] * 2 - 1.5, 3, 3); }
  for (const wp of Wd.wps) { x.fillStyle = wp.on ? '#9fe4ff' : '#888'; x.beginPath(); x.arc(wp.x * 2, wp.y * 2, 2.6, 0, TAU); x.fill(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(P.x * 2, P.y * 2, 3, 0, TAU); x.fill(); x.restore();
}
function questTracker(R, T, s) {
  const P = G.P, L = []; for (const id in QUESTS) { const q = P.q[id]; if (!q || q.s === 3) continue; const Q = QUESTS[id]; let t = Q.goal; if (q.s === 2) t = NPCDEF[Q.from].n + '에게 돌아가기'; else if (id === 'q1') t = '다리 널빤지 ' + Math.min(6, count('plank')) + '/6 → 동쪽 끊긴 다리'; else if (id === 'q2') t = '보풀이 ' + q.n + '/15'; else if (id === 'q4') t = '바람 숫돌 ' + Math.min(3, count('hone')) + '/3'; L.push([Q.n, t]); }
  if (!L.length) return; x.textAlign = 'right'; let y = T;
  for (const [n, t] of L) { x.font = `800 ${10.5 * s}px system-ui`; x.fillStyle = '#ffd166'; x.strokeStyle = 'rgba(30,24,18,.8)'; x.lineWidth = 3; x.strokeText(n, R, y + 10 * s); x.fillText(n, R, y + 10 * s); x.font = `600 ${9.5 * s}px system-ui`; x.fillStyle = '#fff'; x.strokeText(t, R, y + 23 * s); x.fillText(t, R, y + 23 * s); y += 30 * s; }
}
