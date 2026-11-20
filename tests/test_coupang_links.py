import datetime as dt
import json
import pathlib
import tempfile
import unittest

from pipeline import coupang_links as CL
from pipeline import recipes as RC

TODAY = dt.date(2026, 11, 20)
ROWS = [
    {"id": "egg", "name": "계란", "pack": "30구", "coupangUrl": "https://link.coupang.com/a/manual"},
    {"id": "tofu", "name": "찌개용 두부", "pack": "300g", "coupangUrl": ""},
    {"id": "perilla", "name": "깻잎", "pack": "100g(약 50장)", "coupangUrl": ""},
]


class FakeClient:
    def __init__(self, results=None, fail=False):
        self.results, self.fail, self.calls = results or {}, fail, []

    def search(self, kw, limit=10):
        self.calls.append(kw)
        if self.fail:
            raise OSError("down")
        return self.results.get(kw, [])


class CoupangLinksTest(unittest.TestCase):
    def test_keyword_and_core_word(self):
        self.assertEqual(CL.keyword(ROWS[2]), "깻잎 100g")
        self.assertEqual(CL.core_word(ROWS[1]), "두부")

    def test_pick_requires_name_match_and_partner_host(self):
        prods = [{"productName": "국산 콩 순두부", "productUrl": "https://www.coupang.com/vp/1"},
                 {"productName": "풀무원 두부 300g", "productUrl": "https://link.coupang.com/re/AFFSDP?x=1"}]
        self.assertEqual(CL.pick(prods, ROWS[1])["productName"], "풀무원 두부 300g")
        self.assertIsNone(CL.pick([{"productName": "간장", "productUrl": "https://link.coupang.com/re/x"}], ROWS[1]))

    def test_fill_skips_manual_links_and_respects_cap(self):
        c = FakeClient({"찌개용 두부 300g": [{"productName": "두부 300g", "productUrl": "https://link.coupang.com/re/t"}]})
        cache, log = CL.fill(ROWS, {}, c, TODAY, max_calls=1, sleep=0)
        self.assertEqual(c.calls, ["찌개용 두부 300g"])  # 손 링크(계란)는 검색 안 함, 한도 1
        self.assertEqual(cache["tofu"]["url"], "https://link.coupang.com/re/t")
        self.assertNotIn("egg", cache)

    def test_api_failure_keeps_old_link(self):
        old = {"tofu": {"url": "https://link.coupang.com/re/old", "checked": "2026-01-01"}}
        cache, log = CL.fill(ROWS, old, FakeClient(fail=True), TODAY, sleep=0)
        self.assertEqual(cache["tofu"]["url"], "https://link.coupang.com/re/old")
        self.assertTrue(any("실패" in x for x in log))

    def test_fresh_cache_not_refetched(self):
        fresh = {"tofu": {"url": "https://link.coupang.com/re/t", "checked": "2026-11-15"}}
        self.assertEqual([r["id"] for r in CL.todo(ROWS, fresh, TODAY)], ["perilla"])

    def test_load_pantry_manual_first_then_auto(self):
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d, "p.csv")
            f.write_text("id,name,pack,packAmount,unit,packPrice,priceDate,coupangUrl\n"
                         "egg,계란,30구,30,개,8900,2026-11-13,https://link.coupang.com/a/manual\n"
                         "tofu,두부,300g,300,g,1500,2026-11-13,\n", encoding="utf-8")
            j = pathlib.Path(d, "l.json")
            j.write_text(json.dumps({"egg": {"url": "https://link.coupang.com/re/auto"},
                                     "tofu": {"url": "https://link.coupang.com/re/t"},
                                     "bad": {"url": "https://evil.example/x"}}), encoding="utf-8")
            p = RC.load_pantry(str(f), str(j))
            self.assertEqual(p["egg"]["coupangUrl"], "https://link.coupang.com/a/manual")
            self.assertEqual(p["tofu"]["coupangUrl"], "https://link.coupang.com/re/t")
            self.assertEqual(CL.load_cache(str(j)).keys(), {"egg", "tofu"})

    def test_saved_cache_is_partner_links_only(self):
        for v in CL.load_cache().values():
            self.assertTrue(CL.valid_url(v["url"]))


if __name__ == "__main__":
    unittest.main()
