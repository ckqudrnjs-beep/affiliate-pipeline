"""밸런스게임 질문별 카톡·SNS 미리보기 이미지(1200x630) 생성.

실행(playground 폴더): python og.py
- static/og/q/<id>.png 가 없는 질문만 만든다(이미 있는 건 그대로).
- 한글 폰트가 없는 환경이면 아무것도 만들지 않고 끝낸다(사이트는 기본 og.png 사용).
- 매일 질문 자동 추가 작업이 질문을 넣은 뒤 이 스크립트를 돌려 이미지를 함께 커밋한다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "static" / "og" / "q"
FONTS = [
    "/usr/share/fonts/truetype/nanum/NanumGothicExtraBold.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]


def font_path() -> str | None:
    return next((f for f in FONTS if Path(f).exists()), None)


def wrap(draw, text: str, font, width: int) -> list[str]:
    lines, cur = [], ""
    for word in text.split(" "):
        test = (cur + " " + word).strip()
        if draw.textlength(test, font=font) <= width or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    out = []
    for ln in lines:  # 띄어쓰기 없이 긴 줄은 글자 단위로 자른다
        while draw.textlength(ln, font=font) > width:
            k = len(ln)
            while k > 1 and draw.textlength(ln[:k], font=font) > width:
                k -= 1
            out.append(ln[:k])
            ln = ln[k:]
        out.append(ln)
    return out[:3]


def make(q: dict, fp: str, path: Path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    W, H = 1200, 630
    im = Image.new("RGB", (W, H), (12, 6, 32))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W // 2, H], fill=(255, 90, 95))
    d.rectangle([W // 2, 0, W, H], fill=(47, 128, 237))
    small = ImageFont.truetype(fp, 40)
    vs = ImageFont.truetype(fp, 64)
    d.text((40, 30), "5락실 밸런스게임", font=small, fill="white")
    for side, text in ((0, q["a"]), (1, q["b"])):
        size = 64
        while size > 36:
            f = ImageFont.truetype(fp, size)
            lines = wrap(d, text, f, W // 2 - 110)
            if len(lines) <= 3 and all(d.textlength(x, font=f) <= W // 2 - 110 for x in lines):
                break
            size -= 4
        lh = int(size * 1.3)
        y = (H - lh * len(lines)) // 2 + 20
        for ln in lines:
            x = side * W // 2 + (W // 2 - d.textlength(ln, font=f)) // 2
            d.text((x, y), ln, font=f, fill="white")
            y += lh
    d.ellipse([W // 2 - 70, H // 2 - 50, W // 2 + 70, H // 2 + 90], fill=(12, 6, 32))
    d.text((W // 2 - d.textlength("VS", font=vs) // 2, H // 2 - 22), "VS", font=vs, fill=(255, 210, 63))
    d.text((40, H - 70), "너는 어느 쪽? 5raksil.com", font=small, fill="white")
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)


def main() -> int:
    fp = font_path()
    if not fp:
        print("한글 폰트 없음: 질문 이미지 생략")
        return 0
    qs = json.loads((HERE / "data" / "questions.json").read_text(encoding="utf-8"))
    n = 0
    for q in qs:
        p = OUT / f"{q['id']}.png"
        if not p.exists():
            make(q, fp, p)
            n += 1
    print(f"질문 이미지 {n}개 생성")
    return 0


if __name__ == "__main__":
    sys.exit(main())
