"""주간 성과판(pipeline.scoreboard) 묶기·제안 (2026-11-20)."""
import unittest

from pipeline import scoreboard as s


class ScoreboardTest(unittest.TestCase):
    def test_groups(self):
        self.assertEqual(s.uncle_group("ep-2026-11-20-skit-q", {"ep-2026-11-20-skit-q": "toon"}), "캐릭터 영상(toon)")
        self.assertIn("종료", s.uncle_group("ep-2026-11-14-skit-quiz-a", {}))
        self.assertEqual(s.raksil_group("2026-11-19", "a vs b"), "밸런스게임")
        self.assertEqual(s.raksil_group("2026-11-19-game-bag-new", "[신작] 봉투"), "게임 소개")
        self.assertEqual(s.page_kind("https://don3chon.com/calc/heater"), "calc")
        self.assertEqual(s.page_kind("https://5raksil.com/"), "홈")

    def test_suggest_skips_ended_and_flags_low_high(self):
        yt = {"5raksil": {"A": [{"views": 1000}, {"views": 1000}], "B": [{"views": 10}, {"views": 10}],
                          "C": [{"views": 300}, {"views": 300}]},
              "uncle": {"x (예전 형식, 종료)": [{"views": 0}, {"views": 0}], "캐릭터 영상(toon)": [{"views": 100}]}}
        tips = "\n".join(s.suggest(yt))
        self.assertIn("'A'", tips)
        self.assertIn("키우기", tips)
        self.assertIn("'B'", tips)
        self.assertNotIn("종료", tips)

    def test_render_runs_on_repo_data(self):
        text = s.render(__import__("datetime").date(2026, 11, 23), s.youtube_groups(), s.search_groups(), s.api_cost(), [])
        self.assertIn("주간 성과판", text)


if __name__ == "__main__":
    unittest.main()
