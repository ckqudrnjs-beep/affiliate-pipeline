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
from urllib.parse import urlparse

BRAND = "돈 줍는 삼촌"
CATEGORIES = {"humidify": "겨울 가습", "heat": "겨울 난방·단열"}
DISCLOSURE = ("이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. "
              "알리익스프레스 어필리에이트 링크도 포함되어 있어 구매 시 일정액의 수수료를 제공받습니다.")
MIN_NOTE = 40
_cfg_path = pathlib.Path("config/site.json")
CFG = json.loads(_cfg_path.read_text(encoding="utf-8")) if _cfg_path.exists() else {}
BASE = CFG.get("baseUrl", "https://don3chon.com").rstrip("/")  # 판단 글이 이보다 짧으면 페이지를 만들지 않는다


def won(n: int) -> str:
    return f"{n:,}원"


def load(path="config/site_products.csv") -> list[dict]:
    with open(path, encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r.get("slug") and not r["slug"].startswith("#")]
    out = []
    for r in rows:
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
    ali, cp = int(r["aliPrice"]), int(r["coupangPrice"])
    days, life = int(r["shipDays"]), max(int(r["lifeMonths"]), 1)
    diff = cp - ali
    ratio = round(diff / cp * 100) if cp else 0
    wait = max(days - 1, 1)  # 쿠팡 로켓배송 하루 기준
    per_day = diff // wait
    ali_wins = diff >= 5000 and ratio >= 25
    return {"diff": diff, "ratio": ratio, "perDay": per_day, "wait": wait,
            "monthAli": ali // life, "monthCp": cp // life, "aliWins": ali_wins,
            "verdict": ("급하지 않으면 알리" if ali_wins else "쿠팡이 낫다")}


CSS = """
/* 레이아웃: 흰 바탕 + 초록 첫 화면 띠 + 둥근 카드. 동전 노랑은 강조 한 곳에만 */
:root{--bg:#f6f8f6;--card:#ffffff;--ink:#14201a;--muted:#5b6b62;--line:#e3e9e5;--green:#0e8a5f;--green-d:#0a6b49;--greenbg:#e7f5ee;
--coin:#ffc531;--coin-ink:#5a4300;--hero:#0e8a5f;--hero-ink:#ffffff;--shadow:0 1px 2px rgba(20,32,26,.06),0 8px 24px rgba(20,32,26,.06);
--display:"Jua","Apple SD Gothic Neo",sans-serif;--body:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1512;--card:#17201b;--ink:#e8efe9;--muted:#9db0a5;--line:#26332c;--green:#3ccf8e;--green-d:#2fb37a;--greenbg:#173326;--coin:#ffcf4d;--coin-ink:#2b2000;--hero:#0d3a29;--hero-ink:#eafff4;--shadow:none;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1512;--card:#17201b;--ink:#e8efe9;--muted:#9db0a5;--line:#26332c;--green:#3ccf8e;--green-d:#2fb37a;--greenbg:#173326;--coin:#ffcf4d;--coin-ink:#2b2000;--hero:#0d3a29;--hero-ink:#eafff4;--shadow:none;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 var(--body);word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
a{color:var(--green)}
.wrap{max-width:960px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main.wrap{padding-block:8px 56px}
.adbar{background:var(--card);border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted);line-height:1.5}
.adbar .wrap{padding-block:7px}
header.top{background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:env(safe-area-inset-top,0px);z-index:5}
header.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-block:12px}
.logo{display:flex;align-items:center;gap:10px;font:24px/1 var(--display);color:var(--ink);text-decoration:none}
.logo i{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--coin);color:var(--coin-ink);font:700 17px var(--body);font-style:normal;box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.logo b{color:var(--green);font-weight:400}
nav.menu{display:flex;gap:4px}nav.menu a{font-size:14px;font-weight:500;color:var(--muted);text-decoration:none;padding:6px 10px;border-radius:8px}
nav.menu a:hover{background:var(--greenbg);color:var(--green)}
@media (max-width:520px){nav.menu{display:none}}
.hero{background:var(--hero);color:var(--hero-ink)}
.hero .wrap{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:28px;align-items:center;padding-block:44px}
@media (max-width:760px){.hero .wrap{grid-template-columns:minmax(0,1fr);padding-block:32px;gap:20px}}
.hero h1{font:44px/1.2 var(--display);margin:0 0 12px;text-wrap:balance;font-weight:400}
.hero h1 em{font-style:normal;color:var(--coin)}
.hero p{margin:0;opacity:.88;max-width:40ch;font-size:17px}
.hero .cta{display:inline-block;margin-top:20px;background:var(--coin);color:var(--coin-ink);font-weight:700;padding:13px 22px;border-radius:12px;text-decoration:none}
.hero .cta:focus-visible{outline:3px solid var(--hero-ink);outline-offset:3px}
.demo{background:var(--card);color:var(--ink);border-radius:18px;padding:18px 20px;box-shadow:0 12px 32px rgba(0,0,0,.18)}
.demo .t{font-size:13px;color:var(--muted);margin-bottom:6px}
.demo .r{display:flex;justify-content:space-between;font:15px/2 var(--mono);font-variant-numeric:tabular-nums}
.demo .r.big{border-top:1px dashed var(--line);margin-top:6px;padding-top:6px;color:var(--green);font-weight:600;font-size:17px}
h1{font:34px/1.25 var(--display);margin:28px 0 8px;text-wrap:balance;font-weight:400}
h2{font:26px/1.3 var(--display);margin:44px 0 6px;font-weight:400;text-wrap:balance}
.lede{color:var(--muted);max-width:62ch;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:16px}
.item{display:flex;flex-direction:column;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;color:inherit;text-decoration:none;box-shadow:var(--shadow);transition:transform .15s,border-color .15s}
.item:hover,.item:focus-visible{border-color:var(--green);transform:translateY(-2px);outline:none}
.item .nm{font-weight:700;font-size:17px;line-height:1.4}
.row{display:flex;justify-content:space-between;font:14px/1.5 var(--mono);font-variant-numeric:tabular-nums;color:var(--muted)}
.bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden}.bar span{display:block;height:100%;background:var(--green);border-radius:99px}
.save{font:600 15px/1.4 var(--mono);color:var(--green);font-variant-numeric:tabular-nums}
.pill{align-self:flex-start;font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;background:var(--coin);color:var(--coin-ink)}
.pill.cp{background:var(--greenbg);color:var(--green)}
.receipt{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;font:15px/2 var(--mono);font-variant-numeric:tabular-nums;box-shadow:var(--shadow)}
.receipt div{display:flex;justify-content:space-between;gap:12px}.receipt .sum{border-top:1px dashed var(--line);margin-top:6px;padding-top:6px;color:var(--green);font-weight:600;font-size:17px}
.verdict{font:26px/1.3 var(--display);margin:20px 0 4px}.verdict span{color:var(--green)}
.note{max-width:62ch}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 6px}
.btn{padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700;border:1.5px solid var(--green);color:var(--green)}
.btn.main{background:var(--green);color:#fff}
.btn:focus-visible{outline:3px solid var(--coin);outline-offset:2px}
.small{font-size:13px;color:var(--muted)}
.ad{font-size:13px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 12px}
nav.cats{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}nav.cats a{font-size:14px;font-weight:500;padding:6px 14px;border-radius:99px;background:var(--card);border:1px solid var(--line);color:var(--ink);text-decoration:none}
footer{border-top:1px solid var(--line);background:var(--card);font-size:13px;color:var(--muted)}
footer .wrap{padding-block:22px 32px}
@media (prefers-reduced-motion:reduce){.item{transition:none}.item:hover{transform:none}}
"""
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=IBM+Plex+Mono:wght@400;600&family=Noto+Sans+KR:wght@400;500;700&display=swap">'

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
<meta name="description" content="{e(desc)}">{head}{FONTS}<style>{CSS}{CALC_CSS}</style></head><body>
<div class="adbar"><div class="wrap">[광고] {DISCLOSURE}</div></div>
<header class="top"><div class="wrap"><a class="logo" href="{root}index.html"><i>₩</i>돈 줍는 <b>삼촌</b></a>
<nav class="menu"><a href="{root}index.html#calcs">계산기</a><a href="{root}index.html#compare">알리 vs 쿠팡</a></nav></div></header>
{hero}<main class="wrap">{body}</main>
<footer><div class="wrap"><a href="{root}privacy.html">개인정보처리방침</a> · 가격은 표시한 날짜 기준이며 바뀔 수 있습니다. 구매 전 판매 페이지에서 최종 가격·배송일을 확인하세요.<br>{BRAND} · 제휴 링크로 구매하셔도 가격은 같습니다.</div></footer>
</body></html>"""


def card(p: dict, root: str = "") -> str:
    e = html.escape
    pill = '<span class="pill">급하지 않으면 알리</span>' if p["aliWins"] else '<span class="pill cp">쿠팡이 낫다</span>'
    return f"""<a class="item" href="{root}p/{p['slug']}.html">{pill}<span class="nm">{e(p['name'])}</span>
<span class="row"><span>알리 {won(int(p['aliPrice']))}</span><span>쿠팡 {won(int(p['coupangPrice']))}</span></span>
<span class="bar"><span style="width:{max(0, min(p['ratio'], 100))}%"></span></span>
<span class="save">알리가 {won(p['diff'])} 싸요 ({p['ratio']}%)</span></a>"""


def product_page(p: dict) -> str:
    e = html.escape
    d = dt.date.fromisoformat(p["priceDate"])
    when = f"{d.month}월 {d.day}일 기준"
    cat = CATEGORIES.get(p["category"], p["category"])
    first, second = (("aliUrl", "알리에서 보기"), ("coupangUrl", "쿠팡에서 보기")) if p["aliWins"] else (("coupangUrl", "쿠팡에서 보기"), ("aliUrl", "알리에서 보기"))
    btns = "".join(f'<a class="btn{" main" if i == 0 else ""}" href="{e(p[k])}" rel="sponsored nofollow noopener" target="_blank">{t}</a>'
                   for i, (k, t) in enumerate((first, second)) if p.get(k))
    body = f"""<p class="small"><a href="../index.html#{p['category']}">{e(cat)}</a></p>
<h1>{e(p['name'])}, 알리 vs 쿠팡 얼마 차이?</h1>
<p class="lede">{when}. 같은 종류 제품의 알리익스프레스 가격과 쿠팡 가격을 나란히 두고 계산했습니다.</p>
<h2>삼촌의 계산</h2>
<div class="receipt">
<div><span>쿠팡 (로켓배송 약 1일)</span><span>{won(int(p['coupangPrice']))}</span></div>
<div><span>알리 (배송 약 {p['shipDays']}일)</span><span>{won(int(p['aliPrice']))}</span></div>
<div class="sum"><span>차액</span><span>{won(p['diff'])} ({p['ratio']}%)</span></div>
<div><span>하루 더 기다릴 때마다</span><span>{won(p['perDay'])} 절약</span></div>
<div><span>{p['lifeMonths']}개월 쓰면 한 달에</span><span>알리 {won(p['monthAli'])} / 쿠팡 {won(p['monthCp'])}</span></div>
</div>
<p class="verdict">결론: <span>{p['verdict']}</span></p>
<p class="note">{e(p['note'])}</p>
<p class="small">구매 전 확인: {e(p['check'])}</p>
<p class="ad">[광고] 아래 버튼은 제휴 링크입니다. 구매 시 {BRAND}이 일정액의 수수료를 받습니다.</p>
<div class="btns">{btns}</div>"""
    return page(f"{p['name']} 알리 vs 쿠팡 가격 계산 | {BRAND}",
                f"{p['name']} 알리 {won(int(p['aliPrice']))}, 쿠팡 {won(int(p['coupangPrice']))}. 차액 {won(p['diff'])}, 결론: {p['verdict']}.",
                body, root="../", path=f"p/{p['slug']}.html")


def index_page(products: list[dict]) -> str:
    cats = "".join(f'<a href="#{k}">{v}</a>' for k, v in CATEGORIES.items())
    secs = "".join(
        f'<section id="{k}"><h2>{v}</h2><div class="grid">{"".join(card(p) for p in products if p["category"] == k)}</div></section>'
        for k, v in CATEGORIES.items() if any(p["category"] == k for p in products))
    tools = "".join(f'<a class="tool" href="calc/{c["slug"]}.html"><i>{ICONS.get(c["slug"], "")}</i><b>{html.escape(c["h1"])}</b>'
                    f'<span>{html.escape(c["lede"])}</span><u>계산하기 →</u></a>' for c in CALCS)
    hero = """<section class="hero"><div class="wrap"><div><h1>사기 전에, 쓰기 전에<br><em>삼촌이 계산</em>해 줄게</h1>
<p>전기요금, 직구 세금, 난방비. 숫자 몇 개만 넣으면 한 달에 얼마 아끼는지 바로 보여 드려요.</p>
<a class="cta" href="calc/heater.html">난방비 계산해 보기</a></div>
<div class="demo" aria-label="계산 예시"><div class="t">예시 · 하루 8시간, 한 달 30일, 평소 300kWh 쓰는 집</div>
<div class="r"><span>온풍기 2,000W</span><span>169,790원</span></div><div class="r"><span>전기요 100W</span><span>6,180원</span></div>
<div class="r big"><span>전기요로 바꾸면</span><span>163,610원 절약</span></div></div></div></section>"""
    body = f"""<section id="calcs"><h2>무료 생활 계산기</h2><p class="lede">결과는 링크로 저장하고 가족·친구에게 보낼 수 있어요.</p>
<div class="tools">{tools}</div></section>
<section id="compare"><h2>알리 vs 쿠팡, 얼마 차이?</h2>
<p class="lede">같은 종류 제품을 두 곳 가격으로 나란히 놓고 계산했어요. 차액이 작으면 솔직하게 쿠팡을 권해요.</p>
<nav class="cats">{cats}</nav>{secs}</section>"""
    return page(f"{BRAND} | 생활 계산기와 알리·쿠팡 가격 비교", "전기요금, 알리 직구 세금, 난방비를 계산하고 알리와 쿠팡 가격 차이를 비교합니다.", body,
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


def build(out="site", src="config/site_products.csv") -> int:
    products = load(src)
    o = pathlib.Path(out)
    (o / "p").mkdir(parents=True, exist_ok=True)
    (o / "calc").mkdir(exist_ok=True)
    for c in CALCS:
        (o / "calc" / f"{c['slug']}.html").write_text(calc_page(c, products), encoding="utf-8")
    (o / "privacy.html").write_text(page(f"개인정보처리방침 | {BRAND}", "개인정보처리방침", PRIVACY, path="privacy.html"), encoding="utf-8")
    (o / "index.html").write_text(index_page(products), encoding="utf-8")
    for p in products:
        (o / "p" / f"{p['slug']}.html").write_text(product_page(p), encoding="utf-8")
    urls = [""] + [f"calc/{c['slug']}.html" for c in CALCS] + [f"p/{p['slug']}.html" for p in products] + ["privacy.html"]
    today = dt.date.today().isoformat()
    (o / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"<url><loc>{BASE}/{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (o / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")
    return len(products)


if __name__ == "__main__":
    print(f"{build(*sys.argv[1:])}개 상품 페이지 생성")
