/**
 * 입력 — 키보드 + 모바일 터치 버튼.
 *
 * 멀티터치: 버튼마다 pointer 이벤트를 따로 잡고 setPointerCapture 를 쓰므로
 * 왼쪽을 누른 채 JUMP를 눌러 "이동하면서 점프"가 된다.
 *
 * 고착 방지: pointerup / pointercancel / pointerleave / lostpointercapture /
 * window blur / visibilitychange 를 모두 해제 신호로 처리한다.
 */

export class Input {
  constructor() {
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    /** 한 프레임만 true인 신호 */
    this.jumpPressed = false;
    this.actionPressed = false;
    this.startPressed = false;
    this.pausePressed = false;

    this._key = { left: false, right: false, up: false, down: false, jump: false };
    this._touch = { left: false, right: false, up: false, down: false, jump: false };
    this._jumpPrev = false;
    /** 고정 스텝 사이에 눌렀다 뗀 짧은 탭도 놓치지 않도록 래치 */
    this._jumpPending = false;
    this._actionPending = false;
    this._listeners = [];
    this._onFirstInput = null;
  }

  onFirstInput(cb) {
    this._onFirstInput = cb;
  }

  _fireFirstInput() {
    if (this._onFirstInput) {
      const cb = this._onFirstInput;
      this._onFirstInput = null;
      cb();
    }
  }

  attach(target = window, buttons = {}) {
    const add = (el, type, fn, opts) => {
      if (!el) return;
      el.addEventListener(type, fn, opts);
      this._listeners.push([el, type, fn, opts]);
    };

    const onKeyDown = (e) => {
      if (e.repeat && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        // 방향키 리핏은 무시해도 상태값이 유지된다
      }
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': this._key.left = true; break;
        case 'ArrowRight': case 'd': case 'D': this._key.right = true; break;
        case 'ArrowUp': case 'w': case 'W': this._key.up = true; break;
        case 'ArrowDown': case 's': case 'S': this._key.down = true; break;
        case ' ': case 'Spacebar':
          if (!this._key.jump) this._jumpPending = true;
          this._key.jump = true;
          break;
        case 'x': case 'X': case 'z': case 'Z':
          if (!e.repeat) this._actionPending = true;
          break;
        case 'Enter': this.startPressed = true; break;
        case 'p': case 'P': case 'Escape': this.pausePressed = true; break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        this._fireFirstInput();
      }
    };

    const onKeyUp = (e) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': this._key.left = false; break;
        case 'ArrowRight': case 'd': case 'D': this._key.right = false; break;
        case 'ArrowUp': case 'w': case 'W': this._key.up = false; break;
        case 'ArrowDown': case 's': case 'S': this._key.down = false; break;
        case ' ': case 'Spacebar': this._key.jump = false; break;
        default: return;
      }
      e.preventDefault();
    };

    add(target, 'keydown', onKeyDown);
    add(target, 'keyup', onKeyUp);

    // 포커스를 잃으면 눌린 입력을 모두 해제 (고착 방지)
    const release = () => {
      for (const k of Object.keys(this._key)) this._key[k] = false;
      for (const k of Object.keys(this._touch)) this._touch[k] = false;
      this._jumpPending = false;
      this._actionPending = false;
    };
    this.releaseAll = release;
    add(window, 'blur', release);
    add(document, 'visibilitychange', () => { if (document.hidden) release(); });

    const bindHold = (el, name) => {
      if (!el) return;
      const down = (e) => {
        e.preventDefault();
        if (name === 'jump' && !this._touch.jump) this._jumpPending = true;
        this._touch[name] = true;
        this._fireFirstInput();
        if (el.setPointerCapture && e.pointerId != null) {
          try { el.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
        }
      };
      const up = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        this._touch[name] = false;
      };
      add(el, 'pointerdown', down);
      add(el, 'pointerup', up);
      add(el, 'pointercancel', up);
      add(el, 'pointerleave', up);
      add(el, 'lostpointercapture', up);
      add(el, 'contextmenu', (e) => e.preventDefault());
    };

    bindHold(buttons.left, 'left');
    bindHold(buttons.right, 'right');
    bindHold(buttons.up, 'up');
    bindHold(buttons.down, 'down');
    bindHold(buttons.jump, 'jump');

    if (buttons.action) {
      add(buttons.action, 'pointerdown', (e) => {
        e.preventDefault();
        this._actionPending = true;
        this._fireFirstInput();
      });
      add(buttons.action, 'contextmenu', (e) => e.preventDefault());
    }
    if (buttons.pause) {
      add(buttons.pause, 'click', () => { this.pausePressed = true; this._fireFirstInput(); });
    }
    if (buttons.start) {
      add(buttons.start, 'click', () => { this.startPressed = true; this._fireFirstInput(); });
    }
  }

  /** 프레임 시작에 호출 — 상태 합성 */
  beginFrame() {
    this.left = this._key.left || this._touch.left;
    this.right = this._key.right || this._touch.right;
    this.up = this._key.up || this._touch.up;
    this.down = this._key.down || this._touch.down;
    const jump = this._key.jump || this._touch.jump;
    this.jumpPressed = (jump && !this._jumpPrev) || this._jumpPending;
    this._jumpPending = false;
    this._jumpPrev = jump;
    this.actionPressed = this._actionPending;
    this._actionPending = false;
  }

  /** 프레임 끝에 호출 — 1프레임 신호 소거 */
  endFrame() {
    this.startPressed = false;
    this.pausePressed = false;
    this.jumpPressed = false;
    this.actionPressed = false;
  }

  /** 테스트/디버그용 강제 입력 주입 */
  setVirtual(v) {
    for (const k of ['left', 'right', 'up', 'down', 'jump']) {
      if (v[k] !== undefined) this._touch[k] = v[k];
    }
    if (v.action) this._actionPending = true;
  }

  detach() {
    for (const [el, type, fn, opts] of this._listeners) {
      el.removeEventListener(type, fn, opts);
    }
    this._listeners = [];
  }
}
