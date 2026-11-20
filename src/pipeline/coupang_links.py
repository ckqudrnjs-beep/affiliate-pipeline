"""레시피 재료 쿠팡 링크 자동 채우기 (2026-11-20, 쿠팡 파트너스 최종 승인 뒤).

- BK님이 config/recipe_pantry.csv 에 직접 넣은 coupangUrl 이 항상 먼저다. 이 작업은 그 칸이 빈 재료만 채운다.
- 쿠팡 Open API 상품 검색(products/search)의 첫 결과 중 이름이 맞는 상품의 productUrl(파트너스 추적 링크)을
  data/coupang/pantry_links.json 에 저장한다. 사이트는 이 파일을 읽기만 한다(빌드 때 API 를 부르지 않음).
- 가격·이미지·상품명은 사이트에 싣지 않는다(재료 이름 + "쿠팡에서 보기"만). 대가성 문구는 recipes.shop_box 가 붙인다.
- 호출 한도: 한 번에 최대 MAX_CALLS 번, 호출 사이 SLEEP 초. 저장한 링크는 REFRESH_DAYS 지나면 다시 확인.
- API 가 실패하면 기존 저장 링크를 그대로 둔다(없으면 그 재료는 링크 칸에서 빠질 뿐). 키는 출력하지 않는다.
실행: PYTHONPATH=src python -m pipeline.coupang_links [--dry-run]
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys
import time
from urllib.parse import urlparse

CACHE = "data/coupang/pantry_links.json"
MAX_CALLS = 8
SLEEP = 8.0
REFRESH_DAYS = 30
OK_HOSTS = {"link.coupang.com", "coupa.ng"}


def load_cache(path: str = CACHE) -> dict[str, dict]:
    p = pathlib.Path(path)
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return {}
    return {k: v for k, v in data.items() if isinstance(v, dict) and valid_url(v.get("url", ""))}


def valid_url(url: str) -> bool:
    u = urlparse(url or "")
    return u.scheme == "https" and (u.hostname or "") in OK_HOSTS


def keyword(row: dict) -> str:
    """검색어: CSV 의 coupangKeyword 가 있으면 그것, 없으면 '이름 + 용량'(괄호 설명은 뺀다)."""
    kw = (row.get("coupangKeyword") or "").strip()
    if kw:
        return kw
    pack = re.sub(r"\([^)]*\)", "", row.get("pack", "")).strip()
    return f"{row['name']} {pack}".strip()


def core_word(row: dict) -> str:
    """상품명에 꼭 들어 있어야 하는 낱말: 재료 이름의 마지막 낱말(예: '찌개용 두부' → '두부')."""
    return row["name"].split()[-1]


def pick(products: list[dict], row: dict) -> dict | None:
    """검색 결과에서 이름이 맞는 첫 상품. 맞는 게 없으면 None(엉뚱한 상품 링크를 걸지 않는다)."""
    w = core_word(row).replace(" ", "")
    for p in products:
        name = str(p.get("productName", "")).replace(" ", "")
        if w and w in name and valid_url(p.get("productUrl", "")):
            return p
    return None


def todo(pantry_rows: list[dict], cache: dict[str, dict], today: dt.date) -> list[dict]:
    """채울 재료: 손 링크가 없고, 저장 링크가 없거나 오래된 것. 저장 링크 없는 것부터."""
    out = []
    for r in pantry_rows:
        if (r.get("coupangUrl") or "").strip() and "EXAMPLE" not in r["coupangUrl"]:
            continue
        c = cache.get(r["id"])
        if c:
            try:
                age = (today - dt.date.fromisoformat(c.get("checked", ""))).days
            except ValueError:
                age = REFRESH_DAYS
            if age < REFRESH_DAYS:
                continue
        out.append(r)
    return sorted(out, key=lambda r: r["id"] in cache)


def fill(pantry_rows: list[dict], cache: dict[str, dict], client, today: dt.date,
         max_calls: int = MAX_CALLS, sleep: float = SLEEP) -> tuple[dict[str, dict], list[str]]:
    cache = dict(cache)
    log = []
    for i, r in enumerate(todo(pantry_rows, cache, today)[:max_calls]):
        if i and sleep:
            time.sleep(sleep)
        kw = keyword(r)
        try:
            found = pick(client.search(kw, limit=5), r)
        except Exception as e:  # 실패해도 기존 링크 유지, 다음 재료 계속
            log.append(f"{r['id']}: API 실패({type(e).__name__}) → 기존 링크 유지")
            if "429" in str(e):
                break
            continue
        if found:
            cache[r["id"]] = {"url": found["productUrl"], "keyword": kw, "productName": str(found.get("productName", ""))[:80],
                              "checked": today.isoformat()}
            log.append(f"{r['id']}: 연결 ({cache[r['id']]['productName']})")
        elif r["id"] in cache:
            cache[r["id"]]["checked"] = today.isoformat()  # 이번엔 못 찾았지만 기존 링크는 그대로 둔다
            log.append(f"{r['id']}: 맞는 상품 없음 → 기존 링크 유지")
        else:
            log.append(f"{r['id']}: 맞는 상품 없음 (검색어 '{kw}')")
    return cache, log


def save(cache: dict[str, dict], path: str = CACHE) -> None:
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dict(sorted(cache.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def read_rows(path: str = "config/recipe_pantry.csv") -> list[dict]:
    import csv
    with open(path, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r.get("id") and not r["id"].startswith("#")]


def main(argv: list[str]) -> int:
    import os
    if not (os.environ.get("COUPANG_ACCESS_KEY") and os.environ.get("COUPANG_SECRET_KEY")):
        print("쿠팡 키 없음 → 건너뜀")
        return 0
    from .coupang import CoupangClient
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
    rows = read_rows()
    cache = load_cache()
    new, log = fill(rows, cache, CoupangClient(), today)
    print("\n".join(log) or "채울 재료 없음")
    linked = sum(1 for r in rows if (r.get("coupangUrl") or "").strip()) + sum(1 for r in rows if not (r.get("coupangUrl") or "").strip() and r["id"] in new)
    print(f"링크 있는 재료 {linked}/{len(rows)}")
    if "--dry-run" in argv:
        print("(시험 실행: 저장 안 함)")
        return 0
    if new != cache:
        save(new)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
