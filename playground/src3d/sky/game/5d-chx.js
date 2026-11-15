/* ---------- 4~7장 그림: 장에 들어갈 때 그 장 그림만 받는다 ---------- */
Object.assign(MC, {
  mossfluff: [110, 110, 55, 96], thornpod: [96, 104, 48, 92], mothbird: [104, 132, 52, 120], rootling: [140, 150, 70, 136], rootkeeper: [196, 212, 98, 192], oldtree: [300, 340, 150, 316],
  stormfluff: [110, 110, 55, 96], sparkpod: [96, 104, 48, 92], stormbird: [104, 132, 52, 120], stormling: [140, 160, 70, 146], stormkeeper: [196, 212, 98, 192], whale: [340, 380, 170, 352],
  dustfluff: [110, 110, 55, 96], stonepod: [96, 104, 48, 92], ashbird: [104, 132, 52, 120], stoneguard: [146, 160, 73, 146], stonekeeper: [196, 212, 98, 192], gatekeeper: [300, 340, 150, 320],
  galefluff: [110, 110, 55, 96], galepod: [96, 104, 48, 92], galebird: [104, 132, 52, 120], galeling: [140, 160, 70, 146], galekeeper: [196, 212, 98, 192], windlord: [260, 360, 130, 330] });
const LAZY = {};
function lazyImg(k) { if (IM[k] || LAZY[k] || !MC[k]) return; LAZY[k] = 1; const im = new Image(); im.onload = () => { IM[k] = im; }; im.onerror = () => { setTimeout(() => { LAZY[k] = 0; }, 5000); }; im.src = IMG + k + '.webp?v=__ASSETV__'; }
