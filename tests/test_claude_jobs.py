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
             "band_top": "밥솥 보온 켜 둔 집", "band_accent": "의외로 모르는 진실", "yt_title": "밥솥 보온, 하루 종일 켜 두면?", "heart": ""}
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
            with mock.patch.object(C, "ROOT", root), \
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
                self.assertEqual(C.toon(dt.date(2026, 11, 20)), 0)  # 이미 있으면 다시 안 만듦
                self.assertEqual(pr.call_count, 1)


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
