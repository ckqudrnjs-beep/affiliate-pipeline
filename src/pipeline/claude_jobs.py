"""Claude API 크레딧(Max 구독, 매달 100달러·이월 없음)으로 돌리는 자동 작업 모음 (2026-11-20 BK).

결과는 모두 BK가 휴대폰에서 승인하는 형태로만 나간다: PR(병합 = 승인) 또는 텔레그램 알림.
main 에 바로 반영하는 것은 사용 금액 장부(data/api_usage/)뿐이다.

작업 (python -m pipeline.claude_jobs <작업>):
  toon     동전이 만화 대본 후보 8안 → 채점 → 상위 2안 + Veo 프롬프트 PR
  titles   서치콘솔 노출 대비 클릭이 적은 글의 제목·설명 개선 PR
  adsense  애드센스 심사관 눈으로 사이트 점검 보고서 PR
  shorts   쇼츠 조회·시청 지속 분석 → 대본 규칙 제안 PR
  naver    주말 네이버 블로그 초안 PR (자동 게시 안 함)
  check    최근 자동 글·대본 정책 검사 (문제 있을 때만 텔레그램)
  polish   남은 크레딧으로 기존 글 손질 PR (회차 끝 1주 동안, 상한까지)
  usage    이번 회차 사용 금액 출력
  (raksil  5락실 밸런스 쇼츠 '몽글이의 선택' 한 줄: raksil_shorts.mongle_pick 이 매일 1번, 약 0.3센트)

키는 GitHub Secret ANTHROPIC_API_KEY 에서만 읽는다(공개 저장소, 파일에 쓰지 않음).
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
KST = dt.timezone(dt.timedelta(hours=9))
USAGE_DIR = ROOT / "data" / "api_usage"

# 1백만 토큰당 달러 (2026-11 기준, docs/CLAUDE_API_CREDIT.md)
PRICES = {
    "claude-opus-5-5": (4.0, 20.0, 0.20),
    "claude-sonnet-5-5": (2.0, 10.0, 0.10),
    "claude-haiku-5-5": (0.10, 0.50, 0.01),
}
OPUS, SONNET, HAIKU = "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"

CYCLE_DAY = 15          # 크레딧 회차 시작일(이번 회차 12/14 만료 → 15일 시작으로 본다)
CAP_USD = 95.0          # 회차 전체 상한 (100달러 중 5달러 여유)
# 작업별 회차 상한. 합계가 CAP 보다 작고, 남는 돈은 polish 가 회차 끝에 쓴다.
JOB_CAP = {"toon": 15.0, "titles": 8.0, "adsense": 12.0, "shorts": 6.0, "naver": 8.0, "check": 3.0, "raksil": 1.0, "polish": 95.0}
POLISH_DAYS = 7         # 회차 끝 며칠 전부터 polish 가 남은 돈을 쓴다


class BudgetError(RuntimeError):
    pass


# ---------- 회차·장부 ----------
def today_kst() -> dt.date:
    return dt.datetime.now(KST).date()


def cycle_start(d: dt.date) -> dt.date:
    if d.day >= CYCLE_DAY:
        return d.replace(day=CYCLE_DAY)
    first = d.replace(day=1) - dt.timedelta(days=1)
    return first.replace(day=CYCLE_DAY)


def cycle_end(d: dt.date) -> dt.date:
    s = cycle_start(d)
    nxt = (s.replace(day=1) + dt.timedelta(days=40)).replace(day=CYCLE_DAY)
    return nxt - dt.timedelta(days=1)


def ledger_path(d: dt.date) -> pathlib.Path:
    return USAGE_DIR / f"{cycle_start(d).isoformat()}.json"


def load_ledger(d: dt.date) -> list[dict]:
    p = ledger_path(d)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def spent(d: dt.date, job: str | None = None) -> float:
    return round(sum(r["usd"] for r in load_ledger(d) if job is None or r["job"] == job), 4)


def cost(model: str, usage: dict) -> float:
    pin, pout, pcache = PRICES[model]
    return (usage.get("input_tokens", 0) * pin + usage.get("output_tokens", 0) * pout
            + usage.get("cache_read_input_tokens", 0) * pcache
            + usage.get("cache_creation_input_tokens", 0) * pin * 1.25) / 1e6


def record(d: dt.date, job: str, model: str, usage: dict) -> float:
    usd = round(cost(model, usage), 4)
    rows = load_ledger(d)
    rows.append({"date": d.isoformat(), "job": job, "model": model, "in": usage.get("input_tokens", 0),
                 "out": usage.get("output_tokens", 0), "cache": usage.get("cache_read_input_tokens", 0), "usd": usd})
    p = ledger_path(d)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return usd


def check_budget(d: dt.date, job: str, need: float) -> None:
    if spent(d) + need > CAP_USD:
        raise BudgetError(f"회차 상한 {CAP_USD}달러에 닿아 {job} 건너뜀 (사용 {spent(d)}달러)")
    if spent(d, job) + need > JOB_CAP[job]:
        raise BudgetError(f"{job} 회차 상한 {JOB_CAP[job]}달러에 닿아 건너뜀 (사용 {spent(d, job)}달러)")


# ---------- Claude 호출 ----------
def ask(job: str, system: str, user: str, *, model: str = OPUS, effort: str = "medium",
        schema: dict | None = None, max_tokens: int = 16000, need: float = 0.5):
    """한 번 호출하고 사용 금액을 장부에 적는다. schema 가 있으면 JSON(dict)을, 없으면 글을 돌려준다."""
    import anthropic

    d = today_kst()
    check_budget(d, job, need)
    client = anthropic.Anthropic()
    kw = dict(model=model, max_tokens=max_tokens, system=system,
              messages=[{"role": "user", "content": user}],
              output_config={"effort": effort, **({"format": {"type": "json_schema", "schema": schema}} if schema else {})})
    if model in (OPUS, SONNET):  # 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도
        kw.update(betas=["server-side-fallback-2026-07-01"], fallbacks="default")
    if max_tokens > 16000:
        with client.beta.messages.stream(**kw) as s:
            msg = s.get_final_message()
    else:
        msg = client.beta.messages.create(**kw)
    usage = msg.usage.model_dump() if hasattr(msg.usage, "model_dump") else dict(msg.usage)
    usd = record(d, job, model, usage)
    print(f"[{job}] {model} 입력 {usage.get('input_tokens')} 출력 {usage.get('output_tokens')} → ${usd}")
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"모델이 거절함: {getattr(msg, 'stop_details', None)}")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError("응답이 max_tokens 에서 잘림")
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    return json.loads(text) if schema else text


def obj(props: dict, req: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": req or list(props), "additionalProperties": False}


S = {"type": "string"}
I = {"type": "integer"}


def arr(item: dict) -> dict:
    return {"type": "array", "items": item}


# ---------- 결과 내보내기 (PR / 텔레그램) ----------
def sh(*cmd: str, check: bool = True) -> str:
    return subprocess.run(cmd, cwd=ROOT, check=check, capture_output=True, text=True).stdout.strip()


def open_pr(branch: str, title: str, body: str, paths: list[str]) -> str | None:
    """paths 의 변경을 새 브랜치로 올려 PR 을 연다(BK가 휴대폰에서 병합 = 승인). 이미 있으면 건너뛴다."""
    if sh("git", "ls-remote", "--heads", "origin", branch, check=False):
        print(f"{branch} 이미 있음")
        return None
    sh("git", "checkout", "-q", "-B", branch)
    sh("git", "add", *paths)
    if not sh("git", "diff", "--cached", "--name-only"):
        print("바뀐 것 없음")
        return None
    sh("git", "commit", "-q", "-m", title)
    sh("git", "push", "-q", "-u", "origin", branch)
    url = sh("gh", "pr", "create", "--base", "main", "--head", branch, "--title", title, "--body", body)
    print(url)
    return url


def notify(text: str) -> bool:
    from .api_check import send
    return send(text)


def direction(section: str = "2-3") -> str:
    """docs/DIRECTION.md(모든 자동 작업의 기준)에서 한 칸을 꺼낸다. 프롬프트 맨 앞에 넣어 방향이 어긋나지 않게 (2026-11-20)."""
    f = ROOT / "docs/DIRECTION.md"
    if not f.exists():
        return ""
    text = f.read_text(encoding="utf-8")
    start = text.find(f"### {section}")
    if start < 0:
        return ""
    end = text.find("\n#", start + 4)
    body = text[start:end if end > 0 else None].strip()
    return "[지금 방향 — 다른 규칙과 다르면 이것을 따른다]\n" + body + "\n\n"


def jload(p: str | pathlib.Path):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


def site_facts() -> str:
    """사이트에 있는 숫자 근거(계산기 질문·글 요약). 대본·제목에 쓰는 숫자는 여기서만 가져온다."""
    lines = ["[계산기 질문 페이지 q/<slug>.html]"]
    for q in jload("data/calc_questions.json"):
        lines.append(f"- q/{q['slug']}.html | {q['h1']} | 가정 {json.dumps(q.get('params', {}), ensure_ascii=False)}")
    lines.append("[삼촌의 글 guide/<slug>.html — 한 줄 답]")
    for f in sorted((ROOT / "data/articles").glob("*.json")):
        a = json.loads(f.read_text(encoding="utf-8"))
        lines.append(f"- guide/{a['slug']}.html | {a['title']} | {a['desc']}")
    return "\n".join(lines)


ELECTRIC_RULE = ("전기요금 계산 기준(사이트 계산기와 같음): 월 사용량 200/400kWh 누진, 단가 120.0/214.6/307.3원, "
                 "기본요금 910/1,600/7,300원, 기후환경 9원·연료비 5원/kWh, 부가세 10%, 전력기금 2.7%. "
                 "예) 평소 250kWh 집에 +24kWh → 약 6,180원, +48kWh → 약 12,370원.")
POLICY = ("규칙: 상품·구매·할인·제휴 링크·[광고] 없음(쇼츠·블로그 초안 모두). 건강·의약 효능 주장 금지. "
          "사실이 아닌 체험담(직접 써 봤다 등) 금지. 숫자는 주어진 사이트 근거에서만, 근거 경로를 함께 적는다. "
          "개인·사업자 정보 쓰지 않음. 알리·쿠팡·테무 등 쇼핑몰·브랜드 이름 금지('해외직구'처럼 일반 말로). "
          "한국어, 친근한 ~해요체.")


def recent_episode_titles(n: int = 14) -> list[str]:
    out = []
    for f in sorted((ROOT / "data/episodes").glob("*.json"))[::-1]:
        if f.name.endswith(".meta.json"):
            continue
        try:
            out.append(f"{f.stem}: {json.loads(f.read_text(encoding='utf-8')).get('title', '')}")
        except ValueError:
            continue
        if len(out) >= n:
            break
    return out


# ---------- 1. 동전이 만화 대본 후보 ----------
CUT = obj({"screen": S, "caption": S, "camera": S})
VARIANT = obj({"title": S, "place": S, "hook": S, "cuts": arr(CUT), "number_box": S, "number_source": S,
               "gag": S, "tip": S, "why_fun": S})
JUDGE = obj({"scores": arr(obj({"idx": I, "hook": I, "fun": I, "aha": I, "bible": I, "clarity": I, "total": I, "note": S})),
             "best": arr(I)})
PROMPTS = obj({"prompts": arr(S)})


REFINE_GOAL, REFINE_ROUNDS = 45, 2


def toon(today: dt.date | None = None, n: int = 8) -> int:
    from . import episodes
    today = today or today_kst()
    info = episodes.info_short(today)
    date = info["date"]
    out = ROOT / "data/toon/lab" / f"{date}.md"
    if out.exists() or sh("git", "ls-remote", "--heads", "origin", f"auto/toon-{date}", check=False):
        print(f"{date} 후보 이미 있음 (파일 또는 PR)")
        return 0
    bible = (ROOT / "config/toon_bible.md").read_text(encoding="utf-8")
    special = dt.date.fromisoformat(date).weekday() >= 5  # 주말 공개 편 = 실사 삼촌 특별편 (BK 11/20, 바이블 주 1회)
    kind = ("이번 편은 '실사판 특별편'이다. 바이블의 실사판 규칙대로 실사 삼촌이 직접 나오고 프롬프트는 Photorealistic. 으로 쓴다.\n"
            if special else "이번 편은 만화판이다. 실사 문장을 쓰지 않는다.\n")
    system = (direction() + "너는 한국 유튜브 쇼츠 만화 '동전이네'의 작가다. 아래 세계관 바이블을 반드시 지킨다.\n" + kind + "\n" + bible
              + "\n\n" + POLICY + "\n" + ELECTRIC_RULE)
    user = (f"{date} 공개 편 대본 후보를 서로 확실히 다른 {n}개 써 줘. 주제 후보(참고, 더 재미있으면 바꿔도 됨):\n"
            f"{json.dumps(info.get('concept'), ensure_ascii=False)}\n\n"
            "보는 사람: 살림 맡은 30~50대(주부). 재미·상황극이 먼저, 숫자는 3번 컷 끝 number_box 한 번(30만 원/년 미만의 뻔한 절약 팁 금지).\n"
            "cuts 는 정확히 4개, 각 caption 은 화면 자막(한 줄 14자 이하, 최대 2줄, '/'로 줄 나눔), camera 는 구도 메뉴의 영어 문구 하나.\n"
            "number_source 에는 아래 사이트 근거 경로와 계산을 적어라. 근거에 없는 숫자는 쓰지 마라.\n"
            f"최근 편(겹치지 않게):\n" + "\n".join(recent_episode_titles()) + "\n\n" + site_facts())
    res = ask("toon", system, user, schema=obj({"variants": arr(VARIANT)}), effort="high", max_tokens=32000, need=1.5)
    vs = res["variants"][:n]
    judge_sys = ("너는 한국 쇼츠 편집장이다. 아래 바이블과 기준으로 대본 후보를 냉정하게 1~10점 채점한다.\n"
                 "hook=첫 1초 멈춤 힘, fun=상황극·개그 재미, aha=숫자가 놀랍고 사이트 근거가 맞는지(근거 틀리면 1점), "
                 "bible=세계관·캐릭터·구도 규칙, clarity=자막만 보고 이해되는지. total=합계. best=상위 2개 idx(0부터).\n\n" + bible
                 + "\n\n" + ELECTRIC_RULE)
    judged = ask("toon", judge_sys, json.dumps(vs, ensure_ascii=False) + "\n\n" + site_facts(),
                 schema=JUDGE, effort="medium", need=0.6)
    scores = {s["idx"]: s for s in judged["scores"]}
    best = [i for i in judged["best"] if 0 <= i < len(vs)][:2] or sorted(scores, key=lambda i: -scores[i]["total"])[:2]
    first = {i: scores.get(i, {}).get("total", 0) for i in best}
    # 다듬기 (BK 11/20 "점수가 낮네"): 상위 2안을 채점 메모대로 고쳐 다시 채점, 오른 것만 쓴다. 목표 45점, 최대 2번.
    for _ in range(REFINE_ROUNDS):
        weak = [i for i in best if scores.get(i, {}).get("total", 0) < REFINE_GOAL]
        if not weak:
            break
        fixed = ask("toon", system, "아래 대본 후보들을 채점 메모의 약점을 모두 고쳐 다시 써 줘. 같은 주제·숫자·근거는 유지하고 "
                    "훅(첫 1초 움직임)·개그(잡으려다 실패)·자막 명확성을 끌어올려라. 순서 그대로 돌려줘.\n\n"
                    + json.dumps([{"대본": vs[i], "채점": scores.get(i, {})} for i in weak], ensure_ascii=False)
                    + "\n\n" + site_facts(), schema=obj({"variants": arr(VARIANT)}), effort="high", max_tokens=16000,
                    need=0.6)["variants"][:len(weak)]
        if not fixed:
            break
        rejudged = ask("toon", judge_sys, json.dumps(fixed, ensure_ascii=False) + "\n\n" + site_facts(),
                       schema=JUDGE, effort="medium", need=0.3)
        for s in rejudged["scores"]:
            if 0 <= s["idx"] < len(fixed) and s.get("total", 0) > scores.get(weak[s["idx"]], {}).get("total", 0):
                i = weak[s["idx"]]
                vs[i], scores[i] = fixed[s["idx"]], dict(s, idx=i)
    best.sort(key=lambda i: -scores.get(i, {}).get("total", 0))
    md = [f"# 동전이 {'실사 삼촌 특별편' if special else '만화'} 대본 후보 — {date} 공개 편", "",
          f"자동 생성 {today.isoformat()} (Claude API, 후보 {len(vs)}개 → 채점 → 상위 2개 다듬기). "
          "점수는 50점 만점의 깐깐한 편집장 채점이에요(40점 = 대부분 항목 8점). "
          "마음에 드는 안을 골라 이 PR에 댓글로 번호만 남기거나, 그냥 병합하면 1안으로 진행해요. 숫자는 근거를 다시 확인한 뒤 자막에 넣어요.", ""]
    for rank, i in enumerate(best, 1):
        v, s = vs[i], scores.get(i, {})
        prompts = ask("toon", "너는 Veo 영상 프롬프트 작가다. 바이블의 '프롬프트 조립' 순서와 고정 문장을 글자 그대로 쓴다. "
                      "클립마다 영어 프롬프트 하나, 동작은 하나만.\n" + kind + "\n" + bible,
                      json.dumps(v, ensure_ascii=False) + "\n\n이 대본의 컷 4개에 맞는 Veo 프롬프트 4개를 써 줘.",
                      schema=PROMPTS, model=SONNET, effort="medium", need=0.3)["prompts"][:4]
        up = f", 다듬기 전 {first[i]}" if first.get(i) and first[i] != s.get("total") else ""
        md += [f"## {rank}안: {v['title']}  (점수 {s.get('total', '?')}/50{up})", "",
               f"- 장소: {v['place']} / 훅: {v['hook']} / 개그: {v['gag']}",
               f"- 숫자 상자: **{v['number_box']}** — 근거: {v['number_source']}",
               f"- 삼촌 한 마디: {v['tip']} / 재미 포인트: {v['why_fun']}",
               f"- 채점 메모: {s.get('note', '')}", "", "| 컷 | 화면 | 자막 | 구도 |", "|---|---|---|---|"]
        md += [f"| {k} | {c['screen']} | {c['caption']} | {c['camera']} |" for k, c in enumerate(v["cuts"], 1)]
        md += [""] + [f"{k}. `{p}`" for k, p in enumerate(prompts, 1)] + [""]
    md += ["## 나머지 후보", "", "| # | 제목 | 숫자 | 점수 | 메모 |", "|---|---|---|---|---|"]
    for i, v in enumerate(vs):
        if i not in best:
            s = scores.get(i, {})
            md.append(f"| {i} | {v['title']} | {v['number_box']} | {s.get('total', '?')} | {s.get('note', '')[:60]} |")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    url = open_pr(f"auto/toon-{date}", f"동전이 대본 후보 {date}", f"`{out.relative_to(ROOT)}` 를 열어 보세요. 상위 2안에 Veo 프롬프트까지 있어요.",
                  [str(out.relative_to(ROOT))])
    if url:
        notify(f"🐶 동전이 {date} 편 대본 후보 2안이 올라왔어요. 휴대폰에서 보고 병합(=1안 진행)하거나 댓글로 번호를 남겨 주세요.\n{url}")
    return 0


# ---------- 2. 서치콘솔 제목·설명 개선 ----------
TITLE_FIX = obj({"changes": arr(obj({"slug": S, "title": S, "desc": S, "reason": S}))})


def gsc_rows(site: str = "sc-domain:don3chon.com", days: int = 28) -> tuple[list[dict], list[dict]]:
    data = jload("data/seo/gsc.json")
    q, p = {}, {}
    for day in sorted(data)[-days:]:
        v = data[day].get(site, {})
        for src, dst in (("top_query", q), ("top_page", p)):
            for r in v.get(src, []):
                a = dst.setdefault(r["key"], {"key": r["key"], "clicks": 0, "impressions": 0, "pos": []})
                a["clicks"] += r.get("clicks", 0)
                a["impressions"] += r.get("impressions", 0)
                a["pos"].append(r.get("position", 0))
    fin = lambda d: sorted(({**a, "pos": round(sum(a["pos"]) / len(a["pos"]), 1)} for a in d.values()),
                           key=lambda a: -a["impressions"])[:60]
    return fin(q), fin(p)


def titles(today: dt.date | None = None) -> int:
    from . import articles
    today = today or today_kst()
    queries, pages = gsc_rows()
    arts = {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in (ROOT / "data/articles").glob("*.json")}
    lst = [{"slug": s, "title": a["title"], "desc": a["desc"], "keywords": a.get("keywords", [])} for s, a in arts.items()]
    system = ("너는 한국어 SEO 편집자다. 구글 서치콘솔 데이터를 보고, 노출은 있는데 클릭이 적거나 검색어와 제목이 어긋난 글만 골라 "
              "제목(title, 40자 이하)과 설명(desc, 80~150자, 첫 문장에 숫자 답)을 고친다. 낚시·과장·특가·광고 문구 금지, "
              "본문에 없는 숫자 금지. 고칠 필요가 없으면 changes 를 비워라. 최대 5개.")
    user = json.dumps({"queries_28d": queries, "pages_28d": pages, "articles": lst}, ensure_ascii=False)
    res = ask("titles", system, user, schema=TITLE_FIX, model=SONNET, effort="medium", need=0.4)
    changed, notes = [], []
    for c in res["changes"][:5]:
        a = arts.get(c["slug"])
        if not a or len(c["title"]) > 45 or not 40 <= len(c["desc"]) <= 170:
            continue
        nums = set(re.findall(r"\d[\d,.]*", c["title"] + c["desc"])) - set(re.findall(r"\d[\d,.]*", a["body"] + a["title"] + a["desc"]))
        if nums:
            print(f"{c['slug']}: 본문에 없는 숫자 {nums} → 건너뜀")
            continue
        notes.append(f"- `{c['slug']}`\n  - 제목: {a['title']} → **{c['title']}**\n  - 설명: {c['desc']}\n  - 이유: {c['reason']}")
        a.update(title=c["title"], desc=c["desc"], updated=today.isoformat())
        p = ROOT / "data/articles" / f"{c['slug']}.json"
        p.write_text(json.dumps(a, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        changed.append(str(p.relative_to(ROOT)))
    if not changed:
        print("고칠 제목 없음")
        return 0
    url = open_pr(f"auto/titles-{today.isoformat()}", f"검색 제목·설명 손질 {today.isoformat()} ({len(changed)}편)",
                  "서치콘솔 최근 28일 노출·클릭을 보고 고친 안이에요. 주소(slug)는 그대로예요.\n\n" + "\n".join(notes), changed)
    if url:
        notify(f"🔎 검색 제목·설명 손질 {len(changed)}편 PR이 올라왔어요. 괜찮으면 병합해 주세요.\n{url}")
    return 0


# ---------- 3. 애드센스 심사관 점검 ----------
def page_text(html: str, limit: int = 3500) -> str:
    html = re.sub(r"(?is)<(script|style|svg)[^>]*>.*?</\1>", " ", html)
    t = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", t).strip()[:limit]


def adsense(today: dt.date | None = None) -> int:
    import random
    today = today or today_kst()
    site = pathlib.Path("/tmp/claude_jobs_site")
    sh(sys.executable, "-m", "pipeline.site", str(site))
    pages = [p for p in site.rglob("*.html")]
    fixed = [site / n for n in ("index.html", "about.html", "privacy.html", "contact.html", "guide.html") if (site / n).exists()]
    rnd = random.Random(today.toordinal()).sample([p for p in pages if p not in fixed], min(14, max(0, len(pages) - len(fixed))))
    sample = "\n\n".join(f"=== {p.relative_to(site)} ===\n{page_text(p.read_text(encoding='utf-8', errors='ignore'))}" for p in fixed + rnd)
    system = ("너는 구글 애드센스 사이트 심사관이다. 'Low value content', 얇은 페이지, 자동 생성 느낌, 비슷한 글 반복, 탐색·연락처·개인정보처리방침, "
              "광고·제휴 표기, 오해 소지 문구를 기준으로 사이트를 점검하고 한국어 보고서를 쓴다. "
              "형식: ## 한 줄 판정, ## 바로 고칠 것(최대 5개, 파일·페이지·고치는 방법), ## 나중에(최대 3개), ## 좋은 점(2개). "
              "개인·사업자 정보를 페이지에 더 넣으라는 제안은 하지 마라(운영자 비공개 방침). 제휴 링크 숨기기는 클로킹이라 제안 금지.")
    user = f"사이트 don3chon.com, 전체 {len(pages)}페이지 중 일부 본문 텍스트:\n\n{sample}"
    report = ask("adsense", system, user, effort="high", max_tokens=12000, need=1.2)
    out = ROOT / "docs/reviews" / f"adsense-{today.isoformat()}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"# 애드센스 심사관 점검 {today.isoformat()} (Claude API 자동)\n\n{report}\n", encoding="utf-8")
    url = open_pr(f"auto/adsense-{today.isoformat()}", f"애드센스 점검 보고서 {today.isoformat()}",
                  "자동 점검 보고서예요. 병합하면 기록으로 남고, '바로 고칠 것'은 Claude가 다음 작업으로 고쳐요.", [str(out.relative_to(ROOT))])
    if url:
        notify(f"🧐 이번 주 애드센스 점검 보고서가 올라왔어요.\n{url}")
    return 0


# ---------- 4. 쇼츠 분석 → 대본 규칙 제안 ----------
def shorts(today: dt.date | None = None) -> int:
    today = today or today_kst()
    an = jload("data/youtube/analytics.json")
    last = an[sorted(an)[-1]]
    titles_by_id = {}
    for f in (ROOT / "data/episodes").glob("*.meta.json"):
        m = json.loads(f.read_text(encoding="utf-8"))
        vid = m.get("video_id") or m.get("id")
        if vid:
            titles_by_id[vid] = m.get("title", f.stem)
    up = jload("data/youtube/uploaded.json")
    for slug, u in up.items():
        titles_by_id.setdefault(u.get("video_id"), slug)
    rows = []
    for ch, vids in last.items():
        for vid, s in vids.items():
            rows.append({"ch": ch, "title": titles_by_id.get(vid, vid), **s})
    system = (direction() + "너는 유튜브 쇼츠 데이터 분석가다. 조회수·평균 시청 비율(avg_pct)·공유·구독을 보고, 잘된 편과 안된 편의 차이를 "
              "훅·형식·길이·주제로 설명하고, 다음 대본 규칙을 3~5줄 제안한다. 조회수 숫자를 꾸며내지 말고 표의 값만 쓴다. "
              "형식: ## 이번 주 한 줄, ## 잘된 편 왜, ## 안된 편 왜, ## 다음 대본 규칙 제안(체크박스). 한국어.")
    report = ask("shorts", system, json.dumps(rows, ensure_ascii=False), effort="medium", need=0.5)
    out = ROOT / "docs/SHORTS_AI_NOTES.md"
    old = out.read_text(encoding="utf-8") if out.exists() else "# 쇼츠 AI 분석 노트 (매주 자동, 병합 = 규칙 채택)\n\n대본 기획 때 맨 위 최신 주의 '다음 대본 규칙 제안'을 따른다.\n"
    head, _, rest = old.partition("\n## ")
    new = f"{head.rstrip()}\n\n## {today.isoformat()} 주간\n\n{report.strip()}\n" + (("\n## " + rest) if rest else "")
    out.write_text(new, encoding="utf-8")
    url = open_pr(f"auto/shorts-{today.isoformat()}", f"쇼츠 주간 분석 {today.isoformat()}",
                  "병합하면 '다음 대본 규칙 제안'이 대본 기획에 반영돼요.", [str(out.relative_to(ROOT))])
    if url:
        notify(f"📈 쇼츠 주간 분석과 대본 규칙 제안이 올라왔어요. 괜찮으면 병합해 주세요.\n{url}")
    return 0


# ---------- 5. 네이버 블로그 초안 ----------
def naver(today: dt.date | None = None) -> int:
    today = today or today_kst()
    arts = sorted((json.loads(f.read_text(encoding="utf-8")) for f in (ROOT / "data/articles").glob("*.json")),
                  key=lambda a: a["date"], reverse=True)
    done = {p.stem.split("_", 1)[-1] for p in (ROOT / "drafts/naver").glob("*.md")} if (ROOT / "drafts/naver").exists() else set()
    pick = next((a for a in arts if a["slug"] not in done), None)
    if not pick:
        return 0
    system = ("너는 '돈 줍는 삼촌' 네이버 블로그 글쓴이다. 사이트 글을 그대로 옮기지 말고(중복 문서 방지) 블로그용으로 새로 쓴다: "
              "제목 1개, 본문 1,000~1,500자, 이웃에게 말하듯 ~해요체, 사진 넣을 자리 [사진: 설명] 2~3곳, 마지막에 "
              "'자세한 계산은 돈삼촌(don3chon.com)에서' 한 줄만. 제휴 링크·상품 추천·광고 문구 금지. " + POLICY)
    body = ask("naver", system, json.dumps({k: pick[k] for k in ("title", "desc", "body")}, ensure_ascii=False),
               model=SONNET, effort="medium", need=0.3)
    out = ROOT / "drafts/naver" / f"{today.isoformat()}_{pick['slug']}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"<!-- 원글 guide/{pick['slug']}.html · 자동 초안, 네이버에는 BK가 직접 올림 -->\n\n{body}\n", encoding="utf-8")
    url = open_pr(f"auto/naver-{today.isoformat()}", f"네이버 블로그 초안 {today.isoformat()}",
                  "휴대폰에서 파일을 열어 복사 → 네이버 블로그 앱에 붙여 넣으면 돼요. 병합은 기록용이에요.", [str(out.relative_to(ROOT))])
    if url:
        notify(f"✍️ 주말 네이버 블로그 초안이 준비됐어요.\n{url}")
    return 0


# ---------- 6. 정책 검사 ----------
CHECK = obj({"ok": {"type": "boolean"}, "problems": arr(S)})


def check(today: dt.date | None = None) -> int:
    today = today or today_kst()
    arts = list((ROOT / "data/articles").glob("*.json"))
    items = [max(arts, key=lambda f: json.loads(f.read_text(encoding="utf-8")).get("date", ""))] if arts else []
    for d in ("data/episodes", "data/toon"):  # 파일 이름이 날짜로 시작 → 이름순 마지막이 가장 최근
        fs = sorted(f for f in (ROOT / d).glob("*.json") if not f.name.endswith(".meta.json"))
        if fs:
            items.append(fs[-1])
    texts = {str(f.relative_to(ROOT)): f.read_text(encoding="utf-8")[:12000] for f in items}
    system = ("너는 한국 광고·플랫폼 정책 검사관이다. 다음을 찾는다: 공정위 대가성 표기 누락(상품 카드·제휴가 있는데 [광고] 없음), "
              "쇼츠·인스타·스레드용 글에 제휴 링크나 판매·특가 문구, 개인·사업자 정보 노출, 건강 효능 주장, 가짜 체험담, "
              "근거 없는 과장. 문제 없으면 ok=true. 문제는 '파일: 무엇' 한 줄씩.")
    res = ask("check", system, json.dumps(texts, ensure_ascii=False), model=HAIKU, effort="low", schema=CHECK, max_tokens=2000, need=0.05)
    if not res["ok"] and res["problems"]:
        notify("⚠️ 자동 정책 검사에서 확인할 것이 있어요:\n- " + "\n- ".join(res["problems"][:6]))
    print(res)
    return 0


# ---------- 7. 남은 크레딧으로 기존 글 손질 ----------
POLISH = obj({"title": S, "desc": S, "body": S, "summary": S})


def polish(today: dt.date | None = None, max_articles: int = 6) -> int:
    from . import articles, calcs
    today = today or today_kst()
    left_days = (cycle_end(today) - today).days
    remaining = CAP_USD - spent(today)
    if left_days >= POLISH_DAYS or remaining < 3:
        print(f"polish 안 함 (회차 끝까지 {left_days}일, 남은 {remaining:.2f}달러)")
        return 0
    files = sorted((ROOT / "data/articles").glob("*.json"),
                   key=lambda f: json.loads(f.read_text(encoding="utf-8")).get("updated", "0000"))
    prods = {json.loads(f.read_text(encoding="utf-8"))["slug"] for f in (ROOT / "data/products").glob("*.json")}
    calc_slugs = {c["slug"] for c in calcs.CALCS}
    rules = (ROOT / "docs/ARTICLES_AUTO.md").read_text(encoding="utf-8")
    changed, notes = [], []
    for f in files[:max_articles]:
        if CAP_USD - spent(today) < 3:
            break
        a = json.loads(f.read_text(encoding="utf-8"))
        if a.get("updated", "") >= (today - dt.timedelta(days=30)).isoformat():
            continue
        others = [json.loads(g.read_text(encoding="utf-8")) for g in (ROOT / "data/articles").glob("*.json") if g != f]
        system = ("너는 '돈 줍는 삼촌' 사이트 편집자다. 아래 글 규칙을 지키며 기존 글을 더 낫게 손질한다: 첫 문단에 바로 답, "
                  "기계적 표현 빼기, 다른 글과 겹치는 표·문장은 링크로 대체, 숫자는 본문·계산 기준 안에서만, 주소(slug)·내부 링크 형식 유지, "
                  "본문 1,200~2,400자. summary 는 무엇을 고쳤는지 한 줄.\n\n" + rules + "\n\n" + ELECTRIC_RULE)
        user = json.dumps({"article": {k: a[k] for k in ("slug", "title", "desc", "body")},
                           "other_titles": [o["title"] for o in others]}, ensure_ascii=False)
        try:
            r = ask("polish", system, user, schema=POLISH, effort="high", max_tokens=24000, need=0.6)
        except BudgetError as e:
            print(e)
            break
        cand = {**a, "title": r["title"], "desc": r["desc"], "body": r["body"], "updated": today.isoformat()}
        errs = articles.validate(cand, prods, calc_slugs, {o["slug"] for o in others} | {a["slug"]})
        errs += articles.similarity_problems(others + [cand])
        if errs:
            print(f"{a['slug']}: 검사 실패 {errs[:3]} → 건너뜀")
            continue
        f.write_text(json.dumps(cand, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        changed.append(str(f.relative_to(ROOT)))
        notes.append(f"- `{a['slug']}`: {r['summary']}")
    if not changed:
        return 0
    url = open_pr(f"auto/polish-{today.isoformat()}", f"기존 글 손질 {today.isoformat()} ({len(changed)}편)",
                  "회차가 끝나기 전 남은 크레딧으로 손질한 안이에요. 주소는 그대로, 자동 검사 통과.\n\n" + "\n".join(notes), changed)
    if url:
        notify(f"🧹 남은 크레딧으로 기존 글 {len(changed)}편을 손질했어요. 괜찮으면 병합해 주세요.\n{url}")
    return 0


def usage(today: dt.date | None = None) -> int:
    today = today or today_kst()
    rows = load_ledger(today)
    by = {}
    for r in rows:
        by[r["job"]] = round(by.get(r["job"], 0) + r["usd"], 4)
    print(json.dumps({"cycle": [cycle_start(today).isoformat(), cycle_end(today).isoformat()], "spent": spent(today),
                      "cap": CAP_USD, "by_job": by}, ensure_ascii=False, indent=1))
    return 0


JOBS = {"toon": toon, "titles": titles, "adsense": adsense, "shorts": shorts, "naver": naver,
        "check": check, "polish": polish, "usage": usage}


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in JOBS:
        print("작업: " + ", ".join(JOBS))
        return 2
    if argv[0] != "usage" and not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY 없음 → 건너뜀")
        return 0
    try:
        return JOBS[argv[0]]()
    except BudgetError as e:
        print(e)
        return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
