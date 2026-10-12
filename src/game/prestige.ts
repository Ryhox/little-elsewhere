import { BALANCE } from '@/config/balance';
import { BUILDING_BY_ID, BUILDING_IDS, SAPLING_TOKEN_BONUS } from '@/config/buildings';
import { FOUNDER_REGIONS, HEIRLOOM_PER_LEVEL } from '@/config/evergreen';
import { REGIONS, START_REGION } from '@/config/regions';
import { BLESSING_CHOICES, BLESSINGS } from '@/config/seasons';
import { UPGRADES } from '@/config/upgrades';
import type { Game } from './context';
import { computeMods, refresh } from './economy';
import { RES } from './types';

/** Turning the Season: what a reset is worth, and how a fresh season begins. */

export interface TokenBreakdown {
  /** From dew earned this season (diminishing returns). */
  fromDew: number;
  /** From lands discovered and Wonders grown. */
  fromMilestones: number;
  /** Multiplier from Legacy upgrades, saplings and journal discoveries. */
  multiplier: number;
  total: number;
}

export function tokenBreakdown(game: Game): TokenBreakdown {
  const { s, mods: m } = game;
  const p = BALANCE.prestige;
  const fromDew = p.coef * Math.pow(Math.max(0, Math.log10(Math.max(1, s.earned.dew) / p.floor)), p.power);
  let fromMilestones = 0;
  for (const region of REGIONS) if (s.regions[region.id]) fromMilestones += region.tokens;
  fromMilestones += p.perWonder * (s.stats.seasonWonders ?? 0);
  const multiplier = m.token * (1 + SAPLING_TOKEN_BONUS * m.saplingTokens * (s.b.sapling ?? 0)) * (1 + BALANCE.discoveryTokenBonus * Object.keys(s.journal).length);
  return { fromDew, fromMilestones, multiplier, total: Math.floor((fromDew + fromMilestones) * multiplier) };
}

export const tokensOnTurn = (game: Game) => tokenBreakdown(game).total;

/** The first season needs the Sundial; after that the ritual is known by heart. */
export const canTurnSeason = (game: Game) => (!!game.mods.flags.sundial || game.s.seasons > 0) && tokensOnTurn(game) >= 1;

/** Dew this season needed for one more token than you would get now. */
export function dewForNextToken(game: Game): number {
  const b = tokenBreakdown(game);
  const p = BALANCE.prestige;
  const needed = (b.total + 1) / b.multiplier - b.fromMilestones;
  return needed <= 0 ? 0 : p.floor * 10 ** Math.pow(needed / p.coef, 1 / p.power);
}

/** The next milestone worth tokens, as a short description, or null when none remain this season. */
export function nextMilestone(game: Game): { text: string; tokens: number } | null {
  const { s } = game;
  const region = REGIONS.find((r) => !s.regions[r.id] && r.tokens > 0 && (!r.perm || s.perm[r.perm]));
  return region ? { text: `Discover ${region.name}`, tokens: region.tokens } : null;
}

/** Put the world back to a fresh spring, then hand out everything the Evergreen tree grants at the start. */
export function beginSeason(game: Game): void {
  const { s } = game;
  for (const r of RES) {
    s.res[r] = 0;
    s.earned[r] = 0;
  }
  for (const id of BUILDING_IDS) s.b[id] = 0;
  s.up = {};
  s.regions = { [START_REGION]: 1 };
  s.time = 0;
  s.day = BALANCE.day.length * 0.08;
  s.flow = 0;
  s.buffs = {};
  s.cooldowns = {};
  s.timers = {};
  s.wonders = [...s.keepsakes];
  s.seeds = 0;
  s.plot = null;
  s.merchant = null;
  s.blessing = '';
  s.blessingChoices = [];
  s.stats.seasonTreasures = 0;
  s.stats.seasonWonders = 0;

  // Permanent upgrades decide what the new season starts with.
  const m = computeMods(s);
  const p = BALANCE.prestige;
  if (m.startDew > 0) s.res.dew = p.seedMoneyBase * p.seedMoneyGrowth ** m.startDew;
  const kit = p.earlyKit[Math.min(p.earlyKit.length, m.flags.earlyKit ?? 0) - 1];
  if (kit) {
    s.b.fern += kit[0];
    s.b.burrow += kit[1];
  }
  const founders = Math.min(FOUNDER_REGIONS.length, m.flags.founders ?? 0);
  for (let i = 0; i < founders; i++) for (const id of FOUNDER_REGIONS[i]) s.regions[id] = 1;
  // Memory of Gardens only restores buildings in lands that are already discovered again.
  if (m.memory > 0) {
    for (const id of BUILDING_IDS) {
      if (s.regions[BUILDING_BY_ID[id].region]) s.b[id] += Math.floor((s.lastCounts[id] ?? 0) * Math.min(0.9, m.memory));
    }
  }
  const heirlooms = (m.flags.heirloom ?? 0) * HEIRLOOM_PER_LEVEL;
  UPGRADES.filter((u) => u.cat === 'spring').slice(0, heirlooms).forEach((u) => (s.up[u.id] = 1));
  if (m.momentum > 0) s.buffs.momentum = m.momentum;
  if (m.flags.blessings) {
    const pool = [...BLESSINGS];
    while (s.blessingChoices.length < BLESSING_CHOICES && pool.length) s.blessingChoices.push(pool.splice(Math.floor(game.rand() * pool.length), 1)[0].id);
  }
  game.tapCarry = 0;
  game.helperClock = [];
  refresh(game);
}

/** End the season: bank the tokens, remember what is kept, and begin again. Returns the tokens earned. */
export function turnSeason(game: Game): number {
  if (!canTurnSeason(game)) return 0;
  const { s, mods: m } = game;
  const tokens = tokensOnTurn(game);
  s.tokens += tokens;
  s.tokensEarned += tokens;
  s.seasons += 1;
  s.history.push({ tokens, seconds: Math.round(s.time) });
  if (s.history.length > 12) s.history.shift();
  if (s.time < 120) s.stats.speedSeason = 1;
  if (m.flags.heartwood) s.rings += 1;
  s.lastCounts = { ...s.b };
  s.keepsakes = s.wonders.slice(0, Math.floor(m.keepsakes));
  beginSeason(game);
  game.bus.emit('season', { tokens, seasons: s.seasons });
  return tokens;
}
