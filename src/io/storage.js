/**
 * localStorage 래퍼. 사생활 보호 모드 등에서 접근이 막혀도 게임이 죽지 않게 감싼다.
 * 저장하는 것은 최고 점수 · 음소거 · 음량 · CRT 설정 네 가지뿐이다.
 */

const PREFIX = 'steelclimber1981.';

function safeGet(key) {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  getHighScore() {
    const v = parseInt(safeGet('highScore') ?? '0', 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  },
  setHighScore(v) {
    safeSet('highScore', String(Math.floor(v)));
  },
  getMuted() {
    return safeGet('muted') === '1';
  },
  setMuted(v) {
    safeSet('muted', v ? '1' : '0');
  },
  getVolume() {
    const v = parseFloat(safeGet('volume') ?? '0.6');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;
  },
  setVolume(v) {
    safeSet('volume', String(v));
  },
  getCrt() {
    return safeGet('crt') !== '0'; // 기본 켜짐
  },
  setCrt(v) {
    safeSet('crt', v ? '1' : '0');
  },
};
