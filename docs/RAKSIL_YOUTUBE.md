# 5락실 유튜브 쇼츠 자동 업로드 (2026-11-13)

`.github/workflows/raksil-shorts.yml` 이 매일 **18:00 KST** 에 그날의 밸런스게임 쇼츠(약 14초)를 만들어
5락실 채널에 **바로 공개**로 올린다. 코드: `src/pipeline/raksil_shorts.py`.

- 내용: 오늘 질문 A vs B → 3·2·1 → 어제 질문 실제 투표 결과(20표 이상일 때만) 또는 "다른 사람들은?" → 5raksil.com
- 유료 프로모션 아님(내 사이트 홍보, 협찬·제휴 없음). 광고 문구 넣지 않음.
- AI 음성(Supertonic, 무료)을 쓰면 설명란 "내레이션: AI 음성" + 합성 콘텐츠 표시.
- 같은 날짜는 두 번 올리지 않음(`data/youtube/raksil_uploaded.json`). 질문이 없는 날은 건너뜀.
- `RAKSIL_YT_ENABLED` 가 `true` 가 아니면 만들기만 한다. 영상은 Actions 실행 → Artifacts 에서 7일간 받아 볼 수 있다.

## BK 1회 설정 (약 10분)
돈삼촌 업로드에 쓰는 Google Cloud OAuth 앱을 그대로 쓰고, **5락실 채널용 갱신 토큰만** 새로 받는다.

1. https://console.cloud.google.com/apis/credentials → 기존 OAuth 클라이언트(웹 애플리케이션) 열기
   → 클라이언트 ID 복사. 보안 비밀이 안 보이면 "보안 비밀 추가"로 새로 만든다
   (새로 만들면 GitHub `YT_CLIENT_SECRET` 도 새 값으로 바꾼다. 옛 비밀은 그 뒤 사용 중지).
2. https://developers.google.com/oauthplayground → 오른쪽 위 톱니 → "Use your own OAuth credentials" 체크 → ID·비밀 입력
3. 왼쪽 입력칸에 `https://www.googleapis.com/auth/youtube.upload` 입력 → **Authorize APIs**
4. 구글 계정 선택 후 **채널 선택 화면에서 "5락실"** 선택 (돈 줍는 삼촌 아님!). "확인되지 않은 앱" 경고 → 고급 → 이동 → 허용
5. **Exchange authorization code for tokens** → `Refresh token` 값 복사 (채팅·파일에 붙이지 말 것)
6. https://github.com/ckqudrnjs-beep/affiliate-pipeline/settings/secrets/actions → New repository secret
   - 이름 `RAKSIL_YT_REFRESH_TOKEN`, 값 = 5번 토큰
7. 같은 화면 Variables 탭 → New repository variable → 이름 `RAKSIL_YT_ENABLED`, 값 `true`
8. 확인: https://github.com/ckqudrnjs-beep/affiliate-pipeline/actions/workflows/raksil-shorts.yml → Run workflow
   → 요약에 "5락실 쇼츠 공개 완료: https://youtu.be/..." 가 나오면 성공. 5락실 채널에 올라갔는지 확인.

## 멈추기
`RAKSIL_YT_ENABLED` 를 `false` 로 바꾸면 다음 날부터 올리지 않는다.

## 할당량
하루 10,000 유닛, 업로드 1건 1,600. 돈삼촌(하루 1개) + 5락실(하루 1개) = 3,200 → 여유 있음.
