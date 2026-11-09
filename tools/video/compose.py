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


_BG: dict = {}


def studio_bg(w: int, h: int) -> Image.Image:
    """밝은 회색 스튜디오 배경 (위는 밝고, 아래·가장자리는 살짝 어둡게)."""
    if (w, h) not in _BG:
        import numpy as np
        y = np.linspace(0, 1, h)[:, None]
        x = np.linspace(-1, 1, w)[None, :]
        shade = (0.07 * y + 0.06 * x ** 2)[..., None] * 255
        base = np.array([246, 245, 242], float)[None, None, :]
        _BG[(w, h)] = Image.fromarray((base - shade).clip(0, 255).astype("uint8"))
    return _BG[(w, h)]


def detail_disc(src: Image.Image, circle, d: int) -> Image.Image:
    """판매자 사진의 원형 확대 컷을 d×d 원으로 (흰 테두리 포함, RGBA)."""
    cx, cy, r = circle
    cx, cy = min(max(cx, r), src.width - r), min(max(cy, r), src.height - r)  # 사진 밖으로 나가지 않게
    im = src.resize((d, d), Image.LANCZOS, box=(cx - r, cy - r, cx + r, cy + r)).convert("RGBA")
    m = Image.new("L", (d * 4, d * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, d * 4 - 1, d * 4 - 1), fill=255)
    im.putalpha(m.resize((d, d), Image.LANCZOS))
    ring = Image.new("RGBA", (d + 12, d + 12), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((0, 0, d + 11, d + 11), fill=(255, 255, 255, 255))
    ring.alpha_composite(im, (6, 6))
    return ring


def studio_frame(sc: dict, imgs: dict, t: float, w: int, h: int) -> Image.Image:
    """오려 낸 상품을 스튜디오 배경에 세우고(반사·그림자), 불 켜짐과 확대 컷을 얹는다."""
    import numpy as np
    d = sc["dur"]
    cut = imgs[sc["cutout"]]
    zoom = 1 + sc.get("zoom", 0.04) * ease(t / d)
    s = sc.get("height", 0.72) * h / cut.height * zoom
    L = cut.resize((max(1, int(cut.width * s)), max(1, int(cut.height * s))), Image.BICUBIC)
    fx, fy = sc.get("x", 0.5) * w, sc.get("floor", 0.86) * h  # 상품 가운데 아래(바닥) 위치
    enter = 1.0 if "on_at" in sc or sc["type"] == "end" else ease(t / 0.7)  # 불 켜짐이 없으면 살짝 떠오르며 등장
    if enter < 1:
        a = np.array(L).astype(np.float32)
        a[:, :, 3] *= enter
        L = Image.fromarray(a.astype("uint8"))
    lx, ly = int(fx - L.width / 2), int(fy - L.height + (1 - enter) * h * 0.03)
    out = studio_bg(w, h).copy()
    # 바닥 그림자
    sh = Image.new("L", (w, h), 0)
    bw = L.width * sc.get("shadow_w", 0.45)
    bx = lx + L.width * sc.get("shadow_x", 0.5)
    ImageDraw.Draw(sh).ellipse((bx - bw / 2, fy - h * 0.012, bx + bw / 2, fy + h * 0.016), fill=120)
    sh = sh.filter(ImageFilter.GaussianBlur(h * 0.014))
    out = Image.composite(Image.new("RGB", (w, h), (150, 147, 142)), out, sh)
    # 반사
    r = np.array(L.transpose(Image.FLIP_TOP_BOTTOM)).astype(np.float32)
    r[:, :, 3] *= (np.clip(1 - np.linspace(0, 1, L.height) / 0.16, 0, 1) * 0.2)[:, None]
    rim = Image.fromarray(r.astype("uint8"))
    out.paste(rim, (lx, int(fy)), rim)
    on = ease((t - sc["on_at"]) / 0.5) if "on_at" in sc else 1.0
    if sc.get("light"):  # 불빛: 막대 아래로 퍼지는 따뜻한 빛
        (ax, ay), (bx2, by2) = [(lx + x * s, ly + y * s) for x, y in sc["light"]]
        glow = Image.new("L", (w, h), 0)
        g = ImageDraw.Draw(glow)
        spread = (fy - max(ay, by2)) * 0.35
        g.polygon([(ax, ay), (bx2, by2), (bx2 + spread, fy), (ax - spread, fy)], fill=int(110 * on))
        glow = glow.filter(ImageFilter.GaussianBlur(h * 0.05))
        out = Image.composite(Image.new("RGB", (w, h), (255, 226, 170)), out, glow)
    out.paste(L, (lx, ly), L)
    if sc.get("light") and on > 0:
        line = Image.new("L", (w, h), 0)
        ImageDraw.Draw(line).line([(ax, ay), (bx2, by2)], fill=int(255 * on), width=max(2, int(h * 0.004)))
        halo = line.filter(ImageFilter.GaussianBlur(h * 0.01))
        out = Image.composite(Image.new("RGB", (w, h), (255, 244, 220)), out, halo.point(lambda v: min(255, v * 2)))
        out = Image.composite(Image.new("RGB", (w, h), (255, 252, 240)), out, line)
    if "on_at" in sc:  # 켜지기 전엔 방이 어둡다
        dim = 0.42 + 0.58 * on
        out = ImageEnhance.Brightness(out).enhance(dim)
    for det in sc.get("details", []):
        k = ease((t - det["at"]) / 0.45)
        if k <= 0:
            continue
        dd = int(det.get("size", 0.3) * w * (0.85 + 0.15 * k))
        disc = detail_disc(imgs[det["image"]], det["circle"], dd)
        a = np.array(disc).astype(np.float32)
        a[:, :, 3] *= k
        disc = Image.fromarray(a.astype("uint8"))
        cx, cy = det["pos"][0] * w, det["pos"][1] * h
        shadow = Image.new("L", (w, h), 0)
        ImageDraw.Draw(shadow).ellipse((cx - dd / 2, cy - dd / 2 + h * 0.01, cx + dd / 2, cy + dd / 2 + h * 0.01),
                                       fill=int(70 * k))
        out = Image.composite(Image.new("RGB", (w, h), (120, 118, 114)), out,
                              shadow.filter(ImageFilter.GaussianBlur(h * 0.012)))
        out.paste(disc, (int(cx - disc.width / 2), int(cy - disc.height / 2)), disc)
        if det.get("label"):
            dr = ImageDraw.Draw(out)
            f = font(max(14, int(min(w, h) * 0.034)))
            c = tuple(int(255 - (255 - v) * k) for v in (60, 58, 54))
            text_center(dr, int(cx), int(cy + disc.height / 2 + h * 0.012), det["label"], f, c)
    return out


def card_frame(sc: dict, t: float, w: int, h: int) -> Image.Image:
    """글자 카드 (질문·계산 결과). items: text, y(높이 비율), size(가로 비율), color, at(등장 초).
    text 에 {n} 이 있으면 0 에서 n 까지 올라가며 센다."""
    out = studio_bg(w, h).copy() if not sc.get("dark") else Image.new("RGB", (w, h), (28, 30, 32))
    dr = ImageDraw.Draw(out)
    for it in sc["items"]:
        k = ease((t - it.get("at", 0)) / 0.35)
        if k <= 0:
            continue
        txt = it["text"]
        if "n" in it:
            txt = txt.replace("{n}", f"{int(it['n'] * ease((t - it.get('at', 0)) / 0.9)):,}")
        f = wrap_size(dr, txt, int(it.get("size", 0.06) * w), int(w * 0.9))
        base = tuple(int(c[1:][i:i + 2], 16) for c in [it.get("color", "#2b2a28")] for i in (0, 2, 4))
        bg = out.getpixel((w // 2, int(it["y"] * h)))
        col = tuple(int(b + (c - b) * k) for b, c in zip(bg, base))
        text_center(dr, w // 2, int(it["y"] * h + (1 - k) * h * 0.02), txt, f, col)
    return out


def scene_frame(sc: dict, imgs: dict, t: float, w: int, h: int) -> Image.Image:
    d = sc["dur"]
    if sc["type"] == "card":
        return card_frame(sc, t, w, h)
    if sc["type"] == "studio" or (sc["type"] == "end" and "cutout" in sc):
        return studio_frame(sc, imgs, t, w, h)
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
    names = {sc[k] for sc in story["scenes"] for k in ("image", "image2") if k in sc}
    names |= {d["image"] for sc in story["scenes"] for d in sc.get("details", [])}
    aslug = story.get("assets", slug)  # 다른 상품 폴더의 사진을 쓰는 스토리 (예: 유튜브용 <slug>-yt)
    imgs = {n: load(aslug, n, story.get("fills", {}).get(n, [])) for n in names}
    for sc in story["scenes"]:
        if "cutout" in sc:  # 배경을 지운 상품 사진 (tools/video/cutout.py 로 만든 RGBA png)
            imgs[sc["cutout"]] = Image.open(ROOT / "video_assets" / aslug / sc["cutout"]).convert("RGBA")
    label = story.get("label", "광고 · 판매자 제공 사진으로 편집")
    out_dir = ROOT / "video_work" / "compose"
    out_dir.mkdir(parents=True, exist_ok=True)
    voices = _narrate(story, out_dir / slug) if any(sc.get("say") for sc in story["scenes"]) else {}
    total = sum(sc["dur"] for sc in story["scenes"])
    audio = out_dir / f"{slug}_click.wav"
    clicks = [sum(s["dur"] for s in story["scenes"][:i]) + sc.get("on_at", 0.6)
              for i, sc in enumerate(story["scenes"]) if sc["type"] in ("reveal", "studio") and "on_at" in sc]
    _click_track(audio, total, clicks)
    if voices:
        _mix_voice(audio, story, voices)
    for fmt, ((W, H), (ax, ay, aw, ah)) in FORMATS.items():
        out = out_dir / f"{slug}_{fmt}.mp4"
        ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                               "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(audio),
                               "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
                               "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", str(out)],
                              stdin=subprocess.PIPE)
        start = 0.0
        for sc in story["scenes"]:
            sc = {**sc, **sc.get(fmt, {})}  # 형식별 덮어쓰기 (예: "site": {"x": 0.4})
            full = fmt == "site" and ("cutout" in sc or sc["type"] == "card")  # 사이트용 스튜디오 장면은 화면 전체를 배경으로
            for i in range(round(sc["dur"] * FPS)):
                t = i / FPS
                canvas = Image.new("RGB", (W, H), BAR)
                if full:
                    canvas.paste(scene_frame(sc, imgs, t, W, H), (0, 0))
                else:
                    canvas.paste(scene_frame(sc, imgs, t, aw, ah), (ax, ay))
                dr = ImageDraw.Draw(canvas)
                caps = sc.get("captions") or ([[0, sc["caption"]]] if sc.get("caption") else [])
                cur = [c for c in caps if c[0] <= t]
                caption, cap_k = (cur[-1][1], ease((t - cur[-1][0]) / 0.25)) if cur else (None, 0)
                if sc["type"] == "end":
                    light = "cutout" in sc  # 밝은 스튜디오 배경이면 글자를 어둡게
                    cy = ay + int(ah * (0.78 if light else 0.5))
                    f1 = wrap_size(dr, story["name"], 60 if fmt == "shorts" else 40, aw - 60)
                    text_center(dr, W // 2, cy - 110, story["name"], f1, "#2b2a28" if light else "white")
                    text_center(dr, W // 2, cy - 30, story["price"], font(80 if fmt == "shorts" else 54),
                                "#b5432c" if light else "#ffd166")
                    text_center(dr, W // 2, cy + 70, story["disclosure"], font(36 if fmt == "shorts" else 26),
                                "#6b6863" if light else "white")
                    if fmt == "shorts":  # 쇼츠는 설명란 링크를 누를 수 없어서 사이트 주소를 화면에 적는다
                        text_center(dr, W // 2, ay + ah + 90, "don3chon.com", font(60), "#e8e2d6")
                elif caption and cap_k > 0:
                    if fmt == "shorts":
                        f = wrap_size(dr, caption, 66, W - 80)
                        text_center(dr, W // 2, ay + ah + 90 + int((1 - cap_k) * 30), caption, f)
                    else:
                        f = wrap_size(dr, caption, 40, W - 80)
                        tw = dr.textlength(caption, font=f)
                        y = H - 110
                        dr.rounded_rectangle((W / 2 - tw / 2 - 24, y - 14, W / 2 + tw / 2 + 24, y + 62), 16, fill=(0, 0, 0))
                        text_center(dr, W // 2, y, caption, f)
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


def _narrate(story: dict, prefix: pathlib.Path) -> dict:
    """장면별 "say" 문장을 무료 TTS(Supertonic 3, 모델 OpenRAIL-M·코드 MIT)로 읽는다.
    말이 장면보다 길면 장면을 늘린다. VIDEO_TTS_DIR = sherpa-onnx supertonic 모델 폴더."""
    import sherpa_onnx
    import soundfile as sf
    d = pathlib.Path(os.environ.get("VIDEO_TTS_DIR", "/tmp/tts/sherpa-onnx-supertonic-3-tts-int8-2026-05-11"))
    f = lambda n: str(next(d.glob(n)))
    cfg = sherpa_onnx.OfflineTtsSupertonicModelConfig(
        duration_predictor=f("duration_predictor*.onnx"), text_encoder=f("text_encoder*.onnx"),
        vector_estimator=f("vector_estimator*.onnx"), vocoder=f("vocoder*.onnx"),
        tts_json=f("tts.json"), unicode_indexer=f("unicode_indexer.bin"), voice_style=f("voice.bin"))
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(supertonic=cfg, num_threads=4)))
    out = {}
    for i, sc in enumerate(story["scenes"]):
        if not sc.get("say"):
            continue
        g = sherpa_onnx.GenerationConfig()
        g.sid, g.speed, g.num_steps, g.extra = int(story.get("voice", 0)), float(story.get("speed", 1.1)), 8, {"lang": "ko"}
        a = tts.generate(sc["say"], g)
        path = pathlib.Path(f"{prefix}_say{i}.wav")
        sf.write(str(path), a.samples, a.sample_rate)
        sec = len(a.samples) / a.sample_rate
        sc["dur"] = max(sc["dur"], round(sec + 0.45, 2))
        out[i] = path
    return out


def _mix_voice(track: pathlib.Path, story: dict, voices: dict) -> None:
    """효과음 트랙에 장면 시작 0.15초 뒤부터 내레이션을 얹는다."""
    import numpy as np
    import soundfile as sf
    base, sr = sf.read(str(track), always_2d=False)
    base = base if base.ndim == 1 else base.mean(1)
    for i, path in voices.items():
        v, vsr = sf.read(str(path), always_2d=False)
        v = v if v.ndim == 1 else v.mean(1)
        if vsr != sr:
            v = np.interp(np.arange(0, len(v) * sr / vsr) * vsr / sr, np.arange(len(v)), v)
        st = int((sum(s["dur"] for s in story["scenes"][:i]) + 0.15) * sr)
        n = min(len(v), len(base) - st)
        base[st:st + n] += v[:n] * 0.9
    sf.write(str(track), np.clip(base, -1, 1), sr)


def _click_track(path: pathlib.Path, total: float, clicks: list[float]) -> None:
    expr = "+".join(f"0.6*(random(0)-0.5)*exp(-120*(t-{c:.2f}))*gte(t,{c:.2f})"
                    f"+0.25*sin(2*PI*2200*t)*exp(-60*(t-{c:.2f}))*gte(t,{c:.2f})" for c in clicks) or "0"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                    f"aevalsrc='{expr}':d={total:.2f}:s=44100", str(path)], check=True)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        compose(s)
