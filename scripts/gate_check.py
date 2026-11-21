"""기획안 채점만 해 보기 (11/21 BK '시나리오 점수는?'). 영상은 만들지 않는다.
사용: PYTHONPATH=src python scripts/gate_check.py <기획안.txt> [반복 횟수]  → 같은 기획을 N번 채점해 점수 흔들림까지 본다."""
import pathlib
import sys

from pipeline import raksil_shorts as rs

brief = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
for i in range(n):
    sc = rs.judge("5락실 밸런스 쇼츠", brief)
    if not sc:
        print(f"채점 {i + 1}: 실패(키 없음·예산)")
        continue
    total, passed = rs.gate_total(sc)
    parts = rs.gate_parts(sc)
    print(f"채점 {i + 1}: {total}/40 {'통과' if passed else ('최후 기준 통과' if rs.gate_soft(sc) else '미달')} "
          f"[결 최고 {parts[0]}, 중독성 {parts[1]}, 문구 {parts[2]}, 구도 {parts[3]}] "
          + " ".join(f"{k}={sc.get(k)}" for k in rs.GATE_SCHEMA_PROPS) + f"\n  지적: {sc.get('note', '')}")
