"""뮤직비디오 (BK 11/23 '1번'): 이미 있는 Kling 그림들을 천천히 확대·이동(Ken Burns) + 부드러운 전환으로
이어 붙이고, 곡 전체 가사를 아래에 띄운다. 새 그림 생성 없음(비용 0원).

장면(shots)은 config 의 mv.images 순서대로 돌린다. 좌표는 '그림 가로를 900 으로 본' 값
[x, y, 가로] 시작 → 끝 (세로는 16:9 로 자동).
"""
from __future__ import annotations

import math
import pathlib
import subprocess

W, H, FPS = 1920, 1080, 30
FONT = pathlib.Path("config/fonts/BlackHanSans-Regular.ttf")
SH, XF = 7.4, 1.0  # 장면 길이, 겹쳐 넘어가는 시간

# 다른 차원 끝 기본 장면: (그림 번호, 시작 [x,y,w], 끝 [x,y,w])
DEFAULT_SHOTS = [
    (0, (0, 0, 900), (0, 330, 900)), (0, (290, 240, 320), (335, 290, 230)), (0, (60, 0, 380), (100, 30, 290)),
    (2, (250, 80, 400), (320, 110, 280)), (1, (0, 394, 900), (60, 150, 780)), (1, (330, 340, 250), (280, 280, 360)),
    (3, (250, 60, 400), (320, 90, 280)), (0, (520, 290, 380), (570, 320, 320)), (1, (100, 500, 700), (170, 470, 560)),
    (0, (260, 0, 380), (100, 0, 700)), (2, (0, 0, 900), (150, 40, 600)), (1, (520, 0, 380), (560, 40, 300)),
    (4, (0, 0, 900), (160, 30, 560)), (1, (0, 300, 500), (40, 320, 420)), (0, (320, 540, 300), (280, 520, 380)),
    (1, (250, 0, 400), (200, 60, 500)),
]


def ease(t: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * min(max(t, 0.0), 1.0))


def shot_box(a, b, t: float, img_w: int, img_h: int):
    """t 초 시점의 잘라낼 상자 (원본 픽셀)."""
    s = img_w / 900
    e = ease(t / SH)
    x, y, w = (a[i] + (b[i] - a[i]) * e for i in range(3))
    h = w * 9 / 16
    return (x * s, y * s, min((x + w) * s, img_w), min((y + h) * s, img_h))


def plan(duration: float, n_shots: int) -> int:
    return max(1, math.ceil((duration - XF) / (SH - XF)))


def render(audio: pathlib.Path, images: list[pathlib.Path], subs: list, title: str, channel: str,
           out: pathlib.Path, duration: float, shots=None) -> pathlib.Path:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

    shots = shots or DEFAULT_SHOTS
    imgs = []
    for p in images:
        im = Image.open(p).convert("RGB")
        imgs.append(im.resize((2048, round(2048 * im.height / im.width)), Image.LANCZOS))
    seq = [s for s in shots if s[0] < len(imgs)]
    n = plan(duration, len(seq))
    seq = [seq[i % len(seq)] for i in range(n)]
    step = SH - XF

    def frame(i, t):
        k, a, b = seq[i]
        im = imgs[k]
        return np.asarray(im.resize((W, H), Image.BICUBIC, box=shot_box(a, b, t, *im.size)), dtype=np.float32)

    def layer(txt, size, pos, anchor, pill=False):
        f = ImageFont.truetype(str(FONT), size)
        L = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(L)
        if pill:
            x0, y0, x1, y1 = d.textbbox(pos, txt, font=f, anchor=anchor)
            d.rounded_rectangle((x0 - 34, y0 - 20, x1 + 34, y1 + 22), radius=30, fill=(25, 10, 50, 120))
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text(pos, txt, font=f, fill=(20, 0, 40, 210), anchor=anchor)
        L = Image.alpha_composite(L, sh.filter(ImageFilter.GaussianBlur(6)))
        ImageDraw.Draw(L).text(pos, txt, font=f, fill=(255, 255, 255, 240), anchor=anchor)
        a = np.asarray(L, dtype=np.float32)
        return a[..., :3], a[..., 3:] / 255

    def fit(txt):
        s = 58
        probe = ImageDraw.Draw(Image.new("L", (1, 1)))
        while s > 36 and probe.textlength(txt, font=ImageFont.truetype(str(FONT), s)) > W - 260:
            s -= 2
        return s

    corner = layer(f"{title}  |  {channel}", 40, (60, 40), "la")
    card = layer(title, 130, (W // 2, H // 2), "mm")
    sl = [(a, max(b, a + 1.2), layer(t, fit(t), (W // 2, 975), "mm", True)) for a, b, t in subs if a < duration]

    out.parent.mkdir(parents=True, exist_ok=True)
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-t", f"{duration:.2f}", "-i", str(audio),
                          "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                          "-pix_fmt", "yuv420p", "-af", f"afade=t=out:st={duration - 2:.2f}:d=2",
                          "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], stdin=subprocess.PIPE)

    def over(f, l, al):
        return f * (1 - l[1] * al) + l[0] * l[1] * al

    for k in range(int(duration * FPS)):
        T = k / FPS
        i = min(int(T // step), len(seq) - 1)
        t = T - i * step
        f = frame(i, t)
        if i > 0 and t < XF:
            f = f * (t / XF) + frame(i - 1, t + step) * (1 - t / XF)
        f = over(f, corner, min(1, max(0, T - 5)) * min(1, max(0, duration - T - 1)))
        if T < 6:
            f = over(f, card, min(1, T / 1.2) * min(1, max(0, (6 - T) / 1.2)))
        for a, b, l in sl:
            if a - 0.25 <= T <= b + 0.25:
                f = over(f, l, min(1, (T - a + 0.25) / 0.25, (b + 0.25 - T) / 0.25))
                break
        f = f * max(0, min(1, T / 1.5, (duration - T) / 2))
        p.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError("ffmpeg 뮤비 인코딩 실패")
    return out
