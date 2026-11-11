"""계산기 질문 페이지 (2026-11-11): 사람들이 실제로 검색하는 질문 하나에 계산기로 답한다. data/calc_questions.json → q/<slug>.html.

숫자는 사이트 계산기와 같은 식(bill)으로 빌드할 때 계산한다. 페이지마다 설명·팁·질문답을 따로 써서
같은 틀만 바꾼 얇은 페이지(doorway)가 되지 않게 한다. 아래에 원래 계산기를 그대로 붙여 값을 바꿔 볼 수 있다.
"""
from __future__ import annotations

import html
import json
import math
import pathlib

from . import articles as A

KINDS = {"power": "electric", "standby": "standby", "ali": "aliexpress"}
MIN_TEXT = 250  # 설명+팁+질문답 글자 수 하한 (같은 틀만 다른 페이지 방지)


def bill(kwh: float) -> int:
    """calcs.COMMON_JS 의 bill() 과 같은 식 (한전 주택용 저압 기타계절 근사)."""
    kwh = max(0.0, kwh)
    e, prev, base = 0.0, 0, 910
    for lim, b, r in ((200, 910, 120.0), (400, 1600, 214.6), (1e9, 7300, 307.3)):
        if kwh > prev:
            base = b
            e += (min(kwh, lim) - prev) * r
        prev = lim
    sub = base + e + kwh * 9 + kwh * 5
    return int(math.floor((sub + math.floor(sub * 0.1 / 10) * 10 + math.floor(sub * 0.027 / 10) * 10) / 10) * 10)


def won(n: float) -> str:
    return f"{int(round(n)):,}원"


def load(path: str = "data/calc_questions.json") -> list[dict]:
    f = pathlib.Path(path)
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def add_cost(w: float, h: float, base: float, days: int = 30) -> tuple[float, int]:
    kwh = w * h * days / 1000
    return kwh, bill(base + kwh) - bill(base)


def computed(q: dict) -> dict:
    """페이지에 쓸 숫자: 결론 문장, 표, 설명(desc)."""
    p, k = q["params"], q["kind"]
    if k == "power":
        w, h = p["w"], p["h"]
        kwh, c250 = add_cost(w, h, 250)
        _, c350 = add_cost(w, h, 350)
        hours = sorted({max(0.5, h / 2), h, min(24, h * 2)})
        rows = [[f"하루 {x:g}시간", f"{w * x * 30 / 1000:.0f}kWh", won(add_cost(w, x, 250)[1]), won(add_cost(w, x, 350)[1])] for x in hours]
        lead = (f"{q['name']}({w:,}W)를 하루 {h:g}시간, 한 달 30일 쓰면 전기를 **{kwh:.0f}kWh** 더 써요. "
                f"평소 한 달 250kWh를 쓰는 집은 요금이 **약 {won(c250)}**, 350kWh를 쓰는 집은 **약 {won(c350)}** 늘어나요.")
        desc = f"{q['name']}({w:,}W)를 하루 {h:g}시간 쓰면 한 달 전기요금이 약 {won(c250)}~{won(c350)} 늘어요. 누진 구간별 계산표와 줄이는 법."
        table = [["사용 시간", "한 달 사용량", "250kWh 쓰는 집", "350kWh 쓰는 집"]] + rows
    elif k == "standby":
        w, off = p["a"] + p.get("b", 0) + p.get("c", 0), p["off"]
        kwh = w * off * 30 / 1000
        m300 = bill(300) - bill(300 - kwh)
        rows = []
        for base in (180, 250, 350, 450):
            m = bill(base) - bill(max(0, base - kwh))
            rows.append([f"{base}kWh 쓰는 집", won(m), won(m * 12)])
        lead = (f"{q['name']} 대기전력이 {w:g}W라면 하루 {off:g}시간 꺼 둔 동안 한 달 **{kwh:.1f}kWh**가 새요. "
                f"평소 300kWh를 쓰는 집이면 한 달 **약 {won(m300)}**, 1년이면 **약 {won(m300 * 12)}**이에요.")
        desc = f"{q['name']} 대기전력 {w:g}W, 꽂아만 둬도 1년에 약 {won(m300 * 12)}. 집 사용량별 계산표와 줄이는 법."
        table = [["우리 집 사용량", "한 달", "1년"]] + rows
    elif k == "ali":
        fx, duty = p["fx"], p["duty"] / 100
        limit = 150 * fx
        rows = []
        for price in p["prices"]:
            over = price / fx > 150
            tax = 0
            if over:
                d = math.floor(price * duty)
                tax = d + math.floor((price + d) * 0.1)
            rows.append([won(price), f"${price / fx:,.0f}", "넘음" if over else "안 넘음", won(tax), won(price + tax)])
        lead = (f"환율 {fx:,}원 기준으로 면세 한도 150달러는 **약 {won(limit)}**이에요. 이보다 비싸면(배송비 포함 과세가격 기준) "
                f"관세 {p['duty']:g}%와 부가세 10%가 함께 붙어서, 넘는 순간 **물건값의 약 {((1 + duty) * 1.1 - 1) * 100:.1f}%**가 세금으로 더 나가요.")
        desc = f"환율 {fx:,}원이면 알리 직구 면세 한도 150달러는 약 {won(limit)}. 금액별 관세·부가세 계산표와 합산과세 주의점."
        table = [["상품가", "달러 환산", "면세 한도", "관세+부가세", "실제 내는 돈"]] + rows
    else:
        raise ValueError(f"모르는 kind: {k}")
    return {"lead": lead, "desc": desc, "table": table}


def _table_md(rows: list[list[str]]) -> str:
    return "\n".join("| " + " | ".join(r) + " |" for r in rows)


def text_len(q: dict) -> int:
    return len(q.get("note", "")) + sum(len(t) for t in q.get("tips", [])) + sum(len(a) + len(b) for a, b in q.get("faq", []))


def validate(q: dict, calc_slugs: set[str]) -> list[str]:
    err = [f"{k} 없음" for k in ("slug", "kind", "h1", "title", "params", "note", "tips", "faq") if not q.get(k)]
    if q.get("kind") not in KINDS:
        err.append(f"kind 오류: {q.get('kind')}")
    elif KINDS[q["kind"]] not in calc_slugs:
        err.append("계산기 없음")
    if text_len(q) < MIN_TEXT:
        err.append(f"고유 글 {text_len(q)}자 (최소 {MIN_TEXT})")
    for w in A.BANNED:
        if w in json.dumps(q, ensure_ascii=False):
            err.append(f"금지 표현: {w}")
    return err


def calc_of(q: dict) -> str:
    return KINDS[q["kind"]]


def cluster(q: dict) -> str:
    """관련 글·계산기를 묶는 주제 (seo.CLUSTER_KEYS). 계산은 전기요금 계산기로 해도 주제는 난방일 수 있다."""
    return q.get("cluster") or calc_of(q)


def preset(q: dict) -> dict:
    """계산기 입력칸에 미리 넣을 값."""
    p = q["params"]
    if q["kind"] == "power":
        return {"w": p["w"], "h": p["h"], "d": 30, "base": 300}
    if q["kind"] == "standby":
        return {k: p[k] for k in ("a", "b", "c", "off") if k in p} | {"base": 300}
    return {"p": p["prices"][len(p["prices"]) // 2], "s": 0, "fx": p["fx"], "duty": p["duty"], "kr": p.get("kr", 0) or p["prices"][-1]}


def body(q: dict, calc: dict, widget: str, related: str) -> str:
    """페이지 본문. widget = 계산기 폼+결과(값은 preset), related = 관련 글 목록 HTML."""
    e = html.escape
    c = computed(q)
    md = (f"## 결론부터\n{c['lead']}\n\n## 사용 조건별 계산\n{_table_md(c['table'])}\n\n"
          f"## 삼촌의 설명\n{q['note']}\n\n## 줄이는 방법\n" + "\n".join(f"- {t}" for t in q["tips"]))
    faq = "".join(f"<h3>{e(a)}</h3><p>{e(b)}</p>" for a, b in q["faq"])
    return (f'<article class="article"><p class="small"><a href="../index.html#calcs">계산기</a> · <a href="../calc/{calc["slug"]}.html">{e(calc["title"])}</a></p>'
            f'<h1>{e(q["h1"])}</h1><p class="lede">{e(c["desc"])}</p>{A.render(md)}'
            f'<h2>내 조건으로 바꿔 보기</h2><p>아래 칸에 우리 집 고지서 사용량과 제품 소비전력을 넣으면 바로 다시 계산돼요.</p></article>'
            f'{widget}<article class="article"><h2>자주 묻는 질문</h2>{faq}'
            f'<p class="small">요금·세율은 2025~2026년 공개 기준으로 만든 근사치입니다. 실제 고지서·세관 부과액과 다를 수 있습니다.</p>{related}</article>')


def faq_ld(q: dict) -> dict:
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": a, "acceptedAnswer": {"@type": "Answer", "text": b}} for a, b in q["faq"]]}
