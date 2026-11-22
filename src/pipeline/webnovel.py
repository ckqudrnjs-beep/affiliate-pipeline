"""웹소설 쇼츠 '한 화만 더' (BK 2026-11-21): 오리지널 웹소설을 하루 한 화, 글 카드 세로 쇼츠로 자동 제작·업로드.

- 대본: data/webnovel/works/<작품>/season.json + ep/NN.json (카드 = 줄 목록 + 모티프). 오리지널만, 기존 작품 베끼기 금지.
- 품질: 40점 점수표(docs/WEBNOVEL.md) 32점 이상 + 2점 이하 항목 없음인 화만 data 에 들어온다. 여기선 정책 검사만 다시 한다.
- 화면: 코드로 그림(그림 AI 안 씀). 작품마다 season.json style 로 색을 바꿔 반복 콘텐츠로 보이지 않게.
- 소리: 효과음 합성 + (있으면) BK Suno 곡(config bgm). AGENTS 0-13.
- 업로드: 웹소설 채널 전용 토큰 WEBNOVEL_YT_REFRESH_TOKEN, 아동용 아님(selfDeclaredMadeForKids=False) 자동,
  AI 그림을 쓴 화(ep "ai": true)는 설명란 표기 + containsSyntheticMedia.
  config visibility=private 이면 첫 화만 비공개로 올리고 멈춤(BK 확인), schedule 이면 매일 hour 시 공개 예약.
- 롱폼 몰아보기(BK 2026-11-21): 일요일마다 쇼츠 5화 묶음 + 롱폼 전용 번외(extra/NN.json)를 가로 영상으로, long_hour 시 공개 예약.
사용: python -m pipeline.webnovel next | render [화] | long [묶음] | run [YYYY-MM-DD]
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
import wave

ROOT = pathlib.Path(__file__).resolve().parents[2]
KST = dt.timezone(dt.timedelta(hours=9))
CFG = ROOT / "config" / "webnovel.json"
WORKS = ROOT / "data" / "webnovel" / "works"
LOG = ROOT / "data" / "youtube" / "webnovel.json"
OUT = ROOT / "media" / "webnovel"
W, H, FPS = 1080, 1920, 30
BAND = 230          # 위 검은 제목 띠
LW, LH, LBAND = 1920, 1080, 120   # 롱폼 몰아보기(가로)
LONG_EVERY = 5      # 몇 화마다 몰아보기 한 편
MAXW = 960          # 글 한 줄 최대 폭(px)
STY = {"n": ("R", 64, "white"), "q": ("B", 68, "quote"), "r": ("B", 84, "accent"), "g": ("B", 56, "gold"),
       "s": ("R", 40, "gray"), "big": ("B", 96, "white"), "bigr": ("B", 104, "accent")}
BANNED = ["피투성이", "피가 흘", "피를 흘", "시신", "시체", "자살", "자해", "목을 매", "칼로", "찔러", "토막", "성폭", "미성년"]


def load(p: pathlib.Path, default):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def season(work: str) -> dict:
    return load(WORKS / work / "season.json", {})


def episodes(work: str) -> list[dict]:
    return [load(p, {}) for p in sorted((WORKS / work / "ep").glob("*.json"))]


def key(work: str, no: int) -> str:
    return f"{work}/{no:02d}"


def next_episode(cfg: dict, log: dict) -> dict | None:
    """아직 안 올린 다음 화. private 모드에선 하나라도 올렸으면 멈춘다(BK 확인 대기)."""
    work = cfg.get("work", "")
    done = [k for k in log if k.startswith(work + "/")]
    if cfg.get("visibility", "private") == "private" and done:
        return None
    for ep in episodes(work):
        if key(work, ep["no"]) not in log:
            return ep
    return None


def policy_problems(ep: dict) -> list[str]:
    """실격 조건 중 글로 잡을 수 있는 것: 잔혹·자해 표현, 빈 카드, 첫 카드 없음."""
    bad = []
    cards = ep.get("cards") or []
    if not cards:
        bad.append("카드 없음")
    for i, c in enumerate(cards):
        if not c.get("lines"):
            bad.append(f"{i + 1}번 카드 빈 줄")
        for t, s in c.get("lines", []):
            if s not in STY:
                bad.append(f"{i + 1}번 카드 모르는 스타일 {s}")
            bad += [f"{i + 1}번 카드 금지 표현 '{b}'" for b in BANNED if b in t]
    return bad


def title_of(se: dict, ep: dict) -> str:
    return f"{se['title']} {ep['no']}화 | {ep['title']} #웹소설 #shorts"[:100]


def links_of(work: str, no: int, log: dict) -> dict:
    """설명란 연결용 영상 ID: 1화·이전 화·다음 화(이미 올라간 것만)."""
    g = lambda n: (log.get(key(work, n)) or {}).get("id")  # noqa: E731
    return {"first": g(1) if no > 1 else None, "prev": g(no - 1), "next": g(no + 1)}


def description_of(se: dict, ep: dict, links: dict | None = None, playlist: str | None = None) -> str:
    top = f"⏮ 1화부터 정주행: https://www.youtube.com/playlist?list={playlist}\n" if playlist else ""
    body = " ".join(t for c in ep["cards"] for t, _ in c["lines"])
    nxt = ep.get("next", {}); lk = links or {}
    tail = f"다음 화: {nxt['no']}화 {nxt['title']}" if nxt.get("title") else nxt.get("season_end", "")
    if lk.get("next"):
        tail = f"▶ 다음 화 {nxt.get('no', ep['no'] + 1)}화 {nxt.get('title', '')}: https://youtu.be/{lk['next']}"
    elif nxt.get("title"):
        tail += " (내일 밤 9시)"
    nav = [f"◀ 이전 화: https://youtu.be/{lk['prev']}"] if lk.get("prev") else []
    if lk.get("first") and lk.get("first") != lk.get("prev"):
        nav.append(f"⏮ 1화부터 보기: https://youtu.be/{lk['first']}")
    if nav:
        tail += "\n" + "\n".join(nav)
    ai = "\nAI로 만든 그림이 포함되어 있습니다." if ep.get("ai") else ""
    return (f"{top}{se['title']} {ep['no']}화 — {ep['title']}\n\n{body}\n\n{tail}\n\n"
            f"이 채널이 직접 쓴 오리지널 창작 웹소설입니다. 등장인물·단체는 실제와 관계없습니다.{ai}\n"
            f"#웹소설 #{se.get('genre', '').split(' ')[0]} #복수극 #한화만더")


# ---------- 그림 ----------
def _font(kind: str, size: int):
    from PIL import ImageFont
    d = pathlib.Path(os.environ.get("WEBNOVEL_FONT_DIR", str(pathlib.Path.home() / "fonts")))
    name = "GowunBatang-Bold.ttf" if kind == "B" else "GowunBatang-Regular.ttf"
    for p in (d / name, ROOT / "config" / "fonts" / name, ROOT / "config" / "fonts" / "Jua-Regular.ttf"):
        if p.exists():
            return ImageFont.truetype(str(p), size)
    raise FileNotFoundError("글꼴 없음 (WEBNOVEL_FONT_DIR 에 고운바탕)")


def palette(se: dict) -> dict:
    st = se.get("style", {})
    acc = tuple(st.get("accent", (205, 45, 55)))
    return {"white": (238, 234, 226), "quote": (240, 220, 190), "accent": acc, "gold": tuple(st.get("gold", (214, 180, 110))),
            "gray": (150, 145, 140), "bg": tuple(st.get("bg", (18, 14, 22))), "accent_bg": tuple(st.get("accent_bg", (40, 10, 16)))}


def background(tint, w=W, h=H):
    import numpy as np
    from PIL import Image
    x = np.linspace(-1, 1, w)[None, :]; y = np.linspace(-1, 1, h)[:, None]
    vig = np.clip(1 - 0.55 * (x ** 2 + (y * 0.8) ** 2), 0, 1)
    base = np.array(tint, float)[None, None, :] * (0.6 + 0.6 * vig[..., None]) + 10 * (1 - (y + 1) / 2)[..., None]
    noise = np.random.default_rng(1).normal(0, 6, (h, w, 1))
    return Image.fromarray(np.clip(base + noise, 0, 255).astype(np.uint8))


LINE = (200, 200, 210)


def motif(d, kind: str, cx: float, cy: float, pal: dict) -> None:
    if kind in ("wine", "wine_dark", "wine2"):
        xs = [cx - 110, cx + 110] if kind == "wine2" else [cx]
        for x in xs:
            c = (70, 10, 18) if kind == "wine_dark" else (120, 20, 30)
            d.chord([x - 70, cy - 120, x + 70, cy + 20], 0, 180, fill=c)
            d.arc([x - 70, cy - 160, x + 70, cy + 20], 0, 180, fill=LINE, width=4)
            for sx in (x - 70, x + 70):
                d.line([sx, cy - 70, sx, cy - 130], fill=LINE, width=4)
            d.line([x, cy + 20, x, cy + 120], fill=LINE, width=5)
            d.line([x - 50, cy + 120, x + 50, cy + 120], fill=LINE, width=5)
    elif kind in ("phone", "phone_msg"):
        d.rounded_rectangle([cx - 80, cy - 140, cx + 80, cy + 140], 24, outline=LINE, width=5)
        if kind == "phone":
            d.text((cx, cy - 20), "D-1", font=_font("B", 64), fill=pal["gold"], anchor="mm")
            d.text((cx, cy + 50), "결혼식", font=_font("R", 34), fill=pal["white"], anchor="mm")
        else:
            d.rounded_rectangle([cx - 60, cy - 60, cx + 50, cy - 10], 14, fill=(70, 70, 80))
            d.rounded_rectangle([cx - 40, cy + 10, cx + 60, cy + 60], 14, fill=pal["accent"])
    elif kind == "paper":
        d.rectangle([cx - 100, cy - 140, cx + 100, cy + 140], outline=LINE, width=4)
        for k in range(6):
            d.line([cx - 70, cy - 95 + k * 38, cx + (70 if k % 3 else 20), cy - 95 + k * 38], fill=(120, 115, 125), width=4)
        d.ellipse([cx + 30, cy + 70, cx + 85, cy + 125], outline=pal["accent"], width=4)
    elif kind == "clock":
        d.ellipse([cx - 120, cy - 120, cx + 120, cy + 120], outline=LINE, width=5)
        d.line([cx, cy, cx, cy - 85], fill=pal["white"], width=6)
        d.line([cx, cy, cx + 60, cy + 25], fill=pal["accent"], width=6)
    elif kind == "gift":
        d.rectangle([cx - 100, cy - 70, cx + 100, cy + 110], outline=LINE, width=4)
        d.line([cx, cy - 70, cx, cy + 110], fill=pal["accent"], width=8)
        d.line([cx - 100, cy + 10, cx + 100, cy + 10], fill=pal["accent"], width=8)
        d.ellipse([cx - 50, cy - 120, cx, cy - 70], outline=pal["accent"], width=6)
        d.ellipse([cx, cy - 120, cx + 50, cy - 70], outline=pal["accent"], width=6)
    elif kind == "pearl":
        d.arc([cx - 140, cy - 80, cx + 140, cy + 120], 200, 340, fill=(150, 140, 130), width=3)
        for k in (-1, 0, 1):
            x = cx + k * 70; y = cy - 30 + abs(k) * 22
            d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=(235, 228, 215), outline=(255, 255, 255), width=2)
    elif kind == "rec":
        d.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], fill=pal["accent"])
        d.ellipse([cx - 80, cy - 80, cx + 80, cy + 80], outline=pal["accent"], width=3)
    elif kind == "glass":
        d.polygon([(cx - 60, cy - 110), (cx + 60, cy - 110), (cx + 45, cy + 110), (cx - 45, cy + 110)], outline=LINE)
        d.polygon([(cx - 55, cy - 40), (cx + 55, cy - 40), (cx + 45, cy + 105), (cx - 45, cy + 105)], fill=(220, 140, 40))
    elif kind == "light":
        d.rounded_rectangle([cx - 60, cy - 150, cx + 60, cy + 150], 20, outline=LINE, width=4)
        d.ellipse([cx - 40, cy - 125, cx + 40, cy - 45], fill=pal["accent"])
        for k in (0, 1):
            d.ellipse([cx - 40, cy - 40 + k * 85, cx + 40, cy + 40 + k * 85], outline=(90, 90, 100), width=3)


def fit(text: str, kind: str, size: int, maxw: int = MAXW):
    f = _font(kind, size)
    while f.getlength(text) > maxw and size > 30:
        size -= 4; f = _font(kind, size)
    return f, size


def draw_card(card: dict, pal: dict, upto: int | None = None, alpha: float = 1.0, final: bool = False, wide: bool = False):
    """wide=True 는 롱폼 몰아보기용 가로 1920x1080: 모티프는 왼쪽, 글은 오른쪽."""
    from PIL import ImageDraw
    lines, mot = card["lines"], card.get("motif")
    w, h = (LW, LH) if wide else (W, H)
    im = background(pal["accent_bg"] if final else pal["bg"], w, h); d = ImageDraw.Draw(im)
    top = LBAND if wide else BAND + 40
    tx, maxw = (w * (0.6 if mot else 0.5), int(w * (0.62 if mot else 0.8))) if wide else (w / 2, MAXW)
    if mot:
        if wide:
            motif(d, mot, w * 0.24, top + (h - top) * 0.5, pal)
        else:
            motif(d, mot, W / 2, top + (H - top) * 0.25, pal)
    fonts = [fit(t, STY[s][0], STY[s][1], maxw) for t, s in lines]
    gap = 34; total = sum(sz for _, sz in fonts) + gap * (len(lines) - 1)
    cy = top + (h - top) * (0.5 if wide else 0.55 if mot else 0.45) - total / 2
    n = len(lines) if upto is None else upto
    for i, ((t, s), (f, sz)) in enumerate(zip(lines, fonts)):
        if i < n:
            a = alpha if i == n - 1 else 1.0
            col = tuple(int(c * a + 18 * (1 - a)) for c in pal[STY[s][2]])
            d.text((tx, cy + sz / 2), t, font=f, fill=col, anchor="mm")
        cy += sz + gap
    return im, d


def end_card(se: dict, ep: dict, pal: dict) -> dict:
    nxt = ep.get("next", {})
    if nxt.get("title"):
        return {"lines": [["다음 화", "s"], [f"{nxt['no']}화", "g"], [nxt["title"], "big"], ["내일 밤 9시", "r"], ["구독해야 알림이 와요", "s"]], "motif": None}
    return {"lines": [[f"{se['title']}", "g"], [nxt.get("season_end", "시즌 끝"), "big"], ["구독하면 다음 이야기 알림이 가요", "s"]], "motif": None}


def card_secs(card: dict) -> float:
    return round(1.4 + sum(len(t) for t, _ in card["lines"]) * 0.085, 2)


def render(work: str, ep: dict, out_dir: pathlib.Path = OUT) -> pathlib.Path:
    import numpy as np
    from PIL import Image, ImageDraw
    se = season(work); pal = palette(se)
    cards = ep["cards"] + [end_card(se, ep, pal)]
    durs = [card_secs(c) for c in cards[:-1]] + [3.4]
    starts = np.cumsum([0] + durs[:-1]); total = float(sum(durs))
    last_story = len(cards) - 2
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = out_dir / f"{work}-{ep['no']:02d}"
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19",
                           f"{stem}.v.mp4"], stdin=subprocess.PIPE)
    head = f"{se['title']}"
    cache: dict = {}
    for k in range(int(total * FPS)):
        t = k / FPS; j = int(np.searchsorted(starts, t, side="right") - 1); lt = t - starts[j]
        nl = len(cards[j]["lines"]); per = min(0.55, max(0.2, (durs[j] - 0.8) / nl))
        upto = min(nl, int(lt / per) + 1); a = min(1.0, (lt - (upto - 1) * per) / 0.35)
        ck = (j, upto, round(a, 2))
        if ck not in cache:
            im, d = draw_card(cards[j], pal, upto, a, final=(j == last_story))
            d.rectangle([0, 0, W, BAND], fill=(0, 0, 0))
            d.text((W / 2, 85), f"오리지널 웹소설 {ep['no']}화", font=_font("R", 44), fill=pal["gray"], anchor="mm")
            d.text((W / 2, 165), head, font=fit(head, "B", 70)[0], fill=pal["gold"], anchor="mm")
            if len(cache) > 300:
                cache.clear()
            cache[ck] = im
        im = cache[ck]
        fade = min(1.0, (durs[j] - lt) / 0.25) if j == 0 else min(1.0, lt / 0.25, (durs[j] - lt) / 0.25)
        if j == last_story and lt < 0.12:
            fade = 0.0
        frame = Image.blend(Image.new("RGB", (W, H)), im, max(0.0, fade)) if fade < 1 else im
        ff.stdin.write(frame.tobytes())
    ff.stdin.close(); ff.wait()
    wav = sound(starts, durs, last_story, total, f"{stem}.wav")
    cfg = load(CFG, {})
    bgm = [ROOT / b for b in cfg.get("bgm", []) if (ROOT / b).exists()]
    final = pathlib.Path(f"{stem}.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", f"{stem}.v.mp4", "-i", wav]
    if bgm:
        b = bgm[ep["no"] % len(bgm)]
        cmd += ["-i", str(b), "-filter_complex",
                f"[2:a]volume=0.22,afade=t=out:st={total - 1.5:.2f}:d=1.5[b];[1:a][b]amix=inputs=2:normalize=0[a]",
                "-map", "0:v", "-map", "[a]"]
    else:
        cmd += ["-map", "0:v", "-map", "1:a"]
    cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", f"{total:.2f}", str(final)]
    subprocess.run(cmd, check=True)
    for p in (f"{stem}.v.mp4", wav):
        pathlib.Path(p).unlink(missing_ok=True)
    return final


def sound(starts, durs, last_story, total: float, path: str) -> str:
    """효과음만 합성: 낮은 울림 + 장 넘김 + 끝 두 장 앞 심장 소리 + 반전 직전 정적 + 반전 타격음.
    last_story 는 반전 카드 번호 하나 또는 목록(롱폼은 화마다 하나)."""
    import numpy as np
    sr = 44100; n = int(sr * (total + 0.5)); x = np.arange(n) / sr
    buf = 0.10 * np.sin(2 * np.pi * 55 * x) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.15 * x)) + 0.05 * np.sin(2 * np.pi * 82.4 * x)

    def tone(fr, du, v, dc):
        xx = np.arange(int(sr * du)) / sr
        return v * np.sin(2 * np.pi * fr * xx) * np.exp(-xx * dc)

    def add(at, w):
        i0 = int(at * sr); m = max(0, min(len(w), n - i0)); buf[i0:i0 + m] += w[:m]

    for j in range(1, len(starts)):
        add(starts[j], tone(220, 0.8, 0.08, 4))
    for ls in ([last_story] if isinstance(last_story, int) else last_story):
        beat0 = starts[max(0, ls - 2)]
        for j in range(int((starts[ls] - beat0) / 0.75)):
            add(beat0 + 0.4 + j * 0.75, tone(50, 0.25, 0.5, 18))
        s = int(starts[ls] * sr)
        buf[max(0, s - int(0.35 * sr)):s] *= 0.05
        add(starts[ls], sum(tone(fr, 2.5, 0.25, 1.5) for fr in (110, 116.5, 233, 466)))
    fade = np.ones(n); m = int(sr * 1.5); fade[-m:] = np.linspace(1, 0, m); buf *= fade
    buf = np.clip(buf, -1, 1)
    with wave.open(path, "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(sr)
        wv.writeframes((buf * 32000).astype(np.int16).tobytes())
    return path


# ---------- 롱폼 몰아보기 (BK 2026-11-21: 주 1회, 5화 묶음 + 롱폼에서만 보는 번외 장면) ----------
# 쇼츠를 그냥 이어 붙이면 '재사용 콘텐츠'로 보일 수 있어 번외(data/.../extra/NN.json, after=묶음 마지막 화)가 없으면 만들지 않는다.
def extras(work: str) -> dict[int, dict]:
    out = {}
    for p in sorted((WORKS / work / "extra").glob("*.json")):
        x = load(p, {})
        if x.get("after"):
            out[int(x["after"])] = x
    return out


def long_key(work: str, k: int) -> str:
    return f"{work}/long-{k:02d}"


def long_group(work: str, k: int) -> list[dict]:
    lo, hi = (k - 1) * LONG_EVERY + 1, k * LONG_EVERY
    return [e for e in episodes(work) if lo <= e["no"] <= hi]


def next_long(cfg: dict, log: dict, day: dt.date) -> int | None:
    """쇼츠 5화가 모두 올라갔고(공개일이 오늘 이전) 번외가 있으며 아직 안 만든 가장 이른 묶음 번호."""
    work = cfg.get("work", ""); ex = extras(work)
    for k in range(1, len(episodes(work)) // LONG_EVERY + 1):
        if long_key(work, k) in log:
            continue
        grp = long_group(work, k)
        rows = [log.get(key(work, e["no"])) for e in grp]
        if len(grp) < LONG_EVERY or not all(rows) or k * LONG_EVERY not in ex:
            return None
        if any(r.get("visibility") == "private" for r in rows):
            return None
        if max(r.get("date", "9999") for r in rows) > day.isoformat():
            return None
        return k
    return None


def long_cards(work: str, k: int) -> tuple[list[dict], list[tuple[str, int]]]:
    """[{card, secs, final, label}] 와 챕터 목록 [(이름, 카드 번호)]."""
    se = season(work); grp = long_group(work, k); ex = extras(work)[k * LONG_EVERY]
    a, b = grp[0]["no"], grp[-1]["no"]
    seq: list[dict] = []; chap: list[tuple[str, int]] = [("시작", 0)]

    def put(card, secs, final=False, label=""):
        seq.append({"card": card, "secs": secs, "final": final, "label": label})

    put({"lines": [["오리지널 웹소설", "s"], [se["title"], "g"], [f"{a}화 ~ {b}화 몰아보기", "big"],
                   [f"+ 번외 「{ex['title']}」 (몰아보기에서만)", "s"]], "motif": None}, 4.0, label="몰아보기")
    for e in grp:
        chap.append((f"{e['no']}화 {e['title']}", len(seq)))
        put({"lines": [[f"{e['no']}화", "g"], [e["title"], "big"]], "motif": None}, 2.4, label=f"{e['no']}화")
        for i, c in enumerate(e["cards"]):
            put(c, card_secs(c), final=(i == len(e["cards"]) - 1), label=f"{e['no']}화")
    chap.append((f"번외 {ex['title']}", len(seq)))
    put({"lines": [["번외", "bigr"], [ex["title"], "big"], ["쇼츠에는 없는 이야기", "s"]], "motif": None}, 3.0, label="번외")
    for i, c in enumerate(ex["cards"]):
        put(c, card_secs(c), final=(i == len(ex["cards"]) - 1), label="번외")
    if len(episodes(work)) > b:
        end = {"lines": [["다음 몰아보기", "s"], [f"{b + 1}화 ~ {b + LONG_EVERY}화", "g"],
                         ["쇼츠로는 매일 밤 한 화씩", "n"], ["구독하면 다음 화 알림이 가요", "s"]], "motif": None}
    else:
        end = {"lines": [[se["title"], "g"], ["시즌 1 끝", "big"], ["구독하면 다음 이야기 알림이 가요", "s"]], "motif": None}
    put(end, 5.0, label="")
    return seq, chap


def stamp(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 60}:{sec % 60:02d}"


def render_long(work: str, k: int, out_dir: pathlib.Path = OUT) -> tuple[pathlib.Path, list[str]]:
    import numpy as np
    from PIL import Image
    se = season(work); pal = palette(se)
    seq, chap = long_cards(work, k)
    durs = [x["secs"] for x in seq]
    starts = np.cumsum([0] + durs[:-1]); total = float(sum(durs))
    finals = [i for i, x in enumerate(seq) if x["final"]]
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = out_dir / f"{work}-long-{k:02d}"
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{LW}x{LH}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
                           f"{stem}.v.mp4"], stdin=subprocess.PIPE)
    head = se["title"]; cache: dict = {}
    for f in range(int(total * FPS)):
        t = f / FPS; j = int(np.searchsorted(starts, t, side="right") - 1); lt = t - starts[j]
        card = seq[j]["card"]; nl = len(card["lines"]); per = min(0.55, max(0.2, (durs[j] - 0.8) / nl))
        upto = min(nl, int(lt / per) + 1); a = min(1.0, (lt - (upto - 1) * per) / 0.35)
        ck = (j, upto, round(a, 2))
        if ck not in cache:
            im, d = draw_card(card, pal, upto, a, final=seq[j]["final"], wide=True)
            d.rectangle([0, 0, LW, LBAND], fill=(0, 0, 0))
            d.text((60, LBAND / 2), head, font=fit(head, "B", 48)[0], fill=pal["gold"], anchor="lm")
            if seq[j]["label"]:
                d.text((LW - 60, LBAND / 2), seq[j]["label"], font=_font("R", 40), fill=pal["gray"], anchor="rm")
            if len(cache) > 200:
                cache.clear()
            cache[ck] = im
        im = cache[ck]
        fade = min(1.0, lt / 0.25, (durs[j] - lt) / 0.25) if j else min(1.0, (durs[j] - lt) / 0.25)
        if seq[j]["final"] and lt < 0.12:
            fade = 0.0
        ff.stdin.write((Image.blend(Image.new("RGB", (LW, LH)), im, max(0.0, fade)) if fade < 1 else im).tobytes())
    ff.stdin.close(); ff.wait()
    wav = sound(starts, durs, finals, total, f"{stem}.wav")
    final = pathlib.Path(f"{stem}.mp4")
    bgm = [ROOT / b for b in load(CFG, {}).get("bgm", []) if (ROOT / b).exists()]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", f"{stem}.v.mp4", "-i", wav]
    if bgm:
        cmd += ["-stream_loop", "-1", "-i", str(bgm[k % len(bgm)]), "-filter_complex",
                f"[2:a]volume=0.18,afade=t=out:st={total - 2:.2f}:d=2[b];[1:a][b]amix=inputs=2:normalize=0[a]",
                "-map", "0:v", "-map", "[a]"]
    else:
        cmd += ["-map", "0:v", "-map", "1:a"]
    cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", f"{total:.2f}", str(final)]
    subprocess.run(cmd, check=True)
    for q in (f"{stem}.v.mp4", wav):
        pathlib.Path(q).unlink(missing_ok=True)
    return final, [f"{stamp(starts[i])} {name}" for name, i in chap]


def long_title(se: dict, work: str, k: int) -> str:
    grp = long_group(work, k); ex = extras(work)[k * LONG_EVERY]
    return f"{se['title']} {grp[0]['no']}~{grp[-1]['no']}화 몰아보기 + 번외 「{ex['title']}」 | 웹소설"[:100]


def long_body(se: dict, work: str, k: int, chapters: list[str], visibility: str, at: dt.datetime | None) -> dict:
    status = ({"privacyStatus": "private", "publishAt": at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
              if visibility == "schedule" and at else {"privacyStatus": "public" if visibility == "schedule" else "private"})
    desc = (f"{se['title']} 쇼츠 {LONG_EVERY}화를 한 번에, 그리고 몰아보기에서만 보는 번외 장면까지.\n\n"
            + "\n".join(chapters)
            + "\n\n쇼츠로는 매일 밤 한 화씩 올라갑니다.\n"
            "이 채널이 직접 쓴 오리지널 창작 웹소설입니다. 등장인물·단체는 실제와 관계없습니다.\n"
            f"#웹소설 #몰아보기 #{se.get('genre', '').split(' ')[0]} #한화만더")
    return {"snippet": {"title": long_title(se, work, k), "description": desc,
                        "tags": ["웹소설", "몰아보기", "회귀", "복수극", se["title"], "한화만더"],
                        "categoryId": "24", "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
            "status": {**status, "selfDeclaredMadeForKids": False, "containsSyntheticMedia": False, "embeddable": True}}


# ---------- 업로드 ----------
def publish_at(day: dt.date, hour: int) -> dt.datetime:
    return dt.datetime.combine(day, dt.time(hour), KST)


def video_body(se: dict, ep: dict, visibility: str, at: dt.datetime | None, links: dict | None = None) -> dict:
    if visibility == "schedule" and at:
        status = {"privacyStatus": "private", "publishAt": at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    elif visibility == "schedule":
        status = {"privacyStatus": "public"}
    else:
        status = {"privacyStatus": "private"}
    pl = load(CFG, {}).get("playlist_id")
    return {"snippet": {"title": title_of(se, ep), "description": description_of(se, ep, links, pl),
                        "tags": ["웹소설", "회귀", "복수극", "로맨스판타지", se["title"], "한화만더"],
                        "categoryId": "24", "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
            "status": {**status, "selfDeclaredMadeForKids": False,
                       "containsSyntheticMedia": bool(ep.get("ai_realistic")), "embeddable": True}}


def link_prev(tok: str, se: dict, work: str, ep: dict, new_id: str, log: dict) -> bool | None:
    """새 화를 올린 뒤, 다음 화 링크가 아직 없는 이전 화들 설명란을 고친다(videos.update, youtube 권한).
    성공한 화는 기록에 linked=True. 고칠 화가 없으면 None, 하나라도 실패하면 False."""
    import urllib.request
    full = {**log, key(work, ep["no"]): {"id": new_id}}
    todo = [e for e in episodes(work) if e["no"] < ep["no"] and (log.get(key(work, e["no"])) or {}).get("id")
            and not log[key(work, e["no"])].get("linked")]
    if not todo:
        return None
    ok = True
    for prev in todo:
        row = log[key(work, prev["no"])]
        snip = video_body(se, prev, "private", None, links_of(work, prev["no"], full))["snippet"]
        req = urllib.request.Request("https://www.googleapis.com/youtube/v3/videos?part=snippet",
                                     data=json.dumps({"id": row["id"], "snippet": snip}).encode(), method="PUT",
                                     headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        try:
            urllib.request.urlopen(req, timeout=30).read()
            row["linked"] = True
        except Exception as e:  # noqa: BLE001
            print(f"{prev['no']}화 링크 실패: {e}", file=sys.stderr)
            ok = False
    return ok


def comment_text(ep: dict, links: dict | None = None) -> str:
    """고정용 댓글: 다음 화 예고 한 줄 + 연재 시간. (고정은 API가 없어 BK가 손으로)"""
    nxt = ep.get("next", {}); lk = links or {}
    if not nxt.get("title"):
        return f"시즌 1 끝까지 봐 주셔서 고마워요. {nxt.get('season_end', '시즌 2 준비 중')} · 구독하면 새 시즌 알림이 가요."
    line = f"▶ 다음 화 {nxt['no']}화 「{nxt['title']}」"
    line += f": https://youtu.be/{lk['next']}" if lk.get("next") else " · 내일 밤 9시"
    return line + "\n매일 밤 9시 연재 · 구독해야 알림이 와요"


def post_comments(tok: str, work: str, day: dt.date, log: dict) -> tuple[list[int], str | None]:
    """공개된 지난 화(어제까지) 중 댓글이 없는 화에 예고 댓글을 단다(commentThreads.insert,
    youtube.force-ssl 권한 필요). 성공한 화는 기록에 commented=True. (단 화 번호들, 마지막 오류)"""
    import urllib.request
    done, err = [], None
    for e in episodes(work):
        row = log.get(key(work, e["no"])) or {}
        if not row.get("id") or row.get("commented") or row.get("visibility") == "private" or row.get("date", "9") >= day.isoformat():
            continue
        body = {"snippet": {"videoId": row["id"], "topLevelComment": {"snippet": {"textOriginal": comment_text(e, links_of(work, e["no"], log))}}}}
        req = urllib.request.Request("https://www.googleapis.com/youtube/v3/commentThreads?part=snippet",
                                     data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        try:
            urllib.request.urlopen(req, timeout=30).read()
            row["commented"] = True; done.append(e["no"])
        except Exception as x:  # noqa: BLE001
            err = str(x); print(f"{e['no']}화 댓글 실패: {x}", file=sys.stderr)
            break
    return done, err


def add_to_playlist(tok: str, playlist: str, vid: str) -> bool:
    import urllib.request
    body = {"snippet": {"playlistId": playlist, "resourceId": {"kind": "youtube#video", "videoId": vid}}}
    req = urllib.request.Request("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=30).read()
        return True
    except Exception as e:  # noqa: BLE001  권한(youtube.upload 만)이면 403 → BK 가 손으로
        print(f"재생목록 추가 실패: {e}", file=sys.stderr)
        return False


def run(day: dt.date, long: bool | None = None) -> int:
    """매일 쇼츠 한 화. 일요일(또는 long=True)엔 몰아보기도."""
    rc = run_short(day)
    if long or (long is None and day.weekday() == 6):
        rc = max(rc, run_long(day))
    return rc


def _notify(msg: str) -> None:
    try:
        from .claude_jobs import notify
        notify(msg)
    except Exception as e:  # noqa: BLE001
        print(f"텔레그램 알림 실패: {e}", file=sys.stderr)


def run_long(day: dt.date) -> int:
    from .youtube import access_token, summary, upload
    cfg = load(CFG, {}); log = load(LOG, {}); work = cfg.get("work", "")
    k = next_long(cfg, log, day)
    if not k:
        summary("웹소설 몰아보기: 만들 묶음 없음 (쇼츠 5화가 아직 덜 올라갔거나 번외 없음)")
        return 0
    ex = extras(work)[k * LONG_EVERY]
    bad = policy_problems(ex)
    if bad:
        summary(f"웹소설 몰아보기 {k} 번외 정책 검사 탈락 → 안 올림: {bad}")
        return 1
    se = season(work)
    video, chapters = render_long(work, k)
    summary(f"웹소설 몰아보기 만듦: {video.name}\n" + "\n".join(chapters))
    if os.environ.get("WEBNOVEL_YT_ENABLED", "").lower() != "true" or not cfg.get("on") or not cfg.get("long", True):
        summary(f"웹소설 몰아보기 dry-run: {long_title(se, work, k)}")
        return 0
    need = ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "WEBNOVEL_YT_REFRESH_TOKEN")
    if not all(os.environ.get(x) for x in need):
        summary("웹소설 채널 비밀값 없음 → 몰아보기 업로드 안 함")
        return 1
    tok = access_token(*(os.environ[x] for x in need))
    vis = cfg.get("visibility", "private")
    at = publish_at(day, int(cfg.get("long_hour", 22)))
    if at <= dt.datetime.now(KST) + dt.timedelta(minutes=10):
        at = None
    r = upload(tok, long_body(se, work, k, chapters, vis, at), video)
    pl = cfg.get("playlist_id") and add_to_playlist(tok, cfg["playlist_id"], r["id"])
    log = load(LOG, {})
    log[long_key(work, k)] = {"id": r["id"], "date": day.isoformat(), "title": long_title(se, work, k), "visibility": vis}
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    when = f"{at:%m/%d %H:%M} 공개 예약" if at else ("바로 공개" if vis == "schedule" else "비공개")
    msg = f"📚 웹소설 몰아보기 {k} 업로드 ({when}): https://youtu.be/{r['id']}" + ("" if pl or not cfg.get("playlist_id") else "\n(재생목록 추가 실패: 손으로 추가)")
    summary(msg); _notify(msg)
    return 0


def promote_private(cfg: dict, log: dict, day: dt.date) -> list[str]:
    """schedule 로 바뀐 뒤, BK 확인용 비공개로 올렸던 화를 그날 promote_hour(20시) 공개 예약으로 바꾼다.
    (다음 화 21시보다 먼저). 토큰에 youtube 권한이 없으면 실패를 알리고 BK 가 스튜디오에서 공개."""
    work = cfg.get("work", "")
    todo = [k for k, v in log.items() if k.startswith(work + "/") and v.get("visibility") == "private" and v.get("id")]
    if cfg.get("visibility") != "schedule" or not todo:
        return []
    if os.environ.get("WEBNOVEL_YT_ENABLED", "").lower() != "true" or not cfg.get("on"):
        return []
    import urllib.request
    from .youtube import access_token
    need = ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "WEBNOVEL_YT_REFRESH_TOKEN")
    if not all(os.environ.get(x) for x in need):
        return []
    tok = access_token(*(os.environ[x] for x in need))
    at = publish_at(day, int(cfg.get("promote_hour", 20)))
    late = at <= dt.datetime.now(KST) + dt.timedelta(minutes=10)
    out = []
    for k in sorted(todo):
        st = {"privacyStatus": "public"} if late else {
            "privacyStatus": "private", "publishAt": at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
        body = {"id": log[k]["id"], "status": {**st, "selfDeclaredMadeForKids": False, "embeddable": True}}
        req = urllib.request.Request("https://www.googleapis.com/youtube/v3/videos?part=status", data=json.dumps(body).encode(),
                                     method="PUT", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        try:
            urllib.request.urlopen(req, timeout=30).read()
            log[k]["visibility"] = "schedule"
            out.append(f"{k} → {'바로 공개' if late else f'{at:%m/%d %H:%M} 공개 예약'}")
        except Exception as e:  # noqa: BLE001
            out.append(f"{k} 공개 전환 실패({e}) → 스튜디오에서 공개로 바꿔 주세요: https://youtu.be/{log[k]['id']}")
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def run_short(day: dt.date) -> int:
    from .youtube import access_token, summary, upload
    cfg = load(CFG, {}); log = load(LOG, {})
    work = cfg.get("work", "")
    done = promote_private(cfg, log, day)
    if done:
        msg = "📖 웹소설 비공개 화 공개 전환: " + " / ".join(done)
        summary(msg); _notify(msg)
    ep = next_episode(cfg, log)
    if not ep:
        summary("웹소설: 올릴 화 없음 (비공개 첫 화 BK 확인 대기이거나 시즌 끝)")
        return 0
    bad = policy_problems(ep)
    if bad:
        summary(f"웹소설 {ep['no']}화 정책 검사 탈락 → 안 올림: {bad}")
        return 1
    se = season(work)
    video = render(work, ep)
    summary(f"웹소설 만듦: {video.name}")
    if os.environ.get("WEBNOVEL_YT_ENABLED", "").lower() != "true" or not cfg.get("on"):
        summary(f"웹소설 dry-run (WEBNOVEL_YT_ENABLED 또는 config on 꺼짐): {title_of(se, ep)}")
        return 0
    need = ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "WEBNOVEL_YT_REFRESH_TOKEN")
    if not all(os.environ.get(k) for k in need):
        summary("웹소설 채널 비밀값 없음 → 업로드 안 함")
        return 1
    tok = access_token(*(os.environ[k] for k in need))
    vis = cfg.get("visibility", "private")
    at = publish_at(day, int(cfg.get("hour", 21)))
    if at <= dt.datetime.now(KST) + dt.timedelta(minutes=10):
        at = None
    r = upload(tok, video_body(se, ep, vis, at, links_of(work, ep["no"], log)), video)
    pl = cfg.get("playlist_id") and add_to_playlist(tok, cfg["playlist_id"], r["id"])
    linked = link_prev(tok, se, work, ep, r["id"], log)
    log[key(work, ep["no"])] = {"id": r["id"], "date": day.isoformat(), "title": title_of(se, ep), "visibility": vis}
    cm, cerr = post_comments(tok, work, day, log) if cfg.get("comments", True) else ([], None)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    when = (f"{at:%m/%d %H:%M} 공개 예약" if at else "바로 공개") if vis == "schedule" else "비공개(BK 확인용)"
    msg = (f"📖 웹소설 {se['title']} {ep['no']}화 업로드 ({when}): https://youtu.be/{r['id']}"
           + ("" if pl or not cfg.get("playlist_id") else "\n(재생목록 추가 실패: 손으로 추가)")
           + ("" if linked is not False else "\n(이전 화 설명란 '다음 화' 링크 추가 실패)")
           + (f"\n💬 예고 댓글: {', '.join(map(str, cm))}화 (스튜디오에서 '고정'만 눌러 주세요)" if cm else "")
           + (f"\n(예고 댓글 실패: 토큰에 youtube.force-ssl 권한이 필요할 수 있음, docs/WEBNOVEL.md 4장)" if cerr else ""))
    summary(msg); _notify(msg)
    return 0


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "next"
    cfg = load(CFG, {})
    if cmd == "next":
        ep = next_episode(cfg, load(LOG, {}))
        print(f"{cfg.get('work')} {ep['no']}화 {ep['title']}" if ep else "없음")
        return 0
    if cmd == "render":
        work = cfg["work"]; no = int(argv[1]) if len(argv) > 1 else 1
        ep = next(e for e in episodes(work) if e["no"] == no)
        print(render(work, ep))
        return 0
    if cmd == "long":
        work = cfg["work"]; k = int(argv[1]) if len(argv) > 1 else 1
        v, ch = render_long(work, k)
        print(v); print("\n".join(ch))
        return 0
    if cmd == "run":
        day = dt.date.fromisoformat(argv[1]) if len(argv) > 1 and argv[1] else dt.datetime.now(KST).date()
        return run(day, True if "--long" in argv else None)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
