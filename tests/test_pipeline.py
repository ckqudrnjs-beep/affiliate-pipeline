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
            self.assertNotIn('class="adbar"', body)  # 홈 맨 위 띠는 없음 (2026-11-16)
            self.assertIn("수수료를 받습니다", body.split('id="picks"', 1)[1][:600])  # 상품 칸 바로 위 한 줄
            # 상품 카드·상품 링크가 있는 글은 맨 위 [광고] 띠가 본문보다 먼저 (2026-11-21)
            from pipeline import articles as A
            for a in A.load():
                g = (pathlib.Path(d) / "guide" / f"{a['slug']}.html").read_text(encoding="utf-8").split("<body>", 1)[1]
                if A.has_affiliate(a):
                    self.assertIn('class="adbar"', g, a["slug"])
                    self.assertLess(g.index('class="adbar"'), g.index('class="article"'), a["slug"])
                else:
                    self.assertNotIn('class="adbar"', g, a["slug"])


class CurateTest(unittest.TestCase):
    def test_pick_candidates_excludes_existing_and_variants(self):
        from pipeline.curate import pick_candidates
        base = {"aliUrl": "https://s.click.aliexpress.com/x", "aliPrice": 30000, "rating": 95, "orders": 500, "commission": 7.0}
        raw = [base | {"aliProductId": "1", "name": "Baseus 자동차 진공 청소기 무선 블로워 A"},
               base | {"aliProductId": "2", "name": "Baseus 자동차 진공 청소기 무선 블로워 B"},
               base | {"aliProductId": "3", "name": "SONOFF TRVZB 라디에이터 밸브"}]
        self.assertEqual([c["aliProductId"] for c in pick_candidates(raw, exclude={"3"})], ["1"])

    def test_todays_keywords_rotation_first(self):
        import datetime as dt, json, pathlib, tempfile
        from pipeline.curate import todays_keywords
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d, "k.json")
            f.write_text(json.dumps({"5": ["drawer organizer", "humidifier"]}), encoding="utf-8")
            self.assertEqual(todays_keywords(dt.date(2026, 11, 13), ["humidifier", "blanket"], f),
                             ["drawer organizer", "humidifier", "blanket"])

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

    def test_title_money_needs_assumption(self):  # 정책 검사 2026-11-28: 가정 계산 금액을 제목에 실제 결과처럼
        from pipeline import articles
        base = {"slug": "x", "date": "2026-11-28", "desc": "d", "body": "## a\n## b\n" + "가" * 700}
        bad = articles.validate({**base, "title": "운전 전날 점검 (점프스타터 완충 전기값 약 22원)"}, set(), set(), set())
        self.assertTrue(any("가정 조건" in e for e in bad))
        for t in ("운전 전날 점검", "강풍 4시간·수면 20시간이면 약 2,160원", "효율 85% 가정 시 약 22원"):
            self.assertEqual(articles.validate({**base, "title": t}, set(), set(), set()), [], t)

    def test_articles_not_too_similar(self):  # 자동 글끼리 비슷해 보이면 올리지 않는다 (2026-11-20)
        import json
        from pipeline import articles
        root = pathlib.Path(__file__).resolve().parent.parent / "data"
        arts = [json.loads(f.read_text(encoding="utf-8")) for f in (root / "articles").glob("*.json")]
        self.assertEqual(articles.similarity_problems(arts), [])

    def test_similarity_rules_catch_copies(self):
        from pipeline import articles
        body = "## 결론부터: 한 달 6천 원이에요\n" + "전기장판 200W를 하루 8시간 켜면 한 달 48kWh가 더 나와요. " * 20
        a = {"slug": "a", "date": "2026-11-21", "body": body}
        b = {"slug": "b", "date": "2026-11-22", "body": body.replace("6천", "7천")}
        errs = articles.similarity_problems([a, b])
        self.assertTrue(any("본문 겹침" in e for e in errs))
        self.assertTrue(any("같은 문장" in e for e in errs))
        self.assertTrue(any("첫 소제목" in e for e in errs))
        self.assertTrue(any("말버릇" in e for e in errs))


    def test_shape_rotation_rules(self):  # 글 모양 돌려 쓰기 (2026-11-28 BK)
        from pipeline import articles
        essay = "## 겨울 저녁에 든 생각\n" + "창문 틈으로 들어오는 바람을 막는 데는 돈이 많이 들지 않아요. " * 30
        self.assertEqual(articles.shape_problems({"shape": "에세이", "body": essay}), [])
        self.assertTrue(articles.shape_problems({"shape": "에세이", "body": essay + "\n- 목록\n"}))
        self.assertTrue(articles.shape_problems({"shape": "짧은답", "body": essay * 3}))
        self.assertTrue(articles.shape_problems({"shape": "없는모양", "body": essay}))
        a = {"slug": "a", "date": "2026-11-29", "shape": "에세이", "body": essay + "\n## 오늘 할 일 하나\n끝.", "products": ["x"]}
        b = {"slug": "b", "date": "2026-11-30", "shape": "에세이", "products": ["y"],
             "body": "## 다른 시작\n" + "보일러 배관 보온재는 겨울 전에 살펴보면 좋아요. " * 30 + "\n## 오늘 해 볼 한 가지\n끝."}
        errs = articles.similarity_problems([a, b])
        self.assertTrue(any("글 모양" in e for e in errs))
        self.assertTrue(any("끝맺음" in e for e in errs))
        self.assertTrue(any("상품 카드" in e for e in errs))


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


class LifecycleTest(unittest.TestCase):
    def _run(self, root, price, status="active"):
        import json, datetime as dt
        from pipeline import curate
        f = root / "products" / "a.json"
        f.write_text(json.dumps({"slug": "a", "name": "x", "aliProductId": "1", "aliPrice": 10000, "status": status}), encoding="utf-8")
        class C:
            tracking_id = "t"
            def _call(self, m, product_ids, **k):
                return {"r": {"resp_result": {"result": {"products": {"product": [{"product_id": 1, "target_sale_price": str(price)}]}}}}}
        curate.record_prices(C(), dt.date(2026, 11, 13), root)
        return json.loads(f.read_text(encoding="utf-8"))["status"]

    def test_price_spike_pauses_and_resumes(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d); (root / "products").mkdir()
            self.assertEqual(self._run(root, 13500), "paused")
            self.assertEqual(self._run(root, 12000, "paused"), "paused")
            self.assertEqual(self._run(root, 11000, "paused"), "active")
            self.assertEqual(self._run(root, 12500), "active")

    def test_season_and_retired_pages(self):
        import datetime as dt, json, tempfile
        from pipeline import site
        self.assertFalse(site.in_season({"category": "heat"}, dt.date(2026, 7, 1)))
        self.assertTrue(site.in_season({"category": "heat"}, dt.date(2026, 12, 1)))
        self.assertTrue(site.in_season({"category": "kitchen"}, dt.date(2026, 7, 1)))
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d); (root / "products").mkdir()
            for slug, st, cat in (("e", "ended", "kitchen"), ("h", "active", "heat"), ("k", "active", "kitchen")):
                (root / "products" / f"{slug}.json").write_text(json.dumps({"slug": slug, "name": slug, "status": st, "category": cat}), encoding="utf-8")
            got = {r["slug"]: r["why"] for r in site.retired(d, dt.date(2026, 7, 1))}
            self.assertEqual(set(got), {"e", "h"})
            html = site.retired_page(got and site.retired(d, dt.date(2026, 7, 1))[0], [])
            self.assertIn("noindex", html)
            self.assertNotIn("s.click.aliexpress", html)


class NewArrivalsTest(unittest.TestCase):
    def test_is_new_window(self):
        import datetime as dt
        from pipeline import site
        t = dt.date(2026, 11, 20)
        self.assertTrue(site.is_new({"addedDate": "2026-11-10"}, t))
        self.assertFalse(site.is_new({"addedDate": "2026-11-06"}, t))
        self.assertFalse(site.is_new({}, t))


class AliCodeTest(unittest.TestCase):
    """알리 제휴 할인코드: API 응답에서 받고, 끝나면 지우고, 끝난 코드는 페이지에 안 나온다 (2026-11-28)."""

    def info(self, end="2099-12-31 23:59:59", qty="100", code="KRABC123"):
        return {"promo_code": code, "code_campaigntype": "1", "code_value": "3000", "code_availabletime_start": "2026-11-01 00:00:00",
                "code_availabletime_end": end, "code_mini_spend": "30000", "code_quantity": qty, "code_promotionurl": "https://s.click.aliexpress.com/x"}

    def test_parse_and_box(self):
        from pipeline import ali_codes as AC
        c = AC.parse({"promo_code_info": self.info()})
        self.assertEqual(c["code"], "KRABC123")
        self.assertEqual(AC.describe(c), "30,000원 이상 3,000원 할인")
        b = AC.box(c)
        self.assertIn("KRABC123", b)
        self.assertIn("12월 31일까지", b)
        self.assertIn("기준", b)
        self.assertNotRegex(b, r"받을\s*수\s*(있|도)")

    def test_expired_or_empty_hidden(self):
        from pipeline import ali_codes as AC
        self.assertIsNone(AC.parse({}))
        self.assertIsNone(AC.parse({"promo_code_info": self.info(code="<script>")}))
        self.assertEqual(AC.box(AC.parse({"promo_code_info": self.info(end="2020-01-01 00:00:00")})), "")
        self.assertEqual(AC.box(AC.parse({"promo_code_info": self.info(qty="0")})), "")
        self.assertEqual(AC.box(None), "")

    def test_record_prices_saves_and_clears(self):
        import tempfile, json, datetime as dt
        from pipeline import curate
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d); (root / "products").mkdir()
            f = root / "products" / "a.json"
            f.write_text(json.dumps({"slug": "a", "name": "x", "aliProductId": "1", "aliPrice": 10000}), encoding="utf-8")
            info = self.info()
            class C:
                tracking_id = "t"
                def _call(self, m, product_ids, **k):
                    p = {"product_id": 1, "target_sale_price": "10000"}
                    if info:
                        p["promo_code_info"] = info
                    return {"r": {"resp_result": {"result": {"products": {"product": [p]}}}}}
            curate.record_prices(C(), dt.date(2026, 11, 28), root)
            self.assertEqual(json.loads(f.read_text())["aliCode"]["code"], "KRABC123")
            info = None
            curate.record_prices(C(), dt.date(2026, 11, 29), root)
            self.assertNotIn("aliCode", json.loads(f.read_text()))
