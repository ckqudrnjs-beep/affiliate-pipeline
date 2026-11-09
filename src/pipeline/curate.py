"""수수료 높은 알리 상품 후보 수집 + 상품 원장 가격 이력 (2026-11-09, GitHub Actions 에서 매일 실행).

- 후보: ALI_KEYWORDS 검색어별로 product.query 결과를 모아 평점·판매량으로 거르고 수수료율 순으로 정렬
  → data/candidates/YYYY-MM-DD.json + 요약 MD. 사람이(또는 Claude가) 고르고 판단 글·쿠팡 비교가를 붙여야 사이트에 올라간다.
- 가격 이력: data/products/*.json 중 aliProductId 가 있는 상품의 오늘 가격을 data/prices/YYYY-MM.csv 에 한 줄씩 추가.
수수료는 후보 순서에만 쓰고 결론(알리냐 쿠팡이냐)은 계산으로만 정한다.
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import os
import pathlib

from .aliexpress import AliExpressClient
from .drafts import parse_keywords

KST = dt.timezone(dt.timedelta(hours=9))
MIN_RATING = 90.0   # evaluate_rate(긍정 평가율, %) 이상
MIN_ORDERS = 50     # 최근 판매량 이상
MIN_PRICE = int(os.environ.get("ALI_MIN_PRICE", "15000"))  # 한 건 수수료가 의미 있는 가격 이상만 (원)


def pct(v) -> float:
    try:
        return float(str(v or "0").rstrip("%"))
    except ValueError:
        return 0.0


def to_candidate(p: dict) -> dict:
    price = p.get("target_sale_price") or p.get("sale_price")
    try:
        price = int(float(price)) if price else None
    except ValueError:
        price = None
    return {
        "aliProductId": str(p.get("product_id", "")),
        "name": p.get("product_title", ""),
        "aliPrice": price,
        "aliUrl": p.get("promotion_link", ""),
        "imageUrl": p.get("product_main_image_url") or "",
        "commission": max(pct(p.get("commission_rate")), pct(p.get("hot_product_commission_rate"))),
        "rating": pct(p.get("evaluate_rate")),
        "orders": int(p.get("lastest_volume") or 0),
    }


def pick_candidates(raw: list[dict], k: int = 15) -> list[dict]:
    seen, out = set(), []
    for c in sorted(raw, key=lambda c: (-c["commission"], -c["orders"])):
        if c["aliProductId"] in seen or not c["aliUrl"] or not c["aliPrice"]:
            continue
        if c["rating"] < MIN_RATING or c["orders"] < MIN_ORDERS or c["aliPrice"] < MIN_PRICE:
            continue
        seen.add(c["aliProductId"])
        out.append(c)
    return out[:k]


def fetch_raw(client: AliExpressClient, keywords: list[str]) -> list[dict]:
    raw = []
    for kw in (keywords or [""])[:12]:  # 하루 호출 수를 적게 유지
        r = client._call("aliexpress.affiliate.product.query", keywords=kw, page_size=40, sort="LAST_VOLUME_DESC",
                         target_currency="KRW", target_language="KO", ship_to_country="KR", tracking_id=client.tracking_id)
        body = next(iter(r.values())) if r else {}
        prods = (body.get("resp_result", {}).get("result", {}).get("products", {}) or {}).get("product", [])
        raw += [to_candidate(p) for p in prods]
    return raw


def summary_md(cands: list[dict], today: dt.date) -> str:
    lines = [f"# 알리 후보 {today.isoformat()} (수수료 높은 순, 평점 {MIN_RATING:.0f}%↑·판매 {MIN_ORDERS}개↑·{MIN_PRICE:,}원↑)", "",
             "| # | 상품 | 알리가 | 수수료 | 평점 | 판매 |", "|---|---|---|---|---|---|"]
    for i, c in enumerate(cands, 1):
        lines.append(f"| {i} | {c['name'][:40]} | {c['aliPrice']:,}원 | {c['commission']:.1f}% | {c['rating']:.0f}% | {c['orders']:,} |")
    lines += ["", "사이트에 올리려면 data/products/ 에 파일을 만들고 쿠팡 비교가·판단 글(40자 이상)을 채운다."]
    return "\n".join(lines) + "\n"


MISSING_DAYS = 3  # 사흘 연속 조회가 안 되면 판매 종료로 보고 사이트에서 내린다
DROP_PCT = 10     # 하루 사이 10% 넘게 내리면 소식 게시판에 자동으로 알린다


def last_prices(root: pathlib.Path) -> dict[str, int]:
    last: dict[str, tuple[str, int]] = {}
    for f in sorted((root / "prices").glob("*.csv")):
        with open(f, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                if row.get("aliPrice") and (row["slug"] not in last or row["date"] >= last[row["slug"]][0]):
                    last[row["slug"]] = (row["date"], int(row["aliPrice"]))
    return {k: v[1] for k, v in last.items()}


def record_prices(client: AliExpressClient, today: dt.date, root: pathlib.Path = pathlib.Path("data")) -> int:
    ids, files = {}, {}
    for f in sorted((root / "products").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("aliProductId") and d.get("status", "active") == "active":
            ids[str(d["aliProductId"])] = d["slug"]
            files[d["slug"]] = (f, d)
    if not ids:
        return 0
    r = client._call("aliexpress.affiliate.productdetail.get", product_ids=",".join(list(ids)[:50]),
                     target_currency="KRW", target_language="KO", country="KR", tracking_id=client.tracking_id)
    body = next(iter(r.values())) if r else {}
    prods = (body.get("resp_result", {}).get("result", {}).get("products", {}) or {}).get("product", [])
    if not prods:  # 응답 자체가 비면 API 문제일 수 있으니 아무것도 바꾸지 않는다
        return 0
    prev = last_prices(root)
    seen: dict[str, int] = {}
    for p in prods:
        c = to_candidate(p)
        if str(c["aliProductId"]) in ids and c["aliPrice"]:
            seen[ids[str(c["aliProductId"])]] = int(c["aliPrice"])
    path = root / "prices" / f"{today:%Y-%m}.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    new = not path.exists()
    with open(path, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["date", "slug", "aliPrice", "coupangPrice"])
        for slug, price in seen.items():
            w.writerow([today.isoformat(), slug, price, ""])
    news_path = root / "news.json"
    news = json.loads(news_path.read_text(encoding="utf-8")) if news_path.exists() else []
    for slug, (f, d) in files.items():
        if slug in seen:
            d.pop("missingDays", None)
            old = prev.get(slug) or int(d.get("aliPrice") or 0)
            price = seen[slug]
            nid = f"drop-{slug}-{today.isoformat()}"
            if old and (old - price) / old * 100 >= DROP_PCT and not any(n.get("id") == nid for n in news):
                news.insert(0, {"date": today.isoformat(), "type": "가격", "id": nid,
                                "title": f"{d['name']}, {round((old - price) / old * 100)}% 내렸어요",
                                "body": f"알리 가격이 {old:,}원에서 {price:,}원으로 내렸어요. 알리 가격은 자주 바뀌니 판매 페이지에서 지금 가격을 꼭 확인하세요.",
                                "link": f"p/{slug}.html", "linkText": "상품 계산 보기"})
        else:
            d["missingDays"] = int(d.get("missingDays", 0)) + 1
            if d["missingDays"] >= MISSING_DAYS:
                d["status"], d["endedDate"] = "ended", today.isoformat()
                print(f"판매 종료로 내림: {slug}")
        f.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    news_path.write_text(json.dumps(news, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(seen)


def main() -> int:
    today = dt.datetime.now(KST).date()
    client = AliExpressClient()
    cands = pick_candidates(fetch_raw(client, parse_keywords(os.environ.get("ALI_KEYWORDS", ""))))
    out = pathlib.Path("data/candidates")
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{today.isoformat()}.json").write_text(json.dumps(cands, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / f"{today.isoformat()}.md").write_text(summary_md(cands, today), encoding="utf-8")
    print(f"후보 {len(cands)}개")
    try:
        print(f"가격 기록 {record_prices(client, today)}개")
    except Exception as e:  # 가격 기록 실패가 후보 수집을 막지 않게
        print(f"가격 기록 실패: {type(e).__name__}: {e}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
