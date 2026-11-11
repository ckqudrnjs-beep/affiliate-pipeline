"""'돈 줍는 삼촌' 상품 계산 사이트 정적 생성기 (2026-11-08, PLAN.md C안).

config/site_products.csv → site/ (index.html, 카테고리, 상품별 페이지).
상품마다 '알리가 vs 쿠팡가' 차액·기다림 값·한 달 비용을 계산하고, 사람이 쓴 한 줄 판단(note)을 붙인다.
note가 비어 있는 상품은 얇은 자동 페이지가 되므로 만들지 않는다.
"""
from __future__ import annotations

import csv
import datetime as dt
import html
import json
import pathlib
import re
import sys

from .calcs import CALC_CSS, CALCS, COMMON_JS
from .compliance import ALLOWED_LINK_HOSTS
from . import news as N
from . import articles as A
from . import prices as PR
from urllib.parse import urlparse

BRAND = "돈 줍는 삼촌"
CATEGORIES = {"clean": "청소", "heat": "겨울 난방", "living": "생활·조명", "humidify": "겨울 가습",
              "kitchen": "주방", "digital": "IT·디지털", "goods": "생활 잡화", "car": "자동차", "humidity": "습도 관리", "tools": "공구"}
# 쿠팡 파트너스 공식 권장 문구를 그대로 쓴다 ("포스팅" 대신 바꾸지 않음)
DISCLOSURE = ("이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. "
              "알리익스프레스 어필리에이트 링크도 포함되어 있어 구매 시 일정액의 수수료를 제공받습니다.")
MIN_NOTE = 40
_cfg_path = pathlib.Path("config/site.json")
CFG = json.loads(_cfg_path.read_text(encoding="utf-8")) if _cfg_path.exists() else {}
# 애드센스 심사: 제휴 링크 위주의 짧은 상품 페이지는 검색 색인·사이트맵에서 빼고 광고도 넣지 않는다 (config 로 끌 수 있음)
PRODUCT_NOINDEX = bool(CFG.get("productNoindex", True))
BASE = CFG.get("baseUrl", "https://don3chon.com").rstrip("/")  # 판단 글이 이보다 짧으면 페이지를 만들지 않는다


def won(n: int) -> str:
    return f"{n:,}원"


CHANGE_PCT = 10


def price_history(data_dir: str = "data") -> dict[str, list[tuple[str, int]]]:
    hist: dict[str, list[tuple[str, int]]] = {}
    for f in sorted(pathlib.Path(data_dir, "prices").glob("*.csv")):
        with open(f, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                if row.get("aliPrice"):
                    hist.setdefault(row["slug"], []).append((row["date"], int(row["aliPrice"])))
    for v in hist.values():
        v.sort()
    return hist


def load(path="config/site_products.csv", allow_examples: bool = False, data_dir: str = "data") -> list[dict]:
    with open(path, encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r.get("slug") and not r["slug"].startswith("#")]
    # 상품 원장: data/products/<slug>.json (상품당 파일 하나, 변경 이력은 Git). 판매 종료(status != active)는 뺀다.
    for f in sorted(pathlib.Path(data_dir, "products").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("status", "active") == "active":
            rows.append({k: str(v) for k, v in d.items()})
    hist = price_history(data_dir)
    out = []
    for r in rows:
        h = hist.get(r["slug"])
        if h:  # 가장 최근 기록 가격으로 갱신하고, 최근 30일 최저가를 붙인다
            base, base_date = r.get("aliPrice"), r.get("priceDate")
            r["aliPrice"], r["priceDate"] = str(h[-1][1]), h[-1][0]
            if base and base.isdigit() and int(base) > 0:  # 소개 당시 가격과 10% 넘게 달라지면 표시
                ch = round((h[-1][1] - int(base)) / int(base) * 100)
                if abs(ch) >= CHANGE_PCT:
                    r["change"], r["basePrice"], r["baseDate"] = str(ch), base, base_date or ""
            last30 = [pr for d, pr in h if dt.date.fromisoformat(d) >= dt.date.fromisoformat(h[-1][0]) - dt.timedelta(days=30)]
            if len(last30) >= 7:
                r["low30"] = str(min(last30))
        # 예시 줄(가짜 가격·링크)은 실제 사이트에 내보내지 않는다 (쿠팡 약관 8조 2항 19호, 표시광고법)
        if any("EXAMPLE" in (r.get(k) or "") for k in ("aliUrl", "coupangUrl")) and not allow_examples:
            print(f"건너뜀(예시 데이터): {r['slug']}", file=sys.stderr)
            continue
        if len((r.get("note") or "").strip()) < MIN_NOTE:
            print(f"건너뜀(판단 글 부족): {r['slug']}", file=sys.stderr)
            continue
        for k in ("aliUrl", "coupangUrl"):
            host = urlparse(r.get(k) or "").hostname or ""
            if r.get(k) and host not in ALLOWED_LINK_HOSTS:
                raise ValueError(f"{r['slug']}: 허용되지 않은 링크 도메인 {host}")
        out.append(r | calc(r))
    return out


def calc(r: dict) -> dict:
    ali = int(r["aliPrice"])
    days, life = int(r.get("shipDays") or 10), max(int(r.get("lifeMonths") or 12), 1)
    if not str(r.get("coupangPrice") or "").strip():  # 쿠팡 비교 전: 알리 단독 소개
        return {"solo": True, "diff": 0, "ratio": 0, "perDay": 0, "wait": days, "monthAli": ali // life, "monthCp": 0,
                "aliWins": True, "verdict": "알리 단독 소개"}
    cp = int(r["coupangPrice"])
    diff = cp - ali
    ratio = round(diff / cp * 100) if cp else 0
    wait = max(days - 1, 1)  # 쿠팡 로켓배송 하루 기준
    per_day = diff // wait
    ali_wins = diff >= 5000 and ratio >= 25
    return {"diff": diff, "ratio": ratio, "perDay": per_day, "wait": wait,
            "monthAli": ali // life, "monthCp": cp // life, "aliWins": ali_wins,
            "verdict": ("급하지 않으면 알리" if ali_wins else "쿠팡이 낫다"), "solo": False}


CSS = """
/* 큐레이션 매장: 미색 바탕·먹색 글자·깊은 초록 하나. 명조 제목, 넓은 여백, 큰 상품 사진 */
:root{--bg:#f7f6f2;--card:#ffffff;--ink:#1b1c1a;--muted:#6b6d66;--line:#e2e0d8;--green:#1f4d3a;--greenbg:#eef2ee;
--coin:#1f4d3a;--coin-ink:#ffffff;--hero:#f7f6f2;--hero-ink:#1b1c1a;--shadow:none;--img:#ecebe5;
--display:"Noto Serif KR","AppleMyungjo","Batang",serif;--body:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;--mono:"Noto Sans KR","Apple SD Gothic Neo",sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141513;--card:#1b1c1a;--ink:#ecebe6;--muted:#a3a59d;--line:#2d2f2b;--green:#8fc2a6;--greenbg:#1f2a24;--coin:#8fc2a6;--coin-ink:#10140f;--hero:#141513;--hero-ink:#ecebe6;--img:#23251f;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#141513;--card:#1b1c1a;--ink:#ecebe6;--muted:#a3a59d;--line:#2d2f2b;--green:#8fc2a6;--greenbg:#1f2a24;--coin:#8fc2a6;--coin-ink:#10140f;--hero:#141513;--hero-ink:#ecebe6;--img:#23251f;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.75 var(--body);word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
a{color:var(--ink)}
.wrap{max-width:1080px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px))}
main.wrap{padding-block:8px 80px}
/* 쿠팡 가이드(공지 160): 상단 표시는 본문보다 크거나 눈에 띄는 색. 본문 16px과 같은 크기 + 초록 강조 */
.adbar{font-size:16px;font-weight:600;color:var(--green);background:var(--greenbg);border-bottom:1px solid var(--line);line-height:1.6}
.adbar .wrap{padding-block:8px}
header.top{border-bottom:1px solid var(--line);background:var(--bg)}
header.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-block:22px}
.logo{font:600 22px/1 var(--display);color:var(--ink);text-decoration:none;letter-spacing:-.02em}
.logo small{display:block;font:500 10px/1 var(--body);letter-spacing:.32em;color:var(--muted);margin-top:6px}
nav.menu{display:flex;gap:26px}nav.menu a{font-size:14px;color:var(--muted);text-decoration:none}
nav.menu a:hover{color:var(--ink)}
.logo,nav.menu a{white-space:nowrap}
@media (max-width:640px){header.top .wrap{flex-wrap:wrap;gap:4px;padding-block:16px 4px}nav.menu{width:100%;gap:20px;overflow-x:auto}nav.menu a{font-size:14px}}
.hero .wrap{padding-block:72px 56px;text-align:left}
@media (max-width:640px){.hero .wrap{padding-block:44px 36px}}
.eyebrow{font-size:12px;letter-spacing:.24em;color:var(--green);font-weight:600;margin:0 0 14px}
.hero h1{font:500 clamp(34px,6vw,60px)/1.18 var(--display);margin:0;letter-spacing:-.03em;text-wrap:balance}
.hero p{margin:20px 0 0;color:var(--muted);max-width:44ch;font-size:17px}
h1{font:500 36px/1.3 var(--display);margin:40px 0 10px;text-wrap:balance;letter-spacing:-.02em}
h2{font:500 28px/1.3 var(--display);margin:0;letter-spacing:-.02em;text-wrap:balance}
.sechead{display:flex;justify-content:space-between;align-items:end;gap:16px;border-top:1px solid var(--ink);padding-top:18px;margin:56px 0 28px}
.sechead span{font-size:13px;color:var(--muted)}
.sechead a{padding:10px 0}
nav.menu a{padding:10px 0}
footer a{display:inline-block;padding:8px 0}
.lede{color:var(--muted);max-width:62ch;margin:0}
.picks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px 28px}
@media (max-width:860px){.picks{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:520px){.picks{grid-template-columns:minmax(0,1fr)}}
.pick{display:flex;flex-direction:column;gap:10px;color:inherit;text-decoration:none}
.pick.lead{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:40px;align-items:center}
@media (max-width:720px){.pick.lead{grid-template-columns:minmax(0,1fr);gap:16px}}
.ph{aspect-ratio:4/3;max-width:100%;background:var(--img);display:grid;place-items:center;overflow:hidden;position:relative}
.ph img,.ph video{width:100%;height:100%;object-fit:contain;transition:transform .6s}
.pick:hover .ph img{transform:scale(1.03)}
.ph em{font:500 15px var(--display);font-style:normal;color:var(--muted);padding:20px;text-align:center}
@media (max-width:520px){.sechead span{display:none}}
.cat{font-size:12px;letter-spacing:.18em;color:var(--muted)}
.pick .nm{font:500 21px/1.4 var(--display);letter-spacing:-.02em}
.pick.lead .nm{font-size:clamp(26px,3.4vw,36px)}
.why{color:var(--muted);font-size:15px;margin:0}
.price{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;font-variant-numeric:tabular-nums;border-top:1px solid var(--line);padding-top:10px}
.price b{font-weight:600}.chg{font-size:12px;font-weight:600;padding:1px 8px;border:1px solid currentColor}.chg.down{color:var(--green)}.chg.up{color:#8a4b2a}.price .v{color:var(--green);font-weight:600}
.picks.compact{grid-template-columns:repeat(4,minmax(0,1fr));gap:32px 20px}
@media (max-width:960px){.picks.compact{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:720px){.picks.compact{grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 14px}}
.picks.compact .why,.picks.compact .cat{display:none}.picks.compact .nm{font-size:17px}.picks.compact .price{font-size:13px;gap:8px}
.chips{display:flex;gap:8px;margin:0 0 8px;position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0;overflow-x:auto;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}.chips a{flex:none;white-space:nowrap;padding:8px 14px;border:1px solid var(--line);color:inherit;text-decoration:none;font-size:14px;background:var(--bg)}.chips a:hover{border-color:var(--ink)}.chips a[aria-current=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.catgroup{padding-top:28px;scroll-margin-top:64px}.catgroup h3{font:500 20px/1.4 var(--display);margin:0 0 16px;padding-bottom:10px;border-bottom:1px solid var(--line)}
/* 모바일 홈: 섹션 접고 펴기. 내용은 HTML에 그대로 있고(검색·광고 크롤러가 읽음) 화면에서만 접는다. JS가 없으면 모두 펼쳐진 채로 보인다. */
.foldbtn{display:none}
@media (max-width:720px){
.fold>.sechead{cursor:pointer;margin:0;padding:16px 0;align-items:center;border-top:1px solid var(--line);-webkit-tap-highlight-color:transparent}
.fold:first-of-type>.sechead,section.fold#picks>.sechead{border-top-color:var(--ink)}
.fold>.sechead h2{font-size:21px;flex:1;min-width:0}
.fold>.sechead span:not(.foldbtn){display:none}
#all.fold>.sechead span:not(.foldbtn){display:inline;font-size:12px;white-space:nowrap}
.fold>.sechead>a.small{display:none}
.fold .foldbtn{display:grid;place-items:center;flex:none;width:32px;height:32px;border:1px solid var(--line);border-radius:50%;background:none;transition:transform .2s}
.fold .foldbtn::before{content:"";width:8px;height:8px;border-right:1.5px solid var(--ink);border-bottom:1.5px solid var(--ink);transform:translateY(-2px) rotate(45deg)}
.fold.open>.sechead .foldbtn{transform:rotate(180deg)}
section.fold:not(.open)>:not(.sechead){display:none}
.fold.open>.sechead{margin-bottom:20px}
.fold.open>.sechead>a.small{display:inline}
.fold.open{padding-bottom:12px}
.catgroup.fold>h3{cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin:0;padding:14px 0;font-size:18px}
.catgroup.fold{padding-top:0}
.catgroup.fold>h3 .foldbtn{width:28px;height:28px}
.catgroup.fold.open>h3{margin-bottom:16px}
.catgroup.fold.open>h3 .foldbtn{transform:rotate(180deg)}
.catgroup.fold:not(.open)>:not(h3){display:none}
}
.more{font-size:14px;font-weight:600;text-decoration:underline;text-underline-offset:4px}
.principles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}
@media (max-width:720px){.principles{grid-template-columns:minmax(0,1fr)}}
.principles div{border-top:1px solid var(--line);padding-top:16px}
.principles b{font:500 19px/1.4 var(--display);display:block;margin-bottom:6px}
.principles p{margin:0;color:var(--muted);font-size:15px}
.toolrow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--line);background:var(--card)}
@media (max-width:720px){.toolrow{grid-template-columns:minmax(0,1fr)}}
.toolrow a{display:flex;flex-direction:column;gap:4px;padding:22px 24px;text-decoration:none;color:var(--ink);border-right:1px solid var(--line)}
.toolrow a:last-child{border-right:0}
@media (max-width:720px){.toolrow a{border-right:0;border-bottom:1px solid var(--line)}.toolrow a:last-child{border-bottom:0}}
.toolrow a b{font:500 18px/1.4 var(--display)}.toolrow a span{font-size:14px;color:var(--muted)}
.toolrow a:hover b{text-decoration:underline;text-underline-offset:4px}
.item{display:flex;flex-direction:column;gap:6px;background:var(--card);border:1px solid var(--line);padding:18px;color:inherit;text-decoration:none}
.item:hover{border-color:var(--ink)}.item .nm{font:500 18px/1.4 var(--display)}
.row{display:flex;justify-content:space-between;font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}
.bar{display:none}.save{font-size:14px;color:var(--green);font-weight:600}
.pill{align-self:flex-start;font-size:11px;letter-spacing:.12em;font-weight:600;color:var(--green)}
.pill.cp{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:16px}
.receipt{background:var(--card);border:1px solid var(--line);padding:22px 24px;font-size:15px;line-height:2.1;font-variant-numeric:tabular-nums;max-width:560px}
.receipt div{display:flex;justify-content:space-between;gap:12px}.receipt .sum{border-top:1px solid var(--ink);margin-top:8px;padding-top:8px;color:var(--green);font-weight:600}
.verdict{font:500 26px/1.35 var(--display);margin:28px 0 6px}.verdict span{color:var(--green)}
.note{max-width:62ch}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 6px}
.btn{padding:14px 26px;text-decoration:none;font-weight:600;font-size:15px;border:1px solid var(--ink);color:var(--ink)}
.btn.main{background:var(--ink);color:var(--bg)}
.btn:focus-visible,.pick:focus-visible,.toolrow a:focus-visible{outline:2px solid var(--green);outline-offset:4px}
.small{font-size:13px;color:var(--muted)}
.ad{font-size:16px;font-weight:600;color:var(--green);border-left:3px solid var(--green);padding:4px 12px}
nav.cats{display:none}
footer{border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
footer .wrap{padding-block:32px 48px}
.adfit{display:flex;justify-content:center;margin:32px 0 0}
footer .foot{margin-bottom:8px;color:var(--ink)}
@media (prefers-reduced-motion:reduce){.ph img{transition:none}}
"""
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600&family=Noto+Sans+KR:wght@400;500;600&display=swap">'

ICONS = {
    "electric": '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    "aliexpress": '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
    "heater": '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/></svg>',
}


# 상품 영상: PC는 마우스를 올린 카드만, 모바일은 화면 가운데 카드만 재생 (전부 동시에 움직이지 않게)
VIDEO_JS = """(()=>{const vs=[...document.querySelectorAll('.ph video')];if(!vs.length)return;
const play=v=>{v.play().catch(()=>{})},stop=v=>{v.pause();v.load()};
if(matchMedia('(hover:hover)').matches){vs.forEach(v=>{const c=v.closest('.pick')||v.parentNode;
c.addEventListener('mouseenter',()=>play(v));c.addEventListener('mouseleave',()=>stop(v))});return}
if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
const io=new IntersectionObserver(es=>es.forEach(x=>x.isIntersecting?play(x.target):stop(x.target)),{rootMargin:'-40% 0px -40% 0px'});
vs.forEach(v=>io.observe(v))})()"""


def adsense_client() -> str:
    """config/site.json 의 adsensePublisherId (pub-… 또는 ca-pub-…) → ca-pub-… . 비어 있으면 광고 코드를 넣지 않는다."""
    pid = (CFG.get("adsensePublisherId") or "").strip()
    if not re.fullmatch(r"(ca-)?pub-\d{10,20}", pid):
        return ""
    return pid if pid.startswith("ca-") else "ca-" + pid


def adfit_slot(ads: bool) -> str:
    """config/site.json 의 adfitUnit (카카오 애드핏 광고 단위 ID, DAN-…) 이 있으면 본문 아래 배너 1개. 상품 페이지(ads=False)는 제외."""
    unit = (CFG.get("adfitUnit") or "").strip()
    if not ads or not re.fullmatch(r"DAN-[A-Za-z0-9]{6,40}", unit):
        return ""
    return (f'<div class="adfit"><ins class="kakao_ad_area" style="display:none" data-ad-unit="{unit}" data-ad-width="320" data-ad-height="100"></ins>'
            '<script async src="https://t1.daumcdn.net/kas/static/ba.min.js"></script></div>')


def page(title: str, desc: str, body: str, root: str = "", path: str = "", ld: dict | None = None, hero: str = "",
         ads: bool = True, noindex: bool = False) -> str:
    """ads=False: 애드센스 코드 제외(상품 페이지). noindex=True: 검색 색인 제외(제휴 위주 얇은 페이지)."""
    e = html.escape
    client = adsense_client()
    url = f"{BASE}/{path}"
    meta = "".join(f'<meta name="{n}" content="{e(CFG[k])}">' for n, k in
                   (("google-site-verification", "googleSiteVerification"), ("naver-site-verification", "naverSiteVerification")) if CFG.get(k))
    ld = ld or {"@context": "https://schema.org", "@type": "WebPage", "name": title, "description": desc, "url": url}
    head = (f'<link rel="canonical" href="{url}"><meta property="og:type" content="website"><meta property="og:site_name" content="{BRAND}">'
            f'<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}">'
            f'<meta property="og:locale" content="ko_KR">{meta}'
            + (f'<meta name="google-adsense-account" content="{client}">' if client else "")
            + ('<meta name="robots" content="noindex,follow">' if noindex else "")
            + (f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={client}" crossorigin="anonymous"></script>' if client and ads else "")
            + f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title>
<meta name="description" content="{e(desc)}">{head}<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#1f4d3a">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="alternate" type="application/rss+xml" title="{BRAND} 소식" href="/feed.xml">{FONTS}<style>{CSS}{CALC_CSS}{N.NEWS_CSS}{N.ARCHIVE_CSS}{A.CSS}{PR.CSS}</style></head><body>
<div class="adbar"><div class="wrap">[광고] {DISCLOSURE}</div></div>
<header class="top"><div class="wrap"><a class="logo" href="{root}index.html">돈 줍는 삼촌<small>DON3CHON</small></a>
<nav class="menu"><a href="{root}guide.html">글</a><a href="{root}news.html">소식</a><a href="{root}index.html#picks">삼촌의 선택</a><a href="{root}index.html#calcs">계산기</a><a href="{root}prices.html">가격 기록</a><a href="{root}faq.html">질문</a></nav></div></header>
{hero}<main class="wrap">{body}{adfit_slot(ads)}</main>
<footer><div class="wrap"><nav class="foot"><a href="{root}about.html">소개</a> · <a href="{root}contact.html">문의</a> · <a href="{root}privacy.html">개인정보처리방침</a></nav>가격은 표시한 날짜 기준이며 바뀔 수 있습니다. 구매 전 판매 페이지에서 최종 가격·배송일을 확인하세요.<br>{BRAND} · 제휴 링크로 구매하셔도 가격은 같습니다.</div></footer>
<script>{VIDEO_JS}</script>
</body></html>"""


def media(p: dict, root: str = "") -> str:
    """10초 이내 사용 영상(videoUrl)이 있으면 마우스를 올린(모바일: 화면 가운데) 카드만 소리 없이 재생, 없으면 사진, 둘 다 없으면 이름."""
    e = html.escape
    img = e(p.get("imageUrl") or "")
    if p.get("videoUrl"):
        v = p["videoUrl"] if p["videoUrl"].startswith("http") else root + p["videoUrl"]
        return (f'<video src="{e(v)}" poster="{img}" muted loop playsinline preload="metadata" '
                f'aria-label="{e(p["name"])} 사용 영상"></video>')
    return f'<img src="{img}" alt="{e(p["name"])}" loading="lazy">' if img else f'<em>{e(p["name"])}</em>'


def change_badge(p: dict) -> str:
    if not p.get("change"):
        return ""
    c = int(p["change"])
    return (f'<span class="chg down">소개 때보다 {-c}% 내렸어요</span>' if c < 0
            else f'<span class="chg up">소개 때보다 {c}% 올랐어요</span>')


def price_line(p: dict) -> str:
    if p.get("solo"):
        return f'<span class="price"><span>알리 <b>{won(int(p["aliPrice"]))}</b></span><span class="v">해외 배송</span>{change_badge(p)}</span>'
    return (f'<span class="price"><span>알리 <b>{won(int(p["aliPrice"]))}</b></span><span>쿠팡 <b>{won(int(p["coupangPrice"]))}</b></span>'
            f'<span class="v">{p["verdict"]}</span></span>')


def pick(p: dict, lead: bool = False) -> str:
    e = html.escape
    d = dt.date.fromisoformat(p["priceDate"])
    return f"""<a class="pick{' lead' if lead else ''}" href="p/{p['slug']}.html"><div class="ph">{media(p)}</div><div style="display:flex;flex-direction:column;gap:10px">
<span class="cat">{e(CATEGORIES.get(p['category'], ''))}</span><span class="nm">{e(p['name'])}</span><p class="why">{e(p['note'])}</p>
{price_line(p)}
<span class="small">{d.month}월 {d.day}일 기준{'' if p.get('solo') else ' · 기능이 비슷한 제품 비교'}</span><span class="more">{'자세히 보기' if p.get('solo') else '계산 보기'}</span></div></a>"""


def card(p: dict, root: str = "") -> str:
    e = html.escape
    if p.get("solo"):
        return f"""<a class="item" href="{root}p/{p['slug']}.html"><span class="nm">{e(p['name'])}</span>
<span class="row"><span>알리 {won(int(p['aliPrice']))}</span><span>해외 배송</span></span></a>"""
    pill = '<span class="pill">급하지 않으면 알리</span>' if p["aliWins"] else '<span class="pill cp">쿠팡이 낫다</span>'
    return f"""<a class="item" href="{root}p/{p['slug']}.html">{pill}<span class="nm">{e(p['name'])}</span>
<span class="row"><span>알리 {won(int(p['aliPrice']))}</span><span>쿠팡 {won(int(p['coupangPrice']))}</span></span>
<span class="bar"><span style="width:{max(0, min(p['ratio'], 100))}%"></span></span>
<span class="save">알리 쪽이 {won(p['diff'])} 낮음 ({p['ratio']}%)</span></a>"""


def product_page(p: dict) -> str:
    e = html.escape
    d = dt.date.fromisoformat(p["priceDate"])
    when = f"{d.month}월 {d.day}일 기준"
    cat = CATEGORIES.get(p["category"], p["category"])
    first, second = (("aliUrl", "알리에서 보기"), ("coupangUrl", "쿠팡에서 보기")) if p["aliWins"] else (("coupangUrl", "쿠팡에서 보기"), ("aliUrl", "알리에서 보기"))
    btns = "".join(f'<a class="btn{" main" if i == 0 else ""}" href="{e(p[k])}" rel="sponsored nofollow noopener" target="_blank">{t}</a>'
                   for i, (k, t) in enumerate((first, second)) if p.get(k))
    if p.get("solo"):
        head = f"""<h1>{e(p['name'])}</h1>
<p class="lede">{when} 알리익스프레스 가격입니다.</p>
<div class="ph" style="max-width:560px;margin-top:24px">{media(p, "../")}</div>
<h2 style="margin-top:32px">삼촌의 계산</h2>
<div class="receipt">
<div><span>알리 (해외 배송)</span><span>{won(int(p['aliPrice']))}</span></div>
{f'<div><span>소개 당시 가격 ({p["baseDate"]})</span><span>{won(int(p["basePrice"]))} · {change_badge(p)}</span></div>' if p.get("change") else ''}
{f'<div><span>알리 최근 30일 최저가</span><span>{won(int(p["low30"]))}</span></div>' if p.get("low30") else ''}
<div class="sum"><span>{p.get('lifeMonths') or 12}개월 쓰면 한 달에</span><span>{won(p['monthAli'])}</span></div>
</div>"""
    else:
        head = None
    if head:
        top = f'<p class="small"><a class="backall" href="../index.html#all-{p["category"]}">← {e(cat)} 물건 모두 보기</a></p>\n' + head + "\n"
    else:
        top = f"""<p class="small"><a class="backall" href="../index.html#all-{p['category']}">← {e(cat)} 물건 모두 보기</a></p>
<h1>{e(p['name'])}, 알리 vs 쿠팡 얼마 차이?</h1>
<p class="lede">{when}. 기능이 비슷한 제품의 알리익스프레스 가격과 쿠팡 가격을 나란히 두고 계산했습니다. 같은 제품이 아니므로 사양·구성은 판매 페이지에서 확인하세요.</p>
<h2>삼촌의 계산</h2>
<div class="receipt">
<div><span>쿠팡 (로켓배송 약 1일)</span><span>{won(int(p['coupangPrice']))}</span></div>
<div><span>알리 (배송 약 {p['shipDays']}일)</span><span>{won(int(p['aliPrice']))}</span></div>
<div class="sum"><span>차액</span><span>{won(p['diff'])} ({p['ratio']}%)</span></div>
{f'<div><span>알리 최근 30일 최저가</span><span>{won(int(p["low30"]))}</span></div>' if p.get("low30") else ''}
<div><span>하루 더 기다릴 때마다</span><span>{won(p['perDay'])} 절약</span></div>
<div><span>{p['lifeMonths']}개월 쓰면 한 달에</span><span>알리 {won(p['monthAli'])} / 쿠팡 {won(p['monthCp'])}</span></div>
</div>
<p class="verdict">결론: <span>{p['verdict']}</span></p>
"""
    body = top + PR.product_block(HIST.get(p["slug"])) + f"""<p class="note">{e(p['note'])}</p>
<p class="small">구매 전 확인: {e(p['check'])}</p>
<p class="ad">[광고] 아래 버튼은 제휴 링크입니다. 구매 시 {BRAND}이 일정액의 수수료를 받습니다.</p>
<div class="btns">{btns}</div>
<p><button type="button" class="zzim" id="zzimbtn" aria-pressed="false" data-item="{e(json.dumps({"slug": p["slug"], "name": p["name"], "price": int(p["aliPrice"]), "date": p["priceDate"]}, ensure_ascii=False))}">찜하기</button></p>
<script>{N.PRODUCT_JS}{BACK_JS}</script>"""
    if head:  # 알리 단독
        return page(f"{p['name']} 가격·한 달 비용 | {BRAND}", f"{p['name']} 알리 {won(int(p['aliPrice']))} ({when}). {p['note'][:80]}",
                    body, root="../", path=f"p/{p['slug']}.html", ads=False, noindex=PRODUCT_NOINDEX)
    return page(f"{p['name']} 알리 vs 쿠팡 가격 계산 | {BRAND}",
                f"{p['name']} 알리 {won(int(p['aliPrice']))}, 쿠팡 {won(int(p['coupangPrice']))}. 차액 {won(p['diff'])}, 결론: {p['verdict']}.",
                body, root="../", path=f"p/{p['slug']}.html", ads=False, noindex=PRODUCT_NOINDEX)


BACK_JS = r"""(function(){var a=document.querySelector('a.backall');if(!a)return;
a.addEventListener('click',function(e){try{var r=new URL(document.referrer);
if(r.origin===location.origin&&/\/(index\.html)?$/.test(r.pathname)&&history.length>1){e.preventDefault();history.back();}}catch(x){}});})();"""


# 모바일(720px 이하) 홈에서만 섹션을 접는다. 첫 화면엔 "이번 주 삼촌의 선택"만 펼침.
# 메뉴의 #picks·#calcs 같은 주소로 들어오면 그 섹션을 펼친다. 상태는 저장하지 않는다.
FOLD_JS = r"""(function(){
var mq=window.matchMedia('(max-width:720px)');if(!mq.matches)return;
function setup(el,head,open){el.classList.add('fold');if(open)el.classList.add('open');
var b=document.createElement('span');b.className='foldbtn';b.setAttribute('aria-hidden','true');head.appendChild(b);
head.setAttribute('role','button');head.setAttribute('tabindex','0');head.setAttribute('aria-expanded',open?'true':'false');
function t(e){if(e&&e.target.closest('a'))return;var o=el.classList.toggle('open');head.setAttribute('aria-expanded',o?'true':'false');}
head.addEventListener('click',t);head.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();t();}});}
document.querySelectorAll('main>section').forEach(function(s){var h=s.querySelector(':scope>.sechead');if(h&&!s.hidden)setup(s,h,s.id==='picks');});
function openTo(id){var el=id&&document.getElementById(id);if(!el)return;
for(var n=el;n;n=n.parentElement){if(n.classList&&n.classList.contains('fold')&&!n.classList.contains('open')){n.classList.add('open');var h=n.querySelector(':scope>.sechead,:scope>h3');if(h)h.setAttribute('aria-expanded','true');}}
el.scrollIntoView();}
openTo(decodeURIComponent(location.hash.slice(1)));
window.addEventListener('hashchange',function(){openTo(decodeURIComponent(location.hash.slice(1)));});
})();"""


# "모든 물건": 분야 버튼은 화면 위에 붙어 따라오고, 누르면 그 분야만 보여 준다.
# 상품을 보러 갔다가 돌아오면(뒤로 가기·분야 링크) 고른 분야와 보던 위치로 돌아온다.
ALL_JS = r"""(function(){
var all=document.getElementById('all');if(!all)return;
var bar=all.querySelector('.chips'),groups=all.querySelectorAll('.catgroup');
function show(cat,scroll){groups.forEach(function(g){g.hidden=!!cat&&g.id!==cat;});
bar.querySelectorAll('a').forEach(function(a){var on=a.dataset.cat===(cat||'');a.setAttribute('aria-current',on?'true':'false');if(on)bar.scrollLeft=a.offsetLeft-bar.clientWidth/2+a.offsetWidth/2;});
if(all.classList.contains('fold'))all.classList.add('open');
history.replaceState(null,'',cat?'#all-'+cat:'#all');
if(scroll)window.scrollTo(0,all.getBoundingClientRect().top+window.scrollY-8);}
bar.addEventListener('click',function(e){var a=e.target.closest('a[data-cat]');if(!a)return;e.preventDefault();show(a.dataset.cat,true);});
all.addEventListener('click',function(e){if(!e.target.closest('a.pick'))return;
try{sessionStorage.setItem('allPos',JSON.stringify({cat:(location.hash.match(/^#all-(.+)$/)||[])[1]||'',y:window.scrollY}));}catch(x){}});
function restore(){var h=decodeURIComponent(location.hash.slice(1)),saved=null;
try{saved=JSON.parse(sessionStorage.getItem('allPos')||'null');sessionStorage.removeItem('allPos');}catch(x){}
var m=h.match(/^all-(.+)$/),cat=m?m[1]:(document.getElementById(h)&&document.getElementById(h).classList.contains('catgroup')?h:null);
if(saved&&(h==='all'||m||!h)){show(saved.cat,false);window.scrollTo(0,saved.y);return;}
if(cat||h==='all')show(cat||'',true);}
restore();window.addEventListener('pageshow',function(e){if(e.persisted)restore();});
})();"""


def index_page(products: list[dict]) -> str:
    e = html.escape
    ranked = sorted(products, key=lambda p: (not p.get("videoUrl"), -p["diff"]))
    picks = "".join(pick(p, i == 0) for i, p in enumerate(ranked[:4]))
    cats = [c for c in CATEGORIES if any(p["category"] == c for p in products)]
    chips = '<a href="#all" data-cat="" aria-current="true">전체</a>' + "".join(
        f'<a href="#all-{c}" data-cat="{c}">{e(CATEGORIES[c])}</a>' for c in cats)
    groups = "".join(f'<div class="catgroup" id="{c}"><h3>{e(CATEGORIES[c])}</h3><div class="picks compact">'
                     + "".join(pick(p) for p in ranked if p["category"] == c) + "</div></div>" for c in cats)
    all_sec = f"""<section id="all"><div class="sechead"><h2>모든 물건</h2><span>{len(products)}개 · 분야별</span></div>
<nav class="chips" aria-label="분야">{chips}</nav>{groups}</section>""" if products else ""
    tools = "".join(f'<a href="calc/{c["slug"]}.html"><b>{e(c["h1"])}</b><span>{e(c["title"])}</span></a>' for c in CALCS)
    hero = """<section class="hero"><div class="wrap"><p class="eyebrow">CURATED BY 돈 줍는 삼촌</p>
<h1>좋은 물건을,<br>제값에.</h1>
<p>삼촌이 가격을 나란히 놓고 계산해 본 뒤 고른 물건만 소개합니다. 차액이 작으면 빠른 배송을, 크면 기다림을 권합니다.</p></div></section>"""
    picks_sec = f"""<section id="picks"><div class="sechead"><h2>이번 주 삼촌의 선택</h2><span>가격은 표시한 날짜 기준</span></div>
<div class="picks">{picks}</div></section>""" if products else """<section id="picks"><div class="sechead"><h2>이번 주 삼촌의 선택</h2></div>
<p class="lede">가격을 계산해 본 첫 상품들을 준비하고 있어요. 찜해 둘 만한 물건이 올라오면 소식에서 알려 드릴게요.</p></section>"""
    news, sales = N.load_json("data/news.json"), N.load_json("data/sales.json")
    prices = json.dumps({p["slug"]: int(p["aliPrice"]) for p in products})
    body = f"""{N.home_block(news, sales)}
{picks_sec}
{A.home_block(A.load())}
{all_sec}
<section id="how"><div class="sechead"><h2>삼촌이 고르는 기준</h2></div>
<div class="principles"><div><b>차액을 계산합니다</b><p>알리와 쿠팡에서 기능이 비슷한 제품의 가격을 같은 날짜로 나란히 놓고 차액과 비율을 계산합니다.</p></div>
<div><b>기다림에도 값을 매깁니다</b><p>해외 배송을 하루 더 기다릴 때마다 얼마를 아끼는지 보여 드립니다. 몇천 원 차이면 빠른 배송을 권합니다.</p></div>
<div><b>쓰는 비용까지 봅니다</b><p>전기요금과 소모품처럼 사고 나서 드는 돈을 함께 계산해 1년 기준으로 판단합니다.</p></div></div></section>
<section id="calcs"><div class="sechead"><h2>사기 전에 계산해 보세요</h2><span>무료 · 회원가입 없음</span></div>
<div class="toolrow">{tools}</div></section>
<script>window.PRICES={prices};{N.HOME_JS}</script>
<script>{FOLD_JS}{ALL_JS}</script>"""
    return page(f"{BRAND} | 계산해 보고 고른 물건", "삼촌이 알리와 쿠팡 가격을 계산해 보고 고른 물건을 소개합니다. 전기요금·직구 세금·난방비 계산기도 무료로 쓸 수 있어요.", body,
                ld={"@context": "https://schema.org", "@type": "WebSite", "name": BRAND, "url": BASE + "/", "inLanguage": "ko"}, hero=hero)


def calc_page(c: dict, products: list[dict]) -> str:
    e = html.escape
    rel = "".join(card(p, "../") for p in products if c["category"] and p["category"] == c["category"])[:20000]
    rel = f'<h2>관련 상품 계산</h2><div class="grid">{rel}</div>' if rel else ""
    ids = ",".join(f"'{i}'" for i in c["ids"])
    body = f"""<p class="small"><a href="../index.html">계산기 모음</a></p>
<h1>{e(c['h1'])}</h1><p class="lede">{e(c['lede'])}</p>
<div class="calc"><form id="f" onsubmit="event.preventDefault()">{c['form']}</form>
<div><div class="receipt" id="out" aria-live="polite"></div><p class="cmp" id="cmp"></p>
<button type="button" id="share">결과 링크 복사</button><p class="small" id="shareMsg"></p></div></div>
{c['body']}
<p class="small">요금·세율은 2025~2026년 공개 기준으로 만든 근사치입니다. 실제 고지서·세관 부과액과 다를 수 있습니다.</p>
{rel}
<script>{COMMON_JS}{c['js']}
const ids=[{ids}];readQS(ids);bindShare(ids);$('#f').addEventListener('input',run);run();</script>"""
    return page(f"{c['title']} | {BRAND}", c["lede"], body, root="../", path=f"calc/{c['slug']}.html",
                ld={"@context": "https://schema.org", "@type": "WebApplication", "name": c["title"], "url": f"{BASE}/calc/{c['slug']}.html",
                    "applicationCategory": "UtilitiesApplication", "operatingSystem": "Web", "inLanguage": "ko",
                    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "KRW"}})


PRIVACY = """<h1>개인정보처리방침</h1>
<p class="small">시행일: 2026년 11월 11일</p>
<h2>1. 수집하는 개인정보</h2>
<p class="note">돈 줍는 삼촌(don3chon.com, 이하 '사이트')은 회원가입·댓글·결제 기능이 없으며 이름·전화번호 같은 개인정보를 직접 수집하지 않습니다. 계산기에 넣은 값과 '찜하기' 목록은 이용자의 브라우저(localStorage)에만 저장되고 서버로 전송되지 않습니다.</p>
<h2>2. 쿠키와 광고</h2>
<p class="note">이 사이트는 Google AdSense와 카카오 애드핏 광고를 게재할 수 있습니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 이용자의 이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 보여 줄 수 있습니다. Google은 광고 쿠키를 사용해 이용자에게 맞춤 광고를 제공합니다.</p>
<p class="note">이 사이트는 카카오 애드핏 광고도 게재할 수 있으며, 카카오도 광고 제공을 위해 쿠키 등 행태정보를 사용할 수 있습니다. 카카오의 맞춤형 광고는 <a href="https://info.ad.daum.net/optout.html" rel="noopener" target="_blank">카카오 광고 설정</a>에서 끌 수 있습니다.</p>
<p class="note">맞춤 광고는 <a href="https://adssettings.google.com" rel="noopener" target="_blank">Google 광고 설정</a>에서 끌 수 있고, 제3자 사업자의 맞춤 광고 쿠키는 <a href="https://www.aboutads.info/choices/" rel="noopener" target="_blank">aboutads.info</a>에서 끌 수 있습니다. Google이 데이터를 사용하는 방식은 <a href="https://policies.google.com/technologies/partner-sites?hl=ko" rel="noopener" target="_blank">Google 파트너 사이트 정책</a>에서 볼 수 있습니다. 브라우저 설정에서 쿠키를 차단할 수도 있습니다.</p>
<h2>3. 제휴 링크</h2>
<p class="note">사이트에는 쿠팡 파트너스, 알리익스프레스 어필리에이트, 네이버 쇼핑 커넥트 제휴 링크가 있습니다. 링크를 누르면 해당 쇼핑몰이 쿠키로 구매 여부를 확인하며, 구매가 일어나면 사이트 운영자가 수수료를 받습니다. 이용자가 내는 가격은 같습니다.</p>
<h2>4. 방문 통계</h2>
<p class="note">사이트는 Cloudflare Web Analytics로 방문 수를 집계합니다. 이 도구는 쿠키를 쓰지 않고 개인을 식별하지 않는 형태로 페이지 조회 수만 셉니다.</p>
<h2>5. 문의</h2>
<p class="note">개인정보 관련 문의는 <a href="contact.html">문의 페이지</a>의 연락처로 보내 주세요. 이 방침이 바뀌면 이 페이지에 시행일과 함께 알립니다.</p>"""

ABOUT = """<h1>돈 줍는 삼촌 소개</h1>
<p class="lede">사기 전에 한 번 계산해 보는 살림 사이트입니다.</p>
<h2>어떤 사이트인가요</h2>
<p class="note">'돈 줍는 삼촌'은 가전 전기요금, 해외 직구 세금, 난방비처럼 물건을 사기 전에 궁금한 것을 숫자로 풀어 보는 개인 사이트입니다. 같은 돈을 써도 덜 새게 쓰는 방법을 조카에게 알려 주듯 쉽게 적는 것이 목표예요.</p>
<h2>여기서 할 수 있는 것</h2>
<ul class="note">
<li><a href="guide.html">삼촌의 글</a>: 생활비·가전·직구에 관한 계산 글</li>
<li><a href="index.html#calcs">무료 계산기</a>: 전기요금, 알리 직구 실제가, 난방기기 비교, 대기전력</li>
<li><a href="prices.html">알리 가격 기록</a>: 소개한 물건의 가격을 매일 기록하고, 지금이 싼 편인지 판정</li>
<li><a href="news.html">삼촌 소식</a>: 날짜별 살림 소식</li>
<li><a href="index.html#picks">삼촌의 선택</a>: 가격을 계산해 보고 고른 물건</li>
</ul>
<h2>글을 쓰는 원칙</h2>
<ul class="note">
<li>숫자는 출처(한전 요금표, 관세청 기준, 판매 페이지 가격)와 기준 날짜를 함께 적습니다.</li>
<li>직접 써 보지 않은 물건을 써 본 것처럼 쓰지 않습니다.</li>
<li>가격은 바뀌므로 구매 전 판매 페이지에서 최종 가격을 확인하도록 안내합니다.</li>
</ul>
<h2>광고와 제휴</h2>
<p class="note">사이트 운영비는 광고와 제휴 수수료로 충당합니다. 상품 링크는 쿠팡 파트너스·알리익스프레스 어필리에이트·네이버 쇼핑 커넥트 제휴 링크이며, 링크가 있는 곳에는 [광고] 표시를 붙입니다. 수수료를 받는다고 추천 순서나 계산 결과를 바꾸지 않습니다.</p>
<h2>운영자</h2>
<p class="note">돈 줍는 삼촌 (사업자 운영). 유튜브·인스타그램에서도 같은 이름으로 활동합니다. 문의는 <a href="contact.html">문의 페이지</a>로 보내 주세요.</p>"""


def contact_body() -> str:
    email = (CFG.get("contactEmail") or "").strip()
    line = (f'<a href="mailto:{html.escape(email)}">{html.escape(email)}</a>' if email else "이메일 주소 준비 중")
    return f"""<h1>문의</h1>
<p class="lede">글 내용의 오류, 계산기 문제, 제휴·광고 문의를 받습니다.</p>
<h2>이메일</h2>
<p class="note">{line}</p>
<p class="note">보통 2~3일 안에 답장드립니다. 잘못된 숫자나 바뀐 가격을 알려 주시면 확인 후 글을 고치고 고친 날짜를 적어 둡니다.</p>
<h2>참고</h2>
<p class="note">이 사이트는 물건을 직접 팔지 않습니다. 주문·배송·환불은 구매하신 쇼핑몰(쿠팡, 알리익스프레스, 네이버) 고객센터로 문의해 주세요.</p>"""


HIST: dict = {}


def build(out="site", src="config/site_products.csv", allow_examples: bool = False) -> int:
    products = load(src, allow_examples)
    HIST.clear(); HIST.update(price_history())
    o = pathlib.Path(out)
    (o / "p").mkdir(parents=True, exist_ok=True)
    (o / "calc").mkdir(exist_ok=True)
    for c in CALCS:
        (o / "calc" / f"{c['slug']}.html").write_text(calc_page(c, products), encoding="utf-8")
    (o / "privacy.html").write_text(page(f"개인정보처리방침 | {BRAND}", "개인정보처리방침", PRIVACY, path="privacy.html"), encoding="utf-8")
    (o / "prices.html").write_text(page(f"알리 가격 기록 | {BRAND}", "삼촌이 소개한 물건의 알리 가격을 매일 기록해, 지금이 싼 편인지 판정합니다.",
        PR.page_body(products, HIST), path="prices.html"), encoding="utf-8")
    (o / "about.html").write_text(page(f"소개 | {BRAND}", "돈 줍는 삼촌은 사기 전에 한 번 계산해 보는 살림 사이트입니다. 운영 원칙과 광고·제휴 안내.", ABOUT, path="about.html"), encoding="utf-8")
    (o / "contact.html").write_text(page(f"문의 | {BRAND}", "돈 줍는 삼촌에 글 오류, 계산기 문제, 제휴 문의를 보내는 방법.", contact_body(), path="contact.html"), encoding="utf-8")
    client = adsense_client()
    if client:  # ads.txt: 게시자 ID 가 있을 때만
        (o / "ads.txt").write_text(f"google.com, {client.removeprefix('ca-')}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    (o / "index.html").write_text(index_page(products), encoding="utf-8")
    for p in products:
        (o / "p" / f"{p['slug']}.html").write_text(product_page(p), encoding="utf-8")
    news = N.load_json("data/news.json")
    (o / "news.html").write_text(page(f"삼촌 소식 | {BRAND}", "계산해서 아끼는 살림 소식을 날짜별로 모았습니다.",
        N.archive_body(news), path="news.html"), encoding="utf-8")
    (o / "news").mkdir(exist_ok=True)
    for n in news:
        (o / "news" / f"{n['id']}.html").write_text(page(f"{n['title']} | {BRAND}", n["body"][:150], N.news_page_body(n), root="../",
            path=f"news/{n['id']}.html", ld={"@context": "https://schema.org", "@type": "Article", "headline": n["title"],
            "datePublished": n["date"], "inLanguage": "ko", "author": {"@type": "Organization", "name": BRAND}}), encoding="utf-8")
    arts = A.load()
    by_slug = {p["slug"]: p for p in products}
    (o / "guide").mkdir(exist_ok=True)
    (o / "guide.html").write_text(page(f"삼촌의 글 | {BRAND}", "가전 전기요금, 직구 세금, 난방비처럼 사기 전에 궁금한 것을 계산으로 답합니다.",
        A.list_body(arts), path="guide.html"), encoding="utf-8")
    naver = A.load_naver()
    for a in arts:
        cards = "".join(card(by_slug[s], "../") for s in a.get("products", [])[:2] if s in by_slug)
        nv = A.naver_box(A.naver_for(a, naver))
        (o / "guide" / f"{a['slug']}.html").write_text(page(f"{a['title']} | {BRAND}", a["desc"], A.page_body(a, cards, nv), root="../",
            path=f"guide/{a['slug']}.html", ld=A.ld(a, BASE)), encoding="utf-8")
    faq = N.load_json("data/faq.json")
    (o / "faq.html").write_text(page(f"자주 묻는 질문 | {BRAND}", "제휴 링크, 직구 세금, 전기요금 계산에 대해 자주 묻는 질문입니다.",
        N.faq_body(faq), path="faq.html", ld=N.faq_ld(faq)), encoding="utf-8")
    (o / "feed.xml").write_text(N.feed_xml(news, BASE, BRAND), encoding="utf-8")
    (o / "manifest.webmanifest").write_text(json.dumps(N.MANIFEST, ensure_ascii=False), encoding="utf-8")
    # 아이콘은 static/ 에 미리 만들어 둔다 (Cloudflare 빌드 환경에는 Pillow 가 없다)
    for f in pathlib.Path("static").rglob("*"):  # 하위 폴더(video/ 등)도 그대로 복사
        if f.is_file():
            t = o / f.relative_to("static")
            t.parent.mkdir(parents=True, exist_ok=True)
            t.write_bytes(f.read_bytes())
    urls = ["", "guide.html", "news.html", "prices.html", "faq.html"] + [f"guide/{a['slug']}.html" for a in arts] + [f"news/{n['id']}.html" for n in news] + [f"calc/{c['slug']}.html" for c in CALCS] + ([] if PRODUCT_NOINDEX else [f"p/{p['slug']}.html" for p in products]) + ["about.html", "contact.html", "privacy.html"]
    today = dt.date.today().isoformat()
    (o / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"<url><loc>{BASE}/{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (o / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")
    return len(products)


if __name__ == "__main__":
    print(f"{build(*sys.argv[1:])}개 상품 페이지 생성")
