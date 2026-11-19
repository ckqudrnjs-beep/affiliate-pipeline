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
        for s in spec["scenes"]:  # 11/24 편은 실사로 다시 만들어 clip 이 있음 → 지워서 '첫 줄 clip 필요' 확인
            for ln in s.get("lines", []):
                ln.pop("clip", None)
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


    def test_ai_pick_rotation(self):
        import datetime as dt
        clips = [{"id": "ai-dongjeon-01", "file": "a.mp4", "scene": "dongjeon", "tool": "Veo"},
                 {"id": "ai-dongjeon-02", "file": "b.mp4", "scene": "dongjeon", "realistic": True},
                 {"id": "ai-boiler-01", "file": "c.mp4", "scene": "boiler"}]
        day = dt.date(2026, 11, 25)
        a = live.ai_pick("dongjeon", day, set(), clips, used={})
        self.assertEqual((a["id"], a["credit"], a["ai"]), ("ai-dongjeon-01", "AI 생성(Veo)", True))
        a = live.ai_pick("dongjeon", day, set(), clips, used={"ai-dongjeon-01": "2026-11-20"})
        self.assertEqual(a["id"], "ai-dongjeon-02")
        self.assertTrue(a["realistic"])
        # 둘 다 7일 안에 썼으면 없음 → 스톡/앞 장면
        self.assertIsNone(live.ai_pick("dongjeon", day, set(), clips,
                                       used={"ai-dongjeon-01": "2026-11-20", "ai-dongjeon-02": "2026-11-22"}))
        # 8일 지나면 오래된 것부터 다시
        a = live.ai_pick("dongjeon", day, set(), clips, used={"ai-dongjeon-01": "2026-11-10", "ai-dongjeon-02": "2026-11-12"})
        self.assertEqual(a["id"], "ai-dongjeon-01")
        self.assertIsNone(live.ai_pick("snow-street", day, set(), clips, used={}))

    @NEED_RENDER
    def test_render_ai_clip_first_no_keys(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as d:
            tmp = pathlib.Path(d)
            src = tmp / "ai.mp4"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=720x1280:d=1:r=30", str(src)], check=True)
            lines = [dict(LINES[0], clip="dongjeon"), dict(LINES[1], clip="kimjang")]
            clips = [{"id": "ai-dongjeon-01", "file": str(src), "scene": "dongjeon", "tool": "Veo", "realistic": True}]
            cr = []
            fake = [np.zeros(int(0.3 * live.SR), dtype=np.float32)] * 2
            with mock.patch.dict("os.environ", {"PEXELS_API_KEY": "", "PIXABAY_API_KEY": ""}), \
                    mock.patch.object(live, "voices", return_value=fake), mock.patch.object(live, "ai_clips", return_value=clips), \
                    mock.patch.object(live, "USED", tmp / "used.json"):
                self.assertTrue(live.available())
                live.render_part(lines, False, tmp / "o.mp4", tmp, date="2026-11-25", credits=cr)
            self.assertEqual(len(cr), 1)
            self.assertEqual((cr[0]["id"], cr[0]["ai"], cr[0]["realistic"], cr[0]["lines"]), ("ai-dongjeon-01", True, True, [0, 1]))

    def test_youtube_ai_clip_disclosure(self):
        from pipeline import youtube
        with tempfile.TemporaryDirectory() as d:
            ep = pathlib.Path(d)
            spec = {"title": "t?", "description": "설명", "date": "2026-11-25", "kind": "short", "scenes": []}
            (ep / "2026-11-25-skit-calc.json").write_text(json.dumps(spec), encoding="utf-8")
            meta = {"slug": "s", "credits": [{"id": "ai-dongjeon-01", "credit": "AI 생성(Veo)", "page": "", "query": "dongjeon",
                                              "lines": [0], "ai": True, "realistic": True},
                                             {"id": "pixabay-1", "credit": "Pixabay · a", "page": "https://p", "query": "boiler", "lines": [1]}]}
            (ep / "2026-11-25-skit-calc.meta.json").write_text(json.dumps(meta), encoding="utf-8")
            row = youtube.episode_rows(ep)[0]
            self.assertTrue(youtube.is_synthetic(row))
            self.assertEqual(row["credits"], "Pixabay · a https://p")
            desc = youtube.build_description(row)
            self.assertIn("AI로 생성한 영상", desc)
            meta["credits"][0]["realistic"] = False
            (ep / "2026-11-25-skit-calc.meta.json").write_text(json.dumps(meta), encoding="utf-8")
            row = youtube.episode_rows(ep)[0]
            self.assertFalse(youtube.is_synthetic(row))
            self.assertIn("일부 배경 영상은 AI로 생성했어요.", youtube.build_description(row))


if __name__ == "__main__":
    unittest.main()
