// 사용: cd playground/src3d && npm install && node chars/fetch.mjs && node sky/fetch.mjs && node sky/render.mjs [항목…] [--png]
// 결과: ../static/img/sky/*.webp + props.json/npc.json (아틀라스 위치)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..'), OUT = path.resolve(ROOT, '../static/img/sky');
const args = process.argv.slice(2), png = args.includes('--png'), list = args.filter(a => !a.startsWith('--'));
const items = list.length ? list : ['warden', 'windcaller', 'fluff', 'fluffking', 'seed', 'bird', 'npc', 'props', 'icons'];
const ICONS = ['spear', 'spear2', 'staff', 'staff2', 'shield', 'shield2', 'bell', 'feather', 'hood', 'helm', 'hat', 'armor0', 'armor1', 'armor2', 'inner', 'cloak', 'cloak2', 'gloves', 'belt', 'boots0', 'boots', 'amulet', 'amulet2', 'ear', 'ring', 'ring2', 'sail', 'sail2', 'sail3', 'pot', 'wpot', 'hone', 'glue', 'bhone', 'bglue', 'pure', 'look', 'plank'];
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.bin': 'application/octet-stream' };
const srv = http.createServer((q, s) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s); });
await new Promise(ok => srv.listen(0, ok));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage(); pg.on('pageerror', e => console.error('ERR', e.message)); pg.on('console', m => { if (m.type() === 'error') console.error('CON', m.text()); });
await pg.goto(`http://localhost:${srv.address().port}/sky/render.html`); await pg.waitForFunction('window.READY', null, { timeout: 60000 });
fs.mkdirSync(OUT, { recursive: true });
for (const it of items) {
  let url;
  if (it === 'props') { const r = await pg.evaluate(() => window.renderProps()); url = r.url; fs.writeFileSync(path.join(OUT, 'props.json'), JSON.stringify(r.meta)); }
  else if (it === 'icons') { const r = await pg.evaluate(k => window.renderIcons(k), ICONS); url = r.url; fs.writeFileSync(path.join(OUT, 'icons.json'), JSON.stringify(r.meta)); }
  else if (it === 'npc') { const r = await pg.evaluate(() => window.renderNPCs()); url = r.url; fs.writeFileSync(path.join(OUT, 'npc.json'), JSON.stringify(r.keys)); }
  else if (['warden', 'windcaller'].includes(it)) url = await pg.evaluate(k => window.renderHero(k), it);
  else url = await pg.evaluate(k => window.renderMob(k), it);
  if (png) { const f = path.join(HERE, 'sheet-' + it + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('png', f); continue; }
  const webp = await pg.evaluate(async u => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL('image/webp', .84); }, url);
  const f = path.join(OUT, it + '.webp'); fs.writeFileSync(f, Buffer.from(webp.split(',')[1], 'base64')); console.log(it, (fs.statSync(f).size / 1024).toFixed(0) + 'KB');
}
await b.close(); srv.close();
