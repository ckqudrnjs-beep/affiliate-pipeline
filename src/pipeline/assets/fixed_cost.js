(function(){
  // Default presets by household size (1, 2, 3, 4+ members)
  const HH_DEFAULTS = {
    1: { telecom: 85000, sub: 38000, ins: 160000, util: 150000, loan: 250000 },
    2: { telecom: 155000, sub: 52000, ins: 290000, util: 240000, loan: 420000 },
    3: { telecom: 210000, sub: 64000, ins: 380000, util: 300000, loan: 520000 },
    4: { telecom: 265000, sub: 76000, ins: 480000, util: 360000, loan: 600000 }
  };

  // Recommended healthy caps by household size
  const HH_BENCHMARKS = {
    1: { telecom: 45000, sub: 15000, ins: 90000, util: 110000 },
    2: { telecom: 85000, sub: 22000, ins: 170000, util: 180000 },
    3: { telecom: 115000, sub: 28000, ins: 240000, util: 230000 },
    4: { telecom: 145000, sub: 32000, ins: 300000, util: 280000 }
  };

  const KEYS = ['telecom', 'sub', 'ins', 'util', 'loan'];
  const LABELS = {
    telecom: '📱 통신비 (휴대폰·인터넷)',
    sub: '📺 정기 구독료 (OTT·멤버십)',
    ins: '🛡️ 보장성 보험료',
    util: '💡 관리비·공과금',
    loan: '🏦 대출이자·할부 수수료'
  };

  let curHh = 1;

  function fmtWon(n) {
    return Math.round(n).toLocaleString('ko-KR') + '원';
  }

  function syncPair(key, fromRange) {
    const rng = document.getElementById('rng-' + key);
    const num = document.getElementById('num-' + key);
    if (fromRange) {
      num.value = rng.value;
    } else {
      const v = Math.max(0, +num.value || 0);
      rng.value = Math.min(+rng.max, v);
    }
    diagnose();
  }

  KEYS.forEach(k => {
    document.getElementById('rng-' + k).addEventListener('input', () => syncPair(k, true));
    document.getElementById('num-' + k).addEventListener('input', () => syncPair(k, false));
    document.getElementById('opt-' + k).addEventListener('change', diagnose);
  });

  document.querySelectorAll('#hhPresets button').forEach(btn => {
    btn.onclick = () => {
      curHh = +btn.dataset.hh;
      document.querySelectorAll('#hhPresets button').forEach(b => b.setAttribute('aria-pressed', b === btn));
      const def = HH_DEFAULTS[curHh];
      KEYS.forEach(k => {
        document.getElementById('num-' + k).value = def[k];
        document.getElementById('rng-' + k).value = Math.min(+document.getElementById('rng-' + k).max, def[k]);
      });
      diagnose();
    };
  });

  function diagnose() {
    const bm = HH_BENCHMARKS[curHh];
    document.getElementById('benchmark-telecom').textContent =
      `${curHh >= 4 ? '4인 이상' : curHh + '인'} 가구 점검 기준선: 월 ${fmtWon(bm.telecom)}`;

    const vals = {};
    KEYS.forEach(k => {
      vals[k] = Math.max(0, +document.getElementById('num-' + k).value || 0);
    });

    const optTelecom = document.getElementById('opt-telecom').value;
    const optSub = +document.getElementById('opt-sub').value;
    const optIns = document.getElementById('opt-ins').value;
    const optUtil = document.getElementById('opt-util').value;
    const optLoan = document.getElementById('opt-loan').value;

    // Calculate realistic monthly savings potential per category
    const savings = {};
    const prescriptions = [];

    // 1. Telecom savings
    let saveTel = 0;
    if (vals.telecom > bm.telecom) {
      const factor = optTelecom === 'carrier' ? 0.85 : optTelecom === 'contract' ? 0.65 : 0.4;
      saveTel = Math.round(((vals.telecom - bm.telecom) * factor) / 1000) * 1000;
    } else if (optTelecom === 'carrier' && vals.telecom >= 35000) {
      saveTel = Math.round((vals.telecom * 0.25) / 1000) * 1000;
    }
    savings.telecom = saveTel;
    prescriptions.push({
      key: 'telecom',
      title: '📱 통신비 다이어트',
      save: saveTel,
      how: optTelecom === 'carrier'
        ? '공시지원금을 받지 않았거나 약정이 끝난 휴대폰이라면 통신사 고객센터(114)나 앱에서 [선택약정 25% 요금할인]을 신청하세요. 같은 통신망을 빌려 쓰는 알뜰폰으로 옮기는 것도 방법이에요.'
        : optTelecom === 'contract'
        ? '최근 3개월 데이터 사용량을 확인해 쓰는 양보다 큰 요금제라면 한 단계 낮추고, 가족결합 할인이 빠짐없이 들어가 있는지 확인하세요.'
        : '이미 알뜰폰을 쓰고 계시네요. 인터넷·TV 약정이 끝날 때 재약정 혜택이나 요금을 다시 비교해 보세요.',
      sub: `현재 월 ${fmtWon(vals.telecom)} → 목표 월 ${fmtWon(vals.telecom - saveTel)}`
    });

    // 2. Subscription savings
    let saveSub = 0;
    if (vals.sub > bm.sub) {
      const ratio = optSub >= 5 ? 0.65 : optSub >= 3 ? 0.50 : 0.35;
      saveSub = Math.round(Math.max(vals.sub - bm.sub, vals.sub * ratio) / 1000) * 1000;
      saveSub = Math.min(vals.sub, saveSub);
    } else if (optSub >= 3 && vals.sub >= 15000) {
      saveSub = Math.round((vals.sub * 0.35) / 1000) * 1000;
    }
    savings.sub = saveSub;
    prescriptions.push({
      key: 'sub',
      title: '📺 정기 구독 구조조정',
      save: saveSub,
      how: optSub >= 3
        ? '영상(OTT)은 한 달에 하나만 남기고 순환 구독으로 바꾸세요. 카드 명세서에서 최근 2주간 안 쓴 정기결제를 해지하면 바로 현금이 남습니다.'
        : '꼭 쓰는 것만 유지하고 계시네요. 연간 결제가 더 싼지, 통신사·카드 혜택에 이미 포함된 구독은 없는지만 확인해 보세요.',
      sub: `현재 월 ${fmtWon(vals.sub)} → 목표 월 ${fmtWon(vals.sub - saveSub)}`
    });

    // 3. Insurance savings
    let saveIns = 0;
    if (vals.ins > bm.ins) {
      const factor = optIns === 'unchecked' ? 0.75 : 0.45;
      saveIns = Math.round(((vals.ins - bm.ins) * factor) / 1000) * 1000;
    } else if (optIns === 'unchecked' && vals.ins >= 80000) {
      saveIns = Math.round((vals.ins * 0.15) / 1000) * 1000;
    }
    savings.ins = saveIns;
    prescriptions.push({
      key: 'ins',
      title: '🛡️ 보장성 보험 특약 정리',
      save: saveIns,
      how: saveIns > 0
        ? '통째로 해지하기보다 [특약 일부 해지·감액]을 먼저 알아보세요. 여러 보험에 겹친 특약(입원일당·수술비 등)이 없는지 보고, 해지 전에는 다시 가입이 어려운 보장인지 꼭 확인하세요.'
        : '가구 규모 대비 적정한 보장성 보험료를 유지하고 계십니다.',
      sub: `현재 월 ${fmtWon(vals.ins)} → 목표 월 ${fmtWon(vals.ins - saveIns)}`
    });

    // 4. Utilities / Maintenance savings
    let saveUtil = 0;
    const baseUtilSave = optUtil === 'none' ? Math.round((vals.util * 0.08) / 1000) * 1000 : 0;
    const excessUtil = vals.util > bm.util ? Math.round(((vals.util - bm.util) * 0.35) / 1000) * 1000 : 0;
    saveUtil = Math.min(vals.util, baseUtilSave + excessUtil);
    savings.util = saveUtil;
    prescriptions.push({
      key: 'util',
      title: '💡 관리비·공과금 누수 차단',
      save: saveUtil,
      how: optUtil === 'none'
        ? '한전 에너지캐시백·도시가스 절약 캐시백처럼 아낀 만큼 돌려주는 제도가 있는지 확인하고 신청하세요(해마다 조건이 바뀌어요). 셋톱박스·비데·밥솥 보온 같은 대기전력을 줄이면 사용량이 누진 구간 경계에 있는 집은 효과가 더 커요.'
        : '겨울 난방·여름 냉방 달 사용량을 지난해 같은 달과 비교해 보고, 실내 온도를 1~2도만 조절해 보세요.',
      sub: `현재 월 ${fmtWon(vals.util)} → 목표 월 ${fmtWon(vals.util - saveUtil)}`
    });

    // 5. Loan interest & Installment fees
    let saveLoan = 0;
    if (vals.loan > 0) {
      const rateCutRatio = optLoan === 'high' ? 0.28 : optLoan === 'mid' ? 0.14 : 0.06;
      saveLoan = Math.round((vals.loan * rateCutRatio) / 1000) * 1000;
    }
    savings.loan = saveLoan;
    prescriptions.push({
      key: 'loan',
      title: '🏦 대출이자·할부 수수료 절감',
      save: saveLoan,
      how: optLoan === 'high'
        ? '금리가 가장 높은 카드 할부·현금서비스·리볼빙부터 먼저 갚으세요. 신용대출은 대출 비교·갈아타기 서비스로 더 낮은 금리가 있는지 조회하고, 소득이 늘거나 신용점수가 오르면 금리인하요구권을 신청해 보세요.'
        : vals.loan > 0
        ? '승진·이직으로 소득이 늘었거나 신용점수가 올랐다면 은행 앱에서 [금리인하요구권]을 신청해 보세요. 여유 자금이 생기면 중도상환수수료가 없는 범위에서 원금을 조금씩 줄이는 것도 좋아요.'
        : '대출이자와 할부 수수료가 없는 건강한 상태예요.',
      sub: `현재 월 ${fmtWon(vals.loan)} → 목표 월 ${fmtWon(vals.loan - saveLoan)}`
    });

    // Update Input Badges
    KEYS.forEach(k => {
      const bdg = document.getElementById('bdg-' + k);
      if (savings[k] >= 15000) {
        bdg.className = 'badge warn';
        bdg.textContent = `월 ${fmtWon(savings[k])} 절감 가능`;
      } else if (savings[k] > 0) {
        bdg.className = 'badge';
        bdg.textContent = `월 ${fmtWon(savings[k])} 절감 가능`;
      } else {
        bdg.className = 'badge';
        bdg.textContent = '알뜰 유지 중';
      }
    });

    // Render Receipt Rows
    let curTotal = 0;
    let saveTotal = 0;
    const rowsHtml = KEYS.map(k => {
      curTotal += vals[k];
      saveTotal += savings[k];
      const svText = savings[k] > 0 ? `<span class="save-v">(-${fmtWon(savings[k])})</span>` : `<span style="color:var(--muted)">(적정)</span>`;
      return `<div class="r-row">
        <span class="k">${LABELS[k]}</span>
        <span class="v">${fmtWon(vals[k])} ${svText}</span>
      </div>`;
    }).join('');

    const targetMonth = Math.max(0, curTotal - saveTotal);
    const saveYear = saveTotal * 12;
    // 매달 saveTotal을 36개월 적금(연 3.5% 단리, 세전)에 넣은 만기 금액: 원금 36회 + 이자 Σk=1..36 (k개월 × 3.5%/12)
    const save3Yr = Math.round((saveTotal * 36 + saveTotal * 0.035 / 12 * 666) / 1000) * 1000;

    document.getElementById('rcpMeta').textContent =
      `${curHh >= 4 ? '4인 이상' : curHh + '인'} 가구 기준 · ${new Date().toLocaleDateString('sv-SE')} 진단`;
    document.getElementById('rcpRows').innerHTML = rowsHtml;
    document.getElementById('rcpCurMonth').textContent = fmtWon(curTotal);
    document.getElementById('rcpTargetMonth').textContent = fmtWon(targetMonth);
    document.getElementById('rcpSaveMonth').textContent = fmtWon(saveTotal);
    document.getElementById('rcpSaveYear').textContent = fmtWon(saveYear);
    document.getElementById('rcpSave3Yr').textContent = fmtWon(save3Yr);

    // Sort prescriptions by highest savings first
    const sorted = prescriptions.slice().sort((a, b) => b.save - a.save);
    const topItem = sorted[0];

    const verdictEl = document.getElementById('rcpVerdict');
    if (saveTotal <= 0) {
      verdictEl.innerHTML = `✨ <b>군살이 거의 없어요.</b> 입력하신 고정비는 점검 기준선 안쪽이에요. 1년에 한 번 요금제·약정만 다시 확인해 보세요.`;
    } else {
      verdictEl.innerHTML = `💡 <b>1순위 처방: [${topItem.title}]</b>부터 손보면 한 달 약 <b>${fmtWon(topItem.save)}</b>(1년 약 <b>${fmtWon(topItem.save * 12)}</b>)을 아낄 수 있을 것으로 보여요.`;
    }

    // Render Prescription Cards
    document.getElementById('tipCards').innerHTML = sorted.map((p, idx) => `
      <div class="tip-card ${idx === 0 && p.save > 0 ? 'priority' : ''}">
        <div class="t-head">
          <b>${idx === 0 && p.save > 0 ? '🔥 1순위 · ' : ''}${p.title}</b>
          <span class="t-save">${p.save > 0 ? `연 ${fmtWon(p.save * 12)} 절약` : '알뜰 통과'}</span>
        </div>
        <p>${p.how}</p>
        <small>${p.sub}</small>
      </div>
    `).join('');
  }

  // Export Receipt as PNG Image
  document.getElementById('btnSavePng').onclick = () => {
    const c = document.getElementById('receiptCanvas');
    const ctx = c.getContext('2d');
    const w = 640, h = 820;
    c.width = w; c.height = h;

    ctx.fillStyle = '#f7f6f2';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1b1c1a';
    ctx.lineWidth = 2;
    ctx.fillRect(32, 32, w - 64, h - 64);
    ctx.strokeRect(32, 32, w - 64, h - 64);

    ctx.fillStyle = '#1f4d3a';
    ctx.fillRect(32, 32, w - 64, 10);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1b1c1a';
    ctx.font = '600 28px "Noto Serif KR", serif';
    ctx.fillText('🧾 고정비 다이어트 진단 영수증', w / 2, 94);

    ctx.fillStyle = '#6b6d66';
    ctx.font = '15px "Noto Sans KR", sans-serif';
    ctx.fillText(document.getElementById('rcpMeta').textContent, w / 2, 124);

    let y = 176;
    KEYS.forEach(k => {
      const val = Math.max(0, +document.getElementById('num-' + k).value || 0);
      const bdgText = document.getElementById('bdg-' + k).textContent;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#333';
      ctx.font = '500 17px "Noto Sans KR", sans-serif';
      ctx.fillText(LABELS[k], 68, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#1b1c1a';
      ctx.font = '700 17px "Noto Sans KR", sans-serif';
      ctx.fillText(`${fmtWon(val)} (${bdgText})`, w - 68, y);
      y += 48;
    });

    ctx.strokeStyle = '#1b1c1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(w - 64, y); ctx.stroke();

    y += 42;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b6d66';
    ctx.font = '600 18px "Noto Sans KR", sans-serif';
    ctx.fillText('현재 한 달 고정비 합계', 68, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1b1c1a';
    ctx.fillText(document.getElementById('rcpCurMonth').textContent, w - 68, y);

    y += 42;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1f4d3a';
    ctx.font = '700 20px "Noto Sans KR", sans-serif';
    ctx.fillText('한 달 아낄 수 있는 돈', 68, y);
    ctx.textAlign = 'right';
    ctx.fillText(document.getElementById('rcpSaveMonth').textContent, w - 68, y);

    y += 48;
    ctx.textAlign = 'left';
    ctx.font = '700 26px "Noto Sans KR", sans-serif';
    ctx.fillText('1년이면 총 절약', 68, y);
    ctx.textAlign = 'right';
    ctx.fillText(document.getElementById('rcpSaveYear').textContent, w - 68, y);

    y += 44;
    ctx.fillStyle = '#eef2ee';
    ctx.fillRect(64, y, w - 128, 92);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1f4d3a';
    ctx.font = '700 18px "Noto Sans KR", sans-serif';
    ctx.fillText('매달 적금에 넣으면 3년 뒤 약 ' + document.getElementById('rcpSave3Yr').textContent + ' (세전)', w / 2, y + 38);
    ctx.fillStyle = '#555';
    ctx.font = '14.5px "Noto Sans KR", sans-serif';
    ctx.fillText('다이어트 후 고정비: 월 ' + document.getElementById('rcpTargetMonth').textContent + ' · 대략적인 추정 · don3chon.com', w / 2, y + 68);

    c.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fixed-cost-diet-receipt.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }, 'image/png');
  };

  document.getElementById('btnCopyText').onclick = function() {
    const cur = document.getElementById('rcpCurMonth').textContent;
    const sm = document.getElementById('rcpSaveMonth').textContent;
    const sy = document.getElementById('rcpSaveYear').textContent;
    const s3 = document.getElementById('rcpSave3Yr').textContent;
    const text = `🧾 [고정비 다이어트 진단 결과]\n- 현재 월 고정비: ${cur}\n- 한 달 절감 가능액: ${sm}\n- 1년 총 절약액: ${sy} (매달 적금 시 3년 뒤 약 ${s3}, 세전)\n※ 대략적인 추정치 · 돈 줍는 삼촌 고정비 진단기`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.textContent = '✅ 복사 완료!';
        setTimeout(() => { this.textContent = '📋 진단 결과 복사'; }, 2000);
      });
    }
  };

  diagnose();
})();
