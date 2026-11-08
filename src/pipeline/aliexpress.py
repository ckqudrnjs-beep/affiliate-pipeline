"""알리익스프레스 제휴(Affiliate) 공식 API 클라이언트.

Portals 가입 후 open.aliexpress.com 에서 Affiliates API 앱을 만들면 발급되는
App Key / App Secret 을 환경변수 ALI_APP_KEY / ALI_APP_SECRET (GitHub Secrets)로 받는다.
ALI_TRACKING_ID 는 Portals 의 트래킹 ID.
서명 방식·파라미터는 공식 문서로 최종 확인할 것 (확인 필요).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request

GATEWAY = "https://api-sg.aliexpress.com/sync"


def sign(params: dict, secret: str) -> str:
    base = "".join(f"{k}{params[k]}" for k in sorted(params))
    return hmac.new(secret.encode(), base.encode(), hashlib.sha256).hexdigest().upper()


class AliExpressClient:
    def __init__(self, app_key: str | None = None, app_secret: str | None = None, tracking_id: str | None = None):
        self.app_key = app_key or os.environ["ALI_APP_KEY"]
        self.app_secret = app_secret or os.environ["ALI_APP_SECRET"]
        self.tracking_id = tracking_id or os.environ.get("ALI_TRACKING_ID", "")

    def _call(self, method: str, **biz) -> dict:
        params = {
            "method": method,
            "app_key": self.app_key,
            "timestamp": str(int(time.time() * 1000)),
            "sign_method": "sha256",
            **{k: str(v) for k, v in biz.items() if v not in (None, "")},
        }
        params["sign"] = sign(params, self.app_secret)
        data = urllib.parse.urlencode(params).encode()
        req = urllib.request.Request(GATEWAY, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())

    def hot_products(self, keywords: str = "", page_size: int = 10) -> list[dict]:
        """인기 상품 + 이미 제휴 링크(promotion_link)가 포함된 결과."""
        r = self._call(
            "aliexpress.affiliate.hotproduct.query",
            keywords=keywords, page_size=page_size, target_currency="KRW",
            target_language="KO", ship_to_country="KR", tracking_id=self.tracking_id,
        )
        body = next(iter(r.values())) if r else {}
        if "error_response" in r or str(body.get("resp_result", {}).get("resp_code", "200")) != "200":
            err = r.get("error_response") or body.get("resp_result", {})
            # 키·서명 값은 찍지 않고 오류 코드와 메시지만 남긴다
            raise RuntimeError(f"code={err.get('code') or err.get('resp_code')} msg={err.get('msg') or err.get('resp_msg')}")
        products = (body.get("resp_result", {}).get("result", {}).get("products", {}) or {}).get("product", [])
        return [to_draft_product(p) for p in products]

    def generate_links(self, urls: list[str]) -> list[str]:
        r = self._call(
            "aliexpress.affiliate.link.generate",
            promotion_link_type=0, source_values=",".join(urls), tracking_id=self.tracking_id,
        )
        body = next(iter(r.values())) if r else {}
        links = (body.get("resp_result", {}).get("result", {}).get("promotion_links", {}) or {}).get("promotion_link", [])
        return [l.get("promotion_link", "") for l in links]


def to_draft_product(p: dict) -> dict:
    price = p.get("target_sale_price") or p.get("sale_price")
    try:
        price = int(float(price)) if price else None
    except ValueError:
        price = None
    return {
        "program": "aliexpress",
        "productName": p.get("product_title", ""),
        "productPrice": price,
        "productUrl": p.get("promotion_link", ""),
        "imageUrl": p.get("product_main_image_url") or None,
        "isRocket": False,
    }
