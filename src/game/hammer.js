/**
 * 전동 브레이커(해머 역할).
 *
 * - 맵의 고정 위치에서 닿으면 자동으로 켜지고, 끌 수 없다.
 * - 켜져 있는 동안 **점프와 사다리 이동이 막힌다.** (player.js에서 처리)
 * - 앞 / 위를 번갈아 때리는 2프레임. 프레임마다 타격 상자가 다르다.
 * - 남은 시간이 짧아지면 깜빡이고 경고음이 난다.
 * - 사망·스테이지 완료·재시작에서 reset()으로 완전히 초기화된다.
 */

import { HAMMER_DURATION, HAMMER_WARN, HAMMER_SWING_PERIOD, PLAYER_H } from '../core/constants.js';

export class Hammer {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.time = 0;
    this.swing = 0;
    /** 0 = 앞으로 내려침, 1 = 위로 치켜듦 */
    this.frame = 0;
    this.justExpired = false;
  }

  pickup(duration = HAMMER_DURATION) {
    this.active = true;
    this.time = duration;
    this.swing = 0;
    this.frame = 0;
    this.justExpired = false;
  }

  get warning() {
    return this.active && this.time <= HAMMER_WARN;
  }

  update(dt) {
    this.justExpired = false;
    if (!this.active) return;
    this.time -= dt;
    this.swing += dt;
    while (this.swing >= HAMMER_SWING_PERIOD) {
      this.swing -= HAMMER_SWING_PERIOD;
      this.frame ^= 1;
    }
    if (this.time <= 0) {
      this.reset();
      this.justExpired = true;
    }
  }

  /**
   * 현재 프레임의 타격 상자. 비활성이면 null.
   * @param {{x:number,y:number,facing:number}} player
   */
  hitBox(player) {
    if (!this.active) return null;
    const f = player.facing >= 0 ? 1 : -1;
    if (this.frame === 0) {
      // 앞으로 내려침 — 발밑 앞쪽
      const l = f > 0 ? player.x + 2 : player.x - 14;
      return { l, r: l + 12, t: player.y - 10, b: player.y + 1 };
    }
    // 위로 치켜듦 — 머리 위 앞쪽
    const l = f > 0 ? player.x - 1 : player.x - 9;
    return { l, r: l + 10, t: player.y - PLAYER_H - 9, b: player.y - PLAYER_H + 3 };
  }
}
