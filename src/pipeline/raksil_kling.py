"""5락실 게임 쇼츠 — Kling 상황극·리액션 + 실제 게임 녹화 (BK 2026-11-21 "구독·유입·조회수, 사이트로 들어와 게임하게",
카드 선택 "1 리액션 컷 + 2 상황극"). 기획안: /mnt/project-files/5raksil-kling/게임쇼츠-Kling-기획안.md, 기준 docs/DIRECTION.md 2-2.

원칙
- 게임 화면은 100% 실제 녹화(scripts/game_rec.js). Kling 클립은 사람 반응·생활 상황 장면만, 휴대폰·모니터 화면은 안 보이는 컷만 등록.
  AI로 게임 화면을 만들지 않는다(유튜브 '오해의 소지' 정책 + 들어온 사람 실망).
- 형식 ① react(리액션 컷): Kling '헉' 훅 → 실제 플레이 → Kling 결과 반응(환호/좌절). 리액션 클립은 모든 게임에 돌려 씀.
  형식 ② situ(상황극): Kling 생활 장면(라면 3분 등) → 그 시간에 맞는 게임 실제 플레이 → Kling 개그 끝(라면 불음).
- 두 형식을 번갈아, 직전 3편에 쓴 클립은 다시 안 씀(반복 양산 금지). 클립이 모자라면 그 형식은 건너뜀.
- 설명란에 'AI 생성 장면 포함, 게임 화면은 실제 플레이'. 사실적인 사람 클립(realistic: true)이면 containsSyntheticMedia.

클립 목록: config/raksil_kling.json (on=false 면 전체 꺼짐 → 예전 게임 쇼츠 규칙). 클립 파일은 media/kling/ (720x1280 무음 재인코딩).
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import subprocess

CFG = pathlib.Path("config/raksil_kling.json")
DAYS = (0, 2, 4)  # 월·수·금 20:00 (기획안 4장)
RECENT = 3


def load(path: pathlib.Path = CFG) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _ok(c: dict, root: pathlib.Path) -> bool:
    return bool(c.get("file")) and (root / c["file"]).exists()


def recent_ids(log: dict, n: int = RECENT) -> tuple[set[str], list[str]]:
    """직전 n편(Kling 형식)에 쓴 클립 id 와 형식 순서."""
    rows = [(k, v) for k, v in sorted(log.items()) if isinstance(v, dict) and v.get("kling")]
    rows = rows[-n:]
    ids = {i for _, v in rows for i in v["kling"].get("ids", [])}
    return ids, [v["kling"].get("format", "") for _, v in rows]


def pick(day: dt.date, log: dict, games: list[dict], last_shown: dict[str, str],
         cfg: dict | None = None, root: pathlib.Path = pathlib.Path(".")) -> dict | None:
    """그날 Kling 게임 쇼츠 설계 → {format, game, hook, pay, top, ids} 또는 None(꺼짐·요일 아님·클립 부족)."""
    cfg = load() if cfg is None else cfg
    if not cfg.get("on") or day.weekday() not in DAYS:
        return None
    used, fmts = recent_ids(log)
    slugs = {g["slug"] for g in games}
    seed = day.toordinal()

    def fresh(rows):
        return [c for c in rows if _ok(c, root) and not c.get("off") and c.get("id") not in used]

    def react():
        hooks, pays = fresh(cfg.get("react_hook", [])), fresh(cfg.get("react_pay", []))
        pool = [s for s in cfg.get("react_games", []) if s in slugs]
        if not hooks or not pays or not pool:
            return None
        game = min(pool, key=lambda s: (last_shown.get(s, ""), pool.index(s)))
        h, p = hooks[seed % len(hooks)], pays[seed % len(pays)]
        tops = cfg.get("react_tops") or ["이 판 끝까지 봐"]
        return {"format": "react", "game": game, "hook": h, "pay": p, "top": tops[seed % len(tops)],
                "ids": [h["id"], p["id"]]}

    def situ():
        rows = [s for s in fresh(cfg.get("situ", [])) if s.get("game") in slugs and _ok(s.get("pay") or {}, root)]
        if not rows:
            return None
        s = min(rows, key=lambda s: (last_shown.get(s["game"], ""), s["id"]))
        return {"format": "situ", "game": s["game"], "hook": s, "pay": s["pay"], "top": s["top"],
                "ids": [s["id"]]}

    order = [situ, react] if (fmts and fmts[-1] == "react") else [react, situ]
    for f in order:
        r = f()
        if r:
            r["realistic"] = bool(r["hook"].get("realistic") or r["pay"].get("realistic"))
            return r
    return None


def frames(path: pathlib.Path, ss: float, t: float, w: int, h: int, fps: int):
    """클립 구간을 w×h 꽉 채우기(가운데 자르기)로 fps 프레임씩 → PIL RGBA 이미지 생성기."""
    from PIL import Image
    vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps}"
    p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-ss", f"{ss:.3f}", "-t", f"{t:.3f}", "-i", str(path),
                          "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n = w * h * 3
    try:
        while True:
            buf = p.stdout.read(n)
            if len(buf) < n:
                break
            yield Image.frombytes("RGB", (w, h), buf).convert("RGBA")
    finally:
        p.stdout.close()
        p.wait()


def dim_top(img, h: int):
    """Kling 컷 위에 제목 띠가 잘 읽히게 위쪽만 살짝 어둡게 (흐림 금지 규칙 → 어둡게만)."""
    from PIL import Image, ImageDraw
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rectangle((0, 0, img.width, h), fill=(0, 0, 0, 90))
    img.alpha_composite(ov)
    return img


AI_NOTE = "사람이 나오는 장면은 AI(Kling)로 만든 연출 장면이고, 게임 화면은 5락실 실제 플레이 녹화입니다."
