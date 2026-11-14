// 네온 레이드 직업별 3D 캐릭터 설정 (모델: KayKit Adventurers, CC0 — chars/LICENSE-KayKit.txt)
// 프레임 이름은 static/js/raid.js 의 POSE 키와 같다. [애니메이션 이름, 진행 비율 0~1]
// 앞 20개는 예전 순서 그대로. 그 뒤는 BK 11/14 '모션에 많은 프레임' 요청으로 늘린 사이 프레임
// (대기 4장, 달리기 8장, 공격 자세마다 앞(_p)·뒤(_f) 1장씩 → 공격 1번이 2장 → 4장). raid.js ATL.F 와 같아야 한다.
const ATK = ['c1a', 'c1b', 'c2a', 'c2b', 'c3a', 'c3b', 'cast', 'up', 'spin', 'ult'];
export const FRAMES = ['idle', 'idle2', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall', 'hurt', 'dash',
  'c1a', 'c1b', 'c2a', 'c2b', 'c3a', 'c3b', 'cast', 'up', 'spin', 'ult',
  'idle1', 'idle3', 'run4', 'run5', 'run6', 'run7', 'hurt2', 'dash2', ...ATK.flatMap(k => [k + '_p', k + '_f'])];
const cl = t => Math.max(0, Math.min(.98, t));
function more(f) { // 자세 1장 → 앞뒤 사이 프레임 자동 생성
  const o = Object.assign({}, f), [ia, it] = f.idle, [, it2] = f.idle2;
  o.idle1 = [ia, (it + it2) / 2]; o.idle3 = [ia, (it2 + .25) % 1];
  o.run4 = ['Running_A', .125]; o.run5 = ['Running_A', .375]; o.run6 = ['Running_A', .625]; o.run7 = ['Running_A', .875];
  o.hurt2 = [f.hurt[0], cl(f.hurt[1] + .25)]; o.dash2 = [f.dash[0], cl(f.dash[1] + .25)];
  for (const k of ATK) { const [a, t] = f[k], sp = k === 'spin'; o[k + '_p'] = [a, cl(t - (sp ? .16 : .1))]; o[k + '_f'] = [a, cl(t + (sp ? .2 : .14))]; }
  return o;
}

const COMMON = {
  idle: ['Idle', .15], idle2: ['Idle', .6],
  run0: ['Running_A', 0], run1: ['Running_A', .25], run2: ['Running_A', .5], run3: ['Running_A', .75],
  jump: ['Jump_Start', .9], fall: ['Jump_Idle', .5], hurt: ['Hit_A', .3], dash: ['Dodge_Forward', .3],
  cast: ['Spellcast_Shoot', .35], up: ['Spellcast_Raise', .55], spin: ['2H_Melee_Attack_Spin', .22], ult: ['Spellcast_Long', .45],
};
const M1 = { // 한손 근접
  c1a: ['1H_Melee_Attack_Slice_Diagonal', .18], c1b: ['1H_Melee_Attack_Slice_Diagonal', .45],
  c2a: ['1H_Melee_Attack_Slice_Horizontal', .2], c2b: ['1H_Melee_Attack_Slice_Horizontal', .48],
  c3a: ['1H_Melee_Attack_Chop', .22], c3b: ['1H_Melee_Attack_Chop', .5],
};

export const CLASSES = {
  knight: {
    model: 'Knight', show: ['2H_Sword', 'Knight_Helmet', 'Knight_Cape'],
    tint: { Knight_Body: '#c8d4ff', Knight_Cape: '#3a5cff', Knight_Helmet: '#d8e0ff', Knight_LegLeft: '#b8c4f0', Knight_LegRight: '#b8c4f0', Knight_ArmLeft: '#d8e0ff', Knight_ArmRight: '#d8e0ff' },
    glow: { '2H_Sword': '#7df9ff' }, rim: ['#7df9ff', '#ff6b8a'],
    frames: more({
      ...COMMON, idle: ['2H_Melee_Idle', .15], idle2: ['2H_Melee_Idle', .6],
      c1a: ['2H_Melee_Attack_Chop', .2], c1b: ['2H_Melee_Attack_Chop', .5],
      c2a: ['2H_Melee_Attack_Slice', .2], c2b: ['2H_Melee_Attack_Slice', .5],
      c3a: ['2H_Melee_Attack_Chop', .12], c3b: ['2H_Melee_Attack_Stab', .45],
      cast: ['2H_Melee_Attack_Stab', .4], up: ['2H_Melee_Attack_Chop', .15], ult: ['2H_Melee_Attack_Chop', .1],
    }),
  },
  fairy: {
    model: 'Rogue', show: [], extra: [['Mage', '1H_Wand', 'handslotr']], wings: true,
    tint: { Rogue_Body: '#bff6ff', Rogue_LegLeft: '#ffd0f0', Rogue_LegRight: '#ffd0f0', Rogue_ArmLeft: '#bff6ff', Rogue_ArmRight: '#bff6ff' },
    glow: { '1H_Wand': '#bffff6' }, rim: ['#8ffff0', '#ffc6ee'],
    frames: more({ ...COMMON, ...M1, c1b: ['1H_Melee_Attack_Stab', .45], c2a: ['1H_Melee_Attack_Stab', .15], c2b: ['1H_Melee_Attack_Slice_Horizontal', .48] }),
  },
  mage: {
    model: 'Mage', show: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'],
    tint: { Mage_Body: '#8f7dff', Mage_Cape: '#5a44d0', Mage_Hat: '#8f7dff', Mage_LegLeft: '#6a5ad8', Mage_LegRight: '#6a5ad8' },
    glow: { '2H_Staff': '#ffb36b' }, rim: ['#ffb36b', '#9d7dff'],
    frames: more({ ...COMMON, ...M1, idle: ['Idle', .15] }),
  },
  archer: {
    model: 'Rogue_Hooded', show: ['2H_Crossbow', 'Rogue_Cape'],
    tint: { Rogue_Body: '#7dd88a', Rogue_Cape: '#3f9a5a', Rogue_LegLeft: '#6a8a70', Rogue_LegRight: '#6a8a70' },
    glow: { '2H_Crossbow': '#9dff8a' }, rim: ['#9dff8a', '#ffd166'],
    frames: more({
      ...COMMON, ...M1, idle: ['2H_Ranged_Aiming', .2], idle2: ['2H_Ranged_Aiming', .7],
      c1b: ['2H_Ranged_Shoot', .3], c2b: ['2H_Ranged_Shoot', .55], cast: ['2H_Ranged_Shoot', .3], up: ['2H_Ranged_Aiming', .5],
    }),
  },
  voodoo: {
    model: 'Mage', show: ['1H_Wand', 'Mage_Cape'], doll: true,
    tint: { Mage_Body: '#5ad078', Mage_Cape: '#9a6ad8', Mage_LegLeft: '#4a7a58', Mage_LegRight: '#4a7a58' },
    glow: { '1H_Wand': '#7dff9a' }, rim: ['#7dff9a', '#b48bff'],
    frames: more({ ...COMMON, ...M1 }),
  },
};

// 적: 9프레임(3x3, 걷기 6 + 준비·휘두르기·맞음). 균열 빛에 깨어난 기계 골격 — KayKit Skeletons(CC0) 뼈를 금속색으로 칠하고 눈을 빛나게.
export const EFRAMES = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'wind0', 'wind', 'hit', 'hit2', 'hurt', 'hurt2']; // 4x4 칸: 걷기 8 + 준비 2 + 휘두르기 2 + 맞음 2
const WK = 'Walking_D_Skeletons';
const EF = (atk, wa, wb) => ({ w0: [WK, 0], w1: [WK, 1 / 8], w2: [WK, 2 / 8], w3: [WK, 3 / 8], w4: [WK, 4 / 8], w5: [WK, 5 / 8], w6: [WK, 6 / 8], w7: [WK, 7 / 8],
  wind0: [atk, Math.max(0, wa - .12)], wind: [atk, wa], hit: [atk, wb], hit2: [atk, Math.min(.95, wb + .17)], hurt: ['Hit_A', .3], hurt2: ['Hit_A', .6] });
const BONE = (pre, col, extra) => Object.assign({ [pre + '_Body']: col, [pre + '_Head']: col, [pre + '_Jaw']: col, [pre + '_ArmLeft']: col, [pre + '_ArmRight']: col, [pre + '_LegLeft']: col, [pre + '_LegRight']: col }, extra || {});
export const ENEMIES = {
  grunt: {
    model: 'Skeleton_Minion', show: [], extra: [['Barbarian', '1H_Axe', 'handslotr']], cols: 4, glowI: 2.5,
    tint: BONE('Skeleton_Minion', '#8a93a8', { Skeleton_Minion_Cloak: '#8a4a22', '1H_Axe': '#c07040' }), glow: { Skeleton_Minion_Eyes: '#ff8a2a' }, rim: ['#ff9a5a', '#7df9ff'],
    frames: EF('1H_Melee_Attack_Chop', .2, .5),
  },
  shield: {
    model: 'Skeleton_Warrior', show: [], extra: [['Barbarian', 'Barbarian_Round_Shield', 'handslotl'], ['Barbarian', '1H_Axe', 'handslotr']], cols: 4, glowI: 2.5,
    tint: BONE('Skeleton_Warrior', '#9aa4bc', { Skeleton_Warrior_Cloak: '#3a5a90', Skeleton_Warrior_Helmet: '#7c86a8', Barbarian_Round_Shield: '#d08a40', '1H_Axe': '#a0a8b8' }), glow: { Skeleton_Warrior_Eyes: '#ffb070' }, rim: ['#ffb070', '#7df9ff'],
    frames: EF('1H_Melee_Attack_Slice_Diagonal', .2, .5),
  },
  elite: {
    model: 'Skeleton_Warrior', show: [], extra: [['Barbarian', '2H_Axe', 'handslotr']], cols: 4, glowI: 2.5,
    tint: BONE('Skeleton_Warrior', '#6a7080', { Skeleton_Warrior_Cloak: '#a01a40', Skeleton_Warrior_Helmet: '#c02a50', '2H_Axe': '#8a909c' }), glow: { Skeleton_Warrior_Eyes: '#ff2a6a' }, scale: 1, rim: ['#ff2a6a', '#ff9ac0'],
    frames: EF('2H_Melee_Attack_Chop', .15, .5),
  },
};

// 소품·아이템: 칸 128x128, 가운데 정렬. n = 회전 프레임 수. 출처: KayKit Dungeon Remastered(CC0) 또는 직접 만든 도형(gem·orb·jelly).
export const PROPS = [
  { key: 'coin', file: 'coin.gltf.glb', n: 8, rx: Math.PI / 2, tilt: .1, tint: '#ffd166', glowI: .3 },
  { key: 'gem', proc: 'gem', n: 8, tilt: .2 },
  { key: 'chest', file: 'chest_gold.glb', n: 1, yaw: -.6, tilt: .35 },
  { key: 'orb', proc: 'orb', n: 1 },
  { key: 'jelly', proc: 'jelly', n: 1, yaw: -.4, tilt: .3 },
  { key: 'crate', file: 'box_small.gltf.glb', n: 1, yaw: -.5, tilt: .25 },
];
