"""꿈·다른 차원 분위기 장면 (BK 곡 '다른 차원 끝' 기준 시안, 2026-11-21). music_scene.Scene 과 같은 사용법.

밤하늘 + 오로라 + 달 두 개 + 가운데 빛나는 문(포털) + 물 위 양쪽에 선 두 사람 실루엣.
움직임(별·오로라·입자·물결)은 LOOP 초에 정확히 이어진다. 팔레트를 바꾸면 곡마다 다른 그림.
"""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .music_scene import LOOP, _grad

PALETTES = {
    "violet_dream": dict(sky=[(10, 8, 40), (52, 26, 96), (214, 120, 170)], aur=[(120, 255, 220), (170, 140, 255)],
                         portal=(255, 210, 250), water=(16, 12, 44)),
    "blue_hour": dict(sky=[(6, 14, 40), (24, 60, 120), (120, 190, 230)], aur=[(140, 255, 200), (120, 180, 255)],
                      portal=(210, 240, 255), water=(8, 20, 46)),
    "sunset_rift": dict(sky=[(30, 10, 46), (140, 50, 100), (255, 170, 120)], aur=[(255, 200, 140), (255, 120, 180)],
                        portal=(255, 236, 200), water=(30, 12, 40)),
}


def _sky(w, h, cols, hy=None):
    """세 색 세로 그라데이션 (이음새 없이)."""
    t = np.linspace(0, 1, h)
    c = np.array(cols, float)
    r = np.empty((h, 3))
    m = t < 0.6
    r[m] = c[0] + (c[1] - c[0]) * (t[m] / 0.6)[:, None]
    r[~m] = c[1] + (c[2] - c[1]) * ((t[~m] - 0.6) / 0.4)[:, None]
    return np.repeat(r[:, None, :], w, axis=1)


class DreamScene:
    def __init__(self, w: int, h: int, theme: str = "violet_dream", seed: int = 3):
        self.w, self.h, self.p, self.theme = w, h, PALETTES[theme], theme
        self.s = s = min(w, h * 16 / 9) / 1920
        self.hy = int(h * (0.64 if w > h else 0.58))  # 수평선
        self.pc = (w / 2, self.hy - (230 if w > h else 330) * s)  # 문 중심
        r = random.Random(seed)
        self.stars = [(r.uniform(0, w), r.uniform(0, self.hy * 0.9), r.uniform(0.8, 2.4) * s, r.randint(1, 3),
                       r.uniform(0, 6.28)) for _ in range(int(260 * w * h / 1920 / 1080) + 120)]
        self.parts = [(r.uniform(0, 6.28), r.uniform(0.9, 1.5), r.choice([1, -1]), r.uniform(2, 5) * s) for _ in range(46)]
        self.motes = [(r.uniform(0, w), r.uniform(0, 1), r.uniform(2, 4.5) * s, r.randint(1, 2), r.uniform(0, 6.28))
                      for _ in range(60)]
        self.base = self._base()

    def _base(self):
        w, h, p, s, hy = self.w, self.h, self.p, self.s, self.hy
        sky = _sky(w, hy, p["sky"], hy)
        water = np.flipud(_sky(w, h - hy, [p["sky"][0], p["sky"][1], p["sky"][2]]))
        fade = np.linspace(0.55, 0.15, h - hy)[:, None, None]
        water = water * fade + np.array(p["water"], float) * (1 - fade)
        arr = np.concatenate([sky, water], axis=0)
        im = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
        # 달 두 개 (흐린 빛 + 몸)
        gl = Image.new("L", (w, h), 0)
        gd = ImageDraw.Draw(gl)
        m1 = (w * 0.2, hy * 0.24, 70 * s)
        m2 = (w * 0.8, hy * 0.16, 30 * s)
        for mx, my, mr in (m1, m2):
            gd.ellipse((mx - mr * 3, my - mr * 3, mx + mr * 3, my + mr * 3), fill=60)
        gl = gl.filter(ImageFilter.GaussianBlur(50 * s))
        im.paste((255, 236, 250), (0, 0), gl)
        d = ImageDraw.Draw(im)
        d.ellipse((m1[0] - m1[2], m1[1] - m1[2], m1[0] + m1[2], m1[1] + m1[2]), fill=(250, 240, 255))
        d.ellipse((m2[0] - m2[2], m2[1] - m2[2], m2[0] + m2[2], m2[1] + m2[2]), fill=(255, 200, 225))
        # 먼 산·섬 실루엣
        rr = random.Random(5)
        for layer, col, amp in ((0, (40, 26, 70), 70), (1, (24, 16, 48), 40)):
            pts = [(0, hy)]
            for x in range(0, w + 40, 40):
                pts.append((x, hy - amp * s * (0.4 + 0.6 * abs(math.sin(x / (230 * s) + layer * 2 + rr.random() * 0.3)))))
            pts.append((w, hy))
            d.polygon(pts, fill=tuple(int(c * 0.9) for c in col) if self.w > 0 else col)
        # 양쪽 두 사람 (서로 문을 바라봄)
        for side in (-1, 1):
            fx = w / 2 + side * (w * (0.3 if w > h else 0.33))
            fy = hy + 30 * s
            sc = 1.0 * s * (1.0 if w > h else 1.25)
            col = (14, 10, 28)
            d.ellipse((fx - 13 * sc, fy - 150 * sc, fx + 13 * sc, fy - 124 * sc), fill=col)
            d.polygon([(fx - 16 * sc, fy - 120 * sc), (fx + 16 * sc, fy - 120 * sc), (fx + 26 * sc, fy - 20 * sc),
                       (fx - 26 * sc, fy - 20 * sc)], fill=col)
            d.rectangle((fx - 12 * sc, fy - 22 * sc, fx - 4 * sc, fy), fill=col)
            d.rectangle((fx + 4 * sc, fy - 22 * sc, fx + 12 * sc, fy), fill=col)
            d.ellipse((fx - 60 * sc, fy - 6 * sc, fx + 60 * sc, fy + 10 * sc), fill=(20, 16, 40))  # 발밑 바위
        return im

    def frame(self, sec: float) -> Image.Image:
        w, h, p, s, hy = self.w, self.h, self.p, self.s, self.hy
        ph = (sec % LOOP) / LOOP
        im = self.base.copy().convert("RGBA")
        # 오로라 (흐림 레이어)
        au = Image.new("RGBA", (w // 4, h // 4), (0, 0, 0, 0))
        ad = ImageDraw.Draw(au)
        for i, col in enumerate(p["aur"]):
            pts_top, pts_bot = [], []
            for xx in range(0, w // 4 + 8, 8):
                x = xx * 4
                y = hy * (0.28 + 0.1 * i) + 60 * s * math.sin(x / (380 * s) + 2 * math.pi * ph * (1 if i == 0 else -1) + i)
                thick = 70 * s + 40 * s * math.sin(x / (210 * s) - 2 * math.pi * ph * 2 + i * 1.7)
                pts_top.append((xx, y / 4))
                pts_bot.append((xx, (y + thick) / 4))
            ad.polygon(pts_top + pts_bot[::-1], fill=col + (70,))
        au = au.filter(ImageFilter.GaussianBlur(6)).resize((w, h), Image.BILINEAR)
        sky_mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(sky_mask).rectangle((0, 0, w, hy), fill=255)
        au.putalpha(Image.fromarray((np.asarray(au.getchannel("A")).astype(float) * (np.asarray(sky_mask) / 255)).astype("uint8")))
        im = Image.alpha_composite(im, au).convert("RGB")  # RGB 위에 그려야 반투명이 섞인다
        d = ImageDraw.Draw(im, "RGBA")
        for x, y, r, n, ph0 in self.stars:
            a = int(90 + 160 * (0.5 + 0.5 * math.sin(2 * math.pi * n * ph + ph0)))
            d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 250, 255, a))
        # 포털: 빛 + 고리 + 도는 입자
        cx, cy = self.pc
        R = (150 if w > h else 190) * s
        glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        pul = 1 + 0.04 * math.sin(2 * math.pi * ph * 2)
        gd.ellipse((cx - R * 1.6 * pul, cy - R * 1.9 * pul, cx + R * 1.6 * pul, cy + R * 1.9 * pul), fill=p["portal"] + (55,))
        glow = glow.filter(ImageFilter.GaussianBlur(70 * s))
        im = Image.alpha_composite(im.convert("RGBA"), glow).convert("RGB")
        d = ImageDraw.Draw(im, "RGBA")
        d.ellipse((cx - R * 0.8, cy - R, cx + R * 0.8, cy + R), fill=(30, 14, 70, 110), outline=(255, 255, 255, 230),
                  width=max(3, int(6 * s)))
        for k in range(10, 0, -1):
            f = k / 10
            d.ellipse((cx - R * 0.78 * f, cy - R * 0.97 * f, cx + R * 0.78 * f, cy + R * 0.97 * f),
                      fill=p["portal"] + (int(16 + 8 * math.sin(2 * math.pi * (ph * 2 - f))),))
        d.ellipse((cx - R * 0.6, cy - R * 0.78, cx + R * 0.6, cy + R * 0.78), outline=p["portal"] + (160,),
                  width=max(2, int(3 * s)))
        for a0, rr, dirn, sz in self.parts:
            a = a0 + dirn * 2 * math.pi * ph
            x, y = cx + math.cos(a) * R * 0.8 * rr, cy + math.sin(a) * R * rr
            d.ellipse((x - sz, y - sz, x + sz, y + sz), fill=(255, 255, 255, 200))
        # 물에 비친 포털 + 물결
        for k in range(14):
            yy = hy + (k + 1) ** 1.6 * 4 * s + 6 * s * math.sin(2 * math.pi * (ph + k / 14))
            ww = R * (0.9 - k * 0.05) + 10 * s * math.sin(2 * math.pi * (ph * 2 + k / 7))
            d.line((cx - ww, yy, cx + ww, yy), fill=p["portal"] + (max(0, 150 - k * 10),), width=max(2, int(3 * s)))
        # 떠오르는 빛가루
        for x, y0, r, k, ph0 in self.motes:
            y = h - ((y0 + k * ph) % 1.0) * h
            xx = x + 14 * s * math.sin(2 * math.pi * ph * 2 + ph0)
            d.ellipse((xx - r, y - r, xx + r, y + r), fill=(255, 230, 250, 120))
        return im.convert("RGB")
