"""BK 가 만든 AI 클립을 쇼츠 배경으로 등록 (2026-11-19).

python tools/ai_clip_add.py <원본.mp4> <장면 이름> --tool Veo [--realistic] [--note "..."]
- 9:16 1080x1920·30fps·소리 없음·8초 이하로 다시 인코딩해 media/ai_clips/<장면>-NN.mp4 로 저장 (용량 작게).
- config/ai_clips.json 에 추가. 장면 이름은 config/stock_scenes.json 에 있어야 한다.
- 실사처럼 보이는 영상(사람·실제 장소처럼 보임)은 --realistic → 그 편은 유튜브 '변경·합성 콘텐츠' 표시가 켜진다.
- 넣기 전에 확인: 영상 속 글자·로고·실존 인물·브랜드가 없을 것 (docs/AI_CLIPS.md).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import subprocess

CFG = pathlib.Path("config/ai_clips.json")
DIR = pathlib.Path("media/ai_clips")


def main(argv=None) -> pathlib.Path:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("scene")
    ap.add_argument("--tool", default="")
    ap.add_argument("--realistic", action="store_true")
    ap.add_argument("--note", default="")
    a = ap.parse_args(argv)
    scenes = json.loads(pathlib.Path("config/stock_scenes.json").read_text(encoding="utf-8"))["scenes"]
    if a.scene not in scenes:
        raise SystemExit(f"장면 이름 아님: {a.scene} (config/stock_scenes.json)")
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    n = 1 + sum(1 for c in cfg["clips"] if c["scene"] == a.scene)
    while (DIR / f"{a.scene}-{n:02d}.mp4").exists():
        n += 1
    out = DIR / f"{a.scene}-{n:02d}.mp4"
    DIR.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.src, "-t", "8", "-an", "-vf",
                    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30",
                    "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    str(out)], check=True)
    cfg["clips"].append({"id": f"ai-{a.scene}-{n:02d}", "file": out.as_posix(), "scene": a.scene, "tool": a.tool,
                         "realistic": a.realistic, "added": dt.date.today().isoformat(), "note": a.note})
    CFG.write_text(json.dumps(cfg, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"추가: {out} ({out.stat().st_size / 1e6:.1f}MB)")
    return out


if __name__ == "__main__":
    main()
