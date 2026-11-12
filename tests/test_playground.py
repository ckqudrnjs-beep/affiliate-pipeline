import importlib.util
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("pg_build", ROOT / "playground" / "build.py")
pg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pg)


class PlaygroundTest(unittest.TestCase):
    def test_build_all_questions(self):
        with tempfile.TemporaryDirectory() as d:
            r = pg.build(Path(d), upto=date(2030, 1, 1))
            self.assertGreaterEqual(r["questions"], 21)
            for name in ("index", "archive", "rank", "games/spot", "games/dodge", "games/stop", "games/chosung", "games/reaction", "games/majority", "privacy"):
                self.assertTrue((Path(d) / f"{name}.html").exists(), name)
            self.assertNotIn(".html", (Path(d) / "sitemap.xml").read_text(encoding="utf-8"))

    def test_nick_lists_match_score_function(self):
        js = (ROOT / "playground" / "functions" / "api" / "score.js").read_text(encoding="utf-8")
        for w in pg.ADJ + pg.ANI:
            self.assertIn(f'"{w}"', js)
        for g in pg.load_games():
            if g.get("ranked"):
                self.assertIn(f"{g['slug']}:", js)

    def test_future_questions_hidden(self):
        with tempfile.TemporaryDirectory() as d:
            r = pg.build(Path(d), upto=date(2026, 11, 12))
            self.assertEqual(r["today"], "2026-11-12")
            self.assertFalse((Path(d) / "q" / "20261113-1.html").exists())

    def test_validate_blocks_conflict_topics(self):
        q = {"id": "20261112-1", "date": "2026-11-12", "a": "정치 얘기 하기", "b": "안 하기", "note": "테스트"}
        self.assertTrue(any("금지어" in e for e in pg.validate_question(q)))
        q = {"id": "20261113-1", "date": "2026-11-12", "a": "가", "b": "나나", "note": "x"}
        self.assertTrue(pg.validate_question(q))


if __name__ == "__main__":
    unittest.main()
