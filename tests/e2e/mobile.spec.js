// @ts-check
import { test, expect } from '@playwright/test';

const URL_MAIN = '/?seed=4242';

function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const f = r.failure();
    errors.push(`requestfailed: ${r.url()} ${f ? f.errorText : ''}`);
  });
  return errors;
}

async function boot(page) {
  // 배경 탭에서는 requestAnimationFrame이 억제되어 루프가 돌지 않는다
  await page.bringToFront();
  await page.goto(URL_MAIN);
  await page.waitForFunction(() => !!window.__steel);
  await page.waitForTimeout(250);
}

const snap = (page) => page.evaluate(() => {
  const g = window.__steel.game;
  const i = window.__steel.input;
  return {
    state: g.state,
    x: g.player.x,
    y: g.player.y,
    pstate: g.player.state,
    held: { left: i.left, right: i.right, up: i.up, down: i.down },
  };
});

async function startPlaying(page) {
  await page.locator('#btn-start').tap();
  await page.waitForFunction(() => window.__steel.game.state === 'play', null, { timeout: 8000 });
  await page.evaluate(() => { window.__steel.game.player.invuln = 1e9; });
}

test('모바일 화면에서 오류 없이 로드되고 조작 버튼이 보인다', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  for (const id of ['#btn-left', '#btn-right', '#btn-up', '#btn-down', '#btn-jump', '#btn-action', '#btn-pause']) {
    await expect(page.locator(id), `${id} 가 보여야 한다`).toBeVisible();
  }
  await page.waitForTimeout(600);
  expect(errors).toEqual([]);
});

test('조작 버튼이 화면 밖으로 잘리거나 서로 겹치지 않는다', async ({ page }) => {
  await boot(page);
  const vw = await page.evaluate(() => window.innerWidth);
  const vh = await page.evaluate(() => window.innerHeight);
  const ids = ['#btn-left', '#btn-right', '#btn-up', '#btn-down', '#btn-jump', '#btn-action', '#btn-pause'];
  const boxes = [];

  for (const id of ids) {
    const box = await page.locator(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box.x, `${id} 왼쪽`).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width, `${id} 오른쪽`).toBeLessThanOrEqual(vw + 0.5);
    expect(box.y + box.height, `${id} 아래쪽 (스크롤 없이 보인다)`).toBeLessThanOrEqual(vh + 0.5);
    boxes.push({ id, ...box });
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapW = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const overlapH = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      expect(overlapW * overlapH, `${a.id} / ${b.id} 겹침`).toBeLessThan(1);
    }
  }
});

test('가로 넘침이 없다', async ({ page }) => {
  await boot(page);
  const m = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    win: window.innerWidth,
  }));
  expect(m.doc).toBeLessThanOrEqual(m.win);
  expect(m.body).toBeLessThanOrEqual(m.win);
});

test('터치로 이동한다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  const before = await snap(page);

  const btn = await page.locator('#btn-right').boundingBox();
  await page.touchscreen.tap(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await page.waitForTimeout(150);

  // tap은 짧아서 이동이 적으므로 길게 누르는 방식으로도 확인한다
  await page.dispatchEvent('#btn-right', 'pointerdown', { pointerId: 1, isPrimary: true, button: 0 });
  await page.waitForTimeout(600);
  const moving = await snap(page);
  await page.dispatchEvent('#btn-right', 'pointerup', { pointerId: 1, isPrimary: true, button: 0 });

  expect(moving.x).toBeGreaterThan(before.x + 10);
  await page.waitForTimeout(120);
  const released = await snap(page);
  expect(released.held.right).toBe(false);
});

test('멀티터치 — 이동하면서 점프할 수 있다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  const before = await snap(page);

  // 왼쪽 버튼을 누른 채로 JUMP를 누른다 (서로 다른 pointerId)
  await page.dispatchEvent('#btn-right', 'pointerdown', { pointerId: 11, isPrimary: true, button: 0 });
  await page.waitForTimeout(200);
  await page.dispatchEvent('#btn-jump', 'pointerdown', { pointerId: 12, isPrimary: false, button: 0 });
  await page.waitForTimeout(100);

  const air = await snap(page);
  expect(air.pstate, '이동 중에도 점프가 된다').toBe('air');
  expect(air.held.right, '점프하는 동안에도 이동 입력이 유지된다').toBe(true);

  await page.dispatchEvent('#btn-jump', 'pointerup', { pointerId: 12, isPrimary: false, button: 0 });
  await page.waitForTimeout(500);
  await page.dispatchEvent('#btn-right', 'pointerup', { pointerId: 11, isPrimary: true, button: 0 });
  await page.waitForTimeout(150);

  const after = await snap(page);
  expect(after.x).toBeGreaterThan(before.x + 8);
  expect(after.held.right).toBe(false);
});

test('pointercancel로도 입력이 확실히 해제된다 (고착 없음)', async ({ page }) => {
  await boot(page);
  await startPlaying(page);

  await page.dispatchEvent('#btn-left', 'pointerdown', { pointerId: 21, isPrimary: true, button: 0 });
  await page.waitForTimeout(150);
  expect((await snap(page)).held.left).toBe(true);

  await page.dispatchEvent('#btn-left', 'pointercancel', { pointerId: 21, isPrimary: true });
  await page.waitForTimeout(150);
  expect((await snap(page)).held.left).toBe(false);

  const x1 = (await snap(page)).x;
  await page.waitForTimeout(500);
  expect(Math.abs((await snap(page)).x - x1)).toBeLessThan(1);
});

test('탭이 가려지면 눌린 터치 입력이 해제되고 일시정지된다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.dispatchEvent('#btn-right', 'pointerdown', { pointerId: 31, isPrimary: true, button: 0 });
  await page.waitForTimeout(150);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);

  const s = await snap(page);
  expect(s.held.right).toBe(false);
  expect(await page.evaluate(() => window.__steel.game.paused)).toBe(true);
});

test('사다리 버튼으로 오르내릴 수 있다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.evaluate(() => {
    const g = window.__steel.game;
    const l = g.stage.ladders.find((x) => x.id === 'L01');
    g.player.x = l.x;
    g.player.y = l.bottom;
    g.player.invuln = 1e9;
  });

  await page.dispatchEvent('#btn-up', 'pointerdown', { pointerId: 41, isPrimary: true, button: 0 });
  await page.waitForFunction(() => window.__steel.game.player.state === 'ladder', null, { timeout: 4000 });
  const climbing = await snap(page);
  await page.waitForTimeout(400);
  const higher = await snap(page);
  expect(higher.y).toBeLessThan(climbing.y);
  await page.dispatchEvent('#btn-up', 'pointerup', { pointerId: 41, isPrimary: true, button: 0 });
});

test('PAUSE 버튼이 동작한다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.locator('#btn-pause').tap();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__steel.game.paused)).toBe(true);
  await page.locator('#btn-pause').tap();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__steel.game.paused)).toBe(false);
});

test('모바일에서도 캔버스 백버퍼는 224x256이고 비율이 유지된다', async ({ page }) => {
  await boot(page);
  const info = await page.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    return { w: c.width, h: c.height, ratio: r.width / r.height, rw: r.width };
  });
  expect(info.w).toBe(224);
  expect(info.h).toBe(256);
  expect(info.ratio).toBeGreaterThan(224 / 256 - 0.03);
  expect(info.ratio).toBeLessThan(224 / 256 + 0.03);
  expect(info.rw).toBeGreaterThan(150);
});

test('모바일 전체 플레이 중 콘솔 오류가 없다', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await startPlaying(page);
  for (let i = 0; i < 4; i++) {
    await page.evaluate((idx) => {
      const g = window.__steel.game;
      g.beginStage(idx);
      g.player.invuln = 1e9;
    }, i);
    await page.waitForTimeout(1800);
  }
  expect(errors).toEqual([]);
});
