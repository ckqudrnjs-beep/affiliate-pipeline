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

    def test_old_ending_with_particle(self):
        # 11/27: 11/26 기름 편 설명란 첫 줄 — '~느냐' 뒤에 조사가 붙어 검사를 빠져나갔음
        self.assertTrue(copy_issues("기름은 언제보다 어디서 넣느냐가 더 크다"))
        self.assertTrue(copy_issues("어디서 넣느냐에 따라 차이가 커요"))
        for t in ("기름은 넣는 날보다 넣는 곳에 따라 차이가 더 커요.", "주유소가 더 클까?", "물가는 오르고 있어요"):
            self.assertEqual(copy_issues(t), [], t)

    def test_description_first_line_is_question(self):
        from pipeline import youtube as yt
        row = {"title": "기름값 차이, 넣는 날이 더 클까 주유소가 더 클까?", "intro": "설명",
               "takeaway": "기름은 언제보다 어디서 넣느냐가 더 크다", "ad": "0", "kind": "short", "site": "index.html"}
        d = yt.build_description(row)
        self.assertEqual(d.splitlines()[0], row["title"])
        self.assertNotIn("느냐", d)
        old = {**row, "title": "보일러 외출 모드 정리"}
        self.assertEqual(yt.build_description(old).splitlines()[0], row["takeaway"])

    def test_variant(self):
        v = {"yt_title": "기름은 언제 넣느냐?", "band_top": "기름, 언제 넣을까", "band_accent": "어디서가 더 클까?",
             "cuts": [{"caption": "길을 안다고 믿는 건/늘 자신감부터다"}, {"caption": "동전이가 처음으로/차에 탄 날"}]}
        self.assertEqual(len(variant_issues(v)), 4)


if __name__ == "__main__":
    unittest.main()
