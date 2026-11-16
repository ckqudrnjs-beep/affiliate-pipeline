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
