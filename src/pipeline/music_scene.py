"""음악 채널(Deep Work Lab) 장면 그리기: 밤 책상 + 창밖 풍경 (PIL + numpy, 0원).

같은 그림을 반복하면 '진정성 없는 콘텐츠'로 보일 수 있어 편마다 테마(색·날씨·소품)를 바꾼다.
render_base(): 움직이지 않는 부분, render_frame(): 비·눈·별·김·램프 깜빡임을 얹은 한 장.
애니메이션은 LOOP 초 안에서 정확히 이어지도록(정수 주기) 만들어 ffmpeg 로 반복 재생한다.
"""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LOOP = 10.0  # 초. 모든 움직임이 이 길이에서 이어진다

THEMES = {
    "rainy_night": dict(sky=((14, 18, 44), (58, 46, 92)), wall=(22, 20, 34), desk=(62, 40, 30),
                        lamp=(255, 196, 120), weather="rain", moon=True, city=(30, 30, 56), accent=(255, 214, 160)),
    "snow_evening": dict(sky=((30, 40, 78), (150, 120, 160)), wall=(30, 26, 40), desk=(70, 48, 36),
                         lamp=(255, 206, 140), weather="snow", moon=False, city=(46, 44, 76), accent=(255, 226, 190)),
    "dawn_cafe": dict(sky=((60, 70, 120), (240, 170, 140)), wall=(44, 32, 34), desk=(92, 60, 40),
                      lamp=(255, 220, 170), weather="none", moon=False, city=(70, 60, 90), accent=(255, 232, 200)),
    "forest_rain": dict(sky=((16, 34, 34), (60, 96, 84)), wall=(18, 26, 24), desk=(58, 42, 30),
                        lamp=(255, 200, 130), weather="rain", moon=False, city=(24, 48, 40), accent=(220, 240, 200)),
}


def _grad(w, h, top, bottom):
    t = np.linspace(0, 1, h)[:, None, None]
    a = np.array(top, float)[None, None, :]
    b = np.array(bottom, float)[None, None, :]
    return np.repeat(a + (b - a) * t, w, axis=1)


def _glow(w, h, cx, cy, r, color, strength=1.0):
    y, x = np.ogrid[:h, :w]
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    a = np.clip(1 - d, 0, 1) ** 2.2 * strength
    return a[..., None] * np.array(color, float)[None, None, :]


class Scene:
    def __init__(self, w: int, h: int, theme: str = "rainy_night", seed: int = 7):
        self.w, self.h, self.t = w, h, THEMES[theme]
        self.theme = theme
        s = min(w, h * 16 / 9) / 1920  # 기준 크기 대비 비율
        self.s = s
        rnd = random.Random(seed)
        # 창 위치 (가운데, 화면 비율에 맞춰)
        ww = int(w * (0.56 if w > h else 0.8))
        wh = int(h * (0.58 if w > h else 0.42))
        self.win = (w // 2 - ww // 2, int(h * (0.08 if w > h else 0.16)), w // 2 + ww // 2,
                    int(h * (0.08 if w > h else 0.16)) + wh)
        self.desk_y = int(h * (0.74 if w > h else 0.66))
        x0, y0, x1, y1 = self.win
        self.stars = [(rnd.uniform(x0, x1), rnd.uniform(y0, y0 + (y1 - y0) * 0.55), rnd.uniform(1, 2.6) * s,
                       rnd.randint(1, 3), rnd.uniform(0, 6.28)) for _ in range(70)]
        n = 160 if self.t["weather"] == "rain" else 110
        self.drops = [(rnd.uniform(x0, x1), rnd.uniform(0, 1), rnd.randint(2, 4), rnd.uniform(0.5, 1.0),
                       rnd.uniform(0, 6.28)) for _ in range(n)]
        self.buildings = []
        bx = x0
        while bx < x1:
            bw = rnd.randint(int(50 * s), int(130 * s))
            bh = rnd.uniform(0.12, 0.38) * (y1 - y0)
            lights = [(rnd.uniform(0.1, 0.9), rnd.uniform(0.1, 0.9)) for _ in range(rnd.randint(1, 5))]
            self.buildings.append((bx, bw, bh, lights))
            bx += bw + rnd.randint(0, int(12 * s))
        self.base = self._base()

    # ---------- 고정 부분 ----------
    def _base(self) -> Image.Image:
        w, h, t, s = self.w, self.h, self.t, self.s
        x0, y0, x1, y1 = self.win
        img = _grad(w, h, tuple(c * 0.8 for c in t["wall"]), t["wall"])
        # 창 안 하늘
        sky = _grad(x1 - x0, y1 - y0, *t["sky"])
        img[y0:y1, x0:x1] = sky
        im = Image.fromarray(np.clip(img, 0, 255).astype("uint8"))
        d = ImageDraw.Draw(im)
        if t["moon"]:
            mx, my, mr = x1 - (x1 - x0) * 0.22, y0 + (y1 - y0) * 0.24, 46 * s
            gl = Image.new("L", (w, h), 0)
            ImageDraw.Draw(gl).ellipse((mx - mr * 3, my - mr * 3, mx + mr * 3, my + mr * 3), fill=70)
            gl = gl.filter(ImageFilter.GaussianBlur(40 * s))
            im.paste((255, 240, 210), (0, 0), gl)
            d.ellipse((mx - mr, my - mr, mx + mr, my + mr), fill=(255, 244, 214))
            sky_c = tuple(int(c) for c in t["sky"][0])
            d.ellipse((mx - mr * 0.55, my - mr * 1.1, mx + mr * 1.25, my + mr * 0.55), fill=sky_c)
        # 도시 실루엣
        for bx, bw, bh, lights in self.buildings:
            top = y1 - bh
            d.rectangle((bx, top, min(bx + bw, x1), y1), fill=t["city"])
            for lx, ly in lights:
                px, py = bx + lx * bw, top + ly * bh
                if px < x1 - 6 * s:
                    d.rectangle((px, py, px + 7 * s, py + 9 * s), fill=(255, 210, 140))
        # 창틀 (십자)
        fc = tuple(int(c * 0.55) for c in t["desk"])
        fw = max(6, int(16 * s))
        d.rectangle((x0 - fw, y0 - fw, x1 + fw, y1 + fw), outline=fc, width=fw)
        d.rectangle(((x0 + x1) // 2 - fw // 2, y0, (x0 + x1) // 2 + fw // 2, y1), fill=fc)
        d.rectangle((x0, int(y0 + (y1 - y0) * 0.45) - fw // 2, x1, int(y0 + (y1 - y0) * 0.45) + fw // 2), fill=fc)
        d.rectangle((x0 - fw * 3, y1 + fw, x1 + fw * 3, y1 + fw * 2), fill=fc)  # 창턱
        # 책상
        d.rectangle((0, self.desk_y, w, h), fill=t["desk"])
        d.rectangle((0, self.desk_y, w, self.desk_y + max(3, int(6 * s))),
                    fill=tuple(min(255, int(c * 1.35)) for c in t["desk"]))
        # 소품: 책 더미(오른쪽), 화분(왼쪽 끝), 머그(가운데 오른쪽), 램프(왼쪽)
        self._props(d)
        return im

    def _props(self, d: ImageDraw.ImageDraw):
        w, h, s, t = self.w, self.h, self.s, self.t
        dy = self.desk_y
        # 책 더미
        bx = w * 0.72
        cols = [(120, 70, 80), (70, 90, 120), (150, 120, 80), (90, 110, 90)]
        y = dy
        for i, c in enumerate(cols):
            bw, bh = (230 - i * 18) * s, 30 * s
            y -= bh
            d.rounded_rectangle((bx + i * 6 * s, y, bx + i * 6 * s + bw, y + bh - 2 * s), radius=4 * s, fill=c)
        # 머그
        self.mug = (w * 0.58, dy - 70 * s, 64 * s, 70 * s)
        mx, my, mw, mh = self.mug
        d.rounded_rectangle((mx, my, mx + mw, my + mh), radius=10 * s, fill=(232, 222, 204))
        d.arc((mx + mw - 14 * s, my + 14 * s, mx + mw + 22 * s, my + 50 * s), -90, 90, fill=(232, 222, 204),
              width=max(3, int(9 * s)))
        # 화분
        px = w * 0.12
        d.polygon([(px, dy), (px + 70 * s, dy), (px + 80 * s, dy - 70 * s), (px - 10 * s, dy - 70 * s)],
                  fill=(150, 90, 70))
        for a in range(-60, 61, 24):
            r = math.radians(a - 90)
            ex, ey = px + 35 * s + math.cos(r) * 120 * s, dy - 70 * s + math.sin(r) * 120 * s
            d.line((px + 35 * s, dy - 70 * s, ex, ey), fill=(70, 120, 80), width=max(3, int(14 * s)))
        # 램프
        lx = w * 0.3
        self.lamp = (lx + 70 * s, dy - 210 * s)
        d.ellipse((lx - 10 * s, dy - 18 * s, lx + 90 * s, dy + 4 * s), fill=(40, 34, 40))
        d.line((lx + 40 * s, dy - 10 * s, lx + 10 * s, dy - 170 * s), fill=(40, 34, 40), width=max(4, int(10 * s)))
        d.line((lx + 10 * s, dy - 170 * s, lx + 70 * s, dy - 220 * s), fill=(40, 34, 40), width=max(4, int(10 * s)))
        d.polygon([(lx + 30 * s, dy - 250 * s), (lx + 130 * s, dy - 230 * s), (lx + 100 * s, dy - 180 * s),
                   (lx + 40 * s, dy - 190 * s)], fill=(60, 52, 60))

    # ---------- 움직이는 부분 ----------
    def frame(self, sec: float) -> Image.Image:
        w, h, s, t = self.w, self.h, self.s, self.t
        ph = (sec % LOOP) / LOOP  # 0..1
        x0, y0, x1, y1 = self.win
        arr = np.asarray(self.base).astype(float)
        # 램프 빛 (아주 약하게 숨쉬기)
        lx, ly = self.lamp
        br = 0.55 + 0.04 * math.sin(2 * math.pi * ph * 2)
        arr += _glow(w, h, lx, ly + 60 * s, 520 * s, t["lamp"], br)
        im = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
        d = ImageDraw.Draw(im, "RGBA")
        for sx, sy, r, n, p in self.stars:
            if t["weather"] == "rain" and not t["moon"]:
                break
            a = int(120 + 120 * (0.5 + 0.5 * math.sin(2 * math.pi * n * ph + p)))
            d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(255, 250, 230, a))
        wh = y1 - y0
        if t["weather"] == "rain":
            for dx, dy0, k, b, _ in self.drops:
                y = y0 + ((dy0 + k * ph) % 1.0) * wh
                ln = 26 * s * b
                d.line((dx, y, dx - 4 * s, y + ln), fill=(200, 210, 255, int(90 * b)), width=max(1, int(2 * s)))
        elif t["weather"] == "snow":
            for dx, dy0, k, b, p in self.drops:
                y = y0 + ((dy0 + (k - 1) * ph) % 1.0) * wh
                x = dx + 10 * s * math.sin(2 * math.pi * (2 * ph) + p)
                r = 3.2 * s * b
                d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, int(200 * b)))
        # 머그 김
        mx, my, mw, _ = self.mug
        for i in range(3):
            pts = []
            for j in range(18):
                f = j / 17
                yy = my - 8 * s - f * 120 * s
                xx = mx + mw * (0.3 + 0.2 * i) + 10 * s * math.sin(2 * math.pi * (f * 1.5 - ph * 2) + i)
                pts.append((xx, yy))
            d.line(pts, fill=(255, 255, 255, 50), width=max(2, int(5 * s)), joint="curve")
        return im


def profile(size: int = 800, theme: str = "rainy_night") -> Image.Image:
    """프로필(원형으로 잘림): 달 + 창 + 램프 빛만 단순하게."""
    t = THEMES[theme]
    arr = _grad(size, size, t["sky"][0], t["sky"][1])
    arr += _glow(size, size, size * 0.5, size * 0.62, size * 0.7, t["lamp"], 0.35)
    im = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    d = ImageDraw.Draw(im)
    c = size / 2
    # 창
    ww = size * 0.46
    fc = tuple(int(v * 0.5) for v in t["desk"])
    d.rounded_rectangle((c - ww / 2, size * 0.2, c + ww / 2, size * 0.66), radius=size * 0.03,
                        fill=tuple(int(v) for v in t["sky"][0]), outline=fc, width=int(size * 0.025))
    d.line((c, size * 0.2, c, size * 0.66), fill=fc, width=int(size * 0.02))
    d.line((c - ww / 2, size * 0.4, c + ww / 2, size * 0.4), fill=fc, width=int(size * 0.02))
    mr = size * 0.07
    mx, my = c + ww * 0.22, size * 0.3
    d.ellipse((mx - mr, my - mr, mx + mr, my + mr), fill=(255, 244, 214))
    d.ellipse((mx - mr * 0.5, my - mr * 1.1, mx + mr * 1.2, my + mr * 0.5), fill=tuple(int(v) for v in t["sky"][0]))
    for i in range(14):
        x = c - ww / 2 + (i * 37 % 100) / 100 * ww
        y = size * 0.22 + (i * 53 % 100) / 100 * size * 0.42
        d.line((x, y, x - 3, y + size * 0.03), fill=(200, 210, 255), width=2)
    # 책상 + 머그 + 램프 빛 원
    d.rectangle((0, size * 0.7, size, size), fill=t["desk"])
    d.rounded_rectangle((c - size * 0.06, size * 0.6, c + size * 0.06, size * 0.71), radius=size * 0.015,
                        fill=(236, 226, 206))
    d.arc((c + size * 0.035, size * 0.62, c + size * 0.1, size * 0.68), -90, 90, fill=(236, 226, 206),
          width=int(size * 0.014))
    for i in range(2):
        pts = [(c - size * 0.02 + i * size * 0.04 + size * 0.012 * math.sin(j * 0.9 + i), size * 0.58 - j * size * 0.012)
               for j in range(8)]
        d.line(pts, fill=(255, 255, 255), width=int(size * 0.008), joint="curve")
    return im
