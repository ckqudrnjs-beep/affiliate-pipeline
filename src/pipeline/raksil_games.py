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


def rotation_on(path: pathlib.Path = HOLD) -> bool:
    """월 네온 사격장·목 로테이션. 2026-11-20 1안(BK): 봇 플레이 쇼츠가 89~450회라 새 게임 소개만 남김 → 기본 꺼짐.
    config/raksil_games.json 에 {"rotation": true} 이면 다시 켠다."""
    try:
        return bool(json.loads(path.read_text(encoding="utf-8")).get("rotation"))
    except (OSError, ValueError):
        return False


def plan(day: dt.date, games: list[dict], log: dict, hold: bool = False,
         rotation: bool = True) -> tuple[str, str | None, str | None]:
    """그날 20:00 슬롯에 무엇을 올릴지. hold 면 게임 화면 쇼츠는 모두 쉼(밸런스 쇼츠는 그대로)."""
    if hold:
        return ("none", None, None)
    done = intro_done(log)
    for g in games:
        if g["slug"] not in OLD_GAMES and g["slug"] not in done:
            return ("game", g["slug"], "new")
    if not rotation:
        return ("none", None, None)
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


def hook_of(g: dict, day: dt.date, score: float | None = None) -> str:
    """2026-11-20 1안: 녹화 기록 점수가 있으면 도전형 후킹("이 기록 1,240점, 넘을 수 있어?")."""
    if isinstance(score, (int, float)) and score > 0:
        return f"이 기록 {int(score):,}점, 넘을 수 있어?"
    return HOOKS[(day.toordinal() + sum(map(ord, g["slug"]))) % len(HOOKS)]


def rec_score(rec: pathlib.Path) -> float | None:
    try:
        return json.loads((rec / "info.json").read_text(encoding="utf-8")).get("score")
    except (OSError, ValueError):
        return None


def lines(g: dict, kind: str) -> list[str]:
    first = f"5락실 신작, {g['name']}!" if kind == "new" else f"{g['name']}, 설치 없이 바로 돼."
    return [first, "오락실 닷컴에서 바로 해 봐! 새 게임 계속 나오니까 즐겨찾기!"]  # 2026-11-17 BK: 끝 한 줄


def title_of(g: dict, kind: str, hook: str = "") -> str:
    hook = hook or HOOKS[0]
    if kind == "new":
        return f"[신작] {g['name']} | {hook} #5락실 #shorts"[:95]
    return f"{g['name']} | {hook} #5락실 #shorts"[:95]


def description_of(g: dict, kind: str, voiced: bool) -> str:
    head = f"5락실 신작 '{g['name']}' 공개!" if kind == "new" else f"5락실 무료 웹게임 '{g['name']}'"
    ls = [head, g["short"], "",
          f"▶ 설치 없이 바로 하기: {rs.SITE}/games/{g['slug']}",
          f"▶ 다른 무료 게임·매일 밸런스게임: {rs.SITE}",
          "▶ 새 게임 소식은 구독으로", "",
          "영상 속 플레이는 자동 플레이(테스트 모드) 화면입니다. 게임 속 그래픽·캐릭터는 모두 5락실이 만든 디자인입니다."]
    if voiced:
        ls.append("내레이션: AI 음성")
    ls.append("#웹게임 #무료게임 #5락실")
    return "\n".join(x for x in ls if x is not None)


# ---------- 화면 ----------
# 쇼츠 화면 안전영역 (2026-11-16 별사탕 합치기 밑부분 잘림 후): 유튜브 쇼츠 앱은 아래 약 20%(제목·채널·음악)를
# 덮고, 위 약 120px 에 검색·메뉴 아이콘이 있다. 게임 화면은 이 안에만 놓고, 글자 띠도 아래쪽에는 두지 않는다.
SAFE = (0, 120, W, 1540)
BOX = (40, 250, W - 40, SAFE[3])  # 게임 화면 자리 (안전영역 안에서 최대한 크게)
SUB_Y = 170  # 음성 자막 띠 (게임 이름 자리에 잠깐 덮음, 게임 화면은 안 가림)


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
    with Image.open(path) as im:
        return game_fit_img(im.convert("RGB"))


def game_fit_img(g):
    from PIL import Image
    x0, y0, x1, y1 = BOX
    bw, bh = x1 - x0, y1 - y0
    s = min(bw / g.width, bh / g.height)
    g = g.resize((int(g.width * s), int(g.height * s)), Image.LANCZOS)
    return g, (x0 + (bw - g.width) // 2, y0 + (bh - g.height) // 2)


def band(img, y: int, text: str, size: int, color, h: int | None = None):
    """반투명 띠 위에 큰 글자 (후킹·자막)."""
    from PIL import Image, ImageDraw
    dr = ImageDraw.Draw(img)
    f = rs.font(size)
    lines_ = rs.wrap(dr, text, f, W - 80)
    h = h or int(size * 1.7 + size * 1.2 * (len(lines_) - 1))  # 두 줄 후킹(도전형)도 띠 안에
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rectangle((0, y - h // 2, W, y + h // 2), fill=(8, 6, 26, 190))
    img.alpha_composite(ov)
    rs.glow_text(img, (W / 2, y), lines_, f, size, color, glow=6)


def cta_card(g: dict, t: float):
    img = rs.background(11)
    rs.glow_text(img, (W / 2, 560), [g["name"]], rs.font(110), 110, rs.WHITE, glow=10)
    blink = rs.PINK if int(t * 3) % 2 == 0 else rs.YEL
    rs.glow_text(img, (W / 2, 900), ["5raksil.com"], rs.font(130), 130, blink, glow=20)
    rs.glow_text(img, (W / 2, 1140), ["프로필 링크에서 바로 플레이"], rs.font(64), 64, rs.CYAN, glow=12)
    rs.glow_text(img, (W / 2, 1300), ["설치 없음, 무료"], rs.font(56), 56, rs.YEL, glow=8)
    rs.glow_text(img, (W / 2, 1460), ["새 게임 계속 · 즐겨찾기·구독"], rs.font(56), 56, rs.PINK, glow=8)
    return img


def render(rec: pathlib.Path, g: dict, kind: str, day: dt.date, out_dir: pathlib.Path = rs.OUT) -> dict | None:
    import numpy as np
    frames = sorted(rec.glob("f*.jpg"))[int(SKIP_START * FPS):][: int(MAX_PLAY * FPS)]
    if len(frames) < FPS * 6:
        print("녹화가 너무 짧음", len(frames))
        return None
    # 2026-11-20 BK "노래 BPM에 맞춰서": 플레이→CTA 전환을 박자에 맞추고 합성 베이스 대신 BGM (docs/BGM.md)
    from . import bgm
    tr = bgm.pick("game", day)
    if tr:
        frames = frames[: max(int(FPS * 6), round(bgm.snap(len(frames) / FPS, tr, 1, "down") * FPS))]
    play_d = len(frames) / FPS
    hook = hook_of(g, day, rec_score(rec))
    say = lines(g, kind)
    clips, voiced = rs.tts(say)
    v0 = (0.4, 0.4 + len(clips[0]) / SR) if voiced else (0.4, 2.6)
    cta_d = bgm.snap(max(2.4, len(clips[1]) / SR + 0.5), tr, 1, "up")
    total = play_d + cta_d

    audio = np.zeros(int(SR * total) + SR, dtype=np.float32)
    bass, t = [82, 110, 98, 123], 0.0
    while t < total and not tr:  # BGM 이 없을 때만 합성 베이스
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
        ybot = (pos0[1] + gi0.height + BOX[3]) // 2 + 40
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
            band(img, SUB_Y, say[0], 62, rs.WHITE)
        ff.stdin.write(img.convert("RGB").tobytes())
    ctas = {}
    for i in range(int(cta_d * FPS)):
        k = int(i / FPS * 3) % 2
        if k not in ctas:
            c = cta_card(g, k / 3)
            if voiced:
                band(c, 300, say[1], 58, rs.WHITE)
            ctas[k] = c
        ff.stdin.write(ctas[k].convert("RGB").tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg 실패")
    wav.unlink()
    from .raksil_ending import append as add_ending  # 2026-11-20 BK: 몽글이 구독·좋아요 엔딩
    total += add_ending(mp4, day)
    bgm.mix(mp4, tr)
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


# ---------- 업로드 전 화면 검사 ----------
# 2026-11-16 BK: "전체 화면을 검토하고 업로드 해야 돼". 하나라도 걸리면 업로드하지 않고 실패로 끝낸다.
MAX_CUT = 0.01   # 게임 화면이 녹화 영역 밖으로 나간 비율 허용치
MAX_DIFF = 14.0  # 완성 영상 속 게임 자리와 녹화 원본의 평균 밝기 차 (압축 오차보다 크면 잘림·밀림)


def _summary(msg: str) -> None:
    import os
    p = os.environ.get("GITHUB_STEP_SUMMARY")
    if p:
        with open(p, "a", encoding="utf-8") as f:
            f.write(msg + "\n")


def check_record(info: dict) -> list[str]:
    """녹화 단계: 게임 캔버스가 녹화 영역 안에 다 들어왔는지 (시작·끝 두 번 잰 값)."""
    errs = []
    for k, when in (("cut", "시작"), ("cut_end", "끝")):
        v = float(info.get(k) or 0)
        if v > MAX_CUT:
            errs.append(f"녹화 {when}에 게임 화면 {v:.0%} 가 잘림")
    return errs


def check_layout(size: tuple[int, int]) -> list[str]:
    """배치 단계: 게임 화면이 쇼츠 안전영역 안에 있는지."""
    from PIL import Image
    gi, (x, y) = game_fit_img(Image.new("RGB", size))
    if x < SAFE[0] or y < SAFE[1] or x + gi.width > SAFE[2] or y + gi.height > SAFE[3]:
        return [f"게임 화면이 쇼츠 안전영역 밖 ({x},{y},{x + gi.width},{y + gi.height})"]
    return []


def sample_times(n_frames: int, k: int = 4) -> list[int]:
    """자막·후킹 띠가 없는 구간(3.2초 이후)에서 고르게 k 장."""
    lo, hi = int(3.2 * FPS), n_frames - FPS // 2
    if hi <= lo:
        return []
    return [lo + (hi - lo) * j // max(1, k - 1) for j in range(k)]


def check(rec: pathlib.Path, meta: dict) -> list[str]:
    """업로드 전 검사: ① 녹화 잘림 ② 안전영역 ③ 완성 영상에서 프레임을 뽑아 게임 자리가 원본 녹화와 같은지(빈 화면 아님)."""
    import numpy as np
    from PIL import Image, ImageDraw
    errs: list[str] = []
    try:
        info = json.loads((rec / "info.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        info = {}
        errs.append("녹화 정보(info.json) 없음")
    errs += check_record(info)
    frames = sorted(rec.glob("f*.jpg"))[int(SKIP_START * FPS):][: int(MAX_PLAY * FPS)]
    if not frames:
        return errs + ["녹화 프레임 없음"]
    with Image.open(frames[0]) as f0:
        errs += check_layout(f0.size)
    mp4 = pathlib.Path(meta["file"])
    picks = sample_times(len(frames))
    sheet = Image.new("RGB", (W // 4 * len(picks) or 1, H // 4), (0, 0, 0))
    for j, i in enumerate(picks):
        t = (i + 0.5) / FPS
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(mp4), "-frames:v", "1",
                              "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        if len(raw) != W * H * 3:
            errs.append(f"{t:.1f}초 프레임을 못 뽑음 (영상 크기가 {W}x{H} 아님?)")
            continue
        vid = np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(np.float32)
        gi, (x, y) = game_fit(frames[i])
        ref = np.asarray(gi, np.float32)
        part = vid[y:y + gi.height, x:x + gi.width]
        if ref.std() < 3:
            errs.append(f"{t:.1f}초 게임 화면이 비어 있음")
        d = float(np.abs(part - ref).mean())
        if d > MAX_DIFF:
            errs.append(f"{t:.1f}초 영상 속 게임 화면이 녹화와 다름 (차이 {d:.1f})")
        # 검토용 미리보기: 안전영역 선을 그려 4장 나란히
        im = Image.fromarray(vid.astype(np.uint8))
        dr = ImageDraw.Draw(im)
        dr.rectangle(SAFE, outline=(0, 255, 0), width=6)
        dr.rectangle((x, y, x + gi.width - 1, y + gi.height - 1), outline=(255, 0, 255), width=4)
        sheet.paste(im.resize((W // 4, H // 4)), (j * (W // 4), 0))
    if not picks:
        errs.append("검사할 프레임이 부족함")
    try:
        sheet.save(mp4.with_name(mp4.stem + "-check.jpg"), quality=85)
    except OSError:
        pass
    return errs


def load_log() -> dict:
    return json.loads(rs.LOG.read_text(encoding="utf-8")) if rs.LOG.exists() else {}


def main(argv: list[str]) -> int:
    today = dt.datetime.now(rs.KST).date()
    if len(argv) > 1 and argv[1] == "plan":
        day = dt.date.fromisoformat(argv[2]) if len(argv) > 2 and argv[2] else today
        what, slug, kind = plan(day, discover(), load_log(), hold_new(), rotation_on())
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
    errs = check(rec, meta)
    if errs:
        print("업로드 보류 (화면 검사 실패):\n- " + "\n- ".join(errs))
        _summary(f"5락실 게임 쇼츠 업로드 보류 ({meta['key']}): " + " / ".join(errs))
        return 1
    print("화면 검사 통과")
    return rs.upload_meta(meta) if cmd == "upload" else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
