import json
import pathlib
import tempfile
import unittest

from pipeline import yt_extras


class YtExtras(unittest.TestCase):
    def test_related_line(self):
        self.assertEqual(yt_extras.related_line("t", None), "")
        self.assertIn("https://youtu.be/abc", yt_extras.related_line("주간 챌린지", "abc"))

    def test_latest_by_key_date(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "l.json"
            p.write_text(json.dumps({"2026-11-21": {"id": "a", "title": "1"}, "2026-11-28": {"id": "b", "title": "2"},
                                     "2026-11-30": {"skipped": True}}))
            self.assertEqual(yt_extras.latest(p), ("2", "b"))
            self.assertEqual(yt_extras.latest(pathlib.Path(d) / "none.json"), (None, None))

    def test_wide_thumb_and_jpeg(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            src = pathlib.Path(d) / "c.png"
            Image.new("RGB", (1000, 1000), (200, 50, 50)).save(src)
            out = yt_extras.wide_from_square(src, pathlib.Path(d) / "w.jpg")
            self.assertEqual(Image.open(out).size, (1280, 720))
            self.assertLess(len(yt_extras.jpeg_bytes(out)), yt_extras.MAX_BYTES)

    def test_set_thumbnail_missing_file(self):
        self.assertFalse(yt_extras.set_thumbnail("t", "v", None))


if __name__ == "__main__":
    unittest.main()
