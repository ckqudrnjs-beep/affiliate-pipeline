# 5락실 (두 번째 사이트, 5raksil.com 예정)

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
   - 예외 '게임 데이'(월·목, 2026-11-13 BK): 그날 3개 중 1개만 유명 게임을 **말로만** 소재로 쓴 질문 허용
     (예: "마크 서바이벌 1년 vs 로블록스 타이쿤 1년", "배그 자기장 안에서 시작 vs 끝까지 파밍"). 게임·회사를 깎아내리지 않고,
     게임 속 대사·고유 캐릭터 이름·슬로건을 그대로 쓰지 않으며, 공식·제휴처럼 보이게 쓰지 않는다. 그림은 og.py 네온 스타일만.
3. 기존 질문과 같은 선택지 쌍 금지(build.py가 검사).
4. `cd playground && python og.py` 로 새 질문의 미리보기 이미지(static/og/q/<id>.png)를 만들고, `PYTHONPATH=src python -m unittest discover -s tests` 통과해야만 질문 파일과 이미지를 함께 main에 커밋.
5. 사람이 쓴 척하는 글, 가짜 투표 수 금지. 숫자는 D1 집계만.

## 광고(자동, ID 넣으면 켜짐)
- `config.json`: `adfitUnit`(카카오 애드핏 모바일 320x100 단위 ID, DAN-…), `adfitUnitPc`(PC 728x90), `adsensePublisherId`(pub-…), `adsenseSlot`(애드센스 디스플레이 광고 단위 번호).
- 비어 있으면 광고 자리 자체가 안 생김. 애드센스 슬롯이 있으면 애드센스, 없으면 애드핏. 모든 광고 칸에 ‘광고’ 표시.
- 위치: 홈(게임 목록 아래), 질문 페이지(다음 버튼 아래), 게임 페이지(규칙·순위 아래, 조작 버튼과 멀리), 모음·리포트 중간. 페이지당 1~2개.
- `adsensePublisherId` 넣으면 자동 광고 코드 + `ads.txt` 자동 생성.

## 실제 집계 자동 콘텐츠
- 빌드할 때 `https://5raksil.com/api/vote` 공개 집계를 받아 질문 페이지에 결과 문장(20표 이상), `/report` 결과 리포트(30표 이상 질문 5개 이상일 때만) 생성. 실패하면 집계 없이 빌드. 끄기: 환경변수 `PG_NO_STATS=1`.
- 매일 21:37 질문 추가 푸시 → 재빌드 → 숫자도 매일 갱신.

## 다음
- 유형 테스트 주 1개.
