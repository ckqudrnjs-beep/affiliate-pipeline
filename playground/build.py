"""밸런스게임 놀이터 정적 사이트 생성기.

실행(playground 폴더에서): python build.py dist
Cloudflare Pages: 루트 디렉터리 playground, 빌드 명령 `python build.py dist`, 출력 dist.
"""
from __future__ import annotations

import html
import json
import os
import urllib.request
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
STAT_MIN = 20    # 질문 페이지에 집계 문장을 붙이는 최소 투표 수(적은 숫자로 단정하지 않기)
REPORT_MIN = 30  # 리포트에 넣는 최소 투표 수
REPORT_NEED = 5  # 리포트 페이지를 만드는 최소 질문 수(내용이 빈약하면 만들지 않음)


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
.shsheet{position:fixed;inset:0;background:#0009;display:flex;align-items:flex-end;justify-content:center;z-index:2147483646}.shsheet>div{background:#fff;color:#111;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:16px;display:grid;gap:8px}.shsheet button{font:inherit;font-weight:700;padding:13px;border-radius:12px;border:0;background:#f1f1f4;color:#111;cursor:pointer}.shsheet button[data-k=k]{background:#fee500}
.challenge{background:linear-gradient(90deg,#ff5a5f,#ff9f43);color:#fff;border-radius:14px;padding:12px 14px;margin:10px 0 14px;font-size:15px;line-height:1.5}.challenge b{font-size:17px}
:root{--bg:#0c0620;--bg2:#160b33;--card:#1a1038;--card2:#22164a;--ink:#f4f0ff;--muted:#a99fc9;--line:#3a2b6e;--a:#ff3d7f;--b:#22d3ee;--y:#ffd23f;--g:#3ddc84;--soft:#2a1d58;--btn:#ffd23f;--btn-ink:#1a0f00;--px:"Press Start 2P",monospace;--hd:"Black Han Sans","Noto Sans KR",sans-serif}
*{box-sizing:border-box}html{background:var(--bg)}
body{margin:0;word-break:keep-all;color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;
background:radial-gradient(1px 1px at 20% 30%,#fff8 50%,transparent 51%) 0 0/180px 180px,radial-gradient(1px 1px at 70% 80%,#fff6 50%,transparent 51%) 0 0/240px 240px,radial-gradient(1.5px 1.5px at 50% 50%,#ffd23f88 50%,transparent 51%) 0 0/320px 320px,radial-gradient(ellipse at 50% -10%,#3b1a7a 0%,transparent 60%),var(--bg);min-height:100vh}
[hidden]{display:none!important}
a{color:var(--b)}.wrap{max-width:760px;margin:0 auto;padding:0 16px}
header{position:sticky;top:0;z-index:40;background:#0c0620e6;backdrop-filter:blur(8px);border-bottom:2px solid var(--line);box-shadow:0 2px 0 #ff3d7f33}
header .wrap{display:flex;align-items:center;justify-content:space-between;height:60px;gap:10px}
.logo{font-family:var(--hd);font-size:28px;text-decoration:none;color:var(--b);letter-spacing:0;line-height:1;text-shadow:0 0 6px #22d3eeaa,0 0 18px #22d3ee55;white-space:nowrap}
.logo span{font-family:var(--px);font-size:22px;color:var(--a);margin-right:3px;text-shadow:0 0 6px #ff3d7fcc,0 0 20px #ff3d7f88;animation:flick 6s infinite}
@keyframes flick{0%,92%,96%,100%{opacity:1}94%{opacity:.35}95%{opacity:.9}}
nav{display:flex;gap:6px}nav a{text-decoration:none;color:var(--ink);font-size:13px;font-weight:700;padding:6px 10px;border:2px solid var(--line);border-radius:8px;background:var(--bg2)}
nav a:hover{border-color:var(--y);color:var(--y)}
h1{font-family:var(--hd);font-weight:400;font-size:30px;line-height:1.25;margin:26px 0 8px;color:#fff;text-shadow:0 0 12px #ff3d7f66}
h2{font-family:var(--hd);font-weight:400;font-size:22px;margin:36px 0 12px;color:#fff;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
h2 small{font-family:-apple-system,"Noto Sans KR",sans-serif;font-size:14px;font-weight:400}
.sec{display:flex;align-items:baseline;gap:10px;margin:38px 0 12px}.sec h2{margin:0}
.tag{font-family:var(--px);font-size:9px;letter-spacing:1px;color:var(--y);border:2px solid var(--y);padding:4px 6px 3px;border-radius:4px;text-shadow:0 0 6px #ffd23f88}
.lead{color:var(--muted);margin:0 0 16px}.muted{color:var(--muted)}
/* hero */
.hero{position:relative;overflow:hidden;margin:20px 0 6px;padding:26px 20px 22px;border-radius:20px;border:3px solid var(--a);background:linear-gradient(180deg,#2a0f55 0%,#130a2e 70%);box-shadow:0 0 0 3px #0c0620,0 0 0 6px var(--b),0 0 34px #ff3d7f55,inset 0 0 40px #ff3d7f22;text-align:center}
.hero:before{content:"";position:absolute;left:-20%;right:-20%;bottom:-40px;height:120px;background:linear-gradient(transparent 0 0),repeating-linear-gradient(90deg,#22d3ee55 0 2px,transparent 2px 40px),repeating-linear-gradient(0deg,#22d3ee55 0 2px,transparent 2px 20px);transform:perspective(200px) rotateX(55deg);transform-origin:bottom;opacity:.7}
.hero>*{position:relative}.hero:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,#0000 0 2px,#0000002a 2px 3px)}
.coin{font-family:var(--px);font-size:11px;color:var(--y);letter-spacing:2px;animation:blink 1.1s steps(1) infinite;margin:0 0 12px}
@keyframes blink{50%{opacity:0}}
.hero h1{margin:0;font-size:56px;line-height:1;color:#fff;text-shadow:0 0 4px #fff,0 0 14px var(--a),0 0 30px var(--a),4px 4px 0 #22d3ee88}
.hero h1 b{font-family:var(--px);font-weight:400;font-size:46px;color:var(--y);text-shadow:0 0 6px var(--y),0 0 22px #ff9900,4px 4px 0 #ff3d7f}
.hero p{margin:14px auto 18px;max-width:440px;color:#dcd3ff;font-size:15px}
.cta{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.big,.btn{display:inline-block;font:inherit;font-family:var(--hd);font-size:18px;font-weight:400;text-decoration:none;border:0;border-radius:12px;padding:12px 20px 10px;background:var(--btn);color:var(--btn-ink);cursor:pointer;box-shadow:0 5px 0 #b8860b,0 0 18px #ffd23f55;transition:transform .08s,box-shadow .08s}
.big:active,.btn:active{transform:translateY(4px);box-shadow:0 1px 0 #b8860b}
.btn.ghost{background:transparent;color:var(--b);border:2px solid var(--b);box-shadow:0 4px 0 #0e7490,0 0 14px #22d3ee44}
.ticker{overflow:hidden;white-space:nowrap;border-top:2px solid var(--line);border-bottom:2px solid var(--line);background:#000a;margin:18px -16px 0;padding:7px 0;font-size:13px;color:var(--y)}
.ticker div{display:inline-block;padding-left:100%;animation:tick 22s linear infinite}.ticker i{font-style:normal;color:var(--a);margin:0 14px}
@keyframes tick{to{transform:translateX(-100%)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.ticker div{padding-left:0}}
/* game cabinets */
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.grid a{--c:var(--b);position:relative;display:flex;flex-direction:column;text-decoration:none;color:var(--ink);background:var(--card);border:3px solid var(--c);border-radius:16px 16px 10px 10px;padding:0;overflow:hidden;box-shadow:0 6px 0 #00000088,0 0 16px color-mix(in srgb,var(--c) 35%,transparent);transition:transform .12s,box-shadow .12s}
.grid a:hover{transform:translateY(-4px);box-shadow:0 10px 0 #00000088,0 0 28px color-mix(in srgb,var(--c) 60%,transparent)}
.grid a .scr{display:flex;align-items:center;justify-content:center;height:92px;margin:10px 10px 0;border-radius:10px;background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--c) 45%,#0c0620),#0a0518 75%);border:2px solid #000;box-shadow:inset 0 0 18px #000}
.ic{font-size:44px;display:block;filter:drop-shadow(0 0 8px color-mix(in srgb,var(--c) 70%,transparent))}
.grid a b{display:block;font-family:var(--hd);font-weight:400;font-size:19px;line-height:1.25;margin:10px 12px 2px;color:#fff}
.grid a small{display:block;color:var(--muted);font-size:13px;line-height:1.45;margin:0 12px;flex:1}
.grid a .play{display:flex;justify-content:space-between;align-items:center;margin:12px 0 0;padding:8px 12px;background:var(--c);color:#0c0620;font-family:var(--px);font-size:10px}
.grid a .rk{position:absolute;top:14px;right:14px;font-family:var(--px);font-size:8px;background:var(--y);color:#1a0f00;padding:4px 5px 3px;border-radius:3px;box-shadow:0 0 8px #ffd23f99}
/* balance cards */
.q,.card{background:linear-gradient(180deg,var(--card2),var(--card));border:2px solid var(--line);border-radius:18px;padding:16px;margin:14px 0;box-shadow:0 6px 0 #00000066}
.q .no{font-family:var(--hd);font-size:15px;color:var(--y);text-shadow:0 0 6px #ffd23f66}
.vs{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:stretch;margin:12px 0}
.vs button{font:inherit;font-family:var(--hd);font-size:18px;font-weight:400;line-height:1.35;border:3px solid;border-radius:14px;padding:16px 10px;cursor:pointer;min-height:92px;position:relative;overflow:hidden;color:#fff;transition:transform .08s,box-shadow .12s}
.vs button.a{border-color:var(--a);background:linear-gradient(180deg,#ff3d7f33,#ff3d7f12);box-shadow:0 5px 0 #8a1240,0 0 14px #ff3d7f33}
.vs button.b{border-color:var(--b);background:linear-gradient(180deg,#22d3ee33,#22d3ee12);box-shadow:0 5px 0 #0e6474,0 0 14px #22d3ee33}
.vs button:hover{transform:translateY(-2px)}.vs button:active{transform:translateY(3px)}
.vs button.a:hover,.vs button.a.mine{box-shadow:0 5px 0 #8a1240,0 0 26px #ff3d7f99;background:#ff3d7f44}
.vs button.b:hover,.vs button.b.mine{box-shadow:0 5px 0 #0e6474,0 0 26px #22d3ee99;background:#22d3ee44}
.vs button.mine:after{content:"MY PICK";position:absolute;top:5px;left:50%;transform:translateX(-50%);font-family:var(--px);font-size:7px;color:var(--y)}
.vs .x{align-self:center;font-family:var(--px);font-size:14px;color:var(--y);text-shadow:0 0 8px #ffd23f,2px 2px 0 #ff3d7f}
.bar{display:none;height:14px;border-radius:4px;background:var(--b);overflow:hidden;margin-top:6px;border:2px solid #000;box-shadow:0 0 12px #22d3ee55}.bar i{display:block;height:100%;background:var(--a);transition:width .6s cubic-bezier(.2,.9,.3,1.2)}
.done .bar{display:block}.pct{display:none;justify-content:space-between;font-family:var(--px);font-size:11px;margin-top:8px}.done .pct{display:flex}.pct .pa{color:var(--a)}.pct .pb{color:var(--b)}
.note{color:var(--muted);font-size:14px;margin:10px 0 0}.re{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.re button,.share{font:inherit;font-size:14px;border:2px solid var(--line);background:var(--bg2);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer}
.re button:hover,.share:hover{border-color:var(--y)}
.more{display:inline-block;margin:6px 0 0;font-weight:700;color:var(--b);text-decoration:none}
/* ads & stats */
.ad{margin:30px 0;text-align:center}.ad>small{display:block;font-size:11px;color:var(--muted);letter-spacing:1px;margin-bottom:4px}
.stat{background:#0a0518;border:2px dashed var(--line);border-radius:14px;padding:12px 14px;margin:14px 0;font-size:15px}.stat small{display:block;color:var(--muted);font-size:12px;margin-top:4px}
.next{display:flex;justify-content:flex-end;margin:6px 0 0}
/* in-game */
input.ans{font:inherit;font-size:18px;width:100%;padding:12px;border-radius:12px;border:2px solid var(--b);background:#0a0518;color:var(--ink);box-shadow:inset 0 0 10px #22d3ee33}
input.ans:focus{outline:none;box-shadow:0 0 0 3px #22d3ee55}
.cho{font-family:var(--hd);font-size:48px;letter-spacing:10px;text-align:center;margin:12px 0;color:var(--y);text-shadow:0 0 10px #ffd23f99,3px 3px 0 #ff3d7f}
.pad{height:220px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-family:var(--hd);font-size:24px;cursor:pointer;user-select:none;background:#0a0518;border:3px solid var(--b);box-shadow:inset 0 0 30px #22d3ee33,0 0 14px #22d3ee33}
.spot{display:grid;grid-template-columns:1fr;gap:10px;margin:10px 0}@media(min-width:700px){.spot{grid-template-columns:1fr 1fr}}
.spot svg{border-radius:10px;border:2px solid #000}
ul.list{padding-left:20px}ul.list li{margin:5px 0}ul.list li::marker{color:var(--a)}ol.list li::marker{font-family:var(--px);font-size:11px;color:var(--y)}
canvas{box-shadow:0 0 0 2px #000,0 0 18px #22d3ee44}
footer{margin-top:56px;padding:24px 0 30px;border-top:2px solid var(--line);background:#07031399;color:var(--muted);font-size:13px}footer a{margin-right:14px;color:var(--ink)}
footer .gameover{font-family:var(--px);font-size:10px;color:var(--a);letter-spacing:2px;margin:0 0 12px}
@media (max-width:420px){.logo{font-size:24px}.logo span{font-size:18px}nav a{padding:5px 7px;font-size:12px}.hero h1{font-size:46px}.hero h1 b{font-size:38px}.vs button{font-size:16px}.grid{grid-template-columns:1fr 1fr;gap:10px}.grid a .scr{height:76px}.ic{font-size:38px}.grid a b{font-size:17px}}
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
const sh=e.target.closest('.share');if(sh){const url=location.origin+sh.dataset.url;const t=sh.dataset.t;shareLink(t,url,t+'\\n'+url)}});
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
    colors = ["#ff3d7f", "#22d3ee", "#ffd23f", "#3ddc84", "#b06bff", "#ff8a3d"]
    cards = "".join(f'<a href="/games/{g["slug"]}" style="--c:{colors[i % len(colors)]}">{"<span class=rk>RANK</span>" if g.get("ranked") else ""}<span class="scr"><span class="ic">{g.get("icon", "🎮")}</span></span><b>{esc(g["name"])}</b><small>{esc(g["short"])}</small><span class="play"><span>PLAY</span><span>▶</span></span></a>' for i, g in enumerate(games))
    return f'<div class="grid">{cards}</div>'


# 자동 별명: 자유 입력이 없어서 욕설 관리가 필요 없다. functions/api/score.js 와 같은 목록.
ADJ = ["빠른", "느긋한", "용감한", "졸린", "배고픈", "신난", "수줍은", "똑똑한", "엉뚱한", "반짝이는", "조용한", "씩씩한", "날쌘", "포근한", "명랑한", "꼼꼼한"]
ANI = ["수달", "고양이", "강아지", "판다", "펭귄", "다람쥐", "여우", "너구리", "부엉이", "고래", "토끼", "햄스터", "거북이", "사슴", "오리", "곰"]

COMMON_JS = (
    "const KST=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);"
    "function seeded(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19}"
    "return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296}}"
    "function shareText(t){const m=t.match(/https?:\\/\\/\\S+$/);shareLink(t.split('\\n')[0],m?m[0]:location.href,t)}"
    f"const ADJ={json.dumps(ADJ, ensure_ascii=False)},ANI={json.dumps(ANI, ensure_ascii=False)};"
    "function nickOk(n){const p=String(n||'').split(' ');return (p.length===3&&ADJ.includes(p[0])&&ANI.includes(p[1])&&/^\\d{1,2}$/.test(p[2]))||profileNickOk(n)}"
    "function challengeUrl(score){return location.origin+location.pathname+'?c='+Math.floor(score)+'&n='+encodeURIComponent(myNick())+'&d='+KST}"
    "addEventListener('DOMContentLoaded',()=>{const q=new URLSearchParams(location.search),c=parseInt(q.get('c'),10),n=q.get('n'),d=q.get('d');"
    "if(!(c>0)||!nickOk(n)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(d||''))return;const h=document.querySelector('main h1');if(!h)return;"
    "const b=document.createElement('div');b.className='challenge';const t=document.createElement('b');t.textContent=n+'님의 '+(d===KST?'오늘':d.slice(5).replace('-','/'))+' 기록 '+c.toLocaleString()+'점';"
    "b.append('🔥 ',t,document.createElement('br'),d===KST?'같은 판으로 이겨 보세요!':'오늘 판으로 도전해 보세요!');h.after(b)});"
    "function myNick(){let n=null;try{n=localStorage.getItem('nr_nick')}catch(e){}if(!n||!(/^\\S+ \\S+ \\d{1,2}$/.test(n)||profileNickOk(n))){n=ADJ[Math.floor(Math.random()*ADJ.length)]+' '+ANI[Math.floor(Math.random()*ANI.length)]+' '+Math.floor(Math.random()*100);try{localStorage.setItem('nr_nick',n)}catch(e){}}return n}"
)

RANK_HTML = """<div class="card" id="rankbox"><h2 style="margin-top:0">🏆 오늘의 도전 순위</h2><p class="muted">오늘은 모두 같은 판이에요. 내 별명: <b id="mynick"></b> <button class="share" type="button" id="renick">별명·프로필 설정</button></p><ol id="rk" class="list"><li class="muted">불러오는 중…</li></ol><p><a href="/rank">전체 순위 보기 →</a></p><p class="mkp" hidden><a class="btn" href="/profile">✨ 별명 정하고 순위 올리기</a></p></div>"""

RANK_JS = """
(function(){const G=location.pathname.split('/').pop();const $r=id=>document.getElementById(id);$r('mynick').textContent=myNick();
$r('renick').onclick=()=>{location.href='/profile'};
async function load(){try{const r=await (await fetch('/api/score?game='+G+'&day='+KST)).json();const me=myNick();
$r('rk').innerHTML=r.length?r.map(x=>'<li'+(x.nick===me?' style="font-weight:800"':'')+'>'+x.nick+(x.t?' <small class="tag">테스터</small>':'')+' · '+x.score.toLocaleString()+'점</li>').join(''):'<li class="muted">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</li>'}catch(e){$r('rk').innerHTML='<li class="muted">순위를 불러오지 못했어요.</li>'}}
window.submitScore=async function(score){score=Math.floor(score);let best=0;try{best=+localStorage.getItem('nr_best_'+G+'_'+KST)||0}catch(e){}
if(score<=best){load();return}try{localStorage.setItem('nr_best_'+G+'_'+KST,score)}catch(e){}
try{await fetch('/api/score',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game:G,day:KST,score,nick:myNick()})})}catch(e){}load()};load()})();
"""

RANK_PAGE_JS = """
let cur=document.querySelector('[data-g]').dataset.g;const me=myNick();
async function show(g){cur=g;document.querySelectorAll('[data-g]').forEach(b=>b.style.fontWeight=b.dataset.g===g?'800':'400');
try{const r=await (await fetch('/api/score?game='+g+'&day='+KST)).json();document.getElementById('rk').innerHTML=r.length?r.map(x=>'<li'+(x.nick===me?' style="font-weight:800"':'')+'>'+x.nick+(x.t?' <small class="tag">테스터</small>':'')+' · '+x.score.toLocaleString()+'점</li>').join(''):'<li class="muted">아직 기록이 없어요.</li>'}catch(e){}}
document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>show(b.dataset.g));show(cur);
"""


def crumbs(cfg: dict, trail: list[tuple[str, str]]) -> dict:
    base = cfg["baseUrl"].rstrip("/")
    items = [("홈", "")] + trail
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": f"{base}/{p}"} for i, (n, p) in enumerate(items)]}


def pub_id(cfg: dict) -> str:
    """adsensePublisherId 는 pub-… 또는 ca-pub-… 둘 다 허용 → pub-…"""
    p = (cfg.get("adsensePublisherId") or "").strip()
    return p[3:] if p.startswith("ca-") else p


def ad_slot(cfg: dict) -> str:
    """본문 광고 1칸. ID가 하나도 없으면 빈 문자열(자리도 안 생김).
    애드센스 승인 후 adsenseSlot(디스플레이 광고 단위 번호)이 있으면 애드센스, 없으면 카카오 애드핏(adfitUnit 모바일 320x100, adfitUnitPc 728x90)."""
    pub, slot = pub_id(cfg), (cfg.get("adsenseSlot") or "").strip()
    if pub and slot:
        return (f'<div class="ad"><small>광고</small><ins class="adsbygoogle" style="display:block" data-ad-client="ca-{esc(pub)}" data-ad-slot="{esc(slot)}" '
                'data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>')
    m, pc = (cfg.get("adfitUnit") or "").strip(), (cfg.get("adfitUnitPc") or "").strip()
    if m or pc:
        return f'<div class="ad" data-m="{esc(m)}" data-p="{esc(pc)}"><small>광고</small></div>'
    return ""


# 애드핏: 화면 폭에 맞는 단위 하나만 넣는다(숨겨 둔 광고로 노출을 부풀리지 않음).
ADFIT_JS = """
(function(){var s=document.querySelectorAll('.ad[data-m]');if(!s.length)return;var w=innerWidth>=760,n=0;
s.forEach(function(d){var u=w?(d.dataset.p||d.dataset.m):d.dataset.m;if(!u){d.remove();return}var big=w&&u===d.dataset.p;var i=document.createElement('ins');i.className='kakao_ad_area';i.style.display='none';
i.setAttribute('data-ad-unit',u);i.setAttribute('data-ad-width',big?'728':'320');i.setAttribute('data-ad-height',big?'90':'100');d.appendChild(i);n++});
if(n){var j=document.createElement('script');j.async=true;j.src='//t1.daumcdn.net/kas/static/ba.min.js';document.body.appendChild(j)}})();
"""


def fetch_stats(base: str, ids: list[str], timeout: float = 6) -> dict:
    """빌드할 때 실제 투표 집계(/api/vote 공개 GET)를 가져온다. 실패하면 있는 만큼만(없으면 {}) → 집계 문장 없이 빌드."""
    out: dict = {}
    for i in range(0, len(ids), 30):
        url = f"{base.rstrip('/')}/api/vote?ids=" + ",".join(ids[i:i + 30])
        try:
            req = urllib.request.Request(url, headers={"user-agent": "5raksil-build/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read().decode("utf-8"))
            out.update({k: v for k, v in data.items() if isinstance(v, dict)})
        except Exception as e:  # 사이트가 아직 없거나 네트워크 차단: 집계 없이 진행
            print(f"집계 가져오기 실패({e.__class__.__name__}), 집계 없이 빌드")
            break
    return out


def summary(q: dict, c: dict | None) -> dict | None:
    """실제 숫자로만 만든 결과 요약. 표가 적으면 None."""
    if not c:
        return None
    a, b = int(c.get("a", 0)), int(c.get("b", 0))
    t = a + b
    if t < STAT_MIN:
        return None
    pa = round(a * 100 / t)
    pb = 100 - pa
    lead = q["a"] if a >= b else q["b"]
    gap = abs(pa - pb)
    if gap <= 10:
        phrase = "거의 반반으로 갈렸어요"
    elif gap <= 30:
        phrase = f"‘{lead}’ 쪽이 조금 앞섰어요"
    else:
        phrase = f"‘{lead}’ 쪽으로 크게 기울었어요"
    rs = [(int(c.get(k, 0)), e) for k, e in EMOJI]
    top = max(rs)
    return {"t": t, "pa": pa, "pb": pb, "gap": gap, "phrase": phrase, "react": top[1] if top[0] >= 3 else "", "rn": top[0], "q": q}


def stat_html(s: dict, asof: date) -> str:
    q = s["q"]
    react = f" 가장 많이 눌린 반응은 {s['react']}예요." if s["react"] else ""
    return (f'<div class="stat">📊 지금까지 {s["t"]:,}명이 투표했어요. ‘{esc(q["a"])}’ {s["pa"]}% · ‘{esc(q["b"])}’ {s["pb"]}%로 {esc(s["phrase"])}.{react}'
            f'<small>{asof.month}월 {asof.day}일 집계 기준. 투표하면 지금 결과가 바로 보여요.</small></div>')

# 공유: 카카오 키(KAKAO_JS_KEY, Cloudflare 변수)가 있으면 "카카오톡 / 다른 앱" 선택 창, 없으면 기기 공유창·복사.
SHARE_JS = """
function shareOk(){if(window.Bonus)Bonus.ach('share')}
function plainShare(text){if(navigator.share)navigator.share({text}).then(shareOk).catch(()=>{});else if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>{shareOk();alert('링크를 복사했어요. 친구에게 붙여 넣어 보세요!')}).catch(()=>{})}}
function shareLink(title,url,text){if(text.indexOf(url)<0)text+='\\n'+url;if(!(window.Kakao&&Kakao.isInitialized&&Kakao.isInitialized())){plainShare(text);return}
const m=url.match(/\\/q\\/(\\d{8}-\\d)/);const og=document.querySelector('meta[property="og:image"]');const img=m?location.origin+'/og/q/'+m[1]+'.png':(og?og.content:location.origin+'/og.png');
const box=document.createElement('div');box.className='shsheet';box.innerHTML='<div><b>공유하기</b><button type="button" data-k="k">💬 카카오톡</button><button type="button" data-k="o">📤 다른 앱 · 링크 복사 (첫 공유 🪙+2)</button><button type="button" data-k="x">닫기</button></div>';
box.onclick=e=>{const k=e.target.dataset&&e.target.dataset.k;if(e.target===box||k==='x'){box.remove();return}if(!k)return;box.remove();
if(k==='k'){try{Kakao.Share.sendDefault({objectType:'feed',content:{title:title.slice(0,80),description:(text.split('\\n').slice(1,3).join(' ').replace(url,'').trim().slice(0,80)||'가입 없이 바로 하는 무료 게임')+' · '+location.host.replace('www.',''),imageUrl:img,link:{mobileWebUrl:url,webUrl:url}},buttons:[{title:'나도 하러 가기',link:{mobileWebUrl:url,webUrl:url}}]})}catch(err){plainShare(text)}}else plainShare(text)};['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup'].forEach(t=>box.addEventListener(t,e=>e.stopPropagation()));(document.fullscreenElement||document.webkitFullscreenElement||document.body).appendChild(box)}
"""


# 출석체크 보너스(2026-11-13 BK): 모든 게임은 코인 없이 무료로 끝까지 할 수 있고, 출석은 '덤'만 준다.
# 코인은 출석·게임 업적·결과 공유로만 생긴다(광고 클릭·시청과 무관, 판매·현금 교환 없음). 기록은 이 브라우저 localStorage 에만.
# 코인 사용: 이어하기(한 판 1번) + 스킨 사기(BK: 화려할수록 비싸게). 스킨은 겉모습만, 점수·판정 영향 없음.
BONUS_MAX_COINS = 60
SKINS = [  # 모든 게임 공통 '내 네온 색'. p = 코인 가격. c = [밝은 색, 기본 색, 어두운 색]
    {"id": "cy", "name": "네온 청록", "p": 0, "c": ["#e9fdff", "#22d3ee", "#0e7490"]},
    {"id": "pk", "name": "체리 핑크", "p": 2, "c": ["#ffe9f3", "#ff3d9a", "#9d174d"]},
    {"id": "gr", "name": "오로라 그린", "p": 3, "c": ["#ecfdf5", "#3ddc84", "#15803d"]},
    {"id": "or", "name": "선셋 오렌지", "p": 3, "c": ["#fff1e6", "#ff8a3d", "#9a3412"]},
    {"id": "pu", "name": "보랏빛 성운", "p": 4, "c": ["#f5edff", "#b06bff", "#6b21a8"]},
    {"id": "gd", "name": "황금", "p": 5, "c": ["#fffbe6", "#ffd23f", "#a16207"]},
]
# 디자인 스킨: 캐릭터 모양 자체가 바뀜. 화려할수록 비싸다.
DESIGNS = [
    {"g": "starlight", "id": "cat", "name": "냥냥 요격기", "icon": "🐱", "p": 6},
    {"g": "starlight", "id": "ufo", "name": "원반 UFO", "icon": "🛸", "p": 8},
    {"g": "starlight", "id": "dragon", "name": "드래곤 파이터", "icon": "🐉", "p": 12},
    {"g": "starlight", "id": "aurora", "name": "오로라 세라프", "icon": "🌈", "p": 50, "leg": 1},
    {"g": "tongtong", "id": "cat", "name": "냥이 통통", "icon": "🐱", "p": 5},
    {"g": "tongtong", "id": "frog", "name": "개구리 통통", "icon": "🐸", "p": 7},
    {"g": "tongtong", "id": "astro", "name": "우주인 통통", "icon": "🧑‍🚀", "p": 10},
    {"g": "tongtong", "id": "whale", "name": "별고래", "icon": "🐋", "p": 50, "leg": 1},
]
DESIGN_GAMES = {"starlight": ["별빛 요격대", "NX-7 기본", "✈️"], "tongtong": ["통통 네온런", "통통이 기본", "🔵"]}
# 업적·공유 보너스 코인(각 1번만): sl5 별빛 5단계, tt500 통통 500m, rg4 사격장 4단계, share 결과 공유
ACH = {"sl5": ["별빛 요격대 STAGE 5 도달", 3], "tt500": ["통통 네온런 500m 도달", 3], "rg4": ["네온 사격장 STAGE 4 도달", 3], "share": ["게임 결과 친구에게 공유하기", 2]}

BONUS_JS = (
    f"const SKINS={json.dumps(SKINS, ensure_ascii=False)},BONUS_MAX={BONUS_MAX_COINS},DESIGNS={json.dumps(DESIGNS, ensure_ascii=False)},DGAMES={json.dumps(DESIGN_GAMES, ensure_ascii=False)},ACH={json.dumps(ACH, ensure_ascii=False)};"
    r"""
window.Bonus=(function(){const K='nr_bonus',day=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);let s={};
function ld(){try{s=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch(e){s={}}s.coins=Math.max(0,Math.min(BONUS_MAX,+s.coins||0));s.days=+s.days||0;s.streak=+s.streak||0;s.ach=s.ach||{};s.des=s.des||{};s.own=s.own||{};return s}
function sv(){try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}try{dispatchEvent(new Event('bonus-save'))}catch(e){}}
function yday(){return new Date(Date.parse(day()+'T00:00:00Z')-864e5).toISOString().slice(0,10)}
function add(n){const b=s.coins;s.coins=Math.min(BONUS_MAX,s.coins+n);return s.coins-b}
const own=(k,p)=>p<=0||!!s.own[k];
const B={state:()=>Object.assign({},ld()),done:()=>ld().last===day(),coins:()=>ld().coins,
 checkin(){ld();if(s.last===day())return -1;s.streak=s.last===yday()?s.streak+1:1;s.days++;s.last=day();const g=add(s.streak%7===0?2:1);sv();B.render();return g},
 spend(n){n=n||1;ld();if(s.coins<n)return false;s.coins-=n;sv();B.render();return true},
 ach(k){ld();if(s.ach[k]||!ACH[k])return;s.ach[k]=1;const g=add(ACH[k][1]);sv();B.toast('🏅 '+ACH[k][0]+'! 🪙 +'+g);B.render()},
 buy(k,p,name){ld();if(own(k,p))return true;if(s.coins<p){B.toast('🪙 코인이 '+(p-s.coins)+'개 모자라요');return false}s.coins-=p;s.own[k]=1;sv();B.toast('✨ '+name+' 획득! (🪙 -'+p+')');return true},
 skin(){ld();return SKINS.find(k=>k.id===s.skin&&own('c:'+k.id,k.p))||SKINS[0]},
 setSkin(id){ld();const k=SKINS.find(x=>x.id===id);if(!k||!B.buy('c:'+k.id,k.p,k.name))return false;s.skin=id;sv();B.render();return true},
 design(g){ld();const d=DESIGNS.find(x=>x.g===g&&x.id===s.des[g]);return d&&own('d:'+g+':'+d.id,d.p)?d.id:'base'},
 setDesign(g,id){ld();if(id!=='base'){const d=DESIGNS.find(x=>x.g===g&&x.id===id);if(!d||!B.buy('d:'+g+':'+id,d.p,d.name))return false}s.des[g]=id;sv();B.render();return true},
 render(){ld();const done=s.last===day(),sk=B.skin();
  document.querySelectorAll('.att').forEach(a=>{a.classList.toggle('new',!done);a.querySelector('b').textContent=s.coins});
  document.querySelectorAll('.bonus-mini').forEach(el=>{const g=el.dataset.g,dd=g&&DESIGNS.find(x=>x.g===g&&x.id===B.design(g)),sw=el.dataset.skin?` · 스킨 ${dd?dd.icon+' '+dd.name:(DGAMES[g]?DGAMES[g][2]+' 기본':'')} <span class="sw" style="--c:${sk.c[1]}"></span> ${sk.name}`:'';
   el.innerHTML=done?`✅ 오늘 출석 완료 · 🪙 <b>${s.coins}</b>개${sw} <a href="/bonus">스킨 상점 →</a>`
   :`📅 오늘 출석하면 🪙 코인 +1 <small>(${el.dataset.use||'이어하기·스킨 사기에 써요'})</small> <button type="button" class="ck">출석하기</button>`;
   const b=el.querySelector('.ck');if(b)b.onclick=()=>{const g=B.checkin();B.toast(g>0?`🪙 +${g} 출석 완료! (연속 ${s.streak}일)`:'코인이 가득 찼어요(최대 '+BONUS_MAX+'개). 출석 일수는 올라가요!')}});
  const pg=document.getElementById('bonuspage');if(pg)B.page(pg)},
 toast(t){const d=document.createElement('div');d.className='btoast';d.textContent=t;(document.fullscreenElement||document.body).appendChild(d);setTimeout(()=>d.remove(),2600)},
 page(pg){const done=s.last===day(),st=done?s.streak:(s.last===yday()?s.streak:0),pos=done?((st-1)%7)+1:(st%7);
  let stamps='';for(let i=1;i<=7;i++)stamps+=`<li class="${i<=pos?'on':''}${i===7?' big':''}"><small>${i}일</small>${i<=pos?'✔':(i===7?'🪙2':'🪙')}</li>`;
  pg.querySelector('.stamps').innerHTML=stamps;
  pg.querySelector('.bst').innerHTML=`보유 코인 <b>🪙 ${s.coins}</b> · 연속 <b>${st}일</b> · 누적 <b>${s.days}일</b>`;
  const ck=pg.querySelector('.bigck');ck.disabled=done;ck.textContent=done?'✅ 오늘 출석 완료! 내일 또 와요':'📅 오늘 출석하기';
  ck.onclick=()=>{const g=B.checkin();B.toast(g>0?`🪙 +${g} 출석 완료!`:'코인이 가득 찼어요. 출석 일수는 올라가요!')};
  const tag=(ok,sel,p)=>sel?'사용 중':ok?'고르기':`<span class="pr">🪙 ${p}</span>${s.coins<p?' 모자라요':' 사기'}`;
  const cur=B.skin();pg.querySelector('.skins').innerHTML=SKINS.map(k=>{const ok=own('c:'+k.id,k.p);return `<button type="button" data-s="${k.id}" class="${k.id===cur.id?'sel':''}${ok?'':' lock'}"><span class="sw" style="--c:${k.c[1]}"></span><b>${k.name}</b><small>${tag(ok,k.id===cur.id,k.p)}</small></button>`}).join('');
  pg.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{if(B.setSkin(b.dataset.s))B.toast('색을 바꿨어요! 다음 판부터 적용돼요')});
  pg.querySelector('.designs').innerHTML=Object.keys(DGAMES).map(g=>{const cur=B.design(g),[gn,bn,bi]=DGAMES[g];
   return `<h3>${gn}</h3><div class="skins"><button type="button" data-d="${g}:base" class="${cur==='base'?'sel':''}"><span class="di">${bi}</span><b>${bn}</b><small>${cur==='base'?'사용 중':'고르기'}</small></button>`
   +DESIGNS.filter(d=>d.g===g).map(d=>{const ok=own('d:'+g+':'+d.id,d.p);return `<button type="button" data-d="${g}:${d.id}" class="${cur===d.id?'sel':''}${ok?'':' lock'}${d.leg?' leg':''}"><span class="di">${d.icon}</span><b>${d.leg?'<i>전설</i> ':''}${d.name}</b><small>${tag(ok,cur===d.id,d.p)}</small></button>`}).join('')+'</div>'}).join('');
  pg.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const [g,id]=b.dataset.d.split(':');if(B.setDesign(g,id))B.toast('스킨을 바꿨어요! 다음 판부터 적용돼요')});
  pg.querySelector('.achs').innerHTML=Object.entries(ACH).map(([k,[t,n]])=>`<li>${s.ach[k]?'✅':'⬜'} ${t} <b>🪙 +${n}</b></li>`).join('')}};
document.addEventListener('DOMContentLoaded',B.render);if(document.readyState!=='loading')B.render();
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-pre]');if(!b)return;e.preventDefault();const u=location.origin+(b.dataset.u||location.pathname);shareLink(b.dataset.t,u,b.dataset.t+'\n'+b.dataset.d+'\n'+u)});
return B})();
"""
)

BONUS_CSS = """
.leg{border-color:#ffd23f!important;background:linear-gradient(135deg,#2a1a5a,#123a5a)!important;box-shadow:0 0 12px #ffd23f55}.leg b i{font-style:normal;font-size:.75em;background:#ffd23f;color:#120a2a;border-radius:6px;padding:1px 5px}
nav a.att{position:relative;color:var(--y);border-color:#ffd23f66}nav a.att b{font-weight:800}nav a.att.new::after{content:"";position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:var(--a);box-shadow:0 0 8px var(--a)}
.bonus-mini{margin:10px 0;padding:10px 12px;border:2px dashed #ffd23f66;border-radius:12px;background:#ffd23f0d;font-size:14px;line-height:1.6}.bonus-mini:empty{display:none}.bonus-mini small{color:var(--muted)}
.bonus-mini .ck{margin-left:4px;font:inherit;font-weight:800;font-size:13px;padding:5px 12px;border-radius:9px;border:0;background:var(--y);color:#1a0f00;cursor:pointer;box-shadow:0 3px 0 #b8860b}
.sw{display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c);vertical-align:-2px}
.btoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#1a1038;color:#fff;border:2px solid var(--y);border-radius:12px;padding:10px 16px;font-weight:700;box-shadow:0 0 20px #ffd23f55;max-width:90vw;text-align:center}
#bonuspage .stamps{list-style:none;padding:0;margin:14px 0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
#bonuspage .stamps li{min-width:0;overflow:hidden;aspect-ratio:1;border:2px solid var(--line);border-radius:12px;background:var(--bg2);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:15px;line-height:1.2;white-space:nowrap}
#bonuspage .stamps li small{font-size:11px;color:var(--muted)}#bonuspage .stamps li.on{border-color:var(--y);background:#ffd23f22;color:var(--y);box-shadow:0 0 10px #ffd23f55}#bonuspage .stamps li.big{border-color:#ff3d7f88}
#bonuspage .bigck{display:block;width:100%;font:inherit;font-size:19px;font-weight:800;padding:14px;border-radius:14px;border:0;background:var(--y);color:#1a0f00;box-shadow:0 5px 0 #b8860b,0 0 24px #ffd23f66;cursor:pointer}
#bonuspage .bigck:disabled{background:var(--soft);color:var(--muted);box-shadow:none;cursor:default}
#bonuspage .skins{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
#bonuspage .skins button{font:inherit;text-align:left;display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:center;padding:10px;border-radius:12px;border:2px solid var(--line);background:var(--bg2);color:var(--ink);cursor:pointer}
#bonuspage .skins button .sw{grid-row:span 2;width:26px;height:26px}#bonuspage .skins button small{color:var(--muted);font-size:12px}
#bonuspage .di{grid-row:span 2;font-size:26px;line-height:1;width:30px;text-align:center}#bonuspage h3{margin:16px 0 8px;font-size:15px;color:var(--y)}
#bonuspage .skins button.lock{border-style:dashed}#bonuspage .skins button .pr{color:var(--y);font-weight:800}
#bonuspage .skins button.sel{border-color:var(--y);box-shadow:0 0 12px #ffd23f55}#bonuspage .skins button:disabled{opacity:.5;cursor:default}
"""

BONUS_BODY = f"""<h1>📅 출석체크 · 스킨 상점</h1><p class="lead">하루 한 번 출석하면 🪙 코인을 받아요. 코인으로 이어하기를 하거나 스킨을 살 수 있어요. <b>모든 게임은 코인 없이도 처음부터 끝까지 무료</b>예요.</p>
<p><a href="/profile">👤 내 프로필·복구 코드 (다른 기기에서 이어 하기) →</a></p><div class="card" id="bonuspage"><p class="bst"></p><ol class="stamps"></ol><button type="button" class="bigck">📅 오늘 출석하기</button>
<h2>🐉 디자인 스킨</h2><p class="muted">스킨은 게임 속 <b>내 캐릭터의 겉모습</b>만 바꾸는 꾸미기예요. 점수·능력·맞는 범위는 그대로예요. 화려할수록 코인이 더 들어요. 한 번 사면 계속 내 것이에요.</p><div class="designs"></div>
<h2>🎨 내 네온 색</h2><p class="muted">고른 디자인에 입힐 색이에요.</p><div class="skins"></div>
<h2>🏅 업적 보너스 코인</h2><p class="muted">한 번씩만 받아요.</p><ul class="list achs"></ul></div>
<h2>코인은 어디에 쓰나요?</h2><ul class="list"><li><b>스킨 사기</b>: 위 상점에서 디자인·색을 코인으로 사요. 가격은 화려함에 따라 🪙 2~12개.</li><li><b>별빛 요격대</b>: 게임 오버 화면에서 코인 1개로 그 자리에서 이어하기(목숨 3개로 다시). 한 판에 한 번만.</li><li><b>네온 사격장</b>: 탈락한 스테이지를 코인 1개로 한 번 더 도전(점수는 그대로 이어짐). 한 판에 한 번만.</li><li>이어하기로 낸 점수도 오늘의 순위에 올라가요. 모두가 하루 똑같이 코인을 받으니 공평해요.</li></ul>
<h2>출석 규칙</h2><ul class="list"><li>한국 시간 0시가 지나면 다시 출석할 수 있어요. 하루 1번, 🪙 1개. <b>7일 연속</b>이면 그날은 🪙 2개.</li><li>코인은 최대 {BONUS_MAX_COINS}개까지 모여요. 하루 빠지면 연속 일수만 1일부터 다시 세요.</li><li>코인은 <b>돈으로 살 수 없고, 팔거나 현금·상품으로 바꿀 수 없으며, 광고를 보거나 누르는 것과도 아무 관계가 없어요.</b> 출석·업적·공유로만 생겨요.</li><li>가입이 없어서 기록(코인·산 스킨)은 지금 쓰는 <b>이 기기의 브라우저에만</b> 저장돼요. 다른 폰·브라우저에서는 따로 세고, 브라우저 기록(사이트 데이터)을 지우면 처음부터예요.</li></ul>
<p><a class="btn" href="/games">🕹️ 게임하러 가기</a></p>"""

# 가입 없는 프로필(2026-11-13 BK): 별명·아바타 + 복구 코드로 다른 기기에서 코인·스킨·출석·별명을 이어 쓴다. 개인정보 없음.
NICK_JS = re.sub(r"^export ", "", (HERE / "lib" / "nick.js").read_text(encoding="utf-8"), flags=re.M)
PROFILE_JS = NICK_JS + r"""
window.Profile=(function(){const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}};
const api=async b=>{const r=await fetch('/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});let j={};try{j=await r.json()}catch(e){}j._s=r.status;return j};
const data=()=>{try{return JSON.parse(localStorage.getItem('nr_bonus')||'{}')}catch(e){return {}}};
let t=0,busy=false;
const P={code:()=>LS('nr_pcode'),nick:()=>{const n=LS('nr_nick');return profileNickOk(n)?n:null},
 setNick(av,name){const n=av+' '+name;if(!profileNickOk(n))return false;LS('nr_nick',n);P.sync(0);return true},
 adopt(j){if(j.data){LS('nr_bonus',JSON.stringify(j.data))}if(j.nick)LS('nr_nick',j.nick);if(j.rev)LS('nr_prev',String(j.rev));if(window.Bonus)Bonus.render();P.render()},
 async create(){const n=P.nick();if(!n)return {error:'nick'};const j=await api({a:'new',nick:n,data:data()});if(j.code){LS('nr_pcode',j.code);LS('nr_prev',String(j.rev))}P.render();return j},
 async load(code){const j=await api({a:'get',code});if(j.data){LS('nr_pcode',code.toUpperCase().trim());P.adopt(j)}return j},
 async del(){const c=P.code();if(!c)return {};const j=await api({a:'del',code:c});if(j.ok||j._s===404){LS('nr_pcode',null);LS('nr_prev',null)}P.render();return j},
 forget(){LS('nr_pcode',null);LS('nr_prev',null);P.render()},
 sync(ms){const c=P.code(),n=P.nick();if(!c||!n)return;clearTimeout(t);t=setTimeout(async()=>{if(busy)return;busy=true;try{const j=await api({a:'put',code:c,nick:n,data:data(),rev:+LS('nr_prev')||0});
  if(j.rev&&!j.data)LS('nr_prev',String(j.rev));else if(j._s===409)P.adopt(j);else if(j._s===404)P.forget()}catch(e){}busy=false},ms===undefined?1500:ms)},
 async pull(){const c=P.code();if(!c)return;let last=0;try{last=+sessionStorage.getItem('nr_pget')||0}catch(e){}if(Date.now()-last<6e5)return;try{sessionStorage.setItem('nr_pget',String(Date.now()))}catch(e){}
  try{const j=await api({a:'get',code:c});if(j.rev&&j.rev>(+LS('nr_prev')||0))P.adopt(j);else if(j._s===404)P.forget()}catch(e){}},
 render(){const n=P.nick();document.querySelectorAll('a.me').forEach(a=>{a.classList.toggle('new',!n);a.querySelector('i').textContent=n?n.split(' ')[0]:'👤';a.querySelector('b').textContent=n?n.slice(n.indexOf(' ')+1):'프로필 만들기'});
  document.querySelectorAll('.mkp').forEach(e=>e.hidden=!!n);const pg=document.getElementById('profpage');if(pg&&P.page)P.page(pg)}};
P.render();
addEventListener('bonus-save',()=>P.sync());
document.addEventListener('DOMContentLoaded',()=>{P.pull();P.render()});
return P})();
"""

# 관리자 페이지(/admin, 링크 없음·noindex). 비밀번호는 Cloudflare 비밀 변수 ADMIN_KEY, 이 브라우저 탭에만 잠깐 보관.
ADMIN_BODY = """<h1>🔧 관리자</h1><p class="lead">테스터 프로필에 코인·스킨을 주고, 테스터로 지정하면 순위에 '테스터' 표시가 붙고, '순위 제외'를 켜면 공개 순위에서 빠져요. 바꾼 내용은 그 기기에서 사이트를 새로 열면 적용돼요.</p>
<div class="card adm"><label>관리자 비밀번호 <input type="password" id="ak" autocomplete="off"></label>
<form id="af"><input id="aq" placeholder="별명 일부 또는 복구 코드" maxlength="20"> <button class="share" type="submit">찾기</button></form><p id="am" class="muted"></p><div id="al"></div></div>
<div class="card"><h2>👥 별명 목록</h2><p class="muted">최근 사용 순. 별명을 누르면 위에서 바로 관리할 수 있어요. 복구 코드 원본은 보안상 저장하지 않아요. 잃어버린 사람에게는 '새 복구 코드 발급'을 눌러 새 코드를 주세요.</p><button class="share" type="button" id="alst">불러오기</button> <span id="atot" class="muted"></span><ol id="aplist" class="list"></ol><button class="share" type="button" id="amore" hidden>더 보기</button></div>
<div class="card"><h2>최근 관리자 작업</h2><button class="share" type="button" id="alog">불러오기</button><ol id="alist" class="list"></ol></div>"""
ADMIN_CSS = """#alist small{word-break:break-all}.adm label{display:block;margin-bottom:10px}.adm input{font:inherit;padding:8px 10px;border-radius:9px;border:2px solid #ffffff33;background:#0b0620;color:#fff;max-width:100%}
.ap{border:2px solid #ffffff22;border-radius:12px;padding:12px;margin:10px 0}.ap h3{margin:0 0 6px}.ap .row{margin:8px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ap .own{display:flex;flex-wrap:wrap;gap:6px}.ap .own label{display:inline-flex;gap:4px;margin:0;padding:4px 8px;border:1px solid #ffffff33;border-radius:8px;font-size:13px}.ap select{font:inherit;padding:6px;border-radius:8px;background:#0b0620;color:#fff}"""
ADMIN_JS = r"""(function(){const $=i=>document.getElementById(i),ak=$('ak');try{ak.value=sessionStorage.getItem('nr_admk')||''}catch(e){}
ak.onchange=()=>{try{sessionStorage.setItem('nr_admk',ak.value)}catch(e){}};
const api=async b=>{const r=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json','x-admin-key':ak.value},body:JSON.stringify(b)});let j={};try{j=await r.json()}catch(e){}if(!r.ok)$('am').textContent=j.msg||('오류 '+r.status);return r.ok?j:null};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ITEMS=SKINS.filter(k=>k.p>0).map(k=>['c:'+k.id,'🎨 '+k.name]).concat(DESIGNS.map(d=>['d:'+d.g+':'+d.id,d.icon+' '+d.name+(d.leg?' (전설)':'')]));
function card(it){const d=it.data||{},own=d.own||{},des=d.des||{};const el=document.createElement('div');el.className='ap';
 el.innerHTML=`<h3>${esc(it.nick)} ${it.tester?'<span class="tag">테스터</span>':''}${it.hide?' <span class="tag">순위 제외</span>':''}</h3><small class="muted">🪙 ${d.coins||0} · 출석 ${d.days||0}일 · 마지막 저장 ${esc(it.updated)}</small>
 <div class="row">코인 <input type="number" class="co" min="0" max="${BONUS_MAX}" value="${d.coins||0}" style="width:80px"> <button class="share" data-x="coins">코인 저장</button> <small class="muted">최대 ${BONUS_MAX}</small></div>
 <div class="row"><b>스킨 열기</b></div><div class="own">${ITEMS.map(([k,n])=>`<label><input type="checkbox" value="${k}"${own[k]?' checked':''}>${esc(n)}</label>`).join('')}</div>
 <div class="row"><button class="share" data-x="all">전부 체크</button><button class="share" data-x="own">스킨 저장</button></div>
 <div class="row">적용 ${Object.keys(DGAMES).map(g=>`${DGAMES[g][0]} <select data-g="${g}"><option value="base">${DGAMES[g][1]}</option>${DESIGNS.filter(x=>x.g===g).map(x=>`<option value="${x.id}"${des[g]===x.id?' selected':''}>${x.icon} ${x.name}</option>`).join('')}</select>`).join(' ')}
 색 <select class="sk">${SKINS.map(k=>`<option value="${k.id}"${(d.skin||'cy')===k.id?' selected':''}>${k.name}</option>`).join('')}</select> <button class="share" data-x="apply">적용 저장</button></div>
 <div class="row"><button class="share" data-x="reissue">🔑 새 복구 코드 발급</button></div><div class="nc"></div>
 <div class="row"><button class="share" data-x="tester">${it.tester?'테스터 해제':'테스터로 지정'}</button> <button class="share" data-x="hide">${it.hide?'순위 제외 끄기 (지금: 순위에서 빠짐)':'순위 제외 켜기 (지금: 순위에 보임)'}</button></div>`;
 const done=j=>{if(j&&j.item){el.replaceWith(card(j.item));$('am').textContent='저장했어요. 그 기기에서 사이트를 새로 열면 적용돼요.'}};
 el.querySelectorAll('[data-x]').forEach(b=>b.onclick=async()=>{const x=b.dataset.x;
  if(x==='all'){el.querySelectorAll('.own input').forEach(c=>c.checked=true);return}
  if(x==='coins')return done(await api({a:'set',h:it.h,coins:+el.querySelector('.co').value}));
  if(x==='own'){const cs=[...el.querySelectorAll('.own input')];return done(await api({a:'set',h:it.h,own:cs.filter(c=>c.checked).map(c=>c.value),unown:cs.filter(c=>!c.checked).map(c=>c.value)}))}
  if(x==='apply'){const des={},need=[];el.querySelectorAll('select[data-g]').forEach(s=>{des[s.dataset.g]=s.value;if(s.value!=='base')need.push('d:'+s.dataset.g+':'+s.value)});const sk=el.querySelector('.sk').value;if(sk!=='cy')need.push('c:'+sk);return done(await api({a:'set',h:it.h,des,skin:sk,own:need}))}
  if(x==='reissue'){if(!confirm(it.nick+' 프로필의 옛 복구 코드는 바로 쓸 수 없게 돼요. 새 코드를 발급할까요?'))return;const j=await api({a:'reissue',h:it.h});if(j&&j.item){const n=card(j.item);el.replaceWith(n);n.querySelector('.nc').innerHTML='<p style="font:700 20px monospace;color:#ffd23f;border:2px solid #ffd23f;border-radius:10px;padding:8px 12px">새 복구 코드<br><b style="font-size:24px">'+esc(j.code)+'</b></p><p class="muted">이 화면을 닫으면 다시 볼 수 없어요. 비밀글 답변으로 전해 주세요.</p>';$('am').textContent='새 코드를 발급했어요.'}return}
  if(x==='tester')return done(await api({a:'tester',h:it.h,on:!it.tester}));
  if(x==='hide')return done(await api({a:'hide',h:it.h,on:!it.hide}))});
 return el}
$('af').onsubmit=async e=>{e.preventDefault();$('am').textContent='찾는 중…';$('al').innerHTML='';const j=await api({a:'find',q:$('aq').value});if(!j)return;$('am').textContent=j.list.length?j.list.length+'개 찾았어요':'찾은 프로필이 없어요';j.list.forEach(it=>$('al').appendChild(card(it)))};
let pg=0;const lst=async more=>{if(!more){pg=0;$('aplist').innerHTML=''}const j=await api({a:'list',page:pg});if(!j)return;$('atot').textContent='전체 '+j.total+'명';j.list.forEach(r=>{const li=document.createElement('li');li.innerHTML='<a href="#">'+esc(r.nick)+'</a> <small class="muted">🪙'+r.coins+' · 출석 '+r.days+'일 · 마지막 '+esc(r.updated)+(r.tester?' · 테스터':'')+(r.hide?' · 순위 제외':'')+'</small>';li.querySelector('a').onclick=e=>{e.preventDefault();$('al').innerHTML='';$('al').appendChild(card(Object.assign({},r,{data:null})));findOne(r.h)};$('aplist').appendChild(li)});$('amore').hidden=!j.more;pg++};
const findOne=async h=>{const j=await api({a:'get',h});if(j&&j.item){$('al').innerHTML='';$('al').appendChild(card(j.item));scrollTo(0,0)}};
$('alst').onclick=()=>lst(false);$('amore').onclick=()=>lst(true);
$('alog').onclick=async()=>{const j=await api({a:'log'});if(j)$('alist').innerHTML=j.list.map(r=>`<li>${esc(r.t)} · ${esc(r.act)} · ${esc(r.nick)} <small class="muted">${esc(r.detail)}</small></li>`).join('')||'<li>아직 없어요</li>'}})();"""

PROFILE_PAGE_JS = r"""
Profile.page=function(pg){if(pg._busy)return;const own=(window.Bonus&&Bonus.state().own)||{},n=Profile.nick(),code=Profile.code();
 const cur=n?n.split(' ')[0]:'🐱',name=n?n.slice(n.indexOf(' ')+1):'';
 pg.querySelector('.pv').innerHTML=`<span class="pav">${n?cur:'❔'}</span><b>${n?name:'아직 별명이 없어요'}</b><small>${n?'순위에 이렇게 보여요':'지금은 자동 별명: '+myNick()}</small>`;
 const sel=pg.dataset.av||cur;pg.dataset.av=sel;
 pg.querySelector('.avs').innerHTML=AVATARS.map(a=>{const lk=AVATAR_LOCK[a]&&!own[AVATAR_LOCK[a]];return `<button type="button" data-a="${a}" class="${a===sel?'sel':''}"${lk?' disabled title="스킨 상점에서 해당 스킨을 사면 열려요"':''}>${lk?'🔒':a}</button>`}).join('');
 pg.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{pg.dataset.av=b.dataset.a;Profile.page(pg)});
 const inp=pg.querySelector('.nm');if(!inp.dataset.init){inp.value=name;inp.dataset.init=1}
 const msg=pg.querySelector('.nmsg'),chk=()=>{const v=inp.value.trim();msg.textContent=!v?'한글·영문·숫자 2~10자':nameOk(v)?'✅ 쓸 수 있어요':'❌ 2~10자 한글·영문·숫자만, 욕설·운영자 사칭 금지';return nameOk(v)};inp.oninput=chk;chk();
 pg.querySelector('.save').onclick=()=>{if(!chk())return;Profile.setNick(pg.dataset.av,inp.value.trim());Bonus.toast('✅ 저장했어요! 순위에 새 별명으로 올라가요');Profile.page(pg)};
 const cb=pg.querySelector('.codebox');
 cb.innerHTML=code?`<p>내 복구 코드</p><div class="code">${pg.dataset.show?code:code.slice(0,4)+'-••••-••••'}</div><div class="row"><button type="button" class="share" data-c="show">${pg.dataset.show?'가리기':'보기'}</button><button type="button" class="share" data-c="copy">복사</button></div><p class="muted">이 코드만 있으면 다른 폰·PC에서 코인·스킨·출석·별명을 그대로 이어 써요. <b>잃어버리면 찾아 드릴 수 없으니</b> 메모장이나 사진으로 저장해 두세요. 남에게 알려 주지 마세요.</p>`
  :`<p class="muted">복구 코드를 만들면 기록이 서버에도 저장돼서 폰을 바꾸거나 다른 기기에서도 이어 할 수 있어요. 이메일·전화번호는 받지 않아요.</p><button type="button" class="btn" data-c="new">🔑 복구 코드 만들기</button>`;
 cb.querySelectorAll('[data-c]').forEach(b=>b.onclick=async()=>{const k=b.dataset.c;
  if(k==='show'){pg.dataset.show=pg.dataset.show?'':'1';Profile.page(pg)}
  else if(k==='copy'){try{await navigator.clipboard.writeText(code);Bonus.toast('복사했어요. 안전한 곳에 붙여 넣어 두세요')}catch(e){pg.dataset.show='1';Profile.page(pg)}}
  else if(k==='new'){if(!Profile.nick()){Bonus.toast('먼저 별명을 정하고 저장해 주세요');return}pg._busy=1;b.textContent='만드는 중…';const j=await Profile.create();pg._busy=0;
   if(j.code){pg.dataset.show='1';Bonus.toast('🔑 복구 코드가 생겼어요! 꼭 적어 두세요')}else Bonus.toast(j.msg||'지금은 만들 수 없어요. 잠시 뒤 다시 해 주세요');Profile.page(pg)}});
 pg.querySelector('.ld').onclick=async()=>{const v=pg.querySelector('.lc').value.trim();if(v.replace(/[^A-Za-z0-9]/g,'').length!==12){Bonus.toast('복구 코드 12자리를 넣어 주세요');return}
  if(!confirmBox('이 기기의 코인·스킨 기록이 불러온 기록으로 바뀌어요. 계속할까요?'))return;const j=await Profile.load(v);Bonus.toast(j.data?'✅ 불러왔어요! 반가워요 '+j.nick:(j.msg||'불러오지 못했어요'));pg.dataset.av='';inp.dataset.init='';Profile.page(pg)};
 const dz=pg.querySelector('.dz');dz.hidden=!code;
 pg.querySelector('.fg').onclick=()=>{if(confirmBox('이 기기에서만 복구 코드를 지워요(서버 기록은 남아요). 코드를 적어 두셨나요?')){Profile.forget();Bonus.toast('이 기기에서 코드를 지웠어요')}};
 pg.querySelector('.dl').onclick=async()=>{if(!confirmBox('서버에 저장된 내 프로필을 완전히 지워요. 되돌릴 수 없어요. 계속할까요?'))return;const j=await Profile.del();Bonus.toast(j.ok?'프로필을 지웠어요':(j.msg||'지우지 못했어요'))};
};
function confirmBox(t){return window.confirm(t)}
"""

PROFILE_BODY = """<h1>👤 내 프로필</h1><p class="lead">가입 없이 별명과 아바타를 정하고, <b>복구 코드</b> 하나로 다른 기기에서도 코인·스킨·출석 기록을 이어 써요.</p>
<div class="card" id="profpage"><div class="pv"></div>
<h2>아바타</h2><div class="avs"></div><p class="muted">🔒 아바타는 스킨 상점에서 그 스킨을 사면 열려요.</p>
<h2>별명</h2><input class="nm" maxlength="10" placeholder="예: 냥이왕" autocomplete="off"><p class="nmsg muted"></p><button type="button" class="btn save">💾 저장</button>
<h2>🔑 복구 코드</h2><div class="codebox"></div>
<h2>다른 기기 기록 불러오기</h2><input class="lc" maxlength="16" placeholder="ABCD-EFGH-JKLM" autocomplete="off" autocapitalize="characters"><button type="button" class="btn ghost ld">불러오기</button>
<div class="dz"><h2>관리</h2><button type="button" class="share fg">이 기기에서 코드 지우기</button> <button type="button" class="share dl">서버의 내 프로필 삭제</button></div></div>
<h2>알아 두세요</h2><ul class="list"><li>이메일·전화번호·이름 같은 개인정보는 받지 않아요. 서버에는 별명, 아바타, 코인·스킨·출석 기록과 복구 코드를 알아볼 수 없게 바꾼 값(해시)만 저장돼요.</li><li>복구 코드가 곧 열쇠예요. 잃어버리면 다시 찾을 방법이 없고, 남이 알면 내 기록을 불러갈 수 있어요.</li><li>틀린 코드를 하루 10번 넘게 넣으면 그날은 더 넣을 수 없어요.</li><li>별명은 한글·영문·숫자 2~10자. 욕설, 운영자 사칭 단어는 쓸 수 없어요.</li><li>1년 동안 한 번도 쓰지 않은 프로필은 자동으로 지워져요. 언제든 위 '서버의 내 프로필 삭제'로 직접 지울 수 있어요.</li></ul>"""

PROFILE_CSS = """
nav a.me{display:flex;align-items:center;gap:4px;max-width:150px;border-color:#ff3d7f88}nav a.me i{font-style:normal}nav a.me b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}nav a.me.new{color:#fff;background:#ff3d7f33;border-color:var(--a);box-shadow:0 0 10px #ff3d7f66}
@media (max-width:560px){nav a.me b{display:none}nav a.me.new b{display:inline}nav a.me.new b{font-size:0}nav a.me.new b::after{content:'프로필';font-size:12px}}@media (max-width:420px){nav .hs{display:none}nav{gap:4px}}nav a{white-space:nowrap}@media (max-width:380px){nav a{padding:5px 5px!important;font-size:11.5px!important}.logo{font-size:21px!important}.logo span{font-size:16px!important}header .wrap{gap:6px}nav{gap:3px}}
.preshare{margin:4px 0 14px}.preshare small{margin-left:4px}
.mkp{margin:6px 0 0}.mkp .btn{display:inline-block}
#profpage .pv{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0 0}#profpage .pav{font-size:56px;line-height:1.1}#profpage .pv b{font-size:22px}#profpage .pv small{color:var(--muted)}
#profpage .avs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}#profpage .avs button{font-size:26px;aspect-ratio:1;border-radius:12px;border:2px solid var(--line);background:var(--bg2);cursor:pointer;padding:0}
#profpage .avs button.sel{border-color:var(--y);box-shadow:0 0 12px #ffd23f66}#profpage .avs button:disabled{opacity:.45;cursor:default;font-size:18px}
#profpage input{width:100%;font:inherit;font-size:18px;padding:12px;border-radius:12px;border:2px solid var(--line);background:var(--bg2);color:var(--ink);margin-bottom:6px}
#profpage .code{font-family:var(--px);font-size:18px;letter-spacing:2px;color:var(--y);text-align:center;padding:14px;border:2px dashed var(--y);border-radius:12px;margin:6px 0;word-break:break-all}
#profpage .row{display:flex;gap:8px;justify-content:center}#profpage .btn{border:0;cursor:pointer;font:inherit;font-weight:800}#profpage .ld{margin-top:4px}
"""


def page(cfg, *, path, title, desc, body, script="", noindex=False, jsonld=None, og=None):
    url = cfg["baseUrl"].rstrip("/") + "/" + path
    head = ""
    kkey = (os.environ.get("KAKAO_JS_KEY") or cfg.get("kakaoJsKey", "")).strip()
    kakao = ""
    if re.fullmatch(r"[0-9a-f]{32}", kkey):
        kakao = ('<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" crossorigin="anonymous"></script>'
                 f'<script>try{{Kakao.init("{kkey}")}}catch(e){{}}</script>')
    pub = pub_id(cfg)
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
    ad = ad_slot(cfg)
    body = body.replace("<!--AD-->", ad)
    if 'class="ad" data-m=' in body:
        script += ADFIT_JS
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">{verify}<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{esc(url)}">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{esc(url)}"><meta property="og:site_name" content="{esc(cfg['siteName'])}"><meta property="og:type" content="website"><meta property="og:image" content="{esc(cfg['baseUrl'].rstrip('/'))}/{esc(og or 'og.png')}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="ko_KR"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0c0620">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="alternate" type="application/rss+xml" title="{esc(cfg['siteName'])}" href="/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Press+Start+2P&display=swap"><style>{CSS}{BONUS_CSS}{PROFILE_CSS}{ADMIN_CSS if path == 'admin' else ''}</style>{head}</head><body>
<header><div class="wrap"><a class="logo" href="/"><span>5</span>락실</a><nav><a href="/games">게임</a><a href="/archive">밸런스<span class="hs">게임</span></a><a href="/rank">순위</a><a class="me" href="/profile" aria-label="내 프로필"><i>👤</i><b>프로필 만들기</b></a><a class="att" href="/bonus" aria-label="출석체크, 보유 코인">🪙<b>0</b></a></nav></div></header>
<main class="wrap">{body}</main>
<footer><div class="wrap"><p class="gameover">GAME OVER? CONTINUE ▶</p><a href="/about">소개</a><a href="/contact">문의</a><a href="/privacy">개인정보처리방침</a><p>투표는 익명입니다. 이름·로그인 없이 참여하며, 개인을 알아볼 수 있는 정보는 저장하지 않습니다.</p></div></footer>
<script>{SHARE_JS}{BONUS_JS}{PROFILE_JS}{script}</script>{kakao}</body></html>"""


def qcard(q, n=None, link=True):
    num = f'<div class="no">{esc(n)}</div>' if n else ""
    title = f'{q["a"]} vs {q["b"]}'
    re_btns = "".join(f'<button type="button" data-r="{k}">{e} <span></span></button>' for k, e in EMOJI)
    more = f' <a class="more" href="/q/{q["id"]}">결과 자세히 →</a>' if link else ""
    return f"""<div class="q" data-q="{q['id']}">{num}<div class="vs"><button class="a" type="button">{esc(q['a'])}</button><span class="x">VS</span><button class="b" type="button">{esc(q['b'])}</button></div>
<div class="bar"><i></i></div><div class="pct"><span class="pa"></span><span class="pb"></span></div>
<p class="note">{esc(q['note'])}{more}</p><div class="re">{re_btns}<button class="share" type="button" data-url="/q/{q['id']}" data-t="{esc(title)}">공유</button></div></div>"""


def build(out: Path, upto: date | None = None, stats: dict | None = None, cfg: dict | None = None) -> dict:
    cfg = cfg or json.loads((HERE / "config.json").read_text(encoding="utf-8"))
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
    stats = stats or {}
    asof = today()
    sums = {q["id"]: s for q in qs if (s := summary(q, stats.get(q["id"])))}
    rpt = [s for s in sums.values() if s["t"] >= REPORT_MIN]
    has_report = len(rpt) >= REPORT_NEED

    def write(path, title, desc, body, script="", noindex=False, jsonld=None, og=None):
        (out / f"{path or 'index'}.html").write_text(page(cfg, path=path, title=title, desc=desc, body=body, script=script, noindex=noindex, jsonld=jsonld, og=og), encoding="utf-8")
        if not noindex:
            pages.append(path)

    cards = "".join(qcard(q, f"오늘의 질문 {i + 1}") for i, q in enumerate(todays))
    games = load_games()
    grid = game_grid(games)
    write("", f"{cfg['siteName']} | 오늘의 밸런스게임·틀린그림찾기·미니게임", cfg["description"],
          f"<div class=\"hero\"><p class=\"coin\">INSERT COIN ▶ PRESS START</p><h1><b>5</b>락실</h1><p>{esc(cfg['tagline'])}</p>"
          f"<div class=\"cta\"><a class=\"btn\" href=\"/games/{games[0]['slug']}\">▶ {esc(games[0]['name'])}</a><a class=\"btn ghost\" href=\"#vs\">⚖️ 밸런스게임 투표</a><a class=\"btn ghost\" href=\"#\" data-pre=\"1\" data-u=\"/\" data-t=\"5락실 - 가입 없는 무료 오락실\" data-d=\"매일 새 판 미니게임·밸런스게임, 같이 해 볼래?\">📤 친구에게 공유</a></div>"
          f"<div class=\"ticker\" aria-hidden=\"true\"><div>" + "".join(f"{g.get('icon', '🎮')} {esc(g['name'])}<i>★</i>" for g in games) + "매일 0시 새 판<i>★</i>가입 없이 바로 플레이</div></div></div>"
          f"<div class=\"sec\"><h2>🕹️ 오늘의 기계</h2><span class=\"tag\">SELECT GAME</span></div>{grid}"
          "<!--AD-->"
          f"<div class=\"sec\" id=\"vs\"><h2>⚖️ 오늘의 밸런스게임 <small class=\"muted\">{d.month}월 {d.day}일</small></h2><span class=\"tag\">VS</span></div>{cards}"
          f"<p><a href=\"/archive\">지난 밸런스게임 전체 보기 →</a></p>", VOTE_JS,
          jsonld=[{"@context": "https://schema.org", "@type": "WebSite", "name": cfg["siteName"], "alternateName": "오락실", "url": cfg["baseUrl"].rstrip("/") + "/"}])

    for i, q in enumerate(qs):
        title = f"{q['a']} vs {q['b']} | 밸런스게임"
        nxt = qs[(i + 1) % len(qs)]
        st = stat_html(sums[q["id"]], asof) if q["id"] in sums else ""
        desc = f"밸런스게임: {q['a']} vs {q['b']}. 투표하고 사람들의 선택 비율을 확인하세요. {q['note']}"[:150]
        others = "".join(f'<li><a href="/q/{x["id"]}">{esc(x["a"])} vs {esc(x["b"])}</a></li>' for x in qs if x["id"] != q["id"])
        others = "<ul class=\"list\">" + "".join(others.split("</li>")[:6]) + "</ul>" if others else ""
        write(f"q/{q['id']}", title, desc,
              f"<h1>{esc(q['a'])} vs {esc(q['b'])}</h1><p class=\"lead\">{q['date']} 밸런스게임</p>{qcard(q, link=False)}{st}"
              f"<p class=\"next\"><a class=\"btn\" href=\"/q/{nxt['id']}\">다음 밸런스게임 ▶</a></p><!--AD--><h2>다른 질문</h2>{others}<h2>오락실 게임</h2>{grid}", VOTE_JS,
              jsonld=[crumbs(cfg, [("밸런스게임", "archive"), (f"{q['a']} vs {q['b']}", f"q/{q['id']}")])],
              og=f"og/q/{q['id']}.png" if (HERE / "static" / "og" / "q" / f"{q['id']}.png").exists() else None)

    rows = "".join(f'<li>{q["date"][5:].replace("-", "/")} · <a href="/q/{q["id"]}">{esc(q["a"])} vs {esc(q["b"])}</a></li>' for q in qs)
    write("archive", f"밸런스게임 질문 모음 | {cfg['siteName']}", "5락실에 올라온 밸런스게임 질문 전체. 지금 투표해도 결과에 반영됩니다.",
          f"<h1>밸런스게임 모음</h1><p class=\"lead\">하나만 고르면 사람들의 선택 비율이 보여요. 총 {len(qs)}개.</p>{'<p><a href="/report">📊 밸런스게임 결과 리포트 보기 →</a></p>' if has_report else ''}<ul class=\"list\">{rows}</ul><!--AD-->")

    write("games", f"무료 미니게임 | {cfg['siteName']}", "5락실의 무료 미니게임. 틀린그림찾기, 별똥별 피하기, 딱 멈춰, 초성 퀴즈, 반응속도. 가입 없이 바로 하고 매일 도전 순위에 이름을 올려 보세요.",
          f"<h1>오락실 게임</h1><p class=\"lead\">가입 없이 바로. 🏆 표시가 있는 게임은 매일 모두 같은 판으로 도전 순위를 겨뤄요.</p>{grid}")

    inject = {
        "WORDS": json.loads((HERE / "data" / "chosung_words.json").read_text(encoding="utf-8")),
        "POOL": [{"id": q["id"], "a": q["a"], "b": q["b"]} for q in qs if q["date"] < latest][:30],
    }
    for g in games:
        pre = "".join(f"const {k}={json.dumps(inject[k], ensure_ascii=False)};" for k in g.get("inject", []))
        body = g["body"]
        # 시작 전 공유(BK 11/13): 하기 전에도 친구에게 보낼 수 있게. 선택 사항, 공유해야 시작되는 것 아님.
        pshare = (f'<p class="preshare"><button type="button" class="share" data-pre="1" data-t="{esc("5락실 " + g["name"])}" '
               f'data-d="{esc(g["short"] + " · 가입 없이 무료, 같이 해 볼래?")}">📤 친구에게 이 게임 공유</button> <small class="muted">첫 공유 🪙+2</small></p>')
        m = re.search(r'<h1>.*?</h1>(\s*<p class="lead">.*?</p>)?', body, re.S)
        body = body[:m.end()] + pshare + body[m.end():] if m else pshare + body
        body += "<!--AD-->"  # 규칙·순위 아래(조작 버튼과 멀리)
        script = pre + COMMON_JS + g["js"]
        if g.get("ranked"):
            body = body.replace("<!--RANK-->", RANK_HTML)
            script += RANK_JS
        write(f"games/{g['slug']}", f"{g['title']} | {cfg['siteName']}", g["description"], body, script,
              jsonld=[{"@context": "https://schema.org", "@type": "VideoGame", "name": g["name"], "description": g["description"], "url": f"{cfg['baseUrl'].rstrip('/')}/games/{g['slug']}",
                       "gamePlatform": "Web browser", "applicationCategory": "Game", "operatingSystem": "All", "inLanguage": "ko", "isAccessibleForFree": True,
                       "offers": {"@type": "Offer", "price": "0", "priceCurrency": "KRW"}},
                      crumbs(cfg, [("게임", "games"), (g["name"], f"games/{g['slug']}")])],
              og=g.get("og") if g.get("og") and (HERE / "static" / g["og"]).exists() else None)

    ranked = [g for g in games if g.get("ranked")]
    tabs = "".join(f'<button class="share" type="button" data-g="{g["slug"]}">{esc(g["name"])}</button>' for g in ranked)
    write("rank", f"오늘의 도전 순위 | {cfg['siteName']}", "5락실 오늘의 도전 순위. 매일 모두 같은 판으로 겨루는 미니게임 기록 TOP 10.",
          f"<h1>🏆 오늘의 도전 순위</h1><p class=\"lead\">매일 0시(한국 시간)에 새 판이 열리고 순위가 초기화돼요. 이름은 자동으로 붙는 별명이라 개인 정보가 없습니다.</p><div class=\"re\">{tabs}</div><div class=\"card\"><ol id=\"rk\" class=\"list\"></ol></div>",
          COMMON_JS + RANK_PAGE_JS)

    write("profile", f"내 프로필 | {cfg['siteName']}", "5락실 프로필. 가입 없이 별명·아바타를 정하고 복구 코드로 다른 기기에서도 코인·스킨을 이어 써요.",
          PROFILE_BODY, COMMON_JS + PROFILE_PAGE_JS, noindex=True)
    write("bonus", f"출석체크·스킨 상점 | {cfg['siteName']}", "5락실 출석체크. 하루 한 번 출석하면 코인을 받아 이어하기나 스킨(캐릭터 겉모습)에 써요. 게임은 모두 무료.",
          BONUS_BODY, noindex=True)
    write("admin", f"관리자 | {cfg['siteName']}", "관리자 전용", ADMIN_BODY, ADMIN_JS, noindex=True)

    if has_report:
        def li(x, extra=""):
            q = x["q"]
            return f'<li><a href="/q/{q["id"]}">{esc(q["a"])} vs {esc(q["b"])}</a> · {x["pa"]}% : {x["pb"]}% ({x["t"]:,}표){extra}</li>'
        close = sorted(rpt, key=lambda x: (x["gap"], -x["t"]))[:5]
        far = sorted(rpt, key=lambda x: (-x["gap"], -x["t"]))[:5]
        hot = sorted(rpt, key=lambda x: -x["t"])[:5]
        total = sum(x["t"] for x in sums.values())
        c0, f0 = close[0], far[0]
        parts = [f"<h1>📊 밸런스게임 결과 리포트</h1><p class=\"lead\">{asof.month}월 {asof.day}일 기준, {cfg['siteName']}에 올라온 밸런스게임 {len(qs)}개에 모두 {total:,}표가 모였어요. "
                 f"투표 {REPORT_MIN}표 이상인 질문 {len(rpt)}개만 골라 실제 숫자 그대로 정리했어요(매일 자동 갱신).</p>",
                 f"<div class=\"stat\">가장 팽팽했던 질문은 ‘{esc(c0['q']['a'])} vs {esc(c0['q']['b'])}’로 {c0['pa']}% 대 {c0['pb']}%였고, "
                 f"가장 한쪽으로 쏠린 질문은 ‘{esc(f0['q']['a'])} vs {esc(f0['q']['b'])}’로 {f0['pa']}% 대 {f0['pb']}%였어요.</div>",
                 "<h2>⚖️ 가장 팽팽했던 질문</h2><ol class=\"list\">" + "".join(li(x) for x in close) + "</ol>", "<!--AD-->",
                 "<h2>🏳️ 한쪽으로 쏠린 질문</h2><ol class=\"list\">" + "".join(li(x) for x in far) + "</ol>",
                 "<h2>🔥 가장 많이 투표한 질문</h2><ol class=\"list\">" + "".join(li(x) for x in hot) + "</ol>"]
        for k, e in EMOJI:
            top = max(rpt, key=lambda x: int(stats[x["q"]["id"]].get(k, 0)))
            n = int(stats[top["q"]["id"]].get(k, 0))
            if n >= 3:
                parts.append(f"<p>{e} 반응을 가장 많이 받은 질문: <a href=\"/q/{top['q']['id']}\">{esc(top['q']['a'])} vs {esc(top['q']['b'])}</a> ({n:,}번)</p>")
        parts.append("<p class=\"muted\">같은 사람이 같은 질문에 하루 한 번만 투표할 수 있어요. 숫자를 사람이 고치지 않습니다.</p><p><a href=\"/archive\">밸런스게임 전체 보기 →</a></p>")
        write("report", f"밸런스게임 결과 리포트 | {cfg['siteName']}", f"밸런스게임 실제 투표 결과 정리: 가장 팽팽했던 질문, 한쪽으로 쏠린 질문, 가장 많이 투표한 질문. {asof.month}월 {asof.day}일 기준 자동 갱신.", "".join(parts))

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
          "<h2>3. 광고와 쿠키</h2><p>이 사이트는 Google 애드센스, 카카오 애드핏 등 제3자 광고를 게재할 수 있으며, 광고 영역에는 ‘광고’라고 표시합니다. Google을 포함한 제3자 공급업체는 쿠키를 사용하여 이용자의 이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 게재합니다. "
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
    shutil.copytree(HERE / "static", out, dirs_exist_ok=True)
    (out / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>', encoding="utf-8")
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
    (out / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0c0620"/><rect x="2" y="2" width="28" height="28" rx="7" fill="none" stroke="#ff3d7f" stroke-width="2"/><path d="M10 8h12v4h-8v3h6l2 2v6l-2 2H10v-4h8v-3h-8z" fill="#ffd23f"/></svg>', encoding="utf-8")
    if pub := cfg.get("adsensePublisherId", "").strip():
        (out / "ads.txt").write_text(f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    return {"questions": len(qs), "today": latest, "pages": len(pages)}


if __name__ == "__main__":
    _cfg = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    _ids = [q["id"] for q in load_questions(_cfg)]
    _stats = {} if os.environ.get("PG_NO_STATS") else fetch_stats(_cfg["baseUrl"], _ids)
    r = build(Path(sys.argv[1] if len(sys.argv) > 1 else "dist"), stats=_stats)
    print(f"놀이터: 질문 {r['questions']}개, 오늘 {r['today']}, 페이지 {r['pages']}개")
