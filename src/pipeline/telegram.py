"""텔레그램 가격 알림 채널 (2026-11-13). curate 가 가격을 기록한 직후 실행된다.

보낼 것 (하루 최대 MAX_POSTS 개, 같은 상품은 COOLDOWN_DAYS 동안 다시 안 보냄):
- 가격 하락: 오늘 가격이 직전 기록보다 DROP_PCT% 이상 싸고, 최근 30일 기록 중 최저가인 상품
- 새 상품: 오늘 추가된(addedDate == 오늘) 상품

모든 글 맨 앞에 [광고], 맨 끝에 알리 대가성 문구. 링크는 공식 제휴 링크(aliUrl)와 사이트 가격 기록 페이지뿐.
TELEGRAM_ENABLED 가 'true' 가 아니거나 토큰이 없으면 보낼 글만 출력한다(드라이런).
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import os
import pathlib
import urllib.parse
import urllib.request

from .compliance import DISCLOSURES

DROP_PCT = 5
WINDOW_DAYS = 30
COOLDOWN_DAYS = 7
MAX_POSTS = 3
SITE = "https://don3chon.com"
STATE = "telegram_sent.json"


def load_history(root: pathlib.Path) -> dict[str, list[tuple[str, int]]]:
    hist: dict[str, dict[str, int]] = {}
    for f in sorted((root / "prices").glob("*.csv")):
        with open(f, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                if row.get("aliPrice"):
                    hist.setdefault(row["slug"], {})[row["date"]] = int(row["aliPrice"])
    return {s: sorted(d.items()) for s, d in hist.items()}


def drop_info(points: list[tuple[str, int]], today: dt.date) -> tuple[int, int, int] | None:
    """(직전 가격, 오늘 가격, 하락 %) 또는 None."""
    if len(points) < 2 or points[-1][0] != today.isoformat():
        return None
    now, prev = points[-1][1], points[-2][1]
    if prev <= 0 or now >= prev:
        return None
    pct = round((prev - now) / prev * 100)
    if pct < DROP_PCT:
        return None
    since = (today - dt.timedelta(days=WINDOW_DAYS)).isoformat()
    if now > min(p for d, p in points if d >= since):
        return None
    return prev, now, pct


def won(n: int) -> str:
    return f"{n:,}원"


def first_sentence(text: str) -> str:
    text = (text or "").strip()
    i = text.find("요.")
    return text[: i + 2] if i >= 0 else text


def message(p: dict, kind: str, info: tuple[int, int, int] | None = None) -> str:
    lines = ["[광고]"]
    if kind == "drop":
        prev, now, pct = info
        lines.append(f"📉 {p['name']}")
        lines.append(f"{won(prev)} → {won(now)} ({pct}% 내림, 최근 30일 기록 중 최저)")
    else:
        lines.append(f"🆕 새로 담은 상품: {p['name']}")
        if p.get("aliPrice"):
            lines.append(f"오늘 가격 {won(int(p['aliPrice']))}")
    if p.get("note"):
        lines.append(first_sentence(p["note"]))
    if p.get("check"):
        lines.append(f"사기 전 확인: {p['check']}")
    lines.append("가격은 알리 공식 API 기준이며 쿠폰·환율에 따라 달라질 수 있어요.")
    lines.append(f"구매 링크: {p['aliUrl']}")
    lines.append(f"가격 기록: {SITE}/p/{p['slug']}")
    lines.append("")
    lines.append(DISCLOSURES["aliexpress"])
    return "\n".join(lines)


def pick(root: pathlib.Path, today: dt.date) -> list[tuple[str, str]]:
    """[(slug, 메시지)] 최대 MAX_POSTS 개. 하락 큰 순서, 그다음 새 상품."""
    sent = load_state(root)
    cutoff = (today - dt.timedelta(days=COOLDOWN_DAYS)).isoformat()
    hist = load_history(root)
    drops, news = [], []
    for f in sorted((root / "products").glob("*.json")):
        p = json.loads(f.read_text(encoding="utf-8"))
        slug = p.get("slug")
        if not slug or p.get("status", "active") != "active" or not p.get("aliUrl"):
            continue
        if sent.get(slug, "") >= cutoff:
            continue
        info = drop_info(hist.get(slug, []), today)
        if info:
            drops.append((info[2], slug, message(p, "drop", info)))
        elif p.get("addedDate") == today.isoformat():
            news.append((slug, message(p, "new")))
    drops.sort(reverse=True)
    out = [(s, m) for _, s, m in drops] + news
    return out[:MAX_POSTS]


def load_state(root: pathlib.Path) -> dict[str, str]:
    f = root / STATE
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def save_state(root: pathlib.Path, state: dict[str, str]) -> None:
    (root / STATE).write_text(json.dumps(dict(sorted(state.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def send(token: str, chat_id: str, text: str) -> None:
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "disable_web_page_preview": "false"}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.loads(r.read())
    if not body.get("ok"):
        raise RuntimeError(f"telegram error: {body.get('description')}")


def main() -> int:
    root = pathlib.Path("data")
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
    posts = pick(root, today)
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    live = os.environ.get("TELEGRAM_ENABLED") == "true" and token and chat
    if not posts:
        print("보낼 글 없음")
        return 0
    state = load_state(root)
    for slug, text in posts:
        if live:
            send(token, chat, text)
            state[slug] = today.isoformat()
            print(f"보냄: {slug}")
        else:
            print(f"--- (드라이런) {slug}\n{text}\n")
    if live:
        save_state(root, state)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
