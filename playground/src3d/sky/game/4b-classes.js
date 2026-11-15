/* ---------- 3단계 직업: 떠돌이 검객 · 덫사냥꾼 · 종지기 (스킬·궁극기·지속 효과) ---------- */
// 공통 도움
function coneMobs(P, fx, fy, r, arc) { return mobsIn(m => { const rx = m.x - P.x, ry = m.y - P.y, d = hyp(rx, ry); if (d > r + m.r) return false; const a = Math.acos(clamp((rx * fx + ry * fy) / (d || 1), -1, 1)); return a < arc / 2 || d < .6; }); }
function later(t, fn) { G.areas.push({ k: 'delay', t: -t, fn }); }
function ghost(P) { G.fx.push({ k: 'ghost', x: P.x, y: P.y, dir: P.dir, fr: heroFrame(P), t: 0, life: .35 }); }
// 종소리 파동: 둘레를 한 번 때림
function ringWave(x2, y2, r, mult, o) {
  o = o || {}; const P = G.P; G.fx.push({ k: 'bellw', x: x2, y: y2, r, t: 0, life: .45, c: o.col || '#e8d0ff' });
  for (const m of mobsIn(m => hyp(m.x - x2, m.y - y2) < r + m.r)) { const [d, c] = rollDmg(P, m, mult); hitMob(m, d, c, { kb: o.kb || 0, stun: o.stun ? (m.D.big ? o.stun * .4 : o.stun) : 0, fx: x2, fy: y2, col: '#e8d0ff', tick: o.tick }); if (o.mark && !m.dead) { m.mark = Math.max(m.mark || 0, o.mark); m.markP = Math.max(m.markP || 0, o.markP || .2); } }
}
function slashAround(P, r, mult, o) { o = o || {}; G.fx.push({ k: 'ring', x: P.x, y: P.y, r, t: 0, life: .3, c: '#ffd8c8' }, { k: 'slash', x: P.x, y: P.y, dx: 1, dy: 0, len: r, t: 0, life: .22, s: 0 }, { k: 'slash', x: P.x, y: P.y, dx: -1, dy: 0, len: r, t: 0, life: .22, s: 1 });
  for (const m of mobsIn(m => hyp(m.x - P.x, m.y - P.y) < r + m.r)) { const [d, c] = rollDmg(P, m, mult); hitMob(m, d, c, { kb: o.kb || 1.5, col: '#ffb8a0' }); } }
function markMob(m, t, p) { m.mark = Math.max(m.mark || 0, t); m.markP = Math.max(m.markP || 0, p); }
// 표식 옮기기(검객 약점 찌르기 갈래 B)
function markMove(m) { const n = nearestMob(m.x, m.y, 5); if (!n) return; markMob(n, 6, .3); n.markT = 1; G.fx.push({ k: 'zap', x: m.x, y: m.y, x2: n.x, y2: n.y, t: 0, life: .3, c: '#ff8a7a' }); }
function placeTrap(x2, y2, mult, fk, arm) {
  const tr = G.areas.filter(a => a.k === 'trap'); if (tr.length >= 3 + (arm === 0 ? 6 : 0)) tr[0].t = tr[0].life;
  G.areas.push({ k: 'trap', x: x2, y: y2, t: 0, life: 20, mult, fk, arm: arm ?? .4 }); G.fx.push({ k: 'ring', x: x2, y: y2, r: .7, t: 0, life: .3, c: '#e8d8a0' });
}
function shootArrow(P, m, mult, o) { o = o || {}; let ax, ay; if (m) { const dx = m.x - P.x, dy = m.y - P.y, l = hyp(dx, dy) || 1; ax = dx / l; ay = dy / l; } else [ax, ay] = facingW(P);
  if (o.rot) { const c = Math.cos(o.rot), s = Math.sin(o.rot); [ax, ay] = [ax * c - ay * s, ax * s + ay * c]; }
  G.proj.push({ k: 'arrow', x: P.x + ax * .4, y: P.y + ay * .4, vx: ax * 16, vy: ay * 16, life: .6, mult, pierce: o.pierce, kb: o.kb || 0, hit: new Set() }); sfx('shoot'); }

// 스킬 종류별 동작 (castSkill 이 부름)
const CSKS = { combo: 'line', whirl: 'nova', dashcut: 'dodge', parry: 'buff', mark: 'line', shadow: 'dodge', pshot: 'shoot', rain: 'shoot', trap: 'block', net: 'cone', roll: 'dodge', hawk: 'flag', toll: 'slam', wave: 'bell', echo: 'bell', resound: 'bell', clang: 'block', dome: 'buff' };
const CSK = {
  combo({ P, s, fk, D }) { const n = fk === 0 ? 4 : 3, r = s.r * (fk === 1 ? 1.3 : 1), arc = s.arc * (fk === 1 ? 1.25 : 1); P.atkDur = .12 * n + .1;
    for (let h = 0; h < n; h++) later(h * .12, () => { const [ax, ay] = facingW(P), big = fk === 0 && h === 3; P.an = 'atk'; P.at = 0;
      G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: r * (big ? 1.25 : 1), t: 0, life: .2, s: h % 2 }); if (big) G.shake = Math.max(G.shake, 5);
      for (const m of coneMobs(P, ax, ay, r, arc)) { const [d, c] = D(m, big ? 2.5 : 1); hitMob(m, d, c, { kb: big ? 4 : .8, bleed: fk === 1 ? d * .12 : 0, col: '#ffb8a0' }); } sfx('line'); }); },
  whirl({ P, s, fk, mult }) { P.buf.whirl = fk === 0 ? 2 : s.dur; P.whirl = { t: 0, mult, r: s.r, pull: fk === 1 }; },
  dashcut({ P, s, fk, fx, fy, mult }) { const sp = 15, T = s.len / sp, x0 = P.x, y0 = P.y; ghost(P); P.dash = { vx: fx * sp, vy: fy * sp, t: T, hit: new Set(), mult }; P.inv0 = Math.max(P.inv0, T + .1); P.an = 'atk'; P.at = 0;
    G.fx.push({ k: 'thrust', x: x0, y: y0, dx: fx, dy: fy, len: s.len, t: 0, life: .3 });
    if (fk === 1) later(T, () => G.areas.push({ k: 'trail', x: x0, y: y0, x1: P.x, y1: P.y, t: 0, life: 2, tick: 0, mult: mult * .3 }));
    if (fk === 0) later(T + .35, () => { ghost(P); P.dash = { vx: -fx * sp, vy: -fy * sp, t: T, hit: new Set(), mult: mult * .8 }; P.inv0 = Math.max(P.inv0, T + .1); P.an = 'atk'; P.at = 0; G.fx.push({ k: 'thrust', x: P.x, y: P.y, dx: -fx, dy: -fy, len: s.len, t: 0, life: .3 }); }); },
  parry({ P, s, fk, mult }) { P.buf.parry = s.dur; P.parry = { mult, fk }; P.an = 'cast'; P.atkDur = .5; G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .5, c: '#ffd8c8' }); },
  mark({ P, s, fk, t, fx, fy, D }) { const m = t && hyp(t.x - P.x, t.y - P.y) < 3 ? t : nearestMob(P.x, P.y, 3);
    G.fx.push({ k: 'thrust', x: P.x, y: P.y, dx: fx, dy: fy, len: 2, t: 0, life: .22 }); if (!m) return;
    const [d, c] = D(m); hitMob(m, d, c, { kb: 1, bleed: fk === 0 ? d * .2 : 0, col: '#ff8a7a' }); if (!m.dead) { markMob(m, s.dur, .3); m.markT = fk === 1 ? 1 : 0; if (fk === 0) m.bleed = { t: s.dur, d: d * .2 }; } },
  shadow({ P, s, fk, mult }) { const n = fk === 0 ? 7 : s.jumps, hit = new Set(); P.inv0 = Math.max(P.inv0, n * .14 + .4);
    for (let j = 0; j < n; j++) later(j * .14, () => { const m = nearestMob(P.x, P.y, 6, hit); if (!m) return; hit.add(m); ghost(P);
      const dx = m.x - P.x, dy = m.y - P.y, l = hyp(dx, dy) || 1, nx = m.x + dx / l * .5, ny = m.y + dy / l * .5; if (canAt(P, nx, ny)) { P.x = nx; P.y = ny; } aimAt(P, m); P.an = 'atk'; P.at = 0;
      G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: -dx / l, dy: -dy / l, len: 1.4, t: 0, life: .2, s: j % 2 }); const [d, c] = rollDmg(P, m, mult); hitMob(m, d, c, { kb: 1, col: '#c8a0ff' }); sfx('line'); });
    if (fk === 1) later(n * .14 + .1, () => { G.shake = 8; slashAround(P, 2.4, mult * 2.5, { kb: 4 }); }); },
  pshot({ P, fk, t, mult }) { const n = fk === 0 ? 3 : 1; for (let j = 0; j < n; j++) shootArrow(P, t, mult * (n > 1 ? .7 : fk === 1 ? 1.3 : 1), { pierce: 1, kb: fk === 1 ? 5 : 0, rot: (j - (n - 1) / 2) * .22 }); },
  rain({ P, s, fk, t, fx, fy, mult }) { const tx = t ? t.x : P.x + fx * 4, ty = t ? t.y : P.y + fy * 4; P.an = 'cast'; G.areas.push({ k: 'rain', x: tx, y: ty, r: s.r * (fk === 0 ? 1.4 : 1), t: 0, life: fk === 1 ? 3 : s.dur, tick: .15, mult }); },
  trap({ P, fk, mult }) { P.an = 'cast'; placeTrap(P.x, P.y, mult, fk); },
  net({ P, s, fk, t, fx, fy, mult }) { const tx = t ? t.x : P.x + fx * 3.5, ty = t ? t.y : P.y + fy * 3.5; P.an = 'cast'; G.fx.push({ k: 'zap', x: P.x, y: P.y, x2: tx, y2: ty, t: 0, life: .2, c: '#e8dcb0' });
    later(.15, () => { G.areas.push({ k: 'net', x: tx, y: ty, r: s.r, t: 0, life: 4, tick: .5, fk, mult }); for (const m of mobsIn(m => hyp(m.x - tx, m.y - ty) < s.r + m.r)) { const st = fk === 0 ? 2.5 : 1; hitMob(m, Math.max(1, Math.round(rollDmg(P, m, mult)[0])), false, { stun: m.D.big ? st * .4 : st, slow: 4, tick: 1 }); } }); },
  roll({ P, fk, t, fx, fy, mult }) { const x0 = P.x, y0 = P.y; ghost(P); P.dodge = .28; P.dvx = -fx * 11; P.dvy = -fy * 11; P.an = 'dodge'; P.at = 0;
    if (fk === 0) placeTrap(x0, y0, mult * 1.3, null);
    const n = fk === 1 ? 3 : 1; for (let j = 0; j < n; j++) later(.12 + j * .1, () => { const m = t && !t.dead ? t : nearestMob(P.x, P.y, 8); shootArrow(P, m, mult * (n > 1 ? .8 : 1)); }); },
  hawk({ P, s, fk, mult }) { const n = fk === 0 ? 2 : 1; P.an = 'cast'; for (let j = 0; j < n; j++) G.areas.push({ k: 'hawk', x: P.x, y: P.y, z: 60, ang: j * Math.PI, t: 0, life: s.dur, tick: .6 + j * .5, mult, fk }); },
  toll({ P, s, fk, fx, fy, mult }) { const cx = P.x + fx * 1.1, cy = P.y + fy * 1.1; P.atkDur = .4;
    later(.14, () => { G.shake = Math.max(G.shake, 4); ringWave(cx, cy, s.r, mult, { kb: 1.5 }); G.fx.push({ k: 'crack', x: cx, y: cy, t: 0, life: .9 }); if (fk === 0) G.areas.push({ k: 'tremor', x: cx, y: cy, r: s.r, t: 0, life: 3, tick: .5, mult: mult * .25 }); });
    if (fk === 1) later(.45, () => { P.an = 'atk'; P.at = 0; G.shake = Math.max(G.shake, 4); ringWave(cx, cy, s.r * .7, mult * .8, { kb: 2 }); sfx('slam'); }); },
  wave({ P, s, fk, mult }) { const n = fk === 0 ? 3 : 1, r = s.r * (fk === 1 ? 1.5 : 1); for (let h = 0; h < n; h++) later(h * .28, () => { ringWave(P.x, P.y, r, mult * (n > 1 ? .6 : 1), { kb: 3 }); G.fx.push({ k: 'wave', x: P.x, y: P.y, r, t: 0, life: .5 }); if (h) sfx('bell'); }); },
  echo({ P, s, fk, fx, fy, mult }) { const n = fk === 0 ? 2 : 1; for (let j = 0; j < n; j++) { const side = n > 1 ? (j ? 1 : -1) : 0, ex = P.x - fy * side * 1.2 + fx * (n > 1 ? .3 : 1), ey = P.y + fx * side * 1.2 + fy * (n > 1 ? .3 : 1), ok = canAt(P, ex, ey);
    G.areas.push({ k: 'echo', x: ok ? ex : P.x, y: ok ? ey : P.y, dir: P.dir, t: 0, life: s.dur, tick: .5, mult, fk }); G.fx.push({ k: 'bellw', x: ok ? ex : P.x, y: ok ? ey : P.y, r: 1.2, t: 0, life: .5, c: '#c9a8ff' }); } },
  resound({ P, s, fk, mult }) { const o = { stun: fk === 0 ? 1 : 0, kb: 2 }; ringWave(P.x, P.y, s.r, mult, o); for (const a of G.areas) if (a.k === 'echo' && a.t < a.life) { ringWave(a.x, a.y, s.r, mult, o); if (fk === 1) a.life += 3; a.flash = .3; } },
  clang({ P, s, fk, mult }) { G.fx.push({ k: 'clang', x: P.x, y: P.y, r: s.r, t: 0, life: .4 }); ringWave(P.x, P.y, s.r, mult, { stun: fk === 0 ? 2.5 : 1.5, mark: fk === 1 ? 6 : 0, markP: .2, col: '#ffffff' }); },
  dome({ P, s }) { P.buf.dome = s.dur; G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .6, c: '#ffd27a' }); },
};

// 궁극 기술
const ULTF = {
  drifter(P, t, fx, fy, mult) { const x0 = P.x, y0 = P.y; P.inv0 = 2.8; G.flash = .25;
    for (let j = 0; j < 12; j++) later(j * .2, () => { const cands = mobsIn(m => hyp(m.x - x0, m.y - y0) < 5); const m = cands.length ? pick(cands) : null; ghost(P);
      if (m) { const a = Math.random() * TAU, nx = m.x + Math.cos(a) * .7, ny = m.y + Math.sin(a) * .7; if (canAt(P, nx, ny)) { P.x = nx; P.y = ny; } aimAt(P, m); }
      P.an = 'atk'; P.at = 0; const [ax, ay] = facingW(P); G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.6, t: 0, life: .22, s: j % 2 }); sfx('line');
      for (const o of mobsIn(o => hyp(o.x - P.x, o.y - P.y) < 1.6 + o.r)) { const [d, c] = rollDmg(P, o, mult * .35); hitMob(o, d, c, { kb: 1.2, col: '#ffb8a0' }); } });
    later(2.5, () => { G.shake = 10; G.flash = .2; slashAround(P, 2.6, mult * .8, { kb: 6 }); }); },
  trapper(P, t, fx, fy, mult) { P.an = 'cast'; P.at = 0; P.atkDur = .5; for (let j = 0; j < 6; j++) { const a = j / 6 * TAU, tx = P.x + Math.cos(a) * 2.6, ty = P.y + Math.sin(a) * 2.6; if (canAt(P, tx, ty)) placeTrap(tx, ty, mult * .5, 0, 0); }
    G.areas.push({ k: 'rain', x: P.x, y: P.y, r: 4.2, t: 0, life: 3, tick: .2, mult: mult * .12, big: 1 }); },
  ringer(P, t, fx, fy, mult) { const tx = t ? t.x : P.x + fx * 3, ty = t ? t.y : P.y + fy * 3; P.an = 'cast'; P.at = 0; P.atkDur = .6;
    G.areas.push({ k: 'bigbell', x: tx, y: ty, t: 0, life: 2.4 });
    later(.5, () => { G.shake = 16; G.hitstop = .12; G.flash = .3; sfx('slam'); sfx('bell'); G.fx.push({ k: 'crack', x: tx, y: ty, t: 0, life: 2.4 }, { k: 'wave', x: tx, y: ty, r: 4.2, t: 0, life: .6 }); ringWave(tx, ty, 4.2, mult, { kb: 6, stun: 2 }); });
    for (let h = 1; h <= 3; h++) later(.5 + h * .5, () => { sfx('bell'); G.fx.push({ k: 'wave', x: tx, y: ty, r: 3.5, t: 0, life: .5 }); ringWave(tx, ty, 3.5, mult * .35, { kb: 2 }); }); },
};

// 맞을 때: 흘려 받기
function parryHit(P, src) { const o = P.parry || { mult: 2.5 }; P.buf.parry = 0; P.inv0 = Math.max(P.inv0, .5); G.hitstop = .09; G.flash = .12; sfx('block');
  G.txt.push({ x: P.x, y: P.y, z: 1.6, t: 0, s: '흘림!', c: '#ffd8c8', pop: 1 }); P.an = 'atk'; P.at = 0;
  const n = o.fk === 0 ? 3 : 1; for (let h = 0; h < n; h++) later(h * .13, () => slashAround(P, 2.2, o.mult, { kb: 3 }));
  if (o.fk === 1) { P.buf.haste = 5; calc(P); } }

// 매 프레임: 지속 스킬
function clsUpdate(P, dt) {
  if (P.buf.whirl > 0 && P.whirl) { const W = P.whirl; W.t -= dt; if (W.t <= 0) { W.t = .2; G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: Math.cos(G.t * 9), dy: Math.sin(G.t * 9), len: W.r, t: 0, life: .2, s: 0 });
    for (const m of mobsIn(m => hyp(m.x - P.x, m.y - P.y) < W.r + m.r)) { const [d, c] = rollDmg(P, m, W.mult); hitMob(m, d, c, { kb: W.pull ? 0 : .6, tick: 1 }); } sfx('line'); }
    if (W.pull) for (const m of mobsIn(m => !m.D.big && hyp(m.x - P.x, m.y - P.y) < W.r + 1.5)) move(m, (P.x - m.x) * dt * 2.2, (P.y - m.y) * dt * 2.2); }
}
// 지역 효과(areaUpdate 가 부름). true 면 처리 끝
function clsArea(a, dt) {
  const P = G.P;
  if (a.k === 'trail') { a.tick -= dt; if (a.tick <= 0) { a.tick = .3; for (const m of mobsIn(m => segD(m.x, m.y, a.x, a.y, a.x1, a.y1) < .7 + m.r)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c, { tick: 1 }); } } return 1; }
  if (a.k === 'rain') { a.tick -= dt; if (a.tick <= 0) { a.tick = .2; for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r + m.r)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c, { tick: 1 }); } } return 1; }
  if (a.k === 'trap') { a.arm -= dt; if (a.arm > 0) return 1; const m = G.mobs.find(m => !m.dead && !m.fl && hyp(m.x - a.x, m.y - a.y) < .7 + m.r); if (!m) return 1;
    a.t = a.life; const st = a.fk === 1 ? 3.5 : 2; const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c, { stun: m.D.big ? .8 : st, col: '#e8d8a0' }); if (a.fk === 1) m.slow = Math.max(m.slow, st + 3);
    G.fx.push({ k: 'snap', x: a.x, y: a.y, t: 0, life: .4 }); sfx('block'); if (a.fk === 0) ringWave(a.x, a.y, 1.8, a.mult * .6, { kb: 2, col: '#ffd27a' }); return 1; }
  if (a.k === 'net') { if (a.fk === 1) { a.tick -= dt; if (a.tick <= 0) { a.tick = .5; for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r + m.r)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c, { tick: 1 }); } } } return 1; }
  if (a.k === 'hawk') { if (a.dv) { const D = a.dv; D.t += dt; const k = Math.min(1, D.t / .3); if (!D.m.dead) { D.x1 = D.m.x; D.y1 = D.m.y; } a.x = lerp(D.x0, D.x1, k); a.y = lerp(D.y0, D.y1, k); a.z = lerp(60, 14, k);
      if (k >= 1 && !D.done) { D.done = 1; if (!D.m.dead) { const [d, c] = rollDmg(P, D.m, a.mult); hitMob(D.m, d, c, { kb: 1, col: '#ffe0a0', fx: a.x - .3, fy: a.y - .3 }); if (a.fk === 1 && !D.m.dead) markMob(D.m, 4, .2); } }
      if (D.t > .55) a.dv = null; return 1; }
    a.ang += dt * 2.4; const tx = P.x + Math.cos(a.ang) * 1.4, ty = P.y + Math.sin(a.ang) * 1.4; a.x += (tx - a.x) * Math.min(1, dt * 5); a.y += (ty - a.y) * Math.min(1, dt * 5); a.z += (60 - a.z) * Math.min(1, dt * 4);
    a.tick -= dt; if (a.tick <= 0) { a.tick = 1; const m = nearestMob(P.x, P.y, 7); if (m) a.dv = { m, t: 0, x0: a.x, y0: a.y, x1: m.x, y1: m.y }; } return 1; }
  if (a.k === 'tremor') { a.tick -= dt; if (a.tick <= 0) { a.tick = .5; G.fx.push({ k: 'bellw', x: a.x, y: a.y, r: a.r, t: 0, life: .35, c: '#d8c0ff' }); for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r + m.r)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c, { tick: 1 }); } } return 1; }
  if (a.k === 'echo') { if (a.flash > 0) a.flash -= dt; a.tick -= dt; if (a.tick <= 0) { a.tick = 1; ringWave(a.x, a.y, 1.8, a.mult, { kb: 1, tick: 1 }); }
    if (a.t + dt >= a.life && a.fk === 1 && !a.boom) { a.boom = 1; G.shake = Math.max(G.shake, 6); G.fx.push({ k: 'wave', x: a.x, y: a.y, r: 3, t: 0, life: .5 }); ringWave(a.x, a.y, 3, a.mult * 3.3, { kb: 4 }); sfx('bell'); } return 1; }
  if (a.k === 'bigbell') return 1;
  return ch1Area(a, dt);
}
function segD(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, k = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1); return hyp(px - x1 - dx * k, py - y1 - dy * k); }
