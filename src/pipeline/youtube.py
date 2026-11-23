"""유튜브 쇼츠 예약 업로드 (YouTube Data API v3, 표준 라이브러리만 사용).

- 대기열: config/youtube_queue.csv (order 순서), 영상: media/youtube/<slug>.mp4
- 실행 1회당 최대 1개. 다음 공개 시각(19:00 KST)이 LEAD_DAYS 안에 들어올 때만 올린다.
  올릴 때는 '비공개 + 예약 공개(publishAt)' 로 올려, BK가 공개 전에 YouTube Studio에서
  '유료 프로모션 포함' 칸을 체크할 시간을 남긴다 (이 항목은 API로 설정할 수 없음).
- 공개 간격: YT_INTERVAL_DAYS (기본 1일, 2026-11-09 BK 결정: 하루 1개).
- 기록: data/youtube/uploaded.json (중복 업로드 방지)
- 안전장치: YOUTUBE_ENABLED=true 가 아니면 무엇을 올릴지만 출력한다(dry-run).
- 유료 프로모션 (2026-11-11 BK 규칙): 자동으로 켜지지 않으면 게시하지 않는다.
  일단 '비공개(예약 없음)'로 올리고, paidProductPlacementDetails 를 켠 뒤 다시 읽어 true 가 확인될 때만
  예약 공개(또는 바로 공개)로 바꾼다. 확인이 안 되면 비공개로 두고 BK에게 알린다.
  (API 문서상 이 항목은 쓰기 불가로 나와 있어 실패할 수 있음. 토큰 범위는 youtube.force-ssl 필요)
- 준수 검사: 제목은 [광고]로 시작, 설명 첫 줄은 광고 문구. 아니면 올리지 않는다.

인증: GitHub Secrets YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN 에서만 읽고 로그에 찍지 않는다.
발급 방법은 docs/YOUTUBE_SETUP.md.
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import re
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

KST = dt.timezone(dt.timedelta(hours=9))
QUEUE = pathlib.Path("config/youtube_queue.csv")
MEDIA = pathlib.Path("media/youtube")
LOG = pathlib.Path("data/youtube/uploaded.json")

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"

PUBLISH_HOUR = 19  # KST, 퇴근 후 시청 시간대 (쇼츠)
LONG_HOUR = 20  # 롱폼
DISCLOSURE = "광고 · 알리익스프레스 제휴 링크가 포함된 콘텐츠로, 구매 시 일정액의 수수료를 받습니다."
TAGS = ["돈줍는삼촌", "생활비", "절약", "물가"]


def load_queue(path: pathlib.Path = QUEUE, episodes: bool = True) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    rows = sorted(rows, key=lambda r: int(r["order"]))
    return rows + (episode_rows() if episodes else [])


def episode_rows(ep_dir: pathlib.Path = pathlib.Path("data/episodes")) -> list[dict]:
    """새 기획 영상: 대본(data/episodes/*.json) + 만든 영상(meta) 이 있으면 대기열 행으로 (날짜 지정)."""
    out = []
    for meta in sorted(ep_dir.glob("*.meta.json")):
        ep = pathlib.Path(str(meta).replace(".meta.json", ".json"))
        if not ep.exists():
            continue
        spec = json.loads(ep.read_text(encoding="utf-8"))
        mj = json.loads(meta.read_text(encoding="utf-8"))
        slug = mj["slug"]
        price_date = ""
        if spec.get("product"):
            pj = pathlib.Path("data/products") / f"{spec['product']}.json"
            if pj.exists():
                d = json.loads(pj.read_text(encoding="utf-8")).get("priceDate", "")
                price_date = f"{d[5:7].lstrip('0')}/{d[8:10].lstrip('0')}" if d else ""
        out.append({"order": "0", "slug": slug, "title": spec["title"].strip(), "intro": spec["description"].strip(),
                    "price_date": price_date,
                    # 실사처럼 보이는 AI 클립(BK 제작, 2026-11-19)도 '변경·합성 콘텐츠' 표시
                    "synthetic": "1" if (any(x.get("type") == "uncle" for x in spec.get("scenes", []))
                                         or any(c.get("realistic") for c in mj.get("credits") or [])) else "",
                    "ai_clip": "1" if any(c.get("ai") for c in mj.get("credits") or []) else "",
                    "ai_note": mj.get("ai_note", ""),  # 손으로 만든 편(만화 등)의 AI 표시 문구 (2026-11-19)
                    "quality_ok": quality_ok(spec, mj),
                    "ad": "1" if (spec.get("product") or spec.get("products")) else "0",
                    "date": spec["date"], "kind": spec.get("kind", "short"), "episode": str(ep),
                    "takeaway": spec.get("takeaway", ""), "site": spec.get("site_path", ""), "format": spec.get("format", ""),
                    "credits": "; ".join(f"{c['credit']} {c['page']}".strip() for c in mj.get("credits") or [] if not c.get("ai"))})
    return out


def load_log(path: pathlib.Path = LOG) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def is_synthetic(row: dict) -> bool:
    """HeyGen 같은 사실적인 AI 인물 영상 (대기열 synthetic 열 = 1)."""
    return str(row.get("synthetic") or "").strip() == "1"


def is_ad(row: dict) -> bool:
    """상품이 나오는 편(제휴 링크). 대기열 ad 열이 0 이면 상품 없는 편."""
    return str(row.get("ad") or "1").strip() != "0"


# 쇼츠 해시태그: 주제 2개 + #Shorts (3개 넘기지 않음, 2026-11-15 조회수 규칙). 형식은 대본 format.
HASHTAGS = {"prices": "#장보기 #물가", "basket": "#장보기 #제철", "quiz": "#생활비퀴즈 #물가", "skit-calc": "#전기요금 #생활비", "skit-q": "#살림 #전기요금",
        "skit-recipe": "#집밥 #배달비", "guide": "#살림 #절약", "ox": "#생활비 #절약",
        "toon": "#동전이 #살림", "toon-sok": "#동전이 #살림"}


def tags(row: dict) -> str:
    return HASHTAGS.get(row.get("format", ""), "#돈줍는삼촌 #생활비") + ("" if is_long(row) else " #Shorts")


def is_long(row: dict) -> bool:
    return (row.get("kind") or "short").strip() == "long"


def ai_line(row: dict) -> str:
    if row.get("ai_note"):
        return row["ai_note"]
    if is_synthetic(row) and row.get("ai_clip"):  # BK 가 만든 실사풍 AI 클립 (2026-11-19)
        return "AI로 생성한 영상과 AI 음성, AI 가상 캐릭터가 나오는 영상입니다."
    return ("AI로 만든 가상 인물과 AI 음성이 나오는 영상입니다." if is_synthetic(row)
            else "내레이션: AI 음성")


def episode_links(row: dict) -> list[str]:
    """롱폼: 대본 파일의 상품 제휴 링크 + 챕터."""
    ep = row.get("episode")
    if not ep or not pathlib.Path(ep).exists():
        return []
    spec = json.loads(pathlib.Path(ep).read_text(encoding="utf-8"))
    out = []
    meta = pathlib.Path(ep).with_suffix(".meta.json")
    if meta.exists():
        ch = json.loads(meta.read_text(encoding="utf-8")).get("chapters") or []
        if ch and ch[0][0] > 0:
            ch = [[0, "시작"]] + ch
        if len(ch) >= 3:
            out += ["", "목차"] + [f"{int(t) // 60}:{int(t) % 60:02d} {name}" for t, name in ch]
    prods = [spec.get("product")] + list(spec.get("products") or [])
    lines = []
    for slug in [x for x in prods if x]:
        pj = pathlib.Path("data/products") / f"{slug}.json"
        if pj.exists():
            d = json.loads(pj.read_text(encoding="utf-8"))
            lines.append(f"- {d['name']}: https://don3chon.com/p/{slug}.html")
    if lines:
        out += ["", "영상 속 상품 (가격·계산과 알리익스프레스 제휴 링크는 아래 페이지에, 가격은 바뀔 수 있어요)"] + lines
    return out


# 2026-11-23 BK '채널 모두 구독 좋아요 등 유도합시다': 쇼츠 설명란 부드러운 구독 한 줄 (돈 강조·보상 약속 없음)
SUB_LINE = "🔔 동전이 이야기는 이틀에 한 번 저녁 7시에 올라와요. 구독해 두면 알림이 가요."


def build_description(row: dict) -> str:
    if not is_ad(row):
        return "\n".join(([row["takeaway"].strip()] if row.get("takeaway", "").strip() else []) + [
            row["intro"].strip(),
            f"자세한 계산·정리: https://don3chon.com/{row.get('site', '').strip()}".rstrip("/"),
        ] + ([] if is_long(row) else [SUB_LINE]) + [
            "",
            ai_line(row),
        ] + ([f"배경 영상(무료 스톡): {row['credits']}"] if row.get("credits") else []) + (  # 2026-11-18 실사 배경 출처
            ["일부 배경 영상은 AI로 생성했어요."] if row.get("ai_clip") and not is_synthetic(row) and not row.get("ai_note") else []) + [
            tags(row),
        ])
    lines = [DISCLOSURE, row["intro"].strip()]
    if row.get("price_date", "").strip():
        lines.append(f"가격은 {row['price_date'].strip()} 기준이며 바뀔 수 있어요. 비교·계산은 don3chon.com")
    else:
        lines.append("비교·계산은 don3chon.com")
    if is_long(row):
        lines += episode_links(row)
    lines += ["", ai_line(row), "#돈줍는삼촌" + ("" if is_long(row) else " #Shorts")]
    return "\n".join(lines)


def check(row: dict, description: str) -> list[str]:
    errors = []
    title = row["title"].strip()
    if is_ad(row) and not title.startswith("[광고]"):
        errors.append("제목이 [광고]로 시작하지 않음")
    if len(title) > 100:
        errors.append("제목 100자 초과")
    if is_ad(row) and not description.splitlines()[0].startswith("광고"):
        errors.append("설명 첫 줄이 광고 문구가 아님")
    if len(description.encode("utf-8")) > 5000:
        errors.append("설명 5000바이트 초과")
    if "<" in title + description or ">" in title + description:
        errors.append("제목·설명에 < > 사용 불가")
    return errors


def next_slot(log: dict, now: dt.datetime, interval_days: int) -> dt.datetime:
    """다음 공개 시각. 마지막 예약 + 간격, 단 내일 19:00 KST 보다 이르지 않게."""
    tomorrow = (now.astimezone(KST) + dt.timedelta(days=1)).replace(
        hour=PUBLISH_HOUR, minute=0, second=0, microsecond=0)
    times = [dt.datetime.fromisoformat(v["publish_at"]) for v in log.values()]
    if not times:
        return tomorrow
    nxt = (max(times) + dt.timedelta(days=interval_days)).astimezone(KST)
    # 바로 공개(YT_NOW)한 영상은 19:00 이 아닐 수 있어, 다음 영상은 그 날짜의 19:00 으로 맞춘다
    return max(tomorrow, nxt.replace(hour=PUBLISH_HOUR, minute=0, second=0, microsecond=0))


def pick(queue: list[dict], log: dict) -> dict | None:
    for row in queue:
        if row["slug"] not in log:
            return row
    return None


def access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    data = urllib.parse.urlencode({
        "client_id": client_id, "client_secret": client_secret,
        "refresh_token": refresh_token, "grant_type": "refresh_token",
    }).encode()
    with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=data), timeout=30) as r:
        tok = json.load(r)["access_token"]
    check_channel(tok, refresh_token)
    return tok


CHANNELS_CFG = pathlib.Path(__file__).resolve().parents[2] / "config/yt_channels.json"


class WrongChannel(RuntimeError):
    pass


def check_channel(tok: str, refresh_token: str) -> None:
    """채널 확인 (BK 11/24 '비케이요 돈삼촌이 댓글을 달았어 안돼' + '메일 하나당 채널이 2개씩이라 조심해야돼').
    config/yt_channels.json 에 있는 토큰(환경 변수 값이 같은 것)이면 토큰의 채널을 읽어 맞는지 본다.
    다르거나 확인이 안 되면 WrongChannel 로 멈춘다 → 그 뒤 업로드·댓글·수정이 엉뚱한 채널에 가지 않는다.
    표에 없는 토큰(분석 전용 등)은 그냥 통과."""
    try:
        cfg = json.loads(CHANNELS_CFG.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    env = next((k for k, v in cfg.items() if isinstance(v, dict) and refresh_token.strip()
                and os.environ.get(k, "").strip() == refresh_token.strip()), None)
    if not env:
        return
    want = cfg[env]
    try:
        req = urllib.request.Request("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
                                     headers={"Authorization": f"Bearer {tok}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            it = (json.load(r).get("items") or [{}])[0]
    except Exception as e:  # noqa: BLE001
        raise WrongChannel(f"{env}: 토큰 채널 확인 실패({getattr(e, 'code', type(e).__name__)}) → 안전하게 멈춤. "
                           "토큰을 youtube.upload + youtube.force-ssl 로 다시 받기 (docs/YOUTUBE_SETUP.md)") from None
    cid, title = it.get("id", ""), it.get("snippet", {}).get("title", "")
    others = {v.get("id") for k, v in cfg.items() if isinstance(v, dict) and k != env and v.get("id")}
    ok = (cid == want["id"]) if want.get("id") else (
        cid and cid not in others and any(m.lower().replace(" ", "") in title.lower().replace(" ", "") for m in want.get("match", [])))
    if not ok:
        raise WrongChannel(f"{env}: 토큰 채널이 '{title or '?'}'({cid}) — '{want['name']}' 가 아니라 멈춤. "
                           f"oauthplayground 채널 선택에서 '{want['name']}' 를 골라 다시 받기 (docs/YOUTUBE_SETUP.md '채널 확인')")
    print(f"{env}: 채널 확인 '{title}'")


def video_body(row: dict, description: str, publish_at: dt.datetime | None, private: bool = False) -> dict:
    """publish_at 이 None 이면 바로 공개 (수동 실행 YT_NOW=true). private=True 면 예약 없는 비공개."""
    status = ({"privacyStatus": "private"} if private else {"privacyStatus": "public"} if publish_at is None else {
        "privacyStatus": "private",  # publishAt 은 private 일 때만 설정 가능
        "publishAt": publish_at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    return {
        "snippet": {
            "title": row["title"].strip(),
            "description": description,
            "tags": TAGS,
            "categoryId": "26",  # Howto & Style
            "defaultLanguage": "ko",
            "defaultAudioLanguage": "ko",
        },
        "status": {
            **status,
            "selfDeclaredMadeForKids": False,
            "containsSyntheticMedia": is_synthetic(row),  # AI 가상 인물이면 True, 상품 사진 편집 + AI 내레이션은 False
            "embeddable": True,
        },
    }


def upload(token: str, body: dict, video: pathlib.Path) -> dict:
    size = video.stat().st_size
    req = urllib.request.Request(UPLOAD_URL, data=json.dumps(body).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": str(size),
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        location = r.headers["Location"]
    put = urllib.request.Request(location, data=video.read_bytes(), method="PUT", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "video/mp4",
    })
    with urllib.request.urlopen(put, timeout=600) as r:
        return json.load(r)


def api(token: str, method: str, url: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def get_video(token: str, vid: str) -> dict:
    r = api(token, "GET", f"{VIDEOS_URL}?part=status,paidProductPlacementDetails&id={vid}")
    return (r.get("items") or [{}])[0]


def paid_promotion_on(token: str, vid: str) -> bool:
    """유료 프로모션을 켜 보고, 다시 읽어 true 일 때만 True. 어떤 오류든 False."""
    try:
        if get_video(token, vid).get("paidProductPlacementDetails", {}).get("hasPaidProductPlacement"):
            return True
        api(token, "PUT", f"{VIDEOS_URL}?part=paidProductPlacementDetails",
            {"id": vid, "paidProductPlacementDetails": {"hasPaidProductPlacement": True}})
        return bool(get_video(token, vid).get("paidProductPlacementDetails", {}).get("hasPaidProductPlacement"))
    except Exception as e:  # noqa: BLE001 - 실패하면 게시하지 않는 쪽으로
        detail = e.read().decode("utf-8", "replace")[:300] if hasattr(e, "read") else str(e)
        print(f"유료 프로모션 자동 설정 실패: {detail}")
        return False


def set_visibility(token: str, vid: str, publish_at: dt.datetime | None) -> None:
    """확인된 영상만: 예약 공개(publish_at) 또는 바로 공개(None)."""
    st = get_video(token, vid)["status"]
    keep = {k: st[k] for k in ("embeddable", "license", "publicStatsViewable", "selfDeclaredMadeForKids",
                               "containsSyntheticMedia") if k in st}
    status = {"privacyStatus": "public"} if publish_at is None else {
        "privacyStatus": "private", "publishAt": publish_at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    api(token, "PUT", f"{VIDEOS_URL}?part=status", {"id": vid, "status": {**keep, **status}})


def guard(token: str, vid: str, publish_at: dt.datetime | None) -> bool:
    """유료 프로모션이 켜졌을 때만 공개 일정을 건다. 아니면 비공개 그대로."""
    if not paid_promotion_on(token, vid):
        return False
    set_visibility(token, vid, publish_at)
    return True


def summary(text: str) -> None:
    print(text)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(text + "\n")


# 품질 게이트 (BK 2026-11-20 "품질이 떨어지는 문구 그리고 영상과 구도는 안하느니 못해").
# 이 날짜부터 공개하는 삼촌 쇼츠는 동전이 만화(meta style toon)·글자형(engine hyperframes)·사람이 확인한 편(meta quality_ok)만 올린다.
# 예전처럼 클립이 안 오면 실사판이 대신 나가는 안전망은 없앤다 — 그날은 그냥 쉰다.
QUALITY_GATE_FROM = "2026-11-23"

# 삼촌 쇼츠 돈 강조 금지 (BK 11/20 밤 "동전 날아가는 것·돈이 샌다 표현은 하지 말고 돈돈돈 강조할 필요 없어", 11/21 제목 돈 액수 훅 금지).
# 11/22 김치찌개 편이 옛 조립본(자막 '돈이 돌아온다!', 제목 '한 그릇 차이 얼마?') 그대로 수동 실행으로 나간 일 뒤에 넣음 (11/23).
# 'Veo 크레딧 쓴 클립은 예외'(11/22)는 그림(클립)만 해당 — 제목·설명·자막 글자는 예외 아님.
TONE_FROM = "2026-11-21"
MONEY_RE = re.compile(r"금화|저금통|꿀꿀이|돈이|새는\s*돈|돈\s*새|얼마(?!나)|\d[\d,]*\s*(?:만\s*)?원|만\s*원|돈\s*(?:아끼|번다|벌|줍|모으)")


def money_hits(text: str) -> list[str]:
    """돈 강조 말(금화·저금통·'돈이 …'·'얼마'·금액). '얼마나'·'동전이'(이름)는 걸리지 않는다."""
    return sorted({m.group(0) for m in MONEY_RE.finditer(text or "")})


def toon_captions(note: str) -> str:
    """meta note 에 적힌 조립 spec(data/toon/<날짜>.json)의 화면 글자를 모은다. 없으면 빈 문자열."""
    m = re.search(r"data/toon/\d{4}-\d\d-\d\d\.json", note or "")
    path = pathlib.Path(m.group(0)) if m else None
    if not path or not path.exists():
        return ""
    spec = json.loads(path.read_text(encoding="utf-8"))
    band = spec.get("band") if isinstance(spec.get("band"), dict) else {}
    out = [band.get("top", ""), band.get("accent", "")]
    for c in spec.get("cuts", []):
        out += list(c.get("lines", [])) + list(c.get("after", [])) + [c.get("big", ""), c.get("sub", "")]
    return "\n".join(x for x in out if isinstance(x, str))


def tone_issues(spec: dict, meta: dict) -> list[str]:
    """삼촌 쇼츠(11/21 공개분부터)의 제목·설명·화면 자막에 돈 강조 말이 있으면 그 말들. meta tone_ok: true 면 BK 가 본 것으로 통과."""
    if meta.get("tone_ok") is True or (spec.get("date") or "") < TONE_FROM or spec.get("kind", "short") != "short":
        return []
    text = "\n".join([spec.get("title", ""), toon_captions(meta.get("note", ""))])
    return money_hits(text)


def quality_ok(spec: dict, meta: dict) -> bool:
    if meta.get("quality_ok") is False:  # 사람이 '이 편은 쉬자'로 막은 편은 날짜와 상관없이 안 올림 (11/20 밤 찌개 편)
        return False
    if spec.get("format") == "toon-sok" and spec.get("date"):  # 번외 속마음은 삼촌 고정 기간(config/shorts_lock.json)엔 안 올림 (BK 11/22)
        from .shorts_lock import locked
        if locked("uncle", spec["date"]):
            return False
    if tone_issues(spec, meta):  # 돈 강조 말이 제목·자막에 있으면 안 올림 (11/23)
        return False
    if (spec.get("date") or "") < QUALITY_GATE_FROM or spec.get("kind", "short") != "short":
        return True
    if "quality_ok" in meta:
        return bool(meta["quality_ok"])
    return meta.get("style") == "toon" or meta.get("engine") == "hyperframes"


def due_rows(queue: list[dict], log: dict, now: dt.datetime, interval: int, lead: int) -> list[tuple[dict, dt.datetime]]:
    """이번 실행에 올릴 것: 날짜가 정해진 영상(새 기획) 중 공개일이 lead 일 안에 든 것 + 날짜 없는 영상 1개.
    품질 게이트(BK 11/20)를 못 넘은 편은 건너뛰고 요약에 남긴다."""
    out = []
    for r in queue:
        if r["slug"] in log or not (r.get("date") or "").strip():
            continue
        if r.get("quality_ok") is False:
            summary(f"유튜브: {r['slug']} 품질 게이트 미통과 → 올리지 않음 (만화 클립으로 바꾸거나 meta 에 quality_ok: true)")
            continue
        hour = LONG_HOUR if is_long(r) else PUBLISH_HOUR
        slot = dt.datetime.fromisoformat(r["date"]).replace(hour=hour, tzinfo=KST)
        if now < slot and slot - now <= dt.timedelta(days=lead):
            out.append((r, slot))
    plain = [r for r in queue if r["slug"] not in log and not (r.get("date") or "").strip()]
    if plain:
        slot = next_slot(log, now, interval)
        taken = {s.date() for _, s in out if not is_long(_)}
        while slot.date() in taken:
            slot += dt.timedelta(days=1)
        if slot - now <= dt.timedelta(days=lead):
            out.append((plain[0], slot))
    return out


def upload_one(row: dict, slot: dt.datetime, now: dt.datetime, publish_now: bool, enabled: bool, log: dict) -> int:
    description = build_description(row)
    errors = check(row, description)
    video = MEDIA / f"{row['slug']}.mp4"
    if not video.exists():
        errors.append(f"영상 파일 없음: {video}")
    if errors:
        summary(f"::error::유튜브 업로드 중단 ({row['slug']}): " + ", ".join(errors))
        return 1
    if not enabled:
        summary(f"[dry-run] {row['title']} → {slot:%Y-%m-%d %H:%M} KST (YOUTUBE_ENABLED=true 가 아니라 안 올림)\n"
                f"```\n{description}\n```")
        return 0
    try:
        token = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"],
                             os.environ["YT_REFRESH_TOKEN"])
        if is_ad(row):  # 유료 프로모션이 확인될 때만 공개 (BK 규칙)
            res = upload(token, video_body(row, description, None, private=True), video)
            ok = guard(token, res["id"], None if publish_now else slot)
        else:  # 상품 없는 편은 유료 프로모션과 무관 → 바로 예약 공개
            res = upload(token, video_body(row, description, None if publish_now else slot), video)
            ok = True
    except KeyError as e:
        summary(f"::error::Secret 없음: {e.args[0]} (docs/YOUTUBE_SETUP.md)")
        return 1
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        summary(f"::error::유튜브 API 오류 {e.code}: {detail}")
        return 1
    vid = res["id"]
    log[row["slug"]] = {"video_id": vid, "publish_at": slot.isoformat(), "uploaded_at": now.isoformat(timespec="seconds"),
                        "paid_promotion": ok if is_ad(row) else None}
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if ok:
        summary(f"업로드 완료: {row['title']}\n- {slot:%m/%d %H:%M} KST 공개")
        if not publish_now:  # 게시물 예고 글 (BK 11/23 '구독할 이유'): 만화 편만, 텔레그램으로 → BK 붙여넣기
            from . import community_posts
            sent = community_posts.uncle(row, video, slot)
            if sent is not None:
                summary("📣 게시물 예고 글 " + ("텔레그램 전송" if sent else "전송 실패"))
    else:
        summary(f"::warning::업로드는 했지만 유료 프로모션을 자동으로 켜지 못해 **비공개**로 둠: {row['title']}\n"
                f"- BK가 Studio에서 유료 프로모션 체크 후 {slot:%m/%d %H:%M} KST 예약 공개: https://studio.youtube.com/video/{vid}/edit")
    return 0


def main(now: dt.datetime | None = None) -> int:
    now = now or dt.datetime.now(KST)
    enabled = os.environ.get("YOUTUBE_ENABLED", "").lower() == "true"
    interval = int(os.environ.get("YT_INTERVAL_DAYS") or 1)
    lead = int(os.environ.get("YT_LEAD_DAYS") or 2)
    publish_now = os.environ.get("YT_NOW", "").lower() == "true"  # 수동 실행: 지금 바로 공개
    want = os.environ.get("YT_SLUG", "").strip()

    log = load_log()
    queue = load_queue()
    if want:
        row = next((r for r in queue if r["slug"] == want and want not in log), None)
        if row is None:
            summary(f"유튜브: 대기열에 올릴 영상 없음 {want}")
            return 0
        if row.get("quality_ok") is False and os.environ.get("YT_FORCE", "").lower() != "true":
            # 수동 실행도 품질 게이트·돈 강조 점검을 지난다 (11/22 찌개 편이 이 길로 그대로 나감). 일부러 올릴 땐 force=true.
            summary(f"유튜브: {want} 품질 게이트·돈 강조 점검 미통과 → 안 올림. 제목·자막을 고치거나, BK 가 보고 올리기로 했으면 force=true 로 다시 실행")
            return 1
        if publish_now:
            jobs = [(row, now)]
        elif (row.get("date") or "").strip():
            jobs = [(row, dt.datetime.fromisoformat(row["date"]).replace(hour=LONG_HOUR if is_long(row) else PUBLISH_HOUR, tzinfo=KST))]
        else:
            jobs = [(row, next_slot(log, now, interval))]
    else:
        jobs = due_rows(queue, log, now, interval, lead)
    if not jobs:
        summary("유튜브: 지금 올릴 영상 없음")
        return 0
    rc = 0
    for row, slot in jobs:
        rc |= upload_one(row, slot, now, publish_now, enabled, log)
    return rc


if __name__ == "__main__":
    sys.exit(main())
