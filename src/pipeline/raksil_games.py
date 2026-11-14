"""5락실 게임 쇼츠: 새 게임은 항상 쇼츠로 (BK 2026-11-14 "새 게임이 제작되면 쇼츠 소재에 당연히 넣어주세요").

- 게임 목록은 playground/games/*/meta.json 에서 자동으로 읽는다 → 새 게임 폴더가 생기면 따로 등록할 것 없음.
- 새 게임(OLD_GAMES 에 없고 아직 소개 쇼츠를 안 올린 게임): 다음 실행 때 'NEW GAME' 소개 쇼츠, 20:00 KST 공개.
  하루 1편만, 여러 개면 meta.json 의 order 순서.
- 목요일: 네온 사격장을 뺀 게임을 돌아가며 플레이 하이라이트 (가장 오래 안 나온 게임부터). 월요일은 네온 사격장 그대로.
  소개 쇼츠가 있는 날은 그게 먼저(그날 하이라이트는 쉼).
- 녹화: scripts/game_rec.js (가상 시계 30fps). 게임이 #demo 약속(window.__demo.bot)을 지원하면 자동 플레이, 아니면 시작만 눌러 첫 몇 초.
- 기록: data/youtube/raksil_uploaded.json 의 키 "<날짜>-game-<slug>" (소개는 "-new" 꼬리).
- 모든 그래픽·소리는 5락실이 만든 것. 다른 게임의 이름·캐릭터·화면은 쓰지 않는다.

실행: PYTHONPATH=src python -m pipeline.raksil_games plan [YYYY-MM-DD]          → "range" / "game <slug> new|play" / "none"
      PYTHONPATH=src python -m pipeline.raksil_games <녹화폴더> render|upload <slug> new|play [YYYY-MM-DD]
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import subprocess
import sys

from . import raksil_shorts as rs

W, H, FPS, SR = rs.W, rs.H, rs.FPS, rs.SR
HOUR = 20
GAMES = pathlib.Path("playground/games")
# 2026-11-14 이전부터 있던 게임: 소개 쇼츠 없이 목요일 로테이션에만 들어감.
OLD_GAMES = {"chosung", "dodge", "majority", "range", "reaction", "spot", "starlight", "stop", "tongtong"}
MAX_PLAY = 16.0
# 새 게임 소개 쇼츠 잠시 멈춤 (BK 2026-11-14: 주말에 그래픽·캐릭터 전면 정리 → 끝나면 새 화면으로).
# 파일에 {"hold_new": true} 이면 소개 쇼츠·월 네온 사격장·목 로테이션 모두 쉰다. 정리 끝나면 false 로.
HOLD = pathlib.Path("config/raksil_games.json")


def hold_new(path: pathlib.Path = HOLD) -> bool:
    try:
        return bool(json.loads(path.read_text(encoding="utf-8")).get("hold_new"))
    except (OSError, ValueError):
        return False


def discover(root: pathlib.Path = GAMES) -> list[dict]:
    out = []
    for p in sorted(root.glob("*/meta.json")):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if m.get("hidden") or not m.get("name"):
            continue
        out.append({"slug": p.parent.name, "name": m["name"], "short": m.get("short", ""),
                    "order": m.get("order", 999)})
    return sorted(out, key=lambda g: (g["order"], g["slug"]))


def history(log: dict) -> dict[str, str]:
    """slug → 마지막으로 쇼츠에 나온 날짜."""
    last: dict[str, str] = {}
    for k in log:
        if "-game-" in k:
            d, slug = k.split("-game-", 1)
            slug = slug.removesuffix("-new")
        elif k.endswith("-range"):
            d, slug = k[:10], "range"
        else:
            continue
        last[slug] = max(last.get(slug, ""), d)
    return last


def intro_done(log: dict) -> set[str]:
    return {k.split("-game-", 1)[1].removesuffix("-new") for k in log if "-game-" in k and k.endswith("-new")}


def plan(day: dt.date, games: list[dict], log: dict, hold: bool = False) -> tuple[str, str | None, str | None]:
    """그날 20:00 슬롯에 무엇을 올릴지. hold 면 게임 화면 쇼츠는 모두 쉼(밸런스 쇼츠는 그대로)."""
    if hold:
        return ("none", None, None)
    done = intro_done(log)
    for g in games:
        if g["slug"] not in OLD_GAMES and g["slug"] not in done:
            return ("game", g["slug"], "new")
    if day.weekday() == 0:
        return ("range", None, None)
    if day.weekday() == 3:
        last = history(log)
        pool = [g for g in games if g["slug"] != "range"]
        if pool:
            g = min(pool, key=lambda g: (last.get(g["slug"], ""), g["order"], g["slug"]))
            return ("game", g["slug"], "play")
    return ("none", None, None)


def lines(g: dict, kind: str) -> list[str]:
    first = f"5락실 새 게임, {g['name']}!" if kind == "new" else f"오늘의 5락실 게임, {g['name']}."
    return [first, "설치 없이 바로, 오락실 닷컴에서 해 봐!"]


def title_of(g: dict, kind: str) -> str:
    if kind == "new":
        return f"[NEW] {g['name']} 🎮 설치 없이 바로 하는 무료 웹게임 #5락실 #shorts"
    return f"{g['name']} 🎮 {g['short'] or '무료 웹게임'} #5락실 #shorts"[:95]


def description_of(g: dict, kind: str, voiced: bool) -> str:
    head = f"5락실 새 게임 '{g['name']}' 공개!" if kind == "new" else f"5락실 무료 웹게임 '{g['name']}'"
    ls = [head, g["short"], "",
          f"▶ 설치 없이 바로 하기: {rs.SITE}/games/{g['slug']}",
          f"▶ 다른 무료 게임·매일 밸런스게임: {rs.SITE}", "",
          "게임 속 그래픽·캐릭터는 모두 5락실이 만든 디자인입니다."]
    if voiced:
        ls.append("내레이션: AI 음성")
    ls.append("#웹게임 #무료게임 #5락실")
    return "\n".join(x for x in ls if x is not None)


# ---------- 화면 ----------
BOX = (108, 330, W - 108, H - 70)  # 게임 화면 자리


def frame_layer(g: dict, kind: str):
    from PIL import ImageDraw
    img = rs.background(17)
    rs.header(img, "NEW GAME!" if kind == "new" else "오늘의 무료 웹게임")
    rs.glow_text(img, (W / 2, 280), [g["name"]], rs.font(64), 64, rs.PINK if kind == "new" else rs.CYAN, glow=10)
    dr = ImageDraw.Draw(img)
    x0, y0, x1, y1 = BOX
    dr.rounded_rectangle((x0 - 8, y0 - 8, x1 + 8, y1 + 8), radius=26, outline=rs.CYAN + (255,), width=6)
    return img


def game_fit(path: pathlib.Path):
    """녹화 화면을 BOX 안에 비율 유지로 맞춤 → (이미지, 위치)."""
    from PIL import Image
    g = Image.open(path).convert("RGB")
    x0, y0, x1, y1 = BOX
    bw, bh = x1 - x0, y1 - y0
    s = min(bw / g.width, bh / g.height)
    g = g.resize((int(g.width * s), int(g.height * s)), Image.LANCZOS)
    return g, (x0 + (bw - g.width) // 2, y0 + (bh - g.height) // 2)


def cta_card(g: dict, t: float):
    img = rs.background(11)
    rs.header(img, "무료 웹게임")
    rs.glow_text(img, (W / 2, 620), [g["name"]], rs.font(110), 110, rs.WHITE, glow=10)
    blink = rs.PINK if int(t * 3) % 2 == 0 else rs.YEL
    rs.glow_text(img, (W / 2, 1000), ["5raksil.com"], rs.font(130), 130, blink, glow=20)
    rs.glow_text(img, (W / 2, 1260), ["설치 없이 바로 플레이"], rs.font(72), 72, rs.CYAN, glow=12)
    return img


def render(rec: pathlib.Path, g: dict, kind: str, day: dt.date, out_dir: pathlib.Path = rs.OUT) -> dict | None:
    import numpy as np
    frames = sorted(rec.glob("f*.jpg"))[: int(MAX_PLAY * FPS)]
    if len(frames) < FPS * 6:
        print("녹화가 너무 짧음", len(frames))
        return None
    play_d = len(frames) / FPS
    clips, voiced = rs.tts(lines(g, kind))
    cta_d = max(3.0, len(clips[1]) / SR + 0.6)
    total = play_d + cta_d

    audio = np.zeros(int(SR * total) + SR, dtype=np.float32)
    bass, t = [82, 110, 98, 123], 0.0
    while t < total:
        rs.place(audio, rs.tone(bass[int(t * 2) % 4], 0.45, 0.06), t)
        t += 0.5
    if kind == "new":
        rs.place(audio, np.concatenate([rs.tone(784, 0.08, 0.15), rs.tone(1047, 0.08, 0.15), rs.tone(1319, 0.18, 0.15)]), 0.0)
    rs.place(audio, clips[0] * 0.95, 0.3)
    rs.place(audio, clips[1] * 0.95, play_d + 0.2)
    audio = np.clip(audio, -1, 1)[: int(SR * total)]

    out_dir.mkdir(parents=True, exist_ok=True)
    key = f"{day.isoformat()}-game-{g['slug']}" + ("-new" if kind == "new" else "")
    wav, mp4 = out_dir / f"{key}.wav", out_dir / f"{key}.mp4"
    import wave
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())

    base = frame_layer(g, kind)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium",
                           "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest",
                           "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    for fp in frames:
        img = base.copy()
        gi, pos = game_fit(fp)
        img.paste(gi, pos)
        ff.stdin.write(img.convert("RGB").tobytes())
    ctas = {}
    for i in range(int(cta_d * FPS)):
        k = int(i / FPS * 3) % 2
        ctas.setdefault(k, cta_card(g, k / 3))
        ff.stdin.write(ctas[k].convert("RGB").tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg 실패")
    wav.unlink()
    meta = {"date": day.isoformat(), "qid": f"game-{g['slug']}-{kind}-{day.isoformat()}", "key": key,
            "file": str(mp4), "title": title_of(g, kind), "description": description_of(g, kind, voiced),
            "voiced": voiced, "hour": HOUR, "schedule": True, "category": "20", "game": g["slug"],
            "tags": ["5락실", g["name"].replace(" ", ""), "웹게임", "무료게임", "미니게임", "shorts"],
            "seconds": round(total, 1)}
    (out_dir / f"{key}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def load_log() -> dict:
    return json.loads(rs.LOG.read_text(encoding="utf-8")) if rs.LOG.exists() else {}


def main(argv: list[str]) -> int:
    today = dt.datetime.now(rs.KST).date()
    if len(argv) > 1 and argv[1] == "plan":
        day = dt.date.fromisoformat(argv[2]) if len(argv) > 2 and argv[2] else today
        what, slug, kind = plan(day, discover(), load_log(), hold_new())
        print(" ".join(x for x in (what, slug, kind) if x))
        return 0
    rec, cmd, slug, kind = pathlib.Path(argv[1]), argv[2], argv[3], argv[4]
    day = dt.date.fromisoformat(argv[5]) if len(argv) > 5 and argv[5] else today
    g = next((x for x in discover() if x["slug"] == slug), None)
    if not g:
        print("게임 없음", slug)
        return 1
    meta = render(rec, g, kind, day)
    if not meta:
        return 0
    return rs.upload_meta(meta) if cmd == "upload" else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
