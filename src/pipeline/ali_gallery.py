"""사이트 상품의 알리 갤러리 사진 수집 (공식 제휴 API, 2026-11-09).

data/products/<slug>.json 의 aliProductId 로 aliexpress.affiliate.productdetail.get 을 호출해
갤러리 사진 주소를 "gallery" 에 넣고, 사진을 video_assets/<slug>/ 에 받아 둔다 (영상 제작용, 사이트에는 안 올라감).
크롤링이 아니라 공식 API 응답의 주소만 쓴다.
"""
from __future__ import annotations

import json
import pathlib
import sys
import time
import urllib.request

from .aliexpress import AliExpressClient

ROOT = pathlib.Path(".")


def gallery_urls(cli: AliExpressClient, product_id: str) -> list[str]:
    r = cli._call("aliexpress.affiliate.productdetail.get", product_ids=product_id, target_currency="KRW",
                  target_language="KO", country="KR", tracking_id=cli.tracking_id)
    body = next(iter(r.values())) if r else {}
    if "error_response" in r or str(body.get("resp_result", {}).get("resp_code", "200")) != "200":
        err = r.get("error_response") or body.get("resp_result", {})
        raise RuntimeError(f"code={err.get('code') or err.get('resp_code')} msg={err.get('msg') or err.get('resp_msg')}")
    ps = (body.get("resp_result", {}).get("result", {}).get("products", {}) or {}).get("product", [])
    if not ps:
        return []
    p = ps[0]
    urls = [p.get("product_main_image_url")] + ((p.get("product_small_image_urls") or {}).get("string") or [])
    return list(dict.fromkeys(u for u in urls if u))


def main(slugs: list[str]) -> None:
    cli = AliExpressClient()
    for f in sorted((ROOT / "data" / "products").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if (slugs and d["slug"] not in slugs) or not d.get("aliProductId"):
            continue
        urls = gallery_urls(cli, d["aliProductId"])
        d["gallery"] = urls
        f.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        out = ROOT / "video_assets" / d["slug"]
        out.mkdir(parents=True, exist_ok=True)
        for i, u in enumerate(urls, 1):
            dest = out / f"{i:02d}.jpg"
            if dest.exists():
                continue
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            try:
                dest.write_bytes(urllib.request.urlopen(req, timeout=30).read())
            except Exception as e:  # 받지 못한 사진은 주소만 남긴다
                print(f"{d['slug']} {i}: 받기 실패 ({e})")
            time.sleep(1)
        print(f"{d['slug']}: 사진 {len(urls)}장")


if __name__ == "__main__":
    main(sys.argv[1:])
