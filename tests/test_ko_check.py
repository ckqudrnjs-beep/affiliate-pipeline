"""맞춤법·띄어쓰기 자동 고치기 (pipeline.ko_check, BK 11/25 '문장을 완벽하게')."""
import importlib.util
import unittest

from pipeline import ko_check as K

HAS_KIWI = importlib.util.find_spec("kiwipiepy") is not None


class TypoTest(unittest.TestCase):
    def test_sure_typos(self):
        self.assertEqual(K.fix_typos("됬다 안되요 할께요"), "됐다 안 돼요 할게요")
        self.assertEqual(K.fix_typos("이렇게 되요"), "이렇게 돼요")
        self.assertEqual(K.fix_typos("몇일 걸려요"), "며칠 걸려요")
        self.assertEqual(K.fix_typos("금새 오랫만에 설겆이"), "금세 오랜만에 설거지")

    def test_leaves_correct_text(self):
        for t in ("선생님께 드려요", "못 박지는 않을게요", "가스비가 더 나와요", "되도록 빨리", "수수료"):
            self.assertEqual(K.fix(t), t)

    def test_non_text(self):
        self.assertIsNone(K.fix(None))
        self.assertEqual(K.fix(""), "")

    def test_fix_fields(self):
        v = {"title": "됬다", "cuts": [{"caption": "몇일"}, {"caption": "좋아요"}], "n": 3}
        log = K.fix_fields(v, ("title", "cuts.caption", "n", "없음"))
        self.assertEqual(v["title"], "됐다")
        self.assertEqual(v["cuts"][0]["caption"], "며칠")
        self.assertEqual(len(log), 2)


@unittest.skipUnless(HAS_KIWI, "kiwipiepy 없음 (쇼츠·대본 작업에만 설치)")
class SpacingTest(unittest.TestCase):
    def test_dependent_noun(self):
        self.assertEqual(K.fix("가스비가 더 나올수 있어요"), "가스비가 더 나올 수 있어요")
        self.assertEqual(K.fix("몰랐던것 같아요"), "몰랐던 것 같아요")
        self.assertEqual(K.fix("그럴줄 몰랐어"), "그럴 줄 몰랐어")

    def test_no_false_split(self):
        for t in ("할수록 좋아요", "못 박지는 않을게요", "가스비가 나와요", "먹을 수 있어요"):
            self.assertEqual(K.fix(t), t)


if __name__ == "__main__":
    unittest.main()
