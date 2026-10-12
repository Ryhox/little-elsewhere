import { BALANCE } from '@/config/balance';
import { BUILDING_BY_ID, BUILDINGS, SYNERGIES } from '@/config/buildings';
import { PERM_BY_ID } from '@/config/evergreen';
import { JOURNAL } from '@/config/journal';
import { BLESSING_BY_ID, CONSTELLATION_BY_ID, WONDER_BY_ID } from '@/config/seasons';
import { UPGRADE_BY_ID } from '@/config/upgrades';
import { clamp } from '@/engine/rng';
import { baseMods, emptyRates, type Game } from './context';
import { applyEffects } from './effects';
import { CATS, type Cat, type Cost, type GameState, type Mods, type Rates, type Requirement, type Res } from './types';

/* ───────────────────────────── Requirements ───────────────────────────── */

export function totalBuildings(s: GameState): number {
  let total = 0;
  for (const id in s.b) total += s.b[id];
  return total;
}

export function meetsOne(s: GameState, req: Requirement): boolean {
  if (req.building && (s.b[req.building[0]] ?? 0) < req.building[1]) return false;
  if (req.region && !s.regions[req.region]) return false;
  if (req.upgrade && !s.up[req.upgrade]) return false;
  if (req.perm && !s.perm[req.perm]) return false;
  if (req.seasons !== undefined && s.seasons < req.seasons) return false;
  if (req.earned && s.earned[req.earned[0]] < req.earned[1]) return false;
  if (req.buildings !== undefined && totalBuildings(s) < req.buildings) return false;
  return true;
}

export const meets = (s: GameState, reqs: readonly Requirement[]) => reqs.every((r) => meetsOne(s, r));

/** Human-readable form of a requirement, for locked items. */
export function describeReq(req: Requirement): string {
  if (req.building) return `Own ${req.building[1]} ${BUILDING_BY_ID[req.building[0]].name}${req.building[1] === 1 ? '' : 's'}`;
  if (req.region) return `Discover a new land`;
  if (req.upgrade) return `Requires ${UPGRADE_BY_ID[req.upgrade]?.name ?? 'another upgrade'}`;
  if (req.perm) return `Requires ${PERM_BY_ID[req.perm]?.name ?? 'an Evergreen upgrade'}`;
  if (req.seasons !== undefined) return `Turn ${req.seasons} season${req.seasons === 1 ? '' : 's'}`;
  if (req.buildings !== undefined) return `Own ${req.buildings} buildings`;
  if (req.earned) return `Earn more ${req.earned[0]} this season`;
  return '';
}

/* ───────────────────────────── Modifiers ───────────────────────────── */

/** Rebuild the modifier sheet from everything the player owns. Pure: depends only on the save. */
export function computeMods(s: GameState): Mods {
  const m = baseMods();
  for (const syn of SYNERGIES) m.syn[syn.id] = syn.base;
  for (const id in s.up) {
    const def = UPGRADE_BY_ID[id];
    if (def) applyEffects(m, def.effects);
  }
  for (const id in s.perm) {
    const def = PERM_BY_ID[id];
    if (def) applyEffects(m, def.effects, s.perm[id]);
  }
  for (const id of s.wonders) if (WONDER_BY_ID[id]) applyEffects(m, WONDER_BY_ID[id].effects);
  if (s.blessing && BLESSING_BY_ID[s.blessing]) applyEffects(m, BLESSING_BY_ID[s.blessing].effects);
  for (const id in s.stars) if (CONSTELLATION_BY_ID[id]) applyEffects(m, CONSTELLATION_BY_ID[id].effects);
  for (const entry of JOURNAL) {
    if (entry.kind === 'combo' && entry.effects && entry.req && meets(s, entry.req)) applyEffects(m, entry.effects);
  }
  m.cost = Math.max(0.02, m.cost);
  m.growth = Math.min(0.07, m.growth);
  m.nightLen = Math.min(0.42, m.nightLen);
  m.crit = Math.min(0.75, m.crit);
  return m;
}

/* ───────────────────────────── Time of day ───────────────────────────── */

/** 0 by day, 1 in full night, with smooth dusk and dawn. */
export function nightFactor(s: GameState, m: Mods): number {
  if ((s.buffs.moon ?? 0) > 0) return 1;
  const d = BALANCE.day;
  const t = (s.day % d.length) / d.length;
  const start = d.nightStart - m.nightLen;
  if (t < start || t > d.nightEnd) return 0;
  if (t < start + d.fade) return (t - start) / d.fade;
  if (t > d.nightEnd - d.fade) return (d.nightEnd - t) / d.fade;
  return 1;
}

/* ───────────────────────────── Production ───────────────────────────── */

export function milestonesReached(count: number): number {
  let k = 0;
  for (const threshold of BALANCE.milestones) if (count >= threshold) k++;
  return k;
}

export function nextMilestone(count: number): number | null {
  for (const threshold of BALANCE.milestones) if (count < threshold) return threshold;
  return null;
}

const active = (s: GameState, buff: string) => (s.buffs[buff] ?? 0) > 0;

/** How evenly the four building categories are represented, 0..1. */
export function ecosystemBalance(s: GameState): number {
  const totals: Record<Cat, number> = { flora: 0, fauna: 0, craft: 0, mystic: 0 };
  for (const def of BUILDINGS) totals[def.cat] += s.b[def.id];
  const values = CATS.map((c) => totals[c]);
  const max = Math.max(...values);
  return max > 0 ? Math.min(...values) / max : 0;
}

/**
 * What Harmony adds to all income right now: nothing until the Chime is raised,
 * and the most when plants, creatures, crafts and magic are owned in even numbers.
 */
export function harmonyBonus(s: GameState, m: Mods): number {
  if (m.harmony <= 0) return 0;
  const { floor } = BALANCE.harmony;
  return m.harmony * (floor + (1 - floor) * Math.sqrt(ecosystemBalance(s)));
}

/** The multiplier applied to all production, from everything that is not building-specific. */
export function globalMultiplier(s: GameState, m: Mods, night: number, synergyAll: number): number {
  const buffs = BALANCE.buffs;
  let g = m.all * synergyAll;
  g *= 1 + m.ach * Object.keys(s.ach).length;
  g *= 1 + harmonyBonus(s, m);
  g *= 1 + (m.flags.vigor ?? 0) * BALANCE.prestige.vigorPerToken * s.tokensEarned;
  if (m.flags.heartwood) g *= 1 + BALANCE.prestige.ringBonus * s.rings;
  if (m.flags.treasureMaps) g *= 1 + 0.02 * (s.stats.seasonTreasures ?? 0);
  g *= 1 + m.nightAll * night;
  if (active(s, 'golden')) g *= buffs.golden;
  if (active(s, 'boon')) g *= buffs.boon;
  if (active(s, 'dawn')) g *= buffs.dawn;
  if (active(s, 'momentum')) g *= BALANCE.prestige.momentumMult;
  return g;
}

/** Per-building multipliers from upgrades, milestones, categories and synergies. Also returns the world-wide synergy factor. */
export function buildingMultipliers(s: GameState, m: Mods, watered: Record<string, number> = {}): { mult: Record<string, number>; all: number } {
  const mult: Record<string, number> = {};
  for (const def of BUILDINGS) mult[def.id] = m.b[def.id] * m.cat[def.cat] * m.mile ** milestonesReached(s.b[def.id]) * (1 + BALANCE.play.cloud.boost * (watered[def.id] ?? 0));
  const total = totalBuildings(s);
  const regions = Object.keys(s.regions).length;
  let all = 1;
  for (const syn of SYNERGIES) {
    const strength = m.syn[syn.id];
    if (!strength) continue;
    let count = 0;
    if (syn.from === 'all') count = total;
    else if (syn.from === 'regions') count = regions;
    else if (syn.from === 'rings') count = s.rings;
    else for (const id of syn.from) count += s.b[id];
    if (!count) continue;
    const factor = 1 + count * strength;
    if (typeof syn.to === 'string') {
      for (const def of BUILDINGS) if (def.cat === syn.to) mult[def.id] *= factor;
    } else if (syn.to[0] === '*') all *= factor;
    else for (const id of syn.to) mult[id] *= factor;
  }
  if (active(s, 'rain') || active(s, 'storm')) {
    const boost = (active(s, 'rain') ? BALANCE.buffs.rain : 1) * (active(s, 'storm') ? BALANCE.buffs.storm : 1);
    for (const def of BUILDINGS) if (def.cat === 'flora') mult[def.id] *= boost;
  }
  if (active(s, 'call')) for (const def of BUILDINGS) if (def.cat === 'fauna') mult[def.id] *= BALANCE.buffs.call;
  if (active(s, 'cheer')) for (const def of BUILDINGS) if (def.cat === 'fauna') mult[def.id] *= BALANCE.play.pet.boost;
  return { mult, all };
}

export function computeRates(game: Game): Rates {
  const { s, mods: m } = game;
  const rates = emptyRates();
  const night = nightFactor(s, m);
  const { mult, all } = buildingMultipliers(s, m, game.watered);
  const global = globalMultiplier(s, m, night, all);
  // Night-gatherers work fully after dark, and keep whatever share of that an upgrade grants by day.
  const nightShare = Math.max(night, m.starDay);
  const meteor = active(s, 'meteor') ? BALANCE.buffs.meteor * m.meteorMult : 1;
  let dew = 0;

  for (const def of BUILDINGS) {
    const count = s.b[def.id];
    if (!count || !def.base) {
      rates.b[def.id] = 0;
      continue;
    }
    let out = count * def.base * mult[def.id] * global;
    if (def.night) out *= Math.max(nightShare, m.dayShare[def.id] ?? 0) * meteor;
    if (m.nightBoost[def.id]) out *= 1 + m.nightBoost[def.id] * night;
    rates.b[def.id] = out;
    dew += out;
  }
  rates.res.dew = Math.min(BALANCE.maxNumber, dew);
  rates.night = night;
  rates.balance = ecosystemBalance(s);
  rates.harmony = harmonyBonus(s, m);
  rates.global = global;
  rates.click = BALANCE.click.base * m.click * global * (1 + m.nightClick * night) + m.clickPct * rates.res.dew;
  return rates;
}

/* ───────────────────────────── Costs ───────────────────────────── */

const costGrowth = (id: string, m: Mods) => Math.max(1.04, (BUILDING_BY_ID[id].growth ?? BALANCE.costGrowth) - m.growth);

/** Price of the next `count` copies of a building. */
export function buildingCost(game: Game, id: string, count = 1): Cost {
  const { s, mods: m } = game;
  const def = BUILDING_BY_ID[id];
  const r = costGrowth(id, m);
  const scale = m.cost * m.costCat[def.cat] * r ** s.b[id] * ((r ** count - 1) / (r - 1));
  const out: Cost = {};
  for (const res in def.cost) out[res as Res] = Math.ceil(def.cost[res as Res]! * scale);
  return out;
}

/** How many more copies of a building may still be built. */
export const roomFor = (s: GameState, id: string) => Math.max(0, BUILDING_BY_ID[id].max - (s.b[id] ?? 0));

/** How many copies could be bought with `share` (0..1) of the current bank, without exceeding the building's maximum. */
export function maxAffordable(game: Game, id: string, share = 1): number {
  const { s, mods: m } = game;
  const def = BUILDING_BY_ID[id];
  const r = costGrowth(id, m);
  const scale = m.cost * m.costCat[def.cat] * r ** s.b[id];
  let best = Infinity;
  for (const res in def.cost) {
    const first = def.cost[res as Res]! * scale;
    const bank = s.res[res as Res] * share;
    best = Math.min(best, Math.floor(Math.log(1 + (bank * (r - 1)) / first) / Math.log(r)));
  }
  return clamp(Number.isFinite(best) ? best : 0, 0, roomFor(s, id));
}

export function scaledCost(cost: Cost, factor: number): Cost {
  if (factor === 1) return cost;
  const out: Cost = {};
  for (const res in cost) out[res as Res] = Math.ceil(cost[res as Res]! * factor);
  return out;
}

export function canAfford(s: GameState, cost: Cost): boolean {
  for (const res in cost) if (s.res[res as Res] < cost[res as Res]!) return false;
  return true;
}

export function pay(s: GameState, cost: Cost): void {
  for (const res in cost) s.res[res as Res] -= cost[res as Res]!;
}

/** Largest fraction of the bank this cost would use up (∞ when unaffordable in some resource you have none of). */
export function costShare(s: GameState, cost: Cost): number {
  let share = 0;
  for (const res in cost) share = Math.max(share, cost[res as Res]! / Math.max(1e-9, s.res[res as Res]));
  return share;
}

/** Add a resource, tracking season and lifetime totals. */
export function gain(s: GameState, res: Res, amount: number): void {
  if (!(amount > 0)) return;
  s.res[res] = Math.min(BALANCE.maxNumber, s.res[res] + amount);
  s.earned[res] = Math.min(BALANCE.maxNumber, s.earned[res] + amount);
  s.life[res] = Math.min(BALANCE.maxNumber, s.life[res] + amount);
}

export function gainAll(s: GameState, gains: Cost): void {
  for (const res in gains) gain(s, res as Res, gains[res as Res]!);
}

/** Recompute everything derived from the save. */
export function refresh(game: Game): void {
  game.mods = computeMods(game.s);
  game.rates = computeRates(game);
  game.dirty = false;
}
