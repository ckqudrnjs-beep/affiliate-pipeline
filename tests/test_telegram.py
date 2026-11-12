import datetime as dt
import json
import pathlib
import tempfile
import unittest

from pipeline import telegram as T
from pipeline.compliance import DISCLOSURES

D = dt.date(2026, 11, 13)


def setup(tmp: pathlib.Path, rows: list[str], products: list[dict]) -> None:
    (tmp / "prices").mkdir()
    (tmp / "products").mkdir()
    (tmp / "prices" / "2026-11.csv").write_text("date,slug,aliPrice,coupangPrice\n" + "\n".join(rows) + "\n", encoding="utf-8")
    for p in products:
        (tmp / "products" / f"{p['slug']}.json").write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")


def prod(slug, **kw):
    return {"slug": slug, "name": slug, "aliUrl": "https://s.click.aliexpress.com/x", "status": "active",
            "note": "작아요. 두 번째 문장.", "check": "전원", **kw}


class TelegramTest(unittest.TestCase):
    def test_drop_needs_pct_and_low(self):
        self.assertEqual(T.drop_info([("2026-11-12", 10000), ("2026-11-13", 9000)], D), (10000, 9000, 10))
        self.assertIsNone(T.drop_info([("2026-11-12", 10000), ("2026-11-13", 9800)], D))  # 2%만
        self.assertIsNone(T.drop_info([("2026-11-01", 8000), ("2026-11-12", 10000), ("2026-11-13", 9000)], D))  # 최저 아님
        self.assertIsNone(T.drop_info([("2026-11-11", 10000), ("2026-11-12", 9000)], D))  # 오늘 기록 없음

    def test_pick_message_and_cooldown(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = pathlib.Path(d)
            setup(tmp, ["2026-11-12,a,10000,", "2026-11-13,a,8000,", "2026-11-12,b,5000,", "2026-11-13,b,5000,"],
                  [prod("a"), prod("b"), prod("c", addedDate="2026-11-13", aliPrice=3000), prod("z", status="paused")])
            posts = T.pick(tmp, D)
            self.assertEqual([s for s, _ in posts], ["a", "c"])
            msg = posts[0][1]
            self.assertTrue(msg.startswith("[광고]"))
            self.assertTrue(msg.endswith(DISCLOSURES["aliexpress"]))
            self.assertIn("10,000원 → 8,000원 (20% 내림", msg)
            self.assertIn("작아요.", msg)
            self.assertNotIn("두 번째", msg)
            T.save_state(tmp, {"a": "2026-11-10"})
            self.assertEqual([s for s, _ in T.pick(tmp, D)], ["c"])

    def test_new_window_and_intro(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = pathlib.Path(d)
            setup(tmp, [], [prod("y", addedDate="2026-11-12"), prod("old", addedDate="2026-11-09")])
            self.assertEqual([s for s, _ in T.pick(tmp, D)], ["y"])  # 어제 10:2x 추가분은 오늘 06:30 에 보냄
        self.assertIn("수수료", T.INTRO)


if __name__ == "__main__":
    unittest.main()
