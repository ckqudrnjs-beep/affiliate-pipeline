import unittest

from pipeline import yt_stats, youtube as yt


class StatsTest(unittest.TestCase):
    def test_tags_three_max(self):
        self.assertEqual(yt.tags({"format": "quiz", "kind": "short"}).count("#"), 3)

    def test_module_entry(self):
        self.assertTrue(callable(yt_stats.weekly))
