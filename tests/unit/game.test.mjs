import test from 'node:test';
import assert from 'node:assert/strict';

import { Game, GS } from '../../src/game/game.js';
import { PS } from '../../src/game/player.js';
import { Roller } from '../../src/game/obstacles.js';
import { Spark } from '../../src/game/enemies.js';
import { surfaceYAt } from '../../src/game/geometry.js';
import { SCORE, START_LIVES, DEATH_ANIM, STAGE_CLEAR_ANIM } from '../../src/core/constants.js';
import { noInput, run, runUntil, DT } from './helpers.mjs';

/** 관전용 — 플레이어를 죽지 않게 두고 스테이지를 굴린다 */
function newGame(seed = 777) {
  const events = [];
  const g = new Game({ seed, onEvent: (n, d) => events.push([n, d]) });
  g.startGame();
  return { g, events };
}

/** 인트로를 지나 PLAY 상태로 */
function toPlay(g) {
  runUntil(4, (dt) => g.update(dt, noInput()), () => g.state === GS.PLAY);
  assert.equal(g.state, GS.PLAY);
}

/** 플레이어를 특정 발판 위로 옮긴다 */
function place(g, platform, x) {
  g.player.state = PS.GROUND;
  g.player.ladder = null;
  g.player.platform = platform;
  g.player.x = x;
  g.player.y = surfaceYAt(platform, x);
  g.player.invuln = 0;
}

test('시작하면 1스테이지 인트로부터 시작한다', () => {
  const { g } = newGame();
  assert.equal(g.state, GS.INTRO);
  assert.equal(g.stageNumber, 1);
  assert.equal(g.screenNumber, 1);
  assert.equal(g.loopNumber, 1);
  assert.equal(g.score.lives, START_LIVES);
  assert.equal(g.score.value, 0);
  assert.equal(g.stage.kind, 'girders');
  toPlay(g);
});

test('타이틀에서 Enter로 게임이 시작된다', () => {
  const g = new Game({ seed: 1 });
  assert.equal(g.state, GS.TITLE);
  const input = noInput();
  input.startPressed = true;
  run(0.4, (dt) => g.update(dt, noInput())); // inputLock 해제
  g.update(DT, input);
  assert.equal(g.state, GS.INTRO);
});

test('일시정지 중에는 게임이 진행되지 않는다', () => {
  const { g } = newGame();
  toPlay(g);
  const input = noInput();
  input.pausePressed = true;
  g.update(DT, input);
  assert.equal(g.paused, true);

  const before = { x: g.player.x, bonus: g.score.bonus, rollers: g.rollers.length };
  run(2, (dt) => g.update(dt, noInput()));
  assert.equal(g.player.x, before.x);
  assert.equal(g.score.bonus, before.bonus);
  assert.equal(g.rollers.length, before.rollers);

  input.pausePressed = true;
  g.update(DT, input);
  assert.equal(g.paused, false);
});

test('로봇이 드럼통을 계속 내보낸다', () => {
  const { g } = newGame();
  toPlay(g);
  g.player.invuln = 9999;
  run(12, (dt) => g.update(dt, noInput()));
  assert.ok(g.rollers.length >= 2, `화면에 드럼통이 있다 (${g.rollers.length}개)`);
});

test('장애물에 맞으면 죽고 생명이 줄고 같은 스테이지가 다시 시작된다', () => {
  const { g, events } = newGame();
  toPlay(g);
  const stage = g.stage;
  place(g, stage.platforms[0], 100);
  g.rollers.push(new Roller({
    x: g.player.x, y: g.player.y, platform: stage.platforms[0], kind: 'drum',
  }));
  g.update(DT, noInput());
  assert.equal(g.player.state, PS.DEAD);
  assert.equal(g.state, GS.DYING);
  assert.ok(events.some(([n]) => n === 'death'));

  run(DEATH_ANIM + 0.2, (dt) => g.update(dt, noInput()));
  assert.equal(g.score.lives, START_LIVES - 1);
  assert.equal(g.stageNumber, 1, '같은 스테이지 재시작');
  assert.equal(g.state, GS.INTRO);
});

test('피격은 중복 처리되지 않는다 (생명 한 번만 감소)', () => {
  const { g } = newGame();
  toPlay(g);
  const floor = g.stage.platforms[0];
  place(g, floor, 100);
  for (let i = 0; i < 3; i++) {
    g.rollers.push(new Roller({ x: 100, y: g.player.y, platform: floor, kind: 'drum' }));
  }
  run(DEATH_ANIM + 0.3, (dt) => g.update(dt, noInput()));
  assert.equal(g.score.lives, START_LIVES - 1, '드럼통 3개에 동시에 닿아도 1개만 잃는다');
});

test('무적 시간 동안에는 맞지 않는다', () => {
  const { g } = newGame();
  toPlay(g);
  const floor = g.stage.platforms[0];
  place(g, floor, 100);
  g.player.invuln = 5;
  g.rollers.push(new Roller({ x: 100, y: g.player.y, platform: floor, kind: 'drum' }));
  run(0.5, (dt) => g.update(dt, noInput()));
  assert.ok(g.player.alive);
});

test('제한시간이 다 되면 죽는다', () => {
  const { g } = newGame();
  toPlay(g);
  g.rollers = [];
  g.sparks = [];
  g.score.bonus = 100;
  runUntil(5, (dt) => { g.rollers = []; g.sparks = []; g.update(dt, noInput()); },
    () => !g.player.alive);
  assert.equal(g.player.dieCause, 'time');
});

test('생명을 모두 잃으면 게임 오버', () => {
  const { g, events } = newGame();
  toPlay(g);
  g.score.lives = 1;
  g._killPlayer('hit');
  run(DEATH_ANIM + 0.2, (dt) => g.update(dt, noInput()));
  assert.equal(g.state, GS.GAMEOVER);
  assert.ok(events.some(([n]) => n === 'gameOver'));
  assert.equal(g.rollers.length, 0);
  assert.equal(g.sparks.length, 0);
});

test('게임 오버에서 Enter로 새로고침 없이 다시 시작된다', () => {
  const { g } = newGame();
  toPlay(g);
  g.score.add(4000);
  g.score.lives = 1;
  g._killPlayer('hit');
  run(DEATH_ANIM + 0.2, (dt) => g.update(dt, noInput()));
  assert.equal(g.state, GS.GAMEOVER);

  run(1.3, (dt) => g.update(dt, noInput())); // inputLock 해제
  const input = noInput();
  input.startPressed = true;
  g.update(DT, input);

  assert.equal(g.state, GS.INTRO);
  assert.equal(g.score.value, 0);
  assert.equal(g.score.lives, START_LIVES);
  assert.equal(g.stageNumber, 1);
  assert.equal(g.score.high, 4000, '최고 점수는 남는다');
});

test('목표 장치에 닿으면 스테이지가 완료되고 남은 보너스를 받는다', () => {
  const { g, events } = newGame();
  toPlay(g);
  g.score.bonus = 2500;
  const goal = g.stage.goalPos;
  place(g, g.stage.goal.platform, goal.x);
  g.update(DT, noInput());
  assert.equal(g.state, GS.CLEAR);
  assert.equal(g.score.value, 2500);
  assert.ok(events.some(([n]) => n === 'stageClear'));
  assert.equal(g.rollers.length, 0, '남아 있던 장애물이 정리된다');
});

test('스테이지 완료 후 다음 화면으로 넘어간다', () => {
  const { g } = newGame();
  toPlay(g);
  place(g, g.stage.goal.platform, g.stage.goalPos.x);
  g.update(DT, noInput());
  run(STAGE_CLEAR_ANIM + 0.2, (dt) => g.update(dt, noInput()));
  assert.equal(g.stageNumber, 2);
  assert.equal(g.screenNumber, 2);
  assert.equal(g.stage.kind, 'conveyors');
  assert.equal(g.state, GS.INTRO);
});

test('네 화면을 다 돌면 다시 첫 화면으로 오되 어려워진다', () => {
  const g = new Game({ seed: 5 });
  g.startGame();
  const first = { ...g.stage.diff, interval: g.stage.spawnInterval };
  g.beginStage(4);
  assert.equal(g.screenNumber, 1);
  assert.equal(g.loopNumber, 2);
  assert.equal(g.stage.kind, 'girders');
  assert.ok(g.stage.diff.speedMul > first.speedMul, '장애물이 빨라진다');
  assert.ok(g.stage.spawnInterval < first.interval, '생성 간격이 짧아진다');
  assert.ok(g.stage.diff.bonusStart < first.bonusStart, '제한시간이 줄어든다');
});

test('난이도에는 상한이 있다 (무한히 어려워지지 않는다)', () => {
  const g = new Game({ seed: 5 });
  g.startGame();
  g.beginStage(200);
  assert.ok(g.stage.diff.speedMul <= 1.8);
  assert.ok(g.stage.spawnInterval > 0.5);
  assert.ok(g.stage.diff.bonusStart >= 3000);
  assert.ok(g.stage.maxSparks <= 5);
});

test('스테이지를 바꾸면 이전 장애물·적·해머·연출이 남지 않는다', () => {
  const { g } = newGame();
  toPlay(g);
  g.player.invuln = 9999;
  run(10, (dt) => g.update(dt, noInput()));
  g.hammer.pickup();
  g.effects.popup(10, 10, '123');
  assert.ok(g.rollers.length > 0);

  g.beginStage(1);
  assert.equal(g.rollers.length, 0);
  assert.equal(g.sparks.length, 0);
  assert.equal(g.tools.length, 0);
  assert.equal(g.hammer.active, false);
  assert.equal(g.effects.popups.length, 0);
  assert.equal(g.effects.bursts.length, 0);
  assert.equal(g.player.state, PS.GROUND);
});

test('사망 시 해머 상태가 완전히 초기화된다', () => {
  const { g } = newGame();
  toPlay(g);
  g.hammer.pickup();
  assert.equal(g.hammer.active, true);
  g._killPlayer('hit');
  assert.equal(g.hammer.active, false, '죽는 순간 해머가 사라진다');
  run(DEATH_ANIM + 0.2, (dt) => g.update(dt, noInput()));
  assert.equal(g.hammer.active, false);
  assert.equal(g.hammer.time, 0);
});

test('해머를 주우면 켜지고, 해머로 드럼통을 부수면 점수를 준다', () => {
  const { g, events } = newGame();
  toPlay(g);
  const pick = g.stage.hammerPickups[0];
  const plat = g.stage.hammers[0].platform;
  place(g, plat, pick.x);
  g.update(DT, noInput());
  assert.equal(g.hammer.active, true);
  assert.ok(events.some(([n]) => n === 'hammerGet'));

  g.player.facing = 1;
  g.hammer.frame = 0;
  const before = g.score.value;
  const drum = new Roller({
    x: g.player.x + 7, y: g.player.y, platform: plat, kind: 'drum',
  });
  g.rollers.push(drum);
  g.update(DT, noInput());
  assert.equal(drum.alive, false, '드럼통이 부서졌다');
  assert.equal(g.score.value - before, SCORE.smashDrum);
  g.update(DT, noInput());
  assert.ok(!g.rollers.includes(drum), '부서진 드럼통은 목록에서 사라진다');
});

test('해머로 불꽃을 없애면 더 높은 점수를 준다', () => {
  const { g } = newGame();
  toPlay(g);
  const plat = g.stage.platforms[0];
  place(g, plat, 100);
  g.player.facing = 1;
  g.hammer.pickup();
  g.hammer.frame = 0;
  const before = g.score.value;
  const spark = new Spark({ x: 107, y: g.player.y, platform: plat, rng: g.rng });
  g.sparks.push(spark);
  g.update(DT, noInput());
  assert.equal(spark.alive, false);
  assert.equal(g.score.value - before, SCORE.smashSpark);
});

test('아이템을 주우면 종류별 점수를 준다', () => {
  const { g } = newGame();
  toPlay(g);
  const it = g.stage.itemPickups.find((i) => i.kind === 'vest');
  const plat = g.stage.items.find((i) => i.kind === 'vest').platform;
  place(g, plat, it.x);
  const before = g.score.value;
  g.update(DT, noInput());
  assert.equal(it.taken, true);
  assert.equal(g.score.value - before, SCORE.item.vest);
  // 다시 지나가도 점수를 또 주지 않는다
  const after = g.score.value;
  run(0.2, (dt) => g.update(dt, noInput()));
  assert.equal(g.score.value, after);
});

test('드럼통을 뛰어넘으면 점수를 주고, 같은 드럼통에 두 번 주지 않는다', () => {
  const { g } = newGame();
  toPlay(g);
  const floor = g.stage.platforms[0];
  place(g, floor, 100);
  g.player.invuln = 9999;

  const drum = new Roller({ x: 100, y: surfaceYAt(floor, 100), platform: floor, kind: 'drum' });
  g.rollers.push(drum);

  // 점프해서 드럼통 위를 지난다
  const input = noInput();
  input.jumpPressed = true;
  g.update(DT, input);
  input.jumpPressed = false;
  runUntil(2, (dt) => {
    // 드럼통을 플레이어 바로 아래에 고정해 확실히 "넘는" 상황을 만든다
    drum.x = g.player.x;
    drum.y = surfaceYAt(floor, drum.x);
    g.update(dt, input);
  }, () => g.player.state !== PS.AIR);

  assert.equal(g.score.value, SCORE.jump1);
  assert.equal(drum.scored, true);

  // 한 번 더 넘어도 추가 점수 없음
  const after = g.score.value;
  input.jumpPressed = true;
  g.update(DT, input);
  input.jumpPressed = false;
  runUntil(2, (dt) => {
    drum.x = g.player.x;
    drum.y = surfaceYAt(floor, drum.x);
    g.update(dt, input);
  }, () => g.player.state !== PS.AIR);
  assert.equal(g.score.value, after, '같은 드럼통은 한 번만');
});

test('두 개를 한 번에 넘으면 더 높은 점수를 준다', () => {
  const { g } = newGame();
  toPlay(g);
  const floor = g.stage.platforms[0];
  place(g, floor, 100);
  g.player.invuln = 9999;

  const a = new Roller({ x: 100, y: surfaceYAt(floor, 100), platform: floor, kind: 'drum' });
  const b = new Roller({ x: 100, y: surfaceYAt(floor, 100), platform: floor, kind: 'drum' });
  g.rollers.push(a, b);

  const input = noInput();
  input.jumpPressed = true;
  g.update(DT, input);
  input.jumpPressed = false;
  runUntil(2, (dt) => {
    for (const r of [a, b]) { r.x = g.player.x; r.y = surfaceYAt(floor, r.x); }
    g.update(dt, input);
  }, () => g.player.state !== PS.AIR);

  assert.equal(g.score.value, SCORE.jump2);
});

test('안전핀 스테이지 — 밟고 지나가면 발판이 사라지고 전부 없애면 완료', () => {
  const g = new Game({ seed: 3 });
  g.startGame();
  g.beginStage(3);
  toPlay(g);
  assert.equal(g.stage.kind, 'pins');
  assert.equal(g.pinsLeft, 8);

  const pins = g.stage.platforms.filter((p) => p.kind === 'pin');
  assert.equal(pins.length, 8);

  // 하나만 먼저 밟아 규칙을 확인한다
  const first = pins[0];
  const firstMid = (first.points[0][0] + first.points[1][0]) / 2;
  g.player.platform = first;
  g.player.state = PS.GROUND;
  g.player.x = firstMid;
  g.player.y = surfaceYAt(first, firstMid);
  g.player.invuln = 9999;
  g.update(DT, noInput());
  assert.equal(first.stepped, true);
  assert.equal(first.removed, false, '밟고 있는 동안에는 아직 남아 있다');

  place(g, g.stage.platforms[0], 112);
  g.player.invuln = 9999;
  g.update(DT, noInput());
  assert.equal(first.removed, true, '벗어나면 사라진다');
  assert.equal(g.pinsLeft, 7);

  // 나머지 전부 해제
  for (const p of pins) p.stepped = true;
  place(g, g.stage.platforms[0], 112);
  g.player.invuln = 9999;
  g.update(DT, noInput());
  assert.equal(g.pinsLeft, 0);
  assert.equal(g.state, GS.CLEAR);
});

test('사라진 안전핀 자리로는 지나갈 수 없다', () => {
  const g = new Game({ seed: 3 });
  g.startGame();
  g.beginStage(3);
  toPlay(g);
  const pin = g.stage.platforms.find((p) => p.kind === 'pin');
  pin.removed = true;
  assert.equal(surfaceYAt(pin, (pin.points[0][0] + pin.points[1][0]) / 2), null);

  // 구멍 위에 서 있던 플레이어는 떨어진다
  g.player.platform = pin;
  g.player.state = PS.GROUND;
  g.player.x = (pin.points[0][0] + pin.points[1][0]) / 2;
  g.player.invuln = 9999;
  g.update(DT, noInput());
  assert.equal(g.player.state, PS.AIR);
});

test('승강 발판이 순환할 때 위에 있던 것을 떨어뜨린다', () => {
  const g = new Game({ seed: 9 });
  g.startGame();
  g.beginStage(2);
  toPlay(g);
  const car = g.stage.platforms.find((p) => p.motion && p.motion.type === 'wrap');
  car.oy = car.motion.yTop + 0.2;
  g.player.platform = car;
  g.player.state = PS.GROUND;
  g.player.x = car.ox;
  g.player.y = car.oy;
  g.player.invuln = 9999;
  run(0.1, (dt) => g.update(dt, noInput()));
  assert.ok(car.oy > car.motion.yTop + 100, '아래에서 다시 올라온다');
  assert.notEqual(g.player.platform, car, '플레이어는 같이 순간이동하지 않는다');
});

test('같은 시드는 같은 전개를 만든다 (테스트 재현성)', () => {
  const rollout = (seed) => {
    const g = new Game({ seed });
    g.startGame();
    run(14, (dt) => { g.player.invuln = 9999; g.update(dt, noInput()); });
    return g.rollers.map((r) => `${r.kind}:${r.x.toFixed(3)}:${r.y.toFixed(3)}`).join('|');
  };
  assert.equal(rollout(31337), rollout(31337));
  assert.notEqual(rollout(31337), rollout(999));
});

test('네 화면 모두 만들어지고 사다리가 발판에 정확히 붙는다', () => {
  const g = new Game({ seed: 11 });
  g.startGame();
  for (let i = 0; i < 4; i++) {
    g.beginStage(i);
    const s = g.stage;
    assert.ok(s.platforms.length > 3, `stage ${i + 1} 발판`);
    for (const l of s.ladders) {
      assert.equal(l.top, surfaceYAt(l.topPlatform, l.x), `${l.id} 상단이 발판에 붙는다`);
      assert.equal(l.bottom, surfaceYAt(l.bottomPlatform, l.x), `${l.id} 하단이 발판에 붙는다`);
      assert.ok(l.bottom - l.top > 10, `${l.id} 길이`);
    }
    // 배치물이 전부 발판 위에 있다
    assert.ok(surfaceYAt(s.spawn.platform, s.spawn.x) != null);
    for (const h of s.hammerPickups) assert.ok(Number.isFinite(h.y));
    for (const it of s.itemPickups) assert.ok(Number.isFinite(it.y));
    if (s.goalPos) assert.ok(Number.isFinite(s.goalPos.y));
  }
});
