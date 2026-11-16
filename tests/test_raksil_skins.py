"""5락실 새 게임 = 게임 전용 스킨도 같이 (BK 2026-11-16). 규칙은 docs/GAME_QUALITY.md 5장.

모든 게임은 게임별 상점에 그 게임 꾸미기가 있어야 한다:
  DESIGNS(캐릭터 스킨) · THEMES(배경 테마) · GAME_ITEMS(게임 아이템) 중 하나, 또는 games/<slug>/items.json(게임 안 화폐 꾸미기).
스킨을 안 만드는 게임은 meta.json 에 "noskin": "<이유>" 를 적는다(BK 확인을 받은 것만).
"""
import importlib.util
import json
import pathlib
import unittest

PG = pathlib.Path(__file__).resolve().parent.parent / "playground"


def _build():
    spec = importlib.util.spec_from_file_location("build", PG / "build.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.b = _build()

    def test_every_game_has_own_skins(self):
        b = self.b
        has = {d["g"] for d in b.DESIGNS} | {t["g"] for t in b.THEMES} | {i["g"] for i in b.GAME_ITEMS}
        for d in sorted((PG / "games").iterdir()):
            meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
            if d.name in has or (d / "items.json").exists():
                continue
            self.assertTrue(meta.get("noskin"), f"{d.name}: 게임 전용 스킨이 없어요 → docs/GAME_QUALITY.md 5장대로 만들거나, BK 확인 후 meta.json 에 \"noskin\": \"이유\"")

    def test_character_skin_ladder(self):
        """캐릭터 스킨(DESIGNS) 게임 = 일반 3종 이상(🪙5~12) + 전설 1종(🪙50)."""
        b = self.b
        for g in b.DESIGN_GAMES:
            ds = [d for d in b.DESIGNS if d["g"] == g]
            normal = [d for d in ds if not d.get("leg")]
            leg = [d for d in ds if d.get("leg")]
            self.assertGreaterEqual(len(normal), 3, f"{g}: 일반 스킨 3종 이상")
            self.assertTrue(all(5 <= d["p"] <= 12 for d in normal), f"{g}: 일반 스킨 가격은 🪙5~12")
            self.assertEqual([d["p"] for d in leg], [50], f"{g}: 전설 스킨 1종 🪙50")
        for d in b.DESIGNS:
            self.assertIn(d["g"], b.DESIGN_GAMES, f"{d['g']}: DESIGN_GAMES 에 기본 스킨 이름·아이콘도 넣어요")

    def test_prices_fit_free_coin_economy(self):
        """코인은 무료로만 생기고 하루 🪙5 안팎 → 게임 꾸미기는 최대 🪙50, 공짜 아님(0은 기본으로)."""
        b = self.b
        for x in b.DESIGNS + b.THEMES + b.GAME_ITEMS:
            self.assertTrue(1 <= x["p"] <= 50, f"{x}: 가격 🪙1~50")
            self.assertLessEqual(x["p"], b.BONUS_MAX_COINS)


if __name__ == "__main__":
    unittest.main()
