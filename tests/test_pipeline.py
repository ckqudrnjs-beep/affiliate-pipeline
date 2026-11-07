import datetime as dt
import unittest

from pipeline.compliance import DISCLOSURES, check
from pipeline.coupang import sign
from pipeline.drafts import build, render_post

PRODUCT = {
    "productName": "무선 전기주전자 1.7L",
    "productPrice": 23900,
    "productUrl": "https://link.coupang.com/a/abc123",
    "isRocket": True,
}
TODAY = dt.date(2026, 11, 7)


class ComplianceTest(unittest.TestCase):
    def test_rendered_post_passes(self):
        self.assertEqual(check(render_post(PRODUCT, TODAY), ["coupang"]), [])

    def test_missing_disclosure_blocked(self):
        self.assertTrue(check("좋은 상품 https://link.coupang.com/a/x", ["coupang"]))

    def test_disclosure_too_late_blocked(self):
        text = "가" * 300 + DISCLOSURES["coupang"]
        self.assertTrue(any("대가성" in p for p in check(text, ["coupang"])))

    def test_unknown_domain_blocked(self):
        text = DISCLOSURES["coupang"] + " https://bit.ly/xyz"
        self.assertTrue(any("bit.ly" in p for p in check(text, ["coupang"])))

    def test_price_without_date_blocked(self):
        text = DISCLOSURES["coupang"] + " 지금 9,900원"
        self.assertTrue(any("기준 일자" in p for p in check(text, ["coupang"])))

    def test_fake_experience_blocked(self):
        text = DISCLOSURES["coupang"] + " 제가 직접 써봤는데 최고"
        self.assertTrue(check(text, ["coupang"]))
        self.assertEqual(check(text, ["coupang"], has_usage_evidence=True), [])


class CoupangSignTest(unittest.TestCase):
    def test_header_format(self):
        h = sign("GET", "/p", "a=1", "secret", "access", now=0)
        self.assertTrue(h.startswith("CEA algorithm=HmacSHA256, access-key=access, signed-date=700101T000000Z, signature="))


class DraftTest(unittest.TestCase):
    def test_build_marks_status(self):
        md = build([PRODUCT], TODAY)
        self.assertIn("✅ 검사 통과", md)


if __name__ == "__main__":
    unittest.main()
