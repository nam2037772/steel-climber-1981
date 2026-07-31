/**
 * 게임 루프. requestAnimationFrame + 고정 스텝 누적.
 *
 * - 고정 스텝(1/120초)으로 갱신하므로 60Hz / 120Hz / 144Hz 어느 모니터에서도
 *   이동·점프·장애물 속도가 동일하다.
 * - 탭이 비활성화되거나 창 포커스를 잃으면 자동 일시정지.
 * - 프레임 간격이 크게 튀어도(탭 복귀 등) 한 번에 몰아서 갱신되지 않게 클램프.
 */

const MAX_FRAME_DT = 0.25;   // s
export const FIXED_STEP = 1 / 120;
const MAX_STEPS = 8;

export class Loop {
  /**
   * @param {(dt:number)=>void} update 고정 스텝 갱신
   * @param {(alpha:number)=>void} render 프레임 렌더
   */
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.acc = 0;
    this.last = 0;
    this.rafId = 0;
    this.onAutoPause = null;
    this._tick = this._tick.bind(this);
    this._onVisibility = () => {
      if (document.hidden) {
        if (this.onAutoPause) this.onAutoPause();
      } else {
        this._resetTiming();
      }
    };
    this._onBlur = () => { if (this.onAutoPause) this.onAutoPause(); };
    this._onFocus = () => this._resetTiming();
  }

  /** 복귀 시 누적 시간 리셋 */
  _resetTiming() {
    this.last = performance.now();
    this.acc = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('focus', this._onFocus);
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('focus', this._onFocus);
  }

  _tick(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;

    this.acc += dt;
    let steps = 0;
    while (this.acc >= FIXED_STEP && steps < MAX_STEPS) {
      this.update(FIXED_STEP);
      this.acc -= FIXED_STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    this.render(this.acc / FIXED_STEP);
  }
}
