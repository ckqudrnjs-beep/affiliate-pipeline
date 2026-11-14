// 프로필 별명 규칙(서버 functions/api/*.js 와 화면 build.py 가 같이 쓴다. build.py 는 이 파일의 'export '를 떼고 그대로 넣는다).
// 별명 = "아바타 이름". 이름은 한글·영문·숫자 2~10자(띄어쓰기·기호·자음만 금지 → 'ㅅㅂ' 같은 우회 차단), 욕설·사칭 단어 금지.
// 코인 상점 아바타 30종(BK 2026-11-14): 일반 🪙3 · 희귀 🪙8 · 전설 🪙20. r = 사려면 먼저 달성해야 하는 업적(Bonus ACH 키)
export const AV_SHOP = [
  ["🐨", "koala", 3], ["🐹", "hamster", 3], ["🐮", "cow", 3], ["🐷", "pig", 3], ["🐵", "monkey", 3], ["🦁", "lion", 3], ["🐔", "chick", 3], ["🦆", "duck", 3], ["🐢", "turtle", 3], ["🐳", "whale", 3],
  ["🦄", "unicorn", 8], ["🦉", "owl", 8], ["🦋", "butterfly", 8], ["🐬", "dolphin", 8], ["🦖", "trex", 8], ["🦕", "dino", 8], ["👻", "ghost", 8], ["🎃", "pumpkin", 8], ["🤠", "cowboy", 8], ["🥷", "ninja", 8],
  ["👑", "crown", 20], ["🔥", "fire", 20], ["🌈", "rainbow", 20], ["🌙", "moon", 20], ["🧞", "genie", 20], ["🦸", "hero", 20], ["🐲", "dragon", 20], ["🪐", "planet", 20, "sl5"], ["⚡", "bolt", 20, "tt500"], ["💎", "gem", 20, "rg4"],
];
export const AVATARS = ["🐱", "🐶", "🦊", "🐼", "🐧", "🐰", "🐻", "🐯", "🐸", "🐙", "👾", "🤖", "🎮", "⭐", "🚀", "🐉", "🛸", "🧑‍🚀", ...AV_SHOP.map((a) => a[0])];
// 산 사람만 고를 수 있는 아바타(화면에서만 잠금, 꾸미기라 서버는 검사 안 함). d: = 디자인 스킨, a: = 코인 상점 아바타
export const AVATAR_LOCK = { "🐉": "d:starlight:dragon", "🛸": "d:starlight:ufo", "🧑‍🚀": "d:tongtong:astro", ...Object.fromEntries(AV_SHOP.map((a) => [a[0], "a:" + a[1]])) };
export const BAD = ["시발", "씨발", "씨빨", "시빨", "싸발", "쌍년", "썅", "병신", "븅신", "빙신", "좆", "좃", "존나", "졸라", "개새", "개색", "개세", "새끼", "섀끼", "지랄", "염병", "미친", "미췬", "꺼져", "닥쳐", "엿먹", "느금", "니미", "니애미", "느개비", "애미", "애비", "에미", "섹스", "쎅스", "야동", "보지", "자지", "꼬추", "창녀", "걸레", "한남", "김치녀", "틀딱", "장애", "똥꼬", "운영자", "관리자", "5락실", "오락실운영", "fuck", "fuk", "shit", "bitch", "sex", "porn", "nigg", "dick", "pussy", "cunt", "admin", "slut", "whore"];
export function nameOk(n) {
  n = String(n || "");
  if (!/^[가-힣A-Za-z0-9]{2,10}$/.test(n)) return false;
  const t = n.toLowerCase().replace(/[0-9]/g, "");
  return !BAD.some((w) => t.includes(w));
}
export function profileNickOk(n) {
  const s = String(n || ""), i = s.indexOf(" ");
  return i > 0 && AVATARS.includes(s.slice(0, i)) && nameOk(s.slice(i + 1));
}
