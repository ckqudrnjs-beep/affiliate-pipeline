import json
import pathlib
import unittest

from pipeline import report as R
from pipeline import shopping as SH


def item(name, m, y=None, price=1000, unit="1kg"):
    return {"name": name, "unit": unit, "price": price, "m": m, "y": y}


def rep(date, cheap, up=(), allp=None):
    return {"date": date, "lines": ["x"], "grocery": {"count": 100, "down": cheap[:5], "up": list(up), "cheap": cheap, "all": allp or {}}}


RECS = [{"slug": "fishcake-radish-soup", "name": "어묵탕", "total": 1370, "save": 9000, "ingredients": [{"id": "radish"}]},
        {"slug": "party-x", "name": "파티", "total": 4000, "save": 20000, "collection": "party", "ingredients": [{"id": "radish"}]}]


class ShoppingTest(unittest.TestCase):
    def test_pick_prefers_kitchen_and_dedupes(self):
        cheap = [item("체리(수입)", -50), item("오이(취청)", -40), item("오이(가시계통)", -39), item("무(고랭지)", -30),
                 item("토마토", -20), item("양파", -10), item("감자(수미)", -5), item("바나나(수입)", -3)]
        names = [x["name"] for x in SH.pick(rep("2026-11-23", cheap)["grocery"])]
        self.assertEqual(names, ["오이(취청)", "무(고랭지)", "토마토", "양파", "감자(수미)"])

    def test_info_inner_name(self):
        self.assertEqual(SH.info("호박(애호박)")[0], "애호박")
        self.assertEqual(SH.info("무(고랭지)")[0], "무")
        self.assertIsNone(SH.info("체리(수입)"))

    def test_aha_lines(self):
        self.assertIn("아직 12.0% 비싸요", SH.aha(item("무", -20, 12.0), []))
        self.assertIn("둘 다 싼", SH.aha(item("무", -20, -30.0), []))
        self.assertIn("한 달 전엔 약 2,000원", SH.aha(item("무", -50, None, 1000), []))
        # 4주 이상 기록 중 최저
        key = "무|1kg"
        reps = [rep("2026-12-14", [])] + [rep(d, [], allp={key: 1500}) for d in ("2026-12-07", "2026-11-30", "2026-11-23")]
        self.assertIn("4주 중 가장 싼 주", SH.aha(item("무", -20, 10.0), reps))
        self.assertEqual(SH.history_low(item("무", -20, price=1600), reps), 0)

    def test_recipes_prefers_single_bowl(self):
        self.assertEqual([r["slug"] for r in SH.recipes_for(("radish",), RECS)], ["fishcake-radish-soup", "party-x"])

    def test_swaps(self):
        g = rep("2026-11-23", [item("무(고랭지)", -27.3), item("감자", -10)], up=[item("오이(취청)", 71.2), item("오이(가시계통)", 69), item("호박(애호박)", 66)])["grocery"]
        sw = [(u["name"], c["name"]) for u, c, _ in SH.swaps(g, [])]
        self.assertEqual(sw, [("오이(취청)", "무(고랭지)"), ("호박(애호박)", "감자")])

    def test_body_no_affiliate_and_empty(self):
        cheap = [item("무(고랭지)", -27.3, None, 1647, "1개"), item("토마토", -46.2, -52.9, 3909)]
        html = SH.body([rep("2026-11-16", cheap)], RECS)
        self.assertIn("recipe/fishcake-radish-soup.html", html)
        for bad in ("sponsored", "coupang", "쿠팡", "[광고]", "파트너스"):
            self.assertNotIn(bad, html)
        self.assertIn("첫 시세 리포트", SH.body([], RECS))

    def test_real_report_renders(self):
        reps = R.load_all()
        if reps and SH.latest(reps):
            self.assertIn("scard", SH.body(reps, []))


if __name__ == "__main__":
    unittest.main()
