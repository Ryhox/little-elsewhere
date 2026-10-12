import { BALANCE } from '@/config/balance';
import { BUILDING_BY_ID, SAPLING_TOKEN_BONUS, SYNERGIES } from '@/config/buildings';
import type { Game } from '@/game/context';
import { milestonesReached, nextMilestone, totalBuildings } from '@/game/economy';
import { fmt, fmtMult, fmtPct, fmtRate } from '@/game/format';
import type { BuildingDef } from '@/game/types';

/** Plain-language summaries of what things do, shared by the shop and the in-world tooltips. */

const plural = (name: string, count: number) => (count === 1 ? name : `${name}s`);

/** How many things a synergy currently counts. */
function synergyCount(game: Game, from: (typeof SYNERGIES)[number]['from']): number {
  const { s } = game;
  if (from === 'all') return totalBuildings(s);
  if (from === 'regions') return Object.keys(s.regions).length;
  if (from === 'rings') return s.rings;
  return from.reduce((sum, id) => sum + (s.b[id] ?? 0), 0);
}

/** One short line for the shop: what a single copy of this building does. */
export function buildingYield(game: Game, def: BuildingDef): string {
  const owned = game.s.b[def.id] ?? 0;
  if (def.id === 'sapling') return `+${fmtPct(SAPLING_TOKEN_BONUS * game.mods.saplingTokens)} Evergreen Tokens each`;
  if (def.id === 'moonpool') return `+${fmtPct(game.mods.syn.moonAll ?? 0)} all income each`;
  if (!def.base) return def.blurb;
  // Show what one copy really yields now, bonuses included; before the first is bought, the base figure.
  const each = owned > 0 ? (game.rates.b[def.id] ?? 0) / owned : def.base;
  const idle = def.night && owned > 0 && each === 0;
  return idle ? 'Asleep until nightfall' : `+${fmtRate(each)} dew/s each${def.night ? ' (night)' : ''}`;
}

/** Lines describing a building in full: what it makes, what it does for others, and what is helping it. */
export function describeBuilding(game: Game, def: BuildingDef): string[] {
  const { s, rates, mods } = game;
  const owned = s.b[def.id] ?? 0;
  const lines: string[] = [def.blurb];
  if (def.base && owned > 0) {
    const total = rates.b[def.id] ?? 0;
    const share = rates.res.dew > 0 ? total / rates.res.dew : 0;
    lines.push(`Together they gather ${fmtRate(total)} dew/s, ${fmtPct(share)} of your income.`);
  }
  lines.push(`You own ${owned} of ${def.max}.`);

  // What this building does for others.
  for (const syn of SYNERGIES) {
    const strength = mods.syn[syn.id];
    if (!strength || syn.from === 'all' || syn.from === 'regions' || syn.from === 'rings' || !syn.from.includes(def.id) || syn.from.length > 3) continue;
    const target = typeof syn.to === 'string' ? `all ${syn.to}` : syn.to[0] === '*' ? 'everything' : syn.to.map((id) => plural(BUILDING_BY_ID[id].name, 2)).join(', ');
    lines.push(`Each one makes ${target} ${fmtPct(strength)} better.`);
  }
  // What is helping this building.
  for (const syn of SYNERGIES) {
    const strength = mods.syn[syn.id];
    if (!strength || typeof syn.to === 'string' || !syn.to.includes(def.id)) continue;
    const count = synergyCount(game, syn.from);
    if (count > 0) lines.push(`Boosted ${fmtMult(1 + count * strength)} (${fmtPct(strength)} ${syn.label}).`);
  }

  const reached = milestonesReached(owned);
  const next = nextMilestone(owned);
  if (reached > 0) lines.push(`Milestones reached: ${fmtMult(mods.mile ** reached)}.`);
  if (next && next <= def.max) lines.push(`Own ${next} for another ${fmtMult(mods.mile)}.`);
  return lines;
}

/** What tapping the spring gives right now. */
export function describeSpring(game: Game): string[] {
  const { rates, mods, s } = game;
  const lines = [`Each tap gives ${fmt(rates.click * (1 + s.flow * mods.flowMax), 1)} dew.`, 'Tap it, or hold to keep tapping.'];
  if (mods.flowMax > 0) lines.push(`Flow: ${fmtMult(1 + s.flow * mods.flowMax)} (builds as you tap).`);
  if (mods.crit > 0) lines.push(`${fmtPct(mods.crit)} chance of a Glimmer worth ${fmtMult(mods.critMult)}.`);
  const auto = mods.selfTap + mods.autoTap * (s.b.burrow ?? 0);
  if (auto > 0) lines.push(`Tapped automatically ${fmtRate(auto)} times a second.`);
  return lines;
}

/** The multipliers behind the income figure, for the curious. */
export function describeGlobal(game: Game): string[] {
  const { s, mods, rates } = game;
  const lines: string[] = [];
  const achievements = Object.keys(s.ach).length;
  if (achievements) lines.push(`Achievements: +${fmtPct(mods.ach * achievements)}`);
  if (rates.harmony > 0) lines.push(`Harmony: +${fmtPct(rates.harmony)}`);
  if (mods.flags.vigor) lines.push(`Evergreen Vigor: ${fmtMult(1 + mods.flags.vigor * BALANCE.prestige.vigorPerToken * s.tokensEarned)}`);
  if (mods.flags.heartwood && s.rings) lines.push(`Elder rings: ${fmtMult(1 + BALANCE.prestige.ringBonus * s.rings)}`);
  lines.push(`All income: ${fmtMult(rates.global)}`);
  return lines;
}
