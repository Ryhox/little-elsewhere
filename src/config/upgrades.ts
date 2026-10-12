import { add, boost, flag, mul } from '@/game/effects';
import type { Cost, Effect, UpgradeDef } from '@/game/types';
import { BALANCE } from './balance';
import { BEEFOLK, BUILDING_BY_ID, FLOWERS, NIGHTFOLK } from './buildings';
import { REGION_BY_ID } from './regions';

/**
 * Seasonal upgrades: bought with Dew, reset when the season turns.
 * Effects are plain data (see game/effects.ts), so adding one never needs new code.
 *
 * Prices are written relative to the thing an upgrade belongs to, so re-balancing a
 * building or a land automatically carries its upgrades along with it.
 */

/** A price that is `factor` times a building's base cost. */
const forBuilding = (id: string, factor: number): Cost => ({ dew: Math.ceil((BUILDING_BY_ID[id].cost.dew ?? 0) * factor) });
/** A price that is `factor` times what a land costs to discover. */
const forLand = (id: string, factor: number): Cost => ({ dew: Math.ceil((REGION_BY_ID[id].cost.dew ?? 0) * factor) });

/* ───────────────────────────── The spring ───────────────────────────── */

const SPRING: UpgradeDef[] = [
  { id: 's_moss', name: 'Mossy Stones', cat: 'spring', desc: 'Taps give twice the dew.', cost: { dew: 40 }, req: [], effects: [mul('click', 2)], icon: 'spring_1_0' },
  { id: 's_channels', name: 'Clear Channels', cat: 'spring', desc: 'Taps give twice the dew again.', cost: { dew: 350 }, req: [{ upgrade: 's_moss' }], effects: [mul('click', 2)], icon: 'res_dew' },
  { id: 's_bell', name: 'Dew Bell', cat: 'spring', desc: 'Each tap also gives 2% of your dew per second.', cost: { dew: 4000 }, req: [{ building: ['burrow', 5] }], effects: [add('clickPct', 0.02)], icon: 'ic_note' },
  { id: 's_runes', name: 'Rune Carvings', cat: 'spring', desc: 'Glowing runes triple your taps.', cost: forLand('pond', 0.6), req: [{ upgrade: 's_bell' }], effects: [mul('click', 3)], icon: 'spring_2_0' },
  { id: 's_flow', name: 'Flow State', cat: 'spring', desc: 'Tapping in rhythm builds Flow, up to ×3 per tap.', cost: forLand('pond', 3), req: [{ region: 'pond' }], effects: [add('flowMax', 2)], icon: 'ic_wind' },
  { id: 's_echo', name: 'Echoing Drops', cat: 'spring', desc: '15% of taps echo twice more.', cost: forLand('meadow', 2), req: [{ region: 'meadow' }, { upgrade: 's_flow' }], effects: [add('echo', 0.15)], icon: 'ic_note' },
  { id: 's_crystal', name: 'Crystal Heart', cat: 'spring', desc: 'A crystal rises from the spring. Taps ×5 and +3% of dew per second.', cost: forLand('hamlet', 1.5), req: [{ region: 'hamlet' }], effects: [mul('click', 5), add('clickPct', 0.03)], icon: 'spring_3_0' },
  { id: 's_overflow', name: 'Overflow', cat: 'spring', desc: 'The spring spills over. All income +50%.', cost: forLand('hamlet', 12), req: [{ upgrade: 's_crystal' }], effects: [mul('all', 1.5)], icon: 'res_dew' },
  { id: 's_starlit', name: 'Starlit Waters', cat: 'spring', desc: 'Taps are worth three times as much at night.', cost: forBuilding('lantern', 6), req: [{ building: ['lantern', 5] }], effects: [add('nightClick', 2)], icon: 'ic_moon' },
  { id: 's_chorus', name: 'Dewbell Chorus', cat: 'spring', desc: 'Each tap gives a further 5% of your dew per second.', cost: forLand('hill', 2), req: [{ region: 'hill' }], effects: [add('clickPct', 0.05)], icon: 'ic_note' },
  { id: 's_golden', name: 'Golden Rim', cat: 'spring', desc: 'Gilded stones. Taps ×10 and 5% more Glimmers.', cost: forLand('woods', 2), req: [{ region: 'woods' }], effects: [mul('click', 10), add('crit', 0.05)], icon: 'spring_4_0' },
  { id: 's_wellspring', name: 'Wellspring', cat: 'spring', desc: 'The spring taps itself five times a second.', cost: forLand('rise', 2), req: [{ region: 'rise' }], effects: [add('selfTap', 5)], icon: 'ic_hourglass' },
];

/** Spring upgrades that visibly rebuild the spring, in tier order. */
export const SPRING_TIER_UPGRADES = ['s_moss', 's_runes', 's_crystal', 's_golden'];

/* ─────────────────────── Three upgrades per building ─────────────────────── */

interface BuildingLine {
  first: string;
  signature: { name: string; desc: string; effects: Effect[] };
  second: string;
}

/** The three upgrades unlock at these shares of the building's maximum count… */
const TIER_SHARE = [0.25, 0.5, 1] as const;
/** …and cost this many times what that copy of the building would cost. */
const TIER_PRICE = 3.5;
const TIER_MULT = [2, 0, 3] as const;

/** Owned count at which a building's nth upgrade appears, and its price as a multiple of the building's base cost. */
function tierOf(id: string, tier: number): { owned: number; factor: number } {
  const def = BUILDING_BY_ID[id];
  const owned = Math.ceil(def.max * TIER_SHARE[tier]);
  return { owned, factor: TIER_PRICE * (def.growth ?? BALANCE.costGrowth) ** owned };
}

const LINES: Record<string, BuildingLine> = {
  fern: { first: 'Curled Fiddleheads', signature: { name: 'Unfurling', desc: 'Each Dew Fern makes all Dew Ferns 2% better.', effects: [add('syn.fernSelf', 0.02)] }, second: 'Morning Glory Ferns' },
  burrow: { first: 'Tiny Watering Cans', signature: { name: 'Spring Tappers', desc: 'Sproutlings tap the spring for you: one tap every 5 seconds per burrow.', effects: [add('autoTap', 0.2)] }, second: 'Burrow Bunkbeds' },
  bed: { first: 'Rich Compost', signature: { name: 'Companion Planting', desc: 'Each Dew Fern makes Flower Beds 1% better.', effects: [add('syn.bedFern', 0.01)] }, second: 'Heirloom Bulbs' },
  trellis: { first: 'Sturdy Lattice', signature: { name: 'Climbing Roses', desc: 'Each Rose Trellis makes Flower Beds 3% better.', effects: [add('syn.trellisBed', 0.03)] }, second: 'Rose Arbors' },
  glowcap: { first: 'Spore Dust', signature: { name: 'Bioluminescence', desc: 'Glowcaps shine after dark and gather twice as much at night.', effects: [add('nightBoost.glowcap', 1)] }, second: 'Lantern Caps' },
  den: { first: 'Woven Baskets', signature: { name: "Forager's Maps", desc: 'Mossling Dens are 8% better for every land you have discovered.', effects: [add('syn.denRegion', 0.08)] }, second: 'Moss Hammocks' },
  lily: { first: 'Lotus Blooms', signature: { name: 'Dragonfly Couriers', desc: 'Lily Gardens water plants twice as well (+2% each).', effects: [add('syn.lilyFlora', 0.01)] }, second: 'Floating Gardens' },
  skiff: { first: 'Patchwork Sails', signature: { name: 'Lantern Skiffs', desc: 'Skiffs light their lanterns and work double at night.', effects: [add('nightBoost.skiff', 1)] }, second: 'Regatta Rigging' },
  hive: { first: 'Honeycomb Frames', signature: { name: 'Waggle Dance', desc: 'Bees find flowers faster: hives gain a further 2% per flower patch.', effects: [add('syn.flowerPollen', 0.02)] }, second: 'Royal Jelly' },
  nest: { first: 'Silk Ribbons', signature: { name: 'Ribbon Trails', desc: 'Flutterlings help flowers a further 3% per nest.', effects: [add('syn.nestPetal', 0.03)] }, second: 'Wind Chimes' },
  cottage: { first: 'Thatched Roofs', signature: { name: 'Guild Hall', desc: 'Cottages help creatures twice as much (+4% each).', effects: [add('syn.cottageFauna', 0.02)] }, second: 'Hearthstones' },
  workshop: { first: 'Copper Tools', signature: { name: 'Beetle Post', desc: 'Tumblebugs deliver parts: Workshops +5% per Cottage.', effects: [add('syn.workCottage', 0.05), flag('beetlePost')] }, second: 'Clockwork Benches' },
  lantern: { first: 'Beeswax Candles', signature: { name: 'Firefly Jars', desc: 'Lanterns keep a quarter of their glow by day. Fireflies come out at night.', effects: [add('dayShare.lantern', 0.25), flag('fireflies')] }, second: 'Moonglass Lanterns' },
  windmill: { first: 'Canvas Sails', signature: { name: 'Tailwind', desc: 'Windmills help Workshops twice as much (+10% each).', effects: [add('syn.windWork', 0.05)] }, second: 'Whirligig Gears' },
  farm: { first: 'Crop Rotation', signature: { name: 'Harvest Baskets', desc: 'Pebblefolk help with the harvest: Farm Plots +3% per Cottage.', effects: [add('syn.farmCottage', 0.03)] }, second: 'Giant Pumpkins' },
  treehouse: { first: 'Rope Ladders', signature: { name: 'Canopy Lanterns', desc: 'Treehouses are 3% better per Lantern Post.', effects: [add('syn.treeLantern', 0.03)] }, second: 'Sky Bridges' },
  roost: { first: 'Silk Cocoons', signature: { name: 'Moon Dust', desc: 'Roosts gain 10% per Treehouse and 2% per Lantern Post.', effects: [add('syn.roostTree', 0.1), add('syn.roostLantern', 0.02)] }, second: 'Lunar Silk' },
  observatory: { first: 'Polished Lenses', signature: { name: 'Star Charts', desc: 'Meteor showers come twice as often and shine twice as bright.', effects: [mul('rate.meteor', 2), mul('meteorMult', 2)] }, second: 'Great Refractor' },
  moonpool: { first: 'Still Waters', signature: { name: 'Reflection', desc: 'Night-gatherers keep working by day at 30% strength.', effects: [add('starDay', 0.3)] }, second: 'Mirror Pools' },
  crystal: { first: 'Sky Facets', signature: { name: 'Resonance', desc: 'Each Sky Crystal makes all Sky Crystals 5% better.', effects: [add('syn.crystalSelf', 0.05)] }, second: 'Prism Spires' },
  shrine: { first: 'Root Offerings', signature: { name: 'Root Hymn', desc: 'Root Shrines are 10% better for every ring of the Elder Tree.', effects: [add('syn.shrineRing', 0.1)] }, second: 'Heartwood Altar' },
  sapling: { first: 'Mulch Rings', signature: { name: 'Evergreen Chorus', desc: 'Each Evergreen Sapling lifts all income by 1%.', effects: [add('syn.saplingAll', 0.01)] }, second: 'Ancient Cones' },
};

function buildingUpgrades(): UpgradeDef[] {
  const out: UpgradeDef[] = [];
  for (const [id, line] of Object.entries(LINES)) {
    const def = BUILDING_BY_ID[id];
    const cat = def.cat;
    // Buildings that only give bonuses get stronger bonuses instead of more dew.
    const what = def.base ? 'productive' : 'effective';
    const plain = (tier: 0 | 2, name: string): UpgradeDef => ({
      id: `b_${id}_${tier + 1}`,
      name,
      cat,
      desc: `${def.name}s are ${TIER_MULT[tier] === 2 ? 'twice' : 'three times'} as ${what}.`,
      cost: forBuilding(id, tierOf(id, tier).factor),
      req: [{ building: [id, tierOf(id, tier).owned] }],
      effects: def.base ? [mul(`b.${id}`, TIER_MULT[tier])] : BONUS_ONLY[id](TIER_MULT[tier]),
      icon: def.icon,
    });
    out.push(plain(0, line.first));
    out.push({ id: `b_${id}_2`, name: line.signature.name, cat, desc: line.signature.desc, cost: forBuilding(id, tierOf(id, 1).factor), req: [{ building: [id, tierOf(id, 1).owned] }], effects: line.signature.effects, icon: def.icon });
    out.push(plain(2, line.second));
  }
  return out;
}

/** What "twice as effective" means for buildings that make no dew of their own. */
const BONUS_ONLY: Record<string, (factor: number) => Effect[]> = {
  moonpool: (factor) => [mul('syn.moonAll', factor)],
  sapling: (factor) => [mul('saplingTokens', factor)],
};

/* ───────────────────────────── Synergies ───────────────────────────── */

const SYNERGY: UpgradeDef[] = [
  { id: 'y_chorus', name: 'Morning Chorus', cat: 'synergy', desc: 'Sproutling Burrows are 1% better per Dew Fern.', cost: forLand('garden', 10), req: [{ building: ['burrow', 5] }, { building: ['fern', 15] }], effects: [add('syn.burrowFern', 0.01)], icon: 'sproutling_0' },
  { id: 'y_spore', name: 'Spore Trade', cat: 'synergy', desc: 'Glowcaps +2% per Mossling Den, and Dens +1% per Glowcap Ring.', cost: forBuilding('den', 8), req: [{ building: ['glowcap', 10] }, { building: ['den', 5] }], effects: [add('syn.sporeA', 0.02), add('syn.sporeB', 0.01)], icon: 'shroom_red' },
  { id: 'y_ferry', name: 'Ferry Routes', cat: 'synergy', desc: 'Lily Gardens are 3% better per Dew Skiff.', cost: forBuilding('skiff', 10), req: [{ building: ['skiff', 5] }, { building: ['lily', 10] }], effects: [add('syn.lilySkiff', 0.03)], icon: 'skiff_0' },
  { id: 'y_pollination', name: 'Pollination', cat: 'synergy', desc: 'Bees help flowers twice as much (+4% per hive).', cost: forBuilding('hive', 6), req: [{ building: ['hive', 5] }], effects: [add('syn.hivePetal', 0.02)], icon: 'bee_0' },
  { id: 'y_honeydew', name: 'Honeyed Dew', cat: 'synergy', desc: 'Bees visit the clearing: Ferns and Burrows +3% per Beehive.', cost: forBuilding('hive', 20), req: [{ building: ['hive', 10] }], effects: [add('syn.hiveFern', 0.03)], icon: 'hive_0' },
  { id: 'y_cross', name: 'Cross-Pollination', cat: 'synergy', desc: 'Flowers and bees help each other 2% more.', cost: forBuilding('nest', 8), req: [{ building: ['nest', 5] }], effects: [add('syn.flowerPollen', 0.02), add('syn.hivePetal', 0.02)], icon: 'flutterling_0' },
  { id: 'y_roots', name: 'Root Network', cat: 'synergy', desc: 'Dew Ferns are 1% better for every building you own.', cost: forLand('hamlet', 0.5), req: [{ buildings: 150 }], effects: [add('syn.fernAll', 0.01)], icon: 'fern_1' },
  { id: 'y_nightshift', name: 'Night Shift', cat: 'synergy', desc: 'Everything gathers 25% more at night.', cost: forBuilding('lantern', 4), req: [{ building: ['lantern', 3] }], effects: [add('nightAll', 0.25)], icon: 'ic_moon' },
  { id: 'y_balance', name: 'Balanced Ecosystem', cat: 'synergy', desc: 'Harmony is half again as strong.', cost: forLand('hamlet', 30), req: [{ upgrade: 'w_chime' }], effects: [mul('harmony', 1.5)], icon: 'res_harmony' },
  { id: 'y_dawn', name: 'Dawn Chorus', cat: 'synergy', desc: 'For 30 seconds after every sunrise, all income is tripled.', cost: forLand('hill', 4), req: [{ region: 'hill' }], effects: [flag('dawnChorus')], icon: 'ic_sun' },
  { id: 'y_harvest', name: 'Harvest Festival', cat: 'synergy', desc: 'Farm Plots are 5% better per Windmill.', cost: forBuilding('farm', 12), req: [{ building: ['farm', 10] }, { building: ['windmill', 5] }], effects: [add('syn.windFarm', 0.05)], icon: 'pumpkin' },
  { id: 'y_moonlit', name: 'Moonlit Gardens', cat: 'synergy', desc: 'Flowers open for the moon: all flower patches work double at night.', cost: forBuilding('roost', 6), req: [{ building: ['roost', 5] }], effects: FLOWERS.map((id) => add(`nightBoost.${id}`, 1)), icon: 'bed_1' },
  { id: 'y_canopy', name: 'Canopy Chorus', cat: 'synergy', desc: 'Creature homes are 2% better per Treehouse.', cost: forBuilding('treehouse', 10), req: [{ building: ['treehouse', 5] }], effects: [add('syn.treeFauna', 0.02)], icon: 'owl_0' },
  { id: 'y_resonant', name: 'Resonant Gardens', cat: 'synergy', desc: 'Harmony is 40% stronger.', cost: forLand('woods', 6), req: [{ upgrade: 'y_balance' }, { region: 'woods' }], effects: [mul('harmony', 1.4)], icon: 'res_harmony' },
  { id: 'y_stargaze', name: 'Stargazing Sprouts', cat: 'synergy', desc: 'Creatures stay up to watch the sky. All creature homes ×2.', cost: forBuilding('observatory', 4), req: [{ building: ['observatory', 1] }], effects: [mul('cat.fauna', 2)], icon: 'sproutling_4' },
];

/* ───────────────────────────── World features ───────────────────────────── */

const WORLD: UpgradeDef[] = [
  { id: 'w_butterflies', name: 'Butterfly Bushes', cat: 'world', desc: 'Butterflies fill the air. All flower patches +25%.', cost: forBuilding('bed', 6), req: [{ building: ['bed', 5] }], effects: [...boost(FLOWERS, 1.25), flag('butterflies')], icon: 'butterfly_0_0' },
  { id: 'w_cloud', name: 'Little Rain Cloud', cat: 'world', desc: 'A small cloud of your own. Drag it over your world: whatever it rains on works twice as hard for a while.', cost: forLand('garden', 4), req: [{ region: 'garden' }], effects: [flag('cloud')], icon: 'raincloud' },
  { id: 'w_stones', name: 'Stepping Stones', cat: 'world', desc: 'Creatures get around faster. All creature homes +25%.', cost: forLand('grove', 4), req: [{ region: 'grove' }], effects: [mul('cat.fauna', 1.25), flag('steppingStones')], icon: 'stepstone' },
  { id: 'w_fountain', name: 'Garden Fountain', cat: 'world', desc: 'A fountain for the garden. All flower patches +50%.', cost: forBuilding('trellis', 30), req: [{ building: ['bed', 15] }], effects: [...boost(FLOWERS, 1.5), flag('fountain')], icon: 'fountain_0' },
  { id: 'w_ducks', name: 'Duck Pond', cat: 'world', desc: 'Ducks paddle in. All income +10%.', cost: forLand('pond', 1.5), req: [{ region: 'pond' }], effects: [mul('all', 1.1), flag('ducks')], icon: 'duck_0' },
  { id: 'w_wheel', name: 'Water Wheel', cat: 'world', desc: 'A wheel turns by the pond. Lily Gardens and Skiffs ×2.', cost: forBuilding('skiff', 6), req: [{ building: ['lily', 5] }], effects: [mul('b.lily', 2), mul('b.skiff', 2), flag('waterWheel')], icon: 'wheel_0' },
  { id: 'w_birdbath', name: 'Bird Baths', cat: 'world', desc: 'More birds visit. All income +10%.', cost: forLand('meadow', 3), req: [{ region: 'meadow' }], effects: [mul('all', 1.1), flag('birdbaths')], icon: 'birdbath' },
  { id: 'w_chime', name: 'Harmony Chime', cat: 'world', desc: 'Awakens Harmony: up to +100% income when plants, creatures, crafts and magic are owned in even numbers.', cost: forLand('hamlet', 2), req: [{ region: 'hamlet' }], effects: [add('harmony', 1), flag('harmony')], icon: 'chime' },
  { id: 'w_sundial', name: 'Season Sundial', cat: 'world', desc: 'Lets you Turn the Season: start over and earn Evergreen Tokens. Also adds 10% to the tokens a season yields.', cost: forLand('hamlet', 8), req: [{ region: 'hamlet' }, { building: ['cottage', 3] }], effects: [flag('sundial'), mul('token', 1.1)], icon: 'sundial' },
  { id: 'w_well', name: 'Wishing Well', cat: 'world', desc: 'Luck +25% and treasures are worth 50% more.', cost: forBuilding('cottage', 12), req: [{ building: ['cottage', 5] }], effects: [add('luck', 0.25), mul('treasure', 1.5), flag('well')], icon: 'well' },
  { id: 'w_lanternpaths', name: 'Lantern Paths', cat: 'world', desc: 'Lanterns line the paths. Lantern Posts ×2.', cost: forBuilding('lantern', 14), req: [{ building: ['lantern', 8] }], effects: [mul('b.lantern', 2), flag('lanternPaths')], icon: 'lantern' },
  { id: 'w_dock', name: 'Market Dock', cat: 'world', desc: 'The travelling merchant visits twice as often.', cost: forLand('hamlet', 5), req: [{ region: 'hamlet' }, { building: ['skiff', 3] }], effects: [mul('rate.merchant', 2), flag('dock')], icon: 'dock' },
  { id: 'w_campfire', name: 'Hamlet Campfire', cat: 'world', desc: 'Creatures gather by the fire. All creature homes +50%.', cost: forBuilding('cottage', 40), req: [{ building: ['cottage', 10] }], effects: [mul('cat.fauna', 1.5), flag('campfire')], icon: 'campfire_0' },
  { id: 'w_scarecrow', name: 'Friendly Scarecrow', cat: 'world', desc: 'Keeps watch over the crops. Farm Plots ×2.', cost: forBuilding('farm', 5), req: [{ building: ['farm', 3] }], effects: [mul('b.farm', 2), flag('scarecrow')], icon: 'scarecrow' },
  { id: 'w_weathervane', name: 'Weathervane', cat: 'world', desc: 'Always know which way the wind blows. Windmills ×2.', cost: forBuilding('windmill', 8), req: [{ building: ['windmill', 3] }], effects: [mul('b.windmill', 2), flag('weathervane')], icon: 'ic_compass' },
  { id: 'w_owlpost', name: 'Owl Post', cat: 'world', desc: 'Owls keep the world running while you rest. Offline progress +25%.', cost: forBuilding('treehouse', 5), req: [{ building: ['treehouse', 3] }], effects: [add('offline', 0.25), flag('owls')], icon: 'owl_0' },
  { id: 'w_runes', name: 'Rune Circle', cat: 'world', desc: 'Standing stones hum at night. All night-gatherers ×2.', cost: forLand('rise', 4), req: [{ region: 'rise' }], effects: [...boost(NIGHTFOLK, 2), flag('runeCircle')], icon: 'rune_on' },
  {
    id: 'w_everbloom',
    name: 'The Everbloom',
    cat: 'world',
    desc: 'Wake the Elder Tree into full bloom. The heart of Little Elsewhere opens: the end of the story, though not of the world.',
    cost: forLand('heartwood', 8),
    req: [{ region: 'heartwood' }, { building: ['shrine', 5] }],
    effects: [flag('everbloom'), mul('all', 2)],
    icon: 'elder_bloom',
    ending: true,
  },
];

/* ───────────────────────────── Creatures ───────────────────────────── */

const FAUNA: UpgradeDef[] = [
  { id: 'c_quick', name: 'Quick Little Feet', cat: 'fauna', desc: 'Creatures hurry about their work. All creature homes +30%.', cost: forBuilding('den', 20), req: [{ building: ['den', 10] }], effects: [mul('cat.fauna', 1.3), flag('quickFeet')], icon: 'mossling_2' },
  { id: 'c_naps', name: 'Nap Time', cat: 'fauna', desc: 'Well-rested creatures keep working while you are away. Offline progress +25%.', cost: forBuilding('burrow', 600), req: [{ building: ['burrow', 20] }], effects: [add('offline', 0.25)], icon: 'emote_zzz' },
  { id: 'c_bees', name: 'Busy Bees', cat: 'fauna', desc: 'Hives and Flutterling Nests ×2.', cost: forBuilding('nest', 20), req: [{ building: ['hive', 15] }, { building: ['nest', 5] }], effects: boost(BEEFOLK, 2), icon: 'bee_1' },
  { id: 'c_festival', name: 'Creature Festival', cat: 'fauna', desc: 'A world-wide party. All creature homes +50%.', cost: forLand('hamlet', 1), req: [{ building: ['burrow', 15] }, { building: ['den', 10] }, { building: ['hive', 10] }], effects: [mul('cat.fauna', 1.5), flag('festival')], icon: 'emote_heart' },
  { id: 'c_friends', name: 'Friendly Faces', cat: 'fauna', desc: 'Shy visitors come by twice as often.', cost: forLand('hamlet', 0.6), req: [{ region: 'hamlet' }], effects: [mul('rate.visitor', 2)], icon: 'gloamcat_0' },
  { id: 'c_songs', name: 'Work Songs', cat: 'fauna', desc: 'Creature homes +50%, crafts +20%.', cost: forBuilding('cottage', 25), req: [{ building: ['cottage', 8] }], effects: [mul('cat.fauna', 1.5), mul('cat.craft', 1.2)], icon: 'emote_note' },
];

/* ───────────────────────────── Abilities ───────────────────────────── */

const ABILITY: UpgradeDef[] = [
  { id: 'a_rain', name: 'Rain Dance', cat: 'ability', desc: 'Unlocks Rain Dance: call a shower that triples all plants for a while.', cost: forBuilding('bed', 60), req: [{ building: ['bed', 10] }], effects: [flag('ability_rain')], icon: 'res_dew' },
  { id: 'a_surge', name: 'Spring Surge', cat: 'ability', desc: 'Unlocks Spring Surge: taps are worth ×10 for a short while.', cost: forLand('pond', 5), req: [{ upgrade: 's_flow' }], effects: [flag('ability_surge')], icon: 'ic_bolt' },
  { id: 'a_bloom', name: 'Bloom Burst', cat: 'ability', desc: 'Unlocks Bloom Burst: instantly gather two minutes of income.', cost: forBuilding('hive', 14), req: [{ building: ['hive', 5] }], effects: [flag('ability_bloom')], icon: 'res_petals' },
  { id: 'a_moon', name: 'Moonrise', cat: 'ability', desc: 'Unlocks Moonrise: bring on the night whenever you like.', cost: forBuilding('lantern', 10), req: [{ building: ['lantern', 5] }], effects: [flag('ability_moon')], icon: 'ic_moon' },
  { id: 'a_call', name: 'Gathering Call', cat: 'ability', desc: 'Unlocks Gathering Call: every creature works three times as hard.', cost: forLand('hamlet', 10), req: [{ upgrade: 'w_chime' }], effects: [flag('ability_call')], icon: 'ic_paw' },
  { id: 'a_rain2', name: 'Thunderheads', cat: 'ability', desc: 'Abilities last 25% longer.', cost: forLand('hamlet', 4), req: [{ upgrade: 'a_rain' }, { region: 'hamlet' }], effects: [mul('abilityDur', 1.25)], icon: 'ic_hourglass' },
  { id: 'a_bloom2', name: 'Second Bloom', cat: 'ability', desc: 'Abilities recharge 15% faster.', cost: forLand('hill', 3), req: [{ upgrade: 'a_bloom' }, { region: 'hill' }], effects: [mul('abilityCd', 0.85)], icon: 'ic_hourglass' },
  { id: 'a_surge2', name: 'Geyser', cat: 'ability', desc: 'Spring Surge is twice as strong.', cost: forLand('hill', 6), req: [{ upgrade: 'a_surge' }, { region: 'hill' }], effects: [mul('surgeMult', 2)], icon: 'ic_bolt' },
  { id: 'a_moon2', name: 'Long Moonrise', cat: 'ability', desc: 'Nights are longer and abilities last 20% longer.', cost: forLand('rise', 3), req: [{ upgrade: 'a_moon' }, { region: 'rise' }], effects: [add('nightLen', 0.08), mul('abilityDur', 1.2)], icon: 'ic_moon' },
  { id: 'a_call2', name: 'Rally Horn', cat: 'ability', desc: 'Abilities recharge 20% faster.', cost: forLand('woods', 4), req: [{ upgrade: 'a_call' }, { region: 'woods' }], effects: [mul('abilityCd', 0.8)], icon: 'ic_paw' },
];

export const UPGRADES: UpgradeDef[] = [...SPRING, ...buildingUpgrades(), ...SYNERGY, ...WORLD, ...FAUNA, ...ABILITY];
export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
