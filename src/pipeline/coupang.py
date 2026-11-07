"""쿠팡 파트너스 Open API 클라이언트 (표준 라이브러리만 사용).

키는 환경변수 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 에서만 읽는다 (GitHub Secrets).
엔드포인트·서명 형식은 공식 문서로 최종 확인할 것.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request

DOMAIN = "https://api-gateway.coupang.com"
BASE = "/v2/providers/affiliate_open_api/apis/openapi/v1"


def sign(method: str, path: str, query: str, secret: str, access: str, now: float | None = None) -> str:
    signed_date = time.strftime("%y%m%dT%H%M%SZ", time.gmtime(now))
    message = signed_date + method + path + query
    signature = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"CEA algorithm=HmacSHA256, access-key={access}, signed-date={signed_date}, signature={signature}"


class CoupangClient:
    def __init__(self, access: str | None = None, secret: str | None = None, sub_id: str | None = None):
        self.access = access or os.environ["COUPANG_ACCESS_KEY"]
        self.secret = secret or os.environ["COUPANG_SECRET_KEY"]
        self.sub_id = sub_id or os.environ.get("COUPANG_SUB_ID", "")

    def _request(self, method: str, path: str, params: dict | None = None, body: dict | None = None) -> dict:
        query = urllib.parse.urlencode(params or {})
        url = DOMAIN + path + (f"?{query}" if query else "")
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", sign(method, path, query, self.secret, self.access))
        req.add_header("Content-Type", "application/json;charset=UTF-8")
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())

    def goldbox(self) -> list[dict]:
        """오늘의 골드박스(일일 특가) 상품."""
        params = {"subId": self.sub_id} if self.sub_id else {}
        return self._request("GET", f"{BASE}/products/goldbox", params).get("data", [])

    def search(self, keyword: str, limit: int = 10) -> list[dict]:
        params = {"keyword": keyword, "limit": limit}
        if self.sub_id:
            params["subId"] = self.sub_id
        data = self._request("GET", f"{BASE}/products/search", params).get("data", {})
        return data.get("productData", []) if isinstance(data, dict) else data

    def deeplink(self, urls: list[str]) -> list[dict]:
        body = {"coupangUrls": urls}
        if self.sub_id:
            body["subId"] = self.sub_id
        return self._request("POST", f"{BASE}/deeplink", body=body).get("data", [])
