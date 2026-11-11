# 새 기획 영상 대본 규칙 (EPISODES.md)

2026-11-11 BK 확정. 쇼츠 매일(요일별 형식, 월·목·토 = 삼촌 vs 조카 만화 상황극) + 롱폼 주 2개(수·토). 계획은 plan/YOUTUBE_PLAN.md 맨 위.
Claude 예약 작업이 이 문서를 보고 `data/episodes/<날짜>-<형식>.json` 대본을 쓰면, `episodes` 워크플로가 무료로 영상을 만든다
(7번 목소리 + 사진·카드 + 재사용 삼촌 표정 영상). 쇼츠는 바로 업로드 대기, 롱폼은 미리보기 PR → BK 병합.

## 1. 순서 (예약 작업)
1. `PYTHONPATH=src python -m pipeline.episodes next` (롱폼은 `next-long`) → 날짜·형식·규칙·쓸 파일 이름·상품 목록·삼촌 영상 이름이 나온다.
2. 그 파일이 이미 있으면 끝.
3. 형식 규칙과 아래 공통 규칙대로 JSON 작성. 상품 편이면 `data/products/<slug>.json` 의 note·check·aliPrice 를 읽고 그 안의 사실만 쓴다.
4. `python -m pipeline.episodes check <파일>` → `[]` 이 나올 때까지 고친다.
5. 그 파일 하나만 main 에 올린다 (커밋 메시지 "대본 <파일 이름>").

## 2. 대본 형식
```json
{
 "date": "2026-11-16", "kind": "short" 또는 "long", "format": "skit-quiz", "format_name": "삼촌 vs 조카 얼마게?",
 "series_no": 3,                       // 돈 새는 구멍·1년 뒤 통장처럼 번호 시리즈일 때만
 "slug": "ep-2026-11-16-quiz",
 "title": "[광고] ... (상품이 나오면 [광고]로 시작, 없으면 [광고] 없이)",
 "description": "설명란 1~3줄: 무엇을 어떤 가정으로 계산했는지",
 "product": "usb-heated-lap-blanket", // 상품 없는 편은 빼기
 "products": ["smart-plug-power-meter"], // 롱폼에서 더 소개할 상품(링크만, 최대 2개)
 "scenes": [ ... ]
}
```
장면 종류 (`say` = 7번 목소리 내레이션, 쇼츠는 장면당 42자 이하):
| type | 필드 | 화면 |
|---|---|---|
| hook | text, say | 첫 장면. 큰 질문 자막 (상품 편은 흐린 상품 사진 배경) |
| photo | photo(파일 이름 "03.jpg" 또는 순번 2), cap, say | 상품 사진 + 노란 자막 |
| calc | title, value, sub, say | 계산 카드 (큰 숫자) |
| versus | a{label,value}, b{label,value}, hide(true면 값 "?"), say | A vs B |
| countdown | text, say("") | 3·2·1 고민 시간 |
| ox | claim, answer("O"/"X"), say | O/X 공개 |
| counter | label, to(숫자), unit, sub, say | 숫자가 0에서 올라감 |
| list | title, items[2~4], say | 항목이 하나씩 |
| bars | title, items[{label,value,text?}], say | 막대그래프 (롱폼 비교) |
| chapter | no, text, say | 롱폼 챕터 제목 (설명란 목차가 자동으로 생김) |
| uncle | clip (config/heygen/clips.json 이름) | 삼촌 표정 영상(대사 고정) |
| skit | lines[2~8] {who u/n, u 포즈, n 포즈, cap[1~2줄], say, big?, sub?, sfx? buzz/ding, prop? product/heater}, photo? | 삼촌 vs 조카 만화 상황극 (쇼츠 전용). 삼촌 7번 목소리, 조카 F2 |
| end | say, text(상품 없는 편) | 상품 편: 상품·가격·don3chon.com / 없는 편: 사이트 안내 |

삼촌 영상 대사(고정): intro-excited "조카야, 삼촌이 오늘 하나 건졌다!", intro-curious "조카야, 이거 한번 볼래?",
react-surprised "어? 이게 이 가격이라고?", react-laugh "허허, 이거 물건이네.", react-think "흠, 근데 이건 꼭 확인해.",
react-nod "그치, 이거면 충분해.", outro-1/outro-2 (광고 링크·수수료 고지 + don3chon.com). 대사가 앞뒤 맥락에 맞을 때만 넣는다.

만화 상황극(skit): 포즈 삼촌 talk/wow/point, 조카 talk/shock/cold(덜덜)/happy. big = 노란 반전 숫자(띵 소리), sfx buzz = 오답.
공식: 숫자 질문(cap 에 숫자) → 조카 오답 → buzz + big + sub(가정) → 조카 걱정 → 삼촌 해결(prop product) → 펀치라인. 예: data/episodes/2026-11-16-skit-quiz.json

## 3. 공통 규칙
- 첫 장면은 hook 또는 skit (인사·로고로 시작 금지). 쇼츠 15~30초(장면 6~10개), 2~3초마다 화면이 바뀌게.
- 계산은 보수적으로, 가정은 sub 에 적는다 (전기요금 kWh당 200원 단순, 누진제 제외 등).
- 판매자 표기·상품 note 에 있는 사실만. 써 봤다는 말·효능·"무조건/100%/최고" 금지.
- 상품 편: 제목 [광고] + 마지막 end. 같은 상품은 2주 안에 다시 쓰지 않는다 (`recent_products`).
- 삼촌 영상은 쇼츠 1편에 0~2개, 같은 삼촌 영상을 이틀 연속 쓰지 않는다. 화·금은 보통 넣지 않는다.
- 제목 패턴을 매번 바꾼다 (질문형·숫자형·반전형). 낚시 금지, 내용과 일치.
- 롱폼: 장면 25~60개, chapter 5~8개, 내레이션 1,400자 이상(목표 4~8분). 상품 링크는 설명란(사이트 상품 페이지).
- 롱폼 수요일 편 상품은 같은 주 수요일 쇼츠(롱폼 예고)와 같은 주제로.

## 4. 업로드
- 쇼츠 19:00, 롱폼 20:00 KST (대본 날짜). youtube 워크플로가 이틀 전부터 올린다.
- 상품 편은 비공개로 올라가고, 유료 프로모션을 자동으로 켤 수 없어 BK가 Studio에서 체크 후 공개 (BK 규칙).
- 상품 없는 편은 유료 프로모션과 무관해 바로 예약 공개.
- 삼촌 영상이 들어가면 "변경되거나 합성된 콘텐츠" + 화면 "AI로 만든 가상 인물" + 설명란 AI 문구 자동.
