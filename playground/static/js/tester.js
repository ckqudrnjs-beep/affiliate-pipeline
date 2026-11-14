/* 5락실 테스터 전용 체험판 공통 확인 (BK 11/14)
   사용: <script src="/js/tester.js"></script> 후 await window.nrTester() → true/false
   기준: 관리자 페이지에서 테스터로 지정한 프로필(nr_pcode). 서버: POST /api/profile {a:"tester",code} → {tester}
   결과는 KST 하루 동안 이 기기에 캐시('nr_tester'). localhost 는 항상 통과(개발용). */
(function(){
  const lsg=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lss=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  const day=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
  window.nrTester=async function(){
    if(/^(localhost|127\.)/.test(location.hostname))return true;
    const code=lsg('nr_pcode');if(!code)return false;
    const c=lsg('nr_tester'),k=day()+'|'+code+'|';if(c===k+'1')return true;if(c===k+'0')return false;
    try{const j=await (await fetch('/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({a:'tester',code})})).json();lss('nr_tester',k+(j.tester?'1':'0'));return !!j.tester}catch(e){return false}
  };
  window.nrTesterMsg='🧪 지금은 <b>테스터 전용 체험판</b>이에요. 테스터로 지정된 프로필이 있는 기기에서만 열려요. 곧 모두에게 열릴 예정이에요!';
})();
