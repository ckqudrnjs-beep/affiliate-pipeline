"""일일 SNS 초안 생성: 쿠팡 골드박스 → 스레드/인스타 캡션 초안(MD).

초안은 drafts/YYYY-MM-DD.md 로 저장되고, GitHub Actions가 PR로 올린다.
사용자가 PR을 승인(머지)해야 발행 단계로 넘어간다.
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
        "해외배송이라 도착일을 꼭 확인하세요." if program == "aliexpress" else "구매 전 옵션·배송일 꼭 확인하세요.",
        url,
    ]
    return "\n".join(l for l in lines if l is not None)


MAX_PROMO = 3  # 하루 홍보형 최대 (docs/OPERATIONS.md: 홍보 50% 이하)


def load_tips(path: str | pathlib.Path = "config/tips.csv") -> list[dict]:
    p = pathlib.Path(path)
    if not p.exists():
        return []
    with open(p, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r.get("text")]


def pick_tips(tips: list[dict], today: dt.date, k: int) -> list[dict]:
    """날짜별로 돌아가며 k개 선택 (같은 글 반복 최소화)."""
    if not tips:
        return []
    start = (today.toordinal() * k) % len(tips)
    return [tips[(start + i) % len(tips)] for i in range(min(k, len(tips)))]


def build(products: list[dict], today: dt.date, n: int = MAX_PROMO, tips: list[dict] | None = None) -> str:
    """정보형을 홍보형 이상으로 섞어 초안 MD를 만든다. 순서: 정보형과 홍보형 번갈아."""
    promos = products[:n]
    infos = pick_tips(tips or [], today, max(len(promos), 2)) if tips else []
    out = [f"# {today.isoformat()} SNS 초안 ({BRAND})", "",
           f"정보형 {len(infos)}개 · 홍보형 {len(promos)}개. 검사를 모두 통과하면 자동 승인됩니다.", ""]
    items: list[tuple[str, str, list[str]]] = []
    for i in range(max(len(promos), len(infos))):
        if i < len(infos):
            text = infos[i]["text"].strip()
            items.append(("정보형", text, check(text, [])))
        if i < len(promos):
            p = promos[i]
            post = render_post(p, today)
            items.append(("홍보형", post, check(post, [p.get("program") or "coupang"])))
    for i, (kind, text, problems) in enumerate(items, 1):
        status = "✅ 검사 통과" if not problems else "⛔ 차단: " + "; ".join(problems)
        out += [f"## 초안 {i} [{kind}] — {status}", "", "```text", text, "```", ""]
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
        })
    return rows


def main() -> int:
    today = dt.datetime.now(KST).date()
    products = load_manual() if pathlib.Path("config/products.csv").exists() else []
    if os.environ.get("COUPANG_ACCESS_KEY"):
        from .coupang import CoupangClient
        api = CoupangClient().goldbox()
        products = [x for x in products if x["program"] != "coupang"] + api
    if os.environ.get("ALI_APP_KEY"):
        from .aliexpress import AliExpressClient
        kw = os.environ.get("ALI_KEYWORDS", "")
        products += [x for x in AliExpressClient().hot_products(kw, 5) if x["productUrl"]][:1]
    tips = load_tips()
    if not products and not tips:
        print("상품도 정보형 글도 없습니다. config/products.csv 또는 config/tips.csv 를 채우세요.")
        return 0
    path = pathlib.Path("drafts") / f"{today.isoformat()}.md"
    path.parent.mkdir(exist_ok=True)
    path.write_text(build(products, today, tips=tips), encoding="utf-8")
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
