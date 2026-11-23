"""삼촌 쇼츠 돈 강조 금지 점검 (11/23, 11/22 찌개 편이 수동 실행으로 그대로 나간 일 뒤)."""
import json
import os
import pathlib
import tempfile
import unittest
from unittest import mock

from pipeline import youtube as y


class MoneyHitsTest(unittest.TestCase):
    def test_hits(self):
        self.assertEqual(y.money_hits("집에서 끓이면\n돈이 돌아온다!"), ["돈이"])
        self.assertIn("얼마", y.money_hits("한 그릇 차이 얼마?"))
        self.assertIn("9,260원", y.money_hits("9,260원 아낌"))
        self.assertIn("저금통", y.money_hits("돼지저금통 앞"))

    def test_no_false_alarm(self):
        for t in ["동전이의 첫 드라이브, 어디로 가는 걸까?", "얼마나 추울까", "3분 만에 잠든 동전이", "건조기 앞에 앉은 동전이, 뭘 보고 있을까?"]:
            self.assertEqual(y.money_hits(t), [], t)


class ToneIssuesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old = os.getcwd()
        os.chdir(self.tmp.name)
        pathlib.Path("data/toon").mkdir(parents=True)
        pathlib.Path("data/toon/2026-12-08.json").write_text(json.dumps({
            "band": {"top": "동전이 저녁", "accent": "무슨 일?"},
            "cuts": [{"lines": ["집에서 끓이면", "돈이 돌아온다!"]}]}, ensure_ascii=False), encoding="utf-8")

    def tearDown(self):
        os.chdir(self.old)
        self.tmp.cleanup()

    def meta(self, **kw):
        return {"style": "toon", "note": "조립 data/toon/2026-12-08.json"} | kw

    def test_caption_blocks(self):
        spec = {"date": "2026-12-08", "title": "동전이의 저녁"}
        self.assertEqual(y.tone_issues(spec, self.meta()), ["돈이"])
        self.assertFalse(y.quality_ok(spec, self.meta()))

    def test_title_blocks(self):
        spec = {"date": "2026-12-08", "title": "한 그릇 차이 얼마?"}
        self.assertIn("얼마", y.tone_issues(spec, {"style": "toon"}))

    def test_bk_ok_and_old_dates_pass(self):
        spec = {"date": "2026-12-08", "title": "동전이의 저녁"}
        self.assertEqual(y.tone_issues(spec, self.meta(tone_ok=True)), [])
        self.assertEqual(y.tone_issues({"date": "2026-11-15", "title": "1년이면 얼마?"}, {}), [])

    def test_manual_slug_refused_without_force(self):
        row = {"slug": "ep-x", "date": "2026-12-08", "quality_ok": False}
        with mock.patch.object(y, "load_log", return_value={}), mock.patch.object(y, "load_queue", return_value=[row]), \
                mock.patch.object(y, "upload_one", return_value=0) as up, mock.patch.object(y, "summary"), \
                mock.patch.dict(os.environ, {"YT_SLUG": "ep-x", "YT_FORCE": ""}):
            self.assertEqual(y.main(), 1)
            up.assert_not_called()
        with mock.patch.object(y, "load_log", return_value={}), mock.patch.object(y, "load_queue", return_value=[row]), \
                mock.patch.object(y, "upload_one", return_value=0) as up, mock.patch.object(y, "summary"), \
                mock.patch.dict(os.environ, {"YT_SLUG": "ep-x", "YT_FORCE": "true"}):
            y.main()
            up.assert_called_once()


if __name__ == "__main__":
    unittest.main()
