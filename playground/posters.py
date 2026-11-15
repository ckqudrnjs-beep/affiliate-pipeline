"""5락실 게임 포스터 자동 갱신 (2026-11-15 BK: 게임을 고치면 시작 전 포스터도 새 화면으로).

meta.json 에 "poster" 조리법이 있는 게임마다, 게임 원본(본문·스크립트·그림·조리법)의 해시를
static/img/posters.json 에 적어 둔다. 해시가 달라진 게임만 실제 게임 화면을 다시 찍어
  static/img/<slug>-poster.jpg  (1280x720, 게임 시작 전 미리보기)
  static/og/<slug>.jpg          (1200x630, 공유 미리보기)
를 바꾼다. 주소 뒤 ?v=<내용 해시> 는 build.py 가 붙인다(캐시 때문에 옛 그림이 보이지 않게).

사용(저장소 루트 또는 playground 에서):
  python playground/posters.py --check        # 다시 찍어야 할 게임만 출력(바꾸지 않음)
  python playground/posters.py                # 바뀐 게임만 다시 찍기
  python playground/posters.py --all          # 전부 다시 찍기
  python playground/posters.py dodge raid     # 지정한 게임만
필요: Pillow, Node + playwright(크로미움). GitHub Actions posters.yml 이 main 에 게임 변경이 들어오면 자동 실행한다.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import http.server
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import threading

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
GAMES = HERE / "games"
STATIC = HERE / "static"
MANIFEST = STATIC / "img" / "posters.json"
KST = dt.timezone(dt.timedelta(hours=9))


def poster_games() -> dict[str, dict]:
    out = {}
    for d in sorted(GAMES.iterdir()):
        f = d / "meta.json"
        if f.exists():
            m = json.loads(f.read_text(encoding="utf-8"))
            if m.get("poster"):
                out[d.name] = m
    return out


def sources(slug: str) -> list[pathlib.Path]:
    """포스터 모양을 바꿀 수 있는 파일들: 게임 폴더(meta 제외), static/js/<slug>*.js, static/img/<slug>/ 그림."""
    fs = [p for p in (GAMES / slug).rglob("*") if p.is_file() and p.name != "meta.json"]
    fs += [p for p in (STATIC / "js").glob(f"{slug}*.js") if p.stem == slug or p.stem.startswith(slug + "-")]
    art = STATIC / "img" / slug
    if art.is_dir():
        fs += [p for p in art.rglob("*") if p.is_file()]
    return sorted(fs)


def src_hash(slug: str, meta: dict) -> str:
    h = hashlib.sha256(json.dumps(meta["poster"], ensure_ascii=False, sort_keys=True).encode())
    for p in sources(slug):
        h.update(str(p.relative_to(HERE)).encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:16]


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}


def stale(games: dict[str, dict], man: dict) -> list[str]:
    out = []
    for slug, m in games.items():
        if man.get(slug, {}).get("src") != src_hash(slug, m) or not (STATIC / "img" / f"{slug}-poster.jpg").exists():
            out.append(slug)
    return out


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root: pathlib.Path) -> tuple[http.server.ThreadingHTTPServer, str]:
    h = lambda *a, **k: _Quiet(*a, directory=str(root), **k)  # noqa: E731
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def save_images(slug: str, png: pathlib.Path) -> None:
    from PIL import Image

    im = Image.open(png).convert("RGB")
    if im.size != (1280, 720):
        im = im.resize((1280, 720), Image.LANCZOS)
    im.save(STATIC / "img" / f"{slug}-poster.jpg", quality=86, optimize=True, progressive=True)
    # 공유 미리보기 1200x630: 가로 1200 으로 줄인 뒤(675) 위아래를 고르게 잘라 630
    og = im.resize((1200, 675), Image.LANCZOS).crop((0, 22, 1200, 652))
    (STATIC / "og").mkdir(exist_ok=True)
    og.save(STATIC / "og" / f"{slug}.jpg", quality=84, optimize=True, progressive=True)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="5락실 게임 포스터 자동 갱신")
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--all", action="store_true", help="전부 다시 찍기")
    ap.add_argument("--check", action="store_true", help="다시 찍어야 할 게임만 출력")
    ap.add_argument("--base", help="이미 띄운 사이트 주소(없으면 임시로 빌드해서 띄움)")
    a = ap.parse_args(argv)

    games = poster_games()
    man = load_manifest()
    for s in a.slugs:
        if s not in games:
            print(f"{s}: meta.json 에 poster 조리법이 없어요", file=sys.stderr)
            return 2
    todo = a.slugs or (list(games) if a.all else stale(games, man))
    if a.check:
        print(" ".join(todo) if todo else "모든 포스터가 최신이에요")
        return 0
    if not todo:
        print("모든 포스터가 최신이에요")
        return 0
    print("다시 찍기:", " ".join(todo))

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        srv = None
        base = a.base
        if not base:
            site = tmp / "site"
            env = dict(os.environ, PG_NO_STATS="1")
            subprocess.run([sys.executable, str(HERE / "build.py"), str(site)], cwd=HERE, env=env, check=True, stdout=subprocess.DEVNULL)
            srv, base = serve(site)
        shots = tmp / "shots"
        r = subprocess.run(["node", str(ROOT / "scripts" / "game_posters.js"), base, str(shots), *todo], cwd=ROOT)
        if srv:
            srv.shutdown()
        today = dt.datetime.now(KST).strftime("%Y-%m-%d")
        done = []
        for slug in todo:
            png = shots / f"{slug}.png"
            if not png.exists():
                print(f"{slug}: 찍지 못해서 예전 포스터를 그대로 둡니다", file=sys.stderr)
                continue
            save_images(slug, png)
            man[slug] = {"src": src_hash(slug, games[slug]), "at": today}
            done.append(slug)
    MANIFEST.write_text(json.dumps(dict(sorted(man.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("새 포스터:", " ".join(done) or "없음")
    return 0 if r.returncode == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
