// 사용: cd playground/src3d && npm install && node chars/fetch.mjs && node chars/render.mjs [직업…] [--sheet]
// 결과: ../static/img/raid/<직업>.webp (5x4 아틀라스, 칸 360x320, 발 = (155,295), 1 게임 단위 = 1.2px)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const OUT = path.resolve(ROOT, '../static/img/raid');
const args = process.argv.slice(2), sheet = args.includes('--sheet');
const list = args.filter(a => !a.startsWith('--'));
const classes = list.length ? list : ['knight', 'fairy', 'mage', 'archer', 'voodoo', 'grunt', 'shield', 'elite', 'props', 'boss', 'boss2'];
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, s) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s);
});
await new Promise(ok => srv.listen(0, ok));
const port = srv.address().port;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage();
pg.on('pageerror', e => console.error('ERR', e.message));
await pg.goto(`http://localhost:${port}/chars/render.html`);
await pg.waitForFunction('window.READY', null, { timeout: 60000 });
fs.mkdirSync(OUT, { recursive: true });
for (const c of classes) {
  let url;
  if (c === 'mongle') url = await pg.evaluate(() => window.renderMongle());
  else if (c === 'boss2') url = await pg.evaluate(() => window.renderBoss2());
  else if (c === 'boss') url = await pg.evaluate(() => window.renderBoss());
  else if (c === 'props') { const r = await pg.evaluate(() => window.renderProps()); url = r.url; console.log('props meta', JSON.stringify(r.meta)); }
  else url = await pg.evaluate(([c, l]) => window.renderClass(c, l), [c, sheet]);
  const png = Buffer.from(url.split(',')[1], 'base64');
  if (sheet) { const f = path.join(HERE, 'sheet-' + c + '.png'); fs.writeFileSync(f, png); console.log('sheet', f); continue; }
  // PNG → WebP (브라우저로 변환: 투명 유지, 품질 0.86)
  const webp = await pg.evaluate(async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL('image/webp', .86); }, url);
  const f = c === 'mongle' ? path.resolve(ROOT, '../static/img/mongle/mongle3d.webp') : path.join(OUT, c + '.webp'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(webp.split(',')[1], 'base64'));
  console.log(c, (fs.statSync(f).size / 1024).toFixed(0) + 'KB');
}
await b.close(); srv.close();
