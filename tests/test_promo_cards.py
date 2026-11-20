"""홍보 이미지 3종 규칙 (2026-11-20 BK). 숫자는 사이트 계산기와 같고, 판매·제휴 문구는 막는다."""
import json
import shutil
import subprocess
import unittest

from pipeline import calcs, promo_cards as P


class T(unittest.TestCase):
    def test_calc_numbers(self):
        s = P.calc_card("전기난로", 1000, 4)
        self.assertEqual(s["stats"][0]["n"], "+39,420원")
        self.assertEqual(s["stats"][1]["n"], "329원")
        self.assertEqual(s["screen"]["rows"][0][1], "57,760원")
        self.assertEqual(P.check(s), [])

    @unittest.skipUnless(shutil.which("node"), "node 없음")
    def test_bill_same_as_site_js(self):
        kwhs = [0, 150, 200, 300, 390, 420, 650]
        js = calcs.COMMON_JS.split("function readQS")[0].replace("const $=s=>document.querySelector(s);", "")
        r = subprocess.run(["node", "-e", js + f"console.log(JSON.stringify({kwhs}.map(bill)))"], capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(r.stdout), [P.bill(k) for k in kwhs])

    def test_banned_words_blocked(self):
        s = P.calc_card("전기난로", 1000, 4)
        s["note"] = "오늘만 특가"
        self.assertTrue(P.check(s))
        s = P.calc_card("전기난로", 1000, 4)
        s["t2"] = "아주아주아주 긴 제목이에요"
        self.assertTrue(P.check(s))

    def test_raksil_specs(self):
        v = P.raksil_vertical("bag", "a.png", "b.png")
        self.assertEqual(P.check(v), [])
        self.assertEqual(v["phones"], ["a.png", "b.png"])
        p = P.raksil_poster(["bag", "hansang", "pusher"], {"bag": "1", "hansang": "2", "pusher": "3"})
        self.assertEqual([c["em"] for c in p["cards"]], ["꽉", "콤보", "우르르"])
        self.assertEqual(P.check(p), [])
