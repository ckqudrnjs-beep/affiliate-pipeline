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
  drifter: { name: '떠돌이 검객', desc: '두 자루 칼로 빠르게 베고, 몸을 흘려 피한 뒤 되받아쳐요.', stat: { str: 12, agi: 14, vit: 9, spi: 5 }, melee: 1, range: 1.25, aspd: 1.85, col: '#ff9a7a' },
  windcaller: { name: '바람술사', desc: '바람과 번개를 다루는 술사. 멀리서 몰아치고, 구름으로 몸을 지켜요.', stat: { str: 6, agi: 9, vit: 9, spi: 15 }, melee: 0, range: 6, aspd: 1.25, col: '#9fe4ff' },
  trapper: { name: '덫사냥꾼', desc: '석궁과 덫으로 거리를 두고 싸워요. 덫에 걸린 적은 꼼짝 못 해요.', stat: { str: 8, agi: 14, vit: 9, spi: 9 }, melee: 0, range: 7, aspd: 1.15, main: 'agi', col: '#c6e07a' },
  ringer: { name: '종지기', desc: '망치로 종을 울려 파동을 퍼뜨려요. 메아리 분신을 불러 함께 싸워요.', stat: { str: 12, agi: 7, vit: 13, spi: 8 }, melee: 1, range: 1.45, aspd: 1.2, col: '#c9a8ff' },
};
// 시작 장비·첫 스킬·유니크(직업별)
const CLS_START = { warden: ['spear0', 'shield0', 'pierce', 'armor1', 'u_late'], windcaller: ['staff0', 'bell0', 'gust', 'cloak1', 'u_cloudfan'], drifter: ['sword0', 'dagger0', 'slash3', 'cloak1', 'u_twin'], trapper: ['xbow0', 'trapbox0', 'pshot', 'cloak1', 'u_hawkeye'], ringer: ['hammer0', 'gong0', 'toll', 'armor1', 'u_dawnbell'] };
const STATS = [['str', '힘', '근접 피해 +1%, 무거운 장비 조건'], ['agi', '민첩', '공격 속도·치명타·회피(덫사냥꾼은 피해 +1%)'], ['vit', '인내', '생명력 +4, 상태이상 저항'], ['spi', '숨', '바람 +2·회복, 마법 피해 +1%']];

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
  drifter: [
    { id: 'slash3', name: '연속 베기', br: 0, req: 1, cost: 5, cd: .55, m: .7, ml: .08, t: 'combo', r: 1.7, arc: 1.9, desc: '앞쪽을 세 번 빠르게 베어요(한 번에 70%).',
      fork: [['네 번째 베기', '마지막에 한 번 더, 크게 베어요(200%).'], ['베어 가르기', '범위가 넓어지고 맞은 적이 3초 동안 피를 흘려요.']] },
    { id: 'whirl', name: '칼바람 돌기', br: 0, req: 4, cost: 9, cd: 4, m: .5, ml: .05, t: 'whirl', r: 1.7, dur: 1.2, desc: '1.2초 동안 돌며 둘레를 계속 베어요. 도는 동안 움직일 수 있어요.',
      fork: [['긴 돌기', '2초 동안 돌아요.'], ['끌어당기는 칼바람', '둘레 적을 안쪽으로 끌어당겨요.']] },
    { id: 'dashcut', name: '바람 가르기', br: 1, req: 2, cost: 6, cd: 3.5, m: 1.3, ml: .1, t: 'dashcut', len: 3.5, desc: '앞으로 빠르게 내달리며 길목의 적을 모두 베어요. 달리는 동안 맞지 않아요.',
      fork: [['되돌아 가르기', '잠시 뒤 제자리로 되돌아오며 한 번 더 베어요.'], ['잔상', '지나간 길에 칼바람이 2초 동안 남아요.']] },
    { id: 'parry', name: '흘려 받기', br: 1, req: 6, cost: 8, cd: 9, m: 2.5, ml: .15, t: 'parry', dur: 1.2, desc: '1.2초 동안 자세를 잡아요. 그 사이 맞으면 피해를 흘려 내고 둘레를 크게 되받아쳐요(250%).',
      fork: [['세 번 되받기', '되받아치기가 세 번 베어요.'], ['바람 몸놀림', '받아넘긴 뒤 5초 동안 공격 속도 +40%.']] },
    { id: 'mark', name: '약점 찌르기', br: 2, req: 3, cost: 6, cd: 6, m: 1.6, ml: .1, t: 'mark', dur: 6, desc: '한 적을 깊게 찔러 6초 동안 받는 피해가 30% 늘어요.',
      fork: [['깊은 상처', '표식 동안 피를 흘려요.'], ['표식 옮기기', '표식이 붙은 적이 쓰러지면 가까운 적에게 옮겨 가요.']] },
    { id: 'shadow', name: '그림자 베기', br: 2, req: 8, cost: 14, cd: 14, m: 1.0, ml: .08, t: 'shadow', jumps: 5, desc: '그림자처럼 사라졌다 나타나며 둘레 적 다섯을 차례로 베어요. 그동안 맞지 않아요.',
      fork: [['일곱 번 베기', '일곱까지 베어요.'], ['마무리 일격', '끝에 둘레를 크게 베어요(250%).']] },
  ],
  trapper: [
    { id: 'pshot', name: '꿰뚫는 화살', br: 0, req: 1, cost: 4, cd: .7, m: 1.4, ml: .1, t: 'pshot', desc: '적을 꿰뚫고 날아가는 화살.',
      fork: [['세 발 쏘기', '세 갈래로 쏴요(한 발에 70%).'], ['무거운 화살', '피해 +30%, 맞은 적을 크게 밀어내요.']] },
    { id: 'rain', name: '화살비', br: 0, req: 4, cost: 10, cd: 4, m: .32, ml: .04, t: 'rain', r: 2.2, dur: 1.6, desc: '적이 모인 곳에 1.6초 동안 화살비를 퍼부어요.',
      fork: [['넓은 화살비', '범위가 40% 넓어져요.'], ['긴 화살비', '3초 동안 내려요.']] },
    { id: 'trap', name: '덫 놓기', br: 1, req: 2, cost: 6, cd: 1.5, m: 1.8, ml: .12, t: 'trap', dur: 20, desc: '발밑에 덫을 놓아요(최대 3개). 밟은 적은 크게 다치고 2초 동안 묶여요.',
      fork: [['터지는 덫', '터지며 둘레 적도 함께 때려요.'], ['얽는 덫', '3.5초 동안 묶고, 풀린 뒤에도 느려요.']] },
    { id: 'net', name: '그물 던지기', br: 1, req: 6, cost: 10, cd: 8, m: .5, ml: .05, t: 'net', r: 2, desc: '그물을 던져 그 자리 적을 1초 묶고 4초 동안 느리게 해요.',
      fork: [['끈끈이 그물', '2.5초 동안 묶어요.'], ['가시 그물', '4초 동안 안에서 계속 다쳐요.']] },
    { id: 'roll', name: '물러나 쏘기', br: 2, req: 3, cost: 5, cd: 5, m: 1.1, ml: .08, t: 'roll', desc: '뒤로 굴러 물러나며 가장 가까운 적에게 화살을 쏴요.',
      fork: [['덫 남기기', '떠난 자리에 덫을 놓아요.'], ['연속 사격', '물러나며 세 발을 쏴요.']] },
    { id: 'hawk', name: '매 부르기', br: 2, req: 8, cost: 12, cd: 18, m: .7, ml: .06, t: 'hawk', dur: 12, desc: '12초 동안 매가 함께 날며 1초마다 적을 덮쳐요.',
      fork: [['매 두 마리', '두 마리가 와요.'], ['사냥매', '매가 덮친 적은 받는 피해가 20% 늘어요.']] },
  ],
  ringer: [
    { id: 'toll', name: '큰 종 내리치기', br: 0, req: 1, cost: 5, cd: .9, m: 1.3, ml: .1, t: 'toll', r: 1.5, desc: '앞쪽 땅을 망치로 내리쳐 종소리로 둘레를 때려요.',
      fork: [['여운', '맞은 자리에 3초 동안 떨림이 남아 계속 때려요.'], ['겹울림', '한 번 더 내리쳐요(두 번째는 범위가 좁아요).']] },
    { id: 'wave', name: '울림 파동', br: 0, req: 4, cost: 9, cd: 3, m: 1.0, ml: .08, t: 'wave', r: 3.6, desc: '종을 울려 둥글게 퍼지는 파동으로 둘레 적을 밀어내요.',
      fork: [['세 겹 파동', '파동이 세 번 퍼져요(한 번에 60%).'], ['멀리 울림', '반경이 50% 넓어져요.']] },
    { id: 'echo', name: '메아리 분신', br: 1, req: 2, cost: 10, cd: 10, m: .6, ml: .06, t: 'echo', dur: 8, desc: '8초 동안 메아리 분신이 나와 1초마다 둘레를 울려요.',
      fork: [['두 메아리', '분신이 둘 나와요.'], ['터지는 메아리', '사라질 때 큰 파동을 내요(200%).']] },
    { id: 'resound', name: '되울림', br: 1, req: 6, cost: 8, cd: 6, m: .9, ml: .08, t: 'resound', r: 2.4, desc: '나와 모든 메아리 분신이 한꺼번에 울려 둘레를 때려요.',
      fork: [['깊은 되울림', '맞은 적이 1초 기절해요.'], ['메아리 부르기', '분신이 3초 더 머물러요.']] },
    { id: 'clang', name: '쇳소리', br: 2, req: 3, cost: 6, cd: 8, m: .6, ml: .05, t: 'clang', r: 2.6, desc: '날카로운 쇳소리로 둘레 적을 1.5초 기절시켜요.',
      fork: [['긴 기절', '2.5초 동안 기절해요.'], ['깨지는 소리', '맞은 적이 6초 동안 받는 피해가 20% 늘어요.']] },
    { id: 'dome', name: '종 덮개', br: 2, req: 8, cost: 12, cd: 16, m: 0, ml: 0, t: 'dome', dur: 5, desc: '5초 동안 커다란 종 그림자가 감싸 받는 피해가 50% 줄어요.',
      fork: [['울리는 덮개', '맞을 때마다 둘레에 작은 파동이 퍼져요.'], ['굳은 덮개', '피해가 70% 줄어요.']] },
  ],
};
// 궁극 기술: 6레벨에 저절로 익히고 4번 칸에 놓인다(점수 안 씀)
const ULT = {
  warden: { id: 'ult', name: '땅울림 말뚝', br: 3, req: 6, cost: 0, cd: 40, t: 'ult', desc: '높이 뛰어올라 창을 땅에 내리꽂아요. 둘레 적을 크게 튕겨 내고 기절시켜요. 섬 끝이라면 우수수 떨어져요.' },
  drifter: { id: 'ult', name: '천 갈래 바람베기', br: 3, req: 6, cost: 0, cd: 40, t: 'ult', desc: '바람이 되어 둘레 적 사이를 휘저으며 열두 번 베어요. 그동안 맞지 않아요.' },
  trapper: { id: 'ult', name: '사냥터 열기', br: 3, req: 6, cost: 0, cd: 40, t: 'ult', desc: '둘레에 덫 여섯 개를 둥글게 깔고, 3초 동안 넓게 화살비를 퍼부어요.' },
  ringer: { id: 'ult', name: '하늘 종', br: 3, req: 6, cost: 0, cd: 40, t: 'ult', desc: '하늘에서 커다란 종을 떨어뜨려 둘레 적을 크게 때리고 2초 기절시켜요. 이어서 종소리가 세 번 더 울려요.' },
  windcaller: { id: 'ult', name: '큰바람 한 숨', br: 3, req: 6, cost: 0, cd: 40, t: 'ult', desc: '커다란 소용돌이로 둘레 적을 빨아들여 계속 때린 뒤, 한꺼번에 멀리 날려 버려요.' },
};
const skillOf = (cls, id) => id === 'ult' ? ULT[cls] : SKILLS[cls].find(q => q.id === id);
const BRANCH = { warden: ['창', '방패', '함성'], drifter: ['칼날', '바람걸음', '그림자'], windcaller: ['바람', '번개', '구름'], trapper: ['사격', '덫', '사냥'], ringer: ['울림', '메아리', '쇳소리'] };

/* ---------- 장비 ---------- */
const SLOTS = [['weapon', '무기'], ['off', '보조'], ['helm', '투구'], ['armor', '상의'], ['legs', '하의'], ['inner', '안감'], ['cloak', '망토'], ['gloves', '장갑'], ['belt', '허리띠'], ['boots', '장화'], ['amulet', '목걸이'], ['ear', '귀걸이'], ['ring1', '반지'], ['ring2', '반지'], ['sail', '돛']];
const SLOTN = Object.fromEntries(SLOTS);
// 기본 장비. ic: 그림 칸, dmg: [작은 적 최소,최대, 큰 적 최소,최대], ac: 방어력, req: {lv,str…}, cls
const BASES = [
  { id: 'spear0', n: '나무 창', s: 'weapon', ic: 'spear', cls: 'warden', dmg: [3, 7, 4, 8], spd: 1, lv: 1 },
  { id: 'spear1', n: '목동의 창', s: 'weapon', ic: 'spear', cls: 'warden', dmg: [3, 8, 4, 10], spd: 1, lv: 4 },
  { id: 'spear2', n: '쇠끝 창', s: 'weapon', ic: 'spear2', cls: 'warden', dmg: [5, 11, 6, 13], spd: .95, lv: 8, req: { str: 20 } },
  { id: 'staff0', n: '버드나무 지팡이', s: 'weapon', ic: 'staff', cls: 'windcaller', dmg: [3, 6, 3, 7], spd: 1, lv: 1 },
  { id: 'staff1', n: '바람개비 지팡이', s: 'weapon', ic: 'staff2', cls: 'windcaller', dmg: [3, 7, 3, 8], spd: 1, lv: 4, fix: { spi: 1 } },
  { id: 'staff2', n: '종이연 지팡이', s: 'weapon', ic: 'staff2', cls: 'windcaller', dmg: [4, 10, 5, 11], spd: 1.05, lv: 8, req: { spi: 22 } },
  { id: 'sword0', n: '나그네 쌍칼', s: 'weapon', ic: 'sword', cls: 'drifter', dmg: [2, 6, 3, 7], spd: 1, lv: 1 },
  { id: 'sword1', n: '갈대 쌍칼', s: 'weapon', ic: 'sword', cls: 'drifter', dmg: [3, 7, 3, 8], spd: 1.05, lv: 4 },
  { id: 'sword2', n: '서릿날 쌍칼', s: 'weapon', ic: 'sword2', cls: 'drifter', dmg: [4, 9, 5, 10], spd: 1.05, lv: 8, req: { agi: 22 } },
  { id: 'xbow0', n: '나무 석궁', s: 'weapon', ic: 'xbow', cls: 'trapper', dmg: [3, 7, 3, 7], spd: 1, lv: 1 },
  { id: 'xbow1', n: '사냥꾼 석궁', s: 'weapon', ic: 'xbow', cls: 'trapper', dmg: [3, 8, 4, 9], spd: 1, lv: 4 },
  { id: 'xbow2', n: '하늘매 석궁', s: 'weapon', ic: 'xbow2', cls: 'trapper', dmg: [5, 11, 5, 12], spd: 1, lv: 8, req: { agi: 22 } },
  { id: 'hammer0', n: '종 치는 망치', s: 'weapon', ic: 'hammer', cls: 'ringer', dmg: [4, 8, 5, 9], spd: 1, lv: 1 },
  { id: 'hammer1', n: '쇠테 망치', s: 'weapon', ic: 'hammer', cls: 'ringer', dmg: [4, 9, 5, 11], spd: .95, lv: 4 },
  { id: 'hammer2', n: '새벽 망치', s: 'weapon', ic: 'hammer2', cls: 'ringer', dmg: [6, 12, 7, 14], spd: .95, lv: 8, req: { str: 20 } },
  { id: 'dagger0', n: '짧은 칼', s: 'off', ic: 'dagger', cls: 'drifter', ac: 1, fix: { crit: 2 }, lv: 1 },
  { id: 'dagger1', n: '바람칼', s: 'off', ic: 'dagger', cls: 'drifter', ac: 1, fix: { aspd: 6 }, lv: 6 },
  { id: 'trapbox0', n: '덫 상자', s: 'off', ic: 'trapbox', cls: 'trapper', ac: 1, fix: { wreg: 8 }, lv: 1 },
  { id: 'trapbox1', n: '쇠이빨 덫 상자', s: 'off', ic: 'trapbox', cls: 'trapper', ac: 2, fix: { agi: 2 }, lv: 6 },
  { id: 'gong0', n: '손종', s: 'off', ic: 'gong', cls: 'ringer', ac: 2, fix: { hp: 8 }, lv: 1 },
  { id: 'gong1', n: '청동 손종', s: 'off', ic: 'gong', cls: 'ringer', ac: 3, fix: { vit: 2 }, lv: 6 },
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
  { id: 'legs0', n: '무명 바지', s: 'legs', ic: 'legs0', ac: 1, lv: 1 },
  { id: 'legs1', n: '가죽 바지', s: 'legs', ic: 'legs1', ac: 3, lv: 4 },
  { id: 'legs2', n: '쇠미늘 다리싸개', s: 'legs', ic: 'legs2', ac: 5, lv: 8, req: { str: 18 } },
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
  shell: { n: '둥지 껍질', ic: 'glue', d: '둥지지기의 단단한 껍질. 다리 받침으로 써요', quest: 1 },
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
const NM2 = { weapon: ['찌르개', '바늘', '가시', '꼬챙이'], weaponS: ['가지', '회초리', '부지깽이', '지휘봉'], weaponD: ['쌍날', '칼바람', '두 갈래'], weaponT: ['석궁', '활시위', '매부리'], weaponR: ['망치', '종채', '쇠메'], off: ['울', '덮개', '방울', '등딱지'], helm: ['머리쓰개', '갓', '고깔'], armor: ['겉옷', '두루마기', '가죽옷'], legs: ['바지', '다리싸개', '잠방이'], inner: ['속옷', '내의'], cloak: ['날개', '두름', '자락'], gloves: ['손싸개', '토시'], belt: ['띠', '고리'], boots: ['발싸개', '걸음', '신'], amulet: ['매듭', '부적'], ear: ['방울', '고리'], ring: ['가락지', '고리'], sail: ['돛폭', '날개천'] };
// 전해진 장비(맛보기판 2종) · 한 벌(민들레 나그네 3종)
const UNIQ = [
  { id: 'u_late', n: '늦바람', base: 'spear1', story: '다리가 끊기던 날 섬 끝에 꽂혀 있던 창. 아직도 그날 바람이 남아 있다.', fx: [['dmgp', 30], ['kb', 100], ['windk', 3], ['agi', 3]], lv: 6 },
  { id: 'u_twin', n: '쌍둥이 바람', base: 'sword1', story: '갈라진 섬 양쪽에서 하나씩 찾았다는 칼 두 자루. 맞대면 휘파람 소리가 난다.', fx: [['dmgp', 25], ['aspd', 15], ['crit', 6], ['agi', 3]], lv: 6 },
  { id: 'u_hawkeye', n: '매눈', base: 'xbow1', story: '늙은 매사냥꾼이 남긴 석궁. 시위를 당기면 멀리 있는 것이 가까이 보인다.', fx: [['dmgp', 25], ['crit', 8], ['windk', 2], ['sk1', 1]], lv: 6 },
  { id: 'u_dawnbell', n: '새벽 종치기', base: 'hammer1', story: '다리가 끊기던 날 아침, 이 망치로 친 종소리를 듣고 사람들이 섬 안쪽으로 달아났다.', fx: [['dmgp', 25], ['hp', 30], ['vit', 4], ['sk0', 1]], lv: 6 },
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
  fluff: { n: '보풀이', hp: [8, 4], dmg: [2, 4, .9], spd: 1.6, r: .3, sz: 0, xp: [6, 3], atk: 1, ai: 'melee', spr: 'fluff', desc: '구름 밑 먼지가 엉겨 붙은 털 뭉치. 떼로 몰려와 물어뜯어요.' },
  seed: { n: '가시씨앗', hp: [14, 6], dmg: [3, 6, 1.3], spd: 1.15, r: .32, sz: 1, xp: [10, 4], atk: 1.2, ai: 'charge', spr: 'seed', desc: '시든 껍질에 붉은 가시가 돋은 꼬투리. 쩍 벌린 입으로 들이받아요.' },
  bird: { n: '바람도둑', hp: [7, 3], dmg: [2, 4, .8], spd: 2.5, r: .28, sz: 0, xp: [7, 3], atk: .9, ai: 'dive', fly: 1, spr: 'bird', desc: '너덜너덜한 검은 깃의 새. 남의 바람을 훔쳐 날아요. 맞으면 바람이 줄어요.' },
  fluffking: { n: '우두머리 보풀', hp: [520, 0], dmg: [8, 14, 0], spd: 1.1, r: .9, sz: 1, xp: [400, 0], atk: 2.2, ai: 'boss', boss: 1, big: 1, spr: 'fluffking', desc: '들판의 바람을 혼자 다 먹어 치운 커다란 보풀이. 뿔 왕관을 쓰고 보풀이를 부려요.' },
  mudfluff: { n: '진흙 보풀이', hp: [16, 6], dmg: [4, 7, 1.1], spd: 1.35, r: .34, sz: 0, xp: [9, 4], atk: 1.1, ai: 'melee', spr: 'mudfluff', desc: '늪 진흙을 뒤집어쓴 보풀이. 둔하지만 질기고 세게 물어요.' },
  bogpod: { n: '늪 꼬투리', hp: [14, 5], dmg: [4, 7, 1.1], spd: .9, r: .32, sz: 1, xp: [11, 4], atk: 2.2, ai: 'spit', spr: 'bogpod', desc: '갈대 사이에 숨은 꼬투리. 거리를 두고 진흙 덩이를 뱉어요.' },
  heronling: { n: '왜가리 새끼', hp: [10, 4], dmg: [3, 6, 1], spd: 2.6, r: .28, sz: 0, xp: [9, 4], atk: .9, ai: 'dive', fly: 1, spr: 'heronling', desc: '큰 왜가리가 거느린 잿빛 새끼들. 떼로 내리꽂아요.' },
  heron: { n: '큰 왜가리', hp: [1500, 0], dmg: [13, 21, 0], spd: 1.25, r: 1, sz: 1, xp: [1200, 0], atk: 2.2, ai: 'boss', boss: 1, big: 1, heron: 1, spr: 'heron', desc: '큰바람이 멎던 날 둥지섬에 내려앉은 거대한 잿빛 새. 섬의 남은 바람을 날개 밑에 모아 두고 있어요.' },
  keeper: { n: '둥지지기', hp: [70, 20], dmg: [5, 9, 1.4], spd: 1.05, r: .55, sz: 1, xp: [60, 22], atk: 1.8, ai: 'boss', mini: 1, big: 1, spr: 'keeper', desc: '밑것 둥지를 지키는 껍질 짐승. 둥지 둘레의 땅을 시들게 해요. 쓰러뜨리면 둥지가 걷혀요.' },
};
const ELITE = [['빠른', '#9fe4ff', { spd: 1.4 }], ['단단한', '#ffd27a', { hp: 2.2 }], ['바람 두른', '#c9a8ff', { kbimm: 1, hp: 1.5 }], ['성난', '#ff8f7a', { dmg: 1.5 }]];

/* ---------- 나침반판(모든 직업 공통 육각 판 19칸) ---------- */
// 바람 조각: 색(하늘·들불·새싹) × 품질 1~3. 둘레의 같은 색 조각 1개마다 +25%, 가운데 '바람눈' 칸은 1.5배.
// 같은 색이 3개 이상 이어지면 그 색 보너스, 세 색 보너스가 다 켜지면 '세 바람' 보너스.
const SHARD = {
  sky: { n: '하늘', c: '#5fb4f0', fx: [['wreg', 4], ['wind', 2]], set: [['wind', 8], ['wreg', 8]], d: '바람 회복·최대 바람' },
  fire: { n: '들불', c: '#f0784a', fx: [['dmgp', 2]], set: [['crit', 3], ['dmgp', 4]], d: '피해' },
  leaf: { n: '새싹', c: '#74c45a', fx: [['hp', 5]], set: [['ac', 4], ['hp', 12]], d: '생명력 (잇기: 방어력)' },
};
const SHQ = ['', '조각', '맑은 조각', '빛나는 조각'], TRIO = [['xp', 8], ['find', 10]], BOARD_LV = 3, SHD_MAX = 30;
const HEX = []; for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) HEX.push([q, r]);
const HEXN = HEX.map(([q, r]) => HEX.map(([a, b], j) => Math.abs(a - q) + Math.abs(b - r) + Math.abs(a + b - q - r) === 2 ? j : -1).filter(j => j >= 0));
const HEXC = HEX.findIndex(([q, r]) => !q && !r);

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
  q5: { n: '갈대 늪 가는 다리', from: 'chief', goal: '둥지지기를 쓰러뜨려 둥지 껍질 3개를 모아 언덕 동쪽 다리를 고치기', need: 3,
    talk: ['바람개비 언덕 동쪽으로 갈대 늪 가는 다리가 있었지. 그것마저 끊겼다네.', '둥지지기 껍질은 돌처럼 단단해서 다리 받침으로 그만이야. 세 개만 모아 다리를 다시 놓아 주게.', '늪을 지나면 둥지섬일세. 큰 날개 그림자가 내려앉은 곳이지.'],
    done: ['갈대 늪까지 길이 열렸구먼! 저 늪 끝 둥지섬… 조심하게, 이음꾼.'] },
  q6: { n: '갈대 늪 정리', from: 'sage', goal: '갈대 늪의 밑것 20마리 쓰러뜨리기', need: 20,
    talk: ['갈대 늪엔 진흙 보풀이랑 꼬투리가 들끓는대. 꼬투리는 멀리서 진흙을 뱉으니까 가까이 붙어서 혼내 줘.', '스무 마리쯤 줄이면 늪 바람이 맑아질 거야.'],
    done: ['늪에서 바람 냄새가 나기 시작했어. 고마워, 이건 내가 아끼던 귀걸이야.'] },
  q7: { n: '둥지섬의 큰 왜가리', from: 'chief', goal: '둥지섬의 큰 왜가리를 쓰러뜨리고 둥지섬 바람개비 표지에 손 얹기', need: 1,
    talk: ['둥지섬의 큰 왜가리가 날개 밑에 섬의 바람을 모조리 감춰 두었다네. 그래서 민들레 섬이 가라앉는 게야.', '녀석은 부리로 찌르고, 날개로 밀쳐 내고, 새끼들을 불러. 성이 나면 하늘에서 깃털을 퍼붓는다지.', '섬 끝으로 밀려나지 않게 조심하게. 녀석을 쓰러뜨리면 민들레 섬에 다시 숨이 돌 걸세.'],
    done: ['…들리나? 섬 밑에서 바람이 올라오는 소리. 민들레 섬이 가라앉기를 멈췄어!', '자네 덕일세, 이음꾼. 허나 큰바람이 멎은 까닭은 아직 저 너머, 녹슨 풍차 군도에 있다는 소문이야.'] },
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
  const W = 152, H = 84, R = srand(seed), nz = noise2(seed + 7), nz2 = noise2(seed + 13);
  const g = new Uint8Array(W * H), isl = new Int16Array(W * H).fill(-1), depth = new Float32Array(W * H);
  const id = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const islands = [];
  // 섬 모양 = 각도마다 반지름이 다른 둥근 땅(잡음). 칸은 가운데 점이 땅 안이면 땅.
  const shape = (s, x, y) => { const dx = x - s.cx, dy = y - s.cy, a = Math.atan2(dy, dx); return s.r * (1 + .18 * Math.sin(a * 3 + s.ph) + .12 * Math.sin(a * 5 + s.ph * 2) + .07 * Math.sin(a * 11 + s.ph * 3) + .22 * (nz(x * .15, y * .15) - .5)); };
  function blob(cx, cy, r, kind) {
    const k = islands.length, s = { cx, cy, r, kind, k, ph: R() * 10 }; islands.push(s);
    for (let y = Math.floor(cy - r * 1.6); y <= cy + r * 1.6; y++) for (let x = Math.floor(cx - r * 1.6); x <= cx + r * 1.6; x++) {
      if (!inb(x, y)) continue; const d = Math.hypot(x + .5 - cx, y + .5 - cy), rr = shape(s, x + .5, y + .5);
      if (d < rr) { g[id(x, y)] = 1; isl[id(x, y)] = k; depth[id(x, y)] = 1 - d / rr; }
    }
    return k;
  }
  // 섬 배치(맛보기판): 마을 섬 → 들판 섬 4~5개 → (끊어진 다리) → 바람개비 언덕
  const town = blob(16, 42, 10.5, 'town');
  const F = [[34, 30, 8], [37, 54, 8.5], [53, 40, 9], [62, 22, 7.5], [66, 60, 7.5]].map(([x, y, r]) => [x + R() * 3 - 1.5, y + R() * 3 - 1.5, r + R() * 1.2]);
  const fi = F.map(([x, y, r]) => blob(x, y, r, 'field'));
  const hill = blob(86, 30, 8.5, 'hill');
  // 1장 뒷부분: 언덕 너머 갈대 늪 섬 3개 → 둥지섬(큰 왜가리)
  const mi = [[105, 20, 7.5], [109, 47, 8.2], [126, 31, 8]].map(([x, y, r]) => blob(x, y, r, 'marsh'));
  const nestI = blob(143, 54, 9, 'heron');
  // 작은 떠돌이 바위섬(장식)
  for (let i = 0; i < 11; i++) { const x = 10 + R() * 135, y = 6 + R() * 74; let ok = true; for (const s of islands) if (Math.hypot(s.cx - x, s.cy - y) < s.r + 5) ok = false; if (ok) blob(x, y, 1.6 + R() * 1.4, 'rock'); }
  // 다리: 두 섬 사이를 x축 → y축 순서로 잇는 2칸 너비 길. 빈칸만 다리로 바꾼다.
  const bridges = [];
  function bridge(a, b, broken) {
    const A = islands[a], B = islands[b], cells = [];
    let x = Math.round(A.cx), y = Math.round(A.cy); const tx = Math.round(B.cx), ty = Math.round(B.cy);
    const put = (x, y) => { for (const [ox, oy] of [[0, 0], [0, 1], [1, 0]]) { const X = x + ox, Y = y + oy; if (!inb(X, Y)) continue; const i = id(X, Y); if (g[i] === 0) { g[i] = broken ? 4 : 3; cells.push(i); } else if (g[i] !== 3 && g[i] !== 4) land.push(i); } }, land = [];
    const vert = Math.abs(ty - y) > Math.abs(tx - x);
    if (!vert) { while (x !== tx) { put(x, y); x += Math.sign(tx - x); } while (y !== ty) { put(x, y); y += Math.sign(ty - y); } }
    else { while (y !== ty) { put(x, y); y += Math.sign(ty - y); } while (x !== tx) { put(x, y); x += Math.sign(tx - x); } }
    // 다리 끝은 땅 쪽으로 1~2칸 더 깐다(둥근 섬 가장자리와 이어지게)
    const ends = land.filter(i => { const X = i % W, Y = (i / W) | 0; for (let yy = Y - 2; yy <= Y + 2; yy++) for (let xx = X - 2; xx <= X + 2; xx++) if (inb(xx, yy) && (g[id(xx, yy)] === 3 || g[id(xx, yy)] === 4) && Math.hypot(xx - X, yy - Y) < 2.2) return true; return false; });
    bridges.push({ a, b, cells, ends, broken: !!broken }); return bridges.length - 1;
  }
  bridge(town, fi[0]); bridge(town, fi[1]); bridge(fi[0], fi[2]); bridge(fi[1], fi[2]); bridge(fi[2], fi[3]); bridge(fi[2], fi[4]);
  const bq = bridge(fi[3], hill, true);
  const bq2 = bridge(hill, mi[0], true); bridge(mi[0], mi[1]); bridge(mi[1], mi[2]); bridge(mi[2], nestI);
  // 길(흙): 마을 광장, 다리 입구 쪽 흙길
  const tI = islands[town];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = id(x, y); if (g[i] !== 1) continue;
    const dT = Math.hypot(x - tI.cx, y - tI.cy); if (isl[i] === town && dT < 3.2) g[i] = 5;
    else if (nz2(x * .22, y * .22) > (islands[isl[i]] && islands[isl[i]].kind === 'marsh' ? .58 : .7) && isl[i] !== town) { let ok = 1; for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (!inb(xx, yy) || !g[id(xx, yy)]) ok = 0; if (ok) g[i] = 2; } }
  const bm = new Uint8Array(W * H); for (const b of bridges) { for (const i of b.cells) bm[i] = 1; for (const i of b.ends) bm[i] = 2; }
  const Wd = { W, H, g, isl, depth, islands, bridges, bq, bq2, mi, nestI, town, fi, hill, id, inb, nz, seed, bm, shape };
  for (const s2 of islands) s2.poly = contour(Wd, s2);
  return Wd;
}
// 섬 둘레 점(월드 좌표): 각도마다 바깥으로 걸어가며 땅이 끝나는 곳
function contour(Wd, s) {
  const N = Math.round(clamp(s.r * 16, 36, 180)), out = [];
  for (let i = 0; i < N; i++) { const a = i / N * TAU, c = Math.cos(a), sn = Math.sin(a); let t = 0; while (t < s.r * 2 && Math.hypot(c * t, sn * t) < Wd.shape(s, s.cx + c * t, s.cy + sn * t)) t += .03; out.push([s.cx + c * t, s.cy + sn * t]); }
  return out;
}
function onLand(Wd, x, y) { // 정확한(둥근) 땅 판정
  const X = Math.floor(x), Y = Math.floor(y); let k = Wd.isl[Wd.id(X, Y)];
  if (k < 0) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!Wd.inb(X + ox, Y + oy)) continue; const k2 = Wd.isl[Wd.id(X + ox, Y + oy)]; if (k2 >= 0) { k = k2; break; } }
  if (k < 0) return false; const s = Wd.islands[k]; return Math.hypot(x - s.cx, y - s.cy) < Wd.shape(s, x, y);
}
const ground = (Wd, x, y) => { const X = Math.floor(x), Y = Math.floor(y); if (!Wd.inb(X, Y)) return 0; const i = Wd.id(X, Y), t = Wd.g[i]; if (Wd.bm[i]) return t === 4 ? 0 : 3; return onLand(Wd, x, y) ? (t || 1) : 0; };
const walk = (Wd, x, y) => { const X = Math.floor(x), Y = Math.floor(y); if (!Wd.inb(X, Y) || Wd.block && Wd.block[Wd.id(X, Y)]) return false; return ground(Wd, x, y) > 0; };

// 소품 배치. 소품 = {k: 아틀라스 키, x, y, foot}
function placeProps(Wd, PM) {
  const R = srand(Wd.seed + 99), props = [], block = Wd.block = new Uint8Array(Wd.W * Wd.H);
  const free = (x, y, r) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) { if (!Wd.inb(xx, yy)) return false; const t = Wd.g[Wd.id(xx, yy)]; if (t !== 1 && t !== 2 || block[Wd.id(xx, yy)] === 2) return false; } return true; };
  const add = (k, x, y, solid) => { const m = PM[k]; if (!m) return; const foot = m[6] * (/^(home|tavern|market|smithy|windmill|ruin|grain)/.test(k) ? .62 : 1);
    // 섬 가장자리에 걸치지 않게 안쪽으로 당김
    { const X0 = Math.floor(x), Y0 = Math.floor(y), kk = Wd.isl[Wd.id(X0, Y0)], S = Wd.islands[kk >= 0 ? kk : 0], rr = foot + .9; for (let n = 0; n < 16; n++) { let ok = true; for (let j = 0; j < 8; j++) { const a = j / 8 * TAU; if (!onLand(Wd, x + Math.cos(a) * rr, y + Math.sin(a) * rr)) { ok = false; break; } } if (ok) break; const dx = S.cx - x, dy = S.cy - y, d = Math.hypot(dx, dy) || 1; x += dx / d * .3; y += dy / d * .3; } }
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
  const M1 = Wd.islands[Wd.mi[1]], NI = Wd.islands[Wd.nestI]; Wd.wps.push({ n: '갈대 나루', x: M1.cx - 1.5, y: M1.cy + 2, on: 0 }, { n: '둥지섬', x: NI.cx - 3, y: NI.cy + 3.5, on: 0 });
  add('ruin', NI.cx + 3.5, NI.cy - 4); add('rock4', NI.cx - 4.5, NI.cy - 3); add('lumber', NI.cx + 4.5, NI.cy + 2.5);
  add('windmill', Hh.cx + 1.5, Hh.cy - 2.5); add('ruin', Hh.cx - 4, Hh.cy - 2.5); add('rock3', Hh.cx + 4, Hh.cy + 2);
  // 들판·언덕: 나무 무리·바위·통나무 더미
  const TREES = ['treesL', 'treesM', 'treesBL', 'treesBM', 'treesS', 'treesBS', 'tree1', 'tree2'], ROCK = ['rock1', 'rock2', 'rock3', 'rock4', 'rock5'];
  for (const s of Wd.islands) {
    if (s.kind === 'rock') { if (s.r > 2.2) add(ROCK[Math.floor(R() * 5)], s.cx, s.cy, true); continue; }
    if (s.kind === 'town') { for (let i = 0; i < 6; i++) { const a = R() * TAU, d = s.r * (.72 + R() * .2), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d, k = TREES[4 + Math.floor(R() * 4)], f = PM[k][6]; if (free(x, y, f)) add(k, x, y); } continue; }
    const n = s.kind === 'hill' ? 5 : s.kind === 'marsh' ? 5 : s.kind === 'heron' ? 3 : 9;
    for (let i = 0; i < n * 3 && n > 0; i++) { const a = R() * TAU, d = s.r * (.35 + R() * .6), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d;
      const r = R(), k = r < .55 ? TREES[Math.floor(R() * TREES.length)] : r < .85 ? ROCK[Math.floor(R() * ROCK.length)] : ['lumber', 'stone', 'crateO', 'barrel'][Math.floor(R() * 4)]; const f = PM[k][6];
      if (free(x, y, f)) add(k, x, y); }
  }
  // 작은 장식(덤불·버섯·그루터기·민들레 솜털): 길을 막지 않는 것은 통과 가능
  const DECO = [['bush1', 1], ['bush2', 1], ['bush1', 1], ['mush', 0], ['stump', 1], ['log', 1], ['reeds', 0], ['puffs', 0], ['puffs', 0], ['reeds', 0]];
  for (const s of Wd.islands) { if (s.kind === 'rock') continue; const n = s.kind === 'town' ? 6 : s.kind === 'hill' ? 8 : s.kind === 'marsh' ? 18 : 12;
    for (let i = 0; i < n * 3 && n; i++) { const a = R() * TAU, d = s.r * (.25 + R() * .68), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d, [k, sol] = s.kind === 'marsh' || s.kind === 'heron' ? (R() < .6 ? ['reeds', 0] : DECO[Math.floor(R() * DECO.length)]) : DECO[Math.floor(R() * DECO.length)];
      if (s.kind === 'town' && k === 'log') continue; const f = PM[k] ? PM[k][6] : .3; if (free(x, y, f + .2) && onLand(Wd, x, y)) add(k, x, y, !!sol); } }
  { const T2 = Wd.islands[Wd.town]; Wd.signAt = [T2.cx + 5.5, T2.cy + 5.2]; if (PM.sign) add('sign', T2.cx + 5.5, T2.cy + 5.2); }
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
  const R = srand(5), out = { grass: [], dirt: [], path: [], plaza: [], bridge: [], broken: [], tuft: [], flower: [] };
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
  if (rar === 2) it.nm = pick(NM1) + ' ' + pick(b.s === 'weapon' && ({ windcaller: NM2.weaponS, drifter: NM2.weaponD, trapper: NM2.weaponT, ringer: NM2.weaponR })[b.cls] || NM2[b.s] || ['물건']);
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
  boardMods(P, m);
  const st = {}; for (const [k] of STATS) st[k] = C.stat[k] + (P.sp[k] || 0) + (m[k] || 0);
  const S = P.st = st;
  P.mhp = Math.round(30 + S.vit * 4 + P.lv * 6 + (m.hp || 0));
  P.mwind = Math.round(18 + S.spi * 2 + P.lv * 2 + (m.wind || 0));
  P.ac = (m.ac || 0) + Math.floor(S.agi / 5) + (P.buf.shout ? 6 : 0);
  P.dmg = m.dmg || [1, 2, 1, 3]; if (m.mind) { P.dmg = P.dmg.slice(); P.dmg[0] += m.mind; P.dmg[2] += m.mind; }
  P.dmgp = (m.dmgp || 0) + (C.main ? S[C.main] : C.melee ? S.str : S.spi) + (P.buf.brave ? 25 : 0);
  P.aspd = C.aspd * (m.wspd || 1) * (1 + ((m.aspd || 0) + S.agi * .6) / 100) * (P.buf && P.buf.haste ? 1.4 : 1);
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

/* ---------- 나침반판 계산 ---------- */
function boardGroups(B) { // 같은 색으로 이어진 묶음들 [{c, cells}]
  const seen = new Set(), out = [];
  B.forEach((sh, i) => { if (!sh || seen.has(i)) return; const st = [i], cells = []; seen.add(i);
    while (st.length) { const j = st.pop(); cells.push(j); for (const n of HEXN[j]) if (!seen.has(n) && B[n] && B[n].c === sh.c) { seen.add(n); st.push(n); } }
    out.push({ c: sh.c, cells }); });
  return out;
}
function boardInfo(P) { // 칸마다 실제 효과 배율 + 켜진 묶음 보너스
  const B = P.board || [], mul = B.map((sh, i) => sh ? sh.q * (1 + .25 * HEXN[i].filter(n => B[n] && B[n].c === sh.c).length) * (i === HEXC ? 1.5 : 1) : 0);
  const sets = {}; for (const g of boardGroups(B)) if (g.cells.length >= 3) sets[g.c] = 1;
  return { mul, sets, trio: Object.keys(SHARD).every(c => sets[c]) };
}
function boardMods(P, m) {
  if (!P.board) return; const I = boardInfo(P), add = (k, v) => { m[k] = (m[k] || 0) + v; };
  P.board.forEach((sh, i) => { if (sh) for (const [k, v] of SHARD[sh.c].fx) add(k, Math.round(v * I.mul[i])); });
  for (const c in I.sets) for (const [k, v] of SHARD[c].set) add(k, v);
  if (I.trio) for (const [k, v] of TRIO) add(k, v);
}
function boardSum(P) { const m = {}; boardMods(P, m); return m; }
const shardName = sh => SHARD[sh.c].n + ' ' + SHQ[sh.q];


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
  return { v: 1, cls, seed, lv: 1, xp: 0, sp: {}, pts: 0, skp: 1, sk: { [CS[2]]: 1 }, fork: {}, fork2: {}, slots: [null, null, null, null], eq, inv: [goods('pot', 3), goods('wpot', 2)], gold: 30, q: {}, flags: {}, board: Array(19).fill(null), shd: [], kills: 0, t: Date.now(), rested: 0, play: 0, codex: {} };
}
function startGame(S) {
  const Wd = makeWorld(S.seed); Wd.props = placeProps(Wd, PM);
  if (S.flags.bridge) repairBridge(Wd, Wd.bq);
  if (S.flags.bridge2) repairBridge(Wd, Wd.bq2);
  for (const w of Wd.wps) if (S.flags['wp_' + w.n]) w.on = 1;
  if (!S.board) S.board = Array(19).fill(null); if (!S.shd) S.shd = []; if (!S.fork2) S.fork2 = {};
  const T = Wd.islands[Wd.town];
  const P = { ...S, x: T.cx + 1.5, y: T.cy + 2.5, r: .28, dir: 2, an: 'idle', at: 0, atkT: 0, cds: {}, buf: {}, hp: null, wind: null, dodge: 0, dcd: 0, inv0: 0, tgt: null, path: null, dead: 0, combo: 0 };
  // 순풍: 쉬는 동안 쌓이는 경험치 2배 몫(최대 다음 레벨 필요량의 절반)
  const away = Math.max(0, Date.now() - (S.t || Date.now())) / 36e5; P.rested = Math.min(xpNeed(P.lv) * .5, (S.rested || 0) + away * xpNeed(P.lv) * .06);
  G = { Wd, P, mobs: [], proj: [], fx: [], txt: [], drops: [], areas: [], parts: [], t: 0, cam: [P.x, P.y], shake: 0, packs: [], msg: [], hitstop: 0, flash: 0, cut: null };
  calc(P); P.hp = P.mhp; P.wind = P.mwind; autoSlots(P);
  dailyStart(); spawnAll(); restNote(S); if (!S.q.q1) setTimeout(() => talk('chief', true), 600); boardCheck();
  return G;
}
function save() { if (!G) return; const P = G.P, S = {}; for (const k of ['v', 'cls', 'seed', 'lv', 'xp', 'sp', 'pts', 'skp', 'sk', 'fork', 'fork2', 'slots', 'eq', 'inv', 'gold', 'q', 'flags', 'board', 'shd', 'kills', 'rested', 'play', 'codex', 'daily']) S[k] = P[k]; S.t = Date.now(); S.uid = UID;
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
  const D = MOBDEF[t], E = elite ? ELITE[elite - 1] : null, m = E ? E[2] : {};
  const hp = Math.round((D.hp[0] + D.hp[1] * lv) * (m.hp || 1) * (elite ? 1.3 : 1));
  return { t, D, x, y, hx: x, hy: y, lv, hp, mhp: hp, dmg: [(D.dmg[0] + D.dmg[2] * lv) * (m.dmg || 1), (D.dmg[1] + D.dmg[2] * lv * 1.3) * (m.dmg || 1)], spd: D.spd * (m.spd || 1), r: D.r, dir: ri(0, 7), an: 'idle', at: Math.random(), cd: 1, st: 'idle', kx: 0, ky: 0, stun: 0, slow: 0, elite, E, kbimm: m.kbimm, wan: rnd(1, 4), fl: 0, fear: 0, taunt: 0, miss: 0, bleed: 0, id: Math.random() };
}
function spawnPack(pk) {
  const s = G.Wd.islands[pk.isl], R = Math.random; pk.mobs = []; if (G.today === pk.isl && !pk.boss && !pk.elite) pk.elite = ri(1, ELITE.length);
  for (let tries = 0; tries < 30 && pk.mobs.length < pk.n; tries++) {
    const a = R() * TAU, d = R() * 1.8, x = pk.x + Math.cos(a) * d, y = pk.y + Math.sin(a) * d;
    if (!walk(G.Wd, x, y)) continue; const elite = pk.elite && pk.mobs.length === 0 ? pk.elite : 0;
    const i = pk.mobs.length, lead = pk.lead && i === 0, m = lead ? mkMob(pk.lead, pk.x, pk.y, pk.lv[1] + 1, 0) : mkMob(pk.kinds[(i - (pk.lead ? 1 : 0)) % pk.kinds.length], x, y, ri(pk.lv[0], pk.lv[1]), elite && !pk.lead ? elite : (pk.lead && i === 1 ? pk.elite : 0)); m.pk = pk; pk.mobs.push(m); G.mobs.push(m);
  }
  pk.dead = 0; pk.clear = 0; pk.bl = pk.bl || 0;
}
function spawnAll() {
  const Wd = G.Wd; G.mobs = []; G.packs = [];
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
  let xp = (D.xp[0] + D.xp[1] * m.lv) * (m.elite ? 3 : 1) * P.xpm; if (m.lv < P.lv - 5) xp *= .3;
  const bonus = Math.min(P.rested, xp); P.rested -= bonus; gainXp(Math.round(xp + bonus));
  if (P.lifek) P.hp = Math.min(P.mhp, P.hp + P.lifek); if (P.windk) P.wind = Math.min(P.mwind, P.wind + P.windk);
  for (const s in P.eq) if (P.eq[s] && P.eq[s].hid) { const it = P.eq[s]; it.tame = (it.tame || 0) + 1; if (it.tame === TAME_N) { say('길들이기 완료! ' + itemName(it) + ' 숨은 옵션: ' + afxText(it.hid[0], it.hid[1], P.cls), '#c9a8ff'); calc(P); } }
  P.kills++; P.codex[m.t] = (P.codex[m.t] || 0) + 1;
  if (m.t === 'fluff') qAdd('q2', 1);
  if (D.heron) { P.flags.heron = 1; if (P.q.q7 && P.q.q7.s === 1) qSet('q7', 2); G.shake = 14; G.flash = .4; say('큰 왜가리가 쓰러졌어요! 둥지섬 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); }
  else if (D.boss) { P.flags.boss = 1; qSet('q3', 2); G.shake = 10; say('우두머리 보풀이 흩어졌어요! 언덕의 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); }
  ch1Kill(m); dailyKill(m, fell);
  if (fell) { G.txt.push({ x: m.x, y: m.y, z: 1, t: 0, s: '떨어짐!', c: '#9fe4ff' }); sfx('fall'); }
  else burst(m.x, m.y, m.t, D.boss ? 3 : D.mini ? 2.2 : m.elite ? 1.6 : 1);
  if (D.mini && m.pk) cleanse(m.pk);
  drops(m, fell);
  if (m.pk) { m.pk.dead++; if (m.pk.dead >= m.pk.mobs.length) { m.pk.clear = G.t; } }
}
function drops(m, fell) {
  const P = G.P, D = m.D, put = it => { const a = Math.random() * TAU, d = .3 + Math.random() * .6; let x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d; if (!walk(G.Wd, x, y)) { x = P.x; y = P.y; } if (it.gold) G.drops.push({ x, y, gold: it.gold, t: 0 }); else G.drops.push({ x, y, it, t: 0 }); };
  if (fell) { if (Math.random() < .5) G.drops.push({ x: P.x + rnd(-.5, .5), y: P.y + rnd(-.5, .5), gold: ri(m.lv, m.lv * 3), t: 0 }); return; }
  const ilv = m.lv + (m.elite ? 1 : 0) + (D.boss ? 2 : D.mini ? 1 : 0);
  if (Math.random() < .55 || m.elite || D.mini) put({ gold: Math.round(ri(m.lv * 2, m.lv * 5) * (D.mini ? 6 : m.elite ? 3 : 1) * (m.pk && m.pk.isl === G.today ? 1.5 : 1)) });
  const nItem = D.boss ? 3 : D.mini ? 2 : m.elite ? (Math.random() < .7 ? 2 : 1) : (Math.random() < .1 * (1 + P.find / 100) ? 1 : 0);
  for (let i = 0; i < nItem; i++) put(rollDrop(ilv, P.find + (m.elite ? 60 : 0) + (D.boss ? 150 : D.mini ? 90 : 0), P.cls));
  if (D.boss) { const u = CLS_START[P.cls][4]; put(makeItem(UNIQ.find(x => x.id === u).base, 3, 9, { u })); if (Math.random() < .5) put(makeItem('helm2', 3, 8, { u: 'u_millcap' })); put(goods('bhone')); }
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
  const C = { fluff: ['#6e6578', '#4a4252', '#8a8098', '#ff6a3a'], fluffking: ['#4e4460', '#2e2638', '#b04aff', '#ff4a2a'], seed: ['#4a3e2a', '#9a3a2a', '#d8c8a0'], bird: ['#2c2834', '#1e1a24', '#ffc23a'], keeper: ['#2e261c', '#cfc0a0', '#b04aff', '#9a3a2a'], mudfluff: ['#6a5034', '#3e2c1c', '#8a7050'], bogpod: ['#3a5a2a', '#9a3a2a', '#c8d0a0'], heronling: ['#5a6a7a', '#3a4250', '#d8dce4'], heron: ['#56606e', '#d8dce4', '#2e3440', '#e0a83a'] }[t] || ['#fff'];
  const n = Math.round(14 * k); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = rnd(1, 4.5) * Math.sqrt(k);
    G.parts.push({ k: t === 'seed' || t === 'keeper' || t === 'bogpod' ? 'chip' : t === 'bird' || t === 'heronling' || t === 'heron' ? 'leaf' : 'puff', x: x2, y: y2, z: rnd(10, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 260), t: 0, life: rnd(.5, 1.1), c: pick(C), s: rnd(2.5, 5.5) * Math.sqrt(k), rot: Math.random() * TAU }); }
  G.fx.push({ k: 'ring', x: x2, y: y2, r: .9 * k, t: 0, life: .3, c: '#ffffff' }); G.hitstop = Math.max(G.hitstop, .04);
}
function gainXp(n) { gainXp0(n); boardCheck(); if (!G.P.daily && G.P.lv >= DAILY_LV) dailyCheck(); }
// 3레벨: 나침반판이 열리고 처음 조각 2개
function boardCheck() { const P = G.P; if (P.lv < BOARD_LV || P.flags.board0) return; P.flags.board0 = 1; giveShard({ c: 'sky', q: 1 }, 1); giveShard({ c: 'fire', q: 1 }, 1); G.cut = { s: '나침반판이 열렸어요 (B)', c: '#9fe4ff', t: 0 }; say('나침반판이 열렸어요! 기술 창(S)이나 B 키로 바람 조각을 끼워 보세요.', '#9fe4ff'); }
function giveShard(sh, quiet) { const P = G.P; if (P.shd.length >= SHD_MAX) { P.gold += 30 * sh.q; if (!quiet) say('조각 주머니가 가득 차서 ' + 30 * sh.q + 'G로 바꿨어요', '#ffd166'); return; } P.shd.push(sh); if (!quiet) { say('바람 조각 「' + shardName(sh) + '」을 얻었어요!', SHARD[sh.c].c); G.txt.push({ x: P.x, y: P.y, z: 2.6, t: 0, s: '◆ ' + shardName(sh), c: SHARD[sh.c].c, pop: 1 }); sfx('ench'); } }
function gainXp0(n) {
  const P = G.P; P.xp += n; G.txt.push({ x: P.x, y: P.y, z: 2.2, t: 0, s: '+' + n + ' 경험', c: '#b6f0a0', small: 1 });
  while (P.xp >= xpNeed(P.lv)) { P.xp -= xpNeed(P.lv); P.lv++; P.pts += 5; P.skp++; calc(P); P.hp = P.mhp; P.wind = P.mwind; G.fx.push({ k: 'lvl', x: P.x, y: P.y, t: 0, life: 1.4 }); sfx('lvl'); say(P.lv + '레벨! 스탯 5점, 스킬 1점이 생겼어요.', '#ffd166'); if (P.lv === ULT[P.cls].req) { autoSlots(P); say('궁극 기술 「' + ULT[P.cls].name + '」을 익혔어요! 4번으로 써 보세요.', '#ffcf7a'); } }
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
  const P = G.P, id = P.slots[i]; if (!id || P.dead) return; if (id === 'ult') return castUlt();
  const s = SKILLS[P.cls].find(x => x.id === id), lv = skLv(P, s); if (!lv) return;
  const f2 = f2Of(P, id), cost = s.cost * (f2 === 1 ? .75 : 1);
  if ((P.cds[id] || 0) > 0) return; if (P.wind < cost) { say('바람이 모자라요', '#9fe4ff', 1); sfx('no'); return; }
  P.wind -= cost; P.cds[id] = s.cd * (f2 === 0 ? 1.15 : f2 === 1 ? .65 : 1); (P.cdx || (P.cdx = {}))[id] = P.cds[id]; const fk = lv >= 5 ? P.fork[id] : null;
  if (f2 === 0 && !s.m) { P.hp = Math.min(P.mhp, P.hp + P.mhp * .15); P.wind = Math.min(P.mwind, P.wind + 10); G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .5, c: '#b6f0a0' }); }
  const t = nearestMob(P.x, P.y, s.t === 'bolt' || s.t === 'twister' || s.t === 'chain' || s.t === 'mist' ? 8 : 3); if (t && !P.aimLock) aimAt(P, t);
  const [fx, fy] = facingW(P), mult = s.m * (1 + s.ml * (lv - 1)) * synergy(P, s) * (f2 === 0 ? 1.4 : 1), D = (m, k) => rollDmg(P, m, mult * (k || 1));
  P.an = ['buff', 'shout', 'flag', 'shield', 'mist', 'chain', 'twister'].includes(s.t) ? 'cast' : 'atk'; P.at = 0; P.atkDur = .38;
  sfx(CSK[s.t] ? CSKS[s.t] || 'nova' : s.t);
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
  G.cut = { s: U.name, t: 0, c: P.cls === 'warden' ? '#ffcf7a' : CLASSES[P.cls].col }; G.flash = .18; sfx('lvl');
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
    G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: C.range, t: 0, life: .2, s: (P.combo = (P.combo || 0) + 1) % 2 });
    if (m) { const [d, c] = rollDmg(P, m, 1); hitMob(m, d, c, { kb: 1.4 }); if (P.cls === 'ringer') G.fx.push({ k: 'bellw', x: m.x, y: m.y, r: .9, t: 0, life: .3, c: '#e8d0ff' }); } else sfx('dodge');
  } else if (P.cls === 'trapper') { G.proj.push({ k: 'arrow', x: P.x + ax * .4, y: P.y + ay * .4, vx: ax * 15, vy: ay * 15, life: .55, mult: 1, hit: new Set() }); sfx('shoot'); }
  else { G.proj.push({ k: 'wind', x: P.x + ax * .4, y: P.y + ay * .4, vx: ax * 10, vy: ay * 10, life: .8, mult: .95, hit: new Set() }); sfx('shoot'); }
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
  if (ix || iy) { P.path = null; P.tgt = null; P.goal = null; }
  // 클릭 이동/공격
  if (!ix && !iy && P.tgt) { if (P.tgt.dead) P.tgt = null; else { const d = hyp(P.tgt.x - P.x, P.tgt.y - P.y), C = CLASSES[P.cls]; if (d > (C.melee ? C.range + P.tgt.r : 6.5)) { ix = (P.tgt.x - P.x) / d; iy = (P.tgt.y - P.y) / d; } else if (!busy) basicAttack(); } }
  else if (!ix && !iy && P.path) { const d = hyp(P.path[0] - P.x, P.path[1] - P.y); if (d < .15) P.path = null; else { ix = (P.path[0] - P.x) / d; iy = (P.path[1] - P.y) / d; } }
  if (inputHeld('atk') && !busy) { if (MOUSE.atk && !TOUCH.on) { const [wx, wy] = mouseWorld(), m = mobAt(wx, wy); if (m) { const C = CLASSES[P.cls], d = hyp(m.x - P.x, m.y - P.y); if (C.melee && d > C.range + m.r) { P.tgt = m; } else { P.tgt = null; aimAt(P, m); basicAttack(true); } } else { const dx = wx - P.x, dy = wy - P.y, d = hyp(dx, dy) || 1; P.aim = [dx / d, dy / d]; P.tgt = null; P.path = null; ix = iy = 0; basicAttack(true); } }
    else basicAttack(); }
  // 누른 곳에 사람·표지·다리가 있으면 가까이 가서 말 걸기/쓰기
  if (P.goal) { const g = P.goal, d = hyp(g.x - P.x, g.y - P.y); if (d < (g.r || 1.4)) { P.goal = null; P.path = null; if (g.k === 'npc') talk(g.id); else if (g.k === 'wp') openPanel('travel'); else if (g.k === 'bridge') interact(); } else if (!P.path) P.goal = null; }
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
  if (m.mark > 0) m.mark -= dt;
  if (m.stun > 0) { m.stun -= dt; m.an = 'hurt'; return; }
  if (m.slow > 0) m.slow -= dt; if (m.taunt > 0) m.taunt -= dt; if (m.fear > 0) m.fear -= dt; m.cd -= dt;
  const P = G.P, dx = P.x - m.x, dy = P.y - m.y, d = hyp(dx, dy), sp = m.spd * (m.slow > 0 ? .55 : 1) * (G.areas.some(a => a.k === 'mist' && hyp(a.x - m.x, a.y - m.y) < a.r) ? .6 : 1);
  m.miss = G.areas.some(a => a.k === 'mist' && hyp(a.x - m.x, a.y - m.y) < a.r);
  if (m.an === 'atk') { // 공격 동작 중
    const wind = m.D.big ? .8 : .35;
    if (!m.hitDone && m.at > wind) { m.hitDone = 1; if (m.D.big) bossHit(m); else if (hyp(P.x - m.x, P.y - m.y) < m.r + P.r + .55) hurtPlayer(rnd(m.dmg[0], m.dmg[1]), m); }
    if (m.at > wind + .3) { m.an = 'idle'; m.at = 0; } return;
  }
  if (m.an === 'hurt' && m.at < .2) return;
  if (P.dead) { m.st = 'idle'; }
  const aggro = m.D.boss ? 9 : m.D.mini ? 7.5 : m.D.fly ? 8 : 6.5;
  if (m.st === 'idle') { if (d < aggro && !P.dead) m.st = 'chase'; else { m.wan -= dt; if (m.wan < 0) { m.wan = rnd(2, 5); m.wx = m.hx + rnd(-1.5, 1.5); m.wy = m.hy + rnd(-1.5, 1.5); }
      if (m.wx != null) { const ex = m.wx - m.x, ey = m.wy - m.y, el = hyp(ex, ey); if (el > .2) { move(m, ex / el * sp * .4 * dt, ey / el * sp * .4 * dt); m.dir = w2dir(ex, ey); m.an = 'move'; } else m.an = 'idle'; } } return; }
  // 집에서 너무 멀면 돌아감
  if (hyp(m.x - m.hx, m.y - m.hy) > 16 && m.taunt <= 0 || P.dead) { m.st = 'idle'; m.wx = m.hx; m.wy = m.hy; return; }
  if (m.fear > 0) { move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.dir = w2dir(-dx, -dy); m.an = 'move'; return; }
  m.dir = w2dir(dx, dy);
  if (m.D.ai === 'charge' && m.cd <= 0 && d > 2.2 && d < 5) { m.charge = .55; m.cvx = dx / d * 6.5; m.cvy = dy / d * 6.5; m.cd = 3.5; m.hitC = 0; }
  if (m.charge > 0) { m.charge -= dt; move(m, m.cvx * dt, m.cvy * dt); m.an = 'atk'; m.at = .1; m.hitDone = 1; if (!m.hitC && hyp(P.x - m.x, P.y - m.y) < m.r + P.r + .2) { m.hitC = 1; hurtPlayer(rnd(m.dmg[0], m.dmg[1]) * 1.3, m); } if (m.charge <= 0) { m.an = 'idle'; m.at = 0; } return; }
  if (m.D.ai === 'dive' && m.back > 0) { m.back -= dt; move(m, -dx / d * sp * dt, -dy / d * sp * dt); m.an = 'move'; return; }
  if (m.D.big) return bossAI(m, dt, d, dx, dy);
  if (m.D.ai === 'spit') return spitAI(m, dt, d, dx, dy, sp);
  const reach = m.r + P.r + .35;
  if (d > reach) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m); }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = m.D.atk * rnd(.9, 1.3); if (m.D.ai === 'dive') m.back = .8; }
  else m.an = 'idle';
}
function separate(m) { for (const o of G.mobs) { if (o === m || o.dead) continue; const dx = m.x - o.x, dy = m.y - o.y, d = hyp(dx, dy), rr = m.r + o.r; if (d < rr && d > 0) { move(m, dx / d * (rr - d) * .3, dy / d * (rr - d) * .3); } } }
function bossAI(m, dt, d, dx, dy) {
  if (m.D.heron) return heronAI(m, dt, d, dx, dy);
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
function autoSlots(P) { if (P.lv >= ULT[P.cls].req && !P.slots.includes('ult')) { const old = P.slots[3]; P.slots[3] = 'ult'; if (old) { const i = P.slots.indexOf(null); if (i >= 0) P.slots[i] = old; } } for (const s of SKILLS[P.cls]) if (P.sk[s.id] && !P.slots.includes(s.id) && s.t !== 'passive') { const i = P.slots.indexOf(null); if (i >= 0) P.slots[i] = s.id; } }

/* ---------- 퀘스트 ---------- */
function qSet(id, s) { const q = G.P.q[id] || (G.P.q[id] = { s: 0, n: 0 }); if (q.s < s) q.s = s; }
function qAdd(id, n) { const q = G.P.q[id]; if (!q || q.s !== 1) return; q.n += n; const Q = QUESTS[id]; if (q.n >= Q.need) { q.n = Q.need; q.s = 2; say('「' + Q.n + '」 완료! ' + NPCDEF[Q.from].n + '에게 돌아가요.', '#ffd166'); } }
// 근처에 무엇이 있는지 (상호작용 버튼)
function near() {
  const P = G.P, Wd = G.Wd; G.near = null; if (P.dead) return;
  for (const k in Wd.npcAt) { const [x, y] = Wd.npcAt[k]; if (hyp(P.x - x, P.y - y) < 1.5) { G.near = { k: 'npc', id: k, label: NPCDEF[k].n + ' 말 걸기' }; return; } }
  for (const w of Wd.wps) if (hyp(P.x - w.x, P.y - w.y) < 1.4) { if (!w.on && (w.n !== '바람개비 언덕' || P.flags.boss) && (w.n !== '둥지섬' || P.flags.heron)) { w.on = 1; P.flags['wp_' + w.n] = 1; say('바람개비 표지 「' + w.n + '」에 바람이 깃들었어요', '#9fe4ff'); sfx('lvl'); if (w.n === '바람개비 언덕' && P.q.q3 && P.q.q3.s === 2 || w.n === '둥지섬' && P.q.q7 && P.q.q7.s === 2) say('촌장 들메에게 돌아가 소식을 전해요.', '#ffd166'); save(); }
    G.near = w.on ? { k: 'wp', label: '바람개비 표지(이동)' } : { k: 'wpx', label: w.n === '둥지섬' ? '아직 바람이 없어요(큰 왜가리를 먼저)' : '아직 바람이 없어요(우두머리를 먼저)' }; return; }
  if (G.chest && hyp(P.x - G.chest.x, P.y - G.chest.y) < 1.5) { G.near = { k: 'chest', label: '오늘의 섬 상자 열기' }; return; }
  if (Wd.signAt && hyp(P.x - Wd.signAt[0], P.y - Wd.signAt[1]) < 1.6) { G.near = { k: 'notice', label: '마을 게시판 보기' }; return; }
  const b = Wd.bridges[Wd.bq]; if (b.broken) for (const c of b.cells) { const x = c % Wd.W + .5, y = ((c / Wd.W) | 0) + .5; if (hyp(P.x - x, P.y - y) < 2.2) { G.near = { k: 'bridge', label: count('plank') >= 6 ? '다리 고치기 (널빤지 6)' : '끊어진 다리 (널빤지 ' + count('plank') + '/6)' }; return; } }
  const b2 = Wd.bridges[Wd.bq2]; if (b2.broken) for (const c of b2.cells) { const x = c % Wd.W + .5, y = ((c / Wd.W) | 0) + .5; if (hyp(P.x - x, P.y - y) < 2.2) { G.near = { k: 'bridge2', label: count('shell') >= 3 ? '다리 고치기 (둥지 껍질 3)' : '끊어진 다리 (둥지 껍질 ' + count('shell') + '/3)' }; return; } }
}
function interact() {
  const n = G.near; if (!n) return; const P = G.P;
  if (n.k === 'npc') talk(n.id);
  else if (n.k === 'chest') openChest();
  else if (n.k === 'notice') openPanel('daily');
  else if (n.k === 'wp') openPanel('travel');
  else if (n.k === 'bridge2') { if (count('shell') >= 3) { useGood('shell', 3); repairBridge(G.Wd, G.Wd.bq2); P.flags.bridge2 = 1; MINI = null; if (P.q.q5) qSet('q5', 2); G.shake = 5; sfx('lvl'); say('다리를 다시 놓았어요! 갈대 늪으로 건너갈 수 있어요.', '#ffd166'); for (const c of G.Wd.bridges[G.Wd.bq2].cells) G.fx.push({ k: 'pop', x: c % G.Wd.W + .5, y: ((c / G.Wd.W) | 0) + .5, t: -Math.random() * .6, life: .5, c: '#ffe08a' }); save(); } else say('둥지 껍질이 ' + (3 - count('shell')) + '개 더 필요해요(둥지지기가 떨궈요)', '#ffe08a', 1); }
  else if (n.k === 'bridge') { if (count('plank') >= 6) { useGood('plank', 6); repairBridge(G.Wd, G.Wd.bq); P.flags.bridge = 1; qSet('q1', 2); G.shake = 5; sfx('lvl'); say('다리를 다시 놓았어요! 바람개비 언덕으로 건너갈 수 있어요.', '#ffd166'); for (const c of G.Wd.bridges[G.Wd.bq].cells) G.fx.push({ k: 'pop', x: c % G.Wd.W + .5, y: ((c / G.Wd.W) | 0) + .5, t: -Math.random() * .6, life: .5, c: '#ffe08a' }); save(); } else say('다리 널빤지가 ' + (6 - count('plank')) + '개 더 필요해요', '#ffe08a', 1); }
}

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
  if (a.k !== 'mud') return 0; const P = G.P;
  a.x += a.vx * dt; a.y += a.vy * dt; if (!G.Wd.inb(Math.floor(a.x), Math.floor(a.y))) { a.t = a.life; return 1; }
  if (!P.dead && hyp(P.x - a.x, P.y - a.y) < .45 + P.r) { a.t = a.life; G.fx.push({ k: 'pop', x: a.x, y: a.y, t: 0, life: .3, c: '#6a5034' }); hurtPlayer(a.dmg, a.src); }
  return 1;
}

/* ---------- 10레벨 두 번째 갈래 + 매일 장치(순풍 알림 · 오늘의 섬 · 하루 의뢰) ---------- */
// 스킬 점수 10이 되면 고르는 두 번째 갈래(모든 스킬 공통 두 방향)
const FORK2 = [['세찬 바람', '피해 +40%, 다시 쓰기 시간 +15%.'], ['가벼운 바람', '다시 쓰기 시간 -35%, 바람 소모 -25%.']];
const FORK2B = [['북돋는 바람', '쓸 때마다 생명력 15%와 바람 10을 채워요.'], FORK2[1]]; // 피해가 없는 스킬
const fork2Of = s => s.m ? FORK2 : FORK2B;
const f2Of = (P, id) => (P.sk[id] || 0) >= 10 && P.fork2 ? P.fork2[id] : null;

// 하루 기준: 한국 시간 자정
const dayKey = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
const dayNum = k => Math.floor(Date.parse(k + 'T00:00:00Z') / 864e5);
const DAILY_LV = 3, ISLE_N = 15;
function isleName(k) { const Wd = G.Wd; let i = Wd.fi.indexOf(k); if (i >= 0) return ['동쪽 들판', '남쪽 들판', '가운데 들판', '윗 들판', '아랫 들판'][i]; i = Wd.mi.indexOf(k); if (i >= 0) return ['갈대 늪 어귀', '갈대 나루', '안쪽 갈대 늪'][i]; return k === Wd.hill ? '바람개비 언덕' : '섬'; }
// 갈 수 있는 사냥 섬 중 내 레벨에 맞는 곳 몇 개에서 날마다 하나
function isleCands(P) { const Wd = G.Wd, L = Wd.fi.map((k, i) => [k, ISL_LV[i][1]]); if (P.flags.bridge) L.push([Wd.hill, 8]); if (P.flags.bridge2) Wd.mi.forEach((k, i) => L.push([k, MARSH_LV[i][1]]));
  const fit = L.filter(([, lv]) => lv >= P.lv - 4 && lv <= P.lv + 3); return (fit.length ? fit : L.sort((a, b) => b[1] - a[1]).slice(0, 2)).map(a => a[0]); }
const DTASK = {
  kill: (t, n) => ['밑것 ' + n + '마리 쓰러뜨리기', n],
  elite: (t, n) => ['정예 ' + n + '마리 쓰러뜨리기', n],
  fell: (t, n) => ['섬 밖으로 ' + n + '마리 떨어뜨리기', n],
  nest: (t, n) => ['둥지지기 ' + n + '마리 쓰러뜨리기', n],
  isle: (t, n) => ['오늘의 섬 상자 열기', 1],
  mob: (t, n) => [MOBDEF[t].n + ' ' + n + '마리', n],
};
function newDaily(P, d) {
  const R = srand(dayNum(d) * 7919 + P.seed % 997), pk = a => a[Math.floor(R() * a.length)], C = isleCands(P);
  const mobs = P.flags.bridge2 ? ['mudfluff', 'bogpod', 'heronling'] : ['fluff', 'seed', 'bird'];
  const pool = [['mob', pk(mobs), 15], ['kill', '', 40], ['elite', '', 3], ['fell', '', 6], ['nest', '', 2]];
  const tasks = [['isle', '', 1]]; while (tasks.length < 3) { const t = pool.splice(Math.floor(R() * pool.length), 1)[0]; tasks.push(t); }
  P.daily = { d, isle: C[Math.floor(R() * C.length)], isleN: 0, chest: 0, all: 0, tasks: tasks.map(([k, t, n]) => ({ k, t, n, c: 0, got: 0 })) };
}
function dailyCheck(quiet) { const P = G.P; if (P.lv < DAILY_LV) return; const d = dayKey(); if (P.daily && P.daily.d === d) return;
  const first = !P.daily; newDaily(P, d); G.today = P.daily.isle; G.chest = null; for (const pk of G.packs) if (pk.isl === G.today && !pk.boss && !pk.elite) pk.elite = ri(1, ELITE.length);
  if (!quiet) { G.cut = { s: first ? '마을 게시판에 하루 의뢰가 붙었어요' : '새 하루가 밝았어요', c: '#ffd166', t: 0 }; say('오늘의 섬은 「' + isleName(P.daily.isle) + '」이에요. 마을 게시판에서 하루 의뢰 3개를 확인해요.', '#ffd166'); } }
function dTask(k, t, n) { const D = G.P.daily; if (!D) return; for (const q of D.tasks) if (q.k === k && (!t || q.t === t) && q.c < q.n) { q.c = Math.min(q.n, q.c + (n || 1)); if (q.c >= q.n) { say('하루 의뢰 「' + DTASK[q.k](q.t, q.n)[0] + '」 끝! 마을 게시판에서 보상을 받아요.', '#ffd166'); sfx('lvl'); } } }
function dailyKill(m, fell) { const P = G.P, D = P.daily; if (!D || P.lv < DAILY_LV) return;
  dTask('kill'); dTask('mob', m.t); if (m.elite) dTask('elite'); if (fell) dTask('fell'); if (m.D.mini) dTask('nest');
  if (m.pk && m.pk.isl === D.isle && !D.chest && !G.chest) { D.isleN = Math.min(ISLE_N, D.isleN + 1); if (D.isleN >= ISLE_N) { spawnChest(); G.cut = { s: '오늘의 섬 상자가 나타났어요!', c: '#ffd166', t: 0 }; sfx('lvl'); } } }
function spawnChest() { const s = G.Wd.islands[G.P.daily.isle]; let x = s.cx + .5, y = s.cy + .5; for (let i = 0; i < 30 && !walk(G.Wd, x, y); i++) { x = s.cx + rnd(-2.5, 2.5); y = s.cy + rnd(-2.5, 2.5); }
  G.chest = { x, y, t: 0 }; G.fx.push({ k: 'ring', x, y, r: 2, t: 0, life: .6, c: '#ffd166' }); }
function dailyStart() { const P = G.P; G.today = P.daily && P.daily.d === dayKey() ? P.daily.isle : null; dailyCheck(); if (P.daily && P.daily.isleN >= ISLE_N && !P.daily.chest) spawnChest(); }
function openChest() { const P = G.P, D = P.daily, C = G.chest; if (!C || !D) return; G.chest = null; D.chest = 1; dTask('isle');
  const lv = Math.max(P.lv, ...(ISL_LV[G.Wd.fi.indexOf(D.isle)] || MARSH_LV[G.Wd.mi.indexOf(D.isle)] || [8])), put = it => G.drops.push({ x: C.x + rnd(-.8, .8), y: C.y + rnd(-.8, .8), it, t: 0 });
  G.drops.push({ x: C.x, y: C.y + .5, gold: lv * 40, t: 0 }); put(rollDrop(lv + 2, P.find + 220, P.cls)); put(rollDrop(lv + 1, P.find + 150, P.cls)); put(goods(Math.random() < .5 ? 'bhone' : 'bglue')); put(goods('pot', 2));
  if (P.lv >= BOARD_LV) giveShard({ c: pick(Object.keys(SHARD)), q: Math.random() < .35 ? 2 : 1 });
  for (let i = 0; i < 14; i++) G.fx.push({ k: 'pop', x: C.x + rnd(-1, 1), y: C.y + rnd(-1, 1), t: -Math.random() * .4, life: .5, c: '#ffd166' }); G.shake = 4; sfx('ench'); say('오늘의 섬 상자를 열었어요!', '#ffd166'); save(); }
function dReward(P) { return { gold: 20 + P.lv * 25, xp: Math.round(xpNeed(P.lv) * .12) }; }
function claimTask(i) { const P = G.P, D = P.daily, q = D && D.tasks[i]; if (!q || q.c < q.n || q.got) return; q.got = 1; const r = dReward(P); P.gold += r.gold; gainXp(r.xp); addInv(goods(i === 0 ? 'pot' : 'wpot', 2));
  if (!D.all && D.tasks.every(t => t.got)) { D.all = 1; P.gold += 50 + P.lv * 30; addInv(goods('bhone')); if (P.lv >= BOARD_LV) giveShard({ c: pick(Object.keys(SHARD)), q: 2 }); toast('하루 의뢰 셋을 다 했어요! 덤으로 축복 숫돌을 받았어요'); } else toast(r.gold + 'G · 경험치 ' + r.xp + ' 받았어요'); sfx('coin'); save(); }
function dailyHtml(X) { const P = G.P, D = P.daily;
  if (!D) return `<div class="sk-bx" style="max-width:440px">${X}<h3>마을 게시판</h3><p class="m">${DAILY_LV}레벨이 되면 날마다 하루 의뢰 3개와 오늘의 섬이 붙어요.</p></div>`;
  const r = dReward(P); let h = `<div class="sk-bx" style="max-width:460px">${X}<h3>마을 게시판 <small style="font-size:12px;color:#8a7458">${D.d.slice(5).replace('-', '월 ')}일 · 자정에 바뀌어요</small></h3>`;
  h += `<div class="sk-card" style="border-color:#e8b05a;background:#fff6e4"><b style="color:#b0702a">오늘의 섬 · ${isleName(D.isle)}</b><br><small>정예가 더 나오고 금화를 1.5배 떨궈요. 밑것 ${ISLE_N}마리를 쓰러뜨리면 상자가 나타나요.</small><br><small>${D.chest ? '상자를 열었어요 ✓' : G.chest ? '상자가 나와 있어요!' : '진행 ' + D.isleN + '/' + ISLE_N}</small></div>`;
  h += '<h4 style="margin:8px 0 4px">하루 의뢰</h4>' + D.tasks.map((q, i) => { const [n, need] = DTASK[q.k](q.t, q.n); return `<div class="sk-row"><div class="f"><b>${n}</b><br><small>${Math.min(q.c, need)}/${need} · 보상 ${r.gold}G, 경험치 ${r.xp}, ${i === 0 ? '민들레 차' : '바람 사탕'} 2</small></div><button class="sk-b ${q.got ? '' : 'g'}" data-a="dclaim" data-i="${i}" ${q.c >= q.n && !q.got ? '' : 'disabled'}>${q.got ? '받음' : q.c >= q.n ? '받기' : '진행 중'}</button></div>`; }).join('');
  h += `<p class="m" style="font-size:11.5px">셋을 다 하면 덤으로 축복 숫돌을 줘요. 못 한 날도 손해는 없어요.${P.rested > 1 ? ' · 지금 순풍: 경험치 2배 ' + Math.round(P.rested) + ' 남음' : ''}</p>` + TOAST + '</div>'; return h; }
function dailyTrack() { const P = G.P, D = P.daily; if (!D) return null; const left = D.tasks.filter(q => !q.got).length; if (!left) return null; const ready = D.tasks.filter(q => q.c >= q.n && !q.got).length;
  const q = D.tasks.find(q => q.c < q.n);
  return ['하루 의뢰 ' + (3 - left) + '/3', ready ? '마을 게시판에서 보상 받기' : G.chest ? '오늘의 섬 상자 열기' : !D.chest ? '오늘의 섬 ' + isleName(D.isle) + ' ' + D.isleN + '/' + ISLE_N : q ? DTASK[q.k](q.t, q.n)[0] + ' ' + q.c + '/' + q.n : '마을 게시판']; }
// 순풍 알림: 오래 쉬다 오면 한 번 알려 줌
function restNote(S) { const away = Math.max(0, Date.now() - (S.t || Date.now())) / 36e5; if (away >= 1 && G.P.rested > 1) setTimeout(() => { if (G) say('쉬는 동안 순풍이 불었어요. 다음 경험치 ' + Math.round(G.P.rested) + '만큼은 2배로 받아요.', '#9fe4ff'); }, 1200); }
// 상자 그림(나무 상자 + 빛)
function drawChest(c, sx, sy) { const t = G.t; x.save(); x.globalAlpha = .35 + .2 * Math.sin(t * 3); x.fillStyle = '#ffe08a'; x.beginPath(); x.ellipse(sx, sy, 26, 12, 0, 0, TAU); x.fill(); x.globalAlpha = 1;
  x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(sx, sy + 2, 18, 7, 0, 0, TAU); x.fill(); const b = Math.sin(t * 2.4) * 1.5;
  x.fillStyle = '#8a5a2a'; x.fillRect(sx - 15, sy - 20 + b, 30, 18); x.fillStyle = '#a8703a'; x.beginPath(); x.moveTo(sx - 16, sy - 20 + b); x.quadraticCurveTo(sx, sy - 34 + b, sx + 16, sy - 20 + b); x.closePath(); x.fill();
  x.strokeStyle = '#5a3a1a'; x.lineWidth = 2; x.strokeRect(sx - 15, sy - 20 + b, 30, 18); x.fillStyle = '#ffd166'; x.fillRect(sx - 16, sy - 15 + b, 32, 3); x.fillRect(sx - 3, sy - 18 + b, 6, 8); x.restore(); }


/* =================== 그리기 =================== */
let ov, cv, x, lay = { Z: 1, dpr: 1, cw: 800, ch: 450 }, IM = {}, NPCK = [];
const HC = [112, 120, 56, 100], HF = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'atk0', 'atk1', 'atk2', 'atk3', 'cast0', 'cast1', 'cast2', 'hurt', 'dodge', 'die0', 'die1'];
const MC = { mudfluff: [110, 110, 55, 96], bogpod: [96, 104, 48, 92], heronling: [104, 132, 52, 120], heron: [260, 300, 130, 282], fluff: [96, 96, 48, 84], fluffking: [240, 260, 120, 236], seed: [96, 104, 48, 92], bird: [104, 132, 52, 120], keeper: [196, 212, 98, 192] };
function loadImg(k, src) { return new Promise(ok => { const im = new Image(); im.onload = () => { IM[k] = im; LOADP.n++; ok(); }; im.onerror = () => { LOADP.n++; ok(); }; im.src = src; }); }
// 폰 로딩: 처음엔 꼭 필요한 그림만(약 1.4MB) 받고, 큰 보스 그림(둥지지기·우두머리)은 시작한 뒤 뒤에서 받는다
const LOADP = { n: 0, N: 10 }, LATE = ['keeper', 'fluffking', 'mudfluff', 'bogpod', 'heronling', 'heron'];
let assetsP = null;
function assets() {
  if (assetsP) return assetsP; const v = '?v=51eb43a4';
  const J = p => p.then(() => { LOADP.n++; });
  assetsP = Promise.all([...['heads', 'fluff', 'seed', 'bird', 'npc', 'props', 'icons'].map(k => loadImg(k, IMG + k + '.webp' + v)),
    J(fetch(IMG + 'props.json' + v).then(r => r.json()).then(j => { PM = j; })), J(fetch(IMG + 'npc.json' + v).then(r => r.json()).then(j => { NPCK = j; })), J(fetch(IMG + 'icons.json' + v).then(r => r.json()).then(j => { ICM = j; }).catch(() => {}))])
    .then(() => { LATE.reduce((p, k) => p.then(() => loadImg(k, IMG + k + '.webp' + v)), Promise.resolve()); });
  return assetsP;
}
// 영웅 그림은 고른 직업 것만 받는다(직업 5개 → 처음 화면은 얼굴 한 장)
const HEROP = {};
function loadHero(cls) { return HEROP[cls] || (HEROP[cls] = IM[cls] ? Promise.resolve() : new Promise(ok => { const im = new Image(); im.onload = () => { IM[cls] = im; ok(); }; im.onerror = () => { delete HEROP[cls]; ok(); }; im.src = IMG + cls + '.webp?v=51eb43a4'; })); }
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
  if (!G) { if (LOADP.n < LOADP.N) { const w = Math.min(320, cw * .6), k = LOADP.n / LOADP.N; x.fillStyle = 'rgba(30,40,60,.35)'; rr(cw / 2 - w / 2, ch / 2 + 10, w, 10, 5); x.fill(); x.fillStyle = '#fff'; rr(cw / 2 - w / 2, ch / 2 + 10, Math.max(10, w * k), 10, 5); x.fill();
      x.font = '800 22px system-ui'; x.textAlign = 'center'; x.fillStyle = '#3a5a7a'; x.fillText('끊어진 하늘', cw / 2, ch / 2 - 14); x.font = '600 12px system-ui'; x.fillStyle = '#5a6a80'; x.fillText('섬을 띄우는 중… ' + Math.round(k * 100) + '%', cw / 2, ch / 2 + 40); }
    return; }
  const Wd = G.Wd, P = G.P, V = view(), Z = V.Z;
  x.setTransform(dpr * Z, 0, 0, dpr * Z, dpr * V.ox, dpr * V.oy);
  // 화면에 보이는 칸 범위
  const corners = [[0, 0], [cw, 0], [0, ch + 200], [cw, ch + 200]].map(([sx, sy]) => unIso((sx - V.ox) / Z, (sy - V.oy) / Z));
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 1), x1 = Math.min(Wd.W - 1, Math.ceil(Math.max(...corners.map(c => c[0]))) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 1), y1 = Math.min(Wd.H - 1, Math.ceil(Math.max(...corners.map(c => c[1]))) + 1);
  // 섬: 뒤(위쪽) 섬부터 → 낭떠러지·윗면·풀 테두리, 그다음 다리
  const T = TILES, vr = [-V.ox / Z - 40, -V.oy / Z - 40, (cw - V.ox) / Z + 40, (ch - V.oy) / Z + 40];
  const order = Wd.order || (Wd.order = Wd.islands.slice().sort((p, q) => (p.cx + p.cy) - (q.cx + q.cy)));
  for (const s of order) { const g = islandGeo(Wd, s); if (g.maxx < vr[0] || g.minx > vr[2] || g.maxy < vr[1] || g.miny > vr[3]) continue; drawIsland(Wd, s, g, T); }
  for (const b of Wd.bridges) for (const i of b.all || (b.all = b.ends.concat(b.cells))) { const xx = i % Wd.W, yy = (i / Wd.W) | 0; if (xx < x0 || xx > x1 || yy < y0 || yy > y1) continue;
    const bm = (X, Y) => Wd.inb(X, Y) && Wd.bm[Wd.id(X, Y)], vert = (bm(xx, yy - 1) || bm(xx, yy + 1)) && !(bm(xx - 1, yy) || bm(xx + 1, yy)); const [sx, sy] = iso(xx, yy);
    x.drawImage((Wd.g[i] === 4 ? T.broken : T.bridge)[vert ? 1 : 0], sx - TW / 2, sy, TW, TH + 12); }
  drawBlight(Wd);
  // 바닥 효과(안개·깃발 범위·경고)
  for (const a of G.areas) {
    if (a.k === 'mist') { const [ax, ay] = iso(a.x, a.y), al = Math.min(1, a.t * 3, (a.life - a.t) * 2); x.fillStyle = `rgba(235,242,250,${.45 * al})`; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(ax + Math.sin(G.t + k) * 10, ay + Math.cos(G.t * .7 + k) * 5, a.r * TW / 2 * (.7 + k * .08), a.r * TH / 2 * (.7 + k * .08), 0, 0, TAU); x.fill(); } }
    if (a.k === 'flag') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = 'rgba(160,220,255,.6)'; x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41, a.r * TH / 2 * 1.41, 0, 0, TAU); x.stroke(); x.setLineDash([]); }
    if (a.k === 'warn') { const [ax, ay] = iso(a.x, a.y), k = a.t / a.life; x.fillStyle = `rgba(255,90,70,${.15 + k * .25})`; x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41 * k, a.r * TH / 2 * 1.41 * k, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,120,90,.8)'; x.lineWidth = 2; x.beginPath(); x.ellipse(ax, ay, a.r * TW / 2 * 1.41, a.r * TH / 2 * 1.41, 0, 0, TAU); x.stroke(); }
  }
  drawClsGround();
  for (const f of G.fx) if (f.k === 'crack') { const [ax, ay] = iso(f.x, f.y), al = Math.min(1, (f.life - f.t) * 1.5); x.strokeStyle = `rgba(70,46,24,${.7 * al})`; x.lineWidth = 2.2; x.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + .3, l = 30 + hsh(i, 4) * 40; x.moveTo(ax, ay); x.lineTo(ax + Math.cos(a) * l * .5, ay + Math.sin(a) * l * .25 + 3); x.lineTo(ax + Math.cos(a + .2) * l, ay + Math.sin(a + .2) * l * .5); } x.stroke(); x.fillStyle = `rgba(60,40,20,${.35 * al})`; x.beginPath(); x.ellipse(ax, ay, 26, 13, 0, 0, TAU); x.fill(); }
  for (const w of Wd.wps) { const [ax, ay] = iso(w.x, w.y); x.fillStyle = w.on ? 'rgba(160,230,255,.35)' : 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(ax, ay, 26, 13, 0, 0, TAU); x.fill(); x.strokeStyle = w.on ? '#9fe4ff' : '#d8d2c4'; x.lineWidth = 2; x.beginPath(); x.ellipse(ax, ay, 26 + (w.on ? Math.sin(G.t * 3) * 2 : 0), 13, 0, 0, TAU); x.stroke(); }
  // 정렬해서 그리기
  const L = [], vis = (ex, ey) => ex >= x0 - 3 && ex <= x1 + 3 && ey >= y0 - 3 && ey <= y1 + 3;
  for (const p of Wd.props) if (vis(p.x, p.y)) L.push([p.x + p.y, 0, p]);
  for (const m of G.mobs) if (vis(m.x, m.y)) L.push([m.x + m.y, 1, m]);
  for (const k in Wd.npcAt) { const [nx, ny] = Wd.npcAt[k]; if (vis(nx, ny)) L.push([nx + ny, 2, k]); }
  for (const d of G.drops) if (vis(d.x, d.y)) L.push([d.x + d.y - .3, 3, d]);
  for (const w of Wd.wps) L.push([w.x + w.y, 5, w]);
  for (const a of G.areas) if (a.k === 'echo' && vis(a.x, a.y)) L.push([a.x + a.y, 6, a]);
  if (G.chest && vis(G.chest.x, G.chest.y)) L.push([G.chest.x + G.chest.y, 7, G.chest]);
  L.push([P.x + P.y, 4, P]); L.sort((a, b) => a[0] - b[0]);
  const hs = .5; // 2배 아틀라스 → 1배
  for (const [, k, o] of L) {
    if (k === 0) { const m = PM[o.k]; if (!m) continue; const [sx, sy] = iso(o.x, o.y); { const r2 = Math.max(8, o.foot * TW * .62); x.fillStyle = 'rgba(28,46,20,.22)'; x.beginPath(); x.ellipse(sx + r2 * .12, sy + 1, r2, r2 * .48, 0, 0, TAU); x.fill(); } const fade = hyp(o.x - P.x, o.y - P.y) < 2.6 && o.x + o.y > P.x + P.y && m[3] > 220 ? .55 : 1; x.globalAlpha = fade; x.drawImage(IM.props, m[0], m[1], m[2], m[3], sx - m[4] * hs, sy - m[5] * hs, m[2] * hs, m[3] * hs); x.globalAlpha = 1; }
    else if (k === 1) drawMob(o);
    else if (k === 2) { const [sx, sy] = iso(G.Wd.npcAt[o][0], G.Wd.npcAt[o][1]); shadow(sx, sy, 12); sprite(IM.npc, HC[0], HC[1], HC[2], HC[3], Math.floor(G.t / .7 + o.length) % 2, NPCK.indexOf(o), sx, sy, hs); const Q = questMark(o); if (Q) { x.font = 'bold 15px system-ui'; x.textAlign = 'center'; x.fillStyle = Q === '?' ? '#ffd166' : '#fff'; x.strokeStyle = '#3a2a10'; x.lineWidth = 3; x.strokeText(Q, sx, sy - 54 + Math.sin(G.t * 4) * 2); x.fillText(Q, sx, sy - 54 + Math.sin(G.t * 4) * 2); } }
    else if (k === 3) drawDrop(o);
    else if (k === 4) drawHero(o);
    else if (k === 5) { const [sx, sy] = iso(o.x, o.y); drawVane(sx, sy, o.on); }
    else if (k === 6) drawEcho(o);
    else if (k === 7) { const [sx, sy] = iso(o.x, o.y); drawChest(o, sx, sy); }
  }
  drawBlightAir();
  // 투사체·효과
  for (const a of G.areas) if (a.k === 'vortex') drawVortex(a);
  for (const p of G.proj) drawProj(p); for (const f of G.fx) drawFx(f); drawParts(); drawClsAir();
  for (const a of G.areas) if (a.k === 'flag') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax, ay - 46); x.stroke(); x.fillStyle = a.fk === 0 ? '#9fe4ff' : '#b6f0a0'; x.beginPath(); x.moveTo(ax, ay - 46); x.quadraticCurveTo(ax + 14, ay - 46 + Math.sin(G.t * 6) * 3, ax + 26, ay - 40); x.lineTo(ax, ay - 32); x.fill(); }
  // 이름표
  x.textAlign = 'center';
  for (const d of G.drops) { if (!vis(d.x, d.y) || d.gold) continue; const [sx, sy] = iso(d.x, d.y), it = d.it; x.font = '600 10px system-ui'; const s = itemName(it), w = x.measureText(s).width + 8; x.fillStyle = 'rgba(20,16,10,.72)'; rr(sx - w / 2, sy - 24, w, 14, 4); x.fill(); x.fillStyle = itemColor(it); x.fillText(s, sx, sy - 13.5); }
  for (const t of G.txt) { const [sx, sy] = iso(t.x, t.y), a = Math.min(1, (1 - t.t) * 2.2), sc = t.pop ? 1 + Math.max(0, .18 - t.t) * (t.big ? 6 : 3.5) : 1; x.globalAlpha = a; x.font = (t.big ? '900 19px ' : t.small ? '700 10px ' : '800 14px ') + 'system-ui'; x.lineWidth = t.big ? 4 : 3; x.strokeStyle = t.big ? 'rgba(90,30,0,.9)' : 'rgba(30,20,10,.8)';
    const yy = sy - 40 - t.z * 10 - (t.pop ? 18 * (1 - Math.pow(1 - Math.min(1, t.t * 2.5), 2)) : t.t * 26); x.save(); x.translate(sx, yy); x.scale(sc, sc); x.strokeText(t.s, 0, 0); x.fillStyle = t.c; x.fillText(t.s, 0, 0); x.restore(); x.globalAlpha = 1; }
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (G.gloom > .01) { const g = G.gloom, R = Math.hypot(cw, ch) / 2, vg = x.createRadialGradient(cw / 2, ch / 2, R * .25, cw / 2, ch / 2, R);
    vg.addColorStop(0, `rgba(30,12,40,${.2 * g})`); vg.addColorStop(.55, `rgba(24,8,34,${.45 * g})`); vg.addColorStop(1, `rgba(10,3,18,${.85 * g})`); x.fillStyle = `rgba(28,10,40,${.22 * g})`; x.fillRect(0, 0, cw, ch); x.fillStyle = vg; x.fillRect(0, 0, cw, ch); }
  if (G.flash > 0) { x.fillStyle = `rgba(255,252,240,${Math.min(.55, G.flash * 2)})`; x.fillRect(0, 0, cw, ch); }
  if (G.cut) { const k = G.cut.t, inn = Math.min(1, k * 6), out = Math.max(0, (k - 1) * 4), a = inn * (1 - out), yy = ch * .19; x.globalAlpha = a; const gr = x.createLinearGradient(0, 0, cw, 0); gr.addColorStop(0, 'rgba(30,24,18,0)'); gr.addColorStop(.25, 'rgba(30,24,18,.75)'); gr.addColorStop(.75, 'rgba(30,24,18,.75)'); gr.addColorStop(1, 'rgba(30,24,18,0)'); x.fillStyle = gr; x.fillRect(0, yy - 30, cw, 60);
    x.fillStyle = G.cut.c; x.fillRect(0, yy - 30, cw, 2); x.fillRect(0, yy + 28, cw, 2); x.font = '900 30px system-ui'; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = 'rgba(20,14,8,.9)'; const sx = cw / 2 + (1 - inn) * 120 - out * 60; x.strokeText(G.cut.s, sx, yy + 11); x.fillStyle = G.cut.c; x.fillText(G.cut.s, sx, yy + 11); x.globalAlpha = 1; }
  hud();
}
/* ---------- 둥근 섬(낭떠러지는 아래로 좁아지는 바위) ---------- */
function islandGeo(Wd, s) {
  if (s.geo) return s.geo;
  const pts = s.poly.map(([a, b]) => iso(a, b)), n = pts.length; let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const [a, b] of pts) { minx = Math.min(minx, a); maxx = Math.max(maxx, a); miny = Math.min(miny, b); maxy = Math.max(maxy, b); }
  const mid = (minx + maxx) / 2, hw = (maxx - minx) / 2 + 1, rock = s.kind === 'rock', H = rock ? 30 + s.r * 12 : 40 + s.r * 9, sd = s.k * 13.7;
  const dep = pts.map(([a], i) => { const u = (a - mid) / hw, f = Math.pow(Math.max(0, 1 - u * u), .7); return H * (.2 + .8 * f) * (.84 + .1 * Math.sin(i * .7 + sd) + .07 * Math.sin(i * 1.9 + sd * 2) + .05 * Math.sin(i * 4.1 + sd)); });
  const top = new Path2D(), cliff = new Path2D(), shade = [0, 1, 2, 3, 4].map(() => new Path2D()), strata = [new Path2D(), new Path2D()], band = new Path2D(), lip = new Path2D(), edge = new Path2D(), stones = new Path2D(), hi = new Path2D(), roots = new Path2D();
  pts.forEach(([a, b], i) => i ? top.lineTo(a, b) : top.moveTo(a, b)); top.closePath();
  const F = []; // 앞쪽 변 번호
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, [ax, ay] = pts[i], [bx, by] = pts[j], ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1, nx = ey / l, ny = -ex / l;
    if (ny <= -.02) continue; F.push(i);
    const q = new Path2D(); q.moveTo(ax, ay); q.lineTo(bx, by); q.lineTo(bx, by + dep[j]); q.lineTo(ax, ay + dep[i]); q.closePath(); cliff.addPath(q); shade[clamp(Math.round((nx + 1) * 2), 0, 4)].addPath(q);
    band.moveTo(ax, ay + 4); band.lineTo(bx, by + 4); edge.moveTo(ax, ay); edge.lineTo(bx, by);
    let o = 9, k = 0; for (const st of [6, 9, 12, 15, 19, 24]) { o += st; if (o < Math.min(dep[i], dep[j]) - 3) { strata[k & 1].moveTo(ax, ay + o); strata[k & 1].lineTo(bx, by + o); } k++; }
    const h = hsh(s.k * 31 + i, 5); // 풀 끝 늘어짐
    for (let t = 0; t < 1; t += .5) { const px = lerp(ax, bx, t), py = lerp(ay, by, t), w = 2.4 + hsh(i, t * 9) * 2.4, d = 2.5 + hsh(t * 7 + i, 3) * 4.5; lip.moveTo(px - w, py - 1); lip.lineTo(px, py + d); lip.lineTo(px + w, py - 1); lip.closePath(); }
    if (h < .22 && dep[i] > 18) { const sy2 = ay + dep[i] * (.3 + hsh(i, 8) * .5), r = 2.5 + hsh(i, 9) * 4; stones.moveTo(ax + r, sy2); stones.ellipse(ax, sy2, r, r * .7, 0, 0, TAU); hi.moveTo(ax - r * .2 + r * .5, sy2 - r * .3); hi.ellipse(ax - r * .2, sy2 - r * .3, r * .5, r * .28, 0, 0, TAU); }
    if (h > .9 && !rock) { const L = 10 + hsh(i, 11) * Math.min(34, dep[i] * .6); roots.moveTo(ax, ay + 3); roots.quadraticCurveTo(ax + 5 * (hsh(i, 12) - .5) * 2, ay + L * .5, ax - 3 + hsh(i, 13) * 6, ay + L); }
  }
  const cells = []; let cx0 = 1e9, cx1 = -1e9, cy0 = 1e9, cy1 = -1e9; for (const [a, b] of s.poly) { cx0 = Math.min(cx0, a); cx1 = Math.max(cx1, a); cy0 = Math.min(cy0, b); cy1 = Math.max(cy1, b); }
  for (let yy = Math.floor(cy0) - 1; yy <= cy1 + 1; yy++) for (let xx = Math.floor(cx0) - 1; xx <= cx1 + 1; xx++) { if (!Wd.inb(xx, yy)) continue; const i = Wd.id(xx, yy), t = Wd.g[i]; if (t === 3 || t === 4) continue;
    if (Wd.isl[i] === s.k) { cells.push([xx, yy, t, 1]); continue; } if (t) continue; let nb = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (Wd.inb(xx + ox, yy + oy) && Wd.isl[Wd.id(xx + ox, yy + oy)] === s.k) nb = 1; if (nb) cells.push([xx, yy, 1, 0]); }
  const grad = x.createLinearGradient(0, miny, 0, maxy + H); grad.addColorStop(0, 'rgba(40,30,40,0)'); grad.addColorStop(.45, 'rgba(40,30,40,.12)'); grad.addColorStop(1, 'rgba(36,30,50,.55)');
  s.geo = { pts, top, cliff, shade, strata, band, lip, edge, stones, hi, roots, cells, grad, minx, maxx, miny, maxy: maxy + H, rock };
  return s.geo;
}
const SHADE = ['rgba(255,236,200,.2)', 'rgba(255,236,200,.08)', 'rgba(0,0,0,0)', 'rgba(20,12,8,.16)', 'rgba(20,12,8,.32)'];
/* ---------- 밑것 둥지: 시든 땅·보랏빛 안개 ---------- */
function blightShape(pk) { // 무리마다 고정된 얼룩 모양(겹친 타원) + 가시덤불 자리
  if (pk.bs) return pk.bs; const R = blightR(pk), sd = Math.round(pk.x * 7 + pk.y * 13), blobs = [], brm = [];
  for (let i = 0; i < 7; i++) { const a = hsh(sd, i) * TAU, d = i ? R * (.25 + hsh(sd, i + 9) * .45) : 0; blobs.push([pk.x + Math.cos(a) * d, pk.y + Math.sin(a) * d, R * (i ? .45 + hsh(sd, i + 20) * .3 : .8)]); }
  const nb = pk.nest ? 16 : 6; for (let i = 0; i < nb; i++) { const a = hsh(sd, i + 40) * TAU, d = Math.sqrt(hsh(sd, i + 60)) * R * .85, bx = pk.x + Math.cos(a) * d, by = pk.y + Math.sin(a) * d; if (walk(G.Wd, bx, by)) brm.push([bx, by, hsh(sd, i + 80)]); }
  return pk.bs = { blobs, brm };
}
function drawBlight(Wd) {
  for (const pk of G.packs) { const b = pk.bl || 0; if (b < .02) continue; const S = Wd.islands[pk.isl], g = islandGeo(Wd, S), bs = blightShape(pk);
    x.save(); x.clip(g.top);
    x.globalCompositeOperation = 'saturation'; x.fillStyle = `rgba(128,128,128,${.75 * b})`; // 시든 땅: 색이 빠짐
    for (const [bx, by, r] of bs.blobs) { const [ax, ay] = iso(bx, by), rx = r * TW / 2 * 1.2; x.beginPath(); x.ellipse(ax, ay, rx, rx * .5, 0, 0, TAU); x.fill(); }
    x.globalCompositeOperation = 'source-over';
    for (const [bx, by, r] of bs.blobs) { const [ax, ay] = iso(bx, by), rx = r * TW / 2 * 1.41, gr = x.createRadialGradient(ax, ay, 0, ax, ay, rx); gr.addColorStop(0, `rgba(34,18,40,${.5 * b})`); gr.addColorStop(.6, `rgba(48,30,44,${.3 * b})`); gr.addColorStop(1, 'rgba(48,30,44,0)');
      x.fillStyle = gr; x.save(); x.translate(ax, ay); x.scale(1, .5); x.translate(-ax, -ay); x.beginPath(); x.arc(ax, ay, rx, 0, TAU); x.fill(); x.restore(); }
    // 시든 가시덤불·금
    x.lineCap = 'round';
    for (const [bx, by, h] of bs.brm) { const [ax, ay] = iso(bx, by); x.globalAlpha = b; x.strokeStyle = '#1e1418'; x.lineWidth = 1.6; x.beginPath();
      for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + (k - 1.5) * .55 + (h - .5) * .4, L = 7 + h * 6 + (k % 2) * 4; x.moveTo(ax, ay); x.quadraticCurveTo(ax + Math.cos(a) * L * .4, ay + Math.sin(a) * L * .7, ax + Math.cos(a) * L, ay + Math.sin(a) * L * .9); } x.stroke();
      x.fillStyle = '#7a2a3a'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(ax + (k - 1) * 4, ay - 6 - k * 2, 1.1, 0, TAU); x.fill(); } }
    if (pk.nest) { const [ax, ay] = iso(pk.x, pk.y); x.globalAlpha = b; x.strokeStyle = 'rgba(160,80,220,.45)'; x.lineWidth = 1.4; x.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + .4, L = 30 + hsh(i, 7) * 26; x.moveTo(ax, ay); x.lineTo(ax + Math.cos(a) * L * .5, ay + Math.sin(a) * L * .25 + 2); x.lineTo(ax + Math.cos(a + .25) * L, ay + Math.sin(a + .25) * L * .5); } x.stroke(); }
    // 낮게 깔린 보랏빛 안개
    x.globalAlpha = 1; for (let k = 0; k < (pk.nest ? 5 : 2); k++) { const [ax, ay] = iso(pk.x + Math.sin(G.t * .3 + k * 2) * 1.2, pk.y + Math.cos(G.t * .25 + k * 1.3) * 1.2), rx = blightR(pk) * TW * .45 * (.6 + k * .1);
      x.fillStyle = `rgba(110,70,140,${.12 * b})`; x.beginPath(); x.ellipse(ax, ay, rx, rx * .42, 0, 0, TAU); x.fill(); }
    x.restore(); }
  x.globalAlpha = 1;
}
function drawBlightAir() { // 둥지 위로 떠오르는 보랏빛 티끌
  for (const pk of G.packs) { const b = pk.bl || 0; if (b < .05 || !pk.nest) continue; const R = blightR(pk), sd = pk.x * 3 + pk.y;
    for (let i = 0; i < 14; i++) { const k = (G.t * (.25 + hsh(sd, i) * .2) + hsh(sd, i + 5)) % 1, a = hsh(sd, i + 9) * TAU, d = Math.sqrt(hsh(sd, i + 11)) * R * .8, [ax, ay] = iso(pk.x + Math.cos(a) * d, pk.y + Math.sin(a) * d);
      x.globalAlpha = Math.sin(k * Math.PI) * .8 * b; x.fillStyle = i % 3 ? '#b77aff' : '#ff9a6a'; x.beginPath(); x.arc(ax + Math.sin(G.t * 2 + i) * 4, ay - k * 60, 1.5 + (i % 2), 0, TAU); x.fill(); } }
  x.globalAlpha = 1;
}
function drawIsland(Wd, s, g, T) { const c = islandTop(Wd, s, g, T); x.drawImage(c, g.tox, g.toy, g.tw, g.th); }
function drawCliff(g) {
  x.fillStyle = g.rock ? '#8a7c70' : '#7a5a3c'; x.fill(g.cliff);
  x.save(); x.clip(g.cliff);
  x.strokeStyle = g.rock ? 'rgba(60,50,45,.35)' : 'rgba(60,38,20,.35)'; x.lineWidth = 2.2; x.stroke(g.strata[0]); x.strokeStyle = g.rock ? 'rgba(220,210,200,.16)' : 'rgba(240,210,170,.16)'; x.lineWidth = 1.6; x.stroke(g.strata[1]);
  for (let i = 0; i < 5; i++) if (i !== 2) { x.fillStyle = SHADE[i]; x.fill(g.shade[i]); }
  x.fillStyle = g.grad; x.fill(g.cliff);
  x.fillStyle = 'rgba(150,140,132,.75)'; x.fill(g.stones); x.fillStyle = 'rgba(235,230,220,.35)'; x.fill(g.hi);
  x.strokeStyle = 'rgba(70,44,22,.85)'; x.lineWidth = 6; x.stroke(g.band);
  x.restore();
  if (!g.rock) { x.strokeStyle = 'rgba(96,120,58,.8)'; x.lineWidth = 1.3; x.stroke(g.roots); }
}
const TOPC = [];
function islandTop(Wd, s, g, T) {
  const S = Math.min(T.S, 1.6);
  if (g.tc && g.tcS === S) { const i = TOPC.indexOf(g); if (i >= 0) { TOPC.splice(i, 1); TOPC.push(g); } return g.tc; }
  while (TOPC.length >= 5) { const o = TOPC.shift(); o.tc = null; }
  const pad = 10, w = g.maxx - g.minx + pad * 2, h = g.maxy - g.miny + pad * 2;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S); const gx = c.getContext('2d'); gx.setTransform(S, 0, 0, S, (pad - g.minx) * S, (pad - g.miny) * S);
  const ox = x; x = gx; drawCliff(g);
  x.save(); x.clip(g.top);
  for (const [xx, yy, t] of g.cells) { const [sx, sy] = iso(xx, yy), hh = hsh(xx, yy), cc = clamp(Math.floor(Wd.nz(xx * .18 + 3, yy * .18) * 6), 0, 5);
    if (t === 5) x.drawImage(T.plaza[Math.floor(hh * 3)], sx - TW / 2, sy, TW, TH); else x.drawImage(T.grass[cc * 2 + (t === 2 ? 0 : hh > .5 ? 1 : 0)], sx - TW / 2, sy, TW, TH); }
  for (const [xx, yy, t] of g.cells) if (t === 2) { const [sx, sy] = iso(xx, yy); x.drawImage(T.dirt[Math.floor(hsh(xx, yy) * 3)], sx - TW * .8, sy + TH / 2 - TH * .8, TW * 1.6, TH * 1.6); }
  for (const [xx, yy, t, own] of g.cells) { if (t !== 1 || !own) continue; const [sx, sy] = iso(xx, yy), hh = hsh(xx, yy);
    if (hh < .22) x.drawImage(T.tuft[Math.floor(hh * 18) % 4], sx - 8 + (hsh(yy, xx) - .5) * 30, sy + 8 + hsh(xx + 7, yy) * 12, 16, 12); else if (hh > .93 && s.k !== Wd.town) x.drawImage(T.flower[Math.floor(hh * 100) % 3], sx - 7 + (hsh(yy, xx) - .5) * 26, sy + 6 + hsh(xx + 3, yy) * 12, 14, 14); }
  if (s.kind === 'marsh' || s.kind === 'heron') { // 늪: 탁한 풀빛 + 물웅덩이
    x.fillStyle = s.kind === 'heron' ? 'rgba(60,60,70,.22)' : 'rgba(50,80,50,.2)'; x.fill(g.top);
    for (const [xx, yy, t, own] of g.cells) { if (!own || hsh(xx + 11, yy) > .1) continue; const [sx, sy] = iso(xx, yy), r = 10 + hsh(xx, yy + 5) * 14; x.fillStyle = 'rgba(70,110,120,.55)'; x.beginPath(); x.ellipse(sx, sy + TH / 2, r, r * .45, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(200,230,240,.35)'; x.beginPath(); x.ellipse(sx - r * .25, sy + TH / 2 - 2, r * .4, r * .12, 0, 0, TAU); x.fill(); } }
  x.strokeStyle = 'rgba(255,255,220,.22)'; x.lineWidth = 3; x.stroke(g.top);
  x.restore();
  // 풀 테두리(낭떠러지 위로 살짝 늘어짐)
  x.fillStyle = g.rock ? '#7da850' : '#6aa244'; x.fill(g.lip); x.strokeStyle = g.rock ? '#5f8a3a' : '#4f8432'; x.lineWidth = 1.6; x.stroke(g.edge);
  x = ox;
  g.tc = c; g.tcS = S; g.tox = g.minx - pad; g.toy = g.miny - pad; g.tw = w; g.th = h; TOPC.push(g); return c;
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
  drawClsHero(P, sx, sy);
  if (P.buf.hold) { x.strokeStyle = 'rgba(255,210,120,.7)'; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy, 18, 9, 0, 0, TAU); x.stroke(); }
  const a = P.dodge > 0 ? .75 : P.inv0 > 0 ? .6 + Math.sin(G.t * 30) * .3 : 1;
  const jz = P.jump > 0 ? Math.sin((1 - P.jump / .48) * Math.PI) * 46 : 0;
  sprite(IM[P.cls], HC[0], HC[1], HC[2], HC[3], heroFrame(P), P.dir, sx, sy - jz, .5, P.hurt > .15 ? .1 : 0, a);
  drawClsHero(P, sx, sy - jz, 1);
}
function drawMob(m) {
  if (!IM[m.D.spr]) { const [sx, sy] = iso(m.x, m.y); shadow(sx, sy, m.D.boss ? 36 : 24); return; } // 큰 그림 받는 중
  const D = m.D, c = MC[D.spr], [sx, sy0] = iso(m.x, m.y), sy = sy0 + (m.fy || 0) * 30;
  const a = m.dead ? Math.max(0, 1 - Math.max(0, m.at - .5) * 1.6) * (m.fl ? Math.max(0, 1 - m.fy * .4) : 1) : 1;
  if (!m.fl) shadow(sx, sy0, D.boss ? 36 : D.mini ? 26 : D.fly ? 9 : m.elite ? 14 : 11);
  if (m.elite && !m.dead) { // 정예: 발밑에서 기운이 피어오름
    const pu = .5 + Math.sin(G.t * 5 + m.id * 9) * .5, ag = x.createRadialGradient(sx, sy0, 2, sx, sy0, 26); ag.addColorStop(0, m.E[1] + 'aa'); ag.addColorStop(1, m.E[1] + '00'); x.fillStyle = ag; x.beginPath(); x.ellipse(sx, sy0, 26, 13, 0, 0, TAU); x.fill();
    x.strokeStyle = m.E[1]; x.globalAlpha = .55 + pu * .4; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy0, 18 + pu * 3, 9 + pu * 1.5, 0, 0, TAU); x.stroke();
    for (let i = 0; i < 4; i++) { const k = (G.t * .8 + i / 4 + m.id) % 1, a = i * 1.7 + m.id * 5; x.globalAlpha = (1 - k) * .9; x.fillStyle = m.E[1]; x.beginPath(); x.arc(sx + Math.cos(a) * 12, sy0 - k * 44, 1.8, 0, TAU); x.fill(); } x.globalAlpha = 1; }
  const sc0 = .5 * (m.fl ? Math.max(.2, 1 - m.fy * .25) : 1) * (m.elite ? 1.22 : 1), q = m.sq > 0 ? m.sq / .2 : 0;
  if (q) { x.save(); x.translate(sx, sy); x.scale(1 + q * .16, 1 - q * .14); x.translate(-sx, -sy); }
  if (m.elite && !m.dead) { x.shadowColor = m.E[1]; x.shadowBlur = 10; }
  sprite(IM[D.spr], c[0], c[1], c[2], c[3], mobFrame(m), m.dir, sx + (q ? rnd(-1.5, 1.5) : 0), sy, sc0, m.flash, a);
  x.shadowBlur = 0;
  if (q) x.restore();
  if (!m.dead && (m.hp < m.mhp || m.elite) && !D.big) { const w = 26, f = m.hp / m.mhp, top = sy - c[3] * .5 * (m.elite ? 1.22 : 1) - 2; x.fillStyle = 'rgba(20,14,10,.7)'; x.fillRect(sx - w / 2 - 1, top - 1, w + 2, 5); x.fillStyle = m.elite ? m.E[1] : '#e85a4a'; x.fillRect(sx - w / 2, top, w * f, 3);
    if (m.elite) { x.font = '700 9px system-ui'; x.textAlign = 'center'; x.fillStyle = m.E[1]; x.strokeStyle = 'rgba(20,14,10,.8)'; x.lineWidth = 2.5; const s = m.E[0] + ' ' + D.n; x.strokeText(s, sx, top - 4); x.fillText(s, sx, top - 4); } }
  if (m.stun > 0 && !m.dead) { x.fillStyle = '#ffe08a'; for (let i = 0; i < 3; i++) { const a2 = G.t * 5 + i * TAU / 3; x.beginPath(); x.arc(sx + Math.cos(a2) * 9, sy - c[3] * .42 + Math.sin(a2) * 3, 2, 0, TAU); x.fill(); } }
}
function drawDrop(d) {
  const [sx, sy] = iso(d.x, d.y), b = Math.max(0, .35 - d.t) * 60;
  if (d.gold) { x.fillStyle = '#ffd166'; x.strokeStyle = '#8a6a1a'; x.lineWidth = 1; for (let i = 0; i < Math.min(4, 1 + d.gold / 10); i++) { x.beginPath(); x.ellipse(sx - 4 + i * 3, sy - 3 - b - i * 1.5, 4, 2.4, 0, 0, TAU); x.fill(); x.stroke(); } return; }
  const it = d.it, col = itemColor(it); x.fillStyle = col; x.globalAlpha = .25 + Math.sin(G.t * 4) * .1; x.beginPath(); x.ellipse(sx, sy, 12, 6, 0, 0, TAU); x.fill(); x.globalAlpha = 1;
  if (!it.g && it.r >= 2) { const h = 70 + Math.sin(G.t * 3) * 6, gr = x.createLinearGradient(0, sy - h, 0, sy); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, col); x.globalAlpha = .55; x.fillStyle = gr; x.fillRect(sx - 4, sy - h, 8, h); x.globalAlpha = .25; x.fillRect(sx - 9, sy - h * .7, 18, h * .7); x.globalAlpha = 1; }
  drawIcon(it, sx - 11, sy - 18 - b, 22);
}
// 아이템 그림: 바탕 그림 + 대표 옵션 색 물들이기 + 옵션 표시(작은 문양) + 등급·강화·축복 빛
const AFXV = { dmgp: ['#ff7a5a', 'fist'], str: ['#ff7a5a', 'fist'], mind: ['#ff7a5a', 'fist'], kb: ['#ffb04a', 'fist'], crit: ['#ffd23a', 'bolt'], aspd: ['#ffe08a', 'feather'], move: ['#9ee68a', 'feather'], agi: ['#9ee68a', 'feather'],
  hp: ['#ff6a7a', 'heart'], vit: ['#ff6a7a', 'heart'], lifek: ['#ff6a7a', 'heart'], ac: ['#b8c8d8', 'shield'], blk: ['#b8c8d8', 'shield'], res: ['#b8c8d8', 'shield'], thorn: ['#8ad06a', 'thorn'],
  wind: ['#7fd0f0', 'swirl'], wreg: ['#7fd0f0', 'swirl'], windk: ['#7fd0f0', 'swirl'], spi: ['#7fd0f0', 'swirl'], xp: ['#c9a8ff', 'star'], find: ['#ffd166', 'eye'], sk0: ['#ffcf7a', 'star'], sk1: ['#ffcf7a', 'star'], sk2: ['#ffcf7a', 'star'] };
const TINTC = {};
function tinted(k, col, a) { const key = k + col + a; if (TINTC[key]) return TINTC[key]; const m = ICM[k]; if (!m || !IM.icons) return null; const c = document.createElement('canvas'); c.width = m[2]; c.height = m[3]; const g = c.getContext('2d'); g.drawImage(IM.icons, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, m[2], m[3]); return TINTC[key] = c; }
function mainAfx(it) { if (it.g || !it.id) return null; const L = it.u ? UNIQ.find(u => u.id === it.u).fx : it.set ? SETS[it.set].bonus[0][1] : it.af; if (!L || !L.length) return null; return L[0][0]; }
function emblem(g, kind, cx, cy, r, col) {
  g.save(); g.fillStyle = 'rgba(30,22,14,.82)'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = Math.max(1, r * .16); g.stroke(); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; const q = r * .55;
  g.beginPath();
  if (kind === 'heart') { g.moveTo(cx, cy + q); g.bezierCurveTo(cx - q * 1.5, cy - q * .2, cx - q * .6, cy - q * 1.2, cx, cy - q * .4); g.bezierCurveTo(cx + q * .6, cy - q * 1.2, cx + q * 1.5, cy - q * .2, cx, cy + q); g.fill(); }
  else if (kind === 'bolt') { g.moveTo(cx + q * .3, cy - q); g.lineTo(cx - q * .5, cy + q * .1); g.lineTo(cx, cy + q * .1); g.lineTo(cx - q * .3, cy + q); g.lineTo(cx + q * .5, cy - q * .1); g.lineTo(cx, cy - q * .1); g.closePath(); g.fill(); }
  else if (kind === 'shield') { g.moveTo(cx, cy - q); g.lineTo(cx + q * .85, cy - q * .55); g.quadraticCurveTo(cx + q * .8, cy + q * .5, cx, cy + q); g.quadraticCurveTo(cx - q * .8, cy + q * .5, cx - q * .85, cy - q * .55); g.closePath(); g.fill(); }
  else if (kind === 'swirl') { g.lineWidth = r * .2; g.arc(cx, cy, q * .9, .3, 4.6); g.stroke(); g.beginPath(); g.arc(cx + q * .1, cy, q * .4, 3.4, 7.5); g.stroke(); }
  else if (kind === 'feather') { g.ellipse(cx, cy, q * .35, q, .7, 0, TAU); g.fill(); g.strokeStyle = 'rgba(30,22,14,.8)'; g.lineWidth = r * .1; g.beginPath(); g.moveTo(cx - q * .6, cy + q * .7); g.lineTo(cx + q * .5, cy - q * .6); g.stroke(); }
  else if (kind === 'fist') { g.moveTo(cx - q, cy + q * .2); g.lineTo(cx, cy - q); g.lineTo(cx + q, cy + q * .2); g.lineTo(cx + q * .4, cy + q * .2); g.lineTo(cx + q * .4, cy + q); g.lineTo(cx - q * .4, cy + q); g.lineTo(cx - q * .4, cy + q * .2); g.closePath(); g.fill(); }
  else if (kind === 'thorn') { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; g.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); g.lineTo(cx + Math.cos(a + .6) * q * .35, cy + Math.sin(a + .6) * q * .35); g.lineTo(cx + Math.cos(a - .6) * q * .35, cy + Math.sin(a - .6) * q * .35); } g.fill(); }
  else if (kind === 'eye') { g.ellipse(cx, cy, q, q * .55, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(30,22,14,.9)'; g.beginPath(); g.arc(cx, cy, q * .3, 0, TAU); g.fill(); }
  else { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr2 = i % 2 ? q * .45 : q; g.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } g.closePath(); g.fill(); }
  g.restore();
}
function drawIcon(it, X, Y, s, g) { g = g || x; const k = it.g ? GOODS[it.g].ic : BASE[it.b].ic, m = ICM[k];
  if (!m || !IM.icons) { g.fillStyle = itemColor(it); g.beginPath(); g.arc(X + s / 2, Y + s / 2, s * .32, 0, TAU); g.fill(); return; }
  const live = g === x && G, cx = X + s / 2, cy = Y + s / 2;
  if (!it.g) { // 뒤쪽 빛: 축복 금빛, 저주 보랏빛, 강화 +4 하늘빛 / +7 금빛, 이름난 이상 등급 빛
    const glow = it.st === -1 && it.id ? '#8a4ac8' : it.st === 1 ? '#ffe08a' : it.en >= 7 ? '#ffd166' : it.en >= 4 ? '#9fe4ff' : it.r >= 2 ? RAR[it.r].c : null;
    if (glow) { const p = live ? .75 + Math.sin(G.t * 4) * .25 : 1, gr = g.createRadialGradient(cx, cy, s * .1, cx, cy, s * .55); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = .55 * p; g.fillStyle = gr; g.fillRect(X - s * .05, Y - s * .05, s * 1.1, s * 1.1); g.globalAlpha = 1; } }
  const ma = mainAfx(it), v = ma && AFXV[ma], tc = v ? tinted(k, v[0], it.u ? .45 : it.r >= 2 ? .38 : .28) : null;
  if (tc) g.drawImage(tc, X, Y, s, s); else g.drawImage(IM.icons, m[0], m[1], m[2], m[3], X, Y, s, s);
  if (it.g) return;
  if (v && s >= 20) emblem(g, v[1], X + s * .2, Y + s * .8, s * .21, v[0]);
  if (it.u && it.id) { g.fillStyle = '#ffe9b0'; for (let i = 0; i < 3; i++) { const a = (live ? G.t * 2 : 0) + i * 2.1; g.globalAlpha = .9; g.beginPath(); g.arc(cx + Math.cos(a) * s * .38, cy + Math.sin(a) * s * .38, s * .035, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  if (!it.id && s >= 20) { g.font = `900 ${s * .34}px system-ui`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(30,22,14,.85)'; g.strokeText('?', X + s * .82, Y + s * .34); g.fillStyle = '#ffe08a'; g.fillText('?', X + s * .82, Y + s * .34); }
}
function drawProj(p) {
  const [sx, sy] = iso(p.x, p.y), Y = sy - 22;
  if (p.k === 'wind') { x.strokeStyle = 'rgba(230,248,255,.9)'; x.lineWidth = 2.2; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(sx, Y, 4 + i * 3, G.t * 12 + i, G.t * 12 + i + 2.2); x.stroke(); } }
  else if (p.k === 'bolt') { const [ex, ey] = iso(p.x - p.vx * .04, p.y - p.vy * .04); x.strokeStyle = '#fff6b0'; x.lineWidth = 3; x.shadowColor = '#ffe066'; x.shadowBlur = 10; x.beginPath(); x.moveTo(ex, ey - 22); x.lineTo(sx, Y); x.stroke(); x.shadowBlur = 0; }
  else if (p.k === 'arrow') { const [ex, ey] = iso(p.x - p.vx * .035, p.y - p.vy * .035); x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(ex, ey - 22); x.lineTo(sx, Y); x.stroke(); x.fillStyle = '#e8eef4'; x.beginPath(); x.arc(sx, Y, 2.4, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(ex, ey - 22); x.lineTo(lerp(ex, sx, -1), lerp(ey, sy, -1) - 22); x.stroke(); }
  else if (p.k === 'twister') { for (let i = 0; i < 7; i++) { const r = 6 + i * 3.2, yy = sy - i * 7; x.strokeStyle = `rgba(225,242,252,${.85 - i * .08})`; x.lineWidth = 2.4; x.beginPath(); x.ellipse(sx + Math.sin(G.t * 9 + i) * 3, yy, r, r * .38, 0, G.t * 14 + i, G.t * 14 + i + 4.4); x.stroke(); } }
}
function drawFx(f) {
  if (f.t < 0) return; const k = f.t / f.life, [sx, sy] = iso(f.x, f.y);
  if (f.k === 'ring') { x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 3; x.beginPath(); x.ellipse(sx, sy, f.r * TW / 2 * 1.41 * (.4 + k * .6), f.r * TH / 2 * 1.41 * (.4 + k * .6), 0, 0, TAU); x.stroke(); x.globalAlpha = 1; }
  else if (f.k === 'thrust') { const [ex, ey] = iso(f.x + f.dx * f.len, f.y + f.dy * f.len); x.strokeStyle = `rgba(255,250,235,${1 - k})`; x.lineWidth = 4 * (1 - k) + 1; x.beginPath(); x.moveTo(sx, sy - 20); x.lineTo(ex, ey - 20); x.stroke(); }
  else if (f.k === 'gust' || f.k === 'bash') { const a0 = Math.atan2(...(() => { const [ax, ay] = iso(f.dx, f.dy); return [ay, ax]; })()); x.strokeStyle = f.k === 'gust' ? `rgba(230,246,255,${.9 - k})` : `rgba(255,220,150,${.9 - k})`; x.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { const a = a0 + (i / 5 - .5) * f.arc, r = f.r * 32 * (.4 + k * .7); x.beginPath(); x.ellipse(sx, sy - 14, r, r * .5, 0, a - .15, a + .15); x.stroke(); } }
  else if (f.k === 'zap') { const [ex, ey] = iso(f.x2, f.y2); x.strokeStyle = f.c || `rgba(255,246,170,${1 - k})`; x.globalAlpha = f.c ? 1 - k : 1; x.lineWidth = 2.5; x.shadowColor = f.c || '#ffe066'; x.shadowBlur = 8; x.beginPath(); x.moveTo(sx, sy - 22); for (let i = 1; i < 6; i++) { const t = i / 6; x.lineTo(lerp(sx, ex, t) + rnd(-6, 6), lerp(sy, ey, t) - 22 + rnd(-6, 6)); } x.lineTo(ex, ey - 22); x.stroke(); x.shadowBlur = 0; x.globalAlpha = 1; }
  else if (f.k === 'pop') { x.fillStyle = f.c; x.globalAlpha = 1 - k; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.beginPath(); x.arc(sx + Math.cos(a) * k * 14, sy - 20 + Math.sin(a) * k * 9, 2.4 * (1 - k) + .5, 0, TAU); x.fill(); } x.globalAlpha = 1; }
  else if (f.k === 'aura') { x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy - k * 30 - i * 8, 16 - i * 3, 7 - i, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  else if (f.k === 'lvl') { x.strokeStyle = '#ffd166'; x.globalAlpha = 1 - k; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy - k * 50 - i * 12, 20 + i * 4, 9 + i * 2, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  else if (f.k === 'hit') { const Y = sy - f.z, r = (f.big ? 36 : 24) * (.3 + k * .9); x.globalCompositeOperation = 'lighter'; { const gl = x.createRadialGradient(sx, Y, 0, sx, Y, f.big ? 34 : 22); gl.addColorStop(0, f.c); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = (1 - k) * .8; x.fillStyle = gl; x.fillRect(sx - 40, Y - 40, 80, 80); } x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1 - k; x.strokeStyle = f.c; x.lineWidth = (f.big ? 4 : 2.6) * (1 - k) + .5; x.beginPath(); x.ellipse(sx, Y, r, r * .6, 0, 0, TAU); x.stroke();
    x.fillStyle = '#fff'; x.globalAlpha = (1 - k) * .95; x.beginPath(); const rs = (f.big ? 20 : 13) * (1 - k * .8); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr2 = i % 2 ? rs * .35 : rs; x.lineTo(sx + Math.cos(a) * rr2 * 1.4, Y + Math.sin(a) * rr2); } x.closePath(); x.fill(); x.globalAlpha = 1; }
  else if (f.k === 'slash') { const [ex, ey] = iso(f.dx, f.dy), a0 = Math.atan2(ey, ex), R = f.len * 30, sw = f.s ? 1 : -1; x.save(); x.translate(sx, sy - 22); x.scale(1, .62);
    const a1 = a0 - 1.1 * sw + 2.2 * sw * Math.min(1, k * 2.4); x.globalAlpha = 1 - k; const gr = x.createLinearGradient(-R, 0, R, 0); x.strokeStyle = 'rgba(255,248,225,.95)'; x.lineCap = 'round';
    for (let i = 0; i < 6; i++) { x.lineWidth = (7 - i) * (1 - k) + .5; x.globalAlpha = (1 - k) * (1 - i * .14); x.beginPath(); x.arc(0, 0, R * (.82 + i * .03), a1 - .12 * sw * (i + 1), a1 - .12 * sw * i, sw < 0); x.stroke(); }
    x.restore(); x.globalAlpha = 1; }
  else if (drawClsFx(f, k, sx, sy)) return;
  else if (f.k === 'sail') { x.fillStyle = `rgba(240,248,255,${.5 * (1 - k)})`; x.beginPath(); x.ellipse(sx, sy - 18, 16 + k * 10, 8, 0, 0, TAU); x.fill(); }
}
function drawParts() {
  for (const p of G.parts) { if (p.t < 0) continue; const [sx, sy] = iso(p.x, p.y), k = p.t / p.life, Y = sy - p.z; x.globalAlpha = Math.min(1, (1 - k) * 1.6);
    if (p.k === 'spark') { const [vx, vy] = iso(p.vx, p.vy); const l = .05; x.strokeStyle = p.c; x.lineWidth = p.s; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx, Y); x.lineTo(sx - vx * l, Y - vy * l + p.vz * l * .5); x.stroke(); }
    else if (p.k === 'puff' || p.k === 'dust') { x.fillStyle = p.c; x.beginPath(); x.arc(sx, Y, p.s * (p.k === 'dust' ? .6 + k : 1 - k * .3), 0, TAU); x.fill(); }
    else { x.save(); x.translate(sx, Y); x.rotate(p.rot + p.t * 8); x.fillStyle = p.c; x.beginPath(); if (p.k === 'leaf') x.ellipse(0, 0, p.s, p.s * .4, 0, 0, TAU); else { x.moveTo(-p.s * .6, -p.s * .4); x.lineTo(p.s * .7, -p.s * .2); x.lineTo(p.s * .1, p.s * .6); x.closePath(); } x.fill(); x.restore(); } }
  x.globalAlpha = 1;
}
function drawVortex(a) { const [ax, ay] = iso(a.x, a.y), k = a.t / a.life, al = Math.min(1, a.t * 4, (a.life - a.t) * 6);
  x.globalAlpha = al * .35; x.fillStyle = '#cfeaff'; x.beginPath(); x.ellipse(ax, ay, a.r * 45, a.r * 22, 0, 0, TAU); x.fill();
  for (let i = 0; i < 9; i++) { const rr2 = a.r * (1 - i / 10) * 45, y2 = ay - i * 9; x.globalAlpha = al * (.85 - i * .05); x.strokeStyle = i % 2 ? '#ffffff' : '#9fe4ff'; x.lineWidth = 3.2 - i * .2; x.beginPath(); x.ellipse(ax + Math.sin(G.t * 6 + i) * 4, y2, rr2 * (.35 + i * .02 + .65 * (1 - k * .3)), rr2 * .42, 0, G.t * (9 + i) + i, G.t * (9 + i) + i + 3.6); x.stroke(); }
  x.globalAlpha = 1; }
function questMark(k) { const P = G.P; for (const id in QUESTS) { const Q = QUESTS[id]; if (Q.from !== k) continue; const q = P.q[id]; if (q && q.s === 2) return '?'; if (!q && qAvail(id)) return '!'; } return ''; }
function qAvail(id) { const q = G.P.q; if (id === 'q1') return true; if (id === 'q2') return true; if (id === 'q4') return true; if (id === 'q3') return q.q1 && q.q1.s === 3; if (id === 'q5') return q.q3 && q.q3.s === 3; if (id === 'q6') return !!G.P.flags.bridge2 && q.q2 && q.q2.s === 3; if (id === 'q7') return q.q5 && q.q5.s === 3; return false; }

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
  const boss = G.mobs.find(m => m.D.boss && !m.dead && m.st !== 'idle') || G.mobs.find(m => m.D.mini && !m.dead && m.st !== 'idle' && hyp(m.x - G.P.x, m.y - G.P.y) < 10); if (boss) { const w = Math.min(420, cw * .36); x.fillStyle = 'rgba(30,24,18,.7)'; rr(cw / 2 - w / 2 - 6, 8, w + 12, 30, 8); x.fill(); x.font = '800 12px system-ui'; x.textAlign = 'center'; x.fillStyle = '#ffe4c8'; x.fillText(boss.D.n, cw / 2, 21); x.fillStyle = '#3a2a20'; x.fillRect(cw / 2 - w / 2, 26, w, 7); x.fillStyle = boss.D.mini ? '#b06ae8' : '#e8604e'; x.fillRect(cw / 2 - w / 2, 26, w * boss.hp / boss.mhp, 7); }
  // 메시지
  x.textAlign = 'center'; G.msg.forEach((m, i) => { const a = Math.min(1, 4.5 - m.t); x.globalAlpha = a; x.font = `700 ${12.5 * s}px system-ui`; const w = x.measureText(m.s).width + 20, yy = (boss ? 48 : 14) + i * 24 * s; x.fillStyle = 'rgba(30,24,18,.62)'; rr(cw / 2 - w / 2, yy, w, 20 * s, 8); x.fill(); x.fillStyle = m.c; x.fillText(m.s, cw / 2, yy + 14 * s); x.globalAlpha = 1; });
  minimap(cw - 10 - SAFE_R(), 10, s);
  // 퀘스트 알림
  questTracker(cw - 10 - SAFE_R(), 10 + 112 * s + 8, s);
  // 아래: 스킬·물약·피하기·메뉴
  const bsz = (touch ? 54 : 44) * s, gap = 6 * s;
  if (touch) {
    const A0 = bsz * 1.6, cx = cw - SAFE_R() - 16 - A0 / 2, cy = ch - 14 - A0 / 2, rho = A0 / 2 + bsz * 1.2;
    btn('atk', cx - A0 / 2, cy - A0 / 2, A0, '', '공격');
    [180, 213, 246, 279].forEach((deg, i) => { const a = deg * Math.PI / 180, z = P.slots[i] === 'ult' ? bsz * 1.12 : bsz; skillBtn(i, P.slots[i], cx + Math.cos(a) * (rho + (z - bsz) * .5) - z / 2, cy + Math.sin(a) * (rho + (z - bsz) * .5) - z / 2, z); });
    const sm = bsz * .86, lx = cx - rho - bsz * .6 - sm - 14;
    btn('dodge', lx, ch - 14 - sm, sm, '', '돛'); btn('pot', lx - sm - 10, ch - 14 - sm, sm, '', '차 ' + count('pot')); btn('wpot', lx - (sm + 10) * 2, ch - 14 - sm, sm, '', '사탕 ' + count('wpot'));
    // 왼쪽 막대(가상 패드): 안 누를 때도 자리를 흐리게 보여 줌
    const p = TOUCH.pad, px0 = p ? p.x0 : SAFE_L() + 96, py0 = p ? p.y0 : ch - 96; x.globalAlpha = p ? 1 : .55; x.fillStyle = 'rgba(30,24,18,.25)'; x.beginPath(); x.arc(px0, py0, 52, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(px0 + (p ? p.dx * 44 : 0), py0 + (p ? p.dy * 44 : 0), 22, 0, TAU); x.fill(); if (!p) { x.font = `700 ${11 * s}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('이동', px0, py0 + 70); } x.globalAlpha = 1;
  } else {
    const n = 4, tw = n * bsz + (n - 1) * gap, X0 = cw / 2 - tw / 2, Y0 = ch - bsz - 12;
    P.slots.forEach((id, i) => skillBtn(i, id, X0 + i * (bsz + gap), Y0, bsz, String(i + 1)));
    btn('pot', X0 - gap * 2 - bsz, Y0, bsz, 'Q', '차 ' + count('pot')); btn('wpot', X0 + tw + gap * 2, Y0, bsz, 'R', '사탕 ' + count('wpot')); btn('dodge', X0 + tw + gap * 3 + bsz, Y0, bsz, '␣', '돛');
    x.font = `600 ${9 * s}px system-ui`; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.75)'; x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 2.5; const hint = '왼쪽 클릭 이동 · 오른쪽 클릭 공격'; x.strokeText(hint, cw / 2, Y0 - 6); x.fillText(hint, cw / 2, Y0 - 6);
  }
  // 메뉴 버튼(위 오른쪽, 지도 왼쪽)
  const mb = (touch ? 40 : 32) * s, mw = mb * (touch ? 1.35 : 1.6), my = 8, MN = [['inv', '가방', 'I'], ['char', '캐릭터', 'C'], ['skill', '기술', 'S'], ['map', '지도', 'M'], ['menu', '≡', '']], mx = cw - SAFE_R() - 10 - 112 * s - 8 - (mw + 4) * 4 - mb - 4;
  let X = mx; MN.forEach(([k, l, key]) => { const w = k === 'menu' ? mb : mw; x.fillStyle = 'rgba(30,24,18,.62)'; rr(X, my, w, mb, 8); x.fill(); x.fillStyle = (k === 'char' && P.pts) || (k === 'skill' && (P.skp || P.shd && P.shd.length && P.board.includes(null) && P.lv >= BOARD_LV)) ? '#ffd166' : '#fff'; x.font = `700 ${(l.length > 1 ? (touch ? 11.5 : 10.5) : 16) * s}px system-ui`; x.textAlign = 'center'; x.fillText(l, X + w / 2, my + mb / 2 + (key && !touch ? 1 : 4) * s);
    if (key && !touch) { x.font = `700 ${8 * s}px system-ui`; x.fillStyle = '#ffd166'; x.fillText(key, X + w / 2, my + mb - 4 * s); } if ((k === 'char' && P.pts) || (k === 'skill' && (P.skp || P.shd && P.shd.length && P.board.includes(null) && P.lv >= BOARD_LV))) { x.fillStyle = '#ff6a5a'; x.beginPath(); x.arc(X + w - 3, my + 3, 4, 0, TAU); x.fill(); }
    BTN.push({ k, x: X, y: my, w, h: mb }); X += w + 4; });
  // 상호작용
  if (G.near) { x.font = `800 ${(touch ? 14 : 12.5) * s}px system-ui`; const t = (touch ? '👆 ' : 'F  ') + G.near.label, hh = (touch ? 38 : 28) * s, w = x.measureText(t).width + 30, X2 = cw / 2 - w / 2, Y = ch - (touch ? 64 : 116) * s - hh / 2; x.fillStyle = 'rgba(255,240,200,.95)'; rr(X2, Y, w, hh, hh / 2); x.fill(); x.strokeStyle = '#c8a06a'; x.lineWidth = 2; x.stroke(); x.fillStyle = '#3a2a10'; x.textAlign = 'center'; x.fillText(t, cw / 2, Y + hh * .66); BTN.push({ k: 'use', x: X2, y: Y, w, h: hh }); }
}
const SAFE_L = () => 0, SAFE_R = () => 0;
function bar(X, Y, w, h, f, c1, c2, label, s) { x.fillStyle = 'rgba(0,0,0,.4)'; rr(X, Y, w, h, h / 2); x.fill(); const g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, c2); g.addColorStop(1, c1); x.fillStyle = g; if (f > 0) { rr(X, Y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); x.fill(); } x.font = `700 ${h * .78}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(label, X + w / 2, Y + h * .8); }
function btn(k, X, Y, sz, key, label) { x.fillStyle = 'rgba(30,24,18,.55)'; x.beginPath(); x.arc(X + sz / 2, Y + sz / 2, sz / 2, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,240,210,.5)'; x.lineWidth = 1.5; x.stroke();
  const P = G.P; if (k === 'dodge' && P.dcd > 0) { x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.moveTo(X + sz / 2, Y + sz / 2); x.arc(X + sz / 2, Y + sz / 2, sz / 2, -Math.PI / 2, -Math.PI / 2 + TAU * P.dcd / P.sail[1]); x.fill(); }
  if (k === 'atk') { const ic = { warden: 'spear', windcaller: 'staff', drifter: 'sword', trapper: 'xbow', ringer: 'hammer' }[P.cls]; if (ICM[ic]) x.drawImage(IM.icons, ...ICM[ic], X + sz * .2, Y + sz * .2, sz * .6, sz * .6); }
  if (k === 'pot' || k === 'wpot') { const m = ICM[k]; if (m) x.drawImage(IM.icons, ...m, X + sz * .22, Y + sz * .12, sz * .56, sz * .56); }
  if (k === 'dodge') { const m = ICM.sail; if (m) x.drawImage(IM.icons, ...m, X + sz * .22, Y + sz * .12, sz * .56, sz * .56); }
  x.font = `700 ${Math.max(9, sz * .2)}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 2.5; if (label) { x.strokeText(label, X + sz / 2, Y + sz * .9); x.fillText(label, X + sz / 2, Y + sz * .9); }
  if (key) { x.fillStyle = '#ffd166'; x.fillText(key, X + sz * .18, Y + sz * .26); }
  BTN.push({ k, x: X, y: Y, w: sz, h: sz });
}
const SKC = { ult: '#fff3c0',  pierce: '#ffe9c0', sweep: '#ffd59a', bash: '#ffd27a', hold: '#f2c26a', shout: '#ffb48a', flag: '#b6f0a0', gust: '#dff4ff', twister: '#c8ecff', bolt: '#fff3a0', chain: '#ffe066', cloud: '#f4f8ff', mist: '#d8e6f0', slash3: '#ffe0d6', whirl: '#ffd0c0', dashcut: '#fff0e8', parry: '#ffe8c0', mark: '#ff9a8a', shadow: '#e0c8ff', pshot: '#f4e8c8', rain: '#e8d8b0', trap: '#e8e0d0', net: '#f0e4c0', roll: '#d8f0b0', hawk: '#f0d0a0', toll: '#ffe0a0', wave: '#ffe8b8', echo: '#e0d0ff', resound: '#e8d8ff', clang: '#ffffff', dome: '#ffd890' };
function skillBtn(i, id, X, Y, sz, key) {
  const P = G.P, ult = id === 'ult'; x.fillStyle = 'rgba(30,24,18,.6)'; rr(X, Y, sz, sz, sz * .22); x.fill(); x.strokeStyle = ult ? '#ffcf7a' : 'rgba(255,240,210,.45)'; x.lineWidth = ult ? 2.5 : 1.5; x.stroke();
  if (id) { const s = skillOf(P.cls, id); drawSkillIcon(x, s, X, Y, sz, P.cls); const cd = P.cds[id] || 0;
    const CDF = (G.P.cdx && G.P.cdx[s.id]) || s.cd; if (cd > 0) { x.fillStyle = 'rgba(0,0,0,.55)'; rr(X, Y + sz * (1 - cd / CDF), sz, sz * cd / CDF, sz * .2); x.fill(); if (cd > .9) { x.font = `800 ${sz * .32}px system-ui`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 3; x.strokeText(Math.ceil(cd), X + sz / 2, Y + sz * .62); x.fillText(Math.ceil(cd), X + sz / 2, Y + sz * .62); } }
    else if (ult) { x.globalAlpha = .4 + Math.sin(G.t * 5) * .3; x.strokeStyle = '#fff3c0'; x.lineWidth = 2; rr(X - 2, Y - 2, sz + 4, sz + 4, sz * .24); x.stroke(); x.globalAlpha = 1; }
    if (P.wind < s.cost) { x.fillStyle = 'rgba(20,60,120,.4)'; rr(X, Y, sz, sz, sz * .22); x.fill(); } }
  else if (i === 3 && P.lv < ULT[P.cls].req) { x.font = `700 ${sz * .2}px system-ui`; x.textAlign = 'center'; x.fillStyle = 'rgba(255,220,160,.7)'; x.fillText('궁극', X + sz / 2, Y + sz * .5); x.fillText(ULT[P.cls].req + '레벨', X + sz / 2, Y + sz * .74); }
  if (key) { x.font = `700 ${sz * .24}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#ffd166'; x.fillText(key, X + 4, Y + sz * .28); }
  BTN.push({ k: 's' + i, x: X, y: Y, w: sz, h: sz });
}
// 스킬 그림: 갈래 색 바탕 + 동작 그림(코드)
function drawSkillIcon(g, s, X, Y, sz, cls) {
  const col = [['#3a6a8a', '#7aa0b8'], ['#8a6a3a', '#c8a26a'], ['#6a4a7a', '#a88ac0'], ['#8a4a1a', '#f0b04a']][s.br], gr = g.createLinearGradient(X, Y, X + sz, Y + sz); gr.addColorStop(0, col[1]); gr.addColorStop(1, col[0]);
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
    case 'ult': if (cls === 'warden') { L(cx, cy - r * 1.3, cx, cy + r * .5); g.beginPath(); g.moveTo(cx, cy + r * .9); g.lineTo(cx - r * .3, cy + r * .3); g.lineTo(cx + r * .3, cy + r * .3); g.fill(); for (let i = 0; i < 5; i++) { const a = Math.PI * (.1 + i * .2); L(cx + Math.cos(a) * r * .7, cy + r * .9 + Math.sin(a) * r * .1 - r * .15, cx + Math.cos(a) * r * 1.3, cy + r * .9 + Math.sin(a) * r * .35 - r * .15); } }
      else if (cls === 'windcaller') { for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx, cy, r * (.3 + i * .25), i, i + 4.2); g.stroke(); } } else clsIcon(g, s, cx, cy, r, c, L, col, cls); break;
    default: clsIcon(g, s, cx, cy, r, c, L, col, cls); break;
    case 'cloud': case 'mist': g.beginPath(); g.arc(cx - r * .45, cy + r * .1, r * .45, 0, TAU); g.arc(cx + r * .1, cy - r * .2, r * .58, 0, TAU); g.arc(cx + r * .6, cy + r * .2, r * .4, 0, TAU); g.fill(); if (s.id === 'mist') { g.globalAlpha = .6; g.fillRect(cx - r * 1.1, cy + r * .6, r * 2.2, r * .2); g.globalAlpha = 1; } break;
  }
  g.restore();
}
function rrp(g, X, Y, w, h, r) { g.moveTo(X + r, Y); g.arcTo(X + w, Y, X + w, Y + h, r); g.arcTo(X + w, Y + h, X, Y + h, r); g.arcTo(X, Y + h, X, Y, r); g.arcTo(X, Y, X + w, Y, r); g.closePath(); }
let MINI = null;
function minimap(R, T, s) {
  const Wd = G.Wd, w = 112 * s, h = 112 * s, X = R - w;
  if (!MINI || MINI.v !== (Wd.bridges[Wd.bq].broken ? 0 : 1) + (Wd.bridges[Wd.bq2].broken ? 0 : 2)) { const c = document.createElement('canvas'); c.width = Wd.W * 2; c.height = Wd.H * 2; const g = c.getContext('2d');
    for (let y = 0; y < Wd.H; y++) for (let xx = 0; xx < Wd.W; xx++) { const t = Wd.g[Wd.id(xx, y)]; if (!t) continue; g.fillStyle = t === 3 ? '#c8a070' : t === 4 ? '#8a6a50' : t === 5 ? '#d8d0c0' : t === 2 ? '#d8c08a' : Wd.block[Wd.id(xx, y)] ? '#5a8a4a' : '#9ccc7a'; g.fillRect(xx * 2, y * 2, 2, 2); }
    MINI = { c, v: (Wd.bridges[Wd.bq].broken ? 0 : 1) + (Wd.bridges[Wd.bq2].broken ? 0 : 2) }; }
  x.save(); x.fillStyle = 'rgba(30,24,18,.55)'; rr(X, T, w, h, 10); x.fill(); x.beginPath(); rr(X + 3, T + 3, w - 6, h - 6, 8); x.clip();
  const sc = 1.6 * s, P = G.P; x.translate(X + w / 2, T + h / 2); x.rotate(Math.PI / 4); x.scale(sc * .72, sc * .72 * .5 / .5); x.scale(1, 1);
  x.translate(-P.x * 2, -P.y * 2); x.drawImage(MINI.c, 0, 0);
  for (const m of G.mobs) if (!m.dead) { x.fillStyle = m.D.boss ? '#ff4a3a' : m.D.mini ? '#c06aff' : m.elite ? m.E[1] : '#e85a4a'; x.fillRect(m.x * 2 - 1.5, m.y * 2 - 1.5, 3, 3); }
  for (const k in Wd.npcAt) { x.fillStyle = '#ffd166'; x.fillRect(Wd.npcAt[k][0] * 2 - 1.5, Wd.npcAt[k][1] * 2 - 1.5, 3, 3); }
  for (const wp of Wd.wps) { x.fillStyle = wp.on ? '#9fe4ff' : '#888'; x.beginPath(); x.arc(wp.x * 2, wp.y * 2, 2.6, 0, TAU); x.fill(); }
  if (G.chest) { x.fillStyle = '#ffd166'; x.strokeStyle = '#7a5a20'; x.lineWidth = 1; x.beginPath(); x.arc(G.chest.x * 2, G.chest.y * 2, 3.4, 0, TAU); x.fill(); x.stroke(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(P.x * 2, P.y * 2, 3, 0, TAU); x.fill(); x.restore();
}
function questTracker(R, T, s) {
  const P = G.P, L = []; for (const id in QUESTS) { const q = P.q[id]; if (!q || q.s === 3) continue; const Q = QUESTS[id]; let t = Q.goal; if (q.s === 2) t = NPCDEF[Q.from].n + '에게 돌아가기'; else if (id === 'q1') t = '다리 널빤지 ' + Math.min(6, count('plank')) + '/6 → 동쪽 끊긴 다리'; else if (id === 'q2') t = '보풀이 ' + q.n + '/15'; else if (id === 'q4') t = '바람 숫돌 ' + Math.min(3, count('hone')) + '/3'; else if (id === 'q5') t = '둥지 껍질 ' + Math.min(3, count('shell')) + '/3 → 언덕 동쪽 끊긴 다리'; else if (id === 'q6') t = '늪 밑것 ' + q.n + '/20'; else if (id === 'q7') t = '둥지섬의 큰 왜가리'; L.push([Q.n, t]); }
  const dt2 = dailyTrack(); if (dt2) L.push(dt2);
  if (!L.length) return; x.textAlign = 'right'; let y = T;
  for (const [n, t] of L) { x.font = `800 ${10.5 * s}px system-ui`; x.fillStyle = '#ffd166'; x.strokeStyle = 'rgba(30,24,18,.8)'; x.lineWidth = 3; x.strokeText(n, R, y + 10 * s); x.fillText(n, R, y + 10 * s); x.font = `600 ${9.5 * s}px system-ui`; x.fillStyle = '#fff'; x.strokeText(t, R, y + 23 * s); x.fillText(t, R, y + 23 * s); y += 30 * s; }
}

/* ---------- 3단계 직업 그리기: 덫·화살비·그물·메아리 분신·매·하늘 종·표식 ---------- */
const ELL = (ax, ay, r, k) => { x.beginPath(); x.ellipse(ax, ay, r * TW / 2 * 1.41 * (k || 1), r * TH / 2 * 1.41 * (k || 1), 0, 0, TAU); };
function drawClsGround() {
  for (const a of G.areas) {
    if (a.t < 0) continue; const [ax, ay] = iso(a.x, a.y), al = Math.min(1, a.t * 4, (a.life - a.t) * 3);
    if (a.k === 'trap') { const armed = a.arm <= 0, p = armed ? .5 + Math.sin(G.t * 5) * .2 : .3;
      x.fillStyle = `rgba(60,40,24,${.55 * al})`; x.beginPath(); x.ellipse(ax, ay, 15, 7.5, 0, 0, TAU); x.fill();
      x.strokeStyle = `rgba(200,200,210,${al})`; x.lineWidth = 1.8; x.beginPath(); x.ellipse(ax, ay, 12, 6, 0, 0, TAU); x.stroke();
      x.beginPath(); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, c = Math.cos(an), s = Math.sin(an); x.moveTo(ax + c * 12, ay + s * 6); x.lineTo(ax + c * 7, ay + s * 3.5 - 3); } x.stroke();
      x.fillStyle = `rgba(255,210,120,${p * al})`; x.beginPath(); x.arc(ax, ay, 2.6, 0, TAU); x.fill(); }
    else if (a.k === 'rain') { x.fillStyle = `rgba(90,70,40,${.16 * al})`; ELL(ax, ay, a.r); x.fill(); x.strokeStyle = `rgba(240,220,160,${.5 * al})`; x.lineWidth = 1.5; x.setLineDash([5, 5]); ELL(ax, ay, a.r); x.stroke(); x.setLineDash([]); }
    else if (a.k === 'net') { x.save(); ELL(ax, ay, a.r); x.clip(); x.strokeStyle = `rgba(232,220,176,${.75 * al})`; x.lineWidth = 1.4; const R = a.r * TW;
      x.beginPath(); for (let i = -6; i <= 6; i++) { x.moveTo(ax - R + i * 9, ay - R / 2); x.lineTo(ax + R + i * 9, ay + R / 2); x.moveTo(ax + R + i * 9, ay - R / 2); x.lineTo(ax - R + i * 9, ay + R / 2); } x.stroke(); x.restore();
      x.strokeStyle = `rgba(160,130,80,${al})`; x.lineWidth = 2; ELL(ax, ay, a.r); x.stroke(); }
    else if (a.k === 'trail') { const [bx, by] = iso(a.x1, a.y1); x.strokeStyle = `rgba(255,220,210,${.5 * al})`; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.moveTo(ax, ay - 8); x.lineTo(bx, by - 8); x.stroke(); x.strokeStyle = `rgba(255,255,255,${.7 * al})`; x.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const o = Math.sin(G.t * 20 + i * 2) * 4; x.beginPath(); x.moveTo(ax, ay - 8 + o - 6 + i * 6); x.lineTo(bx, by - 8 - o - 6 + i * 6); x.stroke(); } }
    else if (a.k === 'tremor') { x.strokeStyle = `rgba(200,170,255,${(.35 + Math.sin(G.t * 18) * .15) * al})`; x.lineWidth = 2; ELL(ax, ay, a.r * (.9 + Math.sin(G.t * 18) * .05)); x.stroke(); }
    else if (a.k === 'echo') { x.fillStyle = `rgba(180,140,255,${.22 * al})`; x.beginPath(); x.ellipse(ax, ay, 22, 11, 0, 0, TAU); x.fill(); }
    else if (a.k === 'hawk') { const sh = Math.max(.08, .3 - a.z / 400); x.fillStyle = `rgba(30,30,20,${sh})`; x.beginPath(); x.ellipse(ax, ay, 9, 4, 0, 0, TAU); x.fill(); }
    else if (a.k === 'bigbell') { const k = Math.min(1, a.t / .5); x.fillStyle = `rgba(30,20,40,${.35 * k * al})`; x.beginPath(); x.ellipse(ax, ay, 26 + k * 20, (26 + k * 20) / 2, 0, 0, TAU); x.fill(); }
  }
}
function drawEcho(a) { if (a.t < 0) return; const [sx, sy] = iso(a.x, a.y), al = Math.min(1, a.t * 3, (a.life - a.t) * 2), im = IM.ringer; if (!im) return;
  const fr = a.tick > .75 ? 8 + Math.min(3, Math.floor((1 - a.tick) * 16)) : Math.floor(G.t / .6) % 2;
  sprite(im, HC[0], HC[1], HC[2], HC[3], fr, a.dir, sx, sy - 4 - Math.sin(G.t * 3) * 3, .5, a.flash > 0 ? .1 : 0, .5 * al);
  x.globalCompositeOperation = 'lighter'; x.globalAlpha = .25 * al; x.fillStyle = '#9a7aff'; x.beginPath(); x.ellipse(sx, sy - 26, 18, 30, 0, 0, TAU); x.fill(); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
function drawHawk(a) { const [sx, sy] = iso(a.x, a.y), Y = sy - a.z, f = Math.sin(G.t * (a.dv ? 6 : 14) + a.ang) * (a.dv ? 3 : 7), al = Math.min(1, a.t * 4, (a.life - a.t) * 3); x.globalAlpha = al;
  x.fillStyle = '#7a5434'; x.strokeStyle = '#2a1a10'; x.lineWidth = 1.4;
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(sx, Y); x.quadraticCurveTo(sx + s * 9, Y - 6 - f, sx + s * 18, Y - 2 - f * 1.4); x.quadraticCurveTo(sx + s * 10, Y + 2, sx, Y + 3); x.closePath(); x.fill(); x.stroke(); }
  x.fillStyle = '#9a6a40'; x.beginPath(); x.ellipse(sx, Y + 1, 4, 7, 0, 0, TAU); x.fill(); x.stroke(); x.fillStyle = '#f0e8d8'; x.beginPath(); x.arc(sx, Y - 5, 3, 0, TAU); x.fill(); x.fillStyle = '#ffc23a'; x.beginPath(); x.moveTo(sx - 1.5, Y - 4); x.lineTo(sx + 1.5, Y - 4); x.lineTo(sx, Y - 1); x.fill(); x.globalAlpha = 1; }
function drawBell(sx, Y, w, al) { x.globalAlpha = al; const gr = x.createLinearGradient(sx - w, 0, sx + w, 0); gr.addColorStop(0, '#8a5a1a'); gr.addColorStop(.35, '#ffd27a'); gr.addColorStop(1, '#7a4a14'); x.fillStyle = gr; x.strokeStyle = '#3a2410'; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(sx - w, Y); x.quadraticCurveTo(sx - w * .82, Y - w * .2, sx - w * .62, Y - w * .9); x.quadraticCurveTo(sx - w * .5, Y - w * 1.45, sx, Y - w * 1.5); x.quadraticCurveTo(sx + w * .5, Y - w * 1.45, sx + w * .62, Y - w * .9); x.quadraticCurveTo(sx + w * .82, Y - w * .2, sx + w, Y); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#5a3a14'; x.beginPath(); x.ellipse(sx, Y, w, w * .22, 0, 0, TAU); x.fill(); x.stroke(); x.strokeStyle = 'rgba(255,240,200,.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(sx - w * .7, Y - w * .5); x.quadraticCurveTo(sx, Y - w * .38, sx + w * .7, Y - w * .5); x.stroke(); x.globalAlpha = 1; }
function drawClsAir() {
  for (const a of G.areas) {
    if (a.t < 0) continue;
    if (a.k === 'rain') { const [ax, ay] = iso(a.x, a.y); x.strokeStyle = '#6a4a2a'; x.lineWidth = 1.6; const n = a.big ? 14 : 8;
      for (let i = 0; i < n; i++) { const s = Math.floor(G.t * 12) * 31 + i * 7, rx = (hsh(s, i) - .5) * 2 * a.r, ry = (hsh(i, s) - .5) * 2 * a.r; if (rx * rx + ry * ry > a.r * a.r) continue; const [px, py] = iso(a.x + rx, a.y + ry), h = (G.t * 12 % 1) * 70;
        x.globalAlpha = .9; x.beginPath(); x.moveTo(px - 4, py - 80 + h); x.lineTo(px, py - 64 + h); x.stroke(); } x.globalAlpha = 1; }
    else if (a.k === 'hawk') drawHawk(a);
    else if (a.k === 'mud') { const [ax, ay] = iso(a.x, a.y), Y = ay - 18 - Math.sin(a.t / .8 * Math.PI) * 14; x.fillStyle = 'rgba(30,30,20,.25)'; x.beginPath(); x.ellipse(ax, ay, 6, 3, 0, 0, TAU); x.fill(); x.fillStyle = '#5a4026'; x.strokeStyle = '#2a1e10'; x.lineWidth = 1.5; x.beginPath(); x.arc(ax, Y, 6, 0, TAU); x.fill(); x.stroke(); x.fillStyle = '#8a6a44'; x.beginPath(); x.arc(ax - 2, Y - 2, 2, 0, TAU); x.fill(); }
    else if (a.k === 'bigbell') { const [ax, ay] = iso(a.x, a.y), k = Math.min(1, a.t / .5), al = Math.min(1, (a.life - a.t) * 2); const shake = a.t > .5 && a.t < 2 ? Math.sin(G.t * 40) * 2 : 0; drawBell(ax + shake, ay - (1 - k * k) * 320, 46, al); }
  }
  // 표식: 받는 피해가 늘어난 적
  for (const m of G.mobs) if (m.mark > 0 && !m.dead) { const [sx, sy] = iso(m.x, m.y), Y = sy - (m.D.boss ? 130 : m.D.mini ? 96 : 50) - 6, s = 6 + Math.sin(G.t * 8) * 1;
    x.globalAlpha = Math.min(1, m.mark * 2); x.fillStyle = '#ff5a4a'; x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(sx, Y - s); x.lineTo(sx + s * .8, Y); x.lineTo(sx, Y + s); x.lineTo(sx - s * .8, Y); x.closePath(); x.fill(); x.stroke(); x.globalAlpha = 1; }
}
function drawClsFx(f, k, sx, sy) {
  if (f.k === 'ghost') { const im = IM[G.P.cls]; if (im) { x.globalCompositeOperation = 'lighter'; sprite(im, HC[0], HC[1], HC[2], HC[3], f.fr, f.dir, sx, sy, .5, 0, (1 - k) * .45); x.globalCompositeOperation = 'source-over'; } return 1; }
  if (f.k === 'bellw') { x.strokeStyle = f.c; for (let i = 0; i < 2; i++) { const kk = Math.min(1, k * 1.2 + i * .2); x.globalAlpha = (1 - kk) * .9; x.lineWidth = 3 - i; ELL(sx, sy, f.r, .3 + kk * .75); x.stroke(); } x.globalAlpha = 1; return 1; }
  if (f.k === 'wave') { const gr = x.createRadialGradient(sx, sy, 0, sx, sy, f.r * TW * .71 * (.2 + k)); gr.addColorStop(0, 'rgba(255,230,160,0)'); gr.addColorStop(.85, `rgba(255,220,140,${.35 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
    x.save(); x.translate(sx, sy); x.scale(1, TH / TW); x.translate(-sx, -sy); x.fillStyle = gr; x.beginPath(); x.arc(sx, sy, f.r * TW * .71 * (.2 + k), 0, TAU); x.fill(); x.restore();
    x.strokeStyle = `rgba(255,240,200,${1 - k})`; x.lineWidth = 3; ELL(sx, sy, f.r, .2 + k); x.stroke(); return 1; }
  if (f.k === 'feather') { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + f.x, r = 6 + k * 16; x.save(); x.translate(sx + Math.cos(a) * r, sy - 4 + Math.sin(a) * r * .5 - (1 - k) * 30); x.rotate(a); x.globalAlpha = 1 - k; x.fillStyle = i % 2 ? '#d8dce4' : '#56606e'; x.beginPath(); x.ellipse(0, 0, 8, 2.4, 0, 0, TAU); x.fill(); x.restore(); } x.globalAlpha = 1; return 1; }
  if (f.k === 'snap') { x.strokeStyle = `rgba(230,230,240,${1 - k})`; x.lineWidth = 3; const o = 10 * (1 - Math.min(1, k * 3)); for (const s of [-1, 1]) { x.beginPath(); x.ellipse(sx, sy - 6 + s * o, 13, 6, 0, s < 0 ? Math.PI : 0, s < 0 ? TAU : Math.PI); x.stroke(); } return 1; }
  if (f.k === 'clang') { x.strokeStyle = `rgba(255,255,255,${1 - k})`; x.lineWidth = 2.5; x.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .2, r0 = f.r * 12 * k, r1 = f.r * 26 * (.4 + k); x.moveTo(sx + Math.cos(a) * r0, sy - 20 + Math.sin(a) * r0 * .6); x.lineTo(sx + Math.cos(a) * r1, sy - 20 + Math.sin(a) * r1 * .6); } x.stroke(); return 1; }
  return 0;
}
function drawClsHero(P, sx, sy, post) {
  if (P.buf.whirl > 0) { x.strokeStyle = post ? 'rgba(255,240,230,.85)' : 'rgba(255,200,180,.45)'; x.lineWidth = post ? 3 : 6; x.lineCap = 'round'; const R = (P.whirl ? P.whirl.r : 1.7) * 30;
    for (let i = 0; i < 2; i++) { const a0 = G.t * 16 + i * Math.PI + (post ? 0 : .5); x.beginPath(); x.ellipse(sx, sy - 16, R, R * .5, 0, a0, a0 + 1.4); x.stroke(); } }
  if (!post && P.buf.parry > 0) { x.strokeStyle = `rgba(255,216,200,${.6 + Math.sin(G.t * 20) * .3})`; x.lineWidth = 2.5; x.beginPath(); x.ellipse(sx, sy, 20, 10, 0, 0, TAU); x.stroke(); }
  if (post && P.buf.dome > 0) { const al = Math.min(1, P.buf.dome * 2) * .35; x.globalCompositeOperation = 'lighter'; drawBell(sx, sy + 6, 30, al); x.globalCompositeOperation = 'source-over'; }
  if (post && P.buf.haste > 0) { x.strokeStyle = 'rgba(255,220,200,.6)'; x.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const yy = sy - 10 - i * 12 + (G.t * 60 % 12); x.beginPath(); x.moveTo(sx - 16, yy); x.lineTo(sx - 26, yy); x.stroke(); } }
}
// 새 직업 스킬 그림(코드로 그림)
function clsIcon(g, s, cx, cy, r, c, L, col, cls) {
  const tri = (x1, y1, x2, y2, x3, y3) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill(); };
  const blade = (x1, y1, x2, y2) => { L(x1, y1, x2, y2); const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy); tri(x2, y2, x2 - dx / l * r * .4 - dy / l * r * .14, y2 - dy / l * r * .4 + dx / l * r * .14, x2 - dx / l * r * .4 + dy / l * r * .14, y2 - dy / l * r * .4 - dx / l * r * .14); };
  const bell = (bx, by, w) => { g.beginPath(); g.moveTo(bx - w, by); g.quadraticCurveTo(bx - w * .7, by - w * 1.2, bx, by - w * 1.4); g.quadraticCurveTo(bx + w * .7, by - w * 1.2, bx + w, by); g.closePath(); g.fill(); g.beginPath(); g.arc(bx, by + w * .25, w * .2, 0, TAU); g.fill(); };
  const arrow = (x1, y1, x2, y2) => { blade(x1, y1, x2, y2); L(x1, y1, x1 - r * .25, y1 - r * .05); L(x1, y1, x1 - r * .05, y1 + r * .25); };
  switch (s.id) {
    case 'slash3': for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx - r * .9 + i * r * .2, cy + r * .9 - i * r * .2, r * (1.1 + i * .1), -1.4, -.2); g.stroke(); } break;
    case 'whirl': g.beginPath(); g.arc(cx, cy, r * .95, 0, TAU * .8); g.stroke(); blade(cx, cy, cx + r * .9, cy - r * .6); blade(cx, cy, cx - r * .9, cy + r * .6); break;
    case 'dashcut': blade(cx - r * 1.1, cy + r * .5, cx + r * 1.1, cy - r * .5); g.globalAlpha = .5; L(cx - r * 1.2, cy + r * .1, cx + r * .2, cy - r * .5); L(cx - r * 1.2, cy + r * .9, cx + r * .4, cy + r * .2); g.globalAlpha = 1; break;
    case 'parry': blade(cx - r, cy + r, cx + r * .8, cy - r * .8); blade(cx + r, cy + r, cx - r * .8, cy - r * .8); g.beginPath(); g.arc(cx, cy, r * .25, 0, TAU); g.fill(); break;
    case 'mark': g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r * .8, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * .8, cy); g.closePath(); g.stroke(); blade(cx - r * 1.2, cy + r * 1.2, cx + r * .1, cy - r * .1); break;
    case 'shadow': g.globalAlpha = .45; blade(cx - r * 1.1, cy + r * .2, cx + r * .2, cy - r * 1.1); g.globalAlpha = .7; blade(cx - r * .8, cy + r * .6, cx + r * .5, cy - r * .7); g.globalAlpha = 1; blade(cx - r * .4, cy + r, cx + r * .9, cy - r * .3); break;
    case 'pshot': arrow(cx - r * 1.1, cy + r * .9, cx + r * 1.1, cy - r * .9); g.beginPath(); g.arc(cx, cy, r * .3, 0, TAU); g.stroke(); break;
    case 'rain': for (let i = 0; i < 4; i++) { const ax = cx - r * .9 + i * r * .6; arrow(ax - r * .2, cy - r * 1.1 + (i % 2) * r * .3, ax + r * .15, cy + r * .2 + (i % 2) * r * .3); } g.fillRect(cx - r * 1.2, cy + r * .9, r * 2.4, r * .15); break;
    case 'trap': g.beginPath(); g.ellipse(cx, cy + r * .3, r, r * .45, 0, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { const a = Math.PI + i / 5 * Math.PI, px = cx + Math.cos(a) * r * .9; tri(px - r * .12, cy + r * .2, px + r * .12, cy + r * .2, px, cy - r * .35); } break;
    case 'net': g.lineWidth = r * .12; for (let i = -2; i <= 2; i++) { L(cx - r + i * r * .45, cy - r, cx + r + i * r * .45, cy + r); L(cx + r + i * r * .45, cy - r, cx - r + i * r * .45, cy + r); } break;
    case 'roll': g.beginPath(); g.arc(cx + r * .3, cy, r * .8, -2.4, 1.6); g.stroke(); tri(cx - r * .5, cy - r * .9, cx - r * .1, cy - r * .3, cx - r, cy - r * .3); arrow(cx - r * .1, cy + r * .1, cx + r * 1.2, cy - r * .5); break;
    case 'hawk': g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx - r * .6, cy - r * .9, cx - r * 1.3, cy - r * .4); g.quadraticCurveTo(cx - r * .6, cy + r * .1, cx, cy + r * .3); g.quadraticCurveTo(cx + r * .6, cy + r * .1, cx + r * 1.3, cy - r * .4); g.quadraticCurveTo(cx + r * .6, cy - r * .9, cx, cy); g.fill(); g.beginPath(); g.ellipse(cx, cy + r * .4, r * .25, r * .6, 0, 0, TAU); g.fill(); break;
    case 'toll': bell(cx + r * .3, cy + r * .7, r * .7); L(cx - r * 1.1, cy - r * 1.1, cx - r * .1, cy - r * .1); g.fillRect(cx - r * 1.35, cy - r * 1.35, r * .55, r * .45); break;
    case 'wave': for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(cx, cy + r * .2, r * (.4 + i * .38), r * (.2 + i * .2), 0, 0, TAU); g.stroke(); } break;
    case 'echo': g.globalAlpha = .45; bell(cx - r * .45, cy + r * .6, r * .6); g.globalAlpha = 1; bell(cx + r * .35, cy + r * .8, r * .7); break;
    case 'resound': bell(cx, cy + r * .5, r * .65); for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(cx, cy, r * (.95 + i * .35), sd < 0 ? Math.PI - .5 : -.5, sd < 0 ? Math.PI + .5 : .5); g.stroke(); } break;
    case 'clang': for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; L(cx + Math.cos(a) * r * .35, cy + Math.sin(a) * r * .35, cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2); } g.beginPath(); g.arc(cx, cy, r * .3, 0, TAU); g.fill(); break;
    case 'dome': g.globalAlpha = .5; bell(cx, cy + r * 1, r * 1.1); g.globalAlpha = 1; g.beginPath(); g.arc(cx, cy + r * .1, r * .3, 0, TAU); g.fill(); g.fillRect(cx - r * .2, cy + r * .35, r * .4, r * .6); break;
    case 'ult': if (cls === 'drifter') { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3; blade(cx + Math.cos(a) * r * .3, cy + Math.sin(a) * r * .3, cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2); } }
      else if (cls === 'trapper') { g.beginPath(); g.arc(cx, cy, r * 1.05, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.arc(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05, r * .17, 0, TAU); g.fill(); } arrow(cx - r * .3, cy - r * .6, cx + r * .2, cy + r * .5); }
      else { bell(cx, cy + r * .9, r * 1.05); g.globalAlpha = .6; for (let i = 0; i < 3; i++) L(cx - r * .6 + i * r * .6, cy - r * 1.4, cx - r * .6 + i * r * .6, cy - r * .9); g.globalAlpha = 1; } break;
  }
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
    + '.sk-eq{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:5px}@media (max-width:520px){.sk-eq{grid-template-columns:repeat(5,minmax(0,1fr))}}'
    + '.sk-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:640px){.sk-two{grid-template-columns:1fr}}'
    + '.sk-card{background:#fffaf0;border:1.5px solid #c8b088;border-radius:12px;padding:8px 10px;font-size:12.5px;line-height:1.55}.sk-card .n{font-size:15px;font-weight:800}.sk-card .m{color:#8a7458;font-size:11.5px}.sk-card .a{color:#3a7fa8}.sk-card .h{color:#9a7ad8}.sk-card .bad{color:#c84a3a}.sk-card .st{color:#7a5a32;font-style:italic;font-size:11.5px}'
    + '.sk-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed #d8c8a8;font-size:13px}.sk-row .f{flex:1}.sk-row small{color:#8a7458}'
    + '.sk-talk{max-width:640px}.sk-talk p{font-size:14.5px;line-height:1.7;margin:6px 0}.sk-talk .who{font-weight:800;color:#7a5a32}'
    + '.sk-title{max-width:760px;text-align:center}.sk-title .t{font-size:34px;font-weight:900;letter-spacing:.06em;color:#3a5a7a;margin:6px 0 0;text-shadow:0 2px 0 #fff}.sk-title .s{color:#7a8aa0;font-size:12px;letter-spacing:.3em;margin-bottom:10px}'
    + '.sk-cls{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0 6px}.sk-cdesc{font-size:12.5px;color:#5a4a36;background:#fffaf0;border:1px dashed #c8b088;border-radius:10px;padding:6px 10px;margin:0 0 8px;line-height:1.6}.sk-cl{border:2px solid #c8b088;border-radius:14px;background:#fffaf0;padding:6px 2px;cursor:pointer;text-align:center}.sk-cl.on{border-color:#4f9fc8;box-shadow:0 0 0 3px #4f9fc844}.sk-cl canvas{width:84px;height:90px}.sk-cl b{display:block;font-size:14px;white-space:nowrap}.sk-cl small{display:block;font-size:11.5px;color:#7a6a58;line-height:1.5}'
    + '.sk-sk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media (max-width:640px){.sk-sk{grid-template-columns:1fr}}.sk-br{background:#fffaf0;border:1.5px solid #c8b088;border-radius:12px;padding:6px}.sk-br h4{margin:2px 0 6px;text-align:center}.sk-s{display:flex;gap:8px;align-items:flex-start;padding:5px;border-radius:9px;cursor:pointer}.sk-s.on{background:#e2f0f8}.sk-s canvas{width:42px;height:42px;flex:none}.sk-s .f{flex:1;font-size:12px;line-height:1.45}.sk-s b{font-size:13px}.sk-s .lk{opacity:.45}'
    + '.sk-doll{display:grid;grid-template-columns:54px minmax(120px,1fr) 54px;gap:6px;align-items:start;background:radial-gradient(circle at 50% 42%,#fffaf0,#e6d8bc);border:1.5px solid #c8b088;border-radius:14px;padding:8px}.sk-doll .cl{display:flex;flex-direction:column;gap:5px}.sk-doll .bd{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100%}.sk-doll .bd canvas{width:150px;height:160px;filter:drop-shadow(0 6px 4px rgba(60,40,20,.25))}.sk-doll .bd b{font-size:14px;color:#5a3e22}.sk-doll .bt{grid-column:1/4;display:grid;grid-template-columns:repeat(3,54px);justify-content:center;gap:6px}.sk-doll .sk-c b{font-size:9px}@media (max-height:520px){.sk-doll{grid-template-columns:44px minmax(100px,1fr) 44px;padding:6px}.sk-doll .cl{gap:3px}.sk-doll .bt{grid-template-columns:repeat(3,44px);gap:4px}.sk-doll .bd canvas{width:110px;height:118px}}'
    + '.sk-map canvas{width:100%;border-radius:12px;display:block;background:#bfe0f4}.sk-lg{display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:#7a6a58;margin-top:6px}.sk-lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}'
    + '.sk-rot{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;text-align:center;color:#fff;font-size:20px;font-weight:800;background:#3a5a7af2;padding:20px}@media (orientation:portrait) and (pointer:coarse){.sk-ov.play .sk-rot{display:flex}}';
  st.textContent += '.sk-hexw{display:flex;justify-content:center}.sk-hex{position:relative;width:300px;height:300px;margin:4px auto;flex:none}.sk-hx{position:absolute;width:62px;height:54px;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:#d8c8a8;cursor:pointer;display:flex;align-items:center;justify-content:center}.sk-hx::before{content:"";position:absolute;inset:3px;clip-path:inherit;background:#efe4cc}.sk-hx.ctr::before{background:radial-gradient(#fff6d8,#ead6a8)}.sk-hx.ctr{background:#d8a84a}.sk-hx.on{background:#3a7fa8}.sk-hx.lk{background:#fff3c0}'
    + '.sk-gem{position:relative;width:30px;height:30px;transform:rotate(45deg);border-radius:6px;box-shadow:inset -4px -4px 0 rgba(0,0,0,.18),inset 3px 3px 0 rgba(255,255,255,.45),0 0 10px var(--g)}.sk-gem i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(-45deg);font-style:normal;font-size:11px;font-weight:900;color:#fff;text-shadow:0 1px 2px #0008}'
    + '.sk-tray{display:flex;flex-wrap:wrap;gap:6px;min-height:44px;padding:6px;border:1.5px dashed #c8b088;border-radius:12px;background:#f6eedc}.sk-tr{width:40px;height:40px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1.5px solid transparent}.sk-tr.on{border-color:#3a7fa8;background:#dff0fb}'
    + '.sk-c u{position:absolute;left:4px;right:4px;bottom:3px;height:3px;border-radius:2px;background:#d8c8e8;overflow:hidden;text-decoration:none}.sk-c u b{display:block;height:100%;background:#9a6ae8}.sk-c em{position:absolute;right:2px;top:0;font-style:normal;font-size:11px;color:#9a6ae8;text-shadow:0 0 3px #fff}'
    + '.sk-tame{height:7px;border-radius:4px;background:#e6dcf4;overflow:hidden;margin:3px 0}.sk-tame b{display:block;height:100%;background:linear-gradient(90deg,#b49aff,#7a4ae8)}';
  document.head.appendChild(st);
}
function mkDom() {
  css(); ov = document.createElement('div'); ov.className = 'sk-ov'; ov.hidden = true;
  cv = document.createElement('canvas'); x = cv.getContext('2d', { alpha: false }); ov.appendChild(cv);
  panel = document.createElement('div'); panel.className = 'sk-pn'; panel.hidden = true; ov.appendChild(panel);
  const rot = document.createElement('div'); rot.className = 'sk-rot'; rot.innerHTML = '📱↻<br>휴대폰을 가로로 돌려 주세요'; ov.appendChild(rot);
  document.body.appendChild(ov);
  addEventListener('resize', () => { if (!ov.hidden) layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && !PANEL) openPanel('menu'); if (document.hidden) { save(); cloudFlush(); } });
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
const KM = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' };
function inputVec() {
  let sx = 0, sy = 0; if (KEYS.l) sx--; if (KEYS.r) sx++; if (KEYS.u) sy--; if (KEYS.d) sy++;
  if (TOUCH.pad && (TOUCH.pad.dx || TOUCH.pad.dy)) { sx = TOUCH.pad.dx; sy = TOUCH.pad.dy; if (hyp(sx, sy) < .25) return [0, 0]; }
  if (!sx && !sy) return [0, 0]; // 마우스 이동은 P.path 로(누르고 있으면 계속 갱신)
  return scr2w(sx, sy);
}
const inputHeld = k => !!TOUCH.held[k] || (k === 'atk' && MOUSE.atk);
const MOUSE = { x: 0, y: 0, down: 0, atk: 0 };
function mouseWorld() { const V = view(); return unIso((MOUSE.x - V.ox) / V.Z, (MOUSE.y - V.oy) / V.Z); }
function hitBtn(px, py) { for (const b of BTN) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b; return null; }
const PKEY = { KeyI: 'inv', KeyC: 'char', KeyS: 'skill', KeyM: 'map', KeyJ: 'quest', KeyB: 'board' };
function press(k, down) {
  if (!G) return; const P = G.P;
  if (k === 'atk') { TOUCH.held.atk = down; if (down) { P.tgt = null; basicAttack(); } return; }
  if (!down) return;
  if (k[0] === 's' && k.length === 2) { P.aimLock = false; P.aim = null; castSkill(+k[1]); }
  else if (k === 'pot' || k === 'wpot') drink(k); else if (k === 'dodge') doDodge(); else if (k === 'use') interact();
  else if (['inv', 'char', 'skill', 'map', 'menu'].includes(k)) openPanel(k);
}
// 화면을 누른 곳: 사람·표지·끊긴 다리·떨어진 물건이면 그쪽으로 가서 쓰기, 아니면 그냥 이동
function clickWorld(px, py) {
  const P = G.P, Wd = G.Wd, V = view(), [wx, wy] = unIso((px - V.ox) / V.Z, (py - V.oy) / V.Z), Z = V.Z;
  const onScr = (ex, ey, h) => { const [sx, sy] = iso(ex, ey), X = V.ox + sx * Z, Y = V.oy + sy * Z; return Math.abs(px - X) < 20 * Z && py > Y - h * Z && py < Y + 8 * Z; };
  P.tgt = null; P.goal = null;
  for (const k in Wd.npcAt) { const [nx, ny] = Wd.npcAt[k]; if (onScr(nx, ny, 56)) { P.goal = { k: 'npc', id: k, x: nx, y: ny, r: 1.4 }; P.path = [nx + .6, ny + .6]; return; } }
  for (const w of Wd.wps) if (onScr(w.x, w.y, 60)) { if (w.on) P.goal = { k: 'wp', x: w.x, y: w.y, r: 1.3 }; P.path = [w.x + .5, w.y + .5]; return; }
  const d = G.drops.find(d => onScr(d.x, d.y, 30)); if (d) { P.path = [d.x, d.y]; return; }
  const b = Wd.bridges[Wd.bq]; if (b.broken) for (const c of b.cells) { const cx = c % Wd.W + .5, cy = ((c / Wd.W) | 0) + .5; if (hyp(wx - cx, wy - cy) < 1.2) { P.goal = { k: 'bridge', x: cx, y: cy, r: 2.1 }; let best = null, bd = 1e9; for (const e of b.ends) { const ex = e % Wd.W + .5, ey = ((e / Wd.W) | 0) + .5, dd = hyp(ex - P.x, ey - P.y); if (dd < bd) { bd = dd; best = [ex, ey]; } } P.path = best || [cx, cy]; return; } }
  { const b2 = Wd.bridges[Wd.bq2]; if (b2.broken) for (const c of b2.cells) { const cx = c % Wd.W + .5, cy = ((c / Wd.W) | 0) + .5; if (hyp(wx - cx, wy - cy) < 1.2) { let best = null, bd = 1e9; for (const e of b2.ends) { const ex = e % Wd.W + .5, ey = ((e / Wd.W) | 0) + .5, dd = hyp(ex - P.x, ey - P.y); if (dd < bd) { bd = dd; best = [ex, ey]; } } P.path = best || [cx, cy]; return; } } }
  P.path = [wx, wy];
}
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; if (KM[e.code]) { KEYS[KM[e.code]] = 1; e.preventDefault(); }
    if (e.repeat) return; const c = e.code;
    if (c === 'Escape') { if (PANEL) { if (PANEL !== 'title') closePanel(); } else openPanel('menu'); return; }
    if (PANEL) { if (PANEL === 'title') return; if (PKEY[c]) { if (PANEL === PKEY[c]) closePanel(); else { SEL = null; SHOP = null; openPanel(PKEY[c]); } } return; }
    if (!G) return;
    if (/^Digit[1-4]$/.test(c)) { G.P.aimLock = !!MOUSE.in; if (MOUSE.in) { const [wx, wy] = mouseWorld(), dx = wx - G.P.x, dy = wy - G.P.y, d = hyp(dx, dy) || 1; G.P.aim = [dx / d, dy / d]; G.P.dir = w2dir(dx, dy); } castSkill(+c[5] - 1); }
    else if (c === 'Space') { doDodge(); e.preventDefault(); } else if (c === 'KeyQ') drink('pot'); else if (c === 'KeyR') drink('wpot'); else if (c === 'KeyF' || c === 'KeyE') interact();
    else if (PKEY[c]) openPanel(PKEY[c]);
  });
  addEventListener('keyup', e => { if (KM[e.code]) KEYS[KM[e.code]] = 0; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (!G || PANEL) return; const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; const b = hitBtn(px, py);
    if (e.pointerType === 'touch' || TOUCH.on && e.pointerType !== 'mouse') { TOUCH.on = true; if (b) { press(b.k, 1); TOUCH.ids = TOUCH.ids || {}; TOUCH.ids[e.pointerId] = b.k; return; }
      if (px < lay.cw * .45) { TOUCH.pad = { id: e.pointerId, x0: px, y0: py, dx: 0, dy: 0 }; } else clickWorld(px, py); return; }
    if (b) { press(b.k, 1); return; }
    MOUSE.x = px; MOUSE.y = py; MOUSE.in = 1;
    if (e.button === 2) { MOUSE.atk = 1; return; }
    if (e.button === 0) { MOUSE.down = 1; clickWorld(px, py); }
  });
  addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (TOUCH.pad && e.pointerId === TOUCH.pad.id) { const dx = px - TOUCH.pad.x0, dy = py - TOUCH.pad.y0, d = hyp(dx, dy), m = Math.min(1, d / 44); TOUCH.pad.dx = d ? dx / d * m : 0; TOUCH.pad.dy = d ? dy / d * m : 0; return; }
    if (e.pointerType !== 'mouse') return;
    MOUSE.x = px; MOUSE.y = py; MOUSE.in = 1; MOUSE.down = e.buttons & 1 ? MOUSE.down : 0; MOUSE.atk = e.buttons & 2 ? 1 : 0;
    if (MOUSE.down && G && !PANEL) { const P = G.P; if (!P.goal) { const [wx, wy] = mouseWorld(); P.path = [wx, wy]; P.tgt = null; } } });
  setInterval(() => { if (MOUSE.down && G && !PANEL && !G.P.goal && !TOUCH.on) { const [wx, wy] = mouseWorld(); G.P.path = [wx, wy]; } }, 120); // 누른 채 가만히 있어도 계속 따라감
  const up = e => { if (TOUCH.pad && e.pointerId === TOUCH.pad.id) TOUCH.pad = null; if (TOUCH.ids && TOUCH.ids[e.pointerId]) { press(TOUCH.ids[e.pointerId], 0); delete TOUCH.ids[e.pointerId]; }
    if (e.pointerType === 'mouse') { MOUSE.down = e.buttons & 1 ? MOUSE.down : 0; MOUSE.atk = e.buttons & 2 ? 1 : 0; } };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('blur', () => { MOUSE.down = 0; MOUSE.atk = 0; for (const k in KEYS) KEYS[k] = 0; });
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
    case 'bell': tone(660, .9, 'sine', .12, 640); tone(1320, .6, 'sine', .05, 1300); tone(990, .7, 'triangle', .04); break;
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
function tameBar(it) { if (!it || it.g || !it.hid || !it.id) return ''; return it.tame >= TAME_N ? '<em>✦</em>' : `<u><b style="width:${Math.round((it.tame || 0) / TAME_N * 100)}%"></b></u>`; }
function cell(it, k, extra) { const r = it && !it.g ? ' r' + it.r : ''; return `<div class="sk-c${r}${it && it.st === -1 && it.id ? ' cu' : ''}${SEL === k ? ' on' : ''}" data-c="${k}">${extra || ''}${it ? '<span data-ic="' + k + '"></span>' : ''}${tameBar(it)}${it && it.g && it.n > 1 ? '<i>' + it.n + '</i>' : it && it.en ? '<i>+' + it.en + '</i>' : ''}</div>`; }
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
  else { for (const [k, v] of it.af) L.push(`<div class="a">${afxText(k, v, P.cls)}</div>`); if (it.hid) L.push(it.tame >= TAME_N ? `<div class="h">✦ 길들임 완료: <b>${afxText(it.hid[0], it.hid[1], P.cls)}</b></div>` : `<div class="h">길들이기 ${it.tame || 0}/${TAME_N} · 숨은 옵션 <b>???</b></div><div class="sk-tame"><b style="width:${Math.round((it.tame || 0) / TAME_N * 100)}%"></b></div><div class="m" style="font-size:11px">입고 밑것을 ${TAME_N - (it.tame || 0)}마리 더 쓰러뜨리면 숨은 옵션이 열려요.</div>`); }
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
    const ss = SEL && SEL[0] === 'e' ? SEL.slice(1) : null, it = ss ? P.eq[ss] : null, sl = q => cell(P.eq[q], 'e' + q, '<b>' + SLOTN[q] + '</b>');
    h = `<div class="sk-bx" style="max-width:820px">${X}<h3>캐릭터 <small style="font-size:12px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 방어력 ${P.ac} · 생명력 ${P.mhp}</small></h3><div class="sk-two"><div>
      <div class="sk-doll"><div class="cl">${['helm', 'ear', 'amulet', 'armor', 'inner', 'gloves'].map(sl).join('')}</div><div class="bd"><span data-po="${P.cls}"></span><b>${CLASSES[P.cls].name}</b><small style="color:#8a7458;font-size:11px">이음꾼 · ${P.lv}레벨</small></div><div class="cl">${['cloak', 'belt', 'legs', 'boots', 'ring1', 'ring2'].map(sl).join('')}</div><div class="bt">${['weapon', 'off', 'sail'].map(sl).join('')}</div></div>
      <p class="m" style="font-size:11.5px;color:#8a7458;margin:6px 2px">칸을 누르면 자세히 보여요. 갈아입기는 가방(I)에서 해요.</p></div><div>`;
    if (it) h += itemCard(it, P) + `<button class="sk-b" data-a="uneq">벗기</button>` + (it.st === -1 && count('pure') ? `<button class="sk-b g" data-a="purify">샘물로 정화</button>` : '') + `<button class="sk-b" data-a="nosel">능력 보기</button>`;
    else { h += `<h4 style="margin-top:0">능력 <small style="color:#8a7458">남은 점수 ${P.pts}</small></h4>`;
      for (const [s2, n, d] of STATS) h += `<div class="sk-row"><div class="f"><b>${n}</b> ${P.st[s2]} <small>(${CLASSES[P.cls].stat[s2]} + 올림 ${P.sp[s2] || 0})</small><br><small>${d}</small></div><button class="sk-b" data-a="st" data-s="${s2}" ${P.pts ? '' : 'disabled'}>+1</button></div>`;
      const big = P.dmg; h += `<h4>지금 수치</h4><div class="sk-card">생명력 ${P.mhp} · 바람 ${P.mwind} (초당 +${P.wreg.toFixed(1)})<br>피해: 작은 적 ${big[0]}~${big[1]} / 큰 적 ${big[2]}~${big[3]} · 피해 +${Math.round(P.dmgp)}%<br>방어력 ${P.ac} (맞을 확률 ${Math.round(clamp(.92 - P.ac * .008, .55, .95) * 100)}%)${P.blk ? ' · 막기 ' + Math.round(P.blk) + '%' : ''}<br>공격 속도 초당 ${P.aspd.toFixed(2)}번 · 치명타 ${P.crit.toFixed(1)}% · 이동 ${P.move.toFixed(1)}<br>돛: 활공 ${P.sail[0]}칸 / ${P.sail[1]}초${P.find ? ' · 좋은 물건 +' + P.find + '%' : ''}${P.xpm > 1 ? ' · 경험치 +' + Math.round((P.xpm - 1) * 100) + '%' : ''}<br>쓰러뜨린 밑것들 ${P.kills}마리 · 경험 ${P.xp}/${xpNeed(P.lv)}</div>${respecBtn('rs')}`; }
    h += '</div></div>' + TOAST + '</div>';
  } else if (k === 'map') {
    h = `<div class="sk-bx sk-map" style="max-width:900px">${X}<h3>지도 <small style="font-size:12px;color:#8a7458">1장 민들레 섬</small></h3><canvas data-map></canvas><div class="sk-lg"><span><i style="background:#fff;border:2px solid #3a5a7a"></i>나</span><span><i style="background:#ffd166"></i>마을 사람</span><span><i style="background:#9fe4ff"></i>바람개비 표지</span><span><i style="background:#ff6a4a"></i>할 일 목표</span><span><i style="background:#c8a070"></i>다리</span></div></div>`;
  } else if (k === 'skill') {
    const sel = SEL; h = `<div class="sk-bx">${X}<h3>스킬 <small style="font-size:12px;color:#8a7458">남은 점수 ${P.skp} · 같은 갈래 스킬끼리 점수당 피해 +6%(잇기)</small></h3><div style="margin:-2px 0 6px"><button class="sk-b p" data-a="board" ${P.lv >= BOARD_LV ? '' : 'disabled'}>◆ 나침반판 (B)${P.lv >= BOARD_LV ? '' : ' · ' + BOARD_LV + '레벨'}</button>${respecBtn('rk')}</div><div class="sk-sk">`;
    BRANCH[P.cls].forEach((bn, bi) => { h += `<div class="sk-br"><h4>${bn}</h4>`; for (const s of SKILLS[P.cls].filter(q => q.br === bi)) { const lv = P.sk[s.id] || 0, lk = P.lv < s.req; h += `<div class="sk-s${sel === s.id ? ' on' : ''}" data-sk="${s.id}"><span data-si="${s.id}"></span><div class="f ${lk ? 'lk' : ''}"><b>${s.name}</b> ${lv}/10${P.skb[bi] && lv ? ' (+' + P.skb[bi] + ')' : ''}${lk ? ' · ' + s.req + '레벨' : ''}<br>${esc(s.desc)}<br><small>바람 ${s.cost} · ${s.cd}초${lv >= 5 && P.fork[s.id] != null ? ' · 갈래: ' + s.fork[P.fork[s.id]][0] : ''}${lv >= 10 && P.fork2[s.id] != null ? ' · ' + fork2Of(s)[P.fork2[s.id]][0] : ''}</small></div></div>`; } h += '</div>'; });
    h += '</div>'; { const U = ULT[P.cls], on = P.lv >= U.req; h += `<div class="sk-card" style="margin-top:8px;border-color:#e8b05a;background:#fff6e4"><b style="color:#b0702a">궁극 기술 · ${U.name}</b> ${on ? '<small style="color:#3a7fa8">익힘 · 4번 칸</small>' : '<small style="color:#a88a5a">' + U.req + '레벨에 저절로 익혀요</small>'}<br>${esc(U.desc)}<br><small>다시 쓰기 ${U.cd}초 · 바람 안 씀</small></div>`; }
    const s = sel && SKILLS[P.cls].find(q => q.id === sel);
    if (s) { const lv = P.sk[s.id] || 0; h += `<div class="sk-card" style="margin-top:8px"><b>${s.name}</b> ${lv}/10 — ${esc(s.desc)}<br>`;
      h += `<button class="sk-b g" data-a="learn" ${P.skp && lv < 10 && P.lv >= s.req ? '' : 'disabled'}>배우기 +1</button> `; if (lv) h += [0, 1, 2, 3].filter(i => P.slots[i] !== 'ult').map(i => `<button class="sk-b${P.slots[i] === s.id ? ' p' : ''}" data-a="slot" data-i="${i}">${TOUCH.on ? '칸 ' : ''}${i + 1}번에 놓기</button>`).join('');
      h += `<h4>갈래 고르기 (스킬 5레벨)</h4>` + s.fork.map((f, i) => `<button class="sk-b${P.fork[s.id] === i ? ' p' : ''}" data-a="fork" data-i="${i}" ${lv >= 5 && P.fork[s.id] == null ? '' : 'disabled'}><b>${f[0]}</b> — ${esc(f[1])}</button>`).join('<br>') + (P.fork[s.id] != null ? '<p class="m" style="font-size:11px">갈래는 다시 나누기로만 바꿀 수 있어요.</p>' : '');
      h += `<h4>두 번째 갈래 (스킬 10레벨)</h4>` + fork2Of(s).map((f, i) => `<button class="sk-b${P.fork2[s.id] === i ? ' p' : ''}" data-a="fork2" data-i="${i}" ${lv >= 10 && P.fork2[s.id] == null ? '' : 'disabled'}><b>${f[0]}</b> — ${esc(f[1])}</button>`).join('<br>') + '</div>'; }
    else h += '<p style="font-size:12.5px;color:#8a7458">스킬을 누르면 배우기·칸 놓기·갈래 고르기를 할 수 있어요.</p>';
    h += TOAST + '</div>';
  } else if (k === 'board') h = boardHtml();
  else if (k === 'daily') h = dailyHtml(X);
  else if (k === 'talk') h = talkHtml(arg);
  else if (k === 'smith') h = smithHtml();
  else if (k === 'travel') { h = `<div class="sk-bx" style="max-width:420px">${X}<h3>바람개비 표지</h3>${G.Wd.wps.map((w, i) => `<div class="sk-row"><div class="f"><b>${w.n}</b></div><button class="sk-b p" data-a="go" data-i="${i}" ${w.on ? '' : 'disabled'}>${w.on ? '날아가기' : '아직 잠김'}</button></div>`).join('')}</div>`; }
  else if (k === 'quest') { h = `<div class="sk-bx" style="max-width:560px">${X}<h3>할 일</h3>`; for (const id in QUESTS) { const q = P.q[id], Q = QUESTS[id]; if (!q) continue; h += `<div class="sk-row"><div class="f"><b>${Q.n}</b> ${q.s === 3 ? '✔' : q.s === 2 ? '(보고하기)' : ''}<br><small>${esc(Q.goal)} — ${NPCDEF[Q.from].n}</small></div></div>`; } h += '</div>'; }
  else if (k === 'menu') { h = `<div class="sk-bx" style="max-width:420px;text-align:center">${X}<h3>잠깐 쉬기</h3><button class="sk-b p" data-a="x">계속하기</button><br><button class="sk-b" data-a="quest">할 일 보기</button><br><button class="sk-b" data-a="mute">${A.muted ? '소리 켜기' : '소리 끄기'}</button><br><button class="sk-b" data-a="help">조작법</button><br><button class="sk-b" data-a="title">저장하고 처음 화면으로</button><br><button class="sk-b" data-a="quit">저장하고 나가기</button><p class="m" style="font-size:11.5px;color:#8a7458;margin-top:8px">기록은 10초마다, 그리고 창을 닫을 때 이 기기에 저장돼요.</p></div>`; }
  else if (k === 'help') { h = `<div class="sk-bx" style="max-width:600px">${X}<h3>조작법</h3><div class="sk-card"><b>PC</b><br>마우스 왼쪽: 이동 (누르고 있으면 따라가요 · 사람·표지·다리를 누르면 가서 말 걸기)<br>마우스 오른쪽: 공격 (누르고 있으면 계속 · 적을 누르면 다가가서 공격)<br>1~4: 기술 (마우스 쪽으로 · 4번은 궁극 기술) · Q 민들레 차 · R 바람 사탕 · 스페이스 돛 활공(피하기)<br>I 가방 · C 캐릭터 · S 기술 · M 지도 · B 나침반판 · J 할 일 · F 말 걸기 · Esc 쉬기<br><br><b>휴대폰</b> (가로 화면)<br>왼쪽 아무 곳이나 끌어서 이동 · 오른쪽 큰 버튼 공격(누르고 있으면 계속, 가까운 적을 알아서 노려요) · 둘레 버튼 기술 4개(금색 테두리가 궁극 기술) · 돛·차·사탕 버튼 · 사람이나 물건을 톡 누르면 그쪽으로 가요.<br><br><b>요령</b>: 방패지기는 적을 섬 끝으로 밀어 떨어뜨릴 수 있어요(보상은 조금 줄어요). 쉬고 돌아오면 순풍(경험치 2배)이 쌓여 있어요.</div></div>`; }
  else if (k === 'end') h = endHtml();
  panel.innerHTML = h; bindPanel(arg);
  if (k === 'inv') fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : c[0] === 'i' ? P.inv[+c.slice(1)] : c[0] === 'b' ? SHOP[+c.slice(1)] : null);
  if (k === 'char') { fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : null); panel.querySelectorAll('[data-po]').forEach(el => el.replaceWith(portrait(el.dataset.po, 150))); }
  if (k === 'map') drawMap(panel.querySelector('[data-map]'));
  if (k === 'board') CONF = null;
  if (k === 'smith') fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : P.inv[+c.slice(1)]);
  if (k === 'skill') panel.querySelectorAll('[data-si]').forEach(el => { const s = SKILLS[P.cls].find(q => q.id === el.dataset.si), c = document.createElement('canvas'), d = 2; c.width = c.height = 42 * d; const g = c.getContext('2d'); g.scale(d, d); drawSkillIcon(g, s, 0, 0, 42, P.cls); el.replaceWith(c); });
}
let CONF = null; // 한 번 더 눌러 확인
const respecCost = P => 30 * P.lv;
function respecBtn(kind) { const P = G.P, free = !P.flags[kind], cost = respecCost(P), what = kind === 'rs' ? '능력 점수' : '스킬 점수';
  return `<button class="sk-b${CONF === kind ? ' p' : ''}" data-a="respec" data-k="${kind}" ${free || P.gold >= cost ? '' : 'disabled'}>${CONF === kind ? '정말 다시 나눌까요? 한 번 더 누르세요' : what + ' 다시 나누기 (' + (free ? '1장 무료 1번' : cost + 'G') + ')'}</button>`; }
function doRespec(kind) { const P = G.P, free = !P.flags[kind], cost = respecCost(P); if (!free && P.gold < cost) { toast('골드가 모자라요'); return; } if (free) P.flags[kind] = 1; else P.gold -= cost;
  if (kind === 'rs') { let n = 0; for (const k in P.sp) n += P.sp[k]; P.sp = {}; P.pts += n; toast('능력 점수 ' + n + '점을 돌려받았어요'); }
  else { const st = CLS_START[P.cls][2]; let n = 0; for (const k in P.sk) n += P.sk[k]; n -= 1; P.sk = { [st]: 1 }; P.fork = {}; P.fork2 = {}; P.cdx = {}; P.skp += Math.max(0, n); P.slots = P.slots.map(x2 => x2 === 'ult' ? 'ult' : null); autoSlots(P); toast('스킬 점수 ' + Math.max(0, n) + '점을 돌려받았어요. 갈래도 다시 고를 수 있어요'); }
  calc(P); sfx('ench'); }
function boardHtml() {
  const P = G.P, B = P.board, I = boardInfo(P), sum = boardSum(P), sel = SEL, w = 62, hh = 54;
  const gem = (sh, sz) => `<div class="sk-gem" style="--g:${SHARD[sh.c].c};background:${SHARD[sh.c].c};width:${sz}px;height:${sz}px${sh.q === 3 ? ';outline:2px solid #fff6c0' : ''}"><i>${'◆'.repeat(sh.q)}</i></div>`;
  let cells = ''; HEX.forEach(([q, r], i) => { const x2 = 150 - w / 2 + q * w * .75, y2 = 150 - hh / 2 + (r + q / 2) * hh, sh = B[i], lk = sh && HEXN[i].some(n => B[n] && B[n].c === sh.c);
    cells += `<div class="sk-hx${i === HEXC ? ' ctr' : ''}${sel === 'b' + i ? ' on' : ''}${lk ? ' lk' : ''}" data-a="hx" data-i="${i}" style="left:${x2}px;top:${y2}px">${sh ? gem(sh, 26) : i === HEXC ? '<small style="position:relative;font-size:10px;color:#a8803a;font-weight:800">바람눈</small>' : ''}</div>`; });
  const fxs = Object.entries(sum).filter(([, v]) => v).map(([k, v]) => afxText(k, Math.round(v * 10) / 10, P.cls)).join(' · ') || '아직 없어요';
  const sets = Object.keys(SHARD).map(c => `<div class="${I.sets[c] ? 'a' : 'm'}"><b style="color:${SHARD[c].c}">${SHARD[c].n} 3개 잇기</b>: ${SHARD[c].set.map(([k, v]) => afxText(k, v, P.cls)).join(', ')}${I.sets[c] ? ' ✓' : ''}</div>`).join('') + `<div class="${I.trio ? 'a' : 'm'}"><b>세 바람</b>(세 색 모두 잇기): ${TRIO.map(([k, v]) => afxText(k, v, P.cls)).join(', ')}${I.trio ? ' ✓' : ''}</div>`;
  // 합치기: 같은 색·품질 3개 → 한 단계 위
  const groups = {}; P.shd.forEach(sh => { if (sh.q < 3) { const k = sh.c + sh.q; groups[k] = (groups[k] || 0) + 1; } });
  const merges = Object.entries(groups).filter(([, n]) => n >= 3).map(([k]) => `<button class="sk-b" data-a="merge" data-k="${k}">${SHARD[k.slice(0, -1)].n} ${SHQ[+k.slice(-1)]} 3개 → ${SHQ[+k.slice(-1) + 1]}</button>`).join('');
  const ts = sel && sel[0] === 't' ? P.shd[+sel.slice(1)] : sel && sel[0] === 'b' ? B[+sel.slice(1)] : null;
  return `<div class="sk-bx" style="max-width:820px"><button class="sk-x" data-a="x">✕</button><h3>나침반판 <small style="font-size:12px;color:#8a7458">바람 조각을 끼워 힘을 얻어요 · 둥지지기·우두머리가 조각을 줘요</small></h3><div class="sk-two"><div><div class="sk-hexw"><div class="sk-hex">${cells}</div></div>
    <h4>조각 주머니 <small style="color:#8a7458">${P.shd.length}/${SHD_MAX} · 누르고 판의 칸을 누르면 끼워요</small></h4><div class="sk-tray">${P.shd.map((sh, i) => `<div class="sk-tr${sel === 't' + i ? ' on' : ''}" data-a="tr" data-i="${i}">${gem(sh, 24)}</div>`).join('') || '<small style="color:#8a7458;padding:8px">비어 있어요</small>'}</div>${merges ? '<h4>합치기</h4>' + merges : ''}</div><div>
    ${ts ? `<div class="sk-card"><div class="n" style="color:${shade(SHARD[ts.c].c)}">${shardName(ts)}</div><div class="m">${SHARD[ts.c].d}</div>${SHARD[ts.c].fx.map(([k, v]) => '<div class="a">' + afxText(k, v * ts.q, P.cls) + ' (기본)</div>').join('')}<div class="m" style="font-size:11px">둘레에 같은 색이 있으면 1개마다 +25%, 가운데 바람눈은 1.5배</div>${sel[0] === 'b' ? '<button class="sk-b" data-a="unhx">주머니로 빼기</button>' : ''}</div>` : '<p class="m" style="font-size:12.5px;color:#8a7458">같은 색 조각을 붙여 놓을수록 세져요. 같은 색 3개를 이으면 보너스, 세 색을 다 이으면 「세 바람」이 켜져요. 언제든 무료로 바꿔 끼울 수 있어요.</p>'}
    <h4>지금 얻는 힘</h4><div class="sk-card">${fxs}</div><h4>잇기 보너스</h4><div class="sk-card">${sets}</div>
    <button class="sk-b" data-a="skillp">← 스킬로</button></div></div>${TOAST}</div>`;
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
  if (id === 'chief') { if (!q('q1')) offer('q1'); else if (q('q1').s === 2) finish('q1'); else if (q('q1').s === 3 && !q('q3')) offer('q3'); else if (q('q3') && q('q3').s === 2 && P.flags['wp_바람개비 언덕']) finish('q3'); else if (q('q3') && q('q3').s === 2) lines = ['우두머리를 쓰러뜨렸다고? 언덕의 바람개비 표지에 손을 얹어 주게. 그래야 바람이 섬에 돌아오네.']; else if (q('q3') && q('q3').s === 3 && !q('q5')) offer('q5'); else if (q('q5') && q('q5').s === 2) finish('q5'); else if (q('q5') && q('q5').s === 1) lines = ['둥지 껍질은 들판과 늪의 둥지지기가 떨군다네. 세 개 모아 바람개비 언덕 동쪽 끊긴 다리로 가게.']; else if (q('q5') && q('q5').s === 3 && !q('q7')) offer('q7'); else if (q('q7') && q('q7').s === 2 && P.flags['wp_둥지섬']) finish('q7'); else if (q('q7') && q('q7').s === 2) lines = ['큰 왜가리를 쓰러뜨렸다고?! 둥지섬 바람개비 표지에 손을 얹어 주게. 바람이 돌아오게.']; else if (q('q7') && q('q7').s === 1) lines = ['둥지섬은 갈대 늪 맨 끝일세. 녀석이 성나면 하늘에서 깃털이 쏟아진다니 붉은 자리를 피하게.']; else if (q('q7') && q('q7').s === 3) lines = ['민들레 섬이 더는 가라앉지 않네. 이음꾼, 정말 고맙네.', '녹슨 풍차 군도로 가는 길은… 머지않아 열릴 걸세.']; else lines = ['널빤지는 들판 밑것들이 물고 다닌다네. 다리는 마을 동쪽 들판 너머, 맨 위쪽 섬 끝에 있지.']; }
  if (id === 'sage') { if (!q('q2')) offer('q2'); else if (q('q2').s === 2) finish('q2'); else if (P.flags.bridge2 && q('q2').s === 3 && !q('q6')) offer('q6'); else if (q('q6') && q('q6').s === 2) finish('q6'); else lines = ['큰바람은 원래 세상을 한 바퀴 돌면서 섬마다 숨을 불어넣었대. 그게 멎었으니 뜸돌도 잠들어 가는 거야.', '감정 안 된 물건이 있으면 보여 줘. 하나에 15G면 봐 줄게.'];
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
function endHtml() { const P = G.P; if (P.q.q7 && P.q.q7.s === 3) return `<div class="sk-bx sk-talk" style="text-align:center"><h3>1장 「민들레 섬」 끝</h3><p>큰 왜가리의 날개 밑에 갇혀 있던 바람이 풀려나 섬 밑으로 스며들었다.</p><p>민들레 섬은 더는 가라앉지 않는다. 하지만 큰바람이 멎은 까닭은 아직 저 너머에 있다 — 녹슨 풍차 군도.</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>2장은 다음에 열려요. 그동안 늪과 둥지섬에서 장비를 모으고 강화해 보세요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`;
  return `<div class="sk-bx sk-talk" style="text-align:center"><h3>1장 「민들레 섬」 앞부분 끝</h3><p>바람개비가 다시 돌기 시작했다. 아주 약하지만, 분명히 바람이다.</p><p>그런데 저 멀리 둥지섬 쪽 하늘에서 커다란 날개 그림자가 구름을 가르고 지나갔다…</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>촌장 들메에게 다시 말을 걸면 1장 뒷부분(갈대 늪·둥지섬)이 이어져요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }
function bindPanel(arg) {
  panel.onclick = e => {
    const t = e.target.closest('[data-a],[data-c],[data-sk]'); if (!t) { if (e.target === panel && PANEL !== 'title') closePanel(); return; }
    const P = G && G.P, a = t.dataset.a;
    if (t.dataset.c) { SEL = t.dataset.c; if (SEL[0] === 'b' && PANEL === 'inv') {} render(arg); return; }
    if (t.dataset.sk) { SEL = t.dataset.sk; render(); return; }
    if (a === 'x') { closePanel(); if (PANEL === null && G && G.endNext) { G.endNext = 0; openPanel('end'); } return; }
    if (a === 'eq') { equip(+SEL.slice(1)); SEL = null; render(); }
    else if (a === 'uneq') { unequip(SEL.slice(1)); SEL = null; render(); }
    else if (a === 'nosel') { SEL = null; render(); }
    else if (a === 'use') { const it = P.inv[+SEL.slice(1)]; drink(it.g); if (!P.inv.includes(it)) SEL = null; render(); }
    else if (a === 'drop') { const it = P.inv.splice(+SEL.slice(1), 1)[0]; G.drops.push({ x: P.x + .4, y: P.y + .4, it, t: -1 }); SEL = null; render(); }
    else if (a === 'sell') { const i = +SEL.slice(1), it = P.inv[i]; P.gold += priceOf(it); P.inv.splice(i, 1); SEL = null; sfx('coin'); render(); }
    else if (a === 'buy') { const it = SHOP[+SEL.slice(1)], pr = buyPrice(it); if (P.gold < pr) { toast('골드가 모자라요'); return; } const c = it.g ? goods(it.g) : it; if (!addInv(c)) { toast('가방이 가득 찼어요'); return; } P.gold -= pr; if (!it.g) { SHOP.splice(SHOP.indexOf(it), 1); SEL = null; } sfx('coin'); render(); }
    else if (a === 'coin') { const B = opts.bonus, day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10); if (P.flags.coinDay !== day) { P.flags.coinDay = day; P.flags.coinN = 0; } if (P.flags.coinN >= 5 || !B.spend(1)) return; P.flags.coinN++; P.gold += 200; sfx('coin'); render(); }
    else if (a === 'lookit') { const it = P.inv[+SEL.slice(1)]; if (useGood('look')) { it.id = true; sfx('ench'); SEL = 'i' + P.inv.indexOf(it); } render(); }
    else if (a === 'purify') { const it = P.eq[SEL.slice(1)]; if (useGood('pure')) { it.st = 0; calc(P); sfx('ench'); toast('정화했어요'); } render(); }
    else if (a === 'st') { if (P.pts > 0) { P.pts--; P.sp[t.dataset.s] = (P.sp[t.dataset.s] || 0) + 1; calc(P); } render(); }
    else if (a === 'learn') { const s = SKILLS[P.cls].find(q => q.id === SEL); if (P.skp > 0 && P.lv >= s.req && (P.sk[s.id] || 0) < 10) { P.skp--; P.sk[s.id] = (P.sk[s.id] || 0) + 1; autoSlots(P); if (P.sk[s.id] === 5) toast('5레벨! 갈래를 고를 수 있어요'); if (P.sk[s.id] === 10) toast('10레벨! 두 번째 갈래를 고를 수 있어요'); } render(); }
    else if (a === 'fork2') { const s = SKILLS[P.cls].find(q => q.id === SEL); if ((P.sk[s.id] || 0) >= 10 && P.fork2[s.id] == null) { P.fork2[s.id] = +t.dataset.i; toast('「' + fork2Of(s)[+t.dataset.i][0] + '」 갈래를 골랐어요'); } render(); }
    else if (a === 'dclaim') { claimTask(+t.dataset.i); render(); }
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
    else if (a === 'respec') { const kd = t.dataset.k; if (CONF === kd) { CONF = null; doRespec(kd); } else CONF = kd; render(); }
    else if (a === 'board') { PANEL = 'board'; SEL = null; render(); }
    else if (a === 'skillp') { PANEL = 'skill'; SEL = null; render(); }
    else if (a === 'tr') { const k2 = 't' + t.dataset.i; if (SEL && SEL[0] === 'b') { const bi = +SEL.slice(1), ti = +t.dataset.i, o = P.board[bi]; P.board[bi] = P.shd[ti]; P.shd.splice(ti, 1); if (o) P.shd.push(o); SEL = null; calc(P); sfx('pick'); } else SEL = SEL === k2 ? null : k2; render(); }
    else if (a === 'hx') { const i = +t.dataset.i, B = P.board; if (SEL && SEL[0] === 't') { const ti = +SEL.slice(1), o = B[i]; B[i] = P.shd[ti]; P.shd.splice(ti, 1); if (o) P.shd.push(o); SEL = null; calc(P); sfx('pick'); }
      else if (SEL && SEL[0] === 'b' && SEL !== 'b' + i) { const j = +SEL.slice(1); [B[i], B[j]] = [B[j], B[i]]; SEL = null; calc(P); sfx('pick'); } else SEL = B[i] || SEL === 'b' + i ? (SEL === 'b' + i ? null : 'b' + i) : null; render(); }
    else if (a === 'unhx') { const i = +SEL.slice(1); if (P.board[i] && P.shd.length < SHD_MAX) { P.shd.push(P.board[i]); P.board[i] = null; calc(P); } SEL = null; render(); }
    else if (a === 'merge') { const c = t.dataset.k.slice(0, -1), q = +t.dataset.k.slice(-1); let n = 0; P.shd = P.shd.filter(sh => { if (n < 3 && sh.c === c && sh.q === q) { n++; return false; } return true; }); if (n === 3) { P.shd.push({ c, q: q + 1 }); sfx('ench'); toast(SHARD[c].n + ' ' + SHQ[q + 1] + '을 만들었어요'); } SEL = null; render(); }
    else if (a === 'quest') { PANEL = 'quest'; render(); } else if (a === 'help') { PANEL = 'help'; render(); }
    else if (a === 'mute') { A.muted = !A.muted; try { localStorage.setItem('sky_mute', A.muted ? '1' : '0'); } catch (er) {} if (A.master) A.master.gain.value = A.muted ? 0 : .45; render(); }
    else if (a === 'title') { save(); G = null; title(); }
    else if (a === 'quit') { save(); close(); }
    else if (a === 'pick') { TSEL = t.dataset.cls; title(); }
    else if (a === 'start') startFrom(t.dataset.n === '1');
  };
}
function drawMap(c) {
  if (!c) return; const Wd = G.Wd, P = G.P, w = Math.min(860, (panel.clientWidth || innerWidth) - 60), d = Math.min(2, window.devicePixelRatio || 1);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const s2 of Wd.islands) for (const [a, b] of s2.poly) { const [sx, sy] = iso(a, b); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const pad = 30, sc = Math.min((w - pad * 2) / (x1 - x0), ((innerHeight * .62) - pad * 2) / (y1 - y0 + 30)), h = (y1 - y0 + 30) * sc + pad * 2;
  c.width = w * d; c.height = h * d; c.style.height = h + 'px'; const g = c.getContext('2d'); g.scale(d, d);
  const M = (a, b) => { const [sx, sy] = iso(a, b); return [pad + (sx - x0) * sc, pad + (sy - y0) * sc]; };
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#9ccbea'); bg.addColorStop(1, '#e4f0f6'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (const s2 of Wd.order || Wd.islands) { const pts = s2.poly.map(([a, b]) => M(a, b)); g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b + 7) : g.moveTo(a, b + 7)); g.closePath(); g.fillStyle = '#8a6a48'; g.fill();
    g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); g.fillStyle = s2.kind === 'rock' ? '#9ab878' : s2.kind === 'town' ? '#a8d488' : '#94c870'; g.fill(); g.strokeStyle = '#5f8a3a'; g.lineWidth = 1.5; g.stroke(); }
  for (const b of Wd.bridges) { g.fillStyle = b.broken ? '#8a6a50' : '#c8a070'; for (const i of b.cells) { const [a, bb] = M(i % Wd.W + .5, ((i / Wd.W) | 0) + .5); g.fillRect(a - 2.5, bb - 1.5, 5, 3); } if (b.broken) { const i = b.cells[b.cells.length >> 1], [a, bb] = M(i % Wd.W + .5, ((i / Wd.W) | 0) + .5); g.font = '700 11px system-ui'; g.textAlign = 'center'; g.fillStyle = '#a83a2a'; g.fillText('끊어진 다리', a, bb - 8); } }
  const T = Wd.islands[Wd.town]; { const [a, b] = M(T.cx, T.cy); g.fillStyle = '#d8d0c0'; g.beginPath(); g.ellipse(a, b, 3.2 * sc * 32, 3.2 * sc * 16, 0, 0, TAU); g.fill(); }
  g.font = '800 12px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.85)';
  const lab = (s2, t) => { const [a, b] = M(s2.cx, s2.cy - s2.r * .9); g.fillStyle = '#3a4a2a'; g.strokeText(t, a, b); g.fillText(t, a, b); };
  lab(T, '민들레 마을'); lab(Wd.islands[Wd.hill], '바람개비 언덕'); Wd.fi.forEach((k2, i) => lab(Wd.islands[k2], ['동쪽 들판', '남쪽 들판', '가운데 들판', '윗 들판', '아랫 들판'][i] || '들판')); Wd.mi.forEach((k2, i) => lab(Wd.islands[k2], ['갈대 늪 어귀', '갈대 나루', '안쪽 갈대 늪'][i])); lab(Wd.islands[Wd.nestI], '둥지섬');
  if (G.today != null) { const s2 = Wd.islands[G.today], [a, b] = M(s2.cx, s2.cy - s2.r * .9); g.font = '800 11px system-ui'; g.fillStyle = '#c07a10'; g.strokeText('★ 오늘의 섬', a, b + 14); g.fillText('★ 오늘의 섬', a, b + 14); }
  if (G.chest) { const [a, b] = M(G.chest.x, G.chest.y); g.fillStyle = '#ffd166'; g.strokeStyle = '#7a5a20'; g.lineWidth = 1.5; g.fillRect(a - 5, b - 4, 10, 8); g.strokeRect(a - 5, b - 4, 10, 8); }
  if (Wd.signAt && P.daily) { const [a, b] = M(...Wd.signAt); g.fillStyle = '#e8b05a'; g.strokeStyle = '#7a5a20'; g.lineWidth = 1.2; g.fillRect(a - 4, b - 4, 8, 8); g.strokeRect(a - 4, b - 4, 8, 8); }
  for (const k2 in Wd.npcAt) { const [a, b] = M(...Wd.npcAt[k2]); g.fillStyle = '#ffd166'; g.strokeStyle = '#7a5a20'; g.lineWidth = 1.2; g.beginPath(); g.arc(a, b, 4, 0, TAU); g.fill(); g.stroke(); }
  for (const wp of Wd.wps) { const [a, b] = M(wp.x, wp.y); g.fillStyle = wp.on ? '#9fe4ff' : '#c8c0b0'; g.strokeStyle = '#3a5a7a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a, b - 7); g.lineTo(a + 5, b); g.lineTo(a, b + 7); g.lineTo(a - 5, b); g.closePath(); g.fill(); g.stroke(); }
  // 할 일 목표
  const goals = []; const q = P.q; const bq = Wd.bridges[Wd.bq];
  if (q.q1 && q.q1.s === 1) { const i = bq.cells[bq.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
  if (q.q3 && q.q3.s === 1) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); }
  if (q.q3 && q.q3.s === 2 && !P.flags['wp_바람개비 언덕']) goals.push([Wd.wps[1].x, Wd.wps[1].y]);
  if (q.q5 && q.q5.s === 1) { const b2 = Wd.bridges[Wd.bq2], i = b2.cells[b2.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
  if (q.q7 && q.q7.s === 1) { const N2 = Wd.islands[Wd.nestI]; goals.push([N2.cx, N2.cy]); }
  if (q.q7 && q.q7.s === 2 && !P.flags['wp_둥지섬']) goals.push([Wd.wps[3].x, Wd.wps[3].y]);
  for (const id in q) if (q[id].s === 2 && !(id === 'q7' && !P.flags['wp_둥지섬']) && !(id === 'q3' && !P.flags['wp_바람개비 언덕'])) goals.push(Wd.npcAt[QUESTS[id].from]);
  for (const [gx, gy] of goals) { const [a, b] = M(gx, gy); g.strokeStyle = '#ff6a4a'; g.lineWidth = 2.5; g.beginPath(); g.arc(a, b, 9, 0, TAU); g.stroke(); g.fillStyle = '#ff6a4a'; g.font = '900 13px system-ui'; g.fillText('!', a, b - 12); }
  { const [a, b] = M(P.x, P.y); g.fillStyle = '#fff'; g.strokeStyle = '#3a5a7a'; g.lineWidth = 2.5; g.beginPath(); g.arc(a, b, 6, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#3a5a7a'; g.font = '800 11px system-ui'; g.fillText('나', a, b - 10); }
}
function finishQuest(id) {
  const P = G.P, q = P.q[id]; if (!q) return;
  if (id === 'q4') { if (!useGood('hone', 3)) return; addInv(goods('bhone')); }
  q.s = 3; const R = { q1: [150, 80], q2: [120, 50], q3: [500, 200], q4: [80, 30], q5: [700, 250], q6: [900, 300], q7: [2500, 800] }[id]; gainXp(R[0]); P.gold += R[1];
  if (id === 'q1') addInv(makeItem(CLS_START[P.cls][3], 1, 4, { id: 1, st: 0 }));
  if (id === 'q2') addInv(makeItem('ring1', 1, 4, { id: 1, st: 0 }));
  if (id === 'q3') addInv(makeItem('sail1', 2, 9, { id: 1, st: 1 }));
  if (id === 'q5') addInv(makeItem('boots1', 2, 12, { id: 1, st: 1 }));
  if (id === 'q6') addInv(makeItem('ear1', 2, 13, { id: 1, st: 1 }));
  if (id === 'q7') { addInv(makeItem('sail2', 2, 16, { id: 1, st: 1 })); addInv(goods('bhone')); addInv(goods('bglue')); }
  sfx('lvl'); save(); closePanel(); say('「' + QUESTS[id].n + '」 완료! 경험치 ' + R[0] + ', ' + R[1] + 'G', '#ffd166');
  if (id === 'q1') setTimeout(() => talk('chief'), 300);
  if (id === 'q3') setTimeout(() => openPanel('end'), 400);
  if (id === 'q5') setTimeout(() => talk('chief'), 300);
  if (id === 'q7') setTimeout(() => openPanel('end'), 400);
}
function talk(id, auto) { if (!G) return; if (auto && PANEL) return; openPanel('talk', id); }

/* ---------- 처음 화면 ---------- */
let TSEL = 'warden', STARTING = 0;
const HEADK = ['warden', 'drifter', 'windcaller', 'trapper', 'ringer'];
function portrait(cls, w) { const c = document.createElement('canvas'), d = 2; c.width = w * d; c.height = w * 1.07 * d; const g = c.getContext('2d'); if (IM[cls]) g.drawImage(IM[cls], 0, 2 * HC[1], HC[0], HC[1], 0, 0, c.width, c.height); else if (IM.heads) g.drawImage(IM.heads, HEADK.indexOf(cls) * HC[0], 0, HC[0], HC[1], 0, 0, c.width, c.height); return c; }
let PULLED = 0;
function title() {
  PANEL = 'title'; panel.hidden = false; ov.classList.remove('play');
  const sv = Object.fromEntries(Object.keys(CLASSES).map(k => [k, loadSave(k)])), s = sv[TSEL];
  panel.innerHTML = `<div class="sk-bx sk-title"><button class="sk-x" data-a="quit" aria-label="나가기">✕</button><div class="t">끊어진 하늘</div><div class="s">맛보기판 · 1장 민들레 섬</div><p style="font-size:13px;line-height:1.7;color:#5a4a36;margin:4px 0">${STORY_INTRO.map(esc).join('<br>')}</p><div class="sk-cls">${Object.keys(CLASSES).map(k => `<div class="sk-cl${TSEL === k ? ' on' : ''}" data-a="pick" data-cls="${k}"><span data-po="${k}"></span><b>${CLASSES[k].name}</b><small style="color:#3a7fa8;margin-top:2px">${sv[k] ? sv[k].lv + '레벨' : '새 이음꾼'}</small></div>`).join('')}</div><div class="sk-cdesc"><b>${CLASSES[TSEL].name}</b> · ${esc(CLASSES[TSEL].desc)}</div>
    ${s ? `<button class="sk-b p" data-a="start" data-n="0">이어하기 (${s.lv}레벨)</button><button class="sk-b" data-a="start" data-n="1">처음부터 (기록 지움)</button>` : `<button class="sk-b p" data-a="start" data-n="1">이 직업으로 시작</button>`}
    <p style="font-size:11px;color:#8a7458;margin:8px 0 0">${pcode() ? '기록은 이 기기와 5락실 프로필(복구 코드)에 저장돼요. 다른 기기에서도 같은 복구 코드로 이어 할 수 있어요.' : '기록은 이 기기에 저장돼요. 5락실 프로필을 만들면 다른 기기에서도 이어 할 수 있어요.'}${PULLED ? ' · 다른 기기 기록을 불러왔어요' : ''}</p></div>`;
  panel.querySelectorAll('[data-po]').forEach(el => el.replaceWith(portrait(el.dataset.po, 84))); bindPanel();
}
function startFrom(fresh) {
  if (fresh && loadSave(TSEL) && !panel.querySelector('[data-sure]')) { const b = panel.querySelector('[data-n="1"]'); b.dataset.sure = 1; b.textContent = '정말 지울까요? 한 번 더 누르면 지워져요'; return; }
  const S = fresh ? newSave(TSEL) : loadSave(TSEL); if (STARTING) return; STARTING = 1;
  const go = () => { STARTING = 0; PANEL = null; panel.hidden = true; panel.innerHTML = ''; ov.classList.add('play'); MINI = null; startGame(S); save(); last = performance.now(); };
  if (IM[S.cls]) return go(); panel.querySelectorAll('[data-a="start"]').forEach(b => { b.disabled = true; b.textContent = '불러오는 중…'; }); return loadHero(S.cls).then(go);
}

/* ---------- 반복 ---------- */
function loop(t) {
  raf = requestAnimationFrame(loop); const dt = Math.min(.1, (t - last) / 1000); last = t;
  if (G && !PANEL) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; } if (n === 6) acc = 0; }
  draw();
}
function fs() { const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return; const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return; try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(() => layout()).catch(() => {}); } catch (e) {} }
function open() { ov.hidden = false; document.documentElement.style.overflow = 'hidden'; layout(); audioInit(); if (TOUCH.on) fs(); G = null; Promise.all([assets(), cloudPull().then(n => { PULLED = n || 0; })]).then(() => { layout(); title(); }); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
function close() { save(); cloudFlush(); cancelAnimationFrame(raf); ov.hidden = true; document.documentElement.style.overflow = ''; panel.hidden = true; PANEL = null; if (A.ctx) A.ctx.suspend(); const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} } const P = G && G.P; G = null; opts.onExit && opts.onExit(P ? { lv: P.lv, cls: P.cls } : null); }
window.SkyGame = {
  boot(o) { opts = o || {}; if (!ov) mkDom(); assets();
    if (DEBUG) window.__sky = { open, G: () => G, start(cls, fresh) { TSEL = cls || 'warden'; return startFrom(fresh !== false); }, loadHero, skills() { return SKILLS[G.P.cls].map(s => s.id); }, step(n) { for (let i = 0; i < n; i++) update(STEP); }, draw, god(b) { G.god = b; }, tp(x2, y2) { G.P.x = x2; G.P.y = y2; G.cam = [x2, y2]; }, panel: openPanel, close: closePanel, give(id, r) { addInv(makeItem(id, r || 0, 5)); }, goods(g, n) { addInv(goods(g, n)); }, lv(n) { gainXp(xpNeed(G.P.lv) * n); }, keys: KEYS, press, talk, layout, hit: hitMob, dbg: { drawParts, drawFx, drawMob, drawDrop, drawHero, hud, view } };
    return { open }; },
};
})();
