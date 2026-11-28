import datetime as dt
import unittest

from pipeline import credit_burn as B, claude_jobs as cj, episodes, recipes


class CreditBurnTest(unittest.TestCase):
    def test_jobs_have_caps(self):
        for job in [*B.JOBS, "toon"]:
            self.assertIn(job, cj.JOB_CAP)
        self.assertLessEqual(sum(cj.JOB_CAP[j] for j in B.JOBS), cj.CAP_USD)

    def test_req_params_json_schema(self):
        p = B.Req("x", "sys", "user", B.ART).params()
        self.assertEqual(p["output_config"]["format"]["type"], "json_schema")
        self.assertNotIn("betas", p)

    def test_recipe_extra_sections(self):
        r = {"mistakes": ["불이 세면 타요"], "storage": ["냉동 2주"], "faq": [["몇 인분?", "1인분이에요"]]}
        h = recipes.extra_sections(r)
        self.assertIn("자주 하는 실수", h)
        self.assertIn("<h3>몇 인분?</h3>", h)
        self.assertEqual(recipes.extra_sections({}), "")

    def test_info_short_target(self):
        info = episodes.info_short(dt.date(2026, 11, 28), dt.date(2026, 12, 8))
        self.assertEqual(info["date"], "2026-12-08")

    def test_custom_ids_valid(self):
        # 11/29 thin 이 'r:<slug>' 로 400 (배치 custom_id 는 ^[a-zA-Z0-9_-]{1,64}$)
        import inspect, re
        src = inspect.getsource(B)
        self.assertNotRegex(src, r'Req\(f"[a-z]+:')
        for slug in ("beef-radish-soup", "settop-box-standby-power"):
            self.assertRegex(f"q-{slug}", r"^[a-zA-Z0-9_-]{1,64}$")

    def test_results_reads_batch(self):
        # 11/29 thin: _results 안에서 없는 이름(reqs)을 써서 돈 낸 배치를 못 읽었다
        import types
        from unittest import mock
        msg = types.SimpleNamespace(stop_reason="end_turn", usage={"input_tokens": 10, "output_tokens": 10},
                                    content=[types.SimpleNamespace(type="text", text='{"x": 1}')])
        ok = types.SimpleNamespace(custom_id="a", result=types.SimpleNamespace(type="succeeded", message=msg))
        client = types.SimpleNamespace(beta=types.SimpleNamespace(messages=types.SimpleNamespace(
            batches=types.SimpleNamespace(results=lambda bid: [ok]))))
        with mock.patch.object(cj, "record", return_value=0.0) as rec, mock.patch.object(cj, "spent", return_value=0.0):
            out = B._results(client, "thin", "b1", {"a": B.Req("a", "s", "u", B.ART)}, dt.date(2026, 11, 29))
        self.assertEqual(out, {"a": {"x": 1}})
        rec.assert_called_once()
        with mock.patch.object(cj, "record") as rec, mock.patch.object(cj, "spent", return_value=0.0):
            B._results(client, "thin", "b1", {"a": B.Req("a", "s", "u", B.ART)}, dt.date(2026, 11, 29), record=False)
        rec.assert_not_called()

    def test_polish_does_not_shrink(self):
        import inspect
        self.assertNotIn("1,200~2,400", inspect.getsource(cj.polish))


if __name__ == "__main__":
    unittest.main()
