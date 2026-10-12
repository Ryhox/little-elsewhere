/** Shared vocabulary for the simulation. Content lives in src/config; this file only names its shapes. */

/** Spendable resources. Dew is the only one; Evergreen Tokens (the prestige currency) are tracked separately. */
export const RES = ['dew'] as const;
export type Res = (typeof RES)[number];
export type Cost = Partial<Record<Res, number>>;

export const CATS = ['flora', 'fauna', 'craft', 'mystic'] as const;
export type Cat = (typeof CATS)[number];

export type RegionId = string;
export type BuildingId = string;

/** How an effect changes a modifier. */
export type EffectOp = 'mul' | 'add' | 'set';

/**
 * One declarative change to the modifier sheet, e.g. `{ path: 'b.fern', op: 'mul', v: 2 }`.
 * For levelled upgrades `mul` applies v^level and `add` applies v×level.
 */
export interface Effect {
  path: string;
  op: EffectOp;
  v: number;
}

/** A condition on game state, written as data so the UI can also describe it. */
export interface Requirement {
  /** Own at least this many of a building. */
  building?: [BuildingId, number];
  /** Have unlocked a region. */
  region?: RegionId;
  /** Own a seasonal upgrade. */
  upgrade?: string;
  /** Own a permanent upgrade (at any level). */
  perm?: string;
  /** Have completed this many seasons. */
  seasons?: number;
  /** Have earned this much of a resource this season. */
  earned?: [Res, number];
  /** Total buildings owned. */
  buildings?: number;
}

export interface ResourceDef {
  id: Res;
  name: string;
  icon: string;
  color: string;
  blurb: string;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  blurb: string;
  cost: Cost;
  /** Regions that must be unlocked first. */
  needs: RegionId[];
  /** Permanent upgrade required before this region can be discovered. */
  perm?: string;
  /** Evergreen Tokens this region is worth at season's end. */
  tokens: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  region: RegionId;
  cat: Cat;
  blurb: string;
  cost: Cost;
  /** Cost multiplier per owned copy. Falls back to BALANCE.costGrowth. */
  growth?: number;
  /** The most that can be owned. Every building is finite, so the world can be finished. */
  max: number;
  /** Dew made per second by one copy, before any multipliers (omit for buildings that only give bonuses). */
  base?: number;
  /** Only gathers dew while it is night. */
  night?: boolean;
  /** Atlas sprite shown in menus. */
  icon: string;
}

export type UpgradeCat = 'spring' | 'flora' | 'fauna' | 'craft' | 'mystic' | 'synergy' | 'world' | 'ability';

export interface UpgradeDef {
  id: string;
  name: string;
  cat: UpgradeCat;
  desc: string;
  cost: Cost;
  req: Requirement[];
  effects: Effect[];
  icon: string;
  /** Buying this completes the story (the first time). */
  ending?: boolean;
}

export type Branch = 'growth' | 'nature' | 'automation' | 'fortune' | 'legacy';

export interface PermDef {
  id: string;
  name: string;
  branch: Branch;
  desc: string;
  /** Token cost of the first level, and how it scales per level. */
  cost: number;
  scale?: number;
  max: number;
  /** Other permanent upgrades required first. */
  needs: string[];
  seasons?: number;
  effects: Effect[];
  icon: string;
  /** Grid position inside the branch (row = depth, col = lane). */
  row: number;
  col: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Seconds the buff lasts (0 = instant) and seconds to recharge. */
  duration: number;
  cooldown: number;
  /** Seasonal upgrade that unlocks it. */
  unlock: string;
}

export interface SynergyDef {
  id: string;
  /** What is counted: building ids, 'all' buildings, unlocked 'regions' or Elder 'rings'. */
  from: BuildingId[] | 'all' | 'regions' | 'rings';
  /** What is boosted: building ids or a whole category. */
  to: BuildingId[] | Cat;
  /** Bonus per counted thing; 0 means it must be unlocked by an upgrade. */
  base: number;
  label: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Stat or requirement that earns it. */
  stat?: [string, number];
  req?: Requirement[];
  hidden?: boolean;
}

export type JournalKind = 'creature' | 'wonder' | 'secret' | 'combo' | 'event';

export interface JournalDef {
  id: string;
  kind: JournalKind;
  name: string;
  text: string;
  hint: string;
  icon: string;
  /** Combos are discovered automatically when these are met. */
  req?: Requirement[];
  effects?: Effect[];
}

export interface WonderDef {
  id: string;
  name: string;
  text: string;
  effects: Effect[];
}

export interface BlessingDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  effects: Effect[];
}

export interface ConstellationDef {
  id: string;
  name: string;
  desc: string;
  /** Dew cost. */
  cost: number;
  effects: Effect[];
  /** Position on the star chart, 0..1. */
  x: number;
  y: number;
}

/** A helper routine the player programs once automation is unlocked. */
export interface HelperRule {
  on: boolean;
  /** What it buys: 'any', a category, 'upgrades' or 'regions'. */
  target: 'any' | Cat | 'upgrades' | 'regions';
  /** Fraction of the bank it may spend on one purchase. */
  budget: number;
}

export interface SeasonRecord {
  tokens: number;
  seconds: number;
}

export interface MerchantOffer {
  give: Cost;
  /** What you receive: a timed buff, a seed, or every ability made ready at once. */
  get: { buff?: [string, number]; seed?: number; refresh?: boolean };
  label: string;
}

export interface GameState {
  version: number;
  res: Record<Res, number>;
  /** Earned this season / across all seasons. */
  earned: Record<Res, number>;
  life: Record<Res, number>;
  b: Record<BuildingId, number>;
  up: Record<string, number>;
  regions: Record<RegionId, number>;
  /** Seconds played this season, and position in the day cycle (seconds). */
  time: number;
  day: number;
  flow: number;
  buffs: Record<string, number>;
  cooldowns: Record<string, number>;
  /** Seconds until each random event next fires. */
  timers: Record<string, number>;
  tokens: number;
  tokensEarned: number;
  seasons: number;
  history: SeasonRecord[];
  perm: Record<string, number>;
  rings: number;
  blessing: string;
  blessingChoices: string[];
  stars: Record<string, number>;
  ach: Record<string, number>;
  journal: Record<string, number>;
  wonders: string[];
  keepsakes: string[];
  seeds: number;
  plot: { id: string; progress: number } | null;
  merchant: { offers: MerchantOffer[]; left: number } | null;
  stats: Record<string, number>;
  helpers: HelperRule[];
  autoSeason: { on: boolean; minTokens: number };
  /** Building counts at the end of the previous season (for Memory of Gardens). */
  lastCounts: Record<BuildingId, number>;
  lastSeen: number;
}

/** The modifier sheet every upgrade writes into and every formula reads from. */
export interface Mods {
  all: number;
  cat: Record<Cat, number>;
  b: Record<BuildingId, number>;
  cost: number;
  costCat: Record<Cat, number>;
  growth: number;
  upgradeCost: number;
  regionCost: number;
  mile: number;
  click: number;
  clickPct: number;
  crit: number;
  critMult: number;
  flowMax: number;
  echo: number;
  /** Extra tap strength at night (0 = none, 1 = double). */
  nightClick: number;
  /** Automatic taps per second: per Sproutling Burrow, and from the spring itself. */
  autoTap: number;
  selfTap: number;
  surgeMult: number;
  /** Synergy strengths by id (see config/buildings.ts). */
  syn: Record<string, number>;
  /** Share of output a night-only building keeps by day, and its bonus at night. */
  dayShare: Record<BuildingId, number>;
  nightBoost: Record<BuildingId, number>;
  /** Event frequency multipliers by event id. */
  rate: Record<string, number>;
  meteorMult: number;
  nightLen: number;
  starDay: number;
  nightAll: number;
  /** Harmony: how much a perfectly balanced world adds to all income (0 until the Chime is raised; 1 = +100%). */
  harmony: number;
  luck: number;
  treasure: number;
  eventRate: number;
  seedRate: number;
  shard: number;
  abilityCd: number;
  abilityDur: number;
  offline: number;
  offlineCap: number;
  token: number;
  /** Multiplier on what each Evergreen Sapling adds to token gains. */
  saplingTokens: number;
  speed: number;
  wonderSlots: number;
  wonderGrow: number;
  ach: number;
  startDew: number;
  momentum: number;
  helperSlots: number;
  helperSpeed: number;
  keepsakes: number;
  memory: number;
  flags: Record<string, number>;
}

/** Live production snapshot, recomputed every tick. */
export interface Rates {
  res: Record<Res, number>;
  /** Per-building output per second (in its own resource). */
  b: Record<BuildingId, number>;
  /** 0..1 — how dark it is. */
  night: number;
  /** 0..1 — how even the four building categories are. */
  balance: number;
  /** What Harmony is currently adding to all income (0.5 = +50%). */
  harmony: number;
  /** Global multiplier, for display. */
  global: number;
  click: number;
}
