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
        # daily 등 매일 워크플로가 테스트 전체를 돌리므로, 날짜·다른 스레드 작업에 따라 바뀌는 점검(쇼츠 일정,
        # 연결 지도에 없는 새 워크플로)은 여기서 실패시키지 않고 07:50 텔레그램으로만 알린다.
        self.assertEqual(c.check_docs(), [])
        self.assertIsInstance(c.check_workflows(c.machine(), c.direction_text(), c.scheduled_workflows()), list)

    def test_off_workflow_back_on(self):
        p = c.check_workflows(D, "`textshort`", {"textshort": ["40 22 * * 0"]})
        self.assertTrue(any("꺼 둔 작업 textshort" in x for x in p))

    def test_workflow_missing_from_map(self):
        p = c.check_workflows(D, "표", {"newjob": ["0 0 * * *"]})
        self.assertTrue(any("newjob" in x for x in p))

    def test_two_shorts_same_day(self):
        p = c.check_shorts(D, [ep("2026-11-30", "guide", name="a.json"), ep("2026-11-30", "prices", name="b.json")], T)
        self.assertTrue(any("2편" in x for x in p))

    def test_bonus_on_off_day_not_a_gap(self):
        # 번외편(toon-sok)은 본편 사이 쉬는 날에 끼워도 간격·형식 경고 없음 (BK 11/21)
        p = c.check_shorts(D, [ep("2026-11-26"), ep("2026-11-27", "toon-sok"), ep("2026-11-28")], T, dt.date(2026, 11, 23))
        self.assertFalse([x for x in p if "간격" in x or "형식" in x], p)

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
