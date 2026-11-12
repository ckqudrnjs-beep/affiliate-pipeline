"""밸런스게임 놀이터 정적 사이트 생성기.

실행(playground 폴더에서): python build.py dist
Cloudflare Pages: 루트 디렉터리 playground, 빌드 명령 `python build.py dist`, 출력 dist.
"""
from __future__ import annotations

import html
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
KST = timezone(timedelta(hours=9))
QID = re.compile(r"^\d{8}-\d$")
# 자동 생성 질문 금지어: 갈등·혐오·정치·성적·참사·실존 인물 비하를 막는 최소한의 안전장치.
BANNED = ("정치", "대통령", "국회", "정당", "남자는", "여자는", "남녀", "페미", "지역감정", "전라도", "경상도", "종교", "교회", "절에", "섹스", "야한", "자살",
          "참사", "사망", "죽", "살인", "혐오", "장애", "흑인", "백인", "조선족", "외국인 노동자")
EMOJI = [("r1", "😂"), ("r2", "🤔"), ("r3", "😱"), ("r4", "👍")]


def esc(s: str) -> str:
    return html.escape(str(s), quote=True)


def today() -> date:
    return datetime.now(KST).date()


def validate_question(q: dict) -> list[str]:
    e = []
    if not QID.match(q.get("id", "")):
        e.append("id 형식")
    for k in ("a", "b", "note", "date"):
        if not q.get(k):
            e.append(f"{k} 없음")
    if e:
        return e
    if q["id"][:8] != q["date"].replace("-", ""):
        e.append("id 날짜와 date 불일치")
    if not (2 <= len(q["a"]) <= 40 and 2 <= len(q["b"]) <= 40):
        e.append("선택지 길이 2~40자")
    text = q["a"] + q["b"] + q["note"]
    bad = [w for w in BANNED if w in text]
    if bad:
        e.append("금지어: " + ",".join(bad))
    return e


def load_questions(cfg: dict, upto: date | None = None) -> list[dict]:
    qs = json.loads((HERE / "data" / "questions.json").read_text(encoding="utf-8"))
    seen_ids, seen_pairs = set(), set()
    per_day: dict[str, int] = {}
    for q in qs:
        errs = validate_question(q)
        if errs:
            raise ValueError(f"{q.get('id')}: {', '.join(errs)}")
        pair = frozenset((re.sub(r"\s", "", q["a"]), re.sub(r"\s", "", q["b"])))
        if q["id"] in seen_ids or pair in seen_pairs:
            raise ValueError(f"{q['id']}: 중복 질문")
        seen_ids.add(q["id"]); seen_pairs.add(pair)
        per_day[q["date"]] = per_day.get(q["date"], 0) + 1
        if per_day[q["date"]] > cfg["questionsPerDay"]:
            raise ValueError(f"{q['date']}: 하루 질문 상한 초과")
    upto = upto or today()
    return sorted([q for q in qs if date.fromisoformat(q["date"]) <= upto], key=lambda q: q["id"], reverse=True)


CSS = """
:root{--bg:#fff8f0;--card:#fff;--ink:#22201c;--muted:#6f6a62;--line:#efe4d6;--a:#ff5a5f;--b:#2f80ed;--soft:#fff0e0;--btn:#22201c;--btn-ink:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#17150f;--card:#221f19;--ink:#f3eee6;--muted:#a9a296;--line:#3a352c;--a:#ff7a7e;--b:#5aa0ff;--soft:#2c271e;--btn:#f3eee6;--btn-ink:#17150f}}
*{box-sizing:border-box}body{margin:0;word-break:keep-all;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif}
a{color:inherit}.wrap{max-width:720px;margin:0 auto;padding:0 16px}
header{border-bottom:1px solid var(--line);background:var(--card)}header .wrap{display:flex;align-items:center;justify-content:space-between;height:56px}
.logo{font-weight:900;font-size:22px;text-decoration:none;letter-spacing:-1px}.logo span{color:var(--a)}
nav a{text-decoration:none;color:var(--muted);font-size:14px;margin-left:12px}
h1{font-size:26px;line-height:1.3;margin:24px 0 6px;letter-spacing:-.5px}h2{font-size:19px;margin:30px 0 10px}.lead{color:var(--muted);margin:0 0 16px}
.q{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin:14px 0}
.q .no{font-size:13px;color:var(--muted)}.vs{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:stretch;margin:10px 0}
.vs button{font:inherit;font-weight:800;border:2px solid var(--line);background:var(--card);color:var(--ink);border-radius:14px;padding:16px 10px;cursor:pointer;min-height:84px;position:relative;overflow:hidden}
.vs button.a:hover,.vs button.a.mine{border-color:var(--a)}.vs button.b:hover,.vs button.b.mine{border-color:var(--b)}
.vs .x{align-self:center;font-weight:900;color:var(--muted)}
.bar{display:none;height:10px;border-radius:6px;background:var(--b);overflow:hidden;margin-top:6px}.bar i{display:block;height:100%;background:var(--a)}
.done .bar{display:block}.pct{display:none;justify-content:space-between;font-weight:800;font-size:15px;margin-top:4px}.done .pct{display:flex}.pct .pa{color:var(--a)}.pct .pb{color:var(--b)}
.note{color:var(--muted);font-size:14px;margin:8px 0 0}.re{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.re button,.share{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--soft);color:var(--ink);border-radius:999px;padding:5px 11px;cursor:pointer}
.big{font:inherit;font-weight:800;border:0;border-radius:12px;padding:12px 18px;background:var(--btn);color:var(--btn-ink);cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.grid a{display:block;text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.grid a b{display:block;font-size:17px}.grid a small{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;margin:14px 0}
input.ans{font:inherit;font-size:18px;width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
.cho{font-size:40px;font-weight:900;letter-spacing:8px;text-align:center;margin:10px 0}.muted{color:var(--muted)}
.pad{height:220px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;cursor:pointer;user-select:none;background:var(--soft)}
footer{margin-top:48px;padding:22px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}footer a{margin-right:12px}
ul.list{padding-left:18px}ul.list li{margin:4px 0}
"""

VOTE_JS = """
const API='/api/vote';const KEY='bn_votes';let mine={};try{mine=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(mine))}catch(e){}}
function paint(el,c){const a=c.a||0,b=c.b||0,t=a+b;const pa=t?Math.round(a/t*100):50;el.classList.add('done');el.querySelector('.bar i').style.width=pa+'%';
el.querySelector('.pa').textContent=pa+'% ('+a+')';el.querySelector('.pb').textContent=(100-pa)+'% ('+b+')';
el.querySelectorAll('.re button[data-r]').forEach(x=>{x.querySelector('span').textContent=c[x.dataset.r]||''});
const m=mine[el.dataset.q];if(m)el.querySelector('.'+m).classList.add('mine')}
async function load(){const els=[...document.querySelectorAll('.q[data-q]')];if(!els.length)return;
let data={};try{data=await (await fetch(API+'?ids='+els.map(e=>e.dataset.q).join(','))).json()}catch(e){}
els.forEach(el=>{const c=data[el.dataset.q]||{};if(mine[el.dataset.q])paint(el,c);else el.querySelectorAll('.re button[data-r]').forEach(x=>{x.querySelector('span').textContent=c[x.dataset.r]||''});el._c=c})}
async function send(qid,opt){try{await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({qid,opt})})}catch(e){}}
document.addEventListener('click',e=>{const btn=e.target.closest('.vs button');if(btn){const el=btn.closest('.q'),q=el.dataset.q;if(mine[q])return;const opt=btn.classList.contains('a')?'a':'b';
mine[q]=opt;save();const c=Object.assign({a:0,b:0},el._c||{});c[opt]++;paint(el,c);send(q,opt);return}
const r=e.target.closest('.re button[data-r]');if(r){const el=r.closest('.q'),k=el.dataset.q+':'+r.dataset.r;if(mine[k])return;mine[k]=1;save();const s=r.querySelector('span');s.textContent=(+s.textContent||0)+1;send(el.dataset.q,r.dataset.r);return}
const sh=e.target.closest('.share');if(sh){const url=location.origin+sh.dataset.url;const t=sh.dataset.t;if(navigator.share)navigator.share({title:t,url}).catch(()=>{});else{navigator.clipboard&&navigator.clipboard.writeText(url);sh.textContent='링크 복사됨'}}});
load();
"""


def page(cfg, *, path, title, desc, body, script="", noindex=False):
    url = cfg["baseUrl"].rstrip("/") + "/" + path
    head = ""
    pub = cfg.get("adsensePublisherId", "").strip()
    if pub:
        head += (f'<meta name="google-adsense-account" content="ca-{pub}"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-{pub}" crossorigin="anonymous"></script>')
    for tag in cfg.get("naverSiteVerification", []):
        head += f'<meta name="naver-site-verification" content="{esc(tag)}">'
    if cfg.get("googleSiteVerification"):
        head += f'<meta name="google-site-verification" content="{esc(cfg["googleSiteVerification"])}">'
    if noindex:
        head += '<meta name="robots" content="noindex,follow">'
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{esc(url)}">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{esc(url)}"><meta property="og:site_name" content="{esc(cfg['siteName'])}"><meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>{CSS}</style>{head}</head><body>
<header><div class="wrap"><a class="logo" href="/">밸<span>놀</span></a><nav><a href="/archive">지난 질문</a><a href="/games">게임</a></nav></div></header>
<main class="wrap">{body}</main>
<footer><div class="wrap"><a href="/about">소개</a><a href="/contact">문의</a><a href="/privacy">개인정보처리방침</a><p>투표는 익명입니다. 이름·로그인 없이 참여하며, 개인을 알아볼 수 있는 정보는 저장하지 않습니다.</p></div></footer>
<script>{script}</script></body></html>"""


def qcard(q, n=None, link=True):
    num = f'<div class="no">{esc(n)}</div>' if n else ""
    title = f'{q["a"]} vs {q["b"]}'
    re_btns = "".join(f'<button type="button" data-r="{k}">{e} <span></span></button>' for k, e in EMOJI)
    more = f' · <a href="/q/{q["id"]}">결과 자세히</a>' if link else ""
    return f"""<div class="q" data-q="{q['id']}">{num}<div class="vs"><button class="a" type="button">{esc(q['a'])}</button><span class="x">VS</span><button class="b" type="button">{esc(q['b'])}</button></div>
<div class="bar"><i></i></div><div class="pct"><span class="pa"></span><span class="pb"></span></div>
<p class="note">{esc(q['note'])}{more}</p><div class="re">{re_btns}<button class="share" type="button" data-url="/q/{q['id']}" data-t="{esc(title)}">공유</button></div></div>"""


def build(out: Path, upto: date | None = None) -> dict:
    cfg = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    qs = load_questions(cfg, upto)
    if not qs:
        raise ValueError("공개할 질문 없음")
    out.mkdir(parents=True, exist_ok=True)
    (out / "q").mkdir(exist_ok=True)
    (out / "games").mkdir(exist_ok=True)
    latest = qs[0]["date"]
    todays = sorted([q for q in qs if q["date"] == latest], key=lambda q: q["id"])
    d = date.fromisoformat(latest)
    pages = []

    def write(path, title, desc, body, script="", noindex=False):
        (out / f"{path or 'index'}.html").write_text(page(cfg, path=path, title=title, desc=desc, body=body, script=script, noindex=noindex), encoding="utf-8")
        if not noindex:
            pages.append(path)

    cards = "".join(qcard(q, f"오늘의 질문 {i + 1}") for i, q in enumerate(todays))
    games = """<div class="grid"><a href="/games/chosung"><b>오늘의 초성 퀴즈</b><small>하루 5문제, 맞힌 개수 공유</small></a>
<a href="/games/majority"><b>다수결 맞히기</b><small>사람들이 더 많이 고른 쪽은?</small></a><a href="/games/reaction"><b>반응속도 측정</b><small>나는 몇 ms?</small></a></div>"""
    write("", f"{cfg['siteName']} | 오늘의 밸런스게임", cfg["description"],
          f"<h1>오늘의 밸런스게임</h1><p class=\"lead\">{d.month}월 {d.day}일 · 하나만 고르세요. 고르면 다른 사람들의 선택이 보여요.</p>{cards}<h2>놀거리</h2>{games}"
          f"<h2>어제까지의 질문</h2><p><a href=\"/archive\">지난 질문 전체 보기 →</a></p>", VOTE_JS)

    for q in qs:
        title = f"{q['a']} vs {q['b']} | 밸런스게임"
        desc = f"밸런스게임: {q['a']} vs {q['b']}. 투표하고 사람들의 선택 비율을 확인하세요. {q['note']}"[:150]
        others = "".join(f'<li><a href="/q/{x["id"]}">{esc(x["a"])} vs {esc(x["b"])}</a></li>' for x in qs if x["id"] != q["id"])
        others = "<ul class=\"list\">" + "".join(others.split("</li>")[:6]) + "</ul>" if others else ""
        write(f"q/{q['id']}", title, desc,
              f"<h1>{esc(q['a'])} vs {esc(q['b'])}</h1><p class=\"lead\">{q['date']} 밸런스게임</p>{qcard(q, link=False)}<h2>다른 질문</h2>{others}", VOTE_JS)

    rows = "".join(f'<li>{q["date"][5:].replace("-", "/")} · <a href="/q/{q["id"]}">{esc(q["a"])} vs {esc(q["b"])}</a></li>' for q in qs)
    write("archive", f"지난 밸런스게임 질문 모음 | {cfg['siteName']}", "지금까지 올라온 밸런스게임 질문 전체. 지금 투표해도 결과에 반영됩니다.",
          f"<h1>지난 질문</h1><p class=\"lead\">지금 투표해도 결과에 반영돼요. 총 {len(qs)}개.</p><ul class=\"list\">{rows}</ul>")

    write("games", f"미니게임 | {cfg['siteName']}", "오늘의 초성 퀴즈, 다수결 맞히기, 반응속도 측정. 가입 없이 바로 하는 무료 미니게임.",
          f"<h1>미니게임</h1><p class=\"lead\">가입 없이 바로. 결과는 친구에게 공유해 보세요.</p>{games}")

    words = json.loads((HERE / "data" / "chosung_words.json").read_text(encoding="utf-8"))
    write("games/chosung", f"오늘의 초성 퀴즈 - 하루 5문제 | {cfg['siteName']}",
          "매일 바뀌는 초성 퀴즈 5문제. 음식, 동물, 직업, 장소 등 주제 힌트를 보고 초성만으로 단어를 맞혀 보세요. 맞힌 개수를 이모지로 공유할 수 있어요.",
          CHOSUNG_BODY, "const WORDS=" + json.dumps(words, ensure_ascii=False) + ";" + CHOSUNG_JS)
    write("games/reaction", f"반응속도 측정 - 나는 몇 ms? | {cfg['siteName']}",
          "화면이 초록색으로 바뀌는 순간 누르세요. 5번 평균 반응속도(ms)를 재고 친구와 비교해 보세요. 평균적인 사람의 시각 반응속도는 200~300ms 정도입니다.",
          REACTION_BODY, REACTION_JS)
    pool = [q for q in qs if q["date"] < latest][:30]
    write("games/majority", f"다수결 맞히기 - 사람들은 뭘 골랐을까? | {cfg['siteName']}",
          "지난 밸런스게임에서 더 많은 사람이 고른 쪽을 맞혀 보세요. 실제 투표 결과로 채점합니다. 10문제 중 몇 개나 맞힐 수 있을까요?",
          MAJORITY_BODY, "const POOL=" + json.dumps([{"id": q["id"], "a": q["a"], "b": q["b"]} for q in pool], ensure_ascii=False) + ";" + MAJORITY_JS)

    email = cfg["contactEmail"]
    write("about", f"소개 | {cfg['siteName']}", f"{cfg['siteName']} 소개",
          f"<h1>소개</h1><p>{esc(cfg['siteName'])}(밸런스 놀이터)은 매일 새로운 밸런스게임 질문을 올리고, 누구나 익명으로 투표해 서로의 선택을 비교해 보는 놀이터입니다.</p>"
          "<p>질문은 갈등을 부추기지 않는 가벼운 일상 주제로만 고릅니다. 정치·성별·지역·종교 갈등이나 실존 인물을 깎아내리는 질문은 올리지 않습니다.</p>"
          "<p>투표 비율은 실제로 눌린 숫자 그대로 보여 줍니다. 같은 사람이 같은 질문에 여러 번 투표하지 못하도록 하루 단위로 막고 있습니다.</p>"
          "<p>미니게임(초성 퀴즈, 다수결 맞히기, 반응속도)은 모두 이 사이트에서 직접 만든 게임입니다.</p>")
    write("contact", f"문의 | {cfg['siteName']}", f"{cfg['siteName']} 문의",
          f"<h1>문의</h1><p>질문 제안, 오류 제보, 광고 문의는 메일로 보내 주세요.</p><p><a href=\"mailto:{esc(email)}\">{esc(email)}</a></p>")
    write("privacy", f"개인정보처리방침 | {cfg['siteName']}", f"{cfg['siteName']} 개인정보처리방침",
          f"<h1>개인정보처리방침</h1><p>시행일: {cfg['privacyDate']}</p><h2>1. 수집하는 정보</h2><p>회원 가입이 없고 이름·연락처를 받지 않습니다. 투표와 반응 버튼을 누르면 '어떤 질문에 어느 쪽을 골랐는지'만 숫자로 집계합니다.</p>"
          "<h2>2. 중복 투표 방지</h2><p>같은 사람의 중복 투표를 막기 위해 접속 IP 주소를 비밀값과 함께 되돌릴 수 없는 해시값으로 바꿔 최대 2일 동안 보관한 뒤 자동 삭제합니다. 원래 IP 주소는 저장하지 않습니다. 이용자의 브라우저에는 이미 투표한 질문 목록이 저장됩니다(브라우저에서 언제든 삭제 가능).</p>"
          "<h2>3. 광고와 쿠키</h2><p>이 사이트는 Google 애드센스 등 제3자 광고를 게재할 수 있습니다. Google을 포함한 제3자 공급업체는 쿠키를 사용하여 이용자의 이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 게재합니다. "
          "맞춤 광고는 <a href=\"https://adssettings.google.com\" rel=\"nofollow\">Google 광고 설정</a>에서 끌 수 있고, <a href=\"https://www.aboutads.info\" rel=\"nofollow\">aboutads.info</a>에서 제3자 쿠키 사용을 거부할 수 있습니다.</p>"
          f"<h2>4. 문의</h2><p><a href=\"mailto:{esc(email)}\">{esc(email)}</a></p>")

    base = cfg["baseUrl"].rstrip("/")
    sm = "".join(f"<url><loc>{base}/{p}</loc></url>" for p in pages)
    (out / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>', encoding="utf-8")
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
    (out / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#22201c"/><rect x="5" y="9" width="10" height="14" rx="3" fill="#ff5a5f"/><rect x="17" y="9" width="10" height="14" rx="3" fill="#2f80ed"/></svg>', encoding="utf-8")
    if pub := cfg.get("adsensePublisherId", "").strip():
        (out / "ads.txt").write_text(f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    return {"questions": len(qs), "today": latest, "pages": len(pages)}


CHOSUNG_BODY = """<h1>오늘의 초성 퀴즈</h1><p class="lead" id="day"></p>
<div class="card"><div class="muted" id="prog"></div><div class="muted" id="hint"></div><div class="cho" id="cho"></div>
<input class="ans" id="ans" placeholder="정답 입력 후 Enter" autocomplete="off"><div style="display:flex;gap:8px;margin-top:10px"><button class="big" id="ok" type="button">확인</button><button class="share" id="skip" type="button">모르겠어요</button></div>
<p id="msg"></p></div><div class="card" id="end" hidden><h2 style="margin-top:0">오늘의 결과</h2><p id="res" style="font-size:28px"></p><button class="big" id="sh" type="button">결과 공유</button><p class="muted">내일 0시(한국 시간)에 새 문제가 나와요.</p></div>
<h2>규칙</h2><ul class="list"><li>하루 5문제가 나오고, 모든 사람에게 같은 문제가 나옵니다.</li><li>주제 힌트와 초성(첫 자음)을 보고 단어를 맞힙니다. 띄어쓰기는 무시합니다.</li><li>문제마다 기회는 한 번입니다. 모르면 넘어가도 돼요.</li><li>결과는 🟩(정답) 🟥(오답) 이모지로 공유됩니다. 정답은 공유되지 않아요.</li></ul>
<h2>초성 퀴즈 잘 푸는 법</h2><p>먼저 주제 힌트에서 떠오르는 단어를 글자 수에 맞춰 떠올려 보세요. 초성이 'ㄱㅊ'처럼 짧으면 받침 없는 두 글자 단어부터, 'ㄴㅇㄱㅇ'처럼 길면 장소·복합어를 먼저 생각하면 빨라집니다. 쌍자음(ㄲ, ㄸ)이 보이면 후보가 크게 줄어듭니다.</p>"""

CHOSUNG_JS = """
const CH='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';const cho=w=>[...w].map(c=>{const k=c.charCodeAt(0)-44032;return k>=0&&k<11172?CH[Math.floor(k/588)]:c}).join('');
const now=new Date(Date.now()+9*3600e3);const key=now.toISOString().slice(0,10);let seed=+key.replace(/-/g,'');
const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const cats=Object.keys(WORDS);const set=[];const used=new Set();while(set.length<5){const c=cats[Math.floor(rnd()*cats.length)];const w=WORDS[c][Math.floor(rnd()*WORDS[c].length)];if(!used.has(w)){used.add(w);set.push([c,w])}}
const $=id=>document.getElementById(id);$('day').textContent=key.slice(5).replace('-','월 ')+'일 문제 · 모두 같은 문제를 풀어요';
let i=0,res=[];const SK='bn_cho_'+key;try{const s=JSON.parse(localStorage.getItem(SK)||'null');if(s){res=s;i=5}}catch(e){}
function show(){if(i>=5){finish();return}$('prog').textContent=(i+1)+' / 5';$('hint').textContent='주제: '+set[i][0];$('cho').textContent=cho(set[i][1]);$('ans').value='';$('ans').focus()}
function answer(skip){const v=$('ans').value.replace(/\\s/g,'');const ok=!skip&&v===set[i][1];res.push(ok?1:0);$('msg').textContent=(ok?'정답! ':'아쉬워요. ')+'정답은 '+set[i][1];i++;try{if(i>=5)localStorage.setItem(SK,JSON.stringify(res))}catch(e){};show()}
function finish(){$('end').hidden=false;document.querySelector('.card').hidden=true;$('res').textContent=res.map(x=>x?'🟩':'🟥').join('')+' '+res.reduce((a,b)=>a+b,0)+'/5'}
$('ok').onclick=()=>answer(false);$('skip').onclick=()=>answer(true);$('ans').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)answer(false)};
$('sh').onclick=()=>{const t='밸놀 초성 퀴즈 '+key.slice(5)+'\\n'+$('res').textContent+'\\n'+location.href;if(navigator.share)navigator.share({text:t}).catch(()=>{});else{navigator.clipboard&&navigator.clipboard.writeText(t);$('sh').textContent='복사됨'}};show();
"""

REACTION_BODY = """<h1>반응속도 측정</h1><p class="lead">빨간 화면이 초록색으로 바뀌는 순간 누르세요. 5번 재서 평균을 냅니다.</p>
<div class="pad" id="pad">눌러서 시작</div><p id="log" class="muted"></p><button class="big" id="sh" type="button" hidden>결과 공유</button>
<h2>반응속도란?</h2><p>눈으로 신호를 보고 손가락이 움직이기까지 걸리는 시간입니다. 사람의 평균적인 시각 반응속도는 대략 200~300ms(0.2~0.3초)이고, 화면과 기기에 따라 수십 ms 차이가 날 수 있습니다.</p>
<h2>규칙</h2><ul class="list"><li>초록색이 되기 전에 누르면 '너무 빨라요'로 그 회차는 다시 합니다.</li><li>5회 평균과 최고 기록을 보여 줍니다.</li><li>기록은 이 기기에만 저장되고 서버로 보내지 않습니다.</li></ul>
<h2>기록을 올리는 팁</h2><p>화면 가운데를 보고 손가락을 미리 화면 가까이 두세요. 모니터 주사율이 높을수록(120Hz 이상) 기록이 조금 좋게 나옵니다. 피곤하거나 카페인을 먹은 직후에는 기록이 흔들릴 수 있어요.</p>"""

REACTION_JS = """
const pad=document.getElementById('pad'),log=document.getElementById('log'),sh=document.getElementById('sh');let st='idle',t0=0,tm=0,rs=[];
const set=(bg,txt)=>{pad.style.background=bg;pad.style.color=bg?'#fff':'';pad.textContent=txt};
function arm(){st='wait';set('#e5484d','초록색이 되면 누르세요…');tm=setTimeout(()=>{st='go';t0=performance.now();set('#30a46c','지금!')},1200+Math.random()*2500)}
pad.onpointerdown=()=>{if(st==='idle'||st==='done'){if(st==='done')rs=[];arm();return}
if(st==='wait'){clearTimeout(tm);st='idle';set('','너무 빨라요! 다시 누르세요');return}
if(st==='go'){const ms=Math.round(performance.now()-t0);rs.push(ms);log.textContent=rs.map((x,i)=>(i+1)+'회 '+x+'ms').join(' · ');
if(rs.length>=5){const avg=Math.round(rs.reduce((a,b)=>a+b)/5);st='done';set('','평균 '+avg+'ms · 최고 '+Math.min(...rs)+'ms (다시 하려면 누르기)');sh.hidden=false;sh.dataset.r=avg}else{st='idle';set('',ms+'ms! 눌러서 다음')}}};
sh.onclick=()=>{const t='밸놀 반응속도 평균 '+sh.dataset.r+'ms, 너는 몇 ms?\\n'+location.href;if(navigator.share)navigator.share({text:t}).catch(()=>{});else{navigator.clipboard&&navigator.clipboard.writeText(t);sh.textContent='복사됨'}};
"""

MAJORITY_BODY = """<h1>다수결 맞히기</h1><p class="lead">지난 밸런스게임에서 사람들이 더 많이 고른 쪽을 맞혀 보세요.</p>
<div class="card" id="box"><div class="muted" id="prog"></div><div class="vs" style="margin-top:10px"><button class="a" type="button" id="ba"></button><span class="x">VS</span><button class="b" type="button" id="bb"></button></div><p id="msg"></p></div>
<div class="card" id="end" hidden><h2 style="margin-top:0">결과</h2><p id="res" style="font-size:26px"></p><button class="big" id="sh" type="button">결과 공유</button></div>
<h2>규칙</h2><ul class="list"><li>투표가 20표 이상 모인 지난 질문 중에서 최대 10문제가 나옵니다.</li><li>내 취향이 아니라 '사람들이 더 많이 고른 쪽'을 고르세요.</li><li>채점은 실제 투표 비율로 합니다. 비율이 50:50이면 둘 다 정답이에요.</li></ul>
<h2>잘 맞히는 법</h2><p>밸런스게임 결과는 '무난한 쪽'이 이기는 경우가 많습니다. 극단적인 선택지보다는 일상에서 덜 불편한 쪽, 그리고 질문을 보는 사람들의 나이대를 떠올려 보세요.</p>"""

MAJORITY_JS = """
const $=id=>document.getElementById(id);let qs=[],i=0,score=0;
async function init(){let c={};try{c=await (await fetch('/api/vote?ids='+POOL.map(q=>q.id).join(','))).json()}catch(e){}
qs=POOL.filter(q=>c[q.id]&&(c[q.id].a+c[q.id].b)>=20).map(q=>Object.assign({},q,c[q.id])).slice(0,10);
if(!qs.length){$('prog').textContent='아직 표가 충분히 모인 질문이 없어요. 오늘의 질문에 먼저 투표해 주세요!';$('ba').parentNode.hidden=true;return}show()}
function show(){if(i>=qs.length){$('box').hidden=true;$('end').hidden=false;$('res').textContent=score+' / '+qs.length+' 정답';return}const q=qs[i];$('prog').textContent=(i+1)+' / '+qs.length;$('ba').textContent=q.a;$('bb').textContent=q.b}
function pick(o){const q=qs[i],t=q.a+q.b,pa=Math.round(q.a/t*100);const win=q.a===q.b?o:(q.a>q.b?'a':'b');const ok=o===win;if(ok)score++;
$('msg').textContent=(ok?'정답! ':'땡! ')+'('+pa+'% : '+(100-pa)+'%)';i++;setTimeout(show,900)}
$('ba').onclick=()=>pick('a');$('bb').onclick=()=>pick('b');
$('sh').onclick=()=>{const t='밸놀 다수결 맞히기 '+$('res').textContent+'\\n'+location.href;if(navigator.share)navigator.share({text:t}).catch(()=>{});else{navigator.clipboard&&navigator.clipboard.writeText(t);$('sh').textContent='복사됨'}};init();
"""


if __name__ == "__main__":
    r = build(Path(sys.argv[1] if len(sys.argv) > 1 else "dist"))
    print(f"놀이터: 질문 {r['questions']}개, 오늘 {r['today']}, 페이지 {r['pages']}개")
