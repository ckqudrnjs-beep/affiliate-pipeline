import datetime as dt
import importlib.util
import pathlib
import shutil
import tempfile
import unittest

NEED_RENDER = unittest.skipUnless(importlib.util.find_spec("numpy") and importlib.util.find_spec("PIL")
                                  and shutil.which("ffmpeg"), "numpy/PIL/ffmpeg 없음")


class T(unittest.TestCase):
    def test_no_middot(self):
        from pipeline import raksil_shorts as rs
        self.assertEqual(rs.no_middot("무료 · 설치 없음"), "무료, 설치 없음")
        self.assertEqual(rs.no_middot("즐겨찾기·구독"), "즐겨찾기, 구독")

    @NEED_RENDER
    def test_ending_stays_in_safe_area(self):
        """엔딩 그림은 쇼츠 오른쪽 버튼(x>=900)·아래 제목(y>=1540) 자리에 그리지 않는다."""
        import numpy as np
        from pipeline import raksil_ending as re_, raksil_shorts as rs
        spr, body = re_.mongle(dt.date(2026, 11, 20))
        bg = rs.background(31)
        base = bg.copy()
        rs.header(base, "오늘도 재밌었다면")
        b = np.asarray(base.convert("RGB"), np.int16)
        for t in (0.1, 0.6, 1.2, 2.5):
            f = np.asarray(re_.frame(t, spr, body, bg).convert("RGB"), np.int16)
            self.assertLess(np.abs(f[300:, re_.SAFE_X:] - b[300:, re_.SAFE_X:]).max(), 40, f"{t}초 오른쪽")
            self.assertLess(np.abs(f[re_.SAFE_Y:] - b[re_.SAFE_Y:]).max(), 40, f"{t}초 아래")

    @NEED_RENDER
    def test_append_adds_ending(self):
        import subprocess
        from pipeline import raksil_ending as re_
        with tempfile.TemporaryDirectory() as d:
            mp4 = pathlib.Path(d) / "a.mp4"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30:d=1",
                            "-f", "lavfi", "-i", "sine=f=440:sample_rate=44100:d=1", "-ac", "1", "-shortest",
                            "-pix_fmt", "yuv420p", str(mp4)], check=True)
            self.assertEqual(re_.append(mp4, dt.date(2026, 11, 20)), re_.DUR)
            out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)],
                                 capture_output=True, text=True).stdout
            self.assertAlmostEqual(float(out), 1 + re_.DUR, delta=0.2)
            self.assertEqual(list(pathlib.Path(d).iterdir()), [mp4])  # 임시 파일 남기지 않음


if __name__ == "__main__":
    unittest.main()
