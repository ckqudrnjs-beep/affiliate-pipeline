import datetime as dt
import json
import pathlib
import tempfile
import importlib.util
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

    def test_rotation_off_only_new_games(self):
        games = G + [{"slug": "tower", "name": "하늘 탑 쌓기", "short": "", "order": 9}]
        self.assertEqual(rg.plan(MON, G, {}, rotation=False), ("none", None, None))
        self.assertEqual(rg.plan(THU, G, {}, rotation=False), ("none", None, None))
        self.assertEqual(rg.plan(THU, games, {}, rotation=False), ("game", "tower", "new"))
        self.assertFalse(rg.rotation_on(pathlib.Path("/nonexistent.json")))

    def test_challenge_hook_with_score(self):
        g = G[0]
        self.assertEqual(rg.hook_of(g, SAT, 1240), "1,240점 넘을 수 있어?")
        self.assertIn(rg.hook_of(g, SAT, None), rg.HOOKS)
        self.assertIn(rg.hook_of(g, SAT, 0), rg.HOOKS)

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

    def test_hold(self):
        games = G + [{"slug": "tower", "name": "하늘 탑 쌓기", "short": "", "order": 9}]
        self.assertEqual(rg.plan(SAT, games, {}, hold=True), ("none", None, None))
        self.assertEqual(rg.plan(THU, games, {}, hold=True), ("none", None, None))
        self.assertEqual(rg.plan(MON, games, {}, hold=True), ("none", None, None))
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "h.json"
            self.assertFalse(rg.hold_new(p))
            p.write_text('{"hold_new": true}', encoding="utf-8")
            self.assertTrue(rg.hold_new(p))

    def test_history_includes_range(self):
        h = rg.history({"2026-11-16-range": {}, "2026-11-13": {}, "2026-11-20-game-tower-new": {}})
        self.assertEqual(h, {"range": "2026-11-16", "tower": "2026-11-20"})

    def test_texts(self):
        g = {"slug": "tower", "name": "하늘 탑 쌓기", "short": "블록 쌓기", "order": 1}
        self.assertIn("[신작]", rg.title_of(g, "new"))
        self.assertLessEqual(len(rg.title_of(g, "play")), 100)
        d = rg.description_of(g, "new", True)
        self.assertIn("https://5raksil.com/games/tower", d)
        self.assertIn("AI 음성", d)

    # 2026-11-16 별사탕 합치기 밑부분 잘림 → 업로드 전 화면 검사
    def test_check_record_cut(self):
        self.assertEqual(rg.check_record({"cut": 0, "cut_end": 0.004}), [])
        self.assertTrue(rg.check_record({"cut": 0.16}))  # 그날 별사탕: 775px 중 123px 잘림
        self.assertTrue(rg.check_record({"cut": 0, "cut_end": 0.05}))

    # Pillow 는 쇼츠·인스타 워크플로에만 설치된다 → 거기서 돌고, 가벼운 워크플로(curate 등)에서는 건너뜀
    @unittest.skipUnless(importlib.util.find_spec("PIL"), "Pillow 없음")
    def test_layout_in_safe_area(self):
        for size in ((912, 1550), (1080, 1920), (1080, 1080), (1920, 1080), (300, 2000)):
            self.assertEqual(rg.check_layout(size), [], size)
        self.assertLessEqual(rg.BOX[3], rg.SAFE[3])
        self.assertLess(rg.SUB_Y + 60, rg.BOX[1])

    def test_sample_times_skip_hook(self):
        ts = rg.sample_times(390)
        self.assertEqual(len(ts), 4)
        self.assertGreaterEqual(min(ts), int(3.2 * rg.FPS))
        self.assertLess(max(ts), 390)
        self.assertEqual(rg.sample_times(60), [])


if __name__ == "__main__":
    unittest.main()
