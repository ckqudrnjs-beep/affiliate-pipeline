"""오늘의 생활 시세 + 하루 1문제 '얼마게?' (2026-11-14, BK 선택 A+B, plan/RETENTION.md).

매일 아침(daily.yml, 05:50 KST) 공공 API로 기름값·환율·장바구니 시세를 data/daily/YYYY-MM-DD.json 에 저장하고,
사이트 빌드가 홈 맨 위 '오늘의 생활 시세'와 '오늘의 얼마게' 퀴즈(홈 + quiz.html)를 만든다.

- 수집 코드는 주간 리포트(report.py)와 같은 출처·키를 쓴다(OPINET_KEY, ECOS_KEY, KAMIS_KEY+KAMIS_ID). 키가 없는 출처는 빠진다.
- 판단 문장은 숫자 규칙으로만 만든다(생성형 문장 없음).
- 퀴즈 문제는 사이트의 계산 결과(레시피 원가·가전 전기요금·직구 면세 한도)와 그날 시세로만 만든다. 지어낸 숫자 없음.
- 출석·연속·배지·예측 기록은 방문자 브라우저(localStorage)에만 저장한다. 서버로 보내는 것 없음, 개인정보 없음.
- 보상은 배지(꾸미기)뿐. 돈·광고 클릭과 연결하지 않는다.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import html
import json
import os
import pathlib
import sys
import urllib.parse

from . import report as R
from . import questions as Q
from . import recipes as RC

KST = dt.timezone(dt.timedelta(hours=9))
OUT = pathlib.Path("data/daily")
WEEK = "월화수목금토일"
# 장바구니: KAMIS 소매 품목 중 자주 사는 것만 (이름에 포함되면)
BASKET = ["쌀", "배추", "무", "양파", "대파", "감자", "달걀", "계란", "돼지고기", "닭고기", "사과", "귤", "우유", "두부", "애호박"]
SIDO_DEFAULT = "서울"


# ---------- 수집 ----------
def parse_fuel(avg: dict, sido: dict[str, dict], recent: dict) -> dict | None:
    out = {}
    for row in avg.get("RESULT", {}).get("OIL", []):
        code = row.get("PRODCD")
        if code in R.FUEL and R.num(row.get("PRICE")):
            out[code] = {"name": R.FUEL[code], "price": round(R.num(row["PRICE"]), 1), "diff": round(R.num(row.get("DIFF")) or 0.0, 1)}
    if not out:
        return None
    for code, js in sido.items():
        if code not in out:
            continue
        rows = {}
        for r in js.get("RESULT", {}).get("OIL", []):
            nm, p = (r.get("SIDONM") or "").strip(), R.num(r.get("PRICE"))
            if nm and p and r.get("SIDOCD") not in (None, "", "00"):
                rows[nm] = [round(p, 1), round(R.num(r.get("DIFF")) or 0.0, 1)]
        if rows:
            out[code]["sido"] = rows
    week: dict[str, list] = {}
    for r in recent.get("RESULT", {}).get("OIL", []):
        if r.get("PRODCD") in out and R.num(r.get("PRICE")):
            week.setdefault(r["PRODCD"], []).append((r.get("DATE", ""), R.num(r["PRICE"])))
    for code, pts in week.items():
        pts.sort()
        if len(pts) >= 2:
            out[code]["week"] = round(pts[-1][1] - pts[0][1], 1)
    return out


def fetch_fuel(key: str) -> dict | None:
    base = "https://www.opinet.co.kr/api/"
    q = lambda name, **kw: R.get_json(base + name + "?" + urllib.parse.urlencode({"out": "json", "code": key, **kw}))
    return parse_fuel(q("avgAllPrice.do"), {c: q("avgSidoPrice.do", prodcd=c) for c in R.FUEL}, q("avgRecentPrice.do"))


def parse_fx(js: dict) -> dict | None:
    rows = js.get("StatisticSearch", {}).get("row", [])
    pts = sorted((r["TIME"], R.num(r.get("DATA_VALUE"))) for r in rows if r.get("TIME") and R.num(r.get("DATA_VALUE")))
    if len(pts) < 10:
        return None
    vals = [v for _, v in pts]
    avg = sum(vals[-20:]) / len(vals[-20:])
    return {"date": pts[-1][0], "usd": round(vals[-1], 1), "diff": round(vals[-1] - vals[-2], 1),
            "avg4w": round(avg, 1), "vsAvg": round((vals[-1] - avg) / avg * 100, 1)}


def parse_grocery(js: dict) -> list[dict] | None:
    items, seen = [], set()
    for r in js.get("price", []) if isinstance(js.get("price"), list) else []:
        if str(r.get("product_cls_code", "01")) != "01":
            continue
        name = (r.get("productName") or r.get("item_name") or "").strip()
        if not any(k in name for k in BASKET) or name in seen:
            continue
        now, day, month = R.num(r.get("dpr1")), R.num(r.get("dpr2")), R.num(r.get("dpr3"))
        if not now:
            continue
        seen.add(name)
        items.append({"name": name, "unit": (r.get("unit") or "").strip(), "price": round(now),
                      "d": round((now - day) / day * 100, 1) if day else None,
                      "m": round((now - month) / month * 100, 1) if month else None})
    return items or None


def collect(today: dt.date) -> dict | None:
    env = os.environ.get
    data: dict = {"date": today.isoformat()}
    jobs = [("fuel", env("OPINET_KEY") and (lambda: fetch_fuel(env("OPINET_KEY")))),
            ("fx", env("ECOS_KEY") and (lambda: parse_fx(R.get_json(
                f"https://ecos.bok.or.kr/api/StatisticSearch/{urllib.parse.quote(env('ECOS_KEY'))}/json/kr/1/100/731Y001/D/"
                f"{(today - dt.timedelta(days=45)):%Y%m%d}/{today:%Y%m%d}/0000001")))),
            ("grocery", env("KAMIS_KEY") and env("KAMIS_ID") and (lambda: parse_grocery(R.get_json(
                "https://www.kamis.or.kr/service/price/xml.do?" + urllib.parse.urlencode(
                    {"action": "dailySalesList", "p_cert_key": env("KAMIS_KEY"), "p_cert_id": env("KAMIS_ID"), "p_returntype": "json"})))))]
    for name, fn in jobs:
        if not fn:
            print(f"{name}: 키 없음, 건너뜀")
            continue
        try:
            v = fn()
        except Exception as ex:  # 한 출처 실패는 그 칸만 뺀다
            print(f"{name}: 실패 {type(ex).__name__}: {ex}", file=sys.stderr)
            v = None
        if v:
            data[name] = v
        print(f"{name}: {'OK' if v else '데이터 없음'}")
    return data if len(data) > 1 else None


def load_all(root: pathlib.Path = OUT, limit: int = 30) -> list[dict]:
    """최근 것이 앞."""
    files = sorted(root.glob("*.json"), reverse=True)[:limit] if root.exists() else []
    return [json.loads(f.read_text(encoding="utf-8")) for f in files]


# ---------- 판단 문장 (규칙) ----------
def fuel_line(f: dict) -> str:
    g = f.get("B027")
    if not g:
        return ""
    w = g.get("week")
    if w is None or abs(w) < 5:
        return "기름값은 일주일째 거의 그대로예요. 아무 때나 넣어도 차이가 작아요."
    if w > 0:
        return f"기름값이 일주일 새 {w:,.0f}원 올랐어요. 오르는 중엔 미루지 말고 필요할 때 넣으세요."
    return f"기름값이 일주일 새 {-w:,.0f}원 내렸어요. 급하지 않으면 며칠 기다려도 돼요."


def fx_line(x: dict) -> str:
    v = x["vsAvg"]
    if v >= 1:
        return f"환율이 4주 평균보다 {v:.1f}% 높아요. 큰 직구 결제는 조금 미뤄도 돼요."
    if v <= -1:
        return f"환율이 4주 평균보다 {-v:.1f}% 낮아요. 직구 결제하기 괜찮은 날이에요."
    return "환율은 평소 수준이에요. 직구 타이밍을 따질 필요는 크지 않아요."


def josa(word: str, pair: str) -> str:
    """받침에 맞는 조사: pair='이가' / '은는'."""
    c = word[-1] if word else "가"
    has = "가" <= c <= "힣" and (ord(c) - 0xAC00) % 28 > 0
    return word + (pair[0] if has else pair[1])


def grocery_line(items: list[dict]) -> str:
    m = [i for i in items if i.get("m") is not None]
    if len(m) < 2:
        return ""
    up, down = max(m, key=lambda i: i["m"]), min(m, key=lambda i: i["m"])
    parts = []
    if up["m"] >= 3:
        parts.append(f"한 달 새 {josa(up['name'], '이가')} {up['m']:.0f}% 올랐어요")
    if down["m"] <= -3:
        parts.append(f"{josa(down['name'], '은는')} {-down['m']:.0f}% 내렸어요")
    return ". ".join(parts) + "." if parts else "장바구니 물가는 한 달 전과 비슷해요."


def date_label(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return f"{d.month}월 {d.day}일 ({WEEK[d.weekday()]})"


def sign(v: float, unit: str = "원") -> str:
    if v is None:
        return ""
    if abs(v) < 0.05:
        return '<span class="flat">어제와 같음</span>'
    cls = "up" if v > 0 else "down"
    return f'<span class="{cls}">{"▲" if v > 0 else "▼"} {abs(v):,.1f}{unit}</span>'.replace(".0" + unit, unit)


# ---------- 퀴즈 ----------
def nice(v: float) -> int:
    step = 1000 if v >= 100000 else 100 if v >= 5000 else 10
    return int(round(v / step) * step)


def options(v: float, seed: int, near: bool = False) -> tuple[list[int], int]:
    """정답 v 와 오답 3개. near=True 는 시세처럼 ±10% 안의 보기."""
    pool = [0.9, 0.95, 1.05, 1.1, 0.85, 1.15] if near else [0.45, 0.6, 0.75, 1.35, 1.7, 2.4]
    ans = nice(v)
    picks: list[int] = []
    for i in range(len(pool)):
        m = pool[(seed + i * 5) % len(pool)]
        x = nice(v * m)
        if x != ans and x not in picks and x > 0:
            picks.append(x)
        if len(picks) == 3:
            break
    opts = sorted(picks + [ans])
    return opts, opts.index(ans)


def won(n: float) -> str:
    return f"{int(round(n)):,}원"


def tier_note(a: float, b: float) -> str:
    """a→b kWh 구간에 걸리는 누진 단가 설명."""
    rates = [(200, "1구간 120원"), (400, "2구간 214.6원"), (1e9, "3구간 307.3원")]
    hit = [n for i, (lim, n) in enumerate(rates) if b > (0 if i == 0 else rates[i - 1][0]) and a < lim]
    return "누진 " + "·".join(hit) + "/kWh 적용"


def power_steps(w: float, hrs: float, base: float = 250) -> list[str]:
    kwh = w * hrs * 30 / 1000
    a, b = Q.bill(base), Q.bill(base + kwh)
    return [f"{w:,g}W × 하루 {hrs:g}시간 × 30일 ÷ 1,000 = {kwh:,.1f}kWh 더 씀".replace(".0kWh", "kWh"),
            f"평소 {base:g}kWh 요금 {won(a)} → {base + kwh:,.0f}kWh 요금 {won(b)} ({tier_note(base, base + kwh)})",
            f"늘어난 요금 = {won(b)} − {won(a)} = {won(b - a)}",
            "요금엔 기본요금·기후환경·연료비 요금·부가세·전력기금이 포함돼요(한전 주택용 저압 기준)."]


def bank() -> list[dict]:
    """사이트 계산 결과로만 만든 문제. id 가 바뀌지 않게 slug 를 쓴다."""
    out = []
    pantry = RC.load_pantry()
    for r in RC.load(pantry=pantry):
        out.append({"id": f"rc-{r['slug']}", "q": f"{r['name']} 1인분, 집에서 직접 만들면 재료비는 대략 얼마일까요?",
                    "v": r["total"], "link": f"recipe/{r['slug']}.html", "more": "1인분 원가 레시피 보기",
                    "why": f"재료비는 약 {won(r['total'])}이에요. 배달(배달비 포함 약 {won(r['delivery'])})보다 약 {won(r['save'])} 아껴요."})
        rows = sorted(r["rows"], key=lambda x: -x["won"])
        st = [f"{x['label']}: {x['pantry']['pack']} {won(x['pantry']['packPrice'])} ÷ {x['pantry']['packAmount']:,g}{x['pantry']['unit']} × {x['use']:g} = {won(x['won'])}"
              for x in rows[:5]]
        rest = rows[5:]
        if rest:
            st.append(f"나머지 {len(rest)}가지({', '.join(x['name'] for x in rest)}) = {won(sum(x['won'] for x in rest))}")
        st.append(f"기본양념(소금·후추 등) = {won(RC.BASICS)}")
        st.append(f"합계 = {won(r['total'])} (재료값은 {r['priceDate']} 마트·온라인 흔한 가격 기준)")
        out[-1]["steps"] = st
        out.append({"id": f"rs-{r['slug']}", "q": f"{r['name']}, 배달(배달비 포함) 대신 집에서 1인분 해 먹으면 한 번에 얼마쯤 아낄까요?",
                    "v": r["save"], "link": f"recipe/{r['slug']}.html", "more": "1인분 원가 레시피 보기",
                    "why": f"배달 약 {won(r['delivery'])}, 집밥 재료비 약 {won(r['total'])}이라 약 {won(r['save'])} 아껴요. 주 2번이면 한 달 약 {won(r['save'] * 8)}이에요.",
                    "steps": [f"배달: 메뉴 대략 {won(r['delivery'] - RC.DELIVERY_FEE)} + 배달비 {won(RC.DELIVERY_FEE)} = {won(r['delivery'])}",
                              f"집밥: 1인분 재료비 {won(r['total'])} (레시피 페이지에 재료별 계산)",
                              f"아끼는 돈 = {won(r['delivery'])} − {won(r['total'])} = {won(r['save'])}"]})
    for q in Q.load():
        p = q["params"]
        if q["kind"] == "power":
            kwh, c = Q.add_cost(p["w"], p["h"], 250)
            out.append({"id": f"q-{q['slug']}", "q": f"{q['name']}({p['w']:,}W)를 하루 {p['h']:g}시간씩 한 달 쓰면, 전기요금은 얼마나 늘까요? (평소 250kWh 쓰는 집)",
                        "v": c, "link": f"q/{q['slug']}.html", "more": "우리 집 숫자로 계산해 보기",
                        "why": f"한 달 {kwh:.0f}kWh를 더 써서 약 {won(c)} 늘어요. 누진 구간에 걸리면 더 커져요.",
                        "steps": power_steps(p["w"], p["h"])})
        elif q["kind"] == "standby":
            w = p["a"] + p.get("b", 0) + p.get("c", 0)
            kwh = w * p["off"] * 30 / 1000
            y = (Q.bill(300) - Q.bill(300 - kwh)) * 12
            out.append({"id": f"q-{q['slug']}", "q": f"{q['name']}를 꺼 두지 않고 꽂아만 두면(대기전력 {w:g}W), 1년에 전기요금이 얼마나 샐까요?",
                        "v": y, "link": f"q/{q['slug']}.html", "more": "대기전력 계산해 보기",
                        "why": f"평소 300kWh 쓰는 집 기준 1년 약 {won(y)}이에요. 멀티탭 스위치 하나로 막을 수 있어요.",
                        "steps": [f"{w:g}W × 꺼 둔 {p['off']:g}시간 × 30일 ÷ 1,000 = 한 달 {kwh:,.1f}kWh",
                                  f"300kWh 쓰는 집에서 {kwh:,.1f}kWh 만큼의 요금 = 한 달 {won(y // 12)} ({tier_note(300 - kwh, 300)})",
                                  f"× 12개월 = {won(y)}"]})
        elif q["kind"] == "ali":
            lim = 150 * p["fx"]
            out.append({"id": f"q-{q['slug']}", "q": f"환율이 {p['fx']:,}원일 때, 알리 직구 면세 한도 150달러는 원화로 얼마일까요?",
                        "v": lim, "link": f"q/{q['slug']}.html", "more": "면세 한도 계산해 보기",
                        "why": f"약 {won(lim)}이에요. 넘으면 관세와 부가세가 함께 붙어요.",
                        "steps": [f"면세 한도 150달러 × 환율 {p['fx']:,}원 = {won(lim)}",
                                  "기준은 물건값+배송비(과세가격). 같은 날 같은 나라에서 산 건 합쳐서 볼 수 있어요.",
                                  f"넘으면 관세 {p['duty']:g}%와 부가세 10%가 물건값 전체에 붙어요."]})
    return out


def live_questions(d: dict) -> list[dict]:
    out = []
    g = (d.get("fuel") or {}).get("B027")
    if g:
        out.append({"id": f"fuel-{d['date']}", "q": f"오늘({date_label(d['date'])}) 전국 평균 휘발유 1리터는 얼마일까요?",
                    "v": g["price"], "near": True, "link": "index.html#today", "more": "오늘의 생활 시세 보기",
                    "why": f"전국 평균 {g['price']:,.0f}원이에요. 50리터 가득이면 약 {won(g['price'] * 50)}이에요.",
                    "steps": [f"오피넷(한국석유공사) 전국 주유소 휘발유 평균 판매가 {g['price']:,.1f}원",
                              f"어제보다 {abs(g.get('diff') or 0):,.1f}원 {'올랐어요' if (g.get('diff') or 0) > 0 else '내렸어요' if (g.get('diff') or 0) < 0 else '같아요'}",
                              f"50L 가득 = {g['price']:,.1f}원 × 50 = {won(g['price'] * 50)}"]})
    x = d.get("fx")
    if x:
        out.append({"id": f"fx-{d['date']}", "q": "오늘 1달러는 우리 돈 몇 원일까요? (한국은행 매매기준율)",
                    "v": x["usd"], "near": True, "link": "index.html#today", "more": "오늘의 생활 시세 보기",
                    "why": f"{x['usd']:,.1f}원이에요. 100달러 직구면 약 {won(x['usd'] * 100)}이에요.",
                    "steps": [f"한국은행 원/달러 매매기준율 {x['usd']:,.1f}원 ({x['date'][4:6].lstrip('0')}월 {x['date'][6:].lstrip('0')}일 고시)",
                              f"4주 평균 {x['avg4w']:,.1f}원보다 {abs(x['vsAvg']):.1f}% {'높아요' if x['vsAvg'] > 0 else '낮아요'}",
                              f"카드 결제 환율은 여기에 카드사 수수료가 붙어 조금 더 비싸요."]})
    return out


def h(s: str) -> int:
    return int(hashlib.sha1(s.encode()).hexdigest()[:8], 16)


def schedule(start: dt.date, days: int, latest: dict | None) -> dict[str, dict]:
    """날짜별 문제. 같은 날짜는 언제 빌드해도 같은 문제(시세 문제는 그날 데이터가 있을 때만).
    3일에 한 번은 그날 시세 문제, 나머지는 계산 문제를 겹치지 않게 돌린다."""
    b = sorted(bank(), key=lambda x: h(x["id"]))
    live = {x["id"].split("-")[0]: x for x in live_questions(latest)} if latest else {}
    out = {}
    for i in range(days):
        d = start + dt.timedelta(days=i)
        n = d.toordinal()
        q = None
        if n % 3 == 0 and latest and latest["date"] == d.isoformat():
            q = live.get("fuel" if n % 2 else "fx") or next(iter(live.values()), None)
        if not q and b:
            q = b[n % len(b)]
        if not q:
            continue
        opts, ans = options(q["v"], h(q["id"] + d.isoformat()), q.get("near", False))
        out[d.isoformat()] = {"id": q["id"], "q": q["q"], "o": [f"{x:,}원" for x in opts], "a": ans,
                              "why": q["why"], "steps": q.get("steps", []), "link": q["link"], "more": q["more"]}
    return out


def fuel_history(days: list[dict]) -> dict[str, float]:
    return {d["date"]: d["fuel"]["B027"]["price"] for d in days if (d.get("fuel") or {}).get("B027")}


# ---------- 화면 ----------
CSS = """
#today .twocol2{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px}
@media (max-width:860px){#today .twocol2{grid-template-columns:minmax(0,1fr)}#today .quiz{order:-1}}
.hero.slim .wrap{padding-block:40px 8px}.hero.slim h1{font-size:clamp(28px,4.4vw,44px)}.hero.slim p{font-size:16px;margin-top:14px}
@media (max-width:640px){.hero.slim .wrap{padding-block:28px 0}}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.tile{background:var(--card);padding:14px 16px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tile .k{font-size:13px;color:var(--muted)}.tile .v{font:600 22px/1.3 var(--body);font-variant-numeric:tabular-nums}
.tile .v small{font-size:13px;font-weight:500;color:var(--muted)}
.tile select{font:inherit;font-size:13px;color:var(--muted);background:none;border:0;padding:0;max-width:100%}
.up{color:#b0462a;font-size:13px;font-weight:600}.down{color:var(--green);font-size:13px;font-weight:600}.flat{color:var(--muted);font-size:13px}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .up{color:#e39a7f}}
:root[data-theme="dark"] .up{color:#e39a7f}
.lines{margin:14px 0 0;padding:0;list-style:none}.lines li{padding:8px 0 8px 18px;border-top:1px solid var(--line);position:relative;font-size:15px}
.lines li::before{content:"";position:absolute;left:2px;top:17px;width:6px;height:6px;background:var(--green);border-radius:50%}
.basket{font-size:14px;color:var(--muted);margin:10px 0 0}
.quiz{border:1px solid var(--ink);background:var(--card);padding:18px 20px}
.quiz .qh{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.quiz .qq{font:500 20px/1.45 var(--display);margin:10px 0 14px}
.quiz .opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.quiz .opts button{font:600 16px/1.3 var(--body);font-variant-numeric:tabular-nums;padding:14px 8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;min-height:48px}
.quiz .opts button:hover:not(:disabled){border-color:var(--ink)}
.quiz .opts button.ok{background:var(--green);color:var(--coin-ink);border-color:var(--green)}
.quiz .opts button.no{text-decoration:line-through;color:var(--muted)}
.quiz .res{margin-top:14px;font-size:15px}.quiz .res b{font-size:17px}
.quiz .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.quiz .acts a,.quiz .acts button{font:600 14px var(--body);padding:10px 14px;border:1px solid var(--ink);background:none;color:var(--ink);text-decoration:none;cursor:pointer}
.steps{margin-top:12px;background:var(--bg);border:1px solid var(--line);padding:12px 14px;font-size:14px;font-variant-numeric:tabular-nums}
.steps ol{margin:6px 0 4px;padding-left:20px}.steps li{padding:3px 0}
.stamps{display:flex;gap:6px;margin-top:14px;flex-wrap:wrap}
.stamps span{width:34px;height:34px;border-radius:50%;border:1px dashed var(--line);display:grid;place-items:center;font-size:11px;color:var(--muted)}
.stamps span.on{border:1px solid var(--green);background:var(--greenbg);color:var(--green);font-weight:600}
.stamps span.today{outline:2px solid var(--ink);outline-offset:1px}
.streak{font-size:14px;margin-top:10px}.streak b{color:var(--green)}
.pred{margin-top:14px;border-top:1px solid var(--line);padding-top:12px;font-size:15px}
.pred .pb{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.pred .pb button{font:600 14px var(--body);padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}
.pred .pb button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}.badges span{font-size:13px;padding:4px 10px;border:1px solid var(--line);color:var(--muted)}
.badges span.on{border-color:var(--green);color:var(--green);font-weight:600}
"""

QUIZ_JS = r"""(function(){
var D=window.D3C;if(!D)return;var box=document.getElementById('quizbox');if(!box)return;
var K='d3c_daily',S;try{S=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){S={}}
S.ans=S.ans||{};S.pred=S.pred||{};
function save(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}
function kst(off){var d=new Date(Date.now()+9*3600e3+(off||0)*864e5);return d.toISOString().slice(0,10)}
var today=kst(0),keys=Object.keys(D.quiz).sort(),day=D.quiz[today]?today:keys.filter(function(k){return k<=today}).pop()||keys[0],Q=D.quiz[day];
function streak(){var n=0;for(var i=0;;i++){var k=kst(-i);if(S.ans[k])n++;else if(i>0||n>0)break;else continue;if(i>400)break}return n}
var BADGES=[[3,'알뜰 새싹'],[7,'동전 줍는 조카'],[14,'저금통 지기'],[30,'살림 고수'],[100,'삼촌 인정']];
function stamps(){var h='';for(var i=6;i>=0;i--){var k=kst(-i),a=S.ans[k];h+='<span class="'+(a?'on ':'')+(i===0?'today':'')+'" title="'+k+'">'+(a?(a.ok?'⭕':'✔'):(+k.slice(8)))+'</span>'}return h}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function render(){var a=S.ans[day],st=streak();S.best=Math.max(S.best||0,st);save();
var total=Object.keys(S.ans).length,ok=Object.keys(S.ans).filter(function(k){return S.ans[k].ok}).length;
var h='<div class="qh"><span>오늘의 얼마게 · '+(+day.slice(5,7))+'월 '+(+day.slice(8))+'일</span><span>'+(st?'🔥 '+st+'일 연속':'')+'</span></div>';
h+='<p class="qq">'+esc(Q.q)+'</p><div class="opts">';
Q.o.forEach(function(o,i){var c='';if(a){if(i===Q.a)c='ok';else if(i===a.pick)c='no'}h+='<button type="button" data-i="'+i+'" class="'+c+'"'+(a?' disabled':'')+'>'+esc(o)+'</button>'});
h+='</div>';
if(a){h+='<div class="res" aria-live="polite"><b>'+(a.ok?'⭕ 정답이에요!':'❌ 아쉬워요. 정답은 '+esc(Q.o[Q.a]))+'</b><br>'+esc(Q.why)+'</div>';
if(Q.steps&&Q.steps.length)h+='<div class="steps"><b>왜 이 답일까? 삼촌의 계산</b><ol>'+Q.steps.map(function(x){return'<li>'+esc(x)+'</li>'}).join('')+'</ol><span class="small">보기는 끝자리를 반올림해 보여 드려요.</span></div>';
h+='<div class="acts"><a href="'+D.root+Q.link+'">'+esc(Q.more)+' →</a><button type="button" id="qshare">결과 공유</button></div>';
h+='<div class="streak">출석 도장 <b>'+total+'개</b> · 정답 '+ok+'개 · 최고 연속 '+S.best+'일 · 새 문제는 매일 0시</div>'}
else h+='<div class="streak">문제를 풀면 오늘 출석 도장이 찍혀요.</div>';
h+='<div class="stamps" aria-label="최근 7일 출석">'+stamps()+'</div>';
h+='<div class="badges">'+BADGES.map(function(b){return'<span class="'+(S.best>=b[0]?'on':'')+'">'+(S.best>=b[0]?'🏅 ':'')+b[1]+' · '+b[0]+'일</span>'}).join('')+'</div>';
var P=D.fuel,pk=Object.keys(P||{}).sort(),last=pk[pk.length-1];
if(last){var past=Object.keys(S.pred).filter(function(k){return k<last&&!S.pred[k].done}).sort();
var msg='';past.forEach(function(k){var nx=pk.filter(function(x){return x>k})[0];if(!nx||P[k]==null)return;var d=P[nx]-P[k],r=Math.abs(d)<1?'same':d>0?'up':'down';
S.pred[k].done=1;S.pred[k].hit=(S.pred[k].p===r);msg='어제 예측 '+(S.pred[k].hit?'⭕ 적중!':'❌ 빗나감')+' (휘발유 '+(Math.abs(d)<1?'거의 그대로':(d>0?'▲ ':'▼ ')+Math.abs(d).toFixed(1)+'원')+')'});save();
var hits=Object.keys(S.pred).filter(function(k){return S.pred[k].hit}).length;
var my=S.pred[last],lab={up:'오른다',same:'비슷',down:'내린다'};
h+='<div class="pred">'+(msg?'<b>'+msg+'</b><br>':'')+'내일 전국 휘발유 평균, 오늘('+P[last].toLocaleString()+'원)보다? <span class="small">· 맞힌 예측 '+hits+'개</span><div class="pb">';
['up','same','down'].forEach(function(k){h+='<button type="button" data-p="'+k+'" aria-pressed="'+(my&&my.p===k)+'">'+lab[k]+'</button>'});
h+='</div>'+(my?'<span class="small">내일 이 화면에서 결과를 알려 드려요.</span>':'')+'</div>'}
box.innerHTML=h;
box.querySelectorAll('.opts button').forEach(function(b){b.onclick=function(){if(S.ans[day])return;var i=+b.dataset.i;S.ans[day]={pick:i,ok:i===Q.a,id:Q.id};save();render()}});
box.querySelectorAll('.pred button').forEach(function(b){b.onclick=function(){S.pred[last]={p:b.dataset.p};save();render()}});
var sh=document.getElementById('qshare');if(sh)sh.onclick=function(){var a=S.ans[day],t='돈 줍는 삼촌 · 오늘의 얼마게 '+(+day.slice(5,7))+'/'+(+day.slice(8))+' '+(a.ok?'⭕':'❌')+(streak()>1?' · 🔥'+streak()+'일 연속':'')+'\n'+D.url;
if(navigator.share)navigator.share({text:t}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){sh.textContent='복사했어요'})}}
render();
var sel=document.getElementById('sido');if(sel&&D.sido){var R='d3c_region',v;try{v=localStorage.getItem(R)}catch(e){}
function show(){var x=D.sido[sel.value];var el=document.getElementById('mysido');if(x&&el)el.innerHTML=Math.round(x[0]).toLocaleString()+'원 <small>/L</small>'}
if(v&&D.sido[v])sel.value=v;show();sel.onchange=function(){try{localStorage.setItem(R,sel.value)}catch(e){}show()}}
})();"""


def today_block(latest: dict | None, root: str = "") -> str:
    """홈 맨 위. 시세가 없으면 퀴즈만."""
    e = html.escape
    left = ""
    if latest:
        tiles, lines = [], []
        f = latest.get("fuel") or {}
        g, dsl = f.get("B027"), f.get("D047")
        if g:
            sido = g.get("sido") or {}
            opts = "".join(f'<option{" selected" if n == SIDO_DEFAULT else ""}>{e(n)}</option>' for n in sorted(sido))
            tiles.append(f'<div class="tile"><span class="k">휘발유 전국 평균</span><span class="v">{g["price"]:,.0f}원 <small>/L</small></span>{sign(g.get("diff"))}</div>')
            if sido:
                d0 = sido.get(SIDO_DEFAULT) or next(iter(sido.values()))
                tiles.append(f'<div class="tile"><label class="k">우리 지역 <select id="sido" aria-label="지역">{opts}</select></label>'
                             f'<span class="v" id="mysido">{d0[0]:,.0f}원 <small>/L</small></span><span class="k">휘발유 · 지역 평균</span></div>')
            lines.append(fuel_line(f))
        if dsl:
            tiles.append(f'<div class="tile"><span class="k">경유 전국 평균</span><span class="v">{dsl["price"]:,.0f}원 <small>/L</small></span>{sign(dsl.get("diff"))}</div>')
        x = latest.get("fx")
        if x:
            tiles.append(f'<div class="tile"><span class="k">1달러 환율</span><span class="v">{x["usd"]:,.1f}원</span>{sign(x.get("diff"))}</div>')
            lines.append(fx_line(x))
        gr = latest.get("grocery") or []
        basket = ""
        if gr:
            lines.append(grocery_line(gr))
            basket = '<p class="basket">장바구니: ' + " · ".join(
                f'{e(i["name"])} {i["price"]:,}원{("(" + e(i["unit"]) + ")") if i["unit"] else ""}' for i in gr[:6]) + "</p>"
        if len(tiles) % 2:
            tiles.append('<div class="tile"><span class="k">매일 아침 6시쯤</span><span class="v" style="font-size:16px">새 숫자로 바뀌어요</span></div>')
        src = " · ".join(n for k, n in R.SOURCES.items() if latest.get(k))
        left = (f'<div><div class="tiles">{"".join(tiles)}</div><ul class="lines">{"".join(f"<li>{e(l)}</li>" for l in lines if l)}</ul>{basket}'
                f'<p class="small">{date_label(latest["date"])} 기준 · 출처 {e(src)} · <a href="{root}report.html">주간 물가 리포트</a></p></div>')
    quiz = f'<div class="quiz" id="quizbox"><p class="qq">오늘의 얼마게를 불러오는 중이에요.</p></div>'
    when = date_label(latest["date"]) if latest else ""
    return (f'<section id="today"><div class="sechead"><h2>오늘의 생활 시세</h2><span>{e(when)}</span></div>'
            f'<div class="twocol2">{left or "<div><p class=lede>기름값·환율·장바구니 시세를 매일 아침 정리해요.</p></div>"}{quiz}</div></section>')


def data_script(latest: dict | None, days: list[dict], base: str, root: str = "", today: dt.date | None = None) -> str:
    today = today or dt.datetime.now(KST).date()
    payload = {"quiz": schedule(today - dt.timedelta(days=2), 40, latest), "fuel": fuel_history(days[:14]),
               "sido": ((latest or {}).get("fuel") or {}).get("B027", {}).get("sido"), "root": root, "url": f"{base}/quiz"}
    return f"<script>window.D3C={json.dumps(payload, ensure_ascii=False)};{QUIZ_JS}</script>"


def quiz_body(latest: dict | None) -> str:
    return f"""<h1>오늘의 얼마게</h1>
<p class="lede">하루 한 문제, 생활 속 숫자를 맞혀 보세요. 레시피 1인분 재료비, 가전 전기요금, 직구 면세 한도, 그날의 기름값·환율처럼
삼촌이 계산해 둔 숫자로만 내요. 풀면 출석 도장이 찍히고, 연속으로 오면 배지가 생겨요. 기록은 이 기기에만 저장되고 서버로 보내지 않아요.</p>
<div style="max-width:620px;margin-top:24px"><div class="quiz" id="quizbox"><p class="qq">문제를 불러오는 중이에요.</p></div></div>
<h2 style="margin-top:40px">이렇게 놀아요</h2>
<ul class="lines"><li>문제는 매일 0시(한국 시간)에 바뀌어요. 하루 한 번만 고를 수 있어요.</li>
<li>틀려도 출석 도장은 찍혀요. 3·7·14·30·100일 연속이면 배지가 생겨요.</li>
<li>'내일 휘발유 예측'은 다음 날 아침 새 시세가 나오면 맞혔는지 알려 드려요.</li>
<li>정답 아래 링크에서 우리 집 숫자로 직접 계산해 볼 수 있어요.</li></ul>"""


def main() -> int:
    today = dt.datetime.now(KST).date()
    data = collect(today)
    if not data:
        print("수집된 출처가 없어 저장하지 않음")
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{today.isoformat()}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"저장: {OUT}/{today.isoformat()}.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
