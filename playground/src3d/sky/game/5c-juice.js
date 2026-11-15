/* ---------- 손맛: 무기별 휘두르기 · 기술 시전 문양 · 처치 임팩트 · 적 움직임 ---------- */
const CLSC = { warden: '#ffd8a0', drifter: '#ffe6e6', windcaller: '#9fe4ff', trapper: '#c8f0a0', ringer: '#e8d0ff' };
const HERO_SC = .62; // 캐릭터 크기(아틀라스 2배 → 1배는 .5)
// 들고 있는 무기 등급 색(보통이면 흰빛)
function weaponCol(P) { const w = P.eq.weapon; return w && !w.g && w.r >= 1 ? RAR[w.r].c : w && w.en >= 7 ? '#ffd166' : '#fff8e1'; }
// 기본 공격: 무기마다 다른 궤적
function basicFx(P, ax, ay, m) {
  const c = weaponCol(P);
  if (P.cls === 'warden') { // 창: 찌르기 선 + 창끝 번쩍
    G.fx.push({ k: 'thrust2', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.9, t: 0, life: .18, c });
  } else if (P.cls === 'drifter') { // 쌍칼: 엇갈린 두 번 베기
    G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.45, t: 0, life: .18, s: 0, c }, { k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.3, t: -.06, life: .18, s: 1, c });
  } else if (P.cls === 'ringer') { // 망치: 무거운 반원 + 땅 먼지
    G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.5, t: 0, life: .26, s: P.combo % 2, c, heavy: 1 });
    if (m) { G.fx.push({ k: 'dustring', x: m.x, y: m.y, r: 1, t: 0, life: .35 }); G.shake = Math.max(G.shake, 2.5); }
  } else G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.5, t: 0, life: .2, s: P.combo % 2, c });
}
// 원거리 기본 공격: 쏘는 자리 번쩍
function muzzleFx(P, ax, ay) { G.fx.push({ k: 'muzzle', x: P.x + ax * .5, y: P.y + ay * .5, dx: ax, dy: ay, t: 0, life: .14, c: P.cls === 'trapper' ? '#fff0c0' : '#dff4ff' }); }
// 기술 쓸 때 발밑 문양
function castGlyph(P, s) { const c = CLSC[P.cls] || '#fff'; G.fx.push({ k: 'glyph', x: P.x, y: P.y, t: 0, life: .55, c, big: !!s.cd && s.cd >= 8 });
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, r = rnd(.3, .9); G.parts.push({ k: 'puff', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, z: 2, vx: 0, vy: 0, vz: rnd(80, 170), t: 0, life: rnd(.4, .7), c, s: rnd(1.4, 2.4) }); } }
// 처치 임팩트: 하얗게 번쩍 → 별 모양 터짐 + 땅 충격파 + 위로 튀는 조각
function killFx(m) { const D = m.D, big = D.boss ? 2.4 : D.mini ? 1.6 : m.elite ? 1.3 : 1, hz = D.boss ? 60 : D.mini ? 44 : 22;
  m.flash = .3; m.kpop = 1; G.hitstop = Math.max(G.hitstop, D.boss ? .22 : D.mini ? .12 : .065); G.shake = Math.max(G.shake, 2 + big * 2);
  G.fx.push({ k: 'kill', x: m.x, y: m.y, z: hz, t: 0, life: .32 + big * .06, s: big }, { k: 'dustring', x: m.x, y: m.y, r: .8 * big, t: 0, life: .4 });
  const dx = m.x - G.P.x, dy = m.y - G.P.y, a0 = Math.atan2(dy, dx); for (let i = 0; i < 8 * big; i++) { const a = a0 + rnd(-.9, .9), sp = rnd(3, 8); G.parts.push({ k: 'spark', x: m.x, y: m.y, z: hz, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 260), t: 0, life: rnd(.2, .4), c: i % 2 ? '#ffffff' : '#ffe8b0', s: 2.6 }); } }
// 새 효과 그리기. 처리했으면 true
function drawJuiceFx(f, k, sx, sy) {
  if (f.k === 'thrust2') { const [ex, ey] = iso(f.x + f.dx * f.len * (.5 + k * .5), f.y + f.dy * f.len * (.5 + k * .5)); x.save(); x.lineCap = 'round'; x.globalAlpha = 1 - k;
    x.strokeStyle = f.c; x.lineWidth = 9 * (1 - k) + 1; x.globalAlpha = (1 - k) * .35; x.beginPath(); x.moveTo(sx, sy - 22); x.lineTo(ex, ey - 22); x.stroke();
    x.globalAlpha = 1 - k; x.strokeStyle = '#fff'; x.lineWidth = 3 * (1 - k) + 1; x.beginPath(); x.moveTo(sx, sy - 22); x.lineTo(ex, ey - 22); x.stroke();
    x.fillStyle = f.c; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = (i % 2 ? 3 : 10) * (1 - k * .6); x.lineTo(ex + Math.cos(a) * r, ey - 22 + Math.sin(a) * r * .7); } x.closePath(); x.fill(); x.restore(); return true; }
  if (f.k === 'muzzle') { const [ex, ey] = iso(f.dx, f.dy), a = Math.atan2(ey, ex); x.save(); x.translate(sx, sy - 22); x.rotate(a); x.globalAlpha = 1 - k; x.fillStyle = f.c; x.beginPath(); x.moveTo(0, -5 * (1 - k)); x.lineTo(18 * (1 - k * .3), 0); x.lineTo(0, 5 * (1 - k)); x.lineTo(-4, 0); x.closePath(); x.fill(); x.restore(); return true; }
  if (f.k === 'dustring') { x.globalAlpha = (1 - k) * .7; x.fillStyle = 'rgba(160,130,90,.55)'; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = f.r * 30 * (.4 + k * .8); x.beginPath(); x.arc(sx + Math.cos(a) * r, sy + Math.sin(a) * r * .5 - k * 6, 5 * (1 - k * .5), 0, TAU); x.fill(); } x.globalAlpha = 1; return true; }
  if (f.k === 'glyph') { const R = (f.big ? 34 : 26) * (.6 + Math.min(1, k * 3) * .4); x.save(); x.translate(sx, sy); x.scale(1, .5); x.rotate(k * 2.5); x.globalAlpha = (1 - k) * .9; x.strokeStyle = f.c; x.shadowColor = f.c; x.shadowBlur = 10;
    x.lineWidth = 2.2; x.beginPath(); x.arc(0, 0, R, 0, TAU); x.stroke(); x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, R * .72, 0, TAU); x.stroke();
    x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.moveTo(Math.cos(a) * R * .72, Math.sin(a) * R * .72); x.lineTo(Math.cos(a + 2.1) * R * .72, Math.sin(a + 2.1) * R * .72); } x.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.fillStyle = f.c; x.fillRect(Math.cos(a) * R * .86 - 1.5, Math.sin(a) * R * .86 - 1.5, 3, 3); } x.restore(); return true; }
  if (f.k === 'kill') { const Y = sy - f.z, s = f.s; x.save(); x.globalCompositeOperation = 'lighter';
    const gl = x.createRadialGradient(sx, Y, 0, sx, Y, 40 * s); gl.addColorStop(0, 'rgba(255,250,230,.95)'); gl.addColorStop(1, 'rgba(255,200,120,0)'); x.globalAlpha = (1 - k) * .8; x.fillStyle = gl; x.beginPath(); x.arc(sx, Y, 40 * s, 0, TAU); x.fill();
    x.globalAlpha = 1 - k; x.strokeStyle = '#fff'; x.lineCap = 'round'; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + f.x, r0 = 8 * s + k * 20 * s, r1 = r0 + (18 - k * 14) * s; x.lineWidth = (i % 2 ? 2 : 3.5) * (1 - k) + .5; x.beginPath(); x.moveTo(sx + Math.cos(a) * r0, Y + Math.sin(a) * r0 * .7); x.lineTo(sx + Math.cos(a) * r1, Y + Math.sin(a) * r1 * .7); x.stroke(); }
    x.restore(); x.globalAlpha = 1; return true; }
  return false;
}
// 적 움직임: 걷는 것은 통통 튀고 몸이 눌렸다 늘어나고, 나는 것은 위아래로 떠다니고, 공격할 땐 앞으로 덤빔
function mobMotion(m) { const D = m.D, P = G.P; let oy = 0, ox = 0, scx = 1, scy = 1, rot = 0;
  if (m.dead) { const t = m.at; if (m.kpop && !m.fl) { const u = Math.min(1, t / .28); oy = -Math.sin(u * Math.PI) * (D.big ? 6 : 16); scx = 1 + Math.max(0, t - .28) * .9; scy = Math.max(.35, 1 - Math.max(0, t - .28) * 1.6); } return [ox, oy, scx, scy, rot]; }
  if (D.fly) { oy = -6 - Math.sin(G.t * 4.2 + m.id) * 5; rot = Math.sin(G.t * 3 + m.id) * .05; }
  else if (m.an === 'move') { const ph = (m.at * (D.big ? 5 : 9) + m.id) * Math.PI, h = Math.abs(Math.sin(ph)); oy = -h * (D.big ? 3 : 6); scx = 1 + (1 - h) * .07; scy = 1 - (1 - h) * .07 + h * .05; rot = Math.sin(ph) * (D.big ? .03 : .07);
    if ((1 - h) > .92 && !m.dust && !D.big || D.big && (1 - h) > .97 && !m.dust) { m.dust = 1; for (let i = 0; i < (D.big ? 4 : 2); i++) G.parts.push({ k: 'dust', x: m.x + rnd(-.2, .2), y: m.y + rnd(-.2, .2), z: 2, vx: rnd(-.6, .6), vy: rnd(-.6, .6), vz: rnd(20, 50), t: 0, life: .45, c: 'rgba(170,150,110,.45)', s: D.big ? 6 : 3.5 }); } else if ((1 - h) < .5) m.dust = 0; }
  else { const b = Math.sin(G.t * 2.4 + m.id); scy = 1 + b * .025; scx = 1 - b * .015; }
  if (m.an === 'atk' && !D.big) { const w = Math.min(1, m.at / .35), l = Math.sin(w * Math.PI) * 9, dx = P.x - m.x, dy = P.y - m.y, d = hyp(dx, dy) || 1, [ix, iy] = iso(dx / d, dy / d); ox = ix * l * .25; oy += iy * l * .25 - Math.sin(w * Math.PI) * 3; scy *= 1 + Math.sin(w * Math.PI) * .08; }
  if (m.an === 'hurt') { rot += Math.sin(m.at * 40) * .06; }
  return [ox, oy, scx, scy, rot]; }
// 마을 건물 표시(창고·우물): 가까이 가면 떠 있는 이름표
function drawTownMarks() { const Wd = G.Wd, P = G.P; for (const [p, s] of [[Wd.stashAt, '🏠 창고'], [Wd.wellAt, '💧 우물']]) { if (!p) continue; const d = hyp(P.x - p[0], P.y - p[1]); if (d > 6) continue; const [sx, sy] = iso(p[0], p[1]), yy = sy - 46 + Math.sin(G.t * 3) * 3; x.globalAlpha = clamp((6 - d) / 2, 0, 1); x.font = '800 11px system-ui'; x.textAlign = 'center'; const w = x.measureText(s).width + 12; x.fillStyle = 'rgba(30,24,18,.7)'; rr(sx - w / 2, yy - 12, w, 17, 6); x.fill(); x.fillStyle = '#ffe9b0'; x.fillText(s, sx, yy + 1); x.globalAlpha = 1; } }
