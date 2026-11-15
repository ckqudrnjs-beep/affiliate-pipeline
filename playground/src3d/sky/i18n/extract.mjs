// 빌드된 sky.js 전체에서 번역할 글을 뽑아 keys.json 으로(파일 조각은 IIFE 가 쪼개져 있어 따로는 못 읽는다)
import fs from 'node:fs'; import path from 'node:path'; import { targets } from './lib.mjs';
const src = fs.readFileSync(path.resolve(import.meta.dirname, '../../../static/js/sky.js'), 'utf8');
const keys = [...new Set(targets(src).map(t => t.key))];
fs.writeFileSync(path.join(import.meta.dirname, 'keys.json'), JSON.stringify(keys, null, 0).replace(/","/g, '",\n"'));
console.log('keys', keys.length, 'chars', keys.join('').length);
