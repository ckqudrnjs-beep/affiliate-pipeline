"""IndexNow 알림 — 5락실(2026-11-22) + 돈줍는삼촌 don3chon(2026-11-28, BK '사이트 색인작업').

새로 생기거나 바뀐 페이지 주소를 네이버(서치어드바이저)·빙에 바로 알린다.
네이버가 새 사이트를 드물게 찾아와서, 기다리지 않고 알려 주려는 것. (구글은 IndexNow 를 안 받는다 → 사이트맵으로.)

- 키 파일(공개용 확인 파일, 비밀 아님. 내용 = 키): 5락실 playground/static/<KEY>.txt, 삼촌 static/<KEY>.txt
- 알릴 주소 = (지난번에 없던 사이트맵 주소) + (사이트맵 lastmod 가 바뀐 주소) + (이번 push 에서 바뀐 게임·공략 파일의 주소)
  단, 실제 사이트맵에 있는 주소만 보낸다(noindex 페이지는 사이트맵에 없으니 절대 안 보냄).
- 사용: python scripts/indexnow.py [--site 5raksil|don3chon] [--all] [--seen 파일] [--changed 파일목록...] [--dry]
"""
import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

SITES = {
    "5raksil": {"host": "5raksil.com", "key": "51a65e446919aab35804afef44b9a0ad", "keydir": "playground/static"},
    "don3chon": {"host": "don3chon.com", "key": "f40c4c1b22d79084d83b08a7cde6d2f6", "keydir": "static",
                 # 계산기 lastmod 는 새 글이 올 때마다 같이 바뀐다(내용은 그대로) → 날짜만 바뀐 건 다시 안 보냄
                 "lastmod_ignore": ("/calc/",)},
}
HOST = SITES["5raksil"]["host"]
BASE = f"https://{HOST}"
KEY = SITES["5raksil"]["key"]
ENDPOINTS = ["https://searchadvisor.naver.com/indexnow", "https://api.indexnow.org/indexnow"]
UA = "Mozilla/5.0 (compatible; 5raksil-indexnow/1.0)"


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def sitemap_urls(xml: str) -> list[str]:
    return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)


def sitemap_entries(xml: str) -> dict[str, str]:
    """주소 → lastmod(없으면 빈 칸)."""
    out = {}
    for blk in re.findall(r"<url>(.*?)</url>", xml, re.S):
        m = re.search(r"<loc>\s*([^<\s]+)\s*</loc>", blk)
        if m:
            d = re.search(r"<lastmod>\s*([^<\s]+)\s*</lastmod>", blk)
            out[m.group(1)] = d.group(1) if d else ""
    return out


def read_seen(text: str) -> dict[str, str]:
    """지난번 목록. 옛 형식(주소만 한 줄)은 lastmod 를 모름 → None(바뀐 걸로 치지 않음)."""
    seen = {}
    for line in text.splitlines():
        parts = line.split()
        if parts:
            seen[parts[0]] = parts[1] if len(parts) > 1 else None
    return seen


def write_seen(live: dict[str, str]) -> str:
    return "".join(f"{u} {d}\n" if d else f"{u}\n" for u, d in live.items())


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


def pick(live, seen, changed: set[str], all_: bool, lastmod_ignore: tuple = ()) -> list[str]:
    """live: 주소 목록 또는 {주소: lastmod}. seen: 주소 집합 또는 {주소: lastmod|None}."""
    if all_:
        return list(live)
    lm = live if isinstance(live, dict) else {}
    old = seen if isinstance(seen, dict) else {}

    def moved(u):
        if any(x in u for x in lastmod_ignore):
            return False
        return bool(lm.get(u)) and old.get(u) is not None and old[u] != lm[u]
    return [u for u in live if u not in seen or u in changed or moved(u)]


def submit(urls: list[str], dry: bool, host: str = HOST, key: str = KEY) -> bool:
    body = json.dumps({"host": host, "key": key, "keyLocation": f"https://{host}/{key}.txt", "urlList": urls}).encode()
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
    ap.add_argument("--site", default="5raksil", choices=sorted(SITES))
    ap.add_argument("--all", action="store_true", help="사이트맵 전체를 보낸다(처음 한 번·손으로 실행할 때)")
    ap.add_argument("--seen", default="", help="지난번 사이트맵 주소 목록 파일(없으면 전체)")
    ap.add_argument("--changed", nargs="*", default=[], help="이번 push 에서 바뀐 파일 경로")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    site = SITES[a.site]
    host, key = site["host"], site["key"]
    base = f"https://{host}"

    # 배포가 끝나 키 파일이 보일 때까지 기다린다(Cloudflare Pages 빌드 2~4분)
    for i in range(20):
        try:
            if get(f"{base}/{key}.txt").strip() == key:
                break
        except Exception:
            pass
        time.sleep(30)
    else:
        print("키 파일이 사이트에 안 보여요. 배포가 끝났는지 확인하세요.")
        return 1

    live = sitemap_entries(get(f"{base}/sitemap.xml"))
    seen_p = Path(a.seen) if a.seen else None
    seen = read_seen(seen_p.read_text()) if seen_p and seen_p.exists() else {}
    changed = urls_for_changed(a.changed) if a.site == "5raksil" else set()
    urls = pick(live, seen, changed, a.all or not seen, site.get("lastmod_ignore", ()))
    if seen_p:
        seen_p.write_text(write_seen(live))
    if not urls:
        print("새로 알릴 주소 없음")
        return 0
    print(f"알릴 주소 {len(urls)}개:\n" + "\n".join(urls[:20]))
    return 0 if submit(urls[:10000], a.dry, host, key) else 1


if __name__ == "__main__":
    sys.exit(main())
