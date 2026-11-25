# Claude 작업 도구 (스킬·MCP) 검토

2026-11-16 BK 요청으로 8개 검토. 원칙: 비밀번호·키에 접근하는 외부 MCP 서버는 넣지 않는다. 넣을 때는 코드 검토 + 버전 고정 + PR.

| 도구 | 판정 | 상태 |
|---|---|---|
| claude-video (bradautomates) | 도움됨 | `.claude/skills/watch` 설치 (커밋 고정, 키 없이 local) |
| hyperframes (HeyGen) | 조건부 사용 | 글자만으로 완결되는 정보 Shorts에만. 규칙은 SHORTS_GROWTH.md. 0.9.56 고정, 통계 끔 |
| taste | 애매 | 애드센스 검토 중 디자인 큰 변경 보류 |
| graphify, ecc, ponytail, headroom | 불필요 | 우리 규모에서 효과 미미, ecc는 설정 충돌 우려 |
| omniroute | 거절 | 무료 계정 묶어 우회 → 약관 위반·계정 정보 노출 위험 |

## 2차 설치 (2026-11-16, BK "다 설치해줘요")

MCP는 저장소 `.mcp.json` 에 버전 고정으로 넣었다. 키는 파일에 없고 환경변수(`${...}`)로만 받는다. 키가 없으면 그 서버만 안 켜진다.

| 도구 | 고정 버전 | 권한 | 하는 일 |
|---|---|---|---|
| chrome-devtools (Google 공식, Apache-2.0) | 1.13.0, `--headless --isolated --usageStatistics=false` | 없음 | 속도 점수·모바일 깨짐·콘솔 오류 점검 |
| search-console (AminForou/mcp-gsc, MIT) | 커밋 45291df | `webmasters.readonly` (GSC_ALLOW_DESTRUCTIVE=false) | 색인 수·검색어·색인 실패 이유 조회 |
| naver-search (isnow890/naver-search-mcp, MIT) | 1.0.55 | 네이버 개발자 키(검색·데이터랩) | 검색 트렌드로 글·쇼츠 주제 고르기 |
| cloudflare (공식 원격 MCP) | mcp.cloudflare.com | OAuth, 동의 화면에서 읽기 권한만 | 방문 통계·D1·배포 상태 조회 |
| 유튜브 분석 (자체 `src/pipeline/yt_analytics.py`) | - | `yt-analytics.readonly` 별도 토큰 | 시청 비율·공유를 주간 점검표에 추가 |

코드 점검: mcp-gsc 는 기본 읽기 전용이고 구글 API만 부른다. naver-search-mcp 는 openapi.naver.com·naverapihub 만 부른다. 둘 다 키를 다른 곳으로 보내는 코드 없음.

플러그인(claude.ai 계정에서 설치): Security Guidance(Anthropic), Marketing(Anthropic, seo-audit 위주, 유료 Ahrefs·Similarweb 연결 안 함), rampstack-seo(커뮤니티, 지침만). 제외: Supermetrics·Windsor·Trackian·AdvisorPPC·Hyper(유료·외부로 데이터 전송), Krea(유료), playwright 플러그인(중복), GA MCP(사이트에 GA 없음).

BK 연결 순서: plan/TOOLS_SETUP_BK.md.

### 2026-11-16 23:30 실제 사용 결과
- BK는 데스크톱 앱 Code 탭(원격 환경)을 쓰는데, 거기서는 플러그인이 막혀 있고 서치콘솔 MCP(브라우저 로그인 방식)도 붙지 않음.
- 그래서 플러그인은 건너뜀(보안 점검은 security-review 스킬로 대신). 네이버는 NAVER API HUB로 이전·카드 필요 → BK 보류.
- 서치콘솔은 GitHub Actions 읽기 전용 수집 `pipeline.gsc_stats` (매일 07:20 KST, docs/SEO_WEEKLY.md)로 대체. 설정은 docs/SEO_SETUP.md.
- 유튜브 분석 토큰 두 채널 모두 연결 완료 (11/16 22:55).

## 3차 설치: 쇼츠 기획 도구 (2026-11-17, BK "쇼츠 컨텐츠 기획을 위한 스킬·MCP 찾아서 설치")

모두 무료, 새 키 없음. 플러그인·MCP는 BK 앱 환경에서 막혀 있어 **저장소 스킬 + GitHub Actions** 로만 넣었다.

| 도구 | 출처·고정 | 하는 일 |
|---|---|---|
| `shorts-planner` (자체 스킬) | - | 우리 규칙(주부·아하·숫자 훅·상품 없음)을 먼저 적용하고 아래 도구를 순서대로 쓰게 하는 기획 순서표 |
| `viral-youtube-shorts`, `viral-hooks`, `viral-captions-and-ctas`, `viral-short-form-ideas` | vyralcontent/content-skills (MIT) 커밋 349e495 | 쇼츠 길이·루프·첫 3초, 훅 후보, 첫 줄·해시태그·고정 댓글, 아이디어 기둥. 글만 있음(코드·네트워크 없음), 광고 배너 줄만 삭제 |
| 트렌드 레이더 `pipeline.trend_radar` + `trend-radar.yml` | 자체, 유튜브 공식 Data API | 매주 월 06:50 KST, 키워드(`config/trend_keywords.json`)별 지난 7일 한국 쇼츠 상위 → `docs/SHORTS_TRENDS_WEEKLY.md`. 기존 `YOUTUBE_API_KEY` 사용, 할당량 약 1,500/주 |

검토 후 뺀 것:
- AgriciDaniel/claude-youtube (MIT): 내용은 좋지만 유료 DataForSEO 전제가 많고, 자막 수집 스크립트가 비공식 방식. 우리 수집기와 겹침.
- vidIQ 커넥터: 유료 구독 중심 + BK 앱 환경에서 커넥터 막힘. 필요하면 BK가 무료판을 웹에서 직접.
- 구글 트렌드 비공식 라이브러리(pytrends): 스크래핑이라 제외. 공개 RSS(KR 인기 검색어)만 레이더에 붙임(실패 시 건너뜀).
- 네이버 데이터랩: 카드 등록 필요 → 11/16 BK 보류 그대로.

## 4차: 상업용 오픈소스 (2026-11-25, BK "깃허브 오픈소스 상업용 사용 가능한 것 검토 후 사용", "다 해도 되지?")

이미 쓰는 것: faster-whisper(가사 자막), rembg(배경 지우기), 위 1~3차 도구. HyperFrames 는 11/25 시험 후 미채택.

| 도구 | 라이선스 | 상태 | 하는 일 |
|---|---|---|---|
| lychee 0.24.2 | MIT/Apache-2.0 | `linkcheck.yml` 월 11:10 KST, 실행 파일 sha256 고정 | 돈삼촌(저장소로 빌드한 전체 HTML, noindex 상품 페이지 포함)·5락실(실제 사이트맵) 링크 검사 → BK 텔레그램. 사이트는 안 고침. 403·429(봇 차단)는 확인 불가로 빼고, 알리 '상품 없음' 200 페이지는 못 잡음 |
| Kiwi (kiwipiepy 0.25.1) | Apache-2.0 | `pipeline.ko_check`, claude-jobs·raksil-shorts 작업에 설치 | 화면에 오르기 전 '틀린 게 확실한 것'만 고침: 사전 목록(됬→됐, 되요→돼요, 할께→할게, 몇일→며칠 …) + 관형형 뒤 의존명사 띄어쓰기(나올수→나올 수). Kiwi 통째 띄어쓰기는 '가스비→가스 비'처럼 쪼개서 안 씀. Kiwi 가 없으면 사전 목록만 |
| Pagefind | MIT | **보류: 12/8 애드센스 재신청 결과 뒤** | 돈삼촌 사이트 안 검색창. 심사 중 기능 추가를 피함 |

적용 위치(ko_check): 5락실 질문 A·B·상황·띠·몽글이 이유·꼬리, 동전이 대본(제목·띠·유튜브 제목·자막·공감 한 줄·투표·줄거리·팁), 동전이 투표 문구. 영상 형식(글자 크기·위치·길이 규칙)은 그대로.

검토 후 뺀 것: MoneyPrinterTurbo(MIT지만 파이프라인 중복 + 스톡·TTS 정보형 = 방향 금지), Remotion(자체 라이선스, 회사 규모 따라 유료), Umami 자체 호스팅(서버비 + 심사 중 새 스크립트), Coqui XTTS(모델 비상업), 네이버 맞춤법 라이브러리(비공식 긁어 오기).
