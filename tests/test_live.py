import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock

from pipeline import live
from pipeline.episodes import check

LINES = [
    {"who": "n", "n": "cold", "cap": ["한파 오는데", "난방비 얼마나 나와?"], "say": "삼촌, 이번 주 한파래.", "clip": "snowy street"},
    {"who": "u", "u": "wow", "cap": ["땡!"], "big": "한 달 약 1만 원", "sub": "1도 낮추면 · 계산기 기본값", "sfx": "buzz",
     "say": "1도만 낮춰도 한 달 약 만 원이야.", "clip": "boiler", "src": "돈삼촌 난방비 계산기"},
]


class LiveTest(unittest.TestCase):
    def test_check_lines(self):
        self.assertEqual(live.check_lines(LINES, {}), [])
        self.assertTrue(live.check_lines([{"who": "u", "say": "x"}], {}))
        self.assertEqual(live.check_lines([{"who": "u", "say": "x"}], {"clip": "grocery store"}), [])
        self.assertTrue(live.check_lines([{"who": "u", "say": "x", "clip": "눈길"}], {}))

    def test_pexels_parse_and_pick(self):
        data = {"videos": [
            {"id": 1, "duration": 2, "url": "p1", "user": {"name": "A"}, "video_files": [{"file_type": "video/mp4", "height": 1920, "link": "a"}]},
            {"id": 2, "duration": 9, "url": "p2", "user": {"name": "B"}, "video_files": [
                {"file_type": "video/mp4", "height": 640, "link": "small"},
                {"file_type": "video/mp4", "height": 2560, "link": "big"},
                {"file_type": "video/mp4", "height": 1280, "link": "mid"}]},
            {"id": 3, "duration": 9, "url": "p3", "user": {"name": "C"}, "video_files": [{"file_type": "video/mp4", "height": 1920, "link": "c"}]}]}
        c = live.pexels_candidates("snow", data)
        self.assertEqual([x["id"] for x in c], ["pexels-2", "pexels-3"])
        self.assertEqual(c[0]["url"], "mid")
        self.assertEqual(c[0]["credit"], "Pexels · B")
        self.assertEqual(live.pick(c, {"pexels-2": "2026-11-18"}, set())["id"], "pexels-3")
        self.assertIsNone(live.pick(c, {"pexels-2": "x"}, {"pexels-3"}))

    def test_pixabay_parse(self):
        data = {"hits": [{"id": 9, "duration": 12, "user": "kim", "pageURL": "u", "videos": {"medium": {"url": "m"}}}]}
        self.assertEqual(live.pixabay_candidates("x", data)[0]["credit"], "Pixabay · kim")

    def test_spec_check_live(self):
        spec = json.loads(pathlib.Path("data/episodes/2026-11-24-skit-calc.json").read_text(encoding="utf-8"))
        spec["style"] = "live"
        self.assertTrue(any("clip" in x for x in check(spec)))
        for s in spec["scenes"]:
            if s["type"] == "skit":
                s["clip"] = "cozy living room"
        self.assertFalse(any("clip" in x for x in check(spec)))

    def test_render_with_local_clip(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as d:
            tmp = pathlib.Path(d)
            src = tmp / "src.mp4"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=720x1280:d=1:r=30", str(src)], check=True)
            out = tmp / "o.mp4"
            fake = [np.zeros(int(0.4 * live.SR), dtype=np.float32)] * 2
            with mock.patch.object(live, "voices", return_value=fake):
                total = live.render_part(LINES, False, out, tmp, badge="1만 원?", date="2026-11-18",
                                         clips={"snowy street": src, "boiler": src})
            self.assertTrue(out.exists() and out.stat().st_size > 1000)
            self.assertGreater(total, 1)


if __name__ == "__main__":
    unittest.main()
