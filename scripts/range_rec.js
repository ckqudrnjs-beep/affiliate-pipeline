// 네온 사격장 자동 플레이 녹화 (5락실 게임 데이 쇼츠용, 2026-11-13).
// 사이트의 #rgdebug 테스트 훅(window.__rg)만 쓰고 게임 코드(range.js)는 건드리지 않는다. 순위에 안 올라감.
// 가상 시계로 프레임을 하나씩 진행하며 캡처 → 느린 서버에서도 끊김 없는 30fps.
// 사용: node scripts/range_rec.js <사이트 주소> <출력 폴더> [스테이지=7] [초=20]
// 출력: <폴더>/f00000.jpg ... + events.json (발사·명중·헤드샷 시각, 단계, 점수)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , BASE = 'http://localhost:8765', OUT = 'rec', STAGE = '7', SECS = '20'] = process.argv;
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.addInitScript(VIRTUAL_TIME);
  await page.goto(`${BASE}/games/range.html#rgdebug-rghq`, { waitUntil: 'load' });
  await page.click('#rg-go');
  // 모듈 로드 대기 (가상 시계는 rAF만 대신하므로 setTimeout 은 실제 시간)
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!window.__rg)); i++) await page.waitForTimeout(200);
  if (!(await page.evaluate(() => !!window.__rg))) throw new Error('__rg 없음');
  for (let i = 0; i < 10; i++) await page.evaluate((d) => window.__step(d), DT);
  await page.evaluate((n) => { window.__rg.startGame(); window.__rg.debug.stage(n); }, Number(STAGE));

  // 봇: 사람처럼 부드럽게 조준(목표 각도로 지수 보간) → 가까워지면 발사. 좀비 머리 우선.
  await page.evaluate(() => {
    const rg = window.__rg, d = rg.debug, cam = d.camera;
    const V = cam.position.constructor; const tmp = new V(), cp = new V();
    let yaw = 0, pitch = 0, lastFire = -1, cur = null, hold = 0;
    window.__ev = []; let t = 0, lastScore = rg.score;
    function pos(tg) {
      const o = tg.o || {}; const node = o.head || o.core || o.disc || tg.mesh || o;
      if (!node.getWorldPosition) return null; return node.getWorldPosition(tmp.clone());
    }
    function angles(p) {
      cam.getWorldPosition(cp); const dx = p.x - cp.x, dy = p.y - cp.y, dz = p.z - cp.z;
      return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))];
    }
    window.__bot = (dt) => {
      t += dt;
      if (rg.state !== 'play') { cur = null; return; }
      d.setAds(true); // 조준경: 탄 퍼짐이 작아 사람이 잘 쏘는 것처럼 보임
      const list = (d.active || []).filter((x) => x.state === 'up');
      if (!cur || !list.includes(cur)) {
        cur = null; let best = 1e9;
        for (const x of list) { const p = pos(x); if (!p) continue; const [y, pi] = angles(p);
          const score = Math.abs(y - yaw) + Math.abs(pi - pitch) - ((x.o && x.o.head) ? 0.6 : 0);
          if (score < best) { best = score; cur = x; } }
        hold = 0.08 + Math.random() * 0.12;
      }
      if (!cur) return;
      const p = pos(cur); if (!p) return; const [ty, tp] = angles(p);
      const k = 1 - Math.exp(-dt * 14); yaw += (ty - yaw) * k; pitch += (tp - pitch) * k; d.aim(yaw, pitch);
      hold -= dt;
      if (hold <= 0 && Math.abs(ty - yaw) < 0.006 && Math.abs(tp - pitch) < 0.006 && t - lastFire > 0.2) {
        lastFire = t; d.fire(); window.__ev.push({ t, k: 'fire', head: !!(cur.o && cur.o.head) });
      }
      if (rg.score > lastScore) { window.__ev.push({ t, k: 'hit', d: rg.score - lastScore }); lastScore = rg.score; }
    };
  });

  const n = Math.round(Number(SECS) * FPS) + Math.round(3.6 * FPS); // 카운트다운 포함
  for (let i = 0; i < n; i++) {
    await page.evaluate((d) => { window.__bot(d / 1000); window.__step(d); }, DT);
    await page.screenshot({ path: path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88 });
    if ((await page.evaluate(() => window.__rg.state)) === 'end') break;
    if (i % 60 === 0) console.log('frame', i, await page.evaluate(() => [window.__rg.state, window.__rg.score]));
  }
  const info = await page.evaluate(() => ({ ev: window.__ev, score: window.__rg.score, state: window.__rg.state }));
  fs.writeFileSync(path.join(OUT, 'events.json'), JSON.stringify({ fps: FPS, stage: Number(STAGE), ...info }));
  console.log('done', info.score, info.ev.filter((e) => e.k === 'hit').length, 'hits');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
