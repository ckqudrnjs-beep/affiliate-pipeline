"""5락실 게임 쇼츠: 새 게임은 항상 쇼츠로 (BK 2026-11-14 "새 게임이 제작되면 쇼츠 소재에 당연히 넣어주세요").

- 게임 목록은 playground/games/*/meta.json 에서 자동으로 읽는다 → 새 게임 폴더가 생기면 따로 등록할 것 없음.
- 새 게임(OLD_GAMES 에 없고 아직 소개 쇼츠를 안 올린 게임): 다음 실행 때 'NEW GAME' 소개 쇼츠, 20:00 KST 공개.
  하루 1편만, 여러 개면 meta.json 의 order 순서.
- 목요일: 네온 사격장을 뺀 게임을 돌아가며 플레이 하이라이트 (가장 오래 안 나온 게임부터). 월요일은 네온 사격장 그대로.
  소개 쇼츠가 있는 날은 그게 먼저(그날 하이라이트는 쉼).
- 녹화: scripts/game_rec.js (가상 시계 30fps). 게임이 #demo 약속(window.__demo.bot)을 지원하면 자동 플레이, 아니면 시작만 눌러 첫 몇 초.
- 기록: data/youtube/raksil_uploaded.json 의 키 "<날짜>-game-<slug>" (소개는 "-new" 꼬리).
- 모든 그래픽·소리는 5락실이 만든 것. 다른 게임의 이름·캐릭터·화면은 쓰지 않는다.

실행: PYTHONPATH=src python -m pipeline.raksil_games plan [YYYY-MM-DD]          → "range" / "game <slug> new|play" / "none"
      PYTHONPATH=src python -m pipeline.raksil_games <녹화폴더> render|upload <slug> new|play [YYYY-MM-DD]
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import subprocess
import sys

from . import raksil_kling as rk
from . import raksil_shorts as rs

W, H, FPS, SR = rs.W, rs.H, rs.FPS, rs.SR
HOUR = 20
GAMES = pathlib.Path("playground/games")
# 2026-11-14 이전부터 있던 게임: 소개 쇼츠 없이 목요일 로테이션에만 들어감.
OLD_GAMES = {"chosung", "dodge", "majority", "range", "reaction", "spot", "starlight", "stop", "tongtong"}
# 새 게임 소개 쇼츠 잠시 멈춤 (BK 2026-11-14: 주말에 그래픽·캐릭터 전면 정리 → 끝나면 새 화면으로).
# 파일에 {"hold_new": true} 이면 소개 쇼츠·월 네온 사격장·목 로테이션 모두 쉰다. 정리 끝나면 false 로.
HOLD = pathlib.Path("config/raksil_games.json")


def hold_new(path: pathlib.Path = HOLD) -> bool:
    try:
        return bool(json.loads(path.read_text(encoding="utf-8")).get("hold_new"))
    except (OSError, ValueError):
        return False


def discover(root: pathlib.Path = GAMES) -> list[dict]:
    out = []
    for p in sorted(root.glob("*/meta.json")):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if m.get("hidden") or not m.get("name"):
            continue
        out.append({"slug": p.parent.name, "name": m["name"], "short": m.get("short", ""),
                    "order": m.get("order", 999), "genre": m.get("genre", "")})
    return sorted(out, key=lambda g: (g["order"], g["slug"]))


def history(log: dict) -> dict[str, str]:
    """slug → 마지막으로 쇼츠에 나온 날짜."""
    last: dict[str, str] = {}
    for k in log:
        if "-game-" in k:
            d, slug = k.split("-game-", 1)
            slug = slug.removesuffix("-new")
        elif k.endswith("-range"):
            d, slug = k[:10], "range"
        else:
            continue
        last[slug] = max(last.get(slug, ""), d)
    return last


def intro_done(log: dict) -> set[str]:
    return {k.split("-game-", 1)[1].removesuffix("-new") for k in log if "-game-" in k and k.endswith("-new")}


def rotation_on(path: pathlib.Path = HOLD) -> bool:
    """월 네온 사격장·목 로테이션. 2026-11-20 1안(BK): 봇 플레이 쇼츠가 89~450회라 새 게임 소개만 남김 → 기본 꺼짐.
    config/raksil_games.json 에 {"rotation": true} 이면 다시 켠다."""
    try:
        return bool(json.loads(path.read_text(encoding="utf-8")).get("rotation"))
    except (OSError, ValueError):
        return False


def plan(day: dt.date, games: list[dict], log: dict, hold: bool = False,
         rotation: bool = True) -> tuple[str, str | None, str | None]:
    """그날 20:00 슬롯에 무엇을 올릴지. hold 면 게임 화면 쇼츠는 모두 쉼(밸런스 쇼츠는 그대로)."""
    if hold:
        return ("none", None, None)
    done = intro_done(log)
    for g in games:
        if g["slug"] not in OLD_GAMES and g["slug"] not in done:
            return ("game", g["slug"], "new")
    # 2026-11-21 BK 카드 "1 리액션 컷 + 2 상황극": 월·수·금 Kling 상황극·리액션 + 실제 녹화 (config/raksil_kling.json on 일 때만)
    kl = rk.pick(day, log, games, history(log))
    if kl:
        return ("game", kl["game"], "kling")
    if not rotation:
        return ("none", None, None)
    if day.weekday() == 0:
        return ("range", None, None)
    if day.weekday() == 3:
        last = history(log)
        pool = [g for g in games if g["slug"] != "range"]
        if pool:
            g = min(pool, key=lambda g: (last.get(g["slug"], ""), g["order"], g["slug"]))
            return ("game", g["slug"], "play")
    return ("none", None, None)


# 쇼츠 공식 (BK 11/14 "오락실도 쇼츠 잘 만들어줘"):
# 첫 프레임부터 실제 플레이 + 큰 후킹 문구(1초 안에 '뭔지' 보이게) → 게임 화면 크게 → 음성 그대로 자막
# → 15초 안팎(끝까지 보고 다시 보게) → 짧은 끝 화면(주소). 제목은 후킹 + 게임 이름, 과장·낚시 금지.
HOOKS = ["이게 설치 없이 된다고?", "폰에서 바로 되는 게임", "딱 한 판만 하려다 열 판", "출근길 5분 순삭 게임",
         "무료인데 이 퀄리티?", "친구랑 점수 내기 각", "이 게임, 그냥 게임 아님", "이거 하다 보면 순삭"]
# 11/21 BK 결정: 지시어로 숨기기('이 게임, 그냥 퍼즐이 아니에요') 채택, 숫자는 실제 기록 점수·시간만, 손실 회피·금기 경고는 안 씀.
SKIP_START = 1.0  # 녹화 앞부분(시작 버튼·메뉴) 건너뜀
MAX_PLAY = 13.0
KLING_PLAY = 7.5  # Kling 형식: 훅 약 2초 + 실제 플레이 7.5초 + 결과 컷 약 2초 = 약 11초 (5락실 쇼츠 약 10초 규칙)


def hook_of(g: dict, day: dt.date, score: float | None = None) -> str:
    """2026-11-20 1안: 녹화 기록 점수가 있으면 도전형 후킹("이 기록 1,240점, 넘을 수 있어?")."""
    if isinstance(score, (int, float)) and score > 0:
        return f"{int(score):,}점 넘을 수 있어?"  # 제목 띠 한 줄에 들어가게 짧게
    return HOOKS[(day.toordinal() + sum(map(ord, g["slug"]))) % len(HOOKS)]


def rec_score(rec: pathlib.Path) -> float | None:
    try:
        return json.loads((rec / "info.json").read_text(encoding="utf-8")).get("score")
    except (OSError, ValueError):
        return None


def lines(g: dict, kind: str) -> list[str]:
    first = f"5락실 신작, {g['name']}!" if kind == "new" else f"{g['name']}, 설치 없이 바로 돼."
    return [first, "오락실 닷컴에서 바로 해 봐! 새 게임 계속 나오니까 즐겨찾기!"]  # 2026-11-17 BK: 끝 한 줄


def title_of(g: dict, kind: str, hook: str = "") -> str:
    hook = hook or HOOKS[0]
    if kind == "kling":
        return f"{hook} | {g['name']} #5락실 #웹게임 #shorts"[:95]
    if kind == "new":
        return f"[신작] {g['name']} | {hook} #5락실 #shorts"[:95]
    return f"{g['name']} | {hook} #5락실 #shorts"[:95]


def description_of(g: dict, kind: str, voiced: bool, kl: dict | None = None) -> str:
    head = f"5락실 신작 '{g['name']}' 공개!" if kind == "new" else f"5락실 무료 웹게임 '{g['name']}'"
    ls = [head, g["short"], "",
          f"▶ 설치 없이 바로 하기: {rs.SITE}/games/{g['slug']}",
          f"▶ 다른 무료 게임·매일 밸런스게임: {rs.SITE}",
          "▶ 새 게임 소식은 구독으로", "",
          "영상 속 플레이는 자동 플레이(테스트 모드) 화면입니다. 게임 속 그래픽·캐릭터는 모두 5락실이 만든 디자인입니다."]
    if kl:
        ls.insert(3, f"▶ 바로 하기(쇼츠 전용 주소): {rs.SITE}/games/{g['slug']}?ref=yt-{kl['format']}")
        ls.pop(4)
        ls.append(rk.AI_NOTE)
    if voiced:
        ls.append("내레이션: AI 음성")
    ls.append("#웹게임 #무료게임 #5락실")
    return "\n".join(x for x in ls if x is not None)


# ---------- 화면 ----------
# 쇼츠 화면 안전영역 (2026-11-16 별사탕 합치기 밑부분 잘림 후): 유튜브 쇼츠 앱은 아래 약 20%(제목·채널·음악)를
# 덮고, 위 약 120px 에 검색·메뉴 아이콘이 있다. 게임 화면은 이 안에만 놓고, 글자 띠도 아래쪽에는 두지 않는다.
SAFE = (0, 120, W, 1540)
BOX = (40, rs.BAND_H + 120, W - 40, SAFE[3])  # 게임 화면 자리: 위 제목 띠·자막 줄 아래 ~ 안전영역 끝  # 게임 화면 자리 (안전영역 안에서 최대한 크게)
SUB_Y = rs.BAND_H + 55  # 음성 자막 띠 (제목 띠와 게임 화면 사이, 게임 화면은 안 가림)


GAME_REPLAN_SYS = """너는 5락실 유튜브 쇼츠(무료 웹게임 자동 플레이 화면 약 10초) 기획자다. 편집장이 떨어뜨린 기획안을 지적대로 다시 짠다
(BK 11/21: 스킵 말고 기획안을 바꿔라). 편집장 지적을 하나도 빠짐없이 반영하고, 지난 시도에서 지적된 점을 되풀이하지 않는다.
- hook(화면 맨 위 흰 줄, 공백 포함 14자 이하): 보는 사람에게 거는 구체적인 도전·목표. 이 게임에서만 가능한 장면·목표를 쓴다
  (예: '동전탑 5층 가능?', '우르르 연쇄 몇 배까지'). '이게 설치 없이 된다고?' '무료인데 이 퀄리티?' 같은 아무 게임에나 붙는 말,
  '신작 게임' 같은 분류 말, 낚시·과장·가짜 통계·퍼센트·지능 비하 금지.
  지시어로 숨기기는 좋다(예: '이 게임, 그냥 퍼즐 아님'). 숫자는 이 게임의 실제 기록 점수나 시간만(지어낸 수치·돈 금액 금지).
  '~하지 마세요' '몰랐으면 손해' 같은 손실 회피·금기 경고는 쓰지 않는다.
- line(첫 대사, 공백 포함 30자 이하 반말): 화면을 보며 바로 따라 하고 싶게 만드는 구체적인 한 줄. 게임 이름을 넣는다. 광고 말·구독 부탁 금지.
- 게임 설명에 없는 기능·보상은 지어내지 않는다. 화면은 자동 플레이 녹화라 특정 순간에 맞춘 반응·벌칙·내일 예고는 쓰지 않는다."""
HOOK_MAX, LINE_MAX = 14, 30
KIND_TXT = {"new": "신작 소개", "play": "플레이", "kling": "상황극·리액션 + 실제 플레이"}


def replan_hook(g: dict, kind: str, sc: dict, history: list[dict], fresh: bool) -> list[tuple[str, str]] | None:
    """편집장 지적으로 띠 흰 줄(도전 후킹)과 첫 대사를 다시 짠다 → [(hook, line)] 최대 rs.REPLAN_N 개. 키가 없거나 실패면 None."""
    import os
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        from . import claude_jobs as cj
        past = "\n".join(f"- 띠 '{h['hook']}' / 대사 '{h['line']}' → {h['score']}/40, 지적: {h['note']}" for h in history[-5:])
        user = (("[새 기획] 지금 각도로는 안 된다. 게임 설명에서 다른 장면·목표를 골라 완전히 다른 각도로.\n" if fresh
                 else "[고치기] 편집장 지적대로 고친다.\n")
                + f"게임: {g['name']} ({'신작 소개' if kind == 'new' else '플레이 하이라이트'}) — {g.get('short', '')}\n"
                + f"게임 설명: {g.get('description', '')}\n편집장 점수: "
                + json.dumps({k: sc.get(k) for k in rs.GATE_SCHEMA_PROPS}, ensure_ascii=False)
                + f"\n편집장 지적: {sc.get('note', '')}\n\n지난 시도(되풀이 금지):\n{past}")
        # 11/22: Sonnet·800 토큰은 생각에 잘려 다시 짜기가 자주 실패 → 문구 은행 후킹만 돌다 22/40 쉼. Opus·넉넉한 한도로
        # 11/22 (BK '짜는 방식 바꾸기'): 한 번에 서로 다른 안 rs.REPLAN_N 개 → 모두 채점해 가장 나은 안을 다음 바탕으로
        user += f"\n\n흰 줄과 첫 대사는 한 흐름으로 이어지게(첫 대사가 흰 줄의 목표를 받아 긴장을 올린다). 서로 확실히 다른 안 {rs.REPLAN_N}개를 plans 에 낸다."
        if not rs.replan_budget_ok():  # 회차 끝까지 매일 채점할 돈은 남긴다 (11/27)
            raise cj.BudgetError(f"회차 남은 돈이 채점 몫 {rs.JUDGE_RESERVE}달러뿐이라 다시 짜기 안 함")
        r = cj.ask("raksil", GAME_REPLAN_SYS, user, model=cj.OPUS, effort="medium", max_tokens=12000, need=rs.REPLAN_NEED,
                   reserve=rs.REPLAN_RESERVE,
                   schema=cj.obj({"plans": cj.arr(cj.obj({"hook": cj.S, "line": cj.S}))}))
    except Exception as e:
        print(f"게임 기획안 다시 짜기 실패: {e}", file=sys.stderr)
        return None
    out = []
    bad = rs.BANNED_BAND + ("구독", "설치 없이")
    for p in (r.get("plans") or [] if isinstance(r, dict) else [])[:rs.REPLAN_N]:
        if not isinstance(p, dict):
            continue
        hook, line = (" ".join(str(p.get(k, "")).split()).strip() for k in ("hook", "line"))
        if not hook or len(hook) > HOOK_MAX or not line or len(line) > LINE_MAX or any(w in hook + line for w in bad):
            continue
        if (hook, line) not in out:
            out.append((hook, line))
    return out or None


def gate(g: dict, kind: str, day: dt.date, hook: str, say: list[str]) -> tuple[str, list[str], str, dict | None]:
    """품질 게이트 (BK 11/20 밤 '안 하느니 못해' + 11/21 '기획안을 바꿔야지 스킵하면 안돼'): 띠 흰 줄(도전 후킹)·제목·대사를 편집장이 채점.
    미달이면 지적대로 후킹·첫 대사를 다시 짜고(연속 rs.GATE_FRESH_AFTER 번 미달이면 새 각도), 채점 최대 rs.GATE_TRIES 번.
    다시 짜기가 안 되면(키·API 실패) 문구 은행의 다른 후킹. 끝까지 미달이면 최고안이 rs.GATE_SOFT_GAME 이상일 때 그 안, 아니면 쉼.
    → (쓸 후킹, 쓸 대사, 쉬는 이유 — 진행이면 '', 채점 결과)."""
    hist, best, streak = [], None, 0
    queue, batch = [], []  # 다시 짜기가 한 번에 낸 안들(채점 대기), 이번 묶음 채점 결과
    bank = [h for i in range(len(HOOKS)) for h in [HOOKS[(day.toordinal() + i) % len(HOOKS)]] if h != hook]
    for n in range(rs.GATE_TRIES):
        brief = (f"게임 쇼츠({KIND_TXT.get(kind, '플레이')}): {'Kling 사람 장면 + ' if kind == 'kling' else ''}자동 플레이 화면 약 10초 + 몽글이 엔딩.\n"
                 f"게임: {g['name']} — {g.get('short', '')}\n제목 띠: 흰 줄 '{hook}' / 노란 줄 '{g['name']}'\n"
                 f"제목: {title_of(g, kind, hook)}\n대사: " + " / ".join(say))
        sc = rs.judge("5락실 게임 쇼츠 (layout 은 띠 글자가 첫 1초에 읽히는지로). 이 칸은 밸런스 쇼츠가 아니라 게임 쇼츠다: "
                      "화면은 자동 플레이 녹화라 특정 순간에 맞춘 몽글이 반응·벌칙·내일 예고는 넣을 수 없고, 노란 줄은 게임 이름 고정, "
                      "둘째 대사(사이트 안내)와 몽글이 엔딩도 고정이다. 이것들로 감점하지 말고, 바꿀 수 있는 것은 흰 줄 후킹과 첫 대사뿐 — "
                      "note 도 그 둘만 지시", brief)
        if sc and sc.get("blocked"):  # 예산 소진 → 채점 없이 올리지 않음 (11/22)
            if best and rs.gate_soft(best[3], rs.GATE_SOFT_GAME):
                return best[1], best[2], "", {**best[3], "soft": True}
            return hook, say, f"채점 예산이 막혀 채점 없이 올리지 않음 — {sc['blocked']}", None
        if sc is None:
            return hook, say, "", None  # 채점 불가 → 화면 검사(check)만
        total, ok = rs.gate_total(sc)
        print(f"게임 품질 채점 {n + 1}: '{hook}' {total}/40 {'통과' if ok else '미달'} — {sc.get('note', '')}")
        if ok:
            return hook, say, "", sc
        if not best or total > best[0]:
            best = (total, hook, list(say), sc)
        hist.append({"hook": hook, "line": say[0], "score": total, "note": str(sc.get("note", ""))[:300]})
        batch.append((total, sc))
        if queue:  # 한 번에 짠 여러 안 중 아직 채점 안 한 안부터
            nh, nl = queue.pop(0)
            hook, say = nh, [nl] + list(say[1:])
            continue
        streak += 1
        fresh = streak >= rs.GATE_FRESH_AFTER
        base_sc = max(batch, key=lambda x: x[0])[1]  # 이번 묶음 최고안의 지적으로 다시 짠다
        batch = []
        nxt = replan_hook(g, kind, base_sc, hist, fresh)
        nxt = nxt if isinstance(nxt, list) else [nxt] if nxt else []
        if nxt:
            (nh, nl), queue = nxt[0], nxt[1:]
            hook, say = nh, [nl] + list(say[1:])
            streak = 0 if fresh else streak
        elif bank:
            hook = bank.pop(0)
        else:
            break
    if best and rs.gate_soft(best[3], rs.GATE_SOFT_GAME):
        return best[1], best[2], "", {**best[3], "soft": True}
    return hook, say, f"{len(hist)}번 다시 짜도 최고 '{best[1]}' {best[0]}/40점 < 최후 기준 {rs.GATE_SOFT_GAME} — {best[3].get('note', '')}", None


def game_band(g: dict, hook: str) -> dict:
    """2026-11-20 BK 패턴: 위쪽 검은 띠 두 줄 = 흰 줄 도전 후킹 + 노란 줄 게임 이름 ("고지능자만 가능한 / 선 잇기 게임" 꼴)."""
    return {"top": hook, "accent": g["name"]}


def still_tail(frames: list, thr: float = 1.5, keep: float = 0.4) -> int:
    """끝에서부터 거의 안 움직이는 프레임(게임 오버로 멈춘 화면)을 찾아 그 앞 + keep 초까지의 개수. 움직임이 계속이면 전체."""
    import numpy as np
    from PIL import Image

    def small(p):
        with Image.open(p) as im:
            return np.asarray(im.convert("L").resize((96, 96)), np.float32)
    n = len(frames)
    if n < FPS * 7:
        return n
    prev, last_move = small(frames[-1]), n
    for i in range(n - 2, int(FPS * 6) - 1, -1):
        cur = small(frames[i])
        if float(np.abs(cur - prev).mean()) > thr:
            last_move = i + 1
            break
        prev = cur
    else:
        return max(int(FPS * 6), n)
    return min(n, max(int(FPS * 6), last_move + int(keep * FPS)))


def frame_layer(g: dict, kind: str, band: dict | None = None):
    from PIL import ImageDraw
    img = rs.background(17)
    if rs.draw_band(img, band):
        return img
    dr = ImageDraw.Draw(img)
    f = rs.font(52)
    tag = "5락실 신작" if kind == "new" else "5락실 무료 게임"
    rs.glow_text(img, (W / 2, 70), [tag], f, 52, rs.YEL if kind == "new" else rs.CYAN, glow=8)
    rs.glow_text(img, (W / 2, 170), [g["name"]], rs.font(88), 88, rs.WHITE, glow=12)
    return img


def game_fit(path: pathlib.Path):
    """녹화 화면을 BOX 안에 비율 유지로 맞춤 → (이미지, 위치)."""
    from PIL import Image
    with Image.open(path) as im:
        return game_fit_img(im.convert("RGB"))


def game_fit_img(g):
    from PIL import Image
    x0, y0, x1, y1 = BOX
    bw, bh = x1 - x0, y1 - y0
    s = min(bw / g.width, bh / g.height)
    g = g.resize((int(g.width * s), int(g.height * s)), Image.LANCZOS)
    return g, (x0 + (bw - g.width) // 2, y0 + (bh - g.height) // 2)


def band(img, y: int, text: str, size: int, color, h: int | None = None):
    """반투명 띠 위에 큰 글자 (후킹·자막)."""
    from PIL import Image, ImageDraw
    dr = ImageDraw.Draw(img)
    f = rs.font(size)
    lines_ = rs.wrap(dr, text, f, W - 80)
    h = h or int(size * 1.7 + size * 1.2 * (len(lines_) - 1))  # 두 줄 후킹(도전형)도 띠 안에
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rectangle((0, y - h // 2, W, y + h // 2), fill=(8, 6, 26, 190))
    img.alpha_composite(ov)
    rs.glow_text(img, (W / 2, y), lines_, f, size, color, glow=6)


def cta_card(g: dict, t: float):
    img = rs.background(11)
    rs.glow_text(img, (W / 2, 560), [g["name"]], rs.font(110), 110, rs.WHITE, glow=10)
    blink = rs.PINK if int(t * 3) % 2 == 0 else rs.YEL
    rs.glow_text(img, (W / 2, 900), ["5raksil.com"], rs.font(130), 130, blink, glow=20)
    rs.glow_text(img, (W / 2, 1140), ["프로필 링크에서 바로 플레이"], rs.font(64), 64, rs.CYAN, glow=12)
    rs.glow_text(img, (W / 2, 1300), ["설치 없음, 무료"], rs.font(56), 56, rs.YEL, glow=8)
    rs.glow_text(img, (W / 2, 1460), ["새 게임 계속 · 즐겨찾기·구독"], rs.font(56), 56, rs.PINK, glow=8)
    return img


def render(rec: pathlib.Path, g: dict, kind: str, day: dt.date, out_dir: pathlib.Path = rs.OUT,
           kl: dict | None = None) -> dict | None:
    """kind 'kling' 이면 kl(raksil_kling.pick 결과): Kling 훅 컷 → 실제 플레이 → Kling 결과 컷 → 주소 카드 → 엔딩."""
    import numpy as np
    frames = sorted(rec.glob("f*.jpg"))[int(SKIP_START * FPS):][: int(MAX_PLAY * FPS)]
    if len(frames) < FPS * 6:
        print("녹화가 너무 짧음", len(frames))
        return None
    # 2026-11-20 BK "노래 BPM에 맞춰서": 플레이→CTA 전환을 박자에 맞추고 합성 베이스 대신 BGM (docs/BGM.md)
    from . import bgm
    tr = bgm.pick("game", day)
    if tr:
        frames = frames[: max(int(FPS * 6), round(bgm.snap(len(frames) / FPS, tr, 1, "down") * FPS))]
    if kl:  # 봇이 죽은 뒤 멈춘 화면(게임 오버)은 잘라 냄 — 리액션 컷이 바로 이어지게
        frames = frames[: still_tail(frames)]
    if kl:  # Kling 컷이 앞뒤로 붙는 만큼 플레이는 짧게 (전체 약 13초 + 엔딩)
        frames = frames[: int(FPS * KLING_PLAY)]
    hk_d = float(kl["hook"].get("t", 2.0)) if kl else 0.0
    py_d = float(kl["pay"].get("t", 2.0)) if kl else 0.0
    play_d = len(frames) / FPS + hk_d + py_d  # 아래 소리·CTA 계산은 Kling 컷 포함 길이 기준
    hook = kl["top"] if kl else hook_of(g, day, rec_score(rec))
    say = lines(g, kind)
    hook, say, why, judged = gate(g, kind, day, hook, say)
    if why:  # 품질 게이트 미통과 → 오늘은 쉬고 알림 (기록 안 함 → 다음 차례에 다시)
        key = f"{day.isoformat()}-game-{g['slug']}" + ("-new" if kind == "new" else "")
        print(f"품질 게이트 미통과 → 게임 쇼츠 쉼: {why}")
        return {"date": day.isoformat(), "qid": f"game-{g['slug']}-{kind}-{day.isoformat()}", "key": key,
                "kind": "게임", "skip": why, "title": "", "file": ""}
    clips, voiced = rs.tts(say)
    v0 = (hk_d + 0.4, hk_d + 0.4 + len(clips[0]) / SR) if voiced else (hk_d + 0.4, hk_d + 2.6)
    cta_d = bgm.snap(max(2.4, len(clips[1]) / SR + 0.5), tr, 1, "up")
    total = play_d + cta_d

    audio = np.zeros(int(SR * total) + SR, dtype=np.float32)
    bass, t = [82, 110, 98, 123], 0.0
    while t < total and not tr:  # BGM 이 없을 때만 합성 베이스
        rs.place(audio, rs.tone(bass[int(t * 2) % 4], 0.45, 0.06), t)
        t += 0.5
    rs.place(audio, np.concatenate([rs.tone(784, 0.08, 0.15), rs.tone(1047, 0.08, 0.15), rs.tone(1319, 0.18, 0.15)]), 0.0)
    rs.place(audio, clips[0] * 0.95, v0[0])
    rs.place(audio, clips[1] * 0.95, play_d + 0.15)
    audio = np.clip(audio, -1, 1)[: int(SR * total)]

    out_dir.mkdir(parents=True, exist_ok=True)
    key = f"{day.isoformat()}-game-{g['slug']}" + ("-new" if kind == "new" else "")
    wav, mp4 = out_dir / f"{key}.wav", out_dir / f"{key}.mp4"
    import wave
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())

    band_ = game_band(g, hook)
    base = frame_layer(g, kind, band_)
    from PIL import Image as _I
    with _I.open(frames[0]) as f0:
        wide = f0.width >= f0.height * 0.8
    if wide:  # 가로·정사각 게임: 위아래 빈 곳에 후킹 문구와 게임 소개
        gi0, pos0 = game_fit(frames[0])
        ybot = (pos0[1] + gi0.height + BOX[3]) // 2 + 40
        rs.glow_text(base, (W / 2, ybot - 40), rs.wrap(__import__("PIL.ImageDraw", fromlist=["x"]).Draw(base), g["short"], rs.font(60), W - 120),
                     rs.font(60), 60, rs.CYAN, glow=8)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium",
                           "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest",
                           "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    if kl:
        for img in rk.frames(pathlib.Path(kl["hook"]["file"]), float(kl["hook"].get("ss", 0)), hk_d, W, H, FPS):
            rs.draw_band(rk.dim_top(img, rs.BAND_H + 40), band_)
            ff.stdin.write(img.convert("RGB").tobytes())
    for i, fp in enumerate(frames):
        t = hk_d + i / FPS
        img = base.copy()
        gi, pos = game_fit(fp)
        img.paste(gi, pos)
        if v0[0] <= t < v0[1] + 0.3 and voiced:  # 음성 자막 (후킹은 위 제목 띠가 끝까지 맡는다)
            band(img, SUB_Y, say[0], 62, rs.WHITE)
        ff.stdin.write(img.convert("RGB").tobytes())
    if kl:
        for img in rk.frames(pathlib.Path(kl["pay"]["file"]), float(kl["pay"].get("ss", 0)), py_d, W, H, FPS):
            rs.draw_band(rk.dim_top(img, rs.BAND_H + 40), band_)
            ff.stdin.write(img.convert("RGB").tobytes())
    ctas = {}
    for i in range(int(cta_d * FPS)):
        k = int(i / FPS * 3) % 2
        if k not in ctas:
            c = cta_card(g, k / 3)
            if voiced:
                band(c, 300, say[1], 58, rs.WHITE)
            ctas[k] = c
        ff.stdin.write(ctas[k].convert("RGB").tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg 실패")
    wav.unlink()
    from .raksil_ending import append as add_ending  # 2026-11-20 BK: 몽글이 구독·좋아요 엔딩
    total += add_ending(mp4, day)
    bgm.mix(mp4, tr)
    tags = ["5락실", g["name"].replace(" ", ""), "웹게임", "무료게임", "브라우저게임", "미니게임", "shorts"]
    if g.get("genre"):
        tags.insert(2, str(g["genre"]).replace(" ", ""))
    meta = {"date": day.isoformat(), "qid": f"game-{g['slug']}-{kind}-{day.isoformat()}", "key": key,
            "file": str(mp4), "title": title_of(g, kind, hook), "description": description_of(g, kind, voiced, kl),
            "voiced": voiced, "hour": HOUR, "schedule": True, "category": "20", "game": g["slug"],
            "tags": tags, "seconds": round(total, 1), "kind": "게임", "gate": judged, "play_at": hk_d, "play_n": len(frames)}
    if kl:
        meta.update({"kling": {"format": kl["format"], "ids": kl["ids"]}, "synthetic": kl.get("realistic", False)})
    (out_dir / f"{key}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


# ---------- 업로드 전 화면 검사 ----------
# 2026-11-16 BK: "전체 화면을 검토하고 업로드 해야 돼". 하나라도 걸리면 업로드하지 않고 실패로 끝낸다.
MAX_CUT = 0.01   # 게임 화면이 녹화 영역 밖으로 나간 비율 허용치
MAX_DIFF = 14.0  # 완성 영상 속 게임 자리와 녹화 원본의 평균 밝기 차 (압축 오차보다 크면 잘림·밀림)


def _summary(msg: str) -> None:
    import os
    p = os.environ.get("GITHUB_STEP_SUMMARY")
    if p:
        with open(p, "a", encoding="utf-8") as f:
            f.write(msg + "\n")


def check_record(info: dict) -> list[str]:
    """녹화 단계: 게임 캔버스가 녹화 영역 안에 다 들어왔는지 (시작·끝 두 번 잰 값)."""
    errs = []
    for k, when in (("cut", "시작"), ("cut_end", "끝")):
        v = float(info.get(k) or 0)
        if v > MAX_CUT:
            errs.append(f"녹화 {when}에 게임 화면 {v:.0%} 가 잘림")
    return errs


def check_layout(size: tuple[int, int]) -> list[str]:
    """배치 단계: 게임 화면이 쇼츠 안전영역 안에 있는지."""
    from PIL import Image
    gi, (x, y) = game_fit_img(Image.new("RGB", size))
    if x < SAFE[0] or y < SAFE[1] or x + gi.width > SAFE[2] or y + gi.height > SAFE[3]:
        return [f"게임 화면이 쇼츠 안전영역 밖 ({x},{y},{x + gi.width},{y + gi.height})"]
    return []


def sample_times(n_frames: int, k: int = 4) -> list[int]:
    """자막·후킹 띠가 없는 구간(3.2초 이후)에서 고르게 k 장."""
    lo, hi = int(3.2 * FPS), n_frames - FPS // 2
    if hi <= lo:
        return []
    return [lo + (hi - lo) * j // max(1, k - 1) for j in range(k)]


def check(rec: pathlib.Path, meta: dict) -> list[str]:
    """업로드 전 검사: ① 녹화 잘림 ② 안전영역 ③ 완성 영상에서 프레임을 뽑아 게임 자리가 원본 녹화와 같은지(빈 화면 아님)."""
    import numpy as np
    from PIL import Image, ImageDraw
    errs: list[str] = []
    try:
        info = json.loads((rec / "info.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        info = {}
        errs.append("녹화 정보(info.json) 없음")
    errs += check_record(info)
    frames = sorted(rec.glob("f*.jpg"))[int(SKIP_START * FPS):][: int(MAX_PLAY * FPS)]
    if meta.get("kling"):  # render 와 같은 길이로 (Kling 컷 뒤 플레이 구간만 검사)
        frames = frames[: int(meta.get("play_n", len(frames)))]
    if not frames:
        return errs + ["녹화 프레임 없음"]
    with Image.open(frames[0]) as f0:
        errs += check_layout(f0.size)
    mp4 = pathlib.Path(meta["file"])
    picks = sample_times(len(frames))
    sheet = Image.new("RGB", (W // 4 * len(picks) or 1, H // 4), (0, 0, 0))
    for j, i in enumerate(picks):
        t = (i + 0.5) / FPS + float(meta.get("play_at", 0))
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(mp4), "-frames:v", "1",
                              "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        if len(raw) != W * H * 3:
            errs.append(f"{t:.1f}초 프레임을 못 뽑음 (영상 크기가 {W}x{H} 아님?)")
            continue
        vid = np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(np.float32)
        gi, (x, y) = game_fit(frames[i])
        ref = np.asarray(gi, np.float32)
        part = vid[y:y + gi.height, x:x + gi.width]
        if ref.std() < 3:
            errs.append(f"{t:.1f}초 게임 화면이 비어 있음")
        d = float(np.abs(part - ref).mean())
        if d > MAX_DIFF:
            errs.append(f"{t:.1f}초 영상 속 게임 화면이 녹화와 다름 (차이 {d:.1f})")
        # 검토용 미리보기: 안전영역 선을 그려 4장 나란히
        im = Image.fromarray(vid.astype(np.uint8))
        dr = ImageDraw.Draw(im)
        dr.rectangle(SAFE, outline=(0, 255, 0), width=6)
        dr.rectangle((x, y, x + gi.width - 1, y + gi.height - 1), outline=(255, 0, 255), width=4)
        sheet.paste(im.resize((W // 4, H // 4)), (j * (W // 4), 0))
    if not picks:
        errs.append("검사할 프레임이 부족함")
    try:
        sheet.save(mp4.with_name(mp4.stem + "-check.jpg"), quality=85)
    except OSError:
        pass
    return errs


def load_log() -> dict:
    return json.loads(rs.LOG.read_text(encoding="utf-8")) if rs.LOG.exists() else {}


def main(argv: list[str]) -> int:
    today = dt.datetime.now(rs.KST).date()
    if len(argv) > 1 and argv[1] == "plan":
        day = dt.date.fromisoformat(argv[2]) if len(argv) > 2 and argv[2] else today
        from .shorts_lock import locked  # 11/22 BK 고정안: 고정 기간엔 20시 게임 쇼츠 쉼 (밸런스 하나로)
        what, slug, kind = plan(day, discover(), load_log(), hold_new() or locked("5raksil", day), rotation_on())
        print(" ".join(x for x in (what, slug, kind) if x))
        return 0
    rec, cmd, slug, kind = pathlib.Path(argv[1]), argv[2], argv[3], argv[4]
    day = dt.date.fromisoformat(argv[5]) if len(argv) > 5 and argv[5] else today
    g = next((x for x in discover() if x["slug"] == slug), None)
    if not g:
        print("게임 없음", slug)
        return 1
    kl = None
    if kind == "kling":
        kl = rk.pick(day, load_log(), discover(), history(load_log()))
        if not kl or kl["game"] != slug:
            print("Kling 설계가 없거나 게임이 다름 → 쉼", kl)
            return 0
    meta = render(rec, g, kind, day, kl=kl)
    if not meta:
        return 0
    if meta.get("skip"):
        return rs.upload_meta(meta) if cmd == "upload" else 0
    errs = check(rec, meta)
    if errs:
        print("업로드 보류 (화면 검사 실패):\n- " + "\n- ".join(errs))
        _summary(f"5락실 게임 쇼츠 업로드 보류 ({meta['key']}): " + " / ".join(errs))
        return 1
    print("화면 검사 통과")
    return rs.upload_meta(meta) if cmd == "upload" else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
