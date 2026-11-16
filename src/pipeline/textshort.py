"""글자형 정보 Shorts (HyperFrames) — 2026-11-16 BK.

"문자로만 전달돼도 될 만큼, 보고 나면 만족감을 주는 정보에만" → docs/SHORTS_GROWTH.md 의 사전 체크 4개를
모두 통과할 때만 만든다. 숫자는 주간 리포트(data/report/<날짜>.json)에서만 가져온다. Claude 토큰 없음.

시험 방식: 격주 월요일(ISO 주차 짝수)에, 그날 공개될 월요일 시세 대본(data/episodes/<날짜>-prices.json)이
아직 업로드 전이면 이 영상으로 바꾼다. 체크에 하나라도 걸리면 아무것도 바꾸지 않는다(기존 대본 그대로).

  PYTHONPATH=src python -m pipeline.textshort check [날짜]   # 체크 결과만
  PYTHONPATH=src python -m pipeline.textshort make [날짜] [--force]  # 체크 통과 시 대본+영상 교체
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

KST = dt.timezone(dt.timedelta(hours=9))
REPORT_DIR = pathlib.Path("data/report")
EP_DIR = pathlib.Path("data/episodes")
MEDIA = pathlib.Path("media/youtube")
TEMPLATE_DIR = pathlib.Path("tools/hyperframes/price_short")
HF_VERSION = "0.9.56"
FONTS = ["NanumSquareB.ttf", "NanumBarunGothicBold.ttf"]
FONT_SRC = pathlib.Path("/usr/share/fonts/truetype/nanum")
SURPRISE = 30.0  # ② 한 달 ±30% 이상
ORDINAL = {1: "첫째", 2: "둘째", 3: "셋째", 4: "넷째", 5: "다섯째"}


def is_trial_week(d: dt.date) -> bool:
    """격주 교대: 월요일이고 ISO 주차가 짝수."""
    return d.weekday() == 0 and d.isocalendar()[1] % 2 == 0


def load_report(d: dt.date) -> dict | None:
    p = REPORT_DIR / f"{d.isoformat()}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def checks(rep: dict) -> tuple[bool, list[str], dict]:
    """사전 체크 4개. (통과?, 실패 이유, 고른 숫자)."""
    g = rep.get("grocery") or {}
    down = (g.get("down") or [None])[0]
    up = (g.get("up") or [None])[0]
    fails = []
    # ① 구체적 숫자: 리포트에 실제 가격·변화율이 있다
    if not (down and up and down.get("price") and up.get("price")
            and isinstance(down.get("m"), (int, float)) and isinstance(up.get("m"), (int, float))):
        fails.append("① 장바구니 숫자 없음")
        return False, fails, {}
    # ② 의외성: 내린 1위·오른 1위 모두 한 달 ±30% 이상
    if down["m"] > -SURPRISE or up["m"] < SURPRISE:
        fails.append(f"② 변화 작음 (내림 {down['m']}%, 오름 {up['m']}%, 기준 ±{SURPRISE:.0f}%)")
    # ③ 바로 써먹기: 할 행동이 한 줄로 나온다 (내린 건 이번 주에 담기, 오른 건 한 주 쉬기)
    action = f"{short_name(down['name'])}는 이번 주에, {short_name(up['name'])}는 한 주 쉬기"
    if len(action) > 40:
        fails.append("③ 행동 한 줄이 너무 김")
    # ④ 글자만으로 완결: 이 템플릿은 숫자 카드뿐(소리·사람 없음) → 품목 이름이 화면에 들어가는지만 본다
    if max(len(item_label(down)), len(item_label(up))) > 12:
        fails.append("④ 품목 이름이 화면에 안 들어감")
    return not fails, fails, {"down": down, "up": up, "action": action}


def short_name(name: str) -> str:
    return re.sub(r"\(.*?\)", "", name).strip()


def item_label(x: dict) -> str:
    return f"{x['name']} {x.get('unit', '')}".strip()


def week_tag(d: dt.date) -> str:
    return f"{d.month}월 {ORDINAL[(d.day - 1) // 7 + 1]} 주 장바구니"


def fill(rep: dict, picks: dict, d: dt.date) -> str:
    down, up = picks["down"], picks["up"]
    dm, um = abs(down["m"]), up["m"]
    hook = "한 달 새<br/>거의 반값 된<br/>품목 있어요" if dm >= 40 else f"한 달 새<br/>{dm:.0f}% 싸진<br/>품목 있어요"
    e = html.escape
    vals = {
        "TAG": e(week_tag(d)), "HOOK": hook,
        "DOWN_ITEM": e(item_label(down)), "DOWN_PCT": f"-{dm:.0f}%",
        "DOWN_SUB": e(f"지금 {down['price']:,}원 · 이번 주에 담기"),
        "UP_ITEM": e(item_label(up)), "UP_PCT": f"+{um:.0f}%",
        "UP_SUB": e(f"지금 {up['price']:,}원 · 한 주 쉬어 가기"),
        "CTA": f"{int(rep['grocery'].get('count') or 0)}개 품목<br/>이번 주 시세 전체는" if rep["grocery"].get("count")
               else "이번 주 시세 전체는",
        # 막대: 내린 것은 100 → (100-dm)%, 오른 것은 100/(100+um) → 100%
        "DOWN_SCALE": f"{max(0.05, 1 - dm / 100):.2f}", "UP_SCALE": f"{100 / (100 + um):.2f}",
        "ITEM_PX": "96" if max(len(item_label(down)), len(item_label(up))) <= 9 else "78",
    }
    s = (TEMPLATE_DIR / "template.html").read_text(encoding="utf-8")
    for k, v in vals.items():
        s = s.replace("{{" + k + "}}", v)
    assert "{{" not in s, "템플릿 빈칸 남음"
    return s


def spec_for(rep: dict, picks: dict, d: dt.date) -> dict:
    down, up = picks["down"], picks["up"]
    dn, un = short_name(down["name"]), short_name(up["name"])
    title = f"{dn} {down['m']:.0f}%, {un} +{up['m']:.0f}%… 이번 주 장보기 뭐가 이득?"
    return {
        "date": d.isoformat(), "kind": "short", "format": "prices", "format_name": "이번 주 생활 시세 (글자형)",
        "engine": "hyperframes", "slug": f"ep-{d.isoformat()}-prices",
        "title": title,
        "description": (f"한 달 전과 비교한 이번 주 장바구니 시세예요. {item_label(down)} {down['price']:,}원(한 달 {down['m']}%), "
                        f"{item_label(up)} {up['price']:,}원(한 달 +{up['m']}%). 출처: KAMIS 농산물 유통정보, "
                        f"{d.isoformat()} 주간 생활물가 리포트."),
        "takeaway": picks["action"],
        "site_path": "report.html",
        "scenes": [],
    }


SR = 44100
TOTAL = 12.0
# (장면 시작, 쓸 수 있는 길이) — template.html 의 s1~s4 와 맞춘다
SLOTS = [(0.15, 2.75), (3.1, 3.3), (6.6, 3.3), (10.05, 1.9)]
POPS = [0.1, 3.15, 6.65, 10.25]


def say_lines(rep: dict, picks: dict) -> list[str]:
    """내레이션 4줄 (숫자는 리포트 그대로, %는 '퍼센트'로 읽게)."""
    down, up = picks["down"], picks["up"]
    dm, um = abs(down["m"]), up["m"]
    hook = "한 달 새 거의 반값 된 품목이 있어요." if dm >= 40 else f"한 달 새 {dm:.0f}퍼센트 싸진 품목이 있어요."
    return [hook,
            f"{short_name(down['name'])}, 한 달 새 {dm:.0f}퍼센트 내렸어요.",
            f"{short_name(up["name"])}는 {um:.0f}퍼센트 올랐어요. 한 주 쉬어 가요.",
            "전체 시세는 돈삼촌에서."]


def pop(freq: float = 880.0, ms: int = 90):
    import numpy as np
    t = np.arange(int(SR * ms / 1000)) / SR
    f = freq * (1 - 0.5 * t / t[-1])  # 살짝 내려가는 '톡'
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 40)).astype(np.float32)


def fit(clip, slot: float):
    """슬롯보다 길면 ffmpeg atempo 로 최대 1.3배까지 빠르게, 그래도 길면 끝을 자른다."""
    import numpy as np
    n = len(clip) / SR
    if n <= slot:
        return clip
    ratio = min(1.3, n / slot)
    with tempfile.TemporaryDirectory() as tmpd:
        a, b = pathlib.Path(tmpd) / "a.wav", pathlib.Path(tmpd) / "b.wav"
        write_wav(a, clip)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(a), "-filter:a", f"atempo={ratio:.3f}", str(b)], check=True)
        import wave
        with wave.open(str(b)) as w:
            out = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32767
    return out[: int(slot * SR)]


def write_wav(path: pathlib.Path, a) -> None:
    import numpy as np
    import wave
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())


def soundtrack(rep: dict, picks: dict, voice: bool = True):
    """효과음(직접 합성, 저작권 없음) + 무료 TTS 내레이션(삼촌 쇼츠와 같은 목소리). TTS 가 안 되면 효과음만."""
    import numpy as np
    track = np.zeros(int(SR * TOTAL), dtype=np.float32)
    for i, t in enumerate(POPS):
        p = pop(660.0 if i == 0 else 880.0) * 0.22
        j = int(t * SR)
        track[j:j + len(p)] += p[: len(track) - j]
    if voice:
        try:
            from .uncle import tts
            for (t, slot), clip in zip(SLOTS, tts(say_lines(rep, picks))):
                c = fit(np.asarray(clip, dtype=np.float32), slot)
                j = int(t * SR)
                track[j:j + len(c)] += c[: len(track) - j] * 0.9
        except Exception as e:  # 모델 내려받기 실패 등 → 효과음만
            print(f"TTS 건너뜀 (효과음만): {type(e).__name__}: {e}", file=sys.stderr)
    return track


def render(index_html: str, out: pathlib.Path, audio=None) -> None:
    with tempfile.TemporaryDirectory() as tmpd:
        proj = pathlib.Path(tmpd) / "price_short"
        shutil.copytree(TEMPLATE_DIR, proj, ignore=shutil.ignore_patterns("renders", ".hyperframes", "assets", "index.html", "template.html", "README.md"))
        (proj / "index.html").write_text(index_html, encoding="utf-8")
        fonts = proj / "assets" / "fonts"
        fonts.mkdir(parents=True)
        for f in FONTS:
            shutil.copy(FONT_SRC / f, fonts / f)
        env = dict(os.environ, HYPERFRAMES_NO_TELEMETRY="1", DO_NOT_TRACK="1")
        npx = ["npx", "--yes", f"hyperframes@{HF_VERSION}"]
        subprocess.run(npx + ["check"], cwd=proj, env=env, check=True)
        subprocess.run(npx + ["render", "-o", "renders/out.mp4"], cwd=proj, env=env, check=True)
        out.parent.mkdir(parents=True, exist_ok=True)
        if audio is None:
            shutil.copy(proj / "renders" / "out.mp4", out)
            return
        wav = proj / "renders" / "sound.wav"
        write_wav(wav, audio)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(proj / "renders" / "out.mp4"), "-i", str(wav),
                        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest",
                        "-movflags", "+faststart", str(out)], check=True)


def uploaded_slugs() -> set[str]:
    p = pathlib.Path("data/youtube/uploaded.json")
    return set(json.loads(p.read_text(encoding="utf-8"))) if p.exists() else set()


def make(d: dt.date, force: bool = False) -> str:
    if not force and not is_trial_week(d):
        return f"{d} 시험 주 아님 (격주 월요일만)"
    rep = load_report(d)
    if not rep:
        return f"{d} 리포트 없음"
    ok, fails, picks = checks(rep)
    if not ok:
        return "체크 실패 → 기존 대본 그대로: " + "; ".join(fails)
    ep = EP_DIR / f"{d.isoformat()}-prices.json"
    spec = spec_for(rep, picks, d)
    if os.environ.get("TEXTSHORT_PREVIEW") == "1":  # 확인용: 대본·대기열은 건드리지 않고 영상만
        out = pathlib.Path("preview") / f"{spec['slug']}.mp4"
        render(fill(rep, picks, d), out, soundtrack(rep, picks, voice=os.environ.get("TEXTSHORT_VOICE", "1") != "0"))
        return f"미리보기: {out}"
    if spec["slug"] in uploaded_slugs():
        return f"{spec['slug']} 이미 업로드됨"
    others = [p for p in EP_DIR.glob(f"{d.isoformat()}-*.json") if not p.name.endswith(".meta.json") and p != ep]
    if not ep.exists() and others:
        return f"{d} 자리에 다른 형식 대본 있음 ({others[0].name}) → 건드리지 않음"
    if ep.exists():
        old = json.loads(ep.read_text(encoding="utf-8"))
        if old.get("engine") == "hyperframes":
            return f"{ep} 이미 글자형"
        if old.get("slug") and old["slug"] != spec["slug"]:
            spec["slug"] = old["slug"]
    out = MEDIA / f"{spec['slug']}.mp4"
    render(fill(rep, picks, d), out, soundtrack(rep, picks, voice=os.environ.get("TEXTSHORT_VOICE", "1") != "0"))
    ep.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    meta = {"slug": spec["slug"], "seconds": 12.0, "chapters": [], "engine": "hyperframes"}
    ep.with_suffix(".meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return f"완성: {out} / {ep}"


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "check"
    rest = [a for a in argv[1:] if not a.startswith("--")]
    d = dt.date.fromisoformat(rest[0]) if rest else dt.datetime.now(KST).date()
    if cmd == "check":
        rep = load_report(d)
        if not rep:
            print(f"{d} 리포트 없음")
            return 0
        ok, fails, picks = checks(rep)
        print(json.dumps({"date": d.isoformat(), "trial_week": is_trial_week(d), "pass": ok, "fails": fails,
                          "action": picks.get("action")}, ensure_ascii=False))
    elif cmd == "make":
        print(make(d, force="--force" in argv))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
