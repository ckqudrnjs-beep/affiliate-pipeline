# 알리익스프레스 API 키 발급과 등록 (ALI_SETUP.md)

> 최종 갱신: 2026-11-07 · 화면 메뉴 이름은 제3자 안내 기준이라 조금 다를 수 있습니다. 키는 채팅에 붙이지 말고 GitHub Secrets에만 넣으세요.

## 1. 트래킹 ID 확인 (Portals)
1. https://portals.aliexpress.com 로그인
2. 상단 **Tools → Tracking ID** (또는 Account → Tracking ID)
3. 기본 ID가 없으면 하나 만들기 (예: `donsamchon`)

## 2. API 신청 (Portals)
1. **Tools → API** 메뉴에서 **Apply Now**
2. 사용 목적 칸: "자체 사이트·SNS 콘텐츠용 상품 검색과 제휴 링크 생성" 정도로 작성
3. 승인은 보통 몇 분 ~ 1~2 영업일

## 3. 앱 만들기 (Open Platform)
1. https://open.aliexpress.com 에 같은 계정으로 로그인
2. **App Console → App Management → Create App**
3. 앱 종류: **Affiliates API** (없으면 Self-Developer)
4. 만든 앱의 **Manage → Apply Online**으로 제휴 API 권한 신청
5. 승인되면 **App Key**와 **App Secret** 확인 (Secret은 문자/이메일 인증이 필요할 수 있음)

## 4. GitHub Secrets 등록
저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `ALI_APP_KEY` | App Key |
| `ALI_APP_SECRET` | App Secret |
| `ALI_TRACKING_ID` | 1단계 트래킹 ID |

(선택) 같은 화면 **Variables** 탭 → `ALI_KEYWORDS` 에 영어 검색어 (예: `winter heater`). 비우면 전체 인기 상품.

## 5. 확인
- **Actions → daily-drafts → Run workflow** 로 한 번 실행
- `drafts/blog/날짜.md` 에 `program=aliexpress` 블로그 초안이 생기면 성공 (2026-11-08부터 알리 상품은 블로그 초안으로만 만든다)
- 실패하면 Actions 로그의 `알리 API 실패 … code=… msg=…` 줄을 알려주세요 (키 값은 로그에 나오지 않음)

## 6. 자주 나는 오류
- `code=InsufficientPermission msg=App does not have permission to access this api` (2026-11-08 실제 발생): 키·서명은 맞고, 호출한 API에 권한이 없다는 뜻. 인기 상품 API(`hotproduct.query`)는 고급 API라 새 앱엔 권한이 없을 수 있어서, 코드가 자동으로 기본 API(`product.query`)로 다시 조회한다. 기본 API까지 같은 오류면 App Console → Apply process → Process apply 에서 권한 신청 메뉴를 확인한다.
