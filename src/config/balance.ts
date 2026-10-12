/**
 * Every tunable number that shapes pacing lives here.
 * Run `npm run balance` after changing anything to see how a full playthrough plays out.
 */
export const BALANCE = {
  /** Simulation steps per second. */
  tickRate: 20,

  /** Default cost multiplier for each additional copy of a building. */
  costGrowth: 1.15,
  /** Owning this many of one building multiplies its output by `milestoneMult` each time. */
  milestones: [10, 25, 50],
  milestoneMult: 2,

  click: {
    /** Dewdrops for one tap before any multipliers. */
    base: 1,
    /** Flow gained per tap and lost per second (Flow is the tapping combo meter, 0..1). */
    flowGain: 0.07,
    flowDecay: 0.22,
    /** Taps per second while the spring is held down. */
    holdRate: 6,
    critMult: 10,
    /** Echoing Drops repeats a tap this many extra times. */
    echoRepeats: 2,
  },

  day: {
    /** Seconds in a full day-night cycle. */
    length: 240,
    /** Fraction of the day at which night falls and lifts, and how long dusk/dawn take. */
    nightStart: 0.62,
    nightEnd: 0.95,
    fade: 0.045,
    /** Dawn Chorus burst length, seconds. */
    dawnChorus: 30,
  },

  harmony: {
    /**
     * Harmony is a bonus to all income that depends on how evenly plants, creatures, crafts
     * and magic are owned. This is the share of it you still get from a totally lopsided world.
     */
    floor: 0.15,
  },

  /** Things to do with the mouse besides tapping the spring. Rewards are in seconds of current income. */
  play: {
    sweep: {
      /** Dewdrops form on things all over the world; this many may be waiting at once, one more every `every` seconds. */
      cap: 16,
      every: 1.2,
      lifetime: 45,
      /** Passing the pointer within this many world pixels gathers one. */
      reach: 9,
      /** Worth this many seconds of income (at least `minDew`)… */
      seconds: 1,
      minDew: 2,
      /** …plus `chainStep` more for each one gathered within `chainWindow` seconds of the last, up to `chainMax` in a row. */
      chainStep: 0.08,
      chainMax: 15,
      chainWindow: 1.6,
    },
    shake: {
      /** Shaking a tree or bush drops this many seconds of income; each one needs `cooldown` seconds to refill. */
      seconds: 2,
      minDew: 4,
      cooldown: 25,
      /** Chance that something better falls out too (a mysterious seed, or more with luck). */
      surprise: 0.03,
    },
    pet: {
      /** Petting a creature cheers every creature home (×`boost`) for `seconds`, stacking up to `maxSeconds`. */
      boost: 1.5,
      seconds: 6,
      maxSeconds: 30,
      /** One creature can be petted again after this long. */
      cooldown: 4,
    },
    cloud: {
      /** While dragged, the rain cloud waters whatever is within `radius` px; watered things work ×(1 + `boost`) for `seconds`. */
      radius: 26,
      boost: 1,
      seconds: 25,
    },
  },

  /** Each achievement adds this much to all production. */
  achievementBonus: 0.01,
  /** Each journal discovery adds this much to Evergreen Token gains. */
  discoveryTokenBonus: 0.005,

  prestige: {
    /**
     * Tokens from dew = coef × (orders of magnitude of season dew above `floor`)^power.
     * Counting orders of magnitude gives strong diminishing returns: pushing further always
     * helps, but turning the season and returning stronger helps more.
     */
    floor: 1e6,
    coef: 0.25,
    power: 2,
    /** Tokens per Wonder grown this season. */
    perWonder: 1,
    /** Evergreen Vigor: production per token ever earned, per level. */
    vigorPerToken: 0.02,
    /** Seed Money: starting dew = base × growth^level. */
    seedMoneyBase: 50,
    seedMoneyGrowth: 10,
    /** Early Risers: [ferns, burrows] granted per level. */
    earlyKit: [
      [5, 1],
      [15, 5],
      [40, 15],
    ] as [number, number][],
    /** Momentum multiplier while it lasts. */
    momentumMult: 3,
    /** Elder Tree: production per ring, and rings needed for each growth stage. */
    ringBonus: 0.05,
    ringStages: [0, 5, 15],
    /** Cutscene length: first turn, and the floor it shrinks to. */
    cutsceneSeconds: 15,
    cutsceneMinSeconds: 4,
  },

  offline: {
    /** Share of normal production earned while away, and the cap on time counted. */
    rate: 0.5,
    capHours: 8,
    /** Absences shorter than this are ignored. */
    minSeconds: 60,
  },

  save: {
    key: 'little-elsewhere:save',
    settingsKey: 'little-elsewhere:settings',
    intervalSeconds: 15,
    version: 1,
  },

  automation: {
    /** Seconds between a helper's actions at base speed. */
    helperInterval: 2,
    /** Auto-collecting magpie keeps this share of a reward's value. */
    magpieShare: 0.6,
  },

  buffs: {
    rain: 3,
    storm: 2,
    golden: 7,
    frenzy: 20,
    meteor: 5,
    surge: 10,
    call: 3,
    dawn: 3,
    boon: 2,
  },

  wonders: {
    /** Seconds for a mysterious seed to grow, and how many Wonders fit in one season. */
    growSeconds: 240,
    slots: 3,
  },

  /** Safety ceiling for every number in the game. */
  maxNumber: 1e300,
} as const;
