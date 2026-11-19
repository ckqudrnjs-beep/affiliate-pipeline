import importlib.util
import json
import pathlib
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

from pipeline import live
from pipeline.episodes import check

# numpy·ffmpeg 는 쇼츠 워크플로에만 있다 → 거기서 돌고, 가벼운 워크플로(daily·curate 등)에서는 건너뜀
NEED_RENDER = unittest.skipUnless(importlib.util.find_spec("numpy") and shutil.which("ffmpeg"), "numpy/ffmpeg 없음")

LINES = [
    {"who": "n", "n": "cold", "cap": ["한파 오는데", "난방비 얼마나 나와?"], "say": "삼촌, 이번 주 한파래.", "clip": "snow-street"},
    {"who": "u", "u": "wow", "cap": ["땡!"], "big": "한 달 약 1만 원", "sub": "1도 낮추면 · 계산기 기본값", "sfx": "buzz",
     "say": "1도만 낮춰도 한 달 약 만 원이야.", "clip": "boiler", "src": "돈삼촌 난방비 계산기"},
]


class LiveTest(unittest.TestCase):
    def test_check_lines(self):
        self.assertEqual(live.check_lines(LINES, {}), [])
        self.assertTrue(live.check_lines([{"who": "u", "say": "x"}], {}))
        self.assertEqual(live.check_lines([{"who": "u", "say": "x"}], {"clip": "grocery-market"}), [])
        self.assertTrue(live.check_lines([{"who": "u", "say": "x", "clip": "snowy street"}], {}))
        four = [{"who": "u", "say": "x", "clip": c} for c in ("boiler", "radiator", "cabbage", "radish")]
        self.assertTrue(any("3개" in x for x in live.check_lines(four, {})))
        self.assertEqual(live.line_clips([{"clip": "boiler"}, {}, {"clip": "radish"}, {}], {}),
                         ["boiler", "boiler", "radish", "radish"])

    def test_relevance_filter(self):
        cfg = live.scenes_cfg()
        sc = cfg["scenes"]["radiator"]
        self.assertFalse(live.relevant("globe, earth, rotation", sc, cfg))
        self.assertFalse(live.relevant("cabin, snow, forest, radiator", sc, cfg))
        self.assertTrue(live.relevant("radiator, heating, home, warm", sc, cfg))
        self.assertTrue(live.relevant("white-radiator-in-a-room-123", sc, cfg))
        c = [{"id": "a", "words": "globe, earth"}, {"id": "b", "words": "radiator, room"}, {"id": "c", "words": "other"}]
        self.assertEqual(live.pick(c, {}, set(), sc, cfg)["id"], "b")
        self.assertEqual(live.pick(c, {}, set(), dict(sc, ok=["c"]), cfg)["id"], "c")
        self.assertIsNone(live.pick(c, {}, set(), sc, dict(cfg, bad=["b"])))

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
        self.assertEqual(c[0]["words"], "p2")
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
                s["clip"] = "warm-blanket"
        self.assertFalse(any("clip" in x for x in check(spec)))

    @NEED_RENDER
    def test_missing_scene_reuses_previous(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as d:
            tmp = pathlib.Path(d)
            src = tmp / "src.mp4"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=720x1280:d=1:r=30", str(src)], check=True)
            cr = []
            fake = [np.zeros(int(0.3 * live.SR), dtype=np.float32)] * 2

            def fetch(q, used, taken, dest):
                if q == "boiler":
                    raise RuntimeError("없음")
                dest.write_bytes(src.read_bytes())
                return {"id": "x1", "credit": "Pixabay · a", "page": "p"}
            with mock.patch.object(live, "voices", return_value=fake), mock.patch.object(live, "fetch", side_effect=fetch):
                live.render_part(LINES, False, tmp / "o.mp4", tmp, date="2026-11-18", credits=cr)
            self.assertEqual(cr[0]["lines"], [0, 1])

    @NEED_RENDER
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
                                         clips={"snow-street": src, "boiler": src}, sheet=tmp / "s.jpg")
            self.assertTrue(out.exists() and out.stat().st_size > 1000)
            self.assertTrue((tmp / "s.jpg").exists())
            self.assertGreater(total, 1)


if __name__ == "__main__":
    unittest.main()
