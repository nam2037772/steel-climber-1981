/**
 * 사운드. Web Audio API로 **전부 코드 합성**한다 — 음원 파일도 CDN도 없다.
 * 원작의 음원을 사용하거나 샘플링하지 않았고, 멜로디도 자체 구성이다.
 *
 * 브라우저 자동재생 정책: AudioContext는 첫 사용자 입력 이후에만 만든다.
 */

import { storage } from './storage.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = storage.getMuted();
    this.volume = storage.getVolume();
    this.enabled = false;
    this._noise = null;
    this._lastRoll = 0;
  }

  /** 첫 사용자 입력에서 호출 */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
      this.enabled = false;
    }
  }

  setMuted(m) {
    this.muted = m;
    storage.setMuted(m);
    this._applyGain();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    storage.setVolume(this.volume);
    this._applyGain();
  }

  _applyGain() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.muted ? 0 : this.volume, t);
  }

  get ready() {
    return !!(this.ctx && this.master && !this.muted);
  }

  _noiseBuffer() {
    if (this._noise) return this._noise;
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  _tone({ type = 'square', f0, f1, t0 = 0, dur = 0.1, gain = 0.22, curve = 'exp' }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + t0;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), now);
    if (f1 != null && f1 !== f0) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
      else osc.frequency.linearRampToValueAtTime(Math.max(1, f1), now + dur);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _noiseBurst({ t0 = 0, dur = 0.2, gain = 0.28, f0 = 2400, f1 = 200, q = 1 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + t0;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, now);
    filt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /* ── 효과음 ─────────────────────────────────────────
     전부 0.1초 안팎의 짧은 전자음. 1980년대 초 기판의 질감을 노렸다. */

  /** 발걸음 — 아주 짧은 저음 클릭 */
  step() {
    this._tone({ type: 'square', f0: 150, f1: 90, dur: 0.035, gain: 0.05 });
  }

  /** 점프 — 짧게 올라갔다 내려온다 */
  jump() {
    this._tone({ type: 'square', f0: 300, f1: 700, dur: 0.09, gain: 0.13 });
  }

  /** 사다리 진입 */
  ladder() {
    this._tone({ type: 'triangle', f0: 420, f1: 620, dur: 0.06, gain: 0.1 });
  }

  /** 사다리를 한 칸 오를 때 나는 소리 */
  climbTick() {
    this._tone({ type: 'square', f0: 240, f1: 200, dur: 0.03, gain: 0.05 });
  }

  /** 드럼통이 굴러가는 소리 (너무 자주 나지 않게 간격 제한) */
  roll(now) {
    if (now - this._lastRoll < 0.16) return;
    this._lastRoll = now;
    this._noiseBurst({ dur: 0.09, gain: 0.07, f0: 320, f1: 180, q: 2.5 });
  }

  /** 로봇이 드럼통을 내려놓음 */
  release() {
    this._tone({ type: 'square', f0: 190, f1: 120, dur: 0.1, gain: 0.11 });
    this._noiseBurst({ dur: 0.12, gain: 0.1, f0: 700, f1: 200, q: 1.4, t0: 0.03 });
  }

  /** 장애물을 뛰어넘어 점수 획득 */
  jumpScore(count = 1) {
    const notes = count >= 3 ? [784, 988, 1318, 1568] : count === 2 ? [659, 988, 1318] : [880, 1318];
    notes.forEach((f, i) => this._tone({
      type: 'square', f0: f, f1: f, dur: 0.06, gain: 0.13, t0: i * 0.05,
    }));
  }

  /** 해머 획득 */
  hammerGet() {
    [392, 523, 659, 880].forEach((f, i) => this._tone({
      type: 'square', f0: f, f1: f, dur: 0.08, gain: 0.15, t0: i * 0.06,
    }));
  }

  /** 해머 남은 시간 경고 */
  hammerWarn() {
    this._tone({ type: 'square', f0: 620, f1: 620, dur: 0.05, gain: 0.09 });
  }

  /** 장애물 파괴 */
  smash() {
    this._noiseBurst({ dur: 0.16, gain: 0.22, f0: 1800, f1: 160, q: 0.8 });
    this._tone({ type: 'square', f0: 420, f1: 80, dur: 0.14, gain: 0.12 });
  }

  /** 아이템 획득 */
  item() {
    [659, 880, 1174].forEach((f, i) => this._tone({
      type: 'triangle', f0: f, f1: f, dur: 0.07, gain: 0.14, t0: i * 0.05,
    }));
  }

  /** 안전핀 해제 */
  pin() {
    this._tone({ type: 'square', f0: 900, f1: 1500, dur: 0.07, gain: 0.13 });
    this._noiseBurst({ dur: 0.08, gain: 0.1, f0: 1200, f1: 400, q: 2 });
  }

  /** 피격 / 사망 */
  death() {
    this._tone({ type: 'sawtooth', f0: 420, f1: 60, dur: 0.55, gain: 0.16 });
    this._tone({ type: 'square', f0: 210, f1: 42, dur: 0.5, gain: 0.11, t0: 0.05 });
    this._noiseBurst({ dur: 0.4, gain: 0.16, f0: 900, f1: 70, q: 0.7 });
  }

  /** 스테이지 시작 */
  stageStart() {
    [392, 494, 587, 784].forEach((f, i) => this._tone({
      type: 'square', f0: f, f1: f, dur: 0.11, gain: 0.15, t0: i * 0.1,
    }));
  }

  /** 스테이지 완료 */
  stageClear() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this._tone({
      type: 'square', f0: f, f1: f, dur: 0.11, gain: 0.15, t0: i * 0.09,
    }));
  }

  /** 추가 생명 */
  extraLife() {
    [880, 1174, 1568].forEach((f, i) => this._tone({
      type: 'triangle', f0: f, f1: f, dur: 0.11, gain: 0.16, t0: i * 0.09,
    }));
  }

  /** 게임 오버 */
  gameOver() {
    [494, 415, 349, 262, 196].forEach((f, i) => this._tone({
      type: 'square', f0: f, f1: f * 0.96, dur: 0.24, gain: 0.15, t0: i * 0.18,
    }));
  }

  /** 불꽃 발생 */
  sparkBorn() {
    this._noiseBurst({ dur: 0.22, gain: 0.12, f0: 3200, f1: 900, q: 1.2 });
  }

  /** UI 클릭 */
  blip() {
    this._tone({ type: 'square', f0: 760, f1: 1140, dur: 0.045, gain: 0.1 });
  }
}
