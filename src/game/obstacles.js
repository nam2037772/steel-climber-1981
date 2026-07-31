/**
 * 굴러오는 장애물과 낙하 공구.
 *
 * Roller 하나로 세 가지를 표현한다.
 *  - drum  : 철제 드럼통 (경사 철골을 굴러 내려간다)
 *  - reel  : 케이블 릴 (더 빠르고 사다리를 잘 탄다)
 *  - crate : 자재 (운반장치 벨트에 실려 이동한다)
 *
 * 이동 원리
 *  - 경사 발판 위에서는 **기울기가 낮은 쪽**으로 굴러간다. 가파를수록 빠르다.
 *  - 운반장치 위에서는 벨트 방향으로 실려 간다.
 *  - 발판 끝(표면이 없어지는 지점)에 닿으면 아래층으로 떨어진다.
 *  - 사다리 입구를 지날 때 일정 확률로 사다리를 타고 아래층으로 내려간다.
 */

import { GRAVITY, MAX_FALL_SPEED, DRUM_R, GAME_W, GAME_H } from '../core/constants.js';
import {
  surfaceYAt, slopeAt, findLanding, overLadder, boxOf, clamp,
} from './geometry.js';

/** 굴러가는 기본 속도 (px/s) */
const ROLL_BASE = { drum: 48, reel: 56, crate: 0 };
/** 기울기에 따른 가속 상한 */
const SLOPE_GAIN = 8;
const SLOPE_MAX = 0.55;
/** 사다리를 타고 내려가는 속도 */
const LADDER_SPEED = 34;
/** 낙하 중 남기는 수평 속도 비율 */
const FALL_DRAG = 0;

let seq = 1;

export class Roller {
  constructor({ x, y, platform, kind = 'drum', dir = 1, speedMul = 1 }) {
    this.id = `r${seq++}`;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.platform = platform;
    this.dir = dir;
    this.speedMul = speedMul;
    this.state = platform ? 'roll' : 'fall';
    this.vy = 0;
    this.vx = 0;
    this.leftPlatform = null;
    this.rot = 0;
    this.alive = true;
    /** 점프 점수를 이미 받았는가 (중복 지급 방지) */
    this.scored = false;
    /** 방금 판정한 사다리 — 같은 사다리를 매 프레임 다시 굴리지 않는다 */
    this.lastLadderId = null;
    this.ladder = null;
    this.r = kind === 'crate' ? 6 : DRUM_R;
  }

  get box() {
    const w = this.kind === 'crate' ? 12 : this.r * 2;
    const h = this.kind === 'crate' ? 11 : this.r * 2;
    return boxOf(this.x, this.y, w, h);
  }

  /** 현재 이동 속도(절대값) */
  speedOn(platform) {
    if (platform && platform.belt) return Math.abs(platform.belt) * this.speedMul;
    const base = ROLL_BASE[this.kind] || 42;
    const s = Math.min(Math.abs(slopeAt(platform, this.x)) * SLOPE_GAIN, SLOPE_MAX);
    return base * (1 + s) * this.speedMul;
  }

  update(dt, world) {
    if (!this.alive) return;
    switch (this.state) {
      case 'roll': this._roll(dt, world); break;
      case 'fall': this._fall(dt, world); break;
      case 'ladder': this._ladder(dt, world); break;
      default: break;
    }
    if (this.y > GAME_H + 12) this.alive = false;
  }

  _roll(dt, world) {
    const p = this.platform;
    if (!p || p.removed) { this._beginFall(); return; }

    if (p.belt) {
      this.dir = Math.sign(p.belt);
    } else {
      const s = slopeAt(p, this.x);
      if (s > 0.0005) this.dir = 1;
      else if (s < -0.0005) this.dir = -1;
      // 평평하면 방향 유지
    }

    const v = this.speedOn(p) * this.dir;
    this.x += v * dt;
    this.rot += (v * dt) / this.r;

    const sy = surfaceYAt(p, this.x);
    if (sy == null) { this._beginFall(); return; }
    this.y = sy;

    // 사다리 하강 판정 — 사다리 입구에 새로 들어섰을 때 한 번만
    const l = overLadder(world.ladders, this.x, p, 3);
    if (l) {
      if (this.lastLadderId !== l.id) {
        this.lastLadderId = l.id;
        if (world.rng.chance(world.ladderDropChanceFor(l))) {
          this.state = 'ladder';
          this.ladder = l;
          this.x = l.x;
          this.y = l.top;
          this.platform = null;
          return;
        }
      }
    } else {
      this.lastLadderId = null;
    }
  }

  _beginFall() {
    this.state = 'fall';
    this.vy = 0;
    this.vx = 0;
    // 방금 굴러 나온 발판 — 화면 가장자리에서 같은 발판에 다시 착지해
    // 제자리를 맴도는 것을 막는다
    this.leftPlatform = this.platform;
    this.platform = null;
    // 화면 밖으로 나가면 아래 발판을 못 찾으므로 살짝 안으로 당긴다
    this.x = clamp(this.x, 3, GAME_W - 3);
  }

  _fall(dt, world) {
    this.x += this.vx * FALL_DRAG * dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL_SPEED);
    const y0 = this.y;
    this.y += this.vy * dt;
    this.rot += dt * 5;

    const hit = findLanding(world.platforms, this.x, y0, this.y, this.leftPlatform);
    if (hit) {
      this.y = hit.y;
      this.platform = hit.platform;
      this.state = 'roll';
      this.vy = 0;
      this.lastLadderId = null;
      this.leftPlatform = null;
      const s = slopeAt(hit.platform, this.x);
      if (s !== 0) this.dir = s > 0 ? 1 : -1;
      else if (hit.platform.belt) this.dir = Math.sign(hit.platform.belt);
    }
  }

  _ladder(dt, world) {
    const l = this.ladder;
    this.y += LADDER_SPEED * this.speedMul * dt;
    this.rot += dt * 3;
    if (this.y >= l.bottom) {
      this.y = l.bottom;
      this.platform = l.bottomPlatform;
      this.state = 'roll';
      this.ladder = null;
      this.lastLadderId = l.id;
      const s = slopeAt(this.platform, this.x);
      if (s !== 0) this.dir = s > 0 ? 1 : -1;
      void world;
    }
  }
}

/**
 * 위에서 떨어지는 공구 (3단계).
 * 굴러가지 않고 수직으로만 떨어진다.
 */
export class FallingTool {
  constructor({ x, y, speed = 100 }) {
    this.id = `t${seq++}`;
    this.x = x;
    this.y = y;
    this.vy = speed;
    this.spin = 0;
    this.alive = true;
    this.scored = false;
    this.kind = 'tool';
  }

  get box() {
    return boxOf(this.x, this.y, 8, 10);
  }

  update(dt) {
    this.y += this.vy * dt;
    this.spin += dt * 9;
    if (this.y > GAME_H + 10) this.alive = false;
  }
}

/** 테스트에서 id가 예측 가능하도록 시퀀스를 되돌린다 */
export function _resetIdsForTest() {
  seq = 1;
}
