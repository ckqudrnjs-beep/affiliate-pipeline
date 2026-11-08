import datetime as dt
import unittest

from pipeline.compliance import DISCLOSURES, check
from pipeline.coupang import sign
from pipeline.drafts import build, load_manual, load_tips, render_post

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


class ManualLinksTest(unittest.TestCase):
    def test_csv_skips_comments_and_example(self):
        import tempfile, os
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("productName,productPrice,productUrl,isRocket,priceDate\n# 주석\n")
            f.write("예시,1000,https://link.coupang.com/a/EXAMPLE,1,2026-11-07\n")
            f.write("전기요,39900,https://link.coupang.com/a/real1,1,2026-11-07\n")
        rows = load_manual(f.name)
        os.unlink(f.name)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["productPrice"], 39900)
        self.assertTrue(rows[0]["isRocket"])


class MixTest(unittest.TestCase):
    def test_info_posts_at_least_promo_and_pass(self):
        tips = load_tips("config/tips.csv")
        self.assertGreaterEqual(len(tips), 5)
        md = build([PRODUCT, PRODUCT], TODAY, tips=tips)
        self.assertEqual(md.count("program=info"), 2)
        self.assertEqual(md.count("program=coupang"), 2)
        self.assertNotIn("⛔", md)

    def test_all_tips_pass_compliance(self):
        for t in load_tips("config/tips.csv"):
            self.assertEqual(check(t["text"], ["info"]), [], t["topic"])

    def test_info_with_link_blocked(self):
        self.assertTrue(check("팁 https://link.coupang.com/a/x", ["info"]))

    def test_heading_matches_publisher_format(self):
        import re
        md = build([PRODUCT], TODAY, tips=load_tips("config/tips.csv"))
        rx = re.compile(r"^## 초안 (\d+) — (.+?)\n(?:<!-- meta (.*?) -->\n)?\n```text\n(.*?)\n```", re.M | re.S)
        self.assertEqual(len(rx.findall(md)), 3)


class AliTest(unittest.TestCase):
    def test_sign_is_upper_hex(self):
        from pipeline.aliexpress import sign
        s = sign({"b": "2", "a": "1"}, "secret")
        self.assertEqual(len(s), 64)
        self.assertEqual(s, s.upper())

    def test_falls_back_to_product_query_without_permission(self):
        from pipeline.aliexpress import AliExpressClient
        c = AliExpressClient("k", "s", "t")
        calls = []
        def fake(method, **biz):
            calls.append(method)
            if method.endswith("hotproduct.query"):
                return {"error_response": {"code": "InsufficientPermission", "msg": "no"}}
            return {"aliexpress_affiliate_product_query_response": {"resp_result": {"resp_code": 200, "result": {
                "products": {"product": [{"product_title": "가습기", "target_sale_price": "9900",
                                          "promotion_link": "https://s.click.aliexpress.com/e/_x"}]}}}}}
        c._call = fake
        items = c.hot_products()
        self.assertEqual(calls[-1], "aliexpress.affiliate.product.query")
        self.assertEqual(items[0]["productPrice"], 9900)

    def test_ali_product_passes(self):
        from pipeline.aliexpress import to_draft_product
        p = to_draft_product({"product_title": "USB 미니 가습기", "target_sale_price": "8900.00",
                              "promotion_link": "https://s.click.aliexpress.com/e/_abc"})
        post = render_post(p, TODAY)
        self.assertTrue(post.startswith(DISCLOSURES["aliexpress"]))
        self.assertEqual(check(post, ["aliexpress"]), [])


class NaverTest(unittest.TestCase):
    def test_naver_post_uses_naver_disclosure_and_passes(self):
        p = {"program": "naver", "productName": "전기요", "productPrice": 39900,
             "productUrl": "https://naver.me/abc", "priceDate": "2026-11-07"}
        post = render_post(p, TODAY)
        self.assertTrue(post.startswith(DISCLOSURES["naver"]))
        self.assertEqual(check(post, ["naver"]), [])


class BlogTest(unittest.TestCase):
    def test_blog_draft_passes_and_starts_with_disclosure(self):
        from pipeline.drafts import build_blog, render_blog
        from pipeline.aliexpress import to_draft_product
        ali = to_draft_product({"product_title": "USB 미니 가습기", "target_sale_price": "8900.00",
                                "promotion_link": "https://s.click.aliexpress.com/e/_abc"})
        for p, prog in ((PRODUCT, "coupang"), (ali, "aliexpress")):
            text = render_blog(p, TODAY)
            self.assertTrue(text.startswith(DISCLOSURES[prog]))
            self.assertEqual(check(text, [prog]), [])
        self.assertNotIn("⛔", build_blog([PRODUCT, ali], TODAY))

    def test_manual_has_no_links(self):
        from pipeline.drafts import build_manual
        md = build_manual(load_tips("config/tips.csv"), TODAY)
        self.assertNotIn("http", md)
        self.assertEqual(md.count("## 글 "), 2)


if __name__ == "__main__":
    unittest.main()
