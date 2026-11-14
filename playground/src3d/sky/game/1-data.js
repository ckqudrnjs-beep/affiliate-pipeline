/* 끊어진 하늘 — 5락실 오리지널 쿼터뷰 파밍 RPG 맛보기판 (2026-11-14, 테스터 전용)
   1장 민들레 섬 앞부분 · 방패지기/바람술사 · 장비(부위 14칸·방어력·+강화·축복/저주·감정·길들이기·대장간).
   세계관·이름·시스템은 5락실 기획(plan/SKY_RPG.md) 오리지널. 캐릭터·소품 그림은 KayKit(CC0) 3D 모델을 다시 렌더링.
   이 파일은 src3d/sky/game/*.js 를 build.mjs 로 이어 붙인 결과물이다. 직접 고치지 말고 원본을 고친다. */
(function () {
'use strict';
const DEBUG = /skydebug/.test(location.hash);
const TAU = Math.PI * 2, STEP = 1 / 60;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
const hyp = Math.hypot;
function srand(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const IMG = '/img/sky/';

/* ---------- 직업 ---------- */
const CLASSES = {
  warden: { name: '방패지기', desc: '창과 방패로 막고 되받아치는 앞줄 싸움꾼. 적을 섬 끝으로 밀어 떨어뜨리는 데 능해요.', stat: { str: 13, agi: 8, vit: 12, spi: 6 }, melee: 1, range: 1.35, aspd: 1.45, col: '#4fb3d9' },
  windcaller: { name: '바람술사', desc: '바람과 번개를 다루는 술사. 멀리서 몰아치고, 구름으로 몸을 지켜요.', stat: { str: 6, agi: 9, vit: 9, spi: 15 }, melee: 0, range: 6, aspd: 1.25, col: '#9fe4ff' },
};
const STATS = [['str', '힘', '근접 피해 +1%, 무거운 장비 조건'], ['agi', '민첩', '공격 속도·치명타·회피'], ['vit', '인내', '생명력 +4, 상태이상 저항'], ['spi', '숨', '바람 +2·회복, 마법 피해 +1%']];

/* ---------- 스킬: 직업당 3갈래 × 2 (맛보기판). 스킬 레벨 5에서 갈래 고르기 ---------- */
// t: 종류(엔진 구현), br: 갈래, req: 필요 레벨, cost: 바람, cd: 재사용(초), m: 피해 배율(레벨당 +ml)
const SKILLS = {
  warden: [
    { id: 'pierce', name: '꿰뚫기', br: 0, req: 1, cost: 4, cd: .7, m: 1.5, ml: .1, t: 'line', len: 2.6, desc: '앞으로 길게 찔러 줄 선 적을 모두 꿰뚫어요.',
      fork: [['연속 찌르기', '세 번 빠르게 찔러요(한 번에 70%).'], ['멀리 찌르기', '사거리 +50%, 맞은 적을 크게 밀어내요.']] },
    { id: 'sweep', name: '휘둘러 쓸기', br: 0, req: 4, cost: 8, cd: 3, m: 1.1, ml: .1, t: 'nova', r: 1.7, desc: '창을 크게 돌려 둘레의 적을 모두 쳐요.',
      fork: [['회오리 창', '1.5초 동안 계속 돌며 여러 번 쳐요.'], ['쓸어 밀기', '맞은 적을 멀리 밀어내요. 섬 끝 근처라면…']] },
    { id: 'bash', name: '방패 밀치기', br: 1, req: 2, cost: 6, cd: 4, m: 1.0, ml: .08, t: 'cone', r: 1.9, arc: 1.4, stun: 1, kb: 5, desc: '방패로 앞쪽 적을 밀치고 잠깐 기절시켜요.',
      fork: [['방패 돌진', '세 칸을 돌진하며 부딪친 적을 밀어요.'], ['울리는 방패', '기절 2초, 범위가 넓어져요.']] },
    { id: 'hold', name: '굳건히', br: 1, req: 6, cost: 10, cd: 14, m: 0, ml: 0, t: 'buff', dur: 6, desc: '6초 동안 받는 피해 30%↓(레벨당 2%↑).',
      fork: [['되받아치기', '버티는 동안 받은 피해의 40%를 돌려줘요.'], ['든든한 땅', '밀려나지 않고 생명력이 차올라요.']] },
    { id: 'shout', name: '부르짖음', br: 2, req: 3, cost: 6, cd: 9, m: 0, ml: 0, t: 'shout', r: 4.5, dur: 6, desc: '주변 적의 눈길을 끌고 방어력이 올라요.',
      fork: [['겁주기', '적이 2초 동안 달아나요.'], ['용기', '8초 동안 공격력 +25%.']] },
    { id: 'flag', name: '바람 깃발', br: 2, req: 8, cost: 14, cd: 18, m: .4, ml: .05, t: 'flag', r: 3, dur: 8, desc: '깃발을 꽂아 8초 동안 그 자리에서 바람·생명이 차올라요.',
      fork: [['돌풍 깃발', '2초마다 둘레 적을 밀어내요.'], ['쉼터 깃발', '회복량 두 배.']] },
  ],
  windcaller: [
    { id: 'gust', name: '돌풍', br: 0, req: 1, cost: 5, cd: .9, m: 1.3, ml: .1, t: 'cone', r: 3.2, arc: 1.1, kb: 4, desc: '앞으로 돌풍을 일으켜 적을 밀어내요.',
      fork: [['칼바람', '피해 +40%, 맞은 적이 3초 동안 베여요.'], ['큰 돌풍', '범위·밀어내기가 크게 늘어요.']] },
    { id: 'twister', name: '회오리', br: 0, req: 4, cost: 9, cd: 3.5, m: .45, ml: .05, t: 'twister', dur: 2.2, desc: '천천히 나아가며 적을 끌어당겨 계속 때리는 회오리.',
      fork: [['쌍회오리', '두 개가 갈라져 나가요.'], ['머무는 회오리', '3초 동안 그 자리에 머물러요.']] },
    { id: 'bolt', name: '번개 화살', br: 1, req: 2, cost: 5, cd: .6, m: 1.4, ml: .12, t: 'bolt', desc: '빠르게 날아가는 번개 한 줄기.',
      fork: [['갈래 번개', '세 갈래로 퍼져요(한 줄기 70%).'], ['꿰뚫는 번개', '적을 뚫고 지나가요.']] },
    { id: 'chain', name: '이어 번개', br: 1, req: 6, cost: 12, cd: 2.5, m: 1.2, ml: .1, t: 'chain', jumps: 4, desc: '가까운 적에게 차례로 옮겨 붙는 번개(4번).',
      fork: [['긴 사슬', '7번까지 옮겨 붙어요.'], ['저린 번개', '맞은 적이 30% 확률로 기절해요.']] },
    { id: 'cloud', name: '구름 방패', br: 2, req: 3, cost: 10, cd: 12, m: 0, ml: 0, t: 'shield', dur: 10, desc: '구름으로 몸을 감싸 피해를 흡수해요(숨에 비례).',
      fork: [['얼음 구름', '때린 적이 느려져요.'], ['비구름', '유지되는 동안 생명력이 차올라요.']] },
    { id: 'mist', name: '안개 장막', br: 2, req: 8, cost: 14, cd: 15, m: .3, ml: .04, t: 'mist', r: 3.2, dur: 6, desc: '안개를 깔아 안의 적이 느려지고 자주 헛손질해요.',
      fork: [['짙은 안개', '10초 동안 유지돼요.'], ['번개 구름', '1초마다 안의 적을 번개로 때려요.']] },
  ],
};
const BRANCH = { warden: ['창', '방패', '함성'], windcaller: ['바람', '번개', '구름'] };

/* ---------- 장비 ---------- */
const SLOTS = [['weapon', '무기'], ['off', '보조'], ['helm', '투구'], ['armor', '갑옷'], ['inner', '안감'], ['cloak', '망토'], ['gloves', '장갑'], ['belt', '허리띠'], ['boots', '장화'], ['amulet', '목걸이'], ['ear', '귀걸이'], ['ring1', '반지'], ['ring2', '반지'], ['sail', '돛']];
const SLOTN = Object.fromEntries(SLOTS);
// 기본 장비. ic: 그림 칸, dmg: [작은 적 최소,최대, 큰 적 최소,최대], ac: 방어력, req: {lv,str…}, cls
const BASES = [
  { id: 'spear0', n: '나무 창', s: 'weapon', ic: 'spear', cls: 'warden', dmg: [3, 7, 4, 8], spd: 1, lv: 1 },
  { id: 'spear1', n: '목동의 창', s: 'weapon', ic: 'spear', cls: 'warden', dmg: [3, 8, 4, 10], spd: 1, lv: 4 },
  { id: 'spear2', n: '쇠끝 창', s: 'weapon', ic: 'spear2', cls: 'warden', dmg: [5, 11, 6, 13], spd: .95, lv: 8, req: { str: 20 } },
  { id: 'staff0', n: '버드나무 지팡이', s: 'weapon', ic: 'staff', cls: 'windcaller', dmg: [3, 6, 3, 7], spd: 1, lv: 1 },
  { id: 'staff1', n: '바람개비 지팡이', s: 'weapon', ic: 'staff2', cls: 'windcaller', dmg: [3, 7, 3, 8], spd: 1, lv: 4, fix: { spi: 1 } },
  { id: 'staff2', n: '종이연 지팡이', s: 'weapon', ic: 'staff2', cls: 'windcaller', dmg: [4, 10, 5, 11], spd: 1.05, lv: 8, req: { spi: 22 } },
  { id: 'shield0', n: '둥근 나무 방패', s: 'off', ic: 'shield', cls: 'warden', ac: 2, blk: 8, lv: 1 },
  { id: 'shield1', n: '쇠테 방패', s: 'off', ic: 'shield2', cls: 'warden', ac: 4, blk: 12, lv: 6, req: { str: 18 } },
  { id: 'bell0', n: '바람 방울', s: 'off', ic: 'bell', cls: 'windcaller', ac: 1, fix: { wreg: 10 }, lv: 1 },
  { id: 'bell1', n: '깃털 묶음', s: 'off', ic: 'feather', cls: 'windcaller', ac: 1, fix: { spi: 2 }, lv: 6 },
  { id: 'helm0', n: '가죽 두건', s: 'helm', ic: 'hood', ac: 1, lv: 1 },
  { id: 'helm1', n: '쇠 투구', s: 'helm', ic: 'helm', ac: 3, lv: 5, req: { str: 16 } },
  { id: 'helm2', n: '깃털 모자', s: 'helm', ic: 'hat', ac: 1, fix: { spi: 1 }, lv: 3 },
  { id: 'armor0', n: '누빈 옷', s: 'armor', ic: 'armor0', ac: 3, lv: 1 },
  { id: 'armor1', n: '가죽 갑옷', s: 'armor', ic: 'armor1', ac: 5, lv: 4 },
  { id: 'armor2', n: '비늘 조끼', s: 'armor', ic: 'armor2', ac: 8, lv: 8, req: { str: 20 } },
  { id: 'inner0', n: '무명 안감', s: 'inner', ic: 'inner', ac: 1, lv: 1 },
  { id: 'inner1', n: '털 안감', s: 'inner', ic: 'inner', ac: 2, fix: { res: 5 }, lv: 5 },
  { id: 'cloak0', n: '낡은 망토', s: 'cloak', ic: 'cloak', ac: 1, lv: 1 },
  { id: 'cloak1', n: '들꽃 망토', s: 'cloak', ic: 'cloak2', ac: 2, fix: { agi: 1 }, lv: 5 },
  { id: 'glove0', n: '천 장갑', s: 'gloves', ic: 'gloves', ac: 1, lv: 1 },
  { id: 'glove1', n: '가죽 장갑', s: 'gloves', ic: 'gloves', ac: 2, lv: 5 },
  { id: 'belt0', n: '새끼줄 허리띠', s: 'belt', ic: 'belt', ac: 1, lv: 1 },
  { id: 'belt1', n: '가죽 허리띠', s: 'belt', ic: 'belt', ac: 2, fix: { hp: 10 }, lv: 5 },
  { id: 'boots0', n: '짚신', s: 'boots', ic: 'boots0', ac: 0, fix: { move: 3 }, lv: 1 },
  { id: 'boots1', n: '가죽 장화', s: 'boots', ic: 'boots', ac: 2, lv: 4 },
  { id: 'amu0', n: '민들레 목걸이', s: 'amulet', ic: 'amulet', fix: { hp: 12 }, lv: 2, noench: 1 },
  { id: 'amu1', n: '조약돌 목걸이', s: 'amulet', ic: 'amulet2', fix: { ac: 2 }, lv: 5, noench: 1 },
  { id: 'ear0', n: '깃털 귀걸이', s: 'ear', ic: 'ear', fix: { agi: 1 }, lv: 2, noench: 1 },
  { id: 'ear1', n: '구리 귀걸이', s: 'ear', ic: 'ear', fix: { spi: 1 }, lv: 3, noench: 1 },
  { id: 'ring0', n: '풀잎 반지', s: 'ring', ic: 'ring', fix: { str: 1 }, lv: 2, noench: 1 },
  { id: 'ring1', n: '구리 반지', s: 'ring', ic: 'ring2', fix: { hp: 8 }, lv: 3, noench: 1 },
  { id: 'sail0', n: '헝겊 돛', s: 'sail', ic: 'sail', sail: [3, 1.3], lv: 1 },
  { id: 'sail1', n: '연잎 돛', s: 'sail', ic: 'sail2', sail: [3.5, 1.05], lv: 4 },
  { id: 'sail2', n: '갈매기 돛', s: 'sail', ic: 'sail3', sail: [4, 1], fix: { move: 5 }, lv: 8 },
];
const BASE = Object.fromEntries(BASES.map(b => [b.id, b]));
// 쓰는 물건(장비 아님)
const GOODS = {
  pot: { n: '민들레 차', ic: 'pot', d: '생명력 40% 회복', price: 25 },
  wpot: { n: '바람 사탕', ic: 'wpot', d: '바람 50% 회복', price: 20 },
  hone: { n: '바람 숫돌', ic: 'hone', d: '무기 강화 재료' },
  glue: { n: '바람 아교', ic: 'glue', d: '방어구 강화 재료' },
  bhone: { n: '축복 받은 숫돌', ic: 'bhone', d: '무기를 1~2단계 강화, 실패해도 그대로' },
  bglue: { n: '축복 받은 아교', ic: 'bglue', d: '방어구를 1~2단계 강화, 실패해도 그대로' },
  pure: { n: '맑은 샘물', ic: 'pure', d: '저주받은 장비를 정화', price: 60 },
  look: { n: '살펴보기 쪽지', ic: 'look', d: '감정 안 된 장비 하나를 감정', price: 30 },
  plank: { n: '다리 널빤지', ic: 'plank', d: '끊어진 다리를 고치는 재료', quest: 1 },
};
const RAR = [ // 등급: 이름, 색, 무작위 옵션 수
  { n: '보통', c: '#ece6d6', k: [0, 0] }, { n: '손본', c: '#8ee8b0', k: [1, 2] }, { n: '이름난', c: '#c9a8ff', k: [3, 4] }, { n: '전해진', c: '#ff9f7c', k: [0, 0] }, { n: '한 벌', c: '#ffb7dc', k: [0, 0] },
];
// 무작위 옵션. w: 붙는 부위(a=모두, W=무기, A=방어구, J=장신구), v: [최소, 최대](아이템 레벨 비례 보정)
const AFX = [
  { k: 'dmgp', d: '피해 +{}%', w: 'WJ', v: [6, 18] }, { k: 'ac', d: '방어력 +{}', w: 'A', v: [1, 4] }, { k: 'aspd', d: '공격 속도 +{}%', w: 'WJ', v: [4, 10] },
  { k: 'hp', d: '생명력 +{}', w: 'a', v: [6, 24] }, { k: 'wind', d: '바람 +{}', w: 'a', v: [4, 14] }, { k: 'wreg', d: '바람 회복 +{}%', w: 'AJ', v: [8, 25] },
  { k: 'crit', d: '치명타 +{}%', w: 'WJ', v: [2, 6] }, { k: 'move', d: '이동 속도 +{}%', w: 'A', v: [3, 8] }, { k: 'thorn', d: '맞으면 {} 되돌려줌', w: 'A', v: [2, 8] },
  { k: 'kb', d: '밀어내기 +{}%', w: 'W', v: [15, 40] }, { k: 'str', d: '힘 +{}', w: 'a', v: [1, 4] }, { k: 'agi', d: '민첩 +{}', w: 'a', v: [1, 4] },
  { k: 'vit', d: '인내 +{}', w: 'a', v: [1, 4] }, { k: 'spi', d: '숨 +{}', w: 'a', v: [1, 4] }, { k: 'res', d: '모든 저항 +{}%', w: 'AJ', v: [4, 12] },
  { k: 'lifek', d: '처치 시 생명력 +{}', w: 'WJ', v: [1, 4] }, { k: 'windk', d: '처치 시 바람 +{}', w: 'WJ', v: [1, 3] }, { k: 'blk', d: '막기 확률 +{}%', w: 'A', v: [3, 8] },
  { k: 'xp', d: '경험치 +{}%', w: 'J', v: [3, 8] }, { k: 'find', d: '좋은 물건 찾기 +{}%', w: 'AJ', v: [6, 18] }, { k: 'sk0', d: '{br0} 갈래 스킬 +1', w: 'WJ', v: [1, 1], rare: 1 },
  { k: 'sk1', d: '{br1} 갈래 스킬 +1', w: 'WJ', v: [1, 1], rare: 1 }, { k: 'sk2', d: '{br2} 갈래 스킬 +1', w: 'WJ', v: [1, 1], rare: 1 }, { k: 'mind', d: '최소 피해 +{}', w: 'W', v: [1, 3] },
];
const AFXK = Object.fromEntries(AFX.map(a => [a.k, a]));
// 이름난 장비 이름 = 앞말 + 부위 말
const NM1 = ['바람결', '늦가을', '들꽃', '소금빛', '새벽', '해질녘', '솜털', '풍차지기', '잿빛', '구름결', '빗방울', '서리', '종다리', '보릿고개', '물안개', '첫눈', '달무리', '갈대'];
const NM2 = { weapon: ['찌르개', '바늘', '가시', '꼬챙이'], weaponS: ['가지', '회초리', '부지깽이', '지휘봉'], off: ['울', '덮개', '방울', '등딱지'], helm: ['머리쓰개', '갓', '고깔'], armor: ['겉옷', '두루마기', '가죽옷'], inner: ['속옷', '내의'], cloak: ['날개', '두름', '자락'], gloves: ['손싸개', '토시'], belt: ['띠', '고리'], boots: ['발싸개', '걸음', '신'], amulet: ['매듭', '부적'], ear: ['방울', '고리'], ring: ['가락지', '고리'], sail: ['돛폭', '날개천'] };
// 전해진 장비(맛보기판 2종) · 한 벌(민들레 나그네 3종)
const UNIQ = [
  { id: 'u_late', n: '늦바람', base: 'spear1', story: '다리가 끊기던 날 섬 끝에 꽂혀 있던 창. 아직도 그날 바람이 남아 있다.', fx: [['dmgp', 30], ['kb', 100], ['windk', 3], ['agi', 3]], lv: 6 },
  { id: 'u_cloudfan', n: '작은 구름 부채', base: 'staff1', story: '솔바람이 어릴 적 쓰던 지팡이 끝에 구름 한 조각이 엉겨 붙었다.', fx: [['dmgp', 25], ['spi', 5], ['wreg', 40], ['sk1', 1]], lv: 6 },
  { id: 'u_millcap', n: '풍차지기 고깔', base: 'helm2', story: '바람이 멎은 뒤에도 하루도 빠짐없이 풍차를 닦던 사람의 모자.', fx: [['ac', 4], ['hp', 30], ['xp', 8], ['res', 10]], lv: 4 },
];
const SETS = { dandelion: { n: '민들레 나그네', parts: [['helm0', '나그네 두건'], ['cloak1', '나그네 망토'], ['boots0', '나그네 짚신']], bonus: [[2, [['move', 8], ['hp', 20]]], [3, [['xp', 10], ['windk', 2], ['find', 20]]]] } };

/* ---------- 강화 ---------- */
const SAFE = { weapon: 6, armor: 4 };
const ENCH_RATE = { weapon: { 7: .5, 8: .35, 9: .2, 10: .1 }, armor: { 5: .6, 6: .45, 7: .3, 8: .2, 9: .12, 10: .08 } };
const MAXENCH = 10;

/* ---------- 밑것들(몹) ---------- */
// sz: 작은/큰 (무기 피해 열 선택), spr: 아틀라스, ai: 행동
const MOBDEF = {
  fluff: { n: '보풀이', hp: [8, 4], dmg: [2, 4, .9], spd: 1.6, r: .3, sz: 0, xp: [6, 3], atk: 1, ai: 'melee', spr: 'fluff', desc: '바람을 먹고 부푼 솜털 뭉치. 떼로 몰려다녀요.' },
  seed: { n: '가시씨앗', hp: [14, 6], dmg: [3, 6, 1.3], spd: 1.15, r: .32, sz: 1, xp: [10, 4], atk: 1.2, ai: 'charge', spr: 'seed', desc: '가시 돋친 씨앗 꼬투리. 굴러서 들이받아요.' },
  bird: { n: '바람도둑', hp: [7, 3], dmg: [2, 4, .8], spd: 2.5, r: .28, sz: 0, xp: [7, 3], atk: .9, ai: 'dive', fly: 1, spr: 'bird', desc: '남의 바람을 훔쳐 나는 새. 맞으면 바람이 줄어요.' },
  fluffking: { n: '우두머리 보풀', hp: [520, 0], dmg: [8, 14, 0], spd: 1.1, r: .9, sz: 1, xp: [400, 0], atk: 2.2, ai: 'boss', boss: 1, spr: 'fluffking', desc: '들판의 바람을 혼자 다 먹어 치운 커다란 보풀이.' },
};
const ELITE = [['빠른', '#9fe4ff', { spd: 1.4 }], ['단단한', '#ffd27a', { hp: 2.2 }], ['바람 두른', '#c9a8ff', { kbimm: 1, hp: 1.5 }], ['성난', '#ff8f7a', { dmg: 1.5 }]];

/* ---------- 이야기·퀘스트 ---------- */
const NPCDEF = {
  chief: { n: '촌장 들메', row: 0 }, smith: { n: '대장장이 무쇠', row: 1 }, merchant: { n: '떠돌이 상인 얼레', row: 2 }, sage: { n: '이야기꾼 솔바람', row: 3 },
};
const QUESTS = {
  q1: { n: '끊어진 첫 다리', from: 'chief', goal: '다리 널빤지 6개를 모아 동쪽 끊어진 다리를 고치기', need: 6,
    talk: ['큰바람이 멎은 지 석 달째일세. 섬이 하루에 손톱만큼씩 가라앉고 있어.', '동쪽 다리가 끊어지면서 널빤지가 들판에 흩어졌는데, 밑것들이 그걸 물어다 둥지로 쓰고 있지 뭔가.', '널빤지 여섯 장만 찾아 주게. 이음꾼이라면 다리를 다시 놓을 수 있겠지.'],
    done: ['허허, 다리가 다시 이어졌구먼! 저 너머 바람개비 언덕까지 길이 열렸네.'] },
  q2: { n: '보풀이 소동', from: 'sage', goal: '들판의 보풀이 15마리 쓰러뜨리기', need: 15,
    talk: ['보풀이 본 적 있니? 바람이 없으니까 남은 바람을 먹으려고 구름 밑에서 올라온 녀석들이야.', '저 녀석들이 많아질수록 섬이 더 빨리 가라앉아. 열다섯 마리만 혼내 줄래?'],
    done: ['고마워. 바람이 조금 돌아온 게 느껴져. 이건 내가 끼던 반지야, 가져가.'] },
  q3: { n: '바람개비 언덕', from: 'chief', goal: '바람개비 언덕의 우두머리 보풀 쓰러뜨리기', need: 1,
    talk: ['언덕 꼭대기 바람개비가 멈춘 뒤로, 거기서 커다란 보풀이 바람을 다 빨아들이고 있다네.', '녀석을 쓰러뜨리고 바람개비 표지에 손을 얹어 주게. 섬에 숨이 조금은 돌아올 걸세.'],
    done: ['들리나? 바람개비가 돌아가는 소리… 석 달 만이야.', '허나 저 멀리 둥지섬 쪽 하늘이 심상치 않네. 큰 날개 그림자를 봤다는 사람이 있어.'] },
  q4: { n: '무쇠의 심부름', from: 'smith', goal: '바람 숫돌 3개 가져오기', need: 3,
    talk: ['강화하는 법 알려 줄까? 들판 밑것들이 가끔 바람 숫돌을 떨궈. 세 개만 갖다 줘.', '무기는 +6, 방어구는 +4까지는 절대 안 깨져. 그 위로는 운이지. 실패하면 한 단계 내려가고.'],
    done: ['좋아, 이건 수고비. 축복 받은 숫돌이야. 실패해도 그대로고 한 번에 두 단계 오를 때도 있지.'] },
};
const STORY_INTRO = ['큰바람이 멎었다.', '섬을 잇던 다리가 끊어지고, 섬들은 아주 조금씩 구름바다로 가라앉고 있다.', '헝겊 돛 하나에 몸을 맡기고 민들레 섬에 내려앉은 당신은 — 끊어진 길을 다시 잇는 이음꾼.'];
