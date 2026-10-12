import { ABILITY_BY_ID, BLOOM_BURST_SECONDS } from '@/config/abilities';
import { BALANCE } from '@/config/balance';
import { BUILDING_BY_ID } from '@/config/buildings';
import { PERM_BY_ID } from '@/config/evergreen';
import { REGION_BY_ID, REGIONS } from '@/config/regions';
import { CONSTELLATION_BY_ID } from '@/config/seasons';
import { UPGRADE_BY_ID, UPGRADES } from '@/config/upgrades';
import type { Game } from './context';
import { buildingCost, canAfford, gain, maxAffordable, meets, pay, roomFor, scaledCost } from './economy';
import type { Cost, HelperRule, RegionDef, UpgradeDef } from './types';

/** Everything the player (or a helper) can do. Each action validates itself and reports success. */

const bump = (game: Game, stat: string, by = 1) => {
  game.s.stats[stat] = (game.s.stats[stat] ?? 0) + by;
};

/* ───────────────────────────── The spring ───────────────────────────── */

/** Dew for one tap right now, before the luck of a Glimmer. */
export function tapValue(game: Game): number {
  const { s, mods: m, rates } = game;
  let value = rates.click * (1 + s.flow * m.flowMax);
  if ((s.buffs.surge ?? 0) > 0) value *= BALANCE.buffs.surge * m.surgeMult;
  if ((s.buffs.frenzy ?? 0) > 0) value *= BALANCE.buffs.frenzy;
  return value;
}

/** Tap the spring by hand. Returns what it gave so the world can celebrate it. */
export function tap(game: Game): { amount: number; crit: boolean } {
  const { s, mods: m } = game;
  const crit = game.rand() < m.crit;
  let amount = tapValue(game) * (crit ? m.critMult : 1);
  if (m.echo > 0 && game.rand() < m.echo) amount *= 1 + BALANCE.click.echoRepeats;
  gain(s, 'dew', amount);
  s.flow = Math.min(1, s.flow + BALANCE.click.flowGain);
  bump(game, 'clicks');
  if (crit) bump(game, 'crits');
  game.bus.emit('tap', { amount, crit, auto: false, count: 1 });
  return { amount, crit };
}

/**
 * Automatic taps (Sproutlings, the spring itself), batched. They are worth a plain tap each:
 * Flow, Glimmers, Spring Surge and Tap Frenzy reward tapping by hand, and stay that way.
 */
export function autoTap(game: Game, count: number): void {
  const amount = game.rates.click * count;
  gain(game.s, 'dew', amount);
  game.bus.emit('tap', { amount, crit: false, auto: true, count });
}

/* ───────────────────────────── Buying ───────────────────────────── */

export const regionOpen = (game: Game, id: string) => !!game.s.regions[id];

/**
 * How many copies a "buy N" press would purchase: never more than there is room for,
 * and for "max" (-1) as many as can be afforded. 0 when the building is already at its maximum.
 */
export function buyCount(game: Game, id: string, want: number): number {
  const room = roomFor(game.s, id);
  return want < 0 ? Math.min(room, Math.max(1, maxAffordable(game, id))) : Math.min(room, want);
}

export function buyBuilding(game: Game, id: string, want = 1, auto = false): number {
  const def = BUILDING_BY_ID[id];
  if (!def || !regionOpen(game, def.region)) return 0;
  const count = want < 0 ? maxAffordable(game, id) : Math.min(want, roomFor(game.s, id));
  if (count <= 0) return 0;
  const cost = buildingCost(game, id, count);
  if (!canAfford(game.s, cost)) return 0;
  pay(game.s, cost);
  game.s.b[id] += count;
  game.dirty = true;
  game.bus.emit('buy', { id, count, auto });
  return count;
}

export const upgradeCost = (game: Game, def: UpgradeDef): Cost => scaledCost(def.cost, game.mods.upgradeCost);
export const upgradeVisible = (game: Game, def: UpgradeDef) => !game.s.up[def.id] && meets(game.s, def.req);

/** Upgrades that can be bought right now or soon, cheapest first is left to the caller. */
export function availableUpgrades(game: Game): UpgradeDef[] {
  return UPGRADES.filter((def) => upgradeVisible(game, def));
}

export function buyUpgrade(game: Game, id: string, auto = false): boolean {
  const def = UPGRADE_BY_ID[id];
  if (!def || !upgradeVisible(game, def)) return false;
  const cost = upgradeCost(game, def);
  if (!canAfford(game.s, cost)) return false;
  pay(game.s, cost);
  game.s.up[id] = 1;
  game.dirty = true;
  game.bus.emit('upgrade', { id, auto });
  if (def.ending && !game.s.stats.ended) {
    game.s.stats.ended = 1;
    game.s.stats.endedAt = game.s.stats.playSeconds ?? 0;
    game.bus.emit('ending', {});
  }
  return true;
}

export const regionCost = (game: Game, def: RegionDef): Cost => scaledCost(def.cost, game.mods.regionCost);

/** Lands that could be discovered next (all prerequisites met). */
export function discoverableRegions(game: Game): RegionDef[] {
  const { s } = game;
  return REGIONS.filter((def) => !s.regions[def.id] && def.needs.every((n) => s.regions[n]) && (!def.perm || s.perm[def.perm]));
}

export function buyRegion(game: Game, id: string): boolean {
  const def = REGION_BY_ID[id];
  if (!def || !discoverableRegions(game).includes(def)) return false;
  const cost = regionCost(game, def);
  if (!canAfford(game.s, cost)) return false;
  pay(game.s, cost);
  unlockRegion(game, id, false);
  return true;
}

export function unlockRegion(game: Game, id: string, quiet: boolean): void {
  const { s } = game;
  if (s.regions[id]) return;
  s.regions[id] = 1;
  if (id === 'hamlet' && s.time < 300) s.stats.speedHamlet = 1;
  game.dirty = true;
  game.bus.emit('region', { id, quiet });
}

/* ───────────────────────────── Abilities ───────────────────────────── */

export const abilityUnlocked = (game: Game, id: string) => !!game.mods.flags[`ability_${id}`];
export const abilityReady = (game: Game, id: string) => abilityUnlocked(game, id) && (game.s.cooldowns[id] ?? 0) <= 0;

export function castAbility(game: Game, id: string): boolean {
  const def = ABILITY_BY_ID[id];
  if (!def || !abilityReady(game, id)) return false;
  const { s, mods: m, rates } = game;
  s.cooldowns[id] = def.cooldown * m.abilityCd;
  if (def.duration > 0) s.buffs[id] = def.duration * m.abilityDur;
  if (id === 'bloom') gain(s, 'dew', rates.res.dew * BLOOM_BURST_SECONDS);
  bump(game, 'casts');
  game.bus.emit('ability', { id });
  return true;
}

/* ───────────────────────────── Permanent things ───────────────────────────── */

export function permCost(game: Game, id: string): number {
  const def = PERM_BY_ID[id];
  return Math.ceil(def.cost * (def.scale ?? 1) ** (game.s.perm[id] ?? 0));
}

export function permAvailable(game: Game, id: string): boolean {
  const def = PERM_BY_ID[id];
  const { s } = game;
  return (s.perm[id] ?? 0) < def.max && def.needs.every((n) => s.perm[n]) && s.seasons >= (def.seasons ?? 0);
}

export function buyPerm(game: Game, id: string): boolean {
  const { s } = game;
  if (!PERM_BY_ID[id] || !permAvailable(game, id)) return false;
  const cost = permCost(game, id);
  if (s.tokens < cost) return false;
  s.tokens -= cost;
  s.perm[id] = (s.perm[id] ?? 0) + 1;
  game.dirty = true;
  game.bus.emit('perm', { id });
  return true;
}

export function buyConstellation(game: Game, id: string): boolean {
  const def = CONSTELLATION_BY_ID[id];
  const { s } = game;
  if (!def || s.stars[id] || !game.mods.flags.constellations || s.res.dew < def.cost) return false;
  s.res.dew -= def.cost;
  s.stars[id] = 1;
  game.dirty = true;
  return true;
}

export function chooseBlessing(game: Game, id: string): boolean {
  const { s } = game;
  if (!s.blessingChoices.includes(id)) return false;
  s.blessing = id;
  s.blessingChoices = [];
  game.dirty = true;
  return true;
}

/* ───────────────────────────── Helpers ───────────────────────────── */

export const defaultHelper = (): HelperRule => ({ on: true, target: 'any', budget: 0.5 });

/** Keep the helper list the same length as the number of Tinkers owned. */
export function syncHelpers(game: Game): void {
  const { s, mods: m } = game;
  while (s.helpers.length < m.helperSlots) s.helpers.push(defaultHelper());
  if (s.helpers.length > m.helperSlots) s.helpers.length = m.helperSlots;
}

export function setHelper(game: Game, index: number, patch: Partial<HelperRule>): void {
  const rule = game.s.helpers[index];
  if (rule) Object.assign(rule, patch);
}
