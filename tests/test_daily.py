import datetime as dt
import json
import pathlib
import tempfile
import unittest

from pipeline import daily as DY
from test_report import AVG, SIDO, RECENT, ecos


class DailyTest(unittest.TestCase):
    def test_fuel_sido(self):
        f = DY.parse_fuel(AVG, SIDO, RECENT)
        self.assertEqual(f["B027"]["price"], 1651.2)
        self.assertEqual(f["B027"]["sido"], {"서울": [1720.0, 0.0], "대구": [1610.0, 0.0]})
        self.assertEqual(f["D047"]["diff"], -1.0)
        self.assertIn("11원 올랐어요", DY.fuel_line(f))
        self.assertIsNone(DY.parse_fuel({}, {}, {}))

    def test_fx(self):
        x = DY.parse_fx(ecos([1400] * 19 + [1430]))
        self.assertEqual(x["diff"], 30.0)
        self.assertIn("높아요", DY.fx_line(x))
        self.assertIsNone(DY.parse_fx(ecos([1400] * 3)))

    def test_grocery(self):
        js = {"price": [{"product_cls_code": "01", "productName": "배추", "unit": "1포기", "dpr1": "4,000", "dpr2": "4,000", "dpr3": "3,000"},
                        {"product_cls_code": "01", "productName": "양파", "unit": "1kg", "dpr1": "900", "dpr2": "-", "dpr3": "1,000"},
                        {"product_cls_code": "01", "productName": "망고", "dpr1": "5,000", "dpr3": "5,000"},
                        {"product_cls_code": "02", "productName": "대파", "dpr1": "1", "dpr3": "1"}]}
        g = DY.parse_grocery(js)
        self.assertEqual([i["name"] for i in g], ["배추", "양파"])
        self.assertEqual(DY.grocery_line(g), "한 달 새 배추가 33% 올랐어요. 양파는 10% 내렸어요.")

    def test_josa(self):
        self.assertEqual(DY.josa("달걀", "이가"), "달걀이")
        self.assertEqual(DY.josa("배추", "은는"), "배추는")

    def test_options(self):
        for v, near in ((18530, False), (1651.2, True), (210000, False), (480, False)):
            opts, a = DY.options(v, 7, near)
            self.assertEqual(len(set(opts)), 4)
            self.assertEqual(opts[a], DY.nice(v))
            self.assertEqual(opts, sorted(opts))

    def test_schedule_stable(self):
        start = dt.date(2026, 11, 14)
        a, b = DY.schedule(start, 30, None), DY.schedule(start, 30, None)
        self.assertEqual(a, b)
        self.assertEqual(len(a), 30)
        ids = [q["id"] for q in a.values()]
        self.assertEqual(len(ids), len(set(ids)))  # 30일 안에 같은 문제 없음
        for q in a.values():
            self.assertEqual(len(q["o"]), 4)
            self.assertTrue(q["why"] and q["link"])

    def test_live_question_only_on_its_day(self):
        latest = {"date": "2026-11-16", "fuel": DY.parse_fuel(AVG, SIDO, RECENT), "fx": DY.parse_fx(ecos([1400] * 20))}
        s = DY.schedule(dt.date(2026, 11, 10), 14, latest)
        live = [k for k, q in s.items() if q["id"].startswith(("fuel-", "fx-"))]
        self.assertTrue(set(live) <= {"2026-11-16"})

    def test_blocks(self):
        latest = {"date": "2026-11-16", "fuel": DY.parse_fuel(AVG, SIDO, RECENT), "fx": DY.parse_fx(ecos([1400] * 20))}
        h = DY.today_block(latest)
        self.assertIn('id="sido"', h)
        self.assertIn("오피넷", h)
        self.assertIn('id="quizbox"', DY.today_block(None))
        js = DY.data_script(latest, [latest], "https://x", today=dt.date(2026, 11, 16))
        self.assertIn("2026-11-16", js)

    def test_load_all(self):
        with tempfile.TemporaryDirectory() as d:
            for x in ("2026-11-14", "2026-11-15"):
                (pathlib.Path(d) / f"{x}.json").write_text(json.dumps({"date": x}))
            self.assertEqual([r["date"] for r in DY.load_all(pathlib.Path(d))], ["2026-11-15", "2026-11-14"])


if __name__ == "__main__":
    unittest.main()
