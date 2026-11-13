"""5락실 게임 데이(월·목) 쇼츠 2: '네온 사격장' 자동 플레이 하이라이트 (BK 2026-11-13 OK).

- 녹화: scripts/range_rec.js (사이트 #rgdebug 훅, 가상 시계 30fps 프레임 캡처, 순위에 안 올라감).
- 편집: 가로 1280x720 화면 가운데를 정사각형으로 잘라 세로 1080x1920 네온 틀에 넣고,
  위에 "STAGE N 도전", 아래에 실시간 점수·헤드샷 표시, 마지막에 5raksil.com 안내.
- 소리: 우리 효과음(총소리·명중음·8비트 베이스) + 시작/끝 AI 음성 한 줄. 게임 밖 음원 없음.
- 업로드: 같은 날 밸런스게임 쇼츠(17:00)와 겹치지 않게 20:00 KST 공개 예약.
- 모든 그래픽·소리는 5락실이 만든 것. 다른 게임의 캐릭터·로고·화면은 쓰지 않는다.

실행: PYTHONPATH=src python -m pipeline.raksil_range <녹화폴더> [render|upload] [YYYY-MM-DD]
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import subprocess
import sys

from . import raksil_shorts as rs

W, H, FPS, SR = rs.W, rs.H, rs.FPS, rs.SR
HOUR = 20
TAGS = ["5락실", "네온사격장", "FPS", "웹게임", "무료게임", "좀비", "헤드샷", "shorts"]
SKIP = 2.0  # 카운트다운 앞부분(3, 2) 건너뜀
MAX_PLAY = 19.0


def is_game_day(day: dt.date) -> bool:
    return day.weekday() in (0, 3)  # 월·목


def stage_for(day: dt.date) -> int:
    """5~10단계를 돌아가며 (좀비는 4단계부터)."""
    return 5 + (day.toordinal() // 7 * 2 + (day.weekday() == 3)) % 6


def lines(stage: int) -> list[str]:
    return [f"{stage}단계, 좀비 나온다.", "너는 몇 단계까지 갈 수 있어? 오락실 닷컴에서 도전해 봐!"]


def heads(events: list[dict]) -> list[float]:
    """헤드샷 시각: 머리를 노린 발사 직후 0.2초 안에 점수가 오른 순간."""
    out, fires = [], [e for e in events if e["k"] == "fire" and e.get("head")]
    for h in (e for e in events if e["k"] == "hit"):
        if any(0 <= h["t"] - f["t"] <= 0.2 for f in fires):
            out.append(h["t"])
    return out


def score_at(events: list[dict], t: float) -> int:
    return sum(e["d"] for e in events if e["k"] == "hit" and e["t"] <= t)


def title_of(stage: int) -> str:
    return f"네온 사격장 STAGE {stage} 좀비 헤드샷 🎯 너는 몇 단계? #5락실 #shorts"


def description_of(stage: int, score: int, n_heads: int, voiced: bool) -> str:
    ls = [f"5락실 무료 웹게임 '네온 사격장' STAGE {stage} 자동 플레이 하이라이트",
          f"이번 판: {score:,}점 · 헤드샷 {n_heads}발", "",
          "▶ 설치 없이 바로 하기: https://5raksil.com/games/range",
          "▶ 매일 새 밸런스게임·틀린그림찾기: https://5raksil.com", "",
          "게임 속 총기·사격장·좀비는 모두 5락실이 만든 가상의 디자인입니다."]
    if voiced:
        ls.append("내레이션: AI 음성")
    ls.append("#네온사격장 #웹게임 #5락실")
    return "\n".join(ls)


# ---------- 화면 ----------
def frame_layer(stage: int):
    from PIL import ImageDraw
    img = rs.background(13)
    rs.header(img, "무료 웹게임 · 네온 사격장")
    rs.glow_text(img, (W / 2, 330), [f"STAGE {stage}"], rs.font(120), 120, rs.PINK, glow=18)
    rs.glow_text(img, (W / 2, 450), ["좀비 헤드샷 도전"], rs.font(64), 64, rs.CYAN, glow=10)
    dr = ImageDraw.Draw(img)
    dr.rounded_rectangle((34, 534, W - 34, 534 + 1012), radius=26, outline=rs.CYAN + (255,), width=6)
    return img


def cta_card(t: float):
    img = rs.background(11)
    rs.header(img, "무료 웹게임 · 네온 사격장")
    rs.glow_text(img, (W / 2, 640), ["너는", "몇 단계까지?"], rs.font(120), 120, rs.WHITE, glow=10)
    blink = rs.PINK if int(t * 3) % 2 == 0 else rs.YEL
    rs.glow_text(img, (W / 2, 1000), ["5raksil.com"], rs.font(130), 130, blink, glow=20)
    rs.glow_text(img, (W / 2, 1260), ["설치 없이 바로 플레이"], rs.font(72), 72, rs.CYAN, glow=12)
    rs.glow_text(img, (W / 2, 1480), ["오늘의 순위 도전"], rs.font(56), 56, rs.YEL, glow=8)
    return img


def head_layer():
    from PIL import Image
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rs.glow_text(img, (W / 2, 1640), ["HEADSHOT!"], rs.font(110), 110, rs.YEL, glow=16)
    return img


def score_text(img, score: int):
    from PIL import ImageDraw
    dr = ImageDraw.Draw(img)
    f = rs.font(64)
    s = f"{score:,}점"
    dr.text((W / 2 - dr.textlength(s, font=f) / 2, 1760), s, font=f, fill=rs.WHITE + (255,),
            stroke_width=4, stroke_fill=rs.PINK + (255,))


def game_crop(path: pathlib.Path):
    from PIL import Image
    g = Image.open(path).convert("RGB")
    w, h = g.size
    x0 = (w - h) // 2 + int(h * 0.06)  # 총이 오른쪽에 있어 살짝 오른쪽으로
    return g.crop((x0, 0, x0 + h, h)).resize((1000, 1000), Image.LANCZOS)


def render(rec: pathlib.Path, day: dt.date, out_dir: pathlib.Path = rs.OUT) -> dict | None:
    import numpy as np
    info = json.loads((rec / "events.json").read_text(encoding="utf-8"))
    frames = sorted(rec.glob("f*.jpg"))
    stage = info.get("stage", stage_for(day))
    t0 = SKIP
    play_frames = [f for i, f in enumerate(frames) if i / FPS >= t0][: int(MAX_PLAY * FPS)]
    if len(play_frames) < FPS * 8:
        print("녹화가 너무 짧음", len(play_frames))
        return None
    ev = info["ev"]
    hs = heads(ev)
    play_d = len(play_frames) / FPS
    cta_d = 3.0
    clips, voiced = rs.tts(lines(stage))
    cta_d = max(cta_d, len(clips[1]) / SR + 0.6)
    total = play_d + cta_d

    audio = np.zeros(int(SR * total) + SR, dtype=np.float32)
    rng = np.random.default_rng(5)
    shot = (rng.standard_normal(int(SR * 0.09)) * np.exp(-np.arange(int(SR * 0.09)) / SR * 45) * 0.35).astype(np.float32)
    for e in ev:
        t = e["t"] - t0
        if 0 <= t < play_d:
            rs.place(audio, shot if e["k"] == "fire" else rs.tone(1320, 0.09, 0.12, "sine"), t)
    for t in hs:
        if 0 <= t - t0 < play_d:
            rs.place(audio, np.concatenate([rs.tone(988, 0.07, 0.15), rs.tone(1319, 0.14, 0.15)]), t - t0)
    bass, t = [82, 82, 110, 98], 0.0
    while t < total:
        rs.place(audio, rs.tone(bass[int(t * 2) % 4], 0.45, 0.06), t)
        t += 0.5
    rs.place(audio, clips[0] * 0.95, 0.2)
    rs.place(audio, clips[1] * 0.95, play_d + 0.2)
    audio = np.clip(audio, -1, 1)[: int(SR * total)]

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{day.isoformat()}-range"
    wav, mp4 = out_dir / f"{stem}.wav", out_dir / f"{stem}.mp4"
    import wave
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())

    base = frame_layer(stage)
    hl = head_layer()
    ctas = {}
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium",
                           "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest",
                           "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    for i, fp in enumerate(play_frames):
        t = t0 + i / FPS
        img = base.copy()
        img.paste(game_crop(fp), (40, 540))
        if any(0 <= t - h < 0.7 for h in hs):
            img.alpha_composite(hl)
        score_text(img, score_at(ev, t))
        ff.stdin.write(img.convert("RGB").tobytes())
    for i in range(int(cta_d * FPS)):
        k = int(i / FPS * 3) % 2
        ctas.setdefault(k, cta_card(k / 3))
        ff.stdin.write(ctas[k].convert("RGB").tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg 실패")
    wav.unlink()
    score = score_at(ev, t0 + play_d)
    meta = {"date": day.isoformat(), "qid": f"range-{day.isoformat()}", "key": f"{day.isoformat()}-range",
            "file": str(mp4), "title": title_of(stage), "description": description_of(stage, score, len(hs), voiced),
            "voiced": voiced, "hour": HOUR, "schedule": True, "tags": TAGS, "category": "20",
            "stage": stage, "heads": len(hs), "seconds": round(total, 1)}
    (out_dir / f"{stem}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def main(argv: list[str]) -> int:
    rec = pathlib.Path(argv[1])
    cmd = argv[2] if len(argv) > 2 else "render"
    day = dt.date.fromisoformat(argv[3]) if len(argv) > 3 else dt.datetime.now(rs.KST).date()
    meta = render(rec, day)
    if not meta:
        return 0
    return rs.upload_meta(meta) if cmd == "upload" else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
