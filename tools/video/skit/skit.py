"""삼촌 vs 조카 상황극 쇼츠 (1080x1920). 캐릭터는 Pillow로 직접 그림 (외부 그림 없음)."""
import json, math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = sys.argv[1]
OUT = sys.argv[2]
W, H, FPS = 1080, 1920, 30
FONT = S + "/font/package/dist/public/static/Pretendard-{}.otf"
INK = (43, 43, 43)
SKIN = (243, 201, 160)


def font(sz, w="ExtraBold"):
    return ImageFont.truetype(FONT.format(w), sz)


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
    k = 2
    im = Image.new("RGBA", (600 * k, 900 * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = lambda *xs: [x * k for x in xs]
    navy, vest, green = (50, 60, 90), (183, 155, 99), (31, 92, 74)
    # 다리·신발
    d.rectangle(P(225, 640, 285, 830), fill=navy, outline=INK, width=5 * k)
    d.rectangle(P(315, 640, 375, 830), fill=navy, outline=INK, width=5 * k)
    d.ellipse(P(200, 810, 295, 860), fill=(110, 70, 45), outline=INK, width=5 * k)
    d.ellipse(P(305, 810, 400, 860), fill=(110, 70, 45), outline=INK, width=5 * k)
    # 팔 (몸 뒤)
    L, R = (175, 470), (425, 470)
    if pose == "wow":
        _arm(d, P(*L), P(110, 300), vest, k); _arm(d, P(*R), P(490, 300), vest, k)
    elif pose == "point":
        _arm(d, P(*L), P(140, 650), vest, k); _arm(d, P(*R), P(540, 330), vest, k)
    else:
        _arm(d, P(*L), P(140, 650), vest, k); _arm(d, P(*R), P(470, 560), vest, k)
    # 조끼
    d.ellipse(P(150, 410, 450, 710), fill=vest, outline=INK, width=6 * k)
    d.polygon(P(250, 420, 350, 420, 300, 545), fill=(248, 246, 240), outline=INK)
    d.line(P(300, 545, 300, 708), fill=INK, width=5 * k)
    d.rectangle(P(195, 560, 240, 605), fill=(150, 125, 80), outline=INK, width=4 * k)
    d.rectangle(P(360, 560, 405, 605), fill=(150, 125, 80), outline=INK, width=4 * k)
    d.ellipse(P(335, 625, 395, 685), fill=(160, 130, 80), outline=INK, width=4 * k)
    d.text((365 * k, 655 * k), "₩", font=font(30 * k), fill=INK, anchor="mm")
    if pose == "talk":  # 동전 든 손
        d.ellipse(P(455, 515, 495, 555), fill=(244, 196, 48), outline=INK, width=4 * k)
    # 머리
    for ex in (170, 430):
        d.ellipse(P(ex - 26, 280, ex + 26, 335), fill=SKIN, outline=INK, width=5 * k)
    d.ellipse(P(170, 170, 430, 430), fill=SKIN, outline=INK, width=6 * k)
    # 모자
    d.line(P(300, 140, 312, 118, 296, 98), fill=INK, width=5 * k)
    d.pieslice(P(165, 140, 435, 380), 180, 360, fill=green, outline=INK, width=6 * k)
    d.rounded_rectangle(P(135, 250, 330, 272), 8 * k, fill=(25, 70, 58), outline=INK, width=5 * k)
    d.ellipse(P(278, 178, 322, 222), fill=(244, 196, 48), outline=INK, width=4 * k)
    d.ellipse(P(288, 188, 312, 212), outline=(200, 150, 20), width=3 * k)
    # 눈썹·눈
    d.polygon(P(212, 285, 282, 278, 282, 296, 212, 300), fill=INK)
    d.polygon(P(318, 278, 388, 285, 388, 300, 318, 296), fill=INK)
    if pose == "wow":
        for ex in (250, 350):
            d.ellipse(P(ex - 20, 300, ex + 20, 340), fill="white", outline=INK, width=4 * k)
            d.ellipse(P(ex - 8, 312, ex + 8, 328), fill=INK)
    else:
        for ex in (250, 350):
            d.ellipse(P(ex - 9, 312, ex + 9, 330), fill=INK)
    # 볼·코·수염
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
    return im.resize((600, 900), Image.LANCZOS)


def nephew(pose="talk", m=0.0, blanket=False):
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
    elif pose == "cold":
        _arm(d, P(*L), P(360, 560), hood, k); _arm(d, P(*R), P(240, 560), hood, k)
    else:
        _arm(d, P(*L), P(160, 660), hood, k); _arm(d, P(*R), P(440, 660), hood, k)
    d.rounded_rectangle(P(170, 420, 430, 700), 90 * k, fill=hood, outline=INK, width=6 * k)
    d.rounded_rectangle(P(225, 590, 375, 660), 20 * k, fill=(78, 150, 210), outline=INK, width=4 * k)
    d.line(P(275, 440, 270, 520), fill="white", width=5 * k)
    d.line(P(325, 440, 330, 520), fill="white", width=5 * k)
    if pose == "cold":
        _arm(d, P(*R), P(240, 560), hood, k); _arm(d, P(*L), P(360, 560), hood, k)
    if blanket:
        d.rounded_rectangle(P(150, 600, 450, 790), 30 * k, fill=(95, 98, 108), outline=INK, width=6 * k)
        for y in (650, 700, 750):
            d.line(P(165, y, 435, y), fill=(120, 124, 135), width=4 * k)
        d.rounded_rectangle(P(280, 615, 320, 645), 6 * k, fill=(30, 30, 30))
    # 머리
    for ex in (185, 415):
        d.ellipse(P(ex - 22, 320, ex + 22, 370), fill=SKIN, outline=INK, width=5 * k)
    d.ellipse(P(185, 200, 415, 440), fill=SKIN, outline=INK, width=6 * k)
    d.chord(P(180, 190, 420, 360), 180, 360, fill=(46, 42, 40), outline=INK, width=5 * k)
    d.polygon(P(200, 280, 240, 300, 260, 270, 300, 300, 330, 270, 360, 300, 400, 280, 400, 260, 200, 260), fill=(46, 42, 40))
    d.polygon(P(290, 195, 310, 165, 318, 200), fill=(46, 42, 40))
    big = 24 if pose == "shock" else 19
    for ex in (255, 345):
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
    return im.resize((600, 900), Image.LANCZOS)


def heater():
    im = Image.new("RGBA", (260, 330), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 10, 250, 300], 30, fill=(240, 236, 226), outline=INK, width=6)
    d.rounded_rectangle([40, 50, 220, 230], 16, fill=(70, 40, 30), outline=INK, width=4)
    for y in range(70, 220, 26):
        d.line([55, y, 205, y], fill=(255, 140, 40), width=10)
    d.ellipse([110, 248, 150, 288], fill=(200, 60, 50), outline=INK, width=4)
    d.rectangle([60, 300, 90, 325], fill=INK); d.rectangle([170, 300, 200, 325], fill=INK)
    return im


# ---------------- 소리 ----------------
SR = 44100


def load(p):
    with wave.open(p) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    if sr != SR:
        x = np.interp(np.arange(0, len(x) * SR / sr) * sr / SR, np.arange(len(x)), x)
    return x


def ding(n=1):
    t = np.arange(int(SR * 0.5)) / SR
    x = sum(np.sin(2 * math.pi * f * t) * a for f, a in ((1568, 1), (2350, .5), (3136, .3))) * np.exp(-t * 7) * 0.35
    if n == 2:
        x = np.concatenate([x[: int(SR * .09)], x])
    return x


def buzz():
    t = np.arange(int(SR * 0.28)) / SR
    return np.sign(np.sin(2 * math.pi * 140 * t)) * 0.12 * np.exp(-t * 4)


# ---------------- 대본 ----------------
SCRIPT = [  # who, pose_u, pose_n, caption(줄 목록), 강조 숫자, sub
    ("u", "talk", "cold", ["온풍기 하루 8시간", "한 달 전기요금은?"], None, None),
    ("n", "talk", "talk", ["\"5천 원?\""], None, None),
    ("u", "wow", "shock", ["땡!"], "약 48,000원", "1kW 온풍기 · 1kWh 약 200원"),
    ("n", "wow", "shock", ["헐, 그럼 어떡해?"], None, None),
    ("u", "point", "talk", ["발만 시리면 USB 담요", "(최대 10W)"], "한 달 약 480원", "10W 기준 · 같은 요금"),
    ("u", "talk", "talk", ["방 전체 = 온풍기", "무릎만 = 담요"], None, None),
]
GAP = 0.12
LEAD = 0.18

clips = [load(f"{S}/v/l{i}.wav") for i in range(len(SCRIPT))]
starts, t = [], LEAD
for c in clips:
    starts.append(t); t += len(c) / SR + GAP
END_CARD = starts[5] + 1.2  # 마지막 대사 중간부터 상품 카드
TOTAL = t + 0.5
N = int(TOTAL * FPS)

audio = np.zeros(int(TOTAL * SR) + SR)
voice_env = {"u": np.zeros(N), "n": np.zeros(N)}
for i, (c, st) in enumerate(zip(clips, starts)):
    a = int(st * SR); audio[a:a + len(c)] += c
    who = SCRIPT[i][0]
    for f in range(N):
        s0 = int((f / FPS - st) * SR)
        if 0 <= s0 < len(c):
            seg = c[s0:s0 + SR // FPS]
            voice_env[who][f] = min(1, float(np.sqrt(np.mean(seg ** 2))) * 9)


def add(x, at):
    a = int(at * SR); audio[a:a + len(x)] += x[: len(audio) - a]


add(ding(2), 0.0)
add(buzz(), starts[2])
add(ding(1), starts[2] + 0.55)
add(ding(1), starts[4] + 2.6)
add(ding(2), END_CARD)
audio = np.clip(audio[: int(TOTAL * SR)], -1, 1)
with wave.open(f"{S}/mix.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((audio * 32767).astype(np.int16).tobytes())

# ---------------- 그림 ----------------
SPR = {}


def spr(kind, pose, m, bl=False):
    key = (kind, pose, round(m * 4) / 4, bl)
    if key not in SPR:
        im = uncle(pose, key[2]) if kind == "u" else nephew(pose, key[2], bl)
        SPR[key] = im.resize((750, 1125), Image.LANCZOS)
    return SPR[key]


HEAT = heater()
BLANKET = Image.open("/home/user/affiliate-pipeline/video_assets/usb-heated-lap-blanket/cutout.png").convert("RGBA")


def room():
    im = Image.new("RGB", (W, H), (246, 236, 214))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 1600, W, H], fill=(196, 160, 118))
    for x in range(0, W, 135):
        d.line([x, 1600, x - 60, H], fill=(178, 142, 100), width=4)
    d.rounded_rectangle([720, 880, 1010, 1130], 14, fill=(205, 228, 245), outline=(150, 120, 90), width=12)
    d.line([865, 880, 865, 1130], fill=(150, 120, 90), width=8)
    for x, y in ((740, 950), (900, 1000), (960, 940), (780, 1100), (930, 1120)):
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill="white")
    return im


ROOM = room()


def scene_index(tt):
    i = 0
    for j, st in enumerate(starts):
        if tt >= st - GAP:
            i = j
    return i


def caption(d, lines, big, sub, pop):
    y = 330
    for ln in lines:
        f = font(92)
        wdt = d.textlength(ln, font=f)
        d.rounded_rectangle([(W - wdt) / 2 - 30, y - 12, (W + wdt) / 2 + 30, y + 112], 24, fill=(255, 255, 255))
        d.text((W / 2, y + 50), ln, font=f, fill=INK, anchor="mm")
        y += 132
    if big:
        sz = int(130 * (0.6 + 0.4 * pop + 0.12 * math.sin(pop * math.pi)))
        f = font(sz, "Black")
        wdt = d.textlength(big, font=f)
        d.rounded_rectangle([(W - wdt) / 2 - 36, y + 4, (W + wdt) / 2 + 36, y + 190], 30, fill=(255, 209, 102), outline=INK, width=6)
        d.text((W / 2, y + 97), big, font=f, fill=(200, 30, 40), anchor="mm")
        y += 205
    if sub:
        f = font(36, "SemiBold"); wdt = d.textlength(sub, font=f)
        d.rounded_rectangle([(W - wdt) / 2 - 18, y, (W + wdt) / 2 + 18, y + 50], 14, fill=(255, 255, 255))
        d.text((W / 2, y + 25), sub, font=f, fill=(110, 100, 90), anchor="mm")


def top_label(d):
    d.rectangle([0, 0, W, 210], fill=(31, 92, 74))
    d.text((W / 2, 92), "돈 줍는 삼촌", font=font(58, "Black"), fill="white", anchor="mm")
    d.text((W / 2, 162), "광고 · 알리익스프레스 제휴 링크 포함", font=font(34, "SemiBold"), fill=(225, 240, 230), anchor="mm")


def end_card(tt):
    p = min(1, (tt - END_CARD) / 0.35)
    im = Image.new("RGB", (W, H), (24, 60, 50))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([70, 290, 1010, 960], 40, fill=(250, 248, 242))
    b = BLANKET.copy(); b.thumbnail((820, 560))
    im.paste(b, ((W - b.width) // 2, 330 + int((1 - p) * 80)), b)
    d.text((W / 2, 1030), "USB 1인용 전기 온열 담요", font=font(60), fill="white", anchor="mm")
    d.text((W / 2, 1135), "21,450원", font=font(110, "Black"), fill=(255, 209, 102), anchor="mm")
    d.text((W / 2, 1222), "11월 9일 기준 알리익스프레스 가격", font=font(36, "Medium"), fill=(200, 220, 210), anchor="mm")
    d.text((W / 2, 1320), "계산·링크는 don3chon.com", font=font(62), fill="white", anchor="mm")
    d.text((W / 2, 1395), "USB 5V 2A 이상 어댑터·보조배터리 필요", font=font(34, "Medium"), fill=(200, 220, 210), anchor="mm")
    u = spr("u", "point", voice_env["u"][min(N - 1, int(tt * FPS))])
    u2 = u.resize((360, 540))
    im.paste(u2, (W - 380, H - 500), u2)
    return im


def frame(f):
    tt = f / FPS
    if tt >= END_CARD:
        im = end_card(tt)
        top_label(ImageDraw.Draw(im))
        return im
    i = scene_index(tt)
    who, pu, pn, cap, big, sub = SCRIPT[i]
    im = ROOM.copy()
    bl = i >= 4
    if not bl:
        hx = 520 + (int(tt * 40) % 2) * 0
        im.paste(HEAT, (470, 1500), HEAT)
    mu, mn = voice_env["u"][f], voice_env["n"][f]
    u = spr("u", pu, mu)
    n = spr("n", pn, mn, bl)
    shake = 0
    if i == 0 or i == 1:
        shake = int(4 * math.sin(tt * 60))  # 조카 덜덜
    im.paste(u, (-120, 745), u)
    im.paste(n, (430 + shake, 735), n)
    # 카메라: 말하는 사람 쪽으로 천천히 줌
    st = starts[i]
    z = 1.0 + 0.12 * min(1, max(0, (tt - st) / 1.2))
    if i == 2:
        z += 0.05 * math.exp(-max(0, tt - st) * 6) * math.sin(max(0, tt - st) * 70)
    cx = 300 if who == "u" else 800
    cy = 1350
    cw, ch = W / z, H / z
    x0 = min(max(0, cx - cw / 2), W - cw); y0 = min(max(0, cy - ch / 2 - 200), H - ch)
    im = im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), Image.BILINEAR)
    d = ImageDraw.Draw(im)
    top_label(d)
    pop = min(1, max(0, (tt - st - 0.45) / 0.25)) if big else 0
    caption(d, cap, big if pop > 0 else None, sub if pop > 0 else None, pop)
    # 말풍선 표시 (누가 말하는지)
    tag = "삼촌" if who == "u" else "조카"
    d.rounded_rectangle([40, 250, 200, 310], 30, fill=(31, 92, 74) if who == "u" else (93, 169, 233))
    d.text((120, 280), tag, font=font(38), fill="white", anchor="mm")
    return im


if __name__ == "__main__":
    only = sys.argv[3] if len(sys.argv) > 3 else None
    if only:
        for tt in only.split(","):
            frame(int(float(tt) * FPS)).save(f"{S}/prev_{tt}.png")
        sys.exit()
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-i", f"{S}/mix.wav", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
                          "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(frame(f).tobytes())
    p.stdin.close(); p.wait()
    print("frames", N, "sec", round(TOTAL, 2))
