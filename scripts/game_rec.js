// 5락실 아무 게임이나 쇼츠용으로 녹화 (2026-11-14 BK: 새 게임은 항상 쇼츠 소재에).
// 게임 코드는 건드리지 않는다. 약속(있으면 사용):
//   주소에 #demo 를 붙이면 게임이 window.__demo = { bot: true/false, score, state } 를 만들고, 순위에 올리지 않는다.
// 약속이 없는 게임도 시작 버튼(id 가 -go / -start 로 끝나는 버튼)을 눌러 처음 몇 초를 녹화한다.
// 가상 시계(rAF·performance.now)로 프레임을 하나씩 진행 → 느린 서버에서도 30fps.
// 사용: node scripts/game_rec.js <사이트> <slug> <출력 폴더> [초=14]
// 출력: f00000.jpg … (게임 화면 영역만), info.json {slug, demo, frames, score}
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , BASE = 'http://localhost:8765', SLUG = 'dodge', OUT = 'grec', SECS = '14'] = process.argv;
const FPS = 30, DT = 1000 / FPS;
const VIRTUAL_TIME = `(() => {
  let vt = 0; const q = [];
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (ms) => { vt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(vt); } catch (e) { console.error(e); } } };
})();`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.addInitScript(VIRTUAL_TIME);
  await page.goto(`${BASE}/games/${SLUG}.html#demo`, { waitUntil: 'load' });
  const step = (n = 1) => page.evaluate(([d, k]) => { for (let i = 0; i < k; i++) window.__step(d); }, [DT, n]);
  await step(5);
  const go = await page.$('main button[id$="-go"], main button[id$="-start"], button[id$="-go"], button[id$="-start"]');
  if (go) { await go.scrollIntoViewIfNeeded(); await go.click().catch(() => {}); }
  for (let i = 0; i < 25; i++) { await page.waitForTimeout(200); await step(1); }
  const demo = await page.evaluate(() => { if (window.__demo) { try { window.__demo.bot = true; } catch (e) { /* 읽기 전용 */ } return true; } return false; });
  if (!go && !demo) { // 시작 버튼이 없으면 게임 화면 가운데를 한 번 누름
    const c = await page.$('main canvas, canvas');
    if (c) await c.click().catch(() => {});
  }
  await step(15);
  // 게임 화면 영역 = 보이는 것 중 가장 큰 canvas (없으면 main 첫 화면)
  let box = await page.evaluate(() => {
    let best = null, area = 0;
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect(); const a = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (a > area) { area = a; best = r; }
    }
    if (!best || area < innerWidth * innerHeight * 0.12) return null;
    return { x: Math.max(0, best.left), y: Math.max(0, best.top), width: Math.min(best.width, innerWidth), height: Math.min(best.height, innerHeight - Math.max(0, best.top)) };
  });
  if (!box) {
    const m = await page.$('main');
    if (m) await m.scrollIntoViewIfNeeded();
    box = { x: 0, y: 0, width: 540, height: 960 };
  }
  const n = Math.round(Number(SECS) * FPS);
  for (let i = 0; i < n; i++) {
    await step(1);
    await page.screenshot({ path: path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88, clip: box });
    if (i % 90 === 0) console.log('frame', i);
  }
  const score = await page.evaluate(() => (window.__demo && typeof window.__demo.score === 'number') ? window.__demo.score : null);
  fs.writeFileSync(path.join(OUT, 'info.json'), JSON.stringify({ slug: SLUG, demo, started: !!go, frames: n, fps: FPS, score, box }));
  console.log('done', SLUG, 'demo', demo, 'frames', n);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
