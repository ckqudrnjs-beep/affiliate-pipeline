import datetime as dt
import json
import os
import pathlib
import tempfile
import unittest
from unittest import mock

from pipeline import claude_jobs as C


class CycleBudgetTest(unittest.TestCase):
    def test_cycle(self):
        self.assertEqual(C.cycle_start(dt.date(2026, 11, 20)), dt.date(2026, 11, 15))
        self.assertEqual(C.cycle_start(dt.date(2026, 12, 14)), dt.date(2026, 11, 15))
        self.assertEqual(C.cycle_start(dt.date(2026, 12, 15)), dt.date(2026, 12, 15))
        self.assertEqual(C.cycle_start(dt.date(2027, 1, 3)), dt.date(2026, 12, 15))
        self.assertEqual(C.cycle_end(dt.date(2026, 11, 20)), dt.date(2026, 12, 14))
        self.assertEqual(C.cycle_end(dt.date(2027, 1, 20)), dt.date(2027, 2, 14))

    def test_cost(self):
        self.assertAlmostEqual(C.cost(C.OPUS, {"input_tokens": 1_000_000, "output_tokens": 100_000}), 6.0)
        self.assertAlmostEqual(C.cost(C.HAIKU, {"input_tokens": 1_000_000}), 0.1)

    def test_caps_add_up(self):
        fixed = sum(v for k, v in C.JOB_CAP.items() if k != "polish")
        self.assertLess(fixed, C.CAP_USD)  # 남는 돈은 polish 가 회차 끝에 쓴다
        self.assertLessEqual(C.CAP_USD, 100)

    def test_budget_guard(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(C, "USAGE_DIR", pathlib.Path(d)):
            day = dt.date(2026, 11, 20)
            C.record(day, "toon", C.OPUS, {"input_tokens": 0, "output_tokens": 700_000})  # 14달러
            self.assertAlmostEqual(C.spent(day), 14.0)
            C.check_budget(day, "toon", 0.5)
            with self.assertRaises(C.BudgetError):
                C.check_budget(day, "toon", 1.5)  # toon 상한 15
            C.record(day, "polish", C.OPUS, {"output_tokens": 4_000_000})  # +80 → 94
            with self.assertRaises(C.BudgetError):
                C.check_budget(day, "check", 1.5)  # 전체 상한 95

    def test_no_key_skips(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(C.main(["toon"]), 0)
        self.assertEqual(C.main(["nope"]), 2)


class ToonJobTest(unittest.TestCase):
    def test_toon_writes_top2_with_prompts(self):
        cut = {"screen": "밥솥에서 금화", "caption": "보온 켜 뒀더니", "camera": "fixed camera"}
        v = {"title": "t", "motif": "drip", "frame": "versus", "place": "부엌", "hook": "h", "cuts": [cut] * 4, "number_box": "1년 약 8만 9천 원",
             "number_source": "q/rice-cooker", "gag": "철퍼덕", "tip": "보온 끄기", "why_fun": "w",
             "band_top": "밥솥 보온 켜 둔 집", "band_accent": "의외로 모르는 진실", "yt_title": "밥솥 보온, 하루 종일 켜 두면?", "heart": "",
             "summary": "밥솥 보온 잡음", "vote_a": "난방비", "vote_b": "배달비"}
        replies = [{"variants": [dict(v, title=f"안{i}") for i in range(8)]},
                   {"scores": [{"idx": i, "hook": 5, "fun": 5, "aha": 5, "bible": 5, "clarity": 5, "total": 25 + i, "note": "n"}
                               for i in range(8)], "best": [7, 6]},
                   {"variants": [dict(v, title="안7고침"), dict(v, title="안6고침")]},
                   {"scores": [{"idx": 0, "hook": 9, "fun": 9, "aha": 9, "bible": 9, "clarity": 9, "click": 10, "total": 58, "note": "좋아짐"},
                               {"idx": 1, "hook": 5, "fun": 5, "aha": 5, "bible": 5, "clarity": 5, "total": 20, "note": "나빠짐"}],
                    "best": [0]},
                   {"variants": [dict(v, title="안6또고침")]},
                   {"scores": [{"idx": 0, "hook": 9, "fun": 9, "aha": 9, "bible": 9, "clarity": 9, "click": 9, "total": 57, "note": "n"}],
                    "best": [0]},
                   {"prompts": ["p1", "p2", "p3", "p4"]}, {"prompts": ["q1", "q2", "q3", "q4"]}]
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            (root / "config").mkdir()
            (root / "config/toon_bible.md").write_text("bible", encoding="utf-8")
            (root / "config/toon_motifs.json").write_text(json.dumps({"motifs": [{"id": "fly"}, {"id": "drip"}],
                                                                       "frames": [{"id": "chase"}]}), encoding="utf-8")
            (root / "data/toon/lab").mkdir(parents=True)
            (root / "data/toon/lab/2026-12-02.md").write_text("# x\n- 모양·틀: fly / chase\n", encoding="utf-8")
            for sub in ("data/episodes", "data/articles"):
                (root / sub).mkdir(parents=True)
            (root / "data/calc_questions.json").write_text("[]", encoding="utf-8")
            info = {"date": "2026-12-04", "concept": {"id": "x"}}
            season = {"id": "2026-12-04", "title": "겨울 대작전", "goal": "꿀꿀이 채우기", "running_gag": "조카 몰래 빼 감",
                      "topics": ["난방비", "배달비"], "started": "2026-12-04"}
            with mock.patch.object(C, "ROOT", root), mock.patch("pipeline.toon_series.ROOT", root), \
                    mock.patch("pipeline.toon_series.plan_season", return_value=season), \
                    mock.patch("pipeline.toon_series.breakout", return_value=None), \
                    mock.patch("pipeline.episodes.info_short", return_value=info), \
                    mock.patch.object(C, "ask", side_effect=replies), \
                    mock.patch.object(C, "open_pr", return_value=None) as pr:
                self.assertEqual(C.toon(dt.date(2026, 11, 20)), 0)
                md = (root / "data/toon/lab/2026-12-04.md").read_text(encoding="utf-8")
                self.assertIn("1안: 안7고침  (점수 58/60, 다듬기 전 32)", md)  # 오른 것만 바뀜
                self.assertIn("2안: 안6또고침  (점수 57/60, 다듬기 전 31)", md)  # 1차에 내려가 버리고 2차에 오름
                self.assertIn("`p1`", md)
                self.assertIn("- 모양·틀: drip / versus", md)
                self.assertEqual(C.recent_motifs("2026-12-04"), (["fly"], ["chase"]))
                self.assertIn("최근 편에서 쓴 것, 금지: ['fly']", C.ask.call_args_list[0].args[2])
                self.assertIn("| 0 | 안0 (밥솥 보온 켜 둔 집 / 의외로 모르는 진실) |", md)
                self.assertIn("- 제목 띠: **밥솥 보온 켜 둔 집** / **의외로 모르는 진실** (흰 줄 / 노란 줄, 클릭 10/10)", md)
                self.assertIn("- 유튜브 제목: 밥솥 보온, 하루 종일 켜 두면?", md)
                self.assertIn("[제목 띠·유튜브 제목", C.ask.call_args_list[0].args[1])
                self.assertIn("click=", C.ask.call_args_list[1].args[1])
                pr.assert_called_once()
                # 시즌 빌드업: 작가 프롬프트에 시즌 덩어리, 1안이 시즌 기록·투표로, 투표 파일이 PR 에 같이
                self.assertIn("[시즌 빌드업 — '겨울 대작전' 1/10편", C.ask.call_args_list[0].args[2])
                self.assertIn("data/toon/season.json", pr.call_args.args[3])
                st = json.loads((root / "data/toon/season.json").read_text(encoding="utf-8"))
                self.assertEqual(st["log"][0]["title"], "안7고침")
                self.assertEqual([p["date"] for p in st["polls"]], ["2026-12-04"])
                self.assertIn("시즌: **겨울 대작전**", md)
                self.assertIn("- 엔딩 투표(다음엔 어디로 갈까?): A 난방비 / B 배달비", md)
                pr.assert_called_once()
                self.assertEqual(C.toon(dt.date(2026, 11, 20)), 0)  # 이미 있으면 다시 안 만듦
                self.assertEqual(pr.call_count, 1)


    def test_toon_replans_when_below_floor(self):
        """BK 11/21 '기획안을 바꿔야지 스킵하면 안돼': 다듬어도 48 아래면 지적을 넣어 새 후보를 다시 쓰고 채점."""
        cut = {"screen": "s", "caption": "c", "camera": "fixed camera"}
        v = {"title": "t", "motif": "drip", "frame": "versus", "place": "부엌", "hook": "h", "cuts": [cut] * 4, "number_box": "",
             "number_source": "", "gag": "g", "tip": "t", "why_fun": "w", "band_top": "a", "band_accent": "b", "yt_title": "y",
             "heart": "", "summary": "", "vote_a": "", "vote_b": ""}
        sc = lambda i, t: {"idx": i, "hook": 5, "fun": 5, "aha": 5, "bible": 5, "clarity": 5, "click": 5, "total": t, "note": f"약점{i}"}
        replies = [{"variants": [dict(v, title=f"안{i}", place=f"곳{i}") for i in range(8)]},
                   {"scores": [sc(i, 30 + i) for i in range(8)], "best": [7, 6]},
                   {"variants": [dict(v, title=f"새안{i}", place=f"새곳{i}") for i in range(4)]},
                   {"scores": [sc(0, 40), sc(1, 50), sc(2, 20), sc(3, 45)], "best": [1, 3]},
                   {"prompts": ["p1", "p2", "p3", "p4"]}, {"prompts": ["q1", "q2", "q3", "q4"]}]
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            (root / "config").mkdir()
            (root / "config/toon_bible.md").write_text("bible", encoding="utf-8")
            (root / "config/toon_motifs.json").write_text(json.dumps({"motifs": [{"id": "drip"}], "frames": [{"id": "versus"}]}),
                                                         encoding="utf-8")
            for sub in ("data/episodes", "data/articles", "data/toon/lab"):
                (root / sub).mkdir(parents=True)
            (root / "data/calc_questions.json").write_text("[]", encoding="utf-8")
            info = {"date": "2026-12-05", "concept": {"id": "x"}}  # 토요일 = 실사 특별편(시즌 밖)
            with mock.patch.object(C, "ROOT", root), mock.patch("pipeline.episodes.info_short", return_value=info), \
                    mock.patch.object(C, "REFINE_ROUNDS", 0), mock.patch.object(C, "REPLAN_ROUNDS", 1), \
                    mock.patch.object(C, "ask", side_effect=replies), \
                    mock.patch.object(C, "open_pr", return_value="u"), mock.patch.object(C, "notify") as note:
                self.assertEqual(C.toon(dt.date(2026, 11, 21)), 0)
                md = (root / "data/toon/lab/2026-12-05.md").read_text(encoding="utf-8")
                self.assertIn("[새 기획 1차", C.ask.call_args_list[2].args[2])
                self.assertIn("약점7", C.ask.call_args_list[2].args[2])  # 떨어진 안의 지적이 새 기획에 들어감
                self.assertIn("1안: 새안1  (점수 50/60)", md)
                self.assertIn("새 기획 1번", md)
                self.assertNotIn("쉬는 걸 추천", md)
                self.assertIn("대본 후보 2안", note.call_args.args[0])

class CacheTest(unittest.TestCase):
    def test_cache_cost(self):
        # Opus 입력 4달러/백만: 5분 쓰기 1.25배, 1시간 쓰기 2배, 읽기 0.05배
        self.assertAlmostEqual(C.cost(C.OPUS, {"cache_creation_input_tokens": 1_000_000}), 5.0)
        self.assertAlmostEqual(C.cost(C.OPUS, {"cache_creation_input_tokens": 1_000_000,
                                               "cache_creation": {"ephemeral_1h_input_tokens": 1_000_000}}), 8.0)
        self.assertAlmostEqual(C.cost(C.OPUS, {"cache_read_input_tokens": 1_000_000}), 0.2)

    def test_ask_cache_block(self):
        import sys
        import types
        seen = {}

        class Msgs:
            def create(self, **kw):
                seen.update(kw)
                return types.SimpleNamespace(usage={"input_tokens": 1, "output_tokens": 1}, stop_reason="end_turn",
                                             content=[types.SimpleNamespace(type="text", text="ok")])
        fake = types.SimpleNamespace(Anthropic=lambda: types.SimpleNamespace(beta=types.SimpleNamespace(messages=Msgs())))
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(sys.modules, {"anthropic": fake}), \
                mock.patch.object(C, "USAGE_DIR", pathlib.Path(d)):
            C.ask("check", "규칙", "글", model=C.HAIKU, cache="1h")
            self.assertEqual(seen["system"], [{"type": "text", "text": "규칙",
                                               "cache_control": {"type": "ephemeral", "ttl": "1h"}}])
            C.ask("check", "규칙", "글", model=C.HAIKU)
            self.assertEqual(seen["system"], "규칙")  # 기본은 캐시 안 씀(한 번만 부르는 작업)


class BatchTest(unittest.TestCase):
    """배치(50% 할인): 성공하면 반값 기록, 실패·거절이면 일반 호출로 다시."""

    @staticmethod
    def message(text, stop="end_turn"):
        import types
        return types.SimpleNamespace(usage={"input_tokens": 0, "output_tokens": 100_000}, stop_reason=stop,
                                     content=[types.SimpleNamespace(type="text", text=text)])

    def fake(self, batch_result, direct_text="direct"):
        import types
        calls = {"batch": [], "direct": []}
        message = self.message

        class Batches:
            def create(self, requests):
                calls["batch"].append(requests[0]["params"])
                return types.SimpleNamespace(id="b1")

            def retrieve(self, _id):
                return types.SimpleNamespace(processing_status="ended")

            def cancel(self, _id):
                pass

            def results(self, _id):
                if batch_result is None:
                    return [types.SimpleNamespace(result=types.SimpleNamespace(type="expired"))]
                return [types.SimpleNamespace(result=types.SimpleNamespace(type="succeeded", message=batch_result))]

        class Msgs:
            batches = Batches()

            def create(self, **kw):
                calls["direct"].append(kw)
                return message(direct_text)

        mod = types.SimpleNamespace(Anthropic=lambda: types.SimpleNamespace(beta=types.SimpleNamespace(messages=Msgs())),
                                    APIError=Exception)
        return mod, calls

    def run_ask(self, mod, job="adsense", **kw):
        import sys
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(sys.modules, {"anthropic": mod}), \
                mock.patch.object(C, "USAGE_DIR", pathlib.Path(d)), mock.patch.object(C, "BATCH_POLL_SEC", 0):
            out = C.ask(job, "규칙", "글", model=C.SONNET, cache="5m", **kw)
            return out, C.load_ledger(C.today_kst())

    def test_batch_half_price(self):
        mod, calls = self.fake(self.message("batched"))
        out, rows = self.run_ask(mod)
        self.assertEqual(out, "batched")
        self.assertEqual(calls["direct"], [])
        params = calls["batch"][0]
        self.assertNotIn("fallbacks", params)  # 배치는 fallbacks 를 못 씀
        self.assertEqual(params["system"][0]["cache_control"], {"type": "ephemeral", "ttl": "1h"})  # 배치면 1시간
        self.assertEqual(rows[-1]["usd"], 0.5)  # Sonnet 출력 10만 토큰 1달러 → 반값
        self.assertTrue(rows[-1]["batch"])

    def test_expired_falls_back(self):
        mod, calls = self.fake(None)
        out, rows = self.run_ask(mod)
        self.assertEqual(out, "direct")
        self.assertEqual(calls["direct"][0]["fallbacks"], "default")
        self.assertEqual(rows[-1]["usd"], 1.0)

    def test_refusal_retries_with_fallbacks(self):
        mod, calls = self.fake(self.message("", stop="refusal"))
        out, rows = self.run_ask(mod)
        self.assertEqual(out, "direct")
        self.assertEqual([r["usd"] for r in rows[-2:]], [0.5, 1.0])

    def test_not_batched_jobs(self):
        mod, calls = self.fake(None)
        with mock.patch.dict(os.environ, {"CLAUDE_BATCH": "1"}):
            out, _rows = self.run_ask(mod, job="raksil")
        self.assertEqual(calls["batch"], [])
        self.assertEqual(out, "direct")


class HeartTurnTest(unittest.TestCase):
    def test_one_in_three(self):
        days = [(dt.date(2026, 12, 2) + dt.timedelta(days=2 * k)).isoformat() for k in range(9)]
        self.assertEqual(sum(C.heart_turn(d) for d in days), 3)


class GscTest(unittest.TestCase):
    def test_gsc_rows_aggregate(self):
        q, p = C.gsc_rows()
        self.assertTrue(all("impressions" in r and isinstance(r["pos"], float) for r in q + p))
        self.assertEqual([r["impressions"] for r in q], sorted((r["impressions"] for r in q), reverse=True))


if __name__ == "__main__":
    unittest.main()


class MoodGateTest(unittest.TestCase):  # BK 2026-11-20 밤: 네 가지 결 + 품질 게이트
    def test_mood_rotates_all_four(self):
        import datetime as dt
        days = [(dt.date(2026, 11, 21) + dt.timedelta(days=k)).isoformat() for k in range(4)]
        self.assertEqual(sorted(C.mood_of(d) for d in days), sorted(C.MOODS))
        self.assertEqual(C.mood_of("2026-11-24"), C.mood_of("2026-11-24"))

    def test_rules_ban_money_framing(self):
        self.assertIn("금화", C.MOOD_RULE)
        self.assertIn("중독성", C.MOOD_RULE)
        self.assertGreater(C.QUALITY_FLOOR, 0)


class PolicyCheckTest(unittest.TestCase):
    def test_article_gets_auto_disclosure(self):
        seen = {}

        def fake_ask(job, system, user, **kw):
            seen["user"] = json.loads(user)
            return {"ok": True, "problems": []}
        with mock.patch.object(C, "ask", fake_ask), mock.patch.object(C, "notify", lambda t: True):
            C.check(dt.date(2026, 11, 21))
        keys = [k for k in seen["user"] if k.startswith("data/articles/")]
        self.assertTrue(keys)
        from pipeline import articles as A
        art = json.loads((C.ROOT / keys[0]).read_text(encoding="utf-8"))
        auto = [k for k in keys if "자동으로 붙는 표기" in k]
        self.assertEqual(bool(auto), A.has_affiliate(art))
        if auto:
            self.assertIn("[광고]", seen["user"][auto[0]])
