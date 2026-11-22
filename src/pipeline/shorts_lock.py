"""쇼츠 채널별 타깃·형식 고정 기간 (BK 2026-11-22 '타깃층에 맞춰서 가보자' → '고정안 그대로').

조회수가 형식을 바꾼 날부터 떨어져서(5락실 옛 밸런스 1,000회대 → 새 형식 30회, 삼촌 상황극 1,200회 → 섞인 뒤 5~12회)
기간 안에는 채널마다 형식 하나만 올린다. 기간·타깃은 config/shorts_lock.json, 기준 docs/DIRECTION.md.
    locked("uncle", day)    삼촌: 주말 실사 특별편·번외 대신 동전이 만화만
    locked("5raksil", day)  5락실: 20시 게임·밈 쇼츠 쉼, 밸런스 품질 게이트 미달이면 옛 형식으로 대신 올림
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib

CFG = pathlib.Path("config/shorts_lock.json")


def window(channel: str, path: pathlib.Path = CFG) -> tuple[dt.date, dt.date] | None:
    try:
        c = json.loads(path.read_text(encoding="utf-8"))[channel]
        return dt.date.fromisoformat(c["from"]), dt.date.fromisoformat(c["until"])
    except (OSError, ValueError, KeyError, TypeError):
        return None


def locked(channel: str, day: dt.date | str, path: pathlib.Path = CFG) -> bool:
    w = window(channel, path)
    if not w:
        return False
    if isinstance(day, str):
        day = dt.date.fromisoformat(day[:10])
    return w[0] <= day <= w[1]
