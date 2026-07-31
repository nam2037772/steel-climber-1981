/**
 * 점수 팝업과 파편 효과. 게임 규칙에 영향을 주지 않는 순수 연출이라
 * 스테이지 전환·사망 시 clear()로 전부 지운다.
 */

export class Effects {
  constructor() {
    this.popups = [];
    this.bursts = [];
  }

  clear() {
    this.popups.length = 0;
    this.bursts.length = 0;
  }

  popup(x, y, text, color = '#ffd400') {
    this.popups.push({ x, y, text: String(text), color, life: 0.85, t: 0 });
  }

  /** 파편 — 코드로 만든 작은 사각형들이 튄다 */
  burst(x, y, color = '#ffb01f', count = 7, rng = null) {
    for (let i = 0; i < count; i++) {
      const a = ((i / count) * Math.PI * 2) + (rng ? rng.range(-0.3, 0.3) : 0);
      const sp = 40 + (rng ? rng.range(0, 45) : (i % 3) * 15);
      this.bursts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 0.45, t: 0, color,
      });
    }
  }

  update(dt) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.t += dt;
      p.y -= 16 * dt;
      if (p.t >= p.life) this.popups.splice(i, 1);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 300 * dt;
      if (b.t >= b.life) this.bursts.splice(i, 1);
    }
  }
}
