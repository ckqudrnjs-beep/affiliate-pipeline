"""문장 다듬기 규칙 (BK 11/26 '문장을 다듬어야 될 것 같아 적용할 규칙을 정리해서 반영해줘')."""
import unittest

from pipeline.copy_rules import copy_issues, variant_issues


class CopyRulesTest(unittest.TestCase):
    def test_bad_titles(self):
        # 11/26 기름 편 제목·띠·자막
        self.assertTrue(copy_issues("기름은 언제 넣느냐, 어디서 넣느냐? 뭐가 더 클까?"))
        self.assertTrue(copy_issues("기름, 언제 넣을까 어디서가 더 클까?"))
        self.assertTrue(copy_issues("길을 안다고 믿는 건 늘 자신감부터다"))
        self.assertTrue(copy_issues("끓는 포트 vs 하루 종일 밥솥 보온, 뭐가 더 들까?"))

    def test_good_titles(self):
        for t in ("기름값 차이, 넣는 날이 더 클까 주유소가 더 클까?",
                  "가열식 vs 초음파 가습기, 한 달 전기요금 몇 배 차이?",
                  "건조기 매일 돌리기 vs 모아서 돌리기, 전기요금 더 드는 쪽은?",
                  "보조배터리 큰 거 하나, 폰은 몇 번 충전될까?",
                  "동전이는 왜 저기 앉았을까?",
                  "세상엔 처음 듣는 소리가 너무 많다"):
            self.assertEqual(copy_issues(t), [], t)

    def test_variant(self):
        v = {"yt_title": "기름은 언제 넣느냐?", "band_top": "기름, 언제 넣을까", "band_accent": "어디서가 더 클까?",
             "cuts": [{"caption": "길을 안다고 믿는 건/늘 자신감부터다"}, {"caption": "동전이가 처음으로/차에 탄 날"}]}
        self.assertEqual(len(variant_issues(v)), 4)


if __name__ == "__main__":
    unittest.main()
