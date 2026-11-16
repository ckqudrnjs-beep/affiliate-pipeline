// 5락실 게임 포스터(시작 전 미리보기 그림) 자동 캡처 (2026-11-15 BK: 게임을 고치면 포스터도 새 화면으로).
// 게임 코드는 건드리지 않는다. 각 게임 meta.json 의 "poster" 조리법대로 실제 게임 화면을 1280x720 으로 찍는다.
//   "poster": { "hash": "#dgdebug",            // 디버그 주소(순위 제출 안 함)
//               "run": "await P.go(); ...",    // 페이지 안에서 실행할 JS(async). P.go() = 시작 버튼 누르고 게임 열림 대기
//               "wait": 6000,                  // run 다음 기다린 뒤 찍기(ms)
//               "title": true,                 // 화면 아래에 게임 이름 띠를 얹을지(게임이 직접 제목을 그리면 false)
//               "hide": ".sel1,.sel2" }        // 찍기 전에 숨길 요소(조작 버튼 등)
//   "poster_en": { "page": "/en/sky.html", "name": "…", "short": "…", "run": "…" }  // 영어판 포스터(선택). slug 자리에 <slug>@en

// 사용: node scripts/game_posters.js <사이트 주소> <출력 폴더> <slug> [slug…]
// 출력: <출력 폴더>/<slug>.png (1280x720). 같은 폴더의 meta 는 playground/games/<slug>/meta.json 에서 읽는다.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , BASE = 'http://localhost:8765', OUT = 'posters', ...SLUGS] = process.argv;
const GAMES = path.join(__dirname, '..', 'playground', 'games');
const W = 1280, H = 720;

const HELPERS = `(() => {
  // 테스터 전용 게임도 찍을 수 있게(찍는 브라우저 안에서만)
  window.nrTester = async () => true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(100); } throw new Error('시간 초과: ' + fn); };
  const go = async () => {
    const b = document.querySelector('main button[id$="-go"], main button[id$="-start"]');
    if (!b) throw new Error('시작 버튼 없음');
    b.click();
    await sleep(300);
  };
  window.P = { sleep, until, go };
})();`;

const TITLE = (name, short, font) => `(() => {
  const d = document.createElement('div');
  d.id = '__poster_title';
  d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:42%;z-index:2147483647;pointer-events:none;background:linear-gradient(180deg,#0000 0%,#0c062099 45%,#0c0620e6 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:0 0 34px 52px;box-sizing:border-box';
  const t = document.createElement('div');
  t.textContent = ${JSON.stringify(name)};
  t.style.cssText = 'font:' + ${JSON.stringify(font || '400 84px/1.05 "Black Han Sans","Noto Sans KR",sans-serif')} + ';color:#fff;letter-spacing:1px;text-shadow:0 0 18px #ff3d7f,0 4px 0 #1a0630,0 0 40px #ff3d7f88';
  const s = document.createElement('div');
  s.textContent = ${JSON.stringify(short)};
  s.style.cssText = 'margin-top:10px;font:700 26px/1.3 "Noto Sans KR",sans-serif;color:#ffd23f;text-shadow:0 2px 0 #000,0 0 12px #000';
  d.append(t, s);
  (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(d); // 전체 화면이면 그 안에(위에 보이게)
})();`;

async function shoot(browser, arg) {
  // "<slug>@en" = 영어판(meta.poster_en: page·name·short·run 등, 나머지는 poster 를 이어받음) → <slug>-en.png
  const [slug, lang] = arg.split('@');
  const meta0 = JSON.parse(fs.readFileSync(path.join(GAMES, slug, 'meta.json'), 'utf8'));
  const E = lang ? meta0['poster_' + lang] : null;
  if (lang && !E) throw new Error(slug + ': meta.json 에 poster_' + lang + ' 조리법이 없어요');
  const meta = E ? { ...meta0, name: E.name, short: E.short } : meta0;
  const R = E ? { ...meta0.poster, ...E } : meta0.poster;
  if (!R) throw new Error(slug + ': meta.json 에 poster 조리법이 없어요');
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: false });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(HELPERS);
  await page.goto(`${BASE}${R.page || `/games/${slug}.html`}${R.hash || ''}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(800);
  await page.evaluate(`(async () => { ${R.run || 'await P.go();'} })()`);
  await page.waitForTimeout(R.wait ?? 5000);
  if (R.after) await page.evaluate(`(async () => { ${R.after} })()`);
  // 공통으로 숨김: 코인·보너스 알림, 게임이 지정한 요소
  await page.addStyleTag({ content: `#__poster_title{display:flex!important}.btoast,.cheer{display:none!important}${R.hide ? R.hide + '{visibility:hidden!important}' : ''}` });
  if (R.title !== false) {
    await page.evaluate(TITLE(meta.name, meta.short, R.font));
    await page.evaluate(() => document.fonts && document.fonts.ready);
  }
  await page.waitForTimeout(150);
  const file = path.join(OUT, slug + (lang ? '-' + lang : '') + '.png');
  await page.screenshot({ path: file, type: 'png' });
  await ctx.close();
  if (errs.length) console.log(slug, '페이지 오류:', errs.slice(0, 3).join(' | '));
  console.log('찍음', arg, file);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let bad = 0;
  for (const s of SLUGS) {
    // 게임마다 새 브라우저(앞 게임의 오디오·웹GL 상태가 다음 게임을 멈추게 하지 않게)
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
    let to;
    try {
      await Promise.race([shoot(browser, s), new Promise((_, no) => { to = setTimeout(() => no(new Error('3분 넘게 걸림')), 180000); })]);
    } catch (e) { bad++; console.error('실패', s, e.message); }
    clearTimeout(to);
    await browser.close().catch(() => {});
  }
  process.exit(bad ? 1 : 0);
})();
