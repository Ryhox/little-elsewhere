import { ACHIEVEMENTS } from '@/config/achievements';
import { GUIDE, GUIDE_STAT, type GuideStep } from '@/config/guide';
import { JOURNAL, JOURNAL_BY_ID } from '@/config/journal';
import type { Game } from './context';
import { meets, totalBuildings } from './economy';
import type { GameState } from './types';

/** Derived values achievements can test, alongside the raw `stats` counters. */
const DERIVED: Record<string, (s: GameState) => number> = {
  'life.dew': (s) => s.life.dew,
  buildings: (s) => totalBuildings(s),
  seasons: (s) => s.seasons,
  tokensEarned: (s) => s.tokensEarned,
  journal: (s) => Object.keys(s.journal).length,
  rings: (s) => s.rings,
  stars: (s) => Object.keys(s.stars).length,
  perms: (s) => Object.values(s.perm).reduce((a, b) => a + b, 0),
};

export function statValue(s: GameState, key: string): number {
  return DERIVED[key] ? DERIVED[key](s) : (s.stats[key] ?? 0);
}

/** Mark a journal entry as found. Returns true the first time. */
export function discover(game: Game, id: string): boolean {
  const { s } = game;
  if (s.journal[id] || !JOURNAL_BY_ID[id]) return false;
  s.journal[id] = 1;
  if (JOURNAL_BY_ID[id].kind === 'secret') s.stats.secrets = (s.stats.secrets ?? 0) + 1;
  game.dirty = true;
  game.bus.emit('journal', { id });
  return true;
}

/** The tutorial step the player is on, or null once the guide is finished or switched off. */
export function guideStep(s: GameState): GuideStep | null {
  return s.stats[GUIDE_STAT.hidden] ? null : (GUIDE[s.stats[GUIDE_STAT.step] ?? 0] ?? null);
}

/** Move the guide on past every step that is already done. */
function advanceGuide(game: Game): void {
  const { s } = game;
  for (let step = guideStep(s); step; step = guideStep(s)) {
    const done = (!step.req || meets(s, step.req)) && (!step.stat || statValue(s, step.stat[0]) >= step.stat[1]);
    if (!done) return;
    s.stats[GUIDE_STAT.step] = (s.stats[GUIDE_STAT.step] ?? 0) + 1;
    game.bus.emit('guide', { id: step.id, finished: !guideStep(s) });
  }
}

/** Award anything newly earned. Cheap enough to run about once a second. */
export function checkProgress(game: Game): void {
  const { s } = game;
  advanceGuide(game);
  if (game.rates.balance >= 0.9 && totalBuildings(s) >= 100) s.stats.balanced = 1;
  s.stats.harmonyPeak = Math.max(s.stats.harmonyPeak ?? 0, game.rates.harmony);
  for (const entry of JOURNAL) {
    if (entry.req && !s.journal[entry.id] && meets(s, entry.req)) discover(game, entry.id);
  }
  for (const def of ACHIEVEMENTS) {
    if (s.ach[def.id]) continue;
    const earned = def.stat ? statValue(s, def.stat[0]) >= def.stat[1] : def.req ? meets(s, def.req) : false;
    if (!earned) continue;
    s.ach[def.id] = 1;
    game.dirty = true;
    game.bus.emit('achievement', { id: def.id });
  }
}
