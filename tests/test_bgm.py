"""쇼츠 BGM (docs/BGM.md, BK 2026-11-20): 곡 설정·돌려 쓰기·박자 맞춤.
numpy 없이 돈다. ffmpeg 로 실제 섞는 테스트만 skipUnless."""
import datetime as dt
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from pipeline import bgm  # noqa: E402

NEED_FFMPEG = unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg 없음")


class ConfigTest(unittest.TestCase):
    def test_tracks_exist_and_sane(self):
        c = bgm.cfg()
        self.assertEqual(len(c["tracks"]), 7)
        for slug, t in c["tracks"].items():
            f = ROOT / t["file"]
            self.assertTrue(f.exists(), f)
            self.assertLess(f.stat().st_size, 4_000_000, f"{slug}: 128kbps 로 줄여서 넣기")
            self.assertTrue(60 <= t["bpm"] <= 200, slug)
            self.assertTrue(t["starts"] and t["starts"][0] == t["bar0"], slug)
            for s in t["starts"]:
                self.assertLessEqual(s + 40, t["seconds"], f"{slug}: 시작 후보 뒤로 40초는 남아야 함")

    def test_kinds_use_own_channel(self):
        c = bgm.cfg()
        for kind, k in c["kinds"].items():
            self.assertEqual(len(set(k["order"])), len(k["order"]), kind)
            for s in k["order"]:
                self.assertEqual(c["tracks"][s]["channel"], k["channel"], f"{kind}: {s}")
        for k in ("meme", "live"):  # 밈은 자체 음악, 실사 특별편은 아직 (docs/BGM.md 1장)
            self.assertNotIn(k, c["kinds"])
            self.assertIn(k, c["no_bgm"])


class PickTest(unittest.TestCase):
    def test_consecutive_episodes_differ(self):
        d = dt.date(2026, 11, 22)
        for kind, step in (("toon", 2), ("balance", 1), ("game", 1)):
            got = [bgm.pick(kind, d + dt.timedelta(days=i * step))["slug"] for i in range(8)]
            for a, b in zip(got, got[1:]):
                self.assertNotEqual(a, b, kind)
            n = len(bgm.cfg()["kinds"][kind]["order"])
            self.assertEqual(len(set(got[:n])), n, f"{kind}: {n}편 안에 모든 곡")

    def test_same_day_raksil_differs(self):
        for i in range(30):
            d = dt.date(2026, 11, 20) + dt.timedelta(days=i)
            self.assertNotEqual(bgm.pick("balance", d)["slug"], bgm.pick("game", d)["slug"], d)

    def test_second_lap_starts_elsewhere(self):
        d = dt.date(2026, 11, 21)
        a, b = bgm.pick("balance", d), bgm.pick("balance", d + dt.timedelta(days=4))
        self.assertEqual(a["slug"], b["slug"])
        if len(a["starts"]) > 1:
            self.assertNotEqual(a["start"], b["start"])

    def test_no_bgm_kind(self):
        for k in ("meme", "live"):
            self.assertIsNone(bgm.pick(k, dt.date(2026, 11, 21)))


class DingTest(unittest.TestCase):
    def test_uncle_tracks_have_ding_pitch(self):  # BK 11/20 '띵'은 맑게, 곡 음높이에 맞춰
        for slug, t in bgm.cfg()["tracks"].items():
            if t["channel"] == "uncle":
                self.assertTrue(1000 <= t.get("ding_hz", 0) <= 2400, slug)


class SnapTest(unittest.TestCase):
    tr = {"bpm": 120.0}  # 1박 0.5초

    def test_snap(self):
        self.assertEqual(bgm.snap(1.2, self.tr), 1.0)
        self.assertEqual(bgm.snap(1.2, self.tr, 1, "up"), 1.5)
        self.assertEqual(bgm.snap(1.2, self.tr, 2), 1.25)
        self.assertEqual(bgm.snap(1.2, None), 1.2)

    def test_snap_len_respects_clip(self):
        self.assertEqual(bgm.snap_len(6.4, self.tr), 6.5)
        self.assertEqual(bgm.snap_len(6.4, self.tr, most=6.3), 6.0)
        self.assertEqual(bgm.snap_len(0.3, self.tr), 1.0)  # 최소 2박

    def test_filter_graph(self):
        tr = {**bgm.pick("balance", dt.date(2026, 11, 21))}
        g = bgm.filter_graph(tr, 12.0, True)
        self.assertIn("sidechaincompress", g)
        self.assertIn("afade=t=out:st=10.800", g)
        self.assertNotIn("sidechaincompress", bgm.filter_graph({**tr, "duck": False}, 30, True))


@NEED_FFMPEG
class MixTest(unittest.TestCase):
    def test_mix_keeps_length_and_adds_audio(self):
        with tempfile.TemporaryDirectory() as td:
            mp4 = pathlib.Path(td) / "a.mp4"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=108x192:d=4",
                            "-f", "lavfi", "-i", "sine=f=440:d=4", "-shortest", "-c:v", "libx264", "-c:a", "aac", str(mp4)],
                           check=True)
            bgm.mix(mp4, bgm.pick("balance", dt.date(2026, 11, 21)))
            self.assertAlmostEqual(bgm.duration(mp4), 4.0, delta=0.15)
            self.assertTrue(bgm.has_audio(mp4))


if __name__ == "__main__":
    unittest.main()
