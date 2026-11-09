# 매일 쇼츠 자동 제작 (2026-11-09, BK 결정: 전부 자동)

`.github/workflows/shorts.yml` (매일 08:30 KST) → `src/pipeline/shorts.py`
1. 업로드 대기(`config/youtube_queue.csv` 중 아직 안 올린 것)가 `SHORTS_BUFFER`(기본 3)개 이상이면 쉰다.
2. 알리 공식 API 후보(curate 기준: 평점·판매량·가격) 중 사이트에 없는 상품 1개.
3. 판매자 사진은 공식 API(productdetail.get)로만 받는다. 크롤링 금지.
4. Claude API(`ANTHROPIC_API_KEY`, 기본 claude-sonnet-5-5)가 **판매자 상품명에 있는 사실만**으로 이름·제목·질문·소개·자막 3개·사이트 소개 글(40자↑)·계산 조건을 쓴다.
   의약·식품·화장품·성인·고전력 열기구·모조품 의심은 건너뛴다(`data/shorts/skipped.json`). 문구는 준수 검사(금지 표현·길이) 통과해야 함.
5. 계산 숫자는 코드가 낸다: 전기요금(W가 상품명에 있을 때, kWh당 약 200원) / 한 번 쓸 때 / 하루 비용.
6. 목소리: Supertonic 3 `M2` (BK가 고른 7번), 정상 속도, 32단계. 구성: 질문 → 사진 2~3장+자막 → 계산 카드 → 이름·가격·don3chon.com. 화면 위에 늘 "광고 · 알리익스프레스 제휴 링크".
7. 결과: `data/products/<slug>.json`(사이트 상품, `source: shorts-auto`), `media/youtube/<slug>.mp4`, 대기열 한 줄 → main 커밋 → youtube 워크플로가 하루 1개 예약 업로드.

## 켜기 (BK)
- Secret `ANTHROPIC_API_KEY` (console.anthropic.com, 최초 5달러 충전, 하루 1회 호출이라 월 1천 원 안쪽)
- Variable `SHORTS_ENABLED` = `true`. 선택: `SHORTS_BUFFER`

## 확인
- Actions → shorts 실행 요약에 제목·내레이션·소개 글이 나온다. 이상하면 그 상품의 `data/products/<slug>.json` 과 대기열 줄을 지우면 사이트·업로드에서 빠진다.
- 공개 전 Studio에서 유료 프로모션 체크는 계속 BK가 한다 (API 불가).
