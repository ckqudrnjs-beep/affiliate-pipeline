"""쇼츠 공개 2시간 반응 리포트 + 다음 편 규칙 고리 (2026-11-20)."""
import datetime as dt
import json
import pathlib
import tempfile
import unittest
from unittest import mock

from pipeline import yt_early as ye

UTC = dt.timezone.utc


class EarlyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.p = [mock.patch.object(ye, n, self.tmp / f) for n, f in
                  (("EARLY", "early.json"), ("LESSONS", "lessons.json"), ("LOG", "up.json"), ("RAKSIL", "rk.json"),
                   ("STATS", "stats.json"), ("EP_DIR", "ep"))]
        for x in self.p:
            x.start()
        (self.tmp / "ep").mkdir()
        (self.tmp / "up.json").write_text(json.dumps({"ep-2026-11-20-skit-q": {
            "video_id": "U1", "publish_at": "2026-11-20T19:00:00+09:00"}}), encoding="utf-8")
        (self.tmp / "rk.json").write_text(json.dumps({"2026-11-20": {"id": "R1", "title": "A vs B #shorts"},
                                                      "2026-11-20-game-bag-new": {"id": "G1", "title": "[신작]"}}),
                                          encoding="utf-8")

    def tearDown(self):
        for x in self.p:
            x.stop()

    def test_kind(self):
        self.assertEqual(ye.kind_of("ep-2026-11-20-skit-q"), "삼촌")
        self.assertEqual(ye.kind_of("5raksil-2026-11-20"), "5락실 밸런스")
        self.assertEqual(ye.kind_of("5raksil-2026-11-20-game-bag-new"), "5락실 게임")

    def test_verdict_needs_baseline(self):
        self.assertEqual(ye.verdict(100, [50, 60]), ("기준 쌓는 중", None))
        self.assertEqual(ye.verdict(100, [50, 50, 50])[0], "평소보다 잘 나감")
        self.assertEqual(ye.verdict(20, [50, 50, 50])[0], "평소보다 느림")

    def test_run_reports_only_2h_old_and_feeds_lessons(self):
        now = dt.datetime(2026, 11, 20, 12, 10, tzinfo=UTC)  # 21:10 KST → 삼촌 19:00 편 130분
        stats = {"U1": {"views": 40, "likes": 2, "comments": 0, "published": "2026-11-20T10:00:00Z"},
                 "R1": {"views": 300, "likes": 3, "comments": 1, "published": "2026-11-20T08:00:00Z"},  # 250분 → '늦게 봄'으로 보고, 기준 제외
                 "G1": {"views": 5, "likes": 0, "comments": 0, "published": "2026-11-20T11:00:00Z"}}    # 70분 → 제외
        with mock.patch.object(ye, "fetch_stats", return_value=stats):
            with mock.patch.object(ye, "ai_hint", return_value=None), \
                 mock.patch("pipeline.api_check.send", return_value=True) as send:
                ye.run(now=now)
        early = json.loads((self.tmp / "early.json").read_text(encoding="utf-8"))
        self.assertEqual(sorted(early), ["R1", "U1"])  # G1(70분)은 아직
        self.assertEqual(len(ye.baseline(early, "5락실 밸런스", "x")), 0)
        self.assertEqual(early["U1"]["age_min"], 130)
        text = send.call_args_list[0][0][0]
        self.assertIn("다음 편 규칙", text)
        self.assertIn("시청 지속", text)  # 한계 안내
        self.assertIn("삼촌", ye.load_lessons())
        self.assertIn("2시간 반응", ye.lessons_prompt("삼촌"))
        self.assertNotIn("좋았던 편", ye.lessons_prompt("5락실 밸런스"))  # 늦게 본 편은 순위에서 뺌
        # 같은 편은 두 번 보고하지 않음
        with mock.patch.object(ye, "fetch_stats", return_value=stats) as fs:
            ye.run(now=now + dt.timedelta(minutes=30), dry=True)
            self.assertNotIn("U1", fs.call_args[0][0])

    def test_late_run_reports_but_skips_baseline(self):
        now = dt.datetime(2026, 11, 20, 16, 0, tzinfo=UTC)  # 01:00 KST → 삼촌 편 6시간 (예약 지연)
        stats = {"U1": {"views": 400, "likes": 5, "comments": 1, "published": "2026-11-20T10:00:00Z"}}
        with mock.patch.object(ye, "fetch_stats", return_value=stats), mock.patch.object(ye, "ai_hint", return_value=None), \
             mock.patch("pipeline.api_check.send", return_value=True) as send:
            ye.run(now=now)
        self.assertIn("늦게", send.call_args[0][0])
        early = json.loads((self.tmp / "early.json").read_text(encoding="utf-8"))
        self.assertEqual(ye.baseline(early, "삼촌", "x"), [])

    def test_scheduled_raksil_not_reported_before_public(self):
        """11/24: 08:34에 올려 17:00 예약된 5락실 편을 업로드 시각 기준 '6시간 조회 1'로 보고 → 공개 전엔 건너뛰고, 나이는 17:00부터."""
        now = dt.datetime(2026, 11, 20, 5, 57, tzinfo=UTC)  # 14:57 KST
        stats = {"R1": {"views": 1, "likes": 0, "comments": 0, "published": "2026-11-19T23:34:00Z", "privacy": "private",
                        "publish_at": "2026-11-20T08:00:00Z"}}
        with mock.patch.object(ye, "fetch_stats", return_value=stats), mock.patch.object(ye, "ai_hint", return_value=None), \
             mock.patch("pipeline.api_check.send", return_value=True) as send:
            ye.run(now=now)
        send.assert_not_called()
        self.assertFalse((self.tmp / "early.json").exists() and "R1" in json.loads((self.tmp / "early.json").read_text()))
        up = dt.datetime(2026, 11, 19, 23, 34, tzinfo=UTC)
        self.assertEqual(ye.raksil_public_at("5raksil-2026-11-20", up), dt.datetime(2026, 11, 20, 8, 0, tzinfo=UTC))
        late = dt.datetime(2026, 11, 20, 9, 0, tzinfo=UTC)  # 18:00 KST 업로드 = 바로 공개
        self.assertEqual(ye.raksil_public_at("5raksil-2026-11-20", late), late)

    def test_lessons_keep_latest_and_dedupe(self):
        early, les = {}, {}
        for i in range(7):
            row = {"id": f"V{i}", "slug": f"ep-{i}", "kind": "삼촌", "title": f"t{i}", "public_at": f"2026-11-{10+i}T19:00",
                   "checked_at": "x", "age_min": 120, "views": i * 10, "likes": 0, "comments": 0}
            early[row["id"]] = row
            les = ye.update_lessons(les, early, row, "평소 수준", {"next": f"규칙{i % 6}"})
        rules = [r["rule"] for r in les["삼촌"]["rules"]]
        self.assertEqual(len(rules), ye.KEEP_RULES)
        self.assertEqual(rules[0], "규칙0")  # 7번째(i=6) → 규칙0, 중복은 맨 위로
        self.assertEqual(les["삼촌"]["best"][0]["title"], "t6")

    def test_rule_hint_and_clean(self):
        h = ye.rule_hint({"views": 10, "likes": 0, "comments": 0}, "평소보다 느림")
        self.assertTrue(h["next"])
        self.assertEqual(ye._clean("쿠팡 특가 링크", 50), "")

    def test_toon_prompt_reads_lessons(self):
        src = (pathlib.Path(__file__).resolve().parents[1] / "src/pipeline/claude_jobs.py").read_text(encoding="utf-8")
        self.assertIn('lessons_prompt("삼촌")', src)
        self.assertIn("early", __import__("pipeline.claude_jobs", fromlist=["JOB_CAP"]).JOB_CAP)


if __name__ == "__main__":
    unittest.main()


class PlaylistTest(unittest.TestCase):
    """BK 11/20 '재생목록은 분류별로': 2시간 리포트에 넣을 재생목록 한 줄."""

    def test_kinds(self):
        self.assertEqual(ye.playlist_of({"kind": "삼촌", "style": "toon", "slug": "ep-2026-11-20-skit-q"}),
                         "동전이네 겨울 이야기")
        self.assertEqual(ye.playlist_of({"kind": "삼촌", "style": "live", "slug": "ep-2026-11-28-toon"}), "삼촌 특별편")
        self.assertEqual(ye.playlist_of({"kind": "삼촌", "style": "webtoon", "slug": "ep-2026-11-17-leak"}), "")
        self.assertEqual(ye.playlist_of({"kind": "5락실 밸런스", "slug": "5raksil-2026-11-20"}), "몽글이 밸런스게임")
        self.assertEqual(ye.playlist_of({"kind": "5락실 게임", "slug": "5raksil-2026-11-20-game-bag-new"}), "5락실 신작 게임")
        self.assertEqual(ye.playlist_of({"kind": "5락실 몽글이", "slug": "5raksil-meme-x"}), "")

    def test_report_line(self):
        row = {"id": "R1", "slug": "5raksil-2026-11-20", "kind": "5락실 밸런스", "title": "A vs B", "age_min": 120,
               "views": 10, "likes": 1, "comments": 0}
        t = ye.report_text(row, "보통", None, [], None, {"next": "x"})
        self.assertIn("📂 재생목록: '몽글이 밸런스게임'", t)
