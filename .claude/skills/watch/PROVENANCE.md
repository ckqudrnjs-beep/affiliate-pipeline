# 출처

- 원본: https://github.com/bradautomates/claude-video (MIT, Bradley Bonanno)
- 고정 커밋: 03ceb42f7fa2c4439aca01752118044baabffb8f (2026-09-25), 스킬 버전 0.3.2
- 가져온 것: `skills/watch/` 만 (빌드 스크립트·훅 제외). 2026-11-16 코드 검토: 표준 라이브러리만 사용, 네트워크는 yt-dlp와(선택 시) Google Gemini API뿐.

## 우리 쓰임새
- 기본은 **local 엔진, 키 없음**: `WATCH_ENGINE=local`, `--no-whisper`. 영상이 밖으로 나가지 않는다.
- 우리 Shorts 업로드 전 화면 확인(글자 잘림·안전 영역), 우리 채널 영상 점검에 쓴다.
- 남의 영상을 내려받아 재사용하지 않는다. 키(Gemini/Groq/OpenAI)는 BK가 원할 때만, 저장소에는 절대 넣지 않는다.
- 업데이트는 새 커밋을 다시 검토한 뒤 이 파일의 커밋을 바꾼다.
