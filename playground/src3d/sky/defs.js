// 끊어진 하늘 스프라이트 정의. 프레임 순서는 static/js/sky.js 의 SPR 과 같아야 한다.
export const HFRAMES = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'atk0', 'atk1', 'atk2', 'atk3', 'cast0', 'cast1', 'cast2', 'hurt', 'dodge', 'die0', 'die1'];
const base = (idle, atk, cast) => ({
  idle0: [idle, .2], idle1: [idle, .7],
  run0: ['Running_A', 0], run1: ['Running_A', 1 / 6], run2: ['Running_A', 2 / 6], run3: ['Running_A', 3 / 6], run4: ['Running_A', 4 / 6], run5: ['Running_A', 5 / 6],
  atk0: [atk[0], atk[1]], atk1: [atk[0], atk[2]], atk2: [atk[0], atk[3]], atk3: [atk[0], atk[4]],
  cast0: [cast[0], cast[1]], cast1: [cast[0], cast[2]], cast2: [cast[0], cast[3]],
  hurt: ['Hit_A', .35], dodge: ['Dodge_Forward', .35], die0: ['Death_A', .4], die1: ['Death_A', .98],
});
export const HEROES = {
  warden: { // 방패지기: 창 + 둥근 방패, 쇠빛 갑옷에 하늘색 천
    model: 'Knight', show: ['Round_Shield', 'Knight_Helmet', 'Knight_Cape'], spear: 1, height: 1.0,
    tint: { Knight_Cape: '#2a7a96', Knight_Body: '#c9ccd2', Knight_ArmLeft: '#c9ccd2', Knight_ArmRight: '#c9ccd2', Knight_LegLeft: '#7a6a58', Knight_LegRight: '#7a6a58', Round_Shield: '#d9b26a' },
    frames: base('Idle', ['1H_Melee_Attack_Stab', .12, .32, .48, .7], ['Block_Attack', .2, .45, .7]),
  },
  windcaller: { // 바람술사: 지팡이, 흰 하늘빛 옷 + 바람 리본, 모자 없음
    model: 'Mage', show: ['2H_Staff', 'Mage_Cape'], ribbon: '#8fd8ff', height: 1.0,
    tint: { Mage_Body: '#a8d4f0', Mage_Cape: '#3a7fb8', Mage_ArmLeft: '#a8d4f0', Mage_ArmRight: '#a8d4f0', Mage_LegLeft: '#5a6a84', Mage_LegRight: '#5a6a84' },
    glow: { '2H_Staff': '#9fe4ff' },
    frames: base('Idle', ['Spellcast_Shoot', .1, .3, .48, .7], ['Spellcast_Raise', .25, .55, .85]),
  },
};
const npcF = a => ({ idle0: [a, .2], idle1: [a, .7] });
export const NPCS = { // 마을 사람: 정면(아래쪽) 1방향, 대기 2장
  chief: { model: 'Barbarian', show: ['Barbarian_Cape'], height: 1.0, tint: { Barbarian_Body: '#b8a27a', Barbarian_Cape: '#6a8a4a', Barbarian_LegLeft: '#6a5a48', Barbarian_LegRight: '#6a5a48', Barbarian_ArmLeft: '#c8b090', Barbarian_ArmRight: '#c8b090' }, frames: npcF('Idle') },
  smith: { model: 'Barbarian', show: ['1H_Axe'], height: 1.02, tint: { Barbarian_Body: '#8a5a3a', Barbarian_LegLeft: '#4a3a2a', Barbarian_LegRight: '#4a3a2a' }, frames: npcF('Idle') },
  merchant: { model: 'Rogue', show: ['Rogue_Cape'], height: .96, tint: { Rogue_Body: '#d8a84a', Rogue_Cape: '#a84a3a', Rogue_LegLeft: '#5a4a3a', Rogue_LegRight: '#5a4a3a' }, frames: npcF('Idle') },
  sage: { model: 'Mage', show: ['Mage_Hat', 'Spellbook_open'], height: .98, tint: { Mage_Body: '#7a6aa8', Mage_Hat: '#5a4a88', Mage_LegLeft: '#4a3a68', Mage_LegRight: '#4a3a68' }, frames: npcF('Idle') },
};
// 몹 프레임: [상태, 진행 0~1]
export const MFRAMES = [['idle', 0], ['idle', .5], ['move', 0], ['move', .25], ['move', .5], ['move', .75], ['atk', 0], ['atk', .5], ['atk', 1], ['hurt', 0], ['die', 0], ['die', 1]];
export const MOBS = {
  fluff: { model: 'fluff', cell: [96, 96, 48, 84] },
  fluffking: { model: 'fluff', crown: 1, col: 0xd9cfe8, feet: 0x7a6a98, scale: 2.4, cell: [224, 224, 112, 200] },
  seed: { model: 'seed', cell: [96, 104, 48, 92] },
  bird: { model: 'bird', cell: [104, 132, 52, 120] },
};
// 소품: KayKit Medieval Hexagon (CC0). s = 크기 배율, foot = 바닥 차지 반경(칸)
export const PROPS = [
  ['tree1', 'tree_single_A', 2, .35], ['tree2', 'tree_single_B', 2, .35], ['treesL', 'trees_A_large', 1.6, 1.1], ['treesM', 'trees_A_medium', 1.6, .9], ['treesBL', 'trees_B_large', 1.6, 1.1], ['treesBM', 'trees_B_medium', 1.6, .9], ['treesS', 'trees_A_small', 1.6, .6], ['treesBS', 'trees_B_small', 1.6, .6],
  ['rock1', 'rock_single_A', 3.2, .4], ['rock2', 'rock_single_B', 3.2, .4], ['rock3', 'rock_single_C', 3.2, .4], ['rock4', 'rock_single_D', 3.2, .4], ['rock5', 'rock_single_E', 3.2, .4],
  ['cloudB', 'cloud_big', 1.2, 0], ['cloudS', 'cloud_small', 1.2, 0],
  ['windmill', 'building_windmill_blue', 1.8, 1.3], ['home1', 'building_home_A_blue', 1.8, 1.3], ['home2', 'building_home_B_blue', 1.8, 1.3], ['well', 'building_well_blue', 1.8, .6], ['smithy', 'building_blacksmith_blue', 1.8, 1.4], ['market', 'building_market_blue', 1.8, 1.4], ['tavern', 'building_tavern_blue', 1.8, 1.4], ['ruin', 'building_destroyed', 1.8, 1.2], ['grain', 'building_grain', 1.8, 1.2],
  ['fence', 'fence_wood_straight', 2.6, .3], ['gate', 'fence_wood_straight_gate', 2.6, .3],
  ['barrel', 'barrel', 3.4, .25], ['crateB', 'crate_A_big', 3.4, .3], ['crateS', 'crate_A_small', 3.4, .2], ['crate2', 'crate_B_big', 3.4, .3], ['sack', 'sack', 3.4, .2], ['barrow', 'wheelbarrow', 3.4, .3], ['bucket', 'bucket_water', 3.4, .15], ['flag', 'flag_blue', 3.4, .15], ['lumber', 'resource_lumber', 3, .45], ['stone', 'resource_stone', 3, .45], ['crateO', 'crate_open', 3.4, .3],
].map(([key, file, s, foot]) => ({ key, file, s, foot }));
