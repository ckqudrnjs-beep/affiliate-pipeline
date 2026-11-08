"""'돈 줍는 삼촌' 상품 계산 사이트 정적 생성기 (2026-11-08, PLAN.md C안).

config/site_products.csv → site/ (index.html, 카테고리, 상품별 페이지).
상품마다 '알리가 vs 쿠팡가' 차액·기다림 값·한 달 비용을 계산하고, 사람이 쓴 한 줄 판단(note)을 붙인다.
note가 비어 있는 상품은 얇은 자동 페이지가 되므로 만들지 않는다.
"""
from __future__ import annotations

import csv
import datetime as dt
import html
import pathlib
import sys

from .compliance import ALLOWED_LINK_HOSTS
from urllib.parse import urlparse

BRAND = "돈 줍는 삼촌"
CATEGORIES = {"humidify": "겨울 가습", "heat": "겨울 난방·단열"}
DISCLOSURE = ("이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. "
              "알리익스프레스 어필리에이트 링크도 포함되어 있어 구매 시 일정액의 수수료를 제공받습니다.")
MIN_NOTE = 40  # 판단 글이 이보다 짧으면 페이지를 만들지 않는다


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
:root{--paper:#f3f5f1;--card:#ffffff;--ink:#1c2420;--muted:#5d6a63;--line:#d6ddd7;--green:#17704a;--coin:#b98200;--coinbg:#fff4d6;
--display:"Do Hyeon","Apple SD Gothic Neo",sans-serif;--body:"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#121714;--card:#1a211d;--ink:#e6ece8;--muted:#9aa9a1;--line:#2c3631;--green:#4cc28a;--coin:#f0c14b;--coinbg:#2e2714;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#121714;--card:#1a211d;--ink:#e6ece8;--muted:#9aa9a1;--line:#2c3631;--green:#4cc28a;--coin:#f0c14b;--coinbg:#2e2714;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 var(--body)}
.wrap{max-width:860px;margin:0 auto;padding-block:20px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.ad{font-size:13px;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:8px 12px;background:var(--card)}
header.top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin:18px 0 8px}
.logo{font:28px/1.1 var(--display);color:var(--ink);text-decoration:none}.logo b{color:var(--green);font-weight:400}
.tag{font-size:14px;color:var(--muted)}
h1{font:34px/1.2 var(--display);margin:24px 0 6px;text-wrap:balance;font-weight:400}
h2{font:22px/1.3 var(--display);margin:32px 0 10px;font-weight:400}
.lede{color:var(--muted);max-width:62ch;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-top:14px}
.item{display:flex;flex-direction:column;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px;color:inherit;text-decoration:none}
.item:hover,.item:focus-visible{border-color:var(--green);outline:none}
.item .nm{font-weight:600}
.row{display:flex;justify-content:space-between;font:14px/1.5 var(--mono);font-variant-numeric:tabular-nums;color:var(--muted)}
.save{font:15px/1.4 var(--mono);color:var(--green);font-variant-numeric:tabular-nums}
.pill{align-self:flex-start;font-size:12px;padding:2px 8px;border-radius:99px;background:var(--coinbg);color:var(--coin)}
.pill.cp{background:transparent;border:1px solid var(--line);color:var(--muted)}
.receipt{background:var(--card);border:1px dashed var(--line);border-radius:4px;padding:18px 20px;font:15px/1.9 var(--mono);font-variant-numeric:tabular-nums;max-width:520px}
.receipt div{display:flex;justify-content:space-between;gap:12px}.receipt .sum{border-top:1px dashed var(--line);margin-top:6px;padding-top:6px;color:var(--green);font-weight:600}
.verdict{font:24px/1.3 var(--display);margin:18px 0 4px}.verdict span{color:var(--green)}
.note{max-width:62ch}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 6px}
.btn{padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid var(--ink);color:var(--ink)}
.btn.main{background:var(--ink);color:var(--paper)}
.btn:focus-visible{outline:3px solid var(--coin);outline-offset:2px}
.small{font-size:13px;color:var(--muted)}
nav.cats{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}nav.cats a{font-size:14px;padding:4px 10px;border:1px solid var(--line);border-radius:99px;color:var(--ink);text-decoration:none}
footer{margin-top:48px;font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}
"""
FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+KR:wght@400;600&display=swap">'


def page(title: str, desc: str, body: str, root: str = "") -> str:
    e = html.escape
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title>
<meta name="description" content="{e(desc)}">{FONTS}<style>{CSS}</style></head><body><div class="wrap">
<p class="ad">[광고] {DISCLOSURE}</p>
<header class="top"><a class="logo" href="{root}index.html">돈 줍는 <b>삼촌</b></a><span class="tag">사기 전에 계산부터</span></header>
{body}
<footer>가격은 표시한 날짜 기준이며 바뀔 수 있습니다. 구매 전 판매 페이지에서 최종 가격·배송일을 확인하세요.<br>{BRAND} · 제휴 링크로 구매하셔도 가격은 같습니다.</footer>
</div></body></html>"""


def card(p: dict, root: str = "") -> str:
    e = html.escape
    pill = '<span class="pill">급하지 않으면 알리</span>' if p["aliWins"] else '<span class="pill cp">쿠팡이 낫다</span>'
    return f"""<a class="item" href="{root}p/{p['slug']}.html">{pill}<span class="nm">{e(p['name'])}</span>
<span class="row"><span>알리 {won(int(p['aliPrice']))}</span><span>쿠팡 {won(int(p['coupangPrice']))}</span></span>
<span class="save">차액 {won(p['diff'])} ({p['ratio']}%)</span></a>"""


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
                body, root="../")


def index_page(products: list[dict]) -> str:
    cats = "".join(f'<a href="#{k}">{v}</a>' for k, v in CATEGORIES.items())
    secs = "".join(
        f'<section id="{k}"><h2>{v}</h2><div class="grid">{"".join(card(p) for p in products if p["category"] == k)}</div></section>'
        for k, v in CATEGORIES.items() if any(p["category"] == k for p in products))
    body = f"""<h1>같은 물건, 알리에서 사면 얼마나 아낄까?</h1>
<p class="lede">삼촌이 쿠팡 가격과 알리 가격을 나란히 놓고 차액, 기다리는 값, 한 달 비용을 계산합니다. 차액이 작으면 솔직하게 쿠팡을 권합니다.</p>
<nav class="cats">{cats}</nav>{secs}"""
    return page(f"{BRAND} | 알리 vs 쿠팡 가격 계산", "같은 물건을 알리와 쿠팡에서 사면 얼마 차이 나는지 계산합니다.", body)


def build(out="site", src="config/site_products.csv") -> int:
    products = load(src)
    o = pathlib.Path(out)
    (o / "p").mkdir(parents=True, exist_ok=True)
    (o / "index.html").write_text(index_page(products), encoding="utf-8")
    for p in products:
        (o / "p" / f"{p['slug']}.html").write_text(product_page(p), encoding="utf-8")
    return len(products)


if __name__ == "__main__":
    print(f"{build(*sys.argv[1:])}개 상품 페이지 생성")
