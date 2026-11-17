import datetime as dt
import unittest

from pipeline import raksil_meme as rm

TUE, WED, SAT = dt.date(2026, 11, 17), dt.date(2026, 11, 18), dt.date(2026, 11, 21)


class T(unittest.TestCase):
    def test_only_tue_sat(self):
        self.assertIsNone(rm.plan(WED, {}))
        self.assertEqual(rm.plan(TUE, {}), rm.TEMPLATES[0]["id"])
        self.assertIsNotNone(rm.plan(SAT, {}))

    def test_rotates_least_recent(self):
        log = {f"2026-11-1{i}-meme-{t['id']}": {} for i, t in enumerate(rm.TEMPLATES[:2])}
        self.assertEqual(rm.plan(SAT, log), rm.TEMPLATES[2]["id"])
        self.assertEqual(rm.episode(log), 3)

    def test_once_per_day(self):
        self.assertIsNone(rm.plan(TUE, {"2026-11-17-meme-grow": {}}))

    def test_title_and_description(self):
        for t in rm.TEMPLATES:
            self.assertLessEqual(len(rm.title_of(t, 12)), 95)
            d = rm.description_of(t, 1)
            self.assertIn("5raksil.com/games/mongle", d)
            self.assertIn("직접 만들었습니다", d)
            self.assertEqual(len(t["scenes"]), 2)

    def test_moves_stay_on_screen(self):
        for style in ("jump", "side", "spin", "sway", "wiggle", "sleepy", "melt", "shake", "panic", "idle"):
            for i in range(120):
                m = rm.move(style, i / 30)
                self.assertLessEqual(abs(m["dx"]), 300)
                self.assertLessEqual(-m["dy"], 300)
                self.assertGreater(m["sx"], 0)
                self.assertGreater(m["sy"], 0)


if __name__ == "__main__":
    unittest.main()
