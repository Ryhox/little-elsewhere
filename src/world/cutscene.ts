import { BALANCE } from '@/config/balance';
import type { Ambience } from './ambience';
import type { Stage } from './stage';

/** Where each act of the season's turning begins, as a fraction of the whole. */
const ACTS = { winter: 0.35, whiteout: 0.6, turn: 0.72, thaw: 0.84 } as const;

/**
 * Turning the Season: summer fades to autumn, leaves fall and creatures go home,
 * snow covers the world, and a new spring thaws out of the white.
 */
export class Cutscene {
  active = false;
  /** 0..1 — how far the screen has faded to white. */
  white = 0;
  private t = 0;
  private duration = 1;
  private turned = false;
  private onTurn: () => void = () => {};
  private onDone: () => void = () => {};

  constructor(
    private readonly s: Stage,
    private readonly ambience: Ambience,
  ) {}

  /** How long the transition should run for a player who has turned this many seasons already. */
  static lengthFor(seasons: number): number {
    const p = BALANCE.prestige;
    return Math.max(p.cutsceneMinSeconds, p.cutsceneSeconds * 0.72 ** seasons);
  }

  /** Begin. `onTurn` is called at the whitest moment and must reset the world; `onDone` when spring has returned. */
  start(seconds: number, onTurn: () => void, onDone: () => void): void {
    this.active = true;
    this.t = 0;
    this.duration = seconds;
    this.turned = false;
    this.onTurn = onTurn;
    this.onDone = onDone;
    this.s.actors.recall = true;
  }

  /** Jump ahead: straight to the turn if it has not happened, otherwise to the end. */
  skip(): void {
    if (!this.active) return;
    this.t = this.duration * (this.turned ? 1 : ACTS.turn);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.t += dt;
    const p = Math.min(1, this.t / this.duration);
    const season = this.s.season;
    const weather = this.ambience.weather;

    if (p >= ACTS.turn && !this.turned) {
      this.turned = true;
      this.white = 1;
      this.onTurn();
    }
    if (!this.turned) {
      if (p < ACTS.winter) {
        Object.assign(season, { a: 0, b: 1, blend: p / ACTS.winter, winter: 0 });
        weather.leaves = season.blend;
        weather.snow = 0;
      } else {
        const k = Math.min(1, (p - ACTS.winter) / (ACTS.whiteout - ACTS.winter));
        Object.assign(season, { a: 1, b: 2, blend: k, winter: k });
        weather.leaves = 1 - k;
        weather.snow = k;
      }
      this.white = p < ACTS.whiteout ? 0 : (p - ACTS.whiteout) / (ACTS.turn - ACTS.whiteout);
    } else {
      const k = Math.min(1, (p - ACTS.turn) / (1 - ACTS.turn));
      Object.assign(season, { a: 2, b: 0, blend: k, winter: 1 - k });
      weather.leaves = 0;
      weather.snow = Math.max(0, 1 - k * 2);
      this.white = Math.max(0, 1 - (p - ACTS.turn) / (ACTS.thaw - ACTS.turn));
    }
    if (p >= 1) {
      this.active = false;
      this.white = 0;
      Object.assign(season, { a: 0, b: 0, blend: 0, winter: 0 });
      weather.leaves = weather.snow = 0;
      this.s.actors.recall = false;
      this.onDone();
    }
  }
}
