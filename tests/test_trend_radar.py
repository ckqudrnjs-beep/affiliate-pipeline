import json
import pathlib
import unittest

from pipeline import trend_radar as tr


class TrendRadarTest(unittest.TestCase):
    def test_seconds(self):
        self.assertEqual(tr.seconds("PT1M5S"), 65)
        self.assertEqual(tr.seconds("PT45S"), 45)
        self.assertEqual(tr.seconds("PT1H"), 3600)
        self.assertEqual(tr.seconds(""), 0)

    def test_hook_type(self):
        self.assertEqual(tr.hook_type("3,000원 아끼는 법"), "숫자")
        self.assertEqual(tr.hook_type("밥솥 보온 전기 많이 먹을까?"), "질문")
        self.assertEqual(tr.hook_type("이거 절대 하지 마세요"), "반전·금지")
        self.assertEqual(tr.hook_type("마트 vs 시장"), "비교")
        self.assertEqual(tr.hook_type("오늘의 브이로그"), "기타")

    def test_render_has_links_and_no_pipe_breaks(self):
        v = {"id": "abc", "title": "무 | 값", "channel": "ch", "views": 12000, "per_day": 3000, "sec": 30,
             "published": "2026-11-15", "hook": "기타"}
        md = tr.render("2026-11-23", {"삼촌": {"김장 비용": [v], "없음": []}}, ["김장"])
        self.assertIn("https://youtube.com/shorts/abc", md)
        self.assertIn("무 / 값", md)
        self.assertIn("(결과 없음)", md)
        self.assertIn("구글 트렌드", md)

    def test_skips_without_key(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(tr.run(), 0)

    def test_keywords_config(self):
        cfg = json.loads(pathlib.Path("config/trend_keywords.json").read_text(encoding="utf-8"))
        n = sum(len(v) for v in cfg.values())
        self.assertLessEqual(n, 20)  # 할당량: 검색 100/회, 하루 10,000


if __name__ == "__main__":
    unittest.main()
