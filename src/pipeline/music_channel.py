"""BEEKAY SONGS 노래 채널 자동 업로드 (BK 2026-11-21 21:05 '시작하자').

흐름: BK가 Suno 곡(mp3)을 구글 드라이브 폴더 'BEEKAY SONGS'에 넣는다
  → (화·금 실행) 아직 안 올린 곡 1개를 받아
  → 곡 파일 안의 커버(또는 같은 이름의 jpg/png)로 전곡 커버 영상 + 후렴 40초 쇼츠를 만들고 (music_cover)
  → 설명란에 AI 음악 표기 + 가사(곡 파일 안 가사)를 넣어 BEEKAY SONGS 채널에 올린다.
- 장르 표시: 템포로 자동 (느리면 BALLAD, 아니면 K-POP · IDOL).
- 실제 가수·그룹 이름은 제목·설명에 넣지 않는다 (사칭·저작권). 곡 제목에 들어 있으면 멈춘다.
- config/music_channel.json visibility: private(기본, BK 확인) | schedule(publish_hour KST 공개 예약, 쇼츠는 다음 날).
- 기록: data/music/uploaded.json (키 = 드라이브 파일 id). 같은 곡은 다시 올리지 않는다.
- 안전장치: 저장소 변수 MUSIC_YT_ENABLED=true 가 아니면 만들기만 하고 올리지 않는다.

인증 (GitHub Secrets, 로그에 찍지 않음): YT_CLIENT_ID / YT_CLIENT_SECRET (기존 앱 재사용)
  + MUSIC_YT_REFRESH_TOKEN (youtube.upload, 채널 선택에서 BEEKAY SONGS)
  + MUSIC_DRIVE_REFRESH_TOKEN (drive.readonly, BK 본 계정). 발급: docs/MUSIC_CHANNEL.md

실행: PYTHONPATH=src python -m pipeline.music_channel run [--local 곡.mp3]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

KST = dt.timezone(dt.timedelta(hours=9))
ROOT = pathlib.Path(".")
CFG = pathlib.Path("config/music_channel.json")
LOG = pathlib.Path("data/music/uploaded.json")
WORK = pathlib.Path("media/music")
DRIVE = "https://www.googleapis.com/drive/v3"
AUDIO_EXT = (".mp3", ".wav", ".m4a")
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")
TAGS = ["BEEKAY SONGS", "K-POP", "AI music", "Suno", "케이팝", "아이돌", "발라드", "신곡"]
# 실제 가수·그룹 이름이 제목에 들어가면 멈춘다 (예시 목록, 필요하면 늘림)
BANNED = ["bts", "방탄", "blackpink", "블랙핑크", "newjeans", "뉴진스", "seventeen", "세븐틴", "stray kids", "스트레이 키즈",
          "aespa", "에스파", "ive", "아이브", "twice", "트와이스", "exo", "엑소", "nct", "le sserafim", "르세라핌",
          "아이유", "iu", "임영웅", "riize", "라이즈", "txt", "투모로우바이투게더", "zerobaseone", "제로베이스원"]
AI_NOTE = ("※ 이 노래는 BEEKAY가 AI 음악 도구 Suno(유료 플랜)로 만든 창작곡입니다. 실제 가수·그룹과는 관련이 없습니다.\n"
           "This is an original song made by BEEKAY with Suno (paid plan). Not affiliated with any real artist.")


def load(path: pathlib.Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


# ---------- 곡 정보 ----------
def tags_of(audio: pathlib.Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags", "-of", "json", str(audio)],
                         capture_output=True, text=True).stdout
    tags = (json.loads(out or "{}").get("format") or {}).get("tags") or {}
    return {k.lower(): v for k, v in tags.items()}


def lyrics_of(tags: dict) -> str:
    raw = next((v for k, v in tags.items() if k.startswith("lyrics") or k == "unsyncedlyrics"), "")
    return clean_lyrics(raw)


def clean_lyrics(raw: str) -> str:
    """[Verse] 같은 구간 표시를 빼고 빈 줄로 구간을 나눈다."""
    lines, out = [l.strip() for l in raw.replace("\r", "").split("\n")], []
    for l in lines:
        if re.fullmatch(r"\[[^\]]*\]", l):
            if out and out[-1] != "":
                out.append("")
            continue
        out.append(l)
    text = "\n".join(out).strip()
    return re.sub(r"\n{3,}", "\n\n", text)


def version_of(name: str) -> str:
    """같은 곡의 여성·남성 버전 구분 (파일 이름 기준)."""
    low = name.lower()
    if any(k in low for k in ("여성", "여자", "female", "girl")):
        return "Female ver."
    if any(k in low for k in ("남성", "남자", "male", "boy")):
        return "Male ver."
    return ""


def title_of(tags: dict, fallback: str) -> str:
    t = (tags.get("title") or "").strip() or re.sub(r"[_-]+", " ", re.sub(r"\s*\(\d+\)$", "", pathlib.Path(fallback).stem)).strip()
    v = version_of(pathlib.Path(fallback).name)
    if v and v.lower() not in t.lower():
        t = f"{t} ({v})"
    return t[:80]


def banned_hit(text: str) -> str | None:
    low = text.lower()
    for b in BANNED:
        if re.search(rf"(?<![a-z0-9가-힣]){re.escape(b)}(?![a-z0-9가-힣])", low):
            return b
    return None


def analyse(audio: pathlib.Path) -> dict:
    """템포(대략)와 가장 센 40초 구간(후렴 추정) 시작 초."""
    import numpy as np
    sr, hop = 22050, 512
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    n = len(x) // hop
    fr = x[: n * hop].reshape(n, hop)
    rms = np.sqrt((fr ** 2).mean(1))
    spec = np.abs(np.fft.rfft(fr * np.hanning(hop), axis=1))
    flux = np.maximum(np.diff(np.log1p(spec), axis=0), 0).sum(1)
    flux -= flux.mean()
    ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
    fps = sr / hop
    lags = np.arange(1, len(ac))
    bpm = 60 * fps / lags
    m = (bpm > 60) & (bpm < 200)
    tempo = float(bpm[m][np.argmax(ac[1:][m])]) if m.any() else 0.0
    return {"bpm": round(tempo, 1), "duration": len(x) / sr, "rms": rms, "fps": fps}


def best_window(rms, fps: float, length: float, duration: float) -> float:
    import numpy as np
    w = int(length * fps)
    if len(rms) <= w:
        return 0.0
    cs = np.concatenate([[0], np.cumsum(rms)])
    means = (cs[w:] - cs[:-w]) / w
    lo = int(min(duration * 0.15, duration - length) * fps)  # 인트로는 피함
    i = lo + int(np.argmax(means[lo:])) if lo < len(means) else int(np.argmax(means))
    return round(i / fps, 2)


def snap_chorus(rms, fps: float, start: float, length: float, duration: float, look: float = 10.0) -> float:
    """BK 11/24 '추천 방향으로': 쇼츠 첫 1초가 후렴의 센 부분이게. 고른 구간 시작에서 look 초 안에
    소리가 확 커지는 지점(1초 평균이 그 구간 최고의 85% 이상인 첫 지점)으로 시작을 당긴다.
    전주·브리지 끝부분으로 열리면 첫 1초에 넘겨지므로."""
    import numpy as np
    k = max(1, int(fps))
    a, b = int(start * fps), int(min(start + look + 1, duration) * fps)
    seg = np.asarray(rms[a:b], dtype=float)
    if len(seg) <= k:
        return start
    sm = np.convolve(seg, np.ones(k) / k, "valid")  # sm[j] = j~j+1초 평균
    hit = np.nonzero(sm >= 0.85 * sm.max())[0]
    t = start + (int(hit[0]) / fps if len(hit) else 0.0)
    t = min(t, max(0.0, duration - length - 1))  # 40초가 곡 안에 들어가게
    return round(max(start, t), 2)


def extra_windows(rms, fps: float, length: float, duration: float, used: list[float], n: int,
                  gap: float | None = None) -> list[float]:
    """이미 쓴 구간 시작점과 gap 초 이상 떨어진 다음으로 꽉 찬 구간 n개 (같은 곡에서 쇼츠 더 만들기)."""
    gap = length if gap is None else gap
    import numpy as np
    w = int(length * fps)
    if len(rms) <= w:
        return []
    cs = np.concatenate([[0], np.cumsum(rms)])
    means = (cs[w:] - cs[:-w]) / w
    lo = int(min(duration * 0.08, duration - length) * fps)
    taken = [u for u in used]
    out = []
    order = np.argsort(-means)
    for i in order:
        if i < lo:
            continue
        t = i / fps
        if t + length > duration - 3:
            continue
        if all(abs(t - u) >= gap for u in taken):
            out.append(round(float(t), 2))
            taken.append(t)
            if len(out) >= n:
                break
    return out


def first_line(subs: list) -> str:
    return subs[0][2] if subs else ""


def genre_tag(bpm: float) -> str:
    """느린 곡 = 발라드. (자동 추정이라 틀릴 수 있음 → 파일 이름에 '발라드'가 있으면 그걸 따름)"""
    return "BALLAD · 발라드" if 0 < bpm < 88 else "K-POP · IDOL"


SUB_LINE = "🔔 새 노래가 나오면 알림 받기: https://www.youtube.com/@beekaysongs?sub_confirmation=1"
LIKE_LINE = "🎧 마음에 들었다면 좋아요로 알려 주세요. 다음 곡 방향을 정할 때 참고해요."


def description(title: str, lyrics: str, channel: str, short: bool = False, extra: str = "") -> str:
    # 2026-11-23 BK '채널 모두 구독 좋아요 등 유도합시다': 부드러운 한 줄씩 (보상 약속·강요 문구 없음)
    parts = [f"{title} — {channel}"] + (["", extra] if extra else []) + ["", SUB_LINE, LIKE_LINE, "", AI_NOTE]
    if not short and lyrics:
        parts += ["", "🎤 가사 Lyrics", "", lyrics]
    parts += ["", "#KPOP #AImusic #Suno #신곡" + (" #shorts" if short else "")]
    return "\n".join(parts)[:4900]


def full_link(video_id: str) -> str:
    """쇼츠 설명 첫 줄: 원곡 링크 (BK 11/25 '관련 동영상 연결 자동으로 안되나?' — 그 칸은 API 에 없어 대신 설명 첫 줄)."""
    return f"🎧 전체 노래 듣기 👉 https://youtu.be/{video_id}"


def video_body(title: str, desc: str, publish_at: dt.datetime | None, short: bool = False) -> dict:
    status = {"privacyStatus": "private", "selfDeclaredMadeForKids": False, "containsSyntheticMedia": True}
    if publish_at:
        status["publishAt"] = publish_at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"snippet": {"title": title[:100], "description": desc, "tags": TAGS, "categoryId": "10",
                        "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
            "status": status}


def slots(now: dt.datetime, cfg: dict) -> tuple[dt.datetime | None, dt.datetime | None]:
    if cfg.get("visibility") != "schedule":
        return None, None
    h = int(cfg.get("publish_hour", 19))
    main = now.astimezone(KST).replace(hour=h, minute=0, second=0, microsecond=0)
    if main <= now + dt.timedelta(hours=2):
        main += dt.timedelta(days=1)
    return main, main + dt.timedelta(days=int(cfg.get("short_delay_days", 1)))


# ---------- 드라이브 (읽기 전용) ----------
def _get(token: str, url: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


DIAG: list[str] = []


def drive_inbox(token: str, folder_name: str, folder_id: str = "") -> list[dict]:
    """folder_id 가 있으면 그 폴더를 바로 읽는다(이름 검색은 색인 지연·동명 폴더 문제가 있음)."""
    DIAG.clear()
    ids: list[str] = []
    if folder_id:
        try:
            _get(token, f"{DRIVE}/files/{folder_id}?fields=id")
            ids = [folder_id]
        except urllib.error.HTTPError as e:
            DIAG.append(f"폴더 id 접근 실패 HTTP {e.code} (다른 구글 계정 토큰이거나 권한 범위 문제)")
    if not ids:
        q = urllib.parse.quote(f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")
        ids = [f["id"] for f in _get(token, f"{DRIVE}/files?q={q}&fields=files(id)").get("files", [])]
        DIAG.append(f"이름으로 찾은 폴더 {len(ids)}개")
    if not ids:
        try:
            seen = len(_get(token, f"{DRIVE}/files?pageSize=20&fields=files(id)").get("files", []))
            DIAG.append(f"토큰으로 보이는 파일 {seen}개" + (" — 이 토큰은 드라이브 파일을 못 봄(drive.readonly 아님?)" if not seen else ""))
            info = _get(token, f"https://oauth2.googleapis.com/tokeninfo?access_token={token}")
            DIAG.append("권한: " + info.get("scope", "?").replace("https://www.googleapis.com/auth/", ""))
        except Exception as e:  # noqa: BLE001 진단용
            DIAG.append(f"진단 실패 {e}")
    files: list[dict] = []
    for fid in ids:
        q = urllib.parse.quote(f"'{fid}' in parents and trashed = false")
        page = ""
        while True:
            r = _get(token, f"{DRIVE}/files?q={q}&fields=nextPageToken,files(id,name,mimeType,createdTime,size)"
                            f"&orderBy=createdTime&pageSize=100" + (f"&pageToken={page}" if page else ""))
            files += r.get("files", [])
            page = r.get("nextPageToken", "")
            if not page:
                break
    return files


def pending(files: list[dict], log: dict) -> list[dict]:
    """오래된 순. 같은 이름의 이미지가 있으면 cover 로 붙인다."""
    imgs = {pathlib.Path(f["name"]).stem.lower(): f for f in files if f["name"].lower().endswith(IMG_EXT)}
    out = []
    for f in files:
        if f["name"].lower().endswith(AUDIO_EXT) and f["id"] not in log:
            out.append({**f, "cover": imgs.get(pathlib.Path(f["name"]).stem.lower())})
    return out


def download(token: str, fid: str, dest: pathlib.Path) -> pathlib.Path:
    req = urllib.request.Request(f"{DRIVE}/files/{fid}?alt=media", headers={"Authorization": f"Bearer {token}"})
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(req, timeout=300) as r:
        dest.write_bytes(r.read())
    return dest


# ---------- 만들기 ----------
def make(audio: pathlib.Path, cover: pathlib.Path | None, cfg: dict, name: str = "", ov: dict | None = None) -> dict:
    """ov = config releases[드라이브 id]: title / cover(저장소 경로) / publish_at / short_publish_at / extra."""
    from .music_cover import extract_cover, video
    ov = ov or {}
    tags = tags_of(audio)
    title = ov.get("title") or title_of(tags, name or audio.name)
    if ov.get("cover") and (ROOT / ov["cover"]).exists():
        cover = ROOT / ov["cover"]
    hit = banned_hit(title)
    if hit:
        raise ValueError(f"제목에 실제 가수·그룹 이름({hit})이 있어 올리지 않음: {title}")
    an = analyse(audio)
    tag = "BALLAD · 발라드" if "발라드" in (name or audio.name) else genre_tag(an["bpm"])
    WORK.mkdir(parents=True, exist_ok=True)
    stem = re.sub(r"[^0-9A-Za-z가-힣]+", "-", title).strip("-")[:40] or "song"
    cov = cover or extract_cover(audio, WORK / f"{stem}-cover.jpg")
    if not cov:
        raise ValueError("커버 이미지가 없음 (곡 파일 안에도 없고, 같은 이름의 jpg/png 도 없음)")
    channel = cfg.get("channel", "BEEKAY SONGS")
    full = video(audio, cov, title, channel, tag, WORK / f"{stem}.mp4")
    length = float(cfg.get("short_length", 40))
    start = float(ov["short_start"]) if ov.get("short_start") is not None else \
        snap_chorus(an["rms"], an["fps"], best_window(an["rms"], an["fps"], length, an["duration"]), length, an["duration"])
    lyr = lyrics_of(tags)
    from .music_lyrics import subtitles
    subs = subtitles(audio, lyr, start, length) if cfg.get("short_lyrics", True) else []
    sh = video(audio, cov, title, channel, tag, WORK / f"{stem}-short.mp4", vertical=True, start=start,
               length=length, cta="전체 듣기는 채널에서 ▶", subs=subs)
    return {"title": title, "tag": tag, "bpm": an["bpm"], "short_start": start, "video": full["video"],
            "short": sh["video"], "cover": str(cov), "lyrics": bool(lyr), "subs": len(subs),
            "desc": description(title, lyr, channel, extra=ov.get("_extra", "")),
            "short_desc": description(title, lyr, channel, short=True)}


def summary(text: str) -> None:
    print(text)
    p = os.environ.get("GITHUB_STEP_SUMMARY")
    if p:
        with open(p, "a", encoding="utf-8") as f:
            f.write(text + "\n")


def notify(text: str) -> None:
    try:
        from .api_check import send
        send(text)
    except Exception as e:  # 알림 실패는 업로드를 막지 않음
        print("알림 실패:", e)


def fixed_slots(ov: dict, now: dt.datetime) -> tuple[dt.datetime | None, dt.datetime | None] | None:
    """config 에 날짜를 박아 둔 곡(예: 여성 버전 먼저, 남성 버전 3일 뒤). 이미 지난 시각이면 None → 기본 규칙."""
    if not ov.get("publish_at"):
        return None
    a = dt.datetime.fromisoformat(ov["publish_at"])
    b = dt.datetime.fromisoformat(ov["short_publish_at"]) if ov.get("short_publish_at") else a + dt.timedelta(days=1)
    return (a, b) if a > now + dt.timedelta(minutes=30) else None


def related(log: dict, fid: str, title: str, full_id: str | None) -> str:
    """쇼츠 '관련 동영상' 안내 (API 불가 → BK 가 스튜디오에서): Official MV 가 있으면 MV, 없으면 전곡 영상."""
    from .yt_extras import related_line
    mv = log.get(f"mv:{fid}", {})
    if mv.get("video_id"):
        return related_line(mv.get("title"), mv["video_id"])
    return related_line(f"{title} (전곡)", full_id)


def music_token(cfg: dict) -> str:
    """MUSIC_YT_REFRESH_TOKEN 의 access token. 11/24: 토큰이 돈삼촌 채널로 발급된 일이 있어,
    토큰 채널 이름이 config channel(BEEKAY SONGS)과 다르거나 확인이 안 되면 올리지 않고 멈춘다."""
    from .youtube import access_token
    from .first_comment import my_channel
    tok = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"], os.environ["MUSIC_YT_REFRESH_TOKEN"])
    want = cfg.get("channel", "BEEKAY SONGS")
    cid, title = my_channel(tok)
    if not cid or title.strip().lower() != want.strip().lower():
        raise RuntimeError(f"MUSIC 토큰 채널이 '{title or '확인 불가'}' — '{want}' 가 아니라 업로드 중단. "
                           "oauthplayground 채널 선택에서 BEEKAY SONGS 로 다시 받기 (docs/MUSIC_CHANNEL.md)")
    return tok


def upload_pair(meta: dict, cfg: dict, now: dt.datetime, ov: dict | None = None) -> dict:
    from .youtube import upload
    token = music_token(cfg)
    at_main, at_short = fixed_slots(ov or {}, now) or slots(now, cfg)
    channel = cfg.get("channel", "BEEKAY SONGS")
    r1 = upload(token, video_body(f"{meta['title']} | {channel}", meta["desc"], at_main), pathlib.Path(meta["video"]))
    short_desc = f"{full_link(r1['id'])}\n\n{meta['short_desc']}"  # 쇼츠 → 원곡 연결 (관련 동영상은 API 불가, BK 11/25)
    r2 = upload(token, video_body(f"{meta['title']} 🎧 #shorts", short_desc, at_short, short=True),
                pathlib.Path(meta["short"]))
    from .yt_extras import set_thumbnail, wide_from_square  # 전곡 영상 맞춤 썸네일 (BK 11/23 고급 기능)
    cov = meta.get("cover")
    thumb = cov and set_thumbnail(token, r1["id"], wide_from_square(cov, pathlib.Path(cov).with_suffix(".wide.jpg")))
    return {"video_id": r1["id"], "short_id": r2["id"], "thumb": bool(thumb),
            "publish_at": at_main.isoformat() if at_main else "private",
            "short_publish_at": at_short.isoformat() if at_short else "private"}


def run(local: str | None = None, now: dt.datetime | None = None) -> int:
    now = now or dt.datetime.now(KST)
    cfg = load(CFG, {})
    if not cfg.get("on"):
        summary("music_channel: 꺼짐 (config on=false)")
        return 0
    log = load(LOG, {})
    enabled = os.environ.get("MUSIC_YT_ENABLED", "").lower() == "true"
    if local:
        jobs = [{"id": f"local:{pathlib.Path(local).name}", "name": pathlib.Path(local).name, "path": local, "cover": None}]
        dtoken = ""
    else:
        try:
            from .youtube import access_token
            dtoken = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"],
                                  os.environ["MUSIC_DRIVE_REFRESH_TOKEN"])
        except KeyError as e:
            summary(f"Secret 없음: {e.args[0]} → 아직 연결 전이라 쉼 (docs/MUSIC_CHANNEL.md)")
            return 0
        folder = cfg.get("inbox_folder", "BEEKAY SONGS")
        files = drive_inbox(dtoken, folder, cfg.get("inbox_folder_id", ""))
        jobs = pending(files, log)
        try:
            run_extras(dtoken, cfg, log, now, enabled)
        except urllib.error.HTTPError as e:
            summary(f"::warning::추가 쇼츠 실패: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:300]}")
        except (subprocess.CalledProcessError, KeyError) as e:
            summary(f"::warning::추가 쇼츠 실패: {e}")
        if not jobs:
            summary(f"새 곡 없음 (드라이브 '{folder}' 폴더 파일 {len(files)}개, 아직 안 올린 곡 0개"
                    + (" — 폴더를 못 찾았거나 비어 있음)" if not files else ")")
                    + ("\n진단: " + " / ".join(DIAG) if DIAG else ""))
            return 0
    rel = cfg.get("releases", {})
    jobs.sort(key=lambda j: rel.get(j["id"], {}).get("publish_at", "9999"))
    done = 0
    for job in jobs[: int(cfg.get("max_per_run", 1))]:
        ov = dict(rel.get(job["id"], {}))
        if cfg.get("require_cover") and not ov.get("cover") and not job.get("cover"):
            msg = (f"🎵 BEEKAY SONGS: '{job['name']}' 커버 그림이 없어 보류 — 드라이브에 같은 이름 jpg 를 넣거나, "
                   "Claude 에게 그림 커버(Kling 크레딧 4개)를 부탁하세요.")
            summary(msg)
            notify(msg)
            continue
        pair = log.get(ov.get("pair_of", ""), {})
        if ov.get("ask") and pair.get("video_id"):
            ov["_extra"] = (f"🎧 {pair.get('title', '다른 버전')}: https://youtu.be/{pair['video_id']}\n"
                            f"{ov['ask']}")
        try:
            if local:
                audio, cover = pathlib.Path(job["path"]), None
            else:
                audio = download(dtoken, job["id"], WORK / "in" / job["name"])
                cover = download(dtoken, job["cover"]["id"], WORK / "in" / job["cover"]["name"]) if job.get("cover") else None
            meta = make(audio, cover, cfg, job["name"], ov)
        except (ValueError, subprocess.CalledProcessError) as e:
            summary(f"::error::{job['name']} 만들기 실패: {e}")
            notify(f"🎵 BEEKAY SONGS: '{job['name']}' 영상 만들기 실패 — {e}")
            continue
        (WORK / "last.json").write_text(json.dumps({k: v for k, v in meta.items() if k not in ("desc", "short_desc")},
                                                   ensure_ascii=False, indent=1), encoding="utf-8")
        if not enabled:
            summary(f"[만들기만] {meta['title']} ({meta['tag']}, {meta['bpm']} BPM, 쇼츠 {meta['short_start']}초부터) "
                    f"— MUSIC_YT_ENABLED=true 가 아니라 안 올림\n```\n{meta['desc'][:1500]}\n```")
            continue
        try:
            res = upload_pair(meta, cfg, now, ov)
        except KeyError as e:
            summary(f"::error::Secret 없음: {e.args[0]} (docs/MUSIC_CHANNEL.md)")
            return 1
        except urllib.error.HTTPError as e:
            summary(f"::error::유튜브 API 오류 {e.code}: {e.read().decode('utf-8', 'replace')[:400]}")
            return 1
        log[job["id"]] = {"name": job["name"], "title": meta["title"], "tag": meta["tag"], "date": now.strftime("%Y-%m-%d"), **res}
        LOG.parent.mkdir(parents=True, exist_ok=True)
        LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
        when = "비공개(확인용)" if res["publish_at"] == "private" else f"{res['publish_at'][:16]} 공개 예약"
        link = f"https://studio.youtube.com/video/{res['video_id']}/edit"
        st = int(meta["short_start"])
        summary(f"업로드 완료: {meta['title']} → {when} (쇼츠 {st // 60}:{st % 60:02d}부터 {int(cfg.get('short_length', 40))}초)\n{link}")
        notify(f"🎵 BEEKAY SONGS 새 곡 업로드: {meta['title']} ({when})\n{link}"
               + (related(log, job["id"], meta["title"], res["video_id"]) if res.get("short_id") else ""))
        if res["publish_at"] != "private":  # 게시물 예고 글 (BK 11/23 '구독할 이유'): 커버 + 공개 시각 → BK 붙여넣기
            from . import community_posts
            community_posts.music(meta["title"], meta.get("cover"), dt.datetime.fromisoformat(res["publish_at"]), (ov or {}).get("ask", ""))
        done += 1
    return 0


def run_extras(dtoken: str, cfg: dict, log: dict, now: dt.datetime, enabled: bool) -> int:
    """releases[id].extra_shorts = [{"publish_at": ...}, ...] → 같은 곡의 다른 구간 쇼츠를 예약 업로드."""
    from .music_cover import video
    from .music_lyrics import subtitles
    done = 0
    for fid, ov in cfg.get("releases", {}).items():
        plan = ov.get("extra_shorts") or []
        ent = log.get(fid)
        if not plan or not ent or not ent.get("video_id"):
            continue
        have = ent.setdefault("extras", [])
        done_k = {e.get("k", i) for i, e in enumerate(have)}
        todo = [(k, p) for k, p in enumerate(plan) if k not in done_k
                and now + dt.timedelta(minutes=30) < dt.datetime.fromisoformat(p["publish_at"])
                <= now + dt.timedelta(days=float(cfg.get("extras_ahead_days", 4.5)))]  # 하루 업로드 한도 때문에 가까운 것만
        if not todo:
            continue
        audio = download(dtoken, fid, WORK / "in" / ent["name"])
        an = analyse(audio)
        base_len = float(cfg.get("short_length", 40))
        main_start = float(ov["short_start"]) if ov.get("short_start") is not None else \
            best_window(an["rms"], an["fps"], base_len, an["duration"])
        used = [main_start] + [e["start"] for e in have]
        picks = []
        for k, p in todo:
            ln = float(p.get("length", base_len))
            got = extra_windows(an["rms"], an["fps"], ln, an["duration"], used, 1, float(p.get("gap", ln)))
            if got:
                got = [snap_chorus(an["rms"], an["fps"], got[0], ln, an["duration"])]
                used.append(got[0])
                picks.append((k, p, got[0], ln))
        tags = tags_of(audio)
        lyr = lyrics_of(tags)
        title = ent["title"]
        cov = ROOT / ov["cover"] if ov.get("cover") else None
        if not cov or not cov.exists():
            continue
        channel = cfg.get("channel", "BEEKAY SONGS")
        for k, p, st, length in picks:
            subs = subtitles(audio, lyr, st, length) if cfg.get("short_lyrics", True) else []
            stem = re.sub(r"[^0-9A-Za-z가-힣]+", "-", title).strip("-")[:40]
            out = video(audio, cov, title, channel, ent.get("tag", ""), WORK / f"{stem}-extra{k + 1}.mp4", vertical=True,
                        start=st, length=length, cta="전체 듣기는 채널에서 ▶", subs=subs)
            line = first_line(subs)
            yt_title = (f"“{line}” | {title} 🎧 #shorts" if line else f"{title} 🎧 Part {k + 2} #shorts")[:100]
            mm = f"{int(st) // 60}:{int(st) % 60:02d}"
            if not enabled:
                summary(f"[만들기만] 추가 쇼츠 {title} {mm}부터, 자막 {len(subs)}줄")
                continue
            from .youtube import upload
            token = music_token(cfg)
            desc = (f"{full_link(ent['video_id'])}\n\n{title} — {channel}\n\n{AI_NOTE}\n\n"
                    "#KPOP #AImusic #Suno #신곡 #shorts")
            at = dt.datetime.fromisoformat(p["publish_at"])
            r = upload(token, video_body(yt_title, desc, at, short=True), pathlib.Path(out["video"]))
            have.append({"k": k, "short_id": r["id"], "start": st, "length": length, "publish_at": at.isoformat(), "subs": len(subs)})
            LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
            summary(f"추가 쇼츠 예약: {yt_title} → {at.isoformat()[:16]} ({mm}부터 {int(length)}초, 자막 {len(subs)}줄)\n"
                    f"https://studio.youtube.com/video/{r['id']}/edit")
            notify(f"🎧 BEEKAY SONGS 추가 쇼츠 예약: {yt_title} ({at.isoformat()[:16]})\nhttps://youtu.be/{r['id']}"
                   + related(log, fid, title, ent.get("video_id")))
            done += 1
    return done


def raw_words(audio: pathlib.Path, model: str = "medium") -> list:
    """받아쓰기 원본: [[구간 시작, 끝, 글, [[단어 시작, 끝, 단어], ...]], ...] (medium 모델, 단어 시간 포함)."""
    try:
        import numpy as np
        from faster_whisper import WhisperModel
        pcm = np.frombuffer(subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(audio), "-f", "f32le", "-ac", "1",
                                            "-ar", "16000", "-"], check=True, capture_output=True).stdout, dtype=np.float32)
        segs, _ = WhisperModel(model, device="cpu", compute_type="int8").transcribe(
            pcm, language="ko", vad_filter=False, beam_size=5, condition_on_previous_text=False, word_timestamps=True)
        return [[round(g.start, 2), round(g.end, 2), g.text.strip(),
                 [[round(w.start, 2), round(w.end, 2), w.word.strip()] for w in (g.words or [])]] for g in segs]
    except Exception as e:  # noqa: BLE001
        print("단어 시간 받아쓰기 실패:", e)
        return []


def lyrics_dump(fid: str) -> int:
    """뮤직비디오용 (BK 11/23): 곡 전체 가사 자막 시간을 로그에 JSON 으로 찍는다. 업로드·기록 없음."""
    from .youtube import access_token
    from .music_lyrics import align, fill_gaps, lyric_lines, transcribe
    dtoken = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"],
                          os.environ["MUSIC_DRIVE_REFRESH_TOKEN"])
    audio = download(dtoken, fid, WORK / "in" / f"{fid}.mp3")
    lyr = lyrics_of(tags_of(audio))
    dur = analyse(audio)["duration"]
    subs = fill_gaps(align(transcribe(audio, 0, dur), lyric_lines(lyr)), lyric_lines(lyr))
    print("LYRICS_JSON_BEGIN")
    print(json.dumps({"duration": dur, "lines": lyric_lines(lyr),
                      "subs": [(round(a, 2), round(b, 2), t) for a, b, t in subs]}, ensure_ascii=False))
    print("LYRICS_JSON_END")
    words = raw_words(audio)  # 손으로 맞출 때 쓰는 단어별 시간 (BK 11/25 '랩 부분 가사가 없어')
    print("WORDS_JSON_BEGIN")
    print(json.dumps(words, ensure_ascii=False))
    print("WORDS_JSON_END")
    return 0


def safe_name(title: str) -> str:
    """드라이브 백업에서 알아보기 쉬운 파일 이름 (예: '다른 차원 끝 (Male ver. Official MV)')."""
    return re.sub(r'[\\/:*?"<>|]+', "", title).strip()[:90] or "mv"


def mv_run(fid: str, now: dt.datetime | None = None, render_only: bool = False) -> int:
    """뮤직비디오 1편 (BK 11/23 '1번': 기존 풀 버전은 두고 'Official MV' 로 따로). config releases[fid].mv
    render_only: 올리지 않고 만들기만 (BK 11/25 '뮤비도 백업' → 이미 올린 뮤비를 다시 만들어 드라이브 백업)."""
    from .youtube import access_token, upload
    from .music_lyrics import align, fill_gaps, lyric_lines, transcribe
    from .music_mv import render
    now = now or dt.datetime.now(KST)
    cfg = load(CFG, {})
    rel = cfg.get("releases", {}).get(fid, {})
    mv = rel.get("mv") or {}
    key = f"mv:{fid}"
    log = load(LOG, {})
    if not mv:
        summary(f"뮤비 설정 없음: releases[{fid}].mv")
        return 1
    if log.get(key) and not render_only:
        summary(f"뮤비 이미 올림: https://youtu.be/{log[key]['video_id']}")
        return 0
    dtoken = access_token(os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"], os.environ["MUSIC_DRIVE_REFRESH_TOKEN"])
    audio = download(dtoken, fid, WORK / "in" / f"{fid}.mp3")
    lyr = lyrics_of(tags_of(audio))
    dur = analyse(audio)["duration"]
    if mv.get("subs"):  # 손으로 다듬은 가사 타이밍 [[시작, 끝, 줄], ...] (받아쓰기가 첫 소절·빠른 구간을 놓칠 때)
        subs = [(float(a), float(b), str(t)) for a, b, t in mv["subs"]]
    else:
        subs = fill_gaps(align(transcribe(audio, 0, dur), lyric_lines(lyr)), lyric_lines(lyr)) if lyr else []
    title = mv.get("title") or f"{rel.get('title', 'BEEKAY SONGS')} (Official MV)"
    song = mv.get("song", title.split(" (")[0])
    channel = cfg.get("channel", "BEEKAY SONGS")
    out = render(audio, [pathlib.Path(p) for p in mv["images"]], subs, song, channel,
                 WORK / "mv" / f"{safe_name(title)}.mp4", dur,
                 shots=[(k, tuple(a), tuple(b)) for k, a, b in mv["shots"]] if mv.get("shots") else None)
    full = log.get(fid, {}).get("video_id")
    extra = f"🎧 가사 영상(풀 버전): https://youtu.be/{full}" if full else ""
    desc = description(title, lyr, channel, extra=extra)
    at = dt.datetime.fromisoformat(mv["publish_at"]) if mv.get("publish_at") else None
    if at and at <= now + dt.timedelta(minutes=30):
        at = None  # 지난 시각이면 비공개로 올려 두고 BK 가 공개
    summary(f"뮤비 완성: {out} ({dur:.0f}초, 가사 {len(subs)}줄)")
    if render_only:
        return 0
    if os.environ.get("MUSIC_YT_ENABLED", "").lower() != "true":
        summary("MUSIC_YT_ENABLED 아님 → 업로드 안 함")
        return 0
    token = music_token({"channel": channel})
    r = upload(token, video_body(f"{title} | {channel}", desc, at), out)
    from .yt_extras import set_thumbnail, wide_from_square  # 뮤비 맞춤 썸네일 = 첫 장면 그림 (BK 11/23)
    imgs = mv.get("images") or []
    if imgs and not set_thumbnail(token, r["id"], wide_from_square(imgs[0], WORK / "mv" / f"{fid}.thumb.jpg")):
        summary("뮤비 썸네일 설정 실패: 스튜디오에서 손으로")
    log[key] = {"video_id": r["id"], "title": title, "publish_at": at.isoformat() if at else "private",
                "date": now.strftime("%Y-%m-%d")}
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1))
    summary(f"뮤비 업로드: https://youtu.be/{r['id']} 공개 {log[key]['publish_at']}")
    notify(f"🎬 BEEKAY SONGS 뮤비 업로드: {title}\nhttps://youtu.be/{r['id']}\n공개: {log[key]['publish_at']}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["run", "lyrics", "mv"])
    ap.add_argument("--local")
    ap.add_argument("--fid", default="", help="mv 는 쉼표로 여러 개")
    ap.add_argument("--render-only", action="store_true", help="mv: 올리지 않고 만들기만 (백업용)")
    a = ap.parse_args(argv)
    if a.cmd == "lyrics":
        return lyrics_dump(a.fid)
    if a.cmd == "mv":
        fids = [f.strip() for f in a.fid.split(",") if f.strip()]
        return max([mv_run(f, render_only=a.render_only) for f in fids] or [1])
    return run(a.local)


if __name__ == "__main__":
    sys.exit(main())
