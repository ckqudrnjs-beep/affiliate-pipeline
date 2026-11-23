"""채널 첫 댓글 자동 (BK 2026-11-23 '채널 모두 구독 좋아요 등 유도합시다' → '네').

삼촌·5락실·BEEKAY SONGS 영상이 공개된 뒤, 채널 이름으로 짧은 질문 댓글을 하나 단다 (한 화만 더는 webnovel.post_comments 가 이미 함).
- 공개 시각이 지난, 최근 RECENT_DAYS 일 영상만. 한 영상에 한 번 (기록 data/youtube/first_comments.json).
- 문구: 질문 한 줄 + 다음 편 시각/구독 한마디. 보상 약속·강요·돈 강조 없음.
- 고정(핀)은 API가 없어 하지 않는다. 채널 댓글은 댓글 투표 집계에서 빠진다(toon_series.fetch_comments).
- 토큰에 youtube.force-ssl 권한이 있어야 한다. 없거나 실패하면 그 채널만 건너뛴다 (docs/YOUTUBE_SETUP.md '첫 댓글').
- 끄기: 저장소 변수 FIRST_COMMENT_ENABLED=false.

실행: PYTHONPATH=src python -m pipeline.first_comment [--dry]
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import sys
import urllib.request

KST = dt.timezone(dt.timedelta(hours=9))
LOG = pathlib.Path("data/youtube/first_comments.json")
RECENT_DAYS = 3
API = "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet"

TEXT = {
    "uncle": "오늘 동전이 이야기, 우리 집에도 있었던 장면인가요? 🐶\n다음 이야기는 모레 저녁 7시에 올라와요. 구독해 두면 알림이 가요.",
    "5raksil": "너라면 어느 쪽? 댓글로 A / B 남겨 주면 내일 결과에 같이 세요 ✋\n매일 오후 5시 새 질문이 올라와요.",
    "5raksil-quick": "세 개 다 골라 AAB 처럼 댓글로 남겨 주세요 ✋\n매일 오후 5시 새 질문이 올라와요.",
    "music": "어느 부분이 제일 귀에 남았나요? 🎧 댓글로 알려 주시면 다음 곡에 참고할게요.\n새 노래 알림은 구독으로 받을 수 있어요.",
}
TOKENS = {"uncle": "YT_REFRESH_TOKEN", "5raksil": "RAKSIL_YT_REFRESH_TOKEN", "music": "MUSIC_YT_REFRESH_TOKEN"}
# 11/24 00:23 BK '비케이요 돈삼촌이 댓글을 달았어 안돼': MUSIC 토큰이 돈삼촌 채널로 발급돼 노래 영상에 돈삼촌 이름으로 달림
# → 노래 채널은 BK 재확인 전까지 끔, 모든 채널은 댓글 전에 '토큰 채널 == 영상 채널' 확인.
ENABLED = ("uncle", "5raksil")
API_BASE = "https://www.googleapis.com/youtube/v3/"


def _api(tok: str, path: str, method: str = "GET") -> dict:
    req = urllib.request.Request(API_BASE + path, method=method, headers={"Authorization": f"Bearer {tok}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
    return json.loads(body) if body else {}


def my_channel(tok: str) -> tuple[str, str]:
    """토큰이 가리키는 채널 (id, 이름). 못 읽으면 ('', '')."""
    try:
        it = (_api(tok, "channels?part=snippet&mine=true").get("items") or [{}])[0]
        return it.get("id", ""), it.get("snippet", {}).get("title", "")
    except Exception:  # noqa: BLE001
        return "", ""


def video_channel(tok: str, vid: str) -> str:
    try:
        it = (_api(tok, f"videos?part=snippet&id={vid}").get("items") or [{}])[0]
        return it.get("snippet", {}).get("channelId", "")
    except Exception:  # noqa: BLE001
        return ""


def _when(s) -> dt.datetime | None:
    if not isinstance(s, str) or not s[:4].isdigit():  # 'private' 등
        return None
    try:
        t = dt.datetime.fromisoformat(s)
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=KST)


def _load(p: pathlib.Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def targets(now: dt.datetime, root: pathlib.Path = pathlib.Path(".")) -> list[tuple[str, str, str]]:
    """[(채널, 영상 id, 문구)] — 공개 시각이 지났고 최근 RECENT_DAYS 일 안인 영상."""
    since = now - dt.timedelta(days=RECENT_DAYS)
    out = []

    def add(ch, vid, at, text):
        if vid and at and since <= at <= now:
            out.append((ch, vid, text))

    for row in _load(root / "data/youtube/uploaded.json").values():
        if isinstance(row, dict):
            add("uncle", row.get("video_id"), _when(row.get("publish_at")), TEXT["uncle"])
    for k, row in _load(root / "data/youtube/raksil_uploaded.json").items():
        if isinstance(row, dict) and len(k) == 10 and k[:4].isdigit():  # 날짜 키 = 17:00 밸런스 쇼츠
            at = dt.datetime.combine(dt.date.fromisoformat(k), dt.time(17), KST)
            add("5raksil", row.get("id"), at, TEXT["5raksil-quick" if row.get("format") == "quick" else "5raksil"])
    for row in _load(root / "data/music/uploaded.json").values():
        if isinstance(row, dict):
            add("music", row.get("video_id"), _when(row.get("publish_at")), TEXT["music"])
            add("music", row.get("short_id"), _when(row.get("short_publish_at")), TEXT["music"])
    return out


def post(tok: str, vid: str, text: str) -> None:
    body = {"snippet": {"videoId": vid, "topLevelComment": {"snippet": {"textOriginal": text}}}}
    req = urllib.request.Request(API, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=30).read()


def run(now: dt.datetime | None = None, dry: bool = False) -> int:
    if os.environ.get("FIRST_COMMENT_ENABLED", "true").strip().lower() == "false":
        print("첫 댓글 꺼짐")
        return 0
    now = now or dt.datetime.now(KST)
    log = _load(LOG)
    todo = [t for t in targets(now) if t[1] not in log and t[0] in ENABLED]
    if dry:
        for ch, vid, text in todo:
            print(f"[{ch}] {vid}: {text.splitlines()[0]}")
        return 0
    cid, sec = os.environ.get("YT_CLIENT_ID", ""), os.environ.get("YT_CLIENT_SECRET", "")
    from .youtube import access_token
    toks: dict[str, str | None] = {}
    for ch, vid, text in todo:
        if ch not in toks:
            rt = os.environ.get(TOKENS[ch], "").strip()
            try:
                toks[ch] = access_token(cid, sec, rt) if (cid and sec and rt) else None
            except Exception as e:  # noqa: BLE001
                print(f"{ch}: 토큰 교환 실패 {type(e).__name__}")
                toks[ch] = None
        if not toks[ch]:
            continue
        mine, title = my_channel(toks[ch])
        owner = video_channel(toks[ch], vid)
        if not mine or mine != owner:  # 다른 채널 토큰이면 절대 달지 않는다
            print(f"{ch}: {vid} 건너뜀 — 토큰 채널 '{title or '확인 불가'}'({mine}) ≠ 영상 채널({owner or '확인 불가'})")
            continue
        try:
            post(toks[ch], vid, text)
            log[vid] = {"ch": ch, "at": now.isoformat(timespec="minutes")}
            print(f"{ch}: {vid} 첫 댓글 완료")
        except Exception as e:  # noqa: BLE001  권한 없음(403) 등 → 이 채널은 이번엔 그만
            print(f"{ch}: {vid} 첫 댓글 실패 {getattr(e, 'code', '')} (토큰에 youtube.force-ssl 필요)")
            toks[ch] = None
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return 0


def cleanup() -> int:
    """잘못된 채널 이름으로 단 첫 댓글 지우기 (11/24). 기록된 영상마다, 그 채널 토큰이 단 우리 문구 댓글 중
    토큰 채널 ≠ 영상 채널인 것만 지운다(comments.delete). 각 토큰이 어느 채널인지도 출력."""
    cid, sec = os.environ.get("YT_CLIENT_ID", ""), os.environ.get("YT_CLIENT_SECRET", "")
    from .youtube import access_token
    log = _load(LOG)
    firsts = {t.splitlines()[0] for t in TEXT.values()}
    from .youtube import check_channel, WrongChannel
    import urllib.parse
    for ch, env in TOKENS.items():
        rt = os.environ.get(env, "").strip()
        if not (cid and sec and rt):
            continue
        data = urllib.parse.urlencode({"client_id": cid, "client_secret": sec, "refresh_token": rt,
                                       "grant_type": "refresh_token"}).encode()
        with urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=30) as r:
            tok = json.load(r)["access_token"]  # 정리용: 채널이 틀려도 그 토큰이 단 댓글을 지워야 하므로 확인 없이
        try:
            check_channel(tok, rt)
        except WrongChannel as e:
            print(f"⚠ {e}")
        mine, title = my_channel(tok)
        print(f"{env} → 채널 '{title}' ({mine})")
        for vid, row in list(log.items()):
            if row.get("ch") != ch:
                continue
            owner = video_channel(tok, vid)
            if owner and owner == mine:
                continue
            js = _api(tok, f"commentThreads?part=snippet&videoId={vid}&maxResults=100&textFormat=plainText")
            for it in js.get("items", []):
                c = it["snippet"]["topLevelComment"]
                sn = c["snippet"]
                if (sn.get("authorChannelId") or {}).get("value") == mine and sn.get("textDisplay", "").splitlines()[:1] and \
                        sn["textDisplay"].splitlines()[0].strip() in firsts:
                    _api(tok, f"comments?id={c['id']}", method="DELETE")
                    print(f"  {vid}: '{title}' 이름 댓글 삭제")
                    log[vid] = {**row, "deleted": True}
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    if "cleanup" in sys.argv:
        sys.exit(cleanup())
    sys.exit(run(dry="--dry" in sys.argv))
