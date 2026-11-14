// 네온 레이드 직업별 3D 캐릭터 설정 (모델: KayKit Adventurers, CC0 — chars/LICENSE-KayKit.txt)
// 프레임 이름은 static/js/raid.js 의 POSE 키와 같다. [애니메이션 이름, 진행 비율 0~1]
export const FRAMES = ['idle', 'idle2', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall', 'hurt', 'dash',
  'c1a', 'c1b', 'c2a', 'c2b', 'c3a', 'c3b', 'cast', 'up', 'spin', 'ult'];

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
    frames: {
      ...COMMON, idle: ['2H_Melee_Idle', .15], idle2: ['2H_Melee_Idle', .6],
      c1a: ['2H_Melee_Attack_Chop', .2], c1b: ['2H_Melee_Attack_Chop', .5],
      c2a: ['2H_Melee_Attack_Slice', .2], c2b: ['2H_Melee_Attack_Slice', .5],
      c3a: ['2H_Melee_Attack_Chop', .12], c3b: ['2H_Melee_Attack_Stab', .45],
      cast: ['2H_Melee_Attack_Stab', .4], up: ['2H_Melee_Attack_Chop', .15], ult: ['2H_Melee_Attack_Chop', .1],
    },
  },
  fairy: {
    model: 'Rogue', show: [], extra: [['Mage', '1H_Wand', 'handslotr']], wings: true,
    tint: { Rogue_Body: '#bff6ff', Rogue_LegLeft: '#ffd0f0', Rogue_LegRight: '#ffd0f0', Rogue_ArmLeft: '#bff6ff', Rogue_ArmRight: '#bff6ff' },
    glow: { '1H_Wand': '#bffff6' }, rim: ['#8ffff0', '#ffc6ee'],
    frames: { ...COMMON, ...M1, c1b: ['1H_Melee_Attack_Stab', .45], c2a: ['1H_Melee_Attack_Stab', .15], c2b: ['1H_Melee_Attack_Slice_Horizontal', .48] },
  },
  mage: {
    model: 'Mage', show: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'],
    tint: { Mage_Body: '#8f7dff', Mage_Cape: '#5a44d0', Mage_Hat: '#8f7dff', Mage_LegLeft: '#6a5ad8', Mage_LegRight: '#6a5ad8' },
    glow: { '2H_Staff': '#ffb36b' }, rim: ['#ffb36b', '#9d7dff'],
    frames: { ...COMMON, ...M1, idle: ['Idle', .15] },
  },
  archer: {
    model: 'Rogue_Hooded', show: ['2H_Crossbow', 'Rogue_Cape'],
    tint: { Rogue_Body: '#7dd88a', Rogue_Cape: '#3f9a5a', Rogue_LegLeft: '#6a8a70', Rogue_LegRight: '#6a8a70' },
    glow: { '2H_Crossbow': '#9dff8a' }, rim: ['#9dff8a', '#ffd166'],
    frames: {
      ...COMMON, ...M1, idle: ['2H_Ranged_Aiming', .2], idle2: ['2H_Ranged_Aiming', .7],
      c1b: ['2H_Ranged_Shoot', .3], c2b: ['2H_Ranged_Shoot', .55], cast: ['2H_Ranged_Shoot', .3], up: ['2H_Ranged_Aiming', .5],
    },
  },
  voodoo: {
    model: 'Mage', show: ['1H_Wand', 'Mage_Cape'], doll: true,
    tint: { Mage_Body: '#5ad078', Mage_Cape: '#9a6ad8', Mage_LegLeft: '#4a7a58', Mage_LegRight: '#4a7a58' },
    glow: { '1H_Wand': '#7dff9a' }, rim: ['#7dff9a', '#b48bff'],
    frames: { ...COMMON, ...M1 },
  },
};
