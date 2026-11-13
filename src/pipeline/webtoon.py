"""삼촌 vs 조카 상황극 — 성인 웹툰풍(그림체 A, 2026-11-13 BK 선택) 움직이는 만화.

표정 그림은 config/webtoon/<u|n>-<표정>.png (Canva AI로 한 번 만든 표정 시트를 자른 것, 매일 재사용).
대사마다 말하는 사람의 표정 컷을 크게, 듣는 사람은 작은 원 안에 반응으로. 확대·흔들림·집중선·효과음.
skit 장면의 lines 형식은 skit.py 와 같다 (u/n 포즈 이름은 아래 표로 바꿔 씀).
"""
from __future__ import annotations

import math
import pathlib
import subprocess

from .skit import GAP, LEAD, TAIL, SKIT_LABEL, buzz, ding, voices

W, H, FPS, SR = 1080, 1920, 30, 44100
INK = (25, 25, 28)
DIR = pathlib.Path("config/webtoon")
U_MAP = {"talk": "talk", "wow": "wow", "point": "point", "think": "think", "thumb": "thumb", "facepalm": "facepalm"}
N_MAP = {"talk": "think", "think": "think", "shock": "shock", "cold": "cold", "happy": "happy", "phone": "phone",
         "guilty": "guilty"}
U_POSES, N_POSES = set(U_MAP), set(N_MAP)
BG_COL = {"room": ((58, 44, 36), (24, 18, 16)), "office": ((40, 52, 66), (16, 20, 28)),
          "store": ((44, 64, 52), (16, 26, 20)), "door": ((62, 48, 40), (26, 20, 18))}


def _font(n):
    from .shorts import font
    return font(n)


def available() -> bool:
    return all((DIR / f"u-{p}.png").exists() for p in set(U_MAP.values())) and \
        all((DIR / f"n-{p}.png").exists() for p in set(N_MAP.values()))


def _backdrop(bg: str):
    from PIL import Image, ImageDraw
    top, bot = BG_COL.get(bg, BG_COL["room"])
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line([0, y, W, y], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    for y in range(0, H, 28):  # 망점
        for x in range((y // 28 % 2) * 14, W, 28):
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=tuple(min(255, c + 14) for c in top))
    return im


def _speed_lines(d, cx, cy, k):
    import random
    rnd = random.Random(7)
    for _ in range(46):
        a = rnd.uniform(0, 2 * math.pi)
        r0, r1 = rnd.uniform(430, 520), rnd.uniform(700, 1100)
        d.line([cx + r0 * math.cos(a), cy + r0 * math.sin(a), cx + r1 * math.cos(a), cy + r1 * math.sin(a)],
               fill=(255, 255, 255, int(150 * k)), width=rnd.randint(3, 8))


def render_part(lines: list[dict], ad: bool, out: pathlib.Path, tmp: pathlib.Path, product_img=None,
                progress=None, bg: str = "room", badge: str | None = None) -> float:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
    from .uncle import write_wav
    from .shorts import fit
    clips = voices(lines)
    starts, t = [], LEAD
    for c in clips:
        starts.append(t)
        t += len(c) / SR + GAP
    total = t + TAIL
    n = int(total * FPS)
    audio = np.zeros(int(total * SR) + SR, dtype=np.float32)
    env = np.zeros(n)
    for c, st in zip(clips, starts):
        a = int(st * SR)
        audio[a:a + len(c)] += c
        for f in range(int(st * FPS), min(n, int((st + len(c) / SR) * FPS) + 1)):
            s0 = int((f / FPS - st) * SR)
            if 0 <= s0 < len(c):
                env[f] = min(1, float(np.sqrt(np.mean(c[s0:s0 + SR // FPS] ** 2))) * 9)

    def add(x, at):
        a = int(at * SR)
        audio[a:a + len(x)] += x[: max(0, len(audio) - a)]

    add(ding(2), 0.0)
    for st, ln in zip(starts, lines):
        if ln.get("sfx") == "buzz":
            add(buzz(), st)
        if ln.get("big"):
            add(ding(1), st + 0.5)
        elif ln.get("sfx") == "ding":
            add(ding(1), st)
    wav = tmp / f"{out.stem}.wav"
    write_wav(audio[: int(total * SR)], wav)

    base = _backdrop(bg)
    PW, PH = 1000, 990  # 큰 컷
    cache = {}

    def art(who, pose):
        name = (U_MAP if who == "u" else N_MAP).get(pose or "talk", "talk" if who == "u" else "think")
        key = (who, name)
        if key not in cache:
            im = Image.open(DIR / f"{who}-{name}.png").convert("RGB")
            cache[key] = im
        return cache[key]

    def circle(im, size):
        im = fit(im, size, size)
        m = Image.new("L", (size, size), 0)
        ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
        return im, m

    card = None
    if product_img is not None:
        card = Image.new("RGB", (380, 380), "white")
        card.paste(fit(product_img, 350, 350), (15, 15))

    def frame(f):
        tt = f / FPS
        i = 0
        for j, st in enumerate(starts):
            if tt >= st - GAP:
                i = j
        ln, st = lines[i], starts[i]
        ds = max(0.0, tt - st)
        who = ln["who"]
        other = "n" if who == "u" else "u"
        im = base.copy()
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        hot = ln.get("sfx") == "buzz" or ln.get("big") or (ln.get(who) in ("wow", "shock"))
        if hot:
            _speed_lines(od, W / 2, 1080, min(1, ds / 0.2))
        im.paste(ov, (0, 0), ov)
        # 큰 컷: 처음 0.18초 펀치 인 + 천천히 확대 + 말할 때 미세 진동
        z = 1.0 + 0.06 * min(1, ds / 1.5) + 0.012 * env[f]
        pop = 1.0 - 0.12 * math.exp(-ds * 14)
        shake = int(10 * math.exp(-ds * 7) * math.sin(ds * 60)) if hot else 0
        src = art(who, ln.get(who))
        sw, sh = src.size
        cw, chh = sw / z, sh / z
        crop = src.crop((int((sw - cw) / 2), int((sh - chh) * 0.35), int((sw + cw) / 2), int((sh - chh) * 0.35 + chh)))
        pw, ph = int(PW * pop), int(PH * pop)
        panel = crop.resize((pw, ph), Image.LANCZOS)
        px, py = (W - pw) // 2 + shake, 640 + (PH - ph) // 2
        sh_ = Image.new("RGBA", (pw + 60, ph + 60), (0, 0, 0, 0))
        ImageDraw.Draw(sh_).rectangle([30, 30, pw + 30, ph + 30], fill=(0, 0, 0, 150))
        im.paste(sh_.filter(ImageFilter.GaussianBlur(14)), (px - 18, py - 10), sh_.filter(ImageFilter.GaussianBlur(14)))
        im.paste(panel, (px, py))
        d = ImageDraw.Draw(im)
        d.rectangle([px - 6, py - 6, px + pw + 6, py + ph + 6], outline=INK, width=12)
        d.rectangle([px - 6, py - 6, px + pw + 6, py + ph + 6], outline="white", width=4)
        # 듣는 사람 반응 (작은 원)
        rc, rm = circle(art(other, ln.get(other)), 250)
        rx, ry = (W - 300, 1530) if who == "u" else (50, 1530)
        d.ellipse([rx - 10, ry - 10, rx + 260, ry + 260], fill="white", outline=INK, width=8)
        im.paste(rc, (rx, ry), rm)
        # 이름표
        tag, col = ("삼촌", (31, 92, 74)) if who == "u" else ("조카", (40, 70, 150))
        d.rounded_rectangle([px + 20, py + 20, px + 190, py + 86], 32, fill=col, outline="white", width=4)
        d.text((px + 105, py + 53), tag, font=_font(40), fill="white", anchor="mm")
        # 상품 카드
        if ln.get("prop") == "product" and card is not None:
            k = min(1, ds / 0.3)
            cx, cy = W - 440, 1040 + int((1 - k) * 160)
            d.rectangle([cx - 8, cy - 8, cx + 388, cy + 388], fill=INK)
            im.paste(card, (cx, cy))
        # 위 막대
        d.rectangle([0, 0, W, 150], fill=(31, 92, 74))
        d.text((W / 2, 50), "돈 줍는 삼촌", font=_font(46), fill="white", anchor="mm")
        d.text((W / 2, 112), "광고 · 알리익스프레스 제휴 링크" if ad else SKIT_LABEL, font=_font(32), fill=(225, 240, 230), anchor="mm")
        # 자막 (말풍선 느낌)
        y = 190
        for row in ln.get("cap", []):
            fo = _font(80)
            wdt = d.textlength(row, font=fo)
            d.rounded_rectangle([(W - wdt) / 2 - 34, y, (W + wdt) / 2 + 34, y + 116], 22, fill="white", outline=INK, width=6)
            d.text((W / 2, y + 58), row, font=fo, fill=INK, anchor="mm")
            y += 132
        pk = min(1, max(0, (ds - 0.45) / 0.25))
        if ln.get("big") and pk > 0:
            fo = _font(int(130 * (0.6 + 0.4 * pk + 0.12 * math.sin(pk * math.pi))))
            wdt = d.textlength(ln["big"], font=fo)
            by = 1250
            d.rounded_rectangle([(W - wdt) / 2 - 40, by, (W + wdt) / 2 + 40, by + 190], 30, fill=(255, 209, 102), outline=INK, width=8)
            d.text((W / 2, by + 95), ln["big"], font=fo, fill=(200, 30, 40), anchor="mm")
            if ln.get("sub"):
                fs = _font(34)
                sw2 = d.textlength(ln["sub"], font=fs)
                d.rounded_rectangle([(W - sw2) / 2 - 18, by + 205, (W + sw2) / 2 + 18, by + 255], 14, fill="white")
                d.text((W / 2, by + 230), ln["sub"], font=fs, fill=(90, 80, 70), anchor="mm")
        elif ln.get("sub") and not ln.get("big"):
            fs = _font(34)
            sw2 = d.textlength(ln["sub"], font=fs)
            d.rounded_rectangle([(W - sw2) / 2 - 18, y, (W + sw2) / 2 + 18, y + 50], 14, fill="white")
            d.text((W / 2, y + 25), ln["sub"], font=fs, fill=(90, 80, 70), anchor="mm")
        if badge and i == 0:  # 첫 장면 = 썸네일·훅
            fo = _font(110)
            wdt = d.textlength(badge, font=fo)
            bx, by = W / 2, 1330 + int(8 * math.sin(tt * 9))
            d.rounded_rectangle([bx - wdt / 2 - 44, by - 88, bx + wdt / 2 + 44, by + 88], 36, fill=(255, 209, 102), outline=INK, width=8)
            d.text((bx, by), badge, font=fo, fill=(200, 30, 40), anchor="mm")
        d.text((W / 2, H - 100), "AI로 그린 가상 인물", font=_font(26), fill=(200, 200, 200), anchor="mm")
        if progress:
            d.rectangle((60, H - 60, 60 + (W - 120) * progress(tt), H - 54), fill="#d6452f")
        return im

    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-crf", "21", "-preset", "veryfast",
                           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", str(SR), "-ac", "1",
                           "-t", f"{total:.2f}", str(out)], stdin=subprocess.PIPE)
    for f in range(n):
        ff.stdin.write(frame(f).tobytes())
    ff.stdin.close()
    if ff.wait():
        raise RuntimeError("ffmpeg 실패")
    return total
