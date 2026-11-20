// 홍보 이미지 3종 렌더러 (2026-11-20 BK "가자": 어두운 그라데이션 + 두 줄 큰 제목(한 단어 기울임 강조) + 폰 목업).
// 글꼴은 주아(config/fonts/Jua-Regular.ttf). 문구·숫자는 src/pipeline/promo_cards.py 가 만든 spec 에서만 온다.
//   kind "vertical" 1080x1920  5락실 쇼츠 썸네일·세로 홍보   (phones: 그림 1~2장)
//   kind "poster"   1280x720   5락실 가로 포스터              (cards: [{t1, em, img}] 3장)
//   kind "calc"     1080x1350  돈삼촌 계산기 카드(인스타)      (stats 2개 + 결과 화면 rows)
// 사용: node scripts/promo_cards.js <spec.json>   spec = [{kind, out, ...}, ...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const FONT = pathToFileURL(path.join(__dirname, '..', 'config', 'fonts', 'Jua-Regular.ttf')).href;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (p) => pathToFileURL(path.resolve(p)).href;
// "한 달 *얼마* 더?" → *…* 만 기울임 강조
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class=em>$1</span>');

const BASE = `@font-face{font-family:Jua;src:url(${FONT})}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Jua,sans-serif;color:#fff;overflow:hidden}
.em{display:inline-block;transform:skewX(-12deg);background:linear-gradient(90deg,var(--em1),var(--em2));-webkit-background-clip:text;background-clip:text;color:transparent;padding:0 .08em}
.phone{position:absolute;border-radius:58px;background:#0b0b10;padding:14px;box-shadow:0 0 0 2px #ffffff22,0 40px 80px #000a,0 0 60px var(--glow,#7b5cff55)}
.phone img{display:block;width:100%;border-radius:46px}
.phone:before{content:"";position:absolute;top:26px;left:50%;width:30%;height:26px;margin-left:-15%;background:#0b0b10;border-radius:20px;z-index:2}`;

const SIZE = { vertical: [1080, 1920], poster: [1280, 720], calc: [1080, 1350] };

function vertical(s) {
  const [front, back] = s.phones;
  return `<style>:root{--em1:#ffd23f;--em2:#ff6fae}
body{width:1080px;height:1920px;background:radial-gradient(900px 700px at 80% 62%,#6a2bd955,transparent 70%),radial-gradient(700px 600px at 10% 90%,#ff3d7f33,transparent 70%),linear-gradient(180deg,#120a24 0%,#07060d 100%)}
.top{position:absolute;left:84px;top:150px;right:84px}.kick{font-size:44px;color:#b9a8ff;letter-spacing:2px}
h1{font-weight:400;font-size:168px;line-height:1.02;margin-top:18px}.sub{font-size:46px;color:#ffffffcc;margin-top:30px}
.bot{position:absolute;left:84px;bottom:110px;font-size:44px;color:#ffffffaa}.bot b{font-weight:400;color:#ffd23f}</style>
<div class=top><div class=kick>${esc(s.kick)}</div><h1>${rich(s.t1)}<br>${rich(s.t2)}</h1><div class=sub>${esc(s.sub)}</div></div>
${back ? `<div class=phone style="width:420px;left:110px;top:900px;transform:rotate(-8deg);opacity:.55;--glow:#ff3d7f44"><img src="${img(back)}"></div>` : ''}
<div class=phone style="width:500px;left:${back ? 480 : 290}px;top:760px;transform:rotate(${back ? 5 : 0}deg);--glow:#7b5cffaa"><img src="${img(front)}"></div>
<div class=bot>${esc(s.foot)} <b>${esc(s.url)}</b></div>`;
}

function poster(s) {
  const pos = [[560, 60], [800, 90], [1040, 60]];
  return `<style>:root{--em1:#ffd23f;--em2:#ff6fae}
body{width:1280px;height:720px;background:radial-gradient(600px 500px at 75% 40%,#6a2bd966,transparent 70%),linear-gradient(120deg,#160b2b 0%,#08070f 70%)}
.l{position:absolute;left:64px;top:150px;width:470px}.kick{font-size:28px;color:#b9a8ff}
h1{font-weight:400;font-size:96px;line-height:1.05;margin-top:14px}.sub{font-size:28px;color:#ffffffcc;margin-top:22px;line-height:1.4}
.url{position:absolute;left:64px;bottom:54px;font-size:28px;color:#ffd23f}
.card{position:absolute;width:220px;text-align:center}.card .t{font-size:30px;line-height:1.1;height:80px}
.card .phone{position:relative;border-radius:34px;padding:8px}.card .phone img{border-radius:27px}.card .phone:before{top:14px;height:14px}</style>
<div class=l><div class=kick>${esc(s.kick)}</div><h1>${rich(s.t1)}<br>${rich(s.t2)}</h1><div class=sub>${(s.sub || []).map(esc).join('<br>')}</div></div>
<div class=url>${esc(s.url)}</div>
${s.cards.slice(0, 3).map((c, i) => `<div class=card style="left:${pos[i][0]}px;top:${pos[i][1]}px"><div class=t>${esc(c.t1)}<br><span class=em>${esc(c.em)}</span></div><div class=phone><img src="${img(c.img)}"></div></div>`).join('')}`;
}

function calc(s) {
  return `<style>:root{--em1:#ffd23f;--em2:#ffb03f}
body{width:1080px;height:1350px;background:radial-gradient(700px 600px at 85% 75%,#1fa37a44,transparent 70%),linear-gradient(170deg,#0d2a26 0%,#070d0c 75%)}
.top{position:absolute;left:80px;top:110px;right:80px}.kick{font-size:38px;color:#8fe0c4}
h1{font-weight:400;font-size:116px;line-height:1.08;margin-top:16px}
.stats{position:absolute;left:80px;top:560px;display:flex;flex-direction:column;gap:30px}
.st{background:#ffffff0f;border:1px solid #ffffff22;border-radius:28px;padding:26px 34px;width:470px}
.st .n{white-space:nowrap;font-size:78px;color:#ffd23f;line-height:1}.st .l{font-size:32px;color:#ffffffbb;margin-top:10px}
.foot{position:absolute;left:80px;bottom:70px;font-size:28px;color:#ffffff88;line-height:1.5}.foot b{font-weight:400;color:#8fe0c4;font-size:34px}
.scr{background:#f7f4ec;color:#2b2b2b;border-radius:44px;height:700px;padding:80px 34px 30px}
.scr .h{font-size:40px;line-height:1.2;color:#1d5c4c}.scr .in{margin-top:26px;font-size:24px;color:#666}
.scr .in div,.scr .out div{display:flex;justify-content:space-between}.scr .in div{border-bottom:1px solid #ddd;padding:12px 0}.scr .in b{font-weight:400;color:#222}
.scr .out{margin-top:28px;background:#fff;border-radius:22px;padding:18px 22px;font-size:26px;box-shadow:0 4px 14px #0001}.scr .out div{padding:10px 0}
.scr .sum{color:#d0452b;font-size:32px;border-top:2px dashed #e3c9c3;margin-top:6px;padding-top:16px!important}</style>
<div class=top><div class=kick>${esc(s.kick)}</div><h1>${rich(s.t1)}<br>${rich(s.t2)}</h1></div>
<div class=stats>${s.stats.map((x) => `<div class=st><div class=n>${esc(x.n)}</div><div class=l>${(x.l || []).map(esc).join('<br>')}</div></div>`).join('')}</div>
<div class=phone style="width:440px;left:580px;top:500px;transform:rotate(4deg);--glow:#1fa37a66"><div class=scr>
<div class=h>${(s.screen.h || []).map(esc).join('<br>')}</div>
<div class=in>${s.screen.inputs.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div>
<div class=out>${s.screen.rows.map(([k, v], i, a) => `<div${i === a.length - 1 ? ' class=sum' : ''}><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>
</div></div>
<div class=foot>${esc(s.note)}<br><b>${esc(s.url)}</b> ${esc(s.cta)}</div>`;
}

const KINDS = { vertical, poster, calc };

(async () => {
  const specs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  let bad = 0;
  for (const s of specs) {
    try {
      const [w, h] = SIZE[s.kind];
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const tmp = path.join(path.dirname(path.resolve(s.out)), '.' + path.basename(s.out) + '.html');
      fs.mkdirSync(path.dirname(tmp), { recursive: true });
      fs.writeFileSync(tmp, `<!doctype html><meta charset=utf-8><style>${BASE}</style>${KINDS[s.kind](s)}`);
      await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      // 제목이 화면 밖으로 넘치면 실패로 본다(문구가 길면 사람이 줄여야 함)
      const over = await page.evaluate(() => [...document.querySelectorAll('h1,.st .n')].some((e) => e.getBoundingClientRect().right > innerWidth - 20));
      if (over) throw new Error('제목·숫자가 화면 밖으로 넘쳐요. 문구를 줄여 주세요');
      await page.screenshot({ path: s.out, type: s.out.endsWith('.png') ? 'png' : 'jpeg', ...(s.out.endsWith('.png') ? {} : { quality: 90 }) });
      fs.unlinkSync(tmp);
      await page.close();
      console.log('만듦', s.out);
    } catch (e) { bad++; console.error('실패', s.out, e.message); }
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
