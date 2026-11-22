"""쇼츠 가사 자막 (BK 11/22 '3번 진행'): 노래 구간을 받아쓰기(faster-whisper)로 시간만 잡고,
화면 글자는 곡 파일에 든 '공식 가사' 줄로 바꿔 넣는다. 받아쓰기가 틀려도 가사 글자는 정확하다.

맞는 가사 줄을 못 찾은 구간은 비워 둔다(엉뚱한 자막보다 없는 게 낫다).
faster-whisper 가 없거나 모델을 못 받으면 자막 없이 진행한다.
"""
from __future__ import annotations

import difflib
import pathlib
import re
import subprocess
import tempfile


def lyric_lines(lyrics: str) -> list[str]:
    out = []
    for l in lyrics.split("\n"):
        l = re.sub(r"\([^)]*\)", "", l).strip()  # (oh-oh) 같은 추임새 괄호 제거
        if l and not re.fullmatch(r"\[[^\]]*\]", l):
            out.append(l)
    return out


def _norm(s: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]", "", s.lower())


def align(segments: list[tuple[float, float, str]], lines: list[str], min_score: float = 0.38):
    """받아쓰기 구간마다 가장 비슷한 가사 줄. 가사 순서가 앞으로만 가도록 살짝 가산점."""
    if not lines:
        return []
    nl = [_norm(l) for l in lines]
    out, last = [], -1
    for t0, t1, txt in segments:
        n = _norm(txt)
        if len(n) < 2:
            continue
        best, bi = 0.0, -1
        for i, cand in enumerate(nl):
            if not cand:
                continue
            sc = difflib.SequenceMatcher(None, n, cand).ratio()
            if last >= 0 and 0 < i - last <= 2:
                sc += 0.06
            if sc > best:
                best, bi = sc, i
        if bi >= 0 and best >= min_score:
            if out and out[-1][2] == lines[bi] and t0 - out[-1][1] < 0.6:
                out[-1] = (out[-1][0], t1, lines[bi])
            else:
                out.append((t0, t1, lines[bi]))
            last = bi
    return out


def transcribe(audio: pathlib.Path, start: float, length: float, model: str = "small") -> list[tuple[float, float, str]]:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return []
    with tempfile.TemporaryDirectory() as td:
        wav = pathlib.Path(td) / "clip.wav"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(start), "-t", str(length), "-i", str(audio),
                        "-ac", "1", "-ar", "16000", str(wav)], check=True)
        try:
            m = WhisperModel(model, device="cpu", compute_type="int8")
            segs, _ = m.transcribe(str(wav), language="ko", vad_filter=False, beam_size=5,
                                   condition_on_previous_text=False)
            return [(s.start, s.end, s.text) for s in segs]
        except Exception as e:  # noqa: BLE001 모델 다운로드 실패 등은 자막 없이 진행
            print("가사 받아쓰기 실패:", e)
            return []


def subtitles(audio: pathlib.Path, lyrics: str, start: float, length: float) -> list[tuple[float, float, str]]:
    lines = lyric_lines(lyrics)
    if not lines:
        return []
    subs = align(transcribe(audio, start, length), lines)
    # 화면에 너무 짧게 깜빡이지 않게 최소 1.2초
    return [(a, max(b, a + 1.2), t) for a, b, t in subs if a < length]
