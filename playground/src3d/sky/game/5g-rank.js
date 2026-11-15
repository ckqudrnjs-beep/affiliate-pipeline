/* ---------- 순위 (2026-11-15 BK): 최고 레벨 · 엔딩 시간 · 가장 높은 난이도 엔딩 · 떠도는 섬 보스(난이도별), 한글/영문/전체 ---------- */
// 순위는 서버에 저장된 캐릭터(5락실 프로필·복구 코드)만. 서버가 저장 기록에서 뽑고, 말이 안 되는 기록은 뺀다(functions/api/skyrank.js).
const RK = { k: 'lv', d: 0, lang: 'all', list: null, busy: 0, err: '', nm: '', code: '' };
const RKCLS = () => ({ warden: CLASSES.warden.name, drifter: CLASSES.drifter.name, windcaller: CLASSES.windcaller.name, trapper: CLASSES.trapper.name, ringer: CLASSES.ringer.name });
function rkLoad() { RK.busy = 1; RK.list = null; RK.err = '';
  fetch(`/api/skyrank?k=${RK.k}&d=${RK.d}&lang=${RK.lang}`).then(r => r.json()).then(j => { RK.list = j.list || []; }).catch(() => { RK.err = '순위를 불러오지 못했어요'; }).finally(() => { RK.busy = 0; if (PANEL === 'rank') render(); }); }
const rkTime = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h + ':' + String(m).padStart(2, '0'); };
const rkAt = t => { const d = new Date(t + 9 * 36e5).toISOString(); return d.slice(5, 10) + ' ' + d.slice(11, 16); };
function rankHtml(X) { const P = G.P, cl = RKCLS();
  const tab = (k, n) => `<button class="sk-b${RK.k === k ? ' p' : ''}" data-a="rk" data-k="${k}">${n}</button>`;
  const lg = (l, n) => `<button class="sk-b${RK.lang === l ? ' g' : ''}" data-a="rkl" data-l="${l}" style="padding:4px 9px">${n}</button>`;
  let h = `<div class="sk-bx sk-fit" style="max-width:640px">${X}<h3>🏆 순위 <small style="font-size:12px;color:#8a7458">같은 기록이면 먼저 한 사람이 위</small></h3><div class="sk-two" style="grid-template-columns:1fr"><div>`;
  h += `<div style="margin:-3px -3px 2px">${tab('lv', '최고 레벨')}${tab('end', '엔딩 시간')}${tab('dmax', '최고 난이도')}${tab('boss', '떠도는 섬 보스')}</div>`;
  h += `<div style="margin:0 -3px 4px">${lg('all', '전체')}${lg('ko', '한국어')}${lg('en', 'English')}${RK.k === 'boss' ? ' · ' + DIFFT.map((d, i) => `<button class="sk-b${RK.d === i ? ' g' : ''}" data-a="rkd" data-i="${i}" style="padding:4px 8px">${d.n}</button>`).join('') : ''}</div>`;
  if (RK.list == null && !RK.busy && !RK.err) rkLoad();
  if (RK.err) h += `<p class="m">${RK.err}</p>`; else if (!RK.list) h += '<p class="m">불러오는 중…</p>';
  else if (!RK.list.length) h += '<p class="m">아직 기록이 없어요. 첫 번째가 되어 보세요!</p>';
  else h += '<div class="sk-card" style="padding:4px 10px">' + RK.list.map((r, i) => { const v = RK.k === 'lv' ? lvT(r.v) : RK.k === 'end' ? rkTime(r.v) : RK.k === 'dmax' ? DIFFT[r.v] ? DIFFT[r.v].n : r.v : r.v + '마리';
    return `<div class="sk-row"><b style="width:26px;color:${i < 3 ? '#d8a800' : '#8a7458'}">${i + 1}</b><div class="f">${esc(r.nick)} <small>${cl[r.cls] || ''} · ${lvT(r.lv)}${r.lang === 'en' ? ' · EN' : ''}</small></div><b>${v}</b>${RK.k === 'lv' || RK.k === 'dmax' ? `<small style="margin-left:6px">${rkAt(r.at)}</small>` : ''}</div>`; }).join('') + '</div>';
  // 내 순위 참가
  let code = ''; try { code = localStorage.getItem('nr_pcode') || ''; } catch (e) {}
  if (code) h += `<p class="m" style="font-size:11.5px">내 캐릭터는 서버에 저장될 때(1분쯤마다) 순위에 반영돼요. 엔딩 시간은 보통 난이도 첫 엔딩까지의 플레이 시간이에요.</p>`;
  else h += `<h4>순위에 참가하기</h4><p class="m" style="font-size:11.5px">이름을 정하면 5락실 프로필(복구 코드)이 만들어지고, 이 캐릭터가 서버에 저장돼 순위에 올라가요. 이메일·가입 없음.</p><div class="sk-row"><input id="sk-rknm" maxlength="10" placeholder="이름 (한글·영문·숫자 2~10자)" value="${esc(RK.nm)}" style="flex:1;min-width:0;border-radius:9px;border:2px solid #d8c8a8;padding:6px 8px;font:inherit"><button class="sk-b p" data-a="rkjoin" ${RK.busy ? 'disabled' : ''}>참가</button></div>`;
  if (RK.code) h += `<div class="sk-card" style="border-color:#e8b05a;background:#fff6e4">복구 코드: <b style="font-size:16px;letter-spacing:1px">${RK.code}</b><br><small>다른 기기에서 이어 하려면 이 코드가 필요해요. 꼭 적어 두세요!</small></div>`;
  return h + '</div></div>' + TOAST + '</div>'; }
function rkAct(a, t) {
  if (a === 'rk') { RK.k = t.dataset.k; RK.list = null; render(); return true; }
  if (a === 'rkl') { RK.lang = t.dataset.l; RK.list = null; render(); return true; }
  if (a === 'rkd') { RK.d = +t.dataset.i; RK.list = null; render(); return true; }
  if (a === 'rkjoin') { const inp = panel.querySelector('#sk-rknm'), nm = (inp && inp.value || '').trim(); RK.nm = nm;
    if (!/^[가-힣A-Za-z0-9]{2,10}$/.test(nm)) { toast('이름은 한글·영문·숫자 2~10자(띄어쓰기·기호 없이)예요'); return true; }
    RK.busy = 1; render(); const nick = '🐱 ' + nm;
    fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'new', nick, data: {} }) }).then(r => r.json()).then(j => {
      if (j.code) { try { localStorage.setItem('nr_pcode', j.code); localStorage.setItem('nr_nick', nick); localStorage.setItem('nr_prev', String(j.rev || 1)); } catch (e) {} RK.code = j.code; save(); cloudFlush(); toast('참가했어요! 곧 순위에 올라가요'); setTimeout(() => { RK.list = null; if (PANEL === 'rank') render(); }, 4000); }
      else toast(j.error === 'nick' ? '쓸 수 없는 이름이에요. 다른 이름을 골라 주세요' : j.error === 'limit' ? '오늘은 더 만들 수 없어요. 내일 다시 해 주세요' : '지금은 참가할 수 없어요. 잠시 뒤 다시 해 주세요');
    }).catch(() => toast('인터넷 연결을 확인해 주세요')).finally(() => { RK.busy = 0; if (PANEL === 'rank') render(); }); return true; }
  return false; }
