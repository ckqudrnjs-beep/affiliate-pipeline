import datetime as dt
import json
import pathlib
import tempfile
import unittest

from pipeline import raksil_games as rg

G = [{"slug": "spot", "name": "틀린그림", "short": "", "order": 1},
     {"slug": "range", "name": "네온 사격장", "short": "", "order": 2},
     {"slug": "dodge", "name": "별똥별 피하기", "short": "", "order": 3}]
MON, THU, SAT = dt.date(2026, 11, 16), dt.date(2026, 11, 19), dt.date(2026, 11, 21)


class T(unittest.TestCase):
    def test_discover_reads_meta(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d)
            for slug, order in (("b", 2), ("a", 1)):
                (p / slug).mkdir()
                (p / slug / "meta.json").write_text(json.dumps({"name": slug.upper(), "order": order}), encoding="utf-8")
            (p / "x").mkdir()
            (p / "x" / "meta.json").write_text("{bad", encoding="utf-8")
            self.assertEqual([g["slug"] for g in rg.discover(p)], ["a", "b"])

    def test_old_games_no_intro(self):
        self.assertEqual(rg.plan(SAT, G, {}), ("none", None, None))
        self.assertEqual(rg.plan(MON, G, {}), ("range", None, None))

    def test_new_game_intro_first_any_day(self):
        games = G + [{"slug": "tower", "name": "하늘 탑 쌓기", "short": "", "order": 9}]
        self.assertEqual(rg.plan(SAT, games, {}), ("game", "tower", "new"))
        self.assertEqual(rg.plan(MON, games, {}), ("game", "tower", "new"))
        log = {"2026-11-21-game-tower-new": {"qid": "x"}}
        self.assertEqual(rg.plan(MON, games, log), ("range", None, None))

    def test_thursday_rotation_least_recent(self):
        self.assertEqual(rg.plan(THU, G, {}), ("game", "spot", "play"))
        log = {"2026-11-12-game-spot": {}, "2026-11-05-game-dodge": {}}
        self.assertEqual(rg.plan(THU, G, log), ("game", "dodge", "play"))
        log["2026-11-13-game-dodge"] = {}
        self.assertEqual(rg.plan(THU, G, log), ("game", "spot", "play"))

    def test_history_includes_range(self):
        h = rg.history({"2026-11-16-range": {}, "2026-11-13": {}, "2026-11-20-game-tower-new": {}})
        self.assertEqual(h, {"range": "2026-11-16", "tower": "2026-11-20"})

    def test_texts(self):
        g = {"slug": "tower", "name": "하늘 탑 쌓기", "short": "블록 쌓기", "order": 1}
        self.assertIn("[NEW]", rg.title_of(g, "new"))
        self.assertLessEqual(len(rg.title_of(g, "play")), 100)
        d = rg.description_of(g, "new", True)
        self.assertIn("https://5raksil.com/games/tower", d)
        self.assertIn("AI 음성", d)


if __name__ == "__main__":
    unittest.main()
