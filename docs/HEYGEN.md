# HeyGen 가상 인물 쇼츠 (2026-11-11, BK 요청)

BK가 사진 넘기기 쇼츠(담요·유리창 로봇)가 재미없다며 삭제하고 HeyGen 가상 인물 영상으로 바꾸기로 함.
HeyGen API v3만 쓴다 (v1/v2 2026-10-31 종료). 영상 생성은 API 선불(5달러부터), 구독 없음.

## 처음 한 번 (BK)
1. platform.heygen.com/api-keys 에서 키 발급, 5달러 충전 → GitHub Secret `HEYGEN_API_KEY`
2. Actions → heygen → Run workflow (cmd=`list`) → 요약에서 남성 아바타·한국어 음성 고르기
3. Variables `HEYGEN_AVATAR_ID`, `HEYGEN_VOICE_ID` 에 고른 id

## 영상 만들기
- 대본: `config/heygen/<이름>.json` (product, slug, title([광고]로 시작), intro, script, end_note)
- 규칙: 공감 → 불편 → 해결책(제품은 마지막) → 계산 → 가격·"광고 링크라 삼촌한테 수수료가 조금 와". 직접 써 봤다는 말 금지, 판매자 표기에 있는 사실만.
- Actions → heygen (cmd=`make`, names=`usb-heated-lap-blanket window-cleaning-robot-5600pa`) → 미리보기 PR → 병합하면 업로드 대기열(synthetic=1)
- 화면: 위 "광고 · 알리익스프레스 제휴 링크", 아래 "AI로 만든 가상 인물", 끝 2.5초 상품·가격·don3chon.com 카드
- 업로드 시 `containsSyntheticMedia=true` 자동, 유료 프로모션 체크는 BK가 Studio에서
- HeyGen 약관: 유료 사용분은 상업 이용 가능, AI 표기 필요, 실존 인물 사진 아바타는 본인 허락 필요 → 공개(스톡) 아바타 사용
