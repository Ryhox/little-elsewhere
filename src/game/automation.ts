import { ABILITIES } from '@/config/abilities';
import { BALANCE } from '@/config/balance';
import { BUILDINGS } from '@/config/buildings';
import { abilityReady, availableUpgrades, buyBuilding, buyRegion, buyUpgrade, castAbility, discoverableRegions, regionCost, syncHelpers, upgradeCost } from './actions';
import type { Game } from './context';
import { buildingCost, costShare, maxAffordable } from './economy';
import { canTurnSeason, tokensOnTurn } from './prestige';
import type { HelperRule } from './types';

/** Tinkers (programmable helpers), self-casting abilities and the Season Clock. */

/** One helper takes one action according to its routine. */
function act(game: Game, rule: HelperRule): void {
  const { s, mods: m } = game;
  if (rule.target === 'upgrades') {
    if (!m.flags.autoUpgrades) return;
    let best: { id: string; share: number } | null = null;
    for (const def of availableUpgrades(game)) {
      const share = costShare(s, upgradeCost(game, def));
      if (share <= rule.budget && (!best || share < best.share)) best = { id: def.id, share };
    }
    if (best) buyUpgrade(game, best.id, true);
    return;
  }
  if (rule.target === 'regions') {
    if (!m.flags.autoRegions) return;
    for (const def of discoverableRegions(game)) {
      if (costShare(s, regionCost(game, def)) <= 1) {
        buyRegion(game, def.id);
        return;
      }
    }
    return;
  }
  // Buildings: pick whichever fits the routine and costs the smallest share of the bank, then buy as many as the budget allows.
  let pick: { id: string; share: number } | null = null;
  for (const def of BUILDINGS) {
    if (!s.regions[def.region] || (rule.target !== 'any' && def.cat !== rule.target)) continue;
    const share = costShare(s, buildingCost(game, def.id, 1));
    if (share <= rule.budget && (!pick || share < pick.share)) pick = { id: def.id, share };
  }
  if (pick) buyBuilding(game, pick.id, Math.max(1, maxAffordable(game, pick.id, rule.budget)), true);
}

export function tickAutomation(game: Game, dt: number): void {
  const { s, mods: m } = game;
  if (s.helpers.length !== m.helperSlots) syncHelpers(game);
  const interval = BALANCE.automation.helperInterval / m.helperSpeed;
  s.helpers.forEach((rule, i) => {
    if (!rule.on) return;
    game.helperClock[i] = (game.helperClock[i] ?? interval * (i + 1) * 0.37) - dt;
    if (game.helperClock[i] > 0) return;
    game.helperClock[i] = interval;
    act(game, rule);
  });

  if (m.flags.autoAbilities) {
    for (const def of ABILITIES) {
      // Calling the moon in the middle of the night would be a waste.
      if (def.id === 'moon' && game.rates.night > 0.1) continue;
      if (abilityReady(game, def.id)) castAbility(game, def.id);
    }
  }
}

/** True when the Season Clock wants the season turned now. The app decides how to present it. */
export function seasonClockDue(game: Game): boolean {
  const { s, mods: m } = game;
  return !!m.flags.autoSeason && s.autoSeason.on && canTurnSeason(game) && tokensOnTurn(game) >= s.autoSeason.minTokens;
}
