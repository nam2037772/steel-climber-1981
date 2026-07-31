/**
 * 5×7 픽셀 폰트 텍스트 렌더링.
 * 캔버스 기본 폰트를 쓰지 않는 이유: 당시 화면은 전부 비트맵 글자였고,
 * 벡터 폰트를 224px 폭에 축소하면 레트로 질감이 무너진다.
 */

import { FONT, FONT_W, FONT_H, FONT_GAP } from './sprites.js';

export const CHAR_ADVANCE = FONT_W + FONT_GAP; // 6px

export function textWidth(str, scale = 1) {
  const n = String(str).length;
  if (!n) return 0;
  return (n * CHAR_ADVANCE - FONT_GAP) * scale;
}

export function textHeight(scale = 1) {
  return FONT_H * scale;
}

export function drawText(g, str, x, y, color = '#e8eef7', scale = 1) {
  g.fillStyle = color;
  const s = String(str).toUpperCase();
  const adv = CHAR_ADVANCE * scale;
  for (let i = 0; i < s.length; i++) {
    const glyph = FONT[s[i]];
    if (!glyph) continue;
    const gx = x + i * adv;
    for (let r = 0; r < FONT_H; r++) {
      const row = glyph[r];
      let run = 0;
      for (let c = 0; c <= FONT_W; c++) {
        if (c < FONT_W && row[c]) {
          run++;
        } else if (run > 0) {
          g.fillRect(gx + (c - run) * scale, y + r * scale, run * scale, scale);
          run = 0;
        }
      }
    }
  }
}

export function drawTextCentered(g, str, cx, y, color, scale = 1) {
  drawText(g, str, Math.round(cx - textWidth(str, scale) / 2), y, color, scale);
}

export function drawTextRight(g, str, rx, y, color, scale = 1) {
  drawText(g, str, Math.round(rx - textWidth(str, scale)), y, color, scale);
}

/** 점수 자릿수 맞추기 */
export function pad(v, n = 6) {
  const s = String(Math.floor(v));
  return s.length >= n ? s : '0'.repeat(n - s.length) + s;
}
