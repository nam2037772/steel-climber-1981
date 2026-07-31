const LOCAL_DEBUG_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '']);

/**
 * 테스트가 게임 내부를 만질 수 있는 창구(window.__steel)는
 * 로컬 개발 환경에서만 열어 둔다. 배포본에서 확인이 필요하면 `?e2e=1`로 직접 켠다.
 */
export function shouldExposeDebugHook(locationLike) {
  if (!locationLike) return false;
  if (LOCAL_DEBUG_HOSTS.has(locationLike.hostname)) return true;
  return new URLSearchParams(locationLike.search || '').get('e2e') === '1';
}

/** ?seed=1234 로 난수 시드를 고정할 수 있게 한다 (E2E 재현성) */
export function seedFromLocation(locationLike, fallback) {
  if (!locationLike) return fallback;
  const raw = new URLSearchParams(locationLike.search || '').get('seed');
  if (raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n >>> 0 : fallback;
}
