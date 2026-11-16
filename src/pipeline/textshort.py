"""글자형 정보 Shorts (HyperFrames) — 2026-11-16 BK.

"문자로만 전달돼도 될 만큼, 보고 나면 만족감을 주는 정보에만" → docs/SHORTS_GROWTH.md 의 사전 체크 4개를
모두 통과할 때만 만든다. 숫자는 주간 리포트(data/report/<날짜>.json)에서만 가져온다. Claude 토큰 없음.

시험 방식: 격주 월요일(ISO 주차 짝수)에, 그날 공개될 월요일 시세 대본(data/episodes/<날짜>-prices.json)이
아직 업로드 전이면 이 영상으로 바꾼다. 체크에 하나라도 걸리면 아무것도 바꾸지 않는다(기존 대본 그대로).

  PYTHONPATH=src python -m pipeline.textshort check [날짜]   # 체크 결과만
  PYTHONPATH=src python -m pipeline.textshort make [날짜] [--force]  # 체크 통과 시 대본+영상 교체
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

KST = dt.timezone(dt.timedelta(hours=9))
REPORT_DIR = pathlib.Path("data/report")
EP_DIR = pathlib.Path("data/episodes")
MEDIA = pathlib.Path("media/youtube")
TEMPLATE_DIR = pathlib.Path("tools/hyperframes/price_short")
HF_VERSION = "0.9.56"
FONTS = ["NanumSquareB.ttf", "NanumBarunGothicBold.ttf"]
FONT_SRC = pathlib.Path("/usr/share/fonts/truetype/nanum")
SURPRISE = 30.0  # ② 한 달 ±30% 이상
ORDINAL = {1: "첫째", 2: "둘째", 3: "셋째", 4: "넷째", 5: "다섯째"}


def is_trial_week(d: dt.date) -> bool:
    """격주 교대: 월요일이고 ISO 주차가 짝수."""
    return d.weekday() == 0 and d.isocalendar()[1] % 2 == 0


def load_report(d: dt.date) -> dict | None:
    p = REPORT_DIR / f"{d.isoformat()}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def checks(rep: dict) -> tuple[bool, list[str], dict]:
    """사전 체크 4개. (통과?, 실패 이유, 고른 숫자)."""
    g = rep.get("grocery") or {}
    down = (g.get("down") or [None])[0]
    up = (g.get("up") or [None])[0]
    fails = []
    # ① 구체적 숫자: 리포트에 실제 가격·변화율이 있다
    if not (down and up and down.get("price") and up.get("price")
            and isinstance(down.get("m"), (int, float)) and isinstance(up.get("m"), (int, float))):
        fails.append("① 장바구니 숫자 없음")
        return False, fails, {}
    # ② 의외성: 내린 1위·오른 1위 모두 한 달 ±30% 이상
    if down["m"] > -SURPRISE or up["m"] < SURPRISE:
        fails.append(f"② 변화 작음 (내림 {down['m']}%, 오름 {up['m']}%, 기준 ±{SURPRISE:.0f}%)")
    # ③ 바로 써먹기: 할 행동이 한 줄로 나온다 (내린 건 이번 주에 담기, 오른 건 한 주 쉬기)
    action = f"{short_name(down['name'])}는 이번 주에, {short_name(up['name'])}는 한 주 쉬기"
    if len(action) > 40:
        fails.append("③ 행동 한 줄이 너무 김")
    # ④ 글자만으로 완결: 이 템플릿은 숫자 카드뿐(소리·사람 없음) → 품목 이름이 화면에 들어가는지만 본다
    if max(len(item_label(down)), len(item_label(up))) > 12:
        fails.append("④ 품목 이름이 화면에 안 들어감")
    return not fails, fails, {"down": down, "up": up, "action": action}


def short_name(name: str) -> str:
    return re.sub(r"\(.*?\)", "", name).strip()


def item_label(x: dict) -> str:
    return f"{x['name']} {x.get('unit', '')}".strip()


def week_tag(d: dt.date) -> str:
    return f"{d.month}월 {ORDINAL[(d.day - 1) // 7 + 1]} 주 장바구니"


def fill(rep: dict, picks: dict, d: dt.date) -> str:
    down, up = picks["down"], picks["up"]
    dm, um = abs(down["m"]), up["m"]
    hook = "한 달 새<br/>거의 반값 된<br/>품목 있어요" if dm >= 40 else f"한 달 새<br/>{dm:.0f}% 싸진<br/>품목 있어요"
    e = html.escape
    vals = {
        "TAG": e(week_tag(d)), "HOOK": hook,
        "DOWN_ITEM": e(item_label(down)), "DOWN_PCT": f"-{dm:.0f}%",
        "DOWN_SUB": e(f"지금 {down['price']:,}원 · 이번 주에 담기"),
        "UP_ITEM": e(item_label(up)), "UP_PCT": f"+{um:.0f}%",
        "UP_SUB": e(f"지금 {up['price']:,}원 · 한 주 쉬어 가기"),
        "CTA": f"{int(rep['grocery'].get('count') or 0)}개 품목<br/>이번 주 시세 전체는" if rep["grocery"].get("count")
               else "이번 주 시세 전체는",
        # 막대: 내린 것은 100 → (100-dm)%, 오른 것은 100/(100+um) → 100%
        "DOWN_SCALE": f"{max(0.05, 1 - dm / 100):.2f}", "UP_SCALE": f"{100 / (100 + um):.2f}",
        "ITEM_PX": "96" if max(len(item_label(down)), len(item_label(up))) <= 9 else "78",
    }
    s = (TEMPLATE_DIR / "template.html").read_text(encoding="utf-8")
    for k, v in vals.items():
        s = s.replace("{{" + k + "}}", v)
    assert "{{" not in s, "템플릿 빈칸 남음"
    return s


def spec_for(rep: dict, picks: dict, d: dt.date) -> dict:
    down, up = picks["down"], picks["up"]
    dn, un = short_name(down["name"]), short_name(up["name"])
    title = f"{dn} {down['m']:.0f}%, {un} +{up['m']:.0f}%… 이번 주 장보기 뭐가 이득?"
    return {
        "date": d.isoformat(), "kind": "short", "format": "prices", "format_name": "이번 주 생활 시세 (글자형)",
        "engine": "hyperframes", "slug": f"ep-{d.isoformat()}-prices",
        "title": title,
        "description": (f"한 달 전과 비교한 이번 주 장바구니 시세예요. {item_label(down)} {down['price']:,}원(한 달 {down['m']}%), "
                        f"{item_label(up)} {up['price']:,}원(한 달 +{up['m']}%). 출처: KAMIS 농산물 유통정보, "
                        f"{d.isoformat()} 주간 생활물가 리포트."),
        "takeaway": picks["action"],
        "site_path": "report.html",
        "scenes": [],
    }


def render(index_html: str, out: pathlib.Path) -> None:
    with tempfile.TemporaryDirectory() as tmpd:
        proj = pathlib.Path(tmpd) / "price_short"
        shutil.copytree(TEMPLATE_DIR, proj, ignore=shutil.ignore_patterns("renders", ".hyperframes", "assets", "index.html", "template.html", "README.md"))
        (proj / "index.html").write_text(index_html, encoding="utf-8")
        fonts = proj / "assets" / "fonts"
        fonts.mkdir(parents=True)
        for f in FONTS:
            shutil.copy(FONT_SRC / f, fonts / f)
        env = dict(os.environ, HYPERFRAMES_NO_TELEMETRY="1", DO_NOT_TRACK="1")
        npx = ["npx", "--yes", f"hyperframes@{HF_VERSION}"]
        subprocess.run(npx + ["check"], cwd=proj, env=env, check=True)
        subprocess.run(npx + ["render", "-o", "renders/out.mp4"], cwd=proj, env=env, check=True)
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(proj / "renders" / "out.mp4", out)


def uploaded_slugs() -> set[str]:
    p = pathlib.Path("data/youtube/uploaded.json")
    return set(json.loads(p.read_text(encoding="utf-8"))) if p.exists() else set()


def make(d: dt.date, force: bool = False) -> str:
    if not force and not is_trial_week(d):
        return f"{d} 시험 주 아님 (격주 월요일만)"
    rep = load_report(d)
    if not rep:
        return f"{d} 리포트 없음"
    ok, fails, picks = checks(rep)
    if not ok:
        return "체크 실패 → 기존 대본 그대로: " + "; ".join(fails)
    ep = EP_DIR / f"{d.isoformat()}-prices.json"
    spec = spec_for(rep, picks, d)
    if spec["slug"] in uploaded_slugs():
        return f"{spec['slug']} 이미 업로드됨"
    others = [p for p in EP_DIR.glob(f"{d.isoformat()}-*.json") if not p.name.endswith(".meta.json") and p != ep]
    if not ep.exists() and others:
        return f"{d} 자리에 다른 형식 대본 있음 ({others[0].name}) → 건드리지 않음"
    if ep.exists():
        old = json.loads(ep.read_text(encoding="utf-8"))
        if old.get("engine") == "hyperframes":
            return f"{ep} 이미 글자형"
        if old.get("slug") and old["slug"] != spec["slug"]:
            spec["slug"] = old["slug"]
    out = MEDIA / f"{spec['slug']}.mp4"
    render(fill(rep, picks, d), out)
    ep.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    meta = {"slug": spec["slug"], "seconds": 12.0, "chapters": [], "engine": "hyperframes"}
    ep.with_suffix(".meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return f"완성: {out} / {ep}"


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "check"
    rest = [a for a in argv[1:] if not a.startswith("--")]
    d = dt.date.fromisoformat(rest[0]) if rest else dt.datetime.now(KST).date()
    if cmd == "check":
        rep = load_report(d)
        if not rep:
            print(f"{d} 리포트 없음")
            return 0
        ok, fails, picks = checks(rep)
        print(json.dumps({"date": d.isoformat(), "trial_week": is_trial_week(d), "pass": ok, "fails": fails,
                          "action": picks.get("action")}, ensure_ascii=False))
    elif cmd == "make":
        print(make(d, force="--force" in argv))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
