import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("indexnow", ROOT / "scripts/indexnow.py")
ix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ix)


class IndexNowTest(unittest.TestCase):
    def test_key_file_matches(self):
        f = ROOT / "playground/static" / f"{ix.KEY}.txt"
        self.assertEqual(f.read_text(), ix.KEY)

    def test_changed_files_to_urls(self):
        u = ix.urls_for_changed(["playground/guides/dodge.md", "playground/games/bag/game.js",
                                 "playground/guides/en/sky.md", "playground/build.py"])
        self.assertEqual(u, {"https://5raksil.com/guide/dodge", "https://5raksil.com/games/bag",
                             "https://5raksil.com/en/guide/sky"})

    def test_pick_only_sitemap_urls(self):
        live = ["https://5raksil.com/", "https://5raksil.com/games/bag", "https://5raksil.com/guide/new"]
        seen = {"https://5raksil.com/", "https://5raksil.com/games/bag"}
        changed = {"https://5raksil.com/games/bag", "https://5raksil.com/q/123"}  # q 는 사이트맵에 없음 → 안 보냄
        self.assertEqual(ix.pick(live, seen, changed, False),
                         ["https://5raksil.com/games/bag", "https://5raksil.com/guide/new"])
        self.assertEqual(ix.pick(live, seen, set(), True), live)

    def test_sitemap_parse(self):
        xml = "<urlset><url><loc>https://5raksil.com/</loc></url><url><loc> https://5raksil.com/games </loc></url></urlset>"
        self.assertEqual(ix.sitemap_urls(xml), ["https://5raksil.com/", "https://5raksil.com/games"])


if __name__ == "__main__":
    unittest.main()
