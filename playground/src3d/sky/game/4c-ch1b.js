/* ---------- 1장 뒷부분: 갈대 늪 · 둥지섬 · 큰 왜가리 ---------- */
const MARSH_LV = [[10, 11], [11, 12], [12, 13]];
function spawnCh1b() {
  const Wd = G.Wd;
  Wd.mi.forEach((k, i) => { const s = Wd.islands[k], n = 4;
    for (let j = 0; j < n; j++) { const a = j / n * TAU + i * 1.3, d = s.r * .5; let x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d; if (!walk(Wd, x, y)) { x = s.cx; y = s.cy; }
      const kind = pick([['mudfluff'], ['bogpod', 'mudfluff'], ['heronling'], ['mudfluff', 'bogpod']]);
      const pk = j === 0 ? { isl: k, x, y, lv: MARSH_LV[i], kinds: ['mudfluff', 'bogpod', 'mudfluff'], n: 6, lead: 'keeper', nest: 1, elite: ri(1, ELITE.length) }
        : { isl: k, x, y, lv: MARSH_LV[i], kinds: kind, n: kind[0] === 'heronling' ? 3 : ri(3, 5), elite: Math.random() < .25 ? ri(1, ELITE.length) : 0 };
      G.packs.push(pk); spawnPack(pk); } });
  const N = Wd.islands[Wd.nestI];
  if (!G.P.flags.heron) { const pk = { isl: Wd.nestI, x: N.cx + 1, y: N.cy - 1, lv: [15, 15], kinds: ['heron'], n: 1, boss: 1, nest: 1 }; G.packs.push(pk); spawnPack(pk); }
  for (const [ox, oy, kinds] of [[-4, 3, ['heronling']], [3.5, 3.5, ['mudfluff', 'bogpod']]]) { const pk = { isl: Wd.nestI, x: N.cx + ox, y: N.cy + oy, lv: [13, 14], kinds, n: 3 }; G.packs.push(pk); spawnPack(pk); }
}
const MARSH_MOB = { mudfluff: 1, bogpod: 1, heronling: 1 };
function ch1Kill(m) {
  const P = G.P;
  if (MARSH_MOB[m.t] || m.t === 'keeper' && m.pk && G.Wd.mi.includes(m.pk.isl)) qAdd('q6', 1);
  if (m.D.mini && P.q.q5 && P.q.q5.s === 1 && count('shell') + G.drops.filter(d => d.it && d.it.g === 'shell').length < 3) { G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods('shell'), t: 0 }); say('둥지 껍질을 떨궜어요!', '#ffe08a', 1); }
}
// 늪 꼬투리: 거리를 두고 진흙 덩이를 뱉음
function spitAI(m, dt, d, dx, dy, sp) {
  if (d < 2.6) { move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.an = 'move'; separate(m); return; }
  if (d > 5.6) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m); return; }
  if (m.cd <= 0) { m.cd = m.D.atk * rnd(.9, 1.2); m.an = 'atk'; m.at = 0; m.hitDone = 1;
    later(.3, () => { if (m.dead) return; const P = G.P, ex = P.x - m.x, ey = P.y - m.y, l = hyp(ex, ey) || 1; G.areas.push({ k: 'mud', x: m.x + ex / l * .4, y: m.y + ey / l * .4, vx: ex / l * 5.5, vy: ey / l * 5.5, t: 0, life: 1.3, dmg: rnd(m.dmg[0], m.dmg[1]), src: m }); }); }
  else m.an = 'idle';
}
// 큰 왜가리: 부리 찌르기 · 날개 밀치기 · 새끼 부르기 · (성나면) 깃털 비 · 뛰어 내리찍기
function heronAI(m, dt, d, dx, dy) {
  const P = G.P, rage = m.hp < m.mhp * .5; if (rage && !m.raged) { m.raged = 1; G.cut = { s: '큰 왜가리가 성났어요!', t: 0, c: '#ff8a6a' }; sfx('slam'); G.shake = 8; }
  m.sum = (m.sum ?? 10) - dt; m.gust = (m.gust ?? 6) - dt; m.rain = (m.rain ?? 4) - dt; m.leap = (m.leap ?? 9) - dt;
  if (m.sum <= 0) { m.sum = rage ? 12 : 16; for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, x2 = m.x + Math.cos(a) * 1.8, y2 = m.y + Math.sin(a) * 1.8; if (canAt({ D: { fly: 1 }, r: .3 }, x2, y2)) { const n = mkMob('heronling', x2, y2, 13); n.st = 'chase'; G.mobs.push(n); } }
    G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 2.2, t: 0, life: .5, c: '#c8d0dc' }); say('큰 왜가리가 새끼들을 불렀어요!', '#c8d0dc', 1); }
  if (rage && m.rain <= 0) { m.rain = 6; for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, r = i ? rnd(.8, 3.2) : 0, fx = P.x + Math.cos(a) * r, fy = P.y + Math.sin(a) * r; G.areas.push({ k: 'warn', x: fx, y: fy, r: 1, t: 0, life: .9 });
      later(.9, () => { G.fx.push({ k: 'feather', x: fx, y: fy, t: 0, life: .5 }); if (hyp(G.P.x - fx, G.P.y - fy) < 1 + G.P.r) hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * .55, m); }); } }
  if (rage && m.leap <= 0 && d > 2.5 && d < 8) { m.leap = 11; const tx = P.x, ty = P.y; G.areas.push({ k: 'warn', x: tx, y: ty, r: 2.4, t: 0, life: 1.1 }); m.an = 'hurt'; m.at = 0; m.stunned = 0; m.hop = 1.1;
    later(1.1, () => { if (m.dead) return; if (canAt(m, tx, ty)) { m.x = tx; m.y = ty; } m.hop = 0; m.kind = 'slam'; bossHit(m); }); return; }
  if (m.hop > 0) { m.hop -= dt; m.an = 'hurt'; return; }
  if (m.gust <= 0 && d < 5) { m.gust = rage ? 6 : 8; m.an = 'atk'; m.at = 0; m.hitDone = 0; m.kind = 'gust'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 3.4, t: 0, life: .8, cone: [dx / d, dy / d] }); return; }
  if (d > m.r + 1.6) { move(m, dx / d * m.spd * (rage ? 1.2 : 1) * dt, dy / d * m.spd * (rage ? 1.2 : 1) * dt); m.an = 'move'; }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = rage ? 1.7 : 2.3; m.kind = 'stab'; m.sx = m.x + dx / d * 2; m.sy = m.y + dy / d * 2; G.areas.push({ k: 'warn', x: m.sx, y: m.sy, r: 1.2, t: 0, life: .8 }); }
  else m.an = 'idle';
}
function heronStab(m) { const P = G.P; G.fx.push({ k: 'thrust', x: m.x, y: m.y, dx: (m.sx - m.x) / 2, dy: (m.sy - m.y) / 2, len: 2.6, t: 0, life: .25 }, { k: 'ring', x: m.sx, y: m.sy, r: 1.2, t: 0, life: .3, c: '#ffd0a0' }); G.shake = 6; sfx('slam');
  if (hyp(P.x - m.sx, P.y - m.sy) < 1.2 + P.r) hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * 1.25, m); }
// 늪 지역 효과(진흙 덩이)
function ch1Area(a, dt) {
  if (a.k !== 'mud') return ch2Area(a, dt); const P = G.P;
  a.x += a.vx * dt; a.y += a.vy * dt; if (!G.Wd.inb(Math.floor(a.x), Math.floor(a.y))) { a.t = a.life; return 1; }
  if (!P.dead && hyp(P.x - a.x, P.y - a.y) < .45 + P.r) { a.t = a.life; G.fx.push({ k: 'pop', x: a.x, y: a.y, t: 0, life: .3, c: '#6a5034' }); hurtPlayer(a.dmg, a.src); }
  return 1;
}
