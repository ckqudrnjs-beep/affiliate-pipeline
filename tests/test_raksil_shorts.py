import datetime as dt
import pathlib
import importlib.util
import shutil
import unittest

from pipeline import raksil_shorts as r

NEED_RENDER = unittest.skipUnless(importlib.util.find_spec("numpy") and importlib.util.find_spec("PIL") and shutil.which("ffmpeg"),
                                  "numpy/PIL/ffmpeg 없음")

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
        self.assertIn("75퍼센트가 비", r.script(q, res)[2])
        self.assertTrue(r.script(q, None)[0].endswith("너라면?"))
        self.assertFalse(r.script({"a": "가" * 15, "b": "나" * 15}, None)[0].endswith("너라면?"))  # 긴 질문은 짧게
        long_q = {"a": "어디서든 줄 서지 않고 바로 들어가는 능력", "b": "가는 길 신호등이 늘 초록불로 바뀌는 능력"}
        self.assertEqual(r.script(long_q, None)[0], "에이야, 비야? 3초 안에 골라!")  # 11/20 18.9초 편 같은 질문

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
        self.assertEqual(line, "몽글이는 비! 치킨은 진리야.")
        self.assertIn("몽글이 개인 의견", r.description_of(QS[1], None, False, {"pick": "b", "why": "치킨은 진리야"}))

    def test_band_rules(self):
        """제목 띠: 12자 이하 두 줄, 숫자·가짜 통계·지능 비하·광고 말 금지, 클릭 점수 1등."""
        self.assertEqual(r.clean_band({"top": " 고민 없이 고르면 ", "accent": "찐 어른 인정."}), {"top": "고민 없이 고르면", "accent": "찐 어른 인정"})
        self.assertIsNone(r.clean_band({"top": "한국인 99%는", "accent": "B를 고름"}))
        self.assertIsNone(r.clean_band({"top": "고지능자만", "accent": "고를 수 있다"}))
        self.assertIsNone(r.clean_band({"top": "눈썰미 상위", "accent": "인정"}))
        self.assertIsNone(r.clean_band({"top": "가" * 15, "accent": "나"}))  # 흰 줄 = 상황 한 문장, 14자까지 (11/25)
        self.assertIsNone(r.clean_band({"top": "가", "accent": "나" * 13}))
        self.assertIsNone(r.clean_band({"top": "좋아요 누르면", "accent": "알려줌"}))
        self.assertIsNone(r.clean_band({"top": "둘 중 하나", "accent": ""}))
        best = r.best_band([{"top": "한국인 99%는", "accent": "B", "click": 10},
                            {"top": "친구랑 꼭 갈리는", "accent": "라면 vs 치킨", "click": 8},
                            {"top": "의외로 정답이", "accent": "둘로 나뉜다", "click": 7}])
        self.assertEqual(best, {"top": "친구랑 꼭 갈리는", "accent": "라면 vs 치킨"})
        self.assertIsNone(r.best_band(None))
        for d in range(10):
            b = r.bank_band(dt.date(2026, 11, 20) + dt.timedelta(days=d))
            self.assertTrue(len(b["top"]) <= r.BAND_MAX and len(b["accent"]) <= r.BAND_MAX)

    def test_band_title_and_react_side(self):
        q = QS[1]
        t = r.title_of(q, {"top": "친구랑 꼭 갈리는", "accent": "밸런스게임"})
        self.assertTrue(t.startswith("친구랑 꼭 갈리는 밸런스게임 | 평생 라면만 vs 평생 치킨만"))
        self.assertLessEqual(len(r.title_of({"a": "가" * 60, "b": "나" * 60}, {"top": "가" * 12, "accent": "나" * 12})), 100)
        res = r.result_of(QS[2], {"a": 10, "b": 30})
        self.assertEqual(r.react_side(res, None, dt.date(2026, 11, 21)), ("a", "shock"))  # 진 쪽(소수파)
        self.assertEqual(r.react_side(None, {"pick": "b", "why": "x"}, dt.date(2026, 11, 21)), ("b", "happy"))

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

    def test_skipped_record_does_not_block_same_qid(self):
        """쉰 기록(skipped)은 같은 질문으로 다시 만든 편을 막지 않고, 올린 기록만 막는다."""
        import json, os, pathlib, tempfile
        from unittest import mock
        from pipeline import youtube
        d = pathlib.Path(tempfile.mkdtemp())
        old = r.LOG
        r.LOG = d / "log.json"
        said = []
        try:
            os.environ.pop("RAKSIL_YT_ENABLED", None)
            with mock.patch.object(youtube, "summary", side_effect=said.append):
                r.LOG.write_text(json.dumps({"2026-11-22-skip3": {"skipped": True, "qid": "20261122-1", "format": "skip"}}))
                r.upload_meta({"date": "2026-11-22", "qid": "20261122-1", "title": "t"})
                r.LOG.write_text(json.dumps({"2026-11-22-hidden": {"id": "x", "qid": "20261122-1"}}))
                r.upload_meta({"date": "2026-11-22", "qid": "20261122-1", "title": "t"})
        finally:
            r.LOG = old
        self.assertIn("dry-run", said[0])
        self.assertIn("이미 올림", said[1])

    @NEED_RENDER
    def test_balance_frames_keep_shorts_ui_free(self):
        """오른쪽 버튼 자리(x≥900, y 1000~1540)와 아래 제목 자리(y≥1560 위 격자 제외)에 몽글이·글자가 없다."""
        import numpy as np
        q = QS[1]
        res = r.result_of(QS[2], {"a": 10, "b": 30})
        starts = [0.0, 2.6, 4.7, 7.5]
        mg = r.Mongle(dt.date(2026, 11, 21))
        band = {"top": "친구랑 꼭 갈리는", "accent": "밸런스게임"}
        bq, br = r.question_card(q, band), r.twist_card(res, band=band)
        empty = np.asarray(r.background().convert("RGB")).astype(int)
        empty_r = np.asarray(r.background(7).convert("RGB")).astype(int)
        bp = r.twist_card(None, q, {"pick": "a", "why": "라면은 국물이 반이야"})
        for t, ref, base_r, rr in ((0.3, empty, br, res), (1.2, empty, br, res), (3.0, empty, br, res),
                                   (6.0, empty_r, br, res), (6.0, empty_r, bp, None), (8.0, empty_r, br, res), (8.3, empty_r, bp, None)):
            react = (q, *r.react_side(rr, None if rr else {"pick": "a"}, dt.date(2026, 11, 21)))
            a = np.asarray(r.balance_frame(t, starts, bq, base_r, rr, mg, 0.7, react).convert("RGB")).astype(int)
            diff = np.abs(a - ref).sum(axis=2)
            self.assertLess((diff[1000:1540, 900:] > 60).mean(), 0.002, t)
            self.assertLess((diff[1560:, :] > 60).mean(), 0.002, t)


    def test_format_rotation(self):
        """형식 돌리기 (BK 11/20): 5일 한 바퀴, 11/21 갈림길부터, 같은 형식은 5일 안에 다시 안 나온다."""
        import os
        os.environ.pop("RAKSIL_FORMAT", None)
        d0 = dt.date(2026, 11, 21)
        self.assertEqual(r.scheduled_format(d0), "split")
        seq = [r.scheduled_format(d0 + dt.timedelta(days=i)) for i in range(10)]
        for i in range(len(seq) - 4):
            self.assertEqual(len(set(seq[i:i + 5])), 5)
        ok = {f: True for f in r.FORMATS}
        self.assertEqual(r.choose_format(d0, ok), "split")
        self.assertEqual(r.choose_format(d0, {**ok, "split": False}), "quick")  # 조건 안 되면 다음 형식
        self.assertEqual(r.choose_format(d0, ok, ["split", "quick"]), "versus")  # 직전 3편 형식은 건너뜀
        self.assertEqual(r.choose_format(d0, {"classic": True}, ["classic"]), "classic")  # 끝은 늘 classic

    def test_recent_formats_and_quick_comments(self):
        import json, pathlib, tempfile
        log = pathlib.Path(tempfile.mkdtemp()) / "log.json"
        log.write_text(json.dumps({"2026-11-20": {"id": "x", "title": "t"}, "2026-11-21": {"id": "y", "format": "split"},
                                   "2026-11-21-game-1": {"id": "z", "format": "game"}, "2026-11-22": {"id": "w", "format": "quick"}}))
        self.assertEqual(r.recent_formats(3, log), ["quick", "split", "classic"])
        self.assertIsNone(r.comment_votes(dt.date(2026, 11, 22), QS[1], log))  # 3연속 편 댓글은 A/B 표로 안 셈

    def test_tail_line_and_natural_dialogue(self):
        # 11/21 편집장 지적: '대.' 어색, 중독성 장치 없음 → 자연스러운 대사 + 질문 맞춤 꼬리 한 줄
        q = QS[1]
        self.assertNotIn("대.", r.script(q, None)[0])
        self.assertIn("아니면", r.script(q, None)[0])
        p = r.clean_pick({"pick": "a", "why": "국물이 반이야", "tail": "라면 국물에 밥 만 사람?"})
        self.assertEqual(p["tail"], "라면 국물에 밥 만 사람?")
        self.assertEqual(r.fmt_script("split", q, None, p)[3], "라면 국물에 밥 만 사람?")
        self.assertIn("꼬리 한 줄", r.brief_of("split", q, None, p, r.fmt_script("split", q, None, p)))
        for bad in ("내일은 2탄: 일기 vs 탐구", "구독하면 알려줄게", "가" * 17, "댓글 안 쓰면 몽글이 울어"):
            self.assertNotIn("tail", r.clean_pick({"pick": "a", "why": "x", "tail": bad}), bad)
        self.assertEqual(r.fmt_script("split", q, None, {"pick": "a", "why": "x"})[3], "")  # 꼬리 없으면 원래대로

    def test_format_scripts(self):
        q = QS[1]
        pick = {"pick": "a", "why": "라면은 국물이 반이야"}
        self.assertEqual(len(r.fmt_script("split", q, None, pick)), 4)
        self.assertIn("몽글이는 에이", r.fmt_script("versus", q, None, pick)[2])
        prev = {"pick": {"pick": "b", "why": "x"}}
        self.assertTrue(r.fmt_script("result", q, None, None, prev)[0].startswith("어제 몽글이는 비"))
        res = r.result_of(QS[2], {"a": 10, "b": 30})
        self.assertIn("75퍼센트가 비", r.fmt_script("result", q, res, None)[0])
        self.assertEqual(len(r.fmt_script("quick", q, None, None)), 5)
        for line in sum((r.fmt_script(f, q, None, pick, prev) for f in ("split", "versus", "result", "quick")), []):
            self.assertNotIn("%", line)
        t = r.title_of(q, {"top": "친구랑 꼭 갈리는", "accent": "밸런스게임"}, "quick")
        self.assertIn("| 3연속: 평생 라면만", t)
        d = r.description_of(q, None, False, None, [q, QS[0], QS[2]])
        self.assertIn("3. 여름 vs 겨울", d)
        self.assertIn("AAB", d)

    @NEED_RENDER
    def test_format_frames_keep_shorts_ui_free(self):
        """새 형식 4가지도 오른쪽 버튼 자리(x≥900, y 1000~1540)와 아래 제목 자리(y≥1560)를 비운다."""
        import numpy as np
        q, mg = QS[1], r.Mongle(dt.date(2026, 11, 21))
        band = {"top": "친구랑 꼭 갈리는", "accent": "밸런스게임"}
        pick = {"pick": "b", "why": "치킨은 진리야"}
        res = r.result_of(QS[2], {"a": 10, "b": 30})
        ctx = {"q": q, "res": None, "pick": pick, "mg": mg, "step": 0.7}
        cases = []
        st4 = [0.0, 2.6, 4.7, 7.5]
        for k in (0.3, 3.0, 4.0, 5.0, 6.0, 8.0):
            cases.append((r.split_frame, k, st4, {**ctx, "base": r.split_card(q, band)}, r.background(3)))
            cases.append((r.split_frame, k, st4, {**ctx, "res": res, "base": r.split_card(q, band)}, r.background(3)))
            cases.append((r.versus_frame, k, st4, {**ctx, "base": r.versus_card(q, band)}, r.background(9)))
        st_r = [0.0, 2.6, 3.1, 5.7]
        for k in (0.5, 1.5, 2.8, 4.0, 6.0):
            ref = r.background(13 if k < 2.6 else 15)  # 오늘 카드는 다른 별 배치
            cases.append((r.result_frame, k, st_r, {**ctx, "board": r.board_card(QS[2], None, {"pick": "a"}, band),
                                                     "today": r.today_card(q, band)}, ref))
            cases.append((r.result_frame, k, st_r, {**ctx, "res": res, "board": r.board_card(QS[2], res, None, band),
                                                     "today": r.today_card(q, band)}, ref))
        st_q = [0.0, 1.2, 3.5, 5.8, 8.1]
        qctx = {**ctx, "title": r.quick_title(), "cards": [r.quick_card(x, i, band) for i, x in enumerate(QS)],
                "plains": [r.quick_card(x, i, band, True) for i, x in enumerate(QS)]}
        for k in (0.5, 1.25, 2.0, 3.6, 5.9, 8.5):
            i = max(0, min(2, sum(k >= x for x in st_q[1:4]) - 1))
            cases.append((r.quick_frame, k, st_q, qctx, r.background(19 if k < 1.2 else 17 + i)))
        for fn, t, st, c, ref in cases:
            a = np.asarray(fn(t, st, c).convert("RGB")).astype(int)
            diff = np.abs(a - np.asarray(ref.convert("RGB")).astype(int)).sum(axis=2)
            self.assertLess((diff[1000:1540, 900:] > 60).mean(), 0.002, (fn.__name__, t))
            self.assertLess((diff[1560:, :] > 60).mean(), 0.002, (fn.__name__, t))


    @NEED_RENDER
    def test_home_feed_safe_frame(self):
        """11/22 BK: 유튜브 앱 홈 피드 미리보기(가운데 4:5 = y 285~1635)에서 띠·글자가 잘리지 않게 내용 전체를 안전 구역으로."""
        import numpy as np
        q, mg = QS[1], r.Mongle(dt.date(2026, 11, 21))
        band = {"top": "친구랑 꼭 갈리는", "accent": "밸런스게임"}
        pick = {"pick": "b", "why": "치킨은 진리야"}
        under = r.background()
        try:
            r._LAYER = True
            ctx = {"q": q, "res": None, "pick": pick, "mg": mg, "step": 0.7, "base": r.versus_card(q, band)}
            frames = [r.versus_frame(t, [0.0, 2.6, 4.7, 7.5], ctx) for t in (0.3, 5.0, 8.0)]
            frames.append(r.balance_frame(0.3, [0.0, 2.6, 4.7, 7.5], r.question_card(q), r.twist_card(None, q, pick), None, mg))
        finally:
            r._LAYER = False
        ref = np.asarray(under.convert("RGB")).astype(int)
        top = (r.H - r.W * 5 // 4) // 2
        x0, y0, x1, y1 = r.safe_box()
        self.assertGreaterEqual(y0, top)
        self.assertLessEqual(y1, 1580)  # 아래 제목·채널 이름 자리 위
        for i, f in enumerate(frames):
            a = np.asarray(r.to_safe(f, under).convert("RGB")).astype(int)
            diff = np.abs(a - ref).sum(axis=2) > 60
            self.assertFalse(diff[:top].any(), i)
            self.assertFalse(diff[y1 + 2:].any(), i)
            self.assertLess(diff[1120:1600, 900:].mean(), 0.002, i)  # 오른쪽 버튼 자리 (원래 y≥1000 규칙이 옮겨진 곳)
        self.assertEqual(r.to_safe(frames[0], under).getpixel((5, y0 + 20))[:3], (0, 0, 0))  # 띠는 폭 전체
        self.assertNotEqual(r.to_safe(frames[3], under).getpixel((5, y0 + 20))[:3], (0, 0, 0))  # 띠 없으면 검은 막대 없음

    def test_gate_total(self):
        """품질 게이트: 결 넷 중 최고 + 중독성 + 문구 + 구도, 32/40 이상이고 한 칸도 6 미만이 없어야 통과."""
        good = {"fresh": 9, "insight": 3, "afterglow": 2, "joy": 4, "addictive": 8, "copy": 8, "layout": 8}
        self.assertEqual(r.gate_total(good), (33, True))
        self.assertFalse(r.gate_total({**good, "copy": 5})[1])  # 문구 한 칸이 약하면 탈락
        self.assertFalse(r.gate_total({**good, "fresh": 7, "addictive": 7})[1])  # 30점
        self.assertEqual(r.gate_total({})[0], 0)

    @NEED_RENDER
    def test_layout_ok(self):
        short = {"a": "평생 라면만", "b": "평생 치킨만"}
        long_q = {"a": "어디서든 줄 서지 않고 바로 들어가는 능력 그리고 하나 더", "b": "가는 길 신호등이 늘 초록불로 바뀌는 능력 그리고 하나 더"}
        self.assertTrue(r.layout_ok("split", [short]))
        self.assertFalse(r.layout_ok("split", [long_q]))
        self.assertFalse(r.layout_ok("quick", [short, short, {"a": long_q["a"] * 2, "b": "x"}]))  # 3연속은 세 질문 모두

    def _gate_env(self, scores, replan=None):
        import json, os, pathlib, tempfile
        d = pathlib.Path(tempfile.mkdtemp())
        saved = (r.LOG, r.mongle_plan, r.judge, r.fetch_votes, r.replan, os.environ.pop("RAKSIL_QID", None))
        r.LOG = d / "log.json"
        r.LOG.write_text("{}")
        calls = {"plan": [], "judge": 0, "replan": [], "briefs": []}

        def plan(q, feedback=""):
            calls["plan"].append((q["id"], feedback))
            return {"pick": "a", "why": "그냥 끌려서"}, {"top": "친구랑 꼭 갈리는", "accent": "밸런스게임"}

        def judge(kind, brief):
            calls["judge"] += 1
            calls["briefs"].append(brief)
            return scores(calls["judge"])

        def rp(q, sc, hist, fresh):
            calls["replan"].append((q["a"], sc.get("note"), len(hist), fresh))
            return replan(q, sc, hist, fresh) if replan else None
        r.mongle_plan, r.judge, r.fetch_votes, r.replan = plan, judge, lambda qid: None, rp
        return d, saved, calls

    def _gate_restore(self, saved):
        r.LOG, r.mongle_plan, r.judge, r.fetch_votes, r.replan = saved[:5]

    def test_gate_soft(self):
        """최후 기준: 밸런스 25/40 이상(BK 11/24), 게임 28/40 이상·한 칸도 5 미만 없음."""
        self.assertTrue(r.gate_soft({"fresh": 7, "addictive": 7, "copy": 7, "layout": 7}))
        self.assertTrue(r.gate_soft({"fresh": 7, "addictive": 6, "copy": 6, "layout": 6}))      # 25
        self.assertFalse(r.gate_soft({"fresh": 6, "addictive": 6, "copy": 6, "layout": 6}))     # 24
        self.assertFalse(r.gate_soft({"fresh": 7, "addictive": 6, "copy": 6, "layout": 6}, r.GATE_SOFT_GAME))
        self.assertFalse(r.gate_soft({"fresh": 9, "addictive": 4, "copy": 8, "layout": 8}))
        self.assertTrue(r.gate_soft({"fresh": 6, "addictive": 7, "copy": 7, "layout": 7}))      # 27 ≥ 25
        self.assertFalse(r.gate_soft({"fresh": 6, "addictive": 7, "copy": 7, "layout": 7}, r.GATE_SOFT_GAME))

    def test_clean_q(self):
        self.assertEqual(r.clean_q(" 식은 피자 첫 조각 ", "치즈 없는 끝 빵?"), ("식은 피자 첫 조각", "치즈 없는 끝 빵"))
        self.assertIsNone(r.clean_q("가" * 17, "나"))
        self.assertIsNone(r.clean_q("같은 말", "같은 말"))
        self.assertIsNone(r.clean_q("90% 확률", "x표"))

    @NEED_RENDER
    def test_gate_replans_with_feedback_until_pass(self):
        """BK 11/21 '기획안을 바꿔야지 스킵하면 안돼': 미달이면 지적대로 질문까지 고쳐 다시, 2번 연속 미달이면 새 소재."""
        low = {"fresh": 4, "insight": 4, "afterglow": 4, "joy": 4, "addictive": 5, "copy": 5, "layout": 8, "note": "질문이 뻔함"}
        ok = {"fresh": 9, "insight": 5, "afterglow": 5, "joy": 6, "addictive": 8, "copy": 8, "layout": 8, "note": ""}
        n = {"i": 0}

        def replan(q, sc, hist, fresh):
            n["i"] += 1
            return ({**q, "a": f"새 질문 {n['i']}", "b": f"다른 쪽 {n['i']}", "rewritten": True},
                    {"pick": "b", "why": "손잡이잖아"}, {"top": "진짜 고민되는", "accent": f"선택 {n['i']}"})
        d, saved, calls = self._gate_env(lambda k: ok if k == 4 else low, replan)
        try:
            import unittest.mock as um
            with um.patch.object(r, "tts", side_effect=RuntimeError("stop")):
                with self.assertRaises(RuntimeError):
                    r.render(dt.date(2026, 12, 5), d)
            self.assertEqual(calls["judge"], 4)
            self.assertEqual([c[1] for c in calls["replan"]], ["질문이 뻔함"] * 3)  # 지적이 다시 짜기에 들어감
            self.assertEqual([c[3] for c in calls["replan"]], [False, True, False])  # 같은 소재 2번 미달 → 새 소재
            self.assertIn("새 질문 3", calls["briefs"][-1])  # 고친 질문으로 채점
        finally:
            self._gate_restore(saved)

    @NEED_RENDER
    def test_gate_judges_every_plan_of_a_batch(self):
        """BK 11/22 '짜는 방식 바꾸기': 다시 짜기가 낸 여러 안을 모두 채점한 뒤에야 다시 짜고, 묶음 최고안을 바탕으로."""
        def sc(t, note):
            return {"fresh": t, "insight": t, "afterglow": t, "joy": t, "addictive": t, "copy": t, "layout": t, "note": note}
        scores = {1: sc(5, "첫 안"), 2: sc(5, "묶음1"), 3: sc(6, "묶음2 최고"), 4: sc(5, "묶음3"), 5: sc(9, "")}
        n = {"i": 0}

        def replan(q, sc_, hist, fresh):
            n["i"] += 1
            return [({**q, "a": f"안{n['i']}-{k}", "b": f"반대{n['i']}-{k}", "rewritten": True},
                     {"pick": "a", "why": "손잡이잖아"}, {"top": "비 오는 날", "accent": f"우산 {k}"}) for k in range(3)]
        d, saved, calls = self._gate_env(lambda k: scores.get(k, sc(5, "x")), replan)
        try:
            import unittest.mock as um
            with um.patch.object(r, "tts", side_effect=RuntimeError("stop")):
                with self.assertRaises(RuntimeError):
                    r.render(dt.date(2026, 12, 5), d)
            self.assertEqual(calls["judge"], 5)
            self.assertEqual(len(calls["replan"]), 2)  # 1번째 미달 → 3안, 3안 모두 채점 뒤 한 번 더
            self.assertEqual(calls["replan"][1][1], "묶음2 최고")  # 묶음 최고안의 지적으로
            self.assertEqual(calls["replan"][1][0], "안1-1")
        finally:
            self._gate_restore(saved)

    @NEED_RENDER
    def test_gate_soft_last_resort(self):
        """끝까지 미달이어도 최고안이 최후 기준 이상이면 쉬지 않고 그 안으로 진행."""
        mid = {"fresh": 7, "insight": 4, "afterglow": 4, "joy": 4, "addictive": 7, "copy": 7, "layout": 8, "note": "조금 약함"}
        d, saved, calls = self._gate_env(lambda k: mid)
        try:
            import unittest.mock as um
            seen = {}

            def stop(lines, **kw):
                seen["lines"] = lines
                raise RuntimeError("stop")
            with um.patch.object(r, "tts", side_effect=stop):
                with self.assertRaises(RuntimeError):
                    r.render(dt.date(2026, 12, 5), d)
            self.assertEqual(calls["judge"], r.GATE_TRIES)
            self.assertIn("lines", seen)  # 쉬지 않고 렌더까지 감
        finally:
            self._gate_restore(saved)

    @NEED_RENDER
    def test_gate_skips_only_below_soft_floor(self):
        low = {"fresh": 5, "insight": 4, "afterglow": 4, "joy": 5, "addictive": 5, "copy": 5, "layout": 7, "note": "띠가 막연함"}
        d, saved, calls = self._gate_env(lambda n: low)
        try:
            meta = r.render(dt.date(2026, 12, 5), d)
            self.assertIn("최후 기준", meta["skip"])
            self.assertEqual(calls["judge"], r.GATE_TRIES)
            self.assertTrue(any(fb == "띠가 막연함" for _, fb in calls["plan"]))  # 다시 짜기가 안 되면 지적을 넣어 몽글이·띠라도
            self.assertFalse(list(d.glob("*.mp4")))  # 영상은 만들지 않음
            import os
            os.environ.pop("RAKSIL_YT_ENABLED", None)
            self.assertEqual(r.upload_meta(meta), 0)
            import json
            log = json.loads(r.LOG.read_text())
            self.assertTrue(log["2026-12-05"]["skipped"])
            self.assertEqual(r.recent_formats(3, r.LOG), [])  # 쉰 날은 형식 기록에서 빠짐
            self.assertEqual(r.main(["x", "upload", "2026-12-05"]), 0)  # 예비 실행은 다시 안 함
            self.assertEqual(calls["judge"], r.GATE_TRIES)
        finally:
            self._gate_restore(saved)

    @NEED_RENDER
    def test_gate_tries_next_question_when_replan_unavailable(self):
        ok = {"fresh": 9, "insight": 5, "afterglow": 5, "joy": 6, "addictive": 8, "copy": 8, "layout": 8, "note": ""}
        weak_q = {**ok, "fresh": 4, "joy": 4, "copy": 9, "layout": 9, "note": "질문이 뻔함"}
        d, saved, calls = self._gate_env(lambda n: weak_q if n == 1 else ok)
        try:
            import unittest.mock as um
            with um.patch.object(r, "tts", side_effect=RuntimeError("stop")):  # 기획까지만 보고 렌더는 멈춤
                with self.assertRaises(RuntimeError):
                    r.render(dt.date(2026, 12, 5), d)
            self.assertEqual(calls["judge"], 2)
            self.assertNotEqual(calls["plan"][0][0], calls["plan"][1][0])  # 다시 짜기가 안 되면 그날 다른 질문
        finally:
            self._gate_restore(saved)

    def test_description_for_rewritten_question(self):
        q = {"id": "20261121-1", "a": "식은 첫 조각", "b": "치즈 없는 끝 빵", "rewritten": True}
        self.assertNotIn("/q/20261121-1", r.description_of(q, None, False))
        self.assertIn("/q/20261121-1", r.description_of({**q, "rewritten": False}, None, False))

    def test_situation_and_day_fix(self):
        """11/25 BK '미용실 거울 앞에서 괜찮아요 vs 다시요 — 문장이 명확하지 않아': 상황 한 문장 + 그날 편 고치기."""
        self.assertEqual(r.clean_situation(" 미용실에서 머리를 잘랐는데  마음에 안 들어요 "), "미용실에서 머리를 잘랐는데 마음에 안 들어요")
        self.assertEqual(r.clean_situation("가" * 31), "")
        self.assertEqual(r.clean_situation("구독하면 알려줄게"), "")
        self.assertEqual(r.ask_line("미용실 머리가 망했을 때"), "미용실 머리가 망했을 때, 너라면?")
        self.assertEqual(r.ask_line("머리가 마음에 안 들어요."), "머리가 마음에 안 들어요. 너라면?")
        q = {"id": "20261125-1", "a": "괜찮다고 웃고 나오기", "b": "다시 해 달라고 하기", "rewritten": True,
             "situation": "미용실에서 머리를 잘랐는데 마음에 안 들어요"}
        self.assertTrue(r.description_of(q, None, False).startswith("미용실에서 머리를 잘랐는데 마음에 안 들어요. 너라면?"))
        self.assertIn("상황", r.brief_of("split", q, None, None, ["x"]))
        import json
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d) / "fix.json"
            f.write_text(json.dumps({"2026-11-25": {**{k: q[k] for k in ("a", "b", "situation")}, "format": "split"},
                                     "2026-11-26": {"a": "x", "b": "y", "format": "nope"}}), encoding="utf-8")
            self.assertEqual(r.day_fix(dt.date(2026, 11, 25), f)["b"], "다시 해 달라고 하기")
            self.assertIsNone(r.day_fix(dt.date(2026, 11, 26), f))  # 형식이 틀리면 무시
            self.assertIsNone(r.day_fix(dt.date(2026, 11, 27), f))
        self.assertIn("situation", r.REPLAN_SYS)
        self.assertIn("미용실 거울 앞에서", r.GATE_SYS)  # 장소만 있는 띠는 문구 3점 이하


if __name__ == "__main__":
    unittest.main()
