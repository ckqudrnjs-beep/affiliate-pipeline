import importlib.util
import unittest

from pipeline import episodes as ep
from pipeline.skit import check_lines


class PetTest(unittest.TestCase):
    """2026-11-17 마스코트 '동전이' + 주부 타깃 요일표."""

    def test_pet_fields_checked(self):
        ok = [{"who": "n", "say": "가", "pet": "coin"}, {"who": "u", "say": "나", "pet_say": "짤랑!"}]
        self.assertEqual(check_lines(ok), [])
        bad = [{"who": "n", "say": "가", "pet": "dance"}, {"who": "u", "say": "나", "pet_say": "아주아주긴말풍선이다"}]
        errs = " ".join(check_lines(bad))
        self.assertIn("pet", errs)
        self.assertIn("pet_say", errs)

    def test_schedule_has_no_quiz_and_home_rule(self):
        self.assertEqual(ep.QUIZ_DAYS, set())
        self.assertEqual({k for k, *_ in ep.SHORT_FORMATS.values()} - set(ep.SITE_PREFIX), set())
        self.assertIn("아하", ep.HOME_RULE)

    @unittest.skipUnless(importlib.util.find_spec("PIL"), "Pillow 없음")
    def test_pet_draws_every_pose(self):
        from pipeline import pet, webtoon
        for p in pet.POSES:
            im = pet.draw(p, 120, 0.4)
            self.assertEqual(im.size, (120, 120))
            self.assertGreater(im.getbbox()[2], 60)
        self.assertEqual(webtoon.pet_pose({"big": "1원"}), "coin")
        self.assertEqual(webtoon.pet_pose({"sfx": "buzz"}), "shock")


if __name__ == "__main__":
    unittest.main()
