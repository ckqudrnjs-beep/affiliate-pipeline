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
     톤은 10대 후반~직장인(BK 결정 11/13): 월급·출근·자취 같은 어른 상황과 엮고, 초등학생을 겨냥한 말투·주제는 쓰지 않는다.
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

## 3D 게임 (네온 사격장, 2026-11-13)
- `games/range/` 는 다른 게임과 같은 구조(meta/body/game.js)지만, 3D 본체는 `static/js/range.js`(three.js 포함 번들, gzip 약 160KB)를 **시작 버튼을 누를 때** 불러온다.
- 원본 코드: `src3d/range/*.js` (무기 모델 weapons.js, 맵·표적 world.js, 효과음 audio.js, 게임 main.js). 외부 모델·이미지·음원 없음(전부 코드로 생성).
- 고친 뒤 빌드: `cd src3d && npm install && npm run build` → `static/js/range.js` 를 함께 커밋(Cloudflare 빌드는 파이썬만 돌리므로 번들을 저장소에 둔다).
- 점수 상한은 `functions/api/score.js` MAX.range. 매일 같은 판 = `seeded('range'+KST)`.
- 테스트용: 주소 끝에 `#rgdebug` 를 붙이면 `window.__rg` 로 조작 가능.

## 리듬 점프 러너 (통통 네온런, 2026-11-13)
- `games/tongtong/` 2D 캔버스 게임(번들 없음, game.js 하나). 그림·음악(웹오디오 합성)·코스 모두 코드로 생성, 외부 파일 없음. 특정 기존 게임의 이름·캐릭터·레벨·음악을 따라 하지 않는다.
- 코스: `seeded('tongtong'+KST)` 로 조각을 이어 붙이고, 조각마다 같은 물리로 탐색(solve)해 **깰 수 있는 코스만** 채택(판정 여유 0.1칸). 128칸(32박)마다 구간 상승: 100→172 BPM, 장애물 종류·간격 강화.
- 점수 = 오늘 최고 거리(m), score.js MAX.tongtong=200000. 테스트: `#ttdebug` → `window.__tt` (bot=true 자동 플레이, fast(n), jumpTo(x)), 디버그 기록은 순위 제출 안 함.
## 우주 슈팅 (별빛 요격대, 2026-11-13)
- 오리지널 세로 슈팅. 기존 유명 게임의 이름·캐릭터·그림·소리·고유 연출(포획 광선 등)은 쓰지 않는다. 기체·적·보스·효과음·배경음 모두 코드로 생성.
- 페이지 `games/starlight/`, 본체 `static/js/starlight.js`(번들 없이 그대로 배포, 페이지 열리고 잠시 뒤 미리 불러와 스프라이트까지 준비). 포스터 `static/img/starlight-poster.jpg`, 공유 이미지 `static/og/starlight.jpg`.
- 매일 같은 판 = `seeded('starlight'+KST+'#'+단계)`. 점수 상한 `functions/api/score.js` MAX.starlight.
- 성능: 픽셀 비율 최대 2, 화면 픽셀 360만 상한, 그림은 미리 그린 스프라이트만 사용. 시작하면 전체화면(아이폰은 화면 꽉 찬 오버레이).
- 2차(BK 11/13 피드백): 적은 전부 위에서 입장(경로 6종, 편대 모양 4종), 신규 적 스플리터·저격 포드, 편대 돌진·호버 사격·루프, 무기 L(관통)·M(유도)·O(보조기)·B(필살기) 캡슐, 필살기 노바 버스트(스페이스/모바일 버튼), 모선 3종 순환(마더 헥스·트윈 캐논·오비트 코어) + 체력 절반에서 2페이즈.
- 멈춤(BK 11/13): 손으로 멈추기는 한 판에 1번, 멈춘 동안 화면 가림, 재개 시 3초 카운트다운. 탭 전환·전화 등 자동 멈춤은 횟수에 안 셈.
- 테스트용: 주소 끝 `#sldebug` → `window.__sl` (G(), stage(n), god(true), give('L'), bomb()). 디버그 판은 순위에 안 올라감.

## 출석체크 보너스·스킨 상점 (/bonus, 2026-11-13 BK)
- 원칙: **모든 게임은 코인 없이 끝까지 무료**. 코인은 출석·업적·공유로만 생기고 광고 클릭·시청과 무관, 돈으로 판매·현금 교환 없음(애드센스 정책·게임산업법). 직접 수익화는 유입이 늘면 검토(BK).
- 출석: 하루 1번(KST) 🪙1, 7일 연속째 날 🪙2, 최대 60개. 업적 보너스(각 1번): 별빛 5단계 +3, 통통 500m +3, 사격장 4단계 +3, 결과 공유 +2. 기록은 localStorage `nr_bonus` 만.
- 전설 디자인(🪙50, 상점에 '전설' 표시): 별빛 '오로라 세라프'(날개 색 순환 12장 미리 그림 + 무지개 꼬리), 통통 '별고래'(별자리 몸·점프 중 별 분수·은하수 꼬리). 코인 최대 60개(build.py `BONUS_MAX_COINS`, functions/api/profile.js 와 같이 맞출 것).
- 시작 전 공유: 모든 게임 제목 아래와 홈 첫 화면에 선택형 `📤 친구에게 공유` 버튼(`data-pre`, 공통 `shareLink`). 공유를 강제하지 않음. 실제 공유·복사가 끝났을 때만 첫 공유 🪙+2(카카오 버튼은 코인 없음).
- 코인 사용: 이어하기(별빛 요격대 그 자리 목숨 3 / 네온 사격장 탈락 스테이지 재도전, 한 판 1번, 이어한 점수도 순위 반영) + 스킨 사기(BK: 화려할수록 비싸게).
- 스킨(겉모습만, 판정 동일): build.py `DESIGNS`(별빛: 냥냥 요격기 6·원반 UFO 8·드래곤 파이터 12 / 통통: 냥이 5·개구리 7·우주인 10) + `SKINS` 색(0~5). 그림은 starlight.js `shipSprite`, tongtong game.js 그리기 코드.
- 코드: build.py `BONUS_JS`(window.Bonus: checkin/spend/ach/buy/skin/design), `BONUS_CSS`, `BONUS_BODY`. 게임 boot 옵션 `bonus`, `skin`, `design`.

## 가입 없는 프로필 (/profile, 2026-11-13 BK)
- 별명(아바타 이모지 + 한글·영문·숫자 2~10자) + 복구 코드(12자리, 60비트). 코드로 다른 기기에서 코인·스킨·출석·별명 이어 쓰기. 이메일·전화 등 개인정보 없음.
- 서버 `functions/api/profile.js` (new/get/put/del), D1 `profiles`(코드 해시만 저장)·`ptries`(IP 해시 하루 횟수). 테이블은 첫 호출 때 자동 생성(BK 할 일 없음). 틀린 코드 하루 10번 넘으면 차단. 1년 안 쓴 프로필 자동 삭제.
- 별명 규칙·욕설 목록 `lib/nick.js` 하나를 서버(profile.js·score.js)와 화면(build.py가 그대로 넣음)이 같이 쓴다. 순위 별명은 자동 별명 또는 프로필 별명만 허용.
- 동기화: 코인·스킨이 바뀌면 1.5초 뒤 저장(rev 번호로 충돌 시 서버 최신본 채택), 페이지 열 때 10분에 한 번 최신본 확인.
