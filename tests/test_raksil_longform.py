import datetime as dt
import importlib.util
import json
import pathlib
import shutil
import tempfile
import unittest

from pipeline import raksil_longform as lf

NEED_RENDER = unittest.skipUnless(importlib.util.find_spec("numpy") and shutil.which("ffmpeg"), "numpy/ffmpeg 없음")

GAMES = [{"slug": s, "name": s.upper(), "unit": "점"} for s in ("a", "b", "c", "d", "e", "f", "g")]
KLING = {"situ": [{"id": "s1", "file": "x.mp4", "pay": {"file": "x.mp4"}}, {"id": "s2", "file": "y.mp4", "pay": {"file": "y.mp4"}},
                  {"id": "s3", "file": "z.mp4", "off": True, "pay": {"file": "z.mp4"}}],
         "react_pay": [{"id": "r1", "file": "r1.mp4"}, {"id": "r2", "file": "r2.mp4"}]}
CFG = {"missions": {"a": ["{s}초 미션", "두 번째"]}, "themes": {"s1": "라면 익는 동안"}}


class PlanTest(unittest.TestCase):
    def test_eligible_needs_final_and_meta(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            for slug, meta in (("x", {"name": "엑스"}), ("y", {"name": "와이"}), ("z", {"name": "제트", "hidden": True})):
                (root / slug).mkdir()
                (root / slug / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
            rec = {"_": "설명", "x": {"final": "1", "final_unit": "층"}, "y": {"hash": "h"}, "z": {"final": "1"}}
            self.assertEqual(lf.eligible(rec, root), [{"slug": "x", "name": "엑스", "unit": "층"}])

    def test_real_config_has_enough_games(self):
        rec = json.loads(pathlib.Path("config/raksil_rec.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(lf.eligible(rec)), lf.ROUNDS + 1)

    def test_overlap_with_last_ep_at_most_one(self):
        log = {}
        day = dt.date(2026, 11, 28)
        for w in range(6):
            p = lf.plan(day, [dict(g) for g in GAMES], log, KLING, CFG)
            main = [g["slug"] for g in p["games"][:lf.ROUNDS]]
            self.assertEqual(len(set(main)), lf.ROUNDS)
            for e in [log[k] for k in sorted(log)][-1:]:
                self.assertLessEqual(len(set(main) & set(e["games"])), lf.MAX_OVERLAP, (w, main, e))
            log[day.isoformat()] = {"games": main, "situ": p["situ"]["id"], "react": p["react"]["id"]}
            day += dt.timedelta(days=7)

    def test_clips_rotate_and_skip_off(self):
        day = dt.date(2026, 11, 28)
        p1 = lf.plan(day, [dict(g) for g in GAMES], {}, KLING, CFG)
        log = {day.isoformat(): {"games": [], "situ": p1["situ"]["id"], "react": p1["react"]["id"]}}
        p2 = lf.plan(day + dt.timedelta(days=7), [dict(g) for g in GAMES], log, KLING, CFG)
        self.assertNotEqual(p1["situ"]["id"], p2["situ"]["id"])
        self.assertNotEqual(p1["react"]["id"], p2["react"]["id"])
        self.assertNotIn("s3", (p1["situ"]["id"], p2["situ"]["id"]))
        self.assertEqual(p2["no"], 2)

    def test_no_plan_without_clips_or_games(self):
        self.assertIsNone(lf.plan(dt.date(2026, 11, 28), GAMES[:3], {}, KLING, CFG))
        self.assertIsNone(lf.plan(dt.date(2026, 11, 28), GAMES, {}, {"situ": [], "react_pay": []}, CFG))

    def test_title_and_description(self):
        p = lf.plan(dt.date(2026, 11, 28), [dict(g, name="아주 긴 게임 이름입니다") for g in GAMES], {}, KLING, CFG)
        self.assertLessEqual(len(lf.title_of(p)), 100)
        d = lf.description_of(p, [(0, "인트로"), (65.2, "ROUND 1 A")])
        self.assertIn("0:00 인트로", d)
        self.assertIn("1:05 ROUND 1 A", d)
        self.assertIn("5raksil.com/?ref=yt-long", d)
        self.assertIn("AI", d)

    def test_publish_saturday_20(self):
        at = lf.publish_at(dt.date(2026, 11, 26))  # 목
        self.assertEqual((at.date(), at.hour), (dt.date(2026, 11, 28), 20))
        self.assertEqual(lf.publish_at(dt.date(2026, 11, 28)).date(), dt.date(2026, 11, 28))

    def test_private_unless_schedule(self):
        meta = {"title": "t", "description": "d", "realistic": False}
        at = lf.publish_at(dt.date(2026, 11, 28))
        self.assertNotIn("publishAt", lf.video_body(meta, "private", at)["status"])
        self.assertIn("publishAt", lf.video_body(meta, "schedule", at)["status"])
        self.assertEqual(lf.video_body(meta, "schedule", at)["snippet"]["categoryId"], "20")

    def test_fmt_num(self):
        self.assertEqual(lf.fmt_num(3565, "점"), "3,565점")
        self.assertEqual(lf.fmt_num(60.0, "층"), "60층")


@NEED_RENDER
class MotionTest(unittest.TestCase):
    def test_motion_end_finds_freeze(self):
        import numpy as np
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            frames = []
            for i in range(300):
                k = min(i, 120)  # 120 프레임 뒤로 멈춤
                a = np.zeros((96, 54), dtype=np.uint8); a[(k * 3) % 96, :] = 255; a[:, (k * 2) % 54] = 255
                p = pathlib.Path(d) / f"f{i:05d}.jpg"; Image.fromarray(a).save(p); frames.append(p)
            end = lf.motion_end(frames)
            self.assertTrue(100 <= end <= 150, end)
