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

    def test_action(self):
        self.assertIsNone(PR.action(self.h([100] * 6)))
        self.assertIsNone(PR.action(None))
        self.assertEqual(PR.action(self.h([100] * 6 + [102]))[0], "buy")
        self.assertEqual(PR.action(self.h([100] * 6 + [105]))[0], "ok")
        self.assertEqual(PR.action(self.h([100] * 6 + [110]))[0], "wait")
        # 30일보다 오래된 싼 기록은 판정에 쓰지 않는다
        old = [("2026-09-01", 50)] + self.h([100] * 7)
        self.assertEqual(PR.action(old)[0], "buy")
        self.assertEqual(PR.badge(self.h([100] * 3)), "")
        self.assertIn("기다려 보세요", PR.badge(self.h([100] * 6 + [130])))
        self.assertIn("3일째", PR.buy_box(self.h([100] * 3)))

    def test_spark(self):
        self.assertEqual(PR.spark(self.h([100])), "")
        self.assertIn("<polyline", PR.spark(self.h([100, 120, 90])))
        self.assertEqual(PR.product_block(None), "")


if __name__ == "__main__":
    unittest.main()
