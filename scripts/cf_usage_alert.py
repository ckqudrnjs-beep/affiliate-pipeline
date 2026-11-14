"""5락실 Cloudflare 무료 한도 알림 (2026-11-14 BK: 트래픽 폭주 대비, 대시보드 대신 알림).

3시간마다 GitHub Actions(.github/workflows/cf-usage.yml)가 실행한다.
- 오늘(UTC 0시 = 한국 오전 9시 기준) 사용량을 Cloudflare GraphQL 분석 API로 읽는다:
  Functions 요청(하루 10만), D1 읽기(하루 500만 행), D1 쓰기(하루 10만 행).
- 한도의 70%, 90%를 처음 넘을 때 텔레그램 봇이 BK 개인 대화로 알린다(같은 날 같은 단계는 한 번만).
- 5락실 API(/api/vote)가 응답하지 않아도 알린다.
- 텔레그램 설정이 아직 없으면 작업을 '실패'로 끝내서 GitHub가 BK에게 메일을 보내게 한다.

필요한 값(BK가 GitHub Settings > Secrets and variables > Actions 에서 직접 등록, 채팅·파일에 적지 않음):
  Secret CF_API_TOKEN       Cloudflare API 토큰(권한: Account Analytics: Read 하나만)
  Variable CF_ACCOUNT_ID    Cloudflare 계정 ID
  Secret TELEGRAM_BOT_TOKEN (이미 있음)
  Variable TELEGRAM_ADMIN_CHAT_ID  BK 개인 대화 번호(설정 모드로 확인)

설정 모드: python scripts/cf_usage_alert.py --setup
  → 봇에게 최근 /start 를 보낸 개인 대화를 찾아, 그 대화로 '번호'와 확인 메시지를 보낸다.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

LIMITS = {  # Workers Free 하루 한도(계정 전체)
    "req": ("Functions 요청", 100_000),
    "read": ("D1 읽기(행)", 5_000_000),
    "write": ("D1 쓰기(행)", 100_000),
}
LEVELS = (90, 70)
SITE = "https://5raksil.com"
STATE = pathlib.Path(os.environ.get("CF_USAGE_STATE", ".cfusage/sent.json"))
UPGRADE = (
    "할 일: Cloudflare 대시보드 > Workers & Pages > 요금제(Plans)에서 Workers Paid($5/월) 선택. "
    "몇 분 안에 한도가 풀려요. 자세한 건 plan/SCALING.md 8장."
)


def http(url: str, data: dict | None = None, headers: dict | None = None, timeout: int = 20) -> tuple[int, str]:
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json", "user-agent": "usage-check", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # 연결 실패
        return 0, str(e)


def gql(token: str, query: str, variables: dict) -> dict | None:
    st, txt = http("https://api.cloudflare.com/client/v4/graphql", {"query": query, "variables": variables}, {"authorization": f"Bearer {token}"})
    try:
        j = json.loads(txt)
    except ValueError:
        print(f"GraphQL 응답 오류 {st}: {txt[:200]}")
        return None
    if j.get("errors"):
        print("GraphQL 오류:", json.dumps(j["errors"], ensure_ascii=False)[:400])
    return j.get("data")


def usage(token: str, account: str, now: dt.datetime) -> dict[str, int | None]:
    """오늘(UTC) 사용량. 읽지 못한 항목은 None."""
    start = now.strftime("%Y-%m-%dT00:00:00Z")
    day = now.strftime("%Y-%m-%d")
    out: dict[str, int | None] = {"req": None, "read": None, "write": None}
    acc = '{ viewer { accounts(filter: {accountTag: $a}) { %s } } }'
    req = 0
    ok = False
    for ds in ("pagesFunctionsInvocationsAdaptiveGroups", "workersInvocationsAdaptive"):
        q = "query($a: string!, $s: Time!) " + acc % f"x: {ds}(limit: 1, filter: {{datetime_geq: $s}}) {{ sum {{ requests }} }}"
        d = gql(token, q, {"a": account, "s": start})
        try:
            rows = d["viewer"]["accounts"][0]["x"]
            req += sum(int(r["sum"]["requests"]) for r in rows)
            ok = True
        except (TypeError, KeyError, IndexError):
            pass
    out["req"] = req if ok else None
    q = "query($a: string!, $d: Date!) " + acc % "x: d1AnalyticsAdaptiveGroups(limit: 100, filter: {date_geq: $d, date_leq: $d}) { sum { rowsRead rowsWritten } }"
    d = gql(token, q, {"a": account, "d": day})
    try:
        rows = d["viewer"]["accounts"][0]["x"]
        out["read"] = sum(int(r["sum"]["rowsRead"]) for r in rows)
        out["write"] = sum(int(r["sum"]["rowsWritten"]) for r in rows)
    except (TypeError, KeyError, IndexError):
        pass
    return out


def health() -> str | None:
    """5락실 API가 살아 있는지. 문제가 있으면 설명 문구."""
    st, txt = http(f"{SITE}/api/vote?ids=20990101-1")
    if st != 200:
        return f"5락실 서버 기능(API) 응답 {st or '없음'}"
    try:
        json.loads(txt)
    except ValueError:
        return "5락실 서버 기능(API)이 꺼져 있어요(한도 초과로 정적 페이지만 나가는 중일 수 있음)"
    return None


def telegram(token: str, chat: str, text: str) -> bool:
    st, txt = http(f"https://api.telegram.org/bot{token}/sendMessage", {"chat_id": chat, "text": text, "disable_web_page_preview": True})
    if st != 200:
        print("텔레그램 전송 실패:", st, txt[:200])
    return st == 200


def setup(token: str) -> int:
    st, txt = http(f"https://api.telegram.org/bot{token}/getUpdates")
    try:
        ups = json.loads(txt).get("result", [])
    except ValueError:
        ups = []
    chats = {}
    for u in ups:
        m = u.get("message") or {}
        c = m.get("chat") or {}
        if c.get("type") == "private":
            chats[str(c["id"])] = c.get("first_name") or ""
    if not chats:
        print("::error::봇과의 개인 대화를 못 찾았어요. 텔레그램에서 @don3chon_alert_bot 을 열고 /start 를 보낸 뒤 다시 실행해 주세요.")
        return 1
    for cid in chats:
        telegram(token, cid, f"✅ 5락실 사용량 알림 연결 확인\n이 대화 번호: {cid}\nGitHub 저장소 Settings > Secrets and variables > Actions > Variables 에\nTELEGRAM_ADMIN_CHAT_ID = {cid}\n로 넣어 주세요.")
    print(f"개인 대화 {len(chats)}곳에 번호를 보냈어요.")
    return 0


def main() -> int:
    tg = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    if "--setup" in sys.argv:
        if not tg:
            print("::error::TELEGRAM_BOT_TOKEN 이 없어요.")
            return 1
        return setup(tg)
    now = dt.datetime.now(dt.timezone.utc)
    day = now.strftime("%Y-%m-%d")
    try:
        state = json.loads(STATE.read_text()) if STATE.exists() else {}
    except ValueError:
        state = {}
    if state.get("day") != day:
        state = {"day": day, "sent": []}

    msgs: list[str] = []
    cf_token, account = os.environ.get("CF_API_TOKEN", ""), os.environ.get("CF_ACCOUNT_ID", "").strip()
    if cf_token and account:
        u = usage(cf_token, account, now)
        for k, (name, limit) in LIMITS.items():
            v = u.get(k)
            if v is None:
                print(f"{name}: 읽지 못함")
                continue
            pct = v * 100 / limit
            print(f"{name}: {v:,} / {limit:,} ({pct:.1f}%)")
            for lv in LEVELS:
                if pct >= lv:
                    tag = f"{k}{lv}"
                    if tag not in state["sent"]:
                        state["sent"] += [f"{k}{x}" for x in LEVELS if x <= lv]
                        msgs.append(f"• {name} {pct:.0f}% ({v:,} / {limit:,})")
                    break
        if all(v is None for v in u.values()) and "readfail" not in state["sent"]:
            state["sent"].append("readfail")
            msgs.append("• 사용량을 읽지 못했어요. Cloudflare API 토큰(Account Analytics: Read)과 CF_ACCOUNT_ID 를 확인해 주세요.")
    else:
        print("CF_API_TOKEN/CF_ACCOUNT_ID 없음 → 사용량 확인은 건너뛰고 서버 응답만 확인")
    bad = health()
    if bad:
        print(bad)
        if "health" not in state["sent"]:
            state["sent"].append("health")
            msgs.append(f"• {bad}. 게임 화면은 그대로 열려요(순위·코인 저장만 멈춤).")

    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state))
    if not msgs:
        print("이상 없음")
        return 0
    kst = (now + dt.timedelta(hours=9)).strftime("%m/%d %H:%M")
    text = f"⚠️ 5락실 사용량 알림 ({kst} KST)\n" + "\n".join(msgs) + "\n\n무료 한도는 매일 오전 9시(KST)에 초기화돼요.\n" + UPGRADE
    print(text)
    if tg and chat and telegram(tg, chat, text):
        return 0
    # 텔레그램이 아직 없으면 실패로 끝내서 GitHub가 메일로 알리게 한다
    print("::error::" + text.replace("\n", " "))
    return 1


if __name__ == "__main__":
    sys.exit(main())
