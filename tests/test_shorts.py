import datetime as dt
import unittest

from pipeline import shorts as s
from pipeline import youtube as yt


def spec(**kw):
    d = {"slug": "usb-heated-blanket", "category": "heat", "name": "USB 온열 담요", "title": "무릎이 시린 사무실이라면",
         "hook": "사무실 의자, 무릎이 시리다면?", "intro": "USB로 켜는 1인용 온열 담요예요",
         "captions": ["보조배터리로도 켜져요", "1인용", "USB 5V"],
         "note": "사무실에서 무릎을 덮는 1인용 USB 온열 담요예요. 판매 150개, 평점 95%라 후기를 먼저 읽어 보세요.",
         "check": "USB 출력 5V 2A 이상", "lifeMonths": 24}
    d.update(kw)
    return d


class ShortsTest(unittest.TestCase):
    def test_numbers(self):
        self.assertEqual(s.ko_number(4700), "사천칠백")
        self.assertEqual(s.ko_number(125000), "십이만 오천")
        self.assertEqual(s.ko_number(10000), "만")
        self.assertEqual(s.ko_count(4), "네")
        self.assertEqual(s.ko_count(12), "열두")
        self.assertEqual(s.ko_count(20), "스무")

    def test_calc_power_and_fallback(self):
        c = s.calc_card({"type": "power", "watts": 10, "hours_per_day": 4}, 21450)
        self.assertEqual(c["value"], "약 240원")
        self.assertIn("네 시간", c["say"])
        bad = s.calc_card({"type": "power", "watts": 99999, "hours_per_day": 4}, 120000)
        self.assertEqual(bad["title"], "하루로 나누면")  # 말이 안 되는 값이면 하루 비용으로
        u = s.calc_card({"type": "per_use", "uses_per_month": 12, "life_months": 24}, 58300)
        self.assertEqual(u["value"], "약 200원")

    def test_copy_check(self):
        self.assertEqual(s.check_copy(spec()), [])
        self.assertTrue(s.check_copy(spec(note="짧음")))
        self.assertTrue(s.check_copy(spec(intro="직접 써봤는데 좋아요")))
        self.assertTrue(s.check_copy(spec(slug="USB 담요")))
        self.assertTrue(s.check_copy(spec(category="toy")))

    def test_queue_row_passes_upload_check(self):
        sp = spec(aliPrice=21450)
        row = s.queue_row(sp, 7, dt.date(2026, 11, 10))
        self.assertTrue(row["title"].startswith("[광고]"))
        self.assertEqual(yt.check(row, yt.build_description(row)), [])


if __name__ == "__main__":
    unittest.main()
