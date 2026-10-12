/**
 * Who lives in the world and how they behave. The sprites come from art/creatures.ts;
 * this file decides how many appear, where they live, what they do and how they are animated.
 */

export type Locomotion = 'walk' | 'fly' | 'swim' | 'hop' | 'perch';

export interface CreatureDef {
  /** Sprite prefix (frames are `<sprite>_<n>`). */
  sprite: string;
  move: Locomotion;
  /** Lives at copies of this building; `perHome` creatures per building, capped at `max`. */
  home?: string;
  perHome?: number;
  max: number;
  /** …or appears in a fixed number once a flag is set / a region is discovered. */
  flag?: string;
  region?: string;
  /** Buildings it travels to and works at. 'spring' and 'hub' are also valid. */
  works: readonly string[];
  /** Pixels per second. */
  speed: number;
  /** Seconds spent working and resting: [min, max]. */
  workTime: readonly [number, number];
  restTime: readonly [number, number];
  /** Item sprite carried home after working. */
  carries?: string;
  /** Named particle burst played while working. */
  workFx?: string;
  /** Hover height for fliers, px. */
  altitude?: number;
  /** Only out at night (true) or only by day (false). */
  nocturnal?: boolean;
  /** Roams across lands rather than staying near home. */
  roams?: boolean;
  /** Followers that trail behind each one: [sprite, count]. */
  followers?: readonly [string, number];
  /** Journal secret discovered by clicking one. */
  secret?: string;
}

/** Frame indices into the baked walker poses (see WALKER_POSES in art/creatures.ts). */
export const WALK_CYCLE = [2, 0, 3, 0];
export const IDLE_CYCLE = [0, 0, 0, 0, 1, 0, 0, 4, 0, 0];
export const WORK_CYCLE = [1, 0];
export const ANIM_FPS = { walk: 7, idle: 2.5, work: 6, fly: 11, swim: 2 };

export const CREATURES: CreatureDef[] = [
  { sprite: 'sproutling', move: 'walk', home: 'burrow', perHome: 1, max: 10, works: ['fern', 'bed', 'spring', 'trellis'], speed: 13, workTime: [2, 4], restTime: [0.6, 2], carries: 'item_dew', workFx: 'tend' },
  { sprite: 'mossling', move: 'walk', home: 'den', perHome: 1, max: 8, works: ['glowcap', 'den'], speed: 9, workTime: [2.5, 4.5], restTime: [1, 3], carries: 'item_shroom' },
  { sprite: 'pebblefolk', move: 'walk', home: 'cottage', perHome: 1, max: 10, works: ['workshop', 'windmill', 'lantern', 'cottage'], speed: 11, workTime: [2.5, 5], restTime: [1, 3], carries: 'item_crate', roams: true },
  { sprite: 'thistlehog', move: 'walk', home: 'farm', perHome: 0.5, max: 5, works: ['farm'], speed: 10, workTime: [3, 5], restTime: [1, 2.5], carries: 'item_petals', workFx: 'tend' },
  { sprite: 'tumblebug', move: 'walk', flag: 'beetlePost', max: 4, works: ['workshop', 'cottage', 'windmill', 'burrow', 'den'], speed: 17, workTime: [0.8, 1.6], restTime: [0.4, 1], carries: 'item_crate', roams: true },
  { sprite: 'bee', move: 'fly', home: 'hive', perHome: 1.5, max: 16, works: ['bed', 'trellis', 'farm', 'fern'], speed: 30, workTime: [1, 2.2], restTime: [0.4, 1], altitude: 8, nocturnal: false, workFx: 'tend', carries: 'item_pollen' },
  { sprite: 'flutterling', move: 'fly', home: 'nest', perHome: 1, max: 8, works: ['bed', 'trellis', 'hive'], speed: 22, workTime: [1.4, 2.6], restTime: [0.6, 1.6], altitude: 13, carries: 'item_pollen', roams: true },
  { sprite: 'moonmoth', move: 'fly', home: 'roost', perHome: 1, max: 10, works: ['lantern', 'observatory', 'moonpool', 'roost'], speed: 16, workTime: [2, 4], restTime: [1, 2], altitude: 18, nocturnal: true, carries: 'item_starlight', roams: true },
  { sprite: 'wisp', move: 'fly', home: 'observatory', perHome: 2, max: 6, works: ['observatory', 'moonpool'], speed: 12, workTime: [1.5, 3], restTime: [1, 2], altitude: 16, nocturnal: true },
  { sprite: 'frog', move: 'hop', region: 'pond', max: 4, works: ['lily'], speed: 26, workTime: [3, 7], restTime: [2, 5], secret: 's_frog' },
  { sprite: 'duck', move: 'swim', flag: 'ducks', region: 'pond', max: 2, works: [], speed: 7, workTime: [1, 3], restTime: [0, 1], followers: ['duckling', 2] },
  { sprite: 'fish_0', move: 'swim', region: 'pond', max: 3, works: [], speed: 9, workTime: [0.5, 2], restTime: [0, 1] },
  { sprite: 'fish_1', move: 'swim', region: 'pond', max: 2, works: [], speed: 8, workTime: [0.5, 2], restTime: [0, 1] },
  { sprite: 'owl', move: 'perch', flag: 'owls', max: 3, works: ['treehouse'], speed: 20, workTime: [6, 12], restTime: [0, 1] },
];

/** Skiffs are buildings that sail: sprite prefix, how many appear at most, and their speed. */
export const SKIFFS = { sprites: ['skiff_0', 'skiff_1'], max: 6, speed: 6, secret: 's_skiff' } as const;

/** Tinkers (programmable helpers) wander the whole world; one appears per helper owned. */
export const TINKER = { sprite: 'tinker', speed: 18 } as const;

/** Ambient wildlife that is always around, scaled by the quality setting. */
export const AMBIENT = {
  /** Birds cross the sky in small flocks: [flocks at once, birds per flock]. More with bird baths and migration. */
  birds: { flocks: 2, perFlock: [1, 4] as [number, number], speed: [26, 40] as [number, number], altitude: 34, bonusFlag: 'birdbaths', migrationFlag: 'migration', secret: 's_bird' },
  /** Butterflies drift between flowers. `always` are present from the start; the rest need the flag. */
  butterflies: { always: 2, withFlag: 10, flag: 'butterflies', speed: 11, altitude: 7 },
  /** Fireflies drift up at night once the flag is set: particles per second per discovered land. */
  fireflies: { flag: 'fireflies', rate: 0.5, baseRate: 0.08 },
  /** Creatures greet each other when they pass this close, at most this often (seconds). */
  greeting: { distance: 9, cooldown: 14, seconds: 1.4 },
  /** Chance per second that a resting creature at night dozes off with a "zzz". */
  dozeChance: 0.05,
} as const;
