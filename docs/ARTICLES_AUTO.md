# 삼촌의 글 자동 작성 (하루 1편, 승인 없이 바로 반영)

BK 결정 2026-11-10: 하루 1편을 사람 승인 없이 main에 바로 올린다. 대신 아래 규칙과 자동 검사(tests: ArticleDataTest)를 통과해야만 올린다.

## 순서 (예약 작업이 매일 그대로 따른다)
1. `data/article_topics.json`에서 `done:false`인 첫 질문을 고른다. 다 썼으면 기존 글·상품·계산기를 보고 검색 수요가 있는 새 질문을 하나 만든다(기존 글과 겹치지 않게).
2. `data/articles/<slug>.json` 작성. 필드: slug(영문 소문자-하이픈), date(오늘 KST), title, desc(160자 안팎, 답이 들어간 한 문장), keywords, body, products(0~2개, data/products의 slug), status "published".
3. `data/article_topics.json`의 해당 항목을 `done:true`, `slug` 추가.
4. `PYTHONPATH=src python -m unittest discover -s tests` 통과 + `PYTHONPATH=src python -m pipeline.site /tmp/site` 성공 확인 후 main에 커밋·푸시. 실패하면 고쳐서 다시, 그래도 안 되면 올리지 않는다.

## 글 규칙
- 검색 질문에 바로 답한다. 첫 소제목에 결론(숫자)을 쓴다. 본문의 80% 이상은 답·계산·비교표.
- 숫자는 근거가 있어야 한다: 전기요금은 사이트 계산기와 같은 기준(src/pipeline/calcs.py의 bill(): 200/400kWh 누진, 120.0/214.6/307.3원, 기본 910/1,600/7,300원, 기후 9원·연료 5원/kWh, 부가세 10%, 기금 2.7%)으로 직접 계산한다. 관세는 목록통관 150달러(미국 200달러), 관세 8%·부가세 10% 기본. 모르는 수치는 지어내지 말고 "제품마다 다름, ○○에서 확인"으로 쓴다.
- 본문 형식: `## 소제목`(2개 이상), `- 목록`, `| 표 |`, `**굵게**`, `[글자](calc/electric.html)` 같은 사이트 안 링크만. 외부 링크·제휴 링크는 본문에 넣지 않는다.
- 본문 600자 이상, 보통 1,200~2,000자. 한국어, 친근한 존댓말(~해요), 과장 금지(articles.BANNED).
- 상품은 글 내용과 직접 관련 있을 때만 0~2개. 상품 카드는 글 끝에 [광고] 문구와 함께 자동으로 붙는다. 본문에서 "사세요" 식 권유 금지.
- 의약품·식품·화장품·건강 효능 주장 금지.
