# BEEKAY SONGS 노래 채널 (구 Deep Work Lab) — 2026-11-21

> BK 결정 11/21 20:30~21:05 KST: 기존 채널 'Deep Work Lab'을 **BEEKAY SONGS**(@beekaysongs)로 바꿔
> BK가 Suno로 만든 **아이돌·보이그룹 노래 + 가끔 발라드**를 곡마다 커버를 입혀 올린다. 기획·시안: /mnt/project-files/music-channel/

## BK가 할 일 (곡마다 1분)
1. Suno에서 곡을 만들고 **mp3 다운로드** (Suno 유료 플랜에서 만든 곡만. 무료 플랜 때 곡은 상업 이용 불가)
2. 구글 드라이브 **'BEEKAY SONGS'** 폴더에 넣기 (폴더는 BK가 내 드라이브에 이 이름으로 한 번 만든다)
   - 커버를 직접 고르고 싶으면 **같은 이름의 jpg/png** 를 같이 넣는다 (예: `여름밤.mp3` + `여름밤.jpg`). 없으면 곡 파일 안 Suno 커버를 씀
   - 발라드인데 자동 판정이 틀리면 파일 이름에 '발라드'를 넣는다
3. 끝. 화·금 오전에 오래된 곡부터 1개씩 영상(전곡 + 후렴 쇼츠 40초)을 만들어 올리고 텔레그램으로 알려 준다.

## 자동으로 되는 것
| 항목 | 방법 |
|---|---|
| 제목 | 곡 파일 안 제목 → `제목 | BEEKAY SONGS`, 쇼츠 `제목 🎧 #shorts` |
| 화면 | 흐린 커버 배경(천천히 움직임) + 커버 + 제목 + 장르 + 파형 + 진행 막대 + 반짝이 (`pipeline.music_cover`) |
| 장르 표시 | 템포로 자동: 88 BPM 미만 BALLAD, 나머지 K-POP · IDOL |
| 쇼츠 구간 | 소리가 가장 센 40초(후렴 추정), 인트로 15%는 피함 |
| 설명란 | AI 음악 표기(Suno 유료 플랜·실제 가수와 무관) + 가사 전체(곡 파일 안 가사) |
| 정책 | 카테고리 음악, 아동용 아님, '변경·합성 콘텐츠' 표시 켬, 실제 가수·그룹 이름이 제목에 있으면 멈춤 |
| 공개 | `config/music_channel.json` visibility: `private`(기본, BK 확인) → 괜찮으면 `schedule`(당일 19:00 KST, 쇼츠 다음 날 19:00) |

## 연결 (BK가 직접, 한 번, 약 15분 · 값은 GitHub Secrets 에만)
기존 업로드용 Google Cloud 앱(`YT_CLIENT_ID`/`YT_CLIENT_SECRET`)을 그대로 쓰고 **토큰 2개**만 새로 받는다.

### A. 채널 업로드 토큰 → `MUSIC_YT_REFRESH_TOKEN`
1. https://developers.google.com/oauthplayground → 오른쪽 위 톱니 → "Use your own OAuth credentials" 체크 → 기존 클라이언트 ID·보안 비밀
2. 왼쪽 입력칸 `https://www.googleapis.com/auth/youtube.upload` → Authorize APIs
3. 로그인 → **채널 선택에서 BEEKAY SONGS** (삼촌·5락실 채널 고르면 안 됨). "확인되지 않은 앱" → 고급 → 이동
4. Exchange authorization code for tokens → Refresh token 복사
5. https://github.com/ckqudrnjs-beep/affiliate-pipeline/settings/secrets/actions → New repository secret → `MUSIC_YT_REFRESH_TOKEN`

### B. 드라이브 읽기 토큰 → `MUSIC_DRIVE_REFRESH_TOKEN`
1. https://console.cloud.google.com/apis/library/drive.googleapis.com → Google Drive API **사용** (이미 켜져 있으면 넘어감)
2. OAuth Playground 에서 A-1 과 같이 설정 → 왼쪽 입력칸 `https://www.googleapis.com/auth/drive.readonly` → Authorize APIs
3. 로그인 → **채널이 아니라 BK 본인 계정**(드라이브 폴더가 있는 계정) 선택
4. Refresh token 복사 → Secret `MUSIC_DRIVE_REFRESH_TOKEN`
5. 다 쓰면 톱니에서 "Use your own OAuth credentials" 체크 해제
- 읽기 전용이라 드라이브 파일을 바꾸거나 지울 수 없다. 코드는 'BEEKAY SONGS' 폴더만 본다.

### C. 켜기
- 저장소 변수(Variables) `MUSIC_YT_ENABLED` = `true` → 그 전까지는 만들기만 하고 Actions 아티팩트로 남김
- 확인: Actions → music-channel → Run workflow → 요약에 "업로드 완료"와 Studio 링크

## 주의
- 같은 곡 다시 올리지 않음 (`data/music/uploaded.json`, 키 = 드라이브 파일 id). 다시 올리려면 그 줄을 지운다.
- 하루 업로드 한도(10,000 유닛, 업로드 1건 1,600) 안: 1회 실행 = 2건(전곡+쇼츠).
- 대량·반복 업로드 금지('진정성 없는 콘텐츠'): 주 2곡까지, 곡마다 새 커버.
- Suno 곡 안 커버는 360×360 으로 작아 조금 흐림 → 더 큰 커버가 있으면 같은 이름 jpg 로 넣기.

## 11/21 결정 (BK)
- Suno 곡 파일 속 커버(360px)는 흐려서 쓰지 않음. 커버 = 드라이브에 같은 이름 jpg, 또는 Claude 가 만든 그림(Kling, **곡마다 BK 확인 후** 크레딧 4개) → `config/music/covers/` + `releases`.
- 커버 없는 곡은 올리지 않고 텔레그램 알림 (`require_cover: true`).
- 같은 곡 여러 버전(여성/남성 Feat.)은 따로, 3~4일 간격 공개. 뒤 버전 설명에 앞 버전 링크 + "어느 쪽이 더 좋아요?" 댓글 질문 (`releases.pair_of`, `ask`).
- 공개 방식 `schedule`(저녁 7시, 쇼츠 다음 날). 첫 곡: 다른 차원 끝 Female 11/22, Male 11/25.

## 뮤직비디오 (BK 2026-11-23)
- BK "1번": 이미 올라간 풀 버전(가사 영상)은 그대로 두고 **Official MV** 를 따로 올린다.
- 만드는 법: 기존 Kling 그림(커버 2장 + 정면 그림 3장, config/music/mv/)을 천천히 확대·이동 + 1초 겹침 전환, 곡 전체 가사(받아쓰기로 시간만 잡고 글자는 공식 가사) 자막. 새 그림 생성 없음. 코드 `pipeline.music_mv`.
- 설정: `config/music_channel.json` releases[드라이브 id].mv (title, song, publish_at, images).
- 실행: Actions music-channel → Run workflow → `mv_fid` 에 드라이브 파일 id. 기록은 uploaded.json `mv:<id>` (두 번 안 올림).
- `lyrics_fid` 는 가사 시간만 로그로 뽑는다(업로드 없음).
- 새 Kling 그림은 BK 승인 후에만 (정면 그림 4장 16크레딧은 11/23 BK 승인).
