import { add, boost, mul } from '@/game/effects';
import type { BlessingDef, ConstellationDef, WonderDef } from '@/game/types';
import { BEEFOLK, FLOWERS, NIGHTFOLK } from './buildings';

/**
 * Wonders grow from mysterious seeds. Each lasts for the season it sprouts in
 * (or longer, with a Keepsake Shelf). The matching art is `wonder_<id>`.
 */
export const WONDERS: WonderDef[] = [
  { id: 'singing_tree', name: 'Singing Tree', text: 'Its leaves hum in thirds. Harmony is 50% stronger.', effects: [mul('harmony', 1.5), mul('all', 1.15)] },
  { id: 'bubble_bloom', name: 'Bubble Bloom', text: 'A flower holding one perfect bubble. Taps ×5.', effects: [mul('click', 5)] },
  { id: 'lantern_vine', name: 'Lantern Vine', text: 'Fruit that glows at noon. Night-gatherers keep working by day at 30% strength.', effects: [add('starDay', 0.3)] },
  { id: 'clockwork_rose', name: 'Clockwork Rose', text: 'It ticks. Time itself runs 10% faster.', effects: [mul('speed', 1.1)] },
  { id: 'honey_fountain', name: 'Honey Fountain', text: 'Nobody knows who fills it. Hives and nests ×3.', effects: boost(BEEFOLK, 3) },
  { id: 'rainbow_cap', name: 'Rainbow Cap', text: 'A toadstool in every colour at once. All income +50%.', effects: [mul('all', 1.5)] },
  { id: 'cloud_cotton', name: 'Cloud Cotton', text: 'Soft as a nap. All income +25% and offline progress +25%.', effects: [mul('all', 1.25), add('offline', 0.25)] },
  { id: 'moon_lily', name: 'Moon Lily', text: 'Opens only after dark. Nights are longer and night-gatherers +50%.', effects: [add('nightLen', 0.1), ...boost(NIGHTFOLK, 1.5)] },
  { id: 'golden_acorn', name: 'Golden Acorn', text: 'A promise of forests. Evergreen Tokens +8%.', effects: [mul('token', 1.08)] },
  { id: 'whisper_reed', name: 'Whisper Reed', text: 'It tells secrets to the wind. Events come 50% more often.', effects: [mul('eventRate', 1.5)] },
];
export const WONDER_BY_ID: Record<string, WonderDef> = Object.fromEntries(WONDERS.map((w) => [w.id, w]));

/** With Seasonal Blessings, three of these are offered at the start of every season. */
export const BLESSINGS: BlessingDef[] = [
  { id: 'bees', name: 'Season of Bees', desc: 'Hives and Flutterling Nests ×4.', icon: 'bee_0', effects: boost(BEEFOLK, 4) },
  { id: 'bloom', name: 'Season of Blossoms', desc: 'All flower patches ×4.', icon: 'res_petals', effects: boost(FLOWERS, 4) },
  { id: 'tides', name: 'Season of Tides', desc: 'All income ×2.', icon: 'res_dew', effects: [mul('all', 2)] },
  { id: 'stars', name: 'Season of Stars', desc: 'Nights are far longer and night-gatherers ×2.', icon: 'res_starlight', effects: [add('nightLen', 0.18), ...boost(NIGHTFOLK, 2)] },
  { id: 'stone', name: 'Season of Stone', desc: 'Every building costs 35% less.', icon: 'rock_1', effects: [mul('cost', 0.65)] },
  { id: 'kin', name: 'Season of Kin', desc: 'All creature homes ×3.', icon: 'ic_paw', effects: [mul('cat.fauna', 3)] },
  { id: 'luck', name: 'Season of Fortune', desc: 'Events come twice as often and Luck +100%.', icon: 'ic_clover', effects: [mul('eventRate', 2), add('luck', 1)] },
  { id: 'echoes', name: 'Season of Echoes', desc: 'Evergreen Tokens +20%.', icon: 'res_evergreen', effects: [mul('token', 1.2)] },
];
export const BLESSING_BY_ID: Record<string, BlessingDef> = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));
export const BLESSING_CHOICES = 3;

/**
 * Permanent gifts from the night sky, bought with Dew once Star Charts is owned —
 * somewhere to pour a strong season's surplus. x/y place them on the chart (0..1).
 */
export const CONSTELLATIONS: ConstellationDef[] = [
  { id: 'sprout', name: 'The Sprout', desc: 'All income +25%.', cost: 1e13, effects: [mul('all', 1.25)], x: 0.16, y: 0.72 },
  { id: 'kettle', name: 'The Kettle', desc: 'All income +25%.', cost: 1e14, effects: [mul('all', 1.25)], x: 0.3, y: 0.42 },
  { id: 'moth', name: 'The Moth', desc: 'Night-gatherers ×2.', cost: 1e15, effects: boost(NIGHTFOLK, 2), x: 0.46, y: 0.7 },
  { id: 'twins', name: 'The Twins', desc: 'Harmony is 50% stronger.', cost: 1e16, effects: [mul('harmony', 1.5)], x: 0.56, y: 0.3 },
  { id: 'lantern', name: 'The Lantern', desc: 'Nights are longer.', cost: 1e17, effects: [add('nightLen', 0.1)], x: 0.7, y: 0.58 },
  { id: 'wheel', name: 'The Wheel', desc: 'Buildings cost 10% less.', cost: 1e18, effects: [mul('cost', 0.9)], x: 0.84, y: 0.3 },
  { id: 'fox', name: 'The Fox', desc: 'Luck +50%.', cost: 1e19, effects: [add('luck', 0.5)], x: 0.86, y: 0.76 },
  { id: 'river', name: 'The River', desc: 'Taps ×10.', cost: 1e20, effects: [mul('click', 10)], x: 0.42, y: 0.16 },
  { id: 'crown', name: 'The Crown', desc: 'Evergreen Tokens +25%.', cost: 1e21, effects: [mul('token', 1.25)], x: 0.68, y: 0.12 },
  { id: 'evergreen', name: 'The Evergreen', desc: 'All income ×3.', cost: 1e22, effects: [mul('all', 3)], x: 0.14, y: 0.22 },
];
export const CONSTELLATION_BY_ID: Record<string, ConstellationDef> = Object.fromEntries(CONSTELLATIONS.map((c) => [c.id, c]));
