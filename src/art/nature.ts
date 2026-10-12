import { AUTUMN_FOLIAGE, PAL } from '@/config/palette';
import { seasonKey, type Atlas, type SpriteMeta } from '@/engine/atlas';
import { Pix, shade, type Ramp } from '@/engine/pix';
import { hash2, lerp, mulberry } from '@/engine/rng';
import { berryStamp, blossomStamp, foliage, ink, mossCap, ornaments, ROOM, trunk } from './kit';

/** Lush → autumn → winter foliage ramps for one plant. */
function foliageSeasons(lush: Ramp, seed: number): Ramp[] {
  return [lush, AUTUMN_FOLIAGE[seed % AUTUMN_FOLIAGE.length], PAL.frost];
}

/** Register the three seasonal looks of a plant in one go. */
function seasonal(atlas: Atlas, name: string, lush: Ramp, seed: number, paint: (ramp: Ramp, season: number) => Pix, meta: SpriteMeta = {}): void {
  foliageSeasons(lush, seed).forEach((ramp, season) => atlas.add(seasonKey(name, season), paint(ramp, season), meta));
}

/** A roomy canvas: `w`×`h` of working space plus a margin on every side. */
const roomy = (w: number, h: number) => new Pix(w + ROOM * 2, h + ROOM * 2);

/** Stamps one ornament (a berry, a blossom) onto a painting. */
type Ornament = (p: Pix) => (x: number, y: number) => void;

/** A broadleaf tree. `fruit` dots the canopy with ornaments before the outline goes on. */
function oak(ramp: Ramp, seed: number, size = 1, fruit?: { ornament: Ornament; count: number }): Pix {
  const w = Math.round(34 * size);
  const h = Math.round(44 * size);
  const p = roomy(w, h);
  const cx = p.w / 2;
  trunk(p, cx, ROOM + Math.round(h * 0.52), ROOM + h - 2, Math.max(4, Math.round(5 * size)));
  foliage(p, cx, ROOM + h * 0.36, w * 0.43, h * 0.32, ramp, seed, Math.round(9 * size));
  if (fruit) ornaments(p, fruit.count, seed + 3, 5, fruit.ornament(p), ROOM + Math.round(h * 0.6));
  return ink(p);
}

function pine(ramp: Ramp, seed: number, tiers: number): Pix {
  const tierStep = 6;
  const h = tiers * tierStep + 10;
  const p = roomy(23, h);
  const cx = Math.floor(p.w / 2);
  // The trunk starts inside the lowest tier so the two always join.
  trunk(p, cx + 0.5, ROOM + (tiers - 1) * tierStep + 8, ROOM + h - 2, 3);
  for (let t = tiers - 1; t >= 0; t--) {
    const top = ROOM + 1 + t * tierStep;
    const rows = 10;
    const hw0 = 0.6 + t * 1.2;
    const hw1 = 4.4 + t * 1.9;
    for (let y = 0; y < rows; y++) {
      const hw = lerp(hw0, hw1, y / (rows - 1));
      for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) {
        if (Math.abs(x) > hw + 0.4) continue;
        if (y === rows - 1 && (x + t) % 2 !== 0) continue;
        let k = 0.62 - (x / hw1) * 0.34 - (y / rows) * 0.26 + (hash2(x, top + y, seed) - 0.5) * 0.16;
        if (y >= rows - 2) k -= 0.2;
        p.set(cx + x, top + y, shade(ramp, k));
      }
    }
  }
  return ink(p);
}

function birch(ramp: Ramp, seed: number): Pix {
  const p = roomy(24, 44);
  const cx = p.w / 2;
  trunk(p, cx, ROOM + 16, ROOM + 42, 4, PAL.barkPale);
  for (let y = 18; y < 42; y += 4) p.over(cx - 1 + (y % 3), ROOM + y, PAL.ink);
  foliage(p, cx, ROOM + 13, 10, 11, ramp, seed, 7);
  return ink(p);
}

function willow(ramp: Ramp, seed: number): Pix {
  const p = roomy(40, 44);
  const r = mulberry(seed);
  const cx = p.w / 2;
  trunk(p, cx, ROOM + 20, ROOM + 42, 6);
  foliage(p, cx, ROOM + 14, 17, 11, ramp, seed, 10);
  // Hanging strands give the willow its curtain silhouette.
  for (let i = -16; i < 16; i += 2) {
    const len = 6 + Math.floor(r() * 12) - Math.abs(i) * 0.2;
    for (let j = 0; j < len; j++) p.set(cx + i + ((j >> 2) & 1), ROOM + 20 + j, shade(ramp, 0.62 - j * 0.03 - (i + 16) * 0.008));
  }
  return ink(p);
}

function bush(ramp: Ramp, seed: number, ornament?: Ornament): Pix {
  const p = roomy(20, 14);
  foliage(p, p.w / 2, ROOM + 8, 8, 5.2, ramp, seed, 6);
  if (ornament) ornaments(p, 6, seed + 1, 4, ornament(p));
  return ink(p);
}

/** A domed cap with gills and pale spots; shared by every mushroom. */
export function mushroomCap(p: Pix, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, seed: number, spot: number = PAL.cream[3]): void {
  const cap = new Pix(p.w, p.h);
  cap.ball(cx, cy, rx, ry, ramp, 0.1, seed);
  const cut = Math.round(cy + ry * 0.38);
  for (let y = cut + 1; y < cap.h; y++) for (let x = 0; x < cap.w; x++) cap.clear(x, y);
  for (let x = 0; x < cap.w; x++) if (cap.solid(x, cut)) cap.set(x, cut, x % 2 ? PAL.cream[1] : PAL.cream[0]);
  const r = mulberry(seed + 5);
  const spots = Math.max(2, Math.round(rx * ry * 0.09));
  for (let i = 0; i < spots; i++) {
    const sx = cx + (r() - 0.5) * rx * 1.5;
    const sy = cy - ry * 0.75 + r() * ry * 0.9;
    const size = rx > 7 && r() < 0.6 ? 2 : 1;
    for (let j = 0; j < size; j++) for (let k = 0; k < size; k++) if (sy + j < cut) cap.over(sx + k, sy + j, spot);
  }
  p.blit(cap, 0, 0);
}

/** Any mushroom, from pebble-sized to the giant toadstool trees of the Grove. */
export function mushroom(cap: Ramp, seed: number, w: number, h: number): Pix {
  const p = roomy(w, h);
  const cx = p.w / 2;
  const capRy = h * 0.3;
  const capCy = ROOM + capRy + 1;
  trunk(p, cx, Math.round(capCy), ROOM + h - 2, Math.max(2, Math.round(w * 0.22)), PAL.cream);
  mushroomCap(p, cx, capCy, w / 2 - 1, capRy, cap, seed);
  return ink(p);
}

function rock(seed: number, w: number, h: number, mossy: boolean): Pix {
  const p = roomy(w, h);
  const cx = p.w / 2;
  p.ball(cx, ROOM + h / 2 + 1, w / 2, h / 2, PAL.stone, 0.2, seed);
  for (let x = 0; x < p.w; x++) p.clear(x, ROOM + h);
  if (mossy) mossCap(p, cx - w / 2 + 2, w - 4, 3, seed);
  return ink(p);
}

function stump(): Pix {
  const p = roomy(12, 10);
  const cx = p.w / 2;
  trunk(p, cx, ROOM + 3, ROOM + 8, 6);
  p.ell(cx, ROOM + 3.5, 4, 2, PAL.bark[4]);
  p.ell(cx, ROOM + 3.5, 2, 1, PAL.bark[3]);
  p.set(cx - 1, ROOM + 3, PAL.bark[2]);
  return ink(p);
}

function logProp(): Pix {
  const p = roomy(20, 9);
  const x0 = ROOM;
  const y0 = ROOM;
  for (let x = 2; x < 17; x++) for (let y = 2; y < 8; y++) p.set(x0 + x, y0 + y, y < 4 ? PAL.bark[3] : y < 6 ? PAL.bark[2] : PAL.bark[1]);
  for (let x = 4; x < 16; x += 4) p.set(x0 + x, y0 + 5, PAL.bark[0]);
  p.ell(x0 + 16.5, y0 + 5, 2.5, 3, PAL.bark[4]);
  p.ell(x0 + 16.5, y0 + 5, 1.2, 1.6, PAL.bark[2]);
  for (let x = 3; x < 12; x++) if (hash2(x, 0, 4) < 0.6) p.set(x0 + x, y0 + 2, PAL.moss[2]);
  return ink(p);
}

export type FlowerKind = 'tulip' | 'daisy' | 'bell' | 'poppy' | 'lavender' | 'sunflower';

const STEM_HEIGHT: Record<FlowerKind, number> = { tulip: 6, daisy: 5, bell: 7, poppy: 6, lavender: 4, sunflower: 12 };

/** Paint one chunky, readable flower with its stem rooted at (x, base). Shared by wildflowers and garden beds. */
export function paintFlower(p: Pix, kind: FlowerKind, ramp: Ramp, x: number, base: number): void {
  const stem = PAL.leaf[3];
  const leaf = PAL.leaf[4];
  const height = STEM_HEIGHT[kind];
  const top = base - height;
  for (let i = 0; i < height; i++) p.set(x, base - i, stem);
  p.set(x - 1, base - 1, leaf);
  p.set(x - 2, base - 2, leaf);
  p.set(x + 1, base - 2, leaf);
  p.set(x + 2, base - 3, leaf);
  switch (kind) {
    case 'tulip':
      p.rect(x - 2, top - 3, 5, 4, ramp[2]);
      p.rect(x - 1, top + 1, 3, 1, ramp[1]);
      p.set(x - 2, top - 4, ramp[3]);
      p.set(x, top - 4, ramp[3]);
      p.set(x + 2, top - 4, ramp[2]);
      p.rect(x - 1, top - 3, 1, 3, ramp[3]);
      p.set(x - 2, top - 3, ramp[4]);
      p.rect(x + 2, top - 2, 1, 3, ramp[1]);
      break;
    case 'daisy':
      p.ell(x + 0.5, top - 1.5, 2.6, 2.6, ramp[3]);
      p.set(x - 1, top - 3, ramp[2]);
      p.set(x + 2, top, ramp[1]);
      p.set(x + 2, top - 1, ramp[2]);
      p.rect(x, top - 2, 1, 1, PAL.yellow[2]);
      p.set(x, top - 1, PAL.yellow[1]);
      break;
    case 'bell':
      p.set(x + 1, top, stem);
      p.set(x + 2, top + 1, stem);
      for (const [bx, by, tone] of [[2, 2, 3], [-2, 1, 2], [1, 5, 2]] as const) {
        p.rect(x + bx - 1, top + by, 3, 2, ramp[tone]);
        p.set(x + bx, top + by - 1, ramp[tone]);
        p.set(x + bx - 1, top + by, ramp[4]);
        p.set(x + bx + 1, top + by + 1, ramp[1]);
      }
      break;
    case 'poppy':
      p.ell(x + 0.5, top - 1.5, 2.6, 2.3, ramp[2]);
      p.set(x - 1, top - 3, ramp[3]);
      p.set(x, top - 3, ramp[4]);
      p.set(x + 2, top, ramp[1]);
      p.set(x, top - 1, PAL.ink);
      p.set(x + 1, top - 1, PAL.yellow[2]);
      break;
    case 'lavender':
      for (const [dx, len] of [[-2, 4], [0, 6], [2, 5]] as const) {
        for (let i = 0; i < len; i++) p.set(x + dx, top + 2 - i, i < 2 ? stem : ramp[2 + ((i + dx) & 1)]);
        p.set(x + dx, top + 2 - len, ramp[4]);
      }
      break;
    case 'sunflower':
      p.ell(x + 0.5, top - 2.5, 3.6, 3.6, PAL.yellow[2]);
      for (const [dx, dy] of [[-3, -6], [3, -6], [-3, 0], [3, 0], [0, -6], [0, 1]] as const) p.set(x + dx, top + dy, PAL.yellow[3]);
      p.set(x - 2, top - 5, PAL.yellow[4]);
      p.rect(x + 3, top - 2, 1, 2, PAL.yellow[1]);
      p.ell(x + 0.5, top - 2.5, 1.7, 1.7, PAL.bark[1]);
      p.set(x, top - 3, PAL.bark[3]);
      p.set(x - 2, base - 5, leaf);
      p.set(x - 3, base - 6, leaf);
      p.set(x + 2, base - 7, leaf);
      break;
  }
}

/** Wildflower sprites: [name, kind, ramp]. Add a row to grow a new species everywhere. */
const WILDFLOWERS: readonly [string, FlowerKind, Ramp][] = [
  ['flower_tulip_red', 'tulip', PAL.red],
  ['flower_tulip_gold', 'tulip', PAL.yellow],
  ['flower_tulip_pink', 'tulip', PAL.pink],
  ['flower_daisy', 'daisy', PAL.cream],
  ['flower_daisy_pink', 'daisy', PAL.pink],
  ['flower_bell', 'bell', PAL.blue],
  ['flower_poppy', 'poppy', PAL.red],
  ['flower_poppy_gold', 'poppy', PAL.orange],
  ['flower_lavender', 'lavender', PAL.violet],
  ['flower_sunflower', 'sunflower', PAL.yellow],
];
export const WILDFLOWER_NAMES = WILDFLOWERS.map((f) => f[0]);

function flowerSprite(kind: FlowerKind, ramp: Ramp): Pix {
  const p = roomy(11, 20);
  paintFlower(p, kind, ramp, Math.floor(p.w / 2), ROOM + 19);
  return ink(p);
}

function tuft(seed: number): Pix {
  const p = roomy(9, 7);
  const r = mulberry(seed);
  const cx = Math.floor(p.w / 2);
  for (let i = -2; i <= 2; i++) {
    const hgt = 2 + Math.floor(r() * 4) - Math.abs(i);
    for (let j = 0; j < hgt; j++) p.set(cx + i + (j > 2 ? Math.sign(i) : 0), ROOM + 6 - j, j > 1 ? PAL.grass[4] : PAL.grass[1]);
  }
  return p;
}

function reeds(seed: number): Pix {
  const p = roomy(11, 18);
  const r = mulberry(seed);
  for (let i = 0; i < 4; i++) {
    const x = ROOM + 2 + i * 2 + Math.floor(r() * 2);
    const hgt = 8 + Math.floor(r() * 7);
    for (let j = 0; j < hgt; j++) p.set(x, ROOM + 16 - j, PAL.leafDeep[3 + (j % 2)]);
    if (i % 2 === 0) p.rect(x, ROOM + 16 - hgt - 2, 1, 4, PAL.bark[2]);
  }
  return ink(p);
}

function lilypad(seed: number, flower: boolean): Pix {
  const p = roomy(13, 10);
  const x0 = ROOM;
  const y0 = ROOM;
  p.ell(x0 + 6.5, y0 + 6, 5.5, 3.2, PAL.leaf[3]);
  p.ell(x0 + 6, y0 + 5.4, 4, 2, PAL.leaf[4]);
  p.set(x0 + 6 + (seed % 3), y0 + 6, PAL.leaf[2]);
  p.set(x0 + 7 + (seed % 3), y0 + 7, PAL.leaf[2]);
  p.clear(x0 + 11, y0 + 6);
  p.clear(x0 + 10, y0 + 6);
  if (flower) {
    p.rect(x0 + 5, y0 + 2, 3, 3, PAL.pink[3]);
    p.set(x0 + 4, y0 + 3, PAL.pink[2]);
    p.set(x0 + 8, y0 + 3, PAL.pink[2]);
    p.set(x0 + 6, y0 + 1, PAL.pink[4]);
    p.set(x0 + 6, y0 + 3, PAL.yellow[3]);
  }
  return ink(p);
}

export function paintNature(atlas: Atlas): void {
  for (let i = 0; i < 3; i++) seasonal(atlas, `oak_${i}`, i === 1 ? PAL.leafDeep : PAL.leaf, 11 + i * 7, (ramp) => oak(ramp, 11 + i * 7));
  seasonal(atlas, 'oak_big', PAL.leaf, 51, (ramp) => oak(ramp, 51, 1.38));
  seasonal(atlas, 'blossom', PAL.blossom, 2, (ramp, s) => oak(ramp, 77, 1, s === 0 ? { ornament: (p) => blossomStamp(p, PAL.blossom), count: 12 } : undefined));
  seasonal(atlas, 'fruit_tree', PAL.leaf, 1, (ramp, s) => oak(ramp, 93, 0.92, s < 2 ? { ornament: (p) => berryStamp(p, PAL.red), count: 8 } : undefined));
  for (let i = 0; i < 2; i++) seasonal(atlas, `birch_${i}`, PAL.leaf, 3 + i, (ramp) => birch(ramp, 31 + i * 5));
  seasonal(atlas, 'willow', PAL.leafDeep, 3, (ramp) => willow(ramp, 61));

  const snowyPine: Ramp = [PAL.pine[0], PAL.pine[1], PAL.pine[2], PAL.frost[3], PAL.frost[5]];
  for (let i = 0; i < 3; i++) {
    const tiers = 3 + i;
    atlas.add(`pine_${i}`, pine(PAL.pine, 5 + i, tiers));
    atlas.add(seasonKey(`pine_${i}`, 2), pine(snowyPine, 5 + i, tiers));
  }

  for (let i = 0; i < 2; i++) seasonal(atlas, `bush_${i}`, i ? PAL.leafDeep : PAL.leaf, i, (ramp) => bush(ramp, 21 + i * 3));
  seasonal(atlas, 'bush_berry', PAL.leaf, 1, (ramp, s) => bush(ramp, 29, s < 2 ? (p) => berryStamp(p, PAL.red) : undefined));
  seasonal(atlas, 'bush_blue', PAL.leafDeep, 0, (ramp, s) => bush(ramp, 33, s < 2 ? (p) => berryStamp(p, PAL.blue) : undefined));
  seasonal(atlas, 'bush_bloom', PAL.leaf, 2, (ramp, s) => bush(ramp, 37, s === 0 ? (p) => blossomStamp(p, PAL.pink) : undefined));

  const caps: Ramp[] = [PAL.pink, PAL.red, PAL.violet, PAL.teal];
  caps.forEach((cap, i) => atlas.add(`shroomtree_${i}`, mushroom(cap, 40 + i, 28 + (i % 2) * 6, 40 + (i % 3) * 5), { snow: true }));
  atlas.add('shroom_red', mushroom(PAL.red, 3, 9, 9), { snow: true });
  atlas.add('shroom_pink', mushroom(PAL.pink, 4, 11, 12), { snow: true });
  atlas.add('shroom_gold', mushroom(PAL.orange, 6, 8, 8), { snow: true });

  atlas.add('rock_0', rock(1, 12, 8, false), { snow: true });
  atlas.add('rock_1', rock(2, 17, 11, true), { snow: true });
  atlas.add('rock_2', rock(3, 8, 6, false), { snow: true });
  atlas.add('rock_3', rock(4, 22, 15, true), { snow: true });
  atlas.add('stump', stump(), { snow: true });
  atlas.add('log', logProp(), { snow: true });

  for (const [name, kind, ramp] of WILDFLOWERS) atlas.add(name, flowerSprite(kind, ramp));
  for (let i = 0; i < 3; i++) atlas.add(`tuft_${i}`, tuft(60 + i));
  for (let i = 0; i < 2; i++) atlas.add(`reeds_${i}`, reeds(70 + i));
  for (let i = 0; i < 3; i++) atlas.add(`lilypad_${i}`, lilypad(i, i === 2), { ay: ROOM + 6 });
}
