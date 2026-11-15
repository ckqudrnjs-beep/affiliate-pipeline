/* ---------- 3장 닻 내린 항구 (25~34레벨) · 장 보스 녹슨 비행선 ---------- */
const C3_LV = [[25, 26], [26, 27], [27, 28], [28, 29], [30, 31], [31, 32]];
Object.assign(MOBDEF, {
  saltfluff: { n: '소금 보풀', hp: [14, 7], dmg: [4, 6, 1.1], spd: 1.8, r: .3, sz: 0, xp: [9, 4.5], atk: 1, ai: 'melee', spr: 'saltfluff', desc: '바닷바람에 말라붙은 소금이 엉겨 붙은 보풀이. 따끔따끔 떼로 몰려와요.' },
  barnpod: { n: '따개비 꼬투리', hp: [24, 9], dmg: [5, 8, 1.5], spd: 1.25, r: .32, sz: 1, xp: [13, 5.5], atk: 1.2, ai: 'charge', spr: 'barnpod', desc: '껍질에 따개비가 다닥다닥 붙은 꼬투리. 멀리서 냅다 들이받아요.' },
  gull: { n: '심술 갈매기', hp: [12, 5], dmg: [4, 6, 1], spd: 2.8, r: .28, sz: 0, xp: [10, 4.5], atk: .9, ai: 'dive', fly: 1, spr: 'gull', desc: '묶인 비행선 돛대에 앉아 있다가 떼로 내리꽂는 갈매기.' },
  crab: { n: '닻집게', hp: [40, 13], dmg: [6, 10, 1.6], spd: 1.25, r: .4, sz: 1, xp: [18, 7], atk: 2.6, ai: 'spin', spr: 'crab', desc: '닻처럼 생긴 큰 집게를 단 게. 가까이 오면 집게를 휘휘 휘둘러요(바닥 표시를 보고 피해요).' },
  barnkeeper: { n: '따개비 둥지지기', hp: [130, 30], dmg: [8, 13, 1.7], spd: 1.05, r: .55, sz: 1, xp: [90, 30], atk: 1.8, ai: 'boss', mini: 1, big: 1, spr: 'barnkeeper', desc: '따개비 껍질을 두른 둥지지기. 선창마다 둥지를 틀고 밧줄 타래를 품고 있어요.' },
  rustship: { n: '녹슨 비행선', hp: [6200, 0], dmg: [26, 40, 0], spd: .85, r: 1.15, sz: 1, xp: [5200, 0], atk: 2.2, ai: 'boss', boss: 1, big: 1, rustship: 1, fly: 1, spr: 'rustship', desc: '항구에 묶여 있던 낡은 비행선. 바람이 멎자 닻줄을 끊고 스스로 떠올라 항구를 내려다보며 포를 쏘아 대요.' },
});
const C3MOB = { saltfluff: 1, barnpod: 1, gull: 1, crab: 1, barnkeeper: 1 };
Object.assign(GOODS, {
  rope: { n: '밧줄 타래', ic: 'plank', d: '따개비 둥지지기가 품은 굵은 밧줄 타래. 줄다리를 잇는 데 써요', quest: 1 },
  salt: { n: '소금 결정', ic: 'hone', d: '바닷바람이 굳힌 소금 덩어리. 대장장이가 담금질에 써요', quest: 1 },
});
// 3장 장비(24·30레벨 단계): 2장 장비 틀을 한 단계 올린다 · 한 벌 「항구지기」 · 전해진 「닻의 마지막 무게」
const C3NAME = { spear3: ['spear5', '닻줄 창'], spear4: ['spear6', '작살 창'], staff3: ['staff5', '등대지기 지팡이'], staff4: ['staff6', '돛대 지팡이'], sword3: ['sword5', '갈고리 쌍칼'], sword4: ['sword6', '물보라 쌍칼'], xbow3: ['xbow5', '선창 석궁'], xbow4: ['xbow6', '작살 석궁'], hammer3: ['hammer5', '닻 망치'], hammer4: ['hammer6', '큰 닻 망치'], dagger2: ['dagger3', '소금 바람칼'], trapbox2: ['trapbox3', '그물 덫 상자'], gong2: ['gong3', '뱃종'], shield3: ['shield4', '방현재 방패'], bell2: ['bell3', '항구 풍경'], helm3: ['helm5', '항구지기 두건'], helm4: ['helm6', '잠수 투구'], armor3: ['armor5', '항구지기 비옷'], armor4: ['armor6', '따개비 갑옷'], legs3: ['legs5', '선원 바지'], legs4: ['legs6', '닻사슬 다리싸개'], inner2: ['inner3', '소금 먹인 안감'], cloak3: ['cloak4', '돛폭 망토'], glove2: ['glove3', '항구지기 장갑'], belt2: ['belt3', '항구지기 허리띠'], boots2: ['boots3', '갑판 장화'], amu2: ['amu3', '닻 목걸이'], ear2: ['ear3', '진주 귀걸이'], ring3: ['ring5', '따개비 반지'], ring4: ['ring6', '나침 반지'], sail4: ['sail5', '비행선 돛'] };
const C3BASES = C2BASES.map(b => { const [id, n] = C3NAME[b.id], o = { ...b, id, n, lv: b.lv + 12 };
  if (b.dmg) o.dmg = b.dmg.map(v => Math.round(v * 1.45));
  if (b.ac) o.ac = Math.round(b.ac * 1.4); if (b.blk) o.blk = b.blk + 3;
  if (b.fix) { o.fix = {}; for (const k in b.fix) o.fix[k] = Math.round(b.fix[k] * 1.6); }
  if (b.req) { o.req = {}; for (const k in b.req) o.req[k] = b.req[k] + 12; }
  if (b.sail) o.sail = [5.2, b.sail[1]];
  return o; });
BASES.push(...C3BASES); for (const b of C3BASES) BASE[b.id] = b;
SETS.harbor = { n: '항구지기', parts: [['helm5', '항구지기 두건'], ['armor5', '항구지기 비옷'], ['glove3', '항구지기 장갑'], ['belt3', '항구지기 허리띠']], bonus: [[2, [['ac', 10], ['hp', 70]]], [3, [['dmgp', 14], ['res', 14]]], [4, [['aspd', 10], ['lifek', 6], ['find', 30]]]] };
UNIQ.push({ id: 'u_anchor', n: '닻의 마지막 무게', base: 'amu3', story: '녹슨 비행선이 끊고 날아오른 닻줄 끝에 매달려 있던 작은 쇠닻. 걸고 있으면 어떤 바람에도 발이 땅에 붙는다.', fx: [['dmgp', 26], ['hp', 80], ['ac', 14], ['res', 16]], lv: 28 });

Object.assign(QUESTS, {
  q13: { ch: 3, n: '닻돌 항구의 부탁', from: 'chief', goal: '선창의 밑것 20마리 쓰러뜨리기', need: 20,
    talk: ['바람길을 타고 온 이음꾼이로군. 풍차 군도 소식은 갈매기보다 빨리 왔다네.', '여긴 닻돌 항구야. 바람이 멎은 뒤로 비행선이 한 척도 못 떴어. 선창엔 소금 보풀이며 닻집게가 들끓고.', '우선 스무 마리만 치워 주게. 짐꾼들이 선창에 나갈 수 있게.'],
    done: ['선창에 짐수레 소리가 다시 나는구먼. 고맙네.'] },
  q14: { ch: 3, n: '밧줄 다리', from: 'chief', goal: '따개비 둥지지기의 밧줄 타래 4개를 모아 가운데 선창 동쪽 줄다리 잇기', need: 4,
    talk: ['가운데 선창에서 밧줄 나루로 건너가는 줄다리가 있었는데, 녹슨 비행선이 닻줄을 끊고 떠오르던 날 같이 끊어졌어.', '선창마다 따개비 둥지지기가 둥지를 틀고 밧줄 타래를 품고 있다네. 네 타래면 다리를 다시 맬 수 있지.'],
    done: ['줄다리가 다시 걸렸어! 저 너머 밧줄 나루, 따개비 여울… 그리고 녹슨 정박장.', '비행선이 떠 있는 곳일세. 하늘을 잘 보게.'] },
  q15: { ch: 3, n: '집게 쫓기', from: 'sage', goal: '닻집게 12마리 쓰러뜨리기', need: 12,
    talk: ['솔바람이야. 여기까지 따라왔지! 닻집게들 봤어? 원래 끊어진 닻을 주워다 모으던 얌전한 게들이래.', '바람이 멎으니까 집게를 휘두르며 덤벼. 바닥에 둥근 표시가 뜨면 물러나. 열두 마리만 쉬게 해 줘.'],
    done: ['고마워. 바닷바람에서 다시 짠 냄새가 나. 이건 내가 주운 반지야.'] },
  q16: { ch: 3, n: '소금 담금질', from: 'smith', goal: '소금 결정 5개 가져오기', need: 5,
    talk: ['난 소금쇠, 항구 대장장이야. 무쇠랑 풀무 이야기는 들었어.', '바닷소금으로 담금질하면 쇠가 녹슬지 않지. 소금 보풀이랑 따개비 꼬투리가 소금 결정을 달고 다녀. 다섯 개만 부탁해.'],
    done: ['좋아, 이 정도면 한 해 내내 담금질하겠다. 수고비로 축복 받은 숫돌이랑 아교를 줄게.'] },
  q17: { ch: 3, n: '녹슨 정박장의 비행선', from: 'chief', goal: '녹슨 정박장의 녹슨 비행선을 떨어뜨리고 정박장 바람개비 표지에 손 얹기', need: 1,
    talk: ['녹슨 비행선이 정박장 위에 떠서 항구로 오는 바람을 다 막고 있네.', '녀석은 뱃전의 포를 한꺼번에 쏘아 바닥에 둥근 표시를 여러 개 띄우고, 닻을 내리꽂는다네. 갈매기 떼도 불러내지.', '성이 나면 머리 위를 지나가며 줄줄이 폭탄을 떨군다는군. 표시가 줄로 뜨면 옆으로 비켜서게.'],
    done: ['…바람이다! 묶여 있던 비행선들 돛이 부풀고 있어!', '고맙네, 이음꾼. 바람이 항구를 지나 더 높은 쪽으로 흘러가는구먼. 저 위 구름 너머에서 무언가가 바람을 기다리고 있는 것 같아.'] },
});
const C3NPC = { chief: '항구지기 닻줄', smith: '대장장이 소금쇠', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' };
function qAvail3(id) { const q = G.P.q; if (G.Wd.ch !== 3) return false; if (id === 'q13' || id === 'q15' || id === 'q16') return true; if (id === 'q14') return q.q13 && q.q13.s === 3; if (id === 'q17') return q.q14 && q.q14.s === 3; return false; }
function talk3(id, offer, finish) {
  const P = G.P, q = qid => P.q[qid], btns = []; let lines = null;
  if (id === 'chief') {
    if (!q('q13')) offer('q13'); else if (q('q13').s === 2) finish('q13'); else if (q('q13').s === 1) lines = ['소금 보풀이며 닻집게며 선창마다 들끓네. 스무 마리만 부탁하네.'];
    else if (!q('q14')) offer('q14'); else if (q('q14').s === 2) finish('q14'); else if (q('q14').s === 1) lines = ['밧줄 타래는 선창 둥지의 따개비 둥지지기가 품고 있다네. 네 타래 모아 가운데 선창 동쪽 끊긴 줄다리로 가게.'];
    else if (!q('q17')) offer('q17'); else if (q('q17').s === 2 && P.flags['wp_녹슨 정박장']) finish('q17'); else if (q('q17').s === 2) lines = ['비행선을 떨어뜨렸다고?! 정박장 바람개비 표지에 손을 얹어 주게. 바람이 항구로 돌아오게.'];
    else if (q('q17').s === 1) lines = ['녹슨 정박장은 밧줄 나루 너머 따개비 여울 끝일세. 표시가 줄로 뜨면 옆으로, 여러 개 뜨면 틈으로 비켜서게.'];
    else lines = ['비행선들이 다시 뜨기 시작했네. 자네 덕일세, 이음꾼.', '구름 너머로 가는 바람길은… 머지않아 열릴 걸세.']; }
  if (id === 'sage') { if (!q('q15')) offer('q15'); else if (q('q15').s === 2) finish('q15'); else lines = ['비행선은 원래 큰바람을 타고 섬과 섬 사이를 오갔대. 바람이 멎으니 다 묶여 버린 거지.', '감정 안 된 물건이 있으면 보여 줘. 하나에 15G면 봐 줄게.'];
    const n = P.inv.filter(it => !it.g && !it.id).length; btns.push(`<button class="sk-b" data-a="ident" ${n && P.gold >= 15 ? '' : 'disabled'}>감정하기 (${n}개 · 개당 15G)</button>`); }
  if (id === 'smith') { if (!q('q16')) offer('q16'); else if (q('q16').s === 1 && count('salt') >= 5) { lines = ['오, 소금 결정 다섯 개 다 모았구나!']; btns.push(`<button class="sk-b g" data-a="finish" data-q="q16">소금 건네기</button>`); } else if (q('q16').s === 1) lines = ['소금 결정은 소금 보풀이랑 따개비 꼬투리가 달고 다녀. 다섯 개야.']; else lines = ['강화든 옵션 다시 굴리기든 맡겨. 소금물에 담금질한 쇠는 잘 안 깨져.']; btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); }
  if (id === 'merchant') { lines = ['또 만났네! 항구엔 먼 섬 물건이 많아서 좋아.']; btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); }
  return { lines, btns };
}
function finish3(id) { const P = G.P; if (id === 'q16' && !useGood('salt', 5)) return false;
  const R = { q13: [4200, 900], q14: [5600, 1200], q15: [5000, 1100], q16: [2800, 800], q17: [12000, 3500] }[id]; if (!R) return false;
  P.q[id].s = 3; gainXp(R[0]); P.gold += R[1];
  if (id === 'q13') addInv(makeItem('amu3', 2, 27, { id: 1, st: 0 }));
  if (id === 'q14') addInv(makeItem('boots3', 2, 29, { id: 1, st: 1 }));
  if (id === 'q15') addInv(makeItem('ring6', 2, 29, { id: 1, st: 0 }));
  if (id === 'q16') { addInv(goods('bhone')); addInv(goods('bglue')); }
  if (id === 'q17') { addInv(makeItem('sail5', 2, 34, { id: 1, st: 1 })); addInv(goods('bhone', 2)); addInv(goods('bglue', 2)); }
  return R; }
function track3(id, q) { if (id === 'q13') return '선창 밑것 ' + q.n + '/20'; if (id === 'q14') return '밧줄 타래 ' + Math.min(4, count('rope')) + '/4 → 가운데 선창 동쪽 끊긴 줄다리'; if (id === 'q15') return '닻집게 ' + q.n + '/12'; if (id === 'q16') return '소금 결정 ' + Math.min(5, count('salt')) + '/5'; if (id === 'q17') return '녹슨 정박장의 녹슨 비행선'; return null; }
function spawnCh3() {
  const Wd = G.Wd, L = [...Wd.fi, ...Wd.ci];
  L.forEach((k, i) => { const s = Wd.islands[k], n = i >= 4 ? 5 : 4;
    for (let j = 0; j < n; j++) { const a = j / n * TAU + i * 1.1, d = s.r * .5; let x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d; if (!walk(Wd, x, y)) { x = s.cx; y = s.cy; }
      const kind = pick([['saltfluff'], ['saltfluff', 'barnpod'], ['gull'], ['crab'], ['crab', 'saltfluff'], ['barnpod']]);
      const pk = j === 0 ? { isl: k, x, y, lv: s.lv, kinds: ['saltfluff', 'barnpod', 'saltfluff'], n: 6, lead: 'barnkeeper', nest: 1, elite: ri(1, ELITE.length) }
        : { isl: k, x, y, lv: s.lv, kinds: kind, n: kind[0] === 'gull' ? 3 : kind[0] === 'crab' ? ri(2, 3) : ri(3, 5), elite: Math.random() < .25 ? ri(1, ELITE.length) : 0 };
      G.packs.push(pk); spawnPack(pk); } });
  const H = Wd.islands[Wd.hill];
  if (!G.P.flags.rustship) { const pk = { isl: Wd.hill, x: H.cx + 1, y: H.cy - 1, lv: [34, 34], kinds: ['rustship'], n: 1, boss: 1, nest: 1 }; G.packs.push(pk); spawnPack(pk); }
  for (const [ox, oy, kinds] of [[-4, 3, ['crab', 'saltfluff']], [3.5, 3.5, ['barnpod', 'gull']]]) { const pk = { isl: Wd.hill, x: H.cx + ox, y: H.cy + oy, lv: [32, 33], kinds, n: 3 }; G.packs.push(pk); spawnPack(pk); }
}
function ch3Kill(m) { const P = G.P; if (G.Wd.ch !== 3) return;
  if (C3MOB[m.t]) qAdd('q13', 1); if (m.t === 'crab') qAdd('q15', 1);
  if (m.t === 'barnkeeper' && P.q.q14 && P.q.q14.s === 1 && count('rope') + G.drops.filter(d => d.it && d.it.g === 'rope').length < 4) { G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods('rope'), t: 0 }); say('밧줄 타래를 떨궜어요!', '#ffe08a', 1); }
  if ((m.t === 'saltfluff' || m.t === 'barnpod') && P.q.q16 && P.q.q16.s === 1 && count('salt') + G.drops.filter(d => d.it && d.it.g === 'salt').length < 5 && Math.random() < .2) G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods('salt'), t: 0 });
}
// 포탄·닻·폭탄이 떨어지는 자리: 바닥 표시 뒤 터짐
function shipBlast(m, cx, cy, r, w, mul, c) { G.areas.push({ k: 'warn', x: cx, y: cy, r, t: 0, life: w });
  later(w, () => { if (m.dead) return; G.fx.push({ k: 'ring', x: cx, y: cy, r, t: 0, life: .35, c: c || '#ffc890' }, { k: 'crack', x: cx, y: cy, t: 0, life: .9 }); for (let i = 0; i < 8; i++) { const a = Math.random() * TAU; G.parts.push({ k: 'puff', x: cx, y: cy, z: 6, vx: Math.cos(a) * rnd(1, 3), vy: Math.sin(a) * rnd(1, 3), vz: rnd(60, 160), t: 0, life: rnd(.4, .8), c: pick(['#5a4e48', '#8a8078', '#ffb070']), s: rnd(2.5, 4.5) }); }
    G.shake = Math.max(G.shake, 4); sfx('slam'); if (!G.P.dead && hyp(G.P.x - cx, G.P.y - cy) < r + G.P.r) hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * mul, m); }); }
// 녹슨 비행선: 포 한꺼번에 쏘기 · 닻 내리꽂기 · 갈매기 부르기 · (성나면) 줄폭탄
function rustshipAI(m, dt, d, dx, dy) {
  const P = G.P, rage = m.hp < m.mhp * .5; if (rage && !m.raged) { m.raged = 1; G.cut = { s: '녹슨 비행선의 풍선이 찢어지며 기울어요!', t: 0, c: '#ffb070' }; sfx('slam'); G.shake = 8; }
  m.sum = (m.sum ?? 10) - dt; m.vol = (m.vol ?? 3) - dt; m.anc = (m.anc ?? 6) - dt; m.bomb = (m.bomb ?? 2) - dt;
  if (m.sum <= 0) { m.sum = rage ? 13 : 17; const ng = G.mobs.filter(o => o.t === 'gull' && !o.dead && hyp(o.x - m.x, o.y - m.y) < 9).length; if (ng < 6) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, x2 = m.x + Math.cos(a) * 2.2, y2 = m.y + Math.sin(a) * 2.2; if (walk(G.Wd, x2, y2)) { const n = mkMob('gull', x2, y2, 32); n.st = 'chase'; G.mobs.push(n); } }
    G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 2.4, t: 0, life: .5, c: '#d8dce4' }); say('녹슨 비행선이 갈매기 떼를 불러냈어요!', '#d8dce4', 1); }
  if (rage && m.bomb <= 0 && d < 9) { m.bomb = 7; const ux = dx / d, uy = dy / d; m.an = 'atk'; m.at = 0; m.hitDone = 1; sfx('gust');
    for (let i = 0; i < 7; i++) shipBlast(m, m.x + ux * (i * 1.5 + 1), m.y + uy * (i * 1.5 + 1), 1.1, .85 + i * .14, .75, '#ff9a60'); return; }
  if (m.vol <= 0 && d < 9) { m.vol = rage ? 4.2 : 5.5; m.an = 'atk'; m.at = 0; m.hitDone = 1; sfx('cone');
    const n = rage ? 6 : 5; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = i === 0 ? 0 : rnd(1.2, 2.8); shipBlast(m, P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, .95, 1 + i * .08, .6); } return; }
  if (m.anc <= 0 && d < 4.2) { m.anc = rage ? 5 : 7; m.an = 'atk'; m.at = 0; m.hitDone = 1; shipBlast(m, P.x, P.y, 2, .95, 1.05, '#e8d8b0'); return; }
  // 떠서 거리를 두고 맴돈다(너무 멀면 다가오고, 너무 가까우면 살짝 물러남)
  const sp = m.spd * (rage ? 1.2 : 1);
  if (d > 4.5) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; }
  else if (d < 2.2 && m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = rage ? 2 : 2.8; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 2.4, t: 0, life: .8 }); }
  else { const s = (m.orb = (m.orb || 1)); move(m, -dy / d * sp * .6 * s * dt, dx / d * sp * .6 * s * dt); if (Math.random() < dt * .25) m.orb = -s; m.an = 'move'; }
}
function ch3Area(a, dt) { return 0; }
function ch3Goals(Wd, P, goals) { const q = P.q, bq = Wd.bridges[Wd.bq];
  if (q.q14 && q.q14.s === 1) { const i = bq.cells[bq.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
  if (q.q17 && q.q17.s === 1) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); }
  if (q.q17 && q.q17.s === 2 && !P.flags['wp_녹슨 정박장']) goals.push([Wd.wps[2].x, Wd.wps[2].y]); }
function endHtml3() { const P = G.P; return `<div class="sk-bx sk-talk" style="text-align:center"><h3>3장 「닻 내린 항구」 끝</h3><p>녹슨 비행선이 정박장 위로 천천히 내려앉자, 막혀 있던 바람이 한꺼번에 항구로 쏟아져 들어왔다.</p><p>묶여 있던 비행선들의 돛이 부푼다. 바람은 이제 구름 너머 더 높은 곳으로 흘러간다.</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>4장은 다음에 열려요. 그동안 오늘의 섬과 하루 의뢰로 장비를 모아 보세요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }
