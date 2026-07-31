/**
 * 빌드 도구가 없는 프로젝트이므로, "빌드 검증" 대신
 * 모든 소스 모듈을 실제로 파싱/링크할 수 있는지 확인한다.
 *
 *  - DOM이 필요 없는 모듈: 실제로 import 해서 실행까지 확인
 *  - DOM이 필요한 모듈: 구문 검사(node --check)만 수행
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** DOM(window/document/canvas)이 필요해 Node에서 실행할 수 없는 모듈 */
const DOM_ONLY = new Set([
  'main.js',
  'render/renderer.js',
  'render/hud.js',
  'io/audio.js',
  'io/input.js',
  'io/storage.js',
  'io/ui.js',
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(SRC);
let failed = 0;
let parsed = 0;
let imported = 0;

for (const file of files) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) {
    console.error(`[구문 오류] ${rel}\n${check.stderr}`);
    failed++;
    continue;
  }
  parsed++;

  if (!DOM_ONLY.has(rel)) {
    try {
      await import(pathToFileURL(file).href);
      imported++;
    } catch (err) {
      console.error(`[로드 실패] ${rel}: ${err.message}`);
      failed++;
    }
  }
}

console.log(`구문 검사 ${parsed}/${files.length} 통과, 모듈 로드 ${imported}개 통과`);
if (failed) {
  console.error(`실패 ${failed}건`);
  process.exit(1);
}
