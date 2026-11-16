# Claude 작업 도구 (스킬·MCP) 검토

2026-11-16 BK 요청으로 8개 검토. 원칙: 비밀번호·키에 접근하는 외부 MCP 서버는 넣지 않는다. 넣을 때는 코드 검토 + 버전 고정 + PR.

| 도구 | 판정 | 상태 |
|---|---|---|
| claude-video (bradautomates) | 도움됨 | `.claude/skills/watch` 설치 (커밋 고정, 키 없이 local) |
| hyperframes (HeyGen) | 시험 | `tools/hyperframes/price_short` 시세 Shorts 시험, 0.9.56 고정, 통계 끔 |
| taste | 애매 | 애드센스 검토 중 디자인 큰 변경 보류 |
| graphify, ecc, ponytail, headroom | 불필요 | 우리 규모에서 효과 미미, ecc는 설정 충돌 우려 |
| omniroute | 거절 | 무료 계정 묶어 우회 → 약관 위반·계정 정보 노출 위험 |
