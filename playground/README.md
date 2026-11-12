# 노리터 오락실 (두 번째 사이트, noriteo.com 예정)

계획: /mnt/project-files/plan/PLAYGROUND.md (docs 사본 없음, 이 파일이 저장소 기준 안내).

## 구조
- `build.py` → `dist/` 정적 페이지. 게임은 `games/<slug>/` (meta.json, body.html 규칙·설명 300자 이상, game.js). `ranked: true` 면 매일 같은 판 + 순위.
- `build.py` 질문은 `data/questions.json`(date가 오늘(KST) 이하인 것만 공개).
- `functions/api/vote.js` 투표·이모지 반응 집계, `functions/api/score.js` 오늘의 도전 순위(자동 별명만)(D1 바인딩 `DB`, 비밀값 `VOTE_SALT`).
- `schema.sql` D1 테이블. 원본 IP 저장 안 함(해시 2일 보관).

## Cloudflare Pages 설정 (don3chon과 별도 프로젝트)
- 저장소 affiliate-pipeline, 루트 디렉터리 `playground`, 빌드 명령 `python build.py dist`, 출력 `dist`, 환경변수 PYTHON_VERSION=3.12
- D1 데이터베이스 생성 → schema.sql 실행 → Pages 설정 > Functions > D1 바인딩 이름 `DB`
- 환경변수(암호화) `VOTE_SALT`: 아무 긴 무작위 문자열

## 자동 질문 규칙 (매일 예약 작업)
1. `data/questions.json` 끝에 **내일 날짜** 질문 3개 추가: id `YYYYMMDD-1..3`, a/b 2~40자, note 1~2문장(두 선택지의 차이를 짚는 중립 해설).
2. 금지: 정치·성별·지역·종교 갈등, 실존 인물·브랜드, 성적 내용, 혐오, 사고·참사, 죽음, 미성년자 대상, 도박. 일상·음식·여행·상상·습관 위주.
3. 기존 질문과 같은 선택지 쌍 금지(build.py가 검사).
4. `PYTHONPATH=src python -m unittest discover -s tests` 통과해야만 main에 커밋.
5. 사람이 쓴 척하는 글, 가짜 투표 수 금지. 숫자는 D1 집계만.

## 다음
- 주간 리포트: Pages Function이 D1 집계로 `/report` 를 서버에서 그려 줌(실제 숫자만, 30표 미만 제외).
- 유형 테스트 주 1개.
