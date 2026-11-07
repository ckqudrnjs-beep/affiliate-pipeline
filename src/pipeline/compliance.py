"""발행 전 준수 검사. COMPLIANCE.md 규칙을 코드로 옮긴 것.

검사에 실패하면 발행하지 않는다.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse

DISCLOSURES = {
    "coupang": "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
    "generic": "[광고] 이 글에는 제휴 링크가 포함되어 있으며, 구매 시 작성자가 일정액의 수수료를 제공받습니다.",
}

ALLOWED_LINK_HOSTS = {
    "link.coupang.com", "coupa.ng",
    "s.click.aliexpress.com",
    "click.linkprice.com", "linkmoa.kr",
    "naver.me", "brandconnect.naver.com", "smartstore.naver.com",
}

BANNED_PATTERNS = [
    r"직접\s*(써|사용해)\s*봤",          # 실사용 근거 없는 체험 표현
    r"(질병|암|당뇨|혈압).{0,10}(치료|개선|완치)",  # 의료 효능
    r"(무조건|100%)\s*(수익|이득|효과)",
    r"받을\s*수\s*(있|도)",               # 모호한 대가성 표현
]

HEAD_LIMIT = 200


def check(text: str, programs: list[str], has_usage_evidence: bool = False) -> list[str]:
    """위반 사유 목록을 돌려준다. 빈 목록이면 통과."""
    problems: list[str] = []
    head = text[:HEAD_LIMIT]

    if "coupang" in programs and DISCLOSURES["coupang"] not in head:
        problems.append("첫 200자 안에 쿠팡 파트너스 대가성 문구가 없음")
    if any(p != "coupang" for p in programs) and "수수료를 제공받습니다" not in head:
        problems.append("첫 200자 안에 제휴 대가성 문구가 없음")

    for url in re.findall(r"https?://[^\s)\]>]+", text):
        host = urlparse(url).hostname or ""
        if host not in ALLOWED_LINK_HOSTS:
            problems.append(f"허용되지 않은 링크 도메인: {host}")

    for pat in BANNED_PATTERNS:
        if pat.startswith(r"직접") and has_usage_evidence:
            continue
        if re.search(pat, text):
            problems.append(f"금지 표현: /{pat}/")

    if re.search(r"\d[\d,]*\s*원", text) and not re.search(r"\d{1,2}월\s*\d{1,2}일.{0,6}기준", text):
        problems.append("가격 표기에 기준 일자(○월 ○일 기준)가 없음")

    return problems
