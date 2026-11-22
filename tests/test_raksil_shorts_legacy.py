import datetime as dt
import unittest

from pipeline import raksil_shorts_legacy as L

QS = [{"id": "20261113-1", "date": "2026-11-13", "a": "평생 라면만", "b": "평생 치킨만"},
      {"id": "20261113-2", "date": "2026-11-13", "a": "x", "b": "y"}]


class LegacyTest(unittest.TestCase):
    """11/19 옛 형식 비교용 (RAKSIL_FORMAT=legacy). 옛 동작이 그대로인지만 본다."""

    def test_first_question_and_old_script(self):
        q = L.pick_question(QS, dt.date(2026, 11, 13))
        self.assertEqual(q["id"], "20261113-1")
        lines = L.script(q, None)
        self.assertEqual(len(lines), 4)  # 질문 · 3·2·1 · 정답은 없어 · 구독 한 줄
        self.assertIn("구독", lines[3])

    def test_title_and_description(self):
        self.assertLessEqual(len(L.title_of(QS[0])), 100)
        self.assertIn("https://5raksil.com/q/20261113-1", L.description_of(QS[0], None, True))



class PickTest(unittest.TestCase):
    def test_ab_window(self):
        import datetime as dt
        from pipeline import raksil_shorts_legacy as L
        self.assertEqual(L.pick(dt.date(2026, 11, 22)), "new")
        self.assertEqual(L.pick(dt.date(2026, 11, 23)), "new")  # 11/22 고정 기간: 비교 끝
        self.assertEqual(L.pick(dt.date(2026, 11, 28)), "new")
        self.assertEqual(L.pick(dt.date(2026, 11, 29)), "new")
        self.assertEqual(L.pick(dt.date(2026, 11, 30)), "new")
        self.assertEqual(L.pick(dt.date(2026, 11, 21)), "new")
        self.assertEqual(L.pick(dt.date(2026, 11, 22), "legacy"), "legacy")
        self.assertEqual(L.pick(dt.date(2026, 11, 23), "split"), "new")


if __name__ == "__main__":
    unittest.main()
