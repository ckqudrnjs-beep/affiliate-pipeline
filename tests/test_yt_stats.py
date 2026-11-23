import unittest

from pipeline import yt_analytics, yt_stats, youtube as yt


class StatsTest(unittest.TestCase):
    def test_tags_three_max(self):
        self.assertEqual(yt.tags({"format": "quiz", "kind": "short"}).count("#"), 3)

    def test_analytics_rows(self):
        js = {"columnHeaders": [{"name": n} for n in ["video", "views", "averageViewPercentage", "averageViewDuration",
                                                       "shares", "likes", "subscribersGained"]],
              "rows": [["abc", 120, 63.456, 9, 3, 5, 1]]}
        self.assertEqual(yt_analytics.rows_to_dict(js)["abc"],
                         {"views": 120, "avg_pct": 63.5, "avg_sec": 9, "shares": 3, "likes": 5, "subs": 1})
        self.assertEqual(yt_analytics.rows_to_dict({"columnHeaders": [], "rows": None}), {})

    def test_analytics_skips_without_token(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(yt_analytics.fetch(), 0)

    def test_module_entry(self):
        self.assertTrue(callable(yt_stats.weekly))


class FourChannelTest(unittest.TestCase):
    def test_video_ids_cover_four_channels(self):
        ids = yt_stats.video_ids()
        chans = {yt_stats.channel_of(s) for s in ids.values()}
        self.assertTrue({"uncle", "5raksil", "webnovel", "music"} <= chans, chans)
        self.assertNotIn("QPHArJ5Vr54", ids)  # _old (BK가 지운 영상)은 빼기

    def test_channel_of_and_early_kind(self):
        from pipeline import yt_early
        self.assertEqual(yt_stats.channel_of("webnovel-husband-regress/01"), "webnovel")
        self.assertEqual(yt_stats.channel_of("music-short-다른 차원 끝"), "music")
        self.assertEqual(yt_stats.channel_of("ep-2026-11-20-skit"), "uncle")
        self.assertEqual(yt_early.kind_of("webnovel-x"), "웹소설")
        self.assertEqual(yt_early.kind_of("music-x"), "음악")
        self.assertEqual(yt_early.kind_of("ep-2026-11-20-x"), "삼촌")

    def test_channels_without_key(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(yt_stats.fetch_channels({"UCx": "uncle"}), {})
