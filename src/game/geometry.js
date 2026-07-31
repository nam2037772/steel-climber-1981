/**
 * 발판(경사 철골)과 사다리의 순수 기하 계산.
 *
 * DOM도 캔버스도 쓰지 않는다. 게임 규칙 중 가장 많이 틀리기 쉬운 부분이므로
 * 전부 순수 함수로 떼어 놓고 단위 테스트로 고정한다.
 *
 * 발판은 **꺾인 선(폴리라인)** 이다. points 는 x 오름차순이고,
 * 두 점 사이는 직선 보간한다. 승강 발판처럼 움직이는 발판은
 * points 를 다시 만들지 않고 오프셋(ox, oy)만 바꾼다.
 *
 * 좌표 약속: 엔티티의 (x, y)는 **가로 중심 / 발바닥**이다.
 */

import { GROUND_EPS, LADDER_SNAP_X } from '../core/constants.js';

let nextId = 1;

/**
 * @param {{points:[number,number][], kind?:string}} def
 */
export function makePlatform(def) {
  const points = def.points.map(([x, y]) => [x, y]);
  return {
    id: def.id ?? `p${nextId++}`,
    kind: def.kind || 'girder',
    points,
    ox: 0,
    oy: 0,
    /** 운반장치용 — 표면 위 물체를 밀어내는 속도(px/s). 0이면 일반 발판 */
    belt: def.belt || 0,
    /** 안전핀 스테이지에서 사라질 수 있는 발판 */
    removed: false,
    stepped: false,
    ...(def.extra || {}),
  };
}

/** 발판이 덮는 x 구간 [좌, 우] (오프셋 반영) */
export function platformSpan(p) {
  return [p.points[0][0] + p.ox, p.points[p.points.length - 1][0] + p.ox];
}

export function platformCoversX(p, x) {
  if (p.removed) return false;
  const [l, r] = platformSpan(p);
  return x >= l && x <= r;
}

/**
 * 발판 표면의 y. x가 구간 밖이거나 제거된 발판이면 null.
 * @returns {number|null}
 */
export function surfaceYAt(p, x) {
  if (p.removed) return null;
  const lx = x - p.ox;
  const pts = p.points;
  if (lx < pts[0][0] || lx > pts[pts.length - 1][0]) return null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (lx >= x0 && lx <= x1) {
      const t = x1 === x0 ? 0 : (lx - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t + p.oy;
    }
  }
  return pts[pts.length - 1][1] + p.oy;
}

/**
 * 그 지점의 기울기(dy/dx). 양수면 오른쪽이 낮다(= 오른쪽으로 굴러감).
 * 꺾인 점 위에서는 오른쪽 구간의 기울기를 쓴다.
 */
export function slopeAt(p, x) {
  if (p.removed) return 0;
  const lx = x - p.ox;
  const pts = p.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (lx >= x0 && lx < x1) return (y1 - y0) / (x1 - x0);
  }
  const n = pts.length;
  if (n < 2) return 0;
  return (pts[n - 1][1] - pts[n - 2][1]) / (pts[n - 1][0] - pts[n - 2][0]);
}

/** 발판의 낮은 쪽 끝 x (굴러온 장애물이 떨어지는 지점) */
export function lowEndX(p) {
  const pts = p.points;
  const left = pts[0];
  const right = pts[pts.length - 1];
  return (right[1] >= left[1] ? right[0] : left[0]) + p.ox;
}

/** 발판이 평평한가 (굴러가지 않는다) */
export function isFlat(p) {
  const pts = p.points;
  return pts[0][1] === pts[pts.length - 1][1];
}

/**
 * 특정 x에서 y보다 아래(=y가 더 큰 쪽)에 있는 가장 가까운 발판.
 * 낙하 목적지를 찾을 때 쓴다.
 * @param {number} minGap y와 최소 이만큼은 떨어져 있어야 후보로 인정
 */
export function platformBelow(platforms, x, y, minGap = 0.5, exclude = null) {
  let best = null;
  let bestY = Infinity;
  for (const p of platforms) {
    if (p === exclude) continue;
    const sy = surfaceYAt(p, x);
    if (sy == null) continue;
    if (sy >= y + minGap && sy < bestY) {
      bestY = sy;
      best = p;
    }
  }
  return best;
}

/**
 * y0 → y1 로 떨어지는 동안 표면을 뚫고 지나간 발판을 찾는다 (스윕 판정).
 * 고정 스텝이라 한 스텝 이동량이 작지만, 그래도 터널링을 원천 차단한다.
 * @returns {{platform:object, y:number}|null}
 */
export function findLanding(platforms, x, y0, y1, exclude = null) {
  if (y1 < y0) return null; // 상승 중에는 착지하지 않는다
  let best = null;
  for (const p of platforms) {
    if (p === exclude) continue;
    const sy = surfaceYAt(p, x);
    if (sy == null) continue;
    if (y0 <= sy + GROUND_EPS && y1 >= sy) {
      if (!best || sy < best.y) best = { platform: p, y: sy };
    }
  }
  return best;
}

/** 현재 서 있는 발판 판정 — 발바닥이 표면 근처인가 */
export function standingOn(platforms, x, y, eps = GROUND_EPS) {
  for (const p of platforms) {
    const sy = surfaceYAt(p, x);
    if (sy == null) continue;
    if (Math.abs(sy - y) <= eps) return p;
  }
  return null;
}

/* ── 사다리 ─────────────────────────────────────────── */

/**
 * 사다리를 만든다. 위/아래 끝 y는 **실제 발판 표면에서 계산**하므로
 * 화면상 사다리가 항상 철골에 정확히 붙는다.
 *
 * broken(끊어진 사다리): 위쪽 gap 픽셀만큼이 없다.
 *  → 아래에서 올라갈 수는 있지만 끝까지 못 가고, 위에서 내려올 수도 없다.
 */
export function makeLadder({ id, x, topPlatform, bottomPlatform, gap = 0 }) {
  const top = surfaceYAt(topPlatform, x);
  const bottom = surfaceYAt(bottomPlatform, x);
  if (top == null || bottom == null) {
    throw new Error(`사다리 x=${x} 가 발판 구간을 벗어났습니다`);
  }
  return {
    id: id ?? `l${nextId++}`,
    x,
    top,
    bottom,
    gap,
    broken: gap > 0,
    /** 아래에서 올라갈 수 있는 가장 높은 발바닥 위치 */
    usableTop: top + gap,
    topPlatform,
    bottomPlatform,
  };
}

/**
 * (x, y)에서 탈 수 있는 사다리. 가로 ±LADDER_SNAP_X 안이어야 한다.
 * @param {'up'|'down'} dir 오르려는 방향
 * @param {boolean} onGround 발판 위에 서 있는가 (점프·낙하 중이면 false)
 */
export function ladderAt(ladders, x, y, dir, onGround) {
  for (const l of ladders) {
    if (Math.abs(l.x - x) > LADDER_SNAP_X) continue;
    if (dir === 'up') {
      // 아래쪽 발판에 서서 위로: 사다리 하단 근처여야 한다
      if (Math.abs(y - l.bottom) <= GROUND_EPS + 0.5 && l.usableTop < l.bottom - 1) return l;
      // 사다리 중간에 이미 매달려 있는 경우
      if (!onGround && y < l.bottom && y > l.usableTop) return l;
    } else {
      // 위쪽 발판에 서서 아래로: 끊어진 사다리는 위에서 못 탄다
      if (!l.broken && Math.abs(y - l.top) <= GROUND_EPS + 0.5) return l;
      if (!onGround && y > l.top && y < l.bottom) return l;
    }
  }
  return null;
}

/**
 * 굴러가던 물체(드럼통 등)가 사다리 입구에 걸쳐 있는가.
 * 지금 밟고 있는 발판에서 **아래로 내려가는** 사다리만 후보다.
 */
export function overLadder(ladders, x, platform, tol = 3) {
  for (const l of ladders) {
    if (Math.abs(l.x - x) > tol) continue;
    if (l.broken) continue;               // 끊어진 사다리로는 내려가지 않는다
    if (l.topPlatform !== platform) continue;
    return l;
  }
  return null;
}

/* ── 충돌 ───────────────────────────────────────────── */

/** 중심 x / 발바닥 y 기준 사각형 */
export function boxOf(x, y, w, h) {
  return { l: x - w / 2, r: x + w / 2, t: y - h, b: y };
}

export function boxesOverlap(a, b) {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
