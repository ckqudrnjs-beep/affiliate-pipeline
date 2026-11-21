import importlib.util
import shutil
import unittest

from pipeline import webnovel as w

NEED_RENDER = unittest.skipUnless(importlib.util.find_spec("numpy") and importlib.util.find_spec("PIL") and shutil.which("ffmpeg"),
                                  "numpy/PIL/ffmpeg 없음")
WORK = "husband-regress"


class WebnovelDataTest(unittest.TestCase):
    def test_season_and_episodes(self):
        se = w.season(WORK)
        self.assertTrue(se.get("title"))
        eps = w.episodes(WORK)
        self.assertEqual([e["no"] for e in eps], list(range(1, len(eps) + 1)))
        for e in eps:
            self.assertEqual(w.policy_problems(e), [], f"{e['no']}화")
            self.assertGreaterEqual(len(e["cards"]), 5)
            self.assertLessEqual(len(w.title_of(se, e)), 100)

    def test_policy_catches_gore(self):
        ep = {"cards": [{"lines": [["시신이 발견됐다", "n"]], "motif": None}]}
        self.assertTrue(w.policy_problems(ep))

    def test_next_episode_private_waits(self):
        cfg = {"work": WORK, "visibility": "private"}
        self.assertEqual(w.next_episode(cfg, {})["no"], 1)
        self.assertIsNone(w.next_episode(cfg, {w.key(WORK, 1): {}}))
        cfg["visibility"] = "schedule"
        self.assertEqual(w.next_episode(cfg, {w.key(WORK, 1): {}})["no"], 2)

    def test_video_body_not_for_kids(self):
        se = w.season(WORK); ep = w.episodes(WORK)[0]
        b = w.video_body(se, ep, "private", None)
        self.assertFalse(b["status"]["selfDeclaredMadeForKids"])
        self.assertEqual(b["status"]["privacyStatus"], "private")
        self.assertIn("오리지널 창작", b["snippet"]["description"])
        at = w.publish_at(__import__("datetime").date(2030, 1, 1), 21)
        s = w.video_body(se, ep, "schedule", at)["status"]
        self.assertEqual(s["publishAt"], "2030-01-01T12:00:00Z")


@NEED_RENDER
class WebnovelDrawTest(unittest.TestCase):
    def test_cards_draw(self):
        import numpy  # noqa: F401
        se = w.season(WORK); pal = w.palette(se)
        for e in w.episodes(WORK)[:2]:
            for c in e["cards"] + [w.end_card(se, e, pal)]:
                im, _ = w.draw_card(c, pal)
                self.assertEqual(im.size, (w.W, w.H))


if __name__ == "__main__":
    unittest.main()
