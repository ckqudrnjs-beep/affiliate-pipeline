// 롱폼 "우리 집 숫자 넣어 보기" 화면 찍기 (2026-11-14). node tools/screens.js job.json
// job = {jobs:[{url, steps:[[id, value], ...], prefix}]} → prefix-0.png(처음), prefix-1..n.png(값 하나씩), prefix-r.png(결과)
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
(async () => {
  const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const opts = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
  const b = await pw.chromium.launch(opts);
  // 1280x720 을 1.3배로 찍어 글씨를 크게 (영상 화면 1680x945 에 맞춤)
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.3125 });
  for (const j of job.jobs) {
    await p.goto(j.url);
    await p.waitForTimeout(400);
    // 영상은 상품·제휴 없이 계산기만 보여 준다: 맨 위 제휴 고지 막대·상품 목록은 숨김 (사이트 자체는 그대로)
    await p.addStyleTag({ content: '.adbar{display:none!important}' });
    await p.evaluate(() => document.querySelector('.calc').scrollIntoView({ block: 'start' }));
    await p.evaluate(() => window.scrollBy(0, -120));
    await p.screenshot({ path: `${j.prefix}-0.png` });
    let k = 1;
    for (const [id, v] of j.steps) {
      const el = p.locator('#' + id);
      await el.scrollIntoViewIfNeeded();
      await p.evaluate(i => { const e = document.getElementById(i); e.style.outline = '6px solid #ffd166'; e.scrollIntoView({ block: 'center' }); }, id);
      await el.fill(String(v));
      await el.dispatchEvent('input');
      await p.waitForTimeout(150);
      await p.screenshot({ path: `${j.prefix}-${k++}.png` });
      await p.evaluate(i => { document.getElementById(i).style.outline = ''; }, id);
    }
    await p.evaluate(() => {
      for (const s of ['#out', '#cmp']) { const e = document.querySelector(s); if (e) { e.style.outline = '6px solid #d6452f'; e.style.outlineOffset = '6px'; } }
      document.querySelector('#out').scrollIntoView({ block: 'center' });
    });
    await p.screenshot({ path: `${j.prefix}-r.png` });
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
