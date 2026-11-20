"""주간 성과판 (2026-11-20, BK "효과 없는 작업은 끄고 잘되는 작업은 키우기"). docs/DIRECTION.md 5장.

어떤 자동 작업이 실제로 조회·검색 유입을 만드는지 한 장으로 모은다. 이미 저장소에 쌓이는 숫자만 쓴다(새 API 호출 없음).
- 유튜브: data/youtube/analytics.json 최근 스냅샷(지난 28일, 영상별) → 채널·형식별 평균
- 검색: data/seo/gsc.json 최근 스냅샷(지난 28일 상위 페이지) → 사이트·페이지 종류별 클릭·노출
- 비용: data/api_usage/*.json 이번 회차 Claude API 작업별 달러

결과는 docs/SCOREBOARD.md 에 쓰고, '끄기 검토 / 키우기' 제안을 텔레그램 한 줄로 보낸다. 직접 끄지 않는다(끄기는 DIRECTION 4장 흐름대로 BK 확인 후).

    PYTHONPATH=src python -m pipeline.scoreboard          # 쓰기 + 텔레그램
    PYTHONPATH=src python -m pipeline.scoreboard --dry    # 출력만
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/SCOREBOARD.md"
KST = dt.timezone(dt.timedelta(hours=9))
LOW, HIGH = 0.5, 1.5  # 채널 평균 대비 이 배수 아래면 '끄기 검토', 위면 '키우기'


def jload(p: pathlib.Path, default):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def uncle_group(slug: str, styles: dict[str, str]) -> str:
    if styles.get(slug) == "toon":
        return "캐릭터 영상(toon)"
    m = re.match(r"ep-\d{4}-\d{2}-\d{2}-([a-z-]+?)(?:-[ab])?$", slug)
    if m:  # 2026-11-20부터 삼촌 쇼츠는 캐릭터 영상만 (DIRECTION 2-3) → 그 전 요일 형식은 참고용
        return f"{m.group(1)} (예전 형식, 종료)"
    if slug.startswith(("heygen-", "uncle-")):
        return "아바타 상품(종료)"
    return "상품(종료)"


def raksil_group(key: str, title: str) -> str:
    if "-game-" in key or title.startswith("[신작]"):
        return "게임 소개"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", key) or "밸런스" in title:
        return "밸런스게임"
    return "기타"


def youtube_groups(root: pathlib.Path = ROOT) -> dict[str, dict[str, list[dict]]]:
    an = jload(root / "data/youtube/analytics.json", {})
    if not an:
        return {}
    last = an[sorted(an)[-1]]
    styles = {}
    for f in (root / "data/episodes").glob("*.meta.json"):
        m = jload(f, {})
        if m.get("slug"):
            styles[m["slug"]] = m.get("style", "")
    uncle_ids = {u.get("video_id"): uncle_group(slug, styles) for slug, u in jload(root / "data/youtube/uploaded.json", {}).items()}
    raksil_ids = {u.get("id"): raksil_group(k, u.get("title", "")) for k, u in jload(root / "data/youtube/raksil_uploaded.json", {}).items()}
    out: dict[str, dict[str, list[dict]]] = {}
    for ch, vids in last.items():
        ids = uncle_ids if ch == "uncle" else raksil_ids
        rows = vids.items() if isinstance(vids, dict) else vids
        for vid, s in rows:
            g = ids.get(vid, "기록 없음(수동·예전)")
            out.setdefault(ch, {}).setdefault(g, []).append({"id": vid, **s})
    return out


def page_kind(url: str) -> str:
    path = urlparse(url).path.strip("/")
    return (path.split("/")[0] or "홈") if path else "홈"


def search_groups(root: pathlib.Path = ROOT) -> dict[str, dict[str, dict]]:
    g = jload(root / "data/seo/gsc.json", {})
    if not g:
        return {}
    out: dict[str, dict[str, dict]] = {}
    for site, s in g[sorted(g)[-1]].items():
        name = site.replace("sc-domain:", "")
        for p in s.get("top_page", []):
            k = out.setdefault(name, {}).setdefault(page_kind(p["key"]), {"clicks": 0, "impressions": 0, "pages": 0})
            k["clicks"] += p.get("clicks", 0)
            k["impressions"] += p.get("impressions", 0)
            k["pages"] += 1
    return out


def api_cost(root: pathlib.Path = ROOT) -> dict[str, float]:
    files = sorted((root / "data/api_usage").glob("*.json"))
    cost: dict[str, float] = {}
    for row in jload(files[-1], []) if files else []:
        cost[row["job"]] = cost.get(row["job"], 0) + float(row.get("usd", 0))
    return cost


def suggest(yt: dict[str, dict[str, list[dict]]]) -> list[str]:
    """채널 평균 대비 형식별 평균 조회수로 끄기 검토·키우기 제안 (영상 2편 이상인 형식만)."""
    out = []
    for ch, groups in yt.items():
        allv = [r.get("views", 0) for rows in groups.values() for r in rows]
        if not allv:
            continue
        avg = sum(allv) / len(allv)
        for g, rows in groups.items():
            if len(rows) < 2 or g.startswith("기록 없음") or "종료" in g or avg == 0:  # 이미 꺼진 형식엔 제안 안 함
                continue
            gv = sum(r.get("views", 0) for r in rows) / len(rows)
            name = "삼촌" if ch == "uncle" else "5락실"
            if gv < avg * LOW:
                out.append(f"{name} '{g}' 평균 {gv:.0f}회 < 채널 평균 {avg:.0f}회의 절반 → 끄기·줄이기 검토")
            elif gv > avg * HIGH:
                out.append(f"{name} '{g}' 평균 {gv:.0f}회 > 채널 평균 {avg:.0f}회의 1.5배 → 키우기")
    return out


def render(today: dt.date, yt, search, cost, tips) -> str:
    L = [f"# 주간 성과판 (SCOREBOARD.md) — {today.isoformat()}", "",
         "> 매주 월 08:20 자동(`scoreboard`). 숫자는 저장소에 쌓인 지난 28일 값(유튜브 분석·서치 콘솔)만 쓴다. "
         "끄기·키우기는 제안일 뿐, 실제 변경은 docs/DIRECTION.md 4장 흐름(BK 확인)으로.", "",
         "## 제안", *([f"- {t}" for t in tips] or ["- 이번 주는 눈에 띄게 낮거나 높은 형식 없음"]), ""]
    for ch, groups in yt.items():
        L += [f"## 유튜브 — {'삼촌' if ch == 'uncle' else '5락실'} (형식별, 지난 28일)", "",
              "| 형식(만든 작업) | 편 수 | 평균 조회 | 평균 시청 비율 | 공유 | 구독 |", "|---|---|---|---|---|---|"]
        for g, rows in sorted(groups.items(), key=lambda kv: -sum(r.get("views", 0) for r in kv[1]) / len(kv[1])):
            n = len(rows)
            L.append(f"| {g} | {n} | {sum(r.get('views', 0) for r in rows) / n:.0f} | "
                     f"{sum(r.get('avg_pct', 0) for r in rows) / n:.0f}% | {sum(r.get('shares', 0) for r in rows)} | "
                     f"{sum(r.get('subs', 0) for r in rows)} |")
        L.append("")
    for site, kinds in search.items():
        L += [f"## 검색 유입 — {site} (페이지 종류별, 지난 28일 상위 페이지)", "",
              "| 페이지 종류 | 페이지 수 | 클릭 | 노출 |", "|---|---|---|---|"]
        for k, v in sorted(kinds.items(), key=lambda kv: (-kv[1]["clicks"], -kv[1]["impressions"])):
            L.append(f"| /{k} | {v['pages']} | {v['clicks']} | {v['impressions']} |")
        L.append("")
    if cost:
        L += ["## Claude API 비용 (이번 회차, 작업별)", "", "| 작업 | 달러 |", "|---|---|"]
        L += [f"| {j} | ${c:.2f} |" for j, c in sorted(cost.items(), key=lambda kv: -kv[1])]
        L.append("")
    L += ["## 아직 못 재는 것", "",
          "- 사이트 방문자 수(Cloudflare 분석은 저장소에 안 쌓임), 인스타·텔레그램·네이버 반응 → BK가 볼 때 숫자를 알려 주면 표에 추가.",
          "- Claude 예약 작업은 Actions 에서 못 읽음 → 이 표를 볼 때 Claude 가 예약 작업 목록을 DIRECTION 3장과 대조.", ""]
    return "\n".join(L)


def main(argv: list[str]) -> int:
    today = dt.datetime.now(KST).date()
    yt, search, cost = youtube_groups(), search_groups(), api_cost()
    tips = suggest(yt)
    text = render(today, yt, search, cost, tips)
    if "--dry" in argv:
        print(text)
        return 0
    OUT.write_text(text, encoding="utf-8")
    from .api_check import send
    send(f"📊 주간 성과판 {today:%m/%d}\n" + ("\n".join(f"- {t}" for t in tips[:5]) or "- 눈에 띄는 형식 없음")
         + "\nhttps://github.com/ckqudrnjs-beep/affiliate-pipeline/blob/main/docs/SCOREBOARD.md")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
