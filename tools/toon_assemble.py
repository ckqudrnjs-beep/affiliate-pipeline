"""동전이 만화 쇼츠 조립 (BK 2026-11-19 "재미 먼저, 정보는 곁들이기").

BK 가 Flow(Veo)로 만든 클립 4개 + 자막(주아 글꼴) + 효과음 → media/youtube/<slug>.mp4.
세계관·구도 규칙: docs/동전이_세계관_바이블.md, docs/AI_CLIPS.md 제작 지침.

사용: python tools/toon_assemble.py spec.json
spec = {
  "slug": "ep-2026-11-21-skit-recipe", "out": "media/youtube/ep-....mp4",
  "cuts": [ {"clip": "path.mp4", "ss": 0, "t": 6, "lines": ["위 자막", "둘째 줄"],
             "big": "숫자 상자", "sub": "작은 설명", "big_at": 5.3, "big_y": 900,  # 동작이 끝난 뒤 숫자 (캐릭터 가리지 않게)
             "after": ["숫자 뜰 때 위 자막"],
             "sfx": [["ding", 2.8], ["flop", 5.0]]}, ...],
  "hold": 1.5,                      # 마지막 컷 끝에서 멈춤 + 어두워짐
  "small": "돈 줍는 삼촌 · AI 생성 영상",
  "outro": true,                    # 끝 멈춤 화면에 다음 편 예고 + 구독·좋아요 (기본 켬, false 로 끔)
  "ending": {"clip": "toon-ending-01.mp4", "ss": 0, "t": 6, "at": 1.5},  # 고정 엔딩 클립(BK 11/19, 매 편 재사용):
                                    # 있으면 멈춤 예고 대신 이 클립을 끝에 붙이고 at 초(버튼 누르는 순간)부터 예고·구독 자막
  "date": "2026-11-22",             # 공개일 (BGM 순번). 없으면 slug 의 날짜
  "bgm": "leak-detective"           # (선택) 곡 고정, false 면 BGM 없음. 없으면 config/bgm.json 순번대로
}
BGM 이 있으면 컷 길이·멈춤은 박 단위로, 숫자 등장·효과음은 반 박에 맞춘다 (BK 11/20 "노래 BPM에 맞춰서"). docs/BGM.md
숫자는 한 편에 한 번만(big). 숫자·사실은 사이트 데이터만.
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))
from pipeline import bgm  # noqa: E402

W, H, FPS = 1080, 1920, 30
FONT = pathlib.Path(__file__).resolve().parent.parent / "config/fonts/Jua-Regular.ttf"  # OFL, '…' 글자 없음 → '...'
BROWN = (70, 40, 20)
# 2026-11-19 BK "2일에 하나씩인데 컨텐츠에 구독 좋아요를 어필해야": 이유형 CTA(보상 약속 금지), 이틀 간격이라 '모레'.
OUTRO = {"lines": ["다음 새는 돈은", "모레 저녁 7시!"], "big": "구독 좋아요 꾹!", "sub": "다음 편 안 놓치게", "big_y": 420, "hold": 2.8}


def fix(t):  # 주아에 없는 글자 → 네모(두부)로 나옴: '…' '·'
    return t.replace("…", "...").replace(" · ", " | ").replace("·", "|") if t else t


def layer(lines=(), big=None, sub=None, small=None, bigy=900, size=92):
    lines, big, sub, small = [fix(t) for t in lines], fix(big), fix(sub), fix(small)
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    f = lambda n: ImageFont.truetype(str(FONT), n)  # noqa: E731
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d, sd = ImageDraw.Draw(im), ImageDraw.Draw(sh)
    y = 190
    for t in lines:
        sd.text((W / 2 + 4, y + 8), t, font=f(size), fill=(0, 0, 0, 150), anchor="mm", stroke_width=10, stroke_fill=(0, 0, 0, 150))
        d.text((W / 2, y), t, font=f(size), fill="white", anchor="mm", stroke_width=10, stroke_fill=BROWN)
        y += size + 24
    if big:
        bw = min(W - 40, d.textlength(big, font=f(92)) + 90)
        sd.rounded_rectangle([W / 2 - bw / 2 + 6, bigy + 10, W / 2 + bw / 2 + 6, bigy + 170], 44, fill=(0, 0, 0, 130))
        d.rounded_rectangle([W / 2 - bw / 2, bigy, W / 2 + bw / 2, bigy + 160], 44, fill=(255, 213, 60), outline=BROWN, width=7)
        d.text((W / 2, bigy + 82), big, font=f(92), fill=(215, 40, 30), anchor="mm")
        if sub:
            d.text((W / 2, bigy + 225), sub, font=f(54), fill="white", anchor="mm", stroke_width=7, stroke_fill=BROWN)
    if small:
        d.text((W / 2, 1790), small, font=f(40), fill="white", anchor="mm", stroke_width=5, stroke_fill=BROWN)
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    sh.alpha_composite(im)
    return sh


SFX = {  # 합성 효과음 (저작권 없음)
    # 2026-11-20 BK "쇼츠에 띵 소리가 이질감이 느껴져": 높은 쇳소리 '띵'(2600Hz) → 낮고 짧은 '톡'(물방울·나무 느낌)
    "ding": "0.32*sin(2*PI*(950-500*t)*t)*exp(-28*t)+0.08*sin(2*PI*1900*t)*exp(-40*t)",
    "flop": "0.45*sin(2*PI*(500-300*t)*t)*exp(-5*t)",
}
# spec "sfx": "none" 이면 효과음을 전부 뺀다 (BGM 만)


def bell(hz: float) -> str:
    """BK 11/20 "노래를 은은하게 깔고 띵 소리가 맑고 청량하게": 곡의 으뜸음에 맞춘 맑은 종소리.
    정수배 배음만(쇳소리 없음), 빠른 시작·0.6초 여운."""
    return (f"0.26*sin(2*PI*{hz}*t)*exp(-6*t)+0.10*sin(2*PI*{hz * 2}*t)*exp(-10*t)"
            f"+0.05*sin(2*PI*{hz * 3}*t)*exp(-16*t)+0.04*sin(2*PI*{hz * 1.5}*t)*exp(-8*t)")


def run(*a):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)


def clip_len(path) -> float | None:
    try:
        return bgm.duration(pathlib.Path(path))
    except (subprocess.CalledProcessError, ValueError, FileNotFoundError):
        return None


def choose_bgm(spec: dict) -> dict | None:
    import datetime as dt
    want = spec.get("bgm")
    if want is False:
        return None
    if isinstance(want, str):
        return {**bgm.track(want), "lufs_target": bgm.cfg()["kinds"]["toon"]["lufs"], "duck": False}
    day = spec.get("date") or spec["slug"].split("-skit")[0].removeprefix("ep-")[:10]
    return bgm.pick("toon", dt.date.fromisoformat(day))


def on_beat(spec: dict, tr: dict | None) -> dict:
    """컷 길이·멈춤 = 박 단위, 숫자 등장·효과음 = 반 박. 모든 컷이 박에서 시작하므로 컷 안 시각만 맞추면 된다."""
    if not tr:
        return spec
    spec = json.loads(json.dumps(spec))
    for c in spec["cuts"]:
        n = clip_len(c["clip"])
        c["t"] = bgm.snap_len(float(c.get("t", 8)), tr, None if n is None else n - float(c.get("ss", 0)))
        if c.get("big"):
            c["big_at"] = min(bgm.snap(c.get("big_at", 0), tr, 2), c["t"])
        c["sfx"] = [[k, bgm.snap(s, tr, 2)] for k, s in c.get("sfx", [])]
    spec["hold"] = bgm.snap_len(spec.get("hold", 1.5), tr)
    OUTRO["hold"] = bgm.snap_len(OUTRO["hold"], tr)
    if spec.get("ending"):
        en = spec["ending"]
        n = clip_len(en["clip"])
        en["t"] = bgm.snap_len(float(en.get("t", 6)), tr, None if n is None else n - float(en.get("ss", 0)))
        en["at"] = bgm.snap(en.get("at", 1.5), tr, 2)
    return spec


def assemble(spec: dict) -> pathlib.Path:
    tr = choose_bgm(spec)
    spec = on_beat(spec, tr)
    if tr:
        print(f"BGM: {tr['title']} ({tr['bpm']} BPM, {tr['start']}초부터)")
    out = pathlib.Path(spec["out"])
    tmp = pathlib.Path(tempfile.mkdtemp())
    parts, t0, sfx = [], 0.0, []
    n = len(spec["cuts"])
    for i, c in enumerate(spec["cuts"]):
        last = i == n - 1
        a = tmp / f"a{i}.png"
        layer(c.get("lines", []), small=spec.get("small") if last else None).save(a)
        inputs = ["-ss", str(c.get("ss", 0)), "-t", str(c.get("t", 8)), "-i", c["clip"], "-i", str(a)]
        ending = spec.get("ending")
        outro = last and spec.get("outro", True) and not ending
        if ending and last:
            hold = 0
        else:
            hold = (max(spec.get("hold", 1.5), OUTRO["hold"]) if outro else spec.get("hold", 1.5)) if last else 0
        dur = float(c.get("t", 8)) + hold
        base = "[0:v]scale=1080:1920,setsar=1,fps=30"
        if hold:
            base += f",tpad=stop_mode=clone:stop_duration={hold},fade=t=out:st={dur - 0.9}:d=0.9"
        end = float(c.get("t", 8))
        upto = f"*lt(t,{end})" if outro else ""  # 예고 화면에선 컷 자막을 내린다
        if c.get("big"):
            b = tmp / f"b{i}.png"
            layer(c.get("after", c.get("lines", [])), c["big"], c.get("sub"), spec.get("small") if last else None,
                  bigy=c.get("big_y", 900)).save(b)
            at = c.get("big_at", 0)
            inputs += ["-i", str(b)]
            fc = (f"{base}[v];[v][1:v]overlay=enable='lt(t,{at})'[x];"
                  f"[x][2:v]overlay=enable='gte(t,{at}){upto}'[o]")
            sfx.append(("ding", t0 + at + 0.2))
        else:
            fc = f"{base}[v];[v][1:v]overlay=enable='1{upto}'[o]"
        if outro:  # 클립이 끝나고 멈춘 화면에 다음 편 예고 + 구독·좋아요
            e = tmp / "outro.png"
            layer(OUTRO["lines"], OUTRO["big"], OUTRO["sub"], spec.get("small"), bigy=OUTRO["big_y"]).save(e)
            n_in = inputs.count("-i")
            inputs += ["-i", str(e)]
            fc = fc[:-3] + f"[pre];[pre][{n_in}:v]overlay=enable='gte(t,{end})'[o]"
            sfx.append(("ding", t0 + end + 0.3))
        p = tmp / f"p{i}.mp4"
        run(*inputs, "-filter_complex", fc, "-map", "[o]", "-an", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", str(p))
        sfx += [(k, t0 + s) for k, s in c.get("sfx", [])]
        parts.append(p)
        t0 += dur
    if spec.get("ending"):  # 고정 엔딩 클립: 버튼 누르는 순간부터 예고 + 구독·좋아요, 끝에 멈춤·어두워짐
        en = spec["ending"]
        e = tmp / "outro.png"
        layer(OUTRO["lines"], OUTRO["big"], OUTRO["sub"], spec.get("small"), bigy=OUTRO["big_y"]).save(e)
        hold = spec.get("hold", 1.5)
        dur = float(en.get("t", 6)) + hold
        at = en.get("at", 1.5)
        fc = (f"[0:v]scale=1080:1920,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration={hold},"
              f"fade=t=out:st={dur - 0.9}:d=0.9[v];[v][1:v]overlay=enable='gte(t,{at})'[o]")
        p = tmp / "pend.mp4"
        run("-ss", str(en.get("ss", 0)), "-t", str(en.get("t", 6)), "-i", en["clip"], "-i", str(e),
            "-filter_complex", fc, "-map", "[o]", "-an", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", str(p))
        sfx.append(("ding", t0 + at + 0.1))
        parts.append(p)
        t0 += dur
    v = tmp / "v.mp4"
    run(*sum((["-i", str(p)] for p in parts), []), "-filter_complex", f"concat=n={len(parts)}:v=1:a=0[v]",
        "-map", "[v]", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", str(v))
    if spec.get("sfx") == "none":
        sfx = []
    sounds = dict(SFX)
    if tr and tr.get("ding_hz"):  # BGM 이 있으면 '띵' = 곡 음높이에 맞춘 맑은 종소리
        sounds["ding"] = bell(tr["ding_hz"])
    ins, fl = [], []
    for j, (k, s) in enumerate(sfx):
        w = tmp / f"{k}.wav"
        if not w.exists():
            run("-f", "lavfi", "-i", f"aevalsrc='{sounds[k]}':s=44100:d=0.8", str(w))
        ins += ["-i", str(w)]
        ms = int(s * 1000)
        fl.append(f"[{j + 1}]adelay={ms}|{ms}[s{j}]")
    if sfx:
        fc = ";".join(fl) + ";" + "".join(f"[s{j}]" for j in range(len(sfx))) + \
            f"amix=inputs={len(sfx)}:normalize=0,apad[a]"
    else:
        fc = "anullsrc=r=44100:cl=mono[a]"
    out.parent.mkdir(parents=True, exist_ok=True)
    run("-i", str(v), *ins, "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", str(out))
    bgm.mix(out, tr)
    return out


if __name__ == "__main__":
    print(assemble(json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))))
