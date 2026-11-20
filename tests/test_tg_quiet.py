"""BK 개인 텔레그램 알림 밤 시간(23~07 KST) 규칙 (2026-11-21)."""
import datetime as dt
import pathlib
import re
import unittest

from pipeline.api_check import quiet_now

UTC = dt.timezone.utc
ROOT = pathlib.Path(__file__).resolve().parents[1]
ADMIN_WORKFLOWS = ["yt-early", "cf-usage", "api-check", "claude-jobs", "consistency", "scoreboard", "health", "raksil-shorts"]


def kst_hours(cron: str) -> list[int]:
    hour = cron.split()[1]
    out = []
    for part in hour.split(","):
        if "-" in part:
            a, b = map(int, part.split("-"))
            out += list(range(a, b + 1))
        else:
            out.append(int(part))
    return [(h + 9) % 24 for h in out]


class QuietTest(unittest.TestCase):
    def test_quiet_window(self):
        self.assertTrue(quiet_now(dt.datetime(2026, 11, 20, 14, 0, tzinfo=UTC)))   # 23:00 KST
        self.assertTrue(quiet_now(dt.datetime(2026, 11, 20, 21, 59, tzinfo=UTC)))  # 06:59 KST
        self.assertFalse(quiet_now(dt.datetime(2026, 11, 20, 22, 0, tzinfo=UTC)))  # 07:00 KST
        self.assertFalse(quiet_now(dt.datetime(2026, 11, 20, 13, 59, tzinfo=UTC)))  # 22:59 KST

    def test_admin_crons_avoid_night(self):
        for name in ADMIN_WORKFLOWS:
            text = (ROOT / f".github/workflows/{name}.yml").read_text(encoding="utf-8")
            for cron in re.findall(r'cron:\s*"([^"]+)"', text):
                for h in kst_hours(cron):
                    self.assertFalse(h >= 23 or h < 7, f"{name} '{cron}' → {h}시 KST (밤 알림 금지)")


if __name__ == "__main__":
    unittest.main()
