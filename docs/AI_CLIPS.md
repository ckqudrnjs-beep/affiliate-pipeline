# AI 클립 (BK 손수 제작) — 2026-11-19

BK 가 이미 구독 중인 **제미나이 Pro(Flow·Veo)**, **ChatGPT Plus(Sora)** 크레딧으로 주 1회 10분 정도 짧은 영상을 만들면,
삼촌 쇼츠(실사 배경 요일: 월·화·토)가 스톡 영상과 돌려 가며 다시 쓴다. 비용 0원.

## 지키는 것
- **자동화 안 함**: 웹 화면을 봇으로 조작하지 않고(약관 위반), 유료 Veo API 도 안 쓴다. BK 가 직접 만든 파일만.
- 영상 속 **글자·자막·로고·상표·실존 인물 얼굴 없음** (손·뒷모습·흐린 배경은 괜찮음). 글자·숫자는 우리가 위에 얹는다.
- 9:16 세로, 6~8초, 소리는 버린다(우리 음성·효과음을 씀). 구석 워터마크는 그대로 둬도 된다.
- **실사처럼 보이는 영상**(사람 손·실제 부엌처럼 보임)은 `--realistic` → 그 편은 유튜브 '변경·합성 콘텐츠' 표시(containsSyntheticMedia)가 자동으로 켜지고 설명란에 AI 생성 문구가 붙는다. 만화풍 동전이는 realistic 아님.
- 숫자·사실은 여전히 사이트 데이터만. 클립은 그림일 뿐.

## 흐름
1. BK: 아래 목록 프롬프트를 Flow(또는 제미나이 앱 '동영상', Sora)에 붙여 넣고 마음에 드는 것만 내려받는다.
2. BK: 파일 이름을 목록의 이름(예 `dongjeon-01.mp4`)으로 바꿔 **이 프로젝트 채팅(쇼츠 실사 스레드)에 첨부**한다.
   (구글 드라이브는 이 작업 환경에서 큰 영상 파일을 내려받을 수 없어 채팅 첨부로 받는다.)
3. Claude: 프레임을 눈으로 확인(글자·얼굴·어색함) → `python tools/ai_clip_add.py <파일> <장면> --tool Veo [--realistic]`
   → `media/ai_clips/<장면>-NN.mp4`(1080x1920, 8초 이하, 소리 없음) + `config/ai_clips.json` 등록 → PR, BK 확인 후 병합.
4. 대본(07:40)은 info 의 `ai_scenes` 에 있는 장면을 첫 줄 clip 으로 먼저 쓴다. 렌더는 장면 이름이 같으면 AI 클립 → 없으면 스톡.
   같은 클립은 7일 안에 다시 안 쓰고, 오래 안 쓴 것부터 돌린다. `ai_only` 장면(dongjeon, kimjang)은 AI 클립이 있을 때만 쓸 수 있다.

## AI 영상 제작 지침 (2026-11-19 BK "숫자·글자가 깨지고 부자연스러운 것 → 정확하게 묘사")

AI 영상(Veo·Sora)은 글자·숫자·손가락·얼굴·물체 개수에서 자주 망가진다. 그래서 **영상은 '그림'만, 글자·숫자는 우리가 편집에서 얹는다.**

### 1. 영상 안에 넣지 않는 것 (깨지거나 정책 위험)
- **글자·숫자·간판·가격표·라벨·화면(디스플레이)·지폐·영수증·고지서·달력·시계 숫자** → 반드시 깨진다. 숫자는 우리 자막(big·sub)으로만.
  - 꼭 필요한 물건(보일러 조절기, 고지서)은 "화면이 꺼진", "뒷면만 보이는", "흐릿하게 멀리" 로 묘사하거나 아예 빼기.
- **상표·로고·실제 제품 모양**(특정 브랜드 밥솥 등) → "로고 없는 흰색 밥솥" 처럼 일반 물건으로.
- **또렷한 사람 얼굴, 실존 인물, 아이** → 손·뒷모습·발·실루엣·멀리서 흐릿하게만.
- **동전이 외 동물·캐릭터 새로 만들기** → 동전이는 항상 Flow 캐릭터 '@동전이' 로 (생김새 유지).

### 2. 부자연스러움 줄이기
- **한 장면 = 한 동작.** 8초 안에 "들어와서 앉고 먹고 웃기" 처럼 여러 동작을 넣으면 몸이 녹거나 튄다. 동작 하나 + 작은 움직임(김, 눈, 꼬리, 커튼).
- **손:** 손이 나오면 "장갑 낀 두 손", "손등만" 처럼 단순하게. 손가락 개수·물건 쥐기가 정교하면 망가진다.
- **물체 개수는 적게:** "배추 세 포기" 보다 "배추 더미". 셀 수 있는 개수를 말하면 틀리게 나온다.
- **카메라는 하나만:** 고정 / 천천히 다가가기 / 천천히 옆으로 중 하나. 돌기·빠른 이동·줌 섞기 금지.
- **물리 현상은 약하게:** 김·눈·물은 "살짝", "천천히". 세게 쓰면 연기·폭설처럼 과해진다(11/19 온돌 편 김이 연기처럼 진했음).
- **실내·실외 섞지 않기:** "창밖에 눈" 이라고 써도 실내에 눈이 날릴 수 있음 → "눈은 창밖에만, 실내는 따뜻하고 눈 없음" 처럼 못 박기(11/19 동전이 담요 편).
- **한국 느낌:** "한국 아파트 거실, 노란 장판, 낮은 상, 베란다 창" 처럼 구체적 소품으로. "Korean" 한 단어만 쓰면 일본·중국 느낌이 섞인다.
- **세로 화면 구도:** 주인공은 화면 가운데 아래 2/3 쪽, 위 1/4 은 비워 두기(우리 자막 자리), 맨 아래도 출처·캐릭터 자리라 중요한 것 없음.
  - (2026-11-20) 위 1/4 중 맨 위 360px(19%)는 **검은 제목 띠**(흰 줄 + 노란 줄, `tools/toon_assemble.py` spec `band`)가 덮고, 컷 자막은 그 바로 아래로 내려간다. 프롬프트의 'Keep the top quarter of the frame empty' 는 그대로.

### 3. 프롬프트 틀 (이 순서로, 빈칸만 바꿔 쓰기)
```
[도구·형식] Veo 동영상, 세로 9:16, 8초, (실사 | 동전이 그림체 그대로)
[주인공] 무엇이 (예: 빨간 고무장갑 낀 두 손 / @동전이)
[동작 하나] 무엇을 천천히 한다 (예: 절인 배추에 양념을 바른다)
[장소·소품] 어디서, 구체적 소품 2~3개 (예: 한국 가정집 바닥, 큰 스테인리스 대야)
[빛·분위기] (예: 부드러운 오후 자연광, 따뜻한 색)
[카메라] 하나만 (예: 위에서 내려다보는 고정 / 천천히 다가가기)
[구도] 주인공은 화면 가운데 아래쪽, 위쪽은 여백
[금지] 글자·숫자·간판·가격표·로고·화면 표시 없음, 사람 얼굴 또렷하게 안 나옴, 장면 전환 없음
```

### 4. 받은 뒤 Claude 확인 (등록 전)
- 1초마다 프레임 8장을 보고: 글자·숫자·로고, 손·얼굴 변형, 물체가 녹거나 튀는 장면, 실내 눈 같은 모순 → 있으면 등록하지 않고 프롬프트를 고쳐 BK 에게 다시 부탁.
- 실사처럼 보이면 `--realistic`(합성 콘텐츠 표시). 쇼츠 화면에 얹은 미리보기 1장을 만들어 자막과 겹치는지 본다.
- 11/19 첫 5개 결과: 동전이 2개·김장·온돌·시장 모두 글자 없음. 담요 편 실내 눈, 온돌 편 진한 김 → 위 2장 규칙으로 반영.

## 이번 주 촬영 목록 (11/23 주) — 5개, 약 10분

동전이 참고 그림: `/mnt/project-files/shorts-uncle/ai-clips/동전이-참고그림.png`, `동전이-동전.png`
(Flow 에서 '이미지로 영상 만들기'에 이 그림을 넣으면 생김새가 덜 바뀐다.)

| 파일 이름 | 장면 | 쓰임 | realistic |
|---|---|---|---|
| dongjeon-01.mp4 | dongjeon | 오프닝: 동전 물고 튀어 오름 | 아님 |
| dongjeon-02.mp4 | dongjeon | 오프닝: 추워서 담요 속 → 고개 쏙 | 아님 |
| kimjang-01.mp4 | kimjang | 김장 양념 버무리기 | 맞음 |
| warm-blanket-01.mp4 | warm-blanket | 한국 아파트 온돌 바닥 + 이불 | 맞음 |
| cabbage-01.mp4 | cabbage | 겨울 시장 배추 더미 | 맞음 |

공통 끝말(모든 프롬프트 끝에 붙임):
`Vertical 9:16, 8 seconds, no text, no captions, no logos, no human faces.`

1. **dongjeon-01** — `A cute round cartoon Shiba Inu puppy, orange and cream fur, flat 2D-style 3D render with soft outlines, holding a shiny gold coin in its mouth, hops happily toward the camera in a cozy Korean apartment living room with warm evening light, tail wagging, camera slowly pushes in.`
2. **dongjeon-02** — `The same cute round cartoon Shiba Inu puppy curled up under a thick knitted blanket on a warm heated floor in a cozy Korean apartment on a snowy winter night, it pops its head out and blinks at the camera, snow falling outside the window behind, gentle handheld camera.`
3. **kimjang-01** — `Close-up of hands in red rubber gloves rubbing red chili kimchi seasoning between the leaves of salted napa cabbage in a large stainless basin on a Korean home floor, natural daylight, steady overhead shot, realistic.`
4. **warm-blanket-01** — `Bare feet of two people resting under a thick quilt on a warm yellow vinyl ondol floor in a modern Korean apartment, steam rising from a mug of barley tea on a low table, soft morning light, slow dolly shot, realistic.`
5. **cabbage-01** — `Piles of fresh green napa cabbages and white radishes stacked at a Korean traditional market stall in winter, vendors' breath visible in the cold air, people blurred in the background, slow pan from left to right, realistic.`

## 다음 주 후보 (매주 3~5개, 그 주 시기 이슈에 맞춰 Claude 가 갱신)
- 한파: 성에 낀 아파트 창문, 보일러 컨트롤러 버튼 누르는 손가락(글자 없는 화면)
- 연말: 장바구니 든 손, 동전이가 저금통에 동전 넣기
- 설 준비(1월): 전 부치는 프라이팬, 과일 상자
