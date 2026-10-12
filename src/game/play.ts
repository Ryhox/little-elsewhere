import { BALANCE } from '@/config/balance';
import type { Game } from './context';
import { gain } from './economy';
import { foundSeed } from './events';

/**
 * The hands-on ways to earn besides tapping the spring: sweeping up dewdrops,
 * shaking plants and petting creatures. (The rain cloud is a multiplier, applied in economy.ts.)
 * The world decides when these happen; this file decides what they are worth.
 */

const bump = (game: Game, stat: string) => {
  game.s.stats[stat] = (game.s.stats[stat] ?? 0) + 1;
};

/** Seconds of current income, never less than a floor that grows a little each season. */
const worth = (game: Game, seconds: number, floor: number) => Math.max(floor * (1 + game.s.seasons), game.rates.res.dew * seconds);

/** Gather one swept dewdrop. `chain` is how many were gathered in a row just before it. */
export function sweep(game: Game, chain: number): number {
  const p = BALANCE.play.sweep;
  const amount = worth(game, p.seconds, p.minDew) * (1 + p.chainStep * Math.min(chain, p.chainMax));
  gain(game.s, 'dew', amount);
  bump(game, 'sweeps');
  game.bus.emit('sweep', { amount, chain });
  return amount;
}

/** Shake a tree or bush. Now and then a mysterious seed falls out with the dew. */
export function shake(game: Game): { amount: number; seed: boolean } {
  const p = BALANCE.play.shake;
  const amount = worth(game, p.seconds, p.minDew);
  gain(game.s, 'dew', amount);
  bump(game, 'shakes');
  const seed = !!game.s.regions.garden && game.rand() < p.surprise * (1 + game.mods.luck);
  if (seed) foundSeed(game);
  game.bus.emit('shake', { amount, seed });
  return { amount, seed };
}

/** Pet a creature: every creature home works harder for a little while. Pets stack up to a limit. */
export function pet(game: Game): void {
  const p = BALANCE.play.pet;
  game.s.buffs.cheer = Math.min(p.maxSeconds, (game.s.buffs.cheer ?? 0) + p.seconds);
  bump(game, 'cuddles');
  game.bus.emit('pet', {});
}

/** The rain cloud has watered something new (counted for the guide and achievements). */
export function noteWatering(game: Game): void {
  bump(game, 'watered');
}
