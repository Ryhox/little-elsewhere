import type { BuildingDef, SynergyDef } from '@/game/types';

/**
 * Everything the player can build. Order within a region is the order shown in the shop.
 *
 * Everything in Little Elsewhere gathers Dew in its own way (ferns catch it, petals hold it,
 * bees turn it to honeydew, moths sip it from moonlight), so every building's `base` is
 * Dew per second for one copy, before any multipliers. `max` is how many can be owned:
 * the world is finite, which is what lets the story reach its end.
 */
export const BUILDINGS: BuildingDef[] = [
  { id: 'fern', name: 'Dew Fern', region: 'clearing', cat: 'flora', blurb: 'Catches morning mist on its fronds.', cost: { dew: 15 }, base: 0.2, max: 50, icon: 'fern_0' },
  { id: 'burrow', name: 'Sproutling Burrow', region: 'clearing', cat: 'fauna', blurb: 'A Sproutling moves in and gathers dew from the ferns.', cost: { dew: 100 }, base: 1, max: 50, icon: 'burrow' },

  { id: 'bed', name: 'Flower Bed', region: 'garden', cat: 'flora', blurb: 'Every petal cups a drop of dew.', cost: { dew: 420 }, base: 4, max: 50, icon: 'bed_0' },
  { id: 'trellis', name: 'Rose Trellis', region: 'garden', cat: 'flora', blurb: 'Climbing roses, heavy with dew each dawn.', cost: { dew: 2600 }, base: 22, max: 40, icon: 'trellis' },

  { id: 'glowcap', name: 'Glowcap Ring', region: 'grove', cat: 'flora', blurb: 'Luminous mushrooms that sweat sweet dew.', cost: { dew: 11000 }, base: 90, max: 50, icon: 'glowcap_0' },
  { id: 'den', name: 'Mossling Den', region: 'grove', cat: 'fauna', blurb: 'A Mossling wrings dew from the moss for you.', cost: { dew: 52000 }, base: 420, max: 40, icon: 'den' },

  { id: 'lily', name: 'Lily Garden', region: 'pond', cat: 'flora', blurb: 'Floating gardens. Each one waters all plants a little.', cost: { dew: 240000 }, base: 980, max: 40, icon: 'lilies_0' },
  { id: 'skiff', name: 'Dew Skiff', region: 'pond', cat: 'craft', blurb: 'A tiny boat that skims dew off the pond.', cost: { dew: 1.2e6 }, base: 4200, max: 30, icon: 'skiff_0' },

  { id: 'hive', name: 'Beehive', region: 'meadow', cat: 'fauna', blurb: 'Bees turn dew to honeydew, more with every flower you grow.', cost: { dew: 6e6 }, base: 18000, max: 40, icon: 'hive_0' },
  { id: 'nest', name: 'Flutterling Nest', region: 'meadow', cat: 'fauna', blurb: 'Flutterlings carry dew from blossom to blossom.', cost: { dew: 3.2e7 }, base: 80000, max: 30, icon: 'nest' },

  { id: 'cottage', name: 'Cottage', region: 'hamlet', cat: 'craft', blurb: 'Pebblefolk move in. Each cottage helps every creature.', cost: { dew: 1.8e8 }, base: 380000, max: 40, icon: 'cottage_0' },
  { id: 'workshop', name: 'Workshop', region: 'hamlet', cat: 'craft', blurb: 'Tinkers up dew-catchers for the whole world.', cost: { dew: 1.1e9 }, base: 2e6, max: 30, icon: 'workshop_0' },
  { id: 'lantern', name: 'Lantern Post', region: 'hamlet', cat: 'mystic', blurb: 'Night dew gathers thick around its warm light. Works only at night.', cost: { dew: 7e8 }, base: 3.2e6, night: true, max: 40, icon: 'lantern' },

  { id: 'windmill', name: 'Windmill', region: 'hill', cat: 'craft', blurb: 'Turns the wind into work. Workshops love them.', cost: { dew: 1e12 }, base: 1.1e7, max: 30, icon: 'windmill' },
  { id: 'farm', name: 'Farm Plot', region: 'hill', cat: 'flora', blurb: 'Rows of dewy crops, harvested by the basket.', cost: { dew: 6e12 }, base: 6e7, max: 40, icon: 'farm_2' },

  { id: 'treehouse', name: 'Treehouse', region: 'woods', cat: 'craft', blurb: 'A cozy home high in the canopy, where the mist is thickest.', cost: { dew: 7e17 }, base: 3.4e8, max: 30, icon: 'treehouse' },
  { id: 'roost', name: 'Moonmoth Roost', region: 'woods', cat: 'fauna', blurb: 'Moonmoths wake at dusk and sip dew out of the moonlight. Works only at night.', cost: { dew: 4e18 }, base: 5e9, night: true, max: 30, icon: 'roost' },

  { id: 'observatory', name: 'Observatory', region: 'rise', cat: 'mystic', blurb: 'Draws stardew down from the sky. Works only at night.', cost: { dew: 3e19 }, growth: 1.18, base: 3e10, night: true, max: 20, icon: 'observatory' },
  { id: 'moonpool', name: 'Moon Pool', region: 'rise', cat: 'mystic', blurb: 'Still water that holds the moon. Each one lifts all income by 3%.', cost: { dew: 1.5e20 }, growth: 1.25, max: 20, icon: 'moonpool' },

  { id: 'crystal', name: 'Sky Crystal', region: 'isles', cat: 'mystic', blurb: 'Condenses dew straight out of the clouds.', cost: { dew: 1e21 }, growth: 1.18, base: 2.2e11, max: 25, icon: 'crystal_0' },
  { id: 'shrine', name: 'Root Shrine', region: 'heartwood', cat: 'mystic', blurb: 'Old stones that draw dew straight from the deep.', cost: { dew: 5e22 }, base: 2.4e12, max: 25, icon: 'shrine' },
  { id: 'sapling', name: 'Evergreen Sapling', region: 'shoals', cat: 'flora', blurb: 'Each sapling adds 2% to the Evergreen Tokens a season yields.', cost: { dew: 5e25 }, growth: 1.3, max: 20, icon: 'sapling' },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export const BUILDING_IDS = BUILDINGS.map((b) => b.id);

/** Handy groups for upgrades that lift several kinds at once. */
export const FLOWERS = ['bed', 'trellis', 'farm'];
export const BEEFOLK = ['hive', 'nest'];
export const NIGHTFOLK = ['lantern', 'roost', 'observatory'];

const idsOf = (cat: string) => BUILDINGS.filter((b) => b.cat === cat).map((b) => b.id);

/**
 * How buildings help each other. Bonus = 1 + (count of `from`) × strength, applied to `to`.
 * A `base` of 0 means the link lies dormant until an upgrade strengthens it (via `syn.<id>`).
 * `to: ['*']` lifts everything.
 */
export const SYNERGIES: SynergyDef[] = [
  { id: 'lilyFlora', from: ['lily'], to: 'flora', base: 0.01, label: 'per Lily Garden' },
  { id: 'cottageFauna', from: ['cottage'], to: 'fauna', base: 0.02, label: 'per Cottage' },
  { id: 'windWork', from: ['windmill'], to: ['workshop'], base: 0.05, label: 'per Windmill' },
  { id: 'hivePetal', from: ['hive'], to: FLOWERS, base: 0.02, label: 'per Beehive' },
  { id: 'nestPetal', from: ['nest'], to: FLOWERS, base: 0.02, label: 'per Flutterling Nest' },
  { id: 'flowerPollen', from: FLOWERS, to: ['hive'], base: 0.02, label: 'per flower patch' },
  { id: 'moonAll', from: ['moonpool'], to: ['*'], base: 0.03, label: 'per Moon Pool' },
  { id: 'fernSelf', from: ['fern'], to: ['fern'], base: 0, label: 'per Dew Fern' },
  { id: 'fernAll', from: 'all', to: ['fern'], base: 0, label: 'per building' },
  { id: 'burrowFern', from: ['fern'], to: ['burrow'], base: 0, label: 'per Dew Fern' },
  { id: 'hiveFern', from: ['hive'], to: ['fern', 'burrow'], base: 0, label: 'per Beehive' },
  { id: 'bedFern', from: ['fern'], to: ['bed'], base: 0, label: 'per Dew Fern' },
  { id: 'trellisBed', from: ['trellis'], to: ['bed'], base: 0, label: 'per Rose Trellis' },
  { id: 'sporeA', from: ['den'], to: ['glowcap'], base: 0, label: 'per Mossling Den' },
  { id: 'sporeB', from: ['glowcap'], to: ['den'], base: 0, label: 'per Glowcap Ring' },
  { id: 'denRegion', from: 'regions', to: ['den'], base: 0, label: 'per region' },
  { id: 'lilySkiff', from: ['skiff'], to: ['lily'], base: 0, label: 'per Dew Skiff' },
  { id: 'workCottage', from: ['cottage'], to: ['workshop'], base: 0, label: 'per Cottage' },
  { id: 'windFarm', from: ['windmill'], to: ['farm'], base: 0, label: 'per Windmill' },
  { id: 'farmCottage', from: ['cottage'], to: ['farm'], base: 0, label: 'per Cottage' },
  { id: 'treeLantern', from: ['lantern'], to: ['treehouse'], base: 0, label: 'per Lantern Post' },
  { id: 'treeFauna', from: ['treehouse'], to: 'fauna', base: 0, label: 'per Treehouse' },
  { id: 'roostTree', from: ['treehouse'], to: ['roost'], base: 0, label: 'per Treehouse' },
  { id: 'roostLantern', from: ['lantern'], to: ['roost'], base: 0, label: 'per Lantern Post' },
  { id: 'glowFlora', from: ['glowcap'], to: 'flora', base: 0, label: 'per Glowcap Ring' },
  { id: 'faunaFlora', from: idsOf('fauna'), to: 'flora', base: 0, label: 'per creature home' },
  { id: 'floraFauna', from: idsOf('flora'), to: 'fauna', base: 0, label: 'per plant patch' },
  { id: 'regionPetal', from: 'regions', to: FLOWERS, base: 0, label: 'per region' },
  { id: 'shrineRing', from: 'rings', to: ['shrine'], base: 0, label: 'per Elder ring' },
  { id: 'saplingAll', from: ['sapling'], to: ['*'], base: 0, label: 'per Evergreen Sapling' },
  { id: 'crystalSelf', from: ['crystal'], to: ['crystal'], base: 0, label: 'per Sky Crystal' },
];

/** Each Evergreen Sapling adds this much to Evergreen Token gains. */
export const SAPLING_TOKEN_BONUS = 0.02;
