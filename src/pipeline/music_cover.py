"""커버 영상 (BK 결정 11/21 20:30 KST): 곡마다 커버 이미지를 입힌 노래 영상. 아이돌·보이그룹 곡 + 가끔 발라드.

커버: BK가 넣은 이미지가 있으면 그것, 없으면 Suno 곡 파일 안에 든 커버(mp3 첨부 그림)를 쓴다.
화면: 흐리게 키운 커버가 천천히 움직이는 배경 + 가운데 커버 + 곡 제목 + 파형·진행 막대 + 반짝이(스크린 합성).
비용 0원. 장면 그림은 커버마다 달라서 '같은 화면 반복'이 생기지 않는다.
"""
from __future__ import annotations

import math
import pathlib
import random
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

from .music_video import FPS, dur, font, fsel

LOOP = 10.0


def extract_cover(mp3: pathlib.Path, out: pathlib.Path) -> pathlib.Path | None:
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-an", "-c:v", "copy", str(out)])
    return out if r.returncode == 0 and out.exists() and out.stat().st_size > 0 else None


def _sharp_up(im: Image.Image, size: int) -> Image.Image:
    im = im.convert("RGB").resize((size, size), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))


def _bg(cover: Image.Image, w: int, h: int, pad: float = 1.18) -> Image.Image:
    s = int(max(w, h) * pad)
    bg = cover.convert("RGB").resize((s, s), Image.LANCZOS).filter(ImageFilter.GaussianBlur(s / 40))
    bg = ImageEnhance.Brightness(bg).enhance(0.55)
    return bg.crop(((s - int(w * pad)) // 2, (s - int(h * pad)) // 2, (s + int(w * pad)) // 2, (s + int(h * pad)) // 2))


def _card(cover: Image.Image, size: int) -> Image.Image:
    """그림자 + 둥근 모서리 커버."""
    pad = int(size * 0.08)
    c = _sharp_up(cover, size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 28, fill=255)
    out = Image.new("RGBA", (size + pad * 2, size + pad * 2), (0, 0, 0, 0))
    sh = Image.new("L", out.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle((pad, pad + size // 40, pad + size, pad + size + size // 40), radius=size // 28, fill=170)
    sh = sh.filter(ImageFilter.GaussianBlur(size // 25))
    out.paste((0, 0, 0, 255), (0, 0), sh)
    out.paste(c, (pad, pad), mask)
    return out


def _sparkles(w: int, h: int, out: pathlib.Path, seed: int = 4):
    """검은 바탕 반짝이 10초 반복 (screen 합성용)."""
    r = random.Random(seed)
    pts = [(r.uniform(0, w), r.uniform(0, 1), r.uniform(1.5, 4.0), r.randint(1, 2), r.uniform(0, 6.28), r.randint(1, 3))
           for _ in range(70)]
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                          "-pix_fmt", "yuv420p", str(out)], stdin=subprocess.PIPE)
    for i in range(int(LOOP * FPS)):
        ph = i / (LOOP * FPS)
        im = Image.new("RGB", (w, h))
        d = ImageDraw.Draw(im)
        for x, y0, rad, k, p0, tw in pts:
            y = h - ((y0 + k * ph) % 1.0) * h
            a = 0.5 + 0.5 * math.sin(2 * math.pi * tw * ph + p0)
            c = int(60 + 150 * a)
            xx = x + 12 * math.sin(2 * math.pi * ph + p0)
            d.ellipse((xx - rad, y - rad, xx + rad, y + rad), fill=(c, c, c))
        im = im.filter(ImageFilter.GaussianBlur(1.2))
        p.stdin.write(im.tobytes())
    p.stdin.close()
    p.wait()


def _vf_common(W, H, total, wave_w, wave_x, wave_y):
    return (f"[0:v]crop={W}:{H}:x='(in_w-{W})/2+(in_w-{W})/2*sin(2*PI*t/40)':y='(in_h-{H})/2+(in_h-{H})/2*cos(2*PI*t/55)',"
            f"setsar=1,format=rgba[bg];"
            f"[bg][1:v]overlay=0:0[c1];"
            f"[2:v]format=gbrp[sp];[c1]format=gbrp[c1g];[c1g][sp]blend=all_mode=screen:all_opacity=0.55,format=rgba[c2];"
            f"[3:a]aformat=channel_layouts=mono,showwaves=s={wave_w}x90:mode=cline:draw=full:rate={FPS}:colors=0xFFFFFF,"
            f"format=rgba,colorkey=0x000000:0.1:0[wv];[c2][wv]overlay={wave_x}:{wave_y}[c3];"
            f"color=c=0xFFFFFF@0.85:s={W}x6:r={FPS}[bar];[c3][bar]overlay=x='-W+W*t/{total:.3f}':y=H-6:shortest=1[v]")


def _sub_png(text: str, W: int, out: pathlib.Path, size: int = 54):
    im = Image.new("RGBA", (W, 130), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = size
    while s > 34 and d.textlength(text, font=font(fsel(text, True), s)) > W - 160:
        s -= 2
    f = font(fsel(text, True), s)
    tw = d.textlength(text, font=f)
    b = d.textbbox((0, 0), text, font=f)
    h = b[3] - b[1]
    x0 = (W - tw) / 2
    d.rounded_rectangle((x0 - 34, 65 - h / 2 - 22, x0 + tw + 34, 65 + h / 2 + 22), radius=30, fill=(10, 6, 24, 165))
    d.text((x0, 65 - h / 2 - b[1]), text, font=f, fill=(255, 255, 255, 255))
    im.save(out)


def video(track: pathlib.Path, cover_path: pathlib.Path, title: str, artist: str, tag: str, out: pathlib.Path,
          vertical: bool = False, start: float = 0.0, length: float | None = None, cta: str = "",
          subs: list | None = None) -> dict:
    """subs: [(시작초, 끝초, 가사 줄)] — 클립 기준 시각. 세로 영상에서 그림 아래쪽에 가사 자막."""
    cover = Image.open(cover_path)
    W, H = (1080, 1920) if vertical else (1920, 1080)
    total = (length or dur(track) - start)
    with tempfile.TemporaryDirectory() as td:
        td = pathlib.Path(td)
        _bg(cover, W, H).save(td / "bg.png")
        fg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(fg)
        m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", title)
        main_t, ver = (m.group(1), m.group(2)) if m else (title, "")

        def fit(text, size, bold, max_w):
            while size > 36 and d.textlength(text, font=font(fsel(text, bold), size)) > max_w:
                size -= 4
            return size
        if vertical:
            card = _card(cover, 860)
            fg.alpha_composite(card, ((W - card.width) // 2, 230))
            y = 230 + card.height + 10
            rows = [(main_t, fit(main_t, 84, True, W - 100), (255, 255, 255, 255), True)]
            if ver:
                rows.append((ver, 40, (255, 225, 245, 240), False))
            rows += [(artist, 44, (255, 255, 255, 210), False), (tag, 34, (255, 210, 240, 220), False)]
            for text, size, col, bold in rows:
                f = font(fsel(text, bold), size)
                tw = d.textlength(text, font=f)
                d.text(((W - tw) / 2, y), text, font=f, fill=col)
                y += int(size * 1.45)
            if cta:
                f = font(fsel(cta), 40)
                tw = d.textlength(cta, font=f)
                d.rounded_rectangle(((W - tw) / 2 - 36, 1700, (W + tw) / 2 + 36, 1700 + 84), radius=42, fill=(0, 0, 0, 120))
                d.text(((W - tw) / 2, 1716), cta, font=f, fill=(255, 255, 255, 255))
            wave = (860, (W - 860) // 2, 1590)
        else:
            card = _card(cover, 720)
            cx = 170
            fg.alpha_composite(card, (cx - card.width // 10, (H - card.height) // 2))
            tx = cx + 720 + 120
            y = H // 2 - (190 if ver else 150)
            rows = [(tag, 34, (255, 210, 240, 230), False), (main_t, fit(main_t, 92, True, W - tx - 100), (255, 255, 255, 255), True)]
            if ver:
                rows.append((ver, 42, (255, 225, 245, 240), False))
            rows.append((artist, 46, (255, 255, 255, 210), False))
            for text, size, col, bold in rows:
                f = font(fsel(text, bold), size)
                d.text((tx, y), text, font=f, fill=col)
                y += int(size * 1.6)
            wave = (W - tx - 140, tx, y + 30)
        fg.save(td / "fg.png")
        _sparkles(W, H, td / "sp.mp4")
        fc = _vf_common(W, H, total, *wave)
        sub_in = []
        if subs:
            fc = fc[: -len("[v]")] + "[s0]"
            sy = 1060 if vertical else H - 210
            for k, (a, b, text) in enumerate(subs):
                png = td / f"sub{k}.png"
                _sub_png(text, W, png)
                sub_in += ["-loop", "1", "-i", str(png)]
                fc += (f";[s{k}][{4 + k}:v]overlay=0:{sy}:enable='between(t,{a:.2f},{b:.2f})'"
                       + ("[v]" if k == len(subs) - 1 else f"[s{k + 1}]"))
        a_in = ["-ss", str(start)] + (["-t", str(length)] if length else []) + ["-i", str(track)]
        af = "loudnorm=I=-14:TP=-1.5"
        if length:
            af = f"afade=t=in:d=1.5,afade=t=out:st={length - 2.5}:d=2.5," + af
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-r", str(FPS), "-i", str(td / "bg.png"),
                        "-loop", "1", "-i", str(td / "fg.png"), "-stream_loop", "-1", "-i", str(td / "sp.mp4")] + a_in + sub_in +
                       ["-filter_complex", fc + f";[3:a]{af}[a]", "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
                        "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(out)], check=True)
    return {"video": str(out), "duration": total}
