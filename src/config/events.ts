import type { MerchantOffer, Requirement } from '@/game/types';

export interface EventDef {
  id: string;
  /** Seconds between appearances: [shortest, longest]. */
  every: [number, number];
  /** Seconds it stays before leaving. */
  lasts: number;
  /** Only happens once these are met. */
  req: Requirement[];
  /** Only happens at night. */
  night?: boolean;
  /** Journal entry discovered the first time it is seen. */
  journal: string;
}

/**
 * Random happenings. Timers are per-event and are sped up by the matching `rate.<id>` modifier
 * as well as the global `eventRate`.
 */
export const EVENTS: EventDef[] = [
  { id: 'treasure', every: [55, 110], lasts: 40, req: [], journal: 'e_treasure' },
  { id: 'golden', every: [300, 520], lasts: 24, req: [{ region: 'garden' }], journal: 'e_golden' },
  { id: 'storm', every: [380, 620], lasts: 55, req: [{ region: 'grove' }], journal: 'e_storm' },
  { id: 'merchant', every: [480, 760], lasts: 90, req: [{ region: 'pond' }], journal: 'e_merchant' },
  { id: 'visitor', every: [420, 800], lasts: 50, req: [{ region: 'meadow' }], journal: 'c_gloamcat' },
  { id: 'meteor', every: [300, 520], lasts: 40, req: [{ building: ['lantern', 1] }], night: true, journal: 'e_meteor' },
  { id: 'whale', every: [700, 1200], lasts: 60, req: [{ region: 'isles' }], journal: 'c_whale' },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Reward sizes, in seconds of current income unless noted. */
export const REWARDS = {
  /** Treasure: [min, max] seconds of income, never less than `treasureMinDew` dew. */
  treasureSeconds: [15, 50] as [number, number],
  treasureMinDew: 25,
  /** Chance a treasure or golden butterfly also holds a mysterious seed. */
  seedChance: 0.07,
  /** The very first treasure after the Garden always holds a seed, to teach the mechanic. */
  firstSeedGuaranteed: true,
  /** Golden butterfly outcomes: weights and sizes. */
  golden: { hourWeight: 4, lumpWeight: 4, frenzyWeight: 2, hourSeconds: 25, lumpSeconds: 240, frenzySeconds: 15 },
  /** Catching a falling star. */
  starSeconds: 30,
  starMin: 20,
  /** Petting the Gloamcat. */
  visitorSeconds: 120,
  /** Rainbow's end, and the Golden Hour it leaves with Rain Cycle. */
  rainbowSeconds: 240,
  rainbowGoldenSeconds: 20,
  /** Seconds a rainbow lingers after rain. */
  rainbowLasts: 25,
  whaleSeconds: 600,
  /** Finding a secret. */
  secretSeconds: 180,
} as const;

interface Ware {
  label: string;
  /** Price, as seconds of current income (never less than `minPrice` dew). */
  priceSeconds: number;
  minPrice: number;
  get: MerchantOffer['get'];
}

/** What the travelling merchant may have on his cart. He shows a few at random each visit. */
export const MERCHANT = {
  offers: 3,
  /** Merchant's Friend lowers every price to this share. */
  friendDiscount: 0.6,
  wares: [
    { label: 'Lucky charm — all income ×2 for 3 minutes', priceSeconds: 100, minPrice: 200, get: { buff: ['boon', 180] } },
    { label: 'A mysterious seed', priceSeconds: 240, minPrice: 2000, get: { seed: 1 } },
    { label: 'Bottled sunrise — a Golden Hour, right now', priceSeconds: 150, minPrice: 500, get: { buff: ['golden', 30] } },
    { label: 'Pocket hourglass — every ability ready again', priceSeconds: 60, minPrice: 300, get: { refresh: true } },
    { label: 'Storm in a jar — magical rain for a minute', priceSeconds: 45, minPrice: 150, get: { buff: ['storm', 60] } },
    { label: 'Tapping gloves — taps ×20 for 20 seconds', priceSeconds: 30, minPrice: 100, get: { buff: ['frenzy', 20] } },
  ] as Ware[],
} as const;
