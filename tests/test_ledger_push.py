"""장부 저장 충돌(11/23) 재발 방지: 두 실행이 같은 장부에 줄을 붙여도 둘 다 남는다."""
import json
import os
import subprocess
import tempfile
import unittest

from pipeline import ledger_push


def sh(cwd, *args):
    subprocess.run(args, cwd=cwd, check=True, capture_output=True)


class NewRowsTest(unittest.TestCase):
    def test_tail(self):
        self.assertEqual(ledger_push.new_rows([{"a": 1}], [{"a": 1}, {"b": 2}]), [{"b": 2}])

    def test_not_prefix(self):
        self.assertEqual(ledger_push.new_rows([{"a": 1}, {"c": 3}], [{"a": 1}, {"b": 2}]), [{"b": 2}])


class PushTest(unittest.TestCase):
    def test_two_runs_same_file(self):
        with tempfile.TemporaryDirectory() as t:
            remote, a, b = (os.path.join(t, x) for x in ("remote.git", "a", "b"))
            sh(t, "git", "init", "-q", "--bare", "-b", "main", remote)
            sh(t, "git", "clone", "-q", remote, a)
            for d in (a,):
                sh(d, "git", "config", "user.email", "t@t"); sh(d, "git", "config", "user.name", "t")
            os.makedirs(os.path.join(a, "data/api_usage"))
            f = "data/api_usage/2026-11-15.json"
            with open(os.path.join(a, f), "w") as fh:
                fh.write(ledger_push.dump([{"job": "base"}]))
            sh(a, "git", "add", "."); sh(a, "git", "commit", "-q", "-m", "init"); sh(a, "git", "push", "-q", "origin", "HEAD:main")
            sh(t, "git", "clone", "-q", remote, b)
            sh(b, "git", "config", "user.email", "t@t"); sh(b, "git", "config", "user.name", "t")
            for d, job in ((a, "shorts"), (b, "toon")):
                with open(os.path.join(d, f), "w") as fh:
                    fh.write(ledger_push.dump([{"job": "base"}, {"job": job}]))
            cwd = os.getcwd()
            try:
                for d in (a, b):
                    os.chdir(d)
                    self.assertEqual(ledger_push.main(["장부"]), 0)
            finally:
                os.chdir(cwd)
            out = subprocess.run(["git", "show", f"origin/main:{f}"], cwd=b, capture_output=True, text=True).stdout
            self.assertEqual([r["job"] for r in json.loads(out)], ["base", "shorts", "toon"])


if __name__ == "__main__":
    unittest.main()
