# 동전이네 세계관 바이블 (요약본, toon_lab 프롬프트용)

원본: Claude Doc "동전이네 세계관 바이블" (2026-11-19 BK). 원본이 바뀌면 이 파일도 같이 고친다.

## 세계관
서울 변두리 오래된 아파트 1203호, 돈 줍는 삼촌네 집에서는 새는 돈이 금화가 되어 날아간다. 그걸 볼 수 있는 건 시바견 동전이뿐이다.
- 금화: 돈 새는 구멍(보온 켜 둔 밥솥, 열린 창문 등)에서 반짝이는 금화가 튀어나와 창밖으로 날아간다. 숫자를 말 대신 그림으로 보여 주는 장치.
- 되찾기: 동전이가 구멍을 막으면 금화가 돌아와 저금통 꿀꿀이 배 속으로 '짤랑'. 매 편 마지막은 이 장면.
- 사람들은 못 본다: 삼촌·조카에게는 금화가 안 보인다. 동전이가 짖고 끌고 가야 알아챈다. 개그는 여기서 나온다.
- 재미 먼저, 정보는 곁들이기: 한 편에 숫자는 한 번만, 반전 장면(3번 클립 끝)에 자막으로. 숫자는 사이트 데이터만.

## 새는 돈 모양·이야기 틀 돌려 쓰기 (BK 2026-11-20)
"동전이 새어 나가는 모션이 고정이면 지겹다" → 금화가 창밖으로 날아가는 건 여러 모양 중 하나. 한 편에 모양 하나 + 이야기 틀 하나, **최근 3편과 같은 모양·틀 금지**. 목록은 `config/toon_motifs.json`.
- 모양 10가지: 창밖으로 날아감 / 물처럼 새서 웅덩이 / 지폐 나비 떼 / 꿀꿀이가 풍선처럼 쪼그라듦 / 금화 눈사람 녹음 / 금화 팝콘 / 끝없는 영수증 / 금화 개미 행렬 / 금화 비눗방울 / 금화 도미노
- 이야기 틀 6가지: 사건→추격→해결 / 대결(두 방법 겨루기) / 시간 점프(1년 뒤→되감기) / 동전이가 범인 / 꿈 / 역전(조카가 "강아지가 뭘 알아" 무시 → 동전이가 판을 뒤집음, 11/20)
- 마지막에 꿀꿀이가 기뻐하는 건 유지하되, 모양에 맞게 바꾼다(웅덩이가 거꾸로 꿀꿀이에게 흘러감, 나비가 꿀꿀이 등에 앉음 등).

## 캐릭터와 고정 문장 (프롬프트에 그대로)
- 동전이(주인공, 말 없음, 표정·귀·꼬리로만, 참견·실수 많음): `@동전이, a small round two-year-old Shiba Inu puppy with orange and cream fur, big shiny black eyes, curled tail, red collar with a small plain gold coin pendant`
- 삼촌 만화판(반말 "조카야~", 계산 빠르고 반응 과장, 숫자 한 마디 해결사): `a cheerful Korean man in his fifties in the same cartoon style, green cap with a small plain gold coin badge, thick eyebrows, mustache, rosy nose, khaki fishing vest`
- 조카(착각 담당 "삼촌, 이거 전기 거의 안 먹지?", 돈 새는 구멍을 만드는 사람): `a Korean man in his twenties in the same cartoon style, yellow hoodie, round glasses, holding a smartphone`
- 꿀꿀이(끝 장면 점수판): `a pink pig piggy bank with no text`
- 금화: `shiny plain gold coins with no markings`

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
기본 순서: 넓게(장소) → 가까이(반응) → 고정(개그) → 눈높이(해결). 주인공은 화면 가운데 아래, 위 1/4은 자막 자리로 비움.

## 귀여움 규칙 (매 편 표정 2개 + 개그 1개)
- 표정: 귀 쫑긋(발견), 눈 동그래+입 벌림(충격), 고개 갸웃(의아), 볼 빵빵(분함), 눈 감고 미소(만족), 축 처진 눈(절망)
- 동작 개그: 점프했다 방석에 철퍼덕, 미끄러지며 미끄럼, 꼬리 프로펠러, 이불 속에서 고개만 쏙, 금화 물고 자랑, 앞발로 스위치 끄기
- 몸은 화면의 1/3 정도. 따뜻한 빛(밤은 노란 스탠드, 낮은 창가 햇살), 차갑고 푸른 화면은 피함.

## 한 편 구조 (클립 4개, 22~30초, 각 8초 클립)
1. 사건(0~6초): 돈 새는 구멍에서 금화가 튀어나온다. 첫 1초에 움직임.
2. 발견(6~13초): 동전이가 금화를 보고 놀란다. 조카는 모른 채 착각하는 대사 한 줄(자막).
3. 개그 + 숫자(13~20초): 잡으려다 실패. 끝나면 숫자 상자 한 번.
4. 해결(20~30초): 동전이가 구멍을 막고 금화가 꿀꿀이에게. 삼촌 한 마디 팁.
끝에 공통 엔딩(구독 좋아요) 클립이 자동으로 붙는다. 소리·자막은 편집에서 얹는다(목소리 없음).

## 프롬프트 조립 (영어)
형식(Cartoon.) → 캐릭터 고정 문장 → 동작 하나 → 장소 고정 문장 → 빛 → 구도 하나 → 공통 끝말:
`Vertical 9:16, 8 seconds, one continuous shot, same cute 3D cartoon look, no text, no numbers, no logos. Keep the top quarter of the frame empty.`

## 금지
영상 안 글자·숫자·간판·로고·화면, 실존 인물·연예인 닮은 얼굴, 아이, 한 클립에 동작 여러 개, 특정 브랜드 제품 모양. 상품·구매·할인·제휴 링크 없음.

## 실사판 특별편 (주 1회, 주말 공개 편)
- 실사 삼촌과 실제 시바 같은 동전이가 같은 이야기를 한다. 한 편 안에서 만화·실사를 섞지 않는다. 유튜브 '변경·합성 콘텐츠' 표시 필수.
- 삼촌 실사판 고정 문장: `@삼촌, a fictional Korean man in his fifties, green cap, mustache, khaki fishing vest, warm smile, photorealistic`
- 동전이 실사판: `@동전이, a real small two-year-old Shiba Inu puppy with orange and cream fur, red collar with a small plain gold coin pendant, photorealistic`
- 프롬프트는 `Cartoon.` 대신 `Photorealistic.` 로 시작, 끝말의 `same cute 3D cartoon look` 대신 `same photorealistic look`. 삼촌은 가상 인물, 실존 인물·연예인 닮은 얼굴 금지, 얼굴은 너무 가깝게 잡지 않는다.
