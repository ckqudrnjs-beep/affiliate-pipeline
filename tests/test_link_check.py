"""주간 링크 점검 결과 정리 (scripts/link_check.py, BK 11/25). lychee 는 부르지 않는다."""
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import link_check as L  # noqa: E402

SITE = "/tmp/_site"


class LinkCheckTest(unittest.TestCase):
    def test_page_url(self):
        self.assertEqual(L.page_url("/tmp/_site/news/a-1.html", SITE, L.DON), "https://don3chon.com/news/a-1")
        self.assertEqual(L.page_url("file:///tmp/_site/index.html", SITE, L.DON), "https://don3chon.com/")
        self.assertEqual(L.page_url("https://5raksil.com/g/x", "", L.RAKSIL), "https://5raksil.com/g/x")

    def test_summarize(self):
        rep = {"unique": 50, "error_map": {
            "/tmp/_site/news/a.html": [
                {"url": "file:///tmp/_site/p/gone", "status": {"text": "File not found"}},
                {"url": "https://shop.example/x", "status": {"text": "404 Not Found", "code": 404}},
                {"url": "https://www.coupang.com/vp/1", "status": {"text": "403 Forbidden", "code": 403}},
                {"url": "https://slow.example/", "status": {"text": "Timeout"}},
            ],
            "/tmp/_site/guide/b.html": [{"url": "file:///tmp/_site/p/gone", "status": {"text": "File not found"}}],
        }}
        broken, slow, n = L.summarize(rep, SITE, L.DON)
        self.assertEqual(n, 50)
        self.assertEqual(slow, 1)
        self.assertEqual([b[0] for b in broken], ["https://don3chon.com/p/gone", "https://shop.example/x"])
        self.assertEqual(broken[0][1], "페이지 없음")
        self.assertEqual(broken[1][1], "404")

    def test_message(self):
        ok = L.message([("돈삼촌", [], 0, 10)])
        self.assertIn("이상 없음", ok)
        bad = L.message([("돈삼촌", [("https://a/x", "404", "https://don3chon.com/")] * 20, 2, 10)])
        self.assertIn("깨진 링크 20개", bad)
        self.assertIn("외 5개", bad)

    def test_workflow_pins_checksum(self):
        wf = (ROOT / ".github/workflows/linkcheck.yml").read_text(encoding="utf-8")
        self.assertIn("sha256sum -c", wf)
        self.assertRegex(wf, r'LYCHEE_SHA256: "[0-9a-f]{64}"')


if __name__ == "__main__":
    unittest.main()
