"""5락실 채널 쇼츠: 오늘의 밸런스게임 자동 제작 + 자동 업로드 (2026-11-13 BK 요청).

- 질문: playground/data/questions.json 에서 오늘(KST) 날짜의 첫 질문.
- 어제 질문의 실제 투표 수(https://5raksil.com/api/vote)가 20표 이상이면 결과 공개 장면을 넣는다(실제 숫자만).
- 화면: 사이트와 같은 네온 오락실 스타일, 1080x1920, 약 14초, 마지막 장면이 첫 장면으로 자연스럽게 이어짐.
- 목소리: Supertonic(무료) 여자 목소리. 설치가 안 된 환경이면 효과음만 넣는다.
- 업로드: 5락실 채널에 바로 '공개'. 상품·협찬이 없으므로 유료 프로모션 아님(광고 문구 없음).
  AI 음성을 쓰면 설명란에 "내레이션: AI 음성"과 containsSyntheticMedia=True.
- 안전장치: RAKSIL_YT_ENABLED=true 가 아니면 만들기만 하고 올리지 않는다. 같은 날짜는 두 번 올리지 않는다.
- 인증: YT_CLIENT_ID / YT_CLIENT_SECRET (돈삼촌과 같은 OAuth 앱) + RAKSIL_YT_REFRESH_TOKEN (5락실 채널로 발급).
  GitHub Secrets 에서만 읽고 로그에 찍지 않는다. 발급 방법: docs/RAKSIL_YOUTUBE.md

실행: PYTHONPATH=src python -m pipeline.raksil_shorts [render|upload] [YYYY-MM-DD]
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import pathlib
import random
import subprocess
import sys
import urllib.request

KST = dt.timezone(dt.timedelta(hours=9))
W, H, FPS, SR = 1080, 1920, 30, 44100
QUESTIONS = pathlib.Path("playground/data/questions.json")
OUT = pathlib.Path("media/raksil")
LOG = pathlib.Path("data/youtube/raksil_uploaded.json")
SITE = "https://5raksil.com"
MIN_VOTES = 20
VOICE = os.environ.get("RAKSIL_VOICE", "F1")

BG, BG2 = (12, 6, 32), (42, 15, 85)
PINK, CYAN, YEL, WHITE, MUTED = (255, 61, 127), (34, 211, 238), (255, 210, 63), (244, 240, 255), (169, 159, 201)
TAGS = ["밸런스게임", "5락실", "너라면", "밸런스게임질문", "양자택일", "shorts"]


# ---------- 데이터 ----------
def load_questions(path: pathlib.Path = QUESTIONS) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def pick_question(qs: list[dict], day: dt.date) -> dict | None:
    today = sorted((q for q in qs if q.get("date") == day.isoformat()), key=lambda q: q["id"])
    return today[0] if today else None


def fetch_votes(qid: str) -> dict | None:
    try:
        req = urllib.request.Request(f"{SITE}/api/vote?ids={qid}", headers={"User-Agent": "5raksil-shorts"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r).get(qid)
    except Exception as e:  # 집계를 못 읽으면 결과 장면만 빼고 계속
        print(f"투표 수 조회 실패: {e}", file=sys.stderr)
        return None


def result_of(q: dict | None, votes: dict | None) -> dict | None:
    """어제 결과. 실제 표가 MIN_VOTES 이상일 때만."""
    if not q or not votes:
        return None
    a, b = int(votes.get("a", 0)), int(votes.get("b", 0))
    if a + b < MIN_VOTES:
        return None
    pa = round(a * 100 / (a + b))
    return {"a": q["a"], "b": q["b"], "pa": pa, "pb": 100 - pa, "n": a + b}


def script(q: dict, res: dict | None) -> list[str]:
    """장면별 대사 (빈 문자열 = 대사 없음)."""
    last = "투표는 오락실 닷컴에서. 댓글로 너의 선택도 알려줘!"
    if res:
        win, pct = (res["a"], res["pa"]) if res["pa"] >= res["pb"] else (res["b"], res["pb"])
        mid = f"참고로 어제는 {pct}퍼센트가 {win}을 골랐어."
    else:
        mid = "정답은 없어. 다른 사람들은 뭘 골랐을까?"
    return [f"{q['a']}. 대. {q['b']}. 너라면?", "", mid, last]


def title_of(q: dict) -> str:
    t = f"{q['a']} vs {q['b']} 너라면? #밸런스게임 #shorts"
    if len(t) > 100:
        t = f"{q['a'][:30]} vs {q['b'][:30]} 너라면? #밸런스게임"
    return t


def description_of(q: dict, res: dict | None, ai_voice: bool) -> str:
    lines = [f"오늘의 밸런스게임: {q['a']} vs {q['b']}", "",
             f"▶ 투표하고 실제 결과 보기: {SITE}/q/{q['id']}", f"▶ 매일 새 질문·틀린그림찾기·초성퀴즈: {SITE}", ""]
    if res:
        lines += [f"어제 결과({res['n']}표): {res['a']} {res['pa']}% / {res['b']} {res['pb']}%", ""]
    if ai_voice:
        lines.append("내레이션: AI 음성")
    lines.append("#밸런스게임 #너라면 #5락실")
    return "\n".join(lines)


# ---------- 그림 ----------
def font(size: int):
    from PIL import ImageFont
    for f in (os.environ.get("RAKSIL_FONT", ""), "/usr/share/fonts/truetype/blackhansans/BlackHanSans-Regular.ttf",
              "/usr/share/fonts/truetype/nanum/NanumGothicExtraBold.ttf"):
        if f and pathlib.Path(f).exists():
            return ImageFont.truetype(f, size)
    from .shorts import font as f2
    return f2(size)


def wrap(dr, s: str, f, maxw: int) -> list[str]:
    words, lines, cur = s.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if dr.textlength(t, font=f) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    out = []
    for ln in lines:  # 띄어쓰기 없는 긴 줄은 글자 단위로
        while dr.textlength(ln, font=f) > maxw and len(ln) > 1:
            k = len(ln)
            while k > 1 and dr.textlength(ln[:k], font=f) > maxw:
                k -= 1
            out.append(ln[:k])
            ln = ln[k:]
        out.append(ln)
    return out


def fit(dr, s: str, maxw: int, maxh: int, start: int = 130) -> tuple:
    size = start
    while size > 40:
        f = font(size)
        ls = wrap(dr, s, f, maxw)
        if len(ls) * size * 1.2 <= maxh:
            return f, ls, size
        size -= 6
    f = font(40)
    return f, wrap(dr, s, f, maxw)[:4], 40


def glow_text(img, xy_center, lines: list[str], f, size: int, color, glow: int = 18, stroke: int = 0):
    """네온 글씨: 흐린 빛 + 본 글씨."""
    from PIL import Image, ImageDraw, ImageFilter
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    cx, cy = xy_center
    lh = size * 1.2
    y0 = cy - lh * len(lines) / 2
    for i, ln in enumerate(lines):
        x = cx - dr.textlength(ln, font=f) / 2
        dr.text((x, y0 + i * lh), ln, font=f, fill=color + (255,), stroke_width=stroke, stroke_fill=color + (255,))
    blur = layer.filter(ImageFilter.GaussianBlur(glow))
    img.alpha_composite(blur)
    img.alpha_composite(blur)
    top = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d2 = ImageDraw.Draw(top)
    for i, ln in enumerate(lines):
        x = cx - d2.textlength(ln, font=f) / 2
        d2.text((x, y0 + i * lh), ln, font=f, fill=(255, 255, 255, 255) if color != WHITE else color + (255,),
                stroke_width=2, stroke_fill=color + (255,))
    img.alpha_composite(top)


def background(seed: int = 5):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (W, H), BG + (255,))
    dr = ImageDraw.Draw(img)
    for y in range(H):  # 위→아래 보라 그라데이션
        k = math.sin(math.pi * y / H) * 0.9
        c = tuple(int(BG[i] + (BG2[i] - BG[i]) * k) for i in range(3))
        dr.line([(0, y), (W, y)], fill=c + (255,))
    rnd = random.Random(seed)
    for _ in range(90):
        x, y, r = rnd.randrange(W), rnd.randrange(int(H * 0.75)), rnd.choice([1, 2, 2, 3])
        dr.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randrange(90, 200)))
    # 아래 원근 격자
    hz = int(H * 0.80)
    for i in range(-14, 15):
        dr.line([(W / 2 + i * 40, hz), (W / 2 + i * 260, H)], fill=PINK + (90,), width=2)
    y, step = hz, 8
    while y < H:
        dr.line([(0, y), (W, y)], fill=PINK + (90,), width=2)
        step *= 1.35
        y += int(step)
    return img


def header(img):
    from PIL import ImageDraw
    dr = ImageDraw.Draw(img)
    f = font(64)
    w5, wr = dr.textlength("5", font=f), dr.textlength("락실", font=f)
    x = W / 2 - (w5 + wr + 8) / 2
    glow_text(img, (x + w5 / 2, 120), ["5"], f, 64, PINK, glow=10)
    glow_text(img, (x + w5 + 8 + wr / 2, 120), ["락실"], f, 64, CYAN, glow=10)
    glow_text(img, (W / 2, 215), ["오늘의 밸런스게임"], font(48), 48, YEL, glow=8)


def panel(img, box, color, label: str, text: str):
    from PIL import ImageDraw
    x0, y0, x1, y1 = box
    dr = ImageDraw.Draw(img)
    dr.rounded_rectangle(box, radius=40, fill=tuple(int(c * 0.22) for c in color) + (255,), outline=color + (255,), width=8)
    glow_text(img, (x0 + 80, y0 + 70), [label], font(80), 80, color, glow=10)
    f, ls, size = fit(dr, text, x1 - x0 - 100, y1 - y0 - 170)
    glow_text(img, ((x0 + x1) / 2, (y0 + y1) / 2 + 30), ls, f, size, color, glow=14)


def question_card(q: dict):
    img = background()
    header(img)
    panel(img, (60, 300, W - 60, 900), PINK, "A", q["a"])
    panel(img, (60, 1020, W - 60, 1620), CYAN, "B", q["b"])
    return img


def vs_layer(scale: float):
    from PIL import Image
    s = max(10, int(130 * scale))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_text(img, (W / 2, 960), ["VS"], font(s), s, YEL, glow=16)
    return img


def result_card(res: dict, k: float):
    from PIL import ImageDraw
    img = background(7)
    header(img)
    glow_text(img, (W / 2, 400), ["어제의 결과"], font(90), 90, YEL, glow=14)
    dr = ImageDraw.Draw(img)
    for i, (txt, pct, col) in enumerate(((res["a"], res["pa"], PINK), (res["b"], res["pb"], CYAN))):
        y = 620 + i * 430
        f, ls, size = fit(dr, txt, W - 200, 170, 76)
        glow_text(img, (W / 2, y), ls, f, size, col, glow=8)
        bx0, by0, bx1, by1 = 100, y + 120, W - 100, y + 220
        dr.rounded_rectangle((bx0, by0, bx1, by1), radius=50, outline=col + (255,), width=6)
        fill = bx0 + 8 + (bx1 - bx0 - 16) * pct / 100 * k
        if fill > bx0 + 30:
            dr.rounded_rectangle((bx0 + 8, by0 + 8, fill, by1 - 8), radius=42, fill=col + (255,))
        glow_text(img, (W / 2, by1 + 70), [f"{round(pct * k)}%"], font(80), 80, WHITE, glow=6)
    glow_text(img, (W / 2, 1560), [f"실제 투표 {res['n']:,}표"], font(48), 48, MUTED, glow=2)
    return img


def tease_card(k: float):
    img = background(9)
    header(img)
    glow_text(img, (W / 2, 760), ["정답은 없다!"], font(130), 130, PINK, glow=18)
    glow_text(img, (W / 2, 1030), ["다른 사람들은", "뭘 골랐을까?"], font(100), 100, CYAN, glow=14)
    return img


def cta_card(t: float):
    img = background(11)
    header(img)
    glow_text(img, (W / 2, 640), ["투표하고", "결과 보기"], font(120), 120, WHITE, glow=10)
    blink = PINK if int(t * 3) % 2 == 0 else YEL
    glow_text(img, (W / 2, 1000), ["5raksil.com"], font(130), 130, blink, glow=20)
    glow_text(img, (W / 2, 1260), ["댓글로 A? B?"], font(80), 80, CYAN, glow=12)
    glow_text(img, (W / 2, 1480), ["INSERT COIN"], font(56), 56, YEL, glow=8)
    return img


def countdown_layer(n: int, frac: float):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    r = 120
    cx, cy = W / 2, 960
    dr.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BG + (235,), outline=YEL + (255,), width=10)
    dr.arc((cx - r - 16, cy - r - 16, cx + r + 16, cy + r + 16), -90, -90 + 360 * (1 - frac), fill=PINK + (255,), width=14)
    glow_text(img, (cx, cy - 10), [str(n)], font(150), 150, YEL, glow=10)
    return img


# ---------- 소리 ----------
def tts(lines: list[str]):
    """대사 → (클립 리스트, 성공 여부). supertonic 이 없으면 무음."""
    import numpy as np
    try:
        from supertonic import TTS
        from .uncle import resample
        t = TTS()
        style = t.get_voice_style(VOICE)
        out = []
        for s in lines:
            if not s.strip():
                out.append(np.zeros(1, dtype=np.float32))
                continue
            wav, _ = t.synthesize(s, voice_style=style, lang="ko", total_steps=32, speed=1.05)
            out.append(resample(wav.reshape(-1).astype(np.float32), t.sample_rate))
        return out, True
    except Exception as e:
        print(f"음성 없이 진행: {e}", file=sys.stderr)
        return [np.zeros(1, dtype=np.float32) for _ in lines], False


def tone(freq: float, dur: float, vol: float = 0.25, kind: str = "square"):
    import numpy as np
    t = np.arange(int(SR * dur)) / SR
    w = np.sign(np.sin(2 * np.pi * freq * t)) if kind == "square" else np.sin(2 * np.pi * freq * t)
    env = np.exp(-t * 10)
    return (w * env * vol).astype(np.float32)


def place(buf, clip, at: float):
    i = int(at * SR)
    j = min(len(buf), i + len(clip))
    if j > i:
        buf[i:j] += clip[: j - i]


# ---------- 만들기 ----------
def render(day: dt.date, out_dir: pathlib.Path = OUT) -> dict | None:
    import numpy as np
    qs = load_questions()
    q = pick_question(qs, day)
    if not q:
        print(f"{day} 질문 없음")
        return None
    yq = pick_question(qs, day - dt.timedelta(days=1))
    res = result_of(yq, fetch_votes(yq["id"]) if yq else None)
    lines = script(q, res)
    clips, voiced = tts(lines)

    d0 = max(3.0, len(clips[0]) / SR + 0.6)
    d1 = 3.0  # 3,2,1
    d2 = max(3.2, len(clips[2]) / SR + 0.6)
    d3 = max(3.2, len(clips[3]) / SR + 0.5)
    durs = [d0, d1, d2, d3]
    total = sum(durs)
    starts = [sum(durs[:i]) for i in range(4)]

    audio = np.zeros(int(SR * total) + SR, dtype=np.float32)
    for c, s in zip(clips, starts):
        place(audio, c * 0.95, s + 0.15)
    place(audio, tone(880, 0.12) + 0, 0.0)
    for i in range(3):
        place(audio, tone(660, 0.1, 0.2), starts[1] + i)
    place(audio, np.concatenate([tone(523, 0.08), tone(659, 0.08), tone(784, 0.16)]), starts[2])
    place(audio, tone(1046, 0.15, 0.15, "sine"), starts[3])
    # 잔잔한 8비트 베이스 루프
    bass = [110, 110, 147, 131]
    t = 0.0
    while t < total:
        place(audio, tone(bass[int(t * 2) % 4], 0.45, 0.07), t)
        t += 0.5
    audio = np.clip(audio, -1, 1)[: int(SR * total)]

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{day.isoformat()}-balance"
    wav = out_dir / f"{stem}.wav"
    mp4 = out_dir / f"{stem}.mp4"
    import wave
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())

    base_q = question_card(q)
    vs_cache = {}
    tease = tease_card(1) if not res else None
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium",
                           "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest",
                           "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    n = int(total * FPS)
    res_cache: dict = {}
    for i in range(n):
        t = i / FPS
        sc = max(k for k in range(4) if starts[k] <= t)
        lt = t - starts[sc]
        if sc == 0:
            img = base_q.copy()
            s = 0.6 + 0.4 * min(1, lt / 0.4) + 0.05 * math.sin(lt * 6)
            key = round(s, 2)
            vs_cache.setdefault(key, vs_layer(key))
            img.alpha_composite(vs_cache[key])
        elif sc == 1:
            img = base_q.copy()
            num = 3 - int(lt)
            key = (num, round(lt % 1, 1))
            vs_cache.setdefault(key, countdown_layer(num, lt % 1))
            img.alpha_composite(vs_cache[key])
        elif sc == 2:
            if res:
                k = round(min(1, lt / 1.2) ** 0.5, 2)
                res_cache.setdefault(k, result_card(res, k))
                img = res_cache[k]
            else:
                img = tease
        else:
            key = int(lt * 3) % 2
            res_cache.setdefault(("cta", key), cta_card(key / 3))
            img = res_cache[("cta", key)]
        ff.stdin.write(img.convert("RGB").tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg 실패")
    wav.unlink()
    meta = {"date": day.isoformat(), "qid": q["id"], "file": str(mp4), "title": title_of(q),
            "description": description_of(q, res, voiced), "voiced": voiced, "result": res, "seconds": round(total, 1)}
    (out_dir / f"{stem}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


# ---------- 올리기 ----------
PUBLISH_HOUR = 17  # KST, BK 2026-11-13: 매일 오후 5시 공개


def publish_time(meta: dict, now: dt.datetime) -> dt.datetime | None:
    """그날 17:00 KST 전이면 그 시각 예약, 지났으면 None(바로 공개)."""
    at = dt.datetime.combine(dt.date.fromisoformat(meta["date"]), dt.time(PUBLISH_HOUR), KST)
    return at if now < at - dt.timedelta(minutes=2) else None


def video_body(meta: dict, publish_at: dt.datetime | None = None) -> dict:
    status = {"privacyStatus": "public"} if publish_at is None else {
        "privacyStatus": "private",  # publishAt 은 private 일 때만
        "publishAt": publish_at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    return {
        "snippet": {"title": meta["title"], "description": meta["description"], "tags": TAGS,
                    "categoryId": "24", "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
        "status": {**status, "selfDeclaredMadeForKids": False,
                   "containsSyntheticMedia": bool(meta.get("voiced")), "embeddable": True},
    }


def upload_meta(meta: dict) -> int:
    from .youtube import access_token, summary, upload
    log = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {}
    if meta["date"] in log:
        summary(f"{meta['date']} 이미 올림: https://youtu.be/{log[meta['date']]['id']}")
        return 0
    if os.environ.get("RAKSIL_YT_ENABLED", "").lower() != "true":
        summary(f"dry-run (RAKSIL_YT_ENABLED 꺼짐): {meta['title']}")
        return 0
    need = ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "RAKSIL_YT_REFRESH_TOKEN")
    if not all(os.environ.get(k) for k in need):
        summary("5락실 유튜브 비밀값이 없어 업로드하지 않음 (docs/RAKSIL_YOUTUBE.md)")
        return 1
    tok = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"], os.environ["RAKSIL_YT_REFRESH_TOKEN"])
    at = publish_time(meta, dt.datetime.now(KST))
    r = upload(tok, video_body(meta, at), pathlib.Path(meta["file"]))
    log[meta["date"]] = {"id": r["id"], "qid": meta["qid"], "title": meta["title"]}
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    when = f"{at:%H:%M} 공개 예약" if at else "바로 공개"
    summary(f"5락실 쇼츠 업로드 ({when}): https://youtu.be/{r['id']} ({meta['title']})")
    return 0


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "render"
    day = dt.date.fromisoformat(argv[2]) if len(argv) > 2 else dt.datetime.now(KST).date()
    meta = render(day)
    if not meta:
        return 0
    return upload_meta(meta) if cmd == "upload" else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
