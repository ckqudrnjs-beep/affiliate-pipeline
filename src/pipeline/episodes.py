"""돈 줍는 삼촌 유튜브 새 기획 (2026-11-11 BK 확정). plan/YOUTUBE_PLAN.md, docs/EPISODES.md

쇼츠는 매일 요일별 다른 형식, 롱폼은 주 2개(수·토). 대본은 Claude 예약 작업이 data/episodes/<id>.json 으로 쓰고,
이 모듈이 장면 목록을 영상으로 만든다(무료: 7번 목소리 + 사진·카드 + 재사용 삼촌 표정 영상).

    python -m pipeline.episodes next            # 다음에 써야 할 쇼츠 날짜·형식·규칙 (예약 작업이 읽음)
    python -m pipeline.episodes next-long       # 다음 롱폼 날짜·형식
    python -m pipeline.episodes check <파일>    # 대본 검사 (빈 목록이면 통과)
    python -m pipeline.episodes render [파일..] # 영상으로 (인자 없으면 아직 안 만든 것 모두)

장면(scenes) 종류: hook, photo, calc, versus, countdown, ox, counter, list, bars, chapter, uncle, skit, end
(skit = 삼촌 vs 조카 만화 상황극, pipeline/skit.py. 쇼츠 전용)
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import urllib.request

from .youtube import KST, MEDIA, load_log, load_queue

EP_DIR = pathlib.Path("data/episodes")
PRODUCTS = pathlib.Path("data/products")
ASSETS = pathlib.Path("video_assets")
CLIP_DIR = pathlib.Path("media/uncle")
CLIPS = pathlib.Path("config/heygen/clips.json")
FPS = 30
SR = 44100
AD_LABEL = "광고 · 알리익스프레스 제휴 링크"

# 요일(월=0) → 쇼츠 형식
SKIT_RULE = ("skit 장면 하나(lines 4~7줄)로 거의 전부 채운다: 1줄 = 첫 1초 안에 숫자가 보이는 질문·상황(cap 에 숫자), "
             "2줄 = 조카의 그럴듯한 오답·고집, 3줄 = sfx buzz + big(반전 숫자) + sub(가정), 이후 해결·펀치라인. "
             "상품은 마지막 1~2줄에만 prop product 로, 그 뒤 end. 조카는 시청자 대신 묻는 역할, 삼촌은 계산으로 답한다. "
             "마지막 줄은 웃기거나 첫 줄로 이어지게(다시 보게). "
             "skit 에 badge(첫 장면 노란 배지 = 썸네일, 6자 안팎 질문: \"세금 얼마?\")와 bg(room/office/store/door 중 주제에 맞게)를 꼭 넣고, "
             "포즈를 줄마다 바꾼다(삼촌 talk/wow/point/think/thumb/facepalm, 조카 talk/shock/cold/happy/think). ")
# 요일(월=0) → 쇼츠 형식. 2026-11-11 BK "지루하지 않게": 만화 상황극(조회수 10배)을 월·목·토, 사이 날은 카드형으로 번갈아.
SHORT_FORMATS = {
    0: ("skit-quiz", "삼촌 vs 조카 얼마게?", True,
        SKIT_RULE + "주제: A vs B 중 돈이 더 드는 쪽 맞히기 (예: 온풍기 vs 담요). 조카가 틀리고 삼촌이 숫자로 뒤집는다."),
    1: ("leak", "돈 새는 구멍", False,
        "상품 없음. 생활 속에서 모르고 새는 돈 1가지(대기전력, 구독료, 보일러 설정, 통신비 등)를 1년 금액으로. "
        "hook → list 또는 calc 2~3장 → counter(1년 금액) → end(사이트 계산기 안내). 시리즈 번호 series_no. "
        "중간에 2줄짜리 skit(조카: \"그게 얼마나 된다고?\")를 넣어도 된다."),
    2: ("teaser", "롱폼 예고", True,
        "이번 주 수요일 롱폼(살까 말까 저울)의 핵심 계산 하나만 쇼츠로. hook → versus 또는 bars → calc → uncle 반응 → "
        "end(\"전체 비교는 채널 롱폼에서\"). 롱폼 주제와 같은 상품."),
    3: ("skit-dont", "조카야 그거 사지 마", True,
        SKIT_RULE + "주제: 조카가 충동구매하려는 물건을 삼촌이 '이런 사람은 사지 마' 계산으로 말리고, 이런 사람만 사라고 정리. "
        "정직함이 핵심(단점·조건을 note·check 에서)."),
    4: ("ox", "착각 vs 현실 O/X", False,
        "상품 없음. 흔한 믿음 1개(예: 전기장판이 히터보다 무조건 싸다?) → ox(정답 공개) → calc로 반전 계산 → end."),
    5: ("skit-life", "삼촌 vs 조카 생활비", False,
        SKIT_RULE + "주제: 이번 주 토요일 롱폼(생활비 점검) 중 하나를 생활 상황극으로 (예: 조카가 배달 앱을 켜는 순간). "
        "상품 없이 해도 되고, 있으면 1개."),
    6: ("bank", "1년 뒤 통장", False,
        "상품 없음(또는 1개). '매일 ○○ 대신 △△ 하면 1년 뒤?' → counter(0에서 1년 금액까지 올라감) → calc(근거) → "
        "uncle(react-surprised) → end. 숫자는 보수적으로."),
}
LONG_FORMATS = {
    2: ("scale", "살까 말까 저울", True, 20,
        "7~8분. 같은 목적의 3가지 방법 총비용 비교(예: 전기요 vs 온수매트 vs 온풍기). chapter 5~6개: 질문 → 방법별 계산 → "
        "bars(총비용 비교) → 상황별 추천 → 주의점 → 마무리. 상품은 최대 3개, 설명란 링크."),
    5: ("checkup", "삼촌의 생활비 점검", False, 20,
        "6~8분. 이번 주 생활비 새는 구멍 5개 모음(상품 없거나 1~2개). chapter 마다 calc·counter·list. 마무리에 사이트 계산기."),
}

LONG_HOUR = 20  # 롱폼 공개 시각 (쇼츠 19:00 과 겹치지 않게)


# ---------- 일정 ----------
def ep_files() -> list[pathlib.Path]:
    return sorted(p for p in EP_DIR.glob("*.json") if not p.name.endswith(".meta.json"))


def pending_dates() -> list[dt.date]:
    """이미 대본이 있는 쇼츠 날짜."""
    out = []
    for p in ep_files():
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if d.get("kind", "short") == "short":
            out.append(dt.date.fromisoformat(d["date"]))
    return sorted(out)


def next_short_date(today: dt.date) -> dt.date:
    """다음에 대본이 필요한 쇼츠 공개일: 업로드 기록·대기열·대본 중 가장 늦은 날 + 1일 (최소 모레)."""
    last = today + dt.timedelta(days=1)
    for v in load_log().values():
        last = max(last, dt.datetime.fromisoformat(v["publish_at"]).astimezone(KST).date())
    log = load_log()
    pending = [r for r in load_queue() if r["slug"] not in log and not r.get("date")]
    last = last + dt.timedelta(days=len(pending))
    for d in pending_dates():
        last = max(last, d)
    return last + dt.timedelta(days=1)


def next_long_date(today: dt.date) -> dt.date:
    have = {json.loads(p.read_text(encoding="utf-8"))["date"] for p in ep_files()
            if json.loads(p.read_text(encoding="utf-8")).get("kind") == "long"}
    d = today + dt.timedelta(days=2)
    while d.weekday() not in LONG_FORMATS or d.isoformat() in have:
        d += dt.timedelta(days=1)
    return d


def products_with_photos() -> list[str]:
    return sorted(p.stem for p in PRODUCTS.glob("*.json")
                  if json.loads(p.read_text(encoding="utf-8")).get("status", "active") == "active")


def info_short(today: dt.date) -> dict:
    d = next_short_date(today)
    key, name, product, rules = SHORT_FORMATS[d.weekday()]
    used = [json.loads(p.read_text(encoding="utf-8")).get("product") for p in ep_files()]
    return {"date": d.isoformat(), "kind": "short", "format": key, "format_name": name, "product_allowed": product,
            "rules": rules, "file": f"data/episodes/{d.isoformat()}-{key}.json",
            "recent_products": [u for u in used if u][-10:],
            "products": products_with_photos(), "clips": sorted(k for k in clips_cfg())}


def info_long(today: dt.date) -> dict:
    d = next_long_date(today)
    key, name, product, _, rules = LONG_FORMATS[d.weekday()]
    return {"date": d.isoformat(), "kind": "long", "format": key, "format_name": name, "product_allowed": product,
            "rules": rules, "file": f"data/episodes/{d.isoformat()}-{key}.json",
            "products": products_with_photos(), "clips": sorted(k for k in clips_cfg())}


def clips_cfg() -> dict:
    if not CLIPS.exists():
        return {}
    return {k: v for k, v in json.loads(CLIPS.read_text(encoding="utf-8")).items() if not k.startswith("_")}


# ---------- 검사 ----------
TYPES = {"hook", "photo", "calc", "versus", "countdown", "ox", "counter", "list", "bars", "chapter", "uncle", "skit", "end"}
BANNED = ["써 봤", "써봤", "직접 사용", "무조건", "100%", "최고의", "완치", "효능"]


def check(spec: dict) -> list[str]:
    e = []
    kind = spec.get("kind", "short")
    if kind not in ("short", "long"):
        e.append("kind 는 short/long")
    try:
        dt.date.fromisoformat(spec.get("date", ""))
    except ValueError:
        e.append("date 형식 YYYY-MM-DD")
    title = spec.get("title", "").strip()
    has_ad = bool(spec.get("product") or spec.get("products"))
    if has_ad and not title.startswith("[광고]"):
        e.append("상품이 나오면 제목은 [광고]로 시작")
    if not has_ad and "[광고]" in title:
        e.append("상품이 없으면 [광고] 빼기")
    if not 4 <= len(title) <= 60:
        e.append("제목 4~60자")
    if "<" in title or ">" in title:
        e.append("제목에 < > 불가")
    scenes = spec.get("scenes") or []
    lim = (2, 14) if kind == "short" else (25, 120)
    if not lim[0] <= len(scenes) <= lim[1]:
        e.append(f"장면 수 {lim[0]}~{lim[1]}")
    if scenes and scenes[0].get("type") not in ("hook", "chapter", "ox", "versus", "skit"):
        e.append("첫 장면은 hook (인사·로고로 시작 금지)")
    clips = clips_cfg()
    for p in [spec.get("product")] + list(spec.get("products") or []):
        if p and not (PRODUCTS / f"{p}.json").exists():
            e.append(f"상품 없음: {p}")
    words = 0
    for i, s in enumerate(scenes):
        t = s.get("type")
        if t not in TYPES:
            e.append(f"장면 {i}: 종류 {t}")
            continue
        if t == "uncle":
            if s.get("clip") not in clips:
                e.append(f"장면 {i}: 삼촌 영상 이름 {s.get('clip')}")
            continue
        if t == "skit":
            from .skit import check_lines
            if kind != "short":
                e.append(f"장면 {i}: skit 은 쇼츠 전용")
            e.extend(f"장면 {i}: {x}" for x in check_lines(s.get("lines")))
            from .skit import BGS
            if s.get("bg", "room") not in BGS:
                e.append(f"장면 {i}: bg 는 {sorted(BGS)}")
            if any(ln.get("prop") == "product" for ln in s.get("lines") or []) and not spec.get("product"):
                e.append(f"장면 {i}: prop product 는 상품이 있어야")
            words += sum(len(ln.get("say", "")) for ln in s.get("lines") or [])
            for b in BANNED:
                if b in json.dumps(s, ensure_ascii=False):
                    e.append(f"장면 {i}: 금지 표현 '{b}'")
            continue
        say = s.get("say", "")
        if not say and t not in ("countdown",):
            e.append(f"장면 {i}: say 없음")
        words += len(say)
        if kind == "short" and len(say) > 42:
            e.append(f"장면 {i}: 쇼츠 한 장면 내레이션은 42자 이하 (2~3초마다 화면이 바뀌게 나눠 쓰기)")
        if t == "photo" and not (spec.get("product") or s.get("product")):
            e.append(f"장면 {i}: photo 는 상품이 있어야")
        if t == "versus" and not (s.get("a") and s.get("b")):
            e.append(f"장면 {i}: versus 에 a, b")
        if t == "ox" and s.get("answer") not in ("O", "X"):
            e.append(f"장면 {i}: ox answer 는 O/X")
        if t == "counter" and not isinstance(s.get("to"), (int, float)):
            e.append(f"장면 {i}: counter to 숫자")
        if t in ("list", "bars") and not s.get("items"):
            e.append(f"장면 {i}: items 없음")
        for b in BANNED:
            if b in say + json.dumps(s, ensure_ascii=False):
                e.append(f"장면 {i}: 금지 표현 '{b}'")
    chars = (110, 330) if kind == "short" else (1400, 9000)
    if not chars[0] <= words <= chars[1]:
        e.append(f"내레이션 글자 수 {words} (권장 {chars[0]}~{chars[1]})")
    if has_ad and not any(s.get("type") == "end" for s in scenes):
        e.append("상품 편은 end 장면(가격·사이트)")
    if not spec.get("description"):
        e.append("description (설명란 소개 1~3줄) 없음")
    return e


# ---------- 목소리 ----------
def tts(lines: list[str]):
    """빈 줄은 무음 (카운트다운 등)."""
    import numpy as np
    from .uncle import tts as _tts
    real = [x for x in lines if x.strip()]
    got = iter(_tts(real)) if real else iter([])
    return [next(got) if x.strip() else np.zeros(int(SR * 0.2), dtype=np.float32) for x in lines]


# ---------- 화면 ----------
class Canvas:
    def __init__(self, kind: str):
        self.long = kind == "long"
        self.W, self.H = (1920, 1080) if self.long else (1080, 1920)


def _font(n):
    from .shorts import font
    return font(n)


def _center(dr, x, y, s, f, fill="white"):
    dr.text((x - dr.textlength(s, font=f) / 2, y), s, font=f, fill=fill)


def _wrap(dr, s, size, maxw, max_lines=3):
    from .shorts import lines_fit
    return lines_fit(dr, s, size, maxw, max_lines)


def won(n: float) -> str:
    return f"{int(round(n)):,}원"


def photo_of(slug: str, ref) -> "Image":
    """video_assets/<slug>/<파일> 또는 gallery 순번(1부터). 없으면 받아 둔다."""
    from PIL import Image
    folder = ASSETS / slug
    if isinstance(ref, str) and (folder / ref).exists():
        return Image.open(folder / ref).convert("RGB")
    i = int(ref) if str(ref).isdigit() else 1
    dest = folder / f"{i:02d}.jpg"
    if not dest.exists():
        g = json.loads((PRODUCTS / f"{slug}.json").read_text(encoding="utf-8")).get("gallery") or []
        url = g[min(i, len(g)) - 1] if g else json.loads((PRODUCTS / f"{slug}.json").read_text(encoding="utf-8"))["imageUrl"]
        folder.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        dest.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    return Image.open(dest).convert("RGB")


def frame(cv: Canvas, spec: dict, s: dict, t: float, d: float, ctx: dict):
    """장면 s 의 t초 화면 (PIL Image)."""
    from PIL import Image, ImageDraw
    from .shorts import ease, fit
    W, H, L = cv.W, cv.H, cv.long
    k = ease(t / 0.35)
    typ = s["type"]
    dark, light, green, gold = (24, 60, 50), (246, 245, 242), (31, 92, 74), "#ffd166"
    bg = light if typ in ("calc", "versus", "bars", "list", "counter") else dark
    im = Image.new("RGB", (W, H), bg)
    dr = ImageDraw.Draw(im)
    ink = "#2b2a28" if bg == light else "white"
    top = 170 if not L else 120
    if typ in ("hook", "chapter", "countdown"):
        if ctx.get("hook_bg") is not None:
            im.paste(ctx["hook_bg"], (0, 0))
            dr = ImageDraw.Draw(im)
        if typ == "chapter" and s.get("no"):
            _center(dr, W / 2, H * 0.30, f"{s['no']}", _font(64 if L else 80), gold)
        text = s.get("text") or s.get("say")
        f, rows = _wrap(dr, text, 96 if L else 92, W - (300 if L else 140), 3)
        y0 = H // 2 - len(rows) * 60 + int((1 - k) * 40)
        for j, r in enumerate(rows):
            _center(dr, W / 2, y0 + j * 120, r, f)
        if typ == "countdown":
            n = max(1, 3 - int(t))
            _center(dr, W / 2, H * 0.68, str(n), _font(220), gold)
    elif typ == "photo":
        img = ctx["photos"][id(s)]
        if L:
            im.paste(fit(img, 1000, 860, 1 + 0.05 * t / d), (80, 140))
            f, rows = _wrap(dr, s.get("cap", ""), 64, 700, 3)
            for j, r in enumerate(rows):
                dr.text((1140, 380 + j * 90 + int((1 - k) * 20)), r, font=f, fill=gold)
        else:
            im.paste(fit(img, 980, 980, 1 + 0.06 * t / d), (50, 380))
            f, rows = _wrap(dr, s.get("cap", ""), 72, W - 100, 1)
            _center(dr, W / 2, 1440 + int((1 - k) * 30), rows[0], f, gold)
    elif typ == "calc":
        _center(dr, W / 2, H * (0.30 if L else 0.36), s.get("title", ""), _font(56), "#5c5852")
        _center(dr, W / 2, H * (0.40 if L else 0.42) + int((1 - k) * 30), s.get("value", ""), _font(150 if L else 132), "#1f5f4a")
        f, rows = _wrap(dr, s.get("sub", ""), 36, W - 160, 2)
        for j, r in enumerate(rows):
            _center(dr, W / 2, H * (0.62 if L else 0.56) + j * 50, r, f, "#8a857c")
    elif typ == "versus":
        a, b = s["a"], s["b"]
        hide = s.get("hide")
        for n, (side, col) in enumerate(((a, "#1f5f4a"), (b, "#d6452f"))):
            if L:
                cx, cy = W * (0.27 + 0.46 * n), H * 0.30
            else:
                cx, cy = W / 2, H * (0.24 + 0.36 * n)
            f, rows = _wrap(dr, side["label"], 64, (W / 2 - 80) if L else W - 140, 2)
            for j, r in enumerate(rows):
                _center(dr, cx, cy + j * 80, r, f, "#2b2a28")
            val = "?" if hide else side.get("value", "")
            _center(dr, cx, cy + len(rows) * 80 + 30 + int((1 - k) * 20), val, _font(110), col)
        _center(dr, W / 2, H * (0.45 if L else 0.50) - 40, "VS", _font(80), "#8a857c")
    elif typ == "ox":
        f, rows = _wrap(dr, s.get("claim", s.get("say", "")), 78, W - 160, 3)
        for j, r in enumerate(rows):
            _center(dr, W / 2, H * 0.26 + j * 100, r, f)
        if t > min(1.6, d * 0.5):
            kk = ease((t - min(1.6, d * 0.5)) / 0.3)
            _center(dr, W / 2, H * 0.55 - int((1 - kk) * 40), s["answer"], _font(360), "#7bd389" if s["answer"] == "O" else "#ff6b5b")
        else:
            _center(dr, W / 2, H * 0.58, "O / X ?", _font(140), "#cfc8bb")
    elif typ == "counter":
        _center(dr, W / 2, H * 0.30, s.get("label", ""), _font(60), "#5c5852")
        v = s.get("from", 0) + (s["to"] - s.get("from", 0)) * ease(min(1, t / max(0.8, d - 0.8)))
        _center(dr, W / 2, H * 0.42, f"{int(v):,}{s.get('unit', '원')}", _font(150 if L else 130), "#1f5f4a")
        if s.get("sub"):
            f, rows = _wrap(dr, s["sub"], 36, W - 160, 2)
            for j, r in enumerate(rows):
                _center(dr, W / 2, H * 0.58 + j * 50, r, f, "#8a857c")
    elif typ == "list":
        _center(dr, W / 2, H * (0.16 if L else 0.18), s.get("title", ""), _font(70), "#1f5f4a")
        items = s["items"]
        step = d / (len(items) + 1)
        for j, it in enumerate(items):
            if t < step * j * 0.8:
                break
            f, rows = _wrap(dr, f"{j + 1}. {it}", 60 if L else 56, W - 200, 2)
            for r_i, r in enumerate(rows):
                dr.text((140 if L else 90, H * (0.30 if L else 0.30) + j * (150 if L else 190) + r_i * 70), r, font=f, fill="#2b2a28")
    elif typ == "bars":
        _center(dr, W / 2, H * 0.10 if L else H * 0.15, s.get("title", ""), _font(64), "#1f5f4a")
        items = s["items"]
        mx = max(x["value"] for x in items) or 1
        bw = (W * 0.55) if L else (W - 200)
        for j, it in enumerate(items):
            y = (H * 0.25 if L else H * 0.28) + j * (150 if L else 220)
            dr.text((100, y), it["label"], font=_font(48), fill="#2b2a28")
            ln = bw * it["value"] / mx * ease(min(1, (t - 0.2 * j) / 0.8))
            dr.rounded_rectangle((100, y + 64, 100 + max(8, ln), y + 120), 12, fill="#1f5f4a" if j else "#d6452f")
            dr.text((110 + max(8, ln), y + 64), it.get("text", won(it["value"])), font=_font(48), fill="#2b2a28")
    elif typ == "end":
        if ctx.get("end_img") is not None:
            im.paste(ctx["end_img"], (0, 0))
            dr = ImageDraw.Draw(im)
        else:
            f, rows = _wrap(dr, s.get("text", "계산은 don3chon.com"), 80, W - 160, 2)
            for j, r in enumerate(rows):
                _center(dr, W / 2, H * 0.40 + j * 100, r, f, "white")
            _center(dr, W / 2, H * 0.40 + len(rows) * 100 + 40, "don3chon.com", _font(56), "#ffd166")
    # 위 막대
    bar = 150 if not L else 100
    dr.rectangle([0, 0, W, bar], fill=green)
    if L:
        dr.text((40, 22), "돈 줍는 삼촌", font=_font(46), fill="white")
        if ctx["ad"]:
            f = _font(30)
            dr.text((W - 40 - dr.textlength(AD_LABEL, font=f), 34), AD_LABEL, font=f, fill="#e1f0e6")
    else:
        _center(dr, W / 2, 22, "돈 줍는 삼촌", _font(46))
        _center(dr, W / 2, 90, AD_LABEL if ctx["ad"] else ctx["series"], _font(32), "#e1f0e6")
    if ctx.get("series") and ctx["ad"] and not L:
        pass
    # 진행 막대 (쇼츠)
    if not L:
        dr.rectangle((60, H - 60, 60 + (W - 120) * ctx["progress"], H - 54), fill="#d6452f")
    return im


def end_card_img(cv: Canvas, spec: dict):
    """상품 편 마지막: 상품 사진 + 가격(날짜) + don3chon.com."""
    from PIL import Image, ImageDraw
    from .shorts import fit
    W, H = cv.W, cv.H
    p = json.loads((PRODUCTS / f"{spec['product']}.json").read_text(encoding="utf-8"))
    im = Image.new("RGB", (W, H), (24, 60, 50))
    dr = ImageDraw.Draw(im)
    cut = ASSETS / p["slug"] / "cutout.png"
    if cut.exists():
        c = Image.open(cut).convert("RGBA")
        c.thumbnail((760, 560) if not cv.long else (760, 700))
        pos = ((W - c.width) // 2, 700 - c.height // 2) if not cv.long else (480 - c.width // 2, 560 - c.height // 2)
        im.paste(c, pos, c)
    else:
        im.paste(fit(photo_of(p["slug"], 1), 700, 700), ((W - 700) // 2, 300) if not cv.long else (130, 200))
    cx, y = (W / 2, 1060) if not cv.long else (1400, 300)
    _center(dr, cx, y, p["name"].split(" (")[0][:22], _font(58), "white")
    _center(dr, cx, y + 110, won(p["aliPrice"]), _font(110), "#ffd166")
    d = p.get("priceDate", "")
    _center(dr, cx, y + 250, f"{d[5:7].lstrip('0')}월 {d[8:10].lstrip('0')}일 기준 알리익스프레스 가격", _font(34), "#cfe0d8")
    _center(dr, cx, y + 340, "비교·계산은 don3chon.com", _font(56), "white")
    return im


def uncle_part(cv: Canvas, name: str, line: str, ad: bool, out: pathlib.Path, tmp: pathlib.Path) -> None:
    """재사용 삼촌 영상 + 자막 + 'AI로 만든 가상 인물'. 롱폼은 가운데에 세로 영상, 양옆은 흐린 배경."""
    from PIL import Image, ImageDraw
    W, H = cv.W, cv.H
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    bar = 150 if not cv.long else 100
    dr.rectangle([0, 0, W, bar], fill=(31, 92, 74, 255))
    if cv.long:
        dr.text((40, 22), "돈 줍는 삼촌", font=_font(46), fill="white")
    else:
        _center(dr, W / 2, 22, "돈 줍는 삼촌", _font(46))
        if ad:
            _center(dr, W / 2, 90, AD_LABEL, _font(32), "#e1f0e6")
    f, rows = _wrap(dr, line, 60 if not cv.long else 52, (W - 120) if not cv.long else 1000, 2)
    y = H - (440 if not cv.long else 250)
    for j, r in enumerate(rows):
        tw = dr.textlength(r, font=f)
        dr.rounded_rectangle(((W - tw) / 2 - 20, y + j * 84 - 8, (W + tw) / 2 + 20, y + j * 84 + 72), 16, fill=(0, 0, 0, 200))
        _center(dr, W / 2, y + j * 84, r, f)
    t2, f2 = "AI로 만든 가상 인물", _font(30)
    tw = dr.textlength(t2, font=f2)
    yy = H - (150 if not cv.long else 80)
    dr.rounded_rectangle(((W - tw) / 2 - 18, yy, (W + tw) / 2 + 18, yy + 50), 14, fill=(0, 0, 0, 160))
    _center(dr, W / 2, yy + 5, t2, f2)
    p = tmp / f"ov-{name}-{cv.W}.png"
    ov.save(p)
    if cv.long:
        vf = ("[0:v]split[x][y];[x]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=30:5[bg];"
              "[y]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,fps=30,setsar=1[a];[a][1:v]overlay=0:0[v]")
    else:
        vf = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[a];[a][1:v]overlay=0:0[v]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(CLIP_DIR / f"{name}.mp4"), "-i", str(p),
                    "-filter_complex", vf + ";[0:a]aresample=44100,aformat=channel_layouts=mono[au]",
                    "-map", "[v]", "-map", "[au]", "-c:v", "libx264", "-crf", "21", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", str(out)], check=True)


def scene_part(cv: Canvas, spec: dict, scenes: list[dict], voices: list, ctx: dict, out: pathlib.Path, tmp: pathlib.Path,
               t0: float, total: float) -> None:
    import numpy as np
    from .uncle import write_wav
    mins = {"countdown": 3.3, "counter": 3.0, "ox": 3.2, "list": 3.5, "bars": 3.5, "versus": 2.6, "hook": 1.8}
    durs = [max(len(a) / SR + 0.45, mins.get(s["type"], 1.6)) for s, a in zip(scenes, voices)]
    audio = np.zeros(int(SR * sum(durs)) + SR, dtype=np.float32)
    t = 0.0
    for a, d in zip(voices, durs):
        i = int(SR * (t + 0.15))
        audio[i:i + len(a)] += a
        t += d
    wav = tmp / f"{out.stem}.wav"
    write_wav(audio, wav)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{cv.W}x{cv.H}", "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264",
                           "-crf", "21", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                           "-ar", str(SR), "-ac", "1", "-t", f"{sum(durs):.2f}", str(out)], stdin=subprocess.PIPE)
    start = t0
    for s, d in zip(scenes, durs):
        for i in range(round(d * FPS)):
            ctx["progress"] = min(1.0, (start + i / FPS) / total)
            ff.stdin.write(frame(cv, spec, s, i / FPS, d, ctx).tobytes())
        start += d
    ff.stdin.close()
    if ff.wait():
        raise RuntimeError("ffmpeg 실패")
    ctx["durs"].extend(durs)


def render(path: pathlib.Path) -> pathlib.Path:
    from PIL import ImageEnhance, ImageFilter
    from .shorts import cover
    spec = json.loads(path.read_text(encoding="utf-8"))
    errs = check(spec)
    if errs:
        raise SystemExit(f"{path}: {errs}")
    cv = Canvas(spec.get("kind", "short"))
    product = spec.get("product")
    ad = bool(product or spec.get("products"))
    clips = clips_cfg()
    ctx = {"ad": ad, "series": f"{spec.get('format_name', '')} #{spec['series_no']}" if spec.get("series_no") else spec.get("format_name", ""),
           "photos": {}, "durs": [], "progress": 0.0}
    for s in spec["scenes"]:
        if s["type"] == "photo":
            ctx["photos"][id(s)] = photo_of(s.get("product") or product, s.get("photo", 1))
    if product:
        ctx["hook_bg"] = ImageEnhance.Brightness(cover(photo_of(product, 1), cv.W, cv.H).filter(ImageFilter.GaussianBlur(28))).enhance(0.32)
        ctx["end_img"] = end_card_img(cv, spec)
    # 연속된 일반 장면은 한 덩어리, 삼촌 장면은 따로
    groups: list[tuple[str, list[dict]]] = []
    for s in spec["scenes"]:
        k = s["type"] if s["type"] in ("uncle", "skit") else "scene"
        if k == "scene" and groups and groups[-1][0] == "scene":
            groups[-1][1].append(s)
        else:
            groups.append((k, [s]))
    lines = [s.get("say", "") for s in spec["scenes"] if s["type"] not in ("uncle", "skit")]
    voices = iter(tts(lines))
    est = sum({"uncle": 3.5, "skit": 3.0 * len(s.get("lines") or [])}.get(s["type"], 4.0) for s in spec["scenes"])
    slug = spec.get("slug") or f"ep-{path.stem}"
    out = MEDIA / f"{slug}.mp4"
    MEDIA.mkdir(parents=True, exist_ok=True)
    chapters, t_acc = [], 0.0
    with tempfile.TemporaryDirectory() as tmpd:
        tmp = pathlib.Path(tmpd)
        parts = []
        for n, (k, ss) in enumerate(groups):
            part = tmp / f"part{n:03d}.mp4"
            if k == "uncle":
                uncle_part(cv, ss[0]["clip"], clips[ss[0]["clip"]]["say"], ad, part, tmp)
                dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                            str(part)], capture_output=True, text=True).stdout.strip() or 3)
                t_acc += dur
            elif k == "skit":
                from .skit import render_part
                cut = ASSETS / (product or "") / "cutout.png"
                img = None
                if product:  # 배경 없는 상품 사진(cutout)이 있으면 그걸로 (광고 배너 글씨가 덜 보이게)
                    if cut.exists() and "photo" not in ss[0]:
                        from PIL import Image
                        c = Image.open(cut).convert("RGBA")
                        img = Image.new("RGB", c.size, "white")
                        img.paste(c, mask=c)
                    else:
                        img = photo_of(product, ss[0].get("photo", 1))
                t_acc += render_part(ss[0]["lines"], ad, part, tmp, img, progress=lambda x, t0=t_acc: min(1.0, (t0 + x) / est),
                                     bg=ss[0].get("bg", "room"), badge=ss[0].get("badge"))
            else:
                before = len(ctx["durs"])
                vs = [next(voices) for _ in ss]
                scene_part(cv, spec, ss, vs, ctx, part, tmp, t_acc, est)
                for s, d in zip(ss, ctx["durs"][before:]):
                    if s["type"] == "chapter":
                        chapters.append((t_acc, s.get("text") or s.get("say")))
                    t_acc += d
            parts.append(part)
        inputs = sum((["-i", str(x)] for x in parts), [])
        fc = "".join(f"[{i}:v][{i}:a]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=1[v][a]"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                        "-c:v", "libx264", "-crf", "22", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac",
                        "-b:a", "128k", "-movflags", "+faststart", str(out)], check=True)
    meta = {"slug": slug, "seconds": round(t_acc, 1), "chapters": [[round(a, 1), b] for a, b in chapters]}
    path.with_suffix(".meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"완성: {out} ({t_acc:.1f}초, {out.stat().st_size / 1e6:.1f}MB)")
    return out


def unrendered() -> list[pathlib.Path]:
    """대본은 있는데 아직 영상(meta)이 없는 것."""
    return [p for p in ep_files() if not p.with_suffix(".meta.json").exists()]


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "render"
    today = dt.datetime.now(KST).date()
    if cmd == "next":
        print(json.dumps(info_short(today), ensure_ascii=False, indent=1))
    elif cmd == "next-long":
        print(json.dumps(info_long(today), ensure_ascii=False, indent=1))
    elif cmd == "check":
        for f in argv[1:]:
            print(f, check(json.loads(pathlib.Path(f).read_text(encoding="utf-8"))))
    elif cmd == "render":
        files = [pathlib.Path(f) for f in argv[1:]] or unrendered()
        kind = os.environ.get("EP_KIND")
        for f in files:
            if kind and json.loads(f.read_text(encoding="utf-8")).get("kind", "short") != kind:
                continue
            render(f)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
