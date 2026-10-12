import { BALANCE } from '@/config/balance';
import { autoTap } from './actions';
import { tickAutomation } from './automation';
import type { Game } from './context';
import { computeRates, gain, nightFactor, refresh } from './economy';
import { startEvent, tickEvents, tickPlot } from './events';
import { checkProgress } from './progress';
import { RES } from './types';

export interface StepOptions {
  /** Scale all income (used for offline catch-up). */
  income?: number;
  /** Skip random events and visitors (nobody is there to see them). */
  quiet?: boolean;
}

/** Seconds between progress checks (achievements, journal, the guide). Short enough to feel immediate. */
const CHECK_INTERVAL = 0.4;

function tickTimers(game: Game, dt: number): void {
  const { s } = game;
  for (const id in s.buffs) {
    s.buffs[id] -= dt;
    if (s.buffs[id] > 0) continue;
    delete s.buffs[id];
    // A rainbow follows every magical rain.
    if (id === 'storm') game.bus.emit('spawn', { id: 'rainbow' });
  }
  for (const id in s.cooldowns) {
    s.cooldowns[id] -= dt;
    if (s.cooldowns[id] <= 0) delete s.cooldowns[id];
  }
  s.flow = Math.max(0, s.flow - BALANCE.click.flowDecay * dt);
}

function tickDay(game: Game, dt: number): void {
  const { s, mods: m } = game;
  const before = nightFactor(s, m) > 0.5;
  s.day = (s.day + dt) % BALANCE.day.length;
  const after = nightFactor(s, m) > 0.5;
  if (before === after) return;
  if (!after && m.flags.dawnChorus) s.buffs.dawn = BALANCE.day.dawnChorus;
  game.bus.emit('daybreak', { night: after });
}

/** Advance the simulation by `dt` seconds. */
export function step(game: Game, dt: number, options: StepOptions = {}): void {
  if (game.dirty) refresh(game);
  const { s } = game;
  // Time actually played (absences are not counted).
  if (!options.quiet) s.stats.playSeconds = (s.stats.playSeconds ?? 0) + dt;
  dt *= game.mods.speed;
  s.time += dt;
  tickDay(game, dt);
  tickTimers(game, dt);

  game.rates = computeRates(game);
  const income = options.income ?? 1;
  for (const r of RES) gain(s, r, game.rates.res[r] * dt * income);

  const tapsPerSecond = game.mods.selfTap + game.mods.autoTap * s.b.burrow;
  if (tapsPerSecond > 0) {
    game.tapCarry += tapsPerSecond * dt * income;
    const whole = Math.floor(game.tapCarry);
    if (whole > 0) {
      game.tapCarry -= whole;
      autoTap(game, whole);
    }
  }

  tickPlot(game, dt);
  if (!options.quiet) tickEvents(game, dt);
  tickAutomation(game, dt);

  game.checkClock -= dt;
  if (game.checkClock <= 0) {
    game.checkClock = CHECK_INTERVAL;
    checkProgress(game);
  }
}

/**
 * Catch up on time spent away. Runs a coarse simulation so day/night, helpers
 * and growing Wonders all behave as they would have. Returns what was gained.
 */
export function fastForward(game: Game, seconds: number): Record<string, number> {
  if (game.dirty) refresh(game);
  const capped = Math.min(seconds, game.mods.offlineCap * 3600);
  const before = { ...game.s.res };
  const steps = Math.max(1, Math.min(600, Math.ceil(capped / 4)));
  const dt = capped / steps;
  for (let i = 0; i < steps; i++) step(game, dt, { income: game.mods.offline, quiet: true });
  const gained: Record<string, number> = {};
  for (const r of RES) gained[r] = Math.max(0, game.s.res[r] - before[r]);
  return gained;
}

/** Force a specific event now (dev tools and tests). */
export const triggerEvent = startEvent;
