"""주간 생활물가 리포트 (2026-11-13). 매주 월요일 공공 API로 기름값·장바구니 물가·환율을 모아
data/report/YYYY-MM-DD.json 으로 저장하고, 사이트 빌드가 /report/ 페이지로 만든다.

출처 (모두 무료 키, 출처 표시 조건):
- 오피넷(한국석유공사): 전국 평균·시도별 휘발유/경유 가격, 최근 7일 추이   OPINET_KEY
- KAMIS(aT 농산물유통정보): 소매 품목 당일/1개월 전/1년 전 가격          KAMIS_KEY, KAMIS_ID
- 한국은행 ECOS: 원/달러 매매기준율 일별                                  ECOS_KEY
키가 없거나 응답이 이상한 출처는 그 절만 빼고 만든다. 셋 다 없으면 저장하지 않는다.
판단 문장은 숫자에서 규칙으로만 만든다(생성형 문장 없음). 숫자는 받은 그대로 반올림만 한다.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

KST = dt.timezone(dt.timedelta(hours=9))
OUT = pathlib.Path("data/report")
FUEL = {"B027": "휘발유", "D047": "경유"}
SOURCES = {
    "fuel": "한국석유공사 오피넷",
    "grocery": "한국농수산식품유통공사 KAMIS",
    "fx": "한국은행 경제통계시스템(ECOS)",
}


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (report-bot)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def num(v) -> float | None:
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


# ---------- 기름값 (오피넷) ----------
def parse_fuel(avg: dict, sido: dict[str, dict], recent: dict) -> dict | None:
    out = {}
    for row in avg.get("RESULT", {}).get("OIL", []):
        code = row.get("PRODCD")
        if code in FUEL and num(row.get("PRICE")):
            out[code] = {"name": FUEL[code], "price": round(num(row["PRICE"])), "diff": num(row.get("DIFF")) or 0.0}
    if not out:
        return None
    for code, js in sido.items():
        rows = [(r.get("SIDONM"), num(r.get("PRICE"))) for r in js.get("RESULT", {}).get("OIL", [])
                if r.get("SIDOCD") not in (None, "", "00") and num(r.get("PRICE"))]
        if code in out and rows:
            rows.sort(key=lambda x: x[1])
            out[code]["cheapest"] = [rows[0][0], round(rows[0][1])]
            out[code]["priciest"] = [rows[-1][0], round(rows[-1][1])]
    week: dict[str, list] = {}
    for r in recent.get("RESULT", {}).get("OIL", []):
        if r.get("PRODCD") in out and num(r.get("PRICE")):
            week.setdefault(r["PRODCD"], []).append((r.get("DATE", ""), num(r["PRICE"])))
    for code, pts in week.items():
        pts.sort()
        if len(pts) >= 2:
            out[code]["week"] = round(pts[-1][1] - pts[0][1], 1)
    return out


def fetch_fuel(key: str) -> dict | None:
    base = "https://www.opinet.co.kr/api/"
    q = lambda name, **kw: get_json(base + name + "?" + urllib.parse.urlencode({"out": "json", "code": key, **kw}))
    return parse_fuel(q("avgAllPrice.do"), {c: q("avgSidoPrice.do", prodcd=c) for c in FUEL}, q("avgRecentPrice.do"))


# ---------- 장바구니 (KAMIS) ----------
def parse_grocery(js: dict, top: int = 5) -> dict | None:
    items = []
    for r in js.get("price", []) if isinstance(js.get("price"), list) else []:
        if str(r.get("product_cls_code", "01")) != "01":  # 01 = 소매
            continue
        now, month, year = num(r.get("dpr1")), num(r.get("dpr3")), num(r.get("dpr4"))
        if not now or not month:
            continue
        name = (r.get("productName") or r.get("item_name") or "").strip()
        unit = (r.get("unit") or "").strip()
        items.append({"name": name, "unit": unit, "price": round(now),
                      "m": round((now - month) / month * 100, 1),
                      "y": round((now - year) / year * 100, 1) if year else None})
    if len(items) < top * 2:
        return None
    items.sort(key=lambda x: x["m"])
    return {"count": len(items), "down": [x for x in items if x["m"] < 0][:top], "up": [x for x in items[::-1] if x["m"] > 0][:top]}


def fetch_grocery(key: str, uid: str) -> dict | None:
    url = "https://www.kamis.or.kr/service/price/xml.do?" + urllib.parse.urlencode(
        {"action": "dailySalesList", "p_cert_key": key, "p_cert_id": uid, "p_returntype": "json"})
    return parse_grocery(get_json(url))


# ---------- 환율 (ECOS) ----------
def parse_fx(js: dict) -> dict | None:
    rows = js.get("StatisticSearch", {}).get("row", [])
    pts = sorted((r["TIME"], num(r.get("DATA_VALUE"))) for r in rows if r.get("TIME") and num(r.get("DATA_VALUE")))
    if len(pts) < 10:
        return None
    vals = [v for _, v in pts]
    now = vals[-1]
    week_ago = vals[-6] if len(vals) >= 6 else vals[0]
    avg = sum(vals[-20:]) / len(vals[-20:])
    return {"date": pts[-1][0], "usd": round(now, 1), "week": round(now - week_ago, 1),
            "avg4w": round(avg, 1), "vsAvg": round((now - avg) / avg * 100, 1),
            "low": round(min(vals[-20:]), 1), "high": round(max(vals[-20:]), 1)}


def fetch_fx(key: str, today: dt.date) -> dict | None:
    start = (today - dt.timedelta(days=45)).strftime("%Y%m%d")
    url = (f"https://ecos.bok.or.kr/api/StatisticSearch/{urllib.parse.quote(key)}/json/kr/1/100/731Y001/D/"
           f"{start}/{today.strftime('%Y%m%d')}/0000001")
    return parse_fx(get_json(url))


# ---------- 판단 문장 (규칙) ----------
def fuel_line(f: dict) -> str:
    g = f.get("B027")
    if not g:
        return ""
    w = g.get("week")
    if w is None:
        return f"전국 평균 휘발유는 리터당 {g['price']:,}원이에요."
    if abs(w) < 5:
        trend = "지난주와 거의 같아요. 주유 시점을 따질 필요는 크지 않아요"
    elif w > 0:
        trend = f"일주일 새 {w:,.0f}원 올랐어요. 오르는 중일 때는 미루기보다 필요할 때 바로 넣는 게 나아요"
    else:
        trend = f"일주일 새 {-w:,.0f}원 내렸어요. 내리는 중이라 급하지 않으면 며칠 기다려도 돼요"
    return f"전국 평균 휘발유는 리터당 {g['price']:,}원, {trend}."


def grocery_line(g: dict) -> str:
    parts = []
    if g["up"]:
        parts.append(f"한 달 전보다 가장 많이 오른 건 {g['up'][0]['name']}(+{g['up'][0]['m']}%)")
    if g["down"]:
        parts.append(f"가장 많이 내린 건 {g['down'][0]['name']}({g['down'][0]['m']}%)")
    if not parts:
        return "장바구니 물가는 한 달 전과 거의 같아요."
    return ", ".join(parts) + "이에요. 오른 품목은 대체품을, 내린 품목은 이번 주에 담는 걸 추천해요."


def fx_line(x: dict) -> str:
    v = x["vsAvg"]
    if v <= -1:
        s = f"최근 4주 평균보다 {abs(v)}% 낮아서 달러 결제 직구에 유리한 편이에요"
    elif v >= 1:
        s = f"최근 4주 평균보다 {v}% 높아서 급하지 않은 달러 결제 직구는 미뤄도 돼요"
    else:
        s = "최근 4주 평균과 비슷해서 환율 때문에 직구를 미룰 이유는 없어요"
    return f"원/달러 환율은 {x['usd']:,}원, {s}."


def build(today: dt.date, fuel: dict | None, grocery: dict | None, fx: dict | None) -> dict | None:
    if not (fuel or grocery or fx):
        return None
    r = {"date": today.isoformat(), "fuel": fuel, "grocery": grocery, "fx": fx}
    r["lines"] = [s for s in (fuel and fuel_line(fuel), grocery and grocery_line(grocery), fx and fx_line(fx)) if s]
    return r


# ---------- 사이트 HTML ----------
CSS = """
.rep h2{margin-top:32px}.rep table{width:100%;border-collapse:collapse;font-size:15px;margin-top:8px}
.rep th,.rep td{padding:9px 6px;border-bottom:1px solid var(--line);text-align:left}.rep td.num{text-align:right;font-family:var(--mono);white-space:nowrap}
.rep .sum{border:1px solid var(--line);padding:14px 16px;margin:16px 0}.rep .sum li{margin:6px 0}.rep .src{color:var(--muted);font-size:13px;margin-top:28px}
.up{color:#a33}.down{color:var(--green)}
"""


def pct(v) -> str:
    if v is None:
        return "-"
    cls = "up" if v > 0 else "down" if v < 0 else ""
    return f'<span class="{cls}">{v:+.1f}%</span>'


def title(r: dict) -> str:
    d = dt.date.fromisoformat(r["date"])
    return f"{d.month}월 {(d.day - 1) // 7 + 1}째 주 생활물가 리포트 ({d.month}/{d.day})"


def body(r: dict, root: str = "../") -> str:
    e = html.escape
    out = [f'<article class="rep"><h1>{e(title(r))}</h1><p class="muted">{r["date"]} 발행 · 공공 데이터로 매주 월요일 자동 정리</p>',
           '<div class="sum"><b>이번 주 한 줄 요약</b><ul>' + "".join(f"<li>{e(s)}</li>" for s in r["lines"]) + "</ul></div>"]
    f = r.get("fuel")
    if f:
        rows = ""
        for c in FUEL:
            if c in f:
                x = f[c]
                wk = "-" if x.get("week") is None else format(x["week"], "+,.0f") + "원"
                rows += (f"<tr><td>{x['name']}</td><td class='num'>{x['price']:,}원</td>"
                         f"<td class='num'>{wk}</td>"
                         f"<td>{e(x['cheapest'][0]) + ' ' + format(x['cheapest'][1], ',') + '원' if x.get('cheapest') else '-'}</td>"
                         f"<td>{e(x['priciest'][0]) + ' ' + format(x['priciest'][1], ',') + '원' if x.get('priciest') else '-'}</td></tr>")
        out.append("<h2>기름값</h2><table><tr><th>유종</th><th>전국 평균</th><th>7일 변화</th><th>가장 싼 시도</th><th>가장 비싼 시도</th></tr>"
                   + rows + "</table>")
    g = r.get("grocery")
    if g:
        tbl = lambda xs: "".join(f"<tr><td>{e(x['name'])} <small>{e(x['unit'])}</small></td><td class='num'>{x['price']:,}원</td>"
                                 f"<td class='num'>{pct(x['m'])}</td><td class='num'>{pct(x['y'])}</td></tr>" for x in xs)
        head = "<tr><th>품목</th><th>소매가</th><th>1개월 전 대비</th><th>1년 전 대비</th></tr>"
        out.append(f"<h2>장바구니 물가</h2><p>소매가 {g['count']}개 품목 중 한 달 새 변화가 큰 것만 골랐어요.</p>"
                   + (f"<h3>많이 오른 품목</h3><table>{head}{tbl(g['up'])}</table>" if g["up"] else "")
                   + (f"<h3>많이 내린 품목</h3><table>{head}{tbl(g['down'])}</table>" if g["down"] else ""))
    x = r.get("fx")
    if x:
        out.append(f"<h2>환율과 직구 타이밍</h2><table><tr><th>원/달러</th><th>7일 변화</th><th>4주 평균</th><th>4주 범위</th></tr>"
                   f"<tr><td class='num'>{x['usd']:,}원</td><td class='num'>{x['week']:+,}원</td><td class='num'>{x['avg4w']:,}원</td>"
                   f"<td class='num'>{x['low']:,}~{x['high']:,}원</td></tr></table>"
                   f'<p>직구 세금은 <a href="{root}calc/aliexpress.html">직구 관세 계산기</a>로, 알리 상품 가격 흐름은 <a href="{root}prices.html">가격 기록</a>에서 볼 수 있어요.</p>')
    out.append(f'<p>난방·전기 고지서가 걱정되면 <a href="{root}calc/heater.html">난방비 계산기</a>와 <a href="{root}calc/electric.html">전기요금 계산기</a>도 같이 보세요.</p>')
    src = [SOURCES[k] for k in ("fuel", "grocery", "fx") if r.get(k)]
    out.append(f'<p class="src">출처: {", ".join(src)} 공개 API. 수치는 각 기관이 발표한 값을 반올림만 했고, 지역·매장에 따라 실제 가격은 다를 수 있어요.</p></article>')
    return "".join(out)


def list_body(reports: list[dict]) -> str:
    items = "".join(f'<li><a href="report/{r["date"]}.html">{html.escape(title(r))}</a><br><small>{html.escape(r["lines"][0])}</small></li>'
                    for r in reports)
    return f'<h1>주간 생활물가 리포트</h1><p>기름값·장바구니 물가·환율을 공공 데이터로 매주 월요일 정리해요.</p><ul class="rep-list">{items}</ul>'


def load_all(root: pathlib.Path = OUT) -> list[dict]:
    return sorted((json.loads(f.read_text(encoding="utf-8")) for f in root.glob("*.json")), key=lambda r: r["date"], reverse=True)


def telegram_text(r: dict, site: str = "https://don3chon.com") -> str:
    return "\n".join([f"📊 {title(r)}", *[f"• {s}" for s in r["lines"]], f"자세히: {site}/report/{r['date']}",
                      "출처: " + ", ".join(SOURCES[k] for k in ("fuel", "grocery", "fx") if r.get(k))])


def main() -> int:
    today = dt.datetime.now(KST).date()
    env = os.environ.get
    got = {}
    for name, fn in (("fuel", lambda: env("OPINET_KEY") and fetch_fuel(env("OPINET_KEY"))),
                     ("grocery", lambda: env("KAMIS_KEY") and env("KAMIS_ID") and fetch_grocery(env("KAMIS_KEY"), env("KAMIS_ID"))),
                     ("fx", lambda: env("ECOS_KEY") and fetch_fx(env("ECOS_KEY"), today))):
        try:
            got[name] = fn() or None
        except Exception as ex:  # 한 출처가 실패해도 나머지로 만든다
            print(f"{name} 실패: {ex}", file=sys.stderr)
            got[name] = None
        print(f"{name}: {'OK' if got[name] else '없음'}")
    r = build(today, got["fuel"], got["grocery"], got["fx"])
    if not r:
        print("모든 출처 실패: 리포트 없음")
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{r['date']}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("\n".join(r["lines"]))
    tok, chat = env("TELEGRAM_BOT_TOKEN"), env("TELEGRAM_CHAT_ID")
    if env("TELEGRAM_ENABLED") == "true" and tok and chat:
        from .telegram import send
        try:
            send(tok, chat, telegram_text(r))
        except Exception as ex:
            print(f"텔레그램 실패: {ex}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
