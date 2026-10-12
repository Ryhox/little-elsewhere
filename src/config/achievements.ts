import type { AchievementDef } from '@/game/types';

/**
 * Achievements. `stat` is [key, threshold] where key is either an entry of the save's
 * `stats` counters or one of the derived values in game/progress.ts (life.dew, seasons, buildings…).
 * `req` uses the same data-driven requirements as upgrades.
 */

const tiers = (prefix: string, key: string, icon: string, rows: readonly (readonly [number, string, string])[]): AchievementDef[] =>
  rows.map(([n, name, desc], i) => ({ id: `${prefix}${i + 1}`, name, desc, icon, stat: [key, n] }));

export const ACHIEVEMENTS: AchievementDef[] = [
  ...tiers('tap', 'clicks', 'res_dew', [
    [100, 'First Sips', 'Tap the spring 100 times.'],
    [1000, 'Steady Hands', 'Tap the spring 1,000 times.'],
    [10000, 'Springkeeper', 'Tap the spring 10,000 times.'],
    [100000, 'Rain of Fingers', 'Tap the spring 100,000 times.'],
  ]),
  ...tiers('dew', 'life.dew', 'res_dew', [
    [1e3, 'A Cupful', 'Gather 1,000 dew in all.'],
    [1e6, 'A Barrel', 'Gather a million dew in all.'],
    [1e9, 'A Lake', 'Gather a billion dew in all.'],
    [1e12, 'A Sea', 'Gather a trillion dew in all.'],
    [1e16, 'An Ocean', 'Gather ten quadrillion dew in all.'],
    [1e20, 'The Sky Itself', 'Gather a hundred quintillion dew in all.'],
  ]),
  ...tiers('build', 'buildings', 'cottage_0', [
    [10, 'Getting Cozy', 'Own 10 buildings.'],
    [50, 'Little Village', 'Own 50 buildings.'],
    [150, 'Bustling', 'Own 150 buildings.'],
    [350, 'Thriving', 'Own 350 buildings.'],
    [700, 'A World Entire', 'Own 700 buildings.'],
  ]),
  { id: 'r_garden', name: 'First Blooms', desc: 'Discover the Petal Garden.', icon: 'bed_0', req: [{ region: 'garden' }] },
  { id: 'r_grove', name: 'Under the Caps', desc: 'Discover the Mushroom Grove.', icon: 'shroomtree_0', req: [{ region: 'grove' }] },
  { id: 'r_pond', name: 'Still Waters', desc: 'Discover the Lilypad Pond.', icon: 'lilies_0', req: [{ region: 'pond' }] },
  { id: 'r_meadow', name: 'Sweet Air', desc: 'Discover the Honey Meadow.', icon: 'hive_0', req: [{ region: 'meadow' }] },
  { id: 'r_hamlet', name: 'Smoke from Chimneys', desc: 'Discover the Hearthside Hamlet.', icon: 'cottage_0', req: [{ region: 'hamlet' }] },
  { id: 'r_hill', name: 'Second Wind', desc: 'Discover Windmill Hill.', icon: 'windmill', req: [{ region: 'hill' }] },
  { id: 'r_woods', name: 'Into the Trees', desc: 'Discover the Whispering Woods.', icon: 'treehouse', req: [{ region: 'woods' }] },
  { id: 'r_rise', name: 'Closer to the Stars', desc: 'Discover Stargazer Rise.', icon: 'observatory', req: [{ region: 'rise' }] },
  { id: 'r_isles', name: 'Head in the Clouds', desc: 'Discover the Floating Isles.', icon: 'crystal_0', req: [{ region: 'isles' }] },
  { id: 'r_heartwood', name: 'Old Roots', desc: 'Discover the Elder Heartwood.', icon: 'elder_0', req: [{ region: 'heartwood' }] },
  { id: 'r_shoals', name: 'Evergreen', desc: 'Discover the Evergreen Shoals.', icon: 'sapling', req: [{ region: 'shoals' }] },
  ...tiers('season', 'seasons', 'ic_season', [
    [1, 'The Turning', 'Turn the season for the first time.'],
    [3, 'Three Springs', 'Turn the season 3 times.'],
    [5, 'Old Hand', 'Turn the season 5 times.'],
    [10, 'A Decade of Springs', 'Turn the season 10 times.'],
    [20, 'Perennial', 'Turn the season 20 times.'],
    [30, 'Thirty Winters', 'Turn the season 30 times.'],
    [50, 'Timeless', 'Turn the season 50 times.'],
  ]),
  ...tiers('token', 'tokensEarned', 'res_evergreen', [
    [10, 'Pocketful of Pine', 'Earn 10 Evergreen Tokens in all.'],
    [100, 'Evergreen Hoard', 'Earn 100 Evergreen Tokens in all.'],
    [1e4, 'Forest Bank', 'Earn 10,000 Evergreen Tokens in all.'],
    [1e6, 'Endless Wood', 'Earn a million Evergreen Tokens in all.'],
  ]),
  ...tiers('treasure', 'treasures', 'chest', [
    [1, 'Finders Keepers', 'Dig up a buried treasure.'],
    [25, 'Treasure Hunter', 'Dig up 25 treasures.'],
    [100, 'Magpie Heart', 'Dig up 100 treasures.'],
  ]),
  ...tiers('gold', 'goldens', 'golden_0', [
    [1, 'Gold Dust', 'Catch a golden butterfly.'],
    [10, 'Chasing Gold', 'Catch 10 golden butterflies.'],
    [50, 'Gilded Wings', 'Catch 50 golden butterflies.'],
  ]),
  { id: 'sweep1', name: 'Dew Collector', desc: 'Sweep up 500 dewdrops.', icon: 'item_dew', stat: ['sweeps', 500] },
  { id: 'shake1', name: 'Tree Shaker', desc: 'Shake 100 trees and bushes.', icon: 'oak_0', stat: ['shakes', 100] },
  { id: 'cuddle1', name: 'Best Friends', desc: 'Pet your creatures 50 times.', icon: 'emote_heart', stat: ['cuddles', 50] },
  { id: 'meteor1', name: 'Wish Collector', desc: 'Catch 10 falling stars.', icon: 'res_starlight', stat: ['meteors', 10] },
  { id: 'trade1', name: 'Fair Trade', desc: 'Trade with the travelling merchant.', icon: 'peddler_0', stat: ['trades', 1] },
  { id: 'trade2', name: 'Regular Customer', desc: 'Make 10 trades.', icon: 'cart', stat: ['trades', 10] },
  { id: 'pet1', name: 'Soft Paws', desc: 'Pet the Gloamcat.', icon: 'gloamcat_0', stat: ['pets', 1] },
  { id: 'wonder1', name: 'Green Thumb', desc: 'Grow a Wonder from a mysterious seed.', icon: 'ic_seed', stat: ['wondersGrown', 1] },
  { id: 'wonder2', name: 'Wonderworker', desc: 'Grow 5 Wonders.', icon: 'wonder_rainbow_cap', stat: ['wondersGrown', 5] },
  { id: 'storm1', name: 'Rain Lover', desc: 'Sit through 5 magical rainstorms.', icon: 'res_dew', stat: ['storms', 5] },
  { id: 'cast1', name: 'Ritualist', desc: 'Cast abilities 25 times.', icon: 'ic_bolt', stat: ['casts', 25] },
  { id: 'crit1', name: 'Glimmering', desc: 'Land 100 Glimmer taps.', icon: 'ic_star', stat: ['crits', 100] },
  { id: 'harmony1', name: 'In Tune', desc: 'Raise the Harmony Chime.', icon: 'res_harmony', req: [{ upgrade: 'w_chime' }] },
  { id: 'harmony2', name: 'Symphony', desc: 'Have Harmony add 300% to your income.', icon: 'res_harmony', stat: ['harmonyPeak', 3] },
  { id: 'balance1', name: 'Perfect Balance', desc: 'Reach 90% ecosystem balance with at least 100 buildings.', icon: 'res_harmony', stat: ['balanced', 1] },
  { id: 'journal1', name: 'Naturalist', desc: 'Fill 10 journal entries.', icon: 'ic_journal', stat: ['journal', 10] },
  { id: 'journal2', name: 'Loremaster', desc: 'Fill 35 journal entries.', icon: 'ic_journal', stat: ['journal', 35] },
  { id: 'secret1', name: 'Curious', desc: 'Uncover 3 secrets.', icon: 'ic_eye', stat: ['secrets', 3] },
  { id: 'secret2', name: 'Nosy', desc: 'Uncover every secret.', icon: 'ic_eye', stat: ['secrets', 8] },
  { id: 'zen1', name: 'Just Watching', desc: 'Spend 5 minutes simply watching your world with the menus hidden.', icon: 'ic_eye', stat: ['zenSeconds', 300] },
  { id: 'speed1', name: 'Homecoming', desc: 'Reach the Hearthside Hamlet within 5 minutes of a new season.', icon: 'ic_hourglass', stat: ['speedHamlet', 1] },
  { id: 'speed2', name: 'Blink of an Eye', desc: 'Turn a season less than 2 minutes after it began.', icon: 'ic_hourglass', stat: ['speedSeason', 1] },
  { id: 'ring1', name: 'Tree Rings', desc: 'Grow the Elder Tree to 10 rings.', icon: 'elder_1', stat: ['rings', 10] },
  { id: 'ring2', name: 'Ancient', desc: 'Grow the Elder Tree to 30 rings.', icon: 'elder_2', stat: ['rings', 30] },
  { id: 'star1', name: 'Stargazer', desc: 'Light 5 constellations.', icon: 'res_starlight', stat: ['stars', 5] },
  { id: 'star2', name: 'The Whole Sky', desc: 'Light every constellation.', icon: 'res_starlight', stat: ['stars', 10] },
  { id: 'ending', name: 'Everbloom', desc: 'Wake the Elder Tree into full bloom and complete the story.', icon: 'elder_bloom', stat: ['ended', 1] },
  { id: 'perm1', name: 'Deep Roots', desc: 'Buy 20 levels of permanent upgrades.', icon: 'res_evergreen', stat: ['perms', 20] },
  { id: 'perm2', name: 'Canopy', desc: 'Buy 75 levels of permanent upgrades.', icon: 'res_evergreen', stat: ['perms', 75] },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
