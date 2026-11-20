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
             "포즈를 줄마다 바꾼다(삼촌 talk/wow/point/think/thumb/facepalm, 조카 talk/shock/cold/happy/think). "
             "홈페이지 유입(2026-11-14 BK): 정답 숫자는 '가정' 기준임을 sub 로 밝히고, 끝은 시청자 자기 숫자가 궁금해지게 "
             "(\"근데 너네 집은 얼마일까?\" → \"우리 집 숫자는 돈삼촌에서\"). badge 는 숫자+물음표(\"1년 18만 원?\") 또는 상식 뒤집기(\"끄면 손해?\"). "
             "근거 없는 통계·과장 금지. ")
# 2026-11-14 오후 BK "상품편도 하지마, 우선 홈페이지 유입에 주력해": 쇼츠·롱폼 모두 상품 없음, 끝은 don3chon.com 으로.
# 요일(월=0) → 쇼츠 형식. 2026-11-14 BK "덜 광고처럼": 상품 나오는 쇼츠는 월·목 상황극 주 2개만,
# 화·금 = "오늘의 얼마게"(사이트 퀴즈와 같은 날 같은 문제, 코드가 그날 아침 자동으로 씀, 상품 없음), 수·토·일 상품 없음.
# 2026-11-19 BK "쇼츠를 2일에 하나씩", "1편의 컨텐츠 품질이 사이트의 운명을 좌우해": 삼촌 쇼츠는 이틀에 1편(19:00 공개).
SHORT_EVERY_DAYS = 2
QUIZ_DAYS: set[int] = set()  # 2026-11-17 얼마게 쇼츠 쉼 (사이트 퀴즈는 그대로). 되살리면 {1, 4}
# 2026-11-14 밤 BK: "돈 줍는 삼촌을 완벽하게 정보의 장으로". 모든 쇼츠 공통 규칙 (구매 유도 없음).
INFO_RULE = ("[정보의 장 규칙] 시청자가 이 영상에서 얻는 것(얼마 아끼는지·왜 중요한지)을 먼저 세운다: "
             "takeaway = 한 줄 정보 가치(40자 이하, 예: \"멀티탭 스위치 하나로 1년 1만 7천 원\") → 설명란 첫 줄. "
             "영상 안에 오늘 바로 할 수 있는 행동 1개와 숫자의 가정(근거)을 넣는다. "
             "site_path = 더 자세한 계산·표가 있는 사이트 페이지 하나(next 의 site_pages 중, 형식별 종류 고정) → 설명란 링크, "
             "end text 는 사이트에 가면 무엇을 더 얻는지. 상품·구매·할인·링크 유도 금지. "
             "페이지 숫자 출처: calc/ = src/pipeline/calcs.py, q/ = data/calc_questions.json, recipe/ = data/recipes/, "
             "guide/ = data/articles/<slug>.json, 시세 = data/daily/. 그 안의 숫자·가정만 쓴다. ")
# 2026-11-14 밤 BK: 사이트 정보 페이지(시세·계산기·얼마게·질문·레시피·글)로 사람을 보내는 요일표. 요일마다 보낼 페이지 종류가 정해져 있다.
# 2026-11-17 BK: "애니메이션·애완동물처럼 시선 끄는 것 + 주부 타깃 + 남들이 모르는 정보로 아하 포인트 + 구독·즐겨찾기 살짝".
# → 형식 3개(장바구니 시세 / 살림 상황극 / 1년이면? 카드)로 줄이고, 상황극엔 마스코트 강아지 '동전이'(pipeline/pet.py)가 고정 출연.
# 얼마게 퀴즈 쇼츠(화·금, 조회 82~294회)는 쉬고 사이트 퀴즈만 유지. 계획: plan/SHORTS_GROWTH.md "2026-11-17 새 기획".
HOME_RULE = ("[주부 타깃·아하 규칙 2026-11-17] 보는 사람 = 장보기·살림을 맡은 30~50대(주부). 주제는 장바구니·집밥·전기/가스/난방·김장 같은 살림. "
             "모든 편에 '아하' 1개: 흔한 믿음(\"보온은 전기 거의 안 먹지\")을 사이트 숫자로 뒤집는다 (예: 보온 1년 약 8만 9천 원, 무 한 달 -27%). "
             "근거가 사이트에 없는 '아하'는 쓰지 않는다. 조카는 시청자 대신 묻고, 끝 펀치라인은 '엄마한테 전화' 같은 집안 장면이 좋다. "
             "skit 줄에 pet(동전이 포즈 happy/shock/coin/curious/cry/sleep)·pet_say(8자 이하)를 넣을 수 있다. 안 넣으면 자동(반전 숫자 = 동전 물고 '짤랑!'). "
             "[11/17 셋톱박스 편 82회 교훈] 1년 3만 원 미만 숫자·대기전력·셋톱박스처럼 이미 다 아는 절약 팁은 쓰지 않는다. "
             "첫 줄(첫 1초)은 삼촌의 '얼마게?' 퀴즈 질문이 아니라 조카의 놀란 상황 + 숫자 비교(\"밥솥 보온 1년 = 쌀 한 포대 값?\", \"온풍기 4만 8천 vs 담요 480원\")로 시작한다. "
             "비교 대상은 장바구니처럼 손에 잡히는 것(쌀·치킨·한 달 장보기)으로, 숫자는 사이트 데이터만. "
             "[11/18 교훈, 11/25 편부터] 길이 20~25초(내레이션 100~150자, skit 4~5줄 + end). 제목은 답을 말하지 않고 궁금증으로 끝낸다(\"온풍기 vs 전기장판, 한 달 차이 얼마?\"), "
             "답 숫자(big)는 영상 안에서만. 삼촌 얼굴 영상(uncle) 장면은 쓰지 않는다(첫 화면 정지 얼굴 = 넘김). "
             "end say 는 한 번만 가볍게 '구독해 두면 계속 알려줄게' 또는 '매일 아침 시세는 돈삼촌 즐겨찾기' 중 하나(보상 약속·화면 고정 문구 금지). ")
BASKET_RULE = ("상품 없음. data/daily/ 최신 파일 grocery 의 m(한 달 변화 %)·price 만 쓴다. 가장 많이 내린 것 1~2개와 오른 것 1개를 고른다(±20% 이상 우선). "
               "skit: 1줄 조카가 장보기 목록(숫자 cap) → 2줄 오답(\"김장철이라 무도 비싸겠지\") → 3줄 buzz + big(\"한 달 -27%\") + sub(KAMIS 소매가, 날짜) → "
               "4~5줄 대신 살 것·미룰 것 → 끝. 4가지 체크(GROWTH 글자형 규칙)를 모두 통과하면 textshort 가 글자형으로 바꿀 수 있다. ")
SHORT_FORMATS = {
    0: ("prices", "동전이네 장바구니 시세", False, SKIT_RULE + BASKET_RULE + "site_path = index.html 또는 report.html. 끝 = \"매일 아침 시세는 돈삼촌에\"."),
    1: ("skit-calc", "동전이네 살림 계산", False,
        SKIT_RULE + "상품 없음. 주제: 사이트 계산기 하나(site_path = calc/…)로 풀리는 살림 고민 (전기요금·난방비·가스·가습기). "
        "조카가 틀리고 삼촌이 그 계산기 결과 숫자로 뒤집는다(같은 가정). 끝 = \"우리 집 숫자는 돈삼촌 계산기에\"."),
    2: ("guide", "1년이면 얼마?", False,
        "상품 없음, 카드형. 사이트 글·계산 하나의 '작은 습관 × 1년 = 통장 숫자'(11/15 bank 형식 1,147회, 1위): hook(\"밥솥 보온, 1년이면?\") → "
        "calc(1년 누적 숫자 크게) → list(핵심 3가지·오늘 할 행동) → end. 숫자는 사이트 페이지 값 × 12(달) 처럼 계산식을 sub 에 적는다. "
        "site_path = guide/ 또는 q/ 또는 calc/ 중 그 숫자가 있는 페이지."),
    3: ("skit-recipe", "배달 vs 집밥 1인분", False,
        SKIT_RULE + "상품·브랜드 없음. 주제: 사이트 1인분 원가 레시피(site_path = recipe/…) 하나. 조카가 배달 앱을 켜는 순간 → "
        "삼촌이 재료비·배달비 차이를 숫자로 → 한 달(주 2번) 차이. 숫자는 그 레시피 페이지와 같게. 끝 = \"재료·순서는 돈삼촌 레시피에\"."),
    4: ("skit-q", "동전이네 살림 질문", False,
        SKIT_RULE + "상품 없음. 주제: 사이트 '계산해 본 질문'(site_path = q/…) 하나 (밥솥 보온·건조기·제습기·카본히터·라디에이터). "
        "그 페이지의 숫자·가정만 쓴다. 끝 = \"더 자세한 표는 돈삼촌에\"."),
    5: ("basket", "주말 장보기 아하", False, SKIT_RULE + BASKET_RULE + "월요일과 다른 품목. site_path = index.html. 끝 = \"매일 아침 시세는 돈삼촌에\"."),
    6: ("guide", "1년이면 얼마?", False,
        "상품 없음, 카드형. 수요일과 같은 '작은 습관 × 1년' 틀, 다른 주제(장보기·집밥·관리비). 글·페이지에 있는 사실만. "
        "site_path = guide/ 또는 q/ 또는 calc/."),
}
# 2026-11-18 BK "실사 영상이 좋아, 기획안 돌려 쓰면 지겨울 것": 상황극 일부를 무료 스톡 실사 배경(pipeline/live.py)으로.
# 웹툰 상황극(목·금)과 2주 비교 (판단 12/7, docs/SHORTS_GROWTH.md). 키가 없으면 자동으로 웹툰.
LIVE_DAYS = {0, 1, 2, 3, 4, 5, 6}  # 2026-11-19 BK "스토리와 첨단 도구": 매일 실사·AI 배경 (예전 월·화·토)
LIVE_RULE = ("[실사 배경 규칙 2026-11-18] 대본 맨 위 \"style\": \"live\". 첫 skit 줄에 \"clip\": config/stock_scenes.json 장면 이름 "
             "(예 snow-street, boiler, thermostat, grocery-market, cabbage, home-meal). 장면은 한 편에 1~3개, 대사에 그 물건·장소가 실제로 나올 때만 바꾼다. "
             "'티도 안 나지'·'겨울 4달' 같은 말·숫자 줄은 clip 을 빼서 앞 장면을 이어 쓰고, 숫자만 크게 보일 줄은 \"layout\": \"focus\"(배경 흐림). "
             "주제는 그 주의 시기 이슈(한파·김장·요금 인상·명절)에 사이트 숫자를 붙인다. 시기 이슈의 사실(기온·인상 시점)은 줄 \"src\"(30자 이하)로 "
             "출처를 달고, 확인 안 된 것·겁주기 과장은 쓰지 않는다. 금액·퍼센트는 여전히 사이트 숫자만. "
             "[AI 클립 2026-11-19] info 의 ai_scenes 에 있는 장면(BK 가 만든 AI 영상, 예 dongjeon=동전이 오프닝)은 그 주제에 맞을 때 "
             "첫 줄 clip 으로 먼저 쓴다(움직이는 첫 화면). ai_scenes 에 없는 ai_only 장면(dongjeon, kimjang)은 쓰지 않는다. ")
STORY_RULE = ("[스토리 2026-11-19 BK] 글자 카드(hook·list·calc)만 이어 붙이지 말고 type skit 4~5줄 + end 로 쓴다(정리 guide·시세 prices 도). "
              "흐름: ① 조카의 착각·문제(첫 줄, 움직이는 clip) → ② 삼촌 '땡!' 반전 큰 숫자(focus) → ③ 두 번째 숫자나 비교(focus) → ④ 오늘 바로 할 일 한 가지. "
              "예시는 data/episodes/2026-11-20-skit-q.json(11/19 다시 만든 6편). ")
SITE_PREFIX = {"prices": ("index.html", "report.html"), "basket": ("index.html", "report.html"), "quiz": ("quiz.html",),
               "skit-calc": ("calc/",), "skit-q": ("q/",),
               "skit-recipe": ("recipe/",), "guide": ("guide/", "q/", "calc/")}
# 2026-11-14 BK: 롱폼 멈춤 (TTS 내레이션·슬라이드로는 재미가 없음) → 매일 쇼츠 1편 질에 집중. 다시 하면 여기 형식을 넣는다.
LONG_FORMATS: dict = {}

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
    """다음에 대본이 필요한 쇼츠 공개일: 업로드 기록·대기열·대본 중 가장 늦은 날 + SHORT_EVERY_DAYS일."""
    last = today + dt.timedelta(days=1)
    for v in load_log().values():
        last = max(last, dt.datetime.fromisoformat(v["publish_at"]).astimezone(KST).date())
    log = load_log()
    pending = [r for r in load_queue() if r["slug"] not in log and not r.get("date")]
    last = last + dt.timedelta(days=len(pending))
    for d in pending_dates():
        last = max(last, d)
    d = last + dt.timedelta(days=SHORT_EVERY_DAYS)
    while d.weekday() in QUIZ_DAYS:  # 얼마게 날은 코드가 그날 아침 자동으로 씀
        d += dt.timedelta(days=1)
    return d


def next_long_date(today: dt.date) -> dt.date | None:
    if not LONG_FORMATS:
        return None
    have = {json.loads(p.read_text(encoding="utf-8"))["date"] for p in ep_files()
            if json.loads(p.read_text(encoding="utf-8")).get("kind") == "long"}
    d = today + dt.timedelta(days=2)
    while d.weekday() not in LONG_FORMATS or d.isoformat() in have:
        d += dt.timedelta(days=1)
    return d


def products_with_photos() -> list[str]:
    return sorted(p.stem for p in PRODUCTS.glob("*.json")
                  if json.loads(p.read_text(encoding="utf-8")).get("status", "active") == "active")


BANK = pathlib.Path("config/shorts_bank.json")


def pick_concept(d: dt.date, used: list[str]) -> dict | None:
    """아이디어 은행에서 최근 15편에 안 쓴 것 중 날짜로 정해지는 무작위 하나."""
    import random
    if not BANK.exists():
        return None
    allc = json.loads(BANK.read_text(encoding="utf-8"))["concepts"]
    pool = [c for c in allc if c["id"] not in used[-15:]] or allc
    return random.Random(d.toordinal()).choice(pool)


# 2026-11-20 BK "삼촌 쇼츠는 캐릭터 영상으로 하기로 했잖아": 이 날짜부터 요일 형식 대신 전부 동전이 만화.
TOON_FROM = dt.date(2026, 12, 2)
TOON_RULE = ("[동전이 만화 2026-11-20 BK] 재미·상황극 먼저, 정보는 곁들이기(숫자는 반전에 한 번). 예전 정보형(1년이면 얼마? 카드·시세 카드·실사 배경) 금지. "
             "먼저 data/toon/lab/<날짜>.md 를 찾는다(main 에 없으면 git fetch origin auto/toon-<날짜> 후 그 브랜치에서). "
             "PR 댓글에 BK 번호가 있으면 그 안, 없으면 1안. 후보가 없으면 아무것도 쓰지 말고 끝낸다(07:10 자동 작업이 먼저 만든다). "
             "title = 그 안의 상황 궁금증, 답 숫자 없이 '?'로 끝. description = 숫자 가정·근거 + 해시태그 3개. takeaway·site_path(숫자 근거 페이지) 필수, "
             "\"toon_lab\": \"<날짜> N안\". scenes = BK 만화 클립이 늦을 때 쓰는 대체 영상: 같은 이야기 순서의 동전이 skit 4~5줄 + end "
             "(사건 → 조카 착각 → 반전 숫자 big 한 번 → 동전이 해결 → 삼촌 한 마디), \"style\": \"webtoon\". "
             "숫자는 그 안의 숫자 상자·근거만. 쇼핑몰·브랜드 이름(알리·쿠팡·테무 등) 금지, '해외직구'처럼 일반 말로. 바이블 config/toon_bible.md. ")


def info_short(today: dt.date) -> dict:
    d = next_short_date(today)
    key, name, product, rules = SHORT_FORMATS[d.weekday()]
    if d >= TOON_FROM:
        key, name, product, rules = "toon", "동전이 만화", False, SKIT_RULE + TOON_RULE
    specs = [json.loads(p.read_text(encoding="utf-8")) for p in ep_files()]
    used = [x.get("product") for x in specs]
    concept = pick_concept(d, [x.get("concept") for x in specs if x.get("concept")]) if key.startswith(("skit", "toon")) else None
    return {"concept": concept, "concept_rule": "concept 의 상황·반전·루프를 이 형식에 맞게 쓰고 대본에 \"concept\": id 를 넣는다. "
            "썸네일 문구 공식은 docs/SHORTS_BANK.md." if concept else None,"date": d.isoformat(), "kind": "short", "format": key, "format_name": name, "product_allowed": product,
            "rules": INFO_RULE + HOME_RULE + rules + (LIVE_RULE + STORY_RULE if d.weekday() in LIVE_DAYS and key != "toon" else ""),
            "style": "live" if d.weekday() in LIVE_DAYS and key != "toon" else "webtoon", "file": f"data/episodes/{d.isoformat()}-{key}.json", "site_pages": site_pages(),
            "recent_products": [u for u in used if u][-10:],
            "products": products_with_photos(), "clips": sorted(k for k in clips_cfg()),
            "ai_scenes": sorted({c["scene"] for c in live_ai_clips()})}


def live_ai_clips() -> list[dict]:
    from .live import ai_clips
    return ai_clips()


def info_long(today: dt.date) -> dict:
    d = next_long_date(today)
    if d is None:
        return {"paused": "롱폼 멈춤 (2026-11-14 BK). 아무것도 쓰지 않는다."}
    key, name, product, _, rules = LONG_FORMATS[d.weekday()]
    return {"date": d.isoformat(), "kind": "long", "format": key, "format_name": name, "product_allowed": product,
            "rules": rules, "file": f"data/episodes/{d.isoformat()}-{key}.json",
            "products": products_with_photos(), "clips": sorted(k for k in clips_cfg())}


def site_pages() -> dict:
    """쇼츠가 안내할 수 있는 사이트 페이지: 경로 → 제목."""
    from . import articles as A, recipes as RC, questions as Q
    from .calcs import CALCS
    out = {"quiz.html": "오늘의 얼마게 (하루 한 문제)", "index.html": "오늘의 생활 시세 (홈)", "report.html": "주간 생활물가 리포트"}
    out.update({f"calc/{c['slug']}.html": c["h1"] for c in CALCS})
    out.update({f"q/{q['slug']}.html": q["h1"] for q in Q.load()})
    out.update({f"guide/{a['slug']}.html": a["title"] for a in A.load()})
    out.update({f"recipe/{r['slug']}.html": f"{r['name']} 1인분 원가" for r in RC.load(pantry=RC.load_pantry())})
    return out


def clips_cfg() -> dict:
    if not CLIPS.exists():
        return {}
    return {k: v for k, v in json.loads(CLIPS.read_text(encoding="utf-8")).items() if not k.startswith("_")}


# ---------- 오늘의 얼마게 (2026-11-14 BK) ----------
DIGITS = "영일이삼사오육칠팔구"


def num_ko(n: int) -> str:
    """12500 -> 만 이천오백 (읽기용)."""
    if n == 0:
        return "영"
    out = []
    for unit, big in ((10 ** 8, "억"), (10 ** 4, "만"), (1, "")):
        q, n = divmod(n, unit)
        if not q:
            continue
        part = ""
        for v, nm in ((1000, "천"), (100, "백"), (10, "십"), (1, "")):
            x, q = divmod(q, v)
            if x:
                part += ("" if (x == 1 and nm) else DIGITS[x]) + nm
        if big == "만" and part == "일":
            part = ""
        out.append(part + big)
    return " ".join(out)


def speak(text: str) -> str:
    """숫자를 한글로, 괄호 설명은 뺀다 (TTS 용)."""
    import re
    text = re.sub(r"\s*\([^)]*\)", "", text)
    text = text.replace("kWh", "킬로와트시").replace("W", "와트").replace(" × ", " 곱하기 ").replace(" − ", " 빼기 ").replace(" + ", " 더하기 ").replace(" = ", "@@ ")
    native = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"]
    text = re.sub(r"(?<![\d,.])(10|[1-9])(?=\s?(번|시간|개|명|잔|그릇|달)(?!러))", lambda m: native[int(m.group(1))] + " ", text)

    def rep(m):
        a, _, b = m.group(0).replace(",", "").partition(".")
        return num_ko(int(a)) + (" 점 " + "".join(DIGITS[int(c)] for c in b) if b else "")
    text = re.sub(r"\d[\d,]*(?:\.\d+)?", rep, text)
    # "=" 은 받침에 맞춰 "은/는" (삼십일은, 이십일만 원은)
    return re.sub(r"(.)@@", lambda m: m.group(1) + ("은" if (ord(m.group(1)) - 0xAC00) % 28 else "는"), text)


def chunks(text: str, n: int = 40) -> list[str]:
    """쉼표·공백에서 n자 이하로 자른다."""
    out = []
    for part in [x.strip() for x in text.split(", ") if x.strip()]:
        while len(part) > n:
            cut = part.rfind(" ", 0, n)
            cut = cut if cut > 0 else n
            out.append(part[:cut])
            part = part[cut:].strip()
        if out and len(out[-1]) + len(part) + 2 <= n:
            out[-1] += ", " + part
        else:
            out.append(part)
    return out


def reasons(q: dict) -> list[str]:
    """정답 근거 2~4줄. 사이트 문제에 단계별 풀이(steps)가 있으면 그대로(사이트와 같은 풀이), 없으면 계산식 + 해설 문장."""
    import re
    if q.get("steps"):
        return [str(x) for x in q["steps"]][:3]
    out = []
    m = re.search(r"\(([\d,]+)W\)를 하루 ([\d.]+)시간", q["q"])
    if m:
        w, hr = int(m.group(1).replace(",", "")), float(m.group(2))
        out.append(f"{w:,}W × {hr:g}시간 × 30일 = {w * hr * 30 / 1000:,.0f}kWh")
    m = re.search(r"환율이 ([\d,]+)원일 때.*?([\d,]+)달러", q["q"])
    if m:
        fx, usd = int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))
        out.append(f"{usd}달러 × {fx:,}원 = {usd * fx:,}원")
    for sent in [x.strip().rstrip(".") for x in q["why"].split(". ") if x.strip()]:
        parts = [x.strip() for x in sent.split("), ")]
        for j, x in enumerate(parts):
            out.append(x + (")" if j < len(parts) - 1 else ""))
    return out[:4]


def quiz_spec(d: dt.date) -> dict | None:
    """사이트(don3chon.com/quiz)와 같은 날 같은 문제로 상황극 쇼츠 대본. 조카 오답 → 삼촌 정답 → 내일 문제는 돈삼촌에서."""
    from . import daily
    f = daily.OUT / f"{d.isoformat()}.json"
    latest = json.loads(f.read_text(encoding="utf-8")) if f.exists() else None
    q = daily.schedule(d, 1, latest).get(d.isoformat())
    if not q:
        return None
    ans = q["o"][q["a"]]
    wrong = q["o"][(q["a"] + 1) % len(q["o"])] if q["a"] == 0 else q["o"][q["a"] - 1]
    import re
    sq = speak(q["q"])
    said = [sq] if len(sq) <= 42 else chunks(sq, 42)
    steps = reasons(q)
    no = 1 + sum(1 for p in ep_files() if p.stem[11:] == "quiz" and p.stem < f"{d.isoformat()}-quiz")
    subj = re.sub(r"\s*\([^)]*\)", "", q["q"].split(", ")[0]).strip()
    badge = f"{subj} 얼마?" if len(subj) <= 6 else "얼마게?"
    qs = re.sub(r"\s*\([^)]*\)", "", q["q"])
    # 제목 = 검색 키워드(주제) + 질문 + 회차, 40자 이하·# 없음 (2026-11-15 조회수 규칙)
    title = f"{subj}, 얼마일까? | 오늘의 얼마게 {no}회"
    if len(title) > 40:
        title = f"오늘의 얼마게 {no}회: 3초 안에 맞혀 봐"
    return {
        "date": d.isoformat(), "kind": "short", "format": "quiz", "format_name": "오늘의 얼마게", "series_no": no,
        "slug": f"ep-{d.isoformat()}-quiz", "quiz_id": q["id"], "title": title, "site_path": "quiz.html",
        "takeaway": chunks(re.sub(r"\s*\([^)]*\)", "", q["why"].split(". ")[0]).rstrip(".") + ".", 40)[0],
        "description": f"오늘 돈삼촌 퀴즈와 같은 문제예요. 내일 문제는 https://don3chon.com/quiz 에서 매일 하나씩.\n{q['why']}",
        "scenes": [
            {"type": "skit", "bg": "room", "badge": badge, "lines": [
                {"who": "u", "u": "point", "n": "think", "cap": [f"오늘의 얼마게 #{no}"], "say": said[0]},
                *({"who": "u", "u": "talk", "n": "think", "cap": ["맞혀 봐!"], "say": x} for x in said[1:2]),
                {"who": "n", "n": "think", "u": "thumb", "cap": ["보기 줘!"], "say": "음, 보기 보여 줘!"},
            ]},
            {"type": "list", "title": q["q"], "items": q["o"], "say": "보기 네 개 중에 골라 봐."},
            {"type": "countdown", "text": "3초 안에 골라 봐", "say": ""},
            {"type": "skit", "bg": "room", "lines": [
                {"who": "n", "n": "think", "u": "think", "cap": [f"{wrong}?"], "say": f"음, 이건 쉽지. {speak(wrong)}!"},
                {"who": "u", "u": "facepalm", "n": "shock", "cap": ["땡!"], "sfx": "buzz", "big": ans, "sub": "정답",
                 "say": f"땡! 정답은 {speak(ans)}."},
            ]},
            # 2026-11-14 BK: "왜 그게 답인지도 알려줘야 한다" → 계산 근거를 한 줄씩 쌓아 보여 준다
            *({"type": "list", "title": f"왜 {ans}일까?", "items": steps[:k + 1], "say": c}
              for k, x in enumerate(steps) for c in chunks(speak(x), 42)),
            {"type": "skit", "bg": "room", "lines": [
                {"who": "n", "n": "happy", "u": "thumb", "cap": ["아하!"], "say": "아, 그래서 그 금액이구나!"},
                {"who": "n", "n": "happy", "u": "thumb", "cap": ["내일 문제는", "돈삼촌에서!"],
                 "say": "내일 문제는 돈삼촌에서 맞혀야지!"},
            ]},
            {"type": "end", "text": "내일 문제는 돈삼촌에서", "say": "오늘의 얼마게, 매일 한 문제씩 돈삼촌에서."},
        ],
    }


def write_quiz(d: dt.date) -> pathlib.Path | None:
    """얼마게 날(화·금)이면 그날 대본을 쓴다. 이미 있거나 다른 요일이면 None."""
    if d.weekday() not in QUIZ_DAYS:
        return None
    out = EP_DIR / f"{d.isoformat()}-quiz.json"
    if out.exists() or d in pending_dates():  # 그날 쇼츠가 이미 있으면 (예: 로테이션 바뀌기 전 11/17 돈 새는 구멍)
        return None
    spec = quiz_spec(d)
    if not spec:
        return None
    errs = check(spec)
    if errs:
        raise SystemExit(f"얼마게 대본 오류: {errs}")
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return out


# ---------- 검사 ----------
TYPES = {"hook", "photo", "calc", "versus", "countdown", "ox", "counter", "list", "bars", "chapter", "uncle", "skit", "end"}
BANNED = ["써 봤", "써봤", "직접 사용", "무조건", "100%", "최고의", "완치", "효능"]


SHORT_V3 = "2026-11-25"  # 20~25초·답 없는 제목 규칙 시작일 (BK 2026-11-18)


def _nums(text: str) -> set[str]:
    import re
    return {x.replace(",", "") for x in re.findall(r"\d[\d,]*", text or "")}


def title_errors(spec: dict) -> list[str]:
    """제목은 궁금증(?)으로 끝나고, 영상 속 답 숫자(big·calc value·counter·end text)를 미리 말하지 않는다.
    첫 줄 자막(질문에 나오는 조건 숫자, 예 '8시간')은 써도 된다."""
    e = []
    title = spec.get("title", "").strip()
    if not title.endswith("?"):
        e.append("제목은 '?'로 끝나는 궁금증 (예: '온풍기 vs 전기장판, 한 달 차이 얼마?')")
    answers, setup = set(), set()
    for i, s in enumerate(spec.get("scenes") or []):
        for j, ln in enumerate(s.get("lines") or []):
            answers |= _nums(ln.get("big", ""))
            if i == 0 and j == 0:
                setup |= _nums(" ".join(ln.get("cap", [])))
        answers |= _nums(str(s.get("value", ""))) | _nums(str(s.get("to", "")))
        if s.get("type") == "end":
            answers |= _nums(s.get("text", ""))
    leak = (_nums(title) & answers) - setup
    if leak:
        e.append(f"제목에 답 숫자 {sorted(leak)} — 답은 영상 안에서만 (제목은 '얼마?'·'몇 배?'로)")
    for w in ("배 차이", "분의 1"):
        if w in title and not title.endswith("?"):
            e.append(f"제목에 답('{w}') 금지")
    return e


def check(spec: dict) -> list[str]:
    if spec.get("engine") == "hyperframes":  # 2026-11-16 글자형 Shorts (pipeline.textshort): 장면·내레이션 없음
        return check_textshort(spec)
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
            elif str(s.get("clip")).startswith("outro"):
                e.append(f"장면 {i}: 수수료 외치는 outro 영상은 쓰지 않음 (고지는 화면 위 막대·제목·설명란·유료 프로모션으로)")
            continue
        if t == "skit":
            from .skit import check_lines
            if kind != "short":
                e.append(f"장면 {i}: skit 은 쇼츠 전용")
            e.extend(f"장면 {i}: {x}" for x in check_lines(s.get("lines")))
            if spec.get("style") == "live":
                from .live import check_lines as live_check
                e.extend(f"장면 {i}: {x}" for x in live_check(s.get("lines"), s))
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
    new = kind == "short" and spec.get("date", "") >= "2026-11-20"  # 2026-11-15 조회수 규칙 (docs/SHORTS_GROWTH.md)
    if new and spec.get("format") != "quiz":
        chars = (110, 240)  # 대략 18~33초: 끝까지 보고 다시 보게
    if new and len(title) > 40:
        e.append("쇼츠 제목 40자 이하 (검색 키워드 + 질문, 휴대폰에서 잘리지 않게)")
    if new and "#" in title:
        e.append("제목에 # 넣지 않기 (해시태그는 설명란에 자동)")
    if new and scenes and scenes[0].get("type") == "skit" and not scenes[0].get("badge"):
        e.append("첫 장면 skit 에 badge (썸네일·첫 1초 훅) 필수")
    # 2026-11-18 BK: 11/18 '온풍기 대신 전기장판, 한 달 차이가 10배?' 2회(37초, 첫 화면 삼촌 얼굴, 제목에 답).
    # → 11/25 편부터: 20~25초, 제목은 답 없이 궁금증으로 끝(?), 첫 화면·영상 안 정지된 실사 얼굴(삼촌 영상) 금지.
    if kind == "short" and spec.get("format") != "quiz" and spec.get("date", "") >= SHORT_V3:
        chars = (100, 150)
        e.extend(title_errors(spec))
        if any(s.get("type") == "uncle" for s in scenes):
            e.append("쇼츠에 삼촌 얼굴 영상(uncle) 금지 — 첫 화면이 정지된 얼굴이면 넘김 (skit·hook 로 시작)")
    if not chars[0] <= words <= chars[1]:
        e.append(f"내레이션 글자 수 {words} (권장 {chars[0]}~{chars[1]})")
    if has_ad and not any(s.get("type") == "end" for s in scenes):
        e.append("상품 편은 end 장면(가격·사이트)")
    if has_ad and kind == "short" and spec.get("date", "") >= "2026-11-16" and not any(s.get("type") == "end" and s.get("text") for s in scenes):
        e.append("쇼츠 end 는 상품 대신 계산 결과·꿀팁 한 줄(text)")
    if has_ad and spec.get("date", "") >= "2026-11-16":
        e.append("상품 편 중단 (2026-11-14 BK: 홈페이지 유입에 주력) — product/products 빼기")
    if not spec.get("description"):
        e.append("description (설명란 소개 1~3줄) 없음")
    if kind == "short" and spec.get("date", "") >= "2026-11-20":  # 정보의 장 (2026-11-14 BK)
        if not (spec.get("takeaway") and len(spec["takeaway"]) <= 40):
            e.append("takeaway (정보 가치 한 줄, 40자 이하) 없음")
        if spec.get("site_path") not in site_pages():
            e.append("site_path 는 site_pages 중 하나 (자세한 내용이 있는 사이트 페이지)")
        pre = SITE_PREFIX.get(spec.get("format"))
        if pre and not str(spec.get("site_path", "")).startswith(pre):
            e.append(f"{spec.get('format')} 형식의 site_path 는 {pre} 로 시작")
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
        y_items = H * 0.30
        if len(s.get("title", "")) > 14 and not L:  # 긴 제목(얼마게 문제)은 3줄까지 감싸기
            f, rows = _wrap(dr, s["title"], 64, W - 140, 3)
            for j, r in enumerate(rows):
                _center(dr, W / 2, H * 0.13 + j * 84, r, f, "#1f5f4a")
            y_items = H * 0.13 + len(rows) * 84 + 110
        else:
            _center(dr, W / 2, H * (0.16 if L else 0.18), s.get("title", ""), _font(70), "#1f5f4a")
        items = s["items"]
        step = d / (len(items) + 1)
        for j, it in enumerate(items):
            if t < step * j * 0.8:
                break
            f, rows = _wrap(dr, f"{j + 1}. {it}", 60 if L else 56, W - 200, 2)
            for r_i, r in enumerate(rows):
                dr.text((140 if L else 90, y_items + j * (150 if L else 190) + r_i * 70), r, font=f, fill="#2b2a28")
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
        if cv.long:  # 2026-11-14 BK: 쇼츠 끝 카드는 상품 대신 계산 결과·꿀팁 한 줄 (링크는 설명란·고정 댓글)
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
    chapters, t_acc, credits = [], 0.0, []
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
                from . import webtoon
                if spec.get("style", "webtoon") == "webtoon" and webtoon.available():  # 2026-11-13 BK: 그림체 A
                    render_part = webtoon.render_part
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
                kw = {"pet": spec.get("pet", True)} if render_part is webtoon.render_part else {}  # 2026-11-17 마스코트 동전이
                prog = lambda x, t0=t_acc: min(1.0, (t0 + x) / est)  # noqa: E731
                done = None
                if spec.get("style") == "live":  # 2026-11-18 BK: 실사 배경 (무료 스톡). 실패하면 웹툰으로
                    from . import live
                    try:
                        if not live.available():
                            raise RuntimeError("PEXELS_API_KEY/PIXABAY_API_KEY·AI 클립 없음")
                        cr: list = []
                        done = live.render_part(ss[0]["lines"], ad, part, tmp, img, progress=prog, badge=ss[0].get("badge"),
                                                pet=spec.get("pet", True), scene=ss[0], date=spec["date"], credits=cr,
                                                sheet=MEDIA / f"{slug}.check.jpg")  # 어색한 장면 확인용
                        credits += cr
                    except Exception as ex:  # noqa: BLE001
                        print(f"실사 배경 실패 → 웹툰으로: {ex}")
                        render_part, kw = webtoon.render_part, {"pet": spec.get("pet", True)}
                if done is None:
                    done = render_part(ss[0]["lines"], ad, part, tmp, img, progress=prog,
                                       bg=ss[0].get("bg", "room"), badge=ss[0].get("badge"), **kw)
                t_acc += done
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
    if credits:  # 실사 배경 출처 → 설명란 (youtube.episode_rows)
        meta["credits"] = [{k: c[k] for k in ("id", "credit", "page", "query", "lines", "ai", "realistic") if k in c} for c in credits]
        from .live import remember
        remember(credits, spec["date"])
    path.with_suffix(".meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"완성: {out} ({t_acc:.1f}초, {out.stat().st_size / 1e6:.1f}MB)")
    return out


def check_textshort(spec: dict) -> list[str]:
    e = []
    try:
        dt.date.fromisoformat(spec.get("date", ""))
    except ValueError:
        e.append("date 형식")
    title = spec.get("title", "").strip()
    if not 4 <= len(title) <= 60 or "#" in title or "[광고]" in title or "<" in title or ">" in title:
        e.append("제목 4~60자, # ·[광고]·<> 없음")
    if spec.get("product") or spec.get("products"):
        e.append("글자형은 상품 없음")
    if not spec.get("takeaway") or len(spec["takeaway"]) > 40:
        e.append("takeaway 1~40자")
    if spec.get("site_path") not in ("index.html", "report.html"):
        e.append("site_path 는 index.html 또는 report.html")
    if "출처" not in spec.get("description", ""):
        e.append("설명에 출처")
    return e


def unrendered() -> list[pathlib.Path]:
    """대본은 있는데 아직 영상(meta)이 없는 것."""
    return [p for p in ep_files() if not p.with_suffix(".meta.json").exists()]


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "render"
    today = dt.datetime.now(KST).date()
    if cmd == "next":
        print(json.dumps(info_short(today), ensure_ascii=False, indent=1))
    elif cmd == "quiz":  # 오늘(KST) 또는 지정 날짜의 얼마게 대본
        d = dt.date.fromisoformat(argv[1]) if len(argv) > 1 else dt.datetime.now(KST).date()
        print(write_quiz(d) or "얼마게 날 아님 또는 이미 있음")
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
