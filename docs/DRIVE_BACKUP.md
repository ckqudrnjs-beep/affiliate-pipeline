# 만든 영상·이미지 드라이브 자동 백업 (2026-11-19)

## 지금 어디에 남아 있나 (2026-11-19 점검)
| 결과물 | 깃허브 저장소 | 그 밖 | 사라질 위험 |
|---|---|---|---|
| 돈삼촌 쇼츠 mp4 (`media/youtube`) | ✅ 커밋됨, 지운 것도 git 기록에 남음 | 유튜브 | 낮음 |
| AI 클립·삼촌 캐릭터 영상 (`media/ai_clips`, `media/uncle`) | ✅ | | 낮음 |
| 5락실 포스터·OG (`playground/static/img`, `og`), 사이트 이미지 (`static/og`) | ✅ | 사이트 | 낮음 |
| 웹툰 컷 (`config/webtoon`) | ✅ | | 낮음 |
| **5락실 쇼츠 mp4** (매일 17:00·20:00) | ❌ 커밋 안 됨 | 릴리스 `raksil-shorts` **최근 14개만**, Actions 아티팩트 7일, 유튜브 | **높음** (14일 지나면 유튜브에만) |
| 인스타 릴스·카드뉴스 (`static/ig`) | 게시 전 커밋 → 게시 후 삭제(기록엔 남음) | Actions 아티팩트 7일 | 중간 |
| 공유 폴더 스크린샷·시안 (`/mnt/project-files`, 약 570MB) | ❌ | 프로젝트 공유 폴더만 | 중간 (수동 복사) |

공개 저장소이므로 백업을 위해 비공개 자료를 커밋하지 않는다. 백업은 드라이브(비공개)에만 한다.

## 자동 백업 구조
- 워크플로 `.github/workflows/drive-backup.yml`, 매일 03:30 KST, 비용 0원 (공개 저장소 Actions + 드라이브 무료 15GB).
- 코드 `src/pipeline/drive_backup.py`. git 기록 전체에서 결과물 파일 버전을 찾고, 5락실 쇼츠 릴리스를 내려받아 함께 올린다.
- 드라이브 폴더: `자동 백업 (돈삼촌·5락실)/<종류>/<YYYY-MM>/<YYYY-MM-DD>_<파일이름>`
  - 종류: 쇼츠-돈삼촌, 쇼츠-5락실, AI클립, 삼촌-캐릭터영상, 인스타, 5락실-포스터, 사이트-이미지, 사이트-영상, 웹툰, 쇼츠-초안
- 이미 올린 파일은 건너뛴다(파일마다 고유 키 저장). 한 번에 최대 400개·3GB, 남으면 다음 날 이어서.
- 권한은 `drive.file`: 이 앱이 만든 파일만 보고 쓴다. BK 드라이브의 다른 파일은 보지도 지우지도 못한다.
- 폴더는 처음 실행 때 "내 드라이브" 맨 위에 생긴다. "어필라이트 수익화 관련 자료" 안으로 끌어 옮겨도 계속 그 폴더에 쌓인다.
- 멈추기: 저장소 변수 `DRIVE_BACKUP` = `off`.
- 용량: 지금까지 결과물 약 230MB + 5락실 쇼츠 하루 수 MB → 1년 약 3~5GB 예상(무료 15GB 안).

## BK 1회 설정 (약 5분)
유튜브 업로드와 같은 OAuth 앱을 쓰고, **드라이브용 갱신 토큰만** 새로 받는다.

1. https://console.cloud.google.com/apis/library/drive.googleapis.com → 사용 (유튜브 업로드 앱이 있는 프로젝트)
2. https://developers.google.com/oauthplayground 새로 열기
3. **먼저** 오른쪽 위 톱니 → "Use your own OAuth credentials" 체크 → 업로드용 클라이언트 ID·보안 비밀 → Close
4. 왼쪽 입력칸에 `https://www.googleapis.com/auth/drive.file` → Authorize APIs
5. 백업을 받을 구글 계정(드라이브 "어필라이트 수익화 관련 자료"가 있는 계정)으로 로그인 → 허용
6. Exchange authorization code for tokens → Refresh token 복사 (채팅·파일에 붙이지 말 것)
7. https://github.com/ckqudrnjs-beep/affiliate-pipeline/settings/secrets/actions/new → 이름 `DRIVE_REFRESH_TOKEN`, 값 붙여넣기 → Add secret
8. 확인: https://github.com/ckqudrnjs-beep/affiliate-pipeline/actions/workflows/drive-backup.yml → Run workflow → 요약에 "새로 올림 N개"와 드라이브 폴더 링크

오류: `401 unauthorized_client` = 3번 톱니 체크 누락. `403 accessNotConfigured` = 1번 드라이브 API 사용 안 함.

## 공유 폴더(/mnt/project-files) 백업
Actions 에서는 이 폴더에 접근할 수 없다. BK PC(구글 드라이브 데스크톱 G:)가 연결돼 있을 때 Claude 가
`G:\내 드라이브\어필라이트 수익화 관련 자료\자동 백업 (돈삼촌·5락실)\공유폴더\` 로 복사한다(수동, 가끔).

## 변경 이력
- 2026-11-19: 최초 작성 (현황 점검 + 자동 백업 워크플로).
