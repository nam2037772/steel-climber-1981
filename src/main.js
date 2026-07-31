/**
 * 부트스트랩 — DOM · 입력 · 사운드 · 게임 루프를 연결한다.
 * 게임 규칙 자체는 여기에 없다 (src/game/*).
 */

import { GAME_W, GAME_H } from './core/constants.js';
import { Loop } from './core/loop.js';
import { shouldExposeDebugHook, seedFromLocation } from './core/debug.js';
import { Game, GS } from './game/game.js';
import { PS } from './game/player.js';
import { render } from './render/renderer.js';
import { Input } from './io/input.js';
import { Audio } from './io/audio.js';
import { storage } from './io/storage.js';
import { setupUi } from './io/ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = GAME_W;
canvas.height = GAME_H;
ctx.imageSmoothingEnabled = false;

const audio = new Audio();
const input = new Input();
const game = new Game({
  seed: seedFromLocation(window.location, 0x51ee1c0b),
  highScore: storage.getHighScore(),
  onEvent: handleEvent,
});

let clock = 0;
let stepSound = 0;

function handleEvent(name, data) {
  switch (name) {
    case 'jump': audio.jump(); break;
    case 'ladder': audio.ladder(); break;
    case 'release': audio.release(); break;
    case 'jumpScore': audio.jumpScore(data.count); break;
    case 'hammerGet': audio.hammerGet(); break;
    case 'hammerWarn': audio.hammerWarn(); break;
    case 'smash': audio.smash(); break;
    case 'item': audio.item(); break;
    case 'pin': audio.pin(); break;
    case 'sparkBorn': audio.sparkBorn(); break;
    case 'death': audio.death(); break;
    case 'stageStart': audio.stageStart(); break;
    case 'stageClear': audio.stageClear(); break;
    case 'extraLife': audio.extraLife(); break;
    case 'gameOver':
      audio.gameOver();
      storage.setHighScore(game.score.high);
      break;
    case 'pause': case 'resume': audio.blip(); break;
    default: break;
  }
}

const btnStart = document.getElementById('btn-start');

input.onFirstInput(() => {
  audio.unlock();
  if (btnStart) btnStart.classList.add('hidden');
});

input.attach(window, {
  left: document.getElementById('btn-left'),
  right: document.getElementById('btn-right'),
  up: document.getElementById('btn-up'),
  down: document.getElementById('btn-down'),
  jump: document.getElementById('btn-jump'),
  action: document.getElementById('btn-action'),
  pause: document.getElementById('btn-pause'),
  start: btnStart,
});

setupUi({ audio });

function update(dt) {
  clock += dt;
  input.beginFrame();
  game.update(dt, input);
  input.endFrame();

  // 걷기 / 사다리 소리는 게임 규칙이 아니라 연출이라 여기서 만든다
  const p = game.player;
  if (game.state === GS.PLAY && !game.paused) {
    stepSound += dt;
    const moving = p.state === PS.GROUND && Math.abs(p.vx) > 0.5;
    const climbing = p.state === PS.LADDER;
    if ((moving && stepSound > 0.21) || (climbing && stepSound > 0.17)) {
      stepSound = 0;
      if (moving) audio.step();
      else audio.climbTick();
    }
    if (game.rollers.length && audio.ctx) audio.roll(audio.ctx.currentTime);
  }
}

function draw() {
  render(ctx, game, clock);
}

const loop = new Loop(update, draw);
loop.onAutoPause = () => {
  if (input.releaseAll) input.releaseAll();
  if ((game.state === GS.PLAY || game.state === GS.INTRO) && !game.paused) {
    game.paused = true;
  }
};
loop.start();

// 최고 점수는 갱신될 때마다 저장한다 (게임 오버 전에 탭을 닫아도 남게)
let savedHigh = game.score.high;
setInterval(() => {
  if (game.score.high > savedHigh) {
    savedHigh = game.score.high;
    storage.setHighScore(savedHigh);
  }
}, 2000);
window.addEventListener('pagehide', () => storage.setHighScore(game.score.high));

if (shouldExposeDebugHook(window.location)) {
  window.__steel = { game, input, audio, loop, GS, PS, canvas };
}
