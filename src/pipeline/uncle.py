"""절약형 삼촌 쇼츠 (2026-11-11, BK 결정). docs/HEYGEN.md

    python -m pipeline.uncle clips             # config/heygen/clips.json → media/uncle/<이름>.mp4 (HeyGen, 없는 것만, 요금 듦)
    python -m pipeline.uncle mix <설정 이름>... # 삼촌 표정 영상 + 상품 사진 + 계산 카드 → media/youtube/<slug>.mp4 (무료)

- 삼촌 표정 영상(시작·반응·끝)은 HeyGen으로 한 번만 만들어 계속 다시 쓴다. 가운데는 상품 사진과 7번 목소리라 무료.
- 목소리는 처음부터 끝까지 7번(Supertonic M2). HeyGen 영상도 이 목소리 파일을 넣어 입만 맞춘다.
- 삼촌이 나오는 동안 "AI로 만든 가상 인물", 늘 위에 "광고 · 알리익스프레스 제휴 링크". 대기열 synthetic=1.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import urllib.request
import wave

from .heygen import AVATAR, CFG, PRODUCTS, ASSETS, W, H, add_queue, call, end_card, summary, upload_asset, wait_video
from .youtube import MEDIA

CLIPS = CFG / "clips.json"
CLIP_DIR = pathlib.Path("media/uncle")
FPS = 30
SR = 44100
GREEN = (31, 92, 74)


# ---------- 목소리 (7번) ----------
def tts(lines: list[str]):
    """Actions 에서는 pip supertonic. UNCLE_TTS=sherpa 면 sherpa-onnx 모델(SHERPA_DIR, sid 6 = M2)."""
    import numpy as np
    if os.environ.get("UNCLE_TTS") == "sherpa":
        import sherpa_onnx as s
        d = os.environ["SHERPA_DIR"]
        m = s.OfflineTtsSupertonicModelConfig(
            duration_predictor=f"{d}/duration_predictor.int8.onnx", text_encoder=f"{d}/text_encoder.int8.onnx",
            vector_estimator=f"{d}/vector_estimator.int8.onnx", vocoder=f"{d}/vocoder.int8.onnx",
            tts_json=f"{d}/tts.json", unicode_indexer=f"{d}/unicode_indexer.bin", voice_style=f"{d}/voice.bin")
        tts_ = s.OfflineTts(s.OfflineTtsConfig(model=s.OfflineTtsModelConfig(supertonic=m, num_threads=4)))
        out = []
        for t in lines:
            g = s.GenerationConfig()
            g.sid, g.num_steps, g.speed, g.extra = 6, 32, 1.0, {"lang": "ko"}
            a = tts_.generate(t, g)
            out.append((np.array(a.samples, dtype=np.float32), a.sample_rate))
        return [resample(c, sr) for c, sr in out]
    from .shorts import narrate
    clips, sr = narrate(lines)
    return [resample(c, sr) for c in clips]


def resample(a, sr: int):
    import numpy as np
    if sr == SR:
        return a
    x = np.linspace(0, len(a) - 1, int(len(a) * SR / sr))
    return np.interp(x, np.arange(len(a)), a).astype(np.float32)


def write_wav(a, path: pathlib.Path) -> None:
    import numpy as np
    a = (a / max(1e-6, float(np.abs(a).max())) * 0.9 * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(a.tobytes())


# ---------- 삼촌 표정 영상 (HeyGen, 한 번만) ----------
def make_clips() -> int:
    cfg = {k: v for k, v in json.loads(CLIPS.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    todo = [k for k in cfg if not (CLIP_DIR / f"{k}.mp4").exists()]
    if not todo:
        summary("삼촌 표정 영상이 모두 있음")
        return 0
    avatar = json.loads(AVATAR.read_text(encoding="utf-8"))["avatar_id"]
    CLIP_DIR.mkdir(parents=True, exist_ok=True)
    voices = tts([cfg[k]["say"] for k in todo])
    made = []
    with tempfile.TemporaryDirectory() as tmp:
        for k, a in zip(todo, voices):
            import numpy as np
            wav = pathlib.Path(tmp) / f"{k}.wav"
            write_wav(np.concatenate([np.zeros(int(SR * 0.15), np.float32), a, np.zeros(int(SR * 0.35), np.float32)]), wav)
            asset = upload_asset(wav)
            body = {"type": "avatar", "avatar_id": avatar, "audio_asset_id": asset, "resolution": "1080p",
                    "aspect_ratio": "9:16", "motion_prompt": cfg[k]["motion"], "expressiveness": "high"}
            r = call("POST", "/v3/videos", body, idem=f"uncle-{k}-{hashlib.sha1(cfg[k]['say'].encode()).hexdigest()[:12]}")
            vid = r["data"]["video_id"]
            print(f"{k}: HeyGen {vid}")
            s = wait_video(vid)
            (CLIP_DIR / f"{k}.mp4").write_bytes(urllib.request.urlopen(s["video_url"], timeout=300).read())
            made.append(f"{k} ({s.get('duration')}초)")
    summary("삼촌 표정 영상 완성: " + ", ".join(made))
    return 0


# ---------- 화면 ----------
def top_bar(dr) -> None:
    from .shorts import center, font
    dr.rectangle([0, 0, W, 150], fill=GREEN)
    center(dr, 22, "돈 줍는 삼촌", font(46))
    center(dr, 90, "광고 · 알리익스프레스 제휴 링크", font(32), "#e1f0e6")


def uncle_overlay(path: pathlib.Path, line: str) -> None:
    """삼촌 영상 위: 위 막대 + 자막 + 'AI로 만든 가상 인물'."""
    from PIL import Image, ImageDraw
    from .shorts import center, font, lines_fit
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    top_bar(dr)
    f, rows = lines_fit(dr, line, 60, W - 120, 2)
    y = 1480
    for j, r in enumerate(rows):
        tw = dr.textlength(r, font=f)
        dr.rounded_rectangle(((W - tw) / 2 - 20, y + j * 84 - 8, (W + tw) / 2 + 20, y + j * 84 + 72), 16, fill=(0, 0, 0, 200))
        center(dr, y + j * 84, r, f)
    t, f2 = "AI로 만든 가상 인물", font(30)
    tw = dr.textlength(t, font=f2)
    dr.rounded_rectangle(((W - tw) / 2 - 18, H - 150, (W + tw) / 2 + 18, H - 100), 14, fill=(0, 0, 0, 160))
    center(dr, H - 145, t, f2)
    im.save(path)


def uncle_segment(name: str, line: str, out: pathlib.Path, tmp: pathlib.Path) -> None:
    ov = tmp / f"ov-{name}.png"
    uncle_overlay(ov, line)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(CLIP_DIR / f"{name}.mp4"), "-i", str(ov),
                    "-filter_complex", "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[a];"
                    "[a][1:v]overlay=0:0[v];[0:a]aresample=44100,aformat=channel_layouts=mono[au]",
                    "-map", "[v]", "-map", "[au]", "-c:v", "libx264", "-crf", "21", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", str(out)], check=True)


def product_segment(scenes: list[dict], voices: list, p: dict, note: str, out: pathlib.Path, tmp: pathlib.Path) -> None:
    """상품 사진·계산 카드·가격 카드. scenes: {"kind": photo|calc|end, ...}."""
    import numpy as np
    from PIL import Image, ImageDraw
    from .shorts import center, ease, fit, font, lines_fit
    durs = [len(a) / SR + 0.45 for a in voices]
    audio = np.zeros(int(SR * sum(durs)) + SR, dtype=np.float32)
    t = 0.0
    for a, d in zip(voices, durs):
        i = int(SR * (t + 0.15))
        audio[i:i + len(a)] += a
        t += d
    wav = tmp / "mid.wav"
    write_wav(audio, wav)
    total = sum(durs)
    endp = tmp / "end.png"
    end_card(endp, p, note)
    end_im = Image.open(endp).convert("RGB")
    folder = ASSETS / p["slug"]
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-crf", "21", "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-b:a", "128k", "-ar", str(SR), "-ac", "1", "-t", f"{total:.2f}", str(out)],
                          stdin=subprocess.PIPE)
    for sc, d in zip(scenes, durs):
        img = Image.open(folder / sc["photo"]).convert("RGB") if sc.get("photo") else None
        for i in range(round(d * FPS)):
            tt = i / FPS
            k = ease(tt / 0.35)
            if sc["kind"] == "photo":
                cv = Image.new("RGB", (W, H), (24, 60, 50))
                cv.paste(fit(img, 980, 980, 1 + 0.06 * tt / d), (50, 380))
                dr = ImageDraw.Draw(cv)
                f, rows = lines_fit(dr, sc["cap"], 72, W - 100, 1)
                center(dr, 1440 + int((1 - k) * 30), rows[0], f, "#ffd166")
            elif sc["kind"] == "calc":
                cv = Image.new("RGB", (W, H), (246, 245, 242))
                dr = ImageDraw.Draw(cv)
                cv.paste(fit(Image.open(sorted(folder.glob("*.jpg"))[0]).convert("RGB"), 420, 420), ((W - 420) // 2, 470))
                center(dr, 960, sc["title"], font(56), "#5c5852")
                center(dr, 1050 + int((1 - k) * 30), sc["value"], font(132), "#1f5f4a")
                center(dr, 1240, sc.get("sub", ""), font(34), "#8a857c")
            else:
                cv = end_im.copy()
                dr = ImageDraw.Draw(cv)
            top_bar(dr)
            ff.stdin.write(cv.tobytes())
    ff.stdin.close()
    if ff.wait():
        raise RuntimeError("ffmpeg 실패")


def plan(cfg: dict) -> list[tuple[str, dict]]:
    """영상 순서: 시작 삼촌 → 사진들 → 계산 → 반응 삼촌 → (주의 사진) → 가격 → 끝 삼촌."""
    m = cfg["mix"]
    seq: list[tuple[str, dict]] = [("uncle", {"name": m["intro"]})]
    seq += [("product", {"kind": "photo", **s}) for s in m["scenes"]]
    if m.get("calc"):
        seq.append(("product", {"kind": "calc", **m["calc"]}))
    if m.get("react"):
        seq.append(("uncle", {"name": m["react"]}))
    if m.get("react_after"):
        seq.append(("product", {"kind": "photo", **m["react_after"]}))
    seq.append(("product", {"kind": "end", "say": m["price_say"]}))
    seq.append(("uncle", {"name": m["outro"]}))
    return seq


def mix(name: str) -> None:
    cfg = json.loads((CFG / f"{name}.json").read_text(encoding="utf-8"))
    p = json.loads((PRODUCTS / f"{cfg['product']}.json").read_text(encoding="utf-8"))
    if not cfg["title"].startswith("[광고]"):
        raise SystemExit("제목은 [광고]로 시작해야 함")
    clips = json.loads(CLIPS.read_text(encoding="utf-8"))
    seq = plan(cfg)
    missing = [s["name"] for k, s in seq if k == "uncle" and not (CLIP_DIR / f"{s['name']}.mp4").exists()]
    if missing:
        raise SystemExit(f"삼촌 표정 영상 없음: {missing} (먼저 clips)")
    groups: list[tuple[str, list[dict]]] = []  # 연속된 상품 장면은 한 덩어리
    for k, s in seq:
        if k == "product" and groups and groups[-1][0] == "product":
            groups[-1][1].append(s)
        else:
            groups.append((k, [s]))
    lines = [s["say"] for k, s in seq if k == "product"]
    voices = iter(tts(lines))
    out = MEDIA / f"{cfg['slug']}.mp4"
    MEDIA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmpd:
        tmp = pathlib.Path(tmpd)
        parts = []
        for n, (k, ss) in enumerate(groups):
            part = tmp / f"part{n}.mp4"
            if k == "uncle":
                uncle_segment(ss[0]["name"], clips[ss[0]["name"]]["say"], part, tmp)
            else:
                product_segment(ss, [next(voices) for _ in ss], p, cfg.get("end_note", ""), part, tmp)
            parts.append(part)
        inputs = sum((["-i", str(x)] for x in parts), [])
        fc = "".join(f"[{i}:v][{i}:a]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=1[v][a]"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                        "-c:v", "libx264", "-crf", "22", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac",
                        "-b:a", "128k", "-movflags", "+faststart", str(out)], check=True)
    add_queue(cfg, p)
    summary(f"완성: {out} ({out.stat().st_size / 1e6:.1f}MB, 삼촌 영상 {sum(k == 'uncle' for k, _ in seq)}개 재사용, HeyGen 요금 없음)")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "clips":
        sys.exit(make_clips())
    for n in args[1:]:
        mix(n)
