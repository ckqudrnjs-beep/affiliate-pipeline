# 서치콘솔 자동 수집 설정 (BK 1회, 약 5분)

`pipeline.gsc_stats` 가 매일 07:20 KST 에 읽기 전용으로 클릭·노출·검색어·사이트맵 색인 수를 모은다 (docs/SEO_WEEKLY.md).
유튜브 업로드와 같은 OAuth 앱을 쓰고, **서치콘솔 읽기 전용 갱신 토큰만** 새로 받는다.

1. https://console.cloud.google.com/apis/library/searchconsole.googleapis.com → 사용 (이미 켰으면 건너뜀)
2. https://developers.google.com/oauthplayground 새로 열기
3. **먼저** 오른쪽 위 톱니 → "Use your own OAuth credentials" 체크 → 업로드용(uploader) 클라이언트 ID·보안 비밀 → Close
4. 왼쪽 입력칸에 `https://www.googleapis.com/auth/webmasters.readonly` → Authorize APIs
5. 서치콘솔에 두 사이트를 등록한 구글 계정으로 로그인 → 허용
6. Exchange authorization code for tokens → Refresh token 복사
7. https://github.com/ckqudrnjs-beep/affiliate-pipeline/settings/secrets/actions/new → 이름 `GSC_REFRESH_TOKEN`, 값 붙여넣기 → Add secret
8. 확인: Actions → gsc-stats → Run workflow → 로그에 "사이트: sc-domain:..." 와 클릭·노출 숫자

오류가 나면 로그의 `[단계] 코드 메시지` 를 보면 된다. `401 unauthorized_client` = 3번 톱니 체크 누락.
