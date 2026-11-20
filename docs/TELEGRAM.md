# 텔레그램 가격 알림 채널 (2026-11-13)

100% 자동 수익 후보 1순위. 이미 매일 도는 알리 가격 기록(curate, 06:30 KST)에 붙여, 가격이 내려간 상품과 새 상품을 텔레그램 채널에 자동 게시한다. 판매·정산은 알리 어필리에이트가 자동 처리.

## 규칙 (src/pipeline/telegram.py)
- 가격 하락: 직전 기록보다 5% 이상 싸고 최근 30일 최저가일 때만.
- 새 상품: 최근 3일 안에 추가된 상품(화·금 10:2x 자동 추가분을 다음 날 06:30에 보냄).
- 채널 첫 실전 실행 때 채널 소개 글 1회(연결 확인 겸).
- 하루 최대 3개, 같은 상품은 7일 동안 다시 안 보냄(data/telegram_sent.json).
- 모든 글: 맨 앞 [광고], 맨 끝 알리 대가성 문구. 링크는 공식 제휴 링크 + https://don3chon.com/p/<slug> 만.
- 쿠팡 링크는 채널을 쿠팡 파트너스 매체로 등록하기 전엔 넣지 않는다. 인스타·스레드 규칙(제휴 링크 금지)과는 별개 채널.
- 사진은 넣지 않는다(텍스트 + 링크 미리보기).

## BK 1회 설정 (약 10분)
1. 텔레그램 @BotFather → /newbot → 봇 토큰 받기.
2. 공개 채널 만들기(예: @don3chon_deal) → 봇을 관리자로 추가(메시지 게시 권한).
3. GitHub 저장소 Settings → Secrets and variables → Actions:
   - Secret `TELEGRAM_BOT_TOKEN` = 봇 토큰
   - Variable `TELEGRAM_CHAT_ID` = `@채널아이디`
   - Variable `TELEGRAM_ENABLED` = `true`
4. 알리 포털에 채널 URL을 홍보 채널로 추가(필요 시).

설정 전에는 드라이런(보낼 글만 로그에 출력).

## 구독자 모으기 (자동)
- don3chon 상품·가격 페이지와 헤더에 "가격 내려가면 알림 받기(텔레그램)" 링크 → 사이트 방문자가 구독자로. (채널 생성 후 추가)

## 방문자 조회 (BK 개인 대화, 2026-11-20)
BK 가 봇과의 개인 대화에 **"방문자"** 라고 보내면 5락실·돈삼촌 순 방문자(오늘 지금까지·어제·7일·30일)를 바로 답한다. **"7일"** 은 날짜별. 메뉴 명령어 /visitors, /days.
- 답하는 곳: 5락실 서버 `https://5raksil.com/api/tg` (playground/functions/api/tg.js). 텔레그램 웹훅이라 늘 켜져 있고 비용 0(Pages Functions 무료 한도, 묻는 횟수만큼만 호출). Actions 를 기다리지 않는다.
- 숫자는 /admin 과 같다(visit.js visitStats: 같은 IP 하루 1명, 7일·30일 = 날마다 센 수의 합). 읽기만 한다.
- 막는 장치: 텔레그램 비밀 머리글(봇 토큰에서 계산) 안 맞으면 404, BK 대화 번호(TELEGRAM_ADMIN_CHAT_ID)가 아니면 답 안 함.
- 웹훅을 켜면 같은 봇의 `getUpdates` 가 막힌다 → `cf-usage` setup(번호 찾기)은 이미 끝나서 영향 없음. 다시 필요하면 tg-webhook delete → setup → set.

### BK 1회 설정 (약 5분)
1. Cloudflare → Workers & Pages → 5raksil → 설정(Settings) → 변수(Variables and Secrets), Production 에 추가:
   - `TELEGRAM_BOT_TOKEN` (유형: 암호/Secret) = GitHub 에 넣은 것과 같은 봇 토큰 (텔레그램 @BotFather → /mybots → 봇 → API Token)
   - `TELEGRAM_ADMIN_CHAT_ID` (일반 텍스트) = GitHub Actions Variables 의 같은 이름 값
2. 5락실 다시 배포(변수는 새 배포부터 적용): 배포(Deployments) → 최신 배포 ⋯ → 다시 시도(Retry deployment).
3. GitHub Actions → `tg-webhook` → Run workflow (action = set). 텔레그램에 "✅ 방문자 조회 연결됨" 이 오면 끝.
4. 봇 대화에 "방문자" 보내 보기. 답이 없으면 tg-webhook 을 info 로 돌려 마지막 오류 확인.
