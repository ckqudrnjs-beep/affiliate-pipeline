import json
import pathlib
import tempfile
import unittest

from pipeline import recipes as RC
from pipeline import seo as S


class RecipeTest(unittest.TestCase):
    def test_all_recipes_valid(self):
        pantry = RC.load_pantry()
        recs = RC.load(pantry=pantry)
        self.assertGreaterEqual(len(recs), 10)
        for r in recs:
            self.assertEqual(RC.validate(r, pantry), [], r["slug"])
            self.assertGreater(r["save"], 0)
            self.assertIn("1인분 원가", RC.title(r))

    def test_cost_math(self):
        pantry = {"rice": {"name": "쌀", "pack": "10kg", "packAmount": 10000.0, "packPrice": 32000, "priceDate": "2026-11-13", "coupangUrl": ""}}
        c = RC.cost({"ingredients": [{"id": "rice", "use": 100, "label": "밥"}], "delivery": 9000}, pantry)
        self.assertEqual(c["total"], 320 + RC.BASICS)
        self.assertEqual(c["delivery"], 9000 + RC.DELIVERY_FEE)

    def test_shop_box_hidden_without_links_and_disclosed_with(self):
        row = {"pantry": {"name": "김치", "pack": "5kg", "coupangUrl": ""}}
        self.assertEqual(RC.shop_box([row]), "")
        row["pantry"]["coupangUrl"] = "https://link.coupang.com/a/x"
        box = RC.shop_box([row])
        self.assertIn(RC.COUPANG_DISCLOSURE, box)
        self.assertIn('rel="sponsored nofollow noopener"', box)
        self.assertNotIn("<img", box)

    def test_bad_link_host_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d, "p.csv")
            f.write_text("id,name,pack,packAmount,unit,packPrice,priceDate,coupangUrl\negg,계란,30구,30,개,8900,2026-11-13,https://evil.example/x\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                RC.load_pantry(str(f))

    def test_feed_includes_recipes(self):
        recs = RC.load()
        f = S.feed("https://x.com", "삼촌", [], [], recs)
        self.assertIn("recipe/kimchi-jjigae.html", f)

    def test_party_serves_split(self):
        pantry = {"rice": {"name": "쌀", "pack": "10kg", "packAmount": 10000.0, "packPrice": 32000, "priceDate": "2026-11-14", "coupangUrl": ""}}
        c = RC.cost({"ingredients": [{"id": "rice", "use": 400, "label": "밥"}], "delivery": 33000, "serves": 4}, pantry)
        self.assertEqual(c["batch"], 1280 + RC.BASICS * 4)
        self.assertEqual(c["deliveryBatch"], 36000)
        self.assertEqual(c["delivery"], 9000)
        self.assertEqual(c["total"], RC.r10(c["batch"] / 4))

    def test_party_block_combo_positive(self):
        recs = RC.load()
        ps = [r for r in recs if RC.is_party(r)]
        self.assertGreaterEqual(len(ps), 5)
        for r in ps:
            self.assertGreater(r["saveBatch"], 0)
            self.assertTrue(r.get("deliveryNote"))
        box = RC.party_block(recs)
        self.assertIn('id="party"', box)
        self.assertNotIn(">-", box)


if __name__ == "__main__":
    unittest.main()
