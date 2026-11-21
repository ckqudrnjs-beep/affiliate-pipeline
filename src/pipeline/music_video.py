"""음악 채널(Deep Work Lab) 영상 자동 조립: 커버 + Suno 곡 → 롱폼(16:9)·쇼츠(9:16).

BK가 만든 곡(mp3/wav)을 폴더에 넣으면:
  1) 테마 장면을 10초 반복 애니메이션으로 그림 (music_scene, 0원)
  2) 곡을 이어 붙이고(크로스페이드), 곡마다 'Now playing' 자막 + 전체 진행 막대 + 파형
  3) 설명란용 챕터(00:00 곡명)·AI 표기 문구를 함께 만든다.
업로드는 별도(music_upload, BK가 OAuth 연결한 뒤). 이 파일은 만들기만 한다.
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

from .music_scene import LOOP, Scene

FPS = 24
FONT_EN = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
FONT_EN_L = "/usr/share/fonts/opentype/inter/Inter-Light.otf"
FONT_KO = "config/fonts/GowunBatang-Bold.ttf"
FONT_KO_L = "config/fonts/GowunBatang-Regular.ttf"
XFADE = 3.0  # 곡 사이 크로스페이드(초)

AI_NOTE = ("🎧 이 채널의 음악은 AI 음악 도구(Suno, 유료 플랜)로 직접 만들고, 영상은 직접 그린 장면으로 조립했습니다.\n"
           "Music made with Suno (paid plan, commercial use) · visuals originally drawn.")


def font(path, size):
    return ImageFont.truetype(path, size)


def _ko(text: str) -> bool:
    return any("\uac00" <= ch <= "\ud7a3" for ch in text)


def fsel(text: str, bold: bool = True) -> str:
    """한글이 있으면 고운바탕, 없으면 Inter."""
    if _ko(text):
        return FONT_KO if bold else FONT_KO_L
    return FONT_EN if bold else FONT_EN_L


def dur(p) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def stamp(sec: float) -> str:
    sec = int(round(sec))
    h, m, s = sec // 3600, sec % 3600 // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def render_loop(scene: Scene, out: pathlib.Path):
    """LOOP 초짜리 반복 애니메이션 mp4."""
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{scene.w}x{scene.h}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
                          "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(out)], stdin=subprocess.PIPE)
    for i in range(int(LOOP * FPS)):
        p.stdin.write(scene.frame(i / FPS).tobytes())
    p.stdin.close()
    p.wait()


def text_png(w, h, lines, out, pad=40, box=True, align="left"):
    """[(text, fontpath, size, rgba)] 를 반투명 상자 위에 쓴 PNG."""
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    need = max(probe.textlength(t, font=font(fsel(t, fp in (FONT_EN, FONT_KO)), sz)) for t, fp, sz, _ in lines)
    w = max(w, int(need + pad * 2))  # 긴 제목이 잘리지 않게 상자를 넓힘
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if box:
        d.rounded_rectangle((0, 0, w - 1, h - 1), radius=28, fill=(10, 10, 20, 150))
    y = pad
    for text, fp, size, col in lines:
        f = font(fsel(text, fp in (FONT_EN, FONT_KO)) if fp in (FONT_EN, FONT_EN_L, FONT_KO, FONT_KO_L) else fp, size)
        tw = d.textlength(text, font=f)
        x = pad if align == "left" else (w - tw) / 2
        d.text((x, y), text, font=f, fill=col)
        y += int(size * 1.35)
    im.save(out)
    return out


def join_audio(tracks: list[pathlib.Path], out: pathlib.Path) -> list[float]:
    """크로스페이드로 이어 붙이고 각 곡 시작 시각을 돌려준다. -14 LUFS 근처로 맞춤."""
    starts, t = [], 0.0
    for i, tr in enumerate(tracks):
        starts.append(t)
        t += dur(tr) - (XFADE if i < len(tracks) - 1 else 0)
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    for tr in tracks:
        args += ["-i", str(tr)]
    if len(tracks) == 1:
        fc = "[0:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
    else:
        fc, prev = "", "0:a"
        for i in range(1, len(tracks)):
            nxt = f"x{i}"
            fc += f"[{prev}][{i}:a]acrossfade=d={XFADE}:c1=tri:c2=tri[{nxt}];"
            prev = nxt
        fc += f"[{prev}]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
    subprocess.run(args + ["-filter_complex", fc, "-map", "[a]", "-ar", "48000", "-c:a", "pcm_s16le", str(out)],
                   check=True)
    return starts


def longform(tracks: list[pathlib.Path], titles: list[str], theme: str, ep_title: str, out: pathlib.Path,
             seed: int = 7, scene_cls=Scene) -> dict:
    W, H = 1920, 1080
    with tempfile.TemporaryDirectory() as td:
        td = pathlib.Path(td)
        sc = scene_cls(W, H, theme, seed)
        render_loop(sc, td / "loop.mp4")
        starts = join_audio(tracks, td / "mix.wav")
        total = dur(td / "mix.wav")
        ends = starts[1:] + [total]
        # 곡마다 왼쪽 아래 자막
        ov_inputs, chain, last = [], "", "bg"
        for i, (title, a, b) in enumerate(zip(titles, starts, ends)):
            png = text_png(760, 170, [(f"NOW PLAYING · {i + 1:02d} / {len(titles):02d}", FONT_EN, 26, (255, 220, 170, 230)),
                                       (title, FONT_EN, 52, (255, 255, 255, 255))], td / f"t{i}.png")
            ov_inputs.append(png)
            nxt = f"v{i}"
            fade_in, fade_out = a + 0.5, b - 1.5
            chain += (f"[{3 + i}:v]format=rgba,fade=t=in:st={fade_in}:d=1:alpha=1,fade=t=out:st={fade_out}:d=1:alpha=1[o{i}];"
                      f"[{last}][o{i}]overlay=70:{H - 240}:enable='between(t,{a},{b})'[{nxt}];")
            last = nxt
        head = text_png(900, 110, [(ep_title, FONT_EN_L, 40, (255, 255, 255, 235))], td / "head.png", pad=30)
        hi = 3 + len(titles)
        fc = (f"[0:v]setpts=PTS-STARTPTS,format=rgba[bg];" + chain +
              f"[{hi}:v]format=rgba,fade=t=in:st=0.5:d=1.5:alpha=1,fade=t=out:st=12:d=1.5:alpha=1[hd];"
              f"[{last}][hd]overlay=(W-w)/2:40:enable='lt(t,14)'[vh];"
              # 파형 (오른쪽 아래)
              f"[1:a]aformat=channel_layouts=mono,showwaves=s=520x110:mode=cline:draw=full:rate={FPS}:colors=0xFFE0B0,format=rgba,colorkey=0x000000:0.1:0[wv];[vh][wv]overlay=W-w-70:{H - 200}[vw];"
              # 전체 진행 막대
              f"color=c=0xFFD9A0:s={W}x6:r={FPS}[bar];[vw][bar]overlay=x='-W+W*t/{total:.3f}':y=H-6:shortest=1[v]")
        args = ["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "-1", "-i", str(td / "loop.mp4"),
                "-i", str(td / "mix.wav"), "-f", "lavfi", "-i", "anullsrc"]
        for p in ov_inputs + [head]:
            args += ["-loop", "1", "-i", str(p)]
        subprocess.run(args + ["-filter_complex", fc, "-map", "[v]", "-map", "1:a", "-t", f"{total:.3f}",
                               "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-tune", "stillimage",
                               "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(out)],
                       check=True)
        thumb = out.with_suffix(".jpg")
        cover(sc, ep_title, thumb)
    chapters = "\n".join(f"{stamp(a)} {t}" for a, t in zip(starts, titles))
    return {"video": str(out), "thumb": str(thumb), "duration": total, "chapters": chapters}


def cover(sc: Scene, title: str, out: pathlib.Path, sub: str = ""):
    """썸네일/커버: 장면 한 장 + 큰 제목."""
    im = sc.frame(1.0).convert("RGBA")
    W, H = im.size
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    words = title.split(" · ")[0]
    f = font(fsel(words), int(H * 0.085))
    tw = d.textlength(words, font=f)
    y = int(H * 0.8)
    d.rounded_rectangle(((W - tw) / 2 - 40, y - 24, (W + tw) / 2 + 40, y + H * 0.085 + 34), radius=24, fill=(10, 10, 20, 170))
    d.text(((W - tw) / 2, y), words, font=f, fill=(255, 236, 200, 255))
    if sub:
        fs = font(fsel(sub, False), int(H * 0.04))
        sw = d.textlength(sub, font=fs)
        d.text(((W - sw) / 2, y - H * 0.07), sub, font=fs, fill=(255, 255, 255, 230))
    Image.alpha_composite(im, ov).convert("RGB").save(out, quality=92)


def short(track: pathlib.Path, title: str, theme: str, out: pathlib.Path, start: float | None = None,
          length: float = 40.0, seed: int = 11, cta: str = "Full mix on channel ▶",
          sub: str = "lofi · focus · study", scene_cls=Scene) -> dict:
    W, H = 1080, 1920
    d0 = dur(track)
    if start is None:
        start = max(0.0, min(d0 * 0.3, d0 - length))
    with tempfile.TemporaryDirectory() as td:
        td = pathlib.Path(td)
        sc = scene_cls(W, H, theme, seed)
        render_loop(sc, td / "loop.mp4")
        top = text_png(960, 220, [(title, FONT_EN, 64, (255, 255, 255, 255)),
                                  (sub, FONT_EN_L, 36, (255, 220, 170, 240))],
                       td / "top.png", align="center")
        bot = text_png(700, 110, [(cta, FONT_EN, 40, (255, 236, 200, 255))], td / "cta.png", pad=30, align="center")
        fc = (f"[1:a]atrim={start}:{start + length},asetpts=PTS-STARTPTS,afade=t=in:d=1.5,"
              f"afade=t=out:st={length - 2.5}:d=2.5,loudnorm=I=-14:TP=-1.5[a];"
              f"[a]asplit[a1][a2];"
              f"[a2]aformat=channel_layouts=mono,showwaves=s=900x140:mode=cline:draw=full:rate={FPS}:colors=0xFFE0B0,format=rgba,colorkey=0x000000:0.1:0[wv];"
              f"[0:v][2:v]overlay=(W-w)/2:{int(H * 0.73)}[v1];[v1][wv]overlay=(W-w)/2:{int(H * 0.84)}[v2];"
              f"[3:v]format=rgba,fade=t=in:st={length - 8}:d=0.8:alpha=1[c];"
              f"[v2][c]overlay=(W-w)/2:{int(H * 0.93) - 60}:enable='gte(t,{length - 8})'[v]")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "-1", "-i", str(td / "loop.mp4"),
                        "-i", str(track), "-loop", "1", "-i", str(top), "-loop", "1", "-i", str(bot),
                        "-filter_complex", fc, "-map", "[v]", "-map", "[a1]", "-t", str(length), "-r", str(FPS),
                        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)], check=True)
    return {"video": str(out), "start": start, "length": length}


def banner(name: str, sub: str, theme: str, out: pathlib.Path, seed: int = 7, scene_cls=Scene):
    """채널 배너 2560x1440. 글자는 모든 기기에서 보이는 가운데 1546x423 안에만."""
    W, H = 2560, 1440
    sc = scene_cls(W, H, theme, seed)
    im = sc.frame(1.0).convert("RGBA")
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    sx0, sy0 = (W - 1546) // 2, (H - 423) // 2
    d.rounded_rectangle((sx0 + 120, sy0 + 40, sx0 + 1546 - 120, sy0 + 423 - 40), radius=40, fill=(10, 10, 22, 165))
    f, fs = font(fsel(name), 120), font(fsel(sub, False), 46)
    tw = d.textlength(name, font=f)
    d.text(((W - tw) / 2, sy0 + 95), name, font=f, fill=(255, 236, 200, 255))
    sw = d.textlength(sub, font=fs)
    d.text(((W - sw) / 2, sy0 + 260), sub, font=fs, fill=(255, 255, 255, 230))
    Image.alpha_composite(im, ov).convert("RGB").save(out, quality=92)
