-- Cloudflare D1 스키마 (BK가 D1 데이터베이스 생성 후 한 번 실행)
CREATE TABLE IF NOT EXISTS counts (qid TEXT NOT NULL, opt TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (qid, opt));
-- 중복 방지: 원본 IP는 저장하지 않고, (IP+질문+날짜+비밀값) 해시만 하루 동안 둔다.
CREATE TABLE IF NOT EXISTS seen (h TEXT PRIMARY KEY, day TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS seen_day ON seen(day);
-- 오늘의 도전 순위: 별명(자동 생성)과 최고 점수만. 하루 지나면 순위 초기화(지난 기록은 7일 뒤 삭제).
CREATE TABLE IF NOT EXISTS scores (day TEXT NOT NULL, game TEXT NOT NULL, h TEXT NOT NULL, nick TEXT NOT NULL, score INTEGER NOT NULL, PRIMARY KEY (day, game, h));
CREATE INDEX IF NOT EXISTS scores_top ON scores(day, game, score DESC);
-- 가입 없는 프로필(2026-11-13): 복구 코드의 해시만 저장(코드 원문·개인정보 없음). profile.js 가 처음 호출될 때 자동으로 만든다.
CREATE TABLE IF NOT EXISTS profiles (h TEXT PRIMARY KEY, nick TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ptries (h TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL);
-- 프로필 7일 기록(score.js 가 처음 호출될 때 자동으로 만든다). 게임·날짜 색인: 최근 7일 순위·삭제가 표 전체를 읽지 않게(2026-11-14)
CREATE TABLE IF NOT EXISTS pscores (h TEXT NOT NULL, game TEXT NOT NULL, day TEXT NOT NULL, nick TEXT NOT NULL, score INTEGER NOT NULL, PRIMARY KEY (h, game, day));
CREATE INDEX IF NOT EXISTS pscores_gd ON pscores(game, day);
