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


class WebnovelLinksTest(unittest.TestCase):
    def test_description_links(self):
        se = w.season(WORK); eps = w.episodes(WORK)
        log = {w.key(WORK, 1): {"id": "AAA"}, w.key(WORK, 2): {"id": "BBB"}, w.key(WORK, 3): {"id": "CCC"}}
        d2 = w.description_of(se, eps[1], w.links_of(WORK, 2, log))
        self.assertIn("▶ 다음 화 3화", d2); self.assertIn("youtu.be/CCC", d2); self.assertIn("◀ 이전 화: https://youtu.be/AAA", d2)
        self.assertNotIn("1화부터", d2)  # 이전 화가 곧 1화
        d3 = w.description_of(se, eps[2], w.links_of(WORK, 3, log))
        self.assertIn("1화부터 보기: https://youtu.be/AAA", d3); self.assertIn("(내일 밤 9시)", d3)
        self.assertNotIn("이전 화", w.description_of(se, eps[0], w.links_of(WORK, 1, {})))


class WebnovelPromoteTest(unittest.TestCase):
    def test_promote_needs_schedule_and_token(self):
        log = {"husband-regress/01": {"id": "x", "visibility": "private"}}
        self.assertEqual(w.promote_private({"work": "husband-regress", "visibility": "private", "on": True}, log, w.dt.date(2026, 11, 22)), [])
        import os
        old = os.environ.pop("WEBNOVEL_YT_ENABLED", None)
        try:
            self.assertEqual(w.promote_private({"work": "husband-regress", "visibility": "schedule", "on": True}, log, w.dt.date(2026, 11, 22)), [])
        finally:
            if old is not None:
                os.environ["WEBNOVEL_YT_ENABLED"] = old


class WebnovelLongTest(unittest.TestCase):
    W = "husband-regress"

    def _log(self, upto, vis="schedule", date="2026-11-25"):
        return {w.key(self.W, n): {"id": "x", "date": date, "visibility": vis} for n in range(1, upto + 1)}

    def test_extras_exist_and_pass_policy(self):
        ex = w.extras(self.W)
        self.assertEqual(sorted(ex), [5, 10, 15])
        for x in ex.values():
            self.assertEqual(w.policy_problems(x), [], x["title"])

    def test_next_long_waits_for_five_public_eps(self):
        cfg = {"work": self.W, "visibility": "schedule"}
        day = w.dt.date(2026, 11, 29)
        self.assertIsNone(w.next_long(cfg, self._log(4), day))
        self.assertEqual(w.next_long(cfg, self._log(5), day), 1)
        self.assertIsNone(w.next_long(cfg, self._log(5, vis="private"), day))
        self.assertIsNone(w.next_long(cfg, self._log(5, date="2026-12-01"), day))
        log = self._log(10); log[w.long_key(self.W, 1)] = {"id": "y"}
        self.assertEqual(w.next_long(cfg, log, day), 2)

    def test_long_chapters_and_body(self):
        seq, chap = w.long_cards(self.W, 1)
        self.assertEqual(chap[0], ("시작", 0))
        self.assertEqual(len(chap), 7)  # 시작 + 5화 + 번외
        self.assertTrue(chap[-1][0].startswith("번외"))
        body = w.long_body(w.season(self.W), self.W, 1, ["0:00 시작"], "schedule", None)
        self.assertFalse(body["status"]["selfDeclaredMadeForKids"])
        self.assertNotIn("#shorts", body["snippet"]["title"])
        self.assertLessEqual(len(body["snippet"]["title"]), 100)


@NEED_RENDER
class WebnovelDrawTest(unittest.TestCase):
    def test_cards_draw(self):
        import numpy  # noqa: F401
        se = w.season(WORK); pal = w.palette(se)
        for e in w.episodes(WORK)[:2]:
            for c in e["cards"] + [w.end_card(se, e, pal)]:
                im, _ = w.draw_card(c, pal)
                self.assertEqual(im.size, (w.W, w.H))

    def test_wide_card_draw(self):
        se = w.season("husband-regress"); pal = w.palette(se)
        im, _ = w.draw_card({"lines": [["그때 휴대폰이 울렸다.", "n"]], "motif": "phone_msg"}, pal, wide=True)
        self.assertEqual(im.size, (w.LW, w.LH))


if __name__ == "__main__":
    unittest.main()
