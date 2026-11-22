import importlib.util
import json
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("toon_assemble", pathlib.Path("tools/toon_assemble.py"))
ta = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(ta)
except ImportError:  # PIL 없음
    ta = None


@unittest.skipIf(ta is None, "PIL 없음")
class EndingRotationTest(unittest.TestCase):
    def test_next_episodes_differ(self):  # 이틀 간격 본편은 매번 다른 엔딩 (BK 11/22 'veo 크레딧 사용 되었던 것은 예외로')
        days = ["2026-11-24", "2026-11-26", "2026-11-28", "2026-11-30", "2026-12-02", "2026-12-04"]
        ids = [ta.pick_ending(d)["id"] for d in days]
        self.assertEqual(ids[:5], ["A2", "cand-2", "A", "cand-3", "cand-1"])
        for a, b in zip(ids, ids[1:]):
            self.assertNotEqual(a, b)

    def test_reused_entry_cut_marked_used(self):
        cfg = json.loads(pathlib.Path("config/toon_reuse.json").read_text(encoding="utf-8"))
        self.assertTrue(all(c.get("used") for c in cfg["clips"] if c["id"] == "entry-shoes"))


if __name__ == "__main__":
    unittest.main()
