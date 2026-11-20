import datetime as dt
import os
import unittest
from unittest import mock

from pipeline import api_check as A

NOW = dt.datetime(2026, 11, 19, 12, 0, tzinfo=dt.timezone.utc)


def res(ok=False, kind=A.AUTH, msg="x", name="KAMIS"):
    return {"k": {"name": name, "ok": ok, "kind": kind, "msg": msg}} if not ok else {"k": {"name": name, "ok": True}}


class DecideTest(unittest.TestCase):
    def test_auth_problem_alerts_immediately(self):
        alerts, rec, st = A.decide(res(kind=A.AUTH), {}, NOW)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(st["k"]["fails"], 1)

    def test_temp_problem_needs_two_in_a_row(self):
        alerts, _, st = A.decide(res(kind=A.TEMP), {}, NOW)
        self.assertEqual(alerts, [])
        alerts, _, _ = A.decide(res(kind=A.TEMP), st, NOW)
        self.assertEqual(len(alerts), 1)

    def test_same_problem_reminds_once_a_day(self):
        _, _, st = A.decide(res(), {}, NOW)
        alerts, _, st2 = A.decide(res(), st, NOW + dt.timedelta(hours=5))
        self.assertEqual(alerts, [])
        self.assertEqual(st2["k"]["alerted"], st["k"]["alerted"])
        alerts, _, _ = A.decide(res(), st2, NOW + dt.timedelta(hours=25))
        self.assertEqual(len(alerts), 1)

    def test_recovery_only_after_alert(self):
        _, rec, st = A.decide(res(ok=True), {"k": {"fails": 1, "alerted": None}}, NOW)
        self.assertEqual(rec, [])
        self.assertEqual(st, {})
        _, rec, _ = A.decide(res(ok=True), {"k": {"fails": 1, "alerted": NOW.isoformat()}}, NOW)
        self.assertEqual(rec, ["KAMIS"])

    def test_message(self):
        self.assertIsNone(A.message([], [], NOW))
        self.assertIn("21:00 KST", A.message(["• a"], [], NOW))
        self.assertIn("복구", A.message([], ["KAMIS"], NOW))


class ChecksTest(unittest.TestCase):
    def test_missing_keys_are_skipped(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(A.checks(NOW.date()), [])
        with mock.patch.dict(os.environ, {"KAMIS_KEY": "k", "KAMIS_ID": "i", "YT_CLIENT_ID": "c", "YT_CLIENT_SECRET": "s",
                                          "GSC_REFRESH_TOKEN": "t"}, clear=True):
            self.assertEqual([k for k, _, _ in A.checks(NOW.date())], ["kamis", "gsc_refresh_token"])

    def test_kamis_error_code_is_auth(self):
        with mock.patch.object(A, "get_json", return_value={"data": {"error_code": "900"}}):
            with self.assertRaises(A.Problem) as c:
                A.check_kamis()
        self.assertEqual(c.exception.kind, A.AUTH)

    def test_kamis_timeout_retries_once(self):
        ok = {"data": {"error_code": "000", "item": []}}
        calls = [A.Problem(A.TEMP, "연결 실패(TimeoutError)"), ok]

        def fake(url, **kw):
            v = calls.pop(0)
            if isinstance(v, Exception):
                raise v
            return v
        with mock.patch.object(A, "get_json", side_effect=fake), mock.patch("pipeline.daily.parse_grocery", return_value=[{"x": 1}]):
            A.check_kamis(wait=0)
        self.assertEqual(calls, [])

    def test_kamis_two_timeouts_still_temp(self):
        with mock.patch.object(A, "get_json", side_effect=A.Problem(A.TEMP, "연결 실패(TimeoutError)")) as g:
            with self.assertRaises(A.Problem) as c:
                A.check_kamis(wait=0)
        self.assertEqual(g.call_count, 2)
        self.assertEqual(c.exception.kind, A.TEMP)

    def test_google_invalid_grant_is_auth(self):
        with mock.patch.object(A, "fetch", return_value=(400, '{"error": "invalid_grant"}')):
            with self.assertRaises(A.Problem) as c:
                A.check_google("GSC_REFRESH_TOKEN")
        self.assertEqual(c.exception.kind, A.AUTH)
        self.assertIn("재인증", c.exception.msg)

    def test_unexpected_error_hides_details(self):
        def boom():
            raise ValueError("secret-key-123")
        r = A.run_checks([("x", "X", boom)])
        self.assertNotIn("secret-key-123", r["x"]["msg"])

    def test_status_codes(self):
        self.assertEqual(A.status_problem(401).kind, A.AUTH)
        self.assertEqual(A.status_problem(503).kind, A.TEMP)


if __name__ == "__main__":
    unittest.main()
