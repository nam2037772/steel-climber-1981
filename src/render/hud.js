/**
 * 상단 HUD. 플레이 영역(y >= HUD_H)을 절대 침범하지 않는다.
 */

import { GAME_W, HUD_H, C } from '../core/constants.js';
import { drawText, drawTextRight, pad } from './text.js';
import { drawLifeIcon } from './sprites.js';

const ROW1 = 1;
const ROW2 = 9;
const ROW3 = 18;

export function drawHud(g, game, t) {
  g.fillStyle = C.bg;
  g.fillRect(0, 0, GAME_W, HUD_H);

  const blink = Math.floor(t * 2) % 2 === 0;
  const sc = game.score;

  drawText(g, '1UP', 6, ROW1, blink ? C.danger : C.textDim);
  drawText(g, 'HIGH SCORE', 68, ROW1, C.textDim);
  drawText(g, 'BONUS', 182, ROW1, C.textDim);

  drawText(g, pad(sc.value, 6), 6, ROW2, C.text);
  drawText(g, pad(sc.high, 6), 68, ROW2, sc.newHigh ? C.warn : C.text);
  drawText(g, pad(Math.max(0, sc.bonus), 4), 182, ROW2, sc.bonus <= 1000 ? C.danger : C.warn);

  // 남은 생명 (최대 5개까지 아이콘, 그 이상은 숫자)
  const lives = Math.max(0, sc.lives - 1);
  const shown = Math.min(lives, 5);
  for (let i = 0; i < shown; i++) drawLifeIcon(g, 6 + i * 8, ROW3 + 1);
  if (lives > 5) drawText(g, `+${lives - 5}`, 6 + 5 * 8 + 2, ROW3, C.textDim);

  drawTextRight(g, `STAGE ${game.loopNumber}-${game.screenNumber}`, GAME_W - 6, ROW3, C.accent);

  // HUD와 플레이 영역 경계선
  g.fillStyle = C.steelDark;
  g.fillRect(0, HUD_H - 1, GAME_W, 1);
}
