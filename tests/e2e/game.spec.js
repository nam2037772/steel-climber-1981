// @ts-check
import { test, expect } from '@playwright/test';

const URL_MAIN = '/?seed=4242';

/** 콘솔 오류 · 페이지 오류 · 리소스 실패를 모으는 헬퍼 */
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

async function boot(page, url = URL_MAIN) {
  // 배경 탭에서는 브라우저가 requestAnimationFrame을 억제해 루프가 돌지 않는다.
  // 실제 사용자는 보고 있는 탭에서 플레이하므로 앞으로 가져온 뒤 검사한다.
  await page.bringToFront();
  await page.goto(url);
  await page.waitForFunction(() => !!window.__steel);
  await page.waitForTimeout(200);
}

const snap = (page) => page.evaluate(() => {
  const g = window.__steel.game;
  return {
    state: g.state,
    paused: g.paused,
    stage: g.stageNumber,
    screen: g.screenNumber,
    kind: g.stage.kind,
    score: g.score.value,
    high: g.score.high,
    lives: g.score.lives,
    bonus: g.score.bonus,
    x: g.player.x,
    y: g.player.y,
    pstate: g.player.state,
    rollers: g.rollers.length,
    sparks: g.sparks.length,
    tools: g.tools.length,
    hammer: g.hammer.active,
  };
});

/** 인트로를 건너뛰고 바로 조작 가능한 상태로 */
async function startPlaying(page) {
  // 루프가 실제로 돌기 시작한 뒤에 누른다
  await page.waitForFunction(() => window.__steel.loop.running && window.__steel.game.inputLock <= 0);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__steel.game.state !== 'title', null, { timeout: 5000 });
  await page.waitForFunction(() => window.__steel.game.state === 'play', null, { timeout: 8000 });
}

test('타이틀 화면이 뜨고 콘솔 오류가 없다', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const s = await snap(page);
  expect(s.state).toBe('title');
  expect(s.score).toBe(0);

  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#btn-start')).toBeVisible();
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});

test('캔버스 백버퍼는 224x256 고정이다', async ({ page }) => {
  await boot(page);
  const size = await page.evaluate(() => {
    const c = document.getElementById('game');
    return { w: c.width, h: c.height };
  });
  expect(size).toEqual({ w: 224, h: 256 });
});

test('Enter로 게임이 시작되고 1단계로 들어간다', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await startPlaying(page);

  const s = await snap(page);
  expect(s.stage).toBe(1);
  expect(s.screen).toBe(1);
  expect(s.kind).toBe('girders');
  expect(s.lives).toBe(3);
  expect(errors).toEqual([]);
});

test('좌우 키로 이동하고 화면 밖으로 나가지 않는다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  const before = await snap(page);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  const moved = await snap(page);
  expect(moved.x).toBeGreaterThan(before.x + 10);

  // 오래 눌러도 화면 안에 머문다
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(5000);
  await page.keyboard.up('ArrowRight');
  const edge = await snap(page);
  expect(edge.x).toBeLessThanOrEqual(224);
  expect(edge.x).toBeGreaterThan(200);
});

test('Space로 점프했다가 발판에 착지한다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  const before = await snap(page);

  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const air = await snap(page);
  expect(air.pstate).toBe('air');
  expect(air.y).toBeLessThan(before.y);

  await page.waitForTimeout(700);
  const landed = await snap(page);
  expect(landed.pstate).toBe('ground');
  expect(Math.abs(landed.y - before.y)).toBeLessThan(1);
});

test('사다리를 타고 위층으로 올라간다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);

  // 1단계 첫 사다리(x=200) 앞으로 이동시킨 뒤 ↑
  await page.evaluate(() => {
    const g = window.__steel.game;
    const l = g.stage.ladders.find((x) => x.id === 'L01');
    g.player.x = l.x;
    g.player.y = l.bottom;
    g.player.invuln = 9999;
  });
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.__steel.game.player.state === 'ladder', null, { timeout: 4000 });
  await page.waitForFunction(
    () => window.__steel.game.player.platform && window.__steel.game.player.platform.id === 'g1',
    null, { timeout: 6000 },
  );
  await page.keyboard.up('ArrowUp');

  const s = await snap(page);
  expect(s.pstate).toBe('ground');
});

test('드럼통이 굴러 내려오고 여러 층을 거친다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.evaluate(() => { window.__steel.game.player.invuln = 1e9; });

  const seen = await page.evaluate(async () => {
    const g = window.__steel.game;
    const floors = new Set();
    const t0 = performance.now();
    while (performance.now() - t0 < 22000) {
      g.player.invuln = 1e9;
      g.score.bonus = 5000;
      for (const r of g.rollers) if (r.platform) floors.add(r.platform.id);
      await new Promise((r) => requestAnimationFrame(r));
    }
    return [...floors].sort();
  });
  expect(seen.length).toBeGreaterThanOrEqual(4);
  expect(seen).toContain('g5');
});

test('실제 장애물 충돌로 사망하고 같은 스테이지에서 다시 시작한다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.waitForFunction(() => window.__steel.game.rollers.length > 0, null, { timeout: 8000 });

  const before = await snap(page);
  await page.evaluate(() => {
    const g = window.__steel.game;
    const r = g.rollers[0];
    g.player.invuln = 0;
    r.x = g.player.x;
    r.y = g.player.y;
    r.platform = g.player.platform;
    r.falling = false;
    r.alive = true;
  });

  await page.waitForFunction(() => window.__steel.game.player.state === 'dead', null, { timeout: 3000 });
  await page.waitForFunction(
    () => window.__steel.game.state === 'play' && window.__steel.game.player.state === 'ground',
    null, { timeout: 8000 },
  );

  const after = await snap(page);
  expect(after.stage).toBe(before.stage);
  expect(after.lives).toBe(before.lives - 1);
});
test('P로 일시정지하고 다시 P로 풀린다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(120);
  expect((await snap(page)).paused).toBe(true);

  const frozen = await snap(page);
  await page.waitForTimeout(600);
  const still = await snap(page);
  expect(still.bonus).toBe(frozen.bonus);
  expect(still.rollers).toBe(frozen.rollers);

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(120);
  expect((await snap(page)).paused).toBe(false);
});

test('탭이 가려지면 자동으로 일시정지된다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  expect((await snap(page)).paused).toBe(false);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  expect((await snap(page)).paused).toBe(true);

  // 돌아와도 자동으로 재개하지 않는다 (돌아온 순간 죽는 일이 없게)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  expect((await snap(page)).paused).toBe(true);
});

test('창 포커스를 잃어도 자동으로 일시정지된다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(200);
  expect((await snap(page)).paused).toBe(true);
});

test('키를 누른 채 포커스를 잃어도 입력이 고착되지 않는다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(120);

  const held = await page.evaluate(() => {
    const i = window.__steel.input;
    return { left: i.left, right: i.right, up: i.up, down: i.down };
  });
  expect(held).toEqual({ left: false, right: false, up: false, down: false });
  await page.keyboard.up('ArrowRight');
});

test('창 크기를 바꿔도 게임 좌표와 충돌 판정이 그대로다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.evaluate(() => {
    const g = window.__steel.game;
    g.player.invuln = 1e9;
    g.player.x = 120;
  });
  await page.waitForTimeout(100);

  const probe = () => page.evaluate(() => {
    const g = window.__steel.game;
    const c = document.getElementById('game');
    const p = g.stage.platforms.find((x) => x.id === 'g2');
    return {
      backing: [c.width, c.height],
      // 같은 게임 좌표에서 계산한 발판 표면 y
      surface: p.points.map(([x]) => x).concat([50, 100, 150]).map((x) => {
        const pts = p.points;
        let y = null;
        for (let i = 0; i < pts.length - 1; i++) {
          if (x >= pts[i][0] && x <= pts[i + 1][0]) {
            const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
            y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
          }
        }
        return y;
      }),
      playerY: g.player.y,
      ladderTop: g.stage.ladders[0].top,
    };
  });

  const a = await probe();
  await page.setViewportSize({ width: 620, height: 1180 });
  await page.waitForTimeout(400);
  const b = await probe();
  await page.setViewportSize({ width: 1500, height: 700 });
  await page.waitForTimeout(400);
  const c = await probe();

  expect(b).toEqual(a);
  expect(c).toEqual(a);
  expect(a.backing).toEqual([224, 256]);

  // 표시 크기는 비율을 지킨다
  const ratio = await page.evaluate(() => {
    const r = document.getElementById('game').getBoundingClientRect();
    return r.width / r.height;
  });
  expect(ratio).toBeGreaterThan(224 / 256 - 0.02);
  expect(ratio).toBeLessThan(224 / 256 + 0.02);
});

test('스테이지를 깨면 다음 화면으로 넘어가고 잔존물이 없다', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await startPlaying(page);

  await page.evaluate(() => {
    const g = window.__steel.game;
    g.player.invuln = 1e9;
    const gp = g.stage.goalPos;
    g.player.state = 'ground';
    g.player.platform = g.stage.goal.platform;
    g.player.x = gp.x;
    g.player.y = gp.y;
  });
  await page.waitForFunction(() => window.__steel.game.state === 'clear', null, { timeout: 4000 });
  await page.waitForFunction(() => window.__steel.game.screenNumber === 2, null, { timeout: 8000 });

  const s = await snap(page);
  expect(s.kind).toBe('conveyors');
  expect(s.rollers).toBe(0);
  expect(s.sparks).toBe(0);
  expect(s.tools).toBe(0);
  expect(s.hammer).toBe(false);
  expect(s.score).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('네 화면이 모두 콘솔 오류 없이 그려진다', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await startPlaying(page);
  for (let i = 0; i < 4; i++) {
    await page.evaluate((idx) => {
      const g = window.__steel.game;
      g.beginStage(idx);
      g.player.invuln = 1e9;
    }, i);
    await page.waitForTimeout(2500);
    const s = await snap(page);
    expect(s.screen).toBe(i + 1);
  }
  expect(errors).toEqual([]);
});

test('네 스테이지의 완료 조건이 각각 다음 화면으로 진행시킨다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);

  for (let idx = 0; idx < 4; idx++) {
    await page.evaluate((stageIndex) => {
      const g = window.__steel.game;
      g.beginStage(stageIndex);
      g.state = 'play';
      g.timer = 0;
      g.player.invuln = 1e9;

      if (g.stage.kind === 'pins') {
        for (const p of g.stage.platforms) {
          if (p.kind === 'pin') p.stepped = true;
        }
      } else {
        const gp = g.stage.goalPos;
        g.player.state = 'ground';
        g.player.platform = g.stage.goal.platform;
        g.player.x = gp.x;
        g.player.y = gp.y;
      }
    }, idx);

    await page.waitForFunction(() => window.__steel.game.state === 'clear', null, { timeout: 4000 });
    await page.waitForFunction(
      (nextIndex) => window.__steel.game.stageIndex === nextIndex,
      idx + 1, { timeout: 8000 },
    );
  }

  const s = await snap(page);
  expect(s.screen).toBe(1);
  expect(s.stage).toBe(5);
});
test('게임 오버 후 새로고침 없이 다시 시작된다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.evaluate(() => {
    const g = window.__steel.game;
    g.score.add(3400);
    g.score.lives = 1;
    g._killPlayer('hit');
  });
  await page.waitForFunction(() => window.__steel.game.state === 'gameover', null, { timeout: 6000 });

  await page.waitForTimeout(1300);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__steel.game.state !== 'gameover', null, { timeout: 4000 });

  const s = await snap(page);
  expect(s.score).toBe(0);
  expect(s.lives).toBe(3);
  expect(s.stage).toBe(1);
  expect(s.high).toBeGreaterThanOrEqual(3400);
});

test('최고 점수·음소거·CRT 설정이 새로고침 뒤에도 남는다', async ({ page }) => {
  await boot(page);
  await startPlaying(page);
  await page.evaluate(() => { window.__steel.game.score.add(7777); });

  await page.locator('#btn-mute').click();
  await page.locator('#crt-toggle').uncheck();
  await page.waitForTimeout(300);
  await expect(page.locator('#screen')).not.toHaveClass(/crt/);

  await page.evaluate(() => {
    const g = window.__steel.game;
    g.score.lives = 1;
    g._killPlayer('hit');
  });
  await page.waitForFunction(() => window.__steel.game.state === 'gameover', null, { timeout: 6000 });

  const stored = await page.evaluate(() => ({
    high: localStorage.getItem('steelclimber1981.highScore'),
    muted: localStorage.getItem('steelclimber1981.muted'),
    crt: localStorage.getItem('steelclimber1981.crt'),
  }));
  expect(Number(stored.high)).toBeGreaterThanOrEqual(7777);
  expect(stored.muted).toBe('1');
  expect(stored.crt).toBe('0');

  await page.reload();
  await page.waitForFunction(() => !!window.__steel);
  await page.waitForTimeout(200);
  const s = await snap(page);
  expect(s.high).toBeGreaterThanOrEqual(7777);
  await expect(page.locator('#crt-toggle')).not.toBeChecked();
  await expect(page.locator('#btn-mute')).toHaveText('SOUND OFF');
  await expect(page.locator('#screen')).not.toHaveClass(/crt/);
});

test('사운드는 첫 입력 이후에만 켜진다', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(() => !!window.__steel.audio.ctx);
  expect(before).toBe(false);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => !!window.__steel.audio.ctx);
  expect(after).toBe(true);
});

test('GitHub Pages 하위 경로에서도 로드된다', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/steel-climber-1981/?seed=4242');
  await page.waitForFunction(() => !!window.__steel, null, { timeout: 8000 });
  await page.waitForTimeout(600);
  expect((await snap(page)).state).toBe('title');
  expect(errors).toEqual([]);
});

test('가로 스크롤이 생기지 않는다', async ({ page }) => {
  await boot(page);
  for (const w of [1500, 1024, 800, 480]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(200);
    const over = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }));
    expect(over.doc, `viewport ${w}px`).toBeLessThanOrEqual(over.win);
  }
});
