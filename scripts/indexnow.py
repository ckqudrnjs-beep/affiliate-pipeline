"""5락실 IndexNow 알림 (2026-11-22, BK).

새로 생기거나 바뀐 페이지 주소를 네이버(서치어드바이저)·빙에 바로 알린다.
네이버가 11월 중순 5페이지만 가져가고 다시 오지 않아서, 기다리지 않고 알려 주려는 것.

- 키 파일: playground/static/<KEY>.txt (공개용 확인 파일, 비밀 아님. 내용 = 키)
- 알릴 주소 = (지난번에 없던 사이트맵 주소) + (이번 push 에서 바뀐 게임·공략 파일의 주소)
  단, 실제 사이트맵에 있는 주소만 보낸다(noindex 페이지는 절대 안 보냄).
- 사용: python scripts/indexnow.py [--all] [--seen 파일] [--changed 파일목록...] [--dry]
"""
import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

HOST = "5raksil.com"
BASE = f"https://{HOST}"
KEY = "51a65e446919aab35804afef44b9a0ad"
ENDPOINTS = ["https://searchadvisor.naver.com/indexnow", "https://api.indexnow.org/indexnow"]
UA = "Mozilla/5.0 (compatible; 5raksil-indexnow/1.0)"


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def sitemap_urls(xml: str) -> list[str]:
    return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)


def urls_for_changed(paths: list[str]) -> set[str]:
    """바뀐 파일 → 그 파일이 만드는 페이지 주소."""
    out = set()
    for p in paths:
        m = re.match(r"playground/guides/([\w-]+)\.md$", p)
        if m:
            out.add(f"{BASE}/guide/{m.group(1)}")
        m = re.match(r"playground/guides/en/([\w-]+)\.md$", p)
        if m:
            out.add(f"{BASE}/en/guide/{m.group(1)}")
        m = re.match(r"playground/games/([\w-]+)/", p)
        if m:
            out.add(f"{BASE}/games/{m.group(1)}")
    return out


def pick(live: list[str], seen: set[str], changed: set[str], all_: bool) -> list[str]:
    if all_:
        return list(live)
    return [u for u in live if u not in seen or u in changed]


def submit(urls: list[str], dry: bool) -> bool:
    body = json.dumps({"host": HOST, "key": KEY, "keyLocation": f"{BASE}/{KEY}.txt", "urlList": urls}).encode()
    ok = False
    for ep in ENDPOINTS:
        if dry:
            print(f"[dry] {ep} ← {len(urls)}개")
            ok = True
            continue
        req = urllib.request.Request(ep, data=body, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                print(f"{ep}: {r.status}")
                ok = ok or r.status in (200, 202)
        except urllib.error.HTTPError as e:
            print(f"{ep}: HTTP {e.code} {e.read()[:200]!r}")
        except Exception as e:  # 한 곳이 안 돼도 다른 곳은 보낸다
            print(f"{ep}: {e}")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="사이트맵 전체를 보낸다(처음 한 번·손으로 실행할 때)")
    ap.add_argument("--seen", default="", help="지난번 사이트맵 주소 목록 파일(없으면 전체)")
    ap.add_argument("--changed", nargs="*", default=[], help="이번 push 에서 바뀐 파일 경로")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    # 배포가 끝나 키 파일이 보일 때까지 기다린다(Cloudflare Pages 빌드 2~4분)
    for i in range(20):
        try:
            if get(f"{BASE}/{KEY}.txt").strip() == KEY:
                break
        except Exception:
            pass
        time.sleep(30)
    else:
        print("키 파일이 사이트에 안 보여요. 배포가 끝났는지 확인하세요.")
        return 1

    live = sitemap_urls(get(f"{BASE}/sitemap.xml"))
    seen_p = Path(a.seen) if a.seen else None
    seen = set(seen_p.read_text().split()) if seen_p and seen_p.exists() else set()
    urls = pick(live, seen, urls_for_changed(a.changed), a.all or not seen)
    if seen_p:
        seen_p.write_text("\n".join(live) + "\n")
    if not urls:
        print("새로 알릴 주소 없음")
        return 0
    print(f"알릴 주소 {len(urls)}개:\n" + "\n".join(urls[:20]))
    return 0 if submit(urls[:10000], a.dry) else 1


if __name__ == "__main__":
    sys.exit(main())
