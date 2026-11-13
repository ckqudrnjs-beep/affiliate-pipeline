import datetime as dt
import unittest

from pipeline import report as R

D = dt.date(2026, 11, 16)

AVG = {"RESULT": {"OIL": [{"TRADE_DT": "20261116", "PRODCD": "B027", "PRODNM": "휘발유", "PRICE": "1651.23", "DIFF": "+0.50"},
                          {"PRODCD": "D047", "PRODNM": "자동차용경유", "PRICE": "1502.10", "DIFF": "-1.00"},
                          {"PRODCD": "K015", "PRODNM": "LPG", "PRICE": "1000"}]}}
SIDO = {"B027": {"RESULT": {"OIL": [{"SIDOCD": "01", "SIDONM": "서울", "PRICE": "1720"}, {"SIDOCD": "15", "SIDONM": "대구", "PRICE": "1610"},
                                   {"SIDOCD": "00", "SIDONM": "전국", "PRICE": "1651"}]}}}
RECENT = {"RESULT": {"OIL": [{"DATE": "20261110", "PRODCD": "B027", "PRICE": "1640"}, {"DATE": "20261116", "PRODCD": "B027", "PRICE": "1651.2"}]}}


def kamis(n=12):
    rows = [{"product_cls_code": "01", "productName": f"품목{i}", "unit": "1kg", "dpr1": f"{1000 + i * 100:,}",
             "dpr3": "1,000", "dpr4": "1,000"} for i in range(n)]
    rows.append({"product_cls_code": "02", "productName": "도매", "dpr1": "1", "dpr3": "100"})
    rows.append({"product_cls_code": "01", "productName": "빈값", "dpr1": "-", "dpr3": "1,000"})
    return {"price": rows}


def ecos(vals):
    return {"StatisticSearch": {"row": [{"TIME": f"202611{i + 1:02d}", "DATA_VALUE": str(v)} for i, v in enumerate(vals)]}}


class ReportTest(unittest.TestCase):
    def test_fuel(self):
        f = R.parse_fuel(AVG, SIDO, RECENT)
        self.assertEqual(f["B027"]["price"], 1651)
        self.assertEqual(f["B027"]["cheapest"], ["대구", 1610])
        self.assertEqual(f["B027"]["priciest"], ["서울", 1720])
        self.assertEqual(f["B027"]["week"], 11.2)
        self.assertNotIn("K015", f)
        self.assertIn("11원 올랐어요", R.fuel_line(f))
        self.assertIsNone(R.parse_fuel({}, {}, {}))

    def test_grocery(self):
        g = R.parse_grocery(kamis())
        self.assertEqual(g["count"], 12)
        self.assertEqual(g["up"][0]["name"], "품목11")
        self.assertEqual(g["up"][0]["m"], 110.0)
        self.assertEqual(g["down"], [])
        self.assertNotIn("내린 건", R.grocery_line(g))
        self.assertIsNone(R.parse_grocery(kamis(4)))
        self.assertIsNone(R.parse_grocery({"error_code": "200"}))

    def test_fx(self):
        x = R.parse_fx(ecos([1400] * 19 + [1380]))
        self.assertEqual(x["usd"], 1380.0)
        self.assertLess(x["vsAvg"], -1)
        self.assertIn("유리한 편", R.fx_line(x))
        self.assertIsNone(R.parse_fx(ecos([1400] * 3)))

    def test_build_and_html(self):
        self.assertIsNone(R.build(D, None, None, None))
        r = R.build(D, R.parse_fuel(AVG, SIDO, RECENT), None, R.parse_fx(ecos([1400] * 20)))
        self.assertEqual(len(r["lines"]), 2)
        h = R.body(r)
        self.assertIn("오피넷", h)
        self.assertNotIn("KAMIS", h)
        self.assertIn("11월 3째 주", R.title(r))
        self.assertIn("/report/2026-11-16", R.telegram_text(r))


if __name__ == "__main__":
    unittest.main()
