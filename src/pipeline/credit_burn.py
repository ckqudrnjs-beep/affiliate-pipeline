"""남은 Claude API 크레딧으로 한 번만 돌리는 묶음 작업 (2026-11-28 BK '최대한 활용하자, 12월 1일 전에 많이 해놓자').

크레딧 만료는 12/14 09:00 KST(Console)지만 BK 요청대로 12/1 전에 돌린다. 모두 배치(50% 할인)로 한 번에 넣고,
결과는 PR 로만 나온다(BK 가 병합 = 승인). 주소(slug) 변경·삭제 없음(애드센스 심사 중).

작업 (python -m pipeline.credit_burn <작업> [인자]):
  boost    기존 글 24편 보강: 쓰기 → 편집장 검토·고침 2단계, 자동 검사 통과한 것만 → PR
  drafts   12월 새 글 초안 14편 (data/article_drafts/, 발행은 지금처럼 하루 1편 예약 작업이 초안을 다듬어서)
  review   색인 페이지 전체 품질 점검 보고서 (docs/reviews/) — 고치지 않음
  thin     얇은 페이지 보강: 레시피 20편(실수·보관·질문 칸) + 계산기 질문 12편(설명·팁·질문)
  raksilq  5락실 밸런스 질문 12/12~12/31 (하루 3개, 후보 5개 → 채점 → 3개)
  toon     동전이 대본 후보: claude_jobs.toon(target=날짜)  (인자: YYYY-MM-DD)
계획·비용: docs/CLAUDE_API_CREDIT.md '12/1 전 묶음 작업'.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import subprocess
import sys
import time

from . import claude_jobs as cj
from .claude_jobs import OPUS, SONNET, ROOT, S, I, obj, arr

WAIT_MIN = 200       # 배치 한 묶음을 이만큼까지 기다린다 (워크플로 제한 330분 안)
POLL_SEC = 30
EDITOR_RULES = "docs/ARTICLES_AUTO.md"


class Req:
    def __init__(self, cid: str, system: str, user: str, schema: dict, *, model: str = OPUS, effort: str = "high",
                 max_tokens: int = 32000):
        self.cid, self.system, self.user, self.schema = cid, system, user, schema
        self.model, self.effort, self.max_tokens = model, effort, max_tokens

    def params(self) -> dict:
        return dict(model=self.model, max_tokens=self.max_tokens, system=self.system,
                    messages=[{"role": "user", "content": self.user}],
                    output_config={"effort": self.effort, "format": {"type": "json_schema", "schema": self.schema}})


def ask_many(job: str, reqs: list[Req], need_each: float) -> dict[str, dict]:
    """요청 여러 개를 배치 하나로 넣고 끝날 때까지 기다린다. 성공한 것만 {custom_id: JSON}. 사용 금액은 장부에."""
    import anthropic
    if not reqs:
        return {}
    d = cj.today_kst()
    client = anthropic.Anthropic()
    reuse = _REUSE.get(job, [])
    if reuse:  # 이미 돈을 낸 배치 결과를 다시 읽는다(장부에 다시 적지 않음). REUSE_<JOB>=배치id,배치id (호출 순서대로)
        bid = reuse.pop(0)
        print(f"[{job}] 지난 배치 {bid} 결과 다시 읽기")
        return _results(client, job, bid, {r.cid: r for r in reqs}, d, record=False)
    cj.check_budget(d, job, need_each * len(reqs))
    b = client.beta.messages.batches.create(requests=[{"custom_id": r.cid, "params": r.params()} for r in reqs])
    print(f"[{job}] 배치 {b.id} 요청 {len(reqs)}개")
    deadline = time.monotonic() + WAIT_MIN * 60
    while client.beta.messages.batches.retrieve(b.id).processing_status != "ended":
        if time.monotonic() > deadline:
            client.beta.messages.batches.cancel(b.id)
            print(f"[{job}] {WAIT_MIN}분 안에 안 끝나 취소 → 끝난 것만 씀")
            time.sleep(60)
            break
        time.sleep(POLL_SEC)
    return _results(client, job, b.id, {r.cid: r for r in reqs}, d)


_REUSE = {k[6:].lower(): [x.strip() for x in v.split(",") if x.strip()] for k, v in os.environ.items() if k.startswith("REUSE_")}


def _results(client, job: str, bid: str, by: dict, d: dt.date, record: bool = True) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for e in client.beta.messages.batches.results(bid):
        if e.result.type != "succeeded" or e.custom_id not in by:
            print(f"[{job}] {e.custom_id}: {e.result.type}")
            continue
        m = e.result.message
        usd = cj.record(d, job, by[e.custom_id].model, cj._usage(m), batch=True) if record else 0.0
        if m.stop_reason != "end_turn":
            print(f"[{job}] {e.custom_id}: {m.stop_reason} (${usd}) → 버림")
            continue
        text = "".join(x.text for x in m.content if getattr(x, "type", "") == "text")
        try:
            out[e.custom_id] = json.loads(text)
        except json.JSONDecodeError:
            print(f"[{job}] {e.custom_id}: JSON 아님 → 버림")
    print(f"[{job}] 성공 {len(out)}/{len(reqs)}, 이번 작업 누적 ${cj.spent(d, job)}")
    return out


def jdump(p, data) -> None:
    p = ROOT / p
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def ctx() -> dict:
    from . import calcs
    arts = {json.loads(f.read_text(encoding="utf-8"))["slug"]: json.loads(f.read_text(encoding="utf-8"))
            for f in sorted((ROOT / "data/articles").glob("*.json"))}
    prods = {}
    for f in (ROOT / "data/products").glob("*.json"):
        p = json.loads(f.read_text(encoding="utf-8"))
        prods[p["slug"]] = p.get("name") or p.get("title") or p["slug"]
    calc = {c["slug"]: c.get("title") or c.get("name") or c["slug"] for c in calcs.CALCS}
    return {"arts": arts, "prods": prods, "calc": calc}


def links_text(c: dict) -> str:
    return ("[본문에서 쓸 수 있는 사이트 안 링크 — 이 목록 밖 주소는 쓰지 않는다]\n"
            + "\n".join(f"- calc/{k}.html ({v})" for k, v in c["calc"].items())
            + "\n" + "\n".join(f"- guide/{k}.html ({a['title']})" for k, a in c["arts"].items())
            + "\n- 상품 p/<slug>.html 은 아래 slug 만: " + ", ".join(sorted(c["prods"])))


ART = obj({"title": S, "desc": S, "body": S, "summary": S})
FIX = obj({"problems": arr(S), "title": S, "desc": S, "body": S})

WRITER_ROLE = ("너는 '돈 줍는 삼촌'(don3chon.com) 편집자다. 애드센스가 '가치가 별로 없는 콘텐츠'로 거절한 뒤라, 독자가 이 글 하나로 "
               "실제 결정을 내릴 수 있을 만큼 쓸모 있는 정보를 더한다. 아래 글 규칙을 그대로 지킨다.\n")
EDITOR_ROLE = ("너는 '돈 줍는 삼촌' 편집장이다. 아래 글 규칙으로 후보 글을 깐깐하게 검토한다: 계산이 사이트 기준(전기요금 규칙)과 맞는지 직접 "
               "다시 계산, 가정 숫자를 가정이라고 썼는지, 제목 금액에 조건이 있는지, 지어낸 체험·후기·별점, 기기 동작 단정, 건강 효능, "
               "같은 말 늘리기, 기계적 표현·말버릇, 목록 밖 링크·외부 링크. problems 에 찾은 문제를 한 줄씩(없으면 빈 목록), "
               "title·desc·body 에는 문제를 모두 고친 최종본을 낸다(문제가 없으면 그대로). 분량은 줄이지 않는다.\n")


def two_pass(job: str, items: list[tuple[str, str]], c: dict, need: float) -> dict[str, dict]:
    """[(id, 쓰기 지시)] → 쓰기(배치) → 편집장 검토·고침(배치). {id: {title, desc, body, summary, problems}}"""
    rules = (ROOT / EDITOR_RULES).read_text(encoding="utf-8")
    base = rules + "\n\n" + cj.ELECTRIC_RULE + "\n\n" + links_text(c)
    first = ask_many(job, [Req(i, WRITER_ROLE + base, u, ART) for i, u in items], need)
    second = ask_many(job, [Req(i, EDITOR_ROLE + base, json.dumps({"후보": {k: r[k] for k in ("title", "desc", "body")}},
                                                                   ensure_ascii=False), FIX)
                            for i, r in first.items()], need * 0.7)
    out = {}
    for i, r in first.items():
        f = second.get(i)
        out[i] = {**r, **({k: f[k] for k in ("title", "desc", "body")} if f and len(f["body"]) >= len(r["body"]) * 0.85 else {}),
                  "problems": (f or {}).get("problems", ["편집장 검토 못 받음"])}
    return out


# ---------- 1. 기존 글 보강 ----------
BOOST_TASK = ("[이번 일] 아래 기존 글을 보강한다. 주소(slug)는 그대로. 본문 목표 3,800~4,800자. 지금 맞는 내용은 살리고, 같은 말 늘리기 대신 "
              "새 정보로 채운다: ① 직접 계산한 표 1개 이상(전기요금은 위 기준으로 실제 계산, 가정은 표 아래 한 줄로), ② 집 크기·사용 시간·"
              "가족 수처럼 상황별 예시 2~3개, ③ 자주 하는 실수 3개 안팎과 바로잡는 법, ④ 오늘 해 볼 확인 순서. 소제목 수·순서·첫 소제목 "
              "방식은 다른 글과 다르게. 다른 글과 겹치는 표·계산은 다시 쓰지 말고 guide 링크로. 제목은 꼭 필요할 때만 고친다(제목 금액엔 "
              "조건). summary 에 무엇을 보강했는지 한 줄.")


def boost(today: dt.date | None = None) -> int:
    from . import articles
    today = today or cj.today_kst()
    c = ctx()
    items = []
    for slug, a in c["arts"].items():
        others = [o["title"] for k, o in c["arts"].items() if k != slug]
        items.append((slug, BOOST_TASK + "\n\n" + json.dumps({"글": {k: a.get(k) for k in ("slug", "title", "desc", "body")},
                                                               "다른 글 제목": others}, ensure_ascii=False)))
    res = two_pass("boost", items, c, need=0.25)
    new = dict(c["arts"])
    for slug, r in res.items():
        new[slug] = {**c["arts"][slug], "title": r["title"], "desc": r["desc"], "body": r["body"], "updated": today.isoformat()}
    changed, notes, skipped = [], [], []
    prods, calc_slugs, art_slugs = set(c["prods"]), set(c["calc"]), set(c["arts"])
    # 하나씩 넣어 보며 검사: 통과한 것만 남긴다(닮음 검사는 이미 받아들인 새 글들과 함께)
    accepted = dict(c["arts"])
    for slug in sorted(res, key=lambda s: -len(new[s]["body"])):
        cand = new[slug]
        if len(cand["body"]) <= len(c["arts"][slug]["body"]):
            skipped.append(f"- `{slug}`: 보강안이 더 짧아 건너뜀")
            continue
        errs = articles.validate(cand, prods, calc_slugs, art_slugs)
        errs += articles.similarity_problems(list({**accepted, slug: cand}.values()))
        if errs:
            skipped.append(f"- `{slug}`: 검사 실패 {errs[:2]}")
            continue
        accepted[slug] = cand
        jdump(f"data/articles/{slug}.json", cand)
        changed.append(f"data/articles/{slug}.json")
        notes.append(f"- `{slug}` {len(c['arts'][slug]['body']):,} → {len(cand['body']):,}자: {res[slug]['summary']}"
                     + (f" (편집장 고침 {len(res[slug]['problems'])}건)" if res[slug]["problems"] else ""))
    if not changed:
        print("보강 통과 0편")
        return 0
    body = (f"남은 API 크레딧으로 기존 글 {len(changed)}편을 보강했어요 (BK 11/28). 주소 그대로, 쓰기 → 편집장 검토 2단계, 자동 검사 통과분만.\n"
            "병합하면 바로 사이트에 반영돼요. 숫자는 편집장이 다시 계산했지만 한두 편 훑어봐 주세요.\n\n" + "\n".join(notes)
            + ("\n\n건너뜀:\n" + "\n".join(skipped) if skipped else "") + f"\n\n비용 ${cj.spent(today, 'boost')}")
    cj.open_pr(f"auto/boost-{today.isoformat()}", f"기존 글 {len(changed)}편 보강 (애드센스 재신청 준비)", body, changed)
    return 0


# ---------- 2. 12월 새 글 초안 ----------
DRAFT_N = 14
DRAFT_TASK = ("[이번 일] 아래 질문으로 새 글 초안을 쓴다. 형식(format)과 각도(angle)를 따른다. 분량·표·소제목 수는 주어진 shape 의 글 규칙 표를 그대로 따르고(긴가이드면 3,000자 이상), 직접 계산한 표나 단계별 "
              "예시 1개 이상. 제목·desc 는 검색하는 사람이 쓰는 말로. 이미 있는 글과 같은 질문·같은 표를 쓰지 않고, 비슷하면 guide 링크 + 다른 "
              "각도. 날짜에 묶이는 말(오늘, 이번 주)은 쓰지 않는다(발행일이 아직 안 정해짐). summary 에 slug 로 쓸 영문 소문자-하이픈 주소 하나만.")


def drafts(today: dt.date | None = None) -> int:
    from . import articles
    today = today or cj.today_kst()
    c = ctx()
    topics = cj.jload("data/article_topics.json")
    todo = [t for t in topics if not t.get("done") and not t.get("draft")][:DRAFT_N]
    items = [(f"t{i}", DRAFT_TASK + "\n\n" + json.dumps({"질문": t, "shape(겉모습, 글 규칙 표대로)": articles.SHAPES[i % len(articles.SHAPES)], "이미 있는 글 제목": [a["title"] for a in c["arts"].values()]},
                                                       ensure_ascii=False)) for i, t in enumerate(todo)]
    res = two_pass("drafts", items, c, need=0.25)
    prods, calc_slugs = set(c["prods"]), set(c["calc"])
    pool = list(c["arts"].values())
    changed, notes, skipped = [], [], []

    def build(i: int, t: dict, r: dict) -> tuple[dict, list[str]]:
        m = re.search(r"[a-z0-9]+(?:-[a-z0-9]+)+", r["summary"].lower())  # 11/29: 문장이 섞여도 주소 모양만 꺼낸다
        slug = (m.group(0) if m else "")[:60].strip("-") or f"draft-{today:%m%d}-{i}"
        if slug in c["arts"] or (ROOT / f"data/article_drafts/{slug}.json").exists():
            slug = f"{slug[:52]}-{today:%m%d}"
        a = {"slug": slug, "date": (today + dt.timedelta(days=3 + i)).isoformat(), "title": r["title"], "desc": r["desc"],
             "keywords": [], "body": r["body"], "products": [], "status": "draft", "topic": t["q"], "format": t.get("format", ""),
             "drafted": today.isoformat(), "shape": articles.SHAPES[i % len(articles.SHAPES)]}  # PR #435 글 모양 돌려 쓰기
        return a, articles.validate(a, prods, calc_slugs, set(c["arts"])) + articles.similarity_problems(pool + [a])

    # 11/29 첫 실행: 14편 모두 검사에서 떨어졌는데 이유가 안 남았다 → 이유를 찍고, 떨어진 글은 이유를 주고 한 번 더 고친다
    first = {i: build(i, t, res[f"t{i}"]) for i, t in enumerate(todo) if f"t{i}" in res}
    for i, (a, errs) in first.items():
        print(f"[drafts] {a['slug']}: {errs[:3] or '통과'}")
    bad = {i: (a, e) for i, (a, e) in first.items() if e}
    fixed = ask_many("drafts", [Req(f"f{i}", EDITOR_ROLE + (ROOT / EDITOR_RULES).read_text(encoding="utf-8") + "\n\n" + cj.ELECTRIC_RULE
                                   + "\n\n" + links_text(c),
                                   json.dumps({"자동 검사에서 걸린 점(모두 고칠 것)": e, "이 글의 shape(겉모습, 글 규칙 표대로)": a["shape"], "다른 글과 겹치면 그 문장·표를 새로 쓰거나 guide 링크로": True,
                                               "후보": {k: a[k] for k in ("title", "desc", "body")}}, ensure_ascii=False), FIX)
                               for i, (a, e) in bad.items()], need_each=0.2)
    for i, t in enumerate(todo):
        if i not in first:
            continue
        a, errs = first[i]
        if errs and f"f{i}" in fixed:
            f = fixed[f"f{i}"]
            a, errs = build(i, t, {**res[f"t{i}"], "title": f["title"], "desc": f["desc"], "body": f["body"]})
            print(f"[drafts] 고친 뒤 {a['slug']}: {errs[:3] or '통과'}")
        else:
            a, errs = build(i, t, res[f"t{i}"])  # pool 이 늘었으니 다시 검사
        r = {"title": a["title"], "body": a["body"]}
        slug = a["slug"]
        if errs:
            skipped.append(f"- {t['q']}: 검사 실패 {errs[:2]}")
            continue
        pool.append(a)
        jdump(f"data/article_drafts/{slug}.json", a)
        t["draft"] = slug
        changed.append(f"data/article_drafts/{slug}.json")
        notes.append(f"- [{t.get('format', '')}] {r['title']} ({len(r['body']):,}자) → `{slug}`")
    if not changed:
        return 0
    jdump("data/article_topics.json", topics)
    changed.append("data/article_topics.json")
    body = (f"12월 새 글 초안 {len(changed) - 1}편이에요 (BK 11/28). **발행은 지금처럼 하루 1편**: 매일 05:00 글 작업이 그날 질문에 초안이 있으면 "
            "그걸로 시작해 숫자·최근 글과 겹침을 다시 보고 올려요(docs/ARTICLES_AUTO.md). 사이트에는 병합해도 아무것도 안 보여요.\n\n"
            + "\n".join(notes) + ("\n\n건너뜀:\n" + "\n".join(skipped) if skipped else "") + f"\n\n비용 ${cj.spent(today, 'drafts')}")
    cj.open_pr(f"auto/drafts-{today.isoformat()}", f"12월 새 글 초안 {len(changed) - 1}편", body, changed)
    return 0


# ---------- 3. 사이트 전체 품질 점검 ----------
REVIEW = obj({"pages": arr(obj({"path": S, "score": I, "issues": arr(obj({"level": S, "issue": S, "fix": S}))}))})
REVIEW_SYS = ("너는 구글 애드센스 심사관이자 깐깐한 편집장이다. don3chon.com 페이지 본문을 읽고 페이지마다 score(1~10, 독자에게 쓸모 있는 정도)와 "
              "문제를 찾는다. level 은 '높음'(정책 위험·틀린 숫자·지어낸 체험·[광고] 표기 누락·제휴 링크 위주), '중간'(얇은 내용, 같은 말 반복, "
              "가정 숫자를 사실처럼, 다른 페이지와 거의 같음), '낮음'(문장·구성). fix 는 무엇을 어떻게 고칠지 한 줄. 전기요금은 아래 기준으로 직접 "
              "다시 계산해 본다. 문제가 없으면 issues 를 빈 목록으로.\n\n")
CHUNK = 5


def site_pages(out: str = "/tmp/site") -> list[tuple[str, str]]:
    subprocess.run([sys.executable, "-m", "pipeline.site", out], cwd=ROOT, check=True, capture_output=True,
                   env={**os.environ, "PYTHONPATH": str(ROOT / "src")})
    root = __import__("pathlib").Path(out)
    pages = []
    for u in re.findall(r"<loc>([^<]+)</loc>", (root / "sitemap.xml").read_text(encoding="utf-8")):
        path = re.sub(r"^https?://[^/]+/?", "", u)
        f = root / path
        if path == "" or f.is_dir():
            f = f / "index.html"
        if not f.exists():
            f = root / (path + ".html")
        if f.exists():
            h = f.read_text(encoding="utf-8")
            m = re.search(r"(?is)<main.*?</main>", h)
            pages.append((path or "/", cj.page_text(m.group(0) if m else h, limit=7000)))
    return pages


def review(today: dt.date | None = None) -> int:
    today = today or cj.today_kst()
    pages = site_pages()
    chunks = [pages[i:i + CHUNK] for i in range(0, len(pages), CHUNK)]
    res = ask_many("review", [Req(f"c{n}", REVIEW_SYS + cj.ELECTRIC_RULE + "\n\n" + (ROOT / EDITOR_RULES).read_text(encoding="utf-8"),
                                  json.dumps([{"path": p, "text": t} for p, t in ch], ensure_ascii=False), REVIEW)
                              for n, ch in enumerate(chunks)], need_each=0.15)
    rows = [p for r in res.values() for p in r["pages"]]
    order = {"높음": 0, "중간": 1, "낮음": 2}
    issues = sorted(((order.get(i["level"], 3), p["path"], i) for p in rows for i in p["issues"]), key=lambda x: (x[0], x[1]))
    lines = [f"# don3chon 품질 점검 {today.isoformat()}", "",
             f"색인 페이지 {len(pages)}쪽 중 {len(rows)}쪽 점검 (Opus 5.5, 남은 크레딧 묶음 작업 BK 11/28). 이 보고서는 고치지 않고 목록만 만든다.", "",
             f"- 문제: 높음 {sum(1 for x in issues if x[0] == 0)} · 중간 {sum(1 for x in issues if x[0] == 1)} · 낮음 {sum(1 for x in issues if x[0] == 2)}",
             f"- 평균 점수 {sum(p['score'] for p in rows) / max(1, len(rows)):.1f}/10", "",
             "## 문제 목록", "", "| 정도 | 페이지 | 문제 | 고칠 점 |", "|---|---|---|---|"]
    cell = lambda s: str(s).replace("|", "/").replace("\n", " ")
    lines += [f"| {i['level']} | {p} | {cell(i['issue'])} | {cell(i['fix'])} |" for _, p, i in issues]
    lines += ["", "## 페이지 점수 (낮은 순)", "", "| 점수 | 페이지 |", "|---|---|"]
    lines += [f"| {p['score']} | {p['path']} |" for p in sorted(rows, key=lambda p: p["score"])]
    path = f"docs/reviews/site-quality-{today.isoformat()}.md"
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    top = [f"- [{i['level']}] {p}: {i['issue']}" for o, p, i in issues if o == 0][:15]
    cj.open_pr(f"auto/review-{today.isoformat()}", f"don3chon 품질 점검 보고서 {today.isoformat()}",
               f"보고서만 추가해요(사이트 변화 없음). 높음 문제부터:\n\n" + ("\n".join(top) or "- 높음 없음")
               + f"\n\n전체: `{path}` · 비용 ${cj.spent(today, 'review')}", [path])
    return 0


# ---------- 4. 얇은 페이지 보강 ----------
RECIPE_ADD = obj({"intro": S, "mistakes": arr(S), "storage": arr(S), "faq": arr(obj({"q": S, "a": S}))})
QADD = obj({"note": S, "tips": arr(S), "faq": arr(obj({"q": S, "a": S}))})
THIN_SYS = ("너는 '돈 줍는 삼촌' 편집자다. 애드센스 '가치가 별로 없는 콘텐츠' 거절 뒤 얇은 페이지를 보강한다. 친근한 ~해요체. 지어낸 체험·후기·"
            "건강 효능·브랜드 이름·링크 금지. 새 숫자는 주어진 값으로 계산할 수 있는 것만, 확실하지 않으면 숫자 없이 쓴다. 다른 페이지와 같은 "
            "문장을 돌려 쓰지 말고 이 메뉴·이 기기에만 맞는 구체적인 내용으로.\n")


def thin(today: dt.date | None = None) -> int:
    from . import recipes as RC
    today = today or cj.today_kst()
    recs = {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in sorted((ROOT / "data/recipes").glob("*.json"))}
    qs = cj.jload("data/calc_questions.json")
    reqs = [Req(f"r-{k}", THIN_SYS + "[레시피] intro 는 지금 내용을 살려 2~4문장으로 다듬고, mistakes 3개(자주 하는 실수와 바로잡는 법), "
                "storage 2~3개(남은 재료·남은 음식 보관과 다음 메뉴로 돌려 쓰기), faq 3개(검색하는 사람이 묻는 말). 재료 양·원가는 바꾸지 않는다.",
                json.dumps({k2: r.get(k2) for k2 in ("name", "intro", "ingredients", "steps", "tips")}, ensure_ascii=False),
                RECIPE_ADD, effort="medium", max_tokens=16000) for k, r in recs.items() if not r.get("mistakes")]
    reqs += [Req(f"q-{q['slug']}", THIN_SYS + cj.ELECTRIC_RULE + "\n[계산기 질문 페이지] note 는 지금 설명을 살려 600~900자로(이 기기 전력이 "
                 "언제 커지고 작아지는지, 계산 가정의 의미, 우리 집에 맞게 바꿔 보는 법), tips 는 지금 것 포함 5개, faq 는 지금 것 포함 5개"
                 "(새 답의 숫자는 params 로 위 기준에 따라 계산한 것만).",
                 json.dumps({k2: q.get(k2) for k2 in ("h1", "name", "kind", "params", "note", "tips", "faq")}, ensure_ascii=False),
                 QADD, effort="high", max_tokens=16000) for q in qs if len(q.get("note", "")) < 600]
    res = ask_many("thin", reqs, need_each=0.08)
    changed, notes = [], []
    for k, r in recs.items():
        a = res.get(f"r-{k}")
        if not a or len(a["mistakes"]) < 2 or len(a["faq"]) < 2:
            continue
        cand = {**r, "intro": a["intro"] or r["intro"], "mistakes": a["mistakes"], "storage": a["storage"],
                "faq": [[f["q"], f["a"]] for f in a["faq"]], "updated": today.isoformat()}
        if "http" in json.dumps(cand, ensure_ascii=False):
            continue
        jdump(f"data/recipes/{k}.json", cand)
        changed.append(f"data/recipes/{k}.json")
        notes.append(f"- 레시피 `{k}`: 실수 {len(a['mistakes'])} · 보관 {len(a['storage'])} · 질문 {len(a['faq'])}")
    qn = 0
    for q in qs:
        a = res.get(f"q-{q['slug']}")
        if not a or len(a["note"]) <= len(q.get("note", "")) or "http" in json.dumps(a, ensure_ascii=False):
            continue
        q.update(note=a["note"], tips=a["tips"] or q["tips"], faq=[[f["q"], f["a"]] for f in a["faq"]] or q["faq"])
        qn += 1
        notes.append(f"- 질문 `q/{q['slug']}`: 설명 {len(a['note'])}자 · 팁 {len(q['tips'])} · 질문 {len(q['faq'])}")
    if qn:
        jdump("data/calc_questions.json", qs)
        changed.append("data/calc_questions.json")
    if not changed:
        return 0
    cj.open_pr(f"auto/thin-{today.isoformat()}", f"얇은 페이지 보강 (레시피·계산기 질문 {len(notes)}쪽)",
               "애드센스 재신청 준비: 1,000~1,900자이던 레시피·계산기 질문 페이지에 실수·보관·자주 묻는 질문을 더했어요(주소 그대로, 원가·가정 값 그대로).\n\n"
               + "\n".join(notes) + f"\n\n비용 ${cj.spent(today, 'thin')}", changed)
    return 0


# ---------- 5. 5락실 밸런스 질문 ----------
RQ = obj({"days": arr(obj({"date": S, "items": arr(obj({"a": S, "b": S, "note": S}))}))})
RQ_PICK = obj({"days": arr(obj({"date": S, "picks": arr(obj({"i": I, "score": I, "why": S}))}))})
RAKSIL_FROM, RAKSIL_TO, PER_DAY, CANDS = dt.date(2026, 12, 12), dt.date(2026, 12, 31), 3, 5


def raksilq(today: dt.date | None = None) -> int:
    from . import raksil_shorts as RS
    from .copy_rules import SENTENCE_RULE
    today = today or cj.today_kst()
    path = "playground/data/questions.json"
    qs = cj.jload(path)
    have = {q["date"] for q in qs}
    days = [RAKSIL_FROM + dt.timedelta(days=i) for i in range((RAKSIL_TO - RAKSIL_FROM).days + 1)]
    days = [d for d in days if d.isoformat() not in have]
    if not days:
        print("이미 다 있음")
        return 0
    sample = [{"a": q["a"], "b": q["b"], "note": q.get("note", "")} for q in qs[-15:]]
    used = [f"{q['a']} / {q['b']}" for q in qs]
    sys_w = (RS.REPLAN_SYS.split("몽글이(")[0] + "\n" + SENTENCE_RULE + "\n이번 일: 5락실 사이트·쇼츠의 '오늘의 밸런스게임' 질문을 날짜마다 "
             f"{CANDS}개씩 낸다. 형식은 아래 예시처럼 a·b 에 상황이 들어간 선택지(각 공백 포함 8~22자, a+b 합 44자 이하), note 는 무엇으로 갈리는지 한 "
             "문장(~요). 12월 말 연말·크리스마스·송년회·방학·추위 같은 그 시기 장면을 섞되 같은 소재를 이틀 연속 쓰지 않는다. 게임 이름·흔한 음식 논쟁 금지.\n"
             "예시: " + json.dumps(sample, ensure_ascii=False))
    blocks = [days[i:i + 5] for i in range(0, len(days), 5)]
    first = ask_many("raksilq", [Req(f"b{n}", sys_w, json.dumps({"dates": [d.isoformat() for d in b], "이미 쓴 질문(겹치지 않게)": used},
                                                                 ensure_ascii=False), RQ) for n, b in enumerate(blocks)], need_each=0.3)
    judge_sys = (sys_w.split("이번 일:")[0] + "\n너는 5락실 편집장이다. 날짜마다 후보를 채점(1~10: 진짜 고민됨·장면이 떠오름·처음 보는 사람도 바로 이해·"
                 f"친구에게 묻고 싶음)하고 가장 좋은 {PER_DAY}개의 번호(i, 0부터)를 고른다. 같은 날 세 질문은 소재가 서로 달라야 한다.")
    second = ask_many("raksilq", [Req(k, judge_sys, json.dumps(v, ensure_ascii=False), RQ_PICK, effort="medium") for k, v in first.items()],
                      need_each=0.1)
    added, notes = [], []
    for k, v in first.items():
        picks = {p["date"]: p["picks"] for p in second.get(k, {}).get("days", [])}
        for day in v["days"]:
            if day["date"] in have or day["date"] not in {d.isoformat() for d in days}:
                continue
            order = [p["i"] for p in sorted(picks.get(day["date"], []), key=lambda p: -p["score"])]
            order += [i for i in range(len(day["items"])) if i not in order]
            n = 0
            for i in order:
                if n >= PER_DAY or i >= len(day["items"]):
                    continue
                it = day["items"][i]
                a, b = " ".join(it["a"].split()), " ".join(it["b"].split())
                q = {"a": a, "b": b}
                if not a or not b or a == b or sum(RS.shorts_penalty(q)) or f"{a} / {b}" in used:
                    continue
                n += 1
                added.append({"id": f"{day['date'].replace('-', '')}-{n}", "date": day["date"], "a": a, "b": b, "note": it["note"].strip()})
                used.append(f"{a} / {b}")
            if n:
                have.add(day["date"])
                notes.append(f"- {day['date']}: " + " · ".join(f"{x['a']} vs {x['b']}" for x in added[-n:]))
    if not added:
        return 0
    added.sort(key=lambda x: x["id"])
    jdump(path, qs + added)
    cj.open_pr(f"auto/raksilq-{today.isoformat()}", f"5락실 밸런스 질문 {added[0]['date']}~{added[-1]['date']} ({len(added)}개)",
               f"남은 크레딧으로 미리 만든 질문이에요(날짜마다 후보 {CANDS}개 → 편집장 채점 → {PER_DAY}개). 사이트는 그날이 돼야 보이고, 쇼츠는 그날 질문에서 골라요.\n\n"
               + "\n".join(notes) + f"\n\n비용 ${cj.spent(today, 'raksilq')}", [path])
    return 0


def toon(arg: str | None = None) -> int:
    if not arg:
        print("toon 은 날짜(YYYY-MM-DD)가 필요해요")
        return 2
    return cj.toon(target=dt.date.fromisoformat(arg))


JOBS = {"boost": boost, "drafts": drafts, "review": review, "thin": thin, "raksilq": raksilq}


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in {*JOBS, "toon"}:
        print("작업: " + ", ".join([*JOBS, "toon"]))
        return 2
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY 없음 → 건너뜀")
        return 0
    try:
        return toon(argv[1] if len(argv) > 1 else None) if argv[0] == "toon" else JOBS[argv[0]]()
    except cj.BudgetError as e:
        print(e)
        return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
