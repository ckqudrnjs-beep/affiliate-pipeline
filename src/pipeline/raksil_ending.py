"""5락실 쇼츠 공통 엔딩 컷 (BK 2026-11-20 "오락실 쇼츠 엔딩 컷 구독 좋아요 넣어야 함").

돈삼촌 만화의 엔딩 A(동전이 삐죽·손 흔들기)와 같은 결: 5락실 캐릭터 몽글이가 왼쪽에서 삐죽 나와 손을 흔들고,
'좋아요'·'구독' 버튼이 톡톡 튀어나온다. 약 2.6초. 밸런스게임·게임·사격장·몽글이 밈 쇼츠 끝에 똑같이 붙인다.

- 가짜 유도 없음: '구독 완료' 같은 거짓 화면, 보상 약속, 클릭 유도 문구를 쓰지 않는다. 이유 한 줄만("매일 새 게임과 새 질문").
- 쇼츠 화면의 오른쪽 버튼(좋아요·댓글)과 아래 제목 자리를 피한다: 그림은 x<900, y<1540 안에만.
- 글자는 5락실 쇼츠와 같은 폰트(Black Han Sans). 하트·재생 모양은 글자가 아니라 도형으로 그려 깨질 일이 없다.
- 이미 만든 mp4 뒤에 이어 붙인다(append). 몽글이 색은 날짜마다 바뀐다.

실행(미리보기): PYTHONPATH=src python -m pipeline.raksil_ending [--balance] [YYYY-MM-DD]  → media/raksil/ending-preview.mp4
"""
from __future__ import annotations

import datetime as dt
import math
import pathlib
import subprocess
import sys

from . import raksil_shorts as rs

W, H, FPS, SR = rs.W, rs.H, rs.FPS, rs.SR
DUR = 2.6
SAFE_X, SAFE_Y = 900, 1540  # 이 안에만 그린다 (쇼츠 오른쪽 버튼·아래 제목 자리)
LIKE_Y, SUB_Y = 615, 805
BTN_X0, BTN_X1 = 150, 800
MONGLE_Y = 1420  # 몽글이 발 위치
REASON = "매일 새 게임과 새 질문"  # 가운뎃점(·)은 폰트에 없어 쓰지 않는다
# 2026-11-22 BK '구독 좋아요 올릴 방안' → 막연한 부탁 대신 다음 편 볼 이유(올라오는 시각)를 준다.
# 내일 질문을 미리 보여주는 건 하지 않는다: 품질 게이트가 질문을 자주 다시 짜서 예고와 실제가 달라질 수 있다.
REASON_BALANCE = "매일 오후 5시 새 질문"
URL, URL_Y = "5raksil.com", 462  # 2026-11-20 BK: 쇼츠에 사이트 주소 (화면 글자만, 링크·스티커 아님)


def ease_back(x: float) -> float:
    """0→1, 끝에서 살짝 넘쳤다 돌아옴 (톡 튀어나오는 느낌)."""
    x = max(0.0, min(1.0, x))
    c = 1.70158
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def heart(d, cx: float, cy: float, r: float, fill) -> None:
    d.ellipse((cx - r, cy - r * 0.9, cx, cy + r * 0.1), fill=fill)
    d.ellipse((cx, cy - r * 0.9, cx + r, cy + r * 0.1), fill=fill)
    d.polygon([(cx - r * 0.97, cy - r * 0.25), (cx + r * 0.97, cy - r * 0.25), (cx, cy + r * 0.95)], fill=fill)


def play_icon(d, cx: float, cy: float, r: float, fill) -> None:
    d.polygon([(cx - r * 0.55, cy - r * 0.7), (cx - r * 0.55, cy + r * 0.7), (cx + r * 0.75, cy)], fill=fill)


def button(img, y: int, label: str, color, icon: str, k: float, press: float = 0.0) -> None:
    """둥근 버튼. k=등장(0~1+), press=눌림(0~1)."""
    from PIL import Image, ImageDraw
    if k <= 0.01:
        return
    s = k * (1 - 0.08 * press)
    cx = (BTN_X0 + BTN_X1) / 2
    hw, hh = (BTN_X1 - BTN_X0) / 2 * s, 80 * s
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rounded_rectangle((cx - hw, y - hh, cx + hw, y + hh), radius=int(hh), fill=tuple(int(c * 0.25) for c in color) + (235,),
                        outline=color + (255,), width=max(2, int(8 * s)))
    ix = cx - hw + 110 * s
    d.ellipse((ix - 56 * s, y - 56 * s, ix + 56 * s, y + 56 * s), fill=color + (255,))
    (heart if icon == "heart" else play_icon)(d, ix + (0 if icon == "heart" else 4 * s), y + (4 * s if icon == "heart" else 0),
                                             34 * s, (255, 255, 255, 255))
    img.alpha_composite(ov)
    size = max(10, int(92 * s))
    rs.glow_text(img, (cx + 60 * s, y + 4 * s), [label], rs.font(size), size, color, glow=10)


def sparkle(img, cx: float, cy: float, t: float, color) -> None:
    """버튼 눌릴 때 반짝이 (0~0.5초)."""
    from PIL import Image, ImageDraw
    if not 0 <= t < 0.5:
        return
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    a = int(255 * (1 - t / 0.5))
    for i in range(8):
        ang = i * math.pi / 4
        r0, r1 = 60 + 220 * t, 90 + 300 * t
        d.line((cx + math.cos(ang) * r0, cy + math.sin(ang) * r0, cx + math.cos(ang) * r1, cy + math.sin(ang) * r1),
               fill=color + (a,), width=8)
    img.alpha_composite(ov)


def mongle(day: dt.date):
    """몽글이 꼬마(2단계) 웃는 얼굴 + 몸 색 (손 그릴 때 씀)."""
    from . import raksil_meme as rm
    pal = rm.PALS[day.toordinal() % len(rm.PALS)]
    spr = rm.sprite(rm._atlas(), pal, 2, None, "happy", 1.7)
    import numpy as np
    a = np.asarray(spr)
    body = a[(a[..., 3] > 250) & (a[..., :3].sum(axis=2) > 360)][:, :3]  # 불투명하고 밝은 칸 = 몸
    return spr, tuple(int(v) for v in np.median(body, axis=0))


def bubble(img, x: float, y: float, text: str, k: float) -> None:
    from PIL import Image, ImageDraw
    if k <= 0.01:
        return
    f = rs.font(int(58 * k))
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    tw = d.textlength(text, font=f)
    x0, y0, x1, y1 = x, y - 60 * k, x + tw + 70 * k, y + 60 * k
    d.rounded_rectangle((x0, y0, x1, y1), radius=int(50 * k), fill=(255, 255, 255, 240))
    d.polygon([(x0 + 10 * k, y + 20 * k), (x0 - 40 * k, y + 70 * k), (x0 + 50 * k, y + 40 * k)], fill=(255, 255, 255, 240))
    d.text(((x0 + x1) / 2, y), text, font=f, fill=(60, 30, 90, 255), anchor="mm")
    img.alpha_composite(ov)


def frame(t: float, spr, body, bg, reason: str = REASON):
    """엔딩 t초 장면."""
    from PIL import Image, ImageDraw
    img = bg.copy()
    rs.header(img, "오늘도 재밌었다면")
    # 버튼: 좋아요 0.15초, 구독 0.35초에 톡. 1.1초·1.5초에 '꾹' 눌리는 손짓(반짝)만, 결과 화면은 없음.
    pl = max(0.0, 1 - abs(t - 1.15) / 0.12) if 1.03 < t < 1.27 else 0.0
    ps = max(0.0, 1 - abs(t - 1.55) / 0.12) if 1.43 < t < 1.67 else 0.0
    button(img, LIKE_Y, "좋아요", rs.PINK, "heart", ease_back((t - 0.15) / 0.3), pl)
    button(img, SUB_Y, "구독", rs.YEL, "play", ease_back((t - 0.35) / 0.3), ps)
    sparkle(img, BTN_X0 + 110, LIKE_Y, t - 1.15, rs.PINK)
    sparkle(img, BTN_X0 + 110, SUB_Y, t - 1.55, rs.YEL)
    # 몽글이: 왼쪽 밖에서 삐죽 (0~0.45초), 몸을 살랑, 손 흔들기
    k = ease_back(t / 0.45)
    x = -spr.width * 0.62 + spr.width * 0.50 * k
    rot = -14 + 6 * math.sin(t * 7)
    s = spr.rotate(rot, resample=Image.BICUBIC, expand=True)
    y = MONGLE_Y - s.height * 0.88
    from .raksil_meme import _paste_clip
    _paste_clip(img, s, int(x - (s.width - spr.width) / 2), int(y))
    if t > 0.3:  # 손 (몸 색 동그라미), 위아래로 흔듦
        ang = -0.9 + 0.55 * math.sin(t * 14)
        cx, cy = x + spr.width * 0.62, MONGLE_Y - spr.height * 0.42
        hx, hy = cx + math.cos(ang) * 45, cy + math.sin(ang) * 45
        d = ImageDraw.Draw(img)
        d.ellipse((hx - 42, hy - 42, hx + 42, hy + 42), fill=body + (255,), outline=(74, 44, 48, 255), width=5)
    bubble(img, x + spr.width * 0.80 + 50, MONGLE_Y - spr.height * 0.64, "또 놀러 와!", ease_back((t - 0.55) / 0.3))
    rs.glow_text(img, (W / 2, 345), [reason], rs.font(60), 60, rs.CYAN, glow=6)
    url(img, ease_back((t - 0.05) / 0.3))
    return img


def url(img, k: float) -> None:
    """사이트 주소 알약 (버튼과 같은 가로 자리, 안전영역 안)."""
    from PIL import Image, ImageDraw
    if k <= 0.01:
        return
    cx = (BTN_X0 + BTN_X1) / 2
    hw, hh = (BTN_X1 - BTN_X0) / 2 * 0.8 * k, 50 * k
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rounded_rectangle((cx - hw, URL_Y - hh, cx + hw, URL_Y + hh), radius=int(hh),
                                         fill=(255, 255, 255, 235))
    img.alpha_composite(ov)
    size = max(10, int(66 * k))
    d = ImageDraw.Draw(img)
    d.text((cx, URL_Y + 2 * k), URL, font=rs.font(size), fill=(60, 30, 90, 255), anchor="mm")


def audio_clip():
    """뾱(버튼) 두 번 + 반짝 효과음. 1채널 SR."""
    import numpy as np
    a = np.zeros(int(SR * DUR), dtype=np.float32)
    rs.place(a, np.concatenate([rs.tone(784, 0.06, 0.16, "sine"), rs.tone(1175, 0.12, 0.16, "sine")]), 0.15)
    rs.place(a, np.concatenate([rs.tone(880, 0.06, 0.16, "sine"), rs.tone(1319, 0.12, 0.16, "sine")]), 0.35)
    for at in (1.15, 1.55):
        rs.place(a, np.concatenate([rs.tone(1568, 0.05, 0.12), rs.tone(2093, 0.14, 0.12, "sine")]), at)
    rs.place(a, np.concatenate([rs.tone(659, 0.1, 0.1, "sine"), rs.tone(784, 0.1, 0.1, "sine"),
                                rs.tone(1047, 0.3, 0.1, "sine")]), 1.9)
    return np.clip(a, -1, 1)


def render_clip(out: pathlib.Path, day: dt.date, reason: str = REASON) -> pathlib.Path:
    import wave
    spr, body = mongle(day)
    bg = rs.background(31)
    wav = out.with_suffix(".wav")
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio_clip() * 32767).astype("<i2").tobytes())
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium",
                           "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest",
                           "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
    for i in range(int(DUR * FPS)):
        ff.stdin.write(frame(i / FPS, spr, body, bg, reason).convert("RGB").tobytes())
    ff.stdin.close()
    ok = ff.wait() == 0
    wav.unlink(missing_ok=True)
    if not ok:
        raise RuntimeError("엔딩 ffmpeg 실패")
    return out


def append(mp4: pathlib.Path, day: dt.date, reason: str = REASON) -> float:
    """mp4 뒤에 엔딩을 이어 붙여 같은 파일로 바꾼다. 늘어난 초를 돌려준다. reason=버튼 위 이유 한 줄."""
    mp4 = pathlib.Path(mp4)
    end = render_clip(mp4.with_name(mp4.stem + "-ending.mp4"), day, reason)
    tmp = mp4.with_name(mp4.stem + "-joined.mp4")
    fc = ("[0:v]setsar=1,fps=30[v0];[1:v]setsar=1,fps=30[v1];"
          "[0:a]aformat=sample_rates=44100:channel_layouts=mono[a0];[1:a]aformat=sample_rates=44100:channel_layouts=mono[a1];"
          "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4), "-i", str(end), "-filter_complex", fc,
                        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p",
                        "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(tmp)])
    end.unlink(missing_ok=True)
    if r.returncode != 0:
        tmp.unlink(missing_ok=True)
        raise RuntimeError("엔딩 붙이기 실패")
    tmp.replace(mp4)
    return DUR


def main(argv: list[str]) -> int:
    reason = REASON_BALANCE if "--balance" in argv else REASON
    argv = [a for a in argv if a != "--balance"]
    day = dt.date.fromisoformat(argv[1]) if len(argv) > 1 else dt.datetime.now(rs.KST).date()
    rs.OUT.mkdir(parents=True, exist_ok=True)
    out = render_clip(rs.OUT / "ending-preview.mp4", day, reason)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
