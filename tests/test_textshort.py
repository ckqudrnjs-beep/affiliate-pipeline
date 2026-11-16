import datetime as dt
import json
import pathlib
import unittest

from pipeline import episodes as ep
from pipeline import textshort as T

REP = {"date": "2026-11-16", "grocery": {"count": 137,
       "down": [{"name": "토마토", "unit": "1kg", "price": 3909, "m": -46.2, "y": -52.9}],
       "up": [{"name": "오이(취청)", "unit": "10개", "price": 15652, "m": 71.2, "y": 1.8}]}}


class TextShortTest(unittest.TestCase):
    def test_pass_and_fill(self):
        ok, fails, picks = T.checks(REP)
        self.assertTrue(ok, fails)
        html = T.fill(REP, picks, dt.date(2026, 11, 23))
        self.assertNotIn("{{", html)
        self.assertIn("-46%", html)
        self.assertIn("+71%", html)
        self.assertIn("11월 넷째 주", html)
        self.assertEqual(ep.check(T.spec_for(REP, picks, dt.date(2026, 11, 23))), [])

    def test_small_change_fails(self):
        rep = json.loads(json.dumps(REP))
        rep["grocery"]["down"][0]["m"] = -12.0
        ok, fails, _ = T.checks(rep)
        self.assertFalse(ok)
        self.assertTrue(any(f.startswith("②") for f in fails))

    def test_missing_numbers_fail(self):
        ok, fails, _ = T.checks({"grocery": {"down": [], "up": []}})
        self.assertFalse(ok)

    def test_trial_weeks_alternate(self):
        self.assertFalse(T.is_trial_week(dt.date(2026, 11, 16)))
        self.assertTrue(T.is_trial_week(dt.date(2026, 11, 23)))
        self.assertFalse(T.is_trial_week(dt.date(2026, 11, 24)))
