import json
import pathlib
import unittest

from pipeline import uncle


class PlanTest(unittest.TestCase):
    def test_order_and_clips_exist_in_config(self):
        clips = json.loads(uncle.CLIPS.read_text(encoding="utf-8"))
        for name in ("usb-heated-lap-blanket", "window-cleaning-robot-5600pa"):
            cfg = json.loads((uncle.CFG / f"{name}.json").read_text(encoding="utf-8"))
            seq = uncle.plan(cfg)
            self.assertEqual(seq[0][0], "uncle")
            self.assertEqual(seq[-1][0], "uncle")
            self.assertTrue(cfg["title"].startswith("[광고]"))
            for kind, s in seq:
                if kind == "uncle":
                    self.assertIn(s["name"], clips)
                elif s.get("photo"):
                    self.assertTrue((pathlib.Path("video_assets") / cfg["product"] / s["photo"]).exists())
            # 광고 고지는 끝 삼촌 대사에
            self.assertIn("광고", clips[seq[-1][1]["name"]]["say"])


if __name__ == "__main__":
    unittest.main()
