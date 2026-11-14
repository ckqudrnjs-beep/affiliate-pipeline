// 끊어진 하늘: game/*.js 를 차례로 이어 붙여 ../../static/js/sky.js 로 만든다(번들러 없음, Cloudflare 빌드는 파이썬만 돌아서 결과물을 커밋).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), SRC = path.join(HERE, 'game');
const out = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const f = path.resolve(HERE, '../../static/js/sky.js'); fs.writeFileSync(f, out); console.log('sky.js', (out.length / 1024).toFixed(0) + 'KB');
