/**
 * 픽셀 스프라이트와 5×7 비트맵 폰트 — 전부 이 파일에서 직접 그린 자체 데이터다.
 * 외부 이미지 파일이나 원작 스프라이트를 쓰지 않는다.
 *
 * 스프라이트는 문자 격자로 적고, 문자→색 표를 넘겨서 그린다.
 */

import { C } from '../core/constants.js';

export const FONT_W = 5;
export const FONT_H = 7;
export const FONT_GAP = 1;

const G = (...rows) => rows.map((r) => r.split('').map((c) => (c === '#' ? 1 : 0)));

export const FONT = {
  A: G('.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  B: G('####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'),
  C: G('.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'),
  D: G('####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'),
  E: G('#####', '#....', '#....', '####.', '#....', '#....', '#####'),
  F: G('#####', '#....', '#....', '####.', '#....', '#....', '#....'),
  G: G('.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'),
  H: G('#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  I: G('#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'),
  J: G('..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'),
  K: G('#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'),
  L: G('#....', '#....', '#....', '#....', '#....', '#....', '#####'),
  M: G('#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'),
  N: G('#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'),
  O: G('.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  P: G('####.', '#...#', '#...#', '####.', '#....', '#....', '#....'),
  Q: G('.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'),
  R: G('####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'),
  S: G('.####', '#....', '#....', '.###.', '....#', '....#', '####.'),
  T: G('#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'),
  U: G('#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  V: G('#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'),
  W: G('#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'),
  X: G('#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'),
  Y: G('#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'),
  Z: G('#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'),
  0: G('.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'),
  1: G('..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  2: G('.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'),
  3: G('#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'),
  4: G('...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'),
  5: G('#####', '#....', '####.', '....#', '....#', '#...#', '.###.'),
  6: G('..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'),
  7: G('#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'),
  8: G('.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'),
  9: G('.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'),
  ' ': G('.....', '.....', '.....', '.....', '.....', '.....', '.....'),
  '-': G('.....', '.....', '.....', '#####', '.....', '.....', '.....'),
  '.': G('.....', '.....', '.....', '.....', '.....', '.##..', '.##..'),
  ':': G('.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'),
  '!': G('..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'),
  '?': G('.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'),
  '/': G('....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'),
  '<': G('...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'),
  '>': G('.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'),
  '+': G('.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'),
  '*': G('.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'),
  "'": G('..#..', '..#..', '.....', '.....', '.....', '.....', '.....'),
};

/* ── 스프라이트 ─────────────────────────────────────── */

function S(...rows) {
  return { w: rows[0].length, h: rows.length, rows };
}

/**
 * 플레이어 — 안전모(노랑) + 반사띠 안전조끼(주황) + 작업복(파랑).
 * 원작의 빨간 모자·멜빵바지 캐릭터와 무관한 자체 디자인이다.
 */
const P_HEAD = [
  '....HHHH....',
  '...HHHHHH...',
  '..HHHHHHHH..',
];

export const SPR_PLAYER_STAND = S(
  ...P_HEAD,
  '....SSSS....',
  '....SSSS....',
  '...VVVVVV...',
  '..VVVVVVVV..',
  '..VVOOVVVV..',
  '..VVVVVVVV..',
  '...CCCCCC...',
  '...CCCCCC...',
  '...CC..CC...',
  '...CC..CC...',
  '...CC..CC...',
  '..BBB..BBB..',
  '..BBB..BBB..',
);

export const SPR_PLAYER_WALK1 = S(
  ...P_HEAD,
  '....SSSS....',
  '....SSSS....',
  '...VVVVVV...',
  '..VVVVVVVV..',
  '..VVOOVVVV..',
  '..VVVVVVVV..',
  '...CCCCCC...',
  '...CCCCCC...',
  '...CCCC.....',
  '..CC..CC....',
  '.CC....CC...',
  '.BBB...BBB..',
  '.BB.....BB..',
);

export const SPR_PLAYER_WALK2 = S(
  ...P_HEAD,
  '....SSSS....',
  '....SSSS....',
  '...VVVVVV...',
  '..VVVVVVVV..',
  '..VVOOVVVV..',
  '..VVVVVVVV..',
  '...CCCCCC...',
  '...CCCCCC...',
  '.....CCCC...',
  '....CC..CC..',
  '...CC....CC.',
  '..BBB...BBB.',
  '..BB.....BB.',
);

export const SPR_PLAYER_JUMP = S(
  ...P_HEAD,
  '.S..SSSS..S.',
  '.S..SSSS..S.',
  '.SVVVVVVVVS.',
  '..VVVVVVVV..',
  '..VVOOVVVV..',
  '..VVVVVVVV..',
  '...CCCCCC...',
  '..CCCCCCCC..',
  '..CC....CC..',
  '.BBB....BBB.',
  '.BB......BB.',
  '............',
  '............',
);

export const SPR_PLAYER_CLIMB1 = S(
  ...P_HEAD,
  '..S.VVVV.S..',
  '..S.VVVV.S..',
  '..SVVVVVVS..',
  '...VVVVVV...',
  '...VVOOVV...',
  '...VVVVVV...',
  '...CCCCCC...',
  '...CCCCCC...',
  '..CC....CC..',
  '..CC....CC..',
  '..BB....BB..',
  '..BB....BB..',
  '............',
);

export const SPR_PLAYER_CLIMB2 = S(
  ...P_HEAD,
  '..S.VVVV....',
  '..S.VVVV.S..',
  '..SVVVVVVS..',
  '...VVVVVV...',
  '...VVOOVV...',
  '...VVVVVV...',
  '...CCCCCC...',
  '...CCCCCC...',
  '...CC..CC...',
  '..CC....CC..',
  '..BB....BB..',
  '...BB..BB...',
  '............',
);

export const SPR_PLAYER_DOWN = S(
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '...HHHHHH...',
  '..HHHHHHHH..',
  '....SSSS....',
  '.VVVVVVVVVV.',
  '.VVVVOOVVVV.',
  '.CCCC..CCCC.',
  '.BB......BB.',
  '............',
  '............',
  '............',
);

export const PLAYER_PAL = {
  H: C.helmet, S: C.skin, V: C.vest, O: C.helmet, C: C.cloth, B: C.boot,
};

/** 안전조끼 아이템 */
export const SPR_ITEM_VEST = S(
  '.VV....VV.',
  'VVVVVVVVVV',
  'VOOVVVVOOV',
  'VVVVVVVVVV',
  'VOOVVVVOOV',
  'VVVVVVVVVV',
  '.VVVVVVVV.',
);

/** 공구함 */
export const SPR_ITEM_TOOLBOX = S(
  '...KKKK...',
  '..K....K..',
  'RRRRRRRRRR',
  'RKKRRRRKKR',
  'RRRRRRRRRR',
  'RKKKKKKKKR',
  'RRRRRRRRRR',
);

/** 도면통 */
export const SPR_ITEM_BLUEPRINT = S(
  '..TTTTTT..',
  '.TWWWWWWT.',
  '.TWTTTTWT.',
  '.TWWWWWWT.',
  '.TWTTTTWT.',
  '.TWWWWWWT.',
  '..TTTTTT..',
);

export const ITEM_PAL = {
  V: C.vest, O: C.helmet, K: C.steelDark, R: C.danger,
  T: C.accent, W: C.goalPanel,
};

/** 전동 브레이커(해머) 픽업 아이콘 */
export const SPR_HAMMER_PICK = S(
  '.MMMMMM.',
  'MMMMMMMM',
  'MMMMMMMM',
  '.MMMMMM.',
  '...YY...',
  '...YY...',
  '...YY...',
  '...YY...',
  '..YYYY..',
);

export const HAMMER_PAL = { M: C.hammerHead, Y: C.hammer };

/* ── 그리기 헬퍼 ────────────────────────────────────── */

/**
 * 문자 격자 스프라이트를 그린다. 같은 색이 이어지는 구간을 한 번에 채워
 * fillRect 호출 수를 줄인다.
 */
export function drawSprite(g, spr, x, y, pal, flip = false) {
  const { w, h, rows } = spr;
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    let c = 0;
    while (c < w) {
      const ch = row[c];
      if (ch === '.' || !pal[ch]) { c++; continue; }
      let n = 1;
      while (c + n < w && row[c + n] === ch) n++;
      const px = flip ? x + (w - c - n) : x + c;
      g.fillStyle = pal[ch];
      g.fillRect(px, y + r, n, 1);
      c += n;
    }
  }
}

/** 픽셀 느낌의 원 — 행 단위로 채운다 */
export function pixelCircle(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (dx <= 0) continue;
    g.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2, 1);
  }
}

/**
 * 굴러가는 드럼통 / 케이블 릴.
 * 회전은 몸통을 가로지르는 띠의 위치를 rot에 따라 움직여서 표현한다.
 */
export function drawDrum(g, x, y, r, rot, kind) {
  const cx = Math.round(x);
  const cy = Math.round(y - r);
  const body = kind === 'reel' ? C.steel : C.drum;
  const band = kind === 'reel' ? C.accent : C.drumBand;

  pixelCircle(g, cx, cy, r, C.drumDark);
  pixelCircle(g, cx, cy, r - 1, body);

  // 회전하는 띠 두 줄
  for (let i = 0; i < 2; i++) {
    const phase = rot + i * Math.PI;
    const off = Math.sin(phase) * (r - 1.2);
    const yy = Math.round(cy + off);
    const half = Math.floor(Math.sqrt(Math.max(0, (r - 1) * (r - 1) - off * off)));
    if (half <= 0) continue;
    g.fillStyle = band;
    g.fillRect(cx - half, yy, half * 2, 1);
  }
  // 위쪽 하이라이트
  g.fillStyle = C.steelLit;
  g.fillRect(cx - 1, cy - r + 1, 2, 1);
}

/** 자재 상자 */
export function drawCrate(g, x, y) {
  const l = Math.round(x - 6);
  const t = Math.round(y - 11);
  g.fillStyle = C.steelDark;
  g.fillRect(l, t, 12, 11);
  g.fillStyle = C.drum;
  g.fillRect(l + 1, t + 1, 10, 9);
  g.fillStyle = C.drumBand;
  g.fillRect(l + 1, t + 4, 10, 2);
  g.fillRect(l + 5, t + 1, 2, 9);
}

/** 낙하 공구 (렌치) */
export function drawTool(g, x, y, spin) {
  const cx = Math.round(x);
  const cy = Math.round(y - 5);
  const tilt = Math.sin(spin) > 0;
  g.fillStyle = C.steelLit;
  if (tilt) {
    g.fillRect(cx - 1, cy - 5, 2, 10);
    g.fillRect(cx - 3, cy - 5, 6, 2);
  } else {
    g.fillRect(cx - 5, cy - 1, 10, 2);
    g.fillRect(cx - 5, cy - 3, 2, 6);
  }
  g.fillStyle = C.steel;
  g.fillRect(cx - 1, cy - 1, 2, 2);
}

/** 용접 불꽃 / 점검 드론 */
export function drawSpark(g, x, y, anim, kind) {
  const cx = Math.round(x);
  const base = Math.round(y);
  const f = Math.floor(anim) % 3;
  if (kind === 'drone') {
    g.fillStyle = C.steel;
    g.fillRect(cx - 4, base - 8, 8, 5);
    g.fillStyle = C.steelDark;
    g.fillRect(cx - 5, base - 4, 10, 2);
    g.fillStyle = f === 0 ? C.danger : C.sparkMid;
    g.fillRect(cx - 2, base - 7, 4, 2);
    g.fillStyle = C.accent;
    g.fillRect(cx - 6, base - 9, 3, 1);
    g.fillRect(cx + 3, base - 9, 3, 1);
    return;
  }
  const wob = f === 1 ? 1 : f === 2 ? -1 : 0;
  g.fillStyle = C.sparkLow;
  g.fillRect(cx - 4, base - 5, 8, 5);
  g.fillRect(cx - 3, base - 8, 6, 3);
  g.fillStyle = C.sparkMid;
  g.fillRect(cx - 3, base - 4, 6, 4);
  g.fillRect(cx - 2 + wob, base - 9, 4, 5);
  g.fillStyle = C.sparkHot;
  g.fillRect(cx - 1, base - 3, 2, 3);
  g.fillRect(cx - 1 + wob, base - 10, 2, 4);
}

/**
 * 폭주한 대형 양중·운반 로봇.
 * 고릴라 형태가 아닌, 궤도 위에 얹힌 상자형 크레인 로봇이다.
 */
export function drawRobot(g, x, y, anim, throwing, facing) {
  const l = Math.round(x - 15);
  const b = Math.round(y);
  const f = facing >= 0 ? 1 : -1;
  const idle = Math.floor(anim * 3) % 2;

  // 궤도
  g.fillStyle = C.robotDark;
  g.fillRect(l, b - 6, 30, 6);
  g.fillStyle = C.steel;
  for (let i = 0; i < 7; i++) g.fillRect(l + 1 + i * 4, b - 5, 2, 4);

  // 몸통
  g.fillStyle = C.robotDark;
  g.fillRect(l + 2, b - 22, 26, 16);
  g.fillStyle = C.robot;
  g.fillRect(l + 4, b - 20, 22, 12);

  // 경고등 / 눈
  g.fillStyle = idle ? C.robotEye : C.danger;
  g.fillRect(l + 8, b - 18, 5, 4);
  g.fillRect(l + 17, b - 18, 5, 4);
  g.fillStyle = C.steelDark;
  g.fillRect(l + 8, b - 12, 14, 3);
  g.fillStyle = C.warn;
  for (let i = 0; i < 4; i++) g.fillRect(l + 9 + i * 4, b - 12, 2, 3);

  // 양중 팔 — 드럼통을 내려놓을 때 앞으로 뻗는다
  const armX = f > 0 ? l + 26 : l - 4;
  const reach = throwing > 0 ? 6 : 2;
  g.fillStyle = C.robot;
  g.fillRect(f > 0 ? armX : armX + 4 - reach, b - 18, reach, 4);
  g.fillStyle = C.warn;
  g.fillRect(f > 0 ? armX + reach - 2 : armX + 4 - reach, b - 19, 2, 6);

  // 상단 회전등
  g.fillStyle = throwing > 0 || idle ? C.warn : C.steelDark;
  g.fillRect(l + 12, b - 25, 6, 3);
}

/** 비상정지 제어장치 */
export function drawGoal(g, x, y, t) {
  const l = Math.round(x - 8);
  const b = Math.round(y);
  g.fillStyle = C.steelDark;
  g.fillRect(l, b - 20, 16, 20);
  g.fillStyle = C.goalPanel;
  g.fillRect(l + 1, b - 19, 14, 14);
  const blink = Math.floor(t * 3) % 2 === 0;
  g.fillStyle = blink ? C.goal : '#8c1c16';
  g.fillRect(l + 4, b - 16, 8, 8);
  g.fillStyle = C.steelDark;
  g.fillRect(l + 6, b - 14, 4, 4);
  g.fillStyle = C.warn;
  g.fillRect(l + 2, b - 4, 12, 2);
  g.fillStyle = C.steel;
  g.fillRect(l + 3, b - 22, 10, 2);
}

/** 용접기 (불꽃이 생기는 자리) */
export function drawWelder(g, x, y, t) {
  const l = Math.round(x - 7);
  const b = Math.round(y);
  g.fillStyle = C.steelDark;
  g.fillRect(l, b - 12, 14, 12);
  g.fillStyle = C.steel;
  g.fillRect(l + 1, b - 11, 12, 8);
  g.fillStyle = Math.floor(t * 6) % 2 ? C.sparkMid : C.sparkLow;
  g.fillRect(l + 4, b - 9, 6, 3);
  g.fillStyle = C.warn;
  g.fillRect(l + 1, b - 3, 12, 2);
}

/** 전동 브레이커를 든 모습 (2프레임) */
export function drawHammerSwing(g, px, py, facing, frame) {
  const f = facing >= 0 ? 1 : -1;
  if (frame === 0) {
    // 앞으로 내려침
    const hx = f > 0 ? px + 3 : px - 11;
    g.fillStyle = C.hammer;
    g.fillRect(f > 0 ? px + 1 : px - 3, py - 12, 3, 6);
    g.fillStyle = C.hammerHead;
    g.fillRect(hx, py - 9, 8, 7);
    g.fillStyle = C.steelDark;
    g.fillRect(hx + (f > 0 ? 6 : 0), py - 8, 2, 5);
  } else {
    // 위로 치켜듦
    const hx = f > 0 ? px : px - 8;
    g.fillStyle = C.hammer;
    g.fillRect(f > 0 ? px + 1 : px - 3, py - 18, 3, 7);
    g.fillStyle = C.hammerHead;
    g.fillRect(hx, py - 26, 8, 7);
    g.fillStyle = C.steelDark;
    g.fillRect(hx + 1, py - 25, 6, 2);
  }
}

/** HUD의 남은 생명 아이콘 (작은 안전모) */
export function drawLifeIcon(g, x, y) {
  g.fillStyle = C.helmet;
  g.fillRect(x + 1, y, 4, 1);
  g.fillRect(x, y + 1, 6, 2);
  g.fillStyle = C.vest;
  g.fillRect(x, y + 3, 6, 1);
}
