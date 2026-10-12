import { PAL } from '@/config/palette';
import { Pix, shade, type Ramp } from '@/engine/pix';
import { hash2, mulberry } from '@/engine/rng';

/** Shared brushes used by every sprite generator, so the whole game shares one hand. */

/** Lumpy, clustered foliage: overlapping leaf clumps, each lit from the top-left. */
export function foliage(p: Pix, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, seed: number, lumps = 9): void {
  const r = mulberry(seed);
  const small = Math.min(rx, ry);
  const bumps: number[][] = [[cx, cy, small * 0.78]];
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + r() * 0.6;
    const u = 0.52 + r() * 0.22;
    bumps.push([cx + Math.cos(a) * rx * u, cy + Math.sin(a) * ry * u, 3 + r() * 2 + small * 0.16]);
  }
  for (let i = 0; i < lumps * 0.7; i++) {
    bumps.push([cx + (r() - 0.5) * rx * 1.1, cy + (r() - 0.5) * ry * 1.1, 2.6 + r() * 2 + small * 0.08]);
  }
  for (let y = Math.floor(cy - ry - 5); y <= cy + ry + 5; y++) {
    for (let x = Math.floor(cx - rx - 5); x <= cx + rx + 5; x++) {
      let best = -1;
      let bx = 0;
      let by = 0;
      for (const b of bumps) {
        const dx = (x + 0.5 - b[0]) / b[2];
        const dy = (y + 0.5 - b[1]) / b[2];
        const height = 1 - Math.sqrt(dx * dx + dy * dy);
        if (height > best) {
          best = height;
          bx = dx;
          by = dy;
        }
      }
      if (best < 0) continue;
      const gx = (x - cx) / rx;
      const gy = (y - cy) / ry;
      const facing = bx * 0.42 + by * 0.6;
      let t = 0.52 - facing * 0.5 - (gx * 0.18 + gy * 0.46) * 0.34 + (hash2(x, y, seed) - 0.5) * 0.08;
      // Deep creases where a clump tucks under its neighbour, crisp highlights on its crown.
      if (best < 0.2 && facing > 0.15) t -= 0.16;
      if (best > 0.25 && facing < -0.45) t += 0.1;
      p.set(x, y, shade(ramp, t));
    }
  }
}

/** A tree trunk with a flared base, lit from the left. */
export function trunk(p: Pix, cx: number, top: number, bottom: number, width: number, ramp: Ramp = PAL.bark): void {
  for (let y = top; y <= bottom; y++) {
    const flare = Math.max(0, y - (bottom - 3)) * 0.8;
    const half = width / 2 + flare;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half) - 1;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      let c = t < 0.3 ? ramp[3] : t < 0.65 ? ramp[2] : ramp[1];
      if (hash2(x, y >> 2, 7) < 0.22) c = ramp[1];
      p.set(x, y, c);
    }
  }
}

/** Rows of overlapping shingles filling a trapezoid (narrower at the ridge). */
export function shingles(p: Pix, x: number, y: number, w: number, h: number, ramp: Ramp, taper = 3): void {
  for (let j = 0; j < h; j++) {
    const inset = Math.round(taper * (1 - j / Math.max(1, h - 1)));
    const row = Math.floor(j / 3);
    const phase = j % 3;
    for (let i = inset; i < w - inset; i++) {
      const side = i / w;
      let level = phase === 0 ? 3 : phase === 1 ? 2 : 1;
      if (phase !== 2 && (i + row * 2) % 4 === 0) level -= 1;
      if (side > 0.7) level -= 1;
      if (j === 0) level = 4;
      if (j === h - 1) level = 0;
      p.set(x + i, y + j, ramp[Math.max(0, Math.min(ramp.length - 1, level))]);
    }
  }
}

/** A chevron roof for gable-front buildings; left slope lit, right slope shaded. */
export function chevronRoof(p: Pix, x: number, y: number, w: number, rise: number, depth: number, ramp: Ramp): void {
  const mid = (w - 1) / 2;
  for (let i = 0; i < w; i++) {
    const drop = Math.round((Math.abs(i - mid) / mid) * rise);
    for (let d = 0; d < depth; d++) {
      let level = d % 3 === 0 ? 3 : d % 3 === 1 ? 2 : 1;
      if (i > mid) level -= 1;
      if (d === 0) level = 4;
      if (d === depth - 1) level = 0;
      if (d % 3 !== 2 && (i + Math.floor(d / 3) * 2) % 4 === 0) level -= 1;
      p.set(x + i, y + drop + d, ramp[Math.max(0, Math.min(ramp.length - 1, level))]);
    }
  }
}

/** Fill everything under a chevron roof down to `bottom` (the gable wall). */
export function gableWall(p: Pix, x: number, y: number, w: number, rise: number, depth: number, bottom: number, paint: (px: number, py: number) => number): void {
  const mid = (w - 1) / 2;
  for (let i = 2; i < w - 2; i++) {
    const top = y + Math.round((Math.abs(i - mid) / mid) * rise) + depth;
    for (let j = top; j <= bottom; j++) p.set(x + i, j, paint(x + i, j));
  }
}

/** Horizontal wooden planks. */
export function planks(p: Pix, x: number, y: number, w: number, h: number, ramp: Ramp = PAL.wood, board = 3): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) p.set(x + i, y + j, plankColor(x + i, y + j, ramp, board, i / w));
  }
}

export function plankColor(px: number, py: number, ramp: Ramp, board = 3, side = 0.5): number {
  const row = Math.floor(py / board);
  let level = py % board === board - 1 ? 1 : 3;
  if (level === 3 && hash2(px >> 1, row, 3) < 0.25) level = 2;
  if (level === 3 && (px + row * 5) % 9 === 0) level = 1;
  if (side > 0.82) level -= 1;
  return ramp[Math.max(0, level)];
}

/** Vertical boards (doors, fences, docks). */
export function boards(p: Pix, x: number, y: number, w: number, h: number, ramp: Ramp = PAL.wood, board = 3): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let level = i % board === board - 1 ? 1 : 3;
      if (level === 3 && hash2(Math.floor(i / board), (y + j) >> 1, 5) < 0.2) level = 2;
      p.set(x + i, y + j, ramp[level]);
    }
  }
}

/** Rough masonry. */
export function masonry(p: Pix, x: number, y: number, w: number, h: number, ramp: Ramp = PAL.stone, seed = 0): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) p.set(x + i, y + j, stoneColor(x + i, y + j, ramp, seed, i / w));
  }
}

export function stoneColor(px: number, py: number, ramp: Ramp, seed = 0, side = 0.5): number {
  const row = Math.floor(py / 4);
  const col = Math.floor((px + (row % 2) * 3) / 6);
  const mortar = py % 4 === 3 || (px + (row % 2) * 3) % 6 === 5;
  let level = mortar ? 1 : 2 + Math.floor(hash2(col, row, seed) * 2);
  if (side > 0.78) level -= 1;
  return ramp[Math.max(0, Math.min(ramp.length - 1, level))];
}

/** Plaster wall with timber framing. */
export function plasterColor(px: number, py: number, x: number, w: number, ramp: Ramp = PAL.plaster): number {
  const i = px - x;
  if (i === 0 || i === w - 1 || i === Math.floor(w / 2)) return PAL.woodDark[2];
  let level = 3;
  if (hash2(px, py, 11) < 0.07) level = 2;
  if (i > w * 0.8) level = 2;
  return ramp[level];
}

/** Fifth entry of a glow rect: 1 = fill with warm lamplight at night instead of re-showing the sprite's own colours. */
export const GLOW_LAMPLIT = 1;

/** A little paned window. Returns its glow rectangle for night lighting. */
export function windowAt(p: Pix, x: number, y: number, w = 5, h = 5): number[] {
  p.rect(x, y, w, h, PAL.woodDark[1]);
  p.rect(x + 1, y + 1, w - 2, h - 2, PAL.blue[3]);
  p.set(x + 1, y + 1, PAL.blue[4]);
  p.rect(x, y + h, w, 1, PAL.wood[4]);
  return [x + 1, y + 1, w - 2, h - 2, GLOW_LAMPLIT];
}

/** A door, optionally arched, with a brass knob. */
export function doorAt(p: Pix, x: number, y: number, w: number, h: number, ramp: Ramp = PAL.woodDark, arched = true): void {
  p.rect(x - 1, y - 1, w + 2, h + 1, PAL.woodDark[0]);
  boards(p, x, y, w, h, ramp, 2);
  if (arched) {
    p.set(x - 1, y - 1, PAL.plaster[1]);
    p.set(x + w, y - 1, PAL.plaster[1]);
    p.clear(x - 1, y - 1);
    p.clear(x + w, y - 1);
  }
  p.set(x + w - 2, y + Math.floor(h / 2), PAL.gold[3]);
}

/** A stone chimney. Returns the point smoke should rise from. */
export function chimneyAt(p: Pix, x: number, y: number, h: number): [number, number] {
  masonry(p, x, y + 2, 4, h - 2, PAL.stone, 9);
  p.rect(x - 1, y, 6, 2, PAL.stone[3]);
  p.rect(x - 1, y + 1, 6, 1, PAL.stone[1]);
  p.rect(x + 1, y, 2, 1, PAL.outline);
  return [x + 2, y - 1];
}

/**
 * A soft cap of moss draped over the top of whatever is already painted in a span of columns.
 * Each column gets a slightly different depth, so the lower edge is ragged but the cap is solid.
 */
export function mossCap(p: Pix, x: number, w: number, depth: number, seed: number, ramp: Ramp = PAL.moss): void {
  for (let i = 0; i < w; i++) {
    const col = Math.floor(x + i);
    let top = 0;
    while (top < p.h && !p.solid(col, top)) top++;
    if (top >= p.h) continue;
    const d = 1 + Math.floor(hash2(col, seed, 7) * depth);
    for (let j = 0; j < d; j++) p.over(col, top + j, ramp[Math.max(0, ramp.length - 1 - j)]);
  }
}

/** A climbing vine: a gently waving stem with a leaf on alternating sides. */
export function vine(p: Pix, x0: number, y0: number, x1: number, y1: number, seed: number): void {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sway = Math.sin(i * 0.8 + seed) * 1.2;
    const horizontal = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    const x = x0 + (x1 - x0) * t + (horizontal ? 0 : sway);
    const y = y0 + (y1 - y0) * t + (horizontal ? sway : 0);
    p.set(x, y, PAL.leaf[2]);
    if (i % 3 === 0) {
      const side = (i / 3) % 2 ? 1 : -1;
      p.set(x + (horizontal ? 0 : side), y + (horizontal ? side : 0), PAL.leaf[4]);
      p.set(x + (horizontal ? 1 : side * 2), y + (horizontal ? side : -1), PAL.leaf[5]);
    }
  }
}

/**
 * Dot a painted surface with small ornaments (berries, blossoms, fruit). Spots are seeded,
 * evenly spaced, and only chosen where the ornament sits fully inside the body.
 */
export function ornaments(p: Pix, count: number, seed: number, spacing: number, stamp: (x: number, y: number, index: number) => void, maxY = Infinity): void {
  const r = mulberry(seed);
  const placed: number[][] = [];
  for (let tries = 0; tries < count * 60 && placed.length < count; tries++) {
    const x = Math.floor(r() * p.w);
    const y = Math.floor(r() * Math.min(p.h, maxY));
    let inside = true;
    for (let dy = -1; dy <= 2 && inside; dy++) for (let dx = -1; dx <= 2; dx++) if (!p.solid(x + dx, y + dy)) inside = false;
    if (!inside || placed.some(([px, py]) => Math.abs(px - x) < spacing && Math.abs(py - y) < spacing)) continue;
    placed.push([x, y]);
    stamp(x, y, placed.length - 1);
  }
}

/** A round 2×2 berry or fruit: lit top-left, shaded bottom-right. */
export const berryStamp = (p: Pix, ramp: Ramp) => (x: number, y: number) => {
  p.set(x, y, ramp[4]);
  p.set(x + 1, y, ramp[2]);
  p.set(x, y + 1, ramp[2]);
  p.set(x + 1, y + 1, ramp[1]);
};

/** A tiny four-petalled blossom with a golden centre. */
export const blossomStamp = (p: Pix, ramp: Ramp) => (x: number, y: number) => {
  p.set(x - 1, y, ramp[4]);
  p.set(x, y - 1, ramp[4]);
  p.set(x + 1, y, ramp[3]);
  p.set(x, y + 1, ramp[3]);
  p.set(x, y, PAL.yellow[3]);
};

/** Margin generators leave around their subject so outlines and foliage never clip. */
export const ROOM = 8;

/**
 * The outline every sprite gets. By default it is tinted by the colours it borders
 * (deep green around leaves, deep brown around wood); pass a colour for a flat line.
 */
export function ink(p: Pix, color?: number): Pix {
  return color === undefined ? p.outlineTinted(PAL.outline) : p.outline(color);
}

/** Derive a winter look: a cap of snow settles on every upward-facing edge. */
export function snowify(src: Pix): Pix {
  const p = src.clone();
  const snow = PAL.grassWinter;
  for (let x = 0; x < p.w; x++) {
    // `run` counts solid pixels since the last gap; row 0 is the outline itself.
    let run = 0;
    for (let y = 0; y < p.h; y++) {
      if (!src.solid(x, y)) {
        run = 0;
        continue;
      }
      const hasBody = src.solid(x, y + 1);
      if (run === 1 && hasBody) p.set(x, y, snow[5]);
      else if (run === 2 && hasBody && hash2(x, y, 31) < 0.6) p.set(x, y, snow[3]);
      run++;
    }
  }
  return p;
}
