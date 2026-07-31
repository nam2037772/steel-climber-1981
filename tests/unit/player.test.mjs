import test from 'node:test';
import assert from 'node:assert/strict';

import { Player, PS } from '../../src/game/player.js';
import { surfaceYAt } from '../../src/game/geometry.js';
import {
  GAME_W, GAME_H, PLAYER_W, WALK_SPEED, CLIMB_SPEED, FALL_DEATH_DIST,
} from '../../src/core/constants.js';
import { makeTestStage, makeWorld, noInput, run, runUntil, DT } from './helpers.mjs';

function setup(extra = {}) {
  const stage = makeTestStage();
  const world = makeWorld(stage, extra);
  const p = new Player();
  p.reset({ x: 100, y: surfaceYAt(stage.ground, 100), platform: stage.ground });
  return { stage, world, p };
}

test('좌우 이동 — 관성 없이 즉시 서고 즉시 출발한다', () => {
  const { world, p } = setup();
  const input = noInput();
  input.right = true;
  run(1, (dt) => p.update(dt, input, world));
  assert.ok(Math.abs(p.x - (100 + WALK_SPEED)) < 1, `1초에 ${WALK_SPEED}px 이동`);
  assert.equal(p.facing, 1);

  input.right = false;
  const stopped = p.x;
  run(0.5, (dt) => p.update(dt, input, world));
  assert.equal(p.x, stopped, '입력을 놓으면 미끄러지지 않는다');
  assert.equal(p.vx, 0);
});

test('좌우 이동 경계 — 화면 밖으로 나가지 않는다', () => {
  const { world, p } = setup();
  const input = noInput();
  input.left = true;
  run(6, (dt) => p.update(dt, input, world));
  assert.equal(p.x, PLAYER_W / 2);
  input.left = false;
  input.right = true;
  run(10, (dt) => p.update(dt, input, world));
  assert.equal(p.x, GAME_W - PLAYER_W / 2);
});

test('점프 — 올라갔다 같은 자리에 착지한다', () => {
  const { world, p } = setup();
  const input = noInput();
  const y0 = p.y;
  input.jumpPressed = true;
  p.update(DT, input, world);
  input.jumpPressed = false;
  assert.equal(p.state, PS.AIR);

  let apex = y0;
  const t = runUntil(2, (dt) => {
    p.update(dt, input, world);
    apex = Math.min(apex, p.y);
  }, () => p.state === PS.GROUND);

  assert.ok(t !== null, '착지한다');
  assert.ok(Math.abs(p.y - y0) < 0.6, '같은 높이로 돌아온다');
  const height = y0 - apex;
  assert.ok(height > 12 && height < 18, `점프 높이 ${height.toFixed(1)}px — 드럼통(10px)을 넘을 수 있다`);
  assert.ok(t > 0.4 && t < 0.6, `체공 ${t.toFixed(2)}초`);
  assert.ok(p.alive, '제 높이 점프로는 죽지 않는다');
});

test('점프 중에는 방향을 바꿀 수 없다 (당시 감각)', () => {
  const { world, p } = setup();
  const input = noInput();
  input.right = true;
  run(0.2, (dt) => p.update(dt, input, world));
  input.jumpPressed = true;
  p.update(DT, input, world);
  input.jumpPressed = false;

  const vx = p.airVx;
  assert.ok(vx > 0);
  // 공중에서 반대 방향을 눌러도 수평 속도가 그대로다
  input.right = false;
  input.left = true;
  run(0.15, (dt) => p.update(dt, input, world));
  assert.equal(p.airVx, vx);
});

test('이동 중 점프는 앞으로 나아간다 (드럼통을 넘을 거리)', () => {
  const { world, p } = setup();
  const input = noInput();
  input.right = true;
  run(0.1, (dt) => p.update(dt, input, world));
  const x0 = p.x;
  input.jumpPressed = true;
  p.update(DT, input, world);
  input.jumpPressed = false;
  runUntil(2, (dt) => p.update(dt, input, world), () => p.state === PS.GROUND);
  const dist = p.x - x0;
  assert.ok(dist > 20 && dist < 30, `점프 수평 거리 ${dist.toFixed(1)}px`);
});

test('경사 발판 위에서는 표면 좌표를 정확히 따라간다', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const p = new Player();
  p.reset({ x: 30, y: surfaceYAt(stage.mid, 30), platform: stage.mid });
  const input = noInput();
  input.right = true;
  run(2, (dt) => {
    p.update(dt, input, world);
    const sy = surfaceYAt(stage.mid, p.x);
    if (sy != null) assert.ok(Math.abs(p.y - sy) < 1e-9, '발이 경사면에 붙어 있다');
  });
  assert.ok(p.y > surfaceYAt(stage.mid, 30), '오른쪽이 낮으므로 내려간다');
});

test('발판 끝에서 떨어져 아래층에 착지한다 (아래로 빠지지 않는다)', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const p = new Player();
  p.reset({ x: 190, y: surfaceYAt(stage.mid, 190), platform: stage.mid });
  const input = noInput();
  input.right = true;
  const t = runUntil(3, (dt) => p.update(dt, input, world), () => p.platform === stage.ground);
  assert.ok(t !== null, '아래 발판에 착지한다');
  assert.equal(p.y, 220);
  assert.ok(p.alive, '한 층 낙차는 살아남는다');
});

test('두 층을 떨어지면 죽는다', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const p = new Player();
  // x=210 은 mid 구간(20..204) 밖이라 upper(150) 바로 아래에서 ground(220)까지 직행한다
  p.reset({ x: 210, y: 152, platform: null });
  p.state = PS.AIR;
  p.apexY = p.y;
  runUntil(3, (dt) => p.update(dt, noInput(), world), () => !p.alive);
  assert.equal(p.state, PS.DEAD);
  assert.equal(p.dieCause, 'fall');
});

test(`낙하 ${FALL_DEATH_DIST}px 이하는 살고 초과는 죽는다`, () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const drop = (fromY) => {
    const p = new Player();
    p.reset({ x: 210, y: fromY, platform: null }); // mid 구간 밖 → ground(220)까지 직행
    p.state = PS.AIR;
    p.apexY = p.y;
    runUntil(2, (dt) => p.update(dt, noInput(), world), () => p.state !== PS.AIR);
    return p;
  };
  const safe = drop(220 - FALL_DEATH_DIST + 2);
  assert.ok(safe.alive, '기준 이하 낙하는 살아남는다');
  assert.equal(safe.y, 220);

  const doomed = drop(220 - FALL_DEATH_DIST - 4);
  assert.ok(!doomed.alive, '기준 초과 낙하는 죽는다');
  assert.equal(doomed.dieCause, 'fall');
});

test('빠른 낙하에서도 발판을 뚫고 지나가지 않는다', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const p = new Player();
  p.reset({ x: 100, y: 30, platform: null });
  p.state = PS.AIR;
  p.apexY = 30;
  p.invuln = 0;
  runUntil(4, (dt) => p.update(dt, noInput(), world), () => p.state !== PS.AIR);
  // 죽더라도 발판 위에서 멈춰야 한다 (화면 밖으로 통과 금지)
  assert.ok(p.y <= 220 + 0.01, `y=${p.y} — 발판을 통과하지 않았다`);
});

test('사다리 — 아래에서 올라가 위층 발판에 올라선다', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const p = new Player();
  p.reset({ x: 60, y: surfaceYAt(stage.ground, 60), platform: stage.ground });
  const input = noInput();
  input.up = true;
  p.update(DT, input, world);
  assert.equal(p.state, PS.LADDER);
  assert.equal(p.x, 60, '사다리 중심으로 정렬된다');

  const t = runUntil(3, (dt) => p.update(dt, input, world), () => p.state === PS.GROUND);
  assert.ok(t !== null);
  assert.equal(p.platform, stage.mid);
  assert.equal(p.y, stage.la.top);
  const expected = (stage.la.bottom - stage.la.top) / CLIMB_SPEED;
  assert.ok(Math.abs(t - expected) < 0.15, `오르는 데 걸린 시간 ${t.toFixed(2)}s`);
});

test('사다리 — 위에서 아래로 내려온다', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const p = new Player();
  p.reset({ x: 60, y: surfaceYAt(stage.mid, 60), platform: stage.mid });
  const input = noInput();
  input.down = true;
  p.update(DT, input, world);
  assert.equal(p.state, PS.LADDER);
  runUntil(3, (dt) => p.update(dt, input, world), () => p.state === PS.GROUND);
  assert.equal(p.platform, stage.ground);
  assert.equal(p.y, stage.la.bottom);
});

test('끊어진 사다리는 중간에서 막힌다', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const p = new Player();
  p.reset({ x: 180, y: surfaceYAt(stage.ground, 180), platform: stage.ground });
  const input = noInput();
  input.up = true;
  run(4, (dt) => p.update(dt, input, world));
  assert.equal(p.state, PS.LADDER, '끝까지 올라가지 못하고 사다리에 남는다');
  assert.ok(Math.abs(p.y - stage.broken.usableTop) < 1e-6);
  assert.notEqual(p.platform, stage.mid);
});

test('점프 중에는 사다리에 붙지 않는다', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage);
  const p = new Player();
  p.reset({ x: 60, y: surfaceYAt(stage.ground, 60), platform: stage.ground });
  const input = noInput();
  input.jumpPressed = true;
  p.update(DT, input, world);
  input.jumpPressed = false;
  input.up = true;
  run(0.3, (dt) => p.update(dt, input, world));
  assert.notEqual(p.state, PS.LADDER, '공중에서 위를 눌러도 사다리를 잡지 않는다');
});

test('해머를 들고 있으면 점프도 사다리도 막힌다', () => {
  const stage = makeTestStage();
  const world = makeWorld(stage, { hammerActive: true });
  const p = new Player();
  p.reset({ x: 60, y: surfaceYAt(stage.ground, 60), platform: stage.ground });
  const input = noInput();
  input.jumpPressed = true;
  input.up = true;
  run(0.3, (dt) => p.update(dt, input, world));
  assert.equal(p.state, PS.GROUND);
  assert.equal(p.platform, stage.ground);
});

test('화면 아래로 떨어지면 사망한다', () => {
  const world = makeWorld({ platforms: [], ladders: [] });
  const p = new Player();
  p.reset({ x: 100, y: GAME_H - 10, platform: null });
  p.state = PS.AIR;
  p.apexY = p.y;
  runUntil(3, (dt) => p.update(dt, noInput(), world), () => !p.alive);
  assert.equal(p.state, PS.DEAD);
  assert.equal(p.dieCause, 'fall');
});

test('사망은 한 번만 처리된다 (중복 방지)', () => {
  const { p } = setup();
  assert.equal(p.kill('hit'), true);
  assert.equal(p.kill('hit'), false, '이미 죽은 상태에서는 false');
  assert.equal(p.dieCause, 'hit');
});

test('충돌상자는 스프라이트보다 작다', () => {
  const { p } = setup();
  const box = p.box;
  const draw = p.drawBox;
  assert.ok(box.r - box.l < draw.r - draw.l);
  assert.ok(box.b - box.t < draw.b - draw.t);
});

test('프레임 독립성 — dt가 달라도 걷는 거리가 같다', () => {
  const a = setup();
  const b = setup();
  const input = noInput();
  input.right = true;
  run(1, (dt) => a.p.update(dt, input, a.world), 1 / 120);
  run(1, (dt) => b.p.update(dt, input, b.world), 1 / 60);
  assert.ok(Math.abs(a.p.x - b.p.x) < 1e-9, `120Hz=${a.p.x} 60Hz=${b.p.x}`);
});

test('프레임 독립성 — dt가 달라도 점프 높이가 거의 같다', () => {
  const jumpApex = (dt) => {
    const { world, p } = setup();
    const input = noInput();
    input.jumpPressed = true;
    p.update(dt, input, world);
    input.jumpPressed = false;
    let apex = p.y;
    runUntil(2, (d) => { p.update(d, input, world); apex = Math.min(apex, p.y); },
      () => p.state === PS.GROUND, dt);
    return apex;
  };
  const a = jumpApex(1 / 120);
  const b = jumpApex(1 / 60);
  assert.ok(Math.abs(a - b) < 1.5, `120Hz 정점=${a.toFixed(2)} 60Hz 정점=${b.toFixed(2)}`);
});
