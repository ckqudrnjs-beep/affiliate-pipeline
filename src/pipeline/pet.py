"""삼촌네 강아지 '동전이' — 쇼츠 고정 마스코트 (2026-11-17 BK "애니메이션·애완동물처럼 시선 끄는 것").

실제 반려동물 영상이 아니라 코드로 그린 둥근 시바 강아지 스티커. 외부 그림·비용 없음.
포즈: happy(혀·꼬리), shock(놀람), coin(동전 물고 뿌듯), curious(갸웃), cry(눈물), sleep(잠).
draw(pose, size, t) → RGBA. t(초)로 꼬리·귀가 살짝 움직인다.
"""
from __future__ import annotations

import math

POSES = ("happy", "shock", "coin", "curious", "cry", "sleep")
INK = (40, 28, 22)
FUR = (236, 152, 70)
FUR_D = (214, 124, 50)
CREAM = (255, 240, 214)
PINK = (246, 150, 160)
RED = (214, 52, 58)
GOLD = (255, 200, 60)
GOLD_D = (210, 150, 30)


def _rot(pts, cx, cy, a):
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def draw(pose: str = "happy", size: int = 320, t: float = 0.0):
    from PIL import Image, ImageDraw
    S = 1000  # 크게 그리고 줄인다 (부드러운 선)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lw = 16
    pose = pose if pose in POSES else "happy"
    sleep = pose == "sleep"
    wag = math.sin(t * (14 if pose in ("happy", "coin") else 5)) * (0.35 if pose in ("happy", "coin") else 0.12)

    # 꼬리 (몸 뒤 동그랗게 말린 꼬리, 흔들림)
    tail = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    td = ImageDraw.Draw(tail)
    tb = [640, 420, 860, 640]
    td.ellipse(tb, fill=INK)
    td.ellipse([tb[0] + 16, tb[1] + 16, tb[2] - 16, tb[3] - 16], fill=FUR)
    td.ellipse([tb[0] + 70, tb[1] + 70, tb[2] - 70, tb[3] - 70], fill=CREAM, outline=INK, width=lw)
    tail = tail.rotate(math.degrees(wag), center=(640, 640), resample=Image.BICUBIC)
    im.alpha_composite(tail)
    d = ImageDraw.Draw(im)

    # 몸
    by = 690 if not sleep else 740
    d.ellipse([250, by - 170, 750, by + 230], fill=FUR, outline=INK, width=lw)
    d.ellipse([370, by - 80, 630, by + 210], fill=CREAM)
    # 발
    for fx in (330, 560):
        d.ellipse([fx, by + 150, fx + 120, by + 250], fill=CREAM, outline=INK, width=lw)

    # 머리 (갸웃이면 기울임)
    hx, hy = 500, 400 if not sleep else 560
    tilt = {"curious": -0.22, "cry": 0.08, "sleep": 0.1}.get(pose, 0.0) + (math.sin(t * 3) * 0.03)
    head = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    h = ImageDraw.Draw(head)
    ear_up = 0 if pose != "shock" else -30
    ear_droop = 60 if pose in ("cry", "sleep") else 0
    for side in (-1, 1):
        ex = hx + side * 190
        pts = [(ex - side * 110, hy - 150), (ex + side * 40, hy - 330 + ear_up + ear_droop), (ex + side * 120, hy - 70)]
        h.polygon(pts, fill=FUR, outline=INK, width=lw)
        inner = [(ex - side * 60, hy - 150), (ex + side * 35, hy - 270 + ear_up + ear_droop), (ex + side * 80, hy - 100)]
        h.polygon(inner, fill=PINK)
    h.ellipse([hx - 290, hy - 250, hx + 290, hy + 250], fill=FUR, outline=INK, width=lw)
    # 볼·주둥이 크림
    h.ellipse([hx - 250, hy - 10, hx - 20, hy + 230], fill=CREAM)
    h.ellipse([hx + 20, hy - 10, hx + 250, hy + 230], fill=CREAM)
    h.ellipse([hx - 150, hy + 20, hx + 150, hy + 240], fill=CREAM)
    # 눈썹 점 (시바 특징)
    for side in (-1, 1):
        h.ellipse([hx + side * 105 - 28, hy - 150, hx + side * 105 + 28, hy - 112], fill=CREAM)
    # 볼터치
    for side in (-1, 1):
        h.ellipse([hx + side * 185 - 50, hy + 50, hx + side * 185 + 50, hy + 100], fill=(250, 170, 150))
    # 눈
    for side in (-1, 1):
        ex, ey = hx + side * 110, hy - 40
        if pose in ("happy", "coin"):
            h.arc([ex - 50, ey - 40, ex + 50, ey + 40], 200, 340, fill=INK, width=20)
        elif pose == "sleep":
            h.arc([ex - 50, ey - 50, ex + 50, ey + 20], 20, 160, fill=INK, width=18)
        elif pose == "cry":
            h.line([(ex - 45, ey), (ex + 45, ey + (12 * side))], fill=INK, width=20)
            k = (t * 1.6) % 1
            h.ellipse([ex - 22 + side * 10, ey + 30 + 140 * k, ex + 22 + side * 10, ey + 90 + 140 * k], fill=(120, 190, 250), outline=INK, width=6)
        elif pose == "shock":
            h.ellipse([ex - 62, ey - 66, ex + 62, ey + 66], fill="white", outline=INK, width=lw)
            h.ellipse([ex - 20, ey - 20, ex + 20, ey + 20], fill=INK)
        else:  # curious
            h.ellipse([ex - 42, ey - 50, ex + 42, ey + 50], fill=INK)
            h.ellipse([ex - 22, ey - 34, ex + 4, ey - 8], fill="white")
            h.ellipse([ex + 8, ey + 10, ex + 22, ey + 24], fill="white")
    # 코
    h.rounded_rectangle([hx - 44, hy + 40, hx + 44, hy + 92], 26, fill=INK)
    h.ellipse([hx - 22, hy + 48, hx - 2, hy + 62], fill=(120, 110, 110))
    # 입
    my = hy + 95
    if pose == "shock":
        h.ellipse([hx - 45, my + 20, hx + 45, my + 130], fill=(120, 30, 40), outline=INK, width=lw)
    elif pose == "cry":
        h.arc([hx - 60, my + 30, hx + 60, my + 110], 200, 340, fill=INK, width=14)
    elif pose == "sleep":
        h.arc([hx - 30, my, hx + 30, my + 40], 20, 160, fill=INK, width=12)
    else:
        h.arc([hx - 80, my - 30, hx, my + 40], 20, 160, fill=INK, width=14)
        h.arc([hx, my - 30, hx + 80, my + 40], 20, 160, fill=INK, width=14)
        if pose == "happy":
            h.chord([hx - 40, my + 10, hx + 40, my + 110], 0, 180, fill=PINK, outline=INK, width=10)
    if pose == "coin":  # 입에 문 금화
        cx, cy = hx, my + 95
        h.ellipse([cx - 95, cy - 95, cx + 95, cy + 95], fill=GOLD, outline=INK, width=lw)
        h.ellipse([cx - 68, cy - 68, cx + 68, cy + 68], outline=GOLD_D, width=10)
        _won(h, cx, cy, 40)
    head = head.rotate(math.degrees(-tilt), center=(hx, hy + 100), resample=Image.BICUBIC)
    # 목걸이 + 동전 이름표
    if not sleep:
        d.arc([300, by - 250, 700, by - 50], 30, 150, fill=INK, width=60)
        d.arc([300, by - 250, 700, by - 50], 30, 150, fill=RED, width=36)
    im.alpha_composite(head)
    d = ImageDraw.Draw(im)
    if pose not in ("sleep", "coin"):
        tx2, ty2 = 500, by - 40 + int(6 * math.sin(t * 8))
        d.ellipse([tx2 - 52, ty2 - 52, tx2 + 52, ty2 + 52], fill=GOLD, outline=INK, width=12)
        _won(d, tx2, ty2, 24)
    if sleep:  # Zzz
        k = (t * 0.8) % 1
        for j, r in enumerate((40, 54, 70)):
            zx, zy = 760 + j * 60, 300 - j * 80 - int(40 * k)
            d.line([(zx - r / 2, zy - r / 2), (zx + r / 2, zy - r / 2), (zx - r / 2, zy + r / 2), (zx + r / 2, zy + r / 2)], fill=INK, width=12)
    return im.resize((size, size), Image.LANCZOS)


def _won(d, cx, cy, r):
    """₩ 기호를 선으로 (폰트 없이)."""
    w = 10 if r > 28 else 8
    pts = [(cx - r, cy - r), (cx - r / 2, cy + r), (cx, cy - r / 3), (cx + r / 2, cy + r), (cx + r, cy - r)]
    d.line(pts, fill=INK, width=w, joint="curve")
    d.line([(cx - r * 1.1, cy - r * 0.05), (cx + r * 1.1, cy - r * 0.05)], fill=INK, width=w - 3)


def sheet(path: str):
    from PIL import Image
    out = Image.new("RGB", (6 * 330, 360), (250, 246, 238))
    for i, p in enumerate(POSES):
        out.paste(draw(p, 320, 0.3), (i * 330 + 5, 20), draw(p, 320, 0.3))
    out.save(path)


if __name__ == "__main__":
    import sys
    sheet(sys.argv[1] if len(sys.argv) > 1 else "pet-sheet.png")
