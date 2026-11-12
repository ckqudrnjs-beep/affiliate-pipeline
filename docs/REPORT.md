# 주간 생활물가 리포트 (2026-11-13)

don3chon.com/report/ 에 매주 월요일 07:10 KST 자동 발행. 100% 자동(수집·판단 문장·페이지·사이트맵·텔레그램 요약). 수익은 리포트 페이지 광고(애드센스·애드핏)와 계산기·가격 기록으로 넘어가는 유입.

## 구성 (src/pipeline/report.py, .github/workflows/report.yml)
- 기름값(오피넷): 전국 평균 휘발유·경유, 7일 변화, 가장 싼/비싼 시도
- 장바구니(KAMIS): 소매 품목 중 1개월 새 많이 오른 5개·내린 5개, 1년 전 대비
- 환율(ECOS 731Y001 원/달러): 7일 변화, 4주 평균 대비 → 직구 타이밍 문장
- 판단 문장은 숫자 규칙으로만 생성(생성형 문장 없음, 숫자 반올림만). 한 출처가 실패하면 그 절만 빠짐, 셋 다 실패하면 발행 안 함.
- 페이지마다 출처 표시. 텔레그램 채널이 켜져 있으면 요약 1건 게시.

## BK 1회 설정: 무료 키 3개 (GitHub Settings → Secrets → Actions)
1. 한국은행 ECOS: https://ecos.bok.or.kr/api/ → 회원가입 → 인증키 신청 → Secret `ECOS_KEY`
2. KAMIS: https://www.kamis.or.kr/customer/reference/openapi_list.do → 회원가입 후 Open API 신청 → Secret `KAMIS_KEY`(인증키), `KAMIS_ID`(KAMIS 아이디)
3. 오피넷: https://www.opinet.co.kr/user/custapi/openApiInfo.do → 무료 API 신청 → Secret `OPINET_KEY`. 신청 화면의 이용 조건에서 상업적 웹사이트 게시가 허용되는지 확인(안 되면 키를 넣지 않음 → 기름값 절 자동 제외).
키를 넣은 뒤 Actions → report → Run workflow 로 첫 리포트를 바로 만들 수 있다.

## 위험·규칙
- 숫자만 바뀌는 얇은 페이지가 되지 않게 요약 판단 문장 + 계산기 연결을 유지. 품질 문제 보이면 noindex 로 전환.
- 클라우드 작업 환경에서는 세 API 접속이 막혀 있어 응답 형식은 문서 기준으로 구현, 첫 실제 실행 로그로 확인 필요.
