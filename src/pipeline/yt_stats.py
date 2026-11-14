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

STATS = pathlib.Path("data/youtube/stats.json")
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
                             "comments": int(st.get("commentCount", 0)), "published": it["snippet"].get("publishedAt", "")}
    return out


def fetch() -> int:
    log = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {}
    ids = {v["video_id"]: k for k, v in log.items() if v.get("video_id")}
    got = fetch_stats(list(ids))
    if not got:
        return 0
    data = json.loads(STATS.read_text(encoding="utf-8")) if STATS.exists() else {}
    today = dt.datetime.now(KST).date().isoformat()
    data[today] = {ids[vid]: {"id": vid, **v} for vid, v in got.items()}
    STATS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{today}: {len(got)}편 통계")
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
    rows = []
    for slug, v in snap.items():
        m = meta.get(slug, {"format": "예전", "title": slug, "date": v.get("published", "")[:10]})
        rows.append((v["views"], slug, m["format"], m["title"], m["date"], v["likes"], v["comments"]))
    rows.sort(reverse=True)
    by = {}
    for r in rows:
        by.setdefault(r[2], []).append(r[0])
    lines = [f"# 쇼츠 주간 점검 ({last} 기준)", "", "자동 생성: python -m pipeline.yt_stats weekly. 조회수는 공개 통계(지연 있음).", "",
             "## 형식별 평균 조회수", "| 형식 | 편 수 | 평균 | 최고 |", "|---|---|---|---|"]
    for f, vs in sorted(by.items(), key=lambda x: -sum(x[1]) / len(x[1])):
        lines.append(f"| {f} | {len(vs)} | {sum(vs) // len(vs):,} | {max(vs):,} |")
    lines += ["", "## 편별 (조회수 순)", "| 조회수 | 좋아요 | 댓글 | 형식 | 날짜 | 제목 |", "|---|---|---|---|---|---|"]
    lines += [f"| {r[0]:,} | {r[5]} | {r[6]} | {r[2]} | {r[4]} | {r[3]} |" for r in rows]
    WEEKLY.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:12]))
    return 0


def main(argv: list[str]) -> int:
    return {"fetch": fetch, "weekly": weekly}.get(argv[0] if argv else "fetch", fetch)()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
