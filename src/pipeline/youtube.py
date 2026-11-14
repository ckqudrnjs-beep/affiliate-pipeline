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
TAGS = ["돈줍는삼촌", "살림템", "알리익스프레스", "가전추천"]


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
        slug = json.loads(meta.read_text(encoding="utf-8"))["slug"]
        price_date = ""
        if spec.get("product"):
            pj = pathlib.Path("data/products") / f"{spec['product']}.json"
            if pj.exists():
                d = json.loads(pj.read_text(encoding="utf-8")).get("priceDate", "")
                price_date = f"{d[5:7].lstrip('0')}/{d[8:10].lstrip('0')}" if d else ""
        out.append({"order": "0", "slug": slug, "title": spec["title"].strip(), "intro": spec["description"].strip(),
                    "price_date": price_date,
                    "synthetic": "1" if any(x.get("type") == "uncle" for x in spec.get("scenes", [])) else "",
                    "ad": "1" if (spec.get("product") or spec.get("products")) else "0",
                    "date": spec["date"], "kind": spec.get("kind", "short"), "episode": str(ep),
                    "takeaway": spec.get("takeaway", ""), "site": spec.get("site_path", ""), "format": spec.get("format", "")})
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
TAGS = {"prices": "#기름값 #환율", "quiz": "#생활비퀴즈 #물가", "skit-calc": "#전기요금 #생활비", "skit-q": "#생활비 #절약",
        "skit-recipe": "#집밥 #배달비", "guide": "#생활비 #절약", "ox": "#생활비 #절약"}


def tags(row: dict) -> str:
    return TAGS.get(row.get("format", ""), "#돈줍는삼촌 #생활비") + ("" if is_long(row) else " #Shorts")


def is_long(row: dict) -> bool:
    return (row.get("kind") or "short").strip() == "long"


def ai_line(row: dict) -> str:
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


def build_description(row: dict) -> str:
    if not is_ad(row):
        return "\n".join(([row["takeaway"].strip()] if row.get("takeaway", "").strip() else []) + [
            row["intro"].strip(),
            f"자세한 계산·정리: https://don3chon.com/{row.get('site', '').strip()}".rstrip("/"),
            "",
            ai_line(row),
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
        return json.load(r)["access_token"]


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


def due_rows(queue: list[dict], log: dict, now: dt.datetime, interval: int, lead: int) -> list[tuple[dict, dt.datetime]]:
    """이번 실행에 올릴 것: 날짜가 정해진 영상(새 기획) 중 공개일이 lead 일 안에 든 것 + 날짜 없는 영상 1개."""
    out = []
    for r in queue:
        if r["slug"] in log or not (r.get("date") or "").strip():
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
