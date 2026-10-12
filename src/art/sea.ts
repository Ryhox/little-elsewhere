import { PAL } from '@/config/palette';
import type { Atlas } from '@/engine/atlas';
import { Pix, type Ramp } from '@/engine/pix';
import { mulberry } from '@/engine/rng';
import { ink, ROOM } from './kit';

const roomy = (w: number, h: number) => new Pix(w + ROOM * 2, h + ROOM * 2);
/** A ramp entry by brightness, safe for ramps of any length. */
const tone = (ramp: Ramp, level: number) => ramp[Math.max(0, Math.min(ramp.length - 1, level))];

/** How strongly things on the sea floor take on the colour of the water above them. */
const SUBMERGED = 0.52;

/** Tint a painting toward the sea's colour, so it reads as lying beneath the surface. */
function submerge(p: Pix, amount = SUBMERGED): Pix {
  const water = PAL.water[2];
  const mix = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return p.map((_x, _y, raw) => (mix(raw & 0xff, (water >> 16) & 0xff) << 16) | (mix((raw >> 8) & 0xff, (water >> 8) & 0xff) << 8) | mix((raw >> 16) & 0xff, water & 0xff));
}

/* ───────────────────────────── The sea floor ───────────────────────────── */

/** Branching coral: a few stems that fork as they climb, paler at the tips. */
function branchCoral(ramp: Ramp, seed: number): Pix {
  const p = roomy(16, 13);
  const cx = Math.floor(p.w / 2);
  const base = ROOM + 12;
  const r = mulberry(seed);
  const stem = (x: number, y: number, lean: number, length: number, forks: number): void => {
    for (let i = 0; i < length; i++) {
      p.set(x, y, tone(ramp, forks > 0 ? 2 : 3));
      if (forks > 1) p.set(x + 1, y, tone(ramp, 1));
      y--;
      if (r() < 0.5) x += lean;
    }
    if (forks > 0) {
      stem(x - 1, y, -1, 2 + Math.floor(r() * 3), forks - 1);
      stem(x + 1, y, 1, 2 + Math.floor(r() * 3), forks - 1);
    } else p.set(x, y, tone(ramp, 5));
  };
  stem(cx - 3, base, -1, 3, 1);
  stem(cx, base, 0, 4, 2);
  stem(cx + 3, base, 1, 3, 1);
  p.rect(cx - 4, base, 9, 1, tone(ramp, 1));
  return submerge(p);
}

/** Brain coral: a low dome crossed by wandering grooves. */
function domeCoral(ramp: Ramp, seed: number): Pix {
  const p = roomy(13, 8);
  const cx = p.w / 2;
  const base = ROOM + 7;
  p.ball(cx, base - 1, 5.6, 5, ramp.slice(1), 0.04, seed);
  for (let x = 0; x < p.w; x++) for (let y = base + 1; y < p.h; y++) p.clear(x, y);
  for (let y = base - 6; y <= base; y++) {
    for (let x = 0; x < p.w; x++) if ((x + Math.round(Math.sin(y * 1.3 + seed) * 1.5)) % 3 === 0) p.over(x, y, tone(ramp, 1));
  }
  return submerge(p);
}

/** Sea fan: a flat lace of ribs spreading from a short stalk. */
function fanCoral(ramp: Ramp): Pix {
  const p = roomy(15, 11);
  const cx = Math.floor(p.w / 2);
  const base = ROOM + 10;
  for (let a = 0; a <= 12; a++) {
    const angle = Math.PI * (1.08 + (a / 12) * 0.84);
    for (let d = 2; d <= 8; d++) {
      const x = cx + Math.cos(angle) * d;
      const y = base - 1 + Math.sin(angle) * d;
      if (a % 2 === 0 || d % 3 === 0 || d === 8) p.set(x, y, tone(ramp, d === 8 ? 4 : a % 2 === 0 ? 3 : 2));
    }
  }
  p.rect(cx, base - 2, 1, 3, tone(ramp, 1));
  return submerge(p);
}

/** Tube sponges: a cluster of open pipes of different heights. */
function tubeCoral(ramp: Ramp): Pix {
  const p = roomy(11, 10);
  const base = ROOM + 9;
  [[1, 5], [4, 8], [7, 6], [9, 3]].forEach(([dx, height]) => {
    const x = ROOM + dx;
    p.rect(x, base - height, 2, height + 1, tone(ramp, 2));
    p.rect(x, base - height, 1, height + 1, tone(ramp, 3));
    p.rect(x, base - height, 2, 1, tone(ramp, 4));
    p.set(x + 1, base - height, tone(ramp, 0));
  });
  return submerge(p);
}

/** Seaweed: wavy fronds; the two frames lean opposite ways. */
function seaweed(ramp: Ramp, frame: number, strands: number): Pix {
  const p = roomy(12, 13);
  const base = ROOM + 12;
  for (let s = 0; s < strands; s++) {
    const x0 = ROOM + 2 + s * 3;
    const height = 7 + ((s * 5) % 5);
    for (let i = 0; i <= height; i++) {
      const sway = Math.sin(i * 0.7 + s * 1.9 + frame * Math.PI) * (i / height) * 1.8;
      p.set(x0 + sway, base - i, tone(ramp, i > height - 2 ? 4 : 2 + (i % 2)));
    }
  }
  return submerge(p);
}

/** Anemone: a soft foot and a crown of tentacles that wave. */
function anemone(frame: number): Pix {
  const p = roomy(10, 9);
  const cx = p.w / 2;
  const base = ROOM + 8;
  for (let t = -3; t <= 3; t++) {
    const lean = (frame ? 1 : -1) * (t % 2 === 0 ? 1 : 0);
    p.set(cx + t * 1.2, base - 4, PAL.pink[2]);
    p.set(cx + t * 1.2 + lean * 0.6, base - 5, PAL.pink[3]);
    p.set(cx + t * 1.3 + lean, base - 6, PAL.pink[4]);
  }
  p.ball(cx, base - 1.5, 3.4, 2.4, PAL.red, 0, 3);
  return submerge(p);
}

function starfish(): Pix {
  const p = roomy(7, 7);
  const cx = Math.floor(p.w / 2);
  const cy = Math.floor(p.h / 2);
  for (let arm = 0; arm < 5; arm++) {
    const a = -Math.PI / 2 + (arm / 5) * Math.PI * 2;
    for (let d = 0; d <= 3; d++) p.set(cx + 0.5 + Math.cos(a) * d, cy + 0.5 + Math.sin(a) * d, d === 3 ? PAL.orange[2] : PAL.orange[3]);
  }
  p.set(cx, cy, PAL.orange[4]);
  return submerge(p);
}

function shell(): Pix {
  const p = roomy(6, 5);
  const cx = p.w / 2;
  const cy = p.h / 2;
  p.ball(cx, cy, 2.6, 2.2, PAL.cream, 0, 2);
  p.over(cx - 1, cy, PAL.pink[3]);
  p.over(cx + 1, cy - 1, PAL.pink[3]);
  return submerge(p);
}

function seabedStone(seed: number): Pix {
  const p = roomy(12, 7);
  const cx = p.w / 2;
  const base = ROOM + 6;
  p.ball(cx - 2, base - 2, 4, 3, PAL.stone.slice(1), 0.12, seed);
  p.ball(cx + 3, base - 1.5, 3, 2.4, PAL.stone.slice(1), 0.12, seed + 1);
  for (let x = 0; x < p.w; x++) for (let y = base + 1; y < p.h; y++) p.clear(x, y);
  return submerge(p, 0.6);
}

/** The sunken shelf a reef grows on: a few flat slabs of rock, barely darker than the water over them. */
function reefBed(seed: number): Pix {
  const p = roomy(34, 16);
  const cx = p.w / 2;
  const cy = p.h / 2;
  const r = mulberry(seed);
  for (let i = 0; i < 5; i++) p.ball(cx + (r() - 0.5) * 20, cy + (r() - 0.5) * 6, 6 + r() * 5, 3 + r() * 2.5, PAL.stone.slice(0, 4), 0.1, seed + i);
  return submerge(p, 0.72);
}

/* ───────────────────────────── Fish ───────────────────────────── */

interface FishLook {
  body: Ramp;
  /** Colour of its bands, if it has any. */
  band?: number;
}

/** The kinds of fish that school in the sea. Add a look here to see a new kind out there. */
const SEA_FISH: readonly FishLook[] = [{ body: PAL.blue }, { body: PAL.yellow, band: PAL.ink }, { body: PAL.orange, band: PAL.white }, { body: PAL.teal }, { body: PAL.pink, band: PAL.violet[2] }];
export const SEA_FISH_KINDS = SEA_FISH.length;
/** How a leaping fish is tilted in each frame, radians: rising, level, diving. */
const LEAP_TILTS = [-0.8, 0, 0.8];
export const LEAP_FRAMES = LEAP_TILTS.length;

/** One fish, facing right. `flick` swings the tail. */
function fishBody(look: FishLook, flick: number, big: boolean): Pix {
  const p = roomy(13, 9);
  const cx = Math.floor(p.w / 2);
  const cy = Math.floor(p.h / 2);
  const rx = big ? 4.2 : 3.4;
  const ry = big ? 2.4 : 1.9;
  p.poly([[cx - rx + 1, cy + 0.5], [cx - rx - 3, cy - 2 + flick], [cx - rx - 3, cy + 3 - flick]], tone(look.body, 1));
  p.ball(cx + 0.5, cy + 0.5, rx, ry, look.body.slice(1), 0, 5);
  if (look.band !== undefined) {
    for (const dx of [-1, 2]) for (let dy = -3; dy <= 3; dy++) p.over(cx + dx, cy + dy, look.band);
  }
  p.over(cx - 1, cy - 1, tone(look.body, 5));
  p.over(cx + Math.floor(rx) - 1, cy, PAL.ink);
  if (big) p.poly([[cx - 1, cy - ry + 0.5], [cx + 1, cy - ry - 1.5], [cx + 2, cy - ry + 0.5]], tone(look.body, 2));
  return p;
}

/** A copy turned about its centre (nearest-pixel, which suits art this small). */
function rotated(src: Pix, angle: number): Pix {
  const out = new Pix(src.w, src.h);
  const cx = (src.w - 1) / 2;
  const cy = (src.h - 1) / 2;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const sx = Math.round(cx + (x - cx) * cos - (y - cy) * sin);
      const sy = Math.round(cy + (x - cx) * sin + (y - cy) * cos);
      if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h) out.d[y * out.w + x] = src.d[sy * src.w + sx];
    }
  }
  return out;
}

/* ───────────────────────────── On the surface ───────────────────────────── */

interface BoatLook {
  hull: Ramp;
  sail: Ramp;
  stripe: number;
  pennant: number;
}

/** Little sailing boats. Add a look here for another colour scheme on the water. */
const BOATS: readonly BoatLook[] = [
  { hull: PAL.wood, sail: PAL.cream, stripe: PAL.red[2], pennant: PAL.red[2] },
  { hull: PAL.roofBlue, sail: PAL.plaster, stripe: PAL.gold[2], pennant: PAL.gold[3] },
  { hull: PAL.roofTeal, sail: PAL.cream, stripe: PAL.teal[2], pennant: PAL.pink[2] },
];
export const BOAT_KINDS = BOATS.length;
export const BOAT_FRAMES = 2;
/** How many different rock shelves reefs grow on. */
export const REEF_BEDS = 3;
/** How many different rocks break the surface. */
export const SEA_ROCKS = 2;

/** A sailing boat with a Sproutling at the tiller, facing right. Frame 1 fills the sail a little more. */
function boat(look: BoatLook, frame: number): { pix: Pix; lantern: [number, number] } {
  const p = roomy(24, 24);
  const cx = Math.floor(p.w / 2);
  const water = ROOM + 23;
  // Hull: a shallow wedge, bow to the right, with a painted stripe under the rail.
  const rows: [number, number][] = [[-9, 9], [-8, 8], [-7, 6], [-6, 4]];
  rows.forEach(([from, to], i) => {
    for (let x = from; x <= to; x++) p.set(cx + x, water - 3 + i, tone(look.hull, i === 0 ? 4 : i === 3 ? 1 : x > to - 3 ? 2 : 3));
  });
  p.rect(cx - 8, water - 2, 16, 1, look.stripe);
  p.set(cx + 10, water - 4, tone(look.hull, 3));
  // Mast and sails.
  p.rect(cx - 1, water - 20, 1, 17, PAL.woodDark[2]);
  const belly = frame ? 1 : 0;
  p.poly([[cx, water - 19], [cx, water - 5], [cx + 8 + belly, water - 5]], tone(look.sail, 3));
  for (let y = water - 17; y < water - 5; y += 4) for (let x = cx; x < cx + 10; x++) p.over(x, y, look.stripe);
  p.poly([[cx, water - 19], [cx, water - 5], [cx + 3, water - 5]], tone(look.sail, 2));
  p.poly([[cx - 2, water - 16], [cx - 2, water - 5], [cx - 7 - belly, water - 5]], tone(look.sail, 1));
  p.rect(cx - 8, water - 4, 17, 1, PAL.woodDark[2]);
  // Pennant.
  p.rect(cx - 1 - (frame ? 3 : 2), water - 21, frame ? 3 : 2, 1, look.pennant);
  p.set(cx - 2, water - 20, look.pennant);
  // The sailor, and a lantern on the stern for night sailing.
  p.ball(cx + 5.5, water - 6, 2.3, 2.3, PAL.grass.slice(1), 0, 9);
  p.over(cx + 5, water - 6, PAL.ink);
  p.over(cx + 7, water - 6, PAL.ink);
  p.set(cx + 5, water - 9, PAL.leaf[4]);
  p.set(cx + 6, water - 10, PAL.leaf[5]);
  const lantern: [number, number] = [cx - 9, water - 7];
  p.rect(lantern[0], lantern[1] + 1, 1, 3, PAL.woodDark[1]);
  p.rect(lantern[0] - 1, lantern[1] - 1, 3, 2, PAL.gold[3]);
  p.set(lantern[0], lantern[1] - 2, PAL.metal[1]);
  return { pix: ink(p), lantern };
}

/** A rock that breaks the surface, with weed on its crown and foam at its foot. */
function seaRock(seed: number): Pix {
  const p = roomy(16, 11);
  const cx = p.w / 2;
  const water = ROOM + 10;
  p.ball(cx - 2, water - 3, 5, 5, PAL.stone.slice(1), 0.14, seed);
  p.ball(cx + 4, water - 2, 3.4, 3.4, PAL.stone.slice(1), 0.14, seed + 3);
  for (let x = 0; x < p.w; x++) for (let y = water + 1; y < p.h; y++) p.clear(x, y);
  for (let x = cx - 5; x <= cx - 1; x++) p.over(x, water - 7 + ((x + seed) % 2), PAL.moss[2 + (x % 2)]);
  ink(p);
  for (let x = cx - 8; x <= cx + 8; x++) if ((x + seed) % 3 !== 0) p.over(x, water + 1, PAL.water[5]);
  return p;
}

/** Everything painted on the sea floor, by name: [sprite, frames]. The world picks from config/sea.ts by these names. */
export function paintSea(atlas: Atlas): void {
  const floor: [string, Pix][] = [
    ['reef_branch_0', branchCoral(PAL.pink, 3)],
    ['reef_branch_1', branchCoral(PAL.orange, 8)],
    ['reef_branch_2', branchCoral(PAL.lilac, 14)],
    ['reef_dome_0', domeCoral(PAL.yellow, 2)],
    ['reef_dome_1', domeCoral(PAL.teal, 6)],
    ['reef_fan_0', fanCoral(PAL.violet)],
    ['reef_fan_1', fanCoral(PAL.red)],
    ['reef_tube_0', tubeCoral(PAL.teal)],
    ['reef_tube_1', tubeCoral(PAL.pink)],
    ['reef_star', starfish()],
    ['reef_shell', shell()],
    ['reef_stone_0', seabedStone(4)],
    ['reef_stone_1', seabedStone(9)],
  ];
  for (let i = 0; i < REEF_BEDS; i++) floor.push([`reef_bed_${i}`, reefBed(41 + i * 16)]);
  for (let f = 0; f < 2; f++) {
    floor.push([`reef_weed_0_${f}`, seaweed(PAL.leaf, f, 3)], [`reef_weed_1_${f}`, seaweed(PAL.teal, f, 2)], [`reef_anemone_${f}`, anemone(f)]);
  }
  // The sea floor is anchored at each piece's middle, so a reef's pieces sit on its bed rather than above it.
  for (const [name, pix] of floor) {
    const [bx, by, bw, bh] = pix.bounds();
    atlas.add(name, pix, { ax: Math.floor(bx + bw / 2), ay: name.startsWith('reef_bed') ? Math.floor(by + bh / 2) : by + bh - 1 });
  }

  SEA_FISH.forEach((look, kind) => {
    for (let f = 0; f < 2; f++) {
      const pix = fishBody(look, f, false);
      atlas.add(`seafish_${kind}_${f}`, pix, { flip: true, ax: Math.floor(pix.w / 2), ay: Math.floor(pix.h / 2) });
    }
    LEAP_TILTS.forEach((tilt, f) => {
      const pix = ink(rotated(fishBody(look, f % 2, true), tilt));
      atlas.add(`leap_${kind}_${f}`, pix, { flip: true, ax: Math.floor(pix.w / 2), ay: Math.floor(pix.h / 2) });
    });
  });

  BOATS.forEach((look, kind) => {
    for (let f = 0; f < BOAT_FRAMES; f++) {
      const { pix, lantern } = boat(look, f);
      atlas.add(`boat_${kind}_${f}`, pix, { flip: true, glow: [[lantern[0] - 1, lantern[1] - 1, 3, 2]], lights: [{ x: lantern[0], y: lantern[1], r: 20, tone: 'warm' }] });
    }
  });
  for (let i = 0; i < SEA_ROCKS; i++) atlas.add(`searock_${i}`, seaRock(20 + i * 7));
}
