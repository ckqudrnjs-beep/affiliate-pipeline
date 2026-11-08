"""즐겨찾기 유도 장치 (2026-11-09): 삼촌 소식(날짜별 누적), 세일 달력(D-day), 찜한 상품, 홈 화면 추가(PWA), RSS.

소식은 data/news.json 에 사람이 확인한 글만 쌓는다. 다른 사이트 글을 긁어 오지 않는다(저작권, 쿠팡 약관 22·23호).
세일은 각 쇼핑몰이 공식 공개한 행사만 data/sales.json 에 넣는다. D-day 는 방문 시점에 브라우저가 계산한다.
"""
from __future__ import annotations

import html
import json
import pathlib
from email.utils import format_datetime
import datetime as dt

NEWS_CSS = """
.keep{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--line);background:var(--card);padding:14px 18px;margin-top:8px;font-size:14px}
.keep b{font-weight:600}.keep button{font:600 14px var(--body);border:1px solid var(--ink);background:var(--ink);color:var(--bg);padding:9px 16px;cursor:pointer}
.keep button:focus-visible,.zzim:focus-visible{outline:2px solid var(--green);outline-offset:3px}
.twocol{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:40px}
@media (max-width:820px){.twocol{grid-template-columns:minmax(0,1fr);gap:8px}}
.news{list-style:none;margin:0;padding:0}
.news li{border-bottom:1px solid var(--line);padding:18px 0}
.news li:first-child{padding-top:0}
.ntag{font-size:12px;letter-spacing:.14em;color:var(--green);font-weight:600}
.ndate{font-size:12px;color:var(--muted);margin-left:8px;font-variant-numeric:tabular-nums}
.news h3{font:500 20px/1.45 var(--display);margin:6px 0 6px;letter-spacing:-.02em}
.news p{margin:0;color:var(--muted);font-size:15px}
.news a.go{display:inline-block;margin-top:8px;font-size:14px;font-weight:600;text-underline-offset:4px}
.cal{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.cal li{display:grid;grid-template-columns:72px minmax(0,1fr);gap:14px;align-items:center;padding:16px 0;border-bottom:1px solid var(--line)}
.dday{font:600 22px/1 var(--body);color:var(--green);font-variant-numeric:tabular-nums}
.dday.past{color:var(--muted);font-size:15px}
.cal b{display:block;font-weight:600}.cal span{font-size:13px;color:var(--muted)}
.zzimlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.zzimlist a{display:block;border:1px solid var(--line);background:var(--card);padding:14px 16px;color:var(--ink);text-decoration:none}
.zzimlist a b{display:block;font:500 17px/1.4 var(--display)}.zzimlist a span{font-size:13px;color:var(--muted)}
.zzimlist a em{font-style:normal;color:var(--green);font-weight:600;font-size:14px}
.zzim{font:600 15px var(--body);padding:14px 22px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
.zzim[aria-pressed="true"]{border-color:var(--green);color:var(--green)}
"""

ZZIM_JS = r"""
const ZK='don3chon-zzim';
function zget(){try{return JSON.parse(localStorage.getItem(ZK)||'[]')}catch(e){return []}}
function zset(v){try{localStorage.setItem(ZK,JSON.stringify(v))}catch(e){}}
"""

HOME_JS = ZZIM_JS + r"""
(function(){
 document.querySelectorAll('.dday[data-date]').forEach(el=>{const t=new Date(el.dataset.date+'T00:00:00+09:00'),now=new Date();
  const d=Math.ceil((t-now)/864e5);el.textContent=d>0?'D-'+d:d===0?'오늘':'지남';if(d<0)el.classList.add('past');});
 const list=zget(), box=document.getElementById('zzim');
 if(box&&list.length){const P=window.PRICES||{};box.hidden=false;
  box.querySelector('.zzimlist').innerHTML=list.map(z=>{const now=P[z.slug];let ch='';
   if(now!=null&&z.price){const d=z.price-now;ch=d>0?`<em>찜한 뒤 ${d.toLocaleString('ko-KR')}원 내렸어요</em>`:d<0?`<span>찜한 뒤 ${(-d).toLocaleString('ko-KR')}원 올랐어요</span>`:'<span>찜했을 때와 같아요</span>';}
   return `<a href="p/${z.slug}.html"><b>${z.name}</b>${ch}</a>`}).join('');}
 let ev=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();ev=e;});
 const kb=document.getElementById('keepbtn');
 if(kb)kb.addEventListener('click',async()=>{if(ev){ev.prompt();ev=null;return;}
  const m=/iphone|ipad/i.test(navigator.userAgent)?'Safari 아래 공유 버튼 → 홈 화면에 추가를 눌러 주세요.':/android/i.test(navigator.userAgent)?'브라우저 메뉴(⋮) → 홈 화면에 추가를 눌러 주세요.':'Ctrl+D(맥은 ⌘+D)를 누르면 즐겨찾기에 추가돼요.';
  document.getElementById('keepmsg').textContent=m;});
})();
"""

PRODUCT_JS = ZZIM_JS + r"""
(function(){const b=document.getElementById('zzimbtn');if(!b)return;const me=JSON.parse(b.dataset.item);
 const on=()=>zget().some(z=>z.slug===me.slug);const paint=()=>{b.setAttribute('aria-pressed',on());b.textContent=on()?'찜했어요 · 가격이 바뀌면 홈에서 보여 드려요':'찜하기';};
 b.addEventListener('click',()=>{let l=zget();l=on()?l.filter(z=>z.slug!==me.slug):[...l,me];zset(l);paint();});paint();})();
"""


def load_json(path: str) -> list[dict]:
    p = pathlib.Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def news_items(news: list[dict], root: str = "", limit: int | None = None) -> str:
    e = html.escape
    items = sorted(news, key=lambda n: n["date"], reverse=True)[:limit]
    out = []
    for n in items:
        d = dt.date.fromisoformat(n["date"])
        go = f'<a class="go" href="{root}{e(n["link"])}">{e(n.get("linkText") or "자세히")}</a>' if n.get("link") else ""
        out.append(f'<li id="n-{d.isoformat()}-{abs(hash(n["title"])) % 9999}"><span class="ntag">{e(n["type"])}</span><span class="ndate">{d.month}월 {d.day}일</span>'
                   f'<h3>{e(n["title"])}</h3><p>{e(n["body"])}</p>{go}</li>')
    return f'<ul class="news">{"".join(out)}</ul>'


def sales_list(sales: list[dict]) -> str:
    e = html.escape
    rows = "".join(f'<li><span class="dday" data-date="{e(s["date"])}">{dt.date.fromisoformat(s["date"]).month}/{dt.date.fromisoformat(s["date"]).day}</span>'
                   f'<div><b>{e(s["name"])}</b><span>{dt.date.fromisoformat(s["date"]).month}월 {dt.date.fromisoformat(s["date"]).day}일 · {e(s.get("note", ""))}</span></div></li>'
                   for s in sorted(sales, key=lambda s: s["date"]))
    return f'<ul class="cal">{rows}</ul>'


def home_block(news: list[dict], sales: list[dict]) -> str:
    return f"""<div class="keep"><span><b>세일 일정과 가격 소식이 계속 쌓여요.</b> 즐겨찾기해 두고 들러 주세요.</span>
<button type="button" id="keepbtn">즐겨찾기 · 홈 화면에 추가</button><span class="small" id="keepmsg" aria-live="polite"></span></div>
<section id="zzim" hidden><div class="sechead"><h2>내가 찜한 상품</h2><span>이 브라우저에만 저장돼요</span></div><div class="zzimlist"></div></section>
<section id="news"><div class="sechead"><h2>삼촌 소식</h2><a class="small" href="news.html">지난 소식 모두 보기</a></div>
<div class="twocol"><div>{news_items(news, limit=4)}</div><div><p class="cat" style="margin:0 0 6px">다가오는 세일</p>{sales_list(sales)}</div></div></section>"""


def feed_xml(news: list[dict], base: str, brand: str) -> str:
    e = html.escape
    items = "".join(
        f"<item><title>{e(n['title'])}</title><link>{base}/news.html</link><guid isPermaLink=\"false\">{e(n['date'] + n['title'])}</guid>"
        f"<pubDate>{format_datetime(dt.datetime.fromisoformat(n['date'] + 'T07:00:00+09:00'))}</pubDate><description>{e(n['body'])}</description></item>"
        for n in sorted(news, key=lambda n: n["date"], reverse=True)[:30])
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{e(brand)} 소식</title><link>{base}/</link>'
            f"<description>계산해서 아끼는 살림 소식</description><language>ko</language>{items}</channel></rss>\n")


MANIFEST = {"name": "돈 줍는 삼촌", "short_name": "돈 줍는 삼촌", "start_url": "/", "display": "standalone",
            "background_color": "#f7f6f2", "theme_color": "#1f4d3a", "lang": "ko",
            "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
                      {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}


def write_icons(out: pathlib.Path) -> None:
    from PIL import Image, ImageDraw
    for size in (192, 512, 180):
        im = Image.new("RGB", (size, size), "#1f4d3a")
        d = ImageDraw.Draw(im)
        r, c = size * 0.30, size / 2
        d.ellipse([c - r, c - r, c + r, c + r], fill="#f7f6f2")
        r2 = r * 0.72
        d.ellipse([c - r2, c - r2, c + r2, c + r2], outline="#1f4d3a", width=max(2, size // 48))
        w = size // 22
        d.line([c - r2 * .45, c - r2 * .35, c - r2 * .2, c + r2 * .4, c, c - r2 * .1, c + r2 * .2, c + r2 * .4, c + r2 * .45, c - r2 * .35], fill="#1f4d3a", width=w, joint="curve")
        d.line([c - r2 * .55, c, c + r2 * .55, c], fill="#1f4d3a", width=max(2, w // 2))
        im.save(out / ("apple-touch-icon.png" if size == 180 else f"icon-{size}.png"))
