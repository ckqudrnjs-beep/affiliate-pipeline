import datetime as dt
import unittest

from pipeline import raksil_range as rr
from pipeline import raksil_shorts as rs


class RaksilRangeTest(unittest.TestCase):
    def test_game_days(self):
        self.assertTrue(rr.is_game_day(dt.date(2026, 11, 16)))  # 월
        self.assertTrue(rr.is_game_day(dt.date(2026, 11, 19)))  # 목
        self.assertFalse(rr.is_game_day(dt.date(2026, 11, 17)))

    def test_stage_range(self):
        for i in range(60):
            s = rr.stage_for(dt.date(2026, 11, 1) + dt.timedelta(days=i))
            self.assertTrue(5 <= s <= 10)
        self.assertNotEqual(rr.stage_for(dt.date(2026, 11, 16)), rr.stage_for(dt.date(2026, 11, 19)))

    def test_heads_and_score(self):
        ev = [{"t": 1.0, "k": "fire", "head": True}, {"t": 1.0, "k": "hit", "d": 500},
              {"t": 2.0, "k": "fire", "head": False}, {"t": 2.1, "k": "hit", "d": 100}]
        self.assertEqual(rr.heads(ev), [1.0])
        self.assertEqual(rr.score_at(ev, 1.5), 500)
        self.assertEqual(rr.score_at(ev, 3), 600)

    def test_texts_and_schedule(self):
        self.assertLessEqual(len(rr.title_of(10)), 100)
        d = rr.description_of(7, 12345, 3, True)
        self.assertIn("https://5raksil.com/games/range", d)
        self.assertNotIn("광고", d)
        meta = {"date": "2026-11-16", "hour": rr.HOUR, "schedule": True, "title": "t", "description": "d", "tags": rr.TAGS}
        at = rs.publish_time(meta, dt.datetime(2026, 11, 16, 16, 30, tzinfo=rs.KST))
        self.assertEqual(at.hour, 20)
        self.assertEqual(rs.video_body(meta, at)["snippet"]["tags"], rr.TAGS)


if __name__ == "__main__":
    unittest.main()
