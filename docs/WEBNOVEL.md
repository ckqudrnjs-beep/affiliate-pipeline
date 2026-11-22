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

## 3. 업로드
- 매일 16:23 KST 예약 → 다음 화를 만들어 **21:00 KST 공개 예약**(늦게 돌면 바로 공개).
- `selfDeclaredMadeForKids=false`(아동용 아님) 자동. ep 에 `"ai": true` 면 설명란 AI 표기, `"ai_realistic": true` 면 합성 콘텐츠 표시.
- `visibility: private` 이면 **첫 화만 비공개로 올리고 멈춤** → BK 확인 → `schedule` 로 바꾸면 매일 진행.
- `schedule` 로 바뀐 첫 실행에서 비공개로 올렸던 화는 그날 `promote_hour`(20:00 KST) 공개 예약으로 자동 전환(토큰에 youtube 권한 필요, 실패하면 텔레그램으로 링크 → 스튜디오에서 공개).
- 기록 `data/youtube/webnovel.json`. 멈추기: 저장소 변수 `WEBNOVEL_YT_ENABLED` 를 `false`.
- **롱폼 몰아보기(일요일)**: 쇼츠 5화(1~5, 6~10, 11~15)가 모두 공개되면 그 주 일요일에 가로 1920x1080 영상(약 3분)을 만들어 **22:00 KST 공개 예약**. 구성: 표지 → 화마다 챕터 카드 + 본문 → **번외(롱폼 전용)** → 다음 몰아보기 예고. 설명란에 챕터 시간 자동. 번외 대본 `data/webnovel/works/<작품>/extra/NN.json`(`after` = 묶음 마지막 화)이 없으면 만들지 않는다(쇼츠 이어 붙이기만 하면 재사용 콘텐츠로 볼 수 있음). 끄기: config `long: false`. 손으로: Run workflow 에서 `long` 체크.

## 4. BK 1회 설정 (약 10분)
돈삼촌 업로드에 쓰는 Google Cloud OAuth 앱을 그대로 쓰고, **'한 화만 더' 채널용 갱신 토큰만** 새로 받는다.
1. https://developers.google.com/oauthplayground → 오른쪽 위 톱니 → "Use your own OAuth credentials" 체크 → 클라이언트 ID·비밀 입력 (https://console.cloud.google.com/apis/credentials 에서 확인)
2. 왼쪽 입력칸에 `https://www.googleapis.com/auth/youtube` 입력 → **Authorize APIs** (업로드 + 재생목록 자동 추가. 업로드만 원하면 `.../auth/youtube.upload`)
3. 구글 계정 선택 → **채널 선택 화면에서 '한 화만 더'(옛 OOF FRENZY)** 선택 → "확인되지 않은 앱" 경고 → 고급 → 이동 → 허용
4. **Exchange authorization code for tokens** → `Refresh token` 복사 (채팅·파일에 붙이지 말 것)
5. https://github.com/ckqudrnjs-beep/affiliate-pipeline/settings/secrets/actions → New repository secret → 이름 `WEBNOVEL_YT_REFRESH_TOKEN`, 값 = 4번 토큰
6. 같은 화면 Variables 탭 → `WEBNOVEL_YT_ENABLED` = `true`
7. 확인: https://github.com/ckqudrnjs-beep/affiliate-pipeline/actions/workflows/webnovel.yml → Run workflow → 요약에 "웹소설 … 1화 업로드 (비공개…)" 링크가 나오면 성공.
- 재생목록: 스튜디오에서 '나를 죽인 남편이 회귀했다' 재생목록을 만들고 ID(PL…)를 알려 주면 config 에 넣는다.

## 5. 다음 작업
- 시즌 2 대본 자동 쓰기·판정기(Claude API, 주 1회 7화 묶음, 상한 따로) — 시즌 1 이 끝나기 전 PR.
- novel-studio 플러그인(BK 11/21 설치)으로 시즌 설계·훅·연속성 점검.
