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


/* =================== 세계: 섬·다리·소품 =================== */
// 바닥 칸: 0 하늘(빈칸) 1 풀 2 흙길 3 다리 4 끊어진 다리 5 돌바닥
const TW = 64, TH = 32; // 1배 화면에서 칸 마름모 크기
const iso = (x, y) => [(x - y) * TW / 2, (x + y) * TH / 2];
const unIso = (sx, sy) => [(sx / (TW / 2) + sy / (TH / 2)) / 2, (sy / (TH / 2) - sx / (TW / 2)) / 2];
function noise2(seed) { // 값 잡음(부드러운 0~1)
  const R = srand(seed), N = 64, g = new Float32Array(N * N); for (let i = 0; i < g.length; i++) g[i] = R();
  const at = (x, y) => g[((y % N + N) % N) * N + ((x % N + N) % N)], sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); return lerp(lerp(at(x0, y0), at(x0 + 1, y0), fx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx), fy); };
}
function makeWorld(seed) {
  const W = 100, H = 84, R = srand(seed), nz = noise2(seed + 7), nz2 = noise2(seed + 13);
  const g = new Uint8Array(W * H), isl = new Int16Array(W * H).fill(-1), depth = new Float32Array(W * H);
  const id = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const islands = [];
  function blob(cx, cy, r, kind) {
    const k = islands.length; islands.push({ cx, cy, r, kind, k });
    const ph = R() * 10;
    for (let y = Math.floor(cy - r * 1.4); y <= cy + r * 1.4; y++) for (let x = Math.floor(cx - r * 1.4); x <= cx + r * 1.4; x++) {
      if (!inb(x, y)) continue; const dx = x - cx, dy = y - cy, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
      const rr = r * (1 + .18 * Math.sin(a * 3 + ph) + .12 * Math.sin(a * 5 + ph * 2) + .22 * (nz(x * .15, y * .15) - .5));
      if (d < rr) { g[id(x, y)] = 1; isl[id(x, y)] = k; depth[id(x, y)] = 1 - d / rr; }
    }
    return k;
  }
  // 섬 배치(맛보기판): 마을 섬 → 들판 섬 4~5개 → (끊어진 다리) → 바람개비 언덕
  const town = blob(16, 42, 10.5, 'town');
  const F = [[34, 30, 8], [37, 54, 8.5], [53, 40, 9], [62, 22, 7.5], [66, 60, 7.5]].map(([x, y, r]) => [x + R() * 3 - 1.5, y + R() * 3 - 1.5, r + R() * 1.2]);
  const fi = F.map(([x, y, r]) => blob(x, y, r, 'field'));
  const hill = blob(86, 30, 8.5, 'hill');
  // 작은 떠돌이 바위섬(장식)
  for (let i = 0; i < 7; i++) { const x = 10 + R() * 80, y = 6 + R() * 74; let ok = true; for (const s of islands) if (Math.hypot(s.cx - x, s.cy - y) < s.r + 5) ok = false; if (ok) blob(x, y, 1.6 + R() * 1.4, 'rock'); }
  // 다리: 두 섬 사이를 x축 → y축 순서로 잇는 2칸 너비 길. 빈칸만 다리로 바꾼다.
  const bridges = [];
  function bridge(a, b, broken) {
    const A = islands[a], B = islands[b], cells = [];
    let x = Math.round(A.cx), y = Math.round(A.cy); const tx = Math.round(B.cx), ty = Math.round(B.cy);
    const put = (x, y) => { for (const [ox, oy] of [[0, 0], [0, 1], [1, 0]]) { const X = x + ox, Y = y + oy; if (inb(X, Y) && g[id(X, Y)] === 0) { g[id(X, Y)] = broken ? 4 : 3; cells.push(id(X, Y)); } } };
    const vert = Math.abs(ty - y) > Math.abs(tx - x);
    if (!vert) { while (x !== tx) { put(x, y); x += Math.sign(tx - x); } while (y !== ty) { put(x, y); y += Math.sign(ty - y); } }
    else { while (y !== ty) { put(x, y); y += Math.sign(ty - y); } while (x !== tx) { put(x, y); x += Math.sign(tx - x); } }
    bridges.push({ a, b, cells, broken: !!broken }); return bridges.length - 1;
  }
  bridge(town, fi[0]); bridge(town, fi[1]); bridge(fi[0], fi[2]); bridge(fi[1], fi[2]); bridge(fi[2], fi[3]); bridge(fi[2], fi[4]);
  const bq = bridge(fi[3], hill, true);
  // 길(흙): 마을 광장, 다리 입구 쪽 흙길
  const tI = islands[town];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = id(x, y); if (g[i] !== 1) continue;
    const dT = Math.hypot(x - tI.cx, y - tI.cy); if (isl[i] === town && dT < 3.2) g[i] = 5;
    else if (nz2(x * .22, y * .22) > .7 && isl[i] !== town) { let ok = 1; for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (!inb(xx, yy) || !g[id(xx, yy)]) ok = 0; if (ok) g[i] = 2; } }
  return { W, H, g, isl, depth, islands, bridges, bq, town, fi, hill, id, inb, nz, seed };
}
const walk = (Wd, x, y) => { const X = Math.floor(x), Y = Math.floor(y); if (!Wd.inb(X, Y)) return false; const t = Wd.g[Wd.id(X, Y)]; return t > 0 && t !== 4 && !Wd.block[Wd.id(X, Y)]; };
const ground = (Wd, x, y) => { const X = Math.floor(x), Y = Math.floor(y); if (!Wd.inb(X, Y)) return 0; const t = Wd.g[Wd.id(X, Y)]; return t > 0 && t !== 4 ? t : 0; };

// 소품 배치. 소품 = {k: 아틀라스 키, x, y, foot}
function placeProps(Wd, PM) {
  const R = srand(Wd.seed + 99), props = [], block = Wd.block = new Uint8Array(Wd.W * Wd.H);
  const free = (x, y, r) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) { if (!Wd.inb(xx, yy)) return false; const t = Wd.g[Wd.id(xx, yy)]; if (t !== 1 && t !== 2 || block[Wd.id(xx, yy)] === 2) return false; } return true; };
  const add = (k, x, y, solid) => { const m = PM[k]; if (!m) return; const foot = m[6] * (/^(home|tavern|market|smithy|windmill|ruin|grain)/.test(k) ? .62 : 1);
    props.push({ k, x, y, foot });
    if (solid !== false) for (let yy = Math.floor(y - foot); yy <= y + foot; yy++) for (let xx = Math.floor(x - foot); xx <= x + foot; xx++) if (Wd.inb(xx, yy) && Math.hypot(xx + .5 - x, yy + .5 - y) < foot + .35) block[Wd.id(xx, yy)] = 1;
    // 길 막지 않게 주변 1칸 예약
    for (let yy = Math.floor(y - foot - 1); yy <= y + foot + 1; yy++) for (let xx = Math.floor(x - foot - 1); xx <= x + foot + 1; xx++) if (Wd.inb(xx, yy) && !block[Wd.id(xx, yy)]) block[Wd.id(xx, yy)] = 2; };
  // 다리 입구 3칸은 비워 둔다
  for (const b of Wd.bridges) for (const c of b.cells) { const x = c % Wd.W, y = (c / Wd.W) | 0; for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (Wd.inb(xx, yy) && Wd.g[Wd.id(xx, yy)] && !block[Wd.id(xx, yy)]) block[Wd.id(xx, yy)] = 2; }
  const T = Wd.islands[Wd.town];
  // 마을: 집·풍차·대장간·시장·우물 (광장 둘레)
  const ring = [['windmill', -6, -5], ['home1', -6.5, 2.5], ['home2', -2.5, 6.5], ['smithy', 5.5, -5.5], ['market', 6.2, 3], ['tavern', -1, -7.5]];
  for (const [k, dx, dy] of ring) add(k, T.cx + dx, T.cy + dy);
  add('well', T.cx + 0.2, T.cy - 0.2);
  for (const [k, dx, dy] of [['barrel', 4, -3], ['crateB', 4.6, -2.2], ['sack', 3.6, 4.6], ['barrow', -4, 4.4], ['lumber', -4.4, -2.6], ['flag', 2.6, 2.4], ['crateS', 5.4, 1.3], ['bucket', 1.6, -1.6]]) add(k, T.cx + dx, T.cy + dy);
  Wd.npcAt = { chief: [T.cx - 1.6, T.cy + 1.8], smith: [T.cx + 3.6, T.cy - 3.6], merchant: [T.cx + 3.8, T.cy + 2.2], sage: [T.cx - 3.4, T.cy - 1.2] };
  Wd.wps = [{ n: '민들레 마을', x: T.cx + 1.6, y: T.cy + .2, on: 1 }];
  const Hh = Wd.islands[Wd.hill]; Wd.wps.push({ n: '바람개비 언덕', x: Hh.cx - 1, y: Hh.cy + 1.5, on: 0 });
  add('windmill', Hh.cx + 1.5, Hh.cy - 2.5); add('ruin', Hh.cx - 4, Hh.cy - 2.5); add('rock3', Hh.cx + 4, Hh.cy + 2);
  // 들판·언덕: 나무 무리·바위·통나무 더미
  const TREES = ['treesL', 'treesM', 'treesBL', 'treesBM', 'treesS', 'treesBS', 'tree1', 'tree2'], ROCK = ['rock1', 'rock2', 'rock3', 'rock4', 'rock5'];
  for (const s of Wd.islands) {
    if (s.kind === 'rock') { if (s.r > 2.2) add(ROCK[Math.floor(R() * 5)], s.cx, s.cy, true); continue; }
    if (s.kind === 'town') { for (let i = 0; i < 6; i++) { const a = R() * TAU, d = s.r * (.72 + R() * .2), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d, k = TREES[4 + Math.floor(R() * 4)], f = PM[k][6]; if (free(x, y, f)) add(k, x, y); } continue; }
    const n = s.kind === 'hill' ? 5 : 9;
    for (let i = 0; i < n * 3 && n > 0; i++) { const a = R() * TAU, d = s.r * (.35 + R() * .6), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d;
      const r = R(), k = r < .55 ? TREES[Math.floor(R() * TREES.length)] : r < .85 ? ROCK[Math.floor(R() * ROCK.length)] : ['lumber', 'stone', 'crateO', 'barrel'][Math.floor(R() * 4)]; const f = PM[k][6];
      if (free(x, y, f)) add(k, x, y); }
  }
  for (let i = 0; i < block.length; i++) if (block[i] === 2) block[i] = 0;
  return props;
}
// 다리 고치기: 끊어진 칸을 다리로
function repairBridge(Wd, bi) { const b = Wd.bridges[bi]; if (!b || !b.broken) return; b.broken = false; for (const c of b.cells) Wd.g[c] = 3; }

/* ---------- 바닥 그림(칸 단위로 미리 굽기) ---------- */
let TILES = null;
function bakeTiles(S) { // S = 화면 배율(1배 px → 캔버스 px)
  const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S); const g = c.getContext('2d'); g.scale(S, S); f(g); return c; };
  const dia = g => { g.beginPath(); g.moveTo(TW / 2, -.6); g.lineTo(TW + .8, TH / 2); g.lineTo(TW / 2, TH + .6); g.lineTo(-.8, TH / 2); g.closePath(); };
  const R = srand(5), out = { grass: [], dirt: [], path: [], plaza: [], bridge: [], broken: [], faceL: [], faceR: [], tuft: [], flower: [] };
  const GR = ['#80b95b', '#83bc5d', '#86bf5f', '#89c261', '#8cc563', '#8fc865'];
  for (const base of GR) for (let v = 0; v < 2; v++) out.grass.push(mk(TW, TH, g => { dia(g); g.fillStyle = base; g.fill(); g.save(); dia(g); g.clip();
    for (let i = 0; i < 26; i++) { g.fillStyle = R() < .5 ? 'rgba(255,255,220,.07)' : 'rgba(30,70,20,.07)'; g.beginPath(); g.ellipse(R() * TW, R() * TH, 2 + R() * 5, 1 + R() * 2.5, 0, 0, TAU); g.fill(); } g.restore(); }));
  // 흙길: 가장자리가 부드러운 얼룩(이웃 칸으로 번짐) → 네모난 칸 느낌 없앰
  for (let v = 0; v < 3; v++) out.dirt.push(mk(TW * 1.6, TH * 1.6, g => { const cx = TW * .8, cy = TH * .8; g.save(); g.translate(cx, cy); g.scale(1, .5); const gr = g.createRadialGradient(0, 0, 4, 0, 0, TW * .78); const c = ['201,168,115', '194,160,107', '207,174,121'][v]; gr.addColorStop(0, `rgba(${c},1)`); gr.addColorStop(.62, `rgba(${c},.95)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, TW * .78, 0, TAU); g.fill(); g.restore();
    for (let i = 0; i < 10; i++) { g.fillStyle = R() < .5 ? 'rgba(255,240,200,.3)' : 'rgba(90,60,30,.2)'; g.beginPath(); g.ellipse(cx + (R() - .5) * TW * .9, cy + (R() - .5) * TH * .9, 1 + R() * 2.5, .8 + R() * 1.2, 0, 0, TAU); g.fill(); } }));
  for (let v = 0; v < 3; v++) out.path.push(mk(TW, TH, g => { dia(g); g.fillStyle = ['#c9a873', '#c2a06b', '#cfae79'][v]; g.fill(); g.save(); dia(g); g.clip();
    for (let i = 0; i < 18; i++) { g.fillStyle = R() < .5 ? 'rgba(255,240,200,.25)' : 'rgba(90,60,30,.18)'; g.beginPath(); g.ellipse(R() * TW, R() * TH, 1 + R() * 3, .8 + R() * 1.4, 0, 0, TAU); g.fill(); } g.restore(); }));
  for (let v = 0; v < 3; v++) out.plaza.push(mk(TW, TH, g => { dia(g); g.fillStyle = '#b9b4a8'; g.fill(); g.save(); dia(g); g.clip(); g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = 1;
    for (let i = -2; i < 4; i++) { const [ax, ay] = iso(i / 2, 0), [bx, by] = iso(i / 2, 1); g.beginPath(); g.moveTo(ax + TW / 2, ay); g.lineTo(bx + TW / 2, by); g.stroke(); const [cx, cy] = iso(0, i / 2), [dx, dy] = iso(1, i / 2); g.beginPath(); g.moveTo(cx + TW / 2, cy); g.lineTo(dx + TW / 2, dy); g.stroke(); }
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(${R() < .5 ? '255,255,240,.18' : '60,50,40,.12'})`; g.fillRect(R() * TW, R() * TH, 4, 2); } g.restore(); }));
  // 다리: 널빤지(두 방향)
  for (const dir of [0, 1]) for (const br of [0, 1]) (br ? out.broken : out.bridge).push(mk(TW, TH + 12, g => {
    const P = (u, v) => { const [x, y] = iso(dir ? v : u, dir ? u : v); return [x + TW / 2, y]; };
    for (let i = 0; i < 4; i++) { if (br && (i === 1 || i === 2)) continue; const u0 = i / 4 + .02, u1 = (i + 1) / 4 - .02;
      const q = [P(u0, 0), P(u1, 0), P(u1, 1), P(u0, 1)]; g.beginPath(); g.moveTo(...q[0]); for (const p of q.slice(1)) g.lineTo(...p); g.closePath(); g.fillStyle = ['#a87b4f', '#9c7046', '#b08455', '#a0744a'][i]; g.fill(); g.strokeStyle = '#5a3a20'; g.lineWidth = .8; g.stroke();
      g.beginPath(); g.moveTo(q[2][0], q[2][1]); g.lineTo(q[2][0], q[2][1] + 4); g.lineTo(q[3][0], q[3][1] + 4); g.lineTo(q[3][0], q[3][1]); g.fillStyle = '#6a4628'; g.fill(); }
    g.strokeStyle = '#7a5532'; g.lineWidth = 1.6; for (const v of [.06, .94]) { const a = P(0, v), b = P(1, v); g.beginPath(); g.moveTo(a[0], a[1] + 2); g.lineTo(b[0], b[1] + 2); g.stroke(); }
  }));
  // 낭떠러지 면: 높이 단계별(흙·돌 줄무늬 + 매달린 뿌리)
  for (const h of [26, 38, 52, 68, 86]) for (const side of [0, 1]) (side ? out.faceR : out.faceL).push(mk(TW / 2 + 2, TH / 2 + h + 6, g => {
    // 면 = 마름모 아래 변에서 아래로 늘어진 평행사변형. 오른쪽 면(side 1): 아래 꼭짓점(0,16)→오른 꼭짓점(32,0), 왼쪽 면: 왼 꼭짓점(0,0)→아래(32,16)
    const top = [[0, side ? TH / 2 : 0], [TW / 2, side ? 0 : TH / 2]];
    const bot = top.map(([x, y]) => [x, y + h]);
    const gr = g.createLinearGradient(0, 0, 0, h + TH / 2); gr.addColorStop(0, '#6a4a2e'); gr.addColorStop(.18, side ? '#7d5a38' : '#8e6a44'); gr.addColorStop(.6, side ? '#5c4630' : '#6e5438'); gr.addColorStop(1, side ? '#3e3226' : '#4a3c2c');
    g.beginPath(); g.moveTo(...top[0]); g.lineTo(...top[1]); g.lineTo(...bot[1]); g.lineTo(...bot[0]); g.closePath(); g.fillStyle = gr; g.fill();
    g.save(); g.clip(); // 지층: 칸마다 같은 높이 → 이웃 칸과 이어져 보임
    for (const [yy, a, w] of [[9, .16, 2], [17, .1, 1.2], [27, .18, 2.5], [39, .12, 1.5], [52, .16, 2], [66, .12, 1.4], [80, .14, 2]]) { if (yy > h + 4) break; g.strokeStyle = `rgba(40,25,10,${a})`; g.lineWidth = w; g.beginPath(); g.moveTo(-1, yy + top[0][1]); g.lineTo(TW / 2 + 2, yy + top[1][1]); g.stroke(); g.strokeStyle = `rgba(255,230,190,${a * .5})`; g.lineWidth = 1; g.beginPath(); g.moveTo(-1, yy + top[0][1] + w); g.lineTo(TW / 2 + 2, yy + top[1][1] + w); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(150,140,130,.4)'; g.beginPath(); const x2 = R() * TW / 2, t2 = x2 / (TW / 2); g.ellipse(x2, lerp(top[0][1], top[1][1], t2) + 12 + R() * h * .75, 2 + R() * 3, 1.5 + R() * 2, 0, 0, TAU); g.fill(); } g.restore();
    g.strokeStyle = '#4a6a2a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(...top[0]); g.lineTo(...top[1]); g.stroke(); // 풀 끝선
    g.strokeStyle = 'rgba(90,110,50,.75)'; g.lineWidth = 1.2; for (let i = 0; i < (R() < .5 ? 1 : 0); i++) { const x = 4 + R() * (TW / 2 - 8), y = side ? TH / 2 - x / 2 : x / 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3, y + h * .5, x - 2, y + h * (.6 + R() * .5)); g.stroke(); }
  }));
  // 풀 포기·민들레
  for (let v = 0; v < 4; v++) out.tuft.push(mk(16, 12, g => { g.strokeStyle = ['#5a9a3a', '#6aaa44', '#4f8a34', '#76b84c'][v]; g.lineWidth = 1.3; g.lineCap = 'round'; for (let i = 0; i < 6; i++) { const x = 3 + R() * 10; g.beginPath(); g.moveTo(x, 12); g.quadraticCurveTo(x + R() * 4 - 2, 6, x + R() * 6 - 3, 1 + R() * 4); g.stroke(); } }));
  for (let v = 0; v < 3; v++) out.flower.push(mk(14, 14, g => { g.strokeStyle = '#5a9a3a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(7, 14); g.lineTo(7, 6); g.stroke();
    if (v === 2) { g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.arc(7 + Math.cos(a) * 3.2, 5 + Math.sin(a) * 3.2, .9, 0, TAU); g.fill(); } }
    else { g.fillStyle = v ? '#ffd23a' : '#f6c02a'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.ellipse(7 + Math.cos(a) * 2.4, 5 + Math.sin(a) * 2.4, 1.6, 1, a, 0, TAU); g.fill(); } g.fillStyle = '#e09a1a'; g.beginPath(); g.arc(7, 5, 1.4, 0, TAU); g.fill(); } }));
  out.S = S; return out;
}


/* =================== 장비·물건 =================== */
let UID = 1;
const TAME_N = 150; // 길들이기: 끼고 쓰러뜨린 수
const ADJ = { dmgp: '날 선', ac: '단단한', aspd: '가벼운', hp: '질긴', wind: '바람 먹은', wreg: '맑은', crit: '날카로운', move: '날랜', thorn: '따끔한', kb: '묵직한', str: '굳센', agi: '재빠른', vit: '끈질긴', spi: '숨 깊은', res: '든든한', lifek: '기운 나는', windk: '바람 머금은', blk: '야무진', xp: '배우는', find: '눈 밝은', sk0: '갈래 품은', sk1: '갈래 품은', sk2: '갈래 품은', mind: '고른' };
const encKind = b => b.s === 'weapon' ? 'weapon' : (b.noench ? null : 'armor');
const afxSlot = b => b.s === 'weapon' ? 'W' : ['amulet', 'ear', 'ring'].includes(b.s) ? 'J' : 'A';
function goods(g, n) { return { uid: UID++, g, n: n || 1 }; }
function rollAfx(b, ilv, n, have) {
  const out = [], ws = afxSlot(b), used = new Set((have || []).map(a => a[0]));
  const pool = AFX.filter(a => (a.w === 'a' || a.w.includes(ws)) && !used.has(a.k));
  for (let i = 0; i < n && pool.length; i++) {
    let a; do { a = pool[Math.floor(Math.random() * pool.length)]; } while (a.rare && Math.random() < .7 && pool.length > 3);
    pool.splice(pool.indexOf(a), 1);
    const f = clamp(.35 + ilv / 14, .35, 1.2), v = Math.max(1, Math.round(rnd(a.v[0], a.v[1]) * (a.v[0] === a.v[1] ? 1 : f)));
    out.push([a.k, v]);
  }
  return out;
}
function makeItem(bid, rar, ilv, o) {
  o = o || {}; const b = BASE[bid], it = { uid: UID++, b: bid, r: rar, ilv, en: 0, st: 0, id: rar < 2, af: [], tame: 0 };
  if (rar === 1 || rar === 2) { const [a, c] = RAR[rar].k; it.af = rollAfx(b, ilv, ri(a, c)); it.hid = rollAfx(b, ilv, 1, it.af)[0] || null; }
  if (rar === 2) it.nm = pick(NM1) + ' ' + pick(b.s === 'weapon' && b.cls === 'windcaller' ? NM2.weaponS : NM2[b.s] || ['물건']);
  if (o.u) { const U = UNIQ.find(u => u.id === o.u); it.u = o.u; it.af = U.fx.map(x => x.slice()); it.id = false; }
  if (o.set) { it.set = o.set; it.af = []; it.id = false; }
  if (b.s !== 'ring' && b.s !== 'amulet' && b.s !== 'ear' && !o.u && !o.set) { const r = Math.random(); it.st = r < .06 ? 1 : r < .1 ? -1 : 0; }
  if (o.st != null) it.st = o.st;
  if (o.id) it.id = true;
  return it;
}
// 드롭할 장비 고르기: 레벨에 맞는 기본 장비 중 하나 + 등급
function rollDrop(ilv, find, cls) {
  const ok = BASES.filter(b => b.lv <= ilv + 1 && (!b.cls || b.cls === cls || Math.random() < .35));
  const b = pick(ok); const r = Math.random() / (1 + find / 100);
  const rar = r < .045 ? 2 : r < .3 ? 1 : 0;
  if (Math.random() < .02 * (1 + find / 100) && ilv >= 3) { const sp = pick(SETS.dandelion.parts); return makeItem(sp[0], 4, Math.max(3, ilv), { set: 'dandelion' }); }
  return makeItem(b.id, rar, ilv);
}
function itemName(it) {
  if (it.g) return GOODS[it.g].n + (it.n > 1 ? ' ×' + it.n : '');
  const b = BASE[it.b]; let n;
  if (!it.id) return '감정 안 된 ' + b.n;
  if (it.u) n = UNIQ.find(u => u.id === it.u).n;
  else if (it.set) n = SETS[it.set].parts.find(p => p[0] === it.b)[1];
  else if (it.r === 2) n = it.nm;
  else if (it.r === 1 && it.af.length) n = ADJ[it.af[0][0]] + ' ' + b.n;
  else n = b.n;
  return (it.st === 1 ? '축복 받은 ' : it.st === -1 ? '저주받은 ' : '') + (it.en ? '+' + it.en + ' ' : '') + n;
}
const itemColor = it => it.g ? (GOODS[it.g].quest ? '#ffe08a' : '#e7e2d4') : RAR[it.r].c;
function afxText(k, v, cls) { const a = AFXK[k]; let t = a.d.replace('{}', v); const br = BRANCH[cls] || BRANCH.warden; return t.replace('{br0}', br[0]).replace('{br1}', br[1]).replace('{br2}', br[2]); }
// 장비 하나가 주는 수치 합
function itemMods(it, out) {
  const b = BASE[it.b], add = (k, v) => { out[k] = (out[k] || 0) + v; };
  const bl = it.st || 0;
  if (b.dmg) { const e = it.en + bl; out.dmg = b.dmg.map(v => Math.max(1, v + e)); out.wspd = b.spd || 1; }
  if (b.ac != null) add('ac', b.ac + (b.s !== 'weapon' && !b.noench ? it.en + bl : 0));
  if (b.blk) add('blk', b.blk);
  if (b.sail) out.sail = b.sail.slice();
  for (const k in b.fix || {}) add(k, b.fix[k]);
  if (it.id) { for (const [k, v] of it.af) add(k, v); if (it.hid && it.tame >= TAME_N) add(it.hid[0], it.hid[1]); }
  return out;
}
function priceOf(it) { if (it.g) return Math.round((GOODS[it.g].price || 8) * .4) * it.n; const b = BASE[it.b]; return Math.round((6 + b.lv * 4 + it.en * 10) * [1, 2, 4, 8, 6][it.r] * (it.id ? 1 : .6)); }
function canWear(P, it) { const b = BASE[it.b]; if (it.g) return '장비가 아니에요'; if (b.cls && b.cls !== P.cls) return CLASSES[b.cls].name + ' 전용'; if (P.lv < b.lv) return b.lv + '레벨부터';
  for (const k in b.req || {}) if (P.st[k] < b.req[k]) return STATS.find(s => s[0] === k)[1] + ' ' + b.req[k] + ' 필요'; return ''; }
// 강화: mat = 'hone'|'glue'|'bhone'|'bglue' → {ok, msg}
function enchant(it, mat) {
  const b = BASE[it.b], kind = encKind(b), blessedMat = mat[0] === 'b';
  if (!kind) return { ok: 0, msg: '장신구는 강화할 수 없어요' };
  if ((kind === 'weapon') !== (mat === 'hone' || mat === 'bhone')) return { ok: 0, msg: kind === 'weapon' ? '무기는 숫돌로 강화해요' : '방어구는 아교로 강화해요' };
  if (it.en >= MAXENCH) return { ok: 0, msg: '+10이 끝이에요' };
  if (!it.id) return { ok: 0, msg: '먼저 감정해야 해요' };
  const next = it.en + 1, safe = next <= SAFE[kind], rate = safe ? 1 : ENCH_RATE[kind][next] || .05;
  if (blessedMat) { if (safe || Math.random() < Math.max(rate, .5)) { const up = (Math.random() < .35 && next < MAXENCH) ? 2 : 1; it.en += up; return { ok: 1, up, msg: '+' + it.en + ' 성공!' + (up > 1 ? ' 두 단계!' : '') }; } return { ok: 2, msg: '실패했지만 축복 덕분에 그대로예요' }; }
  if (Math.random() < rate) { it.en = next; return { ok: 1, up: 1, msg: '+' + it.en + ' 성공!' }; }
  if (it.st === 1) { it.st = 0; return { ok: 2, msg: '실패! 축복이 대신 사라졌어요(단계 유지)' }; }
  it.en = Math.max(0, it.en - 1); return { ok: 3, msg: '실패… +' + it.en + '(으)로 내려갔어요' };
}
function reroll(it) { const b = BASE[it.b]; if (!(it.r === 1 || it.r === 2) || !it.af.length) return false; const i = Math.floor(Math.random() * it.af.length); const rest = it.af.filter((_, j) => j !== i); const n = rollAfx(b, it.ilv, 1, rest.concat([it.af[i]]))[0]; if (!n) return false; it.af[i] = n; return i; }

/* ---------- 캐릭터 수치 ---------- */
function setCount(P) { const c = {}; for (const s in P.eq) { const it = P.eq[s]; if (it && it.set && it.id) c[it.set] = (c[it.set] || 0) + 1; } return c; }
function calc(P) {
  const C = CLASSES[P.cls], m = { ac: 0 };
  for (const s in P.eq) if (P.eq[s]) itemMods(P.eq[s], m);
  const sc = setCount(P); for (const k in sc) for (const [n, fx] of SETS[k].bonus) if (sc[k] >= n) for (const [a, v] of fx) m[a] = (m[a] || 0) + v;
  const st = {}; for (const [k] of STATS) st[k] = C.stat[k] + (P.sp[k] || 0) + (m[k] || 0);
  const S = P.st = st;
  P.mhp = Math.round(30 + S.vit * 4 + P.lv * 6 + (m.hp || 0));
  P.mwind = Math.round(18 + S.spi * 2 + P.lv * 2 + (m.wind || 0));
  P.ac = (m.ac || 0) + Math.floor(S.agi / 5) + (P.buf.shout ? 6 : 0);
  P.dmg = m.dmg || [1, 2, 1, 3]; if (m.mind) { P.dmg = P.dmg.slice(); P.dmg[0] += m.mind; P.dmg[2] += m.mind; }
  P.dmgp = (m.dmgp || 0) + (C.melee ? S.str : S.spi) + (P.buf.brave ? 25 : 0);
  P.aspd = C.aspd * (m.wspd || 1) * (1 + ((m.aspd || 0) + S.agi * .6) / 100);
  P.crit = 3 + S.agi * .25 + (m.crit || 0);
  P.move = 3.6 * (1 + ((m.move || 0) + Math.min(10, S.agi * .2)) / 100);
  P.wreg = (.9 + S.spi * .06) * (1 + (m.wreg || 0) / 100);
  P.blk = P.cls === 'warden' ? (m.blk || 0) + S.agi * .1 : (m.blk || 0);
  P.res = m.res || 0; P.thorn = m.thorn || 0; P.kbm = 1 + (m.kb || 0) / 100; P.lifek = m.lifek || 0; P.windk = m.windk || 0; P.xpm = 1 + (m.xp || 0) / 100; P.find = m.find || 0;
  P.skb = [m.sk0 || 0, m.sk1 || 0, m.sk2 || 0];
  P.sail = m.sail || [2.4, 1.6];
  P.hp = Math.min(P.hp == null ? P.mhp : P.hp, P.mhp); P.wind = Math.min(P.wind == null ? P.mwind : P.wind, P.mwind);
}
const xpNeed = L => Math.round(40 * Math.pow(L, 1.45));
function skLv(P, s) { const base = P.sk[s.id] || 0; return base ? base + P.skb[s.br] : 0; }
function synergy(P, s) { let n = 0; for (const o of SKILLS[P.cls]) if (o.br === s.br && o.id !== s.id) n += P.sk[o.id] || 0; return 1 + n * .06; }


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


/* =================== 그리기 =================== */
let ov, cv, x, lay = { Z: 1, dpr: 1, cw: 800, ch: 450 }, IM = {}, NPCK = [];
const HC = [112, 120, 56, 100], HF = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'atk0', 'atk1', 'atk2', 'atk3', 'cast0', 'cast1', 'cast2', 'hurt', 'dodge', 'die0', 'die1'];
const MC = { fluff: [96, 96, 48, 84], fluffking: [224, 224, 112, 200], seed: [96, 104, 48, 92], bird: [104, 132, 52, 120] };
function loadImg(k, src) { return new Promise(ok => { const im = new Image(); im.onload = () => { IM[k] = im; ok(); }; im.onerror = () => ok(); im.src = src; }); }
let assetsP = null;
function assets() {
  if (assetsP) return assetsP; const v = '?v=1';
  assetsP = Promise.all([...['warden', 'windcaller', 'fluff', 'fluffking', 'seed', 'bird', 'npc', 'props', 'icons'].map(k => loadImg(k, IMG + k + '.webp' + v)),
    fetch(IMG + 'props.json' + v).then(r => r.json()).then(j => { PM = j; }), fetch(IMG + 'npc.json' + v).then(r => r.json()).then(j => { NPCK = j; }), fetch(IMG + 'icons.json' + v).then(r => r.json()).then(j => { ICM = j; }).catch(() => {})]);
  return assetsP;
}
let ICM = {}; const DIRT = [];
function sprite(im, cw, ch, ax, ay, fr, row, X, Y, sc, flash, alpha) {
  if (!im) return; const w = cw * sc, h = ch * sc; if (alpha != null) x.globalAlpha = alpha;
  x.drawImage(im, fr * cw, row * ch, cw, ch, X - ax * sc, Y - ay * sc, w, h);
  if (flash) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.min(1, flash * 6) * .7; x.drawImage(im, fr * cw, row * ch, cw, ch, X - ax * sc, Y - ay * sc, w, h); x.globalCompositeOperation = 'source-over'; }
  x.globalAlpha = 1;
}
function heroFrame(P) {
  const a = P.an, t = P.at;
  if (a === 'run') return 2 + Math.floor((P.runT || 0) * 10) % 6;
  if (a === 'atk') return 8 + Math.min(3, Math.floor(t / (P.atkDur || .35) * 4));
  if (a === 'cast') return 12 + Math.min(2, Math.floor(t / (P.atkDur || .35) * 3));
  if (a === 'dodge') return 16; if (a === 'die') return t > .35 ? 18 : 17; if (P.hurt > .12) return 15;
  return Math.floor(G.t / .6) % 2;
}
function mobFrame(m) {
  const a = m.an, t = m.at;
  if (a === 'move') return 2 + Math.floor(t * (m.D.fly ? 8 : 6)) % 4;
  if (a === 'atk') { const w = m.D.boss ? .8 : .35; return 6 + Math.min(2, Math.floor(t / (w + .3) * 3)); }
  if (a === 'hurt') return 9; if (a === 'die') return t > .25 ? 11 : 10;
  return m.D.fly ? 2 + Math.floor(t * 8) % 4 : Math.floor(t / .5) % 2;
}
// 바닥 칸 해시(장식 위치 고정)
const hsh = (a, b) => { let h = a * 374761393 + b * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function drawSky(cw, ch) {
  const g = x.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, '#7fb8e8'); g.addColorStop(.55, '#b9dcf2'); g.addColorStop(1, '#e8f2f6'); x.fillStyle = g; x.fillRect(0, 0, cw, ch);
  // 구름바다: 화면 기준 느린 시차
  const [cx, cy] = G ? iso(G.cam[0], G.cam[1]) : [0, 0], px = -cx * .25 + (G ? G.t : performance.now() / 1000) * 6, py = -cy * .25;
  x.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 14; i++) { const bx = ((hsh(i, 1) * 2400 + px) % 2400 + 2400) % 2400 - 400, by = ((hsh(i, 2) * 1400 + py) % 1400 + 1400) % 1400 - 200, r = 60 + hsh(i, 3) * 120;
    x.beginPath(); x.ellipse(bx * cw / 1600, by * ch / 900, r * 1.8, r * .55, 0, 0, TAU); x.fill(); }
}
function view() { const { Z, cw, ch } = lay, [cx, cy] = iso(G.cam[0], G.cam[1]), sh = G.shake; return { ox: cw / 2 - cx * Z + (sh ? rnd(-sh, sh) : 0), oy: ch / 2 - cy * Z + (sh ? rnd(-sh, sh) : 0) - 30 * Z, Z }; }
function draw() {
  const { cw, ch, dpr } = lay; x.setTransform(dpr, 0, 0, dpr, 0, 0); drawSky(cw, ch);
  if (!G) return; const Wd = G.Wd, P = G.P, V = view(), Z = V.Z;
  x.setTransform(dpr * Z, 0, 0, dpr * Z, dpr * V.ox, dpr * V.oy);
  // 화면에 보이는 칸 범위
  const corners = [[0, 0], [cw, 0], [0, ch + 200], [cw, ch + 200]].map(([sx, sy]) => unIso((sx - V.ox) / Z, (sy - V.oy) / Z));
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 1), x1 = Math.min(Wd.W - 1, Math.ceil(Math.max(...corners.map(c => c[0]))) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 1), y1 = Math.min(Wd.H - 1, Math.ceil(Math.max(...corners.map(c => c[1]))) + 1);
  // 구름 소품(섬 아래, 시차)
  const T = TILES;
  for (let s = x0 + y0; s <= x1 + y1; s++) for (let yy = Math.max(y0, s - x1); yy <= Math.min(y1, s - x0); yy++) {
    const xx = s - yy, i = Wd.id(xx, yy), t = Wd.g[i]; if (!t) continue; const [sx, sy] = iso(xx, yy), h = hsh(xx, yy);
    if (t === 3 || t === 4) { const vert = (Wd.g[Wd.id(xx, yy - 1)] >= 3 || Wd.g[Wd.id(xx, yy + 1)] >= 3) && !(Wd.g[Wd.id(xx - 1, yy)] >= 3 || Wd.g[Wd.id(xx + 1, yy)] >= 3); const im = (t === 3 ? T.bridge : T.broken)[vert ? 1 : 0]; x.drawImage(im, sx - TW / 2, sy, TW, TH + 12); continue; }
    // 낭떠러지 면
    const isl = Wd.islands[Wd.isl[i]] || { r: 3 }, hb = clamp(Math.floor(isl.r / 3.2 + Wd.nz(xx * .3, yy * .3) * 1.6), 0, 4);
    if (!Wd.g[Wd.id(xx + 1, yy)] || xx + 1 >= Wd.W) x.drawImage(T.faceR[hb], sx, sy + TH / 2, TW / 2 + 2, TH / 2 + [26, 38, 52, 68, 86][hb] + 6);
    if (!Wd.g[Wd.id(xx, yy + 1)] || yy + 1 >= Wd.H) x.drawImage(T.faceL[hb], sx - TW / 2, sy + TH / 2, TW / 2 + 2, TH / 2 + [26, 38, 52, 68, 86][hb] + 6);
    let im; if (t === 2) { const c = Wd.nz(xx * .18 + 3, yy * .18) * 6; x.drawImage(T.grass[clamp(Math.floor(c), 0, 5) * 2], sx - TW / 2, sy, TW, TH); DIRT.push([sx, sy, Math.floor(h * 3)]); continue; } else if (t === 5) im = T.plaza[Math.floor(h * 3)]; else { const c = Wd.nz(xx * .18 + 3, yy * .18) * 6; im = T.grass[clamp(Math.floor(c), 0, 5) * 2 + (h > .5 ? 1 : 0)]; }
    x.drawImage(im, sx - TW / 2, sy, TW, TH);
    if (t === 1) { if (h < .22) x.drawImage(T.tuft[Math.floor(h * 18) % 4], sx - 8 + (hsh(yy, xx) - .5) * 30, sy + 8 + hsh(xx + 7, yy) * 12, 16, 12); else if (h > .93 && Wd.isl[i] !== Wd.town) x.drawImage(T.flower[Math.floor(h * 100) % 3], sx - 7 + (hsh(yy, xx) - .5) * 26, sy + 6 + hsh(xx + 3, yy) * 12, 14, 14); }
  }
  for (const [dx, dy, v] of DIRT) x.drawImage(T.dirt[v], dx - TW * .8, dy + TH / 2 - TH * .8, TW * 1.6, TH * 1.6); DIRT.length = 0;
  // 바닥 효과(안개·깃발 범위·경고)
  for (const a of G.areas) {
    if (a.k === 'mist') { const [ax, ay] = iso(a.x, a.y), al = Math.min(1, a.t * 3, (a.life - a.t) * 2); x.fillStyle = `rgba(235,242,250,${.45 * al})`; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(ax + Math.sin(G.t + k) * 10, ay + Math.cos(G.t * .7 + k) * 5, a.r * TW / 2 * (.7 + k * .08), a.r * TH / 2 * (.7 + k * .08), 0, 0, TAU); x.fill(); } }
    if (a.k === 'flag') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = 'rgba(160,220,255,.6)'; x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41, a.r * TH / 2 * 1.41, 0, 0, TAU); x.stroke(); x.setLineDash([]); }
    if (a.k === 'warn') { const [ax, ay] = iso(a.x, a.y), k = a.t / a.life; x.fillStyle = `rgba(255,90,70,${.15 + k * .25})`; x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41 * k, a.r * TH / 2 * 1.41 * k, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,120,90,.8)'; x.lineWidth = 2; x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41, a.r * TH / 2 * 1.41, 0, 0, TAU); x.stroke(); }
  }
  for (const w of Wd.wps) { const [ax, ay] = iso(w.x, w.y); x.fillStyle = w.on ? 'rgba(160,230,255,.35)' : 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(ax, ay, 26, 13, 0, 0, TAU); x.fill(); x.strokeStyle = w.on ? '#9fe4ff' : '#d8d2c4'; x.lineWidth = 2; x.beginPath(); x.ellipse(ax, ay, 26 + (w.on ? Math.sin(G.t * 3) * 2 : 0), 13, 0, 0, TAU); x.stroke(); }
  // 정렬해서 그리기
  const L = [], vis = (ex, ey) => ex >= x0 - 3 && ex <= x1 + 3 && ey >= y0 - 3 && ey <= y1 + 3;
  for (const p of Wd.props) if (vis(p.x, p.y)) L.push([p.x + p.y, 0, p]);
  for (const m of G.mobs) if (vis(m.x, m.y)) L.push([m.x + m.y, 1, m]);
  for (const k in Wd.npcAt) { const [nx, ny] = Wd.npcAt[k]; if (vis(nx, ny)) L.push([nx + ny, 2, k]); }
  for (const d of G.drops) if (vis(d.x, d.y)) L.push([d.x + d.y - .3, 3, d]);
  for (const w of Wd.wps) L.push([w.x + w.y, 5, w]);
  L.push([P.x + P.y, 4, P]); L.sort((a, b) => a[0] - b[0]);
  const hs = .5; // 2배 아틀라스 → 1배
  for (const [, k, o] of L) {
    if (k === 0) { const m = PM[o.k]; if (!m) continue; const [sx, sy] = iso(o.x, o.y); const fade = hyp(o.x - P.x, o.y - P.y) < 2.6 && o.x + o.y > P.x + P.y && m[3] > 220 ? .55 : 1; x.globalAlpha = fade; x.drawImage(IM.props, m[0], m[1], m[2], m[3], sx - m[4] * hs, sy - m[5] * hs, m[2] * hs, m[3] * hs); x.globalAlpha = 1; }
    else if (k === 1) drawMob(o);
    else if (k === 2) { const [sx, sy] = iso(G.Wd.npcAt[o][0], G.Wd.npcAt[o][1]); shadow(sx, sy, 12); sprite(IM.npc, HC[0], HC[1], HC[2], HC[3], Math.floor(G.t / .7 + o.length) % 2, NPCK.indexOf(o), sx, sy, hs); const Q = questMark(o); if (Q) { x.font = 'bold 15px system-ui'; x.textAlign = 'center'; x.fillStyle = Q === '?' ? '#ffd166' : '#fff'; x.strokeStyle = '#3a2a10'; x.lineWidth = 3; x.strokeText(Q, sx, sy - 54 + Math.sin(G.t * 4) * 2); x.fillText(Q, sx, sy - 54 + Math.sin(G.t * 4) * 2); } }
    else if (k === 3) drawDrop(o);
    else if (k === 4) drawHero(o);
    else if (k === 5) { const [sx, sy] = iso(o.x, o.y); drawVane(sx, sy, o.on); }
  }
  // 투사체·효과
  for (const p of G.proj) drawProj(p); for (const f of G.fx) drawFx(f);
  for (const a of G.areas) if (a.k === 'flag') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax, ay - 46); x.stroke(); x.fillStyle = a.fk === 0 ? '#9fe4ff' : '#b6f0a0'; x.beginPath(); x.moveTo(ax, ay - 46); x.quadraticCurveTo(ax + 14, ay - 46 + Math.sin(G.t * 6) * 3, ax + 26, ay - 40); x.lineTo(ax, ay - 32); x.fill(); }
  // 이름표
  x.textAlign = 'center';
  for (const d of G.drops) { if (!vis(d.x, d.y) || d.gold) continue; const [sx, sy] = iso(d.x, d.y), it = d.it; x.font = '600 10px system-ui'; const s = itemName(it), w = x.measureText(s).width + 8; x.fillStyle = 'rgba(20,16,10,.72)'; rr(sx - w / 2, sy - 24, w, 14, 4); x.fill(); x.fillStyle = itemColor(it); x.fillText(s, sx, sy - 13.5); }
  for (const t of G.txt) { const [sx, sy] = iso(t.x, t.y), a = 1 - t.t; x.globalAlpha = a; x.font = (t.big ? '800 17px ' : t.small ? '700 10px ' : '800 13px ') + 'system-ui'; x.lineWidth = 3; x.strokeStyle = 'rgba(30,20,10,.8)'; const yy = sy - 40 - t.z * 10 - t.t * 26; x.strokeText(t.s, sx, yy); x.fillStyle = t.c; x.fillText(t.s, sx, yy); x.globalAlpha = 1; }
  x.setTransform(dpr, 0, 0, dpr, 0, 0); hud();
}
function rr(X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function shadow(sx, sy, r) { x.fillStyle = 'rgba(30,40,20,.28)'; x.beginPath(); x.ellipse(sx, sy, r, r * .5, 0, 0, TAU); x.fill(); }
function drawVane(sx, sy, on) { // 바람개비 표지: 나무 기둥 + 네 날개
  x.strokeStyle = '#6a4a2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx, sy - 52); x.stroke(); x.strokeStyle = '#8a6a3a'; x.lineWidth = 2; x.stroke();
  const a0 = on ? G.t * 4 : .3; for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2; x.fillStyle = i % 2 ? '#f6f0e0' : (on ? '#6fc8f0' : '#c8c0b0'); x.beginPath(); x.moveTo(sx, sy - 52); x.quadraticCurveTo(sx + Math.cos(a) * 14 - Math.sin(a) * 6, sy - 52 + Math.sin(a) * 9 + Math.cos(a) * 3, sx + Math.cos(a + .5) * 18, sy - 52 + Math.sin(a + .5) * 11); x.closePath(); x.fill(); x.strokeStyle = 'rgba(40,30,20,.5)'; x.lineWidth = 1; x.stroke(); }
  x.fillStyle = '#c8a24a'; x.beginPath(); x.arc(sx, sy - 52, 3, 0, TAU); x.fill();
}
function drawHero(P) {
  const [sx, sy] = iso(P.x, P.y); shadow(sx, sy, 13);
  if (P.buf.cloud) { x.fillStyle = 'rgba(240,248,255,.35)'; x.beginPath(); x.ellipse(sx, sy - 20, 22, 28, 0, 0, TAU); x.fill(); }
  if (P.buf.hold) { x.strokeStyle = 'rgba(255,210,120,.7)'; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy, 18, 9, 0, 0, TAU); x.stroke(); }
  const a = P.dodge > 0 ? .75 : P.inv0 > 0 ? .6 + Math.sin(G.t * 30) * .3 : 1;
  sprite(IM[P.cls], HC[0], HC[1], HC[2], HC[3], heroFrame(P), P.dir, sx, sy, .5, P.hurt > .15 ? .1 : 0, a);
}
function drawMob(m) {
  const D = m.D, c = MC[D.spr], [sx, sy0] = iso(m.x, m.y), sy = sy0 + (m.fy || 0) * 30;
  const a = m.dead ? Math.max(0, 1 - Math.max(0, m.at - .5) * 1.6) * (m.fl ? Math.max(0, 1 - m.fy * .4) : 1) : 1;
  if (!m.fl) shadow(sx, sy0, D.boss ? 36 : D.fly ? 9 : 11);
  if (m.elite && !m.dead) { x.strokeStyle = m.E[1]; x.globalAlpha = .7; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy0, 16, 8, 0, 0, TAU); x.stroke(); x.globalAlpha = 1; }
  sprite(IM[D.spr], c[0], c[1], c[2], c[3], mobFrame(m), m.dir, sx, sy, .5 * (m.fl ? Math.max(.2, 1 - m.fy * .25) : 1), m.flash, a);
  if (!m.dead && (m.hp < m.mhp || m.elite) && !D.boss) { const w = 26, f = m.hp / m.mhp, top = sy - c[3] * .5 - 2; x.fillStyle = 'rgba(20,14,10,.7)'; x.fillRect(sx - w / 2 - 1, top - 1, w + 2, 5); x.fillStyle = m.elite ? m.E[1] : '#e85a4a'; x.fillRect(sx - w / 2, top, w * f, 3);
    if (m.elite) { x.font = '700 9px system-ui'; x.textAlign = 'center'; x.fillStyle = m.E[1]; x.strokeStyle = 'rgba(20,14,10,.8)'; x.lineWidth = 2.5; const s = m.E[0] + ' ' + D.n; x.strokeText(s, sx, top - 4); x.fillText(s, sx, top - 4); } }
  if (m.stun > 0 && !m.dead) { x.fillStyle = '#ffe08a'; for (let i = 0; i < 3; i++) { const a2 = G.t * 5 + i * TAU / 3; x.beginPath(); x.arc(sx + Math.cos(a2) * 9, sy - c[3] * .42 + Math.sin(a2) * 3, 2, 0, TAU); x.fill(); } }
}
function drawDrop(d) {
  const [sx, sy] = iso(d.x, d.y), b = Math.max(0, .35 - d.t) * 60;
  if (d.gold) { x.fillStyle = '#ffd166'; x.strokeStyle = '#8a6a1a'; x.lineWidth = 1; for (let i = 0; i < Math.min(4, 1 + d.gold / 10); i++) { x.beginPath(); x.ellipse(sx - 4 + i * 3, sy - 3 - b - i * 1.5, 4, 2.4, 0, 0, TAU); x.fill(); x.stroke(); } return; }
  const it = d.it, col = itemColor(it); x.fillStyle = col; x.globalAlpha = .25 + Math.sin(G.t * 4) * .1; x.beginPath(); x.ellipse(sx, sy, 12, 6, 0, 0, TAU); x.fill(); x.globalAlpha = 1;
  drawIcon(it, sx - 11, sy - 18 - b, 22);
}
function drawIcon(it, X, Y, s, g) { g = g || x; const k = it.g ? GOODS[it.g].ic : BASE[it.b].ic, m = ICM[k];
  if (m && IM.icons) { g.drawImage(IM.icons, m[0], m[1], m[2], m[3], X, Y, s, s); return; }
  g.fillStyle = itemColor(it); g.beginPath(); g.arc(X + s / 2, Y + s / 2, s * .32, 0, TAU); g.fill(); }
function drawProj(p) {
  const [sx, sy] = iso(p.x, p.y), Y = sy - 22;
  if (p.k === 'wind') { x.strokeStyle = 'rgba(230,248,255,.9)'; x.lineWidth = 2.2; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(sx, Y, 4 + i * 3, G.t * 12 + i, G.t * 12 + i + 2.2); x.stroke(); } }
  else if (p.k === 'bolt') { const [ex, ey] = iso(p.x - p.vx * .04, p.y - p.vy * .04); x.strokeStyle = '#fff6b0'; x.lineWidth = 3; x.shadowColor = '#ffe066'; x.shadowBlur = 10; x.beginPath(); x.moveTo(ex, ey - 22); x.lineTo(sx, Y); x.stroke(); x.shadowBlur = 0; }
  else if (p.k === 'twister') { for (let i = 0; i < 7; i++) { const r = 6 + i * 3.2, yy = sy - i * 7; x.strokeStyle = `rgba(225,242,252,${.85 - i * .08})`; x.lineWidth = 2.4; x.beginPath(); x.ellipse(sx + Math.sin(G.t * 9 + i) * 3, yy, r, r * .38, 0, G.t * 14 + i, G.t * 14 + i + 4.4); x.stroke(); } }
}
function drawFx(f) {
  if (f.t < 0) return; const k = f.t / f.life, [sx, sy] = iso(f.x, f.y);
  if (f.k === 'ring') { x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 3; x.beginPath(); x.ellipse(sx, sy, f.r * TW / 2 * 1.41 * (.4 + k * .6), f.r * TH / 2 * 1.41 * (.4 + k * .6), 0, 0, TAU); x.stroke(); x.globalAlpha = 1; }
  else if (f.k === 'thrust') { const [ex, ey] = iso(f.x + f.dx * f.len, f.y + f.dy * f.len); x.strokeStyle = `rgba(255,250,235,${1 - k})`; x.lineWidth = 4 * (1 - k) + 1; x.beginPath(); x.moveTo(sx, sy - 20); x.lineTo(ex, ey - 20); x.stroke(); }
  else if (f.k === 'gust' || f.k === 'bash') { const a0 = Math.atan2(...(() => { const [ax, ay] = iso(f.dx, f.dy); return [ay, ax]; })()); x.strokeStyle = f.k === 'gust' ? `rgba(230,246,255,${.9 - k})` : `rgba(255,220,150,${.9 - k})`; x.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { const a = a0 + (i / 5 - .5) * f.arc, r = f.r * 32 * (.4 + k * .7); x.beginPath(); x.ellipse(sx, sy - 14, r, r * .5, 0, a - .15, a + .15); x.stroke(); } }
  else if (f.k === 'zap') { const [ex, ey] = iso(f.x2, f.y2); x.strokeStyle = `rgba(255,246,170,${1 - k})`; x.lineWidth = 2.5; x.shadowColor = '#ffe066'; x.shadowBlur = 8; x.beginPath(); x.moveTo(sx, sy - 22); for (let i = 1; i < 6; i++) { const t = i / 6; x.lineTo(lerp(sx, ex, t) + rnd(-6, 6), lerp(sy, ey, t) - 22 + rnd(-6, 6)); } x.lineTo(ex, ey - 22); x.stroke(); x.shadowBlur = 0; }
  else if (f.k === 'pop') { x.fillStyle = f.c; x.globalAlpha = 1 - k; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.beginPath(); x.arc(sx + Math.cos(a) * k * 14, sy - 20 + Math.sin(a) * k * 9, 2.4 * (1 - k) + .5, 0, TAU); x.fill(); } x.globalAlpha = 1; }
  else if (f.k === 'aura') { x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy - k * 30 - i * 8, 16 - i * 3, 7 - i, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  else if (f.k === 'lvl') { x.strokeStyle = '#ffd166'; x.globalAlpha = 1 - k; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy - k * 50 - i * 12, 20 + i * 4, 9 + i * 2, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  else if (f.k === 'sail') { x.fillStyle = `rgba(240,248,255,${.5 * (1 - k)})`; x.beginPath(); x.ellipse(sx, sy - 18, 16 + k * 10, 8, 0, 0, TAU); x.fill(); }
}
function questMark(k) { const P = G.P; for (const id in QUESTS) { const Q = QUESTS[id]; if (Q.from !== k) continue; const q = P.q[id]; if (q && q.s === 2) return '?'; if (!q && qAvail(id)) return '!'; } return ''; }
function qAvail(id) { const q = G.P.q; if (id === 'q1') return true; if (id === 'q2') return true; if (id === 'q4') return true; if (id === 'q3') return q.q1 && q.q1.s === 3; return false; }

/* ---------- 화면 위 정보(HUD) ---------- */
let BTN = [];
function hud() {
  if (G.noHud) return;
  const { cw, ch } = lay, P = G.P, touch = TOUCH.on; BTN = [];
  const s = clamp(Math.min(cw, ch * 1.8) / 900, .8, 1.25);
  // 왼쪽 위: 이름·레벨·생명·바람
  const bx = 10 + SAFE_L(), by = 10, bw = 170 * s;
  x.fillStyle = 'rgba(30,24,18,.55)'; rr(bx, by, bw + 16, 64 * s, 10); x.fill();
  x.font = `800 ${12 * s}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText(CLASSES[P.cls].name + ' · ' + P.lv + '레벨', bx + 8, by + 15 * s);
  x.font = `600 ${10 * s}px system-ui`; x.fillStyle = '#ffd166'; x.textAlign = 'right'; x.fillText(P.gold.toLocaleString() + 'G', bx + bw + 8, by + 15 * s);
  bar(bx + 8, by + 22 * s, bw, 12 * s, P.hp / P.mhp, '#e8604e', '#ff9a7a', Math.ceil(P.hp) + ' / ' + P.mhp, s);
  bar(bx + 8, by + 38 * s, bw, 10 * s, P.wind / P.mwind, '#4aa8d8', '#9fe4ff', Math.floor(P.wind) + ' / ' + P.mwind, s);
  const xf = P.xp / xpNeed(P.lv); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(bx + 8, by + 52 * s, bw, 4); x.fillStyle = '#b6f0a0'; x.fillRect(bx + 8, by + 52 * s, bw * xf, 4);
  if (P.rested > 1) { x.fillStyle = 'rgba(159,228,255,.6)'; x.fillRect(bx + 8 + bw * xf, by + 52 * s, Math.min(bw * (1 - xf), bw * P.rested / xpNeed(P.lv)), 4); x.font = `600 ${8.5 * s}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#9fe4ff'; x.fillText('순풍 ×2', bx + 8, by + 64 * s); }
  if (P.pts || P.skp) { x.font = `700 ${9.5 * s}px system-ui`; x.textAlign = 'right'; x.fillStyle = '#ffd166'; x.fillText((P.pts ? '스탯 ' + P.pts + ' ' : '') + (P.skp ? '스킬 ' + P.skp : ''), bx + bw + 8, by + 64 * s); }
  // 보스 체력
  const boss = G.mobs.find(m => m.D.boss && !m.dead && m.st !== 'idle'); if (boss) { const w = Math.min(420, cw * .36); x.fillStyle = 'rgba(30,24,18,.7)'; rr(cw / 2 - w / 2 - 6, 8, w + 12, 30, 8); x.fill(); x.font = '800 12px system-ui'; x.textAlign = 'center'; x.fillStyle = '#ffe4c8'; x.fillText(boss.D.n, cw / 2, 21); x.fillStyle = '#3a2a20'; x.fillRect(cw / 2 - w / 2, 26, w, 7); x.fillStyle = '#e8604e'; x.fillRect(cw / 2 - w / 2, 26, w * boss.hp / boss.mhp, 7); }
  // 메시지
  x.textAlign = 'center'; G.msg.forEach((m, i) => { const a = Math.min(1, 4.5 - m.t); x.globalAlpha = a; x.font = `700 ${12.5 * s}px system-ui`; const w = x.measureText(m.s).width + 20, yy = (boss ? 48 : 14) + i * 24 * s; x.fillStyle = 'rgba(30,24,18,.62)'; rr(cw / 2 - w / 2, yy, w, 20 * s, 8); x.fill(); x.fillStyle = m.c; x.fillText(m.s, cw / 2, yy + 14 * s); x.globalAlpha = 1; });
  minimap(cw - 10 - SAFE_R(), 10, s);
  // 퀘스트 알림
  questTracker(cw - 10 - SAFE_R(), 10 + 112 * s + 8, s);
  // 아래: 스킬·물약·피하기·메뉴
  const bsz = (touch ? 50 : 42) * s, gap = 6 * s;
  if (touch) {
    const A0 = bsz * 1.5, cx = cw - SAFE_R() - 14 - A0 / 2, cy = ch - 12 - A0 / 2, rho = A0 / 2 + bsz * .78;
    btn('atk', cx - A0 / 2, cy - A0 / 2, A0, '', '공격');
    [180, 215, 250, 285].forEach((deg, i) => { const a = deg * Math.PI / 180; skillBtn(i, P.slots[i], cx + Math.cos(a) * rho - bsz / 2, cy + Math.sin(a) * rho - bsz / 2, bsz); });
    const sm = bsz * .82, lx = cx - rho - bsz * .5 - sm - 10;
    btn('dodge', lx, ch - 12 - sm, sm, '', '돛'); btn('pot', lx - sm - 8, ch - 12 - sm, sm, '', '차 ' + count('pot')); btn('wpot', lx - (sm + 8) * 2, ch - 12 - sm, sm, '', '사탕 ' + count('wpot'));
    // 왼쪽 막대(가상 패드)
    if (TOUCH.pad) { const p = TOUCH.pad; x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(p.x0, p.y0, 46, 0, TAU); x.stroke(); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(p.x0 + p.dx * 40, p.y0 + p.dy * 40, 20, 0, TAU); x.fill(); }
  } else {
    const n = 4, tw = n * bsz + (n - 1) * gap, X0 = cw / 2 - tw / 2 - bsz, Y0 = ch - bsz - 12;
    P.slots.forEach((id, i) => skillBtn(i, id, X0 + bsz + i * (bsz + gap), Y0, bsz, String(i + 1)));
    btn('pot', X0 - gap - bsz * .2, Y0, bsz, 'Q', '차 ' + count('pot')); btn('wpot', X0 + bsz + tw + gap, Y0, bsz, 'R', '사탕 ' + count('wpot')); btn('dodge', X0 + bsz * 2 + tw + gap * 2, Y0, bsz, '␣', '돛');
  }
  // 메뉴 버튼(위 가운데 오른쪽)
  const mb = 30 * s, my = 8, mx = cw - SAFE_R() - 10 - 112 * s - 8 - (mb + 4) * 4;
  [['inv', '가방', 'I'], ['char', '능력', 'C'], ['skill', '스킬', 'K'], ['menu', '≡', '']].forEach(([k, l, key], i) => { const X = mx + i * (mb + 4); x.fillStyle = 'rgba(30,24,18,.6)'; rr(X, my, mb, mb, 7); x.fill(); x.fillStyle = (k === 'char' && P.pts) || (k === 'skill' && P.skp) ? '#ffd166' : '#fff'; x.font = `700 ${(l.length > 1 ? 10 : 15) * s}px system-ui`; x.textAlign = 'center'; x.fillText(l, X + mb / 2, my + mb / 2 + 4 * s); BTN.push({ k, x: X, y: my, w: mb, h: mb }); });
  // 상호작용
  if (G.near) { x.font = `800 ${12.5 * s}px system-ui`; const t = (touch ? '' : 'F  ') + G.near.label, w = x.measureText(t).width + 26, X = cw / 2 - w / 2, Y = ch - (touch ? 70 : 110) * s; x.fillStyle = 'rgba(255,240,200,.92)'; rr(X, Y, w, 28 * s, 14); x.fill(); x.fillStyle = '#3a2a10'; x.textAlign = 'center'; x.fillText(t, cw / 2, Y + 18.5 * s); BTN.push({ k: 'use', x: X, y: Y, w, h: 28 * s }); }
}
const SAFE_L = () => 0, SAFE_R = () => 0;
function bar(X, Y, w, h, f, c1, c2, label, s) { x.fillStyle = 'rgba(0,0,0,.4)'; rr(X, Y, w, h, h / 2); x.fill(); const g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, c2); g.addColorStop(1, c1); x.fillStyle = g; if (f > 0) { rr(X, Y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); x.fill(); } x.font = `700 ${h * .78}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(label, X + w / 2, Y + h * .8); }
function btn(k, X, Y, sz, key, label) { x.fillStyle = 'rgba(30,24,18,.55)'; x.beginPath(); x.arc(X + sz / 2, Y + sz / 2, sz / 2, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,240,210,.5)'; x.lineWidth = 1.5; x.stroke();
  const P = G.P; if (k === 'dodge' && P.dcd > 0) { x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.moveTo(X + sz / 2, Y + sz / 2); x.arc(X + sz / 2, Y + sz / 2, sz / 2, -Math.PI / 2, -Math.PI / 2 + TAU * P.dcd / P.sail[1]); x.fill(); }
  if (k === 'atk') { const ic = CLASSES[P.cls].melee ? 'spear' : 'staff'; if (ICM[ic]) x.drawImage(IM.icons, ...ICM[ic], X + sz * .2, Y + sz * .2, sz * .6, sz * .6); }
  if (k === 'pot' || k === 'wpot') { const m = ICM[k]; if (m) x.drawImage(IM.icons, ...m, X + sz * .22, Y + sz * .12, sz * .56, sz * .56); }
  if (k === 'dodge') { const m = ICM.sail; if (m) x.drawImage(IM.icons, ...m, X + sz * .22, Y + sz * .12, sz * .56, sz * .56); }
  x.font = `700 ${Math.max(9, sz * .2)}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 2.5; if (label) { x.strokeText(label, X + sz / 2, Y + sz * .9); x.fillText(label, X + sz / 2, Y + sz * .9); }
  if (key) { x.fillStyle = '#ffd166'; x.fillText(key, X + sz * .18, Y + sz * .26); }
  BTN.push({ k, x: X, y: Y, w: sz, h: sz });
}
const SKC = { pierce: '#ffe9c0', sweep: '#ffd59a', bash: '#ffd27a', hold: '#f2c26a', shout: '#ffb48a', flag: '#b6f0a0', gust: '#dff4ff', twister: '#c8ecff', bolt: '#fff3a0', chain: '#ffe066', cloud: '#f4f8ff', mist: '#d8e6f0' };
function skillBtn(i, id, X, Y, sz, key) {
  const P = G.P; x.fillStyle = 'rgba(30,24,18,.6)'; rr(X, Y, sz, sz, sz * .22); x.fill(); x.strokeStyle = 'rgba(255,240,210,.45)'; x.lineWidth = 1.5; x.stroke();
  if (id) { const s = SKILLS[P.cls].find(q => q.id === id); drawSkillIcon(x, s, X, Y, sz, P.cls); const cd = P.cds[id] || 0; if (cd > 0) { x.fillStyle = 'rgba(0,0,0,.55)'; rr(X, Y + sz * (1 - cd / s.cd), sz, sz * cd / s.cd, sz * .2); x.fill(); } if (P.wind < s.cost) { x.fillStyle = 'rgba(20,60,120,.4)'; rr(X, Y, sz, sz, sz * .22); x.fill(); } }
  if (key) { x.font = `700 ${sz * .24}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#ffd166'; x.fillText(key, X + 4, Y + sz * .28); }
  BTN.push({ k: 's' + i, x: X, y: Y, w: sz, h: sz });
}
// 스킬 그림: 갈래 색 바탕 + 동작 그림(코드)
function drawSkillIcon(g, s, X, Y, sz, cls) {
  const col = [['#3a6a8a', '#7aa0b8'], ['#8a6a3a', '#c8a26a'], ['#6a4a7a', '#a88ac0']][s.br], gr = g.createLinearGradient(X, Y, X + sz, Y + sz); gr.addColorStop(0, col[1]); gr.addColorStop(1, col[0]);
  g.save(); g.beginPath(); rrp(g, X + 3, Y + 3, sz - 6, sz - 6, sz * .18); g.fillStyle = gr; g.fill(); g.clip(); const c = SKC[s.id] || '#fff', cx = X + sz / 2, cy = Y + sz / 2, r = sz * .3;
  g.strokeStyle = c; g.fillStyle = c; g.lineWidth = sz * .07; g.lineCap = 'round';
  const L = (a, b, c2, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); };
  switch (s.id) {
    case 'pierce': L(cx - r, cy + r, cx + r, cy - r); g.beginPath(); g.moveTo(cx + r * 1.2, cy - r * 1.2); g.lineTo(cx + r * .55, cy - r * .9); g.lineTo(cx + r * .9, cy - r * .55); g.fill(); L(cx - r * .9, cy - r * .1, cx + r * .1, cy - r * 1.1); break;
    case 'sweep': g.beginPath(); g.arc(cx, cy, r, .3, TAU - .6); g.stroke(); g.beginPath(); g.moveTo(cx + r * .9, cy - r * .7); g.lineTo(cx + r * 1.2, cy - r * .1); g.lineTo(cx + r * .5, cy - r * .3); g.fill(); break;
    case 'bash': g.beginPath(); g.arc(cx - r * .2, cy, r * .8, 0, TAU); g.fill(); g.fillStyle = col[0]; g.beginPath(); g.arc(cx - r * .2, cy, r * .3, 0, TAU); g.fill(); g.strokeStyle = c; for (let i = 0; i < 3; i++) L(cx + r * .8, cy - r * .6 + i * r * .6, cx + r * 1.3, cy - r * .7 + i * r * .7); break;
    case 'hold': g.beginPath(); g.moveTo(cx, cy - r * 1.1); g.lineTo(cx + r, cy - r * .5); g.quadraticCurveTo(cx + r, cy + r * .6, cx, cy + r * 1.1); g.quadraticCurveTo(cx - r, cy + r * .6, cx - r, cy - r * .5); g.closePath(); g.fill(); break;
    case 'shout': for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx - r * .6, cy, r * (.5 + i * .4), -.7, .7); g.stroke(); } break;
    case 'flag': L(cx - r * .5, cy + r * 1.1, cx - r * .5, cy - r * 1.1); g.beginPath(); g.moveTo(cx - r * .5, cy - r * 1.1); g.quadraticCurveTo(cx + r * .3, cy - r * 1.3, cx + r, cy - r * .7); g.lineTo(cx - r * .5, cy - r * .2); g.fill(); break;
    case 'gust': for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - r, cy - r * .6 + i * r * .6); g.quadraticCurveTo(cx + r * .4, cy - r * .9 + i * r * .6, cx + r, cy - r * .4 + i * r * .55); g.stroke(); } break;
    case 'twister': for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(cx + (i % 2 ? 2 : -2), cy - r + i * r * .6, r * (1 - i * .2), r * .28, 0, 0, TAU); g.stroke(); } break;
    case 'bolt': case 'chain': g.beginPath(); g.moveTo(cx + r * .3, cy - r * 1.2); g.lineTo(cx - r * .6, cy + r * .1); g.lineTo(cx, cy + r * .1); g.lineTo(cx - r * .3, cy + r * 1.2); g.lineTo(cx + r * .7, cy - r * .2); g.lineTo(cx + r * .1, cy - r * .2); g.closePath(); g.fill(); if (s.id === 'chain') { g.beginPath(); g.arc(cx + r * .9, cy + r * .8, r * .25, 0, TAU); g.arc(cx - r * .9, cy - r * .8, r * .25, 0, TAU); g.fill(); } break;
    case 'cloud': case 'mist': g.beginPath(); g.arc(cx - r * .45, cy + r * .1, r * .45, 0, TAU); g.arc(cx + r * .1, cy - r * .2, r * .58, 0, TAU); g.arc(cx + r * .6, cy + r * .2, r * .4, 0, TAU); g.fill(); if (s.id === 'mist') { g.globalAlpha = .6; g.fillRect(cx - r * 1.1, cy + r * .6, r * 2.2, r * .2); g.globalAlpha = 1; } break;
  }
  g.restore();
}
function rrp(g, X, Y, w, h, r) { g.moveTo(X + r, Y); g.arcTo(X + w, Y, X + w, Y + h, r); g.arcTo(X + w, Y + h, X, Y + h, r); g.arcTo(X, Y + h, X, Y, r); g.arcTo(X, Y, X + w, Y, r); g.closePath(); }
let MINI = null;
function minimap(R, T, s) {
  const Wd = G.Wd, w = 112 * s, h = 112 * s, X = R - w;
  if (!MINI || MINI.v !== (Wd.bridges[Wd.bq].broken ? 0 : 1)) { const c = document.createElement('canvas'); c.width = Wd.W * 2; c.height = Wd.H * 2; const g = c.getContext('2d');
    for (let y = 0; y < Wd.H; y++) for (let xx = 0; xx < Wd.W; xx++) { const t = Wd.g[Wd.id(xx, y)]; if (!t) continue; g.fillStyle = t === 3 ? '#c8a070' : t === 4 ? '#8a6a50' : t === 5 ? '#d8d0c0' : t === 2 ? '#d8c08a' : Wd.block[Wd.id(xx, y)] ? '#5a8a4a' : '#9ccc7a'; g.fillRect(xx * 2, y * 2, 2, 2); }
    MINI = { c, v: Wd.bridges[Wd.bq].broken ? 0 : 1 }; }
  x.save(); x.fillStyle = 'rgba(30,24,18,.55)'; rr(X, T, w, h, 10); x.fill(); x.beginPath(); rr(X + 3, T + 3, w - 6, h - 6, 8); x.clip();
  const sc = 1.6 * s, P = G.P; x.translate(X + w / 2, T + h / 2); x.rotate(Math.PI / 4); x.scale(sc * .72, sc * .72 * .5 / .5); x.scale(1, 1);
  x.translate(-P.x * 2, -P.y * 2); x.drawImage(MINI.c, 0, 0);
  for (const m of G.mobs) if (!m.dead) { x.fillStyle = m.D.boss ? '#ff4a3a' : m.elite ? m.E[1] : '#e85a4a'; x.fillRect(m.x * 2 - 1.5, m.y * 2 - 1.5, 3, 3); }
  for (const k in Wd.npcAt) { x.fillStyle = '#ffd166'; x.fillRect(Wd.npcAt[k][0] * 2 - 1.5, Wd.npcAt[k][1] * 2 - 1.5, 3, 3); }
  for (const wp of Wd.wps) { x.fillStyle = wp.on ? '#9fe4ff' : '#888'; x.beginPath(); x.arc(wp.x * 2, wp.y * 2, 2.6, 0, TAU); x.fill(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(P.x * 2, P.y * 2, 3, 0, TAU); x.fill(); x.restore();
}
function questTracker(R, T, s) {
  const P = G.P, L = []; for (const id in QUESTS) { const q = P.q[id]; if (!q || q.s === 3) continue; const Q = QUESTS[id]; let t = Q.goal; if (q.s === 2) t = NPCDEF[Q.from].n + '에게 돌아가기'; else if (id === 'q1') t = '다리 널빤지 ' + Math.min(6, count('plank')) + '/6 → 동쪽 끊긴 다리'; else if (id === 'q2') t = '보풀이 ' + q.n + '/15'; else if (id === 'q4') t = '바람 숫돌 ' + Math.min(3, count('hone')) + '/3'; L.push([Q.n, t]); }
  if (!L.length) return; x.textAlign = 'right'; let y = T;
  for (const [n, t] of L) { x.font = `800 ${10.5 * s}px system-ui`; x.fillStyle = '#ffd166'; x.strokeStyle = 'rgba(30,24,18,.8)'; x.lineWidth = 3; x.strokeText(n, R, y + 10 * s); x.fillText(n, R, y + 10 * s); x.font = `600 ${9.5 * s}px system-ui`; x.fillStyle = '#fff'; x.strokeText(t, R, y + 23 * s); x.fillText(t, R, y + 23 * s); y += 30 * s; }
}


/* =================== 화면(DOM)·입력·소리 =================== */
let panel, raf = 0, last = 0, acc = 0, PANEL = null, SEL = null, SHOP = null;
const TOUCH = { on: false, pad: null, held: {} }, KEYS = {};
function css() {
  const st = document.createElement('style');
  st.textContent = '.sk-ov{position:fixed;inset:0;z-index:9999;background:#9cc8e8;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;color:#3a2e22}.sk-ov canvas{box-shadow:none!important}.sk-ov>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.sk-pn{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:rgba(40,52,64,.45);padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) 8px max(8px,env(safe-area-inset-left))}'
    + '.sk-bx{background:linear-gradient(#fbf6ea,#efe5d0);border:2px solid #b89a6a;border-radius:16px;box-shadow:0 10px 40px rgba(30,20,10,.35),inset 0 0 0 3px #fffaf0;max-width:min(860px,100%);max-height:100%;width:100%;overflow:auto;padding:12px 14px;position:relative}'
    + '.sk-bx h3{margin:0 0 8px;font-size:17px;color:#5a3e22}.sk-bx h4{margin:10px 0 6px;font-size:13px;color:#7a5a32}.sk-x{position:sticky;top:0;float:right;border:0;background:#c8a06a;color:#fff;border-radius:10px;width:32px;height:32px;font-size:16px;cursor:pointer;z-index:2}'
    + '.sk-b{border:1.5px solid #b89a6a;background:#fffaf0;color:#5a3e22;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;margin:3px}.sk-b.p{background:#4f9fc8;border-color:#3a7fa8;color:#fff}.sk-b.g{background:#7ab85a;border-color:#5a9a3a;color:#fff}.sk-b:disabled{opacity:.45;cursor:default}'
    + '.sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:5px}.sk-c{aspect-ratio:1;border-radius:9px;background:#e6dac0;border:1.5px solid #c8b088;position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center}.sk-c canvas{width:84%;height:84%}.sk-c.on{outline:3px solid #4f9fc8}.sk-c i{position:absolute;right:2px;bottom:0;font-style:normal;font-size:10px;font-weight:800;color:#5a3e22;text-shadow:0 0 2px #fff}.sk-c b{position:absolute;left:3px;top:1px;font-size:10px;color:#a88a5a}.sk-c.r1{border-color:#5ab88a;background:#dff0e0}.sk-c.r2{border-color:#9a7ad8;background:#ebe2f6}.sk-c.r3{border-color:#e8805a;background:#f8e2d6}.sk-c.r4{border-color:#e88ab8;background:#f8e0ec}.sk-c.cu{box-shadow:inset 0 0 0 2px #a83a3a}'
    + '.sk-eq{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}@media (max-width:520px){.sk-eq{grid-template-columns:repeat(5,minmax(0,1fr))}}'
    + '.sk-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:640px){.sk-two{grid-template-columns:1fr}}'
    + '.sk-card{background:#fffaf0;border:1.5px solid #c8b088;border-radius:12px;padding:8px 10px;font-size:12.5px;line-height:1.55}.sk-card .n{font-size:15px;font-weight:800}.sk-card .m{color:#8a7458;font-size:11.5px}.sk-card .a{color:#3a7fa8}.sk-card .h{color:#9a7ad8}.sk-card .bad{color:#c84a3a}.sk-card .st{color:#7a5a32;font-style:italic;font-size:11.5px}'
    + '.sk-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed #d8c8a8;font-size:13px}.sk-row .f{flex:1}.sk-row small{color:#8a7458}'
    + '.sk-talk{max-width:640px}.sk-talk p{font-size:14.5px;line-height:1.7;margin:6px 0}.sk-talk .who{font-weight:800;color:#7a5a32}'
    + '.sk-title{max-width:760px;text-align:center}.sk-title .t{font-size:34px;font-weight:900;letter-spacing:.06em;color:#3a5a7a;margin:6px 0 0;text-shadow:0 2px 0 #fff}.sk-title .s{color:#7a8aa0;font-size:12px;letter-spacing:.3em;margin-bottom:10px}'
    + '.sk-cls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.sk-cl{border:2px solid #c8b088;border-radius:14px;background:#fffaf0;padding:8px;cursor:pointer;text-align:center}.sk-cl.on{border-color:#4f9fc8;box-shadow:0 0 0 3px #4f9fc844}.sk-cl canvas{width:120px;height:128px}.sk-cl b{display:block;font-size:16px}.sk-cl small{display:block;font-size:11.5px;color:#7a6a58;line-height:1.5}'
    + '.sk-sk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media (max-width:640px){.sk-sk{grid-template-columns:1fr}}.sk-br{background:#fffaf0;border:1.5px solid #c8b088;border-radius:12px;padding:6px}.sk-br h4{margin:2px 0 6px;text-align:center}.sk-s{display:flex;gap:8px;align-items:flex-start;padding:5px;border-radius:9px;cursor:pointer}.sk-s.on{background:#e2f0f8}.sk-s canvas{width:42px;height:42px;flex:none}.sk-s .f{flex:1;font-size:12px;line-height:1.45}.sk-s b{font-size:13px}.sk-s .lk{opacity:.45}'
    + '.sk-rot{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;text-align:center;color:#fff;font-size:20px;font-weight:800;background:#3a5a7af2;padding:20px}@media (orientation:portrait) and (pointer:coarse){.sk-ov.play .sk-rot{display:flex}}';
  document.head.appendChild(st);
}
function mkDom() {
  css(); ov = document.createElement('div'); ov.className = 'sk-ov'; ov.hidden = true;
  cv = document.createElement('canvas'); x = cv.getContext('2d', { alpha: false }); ov.appendChild(cv);
  panel = document.createElement('div'); panel.className = 'sk-pn'; panel.hidden = true; ov.appendChild(panel);
  const rot = document.createElement('div'); rot.className = 'sk-rot'; rot.innerHTML = '📱↻<br>휴대폰을 가로로 돌려 주세요'; ov.appendChild(rot);
  document.body.appendChild(ov);
  addEventListener('resize', () => { if (!ov.hidden) layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && !PANEL) openPanel('menu'); if (document.hidden) save(); });
  input();
}
function layout() {
  const cw = ov.clientWidth || innerWidth, ch = ov.clientHeight || innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2); if (cw * ch * dpr * dpr > 3.2e6) dpr = Math.sqrt(3.2e6 / (cw * ch));
  const Z = clamp(Math.min(ch / 440, cw / 900), .88, 1.4);
  lay = { cw, ch, dpr, Z }; cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  TOUCH.on = matchMedia('(pointer:coarse)').matches || DEBUG && /touch/.test(location.hash);
  if (!TILES || TILES.S !== Z * dpr) TILES = bakeTiles(Z * dpr);
}
const KM = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
function inputVec() {
  let sx = 0, sy = 0; if (KEYS.l) sx--; if (KEYS.r) sx++; if (KEYS.u) sy--; if (KEYS.d) sy++;
  if (TOUCH.pad && (TOUCH.pad.dx || TOUCH.pad.dy)) { sx = TOUCH.pad.dx; sy = TOUCH.pad.dy; if (hyp(sx, sy) < .25) return [0, 0]; }
  if (!sx && !sy) { if (MOUSE.down && !MOUSE.btn && G && !G.P.tgt) { const [wx, wy] = mouseWorld(); const dx = wx - G.P.x, dy = wy - G.P.y, d = hyp(dx, dy); if (d > .3) return [dx / d, dy / d]; } return [0, 0]; }
  return scr2w(sx, sy);
}
const inputHeld = k => !!TOUCH.held[k] || (k === 'atk' && MOUSE.atk);
const MOUSE = { x: 0, y: 0, down: 0, btn: 0, atk: 0 };
function mouseWorld() { const V = view(); return unIso((MOUSE.x - V.ox) / V.Z, (MOUSE.y - V.oy) / V.Z); }
function hitBtn(px, py) { for (const b of BTN) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b; return null; }
function press(k, down) {
  if (!G) return; const P = G.P;
  if (k === 'atk') { TOUCH.held.atk = down; if (down) { P.tgt = null; basicAttack(); } return; }
  if (!down) return;
  if (k[0] === 's' && k.length === 2) { P.aimLock = false; P.aim = null; castSkill(+k[1]); }
  else if (k === 'pot' || k === 'wpot') drink(k); else if (k === 'dodge') doDodge(); else if (k === 'use') interact();
  else if (['inv', 'char', 'skill', 'menu'].includes(k)) openPanel(k);
}
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; if (KM[e.code]) { KEYS[KM[e.code]] = 1; e.preventDefault(); }
    if (e.repeat) return; const c = e.code;
    if (c === 'Escape') { if (PANEL) closePanel(); else openPanel('menu'); return; }
    if (PANEL) { if (c === 'KeyI' && PANEL === 'inv' || c === 'KeyC' && PANEL === 'char' || c === 'KeyK' && PANEL === 'skill') closePanel(); return; }
    if (!G) return;
    if (/^Digit[1-4]$/.test(c)) { G.P.aimLock = !!MOUSE.in; if (MOUSE.in) { const [wx, wy] = mouseWorld(), dx = wx - G.P.x, dy = wy - G.P.y, d = hyp(dx, dy) || 1; G.P.aim = [dx / d, dy / d]; G.P.dir = w2dir(dx, dy); } castSkill(+c[5] - 1); }
    else if (c === 'Space') { doDodge(); e.preventDefault(); } else if (c === 'KeyQ') drink('pot'); else if (c === 'KeyR') drink('wpot'); else if (c === 'KeyF' || c === 'KeyE') interact();
    else if (c === 'KeyI') openPanel('inv'); else if (c === 'KeyC') openPanel('char'); else if (c === 'KeyK') openPanel('skill'); else if (c === 'KeyJ') openPanel('quest');
  });
  addEventListener('keyup', e => { if (KM[e.code]) KEYS[KM[e.code]] = 0; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (!G || PANEL) return; const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; const b = hitBtn(px, py);
    if (e.pointerType === 'touch' || TOUCH.on) { TOUCH.on = true; if (b) { press(b.k, 1); TOUCH.ids = TOUCH.ids || {}; TOUCH.ids[e.pointerId] = b.k; return; }
      if (px < lay.cw * .5) { TOUCH.pad = { id: e.pointerId, x0: px, y0: py, dx: 0, dy: 0 }; } return; }
    if (b) { press(b.k, 1); return; }
    MOUSE.x = px; MOUSE.y = py; MOUSE.in = 1; const [wx, wy] = mouseWorld();
    if (e.button === 2) { G.P.aimLock = true; const dx = wx - G.P.x, dy = wy - G.P.y, d = hyp(dx, dy) || 1; G.P.aim = [dx / d, dy / d]; G.P.dir = w2dir(dx, dy); castSkill(0); return; }
    MOUSE.down = 1; MOUSE.btn = 0; const m = mobAt(wx, wy); if (m) { G.P.tgt = m; G.P.path = null; MOUSE.atk = 0; } else { G.P.tgt = null; G.P.path = [wx, wy]; const d = G.drops.find(d => hyp(d.x - wx, d.y - wy) < .6); if (d) G.P.path = [d.x, d.y]; }
  });
  addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (TOUCH.pad && e.pointerId === TOUCH.pad.id) { const dx = px - TOUCH.pad.x0, dy = py - TOUCH.pad.y0, d = hyp(dx, dy), m = Math.min(1, d / 40); TOUCH.pad.dx = d ? dx / d * m : 0; TOUCH.pad.dy = d ? dy / d * m : 0; return; }
    MOUSE.x = px; MOUSE.y = py; MOUSE.in = 1; if (MOUSE.down && G && !G.P.tgt) { const [wx, wy] = mouseWorld(); G.P.path = [wx, wy]; } });
  const up = e => { if (TOUCH.pad && e.pointerId === TOUCH.pad.id) TOUCH.pad = null; if (TOUCH.ids && TOUCH.ids[e.pointerId]) { press(TOUCH.ids[e.pointerId], 0); delete TOUCH.ids[e.pointerId]; } MOUSE.down = 0; MOUSE.atk = 0; };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
function mobAt(wx, wy) { let b = null, bd = .9; for (const m of G.mobs) { if (m.dead) continue; const d = hyp(m.x - wx + .3, m.y - wy + .3); if (d < bd + m.r) { bd = d; b = m; } } return b; }

/* ---------- 소리(코드로 합성) ---------- */
const A = { ctx: null, muted: false };
function audioInit() { try { A.muted = localStorage.getItem('sky_mute') === '1'; } catch (e) {} if (A.ctx) { A.ctx.resume(); return; } try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : .45; A.master.connect(A.ctx.destination); wind(); } catch (e) {} }
function tone(f, d, type, v, f2, delay) { const c = A.ctx; if (!c || A.muted) return; const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v || .2, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(A.master); o.start(t); o.stop(t + d + .02); }
function noise(d, v, fq, q, delay) { const c = A.ctx; if (!c || A.muted) return; const t = c.currentTime + (delay || 0), n = c.sampleRate * d, b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq || 1200; f.Q.value = q || 1; const g = c.createGain(); g.gain.setValueAtTime(v || .2, t); g.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(f); f.connect(g); g.connect(A.master); s.start(t); }
function sfx(k) {
  if (!A.ctx || A.muted) return;
  switch (k) {
    case 'hit': noise(.08, .3, 900, 1.5); tone(180, .08, 'triangle', .15, 90); break; case 'crit': noise(.12, .4, 1400, 1); tone(320, .12, 'square', .1, 120); break;
    case 'hurt': tone(220, .15, 'sawtooth', .12, 110); break; case 'block': tone(900, .08, 'square', .08, 600); break;
    case 'coin': tone(1320, .08, 'triangle', .12); tone(1760, .12, 'triangle', .1, null, .06); break; case 'pick': tone(660, .08, 'triangle', .12, 990); break;
    case 'lvl': [523, 659, 784, 1046].forEach((f, i) => tone(f, .25, 'triangle', .15, null, i * .09)); break;
    case 'dodge': noise(.25, .25, 700, .7); break; case 'shoot': noise(.14, .18, 1600, 2); break;
    case 'line': case 'nova': noise(.16, .3, 1100, 1.2); break; case 'cone': noise(.3, .35, 600, .6); break; case 'buff': case 'shield': tone(392, .4, 'sine', .14, 523); break;
    case 'shout': tone(160, .35, 'sawtooth', .12, 120); break; case 'flag': tone(523, .3, 'triangle', .12, 659); break; case 'twister': case 'gust': noise(.6, .3, 500, .5); break;
    case 'bolt': case 'chain': noise(.12, .35, 3000, 2); tone(1200, .1, 'square', .06, 300); break; case 'mist': noise(.8, .15, 400, .4); break;
    case 'slam': tone(70, .4, 'sine', .4, 40); noise(.3, .3, 300, .7); break; case 'die': tone(330, .8, 'triangle', .15, 110); break; case 'fall': tone(700, .5, 'sine', .12, 120); break;
    case 'no': tone(200, .1, 'square', .06); break; case 'drink': tone(520, .15, 'sine', .12, 780); break;
    case 'ench': tone(880, .3, 'triangle', .14, 1320); break; case 'fail': tone(300, .4, 'sawtooth', .1, 120); break;
  }
}
function wind() { // 잔잔한 바람 + 가끔 피리 소리
  const c = A.ctx, n = c.sampleRate * 4, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = l * .995 + (Math.random() * 2 - 1) * .02; d[i] = l; }
  const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = c.createGain(); g.gain.value = .5; s.connect(f); f.connect(g); g.connect(A.master); s.start();
  const sc = [392, 440, 523, 587, 659, 784]; setInterval(() => { if (!G || PANEL || ov.hidden || Math.random() < .5) return; const f0 = pick(sc); tone(f0, 1.6, 'sine', .035); if (Math.random() < .5) tone(pick(sc) / 2, 2.2, 'triangle', .025, null, .4); }, 2600);
}

/* ---------- 창(패널) ---------- */
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function closePanel() { PANEL = null; SEL = null; SHOP = null; panel.hidden = true; panel.innerHTML = ''; last = performance.now(); if (G) { calc(G.P); save(); } }
function openPanel(k, arg) { PANEL = k; panel.hidden = false; SEL = arg != null && k !== 'talk' ? SEL : SEL; render(arg); }
function iconCanvas(it, s) { const c = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1); c.width = c.height = s * d; const g = c.getContext('2d'); g.scale(d, d); drawIcon(it, 0, 0, s, g); return c; }
function cell(it, k, extra) { const r = it && !it.g ? ' r' + it.r : ''; return `<div class="sk-c${r}${it && it.st === -1 && it.id ? ' cu' : ''}${SEL === k ? ' on' : ''}" data-c="${k}">${extra || ''}${it ? '<span data-ic="' + k + '"></span>' : ''}${it && it.g && it.n > 1 ? '<i>' + it.n + '</i>' : it && it.en ? '<i>+' + it.en + '</i>' : ''}</div>`; }
function fillIcons(map) { panel.querySelectorAll('[data-ic]').forEach(el => { const it = map(el.dataset.ic); if (it) el.replaceWith(iconCanvas(it, 40)); }); }
function itemCard(it, P, cmp) {
  if (!it) return ''; const b = it.g ? null : BASE[it.b], L = [];
  L.push(`<div class="n" style="color:${it.g ? '#5a3e22' : shade(itemColor(it))}">${esc(itemName(it))}</div>`);
  if (it.g) { L.push(`<div class="m">${esc(GOODS[it.g].d)}</div>`); return '<div class="sk-card">' + L.join('') + '</div>'; }
  L.push(`<div class="m">${RAR[it.r].n} · ${SLOTN[b.s === 'ring' ? 'ring1' : b.s]}${b.cls ? ' · ' + CLASSES[b.cls].name + ' 전용' : ''} · ${b.lv}레벨</div>`);
  const m = itemMods({ ...it, af: [], hid: null }, {});
  if (m.dmg) L.push(`작은 적 피해 <b>${m.dmg[0]}~${m.dmg[1]}</b> · 큰 적 피해 <b>${m.dmg[2]}~${m.dmg[3]}</b>`);
  if (m.ac) L.push(`<div>방어력 <b>${m.ac}</b>${b.blk ? ' · 막기 ' + b.blk + '%' : ''}</div>`);
  if (b.sail) L.push(`<div>활공 ${b.sail[0]}칸 · 다시 쓰기 ${b.sail[1]}초</div>`);
  for (const k in b.fix || {}) L.push(`<div class="a">${afxText(k, b.fix[k], P.cls)}</div>`);
  if (!it.id) L.push('<div class="m">감정하면 옵션이 보여요 (이야기꾼 솔바람 · 살펴보기 쪽지)</div>');
  else { for (const [k, v] of it.af) L.push(`<div class="a">${afxText(k, v, P.cls)}</div>`); if (it.hid) L.push(it.tame >= TAME_N ? `<div class="h">길들임: ${afxText(it.hid[0], it.hid[1], P.cls)}</div>` : `<div class="h">길들이기 ${it.tame || 0}/${TAME_N} — 숨은 옵션 1개</div>`); }
  if (it.set && it.id) { const S = SETS[it.set], n = setCount(P)[it.set] || 0; L.push(`<div class="h">「${S.n}」 ${n}/${S.parts.length}</div>`); for (const [c, fx] of S.bonus) L.push(`<div class="${n >= c ? 'a' : 'm'}">${c}벌: ${fx.map(([k, v]) => afxText(k, v, P.cls)).join(', ')}</div>`); }
  if (it.u && it.id) L.push(`<div class="st">${esc(UNIQ.find(u => u.id === it.u).story)}</div>`);
  if (it.st === 1) L.push('<div class="a">축복: 기본 수치 +1, 강화 실패 1번 막아 줌</div>'); if (it.st === -1 && it.id) L.push('<div class="bad">저주: 기본 수치 -1, 맑은 샘물로 정화하기 전엔 벗을 수 없음</div>');
  const why = canWear(P, it); if (why) L.push(`<div class="bad">${esc(why)}</div>`);
  L.push(`<div class="m">팔 때 ${priceOf(it)}G</div>`);
  return '<div class="sk-card">' + L.join('') + '</div>' + (cmp ? '<div class="m" style="font-size:11px;margin:6px 0 2px">지금 낀 것</div>' + itemCard(cmp, P) : '');
}
function shade(c) { return c === '#ece6d6' ? '#5a4a36' : c === '#8ee8b0' ? '#2a8a5a' : c === '#c9a8ff' ? '#6a4ab8' : c === '#ff9f7c' ? '#c8502a' : c === '#ffb7dc' ? '#c84a8a' : c; }
function slotFor(P, it) { const s = BASE[it.b].s; if (s === 'ring') return !P.eq.ring1 ? 'ring1' : !P.eq.ring2 ? 'ring2' : 'ring1'; return s; }
function equip(i) { const P = G.P, it = P.inv[i], why = canWear(P, it); if (why) { toast(why); return; } const s = slotFor(P, it), old = P.eq[s]; if (old && old.st === -1 && old.id) { toast('저주받은 장비는 정화하기 전에 벗을 수 없어요'); return; } P.inv.splice(i, 1); if (old) P.inv.push(old); P.eq[s] = it; if (it.st === -1) it.id = true; calc(P); }
function unequip(s) { const P = G.P, it = P.eq[s]; if (!it) return; if (it.st === -1 && it.id) { toast('저주받은 장비는 정화하기 전에 벗을 수 없어요'); return; } if (P.inv.length >= 40) { toast('가방이 가득 찼어요'); return; } P.inv.push(it); delete P.eq[s]; calc(P); }
let toastT = 0; function toast(s) { const t = panel.querySelector('.sk-toast'); if (t) { t.textContent = s; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; }, 1800); } else if (G) say(s, '#fff', 1); }
const TOAST = '<div class="sk-toast" style="position:sticky;bottom:0;margin-top:8px;background:#5a3e22;color:#fff;border-radius:10px;padding:7px 10px;font-size:13px;opacity:0;transition:opacity .3s;text-align:center">.</div>';
function render(arg) {
  const P = G && G.P, k = PANEL; let h = '';
  const X = '<button class="sk-x" data-a="x" aria-label="닫기">✕</button>';
  if (k === 'inv') {
    const sel = SEL, si = sel && sel[0] === 'i' ? +sel.slice(1) : -1, ss = sel && sel[0] === 'e' ? sel.slice(1) : null, it = si >= 0 ? P.inv[si] : ss ? P.eq[ss] : null;
    h = `<div class="sk-bx">${X}<h3>가방 <small style="font-size:12px;color:#8a7458">${P.gold.toLocaleString()}G · ${P.inv.length}/40${SHOP ? ' · 상점: 물건을 눌러 팔기' : ''}</small></h3><div class="sk-two"><div><h4>입은 장비</h4><div class="sk-eq">${SLOTS.map(([s, n]) => cell(P.eq[s], 'e' + s, '<b>' + n + '</b>')).join('')}</div><h4>가방</h4><div class="sk-grid">${[...Array(40)].map((_, i) => cell(P.inv[i], 'i' + i)).join('')}</div></div><div>`;
    if (it) { const cmp = si >= 0 && !it.g ? P.eq[slotFor(P, it)] : null; h += itemCard(it, P, cmp) + '<div style="margin-top:6px">';
      if (si >= 0) { if (it.g === 'pot' || it.g === 'wpot') h += `<button class="sk-b g" data-a="use">마시기</button>`; if (!it.g) h += `<button class="sk-b p" data-a="eq">입기</button>`; if (it.g === 'look') h += '<p class="m" style="font-size:11.5px">감정 안 된 장비를 고른 뒤 「쪽지로 감정」</p>'; if (!it.g && !it.id && count('look')) h += `<button class="sk-b" data-a="lookit">쪽지로 감정</button>`; if (it.g === 'pure' || !it.g && it.st === -1 && count('pure')) h += ''; if (SHOP) h += `<button class="sk-b" data-a="sell">팔기 ${priceOf(it)}G</button>`; else h += `<button class="sk-b" data-a="drop">내려놓기</button>`; }
      else h += `<button class="sk-b" data-a="uneq">벗기</button>` + (it.st === -1 && count('pure') ? `<button class="sk-b g" data-a="purify">샘물로 정화</button>` : '');
      h += '</div>'; } else h += '<p class="m" style="font-size:12.5px;color:#8a7458">물건을 누르면 자세히 보여요. 같은 부위 장비와 비교해 줘요.</p>';
    if (SHOP) h += shopHtml(); h += '</div></div>' + TOAST + '</div>';
  } else if (k === 'char') {
    h = `<div class="sk-bx" style="max-width:560px">${X}<h3>능력 <small style="font-size:12px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 남은 점수 ${P.pts}</small></h3>`;
    for (const [s, n, d] of STATS) h += `<div class="sk-row"><div class="f"><b>${n}</b> ${P.st[s]} <small>(${CLASSES[P.cls].stat[s]} + 올림 ${P.sp[s] || 0})</small><br><small>${d}</small></div><button class="sk-b" data-a="st" data-s="${s}" ${P.pts ? '' : 'disabled'}>+1</button></div>`;
    const big = P.dmg; h += `<h4>지금 수치</h4><div class="sk-card">생명력 ${P.mhp} · 바람 ${P.mwind} (초당 +${P.wreg.toFixed(1)})<br>피해: 작은 적 ${big[0]}~${big[1]} / 큰 적 ${big[2]}~${big[3]} · 피해 +${Math.round(P.dmgp)}%<br>방어력 ${P.ac} (맞을 확률 ${Math.round(clamp(.92 - P.ac * .008, .55, .95) * 100)}%)${P.blk ? ' · 막기 ' + Math.round(P.blk) + '%' : ''}<br>공격 속도 초당 ${P.aspd.toFixed(2)}번 · 치명타 ${P.crit.toFixed(1)}% · 이동 ${P.move.toFixed(1)}<br>돛: 활공 ${P.sail[0]}칸 / ${P.sail[1]}초${P.find ? ' · 좋은 물건 +' + P.find + '%' : ''}${P.xpm > 1 ? ' · 경험치 +' + Math.round((P.xpm - 1) * 100) + '%' : ''}<br>쓰러뜨린 밑것들 ${P.kills}마리 · 경험 ${P.xp}/${xpNeed(P.lv)}</div>`;
    h += `<p class="m" style="font-size:11.5px;color:#8a7458">점수 다시 나누기는 1장 뒷부분에서 열려요(장마다 1번 무료).</p></div>`;
  } else if (k === 'skill') {
    const sel = SEL; h = `<div class="sk-bx">${X}<h3>스킬 <small style="font-size:12px;color:#8a7458">남은 점수 ${P.skp} · 같은 갈래 스킬끼리 점수당 피해 +6%(잇기)</small></h3><div class="sk-sk">`;
    BRANCH[P.cls].forEach((bn, bi) => { h += `<div class="sk-br"><h4>${bn}</h4>`; for (const s of SKILLS[P.cls].filter(q => q.br === bi)) { const lv = P.sk[s.id] || 0, lk = P.lv < s.req; h += `<div class="sk-s${sel === s.id ? ' on' : ''}" data-sk="${s.id}"><span data-si="${s.id}"></span><div class="f ${lk ? 'lk' : ''}"><b>${s.name}</b> ${lv}/10${P.skb[bi] && lv ? ' (+' + P.skb[bi] + ')' : ''}${lk ? ' · ' + s.req + '레벨' : ''}<br>${esc(s.desc)}<br><small>바람 ${s.cost} · ${s.cd}초${lv >= 5 && P.fork[s.id] != null ? ' · 갈래: ' + s.fork[P.fork[s.id]][0] : ''}</small></div></div>`; } h += '</div>'; });
    h += '</div>'; const s = sel && SKILLS[P.cls].find(q => q.id === sel);
    if (s) { const lv = P.sk[s.id] || 0; h += `<div class="sk-card" style="margin-top:8px"><b>${s.name}</b> ${lv}/10 — ${esc(s.desc)}<br>`;
      h += `<button class="sk-b g" data-a="learn" ${P.skp && lv < 10 && P.lv >= s.req ? '' : 'disabled'}>배우기 +1</button> `; if (lv) h += [0, 1, 2, 3].map(i => `<button class="sk-b${P.slots[i] === s.id ? ' p' : ''}" data-a="slot" data-i="${i}">${TOUCH.on ? '칸 ' : ''}${i + 1}번에 놓기</button>`).join('');
      h += `<h4>갈래 고르기 (스킬 5레벨)</h4>` + s.fork.map((f, i) => `<button class="sk-b${P.fork[s.id] === i ? ' p' : ''}" data-a="fork" data-i="${i}" ${lv >= 5 && P.fork[s.id] == null ? '' : 'disabled'}><b>${f[0]}</b> — ${esc(f[1])}</button>`).join('<br>') + (P.fork[s.id] != null ? '<p class="m" style="font-size:11px">갈래는 정하면 바꿀 수 없어요(맛보기판).</p>' : '') + '</div>'; }
    else h += '<p style="font-size:12.5px;color:#8a7458">스킬을 누르면 배우기·칸 놓기·갈래 고르기를 할 수 있어요.</p>';
    h += TOAST + '</div>';
  } else if (k === 'talk') h = talkHtml(arg);
  else if (k === 'smith') h = smithHtml();
  else if (k === 'travel') { h = `<div class="sk-bx" style="max-width:420px">${X}<h3>바람개비 표지</h3>${G.Wd.wps.map((w, i) => `<div class="sk-row"><div class="f"><b>${w.n}</b></div><button class="sk-b p" data-a="go" data-i="${i}" ${w.on ? '' : 'disabled'}>${w.on ? '날아가기' : '아직 잠김'}</button></div>`).join('')}</div>`; }
  else if (k === 'quest') { h = `<div class="sk-bx" style="max-width:560px">${X}<h3>할 일</h3>`; for (const id in QUESTS) { const q = P.q[id], Q = QUESTS[id]; if (!q) continue; h += `<div class="sk-row"><div class="f"><b>${Q.n}</b> ${q.s === 3 ? '✔' : q.s === 2 ? '(보고하기)' : ''}<br><small>${esc(Q.goal)} — ${NPCDEF[Q.from].n}</small></div></div>`; } h += '</div>'; }
  else if (k === 'menu') { h = `<div class="sk-bx" style="max-width:420px;text-align:center">${X}<h3>잠깐 쉬기</h3><button class="sk-b p" data-a="x">계속하기</button><br><button class="sk-b" data-a="quest">할 일 보기</button><br><button class="sk-b" data-a="mute">${A.muted ? '소리 켜기' : '소리 끄기'}</button><br><button class="sk-b" data-a="help">조작법</button><br><button class="sk-b" data-a="title">저장하고 처음 화면으로</button><br><button class="sk-b" data-a="quit">저장하고 나가기</button><p class="m" style="font-size:11.5px;color:#8a7458;margin-top:8px">기록은 10초마다, 그리고 창을 닫을 때 이 기기에 저장돼요.</p></div>`; }
  else if (k === 'help') { h = `<div class="sk-bx" style="max-width:560px">${X}<h3>조작법</h3><div class="sk-card"><b>PC</b>: WASD·방향키 또는 마우스 왼쪽 누르기로 이동, 적을 누르면 다가가서 공격 · 1~4 스킬(마우스 쪽으로) · 오른쪽 클릭 1번 스킬 · 스페이스 돛 활공(피하기) · Q 민들레 차 · R 바람 사탕 · F 말 걸기/다리 고치기 · I 가방 · C 능력 · K 스킬 · J 할 일 · Esc 쉬기<br><br><b>휴대폰</b>: 가로 화면. 왼쪽 아무 곳이나 끌어서 이동, 오른쪽 큰 버튼 공격(누르고 있으면 계속), 둘레 버튼 스킬 4개, 돛·차·사탕 버튼. 가운데 아래 노란 버튼으로 말 걸기.<br><br><b>요령</b>: 방패지기는 적을 섬 끝으로 밀어 떨어뜨릴 수 있어요(보상은 조금 줄어요). 바람이 모자라면 마을에서 금방 차요. 쉬고 돌아오면 순풍(경험치 2배)이 쌓여 있어요.</div></div>`; }
  else if (k === 'end') h = endHtml();
  panel.innerHTML = h; bindPanel(arg);
  if (k === 'inv') fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : c[0] === 'i' ? P.inv[+c.slice(1)] : c[0] === 'b' ? SHOP[+c.slice(1)] : null);
  if (k === 'smith') fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : P.inv[+c.slice(1)]);
  if (k === 'skill') panel.querySelectorAll('[data-si]').forEach(el => { const s = SKILLS[P.cls].find(q => q.id === el.dataset.si), c = document.createElement('canvas'), d = 2; c.width = c.height = 42 * d; const g = c.getContext('2d'); g.scale(d, d); drawSkillIcon(g, s, 0, 0, 42, P.cls); el.replaceWith(c); });
}
function shopHtml() { return `<h4>얼레의 물건 <small style="color:#8a7458">(누르면 사기)</small></h4><div class="sk-grid">${SHOP.map((it, i) => cell(it, 'b' + i)).join('')}</div>` + (SEL && SEL[0] === 'b' ? itemCard(SHOP[+SEL.slice(1)], G.P, null) + `<button class="sk-b g" data-a="buy">사기 ${buyPrice(SHOP[+SEL.slice(1)])}G</button>` : '') + coinHtml(); }
function coinHtml() { const B = opts.bonus; if (!B) return ''; const day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10), used = G.P.flags.coinDay === day ? G.P.flags.coinN || 0 : 0; return `<h4>5락실 코인 바꾸기</h4><p class="m" style="font-size:11.5px;color:#8a7458">코인 1개 = 200G, 하루 5개까지 (보유 ${B.coins()}개, 오늘 ${used}/5)</p><button class="sk-b" data-a="coin" ${B.coins() > 0 && used < 5 ? '' : 'disabled'}>🪙 1개 → 200G</button>`; }
const buyPrice = it => it.g ? GOODS[it.g].price : priceOf(it) * 4;
function makeShop() { const P = G.P, L = [goods('pot'), goods('wpot'), goods('pure'), goods('look')]; const lv = Math.max(2, P.lv); for (let i = 0; i < 8; i++) { const it = rollDrop(lv, 30, P.cls); it.id = true; if (it.r > 1) it.r = 1; if (it.st === -1) it.st = 0; L.push(it); } return L; }
function talkHtml(id) {
  const P = G.P, N = NPCDEF[id]; let lines = [], btns = [];
  const q = qid => P.q[qid];
  const offer = qid => { const Q = QUESTS[qid]; lines = Q.talk; btns.push(`<button class="sk-b p" data-a="accept" data-q="${qid}">맡을게요</button>`); };
  const finish = qid => { lines = QUESTS[qid].done; btns.push(`<button class="sk-b g" data-a="finish" data-q="${qid}">보상 받기</button>`); };
  if (id === 'chief') { if (!q('q1')) offer('q1'); else if (q('q1').s === 2) finish('q1'); else if (q('q1').s === 3 && !q('q3')) offer('q3'); else if (q('q3') && q('q3').s === 2 && P.flags['wp_바람개비 언덕']) finish('q3'); else if (q('q3') && q('q3').s === 2) lines = ['우두머리를 쓰러뜨렸다고? 언덕의 바람개비 표지에 손을 얹어 주게. 그래야 바람이 섬에 돌아오네.']; else if (q('q3') && q('q3').s === 3) lines = ['바람개비가 다시 도네. 이음꾼, 고맙네. 둥지섬 쪽은 다음에 함께 이야기하세.']; else lines = ['널빤지는 들판 밑것들이 물고 다닌다네. 다리는 마을 동쪽 들판 너머, 맨 위쪽 섬 끝에 있지.']; }
  if (id === 'sage') { if (!q('q2')) offer('q2'); else if (q('q2').s === 2) finish('q2'); else lines = ['큰바람은 원래 세상을 한 바퀴 돌면서 섬마다 숨을 불어넣었대. 그게 멎었으니 뜸돌도 잠들어 가는 거야.', '감정 안 된 물건이 있으면 보여 줘. 하나에 15G면 봐 줄게.'];
    const n = P.inv.filter(it => !it.g && !it.id).length; btns.push(`<button class="sk-b" data-a="ident" ${n && P.gold >= 15 ? '' : 'disabled'}>감정하기 (${n}개 · 개당 15G)</button>`); }
  if (id === 'smith') { if (!q('q4')) offer('q4'); else if (q('q4').s === 1 && count('hone') >= 3) { lines = ['오, 숫돌 세 개 가져왔구나!']; btns.push(`<button class="sk-b g" data-a="finish" data-q="q4">숫돌 건네기</button>`); } else lines = ['강화든 옵션 다시 굴리기든 맡겨. 무기는 +6, 방어구는 +4까지 안전해.']; btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); }
  if (id === 'merchant') { lines = ['어서 와. 다리가 끊겨서 나도 이 섬에 발이 묶였지 뭐야. 필요한 거 있어?']; btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); }
  return `<div class="sk-bx sk-talk"><button class="sk-x" data-a="x">✕</button><div class="who">${N.n}</div>${lines.map(l => '<p>' + esc(l) + '</p>').join('')}<div>${btns.join('')}<button class="sk-b" data-a="x">닫기</button></div>${TOAST}</div>`;
}
function smithHtml() {
  const P = G.P, sel = SEL, it = sel ? (sel[0] === 'e' ? P.eq[sel.slice(1)] : P.inv[+sel.slice(1)]) : null;
  let h = `<div class="sk-bx"><button class="sk-x" data-a="x">✕</button><h3>무쇠의 대장간 <small style="font-size:12px;color:#8a7458">숫돌 ${count('hone')} · 아교 ${count('glue')} · 축복 숫돌 ${count('bhone')} · 축복 아교 ${count('bglue')} · ${P.gold}G</small></h3><div class="sk-two"><div><h4>입은 장비</h4><div class="sk-eq">${SLOTS.map(([s, n]) => cell(P.eq[s], 'e' + s, '<b>' + n + '</b>')).join('')}</div><h4>가방</h4><div class="sk-grid">${P.inv.map((x2, i) => x2.g ? '' : cell(x2, 'i' + i)).join('')}</div></div><div>`;
  if (it && !it.g) { const kind = encKind(BASE[it.b]); h += itemCard(it, P);
    if (kind) { const next = it.en + 1, safe = next <= SAFE[kind], rate = safe ? 1 : (ENCH_RATE[kind][next] || 0); const mat = kind === 'weapon' ? ['hone', 'bhone'] : ['glue', 'bglue'];
      h += `<h4>강화 (+${it.en} → +${next}) · 성공 ${Math.round(rate * 100)}%${safe ? ' · 안전' : ' · 실패하면 한 단계 내려감'}</h4><button class="sk-b p" data-a="ench" data-m="${mat[0]}" ${count(mat[0]) && it.en < MAXENCH ? '' : 'disabled'}>${GOODS[mat[0]].n}로 강화</button><button class="sk-b g" data-a="ench" data-m="${mat[1]}" ${count(mat[1]) && it.en < MAXENCH ? '' : 'disabled'}>${GOODS[mat[1]].n}로 강화</button>`; }
    else h += '<p class="m" style="font-size:12px">장신구는 강화할 수 없어요.</p>';
    if ((it.r === 1 || it.r === 2) && it.id) { const cost = 40 + it.ilv * 15, mat = kind === 'weapon' ? 'hone' : 'glue'; h += `<h4>옵션 다시 굴리기</h4><p class="m" style="font-size:11.5px">무작위 옵션 하나를 새로 굴려요. ${cost}G${kind ? ' + ' + GOODS[mat].n + ' 1' : ''}</p><button class="sk-b" data-a="reroll" ${P.gold >= cost && (!kind || count(mat)) ? '' : 'disabled'}>다시 굴리기</button>`; }
  } else h += '<p style="font-size:12.5px;color:#8a7458">강화하거나 옵션을 다시 굴릴 장비를 고르세요.<br>무기 +6 · 방어구 +4까지는 100% 성공, 그 위는 실패하면 한 단계 내려가요. 축복 받은 장비는 실패를 한 번 막아 줘요.</p>';
  return h + '</div></div>' + TOAST + '</div>';
}
function endHtml() { const P = G.P; return `<div class="sk-bx sk-talk" style="text-align:center"><h3>1장 「민들레 섬」 앞부분 끝</h3><p>바람개비가 다시 돌기 시작했다. 아주 약하지만, 분명히 바람이다.</p><p>그런데 저 멀리 둥지섬 쪽 하늘에서 커다란 날개 그림자가 구름을 가르고 지나갔다…</p><p style="font-size:13px;color:#8a7458">맛보기판은 여기까지예요. ${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>계속 사냥하며 장비를 모으고 강화할 수 있어요. 1장 뒷부분(둥지섬·큰 왜가리)은 곧 열려요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }
function bindPanel(arg) {
  panel.onclick = e => {
    const t = e.target.closest('[data-a],[data-c],[data-sk]'); if (!t) { if (e.target === panel && PANEL !== 'title') closePanel(); return; }
    const P = G && G.P, a = t.dataset.a;
    if (t.dataset.c) { SEL = t.dataset.c; if (SEL[0] === 'b' && PANEL === 'inv') {} render(arg); return; }
    if (t.dataset.sk) { SEL = t.dataset.sk; render(); return; }
    if (a === 'x') { closePanel(); if (PANEL === null && G && G.endNext) { G.endNext = 0; openPanel('end'); } return; }
    if (a === 'eq') { equip(+SEL.slice(1)); SEL = null; render(); }
    else if (a === 'uneq') { unequip(SEL.slice(1)); SEL = null; render(); }
    else if (a === 'use') { const it = P.inv[+SEL.slice(1)]; drink(it.g); if (!P.inv.includes(it)) SEL = null; render(); }
    else if (a === 'drop') { const it = P.inv.splice(+SEL.slice(1), 1)[0]; G.drops.push({ x: P.x + .4, y: P.y + .4, it, t: -1 }); SEL = null; render(); }
    else if (a === 'sell') { const i = +SEL.slice(1), it = P.inv[i]; P.gold += priceOf(it); P.inv.splice(i, 1); SEL = null; sfx('coin'); render(); }
    else if (a === 'buy') { const it = SHOP[+SEL.slice(1)], pr = buyPrice(it); if (P.gold < pr) { toast('골드가 모자라요'); return; } const c = it.g ? goods(it.g) : it; if (!addInv(c)) { toast('가방이 가득 찼어요'); return; } P.gold -= pr; if (!it.g) { SHOP.splice(SHOP.indexOf(it), 1); SEL = null; } sfx('coin'); render(); }
    else if (a === 'coin') { const B = opts.bonus, day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10); if (P.flags.coinDay !== day) { P.flags.coinDay = day; P.flags.coinN = 0; } if (P.flags.coinN >= 5 || !B.spend(1)) return; P.flags.coinN++; P.gold += 200; sfx('coin'); render(); }
    else if (a === 'lookit') { const it = P.inv[+SEL.slice(1)]; if (useGood('look')) { it.id = true; sfx('ench'); SEL = 'i' + P.inv.indexOf(it); } render(); }
    else if (a === 'purify') { const it = P.eq[SEL.slice(1)]; if (useGood('pure')) { it.st = 0; calc(P); sfx('ench'); toast('정화했어요'); } render(); }
    else if (a === 'st') { if (P.pts > 0) { P.pts--; P.sp[t.dataset.s] = (P.sp[t.dataset.s] || 0) + 1; calc(P); } render(); }
    else if (a === 'learn') { const s = SKILLS[P.cls].find(q => q.id === SEL); if (P.skp > 0 && P.lv >= s.req && (P.sk[s.id] || 0) < 10) { P.skp--; P.sk[s.id] = (P.sk[s.id] || 0) + 1; autoSlots(P); if (P.sk[s.id] === 5) toast('5레벨! 갈래를 고를 수 있어요'); } render(); }
    else if (a === 'slot') { const i = +t.dataset.i, o = P.slots.indexOf(SEL); if (o >= 0) P.slots[o] = P.slots[i]; P.slots[i] = SEL; render(); }
    else if (a === 'fork') { const s = SKILLS[P.cls].find(q => q.id === SEL); if ((P.sk[s.id] || 0) >= 5 && P.fork[s.id] == null) { P.fork[s.id] = +t.dataset.i; toast('「' + s.fork[+t.dataset.i][0] + '」 갈래를 골랐어요'); } render(); }
    else if (a === 'go') { const w = G.Wd.wps[+t.dataset.i]; P.x = w.x + .8; P.y = w.y + .8; G.cam = [P.x, P.y]; closePanel(); sfx('dodge'); }
    else if (a === 'accept') { qSet(t.dataset.q, 1); toast('「' + QUESTS[t.dataset.q].n + '」을(를) 맡았어요'); closePanel(); }
    else if (a === 'finish') finishQuest(t.dataset.q);
    else if (a === 'ident') { let n = 0; for (const it of P.inv) if (!it.g && !it.id && P.gold >= 15) { P.gold -= 15; it.id = true; n++; } toast(n + '개 감정했어요'); sfx('ench'); render(arg); }
    else if (a === 'smith') { PANEL = 'smith'; SEL = null; render(); }
    else if (a === 'shop') { PANEL = 'inv'; SHOP = G.shop || (G.shop = makeShop()); SEL = null; render(); }
    else if (a === 'ench') { const it = SEL[0] === 'e' ? P.eq[SEL.slice(1)] : P.inv[+SEL.slice(1)], m = t.dataset.m; if (!count(m)) return; const r = enchant(it, m); if (r.ok || r.msg.includes('실패')) useGood(m); if (!r.ok && !r.msg.includes('실패')) { toast(r.msg); return; } sfx(r.ok === 1 ? 'ench' : 'fail'); calc(P); render(); toast(r.msg); }
    else if (a === 'reroll') { const it = SEL[0] === 'e' ? P.eq[SEL.slice(1)] : P.inv[+SEL.slice(1)], kind = encKind(BASE[it.b]), cost = 40 + it.ilv * 15; if (P.gold < cost) return; if (kind && !useGood(kind === 'weapon' ? 'hone' : 'glue')) return; P.gold -= cost; const i = reroll(it); calc(P); sfx('ench'); render(); toast(i === false ? '바뀌지 않았어요' : '새 옵션: ' + afxText(it.af[i][0], it.af[i][1], P.cls)); }
    else if (a === 'quest') { PANEL = 'quest'; render(); } else if (a === 'help') { PANEL = 'help'; render(); }
    else if (a === 'mute') { A.muted = !A.muted; try { localStorage.setItem('sky_mute', A.muted ? '1' : '0'); } catch (er) {} if (A.master) A.master.gain.value = A.muted ? 0 : .45; render(); }
    else if (a === 'title') { save(); G = null; title(); }
    else if (a === 'quit') { save(); close(); }
    else if (a === 'pick') { TSEL = t.dataset.cls; title(); }
    else if (a === 'start') startFrom(t.dataset.n === '1');
  };
}
function finishQuest(id) {
  const P = G.P, q = P.q[id]; if (!q) return;
  if (id === 'q4') { if (!useGood('hone', 3)) return; addInv(goods('bhone')); }
  q.s = 3; const R = { q1: [150, 80], q2: [120, 50], q3: [500, 200], q4: [80, 30] }[id]; gainXp(R[0]); P.gold += R[1];
  if (id === 'q1') addInv(makeItem(P.cls === 'warden' ? 'armor1' : 'cloak1', 1, 4, { id: 1, st: 0 }));
  if (id === 'q2') addInv(makeItem('ring1', 1, 4, { id: 1, st: 0 }));
  if (id === 'q3') addInv(makeItem('sail1', 2, 9, { id: 1, st: 1 }));
  sfx('lvl'); save(); closePanel(); say('「' + QUESTS[id].n + '」 완료! 경험치 ' + R[0] + ', ' + R[1] + 'G', '#ffd166');
  if (id === 'q1') setTimeout(() => talk('chief'), 300);
  if (id === 'q3') setTimeout(() => openPanel('end'), 400);
}
function talk(id, auto) { if (!G) return; if (auto && PANEL) return; openPanel('talk', id); }

/* ---------- 처음 화면 ---------- */
let TSEL = 'warden';
function portrait(cls, w) { const c = document.createElement('canvas'), d = 2; c.width = w * d; c.height = w * 1.07 * d; const g = c.getContext('2d'); if (IM[cls]) g.drawImage(IM[cls], 0, 2 * HC[1], HC[0], HC[1], 0, 0, c.width, c.height); return c; }
function title() {
  PANEL = 'title'; panel.hidden = false; ov.classList.remove('play');
  const sv = { warden: loadSave('warden'), windcaller: loadSave('windcaller') }, s = sv[TSEL];
  panel.innerHTML = `<div class="sk-bx sk-title"><button class="sk-x" data-a="quit" aria-label="나가기">✕</button><div class="t">끊어진 하늘</div><div class="s">맛보기판 · 1장 민들레 섬</div><p style="font-size:13px;line-height:1.7;color:#5a4a36;margin:4px 0">${STORY_INTRO.map(esc).join('<br>')}</p><div class="sk-cls">${Object.keys(CLASSES).map(k => `<div class="sk-cl${TSEL === k ? ' on' : ''}" data-a="pick" data-cls="${k}"><span data-po="${k}"></span><b>${CLASSES[k].name}</b><small>${esc(CLASSES[k].desc)}</small><small style="color:#3a7fa8;margin-top:4px">${sv[k] ? '기록: ' + sv[k].lv + '레벨' : '새 이음꾼'}</small></div>`).join('')}</div>
    ${s ? `<button class="sk-b p" data-a="start" data-n="0">이어하기 (${s.lv}레벨)</button><button class="sk-b" data-a="start" data-n="1">처음부터 (기록 지움)</button>` : `<button class="sk-b p" data-a="start" data-n="1">이 직업으로 시작</button>`}
    <p style="font-size:11px;color:#8a7458;margin:8px 0 0">기록은 이 기기에 저장돼요. 직업마다 따로 저장돼요.</p></div>`;
  panel.querySelectorAll('[data-po]').forEach(el => el.replaceWith(portrait(el.dataset.po, 120))); bindPanel();
}
function startFrom(fresh) {
  if (fresh && loadSave(TSEL) && !panel.querySelector('[data-sure]')) { const b = panel.querySelector('[data-n="1"]'); b.dataset.sure = 1; b.textContent = '정말 지울까요? 한 번 더 누르면 지워져요'; return; }
  const S = fresh ? newSave(TSEL) : loadSave(TSEL); PANEL = null; panel.hidden = true; panel.innerHTML = ''; ov.classList.add('play'); MINI = null;
  startGame(S); save(); last = performance.now();
}

/* ---------- 반복 ---------- */
function loop(t) {
  raf = requestAnimationFrame(loop); const dt = Math.min(.1, (t - last) / 1000); last = t;
  if (G && !PANEL) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; } if (n === 6) acc = 0; }
  draw();
}
function fs() { const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return; const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return; try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(() => layout()).catch(() => {}); } catch (e) {} }
function open() { ov.hidden = false; document.documentElement.style.overflow = 'hidden'; layout(); audioInit(); if (TOUCH.on) fs(); G = null; assets().then(() => { layout(); title(); }); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
function close() { save(); cancelAnimationFrame(raf); ov.hidden = true; document.documentElement.style.overflow = ''; panel.hidden = true; PANEL = null; if (A.ctx) A.ctx.suspend(); const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} } const P = G && G.P; G = null; opts.onExit && opts.onExit(P ? { lv: P.lv, cls: P.cls } : null); }
window.SkyGame = {
  boot(o) { opts = o || {}; if (!ov) mkDom(); assets();
    if (DEBUG) window.__sky = { open, G: () => G, start(cls, fresh) { TSEL = cls || 'warden'; startFrom(fresh !== false); }, step(n) { for (let i = 0; i < n; i++) update(STEP); }, draw, god(b) { G.god = b; }, tp(x2, y2) { G.P.x = x2; G.P.y = y2; G.cam = [x2, y2]; }, panel: openPanel, close: closePanel, give(id, r) { addInv(makeItem(id, r || 0, 5)); }, goods(g, n) { addInv(goods(g, n)); }, lv(n) { gainXp(xpNeed(G.P.lv) * n); }, keys: KEYS, press, talk, layout };
    return { open }; },
};
})();
