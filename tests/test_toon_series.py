"""시즌 빌드업·댓글 투표·터진 편 이어 가기·몽글이 기억 (BK 2026-11-20 '빌드업')."""
import datetime as dt
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

from pipeline import raksil_shorts as R
from pipeline import toon_series as T
from pipeline import yt_early as E

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools"))


class FakeCJ:
    SONNET = "s"
    POLICY = ""

    def __init__(self, reply=None, fail=False):
        self.reply, self.fail = reply, fail

    def ask(self, *a, **k):
        if self.fail:
            raise RuntimeError("no key")
        return self.reply

    def direction(self, *a):
        return ""


class VoteTest(unittest.TestCase):
    def test_quick_count(self):
        r = T.quick_count("난방비", "배달비", ["A", "b요", "난방비 궁금해요", "둘 다", "배달비!", "A가 좋아요"])
        self.assertEqual(r, {"a": 3, "b": 2})

    def test_tally_ai_cannot_exceed_comments(self):
        r = T.tally(FakeCJ({"a": 50, "b": 1}), "가", "나", ["가", "나"])  # 댓글보다 많으면 규칙 셈으로
        self.assertEqual(r["by"], "규칙")
        self.assertEqual(T.tally(FakeCJ({"a": 1, "b": 0}), "가", "나", ["가"])["by"], "AI")
        self.assertEqual(T.tally(FakeCJ(), "가", "나", [])["by"], "없음")

    def test_polls_need_votes_and_age(self):
        st = {"polls": [{"date": "2026-12-04", "a": "난방비", "b": "배달비", "result": None},
                        {"date": "2026-12-06", "a": "온수", "b": "택배비", "result": None}]}
        with mock.patch.object(T, "video_of", return_value="vid"), \
                mock.patch.object(T, "fetch_comments", return_value=["A", "A", "B", "난방비요"]):
            done = T.update_polls(FakeCJ(fail=True), st, dt.date(2026, 12, 6))
        self.assertEqual(done, ["2026-12-04"])  # 12/6 편은 아직 하루 안 됨
        self.assertEqual(st["polls"][0]["result"]["winner"], "난방비")
        self.assertIsNone(st["polls"][1]["result"])
        self.assertEqual(T.open_winner(st)["date"], "2026-12-04")

    def test_too_few_votes_no_result(self):
        st = {"polls": [{"date": "2026-12-04", "a": "가", "b": "나", "result": None}]}
        with mock.patch.object(T, "video_of", return_value="vid"), \
                mock.patch.object(T, "fetch_comments", return_value=["A"]):
            self.assertEqual(T.update_polls(FakeCJ(fail=True), st, dt.date(2026, 12, 6)), [])
        self.assertIsNone(T.open_winner(st))


class SeasonTest(unittest.TestCase):
    def test_prepare_and_record(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(T, "ROOT", pathlib.Path(d)), \
                mock.patch.object(T, "breakout", return_value=None):
            text, ctx = T.prepare(FakeCJ(fail=True), "bible", "2026-12-04", [], dt.date(2026, 11, 22))
            self.assertIn("1/10편", text)  # API 없으면 기본 시즌
            self.assertIn("vote_a", text)
            self.assertEqual(T.allow_repeat(ctx), set())
            T.record("2026-12-04", {"title": "밥솥", "summary": "보온 잡음", "vote_a": "난방비요금이궁금해요", "vote_b": "배달비"}, ctx)
            self.assertEqual(T.vote_of("2026-12-04"), {"a": "난방비요금이궁금", "b": "배달비"})  # 8자로 자름
            text2, _ = T.prepare(FakeCJ(fail=True), "bible", "2026-12-06", [], dt.date(2026, 11, 24))
            self.assertIn("2/10편", text2)
            self.assertIn("「밥솥」보온 잡음", text2)

    def test_winner_used_once(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(T, "ROOT", pathlib.Path(d)), \
                mock.patch.object(T, "breakout", return_value=None):
            T.save({"season": {"id": "s", "title": "t", "goal": "g", "running_gag": "r", "topics": ["가"]}, "log": [],
                    "polls": [{"date": "2026-12-04", "a": "난방비", "b": "배달비",
                               "result": {"a": 3, "b": 1, "winner": "난방비"}}]})
            text, ctx = T.prepare(FakeCJ(fail=True), "b", "2026-12-16", [], dt.date(2026, 12, 6))
            self.assertIn("'댓글로 고른 난방비 편!'", text)
            T.record("2026-12-16", {"title": "x", "vote_a": "온수", "vote_b": "택배비"}, ctx)
            self.assertNotIn("댓글로 고른", T.prepare(FakeCJ(fail=True), "b", "2026-12-18", [], dt.date(2026, 12, 8))[0])

    def test_breakout_repeat_limited(self):
        br = {"from": "2026-12-04", "title": "밥솥", "ratio": 4.0, "hook_type": "엉뚱한 질문", "frame": "versus"}
        with tempfile.TemporaryDirectory() as d, mock.patch.object(T, "ROOT", pathlib.Path(d)), \
                mock.patch("pipeline.yt_early.load_lessons", return_value={"삼촌": {"breakout": br}}):
            for i, day in enumerate(("2026-12-16", "2026-12-18")):
                text, ctx = T.prepare(FakeCJ(fail=True), "b", day, [], dt.date(2026, 12, 6))
                self.assertIn("터진 편 이어 가기", text)
                self.assertEqual(T.allow_repeat(ctx), {"hook_type", "frame"})
                T.record(day, {"title": f"x{i}"}, ctx)
            text, ctx = T.prepare(FakeCJ(fail=True), "b", "2026-12-20", [], dt.date(2026, 12, 8))
            self.assertNotIn("터진 편 이어 가기", text)  # 2편까지만


class EarlyBreakoutTest(unittest.TestCase):
    def test_verdict_breakout(self):
        self.assertEqual(E.verdict(300, [100, 90, 110])[0], "크게 터짐")
        self.assertEqual(E.verdict(200, [100, 90, 110])[0], "평소보다 잘 나감")

    def test_lessons_record_breakout(self):
        row = {"id": "v", "slug": "ep-2026-12-04-toon", "kind": "5락실 밸런스", "title": "라면 vs 치킨", "hook": "",
               "public_at": "2026-12-04T17:00+09:00", "checked_at": "2026-12-04T19:10+09:00", "age_min": 130,
               "views": 900, "likes": 10, "comments": 3}
        ls = E.update_lessons({}, {"v": row}, row, "크게 터짐", {"next": "규칙"}, 4.2)
        self.assertEqual(ls["5락실 밸런스"]["breakout"]["ratio"], 4.2)
        with mock.patch.object(E, "load_lessons", return_value=ls), \
                mock.patch.object(E.dt, "datetime", wraps=dt.datetime) as m:
            m.now.return_value = dt.datetime(2026, 12, 6, tzinfo=E.KST)
            self.assertIn("🔥 크게 터진 편「라면 vs 치킨」", E.lessons_prompt("5락실 밸런스"))

    def test_lab_variety(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "data/toon/lab"
            p.mkdir(parents=True)
            (p / "2026-12-04.md").write_text("# x\n- 모양·틀: drip / versus\n- 장소·훅유형·제목틀: 부엌 / 엉뚱한 질문 / 질문\n## 2안\n"
                                             "- 모양·틀: fly / chase\n", encoding="utf-8")
            old = os.getcwd()
            os.chdir(d)
            try:
                self.assertEqual(E.lab_variety("2026-12-04"), {"hook_type": "엉뚱한 질문", "frame": "versus"})
                self.assertEqual(E.lab_variety("2026-12-05"), {"hook_type": "", "frame": ""})
            finally:
                os.chdir(old)


class AssembleVoteTest(unittest.TestCase):
    def test_outro_vote(self):
        import toon_assemble as A
        self.assertEqual(A.outro_of({"vote": False}), A.OUTRO)
        oc = A.outro_of({"vote": {"a": "난방비", "b": "배달비"}})
        self.assertEqual(oc["lines"], ["다음엔 어디로 갈까?", "A 난방비 / B 배달비"])
        self.assertEqual(oc["big_y"], A.OUTRO["big_y"])
        with mock.patch("pipeline.toon_series.ensure_vote", return_value=None):
            self.assertEqual(A.outro_of({"date": "2026-12-04"}), A.OUTRO)


class SaturdayStartTest(unittest.TestCase):
    def test_ensure_vote_opens_from_season(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(T, "ROOT", pathlib.Path(d)):
            self.assertIsNone(T.ensure_vote("2026-11-24"))  # 시즌 없음
            T.save({"season": {"id": "s", "title": "t", "goal": "g", "running_gag": "r", "topics": ["난방비", "온수", "김장"]},
                    "log": [], "polls": []})
            self.assertIsNone(T.ensure_vote("2026-11-20"))  # 토요일 전
            self.assertIsNone(T.ensure_vote("2026-11-22"))  # 일요일 = 실사 특별편
            self.assertEqual(T.ensure_vote("2026-11-24"), {"a": "난방비", "b": "온수"})
            self.assertEqual(T.ensure_vote("2026-11-24"), {"a": "난방비", "b": "온수"})  # 다시 불러도 같음
            self.assertIsNone(T.ensure_vote("2026-11-26"))  # 남은 주제 1개뿐

    def test_seed_season_file(self):
        st = json.loads((pathlib.Path(__file__).resolve().parents[1] / "data/toon/season.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(st["season"]["topics"]), 10)
        self.assertTrue(all(len(t) <= T.VOTE_MAX for t in st["season"]["topics"]))


class RaksilCommentVoteTest(unittest.TestCase):
    def test_comment_votes_merge(self):
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d) / "up.json"
            f.write_text(json.dumps({"2026-11-21": {"id": "vid"}}), encoding="utf-8")
            q = {"a": "라면", "b": "치킨"}
            with mock.patch("pipeline.toon_series.fetch_comments", return_value=["A"] * 12 + ["치킨"] * 3), \
                    mock.patch("pipeline.claude_jobs.ask", side_effect=RuntimeError("no key")):
                cv = R.comment_votes(dt.date(2026, 11, 21), q, log=f)
            self.assertEqual(cv, {"a": 12, "b": 3})
            self.assertIsNone(R.comment_votes(dt.date(2026, 11, 22), q, log=f))
            res = R.result_of({"a": "라면", "b": "치킨"}, R.merge_votes({"a": 2, "b": 3}, cv))
            self.assertEqual((res["n"], res["pa"]), (20, 70))
            self.assertIsNone(R.result_of(q, R.merge_votes({"a": 1, "b": 1}, None)))


class MongleMemoryTest(unittest.TestCase):
    def test_memory_lines(self):
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d) / "up.json"
            f.write_text(json.dumps({"2026-12-03": {"id": "x", "a": "라면", "b": "치킨", "pick": {"pick": "a", "why": "국물은 진리"}},
                                     "2026-12-04": {"id": "y", "qid": "q"}}), encoding="utf-8")
            m = R.mongle_memory(log=f)
            self.assertIn("2026-12-03 '라면 vs 치킨' → 라면 (\"국물은 진리\")", m)
            self.assertEqual(R.mongle_memory(log=pathlib.Path(d) / "none.json"), "")


if __name__ == "__main__":
    unittest.main()
