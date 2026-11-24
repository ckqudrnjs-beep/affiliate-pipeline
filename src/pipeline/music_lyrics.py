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


# 괄호 없이 적힌 구간 이름 (Verse 1, Pre-Chorus, Chorus 🔥, Final Chorus, Outro, '---' 등) — 자막으로 내보내지 않음
SECTION = re.compile(r"(?i)(?:final |last )?(?:verse|pre-?chorus|post-?chorus|chorus|hook|bridge|drop|intro|outro|utro|interlude|break|refrain)"
                     r"(?:\s*\d+)?\W*")


def lyric_lines(lyrics: str) -> list[str]:
    out = []
    for l in lyrics.split("\n"):
        l = re.sub(r"\([^)]*\)", "", l).strip()  # (oh-oh) 같은 추임새 괄호 제거
        l = l.strip("\"“”'‘’ ").strip()
        if not l or re.fullmatch(r"\[[^\]]*\]", l) or re.fullmatch(r"[-—=_*~·.\s]+", l) or SECTION.fullmatch(l):
            continue
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
            import numpy as np
            raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(wav), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                                 check=True, capture_output=True).stdout
            pcm = np.frombuffer(raw, dtype=np.float32)  # PyAV 버전 차이(open metadata_errors) 피하려고 직접 디코딩
            m = WhisperModel(model, device="cpu", compute_type="int8")
            segs, _ = m.transcribe(pcm, language="ko", vad_filter=False, beam_size=5,
                                   condition_on_previous_text=False)
            out = [(s.start, s.end, s.text) for s in segs]
            print(f"받아쓰기 {len(out)}구간:", " / ".join(t.strip() for _, _, t in out)[:300])
            return out
        except Exception as e:  # noqa: BLE001 모델 다운로드 실패 등은 자막 없이 진행
            print("가사 받아쓰기 실패:", e)
            return []


def subtitles(audio: pathlib.Path, lyrics: str, start: float, length: float) -> list[tuple[float, float, str]]:
    lines = lyric_lines(lyrics)
    if not lines:
        return []
    subs = fill_gaps(align(transcribe(audio, start, length), lines), lines)
    # 화면에 너무 짧게 깜빡이지 않게 최소 1.2초
    return [(a, max(b, a + 1.2), t) for a, b, t in subs if a < length]


def fill_gaps(subs: list, lines: list[str], max_missing: int = 6) -> list:
    """받아쓰기가 놓친 가사 줄 채우기 (BK 11/23 '중간에 가사 자막이 안 나와').

    맞춘 두 줄 사이에 공식 가사 줄이 빠져 있으면, 앞 줄 시작~뒤 줄 시작 구간을
    (앞 줄 + 빠진 줄들) 개수로 똑같이 나눠 순서대로 넣는다. 후렴 반복처럼 가사 순서가
    뒤로 돌아가는 곳은 건드리지 않는다.
    """
    if not subs or not lines:
        return subs
    idx, last = [], -1
    for _, _, t in subs:
        cands = [i for i, l in enumerate(lines) if l == t]
        near = [i for i in cands if last < i <= last + 8]
        i = near[0] if near else -1  # 멀리 건너뛴 줄(아웃트로 등)은 순서 기준으로 쓰지 않음
        idx.append(i)
        if i >= 0:
            last = i
        elif cands and last < 0:
            last = cands[0]
    out = []
    for k, (a, b, t) in enumerate(subs):
        i = idx[k]
        if k + 1 < len(subs) and i >= 0 and idx[k + 1] > i + 1 and idx[k + 1] - i - 1 <= max_missing:
            j = idx[k + 1]
            s2 = subs[k + 1][0]
            n = j - i
            step = (s2 - a) / n
            if step >= 1.0:
                out.append((a, a + step, t))
                for m in range(1, n):
                    out.append((a + m * step, a + (m + 1) * step, lines[i + m]))
                continue
        out.append((a, b, t))
    return out
