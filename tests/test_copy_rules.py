"""문장 다듬기 규칙 (BK 11/26 '문장을 다듬어야 될 것 같아 적용할 규칙을 정리해서 반영해줘')."""
import unittest

from pipeline.copy_rules import caption_issues, copy_issues, plan_issues, variant_issues


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
                  "동전이가 이걸 숨겼다"):
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
        self.assertEqual(len(variant_issues(v)), 5)  # 11/28 13번: 자막이 기름 주제와 무관 (+1)


    def test_captions_spoken(self):
        # BK 11/27 '전체적으로 쇼츠의 자막이 문장이 자연스럽지 않아' — 실제로 올라간·예정이던 자막
        for t in ("세상엔 처음 듣는 소리가 너무 많다", "창밖 공기는 차갑고 조금 설렌다",
                  "갓 나온 수건의 온기는 오래 기억에 남는다", "가까이 가면 꼭 이렇게 된다",
                  "그래서 이 집은 빨래를 모아 둔다", "외출 10분 전 현관에 정적이 흐른다"):
            self.assertTrue(caption_issues(t), t)
        for t in ("가습기 김을 동전이가 덥석 물었어요", "너무 가까이 갔다가 에취!", "찾았다!",
                  "먼지 필터는 돌릴 때마다 비워요", "정답: 가열식이 약 10배", "조카: 이 큰 거면 열 번은 되지?"):
            self.assertEqual(caption_issues(t), [], t)

    def test_raksil_plan(self):
        self.assertTrue(plan_issues(["그 자리서 다시 해 달라기"]))
        self.assertEqual(plan_issues(["다시 해 달라고 하기", "원래 남의 메뉴가 더 맛있다", "미용실 머리가 망했을 때"]), [])

    def test_variant_heart_and_caption(self):
        v = {"yt_title": "건조기 매일 vs 모아서, 전기요금 더 드는 쪽은?", "band_top": "건조기 매일 vs 모아서",
             "band_accent": "전기요금 더 드는 쪽은?", "heart": "갓 나온 수건의 온기는 오래 남는다",
             "cuts": [{"caption": "양말 한 짝만 넣어도/건조기는 똑같이 돌아요"}, {"caption": "그리고 필터는/매번 비운다"}]}
        self.assertEqual(len(variant_issues(v)), 3)


if __name__ == "__main__":
    unittest.main()


class OffTopicTest(unittest.TestCase):
    """13번 (BK 11/28): 자막이 제목 주제와 무관하면 잡는다."""

    def test_gas_episode_caught(self):
        from pipeline.copy_rules import off_topic
        v = {"yt_title": "기름값 차이, 넣는 날이 더 클까 주유소가 더 클까?", "band_top": "기름, 언제 넣을까",
             "band_accent": "어디서가 더 클까?",
             "cuts": [{"caption": "동전이가 처음으로/차에 탄 날"}, {"caption": "세상엔 처음 듣는 소리가/너무 많다"},
                      {"caption": "창밖 공기는 차갑고/조금 설렌다"}, {"caption": "정답: 어디서/주유소마다 값이 다르다"}]}
        self.assertTrue(off_topic(v))

    def test_on_topic_passes(self):
        from pipeline.copy_rules import off_topic
        v = {"band_top": "건조기 매일 vs 모아서", "band_accent": "전기요금 더 드는 쪽은?",
             "cuts": [{"caption": "양말 한 짝만 넣어도/건조기는 똑같이 돌아요"}, {"caption": "빨래는 바구니에/모았다가 한 번에"},
                      {"caption": "정답: 매일 돌리는 쪽"}]}
        self.assertEqual(off_topic(v), [])
