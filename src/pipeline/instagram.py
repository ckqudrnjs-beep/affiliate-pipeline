"""인스타그램 하루 1개 자동 게시 (2026-11-10, BK 승인: 게시마다 승인 없이, 추가 비용 없이).

- 공식 경로만: Instagram Graph API 콘텐츠 게시(무료). 토큰은 GitHub Secret IG_ACCESS_TOKEN 에서만 읽는다.
- 내용: 생활 팁만. 판매·특가·제휴 문구, 링크, 상품 가격은 넣지 않는다 (2026-11-08 스레드 제한 이후 규칙).
- 형식: 주로 릴스(1080×1920 슬라이드 영상), 주 1~2회 카드뉴스(1080×1350 캐러셀). 글은 data/instagram/posts/*.json.
  글이 떨어지면 config/tips.csv 의 생활 팁으로 대신 만든다.
- 미디어 주소: 인스타 API는 공개 URL에서 파일을 가져가므로, 그날 미디어만 static/ig/<slug>/ 에 올려
  don3chon.com/ig/<slug>/ 로 잠깐 공개하고, 게시가 끝나면 지운다.

명령:
  python -m pipeline.instagram prepare   다음 글을 골라 static/ig/<slug>/ 에 렌더링 (data/instagram/pending.json)
  python -m pipeline.instagram post      사이트 반영을 기다린 뒤 게시, data/instagram/published.json 기록
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

from .compliance import BANNED_PATTERNS
from .publish import InstagramClient

KST = dt.timezone(dt.timedelta(hours=9))
POSTS = pathlib.Path("data/instagram/posts")
LOG = pathlib.Path("data/instagram/published.json")
PENDING = pathlib.Path("data/instagram/pending.json")
MEDIA = pathlib.Path("static/ig")
TIPS = pathlib.Path("config/tips.csv")
BASE_URL = "https://don3chon.com"
HANDLE = "@don3chon"
BRAND = "돈 줍는 삼촌"
CAPTION_MAX = 2200

# 인스타는 생활 팁 계정으로만 쓴다. 이런 말이 들어가면 게시하지 않는다.
SALES_WORDS = ["특가", "할인", "세일", "최저가", "쿠폰", "구매", "주문하", "판매", "제휴", "파트너스", "수수료", "광고",
               "쿠팡", "알리", "익스프레스", "링크", "프로필", "DM", "디엠", "공구", "협찬", "핫딜", "don3chon.com"]


# ---------- 글 ----------

def check_post(post: dict) -> list[str]:
    """위반 사유 목록. 비어 있으면 통과."""
    errs = []
    if post.get("type") not in ("reel", "carousel"):
        errs.append("type 은 reel 또는 carousel")
    if not post.get("hook"):
        errs.append("hook(첫 화면 문구) 없음")
    slides = post.get("slides") or []
    if not 2 <= len(slides) <= 8:
        errs.append("slides 2~8개")
    tags = post.get("hashtags") or []
    if not 1 <= len(tags) <= 5:
        errs.append("해시태그 1~5개")
    text = full_text(post)
    for w in SALES_WORDS:
        if w.lower() in text.lower():
            errs.append(f"판매·제휴성 표현: {w}")
    if re.search(r"https?://|www\.|\.com\b|\.kr\b", text):
        errs.append("링크·주소가 있음")
    for pat in BANNED_PATTERNS:
        if re.search(pat, text):
            errs.append(f"금지 표현: /{pat}/")
    if len(caption(post)) > CAPTION_MAX:
        errs.append(f"캡션 {CAPTION_MAX}자 초과")
    return errs


def full_text(post: dict) -> str:
    parts = [post.get("hook", ""), post.get("sub", ""), post.get("outro", ""), post.get("caption", "")]
    for s in post.get("slides") or []:
        parts += [s.get("title", ""), s.get("body", "")]
    return "\n".join(parts + list(post.get("hashtags") or []))


def caption(post: dict) -> str:
    return post["caption"].strip() + "\n\n" + " ".join(post.get("hashtags") or [])


ITEM_RE = re.compile(r"^\s*(?:\d+[.)]|[□•·\-✔︎✅])\s*(.+)$")


def tip_to_post(tip: dict, slug: str, kind: str) -> dict | None:
    """config/tips.csv 한 줄을 게시물로 바꾼다. 항목이 2개 미만이면 None."""
    lines = [l.strip() for l in tip["text"].splitlines() if l.strip()]
    items = [m.group(1).strip() for l in lines if (m := ITEM_RE.match(l))]
    if len(items) < 2:
        return None
    others = [l for l in lines if not ITEM_RE.match(l)]
    hook = re.sub(r"\s*[\U0001F300-\U0001FAFF]\s*$", "", others[0]) if others else tip["topic"]
    outro = others[-1] if len(others) > 1 else "저장해 두고 하나씩 해 보세요"
    slides = []
    for it in items[:7]:
        m = re.match(r"(.+?)\s*\((.+)\)$", it)
        slides.append({"title": m.group(1), "body": m.group(2)} if m else {"title": it, "body": ""})
    topic = re.sub(r"\s+", "", tip["topic"])
    return {"slug": slug, "type": kind, "hook": hook, "sub": tip["topic"], "slides": slides, "outro": outro,
            "caption": tip["text"].strip(), "hashtags": [f"#{topic}", "#생활꿀팁", "#살림팁"]}


def kind_for(day: dt.date) -> str:
    """주 2회(수·일) 카드뉴스, 나머지 릴스."""
    return "carousel" if day.weekday() in (2, 6) else "reel"


def load_posts(posts_dir: pathlib.Path = POSTS) -> list[dict]:
    out = []
    for f in sorted(posts_dir.glob("*.json")):
        p = json.loads(f.read_text(encoding="utf-8"))
        p["slug"] = f.stem
        out.append(p)
    return out


def load_log(path: pathlib.Path | None = None) -> dict:
    path = path or LOG
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def next_post(today: dt.date, log: dict, posts_dir: pathlib.Path = POSTS, tips_path: pathlib.Path = TIPS) -> tuple[dict | None, list[str]]:
    """올릴 다음 글. 준비된 글(posts) 먼저, 없으면 생활 팁으로 대신."""
    notes = []
    for p in load_posts(posts_dir):
        if p["slug"] in log:
            continue
        errs = check_post(p)
        if errs:
            notes.append(f"{p['slug']} 건너뜀: " + "; ".join(errs))
            continue
        return p, notes
    if tips_path.exists():
        with open(tips_path, encoding="utf-8") as f:
            tips = [r for r in csv.DictReader(f) if r.get("text")]
        for i, t in enumerate(tips):
            slug = f"tip-{i + 1:03d}"
            if slug in log:
                continue
            p = tip_to_post(t, slug, kind_for(today))
            if p and not check_post(p):
                notes.append("준비된 글이 없어 생활 팁(config/tips.csv)으로 대신함")
                return p, notes
    notes.append("올릴 글이 없음: data/instagram/posts/ 에 글을 채우세요")
    return None, notes


# ---------- 렌더링 ----------
BG, INK, SUB, ACCENT, SOFT = "#f6f3ec", "#2b2a28", "#6b6863", "#1f4d3a", "#e4ddcf"


def font(size: int, bold: bool = True):
    from PIL import ImageFont
    names = (["NanumSquareEB.ttf", "NanumSquareB.ttf", "NanumGothicExtraBold.ttf", "NanumGothicBold.ttf"] if bold
             else ["NanumSquareR.ttf", "NanumGothic.ttf"])
    for f in [os.environ.get("VIDEO_FONT", "")] + [f"/usr/share/fonts/truetype/nanum/{n}" for n in names] + ["C:/Windows/Fonts/malgunbd.ttf"]:
        if f and pathlib.Path(f).exists():
            return ImageFont.truetype(f, size)
    raise SystemExit("한글 폰트 없음 (fonts-nanum 설치 또는 VIDEO_FONT)")


def wrap(dr, s: str, f, maxw: int) -> list[str]:
    """글자 단위까지 내려가며 줄바꿈 (한국어는 띄어쓰기 단위 우선)."""
    rows = []
    for para in s.split("\n"):
        cur = ""
        for wd in para.split(" "):
            t = (cur + " " + wd).strip()
            if dr.textlength(t, font=f) <= maxw:
                cur = t
                continue
            if cur:
                rows.append(cur)
            cur = ""
            for ch in wd:
                if dr.textlength(cur + ch, font=f) > maxw:
                    rows.append(cur)
                    cur = ""
                cur += ch
        rows.append(cur)
    return rows


EMOJI_RE = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F]")


def plain(s: str) -> str:
    """이미지에는 이모지를 그리지 않는다 (한글 폰트에 없음)."""
    return re.sub(r"\s{2,}", " ", EMOJI_RE.sub("", s)).strip()


def block(dr, x: int, y: int, s: str, size: int, maxw: int, fill: str, bold: bool = True, max_lines: int = 4,
          gap: float = 1.35, align: str = "left") -> int:
    """문단을 그리고 다음 y를 돌려준다. 넘치면 글자를 줄인다."""
    while True:
        f = font(size, bold)
        rows = wrap(dr, plain(s), f, maxw)
        if len(rows) <= max_lines or size <= 30:
            break
        size -= 4
    for r in rows:
        dx = (maxw - dr.textlength(r, font=f)) / 2 if align == "center" else 0
        dr.text((x + dx, y), r, font=f, fill=fill)
        y += int(size * gap)
    return y


def frames(post: dict, w: int, h: int) -> list:
    """표지 → 항목들 → 마무리. PIL 이미지 목록."""
    from PIL import Image, ImageDraw
    reel = h > 1500
    top, pad = (300 if reel else 110), 96          # 릴스는 위·아래 UI 가림 영역을 비운다
    maxw = w - pad * 2
    total = len(post["slides"]) + 2
    out = []

    def base(i: int):
        im = Image.new("RGB", (w, h), BG)
        dr = ImageDraw.Draw(im)
        f = font(34)
        dr.rounded_rectangle((pad, top - 90, pad + dr.textlength(BRAND, font=f) + 48, top - 30), 30, fill=ACCENT)
        dr.text((pad + 24, top - 82), BRAND, font=f, fill="white")
        if i:
            pg = f"{i + 1} / {total}"
            dr.text((w - pad - dr.textlength(pg, font=font(30, False)), top - 78), pg, font=font(30, False), fill=SUB)
        return im, dr

    bottom = h - (440 if reel else 150)

    def centered(im, draw) -> None:
        """draw(dr, y) 가 그린 내용을 위아래 가운데에 놓는다."""
        layer = Image.new("RGB", (w, h * 2), BG)
        end = draw(ImageDraw.Draw(layer), 0)
        y = top + max(0, (bottom - top - end) // 2)
        im.paste(layer.crop((0, 0, w, end)), (0, y))

    def cover(dr, y):
        y = block(dr, pad, y, post["hook"], 108 if reel else 92, maxw, INK, max_lines=4, gap=1.28)
        if post.get("sub"):
            dr.rectangle((pad, y + 30, pad + 90, y + 38), fill=ACCENT)
            y = block(dr, pad, y + 70, post["sub"], 56 if reel else 52, maxw, ACCENT, max_lines=2)
        return y

    im, dr = base(0)
    centered(im, cover)
    if not reel:
        f = font(34, False)
        dr.text((w - pad - dr.textlength("넘겨서 보기 →", font=f), h - 120), "넘겨서 보기 →", font=f, fill=SUB)
    out.append(im)

    for i, s in enumerate(post["slides"], start=1):
        def item(dr, y, i=i, s=s):
            r = 66 if reel else 62
            dr.ellipse((pad, y, pad + r * 2, y + r * 2), fill=ACCENT)
            fn = font(68 if reel else 64)
            dr.text((pad + r - dr.textlength(str(i), font=fn) / 2, y + r - 38), str(i), font=fn, fill="white")
            y = block(dr, pad, y + r * 2 + 60, s["title"], 92 if reel else 76, maxw, INK, max_lines=4, gap=1.3)
            if s.get("body"):
                dr.rectangle((pad, y + 24, w - pad, y + 27), fill=SOFT)
                y = block(dr, pad, y + 64, s["body"], 58 if reel else 50, maxw, SUB, bold=False, max_lines=7, gap=1.5)
            return y
        im, dr = base(i)
        centered(im, item)
        out.append(im)

    def outro(dr, y):
        y = block(dr, pad, y, post.get("outro") or "저장해 두고 꺼내 보세요", 84 if reel else 80, maxw, INK,
                  max_lines=4, gap=1.3, align="center")
        return block(dr, pad, y + 60, f"{HANDLE} · 저장 · 공유", 46 if reel else 44, maxw, ACCENT, bold=False,
                     max_lines=1, align="center")

    im, dr = base(total - 1)
    centered(im, outro)
    out.append(im)
    return out


def seconds_for(post: dict, i: int) -> float:
    """화면별 길이: 글자 수에 맞춰 3~6초, 표지·마무리 2.5초."""
    if i == 0 or i == len(post["slides"]) + 1:
        return 2.5
    s = post["slides"][i - 1]
    return max(3.0, min(6.0, 1.6 + 0.07 * len(s["title"] + s.get("body", ""))))


def render(post: dict, out_dir: pathlib.Path) -> list[str]:
    """미디어 파일을 만들고 파일 이름 목록을 돌려준다. 릴스: reel.mp4 + cover.jpg, 카드뉴스: 1.jpg…"""
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    if post["type"] == "carousel":
        names = []
        for i, im in enumerate(frames(post, 1080, 1350), start=1):
            im.save(out_dir / f"{i}.jpg", "JPEG", quality=90)   # 인스타 API 사진은 JPEG만
            names.append(f"{i}.jpg")
        return names
    ims = frames(post, 1080, 1920)
    ims[0].save(out_dir / "cover.jpg", "JPEG", quality=90)
    with tempfile.TemporaryDirectory() as tmp:
        t = pathlib.Path(tmp)
        lst = []
        for i, im in enumerate(ims):
            png, seg = t / f"{i}.png", t / f"{i}.mp4"
            im.save(png)
            d = seconds_for(post, i)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", f"{d}", "-i", str(png),
                            "-vf", f"fps=30,fade=t=in:st=0:d=0.25:color={BG},fade=t=out:st={d - 0.25}:d=0.25:color={BG},format=yuv420p",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-g", "60", str(seg)], check=True)
            lst.append(f"file '{seg}'")
        (t / "list.txt").write_text("\n".join(lst), encoding="utf-8")
        # 무음 AAC 트랙을 넣는다 (일부 앱이 오디오 없는 영상을 다르게 처리)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(t / "list.txt"),
                        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart",
                        str(out_dir / "reel.mp4")], check=True)
    return ["reel.mp4", "cover.jpg"]


# ---------- 게시 ----------

class Publisher(InstagramClient):
    def _wait(self, cid: str, tries: int = 60, every: float = 5) -> None:
        for _ in range(tries):
            st = self.call("GET", f"{self.base}/{cid}", {"fields": "status_code,status", "access_token": self.token})
            if st.get("status_code") == "FINISHED":
                return
            if st.get("status_code") in ("ERROR", "EXPIRED"):
                raise RuntimeError(f"인스타 미디어 처리 실패: {st.get('status', '')}")
            time.sleep(every)
        raise RuntimeError("인스타 미디어 처리 시간 초과")

    def _publish(self, cid: str) -> dict:
        p = self.call("POST", f"{self.base}/{self.user}/media_publish", {"creation_id": cid, "access_token": self.token})
        info = self.call("GET", f"{self.base}/{p['id']}", {"fields": "permalink", "access_token": self.token})
        return {"id": p["id"], "url": info.get("permalink", "")}

    def reel(self, video_url: str, cover_url: str, text: str) -> dict:
        c = self.call("POST", f"{self.base}/{self.user}/media",
                      {"media_type": "REELS", "video_url": video_url, "cover_url": cover_url, "caption": text,
                       "share_to_feed": "true", "access_token": self.token})
        self._wait(c["id"])
        return self._publish(c["id"])

    def carousel(self, image_urls: list[str], text: str) -> dict:
        kids = []
        for u in image_urls:
            k = self.call("POST", f"{self.base}/{self.user}/media",
                          {"image_url": u, "is_carousel_item": "true", "access_token": self.token})
            self._wait(k["id"], tries=20, every=3)
            kids.append(k["id"])
        c = self.call("POST", f"{self.base}/{self.user}/media",
                      {"media_type": "CAROUSEL", "children": ",".join(kids), "caption": text, "access_token": self.token})
        self._wait(c["id"], tries=20, every=3)
        return self._publish(c["id"])


def published_today(log: dict, now: dt.datetime) -> bool:
    day = now.astimezone(KST).date().isoformat()
    return any(r.get("at", "").startswith(day) for r in log.values())


def wait_live(urls: list[str], timeout: int = 900, every: int = 20) -> None:
    """사이트(Cloudflare Pages) 배포가 끝나 파일이 실제로 열릴 때까지 기다린다.
    없는 주소도 200(index.html)으로 올 수 있어 Content-Type 으로 확인한다."""
    end = time.time() + timeout
    left = list(urls)
    while left and time.time() < end:
        u = left[0]
        try:
            req = urllib.request.Request(u, method="HEAD", headers={"User-Agent": "don3chon-ig-bot"})
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.headers.get("Content-Type", "").split(";")[0] in ("video/mp4", "image/jpeg"):
                    left.pop(0)
                    continue
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(every)
    if left:
        raise RuntimeError(f"사이트에 미디어가 아직 안 올라옴 ({left[0]}): Cloudflare Pages 배포 확인")


def enabled(env: dict) -> bool:
    return bool(env.get("IG_ACCESS_TOKEN")) and env.get("INSTAGRAM_ENABLED", "").lower() != "false"


def prepare(env: dict, now: dt.datetime) -> list[str]:
    log = load_log()
    if published_today(log, now):
        return ["오늘은 이미 게시함"]
    if PENDING.exists():
        p = json.loads(PENDING.read_text(encoding="utf-8"))
        if p["slug"] not in log and (MEDIA / p["slug"]).exists():
            return [f"이전에 준비한 {p['slug']} 를 이어서 게시"]
    post, notes = next_post(now.astimezone(KST).date(), log)
    if not post:
        return notes
    # 이미 게시한 이전 미디어는 지운다 (Meta가 게시 때 복사해 가므로 사이트에 남길 필요 없음)
    if MEDIA.exists():
        for d in MEDIA.iterdir():
            if d.is_dir() and d.name != post["slug"]:
                shutil.rmtree(d)
    files = render(post, MEDIA / post["slug"])
    PENDING.parent.mkdir(parents=True, exist_ok=True)
    PENDING.write_text(json.dumps({**post, "files": files}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return notes + [f"준비: {post['slug']} ({post['type']}, {len(files)}개 파일) → static/ig/{post['slug']}/"]


def post(env: dict, now: dt.datetime, client=None) -> list[str]:
    if not PENDING.exists():
        return ["준비된 글 없음"]
    p = json.loads(PENDING.read_text(encoding="utf-8"))
    log = load_log()
    if p["slug"] in log or published_today(log, now):
        return [f"{p['slug']}: 이미 게시함 (오늘 1개 상한)"]
    errs = check_post(p)
    if errs:
        return [f"{p['slug']}: 게시 중단: " + "; ".join(errs)]
    base = f"{env.get('SITE_URL') or BASE_URL}/ig/{p['slug']}/"
    urls = [base + f for f in p["files"]]
    if client is None:
        wait_live(urls)
        client = Publisher(env["IG_ACCESS_TOKEN"], env.get("IG_USER_ID") or "")
    text = caption(p)
    res = client.reel(urls[0], urls[1], text) if p["type"] == "reel" else client.carousel(urls, text)
    log[p["slug"]] = {"at": now.astimezone(KST).isoformat(timespec="seconds"), "type": p["type"], "hook": p["hook"], **res}
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PENDING.unlink()
    shutil.rmtree(MEDIA / p["slug"], ignore_errors=True)
    return [f"게시 완료: {p['slug']} ({p['type']}) {res.get('url', '')}"]


def main(argv: list[str]) -> int:
    env, now = dict(os.environ), dt.datetime.now(KST)
    cmd = argv[1] if len(argv) > 1 else "prepare"
    try:
        lines = prepare(env, now) if cmd == "prepare" else post(env, now)
    except Exception as e:
        print(f"실패: {e}")
        return 1
    for line in lines:
        print(line)
    out = os.environ.get("GITHUB_OUTPUT")
    if out and cmd == "prepare":
        with open(out, "a") as f:
            f.write(f"ready={'true' if PENDING.exists() and not published_today(load_log(), now) else 'false'}\n")
    return 1 if any("게시 중단" in l for l in lines) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
