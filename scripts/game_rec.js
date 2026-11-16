// 5락실 아무 게임이나 쇼츠용으로 녹화 (2026-11-14 BK: 새 게임은 항상 쇼츠 소재에).
// 게임 코드는 건드리지 않는다. 약속(있으면 사용):
//   주소에 #demo 를 붙이면 게임이 window.__demo = { bot: true/false, score, state } 를 만들고, 순위에 올리지 않는다.
// 약속이 없는 게임도 시작 버튼(id 가 -go / -start 로 끝나는 버튼)을 눌러 처음 몇 초를 녹화한다.
// 가상 시계(rAF·performance.now)로 프레임을 하나씩 진행 → 느린 서버에서도 30fps.
// 게임별 녹화 방법(테스트 모드 해시·봇 켜기): config/raksil_rec.json
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
  let R = {};
  try { R = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'raksil_rec.json'), 'utf8'))[SLUG] || {}; } catch (e) { /* 없음 */ }
  const [VW, VH] = R.view || [540, 960];
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  // 녹화 중 점수·투표 등 쓰기 요청은 서버로 보내지 않음 (순위 오염 방지)
  await page.route('**/api/**', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()));
  await page.addInitScript(VIRTUAL_TIME);
  await page.goto(`${BASE}/games/${SLUG}.html#${R.hash || 'demo'}`, { waitUntil: 'load' });
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
  if (R.once) await page.evaluate(R.once).catch((e) => console.error('once', e.message));
  await step(15);
  // 게임 화면 영역 = 가장 큰 canvas (없으면 main 첫 화면).
  // 2026-11-16 별사탕 합치기: 세로로 긴 canvas 아랫부분이 화면 밖이라 잘려 녹화됨 → 캔버스 전체가 보이도록
  // 스크롤하고, 그래도 화면보다 길면 브라우저 창을 늘린 뒤 다시 잰다. 잘린 비율은 info.json 의 cut 에 남겨 업로드 전 검사에 씀.
  const measure = () => page.evaluate(() => {
    let best = null, area = 0;
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect(); const a = r.width * r.height;
      if (r.width > 0 && r.height > 0 && a > area) { area = a; best = r; }
    }
    if (!best || area < innerWidth * innerHeight * 0.12) return null;
    return { x: best.left, y: best.top, width: best.width, height: best.height, sy: scrollY, vw: innerWidth, vh: innerHeight };
  });
  let vh = VH, cv = null;
  for (let k = 0; k < 4; k++) {
    cv = await measure();
    if (!cv) break;
    if (cv.height > vh + 0.5) { // 창보다 긴 캔버스: 창을 늘림 (게임이 창 크기에 맞춰 다시 그리면 다음 바퀴에 다시 잼)
      vh = Math.ceil(cv.height) + 2; await page.setViewportSize({ width: VW, height: vh }); await step(3); continue;
    }
    if (cv.y < -0.5 || cv.y + cv.height > vh + 0.5) { // 캔버스가 화면 밖으로 나감: 가운데로 스크롤
      await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, cv.sy + cv.y - (vh - cv.height) / 2)); await step(2); continue;
    }
    break;
  }
  if (cv) cv = await measure();
  const inside = (r) => ({ x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.x + r.width, VW) - Math.max(0, r.x), height: Math.min(r.y + r.height, vh) - Math.max(0, r.y) });
  let box = cv ? inside(cv) : null;
  if (!box) {
    const m = await page.$('main');
    if (m) await m.scrollIntoViewIfNeeded();
    box = { x: 0, y: 0, width: VW, height: vh };
  }
  const cutOf = (r) => (r ? Math.max(0, 1 - (inside(r).width * inside(r).height) / (r.width * r.height)) : 0);
  const cut = cutOf(cv);
  if (cut > 0.005) console.error(`경고: 게임 화면 ${(cut * 100).toFixed(1)}% 가 녹화 영역 밖`);
  if (R.square) { const s = Math.min(box.width, box.height); box = { x: box.x + (box.width - s) / 2, y: box.y + (box.height - s) / 2, width: s, height: s }; }
  const n = Math.round(Number(SECS) * FPS);
  const tick = R.tick ? new Function('i', R.tick) : null;
  for (let i = 0; i < n; i++) {
    if (tick) await page.evaluate(([src, k]) => { try { new Function('i', src)(k); } catch (e) { /* 무시 */ } }, [R.tick, i]);
    await step(1);
    await page.screenshot({ path: path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88, clip: box });
    if (i % 90 === 0) console.log('frame', i);
  }
  const boxCut = (r, b) => { if (!r) return 0; const w = Math.max(0, Math.min(r.x + r.width, b.x + b.width) - Math.max(r.x, b.x)); const h = Math.max(0, Math.min(r.y + r.height, b.y + b.height) - Math.max(r.y, b.y)); return Math.max(0, 1 - (w * h) / (r.width * r.height)); };
  const cvEnd = cv ? await measure() : null; // 녹화 끝에 다시 재서 도중에 화면이 밀렸는지 확인
  const score = await page.evaluate(() => (window.__demo && typeof window.__demo.score === 'number') ? window.__demo.score : null);
  fs.writeFileSync(path.join(OUT, 'info.json'), JSON.stringify({ slug: SLUG, demo, started: !!go, frames: n, fps: FPS, score, box, view: [VW, vh], canvas: cv, cut, canvas_end: cvEnd, cut_end: boxCut(cvEnd, box) }));
  console.log('done', SLUG, 'demo', demo, 'frames', n);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
