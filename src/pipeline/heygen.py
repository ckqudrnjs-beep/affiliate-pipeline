"""HeyGen 가상 인물 쇼츠 (2026-11-11, BK 요청). HeyGen API v3 (v1/v2는 2026-10-31 종료).

    python -m pipeline.heygen list                 # 공개 남성 아바타·한국어 음성 목록 → Actions 요약 (고르기용)
    python -m pipeline.heygen photo [사진 경로]       # 삼촌 사진(config/heygen/uncle.jpg) → 사진 아바타 → config/heygen/avatar.json
    python -m pipeline.heygen make <설정 이름>...   # config/heygen/<이름>.json → media/youtube/<slug>.mp4

- 아바타·음성: config/heygen/avatar.json (2026-11-11 BK: AI로 만든 한국인 삼촌 사진 5번 → 사진 아바타).
  저장소 변수 HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID 가 있으면 그것이 우선.
- 영상 위에 늘 "광고 · 알리익스프레스 제휴 링크", 아래에 "AI로 만든 가상 인물". 끝에 상품 사진·가격·don3chon.com 카드 2.5초.
- 업로드 대기열에 synthetic=1 로 넣어 YouTube "변경되거나 합성된 콘텐츠"를 켠다.
- 키는 GitHub Secret HEYGEN_API_KEY 에서만 읽는다.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time
import urllib.request

from .youtube import MEDIA, QUEUE, load_queue

API = "https://api.heygen.com"
CFG = pathlib.Path("config/heygen")
PRODUCTS = pathlib.Path("data/products")
ASSETS = pathlib.Path("video_assets")
W, H = 1080, 1920


def call(method: str, path: str, body: dict | None = None, idem: str = "") -> dict:
    """요금이 드는 건 POST /v3/videos 하나뿐. 실패해도 자동으로 다시 만들지 않는다 (목록·상태 조회는 무료)."""
    headers = {"X-Api-Key": os.environ["HEYGEN_API_KEY"], "Content-Type": "application/json", "Accept": "application/json"}
    if idem:
        headers["Idempotency-Key"] = idem  # 같은 요청이 두 번 가도 영상은 한 번만
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


AVATAR = CFG / "avatar.json"
DEFAULT_VOICE = "07ca39b243184dbcb82e7e0f0e524b21"  # 한국어 남성 Ben (langdesign), BK가 바꿀 수 있음


def upload_asset(path: pathlib.Path) -> str:
    """POST /v3/assets (multipart). 무료."""
    boundary = "----don3chon" + hashlib.sha1(path.name.encode()).hexdigest()[:16]
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{path.name}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n").encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(API + "/v3/assets", method="POST", data=body, headers={
        "X-Api-Key": os.environ["HEYGEN_API_KEY"], "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.load(r).get("data", {})
    return d.get("asset_id") or d.get("id")


def photo_avatar(src: str = "") -> int:
    """삼촌 사진 1장으로 사진 아바타를 만든다 (POST /v3/avatars type=photo). 이미 있으면 다시 만들지 않는다."""
    if AVATAR.exists() and os.environ.get("HEYGEN_FORCE") != "true":
        summary(f"이미 아바타가 있음: {AVATAR.read_text(encoding='utf-8')}")
        return 0
    path = pathlib.Path(src) if src else next((CFG / f"uncle{e}" for e in (".jpg", ".jpeg", ".png") if (CFG / f"uncle{e}").exists()), None)
    if not path or not path.exists():
        raise SystemExit("삼촌 사진이 없음: config/heygen/uncle.jpg")
    asset = upload_asset(path)
    r = call("POST", "/v3/avatars", {"type": "photo", "name": "돈 줍는 삼촌", "file": {"type": "asset_id", "asset_id": asset}},
             idem="uncle-" + hashlib.sha1(path.read_bytes()).hexdigest()[:12])["data"]
    item = r.get("avatar_item") or {}
    look = item.get("id")
    for _ in range(60):  # 최대 15분
        s = call("GET", f"/v3/avatars/looks/{look}")["data"]
        if s.get("status") not in ("processing", "pending"):
            break
        time.sleep(15)
    if s.get("status") == "failed":
        raise SystemExit(f"사진 아바타 실패: {s.get('error')}")
    AVATAR.write_text(json.dumps({"avatar_id": look, "group_id": (r.get("avatar_group") or {}).get("id"),
                                  "voice_id": DEFAULT_VOICE, "photo": path.name,
                                  "engines": s.get("supported_api_engines")}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    summary(f"사진 아바타 완성: {look} ({s.get('status')}) → {AVATAR}")
    return 0


def summary(text: str) -> None:
    print(text)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text + "\n")


def list_choices() -> int:
    """남성 공개 아바타를 사람별 1장씩 모아 번호 붙인 사진표(data/heygen/avatars.png)와 한국어 음성 목록을 만든다. 무료 조회만."""
    from PIL import Image, ImageDraw
    from .shorts import font
    out_dir = pathlib.Path("data/heygen")
    out_dir.mkdir(parents=True, exist_ok=True)
    v = call("GET", "/v3/models/audio/voices?type=public&language=ko&limit=50")
    voices = [{"n": i + 1, "voice_id": x.get("voice_id"), "name": x.get("name"), "gender": x.get("gender"),
               "preview": x.get("preview_audio_url")} for i, x in enumerate(v.get("data", []))]
    people, token = {}, ""
    for _ in range(30):
        r = call("GET", "/v3/avatars/looks?ownership=public&limit=50" + (f"&token={token}" if token else ""))
        for a in r.get("data", []):
            if (a.get("gender") or "").lower() != "male":
                continue
            who = (a.get("name") or "?").split(" ")[0]
            people.setdefault(who, []).append({"id": a.get("id"), "name": a.get("name"), "type": a.get("avatar_type"),
                                               "img": a.get("preview_image_url"), "tags": a.get("tags")})
        token = r.get("next_token") or ""
        if not r.get("has_more") or not token:
            break
    avatars = []
    for who, looks in people.items():
        avatars.append({"n": len(avatars) + 1, "person": who, "looks": looks})
    (out_dir / "choices.json").write_text(json.dumps({"voices": voices, "avatars": avatars}, ensure_ascii=False, indent=1), encoding="utf-8")
    cols, cw, ch = 6, 300, 380
    rows = (len(avatars) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, max(1, rows) * ch), "white")
    d = ImageDraw.Draw(sheet)
    for i, a in enumerate(avatars):
        x, y = (i % cols) * cw, (i // cols) * ch
        try:
            req = urllib.request.Request(a["looks"][0]["img"], headers={"User-Agent": "Mozilla/5.0"})
            im = Image.open(__import__("io").BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert("RGB")
            im.thumbnail((cw - 10, ch - 60))
            sheet.paste(im, (x + (cw - im.width) // 2, y + 5))
        except Exception as e:
            d.text((x + 10, y + 100), f"사진 실패 {e}"[:30], font=font(18), fill="red")
        d.text((x + cw // 2, y + ch - 30), f"{a['n']}. {a['person']} ({len(a['looks'])})", font=font(26), fill="black", anchor="mm")
    sheet.save(out_dir / "avatars.png")
    lines = ["# HeyGen 한국어 음성", ""] + [f"{x['n']}. {x['name']} ({x['gender']}) `{x['voice_id']}` {x['preview']}" for x in voices]
    (out_dir / "voices.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    summary(f"남성 아바타 {len(avatars)}명, 한국어 음성 {len(voices)}개 → data/heygen/ (heygen-list 브랜치)")
    return 0


def overlay_png(path: pathlib.Path) -> None:
    from PIL import Image, ImageDraw
    from .shorts import font
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 150], fill=(31, 92, 74, 235))
    d.text((W / 2, 52), "돈 줍는 삼촌", font=font(46), fill="white", anchor="mm")
    d.text((W / 2, 112), "광고 · 알리익스프레스 제휴 링크", font=font(32), fill=(225, 240, 230), anchor="mm")
    t = "AI로 만든 가상 인물"
    f = font(30)
    tw = d.textlength(t, font=f)
    d.rounded_rectangle([(W - tw) / 2 - 18, H - 120, (W + tw) / 2 + 18, H - 70], 14, fill=(0, 0, 0, 150))
    d.text((W / 2, H - 95), t, font=f, fill="white", anchor="mm")
    im.save(path)


def end_card(path: pathlib.Path, p: dict, note: str) -> None:
    from PIL import Image, ImageDraw
    from .shorts import fit, font
    im = Image.new("RGB", (W, H), (24, 60, 50))
    d = ImageDraw.Draw(im)
    photo = ASSETS / p["slug"] / "cutout.png"
    if photo.exists():
        c = Image.open(photo).convert("RGBA")
        c.thumbnail((820, 620))
        d.rounded_rectangle([70, 260, 1010, 960], 40, fill=(250, 248, 242))
        im.paste(c, ((W - c.width) // 2, 610 - c.height // 2), c)
    else:
        first = sorted((ASSETS / p["slug"]).glob("*.jpg"))[0]
        im.paste(fit(Image.open(first).convert("RGB"), 860, 700), (110, 260))
    d.text((W / 2, 1040), p["name"], font=font(58), fill="white", anchor="mm")
    d.text((W / 2, 1150), f"{int(p['aliPrice']):,}원", font=font(110), fill=(255, 209, 102), anchor="mm")
    date = p.get("priceDate", "")
    d.text((W / 2, 1245), f"{date[5:7].lstrip('0')}월 {date[8:10].lstrip('0')}일 기준 알리익스프레스 가격", font=font(36), fill=(200, 220, 210), anchor="mm")
    d.text((W / 2, 1350), "비교·계산은 don3chon.com", font=font(62), fill="white", anchor="mm")
    if note:
        d.text((W / 2, 1430), note, font=font(32), fill=(200, 220, 210), anchor="mm")
    im.save(path)


def finish(raw: pathlib.Path, out: pathlib.Path, p: dict, note: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        t = pathlib.Path(tmp)
        overlay_png(t / "ov.png")
        end_card(t / "end.png", p, note)
        fc = ("[1:v]split[o1][o2];"
              "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[a];[a][o1]overlay=0:0[v0];"
              "[2:v]scale=1080:1920,fps=30,setsar=1[e0];[e0][o2]overlay=0:0[e];"
              "[0:a]aresample=44100,aformat=channel_layouts=mono[a0];[3:a]aformat=channel_layouts=mono[a1];"
              "[v0][a0][e][a1]concat=n=2:v=1:a=1[v][aud]")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-i", str(t / "ov.png"),
                        "-loop", "1", "-t", "2.5", "-i", str(t / "end.png"),
                        "-f", "lavfi", "-t", "2.5", "-i", "anullsrc=r=44100:cl=mono",
                        "-filter_complex", fc, "-map", "[v]", "-map", "[aud]", "-c:v", "libx264", "-crf", "22",
                        "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                        "-movflags", "+faststart", str(out)], check=True)


def make(name: str) -> None:
    cfg = json.loads((CFG / f"{name}.json").read_text(encoding="utf-8"))
    p = json.loads((PRODUCTS / f"{cfg['product']}.json").read_text(encoding="utf-8"))
    if not cfg["title"].startswith("[광고]"):
        raise SystemExit("제목은 [광고]로 시작해야 함")
    if (MEDIA / f"{cfg['slug']}.mp4").exists() and os.environ.get("HEYGEN_FORCE") != "true":
        raise SystemExit(f"{cfg['slug']}: 이미 만든 영상이 있어 다시 만들지 않음 (요금 보호). 다시 만들려면 force=true")
    saved = json.loads(AVATAR.read_text(encoding="utf-8")) if AVATAR.exists() else {}
    avatar = os.environ.get("HEYGEN_AVATAR_ID") or saved.get("avatar_id")
    voice = os.environ.get("HEYGEN_VOICE_ID") or saved.get("voice_id")
    if not avatar or not voice:
        raise SystemExit("아바타가 없음: 먼저 photo 실행 (또는 저장소 변수 HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID)")
    r = call("POST", "/v3/videos", {"type": "avatar", "avatar_id": avatar, "voice_id": voice, "script": cfg["script"],
                                    "resolution": "1080p", "aspect_ratio": "9:16", "output_format": "mp4"},
             idem=f"{cfg['slug']}-{hashlib.sha1(cfg['script'].encode()).hexdigest()[:12]}")
    vid = r["data"]["video_id"]
    print(f"{name}: HeyGen 영상 {vid} 만드는 중")
    for _ in range(120):  # 최대 30분
        time.sleep(15)
        s = call("GET", f"/v3/videos/{vid}")["data"]
        if s["status"] == "completed":
            break
        if s["status"] == "failed":
            raise SystemExit(f"HeyGen 실패: {s.get('failure_code')} {s.get('failure_message')}")
    else:
        raise SystemExit("HeyGen 30분 초과")
    with tempfile.TemporaryDirectory() as tmp:
        raw = pathlib.Path(tmp) / "raw.mp4"
        raw.write_bytes(urllib.request.urlopen(s["video_url"], timeout=300).read())
        MEDIA.mkdir(parents=True, exist_ok=True)
        out = MEDIA / f"{cfg['slug']}.mp4"
        finish(raw, out, p, cfg.get("end_note", ""))
    rows = load_queue(QUEUE)
    if not any(r["slug"] == cfg["slug"] for r in rows):
        order = max([int(r["order"]) for r in rows] or [0]) + 1
        d = p.get("priceDate", "")
        with QUEUE.open("a", encoding="utf-8", newline="") as f:
            csv.DictWriter(f, fieldnames=["order", "slug", "title", "intro", "price_date", "synthetic"]).writerow({
                "order": order, "slug": cfg["slug"], "title": cfg["title"],
                "intro": f"{cfg['intro']} ({int(p['aliPrice']):,}원)",
                "price_date": f"{d[5:7].lstrip('0')}/{d[8:10].lstrip('0')}", "synthetic": "1"})
    summary(f"완성: {out} (HeyGen {vid}, {s.get('duration')}초 + 끝 카드 2.5초)")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "list":
        sys.exit(list_choices())
    if args[0] == "photo":
        sys.exit(photo_avatar(args[1] if len(args) > 1 else ""))
    for n in args[1:]:
        make(n)
