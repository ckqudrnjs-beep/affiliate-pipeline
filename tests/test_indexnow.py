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

    def test_don3chon_key_file_matches(self):
        k = ix.SITES["don3chon"]["key"]
        self.assertEqual((ROOT / "static" / f"{k}.txt").read_text(), k)

    def test_lastmod_change_sends_again(self):
        xml = ("<urlset><url><loc>https://don3chon.com/guide/a</loc><lastmod>2026-11-28</lastmod></url>"
               "<url><loc>https://don3chon.com/guide/b</loc><lastmod>2026-11-20</lastmod></url>"
               "<url><loc>https://don3chon.com/calc/heater</loc><lastmod>2026-11-28</lastmod></url>"
               "<url><loc>https://don3chon.com/guide/new</loc><lastmod>2026-11-28</lastmod></url></urlset>")
        live = ix.sitemap_entries(xml)
        seen = ix.read_seen("https://don3chon.com/guide/a 2026-11-27\nhttps://don3chon.com/guide/b 2026-11-20\n"
                            "https://don3chon.com/calc/heater 2026-11-27\n")
        self.assertEqual(ix.pick(live, seen, set(), False, ix.SITES["don3chon"]["lastmod_ignore"]),
                         ["https://don3chon.com/guide/a", "https://don3chon.com/guide/new"])
        # 옛 형식(주소만) 목록이면 날짜를 모르니 새 주소만
        old = ix.read_seen("https://don3chon.com/guide/a\nhttps://don3chon.com/guide/b\nhttps://don3chon.com/calc/heater\n")
        self.assertEqual(ix.pick(live, old, set(), False), ["https://don3chon.com/guide/new"])
        self.assertEqual(ix.read_seen(ix.write_seen(live)), live)

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
