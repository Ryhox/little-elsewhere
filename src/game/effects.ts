import type { Effect, Mods } from './types';

/** Shorthand constructors so content files read like sentences. */
export const mul = (path: string, v: number): Effect => ({ path, op: 'mul', v });
export const add = (path: string, v: number): Effect => ({ path, op: 'add', v });
export const flag = (name: string, v = 1): Effect => ({ path: `flags.${name}`, op: 'set', v });
/** Multiply the output of several buildings at once: `...boost(FLOWERS, 1.5)`. */
export const boost = (buildings: readonly string[], v: number): Effect[] => buildings.map((id) => mul(`b.${id}`, v));

/**
 * Apply declarative effects to the modifier sheet.
 * `level` lets one definition serve levelled upgrades: mul → v^level, add → v×level.
 */
export function applyEffects(mods: Mods, effects: readonly Effect[], level = 1): void {
  if (level <= 0) return;
  for (const effect of effects) {
    const keys = effect.path.split('.');
    let node = mods as unknown as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]] as Record<string, unknown>;
    const leaf = keys[keys.length - 1];
    const current = (node[leaf] as number | undefined) ?? (effect.op === 'mul' ? 1 : 0);
    if (effect.op === 'mul') node[leaf] = current * effect.v ** level;
    else if (effect.op === 'add') node[leaf] = current + effect.v * level;
    else node[leaf] = effect.v * level;
  }
}
