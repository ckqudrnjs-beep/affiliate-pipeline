"""유튜브 고급 기능 (BK 11/23 승인): 맞춤 썸네일 자동 설정 + 쇼츠 '관련 동영상' 안내 줄.

- 썸네일: thumbnails.set (youtube.upload 권한으로 됨). 실패해도 업로드는 그대로, 알림에 실패만 적는다.
- 관련 동영상: 쇼츠의 '관련 동영상'은 API 로 못 정한다 → 텔레그램 알림에 연결할 롱폼 제목+링크 한 줄을 넣어
  BK 가 스튜디오에서 고른다. 제휴 링크는 넣지 않는다.
"""
from __future__ import annotations

import io
import json
import pathlib
import subprocess
import sys
import urllib.request

THUMB_URL = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={vid}"
MAX_BYTES = 2 * 1024 * 1024  # 유튜브 썸네일 한도 2MB


def jpeg_bytes(img: pathlib.Path) -> bytes:
    """2MB 아래 1280x720 이하 JPEG 로."""
    from PIL import Image
    im = Image.open(img).convert("RGB")
    if im.width > 1280:
        im = im.resize((1280, round(im.height * 1280 / im.width)))
    for q in (92, 85, 75, 65):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue()
    return buf.getvalue()


def set_thumbnail(tok: str, vid: str, img: pathlib.Path | str | None) -> bool:
    if not img or not pathlib.Path(img).exists():
        return False
    try:
        req = urllib.request.Request(THUMB_URL.format(vid=vid), data=jpeg_bytes(pathlib.Path(img)), method="POST",
                                     headers={"Authorization": f"Bearer {tok}", "Content-Type": "image/jpeg"})
        urllib.request.urlopen(req, timeout=60).read()
        return True
    except Exception as e:  # noqa: BLE001  썸네일은 부가 기능
        print(f"썸네일 실패: {e}", file=sys.stderr)
        return False


def wide_from_square(src: pathlib.Path | str, out: pathlib.Path) -> pathlib.Path | None:
    """정사각 커버 → 16:9 썸네일 (흐린 배경 + 가운데 원본)."""
    try:
        from PIL import Image, ImageFilter
        im = Image.open(src).convert("RGB")
        bg = im.resize((1280, 1280)).crop((0, 280, 1280, 1000)).filter(ImageFilter.GaussianBlur(28))
        fg = im.resize((round(im.width * 720 / im.height), 720))
        bg.paste(fg, ((1280 - fg.width) // 2, 0))
        out.parent.mkdir(parents=True, exist_ok=True)
        bg.save(out, "JPEG", quality=90)
        return out
    except Exception as e:  # noqa: BLE001
        print(f"썸네일 만들기 실패: {e}", file=sys.stderr)
        return None


def frame(video: pathlib.Path | str, out: pathlib.Path, at: float = 3.0) -> pathlib.Path | None:
    """영상의 한 장면을 썸네일로 (실제 영상 화면)."""
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(at), "-i", str(video), "-frames:v", "1",
                        "-vf", "scale=1280:-2", str(out)], check=True, timeout=60)
        return out if out.exists() else None
    except Exception as e:  # noqa: BLE001
        print(f"장면 추출 실패: {e}", file=sys.stderr)
        return None


def related_line(title: str | None, vid: str | None) -> str:
    """쇼츠 알림에 붙일 '관련 동영상' 줄. 없으면 빈 문자열."""
    if not vid:
        return ""
    return f"\n🔗 관련 동영상(스튜디오에서 이 쇼츠에 연결): {title or '롱폼'} https://youtu.be/{vid}"


def latest(log_path: pathlib.Path, prefix: str = "", key_filter=None) -> tuple[str | None, str | None]:
    """업로드 기록에서 가장 최근 롱폼 (제목, id)."""
    try:
        log = json.loads(log_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None, None
    rows = [(v.get("date", k), v) for k, v in log.items() if isinstance(v, dict) and v.get("id")
            and k.startswith(prefix) and (key_filter is None or key_filter(k))]
    if not rows:
        return None, None
    _, v = max(rows, key=lambda x: x[0])
    return v.get("title"), v["id"]
