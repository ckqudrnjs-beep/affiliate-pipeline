import datetime as dt
import unittest
from unittest import mock

from pipeline import community_posts as c

KST = c.KST
NOW = dt.datetime(2026, 11, 23, 10, 0, tzinfo=KST)


class CommunityPostsTest(unittest.TestCase):
    def test_when_ko(self):
        self.assertEqual(c.when_ko(dt.datetime(2026, 11, 23, 17, tzinfo=KST), NOW), "오늘 오후 5시")
        self.assertEqual(c.when_ko(dt.datetime(2026, 11, 24, 19, tzinfo=KST), NOW), "내일 저녁 7시")
        self.assertEqual(c.when_ko(dt.datetime(2026, 11, 25, 21, tzinfo=KST), NOW), "11/25(수) 밤 9시")

    def test_texts_safe_and_no_money(self):
        from pipeline.youtube import money_hits
        u = c.uncle_text("보일러 켜자마자 동전이가 숨은 곳", dt.datetime(2026, 11, 24, 19, tzinfo=KST), NOW)
        self.assertEqual(money_hits(u), []); self.assertTrue(c.safe(u)); self.assertIn("구독하면", u)
        r = c.raksil_text("겨울 내내 집", "여름 내내 밖", dt.datetime(2026, 11, 23, 17, tzinfo=KST), True, NOW)
        self.assertIn("A. 겨울 내내 집", r); self.assertIn("댓글로 A나 B", r); self.assertNotIn("투표", r); self.assertTrue(c.safe(r))
        s = c.raksil_text("괜찮다고 웃고 나오기", "다시 해 달라고 하기", dt.datetime(2026, 11, 23, 17, tzinfo=KST), True, NOW,
                          situation="미용실에서 머리를 잘랐는데 마음에 안 들어요")  # 11/25 상황 먼저
        self.assertLess(s.index("마음에 안 들어요. 너라면?"), s.index("A. 괜찮다고"))
        m = c.music_text("노래", dt.datetime(2026, 11, 25, 19, tzinfo=KST), "어느 쪽?", NOW)
        self.assertIn("어느 쪽?", m); self.assertTrue(c.safe(m))
        self.assertFalse(c.safe("구독하면 드려요"))

    def test_uncle_only_toon(self):
        at = dt.datetime(2026, 11, 24, 19, tzinfo=KST)
        with mock.patch.object(c, "send", return_value=True) as s, mock.patch.object(c, "frame_png", return_value=None):
            self.assertIsNone(c.uncle({"format": "prices", "ad": "0", "title": "x", "slug": "a"}, "v.mp4", at))
            self.assertIsNone(c.uncle({"format": "toon", "ad": "1", "title": "x", "slug": "a"}, "v.mp4", at))
            self.assertIsNone(c.uncle({"format": "toon", "ad": "0", "title": "한 그릇 차이 얼마?", "slug": "a"}, "v.mp4", at))
            self.assertTrue(c.uncle({"format": "toon", "ad": "0", "title": "보일러 편", "slug": "a"}, "v.mp4", at))
            self.assertEqual(s.call_count, 1)

    def test_raksil_skips_game(self):
        at = dt.datetime(2026, 11, 23, 17, tzinfo=KST)
        with mock.patch.object(c, "send", return_value=True), mock.patch.object(c, "frame_png", return_value=None):
            self.assertIsNone(c.raksil({"kind": "게임", "a": "x", "b": "y", "file": "f", "date": "2026-11-23"}, at))
            self.assertTrue(c.raksil({"a": "x", "b": "y", "file": "f", "date": "2026-11-23"}, at))

    def test_send_without_env_is_false(self):
        with mock.patch.dict(c.__dict__, {}), mock.patch("pipeline.api_check.env", return_value=""):
            self.assertFalse(c.send(None, "글"))


if __name__ == "__main__":
    unittest.main()
