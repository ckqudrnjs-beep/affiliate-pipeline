"""이번 주 장보기 리스트 (2026-11-17): 최신 주간 리포트(data/report/*.json, 월 07:10 자동)의 KAMIS 시세에서
지금 싼 부엌 재료 5개를 골라, 재료마다 '아하' 한 줄(작년 같은 때 대비·기록 중 최저·손질/보관 팁)과
그 재료가 들어가는 원가 레시피를 붙여 /shopping 한 장 카드로 만든다.

- 숫자는 리포트 JSON(KAMIS)과 레시피 원가(사이트 데이터)만 쓴다. 팁 문장에는 숫자를 넣지 않는다.
- 이 페이지에는 제휴 링크·광고 문구를 넣지 않는다(쿠팡 버튼은 레시피 페이지에만). 테스트가 검사한다.
- 리포트가 새로 커밋되면 사이트가 다시 빌드되면서 이 페이지도 자동으로 바뀐다(별도 작업 없음).
"""
from __future__ import annotations

import datetime as dt
import html

SLUG = "shopping"
DESC = "KAMIS 소매 시세로 매주 월요일 고르는 지금 싼 장보기 재료 5개와, 그 재료로 만드는 반찬·한 그릇 레시피. 작년 이맘때 가격과 손질·보관 팁까지 한 장에."

# 부엌 재료: KAMIS 품목명(괄호 앞) → (레시피 재료 id, 손질·보관 팁). 팁은 숫자 없이 직접 쓴 문장만.
KITCHEN: dict[str, tuple[tuple[str, ...], str]] = {
    "토마토": (("tomato",), "꼭지를 아래로 두면 덜 물러요. 기름에 익혀 먹으면 라이코펜이 더 잘 흡수돼요."),
    "방울토마토": (("tomato",), "씻지 말고 꼭지째 냉장했다가 먹기 직전에 씻으면 덜 물러요."),
    "파": (("greenonion",), "송송 썰어 지퍼백에 펴서 얼리면 필요한 만큼 똑똑 떼어 써요."),
    "대파": (("greenonion",), "흰 부분과 초록 부분을 나눠 썰어 얼리면 국물용·고명용으로 바로 써요."),
    "쪽파": ((), "다듬은 뒤 물기를 완전히 말려서 키친타월에 싸 두면 덜 물러요."),
    "배추": (("napa",), "겉잎은 버리지 말고 된장국에, 노란 속은 쌈·겉절이로 나눠 쓰면 남김없이 먹어요."),
    "알배기배추": (("napa",), "통째로 키친타월에 싸서 세워 두면 오래가요. 밀푀유나베·쌈·겉절이에 딱이에요."),
    "무": (("radish",), "초록빛 윗부분은 달아서 생채·무침에, 아래쪽은 매운맛이 있어 국·조림에 좋아요."),
    "양파": (("onion",), "망에 담아 바람 통하는 곳에 두고, 감자와는 따로 두세요. 같이 두면 빨리 상해요."),
    "감자": (("potato",), "빛을 막아 서늘한 곳에 두고, 싹이 나거나 초록빛 도는 부분은 넉넉히 도려내요."),
    "당근": (("carrot",), "물기를 닦고 키친타월에 싸서 냉장하면 덜 물러요. 흙당근이 세척 당근보다 오래가요."),
    "오이": (("cucumber",), "너무 찬 곳에 두면 물러요. 키친타월에 싸서 냉장고 문 쪽에 세워 두세요."),
    "호박": (("zucchini",), "자른 면은 랩으로 감싸 냉장하고, 남으면 채 썰어 얼려 두면 찌개에 바로 넣어요."),
    "애호박": (("zucchini",), "자른 면은 랩으로 감싸 냉장하고, 남으면 채 썰어 얼려 두면 찌개에 바로 넣어요."),
    "마늘": (("garlic", "peeledgarlic"), "다져서 지퍼백에 얇게 펴 얼린 뒤 칸을 그어 두면 한 칸씩 떼어 써요."),
    "깐마늘": (("garlic", "peeledgarlic"), "물기를 말린 뒤 밀폐용기에 냉장하고, 많으면 다져서 얇게 얼려요."),
    "깻잎": (("perilla",), "꼭지를 아래로 물 조금 담은 컵에 세워 냉장하면 싱싱하게 오래가요."),
    "팽이버섯": (("enoki",), "씻지 말고 쓰기 직전에 밑동만 잘라요. 물이 닿으면 빨리 물러요."),
    "파프리카": (("paprika",), "꼭지 쪽을 누르고 비틀어 따면 씨가 한 번에 빠져요."),
    "계란": (("egg",), "뾰족한 쪽이 아래로 가게 두면 노른자가 가운데 머물러 더 오래가요."),
    "생강": ((), "껍질은 숟가락으로 긁으면 쉽게 벗겨져요. 편 썰어 얼리면 고기 잡내 잡을 때 바로 써요."),
    "시금치": ((), "살짝 데쳐 물기를 꼭 짠 뒤 한 번 먹을 만큼 나눠 얼리면 나물·국에 바로 써요."),
    "상추": ((), "키친타월을 깐 밀폐용기에 담으면 물러지지 않아요. 시들면 찬물에 잠깐 담가 살려요."),
    "양배추": ((), "심을 도려내고 젖은 키친타월을 채워 두면 오래가요. 겉잎부터 떼어 써요."),
    "브로콜리": ((), "송이째 거꾸로 식초 탄 물에 잠깐 담갔다 흔들어 씻으면 속까지 깨끗해요."),
    "고구마": ((), "냉장고에 넣지 말고 신문지에 싸서 서늘한 실온에 두세요. 냉장하면 속이 상해요."),
    "버섯": ((), "씻지 말고 키친타월로 흙만 털어요. 물이 닿으면 향이 빠지고 빨리 물러요."),
    "느타리버섯": ((), "씻지 말고 쓰기 직전에 결대로 찢어요. 물이 닿으면 빨리 물러요."),
    "새송이버섯": ((), "키친타월에 하나씩 싸서 냉장하면 겉이 덜 미끈거려요."),
    "미나리": ((), "뿌리 쪽을 물에 꽂아 두면 며칠 더 싱싱해요."),
}

# 한 달 새 많이 오른 품목 → 이번 주 싼 재료로 바꾸는 방법 (같은 쓰임일 때만)
SUBS: dict[str, list[tuple[str, str]]] = {
    "오이": [("무", "아삭한 생채·무침"), ("알배기배추", "겉절이"), ("양배추", "샐러드·무침")],
    "호박": [("무", "찌개·국 건더기"), ("감자", "찌개·볶음"), ("양파", "볶음")],
    "애호박": [("무", "찌개·국 건더기"), ("감자", "찌개·볶음"), ("양파", "볶음")],
    "배추": [("알배기배추", "겉절이·국"), ("양배추", "볶음·쌈")],
    "알배기배추": [("양배추", "볶음·쌈"), ("배추", "국·겉절이")],
    "대파": [("쪽파", "고명·파전"), ("양파", "국물 단맛")],
    "파": [("양파", "국물 단맛")],
    "상추": [("깻잎", "쌈"), ("알배기배추", "쌈")],
    "깻잎": [("상추", "쌈"), ("알배기배추", "쌈")],
    "시금치": [("알배기배추", "된장국"), ("미나리", "나물")],
    "양배추": [("알배기배추", "볶음·쌈"), ("배추", "볶음")],
    "토마토": [("파프리카", "샐러드"), ("방울토마토", "샐러드")],
    "방울토마토": [("토마토", "샐러드"), ("파프리카", "샐러드")],
    "감자": [("고구마", "조림·구이"), ("무", "조림")],
    "당근": [("파프리카", "볶음 색감")],
    "양파": [("대파", "볶음 단맛"), ("파", "볶음")],
}


def base(name: str) -> str:
    return name.split("(")[0].strip()


def info(name: str) -> tuple[str, tuple[str, ...], str] | None:
    """'호박(애호박)' → ('애호박', ...), '무(고랭지)' → ('무', ...). 부엌 재료가 아니면 None."""
    b = base(name)
    inner = name[len(b):].strip("() ")
    for k in (inner, b):
        if k and k in KITCHEN:
            return (k, *KITCHEN[k])
    return None


def week_label(d: str) -> str:
    x = dt.date.fromisoformat(d)
    return f"{x.month}월 {(x.day - 1) // 7 + 1}째 주"


def latest(reps: list[dict]) -> dict | None:
    return next((r for r in reps if (r.get("grocery") or {}).get("down")), None)


def history_low(item: dict, reps: list[dict]) -> int:
    """이번 가격이 지난 리포트들(같은 이름·단위) 중 가장 싸면 비교한 주 수, 아니면 0. 4주 이상 쌓였을 때만."""
    key = f"{item['name']}|{item['unit']}"
    past = [r["grocery"]["all"][key] for r in reps[1:] if key in ((r.get("grocery") or {}).get("all") or {})]
    return len(past) + 1 if len(past) >= 3 and item["price"] < min(past) else 0


def aha(item: dict, reps: list[dict]) -> str:
    """시세에서 나오는 의외의 한 줄. 우선순위: 기록 중 최저 > 작년보다 아직 비쌈 > 작년보다 크게 쌈 > 작년 비슷."""
    n = history_low(item, reps)
    y = item.get("y")
    if n:
        return f"리포트 기록 {n}주 중 가장 싼 주예요. 쓸 만큼 넉넉히 담아도 좋아요."
    if y is not None and y >= 5:
        return f"한 달 새 내렸지만 작년 이맘때보다는 아직 {y:.1f}% 비싸요. 쟁이지 말고 이번 주 쓸 만큼만."
    if y is not None and y <= -20:
        return f"작년 이맘때보다도 {-y:.1f}% 싸요. 한 달 전·1년 전보다 둘 다 싼 드문 때예요."
    if y is not None and y < 0:
        return f"작년 이맘때보다 {-y:.1f}% 싸요."
    if y is not None:
        return "작년 이맘때와 비슷한 값까지 내려왔어요."
    before = round(item["price"] / (1 + item["m"] / 100) / 10) * 10  # 한 달 전 가격 = 지금 가격과 변화율로 되짚은 값
    return f"한 달 전엔 약 {before:,}원이었어요. 같은 돈으로 {before / item['price']:.1f}배 담는 셈이에요."


def pick(g: dict, n: int = 5) -> list[dict]:
    """한 달 전보다 내린 품목 중 부엌 재료를 우선, 같은 재료(오이 3종 등)는 하나만."""
    pool = g.get("cheap") or g.get("down") or []
    out, seen = [], set()
    for kitchen_first in (True, False):
        for x in pool:
            k = info(x["name"])
            if (k is not None) != kitchen_first or x["name"] in {o["name"] for o in out}:
                continue
            b = k[0] if k else base(x["name"])
            if b in seen:
                continue
            seen.add(b)
            out.append(x)
            if len(out) == n:
                return out
    return out


def recipes_for(ids: tuple[str, ...], recs: list[dict], k: int = 2) -> list[dict]:
    hit = [r for r in recs if any(i["id"] in ids for i in r["ingredients"])]
    return sorted(hit, key=lambda r: (r.get("collection") == "party", -r["save"]))[:k]


def swaps(g: dict, chosen: list[dict]) -> list[tuple[dict, dict, str]]:
    """많이 오른 품목 → 이번 주 리스트(또는 내린 품목) 안의 대체 재료."""
    cheap = {}
    for x in (g.get("cheap") or g.get("down") or []):
        k = info(x["name"])
        cheap.setdefault(k[0] if k else base(x["name"]), x)
    out, used = [], set()
    for u in g.get("up") or []:
        k = info(u["name"])
        b = k[0] if k else base(u["name"])
        if b in used:
            continue
        opts = [(s_, u_) for s_, u_ in SUBS.get(b, []) if s_ in cheap and s_ != b]
        taken = {c["name"] for _, c, _ in out}
        for sub, use in sorted(opts, key=lambda o: cheap[o[0]]["name"] in taken):  # 같은 대체 재료가 겹치지 않게
                out.append((u, cheap[sub], use))
                used.add(b)
                break
    return out[:3]


CSS = """
.shop{max-width:560px;margin:0 auto}.shop h1{font:600 26px/1.35 var(--display);margin:8px 0 6px}
.scard{background:var(--card);border:2px solid var(--green);border-radius:20px;padding:18px 16px 14px;margin:18px 0}
.scard .sh{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:2px 8px;border-bottom:2px dashed var(--line);padding-bottom:10px}
.scard .sh b{font:700 21px/1.3 var(--display);color:var(--green)}.scard .sh span{color:var(--muted);font-size:13px;white-space:nowrap}
.sitem{border-bottom:1px solid var(--line);padding:10px 0}.sitem:last-of-type{border-bottom:0}
.sitem label{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.sitem input{width:22px;height:22px;margin:3px 0 0;accent-color:var(--green);flex:none}
.sitem .nm{font-weight:700;font-size:18px}.sitem .nm small{font-weight:400;color:var(--muted);font-size:13px;margin-left:4px}
.sitem .pr{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;margin-top:2px;font-variant-numeric:tabular-nums}
.sitem .pr b{font-size:16px}.sitem .pr .dn{color:var(--green);font-weight:700;font-size:15px}
.sitem .aha{background:var(--greenbg);border-radius:10px;padding:7px 10px;margin:6px 0 0 32px;font-size:14.5px;line-height:1.55}
.sitem .aha i{font-style:normal;font-weight:700;color:var(--green);margin-right:4px}
.sitem .tip{margin:5px 0 0 32px;font-size:13.5px;line-height:1.55;color:var(--muted)}.sitem .tip i{font-style:normal;margin-right:4px}
.sitem .rc{margin:6px 0 0 32px;display:flex;flex-wrap:wrap;gap:6px}
.sitem .rc a{font-size:13.5px;border:1px solid var(--line);border-radius:999px;padding:4px 10px;text-decoration:none;color:var(--green);font-weight:600}
.sitem input:checked~div .nm{text-decoration:line-through;color:var(--muted)}
.sswap{border-top:2px dashed var(--line);margin-top:6px;padding-top:10px}.sswap b{font-size:15px}
.sswap ul{margin:6px 0 0;padding-left:18px}.sswap li{font-size:14.5px;line-height:1.65;margin:2px 0}
.sswap .up{color:#a33;font-weight:700}
.scard .sf{display:flex;justify-content:space-between;gap:8px;margin-top:10px;color:var(--muted);font-size:12px}
.shop .cap{color:var(--muted);font-size:14px;text-align:center;margin:-6px 0 22px}
.shop h2{font:500 21px/1.4 var(--display);margin:30px 0 8px}.shop p,.shop li{font-size:16px;line-height:1.8}
"""

JS = """(function(){var k='shop-'+document.querySelector('.scard').dataset.week,s={};
try{s=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){}
document.querySelectorAll('.sitem input').forEach(function(c){c.checked=!!s[c.value];c.addEventListener('change',function(){s[c.value]=c.checked;
try{localStorage.setItem(k,JSON.stringify(s))}catch(e){}})})})();"""


def card(r: dict, reps: list[dict], recs: list[dict], root: str = "") -> str:
    e = html.escape
    g = r["grocery"]
    items = pick(g)
    rows = []
    for x in items:
        k = info(x["name"])
        ids, tip = (k[1], k[2]) if k else ((), "")
        a = aha(x, reps)
        rc = "".join(f'<a href="{root}recipe/{q["slug"]}.html">{e(q["name"])} · 1인분 {q["total"]:,}원</a>' for q in recipes_for(ids, recs))
        rows.append(
            f'<div class="sitem"><label><input type="checkbox" value="{e(x["name"])}" aria-label="{e(x["name"])} 담음">'
            f'<div><span class="nm">{e(x["name"])}<small>{e(x["unit"])}</small></span>'
            f'<span class="pr"><b>{x["price"]:,}원</b><span class="dn">한 달 전보다 {x["m"]:.1f}%</span></span></div></label>'
            + (f'<p class="aha"><i>아하!</i>{e(a)}</p>' if a else "")
            + (f'<p class="tip"><i>🔪</i>{e(tip)}</p>' if tip else "")
            + (f'<div class="rc">{rc}</div>' if rc else "") + "</div>")
    sw = swaps(g, items)
    swap = ""
    if sw:
        swap = ('<div class="sswap"><b>이번 주 비싼 것, 이렇게 바꿔요</b><ul>'
                + "".join(f'<li>{e(u["name"])} <span class="up">+{u["m"]:.1f}%</span> → {e(use)}엔 <b>{e(c["name"])}</b>({c["m"]:.1f}%)</li>'
                          for u, c, use in sw) + "</ul></div>")
    d = dt.date.fromisoformat(r["date"])
    return (f'<section class="scard" data-week="{r["date"]}" aria-label="이번 주 장보기 리스트">'
            f'<div class="sh"><b>🛒 이번 주 장보기</b><span>{week_label(r["date"])} · {d.month}/{d.day} 시세</span></div>'
            + "".join(rows) + swap
            + f'<div class="sf"><span>출처: KAMIS 소매가(전국 평균)</span><span>don3chon.com/shopping</span></div></section>')


def body(reps: list[dict], recs: list[dict], root: str = "") -> str:
    e = html.escape
    r = latest(reps)
    if not r:
        return ('<article class="shop"><h1>이번 주 장보기 리스트</h1><p>첫 시세 리포트가 나오면 매주 월요일 아침 이곳에 '
                '지금 싼 재료 5개와 반찬을 정리해요.</p></article>')
    g = r["grocery"]
    return (f'<article class="shop"><h1>이번 주 장보기 리스트 ({week_label(r["date"])})</h1>'
            f'<p class="muted">매주 월요일 아침 공공 시세로 자동 정리 · {r["date"]} 기준</p>'
            + card(r, reps, recs, root)
            + '<p class="cap">화면을 캡처해 두거나 이 페이지를 즐겨찾기 해 두면 마트에서 바로 볼 수 있어요. 체크한 칸은 이 기기에 기억돼요.</p>'
            + '<h2>이 리스트는 이렇게 골라요</h2>'
            f'<p>한국농수산식품유통공사 KAMIS가 매일 발표하는 소매가 {g["count"]}개 품목 중, 한 달 전보다 값이 내린 품목에서 '
            '집에서 자주 쓰는 재료를 먼저 골라요. 같은 재료의 품종(예: 오이 여러 종류)은 하나만 넣어요. '
            '가격은 전국 평균 소매가라 동네 마트·시장 값과는 차이가 있어요.</p>'
            '<h2>아하! 한 줄은 이렇게 나와요</h2><ul>'
            '<li><b>작년 이맘때 비교</b>: 한 달 새 내렸어도 1년 전보다 비싸면 "쟁이지 말고 쓸 만큼만", 둘 다 싸면 "드문 때"라고 알려 줘요.</li>'
            '<li><b>기록 중 가장 싼 주</b>: 매주 쌓은 시세가 네 주 이상 되면, 이번 주가 그중 가장 싼지 비교해요.</li>'
            '<li><b>바꿔 쓰기</b>: 한 달 새 많이 오른 재료는 같은 쓰임의 싼 재료로 바꾸는 방법을 붙여요.</li>'
            '<li><b>손질·보관</b>: 싸게 사도 버리면 손해라, 오래 두고 남김없이 쓰는 방법을 적었어요.</li></ul>'
            f'<h2>더 보기</h2><p>기름값·환율까지 담은 전체 숫자는 <a href="{root}report/{r["date"]}.html">이번 주 생활물가 리포트</a>, '
            f'반찬 원가는 <a href="{root}recipe.html">1인분 원가 레시피</a>에서 볼 수 있어요.</p>'
            f'<script>{JS}</script></article>')
