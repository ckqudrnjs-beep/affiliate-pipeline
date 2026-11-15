// 끊어진 하늘 영어판: 소스의 한글 문자열을 찾아(acorn) 번역표(en/*.json)로 바꿔 sky-en.js 를 만든다.
// 열쇠: 따옴표 문자열은 그 내용, 템플릿 문자열은 ${…} 자리를 ⟨0⟩⟨1⟩… 로 바꾼 글. 번역도 같은 자리표를 써서 순서를 바꿀 수 있다.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let acorn; for (const p of ['acorn', '/opt/node-tools/node_modules/acorn']) { try { acorn = require(p); break; } catch {} }
const walk = (n, f, parent) => { if (!n || typeof n.type !== 'string') return; f(n, parent); for (const k in n) { const v = n[k]; if (k === 'loc') continue; if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, f, n)); else if (v && typeof v.type === 'string') walk(v, f, n); } };
export const HAN = /[가-힣]/;
export function targets(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
  const T = [];
  walk(ast, (n, p) => {
    if (n.type === 'Literal' && typeof n.value === 'string' && HAN.test(n.value)) { if (p && p.type === 'Property' && p.key === n && !p.computed) return; T.push({ kind: 's', start: n.start, end: n.end, key: n.value, q: src[n.start] }); }
    else if (n.type === 'TemplateLiteral' && n.quasis.some(q => HAN.test(q.value.cooked))) { if (p && p.type === 'TaggedTemplateExpression') return; let key = ''; n.quasis.forEach((q, i) => { key += q.value.cooked; if (i < n.expressions.length) key += '⟨' + i + '⟩'; }); T.push({ kind: 't', start: n.start, end: n.end, key, exprs: n.expressions.map(e => [e.start, e.end]) }); }
  });
  return T.sort((a, b) => a.start - b.start);
}
const escS = (s, q) => s.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q).replace(/\n/g, '\\n');
const escT = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
export function translate(src, dict, miss) {
  const T = targets(src);
  const emit = (a, b) => { let out = '', i = a; for (const t of T) { if (t.start < i || t.end > b) continue; out += src.slice(i, t.start); out += one(t); i = t.end; } return out + src.slice(i, b); };
  const one = t => { const en = dict[t.key]; if (en == null) { miss && miss.add(t.key); return src.slice(t.start, t.start) + (t.kind === 's' ? src.slice(t.start, t.end) : '`' + rebuild(t, t.key) + '`'); }
    if (t.kind === 's') return t.q + escS(en, t.q) + t.q; return '`' + rebuild(t, en) + '`'; };
  const rebuild = (t, text) => text.split(/(⟨\d+⟩)/).map(part => { const m = /^⟨(\d+)⟩$/.exec(part); if (m) { const e = t.exprs[+m[1]]; return '${' + emit(e[0], e[1]) + '}'; } return escT(part); }).join('');
  return emit(0, src.length);
}
