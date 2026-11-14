// 끊어진 하늘: KayKit Medieval Hexagon Pack (CC0, Kay Lousberg) 소품 내려받기 → sky/models/ (저장소에는 넣지 않음)
// 캐릭터 모델은 ../chars/fetch.mjs 가 받는다 (Knight, Mage, Rogue, Barbarian).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, 'models');
const HEX = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/main/addons/kaykit_medieval_hexagon_pack/Assets/gltf/';
export const FILES = process.argv.slice(2).length ? process.argv.slice(2) : [
  'decoration/nature/tree_single_A', 'decoration/nature/tree_single_B', 'decoration/nature/trees_A_large', 'decoration/nature/trees_A_medium', 'decoration/nature/trees_B_large', 'decoration/nature/trees_B_medium', 'decoration/nature/trees_A_small', 'decoration/nature/trees_B_small',
  'decoration/nature/rock_single_A', 'decoration/nature/rock_single_B', 'decoration/nature/rock_single_C', 'decoration/nature/rock_single_D', 'decoration/nature/rock_single_E',
  'decoration/nature/cloud_big', 'decoration/nature/cloud_small', 'decoration/nature/hills_A', 'decoration/nature/hill_single_A', 'decoration/nature/waterplant_A', 'decoration/nature/waterlily_A',
  'buildings/blue/building_windmill_blue', 'buildings/blue/building_home_A_blue', 'buildings/blue/building_home_B_blue', 'buildings/blue/building_well_blue', 'buildings/blue/building_blacksmith_blue', 'buildings/blue/building_market_blue', 'buildings/blue/building_tavern_blue', 'buildings/blue/building_watermill_blue', 'buildings/blue/building_tower_A_blue', 'buildings/blue/building_church_blue', 'buildings/blue/building_lumbermill_blue',
  'buildings/neutral/building_destroyed', 'buildings/neutral/building_scaffolding', 'buildings/neutral/building_stage_A', 'buildings/neutral/building_grain', 'buildings/neutral/fence_wood_straight', 'buildings/neutral/fence_wood_straight_gate', 'buildings/neutral/wall_straight',
  'decoration/props/barrel', 'decoration/props/crate_A_big', 'decoration/props/crate_A_small', 'decoration/props/crate_B_big', 'decoration/props/haybale', 'decoration/props/sack', 'decoration/props/wheelbarrow', 'decoration/props/bucket_water', 'decoration/props/tent', 'decoration/props/flag_blue', 'decoration/props/target', 'decoration/props/weaponrack', 'decoration/props/resource_lumber', 'decoration/props/resource_stone', 'decoration/props/anchor', 'decoration/props/boat', 'decoration/props/pallet', 'decoration/props/trough', 'decoration/props/crate_open',
];
fs.mkdirSync(DIR, { recursive: true });
const got = [];
async function get(rel) { const f = path.join(DIR, path.basename(rel)); if (fs.existsSync(f)) return true; const r = await fetch(HEX + rel); if (!r.ok) return false; fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); return true; }
for (const n of FILES) {
  if (!(await get(n + '.gltf'))) { console.log('없음', n); continue; }
  const j = JSON.parse(fs.readFileSync(path.join(DIR, path.basename(n) + '.gltf'), 'utf8')), dir = path.dirname(n) + '/';
  for (const b of j.buffers || []) await get(dir + b.uri);
  for (const im of j.images || []) await get(dir + im.uri);
  got.push(path.basename(n));
}
console.log('받음', got.length, got.join(' '));
