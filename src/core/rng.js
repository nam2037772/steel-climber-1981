/**
 * 작고 시드 지정이 가능한 난수기 (mulberry32).
 * 드럼통의 사다리 하강, 불꽃의 판단 오차 등 확률에 기대는 부분을
 * 테스트에서 결정론적으로 재현하기 위해 필요하다.
 */
export function createRng(seed = 0x51ee1c0b) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** [min, max) 실수 */
    range: (min, max) => min + next() * (max - min),
    /** [min, max] 정수 */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** 확률 p로 true */
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    reseed: (n) => { s = n >>> 0; },
  };
}
