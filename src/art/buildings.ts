import { PAL } from '@/config/palette';
import type { Atlas } from '@/engine/atlas';
import { Pix, shade, type Ramp } from '@/engine/pix';
import { hash2, lerp, mulberry } from '@/engine/rng';
import { berryStamp, boards, chevronRoof, chimneyAt, doorAt, foliage, gableWall, ink, masonry, mossCap, plankColor, planks, plasterColor, ROOM, shingles, stoneColor, trunk, vine, windowAt } from './kit';
import { mushroomCap, paintFlower, type FlowerKind } from './nature';

const roomy = (w: number, h: number) => new Pix(w + ROOM * 2, h + ROOM * 2);

function fern(seed: number): Pix {
  const p = roomy(18, 14);
  const r = mulberry(seed);
  const cx = p.w / 2;
  const base = ROOM + 13;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.12 + (i / 6) * 0.76) + (r() - 0.5) * 0.2;
    const len = 6 + r() * 4;
    for (let t = 0; t < len; t++) {
      const x = cx + Math.cos(a) * t;
      const y = base + Math.sin(a) * t + t * t * 0.035;
      p.set(x, y, PAL.leaf[2]);
      if (t > 1) p.under(x, y - 1, t % 2 ? PAL.leaf[4] : PAL.leaf[5]);
      if (t > 2) p.under(x, y + 1, PAL.leaf[3]);
    }
    if (i % 2 === 0) p.set(cx + Math.cos(a) * len, base + Math.sin(a) * len + len * len * 0.035 - 1, PAL.magic[3]);
  }
  return ink(p);
}

function burrow(): Pix {
  const p = roomy(24, 17);
  const cx = p.w / 2;
  const base = ROOM + 16;
  p.ball(cx, base - 2, 11, 12, PAL.grass, 0.18, 4);
  for (let y = base + 1; y < p.h; y++) for (let x = 0; x < p.w; x++) p.clear(x, y);
  p.ell(cx - 2, base - 3, 4.4, 5, PAL.woodDark[0]);
  p.ell(cx - 2, base - 2.6, 3.4, 4, PAL.wood[2]);
  p.rect(cx - 2, base - 6, 1, 7, PAL.wood[1]);
  p.set(cx, base - 3, PAL.gold[3]);
  p.rect(cx + 5, base - 6, 3, 3, PAL.woodDark[1]);
  p.rect(cx + 6, base - 5, 1, 1, PAL.gold[3]);
  p.set(cx + 1, base - 15, PAL.leaf[4]);
  p.set(cx + 2, base - 16, PAL.leaf[5]);
  p.set(cx - 1, base - 15, PAL.leaf[3]);
  p.set(cx, base - 14, PAL.leaf[2]);
  p.rect(cx - 8, base - 1, 2, 2, PAL.stone[3]);
  p.rect(cx + 3, base, 2, 1, PAL.stone[4]);
  return ink(p);
}

/** Planting plans for the flower-bed tiers. */
const BED_PLANS: readonly (readonly [FlowerKind, Ramp][])[] = [
  [['tulip', PAL.red], ['tulip', PAL.yellow], ['tulip', PAL.pink], ['tulip', PAL.red]],
  [['daisy', PAL.cream], ['poppy', PAL.red], ['bell', PAL.blue], ['daisy', PAL.pink]],
  [['lavender', PAL.violet], ['sunflower', PAL.yellow], ['poppy', PAL.orange], ['lavender', PAL.lilac]],
  [['sunflower', PAL.yellow], ['tulip', PAL.pink], ['sunflower', PAL.yellow], ['bell', PAL.violet]],
];

function flowerBed(plan: readonly (readonly [FlowerKind, Ramp])[]): Pix {
  const p = roomy(26, 24);
  const x0 = ROOM;
  const base = ROOM + 23;
  planks(p, x0, base - 6, 26, 7, PAL.wood);
  for (let x = 1; x < 25; x++) for (let y = 0; y < 4; y++) p.set(x0 + x, base - 6 + y, shade(PAL.soil, 0.3 + hash2(x, y, 2) * 0.6));
  plan.forEach(([kind, ramp], i) => paintFlower(p, kind, ramp, x0 + 4 + i * 6, base - 4 - (i % 2)));
  return ink(p);
}

function trellis(): Pix {
  const p = roomy(24, 28);
  const x0 = ROOM;
  const base = ROOM + 27;
  for (const x of [2, 20]) boards(p, x0 + x, base - 20, 2, 21, PAL.wood, 2);
  for (let a = 0; a <= 40; a++) {
    const t = (a / 40) * Math.PI;
    const x = x0 + 11.5 - Math.cos(t) * 9.5;
    const y = base - 20 - Math.sin(t) * 6;
    p.rect(x, y, 2, 2, PAL.wood[3]);
  }
  for (let y = base - 18; y < base - 2; y += 5) p.rect(x0 + 4, y, 16, 1, PAL.wood[1]);
  // Rose vines climb both posts and meet over the arch.
  vine(p, x0 + 2, base - 1, x0 + 2, base - 20, 1);
  vine(p, x0 + 21, base - 1, x0 + 21, base - 20, 4);
  vine(p, x0 + 4, base - 25, x0 + 19, base - 25, 2);
  const roses: readonly (readonly [number, number])[] = [[1, -5], [2, -12], [1, -18], [21, -8], [20, -15], [6, -26], [11, -28], [16, -26], [21, -21]];
  roses.forEach(([dx, dy], i) => berryStamp(p, i % 3 ? PAL.pink : PAL.red)(x0 + dx, base + dy));
  return ink(p);
}

function glowcaps(seed: number): Pix {
  const p = roomy(24, 20);
  const base = ROOM + 19;
  const cx = p.w / 2;
  const caps: readonly [number, number, number][] = [[-7, 7, 9], [6, 6, 8], [0, 10, 14]];
  caps.forEach(([dx, w, h], i) => {
    trunk(p, cx + dx, base - h * 0.55, base, Math.max(2, w * 0.24), PAL.cream);
    mushroomCap(p, cx + dx, base - h * 0.62, w / 2, h * 0.32, i === 2 || seed % 2 ? PAL.teal : PAL.violet, seed + i, PAL.glow[3]);
  });
  return ink(p);
}

function den(): Pix {
  const p = roomy(28, 18);
  const x0 = ROOM;
  const base = ROOM + 17;
  for (let x = 3; x < 26; x++) for (let y = 0; y < 12; y++) p.set(x0 + x, base - 12 + y, shade(PAL.bark, 0.82 - y * 0.06 + (hash2(x >> 2, y, 6) - 0.5) * 0.12));
  p.ell(x0 + 5, base - 6, 4.6, 6, PAL.bark[4]);
  p.ell(x0 + 5, base - 6, 3.2, 4.4, PAL.woodDark[0]);
  p.set(x0 + 4, base - 6, PAL.gold[3]);
  p.set(x0 + 6, base - 6, PAL.gold[3]);
  p.rect(x0 + 15, base - 8, 4, 4, PAL.woodDark[0]);
  p.rect(x0 + 16, base - 7, 2, 2, PAL.gold[3]);
  mossCap(p, x0 + 7, 19, 3, 9);
  mushroomCap(p, x0 + 22, base - 15, 3, 2.6, PAL.red, 3);
  p.rect(x0 + 21, base - 14, 2, 2, PAL.cream[2]);
  return ink(p);
}

function lilyCluster(seed: number): Pix {
  const p = roomy(26, 16);
  const r = mulberry(seed);
  const pads: number[][] = [[6, 9], [16, 11], [11, 4], [21, 5]];
  for (const [x, y] of pads.slice(0, 3 + (seed % 2))) {
    const px = ROOM + x + r() * 2;
    const py = ROOM + y;
    p.ell(px, py, 5, 2.8, PAL.leaf[3]);
    p.ell(px - 0.6, py - 0.5, 3.4, 1.6, PAL.leaf[4]);
    p.clear(Math.floor(px + 4), Math.floor(py));
  }
  for (const [x, y] of [pads[0], pads[2]]) {
    const px = ROOM + x;
    const py = ROOM + y - 2;
    p.rect(px - 1, py - 1, 3, 3, PAL.pink[3]);
    p.set(px - 2, py, PAL.pink[2]);
    p.set(px + 2, py, PAL.pink[2]);
    p.set(px, py - 2, PAL.pink[4]);
    p.set(px, py, PAL.yellow[3]);
  }
  return ink(p);
}

function skiff(sail: Ramp): Pix {
  const p = roomy(20, 20);
  const x0 = ROOM;
  const base = ROOM + 19;
  p.poly([[x0, base - 5], [x0 + 20, base - 5], [x0 + 16, base], [x0 + 4, base]], PAL.wood[2]);
  p.rect(x0 + 1, base - 5, 18, 1, PAL.wood[4]);
  p.rect(x0 + 4, base - 1, 12, 1, PAL.wood[1]);
  p.rect(x0 + 9, base - 18, 1, 13, PAL.woodDark[2]);
  p.poly([[x0 + 10, base - 18], [x0 + 10, base - 7], [x0 + 18, base - 7]], sail[2]);
  p.poly([[x0 + 10, base - 13], [x0 + 10, base - 11], [x0 + 15, base - 11]], sail[0]);
  p.poly([[x0 + 9, base - 16], [x0 + 9, base - 8], [x0 + 3, base - 8]], PAL.cream[3]);
  p.rect(x0 + 17, base - 8, 2, 3, PAL.gold[3]);
  return ink(p);
}

function hive(boxed: boolean): Pix {
  const p = roomy(16, 20);
  const cx = p.w / 2;
  const base = ROOM + 19;
  planks(p, cx - 7, base - 4, 14, 2, PAL.wood);
  p.rect(cx - 6, base - 2, 2, 3, PAL.wood[1]);
  p.rect(cx + 4, base - 2, 2, 3, PAL.wood[1]);
  if (boxed) {
    for (let i = 0; i < 3; i++) planks(p, cx - 6, base - 9 - i * 5, 12, 5, i % 2 ? PAL.cream : PAL.yellow, 5);
    p.rect(cx - 7, base - 20, 14, 2, PAL.roofTeal[2]);
    p.rect(cx - 7, base - 20, 14, 1, PAL.roofTeal[4]);
    p.rect(cx - 2, base - 6, 4, 1, PAL.ink);
  } else {
    const rings = [6.4, 6.4, 5.6, 4.4, 2.8];
    rings.forEach((rx, i) => {
      for (let x = -Math.ceil(rx); x <= rx; x++) {
        const lit = x < -rx * 0.3 ? 4 : x > rx * 0.4 ? 1 : 3;
        p.rect(cx + x, base - 7 - i * 3, 1, 2, PAL.thatch[lit]);
        p.set(cx + x, base - 5 - i * 3, PAL.thatch[Math.max(0, lit - 2)]);
      }
    });
    p.ell(cx, base - 7, 1.6, 1.6, PAL.ink);
  }
  return ink(p);
}

function flutterNest(): Pix {
  const p = roomy(18, 26);
  const x0 = ROOM;
  const base = ROOM + 25;
  boards(p, x0 + 3, base - 22, 2, 23, PAL.wood, 2);
  p.rect(x0 + 3, base - 23, 9, 2, PAL.wood[3]);
  p.rect(x0 + 11, base - 22, 1, 4, PAL.woodDark[2]);
  p.ball(x0 + 11.5, base - 13, 5.4, 5.6, PAL.thatch, 0.3, 8);
  p.ell(x0 + 11, base - 13, 2, 2.2, PAL.ink);
  for (let i = 0; i < 5; i++) p.set(x0 + 8 + (i % 2), base - 7 + i, PAL.pink[2 + (i % 2)]);
  for (let i = 0; i < 4; i++) p.set(x0 + 14 + (i % 2), base - 7 + i, PAL.blue[3]);
  p.rect(x0 + 5, base - 25, 4, 3, PAL.pink[2]);
  p.set(x0 + 5, base - 25, PAL.pink[4]);
  return ink(p);
}

/** Cottage variants: [wall width, roof ramp, plaster walls?, chimney?]. */
const COTTAGES: readonly [number, Ramp, boolean, boolean][] = [
  [28, PAL.roofRed, true, true],
  [32, PAL.roofTeal, false, true],
  [26, PAL.thatch, true, false],
  [34, PAL.roofPlum, true, true],
];

function cottage(width: number, roof: Ramp, plaster: boolean, chimney: boolean, atlas: Atlas, name: string): void {
  const roofH = 15;
  const wallH = 14;
  const p = roomy(width + 4, roofH + wallH + 8);
  const x0 = ROOM + 2;
  const y0 = ROOM + 8;
  for (let j = 0; j < wallH; j++) {
    for (let i = 0; i < width; i++) {
      const px = x0 + i;
      const py = y0 + roofH + j;
      let c = plaster ? plasterColor(px, py, x0, width) : plankColor(px, py, PAL.wood, 3, i / width);
      if (j < 2) c = plaster ? PAL.plaster[1] : PAL.wood[1];
      if (j >= wallH - 2) c = stoneColor(px, py, PAL.stone, 2, i / width);
      p.set(px, py, c);
    }
  }
  const smoke = chimney ? chimneyAt(p, x0 + width - 8, y0 - 4, 10) : undefined;
  shingles(p, x0 - 2, y0, width + 4, roofH, roof, 3);
  const doorX = x0 + Math.floor(width * 0.56);
  doorAt(p, doorX, y0 + roofH + 5, 5, 7, PAL.woodDark);
  const glow = [windowAt(p, x0 + 4, y0 + roofH + 4, 6, 5)];
  if (width > 30) glow.push(windowAt(p, x0 + width - 9, y0 + roofH + 4, 5, 5));
  for (let i = 0; i < 6; i++) p.set(x0 + 4 + i, y0 + roofH + 10, i % 2 ? PAL.pink[2] : PAL.leaf[4]);
  ink(p);
  atlas.add(name, p, { snow: true, glow, smoke, lights: [{ x: x0 + 7, y: y0 + roofH + 7, r: 20, tone: 'warm' }] });
}

function workshop(roof: Ramp, banner: number, atlas: Atlas, name: string): void {
  const w = 40;
  const rise = 10;
  const depth = 8;
  const wallBottom = ROOM + 44;
  const p = roomy(w + 8, 46);
  const x0 = ROOM + 4;
  const y0 = ROOM + 8;
  const smoke = chimneyAt(p, x0 + w - 10, y0 - 6, 14);
  gableWall(p, x0, y0, w, rise, depth, wallBottom, (px, py) => (py > wallBottom - 3 ? stoneColor(px, py, PAL.stone, 4) : plankColor(px, py, PAL.woodDark, 3, (px - x0) / w)));
  chevronRoof(p, x0, y0, w, rise, depth, roof);
  boards(p, x0 + 14, wallBottom - 13, 12, 11, PAL.wood, 3);
  p.rect(x0 + 13, wallBottom - 14, 14, 1, PAL.wood[4]);
  p.rect(x0 + 19, wallBottom - 13, 2, 11, PAL.woodDark[0]);
  p.ell(x0 + 20, y0 + 16, 3.4, 3.4, PAL.woodDark[0]);
  p.ell(x0 + 20, y0 + 16, 2.2, 2.2, PAL.blue[3]);
  const glow = [[x0 + 18, y0 + 14, 4, 4], windowAt(p, x0 + 4, wallBottom - 11, 5, 5), windowAt(p, x0 + w - 9, wallBottom - 11, 5, 5)];
  // Guild banner and the cog sign that marks a place where things get made.
  p.rect(x0 + 30, y0 + 13, 4, 7, banner);
  p.set(x0 + 31, y0 + 19, PAL.outline);
  p.ell(x0 + 8.5, y0 + 18.5, 2.6, 2.6, PAL.metal[3]);
  p.set(x0 + 8, y0 + 18, PAL.metal[0]);
  planks(p, x0 - 4, wallBottom - 5, 6, 6, PAL.wood);
  p.rect(x0 - 4, wallBottom - 5, 6, 1, PAL.wood[5]);
  ink(p);
  atlas.add(name, p, { snow: true, glow, smoke, lights: [{ x: x0 + 20, y: wallBottom - 8, r: 26, tone: 'warm' }] });
}

function lantern(atlas: Atlas): void {
  const p = roomy(10, 20);
  const x0 = ROOM;
  const base = ROOM + 19;
  boards(p, x0 + 2, base - 17, 2, 18, PAL.woodDark, 2);
  p.rect(x0 + 2, base - 18, 7, 2, PAL.woodDark[3]);
  p.rect(x0 + 7, base - 16, 1, 2, PAL.metal[1]);
  p.rect(x0 + 5, base - 14, 5, 6, PAL.metal[1]);
  p.rect(x0 + 6, base - 13, 3, 4, PAL.ember[3]);
  p.set(x0 + 7, base - 12, PAL.ember[4]);
  p.rect(x0 + 5, base - 15, 5, 1, PAL.metal[3]);
  ink(p);
  atlas.add('lantern', p, { snow: true, glow: [[x0 + 6, base - 13, 3, 4]], lights: [{ x: x0 + 7, y: base - 11, r: 26, tone: 'warm' }] });
}

const BLADE_FRAMES = 8;
const BLADE_SIZE = 50;

function windmill(atlas: Atlas): void {
  const p = roomy(26, 44);
  const cx = p.w / 2;
  const top = ROOM + 8;
  const base = ROOM + 43;
  for (let y = top; y <= base; y++) {
    const half = lerp(7, 11, (y - top) / (base - top));
    for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
      const side = (x - (cx - half)) / (half * 2);
      let c = y > base - 6 ? stoneColor(x, y, PAL.stone, 3, side) : PAL.plaster[side < 0.3 ? 4 : side > 0.72 ? 2 : 3];
      if (y <= base - 6 && hash2(x, y, 12) < 0.05) c = PAL.plaster[2];
      p.set(x, y, c);
    }
  }
  const cap = new Pix(p.w, p.h);
  cap.ball(cx, top + 1, 9.5, 8, PAL.roofRed, 0.12, 5);
  for (let y = top + 3; y < cap.h; y++) for (let x = 0; x < cap.w; x++) cap.clear(x, y);
  p.blit(cap, 0, 0);
  doorAt(p, cx - 2, base - 8, 5, 8, PAL.woodDark);
  const glow = [windowAt(p, cx - 2, top + 14, 4, 5)];
  ink(p);
  atlas.add('windmill', p, { snow: true, glow, lights: [{ x: cx, y: top + 16, r: 18, tone: 'warm' }] });

  for (let f = 0; f < BLADE_FRAMES; f++) {
    const b = new Pix(BLADE_SIZE, BLADE_SIZE);
    const c = BLADE_SIZE / 2;
    const spin = (f / BLADE_FRAMES) * (Math.PI / 2);
    for (let arm = 0; arm < 4; arm++) {
      const a = spin + (arm * Math.PI) / 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      for (let u = 2; u < 22; u += 0.5) {
        for (let v = 0; v < 6; v += 0.5) {
          const x = c + dx * u - dy * v;
          const y = c + dy * u + dx * v;
          if (v < 1) b.set(x, y, PAL.woodDark[2]);
          else if (u > 6) b.set(x, y, Math.floor(u) % 4 === 0 || Math.floor(v) === 3 ? PAL.wood[3] : PAL.cream[3]);
        }
      }
    }
    b.ell(c, c, 2.2, 2.2, PAL.woodDark[1]);
    b.set(c - 1, c - 1, PAL.wood[4]);
    ink(b);
    atlas.add(`blades_${f}`, b, { ax: BLADE_SIZE / 2, ay: BLADE_SIZE / 2 });
  }
}

type Crop = 'sprout' | 'wheat' | 'pumpkin' | 'cabbage';
const CROPS: readonly Crop[] = ['sprout', 'wheat', 'pumpkin', 'cabbage'];

function farmPlot(crop: Crop): Pix {
  const p = roomy(28, 20);
  const x0 = ROOM;
  const base = ROOM + 19;
  for (let x = 0; x < 28; x++) {
    for (let y = 0; y < 13; y++) {
      const edge = x === 0 || x === 27 || y === 0 || y === 12;
      p.set(x0 + x, base - 12 + y, edge ? PAL.soil[0] : y % 4 === 3 ? PAL.soil[1] : shade(PAL.soil, 0.55 + hash2(x, y, 3) * 0.4));
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const x = x0 + 3 + col * 5 + (row % 2);
      const y = base - 10 + row * 4;
      if (crop === 'sprout') {
        p.set(x, y, PAL.leaf[4]);
        p.set(x + 1, y - 1, PAL.leaf[5]);
        p.set(x - 1, y - 1, PAL.leaf[3]);
      } else if (crop === 'wheat') {
        for (let i = 0; i < 5; i++) p.set(x + (i > 3 ? 1 : 0), y - i, i > 2 ? PAL.thatch[3] : PAL.thatch[2]);
        p.set(x - 1, y - 3, PAL.thatch[4]);
      } else if (crop === 'pumpkin') {
        p.ball(x + 0.5, y - 0.5, 2.4, 2, PAL.orange, 0, 1);
        p.set(x, y - 3, PAL.leaf[3]);
      } else {
        p.ball(x + 0.5, y - 0.5, 2.4, 2.2, PAL.leaf, 0.2, col);
        p.set(x, y - 1, PAL.leaf[5]);
      }
    }
  }
  return ink(p);
}

function treehouse(atlas: Atlas): void {
  const p = roomy(48, 64);
  const cx = p.w / 2;
  const base = ROOM + 63;
  trunk(p, cx, base - 34, base, 9);
  foliage(p, cx, base - 44, 22, 17, PAL.leafDeep, 71, 12);
  const hx = cx - 11;
  const hy = base - 40;
  planks(p, hx, hy + 8, 22, 11, PAL.wood);
  shingles(p, hx - 2, hy, 26, 9, PAL.roofTeal, 3);
  doorAt(p, hx + 12, hy + 12, 4, 7, PAL.woodDark);
  const glow = [windowAt(p, hx + 3, hy + 11, 5, 4)];
  p.rect(hx - 2, hy + 19, 26, 2, PAL.wood[1]);
  for (let y = hy + 21; y < base; y++) {
    p.set(cx + 5, y, PAL.wood[4]);
    p.set(cx + 9, y, PAL.wood[4]);
    if (y % 3 === 0) p.rect(cx + 5, y, 5, 1, PAL.wood[3]);
  }
  foliage(p, cx - 17, hy + 4, 7, 6, PAL.leafDeep, 5, 5);
  foliage(p, cx + 17, hy + 2, 7, 6, PAL.leafDeep, 6, 5);
  p.rect(cx - 18, hy + 12, 1, 5, PAL.woodDark[2]);
  p.rect(cx - 19, hy + 17, 3, 4, PAL.ember[3]);
  ink(p);
  atlas.add('treehouse', p, {
    glow: [...glow, [cx - 19, hy + 17, 3, 4]],
    lights: [
      { x: hx + 5, y: hy + 13, r: 22, tone: 'warm' },
      { x: cx - 18, y: hy + 19, r: 18, tone: 'warm' },
    ],
  });
}

function roost(atlas: Atlas): void {
  const p = roomy(22, 34);
  const cx = p.w / 2;
  const base = ROOM + 33;
  trunk(p, cx, base - 28, base, 3, PAL.barkPale);
  p.line(cx, base - 20, cx - 8, base - 27, PAL.barkPale[2]);
  p.line(cx, base - 16, cx + 8, base - 24, PAL.barkPale[2]);
  p.line(cx, base - 26, cx + 4, base - 32, PAL.barkPale[3]);
  const pods: number[][] = [[-8, -24], [8, -21], [-4, -15], [4, -29]];
  for (const [dx, dy] of pods) {
    p.rect(cx + dx, base + dy - 3, 1, 3, PAL.ink);
    p.ball(cx + dx + 0.5, base + dy + 2, 2.4, 3, PAL.lilac, 0.1, 3);
  }
  p.set(cx - 1, base - 33, PAL.gold[3]);
  p.rect(cx - 2, base - 32, 1, 2, PAL.gold[3]);
  p.set(cx - 1, base - 30, PAL.gold[2]);
  ink(p);
  atlas.add('roost', p, { snow: true, lights: pods.map(([dx, dy]) => ({ x: cx + dx, y: base + dy + 2, r: 13, tone: 'moon' })), glow: pods.map(([dx, dy]) => [cx + dx - 1, base + dy + 1, 3, 3]) });
}

function observatory(atlas: Atlas): void {
  const p = roomy(30, 44);
  const cx = p.w / 2;
  const base = ROOM + 43;
  const top = base - 22;
  for (let y = top; y <= base; y++) {
    for (let x = cx - 11; x < cx + 11; x++) p.set(x, y, stoneColor(x, y, PAL.stone, 6, (x - cx + 11) / 22));
  }
  const dome = new Pix(p.w, p.h);
  dome.ball(cx, top, 12.5, 12, PAL.roofBlue, 0.08, 7);
  for (let y = top + 1; y < dome.h; y++) for (let x = 0; x < dome.w; x++) dome.clear(x, y);
  p.blit(dome, 0, 0);
  p.rect(cx - 13, top, 26, 2, PAL.metal[3]);
  p.rect(cx - 13, top + 1, 26, 1, PAL.metal[1]);
  p.rect(cx + 1, top - 11, 3, 10, PAL.night[0]);
  p.line(cx + 2, top - 6, cx + 11, top - 15, PAL.copper[3]);
  p.line(cx + 3, top - 6, cx + 12, top - 15, PAL.copper[1]);
  p.rect(cx + 11, top - 17, 3, 3, PAL.copper[4]);
  doorAt(p, cx - 2, base - 8, 5, 8, PAL.woodDark);
  const glow = [windowAt(p, cx - 8, top + 5, 4, 5), windowAt(p, cx + 5, top + 5, 4, 5), [cx + 1, top - 11, 3, 10]];
  ink(p);
  atlas.add('observatory', p, { snow: true, glow, lights: [{ x: cx + 2, y: top - 6, r: 30, tone: 'cool' }] });
}

function moonpool(atlas: Atlas): void {
  const p = roomy(28, 18);
  const cx = p.w / 2;
  const cy = ROOM + 10;
  const r = mulberry(8);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    p.ball(cx + Math.cos(a) * 11.5, cy + Math.sin(a) * 5.6, 2.8 + r(), 2.2 + r() * 0.6, PAL.stone, 0.2, i);
  }
  p.ell(cx, cy, 9.4, 4.2, PAL.violet[1]);
  p.ell(cx - 1, cy - 0.4, 7, 2.8, PAL.lilac[2]);
  p.rect(cx - 3, cy - 2, 3, 1, PAL.lilac[4]);
  p.rect(cx - 4, cy - 1, 2, 2, PAL.lilac[4]);
  p.rect(cx - 3, cy + 1, 3, 1, PAL.lilac[4]);
  p.set(cx + 4, cy + 1, PAL.white);
  ink(p);
  atlas.add('moonpool', p, { glow: [[cx - 8, cy - 3, 16, 6]], lights: [{ x: cx, y: cy, r: 26, tone: 'moon' }] });
}

function crystal(ramp: Ramp, atlas: Atlas, name: string): void {
  const p = roomy(20, 28);
  const cx = p.w / 2;
  const base = ROOM + 27;
  const spires: number[][] = [[-5, 14, 3], [4, 17, 3.4], [0, 25, 4.2]];
  for (const [dx, h, w] of spires) {
    const x = cx + dx;
    p.poly([[x - w, base], [x - w, base - h + 4], [x, base - h], [x, base]], ramp[3]);
    p.poly([[x, base], [x, base - h], [x + w, base - h + 4], [x + w, base]], ramp[1]);
    p.line(x - w + 1, base - h + 5, x - w + 1, base - 3, ramp[4]);
    p.set(x - 1, base - h + 2, PAL.white);
  }
  for (let i = -8; i < 8; i += 4) p.ball(cx + i + 2, base - 1, 3, 2, PAL.stone, 0.2, i);
  ink(p);
  atlas.add(name, p, { snow: true, glow: [[cx - 2, base - 20, 4, 12]], lights: [{ x: cx, y: base - 12, r: 28, tone: 'cool' }] });
}

function shrine(atlas: Atlas): void {
  const p = roomy(28, 30);
  const cx = p.w / 2;
  const base = ROOM + 29;
  masonry(p, cx - 11, base - 20, 5, 21, PAL.stone, 2);
  masonry(p, cx + 6, base - 20, 5, 21, PAL.stone, 3);
  masonry(p, cx - 13, base - 25, 26, 5, PAL.stone, 4);
  p.rect(cx - 13, base - 25, 26, 1, PAL.stone[5]);
  mossCap(p, cx - 13, 26, 3, 4);
  vine(p, cx - 9, base, cx - 9, base - 18, 2);
  vine(p, cx + 8, base, cx + 8, base - 16, 5);
  p.ball(cx, base - 10, 3.6, 3.6, PAL.glow, 0, 1);
  p.set(cx - 1, base - 12, PAL.white);
  ink(p);
  atlas.add('shrine', p, { snow: true, glow: [[cx - 3, base - 13, 6, 6]], lights: [{ x: cx, y: base - 10, r: 30, tone: 'green' }] });
}

function sapling(atlas: Atlas): void {
  const p = roomy(18, 24);
  const cx = Math.floor(p.w / 2);
  const base = ROOM + 23;
  for (let i = 0; i < 7; i++) p.ball(cx - 6 + i * 2 + 0.5, base - 1 + (i % 2), 1.8, 1.5, PAL.stone, 0.2, i);
  p.rect(cx, base - 6, 1, 5, PAL.bark[2]);
  for (let t = 2; t >= 0; t--) {
    const top = base - 20 + t * 5;
    for (let y = 0; y < 7; y++) {
      const hw = lerp(0.5 + t * 0.8, 2.6 + t * 1.5, y / 6);
      for (let x = -Math.ceil(hw); x <= hw; x++) if (Math.abs(x) <= hw + 0.3) p.set(cx + x, top + y, shade(PAL.pine, 0.66 - x * 0.09 - y * 0.05));
    }
  }
  p.set(cx, base - 22, PAL.gold[3]);
  p.rect(cx - 1, base - 21, 3, 1, PAL.gold[3]);
  p.set(cx, base - 20, PAL.gold[2]);
  ink(p);
  atlas.add('sapling', p, { snow: true, glow: [[cx - 1, base - 22, 3, 3]], lights: [{ x: cx, y: base - 21, r: 14, tone: 'gold' }] });
}

export const BLADE_FRAME_COUNT = BLADE_FRAMES;

export function paintBuildings(atlas: Atlas): void {
  for (let i = 0; i < 3; i++) atlas.add(`fern_${i}`, fern(90 + i));
  atlas.add('burrow', burrow(), { snow: true, glow: [[ROOM + 18, ROOM + 11, 1, 1]], lights: [{ x: ROOM + 18, y: ROOM + 11, r: 12, tone: 'warm' }] });
  BED_PLANS.forEach((plan, i) => atlas.add(`bed_${i}`, flowerBed(plan)));
  atlas.add('trellis', trellis());
  for (let i = 0; i < 3; i++) {
    atlas.add(`glowcap_${i}`, glowcaps(120 + i), { snow: true, glow: [[ROOM + 8, ROOM + 4, 8, 6]], lights: [{ x: ROOM + 12, y: ROOM + 8, r: 20, tone: 'green' }] });
  }
  atlas.add('den', den(), { snow: true, glow: [[ROOM + 16, ROOM + 10, 2, 2]], lights: [{ x: ROOM + 17, y: ROOM + 11, r: 14, tone: 'warm' }] });
  for (let i = 0; i < 2; i++) atlas.add(`lilies_${i}`, lilyCluster(i), { ay: ROOM + 8 });
  atlas.add('skiff_0', skiff(PAL.pink), { flip: true, lights: [{ x: ROOM + 18, y: ROOM + 12, r: 14, tone: 'warm' }] });
  atlas.add('skiff_1', skiff(PAL.blue), { flip: true, lights: [{ x: ROOM + 18, y: ROOM + 12, r: 14, tone: 'warm' }] });
  atlas.add('hive_0', hive(false), { snow: true });
  atlas.add('hive_1', hive(true), { snow: true });
  atlas.add('nest', flutterNest(), { snow: true });
  COTTAGES.forEach(([w, roof, plaster, chimney], i) => cottage(w, roof, plaster, chimney, atlas, `cottage_${i}`));
  workshop(PAL.roofBlue, PAL.red[2], atlas, 'workshop_0');
  workshop(PAL.roofRed, PAL.gold[2], atlas, 'workshop_1');
  lantern(atlas);
  windmill(atlas);
  CROPS.forEach((crop, i) => atlas.add(`farm_${i}`, farmPlot(crop)));
  treehouse(atlas);
  roost(atlas);
  observatory(atlas);
  moonpool(atlas);
  crystal(PAL.crystal, atlas, 'crystal_0');
  crystal(PAL.violet, atlas, 'crystal_1');
  shrine(atlas);
  sapling(atlas);
}
