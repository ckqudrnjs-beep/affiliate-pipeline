# don3chon.com 연결 순서 (2026-11-08)

사이트 코드: `src/pipeline/site.py`, `src/pipeline/calcs.py`, `config/site_products.csv`, `config/site.json`.
메뉴 이름은 화면이 바뀌었을 수 있으니 비슷한 이름을 찾으세요.

## 0. 푸시 (BK OK 후 Claude가 진행)
브랜치를 올리고 PR을 만든다. BK가 병합하면 main 기준으로 배포된다.

## 1. Cloudflare Pages에 저장소 연결 (약 10분)
1. dash.cloudflare.com → 왼쪽 **Workers & Pages** → **Create** (만들기)
2. **Pages** 탭 → **Import an existing Git repository** (Git에 연결) → GitHub 로그인·권한 허용 → `affiliate-pipeline` 선택
3. 빌드 설정
   - Production branch: `main`
   - Framework preset: None
   - Build command: `PYTHONPATH=src python -m pipeline.site site`
   - Build output directory: `site`
   - Environment variables: `PYTHON_VERSION` = `3.12`
4. **Save and Deploy** → `xxx.pages.dev` 주소가 열리면 성공
5. 프로젝트 → **Custom domains** → **Set up a custom domain** → `don3chon.com` 입력 → DNS 자동 추가 승인. `www.don3chon.com`도 같은 방법으로 추가

## 2. 구글 검색 등록 (약 5분)
1. search.google.com/search-console → **속성 추가** → 왼쪽 **도메인** → `don3chon.com`
2. TXT 레코드 확인 화면에서 **Cloudflare로 확인**(자동) 버튼이 보이면 누르고 승인. 없으면 TXT 값을 복사해 Cloudflare → don3chon.com → **DNS** → **레코드 추가**(유형 TXT, 이름 `@`, 내용 붙여넣기) → 다시 **확인**
3. 왼쪽 **Sitemaps** → `sitemap.xml` 입력 → 제출

## 3. 네이버 검색 등록 (약 5분)
1. searchadvisor.naver.com → **웹마스터 도구** → 사이트 등록 `https://don3chon.com`
2. 소유 확인 → **HTML 태그** 선택 → `content="..."` 안의 값을 Claude에게 전달 (비밀값 아님) → `config/site.json`의 `naverSiteVerification`에 넣고 배포 → 네이버에서 **소유확인**
3. **요청** → **사이트맵 제출** → `https://don3chon.com/sitemap.xml`

## 4. 제휴사에 사이트 등록
- 쿠팡 파트너스: 로그인 → 회원 정보(또는 사이트 관리) → 홍보 사이트/채널에 `https://don3chon.com` 추가. 이때 이용약관의 금지행위·사이트 등록 항목을 캡처해 Claude에게 전달
- 알리 포털(portals.aliexpress.com): Account → 웹사이트(미디어) 정보 → `https://don3chon.com` 추가

## 5. 매일 운영
- 상품: 알리 API로 가격 갱신 → 판단 문장 초안 PR → BK 병합 → 자동 배포 (자동화 연결은 다음 단계)
- 애드센스: 계산기 5개 + 설명 글 10편 정도 갖춘 뒤 신청
