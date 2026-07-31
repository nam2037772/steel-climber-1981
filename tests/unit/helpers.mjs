/** 단위 테스트 공용 헬퍼 */

import { makePlatform, makeLadder, surfaceYAt } from '../../src/game/geometry.js';

export const DT = 1 / 120;

export const noInput = () => ({
  left: false, right: false, up: false, down: false,
  jumpPressed: false, actionPressed: false, startPressed: false, pausePressed: false,
});

/**
 * 테스트용 지형
 *   upper  y=150 (평평, 전폭)
 *   mid    y=190→200 (오른쪽이 낮은 경사, x 20..204)
 *   ground y=220 (평평, 전폭)
 *
 * mid → ground 낙차는 20~30px 이라 살고, upper → mid 낙차는 40~50px 이라 죽는다.
 */
export function makeTestStage() {
  const ground = makePlatform({ id: 'ground', points: [[0, 220], [224, 220]] });
  const mid = makePlatform({ id: 'mid', points: [[20, 190], [204, 200]] });
  const upper = makePlatform({ id: 'upper', points: [[0, 150], [224, 150]] });
  const platforms = [ground, mid, upper];
  const ladders = [
    makeLadder({ id: 'la', x: 60, bottomPlatform: ground, topPlatform: mid }),
    makeLadder({ id: 'lb', x: 120, bottomPlatform: mid, topPlatform: upper }),
    makeLadder({ id: 'broken', x: 180, bottomPlatform: ground, topPlatform: mid, gap: 12 }),
  ];
  return { platforms, ladders, ground, mid, upper, la: ladders[0], lb: ladders[1], broken: ladders[2] };
}

export function makeWorld(stage, extra = {}) {
  return {
    platforms: stage.platforms,
    ladders: stage.ladders,
    hammerActive: false,
    rng: { chance: () => false, range: (a) => a, next: () => 0, int: (a) => a, pick: (arr) => arr[0] },
    ladderDropChanceFor: () => 0,
    ...extra,
  };
}

/** seconds 초 동안 dt 스텝으로 fn 반복 */
export function run(seconds, fn, dt = DT) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) fn(dt, i);
  return n;
}

/** 조건이 만족될 때까지 돌린다. 최대 시간을 넘기면 실패로 null 반환 */
export function runUntil(maxSeconds, fn, cond, dt = DT) {
  const n = Math.round(maxSeconds / dt);
  for (let i = 0; i < n; i++) {
    fn(dt, i);
    if (cond()) return i * dt;
  }
  return null;
}

export { surfaceYAt };
