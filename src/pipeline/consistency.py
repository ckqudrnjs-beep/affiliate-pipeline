"""매일 정합성 점검 (2026-11-20, BK "자동화가 많아질수록 서로 어긋난다").

docs/DIRECTION.md(모든 작업의 기준)와 실제 일정·생성물을 대조해서 어긋난 것만 텔레그램 한 줄로 알린다.
아무것도 고치지 않는다(읽기 전용). 키가 없으면 출력만.

    PYTHONPATH=src python -m pipeline.consistency          # 점검 + 어긋나면 텔레그램
    PYTHONPATH=src python -m pipeline.consistency --dry    # 출력만
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOC = ROOT / "docs/DIRECTION.md"
WF = ROOT / ".github/workflows"
EP = ROOT / "data/episodes"
KST = dt.timezone(dt.timedelta(hours=9))


def today_kst() -> dt.date:
    return dt.datetime.now(KST).date()


def direction_text() -> str:
    return DOC.read_text(encoding="utf-8")


def machine(text: str | None = None) -> dict:
    m = re.search(r"## 6\. 자동 점검용.*?```json\n(.*?)\n```", text or direction_text(), re.S)
    return json.loads(m.group(1)) if m else {}


def scheduled_workflows() -> dict[str, list[str]]:
    """워크플로 이름 → 살아 있는 cron 목록 (주석 처리된 줄은 빼고)."""
    out = {}
    for f in sorted(WF.glob("*.yml")):
        crons = [m.group(1) for m in re.finditer(r'^\s*- cron:\s*"([^"]+)"', f.read_text(encoding="utf-8"), re.M)]
        if crons:
            out[f.stem] = crons
    return out


def check_workflows(d: dict, text: str, scheduled: dict[str, list[str]]) -> list[str]:
    probs = []
    for name, why in d.get("workflows_off", {}).items():
        if name in scheduled:
            probs.append(f"꺼 둔 작업 {name} 예약이 다시 살아 있음 ({why})")
    for name in scheduled:
        if f"`{name}`" not in text:
            probs.append(f"예약 작업 {name} 이 DIRECTION 3장 연결 지도에 없음 (표에 없는 작업)")
    return probs


def uncle_shorts(ep_dir: pathlib.Path = EP) -> list[dict]:
    out = []
    for p in sorted(ep_dir.glob("*.json")):
        if p.name.endswith(".meta.json"):
            continue
        try:
            s = json.loads(p.read_text(encoding="utf-8"))
            date = dt.date.fromisoformat(s["date"])
        except (ValueError, KeyError, json.JSONDecodeError):
            continue
        if s.get("kind", "short") == "short":
            out.append({"file": p.name, "date": date, "format": s.get("format", ""), "product": s.get("product")})
    return out


def check_shorts(d: dict, eps: list[dict], today: dt.date, toon_from: dt.date | None = None) -> list[str]:
    cfg = d.get("shorts_uncle", {})
    every = int(cfg.get("every_days", 0) or 0)
    cap = int(d.get("max_uncle_shorts_per_day", 1))
    future = sorted((e for e in eps if e["date"] >= today), key=lambda e: e["date"])
    probs = []
    by_day: dict[dt.date, list[str]] = {}
    for e in future:
        by_day.setdefault(e["date"], []).append(e["file"])
    for day, files in by_day.items():
        if len(files) > cap:
            probs.append(f"삼촌 쇼츠 {day} 에 {len(files)}편 ({', '.join(files)}) — 하루 {cap}편까지")
    days = sorted(by_day)
    if every:
        for a, b in zip(days, days[1:]):
            if (b - a).days < every:
                probs.append(f"삼촌 쇼츠 간격 {a}→{b} {(b - a).days}일 — 기준은 {every}일에 1편")
    if cfg.get("products") is False:
        for e in future:
            if e["product"]:
                probs.append(f"{e['file']} 에 상품({e['product']}) — 삼촌 쇼츠는 상품 없음")
    if toon_from:
        for e in future:
            if e["date"] >= toon_from and e["format"] != "toon":
                probs.append(f"{e['file']} 형식 {e['format']} — {toon_from} 부터는 toon(캐릭터 영상)만")
    if every and days:
        due = days[-1] + dt.timedelta(days=every)
        if due <= today + dt.timedelta(days=2):
            probs.append(f"삼촌 쇼츠 {due} 공개분 대본이 아직 없음 (07:10 후보·07:40 대본 작업 확인)")
    elif every and not days:
        probs.append("앞으로 공개할 삼촌 쇼츠 대본이 하나도 없음")
    return probs


def check_uploads(d: dict, today: dt.date, path: pathlib.Path = ROOT / "data/youtube/uploaded.json") -> list[str]:
    if not path.exists():
        return []
    want = d.get("shorts_uncle", {}).get("publish_kst")
    probs, per_day = [], {}
    for slug, u in json.loads(path.read_text(encoding="utf-8")).items():
        at = u.get("publish_at")
        if not at:
            continue
        t = dt.datetime.fromisoformat(at).astimezone(KST)
        if t.date() < today:
            continue
        per_day.setdefault(t.date(), []).append(slug)
        if want and t.strftime("%H:%M") != want:
            probs.append(f"업로드 {slug} 공개 시각 {t:%m/%d %H:%M} — 기준 {want}")
    for day, slugs in per_day.items():
        if len(slugs) > int(d.get("max_uncle_shorts_per_day", 1)):
            probs.append(f"{day} 유튜브 예약 {len(slugs)}편 ({', '.join(slugs)})")
    return probs


def check_docs() -> list[str]:
    probs = []
    pointer = ROOT / "docs/AGENTS.md"
    if pointer.exists() and "## 0." in pointer.read_text(encoding="utf-8"):
        probs.append("docs/AGENTS.md 에 지침 내용이 다시 생김 — 원본은 루트 AGENTS.md 하나")
    if "docs/DIRECTION.md" not in (ROOT / "AGENTS.md").read_text(encoding="utf-8"):
        probs.append("루트 AGENTS.md 가 DIRECTION.md 를 가리키지 않음")
    return probs


def run(today: dt.date | None = None) -> list[str]:
    today = today or today_kst()
    text = direction_text()
    d = machine(text)
    if not d:
        return ["DIRECTION.md 6장 점검용 JSON 을 읽지 못함"]
    try:
        from .episodes import TOON_FROM as toon_from
    except Exception:  # noqa: BLE001 - 없으면 그 점검만 건너뜀
        toon_from = None
    return (check_workflows(d, text, scheduled_workflows()) + check_shorts(d, uncle_shorts(), today, toon_from)
            + check_uploads(d, today) + check_docs())


def main(argv: list[str]) -> int:
    probs = run()
    if not probs:
        print("정합성 점검: 어긋난 곳 없음")
        return 0
    msg = f"🧭 정합성 점검 {today_kst():%m/%d}: {len(probs)}건\n- " + "\n- ".join(probs[:8])
    print(msg)
    if "--dry" not in argv:
        from .api_check import send
        send(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
