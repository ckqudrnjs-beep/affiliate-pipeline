"""매일 정합성 점검(pipeline.consistency)이 어긋남을 잡는지 (2026-11-20)."""
import datetime as dt
import unittest

from pipeline import consistency as c

D = {"shorts_uncle": {"every_days": 2, "publish_kst": "19:00", "products": False},
     "workflows_off": {"textshort": "x"}, "max_uncle_shorts_per_day": 1}
T = dt.date(2026, 11, 20)


def ep(day, fmt="toon", product=None, name=None):
    return {"file": name or f"{day}-{fmt}.json", "date": dt.date.fromisoformat(day), "format": fmt, "product": product}


class ConsistencyTest(unittest.TestCase):
    def test_repo_workflows_and_docs_match_direction(self):
        # 날짜에 따라 바뀌는 쇼츠 점검은 빼고(매일 워크플로가 이 테스트를 돌림), 고정된 연결만 본다.
        text = c.direction_text()
        self.assertEqual(c.check_workflows(c.machine(text), text, c.scheduled_workflows()) + c.check_docs(), [])

    def test_off_workflow_back_on(self):
        p = c.check_workflows(D, "`textshort`", {"textshort": ["40 22 * * 0"]})
        self.assertTrue(any("꺼 둔 작업 textshort" in x for x in p))

    def test_workflow_missing_from_map(self):
        p = c.check_workflows(D, "표", {"newjob": ["0 0 * * *"]})
        self.assertTrue(any("newjob" in x for x in p))

    def test_two_shorts_same_day(self):
        p = c.check_shorts(D, [ep("2026-11-30", "guide", name="a.json"), ep("2026-11-30", "prices", name="b.json")], T)
        self.assertTrue(any("2편" in x for x in p))

    def test_gap_product_and_format(self):
        p = c.check_shorts(D, [ep("2026-12-02", "guide"), ep("2026-12-03", product="x")], T, dt.date(2026, 12, 2))
        joined = "\n".join(p)
        self.assertIn("간격", joined)
        self.assertIn("상품", joined)
        self.assertIn("toon(캐릭터 영상)만", joined)

    def test_missing_next_script(self):
        p = c.check_shorts(D, [ep("2026-11-20")], T)
        self.assertTrue(any("대본이 아직 없음" in x for x in p))


if __name__ == "__main__":
    unittest.main()
