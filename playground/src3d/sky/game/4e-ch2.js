/* ---------- 2장 녹슨 풍차 군도 (15~25레벨) · 장 보스 삐걱 파수꾼 ---------- */
const C2_LV = [[15, 16], [16, 17], [17, 18], [18, 19], [20, 21], [21, 22]];
Object.assign(MOBDEF, {
  rustfluff: { n: '녹 보풀', hp: [12, 6], dmg: [3, 5, 1], spd: 1.75, r: .3, sz: 0, xp: [8, 4], atk: 1, ai: 'melee', spr: 'rustfluff', desc: '멈춘 풍차에서 떨어진 녹가루가 엉겨 붙은 보풀이. 떼로 몰려와요.' },
  boltpod: { n: '쇠못 꼬투리', hp: [20, 8], dmg: [4, 7, 1.4], spd: 1.2, r: .32, sz: 1, xp: [12, 5], atk: 1.2, ai: 'charge', spr: 'boltpod', desc: '껍질에 녹슨 쇠못이 박힌 꼬투리. 멀리서 냅다 들이받아요.' },
  rustcrow: { n: '녹슨 까마귀', hp: [10, 4], dmg: [3, 5, .9], spd: 2.6, r: .28, sz: 0, xp: [9, 4], atk: .9, ai: 'dive', fly: 1, spr: 'rustcrow', desc: '멈춘 풍차 날개에 둥지를 튼 까마귀. 떼로 내리꽂아요.' },
  scarecrow: { n: '낫 허수아비', hp: [34, 11], dmg: [5, 9, 1.5], spd: 1.3, r: .36, sz: 1, xp: [16, 6], atk: 2.6, ai: 'spin', spr: 'scarecrow', desc: '주인 잃은 밭을 지키던 허수아비. 가까이 오면 낫 손을 휘휘 돌려요(바닥 표시를 보고 피해요).' },
  cogkeeper: { n: '톱니 둥지지기', hp: [110, 26], dmg: [7, 12, 1.6], spd: 1.05, r: .55, sz: 1, xp: [80, 26], atk: 1.8, ai: 'boss', mini: 1, big: 1, spr: 'cogkeeper', desc: '쇠 껍질을 두른 둥지지기. 풍차 섬마다 둥지를 틀고 사슬 고리를 품고 있어요.' },
  creaker: { n: '삐걱 파수꾼', hp: [3600, 0], dmg: [18, 28, 0], spd: 1.05, r: 1.05, sz: 1, xp: [2600, 0], atk: 2.2, ai: 'boss', boss: 1, big: 1, creaker: 1, spr: 'creaker', desc: '큰 풍차를 지키던 나무·쇠 파수꾼. 바람이 멎자 등의 풍차 날개를 거꾸로 돌려 섬의 바람을 빨아들이고 있어요.' },
});
const C2MOB = { rustfluff: 1, boltpod: 1, rustcrow: 1, scarecrow: 1, cogkeeper: 1 };
Object.assign(GOODS, {
  chain: { n: '사슬 고리', ic: 'plank', d: '톱니 둥지지기가 품은 쇠사슬 고리. 다리를 잇는 데 써요', quest: 1 },
  cog: { n: '녹슨 톱니', ic: 'hone', d: '멈춘 풍차에서 빠진 톱니. 대장장이 풀무가 찾아요', quest: 1 },
});
// 2장 장비(12·18레벨 단계) · 한 벌 「풍차지기」 · 전해진 「멈춘 풍차의 심장」
const C2BASES = [
  { id: 'spear3', n: '풍차살 창', s: 'weapon', ic: 'spear2', cls: 'warden', dmg: [7, 14, 8, 16], spd: 1, lv: 12, req: { str: 26 } },
  { id: 'spear4', n: '톱니 창', s: 'weapon', ic: 'spear2', cls: 'warden', dmg: [9, 18, 11, 21], spd: .95, lv: 18, req: { str: 34 } },
  { id: 'staff3', n: '방앗간 지팡이', s: 'weapon', ic: 'staff2', cls: 'windcaller', dmg: [6, 13, 7, 14], spd: 1.05, lv: 12, req: { spi: 28 } },
  { id: 'staff4', n: '녹슨 바람틀 지팡이', s: 'weapon', ic: 'staff2', cls: 'windcaller', dmg: [8, 17, 9, 19], spd: 1.05, lv: 18, req: { spi: 36 } },
  { id: 'sword3', n: '쇠사슬 쌍칼', s: 'weapon', ic: 'sword2', cls: 'drifter', dmg: [5, 12, 6, 13], spd: 1.05, lv: 12, req: { agi: 28 } },
  { id: 'sword4', n: '톱날 쌍칼', s: 'weapon', ic: 'sword2', cls: 'drifter', dmg: [7, 15, 8, 17], spd: 1.08, lv: 18, req: { agi: 36 } },
  { id: 'xbow3', n: '방앗간 석궁', s: 'weapon', ic: 'xbow2', cls: 'trapper', dmg: [6, 14, 7, 15], spd: 1, lv: 12, req: { agi: 28 } },
  { id: 'xbow4', n: '쇠바퀴 석궁', s: 'weapon', ic: 'xbow2', cls: 'trapper', dmg: [8, 18, 9, 20], spd: 1, lv: 18, req: { agi: 36 } },
  { id: 'hammer3', n: '풍차 망치', s: 'weapon', ic: 'hammer2', cls: 'ringer', dmg: [8, 16, 9, 18], spd: .95, lv: 12, req: { str: 26 } },
  { id: 'hammer4', n: '큰 톱니 망치', s: 'weapon', ic: 'hammer2', cls: 'ringer', dmg: [10, 20, 12, 24], spd: .95, lv: 18, req: { str: 34 } },
  { id: 'dagger2', n: '녹슨 바람칼', s: 'off', ic: 'dagger', cls: 'drifter', ac: 2, fix: { crit: 4, aspd: 4 }, lv: 14 },
  { id: 'trapbox2', n: '톱니 덫 상자', s: 'off', ic: 'trapbox', cls: 'trapper', ac: 3, fix: { agi: 3 }, lv: 14 },
  { id: 'gong2', n: '쇠바퀴 종', s: 'off', ic: 'gong', cls: 'ringer', ac: 4, fix: { vit: 3 }, lv: 14 },
  { id: 'shield3', n: '풍차날 방패', s: 'off', ic: 'shield2', cls: 'warden', ac: 6, blk: 15, lv: 14, req: { str: 26 } },
  { id: 'bell2', n: '방앗간 풍경', s: 'off', ic: 'bell', cls: 'windcaller', ac: 2, fix: { spi: 3, wreg: 10 }, lv: 14 },
  { id: 'helm3', n: '풍차지기 고깔모', s: 'helm', ic: 'hat', ac: 4, lv: 12 },
  { id: 'helm4', n: '톱니 투구', s: 'helm', ic: 'helm', ac: 6, lv: 18, req: { str: 28 } },
  { id: 'armor3', n: '풍차지기 앞치마', s: 'armor', ic: 'armor1', ac: 11, lv: 12 },
  { id: 'armor4', n: '쇠사슬 조끼', s: 'armor', ic: 'armor2', ac: 14, lv: 18, req: { str: 28 } },
  { id: 'legs3', n: '방앗간 바지', s: 'legs', ic: 'legs1', ac: 7, lv: 12 },
  { id: 'legs4', n: '사슬 다리싸개', s: 'legs', ic: 'legs2', ac: 9, lv: 18, req: { str: 26 } },
  { id: 'inner2', n: '기름 먹인 안감', s: 'inner', ic: 'inner', ac: 3, fix: { res: 8 }, lv: 14 },
  { id: 'cloak3', n: '돛천 망토', s: 'cloak', ic: 'cloak2', ac: 3, fix: { agi: 2 }, lv: 12 },
  { id: 'glove2', n: '풍차지기 장갑', s: 'gloves', ic: 'gloves', ac: 3, lv: 12 },
  { id: 'belt2', n: '풍차지기 허리띠', s: 'belt', ic: 'belt', ac: 3, fix: { hp: 20 }, lv: 12 },
  { id: 'boots2', n: '쇠징 장화', s: 'boots', ic: 'boots', ac: 4, fix: { move: 3 }, lv: 14 },
  { id: 'amu2', n: '톱니 목걸이', s: 'amulet', ic: 'amulet2', fix: { hp: 30 }, lv: 12, noench: 1 },
  { id: 'ear2', n: '쇠 귀걸이', s: 'ear', ic: 'ear', fix: { crit: 3 }, lv: 14, noench: 1 },
  { id: 'ring3', n: '녹 반지', s: 'ring', ic: 'ring', fix: { vit: 3 }, lv: 12, noench: 1 },
  { id: 'ring4', n: '쇠바퀴 반지', s: 'ring', ic: 'ring2', fix: { str: 2, agi: 2 }, lv: 16, noench: 1 },
  { id: 'sail4', n: '풍차 날개 돛', s: 'sail', ic: 'sail3', sail: [4.5, .95], fix: { move: 6 }, lv: 16 },
];
BASES.push(...C2BASES); for (const b of C2BASES) BASE[b.id] = b;
SETS.mill = { n: '풍차지기', parts: [['helm3', '풍차지기 고깔모'], ['armor3', '풍차지기 앞치마'], ['glove2', '풍차지기 장갑'], ['belt2', '풍차지기 허리띠']], bonus: [[2, [['ac', 6], ['hp', 40]]], [3, [['dmgp', 10], ['res', 10]]], [4, [['aspd', 8], ['windk', 3], ['find', 25]]]] };
UNIQ.push({ id: 'u_millheart', n: '멈춘 풍차의 심장', base: 'amu2', story: '삐걱 파수꾼의 가슴 속에서 아직도 아주 천천히 돌고 있던 작은 톱니. 쥐면 손바닥에 바람이 인다.', fx: [['dmgp', 20], ['hp', 40], ['windk', 3], ['res', 12]], lv: 16 });

Object.assign(QUESTS, {
  q8: { ch: 2, n: '쇠바퀴 마을의 부탁', from: 'chief', goal: '풍차 섬의 녹슨 밑것 20마리 쓰러뜨리기', need: 20,
    talk: ['자네가 민들레 섬의 바람을 되찾았다는 이음꾼인가! 바람길을 타고 여기까지 오다니.', '여긴 쇠바퀴 마을, 녹슨 풍차 군도일세. 풍차가 멈춘 뒤로 녹 보풀이며 낫 허수아비가 들끓어.', '우선 스무 마리만 혼내 주게. 그래야 마을 사람들이 밭에 나갈 수 있어.'],
    done: ['허허, 밭에 사람들이 다시 나가는구먼. 자네 솜씨가 소문대로야.'] },
  q9: { ch: 2, n: '쇠사슬 다리', from: 'chief', goal: '톱니 둥지지기의 사슬 고리 4개를 모아 가운데 풍차섬 동쪽 쇠사슬 다리 잇기', need: 4,
    talk: ['가운데 풍차섬 동쪽으로 쇠사슬 다리가 있었는데, 큰 풍차가 거꾸로 돌던 날 사슬이 끊어졌다네.', '풍차 섬마다 톱니 둥지지기가 둥지를 틀고 끊어진 사슬 고리를 품고 있어. 네 개면 다리를 이을 수 있지.'],
    done: ['사슬 다리가 다시 이어졌구먼! 저 너머 사슬 나루, 그리고 큰 풍차섬…', '삐걱 파수꾼이 있는 곳일세. 마음 단단히 먹게.'] },
  q10: { ch: 2, n: '허수아비 밭', from: 'sage', goal: '낫 허수아비 12마리 쓰러뜨리기', need: 12,
    talk: ['솔바람이야, 나도 바람길 따라 왔어! 여기 허수아비들 봤어? 원래는 새만 쫓던 착한 애들이었대.', '바람이 멎으니까 낫 손을 돌리며 사람한테 덤벼. 바닥에 둥근 표시가 뜨면 얼른 물러나. 열두 마리만 쉬게 해 줘.'],
    done: ['고마워. 밭에서 바람 냄새가 다시 나. 이건 내가 주운 반지야.'] },
  q11: { ch: 2, n: '녹 벗기기', from: 'smith', goal: '녹슨 톱니 5개 가져오기', need: 5,
    talk: ['난 풀무, 여기 대장장이야. 무쇠 녀석 이야기는 들었지.', '녹 보풀이랑 쇠못 꼬투리가 풍차에서 빠진 톱니를 물고 다녀. 다섯 개만 갖다 주면 녹 벗기는 법을 알려 주지.'],
    done: ['좋아, 잘 닦으면 새것처럼 돌아가. 수고비로 축복 받은 숫돌이랑 아교를 줄게.'] },
  q12: { ch: 2, n: '큰 풍차섬의 삐걱 파수꾼', from: 'chief', goal: '큰 풍차섬의 삐걱 파수꾼을 쓰러뜨리고 큰 풍차섬 바람개비 표지에 손 얹기', need: 1,
    talk: ['큰 풍차를 지키던 파수꾼이 미쳐 버렸네. 등의 날개를 거꾸로 돌려 군도의 바람을 다 빨아들이고 있어.', '녀석은 날개를 휘둘러 둘레를 쓸고, 쇠사슬 주먹으로 바닥을 줄줄이 내리친다네. 쇠못 꼬투리도 불러내지.', '성이 나면 날개에서 바람 칼날이 사방으로 날아온다는군. 칼날 사이 틈으로 피하게.'],
    done: ['…풍차가 돈다! 군도의 풍차가 하나둘 다시 돌기 시작했어!', '고맙네, 이음꾼. 그런데 바람이 흘러가는 쪽을 보니… 닻 내린 항구 쪽 하늘이 이상하게 잠잠하구먼.'] },
});
const C2NPC = { chief: '풍차지기 대들보', smith: '대장장이 풀무', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' }, C1NPC = { chief: '촌장 들메', smith: '대장장이 무쇠', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' };
function setNpcNames(ch) { const N = typeof CHX !== 'undefined' && CHX[ch] ? CHX[ch].npc : ch === 3 ? C3NPC : ch === 2 ? C2NPC : C1NPC; for (const k in N) NPCDEF[k].n = N[k]; }
const qCh = id => QUESTS[id].ch || 1;
function qAvail2(id) { const q = G.P.q; if (G.Wd.ch !== 2) return false; if (id === 'q8' || id === 'q10' || id === 'q11') return true; if (id === 'q9') return q.q8 && q.q8.s === 3; if (id === 'q12') return q.q9 && q.q9.s === 3; return false; }
function talk2(id, offer, finish) {
  const P = G.P, q = qid => P.q[qid], btns = []; let lines = null;
  if (id === 'chief') {
    if (!q('q8')) offer('q8'); else if (q('q8').s === 2) finish('q8'); else if (q('q8').s === 1) lines = ['녹 보풀이며 허수아비며 풍차 섬마다 들끓네. 스무 마리만 부탁하네.'];
    else if (!q('q9')) offer('q9'); else if (q('q9').s === 2) finish('q9'); else if (q('q9').s === 1) lines = ['사슬 고리는 풍차 섬 둥지의 톱니 둥지지기가 품고 있다네. 네 개 모아 가운데 풍차섬 동쪽 끊긴 사슬 다리로 가게.'];
    else if (!q('q12')) offer('q12'); else if (q('q12').s === 2 && P.flags[wpk('큰 풍차섬')]) finish('q12'); else if (q('q12').s === 2) lines = ['파수꾼을 쓰러뜨렸다고?! 큰 풍차섬 바람개비 표지에 손을 얹어 주게. 바람이 돌아오게.'];
    else if (q('q12').s === 1) lines = ['큰 풍차섬은 사슬 나루 너머 톱니 벌판 끝일세. 녀석이 성나면 바람 칼날이 사방으로 날아와. 칼날 사이 틈을 보게.'];
    else lines = ['군도의 풍차가 다시 돈다네. 자네 덕일세, 이음꾼.', '닻 내린 항구로 가는 바람길이 열렸네. 바람개비 표지에서 건너가 보게.']; }
  if (id === 'sage') { if (!q('q10')) offer('q10'); else if (q('q10').s === 2) finish('q10'); else lines = ['풍차가 멈추면 바람도 고여서 썩어. 그래서 녹이 이렇게 빨리 스는 거래.', '감정 안 된 물건이 있으면 보여 줘. 하나에 15G면 봐 줄게.'];
    const n = P.inv.filter(it => !it.g && !it.id).length; btns.push(`<button class="sk-b" data-a="ident" ${n && P.gold >= 15 ? '' : 'disabled'}>감정하기 (${n}개 · 개당 15G)</button>`); }
  if (id === 'smith') { if (!q('q11')) offer('q11'); else if (q('q11').s === 1 && count('cog') >= 5) { lines = ['오, 톱니 다섯 개 다 모았구나!']; btns.push(`<button class="sk-b g" data-a="finish" data-q="q11">톱니 건네기</button>`); } else if (q('q11').s === 1) lines = ['녹슨 톱니는 녹 보풀이랑 쇠못 꼬투리가 물고 다녀. 다섯 개야.']; else lines = ['강화든 옵션 다시 굴리기든 맡겨. 여기 쇠는 단단해서 무쇠네보다 잘 붙지.']; btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); }
  if (id === 'merchant') { lines = ['또 만났네! 바람길이 열리니까 나도 따라왔지. 여긴 쇠붙이가 좋아.']; btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); }
  return { lines, btns };
}
function finish2(id) { const P = G.P; if (id === 'q11' && !useGood('cog', 5)) return false;
  const R = { q8: [1800, 500], q9: [2500, 700], q10: [2200, 600], q11: [1200, 400], q12: [6000, 2000] }[id]; if (!R) return false;
  P.q[id].s = 3; gainXp(R[0]); P.gold += R[1];
  if (id === 'q8') addInv(makeItem('ear2', 2, 17, { id: 1, st: 0 }));
  if (id === 'q9') addInv(makeItem('boots2', 2, 19, { id: 1, st: 1 }));
  if (id === 'q10') addInv(makeItem('ring4', 2, 19, { id: 1, st: 0 }));
  if (id === 'q11') { addInv(goods('bhone')); addInv(goods('bglue')); }
  if (id === 'q12') { addInv(makeItem('sail4', 2, 25, { id: 1, st: 1 })); addInv(goods('bhone', 2)); addInv(goods('bglue', 2)); }
  return R; }
function track2(id, q) { if (id === 'q8') return '녹슨 밑것 ' + q.n + '/20'; if (id === 'q9') return '사슬 고리 ' + Math.min(4, count('chain')) + '/4 → 가운데 풍차섬 동쪽 끊긴 다리'; if (id === 'q10') return '낫 허수아비 ' + q.n + '/12'; if (id === 'q11') return '녹슨 톱니 ' + Math.min(5, count('cog')) + '/5'; if (id === 'q12') return '큰 풍차섬의 삐걱 파수꾼'; return null; }
function spawnCh2() {
  const Wd = G.Wd, L = [...Wd.fi, ...Wd.ci];
  L.forEach((k, i) => { const s = Wd.islands[k], n = i >= 4 ? 5 : 4;
    for (let j = 0; j < n; j++) { const a = j / n * TAU + i * 1.1, d = s.r * .5; let x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d; if (!walk(Wd, x, y)) { x = s.cx; y = s.cy; }
      const kind = pick([['rustfluff'], ['rustfluff', 'boltpod'], ['rustcrow'], ['scarecrow'], ['scarecrow', 'rustfluff'], ['boltpod']]);
      const pk = j === 0 ? { isl: k, x, y, lv: s.lv, kinds: ['rustfluff', 'boltpod', 'rustfluff'], n: 6, lead: 'cogkeeper', nest: 1, elite: ri(1, ELITE.length) }
        : { isl: k, x, y, lv: s.lv, kinds: kind, n: kind[0] === 'rustcrow' ? 3 : kind[0] === 'scarecrow' ? ri(2, 3) : ri(3, 5), elite: Math.random() < .25 ? ri(1, ELITE.length) : 0 };
      G.packs.push(pk); spawnPack(pk); } });
  const H = Wd.islands[Wd.hill];
  if (!G.P.flags.creaker) { const pk = { isl: Wd.hill, x: H.cx + 1, y: H.cy - 1, lv: [25, 25], kinds: ['creaker'], n: 1, boss: 1, nest: 1 }; G.packs.push(pk); spawnPack(pk); }
  for (const [ox, oy, kinds] of [[-4, 3, ['scarecrow', 'rustfluff']], [3.5, 3.5, ['boltpod', 'rustcrow']]]) { const pk = { isl: Wd.hill, x: H.cx + ox, y: H.cy + oy, lv: [22, 23], kinds, n: 3 }; G.packs.push(pk); spawnPack(pk); }
}
function ch2Kill(m) { const P = G.P; if (G.Wd.ch !== 2) return;
  if (C2MOB[m.t]) qAdd('q8', 1); if (m.t === 'scarecrow') qAdd('q10', 1);
  if (m.t === 'cogkeeper' && P.q.q9 && P.q.q9.s === 1 && count('chain') + G.drops.filter(d => d.it && d.it.g === 'chain').length < 4) { G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods('chain'), t: 0 }); say('사슬 고리를 떨궜어요!', '#ffe08a', 1); }
  if ((m.t === 'rustfluff' || m.t === 'boltpod') && P.q.q11 && P.q.q11.s === 1 && count('cog') + G.drops.filter(d => d.it && d.it.g === 'cog').length < 5 && Math.random() < .2) G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods('cog'), t: 0 });
}
// 낫 허수아비: 다가와서 낫 손 돌리기(바닥 표시 뒤 원형 공격)
function spinAI(m, dt, d, dx, dy, sp) {
  if (m.spinW > 0) { m.spinW -= dt; m.an = 'hurt'; m.at = .1; if (m.spinW <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 1; G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 1.6, t: 0, life: .35, c: '#e8c88a' }); sfx('cone'); if (hyp(G.P.x - m.x, G.P.y - m.y) < 1.6 + G.P.r) hurtPlayer(rnd(m.dmg[0], m.dmg[1]), m); } return; }
  if (d < 1.7 && m.cd <= 0) { m.cd = m.D.atk * rnd(.9, 1.2); m.spinW = .65; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 1.6, t: 0, life: .65 }); return; }
  if (d > 1.1) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m); } else m.an = 'idle';
}
// 삐걱 파수꾼: 날개 휘둘러 쓸기 · 쇠사슬 주먹 줄 내리치기 · 쇠못 꼬투리 부르기 · (성나면) 바람 칼날
function creakerAI(m, dt, d, dx, dy) {
  const P = G.P, rage = m.hp < m.mhp * .5; if (rage && !m.raged) { m.raged = 1; G.cut = { s: '삐걱 파수꾼의 날개가 거꾸로 돌아요!', t: 0, c: '#ffb070' }; sfx('slam'); G.shake = 8; }
  m.sum = (m.sum ?? 12) - dt; m.sw = (m.sw ?? 4) - dt; m.chn = (m.chn ?? 7) - dt; m.bl = (m.bl ?? 2) - dt;
  if (m.sum <= 0) { m.sum = rage ? 14 : 18; for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, x2 = m.x + Math.cos(a) * 2, y2 = m.y + Math.sin(a) * 2; if (walk(G.Wd, x2, y2)) { const n = mkMob('boltpod', x2, y2, 22); n.st = 'chase'; G.mobs.push(n); } }
    G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 2.4, t: 0, life: .5, c: '#c8a070' }); say('삐걱 파수꾼이 쇠못 꼬투리를 불러냈어요!', '#e8c88a', 1); }
  if (rage && m.bl <= 0) { m.bl = 6.5; m.ang = (m.ang || 0) + .4; for (let i = 0; i < 8; i++) { const a = m.ang + i / 8 * TAU; G.areas.push({ k: 'blade', x: m.x, y: m.y, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, t: 0, life: 2.3, dmg: rnd(m.dmg[0], m.dmg[1]) * .55, src: m }); } sfx('gust'); }
  if (m.chn <= 0 && d > 2.4 && d < 8.5) { m.chn = rage ? 6.5 : 8.5; const ux = dx / d, uy = dy / d; m.an = 'atk'; m.at = 0; m.hitDone = 1;
    for (let i = 1; i <= 4; i++) { const cx = m.x + ux * i * 1.7, cy = m.y + uy * i * 1.7, w = .8 + i * .16; G.areas.push({ k: 'warn', x: cx, y: cy, r: 1.15, t: 0, life: w });
      later(w, () => { if (m.dead) return; G.fx.push({ k: 'ring', x: cx, y: cy, r: 1.15, t: 0, life: .3, c: '#ffd0a0' }, { k: 'crack', x: cx, y: cy, t: 0, life: .9 }); G.shake = Math.max(G.shake, 4); sfx('slam'); if (hyp(G.P.x - cx, G.P.y - cy) < 1.15 + G.P.r) hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * .8, m); }); }
    return; }
  if (m.sw <= 0 && d < 3.4) { m.sw = rage ? 5 : 7; m.an = 'atk'; m.at = 0; m.hitDone = 0; m.kind = 'sweep'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 3.1, t: 0, life: .8 }); return; }
  if (d > m.r + 1) { move(m, dx / d * m.spd * (rage ? 1.15 : 1) * dt, dy / d * m.spd * (rage ? 1.15 : 1) * dt); m.an = 'move'; }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = rage ? 1.9 : 2.6; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 2.4, t: 0, life: .8 }); }
  else m.an = 'idle';
}
function creakerSweep(m) { const P = G.P, d = hyp(P.x - m.x, P.y - m.y) || 1; G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 3.1, t: 0, life: .4, c: '#f0d8a8' }, { k: 'ring', x: m.x, y: m.y, r: 2.2, t: 0, life: .3, c: '#ffffff' }); G.shake = 7; sfx('gust');
  if (d < 3.1 + P.r) { hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * .9, m); const kx = (P.x - m.x) / d * 2.6, ky = (P.y - m.y) / d * 2.6; for (let i = 0; i < 10; i++) move(P, kx / 10, ky / 10); } }
function ch2Area(a, dt) {
  if (a.k !== 'blade') return ch3Area(a, dt); const P = G.P; a.x += a.vx * dt; a.y += a.vy * dt; a.rot = (a.rot || 0) + dt * 14;
  if (!G.Wd.inb(Math.floor(a.x), Math.floor(a.y))) { a.t = a.life; return 1; }
  if (!P.dead && hyp(P.x - a.x, P.y - a.y) < .5 + P.r && !a.hit) { a.hit = 1; a.t = a.life; G.fx.push({ k: 'pop', x: a.x, y: a.y, t: 0, life: .3, c: '#f0d8a8' }); hurtPlayer(a.dmg, a.src); }
  return 1;
}
function drawBlade(a) { const [ax, ay] = iso(a.x, a.y), Y = ay - 22; x.save(); x.translate(ax, Y); x.rotate(a.rot || 0); x.fillStyle = 'rgba(30,24,18,.25)'; x.restore();
  x.fillStyle = 'rgba(30,30,20,.22)'; x.beginPath(); x.ellipse(ax, ay, 9, 4, 0, 0, TAU); x.fill();
  x.save(); x.translate(ax, Y); x.rotate(a.rot || 0); for (let i = 0; i < 4; i++) { x.rotate(Math.PI / 2); x.fillStyle = i % 2 ? '#e8d8b0' : '#c8a878'; x.beginPath(); x.moveTo(0, 0); x.lineTo(14, -3); x.lineTo(15, 3); x.closePath(); x.fill(); x.strokeStyle = '#5a3e24'; x.lineWidth = 1.2; x.stroke(); } x.fillStyle = '#5a4e48'; x.beginPath(); x.arc(0, 0, 3, 0, TAU); x.fill(); x.restore(); }
// 장 넘나들기(바람개비 표지)
const CHAPS = { 1: ['1장 · 민들레 섬', '민들레 마을로 돌아가요', () => 1], 2: ['2장 · 녹슨 풍차 군도', '바람길을 타고 건너가요 (15~25레벨)', P => P.q.q7 && P.q.q7.s === 3], 3: ['3장 · 닻 내린 항구', '바람길을 타고 건너가요 (25~34레벨)', P => P.q.q12 && P.q.q12.s === 3] };
function goChapter(n) { const P = G.P; P.ch = n; const S = snap(); PANEL = null; panel.hidden = true; panel.innerHTML = ''; MINI = null; startGame(S); G.cut = { s: CHAPS[n][0], c: '#ffd166', t: 0 }; save(); last = performance.now(); }
function chapHtml() { const P = G.P, ch = G.Wd.ch; let h = '';
  for (const n in CHAPS) { const [t, d, ok] = CHAPS[n]; if (+n === ch || !ok(P)) continue; h += `<div class="sk-row"><div class="f"><b>${t}</b><br><small>${+n < ch ? '다시 건너가요' : d}</small></div><button class="sk-b${+n > ch ? ' g' : ''}" data-a="chap" data-i="${n}">건너가기</button></div>`; }
  return h ? '<h4 style="margin:10px 0 4px">바람길</h4>' + h : ''; }
function endHtml2() { const P = G.P; return `<div class="sk-bx sk-talk" style="text-align:center"><h3>2장 「녹슨 풍차 군도」 끝</h3><p>삐걱 파수꾼이 쓰러지자 거꾸로 돌던 큰 풍차가 멈칫하더니, 천천히 제 방향으로 돌기 시작했다.</p><p>군도의 풍차들이 하나둘 따라 돈다. 바람은 이제 닻 내린 항구 쪽으로 흘러간다 — 거기엔 묶인 비행선들이 있다.</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>바람개비 표지(이동)의 「바람길」에서 3장 닻 내린 항구로 건너갈 수 있어요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }
