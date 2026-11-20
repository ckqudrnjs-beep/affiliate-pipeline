"""docs/DIRECTION.md(모든 자동 작업의 기준)가 깨지지 않았는지, 꺼 둔 작업이 다시 켜지지 않았는지 (2026-11-20)."""
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOC = ROOT / "docs/DIRECTION.md"


def machine() -> dict:
    m = re.search(r"## 6\. 자동 점검용.*?```json\n(.*?)\n```", DOC.read_text(encoding="utf-8"), re.S)
    return json.loads(m.group(1))


class DirectionTest(unittest.TestCase):
    def test_machine_block_parses(self):
        d = machine()
        self.assertEqual(d["shorts_uncle"]["every_days"], 2)
        self.assertFalse(d["shorts_uncle"]["products"])

    def test_off_workflows_have_no_schedule(self):
        for name, why in machine()["workflows_off"].items():
            wf = (ROOT / f".github/workflows/{name}.yml").read_text(encoding="utf-8")
            live = [l for l in wf.splitlines() if re.match(r"\s*(schedule:|- cron:)", l)]
            self.assertEqual(live, [], f"{name} 는 DIRECTION 에서 꺼 둔 작업인데 예약이 살아 있어요 ({why})")

    def test_agents_points_to_direction(self):
        self.assertIn("docs/DIRECTION.md", (ROOT / "AGENTS.md").read_text(encoding="utf-8"))

    def test_claude_jobs_reads_direction(self):
        import sys
        sys.path.insert(0, str(ROOT / "src"))
        from pipeline import claude_jobs
        self.assertIn("이틀에 1편", claude_jobs.direction("2-3"))


if __name__ == "__main__":
    unittest.main()
