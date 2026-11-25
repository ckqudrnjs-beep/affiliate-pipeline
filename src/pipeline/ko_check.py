"""한국어 맞춤법·띄어쓰기 자동 고치기 (BK 11/25 "문장을 완벽하게", 오픈소스 검토 3번).

자동 문구(쇼츠 띠·질문·상황, 동전이 투표 문구 등)가 화면에 올라가기 전에 '틀린 게 확실한 것'만 고친다.
뜻이 바뀔 수 있는 건 건드리지 않는다. 영상 형식(글자 크기·위치·길이 규칙)은 바꾸지 않는다.

1. 자주 틀리는 표기 (사전 목록, 라이브러리 없이): 됬→됐, 되요→돼요, 할께→할게, 몇일→며칠 …
2. 의존명사 띄어쓰기 (Kiwi 형태소 분석기, kiwipiepy, Apache-2.0): '나올수'→'나올 수', '하는것'→'하는 것'
   Kiwi 가 설치돼 있지 않으면 2는 건너뛴다(1만 한다). 작업 실패로 만들지 않는다.
Kiwi 의 통째 띄어쓰기(space)는 '가스비'→'가스 비'처럼 멀쩡한 말도 쪼개서 쓰지 않는다.
"""
from __future__ import annotations

import re

# (틀린 표기 정규식, 고친 표기). 뜻이 하나뿐인 것만.
TYPOS: list[tuple[str, str]] = [
    (r"됬", "됐"),
    (r"(?<![가-힣])되요", "돼요"), (r"안되요", "안 돼요"), (r"([가-힣])되요", r"\1돼요"),
    (r"되서", "돼서"),
    (r"([할갈볼줄올될먹을])께(요)?(?![가-힣])", r"\1게\2"),
    (r"몇일", "며칠"),
    (r"어의없", "어이없"),
    (r"금새", "금세"),
    (r"오랫만", "오랜만"),
    (r"설겆이", "설거지"),
    (r"희안", "희한"),
    (r"역활", "역할"),
    (r"일일히", "일일이"),
    (r"깨끗히", "깨끗이"),
    (r"곰곰히", "곰곰이"),
    (r"왠만", "웬만"),
    (r"않되", "안 되"),
    (r"어떻해", "어떡해"),
    (r"할려고", "하려고"),
    (r"뵈요", "봬요"),
]
DEP_NOUNS = {"수", "것", "줄", "만큼", "뿐", "듯"}  # 관형형 바로 뒤에 붙여 쓰면 틀리는 의존명사

_kiwi = None
_kiwi_tried = False


def kiwi():
    """Kiwi 를 한 번만 불러온다(모델 로딩 약 1초). 없으면 None."""
    global _kiwi, _kiwi_tried
    if not _kiwi_tried:
        _kiwi_tried = True
        try:
            from kiwipiepy import Kiwi
            _kiwi = Kiwi()
        except Exception as e:  # 설치 안 됨·모델 없음
            print(f"ko_check: Kiwi 없이 진행 ({type(e).__name__})")
    return _kiwi


def fix_typos(t: str) -> str:
    for pat, rep in TYPOS:
        t = re.sub(pat, rep, t)
    return t


def fix_spacing(t: str) -> str:
    """'나올수 있어요'→'나올 수 있어요'. 관형형 어미(ETM) 바로 뒤에 붙은 의존명사(NNB) 앞에만 띄어쓰기를 넣는다."""
    k = kiwi()
    if k is None or not t:
        return t
    try:
        toks = k.tokenize(t)
    except Exception:
        return t
    cuts = []
    for prev, tok in zip(toks, toks[1:]):
        # 겉글자가 사전형과 같을 때만 ('않을게요'의 '게'처럼 줄어든 꼴은 뜻이 갈려서 안 건드린다)
        if tok.tag == "NNB" and tok.form in DEP_NOUNS and t[tok.start:tok.end] == tok.form and prev.tag == "ETM" \
                and tok.start == prev.end and tok.start > 0 and not t[tok.start - 1].isspace():
            cuts.append(tok.start)
    for c in sorted(cuts, reverse=True):
        t = t[:c] + " " + t[c:]
    return t


def fix(t: str) -> str:
    """틀린 게 확실한 것만 고친 문장. 빈 값·문자열 아님은 그대로 돌려준다."""
    if not isinstance(t, str) or not t.strip():
        return t
    return fix_spacing(fix_typos(t))


def changes(t: str) -> tuple[str, list[str]]:
    """(고친 문장, ['원래 → 고친' 기록]). 기록은 작업 로그용."""
    f = fix(t)
    return f, ([f"{t} → {f}"] if f != t else [])


def fix_fields(d: dict, keys) -> list[str]:
    """dict 안 글자 칸을 제자리에서 고친다. 'cuts.caption' 처럼 쓰면 목록 안 dict 의 칸. 고친 기록을 돌려준다."""
    log = []
    if not isinstance(d, dict):
        return log
    for k in keys:
        if "." in k:
            a, b = k.split(".", 1)
            for x in d.get(a) or []:
                log += fix_fields(x, [b])
        elif isinstance(d.get(k), str):
            d[k], ch = changes(d[k])
            log += ch
    return log
