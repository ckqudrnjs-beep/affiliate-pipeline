
/* =================== 게임 진행 =================== */
let G = null, opts = {}, PM = {}; // PM: 소품 아틀라스 자리
const DIRV = [...Array(8)].map((_, d) => { const a = d * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; }); // 화면 방향
// 화면 방향 벡터 ↔ 월드 방향 벡터 (쿼터뷰)
const scr2w = (sx, sy) => { const wx = sx / TW * 2 / 2 + sy / TH * 2 / 2, wy = sy / TH - sx / TW; const l = hyp(wx, wy) || 1; return [wx / l, wy / l]; };
const w2dir = (wx, wy) => { const sx = (wx - wy) * TW / 2, sy = (wx + wy) * TH / 2; return ((Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) % 8) + 8) % 8; };
const dirW = d => scr2w(DIRV[d][0] * TW, DIRV[d][1] * TH * 2); // 방향 d 의 월드 단위벡터(화면에서 d로 보이는)

function newSave(cls) {
  const seed = (Math.random() * 1e9) | 0, it = id => makeItem(id, 0, 1, { id: 1, st: 0 });
  const eq = cls === 'warden' ? { weapon: it('spear0'), off: it('shield0'), armor: it('armor0'), sail: it('sail0') } : { weapon: it('staff0'), off: it('bell0'), armor: it('armor0'), sail: it('sail0') };
  return { v: 1, cls, seed, lv: 1, xp: 0, sp: {}, pts: 0, skp: 1, sk: { [cls === 'warden' ? 'pierce' : 'gust']: 1 }, fork: {}, slots: [null, null, null, null], eq, inv: [goods('pot', 3), goods('wpot', 2)], gold: 30, q: {}, flags: {}, kills: 0, t: Date.now(), rested: 0, play: 0, codex: {} };
}
function startGame(S) {
  const Wd = makeWorld(S.seed); Wd.props = placeProps(Wd, PM);
  if (S.flags.bridge) repairBridge(Wd, Wd.bq);
  for (const w of Wd.wps) if (S.flags['wp_' + w.n]) w.on = 1;
  const T = Wd.islands[Wd.town];
  const P = { ...S, x: T.cx + 1.5, y: T.cy + 2.5, r: .28, dir: 2, an: 'idle', at: 0, atkT: 0, cds: {}, buf: {}, hp: null, wind: null, dodge: 0, dcd: 0, inv0: 0, tgt: null, path: null, dead: 0, combo: 0 };
  // 순풍: 쉬는 동안 쌓이는 경험치 2배 몫(최대 다음 레벨 필요량의 절반)
  const away = Math.max(0, Date.now() - (S.t || Date.now())) / 36e5; P.rested = Math.min(xpNeed(P.lv) * .5, (S.rested || 0) + away * xpNeed(P.lv) * .06);
  G = { Wd, P, mobs: [], proj: [], fx: [], txt: [], drops: [], areas: [], t: 0, cam: [P.x, P.y], shake: 0, packs: [], msg: [], hitstop: 0 };
  calc(P); P.hp = P.mhp; P.wind = P.mwind; autoSlots(P);
  spawnAll(); if (!S.q.q1) setTimeout(() => talk('chief', true), 600);
  return G;
}
function save() { if (!G) return; const P = G.P, S = {}; for (const k of ['v', 'cls', 'seed', 'lv', 'xp', 'sp', 'pts', 'skp', 'sk', 'fork', 'slots', 'eq', 'inv', 'gold', 'q', 'flags', 'kills', 'rested', 'play', 'codex']) S[k] = P[k]; S.t = Date.now(); S.uid = UID;
  try { localStorage.setItem('sky_' + P.cls, JSON.stringify(S)); } catch (e) {} }
function loadSave(cls) { try { const s = JSON.parse(localStorage.getItem('sky_' + cls) || 'null'); if (s && s.v === 1) { UID = Math.max(UID, s.uid || 1); return s; } } catch (e) {} return null; }

/* ---------- 몹 ---------- */
const ISL_LV = { 0: [1, 2], 1: [2, 3], 2: [4, 5], 3: [6, 7], 4: [5, 6] };
function mkMob(t, x, y, lv, elite) {
  const D = MOBDEF[t], E = elite ? ELITE[elite - 1] : null, m = E ? E[2] : {};
  const hp = Math.round((D.hp[0] + D.hp[1] * lv) * (m.hp || 1) * (elite ? 1.3 : 1));
  return { t, D, x, y, hx: x, hy: y, lv, hp, mhp: hp, dmg: [(D.dmg[0] + D.dmg[2] * lv) * (m.dmg || 1), (D.dmg[1] + D.dmg[2] * lv * 1.3) * (m.dmg || 1)], spd: D.spd * (m.spd || 1), r: D.r, dir: ri(0, 7), an: 'idle', at: Math.random(), cd: 1, st: 'idle', kx: 0, ky: 0, stun: 0, slow: 0, elite, E, kbimm: m.kbimm, wan: rnd(1, 4), fl: 0, fear: 0, taunt: 0, miss: 0, bleed: 0, id: Math.random() };
}
function spawnPack(pk) {
  const s = G.Wd.islands[pk.isl], R = Math.random; pk.mobs = [];
  for (let tries = 0; tries < 30 && pk.mobs.length < pk.n; tries++) {
    const a = R() * TAU, d = R() * 1.8, x = pk.x + Math.cos(a) * d, y = pk.y + Math.sin(a) * d;
    if (!walk(G.Wd, x, y)) continue; const elite = pk.elite && pk.mobs.length === 0 ? pk.elite : 0;
    const m = mkMob(pk.kinds[pk.mobs.length % pk.kinds.length], x, y, ri(pk.lv[0], pk.lv[1]), elite); m.pk = pk; pk.mobs.push(m); G.mobs.push(m);
  }
  pk.dead = 0; pk.clear = 0;
}
function spawnAll() {
  const Wd = G.Wd; G.mobs = []; G.packs = [];
  Wd.fi.forEach((k, i) => { const s = Wd.islands[k], n = 3 + (i >= 2 ? 1 : 0);
    for (let j = 0; j < n; j++) { const a = j / n * TAU + i, d = s.r * .5; let x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d; if (!walk(Wd, x, y)) { x = s.cx; y = s.cy; }
      const kind = pick([['fluff'], ['fluff'], ['seed', 'fluff'], ['bird'], ['seed']]);
      const pk = { isl: k, x, y, lv: ISL_LV[i], kinds: kind, n: kind[0] === 'fluff' ? ri(4, 6) : kind[0] === 'bird' ? 3 : ri(2, 4), elite: Math.random() < .22 ? ri(1, ELITE.length) : 0 };
      G.packs.push(pk); spawnPack(pk); } });
  const H = Wd.islands[Wd.hill];
  if (!G.P.flags.boss) { const pk = { isl: Wd.hill, x: H.cx + .5, y: H.cy - .5, lv: [9, 9], kinds: ['fluffking'], n: 1, boss: 1 }; G.packs.push(pk); spawnPack(pk); }
  const pk2 = { isl: Wd.hill, x: H.cx - 3, y: H.cy + 3, lv: [7, 8], kinds: ['fluff', 'seed'], n: 4 }; G.packs.push(pk2); spawnPack(pk2);
}

/* ---------- 움직임·충돌 ---------- */
function canAt(e, x, y) { if (e.D && e.D.fly) { const X = Math.floor(x), Y = Math.floor(y); return G.Wd.inb(X, Y) && G.Wd.g[G.Wd.id(X, Y)] !== 0 && !G.Wd.block[G.Wd.id(X, Y)] || false; } const r = e.r * .8; return walk(G.Wd, x, y) && walk(G.Wd, x + r, y) && walk(G.Wd, x - r, y) && walk(G.Wd, x, y + r) && walk(G.Wd, x, y - r); }
function move(e, dx, dy) { let moved = 0; if (dx && canAt(e, e.x + dx, e.y)) { e.x += dx; moved = 1; } if (dy && canAt(e, e.x, e.y + dy)) { e.y += dy; moved = 1; } return moved; }
// 밀려남: 빈 하늘로 밀리면 떨어진다
function knock(m, dx, dy, f) {
  if (m.D.boss || m.kbimm || m.fl) return; const l = hyp(dx, dy) || 1; m.kx += dx / l * f; m.ky += dy / l * f;
}
function physKnock(m, dt) {
  if (!m.kx && !m.ky) return; const nx = m.x + m.kx * dt, ny = m.y + m.ky * dt;
  if (!m.D.fly && ground(G.Wd, nx, ny) === 0 && G.Wd.inb(Math.floor(nx), Math.floor(ny))) { const X = Math.floor(nx), Y = Math.floor(ny); if (!G.Wd.block[G.Wd.id(X, Y)]) { m.x = nx; m.y = ny; m.fl = 1; m.an = 'hurt'; m.hp = 0; killMob(m, true); return; } }
  move(m, m.kx * dt, m.ky * dt); const k = Math.exp(-dt * 7); m.kx *= k; m.ky *= k; if (hyp(m.kx, m.ky) < .2) { m.kx = 0; m.ky = 0; }
}

/* ---------- 피해 ---------- */
function rollDmg(P, m, mult) {
  const c = m.D.sz ? [P.dmg[2], P.dmg[3]] : [P.dmg[0], P.dmg[1]];
  let d = rnd(c[0], c[1] + .99) * (mult || 1) * (1 + P.dmgp / 100);
  const crit = Math.random() * 100 < P.crit; if (crit) d *= 1.8; return [Math.max(1, Math.round(d)), crit];
}
function hitMob(m, dmg, crit, o) {
  if (m.hp <= 0 || m.fl) return; o = o || {};
  m.hp -= dmg; m.flash = .12; G.txt.push({ x: m.x, y: m.y, z: 1, t: 0, s: String(dmg), c: crit ? '#ffd166' : '#fff', big: crit });
  if (o.kb) knock(m, m.x - (o.fx ?? G.P.x), m.y - (o.fy ?? G.P.y), o.kb * G.P.kbm);
  if (o.stun) m.stun = Math.max(m.stun, o.stun); if (o.slow) m.slow = Math.max(m.slow, o.slow); if (o.bleed) m.bleed = { t: 3, d: o.bleed };
  if (m.st === 'idle') m.st = 'chase';
  if (!m.D.boss && m.stun <= 0 && Math.random() < .4) { m.an = 'hurt'; m.at = 0; }
  sfx(crit ? 'crit' : 'hit'); if (crit) { G.hitstop = .045; G.shake = Math.max(G.shake, 3); }
  if (m.hp <= 0) killMob(m);
}
function killMob(m, fell) {
  if (m.dead) return; m.dead = 1; m.an = 'die'; m.at = 0; const P = G.P, D = m.D;
  let xp = (D.xp[0] + D.xp[1] * m.lv) * (m.elite ? 3 : 1) * P.xpm; if (m.lv < P.lv - 5) xp *= .3;
  const bonus = Math.min(P.rested, xp); P.rested -= bonus; gainXp(Math.round(xp + bonus));
  if (P.lifek) P.hp = Math.min(P.mhp, P.hp + P.lifek); if (P.windk) P.wind = Math.min(P.mwind, P.wind + P.windk);
  for (const s in P.eq) if (P.eq[s] && P.eq[s].hid) { const it = P.eq[s]; it.tame = (it.tame || 0) + 1; if (it.tame === TAME_N) { say('길들이기 완료! ' + itemName(it) + ' 숨은 옵션: ' + afxText(it.hid[0], it.hid[1], P.cls), '#c9a8ff'); calc(P); } }
  P.kills++; P.codex[m.t] = (P.codex[m.t] || 0) + 1;
  if (m.t === 'fluff') qAdd('q2', 1);
  if (D.boss) { P.flags.boss = 1; qSet('q3', 2); G.shake = 10; say('우두머리 보풀이 흩어졌어요! 언덕의 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); }
  if (fell) { G.txt.push({ x: m.x, y: m.y, z: 1, t: 0, s: '떨어짐!', c: '#9fe4ff' }); sfx('fall'); }
  drops(m, fell);
  if (m.pk) { m.pk.dead++; if (m.pk.dead >= m.pk.mobs.length) { m.pk.clear = G.t; } }
}
function drops(m, fell) {
  const P = G.P, D = m.D, put = it => { const a = Math.random() * TAU, d = .3 + Math.random() * .6; let x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d; if (!walk(G.Wd, x, y)) { x = P.x; y = P.y; } if (it.gold) G.drops.push({ x, y, gold: it.gold, t: 0 }); else G.drops.push({ x, y, it, t: 0 }); };
  if (fell) { if (Math.random() < .5) G.drops.push({ x: P.x + rnd(-.5, .5), y: P.y + rnd(-.5, .5), gold: ri(m.lv, m.lv * 3), t: 0 }); return; }
  const ilv = m.lv + (m.elite ? 1 : 0) + (D.boss ? 2 : 0);
  if (Math.random() < .55 || m.elite) put({ gold: ri(m.lv * 2, m.lv * 5) * (m.elite ? 3 : 1) });
  const nItem = D.boss ? 3 : m.elite ? (Math.random() < .7 ? 2 : 1) : (Math.random() < .1 * (1 + P.find / 100) ? 1 : 0);
  for (let i = 0; i < nItem; i++) put(rollDrop(ilv, P.find + (m.elite ? 60 : 0) + (D.boss ? 150 : 0), P.cls));
  if (D.boss) { const u = P.cls === 'warden' ? 'u_late' : 'u_cloudfan'; put(makeItem(UNIQ.find(x => x.id === u).base, 3, 9, { u })); if (Math.random() < .5) put(makeItem('helm2', 3, 8, { u: 'u_millcap' })); put(goods('bhone')); }
  const R = Math.random();
  if (R < .08) put(goods('pot')); else if (R < .14) put(goods('wpot')); else if (R < .2) put(goods('hone')); else if (R < .26) put(goods('glue')); else if (R < .265) put(goods('bhone')); else if (R < .27) put(goods('bglue'));
  if (P.q.q1 && P.q.q1.s === 1 && count('plank') + G.drops.filter(d => d.it && d.it.g === 'plank').length < 6 && Math.random() < .35) put(goods('plank'));
}
function gainXp(n) {
  const P = G.P; P.xp += n; G.txt.push({ x: P.x, y: P.y, z: 2.2, t: 0, s: '+' + n + ' 경험', c: '#b6f0a0', small: 1 });
  while (P.xp >= xpNeed(P.lv)) { P.xp -= xpNeed(P.lv); P.lv++; P.pts += 5; P.skp++; calc(P); P.hp = P.mhp; P.wind = P.mwind; G.fx.push({ k: 'lvl', x: P.x, y: P.y, t: 0, life: 1.4 }); sfx('lvl'); say(P.lv + '레벨! 스탯 5점, 스킬 1점이 생겼어요.', '#ffd166'); }
}
function hurtPlayer(d, src) {
  const P = G.P; if (P.dead || P.dodge > 0 || P.inv0 > 0 || DEBUG && G.god) return;
  if (src && src.miss && Math.random() < .4) { G.txt.push({ x: P.x, y: P.y, z: 1.4, t: 0, s: '헛손질', c: '#ccc', small: 1 }); return; }
  const hitCh = clamp(.92 - P.ac * .008, .55, .95); if (Math.random() > hitCh) { G.txt.push({ x: P.x, y: P.y, z: 1.4, t: 0, s: '피함', c: '#9fe4ff', small: 1 }); return; }
  if (Math.random() * 100 < P.blk) { G.txt.push({ x: P.x, y: P.y, z: 1.4, t: 0, s: '막음', c: '#ffd27a', small: 1 }); sfx('block'); return; }
  d = d * 100 / (100 + P.ac * 3);
  if (P.buf.hold) { d *= 1 - (.3 + .02 * skLvId('hold')); if (P.fork.hold === 0 && src && src.hp > 0) hitMob(src, Math.round(d * .4), false); }
  if (P.buf.cloud && P.cloudHP > 0) { const a = Math.min(P.cloudHP, d); P.cloudHP -= a; d -= a; if (P.fork.cloud === 0 && src) src.slow = 2; if (P.cloudHP <= 0) P.buf.cloud = 0; }
  if (P.thorn && src && src.hp > 0) hitMob(src, P.thorn, false);
  d = Math.max(0, Math.round(d)); if (!d) return;
  P.hp -= d; P.hurt = .25; G.txt.push({ x: P.x, y: P.y, z: 1.2, t: 0, s: String(d), c: '#ff7a6a' }); G.shake = Math.max(G.shake, 2.5); sfx('hurt');
  if (src && src.t === 'bird') P.wind = Math.max(0, P.wind - 3);
  if (P.hp <= 0) { P.hp = 0; P.dead = 2.6; P.an = 'die'; P.at = 0; sfx('die'); say('쓰러졌어요… 마을에서 다시 일어나요(골드 10% 잃음).', '#ff9a8a'); }
}
const skLvId = id => { const s = SKILLS[G.P.cls].find(x => x.id === id); return s ? skLv(G.P, s) : 0; };

/* ---------- 스킬 ---------- */
function weapAvg(P, big) { return big ? (P.dmg[2] + P.dmg[3]) / 2 : (P.dmg[0] + P.dmg[1]) / 2; }
function facingW(P) { if (P.aim) return P.aim; return dirW(P.dir); }
function mobsIn(fn) { return G.mobs.filter(m => !m.dead && fn(m)); }
function nearestMob(x, y, r, not) { let b = null, bd = r; for (const m of G.mobs) { if (m.dead || not && not.has(m)) continue; const d = hyp(m.x - x, m.y - y); if (d < bd) { bd = d; b = m; } } return b; }
function aimAt(P, m) { if (!m) return; const dx = m.x - P.x, dy = m.y - P.y, l = hyp(dx, dy) || 1; P.aim = [dx / l, dy / l]; P.dir = w2dir(dx, dy); }
function castSkill(i) {
  const P = G.P, id = P.slots[i]; if (!id || P.dead) return; const s = SKILLS[P.cls].find(x => x.id === id), lv = skLv(P, s); if (!lv) return;
  if ((P.cds[id] || 0) > 0) return; if (P.wind < s.cost) { say('바람이 모자라요', '#9fe4ff', 1); sfx('no'); return; }
  P.wind -= s.cost; P.cds[id] = s.cd; const fk = lv >= 5 ? P.fork[id] : null;
  const t = nearestMob(P.x, P.y, s.t === 'bolt' || s.t === 'twister' || s.t === 'chain' || s.t === 'mist' ? 8 : 3); if (t && !P.aimLock) aimAt(P, t);
  const [fx, fy] = facingW(P), mult = s.m * (1 + s.ml * (lv - 1)) * synergy(P, s), D = (m, k) => rollDmg(P, m, mult * (k || 1));
  P.an = ['buff', 'shout', 'flag', 'shield', 'mist', 'chain', 'twister'].includes(s.t) ? 'cast' : 'atk'; P.at = 0; P.atkDur = .38;
  sfx(s.t);
  if (s.t === 'line') {
    const len = s.len * (fk === 1 ? 1.5 : 1), hits = fk === 0 ? 3 : 1;
    for (let h = 0; h < hits; h++) G.areas.push({ k: 'delay', t: -h * .13, fn: () => { G.fx.push({ k: 'thrust', x: P.x, y: P.y, dx: fx, dy: fy, len, t: 0, life: .22 });
      for (const m of mobsIn(m => { const rx = m.x - P.x, ry = m.y - P.y, a = rx * fx + ry * fy, b = Math.abs(rx * fy - ry * fx); return a > -.2 && a < len + m.r && b < .55 + m.r; })) { const [d, c] = D(m, fk === 0 ? .7 : 1); hitMob(m, d, c, { kb: fk === 1 ? 6 : 1.5 }); } } });
  } else if (s.t === 'nova') {
    const spin = fk === 0 ? 5 : 1;
    for (let h = 0; h < spin; h++) G.areas.push({ k: 'delay', t: -h * .3, fn: () => { G.fx.push({ k: 'ring', x: P.x, y: P.y, r: s.r, t: 0, life: .3, c: '#e8f4ff' }); for (const m of mobsIn(m => hyp(m.x - P.x, m.y - P.y) < s.r + m.r)) { const [d, c] = D(m, spin > 1 ? .55 : 1); hitMob(m, d, c, { kb: fk === 1 ? 8 : 2.5 }); } } });
  } else if (s.t === 'cone') {
    let r = s.r, arc = s.arc, kb = s.kb, stun = s.stun || 0, mm = 1;
    if (id === 'bash') { if (fk === 0) { P.dash = { vx: fx * 12, vy: fy * 12, t: .25, hit: new Set(), mult }; } if (fk === 1) { stun = 2; r *= 1.3; arc *= 1.3; } }
    if (id === 'gust') { if (fk === 0) mm = 1.4; if (fk === 1) { r *= 1.4; arc *= 1.3; kb *= 1.8; } }
    G.fx.push({ k: id === 'gust' ? 'gust' : 'bash', x: P.x, y: P.y, dx: fx, dy: fy, r, arc, t: 0, life: .35 });
    for (const m of mobsIn(m => { const rx = m.x - P.x, ry = m.y - P.y, d = hyp(rx, ry); if (d > r + m.r) return false; const a = Math.acos(clamp((rx * fx + ry * fy) / (d || 1), -1, 1)); return a < arc / 2 || d < .6; })) { const [d, c] = D(m, mm); hitMob(m, d, c, { kb, stun, bleed: id === 'gust' && fk === 0 ? d * .1 : 0 }); }
  } else if (s.t === 'buff') { P.buf.hold = s.dur; G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .6, c: '#ffd27a' }); }
  else if (s.t === 'shout') { P.buf.shout = s.dur; calc(P); G.fx.push({ k: 'ring', x: P.x, y: P.y, r: s.r, t: 0, life: .5, c: '#ffcf7a' });
    for (const m of mobsIn(m => hyp(m.x - P.x, m.y - P.y) < s.r)) { m.st = 'chase'; m.taunt = 4; if (fk === 0) m.fear = 2; } if (fk === 1) { P.buf.brave = 8; calc(P); } }
  else if (s.t === 'flag') G.areas.push({ k: 'flag', x: P.x + fx * .6, y: P.y + fy * .6, r: s.r, t: 0, life: s.dur, fk, tick: 0, mult });
  else if (s.t === 'twister') { const n = fk === 0 ? 2 : 1; for (let j = 0; j < n; j++) { const a = n > 1 ? (j ? .45 : -.45) : 0, c = Math.cos(a), sn = Math.sin(a), vx = fx * c - fy * sn, vy = fx * sn + fy * c;
    G.proj.push({ k: 'twister', x: P.x + vx * .6, y: P.y + vy * .6, vx: fk === 1 ? 0 : vx * 3, vy: fk === 1 ? 0 : vy * 3, life: fk === 1 ? 3 : s.dur, tick: 0, mult, r: 1.3 }); if (fk === 1) { const p = G.proj[G.proj.length - 1]; p.x = P.x + fx * 2.6; p.y = P.y + fy * 2.6; } } }
  else if (s.t === 'bolt') { const n = fk === 0 ? 3 : 1; for (let j = 0; j < n; j++) { const a = (j - (n - 1) / 2) * .26, c = Math.cos(a), sn = Math.sin(a), vx = fx * c - fy * sn, vy = fx * sn + fy * c; G.proj.push({ k: 'bolt', x: P.x + vx * .4, y: P.y + vy * .4, vx: vx * 13, vy: vy * 13, life: .65, mult: mult * (n > 1 ? .7 : 1), pierce: fk === 1, hit: new Set() }); } }
  else if (s.t === 'chain') { let cur = nearestMob(P.x, P.y, 7); const hit = new Set(); let px = P.x, py = P.y; const jumps = fk === 0 ? 7 : s.jumps;
    for (let j = 0; j < jumps && cur; j++) { hit.add(cur); G.fx.push({ k: 'zap', x: px, y: py, x2: cur.x, y2: cur.y, t: 0, life: .25 }); const [d, c] = D(cur, j ? .85 : 1); hitMob(cur, d, c, { stun: fk === 1 && Math.random() < .3 ? 1 : 0 }); px = cur.x; py = cur.y; cur = nearestMob(px, py, 3.5, hit); } }
  else if (s.t === 'shield') { P.buf.cloud = s.dur; P.cloudHP = 20 + P.st.spi * 3 + lv * 8; G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .6, c: '#e8f4ff' }); }
  else if (s.t === 'mist') { const tx = t ? t.x : P.x + fx * 2.5, ty = t ? t.y : P.y + fy * 2.5; G.areas.push({ k: 'mist', x: tx, y: ty, r: s.r, t: 0, life: fk === 0 ? 10 : s.dur, fk, tick: 0, mult }); }
}
function basicAttack() {
  const P = G.P, C = CLASSES[P.cls]; if (P.atkT > 0 || P.dead) return false;
  const t = P.tgt && !P.tgt.dead ? P.tgt : nearestMob(P.x, P.y, C.melee ? 1.9 : 7.5); if (!t) return false;
  const d = hyp(t.x - P.x, t.y - P.y); if (C.melee && d > C.range + t.r + .1) return false;
  aimAt(P, t); P.atkT = 1 / P.aspd; P.an = 'atk'; P.at = 0; P.atkDur = Math.min(.42, 1 / P.aspd); P.pend = { t: P.atkDur * .45, m: t };
  return true;
}
function resolveBasic(m) {
  const P = G.P, C = CLASSES[P.cls];
  if (C.melee) { if (m.dead || hyp(m.x - P.x, m.y - P.y) > C.range + m.r + .3) return; const [d, c] = rollDmg(P, m, 1); hitMob(m, d, c, { kb: 1.2 }); const [ax, ay] = P.aim || dirW(P.dir); G.fx.push({ k: 'thrust', x: P.x, y: P.y, dx: ax, dy: ay, len: C.range, t: 0, life: .16 }); }
  else { const [fx, fy] = P.aim || dirW(P.dir); G.proj.push({ k: 'wind', x: P.x + fx * .4, y: P.y + fy * .4, vx: fx * 10, vy: fy * 10, life: .8, mult: .95, hit: new Set() }); sfx('shoot'); }
}

/* ---------- 매 프레임 ---------- */
function update(dt) {
  const P = G.P; G.t += dt; P.play += dt;
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  // 버프·쿨다운
  for (const k in P.cds) if (P.cds[k] > 0) P.cds[k] -= dt;
  let rc = 0; for (const k in P.buf) if (P.buf[k] > 0) { P.buf[k] -= dt; if (P.buf[k] <= 0) { P.buf[k] = 0; rc = 1; } } if (rc) calc(P);
  if (P.buf.hold && P.fork.hold === 1) P.hp = Math.min(P.mhp, P.hp + P.mhp * .02 * dt);
  if (P.buf.cloud && P.fork.cloud === 1) P.hp = Math.min(P.mhp, P.hp + P.mhp * .015 * dt);
  P.atkT -= dt; P.dcd -= dt; P.inv0 -= dt; if (P.hurt) P.hurt = Math.max(0, P.hurt - dt);
  if (!P.dead) { P.wind = Math.min(P.mwind, P.wind + P.wreg * dt); P.hp = Math.min(P.mhp, P.hp + (.15 + P.st.vit * .01) * dt * (inTown() ? 8 : 1)); if (inTown()) P.wind = Math.min(P.mwind, P.wind + 4 * dt); }
  // 죽음
  if (P.dead) { P.dead -= dt; P.at += dt; if (P.dead <= 0) { const T = G.Wd.islands[G.Wd.town]; P.x = T.cx + 1.5; P.y = T.cy + 2.5; P.hp = P.mhp; P.wind = P.mwind; P.gold = Math.floor(P.gold * .9); P.dead = 0; P.an = 'idle'; P.inv0 = 2; G.cam = [P.x, P.y]; save(); } }
  else playerMove(dt);
  if (P.pend) { P.pend.t -= dt; if (P.pend.t <= 0) { resolveBasic(P.pend.m); P.pend = null; } }
  P.at += dt;
  // 몹
  for (const m of G.mobs) mobUpdate(m, dt);
  G.mobs = G.mobs.filter(m => !(m.dead && m.at > 1.2));
  // 다시 생기기: 정리된 무리는 2분 뒤, 플레이어가 멀리 있을 때
  for (const pk of G.packs) if (pk.clear && !pk.boss && G.t - pk.clear > 120 && hyp(P.x - pk.x, P.y - pk.y) > 14) spawnPack(pk);
  // 투사체
  for (const p of G.proj) projUpdate(p, dt); G.proj = G.proj.filter(p => p.life > 0);
  // 지역 효과
  for (const a of G.areas) areaUpdate(a, dt); G.areas = G.areas.filter(a => a.k === 'delay' ? !a.done : a.t < a.life);
  for (const f of G.fx) f.t += dt; G.fx = G.fx.filter(f => f.t < f.life);
  for (const t of G.txt) t.t += dt; G.txt = G.txt.filter(t => t.t < 1);
  // 줍기
  for (const d of G.drops) { d.t += dt; if (P.dead || d.t < .35) continue; if (hyp(d.x - P.x, d.y - P.y) < .6) pickUp(d); }
  G.drops = G.drops.filter(d => !d.got);
  // 카메라
  const k = 1 - Math.exp(-dt * 8); G.cam[0] += (P.x - G.cam[0]) * k; G.cam[1] += (P.y - G.cam[1]) * k; G.shake = Math.max(0, G.shake - dt * 20);
  for (const s of G.msg) s.t += dt; G.msg = G.msg.filter(s => s.t < 4.5);
  near();
  if ((G.saveT = (G.saveT || 0) + dt) > 10) { G.saveT = 0; save(); }
}
function inTown() { const T = G.Wd.islands[G.Wd.town]; return hyp(G.P.x - T.cx, G.P.y - T.cy) < T.r * .9; }
function playerMove(dt) {
  const P = G.P;
  if (P.dash) { const D = P.dash; D.t -= dt; move(P, D.vx * dt, D.vy * dt); for (const m of mobsIn(m => hyp(m.x - P.x, m.y - P.y) < m.r + .6 && !D.hit.has(m))) { D.hit.add(m); const [d, c] = rollDmg(P, m, D.mult); hitMob(m, d, c, { kb: 5 }); } if (D.t <= 0) P.dash = null; return; }
  if (P.dodge > 0) { P.dodge -= dt; move(P, P.dvx * dt, P.dvy * dt); return; }
  let [ix, iy] = inputVec(); const busy = P.an === 'atk' || P.an === 'cast' ? P.at < (P.atkDur || .35) : false;
  if (P.buf.spin) busy;
  if (ix || iy) { P.path = null; P.tgt = null; }
  // 클릭 이동/공격
  if (!ix && !iy && P.tgt) { if (P.tgt.dead) P.tgt = null; else { const d = hyp(P.tgt.x - P.x, P.tgt.y - P.y), C = CLASSES[P.cls]; if (d > (C.melee ? C.range + P.tgt.r : 6.5)) { ix = (P.tgt.x - P.x) / d; iy = (P.tgt.y - P.y) / d; } else if (!busy) basicAttack(); } }
  else if (!ix && !iy && P.path) { const d = hyp(P.path[0] - P.x, P.path[1] - P.y); if (d < .15) P.path = null; else { ix = (P.path[0] - P.x) / d; iy = (P.path[1] - P.y) / d; } }
  if (inputHeld('atk') && !busy) { if (!basicAttack() && !ix && !iy) {} }
  if ((ix || iy) && !busy) {
    const sp = P.move * (P.hurt ? .7 : 1) * dt; const ok = move(P, ix * sp, iy * sp); if (!ok && P.path) P.path = null;
    P.dir = w2dir(ix, iy); P.aim = null; if (P.an !== 'run') { P.an = 'run'; } P.runT = (P.runT || 0) + dt * P.move / 3.6;
  } else if (!busy && P.an !== 'idle') { P.an = 'idle'; P.at = 0; }
}
function doDodge() {
  const P = G.P; if (P.dcd > 0 || P.dead || P.dodge > 0) return; let [ix, iy] = inputVec(); if (!ix && !iy) [ix, iy] = dirW(P.dir);
  const [dist, cd] = P.sail; P.dodge = .22; P.dvx = ix * dist / .22; P.dvy = iy * dist / .22; P.dcd = cd; P.an = 'dodge'; P.at = 0; P.dir = w2dir(ix, iy); sfx('dodge');
  G.fx.push({ k: 'sail', x: P.x, y: P.y, t: 0, life: .35 });
}
function mobUpdate(m, dt) {
  m.at += dt; if (m.flash) m.flash = Math.max(0, m.flash - dt);
  if (m.dead) { if (m.fl) m.fy = (m.fy || 0) + dt * 6; return; }
  physKnock(m, dt); if (m.dead) return;
  if (m.bleed) { m.bleed.t -= dt; m.btick = (m.btick || 0) + dt; if (m.btick > .5) { m.btick = 0; hitMob(m, Math.max(1, Math.round(m.bleed.d)), false); } if (m.bleed && m.bleed.t <= 0) m.bleed = 0; if (m.dead) return; }
  if (m.stun > 0) { m.stun -= dt; m.an = 'hurt'; return; }
  if (m.slow > 0) m.slow -= dt; if (m.taunt > 0) m.taunt -= dt; if (m.fear > 0) m.fear -= dt; m.cd -= dt;
  const P = G.P, dx = P.x - m.x, dy = P.y - m.y, d = hyp(dx, dy), sp = m.spd * (m.slow > 0 ? .55 : 1) * (G.areas.some(a => a.k === 'mist' && hyp(a.x - m.x, a.y - m.y) < a.r) ? .6 : 1);
  m.miss = G.areas.some(a => a.k === 'mist' && hyp(a.x - m.x, a.y - m.y) < a.r);
  if (m.an === 'atk') { // 공격 동작 중
    const wind = m.D.boss ? .8 : .35;
    if (!m.hitDone && m.at > wind) { m.hitDone = 1; if (m.D.boss) bossHit(m); else if (hyp(P.x - m.x, P.y - m.y) < m.r + P.r + .55) hurtPlayer(rnd(m.dmg[0], m.dmg[1]), m); }
    if (m.at > wind + .3) { m.an = 'idle'; m.at = 0; } return;
  }
  if (m.an === 'hurt' && m.at < .2) return;
  if (P.dead) { m.st = 'idle'; }
  const aggro = m.D.boss ? 9 : m.D.fly ? 8 : 6.5;
  if (m.st === 'idle') { if (d < aggro && !P.dead) m.st = 'chase'; else { m.wan -= dt; if (m.wan < 0) { m.wan = rnd(2, 5); m.wx = m.hx + rnd(-1.5, 1.5); m.wy = m.hy + rnd(-1.5, 1.5); }
      if (m.wx != null) { const ex = m.wx - m.x, ey = m.wy - m.y, el = hyp(ex, ey); if (el > .2) { move(m, ex / el * sp * .4 * dt, ey / el * sp * .4 * dt); m.dir = w2dir(ex, ey); m.an = 'move'; } else m.an = 'idle'; } } return; }
  // 집에서 너무 멀면 돌아감
  if (hyp(m.x - m.hx, m.y - m.hy) > 16 && m.taunt <= 0 || P.dead) { m.st = 'idle'; m.wx = m.hx; m.wy = m.hy; return; }
  if (m.fear > 0) { move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.dir = w2dir(-dx, -dy); m.an = 'move'; return; }
  m.dir = w2dir(dx, dy);
  if (m.D.ai === 'charge' && m.cd <= 0 && d > 2.2 && d < 5) { m.charge = .55; m.cvx = dx / d * 6.5; m.cvy = dy / d * 6.5; m.cd = 3.5; m.hitC = 0; }
  if (m.charge > 0) { m.charge -= dt; move(m, m.cvx * dt, m.cvy * dt); m.an = 'atk'; m.at = .1; m.hitDone = 1; if (!m.hitC && hyp(P.x - m.x, P.y - m.y) < m.r + P.r + .2) { m.hitC = 1; hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * 1.3, m); } if (m.charge <= 0) { m.an = 'idle'; m.at = 0; } return; }
  if (m.D.ai === 'dive' && m.back > 0) { m.back -= dt; move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.an = 'move'; return; }
  if (m.D.boss) return bossAI(m, dt, d, dx, dy);
  const reach = m.r + P.r + .35;
  if (d > reach) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m); }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = m.D.atk * rnd(.9, 1.3); if (m.D.ai === 'dive') m.back = .8; }
  else m.an = 'idle';
}
function separate(m) { for (const o of G.mobs) { if (o === m || o.dead) continue; const dx = m.x - o.x, dy = m.y - o.y, d = hyp(dx, dy), rr = m.r + o.r; if (d < rr && d > 0) { move(m, dx / d * (rr - d) * .3, dy / d * (rr - d) * .3); } } }
function bossAI(m, dt, d, dx, dy) {
  m.sum = (m.sum || 8) - dt; m.gust = (m.gust || 5) - dt;
  if (m.sum <= 0) { m.sum = 13; for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, x = m.x + Math.cos(a) * 1.6, y = m.y + Math.sin(a) * 1.6; if (walk(G.Wd, x, y)) { const n = mkMob('fluff', x, y, 7); n.st = 'chase'; G.mobs.push(n); } } G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 2, t: 0, life: .5, c: '#e8e0f4' }); say('우두머리 보풀이 보풀이를 불러냈어요!', '#e8e0f4', 1); }
  if (m.gust <= 0 && d < 6) { m.gust = 7; m.an = 'atk'; m.at = 0; m.hitDone = 0; m.kind = 'gust'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 3.4, t: 0, life: .8, cone: [dx / d, dy / d] }); return; }
  if (d > m.r + .9) { move(m, dx / d * m.spd * dt, dy / d * m.spd * dt); m.an = 'move'; }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = 2.6; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 2.4, t: 0, life: .8 }); }
  else m.an = 'idle';
}
function bossHit(m) {
  const P = G.P, d = hyp(P.x - m.x, P.y - m.y);
  if (m.kind === 'slam') { G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 2.4, t: 0, life: .4, c: '#fff' }); G.shake = 8; sfx('slam'); if (d < 2.4 + P.r) hurtPlayer(rnd(m.dmg[0], m.dmg[1]), m); }
  else { G.fx.push({ k: 'gust', x: m.x, y: m.y, dx: (P.x - m.x) / d, dy: (P.y - m.y) / d, r: 3.4, arc: 1.2, t: 0, life: .4 }); sfx('gust'); if (d < 3.4) { hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * .7, m); const kx = (P.x - m.x) / d * 3.2; const ky = (P.y - m.y) / d * 3.2; for (let i = 0; i < 10; i++) move(P, kx / 10, ky / 10); } }
}
function projUpdate(p, dt) {
  p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.k !== 'twister' && !ground(G.Wd, p.x, p.y) && !G.Wd.inb(Math.floor(p.x), Math.floor(p.y))) p.life = 0;
  const P = G.P;
  if (p.k === 'twister') { p.tick -= dt; for (const m of mobsIn(m => hyp(m.x - p.x, m.y - p.y) < p.r + m.r)) { if (!m.D.boss) move(m, (p.x - m.x) * dt * 2.5, (p.y - m.y) * dt * 2.5); } if (p.tick <= 0) { p.tick = .3; for (const m of mobsIn(m => hyp(m.x - p.x, m.y - p.y) < p.r * .8 + m.r)) { const [d, c] = rollDmg(P, m, p.mult); hitMob(m, d, c); } } return; }
  for (const m of G.mobs) { if (m.dead || p.hit.has(m)) continue; if (hyp(m.x - p.x, m.y - p.y) < m.r + .25) { p.hit.add(m); const [d, c] = rollDmg(P, m, p.mult); hitMob(m, d, c, { kb: p.k === 'wind' ? 1.5 : 0, fx: p.x - p.vx, fy: p.y - p.vy }); G.fx.push({ k: 'pop', x: p.x, y: p.y, t: 0, life: .25, c: p.k === 'bolt' ? '#fff3a0' : '#dff4ff' }); if (!p.pierce) { p.life = 0; break; } } }
}
function areaUpdate(a, dt) {
  if (a.k === 'delay') { a.t += dt; if (a.t >= 0 && !a.done) { a.done = 1; a.fn(); } return; }
  a.t += dt; const P = G.P;
  if (a.k === 'flag') { a.tick -= dt; if (hyp(P.x - a.x, P.y - a.y) < a.r) { const k = a.fk === 1 ? 2 : 1; P.hp = Math.min(P.mhp, P.hp + P.mhp * .025 * k * dt); P.wind = Math.min(P.mwind, P.wind + 3 * k * dt); }
    if (a.fk === 0 && a.tick <= 0) { a.tick = 2; G.fx.push({ k: 'ring', x: a.x, y: a.y, r: a.r, t: 0, life: .4, c: '#bfe8ff' }); for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c, { kb: 5, fx: a.x, fy: a.y }); } } }
  if (a.k === 'mist' && a.fk === 1) { a.tick -= dt; if (a.tick <= 0) { a.tick = 1; for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c); G.fx.push({ k: 'zap', x: a.x, y: a.y, x2: m.x, y2: m.y, t: 0, life: .2 }); } } }
}
function pickUp(d) {
  const P = G.P;
  if (d.gold) { P.gold += d.gold; d.got = 1; G.txt.push({ x: d.x, y: d.y, z: 1, t: 0, s: '+' + d.gold + 'G', c: '#ffd166', small: 1 }); sfx('coin'); return; }
  if (!addInv(d.it)) { if (!d.warn) { d.warn = 1; say('가방이 가득 찼어요', '#ff9a8a', 1); } return; }
  d.got = 1; sfx('pick'); if (d.it.g === 'plank') say('다리 널빤지 ' + count('plank') + '/6', '#ffe08a', 1);
  else if (!d.it.g && d.it.r >= 2) say(RAR[d.it.r].n + ' 장비! ' + itemName(d.it), RAR[d.it.r].c);
}
function addInv(it) { const P = G.P; if (it.g) { const h = P.inv.find(x => x.g === it.g); if (h) { h.n += it.n; return true; } } if (P.inv.length >= 40) return false; P.inv.push(it); return true; }
function count(g) { const h = G.P.inv.find(x => x.g === g); return h ? h.n : 0; }
function useGood(g, n) { const P = G.P, h = P.inv.find(x => x.g === g); if (!h || h.n < (n || 1)) return false; h.n -= n || 1; if (h.n <= 0) P.inv.splice(P.inv.indexOf(h), 1); return true; }
function drink(g) { const P = G.P; if (P.dead) return; if (!useGood(g)) { say(g === 'pot' ? '민들레 차가 없어요' : '바람 사탕이 없어요', '#ccc', 1); return; } if (g === 'pot') P.hp = Math.min(P.mhp, P.hp + P.mhp * .4); else P.wind = Math.min(P.mwind, P.wind + P.mwind * .5); G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .5, c: g === 'pot' ? '#b6f0a0' : '#9fe4ff' }); sfx('drink'); }
function say(s, c, quick) { if (G.msg.length && G.msg[G.msg.length - 1].s === s) { G.msg[G.msg.length - 1].t = 0; return; } G.msg.push({ s, c: c || '#fff', t: quick ? 2 : 0 }); if (G.msg.length > 4) G.msg.shift(); }
function autoSlots(P) { for (const s of SKILLS[P.cls]) if (P.sk[s.id] && !P.slots.includes(s.id) && s.t !== 'passive') { const i = P.slots.indexOf(null); if (i >= 0) P.slots[i] = s.id; } }

/* ---------- 퀘스트 ---------- */
function qSet(id, s) { const q = G.P.q[id] || (G.P.q[id] = { s: 0, n: 0 }); if (q.s < s) q.s = s; }
function qAdd(id, n) { const q = G.P.q[id]; if (!q || q.s !== 1) return; q.n += n; const Q = QUESTS[id]; if (q.n >= Q.need) { q.n = Q.need; q.s = 2; say('「' + Q.n + '」 완료! ' + NPCDEF[Q.from].n + '에게 돌아가요.', '#ffd166'); } }
// 근처에 무엇이 있는지 (상호작용 버튼)
function near() {
  const P = G.P, Wd = G.Wd; G.near = null; if (P.dead) return;
  for (const k in Wd.npcAt) { const [x, y] = Wd.npcAt[k]; if (hyp(P.x - x, P.y - y) < 1.5) { G.near = { k: 'npc', id: k, label: NPCDEF[k].n + ' 말 걸기' }; return; } }
  for (const w of Wd.wps) if (hyp(P.x - w.x, P.y - w.y) < 1.4) { if (!w.on && (w.n !== '바람개비 언덕' || P.flags.boss)) { w.on = 1; P.flags['wp_' + w.n] = 1; say('바람개비 표지 「' + w.n + '」에 바람이 깃들었어요', '#9fe4ff'); sfx('lvl'); if (w.n === '바람개비 언덕' && P.q.q3 && P.q.q3.s === 2) say('촌장 들메에게 돌아가 소식을 전해요.', '#ffd166'); save(); }
    G.near = w.on ? { k: 'wp', label: '바람개비 표지(이동)' } : { k: 'wpx', label: '아직 바람이 없어요(우두머리를 먼저)' }; return; }
  const b = Wd.bridges[Wd.bq]; if (b.broken) for (const c of b.cells) { const x = c % Wd.W + .5, y = ((c / Wd.W) | 0) + .5; if (hyp(P.x - x, P.y - y) < 2.2) { G.near = { k: 'bridge', label: count('plank') >= 6 ? '다리 고치기 (널빤지 6)' : '끊어진 다리 (널빤지 ' + count('plank') + '/6)' }; return; } }
}
function interact() {
  const n = G.near; if (!n) return; const P = G.P;
  if (n.k === 'npc') talk(n.id);
  else if (n.k === 'wp') openPanel('travel');
  else if (n.k === 'bridge') { if (count('plank') >= 6) { useGood('plank', 6); repairBridge(G.Wd, G.Wd.bq); P.flags.bridge = 1; qSet('q1', 2); G.shake = 5; sfx('lvl'); say('다리를 다시 놓았어요! 바람개비 언덕으로 건너갈 수 있어요.', '#ffd166'); for (const c of G.Wd.bridges[G.Wd.bq].cells) G.fx.push({ k: 'pop', x: c % G.Wd.W + .5, y: ((c / G.Wd.W) | 0) + .5, t: -Math.random() * .6, life: .5, c: '#ffe08a' }); save(); } else say('다리 널빤지가 ' + (6 - count('plank')) + '개 더 필요해요', '#ffe08a', 1); }
}
