import datetime as dt
import json
import pathlib
import tempfile
import unittest

from pipeline import shorts_lock, yt_analytics


class ShortsLockTest(unittest.TestCase):
    def test_window(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "lock.json"
            p.write_text(json.dumps({"uncle": {"from": "2026-11-23", "until": "2026-12-13"}}), encoding="utf-8")
            self.assertFalse(shorts_lock.locked("uncle", dt.date(2026, 11, 22), p))
            self.assertTrue(shorts_lock.locked("uncle", "2026-11-28", p))
            self.assertTrue(shorts_lock.locked("uncle", dt.date(2026, 12, 13), p))
            self.assertFalse(shorts_lock.locked("uncle", dt.date(2026, 12, 14), p))
            self.assertFalse(shorts_lock.locked("5raksil", dt.date(2026, 11, 28), p))
            self.assertFalse(shorts_lock.locked("uncle", dt.date(2026, 11, 28), pathlib.Path(d) / "none.json"))

    def test_repo_config(self):
        self.assertTrue(shorts_lock.locked("5raksil", dt.date(2026, 11, 29)))
        self.assertTrue(shorts_lock.locked("uncle", dt.date(2026, 11, 28)))

    def test_game_and_meme_pause(self):
        from pipeline import raksil_games, raksil_meme
        self.assertEqual(raksil_games.plan(dt.date(2026, 11, 24), [], {}, hold=True), ("none", None, None))
        self.assertIsNone(raksil_meme.plan(dt.date(2026, 11, 25), {}))  # 화요일, 고정 기간
        self.assertIsNone(raksil_meme.plan(dt.date(2026, 11, 29), {}))  # 토요일, 고정 기간

    def test_audience_rows(self):
        js = {"rows": [["age25-34", "female", 41.26], ["age35-44", "male", 8.0]]}
        self.assertEqual(yt_analytics.audience_rows(js), {"female age25-34": 41.3, "male age35-44": 8.0})
        self.assertEqual(yt_analytics.audience_rows({}), {})



class LegacyEndTest(unittest.TestCase):
    def test_new_format_only_in_lock(self):
        from pipeline import raksil_shorts_legacy as L
        for d in (23, 25, 27, 29):
            self.assertEqual(L.pick(dt.date(2026, 11, d)), "new")  # 11/22 BK '새 형식으로 고정' → 옛 형식 날 없음
        self.assertEqual(L.pick(dt.date(2026, 11, 23), "legacy"), "legacy")  # 손 스위치는 그대로

if __name__ == "__main__":
    unittest.main()
