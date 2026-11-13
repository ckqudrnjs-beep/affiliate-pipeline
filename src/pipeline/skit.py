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
U_POSES = {"talk", "wow", "point", "think", "thumb", "facepalm"}
N_POSES = {"talk", "shock", "cold", "happy", "think", "phone", "guilty"}  # phone·guilty 는 웹툰 그림체 전용
BGS = {"room", "office", "store", "door"}
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


def _shade(im):
    """입체감: 오른쪽 아래로 갈수록 살짝 어둡게, 왼쪽 위는 살짝 밝게 (그림 안쪽만)."""
    from PIL import Image, ImageChops
    a = im.split()[3]
    gx = Image.linear_gradient("L").rotate(90, expand=True).transpose(Image.FLIP_LEFT_RIGHT).resize(im.size)
    gy = Image.linear_gradient("L").resize(im.size)
    g = ImageChops.add(gx.point(lambda v: v * 0.55), gy.point(lambda v: v * 0.45))
    dark = Image.new("RGBA", im.size, (40, 25, 30, 0))
    dark.putalpha(ImageChops.multiply(g.point(lambda v: max(0, v - 110) * 0.45), a))
    light = Image.new("RGBA", im.size, (255, 250, 235, 0))
    light.putalpha(ImageChops.multiply(g.point(lambda v: max(0, 90 - v) * 0.5), a))
    im.alpha_composite(dark)
    im.alpha_composite(light)
    return im


def _hand(d, x, y, k, thumb=False):
    r = 24 * k
    d.ellipse([x - r, y - r, x + r, y + r], fill=SKIN, outline=INK, width=int(5 * k))
    if thumb:
        d.rounded_rectangle([x - 9 * k, y - 58 * k, x + 9 * k, y - 14 * k], 9 * k, fill=SKIN, outline=INK, width=int(5 * k))


def _eyes(d, P, k, xs, y, blink, wide=False, r=9):
    for ex in xs:
        if blink:
            d.line(P(ex - 14, y + 9, ex + 14, y + 9), fill=INK, width=6 * k)
        elif wide:
            d.ellipse(P(ex - 20, y - 12, ex + 20, y + 28), fill="white", outline=INK, width=4 * k)
            d.ellipse(P(ex - 8, y, ex + 8, y + 16), fill=INK)
            d.ellipse(P(ex - 3, y + 2, ex + 2, y + 7), fill="white")
        else:
            d.ellipse(P(ex - r, y, ex + r, y + 2 * r), fill=INK)
            d.ellipse(P(ex - 4, y + 3, ex, y + 7), fill="white")


HEAD = 1.22  # 머리 크게 (귀여운 비율)


def _big_head(body, head, k, neck_y):
    """머리 층을 목 기준으로 HEAD 배 키워 몸 위에 얹는다."""
    from PIL import Image
    w, h = head.size
    hs = head.resize((int(w * HEAD), int(h * HEAD)), Image.LANCZOS)
    body.alpha_composite(hs, (int(300 * k - 300 * k * HEAD), int(neck_y * k - neck_y * k * HEAD)))
    return body


def uncle(pose="talk", m=0.0, blink=False):
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
        _arm(d, P(*L), P(70, 290), vest, k); _arm(d, P(*R), P(530, 290), vest, k)
    elif pose == "point":
        _arm(d, P(*L), P(140, 650), vest, k); _arm(d, P(*R), P(540, 330), vest, k)
    elif pose == "thumb":
        _arm(d, P(*L), P(140, 650), vest, k); _arm(d, P(*R), P(500, 360), vest, k)
    elif pose == "think":
        _arm(d, P(*L), P(140, 650), vest, k); _arm(d, P(*R), P(400, 440), vest, k)
    elif pose == "facepalm":
        _arm(d, P(*L), P(140, 650), vest, k); _arm(d, P(*R), P(330, 300), vest, k)
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
    body = im
    im = Image.new("RGBA", body.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
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
    _eyes(d, P, k, (250, 350), 312, blink or pose == "facepalm", wide=pose == "wow")
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
    im = _big_head(body, im, k, 430)
    d = ImageDraw.Draw(im)
    if pose == "thumb":
        _hand(d, 500 * k, 360 * k, k, thumb=True)
    elif pose == "think":
        _hand(d, 330 * k, 440 * k, k)
    elif pose == "facepalm":
        _hand(d, 300 * k, 255 * k, k * 1.3)
    return _shade(im)


def nephew(pose="talk", m=0.0, blink=False):
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
        _arm(d, P(*L), P(190, 400), hood, k); _arm(d, P(*R), P(410, 400), hood, k)
    elif pose == "happy":
        _arm(d, P(*L), P(85, 280), hood, k); _arm(d, P(*R), P(515, 280), hood, k)
    elif pose == "think":
        _arm(d, P(*L), P(160, 660), hood, k); _arm(d, P(*R), P(330, 450), hood, k)
    elif pose != "cold":
        _arm(d, P(*L), P(160, 660), hood, k); _arm(d, P(*R), P(440, 660), hood, k)
    d.rounded_rectangle(P(170, 420, 430, 700), 90 * k, fill=hood, outline=INK, width=6 * k)
    d.rounded_rectangle(P(225, 590, 375, 660), 20 * k, fill=(78, 150, 210), outline=INK, width=4 * k)
    d.line(P(275, 440, 270, 520), fill="white", width=5 * k)
    d.line(P(325, 440, 330, 520), fill="white", width=5 * k)
    if pose == "cold":  # 팔짱 (몸 앞)
        _arm(d, P(*R), P(240, 560), hood, k); _arm(d, P(*L), P(360, 560), hood, k)
    body = im
    im = Image.new("RGBA", body.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for ex in (185, 415):
        d.ellipse(P(ex - 22, 320, ex + 22, 370), fill=SKIN, outline=INK, width=5 * k)
    d.ellipse(P(185, 200, 415, 440), fill=SKIN, outline=INK, width=6 * k)
    d.chord(P(180, 190, 420, 360), 180, 360, fill=(46, 42, 40), outline=INK, width=5 * k)
    d.polygon(P(200, 280, 240, 300, 260, 270, 300, 300, 330, 270, 360, 300, 400, 280, 400, 260, 200, 260), fill=(46, 42, 40))
    d.polygon(P(290, 195, 310, 165, 318, 200), fill=(46, 42, 40))
    big = 24 if pose == "shock" else 19
    for ex in (255, 345):
        if pose == "happy" or blink:  # 웃는 눈 / 깜빡임
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
    d.arc(P(290, 340, 310, 362), 20, 160, fill=INK, width=4 * k)  # 코
    _mouth(d, 300 * k, 392 * k, m * 0.85, k * 0.8, tooth=False)
    im = _big_head(body, im, k, 440)
    d = ImageDraw.Draw(im)
    if pose == "think":
        _hand(d, 330 * k, 455 * k, k)
    elif pose == "shock":
        _hand(d, 175 * k, 390 * k, k); _hand(d, 425 * k, 390 * k, k)
    return _shade(im)


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


def _wall(d, top, bottom):
    for y in range(0, 1600):
        t = y / 1600
        d.line([0, y, W, y], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))


def _floor(d, col, line):
    d.rectangle([0, 1600, W, H], fill=col)
    for x in range(-200, W + 200, 135):
        d.line([x, 1600, x - 90, H], fill=line, width=4)
    d.rectangle([0, 1580, W, 1606], fill=tuple(max(0, c - 40) for c in col))


def room():
    """거실: 창문·액자·화분·스탠드."""
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    _wall(d, (250, 242, 224), (236, 222, 196))
    _floor(d, (196, 160, 118), (178, 142, 100))
    d.rounded_rectangle([700, 860, 1020, 1150], 16, fill=(205, 228, 245), outline=(150, 120, 90), width=14)
    d.line([860, 860, 860, 1150], fill=(150, 120, 90), width=10)
    d.line([700, 1005, 1020, 1005], fill=(150, 120, 90), width=10)
    d.ellipse([740, 900, 830, 950], fill="white")
    d.rectangle([90, 880, 330, 1060], fill=(244, 196, 48), outline=(120, 90, 60), width=10)
    d.polygon([(130, 1030), (200, 940), (250, 990), (300, 930), (300, 1030)], fill=(31, 92, 74))
    d.rounded_rectangle([950, 1440, 1050, 1600], 14, fill=(200, 110, 70), outline=INK, width=5)
    for dx, dy in ((-60, -120), (0, -170), (60, -120), (-30, -60), (40, -70)):
        d.ellipse([1000 + dx - 45, 1440 + dy - 45, 1000 + dx + 45, 1440 + dy + 45], fill=(70, 150, 90), outline=INK, width=4)
    return im


def office():
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    _wall(d, (232, 238, 242), (210, 220, 228))
    _floor(d, (150, 156, 166), (135, 140, 150))
    for x in range(60, W, 260):
        d.rectangle([x, 820, x + 200, 1180], fill=(190, 215, 235), outline=(120, 130, 140), width=8)
    d.rectangle([0, 1380, W, 1420], fill=(170, 130, 90))
    d.rounded_rectangle([640, 1150, 960, 1360], 14, fill=(40, 44, 52), outline=INK, width=6)
    d.rectangle([660, 1170, 940, 1340], fill=(90, 160, 220))
    d.rectangle([780, 1360, 820, 1380], fill=INK)
    return im


def store():
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    _wall(d, (250, 250, 246), (236, 236, 230))
    _floor(d, (220, 220, 214), (200, 200, 194))
    cols = [(230, 80, 70), (250, 190, 60), (80, 160, 220), (90, 180, 110), (240, 140, 60)]
    for row, y in enumerate((860, 1060, 1260)):
        d.rectangle([40, y + 150, W - 40, y + 170], fill=(150, 150, 150))
        for j, x in enumerate(range(60, W - 80, 95)):
            d.rounded_rectangle([x, y + 40, x + 75, y + 150], 10, fill=cols[(j + row) % 5], outline=INK, width=4)
    d.rectangle([0, 760, W, 820], fill=(31, 92, 74))
    d.text((W / 2, 790), "SALE", font=_font(44), fill="white", anchor="mm")
    return im


def door():
    """현관: 문 + 택배 상자."""
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    _wall(d, (238, 230, 214), (222, 210, 188))
    _floor(d, (170, 150, 130), (150, 130, 110))
    d.rectangle([380, 780, 720, 1600], fill=(120, 80, 50), outline=INK, width=10)
    d.ellipse([660, 1180, 690, 1210], fill=(244, 196, 48), outline=INK, width=4)
    for x, y, w_, h_ in ((60, 1460, 220, 150), (110, 1340, 150, 120), (840, 1480, 190, 130)):
        d.rectangle([x, y, x + w_, y + h_], fill=(196, 150, 100), outline=INK, width=6)
        d.rectangle([x + w_ / 2 - 15, y, x + w_ / 2 + 15, y + h_], fill=(220, 190, 140))
    return im


BACKGROUNDS = {"room": room, "office": office, "store": store, "door": door}


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
                progress=None, bg: str = "room", badge: str | None = None) -> float:
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

    from PIL import ImageFilter
    base = BACKGROUNDS.get(bg, room)()
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([90, 1790, 420, 1850], fill=(0, 0, 0, 70))
    ImageDraw.Draw(sh).ellipse([650, 1785, 960, 1845], fill=(0, 0, 0, 70))
    base = Image.alpha_composite(base.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(8))).convert("RGB")
    heat = heater()
    card = None
    if product_img is not None:
        card = Image.new("RGB", (420, 420), "white")
        card.paste(fit(product_img, 380, 380), (20, 20))
        mask = Image.new("L", card.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, 419, 419), 36, fill=255)
        card = (card, mask)
    cache = {}

    def spr(kind, pose, m, blink=False):
        key = (kind, pose, round(m * 4) / 4, blink)
        if key not in cache:
            im = uncle(pose, key[2], blink) if kind == "u" else nephew(pose, key[2], blink)
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
        u = spr("u", ln.get("u", "talk"), env["u"][f], (tt % 3.1) < 0.12)
        nn = spr("n", ln.get("n", "talk"), env["n"][f], ((tt + 1.3) % 2.7) < 0.12)
        shake = int(4 * math.sin(tt * 60)) if ln.get("n") == "cold" else 0
        ds = tt - starts[i]
        hop = int(36 * math.sin(math.pi * ds / 0.28)) if 0 <= ds < 0.28 else 0
        bob_u = int(10 * env["u"][f]) + (hop if ln["who"] == "u" else 0)
        bob_n = int(10 * env["n"][f]) + (hop if ln["who"] == "n" else 0)
        im.paste(u, (-120, 745 - bob_u), u)
        im.paste(nn, (430 + shake, 735 - bob_n), nn)
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
        if badge and i == 0:  # 첫 장면 = 썸네일·훅: 노란 물음표 배지 (0초부터 보임)
            fo = _font(110)
            wdt = d.textlength(badge, font=fo)
            bx, by = W / 2, y + 110 + int(8 * math.sin(tt * 9))
            d.rounded_rectangle([bx - wdt / 2 - 40, by - 85, bx + wdt / 2 + 40, by + 85], 36, fill=(255, 209, 102), outline=INK, width=7)
            d.text((bx, by), badge, font=fo, fill=(200, 30, 40), anchor="mm")
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
