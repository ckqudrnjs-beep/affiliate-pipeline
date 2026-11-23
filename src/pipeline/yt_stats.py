"""쇼츠 조회수 기록·주간 점검 (2026-11-15, BK "조회수는 너에게 맡길게").

매일 youtube 워크플로 뒤(또는 수동) 올린 영상의 공개 통계(조회수·좋아요·댓글)를 data/youtube/stats.json 에 날짜별로 쌓고,
주간 점검표 docs/SHORTS_WEEKLY.md 를 만든다(형식별 평균, 상위·하위 편). 개선은 이 표를 보고 규칙·아이디어 은행을 바꾼다.

통계 읽기: 업로드 토큰(youtube.upload)으로 되면 그걸, 안 되면 저장소 비밀 YOUTUBE_API_KEY(YouTube Data API 키, 읽기 전용)를 쓴다.
    python -m pipeline.yt_stats fetch     # 통계 쌓기
    python -m pipeline.yt_stats weekly    # 주간 점검표
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

from .youtube import KST, LOG, access_token
from .yt_analytics import latest_by_video

STATS = pathlib.Path("data/youtube/stats.json")
RAKSIL = pathlib.Path("data/youtube/raksil_uploaded.json")  # 5락실 쇼츠
WEBNOVEL = pathlib.Path("data/youtube/webnovel.json")  # 한 화만 더 (11/23 BK OK: 4채널 모두 수집)
MUSIC = pathlib.Path("data/music/uploaded.json")  # BEEKAY SONGS (정식 곡 video_id + 쇼츠 short_id)
CHANNELS = pathlib.Path("data/youtube/channels.json")  # 날짜별 채널 구독자·총조회 (구독 500 추적)
CH_API = "https://www.googleapis.com/youtube/v3/channels"
EP_DIR = pathlib.Path("data/episodes")
WEEKLY = pathlib.Path("docs/SHORTS_WEEKLY.md")
API = "https://www.googleapis.com/youtube/v3/videos"


def _get(url: str, token: str | None = None) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"} if token else {})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def fetch_stats(ids: list[str]) -> dict[str, dict]:
    token, key = None, os.environ.get("YT_API_KEY", "").strip()
    if all(os.environ.get(k) for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN")):
        try:
            token = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"], os.environ["YT_REFRESH_TOKEN"])
        except Exception:
            token = None
    out = {}
    for i in range(0, len(ids), 50):
        q = {"part": "statistics,snippet", "id": ",".join(ids[i:i + 50])}
        js = None
        if token:
            try:
                js = _get(API + "?" + urllib.parse.urlencode(q), token)
            except Exception:
                js = None
        if js is None and key:
            js = _get(API + "?" + urllib.parse.urlencode({**q, "key": key}))
        if js is None:
            print("통계를 읽을 수 없음: 업로드 토큰 권한 부족 + 저장소 비밀 YOUTUBE_API_KEY 없음 (docs/SHORTS_GROWTH.md)")
            return out
        for it in js.get("items", []):
            st = it.get("statistics", {})
            out[it["id"]] = {"views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                             "comments": int(st.get("commentCount", 0)), "published": it["snippet"].get("publishedAt", ""),
                             "channel_id": it["snippet"].get("channelId", "")}
    return out


def _load(p: pathlib.Path) -> dict:
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    except ValueError:
        return {}


def video_ids() -> dict[str, str]:
    """video id → 기록 키. 삼촌(키 그대로), 5락실(5raksil-), 웹소설(webnovel-), 음악(music-/music-short-)."""
    ids = {v["video_id"]: k for k, v in _load(LOG).items() if isinstance(v, dict) and v.get("video_id")}
    ids.update({v["id"]: "5raksil-" + k for k, v in _load(RAKSIL).items() if isinstance(v, dict) and v.get("id")})
    ids.update({v["id"]: "webnovel-" + k for k, v in _load(WEBNOVEL).items() if isinstance(v, dict) and v.get("id")})
    for k, v in _load(MUSIC).items():
        if k.startswith("_") or not isinstance(v, dict):
            continue  # _old = BK가 지운 옛 비공개 영상
        name = v.get("title") or k
        if v.get("video_id"):
            ids[v["video_id"]] = "music-" + name
        if v.get("short_id"):
            ids[v["short_id"]] = "music-short-" + name
    return ids


def channel_of(slug: str) -> str:
    for pre, ch in (("5raksil-", "5raksil"), ("webnovel-", "webnovel"), ("music-", "music")):
        if slug.startswith(pre):
            return ch
    return "uncle"


def fetch_channels(chan_ids: dict[str, str]) -> dict[str, dict]:
    """채널 id → 구독자·총조회·영상 수 (공개 통계, API 키). 구독자 수 숨김이면 subs=None."""
    key = os.environ.get("YT_API_KEY", "").strip()
    if not key or not chan_ids:
        return {}
    try:
        js = _get(CH_API + "?" + urllib.parse.urlencode({"part": "statistics", "id": ",".join(chan_ids), "key": key}))
    except Exception as e:  # 채널 통계는 보조라 실패해도 영상 통계는 저장
        print(f"채널 통계 실패: {e}")
        return {}
    out = {}
    for it in js.get("items", []):
        st = it.get("statistics", {})
        out[chan_ids.get(it["id"], it["id"])] = {
            "id": it["id"], "subs": None if st.get("hiddenSubscriberCount") else int(st.get("subscriberCount", 0)),
            "views": int(st.get("viewCount", 0)), "videos": int(st.get("videoCount", 0))}
    return out


def fetch() -> int:
    ids = video_ids()
    got = fetch_stats(list(ids))
    if not got:
        return 0
    data = _load(STATS)
    today = dt.datetime.now(KST).date().isoformat()
    data[today] = {ids[vid]: {"id": vid, **{k: v for k, v in s.items() if k != "channel_id"}} for vid, s in got.items()}
    STATS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{today}: {len(got)}편 통계")
    chans = {s["channel_id"]: channel_of(ids[vid]) for vid, s in got.items() if s.get("channel_id")}
    snap = fetch_channels(chans)
    if snap:
        hist = _load(CHANNELS)
        hist[today] = snap
        CHANNELS.write_text(json.dumps(hist, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("구독자: " + ", ".join(f"{k} {v['subs']}" for k, v in snap.items()))
    return 0


def episode_meta() -> dict[str, dict]:
    """slug → 형식·제목 (새 기획 대본)."""
    out = {}
    for p in EP_DIR.glob("*.meta.json"):
        ep = pathlib.Path(str(p).replace(".meta.json", ".json"))
        if ep.exists():
            spec = json.loads(ep.read_text(encoding="utf-8"))
            out[json.loads(p.read_text(encoding="utf-8"))["slug"]] = {"format": spec.get("format", ""), "title": spec.get("title", ""),
                                                                     "date": spec.get("date", "")}
    return out


def weekly() -> int:
    data = json.loads(STATS.read_text(encoding="utf-8")) if STATS.exists() else {}
    if not data:
        print("통계 없음")
        return 0
    last = max(data)
    snap = data[last]
    meta = episode_meta()
    an = latest_by_video()  # 시청 비율·공유 (분석 토큰 있을 때만)
    rows = []
    for slug, v in snap.items():
        m = meta.get(slug, {"format": {"5raksil": "5락실", "webnovel": "웹소설", "music": "음악"}.get(channel_of(slug), "예전"), "title": slug,
                            "date": v.get("published", "")[:10]})
        a = an.get(v.get("id", ""), {})
        rows.append((v["views"], slug, m["format"], m["title"], m["date"], v["likes"], v["comments"],
                     f'{a["avg_pct"]}%' if a else "-", str(a["shares"]) if a else "-"))
    rows.sort(reverse=True)
    by = {}
    for r in rows:
        by.setdefault(r[2], []).append(r[0])
    lines = [f"# 쇼츠 주간 점검 ({last} 기준)", "", "자동 생성: python -m pipeline.yt_stats weekly. 조회수는 공개 통계(지연 있음).", "",
             "## 형식별 평균 조회수", "| 형식 | 편 수 | 평균 | 최고 |", "|---|---|---|---|"]
    for f, vs in sorted(by.items(), key=lambda x: -sum(x[1]) / len(x[1])):
        lines.append(f"| {f} | {len(vs)} | {sum(vs) // len(vs):,} | {max(vs):,} |")
    lines += ["", "## 편별 (조회수 순)", "| 조회수 | 시청비율 | 공유 | 좋아요 | 댓글 | 형식 | 날짜 | 제목 |",
              "|---|---|---|---|---|---|---|---|"]
    lines += [f"| {r[0]:,} | {r[7]} | {r[8]} | {r[5]} | {r[6]} | {r[2]} | {r[4]} | {r[3]} |" for r in rows]
    WEEKLY.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:12]))
    return 0


def main(argv: list[str]) -> int:
    return {"fetch": fetch, "weekly": weekly}.get(argv[0] if argv else "fetch", fetch)()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
