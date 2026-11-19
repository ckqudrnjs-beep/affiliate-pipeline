import os
import tempfile
import unittest
from unittest import mock

from pipeline import drive_backup as db

RAW = """@aaa 2026-11-18T10:00:00+09:00

:000000 100644 0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 A\tmedia/youtube/ep-2026-11-18-teaser.mp4
:000000 100644 0000000000000000000000000000000000000000 2222222222222222222222222222222222222222 A\tmedia/youtube/note.txt
@bbb 2026-11-19T08:00:00+09:00

:100644 100644 1111111111111111111111111111111111111111 3333333333333333333333333333333333333333 M\tplayground/static/img/tongtong-poster.jpg
:000000 100644 0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 A\tmedia/youtube/copy.mp4
"""


class DriveBackupTest(unittest.TestCase):
    def test_category(self):
        self.assertEqual(db.category("media/youtube/a.mp4"), "쇼츠-돈삼촌")
        self.assertEqual(db.category("playground/static/img/x-poster.jpg"), "5락실-포스터")
        self.assertIsNone(db.category("media/youtube/a.json"))
        self.assertIsNone(db.category("src/pipeline/a.png"))

    def test_parse_git_raw_dedups_blobs_and_skips_non_media(self):
        items = db.parse_git_raw(RAW)
        self.assertEqual([i["path"] for i in items],
                         ["media/youtube/ep-2026-11-18-teaser.mp4", "playground/static/img/tongtong-poster.jpg"])
        self.assertEqual(items[1]["date"], "2026-11-19")
        self.assertEqual(items[0]["key"], "git:" + "1" * 40)

    def test_drive_name_prefixes_date_once(self):
        self.assertEqual(db.drive_name({"name": "a.mp4", "date": "2026-11-19"}), "2026-11-19_a.mp4")
        self.assertEqual(db.drive_name({"name": "2026-11-19-range.mp4", "date": "2026-11-19"}), "2026-11-19-range.mp4")

    def test_plan_skips_done_and_caps(self):
        items = [{"key": k} for k in "abcd"]
        todo = db.plan(items, {"a"}, max_files=2, max_bytes=10**9, size_of=lambda i: 1)
        self.assertEqual([i["key"] for i in todo], ["b", "c"])
        todo = db.plan(items, set(), max_files=9, max_bytes=5, size_of=lambda i: 3)
        self.assertEqual([i["key"] for i in todo], ["a"])

    def test_dir_items_date_from_name(self):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "2026-11-19-range.mp4"), "wb").write(b"x" * 5)
            open(os.path.join(d, "2026-11-19-range.txt"), "w").write("설명")
            items = db.dir_items(d, "쇼츠-5락실")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["date"], "2026-11-19")
        self.assertEqual(items[0]["key"], "file:쇼츠-5락실:2026-11-19-range.mp4:5")

    def test_skips_without_token(self):
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(db, "git_items", return_value=[]):
            self.assertEqual(db.main([]), 0)


if __name__ == "__main__":
    unittest.main()
