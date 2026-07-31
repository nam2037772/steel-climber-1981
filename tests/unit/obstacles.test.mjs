import test from 'node:test';
import assert from 'node:assert/strict';

import { Roller, FallingTool } from '../../src/game/obstacles.js';
import { Spark } from '../../src/game/enemies.js';
import { makePlatform, surfaceYAt } from '../../src/game/geometry.js';
import { GAME_H } from '../../src/core/constants.js';
import { makeTestStage, makeWorld, run, runUntil, DT } from './helpers.mjs';

const always = { chance: () => true, range: (a) => a, next: () => 0, int: (a) => a, pick: (arr) => arr[0] };
const never = { chance: () => false, range: (a) => a, next: () => 0, int: (a) => a, pick: (arr) => arr[0] };

test('드럼통은 경사가 낮은 쪽으로 굴러간다', () => {
  const right = makePlatform({ points: [[0, 100], [200, 116]] });
  const left = makePlatform({ points: [[0, 116], [200, 100]] });
  const w = makeWorld({ platforms: [right, left], ladders: [] }, { rng: never });

  const a = new Roller({ x: 100, y: surfaceYAt(right, 100), platform: right, dir: -1 });
  a.update(DT, w);
  assert.equal(a.dir, 1, '오른쪽이 낮으면 오른쪽으로');

  const b = new Roller({ x: 100, y: surfaceYAt(left, 100), platform: left, dir: 1 });
  b.update(DT, w);
  assert.equal(b.dir, -1, '왼쪽이 낮으면 왼쪽으로');
});

test('경사가 가파를수록 빨리 구른다', () => {
  const gentle = makePlatform({ points: [[0, 100], [200, 104]] });
  const steep = makePlatform({ points: [[0, 100], [200, 140]] });
  const a = new Roller({ x: 50, y: 101, platform: gentle });
  const b = new Roller({ x: 50, y: 110, platform: steep });
  assert.ok(b.speedOn(steep) > a.speedOn(gentle));
});

test('드럼통이 굴러가면 회전 각도가 쌓인다', () => {
  const p = makePlatform({ points: [[0, 100], [200, 110]] });
  const w = makeWorld({ platforms: [p], ladders: [] }, { rng: never });
  const r = new Roller({ x: 20, y: surfaceYAt(p, 20), platform: p });
  run(1, (dt) => r.update(dt, w));
  assert.ok(r.rot > 5, '회전 애니메이션이 진행된다');
});

test('발판 끝에 닿으면 떨어져 아래층에 다시 얹힌다', () => {
  const upper = makePlatform({ id: 'u', points: [[40, 100], [180, 112]] });
  const lower = makePlatform({ id: 'l', points: [[0, 150], [224, 140]] });
  const w = makeWorld({ platforms: [upper, lower], ladders: [] }, { rng: never });
  const r = new Roller({ x: 170, y: surfaceYAt(upper, 170), platform: upper });

  const fell = runUntil(3, (dt) => r.update(dt, w), () => r.state === 'fall');
  assert.ok(fell !== null, '끝에서 낙하 상태가 된다');
  const landed = runUntil(3, (dt) => r.update(dt, w), () => r.platform === lower);
  assert.ok(landed !== null, '아래 발판에 착지한다');
  assert.equal(r.dir, -1, '아래 발판은 왼쪽이 낮으므로 방향이 바뀐다');
});

test('가장자리에서 떨어질 때 방금 나온 발판에 다시 얹히지 않는다', () => {
  // 화면 끝까지 이어진 발판 — 안쪽으로 당겨진 x에서 같은 발판을 다시 잡으면 제자리를 맴돈다
  const floor = makePlatform({ id: 'f', points: [[0, 200], [224, 206]] });
  const w = makeWorld({ platforms: [floor], ladders: [] }, { rng: never });
  const r = new Roller({ x: 215, y: surfaceYAt(floor, 215), platform: floor });
  const gone = runUntil(6, (dt) => r.update(dt, w), () => !r.alive);
  assert.ok(gone !== null, '화면 밖으로 사라진다 (무한 반복 없음)');
  assert.ok(r.y > GAME_H);
});

test('사다리 입구에서 확률이 맞으면 아래층으로 내려간다', () => {
  const s = makeTestStage();
  const w = makeWorld(s, { rng: always, ladderDropChanceFor: () => 1 });
  // mid 위를 굴러가다 x=60 의 사다리(la: ground→mid)를 만난다
  const r = new Roller({ x: 40, y: surfaceYAt(s.mid, 40), platform: s.mid, dir: 1 });
  const took = runUntil(3, (dt) => r.update(dt, w), () => r.state === 'ladder');
  assert.ok(took !== null, '사다리를 탄다');
  assert.equal(r.x, 60);

  const done = runUntil(3, (dt) => r.update(dt, w), () => r.state === 'roll');
  assert.ok(done !== null, '아래층에 도착해 다시 구른다');
  assert.equal(r.platform, s.ground);
});

test('확률이 0이면 사다리를 타지 않고 지나간다', () => {
  const s = makeTestStage();
  const w = makeWorld(s, { rng: never, ladderDropChanceFor: () => 0 });
  const r = new Roller({ x: 40, y: surfaceYAt(s.mid, 40), platform: s.mid, dir: 1 });
  run(1.5, (dt) => r.update(dt, w));
  assert.equal(r.state, 'roll');
  assert.ok(r.x > 60, '사다리를 지나쳐 계속 굴러간다');
});

test('같은 사다리에서 확률 판정을 매 프레임 반복하지 않는다', () => {
  const s = makeTestStage();
  let calls = 0;
  const w = makeWorld(s, {
    rng: never,
    ladderDropChanceFor: () => { calls++; return 0; },
  });
  const r = new Roller({ x: 40, y: surfaceYAt(s.mid, 40), platform: s.mid, dir: 1 });
  run(2.5, (dt) => r.update(dt, w));
  assert.ok(calls <= 2, `사다리당 한 번만 판정 (호출 ${calls}회)`);
});

test('끊어진 사다리로는 내려가지 않는다', () => {
  const s = makeTestStage();
  const w = makeWorld(s, { rng: always, ladderDropChanceFor: () => 1 });
  // broken(x=180) 만 있는 구간에서 출발 (la는 x=60이므로 지나치지 않게 오른쪽에서 시작)
  const r = new Roller({ x: 170, y: surfaceYAt(s.mid, 170), platform: s.mid, dir: 1 });
  run(1, (dt) => r.update(dt, w));
  assert.notEqual(r.state, 'ladder', '끊어진 사다리는 후보가 아니다');
});

test('운반장치 위에서는 벨트 방향으로 실려 간다', () => {
  const belt = makePlatform({ points: [[20, 150], [180, 150]], belt: -40 });
  const w = makeWorld({ platforms: [belt], ladders: [] }, { rng: never });
  const r = new Roller({ x: 100, y: 150, platform: belt, kind: 'crate', dir: 1 });
  run(0.5, (dt) => r.update(dt, w));
  assert.equal(r.dir, -1);
  assert.ok(r.x < 100 - 15, '벨트 속도로 왼쪽으로 이동');
});

test('난이도 배수가 이동 속도에 반영된다', () => {
  const p = makePlatform({ points: [[0, 100], [200, 110]] });
  const slow = new Roller({ x: 50, y: 102, platform: p, speedMul: 1 });
  const fast = new Roller({ x: 50, y: 102, platform: p, speedMul: 1.5 });
  assert.ok(Math.abs(fast.speedOn(p) / slow.speedOn(p) - 1.5) < 1e-9);
});

test('낙하 공구는 떨어지다 화면 밖에서 사라진다', () => {
  const t = new FallingTool({ x: 100, y: 30, speed: 120 });
  run(1, (dt) => t.update(dt));
  assert.ok(t.y > 140);
  assert.ok(t.spin > 0);
  runUntil(5, (dt) => t.update(dt), () => !t.alive);
  assert.equal(t.alive, false);
});

/* ── 이동형 적 ─────────────────────────────────────── */

test('불꽃은 플레이어 쪽으로 천천히 이동한다', () => {
  const s = makeTestStage();
  const player = { x: 200, y: 220 };
  const w = makeWorld(s, { player, rng: { ...never, range: () => 0 } });
  const sp = new Spark({ x: 40, y: 220, platform: s.ground, rng: never });
  run(2, (dt) => sp.update(dt, w));
  assert.ok(sp.x > 60 && sp.x < 130, `2초에 ${(sp.x - 40).toFixed(0)}px — 플레이어(52px/s)보다 느리다`);
});

test('불꽃은 판단 간격 동안 방향을 유지한다 (즉시 반응하지 않는다)', () => {
  const s = makeTestStage();
  const player = { x: 200, y: 220 };
  const w = makeWorld(s, { player, rng: { ...never, range: () => 0 } });
  const sp = new Spark({ x: 100, y: 220, platform: s.ground, rng: null });
  run(0.6, (dt) => sp.update(dt, w));
  assert.equal(sp.dir, 1);
  // 플레이어가 순간이동해도 다음 판단 시점까지는 방향을 유지한다
  player.x = 10;
  sp.update(DT, w);
  assert.equal(sp.dir, 1, '판단 간격 안에서는 그대로');
  run(0.6, (dt) => sp.update(dt, w));
  assert.equal(sp.dir, -1, '판단 시점이 지나면 방향을 바꾼다');
});

test('불꽃은 발판 끝에서 떨어지지 않고 돌아선다', () => {
  const s = makeTestStage();
  const player = { x: 300, y: 190 };
  const w = makeWorld(s, { player, rng: { ...never, range: () => 0 } });
  const sp = new Spark({ x: 200, y: surfaceYAt(s.mid, 200), platform: s.mid, rng: null });
  run(4, (dt) => sp.update(dt, w));
  assert.equal(sp.platform, s.mid, '여전히 같은 발판 위');
  assert.ok(sp.x <= 204, '구간 밖으로 나가지 않는다');
  assert.ok(sp.alive);
});

test('불꽃은 사다리로 층을 옮긴다', () => {
  const s = makeTestStage();
  const player = { x: 60, y: 190 }; // 위층
  const w = makeWorld(s, { player, rng: always });
  const sp = new Spark({ x: 60, y: 220, platform: s.ground, rng: null });
  const climbed = runUntil(3, (dt) => sp.update(dt, w), () => sp.platform === s.mid);
  assert.ok(climbed !== null, '사다리를 타고 위층으로 올라간다');
});

test('발판이 사라지면 그 위의 불꽃도 사라진다 (안전핀 해제)', () => {
  const pin = makePlatform({ id: 'pin', points: [[40, 200], [60, 200]], kind: 'pin' });
  const w = makeWorld({ platforms: [pin], ladders: [] }, { player: { x: 50, y: 200 }, rng: never });
  const sp = new Spark({ x: 50, y: 200, platform: pin, rng: null });
  sp.update(DT, w);
  assert.ok(sp.alive);
  pin.removed = true;
  sp.update(DT, w);
  assert.equal(sp.alive, false);
});
