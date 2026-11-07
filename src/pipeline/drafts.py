"""일일 SNS 초안 생성: 쿠팡 골드박스 → 스레드/인스타 캡션 초안(MD).

초안은 drafts/YYYY-MM-DD.md 로 저장되고, GitHub Actions가 PR로 올린다.
사용자가 PR을 승인(머지)해야 발행 단계로 넘어간다.
"""
from __future__ import annotations

import datetime as dt
import pathlib
import sys

from .compliance import DISCLOSURES, check

BRAND = "돈 줍는 삼촌"
KST = dt.timezone(dt.timedelta(hours=9))


def won(n) -> str:
    return f"{int(n):,}원"


def render_post(p: dict, today: dt.date) -> str:
    name = p.get("productName", "").strip()
    price = p.get("productPrice")
    url = p.get("productUrl", "")
    rocket = " · 로켓배송" if p.get("isRocket") else ""
    lines = [
        DISCLOSURES["coupang"],
        "",
        f"💰 {BRAND}의 오늘 특가 줍기",
        f"{name}",
        f"{today.month}월 {today.day}일 기준 {won(price)}{rocket}" if price else "",
        "",
        "구매 전 옵션·배송일 꼭 확인하세요.",
        url,
    ]
    return "\n".join(l for l in lines if l is not None)


def build(products: list[dict], today: dt.date, n: int = 3) -> str:
    out = [f"# {today.isoformat()} SNS 초안 ({BRAND})", "", "승인하려면 이 PR을 머지하세요. 수정하려면 파일을 직접 고치세요.", ""]
    for i, p in enumerate(products[:n], 1):
        post = render_post(p, today)
        problems = check(post, ["coupang"])
        status = "✅ 검사 통과" if not problems else "⛔ 차단: " + "; ".join(problems)
        out += [f"## 초안 {i} — {status}", "", "```text", post, "```", ""]
    return "\n".join(out)


def main() -> int:
    from .coupang import CoupangClient

    today = dt.datetime.now(KST).date()
    products = CoupangClient().goldbox()
    path = pathlib.Path("drafts") / f"{today.isoformat()}.md"
    path.parent.mkdir(exist_ok=True)
    path.write_text(build(products, today), encoding="utf-8")
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
