"""고정비 다이어트 진단기 (/calc/fixed-cost, 2026-11-16).

BK가 안티그래비티로 만든 단일 HTML 도구를 사이트 틀에 맞춰 옮겼다. 입력은 브라우저 안에서만 계산하고 서버로 보내지 않는다.
옮기면서 고친 점: 출처 없는 "통계청 기반" 문구 → 삼촌 점검 기준선, 절약액은 '대략적인 추정치'로 표시,
알뜰폰 가격·금리 몇 %p 인하 같은 단정 수치 제거, 에너지캐시백·금리인하요구권 조건 안내, 3년 적금 계산을 매달 적립 단리(세전)로 정확히.
제휴 링크·상품 카드 없음(광고 띠도 안 붙음). 화면·스크립트 원본: assets/fixed_cost.{html,css,js}
"""
from __future__ import annotations

import pathlib

_A = pathlib.Path(__file__).with_name("assets")
SLUG = "fixed-cost"
TITLE = "고정비 다이어트 진단기 (통신비·구독료·보험료·관리비·대출이자)"
H1 = "숨만 쉬어도 나가는 돈, 고정비 다이어트 영수증으로 점검해 보세요"
LEDE = ("통신비·구독료·보험료·관리비·대출이자는 한 번만 손보면 다음 달부터 애쓰지 않아도 돈이 남습니다. "
        "우리 집 숫자를 넣으면 가구원 수별 점검 기준선과 비교해 한 달·1년 동안 아낄 수 있는 금액을 어림하고, 어디부터 손볼지 순서를 알려 드려요.")
DESC = "통신비·구독료·보험료·관리비·대출이자를 넣으면 가구원 수별 기준선과 비교해 한 달·1년 절약 추정액과 항목별 처방을 보여 주는 무료 진단기. 선택약정 25%, 에너지캐시백, 금리인하요구권 확인법까지."
CARD = ("우리 집 고정비, 어디서 새고 있을까", "고정비 다이어트 진단기 (통신·구독·보험·관리비·이자)")

CSS = (_A / "fixed_cost.css").read_text(encoding="utf-8")
TOOL = (_A / "fixed_cost.html").read_text(encoding="utf-8")
JS = (_A / "fixed_cost.js").read_text(encoding="utf-8")


def body(calcs: list[dict]) -> str:
    """페이지 본문. calcs: 사이트 계산기 목록(끝에 다른 계산기 링크)."""
    import html as _h
    more = "".join(f'<li><a href="{c["slug"]}.html">{_h.escape(c["h1"])}</a></li>' for c in calcs)
    return f"""<style>{CSS}</style>
<p class="small"><a href="../index.html#calcs">계산기 모음</a></p>
<h1>{_h.escape(H1)}</h1><p class="lede">{_h.escape(LEDE)}</p>
{TOOL}
{JS and f"<script>{JS}</script>"}
<!--ADFIT-->
<section class="related"><h2>다른 살림 계산기</h2><ul>{more}</ul></section>"""
