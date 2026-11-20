/* ---------- 4~7장: 같은 틀로 만드는 장들 (거꾸로 숲 · 번개 둥지 · 가라앉는 옛 도읍 · 첫바람 언덕) ---------- */
const CHX = {
  4: { n: '거꾸로 숲', town: '뿌리내림 마을', kind: 'grove', hkind: 'grove2', q0: 18,
    npc: { chief: '숲지기 겨우살이', smith: '대장장이 옹이', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' },
    isl: ['이끼 비탈', '거꾸로 덤불', '매달린 숲', '반딧불 골'], ci: ['넝쿨 나루', '뿌리 벼랑'], hill: '고목 밑동',
    F: [[34, 24, 8], [36, 60, 8.5], [56, 42, 9], [76, 22, 8]], C: [[94, 50, 8.5], [112, 28, 8]], H: [132, 50, 9.8],
    lv: [[34, 35], [35, 36], [36, 37], [37, 38], [39, 40], [40, 41]], hlv: [42, 43], blv: 44,
    m: { a: 'mossfluff', b: 'thornpod', c: 'mothbird', d: 'rootling', k: 'rootkeeper', boss: 'oldtree' },
    mn: { a: '이끼 보풀', b: '가시 꼬투리', c: '나방새', d: '뿌리 덩이', k: '뿌리 둥지지기', boss: '뒤집힌 고목' },
    md: { a: '거꾸로 자란 숲 밑에서 이끼가 뭉쳐 생긴 보풀이.', b: '가시 덩굴이 감긴 꼬투리. 냅다 들이받아요.', c: '빛나는 가루를 흘리며 날아드는 나방 닮은 새.', d: '뿌리째 뽑혀 걸어 다니는 흙덩이. 가까이 오면 팔을 휘둘러요(바닥 표시를 보고 피해요).', k: '뿌리로 둥지를 엮은 둥지지기. 질긴 덩굴을 품고 있어요.', boss: '섬 밑면에 거꾸로 매달려 자라던 고목. 바람이 멎자 뿌리를 하늘로 뻗고 땅으로 걸어 나왔어요.' },
    bg: ['vine', '질긴 덩굴', '덩굴 다리'], sg: ['sap', '굳은 수액'], gm: 2.0, tier: ['뿌리', '고목'], set: ['grove', '숲지기'], uq: ['u_oldheart', '고목의 나이테', '뒤집힌 고목의 가장 안쪽 나이테. 귀에 대면 천 년 동안 거꾸로 분 바람 소리가 난다.'],
    tint: ['rgba(30,70,40,.5)', 'rgba(170,255,140,.55)'], boss: { hp: 9000, dmg: [34, 50], spd: .9, pat: { line: 7, volley: 6, sweep: 6, summon: 18, blades: 0 }, rage: { blades: 6 }, col: '#9aff6a', sum: 'rootling' },
    q: ['숲 밑 밑것 20마리 쓰러뜨리기', '뿌리 둥지지기의 질긴 덩굴 4개로 반딧불 골 동쪽 덩굴 다리 잇기', '뿌리 덩이 12마리 쓰러뜨리기', '굳은 수액 5개 가져오기', '고목 밑동의 뒤집힌 고목을 쓰러뜨리고 바람개비 표지에 손 얹기'],
    qn: ['뿌리내림 마을의 부탁', '덩굴 다리', '걷는 뿌리', '수액 담금질', '고목 밑동의 뒤집힌 고목'],
    talk: [['항구에서 바람을 타고 왔다고? 여긴 섬 밑면에 매달려 자란 거꾸로 숲일세.', '바람이 멎자 숲이 제멋대로 자라서 밑것이 들끓어. 스무 마리만 치워 주게.'],
      ['반딧불 골 동쪽 덩굴 다리가 끊어졌네. 뿌리 둥지지기들이 질긴 덩굴을 품고 있어. 네 타래면 다시 엮을 수 있지.'],
      ['솔바람이야. 뿌리 덩이들 봤어? 원래 고목을 받치던 흙인데 바람이 멎자 걸어 다녀. 열두 마리만 쉬게 해 줘.'],
      ['난 옹이, 여기 대장장이야. 이 숲 수액은 굳으면 쇠보다 질기지. 다섯 덩이만 구해 줘. 소금 보풀 대신 이끼 보풀이랑 가시 꼬투리가 달고 다녀.'],
      ['고목 밑동에 뒤집힌 고목이 서 있네. 뿌리를 줄줄이 땅에서 솟구치게 하고, 씨앗을 우박처럼 떨군다더군.', '성이 나면 가시를 사방으로 쏜다니, 가시 사이 틈을 보게.']],
    done: [['숲길에 다시 사람이 다니네. 고맙네.'], ['덩굴 다리가 다시 엮였어! 저 너머 넝쿨 나루, 뿌리 벼랑, 그리고 고목 밑동이야.'], ['고마워. 흙이 다시 제자리를 찾아가.'], ['좋아, 이 정도면 한 해는 담금질하겠어. 수고비야.'], ['…숲이 숨을 쉰다! 거꾸로 매달린 나무들이 바람에 흔들려.', '그런데 바람 끝에서 우르릉 소리가 나네. 번개 둥지 쪽이야.']],
    end: ['4장 「거꾸로 숲」 끝', '뒤집힌 고목이 쓰러지자 하늘로 뻗었던 뿌리가 천천히 땅속으로 돌아갔다.', '숲 사이로 바람이 다시 분다. 바람은 먹구름이 낀 번개 둥지로 흘러간다.'] },
  5: { n: '번개 둥지', town: '피뢰침 마을', kind: 'storm', hkind: 'storm2', q0: 23,
    npc: { chief: '등대지기 우레', smith: '대장장이 벼락쇠', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' },
    isl: ['먹구름 턱', '천둥 바위', '번쩍 들', '비구름 골'], ci: ['피뢰침 나루', '벼락 맞은 등성이'], hill: '고래 둥지',
    F: [[36, 28, 8], [34, 58, 8.5], [58, 44, 9], [74, 64, 8]], C: [[92, 28, 8.5], [112, 52, 8]], H: [132, 30, 10],
    lv: [[43, 44], [44, 45], [45, 46], [46, 47], [48, 49], [49, 50]], hlv: [50, 51], blv: 52,
    m: { a: 'stormfluff', b: 'sparkpod', c: 'stormbird', d: 'stormling', k: 'stormkeeper', boss: 'whale' },
    mn: { a: '먹구름 보풀', b: '불꽃 꼬투리', c: '번개새', d: '번개 덩이', k: '번개 둥지지기', boss: '구름 고래' },
    md: { a: '먹구름이 뭉쳐 생긴 보풀이. 찌릿찌릿해요.', b: '번개를 머금은 꼬투리. 멀리서 냅다 들이받아요.', c: '먹구름 사이를 가르며 내리꽂는 새.', d: '번개 맞은 바위가 걸어 다니는 덩이. 가까이 오면 팔을 휘둘러요.', k: '번개 바위로 둥지를 튼 둥지지기. 번개 돌을 품고 있어요.', boss: '섬과 섬 사이를 헤엄치던 구름 고래. 바람이 멎자 번개를 삼키며 둥지를 지키고 있어요.' },
    bg: ['boltstone', '번개 돌', '번개 바위 다리'], sg: ['ozone', '번개 가루'], gm: 2.6, tier: ['먹구름', '번개'], set: ['storm', '등대지기'], uq: ['u_whalebell', '고래의 울림', '구름 고래가 마지막으로 낸 울음을 담은 작은 종. 흔들면 멀리서 천둥이 대답한다.'],
    tint: ['rgba(40,40,90,.55)', 'rgba(255,240,120,.6)'], boss: { hp: 13000, dmg: [44, 64], spd: .85, fly: 1, pat: { volley: 4.5, line: 7, summon: 15 }, rage: { cage: 8 }, col: '#fff27a', sum: 'stormbird' },
    q: ['번개 둥지 밑것 20마리 쓰러뜨리기', '번개 둥지지기의 번개 돌 4개로 번쩍 들 동쪽 바위 다리 잇기', '번개 덩이 12마리 쓰러뜨리기', '번개 가루 5개 가져오기', '고래 둥지의 구름 고래를 쓰러뜨리고 바람개비 표지에 손 얹기'],
    qn: ['피뢰침 마을의 부탁', '번개 바위 다리', '찌릿한 덩이', '번개 담금질', '고래 둥지의 구름 고래'],
    talk: [['숲을 지나왔다고? 여긴 번개 둥지, 먹구름이 걷히질 않는 곳이야.', '번개 맞은 밑것들이 들끓어. 스무 마리만 부탁해.'],
      ['번쩍 들 동쪽 바위 다리가 번개에 끊겼어. 번개 둥지지기들이 번개 돌을 품고 있지. 네 개면 다시 이을 수 있어.'],
      ['솔바람이야. 번개 덩이들은 원래 등대 돌이었대. 열두 마리만 쉬게 해 줘.'],
      ['난 벼락쇠. 번개 가루로 담금질하면 칼날이 빛을 머금지. 다섯 줌만 부탁해. 먹구름 보풀이랑 불꽃 꼬투리가 달고 다녀.'],
      ['고래 둥지 위에 구름 고래가 떠 있어. 번개를 여기저기 내리꽂고, 입으로 번개 줄기를 뿜지.', '성이 나면 네 둘레를 번개로 둘러싸. 그땐 한가운데에 서 있어야 해.']],
    done: [['등대 불빛이 다시 보이네. 고마워.'], ['바위 다리가 이어졌어! 저 너머 피뢰침 나루, 벼락 맞은 등성이, 그리고 고래 둥지야.'], ['고마워. 등대 돌들이 다시 잠들었어.'], ['좋아, 칼날이 빛을 머금겠는걸. 수고비야.'], ['…먹구름이 걷힌다! 고래가 다시 바람을 타고 헤엄쳐 가.', '바람이 흘러가는 쪽은… 구름에 잠긴 옛 도읍이야.']],
    end: ['5장 「번개 둥지」 끝', '구름 고래가 번개를 다 뱉어 내자 먹구름이 걷히고, 고래는 바람을 타고 멀리 헤엄쳐 갔다.', '바람은 이제 구름에 반쯤 잠긴 옛 도읍으로 흘러간다.'] },
  6: { n: '가라앉는 옛 도읍', town: '종탑 마을', kind: 'ruin', hkind: 'ruin2', q0: 28,
    npc: { chief: '종지기 늙은 돌쇠', smith: '대장장이 주춧돌', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' },
    isl: ['무너진 장터', '잠긴 골목', '옛 궁 뜰', '부서진 성벽'], ci: ['돌다리 나루', '빈 성문 앞'], hill: '빈 성',
    F: [[34, 30, 8], [38, 56, 8.5], [56, 40, 9], [74, 22, 8]], C: [[94, 48, 8.5], [112, 26, 8]], H: [132, 48, 10],
    lv: [[51, 52], [52, 53], [53, 54], [54, 55], [55, 56], [56, 57]], hlv: [57, 58], blv: 59,
    m: { a: 'dustfluff', b: 'stonepod', c: 'ashbird', d: 'stoneguard', k: 'stonekeeper', boss: 'gatekeeper' },
    mn: { a: '먼지 보풀', b: '돌 꼬투리', c: '잿빛새', d: '돌 병정', k: '돌 둥지지기', boss: '돌 문지기' },
    md: { a: '옛 도읍의 먼지가 뭉친 보풀이.', b: '돌처럼 단단한 꼬투리. 냅다 들이받아요.', c: '무너진 지붕에 사는 잿빛 새.', d: '빈 성을 지키던 돌 병정. 가까이 오면 주먹을 휘둘러요.', k: '무너진 돌로 둥지를 튼 둥지지기. 다듬은 돌을 품고 있어요.', boss: '빈 성의 문을 지키는 거대한 돌 문지기. 아무도 들어오지 못하게 하라는 마지막 명령을 아직 지키고 있어요.' },
    bg: ['cutstone', '다듬은 돌', '무너진 돌다리'], sg: ['oldiron', '옛 쇳조각'], gm: 3.2, tier: ['옛 도읍', '돌성'], set: ['ruin', '성지기'], uq: ['u_gatekey', '빈 성의 열쇠', '돌 문지기의 가슴에 박혀 있던 열쇠. 어느 문에 꽂아도 맞지 않지만, 쥐면 등이 곧게 펴진다.'],
    tint: ['rgba(150,140,120,.55)', 'rgba(110,100,90,.55)'], boss: { hp: 18000, dmg: [56, 80], spd: .95, pat: { sweep: 5, line: 6, summon: 20, volley: 0 }, rage: { volley: 4, blades: 7 }, col: '#ffb03a', sum: 'stoneguard' },
    q: ['옛 도읍 밑것 20마리 쓰러뜨리기', '돌 둥지지기의 다듬은 돌 4개로 옛 궁 뜰 동쪽 돌다리 잇기', '돌 병정 12마리 쓰러뜨리기', '옛 쇳조각 5개 가져오기', '빈 성의 돌 문지기를 쓰러뜨리고 바람개비 표지에 손 얹기'],
    qn: ['종탑 마을의 부탁', '무너진 돌다리', '잠들지 못한 병정', '옛 쇠 녹이기', '빈 성의 돌 문지기'],
    talk: [['번개 둥지를 지나왔다고? 여긴 구름에 반쯤 잠긴 옛 도읍일세. 날마다 조금씩 가라앉고 있어.', '빈 골목마다 밑것이 들끓네. 스무 마리만 부탁하네.'],
      ['옛 궁 뜰 동쪽 돌다리가 무너졌네. 돌 둥지지기들이 다듬은 돌을 품고 있어. 네 개면 다시 놓을 수 있지.'],
      ['솔바람이야. 돌 병정들은 아직도 옛 임금의 명령을 지키고 있대. 열두 마리만 쉬게 해 줘.'],
      ['난 주춧돌. 옛 도읍의 쇠는 지금 쇠보다 좋아. 다섯 조각만 모아 줘. 먼지 보풀이랑 돌 꼬투리가 물고 다녀.'],
      ['빈 성 앞에 돌 문지기가 서 있네. 팔을 휘둘러 둘레를 쓸고, 땅을 줄줄이 갈라 놓지.', '성이 나면 돌덩이가 하늘에서 쏟아지고 돌 조각이 사방으로 튄다네.']],
    done: [['골목에 다시 등불이 켜지네. 고맙네.'], ['돌다리가 다시 놓였어! 저 너머 돌다리 나루, 빈 성문 앞, 그리고 빈 성이야.'], ['고마워. 병정들이 드디어 쉬어.'], ['좋은 쇠야. 수고비로 받아.'], ['…도읍이 멈췄어! 더는 가라앉지 않아.', '그런데 성 안 벽에 그림이 있었네. 첫바람 언덕 꼭대기에 선 사람… 첫 이음꾼이야.']],
    end: ['6장 「가라앉는 옛 도읍」 끝', '돌 문지기가 무너지자 빈 성이 가라앉기를 멈추었다.', '성 안 벽화에는 첫바람 언덕 꼭대기에 홀로 선 사람이 그려져 있었다. 옛날, 처음으로 섬과 섬을 이었다는 첫 이음꾼.'] },
  7: { n: '첫바람 언덕', town: '마지막 쉼터', kind: 'gale', hkind: 'gale2', q0: 33,
    npc: { chief: '쉼터지기 하늘', smith: '대장장이 바람쇠', merchant: '떠돌이 상인 얼레', sage: '이야기꾼 솔바람' },
    isl: ['바람 멎은 비탈', '하얀 풀밭', '고요한 등성이', '구름 바다 끝'], ci: ['하늘 나루', '마지막 오르막'], hill: '첫바람 언덕 꼭대기',
    F: [[36, 26, 8], [36, 58, 8.5], [56, 42, 9], [74, 62, 8]], C: [[94, 30, 8.5], [114, 50, 8]], H: [134, 32, 10.5],
    lv: [[58, 59], [59, 60], [60, 61], [61, 62], [62, 63], [63, 64]], hlv: [64, 65], blv: 66,
    m: { a: 'galefluff', b: 'galepod', c: 'galebird', d: 'galeling', k: 'galekeeper', boss: 'windlord' },
    mn: { a: '고요 보풀', b: '바람 꼬투리', c: '하늘새', d: '바람 덩이', k: '바람 둥지지기', boss: '첫 이음꾼 하늬' },
    md: { a: '바람이 멎은 언덕에 쌓인 흰 보풀이.', b: '갇힌 바람을 머금은 꼬투리. 냅다 들이받아요.', c: '마지막 바람을 쫓는 하늘새.', d: '굳어 버린 바람 덩이. 가까이 오면 팔을 휘둘러요.', k: '갇힌 바람으로 둥지를 튼 둥지지기. 바람 매듭을 품고 있어요.', boss: '옛날 처음으로 섬과 섬을 이었던 첫 이음꾼. 섬들이 서로 멀어질까 두려워 큰바람을 언덕 꼭대기에 가두었어요.' },
    bg: ['windknot', '바람 매듭', '바람 다리'], sg: ['skysilk', '하늘 실'], gm: 3.8, tier: ['첫바람', '하늘끝'], set: ['gale', '이음꾼'], uq: ['u_firstwind', '첫바람', '첫 이음꾼이 가두었던 바람 한 줌. 손을 펴면 처음 섬과 섬이 이어지던 날의 소리가 들린다.'],
    tint: ['rgba(225,235,250,.6)', 'rgba(255,255,255,.6)'], boss: { hp: 26000, dmg: [70, 100], spd: 1, fly: 1, pat: { line: 5, volley: 4, blades: 5, summon: 14 }, rage: { cage: 7 }, col: '#9fe4ff', sum: 'galebird', final: 1 },
    q: ['첫바람 언덕 밑것 20마리 쓰러뜨리기', '바람 둥지지기의 바람 매듭 4개로 고요한 등성이 동쪽 바람 다리 잇기', '바람 덩이 12마리 쓰러뜨리기', '하늘 실 5개 가져오기', '언덕 꼭대기의 첫 이음꾼을 막고 바람개비 표지에 손 얹기'],
    qn: ['마지막 쉼터의 부탁', '바람 다리', '굳은 바람', '하늘 실 꼬기', '첫바람 언덕 꼭대기'],
    talk: [['여기까지 왔구나, 이음꾼. 여긴 첫바람 언덕, 큰바람이 처음 불던 곳이야. 지금은 바람 한 점 없지.', '굳은 바람 밑것들이 길을 막고 있어. 스무 마리만 치워 줘.'],
      ['고요한 등성이 동쪽 바람 다리가 끊어졌어. 바람 둥지지기들이 바람 매듭을 품고 있지. 네 개면 다시 묶을 수 있어.'],
      ['솔바람이야. 여기까지 같이 왔네. 바람 덩이들은… 꼭대기에서 흘러내린 바람이 굳은 거래. 열두 마리만 풀어 줘.'],
      ['난 바람쇠. 하늘 실로 꼰 끈은 끊어지지 않아. 다섯 가닥만 모아 줘. 고요 보풀이랑 바람 꼬투리가 감고 다녀.'],
      ['꼭대기에 누군가 있어. 벽화 속 그 사람, 첫 이음꾼이야. 큰바람을 가둔 게… 그 사람이었어.', '섬들이 멀어질까 봐 바람을 가뒀대. 그런데 바람이 멎으니 섬들이 가라앉고 있어. 막아야 해.']],
    done: [['길이 열렸어. 고마워.'], ['바람 다리가 묶였어! 하늘 나루, 마지막 오르막… 그리고 꼭대기야.'], ['고마워. 굳은 바람이 다시 흘러가.'], ['좋아, 이걸로 끊어지지 않는 끈을 꼬아 둘게. 수고비야.'], ['…바람이다. 큰바람이 다시 분다!', '첫 이음꾼은 웃으며 바람 속으로 흩어졌어. "이제 네가 이어 줘."']],
    end: ['「끊어진 하늘」 끝', '첫 이음꾼이 가두었던 큰바람이 언덕 꼭대기에서 터져 나와 세상을 한 바퀴 돌았다. 가라앉던 섬들이 하나둘 떠오른다.', '끊어졌던 다리 끝마다 바람이 분다. 이제 섬과 섬을 잇는 건 당신이다.'] },
};
const MOBCOL = {}, SET_TIERS = [];
// 밑것 정의(3장 값을 장마다 키움)
for (const ch of [4, 5, 6, 7]) { const C = CHX[ch], f = 1 + .22 * (ch - 3), g = 1 + .18 * (ch - 3), M = C.m, N = C.mn, D = C.md;
  Object.assign(MOBDEF, {
    [M.a]: { n: N.a, hp: [14 * f, 7 * g], dmg: [4 * f, 6 * f, 1.1 * g], spd: 1.8, r: .3, sz: 0, xp: [9 * f, 4.5 * g], atk: 1, ai: 'melee', spr: M.a, desc: D.a },
    [M.b]: { n: N.b, hp: [24 * f, 9 * g], dmg: [5 * f, 8 * f, 1.5 * g], spd: 1.25, r: .32, sz: 1, xp: [13 * f, 5.5 * g], atk: 1.2, ai: 'charge', spr: M.b, desc: D.b },
    [M.c]: { n: N.c, hp: [12 * f, 5 * g], dmg: [4 * f, 6 * f, 1 * g], spd: 2.8, r: .28, sz: 0, xp: [10 * f, 4.5 * g], atk: .9, ai: 'dive', fly: 1, spr: M.c, desc: D.c },
    [M.d]: { n: N.d, hp: [42 * f, 14 * g], dmg: [6 * f, 10 * f, 1.6 * g], spd: 1.2, r: .42, sz: 1, xp: [19 * f, 7 * g], atk: 2.6, ai: 'spin', spr: M.d, desc: D.d },
    [M.k]: { n: N.k, hp: [140 * f, 32 * g], dmg: [8 * f, 13 * f, 1.7 * g], spd: 1.05, r: .55, sz: 1, xp: [95 * f, 32 * g], atk: 1.8, ai: 'boss', mini: 1, big: 1, spr: M.k, desc: D.k },
    [M.boss]: { n: N.boss, hp: [C.boss.hp, 0], dmg: [C.boss.dmg[0], C.boss.dmg[1], 0], spd: C.boss.spd, r: 1.15, sz: 1, xp: [C.boss.hp * .9, 0], atk: 2.2, ai: 'boss', boss: 1, big: 1, chboss: ch, fly: C.boss.fly, spr: M.boss, desc: D.boss } });
  GOODS[C.bg[0]] = { n: C.bg[1], ic: 'plank', d: N.k + '가 품은 ' + C.bg[1] + '. ' + C.bg[2] + '를 잇는 데 써요', quest: 1 };
  GOODS[C.sg[0]] = { n: C.sg[1], ic: 'hone', d: '대장장이가 담금질에 쓰는 ' + C.sg[1], quest: 1 };
  // 장비: 2장 장비 틀을 장마다 한 단계씩 올림
  const off = { 4: 24, 5: 34, 6: 42, 7: 48 }[ch], acm = { 4: 1.8, 5: 2.2, 6: 2.6, 7: 3 }[ch], fxm = { 4: 2.1, 5: 2.6, 6: 3.1, 7: 3.6 }[ch], last = s => s.split(' ').pop();
  const L = C2BASES.map(b => { const o = { ...b, id: 'c' + ch + b.id, n: (b.lv <= 14 ? C.tier[0] : C.tier[1]) + ' ' + last(b.n), lv: b.lv + off };
    if (b.dmg) o.dmg = b.dmg.map(v => Math.round(v * C.gm)); if (b.ac) o.ac = Math.round(b.ac * acm); if (b.blk) o.blk = b.blk + ch;
    if (b.fix) { o.fix = {}; for (const k in b.fix) o.fix[k] = Math.round(b.fix[k] * fxm); } if (b.req) { o.req = {}; for (const k in b.req) o.req[k] = b.req[k] + off; }
    if (b.sail) o.sail = [5.2 + (ch - 3) * .4, b.sail[1]]; return o; });
  BASES.push(...L); for (const b of L) BASE[b.id] = b;
  const sp = ['helm3', 'armor3', 'glove2', 'belt2'].map(id => ['c' + ch + id, C.set[1] + ' ' + last(BASE['c' + ch + id].n)]); for (const [id, n] of sp) BASE[id].n = n;
  const k2 = ch - 3; SETS[C.set[0]] = { n: C.set[1], parts: sp, bonus: [[2, [['ac', 10 + 4 * k2], ['hp', 70 + 30 * k2]]], [3, [['dmgp', 14 + 4 * k2], ['res', 14 + 3 * k2]]], [4, [['aspd', 10 + 2 * k2], ['lifek', 6 + 2 * k2], ['find', 30 + 5 * k2]]]] };
  SET_TIERS.push([BASE['c' + ch + 'helm3'].lv + 2, C.set[0]]);
  UNIQ.push({ id: C.uq[0], n: C.uq[1], base: 'c' + ch + 'amu2', story: C.uq[2], fx: [['dmgp', 26 + 6 * k2], ['hp', 80 + 40 * k2], ['ac', 14 + 6 * k2], ['res', 16 + 4 * k2]], lv: BASE['c' + ch + 'amu2'].lv + 2 });
  // 의뢰
  const ids = [0, 1, 2, 3, 4].map(i => 'q' + (C.q0 + i)); C.qid = ids; const from = ['chief', 'chief', 'sage', 'smith', 'chief'], need = [20, 4, 12, 5, 1];
  ids.forEach((id, i) => QUESTS[id] = { ch, n: C.qn[i], from: from[i], goal: C.q[i], need: need[i], talk: C.talk[i], done: C.done[i] });
  for (const k of ['a', 'b', 'c', 'd', 'k', 'boss']) MOBCOL[M[k]] = { 4: ['#5a8a3a', '#a8e070', '#4a3420'], 5: ['#4a4a7a', '#fff27a', '#c8d0ff'], 6: ['#a09a8a', '#6a6258', '#d8cfb8'], 7: ['#e8f0ff', '#9fe4ff', '#ffffff'] }[ch]; }
const CXM = ch => CHX[ch] && CHX[ch].m;
function qAvailX(id) { const q = G.P.q, ch = G.Wd.ch, C = CHX[ch]; if (!C || qCh(id) !== ch) return false; const I = C.qid, i = I.indexOf(id); if (i === 0 || i === 2 || i === 3) return true; if (i === 1) return q[I[0]] && q[I[0]].s === 3; if (i === 4) return q[I[1]] && q[I[1]].s === 3; return false; }
function talkX(id, offer, finish) {
  const P = G.P, ch = G.Wd.ch, C = CHX[ch], I = C.qid, q = qid => P.q[qid], btns = []; let lines = null; const wp = wpk(C.hill);
  if (ch === 8) { lines = { chief: ['떠도는 섬엔 의뢰가 없어. 저 끝 ' + C.hill + '의 우두머리만 쓰러뜨리면 보물이 쏟아지지.'], sage: ['섬들이 다시 떠오르면서 길 잃은 섬도 생겼대. 이런 섬엔 오래 머물지 마.'], smith: ['떠도는 섬에서도 망치는 들고 다니지.'], merchant: ['어디든 따라가는 게 내 장사야!'] }[id];
    if (id === 'smith') btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); if (id === 'merchant') btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); return { lines, btns }; }
  if (id === 'chief') {
    if (!q(I[0])) offer(I[0]); else if (q(I[0]).s === 2) finish(I[0]); else if (q(I[0]).s === 1) lines = ['밑것들이 아직 들끓네. 스무 마리만 부탁하네.'];
    else if (!q(I[1])) offer(I[1]); else if (q(I[1]).s === 2) finish(I[1]); else if (q(I[1]).s === 1) lines = [C.bg[1] + '는 ' + C.mn.k + '가 품고 있어. 네 개 모아 ' + C.isl[2] + ' 동쪽 끊긴 ' + C.bg[2] + '로 가게.'];
    else if (!q(I[4])) offer(I[4]); else if (q(I[4]).s === 2 && P.flags[wp]) finish(I[4]); else if (q(I[4]).s === 2) lines = [C.hill + ' 바람개비 표지에 손을 얹어 주게. 바람이 돌아오게.'];
    else if (q(I[4]).s === 1) lines = [C.hill + '은(는) ' + C.ci[0] + ' 너머 ' + C.ci[1] + ' 끝에 있어. 바닥 표시를 잘 보게.'];
    else lines = ch === 7 ? ['큰바람이 다시 분다. 이제 섬과 섬을 잇는 건 자네야, 이음꾼.'] : ['바람이 돌아왔네. 자네 덕일세.', '다음 장으로 가는 바람길이 열렸어. 바람개비 표지에서 건너가 보게.']; }
  if (id === 'sage') { if (!q(I[2])) offer(I[2]); else if (q(I[2]).s === 2) finish(I[2]); else lines = ch === 7 && P.flags[C.m.boss] ? ['첫 이음꾼도 처음엔 너처럼 다리를 고치며 다녔대. 이 이야기는 내가 오래오래 전할게.'] : ['바람은 원래 세상을 한 바퀴 돌며 섬마다 숨을 불어넣었대.', '감정 안 된 물건이 있으면 보여 줘. 하나에 15G야.'];
    const n = P.inv.filter(it => !it.g && !it.id).length; btns.push(`<button class="sk-b" data-a="ident" ${n && P.gold >= 15 ? '' : 'disabled'}>감정하기 (${n}개 · 개당 15G)</button>`); }
  if (id === 'smith') { if (!q(I[3])) offer(I[3]); else if (q(I[3]).s === 1 && count(C.sg[0]) >= 5) { lines = [C.sg[1] + ' 다섯 개 다 모았구나!']; btns.push(`<button class="sk-b g" data-a="finish" data-q="${I[3]}">건네기</button>`); } else if (q(I[3]).s === 1) lines = [C.sg[1] + '는 ' + C.mn.a + '랑 ' + C.mn.b + '가 달고 다녀. 다섯 개야.']; else lines = ['강화든 옵션 다시 굴리기든 분해든 맡겨.']; btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); }
  if (id === 'merchant') { lines = ['또 만났네! 바람길 따라 여기까지 왔지.']; btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); }
  return { lines, btns };
}
function finishX(id) { const P = G.P, ch = qCh(id), C = CHX[ch], i = C.qid.indexOf(id); if (i === 3 && !useGood(C.sg[0], 5)) return false;
  const m = Math.pow(1.3, ch - 4), R = [[5000, 1500], [6500, 2000], [6000, 1800], [3500, 1200], [11000, 5000]][i].map(v => Math.round(v * m)); P.q[id].s = 3; gainXp(R[0]); P.gold += R[1]; if (id === 'q37') skyRankEnd(P.diff || 0);
  const L = C.lv[3][1] + 2, c = 'c' + ch;
  if (i === 0) addInv(makeItem(c + ({ 4: 'ear2', 5: 'inner2', 6: 'legs3', 7: 'cloak3' }[ch] || 'ear2'), 2, L, { id: 1, st: 0 })); if (i === 1) addInv(makeItem(c + 'boots2', 2, L + 1, { id: 1, st: 1 })); if (i === 2) addInv(makeItem(c + 'ring4', 2, L + 1, { id: 1, st: 0 }));
  if (i === 3) { addInv(goods('bhone')); addInv(goods('bglue')); } if (i === 4) { if (ch === 7) addInv(goods('chart', 2)); addInv(makeItem(c + 'sail4', 2, C.blv, { id: 1, st: 1 })); addInv(goods('bhone', 2)); addInv(goods('bglue', 2)); }
  return R; }
function trackX(id, q) { const ch = qCh(id), C = CHX[ch]; if (!C) return null; const i = C.qid.indexOf(id);
  return [C.n + ' 밑것 ' + q.n + '/20', C.bg[1] + ' ' + Math.min(4, count(C.bg[0])) + '/4 → ' + C.isl[2] + ' 동쪽 끊긴 다리', C.mn.d + ' ' + q.n + '/12', C.sg[1] + ' ' + Math.min(5, count(C.sg[0])) + '/5', C.hill + '의 ' + C.mn.boss][i]; }
function spawnChX() { const Wd = G.Wd, C = CHX[Wd.ch], M = C.m, L = [...Wd.fi, ...Wd.ci]; for (const k in M) lazyImg(M[k]);
  L.forEach((k, i) => { const s = Wd.islands[k], n = i >= 4 ? 5 : 4;
    for (let j = 0; j < n; j++) { const a = j / n * TAU + i * 1.1, d = s.r * .5; let x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d; if (!walk(Wd, x, y)) { x = s.cx; y = s.cy; }
      const kind = pick([[M.a], [M.a, M.b], [M.c], [M.d], [M.d, M.a], [M.b]]);
      const pk = j === 0 ? { isl: k, x, y, lv: s.lv, kinds: [M.a, M.b, M.a], n: 6, lead: M.k, nest: 1, elite: ri(1, ELITE.length) }
        : { isl: k, x, y, lv: s.lv, kinds: kind, n: kind[0] === M.c ? 3 : kind[0] === M.d ? ri(2, 3) : ri(3, 5), elite: Math.random() < .28 ? ri(1, ELITE.length) : 0 };
      G.packs.push(pk); spawnPack(pk); } });
  const H = Wd.islands[Wd.hill];
  if (Wd.ch === 8 ? !G.P.roam.boss : !G.P.flags[M.boss]) { const pk = { isl: Wd.hill, x: H.cx + 1, y: H.cy - 1, lv: [C.blv, C.blv], kinds: [M.boss], n: 1, boss: 1, nest: 1 }; G.packs.push(pk); spawnPack(pk); if (Wd.ch === 8) for (const m of pk.mobs) roamBossScale(m); }
  for (const [ox, oy, kinds] of [[-4, 3, [M.d, M.a]], [3.5, 3.5, [M.b, M.c]]]) { const pk = { isl: Wd.hill, x: H.cx + ox, y: H.cy + oy, lv: C.hlv, kinds, n: 3 }; G.packs.push(pk); spawnPack(pk); } }
function chXKill(m) { const P = G.P, ch = G.Wd.ch, C = CHX[ch]; if (!C) return; if (ch === 8) return roamKill(m); const M = C.m, I = C.qid;
  if ([M.a, M.b, M.c, M.d, M.k].includes(m.t)) qAdd(I[0], 1); if (m.t === M.d) qAdd(I[2], 1);
  if (m.t === M.k && P.q[I[1]] && P.q[I[1]].s === 1 && count(C.bg[0]) + G.drops.filter(d => d.it && d.it.g === C.bg[0]).length < 4) { G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods(C.bg[0]), t: 0 }); say(C.bg[1] + '을(를) 떨궜어요!', '#ffe08a', 1); }
  if ((m.t === M.a || m.t === M.b) && P.q[I[3]] && P.q[I[3]].s === 1 && count(C.sg[0]) + G.drops.filter(d => d.it && d.it.g === C.sg[0]).length < 5 && Math.random() < .2) G.drops.push({ x: m.x + rnd(-.4, .4), y: m.y + rnd(-.4, .4), it: goods(C.sg[0]), t: 0 });
  if (m.D.chboss) { P.flags[M.boss] = 1; if (P.q[I[4]] && P.q[I[4]].s === 1) qSet(I[4], 2); G.shake = 14; G.flash = .4; say(C.mn.boss + '을(를) 쓰러뜨렸어요! ' + C.hill + ' 바람개비 표지에 손을 얹어 보세요.', '#ffd166'); } }
function chXDrops(m, put) { const ch = m.D.chboss, C = CHX[ch]; put(chUniq(ch, C.blv)); const sp = pick(SETS[C.set[0]].parts); put(makeItem(sp[0], 4, C.blv, { set: C.set[0] })); put(goods('bhone')); put(goods('bglue')); }
// 장 보스: 장마다 고른 공격 묶음(줄 솟구치기·여기저기 떨구기·둘레 쓸기·부르기·사방 칼날·둘러싸기)
function chXBossAI(m, dt, d, dx, dy) { const ch = m.D.chboss, C = CHX[ch], B = C.boss, P = G.P, rage = m.hp < m.mhp * .5, sp2 = rage ? 1.35 : 1;
  if (rage && !m.raged) { m.raged = 1; G.cut = { s: C.mn.boss + '이(가) 성이 났어요!', t: 0, c: B.col }; sfx('slam'); G.shake = 8; }
  const pat = Object.assign({}, B.pat, rage ? B.rage : {}), T = m.T || (m.T = {}); for (const k in pat) if (pat[k]) T[k] = (T[k] ?? pat[k] * .5) - dt * sp2;
  const go = k => pat[k] && T[k] <= 0 && (T[k] = pat[k] * rnd(.85, 1.15), 1);
  if (go('summon')) { const ng = G.mobs.filter(o => o.t === B.sum && !o.dead && hyp(o.x - m.x, o.y - m.y) < 9).length; if (ng < 5) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, x2 = m.x + Math.cos(a) * 2.2, y2 = m.y + Math.sin(a) * 2.2; if (walk(G.Wd, x2, y2)) { const n = mkMob(B.sum, x2, y2, C.hlv[1]); n.st = 'chase'; G.mobs.push(n); } }
    G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 2.4, t: 0, life: .5, c: B.col }); say(`${C.mn.boss}이(가) ${MOBDEF[B.sum].n}을(를) 불러냈어요!`, B.col, 1); }
  if (d < 10 && go('cage')) { m.an = 'atk'; m.at = 0; m.hitDone = 1; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; shipBlast(m, P.x + Math.cos(a) * 2.3, P.y + Math.sin(a) * 2.3, 1.05, 1.1, .8, B.col); } say('둘레가 막혀요! 한가운데에 서 있어요', B.col, 1); return; }
  if (go('blades')) { m.ang = (m.ang || 0) + .4; for (let i = 0; i < 8; i++) { const a = m.ang + i / 8 * TAU; G.areas.push({ k: 'blade', x: m.x, y: m.y, vx: Math.cos(a) * 4.4, vy: Math.sin(a) * 4.4, t: 0, life: 2.3, dmg: rnd(m.dmg[0], m.dmg[1]) * .5, src: m }); } sfx('gust'); }
  if (d < 9 && go('volley')) { m.an = 'atk'; m.at = 0; m.hitDone = 1; sfx('cone'); const n = rage ? 7 : 5; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = i === 0 ? 0 : rnd(1.2, 3); shipBlast(m, P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, .95, 1 + i * .08, .6, B.col); } return; }
  if (d > 1.5 && d < 9 && go('line')) { const ux = dx / d, uy = dy / d; m.an = 'atk'; m.at = 0; m.hitDone = 1; sfx('slam'); for (let i = 0; i < 7; i++) shipBlast(m, m.x + ux * (i * 1.4 + 1.2), m.y + uy * (i * 1.4 + 1.2), 1.05, .8 + i * .12, .75, B.col); return; }
  if (d < 3.4 && go('sweep')) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.kind = 'sweep'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 3.1, t: 0, life: .8 }); return; }
  const sp = m.spd * (rage ? 1.15 : 1);
  if (B.fly) { if (d > 4.5) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; } else if (d < 2.2 && m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = rage ? 2 : 2.8; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 2.4, t: 0, life: .8 }); } else { const s = (m.orb = (m.orb || 1)); move(m, -dy / d * sp * .6 * s * dt, dx / d * sp * .6 * s * dt); if (Math.random() < dt * .25) m.orb = -s; m.an = 'move'; } return; }
  if (d > m.r + 1) { move(m, dx / d * sp * dt, dy / d * sp * dt); m.an = 'move'; }
  else if (m.cd <= 0) { m.an = 'atk'; m.at = 0; m.hitDone = 0; m.cd = rage ? 1.9 : 2.6; m.kind = 'slam'; G.areas.push({ k: 'warn', x: m.x, y: m.y, r: 2.4, t: 0, life: .8 }); }
  else m.an = 'idle'; }
function chXGoals(Wd, P, goals) { if (Wd.ch === 8) { if (!P.roam.boss) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); } return; } const C = CHX[Wd.ch], I = C.qid, q = P.q, bq = Wd.bridges[Wd.bq];
  if (q[I[1]] && q[I[1]].s === 1) { const i = bq.cells[bq.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
  if (q[I[4]] && q[I[4]].s === 1) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); }
  if (q[I[4]] && q[I[4]].s === 2 && !P.flags[wpk(C.hill)]) goals.push([Wd.wps[2].x, Wd.wps[2].y]); }
function endHtmlX() { const P = G.P, C = CHX[G.Wd.ch], last = G.Wd.ch === 7;
  return `<div class="sk-bx sk-talk" style="text-align:center"><h3>${C.end[0]}</h3><p>${C.end[1]}</p><p>${C.end[2]}</p><p style="font-size:13px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>${last ? '끝까지 함께해 줘서 고마워요! 이제 바람개비 표지에서 난이도 「먹구름」과 떠도는 섬(항로 지도 2장을 드렸어요)을 열 수 있어요.' : '바람개비 표지(이동)의 「바람길」에서 ' + (G.Wd.ch + 1) + '장 ' + CHX[G.Wd.ch + 1].n + '(으)로 건너갈 수 있어요.'}</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }
// 바람길 줄: 앞 장 보스 의뢰를 끝내면 다음 장이 열림
CHAPS[4] = ['4장 · 거꾸로 숲', '바람길을 타고 건너가요 (34~44레벨)', P => P.q.q17 && P.q.q17.s === 3];
CHAPS[5] = ['5장 · 번개 둥지', '바람길을 타고 건너가요 (43~52레벨)', P => P.q.q22 && P.q.q22.s === 3];
CHAPS[6] = ['6장 · 가라앉는 옛 도읍', '바람길을 타고 건너가요 (51~59레벨)', P => P.q.q27 && P.q.q27.s === 3];
CHAPS[7] = ['7장 · 첫바람 언덕', '바람길을 타고 건너가요 (58~66레벨)', P => P.q.q32 && P.q.q32.s === 3];
