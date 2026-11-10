import datetime as dt
import json
import pathlib
import shutil
import tempfile
import unittest

from pipeline import instagram as ig

NOW = dt.datetime(2026, 11, 11, 12, 0, tzinfo=ig.KST)


class Fake:
    def __init__(self):
        self.calls = []

    def reel(self, *a):
        self.calls.append(("reel",) + a)
        return {"id": "1", "url": "https://www.instagram.com/reel/x/"}

    def carousel(self, *a):
        self.calls.append(("carousel",) + a)
        return {"id": "2", "url": "https://www.instagram.com/p/y/"}


class CheckTest(unittest.TestCase):
    def test_backlog_passes(self):
        posts = ig.load_posts()
        self.assertGreaterEqual(len(posts), 7)
        for p in posts:
            self.assertEqual(ig.check_post(p), [], p["slug"])

    def test_sales_words_blocked(self):
        p = dict(ig.load_posts()[0], caption="오늘 특가! 프로필 링크에서 구매하세요")
        errs = " ".join(ig.check_post(p))
        for w in ("특가", "링크", "구매"):
            self.assertIn(w, errs)
        p = dict(ig.load_posts()[0], caption="자세한 건 https://don3chon.com")
        self.assertTrue(ig.check_post(p))

    def test_tip_fallback(self):
        tip = {"topic": "겨울 가습", "text": "겨울철 가습기 관리\n1. 물은 매일 새로 갈기\n2. 물통 세척\n관리 안 하면 손해예요."}
        p = ig.tip_to_post(tip, "tip-001", "reel")
        self.assertEqual([s["title"] for s in p["slides"]], ["물은 매일 새로 갈기", "물통 세척"])
        self.assertEqual(p["outro"], "관리 안 하면 손해예요.")
        self.assertEqual(ig.check_post(p), [])
        self.assertIsNone(ig.tip_to_post({"topic": "x", "text": "한 줄뿐"}, "t", "reel"))

    def test_next_post_order_and_fallback(self):
        d = pathlib.Path(tempfile.mkdtemp())
        p, _ = ig.next_post(NOW.date(), {}, d, ig.TIPS)
        self.assertTrue(p["slug"].startswith("tip-"))          # 준비된 글 없으면 팁으로
        first = ig.load_posts()[0]["slug"]
        p, _ = ig.next_post(NOW.date(), {}, )
        self.assertEqual(p["slug"], first)
        p, _ = ig.next_post(NOW.date(), {first: {"at": "2026-11-10T12:00:00+09:00"}})
        self.assertNotEqual(p["slug"], first)

    def test_kind_for(self):
        self.assertEqual(ig.kind_for(dt.date(2026, 11, 11)), "carousel")   # 수
        self.assertEqual(ig.kind_for(dt.date(2026, 11, 12)), "reel")


class PostTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.old = (ig.LOG, ig.PENDING, ig.MEDIA)
        ig.LOG, ig.PENDING, ig.MEDIA = self.tmp / "log.json", self.tmp / "pending.json", self.tmp / "ig"

    def tearDown(self):
        ig.LOG, ig.PENDING, ig.MEDIA = self.old
        shutil.rmtree(self.tmp)

    def pend(self, kind):
        p = dict(ig.load_posts()[0], type=kind, files=["reel.mp4", "cover.jpg"] if kind == "reel" else ["1.jpg", "2.jpg"])
        ig.PENDING.write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")
        (ig.MEDIA / p["slug"]).mkdir(parents=True)
        return p

    def test_reel_posts_once_per_day(self):
        p = self.pend("reel")
        fake = Fake()
        out = ig.post({}, NOW, fake)
        self.assertIn("게시 완료", out[0])
        self.assertEqual(fake.calls[0][1], f"https://don3chon.com/ig/{p['slug']}/reel.mp4")
        self.assertIn("#", fake.calls[0][3])
        self.assertFalse(ig.PENDING.exists())
        self.assertFalse((ig.MEDIA / p["slug"]).exists())
        self.pend("carousel")
        self.assertIn("이미 게시", ig.post({}, NOW, fake)[0])
        self.assertEqual(len(fake.calls), 1)

    def test_carousel(self):
        self.pend("carousel")
        fake = Fake()
        ig.post({}, NOW, fake)
        self.assertEqual(fake.calls[0][0], "carousel")
        self.assertEqual(len(fake.calls[0][1]), 2)

    def test_enabled(self):
        self.assertFalse(ig.enabled({}))
        self.assertTrue(ig.enabled({"IG_ACCESS_TOKEN": "x"}))
        self.assertFalse(ig.enabled({"IG_ACCESS_TOKEN": "x", "INSTAGRAM_ENABLED": "false"}))


if __name__ == "__main__":
    unittest.main()
