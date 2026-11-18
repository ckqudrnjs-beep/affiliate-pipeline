# 보안·운영 리스크 관리 (don3chon.com · 5raksil.com)

작성 2026-11-15 (BK 질문: "두 사이트 해킹이나 그밖에 운영 상 리스크는 어떻게 관리하지?")
점검 기준: 저장소 main 최신(2026-11-15 00:22 UTC), playground/functions/api/*, .github/workflows/*.

## 한눈에

- don3chon.com은 정적 사이트라 "사이트 해킹"보다 **계정 탈취**가 진짜 위험이다. Cloudflare·GitHub·도메인 계정 하나만 뚫려도 두 사이트가 같이 넘어간다.
- 5raksil.com은 서버 기능(D1, 관리자, 게시판, 코인)이 있어 **관리자 비밀번호, 데이터 백업, 조작**을 따로 챙겨야 한다.
- 자동 작업이 **조용히 멈추는 것**이 가장 흔한 운영 사고다. 지금은 GitHub 실패 메일 말고는 알림이 없다.

## 위험 순위

| # | 위험 | 지금 상태 | 영향 | 누가 |
|---|------|-----------|------|------|
| 1 | 계정 탈취 (Cloudflare, GitHub, 도메인, Google/YouTube/AdSense, 제휴 계정, 텔레그램) | 2단계 인증 여부 미확인 | 두 사이트·수익 전부 | BK |
| 2 | 관리자 비밀번호 추측 (/admin) | 비밀번호 1개 + IP당 하루 5번 제한. IP를 바꾸면 계속 시도 가능 | 코인·프로필·게시판 조작 | BK + Claude |
| 3 | 자동 작업이 조용히 멈춤 | GitHub 실패 메일뿐. 글 자동 작성(05:13·17:13) 같은 예약 작업은 알림 없음 | 글·시세·쇼츠 공백 → 트래픽 하락 | Claude |
| 4 | 안 쓰는 키가 남아 있음 | Meta 자동 게시는 중단했는데 refresh-tokens 작업이 매월 1·15일 계속 돌고, Threads·IG 토큰과 저장소 Secrets 쓰기용 PAT(SECRETS_PAT)가 그대로 있음 | 키 유출 시 피해 범위만 큼 | BK + Claude |
| 0 | **저장소가 공개(Public)** (11/18 발견) | 코드·작업 기록·Actions 결과물을 누구나 볼 수 있음. Secret 값은 안 보임 | 백업 같은 결과물이 새면 개인정보성 데이터 노출 | Claude: 백업은 암호화만 올림 |
| 5 | 5락실 데이터 손실 (D1 5raksil-db) | 따로 백업 없음. Cloudflare 기본 되돌리기(Time Travel)만 있음(무료 플랜 7일로 알고 있음, 확인 필요) | 프로필·코인·게시판 유실 | Claude |
| 6 | 순위 점수·코인 조작 | 점수는 게임별 최대값 안이면 서버가 그대로 믿음. 코인(최대 199)·꾸미기 아이템도 기기 값을 믿음 | 순위 신뢰도. 돈 가치는 없음(코인 현금화 금지 원칙 유지) | Claude(선택) |
| 7 | 트래픽 폭주·과금 | 이미 대비함: 엣지 캐시, 503 안내, API_PAUSE 비상 스위치, 3시간마다 사용량 텔레그램 알림 (plan/SCALING.md 8장) | 순위·저장 잠시 멈춤 | 완료 |
| 8 | 보안 헤더 없음 | 두 사이트 모두 _headers 없음(다른 사이트가 iframe으로 감싸기 등) | 작음 | Claude |
| 9 | 의존성·외부 액션 | 파이썬 패키지 적음, GitHub 액션은 공식 v4 태그 위주 | 작음 | Claude |
| 10 | 게시판 악용 | 욕설·링크·개인정보 자동 차단, 신고 3건 자동 숨김, 차단 기능, 화면 출력 escape 처리 확인 | 작음 (신고 처리만 꾸준히) | BK |
| 11 | 정책 위반 (AdSense 무효 클릭, 광고 표기) | COMPLIANCE.md 규칙 있음 | 광고 계정 정지 | BK |

## BK가 직접 할 일 (계정은 BK만 가능)

클릭 단위 상세 가이드: [SECURITY_BK_GUIDE.md](SECURITY_BK_GUIDE.md)


1. **2단계 인증 켜기** (인증 앱 또는 패스키, 문자 X). 순서대로:
   1. Cloudflare: https://dash.cloudflare.com/profile/authentication
   2. GitHub: https://github.com/settings/security
   3. Google 계정(YouTube·AdSense·Gmail): https://myaccount.google.com/signinoptions/twosv
   4. 도메인 등록업체 (don3chon.com, 5raksil.com을 산 곳)
   5. 쿠팡 파트너스·네이버·알리·카카오 애드핏·텔레그램(설정 > 개인정보 > 2단계 인증)
   - 복구 코드는 종이나 비밀번호 관리자에 보관. 채팅·파일에 적지 않기.
2. **도메인**: 자동 연장 켜기, 결제 카드 유효기간 확인, "도메인 잠금(Transfer Lock)" 켜기.
3. **관리자 비밀번호(ADMIN_KEY)**: 20자 이상 무작위로 바꾸기 (Cloudflare > Pages > 5raksil > 설정 > 변수). 바꾸면 기존 개발자 토큰도 자동으로 무효.
4. **Cloudflare Access로 /admin 잠그기** (무료, 10분): Zero Trust > Access > 애플리케이션 추가 > `5raksil.com/admin*`, `5raksil.com/api/admin*` > BK 이메일만 허용. 이러면 비밀번호를 알아도 BK 메일 인증 없이는 못 들어온다. 원하면 화면 따라 같이 진행.
5. **안 쓰는 키 지우기** (PR 머지 뒤): GitHub 저장소 Settings > Secrets에서 `THREADS_ACCESS_TOKEN`, `SECRETS_PAT` 삭제 + https://github.com/settings/personal-access-tokens 에서 그 PAT 폐기. `IG_ACCESS_TOKEN`은 수동 실행용 instagram 작업이 쓰므로, 인스타 API를 다시 쓸 계획이 없으면 같이 삭제.
6. **Cloudflare 알림** 켜기: Notifications > Pages 배포 실패, 보안 이벤트(무료).
7. **AdSense·애드핏**: 내 광고 클릭 금지, 지인에게 클릭 부탁 금지.
8. 게시판 신고·비밀글은 관리자 첫 화면 숫자 보고 주 2~3회 처리.

## Claude가 고칠 일 (BK 확인 후 PR)

| 순서 | 할 일 | 크기 |
|------|------|------|
| A | **매일 아침 상태 점검 알림**: 10:30 KST에 예약 작업 성공 여부, don3chon 최신 글·생활 시세 날짜, 5락실 API 응답을 확인해 문제 있을 때만 BK 텔레그램으로 알림 | 작음 |
| B | **refresh-tokens 작업 삭제** (Meta 자동 게시 중단과 맞춤). 다음 실행 12/1 전에 | 아주 작음 |
| C | **D1 주간 백업**: 매주 일요일 04:20 KST D1을 내보내 GitHub 비공개 저장소의 작업 결과물(90일 보관)로 저장. 백업에는 게시판 비밀글도 들어 있음. BK가 D1 권한 토큰 1개를 Secret에 넣어야 함 | 작음 |
| D | **관리자 이중 잠금**: Access를 켜면 /api/admin이 Access 인증 헤더도 확인하게 | 아주 작음 |
| E | **보안 헤더** (_headers): 다른 사이트 iframe 금지, MIME 추측 금지, Referrer 정책, HTTPS 고정. 광고가 깨지지 않게 CSP는 넣지 않음 | 아주 작음 |
| F | **Dependabot**: GitHub 액션·파이썬 패키지 업데이트 알림 | 아주 작음 |
| G | (선택) **점수 조작 완화**: 점수 POST를 IP당 하루 횟수 제한 + 관리자 화면에서 순위 기록 삭제 | 중간 |

## PR 머지 뒤 설정 (BK, 한 번만)

1. **텔레그램 알림** (A): 이미 cf-usage용으로 넣은 `TELEGRAM_BOT_TOKEN`·`TELEGRAM_ADMIN_CHAT_ID`를 그대로 쓴다. 추가 설정 없음. Actions > health > Run workflow로 한 번 돌려 보기.
2. **D1 백업 토큰** (C): https://dash.cloudflare.com/profile/api-tokens > 토큰 만들기 > 사용자 지정 > 권한 `계정 / D1 / 편집` 하나만 > 만든 값을 GitHub Secret `CF_D1_TOKEN`에 넣기. 저장소가 공개라서 Secret `BACKUP_PASSPHRASE`(20자 이상 무작위, 비밀번호 관리자에 따로 보관)도 넣어야 백업이 돈다(암호화한 파일만 올림). Actions > d1-backup > Run workflow로 확인.
3. **Cloudflare Access** (D): Zero Trust > Access > Applications > Add > Self-hosted > 도메인 `5raksil.com` 경로 `admin`, 같은 앱에 `5raksil.com` 경로 `api/admin` 추가 > 정책 Allow, 포함 조건 Emails = BK 메일. 저장 뒤 앱 화면의 'Application Audience (AUD) Tag'와 팀 이름을 Pages 5raksil > 설정 > 변수에 `ACCESS_AUD`, `ACCESS_TEAM`으로 넣고 재배포. 넣기 전까지는 지금처럼 비밀번호만 확인한다.
4. **Dependabot 경고** (F): 저장소 Settings > Code security > Dependabot alerts, Dependabot security updates 켜기.

## 사고 났을 때 (순서대로)

1. 5락실 이상 → Cloudflare Pages 변수 `API_PAUSE=1` (저장만 멈춤, 게임은 됨).
2. 계정 탈취 의심 → 해당 계정 비밀번호 변경 → 모든 세션 로그아웃 → GitHub Secrets·Cloudflare 토큰 재발급.
3. 데이터 망가짐 → D1 Time Travel로 시점 되돌리기 또는 주간 백업에서 복원 (Claude가 명령 준비).
4. 사이트가 이상하게 바뀜 → Cloudflare Pages > 배포 목록에서 이전 배포 "롤백" (1클릭).

## 변경 기록

- 2026-11-15: 최초 작성 (점검 + 위험 순위 + 역할 구분).
- 2026-11-15: BK 승인으로 A~F PR: health.yml(매일 10:30 KST 점검, 월요일 정상 보고), refresh-tokens.yml 삭제, d1-backup.yml(일 04:20 KST, 90일), lib/access.js(Access 증표 확인), _headers 두 사이트, dependabot.yml. G(점수 조작 완화)는 보류. 11/15 10:30 KST PR #169 머지.
- 2026-11-18: 저장소가 Public 인 것 확인 → d1-backup 을 AES256 암호화(BACKUP_PASSPHRASE)한 파일만 올리게 변경. 공개 유지 이유: Actions 무료 무제한(비공개면 월 2,000분). 'Protect this branch'는 봇이 main 에 직접 올리는 작업이 막힐 수 있어 보류.
