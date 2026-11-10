import unittest
from pipeline import prices as PR


class PricesTest(unittest.TestCase):
    def h(self, ps):
        return [(f"2026-11-{i + 1:02d}", p) for i, p in enumerate(ps)]

    def test_verdict(self):
        self.assertEqual(PR.verdict(self.h([100, 90])), ("기록 중 (2일째)", False))
        self.assertEqual(PR.verdict(self.h([100] * 6 + [90]))[0], "기록상 최저가")
        self.assertEqual(PR.verdict(self.h([100] * 6 + [102]))[0], "최저가 근처")
        self.assertEqual(PR.verdict(self.h([100] * 6 + [120]))[0], "최저보다 20% 비쌈")

    def test_spark(self):
        self.assertEqual(PR.spark(self.h([100])), "")
        self.assertIn("<polyline", PR.spark(self.h([100, 120, 90])))
        self.assertEqual(PR.product_block(None), "")


if __name__ == "__main__":
    unittest.main()
