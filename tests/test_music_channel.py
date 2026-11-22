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

    def test_version_suffix(self):
        self.assertEqual(mc.title_of({"title": "다른 차원 끝"}, "다른 차원 끝 남자 버전.mp3"), "다른 차원 끝 (Male ver.)")
        self.assertEqual(mc.title_of({"title": "다른 차원 끝"}, "다른차원끝_여성.mp3"), "다른 차원 끝 (Female ver.)")
        self.assertEqual(mc.title_of({"title": "곡"}, "곡.mp3"), "곡")

    @NEED_RENDER
    def test_best_window(self):
        import numpy as np
        rms = np.ones(1000) * 0.1
        rms[600:700] = 1.0
        s = mc.best_window(rms, 10.0, 10.0, 100.0)
        self.assertTrue(55 <= s <= 61, s)


class TestReleases(unittest.TestCase):
    def test_fixed_slots(self):
        import datetime as dt
        from pipeline.music_channel import fixed_slots, KST
        now = dt.datetime(2026, 11, 21, 23, 0, tzinfo=KST)
        a, b = fixed_slots({"publish_at": "2026-11-25T19:00:00+09:00"}, now)
        self.assertEqual((a.day, b.day), (25, 26))
        self.assertIsNone(fixed_slots({"publish_at": "2026-11-21T19:00:00+09:00"}, now))
        self.assertIsNone(fixed_slots({}, now))

    def test_extra_line(self):
        from pipeline.music_channel import description
        d = description("T", "", "C", extra="🎧 다른 버전: https://youtu.be/x\n어느 쪽이 더 좋아요?")
        self.assertIn("youtu.be/x", d.split("\n")[2])


class TestExtrasLyrics(unittest.TestCase):
    @NEED_RENDER
    def test_extra_windows_no_overlap(self):
        import numpy as np
        from pipeline.music_channel import extra_windows
        fps = 10.0
        rms = np.ones(2000) * 0.1
        rms[1100:1500] = 0.5
        rms[400:800] = 0.4
        got = extra_windows(rms, fps, 40, 200, [110.0], 2)
        self.assertEqual(len(got), 2)
        for t in got:
            self.assertGreaterEqual(abs(t - 110.0), 40)
        self.assertGreaterEqual(abs(got[0] - got[1]), 40)

    def test_align_uses_official_lines(self):
        from pipeline.music_lyrics import align, lyric_lines
        lines = lyric_lines("[Chorus]\nAcross the dream 너에게 닿을 때까지\n다른 차원 끝에서 (oh)\n")
        self.assertEqual(lines[1], "다른 차원 끝에서")
        subs = align([(0.0, 2.0, "어크로스 더 드림 너에게 닿을때까지"), (2.0, 4.0, "다른 차원 끝에서"),
                      (4.0, 5.0, "음")], lines)
        self.assertEqual([t for _, _, t in subs][-1], "다른 차원 끝에서")
        self.assertTrue(all(t in lines for _, _, t in subs))


if __name__ == "__main__":
    unittest.main()
