"""동전이 쇼츠 제목 띠 (BK 2026-11-20 "섬네일과 코멘트가 우선 사람들이 누르게"): tools/toon_assemble.py"""
import importlib.util
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))
NEED_PIL = unittest.skipUnless(importlib.util.find_spec("PIL"), "PIL 없음")


class BandTest(unittest.TestCase):
    def test_lines(self):
        import toon_assemble as t
        self.assertEqual(t.band_lines(None), [])
        rows = t.band_lines({"top": "밥솥 보온 켜 둔 집", "accent": "의외로 모르는 진실…"})
        self.assertEqual([c for _, c in rows], [(255, 255, 255), t.YELLOW])  # 흰 줄 위, 노란 줄 아래
        self.assertEqual(rows[1][0], "의외로 모르는 진실...")  # 주아에 없는 글자 치환

    @NEED_PIL
    def test_band_on_top_and_captions_below(self):
        import toon_assemble as t
        im = t.layer(["추워서 김치찌개", "배달 시켰더니..."], "한 그릇 9,260원 차이", "sub", bigy=420,
                     band={"top": "추운 날 김치찌개 배달", "accent": "집밥이랑 얼마 차이?"})
        y0 = t.BAND_Y + 10
        self.assertEqual(im.getpixel((10, y0))[:3], (0, 0, 0))  # 띠는 불투명 검정
        self.assertEqual(im.getpixel((10, y0))[3], 255)
        self.assertEqual(im.getpixel((10, 10))[3], 0)  # 11/22: 맨 위는 비움 (홈 피드 미리보기에서 잘리는 곳)
        self.assertEqual(im.getpixel((10, t.BAND_Y + t.BAND_H + 30))[3], 0)  # 띠 아래는 영상이 보임
        alpha = im.split()[3]
        # 노란 숫자 상자가 띠·자막 아래로 밀려 내려감 (bigy 420 → 띠 + 자막 두 줄 아래)
        bot = t.BAND_Y + t.BAND_H
        ys = [y for y in range(bot, 1300) if im.getpixel((t.W // 2 - 300, y))[:3] == (255, 213, 60)]
        self.assertTrue(ys and min(ys) > bot + 90 + 2 * 116, ys[:1])
        self.assertTrue(alpha.getbbox())

    @NEED_PIL
    def test_long_line_shrinks(self):
        from PIL import Image, ImageDraw
        import toon_assemble as t
        im = Image.new("RGBA", (t.W, t.H))
        t.draw_band(ImageDraw.Draw(im), {"top": "열네 글자 넘는 아주 긴 제목 줄 예시", "accent": "짧게"})
        white = [x for y in range(t.BAND_Y, t.BAND_Y + 160) for x in range(t.W) if im.getpixel((x, y))[:3] == (255, 255, 255)]
        self.assertTrue(white and min(white) >= 60 and max(white) <= t.W - 60)

    @NEED_PIL
    def test_home_feed_safe(self):
        """11/22 BK: 홈 피드 미리보기(가운데 4:5 자르기 = y 285~1635)에서 띠·자막이 잘리지 않는다."""
        import toon_assemble as t
        top = (t.H - t.W * 5 // 4) // 2
        for band in (None, {"top": "추운 날 김치찌개 배달", "accent": "집밥이랑 얼마 차이?"}):
            box = t.layer(["추워서 김치찌개", "배달 시켰더니..."], band=band).split()[3].getbbox()
            self.assertGreaterEqual(box[1], top, band)


if __name__ == "__main__":
    unittest.main()
