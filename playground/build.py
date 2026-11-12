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
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.grid a{display:block;text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.grid a b{display:block;font-size:17px}.grid a small{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;margin:14px 0}
input.ans{font:inherit;font-size:18px;width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
.cho{font-size:40px;font-weight:900;letter-spacing:8px;text-align:center;margin:10px 0}.muted{color:var(--muted)}
.pad{height:220px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;cursor:pointer;user-select:none;background:var(--soft)}
.hero{background:linear-gradient(135deg,#2b1055,#7597de);color:#fff;border-radius:22px;padding:26px 20px;margin:18px 0}.hero h1{margin:0 0 6px;color:#fff;font-size:30px}.hero p{margin:0;opacity:.9}
.spot{display:grid;grid-template-columns:1fr;gap:10px;margin:10px 0}@media(min-width:700px){.spot{grid-template-columns:1fr 1fr}}
.ic{font-size:28px;display:block}.grid a b{margin-top:4px}h2 small{font-size:14px;font-weight:400}
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


def load_games() -> list[dict]:
    games = []
    for d in sorted((HERE / "games").iterdir()):
        if not (d / "meta.json").exists():
            continue
        g = json.loads((d / "meta.json").read_text(encoding="utf-8"))
        g["slug"] = d.name
        g["body"] = (d / "body.html").read_text(encoding="utf-8")
        g["js"] = (d / "game.js").read_text(encoding="utf-8")
        for k in ("name", "short", "title", "description"):
            if not g.get(k):
                raise ValueError(f"{d.name}: {k} 없음")
        if len(re.sub(r"<[^>]+>", "", g["body"])) < 300:
            raise ValueError(f"{d.name}: 규칙·설명 글 300자 미만")
        if re.search(r"https?://", g["js"]):
            raise ValueError(f"{d.name}: 외부 주소 금지")
        games.append(g)
    return sorted(games, key=lambda g: (g.get("order", 99), g["slug"]))


def game_grid(games: list[dict]) -> str:
    cards = "".join(f'<a href="/games/{g["slug"]}"><span class="ic">{g.get("icon", "🎮")}</span><b>{esc(g["name"])}{" 🏆" if g.get("ranked") else ""}</b><small>{esc(g["short"])}</small></a>' for g in games)
    return f'<div class="grid">{cards}</div>'


# 자동 별명: 자유 입력이 없어서 욕설 관리가 필요 없다. functions/api/score.js 와 같은 목록.
ADJ = ["빠른", "느긋한", "용감한", "졸린", "배고픈", "신난", "수줍은", "똑똑한", "엉뚱한", "반짝이는", "조용한", "씩씩한", "날쌘", "포근한", "명랑한", "꼼꼼한"]
ANI = ["수달", "고양이", "강아지", "판다", "펭귄", "다람쥐", "여우", "너구리", "부엉이", "고래", "토끼", "햄스터", "거북이", "사슴", "오리", "곰"]

COMMON_JS = (
    "const KST=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);"
    "function seeded(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19}"
    "return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296}}"
    "function shareText(t){if(navigator.share)navigator.share({text:t}).catch(()=>{});else if(navigator.clipboard){navigator.clipboard.writeText(t);alert('결과를 복사했어요. 친구에게 붙여 넣어 보세요!')}}"
    f"const ADJ={json.dumps(ADJ, ensure_ascii=False)},ANI={json.dumps(ANI, ensure_ascii=False)};"
    "function myNick(){let n=null;try{n=localStorage.getItem('nr_nick')}catch(e){}if(!n||!/^\\S+ \\S+ \\d{1,2}$/.test(n)){n=ADJ[Math.floor(Math.random()*ADJ.length)]+' '+ANI[Math.floor(Math.random()*ANI.length)]+' '+Math.floor(Math.random()*100);try{localStorage.setItem('nr_nick',n)}catch(e){}}return n}"
)

RANK_HTML = """<div class="card" id="rankbox"><h2 style="margin-top:0">🏆 오늘의 도전 순위</h2><p class="muted">오늘은 모두 같은 판이에요. 내 별명: <b id="mynick"></b> <button class="share" type="button" id="renick">별명 바꾸기</button></p><ol id="rk" class="list"><li class="muted">불러오는 중…</li></ol><p><a href="/rank">전체 순위 보기 →</a></p></div>"""

RANK_JS = """
(function(){const G=location.pathname.split('/').pop();const $r=id=>document.getElementById(id);$r('mynick').textContent=myNick();
$r('renick').onclick=()=>{try{localStorage.removeItem('nr_nick')}catch(e){}$r('mynick').textContent=myNick()};
async function load(){try{const r=await (await fetch('/api/score?game='+G+'&day='+KST)).json();const me=myNick();
$r('rk').innerHTML=r.length?r.map(x=>'<li'+(x.nick===me?' style="font-weight:800"':'')+'>'+x.nick+' · '+x.score.toLocaleString()+'점</li>').join(''):'<li class="muted">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</li>'}catch(e){$r('rk').innerHTML='<li class="muted">순위를 불러오지 못했어요.</li>'}}
window.submitScore=async function(score){score=Math.floor(score);let best=0;try{best=+localStorage.getItem('nr_best_'+G+'_'+KST)||0}catch(e){}
if(score<=best){load();return}try{localStorage.setItem('nr_best_'+G+'_'+KST,score)}catch(e){}
try{await fetch('/api/score',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game:G,day:KST,score,nick:myNick()})})}catch(e){}load()};load()})();
"""

RANK_PAGE_JS = """
let cur=document.querySelector('[data-g]').dataset.g;const me=myNick();
async function show(g){cur=g;document.querySelectorAll('[data-g]').forEach(b=>b.style.fontWeight=b.dataset.g===g?'800':'400');
try{const r=await (await fetch('/api/score?game='+g+'&day='+KST)).json();document.getElementById('rk').innerHTML=r.length?r.map(x=>'<li'+(x.nick===me?' style="font-weight:800"':'')+'>'+x.nick+' · '+x.score.toLocaleString()+'점</li>').join(''):'<li class="muted">아직 기록이 없어요.</li>'}catch(e){}}
document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>show(b.dataset.g));show(cur);
"""


def crumbs(cfg: dict, trail: list[tuple[str, str]]) -> dict:
    base = cfg["baseUrl"].rstrip("/")
    items = [("홈", "")] + trail
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": f"{base}/{p}"} for i, (n, p) in enumerate(items)]}


def page(cfg, *, path, title, desc, body, script="", noindex=False, jsonld=None):
    url = cfg["baseUrl"].rstrip("/") + "/" + path
    head = ""
    pub = cfg.get("adsensePublisherId", "").strip()
    if pub:
        head += (f'<meta name="google-adsense-account" content="ca-{pub}"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-{pub}" crossorigin="anonymous"></script>')
    verify = ""  # 검색엔진 확인 태그는 <head> 맨 앞에 둔다(긴 CSS 뒤에 있으면 일부 봇이 못 읽음).
    for tag in cfg.get("naverSiteVerification", []):
        verify += f'<meta name="naver-site-verification" content="{esc(tag)}">'
    if cfg.get("googleSiteVerification"):
        verify += f'<meta name="google-site-verification" content="{esc(cfg["googleSiteVerification"])}">'
    if noindex:
        head += '<meta name="robots" content="noindex,follow">'
    for x in jsonld or []:
        head += '<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False).replace("</", "<\\/") + "</script>"
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">{verify}<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{esc(url)}">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{esc(url)}"><meta property="og:site_name" content="{esc(cfg['siteName'])}"><meta property="og:type" content="website"><meta property="og:image" content="{esc(cfg['baseUrl'].rstrip('/'))}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="ko_KR"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#2b1055">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="alternate" type="application/rss+xml" title="{esc(cfg['siteName'])}" href="/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>{CSS}</style>{head}</head><body>
<header><div class="wrap"><a class="logo" href="/"><span>5</span>락실</a><nav><a href="/games">게임</a><a href="/archive">밸런스게임</a><a href="/rank">순위</a></nav></div></header>
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

    def write(path, title, desc, body, script="", noindex=False, jsonld=None):
        (out / f"{path or 'index'}.html").write_text(page(cfg, path=path, title=title, desc=desc, body=body, script=script, noindex=noindex, jsonld=jsonld), encoding="utf-8")
        if not noindex:
            pages.append(path)

    cards = "".join(qcard(q, f"오늘의 질문 {i + 1}") for i, q in enumerate(todays))
    games = load_games()
    grid = game_grid(games)
    write("", f"{cfg['siteName']} | 오늘의 밸런스게임·틀린그림찾기·미니게임", cfg["description"],
          f"<div class=\"hero\"><h1>5락실</h1><p>{esc(cfg['tagline'])}</p></div>"
          f"<h2>🕹️ 오늘의 기계</h2>{grid}"
          f"<h2>⚖️ 오늘의 밸런스게임 <small class=\"muted\">{d.month}월 {d.day}일</small></h2>{cards}"
          f"<p><a href=\"/archive\">지난 밸런스게임 전체 보기 →</a></p>", VOTE_JS,
          jsonld=[{"@context": "https://schema.org", "@type": "WebSite", "name": cfg["siteName"], "alternateName": "오락실", "url": cfg["baseUrl"].rstrip("/") + "/"}])

    for q in qs:
        title = f"{q['a']} vs {q['b']} | 밸런스게임"
        desc = f"밸런스게임: {q['a']} vs {q['b']}. 투표하고 사람들의 선택 비율을 확인하세요. {q['note']}"[:150]
        others = "".join(f'<li><a href="/q/{x["id"]}">{esc(x["a"])} vs {esc(x["b"])}</a></li>' for x in qs if x["id"] != q["id"])
        others = "<ul class=\"list\">" + "".join(others.split("</li>")[:6]) + "</ul>" if others else ""
        write(f"q/{q['id']}", title, desc,
              f"<h1>{esc(q['a'])} vs {esc(q['b'])}</h1><p class=\"lead\">{q['date']} 밸런스게임</p>{qcard(q, link=False)}<h2>다른 질문</h2>{others}<h2>오락실 게임</h2>{grid}", VOTE_JS,
              jsonld=[crumbs(cfg, [("밸런스게임", "archive"), (f"{q['a']} vs {q['b']}", f"q/{q['id']}")])])

    rows = "".join(f'<li>{q["date"][5:].replace("-", "/")} · <a href="/q/{q["id"]}">{esc(q["a"])} vs {esc(q["b"])}</a></li>' for q in qs)
    write("archive", f"밸런스게임 질문 모음 | {cfg['siteName']}", "5락실에 올라온 밸런스게임 질문 전체. 지금 투표해도 결과에 반영됩니다.",
          f"<h1>밸런스게임 모음</h1><p class=\"lead\">하나만 고르면 사람들의 선택 비율이 보여요. 총 {len(qs)}개.</p><ul class=\"list\">{rows}</ul>")

    write("games", f"무료 미니게임 | {cfg['siteName']}", "5락실의 무료 미니게임. 틀린그림찾기, 별똥별 피하기, 딱 멈춰, 초성 퀴즈, 반응속도. 가입 없이 바로 하고 매일 도전 순위에 이름을 올려 보세요.",
          f"<h1>오락실 게임</h1><p class=\"lead\">가입 없이 바로. 🏆 표시가 있는 게임은 매일 모두 같은 판으로 도전 순위를 겨뤄요.</p>{grid}")

    inject = {
        "WORDS": json.loads((HERE / "data" / "chosung_words.json").read_text(encoding="utf-8")),
        "POOL": [{"id": q["id"], "a": q["a"], "b": q["b"]} for q in qs if q["date"] < latest][:30],
    }
    for g in games:
        pre = "".join(f"const {k}={json.dumps(inject[k], ensure_ascii=False)};" for k in g.get("inject", []))
        body = g["body"]
        script = pre + COMMON_JS + g["js"]
        if g.get("ranked"):
            body = body.replace("<!--RANK-->", RANK_HTML)
            script += RANK_JS
        write(f"games/{g['slug']}", f"{g['title']} | {cfg['siteName']}", g["description"], body, script,
              jsonld=[{"@context": "https://schema.org", "@type": "VideoGame", "name": g["name"], "description": g["description"], "url": f"{cfg['baseUrl'].rstrip('/')}/games/{g['slug']}",
                       "gamePlatform": "Web browser", "applicationCategory": "Game", "operatingSystem": "All", "inLanguage": "ko", "isAccessibleForFree": True,
                       "offers": {"@type": "Offer", "price": "0", "priceCurrency": "KRW"}},
                      crumbs(cfg, [("게임", "games"), (g["name"], f"games/{g['slug']}")])])

    ranked = [g for g in games if g.get("ranked")]
    tabs = "".join(f'<button class="share" type="button" data-g="{g["slug"]}">{esc(g["name"])}</button>' for g in ranked)
    write("rank", f"오늘의 도전 순위 | {cfg['siteName']}", "5락실 오늘의 도전 순위. 매일 모두 같은 판으로 겨루는 미니게임 기록 TOP 10.",
          f"<h1>🏆 오늘의 도전 순위</h1><p class=\"lead\">매일 0시(한국 시간)에 새 판이 열리고 순위가 초기화돼요. 이름은 자동으로 붙는 별명이라 개인 정보가 없습니다.</p><div class=\"re\">{tabs}</div><div class=\"card\"><ol id=\"rk\" class=\"list\"></ol></div>",
          COMMON_JS + RANK_PAGE_JS)

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
    lm = today().isoformat()
    sm = "".join(f"<url><loc>{base}/{p}</loc><lastmod>{(p[2:6] + '-' + p[6:8] + '-' + p[8:10]) if p.startswith('q/') else lm}</lastmod></url>" for p in pages)
    items = "".join(f"<item><title>{esc(q['a'])} vs {esc(q['b'])}</title><link>{base}/q/{q['id']}</link><guid>{base}/q/{q['id']}</guid>"
                    f"<pubDate>{datetime.fromisoformat(q['date']).replace(tzinfo=KST).strftime('%a, %d %b %Y 00:00:00 +0900')}</pubDate><description>{esc(q['note'])}</description></item>" for q in qs[:50])
    (out / "feed.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>{esc(cfg["siteName"])} 오늘의 밸런스게임</title><link>{base}/</link>'
                                  f'<description>{esc(cfg["description"])}</description><language>ko</language>{items}</channel></rss>', encoding="utf-8")
    import shutil
    for f in (HERE / "static").glob("*"):
        shutil.copy(f, out / f.name)
    (out / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>', encoding="utf-8")
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
    (out / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#22201c"/><rect x="5" y="9" width="10" height="14" rx="3" fill="#ff5a5f"/><rect x="17" y="9" width="10" height="14" rx="3" fill="#2f80ed"/></svg>', encoding="utf-8")
    if pub := cfg.get("adsensePublisherId", "").strip():
        (out / "ads.txt").write_text(f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    return {"questions": len(qs), "today": latest, "pages": len(pages)}


if __name__ == "__main__":
    r = build(Path(sys.argv[1] if len(sys.argv) > 1 else "dist"))
    print(f"놀이터: 질문 {r['questions']}개, 오늘 {r['today']}, 페이지 {r['pages']}개")
