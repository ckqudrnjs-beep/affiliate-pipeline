// KayKit Adventurers (CC0, Kay Lousberg) 모델 내려받기 → chars/models/ (저장소에는 넣지 않음)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, 'models');
const BASE = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/';
fs.mkdirSync(DIR, { recursive: true });
for (const n of ['Knight', 'Mage', 'Rogue', 'Rogue_Hooded', 'Barbarian']) {
  const f = path.join(DIR, n + '.glb'); if (fs.existsSync(f)) continue;
  const r = await fetch(BASE + n + '.glb'); if (!r.ok) throw new Error(n + ' ' + r.status);
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log('got', n);
}
