"""5락실 '몽글이 공감극장' 밈 쇼츠 (BK 2026-11-17 "둘다 해보자": 우리 캐릭터 × 유행 밈 틀 실험).

- 유명인·실존 인물 사진, 남의 춤 안무, 유행곡 원곡은 쓰지 않는다 (초상권·퍼블리시티권·저작권).
  나오는 건 5락실이 만든 몽글이(몽글숲 아지트 3D 렌더 아틀라스)뿐이고, 음악은 코드로 만든 비트다.
- 틀은 저작권이 없는 '공감 비교' 형식만: "월요일 vs 금요일", "1일차 vs 30일차", "파티에서 E vs I" 등.
- 기존 20:00 게임 쇼츠 자리가 비는 화·토에만 올린다 (쇼츠 개수를 늘리지 않음, 하루 1편 원칙).
- 같은 틀은 가장 오래 안 쓴 것부터 돌아가며, 매번 몽글이 색을 바꾼다 (같은 영상 반복 아님).
- 기록 키: data/youtube/raksil_uploaded.json 의 "<날짜>-meme-<틀 id>".

실행: PYTHONPATH=src python -m pipeline.raksil_meme plan [YYYY-MM-DD]       → "meme <id>" / "none"
      PYTHONPATH=src python -m pipeline.raksil_meme render|upload [YYYY-MM-DD] [틀 id]
"""
from __future__ import annotations

import datetime as dt
import json
import math
import pathlib
import subprocess
import sys

from . import raksil_shorts as rs

W, H, FPS, SR = rs.W, rs.H, rs.FPS, rs.SR
HOUR = 20
DAYS = (1, 5)  # 화·토 (월 네온 사격장, 목 게임 로테이션과 겹치지 않음)
ATLAS = pathlib.Path("playground/static/img/mongle/mongle3d.webp")
PALS = ["mint", "peach", "sky", "lilac"]
BPM = 120
BEAT = 60 / BPM
FLOOR = 1380  # 몽글이 발 위치 (쇼츠 안전영역 1540 위)

# 틀: 장면 2개(전·후) + 끝 화면. actors = [(색 순번 오프셋, 단계, 갈래, x, 춤, 표정)]
# 단계 1 새싹 · 2 꼬마 · 3 어른(갈래 power|wise|heart). 색은 날짜마다 돌아감.
TEMPLATES = [
    {"id": "monday", "hook": "직장인 공감 100%", "q": "너는 지금 어느 쪽?",
     "scenes": [{"cap": "월요일 아침 9시", "bg": ((64, 70, 96), (28, 30, 48)), "music": "slow",
                 "actors": [(0, 2, None, 0.5, "sleepy", "sleep")]},
                {"cap": "금요일 저녁 6시", "bg": ((255, 140, 180), (120, 60, 200)), "music": "party",
                 "actors": [(0, 2, None, 0.5, "jump", "happy")]}]},
    {"id": "grow", "hook": "키운 보람 MAX", "q": "몇 일차까지 키워 봤어?",
     "scenes": [{"cap": "몽글이 키우기 1일차", "bg": ((168, 236, 200), (60, 140, 120)), "music": "slow",
                 "actors": [(0, 1, None, 0.5, "wiggle", "idle")]},
                {"cap": "30일차", "bg": ((255, 214, 120), (230, 110, 150)), "music": "party",
                 "actors": [(0, 3, "heart", 0.5, "side", "happy")]}]},
    {"id": "party", "hook": "파티 갔을 때 E vs I", "q": "너는 E? I?",
     "scenes": [{"cap": "파티 시작 10분", "bg": ((120, 90, 220), (40, 30, 90)), "music": "party",
                 "actors": [(0, 2, None, 0.3, "jump", "happy"), (1, 2, None, 0.72, "sway", "idle")]},
                {"cap": "파티 시작 2시간", "bg": ((255, 120, 160), (90, 40, 160)), "music": "party",
                 "actors": [(0, 2, None, 0.3, "spin", "happy"), (1, 2, None, 0.72, "sleepy", "sleep")]}]},
    {"id": "exam", "hook": "시험 끝난 날 POV", "q": "시험 끝나면 제일 먼저 하는 건?",
     "scenes": [{"cap": "시험 전날 새벽 3시", "bg": ((40, 44, 70), (14, 16, 30)), "music": "slow",
                 "actors": [(0, 2, None, 0.5, "shake", "shock")]},
                {"cap": "시험 끝난 순간", "bg": ((120, 220, 255), (90, 120, 240)), "music": "party",
                 "actors": [(0, 2, None, 0.2, "jump", "happy"), (1, 2, None, 0.4, "side", "happy"),
                            (2, 2, None, 0.6, "spin", "happy"), (3, 2, None, 0.8, "jump", "happy")]}]},
    {"id": "payday", "hook": "월급날 vs 월급 3일 후", "q": "월급 며칠 버텨?",
     "scenes": [{"cap": "월급날", "bg": ((255, 222, 110), (240, 150, 60)), "music": "party",
                 "actors": [(0, 3, "power", 0.5, "spin", "happy")], "coins": True},
                {"cap": "월급 3일 후", "bg": ((90, 96, 120), (40, 42, 58)), "music": "slow",
                 "actors": [(0, 2, None, 0.5, "melt", "sleep")]}]},
    {"id": "alarm", "hook": "알람 끄고 5분만 더", "q": "알람 몇 번 끄고 일어나?",
     "scenes": [{"cap": "5분만 더...", "bg": ((150, 170, 230), (60, 70, 140)), "music": "slow",
                 "actors": [(0, 2, None, 0.5, "sleepy", "sleep")]},
                {"cap": "눈 떠 보니 8시 50분", "bg": ((255, 110, 110), (150, 30, 60)), "music": "party",
                 "actors": [(0, 2, None, 0.5, "panic", "shock")]}]},
]
SCENE_D = (4.5, 6.0)
CTA_D = 2.6


# ---------- 계획 ----------
def history(log: dict) -> dict[str, str]:
    last: dict[str, str] = {}
    for k in log:
        if "-meme-" in k:
            d, tid = k.split("-meme-", 1)
            last[tid] = max(last.get(tid, ""), d)
    return last


def episode(log: dict) -> int:
    return 1 + sum(1 for k in log if "-meme-" in k)


def plan(day: dt.date, log: dict) -> str | None:
    """그날 밈 쇼츠를 올릴지 → 틀 id 또는 None. 가장 오래 안 쓴 틀부터."""
    if day.weekday() not in DAYS:
        return None
    from .shorts_lock import locked  # 11/22 BK 고정안: 고정 기간엔 밈 쇼츠 쉼 (밸런스 하나로)
    if locked("5raksil", day):
        return None
    if any(k.startswith(day.isoformat() + "-meme-") for k in log):
        return None
    last = history(log)
    order = {t["id"]: i for i, t in enumerate(TEMPLATES)}
    return min(TEMPLATES, key=lambda t: (last.get(t["id"], ""), order[t["id"]]))["id"]


def template(tid: str) -> dict:
    return next(t for t in TEMPLATES if t["id"] == tid)


def title_of(t: dict, ep: int) -> str:
    return f"{t['hook']} | 몽글이 공감극장 {ep}화 #5락실 #shorts"[:95]


def description_of(t: dict, ep: int) -> str:
    return "\n".join([
        f"몽글이 공감극장 {ep}화: {t['hook']}",
        f"{t['q']} 댓글로 알려 줘!", "",
        f"▶ 몽글이 직접 키우기 (무료, 설치 없음): {rs.SITE}/games/mongle",
        f"▶ 다른 무료 게임·매일 밸런스게임: {rs.SITE}",
        "▶ 다음 화는 구독으로", "",
        "몽글이는 5락실 게임 '몽글숲 아지트'의 캐릭터이고, 그림·음악 모두 5락실이 직접 만들었습니다.",
        "#몽글이 #공감 #5락실 #웹게임"])


# ---------- 몽글이 그림 ----------
def _atlas():
    from PIL import Image
    with Image.open(ATLAS) as im:
        return im.convert("RGBA")


def cell(atlas, pal: str, stage: int, branch: str | None):
    col = 0 if stage == 1 else 1 if stage == 2 else {"power": 2, "wise": 3}.get(branch or "", 4)
    r = PALS.index(pal)
    return atlas.crop((col * 400, r * 420, col * 400 + 400, r * 420 + 420))


def sprite(atlas, pal: str, stage: int, branch: str | None, mood: str, k: float, blink: bool = False):
    """아틀라스 칸 + 얼굴(눈·볼·입). 얼굴 좌표는 mongle-art.js 와 같음 (1단위 = 3px, 기준점 200,395)."""
    from PIL import Image, ImageDraw
    base = cell(atlas, pal, stage, branch)
    im = base.resize((int(400 * k), int(420 * k)), Image.LANCZOS)
    S = 3 * k
    ox, oy = 200 * k, 395 * k
    P = lambda x, y: (ox + x * S, oy + y * S)  # noqa: E731
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for sx in (-1, 1):
        cx, cy = P(sx * 25, -24)
        d.ellipse((cx - 8 * S, cy - 5.5 * S, cx + 8 * S, cy + 5.5 * S), fill=(255, 120, 140, 110))
    im.alpha_composite(ov)
    d = ImageDraw.Draw(im)
    lw = max(2, int(2.6 * S / 3 * 1.2))
    for sx in (-1, 1):
        ex, ey = P(sx * 14, -34)
        if mood == "sleep" or blink:
            d.arc((ex - 6 * S, ey - 8 * S, ex + 6 * S, ey + 4 * S), 30, 150, fill=(58, 42, 42), width=lw)
        else:
            big = 1.25 if mood == "shock" else 1.0
            d.ellipse((ex - 6.4 * S * big, ey - 8.6 * S * big, ex + 6.4 * S * big, ey + 8.6 * S * big), fill=(43, 29, 36))
            d.ellipse((ex - 2 * S - 2.6 * S, ey - 3.4 * S - 2.6 * S, ex - 2 * S + 2.6 * S, ey - 3.4 * S + 2.6 * S), fill="white")
            d.ellipse((ex + 2.4 * S - 1.3 * S, ey + 3.4 * S - 1.3 * S, ex + 2.4 * S + 1.3 * S, ey + 3.4 * S + 1.3 * S),
                      fill=(255, 255, 255, 180))
    mx, my = P(0, -24)
    if mood == "happy":
        d.chord((mx - 6 * S, my - 7 * S, mx + 6 * S, my + 5 * S), 0, 180, fill=(232, 96, 110), outline=(74, 44, 48), width=lw)
    elif mood == "shock":
        d.ellipse((mx - 3.6 * S, my - 3 * S, mx + 3.6 * S, my + 5 * S), fill=(120, 40, 50), outline=(74, 44, 48), width=lw)
    else:
        d.arc((mx - 4.5 * S, my - 4 * S, mx, my + 1.5 * S), 20, 160, fill=(74, 44, 48), width=lw)
        d.arc((mx, my - 4 * S, mx + 4.5 * S, my + 1.5 * S), 20, 160, fill=(74, 44, 48), width=lw)
    return im


# ---------- 춤 (박자 b = 시간/한 박) ----------
def move(style: str, t: float, phase: float = 0.0) -> dict:
    """→ dx, dy(위로 음수), rot(도), sx, sy, flip."""
    b = t / BEAT + phase
    f = b % 1.0
    m = {"dx": 0.0, "dy": 0.0, "rot": 0.0, "sx": 1.0, "sy": 1.0, "flip": False}
    if style == "jump":  # 두 박마다 높이 점프, 착지 때 찌그러짐
        g = (b / 2) % 1.0
        h = math.sin(math.pi * min(1.0, g / 0.7)) if g < 0.7 else 0.0
        m["dy"] = -260 * h
        sq = 0.18 * max(0.0, 1 - abs(g - 0.78) / 0.12) if g >= 0.66 else 0.0
        m["sy"], m["sx"] = 1 - sq + 0.08 * h, 1 + sq - 0.05 * h
        m["rot"] = 8 * math.sin(math.pi * b)
    elif style == "side":  # 박마다 좌우 스텝 + 통통
        m["dx"] = 120 * (1 if int(b) % 2 else -1) * (1 - 0.5 * math.cos(math.pi * f) ** 8)
        m["dy"] = -70 * abs(math.sin(math.pi * f))
        m["rot"] = 12 * (1 if int(b) % 2 else -1)
        m["flip"] = int(b) % 2 == 1
    elif style == "spin":  # 반 박마다 좌우 뒤집기 + 통통
        m["dy"] = -110 * abs(math.sin(math.pi * f))
        m["sx"] = abs(math.cos(math.pi * f)) * 0.85 + 0.15
        m["flip"] = int(b) % 2 == 1
    elif style == "sway":
        m["rot"] = 10 * math.sin(math.pi * b / 2)
        m["dx"] = 30 * math.sin(math.pi * b / 2)
    elif style == "wiggle":
        m["rot"] = 7 * math.sin(math.pi * b * 2)
        m["dy"] = -25 * abs(math.sin(math.pi * b))
    elif style == "sleepy":  # 느리게 꾸벅
        m["rot"] = 6 * math.sin(b * 0.6)
        m["sy"] = 1 - 0.04 * (1 + math.sin(b * 1.2))
    elif style == "melt":  # 점점 녹아내림
        k = min(1.0, t / 3.5)
        m["sy"], m["sx"] = 1 - 0.35 * k, 1 + 0.3 * k
    elif style == "shake":
        m["dx"] = 14 * math.sin(t * 60)
        m["rot"] = 3 * math.sin(t * 47)
    elif style == "panic":  # 정신없이 좌우 왕복
        m["dx"] = 260 * math.sin(math.pi * b)
        m["dy"] = -60 * abs(math.sin(math.pi * b * 4))
        m["flip"] = math.cos(math.pi * b) < 0
        m["rot"] = 10 * math.sin(math.pi * b * 4)
    return m


def place_sprite(img, spr, cx: float, mv: dict) -> None:
    from PIL import Image, ImageDraw
    s = spr.transpose(Image.FLIP_LEFT_RIGHT) if mv["flip"] else spr
    w, h = max(1, int(s.width * mv["sx"])), max(1, int(s.height * mv["sy"]))
    if (w, h) != s.size:
        s = s.resize((w, h), Image.BILINEAR)
    # 그림자 (높이 뛸수록 작게)
    lift = min(1.0, -mv["dy"] / 300)
    sw = spr.width * 0.36 * (1 - 0.4 * lift)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).ellipse((cx + mv["dx"] - sw, FLOOR - sw * 0.16, cx + mv["dx"] + sw, FLOOR + sw * 0.16),
                               fill=(0, 0, 0, int(70 * (1 - 0.5 * lift))))
    img.alpha_composite(ov)
    if mv["rot"]:
        s = s.rotate(mv["rot"], resample=Image.BICUBIC, expand=True)
    foot = 395 / 420  # 기준점(발) 높이 비율
    x = int(cx + mv["dx"] - s.width / 2)
    y = int(FLOOR + mv["dy"] - s.height * (foot if not mv["rot"] else 0.5 + (foot - 0.5) * mv["sy"]))
    _paste_clip(img, s, x, y)


def _paste_clip(img, s, x: int, y: int) -> None:
    l, t = max(0, -x), max(0, -y)
    r, b = min(s.width, W - x), min(s.height, H - y)
    if r > l and b > t:
        img.alpha_composite(s.crop((l, t, r, b)), (x + l, y + t))


# ---------- 배경 ----------
def gradient(top, bot):
    import numpy as np
    from PIL import Image
    y = np.linspace(0, 1, H)[:, None, None]
    arr = (np.array(top)[None, None, :] * (1 - y) + np.array(bot)[None, None, :] * y).repeat(W, axis=1)
    return Image.fromarray(arr.astype("uint8"), "RGB").convert("RGBA")


def stage_bg(scene: dict, seed: int):
    import random
    from PIL import Image, ImageDraw
    img = gradient(*scene["bg"])
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse((-200, FLOOR - 40, W + 200, FLOOR + 420), fill=(255, 255, 255, 40))  # 무대 바닥
    rnd = random.Random(seed)
    for _ in range(26):  # 반짝이 점
        x, y, r = rnd.randrange(W), rnd.randrange(150, FLOOR - 200), rnd.randrange(3, 9)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 70))
    img.alpha_composite(ov)
    return img


def party_fx(img, t: float, seed: int) -> None:
    """파티 장면: 박자마다 번쩍이는 조명 + 떨어지는 색종이."""
    import random
    from PIL import Image, ImageDraw
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    f = (t / BEAT) % 1.0
    a = int(60 * max(0.0, 1 - f * 3))
    if a:
        d.rectangle((0, 0, W, H), fill=(255, 255, 255, a))
    rnd = random.Random(seed)
    cols = [rs.PINK, rs.CYAN, rs.YEL, (160, 255, 140), (255, 160, 60)]
    for _ in range(40):
        x0, sp, sz, c = rnd.randrange(W), rnd.uniform(260, 520), rnd.randrange(12, 24), rnd.choice(cols)
        y = (rnd.uniform(0, H) + t * sp) % (FLOOR + 100) - 60
        x = x0 + 30 * math.sin(t * 3 + x0)
        d.rectangle((x, y, x + sz, y + sz * 0.6), fill=c + (220,))
    img.alpha_composite(ov)


def coins_fx(img, t: float) -> None:
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for i in range(14):
        x = (i * 173) % W
        y = (i * 311 + t * 600) % (FLOOR + 80) - 80
        r = 30
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 210, 63), outline=(200, 140, 20), width=5)
        d.text((x, y), "₩", font=rs.font(34), fill=(200, 140, 20), anchor="mm")


def caption(img, y: int, text: str, size: int, color, k: float = 1.0) -> None:
    from PIL import Image, ImageDraw
    f = rs.font(int(size * k))
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    tw = d.textlength(text, font=f)
    pad = 40
    d.rounded_rectangle((W / 2 - tw / 2 - pad, y - size * 0.8, W / 2 + tw / 2 + pad, y + size * 0.8), 36,
                        fill=(10, 8, 28, 200))
    img.alpha_composite(ov)
    rs.glow_text(img, (W / 2, y), [text], f, int(size * k), color, glow=6)


def cta(t: dict, ep: int, tt: float):
    img = rs.background(23).convert("RGBA")
    rs.glow_text(img, (W / 2, 420), [f"몽글이 공감극장 {ep}화"], rs.font(80), 80, rs.WHITE, glow=10)
    rs.glow_text(img, (W / 2, 620), [t["q"]], rs.font(76), 76, rs.YEL, glow=12)
    rs.glow_text(img, (W / 2, 760), ["댓글로 알려 줘!"], rs.font(60), 60, rs.CYAN, glow=8)
    blink = rs.PINK if int(tt * 3) % 2 == 0 else rs.YEL
    rs.glow_text(img, (W / 2, 1080), ["몽글이 직접 키우기"], rs.font(70), 70, rs.WHITE, glow=8)
    rs.glow_text(img, (W / 2, 1230), ["5raksil.com"], rs.font(120), 120, blink, glow=18)
    rs.glow_text(img, (W / 2, 1400), ["무료 · 설치 없음 · 프로필 링크"], rs.font(52), 52, rs.CYAN, glow=6)
    rs.glow_text(img, (W / 2, 1540), ["다음 화도 보려면 구독"], rs.font(56), 56, rs.PINK, glow=8)  # 2026-11-17 BK: 끝 화면에만
    return img


# ---------- 소리 (직접 만든 비트) ----------
def kick(vol: float = 0.55):
    import numpy as np
    n = int(SR * 0.22)
    tt = np.arange(n) / SR
    f = 120 * np.exp(-tt * 18) + 45
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 14) * vol).astype(np.float32)


def hat(vol: float = 0.08):
    import numpy as np
    n = int(SR * 0.05)
    rng = np.random.default_rng(3)
    return (rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / SR * 80) * vol).astype(np.float32)


def snare(vol: float = 0.22):
    import numpy as np
    n = int(SR * 0.16)
    rng = np.random.default_rng(5)
    tt = np.arange(n) / SR
    return ((rng.uniform(-1, 1, n) * 0.7 + np.sin(2 * np.pi * 190 * tt) * 0.5) * np.exp(-tt * 24) * vol).astype(np.float32)


def music(buf, kind: str, start: float, dur: float, seed: int) -> None:
    party = [523, 659, 784, 1047, 784, 659, 587, 784]
    calm = [262, 330, 392, 330]
    bass = [131, 110, 147, 98]
    nb = int(dur / BEAT + 0.5)
    for i in range(nb):
        t = start + i * BEAT
        if kind == "party":
            rs.place(buf, kick(), t)
            rs.place(buf, hat(), t + BEAT / 2)
            if i % 2 == 1:
                rs.place(buf, snare(), t)
            rs.place(buf, rs.tone(bass[(i // 2 + seed) % 4], BEAT * 0.9, 0.09), t)
            for j in range(2):
                rs.place(buf, rs.tone(party[(i * 2 + j + seed) % len(party)], BEAT * 0.4, 0.05), t + j * BEAT / 2)
        else:
            if i % 2 == 0:
                rs.place(buf, rs.tone(calm[(i // 2 + seed) % 4], BEAT * 1.8, 0.05, "sine"), t)
                rs.place(buf, rs.tone(bass[(i // 2 + seed) % 4] / 2, BEAT * 1.8, 0.05, "sine"), t)


# ---------- 렌더 ----------
def render(day: dt.date, tid: str, ep: int, out_dir: pathlib.Path = rs.OUT) -> dict:
    import wave

    import numpy as np
    t = template(tid)
    rot = day.toordinal() % 4  # 날짜마다 몽글이 색이 바뀜
    atlas = _atlas()
    total = sum(SCENE_D) + CTA_D

    audio = np.zeros(int(SR * total) + SR, dtype=np.float32)
    st = 0.0
    for i, sc in enumerate(t["scenes"]):
        music(audio, sc["music"], st, SCENE_D[i], day.toordinal())
        if i == 1:  # 장면 바뀔 때 '짠'
            rs.place(audio, np.concatenate([rs.tone(784, 0.07, 0.14), rs.tone(1047, 0.07, 0.14), rs.tone(1568, 0.2, 0.14)]), st)
        st += SCENE_D[i]
    rs.place(audio, np.concatenate([rs.tone(1047, 0.1, 0.12), rs.tone(1319, 0.25, 0.12)]), st + 0.1)
    peak = float(np.abs(audio).max() or 1)
    audio = (audio / max(1.0, peak / 0.9))[: int(SR * total)]

    out_dir.mkdir(parents=True, exist_ok=True)
    key = f"{day.isoformat()}-meme-{tid}"
    wav, mp4 = out_dir / f"{key}.wav", out_dir / f"{key}.mp4"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())

    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium",
                           "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest",
                           "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    cache: dict = {}
    t0 = 0.0
    for si, sc in enumerate(t["scenes"]):
        bg = stage_bg(sc, day.toordinal() + si)
        n = len(sc["actors"])
        k = 1.85 if n == 1 else 1.1 if n == 2 else 0.75
        for fi in range(int(SCENE_D[si] * FPS)):
            tt = fi / FPS
            img = bg.copy()
            if sc["music"] == "party":
                party_fx(img, tt, day.toordinal() + si)
            if sc.get("coins"):
                coins_fx(img, tt)
            for ai, (po, stg, br, x, style, mood) in enumerate(sc["actors"]):
                pal = PALS[(rot + po) % 4]
                blink = mood != "sleep" and (tt + ai * 0.7) % 3.1 < 0.12
                ck = (pal, stg, br, mood, blink, k)
                if ck not in cache:
                    cache[ck] = sprite(atlas, pal, stg, br, mood, k, blink)
                place_sprite(img, cache[ck], x * W, move(style, tt, ai * 0.37))
                if mood == "sleep" and style in ("sleepy", "melt"):
                    zz = rs.font(int(60 * k + 20))
                    zy = FLOOR - 300 * k - (tt * 40) % 80
                    rs.glow_text(img, (x * W + 170 * k, zy), ["Z z"], zz, int(60 * k + 20), (220, 220, 255), glow=4)
            pop = 1.0 + 0.12 * max(0.0, 1 - tt * 5)  # 장면 글자 톡 튀어나옴
            caption(img, 560, sc["cap"], 92, rs.WHITE, pop)
            if t0 + tt < 2.6:  # 첫 화면부터 후킹 문구
                caption(img, 330, t["hook"], 100, rs.YEL)
            else:
                rs.glow_text(img, (W / 2, 250), [f"몽글이 공감극장 {ep}화"], rs.font(52), 52, rs.CYAN, glow=6)
            ff.stdin.write(img.convert("RGB").tobytes())
        t0 += SCENE_D[si]
    cards = {}
    for i in range(int(CTA_D * FPS)):
        kk = int(i / FPS * 3) % 2
        if kk not in cards:
            cards[kk] = cta(t, ep, kk / 3).convert("RGB").tobytes()
        ff.stdin.write(cards[kk])
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg 실패")
    wav.unlink()
    from .raksil_ending import append as add_ending  # 2026-11-20 BK: 몽글이 구독·좋아요 엔딩
    total += add_ending(mp4, day)
    meta = {"date": day.isoformat(), "qid": f"meme-{tid}-{day.isoformat()}", "key": key, "file": str(mp4),
            "title": title_of(t, ep), "description": description_of(t, ep), "voiced": False, "hour": HOUR,
            "schedule": True, "category": "24", "game": "mongle", "meme": tid,
            "tags": ["몽글이", "공감", "5락실", "웹게임", "캐릭터", "밈", "shorts"], "seconds": round(total, 1)}
    (out_dir / f"{key}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def check(meta: dict) -> list[str]:
    """업로드 전 검사: 크기·길이, 그리고 장면별 프레임에 몽글이가 실제로 그려졌는지(배경과 다름). 미리보기 저장."""
    import numpy as np
    from PIL import Image
    errs = []
    mp4 = pathlib.Path(meta["file"])
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "stream=width,height:format=duration", "-of", "json", str(mp4)], capture_output=True, text=True)
    try:
        info = json.loads(probe.stdout)
        s = info["streams"][0]
        if (s["width"], s["height"]) != (W, H):
            errs.append(f"영상 크기 {s['width']}x{s['height']}")
        dur = float(info["format"]["duration"])
        if not 8 <= dur <= 60:
            errs.append(f"길이 {dur:.1f}초")
    except (ValueError, KeyError, IndexError):
        errs.append("영상 정보를 못 읽음")
    times = [1.0, SCENE_D[0] - 0.5, SCENE_D[0] + 1.5, sum(SCENE_D) - 0.5, sum(SCENE_D) + 1.0]
    sheet = Image.new("RGB", (W // 4 * len(times), H // 4))
    for j, tt in enumerate(times):
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{tt:.2f}", "-i", str(mp4), "-frames:v", "1",
                              "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        if len(raw) != W * H * 3:
            errs.append(f"{tt:.1f}초 프레임을 못 뽑음")
            continue
        arr = np.frombuffer(raw, np.uint8).reshape(H, W, 3)
        if tt < sum(SCENE_D):  # 캐릭터 자리(안전영역 안)가 밋밋하면 그림이 빠진 것
            area = arr[900:FLOOR, 100:W - 100].astype(np.float32)
            if area.std() < 12:
                errs.append(f"{tt:.1f}초 몽글이가 안 보임")
        sheet.paste(Image.fromarray(arr).resize((W // 4, H // 4)), (j * (W // 4), 0))
    sheet.save(mp4.with_name(mp4.stem + "-check.jpg"), quality=85)
    return errs


def load_log() -> dict:
    return json.loads(rs.LOG.read_text(encoding="utf-8")) if rs.LOG.exists() else {}


def main(argv: list[str]) -> int:
    today = dt.datetime.now(rs.KST).date()
    cmd = argv[1] if len(argv) > 1 else "plan"
    day = dt.date.fromisoformat(argv[2]) if len(argv) > 2 and argv[2] else today
    log = load_log()
    if cmd == "plan":
        tid = plan(day, log)
        print(f"meme {tid}" if tid else "none")
        return 0
    tid = argv[3] if len(argv) > 3 and argv[3] else plan(day, log)
    if not tid:
        print("오늘은 밈 쇼츠 없음")
        return 0
    meta = render(day, tid, episode(log))
    errs = check(meta)
    if errs:
        print("업로드 보류 (화면 검사 실패):\n- " + "\n- ".join(errs))
        return 1
    print("화면 검사 통과")
    return rs.upload_meta(meta) if cmd == "upload" else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
