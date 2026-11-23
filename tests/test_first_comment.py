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


class Guard(unittest.TestCase):
    def test_skips_when_token_channel_differs(self):
        from unittest import mock
        posted = []
        with tempfile.TemporaryDirectory() as d, mock.patch.object(fc, "LOG", pathlib.Path(d) / "log.json"), \
                mock.patch.object(fc, "targets", return_value=[("uncle", "V1", "t"), ("music", "V2", "t")]), \
                mock.patch.object(fc, "my_channel", return_value=("UC_UNCLE", "돈 줍는 삼촌")), \
                mock.patch.object(fc, "video_channel", return_value="UC_OTHER"), \
                mock.patch.object(fc, "post", side_effect=lambda *a: posted.append(a)), \
                mock.patch("pipeline.youtube.access_token", return_value="tok"), \
                mock.patch.dict("os.environ", {"YT_CLIENT_ID": "x", "YT_CLIENT_SECRET": "y", "YT_REFRESH_TOKEN": "r",
                                               "MUSIC_YT_REFRESH_TOKEN": "m"}):
            fc.run(dt.datetime(2026, 11, 25, tzinfo=KST))
        self.assertEqual(posted, [])  # 채널 다름 → 안 닮, 노래 채널은 꺼짐

    def test_music_token_blocks_wrong_channel(self):
        from unittest import mock
        from pipeline import music_channel as mc
        with mock.patch("pipeline.youtube.access_token", return_value="tok"), \
                mock.patch.object(fc, "my_channel", return_value=("UC_UNCLE", "돈 줍는 삼촌")), \
                mock.patch.dict("os.environ", {"YT_CLIENT_ID": "x", "YT_CLIENT_SECRET": "y", "MUSIC_YT_REFRESH_TOKEN": "m"}):
            with self.assertRaises(RuntimeError):
                mc.music_token({"channel": "BEEKAY SONGS"})
        with mock.patch("pipeline.youtube.access_token", return_value="tok"), \
                mock.patch.object(fc, "my_channel", return_value=("UC_B", "BEEKAY SONGS")), \
                mock.patch.dict("os.environ", {"YT_CLIENT_ID": "x", "YT_CLIENT_SECRET": "y", "MUSIC_YT_REFRESH_TOKEN": "m"}):
            self.assertEqual(mc.music_token({"channel": "BEEKAY SONGS"}), "tok")


if __name__ == "__main__":
    unittest.main()
