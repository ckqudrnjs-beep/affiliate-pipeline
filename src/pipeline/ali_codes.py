"""알리 제휴 전용 할인코드 (2026-11-28, BK "프로모션 코드를 넣는 쪽으로 하자").

알리 공식 제휴 API(productdetail.get / product.query)의 상품 응답에 들어 있는 `promo_code_info`
(우리 트래킹 ID에 묶인 코드, 할인 방식·금액, 최소 금액, 사용 기간, 남은 수량)를 그대로 쓴다.
- 받기: curate.record_prices(매일 06:30 KST)가 이미 부르는 응답에서 꺼내 상품 파일 `aliCode` 에 저장. 추가 호출 없음.
- 지우기: 다음 날 응답에 코드가 없거나, 끝 시각이 지났거나, 수량이 0이면 상품 파일에서 지운다.
- 보이기: 상품 페이지 구매 버튼 위 [광고] 문구 아래 한 줄. 빌드 뒤 끝 시각이 지나면 브라우저에서도 숨긴다.
코드를 지어내거나 다른 사이트 코드를 옮겨 오지 않는다. 쿠폰 보상·클릭 유도 문구는 쓰지 않는다 (docs/COMPLIANCE.md).
API 시각의 시간대는 문서에 없어(확인 필요) 더 이른 쪽인 한국 시각으로 보고 끝을 판단한다.
"""
from __future__ import annotations

import datetime as dt
import html
import re

KST = dt.timezone(dt.timedelta(hours=9))
# 이 상자가 있는 상품 페이지에만 넣는다 (다른 페이지 HTML은 그대로)
CSS = ".alicode{font-size:15px;margin:8px 0;padding:8px 12px;border:1px dashed var(--green)}.alicode b{font-family:var(--mono);letter-spacing:.05em}"
CODE_RE = re.compile(r"^[A-Za-z0-9]{3,32}$")


def _num(v) -> float | None:
    s = re.sub(r"[^\d.]", "", str(v or ""))
    try:
        return float(s) if s else None
    except ValueError:
        return None


def _time(v) -> dt.datetime | None:
    s = str(v or "").strip()
    if not s:
        return None
    if s.isdigit():  # 밀리초 타임스탬프로 오는 경우
        n = int(s)
        return dt.datetime.fromtimestamp(n / 1000 if n > 10**11 else n, KST)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(s[:19], fmt).replace(tzinfo=KST)
        except ValueError:
            continue
    return None


def parse(p: dict) -> dict | None:
    """API 상품 한 개 → 저장할 코드 정보. 쓸 수 없으면 None."""
    info = p.get("promo_code_info") or {}
    code = str(info.get("promo_code") or "").strip()
    end = _time(info.get("code_availabletime_end"))
    if not CODE_RE.match(code) or not end:
        return None
    start = _time(info.get("code_availabletime_start"))
    qty = _num(info.get("code_quantity"))
    return {
        "code": code,
        "type": "pct" if str(info.get("code_campaigntype")) == "2" else "amount",
        "value": str(info.get("code_value") or "").strip(),
        "minSpend": str(info.get("code_mini_spend") or "").strip(),
        "start": start.isoformat() if start else "",
        "end": end.isoformat(),
        "qty": "" if qty is None else str(int(qty)),
    }


def active(c: dict | None, now: dt.datetime | None = None) -> bool:
    if not isinstance(c, dict) or not c.get("code") or not c.get("end"):
        return False
    now = now or dt.datetime.now(KST)
    try:
        end = dt.datetime.fromisoformat(c["end"])
        start = dt.datetime.fromisoformat(c["start"]) if c.get("start") else None
    except ValueError:
        return False
    if c.get("qty") not in ("", None) and _num(c["qty"]) == 0:
        return False
    return (start is None or start <= now) and now < end


def _money(v: str) -> str:
    n = _num(v)
    if n is None:
        return ""
    if re.search(r"[$]|US|USD", v or ""):  # 달러로 오면 그대로 적는다 (환산하지 않음)
        return f"US ${n:g}"
    return f"{int(n):,}원"


def describe(c: dict) -> str:
    """'3만 원 이상 3,000원 할인' 같은 한 줄. 값이 비면 빈 문자열."""
    if c["type"] == "pct":
        n = _num(c["value"])
        off = f"{n:g}% 할인" if n else ""
    else:
        off = f"{_money(c['value'])} 할인" if _money(c["value"]) else ""
    if not off:
        return ""
    least = _money(c.get("minSpend") or "")
    return f"{least} 이상 {off}" if least and _num(c["minSpend"]) else off


def box(c: dict | None, today: dt.date | None = None) -> str:
    """상품 페이지 구매 버튼 위 한 줄. 쓸 수 없는 코드면 빈 문자열."""
    if not active(c):
        return ""
    what = describe(c)
    if not what:
        return ""
    e = html.escape
    end = dt.datetime.fromisoformat(c["end"])
    today = today or dt.datetime.now(KST).date()
    return (f'<style>{CSS}</style><p class="alicode" data-end="{e(c["end"])}">알리 제휴 할인코드 <b>{e(c["code"])}</b> · {e(what)} · '
            f'{end.month}월 {end.day}일까지 <span class="small">({today.month}월 {today.day}일 기준, 알리 결제 화면에서 입력. '
            f'수량이 끝나면 일찍 마감될 수 있어요)</span></p>'
            "<script>(function(){var b=document.querySelector('.alicode');"
            "if(b&&Date.now()>=Date.parse(b.dataset.end))b.remove();})();</script>")

