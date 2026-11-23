"""numpy 같은 무거운 의존성은 쇼츠 워크플로에만 설치된다.
daily·youtube 등 가벼운 워크플로도 같은 테스트 전체를 돌리므로, numpy 를 쓰는 테스트는
반드시 skipUnless 로 감싸야 한다 (안 그러면 그 워크플로가 통째로 실패한다. 2026-11-19 사례)."""
import ast
import pathlib
import unittest

HEAVY = {"numpy", "PIL"}  # 2026-11-23: PIL 도 (test_yt_extras 사례)


def _imports_heavy(fn):
    for n in ast.walk(fn):
        if isinstance(n, ast.Import) and any(a.name.split(".")[0] in HEAVY for a in n.names):
            return True
        if isinstance(n, ast.ImportFrom) and (n.module or "").split(".")[0] in HEAVY:
            return True
    return False


def _guarded(decos):
    return any("skip" in ast.unparse(d) or "NEED_" in ast.unparse(d) for d in decos)


class HeavyDepsGuardTest(unittest.TestCase):
    def test_numpy_tests_are_guarded(self):
        bad = []
        for f in sorted(pathlib.Path(__file__).parent.glob("test_*.py")):
            tree = ast.parse(f.read_text(encoding="utf-8"))
            for cls in [n for n in tree.body if isinstance(n, ast.ClassDef)]:
                if _guarded(cls.decorator_list):
                    continue
                for fn in cls.body:
                    if isinstance(fn, ast.FunctionDef) and _imports_heavy(fn) and not _guarded(fn.decorator_list):
                        bad.append(f"{f.name}::{cls.name}.{fn.name}")
        self.assertEqual(bad, [], "numpy·PIL 을 쓰는 테스트에 @NEED_RENDER 또는 @unittest.skipUnless(...) 를 붙이세요")


if __name__ == "__main__":
    unittest.main()
