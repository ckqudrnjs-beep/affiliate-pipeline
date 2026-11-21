"""웹소설 쇼츠 '한 화만 더' (BK 2026-11-21): 오리지널 웹소설을 하루 한 화, 글 카드 세로 쇼츠로 자동 제작·업로드.

- 대본: data/webnovel/works/<작품>/season.json + ep/NN.json (카드 = 줄 목록 + 모티프). 오리지널만, 기존 작품 베끼기 금지.
- 품질: 40점 점수표(docs/WEBNOVEL.md) 32점 이상 + 2점 이하 항목 없음인 화만 data 에 들어온다. 여기선 정책 검사만 다시 한다.
- 화면: 코드로 그림(그림 AI 안 씀). 작품마다 season.json style 로 색을 바꿔 반복 콘텐츠로 보이지 않게.
- 소리: 효과음 합성 + (있으면) BK Suno 곡(config bgm). AGENTS 0-13.
- 업로드: 웹소설 채널 전용 토큰 WEBNOVEL_YT_REFRESH_TOKEN, 아동용 아님(selfDeclaredMadeForKids=False) 자동,
  AI 그림을 쓴 화(ep "ai": true)는 설명란 표기 + containsSyntheticMedia.
  config visibility=private 이면 첫 화만 비공개로 올리고 멈춤(BK 확인), schedule 이면 매일 hour 시 공개 예약.
사용: python -m pipeline.webnovel next | render [화] | run [YYYY-MM-DD]
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


def description_of(se: dict, ep: dict) -> str:
    body = " ".join(t for c in ep["cards"] for t, _ in c["lines"])
    nxt = ep.get("next", {})
    tail = f"다음 화: {nxt['no']}화 {nxt['title']}" if nxt.get("title") else nxt.get("season_end", "")
    ai = "\nAI로 만든 그림이 포함되어 있습니다." if ep.get("ai") else ""
    return (f"{se['title']} {ep['no']}화 — {ep['title']}\n\n{body}\n\n{tail}\n\n"
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


def fit(text: str, kind: str, size: int):
    f = _font(kind, size)
    while f.getlength(text) > MAXW and size > 30:
        size -= 4; f = _font(kind, size)
    return f, size


def draw_card(card: dict, pal: dict, upto: int | None = None, alpha: float = 1.0, final: bool = False):
    from PIL import ImageDraw
    lines, mot = card["lines"], card.get("motif")
    im = background(pal["accent_bg"] if final else pal["bg"]); d = ImageDraw.Draw(im)
    top = BAND + 40
    if mot:
        motif(d, mot, W / 2, top + (H - top) * 0.25, pal)
    fonts = [fit(t, STY[s][0], STY[s][1]) for t, s in lines]
    gap = 34; total = sum(sz for _, sz in fonts) + gap * (len(lines) - 1)
    cy = top + (H - top) * (0.55 if mot else 0.45) - total / 2
    n = len(lines) if upto is None else upto
    for i, ((t, s), (f, sz)) in enumerate(zip(lines, fonts)):
        if i < n:
            a = alpha if i == n - 1 else 1.0
            col = tuple(int(c * a + 18 * (1 - a)) for c in pal[STY[s][2]])
            d.text((W / 2, cy + sz / 2), t, font=f, fill=col, anchor="mm")
        cy += sz + gap
    return im, d


def end_card(se: dict, ep: dict, pal: dict) -> dict:
    nxt = ep.get("next", {})
    if nxt.get("title"):
        return {"lines": [["다음 화", "s"], [f"{nxt['no']}화", "g"], [nxt["title"], "big"], ["구독하면 다음 화 알림이 가요", "s"]], "motif": None}
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


def sound(starts, durs, last_story: int, total: float, path: str) -> str:
    """효과음만 합성: 낮은 울림 + 장 넘김 + 끝 두 장 앞 심장 소리 + 반전 직전 정적 + 반전 타격음."""
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
    beat0 = starts[max(0, last_story - 2)]
    for j in range(int((starts[last_story] - beat0) / 0.75)):
        add(beat0 + 0.4 + j * 0.75, tone(50, 0.25, 0.5, 18))
    s = int(starts[last_story] * sr)
    buf[max(0, s - int(0.35 * sr)):s] *= 0.05
    add(starts[last_story], sum(tone(fr, 2.5, 0.25, 1.5) for fr in (110, 116.5, 233, 466)))
    fade = np.ones(n); m = int(sr * 1.5); fade[-m:] = np.linspace(1, 0, m); buf *= fade
    buf = np.clip(buf, -1, 1)
    with wave.open(path, "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(sr)
        wv.writeframes((buf * 32000).astype(np.int16).tobytes())
    return path


# ---------- 업로드 ----------
def publish_at(day: dt.date, hour: int) -> dt.datetime:
    return dt.datetime.combine(day, dt.time(hour), KST)


def video_body(se: dict, ep: dict, visibility: str, at: dt.datetime | None) -> dict:
    if visibility == "schedule" and at:
        status = {"privacyStatus": "private", "publishAt": at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    elif visibility == "schedule":
        status = {"privacyStatus": "public"}
    else:
        status = {"privacyStatus": "private"}
    return {"snippet": {"title": title_of(se, ep), "description": description_of(se, ep),
                        "tags": ["웹소설", "회귀", "복수극", "로맨스판타지", se["title"], "한화만더"],
                        "categoryId": "24", "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
            "status": {**status, "selfDeclaredMadeForKids": False,
                       "containsSyntheticMedia": bool(ep.get("ai_realistic")), "embeddable": True}}


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


def run(day: dt.date) -> int:
    from .youtube import access_token, summary, upload
    cfg = load(CFG, {}); log = load(LOG, {})
    work = cfg.get("work", "")
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
    r = upload(tok, video_body(se, ep, vis, at), video)
    pl = cfg.get("playlist_id") and add_to_playlist(tok, cfg["playlist_id"], r["id"])
    log[key(work, ep["no"])] = {"id": r["id"], "date": day.isoformat(), "title": title_of(se, ep), "visibility": vis}
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    when = (f"{at:%m/%d %H:%M} 공개 예약" if at else "바로 공개") if vis == "schedule" else "비공개(BK 확인용)"
    msg = f"📖 웹소설 {se['title']} {ep['no']}화 업로드 ({when}): https://youtu.be/{r['id']}" + ("" if pl or not cfg.get("playlist_id") else "\n(재생목록 추가 실패: 손으로 추가)")
    summary(msg)
    try:
        from .claude_jobs import notify
        notify(msg)
    except Exception as e:  # noqa: BLE001
        print(f"텔레그램 알림 실패: {e}", file=sys.stderr)
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
    if cmd == "run":
        day = dt.date.fromisoformat(argv[1]) if len(argv) > 1 and argv[1] else dt.datetime.now(KST).date()
        return run(day)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
