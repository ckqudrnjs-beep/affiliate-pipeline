/* ---------- 3단계 직업 그리기: 덫·화살비·그물·메아리 분신·매·하늘 종·표식 ---------- */
const ELL = (ax, ay, r, k) => { x.beginPath(); x.ellipse(ax, ay, r * TW / 2 * 1.41 * (k || 1), r * TH / 2 * 1.41 * (k || 1), 0, 0, TAU); };
function drawClsGround() {
  for (const a of G.areas) {
    if (a.t < 0) continue; const [ax, ay] = iso(a.x, a.y), al = Math.min(1, a.t * 4, (a.life - a.t) * 3);
    if (a.k === 'trap') { const armed = a.arm <= 0, p = armed ? .5 + Math.sin(G.t * 5) * .2 : .3;
      x.fillStyle = `rgba(60,40,24,${.55 * al})`; x.beginPath(); x.ellipse(ax, ay, 15, 7.5, 0, 0, TAU); x.fill();
      x.strokeStyle = `rgba(200,200,210,${al})`; x.lineWidth = 1.8; x.beginPath(); x.ellipse(ax, ay, 12, 6, 0, 0, TAU); x.stroke();
      x.beginPath(); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, c = Math.cos(an), s = Math.sin(an); x.moveTo(ax + c * 12, ay + s * 6); x.lineTo(ax + c * 7, ay + s * 3.5 - 3); } x.stroke();
      x.fillStyle = `rgba(255,210,120,${p * al})`; x.beginPath(); x.arc(ax, ay, 2.6, 0, TAU); x.fill(); }
    else if (a.k === 'rain') { x.fillStyle = `rgba(90,70,40,${.16 * al})`; ELL(ax, ay, a.r); x.fill(); x.strokeStyle = `rgba(240,220,160,${.5 * al})`; x.lineWidth = 1.5; x.setLineDash([5, 5]); ELL(ax, ay, a.r); x.stroke(); x.setLineDash([]); }
    else if (a.k === 'net') { x.save(); ELL(ax, ay, a.r); x.clip(); x.strokeStyle = `rgba(232,220,176,${.75 * al})`; x.lineWidth = 1.4; const R = a.r * TW;
      x.beginPath(); for (let i = -6; i <= 6; i++) { x.moveTo(ax - R + i * 9, ay - R / 2); x.lineTo(ax + R + i * 9, ay + R / 2); x.moveTo(ax + R + i * 9, ay - R / 2); x.lineTo(ax - R + i * 9, ay + R / 2); } x.stroke(); x.restore();
      x.strokeStyle = `rgba(160,130,80,${al})`; x.lineWidth = 2; ELL(ax, ay, a.r); x.stroke(); }
    else if (a.k === 'trail') { const [bx, by] = iso(a.x1, a.y1); x.strokeStyle = `rgba(255,220,210,${.5 * al})`; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.moveTo(ax, ay - 8); x.lineTo(bx, by - 8); x.stroke(); x.strokeStyle = `rgba(255,255,255,${.7 * al})`; x.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const o = Math.sin(G.t * 20 + i * 2) * 4; x.beginPath(); x.moveTo(ax, ay - 8 + o - 6 + i * 6); x.lineTo(bx, by - 8 - o - 6 + i * 6); x.stroke(); } }
    else if (a.k === 'tremor') { x.strokeStyle = `rgba(200,170,255,${(.35 + Math.sin(G.t * 18) * .15) * al})`; x.lineWidth = 2; ELL(ax, ay, a.r * (.9 + Math.sin(G.t * 18) * .05)); x.stroke(); }
    else if (a.k === 'echo') { x.fillStyle = `rgba(180,140,255,${.22 * al})`; x.beginPath(); x.ellipse(ax, ay, 22, 11, 0, 0, TAU); x.fill(); }
    else if (a.k === 'hawk') { const sh = Math.max(.08, .3 - a.z / 400); x.fillStyle = `rgba(30,30,20,${sh})`; x.beginPath(); x.ellipse(ax, ay, 9, 4, 0, 0, TAU); x.fill(); }
    else if (a.k === 'bigbell') { const k = Math.min(1, a.t / .5); x.fillStyle = `rgba(30,20,40,${.35 * k * al})`; x.beginPath(); x.ellipse(ax, ay, 26 + k * 20, (26 + k * 20) / 2, 0, 0, TAU); x.fill(); }
  }
}
function drawEcho(a) { if (a.t < 0) return; const [sx, sy] = iso(a.x, a.y), al = Math.min(1, a.t * 3, (a.life - a.t) * 2), im = IM.ringer; if (!im) return;
  const fr = a.tick > .75 ? 8 + Math.min(3, Math.floor((1 - a.tick) * 16)) : Math.floor(G.t / .6) % 2;
  sprite(im, HC[0], HC[1], HC[2], HC[3], fr, a.dir, sx, sy - 4 - Math.sin(G.t * 3) * 3, .5, a.flash > 0 ? .1 : 0, .5 * al);
  x.globalCompositeOperation = 'lighter'; x.globalAlpha = .25 * al; x.fillStyle = '#9a7aff'; x.beginPath(); x.ellipse(sx, sy - 26, 18, 30, 0, 0, TAU); x.fill(); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
function drawHawk(a) { const [sx, sy] = iso(a.x, a.y), Y = sy - a.z, f = Math.sin(G.t * (a.dv ? 6 : 14) + a.ang) * (a.dv ? 3 : 7), al = Math.min(1, a.t * 4, (a.life - a.t) * 3); x.globalAlpha = al;
  x.fillStyle = '#7a5434'; x.strokeStyle = '#2a1a10'; x.lineWidth = 1.4;
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(sx, Y); x.quadraticCurveTo(sx + s * 9, Y - 6 - f, sx + s * 18, Y - 2 - f * 1.4); x.quadraticCurveTo(sx + s * 10, Y + 2, sx, Y + 3); x.closePath(); x.fill(); x.stroke(); }
  x.fillStyle = '#9a6a40'; x.beginPath(); x.ellipse(sx, Y + 1, 4, 7, 0, 0, TAU); x.fill(); x.stroke(); x.fillStyle = '#f0e8d8'; x.beginPath(); x.arc(sx, Y - 5, 3, 0, TAU); x.fill(); x.fillStyle = '#ffc23a'; x.beginPath(); x.moveTo(sx - 1.5, Y - 4); x.lineTo(sx + 1.5, Y - 4); x.lineTo(sx, Y - 1); x.fill(); x.globalAlpha = 1; }
function drawBell(sx, Y, w, al) { x.globalAlpha = al; const gr = x.createLinearGradient(sx - w, 0, sx + w, 0); gr.addColorStop(0, '#8a5a1a'); gr.addColorStop(.35, '#ffd27a'); gr.addColorStop(1, '#7a4a14'); x.fillStyle = gr; x.strokeStyle = '#3a2410'; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(sx - w, Y); x.quadraticCurveTo(sx - w * .82, Y - w * .2, sx - w * .62, Y - w * .9); x.quadraticCurveTo(sx - w * .5, Y - w * 1.45, sx, Y - w * 1.5); x.quadraticCurveTo(sx + w * .5, Y - w * 1.45, sx + w * .62, Y - w * .9); x.quadraticCurveTo(sx + w * .82, Y - w * .2, sx + w, Y); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#5a3a14'; x.beginPath(); x.ellipse(sx, Y, w, w * .22, 0, 0, TAU); x.fill(); x.stroke(); x.strokeStyle = 'rgba(255,240,200,.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(sx - w * .7, Y - w * .5); x.quadraticCurveTo(sx, Y - w * .38, sx + w * .7, Y - w * .5); x.stroke(); x.globalAlpha = 1; }
function drawClsAir() {
  for (const a of G.areas) {
    if (a.t < 0) continue;
    if (a.k === 'rain') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = '#6a4a2a'; x.lineWidth = 1.6; const n = a.big ? 14 : 8;
      for (let i = 0; i < n; i++) { const s = Math.floor(G.t * 12) * 31 + i * 7, rx = (hsh(s, i) - .5) * 2 * a.r, ry = (hsh(i, s) - .5) * 2 * a.r; if (rx * rx + ry * ry > a.r * a.r) continue; const [px, py] = iso(a.x + rx, a.y + ry), h = (G.t * 12 % 1) * 70;
        x.globalAlpha = .9; x.beginPath(); x.moveTo(px - 4, py - 80 + h); x.lineTo(px, py - 64 + h); x.stroke(); } x.globalAlpha = 1; }
    else if (a.k === 'hawk') drawHawk(a);
    else if (a.k === 'blade') drawBlade(a);
    else if (a.k === 'mud') { const [ax, ay] = iso(a.x, a.y), Y = ay - 18 - Math.sin(a.t / .8 * Math.PI) * 14; x.fillStyle = 'rgba(30,30,20,.25)'; x.beginPath(); x.ellipse(ax, ay, 6, 3, 0, 0, TAU); x.fill(); x.fillStyle = '#5a4026'; x.strokeStyle = '#2a1e10'; x.lineWidth = 1.5; x.beginPath(); x.arc(ax, Y, 6, 0, TAU); x.fill(); x.stroke(); x.fillStyle = '#8a6a44'; x.beginPath(); x.arc(ax - 2, Y - 2, 2, 0, TAU); x.fill(); }
    else if (a.k === 'bigbell') { const [ax, ay] = iso(a.x, a.y), k = Math.min(1, a.t / .5), al = Math.min(1, (a.life - a.t) * 2); const shake = a.t > .5 && a.t < 2 ? Math.sin(G.t * 40) * 2 : 0; drawBell(ax + shake, ay - (1 - k * k) * 320, 46, al); }
  }
  // 표식: 받는 피해가 늘어난 적
  for (const m of G.mobs) if (m.mark > 0 && !m.dead) { const [sx, sy] = iso(m.x, m.y), Y = sy - (m.D.boss ? 130 : m.D.mini ? 96 : 50) - 6, s = 6 + Math.sin(G.t * 8) * 1;
    x.globalAlpha = Math.min(1, m.mark * 2); x.fillStyle = '#ff5a4a'; x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(sx, Y - s); x.lineTo(sx + s * .8, Y); x.lineTo(sx, Y + s); x.lineTo(sx - s * .8, Y); x.closePath(); x.fill(); x.stroke(); x.globalAlpha = 1; }
}
function drawClsFx(f, k, sx, sy) {
  if (f.k === 'ghost') { const im = IM[G.P.cls]; if (im) { x.globalCompositeOperation = 'lighter'; sprite(im, HC[0], HC[1], HC[2], HC[3], f.fr, f.dir, sx, sy, .5, 0, (1 - k) * .45); x.globalCompositeOperation = 'source-over'; } return 1; }
  if (f.k === 'bellw') { x.strokeStyle = f.c; for (let i = 0; i < 2; i++) { const kk = Math.min(1, k * 1.2 + i * .2); x.globalAlpha = (1 - kk) * .9; x.lineWidth = 3 - i; ELL(sx, sy, f.r, .3 + kk * .75); x.stroke(); } x.globalAlpha = 1; return 1; }
  if (f.k === 'wave') { const gr = x.createRadialGradient(sx, sy, 0, sx, sy, f.r * TW * .71 * (.2 + k)); gr.addColorStop(0, 'rgba(255,230,160,0)'); gr.addColorStop(.85, `rgba(255,220,140,${.35 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
    x.save(); x.translate(sx, sy); x.scale(1, TH / TW); x.translate(-sx, -sy); x.fillStyle = gr; x.beginPath(); x.arc(sx, sy, f.r * TW * .71 * (.2 + k), 0, TAU); x.fill(); x.restore();
    x.strokeStyle = `rgba(255,240,200,${1 - k})`; x.lineWidth = 3; ELL(sx, sy, f.r, .2 + k); x.stroke(); return 1; }
  if (f.k === 'feather') { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + f.x, r = 6 + k * 16; x.save(); x.translate(sx + Math.cos(a) * r, sy - 4 + Math.sin(a) * r * .5 - (1 - k) * 30); x.rotate(a); x.globalAlpha = 1 - k; x.fillStyle = i % 2 ? '#d8dce4' : '#56606e'; x.beginPath(); x.ellipse(0, 0, 8, 2.4, 0, 0, TAU); x.fill(); x.restore(); } x.globalAlpha = 1; return 1; }
  if (f.k === 'snap') { x.strokeStyle = `rgba(230,230,240,${1 - k})`; x.lineWidth = 3; const o = 10 * (1 - Math.min(1, k * 3)); for (const s of [-1, 1]) { x.beginPath(); x.ellipse(sx, sy - 6 + s * o, 13, 6, 0, s < 0 ? Math.PI : 0, s < 0 ? TAU : Math.PI); x.stroke(); } return 1; }
  if (f.k === 'clang') { x.strokeStyle = `rgba(255,255,255,${1 - k})`; x.lineWidth = 2.5; x.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .2, r0 = f.r * 12 * k, r1 = f.r * 26 * (.4 + k); x.moveTo(sx + Math.cos(a) * r0, sy - 20 + Math.sin(a) * r0 * .6); x.lineTo(sx + Math.cos(a) * r1, sy - 20 + Math.sin(a) * r1 * .6); } x.stroke(); return 1; }
  return 0;
}
function drawClsHero(P, sx, sy, post) {
  if (P.buf.whirl > 0) { x.strokeStyle = post ? 'rgba(255,240,230,.85)' : 'rgba(255,200,180,.45)'; x.lineWidth = post ? 3 : 6; x.lineCap = 'round'; const R = (P.whirl ? P.whirl.r : 1.7) * 30;
    for (let i = 0; i < 2; i++) { const a0 = G.t * 16 + i * Math.PI + (post ? 0 : .5); x.beginPath(); x.ellipse(sx, sy - 16, R, R * .5, 0, a0, a0 + 1.4); x.stroke(); } }
  if (!post && P.buf.parry > 0) { x.strokeStyle = `rgba(255,216,200,${.6 + Math.sin(G.t * 20) * .3})`; x.lineWidth = 2.5; x.beginPath(); x.ellipse(sx, sy, 20, 10, 0, 0, TAU); x.stroke(); }
  if (post && P.buf.dome > 0) { const al = Math.min(1, P.buf.dome * 2) * .35; x.globalCompositeOperation = 'lighter'; drawBell(sx, sy + 6, 30, al); x.globalCompositeOperation = 'source-over'; }
  if (post && P.buf.haste > 0) { x.strokeStyle = 'rgba(255,220,200,.6)'; x.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const yy = sy - 10 - i * 12 + (G.t * 60 % 12); x.beginPath(); x.moveTo(sx - 16, yy); x.lineTo(sx - 26, yy); x.stroke(); } }
}
// 새 직업 스킬 그림(코드로 그림)
function clsIcon(g, s, cx, cy, r, c, L, col, cls) {
  const tri = (x1, y1, x2, y2, x3, y3) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill(); };
  const blade = (x1, y1, x2, y2) => { L(x1, y1, x2, y2); const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy); tri(x2, y2, x2 - dx / l * r * .4 - dy / l * r * .14, y2 - dy / l * r * .4 + dx / l * r * .14, x2 - dx / l * r * .4 + dy / l * r * .14, y2 - dy / l * r * .4 - dx / l * r * .14); };
  const bell = (bx, by, w) => { g.beginPath(); g.moveTo(bx - w, by); g.quadraticCurveTo(bx - w * .7, by - w * 1.2, bx, by - w * 1.4); g.quadraticCurveTo(bx + w * .7, by - w * 1.2, bx + w, by); g.closePath(); g.fill(); g.beginPath(); g.arc(bx, by + w * .25, w * .2, 0, TAU); g.fill(); };
  const arrow = (x1, y1, x2, y2) => { blade(x1, y1, x2, y2); L(x1, y1, x1 - r * .25, y1 - r * .05); L(x1, y1, x1 - r * .05, y1 + r * .25); };
  switch (s.id) {
    case 'slash3': for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx - r * .9 + i * r * .2, cy + r * .9 - i * r * .2, r * (1.1 + i * .1), -1.4, -.2); g.stroke(); } break;
    case 'whirl': g.beginPath(); g.arc(cx, cy, r * .95, 0, TAU * .8); g.stroke(); blade(cx, cy, cx + r * .9, cy - r * .6); blade(cx, cy, cx - r * .9, cy + r * .6); break;
    case 'dashcut': blade(cx - r * 1.1, cy + r * .5, cx + r * 1.1, cy - r * .5); g.globalAlpha = .5; L(cx - r * 1.2, cy + r * .1, cx + r * .2, cy - r * .5); L(cx - r * 1.2, cy + r * .9, cx + r * .4, cy + r * .2); g.globalAlpha = 1; break;
    case 'parry': blade(cx - r, cy + r, cx + r * .8, cy - r * .8); blade(cx + r, cy + r, cx - r * .8, cy - r * .8); g.beginPath(); g.arc(cx, cy, r * .25, 0, TAU); g.fill(); break;
    case 'mark': g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r * .8, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * .8, cy); g.closePath(); g.stroke(); blade(cx - r * 1.2, cy + r * 1.2, cx + r * .1, cy - r * .1); break;
    case 'shadow': g.globalAlpha = .45; blade(cx - r * 1.1, cy + r * .2, cx + r * .2, cy - r * 1.1); g.globalAlpha = .7; blade(cx - r * .8, cy + r * .6, cx + r * .5, cy - r * .7); g.globalAlpha = 1; blade(cx - r * .4, cy + r, cx + r * .9, cy - r * .3); break;
    case 'pshot': arrow(cx - r * 1.1, cy + r * .9, cx + r * 1.1, cy - r * .9); g.beginPath(); g.arc(cx, cy, r * .3, 0, TAU); g.stroke(); break;
    case 'rain': for (let i = 0; i < 4; i++) { const ax = cx - r * .9 + i * r * .6; arrow(ax - r * .2, cy - r * 1.1 + (i % 2) * r * .3, ax + r * .15, cy + r * .2 + (i % 2) * r * .3); } g.fillRect(cx - r * 1.2, cy + r * .9, r * 2.4, r * .15); break;
    case 'trap': g.beginPath(); g.ellipse(cx, cy + r * .3, r, r * .45, 0, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { const a = Math.PI + i / 5 * Math.PI, px = cx + Math.cos(a) * r * .9; tri(px - r * .12, cy + r * .2, px + r * .12, cy + r * .2, px, cy - r * .35); } break;
    case 'net': g.lineWidth = r * .12; for (let i = -2; i <= 2; i++) { L(cx - r + i * r * .45, cy - r, cx + r + i * r * .45, cy + r); L(cx + r + i * r * .45, cy - r, cx - r + i * r * .45, cy + r); } break;
    case 'roll': g.beginPath(); g.arc(cx + r * .3, cy, r * .8, -2.4, 1.6); g.stroke(); tri(cx - r * .5, cy - r * .9, cx - r * .1, cy - r * .3, cx - r, cy - r * .3); arrow(cx - r * .1, cy + r * .1, cx + r * 1.2, cy - r * .5); break;
    case 'hawk': g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx - r * .6, cy - r * .9, cx - r * 1.3, cy - r * .4); g.quadraticCurveTo(cx - r * .6, cy + r * .1, cx, cy + r * .3); g.quadraticCurveTo(cx + r * .6, cy + r * .1, cx + r * 1.3, cy - r * .4); g.quadraticCurveTo(cx + r * .6, cy - r * .9, cx, cy); g.fill(); g.beginPath(); g.ellipse(cx, cy + r * .4, r * .25, r * .6, 0, 0, TAU); g.fill(); break;
    case 'toll': bell(cx + r * .3, cy + r * .7, r * .7); L(cx - r * 1.1, cy - r * 1.1, cx - r * .1, cy - r * .1); g.fillRect(cx - r * 1.35, cy - r * 1.35, r * .55, r * .45); break;
    case 'wave': for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(cx, cy + r * .2, r * (.4 + i * .38), r * (.2 + i * .2), 0, 0, TAU); g.stroke(); } break;
    case 'echo': g.globalAlpha = .45; bell(cx - r * .45, cy + r * .6, r * .6); g.globalAlpha = 1; bell(cx + r * .35, cy + r * .8, r * .7); break;
    case 'resound': bell(cx, cy + r * .5, r * .65); for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(cx, cy, r * (.95 + i * .35), sd < 0 ? Math.PI - .5 : -.5, sd < 0 ? Math.PI + .5 : .5); g.stroke(); } break;
    case 'clang': for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; L(cx + Math.cos(a) * r * .35, cy + Math.sin(a) * r * .35, cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2); } g.beginPath(); g.arc(cx, cy, r * .3, 0, TAU); g.fill(); break;
    case 'dome': g.globalAlpha = .5; bell(cx, cy + r * 1, r * 1.1); g.globalAlpha = 1; g.beginPath(); g.arc(cx, cy + r * .1, r * .3, 0, TAU); g.fill(); g.fillRect(cx - r * .2, cy + r * .35, r * .4, r * .6); break;
    case 'ult': if (cls === 'drifter') { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3; blade(cx + Math.cos(a) * r * .3, cy + Math.sin(a) * r * .3, cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2); } }
      else if (cls === 'trapper') { g.beginPath(); g.arc(cx, cy, r * 1.05, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.arc(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05, r * .17, 0, TAU); g.fill(); } arrow(cx - r * .3, cy - r * .6, cx + r * .2, cy + r * .5); }
      else { bell(cx, cy + r * .9, r * 1.05); g.globalAlpha = .6; for (let i = 0; i < 3; i++) L(cx - r * .6 + i * r * .6, cy - r * 1.4, cx - r * .6 + i * r * .6, cy - r * .9); g.globalAlpha = 1; } break;
  }
}
