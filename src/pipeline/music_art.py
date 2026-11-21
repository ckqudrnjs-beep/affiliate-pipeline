"""BEEKAY SONGS 곡 커버 자동 디자인 (BK 11/21 22:31 '커버가 너무 안좋아' → 곡마다 새로 디자인).

Suno 곡 파일의 작은 커버(360px)는 색과 분위기만 빌리고, 1500px 커버를 새로 그린다. 비용 0원.
스타일
  pastel : 커버 색으로 만든 부드러운 그라데이션 덩어리 + 필름 결 + 큰 제목 (밝은 아이돌 곡)
  frame  : Suno 그림을 작게(선명하게) 액자처럼 넣고 아래에 큰 제목 (그림이 좋은 곡)
  neon   : 어두운 무대, 빛 고리·조명 줄기·보케 + 빛나는 제목 (강한 곡·남성 버전)
"""
from __future__ import annotations

import colorsys
import hashlib
import math
import pathlib
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
FONTS = ROOT / "config" / "fonts"
S = 1500
STYLES = ("pastel", "frame", "neon")


def _font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    path = {
        "ko": FONTS / "BlackHanSans-Regular.ttf",
        "ko_serif": FONTS / "GowunBatang-Bold.ttf",
        "en": "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
        "en_x": "/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf",
        "en_m": "/usr/share/fonts/opentype/inter/Inter-Medium.otf",
        "en_l": "/usr/share/fonts/opentype/inter/Inter-Light.otf",
    }[kind]
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.truetype(str(FONTS / "GowunBatang-Bold.ttf"), size)


def _has_ko(t: str) -> bool:
    return any("가" <= c <= "힣" for c in t)


def _seed(*parts: str) -> int:
    return int(hashlib.md5("|".join(parts).encode()).hexdigest()[:8], 16)


# ---------- 색 ----------
def palette(src: Image.Image | None, seed: int, n: int = 5) -> list[tuple[int, int, int]]:
    """커버에서 채도 있는 대표색 n개. 커버가 없으면 seed 로 고른 파스텔."""
    if src is not None:
        q = src.convert("RGB").resize((120, 120)).quantize(colors=12, method=Image.Quantize.MEDIANCUT)
        pal = q.getpalette()[:36]
        cnt = sorted(q.getcolors(), reverse=True)
        cols = [tuple(pal[i * 3:i * 3 + 3]) for _, i in cnt]
        cols = [c for c in cols if colorsys.rgb_to_hsv(*[v / 255 for v in c])[1] > 0.12] or cols
        while len(cols) < n:
            cols.append(cols[len(cols) % max(1, len(cols))])
        return cols[:n]
    r = random.Random(seed)
    h0 = r.random()
    return [tuple(int(v * 255) for v in colorsys.hsv_to_rgb((h0 + k * 0.09) % 1, 0.35 + 0.1 * k % 0.3, 0.95 - 0.08 * k))
            for k in range(n)]


def _lum(c) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def _mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _sat(c, s_mul=1.0, v_mul=1.0):
    h, s, v = colorsys.rgb_to_hsv(*[x / 255 for x in c])
    return tuple(int(x * 255) for x in colorsys.hsv_to_rgb(h, min(1, s * s_mul), min(1, v * v_mul)))


def _trim(art: Image.Image, frac: float = 0.06) -> Image.Image:
    """Suno 커버 가장자리 테두리를 잘라낸다."""
    w, h = art.size
    return art.crop((int(w * frac), int(h * frac), int(w * (1 - frac)), int(h * (1 - frac))))


def _star(d, cx, cy, r, fill):
    k = r * 0.18
    d.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k),
               (cx - r, cy), (cx - k, cy - k)], fill=fill)


# ---------- 질감 ----------
def _grain(im: Image.Image, amt: float, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    n = rng.normal(0, 255 * amt, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a + n, 0, 255).astype(np.uint8))


def _vignette(im: Image.Image, strength: float) -> Image.Image:
    w, h = im.size
    y, x = np.ogrid[:h, :w]
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    m = np.clip(1 - strength * np.clip(d - 0.55, 0, None) ** 1.6, 0, 1)[..., None]
    return Image.fromarray((np.asarray(im.convert("RGB")) * m).astype(np.uint8))


def _blobs(size, cols, seed, count=7, base=None) -> Image.Image:
    r = random.Random(seed)
    im = Image.new("RGB", (size, size), base or cols[0])
    for k in range(count):
        layer = Image.new("RGB", (size, size), (0, 0, 0))
        m = Image.new("L", (size, size), 0)
        cx, cy = r.uniform(-0.1, 1.1) * size, r.uniform(-0.1, 1.1) * size
        rad = r.uniform(0.25, 0.55) * size
        ImageDraw.Draw(m).ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=int(r.uniform(150, 235)))
        m = m.filter(ImageFilter.GaussianBlur(rad * 0.55))
        layer.paste(cols[(k + 1) % len(cols)], (0, 0, size, size))
        im = Image.composite(layer, im, m)
    return im


def _text_size(d, txt, f, spacing=0):
    b = d.textbbox((0, 0), txt, font=f)
    return b[2] - b[0] + spacing * max(0, len(txt) - 1), b[3] - b[1], b


def _spaced(d, xy, txt, f, fill, spacing):
    x, y = xy
    for ch in txt:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + spacing


def _fit(d, txt, kind, max_w, start, min_size=60):
    s = start
    while s > min_size:
        f = _font(kind, s)
        if _text_size(d, txt, f)[0] <= max_w:
            return f
        s -= 6
    return _font(kind, min_size)


def _split_title(title: str) -> list[str]:
    """긴 제목은 두 줄로."""
    if len(title) <= 9 or " " not in title:
        return [title]
    words = title.split(" ")
    best, cut = 1e9, 1
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        if abs(len(a) - len(b)) < best:
            best, cut = abs(len(a) - len(b)), i
    return [" ".join(words[:cut]), " ".join(words[cut:])]


def _glow_text(base: Image.Image, xy, txt, f, fill, glow, rad, spread=2):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text(xy, txt, font=f, fill=glow + (255,))
    g = layer.filter(ImageFilter.GaussianBlur(rad))
    for _ in range(spread):
        base.alpha_composite(g)
    ImageDraw.Draw(base).text(xy, txt, font=f, fill=fill)


def _badge(d, xy, txt, fg, bg, f, pad=(22, 10), outline=False):
    w, h, b = _text_size(d, txt, f, 0)
    x, y = xy
    box = (x, y, x + w + pad[0] * 2, y + h + pad[1] * 2 + 4)
    if outline:
        d.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, outline=fg, width=3)
    else:
        d.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=bg)
    d.text((x + pad[0] - b[0], y + pad[1] - b[1] + 2), txt, font=f, fill=fg)
    return box


# ---------- 스타일 ----------
def _pastel(title, version, cols, seed, art):
    vivid = [_sat(c, 1.5, 1.1) for c in cols]
    light = sorted(vivid, key=_lum, reverse=True)
    cols = vivid
    im = _blobs(S, light + [_mix(light[0], (255, 255, 255), 0.6)], seed, count=10, base=_mix(light[-1], (255, 255, 255), 0.15))
    # 빛 줄기
    beams = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(beams)
    r = random.Random(seed + 1)
    for _ in range(4):
        x = r.uniform(0.1, 0.9) * S
        w = r.uniform(30, 120)
        d.polygon([(x - w, -10), (x + w, -10), (x + w * 4 + 300, S), (x - w * 2 + 300, S)], fill=int(r.uniform(40, 80)))
    beams = beams.filter(ImageFilter.GaussianBlur(40))
    im = Image.composite(Image.new("RGB", (S, S), (255, 255, 255)), im, beams)
    # 궤도 선 + 반짝이 별
    deco = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    ox, oy = S * r.uniform(0.55, 0.75), S * r.uniform(0.3, 0.45)
    for k, rr in enumerate((330, 470, 610)):
        dd.ellipse((ox - rr, oy - rr * 0.92, ox + rr, oy + rr * 0.92), outline=(255, 255, 255, 150 - k * 35), width=3)
    for _ in range(9):
        _star(dd, r.uniform(0.08, 0.92) * S, r.uniform(0.12, 0.62) * S, r.uniform(10, 34), (255, 255, 255, int(r.uniform(160, 255))))
    glow = deco.filter(ImageFilter.GaussianBlur(10))
    im = im.convert("RGBA")
    im.alpha_composite(glow)
    im.alpha_composite(deco)
    im = _grain(im, 0.035, seed).convert("RGBA")
    d = ImageDraw.Draw(im)
    dark = _mix(min(cols, key=_lum), (20, 14, 40), 0.55)
    # 제목
    lines = _split_title(title)
    kind = "ko" if _has_ko(title) else "en_x"
    f = _fit(d, max(lines, key=len), kind, S - 220, 260 if len(lines) == 1 else 210)
    lh = _text_size(d, "가A", f)[1] * 1.15
    y = S - 170 - lh * len(lines)
    for ln in lines:
        _, _, b = _text_size(d, ln, f)
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((110 - b[0], y - b[1] + 8), ln, font=f, fill=dark + (90,))
        im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
        ImageDraw.Draw(im).text((110 - b[0], y - b[1]), ln, font=f, fill=(255, 255, 255))
        y += lh
    d = ImageDraw.Draw(im)
    _spaced(d, (114, 118), "BEEKAY SONGS", _font("en_m", 34), (255, 255, 255), 9)
    d.line((114, 172, 300, 172), fill=(255, 255, 255), width=3)
    if version:
        fb = _font("en_m", 30)
        w = _text_size(d, version.upper(), fb)[0]
        _badge(d, (S - 110 - w - 44, 108), version.upper(), (255, 255, 255), dark, fb, outline=True)
    _spaced(d, (114, S - 120), "DIGITAL SINGLE", _font("en_m", 26), (255, 255, 255, 220), 6)
    d.rectangle((40, 40, S - 41, S - 41), outline=(255, 255, 255, 140), width=2)
    return _vignette(im, 0.25)


def _frame(title, version, cols, seed, art):
    bg = _mix(sorted(cols, key=_lum, reverse=True)[0], (250, 247, 242), 0.78)
    ink = _mix(min(cols, key=_lum), (24, 20, 36), 0.6)
    acc = _sat(max(cols, key=lambda c: colorsys.rgb_to_hsv(*[v / 255 for v in c])[1]), 1.1, 0.9)
    im = Image.new("RGB", (S, S), bg)
    im = _grain(im, 0.02, seed).convert("RGBA")
    a = 1000
    x0, y0 = 130, 130
    if art is not None:
        pic = _trim(art).convert("RGB").resize((a, a), Image.LANCZOS)
        pic = pic.filter(ImageFilter.UnsharpMask(radius=3, percent=80, threshold=2))
        pic = _grain(pic, 0.045, seed + 2)
    else:
        pic = _blobs(a, cols, seed, 6)
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((x0 + 10, y0 + 24, x0 + a + 10, y0 + a + 24), fill=(0, 0, 0, 70))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))
    im.paste(pic, (x0, y0))
    d = ImageDraw.Draw(im)
    # 오른쪽 세로 글씨
    side = Image.new("RGBA", (a, 80), (0, 0, 0, 0))
    _spaced(ImageDraw.Draw(side), (0, 10), "BEEKAY SONGS  ·  2026", _font("en_m", 34), ink, 10)
    im.alpha_composite(side.rotate(-90, expand=True), (x0 + a + 70, y0))
    # 제목
    kind = "ko" if _has_ko(title) else "en_x"
    f = _fit(d, title, kind, S - 220 - (230 if version else 0), 170, 70)
    _, h, b = _text_size(d, title, f)
    ty = y0 + a + (S - y0 - a - h) // 2 - 6
    d.text((x0 - b[0], ty - b[1]), title, font=f, fill=ink)
    if version:
        fb = _font("en_m", 28)
        w = _text_size(d, version.upper(), fb)[0]
        _badge(d, (S - 110 - w - 44, ty + h // 2 - 26), version.upper(), (255, 255, 255), acc, fb)
    d.rectangle((x0, y0 + a + 26, x0 + 120, y0 + a + 32), fill=acc)
    return im


def _neon(title, version, cols, seed, art):
    r = random.Random(seed)
    acc = _sat(max(cols, key=lambda c: colorsys.rgb_to_hsv(*[v / 255 for v in c])[1]), 1.6, 1.6)
    acc2 = _sat(cols[(1 + r.randint(0, 3)) % len(cols)], 1.5, 1.5)
    hi = _mix(acc, (255, 255, 255), 0.45)
    base = _mix(acc, (8, 6, 18), 0.88)
    im = Image.new("RGB", (S, S), base)
    # 바닥 빛
    glow = _blobs(S, [base, _mix(acc, base, 0.5), _mix(acc2, base, 0.6)], seed, 5, base)
    im = Image.blend(im, glow, 0.7)
    im = im.convert("RGBA")
    # 조명 줄기
    beams = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(beams)
    for k in range(6):
        sx = S * (0.15 + 0.14 * k)
        ex = S * 0.5 + r.uniform(-500, 500)
        c = (acc if k % 2 else acc2) + (int(r.uniform(35, 70)),)
        d.polygon([(sx - 8, -20), (sx + 8, -20), (ex + 160, S * 0.95), (ex - 160, S * 0.95)], fill=c)
    im.alpha_composite(beams.filter(ImageFilter.GaussianBlur(30)))
    # 빛 고리
    cx, cy, R = S // 2, int(S * 0.42), int(S * 0.27)
    ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((cx - R, cy - R, cx + R, cy + R), outline=acc + (255,), width=16)
    for rad, n in ((90, 3), (36, 3), (10, 2)):
        g = ring.filter(ImageFilter.GaussianBlur(rad))
        for _ in range(n):
            im.alpha_composite(g)
    ImageDraw.Draw(im).ellipse((cx - R + 4, cy - R + 4, cx + R - 4, cy + R - 4), outline=(255, 245, 255), width=5)
    # 고리 안: Suno 그림을 둥글게(작게, 선명)
    if art is not None:
        a = int(R * 2) - 24
        pic = _trim(art, 0.08).convert("RGB").resize((a, a), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 70, 2))
        m = Image.new("L", (a, a), 0)
        ImageDraw.Draw(m).ellipse((0, 0, a - 1, a - 1), fill=255)
        m = m.filter(ImageFilter.GaussianBlur(3))
        im.paste(pic, (cx - a // 2, cy - a // 2), m)
    # 보케
    bok = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(bok)
    for _ in range(60):
        x, y, rr = r.uniform(0, S), r.uniform(0, S), r.uniform(3, 22)
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(acc if r.random() < .5 else acc2) + (int(r.uniform(40, 140)),))
    im.alpha_composite(bok.filter(ImageFilter.GaussianBlur(4)))
    # 제목
    d = ImageDraw.Draw(im)
    kind = "ko" if _has_ko(title) else "en_x"
    f = _fit(d, title, kind, S - 240, 190, 70)
    w, h, b = _text_size(d, title, f)
    ty = int(S * 0.77)
    _glow_text(im, ((S - w) // 2 - b[0], ty - b[1]), title, f, (255, 250, 255), acc, 26, 4)
    d = ImageDraw.Draw(im)
    if version:
        fb = _font("en_m", 30)
        vw = _text_size(d, version.upper(), fb)[0]
        _badge(d, ((S - vw - 44) // 2, ty + h + 44), version.upper(), hi, None, fb, outline=True)
    t = "BEEKAY SONGS"
    fs = _font("en_m", 32)
    tw = _text_size(d, t, fs, 10)[0]
    _spaced(d, ((S - tw) // 2, 90), t, fs, (255, 255, 255, 230), 10)
    return _vignette(_grain(im, 0.03, seed), 0.6)


def make_cover(title: str, version: str = "", art: Image.Image | None = None, style: str = "",
               out: pathlib.Path | None = None) -> Image.Image:
    seed = _seed(title, version)
    style = style or STYLES[seed % len(STYLES)]
    cols = palette(art, seed)
    im = {"pastel": _pastel, "frame": _frame, "neon": _neon}[style](title, version, cols, seed, art).convert("RGB")
    if out:
        im.save(out, quality=93)
    return im
