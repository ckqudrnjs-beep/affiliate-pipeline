import datetime as dt
import unittest

from pipeline import raksil_shorts as r

QS = [{"id": "20261113-2", "date": "2026-11-13", "a": "x", "b": "y"},
      {"id": "20261113-1", "date": "2026-11-13", "a": "평생 라면만", "b": "평생 치킨만"},
      {"id": "20261112-1", "date": "2026-11-12", "a": "여름", "b": "겨울"}]


class RaksilShortsTest(unittest.TestCase):
    def test_pick_first_of_day(self):
        self.assertEqual(r.pick_question(QS, dt.date(2026, 11, 13))["id"], "20261113-1")
        self.assertIsNone(r.pick_question(QS, dt.date(2026, 1, 1)))

    def test_shorts_pick_skips_game_and_stale(self):
        qs = [{"id": "20261203-1", "date": "2026-12-03", "a": "퇴근 후 배그 스쿼드", "b": "퇴근 후 혼자 마크 농장"},
              {"id": "20261203-2", "date": "2026-12-03", "a": "탕수육 부먹", "b": "탕수육 찍먹"},
              {"id": "20261203-3", "date": "2026-12-03", "a": "택배는 바로 뜯기", "b": "택배는 모아서 주말에"}]
        self.assertEqual(r.pick_question(qs, dt.date(2026, 12, 3), for_shorts=True)["id"], "20261203-3")
        self.assertEqual(r.pick_question(qs, dt.date(2026, 12, 3))["id"], "20261203-1")  # 사이트는 그대로
        self.assertEqual(r.pick_question(qs[:1], dt.date(2026, 12, 3), for_shorts=True)["id"], "20261203-1")  # 하나뿐이면 그거

    def test_script_twist_no_cta_card(self):
        q = QS[1]
        self.assertEqual(len(r.script(q, None)), 3)
        res = r.result_of(QS[2], {"a": 10, "b": 30})
        self.assertIn("75퍼센트가 겨울", r.script(q, res)[2])

    def test_mongle_pick_rules(self):
        self.assertEqual(r.clean_pick({"pick": "a", "why": " 이불 밖은 위험하니까. "}), {"pick": "a", "why": "이불 밖은 위험하니까"})
        self.assertIsNone(r.clean_pick({"pick": "c", "why": "x"}))
        self.assertIsNone(r.clean_pick({"pick": "a", "why": "가" * 21}))
        self.assertIsNone(r.clean_pick({"pick": "b", "why": "73%가 골랐으니까"}))  # 통계처럼 보이는 숫자 금지
        self.assertIsNone(r.clean_pick({"pick": "b", "why": "구독하면 알려줄게"}))
        self.assertIsNone(r.clean_pick(None))
        import os
        old = os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            self.assertIsNone(r.mongle_pick(QS[1]))  # 키 없으면 조용히 None
        finally:
            if old is not None:
                os.environ["ANTHROPIC_API_KEY"] = old
        line = r.script(QS[1], None, {"pick": "b", "why": "치킨은 진리야"})[2]
        self.assertEqual(line, "몽글이는 평생 치킨만! 치킨은 진리야. 너는?")
        self.assertIn("몽글이 개인 의견", r.description_of(QS[1], None, False, {"pick": "b", "why": "치킨은 진리야"}))

    def test_result_needs_min_votes(self):
        self.assertIsNone(r.result_of(QS[2], {"a": 5, "b": 3}))
        res = r.result_of(QS[2], {"a": 30, "b": 10})
        self.assertEqual((res["pa"], res["pb"], res["n"]), (75, 25, 40))

    def test_texts(self):
        q = QS[1]
        self.assertLessEqual(len(r.title_of(q)), 100)
        d = r.description_of(q, None, True)
        self.assertIn("https://5raksil.com/q/20261113-1", d)
        self.assertIn("AI 음성", d)
        self.assertNotIn("광고", d)
        long_q = {"id": "1", "a": "가" * 80, "b": "나" * 80}
        self.assertLessEqual(len(r.title_of(long_q)), 100)

    def test_body_public_not_kids(self):
        b = r.video_body({"title": "t", "description": "d", "voiced": True})
        self.assertEqual(b["status"]["privacyStatus"], "public")
        self.assertFalse(b["status"]["selfDeclaredMadeForKids"])
        self.assertTrue(b["status"]["containsSyntheticMedia"])


    def test_publish_at_17(self):
        m = {"date": "2026-11-14"}
        early = dt.datetime(2026, 11, 14, 16, 23, tzinfo=r.KST)
        at = r.publish_time(m, early)
        self.assertEqual((at.hour, at.minute), (17, 0))
        b = r.video_body({"title": "t", "description": "d"}, at)
        self.assertEqual(b["status"]["privacyStatus"], "private")
        self.assertEqual(b["status"]["publishAt"], "2026-11-14T08:00:00Z")
        self.assertIsNone(r.publish_time(m, dt.datetime(2026, 11, 14, 17, 5, tzinfo=r.KST)))


    def test_extra_skips_used_qid(self):
        import json, os, pathlib, tempfile
        d = pathlib.Path(tempfile.mkdtemp())
        old = r.LOG
        r.LOG = d / "log.json"
        r.LOG.write_text(json.dumps({"2026-11-13": {"id": "x", "qid": "20261113-1"}}))
        try:
            os.environ.pop("RAKSIL_YT_ENABLED", None)
            self.assertEqual(r.upload_meta({"date": "2026-11-13", "key": "20261113-1", "qid": "20261113-1", "title": "t"}), 0)
        finally:
            r.LOG = old

    def test_balance_frames_keep_shorts_ui_free(self):
        """오른쪽 버튼 자리(x≥900, y 1000~1540)와 아래 제목 자리(y≥1560 위 격자 제외)에 몽글이·글자가 없다."""
        import numpy as np
        q = QS[1]
        res = r.result_of(QS[2], {"a": 10, "b": 30})
        starts = [0.0, 2.6, 4.7]
        mg = r.Mongle(dt.date(2026, 11, 21))
        bq, br = r.question_card(q), r.twist_card(res)
        empty = np.asarray(r.background().convert("RGB")).astype(int)
        empty_r = np.asarray(r.background(7).convert("RGB")).astype(int)
        bp = r.twist_card(None, q, {"pick": "a", "why": "라면은 국물이 반이야"})
        for t, ref, base_r, rr in ((0.3, empty, br, res), (1.2, empty, br, res), (3.0, empty, br, res),
                                   (6.0, empty_r, br, res), (6.0, empty_r, bp, None)):
            a = np.asarray(r.balance_frame(t, starts, bq, base_r, rr, mg).convert("RGB")).astype(int)
            diff = np.abs(a - ref).sum(axis=2)
            self.assertLess((diff[1000:1540, 900:] > 60).mean(), 0.002, t)
            self.assertLess((diff[1560:, :] > 60).mean(), 0.002, t)


if __name__ == "__main__":
    unittest.main()
