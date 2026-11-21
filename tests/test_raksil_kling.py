import datetime as dt
import pathlib
import tempfile
import unittest

from pipeline import raksil_kling as rk
from pipeline import raksil_games as rg

G = [{"slug": s, "name": s, "short": "", "order": i} for i, s in enumerate(["dodge", "tower", "survivor"])]
MON, TUE, WED = dt.date(2026, 11, 23), dt.date(2026, 11, 24), dt.date(2026, 11, 25)


def cfg(root: pathlib.Path, on=True):
    for n in ("h1", "h2", "p1", "p2", "s1", "s2"):
        (root / f"{n}.mp4").write_bytes(b"x")
    return {"on": on, "react_games": ["dodge", "tower"], "react_tops": ["이 판 끝까지 봐"],
            "react_hook": [{"id": "h1", "file": "h1.mp4"}, {"id": "h2", "file": "h2.mp4"}],
            "react_pay": [{"id": "p1", "file": "p1.mp4"}, {"id": "p2", "file": "p2.mp4"}],
            "situ": [{"id": "s1", "game": "survivor", "top": "라면 3분", "file": "s1.mp4", "pay": {"file": "s1.mp4"}},
                     {"id": "s2", "game": "nope", "top": "x", "file": "s2.mp4", "pay": {"file": "s2.mp4"}}]}


class T(unittest.TestCase):
    def test_off_or_wrong_day(self):
        with tempfile.TemporaryDirectory() as d:
            r = pathlib.Path(d)
            self.assertIsNone(rk.pick(MON, {}, G, {}, cfg(r, on=False), r))
            self.assertIsNone(rk.pick(TUE, {}, G, {}, cfg(r), r))

    def test_react_first_then_situ(self):
        with tempfile.TemporaryDirectory() as d:
            r = pathlib.Path(d)
            a = rk.pick(MON, {}, G, {}, cfg(r), r)
            self.assertEqual(a["format"], "react")
            self.assertEqual(a["game"], "dodge")  # 가장 오래 안 나온 게임(동률이면 목록 순)
            log = {"2026-11-23-game-dodge": {"kling": {"format": "react", "ids": a["ids"]}}}
            b = rk.pick(WED, log, G, {"dodge": "2026-11-23"}, cfg(r), r)
            self.assertEqual((b["format"], b["game"], b["ids"]), ("situ", "survivor", ["s1"]))  # 게임 없는 s2 제외

    def test_recent_clips_not_reused(self):
        with tempfile.TemporaryDirectory() as d:
            r = pathlib.Path(d)
            c = cfg(r)
            c["situ"] = []
            log = {"2026-11-20-game-x": {"kling": {"format": "situ", "ids": ["h1", "p1"]}}}
            a = rk.pick(MON, log, G, {}, c, r)
            self.assertEqual(a["ids"], ["h2", "p2"])
            log["2026-11-21-game-y"] = {"kling": {"format": "react", "ids": ["h2", "p2"]}}
            self.assertIsNone(rk.pick(WED, log, G, {}, c, r))  # 클립이 모자라면 쉼(예전 규칙)

    def test_missing_files_skip(self):
        with tempfile.TemporaryDirectory() as d:
            r = pathlib.Path(d)
            c = cfg(r)
            for f in r.glob("*.mp4"):
                f.unlink()
            self.assertIsNone(rk.pick(MON, {}, G, {}, c, r))

    def test_description_and_title(self):
        g = {"slug": "dodge", "name": "별똥별 피하기", "short": "피하기"}
        kl = {"format": "react"}
        desc = rg.description_of(g, "kling", False, kl)
        self.assertIn("?ref=yt-react", desc)
        self.assertIn("AI(Kling)", desc)
        self.assertEqual(desc.count("/games/dodge"), 1)
        self.assertTrue(rg.title_of(g, "kling", "이 판 끝까지 봐").startswith("이 판 끝까지 봐 | 별똥별 피하기"))

    def test_shipped_config_is_off(self):
        self.assertFalse(rk.load().get("on"))


if __name__ == "__main__":
    unittest.main()
