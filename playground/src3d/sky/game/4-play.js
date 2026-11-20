
/* =================== 게임 진행 =================== */
let G = null, opts = {}, PM = {}; // PM: 소품 아틀라스 자리
const DIRV = [...Array(8)].map((_, d) => { const a = d * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; }); // 화면 방향
// 화면 방향 벡터 ↔ 월드 방향 벡터 (쿼터뷰)
const scr2w = (sx, sy) => { const wx = sx / TW * 2 / 2 + sy / TH * 2 / 2, wy = sy / TH - sx / TW; const l = hyp(wx, wy) || 1; return [wx / l, wy / l]; };
const w2dir = (wx, wy) => { const sx = (wx - wy) * TW / 2, sy = (wx + wy) * TH / 2; return ((Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) % 8) + 8) % 8; };
const dirW = d => scr2w(DIRV[d][0] * TW, DIRV[d][1] * TH * 2); // 방향 d 의 월드 단위벡터(화면에서 d로 보이는)

function newSave(cls) {
  const seed = (Math.random() * 1e9) | 0, it = id => makeItem(id, 0, 1, { id: 1, st: 0 });
  const CS = CLS_START[cls], eq = { weapon: it(CS[0]), off: it(CS[1]), armor: it('armor0'), legs: it('legs0'), sail: it('sail0') };
  return { v: 1, ch: 1, cls, seed, lv: 1, xp: 0, sp: {}, pts: 0, skp: 1, sk: { [CS[2]]: 1 }, fork: {}, fork2: {}, slots: [null, null, null, null], eq, inv: [goods('pot', 3), goods('wpot', 2)], gold: 30, q: {}, flags: {}, board: Array(19).fill(null), shd: [], kills: 0, t: Date.now(), rested: 0, play: 0, codex: {} };
}
function startGame(S) {
  if (S.ch === 8) { if (S.roam) roamSetup(S.roam); else S.ch = 7; }
  const Wd = makeWorld(S.ch === 8 ? S.roam.seed : S.seed, S.ch || 1); Wd.props = placeProps(Wd, PM); setNpcNames(Wd.ch);
  if (Wd.ch === 8) repairBridge(Wd, Wd.bq);
  else if (Wd.ch >= 3) { if (S.flags['c' + Wd.ch + 'bridge']) repairBridge(Wd, Wd.bq); }
  else if (Wd.ch === 2) { if (S.flags.c2bridge) repairBridge(Wd, Wd.bq); }
  else { if (S.flags.bridge) repairBridge(Wd, Wd.bq); if (S.flags.bridge2) repairBridge(Wd, Wd.bq2); }
  for (const w of Wd.wps) if (S.flags[wpk(w.n)]) w.on = 1;
  if (!S.board) S.board = Array(19).fill(null); if (!S.shd) S.shd = []; if (!S.fork2) S.fork2 = {};
  const T = Wd.islands[Wd.town];
  const P = { ...S, x: T.cx + 1.5, y: T.cy + 2.5, r: .28, dir: 2, an: 'idle', at: 0, atkT: 0, cds: {}, buf: {}, hp: null, wind: null, dodge: 0, dcd: 0, inv0: 0, tgt: null, path: null, dead: 0, combo: 0 };
  // 순풍: 쉬는 동안 쌓이는 경험치 2배 몫(최대 다음 레벨 필요량의 절반)
  const away = Math.max(0, Date.now() - (S.t || Date.now())) / 36e5; P.rested = Math.min(xpNeed(P.lv) * .5, (S.rested || 0) + away * xpNeed(P.lv) * .06);
  G = { Wd, P, mobs: [], proj: [], fx: [], txt: [], drops: [], areas: [], parts: [], t: 0, cam: [P.x, P.y], shake: 0, packs: [], msg: [], hitstop: 0, flash: 0, cut: null };
  calc(P); P.hp = P.mhp; P.wind = P.mwind; autoSlots(P);
  dailyStart(); spawnAll(); restNote(S); if (Wd.ch === 1 && !S.q.q1 || Wd.ch === 2 && !S.q.q8 || Wd.ch === 3 && !S.q.q13 || CHX[Wd.ch] && Wd.ch < 8 && !S.q[CHX[Wd.ch].qid[0]]) setTimeout(() => talk('chief', true), 600); boardCheck();
  return G;
}
function snap() { const P = G.P, S = {}; for (const k of ['v', 'ch', 'cls', 'seed', 'lv', 'xp', 'sp', 'pts', 'skp', 'sk', 'fork', 'fork2', 'slots', 'eq', 'inv', 'gold', 'q', 'flags', 'board', 'shd', 'kills', 'rested', 'play', 'codex', 'daily', 'errand', 'shopD', 'stash', 'diff', 'roam', 'lost', 'lostX']) S[k] = P[k]; S.t = Date.now(); S.uid = UID; S.lang = LANG; return S; }
function save() { if (!G) return; const P = G.P, S = snap();
  try { localStorage.setItem('sky_' + P.cls, JSON.stringify(S)); } catch (e) {} cloudQueue(S); }
/* ---------- 서버에도 저장(5락실 프로필 복구 코드가 있을 때만) ---------- */
const pcode = () => { try { return localStorage.getItem('nr_pcode') || ''; } catch (e) { return ''; } };
let CLOUD = { last: 0, pend: null, busy: 0, ok: null };
function cloudPut(S, keep) { const code = pcode(); if (!code) return; CLOUD.busy = 1; CLOUD.last = Date.now();
  return fetch('/api/skysave', { method: 'POST', keepalive: !!keep, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'put', code, cls: S.cls, data: S }) })
    .then(r => r.json().then(j => { CLOUD.ok = r.ok || r.status === 409; if (r.status === 409 && j.data) { try { localStorage.setItem('sky_' + S.cls, JSON.stringify(j.data)); } catch (e) {} } })).catch(() => { CLOUD.ok = false; }).finally(() => { CLOUD.busy = 0; }); }
function cloudQueue(S, now) { if (!pcode()) return; CLOUD.pend = S; if (now || Date.now() - CLOUD.last > 60000) { CLOUD.pend = null; cloudPut(S, now); } }
setInterval(() => { if (CLOUD.pend && !CLOUD.busy && Date.now() - CLOUD.last > 60000) { const S = CLOUD.pend; CLOUD.pend = null; cloudPut(S); } }, 15000);
function cloudFlush() { if (CLOUD.pend) { const S = CLOUD.pend; CLOUD.pend = null; cloudPut(S, 1); } }
// 처음 화면: 서버 기록이 이 기기 것보다 나중이면 가져온다
function cloudPull() { const code = pcode(); if (!code) return Promise.resolve(null);
  return fetch('/api/skysave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'get', code }) }).then(r => r.ok ? r.json() : null).then(j => { if (!j || !j.saves) return null; let n = 0;
    for (const cls in j.saves) { const loc = loadSave(cls), sv = j.saves[cls].data; if (sv && sv.v === 1 && (!loc || (sv.t || 0) > (loc.t || 0) + 1000)) { try { localStorage.setItem('sky_' + cls, JSON.stringify(sv)); n++; } catch (e) {} } }
    CLOUD.ok = true; return n; }).catch(() => null); }
function loadSave(cls) { try { const s = JSON.parse(localStorage.getItem('sky_' + cls) || 'null'); if (s && s.v === 1) { UID = Math.max(UID, s.uid || 1); return s; } } catch (e) {} return null; }

/* ---------- 몹 ---------- */
const ISL_LV = { 0: [1, 2], 1: [2, 3], 2: [4, 5], 3: [6, 7], 4: [5, 6] };
function mkMob(t, x, y, lv, elite) {
  const D = MOBDEF[t], E = elite ? ELITE[elite - 1] : null, m0 = E ? E[2] : {}, T = dT(), K = chD(), kh = D.boss ? 1 + (K.hp - 1) * .7 : K.hp; lv += T.lv; const m = { hp: (m0.hp || 1) * T.hp * kh, dmg: (m0.dmg || 1) * T.dmg * K.dmg, spd: m0.spd || 1 };
  const hp = Math.round((D.hp[0] + D.hp[1] * lv) * (m.hp || 1) * (elite ? 1.3 : 1) * DIFF.hp);
  return { t, D, x, y, hx: x, hy: y, lv, hp, mhp: hp, dmg: [(D.dmg[0] + D.dmg[2] * lv) * (m.dmg || 1) * DIFF.dmg, (D.dmg[1] + D.dmg[2] * lv * 1.3) * (m.dmg || 1) * DIFF.dmg], spd: D.spd * (m.spd || 1) * DIFF.spd, r: D.r, dir: ri(0, 7), an: 'idle', at: Math.random(), cd: 1, st: 'idle', kx: 0, ky: 0, stun: 0, slow: 0, elite, E, kbimm: m.kbimm, wan: rnd(1, 4), fl: 0, fear: 0, taunt: 0, miss: 0, bleed: 0, id: Math.random(), cdm: K.cd, xpm: 1 + (kh - 1) * .5 };
}
function spawnPack(pk) {
  const s = G.Wd.islands[pk.isl], R = Math.random; pk.mobs = []; if (G.today === pk.isl && !pk.boss && !pk.elite) pk.elite = ri(1, ELITE.length);
  if (!pk.boss && pk.chd == null) { const K = chD(); pk.chd = 1; pk.n += K.add; if (!pk.elite && R() < K.elite) pk.elite = ri(1, ELITE.length); }
  for (let tries = 0; tries < 30 && pk.mobs.length < pk.n; tries++) {
    const a = R() * TAU, d = R() * 1.8, x = pk.x + Math.cos(a) * d, y = pk.y + Math.sin(a) * d;
    if (!walk(G.Wd, x, y)) continue; const elite = pk.elite && pk.mobs.length === 0 ? pk.elite : 0;
    const i = pk.mobs.length, lead = pk.lead && i === 0, m = lead ? mkMob(pk.lead, pk.x, pk.y, pk.lv[1] + 1, 0) : mkMob(pk.boss ? pk.kinds[(i - (pk.lead ? 1 : 0)) % pk.kinds.length] : foeSwap(pk.kinds[(i - (pk.lead ? 1 : 0)) % pk.kinds.length]), x, y, ri(pk.lv[0], pk.lv[1]), elite && !pk.lead ? elite : (pk.lead && i === 1 ? pk.elite : 0)); m.pk = pk; pk.mobs.push(m); G.mobs.push(m);
  }
  pk.dead = 0; pk.clear = 0; pk.bl = pk.bl || 0;
}
function spawnAll() {
  const Wd = G.Wd; G.mobs = []; G.packs = [];
  if (Wd.ch === 2) return spawnCh2();
  if (Wd.ch === 3) return spawnCh3();
  if (Wd.ch >= 4) return spawnChX();
  Wd.fi.forEach((k, i) => { const s = Wd.islands[k], n = 3 + (i >= 2 ? 1 : 0);
    for (let j = 0; j < n; j++) { const a = j / n * TAU + i, d = s.r * .5; let x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d; if (!walk(Wd, x, y)) { x = s.cx; y = s.cy; }
      const kind = pick([['fluff'], ['fluff'], ['seed', 'fluff'], ['bird'], ['seed']]);
      // 섬마다 한 무리는 둥지: 둥지지기 + 무리, 땅이 시들고 어두워짐(마을 옆 첫 섬은 빼고)
      const nest = j === 0 && i >= 1;
      const pk = nest ? { isl: k, x, y, lv: ISL_LV[i], kinds: ['fluff', 'seed', 'fluff'], n: 6, lead: 'keeper', nest: 1, elite: ri(1, ELITE.length) }
        : { isl: k, x, y, lv: ISL_LV[i], kinds: kind, n: kind[0] === 'fluff' ? ri(4, 6) : kind[0] === 'bird' ? 3 : ri(2, 4), elite: Math.random() < .22 ? ri(1, ELITE.length) : 0 };
      G.packs.push(pk); spawnPack(pk); } });
  spawnCh1b();
  const H = Wd.islands[Wd.hill];
  if (!G.P.flags.boss) { const pk = { isl: Wd.hill, x: H.cx + .5, y: H.cy - .5, lv: [9, 9], kinds: ['fluffking'], n: 1, boss: 1, nest: 1 }; G.packs.push(pk); spawnPack(pk); }
  const pk2 = { isl: Wd.hill, x: H.cx - 3, y: H.cy + 3, lv: [7, 8], kinds: ['fluff', 'seed'], n: 4 }; G.packs.push(pk2); spawnPack(pk2);
}

/* ---------- 움직임·충돌 ---------- */
function canAt(e, x, y) { if (e.D && e.D.fly) { const X = Math.floor(x), Y = Math.floor(y); return G.Wd.inb(X, Y) && G.Wd.g[G.Wd.id(X, Y)] !== 0 && !G.Wd.block[G.Wd.id(X, Y)] || false; } const r = e.r * .8; return walk(G.Wd, x, y) && walk(G.Wd, x + r, y) && walk(G.Wd, x - r, y) && walk(G.Wd, x, y + r) && walk(G.Wd, x, y - r); }
function move(e, dx, dy) { let moved = 0; if (dx && canAt(e, e.x + dx, e.y)) { e.x += dx; moved = 1; } if (dy && canAt(e, e.x, e.y + dy)) { e.y += dy; moved = 1; } return moved; }
// 밀려남: 빈 하늘로 밀리면 떨어진다
function knock(m, dx, dy, f) {
  if (m.D.big || m.kbimm || m.fl) return; const l = hyp(dx, dy) || 1; m.kx += dx / l * f; m.ky += dy / l * f;
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
  if (m.mark > 0) dmg = Math.round(dmg * (1 + (m.markP || .3)));
  m.hp -= dmg; m.flash = .16; m.sq = .2; G.txt.push({ x: m.x + rnd(-.2, .2), y: m.y + rnd(-.2, .2), z: 1, t: 0, s: crit ? dmg + '!' : String(dmg), c: crit ? '#ffcf4a' : o.tick ? '#e8e8e8' : '#fff', big: crit, pop: 1 });
  if (o.kb) knock(m, m.x - (o.fx ?? G.P.x), m.y - (o.fy ?? G.P.y), o.kb * G.P.kbm);
  if (o.stun) m.stun = Math.max(m.stun, o.stun); if (o.slow) m.slow = Math.max(m.slow, o.slow); if (o.bleed) m.bleed = { t: 3, d: o.bleed };
  if (m.st === 'idle') m.st = 'chase';
  if (!m.D.big && m.stun <= 0 && Math.random() < .5) { m.an = 'hurt'; m.at = 0; }
  // 맞는 느낌: 불꽃 튐 + 고리 + 아주 짧은 멈춤
  const col = o.col || (CLASSES[G.P.cls].melee ? '#fff1c8' : '#dff4ff'), hx = m.x - .15, hy = m.y - .15, hz = (m.D.boss ? 60 : m.D.mini ? 44 : 22);
  if (!o.tick) { const n = crit ? 18 : 10, dx = m.x - (o.fx ?? G.P.x), dy = m.y - (o.fy ?? G.P.y), dl = hyp(dx, dy) || 1;
    for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + rnd(-1.2, 1.2), sp = rnd(2.5, crit ? 8 : 5.5); G.parts.push({ k: 'spark', x: hx, y: hy, z: hz + rnd(-6, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(40, 220), t: 0, life: rnd(.18, .38), c: i % 3 ? col : '#ffffff', s: crit ? 3.2 : 2.4 }); }
    G.fx.push({ k: 'hit', x: hx, y: hy, z: hz, t: 0, life: crit ? .32 : .2, c: crit ? '#ffd166' : col, big: crit });
    G.hitstop = Math.max(G.hitstop, crit ? .07 : .028); G.shake = Math.max(G.shake, crit ? 4.5 : 1.4); }
  sfx(crit ? 'crit' : 'hit');
  if (m.hp <= 0) killMob(m);
}
function killMob(m, fell) {
  if (m.dead) return; m.dead = 1; m.an = 'die'; m.at = 0; const P = G.P, D = m.D;
  if (m.mark > 0 && m.markT) markMove(m);
  let xp = (D.xp[0] + D.xp[1] * m.lv) * (m.elite ? 3 : 1) * (m.xpm || 1) * P.xpm * dT().xp; if (m.lv < P.lv - 5) xp *= .3;
  const bonus = Math.min(P.rested, xp); P.rested -= bonus; gainXp(Math.round(xp + bonus));
  if (P.lifek) P.hp = Math.min(P.mhp, P.hp + P.lifek); if (P.windk) P.wind = Math.min(P.mwind, P.wind + P.windk);
  for (const s in P.eq) if (P.eq[s] && P.eq[s].hid) { const it = P.eq[s]; it.tame = (it.tame || 0) + 1; if (it.tame === TAME_N) { say('길들이기 완료! ' + itemName(it) + ' 숨은 옵션: ' + afxText(it.hid[0], it.hid[1], P.cls), '#c9a8ff'); calc(P); } }
  P.kills++; P.codex[m.t] = (P.codex[m.t] || 0) + 1;
  if (m.t === 'fluff') qAdd('q2', 1);
  if (D.chboss) {}
  else if (D.rustship) { P.flags.rustship = 1; if (P.q.q17 && P.q.q17.s === 1) qSet('q17', 2); G.shake = 14; G.flash = .4; say('녹슨 비행선이 내려앉았어요! 녹슨 정박장 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); }
  else if (D.creaker) { P.flags.creaker = 1; if (P.q.q12 && P.q.q12.s === 1) qSet('q12', 2); G.shake = 14; G.flash = .4; say('삐걱 파수꾼이 멈췄어요! 큰 풍차섬 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); }
  else if (D.heron) { P.flags.heron = 1; if (P.q.q7 && P.q.q7.s === 1) qSet('q7', 2); G.shake = 14; G.flash = .4; say('큰 왜가리가 쓰러졌어요! 둥지섬 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); }
  else if (D.boss) { P.flags.boss = 1; qSet('q3', 2); G.shake = 10; say('우두머리 보풀이 흩어졌어요! 언덕의 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); }
  ch1Kill(m); ch2Kill(m); ch3Kill(m); chXKill(m); dailyKill(m, fell);
  if (fell) { G.txt.push({ x: m.x, y: m.y, z: 1, t: 0, s: '떨어짐!', c: '#9fe4ff' }); sfx('fall'); }
  else { burst(m.x, m.y, m.t, D.boss ? 3 : D.mini ? 2.2 : m.elite ? 1.6 : 1); killFx(m); }
  if (D.mini && m.pk) cleanse(m.pk);
  if (D.boss && !fell) setTimeout(() => fbNudge('boss', m.t + (P.diff || 0)), 2500);
  drops(m, fell);
  if (m.pk) { m.pk.dead++; if (m.pk.dead >= m.pk.mobs.length) { m.pk.clear = G.t; } }
}
function drops(m, fell) {
  const P = G.P, D = m.D, put = it => { const a = Math.random() * TAU, d = .3 + Math.random() * .6; let x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d; if (!walk(G.Wd, x, y)) { x = P.x; y = P.y; } if (it.gold) G.drops.push({ x, y, gold: it.gold, t: 0 }); else G.drops.push({ x, y, it, t: 0 }); };
  if (fell) { if (Math.random() < .5) G.drops.push({ x: P.x + rnd(-.5, .5), y: P.y + rnd(-.5, .5), gold: ri(m.lv, m.lv * 3), t: 0 }); return; }
  const T = dT(), ilv = Math.min(m.lv, 99) + (m.elite ? 1 : 0) + (D.boss ? 2 : D.mini ? 1 : 0);
  if (Math.random() < .55 || m.elite || D.mini) put({ gold: Math.round(ri(m.lv * 2, m.lv * 5) * (D.mini ? 6 : m.elite ? 3 : 1) * (m.pk && m.pk.isl === G.today ? 1.5 : 1) * T.gold) });
  const nItem = D.boss ? 3 : D.mini ? 2 : m.elite ? (Math.random() < .7 ? 2 : 1) : (Math.random() < .1 * (1 + P.find / 100) ? 1 : 0);
  for (let i = 0; i < nItem; i++) put(rollDrop(ilv, P.find + T.find + (m.elite ? 60 : 0) + (D.boss ? 150 : D.mini ? 90 : 0), P.cls));
  roamDrops(m, put);
  if (D.chboss) { if (G.Wd.ch !== 8) chXDrops(m, put); }
  else if (D.rustship) { put(chUniq(3, 34)); const sp = pick(SETS.harbor.parts); put(makeItem(sp[0], 4, 34, { set: 'harbor' })); put(goods('bhone')); put(goods('bglue')); }
  else if (D.creaker) { put(chUniq(2, 25)); const sp = pick(SETS.mill.parts); put(makeItem(sp[0], 4, 25, { set: 'mill' })); put(goods('bhone')); put(goods('bglue')); }
  else if (D.boss) { const u = CLS_START[P.cls][4]; put(makeItem(UNIQ.find(x => x.id === u).base, 3, 9, { u })); if (Math.random() < .5) put(makeItem('helm2', 3, 8, { u: 'u_millcap' })); put(goods('bhone')); }
  // 바람 조각: 둥지지기 1개, 우두머리 2개, 정예는 가끔
  const col = () => pick(Object.keys(SHARD));
  if (P.lv >= BOARD_LV || D.big) { if (D.mini) giveShard({ c: col(), q: Math.random() < .3 ? 2 : 1 }); else if (D.boss) { giveShard({ c: col(), q: 3 }); giveShard({ c: col(), q: 2 }); } else if (m.elite && Math.random() < .1) giveShard({ c: col(), q: 1 }); }
  const R = Math.random();
  if (R < .08) put(goods('pot')); else if (R < .14) put(goods('wpot')); else if (R < .2) put(goods('hone')); else if (R < .26) put(goods('glue')); else if (R < .265) put(goods('bhone')); else if (R < .27) put(goods('bglue'));
  if (P.q.q1 && P.q.q1.s === 1 && count('plank') + G.drops.filter(d => d.it && d.it.g === 'plank').length < 6 && Math.random() < .35) put(goods('plank'));
}
// 쓰러질 때 흩어지는 조각(솜털·씨앗 껍질·깃털)
function blightR(pk) { return pk.boss ? 5 : pk.nest ? 4.4 : 2.6; }
function cleanse(pk) { // 둥지지기 쓰러짐: 둥지 걷힘
  G.fx.push({ k: 'ring', x: pk.x, y: pk.y, r: blightR(pk), t: 0, life: .7, c: '#fff1b0' }); G.flash = Math.max(G.flash, .18);
  for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, r = Math.random() * blightR(pk); G.parts.push({ k: 'puff', x: pk.x + Math.cos(a) * r, y: pk.y + Math.sin(a) * r, z: 2, vx: 0, vy: 0, vz: rnd(80, 200), t: 0, life: rnd(.6, 1.2), c: pick(['#fff1b0', '#bff0a0', '#ffffff']), s: rnd(1.6, 2.6) }); }
  say('둥지지기를 쓰러뜨렸어요! 둥지가 걷혀요.', '#fff1b0', 1);
}
function burst(x2, y2, t, k) {
  const C = { rustfluff: ['#8a4e2a', '#5a2e18', '#c8783a'], boltpod: ['#4a4a52', '#8a6a5a', '#c8b090'], rustcrow: ['#5a3a2a', '#3a2418', '#ff8a2a'], scarecrow: ['#c8a050', '#6a3a2a', '#9a8058'], cogkeeper: ['#5a4e48', '#9a5a2a', '#cfc0a0'], creaker: ['#6a4a30', '#5a4e48', '#9a5a2a', '#e8d8b0'], saltfluff: ['#a8b8c8', '#e8eef4', '#7a8a9a'], barnpod: ['#4a5a5a', '#c8c0b0', '#8a9a9a'], gull: ['#d8dce4', '#8a929e', '#e8a83a'], crab: ['#b04a2a', '#e8c8a0', '#6a5a50'], barnkeeper: ['#3a4a4e', '#c8c0b0', '#8a9a9a', '#b04a2a'], rustship: ['#4a3424', '#8a3a2a', '#c8b090', '#5a4e48'], fluff: ['#6e6578', '#4a4252', '#8a8098', '#ff6a3a'], fluffking: ['#4e4460', '#2e2638', '#b04aff', '#ff4a2a'], seed: ['#4a3e2a', '#9a3a2a', '#d8c8a0'], bird: ['#2c2834', '#1e1a24', '#ffc23a'], keeper: ['#2e261c', '#cfc0a0', '#b04aff', '#9a3a2a'], mudfluff: ['#6a5034', '#3e2c1c', '#8a7050'], bogpod: ['#3a5a2a', '#9a3a2a', '#c8d0a0'], heronling: ['#5a6a7a', '#3a4250', '#d8dce4'], heron: ['#56606e', '#d8dce4', '#2e3440', '#e0a83a'] }[t] || MOBCOL[t] || ['#fff'];
  const n = Math.round(14 * k); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = rnd(1, 4.5) * Math.sqrt(k);
    G.parts.push({ k: t === 'seed' || t === 'keeper' || t === 'bogpod' || t === 'barnpod' || t === 'barnkeeper' || t === 'rustship' || t === 'crab' ? 'chip' : t === 'bird' || t === 'heronling' || t === 'heron' || t === 'gull' ? 'leaf' : 'puff', x: x2, y: y2, z: rnd(10, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 260), t: 0, life: rnd(.5, 1.1), c: pick(C), s: rnd(2.5, 5.5) * Math.sqrt(k), rot: Math.random() * TAU }); }
  G.fx.push({ k: 'ring', x: x2, y: y2, r: .9 * k, t: 0, life: .3, c: '#ffffff' }); G.hitstop = Math.max(G.hitstop, .04);
}
function gainXp(n) { const l0 = G.P.lv; gainXp0(n); if (Math.floor(G.P.lv / 10) > Math.floor(l0 / 10)) fbNudge('lv', 'lv' + Math.floor(G.P.lv / 10) * 10); boardCheck(); if (!G.P.daily && G.P.lv >= DAILY_LV) dailyCheck(); }
// 3레벨: 나침반판이 열리고 처음 조각 2개
function boardCheck() { const P = G.P; if (P.lv < BOARD_LV || P.flags.board0) return; P.flags.board0 = 1; giveShard({ c: 'sky', q: 1 }, 1); giveShard({ c: 'fire', q: 1 }, 1); G.cut = { s: '나침반판이 열렸어요 (B)', c: '#9fe4ff', t: 0 }; say('나침반판이 열렸어요! 기술 창(S)이나 B 키로 바람 조각을 끼워 보세요.', '#9fe4ff'); }
function giveShard(sh, quiet) { const P = G.P; if (P.shd.length >= SHD_MAX) { P.gold += 30 * sh.q; if (!quiet) say('조각 주머니가 가득 차서 ' + 30 * sh.q + 'G로 바꿨어요', '#ffd166'); return; } P.shd.push(sh); if (!quiet) { say('바람 조각 「' + shardName(sh) + '」을 얻었어요!', SHARD[sh.c].c); G.txt.push({ x: P.x, y: P.y, z: 2.6, t: 0, s: '◆ ' + shardName(sh), c: SHARD[sh.c].c, pop: 1 }); sfx('ench'); } }
function gainXp0(n) {
  const P = G.P; P.xp += n; G.txt.push({ x: P.x, y: P.y, z: 2.2, t: 0, s: '+' + n + ' 경험', c: '#b6f0a0', small: 1 });
  while (P.xp >= xpNeed(P.lv)) { P.xp -= xpNeed(P.lv); P.lv++; P.flags.lvAt = Date.now(); P.pts += 5; P.skp++; calc(P); P.hp = P.mhp; P.wind = P.mwind; G.fx.push({ k: 'lvl', x: P.x, y: P.y, t: 0, life: 1.4 }); sfx('lvl'); say(lvT(P.lv) + '! 스탯 5점, 스킬 1점이 생겼어요.', '#ffd166'); if (P.lv === ULT[P.cls].req) { autoSlots(P); say('궁극 기술 「' + ULT[P.cls].name + '」을 익혔어요! 4번으로 써 보세요.', '#ffcf7a'); } }
}
function hurtPlayer(d, src) {
  const P = G.P; if (P.dead || P.dodge > 0 || P.inv0 > 0 || DEBUG && G.god) return;
  if (src && src.miss && Math.random() < .4) { G.txt.push({ x: P.x, y: P.y, z: 1.4, t: 0, s: '헛손질', c: '#ccc', small: 1 }); return; }
  const hitCh = clamp(.92 - P.ac * .008, .55, .95); if (Math.random() > hitCh) { G.txt.push({ x: P.x, y: P.y, z: 1.4, t: 0, s: '피함', c: '#9fe4ff', small: 1 }); return; }
  if (Math.random() * 100 < P.blk) { G.txt.push({ x: P.x, y: P.y, z: 1.4, t: 0, s: '막음', c: '#ffd27a', small: 1 }); sfx('block'); return; }
  d = d * 100 / (100 + P.ac * 3);
  if (P.buf.parry) { parryHit(P, src); return; }
  if (P.buf.dome) { d *= P.fork.dome === 1 ? .3 : .5; if (P.fork.dome === 0) ringWave(P.x, P.y, 1.8, .4, { kb: 3 }); }
  if (P.buf.hold) { d *= 1 - (.3 + .02 * skLvId('hold')); if (P.fork.hold === 0 && src && src.hp > 0) hitMob(src, Math.round(d * .4), false); }
  if (P.buf.cloud && P.cloudHP > 0) { const a = Math.min(P.cloudHP, d); P.cloudHP -= a; d -= a; if (P.fork.cloud === 0 && src) src.slow = 2; if (P.cloudHP <= 0) P.buf.cloud = 0; }
  if (P.thorn && src && src.hp > 0) hitMob(src, P.thorn, false);
  d = Math.max(0, Math.round(d)); if (!d) return;
  P.hp -= d; P.hurt = .25; hurtFx(src, d); G.txt.push({ x: P.x, y: P.y, z: 1.2, t: 0, s: String(d), c: '#ff7a6a' }); G.shake = Math.max(G.shake, 2.5); sfx('hurt');
  if (src && src.t === 'bird') P.wind = Math.max(0, P.wind - 3);
  if (P.hp <= 0) { fbNudge('die'); P.hp = 0; P.dead = 2.6; P.an = 'die'; P.at = 0; sfx('die'); say('쓰러졌어요… 마을에서 다시 일어나요(골드 10% 잃음).', '#ff9a8a'); }
}
const skLvId = id => { const s = SKILLS[G.P.cls].find(x => x.id === id); return s ? skLv(G.P, s) : 0; };

/* ---------- 스킬 ---------- */
function weapAvg(P, big) { return big ? (P.dmg[2] + P.dmg[3]) / 2 : (P.dmg[0] + P.dmg[1]) / 2; }
function facingW(P) { if (P.aim) return P.aim; return dirW(P.dir); }
function mobsIn(fn) { return G.mobs.filter(m => !m.dead && fn(m)); }
function nearestMob(x, y, r, not) { let b = null, bd = r; for (const m of G.mobs) { if (m.dead || not && not.has(m)) continue; const d = hyp(m.x - x, m.y - y); if (d < bd) { bd = d; b = m; } } return b; }
function aimAt(P, m) { if (!m) return; const dx = m.x - P.x, dy = m.y - P.y, l = hyp(dx, dy) || 1; P.aim = [dx / l, dy / l]; P.dir = w2dir(dx, dy); }
function castSkill(i) {
  const P = G.P, id = P.slots[i]; if (!id || P.dead) return; if (id === 'ult') return castUlt();
  const s = SKILLS[P.cls].find(x => x.id === id), lv = skLv(P, s); if (!lv) return;
  const f2 = f2Of(P, id), cost = s.cost * (f2 === 1 ? .75 : 1);
  if ((P.cds[id] || 0) > 0) return; if (P.wind < cost) { say('바람이 모자라요', '#9fe4ff', 1); sfx('no'); return; }
  P.wind -= cost; P.cds[id] = s.cd * (f2 === 0 ? 1.15 : f2 === 1 ? .65 : 1); (P.cdx || (P.cdx = {}))[id] = P.cds[id]; const fk = lv >= 5 ? P.fork[id] : null;
  if (f2 === 0 && !s.m) { P.hp = Math.min(P.mhp, P.hp + P.mhp * .15); P.wind = Math.min(P.mwind, P.wind + 10); G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .5, c: '#b6f0a0' }); }
  const t = nearestMob(P.x, P.y, s.t === 'bolt' || s.t === 'twister' || s.t === 'chain' || s.t === 'mist' ? 8 : 3); if (t && !P.aimLock) aimAt(P, t);
  const [fx, fy] = facingW(P), mult = s.m * (1 + s.ml * (lv - 1)) * synergy(P, s) * (f2 === 0 ? 1.4 : 1), D = (m, k) => rollDmg(P, m, mult * (k || 1));
  P.an = ['buff', 'shout', 'flag', 'shield', 'mist', 'chain', 'twister'].includes(s.t) ? 'cast' : 'atk'; P.at = 0; P.atkDur = .38;
  sfx(CSK[s.t] ? CSKS[s.t] || 'nova' : s.t); castGlyph(P, s);
  if (CSK[s.t]) return CSK[s.t]({ P, s, id, lv, fk, t, fx, fy, mult, D });
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
// 궁극 기술
function castUlt() {
  const P = G.P, U = ULT[P.cls]; if (P.lv < U.req || (P.cds.ult || 0) > 0 || P.dead) return; P.cds.ult = U.cd;
  const t = nearestMob(P.x, P.y, 8); if (t && !P.aimLock) aimAt(P, t); const [fx, fy] = facingW(P), mult = 3.2 * (1 + P.lv * .04);
  G.cut = { s: U.name, t: 0, c: P.cls === 'warden' ? '#ffcf7a' : CLASSES[P.cls].col }; G.flash = .18; sfx('lvl'); castGlyph(P, { cd: 99 }); castGlyph(P, { cd: 99 });
  if (ULTF[P.cls]) return ULTF[P.cls](P, t, fx, fy, mult);
  if (P.cls === 'warden') { P.an = 'cast'; P.at = 0; P.atkDur = .5; P.jump = .48; P.inv0 = .7;
    G.areas.push({ k: 'delay', t: -.46, fn: () => { G.shake = 14; G.hitstop = .12; G.flash = .3; sfx('slam');
      G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 4, t: 0, life: .55, c: '#fff1c8' }, { k: 'ring', x: P.x, y: P.y, r: 2.4, t: 0, life: .4, c: '#ffcf7a' }, { k: 'crack', x: P.x, y: P.y, t: 0, life: 2.4 });
      for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, sp = rnd(2, 7); G.parts.push({ k: i % 2 ? 'chip' : 'dust', x: P.x, y: P.y, z: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(80, 320), t: 0, life: rnd(.5, 1), c: i % 2 ? '#8a6a44' : '#e8dcc0', s: rnd(3, 7), rot: Math.random() * TAU }); }
      for (const m of mobsIn(m => hyp(m.x - P.x, m.y - P.y) < 4 + m.r)) { const [d, c] = rollDmg(P, m, mult); hitMob(m, d, c, { kb: 11, stun: 1.6, col: '#ffcf7a' }); } } });
  } else { P.an = 'cast'; P.at = 0; P.atkDur = .5; const tx = t ? t.x : P.x + fx * 3.5, ty = t ? t.y : P.y + fy * 3.5;
    G.areas.push({ k: 'vortex', x: tx, y: ty, r: 3.8, t: 0, life: 2.6, tick: 0, mult }); }
}
// 기본 공격: 대상이 없으면 바라보는 쪽으로 휘두름(빈손질도 가능)
function basicAttack(free) {
  const P = G.P, C = CLASSES[P.cls]; if (P.atkT > 0 || P.dead) return false;
  let t = P.tgt && !P.tgt.dead ? P.tgt : free ? null : nearestMob(P.x, P.y, C.melee ? 1.9 : 7.5);
  if (t) { const d = hyp(t.x - P.x, t.y - P.y); if (C.melee && d > C.range + t.r + .1) { if (!free) return false; t = null; } }
  if (!t && !free) return false;
  if (t) aimAt(P, t); else if (P.aim) P.dir = w2dir(P.aim[0], P.aim[1]);
  P.atkT = 1 / P.aspd; P.an = 'atk'; P.at = 0; P.atkDur = Math.min(.42, 1 / P.aspd); P.pend = { t: P.atkDur * .45, m: t };
  return true;
}
function resolveBasic(m) {
  const P = G.P, C = CLASSES[P.cls], [ax, ay] = P.aim || dirW(P.dir);
  if (C.melee) {
    if (!m || m.dead || hyp(m.x - P.x, m.y - P.y) > C.range + m.r + .3) m = mobsIn(o => { const rx = o.x - P.x, ry = o.y - P.y, d = hyp(rx, ry); return d < C.range + o.r + .2 && (rx * ax + ry * ay) / (d || 1) > .45; }).sort((p, q) => hyp(p.x - P.x, p.y - P.y) - hyp(q.x - P.x, q.y - P.y))[0];
    P.combo = (P.combo || 0) + 1; basicFx(P, ax, ay, m);
    if (m) { const [d, c] = rollDmg(P, m, 1); hitMob(m, d, c, { kb: 1.4 }); if (P.cls === 'ringer') G.fx.push({ k: 'bellw', x: m.x, y: m.y, r: .9, t: 0, life: .3, c: '#e8d0ff' }); } else sfx('dodge');
  } else if (P.cls === 'trapper') { muzzleFx(P, ax, ay); G.proj.push({ k: 'arrow', x: P.x + ax * .4, y: P.y + ay * .4, vx: ax * 15, vy: ay * 15, life: .55, mult: 1, hit: new Set() }); sfx('shoot'); }
  else { muzzleFx(P, ax, ay); G.proj.push({ k: 'wind', x: P.x + ax * .4, y: P.y + ay * .4, vx: ax * 10, vy: ay * 10, life: .8, mult: .95, hit: new Set() }); sfx('shoot'); }
}

/* ---------- 매 프레임 ---------- */
function update(dt) {
  const P = G.P; G.t += dt; P.play += dt;
  if ((G.dck = (G.dck || 0) - dt) <= 0) { G.dck = 5; dailyCheck(); }
  G.flash = Math.max(0, G.flash - dt); if (G.cut) { G.cut.t += dt; if (G.cut.t > 1.3) G.cut = null; }
  for (const p of G.parts) { p.t += dt * (G.hitstop > 0 ? .25 : 1); }
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.k === 'puff' || p.k === 'leaf' ? 260 : 700) * dt; if (p.z < 0) { p.z = 0; p.vz *= -.3; p.vx *= .6; p.vy *= .6; } const f = p.k === 'puff' || p.k === 'leaf' ? Math.exp(-dt * 3) : Math.exp(-dt * 1.5); p.vx *= f; p.vy *= f; }
  G.parts = G.parts.filter(p => p.t < p.life); if (G.parts.length > 400) G.parts.splice(0, G.parts.length - 400);
  if (P.jump > 0) P.jump -= dt;
  for (const m of G.mobs) if (m.sq > 0) m.sq -= dt;
  // 버프·쿨다운
  for (const k in P.cds) if (P.cds[k] > 0) P.cds[k] -= dt;
  if (P.buf.well > 0 && !P.dead) P.hp = Math.min(P.mhp, P.hp + P.mhp * .012 * dt);
  let rc = 0; for (const k in P.buf) if (P.buf[k] > 0) { P.buf[k] -= dt; if (P.buf[k] <= 0) { P.buf[k] = 0; rc = 1; } } if (rc) calc(P);
  if (P.buf.hold && P.fork.hold === 1) P.hp = Math.min(P.mhp, P.hp + P.mhp * .02 * dt);
  clsUpdate(P, dt);
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
  for (const pk of G.packs) if (pk.clear && !pk.boss && G.t - pk.clear > (pk.nest ? 300 : 120) && hyp(P.x - pk.x, P.y - pk.y) > 14) spawnPack(pk);
  // 밑것이 모인 곳: 땅이 시들고 어두워짐. 무리가 다 쓰러지면 천천히 걷힘. 플레이어가 들어서면 화면도 어두워짐.
  let gl = 0; for (const pk of G.packs) { const alive = pk.mobs.some(m => !m.dead) ? 1 : 0; pk.bl = (pk.bl || 0) + (alive - (pk.bl || 0)) * Math.min(1, dt * (alive ? .5 : .7));
    const R = blightR(pk), d = hyp(P.x - pk.x, P.y - pk.y); if (d < R + 1.5) gl = Math.max(gl, pk.bl * (pk.nest ? 1 : .4) * clamp((R + 1.5 - d) / 2.5, 0, 1)); }
  G.gloom = (G.gloom || 0) + (gl - (G.gloom || 0)) * Math.min(1, dt * 2);
  // 투사체
  for (const p of G.proj) projUpdate(p, dt); G.proj = G.proj.filter(p => p.life > 0);
  // 지역 효과
  for (const a of G.areas) areaUpdate(a, dt); G.areas = G.areas.filter(a => a.k === 'delay' ? !a.done : a.t < a.life);
  for (const f of G.fx) f.t += dt; G.fx = G.fx.filter(f => f.t < f.life);
  for (const t of G.txt) t.t += dt; G.txt = G.txt.filter(t => t.t < 1); if (G.txt.length > TXT_MAX) G.txt.splice(0, G.txt.length - TXT_MAX);
  if (G.fx.length > FX_MAX) G.fx.splice(0, G.fx.length - FX_MAX);
  // 줍기
  for (const d of G.drops) { d.t += dt; if (P.dead || d.t < .35) continue; if (hyp(d.x - P.x, d.y - P.y) < .8) pickUp(d); else d.warn = 0; }
  for (const d of G.drops) if (!d.got && d.t >= dropLife(d)) toLost(d); G.drops = G.drops.filter(d => !d.got); if (G.drops.length > DROP_MAX) trimDrops();
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
  if (ix || iy) { P.path = null; P.tgt = null; P.goal = null; }
  // 클릭 이동/공격
  if (!ix && !iy && P.tgt) { if (P.tgt.dead) P.tgt = null; else { const d = hyp(P.tgt.x - P.x, P.tgt.y - P.y), C = CLASSES[P.cls]; if (d > (C.melee ? C.range + P.tgt.r : 6.5)) { ix = (P.tgt.x - P.x) / d; iy = (P.tgt.y - P.y) / d; } else if (!busy) basicAttack(); } }
  else if (!ix && !iy && P.path) { const d = hyp(P.path[0] - P.x, P.path[1] - P.y); if (d < .15) P.path = null; else { ix = (P.path[0] - P.x) / d; iy = (P.path[1] - P.y) / d; } }
  if (inputHeld('atk') && !busy) { if (MOUSE.atk && !TOUCH.on) { const [wx, wy] = mouseWorld(), m = mobAt(wx, wy); if (m) { const C = CLASSES[P.cls], d = hyp(m.x - P.x, m.y - P.y); if (C.melee && d > C.range + m.r) { P.tgt = m; } else { P.tgt = null; aimAt(P, m); basicAttack(true); } } else { const dx = wx - P.x, dy = wy - P.y, d = hyp(dx, dy) || 1; P.aim = [dx / d, dy / d]; P.tgt = null; P.path = null; ix = iy = 0; basicAttack(true); } }
    else basicAttack(); }
  // 누른 곳에 사람·표지·다리가 있으면 가까이 가서 말 걸기/쓰기
  if (P.goal) { const g = P.goal, d = hyp(g.x - P.x, g.y - P.y); if (d < (g.r || 1.4)) { P.goal = null; P.path = null; if (g.k === 'npc') talk(g.id); else if (g.k === 'wp') openPanel('travel'); else if (g.k === 'bridge') interact(); } else if (!P.path) P.goal = null; }
  if ((ix || iy) && !busy) {
    const sp = P.move * (P.hurt ? .7 : 1) * heavyMul(P) * dt; const ok = move(P, ix * sp, iy * sp); if (!ok && P.path) P.path = null;
    P.dir = w2dir(ix, iy); P.aim = null; if (P.an !== 'run') { P.an = 'run'; } P.runT = (P.runT || 0) + dt * P.move * heavyMul(P) / 3.6;
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
  if (m.mark > 0) m.mark -= dt;
  if (m.stun > 0) { m.stun -= dt; m.an = 'hurt'; return; }
  if (m.slow > 0) m.slow -= dt; if (m.taunt > 0) m.taunt -= dt; if (m.fear > 0) m.fear -= dt; m.cd -= dt;
  const P = G.P, dx = P.x - m.x, dy = P.y - m.y, d = hyp(dx, dy), sp = m.spd * (m.slow > 0 ? .55 : 1) * (G.areas.some(a => a.k === 'mist' && hyp(a.x - m.x, a.y - m.y) < a.r) ? .6 : 1);
  m.miss = G.areas.some(a => a.k === 'mist' && hyp(a.x - m.x, a.y - m.y) < a.r);
  if (m.an === 'atk') { // 공격 동작 중
    const wind = m.D.big ? .8 : .35;
    if (!m.hitDone && m.at > wind) { m.hitDone = 1; if (m.D.big) bossHit(m); else { const h = hyp(P.x - m.x, P.y - m.y) < m.r + P.r + .55; mobAtkHit(m, h); if (h) hurtPlayer(rnd(m.dmg[0], m.dmg[1]), m); } }
    if (m.at > wind + .3) { m.an = 'idle'; m.at = 0; } return;
  }
  if (m.an === 'hurt' && m.at < .2) return;
  if (P.dead) { m.st = 'idle'; }
  const aggro = (m.D.boss ? 9 : m.D.mini ? 7.5 : m.D.fly ? 8 : 6.5) + DIFF.aggro;
  if (m.st === 'idle') { if (d < aggro && !P.dead) m.st = 'chase'; else { m.wan -= dt; if (m.wan < 0) { m.wan = rnd(2, 5); m.wx = m.hx + rnd(-1.5, 1.5); m.wy = m.hy + rnd(-1.5, 1.5); }
      if (m.wx != null) { const ex = m.wx - m.x, ey = m.wy - m.y, el = hyp(ex, ey); if (el > .2) { move(m, ex / el * sp * .4 * dt, ey / el * sp * .4 * dt); m.dir = w2dir(ex, ey); m.an = 'move'; } else m.an = 'idle'; } } return; }
  // 집에서 너무 멀면 돌아감
  if (hyp(m.x - m.hx, m.y - m.hy) > 16 && m.taunt <= 0 || P.dead) { m.st = 'idle'; m.wx = m.hx; m.wy = m.hy; return; }
  if (m.fear > 0) { move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.dir = w2dir(-dx, -dy); m.an = 'move'; return; }
  m.dir = w2dir(dx, dy);
  if (m.D.ai === 'charge' && m.cd <= 0 && d > 2.2 && d < 5) { m.charge = .55; m.cvx = dx / d * 6.5; m.cvy = dy / d * 6.5; m.cd = 3.5; m.hitC = 0; mobAtkStart(m); }
  if (m.charge > 0) { m.charge -= dt; chargeTrail(m); move(m, m.cvx * dt, m.cvy * dt); m.an = 'atk'; m.at = .1; m.hitDone = 1; if (!m.hitC && hyp(P.x - m.x, P.y - m.y) < m.r + P.r + .2) { m.hitC = 1; hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * 1.3, m); } if (m.charge <= 0) { m.an = 'idle'; m.at = 0; } return; }
  if (m.D.ai === 'dive' && m.back > 0) { m.back -= dt; move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.an = 'move'; return; }
  if (m.D.big) return bossAI(m, dt, d, dx, dy);
  if (m.D.fk) return foeAI(m, dt, d, dx, dy, sp);
  if (m.D.ai === 'spit') return spitAI(m, dt, d, dx, dy, sp);
  if (m.D.ai === 'spin') return spinAI(m, dt, d, dx, dy, sp);
  const reach = m.r + P.r + .35;
  if (d > reach) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m); }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = m.D.atk * rnd(.9, 1.3) * DIFF.cd * (m.cdm || 1); mobAtkStart(m); if (m.D.ai === 'dive') m.back = .8; }
  else m.an = 'idle';
}
function separate(m) { for (const o of G.mobs) { if (o === m || o.dead) continue; const dx = m.x - o.x, dy = m.y - o.y, d = hyp(dx, dy), rr = m.r + o.r; if (d < rr && d > 0) { move(m, dx / d * (rr - d) * .3, dy / d * (rr - d) * .3); } } }
function bossAI(m, dt, d, dx, dy) {
  if (m.D.heron) return heronAI(m, dt, d, dx, dy);
  if (m.D.creaker) return creakerAI(m, dt, d, dx, dy);
  if (m.D.chboss) return chXBossAI(m, dt, d, dx, dy);
  if (m.D.rustship) return rustshipAI(m, dt, d, dx, dy);
  if (m.D.mini) { // 둥지지기: 가시 돌진 + 내려찍기, 피가 반 아래면 더 자주
    const rage = m.hp < m.mhp * .5 ? .65 : 1; m.gust = (m.gust ?? 3) - dt;
    if (m.gust <= 0 && d > 2 && d < 6.5) { m.gust = 6 * rage; m.warnC = .55; m.cvx = dx / d * 7.5; m.cvy = dy / d * 7.5; m.an = 'idle'; G.areas.push({ k: 'warn', x: m.x + dx / d * 2, y: m.y + dy / d * 2, r: 1.4, t: 0, life: .55 }); return; }
    if (m.warnC > 0) { m.warnC -= dt; m.an = 'hurt'; if (m.warnC <= 0) { m.charge = .55; m.hitC = 0; } return; }
    if (d > m.r + .8) { move(m, dx / d * m.spd * dt, dy / d * m.spd * dt); m.an = 'move'; separate(m); }
    else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = 2.4 * rage; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 1.9, t: 0, life: .8 }); }
    else m.an = 'idle'; return;
  }
  m.sum = (m.sum || 8) - dt; m.gust = (m.gust || 5) - dt;
  if (m.sum <= 0) { m.sum = 13; for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, x = m.x + Math.cos(a) * 1.6, y = m.y + Math.sin(a) * 1.6; if (walk(G.Wd, x, y)) { const n = mkMob('fluff', x, y, 7); n.st = 'chase'; G.mobs.push(n); } } G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 2, t: 0, life: .5, c: '#e8e0f4' }); say('우두머리 보풀이 보풀이를 불러냈어요!', '#e8e0f4', 1); }
  if (m.gust <= 0 && d < 6) { m.gust = 7; m.an = 'atk'; m.at = 0; m.hitDone = 0; m.kind = 'gust'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 3.4, t: 0, life: .8, cone: [dx / d, dy / d] }); return; }
  if (d > m.r + .9) { move(m, dx / d * m.spd * dt, dy / d * m.spd * dt); m.an = 'move'; }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = 2.6; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 2.4, t: 0, life: .8 }); }
  else m.an = 'idle';
}
function bossHit(m) {
  const P = G.P, d = hyp(P.x - m.x, P.y - m.y);
  if (m.kind === 'stab') return heronStab(m);
  if (m.kind === 'sweep') return creakerSweep(m);
  if (m.kind === 'slam') { const R = m.D.mini ? 1.9 : 2.4; G.fx.push({ k: 'ring', x: m.x, y: m.y, r: R, t: 0, life: .4, c: m.D.mini ? '#d9a8ff' : '#fff' }); G.fx.push({ k: 'crack', x: m.x, y: m.y, t: 0, life: 1.2 }); G.shake = m.D.mini ? 6 : 8; sfx('slam'); if (d < R + P.r) hurtPlayer(rnd(m.dmg[0], m.dmg[1]), m); }
  else { G.fx.push({ k: 'gust', x: m.x, y: m.y, dx: (P.x - m.x) / d, dy: (P.y - m.y) / d, r: 3.4, arc: 1.2, t: 0, life: .4 }); sfx('gust'); if (d < 3.4) { hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * .7, m); const kx = (P.x - m.x) / d * 3.2; const ky = (P.y - m.y) / d * 3.2; for (let i = 0; i < 10; i++) move(P, kx / 10, ky / 10); } }
}
function projUpdate(p, dt) {
  p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.k !== 'twister' && !ground(G.Wd, p.x, p.y) && !G.Wd.inb(Math.floor(p.x), Math.floor(p.y))) p.life = 0;
  const P = G.P;
  if (p.k === 'twister') { p.tick -= dt; for (const m of mobsIn(m => hyp(m.x - p.x, m.y - p.y) < p.r + m.r)) { if (!m.D.big) move(m, (p.x - m.x) * dt * 2.5, (p.y - m.y) * dt * 2.5); } if (p.tick <= 0) { p.tick = .3; for (const m of mobsIn(m => hyp(m.x - p.x, m.y - p.y) < p.r * .8 + m.r)) { const [d, c] = rollDmg(P, m, p.mult); hitMob(m, d, c); } } return; }
  for (const m of G.mobs) { if (m.dead || p.hit.has(m)) continue; if (hyp(m.x - p.x, m.y - p.y) < m.r + .25) { p.hit.add(m); const [d, c] = rollDmg(P, m, p.mult); hitMob(m, d, c, { kb: p.k === 'wind' ? 1.5 : p.kb || 0, fx: p.x - p.vx, fy: p.y - p.vy, col: p.k === 'arrow' ? '#f0e0b0' : undefined }); G.fx.push({ k: 'pop', x: p.x, y: p.y, t: 0, life: .25, c: p.k === 'bolt' ? '#fff3a0' : p.k === 'arrow' ? '#f0e0b0' : '#dff4ff' }); if (!p.pierce) { p.life = 0; break; } } }
}
function areaUpdate(a, dt) {
  if (a.k === 'delay') { a.t += dt; if (a.t >= 0 && !a.done) { a.done = 1; a.fn(); } return; }
  a.t += dt; const P = G.P;
  if (clsArea(a, dt)) return;
  if (a.k === 'flag') { a.tick -= dt; if (hyp(P.x - a.x, P.y - a.y) < a.r) { const k = a.fk === 1 ? 2 : 1; P.hp = Math.min(P.mhp, P.hp + P.mhp * .025 * k * dt); P.wind = Math.min(P.mwind, P.wind + 3 * k * dt); }
    if (a.fk === 0 && a.tick <= 0) { a.tick = 2; G.fx.push({ k: 'ring', x: a.x, y: a.y, r: a.r, t: 0, life: .4, c: '#bfe8ff' }); for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c, { kb: 5, fx: a.x, fy: a.y }); } } }
  if (a.k === 'vortex') { a.tick -= dt; for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r + 1)) { if (m.D.big) continue; const dx = a.x - m.x, dy = a.y - m.y, d = hyp(dx, dy) || 1; move(m, dx / d * Math.min(d, 3.2 * dt), dy / d * Math.min(d, 3.2 * dt)); }
    if (Math.random() < .7) { const an = Math.random() * TAU, rr2 = a.r * rnd(.4, 1); G.parts.push({ k: 'leaf', x: a.x + Math.cos(an) * rr2, y: a.y + Math.sin(an) * rr2, z: rnd(5, 50), vx: -Math.sin(an) * 5, vy: Math.cos(an) * 5, vz: 80, t: 0, life: .6, c: pick(['#9ad86a', '#dff4ff', '#ffffff']), s: 3, rot: an }); }
    if (a.tick <= 0) { a.tick = .3; for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r)) { const [d, c] = rollDmg(P, m, a.mult * .14); hitMob(m, d, c, { tick: 1 }); } }
    if (a.t + dt >= a.life && !a.boom) { a.boom = 1; G.shake = 12; G.hitstop = .1; G.flash = .25; sfx('twister'); G.fx.push({ k: 'ring', x: a.x, y: a.y, r: a.r + 1, t: 0, life: .5, c: '#e8f6ff' }, { k: 'ring', x: a.x, y: a.y, r: a.r * .6, t: 0, life: .35, c: '#9fe4ff' });
      for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r + .6)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c, { kb: 10, fx: a.x, fy: a.y, col: '#9fe4ff' }); } } }
  if (a.k === 'mist' && a.fk === 1) { a.tick -= dt; if (a.tick <= 0) { a.tick = 1; for (const m of mobsIn(m => hyp(m.x - a.x, m.y - a.y) < a.r)) { const [d, c] = rollDmg(P, m, a.mult); hitMob(m, d, c); G.fx.push({ k: 'zap', x: a.x, y: a.y, x2: m.x, y2: m.y, t: 0, life: .2 }); } } }
}
// 땅에 떨어진 물건: 오래 두면 마을 창고의 「분실물」 칸으로 옮겨짐(가방이 차서 못 주운 게 땅에 쌓이면 화면이 느려짐 — 30레벨 이후 렉 원인, 11/16).
// 보통·손본·재료·금화 2분, 이름난 이상·직접 내려놓은 것 10분. 그래도 40개가 넘으면 등급 낮고 오래된 것부터 옮김. 금화는 바로 지갑으로.
// 분실물은 LOST_N 칸까지, 넘치면 가장 오래된 낮은 등급 장비를 재료로 바꿔 둔다(잃는 것 없음, BK 11/16).
const DROP_MAX = 40, TXT_MAX = 50, FX_MAX = 160, LOST_N = 40, LOST_STEP = 10, LOST_XMAX = 6; // 분실물 칸: 금화로 10칸씩 6번까지(최대 100칸, BK 11/16)
const lostCap = P => LOST_N + LOST_STEP * Math.min(LOST_XMAX, P.lostX || 0), lostXCost = P => 400 * ((P.lostX || 0) + 1);
function dropLife(d) { return d.gold ? 120 : d.mine || d.it && !d.it.g && d.it.r >= 2 ? 600 : 120; }
function dropRank(d) { return d.mine ? 9 : d.gold ? 1 : d.it.g ? 2 : 3 + (d.it.r || 0); }
function trimDrops() { const P = G.P, L = G.drops.slice().sort((a, b) => dropRank(a) - dropRank(b) || b.t - a.t);
  for (const d of L) { if (G.drops.length - L.filter(q => q.got).length <= DROP_MAX) break; if (hyp(d.x - P.x, d.y - P.y) >= 1.2) toLost(d); } G.drops = G.drops.filter(d => !d.got); }
function lostAdd(it) { const P = G.P, L = P.lost || (P.lost = []);
  if (it.g) { const h = L.find(q => q.g === it.g); if (h) { h.n = (h.n || 1) + (it.n || 1); return; } }
  L.push(it);
  while (L.length > lostCap(P)) { let k = -1; for (let i = 0; i < L.length; i++) if (!L[i].g && !L[i].lk && (k < 0 || L[i].r < L[k].r)) k = i; if (k < 0) { L.shift(); continue; }
    const s = salvageOf(L[k]); L.splice(k, 1); if (s) { const h = L.find(q => q.g === s[0]); if (h) h.n = (h.n || 1) + s[1]; else L.push(goods(s[0], s[1])); } } }
function toLost(d) { const P = G.P; d.got = 1; if (d.gold) { P.gold += d.gold; return; } lostAdd(d.it);
  if (!G.lostTold) { G.lostTold = 1; say('못 주운 물건은 마을 「내 집 창고」의 분실물 칸에 모아 둘게요', '#9fe4ff'); } }
function pickUp(d) {
  const P = G.P;
  if (d.gold) { P.gold += d.gold; d.got = 1; G.txt.push({ x: d.x, y: d.y, z: 1, t: 0, s: '+' + d.gold + 'G', c: '#ffd166', small: 1 }); sfx('coin'); return; }
  if (!addInv(d.it)) { if (!d.warn) { d.warn = 1; say(P.inv.length >= INV_MAX ? '가방 칸이 다 찼어요(60칸). 팔거나 분해하거나 창고에 넣어 주세요' : '너무 무거워서 더 못 들어요. 팔거나 분해하거나 창고에 넣어 주세요', '#ff9a8a', 1); } return; }
  d.got = 1; sfx('pick'); if (d.it.g === 'plank') say('다리 널빤지 ' + count('plank') + '/6', '#ffe08a', 1);
  else if (!d.it.g && d.it.r >= 2) say(RAR[d.it.r].n + ' 장비! ' + itemName(d.it), RAR[d.it.r].c);
}
// 가방: 같은 물건은 한 칸에 묶고(개수 표시), 무게는 개수만큼 더해짐. 무게가 들 수 있는 양을 넘으면 걸음이 느려지고, 1.5배를 넘으면 더 못 주움.
const INV_N = 40, INV_MAX = 60;
const WT_SLOT = { weapon: 4, off: 3, armor: 6, helm: 2, legs: 3, inner: 1, cloak: 1.5, gloves: 1, belt: 1, boots: 2, amulet: .3, ear: .2, ring: .2, sail: 2 };
function weightOf(it) { if (it.g) return (it.g === 'pot' || it.g === 'wpot' ? .2 : GOODS[it.g].quest ? .3 : .1) * it.n; const b = BASE[it.b]; return (b && WT_SLOT[b.s] || 1) * (it.n || 1); }
function bagWeight(P) { let w = 0; for (const it of P.inv) w += weightOf(it); return Math.round(w * 10) / 10; }
function bagCap(P) { return 60 + Math.floor(P.st && P.st.str || 10); }
const heavyMul = P => bagWeight(P) > bagCap(P) ? .55 : 1;
// 묶을 수 있는 장비: 보통 등급, 강화·옵션·이름 없는 같은 물건
function stackKey(it) { if (it.g || it.r !== 0 || it.en || it.u || it.set || it.hid || it.af && it.af.length) return null; return it.b + '|' + (it.id ? 1 : 0) + '|' + (it.st || 0); }
function addInv(it) { const P = G.P;
  if (it.g) { const h = P.inv.find(x => x.g === it.g); if (h) { h.n += it.n; return true; } }
  const k = stackKey(it), w0 = bagWeight(P), cap = bagCap(P);
  if (w0 + weightOf(it) > cap * 1.5) return false;
  const h = k && P.inv.find(x => !x.g && !x.lk && stackKey(x) === k);
  if (h) h.n = (h.n || 1) + (it.n || 1); else { if (P.inv.length >= INV_MAX) return false; P.inv.push(it); }
  if (w0 <= cap && bagWeight(P) > cap) say('가방이 무거워졌어요! 걸음이 느려져요 (무게 ' + bagWeight(P) + '/' + cap + ')', '#ff9a8a');
  return true; }
// 묶음에서 하나 떼어 내기: 떼어 낸 물건의 칸 번호를 돌려줌
function single(i) { const P = G.P, it = P.inv[i]; if (!it || it.g || !(it.n > 1)) return i; it.n--; const c = { ...it, uid: UID++ }; delete c.n; P.inv.splice(i + 1, 0, c); return i + 1; }
function count(g) { const h = G.P.inv.find(x => x.g === g); return h ? h.n : 0; }
function useGood(g, n) { const P = G.P, h = P.inv.find(x => x.g === g); if (!h || h.n < (n || 1)) return false; h.n -= n || 1; if (h.n <= 0) P.inv.splice(P.inv.indexOf(h), 1); return true; }
function drink(g) { const P = G.P; if (P.dead) return; if (!useGood(g)) { say(g === 'pot' ? '민들레 차가 없어요' : '바람 사탕이 없어요', '#ccc', 1); return; } if (g === 'pot') P.hp = Math.min(P.mhp, P.hp + P.mhp * .4); else P.wind = Math.min(P.mwind, P.wind + P.mwind * .5); G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .5, c: g === 'pot' ? '#b6f0a0' : '#9fe4ff' }); sfx('drink'); }
function say(s, c, quick) { if (G.msg.length && G.msg[G.msg.length - 1].s === s) { G.msg[G.msg.length - 1].t = 0; return; } G.msg.push({ s, c: c || '#fff', t: quick ? 2 : 0 }); if (G.msg.length > 4) G.msg.shift(); }
function autoSlots(P) { if (P.lv >= ULT[P.cls].req && !P.slots.includes('ult')) { const old = P.slots[3]; P.slots[3] = 'ult'; if (old) { const i = P.slots.indexOf(null); if (i >= 0) P.slots[i] = old; } } for (const s of SKILLS[P.cls]) if (P.sk[s.id] && !P.slots.includes(s.id) && s.t !== 'passive') { const i = P.slots.indexOf(null); if (i >= 0) P.slots[i] = s.id; } }

/* ---------- 퀘스트 ---------- */
function qSet(id, s) { const q = G.P.q[id] || (G.P.q[id] = { s: 0, n: 0 }); if (q.s < s) q.s = s; }
function qAdd(id, n) { const q = G.P.q[id]; if (!q || q.s !== 1) return; q.n += n; const Q = QUESTS[id]; if (q.n >= Q.need) { q.n = Q.need; q.s = 2; say('「' + Q.n + '」 완료! ' + NPCDEF[Q.from].n + '에게 돌아가요.', '#ffd166'); } }
// 근처에 무엇이 있는지 (상호작용 버튼)
function near() {
  const P = G.P, Wd = G.Wd; G.near = null; if (P.dead) return;
  for (const k in Wd.npcAt) { const [x, y] = Wd.npcAt[k]; if (hyp(P.x - x, P.y - y) < 1.5) { G.near = { k: 'npc', id: k, label: NPCDEF[k].n + ' 말 걸기' }; return; } }
  for (const w of Wd.wps) if (hyp(P.x - w.x, P.y - w.y) < 1.4) { if (!w.on && (w.n !== '바람개비 언덕' || P.flags.boss) && (w.n !== '둥지섬' || P.flags.heron) && (w.n !== '큰 풍차섬' || P.flags.creaker) && (w.n !== '녹슨 정박장' || P.flags.rustship) && !(CHX[Wd.ch] && w.n === CHX[Wd.ch].hill && !(Wd.ch === 8 ? P.roam.boss : P.flags[CHX[Wd.ch].m.boss]))) { w.on = 1; P.flags[wpk(w.n)] = 1; say('바람개비 표지 「' + w.n + '」에 바람이 깃들었어요', '#9fe4ff'); sfx('lvl'); if (w.n === '바람개비 언덕' && P.q.q3 && P.q.q3.s === 2 || w.n === '둥지섬' && P.q.q7 && P.q.q7.s === 2 || w.n === '큰 풍차섬' && P.q.q12 && P.q.q12.s === 2 || w.n === '녹슨 정박장' && P.q.q17 && P.q.q17.s === 2 || CHX[Wd.ch] && w.n === CHX[Wd.ch].hill) say(NPCDEF.chief.n + '에게 돌아가 소식을 전해요.', '#ffd166'); save(); }
    G.near = w.on ? { k: 'wp', label: '바람개비 표지(이동)' } : { k: 'wpx', label: CHX[Wd.ch] && w.n === CHX[Wd.ch].hill ? '아직 바람이 없어요(' + CHX[Wd.ch].mn.boss + '을(를) 먼저)' : w.n === '녹슨 정박장' ? '아직 바람이 없어요(녹슨 비행선을 먼저)' : w.n === '큰 풍차섬' ? '아직 바람이 없어요(삐걱 파수꾼을 먼저)' : w.n === '둥지섬' ? '아직 바람이 없어요(큰 왜가리를 먼저)' : '아직 바람이 없어요(우두머리를 먼저)' }; return; }
  if (G.chest && hyp(P.x - G.chest.x, P.y - G.chest.y) < 1.5) { G.near = { k: 'chest', label: '오늘의 섬 상자 열기' }; return; }
  { const tn = townNear(P, Wd); if (tn) { G.near = tn; return; } }
  if (Wd.signAt && hyp(P.x - Wd.signAt[0], P.y - Wd.signAt[1]) < 1.6) { G.near = { k: 'notice', label: '마을 게시판 보기' }; return; }
  if (Wd.ch >= 4) { const C = CHX[Wd.ch], b = Wd.bridges[Wd.bq], n = count(C.bg[0]); if (b.broken) for (const c of b.cells) { const x = c % Wd.W + .5, y = ((c / Wd.W) | 0) + .5; if (hyp(P.x - x, P.y - y) < 2.2) { G.near = { k: 'xb', label: n >= 4 ? C.bg[2] + ' 잇기 (' + C.bg[1] + ' 4)' : '끊어진 ' + C.bg[2] + ' (' + C.bg[1] + ' ' + n + '/4)' }; return; } } return; }
  if (Wd.ch === 3) { const b = Wd.bridges[Wd.bq]; if (b.broken) for (const c of b.cells) { const x = c % Wd.W + .5, y = ((c / Wd.W) | 0) + .5; if (hyp(P.x - x, P.y - y) < 2.2) { G.near = { k: 'ropeb', label: count('rope') >= 4 ? '줄다리 다시 매기 (밧줄 타래 4)' : '끊어진 줄다리 (밧줄 타래 ' + count('rope') + '/4)' }; return; } } return; }
  if (Wd.ch === 2) { const b = Wd.bridges[Wd.bq]; if (b.broken) for (const c of b.cells) { const x = c % Wd.W + .5, y = ((c / Wd.W) | 0) + .5; if (hyp(P.x - x, P.y - y) < 2.2) { G.near = { k: 'chainb', label: count('chain') >= 4 ? '쇠사슬 다리 잇기 (사슬 고리 4)' : '끊어진 쇠사슬 다리 (사슬 고리 ' + count('chain') + '/4)' }; return; } } return; }
  const b = Wd.bridges[Wd.bq]; if (b.broken) for (const c of b.cells) { const x = c % Wd.W + .5, y = ((c / Wd.W) | 0) + .5; if (hyp(P.x - x, P.y - y) < 2.2) { G.near = { k: 'bridge', label: count('plank') >= 6 ? '다리 고치기 (널빤지 6)' : '끊어진 다리 (널빤지 ' + count('plank') + '/6)' }; return; } }
  const b2 = Wd.bridges[Wd.bq2]; if (b2.broken) for (const c of b2.cells) { const x = c % Wd.W + .5, y = ((c / Wd.W) | 0) + .5; if (hyp(P.x - x, P.y - y) < 2.2) { G.near = { k: 'bridge2', label: count('shell') >= 3 ? '다리 고치기 (둥지 껍질 3)' : '끊어진 다리 (둥지 껍질 ' + count('shell') + '/3)' }; return; } }
}
function interact() {
  const n = G.near; if (!n) return; const P = G.P;
  if (n.k === 'npc') talk(n.id);
  else if (n.k === 'chest') openChest();
  else if (n.k === 'chainb') { if (count('chain') >= 4) { useGood('chain', 4); repairBridge(G.Wd, G.Wd.bq); P.flags.c2bridge = 1; MINI = null; if (P.q.q9) qSet('q9', 2); G.shake = 5; sfx('lvl'); say('쇠사슬 다리를 다시 이었어요! 사슬 나루로 건너갈 수 있어요.', '#ffd166'); for (const c of G.Wd.bridges[G.Wd.bq].cells) G.fx.push({ k: 'pop', x: c % G.Wd.W + .5, y: ((c / G.Wd.W) | 0) + .5, t: -Math.random() * .6, life: .5, c: '#ffe08a' }); save(); } else say('사슬 고리가 ' + (4 - count('chain')) + '개 더 필요해요(톱니 둥지지기가 떨궈요)', '#ffe08a', 1); }
  else if (n.k === 'ropeb') { if (count('rope') >= 4) { useGood('rope', 4); repairBridge(G.Wd, G.Wd.bq); P.flags.c3bridge = 1; MINI = null; if (P.q.q14) qSet('q14', 2); G.shake = 5; sfx('lvl'); say('줄다리를 다시 맸어요! 밧줄 나루로 건너갈 수 있어요.', '#ffd166'); for (const c of G.Wd.bridges[G.Wd.bq].cells) G.fx.push({ k: 'pop', x: c % G.Wd.W + .5, y: ((c / G.Wd.W) | 0) + .5, t: -Math.random() * .6, life: .5, c: '#ffe08a' }); save(); } else say('밧줄 타래가 ' + (4 - count('rope')) + '개 더 필요해요(따개비 둥지지기가 떨궈요)', '#ffe08a', 1); }
  else if (n.k === 'xb') { const ch = G.Wd.ch, C = CHX[ch]; if (count(C.bg[0]) >= 4) { useGood(C.bg[0], 4); repairBridge(G.Wd, G.Wd.bq); P.flags['c' + ch + 'bridge'] = 1; MINI = null; if (P.q[C.qid[1]]) qSet(C.qid[1], 2); G.shake = 5; sfx('lvl'); say(C.bg[2] + '를 다시 이었어요! ' + C.ci[0] + '(으)로 건너갈 수 있어요.', '#ffd166'); for (const c of G.Wd.bridges[G.Wd.bq].cells) G.fx.push({ k: 'pop', x: c % G.Wd.W + .5, y: ((c / G.Wd.W) | 0) + .5, t: -Math.random() * .6, life: .5, c: '#ffe08a' }); save(); } else say(C.bg[1] + '이(가) ' + (4 - count(C.bg[0])) + '개 더 필요해요(' + C.mn.k + '가 떨궈요)', '#ffe08a', 1); }
  else if (n.k === 'notice') openPanel('daily');
  else if (n.k === 'stash') openPanel('stash');
  else if (n.k === 'well') drinkWell();
  else if (n.k === 'wp') openPanel('travel');
  else if (n.k === 'bridge2') { if (count('shell') >= 3) { useGood('shell', 3); repairBridge(G.Wd, G.Wd.bq2); P.flags.bridge2 = 1; MINI = null; if (P.q.q5) qSet('q5', 2); G.shake = 5; sfx('lvl'); say('다리를 다시 놓았어요! 갈대 늪으로 건너갈 수 있어요.', '#ffd166'); for (const c of G.Wd.bridges[G.Wd.bq2].cells) G.fx.push({ k: 'pop', x: c % G.Wd.W + .5, y: ((c / G.Wd.W) | 0) + .5, t: -Math.random() * .6, life: .5, c: '#ffe08a' }); save(); } else say('둥지 껍질이 ' + (3 - count('shell')) + '개 더 필요해요(둥지지기가 떨궈요)', '#ffe08a', 1); }
  else if (n.k === 'bridge') { if (count('plank') >= 6) { useGood('plank', 6); repairBridge(G.Wd, G.Wd.bq); P.flags.bridge = 1; qSet('q1', 2); G.shake = 5; sfx('lvl'); say('다리를 다시 놓았어요! 바람개비 언덕으로 건너갈 수 있어요.', '#ffd166'); for (const c of G.Wd.bridges[G.Wd.bq].cells) G.fx.push({ k: 'pop', x: c % G.Wd.W + .5, y: ((c / G.Wd.W) | 0) + .5, t: -Math.random() * .6, life: .5, c: '#ffe08a' }); save(); } else say('다리 널빤지가 ' + (6 - count('plank')) + '개 더 필요해요', '#ffe08a', 1); }
}
