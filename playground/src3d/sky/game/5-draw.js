
/* =================== 그리기 =================== */
let ov, cv, x, lay = { Z: 1, dpr: 1, cw: 800, ch: 450 }, IM = {}, NPCK = [];
const HC = [112, 120, 56, 100], HF = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'atk0', 'atk1', 'atk2', 'atk3', 'cast0', 'cast1', 'cast2', 'hurt', 'dodge', 'die0', 'die1'];
const MC = { fluff: [96, 96, 48, 84], fluffking: [240, 260, 120, 236], seed: [96, 104, 48, 92], bird: [104, 132, 52, 120], keeper: [196, 212, 98, 192] };
function loadImg(k, src) { return new Promise(ok => { const im = new Image(); im.onload = () => { IM[k] = im; LOADP.n++; ok(); }; im.onerror = () => { LOADP.n++; ok(); }; im.src = src; }); }
// 폰 로딩: 처음엔 꼭 필요한 그림만(약 1.4MB) 받고, 큰 보스 그림(둥지지기·우두머리)은 시작한 뒤 뒤에서 받는다
const LOADP = { n: 0, N: 10 }, LATE = ['keeper', 'fluffking'];
let assetsP = null;
function assets() {
  if (assetsP) return assetsP; const v = '?v=__ASSETV__';
  const J = p => p.then(() => { LOADP.n++; });
  assetsP = Promise.all([...['heads', 'fluff', 'seed', 'bird', 'npc', 'props', 'icons'].map(k => loadImg(k, IMG + k + '.webp' + v)),
    J(fetch(IMG + 'props.json' + v).then(r => r.json()).then(j => { PM = j; })), J(fetch(IMG + 'npc.json' + v).then(r => r.json()).then(j => { NPCK = j; })), J(fetch(IMG + 'icons.json' + v).then(r => r.json()).then(j => { ICM = j; }).catch(() => {}))])
    .then(() => { LATE.reduce((p, k) => p.then(() => loadImg(k, IMG + k + '.webp' + v)), Promise.resolve()); });
  return assetsP;
}
// 영웅 그림은 고른 직업 것만 받는다(직업 5개 → 처음 화면은 얼굴 한 장)
const HEROP = {};
function loadHero(cls) { return HEROP[cls] || (HEROP[cls] = IM[cls] ? Promise.resolve() : new Promise(ok => { const im = new Image(); im.onload = () => { IM[cls] = im; ok(); }; im.onerror = () => { delete HEROP[cls]; ok(); }; im.src = IMG + cls + '.webp?v=__ASSETV__'; })); }
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
  if (!G) { if (LOADP.n < LOADP.N) { const w = Math.min(320, cw * .6), k = LOADP.n / LOADP.N; x.fillStyle = 'rgba(30,40,60,.35)'; rr(cw / 2 - w / 2, ch / 2 + 10, w, 10, 5); x.fill(); x.fillStyle = '#fff'; rr(cw / 2 - w / 2, ch / 2 + 10, Math.max(10, w * k), 10, 5); x.fill();
      x.font = '800 22px system-ui'; x.textAlign = 'center'; x.fillStyle = '#3a5a7a'; x.fillText('끊어진 하늘', cw / 2, ch / 2 - 14); x.font = '600 12px system-ui'; x.fillStyle = '#5a6a80'; x.fillText('섬을 띄우는 중… ' + Math.round(k * 100) + '%', cw / 2, ch / 2 + 40); }
    return; }
  const Wd = G.Wd, P = G.P, V = view(), Z = V.Z;
  x.setTransform(dpr * Z, 0, 0, dpr * Z, dpr * V.ox, dpr * V.oy);
  // 화면에 보이는 칸 범위
  const corners = [[0, 0], [cw, 0], [0, ch + 200], [cw, ch + 200]].map(([sx, sy]) => unIso((sx - V.ox) / Z, (sy - V.oy) / Z));
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 1), x1 = Math.min(Wd.W - 1, Math.ceil(Math.max(...corners.map(c => c[0]))) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 1), y1 = Math.min(Wd.H - 1, Math.ceil(Math.max(...corners.map(c => c[1]))) + 1);
  // 섬: 뒤(위쪽) 섬부터 → 낭떠러지·윗면·풀 테두리, 그다음 다리
  const T = TILES, vr = [-V.ox / Z - 40, -V.oy / Z - 40, (cw - V.ox) / Z + 40, (ch - V.oy) / Z + 40];
  const order = Wd.order || (Wd.order = Wd.islands.slice().sort((p, q) => (p.cx + p.cy) - (q.cx + q.cy)));
  for (const s of order) { const g = islandGeo(Wd, s); if (g.maxx < vr[0] || g.minx > vr[2] || g.maxy < vr[1] || g.miny > vr[3]) continue; drawIsland(Wd, s, g, T); }
  for (const b of Wd.bridges) for (const i of b.all || (b.all = b.ends.concat(b.cells))) { const xx = i % Wd.W, yy = (i / Wd.W) | 0; if (xx < x0 || xx > x1 || yy < y0 || yy > y1) continue;
    const bm = (X, Y) => Wd.inb(X, Y) && Wd.bm[Wd.id(X, Y)], vert = (bm(xx, yy - 1) || bm(xx, yy + 1)) && !(bm(xx - 1, yy) || bm(xx + 1, yy)); const [sx, sy] = iso(xx, yy);
    x.drawImage((Wd.g[i] === 4 ? T.broken : T.bridge)[vert ? 1 : 0], sx - TW / 2, sy, TW, TH + 12); }
  drawBlight(Wd);
  // 바닥 효과(안개·깃발 범위·경고)
  for (const a of G.areas) {
    if (a.k === 'mist') { const [ax, ay] = iso(a.x, a.y), al = Math.min(1, a.t * 3, (a.life - a.t) * 2); x.fillStyle = `rgba(235,242,250,${.45 * al})`; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(ax + Math.sin(G.t + k) * 10, ay + Math.cos(G.t * .7 + k) * 5, a.r * TW / 2 * (.7 + k * .08), a.r * TH / 2 * (.7 + k * .08), 0, 0, TAU); x.fill(); } }
    if (a.k === 'flag') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = 'rgba(160,220,255,.6)'; x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41, a.r * TH / 2 * 1.41, 0, 0, TAU); x.stroke(); x.setLineDash([]); }
    if (a.k === 'warn') { const [ax, ay] = iso(a.x, a.y), k = a.t / a.life; x.fillStyle = `rgba(255,90,70,${.15 + k * .25})`; x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41 * k, a.r * TH / 2 * 1.41 * k, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,120,90,.8)'; x.lineWidth = 2; x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41, a.r * TH / 2 * 1.41, 0, 0, TAU); x.stroke(); }
  }
  drawClsGround();
  for (const f of G.fx) if (f.k === 'crack') { const [ax, ay] = iso(f.x, f.y), al = Math.min(1, (f.life - f.t) * 1.5); x.strokeStyle = `rgba(70,46,24,${.7 * al})`; x.lineWidth = 2.2; x.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + .3, l = 30 + hsh(i, 4) * 40; x.moveTo(ax, ay); x.lineTo(ax + Math.cos(a) * l * .5, ay + Math.sin(a) * l * .25 + 3); x.lineTo(ax + Math.cos(a + .2) * l, ay + Math.sin(a + .2) * l * .5); } x.stroke(); x.fillStyle = `rgba(60,40,20,${.35 * al})`; x.beginPath(); x.ellipse(ax, ay, 26, 13, 0, 0, TAU); x.fill(); }
  for (const w of Wd.wps) { const [ax, ay] = iso(w.x, w.y); x.fillStyle = w.on ? 'rgba(160,230,255,.35)' : 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(ax, ay, 26, 13, 0, 0, TAU); x.fill(); x.strokeStyle = w.on ? '#9fe4ff' : '#d8d2c4'; x.lineWidth = 2; x.beginPath(); x.ellipse(ax, ay, 26 + (w.on ? Math.sin(G.t * 3) * 2 : 0), 13, 0, 0, TAU); x.stroke(); }
  // 정렬해서 그리기
  const L = [], vis = (ex, ey) => ex >= x0 - 3 && ex <= x1 + 3 && ey >= y0 - 3 && ey <= y1 + 3;
  for (const p of Wd.props) if (vis(p.x, p.y)) L.push([p.x + p.y, 0, p]);
  for (const m of G.mobs) if (vis(m.x, m.y)) L.push([m.x + m.y, 1, m]);
  for (const k in Wd.npcAt) { const [nx, ny] = Wd.npcAt[k]; if (vis(nx, ny)) L.push([nx + ny, 2, k]); }
  for (const d of G.drops) if (vis(d.x, d.y)) L.push([d.x + d.y - .3, 3, d]);
  for (const w of Wd.wps) L.push([w.x + w.y, 5, w]);
  for (const a of G.areas) if (a.k === 'echo' && vis(a.x, a.y)) L.push([a.x + a.y, 6, a]);
  L.push([P.x + P.y, 4, P]); L.sort((a, b) => a[0] - b[0]);
  const hs = .5; // 2배 아틀라스 → 1배
  for (const [, k, o] of L) {
    if (k === 0) { const m = PM[o.k]; if (!m) continue; const [sx, sy] = iso(o.x, o.y); { const r2 = Math.max(8, o.foot * TW * .62); x.fillStyle = 'rgba(28,46,20,.22)'; x.beginPath(); x.ellipse(sx + r2 * .12, sy + 1, r2, r2 * .48, 0, 0, TAU); x.fill(); } const fade = hyp(o.x - P.x, o.y - P.y) < 2.6 && o.x + o.y > P.x + P.y && m[3] > 220 ? .55 : 1; x.globalAlpha = fade; x.drawImage(IM.props, m[0], m[1], m[2], m[3], sx - m[4] * hs, sy - m[5] * hs, m[2] * hs, m[3] * hs); x.globalAlpha = 1; }
    else if (k === 1) drawMob(o);
    else if (k === 2) { const [sx, sy] = iso(G.Wd.npcAt[o][0], G.Wd.npcAt[o][1]); shadow(sx, sy, 12); sprite(IM.npc, HC[0], HC[1], HC[2], HC[3], Math.floor(G.t / .7 + o.length) % 2, NPCK.indexOf(o), sx, sy, hs); const Q = questMark(o); if (Q) { x.font = 'bold 15px system-ui'; x.textAlign = 'center'; x.fillStyle = Q === '?' ? '#ffd166' : '#fff'; x.strokeStyle = '#3a2a10'; x.lineWidth = 3; x.strokeText(Q, sx, sy - 54 + Math.sin(G.t * 4) * 2); x.fillText(Q, sx, sy - 54 + Math.sin(G.t * 4) * 2); } }
    else if (k === 3) drawDrop(o);
    else if (k === 4) drawHero(o);
    else if (k === 5) { const [sx, sy] = iso(o.x, o.y); drawVane(sx, sy, o.on); }
    else if (k === 6) drawEcho(o);
  }
  drawBlightAir();
  // 투사체·효과
  for (const a of G.areas) if (a.k === 'vortex') drawVortex(a);
  for (const p of G.proj) drawProj(p); for (const f of G.fx) drawFx(f); drawParts(); drawClsAir();
  for (const a of G.areas) if (a.k === 'flag') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax, ay - 46); x.stroke(); x.fillStyle = a.fk === 0 ? '#9fe4ff' : '#b6f0a0'; x.beginPath(); x.moveTo(ax, ay - 46); x.quadraticCurveTo(ax + 14, ay - 46 + Math.sin(G.t * 6) * 3, ax + 26, ay - 40); x.lineTo(ax, ay - 32); x.fill(); }
  // 이름표
  x.textAlign = 'center';
  for (const d of G.drops) { if (!vis(d.x, d.y) || d.gold) continue; const [sx, sy] = iso(d.x, d.y), it = d.it; x.font = '600 10px system-ui'; const s = itemName(it), w = x.measureText(s).width + 8; x.fillStyle = 'rgba(20,16,10,.72)'; rr(sx - w / 2, sy - 24, w, 14, 4); x.fill(); x.fillStyle = itemColor(it); x.fillText(s, sx, sy - 13.5); }
  for (const t of G.txt) { const [sx, sy] = iso(t.x, t.y), a = Math.min(1, (1 - t.t) * 2.2), sc = t.pop ? 1 + Math.max(0, .18 - t.t) * (t.big ? 6 : 3.5) : 1; x.globalAlpha = a; x.font = (t.big ? '900 19px ' : t.small ? '700 10px ' : '800 14px ') + 'system-ui'; x.lineWidth = t.big ? 4 : 3; x.strokeStyle = t.big ? 'rgba(90,30,0,.9)' : 'rgba(30,20,10,.8)';
    const yy = sy - 40 - t.z * 10 - (t.pop ? 18 * (1 - Math.pow(1 - Math.min(1, t.t * 2.5), 2)) : t.t * 26); x.save(); x.translate(sx, yy); x.scale(sc, sc); x.strokeText(t.s, 0, 0); x.fillStyle = t.c; x.fillText(t.s, 0, 0); x.restore(); x.globalAlpha = 1; }
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (G.gloom > .01) { const g = G.gloom, R = Math.hypot(cw, ch) / 2, vg = x.createRadialGradient(cw / 2, ch / 2, R * .25, cw / 2, ch / 2, R);
    vg.addColorStop(0, `rgba(30,12,40,${.2 * g})`); vg.addColorStop(.55, `rgba(24,8,34,${.45 * g})`); vg.addColorStop(1, `rgba(10,3,18,${.85 * g})`); x.fillStyle = `rgba(28,10,40,${.22 * g})`; x.fillRect(0, 0, cw, ch); x.fillStyle = vg; x.fillRect(0, 0, cw, ch); }
  if (G.flash > 0) { x.fillStyle = `rgba(255,252,240,${Math.min(.55, G.flash * 2)})`; x.fillRect(0, 0, cw, ch); }
  if (G.cut) { const k = G.cut.t, inn = Math.min(1, k * 6), out = Math.max(0, (k - 1) * 4), a = inn * (1 - out), yy = ch * .19; x.globalAlpha = a; const gr = x.createLinearGradient(0, 0, cw, 0); gr.addColorStop(0, 'rgba(30,24,18,0)'); gr.addColorStop(.25, 'rgba(30,24,18,.75)'); gr.addColorStop(.75, 'rgba(30,24,18,.75)'); gr.addColorStop(1, 'rgba(30,24,18,0)'); x.fillStyle = gr; x.fillRect(0, yy - 30, cw, 60);
    x.fillStyle = G.cut.c; x.fillRect(0, yy - 30, cw, 2); x.fillRect(0, yy + 28, cw, 2); x.font = '900 30px system-ui'; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = 'rgba(20,14,8,.9)'; const sx = cw / 2 + (1 - inn) * 120 - out * 60; x.strokeText(G.cut.s, sx, yy + 11); x.fillStyle = G.cut.c; x.fillText(G.cut.s, sx, yy + 11); x.globalAlpha = 1; }
  hud();
}
/* ---------- 둥근 섬(낭떠러지는 아래로 좁아지는 바위) ---------- */
function islandGeo(Wd, s) {
  if (s.geo) return s.geo;
  const pts = s.poly.map(([a, b]) => iso(a, b)), n = pts.length; let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const [a, b] of pts) { minx = Math.min(minx, a); maxx = Math.max(maxx, a); miny = Math.min(miny, b); maxy = Math.max(maxy, b); }
  const mid = (minx + maxx) / 2, hw = (maxx - minx) / 2 + 1, rock = s.kind === 'rock', H = rock ? 30 + s.r * 12 : 40 + s.r * 9, sd = s.k * 13.7;
  const dep = pts.map(([a], i) => { const u = (a - mid) / hw, f = Math.pow(Math.max(0, 1 - u * u), .7); return H * (.2 + .8 * f) * (.84 + .1 * Math.sin(i * .7 + sd) + .07 * Math.sin(i * 1.9 + sd * 2) + .05 * Math.sin(i * 4.1 + sd)); });
  const top = new Path2D(), cliff = new Path2D(), shade = [0, 1, 2, 3, 4].map(() => new Path2D()), strata = [new Path2D(), new Path2D()], band = new Path2D(), lip = new Path2D(), edge = new Path2D(), stones = new Path2D(), hi = new Path2D(), roots = new Path2D();
  pts.forEach(([a, b], i) => i ? top.lineTo(a, b) : top.moveTo(a, b)); top.closePath();
  const F = []; // 앞쪽 변 번호
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, [ax, ay] = pts[i], [bx, by] = pts[j], ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1, nx = ey / l, ny = -ex / l;
    if (ny <= -.02) continue; F.push(i);
    const q = new Path2D(); q.moveTo(ax, ay); q.lineTo(bx, by); q.lineTo(bx, by + dep[j]); q.lineTo(ax, ay + dep[i]); q.closePath(); cliff.addPath(q); shade[clamp(Math.round((nx + 1) * 2), 0, 4)].addPath(q);
    band.moveTo(ax, ay + 4); band.lineTo(bx, by + 4); edge.moveTo(ax, ay); edge.lineTo(bx, by);
    let o = 9, k = 0; for (const st of [6, 9, 12, 15, 19, 24]) { o += st; if (o < Math.min(dep[i], dep[j]) - 3) { strata[k & 1].moveTo(ax, ay + o); strata[k & 1].lineTo(bx, by + o); } k++; }
    const h = hsh(s.k * 31 + i, 5); // 풀 끝 늘어짐
    for (let t = 0; t < 1; t += .5) { const px = lerp(ax, bx, t), py = lerp(ay, by, t), w = 2.4 + hsh(i, t * 9) * 2.4, d = 2.5 + hsh(t * 7 + i, 3) * 4.5; lip.moveTo(px - w, py - 1); lip.lineTo(px, py + d); lip.lineTo(px + w, py - 1); lip.closePath(); }
    if (h < .22 && dep[i] > 18) { const sy2 = ay + dep[i] * (.3 + hsh(i, 8) * .5), r = 2.5 + hsh(i, 9) * 4; stones.moveTo(ax + r, sy2); stones.ellipse(ax, sy2, r, r * .7, 0, 0, TAU); hi.moveTo(ax - r * .2 + r * .5, sy2 - r * .3); hi.ellipse(ax - r * .2, sy2 - r * .3, r * .5, r * .28, 0, 0, TAU); }
    if (h > .9 && !rock) { const L = 10 + hsh(i, 11) * Math.min(34, dep[i] * .6); roots.moveTo(ax, ay + 3); roots.quadraticCurveTo(ax + 5 * (hsh(i, 12) - .5) * 2, ay + L * .5, ax - 3 + hsh(i, 13) * 6, ay + L); }
  }
  const cells = []; let cx0 = 1e9, cx1 = -1e9, cy0 = 1e9, cy1 = -1e9; for (const [a, b] of s.poly) { cx0 = Math.min(cx0, a); cx1 = Math.max(cx1, a); cy0 = Math.min(cy0, b); cy1 = Math.max(cy1, b); }
  for (let yy = Math.floor(cy0) - 1; yy <= cy1 + 1; yy++) for (let xx = Math.floor(cx0) - 1; xx <= cx1 + 1; xx++) { if (!Wd.inb(xx, yy)) continue; const i = Wd.id(xx, yy), t = Wd.g[i]; if (t === 3 || t === 4) continue;
    if (Wd.isl[i] === s.k) { cells.push([xx, yy, t, 1]); continue; } if (t) continue; let nb = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (Wd.inb(xx + ox, yy + oy) && Wd.isl[Wd.id(xx + ox, yy + oy)] === s.k) nb = 1; if (nb) cells.push([xx, yy, 1, 0]); }
  const grad = x.createLinearGradient(0, miny, 0, maxy + H); grad.addColorStop(0, 'rgba(40,30,40,0)'); grad.addColorStop(.45, 'rgba(40,30,40,.12)'); grad.addColorStop(1, 'rgba(36,30,50,.55)');
  s.geo = { pts, top, cliff, shade, strata, band, lip, edge, stones, hi, roots, cells, grad, minx, maxx, miny, maxy: maxy + H, rock };
  return s.geo;
}
const SHADE = ['rgba(255,236,200,.2)', 'rgba(255,236,200,.08)', 'rgba(0,0,0,0)', 'rgba(20,12,8,.16)', 'rgba(20,12,8,.32)'];
/* ---------- 밑것 둥지: 시든 땅·보랏빛 안개 ---------- */
function blightShape(pk) { // 무리마다 고정된 얼룩 모양(겹친 타원) + 가시덤불 자리
  if (pk.bs) return pk.bs; const R = blightR(pk), sd = Math.round(pk.x * 7 + pk.y * 13), blobs = [], brm = [];
  for (let i = 0; i < 7; i++) { const a = hsh(sd, i) * TAU, d = i ? R * (.25 + hsh(sd, i + 9) * .45) : 0; blobs.push([pk.x + Math.cos(a) * d, pk.y + Math.sin(a) * d, R * (i ? .45 + hsh(sd, i + 20) * .3 : .8)]); }
  const nb = pk.nest ? 16 : 6; for (let i = 0; i < nb; i++) { const a = hsh(sd, i + 40) * TAU, d = Math.sqrt(hsh(sd, i + 60)) * R * .85, bx = pk.x + Math.cos(a) * d, by = pk.y + Math.sin(a) * d; if (walk(G.Wd, bx, by)) brm.push([bx, by, hsh(sd, i + 80)]); }
  return pk.bs = { blobs, brm };
}
function drawBlight(Wd) {
  for (const pk of G.packs) { const b = pk.bl || 0; if (b < .02) continue; const S = Wd.islands[pk.isl], g = islandGeo(Wd, S), bs = blightShape(pk);
    x.save(); x.clip(g.top);
    x.globalCompositeOperation = 'saturation'; x.fillStyle = `rgba(128,128,128,${.75 * b})`; // 시든 땅: 색이 빠짐
    for (const [bx, by, r] of bs.blobs) { const [ax, ay] = iso(bx, by), rx = r * TW / 2 * 1.2; x.beginPath(); x.ellipse(ax, ay, rx, rx * .5, 0, 0, TAU); x.fill(); }
    x.globalCompositeOperation = 'source-over';
    for (const [bx, by, r] of bs.blobs) { const [ax, ay] = iso(bx, by), rx = r * TW / 2 * 1.41, gr = x.createRadialGradient(ax, ay, 0, ax, ay, rx); gr.addColorStop(0, `rgba(34,18,40,${.5 * b})`); gr.addColorStop(.6, `rgba(48,30,44,${.3 * b})`); gr.addColorStop(1, 'rgba(48,30,44,0)');
      x.fillStyle = gr; x.save(); x.translate(ax, ay); x.scale(1, .5); x.translate(-ax, -ay); x.beginPath(); x.arc(ax, ay, rx, 0, TAU); x.fill(); x.restore(); }
    // 시든 가시덤불·금
    x.lineCap = 'round';
    for (const [bx, by, h] of bs.brm) { const [ax, ay] = iso(bx, by); x.globalAlpha = b; x.strokeStyle = '#1e1418'; x.lineWidth = 1.6; x.beginPath();
      for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + (k - 1.5) * .55 + (h - .5) * .4, L = 7 + h * 6 + (k % 2) * 4; x.moveTo(ax, ay); x.quadraticCurveTo(ax + Math.cos(a) * L * .4, ay + Math.sin(a) * L * .7, ax + Math.cos(a) * L, ay + Math.sin(a) * L * .9); } x.stroke();
      x.fillStyle = '#7a2a3a'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(ax + (k - 1) * 4, ay - 6 - k * 2, 1.1, 0, TAU); x.fill(); } }
    if (pk.nest) { const [ax, ay] = iso(pk.x, pk.y); x.globalAlpha = b; x.strokeStyle = 'rgba(160,80,220,.45)'; x.lineWidth = 1.4; x.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + .4, L = 30 + hsh(i, 7) * 26; x.moveTo(ax, ay); x.lineTo(ax + Math.cos(a) * L * .5, ay + Math.sin(a) * L * .25 + 2); x.lineTo(ax + Math.cos(a + .25) * L, ay + Math.sin(a + .25) * L * .5); } x.stroke(); }
    // 낮게 깔린 보랏빛 안개
    x.globalAlpha = 1; for (let k = 0; k < (pk.nest ? 5 : 2); k++) { const [ax, ay] = iso(pk.x + Math.sin(G.t * .3 + k * 2) * 1.2, pk.y + Math.cos(G.t * .25 + k * 1.3) * 1.2), rx = blightR(pk) * TW * .45 * (.6 + k * .1);
      x.fillStyle = `rgba(110,70,140,${.12 * b})`; x.beginPath(); x.ellipse(ax, ay, rx, rx * .42, 0, 0, TAU); x.fill(); }
    x.restore(); }
  x.globalAlpha = 1;
}
function drawBlightAir() { // 둥지 위로 떠오르는 보랏빛 티끌
  for (const pk of G.packs) { const b = pk.bl || 0; if (b < .05 || !pk.nest) continue; const R = blightR(pk), sd = pk.x * 3 + pk.y;
    for (let i = 0; i < 14; i++) { const k = (G.t * (.25 + hsh(sd, i) * .2) + hsh(sd, i + 5)) % 1, a = hsh(sd, i + 9) * TAU, d = Math.sqrt(hsh(sd, i + 11)) * R * .8, [ax, ay] = iso(pk.x + Math.cos(a) * d, pk.y + Math.sin(a) * d);
      x.globalAlpha = Math.sin(k * Math.PI) * .8 * b; x.fillStyle = i % 3 ? '#b77aff' : '#ff9a6a'; x.beginPath(); x.arc(ax + Math.sin(G.t * 2 + i) * 4, ay - k * 60, 1.5 + (i % 2), 0, TAU); x.fill(); } }
  x.globalAlpha = 1;
}
function drawIsland(Wd, s, g, T) { const c = islandTop(Wd, s, g, T); x.drawImage(c, g.tox, g.toy, g.tw, g.th); }
function drawCliff(g) {
  x.fillStyle = g.rock ? '#8a7c70' : '#7a5a3c'; x.fill(g.cliff);
  x.save(); x.clip(g.cliff);
  x.strokeStyle = g.rock ? 'rgba(60,50,45,.35)' : 'rgba(60,38,20,.35)'; x.lineWidth = 2.2; x.stroke(g.strata[0]); x.strokeStyle = g.rock ? 'rgba(220,210,200,.16)' : 'rgba(240,210,170,.16)'; x.lineWidth = 1.6; x.stroke(g.strata[1]);
  for (let i = 0; i < 5; i++) if (i !== 2) { x.fillStyle = SHADE[i]; x.fill(g.shade[i]); }
  x.fillStyle = g.grad; x.fill(g.cliff);
  x.fillStyle = 'rgba(150,140,132,.75)'; x.fill(g.stones); x.fillStyle = 'rgba(235,230,220,.35)'; x.fill(g.hi);
  x.strokeStyle = 'rgba(70,44,22,.85)'; x.lineWidth = 6; x.stroke(g.band);
  x.restore();
  if (!g.rock) { x.strokeStyle = 'rgba(96,120,58,.8)'; x.lineWidth = 1.3; x.stroke(g.roots); }
}
const TOPC = [];
function islandTop(Wd, s, g, T) {
  const S = Math.min(T.S, 1.6);
  if (g.tc && g.tcS === S) { const i = TOPC.indexOf(g); if (i >= 0) { TOPC.splice(i, 1); TOPC.push(g); } return g.tc; }
  while (TOPC.length >= 5) { const o = TOPC.shift(); o.tc = null; }
  const pad = 10, w = g.maxx - g.minx + pad * 2, h = g.maxy - g.miny + pad * 2;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S); const gx = c.getContext('2d'); gx.setTransform(S, 0, 0, S, (pad - g.minx) * S, (pad - g.miny) * S);
  const ox = x; x = gx; drawCliff(g);
  x.save(); x.clip(g.top);
  for (const [xx, yy, t] of g.cells) { const [sx, sy] = iso(xx, yy), hh = hsh(xx, yy), cc = clamp(Math.floor(Wd.nz(xx * .18 + 3, yy * .18) * 6), 0, 5);
    if (t === 5) x.drawImage(T.plaza[Math.floor(hh * 3)], sx - TW / 2, sy, TW, TH); else x.drawImage(T.grass[cc * 2 + (t === 2 ? 0 : hh > .5 ? 1 : 0)], sx - TW / 2, sy, TW, TH); }
  for (const [xx, yy, t] of g.cells) if (t === 2) { const [sx, sy] = iso(xx, yy); x.drawImage(T.dirt[Math.floor(hsh(xx, yy) * 3)], sx - TW * .8, sy + TH / 2 - TH * .8, TW * 1.6, TH * 1.6); }
  for (const [xx, yy, t, own] of g.cells) { if (t !== 1 || !own) continue; const [sx, sy] = iso(xx, yy), hh = hsh(xx, yy);
    if (hh < .22) x.drawImage(T.tuft[Math.floor(hh * 18) % 4], sx - 8 + (hsh(yy, xx) - .5) * 30, sy + 8 + hsh(xx + 7, yy) * 12, 16, 12); else if (hh > .93 && s.k !== Wd.town) x.drawImage(T.flower[Math.floor(hh * 100) % 3], sx - 7 + (hsh(yy, xx) - .5) * 26, sy + 6 + hsh(xx + 3, yy) * 12, 14, 14); }
  x.strokeStyle = 'rgba(255,255,220,.22)'; x.lineWidth = 3; x.stroke(g.top);
  x.restore();
  // 풀 테두리(낭떠러지 위로 살짝 늘어짐)
  x.fillStyle = g.rock ? '#7da850' : '#6aa244'; x.fill(g.lip); x.strokeStyle = g.rock ? '#5f8a3a' : '#4f8432'; x.lineWidth = 1.6; x.stroke(g.edge);
  x = ox;
  g.tc = c; g.tcS = S; g.tox = g.minx - pad; g.toy = g.miny - pad; g.tw = w; g.th = h; TOPC.push(g); return c;
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
  drawClsHero(P, sx, sy);
  if (P.buf.hold) { x.strokeStyle = 'rgba(255,210,120,.7)'; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy, 18, 9, 0, 0, TAU); x.stroke(); }
  const a = P.dodge > 0 ? .75 : P.inv0 > 0 ? .6 + Math.sin(G.t * 30) * .3 : 1;
  const jz = P.jump > 0 ? Math.sin((1 - P.jump / .48) * Math.PI) * 46 : 0;
  sprite(IM[P.cls], HC[0], HC[1], HC[2], HC[3], heroFrame(P), P.dir, sx, sy - jz, .5, P.hurt > .15 ? .1 : 0, a);
  drawClsHero(P, sx, sy - jz, 1);
}
function drawMob(m) {
  if (!IM[m.D.spr]) { const [sx, sy] = iso(m.x, m.y); shadow(sx, sy, m.D.boss ? 36 : 24); return; } // 큰 그림 받는 중
  const D = m.D, c = MC[D.spr], [sx, sy0] = iso(m.x, m.y), sy = sy0 + (m.fy || 0) * 30;
  const a = m.dead ? Math.max(0, 1 - Math.max(0, m.at - .5) * 1.6) * (m.fl ? Math.max(0, 1 - m.fy * .4) : 1) : 1;
  if (!m.fl) shadow(sx, sy0, D.boss ? 36 : D.mini ? 26 : D.fly ? 9 : m.elite ? 14 : 11);
  if (m.elite && !m.dead) { // 정예: 발밑에서 기운이 피어오름
    const pu = .5 + Math.sin(G.t * 5 + m.id * 9) * .5, ag = x.createRadialGradient(sx, sy0, 2, sx, sy0, 26); ag.addColorStop(0, m.E[1] + 'aa'); ag.addColorStop(1, m.E[1] + '00'); x.fillStyle = ag; x.beginPath(); x.ellipse(sx, sy0, 26, 13, 0, 0, TAU); x.fill();
    x.strokeStyle = m.E[1]; x.globalAlpha = .55 + pu * .4; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy0, 18 + pu * 3, 9 + pu * 1.5, 0, 0, TAU); x.stroke();
    for (let i = 0; i < 4; i++) { const k = (G.t * .8 + i / 4 + m.id) % 1, a = i * 1.7 + m.id * 5; x.globalAlpha = (1 - k) * .9; x.fillStyle = m.E[1]; x.beginPath(); x.arc(sx + Math.cos(a) * 12, sy0 - k * 44, 1.8, 0, TAU); x.fill(); } x.globalAlpha = 1; }
  const sc0 = .5 * (m.fl ? Math.max(.2, 1 - m.fy * .25) : 1) * (m.elite ? 1.22 : 1), q = m.sq > 0 ? m.sq / .2 : 0;
  if (q) { x.save(); x.translate(sx, sy); x.scale(1 + q * .16, 1 - q * .14); x.translate(-sx, -sy); }
  if (m.elite && !m.dead) { x.shadowColor = m.E[1]; x.shadowBlur = 10; }
  sprite(IM[D.spr], c[0], c[1], c[2], c[3], mobFrame(m), m.dir, sx + (q ? rnd(-1.5, 1.5) : 0), sy, sc0, m.flash, a);
  x.shadowBlur = 0;
  if (q) x.restore();
  if (!m.dead && (m.hp < m.mhp || m.elite) && !D.big) { const w = 26, f = m.hp / m.mhp, top = sy - c[3] * .5 * (m.elite ? 1.22 : 1) - 2; x.fillStyle = 'rgba(20,14,10,.7)'; x.fillRect(sx - w / 2 - 1, top - 1, w + 2, 5); x.fillStyle = m.elite ? m.E[1] : '#e85a4a'; x.fillRect(sx - w / 2, top, w * f, 3);
    if (m.elite) { x.font = '700 9px system-ui'; x.textAlign = 'center'; x.fillStyle = m.E[1]; x.strokeStyle = 'rgba(20,14,10,.8)'; x.lineWidth = 2.5; const s = m.E[0] + ' ' + D.n; x.strokeText(s, sx, top - 4); x.fillText(s, sx, top - 4); } }
  if (m.stun > 0 && !m.dead) { x.fillStyle = '#ffe08a'; for (let i = 0; i < 3; i++) { const a2 = G.t * 5 + i * TAU / 3; x.beginPath(); x.arc(sx + Math.cos(a2) * 9, sy - c[3] * .42 + Math.sin(a2) * 3, 2, 0, TAU); x.fill(); } }
}
function drawDrop(d) {
  const [sx, sy] = iso(d.x, d.y), b = Math.max(0, .35 - d.t) * 60;
  if (d.gold) { x.fillStyle = '#ffd166'; x.strokeStyle = '#8a6a1a'; x.lineWidth = 1; for (let i = 0; i < Math.min(4, 1 + d.gold / 10); i++) { x.beginPath(); x.ellipse(sx - 4 + i * 3, sy - 3 - b - i * 1.5, 4, 2.4, 0, 0, TAU); x.fill(); x.stroke(); } return; }
  const it = d.it, col = itemColor(it); x.fillStyle = col; x.globalAlpha = .25 + Math.sin(G.t * 4) * .1; x.beginPath(); x.ellipse(sx, sy, 12, 6, 0, 0, TAU); x.fill(); x.globalAlpha = 1;
  if (!it.g && it.r >= 2) { const h = 70 + Math.sin(G.t * 3) * 6, gr = x.createLinearGradient(0, sy - h, 0, sy); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, col); x.globalAlpha = .55; x.fillStyle = gr; x.fillRect(sx - 4, sy - h, 8, h); x.globalAlpha = .25; x.fillRect(sx - 9, sy - h * .7, 18, h * .7); x.globalAlpha = 1; }
  drawIcon(it, sx - 11, sy - 18 - b, 22);
}
// 아이템 그림: 바탕 그림 + 대표 옵션 색 물들이기 + 옵션 표시(작은 문양) + 등급·강화·축복 빛
const AFXV = { dmgp: ['#ff7a5a', 'fist'], str: ['#ff7a5a', 'fist'], mind: ['#ff7a5a', 'fist'], kb: ['#ffb04a', 'fist'], crit: ['#ffd23a', 'bolt'], aspd: ['#ffe08a', 'feather'], move: ['#9ee68a', 'feather'], agi: ['#9ee68a', 'feather'],
  hp: ['#ff6a7a', 'heart'], vit: ['#ff6a7a', 'heart'], lifek: ['#ff6a7a', 'heart'], ac: ['#b8c8d8', 'shield'], blk: ['#b8c8d8', 'shield'], res: ['#b8c8d8', 'shield'], thorn: ['#8ad06a', 'thorn'],
  wind: ['#7fd0f0', 'swirl'], wreg: ['#7fd0f0', 'swirl'], windk: ['#7fd0f0', 'swirl'], spi: ['#7fd0f0', 'swirl'], xp: ['#c9a8ff', 'star'], find: ['#ffd166', 'eye'], sk0: ['#ffcf7a', 'star'], sk1: ['#ffcf7a', 'star'], sk2: ['#ffcf7a', 'star'] };
const TINTC = {};
function tinted(k, col, a) { const key = k + col + a; if (TINTC[key]) return TINTC[key]; const m = ICM[k]; if (!m || !IM.icons) return null; const c = document.createElement('canvas'); c.width = m[2]; c.height = m[3]; const g = c.getContext('2d'); g.drawImage(IM.icons, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, m[2], m[3]); return TINTC[key] = c; }
function mainAfx(it) { if (it.g || !it.id) return null; const L = it.u ? UNIQ.find(u => u.id === it.u).fx : it.set ? SETS[it.set].bonus[0][1] : it.af; if (!L || !L.length) return null; return L[0][0]; }
function emblem(g, kind, cx, cy, r, col) {
  g.save(); g.fillStyle = 'rgba(30,22,14,.82)'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = Math.max(1, r * .16); g.stroke(); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; const q = r * .55;
  g.beginPath();
  if (kind === 'heart') { g.moveTo(cx, cy + q); g.bezierCurveTo(cx - q * 1.5, cy - q * .2, cx - q * .6, cy - q * 1.2, cx, cy - q * .4); g.bezierCurveTo(cx + q * .6, cy - q * 1.2, cx + q * 1.5, cy - q * .2, cx, cy + q); g.fill(); }
  else if (kind === 'bolt') { g.moveTo(cx + q * .3, cy - q); g.lineTo(cx - q * .5, cy + q * .1); g.lineTo(cx, cy + q * .1); g.lineTo(cx - q * .3, cy + q); g.lineTo(cx + q * .5, cy - q * .1); g.lineTo(cx, cy - q * .1); g.closePath(); g.fill(); }
  else if (kind === 'shield') { g.moveTo(cx, cy - q); g.lineTo(cx + q * .85, cy - q * .55); g.quadraticCurveTo(cx + q * .8, cy + q * .5, cx, cy + q); g.quadraticCurveTo(cx - q * .8, cy + q * .5, cx - q * .85, cy - q * .55); g.closePath(); g.fill(); }
  else if (kind === 'swirl') { g.lineWidth = r * .2; g.arc(cx, cy, q * .9, .3, 4.6); g.stroke(); g.beginPath(); g.arc(cx + q * .1, cy, q * .4, 3.4, 7.5); g.stroke(); }
  else if (kind === 'feather') { g.ellipse(cx, cy, q * .35, q, .7, 0, TAU); g.fill(); g.strokeStyle = 'rgba(30,22,14,.8)'; g.lineWidth = r * .1; g.beginPath(); g.moveTo(cx - q * .6, cy + q * .7); g.lineTo(cx + q * .5, cy - q * .6); g.stroke(); }
  else if (kind === 'fist') { g.moveTo(cx - q, cy + q * .2); g.lineTo(cx, cy - q); g.lineTo(cx + q, cy + q * .2); g.lineTo(cx + q * .4, cy + q * .2); g.lineTo(cx + q * .4, cy + q); g.lineTo(cx - q * .4, cy + q); g.lineTo(cx - q * .4, cy + q * .2); g.closePath(); g.fill(); }
  else if (kind === 'thorn') { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; g.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); g.lineTo(cx + Math.cos(a + .6) * q * .35, cy + Math.sin(a + .6) * q * .35); g.lineTo(cx + Math.cos(a - .6) * q * .35, cy + Math.sin(a - .6) * q * .35); } g.fill(); }
  else if (kind === 'eye') { g.ellipse(cx, cy, q, q * .55, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(30,22,14,.9)'; g.beginPath(); g.arc(cx, cy, q * .3, 0, TAU); g.fill(); }
  else { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr2 = i % 2 ? q * .45 : q; g.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } g.closePath(); g.fill(); }
  g.restore();
}
function drawIcon(it, X, Y, s, g) { g = g || x; const k = it.g ? GOODS[it.g].ic : BASE[it.b].ic, m = ICM[k];
  if (!m || !IM.icons) { g.fillStyle = itemColor(it); g.beginPath(); g.arc(X + s / 2, Y + s / 2, s * .32, 0, TAU); g.fill(); return; }
  const live = g === x && G, cx = X + s / 2, cy = Y + s / 2;
  if (!it.g) { // 뒤쪽 빛: 축복 금빛, 저주 보랏빛, 강화 +4 하늘빛 / +7 금빛, 이름난 이상 등급 빛
    const glow = it.st === -1 && it.id ? '#8a4ac8' : it.st === 1 ? '#ffe08a' : it.en >= 7 ? '#ffd166' : it.en >= 4 ? '#9fe4ff' : it.r >= 2 ? RAR[it.r].c : null;
    if (glow) { const p = live ? .75 + Math.sin(G.t * 4) * .25 : 1, gr = g.createRadialGradient(cx, cy, s * .1, cx, cy, s * .55); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = .55 * p; g.fillStyle = gr; g.fillRect(X - s * .05, Y - s * .05, s * 1.1, s * 1.1); g.globalAlpha = 1; } }
  const ma = mainAfx(it), v = ma && AFXV[ma], tc = v ? tinted(k, v[0], it.u ? .45 : it.r >= 2 ? .38 : .28) : null;
  if (tc) g.drawImage(tc, X, Y, s, s); else g.drawImage(IM.icons, m[0], m[1], m[2], m[3], X, Y, s, s);
  if (it.g) return;
  if (v && s >= 20) emblem(g, v[1], X + s * .2, Y + s * .8, s * .21, v[0]);
  if (it.u && it.id) { g.fillStyle = '#ffe9b0'; for (let i = 0; i < 3; i++) { const a = (live ? G.t * 2 : 0) + i * 2.1; g.globalAlpha = .9; g.beginPath(); g.arc(cx + Math.cos(a) * s * .38, cy + Math.sin(a) * s * .38, s * .035, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  if (!it.id && s >= 20) { g.font = `900 ${s * .34}px system-ui`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(30,22,14,.85)'; g.strokeText('?', X + s * .82, Y + s * .34); g.fillStyle = '#ffe08a'; g.fillText('?', X + s * .82, Y + s * .34); }
}
function drawProj(p) {
  const [sx, sy] = iso(p.x, p.y), Y = sy - 22;
  if (p.k === 'wind') { x.strokeStyle = 'rgba(230,248,255,.9)'; x.lineWidth = 2.2; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(sx, Y, 4 + i * 3, G.t * 12 + i, G.t * 12 + i + 2.2); x.stroke(); } }
  else if (p.k === 'bolt') { const [ex, ey] = iso(p.x - p.vx * .04, p.y - p.vy * .04); x.strokeStyle = '#fff6b0'; x.lineWidth = 3; x.shadowColor = '#ffe066'; x.shadowBlur = 10; x.beginPath(); x.moveTo(ex, ey - 22); x.lineTo(sx, Y); x.stroke(); x.shadowBlur = 0; }
  else if (p.k === 'arrow') { const [ex, ey] = iso(p.x - p.vx * .035, p.y - p.vy * .035); x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(ex, ey - 22); x.lineTo(sx, Y); x.stroke(); x.fillStyle = '#e8eef4'; x.beginPath(); x.arc(sx, Y, 2.4, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(ex, ey - 22); x.lineTo(lerp(ex, sx, -1), lerp(ey, sy, -1) - 22); x.stroke(); }
  else if (p.k === 'twister') { for (let i = 0; i < 7; i++) { const r = 6 + i * 3.2, yy = sy - i * 7; x.strokeStyle = `rgba(225,242,252,${.85 - i * .08})`; x.lineWidth = 2.4; x.beginPath(); x.ellipse(sx + Math.sin(G.t * 9 + i) * 3, yy, r, r * .38, 0, G.t * 14 + i, G.t * 14 + i + 4.4); x.stroke(); } }
}
function drawFx(f) {
  if (f.t < 0) return; const k = f.t / f.life, [sx, sy] = iso(f.x, f.y);
  if (f.k === 'ring') { x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 3; x.beginPath(); x.ellipse(sx, sy, f.r * TW / 2 * 1.41 * (.4 + k * .6), f.r * TH / 2 * 1.41 * (.4 + k * .6), 0, 0, TAU); x.stroke(); x.globalAlpha = 1; }
  else if (f.k === 'thrust') { const [ex, ey] = iso(f.x + f.dx * f.len, f.y + f.dy * f.len); x.strokeStyle = `rgba(255,250,235,${1 - k})`; x.lineWidth = 4 * (1 - k) + 1; x.beginPath(); x.moveTo(sx, sy - 20); x.lineTo(ex, ey - 20); x.stroke(); }
  else if (f.k === 'gust' || f.k === 'bash') { const a0 = Math.atan2(...(() => { const [ax, ay] = iso(f.dx, f.dy); return [ay, ax]; })()); x.strokeStyle = f.k === 'gust' ? `rgba(230,246,255,${.9 - k})` : `rgba(255,220,150,${.9 - k})`; x.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { const a = a0 + (i / 5 - .5) * f.arc, r = f.r * 32 * (.4 + k * .7); x.beginPath(); x.ellipse(sx, sy - 14, r, r * .5, 0, a - .15, a + .15); x.stroke(); } }
  else if (f.k === 'zap') { const [ex, ey] = iso(f.x2, f.y2); x.strokeStyle = f.c || `rgba(255,246,170,${1 - k})`; x.globalAlpha = f.c ? 1 - k : 1; x.lineWidth = 2.5; x.shadowColor = f.c || '#ffe066'; x.shadowBlur = 8; x.beginPath(); x.moveTo(sx, sy - 22); for (let i = 1; i < 6; i++) { const t = i / 6; x.lineTo(lerp(sx, ex, t) + rnd(-6, 6), lerp(sy, ey, t) - 22 + rnd(-6, 6)); } x.lineTo(ex, ey - 22); x.stroke(); x.shadowBlur = 0; x.globalAlpha = 1; }
  else if (f.k === 'pop') { x.fillStyle = f.c; x.globalAlpha = 1 - k; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.beginPath(); x.arc(sx + Math.cos(a) * k * 14, sy - 20 + Math.sin(a) * k * 9, 2.4 * (1 - k) + .5, 0, TAU); x.fill(); } x.globalAlpha = 1; }
  else if (f.k === 'aura') { x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy - k * 30 - i * 8, 16 - i * 3, 7 - i, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  else if (f.k === 'lvl') { x.strokeStyle = '#ffd166'; x.globalAlpha = 1 - k; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy - k * 50 - i * 12, 20 + i * 4, 9 + i * 2, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  else if (f.k === 'hit') { const Y = sy - f.z, r = (f.big ? 36 : 24) * (.3 + k * .9); x.globalCompositeOperation = 'lighter'; { const gl = x.createRadialGradient(sx, Y, 0, sx, Y, f.big ? 34 : 22); gl.addColorStop(0, f.c); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = (1 - k) * .8; x.fillStyle = gl; x.fillRect(sx - 40, Y - 40, 80, 80); } x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1 - k; x.strokeStyle = f.c; x.lineWidth = (f.big ? 4 : 2.6) * (1 - k) + .5; x.beginPath(); x.ellipse(sx, Y, r, r * .6, 0, 0, TAU); x.stroke();
    x.fillStyle = '#fff'; x.globalAlpha = (1 - k) * .95; x.beginPath(); const rs = (f.big ? 20 : 13) * (1 - k * .8); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr2 = i % 2 ? rs * .35 : rs; x.lineTo(sx + Math.cos(a) * rr2 * 1.4, Y + Math.sin(a) * rr2); } x.closePath(); x.fill(); x.globalAlpha = 1; }
  else if (f.k === 'slash') { const [ex, ey] = iso(f.dx, f.dy), a0 = Math.atan2(ey, ex), R = f.len * 30, sw = f.s ? 1 : -1; x.save(); x.translate(sx, sy - 22); x.scale(1, .62);
    const a1 = a0 - 1.1 * sw + 2.2 * sw * Math.min(1, k * 2.4); x.globalAlpha = 1 - k; const gr = x.createLinearGradient(-R, 0, R, 0); x.strokeStyle = 'rgba(255,248,225,.95)'; x.lineCap = 'round';
    for (let i = 0; i < 6; i++) { x.lineWidth = (7 - i) * (1 - k) + .5; x.globalAlpha = (1 - k) * (1 - i * .14); x.beginPath(); x.arc(0, 0, R * (.82 + i * .03), a1 - .12 * sw * (i + 1), a1 - .12 * sw * i, sw < 0); x.stroke(); }
    x.restore(); x.globalAlpha = 1; }
  else if (drawClsFx(f, k, sx, sy)) return;
  else if (f.k === 'sail') { x.fillStyle = `rgba(240,248,255,${.5 * (1 - k)})`; x.beginPath(); x.ellipse(sx, sy - 18, 16 + k * 10, 8, 0, 0, TAU); x.fill(); }
}
function drawParts() {
  for (const p of G.parts) { if (p.t < 0) continue; const [sx, sy] = iso(p.x, p.y), k = p.t / p.life, Y = sy - p.z; x.globalAlpha = Math.min(1, (1 - k) * 1.6);
    if (p.k === 'spark') { const [vx, vy] = iso(p.vx, p.vy); const l = .05; x.strokeStyle = p.c; x.lineWidth = p.s; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx, Y); x.lineTo(sx - vx * l, Y - vy * l + p.vz * l * .5); x.stroke(); }
    else if (p.k === 'puff' || p.k === 'dust') { x.fillStyle = p.c; x.beginPath(); x.arc(sx, Y, p.s * (p.k === 'dust' ? .6 + k : 1 - k * .3), 0, TAU); x.fill(); }
    else { x.save(); x.translate(sx, Y); x.rotate(p.rot + p.t * 8); x.fillStyle = p.c; x.beginPath(); if (p.k === 'leaf') x.ellipse(0, 0, p.s, p.s * .4, 0, 0, TAU); else { x.moveTo(-p.s * .6, -p.s * .4); x.lineTo(p.s * .7, -p.s * .2); x.lineTo(p.s * .1, p.s * .6); x.closePath(); } x.fill(); x.restore(); } }
  x.globalAlpha = 1;
}
function drawVortex(a) { const [ax, ay] = iso(a.x, a.y), k = a.t / a.life, al = Math.min(1, a.t * 4, (a.life - a.t) * 6);
  x.globalAlpha = al * .35; x.fillStyle = '#cfeaff'; x.beginPath(); x.ellipse(ax, ay, a.r * 45, a.r * 22, 0, 0, TAU); x.fill();
  for (let i = 0; i < 9; i++) { const rr2 = a.r * (1 - i / 10) * 45, y2 = ay - i * 9; x.globalAlpha = al * (.85 - i * .05); x.strokeStyle = i % 2 ? '#ffffff' : '#9fe4ff'; x.lineWidth = 3.2 - i * .2; x.beginPath(); x.ellipse(ax + Math.sin(G.t * 6 + i) * 4, y2, rr2 * (.35 + i * .02 + .65 * (1 - k * .3)), rr2 * .42, 0, G.t * (9 + i) + i, G.t * (9 + i) + i + 3.6); x.stroke(); }
  x.globalAlpha = 1; }
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
  const boss = G.mobs.find(m => m.D.boss && !m.dead && m.st !== 'idle') || G.mobs.find(m => m.D.mini && !m.dead && m.st !== 'idle' && hyp(m.x - G.P.x, m.y - G.P.y) < 10); if (boss) { const w = Math.min(420, cw * .36); x.fillStyle = 'rgba(30,24,18,.7)'; rr(cw / 2 - w / 2 - 6, 8, w + 12, 30, 8); x.fill(); x.font = '800 12px system-ui'; x.textAlign = 'center'; x.fillStyle = '#ffe4c8'; x.fillText(boss.D.n, cw / 2, 21); x.fillStyle = '#3a2a20'; x.fillRect(cw / 2 - w / 2, 26, w, 7); x.fillStyle = boss.D.mini ? '#b06ae8' : '#e8604e'; x.fillRect(cw / 2 - w / 2, 26, w * boss.hp / boss.mhp, 7); }
  // 메시지
  x.textAlign = 'center'; G.msg.forEach((m, i) => { const a = Math.min(1, 4.5 - m.t); x.globalAlpha = a; x.font = `700 ${12.5 * s}px system-ui`; const w = x.measureText(m.s).width + 20, yy = (boss ? 48 : 14) + i * 24 * s; x.fillStyle = 'rgba(30,24,18,.62)'; rr(cw / 2 - w / 2, yy, w, 20 * s, 8); x.fill(); x.fillStyle = m.c; x.fillText(m.s, cw / 2, yy + 14 * s); x.globalAlpha = 1; });
  minimap(cw - 10 - SAFE_R(), 10, s);
  // 퀘스트 알림
  questTracker(cw - 10 - SAFE_R(), 10 + 112 * s + 8, s);
  // 아래: 스킬·물약·피하기·메뉴
  const bsz = (touch ? 54 : 44) * s, gap = 6 * s;
  if (touch) {
    const A0 = bsz * 1.6, cx = cw - SAFE_R() - 16 - A0 / 2, cy = ch - 14 - A0 / 2, rho = A0 / 2 + bsz * 1.2;
    btn('atk', cx - A0 / 2, cy - A0 / 2, A0, '', '공격');
    [180, 213, 246, 279].forEach((deg, i) => { const a = deg * Math.PI / 180, z = P.slots[i] === 'ult' ? bsz * 1.12 : bsz; skillBtn(i, P.slots[i], cx + Math.cos(a) * (rho + (z - bsz) * .5) - z / 2, cy + Math.sin(a) * (rho + (z - bsz) * .5) - z / 2, z); });
    const sm = bsz * .86, lx = cx - rho - bsz * .6 - sm - 14;
    btn('dodge', lx, ch - 14 - sm, sm, '', '돛'); btn('pot', lx - sm - 10, ch - 14 - sm, sm, '', '차 ' + count('pot')); btn('wpot', lx - (sm + 10) * 2, ch - 14 - sm, sm, '', '사탕 ' + count('wpot'));
    // 왼쪽 막대(가상 패드): 안 누를 때도 자리를 흐리게 보여 줌
    const p = TOUCH.pad, px0 = p ? p.x0 : SAFE_L() + 96, py0 = p ? p.y0 : ch - 96; x.globalAlpha = p ? 1 : .55; x.fillStyle = 'rgba(30,24,18,.25)'; x.beginPath(); x.arc(px0, py0, 52, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(px0 + (p ? p.dx * 44 : 0), py0 + (p ? p.dy * 44 : 0), 22, 0, TAU); x.fill(); if (!p) { x.font = `700 ${11 * s}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('이동', px0, py0 + 70); } x.globalAlpha = 1;
  } else {
    const n = 4, tw = n * bsz + (n - 1) * gap, X0 = cw / 2 - tw / 2, Y0 = ch - bsz - 12;
    P.slots.forEach((id, i) => skillBtn(i, id, X0 + i * (bsz + gap), Y0, bsz, String(i + 1)));
    btn('pot', X0 - gap * 2 - bsz, Y0, bsz, 'Q', '차 ' + count('pot')); btn('wpot', X0 + tw + gap * 2, Y0, bsz, 'R', '사탕 ' + count('wpot')); btn('dodge', X0 + tw + gap * 3 + bsz, Y0, bsz, '␣', '돛');
    x.font = `600 ${9 * s}px system-ui`; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.75)'; x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 2.5; const hint = '왼쪽 클릭 이동 · 오른쪽 클릭 공격'; x.strokeText(hint, cw / 2, Y0 - 6); x.fillText(hint, cw / 2, Y0 - 6);
  }
  // 메뉴 버튼(위 오른쪽, 지도 왼쪽)
  const mb = (touch ? 40 : 32) * s, mw = mb * (touch ? 1.35 : 1.6), my = 8, MN = [['inv', '가방', 'I'], ['char', '캐릭터', 'C'], ['skill', '기술', 'S'], ['map', '지도', 'M'], ['menu', '≡', '']], mx = cw - SAFE_R() - 10 - 112 * s - 8 - (mw + 4) * 4 - mb - 4;
  let X = mx; MN.forEach(([k, l, key]) => { const w = k === 'menu' ? mb : mw; x.fillStyle = 'rgba(30,24,18,.62)'; rr(X, my, w, mb, 8); x.fill(); x.fillStyle = (k === 'char' && P.pts) || (k === 'skill' && (P.skp || P.shd && P.shd.length && P.board.includes(null) && P.lv >= BOARD_LV)) ? '#ffd166' : '#fff'; x.font = `700 ${(l.length > 1 ? (touch ? 11.5 : 10.5) : 16) * s}px system-ui`; x.textAlign = 'center'; x.fillText(l, X + w / 2, my + mb / 2 + (key && !touch ? 1 : 4) * s);
    if (key && !touch) { x.font = `700 ${8 * s}px system-ui`; x.fillStyle = '#ffd166'; x.fillText(key, X + w / 2, my + mb - 4 * s); } if ((k === 'char' && P.pts) || (k === 'skill' && (P.skp || P.shd && P.shd.length && P.board.includes(null) && P.lv >= BOARD_LV))) { x.fillStyle = '#ff6a5a'; x.beginPath(); x.arc(X + w - 3, my + 3, 4, 0, TAU); x.fill(); }
    BTN.push({ k, x: X, y: my, w, h: mb }); X += w + 4; });
  // 상호작용
  if (G.near) { x.font = `800 ${(touch ? 14 : 12.5) * s}px system-ui`; const t = (touch ? '👆 ' : 'F  ') + G.near.label, hh = (touch ? 38 : 28) * s, w = x.measureText(t).width + 30, X2 = cw / 2 - w / 2, Y = ch - (touch ? 64 : 116) * s - hh / 2; x.fillStyle = 'rgba(255,240,200,.95)'; rr(X2, Y, w, hh, hh / 2); x.fill(); x.strokeStyle = '#c8a06a'; x.lineWidth = 2; x.stroke(); x.fillStyle = '#3a2a10'; x.textAlign = 'center'; x.fillText(t, cw / 2, Y + hh * .66); BTN.push({ k: 'use', x: X2, y: Y, w, h: hh }); }
}
const SAFE_L = () => 0, SAFE_R = () => 0;
function bar(X, Y, w, h, f, c1, c2, label, s) { x.fillStyle = 'rgba(0,0,0,.4)'; rr(X, Y, w, h, h / 2); x.fill(); const g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, c2); g.addColorStop(1, c1); x.fillStyle = g; if (f > 0) { rr(X, Y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); x.fill(); } x.font = `700 ${h * .78}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(label, X + w / 2, Y + h * .8); }
function btn(k, X, Y, sz, key, label) { x.fillStyle = 'rgba(30,24,18,.55)'; x.beginPath(); x.arc(X + sz / 2, Y + sz / 2, sz / 2, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,240,210,.5)'; x.lineWidth = 1.5; x.stroke();
  const P = G.P; if (k === 'dodge' && P.dcd > 0) { x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.moveTo(X + sz / 2, Y + sz / 2); x.arc(X + sz / 2, Y + sz / 2, sz / 2, -Math.PI / 2, -Math.PI / 2 + TAU * P.dcd / P.sail[1]); x.fill(); }
  if (k === 'atk') { const ic = { warden: 'spear', windcaller: 'staff', drifter: 'sword', trapper: 'xbow', ringer: 'hammer' }[P.cls]; if (ICM[ic]) x.drawImage(IM.icons, ...ICM[ic], X + sz * .2, Y + sz * .2, sz * .6, sz * .6); }
  if (k === 'pot' || k === 'wpot') { const m = ICM[k]; if (m) x.drawImage(IM.icons, ...m, X + sz * .22, Y + sz * .12, sz * .56, sz * .56); }
  if (k === 'dodge') { const m = ICM.sail; if (m) x.drawImage(IM.icons, ...m, X + sz * .22, Y + sz * .12, sz * .56, sz * .56); }
  x.font = `700 ${Math.max(9, sz * .2)}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 2.5; if (label) { x.strokeText(label, X + sz / 2, Y + sz * .9); x.fillText(label, X + sz / 2, Y + sz * .9); }
  if (key) { x.fillStyle = '#ffd166'; x.fillText(key, X + sz * .18, Y + sz * .26); }
  BTN.push({ k, x: X, y: Y, w: sz, h: sz });
}
const SKC = { ult: '#fff3c0',  pierce: '#ffe9c0', sweep: '#ffd59a', bash: '#ffd27a', hold: '#f2c26a', shout: '#ffb48a', flag: '#b6f0a0', gust: '#dff4ff', twister: '#c8ecff', bolt: '#fff3a0', chain: '#ffe066', cloud: '#f4f8ff', mist: '#d8e6f0', slash3: '#ffe0d6', whirl: '#ffd0c0', dashcut: '#fff0e8', parry: '#ffe8c0', mark: '#ff9a8a', shadow: '#e0c8ff', pshot: '#f4e8c8', rain: '#e8d8b0', trap: '#e8e0d0', net: '#f0e4c0', roll: '#d8f0b0', hawk: '#f0d0a0', toll: '#ffe0a0', wave: '#ffe8b8', echo: '#e0d0ff', resound: '#e8d8ff', clang: '#ffffff', dome: '#ffd890' };
function skillBtn(i, id, X, Y, sz, key) {
  const P = G.P, ult = id === 'ult'; x.fillStyle = 'rgba(30,24,18,.6)'; rr(X, Y, sz, sz, sz * .22); x.fill(); x.strokeStyle = ult ? '#ffcf7a' : 'rgba(255,240,210,.45)'; x.lineWidth = ult ? 2.5 : 1.5; x.stroke();
  if (id) { const s = skillOf(P.cls, id); drawSkillIcon(x, s, X, Y, sz, P.cls); const cd = P.cds[id] || 0;
    if (cd > 0) { x.fillStyle = 'rgba(0,0,0,.55)'; rr(X, Y + sz * (1 - cd / s.cd), sz, sz * cd / s.cd, sz * .2); x.fill(); if (cd > .9) { x.font = `800 ${sz * .32}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 3; x.strokeText(Math.ceil(cd), X + sz / 2, Y + sz * .62); x.fillText(Math.ceil(cd), X + sz / 2, Y + sz * .62); } }
    else if (ult) { x.globalAlpha = .4 + Math.sin(G.t * 5) * .3; x.strokeStyle = '#fff3c0'; x.lineWidth = 2; rr(X - 2, Y - 2, sz + 4, sz + 4, sz * .24); x.stroke(); x.globalAlpha = 1; }
    if (P.wind < s.cost) { x.fillStyle = 'rgba(20,60,120,.4)'; rr(X, Y, sz, sz, sz * .22); x.fill(); } }
  else if (i === 3 && P.lv < ULT[P.cls].req) { x.font = `700 ${sz * .2}px system-ui`; x.textAlign = 'center'; x.fillStyle = 'rgba(255,220,160,.7)'; x.fillText('궁극', X + sz / 2, Y + sz * .5); x.fillText(ULT[P.cls].req + '레벨', X + sz / 2, Y + sz * .74); }
  if (key) { x.font = `700 ${sz * .24}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#ffd166'; x.fillText(key, X + 4, Y + sz * .28); }
  BTN.push({ k: 's' + i, x: X, y: Y, w: sz, h: sz });
}
// 스킬 그림: 갈래 색 바탕 + 동작 그림(코드)
function drawSkillIcon(g, s, X, Y, sz, cls) {
  const col = [['#3a6a8a', '#7aa0b8'], ['#8a6a3a', '#c8a26a'], ['#6a4a7a', '#a88ac0'], ['#8a4a1a', '#f0b04a']][s.br], gr = g.createLinearGradient(X, Y, X + sz, Y + sz); gr.addColorStop(0, col[1]); gr.addColorStop(1, col[0]);
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
    case 'ult': if (cls === 'warden') { L(cx, cy - r * 1.3, cx, cy + r * .5); g.beginPath(); g.moveTo(cx, cy + r * .9); g.lineTo(cx - r * .3, cy + r * .3); g.lineTo(cx + r * .3, cy + r * .3); g.fill(); for (let i = 0; i < 5; i++) { const a = Math.PI * (.1 + i * .2); L(cx + Math.cos(a) * r * .7, cy + r * .9 + Math.sin(a) * r * .1 - r * .15, cx + Math.cos(a) * r * 1.3, cy + r * .9 + Math.sin(a) * r * .35 - r * .15); } }
      else if (cls === 'windcaller') { for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx, cy, r * (.3 + i * .25), i, i + 4.2); g.stroke(); } } else clsIcon(g, s, cx, cy, r, c, L, col, cls); break;
    default: clsIcon(g, s, cx, cy, r, c, L, col, cls); break;
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
  for (const m of G.mobs) if (!m.dead) { x.fillStyle = m.D.boss ? '#ff4a3a' : m.D.mini ? '#c06aff' : m.elite ? m.E[1] : '#e85a4a'; x.fillRect(m.x * 2 - 1.5, m.y * 2 - 1.5, 3, 3); }
  for (const k in Wd.npcAt) { x.fillStyle = '#ffd166'; x.fillRect(Wd.npcAt[k][0] * 2 - 1.5, Wd.npcAt[k][1] * 2 - 1.5, 3, 3); }
  for (const wp of Wd.wps) { x.fillStyle = wp.on ? '#9fe4ff' : '#888'; x.beginPath(); x.arc(wp.x * 2, wp.y * 2, 2.6, 0, TAU); x.fill(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(P.x * 2, P.y * 2, 3, 0, TAU); x.fill(); x.restore();
}
function questTracker(R, T, s) {
  const P = G.P, L = []; for (const id in QUESTS) { const q = P.q[id]; if (!q || q.s === 3) continue; const Q = QUESTS[id]; let t = Q.goal; if (q.s === 2) t = NPCDEF[Q.from].n + '에게 돌아가기'; else if (id === 'q1') t = '다리 널빤지 ' + Math.min(6, count('plank')) + '/6 → 동쪽 끊긴 다리'; else if (id === 'q2') t = '보풀이 ' + q.n + '/15'; else if (id === 'q4') t = '바람 숫돌 ' + Math.min(3, count('hone')) + '/3'; L.push([Q.n, t]); }
  if (!L.length) return; x.textAlign = 'right'; let y = T;
  for (const [n, t] of L) { x.font = `800 ${10.5 * s}px system-ui`; x.fillStyle = '#ffd166'; x.strokeStyle = 'rgba(30,24,18,.8)'; x.lineWidth = 3; x.strokeText(n, R, y + 10 * s); x.fillText(n, R, y + 10 * s); x.font = `600 ${9.5 * s}px system-ui`; x.fillStyle = '#fff'; x.strokeText(t, R, y + 23 * s); x.fillText(t, R, y + 23 * s); y += 30 * s; }
}
