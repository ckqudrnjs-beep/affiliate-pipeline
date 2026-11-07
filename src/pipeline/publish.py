"""승인된 초안을 스레드·인스타그램에 공식 API로 발행한다 (표준 라이브러리만 사용).

- 대상: main에 올라온 drafts/YYYY-MM-DD.md 중 오늘·어제(KST) 초안, 발행 직전 준수 검사 재통과한 것만.
- 속도 제한: 실행 1회당 채널별 최대 1개, 채널별 하루 상한(기본 스레드 3, 인스타 2).
  API 공식 한도(스레드 24시간 250개, 인스타 24시간 100개)보다 훨씬 낮게 잡아 사람 운영 수준을 유지한다.
- 기록: drafts/published.json 에 채널별 발행 기록을 남겨 중복 발행을 막는다.
- 안전장치: 환경변수 PUBLISH_ENABLED=true 가 아니면 실제 발행 없이 무엇을 올릴지만 출력한다(dry-run).

토큰은 GitHub Secrets(THREADS_ACCESS_TOKEN, IG_ACCESS_TOKEN)에서만 읽는다. 로그에 찍지 않는다.
엔드포인트·버전은 Meta 공식 문서로 최종 확인할 것 (docs/META_SETUP.md).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from .compliance import DISCLOSURES, check

KST = dt.timezone(dt.timedelta(hours=9))
DRAFTS = pathlib.Path("drafts")
LOG = DRAFTS / "published.json"

THREADS_API = "https://graph.threads.net/v1.0"
IG_API = "https://graph.instagram.com/v21.0"
THREADS_MAX_CHARS = 500
IG_MAX_CHARS = 2200
IG_LINK_NOTE = "🔗 구매 링크는 프로필 링크에서 확인하세요."

SECTION_RE = re.compile(
    r"^## 초안 (\d+) — (.+?)\n(?:<!-- meta (.*?) -->\n)?\n```text\n(.*?)\n```",
    re.M | re.S,
)


# ---------- 초안 읽기 ----------

def parse_drafts(md: str, date: str) -> list[dict]:
    posts = []
    for num, status, meta, text in SECTION_RE.findall(md):
        fields = dict(kv.split("=", 1) for kv in meta.split() if "=" in kv)
        posts.append({
            "key": f"{date}#{num}",
            "date": date,
            "passed": status.startswith("✅"),
            "program": fields.get("program") or guess_program(text),
            "image": fields.get("image") or None,
            "text": text.strip(),
        })
    return posts


def guess_program(text: str) -> str:
    for prog in ("coupang", "naver", "aliexpress"):
        if prog in DISCLOSURES and DISCLOSURES[prog] in text:
            return prog
    return "generic"


def load_candidates(today: dt.date, drafts_dir: pathlib.Path = DRAFTS) -> list[dict]:
    """오늘·어제 초안만 (가격 기준일이 오래된 글은 올리지 않는다)."""
    out = []
    for d in (today, today - dt.timedelta(days=1)):
        f = drafts_dir / f"{d.isoformat()}.md"
        if f.exists():
            out += parse_drafts(f.read_text(encoding="utf-8"), d.isoformat())
    return out


# ---------- 채널별 본문 ----------

def threads_text(post: dict) -> str:
    return post["text"]


def instagram_caption(post: dict) -> str:
    """인스타 캡션은 링크가 클릭되지 않으므로 URL을 프로필 링크 안내로 바꾼다. 대가성 문구는 그대로 첫 줄."""
    text = re.sub(r"https?://\S+", IG_LINK_NOTE, post["text"])
    return text


def problems_for(post: dict, channel: str) -> list[str]:
    body = threads_text(post) if channel == "threads" else instagram_caption(post)
    problems = [] if post["passed"] else ["초안이 검사 통과 상태가 아님"]
    problems += check(body, [post["program"]])
    limit = THREADS_MAX_CHARS if channel == "threads" else IG_MAX_CHARS
    if len(body) > limit:
        problems.append(f"{limit}자 초과")
    if channel == "instagram" and not post.get("image"):
        problems.append("인스타는 이미지가 필요함 (image 없음)")
    return problems


# ---------- 발행 기록·속도 제한 ----------

def text_hash(post: dict) -> str:
    return hashlib.sha256(post["text"].encode()).hexdigest()[:16]


def load_log(path: pathlib.Path = LOG) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"threads": {}, "instagram": {}}


def save_log(log: dict, path: pathlib.Path = LOG) -> None:
    path.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def published_today(log: dict, channel: str, now: dt.datetime, promo: bool | None = None) -> int:
    """오늘(KST) 발행 수. promo=True/False 로 광고/정보 글만 셀 수 있다."""
    day = now.astimezone(KST).date().isoformat()
    return sum(1 for r in log.get(channel, {}).values()
               if r.get("at", "").startswith(day) and (promo is None or r.get("promo", True) == promo))


def is_promo(post: dict) -> bool:
    """제휴 링크 글이면 True. program=info 는 링크 없는 정보 글 (docs/OPERATIONS.md)."""
    return post["program"] != "info"


def pick(candidates: list[dict], log: dict, channel: str, now: dt.datetime, daily_max: int) -> tuple[dict | None, list[str]]:
    """이번 실행에 올릴 초안 1개와, 건너뛴 이유 목록."""
    notes = []
    if published_today(log, channel, now) >= daily_max:
        return None, [f"{channel}: 오늘 상한 {daily_max}개 도달, 대기"]
    done = log.get(channel, {})
    seen = {r.get("hash") for r in done.values()}
    # 광고 글은 채널별 하루 발행의 절반 이하: 오늘 광고 수가 정보 글 수보다 많아지지 않게
    promo_ok = published_today(log, channel, now, promo=True) <= published_today(log, channel, now, promo=False)
    for post in candidates:
        if post["key"] in done:
            continue
        if text_hash(post) in seen:
            notes.append(f"{channel} {post['key']} 건너뜀: 같은 내용을 이미 발행함 (반복 게시 방지)")
            continue
        if is_promo(post) and not promo_ok:
            notes.append(f"{channel} {post['key']} 대기: 오늘 광고 글 비율 50% 도달 (정보 글 먼저)")
            continue
        problems = problems_for(post, channel)
        if problems:
            notes.append(f"{channel} {post['key']} 건너뜀: " + "; ".join(problems))
            continue
        return post, notes
    return None, notes


# ---------- API 클라이언트 ----------

def _call(method: str, url: str, params: dict) -> dict:
    data = urllib.parse.urlencode(params).encode()
    if method == "GET":
        req = urllib.request.Request(url + "?" + data.decode(), method="GET")
    else:
        req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        # 응답 본문엔 토큰이 없으므로 원인 파악용으로 남긴다 (URL은 남기지 않는다)
        raise RuntimeError(f"Meta API 오류 {e.code}: {e.read().decode()[:500]}") from None


class ThreadsClient:
    def __init__(self, token: str, user_id: str = "me", call=_call):
        self.token, self.user, self.call = token, user_id, call

    def publish(self, text: str) -> dict:
        c = self.call("POST", f"{THREADS_API}/{self.user}/threads",
                      {"media_type": "TEXT", "text": text, "access_token": self.token})
        time.sleep(5)  # 컨테이너 처리 대기 (Meta 권장: 게시 전 잠시 대기)
        p = self.call("POST", f"{THREADS_API}/{self.user}/threads_publish",
                      {"creation_id": c["id"], "access_token": self.token})
        info = self.call("GET", f"{THREADS_API}/{p['id']}", {"fields": "permalink", "access_token": self.token})
        return {"id": p["id"], "url": info.get("permalink", "")}


class InstagramClient:
    def __init__(self, token: str, user_id: str = "me", call=_call):
        self.token, self.user, self.call = token, user_id, call

    def publish(self, caption: str, image_url: str) -> dict:
        c = self.call("POST", f"{IG_API}/{self.user}/media",
                      {"image_url": image_url, "caption": caption, "access_token": self.token})
        for _ in range(10):
            st = self.call("GET", f"{IG_API}/{c['id']}", {"fields": "status_code", "access_token": self.token})
            if st.get("status_code") == "FINISHED":
                break
            if st.get("status_code") == "ERROR":
                raise RuntimeError("인스타 미디어 처리 실패 (이미지 URL·형식 확인: 공개 JPEG)")
            time.sleep(3)
        p = self.call("POST", f"{IG_API}/{self.user}/media_publish",
                      {"creation_id": c["id"], "access_token": self.token})
        info = self.call("GET", f"{IG_API}/{p['id']}", {"fields": "permalink", "access_token": self.token})
        return {"id": p["id"], "url": info.get("permalink", "")}


# ---------- 실행 ----------

def run(env: dict, now: dt.datetime, clients: dict | None = None, drafts_dir: pathlib.Path = DRAFTS) -> list[str]:
    enabled = env.get("PUBLISH_ENABLED", "").lower() == "true"
    log_path = drafts_dir / "published.json"
    log = load_log(log_path)
    candidates = load_candidates(now.astimezone(KST).date(), drafts_dir)
    out = [] if enabled else ["[dry-run] PUBLISH_ENABLED=true 가 아니라 실제 발행하지 않습니다."]
    clients = clients or {}
    channels = {
        "threads": (env.get("THREADS_ACCESS_TOKEN"), int(env.get("THREADS_DAILY_MAX") or 3)),
        "instagram": (env.get("IG_ACCESS_TOKEN"), int(env.get("IG_DAILY_MAX") or 2)),
    }
    changed = False
    for channel, (token, daily_max) in channels.items():
        if not token and channel not in clients:
            out.append(f"{channel}: 토큰 없음, 건너뜀")
            continue
        post, notes = pick(candidates, log, channel, now, daily_max)
        out += notes
        if not post:
            out.append(f"{channel}: 올릴 초안 없음")
            continue
        if not enabled:
            out.append(f"{channel}: [dry-run] {post['key']} 발행 예정")
            continue
        try:
            if channel == "threads":
                client = clients.get("threads") or ThreadsClient(token, env.get("THREADS_USER_ID") or "me")
                res = client.publish(threads_text(post))
            else:
                client = clients.get("instagram") or InstagramClient(token, env.get("IG_USER_ID") or "me")
                res = client.publish(instagram_caption(post), post["image"])
        except Exception as e:  # 한 채널 실패가 다른 채널을 막지 않게
            out.append(f"{channel}: {post['key']} 발행 실패: {e}")
            continue
        log.setdefault(channel, {})[post["key"]] = {
            "at": now.astimezone(KST).isoformat(timespec="seconds"), "hash": text_hash(post),
            "promo": is_promo(post), **res}
        changed = True
        out.append(f"{channel}: {post['key']} 발행 완료 {res.get('url', '')}")
    if changed:
        save_log(log, log_path)
    return out


def main() -> int:
    lines = run(dict(os.environ), dt.datetime.now(KST))
    for line in lines:
        print(line)
    # 발행 실패가 있으면 워크플로를 실패로 표시해 GitHub 알림 메일이 가게 한다
    return 1 if any("발행 실패" in l for l in lines) else 0


if __name__ == "__main__":
    sys.exit(main())
