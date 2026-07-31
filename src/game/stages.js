/**
 * 스테이지 배치.
 *
 * 네 화면 모두 층 좌표·기울기·사다리 위치를 이 프로젝트에서 직접 설계했다.
 * 원작의 배치를 옮겨오지 않았고, 옮겨올 수 있는 자료도 참고하지 않았다.
 *
 * 설계 규칙
 *  - 층 간격은 32px 안팎. 낙하 사망 기준(34px)보다 작아서 한 층 실족은 살고,
 *    두 층은 죽는다.
 *  - 경사 철골의 위아래 간격은 어느 x에서도 22px 이상이라 캐릭터가 천장에 끼지 않는다.
 *  - 사다리 양 끝 y는 발판 표면에서 계산하므로 화면상 항상 철골에 붙는다.
 */

import { makePlatform, makeLadder, surfaceYAt } from './geometry.js';

/** 여러 조각으로 나뉜 층에서 x를 덮는 조각 찾기 */
function segAt(list, x) {
  for (const p of list) {
    const l = p.points[0][0] + p.ox;
    const r = p.points[p.points.length - 1][0] + p.ox;
    if (x >= l && x <= r) return p;
  }
  throw new Error(`x=${x} 를 덮는 발판 조각이 없습니다`);
}

/* ══════════════════════════════════════════════════════
   1단계 — 경사 철골 / 굴러오는 드럼통
   ══════════════════════════════════════════════════════ */

function buildGirders() {
  // 아래에서 위로. 홀수 층은 왼쪽이 낮고, 짝수 층은 오른쪽이 낮다.
  const F0 = makePlatform({ id: 'g0', points: [[0, 242], [224, 248]] });      // 바닥 (오른쪽이 낮음)
  const F1 = makePlatform({ id: 'g1', points: [[0, 219], [224, 209]] });      // 왼쪽이 낮음
  const F2 = makePlatform({ id: 'g2', points: [[0, 177], [224, 187]] });      // 오른쪽이 낮음
  const F3 = makePlatform({ id: 'g3', points: [[0, 155], [112, 151], [224, 145]] }); // 두 단 꺾임
  const F4 = makePlatform({ id: 'g4', points: [[0, 113], [224, 123]] });
  const F5 = makePlatform({ id: 'g5', points: [[0, 91], [224, 81]] });
  // 최상단 목표 발판. 왼쪽으로 아주 살짝 기울어 있어서 로봇이 내려놓은 드럼통이
  // 왼쪽 끝으로 굴러가 5층으로 떨어진다.
  const F6 = makePlatform({ id: 'g6', points: [[48, 53], [176, 52]] });

  const platforms = [F0, F1, F2, F3, F4, F5, F6];

  const ladders = [
    makeLadder({ id: 'L01', x: 200, bottomPlatform: F0, topPlatform: F1 }),
    makeLadder({ id: 'L12a', x: 52, bottomPlatform: F1, topPlatform: F2 }),
    makeLadder({ id: 'L12b', x: 130, bottomPlatform: F1, topPlatform: F2, gap: 13 }), // 끊어진 사다리
    makeLadder({ id: 'L23a', x: 178, bottomPlatform: F2, topPlatform: F3 }),
    makeLadder({ id: 'L23b', x: 70, bottomPlatform: F2, topPlatform: F3 }),
    makeLadder({ id: 'L34a', x: 40, bottomPlatform: F3, topPlatform: F4 }),
    makeLadder({ id: 'L34b', x: 150, bottomPlatform: F3, topPlatform: F4, gap: 12 }),
    makeLadder({ id: 'L45a', x: 192, bottomPlatform: F4, topPlatform: F5 }),
    makeLadder({ id: 'L45b', x: 88, bottomPlatform: F4, topPlatform: F5 }),
    makeLadder({ id: 'L56', x: 140, bottomPlatform: F5, topPlatform: F6 }),
  ];

  return {
    platforms,
    ladders,
    spawn: { x: 26, platform: F0 },
    robot: { x: 106, platform: F6, facing: -1 },
    goal: { x: 160, platform: F6, kind: 'estop' },
    hammers: [
      { x: 106, platform: F2, lift: 13 },
      { x: 58, platform: F4, lift: 13 },
    ],
    items: [
      { x: 150, platform: F1, kind: 'vest' },
      { x: 196, platform: F3, kind: 'toolbox' },
      { x: 36, platform: F5, kind: 'blueprint' },
    ],
    /** 드럼통이 지나가면 용접 불꽃이 붙을 수 있는 용접기 */
    welders: [{ x: 150, platform: F0 }],
    /** 로봇이 드럼통을 내려놓는 자리 — 여기서 왼쪽 끝으로 굴러 5층에 떨어진다 */
    dropper: { x: 82, platform: F6, onto: F5 },
    spawnInterval: 3.1,
    ladderDropChance: 0.28,
    maxSparks: 2,
    sparkStart: { x: 150, platform: F0 },
  };
}

/* ══════════════════════════════════════════════════════
   2단계 — 자재 운반장치
   ══════════════════════════════════════════════════════ */

function buildConveyors() {
  const F0 = makePlatform({ id: 'c0', points: [[0, 246], [224, 246]] });

  // 각 층 = 고정 발판 + 운반장치 + 고정 발판, 사이에 뛰어 넘어야 하는 빈틈
  const F1a = makePlatform({ id: 'c1a', points: [[0, 214], [58, 214]] });
  const F1b = makePlatform({ id: 'c1b', points: [[68, 214], [156, 214]], belt: 34 });
  const F1c = makePlatform({ id: 'c1c', points: [[166, 214], [224, 214]] });

  // 2층·3층 벨트는 **가야 할 방향과 반대로** 돌아간다. 밀리면서 걷는 감각이 이 스테이지의 핵심이다.
  const F2a = makePlatform({ id: 'c2a', points: [[0, 182], [50, 182]] });
  const F2b = makePlatform({ id: 'c2b', points: [[60, 182], [164, 182]], belt: 34 });
  const F2c = makePlatform({ id: 'c2c', points: [[174, 182], [224, 182]] });

  const F3a = makePlatform({ id: 'c3a', points: [[0, 150], [46, 150]] });
  const F3b = makePlatform({ id: 'c3b', points: [[56, 150], [168, 150]], belt: -40 });
  const F3c = makePlatform({ id: 'c3c', points: [[178, 150], [224, 150]] });

  const F4 = makePlatform({ id: 'c4', points: [[0, 118], [224, 118]] });      // 안전한 층 (해머)
  const F5 = makePlatform({ id: 'c5', points: [[24, 86], [200, 86]] });       // 최상단

  const platforms = [F0, F1a, F1b, F1c, F2a, F2b, F2c, F3a, F3b, F3c, F4, F5];

  const ladders = [
    makeLadder({ id: 'M01', x: 26, bottomPlatform: F0, topPlatform: F1a }),
    makeLadder({ id: 'M01b', x: 198, bottomPlatform: F0, topPlatform: F1c }),
    makeLadder({ id: 'M12', x: 196, bottomPlatform: F1c, topPlatform: F2c }),
    makeLadder({ id: 'M12b', x: 26, bottomPlatform: F1a, topPlatform: F2a, gap: 12 }),
    makeLadder({ id: 'M23', x: 22, bottomPlatform: F2a, topPlatform: F3a }),
    makeLadder({ id: 'M34', x: 200, bottomPlatform: F3c, topPlatform: F4 }),
    makeLadder({ id: 'M34b', x: 22, bottomPlatform: F3a, topPlatform: F4 }),
    makeLadder({ id: 'M45', x: 112, bottomPlatform: F4, topPlatform: F5 }),
  ];

  return {
    platforms,
    ladders,
    spawn: { x: 20, platform: F0 },
    robot: { x: 62, platform: F5, facing: 1 },
    goal: { x: 176, platform: F5, kind: 'estop' },
    hammers: [
      { x: 150, platform: F4, lift: 13 },
      { x: 96, platform: F1b, lift: 13 },
    ],
    items: [
      { x: 110, platform: F2b, kind: 'vest' },
      { x: 118, platform: F3b, kind: 'toolbox' },
      { x: 40, platform: F4, kind: 'blueprint' },
    ],
    welders: [{ x: 210, platform: F0 }],
    /** 자재는 각 운반장치의 뒤쪽 끝에서 실려 나온다 */
    conveyorFeeds: [
      { platform: F1b, from: 'left' },
      { platform: F2b, from: 'left' },
      { platform: F3b, from: 'right' },
    ],
    spawnInterval: 2.6,
    ladderDropChance: 0,
    maxSparks: 3,
    sparkStart: { x: 210, platform: F0 },
  };
}

/* ══════════════════════════════════════════════════════
   3단계 — 승강 발판
   ══════════════════════════════════════════════════════ */

function buildElevators() {
  const F0 = makePlatform({ id: 'e0', points: [[0, 246], [224, 246]] });
  const L1 = makePlatform({ id: 'eL1', points: [[0, 204], [70, 204]] });
  const R1 = makePlatform({ id: 'eR1', points: [[140, 146], [224, 146]] });
  const R2 = makePlatform({ id: 'eR2', points: [[120, 106], [224, 106]] });
  const L2 = makePlatform({ id: 'eL2', points: [[0, 72], [96, 72]] });        // 최상단

  // 승강기 A — 세 대가 계속 위로 올라가며 아래에서 다시 나타난다
  const carsA = [0, 1, 2].map((i) => makePlatform({
    id: `eA${i}`,
    points: [[-18, 0], [18, 0]],
    kind: 'elevator',
    extra: {
      motion: { type: 'wrap', vy: -34, yTop: 58, yBottom: 250 },
    },
  }));
  carsA.forEach((c, i) => { c.ox = 104; c.oy = 250 - i * 64; });

  // 승강기 B — 한 대가 위아래로 왕복하는 리프트
  const liftB = makePlatform({
    id: 'eB',
    points: [[-20, 0], [20, 0]],
    kind: 'elevator',
    extra: { motion: { type: 'osc', yTop: 86, yBottom: 172, speed: 26, dir: -1 } },
  });
  liftB.ox = 86;
  liftB.oy = 172;

  const platforms = [F0, L1, R1, R2, L2, ...carsA, liftB];

  const ladders = [
    makeLadder({ id: 'E01', x: 14, bottomPlatform: F0, topPlatform: L1 }),
    makeLadder({ id: 'E12', x: 212, bottomPlatform: R1, topPlatform: R2 }),
  ];

  return {
    platforms,
    ladders,
    spawn: { x: 22, platform: F0 },
    robot: { x: 66, platform: L2, facing: -1 },
    goal: { x: 18, platform: L2, kind: 'estop' },
    hammers: [{ x: 186, platform: R1, lift: 13 }],
    items: [
      { x: 56, platform: L1, kind: 'vest' },
      { x: 200, platform: R2, kind: 'toolbox' },
    ],
    welders: [],
    /** 위에서 떨어지는 공구가 생기는 x 위치들 */
    toolDrops: [86, 104, 122, 150, 60],
    spawnInterval: 1.65,
    ladderDropChance: 0,
    maxSparks: 1,
    sparkStart: { x: 200, platform: F0 },
  };
}

/* ══════════════════════════════════════════════════════
   4단계 — 안전핀 해제
   ══════════════════════════════════════════════════════ */

function buildPins() {
  const pinIds = [];
  const platforms = [];

  const F0 = makePlatform({ id: 'p0', points: [[0, 246], [224, 246]] });
  platforms.push(F0);

  /**
   * 층 하나 = 고정 조각 + 안전핀 조각 2개.
   * 핀을 밟고 지나가면 그 조각이 사라져 18px 구멍이 남는다.
   * 점프 거리(약 25px)로 넘을 수 있지만 발판 끝에서 정확히 뛰어야 한다.
   */
  const makePinFloor = (idx, y) => {
    const segs = [];
    const cuts = [[0, 42], [42, 60], [60, 164], [164, 182], [182, 224]];
    cuts.forEach(([l, r], i) => {
      const isPin = i === 1 || i === 3;
      const p = makePlatform({
        id: `p${idx}_${i}`,
        points: [[l, y], [r, y]],
        kind: isPin ? 'pin' : 'girder',
      });
      if (isPin) pinIds.push(p.id);
      segs.push(p);
    });
    platforms.push(...segs);
    return segs;
  };

  const F1 = makePinFloor(1, 214);
  const F2 = makePinFloor(2, 182);
  const F3 = makePinFloor(3, 150);
  const F4 = makePinFloor(4, 118);
  const TOP = makePlatform({ id: 'pTop', points: [[52, 86], [172, 86]] });
  platforms.push(TOP);

  const ladders = [
    makeLadder({ id: 'P01a', x: 20, bottomPlatform: F0, topPlatform: segAt(F1, 20) }),
    makeLadder({ id: 'P01b', x: 204, bottomPlatform: F0, topPlatform: segAt(F1, 204) }),
    makeLadder({ id: 'P12a', x: 20, bottomPlatform: segAt(F1, 20), topPlatform: segAt(F2, 20) }),
    makeLadder({ id: 'P12b', x: 204, bottomPlatform: segAt(F1, 204), topPlatform: segAt(F2, 204) }),
    makeLadder({ id: 'P23', x: 112, bottomPlatform: segAt(F2, 112), topPlatform: segAt(F3, 112) }),
    makeLadder({ id: 'P34a', x: 20, bottomPlatform: segAt(F3, 20), topPlatform: segAt(F4, 20) }),
    makeLadder({ id: 'P34b', x: 204, bottomPlatform: segAt(F3, 204), topPlatform: segAt(F4, 204) }),
    makeLadder({ id: 'P4Ta', x: 84, bottomPlatform: segAt(F4, 84), topPlatform: TOP }),
    makeLadder({ id: 'P4Tb', x: 140, bottomPlatform: segAt(F4, 140), topPlatform: TOP }),
  ];

  return {
    platforms,
    ladders,
    pinIds,
    spawn: { x: 112, platform: F0 },
    robot: { x: 112, platform: TOP, facing: 1 },
    goal: null, // 목표는 도달이 아니라 안전핀 전부 해제
    hammers: [{ x: 112, platform: F0, lift: 13 }],
    items: [
      { x: 112, platform: segAt(F1, 112), kind: 'vest' },
      { x: 20, platform: segAt(F3, 20), kind: 'toolbox' },
      { x: 204, platform: segAt(F4, 204), kind: 'blueprint' },
    ],
    welders: [],
    spawnInterval: 3.4,
    ladderDropChance: 0,
    maxSparks: 4,
    sparkStart: { x: 112, platform: F0 },
  };
}

/* ══════════════════════════════════════════════════════ */

export const STAGE_DEFS = [
  { id: 1, kind: 'girders', name: '경사 철골', label: 'SLANTED GIRDERS', build: buildGirders },
  { id: 2, kind: 'conveyors', name: '자재 운반', label: 'MATERIAL BELTS', build: buildConveyors },
  { id: 3, kind: 'elevators', name: '승강 발판', label: 'HOIST PLATFORMS', build: buildElevators },
  { id: 4, kind: 'pins', name: '안전핀 해제', label: 'SAFETY PINS', build: buildPins },
];

export const STAGE_COUNT = STAGE_DEFS.length;

/** stageIndex(0부터) → 몇 번째 화면인가 */
export function stageDefFor(stageIndex) {
  return STAGE_DEFS[stageIndex % STAGE_COUNT];
}

/** stageIndex → 몇 바퀴째인가 (0부터) */
export function loopFor(stageIndex) {
  return Math.floor(stageIndex / STAGE_COUNT);
}

/**
 * 난이도. 바퀴를 돌수록 어려워지되 **상한이 있다.**
 * 무한히 빨라지면 사람이 반응할 수 없는 구간이 생겨 게임이 아니게 된다.
 */
export function difficultyFor(stageIndex) {
  const loop = loopFor(stageIndex);
  const within = stageIndex % STAGE_COUNT; // 같은 바퀴 안에서도 조금씩 오른다
  return {
    loop,
    speedMul: Math.min(1 + loop * 0.12 + within * 0.03, 1.8),
    spawnMul: Math.max(1 - loop * 0.1 - within * 0.025, 0.6),
    extraSparks: Math.min(loop, 2),
    bonusStart: Math.max(5000 - loop * 500, 3000),
  };
}

/** 스테이지 인스턴스를 새로 만든다. 이전 스테이지의 잔존물은 남지 않는다. */
export function buildStage(stageIndex) {
  const def = stageDefFor(stageIndex);
  const data = def.build();
  const diff = difficultyFor(stageIndex);
  return {
    def,
    kind: def.kind,
    index: stageIndex,
    diff,
    ...data,
    spawnInterval: data.spawnInterval * diff.spawnMul,
    maxSparks: Math.min(data.maxSparks + diff.extraSparks, 5),
  };
}

/** 배치용 헬퍼 — 발판 위 y */
export function placeOn(platform, x, lift = 0) {
  const y = surfaceYAt(platform, x);
  return y == null ? null : y - lift;
}
