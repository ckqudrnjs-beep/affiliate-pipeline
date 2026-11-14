"""1인분 원가 레시피 (2026-11-13): data/recipes/<slug>.json + config/recipe_pantry.csv → recipe.html, recipe/<slug>.html.

재료 값은 '삼촌 장보기 기준가'(config/recipe_pantry.csv)의 한 봉 가격 ÷ 용량 × 쓴 양으로 계산한다.
기준가를 고치면 모든 레시피의 원가·제목이 같이 바뀐다. 쿠팡 가격을 긁어 오지 않는다.
재료 링크(coupangUrl)는 BK님이 쿠팡 파트너스에서 직접 만든 것만 넣는다. 링크가 하나도 없으면 링크 칸은 숨긴다.
쿠팡 이미지는 쓰지 않는다. 레시피 글은 직접 쓴 것만 싣는다(레시피 사이트 문장 복사 금지).
"""
from __future__ import annotations

import csv
import datetime as dt
import html
import json
import pathlib
from urllib.parse import urlparse

from .compliance import ALLOWED_LINK_HOSTS

DELIVERY_FEE = 3000  # 배달비 가정 (가게·지역마다 다름)
BASICS = 50  # 소금·후추 등 기본양념 몫
MIN_STEPS, MIN_TIPS = 4, 2
# 연말 홈파티 (2026-11-14): "serves": 4 인 레시피는 재료 양·배달가가 4인분 기준이다.
# 원가 표는 4인분 전체 값, total/delivery/save 는 1인분으로 나눈 값(목록·퀴즈 비교용), batch/deliveryBatch/saveBatch 는 4인분 값.
PARTY_SET = ["party-millefeuille-nabe", "party-gambas", "party-sausage-veggie"]  # 목록 "4명 한 상 예시"
COUPANG_DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."

CSS = """
.recipe{max-width:720px}.recipe h2{font:500 24px/1.4 var(--display);margin:40px 0 12px}
.recipe p,.recipe li{font-size:17px;line-height:1.85}.recipe ol{padding-left:22px}.recipe ol li{margin-bottom:8px}
.costhero{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.costhero div{flex:1 1 150px;border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.costhero b{display:block;font:600 26px/1.3 var(--display);font-variant-numeric:tabular-nums}.costhero span{color:var(--muted);font-size:14px}
.costhero .save{background:#eef5f0;border-color:#cfe3d6}
.ingtable{border-collapse:collapse;width:100%;font-size:15px;font-variant-numeric:tabular-nums}
.ingtable th,.ingtable td{border-bottom:1px solid var(--line);padding:9px 6px;text-align:left;word-break:keep-all}.ingtable td.n,.ingtable th.n{text-align:right}
.ingtable tfoot td{font-weight:600}
.shopbox{border:1px solid var(--line);border-radius:14px;padding:6px 18px 12px;margin-top:36px}.shopbox h2{margin-top:14px}
.shopbox ul{list-style:none;padding:0;margin:0}.shopbox li{border-bottom:1px solid var(--line);padding:12px 0;display:flex;justify-content:space-between;gap:12px}
.shopbox li:last-child{border-bottom:0}.shopbox a{font-weight:600}.shopbox li span{color:var(--muted);font-size:14px;white-space:nowrap}
.rlist{list-style:none;padding:0;margin:0}.rlist li{border-bottom:1px solid var(--line);padding:18px 0}
.rlist a{color:inherit;text-decoration:none;display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.rlist b{font:500 20px/1.45 var(--display)}.rlist span{color:var(--muted);font-size:15px;white-space:nowrap;font-variant-numeric:tabular-nums}
"""


def won(n: int) -> str:
    return f"{n:,}원"


def r10(x: float) -> int:
    return int(round(x / 10) * 10)


def load_pantry(path: str = "config/recipe_pantry.csv") -> dict[str, dict]:
    out = {}
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not r.get("id") or r["id"].startswith("#"):
                continue
            url = (r.get("coupangUrl") or "").strip()
            host = urlparse(url).hostname or ""
            if url and host not in ALLOWED_LINK_HOSTS:
                raise ValueError(f"재료 {r['id']}: 허용되지 않은 링크 도메인 {host}")
            if "EXAMPLE" in url:
                url = ""
            r["coupangUrl"] = url
            r["packAmount"], r["packPrice"] = float(r["packAmount"]), int(r["packPrice"])
            out[r["id"]] = r
    return out


def cost(rec: dict, pantry: dict[str, dict]) -> dict:
    """재료별 값과 1인분 원가, 배달과의 차이. serves 가 2 이상이면 전체(batch)를 사람 수로 나눈다."""
    rows = []
    for i in rec["ingredients"]:
        p = pantry[i["id"]]
        rows.append({**i, "name": p["name"], "won": r10(p["packPrice"] * i["use"] / p["packAmount"]), "pantry": p})
    n = int(rec.get("serves", 1))
    batch = sum(x["won"] for x in rows) + BASICS * n
    dbatch = int(rec["delivery"]) + DELIVERY_FEE
    total, delivery = (batch, dbatch) if n == 1 else (r10(batch / n), r10(dbatch / n))
    return {"rows": rows, "total": total, "delivery": delivery, "save": delivery - total, "serves": n,
            "batch": batch, "deliveryBatch": dbatch, "saveBatch": dbatch - batch,
            "priceDate": max(x["pantry"]["priceDate"] for x in rows)}


def is_party(r: dict) -> bool:
    return r.get("collection") == "party"


def yield_label(r: dict) -> str:
    return f"{r.get('serves', 1)}인분"


def load(data_dir: str = "data", pantry: dict | None = None) -> list[dict]:
    pantry = pantry if pantry is not None else load_pantry()
    out = []
    for f in sorted(pathlib.Path(data_dir, "recipes").glob("*.json")):
        r = json.loads(f.read_text(encoding="utf-8"))
        if r.get("status", "published") != "published":
            continue
        out.append(r | cost(r, pantry))
    return sorted(out, key=lambda r: (r["date"], -r["save"]), reverse=True)


def title(r: dict) -> str:
    if is_party(r):
        return f"연말 홈파티 {r['name']} {yield_label(r)} 재료비 {won(r['batch'])}, 1인분 원가 {won(r['total'])} 레시피"
    return f"{r['name']} 1인분 원가 {won(r['total'])}, 배달보다 {won(r['save'] // 100 * 100)} 아끼는 레시피"


def desc(r: dict) -> str:
    if is_party(r):
        return (f"{r['name']} {yield_label(r)}을 집에서 만들면 재료비 약 {won(r['batch'])}(1인분 {won(r['total'])})이에요. "
                f"배달(약 {won(r['deliveryBatch'])})보다 {won(r['saveBatch'] // 100 * 100)} 아껴요. 재료별 원가와 만드는 법을 정리했어요.")
    return (f"{r['name']} 1인분을 집에서 만들면 재료비 약 {won(r['total'])}이에요. 배달(약 {won(r['delivery'])})보다 "
            f"{won(r['save'] // 100 * 100)} 아껴요. 재료별 원가와 만드는 법을 정리했어요.")


def shop_box(rows: list[dict]) -> str:
    """쿠팡 재료 링크 칸. BK님이 만든 링크가 있는 재료만, 하나도 없으면 칸 자체를 숨긴다. 가격은 판매처에서 확인."""
    linked = [x for x in rows if x["pantry"]["coupangUrl"]]
    if not linked:
        return ""
    e = html.escape
    li = "".join(f'<li><a href="{e(x["pantry"]["coupangUrl"])}" target="_blank" rel="sponsored nofollow noopener">{e(x["pantry"]["name"])}</a><span>쿠팡에서 보기</span></li>' for x in linked)
    return (f'<section class="shopbox"><h2>재료 한 번에 장보기</h2><p class="ad">[광고] {COUPANG_DISCLOSURE}</p>'
            f'<p class="small">큰 봉지로 사 두면 여러 레시피에 나눠 써서 1인분 원가가 내려가요. 실제 가격과 배송일은 판매 페이지에서 확인하세요.</p>'
            f'<ul>{li}</ul></section>')


def page_body(r: dict, others: list[dict]) -> str:
    e = html.escape
    d = dt.date.fromisoformat(r["date"])
    pd = dt.date.fromisoformat(r["priceDate"])
    trs = "".join(f'<tr><td>{e(x["label"])}</td><td class="n">{won(x["won"])}</td></tr>' for x in r["rows"])
    trs += f'<tr><td>소금·후추 등 기본양념</td><td class="n">{won(BASICS * r["serves"])}</td></tr>'
    month = r["save"] * 12  # 한 달에 12번(주 3번) 배달 대신 해 먹을 때
    party = is_party(r)
    yl = yield_label(r)
    if party:
        hero = (f'<div class="costhero"><div><span>집에서 {yl}</span><b>{won(r["batch"])}</b></div>'
                f'<div><span>배달로 {yl} (대략)</span><b>{won(r["deliveryBatch"])}</b></div>'
                f'<div class="save"><span>한 번 모임에 아끼는 돈</span><b>{won(r["saveBatch"])}</b></div></div>'
                f'<p class="small">왜 이 값인가요? 배달은 {e(r.get("deliveryNote", ""))}에 배달비 {won(DELIVERY_FEE)}을 더한 대략값이에요. 가게·지역마다 다릅니다. '
                f'1인분으로 나누면 집에서 <b>{won(r["total"])}</b>, 배달은 약 {won(r["delivery"])}이에요.</p>')
        top = max(r["rows"], key=lambda x: x["won"])
        why = (f'<p class="small">{yl} 재료비 중 가장 큰 몫은 {e(top["name"])}({won(top["won"])}, 전체의 {round(top["won"] * 100 / r["batch"])}%)이에요. '
               f'예산을 줄이려면 이 재료 양부터 조절하세요.</p>')
    else:
        hero = (f'<div class="costhero"><div><span>집에서 1인분</span><b>{won(r["total"])}</b></div>'
                f'<div><span>배달로 1인분 (대략)</span><b>{won(r["delivery"])}</b></div>'
                f'<div class="save"><span>한 그릇에 아끼는 돈</span><b>{won(r["save"])}</b></div></div>'
                f'<p class="small">배달 가격은 {e(r["name"])} 1인분 흔한 메뉴 가격 {won(int(r["delivery"]) - DELIVERY_FEE)}에 배달비 {won(DELIVERY_FEE)}을 더한 대략값이에요. 가게·지역마다 다릅니다.\n'
                f'배달 대신 주 3번만 해 먹어도 한 달에 약 <b>{won(month // 1000 * 1000)}</b>을 아껴요.</p>')
        why = ""
    same = [o for o in others if is_party(o) == party]
    steps = "".join(f"<li>{e(s)}</li>" for s in r["steps"])
    tips = "".join(f"<li>{e(s)}</li>" for s in r["tips"])
    more = "".join(f'<li><a href="{o["slug"]}.html"><b>{e(o["name"])}</b><span>{yield_label(o) + " " + won(o["batch"]) if is_party(o) else "1인분 " + won(o["total"])}</span></a></li>'
                   for o in (same + [o for o in others if o not in same])[:4])
    return f"""<article class="recipe"><p class="small"><a href="../recipe.html{'#party' if party else ''}">{'연말 홈파티 레시피' if party else '1인분 원가 레시피'}</a></p>
<h1>{e(title(r))}</h1><p class="meta">{d.year}년 {d.month}월 {d.day}일 · 돈 줍는 삼촌</p>
<p class="lede">{e(r["intro"])}</p>
{hero}
<h2>재료와 {yl} 원가</h2>
<table class="ingtable"><thead><tr><th>재료 ({yl})</th><th class="n">원가</th></tr></thead><tbody>{trs}</tbody>
<tfoot><tr><td>합계</td><td class="n">{won(r["batch"])}</td></tr></tfoot></table>
{why}
<p class="small">삼촌 장보기 기준가({pd.year}년 {pd.month}월 {pd.day}일, 대형마트·온라인 장보기 흔한 가격대)로 큰 봉지 한 개 값을 쓴 양만큼 나눠 계산했어요. 실제 가격은 사는 곳과 시기에 따라 달라요. <a href="../recipe.html#pantry">기준가 전체 보기</a></p>
<h2>만드는 법</h2><ol>{steps}</ol>
<h2>삼촌의 아끼는 팁</h2><ul>{tips}</ul>
{shop_box(r["rows"])}
<section class="related"><h2>{'다른 홈파티 레시피' if party else '다른 1인분 레시피'}</h2><ul class="rlist">{more}</ul></section></article>"""


def list_body(recs: list[dict], pantry: dict[str, dict]) -> str:
    e = html.escape
    items = "".join(f'<li><a href="recipe/{r["slug"]}.html"><b>{e(r["name"])}</b><span>1인분 {won(r["total"])} · 배달보다 {won(r["save"] // 100 * 100)} ↓</span></a></li>'
                    for r in sorted((r for r in recs if not is_party(r)), key=lambda r: -r["save"]))
    party = party_block(recs)
    used = {i["id"] for r in recs for i in r["ingredients"]}
    ptr = "".join(f'<tr><td>{e(p["name"])}</td><td>{e(p["pack"])}</td><td class="n">{won(p["packPrice"])}</td></tr>'
                  for k, p in pantry.items() if k in used)
    pd = max((p["priceDate"] for k, p in pantry.items() if k in used), default="")
    return (f'<article class="recipe"><h1>1인분 원가 레시피</h1><p class="lede">배달 한 번 값이면 며칠을 해 먹습니다. 자주 먹는 한 그릇 메뉴를 '
            f'1인분 재료비로 계산하고, 배달보다 얼마나 아끼는지 적었어요.</p>{party}<h2>한 그릇 1인분 레시피</h2><ul class="rlist" style="margin-top:20px">{items}</ul>'
            f'<h2 id="pantry">삼촌 장보기 기준가</h2><p class="small">{pd} 기준 대형마트·온라인 장보기 흔한 가격대예요. 레시피 원가는 이 값으로 계산합니다. 실제 가격은 사는 곳과 시기에 따라 달라요.</p>'
            f'<table class="ingtable"><thead><tr><th>재료</th><th>단위</th><th class="n">가격</th></tr></thead><tbody>{ptr}</tbody></table></article>')


def party_block(recs: list[dict]) -> str:
    """연말 홈파티 칸: 4인분 레시피 목록 + 4명 한 상 예시(재료비 합 vs 배달 합)."""
    ps = [r for r in recs if is_party(r)]
    if not ps:
        return ""
    e = html.escape
    items = "".join(f'<li><a href="recipe/{r["slug"]}.html"><b>{e(r["name"])}</b><span>{yield_label(r)} {won(r["batch"])} · 1인분 {won(r["total"])}</span></a></li>'
                    for r in sorted(ps, key=lambda r: -r["saveBatch"]))
    bys = {r["slug"]: r for r in ps}
    st = [bys[s] for s in PARTY_SET if s in bys]
    combo = ""
    if len(st) >= 2:
        home, dlv = sum(r["batch"] for r in st), sum(r["deliveryBatch"] - DELIVERY_FEE for r in st) + DELIVERY_FEE
        combo = (f'<div class="costhero"><div><span>4명 한 상, 집에서</span><b>{won(home)}</b></div>'
                 f'<div><span>같은 메뉴 배달 (대략)</span><b>{won(dlv)}</b></div>'
                 f'<div class="save"><span>아끼는 돈</span><b>{won(dlv - home)}</b></div></div>'
                 f'<p class="small">한 상 예시: {" + ".join(e(r["name"]) for r in st)}. 1인당 재료비 약 {won(r10(home / 4))}이에요. '
                 f'배달은 메뉴 대략가 합에 배달비 {won(DELIVERY_FEE)}을 한 번만 더했어요(한 가게에서 다 시킨다고 가정). 메뉴별 계산 근거는 각 레시피에 있어요.</p>')
    return (f'<h2 id="party">연말 홈파티 레시피 (4인 기준)</h2><p class="small">손님 넷이 와도 배달 대신 차리면 얼마나 드는지, 4인분 재료비와 1인분 값을 같이 적었어요.</p>'
            f'{combo}<ul class="rlist">{items}</ul>')


def home_block(recs: list[dict]) -> str:
    if not recs:
        return ""
    e = html.escape
    top = sorted(recs, key=lambda r: -r["save"])[:4]
    items = "".join(f'<li><a href="recipe/{r["slug"]}.html"><b>{e(r["name"])}</b><span>1인분 {won(r["total"])}</span></a></li>' for r in top)
    return (f'<section id="recipes"><div class="sechead"><h2>1인분 원가 레시피</h2><a href="recipe.html" class="small">전체 보기</a></div>'
            f'<ul class="rlist">{items}</ul></section>')


def ld(r: dict, base: str, image: str) -> dict:
    return {"@context": "https://schema.org", "@type": "Recipe", "name": f"{r['name']} {yield_label(r)}", "description": desc(r),
            "image": [f"{base}/{image}"], "datePublished": r["date"], "inLanguage": "ko", "recipeYield": yield_label(r),
            "author": {"@type": "Organization", "name": "돈 줍는 삼촌"}, "keywords": ", ".join(r.get("keywords", [])),
            "recipeIngredient": [x["label"] for x in r["rows"]],
            "recipeInstructions": [{"@type": "HowToStep", "text": s} for s in r["steps"]],
            "estimatedCost": {"@type": "MonetaryAmount", "currency": "KRW", "value": r["batch"]}}


def validate(r: dict, pantry: dict[str, dict]) -> list[str]:
    err = []
    for k in ("slug", "name", "date", "intro", "delivery", "ingredients", "steps", "tips"):
        if not r.get(k):
            err.append(f"{k} 없음")
    for i in r.get("ingredients", []):
        if i["id"] not in pantry:
            err.append(f"기준가 없는 재료: {i['id']}")
    if len(r.get("steps", [])) < MIN_STEPS:
        err.append(f"만드는 법 {MIN_STEPS}단계 이상 필요")
    if len(r.get("tips", [])) < MIN_TIPS:
        err.append(f"팁 {MIN_TIPS}개 이상 필요")
    text = r.get("intro", "") + " ".join(r.get("steps", []) + r.get("tips", []))
    if "http" in text:
        err.append("본문에 링크 금지")
    return err


def link_todo(recs: list[dict], pantry: dict[str, dict]) -> list[tuple[str, int]]:
    """링크를 만들 재료 순서: 많이 쓰는 재료부터, 이미 링크가 있는 것은 뺀다."""
    n: dict[str, int] = {}
    for r in recs:
        for i in r["ingredients"]:
            n[i["id"]] = n.get(i["id"], 0) + 1
    return [(k, c) for k, c in sorted(n.items(), key=lambda x: -x[1]) if not pantry[k]["coupangUrl"]]
