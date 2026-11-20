"""5락실 채널 쇼츠: 오늘의 밸런스게임 자동 제작 + 자동 업로드 (2026-11-13 BK 요청).

- 질문: playground/data/questions.json 에서 오늘(KST) 날짜의 첫 질문.
- 어제 질문의 실제 투표 수(https://5raksil.com/api/vote)가 20표 이상이면 결과 공개 장면을 넣는다(실제 숫자만).
- 화면: 사이트와 같은 네온 오락실 스타일, 1080x1920. 위쪽 검은 제목 띠 두 줄(11/20). 2026-11-20 1안(BK 선택): 첫 1초 몽글이가 두 선택지 사이에서 고민 →
  3·2·1 → 반전(실제 투표 % 막대 > 몽글이의 선택) → 'B를 고른 나:' 반응 컷, 약 10초 + 공통 엔딩 2.6초.
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


# 2026-11-20 분석: 생활 공감 질문(월급·음식·카톡·주말)은 약 1,100회, 식상한 고전(부먹찍먹 221)·특정 게임 질문
# (포트나이트 vs 로블록스 249)은 약했다 → 쇼츠에는 그날 질문 중 생활 공감 질문을 고른다(사이트 질문은 그대로).
GAME_WORDS = ("게임", "배그", "마크", "마인크래프트", "포트나이트", "로블록스", "롤 ", "리그 오브", "오버워치", "발로란트",
              "메이플", "피파", "스팀", "닌텐도", "플스", "스위치", "모바일 게임")
STALE = ("부먹", "찍먹", "민초", "짜장", "짬뽕", "물냉", "비냉", "탕수육")
SHORT_LEN = 44  # A+B 글자 수가 이보다 길면 첫 1초에 다 못 읽는다


def shorts_penalty(q: dict) -> tuple[int, int]:
    t = f"{q.get('a', '')} {q.get('b', '')}"
    bad = int(any(w in t for w in GAME_WORDS)) + int(any(w in t for w in STALE))
    return bad, int(len(q.get("a", "")) + len(q.get("b", "")) > SHORT_LEN)


def pick_question(qs: list[dict], day: dt.date, for_shorts: bool = False) -> dict | None:
    today = sorted((q for q in qs if q.get("date") == day.isoformat()), key=lambda q: q["id"])
    if for_shorts and today:
        return min(today, key=lambda q: (shorts_penalty(q), q["id"]))
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


def winner(res: dict) -> tuple[str, int]:
    return (res["a"], res["pa"]) if res["pa"] >= res["pb"] else (res["b"], res["pb"])


# 2026-11-20 BK: "사람들이 투표를 잘 안 남겨서 % 결과가 안 나올 것" → D1 확인 결과 질문당 1~3표.
# 반전은 '몽글이의 선택 + 엉뚱한 이유'(캐릭터 의견, 통계 아님)로 하고, 실제 투표가 20표 넘는 날만 %를 보여 준다.
WHY_MAX = 20
BANNED_WHY = ("http", "#", "구독", "좋아요", "광고", "할인", "특가", "%", "퍼센트")
MONGLE_SYS = """너는 유튜브 쇼츠 '5락실 밸런스게임'의 마스코트 몽글이(동글동글한 새싹 요정, 귀엽고 엉뚱함)다.
오늘 질문 A/B 중 하나를 고르고, 피식 웃게 되는 엉뚱하지만 공감 가는 이유를 한 줄로 말한다.
규칙: 이유는 공백 포함 20자 이하 한국어 반말, 숫자·통계·퍼센트 금지(몽글이 개인 의견일 뿐), 특정 사람·브랜드·게임 이름 금지,
비하·혐오·선정·위험한 행동 금지, 이모지·해시태그 금지. 예) A "이불 밖은 위험하니까", B "브런치는 사진이 반이야"."""


BAND_SYS = """\n\n[제목 띠] 화면 맨 위 검은 띠에 들어갈 두 줄 제목 후보 3개도 낸다(BK 11/20, 5락실 분야 잘 된 쇼츠 패턴).
top(흰 줄) = 보는 사람에게 거는 도전·궁금증, accent(노란 줄) = 무엇인지·결론. 각 12자 이하, 숫자·퍼센트·가짜 통계 금지
("한국인 99%" "상위 10%" 같은 말 금지), 지능·외모 비하 금지, 광고 말 금지. 오늘 질문에 맞춰 구체적으로.
예) top "고민 없이 고르면" accent "찐 어른 인정" / top "친구랑 꼭 갈리는" accent "라면 vs 치킨".
각 후보에 click(0~10, 스크롤을 멈추고 누를 확률을 깐깐하게) 점수를 매긴다."""


def mongle_memory(n: int = 5, log: pathlib.Path | None = None) -> str:
    """몽글이의 지난 선택 n개 (BK 11/20 '빌드업'): 캐릭터 성격이 이어지고 가끔 지난 선택을 받아치게. 업로드 기록에서 읽는다."""
    try:
        up = json.loads((log or LOG).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    rows = []
    for k in sorted(up, reverse=True):
        v = up[k]
        if isinstance(v, dict) and isinstance(v.get("pick"), dict) and v.get("a") and v.get("b"):
            side = v["a"] if v["pick"].get("pick") == "a" else v["b"]
            rows.append(f"{k[:10]} '{v['a']} vs {v['b']}' → {side} (\"{v['pick'].get('why', '')}\")")
        if len(rows) >= n:
            break
    if not rows:
        return ""
    return ("[몽글이의 지난 선택 — 성격이 이어지게. 같은 이유·같은 말투 반복 금지, 어울리면 지난 선택을 살짝 받아치는 농담(예: '어제는 라면 골랐지만')]\n"
            + "\n".join(rows) + "\n\n")


def mongle_plan(q: dict) -> tuple[dict | None, dict | None]:
    """Claude API 한 번으로 (몽글이의 선택, 제목 띠). 키가 없거나 실패면 (None, None) → 띠는 문구 은행에서."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None, None
    try:
        from . import claude_jobs as cj
        from .yt_early import lessons_prompt
        rules = lessons_prompt("5락실 밸런스")  # 공개 2시간 반응 → 다음 편 규칙 (PR #283)
        rules += mongle_memory()
        recent = recent_bands()
        if recent:  # 반복 양산 막기: 직전 3편 띠와 같은 말·같은 틀 금지 (BK 11/20)
            rules += "직전 3편 제목 띠(같은 말·같은 문장 틀 금지, 완전히 다른 각도로): " + " / ".join(recent) + "\n\n"
        bands = cj.arr(cj.obj({"top": cj.S, "accent": cj.S, "click": {"type": "integer"}}))
        r = cj.ask("raksil", MONGLE_SYS + BAND_SYS, (rules + f"A: {q['a']}\nB: {q['b']}").strip(), model=cj.SONNET,
                   effort="low", max_tokens=700, need=0.03,
                   schema=cj.obj({"pick": {"type": "string", "enum": ["a", "b"]}, "why": cj.S, "bands": bands}))
    except Exception as e:  # 예산·네트워크·거절 → 반전 없이 '정답은 없다'
        print(f"몽글이의 선택 실패: {e}", file=sys.stderr)
        return None, None
    return clean_pick(r), best_band(r.get("bands") if isinstance(r, dict) else None, recent_bands())


def mongle_pick(q: dict) -> dict | None:
    """몽글이의 선택 {pick: a|b, why}만. 키가 없거나 실패·규칙 위반이면 None."""
    return mongle_plan(q)[0]


def clean_pick(r) -> dict | None:
    if not isinstance(r, dict) or r.get("pick") not in ("a", "b"):
        return None
    why = " ".join(str(r.get("why", "")).split()).strip(" .!")
    if not why or len(why) > WHY_MAX or any(w in why for w in BANNED_WHY):
        return None
    return {"pick": r["pick"], "why": why}


def script(q: dict, res: dict | None, pick: dict | None = None) -> list[str]:
    """장면별 대사 (빈 문자열 = 대사 없음). 2026-11-20 1안: 질문 → 3·2·1 → 반전. 구독 한 줄은 공통 엔딩이 맡는다.
    반전 우선순위: 실제 투표 20표 이상 > 몽글이의 선택 > 정답은 없다."""
    # 11/20 길이 상한: 선택지 글자는 화면에 있으니 반전 대사는 '에이/비'로 짧게, 긴 질문은 '너라면?' 생략.
    say = {"a": "에이", "b": "비"}
    if res:
        win, pct = winner(res)
        mid = f"어제는 {pct}퍼센트가 {say['a' if win == res['a'] else 'b']}! 너는?"
    elif pick:
        mid = f"몽글이는 {say[pick['pick']]}! {pick['why']}."
    else:
        mid = "정답은 없어! 댓글로 에이, 비!"
    n = len(q["a"]) + len(q["b"])
    if n > LONG_Q:  # 아주 긴 질문은 화면 글자에 맡기고 짧게 (다 읽으면 5초가 넘음)
        first = "에이야, 비야? 3초 안에 골라!"
    else:
        first = f"{q['a']}. 대. {q['b']}." + ("" if n > 24 else " 너라면?")
    return [first, "", mid]


def title_of(q: dict, band: dict | None = None) -> str:
    """2026-11-20: 제목도 띠처럼 보는 사람에게 도전 ("고민 없이 고르면 찐 어른 인정 | A vs B")."""
    hook = f"{band['top']} {band['accent']} | " if band else ""
    t = f"{hook}{q['a']} vs {q['b']} #밸런스게임 #shorts" if hook else f"{q['a']} vs {q['b']} 너라면? #밸런스게임 #shorts"
    if len(t) > 100:
        t = f"{hook}{q['a'][:28]} vs {q['b'][:28]} #밸런스게임"
    return t[:100]


def description_of(q: dict, res: dict | None, ai_voice: bool, pick: dict | None = None) -> str:
    lines = [f"오늘의 밸런스게임: {q['a']} vs {q['b']}", "",
             f"▶ 투표하고 실제 결과 보기: {SITE}/q/{q['id']}", f"▶ 매일 새 질문·틀린그림찾기·초성퀴즈: {SITE}",
             "▶ 매일 17시 새 밸런스게임은 구독으로", ""]
    if res:
        lines += [f"어제 결과({res['n']}표): {res['a']} {res['pa']}% / {res['b']} {res['pb']}%", ""]
    elif pick:
        lines += [f"몽글이의 선택: {q[pick['pick']]} (\"{pick['why']}\", 몽글이 개인 의견) 너는?", ""]
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


def no_middot(s: str) -> str:
    """Black Han Sans 에는 가운뎃점(·) 글자가 없어 빈칸으로 나온다 (2026-11-20 확인) → 쉼표로."""
    return s.replace(" · ", ", ").replace("·", ", ")


def glow_text(img, xy_center, lines: list[str], f, size: int, color, glow: int = 18, stroke: int = 0):
    """네온 글씨: 흐린 빛 + 본 글씨."""
    from PIL import Image, ImageDraw, ImageFilter
    lines = [no_middot(ln) for ln in lines]
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


# ---------- 제목 띠 (2026-11-20 BK: 5락실 분야 잘 된 쇼츠 패턴) ----------
# 위쪽 검은 띠 + 두 줄 제목(흰 줄 = 보는 사람에게 거는 도전, 노란 줄 = 무엇인지). 처음부터 반응 컷까지 깔고 엔딩엔 없다.
# 가짜 통계 금지: "한국인 99%는" 같은 숫자는 실제 투표(20표 이상)가 없으면 쓰지 않는다 → 숫자·% 없는 도전형만.
BAND_H, BAND_SIZE, BAND_MAX = 330, 100, 12
JUA = pathlib.Path(__file__).resolve().parents[2] / "config/fonts/Jua-Regular.ttf"  # 삼촌 띠와 같은 주아체
BAND_BANK = [("3초 안에 고르면", "결단력 인정"), ("친구랑 꼭 갈리는", "밸런스게임"), ("의외로 정답이", "둘로 나뉜다"),
             ("고민 없이 고르면", "찐 어른 인정"), ("이거 바로 고르면", "직진형 인간"), ("댓글 싸움 나는", "밸런스게임"),
             ("1초 만에 고르면", "눈치 백단"), ("둘 다 싫으면", "댓글로 항의")]
BANNED_BAND = BANNED_WHY + ("상위", "천재", "지능", "아이큐", "IQ", "한국인", "99", "1등")


def band_font(size: int):
    from PIL import ImageFont
    return ImageFont.truetype(str(JUA), size) if JUA.exists() else font(size)


def clean_band(b) -> dict | None:
    """Claude 가 낸 띠 문구 검사: 두 줄 다 있고, 12자 이하, 숫자·통계·광고·지능 비하 없이."""
    if not isinstance(b, dict):
        return None
    top, acc = (" ".join(str(b.get(k, "")).split()).strip(" .") for k in ("top", "accent"))
    for t in (top, acc):
        if not t or len(t) > BAND_MAX or any(w in t for w in BANNED_BAND) or any(c.isdigit() for c in t):
            return None
    return {"top": top, "accent": acc}


def best_band(cands, recent: list[str] | None = None) -> dict | None:
    """후보 중 규칙을 지키고 직전 3편 띠와 겹치지 않는 것 가운데 클릭 점수(click 0~10)가 가장 높은 것."""
    ok = [(c.get("click", 0) if isinstance(c.get("click", 0), (int, float)) else 0, i, clean_band(c))
          for i, c in enumerate(cands or []) if isinstance(c, dict)]
    ok = [x for x in ok if x[2] and fresh_band(x[2], recent or [])]
    return max(ok, key=lambda x: (x[0], -x[1]))[2] if ok else None


def recent_bands(n: int = 3, log: pathlib.Path | None = None) -> list[str]:
    """직전 n편 밸런스 쇼츠 제목 앞의 띠 문구('흰 줄 노란 줄'). 같은 말·같은 틀 반복 금지용."""
    try:
        up = json.loads((log or LOG).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    out = []
    for k in sorted(up, reverse=True):
        t = up[k].get("title", "") if isinstance(up[k], dict) else ""
        if "-game-" in k or "meme" in k or " | " not in t:
            continue
        out.append(t.split(" | ")[0].strip())
        if len(out) >= n:
            break
    return out


def fresh_band(b: dict | None, recent: list[str]) -> bool:
    """직전 편 띠와 흰 줄·노란 줄 어느 쪽도 같지 않아야 한다."""
    if not b:
        return False
    return not any(b["top"] in r or b["accent"] in r for r in recent)


def bank_band(day: dt.date, recent: list[str] | None = None) -> dict:
    recent = recent or []
    for k in range(len(BAND_BANK)):
        top, acc = BAND_BANK[(day.toordinal() + k) % len(BAND_BANK)]
        if fresh_band({"top": top, "accent": acc}, recent):
            return {"top": top, "accent": acc}
    top, acc = BAND_BANK[day.toordinal() % len(BAND_BANK)]
    return {"top": top, "accent": acc}


def draw_band(img, band: dict | None) -> int:
    """화면 맨 위 검은 띠 + 흰 줄·노란 줄. 띠 아래 y 를 돌려준다(띠 없으면 0)."""
    if not band:
        return 0
    from PIL import ImageDraw
    rows = [(no_middot(band.get("top", "")).strip(), (255, 255, 255)), (no_middot(band.get("accent", "")).strip(), YEL)]
    rows = [r for r in rows if r[0]]
    if not rows:
        return 0
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, BAND_H], fill=(0, 0, 0, 255))
    size = BAND_SIZE
    while size > 60 and max(d.textlength(t, font=band_font(size)) for t, _ in rows) > W - 80:
        size -= 4
    f = band_font(size)
    gap = size + 22
    y = BAND_H / 2 + 18 - gap * (len(rows) - 1) / 2  # 위 검색 아이콘 자리만큼 조금 아래로
    for t, col in rows:
        d.text((W / 2, y), t, font=f, fill=col, anchor="mm", stroke_width=3, stroke_fill=(0, 0, 0))
        y += gap
    return BAND_H


# 반복 양산 막기 (BK 11/20 "비슷한 틀로 찍어낸 영상이 걸러지는 거라면…"): 배경은 날마다 돌려 써서 직전 3편과 겹치지 않게.
# (위 그라데이션, 아래 그라데이션, 바닥 격자 색, 별 배치 씨앗). 글자·선택지 색은 채널 표시라 그대로.
THEMES = [((12, 6, 32), (42, 15, 85), (255, 79, 163), 5),     # 보라 밤 (원래)
          ((4, 22, 30), (8, 70, 82), (60, 230, 210), 11),     # 청록 바다
          ((34, 8, 14), (110, 34, 30), (255, 170, 60), 17),   # 노을
          ((6, 12, 40), (20, 40, 120), (120, 160, 255), 23)]  # 파란 우주
_THEME = THEMES[0]


def theme_for(day: dt.date) -> tuple:
    return THEMES[day.toordinal() % len(THEMES)]


def background(seed: int = 5):
    from PIL import Image, ImageDraw
    bg, bg2, grid, s0 = _THEME
    img = Image.new("RGBA", (W, H), bg + (255,))
    dr = ImageDraw.Draw(img)
    for y in range(H):  # 위→아래 그라데이션 (날마다 다른 색)
        k = math.sin(math.pi * y / H) * 0.9
        c = tuple(int(bg[i] + (bg2[i] - bg[i]) * k) for i in range(3))
        dr.line([(0, y), (W, y)], fill=c + (255,))
    rnd = random.Random(seed + s0)
    for _ in range(90):
        x, y, r = rnd.randrange(W), rnd.randrange(int(H * 0.75)), rnd.choice([1, 2, 2, 3])
        dr.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randrange(90, 200)))
    # 아래 원근 격자
    hz = int(H * 0.80)
    for i in range(-14, 15):
        dr.line([(W / 2 + i * 40, hz), (W / 2 + i * 260, H)], fill=grid + (90,), width=2)
    y, step = hz, 8
    while y < H:
        dr.line([(0, y), (W, y)], fill=grid + (90,), width=2)
        step *= 1.35
        y += int(step)
    return img


def header(img, sub: str = "오늘의 밸런스게임"):
    from PIL import ImageDraw
    dr = ImageDraw.Draw(img)
    f = font(64)
    w5, wr = dr.textlength("5", font=f), dr.textlength("락실", font=f)
    x = W / 2 - (w5 + wr + 8) / 2
    glow_text(img, (x + w5 / 2, 120), ["5"], f, 64, PINK, glow=10)
    glow_text(img, (x + w5 + 8 + wr / 2, 120), ["락실"], f, 64, CYAN, glow=10)
    glow_text(img, (W / 2, 215), [sub], font(48), 48, YEL, glow=8)


def panel(img, box, color, label: str, text: str):
    """선택지 칸: 왼쪽 큰 동그라미 번호(A/B) + 오른쪽 선택지 글자 (2026-11-20 번호 붙은 선택지 패턴)."""
    from PIL import ImageDraw
    x0, y0, x1, y1 = box
    dr = ImageDraw.Draw(img)
    dr.rounded_rectangle(box, radius=40, fill=tuple(int(c * 0.22) for c in color) + (255,), outline=color + (255,), width=8)
    cy, r = (y0 + y1) / 2, 62
    dr.ellipse((x0 + 40, cy - r, x0 + 40 + 2 * r, cy + r), fill=color + (255,))
    f = font(92)
    dr.text((x0 + 40 + r, cy + 4), label, font=f, fill=BG + (255,), anchor="mm")
    tx0 = x0 + 40 + 2 * r + 30
    f, ls, size = fit(dr, text, x1 - tx0 - 40, y1 - y0 - 50, 110)
    glow_text(img, ((tx0 + x1 - 30) / 2, cy), ls, f, size, color, glow=14)


# 2026-11-20 1안: 몽글이가 두 선택지 사이에서 고민(첫 1초) → 3·2·1 → 반전 → 'B를 고른 나:' 반응 컷.
# 몽글이·말풍선·글자는 쇼츠 오른쪽 버튼(x≥900)과 아래 제목 자리(y≥1540)를 피한다. 위는 제목 띠(BAND_H).
PANEL_A, PANEL_B = (60, 370, W - 60, 640), (60, 720, W - 60, 990)
VS_Y = 680
MG_X, MG_FLOOR, MG_K = 400, 1530, 1.35
MG_TOP = MG_FLOOR - int(395 * MG_K)  # 몽글이 머리 꼭대기 근처
REACT_D = 1.4  # 반응 컷 길이(초, BGM 이 있으면 박자에 맞춤)
# 길이 상한 (11/20 긴 질문 편 18.9초 → 엔딩 빼고 약 10초): 질문 음성 3.4초·반전 음성 2.6초를 넘으면 빠르게 읽는다.
VOICE_CAP, MAX_SPEED = (3.4, 2.6), 1.45
LONG_Q = 34  # A+B 글자 수가 이보다 길면 질문은 소리 내 읽지 않는다


def question_card(q: dict, band: dict | None = None):
    img = background()
    if not draw_band(img, band):
        header(img)
    panel(img, PANEL_A, PINK, "A", q["a"])
    panel(img, PANEL_B, CYAN, "B", q["b"])
    return img


def vs_layer(scale: float):
    from PIL import Image
    s = max(10, int(110 * scale))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_text(img, (W / 2, VS_Y), ["VS"], font(s), s, YEL, glow=16)
    return img


def twist_card(res: dict | None, q: dict | None = None, pick: dict | None = None, band: dict | None = None):
    """반전 장면 바탕: 실제 투표 결과(20표 이상) > 몽글이의 선택 > '정답은 없다'."""
    from PIL import ImageDraw
    img = background(7)
    if not draw_band(img, band):
        header(img)
    dr = ImageDraw.Draw(img)
    if not res and q and pick:
        col = PINK if pick["pick"] == "a" else CYAN
        glow_text(img, (W / 2, 420), ["몽글이의 선택은?"], font(72), 72, YEL, glow=8)
        panel(img, (60, 490, W - 60, 730), col, pick["pick"].upper(), q[pick["pick"]])
        f, ls, size = fit(dr, f"\"{pick['why']}\"", W - 160, 150, 76)
        glow_text(img, (W / 2, 820), ls, f, size, WHITE, glow=8)
        glow_text(img, (W / 2, 950), ["너는? 댓글로 A, B!"], font(66), 66, CYAN, glow=10)
    elif res:
        glow_text(img, (W / 2, 410), [f"어제 질문 실제 투표 ({res['n']}표)"], font(56), 56, MUTED, glow=4)
    if not res and not (q and pick):
        glow_text(img, (W / 2, 500), ["정답은 없다!"], font(120), 120, PINK, glow=18)
        glow_text(img, (W / 2, 730), ["댓글로", "A? B?"], font(110), 110, CYAN, glow=14)
    glow_text(img, (MG_X + 320, MG_FLOOR - 230), ["투표는", "오락실 닷컴"], font(56), 56, YEL, glow=8)
    return img


def twist_layer(res: dict, k: float):
    """결과 % 막대 (실제 투표 20표 이상일 때만): 두 막대가 0에서 차오르고, 이긴 쪽이 쾅."""
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    x0, x1 = 60, W - 60
    for i, (lab, txt, pct, col) in enumerate((("A", res["a"], res["pa"], PINK), ("B", res["b"], res["pb"], CYAN))):
        y0 = 470 + i * 200
        y1 = y0 + 160
        dr.rounded_rectangle((x0, y0, x1, y1), radius=30, fill=tuple(int(c * 0.18) for c in col) + (255,), outline=col + (255,), width=6)
        fw = int((x1 - x0) * pct / 100 * k)
        if fw > 40:
            dr.rounded_rectangle((x0, y0, x0 + fw, y1), radius=30, fill=col + (200,))
        f, ls, size = fit(dr, f"{lab}. {txt}", x1 - x0 - 300, 120, 70)
        dr.text((x0 + 40, (y0 + y1) / 2), ls[0], font=f, fill=WHITE + (255,), anchor="lm", stroke_width=4, stroke_fill=BG + (255,))
        glow_text(img, (x1 - 120, (y0 + y1) / 2), [f"{round(pct * k)}%"], font(84), 84, YEL, glow=8)
    if k >= 1:
        win, _ = winner(res)
        col = PINK if win == res["a"] else CYAN
        f, ls, size = fit(dr, win + " 승!", W - 160, 110, 84)
        glow_text(img, (W / 2, 900), ls, f, size, col, glow=14)
    return img


def react_side(res: dict | None, pick: dict | None, day: dt.date) -> tuple[str, str]:
    """'B를 고른 나:' 반응 컷의 쪽과 표정: 실제 투표면 진 쪽(소수파, 깜짝), 몽글이 선택이면 그 쪽(신남)."""
    if res:
        return ("b" if res["pa"] >= res["pb"] else "a"), "shock"
    if pick:
        return pick["pick"], "happy"
    return ("a" if day.toordinal() % 2 else "b"), "happy"


def react_layer(q: dict, side: str, k: float):
    """반응 컷: 위 내용을 어둡게 덮고 'B를 고른 나:' + 선택지 이름. 몽글이는 그 위에 따로 그린다."""
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.rectangle((0, BAND_H, W, MG_TOP - 10), fill=BG + (int(245 * min(1.0, k / 0.15)),))
    col = PINK if side == "a" else CYAN
    s = 150 if k > 0.08 else 170
    glow_text(img, (W / 2, 560), [f"{side.upper()}를 고른 나:"], font(s), s, WHITE, glow=16)
    f, ls, size = fit(dr, q[side], W - 160, 170, 84)
    glow_text(img, (W / 2, 780), ls, f, size, col, glow=12)
    return img


class Mongle:
    """몽글이 꼬마 그림 (raksil_meme 아틀라스 + 얼굴). 표정별로 한 번만 그린다."""

    def __init__(self, day: dt.date):
        from . import raksil_meme as rm
        self.rm, self.atlas = rm, rm._atlas()
        self.pal = rm.PALS[day.toordinal() % len(rm.PALS)]
        self.cache: dict = {}

    def get(self, mood: str, blink: bool = False):
        key = (mood, blink)
        if key not in self.cache:
            self.cache[key] = self.rm.sprite(self.atlas, self.pal, 2, None, mood, MG_K, blink)
        return self.cache[key]

    def draw(self, img, mood: str, dx: float = 0, dy: float = 0, rot: float = 0, flip: bool = False, blink: bool = False):
        from PIL import Image, ImageDraw
        s = self.get(mood, blink)
        if flip:
            s = s.transpose(Image.FLIP_LEFT_RIGHT)
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sw = s.width * 0.34
        ImageDraw.Draw(sh).ellipse((MG_X + dx - sw, MG_FLOOR - sw * 0.15, MG_X + dx + sw, MG_FLOOR + sw * 0.15), fill=(0, 0, 0, 80))
        img.alpha_composite(sh)
        if rot:
            s = s.rotate(rot, resample=Image.BICUBIC, expand=True)
        self.rm._paste_clip(img, s, int(MG_X + dx - s.width / 2), int(MG_FLOOR + dy - s.height * 0.94))


def sweat(img, t: float):
    """머리 옆 땀방울 두 개가 주르륵."""
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for i, (x, ph) in enumerate(((MG_X + 205, 0.0), (MG_X - 220, 0.5))):
        f = (t * 1.4 + ph) % 1.0
        y = MG_TOP + 130 + 120 * f
        r = 16 - 4 * i
        a = int(255 * (1 - f))
        d.polygon([(x, y - r * 2.2), (x - r, y), (x + r, y)], fill=(120, 200, 255, a))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(120, 200, 255, a))


def think(img, t: float, text: str):
    """몽글이 오른쪽 위 생각 말풍선 + 물음표 깜빡."""
    from .raksil_ending import bubble
    bubble(img, MG_X + 190, MG_TOP + 40, text, min(1.0, t / 0.25))
    if int(t * 4) % 2 == 0:
        glow_text(img, (MG_X - 250, MG_TOP + 110), ["?"], font(120), 120, YEL, glow=10)
    if int(t * 4 + 1) % 2 == 0:
        glow_text(img, (MG_X - 170, MG_TOP + 40), ["?"], font(90), 90, PINK, glow=8)


def balance_frame(t: float, starts: list[float], base_q, base_r, res: dict | None, mg: "Mongle", step: float = 0.7,
                  react: tuple | None = None):
    """react = (q, side, mood): 마지막 장면(starts[3]~)을 'B를 고른 나:' 반응 컷으로."""
    sc = max(k for k in range(len(starts)) if starts[k] <= t)
    lt = t - starts[sc]
    if sc == 0:  # 첫 1초부터: 두 선택지 + 몽글이가 고개를 좌우로 돌리며 땀 삐질
        img = base_q.copy()
        img.alpha_composite(vs_layer(round(0.6 + 0.4 * min(1, lt / 0.3) + 0.05 * math.sin(lt * 6), 2)))
        look = int(lt / 0.45) % 2 == 1
        mg.draw(img, "shock" if lt < 0.9 else "neutral", dx=-14 if look else 14, rot=7 if look else -7, flip=look,
                blink=(lt % 1.6) > 1.5)
        sweat(img, lt)
        think(img, lt, "어쩌지...")
    elif sc == 1:  # 3·2·1: 몽글이 덜덜
        img = base_q.copy()
        num = 3 - min(2, int(lt / step))  # step = 숫자 하나 길이 (BGM 박자에 맞춤)
        img.alpha_composite(countdown_layer(num, (lt % step) / step))
        mg.draw(img, "shock", dx=10 * math.sin(lt * 55), rot=3 * math.sin(lt * 41))
        sweat(img, lt)
    elif sc == 2 or not react:  # 반전: 막대가 차오르면 몽글이 깜짝 점프
        img = base_r.copy()
        k = min(1.0, lt / 0.8) if res else 1.0
        if res:
            img.alpha_composite(twist_layer(res, round(k, 2)))
        hop = abs(math.sin(math.pi * min(1.0, max(0.0, lt - 0.8) / 0.45))) if lt > 0.8 else 0.0
        mood = ("shock" if res and winner(res)[1] >= 65 else "happy") if lt > 0.8 or not res else "neutral"
        mg.draw(img, mood, dy=-120 * hop, rot=6 * math.sin(lt * 9))
    else:  # 반응 컷: 'B를 고른 나:' + 몽글이 (신남이면 통통 뛰고, 깜짝이면 덜덜)
        q, side, mood = react
        img = base_r.copy()
        if res:
            img.alpha_composite(twist_layer(res, 1.0))
        img.alpha_composite(react_layer(q, side, round(min(1.0, lt), 2)))
        if mood == "happy":
            mg.draw(img, "happy", dy=-90 * abs(math.sin(lt * 7)), rot=8 * math.sin(lt * 7), flip=int(lt * 3.5) % 2 == 1)
        else:
            mg.draw(img, "shock", dx=12 * math.sin(lt * 55), rot=4 * math.sin(lt * 41))
            sweat(img, lt)
    return img


def countdown_layer(n: int, frac: float):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    r = 120
    cx, cy = W / 2, VS_Y
    dr.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BG + (235,), outline=YEL + (255,), width=10)
    dr.arc((cx - r - 16, cy - r - 16, cx + r + 16, cy + r + 16), -90, -90 + 360 * (1 - frac), fill=PINK + (255,), width=14)
    glow_text(img, (cx, cy - 10), [str(n)], font(150), 150, YEL, glow=10)
    return img


# ---------- 소리 ----------
def tts(lines: list[str], caps: list[float] | None = None, speed: float = 1.05):
    """대사 → (클립 리스트, 성공 여부). supertonic 이 없으면 무음.
    caps = 줄별 최대 초: 넘으면 그 줄만 빠르게(최대 MAX_SPEED) 다시 읽는다 (11/20 긴 질문 18.9초 편 후)."""
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
            cap = caps[len(out)] if caps and len(out) < len(caps) else None
            sp = speed
            for _ in range(3):
                wav, _ = t.synthesize(s, voice_style=style, lang="ko", total_steps=32, speed=sp)
                clip = resample(wav.reshape(-1).astype(np.float32), t.sample_rate)
                if not cap or len(clip) / SR <= cap or sp >= MAX_SPEED:
                    break
                sp = min(MAX_SPEED, sp * len(clip) / SR / cap * 1.03)
            out.append(clip)
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
    extra = os.environ.get("RAKSIL_QID", "").strip()  # 추가 1편: 질문 id 지정 (바로 공개, 날짜 기록과 따로)
    q = next((x for x in qs if x["id"] == extra), None) if extra else pick_question(qs, day, for_shorts=True)
    if q and extra:
        day = dt.date.fromisoformat(q["date"])
    if not q:
        print(f"{day} 질문 없음")
        return None
    yq = pick_question(qs, day - dt.timedelta(days=1), for_shorts=True)
    res = result_of(yq, fetch_votes(yq["id"]) if yq else None)
    global _THEME
    _THEME = theme_for(day)
    pick, band = mongle_plan(q)
    pick = None if res else pick
    band = band or bank_band(day, recent_bands())  # 제목 띠: Claude 후보 중 클릭 점수 1등, 없으면 문구 은행
    lines = script(q, res, pick)
    clips, voiced = tts(lines, caps=[VOICE_CAP[0], 0, VOICE_CAP[1]], speed=1.15)

    # 2026-11-20 1안: 14초 → 약 8~9초 + 엔딩 2.6초. 끝까지 보는 비율을 올리려고 CTA 카드를 빼고 반전으로 끝낸다.
    d0 = max(2.6, len(clips[0]) / SR + 0.4)
    d1 = 2.1  # 3,2,1 (0.7초씩)
    d2 = max(2.8, len(clips[2]) / SR + 0.5)
    # 2026-11-20 BK "노래 BPM에 맞춰서": BGM 이 있으면 장면 전환·3,2,1 을 박자에 맞춘다 (docs/BGM.md)
    from . import bgm
    tr = bgm.pick("balance", day)
    step = 0.7
    if tr:
        b = bgm.beat(tr)
        step = round(b * max(1, round(0.7 / b)), 3)
        d0, d1, d2 = bgm.snap(d0, tr, 1, "up"), 3 * step, bgm.snap(d2, tr, 1, "up")
    d3 = bgm.snap(REACT_D, tr, 1, "up") if tr else REACT_D  # 'B를 고른 나:' 반응 컷
    durs = [d0, d1, d2, d3]
    total = sum(durs)
    starts = [sum(durs[:i]) for i in range(4)]

    audio = np.zeros(int(SR * total) + SR, dtype=np.float32)
    for c, s0 in zip(clips, starts):
        place(audio, c * 0.95, s0 + 0.12)
    place(audio, np.concatenate([tone(988, 0.06), tone(740, 0.12)]), 0.0)  # 땀 삐질 '띠용'
    for i in range(3):
        place(audio, tone(660, 0.1, 0.2), starts[1] + i * step)
    place(audio, np.concatenate([tone(523, 0.08), tone(659, 0.08), tone(784, 0.08), tone(1046, 0.2)]), starts[2])
    place(audio, np.concatenate([tone(1175, 0.05, 0.2), tone(880, 0.05, 0.2), tone(1175, 0.12, 0.2)]), starts[3])  # 반응 컷 '뾰롱'
    if not tr:  # BGM 이 없을 때만 합성 베이스
        bass = [110, 110, 147, 131]
        t = 0.0
        while t < total:
            place(audio, tone(bass[int(t * 2) % 4], 0.45, 0.07), t)
            t += 0.5
    audio = np.clip(audio, -1, 1)[: int(SR * total)]

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{day.isoformat()}-balance" + (f"-{q['id'][-1]}" if extra else "")
    wav = out_dir / f"{stem}.wav"
    mp4 = out_dir / f"{stem}.mp4"
    import wave
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())

    mg = Mongle(day)
    base_q = question_card(q, band)
    base_r = twist_card(res, q, pick, band)
    side, mood = react_side(res, pick, day)
    react = ({"a": res["a"], "b": res["b"]} if res else q, side, mood)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium",
                           "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest",
                           "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    for i in range(int(total * FPS)):
        ff.stdin.write(balance_frame(i / FPS, starts, base_q, base_r, res, mg, step, react).convert("RGB").tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg 실패")
    wav.unlink()
    from .raksil_ending import append as add_ending  # 2026-11-20 BK: 몽글이 구독·좋아요 엔딩
    total += add_ending(mp4, day)
    bgm.mix(mp4, tr)
    meta = {"date": day.isoformat(), "qid": q["id"], "a": q["a"], "b": q["b"], "bgm": tr["slug"] if tr else None, "file": str(mp4), "title": title_of(q, band), "band": band,
            "description": description_of(q, res, voiced, pick), "pick": pick, "voiced": voiced, "result": res, "key": q["id"] if extra else day.isoformat(), "seconds": round(total, 1)}
    (out_dir / f"{stem}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


# ---------- 올리기 ----------
PUBLISH_HOUR = 17  # KST, BK 2026-11-13: 매일 오후 5시 공개


def publish_time(meta: dict, now: dt.datetime) -> dt.datetime | None:
    """그날 17:00 KST 전이면 그 시각 예약, 지났으면 None(바로 공개)."""
    at = dt.datetime.combine(dt.date.fromisoformat(meta["date"]), dt.time(meta.get("hour", PUBLISH_HOUR)), KST)
    return at if now < at - dt.timedelta(minutes=2) else None


def video_body(meta: dict, publish_at: dt.datetime | None = None) -> dict:
    status = {"privacyStatus": "public"} if publish_at is None else {
        "privacyStatus": "private",  # publishAt 은 private 일 때만
        "publishAt": publish_at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    return {
        "snippet": {"title": meta["title"], "description": meta["description"], "tags": meta.get("tags", TAGS),
                    "categoryId": meta.get("category", "24"), "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
        "status": {**status, "selfDeclaredMadeForKids": False,
                   "containsSyntheticMedia": bool(meta.get("voiced")), "embeddable": True},
    }


def upload_meta(meta: dict) -> int:
    from .youtube import access_token, summary, upload
    log = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {}
    key = meta.get("key", meta["date"])
    if key in log or any(v.get("qid") == meta["qid"] for v in log.values()):
        summary(f"{key} 이미 올림")
        return 0
    if os.environ.get("RAKSIL_YT_ENABLED", "").lower() != "true":
        summary(f"dry-run (RAKSIL_YT_ENABLED 꺼짐): {meta['title']}")
        return 0
    need = ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "RAKSIL_YT_REFRESH_TOKEN")
    if not all(os.environ.get(k) for k in need):
        summary("5락실 유튜브 비밀값이 없어 업로드하지 않음 (docs/RAKSIL_YOUTUBE.md)")
        return 1
    tok = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"], os.environ["RAKSIL_YT_REFRESH_TOKEN"])
    sched = meta.get("schedule", meta.get("key", meta["date"]) == meta["date"])
    at = publish_time(meta, dt.datetime.now(KST)) if sched else None
    r = upload(tok, video_body(meta, at), pathlib.Path(meta["file"]))
    log[key] = {"id": r["id"], "qid": meta["qid"], "title": meta["title"],
                "a": meta.get("a", ""), "b": meta.get("b", ""), "pick": meta.get("pick")}  # 몽글이 기억 (mongle_memory)
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
