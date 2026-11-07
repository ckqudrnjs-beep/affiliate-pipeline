import datetime as dt
import pathlib
import tempfile
import unittest

from pipeline.drafts import build
from pipeline.publish import IG_LINK_NOTE, KST, instagram_caption, parse_drafts, run

NOW = dt.datetime(2026, 11, 7, 12, 30, tzinfo=KST)
P1 = {"productName": "무선 전기주전자 1.7L", "productPrice": 23900, "productUrl": "https://link.coupang.com/a/abc",
      "isRocket": True, "productImage": "https://image.example.com/a.jpg"}
P2 = {"program": "naver", "productName": "전기요", "productPrice": 39900, "productUrl": "https://naver.me/abc",
      "priceDate": "2026-11-07"}
BAD = {"productName": "가짜", "productPrice": 1000, "productUrl": "https://bit.ly/x"}


class Fake:
    def __init__(self):
        self.calls = []

    def publish(self, *args):
        self.calls.append(args)
        return {"id": str(len(self.calls)), "url": f"https://example.com/{len(self.calls)}"}


def make_dir(products):
    d = pathlib.Path(tempfile.mkdtemp())
    (d / "2026-11-07.md").write_text(build(products, NOW.date()), encoding="utf-8")
    return d


class ParseTest(unittest.TestCase):
    def test_roundtrip(self):
        posts = parse_drafts(build([P1, P2, BAD], NOW.date()), "2026-11-07")
        self.assertEqual([p["key"] for p in posts], ["2026-11-07#1", "2026-11-07#2", "2026-11-07#3"])
        self.assertEqual(posts[0]["image"], P1["productImage"])
        self.assertEqual(posts[1]["program"], "naver")
        self.assertIsNone(posts[1]["image"])
        self.assertFalse(posts[2]["passed"])

    def test_instagram_caption_hides_link_keeps_disclosure_first(self):
        post = parse_drafts(build([P1], NOW.date()), "2026-11-07")[0]
        cap = instagram_caption(post)
        self.assertNotIn("http", cap)
        self.assertIn(IG_LINK_NOTE, cap)
        self.assertTrue(cap.startswith("이 포스팅은 쿠팡 파트너스"))


class RunTest(unittest.TestCase):
    def test_dry_run_publishes_nothing(self):
        d = make_dir([P1])
        th, ig = Fake(), Fake()
        out = run({}, NOW, {"threads": th, "instagram": ig}, d)
        self.assertEqual(th.calls, [])
        self.assertTrue(any("dry-run" in l for l in out))
        self.assertFalse((d / "published.json").exists())

    def test_one_per_run_daily_cap_and_no_duplicates(self):
        d = make_dir([P1, P2, BAD, P1])
        th, ig = Fake(), Fake()
        env = {"PUBLISH_ENABLED": "true", "THREADS_DAILY_MAX": "2"}
        for _ in range(4):
            run(env, NOW, {"threads": th, "instagram": ig}, d)
        # 스레드: 하루 상한 2개, 차단 초안(#3) 제외
        self.assertEqual(len(th.calls), 2)
        # 인스타: 이미지 있는 초안 #1만. #4는 #1과 같은 내용이라 반복 게시 방지로 제외
        self.assertEqual(len(ig.calls), 1)
        self.assertTrue(ig.calls[0][1].endswith(".jpg"))
        texts = [c[0] for c in th.calls]
        self.assertEqual(len(set(texts)), 2)
        self.assertNotIn("bit.ly", "".join(texts))

    def test_old_drafts_ignored(self):
        d = pathlib.Path(tempfile.mkdtemp())
        (d / "2026-11-01.md").write_text(build([P1], dt.date(2026, 11, 1)), encoding="utf-8")
        th = Fake()
        run({"PUBLISH_ENABLED": "true"}, NOW, {"threads": th, "instagram": Fake()}, d)
        self.assertEqual(th.calls, [])

    def test_failure_on_one_channel_does_not_block_other(self):
        class Boom:
            def publish(self, *a):
                raise RuntimeError("x")
        d = make_dir([P1])
        th = Fake()
        out = run({"PUBLISH_ENABLED": "true"}, NOW, {"threads": th, "instagram": Boom()}, d)
        self.assertEqual(len(th.calls), 1)
        self.assertTrue(any("발행 실패" in l for l in out))


if __name__ == "__main__":
    unittest.main()
