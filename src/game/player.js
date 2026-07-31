/**
 * 플레이어(안전모를 쓴 현장 기술자)의 상태 기계.
 *
 * 상태: ground(발판 위) · air(점프/낙하) · ladder(사다리) · dead
 *
 * 당시 오락실 감각을 위해 의도적으로 넣은 제약
 *  - 관성 없음. 레버를 놓으면 그 즉시 선다.
 *  - **공중에서 방향을 바꿀 수 없다.** 점프는 이륙 순간의 속도로 고정된다.
 *  - 점프/낙하 중에는 사다리를 잡지 못한다.
 *  - 해머를 들고 있으면 점프도 사다리도 불가능하다.
 */

import {
  WALK_SPEED, CLIMB_SPEED, JUMP_VY, GRAVITY, MAX_FALL_SPEED,
  FALL_DEATH_DIST, PLAYER_W, PLAYER_H, PLAYER_HIT_W, PLAYER_HIT_H,
  GAME_W, GAME_H,
} from '../core/constants.js';
import { surfaceYAt, findLanding, ladderAt, boxOf, clamp } from './geometry.js';

export const PS = {
  GROUND: 'ground',
  AIR: 'air',
  LADDER: 'ladder',
  DEAD: 'dead',
};

export class Player {
  constructor() {
    this.reset({ x: 0, y: 0, platform: null });
  }

  reset({ x, y, platform }) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    /** 공중에서 고정되는 수평 속도 */
    this.airVx = 0;
    this.state = PS.GROUND;
    this.platform = platform;
    this.ladder = null;
    this.facing = 1;
    /** 낙하 판정용 — 공중에 뜬 뒤 도달한 가장 높은 지점 */
    this.apexY = y;
    this.walkAnim = 0;
    this.climbAnim = 0;
    this.deadTimer = 0;
    this.invuln = 0;
    this.dieCause = null;
  }

  get onGround() {
    return this.state === PS.GROUND;
  }

  get alive() {
    return this.state !== PS.DEAD;
  }

  /** 충돌상자 — 스프라이트(12×16)보다 작은 8×13 */
  get box() {
    return boxOf(this.x, this.y, PLAYER_HIT_W, PLAYER_HIT_H);
  }

  /** 그리기용 상자 */
  get drawBox() {
    return boxOf(this.x, this.y, PLAYER_W, PLAYER_H);
  }

  kill(cause = 'hit') {
    if (this.state === PS.DEAD) return false;
    this.state = PS.DEAD;
    this.deadTimer = 0;
    this.ladder = null;
    this.vx = this.vy = this.airVx = 0;
    this.dieCause = cause;
    return true;
  }

  /**
   * @param {number} dt 고정 스텝
   * @param {{left:boolean,right:boolean,up:boolean,down:boolean,jumpPressed:boolean}} input
   * @param {{platforms:Array,ladders:Array,hammerActive:boolean,onJump?:Function,onLadder?:Function}} world
   */
  update(dt, input, world) {
    if (this.invuln > 0) this.invuln -= dt;

    switch (this.state) {
      case PS.GROUND: this._ground(dt, input, world); break;
      case PS.AIR: this._air(dt, input, world); break;
      case PS.LADDER: this._ladder(dt, input, world); break;
      case PS.DEAD: this.deadTimer += dt; break;
      default: break;
    }

    // 화면 아래로 떨어지면 사망 (승강 발판 스테이지)
    if (this.state !== PS.DEAD && this.y > GAME_H + 6) this.kill('fall');
  }

  _clampX() {
    this.x = clamp(this.x, PLAYER_W / 2, GAME_W - PLAYER_W / 2);
  }

  _ground(dt, input, world) {
    const { platforms, ladders, hammerActive } = world;

    // 운반장치 위에서는 벨트가 몸을 밀어낸다
    const belt = this.platform && this.platform.belt ? this.platform.belt : 0;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.vx = dir * WALK_SPEED;
    if (dir !== 0) this.facing = dir;
    this.x += (this.vx + belt) * dt;
    this._clampX();

    if (dir !== 0 || belt !== 0) this.walkAnim += dt * (dir !== 0 ? 9 : 4);
    else this.walkAnim = 0;

    // 사다리 진입 — 해머를 들고 있으면 불가능
    if (!hammerActive) {
      if (input.up) {
        const l = ladderAt(ladders, this.x, this.y, 'up', true);
        if (l) return this._enterLadder(l, 'up', world);
      } else if (input.down) {
        const l = ladderAt(ladders, this.x, this.y, 'down', true);
        if (l) return this._enterLadder(l, 'down', world);
      }
    }

    // 점프 — 해머를 들고 있으면 불가능
    if (input.jumpPressed && !hammerActive) {
      this.state = PS.AIR;
      this.vy = JUMP_VY;
      this.airVx = this.vx + belt;
      this.apexY = this.y;
      this.platform = null;
      if (world.onJump) world.onJump();
      return undefined;
    }

    // 발판 표면에 붙어 있기 / 끝에서 떨어지기
    const sy = this.platform ? surfaceYAt(this.platform, this.x) : null;
    if (sy == null) {
      // 발판이 끝났거나(경사 끝) 안전핀이 해제되어 사라졌다
      this.state = PS.AIR;
      this.vy = 0;
      this.airVx = this.vx + belt;
      this.apexY = this.y;
      this.platform = null;
    } else {
      this.y = sy;
    }
    return undefined;
  }

  _enterLadder(l, dir, world) {
    this.state = PS.LADDER;
    this.ladder = l;
    this.x = l.x;
    this.platform = null;
    this.vx = this.vy = 0;
    // 진입 즉시 반대쪽 끝 판정이 걸리지 않도록 1px 밀어 넣는다
    this.y = dir === 'up' ? l.bottom - 1 : l.top + 1;
    this.climbAnim = 0;
    if (world && world.onLadder) world.onLadder();
    return undefined;
  }

  _ladder(dt, input) {
    const l = this.ladder;
    if (!l) { this.state = PS.AIR; return; }

    const dir = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dir !== 0) {
      this.y += dir * CLIMB_SPEED * dt;
      this.climbAnim += dt * 7;
    }
    this.x = l.x;

    // 위쪽 도달 → 위층 발판에 올라선다 (끊어진 사다리는 usableTop에서 막힌다)
    if (this.y <= l.usableTop) {
      if (l.broken) {
        this.y = l.usableTop;
      } else {
        this.y = l.top;
        this.state = PS.GROUND;
        this.platform = l.topPlatform;
        this.ladder = null;
        return;
      }
    }
    // 아래쪽 도달 → 아래층 발판
    if (this.y >= l.bottom) {
      this.y = l.bottom;
      this.state = PS.GROUND;
      this.platform = l.bottomPlatform;
      this.ladder = null;
    }
  }

  _air(dt, _input, world) {
    const { platforms } = world;

    this.x += this.airVx * dt;
    this._clampX();
    if (this.airVx > 0) this.facing = 1;
    else if (this.airVx < 0) this.facing = -1;

    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL_SPEED);
    const y0 = this.y;
    this.y += this.vy * dt;
    if (this.y < this.apexY) this.apexY = this.y;

    if (this.vy > 0) {
      const hit = findLanding(platforms, this.x, y0, this.y);
      if (hit) {
        this.y = hit.y;
        this.platform = hit.platform;
        this.state = PS.GROUND;
        this.vy = 0;
        const fell = this.y - this.apexY;
        if (fell > FALL_DEATH_DIST) this.kill('fall');
      }
    }
  }
}
