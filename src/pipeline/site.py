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
import sys

from .calcs import CALC_CSS, CALCS, COMMON_JS
from .compliance import ALLOWED_LINK_HOSTS
from . import news as N
from urllib.parse import urlparse

BRAND = "돈 줍는 삼촌"
CATEGORIES = {"clean": "청소", "heat": "겨울 난방", "living": "생활·조명", "humidify": "겨울 가습"}
# 쿠팡 파트너스 공식 권장 문구를 그대로 쓴다 ("포스팅" 대신 바꾸지 않음)
DISCLOSURE = ("이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. "
              "알리익스프레스 어필리에이트 링크도 포함되어 있어 구매 시 일정액의 수수료를 제공받습니다.")
MIN_NOTE = 40
_cfg_path = pathlib.Path("config/site.json")
CFG = json.loads(_cfg_path.read_text(encoding="utf-8")) if _cfg_path.exists() else {}
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
.ph{aspect-ratio:4/5;max-width:100%;background:var(--img);display:grid;place-items:center;overflow:hidden;position:relative}
.pick.lead .ph{aspect-ratio:5/4}
.ph img,.ph video{width:100%;height:100%;object-fit:cover;transition:transform .6s}
.pick:hover .ph img{transform:scale(1.03)}
.ph em{font:500 15px var(--display);font-style:normal;color:var(--muted);padding:20px;text-align:center}
@media (max-width:520px){.ph,.pick.lead .ph{aspect-ratio:1/1}.sechead span{display:none}}
.cat{font-size:12px;letter-spacing:.18em;color:var(--muted)}
.pick .nm{font:500 21px/1.4 var(--display);letter-spacing:-.02em}
.pick.lead .nm{font-size:clamp(26px,3.4vw,36px)}
.why{color:var(--muted);font-size:15px;margin:0}
.price{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;font-variant-numeric:tabular-nums;border-top:1px solid var(--line);padding-top:10px}
.price b{font-weight:600}.chg{font-size:12px;font-weight:600;padding:1px 8px;border:1px solid currentColor}.chg.down{color:var(--green)}.chg.up{color:#8a4b2a}.price .v{color:var(--green);font-weight:600}
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
@media (prefers-reduced-motion:reduce){.ph img{transition:none}}
"""
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600&family=Noto+Sans+KR:wght@400;500;600&display=swap">'

ICONS = {
    "electric": '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    "aliexpress": '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
    "heater": '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/></svg>',
}


def page(title: str, desc: str, body: str, root: str = "", path: str = "", ld: dict | None = None, hero: str = "") -> str:
    e = html.escape
    url = f"{BASE}/{path}"
    meta = "".join(f'<meta name="{n}" content="{e(CFG[k])}">' for n, k in
                   (("google-site-verification", "googleSiteVerification"), ("naver-site-verification", "naverSiteVerification")) if CFG.get(k))
    ld = ld or {"@context": "https://schema.org", "@type": "WebPage", "name": title, "description": desc, "url": url}
    head = (f'<link rel="canonical" href="{url}"><meta property="og:type" content="website"><meta property="og:site_name" content="{BRAND}">'
            f'<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}">'
            f'<meta property="og:locale" content="ko_KR">{meta}<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title>
<meta name="description" content="{e(desc)}">{head}<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#1f4d3a">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="alternate" type="application/rss+xml" title="{BRAND} 소식" href="/feed.xml">{FONTS}<style>{CSS}{CALC_CSS}{N.NEWS_CSS}{N.ARCHIVE_CSS}</style></head><body>
<div class="adbar"><div class="wrap">[광고] {DISCLOSURE}</div></div>
<header class="top"><div class="wrap"><a class="logo" href="{root}index.html">돈 줍는 삼촌<small>DON3CHON</small></a>
<nav class="menu"><a href="{root}news.html">소식</a><a href="{root}index.html#picks">삼촌의 선택</a><a href="{root}index.html#calcs">계산기</a><a href="{root}faq.html">질문</a></nav></div></header>
{hero}<main class="wrap">{body}</main>
<footer><div class="wrap"><a href="{root}privacy.html">개인정보처리방침</a> · 가격은 표시한 날짜 기준이며 바뀔 수 있습니다. 구매 전 판매 페이지에서 최종 가격·배송일을 확인하세요.<br>{BRAND} · 제휴 링크로 구매하셔도 가격은 같습니다.</div></footer>
</body></html>"""


def media(p: dict, root: str = "") -> str:
    """10초 이내 사용 영상(videoUrl)이 있으면 소리 없이 반복 재생, 없으면 사진, 둘 다 없으면 이름."""
    e = html.escape
    img = e(p.get("imageUrl") or "")
    if p.get("videoUrl"):
        v = p["videoUrl"] if p["videoUrl"].startswith("http") else root + p["videoUrl"]
        return (f'<video src="{e(v)}" poster="{img}" muted autoplay loop playsinline preload="metadata" '
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
<p class="lede">{when}. 알리익스프레스 가격입니다. 쿠팡 비교가는 확인되는 대로 더합니다.</p>
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
        top = f'<p class="small"><a href="../index.html#{p["category"]}">{e(cat)}</a></p>\n' + head + "\n"
    else:
        top = f"""<p class="small"><a href="../index.html#{p['category']}">{e(cat)}</a></p>
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
    body = top + f"""<p class="note">{e(p['note'])}</p>
<p class="small">구매 전 확인: {e(p['check'])}</p>
<p class="ad">[광고] 아래 버튼은 제휴 링크입니다. 구매 시 {BRAND}이 일정액의 수수료를 받습니다.</p>
<div class="btns">{btns}</div>
<p><button type="button" class="zzim" id="zzimbtn" aria-pressed="false" data-item="{e(json.dumps({"slug": p["slug"], "name": p["name"], "price": int(p["aliPrice"]), "date": p["priceDate"]}, ensure_ascii=False))}">찜하기</button></p>
<script>{N.PRODUCT_JS}</script>"""
    if head:  # 알리 단독
        return page(f"{p['name']} 가격·한 달 비용 | {BRAND}", f"{p['name']} 알리 {won(int(p['aliPrice']))} ({when}). {p['note'][:80]}",
                    body, root="../", path=f"p/{p['slug']}.html")
    return page(f"{p['name']} 알리 vs 쿠팡 가격 계산 | {BRAND}",
                f"{p['name']} 알리 {won(int(p['aliPrice']))}, 쿠팡 {won(int(p['coupangPrice']))}. 차액 {won(p['diff'])}, 결론: {p['verdict']}.",
                body, root="../", path=f"p/{p['slug']}.html")


def index_page(products: list[dict]) -> str:
    e = html.escape
    ranked = sorted(products, key=lambda p: (not p.get("videoUrl"), -p["diff"]))
    picks = "".join(pick(p, i == 0) for i, p in enumerate(ranked[:7]))
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
<section id="how"><div class="sechead"><h2>삼촌이 고르는 기준</h2></div>
<div class="principles"><div><b>차액을 계산합니다</b><p>알리와 쿠팡에서 기능이 비슷한 제품의 가격을 같은 날짜로 나란히 놓고 차액과 비율을 계산합니다.</p></div>
<div><b>기다림에도 값을 매깁니다</b><p>해외 배송을 하루 더 기다릴 때마다 얼마를 아끼는지 보여 드립니다. 몇천 원 차이면 빠른 배송을 권합니다.</p></div>
<div><b>쓰는 비용까지 봅니다</b><p>전기요금과 소모품처럼 사고 나서 드는 돈을 함께 계산해 1년 기준으로 판단합니다.</p></div></div></section>
<section id="calcs"><div class="sechead"><h2>사기 전에 계산해 보세요</h2><span>무료 · 회원가입 없음</span></div>
<div class="toolrow">{tools}</div></section>
<script>window.PRICES={prices};{N.HOME_JS}</script>"""
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
<p class="note">돈 줍는 삼촌(don3chon.com)은 회원가입이 없고 이름·연락처 같은 개인정보를 수집하지 않습니다. 계산기에 넣은 값은 브라우저 안에서만 계산되며 서버에 저장되지 않습니다.</p>
<p class="note">이 사이트에는 쿠팡 파트너스와 알리익스프레스 어필리에이트 링크가 있습니다. 링크를 누르면 해당 쇼핑몰이 쿠키로 구매 여부를 확인할 수 있습니다. 앞으로 구글 애드센스 광고를 넣으면 구글이 광고 쿠키를 사용할 수 있으며, 그때 이 문서를 갱신합니다.</p>"""


def build(out="site", src="config/site_products.csv", allow_examples: bool = False) -> int:
    products = load(src, allow_examples)
    o = pathlib.Path(out)
    (o / "p").mkdir(parents=True, exist_ok=True)
    (o / "calc").mkdir(exist_ok=True)
    for c in CALCS:
        (o / "calc" / f"{c['slug']}.html").write_text(calc_page(c, products), encoding="utf-8")
    (o / "privacy.html").write_text(page(f"개인정보처리방침 | {BRAND}", "개인정보처리방침", PRIVACY, path="privacy.html"), encoding="utf-8")
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
    faq = N.load_json("data/faq.json")
    (o / "faq.html").write_text(page(f"자주 묻는 질문 | {BRAND}", "제휴 링크, 직구 세금, 전기요금 계산에 대해 자주 묻는 질문입니다.",
        N.faq_body(faq), path="faq.html", ld=N.faq_ld(faq)), encoding="utf-8")
    (o / "feed.xml").write_text(N.feed_xml(news, BASE, BRAND), encoding="utf-8")
    (o / "manifest.webmanifest").write_text(json.dumps(N.MANIFEST, ensure_ascii=False), encoding="utf-8")
    # 아이콘은 static/ 에 미리 만들어 둔다 (Cloudflare 빌드 환경에는 Pillow 가 없다)
    for f in pathlib.Path("static").glob("*"):
        (o / f.name).write_bytes(f.read_bytes())
    urls = ["", "news.html", "faq.html"] + [f"news/{n['id']}.html" for n in news] + [f"calc/{c['slug']}.html" for c in CALCS] + [f"p/{p['slug']}.html" for p in products] + ["privacy.html"]
    today = dt.date.today().isoformat()
    (o / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"<url><loc>{BASE}/{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (o / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")
    return len(products)


if __name__ == "__main__":
    print(f"{build(*sys.argv[1:])}개 상품 페이지 생성")
