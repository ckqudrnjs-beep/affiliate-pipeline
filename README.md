# affiliate-pipeline (돈 줍는 삼촌)

제휴 수수료(쿠팡·네이버·삼성·알리·링크프라이스) 자동화 파이프라인. 계획 문서는 [docs/](docs/), 에이전트 지침은 [AGENTS.md](AGENTS.md).

## 구조
```
src/pipeline/
  coupang.py      쿠팡 파트너스 Open API (골드박스·검색·딥링크)
  compliance.py   발행 전 준수 검사 (대가성 문구 첫 200자, 허용 도메인, 금지 표현, 가격 기준일)
  drafts.py       일일 SNS 초안 생성
tests/            단위 테스트 (python -m unittest)
drafts/           날짜별 초안 (PR로 승인)
.github/workflows/daily-drafts.yml   매일 07:00 KST 초안 생성 → 승인 PR
docs/             PLAN, AFFILIATES, CHANNELS, COMPLIANCE, DECISIONS
```

## 최종 승인 전 (지금)
쿠팡 Open API는 최종 승인 후 열립니다. 그 전에는 `config/products.csv`에 파트너스 사이트에서 직접 만든 링크를 넣으면 같은 흐름으로 초안이 만들어집니다. 키 Secret이 등록되면 자동으로 API 모드로 바뀝니다.

## 승인 흐름
1. 매일 아침 Actions가 초안을 만들고 `[승인 대기]` PR을 연다.
2. 검사 결과(✅/⛔)를 보고 고칠 것은 고친 뒤 머지한다.
3. 머지된 초안만 발행 대상이 된다 (발행 자동화는 Phase 1에서 추가).

## 비밀값 (사용자가 직접 등록)
Settings → Secrets and variables → Actions → New repository secret
- `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`

## 로컬 테스트
```
PYTHONPATH=src python -m unittest discover -s tests
```
