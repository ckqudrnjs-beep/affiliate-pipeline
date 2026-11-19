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
