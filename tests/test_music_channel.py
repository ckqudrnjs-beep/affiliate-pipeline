import datetime as dt
import importlib.util
import shutil
import unittest

from pipeline import music_channel as mc

NEED_RENDER = unittest.skipUnless(importlib.util.find_spec("numpy") and importlib.util.find_spec("PIL") and shutil.which("ffmpeg"),
                                  "numpy/PIL/ffmpeg 없음")


class MusicChannelTest(unittest.TestCase):
    def test_clean_lyrics_drops_section_marks(self):
        out = mc.clean_lyrics("[Intro]\n하나\n[Verse 1]\n둘\n셋\n[Chorus]\n넷")
        self.assertNotIn("[", out)
        self.assertEqual(out, "하나\n\n둘\n셋\n\n넷")

    def test_banned_real_artist(self):
        self.assertEqual(mc.banned_hit("BTS 스타일 신곡"), "bts")
        self.assertEqual(mc.banned_hit("뉴진스 느낌"), "뉴진스")
        self.assertIsNone(mc.banned_hit("다른 차원 끝"))
        self.assertIsNone(mc.banned_hit("I've been dreaming"))  # 'ive' 오탐 없음

    def test_genre_by_tempo(self):
        self.assertTrue(mc.genre_tag(72).startswith("BALLAD"))
        self.assertTrue(mc.genre_tag(129).startswith("K-POP"))

    def test_description_has_ai_note_and_lyrics(self):
        d = mc.description("곡", "가사 한 줄", "BEEKAY SONGS")
        self.assertIn("Suno", d)
        self.assertIn("가사 한 줄", d)
        s = mc.description("곡", "가사 한 줄", "BEEKAY SONGS", short=True)
        self.assertIn("#shorts", s)
        self.assertNotIn("가사 한 줄", s)

    def test_body_private_and_synthetic(self):
        b = mc.video_body("t", "d", None)
        self.assertEqual(b["status"]["privacyStatus"], "private")
        self.assertNotIn("publishAt", b["status"])
        self.assertTrue(b["status"]["containsSyntheticMedia"])
        self.assertEqual(b["snippet"]["categoryId"], "10")

    def test_slots(self):
        now = dt.datetime(2026, 11, 24, 10, 13, tzinfo=mc.KST)
        self.assertEqual(mc.slots(now, {"visibility": "private"}), (None, None))
        a, b = mc.slots(now, {"visibility": "schedule", "publish_hour": 19, "short_delay_days": 1})
        self.assertEqual((a.day, a.hour, b.day), (24, 19, 25))
        late = dt.datetime(2026, 11, 24, 18, 0, tzinfo=mc.KST)
        self.assertEqual(mc.slots(late, {"visibility": "schedule"})[0].day, 25)

    def test_pending_pairs_cover_and_skips_logged(self):
        files = [{"id": "a", "name": "노래1.mp3"}, {"id": "b", "name": "노래1.jpg"}, {"id": "c", "name": "노래2.mp3"}]
        p = mc.pending(files, {"c": {}})
        self.assertEqual([x["id"] for x in p], ["a"])
        self.assertEqual(p[0]["cover"]["id"], "b")

    @NEED_RENDER
    def test_best_window(self):
        import numpy as np
        rms = np.ones(1000) * 0.1
        rms[600:700] = 1.0
        s = mc.best_window(rms, 10.0, 10.0, 100.0)
        self.assertTrue(55 <= s <= 61, s)


if __name__ == "__main__":
    unittest.main()
