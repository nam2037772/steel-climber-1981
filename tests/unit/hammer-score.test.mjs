import test from 'node:test';
import assert from 'node:assert/strict';

import { Hammer } from '../../src/game/hammer.js';
import { Score } from '../../src/game/score.js';
import {
  HAMMER_DURATION, HAMMER_WARN, HAMMER_SWING_PERIOD, SCORE,
  BONUS_START, BONUS_STEP, BONUS_INTERVAL, START_LIVES,
} from '../../src/core/constants.js';
import { run, DT } from './helpers.mjs';

/* ── 해머 ──────────────────────────────────────────── */

test('해머는 획득하면 켜지고 시간이 다 되면 스스로 꺼진다', () => {
  const h = new Hammer();
  assert.equal(h.active, false);
  h.pickup();
  assert.equal(h.active, true);
  assert.equal(h.time, HAMMER_DURATION);

  run(HAMMER_DURATION - 0.5, (dt) => h.update(dt));
  assert.equal(h.active, true);
  run(0.6, (dt) => h.update(dt));
  assert.equal(h.active, false, '지속시간이 끝나면 꺼진다');
  assert.equal(h.time, 0);
});

test('해머가 꺼지는 프레임에 justExpired가 한 번만 선다', () => {
  const h = new Hammer();
  h.pickup(0.05);
  let expired = 0;
  run(0.5, (dt) => { h.update(dt); if (h.justExpired) expired++; });
  assert.equal(expired, 1);
});

test('타격 프레임이 주기적으로 번갈아 바뀐다', () => {
  const h = new Hammer();
  h.pickup();
  const seen = new Set();
  run(HAMMER_SWING_PERIOD * 3, (dt) => { h.update(dt); seen.add(h.frame); });
  assert.deepEqual([...seen].sort(), [0, 1]);
});

test('ACTION 키로 타격 프레임을 즉시 바꿀 수 있다', () => {
  const h = new Hammer();
  assert.equal(h.forceSwing(), false, '해머가 없으면 아무 일도 없다');
  h.pickup();
  const before = h.frame;
  assert.equal(h.forceSwing(), true);
  assert.notEqual(h.frame, before);
  assert.equal(h.swing, 0);
});

test('남은 시간이 짧아지면 경고 상태가 된다', () => {
  const h = new Hammer();
  h.pickup();
  assert.equal(h.warning, false);
  run(HAMMER_DURATION - HAMMER_WARN + 0.1, (dt) => h.update(dt));
  assert.equal(h.warning, true);
});

test('타격 상자는 프레임과 방향에 따라 달라진다', () => {
  const h = new Hammer();
  assert.equal(h.hitBox({ x: 100, y: 200, facing: 1 }), null, '비활성이면 상자가 없다');
  h.pickup();

  h.frame = 0;
  const front = h.hitBox({ x: 100, y: 200, facing: 1 });
  assert.ok(front.l > 100, '앞으로 내려칠 때는 앞쪽');
  assert.ok(front.b >= 200 - 1, '발밑을 친다');

  const frontLeft = h.hitBox({ x: 100, y: 200, facing: -1 });
  assert.ok(frontLeft.r < 100, '왼쪽을 보면 왼쪽을 친다');

  h.frame = 1;
  const up = h.hitBox({ x: 100, y: 200, facing: 1 });
  assert.ok(up.t < front.t, '위로 치켜들면 더 높은 곳을 친다');
});

test('reset은 해머 상태를 완전히 초기화한다', () => {
  const h = new Hammer();
  h.pickup();
  run(1, (dt) => h.update(dt));
  h.reset();
  assert.deepEqual(
    { active: h.active, time: h.time, frame: h.frame, swing: h.swing },
    { active: false, time: 0, frame: 0, swing: 0 },
  );
  assert.equal(h.hitBox({ x: 0, y: 0, facing: 1 }), null);
});

/* ── 점수 ──────────────────────────────────────────── */

test('점수를 더하면 최고 점수가 따라 올라간다', () => {
  const s = new Score(500);
  s.add(300);
  assert.equal(s.value, 300);
  assert.equal(s.high, 500, '최고 점수는 아직 그대로');
  assert.equal(s.newHigh, false);
  s.add(400);
  assert.equal(s.high, 700);
  assert.equal(s.newHigh, true);
});

test('추가 생명은 기준 점수에서 딱 한 번만 준다', () => {
  const s = new Score(0);
  assert.equal(s.lives, START_LIVES);
  assert.equal(s.add(SCORE.extraLifeAt - 1), false);
  assert.equal(s.lives, START_LIVES);
  assert.equal(s.add(1), true);
  assert.equal(s.lives, START_LIVES + 1);
  assert.equal(s.add(SCORE.extraLifeAt), false, '두 번째는 주지 않는다');
  assert.equal(s.lives, START_LIVES + 1);
});

test('점프 점수는 동시에 넘은 개수에 따라 커진다', () => {
  const s = new Score(0);
  assert.equal(s.jumpBonus(0), 0);
  assert.equal(s.jumpBonus(1), SCORE.jump1);
  assert.equal(s.jumpBonus(2), SCORE.jump2);
  assert.equal(s.jumpBonus(3), SCORE.jump3);
  assert.equal(s.jumpBonus(5), SCORE.jump3);
  assert.ok(SCORE.jump2 > SCORE.jump1 * 2, '두 개를 한 번에 넘으면 이득이다');
});

test('BONUS는 일정 간격으로 줄고 0이 되면 시간 초과를 알린다', () => {
  const s = new Score(0);
  s.startStage(BONUS_START);
  assert.equal(s.tickBonus(BONUS_INTERVAL - 0.01), false);
  assert.equal(s.bonus, BONUS_START);
  assert.equal(s.tickBonus(0.02), false);
  assert.equal(s.bonus, BONUS_START - BONUS_STEP);

  const total = (BONUS_START / BONUS_STEP) * BONUS_INTERVAL;
  let out = false;
  run(total + 1, (dt) => { out = s.tickBonus(dt) || out; }, DT);
  assert.equal(out, true);
  assert.equal(s.bonus, 0);
});

test('스테이지를 깨면 남은 BONUS가 점수로 들어온다', () => {
  const s = new Score(0);
  s.startStage(4000);
  s.tickBonus(BONUS_INTERVAL * 5);
  const left = s.bonus;
  const { gained } = s.clearStage();
  assert.equal(gained, left);
  assert.equal(s.value, left);
  assert.equal(s.bonus, 0);
});

test('생명이 0이 되면 게임 오버를 알린다', () => {
  const s = new Score(0);
  assert.equal(s.loseLife(), false);
  assert.equal(s.lives, START_LIVES - 1);
  s.loseLife();
  assert.equal(s.loseLife(), true);
  assert.equal(s.lives, 0);
});

test('reset은 점수를 지우지만 최고 점수는 남긴다', () => {
  const s = new Score(1000);
  s.add(5000);
  s.loseLife();
  s.reset();
  assert.equal(s.value, 0);
  assert.equal(s.lives, START_LIVES);
  assert.equal(s.high, 5000, '최고 점수는 유지');
  assert.equal(s.extraLifeGiven, false);
});
