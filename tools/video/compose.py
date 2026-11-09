"""상품 홍보 영상 편집기 (2026-11-09): 판매자 제공 사진(알리 공식 API로 받은 video_assets/)만으로 10초 영상을 만든다.

AI 영상 생성 없이 사진을 자르고 움직여서(확대, 불 켜짐, 좌우 비교) 장점을 보여 준다.
장면 구성은 tools/video/stories/<slug>.json 에 적는다.

    python tools/video/compose.py baseus-led-desk-lamp      # → video_work/compose/<slug>_site.mp4, _shorts.mp4

필요: Pillow, ffmpeg, 한글 폰트(VIDEO_FONT 또는 맑은 고딕).
"""
from __future__ import annotations

import json
import math
import os
import pathlib
import subprocess
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
FPS = 30
BAR = (24, 26, 28)
FORMATS = {  # 이름: (전체 크기, 사진 영역 위치·크기)
    "shorts": ((1080, 1920), (0, 285, 1080, 1350)),
    "site": ((960, 720), (192, 0, 576, 720)),  # 사진은 4:5 로 가운데, 양옆은 단색
}


def font(size: int) -> ImageFont.FreeTypeFont:
    for f in (os.environ.get("VIDEO_FONT", ""), "C:/Windows/Fonts/malgunbd.ttf",
              "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"):
        if f and pathlib.Path(f).exists():
            return ImageFont.truetype(f, size)
    sys.exit("한글 폰트가 없어요. VIDEO_FONT 로 경로를 알려 주세요.")


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def load(slug: str, name: str, fills: list) -> Image.Image:
    im = Image.open(ROOT / "video_assets" / slug / name).convert("RGB")
    if fills:
        import numpy as np
        a = np.asarray(im).astype(np.float32).copy()
        for x0, y0, x1, y1, *mode in fills:  # 사진 속 글자 상자를 주변 벽 색으로 이어 칠한다 (상품 영역은 지정하지 않는다)
            if mode == ["h"]:  # 좌우 경계 색으로
                k = np.linspace(0, 1, x1 - x0)[None, :, None]
                a[y0:y1, x0:x1] = a[y0:y1, x0 - 1][:, None] * (1 - k) + a[y0:y1, x1][:, None] * k
            else:  # 위아래 경계 색으로
                k = np.linspace(0, 1, y1 - y0)[:, None, None]
                a[y0:y1, x0:x1] = a[y0 - 1, x0:x1][None] * (1 - k) + a[y1, x0:x1][None] * k
        im = Image.fromarray(a.clip(0, 255).astype("uint8"))
    return im


def view(im: Image.Image, box, w: int, h: int, zoom: float = 1.0) -> Image.Image:
    """box 안에서 w:h 비율로 가운데를 잘라(zoom 만큼 더 확대) w×h 로 만든다."""
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    tw, th = (bw, bw * h / w) if bw * h / w <= bh else (bh * w / h, bh)
    tw, th = tw / zoom, th / zoom
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return im.resize((w, h), Image.LANCZOS, box=(cx - tw / 2, cy - th / 2, cx + tw / 2, cy + th / 2))


def to_view(pt, box, w, h, zoom):
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    tw, th = (bw, bw * h / w) if bw * h / w <= bh else (bh * w / h, bh)
    tw, th = tw / zoom, th / zoom
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return ((pt[0] - (cx - tw / 2)) * w / tw, (pt[1] - (cy - th / 2)) * h / th)


def scene_frame(sc: dict, imgs: dict, t: float, w: int, h: int) -> Image.Image:
    d = sc["dur"]
    zoom = 1 + sc.get("zoom", 0.06) * (t / d)
    kind = sc["type"]
    if kind == "wipe":
        a = view(imgs[sc["image"]], sc["box"], w, h, zoom)
        b = view(imgs[sc["image2"]], sc["box2"], w, h, zoom)
        k = ease((t - sc.get("wipe_at", d * 0.4)) / 0.5)
        x = int(w * k)
        out = a.copy()
        out.paste(b.crop((0, 0, x, h)), (0, 0))
        if 0 < x < w:
            ImageDraw.Draw(out).rectangle((x - 3, 0, x + 3, h), fill="white")
        return out
    im = view(imgs[sc["image"]], sc["box"], w, h, zoom)
    if kind == "reveal":
        dark = ImageEnhance.Brightness(im).enhance(0.16)
        dark = Image.merge("RGB", [c.point(lambda v, m=m: int(v * m)) for c, m in zip(dark.split(), (0.8, 0.9, 1.15))])
        k = ease((t - sc.get("on_at", 0.6)) / 1.1)
        if k <= 0:
            return dark
        px, py = to_view(sc["light_at"], sc["box"], w, h, zoom)
        r = k * math.hypot(w, h) * 1.1
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).ellipse((px - r, py - r * 0.8, px + r, py + r * 1.2), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(max(1, r * 0.35)))
        return Image.composite(im, dark, mask)
    if kind == "end":
        return ImageEnhance.Brightness(im).enhance(0.45)
    return im


def text_center(dr: ImageDraw.ImageDraw, cx: int, y: int, s: str, f, fill="white"):
    w = dr.textlength(s, font=f)
    dr.text((cx - w / 2, y), s, font=f, fill=fill)


def wrap_size(dr, s: str, size: int, maxw: int):
    while size > 20 and dr.textlength(s, font=font(size)) > maxw:
        size -= 2
    return font(size)


def compose(slug: str) -> None:
    story = json.loads((ROOT / "tools" / "video" / "stories" / f"{slug}.json").read_text(encoding="utf-8"))
    imgs = {n: load(slug, n, story.get("fills", {}).get(n, [])) for n in
            {sc[k] for sc in story["scenes"] for k in ("image", "image2") if k in sc}}
    label = story.get("label", "광고 · 판매자 제공 사진으로 편집")
    total = sum(sc["dur"] for sc in story["scenes"])
    out_dir = ROOT / "video_work" / "compose"
    out_dir.mkdir(parents=True, exist_ok=True)
    audio = out_dir / f"{slug}_click.wav"
    clicks = [sum(s["dur"] for s in story["scenes"][:i]) + sc.get("on_at", 0.6)
              for i, sc in enumerate(story["scenes"]) if sc["type"] == "reveal"]
    _click_track(audio, total, clicks)
    for fmt, ((W, H), (ax, ay, aw, ah)) in FORMATS.items():
        out = out_dir / f"{slug}_{fmt}.mp4"
        ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                               "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(audio),
                               "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
                               "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", str(out)],
                              stdin=subprocess.PIPE)
        start = 0.0
        for sc in story["scenes"]:
            for i in range(round(sc["dur"] * FPS)):
                t = i / FPS
                canvas = Image.new("RGB", (W, H), BAR)
                canvas.paste(scene_frame(sc, imgs, t, aw, ah), (ax, ay))
                dr = ImageDraw.Draw(canvas)
                cap_k = ease(t / 0.25)
                if sc["type"] == "end":
                    cy = ay + ah // 2
                    f1 = wrap_size(dr, story["name"], 64 if fmt == "shorts" else 46, aw - 80)
                    text_center(dr, W // 2, cy - 110, story["name"], f1)
                    text_center(dr, W // 2, cy - 20, story["price"], font(84 if fmt == "shorts" else 60), "#ffd166")
                    text_center(dr, W // 2, cy + 90, story["disclosure"], font(40 if fmt == "shorts" else 30))
                elif sc.get("caption") and cap_k > 0:
                    if fmt == "shorts":
                        f = wrap_size(dr, sc["caption"], 66, W - 80)
                        text_center(dr, W // 2, ay + ah + 90 + int((1 - cap_k) * 30), sc["caption"], f)
                    else:
                        f = wrap_size(dr, sc["caption"], 40, W - 80)
                        tw = dr.textlength(sc["caption"], font=f)
                        y = H - 110
                        dr.rounded_rectangle((W / 2 - tw / 2 - 24, y - 14, W / 2 + tw / 2 + 24, y + 62), 16, fill=(0, 0, 0))
                        text_center(dr, W // 2, y, sc["caption"], f)
                if fmt == "shorts":
                    text_center(dr, W // 2, 120, "돈 줍는 삼촌", font(44), "#e8e2d6")
                    text_center(dr, W // 2, 190, label, font(30), "#b9b2a5")
                    dr.rectangle((60, H - 90, 60 + (W - 120) * (start + t) / total, H - 84), fill="#d6452f")
                else:
                    f = font(22)
                    tw = dr.textlength(label, font=f)
                    dr.rounded_rectangle((W - tw - 40, 14, W - 14, 50), 10, fill=(0, 0, 0))
                    dr.text((W - tw - 27, 18), label, font=f, fill="white")
                ff.stdin.write(canvas.tobytes())
            start += sc["dur"]
        ff.stdin.close()
        if ff.wait():
            raise RuntimeError("ffmpeg 실패")
        print(f"{out} ({out.stat().st_size / 1e6:.2f}MB, {total:.1f}초)")


def _click_track(path: pathlib.Path, total: float, clicks: list[float]) -> None:
    expr = "+".join(f"0.6*(random(0)-0.5)*exp(-120*(t-{c:.2f}))*gte(t,{c:.2f})"
                    f"+0.25*sin(2*PI*2200*t)*exp(-60*(t-{c:.2f}))*gte(t,{c:.2f})" for c in clicks) or "0"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                    f"aevalsrc='{expr}':d={total:.2f}:s=44100", str(path)], check=True)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        compose(s)
