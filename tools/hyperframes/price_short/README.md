# 시세 Shorts 시험 템플릿 (HyperFrames)

2026-11-16 BK 요청으로 시험 중. HTML 한 장 → 1080×1920 12초 MP4. 자동: `src/pipeline/textshort.py` + `.github/workflows/textshort.yml` (격주 월요일). 틀은 `template.html` ({{빈칸}}).

- 도구: HeyGen 공식 오픈소스 HyperFrames (Apache-2.0), **버전 0.9.56 고정** (`package.json`).
- 숫자는 `data/report/<날짜>.json`(주간 리포트)에서만 가져온다.
- 원격 사용 통계 끄기: 실행 전에 `HYPERFRAMES_NO_TELEMETRY=1` `DO_NOT_TRACK=1`.
- 글꼴: `assets/fonts/`에 `NanumSquareB.ttf`, `NanumBarunGothicBold.ttf`를 넣는다 (fonts-nanum 패키지, 저장소에는 올리지 않음).

```bash
cd tools/hyperframes/price_short
mkdir -p assets/fonts && cp /usr/share/fonts/truetype/nanum/{NanumSquareB,NanumBarunGothicBold}.ttf assets/fonts/
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1
npx --yes hyperframes@0.9.56 check
npx --yes hyperframes@0.9.56 render -o renders/price-short.mp4
```

손으로 만들 때: `PYTHONPATH=src python -m pipeline.textshort make <날짜> --force`
렌더 확인: `.claude/skills/watch` 로 장면을 뽑아 글자 잘림을 본다.
