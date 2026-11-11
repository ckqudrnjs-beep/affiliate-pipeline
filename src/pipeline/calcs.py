"""생활 계산기 페이지 (사이트의 중심, 2026-11-08). 계산은 브라우저 JS, 값은 주소(?a=..)에 담겨 공유된다.

요금 기준은 근사치다: 한전 주택용 저압 기타계절(11월 기준) 누진 3단계, 기후환경요금 9원/kWh,
연료비조정 5원/kWh, 부가세 10%, 전력기금 2.7%. 실제 고지서와 다를 수 있다고 화면에 밝힌다.
"""
from __future__ import annotations

COMMON_JS = r"""
const $=s=>document.querySelector(s);
const fmt=n=>Math.round(n).toLocaleString('ko-KR')+'원';
// 한전 주택용 저압, 기타계절 근사
function bill(kwh){kwh=Math.max(0,kwh);
 const t=[[200,910,120.0],[400,1600,214.6],[1e9,7300,307.3]];let e=0,prev=0,base=910;
 for(const [lim,b,r] of t){if(kwh>prev){base=b;e+=(Math.min(kwh,lim)-prev)*r;}prev=lim;}
 const sub=base+e+kwh*9+kwh*5;return Math.floor((sub+Math.floor(sub*0.1/10)*10+Math.floor(sub*0.027/10)*10)/10)*10;}
function readQS(ids){const q=new URLSearchParams(location.search);ids.forEach(i=>{if(q.has(i))$('#'+i).value=q.get(i)});}
function shareURL(ids){const q=new URLSearchParams();ids.forEach(i=>q.set(i,$('#'+i).value));return location.origin+location.pathname+'?'+q;}
function bindShare(ids){$('#share').addEventListener('click',async()=>{const u=shareURL(ids);
 try{await navigator.clipboard.writeText(u);$('#shareMsg').textContent='링크를 복사했어요. 카톡이나 스레드에 붙여 넣으세요.';}
 catch(e){$('#shareMsg').textContent=u;}});}
"""

CALCS = [
    {
        "slug": "electric",
        "title": "가전 전기요금 계산기 (누진제 반영)",
        "h1": "이 가전, 한 달 전기요금 얼마 늘까?",
        "lede": "소비전력과 사용 시간만 넣으면 됩니다. 누진제 때문에 같은 가전이라도 집마다 늘어나는 요금이 다릅니다.",
        "form": """
<label>소비전력 (W)<input id="w" type="number" inputmode="numeric" value="300" min="0"></label>
<label>하루 사용 시간<input id="h" type="number" inputmode="decimal" value="8" min="0" max="24" step="0.5"></label>
<label>한 달 사용 일수<input id="d" type="number" inputmode="numeric" value="30" min="0" max="31"></label>
<label>우리 집 평소 월 사용량 (kWh, 고지서)<input id="base" type="number" inputmode="numeric" value="300" min="0"></label>""",
        "ids": ["w", "h", "d", "base"],
        "js": """
function run(){const add=$('#w').value*$('#h').value*$('#d').value/1000, base=+$('#base').value;
 const before=bill(base), after=bill(base+add), diff=after-before;
 $('#out').innerHTML=`<div><span>이 가전 사용량</span><span>${add.toFixed(1)} kWh</span></div>
 <div><span>평소 요금</span><span>${fmt(before)}</span></div><div><span>가전 추가 후</span><span>${fmt(after)}</span></div>
 <div class="sum"><span>한 달 늘어나는 요금</span><span>${fmt(diff)}</span></div>
 <div><span>1kWh당 실제 단가</span><span>${add>0?fmt(diff/add):'-'}</span></div>`;
 const avg=300, pct=Math.round((base-avg)/avg*100);
 $('#cmp').textContent= Math.abs(pct)<5?`우리 집 사용량은 가구 평균(약 ${avg}kWh)과 비슷해요. 이미 200kWh를 넘어서 이 가전 전기는 1kWh에 214.6원 이상 구간에서 계산됩니다.`: pct>=0?`우리 집 사용량은 가구 평균(약 ${avg}kWh)보다 ${pct}% 많아요. 200·400kWh를 넘는 순간 단가가 뛰어서, 같은 가전도 더 비싸게 듭니다.`
  :`우리 집 사용량은 가구 평균(약 ${avg}kWh)보다 ${-pct}% 적어요. 200kWh 안쪽이면 가장 싼 단가 구간이에요.`;}""",
        "body": """<h2>삼촌의 설명</h2>
<p>전기요금은 쓴 만큼 똑같이 오르지 않습니다. 한 달 200kWh까지는 1kWh에 120원이지만, 200kWh를 넘는 부분은 214.6원, 400kWh를 넘는 부분은 307.3원입니다. 그래서 평소 350kWh를 쓰는 집에 가습기를 들이면, 가습기가 쓰는 전기는 214.6원 구간에서 계산되고 450kWh를 넘기면 307.3원 구간으로 넘어갑니다.</p>
<p>소비전력은 제품 뒷면 스티커나 상세페이지의 "정격 소비전력"을 보세요. 최대값이 적혀 있으니 실제 요금은 보통 계산보다 조금 적게 나옵니다.</p>""",
        "category": "humidify",
    },
    {
        "slug": "aliexpress",
        "title": "알리 직구 실제가 계산기 (관세·부가세 포함)",
        "h1": "알리에서 사면 진짜 얼마일까?",
        "lede": "상품가와 배송비를 넣으면 면세 한도를 넘는지, 넘으면 세금이 얼마인지 계산해서 국내가와 비교합니다.",
        "form": """
<label>알리 상품가 (원, 수량 포함)<input id="p" type="number" inputmode="numeric" value="180000" min="0"></label>
<label>배송비 (원)<input id="s" type="number" inputmode="numeric" value="0" min="0"></label>
<label>달러 환율 (원)<input id="fx" type="number" inputmode="numeric" value="1400" min="1"></label>
<label>관세율 (%)<input id="duty" type="number" inputmode="decimal" value="8" min="0" step="0.5"></label>
<label>국내 최저가 (원, 쿠팡 등)<input id="kr" type="number" inputmode="numeric" value="259000" min="0"></label>""",
        "ids": ["p", "s", "fx", "duty", "kr"],
        "js": """
function run(){const p=+$('#p').value,s=+$('#s').value,fx=+$('#fx').value,r=$('#duty').value/100,kr=+$('#kr').value;
 const usd=p/fx, over=usd>150; let tax=0;
 if(over){const cv=p+s, d=Math.floor(cv*r), vat=Math.floor((cv+d)*0.1); tax=d+vat;}
 const total=p+s+tax, diff=kr-total;
 $('#out').innerHTML=`<div><span>상품가 (달러 환산)</span><span>$${usd.toFixed(0)}</span></div>
 <div><span>면세 한도 $150</span><span>${over?'넘음':'안 넘음'}</span></div>
 <div><span>관세 + 부가세</span><span>${fmt(tax)}</span></div>
 <div class="sum"><span>알리 실제가</span><span>${fmt(total)}</span></div>
 <div><span>국내가와 차이</span><span>${diff>=0?fmt(diff)+' 쌈':fmt(-diff)+' 비쌈'}</span></div>`;
 $('#cmp').textContent= over?`면세 한도를 $${(usd-150).toFixed(0)} 넘었어요. 세금 ${fmt(tax)}이 붙어서 차액이 줄었습니다.`
  : usd>130?`면세 한도까지 $${(150-usd).toFixed(0)} 남았어요. 같은 날 도착하는 다른 주문과 합쳐지면 세금이 붙을 수 있어요.`
  :'면세 한도 안이에요. 세금 없이 상품가와 배송비만 내면 됩니다.';}""",
        "body": """<h2>삼촌의 설명</h2>
<p>해외에서 개인이 쓸 물건을 살 때는 물품가격이 미화 150달러(미국 발송은 200달러) 이하면 관세와 부가세가 면제됩니다. 넘으면 상품가와 배송비를 더한 금액에 관세(품목마다 다르고 보통 8% 안팎)가 붙고, 거기에 다시 부가세 10%가 붙습니다.</p>
<p>주의할 점은 합산과세입니다. 같은 날 한국에 도착한 물건은 따로 주문했어도 합쳐서 한도를 따질 수 있습니다. 환율이 오르면 같은 원화 가격도 달러로는 한도에 더 가까워집니다. 정확한 관세율은 관세청 "관세율 조회"에서 품목별로 확인하세요.</p>""",
        "category": "",
    },
    {
        "slug": "heater",
        "title": "겨울 난방기기 전기요금 비교 계산기",
        "h1": "전기요 vs 온풍기 vs 라디에이터, 한 달에 얼마?",
        "lede": "자주 쓰는 전기 난방기기 세 가지를 같은 조건으로 놓고, 우리 집 누진 구간에서 한 달 요금을 비교합니다.",
        "form": """
<label>하루 사용 시간<input id="h" type="number" inputmode="decimal" value="8" min="0" max="24" step="0.5"></label>
<label>한 달 사용 일수<input id="d" type="number" inputmode="numeric" value="30" min="0" max="31"></label>
<label>우리 집 평소 월 사용량 (kWh)<input id="base" type="number" inputmode="numeric" value="300" min="0"></label>
<label>전기요 (W)<input id="w1" type="number" inputmode="numeric" value="100" min="0"></label>
<label>온풍기 (W)<input id="w2" type="number" inputmode="numeric" value="2000" min="0"></label>
<label>라디에이터 (W, 평균)<input id="w3" type="number" inputmode="numeric" value="1000" min="0"></label>""",
        "ids": ["h", "d", "base", "w1", "w2", "w3"],
        "js": """
function run(){const hd=$('#h').value*$('#d').value/1000, base=+$('#base').value, b0=bill(base);
 const rows=[['전기요',+$('#w1').value],['온풍기',+$('#w2').value],['라디에이터',+$('#w3').value]].map(([n,w])=>[n,bill(base+w*hd)-b0,w*hd]);
 $('#out').innerHTML=rows.map(([n,c,k])=>`<div><span>${n} (${k.toFixed(0)} kWh)</span><span>${fmt(c)}</span></div>`).join('');
 const lo=rows.reduce((a,b)=>a[1]<b[1]?a:b), hi=rows.reduce((a,b)=>a[1]>b[1]?a:b);
 $('#cmp').textContent=`${hi[0]} 대신 ${lo[0]}를 쓰면 한 달 ${fmt(hi[1]-lo[1])} 아낍니다. 온풍기는 방 공기를, 전기요는 몸 닿는 곳만 데운다는 차이가 있어요.`;}""",
        "body": """<h2>삼촌의 설명</h2>
<p>전기 난방기기 요금은 소비전력이 거의 전부를 정합니다. 전기요는 100W 안팎이라 밤새 켜도 부담이 적지만, 온풍기는 2,000W 안팎이라 한 시간에 전기요 스무 시간 분량을 씁니다. 라디에이터는 온도에 도달하면 꺼졌다 켜지기를 반복해서 실제 평균은 최대 소비전력의 절반 정도로 잡았습니다.</p>
<p>난방기기는 누진 구간을 넘기기 쉬운 가전입니다. 겨울에 사용량이 400kWh를 넘기면 넘는 부분은 1kWh에 307원이 됩니다. 전기 안전을 위해 KC 인증 제품을 쓰고, 멀티탭 하나에 여러 난방기기를 꽂지 마세요.</p>""",
        "category": "heat",
    },
    {
        "slug": "standby",
        "title": "대기전력 전기요금 계산기 (꽂아만 둔 가전)",
        "h1": "꽂아만 둔 가전, 1년에 얼마 샐까?",
        "lede": "끄고 꽂아 둔 가전의 대기전력을 넣으면, 우리 집 누진 구간에서 한 달·1년 요금이 얼마인지 계산합니다.",
        "form": """
<label>가전 1 대기전력 (W, 예: 셋톱박스)<input id="a" type="number" inputmode="decimal" value="10" min="0" step="0.1"></label>
<label>가전 2 대기전력 (W, 예: 컴퓨터·모니터)<input id="b" type="number" inputmode="decimal" value="3" min="0" step="0.1"></label>
<label>가전 3 대기전력 (W, 예: 꽂아 둔 충전기 여러 개)<input id="c" type="number" inputmode="decimal" value="2" min="0" step="0.1"></label>
<label>하루에 꺼져 있는 시간<input id="off" type="number" inputmode="decimal" value="20" min="0" max="24" step="0.5"></label>
<label>우리 집 평소 월 사용량 (kWh, 고지서)<input id="base" type="number" inputmode="numeric" value="300" min="0"></label>""",
        "ids": ["a", "b", "c", "off", "base"],
        "js": """
function run(){const w=(+$('#a').value)+(+$('#b').value)+(+$('#c').value), kwh=w*$('#off').value*30/1000, base=+$('#base').value;
 const month=bill(base)-bill(Math.max(0,base-kwh)), year=month*12;
 $('#out').innerHTML=`<div><span>대기전력 합계</span><span>${w.toFixed(1)} W</span></div>
 <div><span>한 달 대기 사용량</span><span>${kwh.toFixed(1)} kWh</span></div>
 <div><span>한 달 대기 요금</span><span>${fmt(month)}</span></div>
 <div class="sum"><span>1년이면</span><span>${fmt(year)}</span></div>`;
 $('#cmp').textContent= base>200&&base-kwh<=200?`대기전력만 줄여도 첫 구간(200kWh 이하)으로 내려갈 수 있어요. 그러면 전체 단가가 낮아집니다.`
  : w>=10?`대기전력 ${w.toFixed(0)}W는 전구 하나를 1년 내내 켜 둔 것과 비슷한 수준이에요. 개별 스위치 멀티탭으로 끄면 이만큼 아낍니다.`
  :'대기전력이 크지 않은 편이에요. 오래 안 쓰는 가전만 플러그를 뽑아도 충분합니다.';}""",
        "body": """<h2>삼촌의 설명</h2>
<p>대기전력은 가전을 껐는데도 플러그가 꽂혀 있어서 새는 전기입니다. 리모컨 신호를 기다리는 TV·셋톱박스, 시계가 켜진 전자레인지, 꽂아 둔 충전기가 대표적이에요. 한 대에 몇 와트라 작아 보여도 하루 20시간, 1년 내내 새기 때문에 합치면 눈에 띕니다.</p>
<p>대기전력은 제품마다 크게 달라서 직접 재 보는 게 가장 정확합니다. 전력량을 보여 주는 스마트 플러그나 전력 측정기를 콘센트와 가전 사이에 끼우고, 가전을 끈 상태의 숫자를 적어 넣으세요. 측정기가 없으면 제품 설명서의 '대기전력' 항목을 보면 됩니다. 위에 들어 있는 값은 계산을 보여 주기 위한 예시입니다.</p>
<p>누진제 때문에 같은 1kWh라도 집마다 값이 다릅니다. 이 계산기는 평소 사용량에서 대기전력만큼을 뺐을 때 요금이 얼마나 줄어드는지로 계산합니다.</p>""",
        "category": "living",
    },
    {
        "slug": "humidifier",
        "title": "가습기 종류별 전기요금 비교 계산기",
        "h1": "초음파 vs 가열식 vs 복합식, 가습기 전기요금은?",
        "lede": "가습기는 방식에 따라 소비전력이 열 배 넘게 차이 납니다. 우리 집 누진 구간에서 한 달 요금을 나란히 비교합니다.",
        "form": """
<label>하루 사용 시간<input id="h" type="number" inputmode="decimal" value="10" min="0" max="24" step="0.5"></label>
<label>한 달 사용 일수<input id="d" type="number" inputmode="numeric" value="30" min="0" max="31"></label>
<label>우리 집 평소 월 사용량 (kWh)<input id="base" type="number" inputmode="numeric" value="300" min="0"></label>
<label>초음파식 (W)<input id="w1" type="number" inputmode="numeric" value="30" min="0"></label>
<label>가열식 (W)<input id="w2" type="number" inputmode="numeric" value="300" min="0"></label>
<label>복합식 (W, 평균)<input id="w3" type="number" inputmode="numeric" value="120" min="0"></label>""",
        "ids": ["h", "d", "base", "w1", "w2", "w3"],
        "js": """
function run(){const hd=$('#h').value*$('#d').value/1000, base=+$('#base').value, b0=bill(base);
 const rows=[['초음파식',+$('#w1').value],['가열식',+$('#w2').value],['복합식',+$('#w3').value]].map(([n,w])=>[n,bill(base+w*hd)-b0,w*hd]);
 $('#out').innerHTML=rows.map(([n,c,k])=>`<div><span>${n} (${k.toFixed(0)} kWh)</span><span>${fmt(c)}</span></div>`).join('');
 const lo=rows.reduce((a,b)=>a[1]<b[1]?a:b), hi=rows.reduce((a,b)=>a[1]>b[1]?a:b);
 $('#cmp').textContent=`${hi[0]} 대신 ${lo[0]}을 쓰면 한 달 ${fmt(hi[1]-lo[1])} 덜 냅니다. 대신 방식마다 세척 방법과 소음이 달라요.`;}""",
        "body": """<h2>삼촌의 설명</h2>
<p>가습기 전기요금은 물을 어떻게 수증기로 만드느냐에 달려 있습니다. 초음파식은 진동으로 물을 잘게 쪼개서 소비전력이 수십 와트 수준이고, 가열식은 물을 끓여서 수백 와트를 씁니다. 복합식은 물을 살짝 데운 뒤 초음파로 뿜는 방식이라 그 중간이에요.</p>
<p>위에 들어 있는 소비전력은 계산을 보여 주기 위한 예시입니다. 가지고 있거나 보고 있는 제품의 상세페이지에서 '정격 소비전력'을 찾아 바꿔 넣으세요. 가열식은 물이 끓기 시작한 뒤에는 전력을 조금 덜 쓰는 제품도 있어서 실제 요금은 계산보다 적을 수 있습니다.</p>
<p>요금만 보면 초음파식이 가장 싸지만, 물통과 진동판을 자주 씻어야 하고 수돗물 속 성분이 하얀 가루로 내려앉을 수 있습니다. 가열식은 요금이 더 나오는 대신 끓인 수증기를 내보냅니다. 겨울 내내 켜 둘 가습기라면 요금과 관리 시간을 같이 따져 보세요.</p>""",
        "category": "humidify",
    },
]

CALC_CSS = """
.calc{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start;margin-top:16px}
@media (max-width:680px){.calc{grid-template-columns:minmax(0,1fr)}}
.calc form{display:grid;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:var(--shadow)}
.calc label{display:grid;gap:4px;font-size:14px;color:var(--muted)}
.calc input{font:16px var(--mono);padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);width:100%}
.calc input:focus-visible{outline:2px solid var(--green);outline-offset:1px}
.cmp{font-weight:600;color:var(--green);margin:10px 0 0;max-width:62ch}
#share{margin-top:14px;font:700 15px var(--body);padding:12px 20px;border-radius:12px;border:0;background:var(--coin);color:var(--coin-ink);cursor:pointer}
#share:focus-visible{outline:3px solid var(--coin);outline-offset:2px}
.tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:16px}
.tool{display:flex;flex-direction:column;gap:8px;padding:22px;border-radius:18px;background:var(--card);border:1px solid var(--line);color:var(--ink);text-decoration:none;box-shadow:var(--shadow);transition:transform .15s,border-color .15s}
.tool:hover,.tool:focus-visible{border-color:var(--green);transform:translateY(-2px);outline:none}
.tool i{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:var(--greenbg);color:var(--green)}
.tool b{font:22px/1.3 var(--display);font-weight:400}
.tool span{font-size:14px;color:var(--muted);line-height:1.6}
.tool u{text-decoration:none;font-weight:700;color:var(--green);font-size:15px;margin-top:auto}
@media (prefers-reduced-motion:reduce){.tool{transition:none}.tool:hover{transform:none}}
"""
