import datetime as dt
import json
import pathlib
import unittest

from pipeline import episodes as ep
from pipeline import youtube as yt


class EpisodeCheckTest(unittest.TestCase):
    def test_samples_pass(self):
        for p in ep.ep_files():
            self.assertEqual(ep.check(json.loads(p.read_text(encoding="utf-8"))), [], p)

    def test_rules(self):
        bad = {"date": "2026-11-20", "kind": "short", "title": "온풍기 얘기", "product": "usb-heated-lap-blanket",
               "description": "x", "scenes": [{"type": "end", "say": "써 봤는데 좋아"}]}
        errs = " ".join(ep.check(bad))
        self.assertIn("[광고]", errs)
        self.assertIn("첫 장면은 hook", errs)
        self.assertIn("금지 표현", errs)

    def test_weekday_formats(self):
        self.assertEqual(ep.SHORT_FORMATS[dt.date(2026, 11, 16).weekday()][0], "skit-quiz")  # 월
        self.assertEqual(ep.LONG_FORMATS, {})  # 2026-11-14 BK: 롱폼 멈춤


class EpisodeUploadTest(unittest.TestCase):
    def test_non_ad_row_has_no_ad_rules(self):
        row = {"title": "보일러 외출 모드, 진짜 아낄까", "intro": "계산", "price_date": "", "ad": "0", "kind": "short"}
        d = yt.build_description(row)
        self.assertEqual(yt.check(row, d), [])
        self.assertNotIn("광고", d.splitlines()[0])

    def test_dated_row_uses_its_date(self):
        q = [{"slug": "e1", "title": "[광고] x", "intro": "x", "price_date": "", "date": "2026-11-16", "kind": "short"},
             {"slug": "l1", "title": "[광고] y", "intro": "y", "price_date": "", "date": "2026-11-18", "kind": "long"}]
        now = dt.datetime(2026, 11, 15, 10, 0, tzinfo=yt.KST)
        due = yt.due_rows(q, {}, now, 1, 2)
        self.assertEqual([(r["slug"], s.hour) for r, s in due], [("e1", 19)])
        now = dt.datetime(2026, 11, 16, 10, 0, tzinfo=yt.KST)  # 롱폼(11/18 20:00)은 2일 넘게 남아 아직
        self.assertEqual([r["slug"] for r, s in yt.due_rows(q, {}, now, 1, 2)], ["e1"])
        now = dt.datetime(2026, 11, 17, 10, 0, tzinfo=yt.KST)
        self.assertEqual([(r["slug"], s.hour) for r, s in yt.due_rows(q, {}, now, 1, 2)], [("l1", 20)])


if __name__ == "__main__":
    unittest.main()


class SkitCheckTest(unittest.TestCase):
    def test_skit_lines(self):
        from pipeline.skit import check_lines
        ok = [{"who": "u", "say": "조카야 얼마게?", "cap": ["얼마게?"]}, {"who": "n", "n": "shock", "say": "헐"}]
        self.assertEqual(check_lines(ok), [])
        self.assertTrue(check_lines(ok[:1]))
        self.assertTrue(check_lines([{"who": "x", "say": "가"}, {"who": "u", "say": "나" * 43}]))
        self.assertTrue(check_lines([{"who": "u", "say": "가", "u": "dance"}, {"who": "n", "say": "나", "prop": "cat"}]))

    def test_sample_skit_episode(self):
        import json, pathlib
        spec = json.loads(pathlib.Path("data/episodes/2026-11-16-skit-quiz.json").read_text(encoding="utf-8"))
        self.assertEqual(ep.check(spec), [])
        spec["kind"] = "long"
        self.assertTrue(any("쇼츠 전용" in x for x in ep.check(spec)))


class QuizShortTest(unittest.TestCase):
    """2026-11-14 BK: 오늘의 얼마게 (사이트 퀴즈와 같은 날 같은 문제)."""

    def test_num_ko(self):
        self.assertEqual(ep.num_ko(12500), "만 이천오백")
        self.assertEqual(ep.num_ko(210000), "이십일만")
        self.assertEqual(ep.speak("약 1,385.2원 (참고)"), "약 천삼백팔십오 점 이원")

    def test_quiz_matches_site_and_passes_check(self):
        import datetime as dt
        from pipeline import daily
        for i in range(14):
            d = dt.date(2026, 11, 17) + dt.timedelta(days=i)
            spec = ep.quiz_spec(d)
            self.assertEqual(ep.check(spec), [], d)
            q = daily.schedule(d, 1, None)[d.isoformat()]
            self.assertEqual(spec["quiz_id"], q["id"])
            self.assertNotIn("product", spec)

    def test_writer_skips_quiz_days(self):
        import datetime as dt
        d = ep.next_short_date(dt.date(2026, 11, 14))
        self.assertNotIn(d.weekday(), ep.QUIZ_DAYS)
