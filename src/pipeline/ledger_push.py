"""Claude API 사용 장부(data/api_usage/*.json)를 main 에 안전하게 올린다 (2026-11-23).

여러 claude-jobs 실행이 같은 장부 파일 끝에 줄을 붙이면 `git pull --rebase` 가 충돌로 멈춰
작업은 성공했는데 실행이 '실패'로 끝나고 사용 금액이 장부에서 빠졌다 (11/23 toon, 약 2달러).
여기서는 이번 실행이 새로 붙인 줄만 골라, 최신 main 의 장부 뒤에 다시 붙여 올린다.

사용: python -m pipeline.ledger_push "<커밋 메시지>"
"""
from __future__ import annotations

import json
import subprocess
import sys
import time

LEDGER_DIR = "data/api_usage"


def git(*args: str, check: bool = True) -> str:
    return subprocess.run(["git", *args], check=check, capture_output=True, text=True).stdout


def new_rows(base: list[dict], mine: list[dict]) -> list[dict]:
    """이번 실행이 base 뒤에 붙인 줄. 앞부분이 같으면 꼬리만, 아니면 base 에 없는 줄."""
    if mine[: len(base)] == base:
        return mine[len(base):]
    left = list(base)
    out = []
    for r in mine:
        if r in left:
            left.remove(r)
        else:
            out.append(r)
    return out


def merge(remote: list[dict], added: list[dict]) -> list[dict]:
    return remote + added


def dump(rows: list[dict]) -> str:
    return json.dumps(rows, ensure_ascii=False, indent=1) + "\n"


def changed_files() -> list[str]:
    out = git("status", "--porcelain", "-uall", "--", LEDGER_DIR)
    return [line[3:].strip().strip('"') for line in out.splitlines() if line.strip().endswith(".json")]


def read_rev(rev: str, path: str) -> list[dict]:
    r = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else []


def main(argv: list[str]) -> int:
    msg = argv[0] if argv else "API 사용 장부"
    files = changed_files()
    if not files:
        print("장부 변경 없음")
        return 0
    pending: dict[str, list[dict]] = {}
    for f in files:
        with open(f, encoding="utf-8") as fh:
            mine = json.load(fh)
        rows = new_rows(read_rev("HEAD", f), mine)
        if rows:
            pending[f] = rows
    if not pending:
        print("새 장부 줄 없음")
        return 0
    for attempt in range(5):
        git("fetch", "-q", "origin", "main")
        git("checkout", "-q", "-f", "-B", "main", "origin/main")  # 로컬 장부는 버린다(새 줄은 pending 에 있음)
        for f, rows in pending.items():
            with open(f, "w", encoding="utf-8") as fh:
                fh.write(dump(merge(read_rev("HEAD", f), rows)))
            git("add", f)
        git("commit", "-q", "-m", msg)
        if subprocess.run(["git", "push", "-q", "origin", "HEAD:main"]).returncode == 0:
            print(f"장부 {sum(map(len, pending.values()))}줄 저장 ({attempt + 1}번째 시도)")
            return 0
        time.sleep(5 * (attempt + 1))
    print("장부 저장 실패 (5번 시도)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
