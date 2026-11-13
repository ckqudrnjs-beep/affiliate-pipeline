"""검색·공유 보강 (2026-11-11): 공유 썸네일(og:image), 빵부스러기(BreadcrumbList), 실제 수정일 사이트맵, 글이 들어간 RSS.

공유 썸네일은 Pillow 로 미리 만들어 static/og/ 에 넣는다(Cloudflare 빌드에는 Pillow 가 없다).
    PYTHONPATH=src python -m pipeline.seo og     # 빠진 썸네일만 만든다 (--all: 전부 다시)
썸네일이 없는 페이지는 static/og/default.png 를 쓴다.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import pathlib
import sys
from email.utils import format_datetime

OG_DIR = pathlib.Path("static/og")
GREEN, CREAM, COIN = "#1f4d3a", "#f7f6f2", "#e9b949"


def og_path(kind: str, slug: str) -> str:
    """사이트 루트 기준 썸네일 경로. 개별 썸네일이 없으면 기본 썸네일."""
    name = f"{kind}-{slug}.png"
    return f"og/{name}" if (OG_DIR / name).exists() else "og/default.png"


def crumbs(base: str, items: list[tuple[str, str]]) -> dict:
    """[(이름, 경로)] → BreadcrumbList. 첫 칸은 홈."""
    full = [("홈", "")] + items
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": f"{base}/{p}"} for i, (n, p) in enumerate(full)]}


def sitemap(base: str, entries: list[tuple[str, str]]) -> str:
    """[(경로, YYYY-MM-DD)] → sitemap.xml. 날짜는 페이지 내용이 실제로 바뀐 날."""
    rows = "".join(f"<url><loc>{base}/{html.escape(u)}</loc><lastmod>{d}</lastmod></url>\n" for u, d in entries)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + rows + "</urlset>\n")


def feed(base: str, brand: str, news: list[dict], arts: list[dict], recs: list[dict] | None = None) -> str:
    """삼촌의 글 + 소식을 날짜순으로 합친 RSS (네이버 서치어드바이저 RSS 제출용)."""
    e = html.escape
    items = [(a["date"], a["title"], f"guide/{a['slug']}.html", a["desc"], "05:13") for a in arts]
    items += [(n["date"], n["title"], f"news/{n['id']}.html", n["body"], "07:00") for n in news]
    from . import recipes as RC
    items += [(r["date"], RC.title(r), f"recipe/{r['slug']}.html", RC.desc(r), "11:00") for r in recs or []]
    items.sort(key=lambda x: (x[0], x[4]), reverse=True)
    body = "".join(
        f"<item><title>{e(t)}</title><link>{base}/{e(p)}</link><guid isPermaLink=\"true\">{base}/{e(p)}</guid>"
        f"<pubDate>{format_datetime(dt.datetime.fromisoformat(f'{d}T{hm}:00+09:00'))}</pubDate><description>{e(desc[:300])}</description></item>"
        for d, t, p, desc, hm in items[:40])
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{e(brand)}</title><link>{base}/</link>'
            f"<description>사기 전에, 쓰기 전에 계산해 보는 살림 사이트</description><language>ko</language>{body}</channel></rss>\n")


# 주제 묶음: 글·질문 페이지·계산기를 서로 잇는 기준. 앞쪽이 더 구체적이라 먼저 맞춘다.
CLUSTER_KEYS = [
    ("humidifier", ("가습기", "가습")),
    ("heater", ("난방", "온풍기", "전기요", "전기장판", "온수매트", "라디에이터", "히터", "보일러", "결로", "뽁뽁이")),
    ("standby", ("대기전력", "멀티탭", "셋톱박스", "콘센트", "플러그")),
    ("aliexpress", ("직구", "알리", "관세", "면세", "해외")),
    ("electric", ("전기요금", "전기세", "누진", "소비전력", "kWh", "제습기", "건조기", "에어컨", "냉장고")),
]


def cluster_of(text: str, links: str = "") -> str:
    """제목·키워드 낱말로 고르고, 못 고르면 본문의 계산기 링크로. 그래도 없으면 빈 문자열."""
    import re
    for k, words in CLUSTER_KEYS:
        if any(w in text for w in words):
            return k
    m = re.search(r"calc/([\w-]+)\.html", links)
    return m.group(1) if m and m.group(1) in {k for k, _ in CLUSTER_KEYS} else ""


def article_cluster(a: dict) -> str:
    return cluster_of(a.get("title", "") + " " + " ".join(a.get("keywords", [])), a.get("body", ""))


# ---------- 썸네일 만들기 (로컬·예약 작업에서만) ----------

def _font(size: int, bold: bool = True):
    from PIL import ImageFont
    names = ["NanumSquareEB.ttf", "NanumSquareB.ttf", "NanumGothicExtraBold.ttf", "NanumGothicBold.ttf"] if bold else ["NanumSquareR.ttf", "NanumGothic.ttf"]
    for f in [os.environ.get("VIDEO_FONT", "")] + [f"/usr/share/fonts/truetype/nanum/{n}" for n in names] + ["C:/Windows/Fonts/malgunbd.ttf"]:
        if f and os.path.exists(f):
            return ImageFont.truetype(f, size)
    raise SystemExit("한글 글꼴이 없습니다 (fonts-nanum 설치 또는 VIDEO_FONT 지정)")


def _wrap(draw, text: str, font, width: int) -> list[str]:
    lines, cur = [], ""
    for word in text.split(" "):
        t = (cur + " " + word).strip()
        if draw.textlength(t, font=font) <= width:
            cur = t
        else:
            if cur:
                lines.append(cur)
            while draw.textlength(word, font=font) > width:  # 아주 긴 낱말은 글자 단위로
                i = len(word)
                while i > 1 and draw.textlength(word[:i], font=font) > width:
                    i -= 1
                lines.append(word[:i]); word = word[i:]
            cur = word
    if cur:
        lines.append(cur)
    return lines


def make_og(path: pathlib.Path, title: str, label: str) -> None:
    """1200x630 공유 썸네일: 진녹색 바탕, 큰 제목, 아래에 사이트 이름."""
    from PIL import Image, ImageDraw
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), GREEN)
    d = ImageDraw.Draw(im)
    d.text((80, 70), label, font=_font(34), fill=COIN)
    size = 72
    while True:
        f = _font(size)
        lines = _wrap(d, title, f, W - 160)
        if len(lines) <= 3 or size <= 48:
            break
        size -= 6
    lines = lines[:3]
    y = 150 + (3 - len(lines)) * size // 2
    for ln in lines:
        d.text((80, y), ln, font=f, fill=CREAM)
        y += int(size * 1.35)
    cy, r = 540, 26  # 동전 로고
    d.ellipse([80, cy - r, 80 + 2 * r, cy + r], fill=COIN)
    d.text((80 + r, cy), "₩", font=_font(30), fill=GREEN, anchor="mm")
    d.text((150, cy), "돈 줍는 삼촌", font=_font(36), fill=CREAM, anchor="lm")
    d.text((W - 80, cy), "don3chon.com", font=_font(30, bold=False), fill="#b9cbbf", anchor="rm")
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)


def targets() -> list[tuple[str, str, str]]:
    """(파일명, 제목, 윗줄 라벨) 목록."""
    from .calcs import CALCS
    from . import articles as A
    from . import questions as Q
    out = [("default.png", "사기 전에, 쓰기 전에 계산해 보세요", "전기요금 · 직구 세금 · 난방비 계산기")]
    out += [(f"calc-{c['slug']}.png", c["h1"], "무료 계산기") for c in CALCS]
    out += [(f"q-{q['slug']}.png", q["h1"], "삼촌의 계산") for q in Q.load()]
    out += [(f"guide-{a['slug']}.png", a["title"], "삼촌의 글") for a in A.load()]
    from . import recipes as RC
    out += [(f"recipe-{r['slug']}.png", f"{r['name']} 1인분 {RC.won(r['total'])}, 배달보다 {RC.won(r['save'] // 100 * 100)} 절약", "1인분 원가 레시피") for r in RC.load()]
    return out


def write_all(force: bool = False) -> int:
    n = 0
    for name, title, label in targets():
        p = OG_DIR / name
        if force or not p.exists():
            make_og(p, title, label); n += 1
    return n


if __name__ == "__main__":
    if sys.argv[1:2] == ["og"]:
        print(f"썸네일 {write_all('--all' in sys.argv)}개 만듦")
    else:
        print(__doc__)


# ---------- 깔끔한 주소 (2026-11-12) ----------
# Cloudflare Pages 는 /글.html 을 /글 로 308 리디렉션한다. 그래서 canonical·사이트맵·링크가 .html 이면
# 구글이 "리디렉션이 포함된 페이지", "적절한 표준 태그가 포함된 대체 페이지"로 색인에서 뺀다.
# 빌드가 끝난 뒤 모든 주소를 리디렉션 없는 최종 주소(.html 없음, index.html → 폴더)로 바꾼다.

def _clean_abs(base: str, s: str) -> str:
    import re
    return re.sub(re.escape(base) + r"/((?:[\w-]+/)*)([\w-]+)\.html",
                  lambda m: f"{base}/{m.group(1)}" + ("" if m.group(2) == "index" else m.group(2)), s)


def _clean_rel(s: str) -> str:
    import re

    def rep(m):
        up, dirs, name = m.group(1), m.group(2), m.group(3)
        if name == "index":
            return f'href="{up}{dirs}' + ("" if (up or dirs) else "./")
        return f'href="{up}{dirs}{name}'
    return re.sub(r'href="((?:\.\./)*)((?:[\w-]+/)*)([\w-]+)\.html', rep, s)


def clean_urls(out: pathlib.Path, base: str) -> int:
    n = 0
    for f in list(out.rglob("*.html")) + list(out.rglob("*.xml")):
        if f.name.startswith("naver") and f.parent == out:
            continue  # 네이버 소유확인 파일은 그대로
        s = f.read_text(encoding="utf-8")
        t = _clean_abs(base, s)
        if f.suffix == ".html":
            t = _clean_rel(t)
        if t != s:
            f.write_text(t, encoding="utf-8"); n += 1
    return n
