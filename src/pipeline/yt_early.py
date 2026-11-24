"""쇼츠 공개 2시간 반응 리포트 (2026-11-20 BK "유튜브 1~2시간 반응 리포트·개선 방향 체크").

공개 뒤 약 2시간 된 쇼츠(삼촌 채널·5락실 채널)의 공개 통계(조회·좋아요·댓글)를 읽어 data/youtube/early.json 에 남기고,
같은 채널·같은 종류의 지난 편 '2시간 기록'과 비교해 텔레그램(관리자 대화방)으로 짧게 보낸다.
개선 힌트 한 줄은 Claude API(작업 'early', 회차 상한 1달러, 편당 약 0.5센트). 실패하면 규칙 기반 한 줄.

개선 고리 (BK 11/20 "리포트보다 그 뒤 개선 방안을 잡는 것이 중요"):
- 매 편 '다음 편 규칙' 한 줄을 받아 data/youtube/early_lessons.json 에 종류별로 쌓는다(최근 5개, 잘된·느린 편 훅 포함).
- 삼촌: claude_jobs.toon(07:10 대본 후보)이 이 칸을 작가·채점 프롬프트에 넣는다 → 다음 대본에 자동 반영.
- 5락실: claude_jobs.shorts(월 07:30 주간 규칙 PR)가 2시간 기록을 같이 읽고, 질문 예약 작업은 docs/5RAKSIL_PROMO.md 안내대로 이 파일을 읽는다.
- 제목 교체는 자동으로 하지 않는다(업로드 토큰 권한 밖 + 공개 중 영상 변경은 BK 판단). 느린 편엔 대체 제목 한 줄만 제안.

한계(리포트에 그대로 적는다):
- 공개 조회수는 몇 분~수십 분 늦게 올라온다. 시청 지속·공유·구독은 Analytics API 가 하루 단위·1~2일 늦게 줘서 2시간 시점엔 없다
  → 그건 매일 22:41 yt-stats 와 주간 점검에서 본다.
- 2시간 기록은 이 작업이 생긴 날부터 쌓인다. 쌓이기 전에는 '첫날 밤(22:41) 기록'을 참고로만 보여 준다.

    python -m pipeline.yt_early            # 지금 2시간 근처인 편 보고 (Actions 19:10·21:10·22:10 KST)
    python -m pipeline.yt_early --dry      # 보내지 않고 출력만
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import statistics
import sys

from .youtube import KST, LOG
from .yt_stats import EP_DIR, RAKSIL, STATS, fetch_stats

EARLY = pathlib.Path("data/youtube/early.json")
LESSONS = pathlib.Path("data/youtube/early_lessons.json")
KEEP_RULES = 5
MIN_AGE, MAX_AGE = 80, 240     # 분. 이 사이면 '2시간 근처' → 2시간 비교 기준에 들어감
LATE_MAX = 30 * 60             # 분. GitHub 예약이 몇 시간씩 늦게 도는 날(11/20 최대 9시간)엔 늦게라도 보고하되 비교 기준에선 뺀다
LOOKBACK_DAYS = 3              # 업로드 기록에서 최근 며칠 것만 본다 (API 할당량 아끼기)
NEED_BASE = 3                  # 2시간 기록이 이만큼 쌓여야 '평소 대비' 판정
BREAKOUT = 3.0                 # 평소 2시간 중간값의 이 배 이상 = '크게 터짐' → 다음 2편 같은 훅·틀 (toon_series, BK 11/20 '빌드업')


# ---------- 어떤 편인지 ----------
def kind_of(slug: str) -> str:
    if slug.startswith("webnovel-"):  # 11/23 통계에 웹소설·음악 채널도 들어감 → 삼촌 기준값에 섞이지 않게
        return "웹소설"
    if slug.startswith("music-"):
        return "음악"
    if not slug.startswith("5raksil-"):
        return "삼촌"
    if "-game-" in slug:
        return "5락실 게임"
    if "meme" in slug:
        return "5락실 몽글이"
    return "5락실 밸런스"


def _parse(ts: str) -> dt.datetime | None:
    try:
        t = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    return t if t.tzinfo else t.replace(tzinfo=KST)


def _slug_date(slug: str) -> dt.date | None:
    s = slug.removeprefix("5raksil-").removeprefix("ep-")
    for cand in (s[:10], f"{s[:4]}-{s[4:6]}-{s[6:8]}"):
        try:
            return dt.date.fromisoformat(cand)
        except ValueError:
            continue
    return None


def episode_info(slug: str) -> dict:
    """삼촌 편 대본에서 제목·형식·첫 대사(훅)."""
    for p in EP_DIR.glob("*.json"):
        if p.name.endswith(".meta.json"):
            continue
        try:
            s = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if s.get("slug") != slug and f"ep-{p.stem}" != slug:
            continue
        hook = ""
        for sc in s.get("scenes", [])[:1]:
            for ln in sc.get("lines", [])[:1]:
                hook = ln.get("say", "")
            hook = hook or sc.get("text", "") or sc.get("badge", "")
        style = ""
        mp = p.with_name(p.stem + ".meta.json")
        try:
            style = json.loads(mp.read_text(encoding="utf-8")).get("style", "") if mp.exists() else ""
        except (OSError, ValueError):
            style = ""
        return {"title": s.get("title", ""), "format": s.get("format_name") or s.get("format", ""), "hook": hook,
                "style": style}
    return {}


def recent_uploads(now: dt.datetime) -> dict[str, dict]:
    """video_id → {slug, kind, title, public_at(로그에 있으면)}. 최근 LOOKBACK_DAYS 일 것만."""
    out = {}
    cutoff = now.astimezone(KST).date() - dt.timedelta(days=LOOKBACK_DAYS)
    up = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {}
    for slug, v in up.items():
        vid, at = v.get("video_id"), _parse(v.get("publish_at") or "")
        d = at.astimezone(KST).date() if at else _slug_date(slug)
        if vid and d and d >= cutoff:
            out[vid] = {"slug": slug, "kind": kind_of(slug), "public_at": at, **episode_info(slug)}
    rk = json.loads(RAKSIL.read_text(encoding="utf-8")) if RAKSIL.exists() else {}
    for k, v in rk.items():
        slug = "5raksil-" + k
        d = _slug_date(slug)
        if isinstance(v, dict) and v.get("id") and d and d >= cutoff:
            out[v["id"]] = {"slug": slug, "kind": kind_of(slug), "public_at": None, "title": v.get("title", "")}
    return out


def raksil_public_at(slug: str, uploaded: dt.datetime | None) -> dt.datetime | None:
    """5락실은 업로드 기록에 공개 시각이 없다. 그날 17:00(게임 20:00) 전에 올렸으면 그 시각 예약 공개(raksil_shorts.publish_time),
    그 뒤면 바로 공개. publishedAt 은 업로드 시각이라 그대로 쓰면 아침에 미리 올린 편의 나이가 몇 시간 부풀려진다."""
    d = _slug_date(slug) if slug.startswith("5raksil-") else None
    if not uploaded or not d:
        return uploaded
    at = dt.datetime.combine(d, dt.time(20 if "-game-" in slug else 17), KST)  # 게임 쇼츠 20시(raksil_games.HOUR)
    return max(uploaded, at)

# ---------- 비교 기준 ----------
def per2h(row: dict) -> float:
    """나이가 조금씩 달라서 2시간(120분) 기준으로 맞춘 조회수 (직선 환산, 대략값)."""
    return row["views"] * 120 / max(row["age_min"], 30)


def baseline(early: dict, kind: str, exclude: str) -> list[float]:
    return [per2h(r) for vid, r in early.items()
            if r.get("kind") == kind and vid != exclude and r.get("age_min", 0) <= MAX_AGE]


def first_night(stats: dict, kind: str, exclude: str) -> tuple[int, float] | None:
    """2시간 기록이 쌓이기 전 참고값: 지난 편들의 공개 당일 22:41 조회수 평균과 그때 평균 나이(시간)."""
    vals, ages = [], []
    for day, snap in stats.items():
        try:
            at = dt.datetime.fromisoformat(day + "T22:41:00+09:00")
        except ValueError:
            continue
        for slug, v in snap.items():
            pub = _parse(v.get("published", ""))
            if v.get("id") == exclude or kind_of(slug) != kind or not pub:
                continue
            if pub.astimezone(KST).date().isoformat() == day and at > pub:
                vals.append(v["views"])
                ages.append((at - pub).total_seconds() / 3600)
    if not vals:
        return None
    return int(statistics.mean(vals)), round(statistics.mean(ages), 1)


def verdict(now_2h: float, base: list[float]) -> tuple[str, float | None]:
    if len(base) < NEED_BASE:
        return "기준 쌓는 중", None
    med = statistics.median(base)
    r = now_2h / med if med else None
    if r is None:
        return "기준 쌓는 중", None
    if r >= BREAKOUT:
        return "크게 터짐", r
    if r >= 1.5:
        return "평소보다 잘 나감", r
    if r >= 0.7:
        return "평소 수준", r
    return "평소보다 느림", r


# ---------- 개선 힌트 ----------
HINT_SYS = ("너는 유튜브 쇼츠 코치다. 공개 2시간 숫자와 지난 편 기준을 보고 JSON 으로 답한다. "
            "now=지금 바로 할 것 한 문장(고정 댓글 질문 하나 등, 할 게 없으면 빈 문자열), "
            "next=다음 편 대본·첫 장면·제목에 넣을 구체적 규칙 한 문장(35자 이내), "
            "title=판정이 '평소보다 느림'일 때만 대체 제목 하나(없으면 빈 문자열). 모두 한국어. "
            "숫자를 지어내지 말고, 시청 지속률은 아직 없으니 단정하지 않는다. 클릭 낚시·좋아요 구걸·구독 강요·상품·할인·쇼핑몰 이름 금지. "
            "아래 '지금 방향'을 지킨다.\n")
HINT_SCHEMA = {"type": "object", "properties": {"now": {"type": "string"}, "next": {"type": "string"}, "title": {"type": "string"}},
               "required": ["now", "next", "title"], "additionalProperties": False}
BAD = ("쿠팡", "알리", "테무", "할인", "특가", "좋아요 눌", "구독 눌", "구독해", "http")


def rule_hint(row: dict, label: str) -> dict:
    v, likes, com = row["views"], row["likes"], row["comments"]
    if v < 30:
        nxt = "첫 장면에 결과(반전)를 먼저 보여 주기"
    elif likes / max(v, 1) < 0.01:
        nxt = "반전을 한 박자 빨리, 전체 길이 줄이기"
    elif label in ("평소보다 잘 나감", "크게 터짐"):
        nxt = f"이번 훅 '{(row.get('hook') or row.get('title', ''))[:20]}' 방식을 변형해 한 번 더"
    else:
        nxt = "첫 자막을 숫자 대신 상황 한 줄로"
    return {"now": "고정 댓글에 '너라면?' 질문 하나" if com == 0 else "", "next": nxt, "title": "", "by": "규칙"}


def _clean(t: str, n: int) -> str:
    t = " ".join((t or "").split())
    return "" if any(b in t for b in BAD) else t[:n]


def ai_hint(row: dict, label: str, base: list[float], night: tuple[int, float] | None) -> dict | None:
    try:
        from . import claude_jobs as cj
        section = "2-3" if row["kind"] == "삼촌" else "2-2"
        user = json.dumps({"종류": row["kind"], "제목": row.get("title", ""), "첫대사": row.get("hook", ""),
                           "공개후_분": row["age_min"], "조회": row["views"], "좋아요": row["likes"], "댓글": row["comments"],
                           "판정": label, "지난편_2시간_중간값": round(statistics.median(base)) if base else None,
                           "지난편_첫날밤_평균": night[0] if night else None,
                           "이미_쌓인_규칙": lessons_for(row["kind"])}, ensure_ascii=False)
        res = cj.ask("early", cj.direction(section) + HINT_SYS, user, model=cj.SONNET, effort="low",
                     schema=HINT_SCHEMA, max_tokens=500, need=0.02)
    except Exception as e:  # 키 없음·예산·네트워크 → 규칙 한 줄
        print(f"힌트 API 건너뜀: {e}")
        return None
    out = {"now": _clean(res.get("now"), 60), "next": _clean(res.get("next"), 50),
           "title": _clean(res.get("title"), 60) if label == "평소보다 느림" else "", "by": "AI"}
    return out if out["next"] else None


# ---------- 개선 고리: 다음 편이 읽는 교훈 ----------
def load_lessons() -> dict:
    try:
        return json.loads(LESSONS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def lessons_for(kind: str) -> list[str]:
    return [r["rule"] for r in load_lessons().get(kind, {}).get("rules", [])]


def update_lessons(lessons: dict, early: dict, row: dict, label: str, hint: dict, ratio: float | None = None) -> dict:
    k = lessons.setdefault(row["kind"], {"rules": []})
    rules = [r for r in k["rules"] if r["rule"] != hint["next"]]
    rules.insert(0, {"rule": hint["next"], "from": row["public_at"][:10], "label": label})
    k["rules"] = rules[:KEEP_RULES]
    rows = sorted((r for r in early.values() if r.get("kind") == row["kind"] and r.get("age_min", 0) <= MAX_AGE),
                  key=per2h, reverse=True)
    pick = lambda r: {"title": (r.get("title") or r["slug"]).replace("#shorts", "").strip()[:50], "views_2h": round(per2h(r))}
    k["best"] = [pick(r) for r in rows[:3]]
    k["slow"] = [pick(r) for r in rows[-3:][::-1]] if len(rows) > 3 else []
    k["updated"] = row["checked_at"]
    if label == "크게 터짐":  # 터진 편은 다음 편들이 같은 훅·틀로 이어 간다 (사례 조사 11/20: 터지면 같은 틀로 바로 더)
        k["breakout"] = {"from": row["public_at"][:10], "title": (row.get("title") or row["slug"]).replace("#shorts", "").strip()[:50],
                         "hook": (row.get("hook") or "")[:60], "ratio": round(ratio or 0, 1),
                         **lab_variety(row["public_at"][:10])}
    return lessons


def lab_variety(date: str) -> dict:
    """삼촌 편 대본 랩 노트(1안)의 첫 3초 훅 유형·이야기 틀. 없으면 빈 칸."""
    p = pathlib.Path("data/toon/lab") / f"{date}.md"
    out = {"hook_type": "", "frame": ""}
    try:
        lines = p.read_text(encoding="utf-8").splitlines()
    except OSError:
        return out
    for line in lines:
        if line.startswith("- 모양·틀:") and not out["frame"]:
            parts = [x.strip() for x in line.split(":", 1)[1].split("/")]
            out["frame"] = parts[1] if len(parts) > 1 else ""
        elif line.startswith("- 장소·훅유형·제목틀:") and not out["hook_type"]:
            parts = [x.strip() for x in line.split(":", 1)[1].split("/")]
            out["hook_type"] = parts[1] if len(parts) > 1 else ""
        elif line.startswith("## 2안"):
            break
    return out


def lessons_prompt(kind: str) -> str:
    """대본·질문 작업 프롬프트에 넣는 한 덩어리. 기록이 없으면 빈 문자열."""
    k = load_lessons().get(kind)
    if not k or not k.get("rules"):
        return ""
    out = [f"[공개 2시간 반응에서 나온 다음 편 규칙 — 최신이 위 ({kind})]"]
    out += [f"- {r['rule']} ({r['from']} 편, {r['label']})" for r in k["rules"]]
    if k.get("best"):
        out.append("2시간 반응 좋았던 편: " + " / ".join(f"「{b['title']}」{b['views_2h']}회" for b in k["best"]))
    if k.get("slow"):
        out.append("느렸던 편(비슷하게 하지 말 것): " + " / ".join(f"「{b['title']}」" for b in k["slow"]))
    br = k.get("breakout")
    if br and kind != "삼촌":  # 삼촌은 toon_series 가 편수를 세며 이어 간다. 5락실은 터진 뒤 4일 동안 같은 결로.
        try:
            fresh = (dt.datetime.now(KST).date() - dt.date.fromisoformat(br["from"])).days <= 4
        except (KeyError, ValueError):
            fresh = False
        if fresh:
            out.append(f"🔥 크게 터진 편「{br['title']}」(평소 {br.get('ratio', '?')}배): 같은 결의 주제·띠 말투로 이어 가라(같은 질문 반복은 금지).")
    return "\n".join(out) + "\n\n"


# ---------- 넣을 재생목록 (BK 11/20 "재생목록은 분류별로") ----------
PLAYLISTS = pathlib.Path("config/playlists.json")


def playlist_of(row: dict) -> str:
    """이 편을 넣을 재생목록 이름. 없으면 빈 문자열. 삼촌은 만화(toon) / 주말 실사 특별편 / 그 밖(넣지 않음)."""
    try:
        cfg = json.loads(PLAYLISTS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    kind = row.get("kind", "")
    if kind == "삼촌":
        style, fmt = (row.get("style") or "").lower(), (row.get("format") or "").lower()
        d = _slug_date(row.get("slug", ""))
        if style == "toon" or fmt in ("toon", "동전이 만화"):
            kind = "삼촌 만화"
        elif style == "live" or "특별" in fmt or (d and d.weekday() >= 5 and d >= dt.date(2026, 11, 28)):
            kind = "삼촌 특별편"
        else:
            kind = "삼촌 기타"
    return (cfg.get(kind) or "").strip()


# ---------- 리포트 ----------
def report_text(row: dict, label: str, ratio: float | None, base: list[float], night, hint: dict) -> str:
    title = (row.get("title") or row["slug"]).replace("#shorts", "").strip()
    h, m = divmod(row["age_min"], 60)
    lines = [f"⏱ 쇼츠 공개 {h}시간 {m}분 반응 · {row['kind']}", f"「{title[:40]}」",
             f"조회 {row['views']:,} · 좋아요 {row['likes']} · 댓글 {row['comments']}"]
    if label == "늦게 봄":
        lines.append("→ 자동 실행이 늦게 돌아 2시간 비교는 못 함 (이 기록은 비교 기준에서 뺌)")
        if night:
            lines.append(f"   참고: 지난 편 공개 당일 밤(약 {night[1]}시간) 평균 {night[0]:,}회")
    elif ratio is not None:
        lines.append(f"→ {label} (지난 {len(base)}편 2시간 중간값 {round(statistics.median(base)):,}의 {ratio:.1f}배)")
    else:
        lines.append(f"→ 2시간 기준 쌓는 중 ({len(base)}/{NEED_BASE}편)")
        if night:
            lines.append(f"   참고: 지난 편 공개 당일 밤(약 {night[1]}시간) 평균 {night[0]:,}회")
    if label == "크게 터짐":
        lines.append("🔥 크게 터짐! " + ("다음 2편은 같은 첫 3초 훅·이야기 틀로 이어 가요(대본 작업이 자동으로 읽음)."
                                       if row["kind"] == "삼촌" else "같은 결의 질문·띠로 2편 더 이어 가요(질문 예약 작업이 읽음)."))
    if hint.get("now"):
        lines.append(f"👉 지금: {hint['now']}")
    lines.append(f"🛠 다음 편 규칙(자동 반영): {hint['next']}")
    if hint.get("title"):
        lines.append(f"✏️ 제목 바꿔 볼 만: {hint['title']} (Studio에서 직접, 자동 변경 안 함)")
    pl = playlist_of(row)
    if pl:
        lines.append(f"📂 재생목록: '{pl}' 에 넣어 주세요 (Studio → 콘텐츠 → 체크 → 재생목록에 추가)")
    lines += ["※ 공개 조회수는 몇십 분 늦게 반영. 시청 지속·공유는 1~2일 뒤 22:41 집계에서.",
              f"https://youtube.com/shorts/{row['id']}"]
    return "\n".join(lines)


def run(now: dt.datetime | None = None, dry: bool = False) -> int:
    now = now or dt.datetime.now(dt.timezone.utc)
    early = json.loads(EARLY.read_text(encoding="utf-8")) if EARLY.exists() else {}
    lessons = load_lessons()
    cands = {vid: m for vid, m in recent_uploads(now).items() if vid not in early}
    if not cands:
        print("볼 편 없음")
        return 0
    got = fetch_stats(list(cands))
    stats = json.loads(STATS.read_text(encoding="utf-8")) if STATS.exists() else {}
    sent = 0
    for vid, st in got.items():
        m = cands.get(vid)
        if not m:
            continue
        if st.get("privacy") and st["privacy"] != "public":
            continue  # 예약 공개 전(비공개) — 11/24 5락실 편을 업로드 시각 기준으로 '6시간 조회 1'로 잘못 보고함
        pub = m.get("public_at") or raksil_public_at(m["slug"], _parse(st.get("published", "")))
        if not pub:
            continue
        age = int((now - pub).total_seconds() // 60)
        if not MIN_AGE <= age <= LATE_MAX:
            continue
        late = age > MAX_AGE
        row = {"id": vid, "slug": m["slug"], "kind": m["kind"], "title": m.get("title", ""), "hook": m.get("hook", ""),
               "format": m.get("format", ""), "style": m.get("style", ""),
               "public_at": pub.astimezone(KST).isoformat(timespec="minutes"),
               "checked_at": now.astimezone(KST).isoformat(timespec="minutes"), "age_min": age,
               "views": st["views"], "likes": st["likes"], "comments": st["comments"]}
        base = baseline(early, m["kind"], vid)
        label, ratio = ("늦게 봄", None) if late else verdict(per2h(row), base)
        night = first_night(stats, m["kind"], vid) if ratio is None else None
        hint = (None if dry else ai_hint(row, label, base, night)) or rule_hint(row, label)
        text = report_text(row, label, ratio, base, night, hint)
        print(text + "\n")
        early[vid] = {k: row[k] for k in ("slug", "kind", "title", "public_at", "checked_at", "age_min", "views", "likes", "comments")}
        early[vid]["hint"] = hint
        lessons = update_lessons(lessons, early, row, label, hint, ratio)
        if not dry:
            from .api_check import send
            sent += bool(send(text))
    if not dry and got:
        EARLY.parent.mkdir(parents=True, exist_ok=True)
        EARLY.write_text(json.dumps(early, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        LESSONS.write_text(json.dumps(lessons, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"보고 {sent}건")
    return 0


def main(argv: list[str]) -> int:
    return run(dry="--dry" in argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
