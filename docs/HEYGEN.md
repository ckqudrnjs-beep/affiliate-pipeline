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

## 2026-11-11 결정: 한국인 삼촌 사진 아바타
- 공개 아바타는 한국인으로 보이는 사람이 없어(동양인 2명뿐) BK가 **AI로 만든 한국인 삼촌 사진(Canva 시안 5번, 채널 로고처럼 갈색 모자·올리브 조끼·동전)** 을 골랐다. 실존 인물 아님.
- 사진은 `config/heygen/uncle.jpg`. `heygen` 워크플로 cmd=`photo` → HeyGen 사진 아바타 생성 → `config/heygen/avatar.json` (avatar_id, voice_id) 을 main에 저장.
- 목소리 기본값: 한국어 남성 Ben (langdesign). 저장소 변수 HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID 가 있으면 그것이 우선.
- 이후 make 는 avatar.json 을 쓴다. 담요 1편만 먼저 만들어 BK 확인 후 유리창 로봇.

## 2026-11-11 결정: 절약형 삼촌 쇼츠 (BK)
- 삼촌만 말하는 24초 영상(PR #58)은 닫음. 담요가 안 보이고 영상마다 HeyGen 요금이 듦.
- **삼촌 표정 영상 8개**(시작 2, 반응 4: 놀람·웃음·고민·끄덕임, 끝 2)를 HeyGen으로 **한 번만** 만들어 `media/uncle/` 에 두고 계속 재사용. 대사·동작은 `config/heygen/clips.json`. 목소리는 7번(Supertonic M2) 파일을 HeyGen에 넣어 입만 맞춤 → 처음부터 끝까지 같은 목소리.
- 영상 순서: 시작 삼촌 → 상품 사진(자막·7번 목소리) → 계산 카드 → 반응 삼촌 → (주의 사진) → 가격 카드 → 끝 삼촌(광고 고지). 설정은 `config/heygen/<이름>.json` 의 `mix`.
- 실행: `heygen` 워크플로 cmd=`clips` (없는 표정 영상만 만듦, 요금 듦, main에 저장) / cmd=`mix` names=… (무료, 미리보기 PR → 병합하면 업로드 대기열).
- 비용: 처음 한 번 약 30초 분량. 이후 영상은 HeyGen 요금 없음.
