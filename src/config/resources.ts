import type { Res, ResourceDef } from '@/game/types';

/**
 * The game has exactly two currencies. Dew is earned and spent within a season;
 * Evergreen Tokens are earned by Turning the Season and kept forever.
 */
export const RESOURCES: Record<Res, ResourceDef> = {
  dew: { id: 'dew', name: 'Dew', icon: 'res_dew', color: '#47c9e3', blurb: 'The magic of Little Elsewhere, gathered by everything that lives here. It buys everything.' },
};

export const EVERGREEN = { name: 'Evergreen Tokens', one: 'Evergreen Token', icon: 'res_evergreen', color: '#8cd040', blurb: 'Earned by Turning the Season. Spent on the Evergreen tree, whose upgrades last forever.' } as const;
