"""삼촌 쇼츠 실사(實寫) 배경 — 무료 스톡 영상 위에 우리 숫자·큰 자막 + 작은 동전이 반응 (2026-11-18 BK "실사 영상이 좋아").

- 영상 출처는 상업 이용 무료 스톡만: Pexels(PEXELS_API_KEY) → 없으면 Pixabay(PIXABAY_API_KEY). 남의 유튜브·뉴스·연예인 영상 금지.
- 스톡 원본은 저장소(공개)에 올리지 않는다: 렌더할 때 내려받아 쓰고 버린다. 쓴 영상 id 만 data/stock_used.json 에 남겨
  30일 안에는 같은 영상을 다시 안 쓴다(반복 콘텐츠로 안 보이게). 출처(촬영자·페이지)는 meta.json credits → 설명란.
- 대본은 기존 skit 과 같고, 대본 맨 위 "style": "live" + 첫 줄(또는 장면)에 "clip": 장면 이름(config/stock_scenes.json).
  clip 이 없는 줄은 앞 줄 영상을 이어서 쓴다. 한 편에 장면 3개까지.
  2026-11-18 BK 샘플 피드백("1도 차이는 티도 안 나지"에 지구본, "겨울 4달"에 흐린 산장): 자유 검색어 → 장면 사전 + 태그 검사
  (need 하나 이상, ban_all·ban 없음) + 눈으로 확인한 ok 목록 우선 + bad 목록 제외.
  줄 "src": 화면 아래 작은 출처(예 "기상청 11/18 중기예보"), "layout": "focus" 면 배경을 흐리게 하고 숫자만 크게.
- 2026-11-19 BK 가 구독(제미나이 Flow·Veo, ChatGPT Sora) 크레딧으로 손수 만든 AI 클립: media/ai_clips/ + config/ai_clips.json.
  장면 이름이 같으면 스톡보다 먼저 쓰고, 같은 클립은 AI_GAP 일 안에 다시 안 쓴다(돌려 쓰기, 오래 안 쓴 것부터).
  "realistic": true 인 클립이 들어간 편은 유튜브 '변경·합성 콘텐츠' 표시(containsSyntheticMedia)를 켠다. 웹 화면 자동 조작·유료 API 는 안 씀.
- 키가 없거나 내려받기 실패 → 예외. episodes.render 가 웹툰 그림체로 대신 만든다 (영상이 빠지는 날 없음).
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import pathlib
import re
import subprocess
import urllib.parse
import urllib.request

from .skit import GAP, LEAD, TAIL, buzz, ding, voices

W, H, FPS, SR = 1080, 1920, 30, 44100
INK = (25, 25, 28)
USED = pathlib.Path("data/stock_used.json")
REUSE_DAYS = 30
AI_CLIPS = pathlib.Path("config/ai_clips.json")
AI_GAP = 7  # 같은 AI 클립은 7일 안에 다시 안 쓴다
LABEL = "돈삼촌 살림 아하"
SCENES = pathlib.Path("config/stock_scenes.json")
MAX_SCENES = 3


def scenes_cfg() -> dict:
    return json.loads(SCENES.read_text(encoding="utf-8"))


def _font(n):
    from .shorts import font
    return font(n)


def _fit(d, text: str, size: int, maxw: int = W - 140):
    """글자가 화면 밖으로 안 나가게 크기를 줄인다."""
    while size > 30 and d.textlength(text, font=_font(size)) > maxw:
        size -= 4
    return _font(size)


def available() -> bool:
    return bool(os.environ.get("PEXELS_API_KEY") or os.environ.get("PIXABAY_API_KEY") or ai_clips())


def ai_clips() -> list[dict]:
    """BK 가 만든 AI 클립 중 파일이 있는 것."""
    if not AI_CLIPS.exists():
        return []
    return [c for c in json.loads(AI_CLIPS.read_text(encoding="utf-8")).get("clips", []) if pathlib.Path(c["file"]).exists()]


def ai_pick(name: str, today: dt.date, taken: set, clips: list[dict] | None = None, used: dict | None = None) -> dict | None:
    """장면 name 의 AI 클립 중 AI_GAP 일 안에 안 쓴 것, 오래 안 쓴 것부터."""
    if used is None:
        used = json.loads(USED.read_text(encoding="utf-8")) if USED.exists() else {}
    gap = (today - dt.timedelta(days=AI_GAP)).isoformat()
    free = [c for c in (ai_clips() if clips is None else clips)
            if c.get("scene") == name and c["id"] not in taken and used.get(c["id"], "") < gap]
    if not free:
        return None
    c = min(free, key=lambda c: (used.get(c["id"], ""), c["id"]))
    tool = c.get("tool", "")
    return {"id": c["id"], "file": c["file"], "credit": f"AI 생성({tool})" if tool else "AI 생성", "page": "",
            "ai": True, "realistic": bool(c.get("realistic"))}


def line_clips(lines: list[dict], scene: dict) -> list[str]:
    """줄마다 쓸 장면 이름 (없으면 앞 줄 것을 이어서)."""
    out, cur = [], (scene.get("clip") or "").strip()
    for ln in lines or []:
        cur = (ln.get("clip") or "").strip() or cur
        out.append(cur)
    return out


def check_lines(lines: list[dict], scene: dict) -> list[str]:
    e = []
    names = scenes_cfg()["scenes"]
    qs = line_clips(lines, scene)
    if qs and not qs[0]:
        e.append("실사(live)는 첫 줄(또는 장면)에 clip(장면 이름) 필요")
    for i, (ln, q) in enumerate(zip(lines or [], qs)):
        if q and q not in names:
            e.append(f"줄 {i}: clip '{q}' 은 config/stock_scenes.json 장면 이름이 아님")
        elif q and names[q].get("ai_only") and not any(c.get("scene") == q for c in ai_clips()):
            e.append(f"줄 {i}: clip '{q}' 은 AI 클립 전용인데 아직 클립이 없음 (info 의 ai_scenes 만)")
        if len(ln.get("src", "")) > 30:
            e.append(f"줄 {i}: src(출처)는 30자 이하")
        if ln.get("layout", "full") not in ("full", "focus"):
            e.append(f"줄 {i}: layout 은 full/focus")
    if len(set(q for q in qs if q)) > MAX_SCENES:
        e.append(f"실사 장면은 한 편에 {MAX_SCENES}개까지 (대사에 딱 맞는 그림이 없으면 clip 을 빼서 앞 장면을 이어 쓰기)")
    return e


def relevant(words: str, sc: dict, cfg: dict) -> bool:
    """태그(또는 주소 글자)에 need 중 하나가 있고 ban 이 없어야."""
    w = " " + re.sub(r"[^a-z]+", " ", words.lower()) + " "
    if any(f" {b} " in w for b in cfg.get("ban_all", []) + sc.get("ban", [])):
        return False
    return any(f" {n} " in w for n in sc["need"])


# ---------------- 스톡 영상 고르기 ----------------
def _get(url: str, headers: dict | None = None) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "don3chon-shorts", **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def pexels_candidates(q: str, data: dict | None = None) -> list[dict]:
    if data is None:
        data = _get("https://api.pexels.com/videos/search?" + urllib.parse.urlencode(
            {"query": q, "orientation": "portrait", "size": "medium", "per_page": 15}),
            {"Authorization": os.environ["PEXELS_API_KEY"]})
    out = []
    for v in data.get("videos", []):
        files = [f for f in v.get("video_files", []) if f.get("file_type") == "video/mp4" and (f.get("height") or 0) >= 1280]
        if not files or (v.get("duration") or 0) < 4:
            continue
        f = min(files, key=lambda f: f.get("height") or 9999)  # 1280~ 중 가장 작은 것 (빨리 받기)
        out.append({"id": f"pexels-{v['id']}", "url": f["link"], "credit": f"Pexels · {v.get('user', {}).get('name', '')}".strip(" ·"),
                    "page": v.get("url", ""), "words": v.get("url", "").rstrip("/").rsplit("/", 1)[-1]})
    return out


def pixabay_candidates(q: str, data: dict | None = None) -> list[dict]:
    if data is None:
        data = _get("https://pixabay.com/api/videos/?" + urllib.parse.urlencode(
            {"key": os.environ["PIXABAY_API_KEY"], "q": q, "per_page": 50, "safesearch": "true", "video_type": "film"}))
    out = []
    for v in data.get("hits", []):
        vs = v.get("videos", {})
        f = vs.get("medium") or vs.get("large") or {}
        if not f.get("url") or (v.get("duration") or 0) < 4:
            continue
        out.append({"id": f"pixabay-{v['id']}", "url": f["url"], "credit": f"Pixabay · {v.get('user', '')}".strip(" ·"),
                    "page": v.get("pageURL", ""), "words": v.get("tags", "")})
    return out


def load_used(today: dt.date) -> dict:
    if not USED.exists():
        return {}
    d = json.loads(USED.read_text(encoding="utf-8"))
    old = (today - dt.timedelta(days=REUSE_DAYS)).isoformat()
    return {k: v for k, v in d.items() if v >= old}


def pick(cands: list[dict], used: dict, taken: set, sc: dict | None = None, cfg: dict | None = None) -> dict | None:
    """ok(눈으로 확인한 것) 먼저, 그다음 태그가 맞는 것. bad·최근 사용·이번 편 사용은 뺀다."""
    cfg = cfg or {}
    bad = set(cfg.get("bad", []))
    ok = (sc or {}).get("ok", [])
    free = [c for c in cands if c["id"] not in used and c["id"] not in taken and c["id"] not in bad]
    for c in sorted(free, key=lambda c: ok.index(c["id"]) if c["id"] in ok else len(ok)):
        if c["id"] in ok or sc is None or relevant(c.get("words", ""), sc, cfg):
            return c
    return None


def fetch(name: str, used: dict, taken: set, dest: pathlib.Path) -> dict:
    """장면 이름 하나 → 맞는 영상 하나를 dest 로 내려받고 정보 반환."""
    cfg = scenes_cfg()
    sc = cfg["scenes"][name]
    cands = []
    for key, fn in (("PIXABAY_API_KEY", pixabay_candidates), ("PEXELS_API_KEY", pexels_candidates)):
        if os.environ.get(key):
            try:
                cands += fn(sc["q"])
            except Exception as ex:  # noqa: BLE001 한쪽이 막혀도 다른 쪽
                print(f"스톡 검색 실패({key[:-8]}): {ex}")
    c = pick(cands, used, taken, sc, cfg)
    if not c:
        raise RuntimeError(f"맞는 스톡 영상 없음: {name}")
    req = urllib.request.Request(c["url"], headers={"User-Agent": "don3chon-shorts"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())
    taken.add(c["id"])
    print(f"실사 {name}: {c['id']} ({c.get('words', '')[:60]})")
    return c


# ---------------- 프레임 읽기 ----------------
class Clip:
    """스톡 영상을 1080x1920 로 잘라 프레임을 차례로 꺼낸다 (짧으면 반복)."""

    def __init__(self, path: pathlib.Path):
        self.p = subprocess.Popen(
            ["ffmpeg", "-loglevel", "error", "-stream_loop", "-1", "-i", str(path), "-an", "-vf",
             f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},eq=brightness=-0.06:saturation=1.08",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        self.last = None

    def next(self):
        from PIL import Image
        b = self.p.stdout.read(W * H * 3)
        if len(b) == W * H * 3:
            self.last = Image.frombytes("RGB", (W, H), b)
        if self.last is None:
            self.last = Image.new("RGB", (W, H), (30, 30, 34))
        return self.last.copy()

    def close(self):
        self.p.kill()


def _shade():
    """위·아래 어둡게 (자막·동전이 잘 보이게)."""
    from PIL import Image
    a = Image.new("L", (1, H))
    for y in range(H):
        t = y / H
        v = 170 * max(0, 1 - t / 0.42) ** 1.4 + 200 * max(0, (t - 0.62) / 0.38) ** 1.3
        a.putpixel((0, y), int(min(215, v)))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh.putalpha(a.resize((W, H)))
    return sh


def render_part(lines: list[dict], ad: bool, out: pathlib.Path, tmp: pathlib.Path, product_img=None, progress=None,
                bg: str = "room", badge: str | None = None, pet: bool = True, scene: dict | None = None,
                date: str = "", credits: list | None = None, clips: dict | None = None, sheet: pathlib.Path | None = None) -> float:
    """clips 를 주면(테스트) 내려받지 않고 {장면: 파일} 을 쓴다. credits 리스트에 출처를 채운다.
    sheet 를 주면 줄마다 가운데 프레임을 모은 확인용 그림(대사·장면·영상 id)을 저장한다 (어색한 장면 찾기)."""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
    from .uncle import write_wav
    from .shorts import fit
    from .webtoon import DIR, N_MAP, U_MAP, _draw_pet
    scene = scene or {}
    queries = line_clips(lines, scene)
    today = dt.date.fromisoformat(date) if date else dt.date.today()
    used = load_used(today)
    files, taken = {}, set()
    missing = []
    for q in dict.fromkeys(queries):
        if clips and q in clips:
            files[q] = pathlib.Path(clips[q])
            continue
        a = ai_pick(q, today, taken)
        if a:  # BK 가 만든 AI 클립이 먼저 (돌려 쓰기)
            taken.add(a["id"])
            files[q] = pathlib.Path(a["file"])
            print(f"AI 클립 {q}: {a['id']}")
            if credits is not None:
                credits.append({**{k: a[k] for k in ("id", "credit", "page", "ai", "realistic")}, "query": q, "lines": []})
            continue
        if scenes_cfg()["scenes"][q].get("ai_only"):
            print(f"{q}: AI 클립 없음 → 앞 장면 이어 쓰기")
            missing.append(q)
            continue
        dest = tmp / f"stock-{len(files)}.mp4"
        try:
            c = fetch(q, used, taken, dest)
        except RuntimeError as ex:  # 맞는 영상이 없는 장면은 앞 장면을 이어 쓴다 (엉뚱한 그림보다 낫다)
            print(f"{ex} → 앞 장면 이어 쓰기")
            missing.append(q)
            continue
        files[q] = dest
        if credits is not None:
            credits.append({"id": c["id"], "credit": c["credit"], "page": c["page"], "query": q, "lines": []})
    if not files:
        raise RuntimeError("실사 장면을 하나도 못 찾음")
    prev = None
    for i, q in enumerate(queries):  # 못 찾은 장면 → 바로 앞(없으면 첫) 찾은 장면
        if q in files:
            prev = q
        else:
            queries[i] = prev or next(iter(files))
    for c in credits or []:
        c["lines"] = [i for i, x in enumerate(queries) if x == c["query"]]
    vc = voices(lines)
    starts, t = [], LEAD
    for c in vc:
        starts.append(t)
        t += len(c) / SR + GAP
    total = t + TAIL
    n = int(total * FPS)
    audio = np.zeros(int(total * SR) + SR, dtype=np.float32)
    env = np.zeros(n)
    for c, st in zip(vc, starts):
        a = int(st * SR)
        audio[a:a + len(c)] += c
        for f in range(int(st * FPS), min(n, int((st + len(c) / SR) * FPS) + 1)):
            s0 = int((f / FPS - st) * SR)
            if 0 <= s0 < len(c):
                env[f] = min(1, float(np.sqrt(np.mean(c[s0:s0 + SR // FPS] ** 2))) * 9)

    def add(x, at):
        a = int(at * SR)
        audio[a:a + len(x)] += x[: max(0, len(audio) - a)]

    add(ding(2), 0.0)
    for st, ln in zip(starts, lines):
        if ln.get("sfx") == "buzz":
            add(buzz(), st)
        if ln.get("big"):
            add(ding(1), st + 0.5)
            if pet:
                add(ding(2) * 0.6, st + 0.85)
        elif ln.get("sfx") == "ding":
            add(ding(1), st)
    wav = tmp / f"{out.stem}.wav"
    write_wav(audio[: int(total * SR)], wav)

    readers = {q: Clip(p) for q, p in files.items()}
    shade = _shade()
    avatars = {}

    def avatar(who, pose):
        name = (U_MAP if who == "u" else N_MAP).get(pose or "talk", "talk" if who == "u" else "think")
        if (who, name) not in avatars:
            im = fit(Image.open(DIR / f"{who}-{name}.png").convert("RGB"), 190, 190)
            m = Image.new("L", (190, 190), 0)
            ImageDraw.Draw(m).ellipse([0, 0, 189, 189], fill=255)
            avatars[(who, name)] = (im, m)
        return avatars[(who, name)]

    def frame(f):
        tt = f / FPS
        i = 0
        for j, st in enumerate(starts):
            if tt >= st - GAP:
                i = j
        ln, st = lines[i], starts[i]
        ds = max(0.0, tt - st)
        raw = readers[queries[i]].next()
        z = 1.0 + 0.05 * min(1, ds / 3)  # 천천히 다가가기
        cw, ch = W / z, H / z
        im = raw.crop((int((W - cw) / 2), int((H - ch) / 2), int((W + cw) / 2), int((H + ch) / 2))).resize((W, H))
        focus = ln.get("layout") == "focus" or (ln.get("big") and ds > 0.45)
        if focus:
            im = im.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.7))
        im = im.convert("RGBA")
        im.alpha_composite(shade)
        d = ImageDraw.Draw(im)
        # 위 막대
        d.rectangle([0, 0, W, 150], fill=(31, 92, 74))
        d.text((W / 2, 50), "돈 줍는 삼촌", font=_font(46), fill="white", anchor="mm")
        d.text((W / 2, 112), LABEL, font=_font(32), fill=(225, 240, 230), anchor="mm")
        # 자막: 굵은 흰 글씨 + 검은 테두리 (실사 위 가독성)
        y = 200
        pop = 1.0 - 0.1 * math.exp(-ds * 14)
        for row in ln.get("cap", []):
            fo = _fit(d, row, int(88 * pop))
            d.text((W / 2, y + 60), row, font=fo, fill="white", anchor="mm", stroke_width=9, stroke_fill=INK)
            y += 128
        if ln.get("src"):
            fs = _font(30)
            d.text((W / 2, y + 22), f"출처: {ln['src']}", font=fs, fill=(235, 235, 235), anchor="mm", stroke_width=4, stroke_fill=INK)
        pk = min(1, max(0, (ds - 0.45) / 0.25))
        if ln.get("big") and pk > 0:
            fo = _fit(d, ln["big"], int(150 * (0.6 + 0.4 * pk + 0.12 * math.sin(pk * math.pi))), W - 180)
            wdt = d.textlength(ln["big"], font=fo)
            by = 960
            d.rounded_rectangle([(W - wdt) / 2 - 44, by, (W + wdt) / 2 + 44, by + 210], 34, fill=(255, 209, 102), outline=INK, width=8)
            d.text((W / 2, by + 105), ln["big"], font=fo, fill=(200, 30, 40), anchor="mm")
            if ln.get("sub"):
                fs = _fit(d, ln["sub"], 36)
                d.text((W / 2, by + 260), ln["sub"], font=fs, fill="white", anchor="mm", stroke_width=5, stroke_fill=INK)
        elif ln.get("sub"):
            fs = _font(36)
            d.text((W / 2, y + 70), ln["sub"], font=fs, fill="white", anchor="mm", stroke_width=5, stroke_fill=INK)
        if badge and i == 0:  # 첫 장면 = 썸네일·훅
            fo = _fit(d, badge, 116, W - 200)
            wdt = d.textlength(badge, font=fo)
            bx, by = W / 2, 1060 + int(8 * math.sin(tt * 9))
            d.rounded_rectangle([bx - wdt / 2 - 46, by - 92, bx + wdt / 2 + 46, by + 92], 38, fill=(255, 209, 102), outline=INK, width=8)
            d.text((bx, by), badge, font=fo, fill=(200, 30, 40), anchor="mm")
        # 말하는 사람: 작은 동그라미 (말할 때 살짝 커짐)
        who = ln["who"]
        av, m = avatar(who, ln.get(who))
        k = 1 + 0.04 * env[f]
        s = int(190 * k)
        ax, ay = 60, 1500
        d.ellipse([ax - 8, ay - 8, ax + s + 8, ay + s + 8], fill="white", outline=INK, width=6)
        im.paste(av.resize((s, s)), (ax, ay), m.resize((s, s)))
        tag, col = ("삼촌", (31, 92, 74)) if who == "u" else ("조카", (40, 70, 150))
        d.rounded_rectangle([ax + 20, ay + s - 10, ax + s - 20, ay + s + 50], 26, fill=col, outline="white", width=4)
        d.text((ax + s / 2, ay + s + 20), tag, font=_font(34), fill="white", anchor="mm")
        if pet and queries[i] != "dongjeon":  # 동전이: 오른쪽 아래 작게 (AI 동전이 영상이 배경이면 겹치니 뺌)
            sub_im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            _draw_pet(sub_im, ln, ds, tt, i)
            box = sub_im.crop((W // 2 - 160, 1360, W // 2 + 460, 1900)).resize((434, 378))
            im.alpha_composite(box, (W - 470, 1450))
            d = ImageDraw.Draw(im)
        cur = next((c for c in credits or [] if c["query"] == queries[i]), None)  # 지금 줄의 배경 출처
        if cur and cur.get("ai"):
            d.text((W / 2, H - 110), "배경 영상: AI 생성", font=_font(24), fill=(210, 210, 210), anchor="mm")
        else:
            cr = cur["credit"] if cur else ""
            d.text((W / 2, H - 110), f"배경 영상 {cr}" if cr else "배경 영상: 무료 스톡", font=_font(24), fill=(210, 210, 210), anchor="mm")
        d.text((W / 2, H - 78), "AI 음성 · AI로 그린 가상 캐릭터", font=_font(24), fill=(210, 210, 210), anchor="mm")
        if progress:
            d.rectangle((60, H - 46, 60 + (W - 120) * progress(tt), H - 40), fill="#d6452f")
        return im.convert("RGB")

    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-crf", "21", "-preset", "veryfast",
                           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", str(SR), "-ac", "1",
                           "-t", f"{total:.2f}", str(out)], stdin=subprocess.PIPE)
    ids = {c["query"]: c["id"] for c in credits or []}
    mids = {int((st + (len(c) / SR) / 2) * FPS): i for i, (st, c) in enumerate(zip(starts, vc))}
    shots = {}
    try:
        for f in range(n):
            im = frame(f)
            if f in mids:
                shots[mids[f]] = im.resize((W // 4, H // 4))
            ff.stdin.write(im.tobytes())
    finally:
        ff.stdin.close()
        for r in readers.values():
            r.close()
    if ff.wait():
        raise RuntimeError("ffmpeg 실패")
    if sheet and shots:
        cw, chh = W // 4, H // 4
        grid = Image.new("RGB", (cw * len(shots), chh + 120), "white")
        d = ImageDraw.Draw(grid)
        for k, i in enumerate(sorted(shots)):
            grid.paste(shots[i], (k * cw, 0))
            d.text((k * cw + 8, chh + 8), f"{i + 1}. {queries[i]}", font=_font(20), fill=INK)
            d.text((k * cw + 8, chh + 36), ids.get(queries[i], ""), font=_font(18), fill=(90, 90, 90))
            d.text((k * cw + 8, chh + 64), " ".join(lines[i].get("cap", []))[:16], font=_font(18), fill=(90, 90, 90))
        grid.save(sheet, quality=80)
    return total


def remember(credits: list, date: str) -> None:
    """쓴 스톡 영상 id 기록 (30일 재사용 금지). 원본 파일은 저장하지 않는다."""
    d = json.loads(USED.read_text(encoding="utf-8")) if USED.exists() else {}
    for c in credits:
        d[c["id"]] = date
    USED.parent.mkdir(parents=True, exist_ok=True)
    USED.write_text(json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
