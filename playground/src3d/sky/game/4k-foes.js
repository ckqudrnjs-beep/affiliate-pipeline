/* ---------- 2026-11-20 테스터 의견 반영: 장마다 더 어렵게 · 새 밑것(쏘개·터지개·던지개) · 장 보스 전해진 장비 고르게 ---------- */
// 장 난이도: 체력·피해 배율, 공격 간격 배율, 무리당 더 붙는 수, 정예 확률 더하기, 새 밑것으로 바뀔 확률
const CHD = {
  1: { hp: 1, dmg: 1, cd: 1, add: 0, elite: 0, swap: .12 },
  2: { hp: 1.15, dmg: 1.12, cd: .95, add: 0, elite: .04, swap: .2 },
  3: { hp: 1.3, dmg: 1.22, cd: .9, add: 1, elite: .07, swap: .25 },
  4: { hp: 1.45, dmg: 1.32, cd: .86, add: 1, elite: .1, swap: .3 },
  5: { hp: 1.6, dmg: 1.42, cd: .83, add: 1, elite: .12, swap: .32 },
  6: { hp: 1.75, dmg: 1.52, cd: .8, add: 2, elite: .15, swap: .35 },
  7: { hp: 1.9, dmg: 1.62, cd: .78, add: 2, elite: .18, swap: .38 } };
// 지금 장(떠도는 섬은 바탕이 된 장, 엔딩 뒤 높은 난이도에서는 장 난이도를 절반만 얹음)
const curCh = () => { const W = G && G.Wd; if (!W) return 1; return W.ch === 8 ? Math.min(7, (CHX[8] && CHX[8].src) || 7) : Math.min(7, W.ch || 1); };
function chD() { const c = CHD[curCh()], h = G && G.P && G.P.diff ? .5 : 1; return { hp: 1 + (c.hp - 1) * h, dmg: 1 + (c.dmg - 1) * h, cd: 1 - (1 - c.cd) * h, add: c.add, elite: c.elite, swap: c.swap }; }

// 새 밑것: 장마다 그 장 밑것 그림을 물들여 씀. [바탕 밑것, 이름]
const FOE_SRC = {
  1: { shot: ['seed', '씨앗 쏘개'], bomb: ['fluff', '부푼 보풀이'] },
  2: { shot: ['boltpod', '쇠못 쏘개'], bomb: ['rustfluff', '부푼 녹 보풀'], lob: ['scarecrow', '돌 던지는 허수아비'] },
  3: { shot: ['barnpod', '따개비 쏘개'], bomb: ['saltfluff', '부푼 소금 보풀'], lob: ['crab', '돌 던지는 닻집게'] },
  4: { shot: ['thornpod', '가시 쏘개'], bomb: ['mossfluff', '부푼 이끼 보풀'], lob: ['rootling', '흙 던지는 뿌리 덩이'] },
  5: { shot: ['sparkpod', '불꽃 쏘개'], bomb: ['stormfluff', '부푼 먹구름 보풀'], lob: ['stormling', '번개 던지는 덩이'] },
  6: { shot: ['stonepod', '돌 쏘개'], bomb: ['dustfluff', '부푼 먼지 보풀'], lob: ['stoneguard', '돌 던지는 병정'] },
  7: { shot: ['galepod', '바람 쏘개'], bomb: ['galefluff', '부푼 고요 보풀'], lob: ['galeling', '회오리 던지는 덩이'] } };
const FOE_KIND = {
  shot: { tint: '#ff9a3a', hp: .75, dmg: .9, spd: .95, atk: 2.1, xp: 1.25, desc: '거리를 두고 탄을 쏘아요. 탄이 날아오면 옆으로 비켜요.', hint: '쏘개는 멀리서 탄을 쏴요. 옆으로 비키거나 구르기로 피해요!' },
  bomb: { tint: '#ff4a4a', hp: .6, dmg: 2.2, spd: 1.35, atk: 1, xp: 1.15, desc: '부풀어 오른 채 달려들어 터져요. 빨갛게 깜빡이면 얼른 물러나요.', hint: '부푼 밑것이 빨갛게 깜빡이면 곧 터져요. 먼저 쓰러뜨리거나 물러나요!' },
  lob: { tint: '#7ab0ff', hp: 1, dmg: 1.2, spd: .8, atk: 2.8, xp: 1.3, desc: '멀리서 돌을 던져요. 바닥에 표시가 뜨면 비켜요.', hint: '던지개는 멀리서 돌을 던져요. 바닥 표시를 보고 비켜요!' } };
const FOE_OF = {}; // 장 → [새 밑것 키]
for (const ch in FOE_SRC) { FOE_OF[ch] = [];
  for (const k in FOE_SRC[ch]) { const [src, n] = FOE_SRC[ch][k], B = MOBDEF[src], K = FOE_KIND[k]; if (!B) continue; const id = 'f' + ch + k;
    MOBDEF[id] = { n, hp: [B.hp[0] * K.hp, B.hp[1] * K.hp], dmg: [B.dmg[0] * K.dmg, B.dmg[1] * K.dmg, B.dmg[2] * K.dmg], spd: B.spd * K.spd, r: B.r, sz: B.sz, xp: [B.xp[0] * K.xp, B.xp[1] * K.xp], atk: K.atk, ai: 'f' + k, spr: B.spr, desc: K.desc, tint: K.tint, base: src, fk: k, fch: +ch };
    if (MOBCOL[src]) MOBCOL[id] = MOBCOL[src]; FOE_OF[ch].push(id); } }
// 무리 하나 안에서 바뀔 밑것 고르기(둥지지기·보스·나는 새는 그대로)
function foeSwap(t) { const D = MOBDEF[t]; if (!D || D.big || D.fly || D.fk) return t; const L = FOE_OF[curCh()]; if (!L || !L.length || Math.random() >= chD().swap) return t; return pick(L); }
function foeHint(m) { const P = G.P, k = 'foe_' + m.D.fk; if (!m.D.fk || P.flags[k]) return; P.flags[k] = 1; say(FOE_KIND[m.D.fk].hint, m.D.tint); }
// 장이 올라갈수록 공격이 갈래를 늘림
const foeLv = m => m.D.fch || 1;
function foeShot(m, ang, sp, mul) { G.areas.push({ k: 'bolt', x: m.x + Math.cos(ang) * .4, y: m.y + Math.sin(ang) * .4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t: 0, life: 2, dmg: rnd(m.dmg[0], m.dmg[1]) * (mul || 1), src: m, c: m.D.tint }); }
// 쏘개: 4~6칸 거리 유지 · 장 1~2 한 발, 3~4 세 갈래, 5장부터 세 갈래와 세 번 연사를 번갈아
function shotAI(m, dt, d, dx, dy, sp) {
  if (m.aim > 0) { m.aim -= dt; m.an = 'hurt'; if (m.aim <= 0) fireShot(m); return; }
  if (d < 3.2) { move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.an = 'move'; separate(m); return; }
  if (d > 6.2) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m); return; }
  if (m.cd <= 0) { m.cd = m.D.atk * rnd(.9, 1.2) * (m.cdm || 1); m.aim = .45; G.fx.push({ k: 'mtele', x: m.x, y: m.y, t: 0, life: .45, c: m.D.tint }); return; }
  m.an = 'idle';
}
function fireShot(m) { const P = G.P, L = foeLv(m), a = Math.atan2(P.y - m.y, P.x - m.x); m.an = 'atk'; m.at = 0; m.hitDone = 1; sfx('cone'); m.n = (m.n || 0) + 1;
  if (L >= 5 && m.n % 2 === 0) { for (let i = 0; i < 3; i++) later(i * .16, () => { if (!m.dead) foeShot(m, Math.atan2(G.P.y - m.y, G.P.x - m.x), 6.4, .8); }); return; }
  if (L >= 3) { for (const o of [-.28, 0, .28]) foeShot(m, a + o, 5.6, .85); return; }
  foeShot(m, a, 5.4, 1); }
// 터지개: 붙으면 0.75초 깜빡이다 터짐(먼저 쓰러뜨리면 안 터짐). 5장부터 터질 때 파편을 흩뿌림
function bombAI(m, dt, d, dx, dy, sp) {
  if (m.fuse > 0) { m.fuse -= dt; m.an = 'hurt'; m.flash = (Math.sin(G.t * 30) > 0) ? .12 : 0; if (m.fuse <= 0) bombBoom(m); return; }
  if (d < 1.25) { m.fuse = .75; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 1.7, t: 0, life: .75 }); sfx('dodge'); return; }
  move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m);
}
function bombBoom(m) { const P = G.P; G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 1.7, t: 0, life: .4, c: m.D.tint }, { k: 'crack', x: m.x, y: m.y, t: 0, life: .9 }); G.shake = Math.max(G.shake, 6); sfx('slam');
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU; G.parts.push({ k: 'puff', x: m.x, y: m.y, z: 6, vx: Math.cos(a) * rnd(1, 3), vy: Math.sin(a) * rnd(1, 3), vz: rnd(60, 160), t: 0, life: rnd(.4, .8), c: pick(['#ff6a4a', '#ffb070', '#5a4e48']), s: rnd(2.5, 4.5) }); }
  if (!P.dead && hyp(P.x - m.x, P.y - m.y) < 1.7 + P.r) hurtPlayer(rnd(m.dmg[0], m.dmg[1]), m);
  if (foeLv(m) >= 5) for (let i = 0; i < 6; i++) foeShot(m, i / 6 * TAU + Math.random() * .5, 3.6, .45);
  m.dead = 1; m.an = 'die'; m.at = 0; m.boom = 1; if (m.pk) { m.pk.dead++; if (m.pk.dead >= m.pk.mobs.length) m.pk.clear = G.t; } }
// 던지개: 4~7칸 거리 유지 · 장 2~3 한 곳, 4~5 두 곳(한 곳은 가는 쪽 앞), 6장부터 세 곳
function lobAI(m, dt, d, dx, dy, sp) {
  if (d < 3.6) { move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.an = 'move'; separate(m); return; }
  if (d > 7.5) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m); return; }
  if (m.cd > 0) { m.an = 'idle'; return; }
  const P = G.P, L = foeLv(m), n = L >= 6 ? 3 : L >= 4 ? 2 : 1, [ix, iy] = P.an === 'run' ? dirW(P.dir) : [0, 0];
  m.cd = m.D.atk * rnd(.9, 1.2) * (m.cdm || 1); m.an = 'atk'; m.at = 0; m.hitDone = 1; sfx('gust');
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = i === 0 ? 0 : rnd(1, 2.2), tx = i === 1 ? P.x + ix * 2.2 : P.x + Math.cos(a) * r, ty = i === 1 ? P.y + iy * 2.2 : P.y + Math.sin(a) * r;
    G.areas.push({ k: 'rock', x0: m.x, y0: m.y, x: tx, y: ty, t: 0, life: 1, c: m.D.tint }); shipBlast(m, tx, ty, 1.05, 1, 1, m.D.tint); }
}
function foeAI(m, dt, d, dx, dy, sp) { foeHint(m); const k = m.D.fk; if (k === 'shot') return shotAI(m, dt, d, dx, dy, sp); if (k === 'bomb') return bombAI(m, dt, d, dx, dy, sp); return lobAI(m, dt, d, dx, dy, sp); }
// 새 지역 효과: 탄(bolt)·날아가는 돌(rock, 그림만)
function foeArea(a, dt) {
  if (a.k === 'rock') return 1;
  if (a.k !== 'bolt') return 0; const P = G.P; a.x += a.vx * dt; a.y += a.vy * dt;
  if (!G.Wd.inb(Math.floor(a.x), Math.floor(a.y))) { a.t = a.life; return 1; }
  if (!P.dead && !a.hit && hyp(P.x - a.x, P.y - a.y) < .38 + P.r) { a.hit = 1; a.t = a.life; G.fx.push({ k: 'pop', x: a.x, y: a.y, t: 0, life: .3, c: a.c }); hurtPlayer(a.dmg, a.src); }
  return 1;
}
function drawFoeArea(a) {
  if (a.k === 'bolt') { const [ax, ay] = iso(a.x, a.y), Y = ay - 20, tx = iso(a.x - a.vx * .06, a.y - a.vy * .06);
    x.fillStyle = 'rgba(30,30,20,.22)'; x.beginPath(); x.ellipse(ax, ay, 5, 2.5, 0, 0, TAU); x.fill();
    x.strokeStyle = a.c; x.globalAlpha = .5; x.lineWidth = 4; x.beginPath(); x.moveTo(tx[0], tx[1] - 20); x.lineTo(ax, Y); x.stroke(); x.globalAlpha = 1;
    const g = x.createRadialGradient(ax, Y, 1, ax, Y, 9); g.addColorStop(0, '#fff'); g.addColorStop(.4, a.c); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(ax, Y, 9, 0, TAU); x.fill(); return 1; }
  if (a.k === 'rock') { const k = Math.min(1, a.t / a.life), px = lerp(a.x0, a.x, k), py = lerp(a.y0, a.y, k), [ax, ay] = iso(px, py), Y = ay - 24 - Math.sin(k * Math.PI) * 70;
    if (k >= 1) return 1; x.fillStyle = 'rgba(30,30,20,.2)'; x.beginPath(); x.ellipse(ax, ay, 5, 2.5, 0, 0, TAU); x.fill();
    x.fillStyle = '#6a6258'; x.strokeStyle = a.c; x.lineWidth = 2; x.beginPath(); x.arc(ax, Y, 6, 0, TAU); x.fill(); x.stroke(); return 1; }
  return 0;
}
// 물들인 밑것 그림(한 번 만들어 둠)
const TINTS = {};
function tintedIm(spr, c) { const k = spr + c; if (TINTS[k]) return TINTS[k]; const im = IM[spr]; if (!im || !im.width) return im;
  const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .38; g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height); return TINTS[k] = cv; }

/* ---------- 전해진 장비: 장마다 목걸이 + 직업 무기 + 방어구 하나 ---------- */
const UQ_MAIN = { warden: 'str', drifter: 'agi', windcaller: 'spi', trapper: 'agi', ringer: 'str' };
const UQ_WCLS = { warden: 'spear', windcaller: 'staff', drifter: 'sword', trapper: 'xbow', ringer: 'hammer' };
// [장, 무기 바탕 끝(장 2: spear4, 장 3: spear6, 4~7: c<장>spear4), 직업별 이름, 무기 이야기, 방어구 바탕, 방어구 이름, 방어구 이야기, 목걸이 전해진 id]
const UQ_CH = [
  [2, w => w + '4', { warden: '방앗간 주인의 창', windcaller: '방앗간 주인의 지팡이', drifter: '방앗간 주인의 쌍칼', trapper: '방앗간 주인의 석궁', ringer: '방앗간 주인의 망치' }, '풍차가 멈추던 날까지 방앗간을 지킨 주인이 벽에 걸어 둔 무기. 손잡이에 밀가루가 아직 배어 있다.', 'legs4', '맷돌 다리싸개', '맷돌을 깎아 무릎에 댄 다리싸개. 무겁지만 한 번 디디면 밀리지 않는다.', 'u_millheart'],
  [3, w => w + '6', { warden: '바다를 건넌 창', windcaller: '바다를 건넌 지팡이', drifter: '바다를 건넌 쌍칼', trapper: '바다를 건넌 석궁', ringer: '바다를 건넌 망치' }, '구름바다를 건너온 뱃사람이 항구에 두고 간 무기. 쥐면 짠 바람 냄새가 난다.', 'cloak4', '물보라 망토', '파도 끝 물보라를 엮어 만든 망토. 젖은 듯 차갑지만 바람을 잘 가른다.', 'u_anchor'],
  [4, w => 'c4' + w + '4', { warden: '천 년 나이테 창', windcaller: '천 년 나이테 지팡이', drifter: '천 년 나이테 쌍칼', trapper: '천 년 나이테 석궁', ringer: '천 년 나이테 망치' }, '뒤집힌 고목의 가장 단단한 가지를 깎은 무기. 휘두를 때마다 나뭇잎 소리가 난다.', 'c4boots2', '뿌리 걸음', '뿌리처럼 땅을 움켜쥐는 장화. 신으면 발밑에서 작은 새싹이 돋는다.', 'u_oldheart'],
  [5, w => 'c5' + w + '4', { warden: '번개 맞은 창', windcaller: '번개 맞은 지팡이', drifter: '번개 맞은 쌍칼', trapper: '번개 맞은 석궁', ringer: '번개 맞은 망치' }, '번개 둥지 꼭대기에서 벼락을 백 번 맞았다는 무기. 끝에서 늘 작은 불꽃이 튄다.', 'c5cloak3', '먹구름 날개', '구름 고래의 지느러미 자락으로 만든 망토. 펄럭일 때마다 먼 천둥소리가 난다.', 'u_whalebell'],
  [6, w => 'c6' + w + '4', { warden: '옛 왕의 창', windcaller: '옛 왕의 지팡이', drifter: '옛 왕의 쌍칼', trapper: '옛 왕의 석궁', ringer: '옛 왕의 망치' }, '가라앉는 옛 도읍의 보물 창고 맨 안쪽에 있던 무기. 이름 새긴 자리는 닳아 읽을 수 없다.', 'c6helm4', '무너진 왕관', '돌 문지기가 지키던 금이 간 왕관. 쓰면 머리가 무겁고 마음은 가벼워진다.', 'u_gatekey'],
  [7, w => 'c7' + w + '4', { warden: '첫바람 창', windcaller: '첫바람 지팡이', drifter: '첫바람 쌍칼', trapper: '첫바람 석궁', ringer: '첫바람 망치' }, '첫 이음꾼이 섬과 섬을 처음 이을 때 들고 있던 무기라고 전해진다. 바람이 먼저 길을 알려 준다.', 'c7armor4', '하늘 실 옷', '하늘 실로 한 올 한 올 짠 옷. 입으면 몸이 바람만큼 가볍다.', 'u_firstwind'] ];
const UQ_POOL = {}; // 장 → { cls → [전해진 id …] }
for (const [ch, wb, wn, ws, ab, an, as, amu] of UQ_CH) { const k = ch - 1, P0 = { amu, w: {}, a: 'u_c' + ch + 'a' };
  for (const cls in UQ_WCLS) { const base = wb(UQ_WCLS[cls]); if (!BASE[base]) continue; const id = 'u_c' + ch + 'w_' + cls;
    UNIQ.push({ id, n: wn[cls], base, story: ws, fx: [['dmgp', 24 + 8 * k], [UQ_MAIN[cls], 3 + 2 * k], ['aspd', 6 + 2 * k], ['crit', 4 + k]], lv: BASE[base].lv + 2 }); P0.w[cls] = id; }
  if (BASE[ab]) UNIQ.push({ id: P0.a, n: an, base: ab, story: as, fx: [['ac', 8 + 6 * k], ['hp', 50 + 35 * k], ['res', 10 + 4 * k], ['bootscloak'.includes(BASE[ab].s) ? 'move' : 'thorn', 'bootscloak'.includes(BASE[ab].s) ? 6 + k : 4 + 2 * k]], lv: BASE[ab].lv + 2 });
  UQ_POOL[ch] = P0; }
function hasUniq(P, id) { const L = [...P.inv, ...Object.values(P.eq), ...(P.stash || []), ...(P.lost || [])]; return L.some(it => it && it.u === id); }
function mkUniq(id, ilv) { const U = UNIQ.find(u => u.id === id); return U ? makeItem(U.base, 3, Math.max(ilv, U.lv), { u: id }) : null; }
// 장 보스 전해진 장비: 목걸이·내 직업 무기·방어구 중 아직 없는 것부터 하나
function chUniq(ch, ilv) { const P = G.P, Q = UQ_POOL[ch]; if (!Q) return null; const L = [Q.amu, Q.w[P.cls], Q.a].filter(id => id && UNIQ.some(u => u.id === id));
  const fresh = L.filter(id => !hasUniq(P, id)); return mkUniq(pick(fresh.length ? fresh : L), ilv); }
// 일반 드롭에서 아주 드물게 전해진 장비(레벨 맞는 것 · 다른 직업 무기는 덜 나옴)
function rollUniq(ilv, cls) { const L = UNIQ.filter(u => u.lv <= ilv + 2 && u.lv >= ilv - 16 && (!BASE[u.base].cls || BASE[u.base].cls === cls || Math.random() < .25) && (BASE[u.base].s !== 'amulet' || Math.random() < .4)); if (!L.length) return null; const U = pick(L); return makeItem(U.base, 3, Math.max(ilv, U.lv), { u: U.id }); }
