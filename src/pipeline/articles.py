"""삼촌의 글: data/articles/<slug>.json → guide.html, guide/<slug>.html.

검색 질문에 답하는 글이 중심이다(답과 계산이 80% 이상). 상품 카드는 글 끝에 1~2개만, [광고] 표기 후에 붙인다.
본문은 간단한 표기만 지원한다: '## 소제목', '- 목록', '| 표 |', **굵게**, [글자](사이트 안 경로).
"""
from __future__ import annotations

import datetime as dt
import html
import json
import pathlib
import re

MIN_BODY = 600  # 얇은 글(thin content) 방지: 본문이 이보다 짧으면 싣지 않는다

CSS = """
.article{max-width:720px}.article h2{font:500 24px/1.4 var(--display);margin:44px 0 12px}
.article p,.article li{font-size:17px;line-height:1.85}.article ul{padding-left:20px}
.article table{border-collapse:collapse;width:100%;margin:16px 0;font-size:15px;font-variant-numeric:tabular-nums}
.article th,.article td{word-break:keep-all;border-bottom:1px solid var(--line);padding:10px 8px;text-align:left}.article th{font-weight:600}
.article .meta{color:var(--muted);font-size:14px}
.alist{list-style:none;padding:0;margin:0}.alist li{border-bottom:1px solid var(--line);padding:22px 0}
.naverbox ul{list-style:none;padding:0}.naverbox li{border-bottom:1px solid var(--line);padding:14px 0}
.naverbox li a{font-weight:600}.naverbox li span{display:block;color:var(--muted);font-size:15px;margin-top:4px}
.alist a{color:inherit;text-decoration:none}.alist b{font:500 21px/1.45 var(--display);display:block}.alist span{color:var(--muted);font-size:15px}
"""


def load(data_dir: str = "data") -> list[dict]:
    out = []
    for f in sorted(pathlib.Path(data_dir, "articles").glob("*.json")):
        a = json.loads(f.read_text(encoding="utf-8"))
        if a.get("status", "published") != "published" or len(a.get("body", "")) < MIN_BODY:
            continue
        out.append(a)
    return sorted(out, key=lambda a: a["date"], reverse=True)


def _inline(t: str, root: str) -> str:
    t = html.escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    # 링크는 사이트 안 경로만 (외부 링크·제휴 링크를 본문에 숨기지 않는다)
    return re.sub(r"\[(.+?)\]\(((?!https?:|//)[\w./#?=&-]+)\)", lambda m: f'<a href="{root}{m.group(2)}">{m.group(1)}</a>', t)


def render(body: str, root: str = "../") -> str:
    out, lst, tbl = [], [], []

    def flush():
        if lst:
            out.append("<ul>" + "".join(f"<li>{x}</li>" for x in lst) + "</ul>"); lst.clear()
        if tbl:
            head, *rows = tbl
            out.append("<table><thead><tr>" + "".join(f"<th>{c}</th>" for c in head) + "</tr></thead><tbody>"
                       + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table>"); tbl.clear()
    for line in body.splitlines():
        s = line.strip()
        if s.startswith("|"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if not all(set(c) <= set("-: ") for c in cells):
                tbl.append([_inline(c, root) for c in cells])
            continue
        if s.startswith("- "):
            lst.append(_inline(s[2:], root)); continue
        flush()
        if s.startswith("## "):
            out.append(f"<h2>{_inline(s[3:], root)}</h2>")
        elif s:
            out.append(f"<p>{_inline(s, root)}</p>")
    flush()
    return "\n".join(out)


NAVER_DISCLOSURE = "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다."


def load_naver(path: str = "data/naver_products.json") -> list[dict]:
    f = pathlib.Path(path)
    return json.loads(f.read_text(encoding="utf-8")).get("items", []) if f.exists() else []


def naver_for(a: dict, items: list[dict]) -> list[dict]:
    """글에 붙일 네이버 상품(최대 2개). 글에 naver 목록이 있으면 그것만, 없으면 제목·키워드로 고른다."""
    by_id = {i["id"]: i for i in items}
    if "naver" in a:
        return [by_id[x] for x in a["naver"][:2] if x in by_id]
    text = a.get("title", "") + " " + " ".join(a.get("keywords", []))
    return [i for i in items if any(m in text for m in i.get("match", []))][:2]


def naver_box(picks: list[dict]) -> str:
    """국내 구매 칸. 알리 카드와 섞지 않고, 가격 숫자 없이 고른 이유만 적는다. 링크는 받은 그대로, 클릭할 때만 연결."""
    if not picks:
        return ""
    e = html.escape
    li = "".join(f'<li><a href="{e(i["url"])}" target="_blank" rel="sponsored nofollow noopener">{e(i["name"])}</a>'
                 f'<span>{e(i["why"])}</span></li>' for i in picks)
    return (f'<section class="naverbox"><h2>국내에서 바로 산다면</h2><p class="ad">{NAVER_DISCLOSURE}</p>'
            f'<p class="small">인증·A/S·빠른 배송이 중요한 물건은 국내 판매처를 권해요. 가격은 판매처에서 확인하세요.</p><ul>{li}</ul></section>')


def page_body(a: dict, cards: str, naver: str = "") -> str:
    e = html.escape
    d = dt.date.fromisoformat(a["date"])
    ad = (f'<h2>삼촌이 고른 물건</h2><p class="ad">[광고] 아래 상품은 제휴 링크로 연결됩니다. 구매 시 돈 줍는 삼촌이 일정액의 수수료를 받습니다.</p>'
          f'<div class="grid">{cards}</div>') if cards else ""
    return (f'<article class="article"><p class="small"><a href="../guide.html">삼촌의 글</a></p><h1>{e(a["title"])}</h1>'
            f'<p class="meta">{d.year}년 {d.month}월 {d.day}일 · 돈 줍는 삼촌</p><p class="lede">{e(a["desc"])}</p>'
            f'{render(a["body"])}{ad}{naver}</article>')


def list_body(arts: list[dict]) -> str:
    e = html.escape
    items = "".join(f'<li><a href="guide/{a["slug"]}.html"><b>{e(a["title"])}</b><span>{e(a["desc"])}</span></a></li>' for a in arts)
    return f'<h1>삼촌의 글</h1><p class="lede">사기 전에, 쓰기 전에 궁금한 것을 계산으로 답합니다.</p><ul class="alist" style="margin-top:20px">{items}</ul>'


def home_block(arts: list[dict]) -> str:
    if not arts:
        return ""
    e = html.escape
    items = "".join(f'<li><a href="guide/{a["slug"]}.html"><b>{e(a["title"])}</b><span>{e(a["desc"])}</span></a></li>' for a in arts[:3])
    return (f'<section id="guide"><div class="sechead"><h2>삼촌의 글</h2><a href="guide.html" class="small">전체 보기</a></div>'
            f'<ul class="alist">{items}</ul></section>')


def ld(a: dict, base: str) -> dict:
    return {"@context": "https://schema.org", "@type": "Article", "headline": a["title"], "description": a["desc"],
            "datePublished": a["date"], "dateModified": a.get("updated", a["date"]), "inLanguage": "ko",
            "author": {"@type": "Organization", "name": "돈 줍는 삼촌"}, "mainEntityOfPage": f"{base}/guide/{a['slug']}.html"}


BANNED = ("직접 써 봤", "직접 사용해 보니", "써 보니 효과", "실사용 후기", "내돈내산", "최저가 보장", "무조건", "100% 효과", "완치", "치료", "부작용 없", "역대급 할인", "지금 안 사면")


def validate(a: dict, product_slugs: set[str], calc_slugs: set[str], article_slugs: set[str]) -> list[str]:
    """자동 작성 글이 바로 올라가도 되는지 검사한다. 빈 목록이면 통과."""
    err = []
    for k in ("slug", "date", "title", "desc", "body"):
        if not a.get(k):
            err.append(f"{k} 없음")
    body = a.get("body", "")
    if len(body) < MIN_BODY:
        err.append(f"본문 {len(body)}자 (최소 {MIN_BODY})")
    if body.count("## ") < 2:
        err.append("소제목 2개 이상 필요")
    if re.search(r"https?://", body):
        err.append("본문에 외부 링크 금지")
    for w in BANNED:
        if w in body or w in a.get("title", ""):
            err.append(f"금지 표현: {w}")
    for path in re.findall(r"\]\(([^)]+)\)", body):
        m = re.fullmatch(r"(calc|p|guide)/([\w-]+)\.html(#[\w-]*)?", path)
        ok = m and (m.group(2) in {"calc": calc_slugs, "p": product_slugs, "guide": article_slugs}[m.group(1)])
        if not ok:
            err.append(f"없는 내부 링크: {path}")
    if len(a.get("naver", [])) > 2:
        err.append("네이버 상품은 2개까지")
    if len(a.get("products", [])) > 2:
        err.append("상품은 2개까지")
    for s in a.get("products", []):
        if s not in product_slugs:
            err.append(f"없는 상품: {s}")
    return err
