/**
 * 주요 화면을 캡처해 눈으로 확인하기 위한 개발용 스크립트.
 *
 *   node tools/serve.mjs 8143      (다른 터미널에서)
 *   node tools/screenshots.mjs [출력폴더]
 */

import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const OUT = process.argv[2] || path.resolve('screenshots');
const BASE = process.env.BASE_URL || 'http://localhost:8143';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = async (name) => {
  await page.locator('#screen').screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('saved', name);
};
const hook = () => page.waitForFunction(() => !!window.__steel);

await page.goto(`${BASE}/?seed=2024`);
await hook();
await page.waitForTimeout(500);
await shot('01-title');

// 1단계 시작
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
await shot('02-stage1-intro');

await page.evaluate(() => { window.__steel.game.player.invuln = 9999; });
await page.waitForTimeout(9000);
await shot('03-drums-rolling');

// 점프 순간
await page.evaluate(() => {
  const g = window.__steel.game;
  g.player.state = 'air';
  g.player.vy = -125;
  g.player.airVx = 52;
  g.player.apexY = g.player.y;
});
await page.waitForTimeout(180);
await shot('04-jump');

// 사다리 이동
await page.evaluate(() => {
  const g = window.__steel.game;
  const l = g.stage.ladders.find((x) => x.id === 'L01');
  g.player.state = 'ladder';
  g.player.ladder = l;
  g.player.x = l.x;
  g.player.y = (l.top + l.bottom) / 2;
  g.player.platform = null;
});
await page.waitForTimeout(120);
await shot('05-ladder');

// 해머 획득 + 파괴
await page.evaluate(() => {
  const g = window.__steel.game;
  const p2 = g.stage.platforms.find((p) => p.id === 'g2');
  g.player.state = 'ground';
  g.player.ladder = null;
  g.player.platform = p2;
  g.player.x = 106;
  g.player.y = 180;
  g.hammer.pickup();
  g.hammer.frame = 0;
});
await page.waitForTimeout(150);
await shot('06-hammer');

await page.evaluate(() => {
  const g = window.__steel.game;
  g.effects.burst(g.player.x + 10, g.player.y - 6, '#f2a33c', 9, g.rng);
  g.effects.popup(g.player.x + 10, g.player.y - 18, 350, '#ff7a1a');
});
await page.waitForTimeout(120);
await shot('07-smash');

// 사망
await page.evaluate(() => window.__steel.game._killPlayer('hit'));
await page.waitForTimeout(400);
await shot('08-death');

// 스테이지 완료
await page.waitForTimeout(1600);
await page.evaluate(() => {
  const g = window.__steel.game;
  g.player.invuln = 9999;
  const gp = g.stage.goalPos;
  g.player.x = gp.x;
  g.player.y = gp.y;
  g.player.platform = g.stage.goal.platform;
  g.player.state = 'ground';
});
await page.waitForTimeout(200);
await shot('09-stage-clear');

// 2 / 3 / 4 단계
for (const [idx, name] of [[1, '10-stage2-belts'], [2, '11-stage3-hoist'], [3, '12-stage4-pins']]) {
  await page.evaluate((i) => {
    const g = window.__steel.game;
    g.beginStage(i);
    g.state = 'play';
    g.timer = 0;
  }, idx);
  await page.evaluate(() => { window.__steel.game.player.invuln = 9999; });
  await page.waitForTimeout(idx === 3 ? 3000 : 6000);
  await shot(name);
}

// 게임 오버
await page.evaluate(() => {
  const g = window.__steel.game;
  g.score.add(18240);
  g.score.lives = 1;
  g._killPlayer('hit');
});
await page.waitForTimeout(2200);
await shot('13-game-over');

// CRT 끔
await page.locator('#crt-toggle').uncheck();
await page.waitForTimeout(250);
await shot('14-crt-off');
await page.locator('#crt-toggle').check();

// 모바일
const mobile = await browser.newPage({
  viewport: { width: 393, height: 851 },
  deviceScaleFactor: 2.75,
  isMobile: true,
  hasTouch: true,
});
mobile.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
await mobile.goto(`${BASE}/?seed=2024`);
await mobile.waitForFunction(() => !!window.__steel);
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: path.join(OUT, '15-mobile-title.png') });
console.log('saved 15-mobile-title');
await mobile.locator('#btn-start').click();
await mobile.waitForTimeout(400);
await mobile.evaluate(() => { window.__steel.game.startGame(); });
await mobile.waitForTimeout(5000);
await mobile.screenshot({ path: path.join(OUT, '16-mobile-play.png') });
console.log('saved 16-mobile-play');

await browser.close();
if (errors.length) {
  console.error('\n[콘솔/페이지 오류]');
  for (const e of errors) console.error(' -', e);
  process.exitCode = 1;
} else {
  console.log('\n콘솔 오류 없음');
}
console.log('완료:', OUT);
