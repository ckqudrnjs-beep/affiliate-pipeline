"""매일 아침 상태 점검 (2026-11-15 BK: 보안·운영 리스크 관리, plan/SECURITY.md A).

.github/workflows/health.yml 이 매일 10:30 KST 에 실행한다. 문제가 있을 때만 텔레그램으로 BK 개인 대화에 알린다.
월요일에는 이상이 없어도 "이상 없음" 한 줄을 보내 점검 자체가 살아 있는지 알 수 있게 한다.

점검 항목
1. 예약 작업(GitHub Actions): 켜져 있는 작업 중 최근 3일 안에 돈 마지막 실행이 실패했는지
2. 자동 글: don3chon 글(data/articles)이 30시간 넘게 안 올라왔는지 (05:13·17:13 자동 글은 GitHub 작업이 아니라서 따로 본다)
3. 생활 시세: data/daily 가 30시간 넘게 안 올라왔는지
4. 사이트: don3chon.com, 5raksil.com 첫 화면과 5락실 서버 기능(API)이 응답하는지

필요한 값: GITHUB_TOKEN(작업이 자동으로 줌), GITHUB_REPOSITORY, TELEGRAM_BOT_TOKEN(Secret), TELEGRAM_ADMIN_CHAT_ID(Variable).
텔레그램 설정이 없으면 작업을 '실패'로 끝내서 GitHub 가 메일로 알리게 한다.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys

from cf_usage_alert import health as raksil_api, http, telegram

FRESH = [  # (저장소 경로, 최대 몇 시간, 이름)
    ("data/articles", 30, "don3chon 자동 글"),
    ("data/daily", 30, "오늘의 생활 시세"),
]
SITES = ["https://don3chon.com/", "https://5raksil.com/"]
BAD = {"failure", "timed_out", "startup_failure"}


def gh(path: str) -> dict | list | None:
    repo, tok = os.environ.get("GITHUB_REPOSITORY", ""), os.environ.get("GITHUB_TOKEN", "")
    st, txt = http(f"https://api.github.com/repos/{repo}/{path}", headers={"authorization": f"Bearer {tok}", "accept": "application/vnd.github+json"})
    if st != 200:
        print(f"GitHub API {path} → {st}")
        return None
    try:
        return json.loads(txt)
    except ValueError:
        return None


def when(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def check_workflows(now: dt.datetime) -> list[str]:
    out = []
    wfs = gh("actions/workflows?per_page=100")
    if not wfs:
        return ["• 예약 작업 목록을 못 읽었어요(GitHub API)."]
    for w in wfs.get("workflows", []):
        if w.get("state") != "active":
            continue
        runs = gh(f"actions/workflows/{w['id']}/runs?per_page=1&status=completed&branch=main") or {}
        # main 실행만 본다: 작업 브랜치의 일회용·시험 워크플로 실패는 운영 작업이 아님 (11/23)
        r = (runs.get("workflow_runs") or [None])[0]
        if not r or r.get("conclusion") not in BAD:
            continue
        if now - when(r["created_at"]) > dt.timedelta(days=3):
            continue  # 오래된 실패는 이미 알렸거나 지금은 안 쓰는 작업
        out.append(f"• 작업 실패: {w['name']} ({r['conclusion']})\n  {r['html_url']}")
    return out


def check_fresh(now: dt.datetime) -> list[str]:
    out = []
    for path, hours, name in FRESH:
        c = gh(f"commits?path={path}&per_page=1")
        if not c:
            out.append(f"• {name}: 최근 기록을 못 읽었어요.")
            continue
        t = when(c[0]["commit"]["committer"]["date"])
        age = (now - t).total_seconds() / 3600
        print(f"{name}: 마지막 {age:.1f}시간 전")
        if age > hours:
            out.append(f"• {name}이(가) {age:.0f}시간째 안 올라왔어요(기준 {hours}시간).")
    return out


def check_sites() -> list[str]:
    out = []
    for u in SITES:
        st, _ = http(u)
        print(f"{u} → {st}")
        if st != 200:
            out.append(f"• {u} 응답 {st or '없음'}")
    bad = raksil_api()
    if bad:
        out.append(f"• {bad}")
    return out


def main() -> int:
    now = dt.datetime.now(dt.timezone.utc)
    msgs = check_workflows(now) + check_fresh(now) + check_sites()
    kst = now + dt.timedelta(hours=9)
    stamp = kst.strftime("%m/%d %H:%M")
    if msgs:
        text = f"⚠️ 사이트 상태 점검 ({stamp} KST)\n" + "\n".join(msgs) + "\n\nClaude 프로젝트에 이 메시지를 그대로 붙여 주시면 고칠게요."
    elif kst.weekday() == 0:
        text = f"✅ 주간 확인 ({stamp} KST): 예약 작업·자동 글·두 사이트 모두 이상 없음"
    else:
        print("이상 없음")
        return 0
    print(text)
    tg, chat = os.environ.get("TELEGRAM_BOT_TOKEN", ""), os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    if tg and chat and telegram(tg, chat, text):
        return 0
    if not msgs:
        return 0
    print("::error::" + text.replace("\n", " "))
    return 1


if __name__ == "__main__":
    sys.exit(main())
