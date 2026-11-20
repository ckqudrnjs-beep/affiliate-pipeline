"""텔레그램 '방문자' 조회 웹훅 등록 (2026-11-20 BK). Actions `tg-webhook` 에서 수동으로 1번 돌린다.

- set   : https://5raksil.com/api/tg 를 봇 웹훅으로 등록 + 비밀 머리글(봇 토큰에서 계산, tg.js tgSecret 과 같은 식)
          + 메뉴 명령어(/visitors, /days) 등록 + BK 대화로 확인 메시지.
- info  : 지금 웹훅 상태(마지막 오류 포함)만 출력.
- delete: 웹훅 해제(되돌리기). 해제하면 cf_usage_alert --setup(getUpdates)도 다시 된다.
토큰·비밀값은 출력하지 않는다.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.request

URL = "https://5raksil.com/api/tg"


def secret(token: str) -> str:
    return hashlib.sha256(f"{token}|tg-webhook".encode()).hexdigest()[:40]


def call(token: str, method: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(body or {}).encode(),
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:  # 텔레그램은 오류도 JSON 으로 준다
        try:
            return json.loads(e.read().decode())
        except ValueError:
            return {"ok": False, "description": f"HTTP {e.code}"}


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    action = (sys.argv[1] if len(sys.argv) > 1 else "info").strip()
    if not token:
        print("::error::Secret TELEGRAM_BOT_TOKEN 이 없어요.")
        return 1
    if action == "set":
        r = call(token, "setWebhook", {
            "url": URL, "secret_token": secret(token),
            "allowed_updates": ["message"], "drop_pending_updates": True, "max_connections": 5,
        })
        print("웹훅 등록:", r.get("ok"), r.get("description", ""))
        if not r.get("ok"):
            return 1
        call(token, "setMyCommands", {
            "commands": [{"command": "visitors", "description": "방문자 수 (오늘·어제·7일·30일)"},
                         {"command": "days", "description": "최근 7일 날짜별 방문자"}],
            "scope": {"type": "chat", "chat_id": int(chat)} if chat.lstrip("-").isdigit() else {"type": "default"},
        })
        if chat:
            call(token, "sendMessage", {"chat_id": chat, "text": "✅ 방문자 조회 연결됨\n이 대화에 \"방문자\" 라고 보내 보세요."})
    elif action == "delete":
        r = call(token, "deleteWebhook", {"drop_pending_updates": True})
        print("웹훅 해제:", r.get("ok"), r.get("description", ""))
        return 0 if r.get("ok") else 1
    info = call(token, "getWebhookInfo").get("result") or {}
    print("현재 주소:", info.get("url") or "(없음)")
    print("밀린 메시지:", info.get("pending_update_count", 0))
    if info.get("last_error_message"):
        print("::warning::마지막 오류:", info.get("last_error_message"))
        e = info.get("last_error_message", "")
        if "503" in e:
            print("  → 5락실 서버에 변수가 안 보임: Cloudflare Pages 5raksil 변수(Production) TELEGRAM_BOT_TOKEN·TELEGRAM_ADMIN_CHAT_ID 넣고 새 배포")
        elif "401" in e:
            print("  → 토큰이 다름: Cloudflare TELEGRAM_BOT_TOKEN 을 GitHub Secret 과 똑같이(앞뒤 공백 없이) 넣고 새 배포")
        elif "404" in e:
            print("  → /api/tg 가 아직 배포 전(또는 옛 배포). Cloudflare Pages 5raksil 최신 배포가 끝났는지 확인")
    elif info.get("url"):
        print("오류 없음(정상)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
