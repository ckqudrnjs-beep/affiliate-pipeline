import pathlib
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


class KeywordTest(unittest.TestCase):
    def test_parse_keywords(self):
        from pipeline.drafts import parse_keywords
        self.assertEqual(parse_keywords("humidifier(가습기)\r\nelectric blanket(전기요)(전기장판)"),
                         ["humidifier", "electric blanket"])
        self.assertEqual(parse_keywords("humidifier, electric blanket"), ["humidifier", "electric blanket"])
        self.assertEqual(parse_keywords(""), [])


if __name__ == "__main__":
    unittest.main()


class SiteTest(unittest.TestCase):
    def test_calc_and_build(self):
        import tempfile
        from pipeline import site
        c = site.calc({"aliPrice": "4500", "coupangPrice": "12900", "shipDays": "9", "lifeMonths": "10"})
        self.assertEqual((c["diff"], c["ratio"], c["perDay"], c["aliWins"]), (8400, 65, 1050, True))
        with tempfile.TemporaryDirectory() as d:
            site.build(d + "/real")  # 예시 데이터는 실제 빌드에서 빠진다
            self.assertFalse((pathlib.Path(d) / "real/p/window-insulation-film.html").exists())
            solo = site.calc({"aliPrice": "21450", "coupangPrice": "", "lifeMonths": "12"})
            self.assertTrue(solo["solo"])
            n = site.build(d, allow_examples=True)
            self.assertGreater(n, 0)
            html = (pathlib.Path(d) / "index.html").read_text(encoding="utf-8")
            body = html.split("<body>", 1)[1]
            self.assertIn("수수료를 제공받습니다", body[:400])


class CurateTest(unittest.TestCase):
    def test_pick_candidates_filters_and_sorts(self):
        from pipeline.curate import pick_candidates, to_candidate
        raw = [to_candidate({"product_id": i, "product_title": f"p{i}", "target_sale_price": "20000", "promotion_link": "https://s.click.aliexpress.com/e/x",
                             "commission_rate": c, "evaluate_rate": r, "lastest_volume": v})
               for i, c, r, v in [(1, "3.0%", "95%", 500), (2, "9.0%", "95%", 500), (3, "12.0%", "80%", 500), (4, "8.0%", "96%", 10)]]
        self.assertEqual([c["aliProductId"] for c in pick_candidates(raw)], ["2", "1"])

    def test_price_history_low30(self):
        import tempfile, json
        from pipeline import site
        with tempfile.TemporaryDirectory() as d:
            (pathlib.Path(d) / "prices").mkdir()
            (pathlib.Path(d) / "products").mkdir()
            rows = "date,slug,aliPrice,coupangPrice\n" + "".join(f"2026-11-{i:02d},t,{9000 + i * 10},\n" for i in range(1, 11))
            (pathlib.Path(d) / "prices" / "2026-11.csv").write_text(rows, encoding="utf-8")
            (pathlib.Path(d) / "products" / "t.json").write_text(json.dumps({"slug": "t", "category": "heat", "name": "테스트", "aliPrice": 1,
                "aliUrl": "https://s.click.aliexpress.com/e/a", "shipDays": 10, "coupangPrice": 20000, "coupangUrl": "https://link.coupang.com/a/b",
                "lifeMonths": 12, "priceDate": "2026-11-01", "note": "가" * 45, "check": "확인"}), encoding="utf-8")
            empty = pathlib.Path(d) / "empty.csv"
            empty.write_text("slug,category,name,aliPrice,aliUrl,shipDays,coupangPrice,coupangUrl,lifeMonths,priceDate,note,check\n", encoding="utf-8")
            p = site.load(str(empty), data_dir=d)[0]
            self.assertEqual((p["aliPrice"], p["priceDate"], p["low30"]), ("9100", "2026-11-10", "9010"))


class PriceRefreshTest(unittest.TestCase):
    def test_drop_news_and_auto_hide(self):
        import tempfile, json, datetime as dt
        from pipeline import curate
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            (root / "products").mkdir()
            for slug, pid in (("a", "1"), ("b", "2")):
                (root / "products" / f"{slug}.json").write_text(json.dumps({"slug": slug, "name": slug.upper(), "aliProductId": pid, "aliPrice": 10000, "status": "active"}), encoding="utf-8")

            class C:
                tracking_id = "t"
                def _call(self, *a, **k):  # 상품 1만 조회되고 8,000원으로 내림
                    return {"r": {"resp_result": {"result": {"products": {"product": [{"product_id": 1, "target_sale_price": "8000"}]}}}}}
            for i in range(3):
                curate.record_prices(C(), dt.date(2026, 11, 10 + i), root)
            a = json.loads((root / "products/a.json").read_text(encoding="utf-8"))
            b = json.loads((root / "products/b.json").read_text(encoding="utf-8"))
            self.assertEqual((a["status"], b["status"]), ("active", "ended"))
            news = json.loads((root / "news.json").read_text(encoding="utf-8"))
            self.assertEqual([n["id"] for n in news], ["drop-a-2026-11-10"])  # 같은 가격이 이어지면 다시 알리지 않는다


class ArticleTest(unittest.TestCase):
    def test_render_internal_links_only(self):
        from pipeline import articles
        h = articles.render("## 제목\n[계산기](calc/electric.html) [밖](https://evil.example)\n- 가\n| a | b |\n|---|---|\n| 1 | 2 |")
        self.assertIn('<a href="../calc/electric.html">계산기</a>', h)
        self.assertNotIn("evil.example\">", h)
        self.assertIn("<table>", h)
        self.assertIn("<h2>제목</h2>", h)


class ArticleDataTest(unittest.TestCase):
    def test_all_articles_valid(self):  # 자동 작성 글은 이 검사를 통과해야만 main에 올라간다
        import json
        from pipeline import articles, calcs
        root = pathlib.Path(__file__).resolve().parent.parent / "data"
        prods = {json.loads(f.read_text(encoding="utf-8"))["slug"] for f in (root / "products").glob("*.json")}
        arts = [json.loads(f.read_text(encoding="utf-8")) for f in (root / "articles").glob("*.json")]
        slugs = [a["slug"] for a in arts]
        self.assertEqual(len(slugs), len(set(slugs)), "slug 중복")
        for a in arts:
            self.assertEqual(articles.validate(a, prods, {c["slug"] for c in calcs.CALCS}, set(slugs)), [], a["slug"])


class ImitationFilterTest(unittest.TestCase):
    def test_filter(self):
        from pipeline.curate import imitation_reason as r
        self.assertTrue(r("마키타 정품 DDF487 18V 브러시리스 전동 드라이버"))
        self.assertTrue(r("DEWALT DCD805 20V 무선 임팩트 드릴"))
        self.assertTrue(r("미지아 차량용 무선 청소기 21kPa"))
        self.assertTrue(r("럭셔리 가방 레플리카"))
        self.assertEqual(r("UGREEN 마그네틱 보조배터리 (아이폰 17용 Magsafe 지원)"), "")
        self.assertEqual(r("Baseus 무선 충전기 AirPods 호환"), "")
        self.assertEqual(r("샤오미 MIJIA 전동칫솔 프로"), "")
        self.assertEqual(r("Baseus 100W 보조베터리 MacBook iPhone Samsung Xiaomi"), "")


class PriceBatchTest(unittest.TestCase):
    def test_batches_over_50(self):
        import tempfile, json, datetime as dt
        from pipeline import curate
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d); (root / "products").mkdir()
            for i in range(55):
                (root / "products" / f"s{i}.json").write_text(json.dumps({"slug": f"s{i}", "name": "x", "aliProductId": str(i), "aliPrice": 10000}), encoding="utf-8")
            calls = []
            class C:
                tracking_id = "t"
                def _call(self, m, product_ids, **k):
                    ids = product_ids.split(","); calls.append(len(ids))
                    return {"r": {"resp_result": {"result": {"products": {"product": [{"product_id": int(i), "target_sale_price": "10000"} for i in ids]}}}}}
            self.assertEqual(curate.record_prices(C(), dt.date(2026, 11, 11), root), 55)
            self.assertEqual(calls, [20, 20, 15])


class NaverBoxTest(unittest.TestCase):
    def test_box_has_exact_disclosure_and_unmodified_links(self):
        from pipeline import articles as A
        items = A.load_naver(str(pathlib.Path(__file__).resolve().parent.parent / "data" / "naver_products.json"))
        ids = [i["id"] for i in items]
        self.assertEqual(len(ids), len(set(ids)))
        for i in items:
            self.assertRegex(i["url"], r"^https://naver\.me/\w+$")
            for w in ("전자파", "살균", "신생아", "최저가", "특가"):
                self.assertNotIn(w, i["name"] + i["why"])
        picks = A.naver_for({"title": "온풍기 전기요금", "keywords": []}, items)
        self.assertTrue(1 <= len(picks) <= 2)
        h = A.naver_box(picks)
        self.assertIn(A.NAVER_DISCLOSURE, h)
        self.assertIn('rel="sponsored nofollow noopener"', h)
        self.assertNotIn("prefetch", h)
        self.assertEqual(A.naver_box([]), "")
        self.assertEqual(A.naver_for({"title": "온풍기", "naver": []}, items), [])
