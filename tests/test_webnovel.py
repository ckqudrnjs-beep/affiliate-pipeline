import datetime as dt
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



class WebnovelSubscribeHooksTest(unittest.TestCase):
    def test_description_playlist_top(self):
        se = w.season(WORK); ep = w.episodes(WORK)[2]
        d = w.description_of(se, ep, {}, "PLx")
        self.assertTrue(d.startswith("⏮ 1화부터 정주행: https://www.youtube.com/playlist?list=PLx\n"))
        self.assertNotIn("정주행", w.description_of(se, ep, {}))

    def test_end_card_tells_time(self):
        se = w.season(WORK); ep = w.episodes(WORK)[2]
        texts = [t for t, _ in w.end_card(se, ep, w.palette(se))["lines"]]
        self.assertIn("내일 밤 9시", texts); self.assertIn("구독해야 알림이 와요", texts)

    def test_comment_text(self):
        eps = w.episodes(WORK)
        self.assertIn("내일 밤 9시", w.comment_text(eps[2]))
        self.assertIn("youtu.be/ZZ", w.comment_text(eps[2], {"next": "ZZ"}))
        self.assertIn("시즌", w.comment_text(eps[-1]))

    def test_post_comments_targets_past_public_only(self):
        from unittest import mock
        log = {w.key(WORK, 1): {"id": "A", "date": "2026-11-21", "visibility": "schedule"},
               w.key(WORK, 2): {"id": "B", "date": "2026-11-22", "visibility": "schedule", "commented": True},
               w.key(WORK, 3): {"id": "C", "date": "2026-11-23", "visibility": "schedule"}}
        with mock.patch("urllib.request.urlopen") as u:
            done, err = w.post_comments("t", WORK, w.dt.date(2026, 11, 23), log)
        self.assertEqual(done, [1]); self.assertIsNone(err); self.assertEqual(u.call_count, 1)
        self.assertTrue(log[w.key(WORK, 1)]["commented"]); self.assertNotIn("commented", log[w.key(WORK, 3)])

    def test_preview_text_shows_only_opening(self):
        se = w.season(WORK); ep = w.episodes(WORK)[3]
        t = w.preview_text(se, ep)
        self.assertIn("밤 9시", t); self.assertIn(ep["title"], t); self.assertIn("구독하면", t)
        last = " ".join(x for x, _ in ep["cards"][-1]["lines"])
        self.assertNotIn(last, t)
        for bad in ("구독하면 드려요", "구독자만", "보상"):
            self.assertNotIn(bad, t)

    @NEED_RENDER
    def test_preview_image_square(self):
        import tempfile
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            p = w.preview_image(WORK, w.episodes(WORK)[0], out_dir=w.pathlib.Path(d))
            self.assertEqual(Image.open(p).size, (1080, 1080))

    def test_send_photo_needs_env(self):
        from unittest import mock
        from pipeline import api_check
        with mock.patch.dict(w.os.environ, {"TELEGRAM_BOT_TOKEN": "", "TELEGRAM_ADMIN_CHAT_ID": ""}):
            self.assertFalse(api_check.send_photo(__file__, "x"))

if __name__ == "__main__":
    unittest.main()


class WebnovelSoundCueTest(unittest.TestCase):
    def test_card_cue_picks_scene_sound(self):
        self.assertEqual(w.card_cue({"lines": [["밤 11시 17분.", "n"]]}), "clock")
        self.assertEqual(w.card_cue({"lines": [["채아가 와인 대신 주스를", "n"]]}), "glass")
        self.assertEqual(w.card_cue({"lines": [["엘리베이터가 섰다.", "n"]]}), "ding")
        self.assertEqual(w.card_cue({"lines": [["아무 일 없었다", "n"]], "motif": "paper"}), "paper")
        self.assertIsNone(w.card_cue({"lines": [["우리는 손을 잡기로 했다.", "n"]]}))

    def test_season_uses_several_sounds(self):
        import json
        seen = set()
        for n in range(1, 16):
            p = w.ROOT / f"data/webnovel/works/{WORK}/ep/{n:02d}.json"
            seen |= {w.card_cue(c) for c in json.loads(p.read_text())["cards"]}
        self.assertGreaterEqual(len(seen - {None}), 6)

    @NEED_RENDER
    def test_sound_with_cues_writes_wav(self):
        import tempfile, wave, os
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "a.wav")
            w.sound([0, 2, 4, 6], [2, 2, 2, 2], 2, 8.0, p, cues=[None, "clock", "glass", None], seed=3)
            with wave.open(p) as wv:
                self.assertGreater(wv.getnframes(), 44100 * 8)


class WebnovelBandTest(unittest.TestCase):
    def test_band_is_hook_not_twist(self):
        ep = {"title": "위조가 아니었다", "hook": "새벽 2시. 살인범 집 초인종을 눌렀다", "cards": []}
        self.assertEqual(w.band_lines(ep), ["새벽 2시", "살인범 집 초인종을 눌렀다"])
        self.assertEqual(w.band_lines({"band": ["가", "나"], "cards": []}), ["가", "나"])
        self.assertEqual(w.band_lines({"hook": "짧은 훅", "cards": []}), ["짧은 훅"])


class WebnovelRecapTest(unittest.TestCase):
    def test_recap_prev_episode(self):
        se = {"logline": "줄거리"}
        self.assertEqual(w.recap_of(se, {"no": 1}), "")
        self.assertEqual(w.recap_of(se, {"no": 3}), "지난 이야기: 줄거리")
        self.assertEqual(w.recap_of(se, {"no": 6, "recap": "앞 화 끝"}), "지난 이야기: 앞 화 끝")


class WebnovelSameDayTest(unittest.TestCase):
    def test_posted_on(self):
        cfg = {"work": "w"}
        log = {"w/03": {"date": "2026-11-23"}, "w/trailer-01": {"date": "2026-11-24"}}
        self.assertTrue(w.posted_on(cfg, log, dt.date(2026, 11, 23)))
        self.assertFalse(w.posted_on(cfg, log, dt.date(2026, 11, 24)))
        self.assertFalse(w.posted_on({"work": "x"}, log, dt.date(2026, 11, 23)))


class WebnovelTrailerTest(unittest.TestCase):
    def test_trailers_have_art_and_hooks(self):
        tr = w.trailers(WORK)
        self.assertGreaterEqual(len(tr), 3)
        for t in tr:
            self.assertTrue(t["hook"])
            for sc in t["scenes"]:
                self.assertIsNotNone(w.art_path(WORK, sc["art"]), sc)
            self.assertLessEqual(len(w.trailer_title(w.season(WORK), t)), 100)

    def test_next_trailer_only_wednesday_once(self):
        import datetime as dt
        cfg = {"work": WORK}
        log = {w.key(WORK, 1): {"id": "zCRdhLwxGVA"}}
        wed = dt.date(2026, 11, 25)
        self.assertEqual(w.next_trailer(cfg, log, wed), 1)
        self.assertIsNone(w.next_trailer(cfg, log, wed + dt.timedelta(days=1)))
        log[w.trailer_key(WORK, 1)] = {"id": "x", "date": wed.isoformat()}
        self.assertIsNone(w.next_trailer(cfg, log, wed))
        self.assertEqual(w.next_trailer(cfg, log, wed + dt.timedelta(days=7)), 2)
        self.assertIsNone(w.next_trailer({**cfg, "trailer": False}, log, wed + dt.timedelta(days=7)))

    def test_trailer_desc_links_first_episode(self):
        d = w.trailer_desc(w.season(WORK), WORK, {w.key(WORK, 1): {"id": "zCRdhLwxGVA"}}, "PLx")
        self.assertTrue(d.startswith("▶ 1화부터 보기: https://youtu.be/zCRdhLwxGVA"))
        self.assertIn("list=PLx", d)

    def test_first_cards_standalone_hooks(self):
        import json
        for n in (9, 10, 14):
            ep = json.loads((w.WORKS / WORK / "ep" / f"{n:02d}.json").read_text())
            self.assertEqual(w.policy_problems(ep), [])


class WebnovelRelatedTest(unittest.TestCase):
    def test_related_points_to_first_episode(self):
        log = {w.key(WORK, 1): {"id": "zCRdhLwxGVA"}}
        t = w.related(WORK, log, "NEWVID")
        self.assertIn("https://studio.youtube.com/video/NEWVID/edit", t)
        self.assertIn("https://youtu.be/zCRdhLwxGVA", t)
        self.assertEqual(w.related(WORK, log, "zCRdhLwxGVA"), "")
        self.assertEqual(w.related(WORK, {}, "NEWVID"), "")
