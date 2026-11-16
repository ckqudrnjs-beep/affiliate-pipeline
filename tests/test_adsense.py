import unittest
from pipeline import site as S


class AdsenseTest(unittest.TestCase):
    def test_client_format(self):
        old = dict(S.CFG)
        try:
            for raw, want in (("pub-1234567890123456", "ca-pub-1234567890123456"), ("ca-pub-1234567890123456", "ca-pub-1234567890123456"),
                              ("", ""), ("<script>", "")):
                S.CFG["adsensePublisherId"] = raw
                self.assertEqual(S.adsense_client(), want)
        finally:
            S.CFG.clear(); S.CFG.update(old)

    def test_page_flags(self):
        old = dict(S.CFG)
        try:
            S.CFG["adsensePublisherId"] = "pub-1234567890123456"
            self.assertIn("adsbygoogle.js?client=ca-pub-1234567890123456", S.page("t", "d", "b"))
            p = S.page("t", "d", "b", ads=False, noindex=True)
            self.assertNotIn("adsbygoogle", p)
            self.assertIn('name="robots" content="noindex,follow"', p)
            self.assertIn("about.html", p)
            self.assertIn("contact.html", p)
        finally:
            S.CFG.clear(); S.CFG.update(old)

    def test_adfit(self):
        old = dict(S.CFG)
        try:
            S.CFG["adfitUnit"] = "DAN-abc123XYZ"
            self.assertIn('data-ad-unit="DAN-abc123XYZ"', S.page("t", "d", "b"))
            self.assertNotIn("kakao_ad_area", S.page("t", "d", "b", ads=False))
            S.CFG["adfitUnit"] = "bad\"x"
            self.assertNotIn("kakao_ad_area", S.page("t", "d", "b"))
        finally:
            S.CFG.clear(); S.CFG.update(old)

    def test_thin_news(self):
        self.assertTrue(S.thin_news({"id": "drop-x-2026-11-12"}))
        self.assertFalse(S.thin_news({"id": "winter-400kwh", "body": "가" * 300}))
        self.assertTrue(S.thin_news({"id": "winter-400kwh", "body": "짧은 소식"}))


if __name__ == "__main__":
    unittest.main()
