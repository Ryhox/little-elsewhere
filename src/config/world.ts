/**
 * The map: where every land sits, what it is made of, and where things go on it.
 * All coordinates are in world pixels; positions inside a region are relative to its centre.
 * Nothing here is drawn by hand: terrain, bridges and decoration are generated from this data.
 */

export type Point = readonly [number, number];
/** An ellipse of land or water: [x, y, radiusX, radiusY]. */
export type Blob = readonly [number, number, number, number];
/** Ground looks are defined in config/palette.ts (GROUNDS). */
export type Ground = 'grass' | 'moss' | 'meadow' | 'sand' | 'sky';

/** A hand-placed prop. `flag` hides it until an upgrade sets that flag. */
export interface PropDef {
  sprite: string;
  at: Point;
  flag?: string;
  /** Animated props cycle `sprite_0 … sprite_{frames-1}`. */
  frames?: number;
  fps?: number;
  /** Lies flat on the ground (drawn under everything, casts no shadow). */
  flat?: boolean;
  /** Journal secret discovered by clicking it. */
  secret?: string;
  /** Extra sprite stacked on top, e.g. a water wheel: [sprite prefix, frames, dx, dy]. */
  spinner?: readonly [string, number, number, number];
}

/** Where procedural decoration may grow. */
export type Zone = 'rim' | 'inner' | 'any' | 'pond' | 'shore';

/** A rule for scattering decoration. */
export interface ScatterDef {
  sprites: readonly string[];
  count: number;
  zone: Zone;
  /** Minimum distance to anything else, px. */
  gap: number;
  /** Sways in the wind. */
  sway?: boolean;
  /** Dies back in winter. */
  tender?: boolean;
  flat?: boolean;
  /** Only appears once a flag is set (e.g. wildflowers everywhere). */
  flag?: string;
}

export interface RegionLayout {
  id: string;
  at: Point;
  ground: Ground;
  land: readonly Blob[];
  ponds?: readonly Blob[];
  /** Streams: a polyline and its width. They cut water into the land and flow along the line. */
  streams?: readonly { line: readonly Point[]; width: number }[];
  /** Dirt paths, as polylines. */
  paths?: readonly (readonly Point[])[];
  /** Where creatures gather and roads meet. */
  hub: Point;
  /** Hovers above the sea instead of standing in it. */
  floating?: boolean;
  /** Where each kind of building appears, in the order copies are bought. */
  slots: Record<string, readonly Point[]>;
  props?: readonly PropDef[];
  scatter: readonly ScatterDef[];
}

/** A bridge between two lands, running along one axis at a fixed world coordinate. */
export interface LinkDef {
  a: string;
  b: string;
  axis: 'h' | 'v';
  at: number;
}

/* ───────────────────────────── Placement helpers ───────────────────────────── */

const ring = (cx: number, cy: number, rx: number, ry: number, n: number, phase = 0): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry)] as const;
  });

const grid = (x: number, y: number, cols: number, rows: number, dx: number, dy: number, stagger = 0): Point[] => {
  const out: Point[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x + c * dx + (r % 2) * stagger, y + r * dy]);
  return out;
};

const TREES = ['oak_0', 'oak_1', 'oak_2', 'birch_0', 'birch_1'];
const PINES = ['pine_0', 'pine_1', 'pine_2'];
const BUSHES = ['bush_0', 'bush_1', 'bush_berry', 'bush_bloom', 'bush_blue'];
const FLOWERS = ['flower_tulip_red', 'flower_tulip_gold', 'flower_tulip_pink', 'flower_daisy', 'flower_daisy_pink', 'flower_bell', 'flower_poppy', 'flower_poppy_gold', 'flower_lavender'];
const ROCKS = ['rock_0', 'rock_1', 'rock_2'];
const TUFTS = ['tuft_0', 'tuft_1', 'tuft_2'];
const SHROOMS = ['shroom_red', 'shroom_pink', 'shroom_gold'];

const tufts = (count: number): ScatterDef => ({ sprites: TUFTS, count, zone: 'any', gap: 5, sway: true, tender: true, flat: true });
const wildflowers = (count: number): ScatterDef => ({ sprites: FLOWERS, count, zone: 'any', gap: 7, sway: true, tender: true });
/** Extra blooms that appear everywhere once Wildflowers is owned. */
const bonusFlowers = (count: number): ScatterDef => ({ ...wildflowers(count), flag: 'wildflowers' });

/* ───────────────────────────── The world ───────────────────────────── */

export const WORLD = {
  width: 1640,
  height: 1080,
  /** Height of the earthy cliff where land meets the sea, px. */
  cliff: 7,
  /** How far a floating island's rocky underside hangs down, and how high it hovers. */
  floatDepth: 26,
  floatHeight: 18,
  /** Seed for all procedural layout. Change it for a differently-decorated world. */
  seed: 4127,
  /** Where the spring sits inside the Clearing, and where Wonders and the seed plot appear. */
  spring: [0, -4] as Point,
  seedPlot: ['clearing', [-74, -30]] as readonly [string, Point],
  wonderSpots: [
    ['clearing', [70, 34]],
    ['clearing', [-52, 48]],
    ['garden', [64, -44]],
    ['garden', [-84, 30]],
    ['grove', [62, 44]],
    ['meadow', [-70, -34]],
  ] as readonly (readonly [string, Point])[],
  /** Where the merchant parks his cart: [region, position]. */
  merchantSpot: ['pond', [96, -34]] as readonly [string, Point],
};

export const REGION_LAYOUTS: RegionLayout[] = [
  {
    id: 'clearing',
    at: [820, 545],
    ground: 'grass',
    land: [[0, 0, 122, 84], [-64, 28, 66, 50], [72, -22, 70, 56]],
    streams: [{ line: [[10, -8], [38, -30], [74, -44], [112, -62]], width: 7 }],
    paths: [[[-122, 8], [-60, 24], [0, 40]], [[122, 14], [62, 28], [0, 40]], [[0, 40], [4, 86]], [[0, 40], [-34, 14], [-30, -40], [-6, -86]]],
    hub: [0, 40],
    slots: {
      fern: [...ring(0, -2, 44, 25, 9, 0.7).filter(([x, y]) => !(x > 8 && y < -8)), ...ring(0, 0, 66, 40, 10, 2.4).filter(([x, y]) => !(x > 10 && y < -10) && Math.abs(x) > 12)],
      burrow: [[-92, -10], [86, 40], [-84, 46], [40, 64], [-28, 66], [100, -4]],
    },
    props: [
      { sprite: 'signpost', at: [14, 60] },
      { sprite: 'stepstone', at: [-14, 30], flat: true, flag: 'steppingStones' },
      { sprite: 'stepstone', at: [20, 46], flat: true, flag: 'steppingStones' },
    ],
    scatter: [
      { sprites: TREES, count: 9, zone: 'rim', gap: 20, sway: true },
      { sprites: ['blossom'], count: 2, zone: 'rim', gap: 24, sway: true },
      { sprites: BUSHES, count: 7, zone: 'rim', gap: 14, sway: true },
      { sprites: ROCKS, count: 4, zone: 'any', gap: 14 },
      wildflowers(16),
      bonusFlowers(14),
      tufts(40),
    ],
  },
  {
    id: 'garden',
    at: [1100, 545],
    ground: 'meadow',
    land: [[0, 0, 118, 88], [42, -40, 62, 42]],
    paths: [[[-118, 14], [-40, 20], [0, 16]], [[0, 16], [8, 88]], [[0, 16], [10, -40], [6, -82]]],
    hub: [0, 16],
    slots: {
      bed: [...grid(-86, -34, 3, 2, 30, 26), ...grid(24, 44, 3, 1, 30, 0), ...grid(-88, 48, 2, 1, 30, 0), [-26, 62]],
      trellis: [[40, -46], [70, -30], [88, 6], [-60, -62], [72, 32], [-96, 16]],
    },
    props: [
      { sprite: 'fountain', at: [34, -2], frames: 2, fps: 4, flag: 'fountain' },
      { sprite: 'bench', at: [-24, -8] },
      { sprite: 'birdbath', at: [58, 62], flag: 'birdbaths' },
    ],
    scatter: [
      { sprites: ['blossom', 'fruit_tree', 'oak_0'], count: 8, zone: 'rim', gap: 22, sway: true },
      { sprites: ['bush_bloom', 'bush_berry', 'bush_0'], count: 9, zone: 'rim', gap: 14, sway: true },
      wildflowers(30),
      bonusFlowers(20),
      tufts(34),
    ],
  },
  {
    id: 'grove',
    at: [540, 535],
    ground: 'moss',
    land: [[0, 0, 118, 92], [-52, -30, 62, 52]],
    paths: [[[118, 10], [50, 20], [0, 14]], [[0, 14], [4, 92]], [[0, 14], [-8, -40], [-4, -90]], [[0, 14], [-70, 20], [-118, 6]]],
    hub: [0, 14],
    slots: {
      glowcap: [[-40, -18], [34, -24], [-72, 20], [62, 48], [-24, 52], [20, 50], [78, -8], [-88, -34], [-50, 60], [46, 12], [-16, -58], [86, 24]],
      den: [[-64, -52], [56, -52], [-92, 46], [84, 58], [-30, 22], [28, -62]],
    },
    props: [{ sprite: 'log', at: [-8, 72] }, { sprite: 'stump', at: [70, -34] }],
    scatter: [
      { sprites: ['shroomtree_0', 'shroomtree_1', 'shroomtree_2', 'shroomtree_3'], count: 9, zone: 'rim', gap: 22 },
      { sprites: ['oak_1', 'willow', 'pine_1'], count: 5, zone: 'rim', gap: 22, sway: true },
      { sprites: SHROOMS, count: 22, zone: 'any', gap: 9 },
      { sprites: ['bush_1', 'bush_blue'], count: 5, zone: 'rim', gap: 14, sway: true },
      { sprites: ROCKS, count: 4, zone: 'any', gap: 14 },
      bonusFlowers(12),
      tufts(30),
    ],
  },
  {
    id: 'pond',
    at: [540, 790],
    ground: 'grass',
    land: [[0, 0, 142, 98], [-70, -30, 60, 50]],
    ponds: [[4, 10, 76, 42]],
    paths: [[[8, -98], [20, -60], [70, -44], [142, 2]], [[70, -44], [100, -34]]],
    hub: [70, -44],
    slots: {
      lily: [[-40, 0], [20, -12], [50, 16], [-10, 28], [-52, 22], [34, 34], [0, 4], [62, -2], [-24, -14], [12, 40], [-34, 36], [44, -18]],
      skiff: [[-20, 12], [26, 6], [0, 30], [46, 26], [-44, 10], [8, -8]],
    },
    props: [
      { sprite: 'wheelhouse', at: [96, 26], flag: 'waterWheel', spinner: ['wheel', 4, -16, -8] },
      { sprite: 'dock', at: [-62, 54], flat: true, flag: 'dock' },
      { sprite: 'bench', at: [-96, -40] },
      { sprite: 'barrel', at: [112, -36] },
    ],
    scatter: [
      { sprites: ['willow', 'oak_0', 'birch_0'], count: 8, zone: 'rim', gap: 24, sway: true },
      { sprites: ['reeds_0', 'reeds_1'], count: 16, zone: 'shore', gap: 7, sway: true, tender: true },
      { sprites: ['lilypad_0', 'lilypad_1', 'lilypad_2'], count: 8, zone: 'pond', gap: 12, flat: true, tender: true },
      { sprites: BUSHES, count: 6, zone: 'rim', gap: 14, sway: true },
      { sprites: ROCKS, count: 5, zone: 'shore', gap: 12 },
      wildflowers(12),
      bonusFlowers(12),
      tufts(34),
    ],
  },
  {
    id: 'meadow',
    at: [1110, 790],
    ground: 'meadow',
    land: [[0, 0, 124, 90], [50, 34, 60, 44]],
    paths: [[[-124, 4], [-50, 6], [0, 0]], [[0, 0], [-4, -90]], [[0, 0], [70, -8], [124, -14]]],
    hub: [0, 0],
    slots: {
      hive: [[-70, -40], [-40, -54], [44, -48], [78, -30], [-84, 34], [-44, 48], [36, 44], [84, 30], [-14, -62], [10, 60]],
      nest: [[-96, -8], [60, 12], [-22, 28], [96, 56], [24, -24], [-60, 66]],
    },
    props: [{ sprite: 'fence', at: [-30, -28] }, { sprite: 'fence', at: [-14, -28] }, { sprite: 'haybale', at: [62, 66] }],
    scatter: [
      { sprites: ['oak_0', 'oak_2', 'fruit_tree', 'birch_1'], count: 6, zone: 'rim', gap: 26, sway: true },
      { sprites: ['flower_sunflower', ...FLOWERS], count: 54, zone: 'any', gap: 7, sway: true, tender: true },
      bonusFlowers(24),
      { sprites: ['bush_bloom', 'bush_0'], count: 5, zone: 'rim', gap: 14, sway: true },
      tufts(40),
    ],
  },
  {
    id: 'hamlet',
    at: [830, 795],
    ground: 'grass',
    land: [[0, 0, 132, 96], [62, -32, 62, 52]],
    paths: [[[-6, -96], [-2, -40], [0, 4]], [[0, 4], [-70, 10], [-132, 2]], [[0, 4], [70, 0], [132, -4]], [[0, 4], [0, 60]]],
    hub: [0, 4],
    slots: {
      cottage: [[-74, -22], [58, -32], [-90, 48], [84, 44], [-36, -54], [26, 66], [100, -48], [-40, 74]],
      workshop: [[30, -66], [-104, 8], [112, 8], [-4, -76]],
      lantern: [[-22, -16], [22, -14], [-50, 22], [50, 18], [-12, 44], [14, 86], [-100, -18], [96, 18], [-64, 66], [66, 78], [-18, -84], [78, -74]],
    },
    props: [
      { sprite: 'chime', at: [-28, 34], flag: 'harmony', secret: 's_chime' },
      { sprite: 'sundial', at: [28, 36], flag: 'sundial', flat: true },
      { sprite: 'well', at: [44, -8], flag: 'well' },
      { sprite: 'campfire', at: [-58, -4], frames: 2, fps: 8, flag: 'campfire' },
      { sprite: 'tavern_table', at: [-76, 6], flag: 'campfire' },
      { sprite: 'crate', at: [66, 8] },
      { sprite: 'barrel', at: [-18, -40] },
    ],
    scatter: [
      { sprites: ['oak_0', 'oak_2', 'pine_1', 'fruit_tree'], count: 7, zone: 'rim', gap: 26, sway: true },
      { sprites: BUSHES, count: 6, zone: 'rim', gap: 14, sway: true },
      wildflowers(10),
      bonusFlowers(12),
      tufts(30),
    ],
  },
  {
    id: 'hill',
    at: [820, 300],
    ground: 'meadow',
    land: [[0, 0, 128, 90], [-56, 24, 64, 48]],
    paths: [[[4, 90], [2, 40], [0, 10]], [[0, 10], [-70, 4], [-128, -4]], [[0, 10], [70, 2], [128, -6]]],
    hub: [0, 10],
    slots: {
      windmill: [[-60, -30], [56, -36], [-96, 30], [96, 26], [0, -56]],
      farm: [...grid(-46, 44, 3, 2, 34, 22), [70, 58], [-90, 62], [28, -14], [-28, -14]],
    },
    props: [
      { sprite: 'scarecrow', at: [38, 34], flag: 'scarecrow', secret: 's_scarecrow' },
      { sprite: 'haybale', at: [-78, -4] },
      { sprite: 'haybale', at: [84, -8] },
      { sprite: 'pumpkin', at: [56, 76] },
      { sprite: 'fence', at: [-58, 26] },
      { sprite: 'fence', at: [62, 22] },
    ],
    scatter: [
      { sprites: ['oak_0', 'birch_0', 'oak_2'], count: 5, zone: 'rim', gap: 28, sway: true },
      { sprites: ROCKS, count: 4, zone: 'rim', gap: 16 },
      wildflowers(14),
      bonusFlowers(12),
      tufts(40),
    ],
  },
  {
    id: 'woods',
    at: [530, 290],
    ground: 'moss',
    land: [[0, 0, 138, 100], [60, 30, 60, 50]],
    paths: [[[0, 100], [6, 50], [4, 14]], [[4, 14], [70, 0], [138, -6]]],
    hub: [4, 14],
    slots: {
      treehouse: [[-62, -4], [58, -30], [-18, -50], [-92, 50], [90, 46]],
      roost: [[-30, 30], [36, 36], [-100, -20], [96, -6], [-56, 62], [18, -18], [-70, -58], [62, 70]],
    },
    props: [{ sprite: 'log', at: [40, 74] }, { sprite: 'stump', at: [-34, 66] }],
    scatter: [
      { sprites: [...PINES, 'oak_1', 'oak_big'], count: 26, zone: 'rim', gap: 15, sway: true },
      { sprites: PINES, count: 6, zone: 'inner', gap: 22, sway: true },
      { sprites: ['bush_1', 'bush_blue'], count: 8, zone: 'any', gap: 14, sway: true },
      { sprites: SHROOMS, count: 8, zone: 'any', gap: 10 },
      bonusFlowers(8),
      tufts(30),
    ],
  },
  {
    id: 'rise',
    at: [1110, 290],
    ground: 'grass',
    land: [[0, 0, 118, 90], [-40, -30, 60, 44]],
    paths: [[[-118, 4], [-50, 8], [0, 6]], [[0, 6], [0, 90]]],
    hub: [0, 6],
    slots: {
      observatory: [[-24, -34], [60, -18], [-78, 16]],
      moonpool: [[36, 40], [-36, 48], [78, 26], [-6, 70]],
    },
    props: [
      ...ring(22, 6, 30, 16, 6, 0.3).map((at): PropDef => ({ sprite: 'rune_on', at, flag: 'runeCircle' })),
      { sprite: 'rock_3', at: [92, -40] },
      { sprite: 'rock_3', at: [-96, -30] },
    ],
    scatter: [
      { sprites: [...PINES, 'birch_1'], count: 8, zone: 'rim', gap: 24, sway: true },
      { sprites: ['rock_0', 'rock_1', 'rock_2', 'rock_3'], count: 9, zone: 'any', gap: 16 },
      { sprites: ['flower_bell', 'flower_lavender'], count: 14, zone: 'any', gap: 8, sway: true, tender: true },
      bonusFlowers(10),
      tufts(26),
    ],
  },
  {
    id: 'isles',
    at: [1410, 420],
    ground: 'sky',
    floating: true,
    land: [[0, 0, 72, 46], [-78, -74, 42, 26], [58, 84, 46, 28]],
    hub: [0, 4],
    slots: {
      crystal: [[-30, -8], [28, -14], [0, 22], [-80, -74], [60, 84], [-52, 14], [50, 12], [-62, -84]],
    },
    props: [{ sprite: 'rune_on', at: [76, 76] }],
    scatter: [
      { sprites: ['blossom', 'birch_0'], count: 4, zone: 'rim', gap: 22, sway: true },
      { sprites: ['flower_bell', 'flower_lavender', 'flower_daisy'], count: 14, zone: 'any', gap: 8, sway: true, tender: true },
      { sprites: ['rock_0', 'rock_2'], count: 4, zone: 'any', gap: 12 },
      tufts(20),
    ],
  },
  {
    id: 'heartwood',
    at: [250, 525],
    ground: 'moss',
    land: [[0, 0, 112, 104], [30, -40, 60, 50]],
    paths: [[[112, 6], [50, 20], [0, 46]]],
    hub: [0, 46],
    slots: {
      shrine: [[-70, 44], [70, 52], [-80, -20], [84, -24], [-30, 80], [36, 82]],
    },
    scatter: [
      { sprites: ['oak_big', 'oak_1', 'willow', ...PINES], count: 14, zone: 'rim', gap: 20, sway: true },
      { sprites: ['bush_1', 'bush_blue', 'bush_bloom'], count: 8, zone: 'rim', gap: 14, sway: true },
      { sprites: SHROOMS, count: 10, zone: 'any', gap: 10 },
      wildflowers(16),
      tufts(30),
    ],
  },
  {
    id: 'shoals',
    at: [1380, 770],
    ground: 'sand',
    land: [[0, 0, 92, 62], [-58, 48, 50, 32], [56, -40, 44, 30]],
    ponds: [[10, 4, 26, 13]],
    paths: [[[-92, 6], [-40, 10], [0, 30]]],
    hub: [0, 30],
    slots: {
      sapling: [[-50, -18], [-22, -34], [48, -40], [62, 14], [-66, 44], [-36, 62], [30, 38], [-6, 34], [74, -52], [-78, 6]],
    },
    props: [{ sprite: 'dock', at: [-96, 22], flat: true }],
    scatter: [
      { sprites: PINES, count: 5, zone: 'rim', gap: 22, sway: true },
      { sprites: ROCKS, count: 8, zone: 'shore', gap: 12 },
      { sprites: ['reeds_0', 'reeds_1'], count: 8, zone: 'shore', gap: 8, sway: true, tender: true },
      tufts(14),
    ],
  },
];

export const LAYOUT_BY_ID: Record<string, RegionLayout> = Object.fromEntries(REGION_LAYOUTS.map((r) => [r.id, r]));

/** How each building looks once placed. Copies cycle through `sprites` so a row of them never looks cloned. */
export interface BuildingLook {
  sprites: readonly string[];
  flat?: boolean;
  sway?: boolean;
  /** Sails on the water instead of standing in a slot (handled by the creature system). */
  afloat?: boolean;
  /** Animated part stacked on top: [sprite prefix, frames, dx, dy, frames per second]. */
  spinner?: readonly [string, number, number, number, number];
}

export const BUILDING_LOOKS: Record<string, BuildingLook> = {
  fern: { sprites: ['fern_0', 'fern_1', 'fern_2'], sway: true },
  burrow: { sprites: ['burrow'] },
  bed: { sprites: ['bed_0', 'bed_1', 'bed_2', 'bed_3'], sway: true },
  trellis: { sprites: ['trellis'] },
  glowcap: { sprites: ['glowcap_0', 'glowcap_1', 'glowcap_2'] },
  den: { sprites: ['den'] },
  lily: { sprites: ['lilies_0', 'lilies_1'], flat: true },
  skiff: { sprites: ['skiff_0', 'skiff_1'], afloat: true },
  hive: { sprites: ['hive_0', 'hive_1', 'hive_0'] },
  nest: { sprites: ['nest'] },
  cottage: { sprites: ['cottage_0', 'cottage_1', 'cottage_2', 'cottage_3'] },
  workshop: { sprites: ['workshop_0', 'workshop_1'] },
  lantern: { sprites: ['lantern'] },
  windmill: { sprites: ['windmill'], spinner: ['blades', 8, 0, -34, 9] },
  farm: { sprites: ['farm_1', 'farm_2', 'farm_3', 'farm_0'], flat: true },
  treehouse: { sprites: ['treehouse'], sway: false },
  roost: { sprites: ['roost'] },
  observatory: { sprites: ['observatory'] },
  moonpool: { sprites: ['moonpool'] },
  crystal: { sprites: ['crystal_0', 'crystal_1'] },
  shrine: { sprites: ['shrine'] },
  sapling: { sprites: ['sapling'], sway: true },
};

/** The Elder Tree stands at the heart of its land once Heartwood is discovered. */
export const ELDER = { region: 'heartwood', at: [0, 8] as Point };

/** Bridges. Each appears once both of its lands are discovered. */
export const LINKS: LinkDef[] = [
  { a: 'clearing', b: 'garden', axis: 'h', at: 559 },
  { a: 'grove', b: 'clearing', axis: 'h', at: 551 },
  { a: 'clearing', b: 'hamlet', axis: 'v', at: 824 },
  { a: 'hill', b: 'clearing', axis: 'v', at: 816 },
  { a: 'grove', b: 'pond', axis: 'v', at: 546 },
  { a: 'woods', b: 'grove', axis: 'v', at: 532 },
  { a: 'garden', b: 'meadow', axis: 'v', at: 1107 },
  { a: 'rise', b: 'garden', axis: 'v', at: 1108 },
  { a: 'pond', b: 'hamlet', axis: 'h', at: 796 },
  { a: 'hamlet', b: 'meadow', axis: 'h', at: 792 },
  { a: 'woods', b: 'hill', axis: 'h', at: 294 },
  { a: 'hill', b: 'rise', axis: 'h', at: 294 },
  { a: 'heartwood', b: 'grove', axis: 'h', at: 536 },
  { a: 'meadow', b: 'shoals', axis: 'h', at: 778 },
];
