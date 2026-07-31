/**
 * 이동형 적 — 용접 불꽃과 점검 드론.
 *
 * 발판 위를 걸어 다니며 플레이어를 쫓고 사다리도 오르내린다.
 * 다만 **완벽하게 따라붙지 않는다.**
 *  - 0.55초마다 한 번만 방향을 다시 판단한다 (그 사이에는 판단을 유지)
 *  - 목표 x에 ±10px 오차를 준다
 *  - 사다리를 만나도 매번 타지는 않는다
 * 덕분에 유인해서 따돌릴 수 있고, 예측 가능한 패턴 플레이가 성립한다.
 *
 * 발판이 끊긴 곳(경사 끝, 해제된 안전핀 구멍)에서는 떨어지지 않고 돌아선다.
 */

import { GAME_W, SPARK_W, SPARK_H } from '../core/constants.js';
import { surfaceYAt, boxOf, clamp } from './geometry.js';

const WALK = { spark: 26, drone: 32 };
const CLIMB = 24;
const THINK_INTERVAL = 0.55;
const AIM_ERROR = 10;
const LADDER_URGE = 0.45;

let seq = 1;

export class Spark {
  constructor({ x, y, platform, kind = 'spark', speedMul = 1, rng }) {
    this.id = `s${seq++}`;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.platform = platform;
    this.speedMul = speedMul;
    this.state = 'walk';
    this.dir = 1;
    this.climbDir = 0;
    this.ladder = null;
    this.alive = true;
    this.anim = 0;
    this.think = rng ? rng.range(0, THINK_INTERVAL) : 0;
    this.targetX = x;
    this.wantUp = false;
    this.wantDown = false;
    this.ladderUrge = false;
  }

  get box() {
    // 스프라이트보다 조금 작게 — 불꽃 가장자리에 스쳐도 죽지 않게
    return boxOf(this.x, this.y, SPARK_W - 2, SPARK_H - 2);
  }

  get speed() {
    return (WALK[this.kind] || WALK.spark) * this.speedMul;
  }

  update(dt, world) {
    if (!this.alive) return;
    this.anim += dt * 12;

    this.think -= dt;
    if (this.think <= 0) {
      this.think = THINK_INTERVAL;
      this._decide(world);
    }

    if (this.state === 'walk') this._walk(dt, world);
    else this._climb(dt);
  }

  _decide(world) {
    const p = world.player;
    if (!p) return;
    this.targetX = p.x + world.rng.range(-AIM_ERROR, AIM_ERROR);
    const dy = p.y - this.y;
    this.wantUp = dy < -12;
    this.wantDown = dy > 12;
    this.ladderUrge = world.rng.chance(LADDER_URGE);
  }

  _walk(dt, world) {
    const p = this.platform;
    if (!p || p.removed) {
      // 밟고 있던 발판이 사라졌다 (안전핀 해제) → 불꽃도 같이 사라진다
      this.alive = false;
      return;
    }

    // 사다리로 층을 바꿀지 먼저 판단
    if (this.ladderUrge && (this.wantUp || this.wantDown)) {
      for (const l of world.ladders) {
        if (Math.abs(l.x - this.x) > 3) continue;
        if (l.broken) continue;
        if (this.wantUp && l.bottomPlatform === p) {
          this._enterLadder(l, -1);
          return;
        }
        if (this.wantDown && l.topPlatform === p) {
          this._enterLadder(l, 1);
          return;
        }
      }
    }

    const diff = this.targetX - this.x;
    this.dir = Math.abs(diff) < 3 ? 0 : Math.sign(diff);
    if (this.dir === 0) return;

    const nx = clamp(this.x + this.dir * this.speed * dt, SPARK_W / 2, GAME_W - SPARK_W / 2);
    const sy = surfaceYAt(p, nx);
    if (sy == null) {
      // 발판 끝 / 구멍 — 떨어지지 않고 돌아선다
      this.dir = -this.dir;
      this.targetX = this.x + this.dir * 32;
      return;
    }
    this.x = nx;
    this.y = sy;
  }

  _enterLadder(l, climbDir) {
    this.state = 'ladder';
    this.ladder = l;
    this.climbDir = climbDir;
    this.x = l.x;
    this.y = climbDir < 0 ? l.bottom - 0.5 : l.top + 0.5;
    this.platform = null;
  }

  _climb(dt) {
    const l = this.ladder;
    if (!l) { this.state = 'walk'; return; }
    this.y += this.climbDir * CLIMB * this.speedMul * dt;
    this.x = l.x;
    if (this.climbDir < 0 && this.y <= l.top) {
      this.y = l.top;
      this.platform = l.topPlatform;
      this.state = 'walk';
      this.ladder = null;
    } else if (this.climbDir > 0 && this.y >= l.bottom) {
      this.y = l.bottom;
      this.platform = l.bottomPlatform;
      this.state = 'walk';
      this.ladder = null;
    }
  }
}

export function _resetEnemyIdsForTest() {
  seq = 1;
}
