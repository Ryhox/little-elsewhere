import { BALANCE } from '@/config/balance';
import { EVENT_BY_ID, EVENTS, MERCHANT, REWARDS } from '@/config/events';
import { JACKPOT_SHARE } from '@/config/evergreen';
import { WONDERS } from '@/config/seasons';
import { lerp } from '@/engine/rng';
import type { Game } from './context';
import { canAfford, gain, meets, pay } from './economy';
import { fmt } from './format';
import { tokensOnTurn } from './prestige';
import { discover } from './progress';
import type { MerchantOffer } from './types';

/** Random happenings: scheduling them, and paying out when the player (or a magpie) collects one. */

const bump = (game: Game, stat: string, by = 1) => {
  game.s.stats[stat] = (game.s.stats[stat] ?? 0) + by;
};

const between = (game: Game, [lo, hi]: readonly [number, number]) => lerp(lo, hi, game.rand());

/** Advance every event timer; fire the ones that come due. */
export function tickEvents(game: Game, dt: number): void {
  const { s, mods: m } = game;
  for (const def of EVENTS) {
    if (!meets(s, def.req)) continue;
    if (s.timers[def.id] === undefined) s.timers[def.id] = between(game, def.every) * 0.6;
    s.timers[def.id] -= dt * m.eventRate * (m.rate[def.id] ?? 1);
    if (s.timers[def.id] > 0) continue;
    if (def.night && game.rates.night < 0.6) {
      s.timers[def.id] = 15;
      continue;
    }
    s.timers[def.id] = between(game, def.every);
    startEvent(game, def.id);
  }
  if (s.merchant) {
    s.merchant.left -= dt;
    if (s.merchant.left <= 0) {
      s.merchant = null;
      game.bus.emit('despawn', { id: 'merchant' });
    }
  }
}

export function startEvent(game: Game, id: string): void {
  const { s, mods: m } = game;
  const def = EVENT_BY_ID[id];
  if (id === 'storm') {
    s.buffs.storm = def.lasts;
    bump(game, 'storms');
  } else if (id === 'meteor') {
    s.buffs.meteor = def.lasts * (m.flags.starfall ? 2 : 1);
  } else if (id === 'merchant') {
    if (s.merchant) return;
    s.merchant = { offers: makeOffers(game), left: def.lasts };
  }
  discover(game, def.journal);
  game.bus.emit('spawn', { id });
}

/** Seconds of current income, with a floor so early rewards are never worthless. */
const worth = (game: Game, seconds: number, floor = 0) => Math.max(floor, game.rates.res.dew * seconds);

/**
 * Pay out a reward. Treasure-like rewards may also hold a mysterious seed or,
 * with Evergreen Jackpot, a share of the season's token harvest.
 */
function award(game: Game, source: string, dew: number, note: string, withExtras = false): void {
  const { s, mods: m } = game;
  gain(s, 'dew', dew);
  let text = dew > 0 ? `${note} +${fmt(dew)} dew` : note;
  let tokens = 0;
  if (withExtras) {
    const first = REWARDS.firstSeedGuaranteed && source === 'treasure' && !s.stats.seedsFound && s.regions.garden;
    if (first || game.rand() < REWARDS.seedChance * m.seedRate * (1 + m.luck * 0.5)) {
      foundSeed(game);
      text += ' — and a mysterious seed!';
    }
    if (m.shard > 0 && game.rand() < m.shard * (1 + m.luck * 0.5)) {
      tokens = Math.max(1, Math.floor(tokensOnTurn(game) * JACKPOT_SHARE));
      s.tokens += tokens;
      s.tokensEarned += tokens;
      text += ` — and ${tokens} Evergreen Token${tokens === 1 ? '' : 's'}!`;
    }
  }
  game.bus.emit('reward', { source, text, gains: dew > 0 ? { dew } : {}, tokens });
}

/**
 * Collect a world event. `share` scales the payout (the magpie brings back a little less).
 * Returns false when there was nothing to collect.
 */
export function collect(game: Game, id: string, share = 1): boolean {
  const { s, mods: m } = game;
  const lucky = 1 + m.luck * 0.5;
  switch (id) {
    case 'treasure': {
      const seconds = between(game, REWARDS.treasureSeconds) * m.treasure * lucky * share;
      bump(game, 'treasures');
      bump(game, 'seasonTreasures');
      award(game, id, worth(game, seconds, REWARDS.treasureMinDew * (1 + s.seasons)), 'Treasure!', true);
      return true;
    }
    case 'golden': {
      const g = REWARDS.golden;
      const roll = game.rand() * (g.hourWeight + g.lumpWeight + g.frenzyWeight);
      bump(game, 'goldens');
      if (roll < g.hourWeight) {
        s.buffs.golden = g.hourSeconds * share;
        award(game, id, 0, `Golden Hour! All income ×${BALANCE.buffs.golden}.`, true);
      } else if (roll < g.hourWeight + g.lumpWeight) {
        award(game, id, worth(game, g.lumpSeconds * lucky * share, 100), 'Golden gift!', true);
      } else {
        s.buffs.frenzy = g.frenzySeconds * share;
        award(game, id, 0, `Tap Frenzy! Taps ×${BALANCE.buffs.frenzy}.`, true);
      }
      return true;
    }
    case 'star':
      bump(game, 'meteors');
      award(game, id, worth(game, REWARDS.starSeconds * lucky, REWARDS.starMin), 'Stardew!');
      return true;
    case 'visitor':
      bump(game, 'pets');
      award(game, id, worth(game, REWARDS.visitorSeconds * lucky, 50), 'The Gloamcat purrs.', true);
      return true;
    case 'rainbow':
      discover(game, 's_rainbow');
      // With Rain Cycle, the end of a rainbow also leaves a short Golden Hour behind.
      if (m.flags.rainCycle) s.buffs.golden = Math.max(s.buffs.golden ?? 0, REWARDS.rainbowGoldenSeconds);
      award(game, id, worth(game, REWARDS.rainbowSeconds * lucky, 100), "Rainbow's end!", true);
      return true;
    case 'whale':
      award(game, id, worth(game, REWARDS.whaleSeconds * lucky), 'The Cloud Whale sings.', true);
      return true;
    default:
      return false;
  }
}

/** Reward for stumbling on a secret. Only pays the first time. */
export function findSecret(game: Game, id: string): boolean {
  if (!discover(game, id)) return false;
  award(game, 'secret', worth(game, REWARDS.secretSeconds, 50), 'A secret!');
  return true;
}

/* ───────────────────────────── Seeds and Wonders ───────────────────────────── */

export const wonderSlots = (game: Game) => Math.floor(game.mods.wonderSlots);

export function foundSeed(game: Game): void {
  const { s } = game;
  s.seeds += 1;
  bump(game, 'seedsFound');
  discover(game, 'e_seed');
  plantSeed(game);
}

/** Plant a banked seed if the plot is free and there is room for another Wonder. */
export function plantSeed(game: Game): boolean {
  const { s } = game;
  if (s.seeds <= 0 || s.plot || s.wonders.length >= wonderSlots(game)) return false;
  const candidates = WONDERS.filter((w) => !s.wonders.includes(w.id));
  if (!candidates.length) return false;
  // New-to-the-journal Wonders are favoured, so collections fill out steadily.
  const fresh = candidates.filter((w) => !s.journal[`w_${w.id}`]);
  const pool = fresh.length && game.rand() < 0.7 ? fresh : candidates;
  const pickId = pool[Math.floor(game.rand() * pool.length)].id;
  s.seeds -= 1;
  s.plot = { id: pickId, progress: 0 };
  game.bus.emit('seedPlanted', { id: pickId });
  return true;
}

export function tickPlot(game: Game, dt: number): void {
  const { s, mods: m } = game;
  if (!s.plot) {
    if (s.seeds > 0) plantSeed(game);
    return;
  }
  s.plot.progress += (dt * m.wonderGrow) / BALANCE.wonders.growSeconds;
  if (s.plot.progress < 1) return;
  const id = s.plot.id;
  s.plot = null;
  s.wonders.push(id);
  bump(game, 'wondersGrown');
  bump(game, 'seasonWonders');
  discover(game, `w_${id}`);
  game.dirty = true;
  game.bus.emit('wonder', { id });
}

/* ───────────────────────────── The merchant ───────────────────────────── */

/** The merchant lays out a few of his wares, each priced in dew by how much income it is worth. */
function makeOffers(game: Game): MerchantOffer[] {
  const { mods: m } = game;
  const discount = m.flags.merchantFriend ? MERCHANT.friendDiscount : 1;
  const pool = [...MERCHANT.wares];
  const count = MERCHANT.offers + (m.flags.merchantFriend ? 1 : 0);
  const offers: MerchantOffer[] = [];
  while (offers.length < count && pool.length) {
    const ware = pool.splice(Math.floor(game.rand() * pool.length), 1)[0];
    offers.push({ give: { dew: Math.ceil(worth(game, ware.priceSeconds, ware.minPrice) * discount) }, get: ware.get, label: ware.label });
  }
  return offers;
}

export function trade(game: Game, index: number): boolean {
  const { s } = game;
  const offer = s.merchant?.offers[index];
  if (!offer || !canAfford(s, offer.give)) return false;
  pay(s, offer.give);
  if (offer.get.buff) s.buffs[offer.get.buff[0]] = offer.get.buff[1];
  if (offer.get.seed) for (let i = 0; i < offer.get.seed; i++) foundSeed(game);
  if (offer.get.refresh) s.cooldowns = {};
  s.merchant!.offers.splice(index, 1);
  bump(game, 'trades');
  game.bus.emit('reward', { source: 'merchant', text: `Bought: ${offer.label}`, gains: {} });
  return true;
}
