# 스레드·인스타 자동 발행 연결 가이드 (META_SETUP.md)

> 최종 갱신: 2026-11-07 (인스타 통합 로그인 반영) · 대상: "돈 줍는 삼촌" 스레드·인스타 계정 · 소요 약 30~40분
> 토큰은 **GitHub Secrets에만** 넣습니다. 채팅·파일·메모에 붙여넣지 마세요.
> Meta 화면 메뉴 이름은 자주 바뀝니다. 이름이 조금 달라도 같은 위치를 찾으면 됩니다 (*화면 문구 확인 필요*).

## 전체 그림
```
[main의 drafts/ 초안 (검사 통과)] → publish 워크플로 (하루 4번) → 스레드: 글+링크
                                                              → 인스타: 이미지+캡션 (이미지 있는 초안만)
```
- 공식 API만 씁니다: **Threads API**, **Instagram API (통합 로그인·시스템 사용자 토큰, 또는 기존 앱의 Instagram 로그인)**. 비공식 자동화·매크로는 쓰지 않습니다.
- 앱은 "개발 모드" 그대로 둡니다. 본인 계정을 테스터로 넣으면 **앱 검수(App Review) 없이** 내 계정에 게시할 수 있습니다 (*Meta 정책 확인 필요*).
- `PUBLISH_ENABLED` 변수를 직접 켜기 전까지는 실제로 올리지 않고 "무엇을 올릴지"만 로그에 찍습니다.

---

## 0단계. 준비 (5분)
1. 인스타그램 앱 → 설정 → **계정 유형 및 도구 → 프로페셔널 계정으로 전환** → "크리에이터" 선택 (비즈니스도 가능). 이 방식은 페이스북 페이지 연결이 **필요 없습니다**.
2. 스레드 계정이 같은 인스타 계정으로 만들어져 있는지 확인.
3. [developers.facebook.com](https://developers.facebook.com) 에 페이스북 계정으로 로그인 → 처음이면 개발자 등록(휴대폰 인증).

## 1단계. Meta 앱 만들기 (5분)
1. **내 앱 → 앱 만들기**
2. 앱 이름: `donjupneun-publisher` (아무거나), 연락 이메일 입력.
3. 사용 사례(Use case)에서 **"Threads API 액세스"** 선택 → 만들기.
4. 앱이 생기면 왼쪽 **사용 사례 → 추가**에서 **"Instagram에서 메시지 및 콘텐츠 관리"**(Instagram API)도 추가합니다.
   (메뉴에 둘을 한 앱에 넣는 선택지가 없으면 앱을 2개 만들어도 됩니다.)

## 2단계. 스레드 토큰 (10분)
1. **사용 사례 → Threads API 액세스 → 맞춤 설정 → 권한**에서 `threads_basic`, `threads_content_publish` 추가.
2. **앱 역할 → 역할 → 사람 추가 → Threads 테스터**에 본인 스레드 사용자 이름 입력.
3. 웹에서 threads.net 로그인 → **설정 → 계정 → 웹사이트 권한 → 초대** → 수락.
4. **사용 사례 → Threads API 액세스 → 설정**(또는 "User Token Generator")에서 본인 계정 옆 **토큰 생성** → 로그인·허용.
5. 장기 토큰(60일)으로 바꾸기: 생성 화면에 장기 토큰이 바로 나오면 그것을 씁니다. 단기 토큰만 나오면, 내 PC 브라우저 주소창에 아래를 넣고 열면 나오는 `access_token` 값이 장기 토큰입니다.
   ```
   https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=앱시크릿&access_token=단기토큰
   ```
   앱 시크릿은 **앱 설정 → 기본 설정 → Threads 앱 시크릿**(또는 앱 시크릿)에 있습니다. 끝나면 브라우저 방문 기록에서 이 주소를 지워 두세요.
6. 값을 바로 **GitHub Secret `THREADS_ACCESS_TOKEN`** 에 붙여넣습니다 (아래 4단계).

## 3단계. 인스타 토큰: 통합 로그인 방식 (15분)
> 2026-11 기준 새 앱에는 "Instagram 로그인을 통한 API 설정"이 없고 **"API setup with Unified login"(통합 로그인)** 만 나옵니다. 이 방식은 만료되지 않는 **시스템 사용자 토큰**을 줍니다. 페이스북 페이지는 필요 없고 **비즈니스 포트폴리오**(무료)가 필요합니다. 코드는 두 토큰 종류를 모두 지원합니다.

1. **사용 사례 → Instagram API → 맞춤 설정 → API setup with Unified login** 화면에서 **"+ 비즈니스 포트폴리오"** 를 눌러 포트폴리오를 연결합니다. 없으면 만들기(이름: 돈 줍는 삼촌).
2. [business.facebook.com](https://business.facebook.com) → **설정 → 계정 → Instagram 계정 → 추가** → 돈 줍는 삼촌 인스타로 로그인해 포트폴리오에 넣습니다.
3. 다시 개발자 화면 **"1. 앱 구성" → 새로운 구성 만들기**:
   - 액세스 토큰: **시스템 사용자 액세스 토큰(SUAT)**
   - 비즈니스 자산: 돈 줍는 삼촌 **Instagram 계정** (광고 계정은 선택하지 않음)
   - 권한: **`instagram_basic`, `instagram_content_publish`** 만 체크. `ads_*`, 메시지, 댓글 권한은 필요 없으니 빼세요 (가능하면).
4. **리디렉션 URL은 비워 둡니다.** 다른 사람이 로그인하는 서비스용이라 내 계정에 게시할 때는 쓰지 않습니다. 저장이 안 되면 `https://localhost/` 를 넣으세요.
5. 구성을 만든 뒤 나오는 **토큰 생성** 단계(또는 business.facebook.com **설정 → 사용자 → 시스템 사용자 → 토큰 생성**, 앱 선택 후 위 권한 체크)에서 토큰을 만듭니다. `EAA…`로 시작하는 긴 값입니다.
6. 그 값을 바로 **GitHub Secret `IG_ACCESS_TOKEN`** 에 붙여넣습니다.
7. **인스타 계정 ID** 찾기: business.facebook.com **설정 → 계정 → Instagram 계정 → 돈 줍는 삼촌 선택** → 이름 아래 `ID` 숫자(보통 `1784…`로 시작). 이 값을 **GitHub Variable `IG_USER_ID`** 에 넣습니다. 비밀값이 아니라 Variables 탭입니다.
8. 확인: publish 워크플로를 실행하면 로그에 `instagram: 연결 확인 @아이디`가 나옵니다. `연결 실패`면 ID나 권한을 다시 확인하세요.

(예전 앱에서 "Instagram 로그인" 방식이 보이면 그 토큰(`IG…`로 시작)을 써도 되고, 이때는 `IG_USER_ID`가 필요 없습니다.)

## 4단계. GitHub에 넣기 (5분)
저장소 → **Settings → Secrets and variables → Actions**

| 탭 | 이름 | 값 | 필수 |
|---|---|---|---|
| Secrets | `THREADS_ACCESS_TOKEN` | 2단계 토큰 | 스레드 쓰려면 |
| Secrets | `IG_ACCESS_TOKEN` | 3단계 토큰 | 인스타 쓰려면 |
| Variables | `IG_USER_ID` | 3단계 7번 인스타 계정 ID | 통합 로그인 토큰이면 필수 |
| Secrets | `SECRETS_PAT` | 토큰 자동 갱신용 (아래 5단계) | 선택 |
| Variables | `PUBLISH_ENABLED` | `true` (**dry-run 확인 후에**) | 실제 발행 시 |
| Variables | `THREADS_DAILY_MAX` | 기본 3 | 선택 |
| Variables | `IG_DAILY_MAX` | 기본 2 | 선택 |

### 확인 순서
1. 토큰 2개만 넣고 **Actions → publish → Run workflow**.
2. 로그에 `연결 확인 @아이디`와 `[dry-run] … 발행 예정`(또는 `올릴 초안 없음`)이 나오면 연결 완료. `토큰 없음`이면 Secret 이름 오타, `연결 실패`면 토큰·ID·권한 확인.
3. 괜찮으면 Variables에 `PUBLISH_ENABLED=true` → 다시 Run workflow → 스레드·인스타에 실제로 올라갔는지 확인.
4. 이후엔 하루 4번(09:00, 12:30, 18:30, 21:00 KST) 자동 실행. 실패하면 GitHub가 메일을 보냅니다.
5. 멈추고 싶으면 `PUBLISH_ENABLED`를 `false`로 바꾸면 됩니다.

## 5단계. 토큰 만료 대비 (선택, 5분)
- 인스타 시스템 사용자 토큰(`EAA…`)은 만료되지 않아 갱신하지 않습니다. 스레드 장기 토큰은 약 60일 뒤 만료됩니다. `refresh-tokens` 워크플로가 매월 1일·15일에 갱신을 요청합니다.
- 갱신 때 새 토큰 문자열이 오면 Secret을 바꿔야 하는데, 이를 자동으로 하려면:
  GitHub → 프로필 → **Settings → Developer settings → Fine-grained tokens → Generate** → 저장소: `affiliate-pipeline`만 → 권한 **Secrets: Read and write** 만 → 만료 1년 → 값을 Secret `SECRETS_PAT`에 저장.
- 넣지 않으면 갱신이 필요할 때 워크플로가 실패로 표시되고 메일이 옵니다. 그때 2·3단계를 다시 하면 됩니다.

---

## 발행 규칙 (코드에 들어간 것)
| 규칙 | 내용 |
|---|---|
| 발행 대상 | main의 오늘·어제 초안 중 ✅ 이고, 발행 직전 준수 검사를 **다시** 통과한 것 |
| 속도 | 실행 1회당 채널별 1개, 하루 스레드 3 / 인스타 2 (공식 한도 스레드 250·인스타 100/24시간보다 훨씬 낮게) |
| 광고 비율 | 채널별 하루 광고(제휴 링크) 글은 정보 글(`program=info`) 수를 넘지 않음 → 광고 50% 이하 (docs/OPERATIONS.md 운영 원칙). 정보 글이 없으면 하루 광고 1개에서 멈춤 |
| 반복 방지 | 같은 초안·같은 문구는 채널별 한 번만 (`drafts/published.json` 기록) |
| 대가성 표기 | 첫 줄에 프로그램별 표준 문구 그대로 (COMPLIANCE.md). 인스타도 캡션 첫 줄 |
| 인스타 링크 | 캡션 링크는 클릭되지 않아 "프로필 링크에서 확인" 문구로 바꿉니다 |
| 인스타 이미지 | 공개된 JPEG 주소가 있는 초안만. 쿠팡 API 상품 이미지 또는 `products.csv`의 `imageUrl` |
| 글자 수 | 스레드 500자, 인스타 2,200자 초과 시 건너뜀 |

## 알아둘 점
- **인스타는 클릭이 약합니다.** 캡션 링크가 안 눌리므로 프로필 링크가 중요합니다. 정적 사이트(PLAN 3주차)가 생기면 프로필 링크를 "오늘의 특가 모음" 페이지로 바꾸는 것을 권장합니다. 그 전엔 프로필 링크를 스레드 프로필로 두는 방법이 있습니다.
- 이미지는 쓸 권리가 있는 것만 씁니다 (쿠팡 API 제공 이미지, 직접 만든 카드 이미지). 다른 사람 사진을 퍼오지 않습니다.
- 사실적인 AI 생성 이미지·영상을 올리면 Meta의 AI 라벨 정책에 따라 표시합니다.
- 팔로워 0에서 같은 형식 글을 반복하면 노출이 낮을 수 있습니다. 하루 상한은 낮게 시작해 반응을 보고 조정합니다.

## 출처 (공식 문서, 세부 메뉴·버전은 확인 필요)
- [Threads API 게시](https://developers.facebook.com/docs/threads/posts) · [토큰](https://developers.facebook.com/docs/threads/get-started/long-lived-tokens) · [게시 한도](https://developers.facebook.com/docs/threads/troubleshooting#rate-limiting)
- 통합 로그인 전환 사례: [Postiz 이슈 #2350](https://github.com/gitroomhq/postiz-app/issues/2350) ("API setup with Instagram login is not available for newer apps")
- [Instagram API (Instagram 로그인)](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login) · [콘텐츠 게시](https://developers.facebook.com/docs/instagram-platform/content-publishing)
