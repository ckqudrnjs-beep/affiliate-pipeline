"""Claude API 크레딧(Max 구독, 매달 100달러·이월 없음)으로 돌리는 자동 작업 모음 (2026-11-20 BK).

결과는 모두 BK가 휴대폰에서 승인하는 형태로만 나간다: PR(병합 = 승인) 또는 텔레그램 알림.
단, 동전이 대본(toon)은 BK 11/21 결정으로 1안 PR 을 자동 병합하고 알림을 보내지 않는다(병합이 막힐 때만 알림).
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
  (raksil  5락실 밸런스 쇼츠 '몽글이의 선택' 한 줄 + 제목 띠 후보 3개: raksil_shorts.mongle_plan 이 매일 1번, 약 0.5센트)
  (early   쇼츠 공개 2시간 반응의 다음 편 규칙 한 줄: pipeline.yt_early 가 편마다 1번, 약 0.5센트)

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
import time

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
JOB_CAP = {"toon": 15.0, "titles": 8.0, "adsense": 12.0, "shorts": 6.0, "naver": 8.0, "check": 3.0, "raksil": 5.0, "early": 1.0, "polish": 95.0}
POLISH_DAYS = 7         # 회차 끝 며칠 전부터 polish 가 남은 돈을 쓴다
# 배치(Message Batches, 입·출력 50% 할인, 대부분 1시간 안) — 급하지 않은 작업만 (BK 11/20 "배치도 진행")
# raksil·early(공개 시각에 맞춰야 함)·check(하루 몇 센트)·naver(직접 돌림)는 일반 호출.
BATCH_JOBS = {"toon", "adsense", "shorts", "titles", "polish"}
BATCH_WAIT_MIN = 45     # 한 호출을 이만큼 기다려도 안 끝나면 취소하고 일반 호출
BATCH_BUDGET_MIN = 150  # 작업 시작 뒤 이만큼 지나면 남은 호출은 일반 호출 (워크플로 제한 240분 안에 끝내기)
BATCH_POLL_SEC = 20
_T0 = time.monotonic()


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
    made = usage.get("cache_creation_input_tokens", 0) or 0
    split = usage.get("cache_creation") or {}
    w1h = (split.get("ephemeral_1h_input_tokens") or 0) if isinstance(split, dict) else 0
    # 캐시 쓰기: 5분 = 입력값 1.25배, 1시간 = 2배 (docs/CLAUDE_API_CREDIT.md '프롬프트 캐싱')
    return (usage.get("input_tokens", 0) * pin + usage.get("output_tokens", 0) * pout
            + usage.get("cache_read_input_tokens", 0) * pcache
            + (made - w1h) * pin * 1.25 + w1h * pin * 2.0) / 1e6


def record(d: dt.date, job: str, model: str, usage: dict, batch: bool = False) -> float:
    usd = round(cost(model, usage) * (0.5 if batch else 1.0), 4)
    rows = load_ledger(d)
    rows.append({"date": d.isoformat(), "job": job, "model": model, "in": usage.get("input_tokens", 0),
                 "out": usage.get("output_tokens", 0), "cache": usage.get("cache_read_input_tokens", 0),
                 "cache_w": usage.get("cache_creation_input_tokens", 0) or 0, **({"batch": True} if batch else {}), "usd": usd})
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
def use_batch(job: str) -> bool:
    if job not in BATCH_JOBS or os.environ.get("CLAUDE_BATCH", "1") == "0":
        return False
    return (time.monotonic() - _T0) / 60 < BATCH_BUDGET_MIN


def run_batch(client, kw: dict, job: str):
    """요청 1개짜리 배치를 넣고 끝날 때까지 기다린다. 성공하면 메시지, 실패·만료·시간 초과면 None(→ 일반 호출)."""
    params = {k: v for k, v in kw.items() if k not in ("betas", "fallbacks")}  # 배치는 fallbacks 를 못 씀
    b = client.beta.messages.batches.create(requests=[{"custom_id": job, "params": params}])
    left = BATCH_BUDGET_MIN * 60 - (time.monotonic() - _T0)
    deadline = time.monotonic() + max(60.0, min(BATCH_WAIT_MIN * 60, left))
    canceled = False
    while True:
        st = client.beta.messages.batches.retrieve(b.id).processing_status
        if st == "ended":
            break
        if time.monotonic() > deadline:
            if canceled:
                print(f"[{job}] 배치 {b.id} 취소가 늦어 일반 호출로 넘어감")
                return None
            client.beta.messages.batches.cancel(b.id)
            canceled, deadline = True, time.monotonic() + 300
            print(f"[{job}] 배치 {b.id} 가 {BATCH_WAIT_MIN}분 안에 안 끝나 취소")
        time.sleep(BATCH_POLL_SEC)
    for e in client.beta.messages.batches.results(b.id):
        if e.result.type == "succeeded":
            return e.result.message
        print(f"[{job}] 배치 결과 {e.result.type} → 일반 호출")
    return None


def ask(job: str, system: str, user: str, *, model: str = OPUS, effort: str = "medium",
        schema: dict | None = None, max_tokens: int = 16000, need: float = 0.5, cache: str | None = None):
    """한 번 호출하고 사용 금액을 장부에 적는다. schema 가 있으면 JSON(dict)을, 없으면 글을 돌려준다.

    cache="5m"/"1h": 같은 system 을 몇 분 안에 다시 쓰는 호출만 켠다(쓰기 1.25배/2배, 읽기 0.05배).
    한 번만 부르는 주간 작업에 켜면 쓰기 값만 더 낸다. 512토큰 미만 system 은 서버가 조용히 무시한다."""
    import anthropic

    d = today_kst()
    check_budget(d, job, need)
    client = anthropic.Anthropic()
    batch = use_batch(job)
    if cache and batch:
        cache = "1h"  # 배치는 몇 분~1시간 걸려 5분 캐시는 다음 호출 전에 만료되기 쉽다 (문서 권장)
    if cache:
        system = [{"type": "text", "text": system,
                   "cache_control": {"type": "ephemeral", **({"ttl": "1h"} if cache == "1h" else {})}}]
    kw = dict(model=model, max_tokens=max_tokens, system=system,
              messages=[{"role": "user", "content": user}],
              output_config={"effort": effort, **({"format": {"type": "json_schema", "schema": schema}} if schema else {})})
    if model in (OPUS, SONNET):  # 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도
        kw.update(betas=["server-side-fallback-2026-07-01"], fallbacks="default")
    msg = None
    if batch:
        try:
            msg = run_batch(client, kw, job)
        except anthropic.APIError as e:  # 배치 넣기 실패 → 일반 호출
            print(f"[{job}] 배치 실패 {e} → 일반 호출")
        if msg is not None and msg.stop_reason == "refusal" and "fallbacks" in kw:
            record(d, job, model, _usage(msg), batch=True)  # 거절도 값은 낸다 → 다른 모델로 다시 시도하는 일반 호출
            print(f"[{job}] 배치에서 거절 → fallbacks 있는 일반 호출")
            msg = None
        elif msg is not None:
            batch = True
    if msg is None:
        batch = False
        if max_tokens > 16000:
            with client.beta.messages.stream(**kw) as s:
                msg = s.get_final_message()
        else:
            msg = client.beta.messages.create(**kw)
    usage = _usage(msg)
    usd = record(d, job, model, usage, batch=batch)
    print(f"[{job}] {model}{' 배치' if batch else ''} 입력 {usage.get('input_tokens')} 캐시읽기 {usage.get('cache_read_input_tokens') or 0} "
          f"캐시쓰기 {usage.get('cache_creation_input_tokens') or 0} 출력 {usage.get('output_tokens')} → ${usd}")
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"모델이 거절함: {getattr(msg, 'stop_details', None)}")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError("응답이 max_tokens 에서 잘림")
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    return json.loads(text) if schema else text


def _usage(msg) -> dict:
    return msg.usage.model_dump() if hasattr(msg.usage, "model_dump") else dict(msg.usage)


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


def toon_reuse() -> list[dict]:
    """아직 안 쓴 재사용 클립 (BK 11/22 '크레딧 써서 만든 건 활용')."""
    p = ROOT / "config/toon_reuse.json"
    if not p.exists():
        return []
    return [c for c in json.loads(p.read_text(encoding="utf-8")).get("clips", []) if not c.get("used")]


def reuse_rule(clips: list[dict]) -> str:
    if not clips:
        return "모든 컷의 reuse 는 빈 문자열로 둔다.\n"
    return ("[이미 만든 클립 재사용 — BK 11/22 '크레딧 써서 만든 건 활용'] 아래 클립 중 이야기에 자연스럽게 맞는 게 있으면 컷 하나를 "
            "그 클립으로 잡고 그 컷의 reuse 에 id 를 적는다(한 편에 최대 1개, screen 은 클립 내용 그대로). 억지로 끼우지 말고, "
            "안 맞으면 모든 reuse 는 빈 문자열.\n" + json.dumps([{k: c[k] for k in ("id", "screen", "place", "secs")} for c in clips], ensure_ascii=False) + "\n")


def toon_motifs() -> dict:
    return json.loads((ROOT / "config/toon_motifs.json").read_text(encoding="utf-8"))


def recent_motifs(before: str, n: int = 3) -> tuple[list[str], list[str]]:
    """최근 n편(공개일 앞, 고른 안 = 1안)의 소동 모양·이야기 틀. BK 11/20: 같은 모션 반복 금지."""
    m, f = [], []
    for p in sorted((ROOT / "data/toon/lab").glob("*.md"), reverse=True):
        if p.stem >= before:
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith("- 모양·틀:"):
                parts = line.split(":", 1)[1].split("/")
                m.append(parts[0].strip())
                f.append(parts[1].strip() if len(parts) > 1 else "")
                break
        if len(m) >= n:
            break
    return m, f


def recent_variety(before: str, n: int = 3) -> dict[str, list[str]]:
    """직전 n편(고른 안 = 1안)의 장소·첫 3초 훅 유형·제목 틀·소동 모양·이야기 틀. 대본 랩 노트에서 읽는다."""
    out = {"place": [], "hook_type": [], "title_pattern": [], "motif": [], "frame": []}
    seen = 0
    for p in sorted((ROOT / "data/toon/lab").glob("*.md"), reverse=True):
        if p.stem >= before:
            continue
        got = False
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith("- 모양·틀:"):
                parts = [x.strip() for x in line.split(":", 1)[1].split("/")]
                out["motif"].append(parts[0])
                out["frame"].append(parts[1] if len(parts) > 1 else "")
                got = True
            elif line.startswith("- 장소·훅유형·제목틀:"):
                parts = [x.strip() for x in line.split(":", 1)[1].split("/")]
                for k, v in zip(("place", "hook_type", "title_pattern"), parts):
                    out[k].append(v)
            elif line.startswith("## 2안"):
                break
        seen += got
        if seen >= n:
            break
    return out


def overlaps(v: dict, recent: dict[str, list[str]], skip: set[str] | frozenset = frozenset()) -> list[str]:
    """후보가 직전 편과 겹치는 칸 이름. 장소는 앞 두 글자가 같아도 겹침으로 본다(부엌/부엌 식탁).
    skip = 일부러 다시 쓰는 칸(터진 편 이어 가기, toon_series.allow_repeat)."""
    hit = []
    for k in ("motif", "frame", "hook_type", "title_pattern"):
        if k not in skip and v.get(k) and v[k] in recent.get(k, []):
            hit.append(k)
    pl = (v.get("place") or "").strip()
    if pl and any(r and (r == pl or r[:2] == pl[:2]) for r in recent.get("place", [])):
        hit.append("place")
    return hit


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
CUT = obj({"screen": S, "caption": S, "camera": S, "reuse": S})  # reuse = config/toon_reuse.json id (없으면 "")
# 반복 양산 막기 (BK 11/20 "비슷한 틀로 찍어낸 영상이 걸러지는 거라면 같은 기획으로 계속 만들면 안 되잖아 → 반영").
# 캐릭터·주제는 유지, 직전 3편과 장소·첫 3초 훅 유형·이야기 틀·제목 틀·소동 모양이 겹치면 안 된다.
HOOK_TYPES = ["결과 먼저(끝 장면을 첫 컷에)", "엉뚱한 질문", "상식 뒤집기", "동전이 사고 현장", "대결 선언", "시간 점프", "공감 한숨"]
TITLE_PATTERNS = ["목록", "지시", "질문", "상식 뒤집기", "순위"]
VARIETY_PENALTY = 5   # 직전 3편과 겹치는 칸 하나당 채점 합계에서 뺀다
VARIANT = obj({"title": S, "motif": S, "frame": S, "place": S, "hook": S,
               "hook_type": {"type": "string", "enum": HOOK_TYPES}, "title_pattern": {"type": "string", "enum": TITLE_PATTERNS}, "cuts": arr(CUT), "number_box": S, "number_source": S,
               "gag": S, "tip": S, "why_fun": S, "band_top": S, "band_accent": S, "yt_title": S, "heart": S,
               "summary": S, "vote_a": S, "vote_b": S, "mood": S})  # 시즌 빌드업 (toon_series, BK 11/20 "빌드업")
JUDGE = obj({"scores": arr(obj({"idx": I, "hook": I, "fun": I, "aha": I, "bible": I, "clarity": I, "click": I, "total": I,
                                "note": S})), "best": arr(I)})
MAX_SCORE = 60  # 6항목 × 10점 (11/20 '누르고 싶은 제목 띠·제목' click 추가)

# 제목 띠·제목 (BK 11/20 "섬네일과 코멘트가 우선 사람들이 누르게 하는거야 필히 퀄리티 있는 문구로").
# 잘 된 살림 쇼츠(대형마트 진실 3가지 350만, 앞으로 삼겹살은 이렇게 드세요 232만, 설거지가 끝나면 이걸 씁니다 54만)의 공통 패턴.
BAND_RULE = ("[제목 띠·유튜브 제목 — 누르게 만드는 문구가 이 편의 운명]\n"
             "화면 맨 위 검은 띠에 두 줄 제목이 처음부터 끝까지 깔린다(쇼츠 피드 썸네일이 곧 이 띠).\n"
             "- band_top(흰 줄, 12자 이하): 누구나 겪는 생활 장면·상황. 예) '추운 날 김치찌개 배달', '밥솥 보온 켜 둔 집'\n"
             "- band_accent(노란 줄, 12자 이하): 궁금증 한 줄(BK 11/20 B안 질문형). 공식 중 하나 — 목록('의외로 모르는 3가지'), "
             "지시('이것만 보세요'), 질문('동전이는 왜 저기 앉았을까?'), 상식 뒤집기('끄면 더 춥다고?'), 순위('겨울 집 TOP1'), "
             "지시어로 숨기기(BK 11/21 채택: 대상을 '이거·이걸'로 숨겨 화면에서 답을 보게 — '동전이가 이걸 물고 왔다', '이거 그냥 담요가 아니다'). "
             "동전이의 상황·마음이 궁금하게.\n"
             "- [맞히기 질문 — 필수, BK 11/24 '동전이 유지 + 맞히기 질문'(삼촌 채널 마지막 테스트)] 노란 줄·유튜브 제목은 보는 사람이 답을 "
             "속으로 찍어 보게 하는 질문: 'A vs B, 뭐가 더 들까?', '한 달 몇 배 차이?', '어디서가 더 클까?'. 잘 된 편(난로 vs 담요 1,221회, "
             "커피 한 잔 1년 뒤 통장 1,150회)이 전부 이 꼴이었다. 답은 띠·제목에 쓰지 않고 4번 컷(마지막 컷) 자막에서 '정답:'으로 한 번 보여 준다.\n"
             "- 금액(원)은 띠·제목에 넣지 않는다(답의 숫자는 마지막 컷 한 번만, 사이트 근거에서). 금화·저금통·'돈이 샌다' 연출 금지는 그대로. 내용과 다른 낚시·과장(무조건·100%·충격) 금지.\n"
             "- 띠·제목의 숫자는 시간·개수만(BK 11/21): '3초', '첫 1분', '세 번째' 처럼. 돈 액수·배수·퍼센트는 금지.\n"
             "- 손실 회피·금기 경고 금지(BK 11/21 불채택): '~하지 마세요', '날릴 뻔', '모르면 손해', '절대 ~ 금지' 같은 겁주기 말은 정보형·과장이라 쓰지 않는다.\n"
             "- 두 줄을 읽으면 '내 얘기네 + 답이 궁금하다'가 동시에 생겨야 한다. 막연한 말('알뜰 꿀팁', '절약 방법') 금지.\n"
             "- yt_title(유튜브 제목, 40자 이하): 띠와 같은 궁금증을 다른 말로, 답 없이 '?'로 끝. 돈·금액 말 금지. 쇼핑몰·브랜드 이름 금지.\n")
HEART_RULE = ("[이번 편은 공감 한 줄 편] heart 에 살림하는 사람 마음을 건드리는 한 줄(20자 이하)을 쓴다. 이 줄이 4번 컷 자막이 된다. "
              "훈계·명언 인용 금지, 이 편 장면에서 나온 말. 예) '동전이가 먼저 알아챈 겨울', "
              "'아무도 모르는 살림, 동전이는 알아요'.\n")


# BK 11/24 '추천 방향으로': 쇼츠가 시험 단계(처음 몇백 명)에서 멈춤 — 끝까지 본 사람 19.7%(10명 중 8명이 첫 1초에 넘김),
# 김치찌개 편 첫 2초가 빈 현관문. 잘된 두 편(평균 시청률 106%·228%)은 끝나고 다시 보게 만든 편. 화면 틀은 그대로(고정 기간), 첫 장면·끝만.
OPEN_LOOP_RULE = ("[첫 장면 0초 — 넘기지 않게 (BK 11/24)] 1번 클립 프롬프트는 첫 프레임부터 동전이가 화면 가운데에 크게 보이고 이미 움직이는 중"
                  "(킁킁·고개 갸웃·꼬리 흔들며 뭔가를 보는 중)으로 쓴다. 빈 방·문·풍경으로 여는 설정 컷, 천천히 다가가는 카메라, 페이드 인 금지. "
                  "첫 자막은 동전이가 지금 겪는 상황 한 줄(돈 말 없이).\n"
                  "[끝 = 첫 장면으로 이어지기 (BK 11/24, 필수)] 4번 클립 마지막 1~2초는 1번 클립 첫 프레임과 같은 자리·같은 자세로 돌아오게 써서 "
                  "끝나고 다시 재생될 때 이어 보이게 한다(예: 다시 봉투 앞에서 킁킁). 또는 '맞혀 봐' 질문을 첫 자막에 두고 답을 끝에서 보여 줘 "
                  "다시 돌려 보게 한다.\n")


# BK 11/20 밤: "뻔한 것이 없는 것, 아니면 인사이트를 주는 것, 사람들의 여운에 남는 것, 어쩔 때는 한없이 즐거운 것",
# "가볍지 않은 문구, 흥미 유발과 절제를 오가는 퀄리티", "동전 날아가는 것·돈이 샌다 표현은 하지 말고 돈돈돈 강조할 필요 없어".
MOODS = ["뻔하지 않은 것", "인사이트", "여운", "한없이 즐거운 것"]
MOOD_RULE = ("[이 편의 결 — 편마다 하나, 공개일로 돌아가며 정한다]\n"
             "- 뻔하지 않은 것: 처음 보는 상황·구도, 예상과 다르게 끝남.\n"
             "- 인사이트: 다들 알던 것과 다른 사실 하나를 조용히 보여 줌(숫자는 꼭 필요할 때 한 번, 크게 외치지 않음).\n"
             "- 여운: 큰 사건 없이 한 장면, 마지막 한 줄이 마음에 남음.\n"
             "- 한없이 즐거운 것: 동전이의 귀여움·소동으로 끝까지 웃게 함, 정보는 한 줄.\n"
             "[문구 기준] 자막은 짧고 담담한 한 문장(지켜보는 목소리). 말장난·느낌표 남발·'충격'·'꿀팁' 같은 가벼운 말 금지. "
             "흥미를 끄는 줄과 절제하는 줄을 오간다. 금화·저금통·'돈이 샌다'·'새는 돈' 연출과 말 금지, 돈을 강조하지 않는다. "
             "'문제 → 이렇게 바꾸면 아낀다' 같은 뻔한 정보형 구성 금지 — 살림 팁은 마지막 컷 한 줄로만 곁들인다.\n"
             "[중독성 — 결과 상관없이 매 편 (BK 11/20 '그리고 중독성')] 다시 보고 싶게 만드는 장치 하나 이상: 시즌 반복 개그, "
             "다시 돌려 보게 되는 마지막 컷(작은 반전·표정), 끝 장면이 첫 장면으로 자연스럽게 이어지는 루프, 귀에 남는 소리·동작 하나.\n"
             + OPEN_LOOP_RULE)


def mood_of(date: str) -> str:
    """이 편의 결 (BK 11/20 밤 네 가지). 공개일 기준으로 정해져 재실행해도 같다."""
    return MOODS[dt.date.fromisoformat(date).toordinal() % len(MOODS)]


def heart_turn(date: str) -> bool:
    """세 편에 한 번 공감·뭉클 한 줄 (BK 11/20 "좋은 글귀나 공감, 감동 있는 것으로 가끔"). 공개일 기준으로 정해져 재실행해도 같다."""
    return dt.date.fromisoformat(date).toordinal() % 3 == 0
PROMPTS = obj({"prompts": arr(S)})


# BK 11/20 "만점으로 기획하면 안되나?": 목표를 만점 가까이(57/60, 클릭 9점 이상)로 올리고 다듬기를 3번까지.
# 채점은 깐깐하게 그대로 둔다(만점을 요구하면 채점이 후해질 뿐 품질이 오르지 않음).
REFINE_GOAL, REFINE_CLICK, REFINE_ROUNDS = 57, 9, 3
# 품질 게이트 (BK 11/20 "품질이 떨어지는 문구 그리고 영상과 구도는 안하느니 못해"): 다듬은 뒤에도 1안이 이 점수 아래면
# '이 편은 쉬자'로 표시하고 BK 에게 알린다(대본 후보는 참고로 남김). 48 = 6항목 평균 8점.
QUALITY_FLOOR = 48
# BK 11/21 01:31 "아니 기획안을 바꿔야지 스킵하면 안돼": 다듬어도 통과선 아래면 지적을 모아 주제 각도·훅·개그를 바꾼
# 새 후보 REPLAN_N 개를 다시 쓰고 채점·다듬기 (최대 REPLAN_ROUNDS 번). 그래도 아래면 QUALITY_SOFT 이상인 최고안은 '진행 가능',
# 그 아래만 '쉬자'.
REPLAN_ROUNDS, REPLAN_N, QUALITY_SOFT = 2, 4, 44


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
    from .shorts_lock import locked  # 11/22 BK 고정안: 고정 기간(~12/13)엔 특별편 없이 동전이 만화만
    special = dt.date.fromisoformat(date).weekday() >= 5 and not locked("uncle", date)  # 주말 공개 편 = 실사 삼촌 특별편 (BK 11/20, 바이블 주 1회)
    kind = ("이번 편은 '실사판 특별편'이다. 바이블의 실사판 규칙대로 실사 삼촌이 직접 나오고 프롬프트는 Photorealistic. 으로 쓴다.\n"
            "단 1번 컷(첫 3초)은 반드시 동전이 만화 장면으로 시작하고, 실사 삼촌 얼굴은 2번 컷부터 나온다. 썸네일·첫 화면에 실사 얼굴 금지 "
            "(BK 11/20: AI 실사 얼굴로 시작한 편은 모두 20회 아래, 만화·카드로 시작한 편은 300~1,200회).\n"
            if special else "이번 편은 만화판이다. 실사 문장을 쓰지 않는다.\n")
    heart = heart_turn(date)
    mood = mood_of(date)
    copy_rule = (BAND_RULE + MOOD_RULE + f"이번 편의 결: **{mood}** (mood 칸에 그대로 적는다).\n"
                 + (HEART_RULE if heart or mood == "여운" else "heart 는 빈 문자열로 둔다.\n"))
    system = (direction() + "너는 한국 유튜브 쇼츠 만화 '동전이네'의 작가다. 아래 세계관 바이블을 반드시 지킨다.\n" + kind + "\n" + bible
              + "\n\n" + POLICY + "\n" + ELECTRIC_RULE + "\n\n" + copy_rule)
    facts = site_facts()  # 근거는 system 끝에 둬서 작가·다듬기 호출이 캐시로 같이 쓴다 (BK 11/20 프롬프트 캐싱)
    system += "\n\n" + facts
    from .yt_early import lessons_prompt
    early_rules = lessons_prompt("삼촌")  # 공개 2시간 반응 → 다음 대본 규칙 (BK 11/20 "개선 방안을 잡는 것이 중요")
    # 시즌 빌드업 (BK 11/20 "LLM 의 장점을 살려 빌드업"): 지난 편 기억·댓글 투표 주제·터진 편 이어 가기. 실사 특별편은 시즌 밖.
    from . import toon_series
    import sys as _sys
    if special:
        series_text, sctx = "summary·vote_a·vote_b 는 빈 문자열로 둔다(특별편은 시즌 밖 단독 편).\n\n", {}
    else:
        series_text, sctx = toon_series.prepare(_sys.modules[__name__], bible, date, recent_episode_titles(), today)
    skip = toon_series.allow_repeat(sctx)
    mot = toon_motifs()
    used_m, used_f = recent_motifs(date, mot.get("recent_block", 3))
    free_m = [x for x in mot["motifs"] if x["id"] not in used_m]
    free_f = [x for x in mot["frames"] if x["id"] not in used_f]
    motif_rule = ("[동전이 소동 모양·이야기 틀 (BK 11/20: 매번 같은 모션이면 지겹다)] 후보마다 아래에서 motif(id)·frame(id) 하나씩, "
                  "후보끼리도 최대한 다르게. motif 의 영어 문장을 소동 컷 프롬프트에 쓴다. 금화·저금통·돈 그림은 어떤 컷에도 넣지 않는다.\n"
                  "쓸 수 있는 motif: " + json.dumps(free_m, ensure_ascii=False) + "\n쓸 수 있는 frame: " + json.dumps(free_f, ensure_ascii=False)
                  + f"\n(최근 편에서 쓴 것, 금지: {used_m} / {used_f})")
    rv = recent_variety(date, mot.get("recent_block", 3))
    motif_rule += ("\n\n[반복 양산 금지 — 유튜브가 비슷한 틀로 찍어낸 영상을 덜 보여 준다 (BK 11/20)]\n"
                   "캐릭터(동전이·삼촌·조카)와 살림 주제는 그대로, 아래는 직전 3편과 겹치면 안 된다. 후보끼리도 서로 달라야 한다.\n"
                   f"- place(장소·배경): 직전 {rv['place'] or '기록 없음'} 과 다른 곳\n"
                   f"- hook_type(첫 3초 훅 유형, {HOOK_TYPES} 중 하나): 직전 {rv['hook_type'] or '기록 없음'} 금지\n"
                   f"- title_pattern(제목 띠 노란 줄 공식, {TITLE_PATTERNS} 중 하나): 직전 {rv['title_pattern'] or '기록 없음'} 금지\n"
                   "- 첫 컷 구도·카메라도 직전 편과 다르게. 겹치면 채점에서 칸마다 감점된다.")
    user = (f"{date} 공개 편 대본 후보를 서로 확실히 다른 {n}개 써 줘. 주제 후보(참고, 더 재미있으면 바꿔도 됨):\n"
            f"{json.dumps(info.get('concept'), ensure_ascii=False)}\n\n"
            "보는 사람: 살림 맡은 30~50대(주부). 동전이 상황극·이야기가 먼저, 살림 팁은 4번 컷 한 줄로 곁들임. "
            "맞히기 질문(BK 11/24): 제목 띠 노란 줄이 낸 질문의 답을 4번 컷 자막 첫 줄 '정답: …'으로 보여 준다. 답의 숫자는 사이트 근거에서 한 번만, "
            "number_box 는 그 답 숫자(근거가 없으면 빈 문자열, 그때 답은 말로). 돈을 외치거나 강조하지 않는다.\n"
            "cuts 는 정확히 4개, 각 caption 은 화면 자막(한 줄 14자 이하, 최대 2줄, '/'로 줄 나눔), camera 는 구도 메뉴의 영어 문구 하나.\n"
            "number_source 에는 아래 사이트 근거 경로와 계산을 적어라. 근거에 없는 숫자는 쓰지 마라.\n"
            f"최근 편(겹치지 않게):\n" + "\n".join(recent_episode_titles()) + "\n\n" + motif_rule + "\n\n" + reuse_rule(toon_reuse()) + "\n" + series_text + early_rules
            + "(사이트 근거는 system 끝 목록)")
    # 1시간 캐시: 작가 호출(출력 2만+ 토큰)과 채점 뒤의 다듬기 호출 사이가 5분을 넘기 쉽다
    # 생각(effort high)+후보 n개가 32000 을 넘겨 잘린 일(11/22) → 한도 64000, 그래도 잘리면 후보 수를 줄여 한 번 더
    vs = []
    for k in (n, max(2, n // 2)):
        try:
            vs = ask("toon", system, user.replace(f"서로 확실히 다른 {n}개", f"서로 확실히 다른 {k}개"),
                     schema=obj({"variants": arr(VARIANT)}), effort="high", max_tokens=64000, need=1.5,
                     cache="1h")["variants"][:k]
            break
        except RuntimeError as e:
            if "max_tokens" not in str(e) or k != n:
                raise
            print(f"작가 호출 잘림 ({k}개) → 후보 수 줄여 다시")
    judge_sys = ("너는 한국 쇼츠 편집장이다. 아래 바이블과 기준으로 대본 후보를 냉정하게 1~10점 채점한다.\n"
                 "hook=첫 1초 멈춤 힘, fun=이 편의 결(뻔하지 않음·인사이트·여운·한없이 즐거움)을 제대로 살렸는지 + 중독성(반복 개그·다시 보게 되는 마지막 컷·끝-처음 루프·귀에 남는 소리), aha=뻔하지 않은 관점·여운이 있고 숫자를 쓴다면 사이트 근거가 맞는지(근거 틀리면 1점), "
                 "bible=세계관·캐릭터·구도 규칙 + 소동 모양·틀·장소·훅 유형·제목 틀의 신선함(직전 3편과 겹치면 1점, 금화·저금통·돈 강조·뻔한 문제→절약 구성이면 1점), "
                 "clarity=자막만 보고 이해되고 문구가 가볍지 않은지(말장난·느낌표 남발이면 감점), "
                 "click=제목 띠 두 줄(band_top·band_accent)과 yt_title 이 피드에서 손가락을 멈추게 하는지 — 내 얘기 같은 장면 + 답이 궁금한 훅, "
                 "12자 이하, 답 금액 없음(숫자는 시간·개수만), 막연하거나 낚시면 3점 이하, '~하지 마세요·날릴 뻔' 같은 손실 회피·금기 경고면 2점 이하, 지시어로 숨기기(이거·이걸)가 화면 장면과 맞으면 가점" + (", heart 한 줄이 억지 명언이면 감점" if heart else "")
                 + ". total=6항목 합계(60점 만점). best=상위 2개 idx(0부터).\n\n" + copy_rule + "\n" + bible
                 + "\n\n" + ELECTRIC_RULE + "\n\n" + motif_rule
                 + ("\n\n" + early_rules + "위 2시간 반응 규칙을 어긴 후보는 hook 점수를 깎는다." if early_rules else "")
                 + ("\n\n" + series_text + "시즌 규칙(콜백·반복 개그·댓글로 고른 주제·엔딩 투표 두 주제)을 어기면 bible 점수를 깎는다." if sctx else "")
                 + "\n\n" + facts)
    judged = ask("toon", judge_sys, json.dumps(vs, ensure_ascii=False),
                 schema=JUDGE, effort="medium", need=0.6, cache="5m")
    scores = {s["idx"]: s for s in judged["scores"]}
    for i, v in enumerate(vs):  # 직전 3편과 겹치는 칸마다 감점 (모델 채점과 별개로 코드가 확실히)
        hit = overlaps(v, rv, skip)
        if hit and i in scores:
            scores[i]["total"] = scores[i].get("total", 0) - VARIETY_PENALTY * len(hit)
            scores[i]["note"] = f"[겹침 -{VARIETY_PENALTY * len(hit)}: {','.join(hit)}] " + scores[i].get("note", "")
    best = sorted(scores, key=lambda i: -scores[i]["total"])[:2] or [i for i in judged["best"] if 0 <= i < len(vs)][:2]
    first = {i: scores.get(i, {}).get("total", 0) for i in best}

    def refine(best: list[int]) -> None:
        """다듬기 (BK 11/20 "점수가 낮네" → "만점으로"): 상위 2안을 채점 메모대로 고쳐 다시 채점, 오른 것만 쓴다. 목표 57점·클릭 9점, 최대 3번."""
        for _ in range(REFINE_ROUNDS):
            weak = [i for i in best if scores.get(i, {}).get("total", 0) < REFINE_GOAL
                    or scores.get(i, {}).get("click", 0) < REFINE_CLICK]
            if not weak:
                break
            fixed = ask("toon", system, "아래 대본 후보들을 채점 메모의 약점을 모두 고쳐 다시 써 줘. 같은 주제·숫자·근거는 유지하고 "
                        "훅(첫 1초 움직임)·개그(잡으려다 실패)·자막 명확성·제목 띠 문구를 끌어올려라. 순서 그대로 돌려줘.\n\n"
                        + json.dumps([{"대본": vs[i], "채점": scores.get(i, {})} for i in weak], ensure_ascii=False),
                        schema=obj({"variants": arr(VARIANT)}), effort="high", max_tokens=32000,
                        need=0.6, cache="1h")["variants"][:len(weak)]
            if not fixed:
                break
            rejudged = ask("toon", judge_sys, json.dumps(fixed, ensure_ascii=False),
                           schema=JUDGE, effort="medium", need=0.3, cache="5m")
            for s in rejudged["scores"]:
                if 0 <= s["idx"] < len(fixed):  # 다듬은 안도 겹침 감점을 똑같이
                    hit = overlaps(fixed[s["idx"]], rv, skip)
                    s = dict(s, total=s.get("total", 0) - VARIETY_PENALTY * len(hit))
                if 0 <= s["idx"] < len(fixed) and s.get("total", 0) > scores.get(weak[s["idx"]], {}).get("total", 0):
                    i = weak[s["idx"]]
                    vs[i], scores[i] = fixed[s["idx"]], dict(s, idx=i)

    def top_total() -> int:
        return max((scores.get(i, {}).get("total", 0) for i in best), default=0)

    refine(best)
    # 새 기획 (BK 11/21 "기획안을 바꿔야지 스킵하면 안돼"): 다듬어도 통과선 아래면 떨어진 안들의 지적을 모아 각도를 바꾼 새 후보.
    replans = 0
    while top_total() < QUALITY_FLOOR and replans < REPLAN_ROUNDS:
        replans += 1
        fails = [{"제목": vs[i].get("title"), "제목 띠": f"{vs[i].get('band_top', '')} / {vs[i].get('band_accent', '')}",
                  "훅": vs[i].get("hook"), "개그": vs[i].get("gag"), "점수": scores.get(i, {})}
                 for i in sorted(scores, key=lambda i: -scores[i].get("total", 0))[:4]]
        more = None
        # 11/22 12/6 편: 4개를 한 번에 쓰다 20000 토큰에서 잘려 1차에서 바로 멈춤 → 상한을 올리고, 잘리면 개수를 줄여 한 번 더
        for k in (REPLAN_N, max(1, REPLAN_N // 2)):
            try:
                more = ask("toon", system, user + f"\n\n[새 기획 {replans}차 — BK 11/21 '기획안을 바꿔야지 스킵하면 안돼'] 아래 안들은 다듬어도 "
                           f"통과선({QUALITY_FLOOR}/{MAX_SCORE}) 아래였다. 채점 메모의 지적을 모두 반영해, 아래 안들과 겹치지 않게 "
                           f"주제 각도·첫 3초 훅·개그·제목 띠를 완전히 바꾼 새 후보 {k}개를 써라.\n"
                           + json.dumps(fails, ensure_ascii=False),
                           schema=obj({"variants": arr(VARIANT)}), effort="high", max_tokens=64000, need=1.0,
                           cache="1h")["variants"][:k]
                break
            except Exception as e:  # 잘림·예산·네트워크
                print(f"새 기획 {replans}차 ({k}개) 실패: {e}")
        if not more:
            break
        try:
            judged2 = ask("toon", judge_sys, json.dumps(more, ensure_ascii=False), schema=JUDGE, effort="medium", need=0.3, cache="5m")
        except Exception as e:
            print(f"새 기획 채점 실패: {e}")
            break
        base = len(vs)
        vs.extend(more)
        for s in judged2["scores"]:
            if 0 <= s["idx"] < len(more):
                hit = overlaps(more[s["idx"]], rv, skip)
                i = base + s["idx"]
                scores[i] = dict(s, idx=i, total=s.get("total", 0) - VARIETY_PENALTY * len(hit))
                if hit:
                    scores[i]["note"] = f"[겹침 -{VARIETY_PENALTY * len(hit)}: {','.join(hit)}] " + scores[i].get("note", "")
        best = sorted(scores, key=lambda i: -scores[i].get("total", 0))[:2]
        first.update({i: scores[i].get("total", 0) for i in best if i >= base})
        refine(best)
    best.sort(key=lambda i: -scores.get(i, {}).get("total", 0))
    top = scores.get(best[0], {}).get("total", 0) if best else 0
    below = top < QUALITY_SOFT
    soft = QUALITY_SOFT <= top < QUALITY_FLOOR
    md = [*([f"> ⚠️ 품질 게이트 미통과: 기획안을 {replans}번 새로 짜도 1안 {top}/{MAX_SCORE}점 < 최후 기준 {QUALITY_SOFT}점. 이 편은 쉬는 걸 추천해요 "
             "(BK 11/20 '품질이 떨어지는 문구·영상·구도는 안 하느니 못해'). 클립을 만들지 마시고, 그래도 하려면 안을 직접 고쳐 주세요.", ""]
           if below else []),
          *([f"> ℹ️ 기획안을 {replans}번 새로 짜도 통과선 {QUALITY_FLOOR}점은 못 넘었지만 1안 {top}/{MAX_SCORE}점은 최후 기준({QUALITY_SOFT}) 이상이라 "
             "진행해도 돼요 (BK 11/21 '기획안을 바꿔야지 스킵하면 안돼').", ""] if soft else []),
          f"# 동전이 {'실사 삼촌 특별편' if special else '만화'} 대본 후보 — {date} 공개 편", "",
          f"자동 생성 {today.isoformat()} (Claude API, 후보 {len(vs)}개 → 채점 → 상위 2개 다듬기"
          + (f" → 미달이라 새 기획 {replans}번" if replans else "") + "). "
          
          f"점수는 {MAX_SCORE}점 만점의 깐깐한 편집장 채점이에요({MAX_SCORE * 8 // 10}점 = 대부분 항목 8점, 제목 띠 문구 포함). "
          "마음에 드는 안을 골라 이 PR에 댓글로 번호만 남기거나, 그냥 병합하면 1안으로 진행해요. 숫자는 근거를 다시 확인한 뒤 자막에 넣어요.", ""]
    for rank, i in enumerate(best, 1):
        v, s = vs[i], scores.get(i, {})
        prompts = ask("toon", "너는 Veo 영상 프롬프트 작가다. 바이블의 '프롬프트 조립' 순서와 고정 문장을 글자 그대로 쓴다. "
                      "클립마다 영어 프롬프트 하나, 동작은 하나만.\n" + kind + "\n" + bible,
                      json.dumps(v, ensure_ascii=False) + "\n\n이 대본의 컷 4개에 맞는 Veo 프롬프트 4개를 써 줘.",
                      schema=PROMPTS, model=SONNET, effort="medium", need=0.3, cache="5m")["prompts"][:4]
        up = f", 다듬기 전 {first[i]}" if first.get(i) and first[i] != s.get("total") else ""
        md += [f"## {rank}안: {v['title']}  (점수 {s.get('total', '?')}/{MAX_SCORE}{up})", "",
               f"- 제목 띠: **{v.get('band_top', '')}** / **{v.get('band_accent', '')}** (흰 줄 / 노란 줄, 클릭 {s.get('click', '?')}/10)",
               f"- 유튜브 제목: {v.get('yt_title', '')}",
               *([f"- 이 편의 결: {v['mood']}"] if v.get("mood") else []),
               *([f"- 공감 한 줄(4번 컷 자막): {v['heart']}"] if v.get("heart") else []),
               f"- 모양·틀: {v.get('motif', '')} / {v.get('frame', '')}",
               f"- 장소·훅유형·제목틀: {v.get('place', '')} / {v.get('hook_type', '')} / {v.get('title_pattern', '')}",
               *([f"- 엔딩 투표(다음엔 어디로 갈까?): A {v.get('vote_a', '')} / B {v.get('vote_b', '')} · 줄거리: {v.get('summary', '')}"]
                 if sctx and v.get("vote_a") else []),
               f"- 장소: {v['place']} / 훅: {v['hook']} / 개그: {v['gag']}",
               f"- 숫자 상자: **{v['number_box']}** — 근거: {v['number_source']}",
               f"- 삼촌 한 마디: {v['tip']} / 재미 포인트: {v['why_fun']}",
               f"- 채점 메모: {s.get('note', '')}", "", "| 컷 | 화면 | 자막 | 구도 |", "|---|---|---|---|"]
        md += [f"| {k} | {c['screen']} | {c['caption']} | {c['camera']} |" for k, c in enumerate(v["cuts"], 1)]
        reuse = {c["id"]: c for c in toon_reuse()}
        md += [""] + [(f"{k}. ♻️ 재사용 클립 `{reuse[c['reuse']]['file']}` — Flow 로 새로 안 만들어도 돼요" if c.get("reuse") in reuse
                       else f"{k}. `{p}`") for k, (c, p) in enumerate(zip(v["cuts"], prompts), 1)] + [""]
    md += ["## 나머지 후보", "", "| # | 제목 띠 | 숫자 | 점수 | 메모 |", "|---|---|---|---|---|"]
    for i, v in enumerate(vs):
        if i not in best:
            s = scores.get(i, {})
            md.append(f"| {i} | {v['title']} ({v.get('band_top', '')} / {v.get('band_accent', '')}) | {v['number_box']} | {s.get('total', '?')} | {s.get('note', '')[:60]} |")
    if sctx:
        s0 = sctx["season"]
        head = [f"시즌: **{s0['title']}** — 목표 '{s0['goal']}' · 반복 개그 '{s0['running_gag']}'"]
        if sctx.get("winner"):
            head.append(f"댓글로 고른 주제: **{sctx['winner']['result']['winner']}** ({sctx['winner']['date']} 편 투표)")
        if sctx.get("breakout"):
            head.append(f"터진 편 이어 가기: 「{sctx['breakout'].get('title', '')}」 훅·틀 재사용")
        md[3:3] = head + [""]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    paths = [str(out.relative_to(ROOT))]
    if sctx and best:  # 1안을 시즌 기록·투표에 올린다 (PR 병합 = 확정, 2안을 고르면 조립 때 투표 문구만 바꿈)
        paths.append(str(toon_series.record(date, vs[best[0]], sctx).relative_to(ROOT)))
    url = open_pr(f"auto/toon-{date}", f"동전이 대본 후보 {date}", f"`{out.relative_to(ROOT)}` 를 열어 보세요. 상위 2안에 Veo 프롬프트까지 있어요.",
                  paths)
    if url and below:
        notify(f"⚠️ 동전이 {date} 편은 기획안을 {replans}번 새로 짜도 대본 점수가 최후 기준 아래({top}/{MAX_SCORE} < {QUALITY_SOFT})라 쉬는 걸 추천해요. "
               f"클립은 만들지 마세요. 후보는 참고로 남겼어요.\n{url}")
    elif url and not auto_merge(url):  # BK 11/21 "추천 제안으로 진행하고 메세지는 생략": 1안 자동 병합, 알림 없음
        notify(f"🐶 동전이 {date} 편 대본 1안을 자동으로 확정하려다 병합이 막혔어요(충돌 등). 휴대폰에서 병합해 주세요.\n{url}")
    return 0


def auto_merge(url: str) -> bool:
    """대본 후보 PR 을 바로 병합(= 1안 진행). 막히면 False → 그때만 텔레그램."""
    try:
        sh("gh", "pr", "merge", url, "--merge")
        return True
    except subprocess.CalledProcessError as e:
        print("자동 병합 실패:", (e.stderr or "").strip()[:300])
        return False


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
    report = ask("adsense", system, user, effort="high", max_tokens=32000, need=1.2)  # 12000 에서 잘림 (11/22)
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
    early = jload("data/youtube/early.json") if (ROOT / "data/youtube/early.json").exists() else {}
    early_rows = [{"ch": r.get("kind"), "title": r.get("title"), "age_min": r.get("age_min"), "views": r.get("views"),
                   "likes": r.get("likes"), "comments": r.get("comments"), "next_rule": (r.get("hint") or {}).get("next")}
                  for r in early.values()][-40:]
    system += (" 'early' 는 공개 약 2시간 시점 숫자와 그때 나온 다음 편 규칙이다. 첫 반응(2시간)과 최종 조회가 어긋나는 편이 있으면 짚고, "
               "2시간 규칙 중 효과가 있었던 것은 유지·없던 것은 빼자고 제안한다. 5락실 밸런스 질문 규칙도 따로 한 칸 쓴다.")
    report = ask("shorts", system, json.dumps({"final": rows, "early": early_rows}, ensure_ascii=False), effort="medium", need=0.5)
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
    # 글 JSON에는 표기가 없다: 사이트 코드가 만들 때 자동으로 붙인다 → 실제 붙는 문구를 같이 보낸다 (2026-11-21 오탐)
    from . import articles, site
    for f in items:
        if f.parent.name == "articles" and articles.has_affiliate(json.loads(f.read_text(encoding="utf-8"))):
            texts[str(f.relative_to(ROOT)) + " (사이트에 자동으로 붙는 표기)"] = (
                f"페이지 맨 위(본문·링크보다 먼저) 띠: [광고] {site.DISCLOSURE}\n상품 카드 바로 위: {articles.CARD_AD}")
    system = ("너는 한국 광고·플랫폼 정책 검사관이다. 다음을 찾는다: 공정위 대가성 표기 누락(상품 카드·제휴가 있는데 [광고] 없음. "
              "'(사이트에 자동으로 붙는 표기)' 항목이 있으면 그 문구가 실제 페이지에 붙으므로 누락이 아니다), "
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
            r = ask("polish", system, user, schema=POLISH, effort="high", max_tokens=24000, need=0.6, cache="5m")
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
