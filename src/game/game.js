/**
 * 게임 전체 상태와 규칙.
 *
 * DOM·캔버스·오디오를 직접 만지지 않는다. 소리와 화면은 emit()으로 알리기만 하고
 * 바깥(main.js)에서 처리하므로, 이 파일은 Node에서 그대로 불러 단위 테스트할 수 있다.
 */

import {
  GAME_W, GAME_H, HUD_H, SCORE, RESPAWN_INVULN, DEATH_ANIM,
  STAGE_INTRO, STAGE_CLEAR_ANIM, PLAYER_H,
} from '../core/constants.js';
import { createRng } from '../core/rng.js';
import { Player, PS } from './player.js';
import { Roller, FallingTool } from './obstacles.js';
import { Spark } from './enemies.js';
import { Hammer } from './hammer.js';
import { Score } from './score.js';
import { Effects } from '../render/effects.js';
import { buildStage, stageDefFor, loopFor, STAGE_COUNT } from './stages.js';
import { surfaceYAt, boxOf, boxesOverlap, platformSpan } from './geometry.js';

export const GS = {
  TITLE: 'title',
  INTRO: 'intro',
  PLAY: 'play',
  DYING: 'dying',
  CLEAR: 'clear',
  GAMEOVER: 'gameover',
};

const GOAL_W = 16;
const GOAL_H = 20;
const ITEM_W = 12;
const ITEM_H = 11;
const HAMMER_W = 12;
const HAMMER_H = 13;
const WELDER_W = 14;
const WELDER_H = 12;

/** 점프 점수 인정 범위 — 이만큼 확실히 위로 넘어야 한다 */
const JUMP_OVER_DX = 10;
const JUMP_OVER_DY_MIN = 6;
const JUMP_OVER_DY_MAX = 26;

export class Game {
  constructor({ seed = 0x51ee1c0b, highScore = 0, onEvent = null } = {}) {
    this.baseSeed = seed >>> 0;
    this.rng = createRng(this.baseSeed);
    this.onEvent = onEvent;
    this.player = new Player();
    this.hammer = new Hammer();
    this.score = new Score(highScore);
    this.effects = new Effects();
    this.paused = false;
    this.stageIndex = 0;
    this.stage = null;
    this.rollers = [];
    this.sparks = [];
    this.tools = [];
    this.state = GS.TITLE;
    this.timer = 0;
    this.inputLock = 0;
    this.flashText = null;
    this.toTitle();
  }

  emit(name, data) {
    if (this.onEvent) this.onEvent(name, data);
  }

  /* ── 화면 전환 ─────────────────────────────────────── */

  toTitle() {
    this.state = GS.TITLE;
    this.stageIndex = 0;
    this.paused = false;
    this._clearEntities();
    // 타이틀 뒤에 1단계 배치를 조용히 깔아둔다 (배경 그림용)
    this.stage = buildStage(0);
    this._placeStageObjects();
    this.player.reset(this._spawnPos());
    this.hammer.reset();
    this.timer = 0;
    this.inputLock = 0.25;
  }

  startGame() {
    this.score.reset();
    this.score.newHigh = false;
    this.stageIndex = 0;
    this.paused = false;
    this.beginStage(0);
    this.emit('gameStart');
  }

  beginStage(index) {
    this.stageIndex = index;
    // 스테이지마다 시드를 고정 → 같은 시드면 항상 같은 전개 (테스트 재현성)
    this.rng.reseed((this.baseSeed + index * 7919) >>> 0);
    this._clearEntities();
    this.stage = buildStage(index);
    this._placeStageObjects();
    this.hammer.reset();
    this.effects.clear();
    this.player.reset(this._spawnPos());
    this.player.invuln = RESPAWN_INVULN;
    this.score.startStage(this.stage.diff.bonusStart);
    this.state = GS.INTRO;
    this.timer = STAGE_INTRO;
    this.spawnTimer = this.stage.spawnInterval * 0.65;
    this.sparkTimer = 7.5;
    this.robotAnim = 0;
    this.robotThrow = 0;
    this.pinsLeft = this.stage.pinIds ? this.stage.pinIds.length : 0;
    this.emit('stageStart', { index, def: this.stage.def });
  }

  _clearEntities() {
    this.rollers = [];
    this.sparks = [];
    this.tools = [];
    this.effects.clear();
    this.flashText = null;
  }

  /** 발판 위에 놓이는 것들의 실제 좌표를 확정한다 */
  _placeStageObjects() {
    const s = this.stage;
    s.hammerPickups = (s.hammers || []).map((h, i) => ({
      id: `h${i}`,
      x: h.x,
      y: surfaceYAt(h.platform, h.x) - (h.lift || 0),
      taken: false,
    }));
    s.itemPickups = (s.items || []).map((it, i) => ({
      id: `i${i}`,
      x: it.x,
      y: surfaceYAt(it.platform, it.x),
      kind: it.kind,
      taken: false,
    }));
    s.welderSpots = (s.welders || []).map((w, i) => ({
      id: `w${i}`,
      x: w.x,
      y: surfaceYAt(w.platform, w.x),
    }));
    s.robotPos = s.robot
      ? { x: s.robot.x, y: surfaceYAt(s.robot.platform, s.robot.x), facing: s.robot.facing }
      : null;
    s.goalPos = s.goal
      ? { x: s.goal.x, y: surfaceYAt(s.goal.platform, s.goal.x), kind: s.goal.kind }
      : null;
  }

  _spawnPos() {
    const s = this.stage.spawn;
    return { x: s.x, y: surfaceYAt(s.platform, s.x), platform: s.platform };
  }

  /* ── 갱신 ──────────────────────────────────────────── */

  update(dt, input) {
    if (this.inputLock > 0) this.inputLock -= dt;

    if (input.pausePressed && (this.state === GS.PLAY || this.state === GS.INTRO)) {
      this.paused = !this.paused;
      this.emit(this.paused ? 'pause' : 'resume');
    }
    if (this.paused) return;

    switch (this.state) {
      case GS.TITLE:
        if (input.startPressed && this.inputLock <= 0) this.startGame();
        break;
      case GS.INTRO:
        this.timer -= dt;
        this._updatePlatforms(dt);
        if (this.timer <= 0) {
          this.state = GS.PLAY;
          this.emit('go');
        }
        break;
      case GS.PLAY:
        this._play(dt, input);
        break;
      case GS.DYING:
        this.timer -= dt;
        this.player.update(dt, NO_INPUT, this._world());
        this.effects.update(dt);
        if (this.timer <= 0) this._afterDeath();
        break;
      case GS.CLEAR:
        this.timer -= dt;
        this._updatePlatforms(dt);
        this.effects.update(dt);
        if (this.timer <= 0) this.beginStage(this.stageIndex + 1);
        break;
      case GS.GAMEOVER:
        this.timer -= dt;
        this.effects.update(dt);
        if (input.startPressed && this.inputLock <= 0) this.startGame();
        break;
      default: break;
    }
  }

  _world() {
    return {
      platforms: this.stage.platforms,
      ladders: this.stage.ladders,
      hammerActive: this.hammer.active,
      player: this.player,
      rng: this.rng,
      onJump: () => this.emit('jump'),
      onLadder: () => this.emit('ladder'),
      ladderDropChanceFor: (l) => this._ladderDropChance(l),
    };
  }

  /**
   * 드럼통이 그 사다리로 내려갈 확률.
   * 원작의 "레버로 유도" 대신, **플레이어가 그 사다리 아래쪽 가까이 있으면
   * 확률이 올라가는** 독자 규칙을 쓴다. 결과적인 압박감은 비슷하되 원리는 다르다.
   */
  _ladderDropChance(l) {
    const base = this.stage.ladderDropChance || 0;
    if (base <= 0) return 0;
    const p = this.player;
    const nearX = Math.abs(p.x - l.x) < 26;
    const below = p.y > l.top + 4 && p.y < l.bottom + 40;
    return nearX && below ? Math.min(base + 0.22, 0.85) : base;
  }

  _play(dt, input) {
    const world = this._world();

    // 순서 중요: 움직이는 발판 → 플레이어 → 장애물 → 충돌
    this._updatePlatforms(dt);

    const wasAir = this.player.state === PS.AIR;
    this.player.update(dt, input, world);
    if (!wasAir && this.player.state === PS.AIR) this.jumpOvers = new Set();
    if (wasAir && this.player.state !== PS.AIR) this._awardJumpOvers();

    this.hammer.update(dt);
    if (input.actionPressed && this.hammer.forceSwing()) this.emit('swing');
    if (this.hammer.justExpired) this.emit('hammerEnd');
    if (this.hammer.warning) this._hammerWarnTick(dt);

    this._spawnLogic(dt);

    for (const r of this.rollers) r.update(dt, world);
    for (const s of this.sparks) s.update(dt, world);
    for (const t of this.tools) t.update(dt);
    this.rollers = this.rollers.filter((r) => r.alive);
    this.sparks = this.sparks.filter((s) => s.alive);
    this.tools = this.tools.filter((t) => t.alive);

    this._welderCheck();
    this._hammerSmash();
    this._trackJumpOvers();
    this._pickups();
    this._pinCheck();
    this._hazardHits();
    this._goalCheck();

    this.effects.update(dt);
    this.robotAnim += dt;
    if (this.robotThrow > 0) this.robotThrow -= dt;

    // 제한시간
    if (this.score.tickBonus(dt) && this.player.alive) {
      this._killPlayer('time');
    }

    if (!this.player.alive && this.state === GS.PLAY) {
      this.state = GS.DYING;
      this.timer = DEATH_ANIM;
    }
  }

  _hammerWarnTick(dt) {
    this._warnAcc = (this._warnAcc || 0) + dt;
    if (this._warnAcc >= 0.42) {
      this._warnAcc = 0;
      this.emit('hammerWarn');
    }
  }

  _updatePlatforms(dt) {
    for (const p of this.stage.platforms) {
      const m = p.motion;
      if (!m) continue;
      if (m.type === 'wrap') {
        p.oy += m.vy * dt;
        if (m.vy < 0 && p.oy < m.yTop) { this._detachFrom(p); p.oy = m.yBottom; }
        else if (m.vy > 0 && p.oy > m.yBottom) { this._detachFrom(p); p.oy = m.yTop; }
      } else if (m.type === 'osc') {
        p.oy += m.dir * m.speed * dt;
        if (p.oy <= m.yTop) { p.oy = m.yTop; m.dir = 1; }
        else if (p.oy >= m.yBottom) { p.oy = m.yBottom; m.dir = -1; }
      }
    }
  }

  /** 승강 발판이 순환할 때 그 위에 있던 것들을 떨어뜨린다 */
  _detachFrom(platform) {
    if (this.player.platform === platform && this.player.state === PS.GROUND) {
      this.player.state = PS.AIR;
      this.player.vy = 0;
      this.player.airVx = 0;
      this.player.apexY = this.player.y;
      this.player.platform = null;
    }
    for (const r of this.rollers) {
      if (r.platform === platform) { r.state = 'fall'; r.platform = null; r.vy = 0; }
    }
    for (const s of this.sparks) {
      if (s.platform === platform) s.alive = false;
    }
  }

  /* ── 생성 ──────────────────────────────────────────── */

  _spawnLogic(dt) {
    const s = this.stage;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = s.spawnInterval * this.rng.range(0.82, 1.2);
      this._spawnObstacle();
    }

    // 불꽃이 하나도 없으면 일정 시간 뒤 확실히 하나 만든다
    if (s.sparkStart && this.sparks.length < s.maxSparks) {
      this.sparkTimer -= dt;
      if (this.sparkTimer <= 0) {
        this.sparkTimer = 11 / (1 + this.stage.diff.loop * 0.4);
        this._spawnSpark(s.sparkStart.x, s.sparkStart.platform);
      }
    }
  }

  _spawnObstacle() {
    const s = this.stage;
    const mul = s.diff.speedMul;
    if (s.kind === 'girders' && s.dropper) {
      const kind = this.rng.chance(0.22 + s.diff.loop * 0.06) ? 'reel' : 'drum';
      const y = surfaceYAt(s.dropper.platform, s.dropper.x);
      this.rollers.push(new Roller({
        x: s.dropper.x, y, platform: null, kind, speedMul: mul,
      }));
      this.robotThrow = 0.45;
      this.emit('release');
    } else if (s.kind === 'conveyors' && s.conveyorFeeds) {
      const feed = this.rng.pick(s.conveyorFeeds);
      const [l, r] = platformSpan(feed.platform);
      const x = feed.from === 'left' ? l + 4 : r - 4;
      this.rollers.push(new Roller({
        x, y: surfaceYAt(feed.platform, x), platform: feed.platform,
        kind: 'crate', speedMul: mul,
      }));
      this.robotThrow = 0.45;
      this.emit('release');
    } else if (s.kind === 'elevators' && s.toolDrops) {
      const x = this.rng.pick(s.toolDrops);
      this.tools.push(new FallingTool({
        x, y: HUD_H + 4, speed: (95 + this.rng.range(0, 40)) * mul,
      }));
      this.emit('release');
    }
  }

  _spawnSpark(x, platform) {
    const s = this.stage;
    if (this.sparks.length >= s.maxSparks) return;
    const kind = s.diff.loop >= 1 && this.rng.chance(0.4) ? 'drone' : 'spark';
    this.sparks.push(new Spark({
      x, y: surfaceYAt(platform, x), platform, kind,
      speedMul: s.diff.speedMul, rng: this.rng,
    }));
    this.emit('sparkBorn');
  }

  /** 용접기 위로 장애물이 지나가면 불꽃이 붙는다 */
  _welderCheck() {
    const s = this.stage;
    if (!s.welderSpots || !s.welderSpots.length) return;
    for (const w of s.welderSpots) {
      const wbox = boxOf(w.x, w.y, WELDER_W, WELDER_H);
      for (const r of this.rollers) {
        if (r.ignited) continue;
        if (!boxesOverlap(r.box, wbox)) continue;
        r.ignited = true;
        if (this.sparks.length < s.maxSparks && this.rng.chance(0.5)) {
          this._spawnSpark(w.x, this._platformOf(w.x, w.y));
        }
      }
    }
  }

  _platformOf(x, y) {
    for (const p of this.stage.platforms) {
      const sy = surfaceYAt(p, x);
      if (sy != null && Math.abs(sy - y) < 1.5) return p;
    }
    return this.stage.platforms[0];
  }

  /* ── 충돌 / 점수 ───────────────────────────────────── */

  _trackJumpOvers() {
    if (this.player.state !== PS.AIR || !this.jumpOvers) return;
    const p = this.player;
    for (const r of this.rollers) {
      if (r.scored || !r.alive) continue;
      const dy = r.y - p.y;
      if (Math.abs(r.x - p.x) > JUMP_OVER_DX) continue;
      if (dy < JUMP_OVER_DY_MIN || dy > JUMP_OVER_DY_MAX) continue;
      r.scored = true;
      this.jumpOvers.add(r.id);
    }
  }

  _awardJumpOvers() {
    if (!this.jumpOvers || this.jumpOvers.size === 0) { this.jumpOvers = null; return; }
    const n = this.jumpOvers.size;
    const pts = this.score.jumpBonus(n);
    if (this.score.add(pts)) this._extraLife();
    this.effects.popup(this.player.x, this.player.y - PLAYER_H - 3, pts, '#ffd400');
    this.emit('jumpScore', { count: n, points: pts });
    this.jumpOvers = null;
  }

  _hammerSmash() {
    const hb = this.hammer.hitBox(this.player);
    if (!hb) return;
    for (const r of this.rollers) {
      if (!r.alive || !boxesOverlap(hb, r.box)) continue;
      r.alive = false;
      if (this.score.add(SCORE.smashDrum)) this._extraLife();
      this.effects.popup(r.x, r.y - 12, SCORE.smashDrum, '#ff7a1a');
      this.effects.burst(r.x, r.y - 5, '#f2a33c', 8, this.rng);
      this.emit('smash', { kind: r.kind });
    }
    for (const s of this.sparks) {
      if (!s.alive || !boxesOverlap(hb, s.box)) continue;
      s.alive = false;
      if (this.score.add(SCORE.smashSpark)) this._extraLife();
      this.effects.popup(s.x, s.y - 14, SCORE.smashSpark, '#ffd400');
      this.effects.burst(s.x, s.y - 6, '#fff0a8', 9, this.rng);
      this.emit('smash', { kind: 'spark' });
    }
    for (const t of this.tools) {
      if (!t.alive || !boxesOverlap(hb, t.box)) continue;
      t.alive = false;
      if (this.score.add(SCORE.smashDrum)) this._extraLife();
      this.effects.burst(t.x, t.y - 5, '#93a6c0', 6, this.rng);
      this.emit('smash', { kind: 'tool' });
    }
  }

  _pickups() {
    const pb = this.player.box;
    for (const h of this.stage.hammerPickups) {
      if (h.taken) continue;
      if (!boxesOverlap(pb, boxOf(h.x, h.y + HAMMER_H / 2, HAMMER_W, HAMMER_H))) continue;
      h.taken = true;
      this.hammer.pickup();
      this.emit('hammerGet');
    }
    for (const it of this.stage.itemPickups) {
      if (it.taken) continue;
      if (!boxesOverlap(pb, boxOf(it.x, it.y, ITEM_W, ITEM_H))) continue;
      it.taken = true;
      const pts = SCORE.item[it.kind] || 400;
      if (this.score.add(pts)) this._extraLife();
      this.effects.popup(it.x, it.y - 14, pts, '#46d9ff');
      this.emit('item', { kind: it.kind, points: pts });
    }
  }

  /** 안전핀: 밟은 뒤 **발판에서 벗어나면** 그 조각이 사라진다 */
  _pinCheck() {
    if (this.stage.kind !== 'pins') return;
    const p = this.player;
    if (p.state === PS.GROUND && p.platform && p.platform.kind === 'pin' && !p.platform.removed) {
      p.platform.stepped = true;
    }
    for (const plat of this.stage.platforms) {
      if (plat.kind !== 'pin' || plat.removed || !plat.stepped) continue;
      if (p.platform === plat) continue;
      plat.removed = true;
      this.pinsLeft -= 1;
      if (this.score.add(SCORE.pin)) this._extraLife();
      const [l, r] = platformSpan(plat);
      const cx = (l + r) / 2;
      this.effects.popup(cx, plat.points[0][1] - 12, SCORE.pin, '#ff7a1a');
      this.effects.burst(cx, plat.points[0][1], '#c3d2e4', 6, this.rng);
      this.emit('pin', { left: this.pinsLeft });
      if (this.pinsLeft <= 0) this._clearStage();
    }
  }

  _hazardHits() {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    const pb = p.box;
    for (const r of this.rollers) {
      if (r.alive && boxesOverlap(pb, r.box)) return this._killPlayer('hit');
    }
    for (const s of this.sparks) {
      if (s.alive && boxesOverlap(pb, s.box)) return this._killPlayer('hit');
    }
    for (const t of this.tools) {
      if (t.alive && boxesOverlap(pb, t.box)) return this._killPlayer('hit');
    }
    return undefined;
  }

  /** 피격 중복 처리 방지 — 이미 죽어 있으면 아무 일도 일어나지 않는다 */
  _killPlayer(cause) {
    if (!this.player.kill(cause)) return;
    this.hammer.reset();
    this.effects.burst(this.player.x, this.player.y - 8, '#ff4222', 10, this.rng);
    this.emit('death', { cause });
  }

  _goalCheck() {
    const g = this.stage.goalPos;
    if (!g || this.state !== GS.PLAY) return;
    if (!boxesOverlap(this.player.box, boxOf(g.x, g.y, GOAL_W, GOAL_H))) return;
    this._clearStage();
  }

  _clearStage() {
    if (this.state !== GS.PLAY) return;
    this.state = GS.CLEAR;
    this.timer = STAGE_CLEAR_ANIM;
    this.hammer.reset();
    const { gained, extraLife } = this.score.clearStage();
    if (extraLife) this._extraLife();
    this.effects.popup(GAME_W / 2, GAME_H / 2 - 10, gained, '#46d9ff');
    this.flashText = 'STAGE CLEAR';
    this.rollers = [];
    this.tools = [];
    this.sparks = [];
    this.emit('stageClear', { index: this.stageIndex, gained });
  }

  _extraLife() {
    this.effects.popup(this.player.x, this.player.y - 24, '1UP', '#46d9ff');
    this.emit('extraLife');
  }

  _afterDeath() {
    this._clearEntities();
    this.hammer.reset();
    if (this.score.loseLife()) {
      this.state = GS.GAMEOVER;
      this.timer = 0;
      this.inputLock = 1.1;
      this.emit('gameOver', { score: this.score.value, high: this.score.high });
    } else {
      this.beginStage(this.stageIndex);
    }
  }

  /* ── 조회용 ────────────────────────────────────────── */

  get stageNumber() {
    return this.stageIndex + 1;
  }

  get loopNumber() {
    return loopFor(this.stageIndex) + 1;
  }

  get stageLabel() {
    return stageDefFor(this.stageIndex).label;
  }

  get screenNumber() {
    return (this.stageIndex % STAGE_COUNT) + 1;
  }
}

const NO_INPUT = {
  left: false, right: false, up: false, down: false,
  jumpPressed: false, startPressed: false, pausePressed: false,
};

export { NO_INPUT };
export const BOUNDS = { GAME_W, GAME_H, HUD_H };
