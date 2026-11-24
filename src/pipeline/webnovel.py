"""웹소설 쇼츠 '한 화만 더' (BK 2026-11-21): 오리지널 웹소설을 하루 한 화, 글 카드 세로 쇼츠로 자동 제작·업로드.

- 대본: data/webnovel/works/<작품>/season.json + ep/NN.json (카드 = 줄 목록 + 모티프). 오리지널만, 기존 작품 베끼기 금지.
- 품질: 40점 점수표(docs/WEBNOVEL.md) 32점 이상 + 2점 이하 항목 없음인 화만 data 에 들어온다. 여기선 정책 검사만 다시 한다.
- 화면: 코드로 그림(그림 AI 안 씀). 작품마다 season.json style 로 색을 바꿔 반복 콘텐츠로 보이지 않게.
- 소리: 효과음 합성 + (있으면) BK Suno 곡(config bgm). AGENTS 0-13.
- 업로드: 웹소설 채널 전용 토큰 WEBNOVEL_YT_REFRESH_TOKEN, 아동용 아님(selfDeclaredMadeForKids=False) 자동,
  AI 그림을 쓴 화(ep "ai": true)는 설명란 표기 + containsSyntheticMedia.
  config visibility=private 이면 첫 화만 비공개로 올리고 멈춤(BK 확인), schedule 이면 매일 hour 시 공개 예약.
- 롱폼 몰아보기(BK 2026-11-21): 일요일마다 쇼츠 5화 묶음 + 롱폼 전용 번외(extra/NN.json)를 가로 영상으로, long_hour 시 공개 예약.
- 먼저 보기(BK 2026-11-23): 공개 예약한 화의 앞 카드 2장 글 + 정사각 그림을 텔레그램으로 → BK가 커뮤니티 게시물에 붙여넣기(게시물 API 없음).
사용: python -m pipeline.webnovel next | render [화] | preview [화] | long [묶음] | run [YYYY-MM-DD]
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


def hook_of(ep: dict) -> str:
    """제목 앞에 둘 훅: ep['hook'] 이 있으면 그것, 없으면 첫 카드 글(길면 첫 줄). 끝 마침표는 뗀다."""
    if ep.get("hook"):
        return ep["hook"]
    lines = [l[0] for l in (ep.get("cards") or [{"lines": []}])[0]["lines"]]
    h = " ".join(lines).strip()
    if len(h) > 40 and lines:
        h = lines[0].strip()
    return h.rstrip(".")


def title_of(se: dict, ep: dict) -> str:
    """BK 11/24 (3화 조회수 하락): 피드에서 눌리도록 훅을 먼저, 작품명·화수는 뒤로."""
    tail = f" | {se['title']} {ep['no']}화 #웹소설 #shorts"
    h = hook_of(ep) or ep["title"]
    return (h[:100 - len(tail)] + tail)[:100]


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
    # 2026-11-23 BK '채널 모두 구독 좋아요 등 유도합시다': 설명란에도 연재 시각 + 구독·좋아요 한 줄 (보상 약속 없음)
    sub = ("🔔 매일 밤 9시 연재 · 구독해 두면 다음 화 알림이 가요 · 재밌었다면 좋아요"
           if nxt.get("title") else "🔔 구독해 두면 새 시즌 알림이 가요 · 재밌었다면 좋아요")
    return (f"{top}{se['title']} {ep['no']}화 — {ep['title']}\n\n{body}\n\n{tail}\n{sub}\n\n"
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


ART_BAND = (290, 590)   # 그림 모드 제목 띠: 홈 피드 미리보기에서도 안 잘리는 자리
ART_TEXT_Y = 1430       # 그림 모드 자막 중심
RECAP_SECS = 3.0        # 2화부터 제목 띠 아래 한 줄 줄거리를 보여 주는 시간


def art_path(work: str, no: int) -> pathlib.Path | None:
    """화별 그림 data/webnovel/works/<작품>/art/NN.jpg|png (있으면 그림 모드)."""
    for ext in ("jpg", "png", "webp"):
        p = WORKS / work / "art" / f"{no:02d}.{ext}"
        if p.exists():
            return p
    return None


def art_base(path: pathlib.Path, zoom: float = 1.12):
    """그림을 세로 화면보다 zoom 배 크게 채우고 어둡게 + 아래쪽 그라데이션."""
    import numpy as np
    from PIL import Image
    im = Image.open(path).convert("RGB")
    bw, bh = int(W * zoom), int(H * zoom)
    sc = max(bw / im.width, bh / im.height)
    im = im.resize((int(im.width * sc) + 1, int(im.height * sc) + 1), Image.LANCZOS)
    l, t = (im.width - bw) // 2, (im.height - bh) // 2
    a = np.asarray(im.crop((l, t, l + bw, t + bh)), float)
    y = np.linspace(0, 1, bh)[:, None, None]
    dark = 0.78 - 0.5 * np.clip((y - 0.55) / 0.35, 0, 1)   # 아래 자막 자리는 더 어둡게
    return Image.fromarray(np.clip(a * dark, 0, 255).astype(np.uint8))


def art_frame(base, p: float):
    """p 0→1 동안 천천히 확대(켄 번스)."""
    from PIL import Image
    z = 1.0 + 0.1 * p
    cw, ch = base.width / z, base.height / z
    l, t = (base.width - cw) / 2, (base.height - ch) * 0.45
    return base.resize((W, H), Image.BILINEAR, box=(l, t, l + cw, t + ch))


def art_text(card: dict, pal: dict, upto: int, alpha: float):
    """그림 위 자막 층(투명 RGBA): 아래쪽 반투명 판 + 글."""
    from PIL import Image, ImageDraw
    lines = card["lines"]
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fonts = [fit(t, STY[st][0], int(STY[st][1] * 0.92)) for t, st in lines]
    gap = 26; total = sum(sz for _, sz in fonts) + gap * (len(lines) - 1)
    top = ART_TEXT_Y - total / 2
    d.rounded_rectangle([40, top - 50, W - 40, top + total + 50], 28, fill=(0, 0, 0, 150))
    cy = top
    for i, ((t, st), (f, sz)) in enumerate(zip(lines, fonts)):
        if i < upto:
            a = alpha if i == upto - 1 else 1.0
            col = pal[STY[st][2]]
            d.text((W / 2, cy + sz / 2), t, font=f, fill=(*col, int(255 * a)), anchor="mm",
                   stroke_width=3, stroke_fill=(0, 0, 0, int(255 * a)))
        cy += sz + gap
    return im


def art_band(d, se: dict, ep: dict, pal: dict) -> None:
    """트렌드식 제목 띠(검정 + 흰·노랑 큰 글씨). 홈 피드 안전 영역 y 290~590."""
    y0, y1 = ART_BAND
    d.rectangle([0, y0, W, y1], fill=(0, 0, 0))
    hf = fit(f"{se['title']} {ep['no']}화", "B", 54)[0]
    d.text((W / 2, y0 + 70), f"{se['title']} {ep['no']}화", font=hf, fill=(245, 245, 245), anchor="mm")
    try:
        from PIL import ImageFont
        tf = ImageFont.truetype(str(ROOT / "config" / "fonts" / "BlackHanSans-Regular.ttf"), 112)
        while tf.getlength(ep["title"]) > W - 80 and tf.size > 60:
            tf = ImageFont.truetype(str(ROOT / "config" / "fonts" / "BlackHanSans-Regular.ttf"), tf.size - 6)
    except OSError:
        tf = fit(ep["title"], "B", 104)[0]
    d.text((W / 2, y0 + 195), ep["title"], font=tf, fill=(255, 214, 0), anchor="mm")


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
    ap = art_path(work, ep["no"])
    base = art_base(ap) if ap else None
    recap = f"지난 이야기: {se['logline']}" if se.get("logline") and ep["no"] > 1 else ""
    for k in range(int(total * FPS)) if base is not None else ():
        from PIL import ImageDraw
        t = k / FPS; j = int(np.searchsorted(starts, t, side="right") - 1); lt = t - starts[j]
        nl = len(cards[j]["lines"]); per = min(0.55, max(0.2, (durs[j] - 0.8) / nl))
        upto = min(nl, int(lt / per) + 1); a = min(1.0, (lt - (upto - 1) * per) / 0.35)
        ck = (j, upto, round(a, 2))
        if ck not in cache:
            if len(cache) > 300:
                cache.clear()
            cache[ck] = art_text(cards[j], pal, upto, a)
        tl = cache[ck]
        fade = min(1.0, lt / 0.2, (durs[j] - lt) / 0.2)
        if fade < 1:
            tl = tl.copy(); tl.putalpha(tl.getchannel("A").point(lambda v, f=max(0.0, fade): int(v * f)))
        frame = art_frame(base, t / total).convert("RGBA")
        frame.alpha_composite(tl)
        frame = frame.convert("RGB"); d = ImageDraw.Draw(frame); art_band(d, se, ep, pal)
        if recap and t < RECAP_SECS:  # 중간에 들어온 시청자용 한 줄 줄거리 (첫 3초)
            v = min(1.0, (RECAP_SECS - t) / 0.4)
            d.rectangle([0, ART_BAND[1], W, ART_BAND[1] + 74], fill=(0, 0, 0))
            d.text((W / 2, ART_BAND[1] + 37), recap, font=fit(recap, "R", 40)[0],
                   fill=tuple(int(c * v) for c in (210, 210, 210)), anchor="mm")
        ff.stdin.write(frame.tobytes())
    for k in range(int(total * FPS)) if base is None else ():
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
    wav = sound(starts, durs, last_story, total, f"{stem}.wav", cues=[card_cue(c) for c in cards[:-1]] + [None], seed=ep["no"])
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


# 장면 효과음 (BK 11/24 "중간 중간 효과음을 바꿔야"): 카드 글에 맞는 소리를 고르고, 없으면 넘김 소리를 돌려 쓴다.
CUES = [  # (이름, 글에 들어 있으면 그 소리)
    ("clock", ("11시 17분", "시각", "밤 11시", "아침 9시", "30분 전")),
    ("glass", ("와인", "주스", "잔", "따랐다")),
    ("phone", ("휴대폰", "문자", "전화", "스피커", "통화", "호출", "녹음")),
    ("ding", ("엘리베이터",)),
    ("crash", ("가드레일", "들이받")),
    ("click", ("로그인", "OTP", "전송", "눌렀다", "창을 열", "검색", "조회", "로그")),
    ("paper", ("서류", "서명", "사인", "결재", "증권", "파일", "열일곱 장", "이혼")),
    ("heart", ("숨이", "멎", "죽었", "심장")),
]


def card_cue(card: dict) -> str | None:
    text = " ".join(l[0] for l in card.get("lines", []))
    if card.get("motif") == "paper":
        return "paper"
    for name, keys in CUES:
        if any(k in text for k in keys):
            return name
    return None


def sound(starts, durs, last_story, total: float, path: str, cues=None, seed: int = 0) -> str:
    """효과음만 합성: 낮은 울림 + 카드마다 장면 소리(시계·잔·휴대폰·종이 등, 없으면 넘김 소리 3종 돌려 쓰기)
    + 끝 두 장 앞 심장 소리 + 반전 직전 정적 + 반전 타격음(화마다 음 높이 다름).
    last_story 는 반전 카드 번호 하나 또는 목록(롱폼은 화마다 하나). cues 는 카드별 card_cue 결과."""
    import numpy as np
    rng = np.random.default_rng(seed)
    sr = 44100; n = int(sr * (total + 0.5)); x = np.arange(n) / sr
    buf = 0.10 * np.sin(2 * np.pi * 55 * x) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.15 * x)) + 0.05 * np.sin(2 * np.pi * 82.4 * x)

    def tone(fr, du, v, dc):
        xx = np.arange(int(sr * du)) / sr
        return v * np.sin(2 * np.pi * fr * xx) * np.exp(-xx * dc)

    def noise(du, v, lo, hi, att=0.01, dc=8.0):
        k = int(sr * du); f = np.fft.rfft(rng.standard_normal(k)); fq = np.fft.rfftfreq(k, 1 / sr)
        f[(fq < lo) | (fq > hi)] = 0; w = np.fft.irfft(f, k); w /= (np.abs(w).max() or 1)
        xx = np.arange(k) / sr
        return v * w * np.minimum(1, xx / att) * np.exp(-xx * dc)

    def add(at, w):
        i0 = int(at * sr); m = max(0, min(len(w), n - i0)); buf[i0:i0 + m] += w[:m]

    def fx(name, at):
        if name == "clock":
            for i in range(3):
                add(at + i * 0.5, noise(0.05, 0.22, 2500, 6000, 0.001, 60) + tone(1800, 0.05, 0.05, 80))
            add(at + 1.5, sum(tone(fr, 2.0, 0.07, 1.8) for fr in (392, 784.5)))
        elif name == "glass":
            add(at + 0.1, sum(tone(fr, 1.2, 0.10, 4) for fr in (2093, 2637, 3322)))
        elif name == "phone":
            for i in range(2):
                xx = np.arange(int(sr * 0.35)) / sr
                add(at + 0.1 + i * 0.5, 0.05 * np.tanh(3 * np.sin(2 * np.pi * 150 * xx)) * np.sin(np.pi * xx / 0.35) ** 2)  # BK 11/24: 진동이 너무 커서 낮춤
        elif name == "ding":
            add(at, tone(1318.5, 1.5, 0.12, 2.5)); add(at + 0.35, tone(1046.5, 1.8, 0.12, 2.2))
        elif name == "crash":
            add(at, noise(0.9, 0.45, 40, 3000, 0.002, 4) + tone(45, 0.6, 0.5, 6))
        elif name == "click":
            for i in range(4):
                add(at + 0.08 + i * 0.13 + rng.uniform(0, 0.04), noise(0.03, 0.18, 1500, 7000, 0.001, 120))
        elif name == "paper":
            add(at, noise(0.45, 0.16, 1200, 8000, 0.08, 6))
        elif name == "heart":
            for i in range(2):
                add(at + 0.2 + i * 0.75, tone(50, 0.25, 0.5, 18)); add(at + 0.42 + i * 0.75, tone(45, 0.2, 0.35, 20))
        else:  # 넘김 소리 3종: 낮은 현, 바람, 맑은 종
            v = int(name)
            if v == 0:
                add(at, tone(220, 0.8, 0.08, 4))
            elif v == 1:
                add(at, noise(0.6, 0.10, 300, 2500, 0.25, 5))
            else:
                add(at, tone(659.3, 1.0, 0.05, 3) + tone(987.8, 1.0, 0.03, 3))

    finals = [last_story] if isinstance(last_story, int) else list(last_story)
    prev = None
    for j in range(1, len(starts)):
        c = cues[j] if cues and j < len(cues) else None
        if c == prev:  # 같은 소리가 연달아 나오면 넘김 소리로 바꿔 반복감을 줄인다
            c = None
        prev = c
        if j in finals:
            continue
        fx(c if c else str(j % 3), starts[j])
    for ls in ([last_story] if isinstance(last_story, int) else last_story):
        beat0 = starts[max(0, ls - 2)]
        for j in range(int((starts[ls] - beat0) / 0.75)):
            add(beat0 + 0.4 + j * 0.75, tone(50, 0.25, 0.5, 18))
        s = int(starts[ls] * sr)
        buf[max(0, s - int(0.35 * sr)):s] *= 0.05
        r = 1.0 + 0.06 * (seed % 5 - 2)
        add(starts[ls], sum(tone(fr * r, 2.5, 0.25, 1.5) for fr in (110, 116.5, 233, 466)))
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
    wav = sound(starts, durs, finals, total, f"{stem}.wav", cues=[card_cue(x["card"]) for x in seq], seed=k)
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
# ---------- 주 1회 예고편 쇼츠 (BK 11/24: 연재 중간 화는 새 유입이 줄어 → 작품 전체 훅으로 1화에 보내는 입구) ----------
# data/.../trailers.json 의 k번째를 trailer_weekday(기본 수=2)에 trailer_hour(기본 18시) 공개. 그림은 이미 만든 art/NN 재사용(크레딧 0).
def trailers(work: str) -> list[dict]:
    return load(WORKS / work / "trailers.json", [])


def trailer_key(work: str, k: int) -> str:
    return f"{work}/trailer-{k:02d}"


def next_trailer(cfg: dict, log: dict, day: dt.date) -> int | None:
    work = cfg.get("work", "")
    if not cfg.get("trailer", True) or day.weekday() != int(cfg.get("trailer_weekday", 2)):
        return None
    if not (log.get(key(work, 1)) or {}).get("id"):
        return None  # 1화가 있어야 보낼 곳이 있다
    if any(v.get("date") == day.isoformat() for k, v in log.items() if k.startswith(f"{work}/trailer-")):
        return None
    k = sum(1 for x in log if x.startswith(f"{work}/trailer-")) + 1
    tr = trailers(work)
    if k > len(tr) or not all(art_path(work, sc["art"]) for sc in tr[k - 1]["scenes"]):
        return None
    return k


def trailer_title(se: dict, tr: dict) -> str:
    tail = f" | {se['title']} 예고편 #웹소설 #shorts"
    return (tr["hook"][:100 - len(tail)] + tail)[:100]


def trailer_desc(se: dict, work: str, log: dict, playlist: str | None) -> str:
    first = (log.get(key(work, 1)) or {}).get("id")
    out = []
    if first:
        out.append(f"▶ 1화부터 보기: https://youtu.be/{first}")
    if playlist:
        out.append(f"⏮ 전체 정주행: https://www.youtube.com/playlist?list={playlist}")
    out += ["", f"{se['title']}: 매일 밤 9시 한 화씩 올라오는 오리지널 웹소설 쇼츠예요.", "구독하면 새 화 알림이 가요.", "",
            f"#웹소설 #{se.get('genre', '').split(' ')[0]} #복수극 #한화만더"]
    return "\n".join(out)


def render_trailer(work: str, k: int, out_dir: pathlib.Path = OUT) -> pathlib.Path:
    """장면 3개(그림 + 자막, 장마다 3.6초) + 끝 카드(작품명·1화부터·매일 밤 9시). 소리는 sound() 재사용."""
    import numpy as np
    from PIL import Image, ImageDraw
    se = season(work); pal = palette(se); tr = trailers(work)[k - 1]
    scenes = tr["scenes"]
    endc = {"lines": [["1화부터", "big"], ["정주행", "bigr"], [se["title"], "g"], ["매일 밤 9시 연재", "s"]], "motif": None}
    durs = [3.6] * len(scenes) + [4.0]
    starts = np.cumsum([0] + durs[:-1]); total = float(sum(durs))
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = out_dir / f"{work}-trailer-{k:02d}"
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19",
                           f"{stem}.v.mp4"], stdin=subprocess.PIPE)
    bases = [art_base(art_path(work, sc["art"])) for sc in scenes]
    end_im = draw_card(endc, pal)[0]
    band = {"no": 0, "title": "예고편"}
    cache: dict = {}
    for f in range(int(total * FPS)):
        t = f / FPS; j = int(np.searchsorted(starts, t, side="right") - 1); lt = t - starts[j]
        fade = min(1.0, lt / 0.25, (durs[j] - lt) / 0.25) if j else min(1.0, (durs[j] - lt) / 0.25)
        if j == len(scenes):
            frame = end_im
        else:
            card = {"lines": scenes[j]["lines"]}; nl = len(card["lines"]); per = 0.45
            upto = min(nl, int(lt / per) + 1); a = min(1.0, (lt - (upto - 1) * per) / 0.35)
            ck = (j, upto, round(a, 2))
            if ck not in cache:
                cache[ck] = art_text(card, pal, upto, a)
            frame = art_frame(bases[j], lt / durs[j]).convert("RGBA"); frame.alpha_composite(cache[ck])
            frame = frame.convert("RGB"); d = ImageDraw.Draw(frame)
            y0, y1 = ART_BAND
            d.rectangle([0, y0, W, y1], fill=(0, 0, 0))
            d.text((W / 2, y0 + 70), "오리지널 웹소설 예고편", font=fit("오리지널 웹소설 예고편", "B", 54)[0], fill=(245, 245, 245), anchor="mm")
            d.text((W / 2, y0 + 195), se["title"], font=fit(se["title"], "B", 92)[0], fill=(255, 214, 0), anchor="mm")
        if fade < 1:
            frame = Image.blend(Image.new("RGB", (W, H)), frame, max(0.0, fade))
        ff.stdin.write(frame.tobytes())
    ff.stdin.close(); ff.wait()
    cues = [card_cue({"lines": sc["lines"]}) for sc in scenes] + [None]
    wav = sound(starts, durs, len(scenes) - 1, total, f"{stem}.wav", cues=cues, seed=k + 7)
    final = pathlib.Path(f"{stem}.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{stem}.v.mp4", "-i", wav, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", f"{total:.2f}", str(final)], check=True)
    for q in (f"{stem}.v.mp4", wav):
        pathlib.Path(q).unlink(missing_ok=True)
    return final


def run_trailer(tok: str, cfg: dict, log: dict, day: dt.date) -> str:
    """예고편 차례면 만들어 예약 업로드하고 알림 한 줄을 돌려준다. 아니면 ''."""
    from .youtube import upload
    work = cfg.get("work", ""); k = next_trailer(cfg, log, day)
    if not k:
        return ""
    se = season(work); tr = trailers(work)[k - 1]
    video = render_trailer(work, k)
    at = publish_at(day, int(cfg.get("trailer_hour", 18)))
    if at <= dt.datetime.now(KST) + dt.timedelta(minutes=10):
        at = None
    status = ({"privacyStatus": "private", "publishAt": at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
              if at else {"privacyStatus": "public"})
    body = {"snippet": {"title": trailer_title(se, tr), "description": trailer_desc(se, work, log, cfg.get("playlist_id")),
                        "tags": ["웹소설", "예고편", "회귀", "복수극"], "categoryId": "24", "defaultLanguage": "ko"},
            "status": {**status, "selfDeclaredMadeForKids": False, "containsSyntheticMedia": False, "embeddable": True}}
    r = upload(tok, body, video)
    log[trailer_key(work, k)] = {"id": r["id"], "date": day.isoformat(), "title": body["snippet"]["title"]}
    return f"\n🎬 예고편 {k}: https://youtu.be/{r['id']} ({f'{at:%m/%d %H:%M} 공개 예약' if at else '바로 공개'})"


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
            row["linked"] = True; row["title"] = snip["title"]
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


PREVIEW_CARDS = 2   # '먼저 보기'에 쓰는 앞 카드 수(끝 반전은 안 보여 줌)


def preview_text(se: dict, ep: dict, hour: int = 21) -> str:
    """커뮤니티 '게시물' 붙여넣기용 '먼저 보기' 글 (BK 11/23 '1번'). 게시물 API가 없어 BK가 붙여넣는다.
    오늘 밤 공개될 화의 앞 장면만 보여 주고 끊는다. 구독 대가(보상)는 약속하지 않는다(YouTube 가짜 참여 정책)."""
    lines = [" ".join(t for t, _ in c["lines"]) for c in ep["cards"][:PREVIEW_CARDS]]
    body = "\n".join(x if x.startswith("「") else f"“{x}”" for x in lines)
    h = f"밤 {hour - 12 if hour > 12 else hour}시"
    return (f"👀 오늘 {h} 공개, {ep['no']}화 「{ep['title']}」 먼저 보기\n\n{body}\n\n"
            f"…그다음 장면은 오늘 {h} 쇼츠에서.\n"
            f"《{se['title']}》 매일 {h} 연재 · 구독하면 새 화 알림이 가요")


def preview_image(work: str, ep: dict, hour: int = 21, out_dir: pathlib.Path = OUT) -> pathlib.Path:
    """게시물에 붙일 정사각 1080x1080 그림: 첫 카드 글 + '오늘 밤 N시 · N화' 띠."""
    from PIL import ImageDraw
    se = season(work); pal = palette(se); S = 1080
    im = background(pal["bg"], S, S); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, S, 170], fill=(0, 0, 0))
    d.text((S / 2, 62), f"오늘 밤 {hour - 12 if hour > 12 else hour}시 · {ep['no']}화 먼저 보기", font=_font("R", 42), fill=pal["gray"], anchor="mm")
    d.text((S / 2, 125), se["title"], font=fit(se["title"], "B", 54, 980)[0], fill=pal["gold"], anchor="mm")
    lines = ep["cards"][0]["lines"]
    fonts = [fit(t, STY[s_][0], STY[s_][1], 960) for t, s_ in lines]
    gap = 34; total = sum(sz for _, sz in fonts) + gap * (len(lines) - 1)
    cy = 170 + (S - 170 - 110) / 2 - total / 2
    for (t, s_), (f, sz) in zip(lines, fonts):
        d.text((S / 2, cy + sz / 2), t, font=f, fill=pal[STY[s_][2]], anchor="mm"); cy += sz + gap
    d.text((S / 2, S - 70), f"「{ep['title']}」", font=fit(f"「{ep['title']}」", "B", 48, 960)[0], fill=pal["accent"], anchor="mm")
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{work}-{ep['no']:02d}-preview.png"
    im.save(path)
    return path


def send_preview(work: str, se: dict, ep: dict, hour: int) -> bool:
    """텔레그램으로 그림 + 글을 보낸다. BK: 유튜브 앱 → 만들기 → 게시물 → 글 붙여넣기 + 그림 추가."""
    try:
        from .api_check import send_photo
        cap = preview_text(se, ep, hour)
        ok = send_photo(preview_image(work, ep, hour), "📣 '먼저 보기' 게시물용 (아래 글 복사 → 유튜브 앱 만들기 → 게시물, 이 그림 첨부)\n\n" + cap)
        return ok or _notify_ok("📣 '먼저 보기' 게시물용 글 (그림 전송 실패)\n\n" + cap)
    except Exception as e:  # noqa: BLE001  미리보기는 부가 기능: 실패해도 업로드는 그대로
        print(f"먼저 보기 실패: {e}", file=sys.stderr)
        return False


def _notify_ok(msg: str) -> bool:
    try:
        from .claude_jobs import notify
        return bool(notify(msg))
    except Exception:  # noqa: BLE001
        return False


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
    from .yt_extras import frame, set_thumbnail  # 맞춤 썸네일 (BK 11/23 고급 기능)
    thumb_ok = set_thumbnail(tok, r["id"], frame(video, video.with_suffix(".thumb.jpg"), 3.0))
    pl = cfg.get("playlist_id") and add_to_playlist(tok, cfg["playlist_id"], r["id"])
    log = load(LOG, {})
    log[long_key(work, k)] = {"id": r["id"], "date": day.isoformat(), "title": long_title(se, work, k), "visibility": vis}
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    when = f"{at:%m/%d %H:%M} 공개 예약" if at else ("바로 공개" if vis == "schedule" else "비공개")
    msg = f"📚 웹소설 몰아보기 {k} 업로드 ({when}): https://youtu.be/{r['id']}" + ("" if pl or not cfg.get("playlist_id") else "\n(재생목록 추가 실패: 손으로 추가)") \
        + ("" if thumb_ok else "\n(썸네일 설정 실패: 스튜디오에서 손으로)")
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


def related(work: str, log: dict) -> str:
    """쇼츠 '관련 동영상' 안내: 가장 최근 몰아보기 (API 로는 못 정함 → BK 가 스튜디오에서)."""
    from .yt_extras import related_line
    longs = sorted((k, v) for k, v in log.items() if k.startswith(work + "/long-") and isinstance(v, dict) and v.get("id"))
    return related_line(longs[-1][1].get("title"), longs[-1][1]["id"]) if longs else ""


def trailer_only(cfg: dict, log: dict, day: dt.date) -> None:
    """본편이 없는 날(시즌 끝 등)에도 예고편 차례면 올린다."""
    from .youtube import access_token, summary
    need = ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "WEBNOVEL_YT_REFRESH_TOKEN")
    if not next_trailer(cfg, log, day) or os.environ.get("WEBNOVEL_YT_ENABLED", "").lower() != "true" \
            or not cfg.get("on") or not all(os.environ.get(k) for k in need):
        return
    msg = run_trailer(access_token(*(os.environ[k] for k in need)), cfg, log, day)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    summary(msg.strip()); _notify(msg.strip())


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
        trailer_only(cfg, log, day)
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
    try:
        trl = run_trailer(tok, cfg, log, day)
    except Exception as e:  # noqa: BLE001  예고편 실패가 본편 기록을 막지 않게
        trl = f"\n(예고편 실패: {e})"
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    when = (f"{at:%m/%d %H:%M} 공개 예약" if at else "바로 공개") if vis == "schedule" else "비공개(BK 확인용)"
    msg = (f"📖 웹소설 {se['title']} {ep['no']}화 업로드 ({when}): https://youtu.be/{r['id']}"
           + ("" if pl or not cfg.get("playlist_id") else "\n(재생목록 추가 실패: 손으로 추가)")
           + ("" if linked is not False else "\n(이전 화 설명란 '다음 화' 링크 추가 실패)")
           + (f"\n💬 예고 댓글: {', '.join(map(str, cm))}화 (스튜디오에서 '고정'만 눌러 주세요)" if cm else "")
           + (f"\n(예고 댓글 실패: 토큰에 youtube.force-ssl 권한이 필요할 수 있음, docs/WEBNOVEL.md 4장)" if cerr else "")
           + related(work, log) + trl)
    summary(msg); _notify(msg)
    if vis == "schedule" and at and cfg.get("preview", True):
        summary("📣 먼저 보기 게시물 글 " + ("텔레그램 전송" if send_preview(work, se, ep, int(cfg.get("hour", 21))) else "전송 실패"))
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
    if cmd == "preview":
        work = cfg["work"]; no = int(argv[1]) if len(argv) > 1 else 1
        ep = next(e for e in episodes(work) if e["no"] == no)
        print(preview_image(work, ep)); print(preview_text(season(work), ep))
        return 0
    if cmd == "long":
        work = cfg["work"]; k = int(argv[1]) if len(argv) > 1 else 1
        v, ch = render_long(work, k)
        print(v); print("\n".join(ch))
        return 0
    if cmd == "trailer":
        print(render_trailer(cfg["work"], int(argv[1]) if len(argv) > 1 else 1))
        return 0
    if cmd == "run":
        day = dt.date.fromisoformat(argv[1]) if len(argv) > 1 and argv[1] else dt.datetime.now(KST).date()
        return run(day, True if "--long" in argv else None)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
