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

## 4. 분석 읽기 토큰 (시청 비율·공유, 2026-11-16)
업로드 토큰은 그대로 두고, **읽기 전용 토큰을 채널마다 하나 더** 받는다. 영상은 바꿀 수 없는 권한이다.
1. https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com → **사용** (YouTube Analytics API)
2. https://developers.google.com/oauthplayground → 톱니 → "Use your own OAuth credentials" → 기존 클라이언트 ID·비밀 입력
3. 왼쪽 입력칸에 `https://www.googleapis.com/auth/yt-analytics.readonly` → Authorize APIs → **돈 줍는 삼촌** 채널 선택
4. Exchange authorization code for tokens → Refresh token 복사 → GitHub Secrets `YT_ANALYTICS_REFRESH_TOKEN`
5. 2~4를 한 번 더, 채널은 **5락실** → Secrets `RAKSIL_YT_ANALYTICS_REFRESH_TOKEN`
6. 확인: Actions → yt-stats → Run workflow → 로그에 "uncle: N편", "5raksil: N편"

## 첫 댓글 자동 (11/23, BK '채널 모두 구독 좋아요 등 유도합시다')
`pipeline.first_comment` 가 매일 22:41(yt-stats) 공개된 지 3일 안 된 영상에 채널 이름으로 질문 댓글 하나를 단다.
토큰에 `youtube.force-ssl` 권한이 있어야 한다. 채널마다 한 번, 2장 순서대로 다시 받는다:
1. 2장 2번 입력칸에 `https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl` (두 개, 띄어쓰기로)
2. 채널 선택 화면에서 그 채널을 고른다 → Refresh token 복사
3. Secrets 값 교체: 돈 줍는 삼촌 `YT_REFRESH_TOKEN`, 5락실 `RAKSIL_YT_REFRESH_TOKEN`, BEEKAY SONGS `MUSIC_YT_REFRESH_TOKEN`
- 권한이 없는 채널은 건너뛰고 나머지만 단다(실패해도 통계 작업은 계속). 고정(핀)은 API가 없어 스튜디오에서 직접.
- 채널 자신의 댓글은 댓글 투표 집계에서 뺀다. 끄기: 저장소 변수 `FIRST_COMMENT_ENABLED` = `false`.
- **11/24 사고**: MUSIC 토큰을 받을 때 채널 선택에서 돈삼촌이 골라져, 노래 영상 3개에 '돈 줍는 삼촌' 이름 댓글이 달림 → 지움(yt-comment-cleanup).
  이제 댓글 전에 '토큰 채널 == 영상 채널'을 확인하고, 노래 채널 첫 댓글은 BK 재확인 전까지 꺼 둠(first_comment.ENABLED).
  노래 업로드도 토큰 채널 이름이 'BEEKAY SONGS' 가 아니면 멈춤(music_channel.music_token). 다시 받을 땐 2장 3번 채널 선택에서 꼭 **BEEKAY SONGS** 선택.

## 채널 확인 (11/24, BK '메일 하나당 채널이 2개씩이라 조심해야돼')
채널 4개가 구글 계정 2개에 2개씩 나뉘어 있어, 토큰을 받을 때 엉뚱한 채널이 골라지기 쉽다 (11/24 RAKSIL·MUSIC 토큰이 둘 다 돈삼촌 채널로 발급됨).
- 이제 `youtube.access_token` 이 `config/yt_channels.json` 의 토큰(YT / RAKSIL / WEBNOVEL / MUSIC)으로 접근할 때마다 토큰의 채널을 읽어 확인한다.
  다르거나 확인이 안 되면 그 작업(업로드·댓글·수정)을 멈추고 실패로 끝난다. 엉뚱한 채널에는 아무것도 올라가지 않는다.
- 토큰 다시 받기: oauthplayground 2장 순서 그대로, **로그인할 때 그 채널이 있는 구글 계정**으로 → 채널 선택 화면에서 **그 채널 이름**을 확인하고 고른다.
  채널 선택 화면이 안 나오고 바로 넘어가면, 시크릿 창에서 다시 하거나 로그인 화면에서 '다른 계정 사용'.
  | Secret | 골라야 할 채널 |
  |---|---|
  | YT_REFRESH_TOKEN | 돈 줍는 삼촌 |
  | RAKSIL_YT_REFRESH_TOKEN | 5락실 |
  | WEBNOVEL_YT_REFRESH_TOKEN | 한 화만 더 |
  | MUSIC_YT_REFRESH_TOKEN | BEEKAY SONGS |
- 받은 뒤 확인: Actions → yt-comment-cleanup → Run workflow → 요약 첫 줄들에 '토큰 → 채널' 이 나온다.
