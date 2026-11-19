"""만든 영상·이미지를 BK 구글 드라이브에 자동 백업 (2026-11-19).

무엇을: 저장소에 한 번이라도 커밋된 결과물(쇼츠 mp4, AI 클립, 인스타 이미지, 포스터, OG 이미지, 웹툰 컷)
        + 5락실 쇼츠 릴리스(최근 14개만 남는 곳)에 있는 mp4.
        지금은 지워졌어도 git 기록에 남은 파일까지 찾아 올린다.
어디로: 드라이브 "자동 백업 (돈삼촌·5락실)" / <종류> / <YYYY-MM> / <YYYY-MM-DD>_<파일이름>
        폴더는 앱이 처음 실행 때 내 드라이브에 만든다. BK가 원하는 폴더로 옮겨도 계속 찾는다.
중복: 올린 파일마다 appProperties.key(= git blob 해시 또는 릴리스 파일 이름+크기)를 붙이고,
      다음 실행에서 이미 있는 key 는 건너뛴다. 그래서 매일 돌려도 새 파일만 올라간다.
권한: drive.file (이 앱이 만든 파일만 보고 쓸 수 있음. BK의 다른 드라이브 파일은 못 봄).
인증: 유튜브 업로드와 같은 OAuth 앱(YT_CLIENT_ID / YT_CLIENT_SECRET) + DRIVE_REFRESH_TOKEN.
      발급: docs/DRIVE_BACKUP.md. 토큰이 없으면 무엇을 올릴지만 보여 주고 끝난다.
    python -m pipeline.drive_backup [--extra DIR:종류 ...] [--max-files N] [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

from .youtube import KST, access_token

ROOT_NAME = "자동 백업 (돈삼촌·5락실)"
FOLDER_MIME = "application/vnd.google-apps.folder"
API = "https://www.googleapis.com/drive/v3"
UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
MEDIA_EXT = {".mp4", ".mov", ".webm", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp3", ".wav", ".m4a"}

# (경로 앞부분, 드라이브 종류 폴더). 위에서부터 먼저 맞는 것.
CATEGORIES = [
    ("media/youtube/", "쇼츠-돈삼촌"),
    ("media/ai_clips/", "AI클립"),
    ("media/uncle/", "삼촌-캐릭터영상"),
    ("media/raksil/", "쇼츠-5락실"),
    ("static/ig/", "인스타"),
    ("docs/insta/", "인스타"),
    ("static/video/", "사이트-영상"),
    ("static/og/", "사이트-이미지"),
    ("playground/static/og/", "5락실-포스터"),
    ("playground/static/img/", "5락실-포스터"),
    ("config/webtoon/", "웹툰"),
    ("drafts/shorts/", "쇼츠-초안"),
]


def category(path: str) -> str | None:
    if pathlib.PurePosixPath(path).suffix.lower() not in MEDIA_EXT:
        return None
    for prefix, cat in CATEGORIES:
        if path.startswith(prefix):
            return cat
    return None


# ── 백업할 것 찾기 ─────────────────────────────────────────────

def git_items(repo: str = ".") -> list[dict]:
    """git 기록 전체에서 결과물 파일 버전을 찾는다 (지워진 파일 포함). 같은 내용(blob)은 한 번만."""
    out = subprocess.run(
        ["git", "-C", repo, "log", "--all", "--reverse", "--diff-filter=AM", "--no-renames",
         "--format=@%H %cI", "--raw", "--no-abbrev", "--", *[p for p, _ in CATEGORIES]],
        capture_output=True, text=True, encoding="utf-8", check=True).stdout
    return parse_git_raw(out)


def parse_git_raw(out: str) -> list[dict]:
    items, seen, date = [], set(), ""
    for line in out.splitlines():
        if line.startswith("@"):
            date = line.split()[1][:10]
        elif line.startswith(":"):
            meta, path = line.split("\t", 1)
            blob = meta.split()[3]
            cat = category(path)
            if not cat or blob in seen or set(blob) == {"0"}:
                continue
            seen.add(blob)
            items.append({"key": "git:" + blob, "blob": blob, "path": path, "cat": cat, "date": date,
                          "name": pathlib.PurePosixPath(path).name})
    return items


def dir_items(folder: str, cat: str) -> list[dict]:
    """로컬 폴더(예: 내려받은 5락실 쇼츠 릴리스)의 결과물. key = 이름+크기."""
    items = []
    for f in sorted(pathlib.Path(folder).glob("*")):
        if not f.is_file() or f.suffix.lower() not in MEDIA_EXT:
            continue
        name = f.name
        date = name[:10] if len(name) >= 10 and name[4] == "-" and name[7] == "-" else \
            dt.datetime.fromtimestamp(f.stat().st_mtime, KST).strftime("%Y-%m-%d")
        items.append({"key": f"file:{cat}:{name}:{f.stat().st_size}", "file": str(f), "path": name,
                      "cat": cat, "date": date, "name": name})
    return items


def drive_name(item: dict) -> str:
    n = item["name"]
    return n if n.startswith(item["date"]) else f"{item['date']}_{n}"


def read_bytes(item: dict, repo: str = ".") -> bytes:
    if "file" in item:
        return pathlib.Path(item["file"]).read_bytes()
    return subprocess.run(["git", "-C", repo, "cat-file", "blob", item["blob"]],
                          capture_output=True, check=True).stdout


# ── 드라이브 ───────────────────────────────────────────────────

class Drive:
    def __init__(self, token: str):
        self.token = token
        self.folders: dict[tuple[str, str], str] = {}

    def _req(self, method: str, url: str, body: bytes | None = None, ctype: str = "application/json",
             extra: dict | None = None):
        h = {"Authorization": f"Bearer {self.token}"}
        if body is not None:
            h["Content-Type"] = ctype
        h.update(extra or {})
        req = urllib.request.Request(url, data=body, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.headers, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"[드라이브] {e.code} {e.read()[:300].decode('utf-8', 'replace')}") from None

    def query(self, q: str, fields: str = "id,name,appProperties") -> list[dict]:
        res, token = [], None
        while True:
            p = {"q": q, "fields": f"nextPageToken,files({fields})", "pageSize": 1000, "spaces": "drive"}
            if token:
                p["pageToken"] = token
            _, j = self._req("GET", f"{API}/files?" + urllib.parse.urlencode(p))
            res += j.get("files", [])
            token = j.get("nextPageToken")
            if not token:
                return res

    def create_folder(self, name: str, parent: str | None, props: dict | None = None) -> str:
        meta = {"name": name, "mimeType": FOLDER_MIME}
        if parent:
            meta["parents"] = [parent]
        if props:
            meta["appProperties"] = props
        _, j = self._req("POST", f"{API}/files?fields=id", json.dumps(meta).encode())
        return j["id"]

    def root(self) -> str:
        found = self.query("appProperties has { key='role' and value='backup-root' } and trashed=false")
        return found[0]["id"] if found else self.create_folder(ROOT_NAME, None, {"role": "backup-root"})

    def folder(self, name: str, parent: str) -> str:
        k = (parent, name)
        if k not in self.folders:
            safe = name.replace("'", "\\'")
            found = self.query(f"name='{safe}' and '{parent}' in parents and mimeType='{FOLDER_MIME}' and trashed=false")
            self.folders[k] = found[0]["id"] if found else self.create_folder(name, parent)
        return self.folders[k]

    def done_keys(self) -> set[str]:
        files = self.query(f"mimeType!='{FOLDER_MIME}' and trashed=false")
        return {f["appProperties"]["key"] for f in files if (f.get("appProperties") or {}).get("key")}

    def upload(self, name: str, parent: str, data: bytes, key: str, src: str) -> str:
        meta = {"name": name, "parents": [parent], "appProperties": {"key": key[:120], "src": src[-100:]}}
        h, _ = self._req("POST", f"{UPLOAD}?uploadType=resumable&fields=id", json.dumps(meta).encode(),
                         "application/json; charset=UTF-8", {"X-Upload-Content-Length": str(len(data))})
        _, j = self._req("PUT", h["Location"], data, "application/octet-stream")
        return j.get("id", "")


# ── 실행 ──────────────────────────────────────────────────────

def plan(items: list[dict], done: set[str], max_files: int, max_bytes: int, size_of) -> list[dict]:
    todo, total = [], 0
    for it in items:
        if it["key"] in done:
            continue
        sz = size_of(it)
        if todo and (len(todo) >= max_files or total + sz > max_bytes):
            break
        todo.append(it)
        total += sz
    return todo


def git_size(item: dict, repo: str = ".") -> int:
    if "file" in item:
        return pathlib.Path(item["file"]).stat().st_size
    return int(subprocess.run(["git", "-C", repo, "cat-file", "-s", item["blob"]],
                              capture_output=True, text=True, check=True).stdout.strip())


def summary(lines: list[str]) -> None:
    out = os.environ.get("GITHUB_STEP_SUMMARY")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extra", action="append", default=[], help="로컬폴더:종류 (예: rel:쇼츠-5락실)")
    ap.add_argument("--max-files", type=int, default=400)
    ap.add_argument("--max-mb", type=int, default=3000)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)

    items = git_items()
    for spec in a.extra:
        folder, cat = spec.rsplit(":", 1)
        if pathlib.Path(folder).is_dir():
            items += dir_items(folder, cat)
    by_cat: dict[str, int] = {}
    for it in items:
        by_cat[it["cat"]] = by_cat.get(it["cat"], 0) + 1
    print("찾은 결과물:", ", ".join(f"{k} {v}개" for k, v in sorted(by_cat.items())))

    cid, sec, rt = (os.environ.get(k, "") for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "DRIVE_REFRESH_TOKEN"))
    if a.dry_run or not (cid and sec and rt):
        print("DRIVE_REFRESH_TOKEN 이 없어 올리지 않음 (설정: docs/DRIVE_BACKUP.md)" if not a.dry_run else "dry-run")
        summary(["### 드라이브 백업: 아직 꺼짐", f"찾은 결과물 {len(items)}개. 설정: docs/DRIVE_BACKUP.md"])
        return 0

    drive = Drive(access_token(cid, sec, rt))
    root = drive.root()
    done = drive.done_keys()
    todo = plan(items, done, a.max_files, a.max_mb * 1024 * 1024, git_size)
    print(f"이미 백업 {len(done)}개, 이번에 올릴 것 {len(todo)}개")
    ok, fail = 0, []
    for it in todo:
        try:
            parent = drive.folder(it["date"][:7], drive.folder(it["cat"], root))
            drive.upload(drive_name(it), parent, read_bytes(it), it["key"], it["path"])
            ok += 1
            print(f"  올림 {it['cat']}/{it['date'][:7]}/{drive_name(it)}")
        except Exception as e:  # noqa: BLE001 한 파일 실패로 전체를 멈추지 않는다
            fail.append(f"{it['path']}: {e}")
            print(f"  실패 {it['path']}: {e}", file=sys.stderr)
    left = sum(1 for it in items if it["key"] not in done) - ok
    summary([f"### 드라이브 백업 {dt.datetime.now(KST):%Y-%m-%d %H:%M} KST",
             f"- 새로 올림 {ok}개 · 실패 {len(fail)}개 · 남은 것 {max(left, 0)}개 (다음 실행에 이어서)",
             f"- 드라이브 폴더: https://drive.google.com/drive/folders/{root}"] + [f"- 실패: {x}" for x in fail[:10]])
    return 1 if fail and not ok else 0


if __name__ == "__main__":
    sys.exit(main())
