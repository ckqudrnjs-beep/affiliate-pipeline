# 상품 사용 장면 영상 자동 생성 (BK 노트북)

사이트 상품(data/products)마다 10초 이하 "사용 장면" 영상을 만든다. 모델은 Wan 2.2 TI2V-5B (Apache 2.0, 상업 이용 가능), ComfyUI Desktop 로컬 API로 돌린다.

## 처음 한 번
1. ComfyUI Desktop에서 Wan 2.2 5B 이미지→비디오 템플릿을 열고 **워크플로 → 내보내기 (API)** 로 `tools/video/wan22_api.json` 에 저장.
2. ffmpeg 설치: `winget install Gyan.FFmpeg`
3. 실행은 ComfyUI Desktop 의 파이썬(`Documents\ComfyUI\.venv\Scripts\python.exe`, Pillow 포함) 또는 시스템 파이썬.

## 매번
```
python tools/video/video_batch.py generate      # 전 상품 후보 생성 (밤에 켜 두기, 상품당 30~60분)
python tools/video/video_batch.py review        # 브라우저에서 상품마다 A·B 하나씩 고르기
python tools/video/video_batch.py finish        # 10초·3MB 이하 마감 → static/video/<slug>.mp4 + videoUrl, 쇼츠용은 video_work/shorts/
```
- 이미 만든 후보는 다시 만들지 않는다. 상품 하나만: `generate baseus-led-desk-lamp`
- 후보 수: 환경변수 `VIDEO_TAKES` (기본 2), ComfyUI 주소: `COMFY_URL` (기본 http://127.0.0.1:8000)
- 새 상품은 `prompts.json` 에 동작 2개(A·B)를 넣어야 생성된다. **상품 설명에 있는 기능만** 쓴다.

## 지킬 것
- 사진과 모양·색·기능이 다르거나 손이 이상한 후보는 고르지 않는다 (과장·오인 금지).
- 영상에는 "AI로 만든 사용 예시 장면"과 "광고 · 알리익스프레스 제휴 링크"가 자동으로 들어간다.
- 유튜브 업로드 시 "변경되거나 합성된 콘텐츠" + "유료 프로모션 포함" 체크, 설명란 첫 줄 대가성 문구.

## 편집 방식 (2026-11-09, 권장): 판매자 사진으로 10초 편집
AI 영상 생성은 해상도·글자 깨짐·없는 버튼 생성 문제로 보류. 대신
1. GitHub Actions `gallery` 워크플로(손으로 실행)가 알리 공식 제휴 API(productdetail.get)로 상품 사진을 `video_assets/<slug>/`에 받는다. 상품 페이지 크롤링·다운로드는 약관 위반이라 하지 않는다.
2. `tools/video/stories/<slug>.json`에 장면(불 켜짐 reveal, 확대 push, 좌우 비교 wipe, 끝 화면 end)과 자막을 적는다. 자막은 상품명·판매자 표기에 있는 기능만, 건강 효능 표현 금지.
3. `python tools/video/compose.py <slug>` → `video_work/compose/<slug>_site.mp4`(960×720), `_shorts.mp4`(1080×1920). 클라우드에서도 30초 안에 만들어진다.
- 사진 속 판매자 영어 글자는 `fills`로 주변 벽 색을 이어 칠해 지운다. 상품이 있는 영역은 절대 칠하지 않는다.

## 스튜디오 구도 (2026-11-09, BK 요청)
상품만 오려 밝은 회색 배경에 세우고(바닥 반사·그림자), 불 켜짐 효과와 판매자 사진의 확대 원(힌지·받침 등)을 얹는다.
1. `python tools/video/cutout.py <slug> <사진> --keep x,y [--erase 상자]` → `video_assets/<slug>/cutout.png`
2. 스토리 JSON에 `"type": "studio"` 장면 (`cutout`, `light`(빛 나오는 선, cutout 좌표), `on_at`, `details`, `captions`), 형식별 위치는 `"site": {...}`로 덮어쓴다. 마지막 `end` 장면에 `cutout`을 주면 밝은 엔딩.
3. 램프는 로고가 막대를 가려서 막대를 이어 그린 cutout.png를 커밋해 두었다.
