"""유튜브 쇼츠 예약 업로드 (YouTube Data API v3, 표준 라이브러리만 사용).

- 대기열: config/youtube_queue.csv (order 순서), 영상: media/youtube/<slug>.mp4
- 실행 1회당 최대 1개. 다음 공개 시각(19:00 KST)이 LEAD_DAYS 안에 들어올 때만 올린다.
  올릴 때는 '비공개 + 예약 공개(publishAt)' 로 올려, BK가 공개 전에 YouTube Studio에서
  '유료 프로모션 포함' 칸을 체크할 시간을 남긴다 (이 항목은 API로 설정할 수 없음).
- 공개 간격: YT_INTERVAL_DAYS (기본 1일, 2026-11-09 BK 결정: 하루 1개).
- 기록: data/youtube/uploaded.json (중복 업로드 방지)
- 안전장치: YOUTUBE_ENABLED=true 가 아니면 무엇을 올릴지만 출력한다(dry-run).
- 준수 검사: 제목은 [광고]로 시작, 설명 첫 줄은 광고 문구. 아니면 올리지 않는다.

인증: GitHub Secrets YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN 에서만 읽고 로그에 찍지 않는다.
발급 방법은 docs/YOUTUBE_SETUP.md.
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

KST = dt.timezone(dt.timedelta(hours=9))
QUEUE = pathlib.Path("config/youtube_queue.csv")
MEDIA = pathlib.Path("media/youtube")
LOG = pathlib.Path("data/youtube/uploaded.json")

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"

PUBLISH_HOUR = 19  # KST, 퇴근 후 시청 시간대
DISCLOSURE = "광고 · 알리익스프레스 제휴 링크가 포함된 콘텐츠로, 구매 시 일정액의 수수료를 받습니다."
TAGS = ["돈줍는삼촌", "살림템", "알리익스프레스", "가전추천"]


def load_queue(path: pathlib.Path = QUEUE) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return sorted(rows, key=lambda r: int(r["order"]))


def load_log(path: pathlib.Path = LOG) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def is_synthetic(row: dict) -> bool:
    """HeyGen 같은 사실적인 AI 인물 영상 (대기열 synthetic 열 = 1)."""
    return str(row.get("synthetic") or "").strip() == "1"


def build_description(row: dict) -> str:
    return "\n".join([
        DISCLOSURE,
        row["intro"].strip(),
        f"가격은 {row['price_date'].strip()} 기준이며 바뀔 수 있어요. 비교·계산은 don3chon.com",
        "",
        "AI로 만든 가상 인물이 등장하는 영상입니다." if is_synthetic(row) else "내레이션: AI 음성",
        "#Shorts #돈줍는삼촌",
    ])


def check(row: dict, description: str) -> list[str]:
    errors = []
    title = row["title"].strip()
    if not title.startswith("[광고]"):
        errors.append("제목이 [광고]로 시작하지 않음")
    if len(title) > 100:
        errors.append("제목 100자 초과")
    if not description.splitlines()[0].startswith("광고"):
        errors.append("설명 첫 줄이 광고 문구가 아님")
    if len(description.encode("utf-8")) > 5000:
        errors.append("설명 5000바이트 초과")
    if "<" in title + description or ">" in title + description:
        errors.append("제목·설명에 < > 사용 불가")
    return errors


def next_slot(log: dict, now: dt.datetime, interval_days: int) -> dt.datetime:
    """다음 공개 시각. 마지막 예약 + 간격, 단 내일 19:00 KST 보다 이르지 않게."""
    tomorrow = (now.astimezone(KST) + dt.timedelta(days=1)).replace(
        hour=PUBLISH_HOUR, minute=0, second=0, microsecond=0)
    times = [dt.datetime.fromisoformat(v["publish_at"]) for v in log.values()]
    if not times:
        return tomorrow
    return max(tomorrow, max(times) + dt.timedelta(days=interval_days))


def pick(queue: list[dict], log: dict) -> dict | None:
    for row in queue:
        if row["slug"] not in log:
            return row
    return None


def access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    data = urllib.parse.urlencode({
        "client_id": client_id, "client_secret": client_secret,
        "refresh_token": refresh_token, "grant_type": "refresh_token",
    }).encode()
    with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=data), timeout=30) as r:
        return json.load(r)["access_token"]


def video_body(row: dict, description: str, publish_at: dt.datetime | None) -> dict:
    """publish_at 이 None 이면 바로 공개 (수동 실행 YT_NOW=true)."""
    status = ({"privacyStatus": "public"} if publish_at is None else {
        "privacyStatus": "private",  # publishAt 은 private 일 때만 설정 가능
        "publishAt": publish_at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    return {
        "snippet": {
            "title": row["title"].strip(),
            "description": description,
            "tags": TAGS,
            "categoryId": "26",  # Howto & Style
            "defaultLanguage": "ko",
            "defaultAudioLanguage": "ko",
        },
        "status": {
            **status,
            "selfDeclaredMadeForKids": False,
            "containsSyntheticMedia": is_synthetic(row),  # AI 가상 인물이면 True, 상품 사진 편집 + AI 내레이션은 False
            "embeddable": True,
        },
    }


def upload(token: str, body: dict, video: pathlib.Path) -> dict:
    size = video.stat().st_size
    req = urllib.request.Request(UPLOAD_URL, data=json.dumps(body).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": str(size),
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        location = r.headers["Location"]
    put = urllib.request.Request(location, data=video.read_bytes(), method="PUT", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "video/mp4",
    })
    with urllib.request.urlopen(put, timeout=600) as r:
        return json.load(r)


def summary(text: str) -> None:
    print(text)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(text + "\n")


def main(now: dt.datetime | None = None) -> int:
    now = now or dt.datetime.now(KST)
    enabled = os.environ.get("YOUTUBE_ENABLED", "").lower() == "true"
    interval = int(os.environ.get("YT_INTERVAL_DAYS") or 1)
    lead = int(os.environ.get("YT_LEAD_DAYS") or 2)

    publish_now = os.environ.get("YT_NOW", "").lower() == "true"  # 수동 실행: 지금 바로 공개
    want = os.environ.get("YT_SLUG", "").strip()

    log = load_log()
    queue = load_queue()
    if want:
        row = next((r for r in queue if r["slug"] == want and want not in log), None)
    else:
        row = pick(queue, log)
    if row is None:
        summary(f"유튜브: 대기열에 올릴 영상 없음 {want}")
        return 0
    slot = now if publish_now else next_slot(log, now, interval)
    if not publish_now and slot - now > dt.timedelta(days=lead):
        summary(f"유튜브: 다음 영상 {row['slug']} 은 {slot:%m/%d %H:%M} 공개 예정, 아직 올릴 때가 아님")
        return 0

    description = build_description(row)
    errors = check(row, description)
    video = MEDIA / f"{row['slug']}.mp4"
    if not video.exists():
        errors.append(f"영상 파일 없음: {video}")
    if errors:
        summary(f"::error::유튜브 업로드 중단 ({row['slug']}): " + ", ".join(errors))
        return 1

    if not enabled:
        summary(f"[dry-run] {row['title']} → {slot:%Y-%m-%d %H:%M} KST 예약 (YOUTUBE_ENABLED=true 가 아니라 안 올림)\n"
                f"```\n{description}\n```")
        return 0

    try:
        token = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"],
                             os.environ["YT_REFRESH_TOKEN"])
        res = upload(token, video_body(row, description, None if publish_now else slot), video)
    except KeyError as e:
        summary(f"::error::Secret 없음: {e.args[0]} (docs/YOUTUBE_SETUP.md)")
        return 1
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        summary(f"::error::유튜브 API 오류 {e.code}: {detail}")
        return 1

    vid = res["id"]
    log[row["slug"]] = {"video_id": vid, "publish_at": slot.isoformat(), "uploaded_at": now.isoformat(timespec="seconds")}
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary(f"업로드 완료: {row['title']}\n- {slot:%m/%d %H:%M} KST 공개 예약\n"
            f"- 공개 전에 유료 프로모션 체크: https://studio.youtube.com/video/{vid}/edit")
    return 0


if __name__ == "__main__":
    sys.exit(main())
