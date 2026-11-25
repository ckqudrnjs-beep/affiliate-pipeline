"""깨진 링크 주간 점검 (BK 11/25 오픈소스 검토 1번: lychee, MIT/Apache-2.0).

.github/workflows/linkcheck.yml 이 매주 월 11:10 KST 에 실행한다. 사이트는 고치지 않고 검사만 한다.
- 돈삼촌: 저장소로 사이트를 그대로 빌드(_site)해서 모든 HTML 의 링크를 검사한다.
  안쪽 링크(다른 글·상품 페이지)는 파일로, 바깥 링크(알리·쿠팡·출처 등)는 실제로 접속해서 본다.
  사이트맵에서 빠진 상품 페이지(/p/, noindex)도 같이 본다.
- 5락실: 저장소가 따로라 실제 사이트의 sitemap.xml 에 있는 페이지를 접속해서 검사한다.
결과는 BK 개인 텔레그램으로 한 번 보낸다(이상 없으면 한 줄). 텔레그램 설정이 없으면 화면 출력만.

403·429(봇 차단)는 '확인 불가'로 보고 깨짐에 넣지 않는다. 응답 없음(시간 초과 등)은 숫자만 알린다.
알리 상품이 내려가도 '상품 없음' 페이지가 200 으로 뜨면 이 점검으로는 못 잡는다 (상품 점검은 기존 작업 몫).

사용: python scripts/link_check.py <lychee 실행 파일> <돈삼촌 빌드 폴더>
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

from cf_usage_alert import http, telegram

DON = "https://don3chon.com"
RAKSIL = "https://5raksil.com"
EXCLUDE = [  # 광고·통계·글꼴 연결, 메일·전화 → 검사할 필요 없음
    r"googlesyndication\.com", r"googletagmanager\.com", r"google-analytics\.com", r"doubleclick\.net",
    r"fonts\.(googleapis|gstatic)\.com", r"cloudflareinsights\.com", r"adtrafficquality\.google",
    r"^mailto:", r"^tel:", r"^javascript:", r"localhost",
]
BLOCKED = {403, 429, 999}  # 봇 차단 → 확인 불가 (깨짐 아님)
MAX_PAGES = 400  # 5락실 사이트맵에서 볼 최대 페이지 수
SHOW = 15  # 텔레그램에 적을 최대 줄 수


def lychee_args(binary: str, out: str) -> list[str]:
    args = [binary, "--no-progress", "--format", "json", "--output", out, "--max-concurrency", "8",
            "--timeout", "20", "--max-retries", "2", "--accept", "200..=299,403,429,999",
            "--user-agent", "Mozilla/5.0 (compatible; site-link-check)"]
    for e in EXCLUDE:
        args += ["--exclude", e]
    return args


def run_lychee(args: list[str]) -> dict:
    out = args[args.index("--output") + 1]
    p = subprocess.run(args, capture_output=True, text=True)  # 깨진 링크가 있으면 0 이 아닌 값으로 끝난다(정상)
    if p.returncode not in (0, 2):
        print(p.stderr[-2000:])
    try:
        return json.loads(pathlib.Path(out).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def sitemap_urls(base: str) -> list[str]:
    st, txt = http(f"{base}/sitemap.xml")
    if st != 200:
        print(f"{base}/sitemap.xml → {st}")
        return []
    return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", txt)[:MAX_PAGES]


def status_code(e: dict) -> int | None:
    s = e.get("status")
    if isinstance(s, dict):
        if isinstance(s.get("code"), int):
            return s["code"]
        m = re.match(r"\s*(\d{3})\b", str(s.get("text", "")))
        return int(m.group(1)) if m else None
    m = re.match(r"\s*(\d{3})\b", str(s or ""))
    return int(m.group(1)) if m else None


def page_url(source: str, root: str, base: str) -> str:
    """lychee 가 적은 출처(빌드 폴더의 파일 또는 주소)를 사람이 열 수 있는 사이트 주소로."""
    if source.startswith("http"):
        return source
    rel = source.replace("file://", "")
    if root and rel.startswith(root):
        rel = rel[len(root):]
    rel = rel.lstrip("/")
    rel = re.sub(r"(^|/)index\.html$", r"\1", rel)
    rel = re.sub(r"\.html$", "", rel)
    return f"{base}/{rel}"


def link_url(url: str, root: str, base: str) -> str:
    if url.startswith("file://"):
        return page_url(url, root, base)
    return url


def summarize(report: dict, root: str, base: str) -> tuple[list[tuple[str, str, str]], int, int]:
    """→ ([(깨진 링크, 이유, 처음 나온 페이지)], 응답 없음 수, 검사한 링크 수)."""
    broken: dict[str, tuple[str, str]] = {}
    slow = set()
    emap = report.get("error_map") or report.get("fail_map") or {}
    for src, errs in emap.items():
        for e in errs or []:
            url = e.get("url", "")
            code = status_code(e)
            text = str((e.get("status") or {}).get("text", "") if isinstance(e.get("status"), dict) else e.get("status", ""))
            if code in BLOCKED:
                continue
            if url.startswith("file://") or (code and 400 <= code < 600):
                reason = "페이지 없음" if url.startswith("file://") else str(code)
                broken.setdefault(link_url(url, root, base), (reason, page_url(src, root, base)))
            else:
                slow.add(url)
                print("응답 없음:", url, text[:120])
    return [(u, r, p) for u, (r, p) in sorted(broken.items())], len(slow), int(report.get("unique") or report.get("total") or 0)


def message(results: list[tuple[str, list, int, int]]) -> str:
    total = sum(len(b) for _, b, _, _ in results)
    lines = [f"🔗 주간 링크 점검: {'이상 없음' if not total else f'깨진 링크 {total}개'}"]
    for name, broken, slow, n in results:
        lines.append(f"• {name}: 링크 {n}개 검사, 깨짐 {len(broken)}" + (f", 응답 없음 {slow}" if slow else ""))
        for u, r, p in broken[:SHOW]:
            lines.append(f"  - [{r}] {u}\n    ← {p}")
        if len(broken) > SHOW:
            lines.append(f"  … 외 {len(broken) - SHOW}개 (Actions 기록에 전부 있음)")
    return "\n".join(lines)


def main() -> int:
    binary, site_dir = sys.argv[1], str(pathlib.Path(sys.argv[2]).resolve())
    tmp = tempfile.mkdtemp()
    results = []
    # 1) 돈삼촌 빌드 결과
    out = f"{tmp}/don.json"
    args = lychee_args(binary, out) + ["--root-dir", site_dir, "--fallback-extensions", "html", "--index-files", "index.html,.",
                                       f"{site_dir}/**/*.html"]
    rep = run_lychee(args)
    b, s, n = summarize(rep, site_dir, DON)
    results.append(("돈삼촌", b, s, n))
    # 2) 5락실 실제 사이트
    pages = sitemap_urls(RAKSIL)
    if pages:
        out = f"{tmp}/raksil.json"
        rep = run_lychee(lychee_args(binary, out) + pages)
        b, s, n = summarize(rep, "", RAKSIL)
        results.append(("5락실", b, s, n))
    else:
        results.append(("5락실", [("사이트맵을 못 읽었어요", "-", f"{RAKSIL}/sitemap.xml")], 0, 0))
    msg = message(results)
    print(msg)
    for name, broken, _, _ in results:
        for u, r, p in broken:
            print(f"{name}\t{r}\t{u}\t{p}")
    tok, chat = os.environ.get("TELEGRAM_BOT_TOKEN", ""), os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")
    if tok and chat:
        telegram(tok, chat, msg[:3900])
    else:
        print("텔레그램 설정 없음: 화면 출력만")
    return 0


if __name__ == "__main__":
    sys.exit(main())
