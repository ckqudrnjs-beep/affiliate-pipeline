-- Cloudflare D1 스키마 (BK가 D1 데이터베이스 생성 후 한 번 실행)
CREATE TABLE IF NOT EXISTS counts (qid TEXT NOT NULL, opt TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (qid, opt));
-- 중복 방지: 원본 IP는 저장하지 않고, (IP+질문+날짜+비밀값) 해시만 하루 동안 둔다.
CREATE TABLE IF NOT EXISTS seen (h TEXT PRIMARY KEY, day TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS seen_day ON seen(day);
