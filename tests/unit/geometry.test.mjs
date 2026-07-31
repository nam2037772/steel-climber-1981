import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makePlatform, makeLadder, surfaceYAt, slopeAt, lowEndX, isFlat,
  platformSpan, platformCoversX, platformBelow, findLanding, standingOn,
  ladderAt, overLadder, boxOf, boxesOverlap, clamp,
} from '../../src/game/geometry.js';
import { makeTestStage } from './helpers.mjs';

test('평평한 발판의 표면 y는 어디서나 같다', () => {
  const p = makePlatform({ points: [[0, 100], [224, 100]] });
  assert.equal(surfaceYAt(p, 0), 100);
  assert.equal(surfaceYAt(p, 112), 100);
  assert.equal(surfaceYAt(p, 224), 100);
  assert.ok(isFlat(p));
});

test('경사 발판은 x에 따라 선형으로 내려간다', () => {
  const p = makePlatform({ points: [[0, 100], [200, 120]] });
  assert.equal(surfaceYAt(p, 0), 100);
  assert.equal(surfaceYAt(p, 100), 110);
  assert.equal(surfaceYAt(p, 200), 120);
  assert.ok(!isFlat(p));
});

test('꺾인 발판은 구간마다 다른 기울기를 가진다', () => {
  const p = makePlatform({ points: [[0, 100], [100, 104], [200, 124]] });
  assert.equal(surfaceYAt(p, 50), 102);
  assert.equal(surfaceYAt(p, 150), 114);
  assert.ok(Math.abs(slopeAt(p, 50) - 0.04) < 1e-9);
  assert.ok(Math.abs(slopeAt(p, 150) - 0.2) < 1e-9);
});

test('발판 구간 밖에서는 표면이 없다 (null)', () => {
  const p = makePlatform({ points: [[20, 100], [180, 100]] });
  assert.equal(surfaceYAt(p, 19.9), null);
  assert.equal(surfaceYAt(p, 180.1), null);
  assert.equal(surfaceYAt(p, 20), 100);
  assert.deepEqual(platformSpan(p), [20, 180]);
  assert.ok(platformCoversX(p, 100));
  assert.ok(!platformCoversX(p, 10));
});

test('제거된 발판은 표면이 사라진다 (안전핀 해제)', () => {
  const p = makePlatform({ points: [[0, 100], [50, 100]], kind: 'pin' });
  assert.equal(surfaceYAt(p, 25), 100);
  p.removed = true;
  assert.equal(surfaceYAt(p, 25), null);
  assert.ok(!platformCoversX(p, 25));
});

test('오프셋(승강 발판)이 표면과 구간에 반영된다', () => {
  const p = makePlatform({ points: [[-18, 0], [18, 0]] });
  p.ox = 100;
  p.oy = 60;
  assert.deepEqual(platformSpan(p), [82, 118]);
  assert.equal(surfaceYAt(p, 100), 60);
  assert.equal(surfaceYAt(p, 81), null);
  p.oy = 90;
  assert.equal(surfaceYAt(p, 100), 90);
});

test('기울기 부호와 낮은 쪽 끝', () => {
  const right = makePlatform({ points: [[0, 100], [100, 110]] });
  const left = makePlatform({ points: [[0, 110], [100, 100]] });
  assert.ok(slopeAt(right, 50) > 0);
  assert.ok(slopeAt(left, 50) < 0);
  assert.equal(lowEndX(right), 100);
  assert.equal(lowEndX(left), 0);
});

test('platformBelow는 바로 아래 발판을 고른다', () => {
  const s = makeTestStage();
  const below = platformBelow(s.platforms, 100, 160);
  assert.equal(below.id, 'mid');
  const below2 = platformBelow(s.platforms, 100, 199);
  assert.equal(below2.id, 'ground');
  assert.equal(platformBelow(s.platforms, 100, 240), null);
});

test('findLanding은 표면을 지나친 경우에만 착지시킨다 (스윕)', () => {
  const s = makeTestStage();
  // 한 스텝에 100px 이동해도 통과하지 않고 잡힌다
  const hit = findLanding(s.platforms, 100, 120, 220);
  assert.equal(hit.platform.id, 'upper');
  // 위로 올라가는 중에는 착지하지 않는다
  assert.equal(findLanding(s.platforms, 100, 220, 120), null);
  // 표면에 못 미치면 착지 없음
  assert.equal(findLanding(s.platforms, 100, 120, 149), null);
});

test('standingOn은 표면 근처일 때만 발판을 돌려준다', () => {
  const s = makeTestStage();
  assert.equal(standingOn(s.platforms, 100, 220).id, 'ground');
  assert.equal(standingOn(s.platforms, 100, 210), null);
});

test('사다리 끝 y는 발판 표면에서 계산된다', () => {
  const s = makeTestStage();
  assert.equal(s.la.bottom, surfaceYAt(s.ground, 60));
  assert.equal(s.la.top, surfaceYAt(s.mid, 60));
  assert.ok(s.la.top < s.la.bottom);
});

test('사다리 구간을 벗어난 x는 만들 때 걸린다', () => {
  const s = makeTestStage();
  assert.throws(() => makeLadder({ x: 10, bottomPlatform: s.ground, topPlatform: s.mid }));
});

test('사다리 진입: 발판 위 + 중심 ±4px + 올바른 방향', () => {
  const s = makeTestStage();
  // 아래에서 위로
  assert.ok(ladderAt(s.ladders, 60, s.la.bottom, 'up', true));
  assert.ok(ladderAt(s.ladders, 63.9, s.la.bottom, 'up', true));
  assert.equal(ladderAt(s.ladders, 65, s.la.bottom, 'up', true), null, '중심에서 5px 벗어나면 못 탄다');
  // 위에서 아래로
  assert.ok(ladderAt(s.ladders, 60, s.la.top, 'down', true));
  // 발판에서 떨어진 높이에서는 못 탄다
  assert.equal(ladderAt(s.ladders, 60, s.la.bottom - 10, 'up', true), null);
});

test('점프·낙하 중(onGround=false)에는 사다리를 잡지 못한다', () => {
  const s = makeTestStage();
  const midY = (s.la.top + s.la.bottom) / 2;
  // 이미 매달려 있는 상태(onGround=false)에서는 계속 오를 수 있어야 한다
  assert.ok(ladderAt(s.ladders, 60, midY, 'up', false));
  // 그러나 발판 위가 아닌 상태에서 사다리 하단 근처에 "새로" 붙지는 않는다
  assert.equal(ladderAt(s.ladders, 60, s.la.bottom + 6, 'up', false), null);
});

test('끊어진 사다리는 위에서 탈 수 없고 usableTop이 위쪽에 있다', () => {
  const s = makeTestStage();
  assert.equal(ladderAt(s.ladders, 180, s.broken.top, 'down', true), null, '위에서 내려올 수 없다');
  assert.ok(ladderAt(s.ladders, 180, s.broken.bottom, 'up', true), '아래에서는 올라갈 수 있다');
  assert.ok(s.broken.broken);
  assert.equal(s.broken.usableTop, s.broken.top + 12);
});

test('overLadder는 지금 밟고 있는 발판에서 내려가는 사다리만 고른다', () => {
  const s = makeTestStage();
  // mid 위에서 x=120 → lb(mid→upper)는 topPlatform이 upper라 후보가 아니다
  assert.equal(overLadder(s.ladders, 120, s.mid), null);
  // mid 위에서 x=60 → la(ground→mid)의 topPlatform이 mid이므로 후보
  assert.equal(overLadder(s.ladders, 60, s.mid).id, 'la');
  // 끊어진 사다리로는 내려가지 않는다
  assert.equal(overLadder(s.ladders, 180, s.mid), null);
  // 허용 오차 밖
  assert.equal(overLadder(s.ladders, 65, s.mid), null);
});

test('충돌 상자는 중심x·발바닥y 기준이고 겹침 판정이 정확하다', () => {
  const a = boxOf(100, 200, 10, 20);
  assert.deepEqual(a, { l: 95, r: 105, t: 180, b: 200 });
  assert.ok(boxesOverlap(a, boxOf(109, 200, 10, 20)));
  assert.ok(!boxesOverlap(a, boxOf(110, 200, 10, 20)), '가장자리가 닿기만 하면 겹치지 않는다');
  assert.ok(!boxesOverlap(a, boxOf(100, 175, 10, 20)));
});

test('clamp', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});
