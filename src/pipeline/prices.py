"""알리 가격 기록 페이지 (2026-11-11). data/prices/*.csv 의 매일 기록으로 상품별 그래프와 '지금 사도 되나' 판정을 만든다.

판정은 기록이 쌓인 기간 안에서만 말한다. 기록이 7일 미만이면 판정 대신 '기록 중'으로 둔다.
"""
from __future__ import annotations

import datetime as dt
import html

MIN_DAYS = 7  # 판정을 내리려면 최소 이만큼 기록이 있어야 한다
NEAR_PCT = 3  # 기록 최저가보다 이 % 이내면 '최저가 근처'

CSS = """
.ptable{width:100%;border-collapse:collapse;margin-top:16px;font-size:15px}
.ptable th,.ptable td{padding:12px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
.ptable th{font-size:13px;color:var(--muted);font-weight:500}
.ptable td.num{text-align:right;font-family:var(--mono);white-space:nowrap}
.ptable a{color:var(--ink)}
.spark{display:block;width:120px;height:36px;color:var(--green)}
.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:13px;background:var(--greenbg);color:var(--green);white-space:nowrap}
.tag.wait{background:transparent;border:1px solid var(--line);color:var(--muted)}
.pchart{display:block;width:100%;max-width:560px;height:160px;color:var(--green);margin-top:8px}
@media (max-width:620px){.ptable .hide-s{display:none}.spark{width:80px}}
"""


def won(n: int) -> str:
    return f"{n:,}원"


def spark(points: list[tuple[str, int]], cls: str = "spark", w: int = 120, h: int = 36) -> str:
    """가격 꺾은선 SVG. 점이 2개 미만이면 빈 문자열."""
    if len(points) < 2:
        return ""
    ps = [p for _, p in points]
    lo, hi = min(ps), max(ps)
    span = (hi - lo) or 1
    n = len(ps) - 1
    pad = 3
    xy = [(pad + i * (w - 2 * pad) / n, pad + (hi - p) * (h - 2 * pad) / span) for i, p in enumerate(ps)]
    d = " ".join(f"{x:.1f},{y:.1f}" for x, y in xy)
    lx, ly = xy[-1]
    label = f"{points[0][0]}부터 {points[-1][0]}까지 가격 {won(ps[0])}에서 {won(ps[-1])}"
    return (f'<svg class="{cls}" viewBox="0 0 {w} {h}" role="img" aria-label="{html.escape(label)}">'
            f'<polyline points="{d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="3" fill="currentColor"/></svg>')


def verdict(points: list[tuple[str, int]]) -> tuple[str, bool]:
    """(판정 문구, 판정 가능 여부)."""
    days = len({d for d, _ in points})
    if days < MIN_DAYS:
        return f"기록 중 ({days}일째)", False
    ps = [p for _, p in points]
    now, lo = ps[-1], min(ps)
    if now <= lo:
        return "기록상 최저가", True
    pct = round((now - lo) / lo * 100)
    if pct <= NEAR_PCT:
        return "최저가 근처", True
    return f"최저보다 {pct}% 비쌈", True


def table(products: list[dict], hist: dict, root: str = "") -> str:
    e = html.escape
    rows = []
    for p in products:
        h = hist.get(p["slug"])
        if not h:
            continue
        ps = [x for _, x in h]
        v, ok = verdict(h)
        rows.append((0 if ok and v != "기록상 최저가" and "근처" not in v else -1 if ok else 1, p["name"], f"""<tr>
<td><a href="{root}p/{e(p['slug'])}.html">{e(p['name'])}</a></td>
<td class="hide-s">{spark(h)}</td>
<td class="num">{won(ps[-1])}</td>
<td class="num hide-s">{won(min(ps))} ~ {won(max(ps))}</td>
<td><span class="tag{'' if ok else ' wait'}">{e(v)}</span></td></tr>"""))
    if not rows:
        return '<p class="note">가격 기록을 모으는 중입니다.</p>'
    rows.sort(key=lambda r: (r[0], r[1]))
    return ('<table class="ptable"><thead><tr><th>상품</th><th class="hide-s">흐름</th><th style="text-align:right">오늘</th>'
            '<th class="hide-s" style="text-align:right">기록 최저 ~ 최고</th><th>판정</th></tr></thead><tbody>'
            + "".join(r[2] for r in rows) + "</tbody></table>")


def page_body(products: list[dict], hist: dict) -> str:
    starts = [h[0][0] for h in hist.values() if h]
    since = min(starts) if starts else dt.date.today().isoformat()
    d = dt.date.fromisoformat(since)
    return f"""<h1>알리 가격 기록</h1>
<p class="lede">삼촌이 소개한 물건의 알리익스프레스 가격을 매일 아침 한 번씩 적어 둔 기록입니다. 지금 가격이 기록 중 싼 편인지 비싼 편인지 한눈에 봅니다.</p>
<h2>보는 법</h2>
<p class="note">기록은 {d.year}년 {d.month}월 {d.day}일부터 시작했습니다. 기록이 {MIN_DAYS}일 이상 쌓인 상품만 판정을 붙입니다. '기록상 최저가'는 지금이 기록 중 가장 싼 날이라는 뜻이고, '최저가 근처'는 최저가와 {NEAR_PCT}% 안쪽 차이입니다. 쿠폰·카드 할인·환율은 반영하지 않은 상품 페이지 표시가 기준이라 실제 결제 금액은 다를 수 있어요.</p>
<p class="note">알리는 11월·3월 같은 큰 할인 행사 때 가격이 크게 움직입니다. 급하지 않다면 '최저보다 ○% 비쌈'인 물건은 찜해 두고 기다려 보는 것도 방법입니다.</p>
{table(products, hist)}
<p class="small">가격은 알리익스프레스 공식 제휴 API로 받은 표시 가격이며, 구매 전 판매 페이지에서 최종 가격을 확인하세요.</p>"""


def product_block(h: list[tuple[str, int]] | None) -> str:
    """상품 페이지용 큰 그래프 + 판정. 기록이 2일 미만이면 빈 문자열."""
    if not h or len(h) < 2:
        return ""
    v, _ = verdict(h)
    ps = [x for _, x in h]
    return f"""<h2 style="margin-top:32px">가격 기록</h2>
{spark(h, "pchart", 560, 160)}
<p class="small">{h[0][0]} ~ {h[-1][0]} · 최저 {won(min(ps))} · 최고 {won(max(ps))} · <span class="tag">{html.escape(v)}</span> · <a href="../prices.html">전체 가격 기록</a></p>"""
