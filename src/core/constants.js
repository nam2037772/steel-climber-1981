/**
 * 게임 전역 상수.
 *
 * 좌표계는 화면 표시 크기와 완전히 분리된 **내부 논리 좌표**다.
 * 캔버스 백버퍼를 정확히 GAME_W × GAME_H 로 두고 CSS가 정수배로 확대하므로,
 * 창 크기가 어떻게 바뀌어도 충돌 좌표는 1픽셀도 달라지지 않는다.
 */

/** 1981년 세로형 아케이드 기판의 내부 해상도 (224×256) */
export const GAME_W = 224;
export const GAME_H = 256;

/** 상단 HUD 영역 높이. 플레이 영역은 y = HUD_H .. GAME_H */
export const HUD_H = 26;

/* ── 물리 (px/s, px/s²) ─────────────────────────────── */

export const WALK_SPEED = 52;
export const CLIMB_SPEED = 38;
export const JUMP_VY = -125;
export const GRAVITY = 520;
export const MAX_FALL_SPEED = 260;

/** 이보다 많이 떨어지면 착지 순간 사망 (층 간격 최소 22px보다 크게) */
export const FALL_DEATH_DIST = 34;

/** 발판 표면에 "붙어 있다"고 볼 허용 오차 */
export const GROUND_EPS = 1.2;

/** 사다리 중심에서 이 거리 안에 있어야 오르내릴 수 있다 */
export const LADDER_SNAP_X = 4;

/* ── 크기 ───────────────────────────────────────────── */

export const PLAYER_W = 12;
export const PLAYER_H = 16;
/** 충돌상자는 스프라이트보다 작게 — 억울한 피격을 줄인다 */
export const PLAYER_HIT_W = 8;
export const PLAYER_HIT_H = 13;

export const DRUM_R = 5;
export const SPARK_W = 9;
export const SPARK_H = 11;

/* ── 타이밍 (초) ────────────────────────────────────── */

export const HAMMER_DURATION = 9.0;
export const HAMMER_WARN = 2.5;
export const HAMMER_SWING_PERIOD = 0.14;
export const RESPAWN_INVULN = 1.4;
export const DEATH_ANIM = 1.4;
export const STAGE_INTRO = 1.9;
export const STAGE_CLEAR_ANIM = 2.6;

/* ── 점수 (원작 점수표를 쓰지 않고 자체 산정) ────────── */

export const SCORE = {
  jump1: 120,
  jump2: 320,
  jump3: 700,
  smashDrum: 350,
  smashSpark: 550,
  item: { vest: 400, toolbox: 600, blueprint: 900 },
  pin: 150,
  extraLifeAt: 12000,
};

/** 보너스(제한시간) */
export const BONUS_START = 5000;
export const BONUS_STEP = 100;
export const BONUS_INTERVAL = 0.75; // 초마다 BONUS_STEP 감소

export const START_LIVES = 3;

/* ── 색상표 (철골 회청색 + 안전색) ───────────────────── */

export const C = {
  bg: '#000000',
  steelDark: '#2d3747',
  steel: '#5d6e88',
  steelLit: '#93a6c0',
  rivet: '#c3d2e4',
  ladder: '#b9c6d8',
  ladderDark: '#6d7a8c',

  helmet: '#ffd400',
  vest: '#ff7a1a',
  cloth: '#2f6fd0',
  skin: '#f2c89a',
  boot: '#3a2a1c',

  drum: '#c2521f',
  drumBand: '#f2a33c',
  drumDark: '#7a3316',

  sparkHot: '#fff0a8',
  sparkMid: '#ffb01f',
  sparkLow: '#ff4222',

  robot: '#8d97ad',
  robotDark: '#4a5364',
  robotEye: '#ff3b30',

  goal: '#ff3b30',
  goalPanel: '#dfe7f2',

  hammer: '#ffd400',
  hammerHead: '#9aa7ba',

  text: '#e8eef7',
  textDim: '#7f8ea6',
  accent: '#46d9ff',
  warn: '#ffd400',
  danger: '#ff4222',
};
