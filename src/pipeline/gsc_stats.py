"""서치콘솔 읽기 전용 수집 (2026-11-16, BK 데스크톱 앱 환경에서 서치콘솔 MCP가 안 붙어 대체).

매일 GitHub Actions 에서 등록된 사이트마다 최근 28일 클릭·노출·평균 순위, 상위 검색어·페이지, 사이트맵 제출/색인 수를
data/seo/gsc.json 에 날짜별로 쌓고 docs/SEO_WEEKLY.md 표를 새로 만든다. 사이트·사이트맵은 바꾸지 않는다.

인증: 유튜브 업로드와 같은 OAuth 앱(YT_CLIENT_ID / YT_CLIENT_SECRET) + webmasters.readonly 갱신 토큰(GSC_REFRESH_TOKEN).
발급: docs/SEO_SETUP.md. 토큰이 없으면 아무것도 하지 않고 끝난다.
    python -m pipeline.gsc_stats
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

OUT = pathlib.Path("data/seo/gsc.json")
WEEKLY = pathlib.Path("docs/SEO_WEEKLY.md")
API = "https://www.googleapis.com/webmasters/v3"
LAG_DAYS = 3  # 서치콘솔 데이터는 2~3일 늦게 확정된다
OURS = ("don3chon.com", "5raksil.com")  # 같은 계정의 다른 사이트는 모으지 않는다


def ours(site: str) -> bool:
    host = site.split(":", 1)[1] if site.startswith("sc-domain:") else site.split("//", 1)[-1].split("/")[0]
    return host.removeprefix("www.") in OURS


def _call(token: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method="POST" if body is not None else "GET",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"{}")


def why(e: Exception) -> str:
    code = getattr(e, "code", "")
    try:
        js = json.loads(e.read())  # type: ignore[attr-defined]
        err = js.get("error")
        msg = err.get("message", "") if isinstance(err, dict) else f"{err} {js.get('error_description', '')}"
    except Exception:
        msg = type(e).__name__
    return f"{code} {msg}".strip()[:200]


def summarize_rows(rows: list[dict]) -> list[dict]:
    return [{"key": r["keys"][0], "clicks": int(r.get("clicks", 0)), "impressions": int(r.get("impressions", 0)),
             "position": round(float(r.get("position", 0)), 1)} for r in rows or []]


def site_report(token: str, site: str, start: str, end: str) -> dict:
    enc = "/sites/" + urllib.parse.quote(site, safe="")
    q = {"startDate": start, "endDate": end}
    total = _call(token, enc + "/searchAnalytics/query", q).get("rows", [{}])
    t = total[0] if total else {}
    out = {"clicks": int(t.get("clicks", 0)), "impressions": int(t.get("impressions", 0)),
           "position": round(float(t.get("position", 0)), 1)}
    for dim in ("query", "page"):
        rows = _call(token, enc + "/searchAnalytics/query", {**q, "dimensions": [dim], "rowLimit": 10}).get("rows", [])
        out["top_" + dim] = summarize_rows(rows)
    maps = _call(token, enc + "/sitemaps").get("sitemap", [])
    out["sitemaps"] = [{"path": m.get("path", ""), "last_read": m.get("lastDownloaded", "")[:10],
                        "errors": int(m.get("errors", 0) or 0),
                        "submitted": sum(int(c.get("submitted", 0) or 0) for c in m.get("contents", [])),
                        "indexed": sum(int(c.get("indexed", 0) or 0) for c in m.get("contents", []))} for m in maps]
    return out


def weekly_md(day: str, snap: dict, start: str, end: str) -> str:
    lines = [f"# 서치콘솔 현황 ({day} 수집, {start}~{end})", "",
             "자동 생성: python -m pipeline.gsc_stats (읽기 전용). 데이터는 2~3일 늦게 확정된다.", "",
             "색인된 페이지 수는 API가 주지 않는다(사이트맵 색인 값은 항상 0) → 서치콘솔 웹 '페이지' 보고서에서 확인.", "",
             "| 사이트 | 클릭 | 노출 | 평균 순위 | 사이트맵 제출 URL |", "|---|---|---|---|---|"]
    for site, r in snap.items():
        sub = sum(m["submitted"] for m in r["sitemaps"])
        lines.append(f"| {site} | {r['clicks']:,} | {r['impressions']:,} | {r['position']} | {sub:,} |")
    for site, r in snap.items():
        lines += ["", f"## {site} 상위 검색어", "| 검색어 | 클릭 | 노출 | 순위 |", "|---|---|---|---|"]
        lines += [f"| {x['key']} | {x['clicks']} | {x['impressions']} | {x['position']} |" for x in r["top_query"]] or ["| (없음) | | | |"]
        lines += ["", f"## {site} 상위 페이지", "| 페이지 | 클릭 | 노출 | 순위 |", "|---|---|---|---|"]
        lines += [f"| {x['key']} | {x['clicks']} | {x['impressions']} | {x['position']} |" for x in r["top_page"]] or ["| (없음) | | | |"]
    return "\n".join(lines) + "\n"


def main(now: dt.datetime | None = None) -> int:
    cid, sec, rt = (os.environ.get(k, "").strip() for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "GSC_REFRESH_TOKEN"))
    if not (cid and sec and rt):
        print("GSC_REFRESH_TOKEN 없음 → 건너뜀 (docs/SEO_SETUP.md)")
        return 0
    now = now or dt.datetime.now(KST)
    end_d = now.date() - dt.timedelta(days=LAG_DAYS)
    start, end = (end_d - dt.timedelta(days=27)).isoformat(), end_d.isoformat()
    step = "토큰 교환"
    try:
        tok = access_token(cid, sec, rt)
        step = "사이트 목록"
        sites = [s["siteUrl"] for s in _call(tok, "/sites").get("siteEntry", [])
                 if s.get("permissionLevel") != "siteUnverifiedUser" and ours(s["siteUrl"])]
    except Exception as e:
        print(f"서치콘솔 읽기 실패 [{step}] {why(e)}")
        return 0
    print("사이트:", ", ".join(sites) or "(없음: 이 구글 계정에 등록된 사이트가 없음)")
    snap = {}
    for site in sites:
        try:
            snap[site] = site_report(tok, site, start, end)
            r = snap[site]
            print(f"{site}: 클릭 {r['clicks']} 노출 {r['impressions']} 사이트맵 {len(r['sitemaps'])}개")
        except Exception as e:
            print(f"{site}: 실패 {why(e)}")
    if not snap:
        return 0
    day = now.date().isoformat()
    data = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    data[day] = snap
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    WEEKLY.write_text(weekly_md(day, snap, start, end), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
