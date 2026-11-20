"""동전이 시즌 빌드업 (BK 2026-11-20 "준비하세요 LLM 의 장점을 살려 빌드업을 해주세요").

초반에 터진 쇼츠 사례 조사(2026-11-20, Claude Doc '초반 쇼츠 대박 사례 조사')의 공통점:
한 편짜리가 아니라 같은 캐릭터가 이어지는 시리즈를 빠르게 쌓았고, 시청자가 다음 편을 고르게 했다(Fruit Love Island 투표 등).
그래서 삼촌 만화 쇼츠를 '시즌'으로 묶고, 언어 모델이 잘하는 세 가지를 쓴다.

1. 기억: 시즌 목표·반복 개그·지난 편 줄거리를 data/toon/season.json 에 쌓고, 대본 작가(claude_jobs.toon)가 매 편
   지난 편을 한 번 받아치게 한다(콜백). 편마다 독립된 이야기는 그대로(처음 보는 사람도 이해) — 시즌은 양념이다.
2. 시청자 투표: 매 편 엔딩에 '다음엔 뭐가 샐까? A / B' (주제 두 개). 공개 하루 뒤 댓글을 읽어(유튜브 공개 댓글, 읽기만)
   Claude 가 A·B 로 나눠 센다. 실제 댓글이 MIN_VOTES 개 이상일 때만 결과로 쓰고, 이긴 주제는 다음 대본의 주제가 된다
   (첫 컷 자막 '댓글로 고른 ○○ 편!'). 표가 모자라면 결과를 지어내지 않고 그냥 넘어간다.
3. 터진 편 이어 가기: yt_early 가 '터짐'(평소 2시간 조회의 BREAKOUT 배 이상)으로 적은 편이 있으면 다음 BREAKOUT_EPS 편은
   그 편의 훅 유형·이야기 틀을 다시 쓴다(장소·모양·제목 말은 바꿈). 반복 금지 감점에서 그 두 칸만 뺀다.

실사 특별편(주말)은 시즌 밖 단독 편이다. 댓글에 답하거나 고정하는 자동화는 하지 않는다(읽기만, docs/OPERATIONS.md).
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[2]
SEASON_REL = "data/toon/season.json"
SERIES_FROM = "2026-11-21"  # BK 11/20 "토요일부터 적용해줘": 이날 이후 공개 만화 편부터 엔딩 투표
SEASON_LEN = 10          # 한 시즌 편수 (이틀에 1편 → 약 3주)
MIN_VOTES = 3            # 댓글 투표가 이만큼 모여야 결과로 쓴다 (새 채널이라 낮게, 숫자는 화면에 안 씀)
POLL_AGE_H = 20          # 공개 뒤 이만큼 지나야 센다
POLL_MAX_DAYS = 14       # 이보다 오래된 투표는 안 센다
VOTE_MAX = 8             # 엔딩 화면 A/B 주제 글자 수
BREAKOUT_EPS = 2         # 터진 편 뒤 같은 틀로 이어 갈 편수
COMMENTS_API = "https://www.googleapis.com/youtube/v3/commentThreads"


# ---------- 저장 ----------
def season_path() -> pathlib.Path:
    return ROOT / SEASON_REL


def load() -> dict:
    try:
        return json.loads(season_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save(st: dict) -> None:
    season_path().parent.mkdir(parents=True, exist_ok=True)
    season_path().write_text(json.dumps(st, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def need_new_season(st: dict) -> bool:
    s = st.get("season")
    return not s or len([x for x in st.get("log", []) if x.get("season") == s.get("id")]) >= SEASON_LEN


SEASON_SCHEMA = {"type": "object", "properties": {
    "title": {"type": "string"}, "goal": {"type": "string"}, "running_gag": {"type": "string"},
    "topics": {"type": "array", "items": {"type": "string"}}},
    "required": ["title", "goal", "running_gag", "topics"], "additionalProperties": False}


def plan_season(cj, bible: str, date: str, recent: list[str]) -> dict:
    """Claude 로 새 시즌 한 줄 설정. 실패하면 규칙 기반 기본 시즌."""
    sys_ = (cj.direction() + "너는 한국 유튜브 쇼츠 만화 '동전이네'의 시즌 기획자다. 바이블을 지킨다.\n" + bible + "\n\n" + cj.POLICY)
    user = ("다음 시즌(이틀에 1편, 10편)을 한 줄로 묶을 설정을 만들어 줘.\n"
            "- title: 시즌 이름(12자 이하, 예 '동전이 겨울 대작전')\n"
            "- goal: 동전이가 시즌 내내 이루려는 귀여운 목표 하나(예 '꿀꿀이 저금통을 크리스마스까지 꽉 채우기'). 편마다 조금씩 다가가거나 멀어진다.\n"
            "- running_gag: 매 편 한 번 나오는 반복 개그(대사 없이 화면으로 되는 것, 예 '조카가 몰래 동전 하나를 빼 가다 들킴')\n"
            "- topics: 이 시즌에 다룰 '새는 돈' 주제 12개(각 8자 이하, 주부 살림, 서로 다르게). 시청자 투표 후보로 쓴다.\n"
            "편마다 처음 보는 사람도 이해되는 독립 이야기여야 한다(시즌은 양념).\n최근 편: " + " / ".join(recent[:10]))
    try:
        r = cj.ask("toon", sys_, user, schema=SEASON_SCHEMA, model=cj.SONNET, effort="medium", max_tokens=1500, need=0.05)
    except Exception as e:  # 예산·키 없음 → 기본 시즌
        print(f"시즌 기획 건너뜀: {e}")
        r = {"title": "동전이 겨울 대작전", "goal": "꿀꿀이 저금통을 연말까지 꽉 채우기",
             "running_gag": "조카가 몰래 동전 하나를 빼 가다 동전이한테 들킴",
             "topics": ["난방비", "전기장판", "온수", "가습기", "배달비", "구독료", "김장", "택배비", "정수기", "세탁기", "건조기", "대기전력"]}
    return {"id": date, "title": r["title"][:20], "goal": r["goal"][:60], "running_gag": r["running_gag"][:60],
            "topics": [t[:VOTE_MAX] for t in r.get("topics", []) if t][:12], "started": date}


# ---------- 댓글 투표 ----------
def video_of(date: str) -> str | None:
    """그 날짜 공개 삼촌 편의 유튜브 id (업로드 기록 data/youtube/uploaded.json)."""
    from .youtube import LOG
    path = LOG if LOG.is_absolute() else ROOT / LOG
    try:
        up = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    for slug, v in up.items():
        if slug.startswith(f"ep-{date}") and v.get("video_id"):
            return v["video_id"]
    return None


def fetch_comments(video_id: str, n: int = 100) -> list[str]:
    """공개 댓글 본문(최상위만). 읽기 전용 API 키 또는 업로드 토큰. 실패하면 빈 목록."""
    from .yt_stats import _get
    from .youtube import access_token
    q = {"part": "snippet", "videoId": video_id, "maxResults": min(n, 100), "order": "relevance", "textFormat": "plainText"}
    js = None
    if all(os.environ.get(k) for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN")):
        try:
            tok = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"], os.environ["YT_REFRESH_TOKEN"])
            js = _get(COMMENTS_API + "?" + urllib.parse.urlencode(q), tok)
        except Exception:
            js = None
    key = os.environ.get("YT_API_KEY", "").strip()
    if js is None and key:
        try:
            js = _get(COMMENTS_API + "?" + urllib.parse.urlencode({**q, "key": key}))
        except Exception as e:
            print(f"댓글 읽기 실패: {e}")
            return []
    out = []
    for it in (js or {}).get("items", []):
        t = it.get("snippet", {}).get("topLevelComment", {}).get("snippet", {}).get("textDisplay", "")
        if t:
            out.append(" ".join(t.split())[:200])
    return out


TALLY_SCHEMA = {"type": "object", "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
                "required": ["a", "b"], "additionalProperties": False}


def quick_count(a: str, b: str, comments: list[str]) -> dict:
    """규칙 셈: 'A'/'B' 글자나 주제 이름이 한쪽만 나온 댓글."""
    na = nb = 0
    for c in comments:
        u = c.strip().upper()
        ha = a in c or u == "A" or u.startswith(("A ", "A!", "A.", "A요", "A가", "A번"))
        hb = b in c or u == "B" or u.startswith(("B ", "B!", "B.", "B요", "B가", "B번"))
        if ha and not hb:
            na += 1
        elif hb and not ha:
            nb += 1
    return {"a": na, "b": nb}


def tally(cj, a: str, b: str, comments: list[str], job: str = "toon") -> dict:
    """댓글을 A/B 로 나눠 센다. Claude(싸게 Sonnet) → 실패하면 규칙 셈. 숫자는 댓글 수를 넘지 못한다."""
    if not comments:
        return {"a": 0, "b": 0, "by": "없음"}
    try:
        r = cj.ask(job, "유튜브 댓글 투표를 센다. 질문은 'A 또는 B 중 무엇을 고르나'. 댓글마다 A를 원함/B를 원함/상관없음 중 하나로 보고 "
                   "A·B 개수만 JSON 으로. 농담·비꼼도 뜻을 읽어서. 한 댓글은 한 표.",
                   json.dumps({"A": a, "B": b, "댓글": comments}, ensure_ascii=False),
                   schema=TALLY_SCHEMA, model=cj.SONNET, effort="low", max_tokens=200, need=0.02)
        na, nb = max(0, int(r["a"])), max(0, int(r["b"]))
        if na + nb <= len(comments):
            return {"a": na, "b": nb, "by": "AI"}
    except Exception as e:
        print(f"댓글 셈 API 건너뜀: {e}")
    return {**quick_count(a, b, comments), "by": "규칙"}


def update_polls(cj, st: dict, today: dt.date) -> list[str]:
    """공개 하루 지난 투표를 센다. 바뀐 투표 날짜 목록."""
    done = []
    for p in st.get("polls", []):
        if p.get("result") is not None:
            continue
        d = dt.date.fromisoformat(p["date"])
        age_days = (today - d).days
        if age_days * 24 < POLL_AGE_H or age_days > POLL_MAX_DAYS:
            if age_days > POLL_MAX_DAYS:
                p["result"] = {"a": 0, "b": 0, "by": "기한 지남"}
                done.append(p["date"])
            continue
        vid = video_of(p["date"])
        if not vid:
            continue
        r = tally(cj, p["a"], p["b"], fetch_comments(vid))
        if r["a"] + r["b"] >= MIN_VOTES and r["a"] != r["b"]:
            r["winner"] = p["a"] if r["a"] > r["b"] else p["b"]
            p["result"] = r
            done.append(p["date"])
    return done


def open_winner(st: dict) -> dict | None:
    """아직 대본에 안 쓴 투표 승자(가장 오래된 것)."""
    for p in st.get("polls", []):
        r = p.get("result") or {}
        if r.get("winner") and not p.get("used"):
            return p
    return None


# ---------- 터진 편 ----------
def breakout(st: dict) -> dict | None:
    """yt_early 가 남긴 삼촌 '터짐' 편. 그 뒤로 BREAKOUT_EPS 편까지만 이어 간다."""
    from .yt_early import load_lessons
    b = load_lessons().get("삼촌", {}).get("breakout")
    if not b:
        return None
    used = st.get("breakout_used", {}).get(b.get("from", ""), [])
    return b if len(used) < BREAKOUT_EPS else None


# ---------- 대본 작가에게 줄 덩어리 ----------
def prepare(cj, bible: str, date: str, recent: list[str], today: dt.date) -> tuple[str, dict]:
    """(작가 프롬프트에 넣을 글, 이번 편 문맥). 상태 파일은 record() 에서 저장한다."""
    st = load()
    if need_new_season(st):
        st["season"] = plan_season(cj, bible, date, recent)
        st.setdefault("log", [])
    update_polls(cj, st, today)
    s = st["season"]
    mine = [x for x in st.get("log", []) if x.get("season") == s["id"]]
    win = open_winner(st)
    used_topics = {x.get("topic") for x in st.get("log", [])} | {p["a"] for p in st.get("polls", [])} | {p["b"] for p in st.get("polls", [])}
    free = [t for t in s.get("topics", []) if t not in used_topics] or s.get("topics", [])
    br = breakout(st)
    out = [f"[시즌 빌드업 — '{s['title']}' {len(mine) + 1}/{SEASON_LEN}편 (BK 11/20 '빌드업')]",
           f"- 시즌 목표: {s['goal']} → 이번 편 끝에 목표에 조금 다가가거나(성공) 멀어진다(실패). 4번 컷 화면에 살짝 보이게.",
           f"- 반복 개그(매 편 한 번, 화면으로): {s['running_gag']}",
           "- 처음 보는 사람도 이 편만으로 이해돼야 한다. 지난 편 설명 자막 금지, 대신 아래 지난 편에서 소품·표정 하나를 받아쳐라(콜백)."]
    if mine:
        out.append("- 지난 편들(최신이 위): " + " / ".join(f"「{x['title']}」{x.get('summary', '')}" for x in mine[::-1][:3]))
    if win:
        out.append(f"- 시청자가 댓글로 고른 주제: **{win['result']['winner']}** ({win['date']} 편 투표). 이번 편 주제로 쓰고, 1번 컷 자막 첫 줄을 "
                   f"'댓글로 고른 {win['result']['winner']} 편!'으로 시작한다(표 숫자는 쓰지 않는다).")
    out.append("- 엔딩 투표: vote_a·vote_b 에 다음에 다룰 '새는 돈' 주제 두 개(각 8자 이하, 서로 확실히 다르게, 이번 편 주제와 다르게)를 쓴다. "
               "시즌 주제 후보: " + ", ".join(free[:8]) + ". 엔딩 화면에 '다음엔 뭐가 샐까? A / B 댓글로!'로 나간다.")
    out.append("- summary 에 이번 편 줄거리 한 줄(30자 이하, 다음 편 콜백용)을 쓴다.")
    if br:
        out.append(f"- [터진 편 이어 가기] 「{br.get('title', '')}」 편이 평소의 {br.get('ratio', '?')}배로 터졌다. 이번 편은 그 편의 첫 3초 훅 유형"
                   f"({br.get('hook_type') or '같은 방식'})과 이야기 틀({br.get('frame') or '같은 틀'})을 다시 쓴다. 장소·새는 돈 모양·제목 말은 새로.")
    ctx = {"season": s, "winner": win, "breakout": br, "free_topics": free}
    return "\n".join(out) + "\n\n", ctx


def allow_repeat(ctx: dict) -> set[str]:
    """반복 금지 감점에서 뺄 칸 (터진 편 이어 가기)."""
    return {"hook_type", "frame"} if ctx.get("breakout") else set()


def clean_vote(t: str) -> str:
    t = " ".join((t or "").split())
    return t[:VOTE_MAX]


def record(date: str, v: dict, ctx: dict) -> pathlib.Path:
    """고른 안(1안)을 시즌 기록에 남기고 투표를 연다. 대본 후보 PR 에 같이 실린다(병합 = 확정)."""
    st = load()
    s = ctx["season"]
    st["season"] = s
    log = [x for x in st.get("log", []) if x.get("date") != date]
    win = ctx.get("winner")
    log.append({"date": date, "season": s["id"], "title": v.get("title", ""), "summary": (v.get("summary") or "")[:40],
                "topic": win["result"]["winner"] if win else ""})
    st["log"] = log[-40:]
    polls = [p for p in st.get("polls", []) if p.get("date") != date]
    a, b = clean_vote(v.get("vote_a", "")), clean_vote(v.get("vote_b", ""))
    if a and b and a != b:
        polls.append({"date": date, "a": a, "b": b, "result": None})
    if win:
        for p in polls:
            if p["date"] == win["date"]:
                p["used"] = date
    st["polls"] = polls[-30:]
    br = ctx.get("breakout")
    if br:
        st.setdefault("breakout_used", {}).setdefault(br.get("from", ""), [])
        if date not in st["breakout_used"][br.get("from", "")]:
            st["breakout_used"][br.get("from", "")].append(date)
    save(st)
    return season_path()


def ensure_vote(date: str) -> dict | None:
    """조립할 때 그 날짜 투표를 돌려준다. 대본 작업이 안 만든 편(11/21~ BK 클립으로 바로 조립하는 편)은
    시즌 주제 후보에서 안 쓴 두 개로 투표를 열고 기록한다. 주말(실사 특별편)·SERIES_FROM 전·시즌 없음이면 None."""
    v = vote_of(date)
    if v:
        return v
    try:
        d = dt.date.fromisoformat(date)
    except ValueError:
        return None
    st = load()
    s = st.get("season")
    if not s or date < SERIES_FROM or d.weekday() >= 5:
        return None
    used = {p["a"] for p in st.get("polls", [])} | {p["b"] for p in st.get("polls", [])} | {x.get("topic") for x in st.get("log", [])}
    free = [t for t in s.get("topics", []) if t not in used]
    if len(free) < 2:
        return None
    st.setdefault("polls", []).append({"date": date, "a": free[0], "b": free[1], "result": None})
    save(st)
    return {"a": free[0], "b": free[1]}


def vote_of(date: str) -> dict | None:
    """조립 도구·대본 작업이 쓰는 그 편의 엔딩 투표 {a, b}."""
    for p in load().get("polls", []):
        if p.get("date") == date:
            return {"a": p["a"], "b": p["b"]}
    return None
