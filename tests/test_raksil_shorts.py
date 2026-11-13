import datetime as dt
import unittest

from pipeline import raksil_shorts as r

QS = [{"id": "20261113-2", "date": "2026-11-13", "a": "x", "b": "y"},
      {"id": "20261113-1", "date": "2026-11-13", "a": "평생 라면만", "b": "평생 치킨만"},
      {"id": "20261112-1", "date": "2026-11-12", "a": "여름", "b": "겨울"}]


class RaksilShortsTest(unittest.TestCase):
    def test_pick_first_of_day(self):
        self.assertEqual(r.pick_question(QS, dt.date(2026, 11, 13))["id"], "20261113-1")
        self.assertIsNone(r.pick_question(QS, dt.date(2026, 1, 1)))

    def test_result_needs_min_votes(self):
        self.assertIsNone(r.result_of(QS[2], {"a": 5, "b": 3}))
        res = r.result_of(QS[2], {"a": 30, "b": 10})
        self.assertEqual((res["pa"], res["pb"], res["n"]), (75, 25, 40))

    def test_texts(self):
        q = QS[1]
        self.assertLessEqual(len(r.title_of(q)), 100)
        d = r.description_of(q, None, True)
        self.assertIn("https://5raksil.com/q/20261113-1", d)
        self.assertIn("AI 음성", d)
        self.assertNotIn("광고", d)
        long_q = {"id": "1", "a": "가" * 80, "b": "나" * 80}
        self.assertLessEqual(len(r.title_of(long_q)), 100)

    def test_body_public_not_kids(self):
        b = r.video_body({"title": "t", "description": "d", "voiced": True})
        self.assertEqual(b["status"]["privacyStatus"], "public")
        self.assertFalse(b["status"]["selfDeclaredMadeForKids"])
        self.assertTrue(b["status"]["containsSyntheticMedia"])


    def test_publish_at_17(self):
        m = {"date": "2026-11-14"}
        early = dt.datetime(2026, 11, 14, 16, 23, tzinfo=r.KST)
        at = r.publish_time(m, early)
        self.assertEqual((at.hour, at.minute), (17, 0))
        b = r.video_body({"title": "t", "description": "d"}, at)
        self.assertEqual(b["status"]["privacyStatus"], "private")
        self.assertEqual(b["status"]["publishAt"], "2026-11-14T08:00:00Z")
        self.assertIsNone(r.publish_time(m, dt.datetime(2026, 11, 14, 17, 5, tzinfo=r.KST)))


if __name__ == "__main__":
    unittest.main()
