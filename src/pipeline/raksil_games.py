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
                    "order": m.get("order", 999), "genre": m.get("genre", "")})
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


# 쇼츠 공식 (BK 11/14 "오락실도 쇼츠 잘 만들어줘"):
# 첫 프레임부터 실제 플레이 + 큰 후킹 문구(1초 안에 '뭔지' 보이게) → 게임 화면 크게 → 음성 그대로 자막
# → 15초 안팎(끝까지 보고 다시 보게) → 짧은 끝 화면(주소). 제목은 후킹 + 게임 이름, 과장·낚시 금지.
HOOKS = ["이게 설치 없이 된다고?", "폰에서 바로 되는 게임", "딱 한 판만 하려다 열 판", "출근길 5분 순삭 게임",
         "무료인데 이 퀄리티?", "친구랑 점수 내기 각"]
SKIP_START = 1.0  # 녹화 앞부분(시작 버튼·메뉴) 건너뜀
MAX_PLAY = 13.0


def hook_of(g: dict, day: dt.date) -> str:
    return HOOKS[(day.toordinal() + sum(map(ord, g["slug"]))) % len(HOOKS)]


def lines(g: dict, kind: str) -> list[str]:
    first = f"5락실 신작, {g['name']}!" if kind == "new" else f"{g['name']}, 설치 없이 바로 돼."
    return [first, "프로필 링크, 오락실 닷컴에서 바로 해 봐!"]


def title_of(g: dict, kind: str, hook: str = "") -> str:
    hook = hook or HOOKS[0]
    if kind == "new":
        return f"[신작] {g['name']} | {hook} #5락실 #shorts"[:95]
    return f"{g['name']} | {hook} #5락실 #shorts"[:95]


def description_of(g: dict, kind: str, voiced: bool) -> str:
    head = f"5락실 신작 '{g['name']}' 공개!" if kind == "new" else f"5락실 무료 웹게임 '{g['name']}'"
    ls = [head, g["short"], "",
          f"▶ 설치 없이 바로 하기: {rs.SITE}/games/{g['slug']}",
          f"▶ 다른 무료 게임·매일 밸런스게임: {rs.SITE}", "",
          "영상 속 플레이는 자동 플레이(테스트 모드) 화면입니다. 게임 속 그래픽·캐릭터는 모두 5락실이 만든 디자인입니다."]
    if voiced:
        ls.append("내레이션: AI 음성")
    ls.append("#웹게임 #무료게임 #5락실")
    return "\n".join(x for x in ls if x is not None)


# ---------- 화면 ----------
BOX = (40, 250, W - 40, H - 40)  # 게임 화면 자리 (최대한 크게)


def frame_layer(g: dict, kind: str):
    from PIL import ImageDraw
    img = rs.background(17)
    dr = ImageDraw.Draw(img)
    f = rs.font(52)
    tag = "5락실 신작" if kind == "new" else "5락실 무료 게임"
    rs.glow_text(img, (W / 2, 70), [tag], f, 52, rs.YEL if kind == "new" else rs.CYAN, glow=8)
    rs.glow_text(img, (W / 2, 170), [g["name"]], rs.font(88), 88, rs.WHITE, glow=12)
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


def band(img, y: int, text: str, size: int, color, h: int | None = None):
    """반투명 띠 위에 큰 글자 (후킹·자막)."""
    from PIL import Image, ImageDraw
    h = h or int(size * 1.7)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rectangle((0, y - h // 2, W, y + h // 2), fill=(8, 6, 26, 190))
    img.alpha_composite(ov)
    dr = ImageDraw.Draw(img)
    f = rs.font(size)
    lines_ = rs.wrap(dr, text, f, W - 80)
    rs.glow_text(img, (W / 2, y), lines_, f, size, color, glow=6)


def cta_card(g: dict, t: float):
    img = rs.background(11)
    rs.glow_text(img, (W / 2, 560), [g["name"]], rs.font(110), 110, rs.WHITE, glow=10)
    blink = rs.PINK if int(t * 3) % 2 == 0 else rs.YEL
    rs.glow_text(img, (W / 2, 900), ["5raksil.com"], rs.font(130), 130, blink, glow=20)
    rs.glow_text(img, (W / 2, 1140), ["프로필 링크에서 바로 플레이"], rs.font(64), 64, rs.CYAN, glow=12)
    rs.glow_text(img, (W / 2, 1300), ["설치 없음, 무료"], rs.font(56), 56, rs.YEL, glow=8)
    return img


def render(rec: pathlib.Path, g: dict, kind: str, day: dt.date, out_dir: pathlib.Path = rs.OUT) -> dict | None:
    import numpy as np
    frames = sorted(rec.glob("f*.jpg"))[int(SKIP_START * FPS):][: int(MAX_PLAY * FPS)]
    if len(frames) < FPS * 6:
        print("녹화가 너무 짧음", len(frames))
        return None
    play_d = len(frames) / FPS
    hook = hook_of(g, day)
    say = lines(g, kind)
    clips, voiced = rs.tts(say)
    v0 = (0.4, 0.4 + len(clips[0]) / SR) if voiced else (0.4, 2.6)
    cta_d = max(2.4, len(clips[1]) / SR + 0.5)
    total = play_d + cta_d

    audio = np.zeros(int(SR * total) + SR, dtype=np.float32)
    bass, t = [82, 110, 98, 123], 0.0
    while t < total:
        rs.place(audio, rs.tone(bass[int(t * 2) % 4], 0.45, 0.06), t)
        t += 0.5
    rs.place(audio, np.concatenate([rs.tone(784, 0.08, 0.15), rs.tone(1047, 0.08, 0.15), rs.tone(1319, 0.18, 0.15)]), 0.0)
    rs.place(audio, clips[0] * 0.95, v0[0])
    rs.place(audio, clips[1] * 0.95, play_d + 0.15)
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
    from PIL import Image as _I
    with _I.open(frames[0]) as f0:
        wide = f0.width >= f0.height * 0.8
    hook_y = 760
    if wide:  # 가로·정사각 게임: 위아래 빈 곳에 후킹 문구와 게임 소개
        gi0, pos0 = game_fit(frames[0])
        hook_y = (250 + pos0[1]) // 2 + 10
        ybot = (pos0[1] + gi0.height + H) // 2
        rs.glow_text(base, (W / 2, ybot - 40), rs.wrap(__import__("PIL.ImageDraw", fromlist=["x"]).Draw(base), g["short"], rs.font(60), W - 120),
                     rs.font(60), 60, rs.CYAN, glow=8)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium",
                           "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest",
                           "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    for i, fp in enumerate(frames):
        t = i / FPS
        img = base.copy()
        gi, pos = game_fit(fp)
        img.paste(gi, pos)
        if t < 2.4:  # 첫 화면부터 후킹 문구
            band(img, hook_y, hook, 96 if t > 0.12 else 104, rs.YEL)
        if v0[0] <= t < v0[1] + 0.3 and voiced:  # 음성 자막
            band(img, 1700, say[0], 62, rs.WHITE)
        ff.stdin.write(img.convert("RGB").tobytes())
    ctas = {}
    for i in range(int(cta_d * FPS)):
        k = int(i / FPS * 3) % 2
        if k not in ctas:
            c = cta_card(g, k / 3)
            if voiced:
                band(c, 1700, say[1], 58, rs.WHITE)
            ctas[k] = c
        ff.stdin.write(ctas[k].convert("RGB").tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg 실패")
    wav.unlink()
    tags = ["5락실", g["name"].replace(" ", ""), "웹게임", "무료게임", "브라우저게임", "미니게임", "shorts"]
    if g.get("genre"):
        tags.insert(2, str(g["genre"]).replace(" ", ""))
    meta = {"date": day.isoformat(), "qid": f"game-{g['slug']}-{kind}-{day.isoformat()}", "key": key,
            "file": str(mp4), "title": title_of(g, kind, hook), "description": description_of(g, kind, voiced),
            "voiced": voiced, "hour": HOUR, "schedule": True, "category": "20", "game": g["slug"],
            "tags": tags, "seconds": round(total, 1)}
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
