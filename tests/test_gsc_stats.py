import os
import unittest
from unittest import mock

from pipeline import gsc_stats


class GscTest(unittest.TestCase):
    def test_only_our_sites(self):
        self.assertTrue(gsc_stats.ours("sc-domain:don3chon.com"))
        self.assertTrue(gsc_stats.ours("https://www.5raksil.com/"))
        self.assertFalse(gsc_stats.ours("https://example.com/"))

    def test_skips_without_token(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(gsc_stats.main(), 0)

    def test_rows_and_table(self):
        rows = gsc_stats.summarize_rows([{"keys": ["퇴직금 계산"], "clicks": 3, "impressions": 120, "position": 8.44}])
        self.assertEqual(rows, [{"key": "퇴직금 계산", "clicks": 3, "impressions": 120, "position": 8.4}])
        snap = {"sc-domain:don3chon.com": {"clicks": 3, "impressions": 120, "position": 8.4, "top_query": rows,
                                           "top_page": [], "sitemaps": [{"path": "s", "last_read": "", "errors": 0,
                                                                         "submitted": 50, "indexed": 7}]}}
        md = gsc_stats.weekly_md("2026-11-17", snap, "2026-10-17", "2026-11-13")
        self.assertIn("| sc-domain:don3chon.com | 3 | 120 | 8.4 | 50 |", md)
        self.assertIn("(없음)", md)


if __name__ == "__main__":
    unittest.main()
