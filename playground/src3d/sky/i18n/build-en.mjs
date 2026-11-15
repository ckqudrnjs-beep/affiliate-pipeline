// 영어판: static/js/sky.js → static/js/sky-en.js (i18n/en.json 으로 한글 문장을 바꾼다). node sky/build.mjs 뒤에 돌린다.
import fs from 'node:fs'; import path from 'node:path'; import { translate, HAN } from './lib.mjs';
const H = import.meta.dirname, JS = path.resolve(H, '../../../static/js');
const dict = JSON.parse(fs.readFileSync(path.join(H, 'en.json'), 'utf8')), miss = new Set();
let out = translate(fs.readFileSync(path.join(JS, 'sky.js'), 'utf8'), dict, miss).replaceAll('「', '“').replaceAll('」', '”');
// 저장 열쇠(바람개비 표지)와 옛 저장의 한글 이름을 위한 표: KO = 영어→한글(이름), EN = 한글→영어(짧은 이름만)
const KO = {}, EN = {}; for (const [k, v] of Object.entries(dict)) if (!/[<⟨\n]/.test(k) && k.length <= 16) { KO[v] = k; EN[k] = v; }
out = `var I18N_KO=${JSON.stringify(KO)},I18N_EN=${JSON.stringify(EN)};\n` + out;
fs.writeFileSync(path.join(JS, 'sky-en.js'), out);
const left = (out.match(/[가-힣]+/g) || []).length;
console.log('sky-en.js', (out.length / 1024).toFixed(0) + 'KB', 'missing', miss.size, 'hangul runs left', left);
if (miss.size) fs.writeFileSync(path.join(H, 'missing.txt'), [...miss].join('\n'));
