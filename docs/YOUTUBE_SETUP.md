# 유튜브 쇼츠 예약 업로드 설정 (BK가 직접, 1회 약 15분)

> 2026-11-09 · `.github/workflows/youtube.yml` 이 매일 10:00 KST에 돌아, `config/youtube_queue.csv` 순서대로
> 영상을 **하루 1개, 19:00 KST 공개 예약**으로 1개씩 올린다. 키·토큰은 GitHub Secrets에만 넣는다(채팅·파일 금지).

## 자동으로 되는 것 / BK가 할 것
| 항목 | 자동(API) | BK |
|---|---|---|
| 제목 앞 [광고], 설명 첫 줄 광고 문구, "내레이션: AI 음성" | ✅ (없으면 업로드 거부) | |
| 아동용 아님, 변경·합성 콘텐츠 아님 | ✅ | |
| 비공개 업로드 + 공개 예약 시각 | ✅ | |
| **유료 프로모션 포함 체크** | ❌ API로 설정 불가 | 업로드 알림(Actions 요약의 Studio 링크) 받으면 공개 전에 체크 |

영상은 공개 하루 남짓 전에 올라가므로 체크할 시간이 있다. Studio → 콘텐츠 → '예약됨' 영상 → 세부정보 → 유료 프로모션.

## 1. Google Cloud 프로젝트 (console.cloud.google.com)
1. 새 프로젝트 만들기 (이름 예: don3chon-youtube)
2. API 및 서비스 → 라이브러리 → **YouTube Data API v3** 사용 설정
3. OAuth 동의 화면 → 외부(External), 앱 이름 "돈 줍는 삼촌 업로더", 이메일 입력. 범위 추가 불필요
4. 테스트 사용자에 유튜브 채널 Google 계정 추가
5. **게시 상태를 "프로덕션으로 푸시"** (테스트 상태면 토큰이 7일마다 만료됨). 심사 요청은 안 해도 됨
6. 사용자 인증 정보 → OAuth 클라이언트 ID 만들기 → 유형 **웹 애플리케이션**,
   승인된 리디렉션 URI: `https://developers.google.com/oauthplayground` → 클라이언트 ID·보안 비밀 확인

## 2. 갱신 토큰 받기 (developers.google.com/oauthplayground)
1. 오른쪽 위 톱니 → "Use your own OAuth credentials" 체크 → 클라이언트 ID·보안 비밀 입력
2. 왼쪽 입력칸에 `https://www.googleapis.com/auth/youtube.upload` 입력 → Authorize APIs
3. 채널 계정으로 로그인 (채널 선택 화면이 나오면 "돈 줍는 삼촌" 채널). "확인되지 않은 앱" 경고 → 고급 → 이동
4. "Exchange authorization code for tokens" → **Refresh token** 값 복사
5. 다 쓰면 톱니에서 다시 체크 해제

## 3. GitHub 저장소에 넣기 (Settings → Secrets and variables → Actions)
- Secrets: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`
- Variables: `YOUTUBE_ENABLED` = `true` (넣기 전까지는 dry-run, 무엇을 올릴지만 표시)
- 선택: `YT_INTERVAL_DAYS` (기본 1)

확인: Actions → youtube → Run workflow → 요약에 "업로드 완료"와 Studio 링크가 보이면 성공.

## 참고
- 하루 업로드 한도: 기본 할당량 10,000 유닛, 업로드 1건 1,600 유닛 → 하루 최대 6개. 우리는 1개.
- 공식 문서 기준(2026-11 확인) 미심사 API 프로젝트도 비공개 고정 제한이 없다고 되어 있다. 만약 업로드된 영상이
  "비공개로 잠김"으로 나오면 `YOUTUBE_ENABLED`를 끄고 알려 줄 것 (API 감사 신청 또는 수동 공개로 전환).
- 새 영상 추가: `media/youtube/<slug>.mp4` + `config/youtube_queue.csv` 한 줄(제목은 반드시 [광고]로 시작).
- 가격이 바뀌면 큐의 intro·price_date 와 영상 끝 가격을 함께 고친다.


## 2026-11-11 BK 규칙: 유료 프로모션이 자동으로 안 켜지면 게시하지 않는다
- 업로드는 먼저 **비공개(예약 없음)**. 유료 프로모션(paidProductPlacementDetails)을 켜고 다시 읽어 확인될 때만 예약 공개로 바꾼다.
- 확인 안 되면 비공개 그대로 두고 실행 요약에 경고 + Studio 링크. BK가 체크 후 직접 예약 공개.
- API 문서상 이 항목은 insert/update 에서 쓰기 가능 목록에 없다 → 실패할 가능성이 큼. 시도하려면 토큰 범위가 `https://www.googleapis.com/auth/youtube.force-ssl` 이어야 한다 (지금 토큰은 youtube.upload 만이라 수정·조회 불가 → 항상 비공개로 남음).
