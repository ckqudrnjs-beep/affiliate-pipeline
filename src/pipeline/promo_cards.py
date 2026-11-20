"""홍보 이미지 3종 (2026-11-20 BK "가자"). 기준: docs/DIRECTION.md, 세부: docs/PROMO_DESIGN.md.

어두운 그라데이션 배경 + 두 줄 큰 제목(한 단어만 *기울임 강조*) + 실제 화면을 넣은 폰 목업. 글꼴 주아.
  raksil   5락실 쇼츠 썸네일(세로 1080x1920, 게임마다) + 가로 포스터(1280x720, 게임 3개)
  calc     돈삼촌 계산기 카드(인스타 1080x1350, 큰 숫자 2개 + 결과 화면)
숫자는 사이트 계산기 공식으로만 계산한다(지어내지 않음). 판매·특가·제휴 문구는 넣지 않는다(검사에서 막음).
그리는 일은 scripts/promo_cards.js, 게임 폰 화면은 scripts/game_posters.js(POSTER_PHONE=1)가 한다.

사용(저장소 루트, PYTHONPATH=src):
  python -m pipeline.promo_cards raksil bag hansang pusher --out OUT   # 게임 화면을 새로 찍어서
  python -m pipeline.promo_cards raksil bag --shots DIR --out OUT       # 이미 찍은 <slug>-phone.png 로
  python -m pipeline.promo_cards calc --name 전기난로 --watts 1000 --hours 4 --out OUT
  python -m pipeline.promo_cards new                                    # 새 게임만 세로 썸네일(media/promo/raksil/)
자동: Actions posters.yml 이 main 에 게임이 들어오면 `new` 를 돌려 커밋 → drive-backup 이 드라이브 "홍보이미지"로 올림.
옛 게임(PROMO_FROM 전에 추가된 게임)은 만들지 않는다 (BK 11/20 "이전 콘텐츠는 따로 만들 필요 없음").
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PG = ROOT / "playground"
RAKSIL_URL = "5raksil.com"
DON_URL = "don3chon.com"
PROMO_DIR = ROOT / "media" / "promo" / "raksil"
PROMO_FROM = "2026-11-20"  # 이 날짜(meta.json added) 이후 추가된 게임만 자동으로 만든다

# 홍보 이미지에 들어가면 안 되는 말(DIRECTION 0-5: 판매·특가·제휴 문구 금지, 쇼핑몰 이름 금지)
BANNED = re.compile(r"판매|특가|제휴|할인|최저가|구매|쿠팡|알리|테무|광고|협찬|공구")


def bill(kwh: float) -> int:
    """calcs.COMMON_JS 의 bill() 과 같은 식(한전 주택용 저압 기타계절 근사). test_promo_cards 가 JS 와 같은지 본다."""
    kwh = max(0.0, kwh)
    e, prev, base = 0.0, 0, 910
    for lim, b, r in ((200, 910, 120.0), (400, 1600, 214.6), (1e9, 7300, 307.3)):
        if kwh > prev:
            base = b
            e += (min(kwh, lim) - prev) * r
        prev = lim
    sub = base + e + kwh * 9 + kwh * 5
    return math.floor((sub + math.floor(sub * 0.1 / 10) * 10 + math.floor(sub * 0.027 / 10) * 10) / 10) * 10


def won(n: float) -> str:
    return f"{math.floor(n + 0.5):,}원"  # JS Math.round 와 같게(.5 올림)


def calc_card(name: str, watts: int, hours: float, days: int = 30, base_kwh: int = 300, out: str = "calc.jpg") -> dict:
    """가전 하나를 더 쓸 때 한 달 전기요금이 얼마 느는지(사이트 /calc/electric 과 같은 계산)."""
    add = watts * hours * days / 1000
    before, after = bill(base_kwh), bill(base_kwh + add)
    diff = after - before
    unit = diff / add if add else 0
    ratio = unit / 120.0
    h = f"{hours:g}"
    return {
        "kind": "calc", "out": out,
        "kick": "돈삼촌 생활 계산기",
        "t1": f"{name} 하나,", "t2": "한 달 *얼마* 더?",
        "stats": [
            {"n": "+" + won(diff), "l": ["한 달 늘어나는 전기요금"]},
            {"n": won(unit), "l": [f"{name} 전기 1kWh 실제 단가", f"(기본 구간 120원의 약 {ratio:.1f}배)"]},
        ],
        "screen": {
            "h": ["이 가전, 한 달", "전기요금 얼마 늘까?"],
            "inputs": [["소비전력", f"{watts} W"], ["하루 사용", f"{h} 시간"], ["한 달", f"{days} 일"], ["평소 사용량", f"{base_kwh} kWh"]],
            "rows": [["평소 요금", won(before)], [f"{name} 추가 후", won(after)], ["늘어나는 요금", won(diff)]],
        },
        "note": f"평소 {base_kwh}kWh 집 기준 · 누진제 반영 근사치",
        "url": DON_URL, "cta": "에서 우리 집으로 계산",
    }


def game_meta(slug: str) -> dict:
    return json.loads((PG / "games" / slug / "meta.json").read_text(encoding="utf-8"))


def promo_words(slug: str, meta: dict | None = None) -> tuple[str, str]:
    """가로 포스터 카드 제목 두 줄. meta.json "promo": {"t1": "봉투에", "em": "꽉"} 이 없으면 게임 이름 + '한 판'."""
    m = meta or game_meta(slug)
    p = m.get("promo") or {}
    return p.get("t1") or m["name"], p.get("em") or "한 판"


def raksil_vertical(slug: str, front: str, back: str | None = None, out: str = "v.jpg", t1: str = "한 판이면", t2: str = "*끝.*") -> dict:
    m = game_meta(slug)
    return {"kind": "vertical", "out": out, "kick": f"5락실 · {m['name']}", "t1": t1, "t2": t2,
            "sub": m.get("short", ""), "phones": [front] + ([back] if back else []),
            "foot": "무료 · 설치 없음 ·", "url": RAKSIL_URL}


def raksil_poster(slugs: list[str], imgs: dict[str, str], out: str = "poster.jpg", t1: str = "한 판이면", t2: str = "*끝.*") -> dict:
    cards = []
    for s in slugs[:3]:
        a, b = promo_words(s)
        cards.append({"t1": a, "em": b, "img": imgs[s]})
    return {"kind": "poster", "out": out, "kick": "5락실 미니게임", "t1": t1, "t2": t2,
            "sub": ["설치 없이 폰에서 바로,", "무료 미니게임"], "cards": cards, "url": RAKSIL_URL}


def texts(spec: dict) -> list[str]:
    """그림에 찍히는 글자 전부(파일 경로 제외)."""
    out: list[str] = []

    def walk(v, key=""):
        if key in ("out", "img", "phones"):
            return
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, dict):
            for k, x in v.items():
                walk(x, k)
        elif isinstance(v, list):
            for x in v:
                walk(x, key)
    walk(spec)
    return out


def check(spec: dict) -> list[str]:
    errs = [f"금지 문구: {t}" for t in texts(spec) if BANNED.search(t)]
    for k in ("t1", "t2"):
        if len(spec.get(k, "").replace("*", "")) > 10:
            errs.append(f"제목 {k} 가 10자를 넘어요: {spec[k]}")
    return errs


def render(specs: list[dict]) -> int:
    for s in specs:
        e = check(s)
        if e:
            print(s["out"], "; ".join(e), file=sys.stderr)
            return 2
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(specs, f, ensure_ascii=False)
    return subprocess.run(["node", str(ROOT / "scripts" / "promo_cards.js"), f.name], cwd=ROOT).returncode


def shoot_phones(slugs: list[str], out: pathlib.Path) -> None:
    """게임을 빌드해 띄우고 폰 세로 화면을 찍는다(<out>/<slug>-phone.png)."""
    import os
    spec = importlib.util.spec_from_file_location("posters", PG / "posters.py")
    P = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(P)
    with tempfile.TemporaryDirectory() as tmp:
        site = pathlib.Path(tmp) / "site"
        subprocess.run([sys.executable, str(PG / "build.py"), str(site)], cwd=PG, env=dict(os.environ, PG_NO_STATS="1"), check=True, stdout=subprocess.DEVNULL)
        srv, base = P.serve(site)
        try:
            subprocess.run(["node", str(ROOT / "scripts" / "game_posters.js"), base, str(out), *slugs], cwd=ROOT, env=dict(os.environ, POSTER_PHONE="1"))
        finally:
            srv.shutdown()


def new_games(out: pathlib.Path = PROMO_DIR) -> list[str]:
    """자동으로 썸네일을 만들 게임: PROMO_FROM 이후 추가됐고, 아직 썸네일이 없는 게임."""
    todo = []
    for d in sorted((PG / "games").iterdir()):
        f = d / "meta.json"
        if not f.exists():
            continue
        m = json.loads(f.read_text(encoding="utf-8"))
        if m.get("poster") and str(m.get("added", ""))[:10] >= PROMO_FROM and not (out / f"{d.name}.jpg").exists():
            todo.append(d.name)
    return todo


def make_new(out: pathlib.Path = PROMO_DIR) -> int:
    todo = new_games(out)
    if not todo:
        print("새 게임 홍보 썸네일 없음")
        return 0
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        shots = pathlib.Path(tmp)
        shoot_phones(todo, shots)
        specs = [raksil_vertical(s, str(shots / f"{s}-phone.png"), None, str(out / f"{s}.jpg"))
                 for s in todo if (shots / f"{s}-phone.png").exists()]
        if not specs:
            print("폰 화면을 못 찍었어요:", " ".join(todo), file=sys.stderr)
            return 1
        return render(specs)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="홍보 이미지 3종(5락실 썸네일·포스터, 돈삼촌 계산기 카드)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("raksil")
    r.add_argument("slugs", nargs="+")
    r.add_argument("--shots", help="이미 찍은 <slug>-phone.png 폴더(없으면 새로 찍음)")
    r.add_argument("--out", required=True)
    c = sub.add_parser("calc")
    c.add_argument("--name", required=True)
    c.add_argument("--watts", type=int, required=True)
    c.add_argument("--hours", type=float, required=True)
    c.add_argument("--days", type=int, default=30)
    c.add_argument("--base", type=int, default=300)
    c.add_argument("--out", required=True)
    n = sub.add_parser("new", help="새 게임만 세로 썸네일(자동 작업용)")
    n.add_argument("--out", default=str(PROMO_DIR))
    a = ap.parse_args(argv)
    if a.cmd == "new":
        return make_new(pathlib.Path(a.out))
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    if a.cmd == "calc":
        return render([calc_card(a.name, a.watts, a.hours, a.days, a.base, str(out / f"돈삼촌-계산기-{a.name}.jpg"))])
    shots = pathlib.Path(a.shots) if a.shots else out / "phone"
    if not a.shots:
        shots.mkdir(exist_ok=True)
        shoot_phones(a.slugs, shots)
    imgs = {s: str(shots / f"{s}-phone.png") for s in a.slugs if (shots / f"{s}-phone.png").exists()}
    slugs = [s for s in a.slugs if s in imgs]
    if not slugs:
        print("폰 화면을 하나도 못 찍었어요", file=sys.stderr)
        return 1
    specs = []
    for i, s in enumerate(slugs):
        back = imgs[slugs[(i + 1) % len(slugs)]] if len(slugs) > 1 else None
        specs.append(raksil_vertical(s, imgs[s], back, str(out / f"5락실-썸네일-{s}.jpg")))
    if len(slugs) >= 3:
        specs.append(raksil_poster(slugs, imgs, str(out / "5락실-포스터.jpg")))
    return render(specs)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
