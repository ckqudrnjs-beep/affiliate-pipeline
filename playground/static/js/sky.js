/* 끊어진 하늘 — 5락실 오리지널 쿼터뷰 파밍 RPG 맛보기판 (2026-11-14, 테스터 전용)
   1장 민들레 섬 앞부분 · 방패지기/바람술사 · 장비(부위 14칸·방어력·+강화·축복/저주·감정·길들이기·대장간).
   세계관·이름·시스템은 5락실 기획(plan/SKY_RPG.md) 오리지널. 캐릭터·소품 그림은 KayKit(CC0) 3D 모델을 다시 렌더링.
   이 파일은 src3d/sky/game/*.js 를 build.mjs 로 이어 붙인 결과물이다. 직접 고치지 말고 원본을 고친다. */
(function () {
'use strict';
const DEBUG = /skydebug/.test(location.hash);
const TAU = Math.PI * 2, STEP = 1 / 60;
// 바람개비 표지 저장 열쇠: 영어판에서도 한글 이름으로 저장(언어를 바꿔도 열린 표지가 그대로). I18N_KO 는 영어판 빌드가 앞에 붙인다.
const lvT = n => LANG === 'en' ? 'Lv ' + n : n + '레벨';
const LANG = typeof I18N_KO !== 'undefined' ? 'en' : 'ko', wpk = n => 'wp_' + (LANG === 'en' && I18N_KO[n] || n), tr = s => LANG === 'en' && typeof I18N_EN !== 'undefined' && I18N_EN[s] || s; // tr: 저장된 한글 이름(이름난 장비·오늘의 섬·심부름)을 영어판에서 보여 줄 때
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
  { n: '보통', c: '#ece6d6', k: [0, 0], d: '#5a4a36' }, { n: '손본', c: '#6ab4ff', k: [1, 2], d: '#2a6ac8' }, { n: '이름난', c: '#ffd23a', k: [3, 4], d: '#a87a00' }, { n: '전해진', c: '#ff8a3a', k: [0, 0], d: '#c8501a' }, { n: '한 벌', c: '#5ee07a', k: [0, 0], d: '#1a9a3a' },
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
    done: ['…들리나? 섬 밑에서 바람이 올라오는 소리. 민들레 섬이 가라앉기를 멈췄어!', '자네 덕일세, 이음꾼. 허나 큰바람이 멎은 까닭은 아직 저 너머, 녹슨 풍차 군도에 있다는 소문이야.', '바람개비 표지에 바람길이 열렸네. 준비되면 건너가 보게.'] },
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
function makeWorld(seed, ch) {
  ch = ch || 1;
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
  const town = blob(16, 42, 10.5, 'town'); let fi, hill, mi = [], nestI = -1, ci = [];
  const nm = (k, n, lv) => { islands[k].name = n; islands[k].lv = lv; return k; };
  if (ch === 2) { // 2장 녹슨 풍차 군도: 풍차 섬 4 → (끊어진 쇠사슬 다리) → 사슬 섬 2 → 큰 풍차섬(삐걱 파수꾼)
    nm(town, '쇠바퀴 마을');
    const F = [[36, 26, 8], [37, 58, 8.5], [56, 42, 9], [74, 24, 8]].map(([x, y, r]) => [x + R() * 2 - 1, y + R() * 2 - 1, r + R()]);
    fi = F.map(([x, y, r], i) => nm(blob(x, y, r, 'mill'), ['방앗간 들', '아랫 풍차밭', '가운데 풍차섬', '삐걱 언덕'][i], C2_LV[i]));
    ci = [[92, 50, 8.5], [110, 28, 8]].map(([x, y, r], i) => nm(blob(x, y, r, 'mill'), ['사슬 나루', '톱니 벌판'][i], C2_LV[4 + i]));
    hill = nm(blob(130, 52, 9.5, 'gear'), '큰 풍차섬', [24, 25]);
  } else if (ch === 3) { // 3장 닻 내린 항구: 선창 섬 4 → (끊어진 줄다리) → 나루 섬 2 → 녹슨 정박장(녹슨 비행선)
    nm(town, '닻돌 항구');
    const F = [[36, 26, 8], [38, 58, 8.5], [57, 42, 9], [76, 62, 8]].map(([x, y, r]) => [x + R() * 2 - 1, y + R() * 2 - 1, r + R()]);
    fi = F.map(([x, y, r], i) => nm(blob(x, y, r, 'dock'), ['소금 부두', '그물 말리는 터', '가운데 선창', '갈매기 바위'][i], C3_LV[i]));
    ci = [[93, 28, 8.5], [112, 50, 8]].map(([x, y, r], i) => nm(blob(x, y, r, 'dock'), ['밧줄 나루', '따개비 여울'][i], C3_LV[4 + i]));
    hill = nm(blob(132, 30, 9.5, 'wreck'), '녹슨 정박장', [32, 34]);
  } else if (ch >= 4) { // 4~7장: 같은 틀(들판 4 → 끊어진 다리 → 나루 2 → 보스 섬)
    const C = CHX[ch]; nm(town, C.town);
    fi = C.F.map(([x, y, r]) => [x + R() * 2 - 1, y + R() * 2 - 1, r + R()]).map(([x, y, r], i) => nm(blob(x, y, r, C.kind), C.isl[i], C.lv[i]));
    ci = C.C.map(([x, y, r], i) => nm(blob(x, y, r, C.kind), C.ci[i], C.lv[4 + i]));
    hill = nm(blob(C.H[0], C.H[1], C.H[2], C.hkind), C.hill, C.hlv);
  } else {
    nm(town, '민들레 마을');
    const F = [[34, 30, 8], [37, 54, 8.5], [53, 40, 9], [62, 22, 7.5], [66, 60, 7.5]].map(([x, y, r]) => [x + R() * 3 - 1.5, y + R() * 3 - 1.5, r + R() * 1.2]);
    fi = F.map(([x, y, r], i) => nm(blob(x, y, r, 'field'), ['동쪽 들판', '남쪽 들판', '가운데 들판', '윗 들판', '아랫 들판'][i], ISL_LV[i]));
    hill = nm(blob(86, 30, 8.5, 'hill'), '바람개비 언덕', [7, 9]);
    // 1장 뒷부분: 언덕 너머 갈대 늪 섬 3개 → 둥지섬(큰 왜가리)
    mi = [[105, 20, 7.5], [109, 47, 8.2], [126, 31, 8]].map(([x, y, r], i) => nm(blob(x, y, r, 'marsh'), ['갈대 늪 어귀', '갈대 나루', '안쪽 갈대 늪'][i], MARSH_LV[i]));
    nestI = nm(blob(143, 54, 9, 'heron'), '둥지섬', [13, 15]);
  }
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
  let bq, bq2 = -1;
  if (ch >= 2) { bridge(town, fi[0]); bridge(town, fi[1]); bridge(fi[0], fi[2]); bridge(fi[1], fi[2]); bridge(fi[2], fi[3]);
    bq = bridge(fi[2], ci[0], true); bridge(ci[0], ci[1]); bridge(ci[1], hill); }
  else { bridge(town, fi[0]); bridge(town, fi[1]); bridge(fi[0], fi[2]); bridge(fi[1], fi[2]); bridge(fi[2], fi[3]); bridge(fi[2], fi[4]);
    bq = bridge(fi[3], hill, true);
    bq2 = bridge(hill, mi[0], true); bridge(mi[0], mi[1]); bridge(mi[1], mi[2]); bridge(mi[2], nestI); }
  // 길(흙): 마을 광장, 다리 입구 쪽 흙길
  const tI = islands[town];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = id(x, y); if (g[i] !== 1) continue;
    const dT = Math.hypot(x - tI.cx, y - tI.cy); if (isl[i] === town && dT < 3.2) g[i] = 5;
    else if (nz2(x * .22, y * .22) > (islands[isl[i]] && islands[isl[i]].kind === 'marsh' ? .58 : .7) && isl[i] !== town) { let ok = 1; for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (!inb(xx, yy) || !g[id(xx, yy)]) ok = 0; if (ok) g[i] = 2; } }
  const bm = new Uint8Array(W * H); for (const b of bridges) { for (const i of b.cells) bm[i] = 1; for (const i of b.ends) bm[i] = 2; }
  const Wd = { ch, W, H, g, isl, depth, islands, bridges, bq, bq2, mi, nestI, ci, town, fi, hill, id, inb, nz, seed, bm, shape };
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
  add('well', T.cx + 0.2, T.cy - 0.2); Wd.wellAt = [T.cx + 1.5, T.cy - 1.5]; Wd.stashAt = [T.cx - 4.6, T.cy + 3.6];
  for (const [k, dx, dy] of [['barrel', 4, -3], ['crateB', 4.6, -2.2], ['sack', 3.6, 4.6], ['barrow', -4, 4.4], ['lumber', -4.4, -2.6], ['flag', 2.6, 2.4], ['crateS', 5.4, 1.3], ['bucket', 1.6, -1.6]]) add(k, T.cx + dx, T.cy + dy);
  Wd.npcAt = { chief: [T.cx - 1.6, T.cy + 1.8], smith: [T.cx + 3.6, T.cy - 3.6], merchant: [T.cx + 3.8, T.cy + 2.2], sage: [T.cx - 3.4, T.cy - 1.2] };
  Wd.wps = [{ n: '민들레 마을', x: T.cx + 1.6, y: T.cy + .2, on: 1 }];
  const Hh = Wd.islands[Wd.hill];
  if (Wd.ch === 3) { Wd.wps[0].n = '닻돌 항구'; const C0 = Wd.islands[Wd.ci[0]]; Wd.wps.push({ n: '밧줄 나루', x: C0.cx - 1.5, y: C0.cy + 2, on: 0 }, { n: '녹슨 정박장', x: Hh.cx - 3, y: Hh.cy + 3.5, on: 0 });
    add('ruin', Hh.cx + 4.5, Hh.cy - 3.5); add('lumber', Hh.cx - 5, Hh.cy - 2.5); add('crateB', Hh.cx + 4.5, Hh.cy + 2.5); add('barrel', Hh.cx - 4.5, Hh.cy + 3);
    for (const k of [Wd.town, ...Wd.fi, ...Wd.ci]) { const s = Wd.islands[k], n = k === Wd.town ? 3 : 4; for (let i = 0; i < n; i++) { const a = R() * TAU, d = s.r * (k === Wd.town ? .78 : .45 + R() * .3); add(['crateB', 'barrel', 'crateS', 'sack', 'lumber'][Math.floor(R() * 5)], s.cx + Math.cos(a) * d, s.cy + Math.sin(a) * d); } } }
  else if (Wd.ch >= 4) { const C = CHX[Wd.ch], C0 = Wd.islands[Wd.ci[0]]; Wd.wps[0].n = C.town; Wd.wps.push({ n: C.ci[0], x: C0.cx - 1.5, y: C0.cy + 2, on: 0 }, { n: C.hill, x: Hh.cx - 3, y: Hh.cy + 3.5, on: 0 });
    const PC = C.src || Wd.ch, HP = { 4: ['treesBL', 'treesL', 'stump', 'log'], 5: ['rock4', 'rock3', 'windmill', 'rock5'], 6: ['ruin', 'ruin', 'stone', 'rock4'], 7: ['rock2', 'flag', 'ruin', 'rock3'] }[PC];
    [[4.5, -3.5], [-5, -2.5], [4.5, 2.5], [-4.5, 3]].forEach(([ox, oy], i) => add(HP[i], Hh.cx + ox, Hh.cy + oy));
    const XP = { 4: ['treesBM', 'treesBS', 'stump', 'log'], 5: ['rock1', 'rock3', 'rock5', 'windmill'], 6: ['ruin', 'stone', 'rock4', 'crateO'], 7: ['rock2', 'flag', 'stone', 'rock1'] }[PC];
    for (const k of [...Wd.fi, ...Wd.ci]) { const s = Wd.islands[k]; for (let i = 0; i < 2; i++) { const a = R() * TAU, d = s.r * (.45 + R() * .25); add(XP[Math.floor(R() * XP.length)], s.cx + Math.cos(a) * d, s.cy + Math.sin(a) * d); } } }
  else if (Wd.ch === 2) { Wd.wps[0].n = '쇠바퀴 마을'; const C0 = Wd.islands[Wd.ci[0]]; Wd.wps.push({ n: '사슬 나루', x: C0.cx - 1.5, y: C0.cy + 2, on: 0 }, { n: '큰 풍차섬', x: Hh.cx - 3, y: Hh.cy + 3.5, on: 0 });
    add('windmill', Hh.cx + 4, Hh.cy - 4); add('windmill', Hh.cx - 5, Hh.cy - 2.5); add('ruin', Hh.cx + 4.5, Hh.cy + 2.5); add('crateB', Hh.cx - 4.5, Hh.cy + 3);
    for (const k of [...Wd.fi, ...Wd.ci]) { const s = Wd.islands[k]; for (let i = 0; i < 2; i++) { const a = R() * TAU, d = s.r * (.45 + R() * .25); add(i && R() < .5 ? 'ruin' : 'windmill', s.cx + Math.cos(a) * d, s.cy + Math.sin(a) * d); } } }
  else { Wd.wps.push({ n: '바람개비 언덕', x: Hh.cx - 1, y: Hh.cy + 1.5, on: 0 });
    const M1 = Wd.islands[Wd.mi[1]], NI = Wd.islands[Wd.nestI]; Wd.wps.push({ n: '갈대 나루', x: M1.cx - 1.5, y: M1.cy + 2, on: 0 }, { n: '둥지섬', x: NI.cx - 3, y: NI.cy + 3.5, on: 0 });
    add('ruin', NI.cx + 3.5, NI.cy - 4); add('rock4', NI.cx - 4.5, NI.cy - 3); add('lumber', NI.cx + 4.5, NI.cy + 2.5);
    add('windmill', Hh.cx + 1.5, Hh.cy - 2.5); add('ruin', Hh.cx - 4, Hh.cy - 2.5); add('rock3', Hh.cx + 4, Hh.cy + 2); }
  // 들판·언덕: 나무 무리·바위·통나무 더미
  const TREES = ['treesL', 'treesM', 'treesBL', 'treesBM', 'treesS', 'treesBS', 'tree1', 'tree2'], ROCK = ['rock1', 'rock2', 'rock3', 'rock4', 'rock5'];
  for (const s of Wd.islands) {
    if (s.kind === 'rock') { if (s.r > 2.2) add(ROCK[Math.floor(R() * 5)], s.cx, s.cy, true); continue; }
    if (s.kind === 'town') { for (let i = 0; i < 6; i++) { const a = R() * TAU, d = s.r * (.72 + R() * .2), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d, k = TREES[4 + Math.floor(R() * 4)], f = PM[k][6]; if (free(x, y, f)) add(k, x, y); } continue; }
    const n = s.kind === 'hill' ? 5 : s.kind === 'marsh' ? 5 : s.kind === 'heron' ? 3 : s.kind === 'gear' || s.kind === 'wreck' ? 2 : s.kind === 'mill' ? 6 : s.kind === 'dock' ? 4 : s.kind === 'grove' ? 12 : s.kind === 'grove2' ? 6 : s.kind === 'storm' || s.kind === 'gale' ? 5 : s.kind === 'ruin' ? 6 : s.kind === 'storm2' || s.kind === 'ruin2' || s.kind === 'gale2' ? 2 : 9;
    for (let i = 0; i < n * 3 && n > 0; i++) { const a = R() * TAU, d = s.r * (.35 + R() * .6), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d;
      const r = R(), k = r < (s.kind === 'dock' || s.kind === 'wreck' || s.kind === 'storm' || s.kind === 'ruin' ? .2 : s.kind === 'gale' ? .1 : s.kind === 'grove' ? .8 : .55) ? TREES[Math.floor(R() * TREES.length)] : r < .85 ? ROCK[Math.floor(R() * ROCK.length)] : ['lumber', 'stone', 'crateO', 'barrel'][Math.floor(R() * 4)]; const f = PM[k][6];
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
  let ok = BASES.filter(b => b.lv <= ilv + 1 && (!b.cls || b.cls === cls || Math.random() < .35)); const hi = ok.filter(b => b.lv >= ilv - 9); if (hi.length >= 8) ok = hi;
  const b = pick(ok); const r = Math.random() / (1 + find / 100);
  const rar = r < .045 ? 2 : r < .3 ? 1 : 0;
  if (Math.random() < .02 * (1 + find / 100) && ilv >= 3) { const sk = SET_TIERS.filter(t => ilv >= t[0]).map(t => t[1]).pop() || (ilv >= 26 && SETS.harbor ? 'harbor' : ilv >= 14 && SETS.mill ? 'mill' : 'dandelion'), sp = pick(SETS[sk].parts); return makeItem(sp[0], 4, Math.max(3, ilv), { set: sk }); }
  return makeItem(b.id, rar, ilv);
}
function itemName(it) {
  if (it.g) return GOODS[it.g].n + (it.n > 1 ? ' ×' + it.n : '');
  const b = BASE[it.b]; let n;
  if (!it.id) return '감정 안 된 ' + b.n;
  if (it.u) n = UNIQ.find(u => u.id === it.u).n;
  else if (it.set) n = SETS[it.set].parts.find(p => p[0] === it.b)[1];
  else if (it.r === 2) n = LANG === 'en' ? it.nm.replace(/^(\S+) (.+)$/, (_, a, b2) => tr(a) + ' ' + tr(b2)) : it.nm;
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
function canWear(P, it) { const b = BASE[it.b]; if (it.g) return '장비가 아니에요'; if (b.cls && b.cls !== P.cls) return CLASSES[b.cls].name + ' 전용'; if (P.lv < b.lv) return lvT(b.lv) + '부터';
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
  if (it.st === 1) { it.st = 0; return { ok: 2, bl: 1, msg: '실패! 축복이 대신 사라졌어요(단계 유지)' }; }
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
function snap() { const P = G.P, S = {}; for (const k of ['v', 'ch', 'cls', 'seed', 'lv', 'xp', 'sp', 'pts', 'skp', 'sk', 'fork', 'fork2', 'slots', 'eq', 'inv', 'gold', 'q', 'flags', 'board', 'shd', 'kills', 'rested', 'play', 'codex', 'daily', 'errand', 'shopD', 'stash', 'diff', 'roam']) S[k] = P[k]; S.t = Date.now(); S.uid = UID; S.lang = LANG; return S; }
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
  const D = MOBDEF[t], E = elite ? ELITE[elite - 1] : null, m0 = E ? E[2] : {}, T = dT(); lv += T.lv; const m = { hp: (m0.hp || 1) * T.hp, dmg: (m0.dmg || 1) * T.dmg, spd: m0.spd || 1 };
  const hp = Math.round((D.hp[0] + D.hp[1] * lv) * (m.hp || 1) * (elite ? 1.3 : 1) * DIFF.hp);
  return { t, D, x, y, hx: x, hy: y, lv, hp, mhp: hp, dmg: [(D.dmg[0] + D.dmg[2] * lv) * (m.dmg || 1) * DIFF.dmg, (D.dmg[1] + D.dmg[2] * lv * 1.3) * (m.dmg || 1) * DIFF.dmg], spd: D.spd * (m.spd || 1) * DIFF.spd, r: D.r, dir: ri(0, 7), an: 'idle', at: Math.random(), cd: 1, st: 'idle', kx: 0, ky: 0, stun: 0, slow: 0, elite, E, kbimm: m.kbimm, wan: rnd(1, 4), fl: 0, fear: 0, taunt: 0, miss: 0, bleed: 0, id: Math.random() };
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
  let xp = (D.xp[0] + D.xp[1] * m.lv) * (m.elite ? 3 : 1) * P.xpm * dT().xp; if (m.lv < P.lv - 5) xp *= .3;
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
  else if (D.rustship) { put(makeItem('amu3', 3, 34, { u: 'u_anchor' })); const sp = pick(SETS.harbor.parts); put(makeItem(sp[0], 4, 34, { set: 'harbor' })); put(goods('bhone')); put(goods('bglue')); }
  else if (D.creaker) { put(makeItem('amu2', 3, 25, { u: 'u_millheart' })); const sp = pick(SETS.mill.parts); put(makeItem(sp[0], 4, 25, { set: 'mill' })); put(goods('bhone')); put(goods('bglue')); }
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
  for (const t of G.txt) t.t += dt; G.txt = G.txt.filter(t => t.t < 1);
  // 줍기
  for (const d of G.drops) { d.t += dt; if (P.dead || d.t < .35) continue; if (hyp(d.x - P.x, d.y - P.y) < .8) pickUp(d); else d.warn = 0; }
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
  if (m.D.ai === 'spit') return spitAI(m, dt, d, dx, dy, sp);
  if (m.D.ai === 'spin') return spinAI(m, dt, d, dx, dy, sp);
  const reach = m.r + P.r + .35;
  if (d > reach) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; separate(m); }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = m.D.atk * rnd(.9, 1.3) * DIFF.cd; mobAtkStart(m); if (m.D.ai === 'dive') m.back = .8; }
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
  const h = k && P.inv.find(x => !x.g && stackKey(x) === k);
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
  if (a.k !== 'mud') return ch2Area(a, dt); const P = G.P;
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
function isleName(k) { const D = G.P.daily; if (D && k === D.isle && D.ich && D.ich !== G.Wd.ch) return tr(D.iname) + '(' + D.ich + '장)'; const s = G.Wd.islands[k]; return s && s.name || '섬'; }
// 갈 수 있는 사냥 섬 중 내 레벨에 맞는 곳 몇 개에서 날마다 하나
function isleCands(P) { const Wd = G.Wd, L = (Wd.ch >= 3 ? [...Wd.fi, ...(P.flags['c' + Wd.ch + 'bridge'] ? Wd.ci : [])] : Wd.ch === 3 ? [...Wd.fi, ...(P.flags.c3bridge ? Wd.ci : [])] : Wd.ch === 2 ? [...Wd.fi, ...(P.flags.c2bridge ? Wd.ci : [])] : [...Wd.fi, ...(P.flags.bridge ? [Wd.hill] : []), ...(P.flags.bridge2 ? Wd.mi : [])]).map(k => [k, Wd.islands[k].lv[1]]);
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
  const mobs = CXM(G.Wd.ch) ? [CXM(G.Wd.ch).a, CXM(G.Wd.ch).b, CXM(G.Wd.ch).d] : G.Wd.ch === 3 ? ['saltfluff', 'barnpod', 'crab'] : G.Wd.ch === 2 ? ['rustfluff', 'boltpod', 'scarecrow'] : P.flags.bridge2 ? ['mudfluff', 'bogpod', 'heronling'] : ['fluff', 'seed', 'bird'];
  const pool = [['mob', pk(mobs), 15], ['kill', '', 40], ['elite', '', 3], ['fell', '', 6], ['nest', '', 2]];
  const tasks = [['isle', '', 1]]; while (tasks.length < 3) { const t = pool.splice(Math.floor(R() * pool.length), 1)[0]; tasks.push(t); }
  const isle = C[Math.floor(R() * C.length)]; P.daily = { d, isle, ich: G.Wd.ch, iname: G.Wd.islands[isle].name, isleN: 0, chest: 0, all: 0, tasks: tasks.map(([k, t, n]) => ({ k, t, n, c: 0, got: 0 })) };
}
function dailyCheck(quiet) { const P = G.P; if (P.lv < DAILY_LV) return; const d = dayKey(); if (P.daily && P.daily.d === d) return;
  const first = !P.daily; newDaily(P, d); G.today = P.daily.isle; G.chest = null; for (const pk of G.packs) if (pk.isl === G.today && !pk.boss && !pk.elite) pk.elite = ri(1, ELITE.length);
  if (!quiet) { G.cut = { s: first ? '마을 게시판에 하루 의뢰가 붙었어요' : '새 하루가 밝았어요', c: '#ffd166', t: 0 }; say('오늘의 섬은 「' + isleName(P.daily.isle) + '」이에요. 마을 게시판에서 하루 의뢰 3개를 확인해요.', '#ffd166'); } }
function dTask(k, t, n) { const D = G.P.daily; if (!D) return; for (const q of D.tasks) if (q.k === k && (!t || q.t === t) && q.c < q.n) { q.c = Math.min(q.n, q.c + (n || 1)); if (q.c >= q.n) { say('하루 의뢰 「' + DTASK[q.k](q.t, q.n)[0] + '」 끝! 마을 게시판에서 보상을 받아요.', '#ffd166'); sfx('lvl'); } } }
function dailyKill(m, fell) { const P = G.P, D = P.daily; if (!D || P.lv < DAILY_LV) return;
  dTask('kill'); dTask('mob', m.t); if (m.elite) dTask('elite'); if (fell) dTask('fell'); if (m.D.mini) dTask('nest');
  if (m.pk && G.today != null && m.pk.isl === G.today && !D.chest && !G.chest) { D.isleN = Math.min(ISLE_N, D.isleN + 1); if (D.isleN >= ISLE_N) { spawnChest(); G.cut = { s: '오늘의 섬 상자가 나타났어요!', c: '#ffd166', t: 0 }; sfx('lvl'); } } }
function spawnChest() { const s = G.Wd.islands[G.P.daily.isle]; let x = s.cx + .5, y = s.cy + .5; for (let i = 0; i < 30 && !walk(G.Wd, x, y); i++) { x = s.cx + rnd(-2.5, 2.5); y = s.cy + rnd(-2.5, 2.5); }
  G.chest = { x, y, t: 0 }; G.fx.push({ k: 'ring', x, y, r: 2, t: 0, life: .6, c: '#ffd166' }); }
function dailyStart() { const P = G.P, D = P.daily;
  if (D && D.d === dayKey() && (D.ich || 1) !== G.Wd.ch && !D.isleN && !D.chest && P.lv >= DAILY_LV) { const C = isleCands(P); D.isle = C[Math.floor(Math.random() * C.length)]; D.ich = G.Wd.ch; D.iname = G.Wd.islands[D.isle].name; }
  G.today = D && D.d === dayKey() && (D.ich || 1) === G.Wd.ch ? D.isle : null; dailyCheck(); if (P.daily && G.today != null && P.daily.isleN >= ISLE_N && !P.daily.chest) spawnChest(); if (P.daily && P.daily.isleN >= ISLE_N && !P.daily.chest) spawnChest(); }
function openChest() { const P = G.P, D = P.daily, C = G.chest; if (!C || !D) return; G.chest = null; D.chest = 1; dTask('isle');
  const lv = Math.max(P.lv, (G.Wd.islands[D.isle].lv || [8, 8])[1]), put = it => G.drops.push({ x: C.x + rnd(-.8, .8), y: C.y + rnd(-.8, .8), it, t: 0 });
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
  h += `${errandHtml()}<p class="m" style="font-size:11.5px">셋을 다 하면 덤으로 축복 숫돌을 줘요. 못 한 날도 손해는 없어요.${P.rested > 1 ? ' · 지금 순풍: 경험치 2배 ' + Math.round(P.rested) + ' 남음' : ''}</p>` + TOAST + '</div>'; return h; }
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
  if (id === 'q8') addInv(makeItem('amu2', 2, 17, { id: 1, st: 0 }));
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
    done: ['…바람이다! 묶여 있던 비행선들 돛이 부풀고 있어!', '고맙네, 이음꾼. 바람이 항구를 지나 더 높은 쪽으로 흘러가는구먼. 저 위 구름 너머에서 무언가가 바람을 기다리고 있는 것 같아.', '바람개비 표지의 바람길로 4장 거꾸로 숲에 갈 수 있다네.'] },
});
const C3NPC = { chief: '항구지기 닻줄', smith: '대장장이 소금쇠', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' };
function qAvail3(id) { const q = G.P.q; if (G.Wd.ch !== 3) return false; if (id === 'q13' || id === 'q15' || id === 'q16') return true; if (id === 'q14') return q.q13 && q.q13.s === 3; if (id === 'q17') return q.q14 && q.q14.s === 3; return false; }
function talk3(id, offer, finish) {
  const P = G.P, q = qid => P.q[qid], btns = []; let lines = null;
  if (id === 'chief') {
    if (!q('q13')) offer('q13'); else if (q('q13').s === 2) finish('q13'); else if (q('q13').s === 1) lines = ['소금 보풀이며 닻집게며 선창마다 들끓네. 스무 마리만 부탁하네.'];
    else if (!q('q14')) offer('q14'); else if (q('q14').s === 2) finish('q14'); else if (q('q14').s === 1) lines = ['밧줄 타래는 선창 둥지의 따개비 둥지지기가 품고 있다네. 네 타래 모아 가운데 선창 동쪽 끊긴 줄다리로 가게.'];
    else if (!q('q17')) offer('q17'); else if (q('q17').s === 2 && P.flags[wpk('녹슨 정박장')]) finish('q17'); else if (q('q17').s === 2) lines = ['비행선을 떨어뜨렸다고?! 정박장 바람개비 표지에 손을 얹어 주게. 바람이 항구로 돌아오게.'];
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
  if (q.q17 && q.q17.s === 2 && !P.flags[wpk('녹슨 정박장')]) goals.push([Wd.wps[2].x, Wd.wps[2].y]); }
function endHtml3() { const P = G.P; return `<div class="sk-bx sk-talk" style="text-align:center"><h3>3장 「닻 내린 항구」 끝</h3><p>녹슨 비행선이 정박장 위로 천천히 내려앉자, 막혀 있던 바람이 한꺼번에 항구로 쏟아져 들어왔다.</p><p>묶여 있던 비행선들의 돛이 부푼다. 바람은 이제 구름 너머 더 높은 곳으로 흘러간다.</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>바람개비 표지(이동)의 「바람길」에서 4장 거꾸로 숲으로 건너갈 수 있어요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }

/* ---------- 4-3 매일 오는 재미: 날마다 바뀌는 떠돌이 상인 · 비행선 심부름 · 대장간 분해 ---------- */
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// 떠돌이 상인: 같은 날(KST)에는 같은 물건, 자정에 바뀜. 산 물건은 그날 다시 안 나옴. 골드로만 사요.
function makeShop() {
  const P = G.P, d = dayKey(); if (!P.shopD || P.shopD.d !== d) P.shopD = { d, got: [] };
  const R = srand(hashS(d) ^ P.seed ^ (G.Wd.ch * 7919)), keep = Math.random; Math.random = R;
  const L = [goods('pot'), goods('wpot'), goods('pure'), goods('look')], lv = Math.max(2, P.lv);
  try {
    const roll = (l, f) => { let it; for (let k = 0; k < 6; k++) { it = rollDrop(l, f, P.cls); if (!it.u && !it.set) break; } delete it.u; delete it.set; return it; };
    for (let i = 0; i < 8; i++) { const it = roll(lv, 30); it.id = true; if (it.r > 1) it.r = 1; if (it.st === -1) it.st = 0; it.sk = 'n' + i; L.push(it); }
    // 오늘의 귀한 물건 1개(파란 테 이상, 감정된 채로) · 오늘의 재료 1개
    let sp = roll(lv + 2, 260); for (let k = 0; k < 30 && sp.r !== 2; k++) sp = roll(lv + 2, 260); sp.id = true; if (sp.st === -1) sp.st = 0; sp.sk = 'sp'; sp.today = 1; L.push(sp);
    const m = goods(R() < .5 ? 'bhone' : 'bglue'); m.pr = 300 + lv * 25; m.sk = 'mat'; m.today = 1; L.push(m);
  } finally { Math.random = keep; }
  return L.filter(it => !it.sk || !P.shopD.got.includes(it.sk)); }
function shopBought(it) { const P = G.P; if (it.sk && P.shopD) P.shopD.got.push(it.sk); }
function shopFresh() { return G.shop && G.shopDay === dayKey() ? G.shop : (G.shopDay = dayKey(), G.shop = makeShop()); }
// 비행선 심부름: 보내 두면 접속을 안 해도 시간이 흘러 재료를 가져와요. 하루 횟수 제한 없음.
const ERRAND_LV = 5;
const ERRANDS = [
  { k: 'near', n: '가까운 섬 장보기', m: 30, d: '차·사탕과 숫돌·아교 조금' },
  { k: 'mid', n: '이웃 군도 짐 나르기', m: 120, d: '골드, 숫돌·아교, 가끔 장비 하나' },
  { k: 'far', n: '먼 하늘 건너 물건 찾기', m: 480, d: '골드 듬뿍, 장비 하나, 축복 숫돌·아교 반반' },
];
const errandLeft = E => Math.max(0, E.t0 + E.m * 6e4 - Date.now());
function errandSend(i) { const P = G.P, E = ERRANDS[i]; if (!E || P.errand || P.lv < ERRAND_LV) return; P.errand = { k: E.k, n: E.n, m: E.m, t0: Date.now(), lv: P.lv }; sfx('gust'); say('비행선이 「' + E.n + '」 심부름을 떠났어요', '#9fe4ff'); save(); }
function errandClaim() { const P = G.P, E = P.errand; if (!E || errandLeft(E) > 0) return; const lv = E.lv, got = [];
  const add = it => { if (!addInv(it)) G.drops.push({ x: P.x + rnd(-.6, .6), y: P.y + rnd(-.6, .6), it, t: 0 }); got.push(it.g ? GOODS[it.g].n + (it.n > 1 ? ' ' + it.n : '') : itemName(it)); };
  const gold = Math.round(lv * (E.k === 'far' ? 160 : E.k === 'mid' ? 55 : 18)); P.gold += gold;
  if (E.k === 'near') { add(goods('pot', 2)); add(goods('wpot', 2)); add(goods(Math.random() < .5 ? 'hone' : 'glue')); }
  if (E.k === 'mid') { add(goods('hone', 2)); add(goods('glue', 2)); if (Math.random() < .5) add(rollDrop(lv, P.find + 80, P.cls)); }
  if (E.k === 'far') { add(goods('hone', 3)); add(goods('glue', 3)); add(goods(Math.random() < .5 ? 'bhone' : 'bglue')); add(rollDrop(lv + 1, P.find + 180, P.cls)); if (endDone(P) && Math.random() < .3) add(goods('chart')); if (P.lv >= BOARD_LV) giveShard({ c: pick(Object.keys(SHARD)), q: Math.random() < .3 ? 2 : 1 }); }
  P.errand = null; sfx('coin'); toast('비행선이 돌아왔어요! ' + gold + 'G · ' + got.join(', ')); save(); }
const fmtLeft = ms => { const m = Math.ceil(ms / 6e4); return m >= 60 ? Math.floor(m / 60) + '시간 ' + (m % 60 ? m % 60 + '분' : '') : m + '분'; };
function errandHtml() { const P = G.P, E = P.errand; let h = '<h4 style="margin:10px 0 4px">비행선 심부름</h4>';
  if (P.lv < ERRAND_LV) return h + `<p class="m" style="font-size:12px">${ERRAND_LV}레벨이 되면 마을 비행선을 심부름 보낼 수 있어요.</p>`;
  if (E) { const left = errandLeft(E); return h + `<div class="sk-row"><div class="f"><b>${tr(E.n)}</b><br><small>${left > 0 ? fmtLeft(left) + ' 뒤에 돌아와요 · 게임을 꺼 둬도 시간은 흘러요' : '돌아왔어요!'}</small></div><button class="sk-b ${left > 0 ? '' : 'g'}" data-a="errc" ${left > 0 ? 'disabled' : ''}>${left > 0 ? '다녀오는 중' : '짐 받기'}</button></div>`; }
  return h + ERRANDS.map((e, i) => `<div class="sk-row"><div class="f"><b>${e.n}</b> <small>${e.m >= 60 ? e.m / 60 + '시간' : e.m + '분'}</small><br><small>${e.d}</small></div><button class="sk-b p" data-a="errs" data-i="${i}">보내기</button></div>`).join('') + '<p class="m" style="font-size:11.5px">한 번에 하나씩 보낼 수 있어요. 횟수 제한은 없어요.</p>'; }
function errandTrack() { const E = G.P.errand; if (!E) return null; const left = errandLeft(E); return ['비행선 심부름', left > 0 ? tr(E.n) + ' · ' + fmtLeft(left) + ' 남음' : '돌아왔어요! 마을 게시판에서 짐 받기']; }
// 대장간 분해: 안 쓰는 장비를 숫돌·아교로 바꿔요(무기 → 숫돌, 나머지 → 아교)
function salvageOf(it) { const b = BASE[it.b]; if (!b || it.g) return null; const n = [1, 1, 2, 3, 3][it.r] + (b.lv >= 18 ? 1 : 0) + (it.en >= 4 ? 1 : 0); return [b.s === 'weapon' ? 'hone' : 'glue', n]; }
function salvage(i) { const P = G.P, it = P.inv[i], s = salvageOf(it); if (!s) return; P.inv.splice(i, 1); addInv(goods(s[0], s[1])); sfx('ench'); toast(itemName(it) + ' → ' + GOODS[s[0]].n + ' ' + s[1] + '개'); save(); }
// 마을 건물 쓰임: 내 집 = 창고(60칸) · 우물 = 마시면 생명·바람 가득 + 2분 동안 맑은 물(생명 천천히 회복)
const STASH_N = 60;
function stashMove(c) { const P = G.P; P.stash = P.stash || [];
  if (c[0] === 'i') { const it = P.inv[+c.slice(1)]; if (!it) return; { const k = stackKey(it), h = it.g ? P.stash.find(x2 => x2.g === it.g) : k && P.stash.find(x2 => !x2.g && stackKey(x2) === k); if (h) { h.n = (h.n || 1) + (it.n || 1); P.inv.splice(P.inv.indexOf(it), 1); sfx('pick'); return; } } if (P.stash.length >= STASH_N) { toast('창고가 가득 찼어요'); return; } P.inv.splice(P.inv.indexOf(it), 1); P.stash.push(it); sfx('pick'); }
  else if (c[0] === 's') { const it = P.stash[+c.slice(1)]; if (!it) return; if (!addInv(it)) { toast('가방이 꽉 차거나 너무 무거워요'); return; } P.stash.splice(P.stash.indexOf(it), 1); sfx('pick'); } }
function stashHtml(X) { const P = G.P, S = P.stash || [];
  return `<div class="sk-bx">${X}<h3>내 집 창고 <small style="font-size:12px;color:#8a7458">누르면 옮겨요 · 장마다 같은 창고</small></h3><div class="sk-two"><div><h4>가방 ${P.inv.length}칸 · 무게 ${bagWeight(P)}/${bagCap(P)}</h4><div class="sk-grid">${[...Array(Math.max(INV_N, P.inv.length))].map((_, i) => cell(P.inv[i], 'i' + i)).join('')}</div></div><div><h4>창고 ${S.length}/${STASH_N}</h4><div class="sk-grid">${[...Array(STASH_N)].map((_, i) => cell(S[i], 's' + i)).join('')}</div></div></div>${TOAST}</div>`; }
function drinkWell() { const P = G.P; P.hp = P.mhp; P.wind = P.mwind; P.buf.well = 120; G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .6, c: '#9fe4ff' }, { k: 'ring', x: P.x, y: P.y, r: 1.4, t: 0, life: .4, c: '#bfe8ff' }); sfx('lvl'); say('시원한 우물물! 생명·바람이 가득 차고, 2분 동안 생명이 천천히 차올라요', '#9fe4ff', 1); }
function townNear(P, Wd) { if (Wd.stashAt && hyp(P.x - Wd.stashAt[0], P.y - Wd.stashAt[1]) < 1.6) return { k: 'stash', label: '내 집 창고 열기' }; if (Wd.wellAt && hyp(P.x - Wd.wellAt[0], P.y - Wd.wellAt[1]) < 1.5) return { k: 'well', label: '우물물 마시기' }; return null; }

/* ---------- 4~7장: 같은 틀로 만드는 장들 (거꾸로 숲 · 번개 둥지 · 가라앉는 옛 도읍 · 첫바람 언덕) ---------- */
const CHX = {
  4: { n: '거꾸로 숲', town: '뿌리내림 마을', kind: 'grove', hkind: 'grove2', q0: 18,
    npc: { chief: '숲지기 겨우살이', smith: '대장장이 옹이', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' },
    isl: ['이끼 비탈', '거꾸로 덤불', '매달린 숲', '반딧불 골'], ci: ['넝쿨 나루', '뿌리 벼랑'], hill: '고목 밑동',
    F: [[34, 24, 8], [36, 60, 8.5], [56, 42, 9], [76, 22, 8]], C: [[94, 50, 8.5], [112, 28, 8]], H: [132, 50, 9.8],
    lv: [[34, 35], [35, 36], [36, 37], [37, 38], [39, 40], [40, 41]], hlv: [42, 43], blv: 44,
    m: { a: 'mossfluff', b: 'thornpod', c: 'mothbird', d: 'rootling', k: 'rootkeeper', boss: 'oldtree' },
    mn: { a: '이끼 보풀', b: '가시 꼬투리', c: '나방새', d: '뿌리 덩이', k: '뿌리 둥지지기', boss: '뒤집힌 고목' },
    md: { a: '거꾸로 자란 숲 밑에서 이끼가 뭉쳐 생긴 보풀이.', b: '가시 덩굴이 감긴 꼬투리. 냅다 들이받아요.', c: '빛나는 가루를 흘리며 날아드는 나방 닮은 새.', d: '뿌리째 뽑혀 걸어 다니는 흙덩이. 가까이 오면 팔을 휘둘러요(바닥 표시를 보고 피해요).', k: '뿌리로 둥지를 엮은 둥지지기. 질긴 덩굴을 품고 있어요.', boss: '섬 밑면에 거꾸로 매달려 자라던 고목. 바람이 멎자 뿌리를 하늘로 뻗고 땅으로 걸어 나왔어요.' },
    bg: ['vine', '질긴 덩굴', '덩굴 다리'], sg: ['sap', '굳은 수액'], gm: 2.0, tier: ['뿌리', '고목'], set: ['grove', '숲지기'], uq: ['u_oldheart', '고목의 나이테', '뒤집힌 고목의 가장 안쪽 나이테. 귀에 대면 천 년 동안 거꾸로 분 바람 소리가 난다.'],
    tint: ['rgba(30,70,40,.5)', 'rgba(170,255,140,.55)'], boss: { hp: 9000, dmg: [34, 50], spd: .9, pat: { line: 7, volley: 6, sweep: 6, summon: 18, blades: 0 }, rage: { blades: 6 }, col: '#9aff6a', sum: 'rootling' },
    q: ['숲 밑 밑것 20마리 쓰러뜨리기', '뿌리 둥지지기의 질긴 덩굴 4개로 반딧불 골 동쪽 덩굴 다리 잇기', '뿌리 덩이 12마리 쓰러뜨리기', '굳은 수액 5개 가져오기', '고목 밑동의 뒤집힌 고목을 쓰러뜨리고 바람개비 표지에 손 얹기'],
    qn: ['뿌리내림 마을의 부탁', '덩굴 다리', '걷는 뿌리', '수액 담금질', '고목 밑동의 뒤집힌 고목'],
    talk: [['항구에서 바람을 타고 왔다고? 여긴 섬 밑면에 매달려 자란 거꾸로 숲일세.', '바람이 멎자 숲이 제멋대로 자라서 밑것이 들끓어. 스무 마리만 치워 주게.'],
      ['반딧불 골 동쪽 덩굴 다리가 끊어졌네. 뿌리 둥지지기들이 질긴 덩굴을 품고 있어. 네 타래면 다시 엮을 수 있지.'],
      ['솔바람이야. 뿌리 덩이들 봤어? 원래 고목을 받치던 흙인데 바람이 멎자 걸어 다녀. 열두 마리만 쉬게 해 줘.'],
      ['난 옹이, 여기 대장장이야. 이 숲 수액은 굳으면 쇠보다 질기지. 다섯 덩이만 구해 줘. 소금 보풀 대신 이끼 보풀이랑 가시 꼬투리가 달고 다녀.'],
      ['고목 밑동에 뒤집힌 고목이 서 있네. 뿌리를 줄줄이 땅에서 솟구치게 하고, 씨앗을 우박처럼 떨군다더군.', '성이 나면 가시를 사방으로 쏜다니, 가시 사이 틈을 보게.']],
    done: [['숲길에 다시 사람이 다니네. 고맙네.'], ['덩굴 다리가 다시 엮였어! 저 너머 넝쿨 나루, 뿌리 벼랑, 그리고 고목 밑동이야.'], ['고마워. 흙이 다시 제자리를 찾아가.'], ['좋아, 이 정도면 한 해는 담금질하겠어. 수고비야.'], ['…숲이 숨을 쉰다! 거꾸로 매달린 나무들이 바람에 흔들려.', '그런데 바람 끝에서 우르릉 소리가 나네. 번개 둥지 쪽이야.']],
    end: ['4장 「거꾸로 숲」 끝', '뒤집힌 고목이 쓰러지자 하늘로 뻗었던 뿌리가 천천히 땅속으로 돌아갔다.', '숲 사이로 바람이 다시 분다. 바람은 먹구름이 낀 번개 둥지로 흘러간다.'] },
  5: { n: '번개 둥지', town: '피뢰침 마을', kind: 'storm', hkind: 'storm2', q0: 23,
    npc: { chief: '등대지기 우레', smith: '대장장이 벼락쇠', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' },
    isl: ['먹구름 턱', '천둥 바위', '번쩍 들', '비구름 골'], ci: ['피뢰침 나루', '벼락 맞은 등성이'], hill: '고래 둥지',
    F: [[36, 28, 8], [34, 58, 8.5], [58, 44, 9], [74, 64, 8]], C: [[92, 28, 8.5], [112, 52, 8]], H: [132, 30, 10],
    lv: [[43, 44], [44, 45], [45, 46], [46, 47], [48, 49], [49, 50]], hlv: [50, 51], blv: 52,
    m: { a: 'stormfluff', b: 'sparkpod', c: 'stormbird', d: 'stormling', k: 'stormkeeper', boss: 'whale' },
    mn: { a: '먹구름 보풀', b: '불꽃 꼬투리', c: '번개새', d: '번개 덩이', k: '번개 둥지지기', boss: '구름 고래' },
    md: { a: '먹구름이 뭉쳐 생긴 보풀이. 찌릿찌릿해요.', b: '번개를 머금은 꼬투리. 멀리서 냅다 들이받아요.', c: '먹구름 사이를 가르며 내리꽂는 새.', d: '번개 맞은 바위가 걸어 다니는 덩이. 가까이 오면 팔을 휘둘러요.', k: '번개 바위로 둥지를 튼 둥지지기. 번개 돌을 품고 있어요.', boss: '섬과 섬 사이를 헤엄치던 구름 고래. 바람이 멎자 번개를 삼키며 둥지를 지키고 있어요.' },
    bg: ['boltstone', '번개 돌', '번개 바위 다리'], sg: ['ozone', '번개 가루'], gm: 2.6, tier: ['먹구름', '번개'], set: ['storm', '등대지기'], uq: ['u_whalebell', '고래의 울림', '구름 고래가 마지막으로 낸 울음을 담은 작은 종. 흔들면 멀리서 천둥이 대답한다.'],
    tint: ['rgba(40,40,90,.55)', 'rgba(255,240,120,.6)'], boss: { hp: 13000, dmg: [44, 64], spd: .85, fly: 1, pat: { volley: 4.5, line: 7, summon: 15 }, rage: { cage: 8 }, col: '#fff27a', sum: 'stormbird' },
    q: ['번개 둥지 밑것 20마리 쓰러뜨리기', '번개 둥지지기의 번개 돌 4개로 번쩍 들 동쪽 바위 다리 잇기', '번개 덩이 12마리 쓰러뜨리기', '번개 가루 5개 가져오기', '고래 둥지의 구름 고래를 쓰러뜨리고 바람개비 표지에 손 얹기'],
    qn: ['피뢰침 마을의 부탁', '번개 바위 다리', '찌릿한 덩이', '번개 담금질', '고래 둥지의 구름 고래'],
    talk: [['숲을 지나왔다고? 여긴 번개 둥지, 먹구름이 걷히질 않는 곳이야.', '번개 맞은 밑것들이 들끓어. 스무 마리만 부탁해.'],
      ['번쩍 들 동쪽 바위 다리가 번개에 끊겼어. 번개 둥지지기들이 번개 돌을 품고 있지. 네 개면 다시 이을 수 있어.'],
      ['솔바람이야. 번개 덩이들은 원래 등대 돌이었대. 열두 마리만 쉬게 해 줘.'],
      ['난 벼락쇠. 번개 가루로 담금질하면 칼날이 빛을 머금지. 다섯 줌만 부탁해. 먹구름 보풀이랑 불꽃 꼬투리가 달고 다녀.'],
      ['고래 둥지 위에 구름 고래가 떠 있어. 번개를 여기저기 내리꽂고, 입으로 번개 줄기를 뿜지.', '성이 나면 네 둘레를 번개로 둘러싸. 그땐 한가운데에 서 있어야 해.']],
    done: [['등대 불빛이 다시 보이네. 고마워.'], ['바위 다리가 이어졌어! 저 너머 피뢰침 나루, 벼락 맞은 등성이, 그리고 고래 둥지야.'], ['고마워. 등대 돌들이 다시 잠들었어.'], ['좋아, 칼날이 빛을 머금겠는걸. 수고비야.'], ['…먹구름이 걷힌다! 고래가 다시 바람을 타고 헤엄쳐 가.', '바람이 흘러가는 쪽은… 구름에 잠긴 옛 도읍이야.']],
    end: ['5장 「번개 둥지」 끝', '구름 고래가 번개를 다 뱉어 내자 먹구름이 걷히고, 고래는 바람을 타고 멀리 헤엄쳐 갔다.', '바람은 이제 구름에 반쯤 잠긴 옛 도읍으로 흘러간다.'] },
  6: { n: '가라앉는 옛 도읍', town: '종탑 마을', kind: 'ruin', hkind: 'ruin2', q0: 28,
    npc: { chief: '종지기 늙은 돌쇠', smith: '대장장이 주춧돌', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' },
    isl: ['무너진 장터', '잠긴 골목', '옛 궁 뜰', '부서진 성벽'], ci: ['돌다리 나루', '빈 성문 앞'], hill: '빈 성',
    F: [[34, 30, 8], [38, 56, 8.5], [56, 40, 9], [74, 22, 8]], C: [[94, 48, 8.5], [112, 26, 8]], H: [132, 48, 10],
    lv: [[51, 52], [52, 53], [53, 54], [54, 55], [55, 56], [56, 57]], hlv: [57, 58], blv: 59,
    m: { a: 'dustfluff', b: 'stonepod', c: 'ashbird', d: 'stoneguard', k: 'stonekeeper', boss: 'gatekeeper' },
    mn: { a: '먼지 보풀', b: '돌 꼬투리', c: '잿빛새', d: '돌 병정', k: '돌 둥지지기', boss: '돌 문지기' },
    md: { a: '옛 도읍의 먼지가 뭉친 보풀이.', b: '돌처럼 단단한 꼬투리. 냅다 들이받아요.', c: '무너진 지붕에 사는 잿빛 새.', d: '빈 성을 지키던 돌 병정. 가까이 오면 주먹을 휘둘러요.', k: '무너진 돌로 둥지를 튼 둥지지기. 다듬은 돌을 품고 있어요.', boss: '빈 성의 문을 지키는 거대한 돌 문지기. 아무도 들어오지 못하게 하라는 마지막 명령을 아직 지키고 있어요.' },
    bg: ['cutstone', '다듬은 돌', '무너진 돌다리'], sg: ['oldiron', '옛 쇳조각'], gm: 3.2, tier: ['옛 도읍', '돌성'], set: ['ruin', '성지기'], uq: ['u_gatekey', '빈 성의 열쇠', '돌 문지기의 가슴에 박혀 있던 열쇠. 어느 문에 꽂아도 맞지 않지만, 쥐면 등이 곧게 펴진다.'],
    tint: ['rgba(150,140,120,.55)', 'rgba(110,100,90,.55)'], boss: { hp: 18000, dmg: [56, 80], spd: .95, pat: { sweep: 5, line: 6, summon: 20, volley: 0 }, rage: { volley: 4, blades: 7 }, col: '#ffb03a', sum: 'stoneguard' },
    q: ['옛 도읍 밑것 20마리 쓰러뜨리기', '돌 둥지지기의 다듬은 돌 4개로 옛 궁 뜰 동쪽 돌다리 잇기', '돌 병정 12마리 쓰러뜨리기', '옛 쇳조각 5개 가져오기', '빈 성의 돌 문지기를 쓰러뜨리고 바람개비 표지에 손 얹기'],
    qn: ['종탑 마을의 부탁', '무너진 돌다리', '잠들지 못한 병정', '옛 쇠 녹이기', '빈 성의 돌 문지기'],
    talk: [['번개 둥지를 지나왔다고? 여긴 구름에 반쯤 잠긴 옛 도읍일세. 날마다 조금씩 가라앉고 있어.', '빈 골목마다 밑것이 들끓네. 스무 마리만 부탁하네.'],
      ['옛 궁 뜰 동쪽 돌다리가 무너졌네. 돌 둥지지기들이 다듬은 돌을 품고 있어. 네 개면 다시 놓을 수 있지.'],
      ['솔바람이야. 돌 병정들은 아직도 옛 임금의 명령을 지키고 있대. 열두 마리만 쉬게 해 줘.'],
      ['난 주춧돌. 옛 도읍의 쇠는 지금 쇠보다 좋아. 다섯 조각만 모아 줘. 먼지 보풀이랑 돌 꼬투리가 물고 다녀.'],
      ['빈 성 앞에 돌 문지기가 서 있네. 팔을 휘둘러 둘레를 쓸고, 땅을 줄줄이 갈라 놓지.', '성이 나면 돌덩이가 하늘에서 쏟아지고 돌 조각이 사방으로 튄다네.']],
    done: [['골목에 다시 등불이 켜지네. 고맙네.'], ['돌다리가 다시 놓였어! 저 너머 돌다리 나루, 빈 성문 앞, 그리고 빈 성이야.'], ['고마워. 병정들이 드디어 쉬어.'], ['좋은 쇠야. 수고비로 받아.'], ['…도읍이 멈췄어! 더는 가라앉지 않아.', '그런데 성 안 벽에 그림이 있었네. 첫바람 언덕 꼭대기에 선 사람… 첫 이음꾼이야.']],
    end: ['6장 「가라앉는 옛 도읍」 끝', '돌 문지기가 무너지자 빈 성이 가라앉기를 멈추었다.', '성 안 벽화에는 첫바람 언덕 꼭대기에 홀로 선 사람이 그려져 있었다. 옛날, 처음으로 섬과 섬을 이었다는 첫 이음꾼.'] },
  7: { n: '첫바람 언덕', town: '마지막 쉼터', kind: 'gale', hkind: 'gale2', q0: 33,
    npc: { chief: '쉼터지기 하늘', smith: '대장장이 바람쇠', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' },
    isl: ['바람 멎은 비탈', '하얀 풀밭', '고요한 등성이', '구름 바다 끝'], ci: ['하늘 나루', '마지막 오르막'], hill: '첫바람 언덕 꼭대기',
    F: [[36, 26, 8], [36, 58, 8.5], [56, 42, 9], [74, 62, 8]], C: [[94, 30, 8.5], [114, 50, 8]], H: [134, 32, 10.5],
    lv: [[58, 59], [59, 60], [60, 61], [61, 62], [62, 63], [63, 64]], hlv: [64, 65], blv: 66,
    m: { a: 'galefluff', b: 'galepod', c: 'galebird', d: 'galeling', k: 'galekeeper', boss: 'windlord' },
    mn: { a: '고요 보풀', b: '바람 꼬투리', c: '하늘새', d: '바람 덩이', k: '바람 둥지지기', boss: '첫 이음꾼 하늬' },
    md: { a: '바람이 멎은 언덕에 쌓인 흰 보풀이.', b: '갇힌 바람을 머금은 꼬투리. 냅다 들이받아요.', c: '마지막 바람을 쫓는 하늘새.', d: '굳어 버린 바람 덩이. 가까이 오면 팔을 휘둘러요.', k: '갇힌 바람으로 둥지를 튼 둥지지기. 바람 매듭을 품고 있어요.', boss: '옛날 처음으로 섬과 섬을 이었던 첫 이음꾼. 섬들이 서로 멀어질까 두려워 큰바람을 언덕 꼭대기에 가두었어요.' },
    bg: ['windknot', '바람 매듭', '바람 다리'], sg: ['skysilk', '하늘 실'], gm: 3.8, tier: ['첫바람', '하늘끝'], set: ['gale', '이음꾼'], uq: ['u_firstwind', '첫바람', '첫 이음꾼이 가두었던 바람 한 줌. 손을 펴면 처음 섬과 섬이 이어지던 날의 소리가 들린다.'],
    tint: ['rgba(225,235,250,.6)', 'rgba(255,255,255,.6)'], boss: { hp: 26000, dmg: [70, 100], spd: 1, fly: 1, pat: { line: 5, volley: 4, blades: 5, summon: 14 }, rage: { cage: 7 }, col: '#9fe4ff', sum: 'galebird', final: 1 },
    q: ['첫바람 언덕 밑것 20마리 쓰러뜨리기', '바람 둥지지기의 바람 매듭 4개로 고요한 등성이 동쪽 바람 다리 잇기', '바람 덩이 12마리 쓰러뜨리기', '하늘 실 5개 가져오기', '언덕 꼭대기의 첫 이음꾼을 막고 바람개비 표지에 손 얹기'],
    qn: ['마지막 쉼터의 부탁', '바람 다리', '굳은 바람', '하늘 실 꼬기', '첫바람 언덕 꼭대기'],
    talk: [['여기까지 왔구나, 이음꾼. 여긴 첫바람 언덕, 큰바람이 처음 불던 곳이야. 지금은 바람 한 점 없지.', '굳은 바람 밑것들이 길을 막고 있어. 스무 마리만 치워 줘.'],
      ['고요한 등성이 동쪽 바람 다리가 끊어졌어. 바람 둥지지기들이 바람 매듭을 품고 있지. 네 개면 다시 묶을 수 있어.'],
      ['솔바람이야. 여기까지 같이 왔네. 바람 덩이들은… 꼭대기에서 흘러내린 바람이 굳은 거래. 열두 마리만 풀어 줘.'],
      ['난 바람쇠. 하늘 실로 꼰 끈은 끊어지지 않아. 다섯 가닥만 모아 줘. 고요 보풀이랑 바람 꼬투리가 감고 다녀.'],
      ['꼭대기에 누군가 있어. 벽화 속 그 사람, 첫 이음꾼이야. 큰바람을 가둔 게… 그 사람이었어.', '섬들이 멀어질까 봐 바람을 가뒀대. 그런데 바람이 멎으니 섬들이 가라앉고 있어. 막아야 해.']],
    done: [['길이 열렸어. 고마워.'], ['바람 다리가 묶였어! 하늘 나루, 마지막 오르막… 그리고 꼭대기야.'], ['고마워. 굳은 바람이 다시 흘러가.'], ['좋아, 이걸로 끊어지지 않는 끈을 꼬아 둘게. 수고비야.'], ['…바람이다. 큰바람이 다시 분다!', '첫 이음꾼은 웃으며 바람 속으로 흩어졌어. "이제 네가 이어 줘."']],
    end: ['「끊어진 하늘」 끝', '첫 이음꾼이 가두었던 큰바람이 언덕 꼭대기에서 터져 나와 세상을 한 바퀴 돌았다. 가라앉던 섬들이 하나둘 떠오른다.', '끊어졌던 다리 끝마다 바람이 분다. 이제 섬과 섬을 잇는 건 당신이다.'] },
};
const MOBCOL = {}, SET_TIERS = [];
// 밑것 정의(3장 값을 장마다 키움)
for (const ch of [4, 5, 6, 7]) { const C = CHX[ch], f = 1 + .22 * (ch - 3), g = 1 + .18 * (ch - 3), M = C.m, N = C.mn, D = C.md;
  Object.assign(MOBDEF, {
    [M.a]: { n: N.a, hp: [14 * f, 7 * g], dmg: [4 * f, 6 * f, 1.1 * g], spd: 1.8, r: .3, sz: 0, xp: [9 * f, 4.5 * g], atk: 1, ai: 'melee', spr: M.a, desc: D.a },
    [M.b]: { n: N.b, hp: [24 * f, 9 * g], dmg: [5 * f, 8 * f, 1.5 * g], spd: 1.25, r: .32, sz: 1, xp: [13 * f, 5.5 * g], atk: 1.2, ai: 'charge', spr: M.b, desc: D.b },
    [M.c]: { n: N.c, hp: [12 * f, 5 * g], dmg: [4 * f, 6 * f, 1 * g], spd: 2.8, r: .28, sz: 0, xp: [10 * f, 4.5 * g], atk: .9, ai: 'dive', fly: 1, spr: M.c, desc: D.c },
    [M.d]: { n: N.d, hp: [42 * f, 14 * g], dmg: [6 * f, 10 * f, 1.6 * g], spd: 1.2, r: .42, sz: 1, xp: [19 * f, 7 * g], atk: 2.6, ai: 'spin', spr: M.d, desc: D.d },
    [M.k]: { n: N.k, hp: [140 * f, 32 * g], dmg: [8 * f, 13 * f, 1.7 * g], spd: 1.05, r: .55, sz: 1, xp: [95 * f, 32 * g], atk: 1.8, ai: 'boss', mini: 1, big: 1, spr: M.k, desc: D.k },
    [M.boss]: { n: N.boss, hp: [C.boss.hp, 0], dmg: [C.boss.dmg[0], C.boss.dmg[1], 0], spd: C.boss.spd, r: 1.15, sz: 1, xp: [C.boss.hp * .9, 0], atk: 2.2, ai: 'boss', boss: 1, big: 1, chboss: ch, fly: C.boss.fly, spr: M.boss, desc: D.boss } });
  GOODS[C.bg[0]] = { n: C.bg[1], ic: 'plank', d: N.k + '가 품은 ' + C.bg[1] + '. ' + C.bg[2] + '를 잇는 데 써요', quest: 1 };
  GOODS[C.sg[0]] = { n: C.sg[1], ic: 'hone', d: '대장장이가 담금질에 쓰는 ' + C.sg[1], quest: 1 };
  // 장비: 2장 장비 틀을 장마다 한 단계씩 올림
  const off = { 4: 24, 5: 34, 6: 42, 7: 48 }[ch], acm = { 4: 1.8, 5: 2.2, 6: 2.6, 7: 3 }[ch], fxm = { 4: 2.1, 5: 2.6, 6: 3.1, 7: 3.6 }[ch], last = s => s.split(' ').pop();
  const L = C2BASES.map(b => { const o = { ...b, id: 'c' + ch + b.id, n: (b.lv <= 14 ? C.tier[0] : C.tier[1]) + ' ' + last(b.n), lv: b.lv + off };
    if (b.dmg) o.dmg = b.dmg.map(v => Math.round(v * C.gm)); if (b.ac) o.ac = Math.round(b.ac * acm); if (b.blk) o.blk = b.blk + ch;
    if (b.fix) { o.fix = {}; for (const k in b.fix) o.fix[k] = Math.round(b.fix[k] * fxm); } if (b.req) { o.req = {}; for (const k in b.req) o.req[k] = b.req[k] + off; }
    if (b.sail) o.sail = [5.2 + (ch - 3) * .4, b.sail[1]]; return o; });
  BASES.push(...L); for (const b of L) BASE[b.id] = b;
  const sp = ['helm3', 'armor3', 'glove2', 'belt2'].map(id => ['c' + ch + id, C.set[1] + ' ' + last(BASE['c' + ch + id].n)]); for (const [id, n] of sp) BASE[id].n = n;
  const k2 = ch - 3; SETS[C.set[0]] = { n: C.set[1], parts: sp, bonus: [[2, [['ac', 10 + 4 * k2], ['hp', 70 + 30 * k2]]], [3, [['dmgp', 14 + 4 * k2], ['res', 14 + 3 * k2]]], [4, [['aspd', 10 + 2 * k2], ['lifek', 6 + 2 * k2], ['find', 30 + 5 * k2]]]] };
  SET_TIERS.push([BASE['c' + ch + 'helm3'].lv + 2, C.set[0]]);
  UNIQ.push({ id: C.uq[0], n: C.uq[1], base: 'c' + ch + 'amu2', story: C.uq[2], fx: [['dmgp', 26 + 6 * k2], ['hp', 80 + 40 * k2], ['ac', 14 + 6 * k2], ['res', 16 + 4 * k2]], lv: BASE['c' + ch + 'amu2'].lv + 2 });
  // 의뢰
  const ids = [0, 1, 2, 3, 4].map(i => 'q' + (C.q0 + i)); C.qid = ids; const from = ['chief', 'chief', 'sage', 'smith', 'chief'], need = [20, 4, 12, 5, 1];
  ids.forEach((id, i) => QUESTS[id] = { ch, n: C.qn[i], from: from[i], goal: C.q[i], need: need[i], talk: C.talk[i], done: C.done[i] });
  for (const k of ['a', 'b', 'c', 'd', 'k', 'boss']) MOBCOL[M[k]] = { 4: ['#5a8a3a', '#a8e070', '#4a3420'], 5: ['#4a4a7a', '#fff27a', '#c8d0ff'], 6: ['#a09a8a', '#6a6258', '#d8cfb8'], 7: ['#e8f0ff', '#9fe4ff', '#ffffff'] }[ch]; }
const CXM = ch => CHX[ch] && CHX[ch].m;
function qAvailX(id) { const q = G.P.q, ch = G.Wd.ch, C = CHX[ch]; if (!C || qCh(id) !== ch) return false; const I = C.qid, i = I.indexOf(id); if (i === 0 || i === 2 || i === 3) return true; if (i === 1) return q[I[0]] && q[I[0]].s === 3; if (i === 4) return q[I[1]] && q[I[1]].s === 3; return false; }
function talkX(id, offer, finish) {
  const P = G.P, ch = G.Wd.ch, C = CHX[ch], I = C.qid, q = qid => P.q[qid], btns = []; let lines = null; const wp = wpk(C.hill);
  if (ch === 8) { lines = { chief: ['떠도는 섬엔 의뢰가 없어. 저 끝 ' + C.hill + '의 우두머리만 쓰러뜨리면 보물이 쏟아지지.'], sage: ['섬들이 다시 떠오르면서 길 잃은 섬도 생겼대. 이런 섬엔 오래 머물지 마.'], smith: ['떠도는 섬에서도 망치는 들고 다니지.'], merchant: ['어디든 따라가는 게 내 장사야!'] }[id];
    if (id === 'smith') btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); if (id === 'merchant') btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); return { lines, btns }; }
  if (id === 'chief') {
    if (!q(I[0])) offer(I[0]); else if (q(I[0]).s === 2) finish(I[0]); else if (q(I[0]).s === 1) lines = ['밑것들이 아직 들끓네. 스무 마리만 부탁하네.'];
    else if (!q(I[1])) offer(I[1]); else if (q(I[1]).s === 2) finish(I[1]); else if (q(I[1]).s === 1) lines = [C.bg[1] + '는 ' + C.mn.k + '가 품고 있어. 네 개 모아 ' + C.isl[2] + ' 동쪽 끊긴 ' + C.bg[2] + '로 가게.'];
    else if (!q(I[4])) offer(I[4]); else if (q(I[4]).s === 2 && P.flags[wp]) finish(I[4]); else if (q(I[4]).s === 2) lines = [C.hill + ' 바람개비 표지에 손을 얹어 주게. 바람이 돌아오게.'];
    else if (q(I[4]).s === 1) lines = [C.hill + '은(는) ' + C.ci[0] + ' 너머 ' + C.ci[1] + ' 끝에 있어. 바닥 표시를 잘 보게.'];
    else lines = ch === 7 ? ['큰바람이 다시 분다. 이제 섬과 섬을 잇는 건 자네야, 이음꾼.'] : ['바람이 돌아왔네. 자네 덕일세.', '다음 장으로 가는 바람길이 열렸어. 바람개비 표지에서 건너가 보게.']; }
  if (id === 'sage') { if (!q(I[2])) offer(I[2]); else if (q(I[2]).s === 2) finish(I[2]); else lines = ch === 7 && P.flags[C.m.boss] ? ['첫 이음꾼도 처음엔 너처럼 다리를 고치며 다녔대. 이 이야기는 내가 오래오래 전할게.'] : ['바람은 원래 세상을 한 바퀴 돌며 섬마다 숨을 불어넣었대.', '감정 안 된 물건이 있으면 보여 줘. 하나에 15G야.'];
    const n = P.inv.filter(it => !it.g && !it.id).length; btns.push(`<button class="sk-b" data-a="ident" ${n && P.gold >= 15 ? '' : 'disabled'}>감정하기 (${n}개 · 개당 15G)</button>`); }
  if (id === 'smith') { if (!q(I[3])) offer(I[3]); else if (q(I[3]).s === 1 && count(C.sg[0]) >= 5) { lines = [C.sg[1] + ' 다섯 개 다 모았구나!']; btns.push(`<button class="sk-b g" data-a="finish" data-q="${I[3]}">건네기</button>`); } else if (q(I[3]).s === 1) lines = [C.sg[1] + '는 ' + C.mn.a + '랑 ' + C.mn.b + '가 달고 다녀. 다섯 개야.']; else lines = ['강화든 옵션 다시 굴리기든 분해든 맡겨.']; btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); }
  if (id === 'merchant') { lines = ['또 만났네! 바람길 따라 여기까지 왔지.']; btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); }
  return { lines, btns };
}
function finishX(id) { const P = G.P, ch = qCh(id), C = CHX[ch], i = C.qid.indexOf(id); if (i === 3 && !useGood(C.sg[0], 5)) return false;
  const m = Math.pow(1.3, ch - 4), R = [[5000, 1500], [6500, 2000], [6000, 1800], [3500, 1200], [11000, 5000]][i].map(v => Math.round(v * m)); P.q[id].s = 3; gainXp(R[0]); P.gold += R[1]; if (id === 'q37') skyRankEnd(P.diff || 0);
  const L = C.lv[3][1] + 2, c = 'c' + ch;
  if (i === 0) addInv(makeItem(c + 'amu2', 2, L, { id: 1, st: 0 })); if (i === 1) addInv(makeItem(c + 'boots2', 2, L + 1, { id: 1, st: 1 })); if (i === 2) addInv(makeItem(c + 'ring4', 2, L + 1, { id: 1, st: 0 }));
  if (i === 3) { addInv(goods('bhone')); addInv(goods('bglue')); } if (i === 4) { if (ch === 7) addInv(goods('chart', 2)); addInv(makeItem(c + 'sail4', 2, C.blv, { id: 1, st: 1 })); addInv(goods('bhone', 2)); addInv(goods('bglue', 2)); }
  return R; }
function trackX(id, q) { const ch = qCh(id), C = CHX[ch]; if (!C) return null; const i = C.qid.indexOf(id);
  return [C.n + ' 밑것 ' + q.n + '/20', C.bg[1] + ' ' + Math.min(4, count(C.bg[0])) + '/4 → ' + C.isl[2] + ' 동쪽 끊긴 다리', C.mn.d + ' ' + q.n + '/12', C.sg[1] + ' ' + Math.min(5, count(C.sg[0])) + '/5', C.hill + '의 ' + C.mn.boss][i]; }
function spawnChX() { const Wd = G.Wd, C = CHX[Wd.ch], M = C.m, L = [...Wd.fi, ...Wd.ci]; for (const k in M) lazyImg(M[k]);
  L.forEach((k, i) => { const s = Wd.islands[k], n = i >= 4 ? 5 : 4;
    for (let j = 0; j < n; j++) { const a = j / n * TAU + i * 1.1, d = s.r * .5; let x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d; if (!walk(Wd, x, y)) { x = s.cx; y = s.cy; }
      const kind = pick([[M.a], [M.a, M.b], [M.c], [M.d], [M.d, M.a], [M.b]]);
      const pk = j === 0 ? { isl: k, x, y, lv: s.lv, kinds: [M.a, M.b, M.a], n: 6, lead: M.k, nest: 1, elite: ri(1, ELITE.length) }
        : { isl: k, x, y, lv: s.lv, kinds: kind, n: kind[0] === M.c ? 3 : kind[0] === M.d ? ri(2, 3) : ri(3, 5), elite: Math.random() < .28 ? ri(1, ELITE.length) : 0 };
      G.packs.push(pk); spawnPack(pk); } });
  const H = Wd.islands[Wd.hill];
  if (Wd.ch === 8 ? !G.P.roam.boss : !G.P.flags[M.boss]) { const pk = { isl: Wd.hill, x: H.cx + 1, y: H.cy - 1, lv: [C.blv, C.blv], kinds: [M.boss], n: 1, boss: 1, nest: 1 }; G.packs.push(pk); spawnPack(pk); if (Wd.ch === 8) for (const m of pk.mobs) roamBossScale(m); }
  for (const [ox, oy, kinds] of [[-4, 3, [M.d, M.a]], [3.5, 3.5, [M.b, M.c]]]) { const pk = { isl: Wd.hill, x: H.cx + ox, y: H.cy + oy, lv: C.hlv, kinds, n: 3 }; G.packs.push(pk); spawnPack(pk); } }
function chXKill(m) { const P = G.P, ch = G.Wd.ch, C = CHX[ch]; if (!C) return; if (ch === 8) return roamKill(m); const M = C.m, I = C.qid;
  if ([M.a, M.b, M.c, M.d, M.k].includes(m.t)) qAdd(I[0], 1); if (m.t === M.d) qAdd(I[2], 1);
  if (m.t === M.k && P.q[I[1]] && P.q[I[1]].s === 1 && count(C.bg[0]) + G.drops.filter(d => d.it && d.it.g === C.bg[0]).length < 4) { G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods(C.bg[0]), t: 0 }); say(C.bg[1] + '을(를) 떨궜어요!', '#ffe08a', 1); }
  if ((m.t === M.a || m.t === M.b) && P.q[I[3]] && P.q[I[3]].s === 1 && count(C.sg[0]) + G.drops.filter(d => d.it && d.it.g === C.sg[0]).length < 5 && Math.random() < .2) G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods(C.sg[0]), t: 0 });
  if (m.D.chboss) { P.flags[M.boss] = 1; if (P.q[I[4]] && P.q[I[4]].s === 1) qSet(I[4], 2); G.shake = 14; G.flash = .4; say(C.mn.boss + '을(를) 쓰러뜨렸어요! ' + C.hill + ' 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); } }
function chXDrops(m, put) { const ch = m.D.chboss, C = CHX[ch]; put(makeItem('c' + ch + 'amu2', 3, C.blv, { u: C.uq[0] })); const sp = pick(SETS[C.set[0]].parts); put(makeItem(sp[0], 4, C.blv, { set: C.set[0] })); put(goods('bhone')); put(goods('bglue')); }
// 장 보스: 장마다 고른 공격 묶음(줄 솟구치기·여기저기 떨구기·둘레 쓸기·부르기·사방 칼날·둘러싸기)
function chXBossAI(m, dt, d, dx, dy) { const ch = m.D.chboss, C = CHX[ch], B = C.boss, P = G.P, rage = m.hp < m.mhp * .5, sp2 = rage ? 1.35 : 1;
  if (rage && !m.raged) { m.raged = 1; G.cut = { s: C.mn.boss + '이(가) 성이 났어요!', t: 0, c: B.col }; sfx('slam'); G.shake = 8; }
  const pat = Object.assign({}, B.pat, rage ? B.rage : {}), T = m.T || (m.T = {}); for (const k in pat) if (pat[k]) T[k] = (T[k] ?? pat[k] * .5) - dt * sp2;
  const go = k => pat[k] && T[k] <= 0 && (T[k] = pat[k] * rnd(.85, 1.15), 1);
  if (go('summon')) { const ng = G.mobs.filter(o => o.t === B.sum && !o.dead && hyp(o.x - m.x, o.y - m.y) < 9).length; if (ng < 5) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, x2 = m.x + Math.cos(a) * 2.2, y2 = m.y + Math.sin(a) * 2.2; if (walk(G.Wd, x2, y2)) { const n = mkMob(B.sum, x2, y2, C.hlv[1]); n.st = 'chase'; G.mobs.push(n); } }
    G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 2.4, t: 0, life: .5, c: B.col }); say(`${C.mn.boss}이(가) ${MOBDEF[B.sum].n}을(를) 불러냈어요!`, B.col, 1); }
  if (d < 10 && go('cage')) { m.an = 'atk'; m.at = 0; m.hitDone = 1; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; shipBlast(m, P.x + Math.cos(a) * 2.3, P.y + Math.sin(a) * 2.3, 1.05, 1.1, .8, B.col); } say('둘레가 막혀요! 한가운데에 서 있어요', B.col, 1); return; }
  if (go('blades')) { m.ang = (m.ang || 0) + .4; for (let i = 0; i < 8; i++) { const a = m.ang + i / 8 * TAU; G.areas.push({ k: 'blade', x: m.x, y: m.y, vx: Math.cos(a) * 4.4, vy: Math.sin(a) * 4.4, t: 0, life: 2.3, dmg: rnd(m.dmg[0], m.dmg[1]) * .5, src: m }); } sfx('gust'); }
  if (d < 9 && go('volley')) { m.an = 'atk'; m.at = 0; m.hitDone = 1; sfx('cone'); const n = rage ? 7 : 5; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = i === 0 ? 0 : rnd(1.2, 3); shipBlast(m, P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, .95, 1 + i * .08, .6, B.col); } return; }
  if (d > 1.5 && d < 9 && go('line')) { const ux = dx / d, uy = dy / d; m.an = 'atk'; m.at = 0; m.hitDone = 1; sfx('slam'); for (let i = 0; i < 7; i++) shipBlast(m, m.x + ux * (i * 1.4 + 1.2), m.y + uy * (i * 1.4 + 1.2), 1.05, .8 + i * .12, .75, B.col); return; }
  if (d < 3.4 && go('sweep')) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.kind = 'sweep'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 3.1, t: 0, life: .8 }); return; }
  const sp = m.spd * (rage ? 1.15 : 1);
  if (B.fly) { if (d > 4.5) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; } else if (d < 2.2 && m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = rage ? 2 : 2.8; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 2.4, t: 0, life: .8 }); } else { const s = (m.orb = (m.orb || 1)); move(m, -dy / d * sp * .6 * s * dt, dx / d * sp * .6 * s * dt); if (Math.random() < dt * .25) m.orb = -s; m.an = 'move'; } return; }
  if (d > m.r + 1) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = rage ? 1.9 : 2.6; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 2.4, t: 0, life: .8 }); }
  else m.an = 'idle'; }
function chXGoals(Wd, P, goals) { if (Wd.ch === 8) { if (!P.roam.boss) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); } return; } const C = CHX[Wd.ch], I = C.qid, q = P.q, bq = Wd.bridges[Wd.bq];
  if (q[I[1]] && q[I[1]].s === 1) { const i = bq.cells[bq.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
  if (q[I[4]] && q[I[4]].s === 1) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); }
  if (q[I[4]] && q[I[4]].s === 2 && !P.flags[wpk(C.hill)]) goals.push([Wd.wps[2].x, Wd.wps[2].y]); }
function endHtmlX() { const P = G.P, C = CHX[G.Wd.ch], last = G.Wd.ch === 7;
  return `<div class="sk-bx sk-talk" style="text-align:center"><h3>${C.end[0]}</h3><p>${C.end[1]}</p><p>${C.end[2]}</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>${last ? '끝까지 함께해 줘서 고마워요! 이제 바람개비 표지에서 난이도 「먹구름」과 떠도는 섬(항로 지도 2장을 드렸어요)을 열 수 있어요.' : '바람개비 표지(이동)의 「바람길」에서 ' + (G.Wd.ch + 1) + '장 ' + CHX[G.Wd.ch + 1].n + '(으)로 건너갈 수 있어요.'}</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }
// 바람길 줄: 앞 장 보스 의뢰를 끝내면 다음 장이 열림
CHAPS[4] = ['4장 · 거꾸로 숲', '바람길을 타고 건너가요 (34~44레벨)', P => P.q.q17 && P.q.q17.s === 3];
CHAPS[5] = ['5장 · 번개 둥지', '바람길을 타고 건너가요 (43~52레벨)', P => P.q.q22 && P.q.q22.s === 3];
CHAPS[6] = ['6장 · 가라앉는 옛 도읍', '바람길을 타고 건너가요 (51~59레벨)', P => P.q.q27 && P.q.q27.s === 3];
CHAPS[7] = ['7장 · 첫바람 언덕', '바람길을 타고 건너가요 (58~66레벨)', P => P.q.q32 && P.q.q32.s === 3];

/* ---------- 엔딩 뒤: 난이도 먹구름·폭풍 + 떠도는 섬(항로 지도로 여는 반복 사냥터) ---------- */
// 난이도: 7장 엔딩 뒤 먹구름, 먹구름에서 첫 이음꾼을 쓰러뜨리면 폭풍. 적이 세지는 만큼 경험치·골드·장비 레벨·좋은 물건 확률이 오른다.
const DIFFT = [
  { n: '보통', hp: 1, dmg: 1, lv: 0, xp: 1, gold: 1, ilv: 0, find: 0, c: '#ece6d6' },
  { n: '먹구름', hp: 2.4, dmg: 1.7, lv: 8, xp: 2, gold: 1.8, ilv: 8, find: 70, c: '#9fb4d8' },
  { n: '폭풍', hp: 5, dmg: 2.6, lv: 16, xp: 3.5, gold: 2.8, ilv: 16, find: 150, c: '#c9a8ff' },
  // 2026-11-15 BK: 6단계로 늘림. 각 난이도에서 엔딩(7장 보스)을 깨면 다음 단계가 열린다.
  { n: '천둥', hp: 9, dmg: 3.6, lv: 24, xp: 5, gold: 3.8, ilv: 24, find: 230, c: '#ffe27a' },
  { n: '회오리', hp: 15, dmg: 4.8, lv: 32, xp: 7, gold: 5, ilv: 32, find: 320, c: '#7ae0c8' },
  { n: '큰바람', hp: 24, dmg: 6.2, lv: 40, xp: 9.5, gold: 6.5, ilv: 40, find: 420, c: '#ff8a6a' } ];
const dT = () => DIFFT[(G && G.P && G.P.diff) || 0];
const endDone = P => P.q.q37 && P.q.q37.s === 3;
// 엔딩을 깬 가장 높은 난이도(-1 = 아직). 예전 저장(엔딩·stormok)도 그대로 인정
const dClr = P => Math.max(P.flags.dclr != null ? P.flags.dclr : -1, endDone(P) ? 0 : -1, P.flags.stormok ? 1 : -1);
const diffOk = (P, i) => i <= dClr(P) + 1 && i < DIFFT.length;
function setDiff(i) { const P = G.P; if (!diffOk(P, i) || (P.diff || 0) === i) return; P.diff = i; const ch = G.Wd.ch; goChapter(ch); G.cut = { s: '난이도 ' + DIFFT[i].n, c: DIFFT[i].c, t: 0 }; say('난이도가 「' + DIFFT[i].n + '」(으)로 바뀌었어요. 밑것들이 새로 깨어났어요.', DIFFT[i].c); }
GOODS.chart = { n: '항로 지도', ic: 'plank', d: '바람개비 표지에서 펼치면 떠도는 섬 하나로 가는 바람길이 열려요. 섬은 갈 때마다 달라요' };
// 떠도는 섬: 4~7장 중 한 곳의 땅·밑것을 빌려 오고, 내 레벨에 맞춰 세지는 섬. 의뢰는 없고 우두머리를 쓰러뜨리면 보물 상자.
function roamSetup(R) { const S = CHX[R.src], L = R.lv;
  CHX[8] = Object.assign({}, S, { src: R.src, n: '떠도는 섬', town: '떠도는 섬 나루터', roam: 1, qid: [], q0: 0,
    isl: S.isl.map(n => '떠도는 ' + n), ci: S.ci.map(n => '떠도는 ' + n), hill: '떠도는 ' + S.hill,
    lv: S.lv.map((_, i) => [L + (i >> 1), L + 1 + (i >> 1)]), hlv: [L + 3, L + 4], blv: L + 5 });
  CHAPS[8] = ['떠도는 섬 · ' + S.n, '', () => false]; }
function roamOpen() { const P = G.P; if (!endDone(P) || !useGood('chart', 1)) return; const src = 4 + Math.floor(Math.random() * 4);
  P.roam = { src, seed: (Math.random() * 1e9) | 0, lv: Math.max(P.lv, CHX[src].lv[0][0]), boss: 0, from: G.Wd.ch === 8 ? (P.roam && P.roam.from) || 7 : G.Wd.ch };
  roamSetup(P.roam); goChapter(8); say('항로 지도를 펼쳤어요. 「' + CHX[src].n + '」을(를) 닮은 떠도는 섬이에요.', '#9fe4ff'); }
function roamBossScale(m) { const R = G.P.roam, C = CHX[R.src]; if (!R || !m.D.chboss) return; const k = 1 + Math.max(0, CHX[8].blv - C.blv) * .06; m.hp = m.mhp = Math.round(m.mhp * k); m.dmg = m.dmg.map(v => v * (1 + Math.max(0, CHX[8].blv - C.blv) * .04)); m.lv = CHX[8].blv; }
function roamKill(m) { const P = G.P, R = P.roam; if (!R || !m.D.chboss || R.boss) return; R.boss = 1; const rb = P.flags.rb = (P.flags.rb || []).concat(); rb[P.diff || 0] = (rb[P.diff || 0] || 0) + 1; P.flags.rb = rb; G.shake = 14; G.flash = .4;
  const put = it => G.drops.push({ x: m.x + rnd(-1, 1), y: m.y + rnd(-1, 1), it, t: 0 }), T = dT(), lv = CHX[8].blv + T.ilv;
  for (let i = 0; i < 3 + (P.diff || 0); i++) put(rollDrop(lv, P.find + 200 + T.find, P.cls)); put(goods('bhone')); put(goods('bglue')); if (Math.random() < .6) put(goods('chart'));
  giveShard({ c: pick(Object.keys(SHARD)), q: 3 }); say('떠도는 섬의 ' + m.D.n + '을(를) 쓰러뜨렸어요! 보물이 쏟아졌어요. 바람개비 표지에서 돌아갈 수 있어요.', '#ffd166'); save(); }
function roamHtml() { const P = G.P; if (!endDone(P)) return ''; const n = count('chart'), cur = P.diff || 0;
  let h = '<h4 style="margin:10px 0 4px">난이도</h4><div class="sk-row" style="gap:4px;flex-wrap:wrap">' + DIFFT.map((d, i) => `<button class="sk-b${i === cur ? ' g' : ''}" data-a="diff" data-i="${i}" ${diffOk(P, i) ? '' : 'disabled'} style="width:calc(33% - 8px);margin:2px">${d.n}${diffOk(P, i) ? '' : ' 🔒'}</button>`).join('') + '</div>';
  h += `<p class="m" style="font-size:11.5px">${cur ? DIFFT[cur].n + ': 적 체력 ×' + DIFFT[cur].hp + ', 피해 ×' + DIFFT[cur].dmg + ' · 경험치 ×' + DIFFT[cur].xp + ', 장비 레벨 +' + DIFFT[cur].ilv : '먹구름·폭풍은 적이 세지는 대신 경험치와 장비가 좋아져요.'}${dClr(P) + 1 < DIFFT.length - 1 ? ' 다음 난이도는 지금 열린 가장 높은 난이도에서 엔딩(7장 보스)을 깨면 열려요.' : ''}</p>`;
  h += `<h4 style="margin:10px 0 4px">떠도는 섬</h4><div class="sk-row"><div class="f"><b>항로 지도 펼치기</b><br><small>가진 지도 ${n}장 · 둥지지기·장 보스·먼 심부름이 가끔 줘요</small></div><button class="sk-b g" data-a="roam" ${n ? '' : 'disabled'}>펼치기</button></div>`;
  if (G.Wd.ch === 8) { const f = (P.roam && P.roam.from) || 7; h += `<div class="sk-row"><div class="f"><b>${CHAPS[f][0]}(으)로 돌아가기</b></div><button class="sk-b p" data-a="chap" data-i="${f}">돌아가기</button></div>`; }
  return h; }
// 엔딩 뒤 항로 지도 얻는 곳: 둥지지기 8%, 장 보스 1장, 먼 심부름 30%
function roamDrops(m, put) { const P = G.P; if (!endDone(P) || G.Wd.ch === 8) return; if (m.D.chboss || m.D.mini && Math.random() < .08) put(goods('chart')); if (m.D.chboss === 7) { const d = P.diff || 0; if (d > dClr(P)) { P.flags.dclr = d; if (d === 1) P.flags.stormok = 1; if (DIFFT[d + 1]) { say(`난이도 「${DIFFT[d + 1].n}」이(가) 열렸어요!`, DIFFT[d + 1].c); } } skyRankEnd(d); } }
// 랭킹용 기록(2026-11-15 BK): 엔딩 난이도·시각, 보통 엔딩까지 걸린 플레이 시간. 순위는 서버가 저장 기록에서 뽑는다(skysave → sky_rank)
function skyRankEnd(d) { const P = G.P; if (d === 0 && P.flags.endT == null) P.flags.endT = Math.round(P.play || 0);
  if (P.flags.dmax == null || d > P.flags.dmax) { P.flags.dmax = d; P.flags.dmaxAt = Date.now(); } }


/* =================== 그리기 =================== */
let ov, cv, x, lay = { Z: 1, dpr: 1, cw: 800, ch: 450 }, IM = {}, NPCK = [];
const HC = [112, 120, 56, 100], HF = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'atk0', 'atk1', 'atk2', 'atk3', 'cast0', 'cast1', 'cast2', 'hurt', 'dodge', 'die0', 'die1'];
const MC = { saltfluff: [110, 110, 55, 96], barnpod: [96, 104, 48, 92], gull: [104, 132, 52, 120], crab: [150, 120, 75, 104], barnkeeper: [196, 212, 98, 192], rustship: [320, 400, 160, 372], rustfluff: [106, 106, 53, 92], boltpod: [96, 104, 48, 92], rustcrow: [104, 132, 52, 120], scarecrow: [156, 156, 78, 138], cogkeeper: [196, 212, 98, 192], creaker: [270, 300, 135, 270], mudfluff: [110, 110, 55, 96], bogpod: [96, 104, 48, 92], heronling: [104, 132, 52, 120], heron: [260, 300, 130, 282], fluff: [96, 96, 48, 84], fluffking: [240, 260, 120, 236], seed: [96, 104, 48, 92], bird: [104, 132, 52, 120], keeper: [196, 212, 98, 192] };
function loadImg(k, src) { return new Promise(ok => { const im = new Image(); im.onload = () => { IM[k] = im; LOADP.n++; ok(); }; im.onerror = () => { LOADP.n++; ok(); }; im.src = src; }); }
// 폰 로딩: 처음엔 꼭 필요한 그림만(약 1.4MB) 받고, 큰 보스 그림(둥지지기·우두머리)은 시작한 뒤 뒤에서 받는다
const LOADP = { n: 0, N: 10 }, LATE = ['keeper', 'fluffking', 'mudfluff', 'bogpod', 'heronling', 'heron', 'rustfluff', 'boltpod', 'rustcrow', 'scarecrow', 'cogkeeper', 'creaker', 'saltfluff', 'barnpod', 'gull', 'crab', 'barnkeeper', 'rustship'];
let assetsP = null;
function assets() {
  if (assetsP) return assetsP; const v = '?v=45e8a1fc';
  const J = p => p.then(() => { LOADP.n++; });
  assetsP = Promise.all([...['heads', 'fluff', 'seed', 'bird', 'npc', 'props', 'icons'].map(k => loadImg(k, IMG + k + '.webp' + v)),
    J(fetch(IMG + 'props.json' + v).then(r => r.json()).then(j => { PM = j; })), J(fetch(IMG + 'npc.json' + v).then(r => r.json()).then(j => { NPCK = j; })), J(fetch(IMG + 'icons.json' + v).then(r => r.json()).then(j => { ICM = j; }).catch(() => {}))])
    .then(() => { fetch(IMG + 'items.json' + v).then(r => r.json()).then(j => { ITM = j; const im = new Image(); im.onload = () => { IM.items = im; }; im.src = IMG + 'items.webp' + v; }).catch(() => {}); LATE.reduce((p, k) => p.then(() => loadImg(k, IMG + k + '.webp' + v)), Promise.resolve()); });
  return assetsP;
}
// 영웅 그림은 고른 직업 것만 받는다(직업 5개 → 처음 화면은 얼굴 한 장)
const HEROP = {};
function loadHero(cls) { return HEROP[cls] || (HEROP[cls] = IM[cls] ? Promise.resolve() : new Promise(ok => { const im = new Image(); im.onload = () => { IM[cls] = im; ok(); }; im.onerror = () => { delete HEROP[cls]; ok(); }; im.src = IMG + cls + '.webp?v=45e8a1fc'; })); }
let ICM = {}, ITM = {}; const DIRT = [];
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
  drawTownMarks();
  { const LB = []; // 이름표: 겹치면 위로 비켜 쌓기
    for (const d of G.drops) { if (!vis(d.x, d.y) || d.gold) continue; const [sx, sy] = iso(d.x, d.y), it = d.it, eq = !it.g, hi = eq && it.r >= 2; x.font = (hi ? '800 11px' : '600 10px') + ' system-ui'; const tag = eq && it.r >= 1 ? '[' + RAR[it.r].n + '] ' : '', s = tag + itemName(it), w = x.measureText(s).width + 10, hh = hi ? 16 : 14; LB.push({ sx, ty: sy - 24 - (hi ? 2 : 0), w, hh, s, it, eq, hi }); }
    LB.sort((a, b) => b.ty - a.ty); for (let i = 0; i < LB.length; i++) { const a = LB[i]; for (let k = 0; k < 8; k++) { let hit = 0; for (let j = 0; j < i; j++) { const o = LB[j]; if (Math.abs(o.sx - a.sx) < (o.w + a.w) / 2 + 2 && a.ty < o.ty + o.hh + 1 && a.ty + a.hh > o.ty - 1) { a.ty = o.ty - a.hh - 2; hit = 1; } } if (!hit) break; } }
    for (const a of LB) { x.font = (a.hi ? '800 11px' : '600 10px') + ' system-ui'; x.fillStyle = 'rgba(20,16,10,.8)'; rr(a.sx - a.w / 2, a.ty, a.w, a.hh, 4); x.fill(); if (a.eq && a.it.r >= 1) { x.strokeStyle = itemColor(a.it); x.lineWidth = a.hi ? 1.6 : 1; x.stroke(); } x.fillStyle = itemColor(a.it); x.fillText(a.s, a.sx, a.ty + a.hh - 3.5); } }
  for (const t of G.txt) { const [sx, sy] = iso(t.x, t.y), a = Math.min(1, (1 - t.t) * 2.2), sc = t.pop ? 1 + Math.max(0, .18 - t.t) * (t.big ? 6 : 3.5) : 1; x.globalAlpha = a; x.font = (t.big ? '900 19px ' : t.small ? '700 10px ' : '800 14px ') + 'system-ui'; x.lineWidth = t.big ? 4 : 3; x.strokeStyle = t.big ? 'rgba(90,30,0,.9)' : 'rgba(30,20,10,.8)';
    const yy = sy - 40 - t.z * 10 - (t.pop ? 18 * (1 - Math.pow(1 - Math.min(1, t.t * 2.5), 2)) : t.t * 26); x.save(); x.translate(sx, yy); x.scale(sc, sc); x.strokeText(t.s, 0, 0); x.fillStyle = t.c; x.fillText(t.s, 0, 0); x.restore(); x.globalAlpha = 1; }
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (G.gloom > .01) { const g = G.gloom, R = Math.hypot(cw, ch) / 2, vg = x.createRadialGradient(cw / 2, ch / 2, R * .25, cw / 2, ch / 2, R);
    vg.addColorStop(0, `rgba(30,12,40,${.2 * g})`); vg.addColorStop(.55, `rgba(24,8,34,${.45 * g})`); vg.addColorStop(1, `rgba(10,3,18,${.85 * g})`); x.fillStyle = `rgba(28,10,40,${.22 * g})`; x.fillRect(0, 0, cw, ch); x.fillStyle = vg; x.fillRect(0, 0, cw, ch); }
  drawHurtVignette(cw, ch);
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
  if (s.kind === 'dock' || s.kind === 'wreck' || s.kind === 'town' && Wd.ch === 3) { // 닻 내린 항구: 바랜 모래빛 + 소금 얼룩·널판
    x.fillStyle = s.kind === 'wreck' ? 'rgba(70,80,95,.42)' : 'rgba(205,195,150,.48)'; x.fill(g.top);
    for (const [xx, yy, t, own] of g.cells) { if (!own) continue; const h2 = hsh(xx + 5, yy + 1); if (h2 > .16) continue; const [sx, sy] = iso(xx, yy);
      if (h2 < .07) { x.fillStyle = 'rgba(110,80,50,.45)'; x.beginPath(); x.moveTo(sx - 20, sy + TH / 2); x.lineTo(sx, sy + TH / 2 - 10); x.lineTo(sx + 20, sy + TH / 2); x.lineTo(sx, sy + TH / 2 + 10); x.closePath(); x.fill(); }
      else { const r = 7 + hsh(xx, yy + 4) * 10; x.fillStyle = 'rgba(245,248,250,.5)'; x.beginPath(); x.ellipse(sx, sy + TH / 2, r, r * .5, 0, 0, TAU); x.fill(); } } }
  if (Wd.ch >= 4 && s.kind !== 'rock' && CHX[Wd.ch]) { const C = CHX[Wd.ch], boss = s.kind === C.hkind; // 4~7장 섬 빛깔 + 장마다 다른 얼룩(이끼·물웅덩이·돌판·흰 풀)
    x.fillStyle = C.tint[0]; if (boss) { x.globalAlpha = 1.3; } x.fill(g.top); x.globalAlpha = 1;
    for (const [xx, yy, t, own] of g.cells) { if (!own) continue; const h2 = hsh(xx + 7, yy + 3); if (h2 > ((C.src || Wd.ch) === 6 ? .14 : .08)) continue; const [sx, sy] = iso(xx, yy), r = 7 + hsh(xx, yy + 6) * 12;
      x.fillStyle = (C.src || Wd.ch) === 6 && h2 < .08 ? 'rgba(120,110,95,.5)' : C.tint[1].replace(/[\d.]+\)$/, '.28)');
      if ((C.src || Wd.ch) === 6 && h2 < .08) { x.beginPath(); x.moveTo(sx - 22, sy + TH / 2); x.lineTo(sx, sy + TH / 2 - 11); x.lineTo(sx + 22, sy + TH / 2); x.lineTo(sx, sy + TH / 2 + 11); x.closePath(); x.fill(); }
      else { x.beginPath(); x.ellipse(sx, sy + TH / 2, r, r * .5, 0, 0, TAU); x.fill(); } } }
  if (s.kind === 'mill' || s.kind === 'gear' || s.kind === 'town' && Wd.ch === 2) { // 녹슨 풍차 군도: 늦가을 들판 + 녹 얼룩
    x.fillStyle = s.kind === 'gear' ? 'rgba(120,70,40,.32)' : 'rgba(200,135,40,.3)'; x.fill(g.top);
    for (const [xx, yy, t, own] of g.cells) { if (!own || hsh(xx + 3, yy + 9) > .07) continue; const [sx, sy] = iso(xx, yy), r = 8 + hsh(xx, yy + 2) * 12; x.fillStyle = 'rgba(140,70,30,.28)'; x.beginPath(); x.ellipse(sx, sy + TH / 2, r, r * .5, 0, 0, TAU); x.fill(); } }
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
  const [sx, sy] = iso(P.x, P.y); shadow(sx, sy, 16);
  drawSkinUnder(P, sx, sy); // 5h-skin.js: 상점 꾸미기(겉모습만)
  if (P.buf.cloud) { x.fillStyle = 'rgba(240,248,255,.35)'; x.beginPath(); x.ellipse(sx, sy - 20, 22, 28, 0, 0, TAU); x.fill(); }
  drawClsHero(P, sx, sy);
  if (P.buf.hold) { x.strokeStyle = 'rgba(255,210,120,.7)'; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy, 18, 9, 0, 0, TAU); x.stroke(); }
  const a = P.dodge > 0 ? .75 : P.inv0 > 0 ? .6 + Math.sin(G.t * 30) * .3 : 1;
  const jz = P.jump > 0 ? Math.sin((1 - P.jump / .48) * Math.PI) * 46 : 0;
  sprite(IM[P.cls], HC[0], HC[1], HC[2], HC[3], heroFrame(P), P.dir, sx, sy - jz, HERO_SC, P.hurt > .15 ? .1 : 0, a);
  drawClsHero(P, sx, sy - jz, 1);
}
function drawMob(m) {
  if (!IM[m.D.spr]) { lazyImg(m.D.spr); const [sx, sy] = iso(m.x, m.y); shadow(sx, sy, m.D.boss ? 36 : 24); return; } // 큰 그림 받는 중
  const D = m.D, c = MC[D.spr], [sx, sy0] = iso(m.x, m.y), sy = sy0 + (m.fy || 0) * 30;
  const a = m.dead ? Math.max(0, 1 - Math.max(0, m.at - .5) * 1.6) * (m.fl ? Math.max(0, 1 - m.fy * .4) : 1) : 1;
  if (!m.fl) shadow(sx, sy0, D.boss ? 36 : D.mini ? 26 : D.fly ? 9 : m.elite ? 14 : 11);
  if (m.elite && !m.dead) { // 정예: 발밑에서 기운이 피어오름
    const pu = .5 + Math.sin(G.t * 5 + m.id * 9) * .5, ag = x.createRadialGradient(sx, sy0, 2, sx, sy0, 26); ag.addColorStop(0, m.E[1] + 'aa'); ag.addColorStop(1, m.E[1] + '00'); x.fillStyle = ag; x.beginPath(); x.ellipse(sx, sy0, 26, 13, 0, 0, TAU); x.fill();
    x.strokeStyle = m.E[1]; x.globalAlpha = .55 + pu * .4; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy0, 18 + pu * 3, 9 + pu * 1.5, 0, 0, TAU); x.stroke();
    for (let i = 0; i < 4; i++) { const k = (G.t * .8 + i / 4 + m.id) % 1, a = i * 1.7 + m.id * 5; x.globalAlpha = (1 - k) * .9; x.fillStyle = m.E[1]; x.beginPath(); x.arc(sx + Math.cos(a) * 12, sy0 - k * 44, 1.8, 0, TAU); x.fill(); } x.globalAlpha = 1; }
  const sc0 = .5 * (m.fl ? Math.max(.2, 1 - m.fy * .25) : 1) * (m.elite ? 1.22 : 1), q = m.sq > 0 ? m.sq / .2 : 0;
  const [mox, moy, msx, msy, mrot] = mobMotion(m); x.save(); x.translate(sx + mox, sy + moy); x.rotate(mrot); x.scale(msx, msy); x.translate(-sx, -sy);
  if (q) { x.save(); x.translate(sx, sy); x.scale(1 + q * .16, 1 - q * .14); x.translate(-sx, -sy); }
  if (m.elite && !m.dead) { x.shadowColor = m.E[1]; x.shadowBlur = 10; }
  sprite(IM[D.spr], c[0], c[1], c[2], c[3], mobFrame(m), m.dir, sx + (q ? rnd(-1.5, 1.5) : 0), sy, sc0, m.flash, a);
  x.shadowBlur = 0;
  if (q) x.restore();
  x.restore();
  if (!m.dead && (m.hp < m.mhp || m.elite) && !D.big) { const w = 26, f = m.hp / m.mhp, top = sy - c[3] * .5 * (m.elite ? 1.22 : 1) - 2; x.fillStyle = 'rgba(20,14,10,.7)'; x.fillRect(sx - w / 2 - 1, top - 1, w + 2, 5); x.fillStyle = m.elite ? m.E[1] : '#e85a4a'; x.fillRect(sx - w / 2, top, w * f, 3);
    if (m.elite) { x.font = '700 9px system-ui'; x.textAlign = 'center'; x.fillStyle = m.E[1]; x.strokeStyle = 'rgba(20,14,10,.8)'; x.lineWidth = 2.5; const s = m.E[0] + ' ' + D.n; x.strokeText(s, sx, top - 4); x.fillText(s, sx, top - 4); } }
  if (m.stun > 0 && !m.dead) { x.fillStyle = '#ffe08a'; for (let i = 0; i < 3; i++) { const a2 = G.t * 5 + i * TAU / 3; x.beginPath(); x.arc(sx + Math.cos(a2) * 9, sy - c[3] * .42 + Math.sin(a2) * 3, 2, 0, TAU); x.fill(); } }
}
function drawDrop(d) {
  const [sx, sy] = iso(d.x, d.y), b = Math.max(0, .35 - d.t) * 60;
  if (d.gold) { x.fillStyle = '#ffd166'; x.strokeStyle = '#8a6a1a'; x.lineWidth = 1; for (let i = 0; i < Math.min(4, 1 + d.gold / 10); i++) { x.beginPath(); x.ellipse(sx - 4 + i * 3, sy - 3 - b - i * 1.5, 4, 2.4, 0, 0, TAU); x.fill(); x.stroke(); } return; }
  const it = d.it, col = itemColor(it); x.fillStyle = col; x.globalAlpha = .25 + Math.sin(G.t * 4) * .1; x.beginPath(); x.ellipse(sx, sy, 12, 6, 0, 0, TAU); x.fill(); x.globalAlpha = 1;
  if (!it.g && it.r >= 1) { const h = [0, 34, 70, 96, 96][it.r] + Math.sin(G.t * 3) * 6, gr = x.createLinearGradient(0, sy - h, 0, sy); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, col); x.globalAlpha = it.r === 1 ? .4 : .6; x.fillStyle = gr; x.fillRect(sx - 4, sy - h, 8, h); x.globalAlpha = .25; x.fillRect(sx - 9, sy - h * .7, 18, h * .7); x.globalAlpha = 1;
    if (it.r >= 2) { x.strokeStyle = col; x.lineWidth = 2; x.globalAlpha = .5 + Math.sin(G.t * 5) * .3; x.beginPath(); x.ellipse(sx, sy, 16 + Math.sin(G.t * 4) * 2, 8, 0, 0, TAU); x.stroke(); x.globalAlpha = 1; for (let i = 0; i < (it.r >= 3 ? 3 : 2); i++) { const a = G.t * 2 + i * 2.1, py = sy - ((G.t * 30 + i * 23) % h); x.fillStyle = col; x.globalAlpha = .8; x.beginPath(); x.arc(sx + Math.cos(a) * 7, py, 1.6, 0, TAU); x.fill(); } x.globalAlpha = 1; } }
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
// 물건마다 따로 그린 그림(items.webp: 장비 종류·고유 장비·새 재료) → 없으면 예전 공용 그림
function itemPic(it) { if (!IM.items) return null; return ITM[it.g ? 'g_' + it.g : it.u && it.id && ITM['u_' + it.u] ? 'u_' + it.u : it.b] || null; }
function drawIcon(it, X, Y, s, g) { g = g || x; const k = it.g ? GOODS[it.g].ic : BASE[it.b].ic, m = ICM[k], pic = itemPic(it);
  if (!pic && (!m || !IM.icons)) { g.fillStyle = itemColor(it); g.beginPath(); g.arc(X + s / 2, Y + s / 2, s * .32, 0, TAU); g.fill(); return; }
  const live = g === x && G, cx = X + s / 2, cy = Y + s / 2;
  if (!it.g) { // 뒤쪽 빛: 축복 금빛, 저주 보랏빛, 강화 +4 하늘빛 / +7 금빛, 이름난 이상 등급 빛
    const glow = it.st === -1 && it.id ? '#8a4ac8' : it.st === 1 ? '#ffe08a' : it.en >= 7 ? '#ffd166' : it.en >= 4 ? '#9fe4ff' : it.r >= 2 ? RAR[it.r].c : null;
    if (glow) { const p = live ? .75 + Math.sin(G.t * 4) * .25 : 1, gr = g.createRadialGradient(cx, cy, s * .1, cx, cy, s * .55); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = .55 * p; g.fillStyle = gr; g.fillRect(X - s * .05, Y - s * .05, s * 1.1, s * 1.1); g.globalAlpha = 1; } }
  const ma = mainAfx(it), v = ma && AFXV[ma], tc = v ? tinted(k, v[0], it.u ? .45 : it.r >= 2 ? .38 : .28) : null;
  if (pic) g.drawImage(IM.items, pic[0], pic[1], pic[2], pic[3], X, Y, s, s); else if (tc) g.drawImage(tc, X, Y, s, s); else g.drawImage(IM.icons, m[0], m[1], m[2], m[3], X, Y, s, s);
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
    const a1 = a0 - 1.1 * sw + 2.2 * sw * Math.min(1, k * 2.4); x.globalAlpha = 1 - k; const gr = x.createLinearGradient(-R, 0, R, 0); x.strokeStyle = f.c || 'rgba(255,248,225,.95)'; x.lineCap = 'round'; if (f.c) { x.shadowColor = f.c; x.shadowBlur = 8; }
    for (let i = 0; i < 6; i++) { x.lineWidth = (7 - i) * (f.heavy ? 1.6 : 1) * (1 - k) + .5; x.globalAlpha = (1 - k) * (1 - i * .14); x.beginPath(); x.arc(0, 0, R * (.82 + i * .03), a1 - .12 * sw * (i + 1), a1 - .12 * sw * i, sw < 0); x.stroke(); }
    x.shadowBlur = 0; if (f.c) { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 1.6 * (1 - k); x.globalAlpha = 1 - k; x.beginPath(); x.arc(0, 0, R * .86, a1 - .5 * sw, a1, sw < 0); x.stroke(); }
    x.restore(); x.globalAlpha = 1; }
  else if (drawJuiceFx(f, k, sx, sy)) return;
  else if (drawEnemyFx(f, k, sx, sy)) return;
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
function questMark(k) { const P = G.P; for (const id in QUESTS) { const Q = QUESTS[id]; if (Q.from !== k || qCh(id) !== G.Wd.ch) continue; const q = P.q[id]; if (q && q.s === 2) return '?'; if (!q && qAvail(id)) return '!'; } return ''; }
function qAvail(id) { const q = G.P.q; if (qCh(id) === 2) return qAvail2(id); if (qCh(id) === 3) return qAvail3(id); if (qCh(id) >= 4) return qAvailX(id); if (G.Wd.ch !== 1) return false; if (id === 'q1') return true; if (id === 'q2') return true; if (id === 'q4') return true; if (id === 'q3') return q.q1 && q.q1.s === 3; if (id === 'q5') return q.q3 && q.q3.s === 3; if (id === 'q6') return !!G.P.flags.bridge2 && q.q2 && q.q2.s === 3; if (id === 'q7') return q.q5 && q.q5.s === 3; return false; }

/* ---------- 화면 위 정보(HUD) ---------- */
let BTN = [];
function hud() {
  if (G.noHud) return;
  const { cw, ch } = lay, P = G.P, touch = TOUCH.on; BTN = [];
  const s = clamp(Math.min(cw, ch * 1.8) / 900, .8, 1.25);
  // 왼쪽 위: 이름·레벨·생명·바람
  const bx = 10 + SAFE_L(), by = 10, bw = 170 * s;
  x.fillStyle = 'rgba(30,24,18,.55)'; rr(bx, by, bw + 16, 64 * s, 10); x.fill();
  x.font = `800 ${12 * s}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText(CLASSES[P.cls].name + ' · ' + lvT(P.lv), bx + 8, by + 15 * s);
  x.font = `600 ${10 * s}px system-ui`; x.fillStyle = '#ffd166'; x.textAlign = 'right'; x.fillText(P.gold.toLocaleString() + 'G', bx + bw + 8, by + 15 * s);
  bar(bx + 8, by + 22 * s, bw, 12 * s, P.hp / P.mhp, '#e8604e', '#ff9a7a', Math.ceil(P.hp) + ' / ' + P.mhp, s);
  bar(bx + 8, by + 38 * s, bw, 10 * s, P.wind / P.mwind, '#4aa8d8', '#9fe4ff', Math.floor(P.wind) + ' / ' + P.mwind, s);
  const xf = P.xp / xpNeed(P.lv); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(bx + 8, by + 52 * s, bw, 4); x.fillStyle = '#b6f0a0'; x.fillRect(bx + 8, by + 52 * s, bw * xf, 4);
  if (P.rested > 1) { x.fillStyle = 'rgba(159,228,255,.6)'; x.fillRect(bx + 8 + bw * xf, by + 52 * s, Math.min(bw * (1 - xf), bw * P.rested / xpNeed(P.lv)), 4); x.font = `600 ${8.5 * s}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#9fe4ff'; x.fillText('순풍 ×2', bx + 8, by + 64 * s); }
  if (P.pts || P.skp) { x.font = `700 ${9.5 * s}px system-ui`; x.textAlign = 'right'; x.fillStyle = '#ffd166'; x.fillText((P.pts ? '스탯 ' + P.pts + ' ' : '') + (P.skp ? '스킬 ' + P.skp : ''), bx + bw + 8, by + 64 * s); }
  { const bw2 = bagWeight(P), cp = bagCap(P); if (bw2 > cp) { x.font = `800 ${10 * s}px system-ui`; x.textAlign = 'left'; x.fillStyle = '#ff8a6a'; x.fillText('🎒 가방이 무거워요 · 걸음 느림 (무게 ' + bw2 + '/' + cp + ')', bx + 8, by + 78 * s); } }
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
  else if (i === 3 && P.lv < ULT[P.cls].req) { x.font = `700 ${sz * .2}px system-ui`; x.textAlign = 'center'; x.fillStyle = 'rgba(255,220,160,.7)'; x.fillText('궁극', X + sz / 2, Y + sz * .5); x.fillText(lvT(ULT[P.cls].req), X + sz / 2, Y + sz * .74); }
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
  if (!MINI || MINI.v !== (Wd.bridges[Wd.bq].broken ? 0 : 1) + (Wd.bridges[Wd.bq2] && !Wd.bridges[Wd.bq2].broken ? 2 : 0)) { const c = document.createElement('canvas'); c.width = Wd.W * 2; c.height = Wd.H * 2; const g = c.getContext('2d');
    for (let y = 0; y < Wd.H; y++) for (let xx = 0; xx < Wd.W; xx++) { const t = Wd.g[Wd.id(xx, y)]; if (!t) continue; g.fillStyle = t === 3 ? '#c8a070' : t === 4 ? '#8a6a50' : t === 5 ? '#d8d0c0' : t === 2 ? '#d8c08a' : Wd.block[Wd.id(xx, y)] ? '#5a8a4a' : '#9ccc7a'; g.fillRect(xx * 2, y * 2, 2, 2); }
    MINI = { c, v: (Wd.bridges[Wd.bq].broken ? 0 : 1) + (Wd.bridges[Wd.bq2] && !Wd.bridges[Wd.bq2].broken ? 2 : 0) }; }
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
  const P = G.P, L = []; for (const id in QUESTS) { const q = P.q[id]; if (!q || q.s === 3) continue; const Q = QUESTS[id]; let t = Q.goal; if (q.s === 2) t = NPCDEF[Q.from].n + '에게 돌아가기'; else if (id === 'q1') t = '다리 널빤지 ' + Math.min(6, count('plank')) + '/6 → 동쪽 끊긴 다리'; else if (id === 'q2') t = '보풀이 ' + q.n + '/15'; else if (id === 'q4') t = '바람 숫돌 ' + Math.min(3, count('hone')) + '/3'; else if (id === 'q5') t = '둥지 껍질 ' + Math.min(3, count('shell')) + '/3 → 언덕 동쪽 끊긴 다리'; else if (id === 'q6') t = '늪 밑것 ' + q.n + '/20'; else if (id === 'q7') t = '둥지섬의 큰 왜가리'; else t = track2(id, q) || track3(id, q) || trackX(id, q) || t; L.push([Q.n, t]); }
  const dt2 = dailyTrack(); if (dt2) L.push(dt2); const et = errandTrack(); if (et) L.push(et);
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
    else if (a.k === 'blade') drawBlade(a);
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

/* ---------- 손맛: 무기별 휘두르기 · 기술 시전 문양 · 처치 임팩트 · 적 움직임 ---------- */
const CLSC = { warden: '#ffd8a0', drifter: '#ffe6e6', windcaller: '#9fe4ff', trapper: '#c8f0a0', ringer: '#e8d0ff' };
const HERO_SC = .62; // 캐릭터 크기(아틀라스 2배 → 1배는 .5)
// 들고 있는 무기 등급 색(보통이면 흰빛)
function weaponCol(P) { const w = P.eq.weapon; return w && !w.g && w.r >= 1 ? RAR[w.r].c : w && w.en >= 7 ? '#ffd166' : '#fff8e1'; }
// 기본 공격: 무기마다 다른 궤적
function basicFx(P, ax, ay, m) {
  const c = weaponCol(P);
  if (P.cls === 'warden') { // 창: 찌르기 선 + 창끝 번쩍
    G.fx.push({ k: 'thrust2', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.9, t: 0, life: .18, c });
  } else if (P.cls === 'drifter') { // 쌍칼: 엇갈린 두 번 베기
    G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.45, t: 0, life: .18, s: 0, c }, { k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.3, t: -.06, life: .18, s: 1, c });
  } else if (P.cls === 'ringer') { // 망치: 무거운 반원 + 땅 먼지
    G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.5, t: 0, life: .26, s: P.combo % 2, c, heavy: 1 });
    if (m) { G.fx.push({ k: 'dustring', x: m.x, y: m.y, r: 1, t: 0, life: .35 }); G.shake = Math.max(G.shake, 2.5); }
  } else G.fx.push({ k: 'slash', x: P.x, y: P.y, dx: ax, dy: ay, len: 1.5, t: 0, life: .2, s: P.combo % 2, c });
}
// 원거리 기본 공격: 쏘는 자리 번쩍
function muzzleFx(P, ax, ay) { G.fx.push({ k: 'muzzle', x: P.x + ax * .5, y: P.y + ay * .5, dx: ax, dy: ay, t: 0, life: .14, c: P.cls === 'trapper' ? '#fff0c0' : '#dff4ff' }); }
// 기술 쓸 때 발밑 문양
function castGlyph(P, s) { const c = CLSC[P.cls] || '#fff'; G.fx.push({ k: 'glyph', x: P.x, y: P.y, t: 0, life: .55, c, big: !!s.cd && s.cd >= 8 });
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, r = rnd(.3, .9); G.parts.push({ k: 'puff', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, z: 2, vx: 0, vy: 0, vz: rnd(80, 170), t: 0, life: rnd(.4, .7), c, s: rnd(1.4, 2.4) }); } }
// 처치 임팩트: 하얗게 번쩍 → 별 모양 터짐 + 땅 충격파 + 위로 튀는 조각
function killFx(m) { const D = m.D, big = D.boss ? 2.4 : D.mini ? 1.6 : m.elite ? 1.3 : 1, hz = D.boss ? 60 : D.mini ? 44 : 22;
  m.flash = .3; m.kpop = 1; G.hitstop = Math.max(G.hitstop, D.boss ? .22 : D.mini ? .12 : .065); G.shake = Math.max(G.shake, 2 + big * 2);
  G.fx.push({ k: 'kill', x: m.x, y: m.y, z: hz, t: 0, life: .32 + big * .06, s: big }, { k: 'dustring', x: m.x, y: m.y, r: .8 * big, t: 0, life: .4 });
  const dx = m.x - G.P.x, dy = m.y - G.P.y, a0 = Math.atan2(dy, dx); for (let i = 0; i < 8 * big; i++) { const a = a0 + rnd(-.9, .9), sp = rnd(3, 8); G.parts.push({ k: 'spark', x: m.x, y: m.y, z: hz, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 260), t: 0, life: rnd(.2, .4), c: i % 2 ? '#ffffff' : '#ffe8b0', s: 2.6 }); } }
// 새 효과 그리기. 처리했으면 true
function drawJuiceFx(f, k, sx, sy) {
  if (f.k === 'thrust2') { const [ex, ey] = iso(f.x + f.dx * f.len * (.5 + k * .5), f.y + f.dy * f.len * (.5 + k * .5)); x.save(); x.lineCap = 'round'; x.globalAlpha = 1 - k;
    x.strokeStyle = f.c; x.lineWidth = 9 * (1 - k) + 1; x.globalAlpha = (1 - k) * .35; x.beginPath(); x.moveTo(sx, sy - 22); x.lineTo(ex, ey - 22); x.stroke();
    x.globalAlpha = 1 - k; x.strokeStyle = '#fff'; x.lineWidth = 3 * (1 - k) + 1; x.beginPath(); x.moveTo(sx, sy - 22); x.lineTo(ex, ey - 22); x.stroke();
    x.fillStyle = f.c; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = (i % 2 ? 3 : 10) * (1 - k * .6); x.lineTo(ex + Math.cos(a) * r, ey - 22 + Math.sin(a) * r * .7); } x.closePath(); x.fill(); x.restore(); return true; }
  if (f.k === 'muzzle') { const [ex, ey] = iso(f.dx, f.dy), a = Math.atan2(ey, ex); x.save(); x.translate(sx, sy - 22); x.rotate(a); x.globalAlpha = 1 - k; x.fillStyle = f.c; x.beginPath(); x.moveTo(0, -5 * (1 - k)); x.lineTo(18 * (1 - k * .3), 0); x.lineTo(0, 5 * (1 - k)); x.lineTo(-4, 0); x.closePath(); x.fill(); x.restore(); return true; }
  if (f.k === 'dustring') { x.globalAlpha = (1 - k) * .7; x.fillStyle = 'rgba(160,130,90,.55)'; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = f.r * 30 * (.4 + k * .8); x.beginPath(); x.arc(sx + Math.cos(a) * r, sy + Math.sin(a) * r * .5 - k * 6, 5 * (1 - k * .5), 0, TAU); x.fill(); } x.globalAlpha = 1; return true; }
  if (f.k === 'glyph') { const R = (f.big ? 34 : 26) * (.6 + Math.min(1, k * 3) * .4); x.save(); x.translate(sx, sy); x.scale(1, .5); x.rotate(k * 2.5); x.globalAlpha = (1 - k) * .9; x.strokeStyle = f.c; x.shadowColor = f.c; x.shadowBlur = 10;
    x.lineWidth = 2.2; x.beginPath(); x.arc(0, 0, R, 0, TAU); x.stroke(); x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, R * .72, 0, TAU); x.stroke();
    x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.moveTo(Math.cos(a) * R * .72, Math.sin(a) * R * .72); x.lineTo(Math.cos(a + 2.1) * R * .72, Math.sin(a + 2.1) * R * .72); } x.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.fillStyle = f.c; x.fillRect(Math.cos(a) * R * .86 - 1.5, Math.sin(a) * R * .86 - 1.5, 3, 3); } x.restore(); return true; }
  if (f.k === 'kill') { const Y = sy - f.z, s = f.s; x.save(); x.globalCompositeOperation = 'lighter';
    const gl = x.createRadialGradient(sx, Y, 0, sx, Y, 40 * s); gl.addColorStop(0, 'rgba(255,250,230,.95)'); gl.addColorStop(1, 'rgba(255,200,120,0)'); x.globalAlpha = (1 - k) * .8; x.fillStyle = gl; x.beginPath(); x.arc(sx, Y, 40 * s, 0, TAU); x.fill();
    x.globalAlpha = 1 - k; x.strokeStyle = '#fff'; x.lineCap = 'round'; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + f.x, r0 = 8 * s + k * 20 * s, r1 = r0 + (18 - k * 14) * s; x.lineWidth = (i % 2 ? 2 : 3.5) * (1 - k) + .5; x.beginPath(); x.moveTo(sx + Math.cos(a) * r0, Y + Math.sin(a) * r0 * .7); x.lineTo(sx + Math.cos(a) * r1, Y + Math.sin(a) * r1 * .7); x.stroke(); }
    x.restore(); x.globalAlpha = 1; return true; }
  return false;
}
// 적 움직임: 걷는 것은 통통 튀고 몸이 눌렸다 늘어나고, 나는 것은 위아래로 떠다니고, 공격할 땐 앞으로 덤빔
function mobMotion(m) { const D = m.D, P = G.P; let oy = 0, ox = 0, scx = 1, scy = 1, rot = 0;
  if (m.dead) { const t = m.at; if (m.kpop && !m.fl) { const u = Math.min(1, t / .28); oy = -Math.sin(u * Math.PI) * (D.big ? 6 : 16); scx = 1 + Math.max(0, t - .28) * .9; scy = Math.max(.35, 1 - Math.max(0, t - .28) * 1.6); } return [ox, oy, scx, scy, rot]; }
  if (D.fly) { oy = -6 - Math.sin(G.t * 4.2 + m.id) * 5; rot = Math.sin(G.t * 3 + m.id) * .05; }
  else if (m.an === 'move') { const ph = (m.at * (D.big ? 5 : 9) + m.id) * Math.PI, h = Math.abs(Math.sin(ph)); oy = -h * (D.big ? 3 : 6); scx = 1 + (1 - h) * .07; scy = 1 - (1 - h) * .07 + h * .05; rot = Math.sin(ph) * (D.big ? .03 : .07);
    if ((1 - h) > .92 && !m.dust && !D.big || D.big && (1 - h) > .97 && !m.dust) { m.dust = 1; for (let i = 0; i < (D.big ? 4 : 2); i++) G.parts.push({ k: 'dust', x: m.x + rnd(-.2, .2), y: m.y + rnd(-.2, .2), z: 2, vx: rnd(-.6, .6), vy: rnd(-.6, .6), vz: rnd(20, 50), t: 0, life: .45, c: 'rgba(170,150,110,.45)', s: D.big ? 6 : 3.5 }); } else if ((1 - h) < .5) m.dust = 0; }
  else { const b = Math.sin(G.t * 2.4 + m.id); scy = 1 + b * .025; scx = 1 - b * .015; }
  if (m.an === 'atk' && !D.big) { const w = Math.min(1, m.at / .35), l = Math.sin(w * Math.PI) * 9, dx = P.x - m.x, dy = P.y - m.y, d = hyp(dx, dy) || 1, [ix, iy] = iso(dx / d, dy / d); ox = ix * l * .25; oy += iy * l * .25 - Math.sin(w * Math.PI) * 3; scy *= 1 + Math.sin(w * Math.PI) * .08; }
  if (m.an === 'hurt') { rot += Math.sin(m.at * 40) * .06; }
  return [ox, oy, scx, scy, rot]; }
// 마을 건물 표시(창고·우물): 가까이 가면 떠 있는 이름표
function drawTownMarks() { const Wd = G.Wd, P = G.P; for (const [p, s] of [[Wd.stashAt, '🏠 창고'], [Wd.wellAt, '💧 우물']]) { if (!p) continue; const d = hyp(P.x - p[0], P.y - p[1]); if (d > 6) continue; const [sx, sy] = iso(p[0], p[1]), yy = sy - 46 + Math.sin(G.t * 3) * 3; x.globalAlpha = clamp((6 - d) / 2, 0, 1); x.font = '800 11px system-ui'; x.textAlign = 'center'; const w = x.measureText(s).width + 12; x.fillStyle = 'rgba(30,24,18,.7)'; rr(sx - w / 2, yy - 12, w, 17, 6); x.fill(); x.fillStyle = '#ffe9b0'; x.fillText(s, sx, yy + 1); x.globalAlpha = 1; } }
// 난이도: 적 체력·피해·발빠르기·공격 간격
const DIFF = { hp: 1.35, dmg: 1.3, spd: 1.08, cd: .85, aggro: 1.5 };
// 적 공격 효과: 휘두르기 전 번쩍(예고) → 할퀴기·물기 자국 → 맞으면 붉은 튐·화면 가장자리 붉어짐·살짝 밀림
const MOBATK = { bird: 'peck', rustcrow: 'peck', gull: 'peck', heronling: 'peck', seed: 'bite', bogpod: 'bite', boltpod: 'bite', barnpod: 'bite' };
function mobAtkStart(m) { G.fx.push({ k: 'mtele', x: m.x, y: m.y, t: 0, life: .32, c: m.elite ? m.E[1] : '#ff6a4a', big: m.D.mini }); }
function mobAtkHit(m, hit) { const P = G.P, dx = P.x - m.x, dy = P.y - m.y, d = hyp(dx, dy) || 1, kind = MOBATK[m.t] || 'claw';
  G.fx.push({ k: 'mclaw', x: m.x + dx / d * Math.min(d, m.r + .45), y: m.y + dy / d * Math.min(d, m.r + .45), dx: dx / d, dy: dy / d, t: 0, life: .26, c: hit ? '#ff5a3a' : '#f0e0c8', kind });
  if (!hit) G.parts.push({ k: 'dust', x: m.x + dx / d * .6, y: m.y + dy / d * .6, z: 2, vx: dx / d, vy: dy / d, vz: 30, t: 0, life: .35, c: 'rgba(200,190,160,.5)', s: 4 }); }
function hurtFx(src, dmg) { const P = G.P; G.hurtV = Math.min(1, (G.hurtV || 0) + .35 + dmg / P.mhp * 2);
  for (let i = 0; i < 9; i++) { const a = Math.random() * TAU, sp = rnd(2, 5); G.parts.push({ k: 'spark', x: P.x, y: P.y, z: 26, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 200), t: 0, life: rnd(.2, .35), c: i % 3 ? '#ff6a4a' : '#ffd0b0', s: 2.4 }); }
  if (src && !src.D.big) { const dx = P.x - src.x, dy = P.y - src.y, d = hyp(dx, dy) || 1; for (let i = 0; i < 4; i++) move(P, dx / d * .06, dy / d * .06); } }
function chargeTrail(m) { if (Math.random() < .6) G.parts.push({ k: 'dust', x: m.x + rnd(-.15, .15), y: m.y + rnd(-.15, .15), z: 3, vx: -m.cvx * .08, vy: -m.cvy * .08, vz: rnd(10, 40), t: 0, life: .4, c: 'rgba(170,150,110,.5)', s: 4 });
  if (Math.random() < .5) G.fx.push({ k: 'speedl', x: m.x, y: m.y, dx: m.cvx, dy: m.cvy, t: 0, life: .18 }); }
function drawEnemyFx(f, k, sx, sy) {
  if (f.k === 'mtele') { const Y = sy - (f.big ? 60 : 40); x.save(); x.globalAlpha = k < .5 ? k * 2 : (1 - k) * 2; x.fillStyle = f.c; x.strokeStyle = 'rgba(40,10,0,.8)'; x.lineWidth = 2; x.font = '900 18px system-ui'; x.textAlign = 'center'; x.strokeText('!', sx, Y); x.fillText('!', sx, Y);
    x.globalCompositeOperation = 'lighter'; x.globalAlpha *= .6; const g = x.createRadialGradient(sx, sy - 18, 0, sx, sy - 18, 26); g.addColorStop(0, f.c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(sx, sy - 18, 26, 0, TAU); x.fill(); x.restore(); return true; }
  if (f.k === 'mclaw') { const [ex, ey] = iso(f.dx, f.dy), a = Math.atan2(ey, ex); x.save(); x.translate(sx, sy - 20); x.rotate(a); x.globalAlpha = 1 - k; x.strokeStyle = f.c; x.lineCap = 'round'; x.shadowColor = f.c; x.shadowBlur = 6;
    if (f.kind === 'peck') { x.lineWidth = 3 * (1 - k) + 1; x.beginPath(); x.moveTo(-6, 0); x.lineTo(16 + k * 8, 0); x.stroke(); x.beginPath(); x.moveTo(10, -6); x.lineTo(18 + k * 6, 0); x.lineTo(10, 6); x.stroke(); }
    else if (f.kind === 'bite') { x.lineWidth = 2.5; const o = 9 * (1 - k * .5); for (const sgn of [-1, 1]) { x.beginPath(); for (let i = 0; i < 4; i++) { const xx = -8 + i * 6; x.lineTo(xx, sgn * o); x.lineTo(xx + 3, sgn * (o - 6)); } x.stroke(); } }
    else { for (let i = -1; i <= 1; i++) { x.lineWidth = 3 * (1 - k) + .8; x.beginPath(); x.moveTo(-10, i * 7 - 6); x.quadraticCurveTo(4, i * 7, 14 + k * 6, i * 7 + 6); x.stroke(); } }
    x.restore(); return true; }
  if (f.k === 'speedl') { const [vx, vy] = iso(f.dx, f.dy), l = hyp(vx, vy) || 1; x.save(); x.globalAlpha = (1 - k) * .7; x.strokeStyle = '#fff'; x.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { const ox = -vy / l * i * 7, oy = vx / l * i * 7; x.beginPath(); x.moveTo(sx + ox, sy - 16 + oy); x.lineTo(sx + ox - vx / l * 26, sy - 16 + oy - vy / l * 26); x.stroke(); } x.restore(); return true; }
  return false; }
// 맞았을 때 화면 가장자리 붉게
function drawHurtVignette(cw, ch) { const v = G.hurtV || 0; if (v < .01) return; G.hurtV = v * .9; const R = Math.hypot(cw, ch) / 2, g = x.createRadialGradient(cw / 2, ch / 2, R * .45, cw / 2, ch / 2, R); g.addColorStop(0, 'rgba(200,20,10,0)'); g.addColorStop(1, `rgba(200,20,10,${.55 * v})`); x.fillStyle = g; x.fillRect(0, 0, cw, ch); }

/* ---------- 4~7장 그림: 장에 들어갈 때 그 장 그림만 받는다 ---------- */
Object.assign(MC, {
  mossfluff: [110, 110, 55, 96], thornpod: [96, 104, 48, 92], mothbird: [104, 132, 52, 120], rootling: [140, 150, 70, 136], rootkeeper: [196, 212, 98, 192], oldtree: [300, 340, 150, 316],
  stormfluff: [110, 110, 55, 96], sparkpod: [96, 104, 48, 92], stormbird: [104, 132, 52, 120], stormling: [140, 160, 70, 146], stormkeeper: [196, 212, 98, 192], whale: [340, 380, 170, 352],
  dustfluff: [110, 110, 55, 96], stonepod: [96, 104, 48, 92], ashbird: [104, 132, 52, 120], stoneguard: [146, 160, 73, 146], stonekeeper: [196, 212, 98, 192], gatekeeper: [300, 340, 150, 320],
  galefluff: [110, 110, 55, 96], galepod: [96, 104, 48, 92], galebird: [104, 132, 52, 120], galeling: [140, 160, 70, 146], galekeeper: [196, 212, 98, 192], windlord: [260, 360, 130, 330] });
const LAZY = {};
function lazyImg(k) { if (IM[k] || LAZY[k] || !MC[k]) return; LAZY[k] = 1; const im = new Image(); im.onload = () => { IM[k] = im; }; im.onerror = () => { setTimeout(() => { LAZY[k] = 0; }, 5000); }; im.src = IMG + k + '.webp?v=45e8a1fc'; }

/* ---------- 베타 의견: 메뉴 「의견 보내기」 + 장 끝·보스·첫 쓰러짐·레벨 10마다 살짝 묻기 ---------- */
// 보낼 때 지금 장·섬·레벨·직업·난이도·플레이 시간·폰/PC를 같이 붙인다. 프로필이 있으면 게시판에도 올릴 수 있다.
const FBT = [['bug', '🐞 버그'], ['hard', '😵 너무 어려움'], ['easy', '😴 너무 쉬움'], ['dull', '🥱 지루함'], ['good', '😍 좋아요'], ['idea', '💡 제안']];
const FB = { star: 0, tags: [], why: 'menu', busy: 0, chip: null, last: 0 };
function fbCtx() { const P = G.P, Wd = G.Wd, k = Wd.isl[Wd.id(Math.floor(P.x), Math.floor(P.y))], s = k >= 0 && Wd.islands[k];
  return { ch: Wd.ch, isle: (s && s.name) || '', lv: P.lv, cls: P.cls, diff: P.diff || 0, play: Math.round(P.play || 0), dev: matchMedia('(pointer: coarse)').matches ? 'phone' : 'pc', why: FB.why, lang: LANG, v: '45e8a1fc'.slice(0, 8) }; }
function fbOpen(why) { FB.why = why || 'menu'; FB.star = 0; FB.tags = []; fbChipOff(); openPanel('fb'); }
const FBWHY = { end: '이 장', boss: '방금 보스 싸움', die: '방금 쓰러진 싸움', lv: '지금까지', menu: '' };
function fbHtml(X) { const c = fbCtx(), code = pcode();
  return `<div class="sk-bx" style="max-width:440px">${X}<h3>💬 베타 의견 보내기</h3><p class="m" style="font-size:12.5px;margin:0 0 8px">${FBWHY[FB.why] ? '<b>' + FBWHY[FB.why] + '</b>, 어땠나요? ' : ''}한 줄이라도 큰 도움이 돼요!</p>
  <div style="font-size:30px;letter-spacing:4px;text-align:center;margin:4px 0">${[1, 2, 3, 4, 5].map(i => `<span data-a="fbs" data-i="${i}" style="cursor:pointer;color:${i <= FB.star ? '#ffb020' : '#cbbfa8'}">★</span>`).join('')}</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0">${FBT.map(([k, n]) => `<button class="sk-b${FB.tags.includes(k) ? ' g' : ''}" data-a="fbt" data-k="${k}" style="margin:0;padding:6px 10px;font-size:13px">${n}</button>`).join('')}</div>
  <textarea id="sk-fbtx" maxlength="500" rows="3" placeholder="예) 2장 사슬 다리 찾기가 헷갈려요 / 보스 줄 공격이 너무 아파요" style="width:100%;box-sizing:border-box;border-radius:10px;border:2px solid #d8c8a8;padding:8px;font:inherit;font-size:14px;resize:vertical">${FB.text || ''}</textarea>
  <label style="display:block;font-size:12.5px;margin:6px 0;color:${code ? '#5a3e22' : '#a89878'}"><input type="checkbox" id="sk-fbbd" ${code ? '' : 'disabled'}> 5락실 게시판에도 올리기${code ? '' : ' (프로필이 있으면 가능)'}</label>
  <p class="m" style="font-size:11px;color:#8a7458;margin:2px 0 8px">같이 보내는 정보: ${c.ch === 8 ? '떠도는 섬' : c.ch + '장'} ${c.isle} · ${c.lv}레벨 · ${CLASSES[c.cls].name} · ${c.dev === 'pc' ? 'PC' : '폰'}. 욕설·링크·개인정보는 보낼 수 없어요.</p>
  <button class="sk-b p" data-a="fbsend" ${FB.busy ? 'disabled' : ''}>보내기</button> <button class="sk-b" data-a="x">다음에</button>${TOAST}</div>`; }
function fbAct(a, t) { const ta = panel.querySelector('#sk-fbtx'); if (ta) FB.text = ta.value;
  if (a === 'fbs') { FB.star = +t.dataset.i; render(); return true; }
  if (a === 'fbt') { const k = t.dataset.k, i = FB.tags.indexOf(k); if (i >= 0) FB.tags.splice(i, 1); else FB.tags.push(k); render(); return true; }
  if (a === 'fb') { fbOpen(t.dataset.w); return true; }
  if (a === 'fbsend') { if (FB.busy) return true; const text = (FB.text || '').trim(); if (!FB.star) { toast('별점을 먼저 골라 주세요'); return true; } if (!text && !FB.tags.length) { toast('태그를 고르거나 한 줄 써 주세요'); return true; }
    const bd = panel.querySelector('#sk-fbbd'); FB.busy = 1; render();
    fetch('/api/skyfb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'send', code: pcode(), star: FB.star, tags: FB.tags, text, ctx: fbCtx(), board: !!(bd && bd.checked) }) })
      .then(r => r.json().catch(() => ({}))).then(j => { FB.busy = 0; if (j.ok) { FB.text = ''; G.P.flags.fbN = (G.P.flags.fbN || 0) + 1; save(); closePanel(); say(j.board ? '고마워요! 의견을 보냈고 게시판에도 올렸어요.' : j.board === 0 ? '고마워요! 의견을 보냈어요(게시판은 오늘 글 수를 다 써서 못 올렸어요).' : '고마워요! 의견을 잘 받았어요.', '#9fe4ff'); } else { render(); toast(j.msg || '지금은 보낼 수 없어요. 잠시 뒤 다시 해 주세요'); } })
      .catch(() => { FB.busy = 0; render(); toast('인터넷 연결을 확인해 주세요'); });
    return true; }
  return false; }
// 살짝 묻기: 화면 오른쪽 아래에 작은 단추가 20초 동안. 같은 이유는 한 번만, 10분에 한 번까지.
function fbNudge(why, key) { const P = G.P; if (!G || DEBUG && !P.flags.fbTest) return; const f = 'fb_' + (key || why); if (P.flags[f] || Date.now() - FB.last < 6e5) return; P.flags[f] = 1; FB.last = Date.now();
  fbChipOff(); const b = document.createElement('button'); b.className = 'sk-fbchip'; b.textContent = '💬 ' + (FBWHY[why] || '의견') + ' 어땠어요?'; b.style.cssText = 'position:absolute;right:12px;bottom:84px;z-index:5;border:0;border-radius:999px;padding:9px 14px;background:#ffd166;color:#3a2a10;font:800 13px system-ui;box-shadow:0 3px 0 #b8860b;cursor:pointer';
  b.onclick = e => { e.stopPropagation(); fbOpen(why); }; ov.appendChild(b); FB.chip = b; setTimeout(() => { if (FB.chip === b) fbChipOff(); }, 20000); }
function fbChipOff() { if (FB.chip) { FB.chip.remove(); FB.chip = null; } }

/* ---------- 대장간 연출: 강화·옵션 다시 굴리기 결과를 크게 보여 준다 (2026-11-15 BK "성공과 실패를 극적으로") ---------- */
// 0~0.95초: 망치질(물건이 떨리고 불똥이 튐, 점점 빨라짐) → 결과: 성공(흰 번쩍 + 금빛 햇살 + 불꽃 + 튀어 오름) · 두 단계(무지개)
// 축복이 지킴(푸른 방패가 깨짐) · 실패(붉은 번쩍 + 금 가고 화면 흔들림 + 조각이 떨어짐) · 다시 굴리기(보랏빛 소용돌이). 누르면 바로 닫힘.
const FORGE = { el: null, cv: null, raf: 0 };
function forgeFx(it, kind, text, sub) {
  if (!FORGE.el) { const d = document.createElement('div'); d.className = 'sk-forge'; d.style.cssText = 'position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(10,8,20,.74);cursor:pointer';
    const c = document.createElement('canvas'); c.style.cssText = 'width:min(92vw,520px);height:min(92vw,520px,86vh);max-height:86vh'; d.appendChild(c); d.onclick = forgeEnd; ov.appendChild(d); FORGE.el = d; FORGE.cv = c; }
  cancelAnimationFrame(FORGE.raf); const el = FORGE.el, c = FORGE.cv, dpr = Math.min(2, devicePixelRatio || 1), W = 520; el.style.display = 'flex'; c.width = W * dpr; c.height = W * dpr;
  const g = c.getContext('2d'), t0 = performance.now(), HIT = .95, END = kind === 'fail' ? 3 : 3.2, P = [], col = kind === 'fail' ? '#ff4a3a' : kind === 'keep' ? '#6ab4ff' : kind === 'reroll' ? '#c9a8ff' : kind === 'double' ? '#ffffff' : '#ffd166';
  const big = kind === 'double' || (kind === 'ok' && it.en >= 7), cracks = []; let hit = 0, lastHam = -1;
  for (let i = 0; i < 7; i++) { const a = Math.random() * TAU, L = []; let x2 = 0, y2 = 0; for (let j = 0; j < 5; j++) { x2 += Math.cos(a + rnd(-.6, .6)) * rnd(14, 26); y2 += Math.sin(a + rnd(-.6, .6)) * rnd(14, 26); L.push([x2, y2]); } cracks.push(L); }
  const burst = (n, sp, cs, grav, sz) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(sp * .3, sp); P.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? 120 : 0), g: grav, t: 0, life: rnd(.6, 1.4), c: pick(cs), s: rnd(sz * .5, sz) }); } };
  const frame = now => { const t = (now - t0) / 1000; if (t > END) { forgeEnd(); return; } FORGE.raf = requestAnimationFrame(frame);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W); const cx = W / 2, cy = W / 2 - 20;
    // 망치질 박자: 점점 빨라지는 쾅쾅 + 불똥
    if (t < HIT) { const beat = Math.floor(Math.pow(t / HIT, .6) * 5); if (beat !== lastHam) { lastHam = beat; sfx('slam'); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2), v = rnd(160, 380); P.push({ x: 0, y: 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1, t: 0, life: rnd(.3, .6), c: pick(['#ffd166', '#ff9a3a', '#fff4c0']), s: rnd(2, 4) }); } } }
    if (t >= HIT && !hit) { hit = 1; if (kind === 'fail') { sfx('fail'); burst(26, 260, ['#5a4a40', '#8a7a6a', '#3a2a20'], 1, 9); } else if (kind === 'keep') { sfx('gust'); burst(30, 300, ['#6ab4ff', '#bfe8ff', '#ffffff'], 0, 6); } else { sfx('lvl'); sfx('ench'); burst(big ? 70 : 44, big ? 460 : 340, kind === 'double' ? ['#ff6a6a', '#ffd23a', '#6aff8a', '#6ab4ff', '#c96aff'] : kind === 'reroll' ? ['#c9a8ff', '#ffffff', '#9fe4ff'] : ['#ffd166', '#fff4c0', '#ffffff', '#ffb03a'], 0, big ? 8 : 6); } }
    const k = t < HIT ? 0 : (t - HIT);
    // 배경 빛
    if (hit && kind !== 'fail') { g.save(); g.translate(cx, cy); g.rotate(t * (kind === 'reroll' ? 2.2 : .6)); const rays = kind === 'reroll' ? 6 : 14, R = 300 * Math.min(1, k * 3);
      for (let i = 0; i < rays; i++) { g.rotate(TAU / rays); const gr = g.createLinearGradient(0, 0, R, 0); gr.addColorStop(0, kind === 'double' ? `hsla(${(i * 50 + t * 200) % 360},100%,70%,.55)` : col + '99'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(R, -R * .12); g.lineTo(R, R * .12); g.closePath(); g.fill(); } g.restore(); }
    { const pu = t < HIT ? .3 + t / HIT * .4 + Math.sin(t * 30) * .08 : kind === 'fail' ? Math.max(0, .5 - k) : .9, gr = g.createRadialGradient(cx, cy, 10, cx, cy, 170); gr.addColorStop(0, t < HIT ? '#ffb03a' : col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = pu; g.fillStyle = gr; g.fillRect(0, 0, W, W); g.globalAlpha = 1; }
    if (kind === 'keep' && hit && k < .7) { g.strokeStyle = '#bfe8ff'; g.lineWidth = 6 * (1 - k); g.globalAlpha = 1 - k / .7; g.beginPath(); g.arc(cx, cy, 120 + k * 160, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    // 물건: 망치질 동안 떨림, 결과 때 튀어 오름(성공) / 가라앉고 흑백(실패)
    const sh = t < HIT ? (2 + t / HIT * 9) : kind === 'fail' && k < .5 ? 14 * (1 - k * 2) : 0, sc = t < HIT ? 1 + Math.sin(t * 40) * .02 : kind === 'fail' ? 1 - Math.min(.12, k * .3) : 1 + Math.max(0, .35 - k) * (big ? 1.4 : .9) + Math.sin(k * 12) * .04 * Math.max(0, 1 - k);
    const s = 210 * sc; g.save(); g.translate(cx + rnd(-sh, sh), cy + rnd(-sh, sh) + (kind === 'fail' && hit ? Math.min(18, k * 40) : 0)); if (kind === 'fail' && hit) g.filter = `grayscale(${Math.min(1, k * 2)}) brightness(${1 - Math.min(.35, k * .6)})`;
    drawIcon(it, -s / 2, -s / 2, s, g); g.filter = 'none';
    if (kind === 'fail' && hit) { g.strokeStyle = '#1a0a08'; g.lineWidth = 4; g.lineCap = 'round'; const f = Math.min(1, k * 4); for (const L of cracks) { g.beginPath(); g.moveTo(0, 0); for (let j = 0; j < Math.ceil(L.length * f); j++) g.lineTo(L[j][0] * s / 210, L[j][1] * s / 210); g.stroke(); } g.strokeStyle = '#ff6a4a'; g.lineWidth = 1.5; g.stroke(); }
    g.restore();
    // 망치(망치질 동안만)
    if (t < HIT) { const ph = (Math.pow(t / HIT, .6) * 5) % 1, ang = -1.1 + Math.min(1, ph * 3) * 1.25 - Math.max(0, ph - .35) * 1.6; g.save(); g.translate(cx + 150, cy - 40); g.rotate(ang); g.fillStyle = '#6a4428'; g.fillRect(-6, 0, 12, 120); g.fillStyle = '#8a8f9a'; g.fillRect(-34, -6, 68, 34); g.strokeStyle = '#24180f'; g.lineWidth = 3; g.strokeRect(-34, -6, 68, 34); g.strokeRect(-6, 0, 12, 120); g.restore(); }
    // 불똥·조각
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.t += 1 / 60; if (p.t > p.life) { P.splice(i, 1); continue; } p.x += p.vx / 60; p.y += p.vy / 60; if (p.g) p.vy += 900 / 60; p.vx *= .985; p.vy *= p.g ? 1 : .985;
      g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.c; if (p.g && kind === 'fail' && hit) { g.save(); g.translate(cx + p.x, cy + p.y); g.rotate(p.t * 8); g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .7); g.restore(); } else { g.beginPath(); g.arc(cx + p.x, cy + p.y, p.s, 0, TAU); g.fill(); } } g.globalAlpha = 1;
    // 번쩍
    if (hit && k < .25) { g.globalAlpha = (1 - k / .25) * (kind === 'fail' ? .55 : .85); g.fillStyle = kind === 'fail' ? '#ff2a1a' : '#ffffff'; g.fillRect(0, 0, W, W); g.globalAlpha = 1; }
    // 글씨
    if (hit) { const pop = Math.min(1, k * 5), bounce = 1 + Math.max(0, 1 - k * 4) * .35; g.save(); g.translate(cx, W - 78); g.scale(pop * bounce, pop * bounce); g.textAlign = 'center'; g.font = `900 ${big ? 50 : 44}px system-ui`; g.lineWidth = 9; g.strokeStyle = 'rgba(20,12,8,.9)'; g.strokeText(text, 0, 0);
      if (kind === 'double') { const gr = g.createLinearGradient(-160, 0, 160, 0); for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, `hsl(${(i * 60 + t * 240) % 360},100%,65%)`); g.fillStyle = gr; } else g.fillStyle = col; g.fillText(text, 0, 0);
      if (sub) { g.font = '800 20px system-ui'; g.lineWidth = 6; g.strokeText(sub, 0, 34); g.fillStyle = '#fff'; g.fillText(sub, 0, 34); } g.restore(); }
    else { g.textAlign = 'center'; g.font = '800 22px system-ui'; g.fillStyle = '#fff4c0'; g.globalAlpha = .6 + Math.sin(t * 14) * .4; g.fillText('두근두근…', cx, W - 70); g.globalAlpha = 1; }
    if (kind === 'fail' && hit && k < .5) ov.style.transform = `translate(${rnd(-8, 8) * (1 - k * 2)}px,${rnd(-6, 6) * (1 - k * 2)}px)`; else ov.style.transform = '';
  };
  FORGE.frame = frame; FORGE.t0 = t0; FORGE.raf = requestAnimationFrame(frame);
}
function forgeEnd() { cancelAnimationFrame(FORGE.raf); if (FORGE.el) FORGE.el.style.display = 'none'; if (ov) ov.style.transform = ''; }
// 강화 결과(enchant 의 r) → 연출 종류
function forgeEnch(it, r) { if (r.ok === 1) forgeFx(it, r.up > 1 ? 'double' : 'ok', '+' + it.en + ' 강화 성공!', r.up > 1 ? '두 단계나 올랐어요!' : it.en >= 7 ? '빛이 깃들었어요' : '');
  else if (r.ok === 2) forgeFx(it, 'keep', '실패… 하지만 지켰어요', r.bl ? '축복이 대신 사라졌어요' : '축복 덕분에 그대로예요');
  else if (r.ok === 3) forgeFx(it, 'fail', '강화 실패…', '+' + it.en + '(으)로 내려갔어요'); }

/* ---------- 순위 (2026-11-15 BK): 최고 레벨 · 엔딩 시간 · 가장 높은 난이도 엔딩 · 떠도는 섬 보스(난이도별), 한글/영문/전체 ---------- */
// 순위는 서버에 저장된 캐릭터(5락실 프로필·복구 코드)만. 서버가 저장 기록에서 뽑고, 말이 안 되는 기록은 뺀다(functions/api/skyrank.js).
const RK = { k: 'lv', d: 0, lang: 'all', list: null, busy: 0, err: '', nm: '', code: '' };
const RKCLS = () => ({ warden: CLASSES.warden.name, drifter: CLASSES.drifter.name, windcaller: CLASSES.windcaller.name, trapper: CLASSES.trapper.name, ringer: CLASSES.ringer.name });
function rkLoad() { RK.busy = 1; RK.list = null; RK.err = '';
  fetch(`/api/skyrank?k=${RK.k}&d=${RK.d}&lang=${RK.lang}`).then(r => r.json()).then(j => { RK.list = j.list || []; }).catch(() => { RK.err = '순위를 불러오지 못했어요'; }).finally(() => { RK.busy = 0; if (PANEL === 'rank') render(); }); }
const rkTime = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h + ':' + String(m).padStart(2, '0'); };
const rkAt = t => { const d = new Date(t + 9 * 36e5).toISOString(); return d.slice(5, 10) + ' ' + d.slice(11, 16); };
function rankHtml(X) { const P = G.P, cl = RKCLS();
  const tab = (k, n) => `<button class="sk-b${RK.k === k ? ' p' : ''}" data-a="rk" data-k="${k}">${n}</button>`;
  const lg = (l, n) => `<button class="sk-b${RK.lang === l ? ' g' : ''}" data-a="rkl" data-l="${l}" style="padding:4px 9px">${n}</button>`;
  let h = `<div class="sk-bx sk-fit" style="max-width:640px">${X}<h3>🏆 순위 <small style="font-size:12px;color:#8a7458">같은 기록이면 먼저 한 사람이 위</small></h3><div class="sk-two" style="grid-template-columns:1fr"><div>`;
  h += `<div style="margin:-3px -3px 2px">${tab('lv', '최고 레벨')}${tab('end', '엔딩 시간')}${tab('dmax', '최고 난이도')}${tab('boss', '떠도는 섬 보스')}</div>`;
  h += `<div style="margin:0 -3px 4px">${lg('all', '전체')}${lg('ko', '한국어')}${lg('en', 'English')}${RK.k === 'boss' ? ' · ' + DIFFT.map((d, i) => `<button class="sk-b${RK.d === i ? ' g' : ''}" data-a="rkd" data-i="${i}" style="padding:4px 8px">${d.n}</button>`).join('') : ''}</div>`;
  if (RK.list == null && !RK.busy && !RK.err) rkLoad();
  if (RK.err) h += `<p class="m">${RK.err}</p>`; else if (!RK.list) h += '<p class="m">불러오는 중…</p>';
  else if (!RK.list.length) h += '<p class="m">아직 기록이 없어요. 첫 번째가 되어 보세요!</p>';
  else h += '<div class="sk-card" style="padding:4px 10px">' + RK.list.map((r, i) => { const v = RK.k === 'lv' ? lvT(r.v) : RK.k === 'end' ? rkTime(r.v) : RK.k === 'dmax' ? DIFFT[r.v] ? DIFFT[r.v].n : r.v : r.v + '마리';
    return `<div class="sk-row"><b style="width:26px;color:${i < 3 ? '#d8a800' : '#8a7458'}">${i + 1}</b><div class="f">${esc(r.nick)} <small>${cl[r.cls] || ''} · ${lvT(r.lv)}${r.lang === 'en' ? ' · EN' : ''}</small></div><b>${v}</b>${RK.k === 'lv' || RK.k === 'dmax' ? `<small style="margin-left:6px">${rkAt(r.at)}</small>` : ''}</div>`; }).join('') + '</div>';
  // 내 순위 참가
  let code = ''; try { code = localStorage.getItem('nr_pcode') || ''; } catch (e) {}
  if (code) h += `<p class="m" style="font-size:11.5px">내 캐릭터는 서버에 저장될 때(1분쯤마다) 순위에 반영돼요. 엔딩 시간은 보통 난이도 첫 엔딩까지의 플레이 시간이에요.</p>`;
  else h += `<h4>순위에 참가하기</h4><p class="m" style="font-size:11.5px">이름을 정하면 5락실 프로필(복구 코드)이 만들어지고, 이 캐릭터가 서버에 저장돼 순위에 올라가요. 이메일·가입 없음.</p><div class="sk-row"><input id="sk-rknm" maxlength="10" placeholder="이름 (한글·영문·숫자 2~10자)" value="${esc(RK.nm)}" style="flex:1;min-width:0;border-radius:9px;border:2px solid #d8c8a8;padding:6px 8px;font:inherit"><button class="sk-b p" data-a="rkjoin" ${RK.busy ? 'disabled' : ''}>참가</button></div>`;
  if (RK.code) h += `<div class="sk-card" style="border-color:#e8b05a;background:#fff6e4">복구 코드: <b style="font-size:16px;letter-spacing:1px">${RK.code}</b><br><small>다른 기기에서 이어 하려면 이 코드가 필요해요. 꼭 적어 두세요!</small></div>`;
  return h + '</div></div>' + TOAST + '</div>'; }
function rkAct(a, t) {
  if (a === 'rk') { RK.k = t.dataset.k; RK.list = null; render(); return true; }
  if (a === 'rkl') { RK.lang = t.dataset.l; RK.list = null; render(); return true; }
  if (a === 'rkd') { RK.d = +t.dataset.i; RK.list = null; render(); return true; }
  if (a === 'rkjoin') { const inp = panel.querySelector('#sk-rknm'), nm = (inp && inp.value || '').trim(); RK.nm = nm;
    if (!/^[가-힣A-Za-z0-9]{2,10}$/.test(nm)) { toast('이름은 한글·영문·숫자 2~10자(띄어쓰기·기호 없이)예요'); return true; }
    RK.busy = 1; render(); const nick = '🐱 ' + nm;
    fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'new', nick, data: {} }) }).then(r => r.json()).then(j => {
      if (j.code) { try { localStorage.setItem('nr_pcode', j.code); localStorage.setItem('nr_nick', nick); localStorage.setItem('nr_prev', String(j.rev || 1)); } catch (e) {} RK.code = j.code; save(); cloudFlush(); toast('참가했어요! 곧 순위에 올라가요'); setTimeout(() => { RK.list = null; if (PANEL === 'rank') render(); }, 4000); }
      else toast(j.error === 'nick' ? '쓸 수 없는 이름이에요. 다른 이름을 골라 주세요' : j.error === 'limit' ? '오늘은 더 만들 수 없어요. 내일 다시 해 주세요' : '지금은 참가할 수 없어요. 잠시 뒤 다시 해 주세요');
    }).catch(() => toast('인터넷 연결을 확인해 주세요')).finally(() => { RK.busy = 0; if (PANEL === 'rank') render(); }); return true; }
  return false; }

// 게임 전용 꾸미기(5락실 '🛒 이 게임 상점', 2026-11-16 BK "새 게임이 올라오면 스킨도"): 겉모습만 — 능력·판정 영향 없음.
// 발밑 오라(au): wind 바람 고리 · bloom 꽃잎 고리 · sun 황금 햇무리 / 걸음 흔적(tr): feather 깃털 · star 별가루. 사이트 코인으로 사고 Bonus.gitem('sky', k) 로 읽는다.
let SKN = { au: '', tr: '', t: -9 }, STR = [];
function skinNow() {
  if (G.t - SKN.t < 1 && SKN.t <= G.t) return SKN; SKN.t = G.t;
  const B = opts.bonus; try { SKN.au = B && B.gitem ? B.gitem('sky', 'au') : ''; SKN.tr = B && B.gitem ? B.gitem('sky', 'tr') : ''; } catch (e) { SKN.au = SKN.tr = ''; }
  return SKN;
}
function drawSkinUnder(P, sx, sy) {
  const S = skinNow(), t = G.t; 
  if (S.tr) { // 걸음 흔적: 0.4칸마다 하나, 1.6초 동안 옅어짐
    const l = STR[STR.length - 1]; if (!l || hyp(l.x - P.x, l.y - P.y) > .4) { STR.push({ x: P.x, y: P.y, t, r: Math.random() * TAU }); if (STR.length > 18) STR.shift(); }
    for (const f of STR) { const k = (t - f.t) / 2.2; if (k > 1 || k < 0) continue; const [fx, fy] = iso(f.x, f.y); x.globalAlpha = (1 - k) * .85;
      if (S.tr === 'feather') { x.save(); x.translate(fx, fy - 2 - k * 6); x.rotate(f.r); const g = x.createLinearGradient(-7, 0, 7, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#bfe6ff'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 7, 2.6, 0, 0, TAU); x.fill(); x.strokeStyle = '#7fb4d8'; x.lineWidth = .8; x.beginPath(); x.moveTo(-7, 0); x.lineTo(7, 0); x.stroke(); x.restore(); }
      else { const s = 5.4 * (1 - k * .5) * (.8 + Math.sin(t * 12 + f.r * 5) * .2); x.fillStyle = 'rgba(255,220,90,.35)'; x.beginPath(); x.arc(fx, fy - 3, s * 2.6, 0, TAU); x.fill(); x.fillStyle = k < .3 ? '#ffffff' : '#ffe58a'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = f.r + i * Math.PI / 4, rr = i % 2 ? s * .35 : s * 1.6; x.lineTo(fx + Math.cos(a) * rr, fy - 3 + Math.sin(a) * rr * .8); } x.closePath(); x.fill(); x.strokeStyle = 'rgba(170,110,0,.8)'; x.lineWidth = 1; x.stroke(); } }
    x.globalAlpha = 1;
  } else if (STR.length) STR.length = 0;
  if (!S.au) return;
  x.save(); x.translate(sx, sy); x.scale(1.3, 1.3); x.translate(-sx, -sy);
  if (S.au === 'wind') { // 바람 고리: 도는 바람 줄기 두 겹
    for (let j = 0; j < 2; j++) { const r = 22 + j * 6, sp = (j ? -1 : 1) * t * 2.4; x.strokeStyle = j ? 'rgba(190,240,255,.55)' : 'rgba(120,220,255,.85)'; x.lineWidth = j ? 1.6 : 2.4; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(sx, sy, r, r * .48, 0, sp + i * TAU / 3, sp + i * TAU / 3 + 1.2); x.stroke(); } }
    for (let i = 0; i < 3; i++) { const k = (t * .9 + i / 3) % 1, a = i * 2.1 + t; x.globalAlpha = (1 - k) * .7; x.fillStyle = '#e8fbff'; x.beginPath(); x.ellipse(sx + Math.cos(a) * 20, sy - k * 30, 3.5 * (1 - k) + 1, 1.2, 0, 0, TAU); x.fill(); } x.globalAlpha = 1;
  } else if (S.au === 'bloom') { // 꽃잎 고리: 분홍 꽃잎 6장이 발밑을 돈다
    const g = x.createRadialGradient(sx, sy, 2, sx, sy, 26); g.addColorStop(0, 'rgba(255,170,210,.45)'); g.addColorStop(1, 'rgba(255,170,210,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(sx, sy, 26, 13, 0, 0, TAU); x.fill();
    for (let i = 0; i < 6; i++) { const a = t * 1.3 + i * TAU / 6, px = sx + Math.cos(a) * 22, py = sy + Math.sin(a) * 10.5; x.save(); x.translate(px, py); x.rotate(a * 2); x.fillStyle = i % 2 ? '#ffb3d1' : '#ff8fbf'; x.beginPath(); x.ellipse(0, 0, 4.6, 2.4, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(-1.3, -.5, 1.6, .8, 0, 0, TAU); x.fill(); x.restore(); }
  } else if (S.au === 'sun') { // 황금 햇무리: 금빛 원판 + 도는 빛살 + 피어오르는 금가루
    const pu = .5 + Math.sin(t * 3) * .5, g = x.createRadialGradient(sx, sy, 2, sx, sy, 30); g.addColorStop(0, `rgba(255,226,120,${.5 + pu * .2})`); g.addColorStop(1, 'rgba(255,200,60,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(sx, sy, 30, 15, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,214,90,.9)'; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy, 20 + pu * 2, 9.5 + pu, 0, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,240,180,.6)'; x.lineWidth = 1.4; for (let i = 0; i < 8; i++) { const a = t * .7 + i * TAU / 8; x.beginPath(); x.moveTo(sx + Math.cos(a) * 23, sy + Math.sin(a) * 11); x.lineTo(sx + Math.cos(a) * 31, sy + Math.sin(a) * 15); x.stroke(); }
    for (let i = 0; i < 5; i++) { const k = (t * .7 + i / 5) % 1, a = i * 1.9; x.globalAlpha = (1 - k); x.fillStyle = '#ffe27a'; x.beginPath(); x.arc(sx + Math.cos(a) * 14, sy - 4 - k * 52, 1.8, 0, TAU); x.fill(); } x.globalAlpha = 1;
  }
  x.restore();
}


/* =================== 화면(DOM)·입력·소리 =================== */
let panel, raf = 0, last = 0, acc = 0, PANEL = null, SEL = null, SHOP = null;
const TOUCH = { on: false, pad: null, held: {} }, KEYS = {};
function css() {
  const st = document.createElement('style');
  st.textContent = '.sk-ov [hidden]{display:none!important}.sk-ov{position:fixed;inset:0;z-index:9999;background:#9cc8e8;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;color:#3a2e22}.sk-ov canvas{box-shadow:none!important}.sk-ov>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.sk-pn{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:rgba(40,52,64,.45);padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) 8px max(8px,env(safe-area-inset-left))}'
    + '.sk-bx{background:linear-gradient(#fbf6ea,#efe5d0);border:2px solid #b89a6a;border-radius:16px;box-shadow:0 10px 40px rgba(30,20,10,.35),inset 0 0 0 3px #fffaf0;max-width:min(860px,100%);max-height:100%;width:100%;overflow:auto;padding:12px 14px;position:relative}'
    + '.sk-bx h3{margin:0 0 8px;font-size:17px;color:#5a3e22}.sk-bx h4{margin:10px 0 6px;font-size:13px;color:#7a5a32}.sk-x{position:sticky;top:0;float:right;border:0;background:#c8a06a;color:#fff;border-radius:10px;width:32px;height:32px;font-size:16px;cursor:pointer;z-index:2}'
    + '.sk-b{border:1.5px solid #b89a6a;background:#fffaf0;color:#5a3e22;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;margin:3px}.sk-b.p{background:#4f9fc8;border-color:#3a7fa8;color:#fff}.sk-b.g{background:#7ab85a;border-color:#5a9a3a;color:#fff}.sk-b:disabled{opacity:.45;cursor:default}'
    + '.sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:5px}.sk-c{aspect-ratio:1;border-radius:9px;background:#e6dac0;border:1.5px solid #c8b088;position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center}.sk-c canvas{width:84%;height:84%}.sk-c.on{outline:3px solid #4f9fc8}.sk-c i{position:absolute;right:2px;bottom:0;font-style:normal;font-size:10px;font-weight:800;color:#5a3e22;text-shadow:0 0 2px #fff}.sk-c b{position:absolute;left:3px;top:1px;font-size:10px;color:#a88a5a}.sk-c.r1{border-color:#3a8ae8;background:#dcebfb;box-shadow:inset 0 0 0 1px #6ab4ff}.sk-c.r2{border-color:#d8a800;background:#fbf0c8;box-shadow:inset 0 0 0 1px #ffd23a,0 0 6px #ffd23a88}.sk-c.r3{border-color:#e8661a;background:#fde0c8;box-shadow:inset 0 0 0 1px #ff8a3a,0 0 8px #ff8a3aaa}.sk-c.r4{border-color:#28b04a;background:#dcf6e0;box-shadow:inset 0 0 0 1px #5ee07a,0 0 8px #5ee07aaa}.sk-c.cu{box-shadow:inset 0 0 0 2px #a83a3a}'
    + '.sk-eq{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:5px}@media (max-width:520px){.sk-eq{grid-template-columns:repeat(5,minmax(0,1fr))}}'
    + '.sk-fit{display:flex;flex-direction:column;overflow:hidden}.sk-fit>.sk-two{flex:1;min-height:0}.sk-fit>.sk-two>div{overflow:auto;min-height:0;overscroll-behavior:contain}.sk-cmp{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:start}.sk-cmp .sk-card{font-size:11.5px;line-height:1.4;padding:6px 8px}.sk-cmp .sk-card .n{font-size:13px}.sk-cmp>div>.m{font-size:10.5px;color:#8a7458;margin:0 0 2px}.sk-acts{display:flex;flex-wrap:wrap;margin:-3px -3px 4px}.sk-fit>.sk-x{position:absolute;top:8px;right:8px}.sk-fit>h3{padding-right:40px}.sk-stg{display:grid;grid-template-columns:1fr 1fr;column-gap:10px}.sk-stg .sk-b{padding:3px 9px}'
    + '.sk-skw{grid-template-columns:3fr 2fr}.sk-skw .sk-sk{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.sk-skw .sk-br{padding:4px}.sk-skw .sk-s{padding:3px 4px;gap:5px;align-items:center}.sk-skw .sk-s canvas{width:32px;height:32px}.sk-skw .sk-s .f{font-size:11px;line-height:1.3}.sk-skw .sk-s b{font-size:12px}.sk-ult{margin-top:6px;border:1.5px solid #e8b05a;background:#fff6e4;border-radius:10px;padding:5px 8px;font-size:11.5px;line-height:1.4}.sk-skd .sk-card{font-size:12px;line-height:1.45}.sk-skd .sk-b.fk{display:block;width:calc(100% - 6px);text-align:left;font-size:11.5px;font-weight:600;padding:5px 8px}.sk-skd h4{margin:6px 0 2px}'
    + '@media (max-height:560px){.sk-bx{padding:8px 10px}.sk-bx h3{font-size:15px;margin:0 0 4px}.sk-bx h4{margin:4px 0 3px;font-size:12px}.sk-x{width:28px;height:28px}.sk-two{gap:8px}.sk-fit .sk-grid{grid-template-columns:repeat(10,minmax(0,1fr));gap:3px}.sk-fit .sk-eq{gap:3px}.sk-c b{font-size:8.5px}.sk-c{border-radius:7px}.sk-b{padding:5px 9px;font-size:12px;margin:2px}.sk-card{font-size:11.5px;line-height:1.4;padding:6px 8px}.sk-card .n{font-size:13.5px}.sk-row{padding:2px 0;font-size:12px}.sk-hd{display:none}.sk-skw .sk-s canvas{width:28px;height:28px}.sk-skw .sk-s b{white-space:nowrap;font-size:11.5px}.sk-skw .sk-s .f{min-width:0;overflow:hidden}'
    + '.sk-fit .sk-doll{grid-template-columns:86px minmax(90px,1fr) 86px;padding:5px}.sk-fit .sk-doll .cl{display:grid;grid-template-columns:1fr 1fr;gap:3px}.sk-fit .sk-doll .bt{grid-template-columns:repeat(3,40px);gap:3px}.sk-fit .sk-doll .bd canvas{width:84px;height:90px}}'
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
  { const b2 = Wd.bridges[Wd.bq2]; if (b2 && b2.broken) for (const c of b2.cells) { const cx = c % Wd.W + .5, cy = ((c / Wd.W) | 0) + .5; if (hyp(wx - cx, wy - cy) < 1.2) { let best = null, bd = 1e9; for (const e of b2.ends) { const ex = e % Wd.W + .5, ey = ((e / Wd.W) | 0) + .5, dd = hyp(ex - P.x, ey - P.y); if (dd < bd) { bd = dd; best = [ex, ey]; } } P.path = best || [cx, cy]; return; } } }
  P.path = [wx, wy];
}
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; if (e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) { if (e.code === 'Escape') closePanel(); return; } if (KM[e.code]) { KEYS[KM[e.code]] = 1; e.preventDefault(); }
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
function cell(it, k, extra) { const r = it && !it.g ? ' r' + it.r : ''; return `<div class="sk-c${r}${it && it.st === -1 && it.id ? ' cu' : ''}${SEL === k ? ' on' : ''}" data-c="${k}">${extra || ''}${it ? '<span data-ic="' + k + '"></span>' : ''}${tameBar(it)}${it && it.n > 1 ? '<i>' + it.n + '</i>' : it && it.en ? '<i>+' + it.en + '</i>' : ''}</div>`; }
function fillIcons(map) { panel.querySelectorAll('[data-ic]').forEach(el => { const it = map(el.dataset.ic); if (it) el.replaceWith(iconCanvas(it, 40)); }); }
function itemCard(it, P, cmp) {
  if (!it) return ''; const b = it.g ? null : BASE[it.b], L = [];
  L.push(`<div class="n" style="color:${it.g ? '#5a3e22' : shade(itemColor(it))}">${esc(itemName(it))}</div>`);
  if (it.g) { L.push(`<div class="m">${esc(GOODS[it.g].d)}</div>`); return '<div class="sk-card">' + L.join('') + '</div>'; }
  L.push(`<div class="m">${RAR[it.r].n} · ${SLOTN[b.s === 'ring' ? 'ring1' : b.s]}${b.cls ? ' · ' + CLASSES[b.cls].name + ' 전용' : ''} · ${b.lv}레벨 · 무게 ${weightOf({ ...it, n: 1 })}${it.n > 1 ? ' · ' + it.n + '개 묶음' : ''}</div>`);
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
function shade(c) { const r = RAR.find(r => r.c === c); return r ? r.d : c; }
function slotFor(P, it) { const s = BASE[it.b].s; if (s === 'ring') return !P.eq.ring1 ? 'ring1' : !P.eq.ring2 ? 'ring2' : 'ring1'; return s; }
function equip(i) { const P = G.P, it = P.inv[i], why = canWear(P, it); if (why) { toast(why); return; } const s = slotFor(P, it), old = P.eq[s]; if (old && old.st === -1 && old.id) { toast('저주받은 장비는 정화하기 전에 벗을 수 없어요'); return; } P.inv.splice(i, 1); if (old) P.inv.push(old); P.eq[s] = it; if (it.st === -1) it.id = true; calc(P); }
function unequip(s) { const P = G.P, it = P.eq[s]; if (!it) return; if (it.st === -1 && it.id) { toast('저주받은 장비는 정화하기 전에 벗을 수 없어요'); return; } if (P.inv.length >= INV_MAX || bagWeight(P) + weightOf(it) > bagCap(P) * 1.5) { toast('가방이 가득 찼어요'); return; } P.inv.push(it); delete P.eq[s]; calc(P); }
let toastT = 0; function toast(s) { const t = panel.querySelector('.sk-toast'); if (t) { t.textContent = s; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; }, 1800); } else if (G) say(s, '#fff', 1); }
const TOAST = '<div class="sk-toast" style="position:sticky;bottom:0;margin-top:8px;background:#5a3e22;color:#fff;border-radius:10px;padding:7px 10px;font-size:13px;opacity:0;transition:opacity .3s;text-align:center">.</div>';
function render(arg) {
  const P = G && G.P, k = PANEL; let h = '';
  const X = '<button class="sk-x" data-a="x" aria-label="닫기">✕</button>';
  if (k === 'inv') {
    const sel = SEL, si = sel && sel[0] === 'i' ? +sel.slice(1) : -1, ss = sel && sel[0] === 'e' ? sel.slice(1) : null, it = si >= 0 ? P.inv[si] : ss ? P.eq[ss] : null;
    h = `<div class="sk-bx sk-fit">${X}<h3>가방 <small style="font-size:12px;color:#8a7458">${P.gold.toLocaleString()}G · ${P.inv.length}칸 · ${bagWeight(P) > bagCap(P) ? '<b style="color:#d0402a">무게 ' + bagWeight(P) + '/' + bagCap(P) + ' · 무거워서 걸음이 느려요</b>' : '무게 ' + bagWeight(P) + '/' + bagCap(P)}${SHOP ? ' · 상점: 물건을 눌러 팔기' : ''}</small></h3><div class="sk-two"><div><h4>입은 장비</h4><div class="sk-eq">${SLOTS.map(([s, n]) => cell(P.eq[s], 'e' + s, '<b>' + n + '</b>')).join('')}</div><h4>가방</h4><div class="sk-grid">${[...Array(P.inv.length > INV_N ? INV_MAX : INV_N)].map((_, i) => cell(P.inv[i], 'i' + i)).join('')}</div></div><div>`;
    if (it) { const cmp = si >= 0 && !it.g ? P.eq[slotFor(P, it)] : null; let acts = '';
      if (si >= 0) { if (it.g === 'pot' || it.g === 'wpot') acts += `<button class="sk-b g" data-a="use">마시기</button>`; if (!it.g) acts += `<button class="sk-b p" data-a="eq">입기</button>`; if (it.g === 'look') acts += '<p class="m" style="font-size:11.5px">감정 안 된 장비를 고른 뒤 「쪽지로 감정」</p>'; if (!it.g && !it.id && count('look')) acts += `<button class="sk-b" data-a="lookit">쪽지로 감정</button>`; if (it.g === 'pure' || !it.g && it.st === -1 && count('pure')) acts += ''; if (SHOP) acts += `<button class="sk-b" data-a="sell">팔기 ${priceOf(it)}G</button>`; else acts += `<button class="sk-b" data-a="drop">내려놓기</button>`; }
      else acts += `<button class="sk-b" data-a="uneq">벗기</button>` + (it.st === -1 && count('pure') ? `<button class="sk-b g" data-a="purify">샘물로 정화</button>` : '');
      h += '<div class="sk-acts">' + acts + '</div>' + (cmp ? `<div class="sk-cmp"><div><div class="m">고른 것</div>${itemCard(it, P)}</div><div><div class="m">지금 낀 것</div>${itemCard(cmp, P)}</div></div>` : itemCard(it, P)); } else h += '<p class="m" style="font-size:12.5px;color:#8a7458">물건을 누르면 자세히 보여요. 같은 부위 장비와 비교해 줘요.</p>';
    if (SHOP) h += shopHtml(); h += '</div></div>' + TOAST + '</div>';
  } else if (k === 'char') {
    const ss = SEL && SEL[0] === 'e' ? SEL.slice(1) : null, it = ss ? P.eq[ss] : null, sl = q => cell(P.eq[q], 'e' + q, '<b>' + SLOTN[q] + '</b>');
    h = `<div class="sk-bx sk-fit" style="max-width:820px">${X}<h3>캐릭터 <small style="font-size:12px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 방어력 ${P.ac} · 생명력 ${P.mhp}</small></h3><div class="sk-two"><div>
      <div class="sk-doll"><div class="cl">${['helm', 'ear', 'amulet', 'armor', 'inner', 'gloves'].map(sl).join('')}</div><div class="bd"><span data-po="${P.cls}"></span><b>${CLASSES[P.cls].name}</b><small style="color:#8a7458;font-size:11px">이음꾼 · ${P.lv}레벨</small></div><div class="cl">${['cloak', 'belt', 'legs', 'boots', 'ring1', 'ring2'].map(sl).join('')}</div><div class="bt">${['weapon', 'off', 'sail'].map(sl).join('')}</div></div>
      <p class="m sk-hd" style="font-size:11.5px;color:#8a7458;margin:6px 2px">칸을 누르면 자세히 보여요. 갈아입기는 가방(I)에서 해요.</p></div><div>`;
    if (it) h += itemCard(it, P) + `<button class="sk-b" data-a="uneq">벗기</button>` + (it.st === -1 && count('pure') ? `<button class="sk-b g" data-a="purify">샘물로 정화</button>` : '') + `<button class="sk-b" data-a="nosel">능력 보기</button>`;
    else { h += `<h4 style="margin-top:0">능력 <small style="color:#8a7458">남은 점수 ${P.pts}</small></h4>`;
      h += '<div class="sk-stg">'; for (const [s2, n, d] of STATS) h += `<div class="sk-row"><div class="f"><b>${n}</b> ${P.st[s2]} <small class="sk-hd">(${CLASSES[P.cls].stat[s2]} + 올림 ${P.sp[s2] || 0})</small><br class="sk-hd"><small class="sk-hd">${d}</small></div><button class="sk-b" data-a="st" data-s="${s2}" ${P.pts ? '' : 'disabled'}>+1</button></div>`;
      const big = P.dmg; h += `</div><h4>지금 수치</h4><div class="sk-card">생명력 ${P.mhp} · 바람 ${P.mwind} (초당 +${P.wreg.toFixed(1)})<br>피해: 작은 적 ${big[0]}~${big[1]} / 큰 적 ${big[2]}~${big[3]} · 피해 +${Math.round(P.dmgp)}%<br>방어력 ${P.ac} (맞을 확률 ${Math.round(clamp(.92 - P.ac * .008, .55, .95) * 100)}%)${P.blk ? ' · 막기 ' + Math.round(P.blk) + '%' : ''}<br>공격 속도 초당 ${P.aspd.toFixed(2)}번 · 치명타 ${P.crit.toFixed(1)}% · 이동 ${P.move.toFixed(1)}<br>돛: 활공 ${P.sail[0]}칸 / ${P.sail[1]}초${P.find ? ' · 좋은 물건 +' + P.find + '%' : ''}${P.xpm > 1 ? ' · 경험치 +' + Math.round((P.xpm - 1) * 100) + '%' : ''}<br>쓰러뜨린 밑것들 ${P.kills}마리 · 경험 ${P.xp}/${xpNeed(P.lv)}</div>${respecBtn('rs')}`; }
    h += '</div></div>' + TOAST + '</div>';
  } else if (k === 'map') {
    h = `<div class="sk-bx sk-map" style="max-width:900px">${X}<h3>지도 <small style="font-size:12px;color:#8a7458">${CHAPS[G.Wd.ch][0].replace(' · ', ' ')}</small></h3><canvas data-map></canvas><div class="sk-lg"><span><i style="background:#fff;border:2px solid #3a5a7a"></i>나</span><span><i style="background:#ffd166"></i>마을 사람</span><span><i style="background:#9fe4ff"></i>바람개비 표지</span><span><i style="background:#ff6a4a"></i>할 일 목표</span><span><i style="background:#c8a070"></i>다리</span></div></div>`;
  } else if (k === 'skill') {
    const sel = SEL; h = `<div class="sk-bx sk-fit">${X}<h3>스킬 <small style="font-size:12px;color:#8a7458">남은 점수 <b style="color:#3a7fa8">${P.skp}</b> · 같은 갈래끼리 점수당 피해 +6%</small></h3><div class="sk-two sk-skw"><div><div style="margin:-2px -3px 4px"><button class="sk-b p" data-a="board" ${P.lv >= BOARD_LV ? '' : 'disabled'}>◆ 나침반판 (B)${P.lv >= BOARD_LV ? '' : ' · ' + lvT(BOARD_LV)}</button>${respecBtn('rk')}</div><div class="sk-sk">`;
    BRANCH[P.cls].forEach((bn, bi) => { h += `<div class="sk-br"><h4>${bn}</h4>`; for (const s of SKILLS[P.cls].filter(q => q.br === bi)) { const lv = P.sk[s.id] || 0, lk = P.lv < s.req; h += `<div class="sk-s${sel === s.id ? ' on' : ''}" data-sk="${s.id}"><span data-si="${s.id}"></span><div class="f ${lk ? 'lk' : ''}"><b>${s.name}</b><br>${lv}/10${P.skb[bi] && lv ? ' (+' + P.skb[bi] + ')' : ''}${lk ? ' · ' + lvT(s.req) : ''}${P.slots.includes(s.id) ? ' · <b style="color:#3a7fa8">' + (P.slots.indexOf(s.id) + 1) + '번</b>' : ''}</div></div>`; } h += '</div>'; });
    h += '</div>'; { const U = ULT[P.cls], on = P.lv >= U.req; h += `<div class="sk-ult"><b style="color:#b0702a">궁극 · ${U.name}</b> ${on ? '<small style="color:#3a7fa8">익힘 · 4번 칸</small>' : '<small style="color:#a88a5a">' + lvT(U.req) + '에 저절로</small>'} <small>· ${U.cd}초</small><span class="sk-hd"><br>${esc(U.desc)}</span></div>`; }
    h += '</div><div class="sk-skd">';
    const s = sel && SKILLS[P.cls].find(q => q.id === sel);
    if (s) { const lv = P.sk[s.id] || 0; h += `<div class="sk-card"><b style="font-size:14px">${s.name}</b> ${lv}/10${P.lv < s.req ? ' · ' + lvT(s.req) + '부터' : ''}<br>${esc(s.desc)}<br><small style="color:#8a7458">바람 ${s.cost} · 다시 쓰기 ${s.cd}초</small></div><div style="margin:4px -3px 0">`;
      h += `<button class="sk-b g" data-a="learn" ${P.skp && lv < 10 && P.lv >= s.req ? '' : 'disabled'}>배우기 +1</button> `; if (lv) h += [0, 1, 2, 3].filter(i => P.slots[i] !== 'ult').map(i => `<button class="sk-b${P.slots[i] === s.id ? ' p' : ''}" data-a="slot" data-i="${i}">${i + 1}번 칸</button>`).join('');
      h += `</div><h4>갈래 고르기 (스킬 5레벨)</h4>` + s.fork.map((f, i) => `<button class="sk-b fk${P.fork[s.id] === i ? ' p' : ''}" data-a="fork" data-i="${i}" ${lv >= 5 && P.fork[s.id] == null ? '' : 'disabled'}><b>${f[0]}</b> — ${esc(f[1])}</button>`).join('') + (P.fork[s.id] != null ? '<p class="m" style="font-size:11px">갈래는 다시 나누기로만 바꿀 수 있어요.</p>' : '');
      h += `<h4>두 번째 갈래 (스킬 10레벨)</h4>` + fork2Of(s).map((f, i) => `<button class="sk-b fk${P.fork2[s.id] === i ? ' p' : ''}" data-a="fork2" data-i="${i}" ${lv >= 10 && P.fork2[s.id] == null ? '' : 'disabled'}><b>${f[0]}</b> — ${esc(f[1])}</button>`).join(''); }
    else h += '<p style="font-size:12.5px;color:#8a7458;margin:4px 0">왼쪽 스킬을 누르면 설명·배우기·칸 놓기·갈래 고르기가 여기 나와요.</p>';
    h += '</div></div>' + TOAST + '</div>';
  } else if (k === 'board') h = boardHtml();
  else if (k === 'daily') h = dailyHtml(X);
  else if (k === 'stash') h = stashHtml(X);
  else if (k === 'talk') h = talkHtml(arg);
  else if (k === 'smith') h = smithHtml();
  else if (k === 'travel') { h = `<div class="sk-bx" style="max-width:420px">${X}<h3>바람개비 표지</h3>${G.Wd.wps.map((w, i) => `<div class="sk-row"><div class="f"><b>${w.n}</b></div><button class="sk-b p" data-a="go" data-i="${i}" ${w.on ? '' : 'disabled'}>${w.on ? '날아가기' : '아직 잠김'}</button></div>`).join('')}${chapHtml()}${roamHtml()}</div>`; }
  else if (k === 'quest') { h = `<div class="sk-bx" style="max-width:560px">${X}<h3>할 일</h3>`; for (const id in QUESTS) { const q = P.q[id], Q = QUESTS[id]; if (!q) continue; h += `<div class="sk-row"><div class="f"><b>${Q.n}</b> ${q.s === 3 ? '✔' : q.s === 2 ? '(보고하기)' : ''}<br><small>${esc(Q.goal)} — ${NPCDEF[Q.from].n}</small></div></div>`; } h += '</div>'; }
  else if (k === 'menu') { h = `<div class="sk-bx" style="max-width:420px;text-align:center">${X}<h3>잠깐 쉬기</h3><button class="sk-b p" data-a="x">계속하기</button><br><button class="sk-b" data-a="quest">할 일 보기</button><br><button class="sk-b" data-a="rank">🏆 순위</button><br><button class="sk-b" data-a="mute">${A.muted ? '소리 켜기' : '소리 끄기'}</button><br><button class="sk-b" data-a="lang">🌐 ${LANG === 'en' ? '한국어' : 'English'}</button><br><button class="sk-b" data-a="fb" data-w="menu">💬 베타 의견 보내기</button><br><button class="sk-b" data-a="help">조작법</button><br><button class="sk-b" data-a="title">저장하고 처음 화면으로</button><br><button class="sk-b" data-a="quit">저장하고 나가기</button><p class="m" style="font-size:11.5px;color:#8a7458;margin-top:8px">기록은 10초마다, 그리고 창을 닫을 때 이 기기에 저장돼요.</p></div>`; }
  else if (k === 'help') { h = `<div class="sk-bx" style="max-width:600px">${X}<h3>조작법</h3><div class="sk-card"><b>PC</b><br>마우스 왼쪽: 이동 (누르고 있으면 따라가요 · 사람·표지·다리를 누르면 가서 말 걸기)<br>마우스 오른쪽: 공격 (누르고 있으면 계속 · 적을 누르면 다가가서 공격)<br>1~4: 기술 (마우스 쪽으로 · 4번은 궁극 기술) · Q 민들레 차 · R 바람 사탕 · 스페이스 돛 활공(피하기)<br>I 가방 · C 캐릭터 · S 기술 · M 지도 · B 나침반판 · J 할 일 · F 말 걸기 · Esc 쉬기<br><br><b>휴대폰</b> (가로 화면)<br>왼쪽 아무 곳이나 끌어서 이동 · 오른쪽 큰 버튼 공격(누르고 있으면 계속, 가까운 적을 알아서 노려요) · 둘레 버튼 기술 4개(금색 테두리가 궁극 기술) · 돛·차·사탕 버튼 · 사람이나 물건을 톡 누르면 그쪽으로 가요.<br><br><b>요령</b>: 방패지기는 적을 섬 끝으로 밀어 떨어뜨릴 수 있어요(보상은 조금 줄어요). 쉬고 돌아오면 순풍(경험치 2배)이 쌓여 있어요.</div></div>`; }
  else if (k === 'end') h = endHtml().replace('<button class="sk-b p" data-a="x">', '<button class="sk-b g" data-a="fb" data-w="end">💬 이 장 어땠어요?</button> <button class="sk-b p" data-a="x">');
  else if (k === 'fb') h = fbHtml(X);
  else if (k === 'rank') h = rankHtml(X);
  panel.innerHTML = h; bindPanel(arg);
  if (k === 'inv') fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : c[0] === 'i' ? P.inv[+c.slice(1)] : c[0] === 'b' ? SHOP[+c.slice(1)] : null);
  if (k === 'stash') fillIcons(c => c[0] === 'i' ? P.inv[+c.slice(1)] : c[0] === 's' ? (P.stash || [])[+c.slice(1)] : null);
  if (k === 'char') { fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : null); panel.querySelectorAll('[data-po]').forEach(el => el.replaceWith(portrait(el.dataset.po, 150))); }
  if (k === 'map') drawMap(panel.querySelector('[data-map]'));
  if (k === 'board') CONF = null;
  if (k === 'smith') fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : P.inv[+c.slice(1)]);
  if (k === 'skill') panel.querySelectorAll('[data-si]').forEach(el => { const s = SKILLS[P.cls].find(q => q.id === el.dataset.si), c = document.createElement('canvas'), d = 2; c.width = c.height = 42 * d; const g = c.getContext('2d'); g.scale(d, d); drawSkillIcon(g, s, 0, 0, 42, P.cls); el.replaceWith(c); });
}
let CONF = null; // 한 번 더 눌러 확인
const respecCost = P => 30 * P.lv;
function respecBtn(kind) { const P = G.P, free = !P.flags[kind], cost = respecCost(P), what = kind === 'rs' ? '능력 점수' : '스킬 점수';
  return `<button class="sk-b${CONF === kind ? ' p' : ''}" data-a="respec" data-k="${kind}" ${free || P.gold >= cost ? '' : 'disabled'}>${CONF === kind ? '정말 다시 나눌까요? 한 번 더 누르세요' : '<span class="sk-hd">' + what + ' </span>다시 나누기 (' + (free ? '무료 1번' : cost + 'G') + ')'}</button>`; }
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
function shopHtml() { const td = SHOP.filter(it => it.today), jk = G.P.inv.filter(it => !it.g && it.r === 0), jg = jk.reduce((a, it) => a + priceOf(it) * (it.n || 1), 0); return `<h4>얼레의 물건 <small style="color:#8a7458">(누르면 사기 · 자정에 물건이 바뀌어요)</small></h4>${td.length ? '<p class="m" style="font-size:11.5px;color:#b0702a">오늘만: ' + td.map(it => it.g ? GOODS[it.g].n : itemName(it)).join(', ') + '</p>' : ''}<div class="sk-grid">${SHOP.map((it, i) => cell(it, 'b' + i)).join('')}</div>` + (SEL && SEL[0] === 'b' ? itemCard(SHOP[+SEL.slice(1)], G.P, null) + `<button class="sk-b g" data-a="buy">사기 ${buyPrice(SHOP[+SEL.slice(1)])}G</button>` : '') + (jk.length ? `<h4>한꺼번에 팔기</h4><button class="sk-b" data-a="selljunk">보통 장비 ${jk.length}개 팔기 (+${jg}G)</button>` : '') + coinHtml(); }
function coinHtml() { const B = opts.bonus; if (!B) return ''; const day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10), used = G.P.flags.coinDay === day ? G.P.flags.coinN || 0 : 0; return `<h4>5락실 코인 바꾸기</h4><p class="m" style="font-size:11.5px;color:#8a7458">코인 1개 = 200G, 하루 5개까지 (보유 ${B.coins()}개, 오늘 ${used}/5)</p><button class="sk-b" data-a="coin" ${B.coins() > 0 && used < 5 ? '' : 'disabled'}>🪙 1개 → 200G</button>`; }
const buyPrice = it => it.pr ? it.pr : it.g ? GOODS[it.g].price : priceOf(it) * 4;
function talkHtml(id) {
  const P = G.P, N = NPCDEF[id]; let lines = [], btns = [];
  const q = qid => P.q[qid];
  const offer = qid => { const Q = QUESTS[qid]; lines = Q.talk; btns.push(`<button class="sk-b p" data-a="accept" data-q="${qid}">맡을게요</button>`); };
  const finish = qid => { lines = QUESTS[qid].done; btns.push(`<button class="sk-b g" data-a="finish" data-q="${qid}">보상 받기</button>`); };
  if (G.Wd.ch >= 2) { const r = (G.Wd.ch >= 4 ? talkX : G.Wd.ch === 3 ? talk3 : talk2)(id, offer, finish); if (r.lines) lines = r.lines; btns.push(...r.btns); }
  else {
  if (id === 'chief') { if (!q('q1')) offer('q1'); else if (q('q1').s === 2) finish('q1'); else if (q('q1').s === 3 && !q('q3')) offer('q3'); else if (q('q3') && q('q3').s === 2 && P.flags[wpk('바람개비 언덕')]) finish('q3'); else if (q('q3') && q('q3').s === 2) lines = ['우두머리를 쓰러뜨렸다고? 언덕의 바람개비 표지에 손을 얹어 주게. 그래야 바람이 섬에 돌아오네.']; else if (q('q3') && q('q3').s === 3 && !q('q5')) offer('q5'); else if (q('q5') && q('q5').s === 2) finish('q5'); else if (q('q5') && q('q5').s === 1) lines = ['둥지 껍질은 들판과 늪의 둥지지기가 떨군다네. 세 개 모아 바람개비 언덕 동쪽 끊긴 다리로 가게.']; else if (q('q5') && q('q5').s === 3 && !q('q7')) offer('q7'); else if (q('q7') && q('q7').s === 2 && P.flags[wpk('둥지섬')]) finish('q7'); else if (q('q7') && q('q7').s === 2) lines = ['큰 왜가리를 쓰러뜨렸다고?! 둥지섬 바람개비 표지에 손을 얹어 주게. 바람이 돌아오게.']; else if (q('q7') && q('q7').s === 1) lines = ['둥지섬은 갈대 늪 맨 끝일세. 녀석이 성나면 하늘에서 깃털이 쏟아진다니 붉은 자리를 피하게.']; else if (q('q7') && q('q7').s === 3) lines = ['민들레 섬이 더는 가라앉지 않네. 이음꾼, 정말 고맙네.', '바람개비 표지에 녹슨 풍차 군도로 가는 바람길이 열렸네. 준비되면 건너가 보게.']; else lines = ['널빤지는 들판 밑것들이 물고 다닌다네. 다리는 마을 동쪽 들판 너머, 맨 위쪽 섬 끝에 있지.']; }
  if (id === 'sage') { if (!q('q2')) offer('q2'); else if (q('q2').s === 2) finish('q2'); else if (P.flags.bridge2 && q('q2').s === 3 && !q('q6')) offer('q6'); else if (q('q6') && q('q6').s === 2) finish('q6'); else lines = ['큰바람은 원래 세상을 한 바퀴 돌면서 섬마다 숨을 불어넣었대. 그게 멎었으니 뜸돌도 잠들어 가는 거야.', '감정 안 된 물건이 있으면 보여 줘. 하나에 15G면 봐 줄게.'];
    const n = P.inv.filter(it => !it.g && !it.id).length; btns.push(`<button class="sk-b" data-a="ident" ${n && P.gold >= 15 ? '' : 'disabled'}>감정하기 (${n}개 · 개당 15G)</button>`); }
  if (id === 'smith') { if (!q('q4')) offer('q4'); else if (q('q4').s === 1 && count('hone') >= 3) { lines = ['오, 숫돌 세 개 가져왔구나!']; btns.push(`<button class="sk-b g" data-a="finish" data-q="q4">숫돌 건네기</button>`); } else lines = ['강화든 옵션 다시 굴리기든 맡겨. 무기는 +6, 방어구는 +4까지 안전해.']; btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); }
  if (id === 'merchant') { lines = ['어서 와. 다리가 끊겨서 나도 이 섬에 발이 묶였지 뭐야. 필요한 거 있어?']; btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); }
  }
  return `<div class="sk-bx sk-talk"><button class="sk-x" data-a="x">✕</button><div class="who">${N.n}</div>${lines.map(l => '<p>' + esc(l) + '</p>').join('')}<div>${btns.join('')}<button class="sk-b" data-a="x">닫기</button></div>${TOAST}</div>`;
}
function smithHtml() {
  const P = G.P, sel = SEL, it = sel ? (sel[0] === 'e' ? P.eq[sel.slice(1)] : P.inv[+sel.slice(1)]) : null;
  let h = `<div class="sk-bx"><button class="sk-x" data-a="x">✕</button><h3>${NPCDEF.smith.n.replace('대장장이 ', '')}의 대장간 <small style="font-size:12px;color:#8a7458">숫돌 ${count('hone')} · 아교 ${count('glue')} · 축복 숫돌 ${count('bhone')} · 축복 아교 ${count('bglue')} · ${P.gold}G</small></h3><div class="sk-two"><div><h4>입은 장비</h4><div class="sk-eq">${SLOTS.map(([s, n]) => cell(P.eq[s], 'e' + s, '<b>' + n + '</b>')).join('')}</div><h4>가방</h4><div class="sk-grid">${P.inv.map((x2, i) => x2.g ? '' : cell(x2, 'i' + i)).join('')}</div></div><div>`;
  if (it && !it.g) { const kind = encKind(BASE[it.b]); h += itemCard(it, P);
    if (kind) { const next = it.en + 1, safe = next <= SAFE[kind], rate = safe ? 1 : (ENCH_RATE[kind][next] || 0); const mat = kind === 'weapon' ? ['hone', 'bhone'] : ['glue', 'bglue'];
      h += `<h4>강화 (+${it.en} → +${next}) · 성공 ${Math.round(rate * 100)}%${safe ? ' · 안전' : ' · 실패하면 한 단계 내려감'}</h4><button class="sk-b p" data-a="ench" data-m="${mat[0]}" ${count(mat[0]) && it.en < MAXENCH ? '' : 'disabled'}>${GOODS[mat[0]].n}로 강화</button><button class="sk-b g" data-a="ench" data-m="${mat[1]}" ${count(mat[1]) && it.en < MAXENCH ? '' : 'disabled'}>${GOODS[mat[1]].n}로 강화</button>`; }
    else h += '<p class="m" style="font-size:12px">장신구는 강화할 수 없어요.</p>';
    { const sv = sel[0] === 'i' && salvageOf(it); if (sv) h += `<h4>분해하기</h4><p class="m" style="font-size:11.5px">이 장비를 부숴서 ${GOODS[sv[0]].n} ${sv[1]}개로 바꿔요. 되돌릴 수 없어요.</p><button class="sk-b" data-a="salv">분해하기</button>`; }
    if ((it.r === 1 || it.r === 2) && it.id) { const cost = 40 + it.ilv * 15, mat = kind === 'weapon' ? 'hone' : 'glue'; h += `<h4>옵션 다시 굴리기</h4><p class="m" style="font-size:11.5px">무작위 옵션 하나를 새로 굴려요. ${cost}G${kind ? ' + ' + GOODS[mat].n + ' 1' : ''}</p><button class="sk-b" data-a="reroll" ${P.gold >= cost && (!kind || count(mat)) ? '' : 'disabled'}>다시 굴리기</button>`; }
  } else h += '<p style="font-size:12.5px;color:#8a7458">강화하거나 옵션을 다시 굴릴 장비를 고르세요.<br>무기 +6 · 방어구 +4까지는 100% 성공, 그 위는 실패하면 한 단계 내려가요. 축복 받은 장비는 실패를 한 번 막아 줘요.</p>';
  return h + '</div></div>' + TOAST + '</div>';
}
function endHtml() { const P = G.P; if (G.Wd.ch >= 4) return endHtmlX(); if (G.Wd.ch === 3) return endHtml3(); if (G.Wd.ch === 2) return endHtml2(); if (P.q.q7 && P.q.q7.s === 3) return `<div class="sk-bx sk-talk" style="text-align:center"><h3>1장 「민들레 섬」 끝</h3><p>큰 왜가리의 날개 밑에 갇혀 있던 바람이 풀려나 섬 밑으로 스며들었다.</p><p>민들레 섬은 더는 가라앉지 않는다. 하지만 큰바람이 멎은 까닭은 아직 저 너머에 있다 — 녹슨 풍차 군도.</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>바람개비 표지(이동)의 「바람길」에서 2장 녹슨 풍차 군도로 건너갈 수 있어요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`;
  return `<div class="sk-bx sk-talk" style="text-align:center"><h3>1장 「민들레 섬」 앞부분 끝</h3><p>바람개비가 다시 돌기 시작했다. 아주 약하지만, 분명히 바람이다.</p><p>그런데 저 멀리 둥지섬 쪽 하늘에서 커다란 날개 그림자가 구름을 가르고 지나갔다…</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>촌장 들메에게 다시 말을 걸면 1장 뒷부분(갈대 늪·둥지섬)이 이어져요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }
function bindPanel(arg) {
  panel.onclick = e => {
    const t = e.target.closest('[data-a],[data-c],[data-sk]'); if (!t) { if (e.target === panel && PANEL !== 'title') closePanel(); return; }
    const P = G && G.P, a = t.dataset.a;
    if (a && a.startsWith('fb') && fbAct(a, t)) return;
    if (a && a.startsWith('rk') && rkAct(a, t)) return;
    if (a === 'rank') { openPanel('rank'); return; }
    if (t.dataset.c && PANEL === 'stash') { stashMove(t.dataset.c); render(arg); return; }
    if (t.dataset.c) { SEL = t.dataset.c; if (SEL[0] === 'b' && PANEL === 'inv') {} render(arg); return; }
    if (t.dataset.sk) { SEL = t.dataset.sk; render(); return; }
    if (SEL && SEL[0] === 'i' && ['eq', 'drop', 'sell', 'lookit', 'ench', 'reroll', 'salv'].includes(a)) SEL = 'i' + single(+SEL.slice(1));
    if (a === 'x') { closePanel(); if (PANEL === null && G && G.endNext) { G.endNext = 0; openPanel('end'); } return; }
    if (a === 'eq') { equip(+SEL.slice(1)); SEL = null; render(); }
    else if (a === 'uneq') { unequip(SEL.slice(1)); SEL = null; render(); }
    else if (a === 'nosel') { SEL = null; render(); }
    else if (a === 'use') { const it = P.inv[+SEL.slice(1)]; drink(it.g); if (!P.inv.includes(it)) SEL = null; render(); }
    else if (a === 'drop') { const it = P.inv.splice(+SEL.slice(1), 1)[0]; G.drops.push({ x: P.x + .4, y: P.y + .4, it, t: -1 }); SEL = null; render(); }
    else if (a === 'sell') { const i = +SEL.slice(1), it = P.inv[i]; P.gold += priceOf(it); P.inv.splice(i, 1); SEL = null; sfx('coin'); render(); }
    else if (a === 'buy') { const it = SHOP[+SEL.slice(1)], pr = buyPrice(it); if (P.gold < pr) { toast('골드가 모자라요'); return; } const c = it.g ? goods(it.g) : it; if (!addInv(c)) { toast('가방이 가득 찼어요'); return; } P.gold -= pr; if (!it.g || it.sk) { shopBought(it); SHOP.splice(SHOP.indexOf(it), 1); SEL = null; } sfx('coin'); render(); }
    else if (a === 'selljunk') { let g = 0; P.inv = P.inv.filter(it => { if (!it.g && it.r === 0) { g += priceOf(it) * (it.n || 1); return false; } return true; }); P.gold += g; SEL = null; sfx('coin'); render(); toast(g + 'G 받았어요'); }
    else if (a === 'coin') { const B = opts.bonus, day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10); if (P.flags.coinDay !== day) { P.flags.coinDay = day; P.flags.coinN = 0; } if (P.flags.coinN >= 5 || !B.spend(1)) return; P.flags.coinN++; P.gold += 200; sfx('coin'); render(); }
    else if (a === 'lookit') { const it = P.inv[+SEL.slice(1)]; if (useGood('look')) { it.id = true; sfx('ench'); SEL = 'i' + P.inv.indexOf(it); } render(); }
    else if (a === 'purify') { const it = P.eq[SEL.slice(1)]; if (useGood('pure')) { it.st = 0; calc(P); sfx('ench'); toast('정화했어요'); } render(); }
    else if (a === 'st') { if (P.pts > 0) { P.pts--; P.sp[t.dataset.s] = (P.sp[t.dataset.s] || 0) + 1; calc(P); } render(); }
    else if (a === 'learn') { const s = SKILLS[P.cls].find(q => q.id === SEL); if (P.skp > 0 && P.lv >= s.req && (P.sk[s.id] || 0) < 10) { P.skp--; P.sk[s.id] = (P.sk[s.id] || 0) + 1; autoSlots(P); if (P.sk[s.id] === 5) toast('5레벨! 갈래를 고를 수 있어요'); if (P.sk[s.id] === 10) toast('10레벨! 두 번째 갈래를 고를 수 있어요'); } render(); }
    else if (a === 'fork2') { const s = SKILLS[P.cls].find(q => q.id === SEL); if ((P.sk[s.id] || 0) >= 10 && P.fork2[s.id] == null) { P.fork2[s.id] = +t.dataset.i; toast('「' + fork2Of(s)[+t.dataset.i][0] + '」 갈래를 골랐어요'); } render(); }
    else if (a === 'dclaim') { claimTask(+t.dataset.i); render(); }
    else if (a === 'errs') { errandSend(+t.dataset.i); render(); }
    else if (a === 'errc') { errandClaim(); render(); }
    else if (a === 'salv') { if (SEL && SEL[0] === 'i') { salvage(+SEL.slice(1)); SEL = null; render(); } }
    else if (a === 'slot') { const i = +t.dataset.i, o = P.slots.indexOf(SEL); if (o >= 0) P.slots[o] = P.slots[i]; P.slots[i] = SEL; render(); }
    else if (a === 'fork') { const s = SKILLS[P.cls].find(q => q.id === SEL); if ((P.sk[s.id] || 0) >= 5 && P.fork[s.id] == null) { P.fork[s.id] = +t.dataset.i; toast('「' + s.fork[+t.dataset.i][0] + '」 갈래를 골랐어요'); } render(); }
    else if (a === 'chap') { goChapter(+t.dataset.i); return; }
    else if (a === 'diff') { setDiff(+t.dataset.i); return; }
    else if (a === 'roam') { roamOpen(); return; }
    else if (a === 'go') { const w = G.Wd.wps[+t.dataset.i]; P.x = w.x + .8; P.y = w.y + .8; G.cam = [P.x, P.y]; closePanel(); sfx('dodge'); }
    else if (a === 'accept') { qSet(t.dataset.q, 1); toast('「' + QUESTS[t.dataset.q].n + '」을(를) 맡았어요'); closePanel(); }
    else if (a === 'finish') finishQuest(t.dataset.q);
    else if (a === 'ident') { let n = 0; for (const it of P.inv) if (!it.g && !it.id && P.gold >= 15) { P.gold -= 15; it.id = true; n++; } toast(n + '개 감정했어요'); sfx('ench'); render(arg); }
    else if (a === 'smith') { PANEL = 'smith'; SEL = null; render(); }
    else if (a === 'shop') { PANEL = 'inv'; SHOP = shopFresh(); SEL = null; render(); }
    else if (a === 'ench') { const it = SEL[0] === 'e' ? P.eq[SEL.slice(1)] : P.inv[+SEL.slice(1)], m = t.dataset.m; if (!count(m)) return; const r = enchant(it, m); if (!r.ok) { toast(r.msg); return; } useGood(m); calc(P); render(); toast(r.msg); forgeEnch(it, r); }
    else if (a === 'reroll') { const it = SEL[0] === 'e' ? P.eq[SEL.slice(1)] : P.inv[+SEL.slice(1)], kind = encKind(BASE[it.b]), cost = 40 + it.ilv * 15; if (P.gold < cost) return; if (kind && !useGood(kind === 'weapon' ? 'hone' : 'glue')) return; P.gold -= cost; const i = reroll(it); calc(P); render(); if (i === false) toast('바뀌지 않았어요'); else { const tx = afxText(it.af[i][0], it.af[i][1], P.cls); toast('새 옵션: ' + tx); forgeFx(it, 'reroll', '새 옵션!', tx); } }
    else if (a === 'respec') { const kd = t.dataset.k; if (CONF === kd) { CONF = null; doRespec(kd); } else CONF = kd; render(); }
    else if (a === 'board') { PANEL = 'board'; SEL = null; render(); }
    else if (a === 'skillp') { PANEL = 'skill'; SEL = null; render(); }
    else if (a === 'tr') { const k2 = 't' + t.dataset.i; if (SEL && SEL[0] === 'b') { const bi = +SEL.slice(1), ti = +t.dataset.i, o = P.board[bi]; P.board[bi] = P.shd[ti]; P.shd.splice(ti, 1); if (o) P.shd.push(o); SEL = null; calc(P); sfx('pick'); } else SEL = SEL === k2 ? null : k2; render(); }
    else if (a === 'hx') { const i = +t.dataset.i, B = P.board; if (SEL && SEL[0] === 't') { const ti = +SEL.slice(1), o = B[i]; B[i] = P.shd[ti]; P.shd.splice(ti, 1); if (o) P.shd.push(o); SEL = null; calc(P); sfx('pick'); }
      else if (SEL && SEL[0] === 'b' && SEL !== 'b' + i) { const j = +SEL.slice(1); [B[i], B[j]] = [B[j], B[i]]; SEL = null; calc(P); sfx('pick'); } else SEL = B[i] || SEL === 'b' + i ? (SEL === 'b' + i ? null : 'b' + i) : null; render(); }
    else if (a === 'unhx') { const i = +SEL.slice(1); if (P.board[i] && P.shd.length < SHD_MAX) { P.shd.push(P.board[i]); P.board[i] = null; calc(P); } SEL = null; render(); }
    else if (a === 'merge') { const c = t.dataset.k.slice(0, -1), q = +t.dataset.k.slice(-1); let n = 0; P.shd = P.shd.filter(sh => { if (n < 3 && sh.c === c && sh.q === q) { n++; return false; } return true; }); if (n === 3) { P.shd.push({ c, q: q + 1 }); sfx('ench'); toast(SHARD[c].n + ' ' + SHQ[q + 1] + '을 만들었어요'); } SEL = null; render(); }
    else if (a === 'quest') { PANEL = 'quest'; render(); } else if (a === 'help') { PANEL = 'help'; render(); }
    else if (a === 'lang') { save(); cloudFlush(); location.href = LANG === 'en' ? '/games/sky' : '/en/sky'; }
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
  for (const s2 of Wd.islands) if (s2.name) lab(s2, s2.name);
  if (G.today != null) { const s2 = Wd.islands[G.today], [a, b] = M(s2.cx, s2.cy - s2.r * .9); g.font = '800 11px system-ui'; g.fillStyle = '#c07a10'; g.strokeText('★ 오늘의 섬', a, b + 14); g.fillText('★ 오늘의 섬', a, b + 14); }
  if (G.chest) { const [a, b] = M(G.chest.x, G.chest.y); g.fillStyle = '#ffd166'; g.strokeStyle = '#7a5a20'; g.lineWidth = 1.5; g.fillRect(a - 5, b - 4, 10, 8); g.strokeRect(a - 5, b - 4, 10, 8); }
  if (Wd.signAt && P.daily) { const [a, b] = M(...Wd.signAt); g.fillStyle = '#e8b05a'; g.strokeStyle = '#7a5a20'; g.lineWidth = 1.2; g.fillRect(a - 4, b - 4, 8, 8); g.strokeRect(a - 4, b - 4, 8, 8); }
  for (const k2 in Wd.npcAt) { const [a, b] = M(...Wd.npcAt[k2]); g.fillStyle = '#ffd166'; g.strokeStyle = '#7a5a20'; g.lineWidth = 1.2; g.beginPath(); g.arc(a, b, 4, 0, TAU); g.fill(); g.stroke(); }
  for (const wp of Wd.wps) { const [a, b] = M(wp.x, wp.y); g.fillStyle = wp.on ? '#9fe4ff' : '#c8c0b0'; g.strokeStyle = '#3a5a7a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a, b - 7); g.lineTo(a + 5, b); g.lineTo(a, b + 7); g.lineTo(a - 5, b); g.closePath(); g.fill(); g.stroke(); }
  // 할 일 목표
  const goals = []; const q = P.q; const bq = Wd.bridges[Wd.bq];
  if (Wd.ch === 3) ch3Goals(Wd, P, goals);
  if (Wd.ch >= 4) chXGoals(Wd, P, goals);
  else if (Wd.ch === 2) { if (q.q9 && q.q9.s === 1) { const i = bq.cells[bq.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
    if (q.q12 && q.q12.s === 1) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); }
    if (q.q12 && q.q12.s === 2 && !P.flags[wpk('큰 풍차섬')]) goals.push([Wd.wps[2].x, Wd.wps[2].y]); }
  else {
  if (q.q1 && q.q1.s === 1) { const i = bq.cells[bq.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
  if (q.q3 && q.q3.s === 1) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); }
  if (q.q3 && q.q3.s === 2 && !P.flags[wpk('바람개비 언덕')]) goals.push([Wd.wps[1].x, Wd.wps[1].y]);
  if (q.q5 && q.q5.s === 1) { const b2 = Wd.bridges[Wd.bq2], i = b2.cells[b2.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
  if (q.q7 && q.q7.s === 1) { const N2 = Wd.islands[Wd.nestI]; goals.push([N2.cx, N2.cy]); }
  if (q.q7 && q.q7.s === 2 && !P.flags[wpk('둥지섬')]) goals.push([Wd.wps[3].x, Wd.wps[3].y]); }
  for (const id in q) if (q[id].s === 2 && qCh(id) === Wd.ch && !(id === 'q7' && !P.flags[wpk('둥지섬')]) && !(id === 'q3' && !P.flags[wpk('바람개비 언덕')]) && !(id === 'q12' && !P.flags[wpk('큰 풍차섬')]) && !(id === 'q17' && !P.flags[wpk('녹슨 정박장')]) && !(CHX[Wd.ch] && id === CHX[Wd.ch].qid[4] && !P.flags[wpk(CHX[Wd.ch].hill)])) goals.push(Wd.npcAt[QUESTS[id].from]);
  for (const [gx, gy] of goals) { const [a, b] = M(gx, gy); g.strokeStyle = '#ff6a4a'; g.lineWidth = 2.5; g.beginPath(); g.arc(a, b, 9, 0, TAU); g.stroke(); g.fillStyle = '#ff6a4a'; g.font = '900 13px system-ui'; g.fillText('!', a, b - 12); }
  { const [a, b] = M(P.x, P.y); g.fillStyle = '#fff'; g.strokeStyle = '#3a5a7a'; g.lineWidth = 2.5; g.beginPath(); g.arc(a, b, 6, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#3a5a7a'; g.font = '800 11px system-ui'; g.fillText('나', a, b - 10); }
}
function finishQuest(id) {
  const P = G.P, q = P.q[id]; if (!q) return;
  if (qCh(id) >= 4) { const R = finishX(id); if (!R) return; sfx('lvl'); save(); closePanel(); say('「' + QUESTS[id].n + '」 완료! 경험치 ' + R[0] + ', ' + R[1] + 'G', '#ffd166'); const I = CHX[qCh(id)].qid; if (id === I[0] || id === I[1]) setTimeout(() => talk('chief'), 300); if (id === I[4]) setTimeout(() => openPanel('end'), 400); return; }
  if (qCh(id) === 3) { const R = finish3(id); if (!R) return; sfx('lvl'); save(); closePanel(); say('「' + QUESTS[id].n + '」 완료! 경험치 ' + R[0] + ', ' + R[1] + 'G', '#ffd166'); if (id === 'q13' || id === 'q14') setTimeout(() => talk('chief'), 300); if (id === 'q17') setTimeout(() => openPanel('end'), 400); return; }
  if (qCh(id) === 2) { const R = finish2(id); if (!R) return; sfx('lvl'); save(); closePanel(); say('「' + QUESTS[id].n + '」 완료! 경험치 ' + R[0] + ', ' + R[1] + 'G', '#ffd166'); if (id === 'q8' || id === 'q9') setTimeout(() => talk('chief'), 300); if (id === 'q12') setTimeout(() => openPanel('end'), 400); return; }
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
  panel.innerHTML = `<div class="sk-bx sk-title"><button class="sk-x" data-a="quit" aria-label="나가기">✕</button><div class="t">끊어진 하늘</div><div class="s">맛보기판 · 1장 민들레 섬</div><p style="font-size:13px;line-height:1.7;color:#5a4a36;margin:4px 0">${STORY_INTRO.map(esc).join('<br>')}</p><div class="sk-cls">${Object.keys(CLASSES).map(k => `<div class="sk-cl${TSEL === k ? ' on' : ''}" data-a="pick" data-cls="${k}"><span data-po="${k}"></span><b>${CLASSES[k].name}</b><small style="color:#3a7fa8;margin-top:2px">${sv[k] ? lvT(sv[k].lv) : '새 이음꾼'}</small></div>`).join('')}</div><div class="sk-cdesc"><b>${CLASSES[TSEL].name}</b> · ${esc(CLASSES[TSEL].desc)}</div>
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
    if (DEBUG) window.__sky = { open, G: () => G, CHX, data: () => ({ BASES, GOODS, UNIQ, C2: C2BASES.map(b => b.id), C3: C3BASES.map(b => b.id) }), start(cls, fresh) { TSEL = cls || 'warden'; return startFrom(fresh !== false); }, loadHero, skills() { return SKILLS[G.P.cls].map(s => s.id); }, step(n) { for (let i = 0; i < n; i++) update(STEP); }, draw, god(b) { G.god = b; }, tp(x2, y2) { G.P.x = x2; G.P.y = y2; G.cam = [x2, y2]; }, panel: openPanel, close: closePanel, give(id, r) { addInv(makeItem(id, r || 0, 5)); }, goods(g, n) { addInv(goods(g, n)); }, lv(n) { gainXp(xpNeed(G.P.lv) * n); }, keys: KEYS, press, talk, layout, hit: hitMob, forge: forgeFx, forgeEnch, forgeAt(ms) { cancelAnimationFrame(FORGE.raf); for (let t = 0; t <= ms; t += 1000 / 60) FORGE.frame(FORGE.t0 + t); cancelAnimationFrame(FORGE.raf); }, ench(i, m) { const it = G.P.inv[i]; it.id = true; const r = enchant(it, m); calc(G.P); forgeEnch(it, r); return r; }, dbg: { drawParts, drawFx, drawMob, drawDrop, drawHero, hud, view } };
    return { open }; },
};
})();
