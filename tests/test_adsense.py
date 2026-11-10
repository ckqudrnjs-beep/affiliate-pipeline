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


if __name__ == "__main__":
    unittest.main()
