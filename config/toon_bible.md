# 동전이네 세계관 바이블 (요약본, toon_lab 프롬프트용)

원본: Claude Doc "동전이네 세계관 바이블" (2026-11-19 BK). 원본이 바뀌면 이 파일도 같이 고친다.

## 세계관 (2026-11-20 밤 BK 바뀜)
서울 변두리 오래된 아파트 1203호, 돈 줍는 삼촌네 집. 이 집의 겨울을 제일 먼저, 제일 자세히 겪는 건 시바견 동전이다.
- BK 11/20: "동전 날아가는 것·돈이 샌다 표현은 하지 말고 돈돈돈 강조할 필요 없어", "뻔한 기획 구성은 빼야". → **금화·저금통·'새는 돈' 그림과 말은 쓰지 않는다.**
- (BK 11/28 바뀜) 자막은 처음부터 끝까지 이 편 제목 질문의 정보(상황 → 이유 → 정답 → 할 일). 동전이가 겪는 상황(처음 보는 물건, 추위, 소리, 조카와의 신경전)은 그 정보를 몸으로 보여 주는 장면이다. 동전이 귀여움·감정만 말하는 자막 금지. (11/20 "살림 팁은 마지막 컷 한 줄로만"은 폐기)
- 편마다 결 하나: 뻔하지 않은 것 / 인사이트 / 여운 / 한없이 즐거운 것. 그리고 매 편 중독성(반복 개그·다시 보게 되는 마지막 컷·끝-처음 루프·귀에 남는 소리).
- 자막은 짧은 입말 한 문장('~요'). 말장난·느낌표 남발 금지. 숫자는 정답 컷에서 사이트 근거로 한 번.

## 소동 모양·이야기 틀 돌려 쓰기 (BK 2026-11-20)
"매번 같은 모션이면 지겹다" → 한 편에 소동 모양 하나 + 이야기 틀 하나, **최근 3편과 같은 모양·틀 금지**. 목록은 `config/toon_motifs.json`.
- 소동 모양: 담요 김밥 / 허공 씹기 / 빙글빙글 어질 / 깜짝 숨기 / 빨래 더미 다이빙 / 방석 탑 와르르 / 지도 덮어쓰기 / 큰 재채기 / 우다다 / 창가 바라보기
- 이야기 틀: 동전이의 하루 / 대결 / 처음 겪는 일 / 동전이가 범인 / 조용한 편(여운) / 역전(조카 무시 → 동전이가 뒤집음)

## 캐릭터와 고정 문장 (프롬프트에 그대로)
- 동전이(주인공, 말 없음, 표정·귀·꼬리로만, 참견·실수 많음): `@동전이, a small round two-year-old Shiba Inu puppy with orange and cream fur, big shiny black eyes, curled tail, red collar with a small plain gold coin pendant`
- 삼촌 만화판(반말 "조카야~", 계산 빠르고 반응 과장, 숫자 한 마디 해결사): `a cheerful Korean man in his fifties in the same cartoon style, green cap with a small plain gold coin badge, thick eyebrows, mustache, rosy nose, khaki fishing vest`
- 조카(착각 담당 "삼촌, 이거 전기 거의 안 먹지?", 돈 새는 구멍을 만드는 사람): `a Korean man in his twenties in the same cartoon style, yellow hoodie, round glasses, holding a smartphone`

## 장소 7곳 (고정 문장)
- 거실(난방·전기·가습기·TV): `a cozy Korean apartment living room with a warm yellow vinyl ondol floor, a low wooden table, a grey sofa and a balcony window`
- 부엌(밥솥·장보기·냉장고·가스레인지): `a small Korean apartment kitchen with white cabinets, a gas stove, a white rice cooker and a tall fridge`
- 베란다(빨래·건조기·김장·결로): `a Korean apartment veranda with a drying rack, a washing machine and frosted windows`
- 현관(외출 모드·택배·배달): `a narrow Korean apartment entryway with a shoe step, a shoe cabinet and a steel front door`
- 동네 시장(배추·무·제철 시세): `a Korean traditional market alley in winter with vegetable stalls and red plastic baskets, no signs`
- 아파트 단지 길(한파·출퇴근·눈): `a snowy Korean apartment complex walkway with bare trees and parked cars, no signs`
- 주유소(기름값): `a gas station forecourt seen from low angle, pump displays out of frame, no signs`

## 구도 메뉴 (한 편 4클립은 서로 다른 구도, 카메라 움직임은 클립당 하나)
동전이 눈높이 `camera at puppy eye level close to the floor` / 올려다보기 `low angle looking up` / 내려다보기 `top-down overhead shot` / 넓은 설정샷 `wide shot showing the whole room` / 얼굴 클로즈업 `close-up on the puppy's face` / 앞발 클로즈업 `extreme close-up of the paw` / 어깨 너머 `over-the-shoulder shot from behind the puppy` / 창밖에서 안으로 `shot from outside the window looking in` / 천천히 다가가기 `slow push-in` / 옆으로 따라가기 `side tracking shot following the puppy` / 고정 카메라(개그는 고정이 제일 웃김) `fixed camera` / 유리 너머 `view from inside the fridge as the door opens`
기본 순서: 넓게(장소) → 가까이(반응) → 고정(개그) → 눈높이(해결). 주인공은 화면 가운데 아래, 위 1/3은 제목 띠·자막 자리로 비움(11/22 홈 피드 잘림 대응).

## 귀여움 규칙 (매 편 표정 2개 + 개그 1개)
- 표정: 귀 쫑긋(발견), 눈 동그래+입 벌림(충격), 고개 갸웃(의아), 볼 빵빵(분함), 눈 감고 미소(만족), 축 처진 눈(절망)
- 동작 개그: 점프했다 방석에 철퍼덕, 미끄러지며 미끄럼, 꼬리 프로펠러, 이불 속에서 고개만 쏙, 장난감 물고 자랑, 앞발로 스위치 끄기
- 몸은 화면의 1/3 정도. 따뜻한 빛(밤은 노란 스탠드, 낮은 창가 햇살), 차갑고 푸른 화면은 피함.

## 한 편 구조 (클립 4개, 22~30초, 각 8초 클립)
1. 첫 장면(0~6초): 동전이가 나오는 상황. **첫 프레임부터 동전이가 화면 가운데에 크게, 이미 움직이는 중**(BK 11/24 — 빈 방·문·풍경 설정 컷, 천천히 다가가는 카메라, 페이드 인 금지). 결과를 먼저 보여 줘도 된다.
2. 전개(6~13초): 동전이의 반응·표정. 조카가 상황을 만들거나 착각한다.
3. 소동(13~20초): 소동 모양 하나(실패·개그 또는 조용한 장면).
4. 마무리(20~30초): 작은 반전이나 여운 한 장면 + 살림 팁 한 줄. **끝 1~2초는 첫 장면과 같은 자리·자세로 돌아와 다시 재생될 때 이어 보이게(루프, BK 11/24 필수).**
끝에 공통 엔딩(동전이 삐죽 + 구독 좋아요)이 자동으로 붙는다. 소리·자막은 편집에서 얹는다(목소리 없음).

## 프롬프트 조립 (영어)
형식(Cartoon.) → 캐릭터 고정 문장 → 동작 하나 → 장소 고정 문장 → 빛 → 구도 하나 → 공통 끝말:
`The puppy always has exactly four legs and never grows extra paws. Furniture, appliances, seats, doors and walls stay fixed in place unless the action says otherwise. Everything is real-world size, the puppy small next to it. Vertical 9:16, 8 seconds, one continuous shot, same cute 3D cartoon look, no text, no numbers, no logos. Keep the top third of the frame empty.`
(BK 11/21 검수: 시트가 뒤로 빠짐·앞발 4개·차가 너무 작음 → 위 세 문장을 끝말 앞에 늘 넣는다.)

## 금지
영상 안 글자·숫자·간판·로고·화면, 실존 인물·연예인 닮은 얼굴, 아이, 한 클립에 동작 여러 개, 특정 브랜드 제품 모양. 동전이가 앞발로 물건을 잡기·펼치기·누르기(코·입·몸으로만), 움직이면 안 되는 가구·좌석이 움직일 여지가 있는 동작(그 물건은 'fixed in place'로 못 박기), 차·가구를 작게 그리기(실제 크기, 강아지가 작게) (BK 11/21). 상품·구매·할인·제휴 링크 없음.

## 실사판 특별편 (주 1회, 주말 공개 편)
- 실사 삼촌과 실제 시바 같은 동전이가 같은 이야기를 한다. 한 편 안에서 만화·실사를 섞지 않는다. 유튜브 '변경·합성 콘텐츠' 표시 필수.
- 삼촌 실사판 고정 문장: `@삼촌, a fictional Korean man in his fifties, green cap, mustache, khaki fishing vest, warm smile, photorealistic`
- 동전이 실사판: `@동전이, a real small two-year-old Shiba Inu puppy with orange and cream fur, red collar with a small plain gold coin pendant, photorealistic`
- 프롬프트는 `Cartoon.` 대신 `Photorealistic.` 로 시작, 끝말의 `same cute 3D cartoon look` 대신 `same photorealistic look`. 삼촌은 가상 인물, 실존 인물·연예인 닮은 얼굴 금지, 얼굴은 너무 가깝게 잡지 않는다.
