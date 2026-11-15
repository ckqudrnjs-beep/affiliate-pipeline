// 끊어진 하늘: game/*.js 를 차례로 이어 붙여 ../../static/js/sky.js 로 만든다(번들러 없음, Cloudflare 빌드는 파이썬만 돌아서 결과물을 커밋).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url)), SRC = path.join(HERE, 'game');
const out = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n')
  // 그림 묶음(img/sky/*)이 바뀌면 주소도 바뀌게 내용 해시를 넣는다(폰·CDN 캐시에 옛 그림이 남지 않게).
  .replace('__ASSETV__', (() => { const d = path.resolve(HERE, '../../static/img/sky'), h = crypto.createHash('md5'); for (const n of fs.readdirSync(d).sort()) h.update(n).update(fs.readFileSync(path.join(d, n))); return h.digest('hex').slice(0, 8); })());
const f = path.resolve(HERE, '../../static/js/sky.js'); fs.writeFileSync(f, out); console.log('sky.js', (out.length / 1024).toFixed(0) + 'KB');
