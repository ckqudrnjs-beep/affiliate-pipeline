"""삼촌 vs 조카 만화 상황극 장면 (쇼츠 1080x1920). 캐릭터는 Pillow로 직접 그린다 (AI 인물 아님, 외부 그림 없음).

2026-11-10 상황극 쇼츠(온풍기 vs 담요)가 조회수 1,131로 다른 영상의 10배 → episodes 의 장면 종류 "skit" 으로 재사용.
대본 예:
    {"type": "skit", "lines": [
      {"who": "u", "u": "talk", "n": "cold", "cap": ["온풍기 하루 8시간", "한 달 전기요금은?"], "say": "조카야, ..."},
      {"who": "n", "n": "talk", "cap": ["\\"5천 원?\\""], "say": "음, 오천 원?"},
      {"who": "u", "u": "wow", "n": "shock", "cap": ["땡!"], "big": "약 48,000원", "sub": "1kW · 1kWh 200원", "sfx": "buzz",
       "say": "땡! 약 사만 팔천 원이야."},
      {"who": "u", "u": "point", "cap": ["무릎만 = 담요"], "prop": "product", "say": "..."}]}
포즈: 삼촌 talk/wow/point, 조카 talk/shock/cold/happy. prop: product(상품 사진 카드)/heater. sfx: buzz(오답)/ding(정답).
목소리: 삼촌 = 7번(M2), 조카 = F2 (SKIT_NEPHEW_VOICE). 로컬은 UNCLE_TTS=sherpa (sid 6 / 1).
"""
from __future__ import annotations

import math
import os
import pathlib
import subprocess

W, H, FPS, SR = 1080, 1920, 30, 44100
INK = (43, 43, 43)
SKIN = (243, 201, 160)
U_POSES = {"talk", "wow", "point"}
N_POSES = {"talk", "shock", "cold", "happy"}
GAP, LEAD, TAIL = 0.12, 0.18, 0.5
SKIT_LABEL = "삼촌 vs 조카 상황극"


def _font(n):
    from .shorts import font
    return font(n)


# ---------------- 캐릭터 ----------------
def _arm(d, a, b, col, k):
    d.line([a, b], fill=INK, width=int(46 * k), joint="curve")
    d.line([a, b], fill=col, width=int(34 * k), joint="curve")
    r = 22 * k
    d.ellipse([b[0] - r, b[1] - r, b[0] + r, b[1] + r], fill=SKIN, outline=INK, width=int(5 * k))


def _mouth(d, cx, cy, m, k, tooth=True):
    if m < 0.15:
        d.arc([cx - 30 * k, cy - 18 * k, cx + 30 * k, cy + 12 * k], 20, 160, fill=INK, width=int(6 * k))
        return
    h = (14 + 34 * m) * k
    d.ellipse([cx - 30 * k, cy - h / 2, cx + 30 * k, cy + h / 2], fill=(150, 40, 45), outline=INK, width=int(5 * k))
    d.ellipse([cx - 16 * k, cy + h / 2 - 16 * k, cx + 16 * k, cy + h / 2 - 2 * k], fill=(230, 110, 110))
    if tooth:
        d.rectangle([cx + 4 * k, cy - h / 2 + 3 * k, cx + 14 * k, cy - h / 2 + 15 * k], fill=(244, 196, 48))


def uncle(pose="talk", m=0.0):
    from PIL import Image, ImageDraw
    k = 2
    im = Image.new("RGBA", (600 * k, 900 * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = lambda *xs: [x * k for x in xs]
    navy, vest, green = (50, 60, 90), (183, 155, 99), (31, 92, 74)
    d.rectangle(P(225, 640, 285, 830), fill=navy, outline=INK, width=5 * k)
    d.rectangle(P(315, 640, 375, 830), fill=navy, outline=INK, width=5 * k)
    d.ellipse(P(200, 810, 295, 860), fill=(110, 70, 45), outline=INK, width=5 * k)
    d.ellipse(P(305, 810, 400, 860), fill=(110, 70, 45), outline=INK, width=5 * k)
    L, R = (175, 470), (425, 470)
    if pose == "wow":
        _arm(d, P(*L), P(110, 300), vest, k); _arm(d, P(*R), P(490, 300), vest, k)
    elif pose == "point":
        _arm(d, P(*L), P(140, 650), vest, k); _arm(d, P(*R), P(540, 330), vest, k)
    else:
        _arm(d, P(*L), P(140, 650), vest, k); _arm(d, P(*R), P(470, 560), vest, k)
    d.ellipse(P(150, 410, 450, 710), fill=vest, outline=INK, width=6 * k)
    d.polygon(P(250, 420, 350, 420, 300, 545), fill=(248, 246, 240), outline=INK)
    d.line(P(300, 545, 300, 708), fill=INK, width=5 * k)
    d.rectangle(P(195, 560, 240, 605), fill=(150, 125, 80), outline=INK, width=4 * k)
    d.rectangle(P(360, 560, 405, 605), fill=(150, 125, 80), outline=INK, width=4 * k)
    d.ellipse(P(335, 625, 395, 685), fill=(160, 130, 80), outline=INK, width=4 * k)
    d.text((365 * k, 655 * k), "₩", font=_font(30 * k), fill=INK, anchor="mm")
    if pose == "talk":  # 동전 든 손
        d.ellipse(P(455, 515, 495, 555), fill=(244, 196, 48), outline=INK, width=4 * k)
    for ex in (170, 430):
        d.ellipse(P(ex - 26, 280, ex + 26, 335), fill=SKIN, outline=INK, width=5 * k)
    d.ellipse(P(170, 170, 430, 430), fill=SKIN, outline=INK, width=6 * k)
    d.line(P(300, 140, 312, 118, 296, 98), fill=INK, width=5 * k)
    d.pieslice(P(165, 140, 435, 380), 180, 360, fill=green, outline=INK, width=6 * k)
    d.rounded_rectangle(P(135, 250, 330, 272), 8 * k, fill=(25, 70, 58), outline=INK, width=5 * k)
    d.ellipse(P(278, 178, 322, 222), fill=(244, 196, 48), outline=INK, width=4 * k)
    d.ellipse(P(288, 188, 312, 212), outline=(200, 150, 20), width=3 * k)
    d.polygon(P(212, 285, 282, 278, 282, 296, 212, 300), fill=INK)
    d.polygon(P(318, 278, 388, 285, 388, 300, 318, 296), fill=INK)
    if pose == "wow":
        for ex in (250, 350):
            d.ellipse(P(ex - 20, 300, ex + 20, 340), fill="white", outline=INK, width=4 * k)
            d.ellipse(P(ex - 8, 312, ex + 8, 328), fill=INK)
    else:
        for ex in (250, 350):
            d.ellipse(P(ex - 9, 312, ex + 9, 330), fill=INK)
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for cx in (215, 385):
        od.ellipse(P(cx - 28, 335, cx + 28, 368), fill=(240, 130, 130, 140))
    im.alpha_composite(ov)
    d = ImageDraw.Draw(im)
    for x, y in ((230, 385), (245, 400), (360, 390), (372, 402), (215, 372), (385, 375)):
        d.ellipse(P(x - 3, y - 3, x + 3, y + 3), fill=(190, 140, 110))
    d.ellipse(P(276, 322, 324, 362), fill=(229, 140, 123), outline=INK, width=4 * k)
    d.chord(P(238, 352, 302, 392), 180, 360, fill=INK)
    d.chord(P(298, 352, 362, 392), 180, 360, fill=INK)
    _mouth(d, 300 * k, 395 * k, m, k)
    return im


def nephew(pose="talk", m=0.0):
    from PIL import Image, ImageDraw
    k = 2
    im = Image.new("RGBA", (600 * k, 900 * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = lambda *xs: [x * k for x in xs]
    hood, grey = (93, 169, 233), (120, 124, 132)
    d.rectangle(P(235, 650, 290, 830), fill=grey, outline=INK, width=5 * k)
    d.rectangle(P(310, 650, 365, 830), fill=grey, outline=INK, width=5 * k)
    d.ellipse(P(210, 810, 300, 855), fill="white", outline=INK, width=5 * k)
    d.ellipse(P(300, 810, 390, 855), fill="white", outline=INK, width=5 * k)
    L, R = (185, 480), (415, 480)
    if pose == "shock":
        _arm(d, P(*L), P(215, 360), hood, k); _arm(d, P(*R), P(385, 360), hood, k)
    elif pose == "happy":
        _arm(d, P(*L), P(120, 300), hood, k); _arm(d, P(*R), P(480, 300), hood, k)
    elif pose != "cold":
        _arm(d, P(*L), P(160, 660), hood, k); _arm(d, P(*R), P(440, 660), hood, k)
    d.rounded_rectangle(P(170, 420, 430, 700), 90 * k, fill=hood, outline=INK, width=6 * k)
    d.rounded_rectangle(P(225, 590, 375, 660), 20 * k, fill=(78, 150, 210), outline=INK, width=4 * k)
    d.line(P(275, 440, 270, 520), fill="white", width=5 * k)
    d.line(P(325, 440, 330, 520), fill="white", width=5 * k)
    if pose == "cold":  # 팔짱 (몸 앞)
        _arm(d, P(*R), P(240, 560), hood, k); _arm(d, P(*L), P(360, 560), hood, k)
    for ex in (185, 415):
        d.ellipse(P(ex - 22, 320, ex + 22, 370), fill=SKIN, outline=INK, width=5 * k)
    d.ellipse(P(185, 200, 415, 440), fill=SKIN, outline=INK, width=6 * k)
    d.chord(P(180, 190, 420, 360), 180, 360, fill=(46, 42, 40), outline=INK, width=5 * k)
    d.polygon(P(200, 280, 240, 300, 260, 270, 300, 300, 330, 270, 360, 300, 400, 280, 400, 260, 200, 260), fill=(46, 42, 40))
    d.polygon(P(290, 195, 310, 165, 318, 200), fill=(46, 42, 40))
    big = 24 if pose == "shock" else 19
    for ex in (255, 345):
        if pose == "happy":  # 웃는 눈
            d.arc(P(ex - 20, 300, ex + 20, 335), 200, 340, fill=INK, width=6 * k)
            continue
        d.ellipse(P(ex - big, 315 - big, ex + big, 315 + big), fill="white", outline=INK, width=4 * k)
        d.ellipse(P(ex - 9, 310, ex + 9, 328), fill=INK)
        d.ellipse(P(ex - 3, 312, ex + 3, 318), fill="white")
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    cc = (120, 170, 240, 150) if pose == "cold" else (240, 140, 140, 120)
    for cx in (225, 375):
        od.ellipse(P(cx - 24, 350, cx + 24, 378), fill=cc)
    im.alpha_composite(ov)
    d = ImageDraw.Draw(im)
    _mouth(d, 300 * k, 392 * k, m * 0.85, k * 0.8, tooth=False)
    return im


def heater():
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (260, 330), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 10, 250, 300], 30, fill=(240, 236, 226), outline=INK, width=6)
    d.rounded_rectangle([40, 50, 220, 230], 16, fill=(70, 40, 30), outline=INK, width=4)
    for y in range(70, 220, 26):
        d.line([55, y, 205, y], fill=(255, 140, 40), width=10)
    d.ellipse([110, 248, 150, 288], fill=(200, 60, 50), outline=INK, width=4)
    d.rectangle([60, 300, 90, 325], fill=INK); d.rectangle([170, 300, 200, 325], fill=INK)
    return im


def room():
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (W, H), (246, 236, 214))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 1600, W, H], fill=(196, 160, 118))
    for x in range(0, W, 135):
        d.line([x, 1600, x - 60, H], fill=(178, 142, 100), width=4)
    d.rounded_rectangle([720, 880, 1010, 1130], 14, fill=(205, 228, 245), outline=(150, 120, 90), width=12)
    d.line([865, 880, 865, 1130], fill=(150, 120, 90), width=8)
    return im


# ---------------- 소리 ----------------
def ding(n=1):
    import numpy as np
    t = np.arange(int(SR * 0.5)) / SR
    x = sum(np.sin(2 * math.pi * f * t) * a for f, a in ((1568, 1), (2350, .5), (3136, .3))) * np.exp(-t * 7) * 0.35
    return np.concatenate([x[: int(SR * .09)], x]) if n == 2 else x


def buzz():
    import numpy as np
    t = np.arange(int(SR * 0.28)) / SR
    return np.sign(np.sin(2 * math.pi * 140 * t)) * 0.12 * np.exp(-t * 4)


def voices(lines: list[dict]) -> list:
    """삼촌 7번(M2), 조카 F2. 줄마다 따로."""
    import numpy as np
    from .uncle import resample
    nv = os.environ.get("SKIT_NEPHEW_VOICE", "F2")
    if os.environ.get("UNCLE_TTS") == "sherpa":
        import sherpa_onnx as s
        d = os.environ["SHERPA_DIR"]
        m = s.OfflineTtsSupertonicModelConfig(
            duration_predictor=f"{d}/duration_predictor.int8.onnx", text_encoder=f"{d}/text_encoder.int8.onnx",
            vector_estimator=f"{d}/vector_estimator.int8.onnx", vocoder=f"{d}/vocoder.int8.onnx",
            tts_json=f"{d}/tts.json", unicode_indexer=f"{d}/unicode_indexer.bin", voice_style=f"{d}/voice.bin")
        tts = s.OfflineTts(s.OfflineTtsConfig(model=s.OfflineTtsModelConfig(supertonic=m, num_threads=4)))
        sid_n = int(nv[1]) - 1 + (0 if nv[0] == "F" else 5)
        out = []
        for ln in lines:
            g = s.GenerationConfig()
            u = ln["who"] == "u"
            g.sid, g.num_steps, g.speed, g.extra = (6 if u else sid_n), 24, (1.15 if u else 1.2), {"lang": "ko"}
            a = tts.generate(ln["say"], g)
            out.append(resample(np.array(a.samples, dtype=np.float32), a.sample_rate))
        return out
    from supertonic import TTS
    from .shorts import VOICE
    tts = TTS()
    styles = {"u": tts.get_voice_style(VOICE), "n": tts.get_voice_style(nv)}
    out = []
    for ln in lines:
        u = ln["who"] == "u"
        wav, _ = tts.synthesize(ln["say"], voice_style=styles[ln["who"]], lang="ko", total_steps=32, speed=1.15 if u else 1.2)
        out.append(resample(wav.reshape(-1).astype(np.float32), tts.sample_rate))
    return out


def check_lines(lines) -> list[str]:
    e = []
    if not isinstance(lines, list) or not 2 <= len(lines) <= 8:
        return ["skit lines 2~8줄"]
    for j, ln in enumerate(lines):
        if ln.get("who") not in ("u", "n"):
            e.append(f"skit {j}: who 는 u(삼촌)/n(조카)")
        if not ln.get("say"):
            e.append(f"skit {j}: say 없음")
        elif len(ln["say"]) > 42:
            e.append(f"skit {j}: 한 줄 42자 이하")
        if ln.get("u", "talk") not in U_POSES:
            e.append(f"skit {j}: 삼촌 포즈 {sorted(U_POSES)}")
        if ln.get("n", "talk") not in N_POSES:
            e.append(f"skit {j}: 조카 포즈 {sorted(N_POSES)}")
        if not isinstance(ln.get("cap", []), list) or len(ln.get("cap", [])) > 2:
            e.append(f"skit {j}: cap 은 1~2줄 목록")
        if ln.get("prop") not in (None, "product", "heater"):
            e.append(f"skit {j}: prop 은 product/heater")
        if ln.get("sfx") not in (None, "buzz", "ding"):
            e.append(f"skit {j}: sfx 는 buzz/ding")
    return e


# ---------------- 그림 ----------------
def render_part(lines: list[dict], ad: bool, out: pathlib.Path, tmp: pathlib.Path, product_img=None,
                progress=None) -> float:
    """상황극 한 덩어리를 out(mp4, 소리 포함)으로. 길이(초)를 돌려준다. progress(t)->0~1 이면 아래 진행 막대."""
    import numpy as np
    from PIL import Image, ImageDraw
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
    env = {"u": np.zeros(n), "n": np.zeros(n)}
    for c, st, ln in zip(clips, starts, lines):
        a = int(st * SR)
        audio[a:a + len(c)] += c
        for f in range(int(st * FPS), min(n, int((st + len(c) / SR) * FPS) + 1)):
            s0 = int((f / FPS - st) * SR)
            if 0 <= s0 < len(c):
                env[ln["who"]][f] = min(1, float(np.sqrt(np.mean(c[s0:s0 + SR // FPS] ** 2))) * 9)

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

    base = room()
    heat = heater()
    card = None
    if product_img is not None:
        card = Image.new("RGB", (420, 420), "white")
        card.paste(fit(product_img, 380, 380), (20, 20))
        mask = Image.new("L", card.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, 419, 419), 36, fill=255)
        card = (card, mask)
    cache = {}

    def spr(kind, pose, m):
        key = (kind, pose, round(m * 4) / 4)
        if key not in cache:
            im = uncle(pose, key[2]) if kind == "u" else nephew(pose, key[2])
            cache[key] = im.resize((750, 1125), Image.LANCZOS)
        return cache[key]

    def scene_at(tt):
        i = 0
        for j, st in enumerate(starts):
            if tt >= st - GAP:
                i = j
        return i

    def frame(f):
        tt = f / FPS
        i = scene_at(tt)
        ln = lines[i]
        im = base.copy()
        prop = ln.get("prop")
        if prop == "heater":
            im.paste(heat, (410, 1500), heat)
        u = spr("u", ln.get("u", "talk"), env["u"][f])
        nn = spr("n", ln.get("n", "talk"), env["n"][f])
        shake = int(4 * math.sin(tt * 60)) if ln.get("n") == "cold" else 0
        im.paste(u, (-120, 745), u)
        im.paste(nn, (430 + shake, 735), nn)
        if prop == "product" and card:
            k = min(1, max(0, (tt - starts[i]) / 0.3))
            im.paste(card[0], (330, 1100 + int((1 - k) * 120)), card[1])
        st = starts[i]
        z = 1.0 + 0.12 * min(1, max(0, (tt - st) / 1.2))
        if ln.get("sfx") == "buzz" or ln.get("big"):
            z += 0.05 * math.exp(-max(0, tt - st) * 6) * math.sin(max(0, tt - st) * 70)
        cx = 300 if ln["who"] == "u" else 800
        if prop == "product":
            cx = 540
        cw, ch = W / z, H / z
        x0 = min(max(0, cx - cw / 2), W - cw)
        y0 = min(max(0, 1350 - ch / 2 - 200), H - ch)
        im = im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), Image.BILINEAR)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, W, 150], fill=(31, 92, 74))
        d.text((W / 2, 50), "돈 줍는 삼촌", font=_font(46), fill="white", anchor="mm")
        d.text((W / 2, 112), "광고 · 알리익스프레스 제휴 링크" if ad else SKIT_LABEL, font=_font(32), fill=(225, 240, 230), anchor="mm")
        y = 300
        for row in ln.get("cap", []):
            fo = _font(84)
            wdt = d.textlength(row, font=fo)
            d.rounded_rectangle([(W - wdt) / 2 - 30, y - 12, (W + wdt) / 2 + 30, y + 108], 24, fill="white")
            d.text((W / 2, y + 48), row, font=fo, fill=INK, anchor="mm")
            y += 128
        pop = min(1, max(0, (tt - st - 0.45) / 0.25))
        if ln.get("big") and pop > 0:
            fo = _font(int(120 * (0.6 + 0.4 * pop + 0.12 * math.sin(pop * math.pi))))
            wdt = d.textlength(ln["big"], font=fo)
            d.rounded_rectangle([(W - wdt) / 2 - 36, y + 4, (W + wdt) / 2 + 36, y + 180], 30, fill=(255, 209, 102), outline=INK, width=6)
            d.text((W / 2, y + 92), ln["big"], font=fo, fill=(200, 30, 40), anchor="mm")
            y += 195
        if ln.get("sub") and (pop > 0 or not ln.get("big")):
            fo = _font(34)
            wdt = d.textlength(ln["sub"], font=fo)
            d.rounded_rectangle([(W - wdt) / 2 - 18, y, (W + wdt) / 2 + 18, y + 50], 14, fill="white")
            d.text((W / 2, y + 25), ln["sub"], font=fo, fill=(110, 100, 90), anchor="mm")
        tag = "삼촌" if ln["who"] == "u" else "조카"
        d.rounded_rectangle([40, 190, 200, 250], 30, fill=(31, 92, 74) if ln["who"] == "u" else (93, 169, 233))
        d.text((120, 220), tag, font=_font(38), fill="white", anchor="mm")
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
