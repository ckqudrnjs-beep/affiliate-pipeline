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
            for name in ("feed", "index", "archive", "rank", "games/spot", "games/dodge", "games/stop", "games/chosung", "games/reaction", "games/majority", "privacy"):
                self.assertTrue((Path(d) / (f"{name}.xml" if name == "feed" else f"{name}.html")).exists(), name)
            self.assertNotIn(".html", (Path(d) / "sitemap.xml").read_text(encoding="utf-8"))
            self.assertTrue((Path(d) / "og.png").exists())
            self.assertIn('"VideoGame"', (Path(d) / "games" / "spot.html").read_text(encoding="utf-8"))

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

    def _build(self, cfg_over=None, stats=None):
        import json as _j
        orig = (ROOT / "playground" / "config.json").read_text(encoding="utf-8")
        cfg = _j.loads(orig); cfg.update(cfg_over or {})
        d = tempfile.mkdtemp()
        pg.build(Path(d), upto=date(2030, 1, 1), stats=stats, cfg=cfg)
        return Path(d)

    def test_every_page_sends_visit_beacon(self):
        # 2026-11-16: /en/sky(레딧 유입)가 page()를 안 거쳐 방문자 신호가 빠져 있었다 → 모든 공개 HTML에 있어야 한다
        d = self._build()
        miss = [str(f.relative_to(d)) for f in d.rglob("*.html") if "nr_vday" not in f.read_text(encoding="utf-8")]
        self.assertEqual(miss, [])
        self.assertIn('var VH="5raksil.com"', (d / "en" / "sky.html").read_text(encoding="utf-8"))

    def test_ads_hidden_without_ids(self):
        d = self._build({"adsensePublisherId": "", "adsenseSlot": "", "adfitUnit": "", "adfitUnitPc": ""})
        for f in ("index.html", "games/spot.html", "q/20261112-1.html"):
            t = (d / f).read_text(encoding="utf-8")
            self.assertNotIn('class="ad"', t); self.assertNotIn("<!--AD-->", t); self.assertNotIn("daumcdn", t)
        self.assertFalse((d / "ads.txt").exists())

    def test_adfit_then_adsense(self):
        d = self._build({"adfitUnit": "DAN-test1", "adfitUnitPc": "DAN-test2"})
        t = (d / "q" / "20261112-1.html").read_text(encoding="utf-8")
        self.assertIn('data-m="DAN-test1"', t); self.assertIn("daumcdn.net/kas/static/ba.min.js", t); self.assertIn("<small>광고</small>", t)
        d = self._build({"adsensePublisherId": "ca-pub-123", "adsenseSlot": "999", "adfitUnit": "DAN-test1"})
        t = (d / "games" / "spot.html").read_text(encoding="utf-8")
        self.assertIn('data-ad-client="ca-pub-123"', t); self.assertIn('data-ad-slot="999"', t); self.assertNotIn("ca-ca-", t)
        self.assertIn("pub-123, DIRECT", (d / "ads.txt").read_text(encoding="utf-8"))

    def test_stats_and_report(self):
        qs = pg.load_questions({"questionsPerDay": 3}, date(2030, 1, 1))
        stats = {q["id"]: {"a": 20 + i, "b": 15 + 3 * i, "r1": 4} for i, q in enumerate(qs[:8])}
        d = self._build(stats=stats)
        t = (d / "q" / f"{qs[0]['id']}.html").read_text(encoding="utf-8")
        self.assertIn("35명이 투표했어요", t)
        self.assertIn("다음 밸런스게임", t)
        r = (d / "report.html").read_text(encoding="utf-8")
        self.assertIn("가장 팽팽했던 질문", r)
        self.assertIn("/report", (d / "sitemap.xml").read_text(encoding="utf-8"))
        d = self._build(stats={qs[0]["id"]: {"a": 3, "b": 1}})
        self.assertFalse((d / "report.html").exists())
        self.assertNotIn("명이 투표했어요", (d / "q" / f"{qs[0]['id']}.html").read_text(encoding="utf-8"))

    def test_guides_built_linked_indexed(self):
        d = self._build()
        sm = (d / "sitemap.xml").read_text(encoding="utf-8")
        gdir = ROOT / "playground" / "guides"
        for f in gdir.glob("*.md"):
            page = (d / "guide" / f"{f.stem}.html").read_text(encoding="utf-8")
            self.assertNotIn("noindex", page)
            self.assertIn(f"/guide/{f.stem}</loc>", sm)
            self.assertIn('"@type": "Article"', page)
        self.assertIn("/guide</loc>", sm)
        game = (d / "games" / "dodge.html").read_text(encoding="utf-8")
        self.assertIn('href="/guide/dodge"', game)
        self.assertIn('href="/guide"', (d / "index.html").read_text(encoding="utf-8"))

    def test_guide_markdown_and_near_duplicate_block(self):
        html, toc = pg.md_html("## 가\n문단 **굵게** [링크](/games)\n\n- 하나\n- 둘\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> 팁")
        self.assertEqual(toc, [("s1", "가")])
        for part in ("<b>굵게</b>", '<a href="/games">링크</a>', "<ul", "<table", 'class="gtip"'):
            self.assertIn(part, html)
        self.assertNotIn("<script", pg.md_html("<script>x</script>")[0])
        a = {"slug": "a", "title": "A", "text": "같은 문장이 계속 반복되는 공략 글입니다. " * 30}
        b = {"slug": "b", "title": "B", "text": "같은 문장이 계속 반복되는 공략 글입니다. " * 29 + "끝"}
        with self.assertRaises(ValueError):
            pg.guide_check([a, b])


if __name__ == "__main__":
    unittest.main()
