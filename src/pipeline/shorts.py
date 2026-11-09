"""매일 쇼츠 1개 자동 제작 (2026-11-09, BK 결정: 전부 자동).

흐름 (GitHub Actions `shorts` 워크플로, 매일 08:30 KST):
1. 업로드 대기열(config/youtube_queue.csv)에 아직 안 올린 영상이 SHORTS_BUFFER(기본 3)개 이상이면 쉰다.
2. 알리 공식 제휴 API로 후보를 받아(curate 와 같은 기준: 평점·판매량·가격) 사이트에 없는 상품 1개를 고른다.
3. 판매자 사진을 공식 API(productdetail.get)로 받는다. 크롤링하지 않는다.
4. Claude API가 상품명(판매자 표기)만 보고 짧은 이름·소개 글·질문·자막·계산 조건을 JSON으로 쓴다.
   계산 숫자는 코드가 낸다. 문구는 준수 검사(compliance.BANNED_PATTERNS)를 통과해야 한다.
5. Supertonic 3 (MIT / OpenRAIL-M) 7번 목소리(M2)로 내레이션, Pillow+ffmpeg로 1080×1920 영상.
   구성: 질문 → 상품 사진·자막 → 계산 카드 → 이름·가격·don3chon.com. 화면 위에 늘 "광고 · 알리익스프레스 제휴 링크".
6. data/products/<slug>.json(사이트 상품), media/youtube/<slug>.mp4, 대기열 한 줄을 커밋 → youtube 워크플로가 예약 업로드.

키는 GitHub Secrets(ANTHROPIC_API_KEY, ALI_*)에서만 읽는다.
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
import wave

from .compliance import BANNED_PATTERNS
from .youtube import LOG as YT_LOG, MEDIA, QUEUE, load_log, load_queue

KST = dt.timezone(dt.timedelta(hours=9))
PRODUCTS = pathlib.Path("data/products")
ASSETS = pathlib.Path("video_assets")
SKIPPED = pathlib.Path("data/shorts/skipped.json")
CATEGORIES = ("clean", "heat", "living", "humidify", "kitchen", "digital", "goods")
KRW_PER_KWH = 200  # 주택용 누진 2단계 + 기후환경·연료비·세금 대략. 화면에 "약"으로만 쓴다
ANTHROPIC_MODEL = os.environ.get("SHORTS_MODEL", "claude-sonnet-5-5")
VOICE = os.environ.get("SHORTS_VOICE", "M2")  # BK가 고른 7번 목소리 (F1~F5, M1~M5 순서의 7번째)
W, H, FPS = 1080, 1920, 30
PHOTO = (0, 285, 1080, 1350)  # 사진 영역 (x, y, w, h)
BG = (24, 26, 28)
LABEL = "광고 · 알리익스프레스 제휴 링크"


# ---------- 숫자 읽기 ----------
_D = "영일이삼사오육칠팔구"


def _under_10000(n: int) -> str:
    out = ""
    for unit, v in (("천", 1000), ("백", 100), ("십", 10)):
        q, n = divmod(n, v)
        if q:
            out += ("" if q == 1 else _D[q]) + unit
    return out + (_D[n] if n else "")


def ko_number(n: int) -> str:
    """4700 → 사천칠백, 125000 → 십이만 오천 (TTS가 숫자를 또박또박 읽게)."""
    if n == 0:
        return "영"
    parts = []
    for unit, v in (("억", 10**8), ("만", 10**4)):
        q, n = divmod(n, v)
        if q:
            parts.append(("" if q == 1 and unit == "만" else _under_10000(q)) + unit)
    if n:
        parts.append(_under_10000(n))
    return " ".join(parts)


_NATIVE = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"]
_NATIVE10 = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"]


def ko_count(n: int) -> str:
    """시간·번 같은 단위 앞 고유어 수 (4 → 네, 12 → 열두). 100 이상은 한자어."""
    if not 0 < n < 100:
        return ko_number(n)
    t, o = divmod(n, 10)
    word = _NATIVE10[t] + _NATIVE[o]
    return "스무" if n == 20 else word


def round_won(n: float) -> int:
    if n >= 10000:
        return int(round(n, -3))
    if n >= 1000:
        return int(round(n, -2))
    return max(10, int(round(n, -1)))


# ---------- 계산 카드 ----------
def calc_card(c: dict, price: int) -> dict:
    """Claude가 정한 조건으로 숫자는 코드가 계산한다."""
    kind = c.get("type")
    if kind == "power" and 0 < float(c.get("watts", 0)) <= 3000 and 0 < float(c.get("hours_per_day", 0)) <= 24:
        w, h = float(c["watts"]), float(max(1, round(float(c["hours_per_day"]))))
        month = round_won(w / 1000 * h * 30 * KRW_PER_KWH)
        return {"title": "한 달 전기요금", "value": f"약 {month:,}원",
                "sub": f"{w:g}W · 하루 {h:g}시간 · kWh당 약 {KRW_PER_KWH}원으로 계산",
                "say": f"하루 {ko_count(int(h))} 시간 쓰면 한 달 전기요금 약 {ko_number(month)} 원이에요."}
    if kind == "per_use" and 0 < float(c.get("uses_per_month", 0)) <= 300 and 0 < float(c.get("life_months", 0)) <= 120:
        n = float(c["uses_per_month"]) * float(c["life_months"])
        per = round_won(price / n)
        return {"title": "한 번 쓸 때 드는 돈", "value": f"약 {per:,}원",
                "sub": f"한 달 {c['uses_per_month']:g}번 · {c['life_months']:g}개월 쓴다고 계산",
                "say": f"한 달 {ko_count(int(c['uses_per_month']))} 번씩 쓰면 한 번에 약 {ko_number(per)} 원 꼴이에요."}
    months = float(c.get("life_months") or 12)
    months = min(max(months, 1), 120)
    day = round_won(price / (months * 30))
    return {"title": "하루로 나누면", "value": f"약 {day:,}원",
            "sub": f"{months:g}개월 쓴다고 계산",
            "say": f"{ko_number(int(months))} 개월 쓰면 하루 약 {ko_number(day)} 원 꼴이에요."}


# ---------- 상품 고르기 ----------
def known_ids() -> set[str]:
    ids = {json.loads(f.read_text(encoding="utf-8")).get("aliProductId", "") for f in PRODUCTS.glob("*.json")}
    if SKIPPED.exists():
        ids |= set(json.loads(SKIPPED.read_text(encoding="utf-8")))
    return ids


def remember_skip(pid: str) -> None:
    s = json.loads(SKIPPED.read_text(encoding="utf-8")) if SKIPPED.exists() else []
    SKIPPED.parent.mkdir(parents=True, exist_ok=True)
    SKIPPED.write_text(json.dumps(sorted(set(s) | {pid}), indent=1) + "\n", encoding="utf-8")


def pending_count() -> int:
    log = load_log(YT_LOG)
    return sum(1 for r in load_queue(QUEUE) if r["slug"] not in log)


# ---------- 글쓰기 (Claude API) ----------
PROMPT = """너는 생활용품 소개 쇼츠 채널 "돈 줍는 삼촌"의 작가다. 아래 알리익스프레스 상품의 판매자 표기만 보고 JSON 하나만 출력해라.

판매자 상품명: {title}
가격: {price:,}원 ({date} 기준)
판매량: {orders}개, 평점 {rating:.0f}%

규칙
- 판매자 상품명에 있는 사실만 쓴다. 없는 기능·수치·인증을 지어내지 않는다. 직접 써 봤다는 표현 금지.
- 건강·의료 효능, "최고/무조건/100%" 같은 과장 금지. 차분하고 고급스러운 말투.
- 의약품·의료기기·성인·무기·식품·화장품·유아 안전용품·전기 안전이 중요한 고전력 열기구·브랜드 모조품 의심이면 skip 에 이유를 쓴다.

출력 형식 (키 그대로)
{{
 "skip": "" 또는 "건너뛰는 이유",
 "slug": "영문 소문자-하이픈 30자 이내",
 "name": "한국어 상품명 22자 이내 (브랜드는 상품명에 있을 때만)",
 "category": "{cats} 중 하나",
 "title": "유튜브 제목 30자 이내, [광고] 빼고, 호기심 생기게",
 "hook": "첫 질문 한 문장 20자 이내 (상품명 없이, 생활 속 상황)",
 "intro": "상품 소개 내레이션 한 문장 28자 이내, '~예요' 체",
 "captions": ["사진 위 자막 14자 이내", "둘째", "셋째"],
 "note": "사이트 소개 글 60~120자: 어떤 사람에게 맞는지 + 판매량·평점 같은 근거 + 구매 전 주의점",
 "check": "구매 전 확인할 것 30자 이내",
 "lifeMonths": 사용 기간 개월 수(정수),
 "calc": {{"type": "power", "watts": 상품명에 적힌 W, "hours_per_day": 보통 사용 시간}}
         또는 {{"type": "per_use", "uses_per_month": 한 달 사용 횟수, "life_months": 개월}}
         또는 {{"type": "daily", "life_months": 개월}}
         (W가 상품명에 있을 때만 power)
}}"""


def write_copy(cand: dict, today: dt.date) -> dict:
    key = os.environ["ANTHROPIC_API_KEY"]
    body = {"model": ANTHROPIC_MODEL, "max_tokens": 1200,
            "messages": [{"role": "user", "content": PROMPT.format(
                title=cand["name"], price=cand["aliPrice"], date=f"{today:%m/%d}", orders=cand.get("orders", 0),
                rating=cand.get("rating", 0), cats=", ".join(CATEGORIES))}]}
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps(body).encode(), headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = "".join(b.get("text", "") for b in json.load(r)["content"])
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("JSON 응답 없음")
    return json.loads(m.group(0))


def check_copy(c: dict) -> list[str]:
    errs = []
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", c.get("slug", "")) or len(c["slug"]) > 40:
        errs.append("slug 형식")
    if c.get("category") not in CATEGORIES:
        errs.append("category")
    if len(c.get("captions") or []) != 3:
        errs.append("captions 3개")
    if len((c.get("note") or "").strip()) < 40:
        errs.append("note 40자 미만")
    for k, n in (("name", 30), ("title", 40), ("hook", 30), ("intro", 40)):
        if not (c.get(k) or "").strip() or len(c[k]) > n:
            errs.append(f"{k} 길이")
    text = " ".join([c.get(k, "") for k in ("name", "title", "hook", "intro", "note", "check")] + list(c.get("captions") or []))
    for p in BANNED_PATTERNS:
        if re.search(p, text):
            errs.append(f"금지 표현: {p}")
    if re.search(r"[<>]", text):
        errs.append("< > 사용")
    return errs


# ---------- 사진 ----------
def fetch_images(cli, pid: str, slug: str, n: int = 5) -> tuple[list[pathlib.Path], list[str]]:
    from .ali_gallery import gallery_urls
    out = ASSETS / slug
    out.mkdir(parents=True, exist_ok=True)
    paths, urls = [], gallery_urls(cli, pid)
    for i, u in enumerate(urls[:n], 1):
        dest = out / f"{i:02d}.jpg"
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            dest.write_bytes(urllib.request.urlopen(req, timeout=30).read())
            paths.append(dest)
        except Exception as e:
            print(f"사진 {i} 받기 실패: {e}")
        time.sleep(0.5)
    return paths, urls


# ---------- 목소리 ----------
def narrate(lines: list[str]) -> tuple[list, int]:
    """줄마다 따로 읽는다 (Supertonic 3, 7번 목소리, 정상 속도, 고음질 32단계)."""
    import numpy as np
    from supertonic import TTS
    tts = TTS()
    style = tts.get_voice_style(VOICE)
    clips = []
    for s in lines:
        wav, _ = tts.synthesize(s, voice_style=style, lang="ko", total_steps=32, speed=1.0)
        clips.append(wav.reshape(-1).astype(np.float32))
    return clips, tts.sample_rate


def scene_durs(clips: list, sr: int, n_photos: int) -> list[float]:
    d = [len(c) / sr + 0.45 for c in clips]
    d[1] = max(d[1], 1.6 * min(3, n_photos))  # 사진 2~3장은 보여 준다
    d[3] = max(d[3], 2.4)
    return d


def mix(clips: list, sr: int, durs: list[float], path: pathlib.Path) -> None:
    """각 줄을 해당 장면 시작(+0.15초)에 놓아 한 파일로."""
    import numpy as np
    a = np.zeros(int(sr * sum(durs)) + 1, dtype=np.float32)
    t = 0.0
    for c, d in zip(clips, durs):
        i = int(sr * (t + 0.15))
        a[i:i + len(c)] += c[: max(0, len(a) - i)]
        t += d
    a = (a / max(1e-6, float(np.abs(a).max())) * 0.9 * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(a.tobytes())


# ---------- 영상 ----------
def font(size: int):
    from PIL import ImageFont
    for f in (os.environ.get("VIDEO_FONT", ""), "/usr/share/fonts/truetype/nanum/NanumGothicExtraBold.ttf",
              "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf", "C:/Windows/Fonts/malgunbd.ttf"):
        if f and pathlib.Path(f).exists():
            return ImageFont.truetype(f, size)
    raise SystemExit("한글 폰트 없음 (fonts-nanum 설치 또는 VIDEO_FONT)")


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def cover(im, w: int, h: int, zoom: float = 1.0):
    from PIL import Image
    s = max(w / im.width, h / im.height) * zoom
    r = im.resize((max(w, round(im.width * s)), max(h, round(im.height * s))), Image.LANCZOS)
    x, y = (r.width - w) // 2, (r.height - h) // 2
    return r.crop((x, y, x + w, y + h))


def fit(im, w: int, h: int, zoom: float = 1.0):
    """사진 전체가 보이게(잘리지 않게) 흰 배경 위에."""
    from PIL import Image
    s = min(w / im.width, h / im.height) * zoom
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    bg = Image.new("RGB", (w, h), (246, 245, 242))
    bg.paste(r, ((w - r.width) // 2, (h - r.height) // 2))
    return bg


def lines_fit(dr, s: str, size: int, maxw: int, max_lines: int = 2):
    """글자 크기를 줄이며 최대 max_lines 줄로 나눈다."""
    while size > 28:
        f = font(size)
        words, rows, cur = s.split(" "), [], ""
        for wd in words:
            t = (cur + " " + wd).strip()
            if dr.textlength(t, font=f) <= maxw:
                cur = t
            else:
                rows.append(cur)
                cur = wd
        rows.append(cur)
        if len(rows) <= max_lines and all(dr.textlength(r, font=f) <= maxw for r in rows):
            return f, rows
        size -= 4
    return font(28), [s]


def center(dr, y: int, s: str, f, fill="white"):
    dr.text(((W - dr.textlength(s, font=f)) / 2, y), s, font=f, fill=fill)


def render(spec: dict, photos: list[pathlib.Path], voice: pathlib.Path, durs: list[float], out: pathlib.Path) -> float:
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
    imgs = [Image.open(p).convert("RGB") for p in photos]
    px, py, pw, ph = PHOTO
    d_hook, d_intro, d_calc, d_end = durs
    scenes = [("hook", d_hook), ("photos", d_intro), ("calc", d_calc), ("end", d_end)]
    total = sum(d for _, d in scenes)
    hook_bg = ImageEnhance.Brightness(cover(imgs[0], W, H).filter(ImageFilter.GaussianBlur(28))).enhance(0.35)
    end_bg = ImageEnhance.Brightness(cover(imgs[0], W, H).filter(ImageFilter.GaussianBlur(28))).enhance(0.3)
    show = imgs[:3]
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(voice),
                           "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-b:a", "128k", "-af", "apad", "-t", f"{total:.2f}", "-movflags", "+faststart", str(out)],
                          stdin=subprocess.PIPE)
    start = 0.0
    for kind, d in scenes:
        for i in range(round(d * FPS)):
            t = i / FPS
            k_in = ease(t / 0.35)
            if kind == "hook":
                cv = hook_bg.copy()
                dr = ImageDraw.Draw(cv)
                f, rows = lines_fit(dr, spec["hook"], 92, W - 140)
                y0 = H // 2 - len(rows) * 60 + int((1 - k_in) * 40)
                for j, r in enumerate(rows):
                    center(dr, y0 + j * 120, r, f)
            elif kind == "photos":
                seg = d / len(show)
                j = min(len(show) - 1, int(t / seg))
                tt = t - j * seg
                cv = Image.new("RGB", (W, H), BG)
                cv.paste(fit(show[j], pw, ph, 1 + 0.06 * tt / seg), (px, py))
                dr = ImageDraw.Draw(cv)
                cap = spec["captions"][j]
                f, rows = lines_fit(dr, cap, 66, W - 100, 1)
                center(dr, py + ph + 90 + int((1 - ease(tt / 0.3)) * 30), rows[0], f)
            elif kind == "calc":
                cv = Image.new("RGB", (W, H), (246, 245, 242))
                dr = ImageDraw.Draw(cv)
                small = fit(imgs[0], 420, 420)
                cv.paste(small, ((W - 420) // 2, 470))
                center(dr, 960, spec["calc"]["title"], font(56), "#5c5852")
                fv = font(132)
                center(dr, 1050 + int((1 - k_in) * 30), spec["calc"]["value"], fv, "#1f5f4a")
                f, rows = lines_fit(dr, spec["calc"]["sub"], 36, W - 120, 2)
                for j, r in enumerate(rows):
                    center(dr, 1240 + j * 50, r, f, "#8a857c")
            else:
                cv = end_bg.copy()
                dr = ImageDraw.Draw(cv)
                cv.paste(fit(imgs[0], 560, 560), ((W - 560) // 2, 420))
                f, rows = lines_fit(dr, spec["name"], 64, W - 120)
                for j, r in enumerate(rows):
                    center(dr, 1060 + j * 80, r, f)
                y = 1060 + len(rows) * 80 + 20
                center(dr, y, spec["price"], font(84), "#ffd166")
                center(dr, y + 120, "비교·계산은 don3chon.com", font(48), "#e8e2d6")
            dr = ImageDraw.Draw(cv)
            light = kind == "calc"
            center(dr, 120, "돈 줍는 삼촌", font(44), "#2b2a28" if light else "#e8e2d6")
            center(dr, 190, LABEL, font(32), "#6b6863" if light else "#cfc8bb")
            dr.rectangle((60, H - 90, 60 + (W - 120) * (start + t) / total, H - 84), fill="#d6452f")
            ff.stdin.write(cv.tobytes())
        start += d
    ff.stdin.close()
    if ff.wait():
        raise RuntimeError("ffmpeg 실패")
    return total


# ---------- 전체 ----------
def queue_row(spec: dict, order: int, today: dt.date) -> dict:
    return {"order": str(order), "slug": spec["slug"], "title": f"[광고] {spec['title']}",
            "intro": f"{spec['intro']} ({spec['aliPrice']:,}원)", "price_date": f"{today.month}/{today.day}"}


def append_queue(row: dict) -> None:
    with QUEUE.open("a", encoding="utf-8", newline="") as f:
        csv.DictWriter(f, fieldnames=["order", "slug", "title", "intro", "price_date"]).writerow(row)


def product_json(spec: dict, cand: dict, today: dt.date, gallery: list[str]) -> dict:
    return {"slug": spec["slug"], "category": spec["category"], "name": spec["name"],
            "aliProductId": cand["aliProductId"], "aliPrice": cand["aliPrice"], "aliUrl": cand["aliUrl"],
            "imageUrl": cand.get("imageUrl", ""), "coupangPrice": "", "coupangUrl": "", "shipDays": "",
            "lifeMonths": int(spec.get("lifeMonths") or 12), "priceDate": today.isoformat(),
            "note": spec["note"].strip(), "check": spec.get("check", ""), "commission": cand.get("commission", 0),
            "status": "active", "gallery": gallery, "source": "shorts-auto"}


def main() -> int:
    from .aliexpress import AliExpressClient
    from .curate import fetch_raw, pick_candidates
    from .drafts import parse_keywords
    today = dt.datetime.now(KST).date()
    buffer = int(os.environ.get("SHORTS_BUFFER") or 3)
    if pending_count() >= buffer:
        print(f"업로드 대기 {pending_count()}개 ≥ {buffer}, 오늘은 만들지 않음")
        return 0
    cli = AliExpressClient()
    known = known_ids()
    cands = [c for c in pick_candidates(fetch_raw(cli, parse_keywords(os.environ.get("ALI_KEYWORDS", ""))), k=40)
             if c["aliProductId"] not in known]
    for cand in cands[:5]:  # 부적합 판정이 나오면 다음 후보
        spec = write_copy(cand, today)
        if spec.get("skip"):
            print(f"건너뜀 {cand['aliProductId']}: {spec['skip']}")
            remember_skip(cand["aliProductId"])
            continue
        errs = check_copy(spec)
        if (PRODUCTS / f"{spec.get('slug')}.json").exists():
            spec["slug"] = f"{spec['slug']}-{cand['aliProductId'][-4:]}"
        if errs:
            print(f"문구 검사 실패 {cand['aliProductId']}: {errs}")
            remember_skip(cand["aliProductId"])
            continue
        photos, gallery = fetch_images(cli, cand["aliProductId"], spec["slug"])
        if len(photos) < 2:
            print(f"사진 부족 {cand['aliProductId']}")
            remember_skip(cand["aliProductId"])
            continue
        spec["aliPrice"] = cand["aliPrice"]
        spec["price"] = f"{cand['aliPrice']:,}원 ({today.month}/{today.day} 기준)"
        spec["calc"] = calc_card(spec.get("calc") or {}, cand["aliPrice"])
        lines = [spec["hook"], spec["intro"], spec["calc"]["say"], "비교는 돈줍는삼촌 닷컴에서."]
        MEDIA.mkdir(parents=True, exist_ok=True)
        out = MEDIA / f"{spec['slug']}.mp4"
        clips, sr = narrate(lines)
        durs = scene_durs(clips, sr, len(photos))
        with tempfile.TemporaryDirectory() as tmp:
            voice = pathlib.Path(tmp) / "voice.wav"
            mix(clips, sr, durs, voice)
            total = render(spec, photos, voice, durs, out)
        (PRODUCTS / f"{spec['slug']}.json").write_text(
            json.dumps(product_json(spec, cand, today, gallery), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        order = max([int(r["order"]) for r in load_queue(QUEUE)] or [0]) + 1
        append_queue(queue_row(spec, order, today))
        summary = (f"새 쇼츠: {spec['name']} ({total:.1f}초, {out.stat().st_size / 1e6:.1f}MB)\n"
                   f"- 제목: [광고] {spec['title']}\n- 내레이션: {' / '.join(lines)}\n- 사이트 소개: {spec['note']}")
        print(summary)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
                f.write(summary + "\n")
        return 0
    print("::warning::오늘 만들 수 있는 후보가 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
