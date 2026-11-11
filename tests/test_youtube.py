import datetime as dt
import pathlib
import unittest

from pipeline import youtube as yt

KST = yt.KST


class YoutubeTest(unittest.TestCase):
    def test_queue_passes_compliance_and_files_exist(self):
        for row in yt.load_queue():
            desc = yt.build_description(row)
            self.assertEqual(yt.check(row, desc), [], row["slug"])
            self.assertTrue((yt.MEDIA / f"{row['slug']}.mp4").exists(), row["slug"])

    def test_check_rejects_missing_disclosure(self):
        row = {"title": "딸깍 스탠드", "intro": "x", "price_date": "11/9"}
        self.assertIn("제목이 [광고]로 시작하지 않음", yt.check(row, yt.build_description(row)))
        self.assertTrue(yt.check({"title": "[광고] a"}, "설명\n광고"))

    def test_first_slot_is_tomorrow_evening(self):
        now = dt.datetime(2026, 11, 9, 10, 0, tzinfo=KST)
        self.assertEqual(yt.next_slot({}, now, 2), dt.datetime(2026, 11, 10, 19, 0, tzinfo=KST))

    def test_slots_are_spaced(self):
        now = dt.datetime(2026, 11, 10, 10, 0, tzinfo=KST)
        log = {"a": {"publish_at": "2026-11-10T19:00:00+09:00"}}
        self.assertEqual(yt.next_slot(log, now, 2), dt.datetime(2026, 11, 12, 19, 0, tzinfo=KST))

    def test_pick_skips_uploaded(self):
        q = [{"slug": "a"}, {"slug": "b"}]
        self.assertEqual(yt.pick(q, {"a": {}})["slug"], "b")
        self.assertIsNone(yt.pick(q, {"a": {}, "b": {}}))

    def test_body_is_private_scheduled(self):
        row = yt.load_queue()[0]
        body = yt.video_body(row, yt.build_description(row), dt.datetime(2026, 11, 10, 19, 0, tzinfo=KST))
        self.assertEqual(body["status"]["privacyStatus"], "private")
        self.assertEqual(body["status"]["publishAt"], "2026-11-10T10:00:00Z")
        self.assertFalse(body["status"]["selfDeclaredMadeForKids"])


if __name__ == "__main__":
    unittest.main()


class SyntheticTest(unittest.TestCase):
    def test_synthetic_row(self):
        row = {"title": "[광고] x", "intro": "y", "price_date": "11/11", "synthetic": "1"}
        body = yt.video_body(row, yt.build_description(row), None)
        self.assertTrue(body["status"]["containsSyntheticMedia"])
        self.assertIn("가상 인물", yt.build_description(row))
        self.assertFalse(yt.is_synthetic({"synthetic": None}))
