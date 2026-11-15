"""5락실 포스터 자동 갱신 규칙 (2026-11-15 BK). 새 게임도 포스터 조리법을 꼭 갖게 한다."""
import importlib.util
import json
import pathlib
import re
import unittest

PG = pathlib.Path(__file__).resolve().parent.parent / "playground"


def _load(name):
    spec = importlib.util.spec_from_file_location(name, PG / f"{name}.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class T(unittest.TestCase):
    def test_cabinet_games_have_poster_recipe(self):
        for d in sorted((PG / "games").iterdir()):
            body = (d / "body.html").read_text(encoding="utf-8")
            meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
            uses_poster = re.search(r"/img/[\w-]+-poster\.jpg", body)
            if uses_poster or meta.get("ownfs"):  # 전체 화면 게임(시작 전 화면이 있는 게임)
                r = meta.get("poster")
                self.assertTrue(r and r.get("run"), f"{d.name}: meta.json 에 poster 조리법(run)이 필요해요 (playground/posters.py)")
                self.assertTrue((PG / "static/img" / f"{d.name}-poster.jpg").exists(), f"{d.name}: 포스터 없음 → python playground/posters.py {d.name}")
            if uses_poster:
                self.assertIn(f"/img/{d.name}-poster.jpg", body)
                self.assertNotIn("-poster.jpg?v=", body, f"{d.name}: ?v= 는 build.py 가 자동으로 붙여요")

    def test_build_busts_image_cache(self):
        b = _load("build")
        out = b.bust_imgs('<img src="/img/raid-poster.jpg?v=2"><img src="/img/none.jpg">')
        self.assertRegex(out, r'/img/raid-poster\.jpg\?v=[0-9a-f]{8}"')
        self.assertIn('"/img/none.jpg"', out)

    def test_manifest_hash_changes_with_game_code(self):
        p = _load("posters")
        games = p.poster_games()
        self.assertIn("dodge", games)
        h = p.src_hash("dodge", games["dodge"])
        m2 = dict(games["dodge"], poster=dict(games["dodge"]["poster"], wait=1))
        self.assertNotEqual(h, p.src_hash("dodge", m2))
        self.assertIn(PG / "static/js/dodge.js", p.sources("dodge"))
        self.assertIn(PG / "static/js/mongle-art.js", p.sources("mongle"))


if __name__ == "__main__":
    unittest.main()
