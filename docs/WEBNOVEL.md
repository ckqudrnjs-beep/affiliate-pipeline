# 웹소설 쇼츠 '한 화만 더' (2026-11-21)

기준은 [DIRECTION.md](DIRECTION.md) 2-8. 코드 `src/pipeline/webnovel.py`, 예약 `.github/workflows/webnovel.yml`, 설정 `config/webnovel.json`.

## 1. 점수표 (40점, 화마다 + 작품 전체)
**합격 = 32점 이상 + 어느 항목도 2점 이하 없음.** 미달이면 판정 의견대로 고쳐 쓰고 다시 채점(최대 2번), 그래도 미달이면 그 화를 새로 짬. 채점은 대본을 쓴 호출과 **다른 호출(판정기)**이 한다.

| # | 항목 (각 5점) | 5점 기준 |
|---|---|---|
| 1 | 첫 3초 훅 | 첫 카드 한 줄에 사건·위험. 배경 설명으로 시작하면 2점 |
| 2 | 끝 장면 궁금증 | 마지막 카드가 새 질문을 던지고 끊김, 예고와 이어짐 |
| 3 | 주인공 매력 | 직업·능력·말투 중 하나가 분명, 당하기만 하지 않음 |
| 4 | 갈등·긴장 | 적이 똑똑하고, 이번 화에서 판이 한 번 뒤집힘 |
| 5 | 속도 | 카드 8~10장, 한 장 한 정보 |
| 6 | 독창성 | 장르 공식 + 새 비틀기 하나. 기존 작품 줄거리·문장·인물과 겹침 없음 |
| 7 | 타깃 적합 | 20~40대 여성. 사이다·관계 긴장, 짧고 단정한 문장 |
| 8 | 정책·안전 | 실격 조건 없음 |

**실격(점수 무관 탈락)**: 첫 장면·썸네일 잔혹 묘사 / 기존 웹소설·웹툰·드라마 베끼기 / 실존 인물·기업 / 미성년자 연애·폭력 / 자해·자살 방법 / AI 그림 표기 누락. 코드(`policy_problems`)가 금지 표현을 한 번 더 걸러낸다.

## 2. 대본 형식
- `data/webnovel/works/<작품>/season.json`: 제목, 장르, 인물, 색(style).
- `data/webnovel/works/<작품>/ep/NN.json`: `cards` = [{"lines": [[글, 스타일]], "motif": 모티프}], `next` = 다음 화 제목.
- 번외 `extra/NN.json`: `after`, `title`, `pov`(시점 인물), `cards` 형식은 ep 와 같음.
- 스타일: n 본문 / q 대사 / r 강조(빨강) / g 금색 / s 작게 / big·bigr 크게. 한 줄 15자 안팎(넘치면 자동으로 글자 줄임).
- 모티프: wine, wine_dark, wine2, phone, phone_msg, paper, clock, gift, pearl, rec, glass, light (코드로 그림).
- 새 작품을 시작할 때는 season.json style 색을 바꾸고, 필요하면 모티프를 추가한다.
- 11/22 시즌1 3~15화 점검(novel-studio story-analyst, BK "개연성 복선 여운"): 도윤 사망 시점(서연 사망 석 달 뒤)·깨어난 시점(결혼식 사흘 전) 정리, 오정숙(3화 담당 설계사)·진주 팔찌(4화)·11시 17분(7화)·채아 회귀(11·14화) 복선 추가, 8화 선불폰은 심사역 협조 공문으로 확인, 11화 반전은 "그날 와인은 채아가 골랐어", 13화 통화 유지+구급차 대기로 구출·생존 근거, 14화 자해로 읽히지 않게 "내가 증거가 돼 줄게", 차민혁 39세. 11/23 BK "뻔하지 않게, 90점 이상": 3~15화를 재구성(흑막=서연 회사 백상우 팀장, 서연이 안 읽고 결재한 7건, 해결은 내부신고·조회 기록 등 심사역 능력, 독 잔 고르기·경찰 난입·녹음 자백 제거, 시즌2 훅=아버지 어음). 독립 심사(quality-verifier, 100점: 훅15·개연20·복선15·캐릭15·여운15·뻔X20) 평균 51~79→82~86. 새 시즌도 같은 점검(시간선·정보 경로·복선 간격·마지막 카드 여운·중간 유입)을 거친다.

## 3. 업로드
- 매일 16:23 KST 예약 → 다음 화를 만들어 **21:00 KST 공개 예약**(늦게 돌면 바로 공개).
- `selfDeclaredMadeForKids=false`(아동용 아님) 자동. ep 에 `"ai": true` 면 설명란 AI 표기, `"ai_realistic": true` 면 합성 콘텐츠 표시.
- `visibility: private` 이면 **첫 화만 비공개로 올리고 멈춤** → BK 확인 → `schedule` 로 바꾸면 매일 진행.
- `schedule` 로 바뀐 첫 실행에서 비공개로 올렸던 화는 그날 `promote_hour`(20:00 KST) 공개 예약으로 자동 전환(토큰에 youtube 권한 필요, 실패하면 텔레그램으로 링크 → 스튜디오에서 공개).
- 기록 `data/youtube/webnovel.json`. 멈추기: 저장소 변수 `WEBNOVEL_YT_ENABLED` 를 `false`.
- **화끼리 연결(11/22)**: 새 화 설명란에 '◀ 이전 화'·'⏮ 1화부터 보기' 링크, 올린 뒤 이전 화 설명란에 '▶ 다음 화' 링크를 자동으로 넣는다(videos.update, 기록 linked=true). 영상 끝 카드엔 다음 화 제목이 이미 있음. 쇼츠 '관련 동영상' 칸과 고정 댓글 고정은 API가 없어 자동 불가.
- **구독 장치(11/23, BK "네")**: ① 끝 카드에 '내일 밤 9시 / 구독해야 알림이 와요' ② 매 실행 때 어제까지 공개된 화에 예고 댓글 자동 작성("▶ 다음 화 N화 「제목」… 매일 밤 9시 연재", commentThreads.insert, 기록 commented=true, config `comments: false` 로 끄기). 고정은 BK가 스튜디오에서 '고정'만 누름. 토큰에 `youtube.force-ssl` 권한이 없으면 실패 알림이 오고, 4장 2번 범위에 추가해 토큰을 다시 받는다. ③ 설명란 맨 위 '⏮ 1화부터 정주행: 재생목록 링크'.
- **먼저 보기 게시물(11/23, BK '1번')**: 공개 예약으로 올린 직후, 그 화의 앞 카드 2장 글 + 정사각 그림(1080x1080)을 텔레그램으로 보낸다. BK: 글 복사 → 유튜브 앱 '만들기 → 게시물' → 붙여넣기 + 그림 첨부 → 게시. YouTube Data API에 게시물(커뮤니티) 기능이 없어 자동 게시는 불가. 마지막 반전 카드는 보여 주지 않는다. '구독하면 ○○ 드려요' 같은 보상 문구 금지. 미리 보기: `python -m pipeline.webnovel preview 4`. 끄기: config `preview: false`.
- **롱폼 몰아보기(일요일)**: 쇼츠 5화(1~5, 6~10, 11~15)가 모두 공개되면 그 주 일요일에 가로 1920x1080 영상(약 3분)을 만들어 **22:00 KST 공개 예약**. 구성: 표지 → 화마다 챕터 카드 + 본문 → **번외(롱폼 전용)** → 다음 몰아보기 예고. 설명란에 챕터 시간 자동. 번외 대본 `data/webnovel/works/<작품>/extra/NN.json`(`after` = 묶음 마지막 화)이 없으면 만들지 않는다(쇼츠 이어 붙이기만 하면 재사용 콘텐츠로 볼 수 있음). 끄기: config `long: false`. 손으로: Run workflow 에서 `long` 체크.

## 4. BK 1회 설정 (약 10분)
돈삼촌 업로드에 쓰는 Google Cloud OAuth 앱을 그대로 쓰고, **'한 화만 더' 채널용 갱신 토큰만** 새로 받는다.
1. https://developers.google.com/oauthplayground → 오른쪽 위 톱니 → "Use your own OAuth credentials" 체크 → 클라이언트 ID·비밀 입력 (https://console.cloud.google.com/apis/credentials 에서 확인)
2. 왼쪽 입력칸에 `https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl` 입력 (force-ssl = 예고 댓글) → **Authorize APIs** (업로드 + 재생목록 자동 추가. 업로드만 원하면 `.../auth/youtube.upload`)
3. 구글 계정 선택 → **채널 선택 화면에서 '한 화만 더'(옛 OOF FRENZY)** 선택 → "확인되지 않은 앱" 경고 → 고급 → 이동 → 허용
4. **Exchange authorization code for tokens** → `Refresh token` 복사 (채팅·파일에 붙이지 말 것)
5. https://github.com/ckqudrnjs-beep/affiliate-pipeline/settings/secrets/actions → New repository secret → 이름 `WEBNOVEL_YT_REFRESH_TOKEN`, 값 = 4번 토큰
6. 같은 화면 Variables 탭 → `WEBNOVEL_YT_ENABLED` = `true`
7. 확인: https://github.com/ckqudrnjs-beep/affiliate-pipeline/actions/workflows/webnovel.yml → Run workflow → 요약에 "웹소설 … 1화 업로드 (비공개…)" 링크가 나오면 성공.
- 재생목록: 스튜디오에서 '나를 죽인 남편이 회귀했다' 재생목록을 만들고 ID(PL…)를 알려 주면 config 에 넣는다.

## 5. 다음 작업
- 시즌 2 대본 자동 쓰기·판정기(Claude API, 주 1회 7화 묶음, 상한 따로) — 시즌 1 이 끝나기 전 PR.
- novel-studio 플러그인(BK 11/21 설치)으로 시즌 설계·훅·연속성 점검.

## 그림 모드 (11/23 BK 결정)

- BK가 트렌드 조사 뒤 A안 선택: 화마다 클링 웹툰 그림 1장 + 느린 줌 + 홈 피드 안전 영역(y 290~590) 제목 띠 + 아래 자막.
- `data/webnovel/works/<작품>/art/NN.jpg`가 있으면 그림 모드, 없으면 기존 카드 화면.
- 얼굴 고정 (BK "인물 얼굴은 똑같이"): 클링 주체(Element) 4명 — 한서연 327417738302601, 강도윤 327417740312169 (4화 그림에서 잘라 등록), 윤채아 327418033303382, 백상우 327418034304373 (기준 초상 새로 생성). 기준 그림은 프로젝트 파일 fun-channel/얼굴기준/.
- 장면 규칙: 한 장에 1~2명만 (4명 넣으면 얼굴이 흐트러짐), 얼굴은 화면 가운데, 위 1/5과 아래 1/3은 어둡고 단순하게 (제목 띠·자막 자리).
- 모델 kling-image-v4_0 image_to_image, 9:16 2k, 1장 4 크레딧. 클링 사용은 매번 BK 승인 뒤.
- 시즌 1: 4~15화 12장 완성 (총 60 크레딧 = 4화 4 + 테스트 12 + 44).
