/**
 * 의존성 없는 정적 파일 서버 (로컬 실행 + Playwright용).
 *
 * 이 게임은 빌드가 필요 없는 정적 웹게임이지만, ES 모듈은 file:// 에서
 * CORS 정책 때문에 로드되지 않으므로 http로 띄워야 한다.
 *
 *   node tools/serve.mjs [포트]
 *
 * GitHub Pages의 프로젝트 하위 경로(https://user.github.io/steel-climber-1981/)를
 * 흉내내기 위해 /steel-climber-1981/ 접두어도 같은 내용으로 서빙한다.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 8080);
const SUBPATH = '/steel-climber-1981/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath.startsWith(SUBPATH)) urlPath = urlPath.slice(SUBPATH.length - 1);
  else if (urlPath === SUBPATH.slice(0, -1)) urlPath = '/';
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    }).end(data);
  });
});

server.listen(PORT, () => {
  console.log(`STEEL CLIMBER 1981  →  http://localhost:${PORT}/`);
  console.log(`하위 경로 확인용    →  http://localhost:${PORT}${SUBPATH}`);
});
