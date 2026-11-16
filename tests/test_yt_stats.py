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
