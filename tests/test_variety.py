"""반복 양산 막기: 직전 3편과 장소·훅 유형·제목 틀·배경·띠가 겹치지 않게 (BK 11/20)."""
import datetime as dt
import json
import pathlib
import tempfile
import unittest
from unittest import mock

from pipeline import claude_jobs as cj, raksil_shorts as rs


class UncleVarietyTest(unittest.TestCase):
    def test_overlaps(self):
        recent = {"place": ["부엌"], "hook_type": ["시간 점프"], "title_pattern": ["질문"], "motif": ["fly"], "frame": ["chase"]}
        v = {"place": "부엌 식탁", "hook_type": "시간 점프", "title_pattern": "목록", "motif": "drip", "frame": "versus"}
        self.assertEqual(sorted(cj.overlaps(v, recent)), ["hook_type", "place"])
        self.assertEqual(cj.overlaps({"place": "베란다", "hook_type": "대결 선언"}, recent), [])

    def test_recent_variety_reads_lab_notes(self):
        tmp = pathlib.Path(tempfile.mkdtemp())
        (tmp / "data/toon/lab").mkdir(parents=True)
        for d, pl in (("2026-12-02", "부엌"), ("2026-12-04", "욕실"), ("2026-12-06", "거실"), ("2026-12-08", "베란다")):
            (tmp / f"data/toon/lab/{d}.md").write_text(
                f"## 1안: x\n- 모양·틀: drip / versus\n- 장소·훅유형·제목틀: {pl} / 시간 점프 / 질문\n## 2안: y\n"
                "- 장소·훅유형·제목틀: 다락 / 공감 한숨 / 순위\n", encoding="utf-8")
        with mock.patch.object(cj, "ROOT", tmp):
            rv = cj.recent_variety("2026-12-08")
        self.assertEqual(rv["place"], ["거실", "욕실", "부엌"])  # 직전 3편, 1안만
        self.assertEqual(rv["hook_type"], ["시간 점프"] * 3)

    def test_schema_has_variety_fields(self):
        props = cj.VARIANT["properties"]
        self.assertIn("hook_type", props)
        self.assertIn("title_pattern", props)


class RaksilVarietyTest(unittest.TestCase):
    def test_theme_differs_from_last_three_days(self):
        d = dt.date(2026, 11, 21)
        last3 = {rs.theme_for(d - dt.timedelta(days=k)) for k in (1, 2, 3)}
        self.assertNotIn(rs.theme_for(d), last3)

    def test_recent_bands_and_fresh(self):
        tmp = pathlib.Path(tempfile.mkdtemp()) / "up.json"
        tmp.write_text(json.dumps({
            "2026-11-18": {"title": "3초 안에 고르면 결단력 인정 | A vs B #밸런스게임"},
            "2026-11-19": {"title": "A vs B 너라면? #밸런스게임"},
            "2026-11-19-game-bag-new": {"title": "[신작] x | y"},
            "2026-11-20": {"title": "친구랑 꼭 갈리는 밸런스게임 | C vs D"}}), encoding="utf-8")
        recent = rs.recent_bands(log=tmp)
        self.assertEqual(recent, ["친구랑 꼭 갈리는 밸런스게임", "3초 안에 고르면 결단력 인정"])
        self.assertFalse(rs.fresh_band({"top": "3초 안에 고르면", "accent": "새 말"}, recent))
        b = rs.bank_band(dt.date(2026, 11, 21), recent)
        self.assertTrue(rs.fresh_band(b, recent))
        cands = [{"top": "친구랑 꼭 갈리는", "accent": "라면 대결", "click": 10}, {"top": "아침마다 고민되는", "accent": "출근 메뉴", "click": 7}]
        self.assertEqual(rs.best_band(cands, recent)["top"], "아침마다 고민되는")


if __name__ == "__main__":
    unittest.main()
