"""5락실 주간 롱폼 '주간 챌린지' (시험, BK 2026-11-21 17:55).

주 1편 3분 남짓. 나레이션 없음(BGM만). 가상 인물(회색 후드 애니풍, Kling)이 앞·중간·뒤에 나오고,
가운데는 **실제 게임 녹화**(scripts/game_rec.js 봇 플레이)만 쓴다. Kling 으로 게임 화면을 만들지 않는다.

- 인물 클립은 게임 쇼츠와 같은 풀(config/raksil_kling.json, media/kling/*.mp4)을 돌려 쓴다 → 크레딧 0.
  인트로 = 상황극(situ) 앞부분, 중간 = 같은 상황극의 결말(pay), 마지막 라운드 앞 = 리액션 훅(react_hook,
  BK 11/22 '크레딧 써서 만든 건 활용' — 게임 쇼츠가 고정 기간에 쉬는 동안 훅 클립도 롱폼에서 쓴다), 엔딩 = 리액션(react_pay).
- 반복 콘텐츠 피하기: 매주 게임 4종 조합을 바꾼다(직전 편과 겹치는 게임 최대 1개, 오래 안 나온 게임부터),
  상황극·리액션·미션 문장도 직전 편과 다르게 돌린다. 기록 숫자는 녹화 끝 화면의 실제 값(info.json final)만.
- 대상 게임 = config/raksil_rec.json 에서 봇 + final(실제 기록 읽기)이 있는 게임.
- 업로드: config/raksil_longform.json 의 visibility = "private"(BK 확인용, 기본) | "schedule"(토 20:00 KST 공개 예약).
- 기록: data/youtube/raksil_longform.json (키 = 날짜).

실행: PYTHONPATH=src python -m pipeline.raksil_longform plan [YYYY-MM-DD]      → "games: a b c d e" (5번째는 예비)
      PYTHONPATH=src python -m pipeline.raksil_longform <녹화 상위폴더> render|upload [YYYY-MM-DD]
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import pathlib
import subprocess
import sys

KST = dt.timezone(dt.timedelta(hours=9))
W, H, FPS = 1920, 1080, 30
CFG = pathlib.Path("config/raksil_longform.json")
REC_CFG = pathlib.Path("config/raksil_rec.json")
KLING = pathlib.Path("config/raksil_kling.json")
GAMES = pathlib.Path("playground/games")
LOG = pathlib.Path("data/youtube/raksil_longform.json")
OUT = pathlib.Path("media/raksil_long")
BGM = pathlib.Path("media/bgm/raksil")
JUA = pathlib.Path("config/fonts/Jua-Regular.ttf")
ROUNDS = 4
PLAY = 38.0        # 라운드당 최대 플레이 초
MIN_PLAY = 15.0    # 이보다 짧게 움직이면(봇이 일찍 죽고 멈춤) 그 게임은 빼고 예비 게임을 씀
HOUR = 20          # 토요일 20:00 KST 공개 (visibility=schedule 일 때)
MAX_OVERLAP = 1    # 직전 편과 겹쳐도 되는 게임 수 (게임 7종이라 2편 기준은 수학적으로 불가)

WHITE, YEL, CYAN, PINK, GRAY = (255, 255, 255), (255, 214, 64), (80, 230, 255), (255, 90, 190), (150, 160, 190)


# ---------- 설정·기록 ----------
def load(path: pathlib.Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def eligible(rec_cfg: dict, games_root: pathlib.Path = GAMES) -> list[dict]:
    """봇 녹화 + 실제 기록 읽기(final)가 되는 게임만."""
    out = []
    for slug, r in sorted(rec_cfg.items()):
        if slug.startswith("_") or not isinstance(r, dict) or not r.get("final"):
            continue
        meta = load(games_root / slug / "meta.json", {})
        if meta.get("hidden") or not meta.get("name"):
            continue
        out.append({"slug": slug, "name": meta["name"], "unit": r.get("final_unit", "점")})
    return out


def clip_pool(kling: dict) -> tuple[list[dict], list[dict]]:
    situ = [c for c in kling.get("situ", []) if not c.get("off") and c.get("pay")]
    react = [c for c in kling.get("react_pay", []) if not c.get("off")]
    return situ, react


def hook_pool(kling: dict) -> list[dict]:
    return [c for c in kling.get("react_hook", []) if not c.get("off")]


def _seed(day: dt.date, salt: str) -> int:
    return int(hashlib.sha1(f"{day}-{salt}".encode()).hexdigest()[:8], 16)


def _least_recent(items: list, key, used: list[str], day: dt.date, salt: str):
    """가장 오래 안 쓴 것(안 쓴 것 먼저). 같으면 날짜 해시로."""
    def rank(it):
        k = key(it)
        last = max((i for i, u in enumerate(used) if u == k), default=-1)
        return (last, _seed(day, salt + k) % 997)
    return sorted(items, key=rank)


def pick_games(games: list[dict], log: dict, day: dt.date, n: int = ROUNDS + 1) -> list[dict]:
    """n개(앞 4개 본편 + 예비). 직전 편과 겹치는 게임은 MAX_OVERLAP 개까지, 나머지는 가장 오래 안 나온 게임부터."""
    eps = [log[k] for k in sorted(log) if k < day.isoformat() and not log[k].get("skipped")]
    used = [g for e in eps for g in e.get("games", [])]
    prev = [set(e.get("games", [])) for e in eps[-1:]]
    order = _least_recent(games, lambda g: g["slug"], used, day, "g")
    out: list[dict] = []
    for g in order:
        if all(sum(x["slug"] in p for x in out) + (g["slug"] in p) <= MAX_OVERLAP for p in prev):
            out.append(g)
        if len(out) == n:
            return out
    for g in order:  # 게임이 모자라면 겹침 규칙을 풀고 채운다 (로그에 남김)
        if g not in out:
            out.append(g)
        if len(out) == n:
            break
    return out


def plan(day: dt.date, games: list[dict], log: dict, kling: dict, cfg: dict) -> dict | None:
    situ, react = clip_pool(kling)
    if len(games) < ROUNDS or not situ or not react:
        return None
    eps = [log[k] for k in sorted(log) if k < day.isoformat() and not log[k].get("skipped")]
    s = _least_recent(situ, lambda c: c["id"], [e.get("situ", "") for e in eps], day, "s")[0]
    r = _least_recent(react, lambda c: c["id"], [e.get("react", "") for e in eps], day, "r")[0]
    hooks = hook_pool(kling)
    h = _least_recent(hooks, lambda c: c["id"], [e.get("hook", "") for e in eps], day, "h")[0] if hooks else None
    no = len(eps) + 1
    missions = cfg.get("missions", {})
    picked = pick_games(games, log, day)
    for i, g in enumerate(picked):
        opts = missions.get(g["slug"]) or ["{s}초 동안 최대한 멀리"]
        g["mission"] = opts[(no + i) % len(opts)]
    theme = cfg.get("themes", {}).get(s["id"], s.get("top", ""))
    return {"date": day.isoformat(), "no": no, "games": picked, "situ": s, "react": r, "hook": h, "theme": theme}


# ---------- 녹화 검사 ----------
def motion_end(frames: list[pathlib.Path], step: int = 15, thresh: float = 1.5) -> int:
    """마지막으로 화면이 움직인 프레임 번호(대략). 봇이 죽고 멈춘 화면을 길게 보여 주지 않기 위함."""
    import numpy as np
    from PIL import Image

    def small(p):
        return np.asarray(Image.open(p).convert("L").resize((54, 96)), dtype=np.float32)
    last, prev = 0, None
    for i in range(0, len(frames), step):
        cur = small(frames[i])
        if prev is not None and float(np.abs(cur - prev).mean()) > thresh:
            last = i
        prev = cur
    return min(len(frames) - 1, last + step)


def usable(rec: pathlib.Path) -> dict | None:
    info = load(rec / "info.json", {})
    frames = sorted(rec.glob("f*.jpg"))
    if not frames or info.get("final") in (None, 0) or info.get("cut", 0) > 0.05:
        return None
    end = motion_end(frames)
    secs = min(PLAY, end / FPS)
    if secs < MIN_PLAY:
        return None
    start = max(0, end - int(secs * FPS))
    return {"start": start, "secs": round(secs, 2), "final": info["final"]}


def fmt_num(v: float, unit: str) -> str:
    v = int(v) if float(v).is_integer() else round(v, 1)
    return f"{v:,}{unit}"


# ---------- 글·메타 ----------
def title_of(p: dict) -> str:
    names = " · ".join(g["name"] for g in p["games"][:ROUNDS])
    t = f"5락실 주간 챌린지 #{p['no']} | {p['theme']} 4게임 연속 도전 ({names})"
    return t if len(t) <= 100 else f"5락실 주간 챌린지 #{p['no']} | {p['theme']} 4게임 연속 도전"


def mmss(t: float) -> str:
    return f"{int(t) // 60}:{int(t) % 60:02d}"


def description_of(p: dict, chapters: list[tuple[float, str]]) -> str:
    lines = [f"5락실 주간 챌린지 #{p['no']} — {p['theme']}, 무료 웹게임 4개를 연속으로 도전합니다.",
             "게임 화면은 모두 5락실 실제 플레이 녹화예요(자동 플레이). 기록 숫자도 그 판의 실제 기록입니다.",
             "", "▶ 설치 없이 바로 플레이: https://5raksil.com/?ref=yt-long", ""]
    lines += [f"{mmss(t)} {name}" for t, name in chapters]
    lines += ["", "캐릭터 장면은 AI(Kling)로 만든 애니메이션이에요.", "매주 다른 게임 4종으로 돌아와요.",
              "", "#5락실 #웹게임 #무료게임 #게임챌린지"]
    return "\n".join(lines)


# ---------- 그림 ----------
def _font(size: int, jua: bool = False):
    from PIL import ImageFont
    if jua and JUA.exists():
        return ImageFont.truetype(str(JUA), size)
    from .raksil_shorts import font
    return font(size)


def _bg():
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (W, H)); dr = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        dr.line([(0, y), (W, y)], fill=(int(14 + 20 * t), int(8 + 6 * t), int(34 + 30 * t)))
    for x in range(0, W, 80):
        dr.line([(x, 0), (x, H)], fill=(24, 20, 52))
    return im


def _t(dr, xy, s, f, fill, anchor="la", stroke=0):
    dr.text(xy, s, font=f, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=(0, 0, 0))


def _progress(dr, x, y, done, cur):
    for i in range(ROUNDS):
        cx = x + i * 150
        col = YEL if i < done else (CYAN if i == cur else (60, 60, 90))
        dr.rounded_rectangle([cx, y, cx + 130, y + 60], 14, outline=col, width=4, fill=(40, 34, 10) if i < done else None)
        _t(dr, (cx + 65, y + 30), f"R{i + 1}", _font(34), col, "mm")


def panel(p: dict, i: int, results: list[str]):
    from PIL import ImageDraw
    im = _bg(); dr = ImageDraw.Draw(im); g = p["games"][i]
    _t(dr, (900, 90), f"5락실 주간 챌린지 #{p['no']}", _font(40), PINK)
    _t(dr, (900, 150), f"ROUND {i + 1} / {ROUNDS}", _font(96), WHITE)
    _t(dr, (900, 270), g["name"], _font(84), YEL)
    _t(dr, (900, 380), "미션  " + g["mission_text"], _font(52, True), CYAN)
    _progress(dr, 900, 470, i, i)
    if i:
        _t(dr, (900, 580), "지금까지 기록", _font(44, True), GRAY)
    for k in range(i):
        _t(dr, (900, 640 + k * 62), f"R{k + 1} {p['games'][k]['name']}", _font(46, True), WHITE)
        _t(dr, (1760, 640 + k * 62), results[k], _font(48), YEL, "ra")
    _t(dr, (900, 1020), "실제 게임 플레이 화면  ·  5raksil.com", _font(36, True), GRAY)
    dr.rounded_rectangle([170, 30, 798, 1050], 24, outline=CYAN, width=6)
    return im


def stamp(i: int, result: str):
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    dr.rounded_rectangle([900, 760, 1780, 940], 30, fill=(255, 214, 64, 235))
    _t(dr, (1340, 850), f"ROUND {i + 1} 기록  {result}", _font(80), (30, 20, 10), "mm")
    return im


def card(lines: list[tuple[str, int, bool, tuple]], cur: int | None = None):
    from PIL import ImageDraw
    im = _bg(); dr = ImageDraw.Draw(im)
    y = H // 2 - 60 * len(lines)
    for s, size, jua, col in lines:
        _t(dr, (W // 2, y), s, _font(size, jua), col, "mm", 3); y += size + 40
    if cur is not None:
        _progress(dr, W // 2 - 295, 900, cur, cur)
    return im


def side(left: list[tuple[str, tuple]], right: list[tuple[str, int, bool, tuple]], dark: int = 150):
    """세로 인물 클립 양옆 글자 (투명)."""
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    dr.rectangle([0, 0, 640, H], fill=(10, 8, 28, dark)); dr.rectangle([1280, 0, W, H], fill=(10, 8, 28, dark))
    y = 540 - 50 * len(left)
    for s, col in left:
        _t(dr, (320, y), s, _font(72), col, "mm", 3); y += 100
    y = 540 - 50 * len(right)
    for s, size, jua, col in right:
        _t(dr, (1600, y), s, _font(size, jua), col, "mm", 2); y += size + 40
    _t(dr, (1600, 1020), "AI 생성 장면 (캐릭터)", _font(30, True), GRAY, "mm")
    return im


# ---------- 조립 ----------
def _ff(*a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *map(str, a)], check=True)


ENC = ["-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]


def seg_clip(out: pathlib.Path, clip: pathlib.Path, ss: float, t: float, ov) -> None:
    ovp = out.with_suffix(".png"); ov.save(ovp)
    _ff("-ss", ss, "-t", t, "-i", clip, "-loop", "1", "-i", ovp, "-filter_complex",
        "[0:v]fps=30,split[a][b];[a]scale=1920:-2,crop=1920:1080,boxblur=30:3,eq=brightness=-0.15[bg];"
        "[b]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0[v];[v][1:v]overlay=0:0:shortest=1,tpad=stop_mode=clone:stop_duration=0.6[o]",
        "-map", "[o]", "-an", *ENC, out)


def seg_still(out: pathlib.Path, im, t: float) -> None:
    p = out.with_suffix(".png"); im.save(p)
    _ff("-loop", "1", "-i", p, "-t", t, "-vf", f"fps=30,fade=in:0:8,fade=out:st={t - 0.25}:d=0.25", *ENC, out)


def seg_round(out: pathlib.Path, rec: pathlib.Path, start: int, secs: float, bg, st) -> None:
    bp, sp = out.with_suffix(".bg.png"), out.with_suffix(".st.png"); bg.save(bp); st.save(sp)
    _ff("-loop", "1", "-i", bp, "-framerate", "30", "-start_number", start, "-i", rec / "f%05d.jpg", "-loop", "1", "-i", sp,
        "-filter_complex",
        "[1:v]scale=608:1010:force_original_aspect_ratio=decrease,setsar=1[g];"
        "[0:v][g]overlay=x=180+(608-w)/2:y=35+(1010-h)/2:shortest=1[v];"
        f"[v][2:v]overlay=0:0:enable='gte(t,{secs - 2.5})'[o]",
        "-map", "[o]", "-t", secs, *ENC, out)


def dur(p: pathlib.Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))


def thumbnail(p: dict, rec_root: pathlib.Path, out: pathlib.Path, face: pathlib.Path | None) -> None:
    from PIL import Image, ImageDraw
    im = _bg().resize((1280, 720)); dr = ImageDraw.Draw(im)
    for k, g in enumerate(p["games"][:ROUNDS]):
        fr = sorted((rec_root / g["slug"]).glob("f*.jpg"))
        if fr:
            gi = Image.open(fr[len(fr) * 2 // 3]).convert("RGB"); gi.thumbnail((190, 340))
            im.paste(gi, (40 + k * 200, 340))
    if face and face.exists():
        fi = Image.open(face).convert("RGB")
        fi = fi.crop((0, int(fi.height * 0.45), fi.width, fi.height))  # 인물은 화면 아래쪽 (위 1/4 비움 규칙)
        fi.thumbnail((470, 470)); im.paste(fi, (1280 - fi.width, 720 - fi.height))
    _t(dr, (40, 40), f"주간 챌린지 #{p['no']}", _font(64), PINK, stroke=3)
    _t(dr, (40, 130), "4게임 연속", _font(110), YEL, stroke=4)
    _t(dr, (40, 255), "끝까지 갈까?", _font(70), WHITE, stroke=3)
    im.save(out, quality=92)


def render(p: dict, rec_root: pathlib.Path, out_dir: pathlib.Path = OUT) -> dict | None:
    """rec_root/<slug>/ 녹화들로 조립. 못 쓰는 녹화는 예비 게임으로 바꾼다."""
    rounds = []
    for g in p["games"]:
        u = usable(rec_root / g["slug"])
        if u:
            g["mission_text"] = g["mission"].format(s=int(u["secs"]))
            rounds.append({**g, **u, "result": fmt_num(u["final"], g["unit"])})
        else:
            print(f"녹화 못 씀(기록 없음·멈춤·잘림): {g['slug']}")
        if len(rounds) == ROUNDS:
            break
    if len(rounds) < ROUNDS:
        print("쓸 수 있는 녹화가 4개 미만 → 이번 주 쉼")
        return None
    p = {**p, "games": rounds}
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = out_dir / f"{p['date']}-parts"; tmp.mkdir(exist_ok=True)
    s, r = p["situ"], p["react"]
    pay = s["pay"]
    results = [x["result"] for x in rounds]
    parts: list[tuple[pathlib.Path, str | None]] = []

    def add(name, label=None):
        parts.append((tmp / f"{len(parts):02d}-{name}.mp4", label))
        return parts[-1][0]

    seg_clip(add("intro", "인트로"), pathlib.Path(s["file"]), s.get("ss", 0.3), max(3.0, s.get("t", 2.2) + 0.8),
             side([(p["theme"], YEL), ("4게임 연속?", WHITE)], [("5락실", 58, True, WHITE), (f"주간 챌린지 #{p['no']}", 58, True, CYAN)]))
    seg_still(add("title"), card([(f"5락실 주간 챌린지 #{p['no']}", 110, False, YEL),
                                  ("4게임 연속 도전, 끝까지 가 볼까?", 64, True, WHITE)], 0), 3.0)
    for i, g in enumerate(rounds):
        h = p.get("hook")
        if h and i == len(rounds) - 1:  # 마지막 라운드 앞: 리액션 훅 ('헉' 컷)
            seg_clip(add("hook"), pathlib.Path(h["file"]), h.get("ss", 1.0), max(2.0, h.get("t", 2.0)),
                     side([("마지막 라운드!", YEL)], [("여기서 기록 깨면", 54, True, WHITE), ("이번 주 최고", 54, True, CYAN)]))
        seg_still(add(f"c{i}", f"ROUND {i + 1} {g['name']}"),
                  card([(f"ROUND {i + 1}", 140, False, WHITE), (g["name"], 96, False, YEL),
                        ("미션  " + g["mission_text"], 56, True, CYAN)], i), 2.5)
        seg_round(add(f"r{i}"), rec_root / g["slug"], g["start"], g["secs"], panel(p, i, results), stamp(i, g["result"]))
        if i == 1:
            seg_clip(add("mid"), pathlib.Path(pay["file"]), pay.get("ss", 3.0), max(2.0, pay.get("t", 1.8)),
                     side([("절반 왔다!", YEL)], [("집중하다 보니...", 54, True, WHITE), ("벌써 이렇게 됐다", 54, True, CYAN)]))
    seg_clip(add("outro", "이번 주 기록"), pathlib.Path(r["file"]), max(0.0, r.get("ss", 0.8) - 1.0), 4.5, _ending_overlay(rounds))
    seg_still(add("end"), card([("다음 주엔 다른 게임 4종", 96, False, WHITE), ("5raksil.com", 130, False, YEL),
                                ("너의 기록을 남겨 줘", 60, True, CYAN)]), 5.0)
    chapters, t = [], 0.0
    for f, label in parts:
        if label:
            chapters.append((t, label))
        t += dur(f)
    lst = tmp / "list.txt"; lst.write_text("".join(f"file '{f.resolve()}'\n" for f, _ in parts), encoding="utf-8")
    video = tmp / "video.mp4"
    _ff("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video)
    total = dur(video)
    tracks = sorted(BGM.glob("*.mp3"))
    a, b = tracks[_seed(dt.date.fromisoformat(p["date"]), "a") % len(tracks)], tracks[(_seed(dt.date.fromisoformat(p["date"]), "a") + 1) % len(tracks)]
    final = out_dir / f"{p['date']}-long.mp4"
    _ff("-i", video, "-i", a, "-i", b, "-i", a, "-filter_complex",
        f"[1:a][2:a]acrossfade=d=3[m];[m][3:a]acrossfade=d=3[n];[n]volume=0.8,atrim=0:{total},afade=t=out:st={total - 3}:d=3[x]",
        "-map", "0:v", "-map", "[x]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", final)
    face = tmp / "face.jpg"
    try:
        _ff("-ss", r.get("ss", 0.8) + 1.0, "-i", r["file"], "-frames:v", "1", face)
    except subprocess.CalledProcessError:
        face = None
    thumb = out_dir / f"{p['date']}-long.jpg"
    thumbnail(p, rec_root, thumb, face)
    meta = {"date": p["date"], "no": p["no"], "file": str(final), "thumb": str(thumb), "title": title_of(p),
            "description": description_of(p, chapters), "games": [g["slug"] for g in rounds], "results": results,
            "situ": s["id"], "react": r["id"], "hook": (p.get("hook") or {}).get("id", ""), "secs": round(total, 1),
            "realistic": bool(s.get("realistic") or r.get("realistic"))}
    (out_dir / f"{p['date']}-long.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"만듦 {final} ({mmss(total)})")
    return meta


def _ending_overlay(rounds: list[dict]):
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    dr.rectangle([0, 0, 640, H], fill=(10, 8, 28, 170)); dr.rectangle([1280, 0, W, H], fill=(10, 8, 28, 170))
    _t(dr, (320, 200), "이번 주 기록", _font(64), PINK, "mm", 3)
    for k, g in enumerate(rounds):
        _t(dr, (60, 320 + k * 110), g["name"], _font(46, True), WHITE, "lm")
        _t(dr, (600, 320 + k * 110), g["result"], _font(56), YEL, "rm", 2)
    _t(dr, (1600, 400), "이 기록, 넘을 수 있어?", _font(62), WHITE, "mm", 3)
    _t(dr, (1600, 520), "5raksil.com", _font(88), YEL, "mm", 3)
    _t(dr, (1600, 620), "설치 없이 바로 플레이", _font(48, True), CYAN, "mm", 2)
    _t(dr, (1600, 1020), "AI 생성 장면 (캐릭터)", _font(30, True), GRAY, "mm")
    return im


# ---------- 업로드 ----------
def publish_at(day: dt.date) -> dt.datetime:
    sat = day + dt.timedelta(days=(5 - day.weekday()) % 7)
    return dt.datetime.combine(sat, dt.time(HOUR), KST)


def video_body(meta: dict, visibility: str, at: dt.datetime | None) -> dict:
    if visibility == "schedule" and at:
        status = {"privacyStatus": "private", "publishAt": at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    else:
        status = {"privacyStatus": "private"}
    return {"snippet": {"title": meta["title"], "description": meta["description"],
                        "tags": ["5락실", "웹게임", "무료게임", "게임챌린지", "브라우저게임"],
                        "categoryId": "20", "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
            "status": {**status, "selfDeclaredMadeForKids": False,
                       "containsSyntheticMedia": bool(meta.get("realistic")), "embeddable": True}}


def upload_meta(meta: dict, cfg: dict) -> int:
    from .youtube import access_token, summary, upload
    log = load(LOG, {})
    if meta["date"] in log:
        summary(f"롱폼 {meta['date']} 이미 올림")
        return 0
    if os.environ.get("RAKSIL_YT_ENABLED", "").lower() != "true" or not cfg.get("on"):
        summary(f"롱폼 dry-run (RAKSIL_YT_ENABLED 또는 config on 꺼짐): {meta['title']}")
        return 0
    need = ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "RAKSIL_YT_REFRESH_TOKEN")
    if not all(os.environ.get(k) for k in need):
        summary("5락실 유튜브 비밀값 없음 → 롱폼 업로드 안 함")
        return 1
    tok = access_token(*(os.environ[k] for k in need))
    vis = cfg.get("visibility", "private")
    at = publish_at(dt.date.fromisoformat(meta["date"]))
    if at <= dt.datetime.now(KST) + dt.timedelta(minutes=5):
        at = None
    r = upload(tok, video_body(meta, vis, at), pathlib.Path(meta["file"]))
    thumb_ok = set_thumbnail(tok, r["id"], pathlib.Path(meta["thumb"]))
    log[meta["date"]] = {"id": r["id"], "no": meta["no"], "title": meta["title"], "games": meta["games"],
                         "results": meta["results"], "situ": meta["situ"], "react": meta["react"], "hook": meta.get("hook", ""), "visibility": vis}
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    when = f"{at:%m/%d %H:%M} 공개 예약" if (vis == "schedule" and at) else "비공개(BK 확인용)"
    msg = f"🎮 5락실 주간 롱폼 #{meta['no']} 업로드 ({when}, {mmss(meta['secs'])}): https://youtu.be/{r['id']}" + ("" if thumb_ok else "\n(썸네일 설정 실패: 채널 인증 필요할 수 있음)")
    from .yt_extras import pin_line
    msg += pin_line("이번 주 4게임, 너는 몇 점까지 가능? 기록 댓글로 남겨 줘요 🏆\n설치 없이 바로 플레이: https://5raksil.com/?ref=yt-long")
    summary(msg)
    try:
        from .claude_jobs import notify
        notify(msg)
    except Exception as e:  # noqa: BLE001
        print(f"텔레그램 알림 실패: {e}", file=sys.stderr)
    return 0


def set_thumbnail(tok: str, vid: str, img: pathlib.Path) -> bool:
    import urllib.request
    try:
        req = urllib.request.Request(f"https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={vid}",
                                     data=img.read_bytes(), method="POST",
                                     headers={"Authorization": f"Bearer {tok}", "Content-Type": "image/jpeg"})
        urllib.request.urlopen(req, timeout=60).read()
        return True
    except Exception as e:  # noqa: BLE001
        print(f"썸네일 실패: {e}", file=sys.stderr)
        return False


def main(argv: list[str]) -> int:
    today = dt.datetime.now(KST).date()
    cfg = load(CFG, {})
    games = eligible(load(REC_CFG, {}))
    if len(argv) > 1 and argv[1] == "plan":
        day = dt.date.fromisoformat(argv[2]) if len(argv) > 2 and argv[2] else today
        if not cfg.get("on"):
            print("off")
            return 0
        if day.isoformat() in load(LOG, {}):
            print("done")
            return 0
        p = plan(day, games, load(LOG, {}), load(KLING, {}), cfg)
        print("games: " + " ".join(g["slug"] for g in p["games"]) if p else "none")
        return 0
    rec_root, cmd = pathlib.Path(argv[1]), argv[2]
    day = dt.date.fromisoformat(argv[3]) if len(argv) > 3 and argv[3] else today
    p = plan(day, games, load(LOG, {}), load(KLING, {}), cfg)
    if not p:
        print("계획 없음 (게임 4개 미만 또는 Kling 클립 없음)")
        return 0
    meta = render(p, rec_root)
    if not meta:
        return 0
    return upload_meta(meta, cfg) if cmd == "upload" else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
