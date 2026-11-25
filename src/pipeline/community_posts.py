"""채널 '게시물'(커뮤니티) 예고 글 (BK 2026-11-23 '구독할 이유' → 웹소설 '먼저 보기' 뒤 다른 채널도).

YouTube Data API 에는 게시물을 올리는 기능이 없다. 그래서 영상을 공개 예약으로 올린 직후
그림 1장 + 붙여넣을 글을 텔레그램(BK 개인 대화)으로 보낸다. BK: 유튜브 앱 → 만들기 → 게시물 → 글 붙여넣기 + 그림.

- 삼촌(동전이 만화): 공개 예약한 편의 첫 장면 한 컷 + 공개 날짜·시각. 돈 강조 말이 있으면 보내지 않는다(11/20 톤 규칙).
- 5락실(밸런스): 오늘 질문 A/B + '댓글로 A나 B를 남겨 줘'. 게시물은 그림과 투표를 같이 못 붙여서 투표 대신 댓글(BK 11/26).
- BEEKAY SONGS: 새 곡 커버 + 공개 시각 (+ 버전 질문이 있으면 그 질문).
영상 형식은 바꾸지 않는다(BK 11/23 '형식 바꿔서 알고리즘 꼬일까봐'). 구독 대가·보상 약속 문구 금지(가짜 참여 정책).
끄기: config/community_posts.json 의 채널별 true/false.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
CFG = ROOT / "config" / "community_posts.json"
KST = dt.timezone(dt.timedelta(hours=9))
DAYS = "월화수목금토일"
HOWTO = "📣 게시물용 (글 복사 → 유튜브 앱 만들기 → 게시물 → 붙여넣기 + 이 그림 첨부)"
BANNED = ("구독하면 드려요", "구독자만", "구독 보상", "구독하면 선물", "좋아요 누르면")


def on(channel: str) -> bool:
    try:
        return bool(json.loads(CFG.read_text(encoding="utf-8")).get(channel, True))
    except (OSError, ValueError):
        return True


def when_ko(at: dt.datetime, now: dt.datetime | None = None) -> str:
    """'오늘 저녁 7시' / '내일 오후 5시' / '11/25(화) 저녁 7시'."""
    at = at.astimezone(KST); now = (now or dt.datetime.now(KST)).astimezone(KST)
    h = at.hour
    part = "밤" if h >= 20 else "저녁" if h >= 18 else "오후" if h >= 12 else "오전"
    hh = h - 12 if h > 12 else h
    t = f"{part} {hh}시" + (f" {at.minute}분" if at.minute else "")
    gap = (at.date() - now.date()).days
    day = "오늘" if gap == 0 else "내일" if gap == 1 else f"{at.month}/{at.day}({DAYS[at.weekday()]})"
    return f"{day} {t}"


def frame_png(video: str | pathlib.Path, sec: float, out: pathlib.Path) -> pathlib.Path | None:
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{sec:.2f}", "-i", str(video), "-frames:v", "1", str(out)],
                       capture_output=True)
    return out if r.returncode == 0 and out.exists() else None


def safe(text: str) -> bool:
    return not any(b in text for b in BANNED)


def uncle_text(title: str, at: dt.datetime, now: dt.datetime | None = None) -> str:
    w = when_ko(at, now)
    return (f"🐕 {w}, 동전이 새 이야기\n\n「{title.strip()}」\n\n"
            f"이번엔 동전이네 집에 무슨 일이 생길까요?\n{w}에 쇼츠로 만나요.\n"
            "구독하면 새 편 알림이 가요")


def raksil_text(a: str, b: str, at: dt.datetime, pick: bool = False, now: dt.datetime | None = None, situation: str = "") -> str:
    """situation(11/25 BK '문장이 명확하지 않아'): 무슨 상황인지 한 문장을 선택지 위에 먼저."""
    w = when_ko(at, now)
    tail = f"몽글이는 뭘 골랐을까? {w} 쇼츠에서 공개!" if pick else f"{w} 쇼츠에서 같이 골라요!"
    s = situation.strip().rstrip(".!?")
    ask = (f"{s}, 너라면?" if s.endswith("때") else f"{s}. 너라면?") if s else ""
    return (f"🎮 {w} 몽글이 밸런스게임 먼저 보기\n\n" + (f"{ask}\n\n" if ask else "") + f"A. {a}\nB. {b}\n\n"
            + ("댓글로 A나 B를 남겨 줘 👇" if ask else "너라면? 댓글로 A나 B를 남겨 줘 👇") + f"\n{tail}\n"
            "구독하면 매일 새 질문 알림이 가요")


def music_text(title: str, at: dt.datetime, ask: str = "", now: dt.datetime | None = None) -> str:
    w = when_ko(at, now)
    return (f"🎵 {w} 새 노래 공개\n\n「{title.strip()}」\n\n"
            + (f"{ask.strip()}\n" if ask.strip() else "")
            + "구독하면 새 노래 알림이 가요")


def send(image: pathlib.Path | None, text: str, extra: str = "") -> bool:
    """텔레그램으로 보낸다. 실패해도 업로드는 그대로(부가 기능)."""
    if not safe(text):
        print("게시물 글에 금지 문구 → 안 보냄", file=sys.stderr)
        return False
    head = HOWTO + (f"\n{extra}" if extra else "")
    try:
        from .api_check import send as send_text, send_photo
        if image and send_photo(image, head + "\n\n" + text):
            return True
        return send_text(head.replace(" + 이 그림 첨부", "") + "\n\n" + text)
    except Exception as e:  # noqa: BLE001
        print(f"게시물 예고 전송 실패: {e}", file=sys.stderr)
        return False


def uncle(row: dict, video: pathlib.Path, at: dt.datetime) -> bool | None:
    """삼촌 만화 편만(format toon*, 쇼츠, 상품 없음). 돈 강조 말이 있으면 None."""
    if not on("uncle") or not str(row.get("format", "")).startswith("toon") or (row.get("kind") or "short") != "short" \
            or str(row.get("ad") or "1").strip() != "0":
        return None
    from .youtube import money_hits
    text = uncle_text(row["title"], at)
    if money_hits(text):
        return None
    img = frame_png(video, 1.2, ROOT / "media" / "community" / f"uncle-{row['slug']}.png")
    return send(img, text)


def raksil(meta: dict, at: dt.datetime) -> bool | None:
    if not on("raksil") or meta.get("kind") == "게임" or not meta.get("a") or not meta.get("b"):
        return None
    img = frame_png(meta["file"], 0.8, ROOT / "media" / "community" / f"raksil-{meta.get('key', meta['date'])}.png")
    return send(img, raksil_text(meta["a"], meta["b"], at, bool(meta.get("pick")), situation=meta.get("situation", "")))


def music(title: str, cover: str | pathlib.Path | None, at: dt.datetime, ask: str = "") -> bool | None:
    if not on("music"):
        return None
    img = pathlib.Path(cover) if cover and pathlib.Path(cover).exists() else None
    return send(img, music_text(title, at, ask))


def main(argv: list[str]) -> int:
    """미리 보기: python -m pipeline.community_posts sample"""
    now = dt.datetime(2026, 11, 23, 10, 0, tzinfo=KST)
    print(uncle_text("보일러 켜자마자 동전이가 숨은 곳", dt.datetime(2026, 11, 24, 19, tzinfo=KST), now), "\n---")
    print(raksil_text("겨울 내내 집에서만", "여름 내내 밖에서만", dt.datetime(2026, 11, 23, 17, tzinfo=KST), True, now), "\n---")
    print(music_text("다른 차원 끝 (Male ver. Feat. Female)", dt.datetime(2026, 11, 25, 19, tzinfo=KST),
                     "여성 버전과 남성 버전, 어느 쪽이 더 좋아요? 댓글로 알려 주세요 💬", now))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
