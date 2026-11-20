"""외부 API 직접 점검 (2026-11-19 BK: "사이트 API가 문제 없는지 수시로 체크").

.github/workflows/api-check.yml 이 하루 4번(07:15·11:20·16:20·21:20 KST) 실행한다.
매일 아침 상태 점검(scripts/health_check.py)은 '결과'(작업 실패·데이터 공백)를 보고,
이 점검은 사이트·자동 작업이 기대는 외부 API에 직접 한 번씩 접속해 키 만료·권한·응답 오류를 미리 잡는다.

점검 항목 (키가 등록돼 있지 않은 항목은 조용히 건너뛴다. 모두 무료 호출이고 하루 4번이라 한도에 영향 없음)
- 생활 시세: 오피넷(유가), ECOS(환율), KAMIS(장바구니)
- 제휴: 알리익스프레스(상품 조회 1개), 쿠팡 파트너스(검색 1개)
- 구글 연결(리프레시 토큰): 돈삼촌·5락실 유튜브 업로드, 유튜브 통계 2개, 서치콘솔, 드라이브 백업
- 유튜브 데이터 API 키, Claude API 키(모델 목록, 무료), 텔레그램 봇

알림 규칙 (텔레그램 BK 개인 대화, 기존 상태 점검과 같은 채널)
- 키·인증 문제(401/403, invalid_grant 등)는 처음 발견한 회차에 바로 알린다.
- 연결 끊김·5xx·빈 응답처럼 일시적일 수 있는 문제는 2회 연속일 때 알린다.
- 같은 문제는 하루 한 번만 다시 알리고, 고쳐지면 "복구" 한 줄을 보낸다.
상태는 .apicheck/state.json (Actions 캐시)에 남긴다. 키·토큰 값은 절대 출력하지 않는다.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

STATE = pathlib.Path(os.environ.get("API_CHECK_STATE", ".apicheck/state.json"))
REMIND_H = 24
UA = {"User-Agent": "Mozilla/5.0 (api-check)"}
AUTH = "auth"   # 키·권한 문제: 바로 알림
TEMP = "temp"   # 일시적일 수 있음: 2회 연속일 때 알림


class Problem(Exception):
    def __init__(self, kind: str, msg: str):
        super().__init__(msg)
        self.kind, self.msg = kind, msg


def env(name: str) -> str:
    return os.environ.get(name, "").strip()


def fetch(url: str, data: bytes | None = None, headers: dict | None = None, timeout: int = 25) -> tuple[int, str]:
    """(상태 코드, 본문). 연결 실패는 Problem(TEMP). URL·키는 메시지에 넣지 않는다."""
    req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # 시간 초과·연결 실패
        raise Problem(TEMP, f"연결 실패({type(e).__name__})") from None


def status_problem(st: int) -> Problem:
    if st in (401, 403):
        return Problem(AUTH, f"인증 거절({st}) — 키 만료·권한 문제일 수 있어요")
    if st == 429:
        return Problem(TEMP, "호출 한도 초과(429)")
    return Problem(TEMP, f"응답 오류({st})")


def get_json(url: str, **kw) -> dict:
    st, txt = fetch(url, **kw)
    if st != 200:
        raise status_problem(st)
    try:
        return json.loads(txt)
    except ValueError:
        raise Problem(TEMP, "JSON이 아닌 응답(점검 중 페이지일 수 있음)") from None


# ---------- 생활 시세 (daily.yml) ----------

def check_opinet() -> None:
    js = get_json("https://www.opinet.co.kr/api/avgAllPrice.do?" + urllib.parse.urlencode({"out": "json", "code": env("OPINET_KEY")}))
    if not js.get("RESULT", {}).get("OIL"):
        raise Problem(AUTH, "데이터가 비어 있어요(키 만료·해지 가능성)")


def check_ecos(today: dt.date) -> None:
    from . import daily
    js = get_json(f"https://ecos.bok.or.kr/api/StatisticSearch/{urllib.parse.quote(env('ECOS_KEY'))}/json/kr/1/100/731Y001/D/"
                  f"{today - dt.timedelta(days=45):%Y%m%d}/{today:%Y%m%d}/0000001")
    if daily.parse_fx(js):
        return
    code = str((js.get("RESULT") or {}).get("CODE", ""))
    raise Problem(AUTH if code.startswith("INFO-1") or code.startswith("ERROR-1") else TEMP,
                  f"환율 데이터 없음{f'(코드 {code})' if code else ''}")


def check_kamis(wait: float = 10) -> None:
    from . import daily
    url = "https://www.kamis.or.kr/service/price/xml.do?" + urllib.parse.urlencode(
        {"action": "dailySalesList", "p_cert_key": env("KAMIS_KEY"), "p_cert_id": env("KAMIS_ID"), "p_returntype": "json"})
    # KAMIS 는 Actions(해외) 서버에서 시간 초과가 잦다. 연결 실패만 한 번 더 시도한다 (2026-11-20).
    try:
        js = get_json(url, timeout=40)
    except Problem as p:
        if not p.msg.startswith("연결 실패"):
            raise
        time.sleep(wait)
        js = get_json(url, timeout=40)
    if daily.parse_grocery(js):
        return
    data = js.get("data") if isinstance(js.get("data"), dict) else {}
    code = str(js.get("error_code") or data.get("error_code") or "")
    # KAMIS 는 인증 실패도 200 으로 돌려준다. 성공 코드(000)인데 비었으면 일시적, 그 밖의 코드는 키 문제로 본다.
    raise Problem(TEMP if code in ("", "000") else AUTH, f"장바구니 시세가 비어 있어요{f'(코드 {code})' if code else ''}")


# ---------- 제휴 ----------

def check_ali() -> None:
    from .aliexpress import AliExpressClient
    c = AliExpressClient()
    try:
        r = c._call("aliexpress.affiliate.product.query", keywords="kitchen", page_size=1,
                    target_currency="KRW", target_language="KO", ship_to_country="KR", tracking_id=c.tracking_id)
    except urllib.error.HTTPError as e:
        raise status_problem(e.code) from None
    except urllib.error.URLError as e:
        raise Problem(TEMP, f"연결 실패({type(e.reason).__name__})") from None
    body = next(iter(r.values())) if r else {}
    if "error_response" in r:
        err = r["error_response"]
        code = str(err.get("code", ""))
        kind = AUTH if any(k in code for k in ("Invalid", "Permission", "AppKey", "Signature", "Forbidden")) else TEMP
        raise Problem(kind, f"오류 {code}: {str(err.get('msg', ''))[:80]}")
    rc = str((body.get("resp_result") or {}).get("resp_code", "200"))
    if rc != "200":
        raise Problem(TEMP, f"응답 코드 {rc}: {str((body.get('resp_result') or {}).get('resp_msg', ''))[:80]}")


def check_coupang() -> None:
    from .coupang import BASE, CoupangClient
    try:
        r = CoupangClient(sub_id="")._request("GET", f"{BASE}/products/search", {"keyword": "수세미", "limit": 1})
    except urllib.error.HTTPError as e:
        raise status_problem(e.code) from None
    except urllib.error.URLError as e:
        raise Problem(TEMP, f"연결 실패({type(e.reason).__name__})") from None
    code = str(r.get("rCode", "0"))
    if code != "0":
        raise Problem(AUTH, f"오류 코드 {code}: {str(r.get('rMessage', ''))[:80]}")


# ---------- 구글·기타 ----------

GOOGLE_TOKENS = [  # (리프레시 토큰 Secret, 이름)
    ("YT_REFRESH_TOKEN", "돈삼촌 유튜브 업로드"),
    ("RAKSIL_YT_REFRESH_TOKEN", "5락실 유튜브 업로드"),
    ("YT_ANALYTICS_REFRESH_TOKEN", "돈삼촌 유튜브 통계"),
    ("RAKSIL_YT_ANALYTICS_REFRESH_TOKEN", "5락실 유튜브 통계"),
    ("GSC_REFRESH_TOKEN", "서치콘솔 수집"),
    ("DRIVE_REFRESH_TOKEN", "드라이브 백업"),
]


def check_google(secret: str) -> None:
    data = urllib.parse.urlencode({"client_id": env("YT_CLIENT_ID"), "client_secret": env("YT_CLIENT_SECRET"),
                                   "refresh_token": env(secret), "grant_type": "refresh_token"}).encode()
    st, txt = fetch("https://oauth2.googleapis.com/token", data=data)
    if st == 200:
        return
    try:
        err = json.loads(txt).get("error", "")
    except ValueError:
        err = ""
    if err in ("invalid_grant", "invalid_client", "unauthorized_client"):
        raise Problem(AUTH, f"구글 연결이 끊겼어요({err}) — 다시 연결(재인증)이 필요해요")
    raise status_problem(st)


def check_youtube_key() -> None:
    get_json("https://www.googleapis.com/youtube/v3/videos?" + urllib.parse.urlencode(
        {"part": "id", "chart": "mostPopular", "regionCode": "KR", "maxResults": 1, "key": env("YOUTUBE_API_KEY")}))


def check_anthropic() -> None:
    get_json("https://api.anthropic.com/v1/models?limit=1",
             headers={"x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01"})


def check_telegram() -> None:
    js = get_json(f"https://api.telegram.org/bot{env('TELEGRAM_BOT_TOKEN')}/getMe")
    if not js.get("ok"):
        raise Problem(AUTH, "봇 토큰이 거절됐어요")


def checks(today: dt.date) -> list[tuple[str, str, object]]:
    """(키, 이름, 함수). 필요한 키가 없는 항목은 뺀다."""
    has = lambda *ks: all(env(k) for k in ks)
    out = []
    if has("OPINET_KEY"):
        out.append(("opinet", "생활 시세·유가(오피넷)", check_opinet))
    if has("ECOS_KEY"):
        out.append(("ecos", "생활 시세·환율(ECOS)", lambda: check_ecos(today)))
    if has("KAMIS_KEY", "KAMIS_ID"):
        out.append(("kamis", "생활 시세·장바구니(KAMIS)", check_kamis))
    if has("ALI_APP_KEY", "ALI_APP_SECRET"):
        out.append(("ali", "알리익스프레스 제휴 API", check_ali))
    if has("COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY"):
        out.append(("coupang", "쿠팡 파트너스 API", check_coupang))
    if has("YT_CLIENT_ID", "YT_CLIENT_SECRET"):
        for sec, name in GOOGLE_TOKENS:
            if has(sec):
                out.append((sec.lower(), f"구글 연결·{name}", lambda s=sec: check_google(s)))
    if has("YOUTUBE_API_KEY"):
        out.append(("yt_key", "유튜브 데이터 API 키", check_youtube_key))
    if has("ANTHROPIC_API_KEY"):
        out.append(("anthropic", "Claude API 키(쇼츠 대본)", check_anthropic))
    if has("TELEGRAM_BOT_TOKEN"):
        out.append(("telegram", "텔레그램 봇", check_telegram))
    return out


def run_checks(items) -> dict[str, dict]:
    res = {}
    for key, name, fn in items:
        try:
            fn()
            res[key] = {"name": name, "ok": True}
        except Problem as p:
            res[key] = {"name": name, "ok": False, "kind": p.kind, "msg": p.msg}
        except Exception as e:  # 예상 못 한 오류도 키 값 없이 종류만
            res[key] = {"name": name, "ok": False, "kind": TEMP, "msg": f"예상 못 한 오류({type(e).__name__})"}
        r = res[key]
        print(f"{name}: {'OK' if r['ok'] else r['kind'] + ' ' + r['msg']}")
    return res


def decide(res: dict[str, dict], state: dict, now: dt.datetime) -> tuple[list[str], list[str], dict]:
    """(알릴 문제, 복구된 항목, 새 상태). state: {키: {"fails": n, "alerted": iso | None}}"""
    alerts, recovered, new = [], [], {}
    for key, r in res.items():
        prev = state.get(key, {})
        if r["ok"]:
            if prev.get("alerted"):
                recovered.append(r["name"])
            continue
        fails = prev.get("fails", 0) + 1
        alerted = prev.get("alerted")
        due = r["kind"] == AUTH or fails >= 2
        stale = not alerted or now - dt.datetime.fromisoformat(alerted) >= dt.timedelta(hours=REMIND_H)
        if due and stale:
            alerts.append(f"• {r['name']}: {r['msg']}")
            alerted = now.isoformat()
        new[key] = {"fails": fails, "alerted": alerted}
    return alerts, recovered, new


def message(alerts: list[str], recovered: list[str], now: dt.datetime) -> str | None:
    stamp = (now + dt.timedelta(hours=9)).strftime("%m/%d %H:%M")
    parts = []
    if alerts:
        parts.append(f"⚠️ 외부 API 점검 ({stamp} KST)\n" + "\n".join(alerts)
                     + "\n\nClaude 프로젝트에 이 메시지를 그대로 붙여 주시면 고칠게요.")
    if recovered:
        parts.append(f"✅ API 복구 ({stamp} KST): " + ", ".join(recovered))
    return "\n\n".join(parts) or None


QUIET_START, QUIET_END = 23, 7  # KST. BK 11/21 "잠자는 시간에는 안 오게" → 예약은 낮으로 옮겼고, 늦게 밀린 실행만 조용히 보냄


def quiet_now(now: dt.datetime | None = None) -> bool:
    """KST 23:00~07:00 이면 True. GitHub 예약이 몇 시간 밀려 밤에 돈 경우 소리·진동 없이 보낸다."""
    h = ((now or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc) + dt.timedelta(hours=9)).hour
    return h >= QUIET_START or h < QUIET_END


def send(text: str) -> bool:
    """BK 개인 대화(관리자 방)로 보내는 공용 함수. 관리자 알림은 모두 여기를 거친다."""
    tok, chat = env("TELEGRAM_BOT_TOKEN"), env("TELEGRAM_ADMIN_CHAT_ID")
    if not (tok and chat):
        return False
    body = json.dumps({"chat_id": chat, "text": text, "disable_web_page_preview": True,
                       "disable_notification": quiet_now()}).encode()
    try:
        st, _ = fetch(f"https://api.telegram.org/bot{tok}/sendMessage", data=body, headers={"content-type": "application/json"})
    except Problem:
        return False
    return st == 200


def main() -> int:
    now = dt.datetime.now(dt.timezone.utc)
    items = checks((now + dt.timedelta(hours=9)).date())
    if not items:
        print("등록된 키가 없어 점검할 항목이 없어요.")
        return 0
    try:
        state = json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    res = run_checks(items)
    alerts, recovered, new = decide(res, state, now)
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(new, ensure_ascii=False), encoding="utf-8")
    text = message(alerts, recovered, now)
    if not text:
        print(f"이상 없음 ({sum(r['ok'] for r in res.values())}/{len(res)} 정상)")
        return 0
    print(text)
    if send(text):
        return 0
    if not alerts:
        return 0
    print("::error::" + text.replace("\n", " "))  # 텔레그램이 안 되면 작업을 실패로 끝내 GitHub 메일로 알린다
    return 1


if __name__ == "__main__":
    sys.exit(main())
