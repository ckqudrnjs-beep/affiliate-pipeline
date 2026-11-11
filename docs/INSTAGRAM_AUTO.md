# 인스타 하루 1개 자동 게시 (INSTAGRAM_AUTO.md)

> 최종 갱신: 2026-11-11 · **현재: API 게시 안 함.** BK가 수동으로 올리고, "이제 뭐 해야 되지?"라고 물으면 Claude가 그날 글(이미지+캡션)을 준다. 워크플로 매일 실행은 끔(수동 실행만). 아래는 나중에 다시 켤 때를 위한 기록.

## 무엇이 올라가나
- **매일 12:00 KST 1개.** 주로 **릴스**(1080×1920 슬라이드 영상, 15~30초), 주 1~2회 **카드뉴스**(1080×1350 사진 여러 장).
- **생활 팁만.** 판매·특가·제휴 문구, 링크, 상품 소개는 넣지 않는다 (2026-11-08 스레드 "금지된 커머스 활동" 제한 이후 규칙).
  코드(`check_post`)가 금지 단어(특가·할인·구매·제휴·광고·쿠팡·알리·링크·프로필 등)와 주소를 찾으면 게시하지 않는다.
- 유튜브 쇼츠(상품·가격·[광고] 표기)는 재사용하지 않는다. 같은 메타 계열에서 판매성 게시물로 다시 제한될 위험 때문.
- 해시태그 3~5개, 글마다 다르게. 행동 유도는 저장·공유만.

## 구조 (비용 0원)
| 단계 | 하는 것 |
|---|---|
| 글 | `data/instagram/posts/NNN-slug.json` 파일 이름 순서대로. 다 쓰면 `config/tips.csv` 팁으로 자동 대체 |
| 렌더링 | GitHub Actions에서 Pillow + ffmpeg (나눔 폰트, 무음 AAC) |
| 공개 주소 | 그날 미디어만 `static/ig/<slug>/` 커밋 → Cloudflare Pages가 `don3chon.com/ig/<slug>/` 에 공개 → 게시 후 삭제 |
| 게시 | Instagram Graph API(공식, 무료): 릴스 `media_type=REELS`, 카드뉴스 `CAROUSEL` → `media_publish` |
| 기록 | `data/instagram/published.json` (하루 1개 상한, 같은 글 반복 금지) |

워크플로: `.github/workflows/instagram.yml` · 코드: `src/pipeline/instagram.py` · 토큰 갱신: `refresh-tokens.yml`(2주마다).

글 JSON 형식:
```json
{"type": "reel 또는 carousel", "hook": "첫 화면 큰 글씨", "sub": "부제",
 "slides": [{"title": "항목", "body": "설명"}], "outro": "마지막 화면",
 "caption": "캡션 본문", "hashtags": ["#태그1", "#태그2", "#태그3"]}
```
- slides 2~8개, 수치는 계산 조건과 함께 ("kWh당 200원 가정"). 써 보지 않은 걸 써 본 척하지 않는다.
- 2026-11-10 기준 14개(2주치) 준비. 글이 줄면 Claude가 2주치씩 채운다.

## BK님이 할 일 (처음 한 번)
1. 인스타 앱 → 설정 → **계정 유형 및 도구 → 프로페셔널 계정으로 전환**(크리에이터 또는 비즈니스, 무료). 이미 했으면 건너뜀.
2. [META_SETUP.md](META_SETUP.md) 1단계(Meta 앱)·인스타 토큰 단계대로 토큰 발급. 권한은 `instagram_basic`, `instagram_content_publish` 만.
3. GitHub 저장소 → Settings → Secrets and variables → Actions → **New repository secret**
   이름 `IG_ACCESS_TOKEN`, 값 = 토큰. (이미 있으면 건너뜀. 채팅에 붙여넣지 않기)
4. Actions → **instagram** → Run workflow 로 첫 게시 확인. 로그 끝에 `게시 완료 https://www.instagram.com/...` 가 나오면 끝.
- 토큰이 없으면 게시하지 않고 미리보기만 만든다 (Actions 실행 화면 아래 `instagram-preview` 파일).
- 멈추고 싶으면 Variables에 `INSTAGRAM_ENABLED` = `false`.
- 스레드 공유: API 게시물은 인스타 앱의 "Threads에도 공유"가 적용되지 않을 수 있다 (*확인 필요*). 스레드는 손으로 올리는 생활 팁 채널로 유지.

## 참고 (공식 문서)
- [Instagram 콘텐츠 게시](https://developers.facebook.com/docs/instagram-platform/content-publishing) — 24시간 100개 한도, 사진은 JPEG만, 릴스 `video_url`·`cover_url`
- [IG User Media 참조](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media)
- [Cloudflare Pages: 커밋 메시지 `[skip ci]` 로 빌드 건너뛰기](https://developers.cloudflare.com/pages/configuration/git-integration/#skipping-a-build-via-a-commit-message)
