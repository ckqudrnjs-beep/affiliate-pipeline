"""쇼츠 배경음악(BGM) — BK가 Suno로 만든 곡을 채널별로 돌려 쓰고, 박자에 맞춰 편집한다 (BK 2026-11-20).

- 고르기 `pick(kind, day)`: 날짜로 정해지는 순번(상태 파일 없음) → 같은 종류 연속 편은 늘 다른 곡,
  같은 날 다른 종류(5락실 밸런스·게임)도 서로 다른 곡. 곡을 한 바퀴 돌면 시작 위치(starts)를 바꿔 또 다르게.
- 박자 맞추기 `snap(t, tr, div)`: 영상 0초 = 곡의 마디 시작이므로, 영상 안 박자는 0, 1박, 2박 … 이다.
  장면 전환은 박(div=1), 효과음·숫자 등장은 반 박(div=2)에 맞춘다.
- 섞기 `mix(mp4, tr)`: 곡을 영상 길이로 자르고 0.3초 페이드인·1.2초 페이드아웃, 음량은 종류별 목표(LUFS)로 맞추고,
  목소리·효과음이 나올 때 BGM 을 자동으로 낮춘다(사이드체인 덕킹). numpy 없이 ffmpeg 만 쓴다.
- 어떤 쇼츠에 BGM 을 넣고 빼는지 기준: docs/BGM.md. 값: config/bgm.json.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
CFG = ROOT / "config/bgm.json"


def cfg() -> dict:
    return json.loads(CFG.read_text(encoding="utf-8"))


def track(slug: str) -> dict:
    c = cfg()
    tr = dict(c["tracks"][slug], slug=slug)
    tr["start"] = tr["starts"][0]
    return tr


def pick(kind: str, day: dt.date) -> dict | None:
    """kind(toon·live·balance·game)의 day 편에 쓸 곡. BGM 을 안 쓰는 종류면 None."""
    c = cfg()
    k = c["kinds"].get(kind)
    if not k:
        return None
    slot = day.toordinal() // k.get("every_days", 1)
    order = k["order"]
    tr = dict(c["tracks"][order[slot % len(order)]], slug=order[slot % len(order)], kind=kind)
    lap = slot // len(order)  # 한 바퀴 돌 때마다 곡의 다른 부분에서 시작
    tr["start"] = tr["starts"][lap % len(tr["starts"])]
    tr["lufs_target"] = k["lufs"]
    tr["duck"] = k["duck"]
    return tr


def beat(tr: dict) -> float:
    return 60.0 / tr["bpm"]


def snap(t: float, tr: dict | None, div: int = 1, mode: str = "near") -> float:
    """영상 시각 t 를 박자(div=2 면 반 박)에 맞춘다. tr 이 없으면 그대로."""
    if not tr:
        return t
    g = beat(tr) / div
    n = t / g
    import math
    n = math.ceil(n - 1e-6) if mode == "up" else math.floor(n + 1e-6) if mode == "down" else round(n)
    return round(n * g, 3)


def snap_len(want: float, tr: dict | None, most: float | None = None) -> float:
    """컷 길이를 가장 가까운 '박 수'로. most(클립에 남은 길이)를 넘지 않게, 최소 2박."""
    if not tr:
        return want
    b = beat(tr)
    n = max(2, round(want / b))
    if most is not None:
        while n > 2 and n * b > most + 1e-6:
            n -= 1
    return round(n * b, 3)


def duration(mp4: pathlib.Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def has_audio(mp4: pathlib.Path) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                        "-of", "csv=p=0", str(mp4)], capture_output=True, text=True)
    return bool(r.stdout.strip())


def filter_graph(tr: dict, dur: float, voice: bool) -> str:
    """[1:a]=곡, [0:a]=원래 소리(목소리·효과음). 결과 [a]."""
    gain = tr.get("lufs_target", -24) - tr["lufs"]
    fo = max(0.0, dur - 1.2)
    music = (f"[1:a]atrim=start={tr['start']}:duration={dur:.3f},asetpts=PTS-STARTPTS,"
             f"aformat=sample_rates=44100:channel_layouts=stereo,volume={gain:.1f}dB,"
             f"afade=t=in:d=0.3,afade=t=out:st={fo:.3f}:d=1.2")
    if not voice:
        return music + ",alimiter=limit=0.9[a]"
    orig = "[0:a]aresample=44100,aformat=channel_layouts=stereo,apad"
    if tr.get("duck", True):
        # 목소리가 나오면 BGM 을 약 8~10dB 낮추고, 끝나면 0.35초에 걸쳐 돌아온다.
        return (f"{music}[m];{orig},asplit=2[v][sc];"
                "[m][sc]sidechaincompress=threshold=0.04:ratio=8:attack=15:release=350:makeup=1[md];"
                f"[v][md]amix=inputs=2:normalize=0:duration=longest,atrim=duration={dur:.3f},alimiter=limit=0.95[a]")
    return (f"{music}[m];{orig}[v];[v][m]amix=inputs=2:normalize=0:duration=longest,"
            f"atrim=duration={dur:.3f},alimiter=limit=0.95[a]")


def mix(mp4: pathlib.Path, tr: dict | None) -> pathlib.Path:
    """mp4 에 곡을 깔아 같은 파일로 바꾼다. 영상은 다시 인코딩하지 않는다."""
    if not tr:
        return mp4
    mp4 = pathlib.Path(mp4)
    dur = duration(mp4)
    voice = has_audio(mp4)
    tmp = mp4.with_name(mp4.stem + "-bgm.mp4")
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4), "-i", str(ROOT / tr["file"]),
                        "-filter_complex", filter_graph(tr, dur, voice), "-map", "0:v", "-map", "[a]",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(tmp)])
    if r.returncode != 0:
        tmp.unlink(missing_ok=True)
        raise RuntimeError("BGM 섞기 실패")
    tmp.replace(mp4)
    return mp4

