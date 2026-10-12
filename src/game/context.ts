import { BALANCE } from '@/config/balance';
import { BUILDING_IDS } from '@/config/buildings';
import { START_REGION } from '@/config/regions';
import { Bus } from '@/engine/bus';
import type { Rand } from '@/engine/rng';
import { CATS, RES, type Cat, type Cost, type GameState, type Mods, type Rates, type Res } from './types';

/** Everything the simulation announces. The world, audio and UI all listen here. */
export interface GameEvents {
  /** The spring was tapped `count` times (auto-taps are batched). */
  tap: { amount: number; crit: boolean; auto: boolean; count: number };
  buy: { id: string; count: number; auto: boolean };
  upgrade: { id: string; auto: boolean };
  region: { id: string; quiet: boolean };
  perm: { id: string };
  ability: { id: string };
  /** A random event appeared in the world, or went away uncollected. */
  spawn: { id: string };
  despawn: { id: string };
  /** Something was collected or awarded; `source` says what. */
  reward: { source: string; text: string; gains: Cost; tokens?: number };
  achievement: { id: string };
  journal: { id: string };
  /** Hands-on play in the world: a dewdrop swept up, a plant shaken, a creature petted. */
  sweep: { amount: number; chain: number };
  shake: { amount: number; seed: boolean };
  pet: Record<string, never>;
  /** A tutorial step was completed. */
  guide: { id: string; finished: boolean };
  /** The Elder Tree has bloomed: the story's end (play continues). */
  ending: Record<string, never>;
  wonder: { id: string };
  seedPlanted: { id: string };
  /** Dawn or dusk has just begun. */
  daybreak: { night: boolean };
  /** The season has turned and a fresh one has begun. */
  season: { tokens: number; seasons: number };
  /** Whole-state replacement (load, import, wipe). */
  reset: Record<string, never>;
}

/** One running game: its save data plus everything derived from it. */
export interface Game {
  s: GameState;
  mods: Mods;
  rates: Rates;
  bus: Bus<GameEvents>;
  rand: Rand;
  /** Set whenever something that feeds the modifier sheet changes. */
  dirty: boolean;
  /** Fractional automatic taps carried between ticks. */
  tapCarry: number;
  /** Share (0..1) of each building's copies currently watered by the rain cloud. Set by the world; never saved. */
  watered: Record<string, number>;
  /** Per-helper countdowns and the shared slow-check countdown. */
  helperClock: number[];
  checkClock: number;
}

const zeroRes = (): Record<Res, number> => Object.fromEntries(RES.map((r) => [r, 0])) as Record<Res, number>;
const oneCat = (): Record<Cat, number> => Object.fromEntries(CATS.map((c) => [c, 1])) as Record<Cat, number>;

export function newState(): GameState {
  return {
    version: BALANCE.save.version,
    res: zeroRes(),
    earned: zeroRes(),
    life: zeroRes(),
    b: Object.fromEntries(BUILDING_IDS.map((id) => [id, 0])),
    up: {},
    regions: { [START_REGION]: 1 },
    time: 0,
    day: BALANCE.day.length * 0.08,
    flow: 0,
    buffs: {},
    cooldowns: {},
    timers: {},
    tokens: 0,
    tokensEarned: 0,
    seasons: 0,
    history: [],
    perm: {},
    rings: 0,
    blessing: '',
    blessingChoices: [],
    stars: {},
    ach: {},
    journal: {},
    wonders: [],
    keepsakes: [],
    seeds: 0,
    plot: null,
    merchant: null,
    stats: {},
    helpers: [],
    autoSeason: { on: false, minTokens: 10 },
    lastCounts: {},
    lastSeen: Date.now(),
  };
}

/** A blank modifier sheet: every multiplier at 1, every bonus at 0. */
export function baseMods(): Mods {
  return {
    all: 1,
    cat: oneCat(),
    b: Object.fromEntries(BUILDING_IDS.map((id) => [id, 1])),
    cost: 1,
    costCat: oneCat(),
    growth: 0,
    upgradeCost: 1,
    regionCost: 1,
    mile: BALANCE.milestoneMult,
    click: 1,
    clickPct: 0,
    crit: 0,
    critMult: BALANCE.click.critMult,
    flowMax: 0,
    echo: 0,
    nightClick: 0,
    autoTap: 0,
    selfTap: 0,
    surgeMult: 1,
    syn: {},
    dayShare: {},
    nightBoost: {},
    rate: {},
    meteorMult: 1,
    nightLen: 0,
    starDay: 0,
    nightAll: 0,
    harmony: 0,
    luck: 0,
    treasure: 1,
    eventRate: 1,
    seedRate: 1,
    shard: 0,
    abilityCd: 1,
    abilityDur: 1,
    offline: BALANCE.offline.rate,
    offlineCap: BALANCE.offline.capHours,
    token: 1,
    saplingTokens: 1,
    speed: 1,
    wonderSlots: BALANCE.wonders.slots,
    wonderGrow: 1,
    ach: BALANCE.achievementBonus,
    startDew: 0,
    momentum: 0,
    helperSlots: 0,
    helperSpeed: 1,
    keepsakes: 0,
    memory: 0,
    flags: {},
  };
}

export function emptyRates(): Rates {
  return { res: zeroRes(), b: {}, night: 0, balance: 0, harmony: 0, global: 1, click: 1 };
}

export function createGame(state: GameState = newState(), rand: Rand = Math.random): Game {
  return { s: state, mods: baseMods(), rates: emptyRates(), bus: new Bus<GameEvents>(), rand, dirty: true, tapCarry: 0, watered: {}, helperClock: [], checkClock: 0 };
}
