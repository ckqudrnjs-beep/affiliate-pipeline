/* 5락실 테스터 전용 체험판 공통 확인 (BK 11/14)
   사용: <script src="/js/tester.js"></script> 후 await window.nrTester() → true/false
   통과: ① 관리자 페이지에서 테스터로 지정한 프로필(nr_pcode)  ② 개발자 = 이 기기에서 /admin 에 로그인한 적 있음(nr_dev 토큰)
   서버: POST /api/profile {a:"tester",code} → {tester} / {a:"dev",t} → {dev}
   캐시('nr_tester'): 통과는 KST 하루, 불통과는 10분(방금 테스터로 지정돼도 곧 열리게). localhost 는 항상 통과(개발용). */
(function(){
  const lsg=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lss=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  const day=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
  const ask=async b=>{try{return await (await fetch('/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})).json()}catch(e){return {}}};
  let busy=null;
  async function check(){
    if(/^(localhost|127\.)/.test(location.hostname))return true;
    const code=lsg('nr_pcode')||'',dev=lsg('nr_dev')||'';if(!code&&!dev)return false;
    const id=day()+'|'+code+'|'+dev.slice(0,8)+'|',c=lsg('nr_tester')||'';
    if(c===id+'1')return true;
    if(c.startsWith(id+'0|')&&Date.now()-(+c.slice(id.length+2))<6e5)return false;
    let ok=false;
    if(dev)ok=!!(await ask({a:'dev',t:dev})).dev;
    if(!ok&&code)ok=!!(await ask({a:'tester',code})).tester;
    lss('nr_tester',id+(ok?'1':'0|'+Date.now()));return ok;
  }
  window.nrTester=()=>busy||(busy=check().finally(()=>{busy=null}));
  window.nrTesterMsg='🧪 지금은 <b>테스터 전용 체험판</b>이에요. 테스터로 지정된 프로필이나 개발자(관리자 로그인한 기기)만 열 수 있어요. 곧 모두에게 열릴 예정이에요!';
})();
