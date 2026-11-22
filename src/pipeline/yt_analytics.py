"""쇼츠 시청 유지율·공유 수 수집 (2026-11-16, BK "다 설치해줘요").

공개 통계(yt_stats)에는 없는 시청 비율·평균 시청 시간·공유·구독 증가를 YouTube Analytics API 로 읽어
data/youtube/analytics.json 에 날짜별로 쌓는다. 주간 점검표(yt_stats weekly)가 이 값을 같이 보여 준다.

읽기 전용: 업로드 토큰과 따로, yt-analytics.readonly 권한만 있는 갱신 토큰을 쓴다(영상을 바꿀 수 없음).
    YT_CLIENT_ID / YT_CLIENT_SECRET                       돈삼촌 업로드와 같은 OAuth 앱
    YT_ANALYTICS_REFRESH_TOKEN                            돈 줍는 삼촌 채널 (없으면 건너뜀)
    RAKSIL_YT_ANALYTICS_REFRESH_TOKEN                     5락실 채널 (없으면 건너뜀)
    python -m pipeline.yt_analytics                       최근 28일, 영상별
발급 방법: docs/YOUTUBE_SETUP.md "4. 분석 읽기 토큰".
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

from .youtube import KST, access_token

OUT = pathlib.Path("data/youtube/analytics.json")
AUD = pathlib.Path("data/youtube/audience.json")  # 채널별 나이·성별 비율 (BK 11/22 '타깃층에 맞춰서' → 타깃 확인용)
API = "https://youtubeanalytics.googleapis.com/v2/reports"
METRICS = "views,averageViewPercentage,averageViewDuration,shares,likes,subscribersGained"
CHANNELS = {"uncle": "YT_ANALYTICS_REFRESH_TOKEN", "5raksil": "RAKSIL_YT_ANALYTICS_REFRESH_TOKEN"}


def query(token: str, start: str, end: str) -> dict:
    q = {"ids": "channel==MINE", "startDate": start, "endDate": end, "metrics": METRICS,
         "dimensions": "video", "sort": "-views", "maxResults": "200"}
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(q), headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def query_audience(token: str, start: str, end: str) -> dict:
    q = {"ids": "channel==MINE", "startDate": start, "endDate": end, "metrics": "viewerPercentage",
         "dimensions": "ageGroup,gender", "sort": "gender,ageGroup"}
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(q), headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def audience_rows(js: dict) -> dict[str, float]:
    """(ageGroup, gender, viewerPercentage) 행 → {'female age25-34': 12.3, ...}. 표본이 적으면 구글이 빈 행을 준다."""
    out = {}
    for row in js.get("rows", []) or []:
        age, gender, pct = row[0], row[1], row[2]
        out[f"{gender} {age}"] = round(float(pct), 1)
    return out


def rows_to_dict(js: dict) -> dict[str, dict]:
    """API 응답(열 머리 + 행) → 영상 id 별 값."""
    cols = [h["name"] for h in js.get("columnHeaders", [])]
    out = {}
    for row in js.get("rows", []) or []:
        d = dict(zip(cols, row))
        vid = d.pop("video")
        out[vid] = {"views": int(d.get("views", 0)), "avg_pct": round(float(d.get("averageViewPercentage", 0)), 1),
                    "avg_sec": int(d.get("averageViewDuration", 0)), "shares": int(d.get("shares", 0)),
                    "likes": int(d.get("likes", 0)), "subs": int(d.get("subscribersGained", 0))}
    return out


def why(e: Exception) -> str:
    """구글 오류 응답에서 원인만 꺼낸다 (토큰 값은 응답에 없음)."""
    code = getattr(e, "code", "")
    try:
        js = json.loads(e.read())  # type: ignore[attr-defined]
        err = js.get("error")
        msg = err.get("message", "") if isinstance(err, dict) else f"{err} {js.get('error_description', '')}"
    except Exception:
        msg = type(e).__name__
    return f"{code} {msg}".strip()[:200]


def fetch(now: dt.datetime | None = None) -> int:
    now = now or dt.datetime.now(KST)
    cid, sec = os.environ.get("YT_CLIENT_ID", ""), os.environ.get("YT_CLIENT_SECRET", "")
    end = now.date()
    start = end - dt.timedelta(days=28)
    snap, aud = {}, {}
    for ch, env in CHANNELS.items():
        rt = os.environ.get(env, "").strip()
        if not (cid and sec and rt):
            print(f"{ch}: {env} 없음 → 건너뜀 (docs/YOUTUBE_SETUP.md 4장)")
            continue
        step = "토큰 교환"
        try:
            tok = access_token(cid, sec, rt)
            step = "분석 조회"
            snap[ch] = rows_to_dict(query(tok, start.isoformat(), end.isoformat()))
            print(f"{ch}: {len(snap[ch])}편")
            try:  # 나이·성별은 따로: 실패해도 영상별 수치는 남긴다
                aud[ch] = audience_rows(query_audience(tok, start.isoformat(), end.isoformat()))
                print(f"{ch}: 나이·성별 {len(aud[ch])}칸")
            except Exception as e:
                print(f"{ch}: 나이·성별 읽기 실패 {why(e)}")
        except Exception as e:  # 한 채널 실패가 다른 채널을 막지 않게
            print(f"{ch}: 분석 읽기 실패 [{step}] {why(e)}")
    if not snap:
        return 0
    data = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    data[end.isoformat()] = snap
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if aud:
        a = json.loads(AUD.read_text(encoding="utf-8")) if AUD.exists() else {}
        a[end.isoformat()] = aud
        AUD.write_text(json.dumps(a, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return 0


def latest_by_video() -> dict[str, dict]:
    """가장 최근 수집분을 채널 구분 없이 영상 id → 값으로."""
    if not OUT.exists():
        return {}
    data = json.loads(OUT.read_text(encoding="utf-8"))
    if not data:
        return {}
    out = {}
    for vids in data[max(data)].values():
        out.update(vids)
    return out


if __name__ == "__main__":
    sys.exit(fetch())
