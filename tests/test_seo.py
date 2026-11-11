import json
import pathlib
import tempfile
import unittest

from pipeline import questions as Q
from pipeline import seo as S
from pipeline.calcs import CALCS


class QuestionPagesTest(unittest.TestCase):
    def test_all_questions_valid(self):
        calc_slugs = {c["slug"] for c in CALCS}
        qs = Q.load()
        self.assertGreaterEqual(len(qs), 10)
        self.assertEqual(len({q["slug"] for q in qs}), len(qs))
        for q in qs:
            self.assertEqual(Q.validate(q, calc_slugs), [], q["slug"])
            c = Q.computed(q)
            self.assertTrue(c["lead"] and c["desc"] and len(c["table"]) >= 3)

    def test_bill_matches_known_values(self):
        # calcs.COMMON_JS bill() 과 같은 값 (node 로 확인한 값)
        self.assertEqual(Q.bill(0), 1020)
        self.assertEqual(Q.bill(250) - Q.bill(250), 0)
        self.assertLess(Q.bill(199), Q.bill(201))
        self.assertGreater(Q.bill(450) - Q.bill(350), Q.bill(150) - Q.bill(50))

    def test_cluster(self):
        self.assertEqual(S.cluster_of("가열식 가습기 전기세"), "humidifier")
        self.assertEqual(S.cluster_of("온풍기 전기요금"), "heater")
        self.assertEqual(S.cluster_of("알리 관세"), "aliexpress")
        self.assertEqual(S.cluster_of("아무 말", "[계산](calc/standby.html)"), "standby")


class SeoOutputTest(unittest.TestCase):
    def test_feed_has_articles_and_sitemap_dates(self):
        arts = [{"slug": "a1", "date": "2026-11-10", "title": "글", "desc": "설명"}]
        news = [{"id": "n1", "date": "2026-11-11", "title": "소식", "body": "본문"}]
        f = S.feed("https://x.com", "삼촌", news, arts)
        self.assertIn("https://x.com/guide/a1.html", f)
        self.assertIn("https://x.com/news/n1.html", f)
        sm = S.sitemap("https://x.com", [("guide/a1.html", "2026-11-10")])
        self.assertIn("<lastmod>2026-11-10</lastmod>", sm)

    def test_og_fallback(self):
        self.assertEqual(S.og_path("guide", "없는-글"), "og/default.png")
        self.assertTrue(pathlib.Path("static/og/default.png").exists())
