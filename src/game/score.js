/**
 * 점수 · 생명 · 제한시간(BONUS).
 *
 * 점수표는 원작 값을 쓰지 않고 core/constants.js 에서 자체 산정했다.
 * BONUS는 스테이지 시작값에서 계속 줄어들고, 0이 되면 사망한다.
 * 스테이지를 깨면 남은 BONUS가 그대로 점수에 더해진다.
 */

import {
  SCORE, BONUS_START, BONUS_STEP, BONUS_INTERVAL, START_LIVES,
} from '../core/constants.js';

export class Score {
  constructor(highScore = 0) {
    this.high = highScore;
    this.reset();
  }

  reset() {
    this.value = 0;
    this.lives = START_LIVES;
    this.bonus = BONUS_START;
    this.bonusTimer = 0;
    this.extraLifeGiven = false;
    this.newHigh = false;
  }

  /** @returns {boolean} 추가 생명을 얻었는가 */
  add(n) {
    this.value += n;
    if (this.value > this.high) {
      this.high = this.value;
      this.newHigh = true;
    }
    if (!this.extraLifeGiven && this.value >= SCORE.extraLifeAt) {
      this.extraLifeGiven = true;
      this.lives += 1;
      return true;
    }
    return false;
  }

  startStage(bonusStart = BONUS_START) {
    this.bonus = bonusStart;
    this.bonusTimer = 0;
  }

  /**
   * 제한시간 감소.
   * @returns {boolean} 시간이 다 되었는가
   */
  tickBonus(dt) {
    if (this.bonus <= 0) return true;
    this.bonusTimer += dt;
    while (this.bonusTimer >= BONUS_INTERVAL && this.bonus > 0) {
      this.bonusTimer -= BONUS_INTERVAL;
      this.bonus = Math.max(0, this.bonus - BONUS_STEP);
    }
    return this.bonus <= 0;
  }

  /** 스테이지 완료 — 남은 보너스를 점수로. @returns {{gained:number, extraLife:boolean}} */
  clearStage() {
    const gained = this.bonus;
    const extraLife = this.add(gained);
    this.bonus = 0;
    return { gained, extraLife };
  }

  /** @returns {boolean} 게임 오버인가 */
  loseLife() {
    this.lives -= 1;
    return this.lives <= 0;
  }

  /** 점프로 넘은 장애물 개수 → 점수 */
  jumpBonus(count) {
    if (count <= 0) return 0;
    if (count === 1) return SCORE.jump1;
    if (count === 2) return SCORE.jump2;
    return SCORE.jump3;
  }
}
