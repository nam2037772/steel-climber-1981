/**
 * 화면 그리기.
 *
 * 캔버스 백버퍼는 224×256 고정이고 CSS가 정수배로 확대한다.
 * 따라서 여기서 쓰는 좌표 = 게임 논리 좌표이며, 창 크기와 무관하게 항상 일치한다.
 *
 * 발판은 **충돌 판정에 쓰는 surfaceYAt() 을 그대로 써서** 그린다.
 * 그림과 판정이 어긋날 수 없는 구조다.
 */

import { GAME_W, GAME_H, HUD_H, C, PLAYER_H, SCORE } from '../core/constants.js';
import { surfaceYAt, platformSpan } from '../game/geometry.js';
import { PS } from '../game/player.js';
import { GS } from '../game/game.js';
import { drawText, drawTextCentered, pad, textWidth } from './text.js';
import { drawHud } from './hud.js';
import {
  SPR_PLAYER_STAND, SPR_PLAYER_WALK1, SPR_PLAYER_WALK2, SPR_PLAYER_JUMP,
  SPR_PLAYER_CLIMB1, SPR_PLAYER_CLIMB2, SPR_PLAYER_DOWN, PLAYER_PAL,
  SPR_ITEM_VEST, SPR_ITEM_TOOLBOX, SPR_ITEM_BLUEPRINT, ITEM_PAL,
  SPR_HAMMER_PICK, HAMMER_PAL,
  drawSprite, drawDrum, drawCrate, drawTool, drawSpark, drawRobot,
  drawGoal, drawWelder, drawHammerSwing,
} from './sprites.js';

const ITEM_SPR = {
  vest: SPR_ITEM_VEST,
  toolbox: SPR_ITEM_TOOLBOX,
  blueprint: SPR_ITEM_BLUEPRINT,
};

/** 경사 발판을 그릴 때, 반올림한 y가 같은 구간을 묶어서 칠한다 */
function scanPlatform(p, fn) {
  const [l, r] = platformSpan(p);
  const x0 = Math.round(l);
  const x1 = Math.round(r);
  let startX = x0;
  let curY = surfaceYAt(p, x0);
  if (curY == null) return;
  curY = Math.round(curY);
  for (let x = x0 + 1; x <= x1; x++) {
    const raw = surfaceYAt(p, x);
    const y = raw == null ? curY : Math.round(raw);
    if (y !== curY) {
      fn(startX, x - 1, curY);
      startX = x;
      curY = y;
    }
  }
  fn(startX, x1, curY);
}

function drawGirder(g, p) {
  scanPlatform(p, (x0, x1, y) => {
    const w = x1 - x0 + 1;
    g.fillStyle = C.steelLit;
    g.fillRect(x0, y, w, 1);
    g.fillStyle = C.steel;
    g.fillRect(x0, y + 1, w, 2);
    g.fillStyle = C.steelDark;
    g.fillRect(x0, y + 3, w, 1);
  });
  // 리벳
  const [l, r] = platformSpan(p);
  g.fillStyle = C.rivet;
  for (let x = Math.round(l) + 5; x < r - 2; x += 13) {
    const y = surfaceYAt(p, x);
    if (y != null) g.fillRect(x, Math.round(y) + 1, 1, 1);
  }
}

function drawConveyor(g, p, t) {
  const [l, r] = platformSpan(p);
  const y = Math.round(surfaceYAt(p, l));
  const w = r - l;
  g.fillStyle = C.steelDark;
  g.fillRect(l, y, w, 5);
  g.fillStyle = C.steel;
  g.fillRect(l, y, w, 1);
  // 벨트 방향을 알려주는 흐르는 표시
  const shift = ((t * p.belt) % 8 + 8) % 8;
  g.fillStyle = C.warn;
  for (let x = l - 8; x < r; x += 8) {
    const px = Math.round(x + shift);
    if (px < l || px + 3 > r) continue;
    g.fillRect(px, y + 2, 3, 2);
  }
  // 양끝 롤러
  g.fillStyle = C.steelLit;
  g.fillRect(l, y, 2, 5);
  g.fillRect(r - 2, y, 2, 5);
}

function drawElevatorCar(g, p) {
  const [l, r] = platformSpan(p);
  const y = Math.round(surfaceYAt(p, l));
  const w = r - l;
  // 케이블
  g.fillStyle = C.steelDark;
  g.fillRect(Math.round((l + r) / 2), HUD_H, 1, y - HUD_H);
  g.fillStyle = C.steelLit;
  g.fillRect(l, y, w, 1);
  g.fillStyle = C.steel;
  g.fillRect(l, y + 1, w, 3);
  g.fillStyle = C.warn;
  g.fillRect(l, y + 4, w, 1);
  g.fillStyle = C.steelDark;
  g.fillRect(l, y - 2, 2, 3);
  g.fillRect(r - 2, y - 2, 2, 3);
}

function drawPinSegment(g, p) {
  const [l, r] = platformSpan(p);
  const y = Math.round(p.points[0][1]);
  if (p.removed) {
    // 해제된 자리 — 잘린 단면만 남는다
    g.fillStyle = C.steelDark;
    g.fillRect(l, y, 2, 4);
    g.fillRect(r - 2, y, 2, 4);
    return;
  }
  const w = r - l;
  g.fillStyle = C.steelLit;
  g.fillRect(l, y, w, 1);
  g.fillStyle = p.stepped ? C.drum : C.steel;
  g.fillRect(l, y + 1, w, 2);
  g.fillStyle = C.steelDark;
  g.fillRect(l, y + 3, w, 1);
  // 안전핀 머리
  g.fillStyle = p.stepped ? C.danger : C.warn;
  g.fillRect(l + Math.floor(w / 2) - 2, y - 3, 4, 3);
}

function drawLadder(g, l) {
  const top = Math.round(l.broken ? l.usableTop : l.top);
  const bottom = Math.round(l.bottom);
  const x = Math.round(l.x);
  g.fillStyle = C.ladderDark;
  g.fillRect(x - 4, top, 1, bottom - top + 1);
  g.fillRect(x + 3, top, 1, bottom - top + 1);
  g.fillStyle = C.ladder;
  g.fillRect(x - 3, top, 1, bottom - top + 1);
  g.fillRect(x + 2, top, 1, bottom - top + 1);
  for (let y = bottom - 3; y > top; y -= 4) {
    g.fillRect(x - 3, y, 6, 1);
  }
  if (l.broken) {
    // 끊어진 부분 — 위쪽에 부러진 흔적만 남긴다
    g.fillStyle = C.danger;
    g.fillRect(x - 3, top, 2, 1);
    g.fillRect(x + 1, top, 2, 1);
    g.fillStyle = C.ladderDark;
    g.fillRect(x - 3, Math.round(l.top), 1, 3);
    g.fillRect(x + 2, Math.round(l.top), 1, 3);
  }
}

/** 배경 — 야간 공사현장의 철골 실루엣 */
function drawBackground(g, game) {
  g.fillStyle = C.bg;
  g.fillRect(0, HUD_H, GAME_W, GAME_H - HUD_H);

  // 좌우 기둥
  g.fillStyle = '#161c26';
  g.fillRect(0, HUD_H, 3, GAME_H - HUD_H);
  g.fillRect(GAME_W - 3, HUD_H, 3, GAME_H - HUD_H);

  // 층 사이 X 브레이스 (매우 어둡게 — 가독성을 해치지 않는다)
  const plats = game.stage.platforms.filter((p) => !p.motion && p.kind !== 'pin');
  g.fillStyle = '#101620';
  for (let i = 0; i < plats.length - 1; i++) {
    const a = plats[i];
    const b = plats[i + 1];
    const [al, ar] = platformSpan(a);
    const [bl, br] = platformSpan(b);
    const l = Math.max(al, bl);
    const r = Math.min(ar, br);
    if (r - l < 30) continue;
    for (let x = l + 14; x < r - 14; x += 34) {
      const ay = surfaceYAt(a, x);
      const by = surfaceYAt(b, x);
      if (ay == null || by == null) continue;
      const top = Math.min(ay, by);
      const bot = Math.max(ay, by);
      if (bot - top < 12) continue;
      for (let y = top + 4; y < bot - 2; y += 2) {
        const t = (y - top) / (bot - top);
        g.fillRect(Math.round(x - 10 + t * 20), y, 2, 1);
        g.fillRect(Math.round(x + 10 - t * 20), y, 2, 1);
      }
    }
  }
}

function playerSprite(p, t) {
  if (p.state === PS.DEAD) return SPR_PLAYER_DOWN;
  if (p.state === PS.LADDER) {
    return Math.floor(p.climbAnim) % 2 === 0 ? SPR_PLAYER_CLIMB1 : SPR_PLAYER_CLIMB2;
  }
  if (p.state === PS.AIR) return SPR_PLAYER_JUMP;
  if (Math.abs(p.vx) < 0.5) return SPR_PLAYER_STAND;
  const f = Math.floor(p.walkAnim) % 4;
  if (f === 1) return SPR_PLAYER_WALK1;
  if (f === 3) return SPR_PLAYER_WALK2;
  void t;
  return SPR_PLAYER_STAND;
}

function drawPlayer(g, game, t) {
  const p = game.player;
  const x = Math.round(p.x - 6);
  const y = Math.round(p.y - PLAYER_H);

  // 사망 연출 — 앞부분은 회전, 뒤에는 쓰러진 자세
  if (p.state === PS.DEAD) {
    if (p.deadTimer < 0.85) {
      // 45도 단위로 끊어 돌린다 — 부드럽게 돌리면 픽셀이 뭉개져 레트로 질감이 깨진다
      const step = Math.PI / 4;
      const ang = Math.round((p.deadTimer * 13) / step) * step;
      g.save();
      g.translate(Math.round(p.x), Math.round(p.y - PLAYER_H / 2));
      g.rotate(ang);
      drawSprite(g, SPR_PLAYER_STAND, -6, -PLAYER_H / 2, PLAYER_PAL);
      g.restore();
    } else {
      drawSprite(g, SPR_PLAYER_DOWN, x, y, PLAYER_PAL);
    }
    return;
  }

  // 부활 직후 짧은 무적 동안만 깜빡인다 (디버그로 무적을 길게 준 경우엔 계속 보이게)
  if (p.invuln > 0 && p.invuln < 3 && Math.floor(t * 12) % 2 === 0) return;

  const flip = p.facing < 0 && p.state !== PS.LADDER;
  drawSprite(g, playerSprite(p, t), x, y, PLAYER_PAL, flip);

  if (game.hammer.active) {
    const warn = game.hammer.warning && Math.floor(t * 10) % 2 === 0;
    if (!warn) drawHammerSwing(g, Math.round(p.x), Math.round(p.y), p.facing, game.hammer.frame);
  }
}

function drawEntities(g, game, t) {
  const s = game.stage;

  for (const w of s.welderSpots || []) drawWelder(g, w.x, w.y, t);

  for (const h of s.hammerPickups || []) {
    if (h.taken) continue;
    const bob = Math.floor(t * 4) % 2;
    drawSprite(g, SPR_HAMMER_PICK, Math.round(h.x - 4), Math.round(h.y - 5 + bob), HAMMER_PAL);
  }

  for (const it of s.itemPickups || []) {
    if (it.taken) continue;
    const spr = ITEM_SPR[it.kind] || SPR_ITEM_VEST;
    drawSprite(g, spr, Math.round(it.x - spr.w / 2), Math.round(it.y - spr.h), ITEM_PAL);
  }

  if (s.goalPos) drawGoal(g, s.goalPos.x, s.goalPos.y, t);
  if (s.robotPos) {
    drawRobot(g, s.robotPos.x, s.robotPos.y, game.robotAnim || 0, game.robotThrow || 0, s.robotPos.facing);
  }

  for (const r of game.rollers) {
    if (r.kind === 'crate') drawCrate(g, r.x, r.y);
    else drawDrum(g, r.x, r.y, r.r, r.rot, r.kind);
  }
  for (const tool of game.tools) drawTool(g, tool.x, tool.y, tool.spin);
  for (const sp of game.sparks) drawSpark(g, sp.x, sp.y, sp.anim, sp.kind);
}

function drawEffects(g, effects) {
  for (const b of effects.bursts) {
    g.fillStyle = b.color;
    g.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
  }
  for (const p of effects.popups) {
    const fade = p.t / p.life;
    if (fade > 0.7 && Math.floor(p.t * 20) % 2) continue;
    drawTextCentered(g, p.text, p.x, Math.round(p.y), p.color);
  }
}

/* ── 화면 오버레이 ──────────────────────────────────── */

function panel(g, y, h) {
  g.fillStyle = 'rgba(0,0,0,0.88)';
  g.fillRect(0, y, GAME_W, h);
  g.fillStyle = C.steelDark;
  g.fillRect(0, y, GAME_W, 1);
  g.fillRect(0, y + h - 1, GAME_W, 1);
}

function drawTitle(g, game, t) {
  const blink = Math.floor(t * 1.8) % 2 === 0;

  // 뒤에 깔린 철골이 글자를 방해하지 않도록 어둡게 덮는다 (실루엣만 남는다)
  g.fillStyle = 'rgba(0,0,0,0.84)';
  g.fillRect(0, HUD_H, GAME_W, GAME_H - HUD_H);

  drawTextCentered(g, 'STEEL', GAME_W / 2, 30, C.helmet, 3);
  drawTextCentered(g, 'CLIMBER', GAME_W / 2, 54, C.vest, 3);
  drawTextCentered(g, '1981', GAME_W / 2, 80, C.accent, 2);

  // 제목 아래 안전색 띠
  g.fillStyle = C.steelDark;
  g.fillRect(26, 96, GAME_W - 52, 1);

  drawTextCentered(g, '1 PLAYER', GAME_W / 2, 102, C.text);
  drawTextCentered(g, `HIGH SCORE  ${pad(game.score.high, 6)}`, GAME_W / 2, 112, C.textDim);

  // 점수표
  const rows = [
    ['DRUM JUMP', SCORE.jump1],
    ['BREAKER SMASH', SCORE.smashDrum],
    ['SPARK CLEAR', SCORE.smashSpark],
    ['ITEMS', `${SCORE.item.vest}-${SCORE.item.blueprint}`],
  ];
  let y = 126;
  for (const [label, val] of rows) {
    drawText(g, label, 32, y, C.textDim);
    drawText(g, String(val), 158, y, C.warn);
    y += 10;
  }

  g.fillStyle = C.steelDark;
  g.fillRect(26, 167, GAME_W - 52, 1);

  drawTextCentered(g, 'ARROWS/WASD  MOVE + CLIMB', GAME_W / 2, 173, C.text);
  drawTextCentered(g, 'SPACE JUMP    X BREAKER', GAME_W / 2, 183, C.text);
  drawTextCentered(g, 'P PAUSE       ENTER START', GAME_W / 2, 193, C.text);

  if (blink) drawTextCentered(g, 'PRESS ENTER', GAME_W / 2, 207, C.helmet);
}

function drawIntro(g, game) {
  panel(g, 104, 46);
  drawTextCentered(g, `STAGE ${game.loopNumber}-${game.screenNumber}`, GAME_W / 2, 112, C.helmet, 2);
  drawTextCentered(g, game.stageLabel, GAME_W / 2, 134, C.accent);
}

function drawClear(g, game, t) {
  panel(g, 100, 54);
  drawTextCentered(g, 'STAGE CLEAR', GAME_W / 2, 108, C.helmet, 2);
  if (Math.floor(t * 4) % 2 === 0) {
    drawTextCentered(g, 'EMERGENCY STOP ENGAGED', GAME_W / 2, 132, C.accent);
  }
  drawTextCentered(g, `SCORE ${pad(game.score.value, 6)}`, GAME_W / 2, 142, C.text);
}

function drawGameOver(g, game, t) {
  panel(g, 92, 74);
  drawTextCentered(g, 'GAME OVER', GAME_W / 2, 100, C.danger, 2);
  drawTextCentered(g, `SCORE ${pad(game.score.value, 6)}`, GAME_W / 2, 124, C.text);
  if (game.score.newHigh) {
    drawTextCentered(g, 'NEW HIGH SCORE!', GAME_W / 2, 136, C.helmet);
  } else {
    drawTextCentered(g, `HIGH  ${pad(game.score.high, 6)}`, GAME_W / 2, 136, C.textDim);
  }
  if (game.inputLock <= 0 && Math.floor(t * 2) % 2 === 0) {
    drawTextCentered(g, 'PRESS ENTER TO RETRY', GAME_W / 2, 152, C.accent);
  }
}

function drawPaused(g, t) {
  panel(g, 112, 32);
  if (Math.floor(t * 2) % 2 === 0) drawTextCentered(g, 'PAUSED', GAME_W / 2, 122, C.helmet, 2);
}

/* ── 진입점 ─────────────────────────────────────────── */

export function render(g, game, t) {
  g.imageSmoothingEnabled = false;
  drawBackground(g, game);

  for (const p of game.stage.platforms) {
    if (p.kind === 'pin') drawPinSegment(g, p);
    else if (p.belt) drawConveyor(g, p, t);
    else if (p.motion) drawElevatorCar(g, p);
    else drawGirder(g, p);
  }
  for (const l of game.stage.ladders) drawLadder(g, l);

  if (game.state !== GS.TITLE) {
    drawEntities(g, game, t);
    drawPlayer(g, game, t);
    drawEffects(g, game.effects);
  } else {
    // 타이틀 뒤에도 로봇은 서 있게 해서 화면이 비지 않게 한다
    if (game.stage.robotPos) {
      drawRobot(g, game.stage.robotPos.x, game.stage.robotPos.y, t, 0, game.stage.robotPos.facing);
    }
  }

  drawHud(g, game, t);

  switch (game.state) {
    case GS.TITLE: drawTitle(g, game, t); break;
    case GS.INTRO: drawIntro(g, game); break;
    case GS.CLEAR: drawClear(g, game, t); break;
    case GS.GAMEOVER: drawGameOver(g, game, t); break;
    default: break;
  }
  if (game.paused && game.state !== GS.TITLE) drawPaused(g, t);

  // 안전핀 스테이지의 남은 개수 안내
  if (game.stage.kind === 'pins' && game.state === GS.PLAY) {
    const label = `PINS ${game.pinsLeft}`;
    drawText(g, label, Math.round((GAME_W - textWidth(label)) / 2), HUD_H + 3, C.warn);
  }
  void pad;
}
