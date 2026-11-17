"""쇼츠 기획용 트렌드 레이더 (2026-11-17, BK "쇼츠 기획에 도움 되는 도구 설치").

매주 월요일 아침, 우리 주제 키워드로 '지난 7일 한국 쇼츠 중 조회수 높은 영상'을 유튜브 공식 Data API(읽기 전용 키)로 모아
docs/SHORTS_TRENDS_WEEKLY.md 표를 만든다. 주간 점검(월 10:23)과 대본 쓰기가 이 표를 보고 주제·훅을 고른다.

- 공식 API만 쓴다(스크래핑·남의 영상 내려받기 없음). 제목·숫자만 참고하고 영상·문구를 베끼지 않는다.
- 키: 저장소 비밀 YOUTUBE_API_KEY (이미 있음, 쇼츠 조회수 수집과 같은 키). 새 키 필요 없음.
- 할당량: 검색 1회 100, 키워드 14개 ≈ 1,500/주 (하루 무료 10,000).
- 구글 트렌드 '오늘의 인기 검색어' 공개 RSS(KR)는 되면 붙이고, 안 되면 건너뛴다.

    python -m pipeline.trend_radar          # 표 만들기
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

KEYWORDS = pathlib.Path("config/trend_keywords.json")
OUT = pathlib.Path("docs/SHORTS_TRENDS_WEEKLY.md")
DATA = pathlib.Path("data/youtube/trends")
API = "https://www.googleapis.com/youtube/v3"
TRENDS_RSS = "https://trends.google.com/trending/rss?geo=KR"
KST = dt.timezone(dt.timedelta(hours=9))


def _get(url: str) -> dict:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "trend-radar"}), timeout=30) as r:
        return json.loads(r.read())


def seconds(iso: str) -> int:
    """PT1M5S → 65."""
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def hook_type(title: str) -> str:
    """제목 첫머리 훅 분류 (우리 대본 훅 고를 때 참고용)."""
    t = title.strip()
    if re.match(r"^[\d,.]+\s*(원|만|천|%|배|개|분|초|kg|g)", t) or re.search(r"\d+\s*(원|만원|%)", t[:15]):
        return "숫자"
    if "?" in t or re.search(r"(일까|할까|나요|까요|인가)", t):
        return "질문"
    if re.search(r"(절대|하지 ?마|몰랐|아무도|진짜 이유|99%|대부분)", t):
        return "반전·금지"
    if re.search(r"(vs|VS|비교|차이)", t):
        return "비교"
    return "기타"


def search(key: str, q: str, since: dt.datetime, n: int = 10) -> list[str]:
    p = {"part": "id", "q": q, "type": "video", "videoDuration": "short", "regionCode": "KR",
         "relevanceLanguage": "ko", "order": "viewCount", "maxResults": n,
         "publishedAfter": since.strftime("%Y-%m-%dT%H:%M:%SZ"), "key": key}
    js = _get(f"{API}/search?" + urllib.parse.urlencode(p))
    return [it["id"]["videoId"] for it in js.get("items", []) if it.get("id", {}).get("videoId")]


def details(key: str, ids: list[str]) -> list[dict]:
    if not ids:
        return []
    p = {"part": "snippet,statistics,contentDetails", "id": ",".join(ids[:50]), "key": key}
    out = []
    now = dt.datetime.now(dt.timezone.utc)
    for it in _get(f"{API}/videos?" + urllib.parse.urlencode(p)).get("items", []):
        sn, st = it["snippet"], it.get("statistics", {})
        pub = dt.datetime.fromisoformat(sn["publishedAt"].replace("Z", "+00:00"))
        days = max((now - pub).total_seconds() / 86400, 0.5)
        views = int(st.get("viewCount", 0))
        out.append({"id": it["id"], "title": sn["title"], "channel": sn.get("channelTitle", ""),
                    "views": views, "per_day": int(views / days), "sec": seconds(it["contentDetails"].get("duration", "")),
                    "published": sn["publishedAt"][:10], "hook": hook_type(sn["title"])})
    return sorted(out, key=lambda v: -v["per_day"])


def google_trends(limit: int = 15) -> list[str]:
    try:
        with urllib.request.urlopen(urllib.request.Request(TRENDS_RSS, headers={"User-Agent": "trend-radar"}), timeout=20) as r:
            root = ET.fromstring(r.read())
        return [i.findtext("title", "") for i in root.iter("item")][:limit]
    except Exception as e:  # 막혀도 표는 만든다
        print(f"구글 트렌드 RSS 건너뜀: {e}", file=sys.stderr)
        return []


def render(today: str, groups: dict[str, dict[str, list[dict]]], trends: list[str]) -> str:
    L = [f"# 쇼츠 트렌드 레이더 ({today})", "",
         "지난 7일 한국 쇼츠(3분 이하) 중 키워드별 하루 조회수 상위. 유튜브 공식 API로 매주 월 06:50 자동 갱신.",
         "쓰는 법: 주제·훅 방향만 참고한다. 남의 제목·대사·영상은 베끼지 않고, 숫자는 우리 사이트 숫자만 쓴다 (`.claude/skills/shorts-planner`).", ""]
    hooks: dict[str, int] = {}
    for channel, kws in groups.items():
        L += [f"## {channel}", ""]
        for kw, vids in kws.items():
            L += [f"### {kw}", ""]
            if not vids:
                L += ["(결과 없음)", ""]
                continue
            L += ["| 하루 조회 | 총 조회 | 길이 | 훅 | 제목 | 채널 |", "|---:|---:|---:|---|---|---|"]
            for v in vids[:5]:
                hooks[v["hook"]] = hooks.get(v["hook"], 0) + 1
                title = v["title"].replace("|", "/")[:60]
                L.append(f"| {v['per_day']:,} | {v['views']:,} | {v['sec']}초 | {v['hook']} | "
                         f"[{title}](https://youtube.com/shorts/{v['id']}) | {v['channel'].replace('|', '/')[:20]} |")
            L.append("")
    if hooks:
        L += ["## 상위 영상 제목 훅 분포", "", " · ".join(f"{k} {n}" for k, n in sorted(hooks.items(), key=lambda x: -x[1])), ""]
    if trends:
        L += ["## 구글 트렌드 오늘의 인기 검색어 (KR)", "", ", ".join(trends), "",
              "살림·장보기·날씨·요금과 이어지는 것만 주제 후보로 쓴다. 사건·사고·인물 이슈는 쓰지 않는다.", ""]
    return "\n".join(L)


def run() -> int:
    key = os.environ.get("YT_API_KEY", "").strip()
    if not key:
        print("YT_API_KEY 없음: 저장소 비밀 YOUTUBE_API_KEY 를 확인 (docs/SHORTS_GROWTH.md)")
        return 0
    cfg = json.loads(KEYWORDS.read_text(encoding="utf-8"))
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)
    groups: dict[str, dict[str, list[dict]]] = {}
    for channel, kws in cfg.items():
        groups[channel] = {}
        for kw in kws:
            try:
                groups[channel][kw] = [v for v in details(key, search(key, kw, since)) if 0 < v["sec"] <= 180]
            except Exception as e:
                print(f"{kw}: {e}", file=sys.stderr)
                groups[channel][kw] = []
    today = dt.datetime.now(KST).date().isoformat()
    DATA.mkdir(parents=True, exist_ok=True)
    trends = google_trends()
    (DATA / f"{today}.json").write_text(json.dumps({"groups": groups, "google_trends": trends}, ensure_ascii=False, indent=1),
                                       encoding="utf-8")
    OUT.write_text(render(today, groups, trends), encoding="utf-8")
    print(OUT.read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(run())
