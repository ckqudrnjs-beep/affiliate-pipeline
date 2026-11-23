import datetime as dt
import json
import pathlib
import tempfile
import unittest

from pipeline import first_comment as fc

KST = fc.KST


class T(unittest.TestCase):
    def test_targets_only_published_recent(self):
        with tempfile.TemporaryDirectory() as d:
            r = pathlib.Path(d)
            (r / "data/youtube").mkdir(parents=True)
            (r / "data/music").mkdir(parents=True)
            (r / "data/youtube/uploaded.json").write_text(json.dumps({
                "a": {"video_id": "U1", "publish_at": "2026-11-24T19:00:00+09:00"},
                "b": {"video_id": "U2", "publish_at": "2026-11-26T19:00:00+09:00"},  # 아직 공개 전
                "c": {"video_id": "U3", "publish_at": "2026-11-10T19:00:00+09:00"}}))  # 오래됨
            (r / "data/youtube/raksil_uploaded.json").write_text(json.dumps({
                "2026-11-24": {"id": "R1", "format": "quick"}, "2026-11-25": {"skipped": True},
                "2026-11-24-game-x": {"id": "G1"}}))
            (r / "data/music/uploaded.json").write_text(json.dumps({
                "_old": [{"video_id": "X"}],
                "s": {"video_id": "M1", "publish_at": "2026-11-23T19:00:00+09:00", "short_id": "M2", "short_publish_at": "private"}}))
            now = dt.datetime(2026, 11, 25, 9, tzinfo=KST)
            got = {(c, v) for c, v, _ in fc.targets(now, r)}
            self.assertEqual(got, {("uncle", "U1"), ("5raksil", "R1"), ("music", "M1")})
            texts = {v: t for _, v, t in fc.targets(now, r)}
            self.assertIn("AAB", texts["R1"])

    def test_texts_policy(self):
        for t in fc.TEXT.values():
            for w in ("드려요", "보상", "선물", "돈", "금화", "안 하면"):
                self.assertNotIn(w, t)


if __name__ == "__main__":
    unittest.main()
