"""일일 초안 생성 (2026-11-08 개편: 블로그 중심, SNS 자동 게시 없음).

- 제휴 상품(쿠팡·네이버·알리) → drafts/blog/YYYY-MM-DD.md : 블로그에 붙여 넣을 홍보 글 초안
- 정보형 글 → drafts/manual/YYYY-MM-DD.md : 스레드·인스타 앱에서 사람이 직접 올리는 글 (링크 없음)
두 경로 모두 publish.py 가 읽는 drafts/YYYY-MM-DD.md 가 아니므로 병합해도 자동 게시되지 않는다.
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
    items: list[tuple[str, str, str | None]] = []  # (program, text, image)
    for i in range(max(len(promos), len(infos))):
        if i < len(infos):
            items.append(("info", infos[i]["text"].strip(), (infos[i].get("imageUrl") or "").strip() or None))
        if i < len(promos):
            p = promos[i]
            items.append((p.get("program") or "coupang", render_post(p, today), p.get("productImage") or p.get("imageUrl")))
    for i, (program, text, image) in enumerate(items, 1):
        problems = check(text, [program])
        status = "✅ 검사 통과" if not problems else "⛔ 차단: " + "; ".join(problems)
        meta = f"program={program}" + (f" image={image}" if image else "")
        out += [f"## 초안 {i} — {status}", f"<!-- meta {meta} -->", "", "```text", text, "```", ""]
    return "\n".join(out)


def render_blog(p: dict, today: dt.date) -> str:
    """블로그 글 한 편 초안. 대가성 문구가 맨 앞, 가격엔 기준일."""
    name = p.get("productName", "").strip()
    price = p.get("productPrice")
    if p.get("priceDate"):
        today = dt.date.fromisoformat(p["priceDate"])
    program = p.get("program") or "coupang"
    ship = ("해외배송이라 도착까지 1~3주 걸릴 수 있어요. 관세·반품 조건도 함께 확인하세요."
            if program == "aliexpress" else "옵션별 가격과 배송일을 구매 전에 확인하세요.")
    lines = [
        DISCLOSURES.get(program, DISCLOSURES["generic"]),
        "",
        f"# {name} 살까 말까, 삼촌이 계산해 봤어요",
        "",
        "## 한 줄 요약",
        "(아하 포인트: 의외의 숫자 하나. 예: 1년 쓰면 하루 몇 원인지)",
        "",
        "## 가격",
        f"- {today.month}월 {today.day}일 기준 {won(price)}" if price else "- 가격: 링크에서 확인",
        "- 1년 총비용 = 구매가 + (소모품·전기료 × 12) ← 숫자를 채워 넣기",
        "",
        "## 이런 분께 맞아요 / 안 맞아요",
        "- 맞아요: ",
        "- 안 맞아요: ",
        "",
        "## 구매 전 체크",
        f"- {ship}",
        "- 상세페이지의 소비전력(W)·용량·인증 표시를 확인하세요.",
        "",
        f"[{name} 보러 가기]({p.get('productUrl', '')})",
    ]
    return "\n".join(lines)


def build_blog(products: list[dict], today: dt.date) -> str:
    out = [f"# {today.isoformat()} 블로그 초안 ({BRAND})", "",
           f"제휴 상품 {len(products)}개. 괄호 안 안내문을 채운 뒤 블로그에 직접 올리세요. 제목 앞에 [광고]를 붙이고, 첫 줄 대가성 문구는 지우지 말고 굵게+색으로 강조하세요(쿠팡 가이드: 태그·이미지 아래 금지).", ""]
    for i, p in enumerate(products, 1):
        program = p.get("program") or "coupang"
        text = render_blog(p, today)
        problems = check(text, [program])
        status = "✅ 검사 통과" if not problems else "⛔ 차단: " + "; ".join(problems)
        img = p.get("productImage") or p.get("imageUrl")
        out += [f"## 블로그 {i} — {status}", f"<!-- meta program={program}" + (f" image={img}" if img else "") + " -->",
                "", "```markdown", text, "```", ""]
    return "\n".join(out)


def build_manual(tips: list[dict], today: dt.date, k: int = 2) -> str:
    out = [f"# {today.isoformat()} 스레드·인스타 수동 게시용 ({BRAND})", "",
           "자동 게시하지 않습니다. 앱에서 직접 올리세요. 제휴 링크는 넣지 않습니다.", ""]
    for i, t in enumerate(pick_tips(tips, today, k), 1):
        text = t["text"].strip()
        problems = check(text, ["info"])
        status = "✅ 검사 통과" if not problems else "⛔ 차단: " + "; ".join(problems)
        out += [f"## 글 {i} — {status}", "", "```text", text, "```", ""]
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


def parse_keywords(raw: str) -> list[str]:
    """ALI_KEYWORDS: 쉼표나 줄바꿈으로 여러 개. 괄호 안 메모(한글 설명)는 무시한다.
    예) "humidifier, electric blanket" 또는 "humidifier(가습기)\nelectric blanket(전기요)"
    """
    import re
    out = []
    for part in re.split(r"[,\n;]+", raw):
        part = re.sub(r"\([^)]*\)", "", part).strip()
        if part:
            out.append(part)
    return out


def main() -> int:
    today = dt.datetime.now(KST).date()
    products = load_manual() if pathlib.Path("config/products.csv").exists() else []
    if os.environ.get("COUPANG_ACCESS_KEY"):
        from .coupang import CoupangClient
        api = CoupangClient().goldbox()
        products = [x for x in products if x["program"] != "coupang"] + api
    if os.environ.get("ALI_APP_KEY"):
        from .aliexpress import AliExpressClient
        kws = parse_keywords(os.environ.get("ALI_KEYWORDS", ""))
        kw = kws[today.toordinal() % len(kws)] if kws else ""  # 날마다 검색어 하나씩 돌아가며
        print(f"알리 검색어: {kw or '(없음: 전체)'}")
        try:
            products += [x for x in AliExpressClient().hot_products(kw, 5) if x["productUrl"]][:1]
        except Exception as e:  # 알리 오류가 나도 나머지 초안은 계속 만든다
            print(f"알리 API 실패, 건너뜀: {type(e).__name__}: {e}")
    tips = load_tips()
    if not products and not tips:
        print("상품도 정보형 글도 없습니다. config/products.csv 또는 config/tips.csv 를 채우세요.")
        return 0
    print(f"제휴 상품 {len(products)}개 (" + ", ".join(sorted({p['program'] for p in products})) + ")")
    if products:
        path = pathlib.Path("drafts/blog") / f"{today.isoformat()}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(build_blog(products[:MAX_PROMO], today), encoding="utf-8")
        print(path)
    if tips:
        path = pathlib.Path("drafts/manual") / f"{today.isoformat()}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(build_manual(tips, today), encoding="utf-8")
        print(path)
    return 0

if __name__ == "__main__":
    sys.exit(main())
