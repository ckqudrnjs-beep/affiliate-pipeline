"""일일 SNS 초안 생성: 쿠팡 골드박스 → 스레드/인스타 캡션 초안(MD).

초안은 drafts/YYYY-MM-DD.md 로 저장된다. 검사 통과 시 main에 자동 반영, 차단 시 검토 PR.
main에 올라간 초안은 publish.py 가 스레드·인스타에 발행한다 (인스타는 이미지가 있는 초안만).
"""
from __future__ import annotations

import csv
import datetime as dt
import os
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
    if p.get("priceDate"):
        today = dt.date.fromisoformat(p["priceDate"])
    program = p.get("program") or "coupang"
    lines = [
        DISCLOSURES.get(program, DISCLOSURES["generic"]),
        "",
        f"💰 {BRAND}의 오늘 특가 줍기",
        f"{name}",
        f"{today.month}월 {today.day}일 기준 {won(price)}{rocket}" if price else "",
        "",
        "구매 전 옵션·배송일 꼭 확인하세요.",
        url,
    ]
    return "\n".join(l for l in lines if l is not None)


def build(products: list[dict], today: dt.date, n: int = 5) -> str:
    out = [f"# {today.isoformat()} SNS 초안 ({BRAND})", "", "승인하려면 이 PR을 머지하세요. 수정하려면 파일을 직접 고치세요.", ""]
    for i, p in enumerate(products[:n], 1):
        post = render_post(p, today)
        problems = check(post, [p.get("program") or "coupang"])
        status = "✅ 검사 통과" if not problems else "⛔ 차단: " + "; ".join(problems)
        meta = f"program={p.get('program') or 'coupang'}"
        image = p.get("productImage") or p.get("imageUrl")
        if image:
            meta += f" image={image}"
        out += [f"## 초안 {i} — {status}", f"<!-- meta {meta} -->", "", "```text", post, "```", ""]
    return "\n".join(out)


def load_manual(path: str | pathlib.Path = "config/products.csv") -> list[dict]:
    """최종 승인 전(Open API 없음): 파트너스 사이트에서 직접 만든 링크 목록을 읽는다."""
    rows = []
    with open(path, encoding="utf-8") as f:
        lines = [l for l in f if l.strip() and not l.lstrip().startswith("#")]
    for r in csv.DictReader(lines):
        if "EXAMPLE" in r.get("productUrl", ""):
            continue
        rows.append({
            "productName": r["productName"],
            "productPrice": int(r["productPrice"]) if r.get("productPrice") else None,
            "productUrl": r["productUrl"],
            "isRocket": r.get("isRocket", "").strip() in ("1", "true", "Y"),
            "priceDate": (r.get("priceDate") or "").strip() or None,
            "program": (r.get("program") or "coupang").strip().lower(),
            "imageUrl": (r.get("imageUrl") or "").strip() or None,
        })
    return rows


def main() -> int:
    today = dt.datetime.now(KST).date()
    products = load_manual() if pathlib.Path("config/products.csv").exists() else []
    if os.environ.get("COUPANG_ACCESS_KEY"):
        from .coupang import CoupangClient
        api = CoupangClient().goldbox()
        products = [x for x in products if x["program"] != "coupang"] + api
    if not products:
        print("상품이 없습니다. config/products.csv 에 링크를 추가하세요.")
        return 0
    path = pathlib.Path("drafts") / f"{today.isoformat()}.md"
    path.parent.mkdir(exist_ok=True)
    path.write_text(build(products, today), encoding="utf-8")
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
