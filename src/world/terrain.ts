import { GROUNDS, PAL } from '@/config/palette';
import { WORLD, type Blob, type Point, type RegionLayout } from '@/config/world';
import type { Rect } from '@/engine/camera';
import { abgr, shade, type Ramp } from '@/engine/pix';
import { hash2, vnoise } from '@/engine/rng';

/** What a terrain pixel is. */
export const SEA = 0;
export const LAND = 1;
export const POND = 2;
export const PATH = 3;

export const SEASONS = 3;
export const FOAM_FRAMES = 2;

/** One generated island: its collision mask and its painted looks. */
export interface Terrain {
  id: string;
  layout: RegionLayout;
  /** World-space rectangle the patch covers. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** SEA / LAND / POND / PATH for every pixel of the patch. */
  mask: Uint8Array;
  /** Painted ground for each season. */
  patches: HTMLCanvasElement[];
  /** The shoreline's reflection for each season (same origin as the patch, a little taller). */
  mirrors: HTMLCanvasElement[];
  /** World y of the waterline under each column of the patch (0 = no shore in that column). */
  shore: Int16Array;
  /** Animated shoreline foam. */
  foam: HTMLCanvasElement[];
  /** Tight bounds of the land itself, for framing the camera. */
  bounds: Rect;
}

const MARGIN = 12;
const COAST_WOBBLE = 0.22;
/** How many pixels of shoreline are mirrored into the water. */
const MIRROR_DEPTH = 20;

const inBlob = (x: number, y: number, [bx, by, rx, ry]: Blob, grow = 0) => Math.hypot((x - bx) / rx, (y - by) / ry) + grow;

function segmentDistance(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
}

function lineDistance(px: number, py: number, line: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, segmentDistance(px, py, line[i], line[i + 1]));
  return best;
}

/** Classify one point of a region (local coordinates). The coastline wobbles with noise so no two islands look stamped. */
function classify(layout: RegionLayout, lx: number, ly: number): number {
  const wx = layout.at[0] + lx;
  const wy = layout.at[1] + ly;
  const wobble = (vnoise(wx * 0.045, wy * 0.045, WORLD.seed) - 0.5) * COAST_WOBBLE + (vnoise(wx * 0.14, wy * 0.14, WORLD.seed + 1) - 0.5) * 0.07;
  let land = false;
  for (const blob of layout.land) if (inBlob(lx, ly, blob, wobble) < 1) land = true;
  if (!land) return SEA;
  for (const pond of layout.ponds ?? []) if (inBlob(lx, ly, pond, wobble * 0.5) < 1) return POND;
  for (const stream of layout.streams ?? []) if (lineDistance(lx, ly, stream.line) < stream.width / 2 + wobble * 3) return POND;
  for (const path of layout.paths ?? []) if (lineDistance(lx, ly, path) < 3.3 + wobble * 5) return PATH;
  return LAND;
}

const solid = (v: number) => v === LAND || v === PATH;

/** The rocky underside of a floating island: an inverted cone under the land blobs. 0 = none, else 0..1 depth. */
function underside(layout: RegionLayout, lx: number, ly: number): number {
  const steps = 7;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const shrink = 1 - 0.8 * t;
    for (const [bx, by, rx, ry] of layout.land) {
      if (Math.hypot((lx - bx) / (rx * shrink), (ly - t * WORLD.floatDepth - by) / (ry * shrink)) < 1) return t;
    }
  }
  return 0;
}

export function buildTerrain(layout: RegionLayout): Terrain {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [bx, by, rx, ry] of layout.land) {
    x0 = Math.min(x0, bx - rx);
    y0 = Math.min(y0, by - ry);
    x1 = Math.max(x1, bx + rx);
    y1 = Math.max(y1, by + ry);
  }
  const depth = layout.floating ? WORLD.floatDepth : WORLD.cliff;
  const lx0 = Math.floor(x0 - MARGIN * 2);
  const ly0 = Math.floor(y0 - MARGIN * 2);
  const w = Math.ceil(x1 - x0 + MARGIN * 4);
  const h = Math.ceil(y1 - y0 + MARGIN * 4 + depth);

  const mask = new Uint8Array(w * h);
  let bx0 = w;
  let by0 = h;
  let bx1 = 0;
  let by1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = classify(layout, lx0 + x, ly0 + y);
      mask[y * w + x] = v;
      if (v !== SEA) {
        bx0 = Math.min(bx0, x);
        by0 = Math.min(by0, y);
        bx1 = Math.max(bx1, x);
        by1 = Math.max(by1, y);
      }
    }
  }

  const terrain: Terrain = {
    id: layout.id,
    layout,
    x: layout.at[0] + lx0,
    y: layout.at[1] + ly0,
    w,
    h,
    mask,
    patches: [],
    mirrors: [],
    shore: new Int16Array(w),
    foam: [],
    bounds: { x: layout.at[0] + lx0 + bx0, y: layout.at[1] + ly0 + by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 + depth },
  };
  for (let season = 0; season < SEASONS; season++) {
    const pixels = paintGround(terrain, season);
    terrain.patches.push(toCanvas(w, h, pixels));
    terrain.mirrors.push(layout.floating ? toCanvas(1, 1, new Uint32Array(1)) : mirrorShore(terrain, pixels));
  }
  for (let frame = 0; frame < FOAM_FRAMES; frame++) terrain.foam.push(paintFoam(terrain, frame));
  return terrain;
}

/**
 * The land's own reflection: for every column, the strip of cliff and grass just above the
 * waterline is flipped below it and faded out with depth. Also records where each column's waterline is.
 */
function mirrorShore(t: Terrain, pixels: Uint32Array): HTMLCanvasElement {
  const { w, h } = t;
  const out = new Uint32Array(w * (h + MIRROR_DEPTH));
  for (let x = 0; x < w; x++) {
    let bottom = h - 1;
    while (bottom >= 0 && pixels[bottom * w + x] >>> 24 < 255) bottom--;
    if (bottom < 0) continue;
    t.shore[x] = t.y + bottom + 1;
    for (let k = 0; k < MIRROR_DEPTH && bottom - k >= 0; k++) {
      const source = pixels[(bottom - k) * w + x];
      if (source >>> 24 < 255) continue;
      const alpha = Math.round(255 * (1 - k / MIRROR_DEPTH) ** 1.4);
      out[(bottom + 1 + k) * w + x] = ((source & 0x00ffffff) | (alpha << 24)) >>> 0;
    }
  }
  return toCanvas(w, h + MIRROR_DEPTH, out);
}

/** World y of the waterline directly south of a point, or NaN where its column has no shore. */
export function shoreBelow(t: Terrain, wx: number): number {
  const x = Math.floor(wx - t.x);
  return x < 0 || x >= t.w || t.shore[x] === 0 ? NaN : t.shore[x];
}

/** Mask value at a world position (SEA outside the patch). */
export function terrainAt(t: Terrain, wx: number, wy: number): number {
  const x = Math.floor(wx - t.x);
  const y = Math.floor(wy - t.y);
  return x < 0 || y < 0 || x >= t.w || y >= t.h ? SEA : t.mask[y * t.w + x];
}

function toCanvas(w: number, h: number, pixels: Uint32Array): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer as ArrayBuffer), w, h), 0, 0);
  return canvas;
}

function paintGround(t: Terrain, season: number): Uint32Array {
  const { w, h, mask, layout } = t;
  const look = GROUNDS[layout.ground] ?? GROUNDS.grass;
  const grass: Ramp = look.grass[season];
  const path: Ramp = season === 2 ? [look.path[1], look.path[2], look.path[3], look.path[4], PAL.grassWinter[3]] : look.path;
  const cliff = look.cliff;
  const out = new Uint32Array(w * h);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? SEA : mask[y * w + x]);
  const seed = WORLD.seed;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wx = t.x + x;
      const wy = t.y + y;
      const v = mask[y * w + x];
      let color = -1;
      let alpha = 255;

      if (v === LAND) {
        const nearWater = at(x - 1, y) === POND || at(x + 1, y) === POND || at(x, y - 1) === POND || at(x, y + 1) === POND;
        if (nearWater) color = cliff[2];
        else {
          const patch = vnoise(wx * 0.035, wy * 0.035, seed + 2) * 0.7 + vnoise(wx * 0.11, wy * 0.11, seed + 3) * 0.3;
          let level = patch > 0.53 ? 3 : 2;
          // Grass blades: short dark strokes and the odd bright fleck.
          if (hash2(wx, wy, seed) < 0.035 || hash2(wx, wy - 1, seed) < 0.035) level -= 1;
          else if (hash2(wx, wy, seed + 4) > 0.975) level += 1;
          if (!solid(at(x, y - 1))) level = 4;
          else if (!solid(at(x, y + 1)) && at(x, y + 1) !== POND) level = 1;
          color = grass[level];
        }
      } else if (v === PATH) {
        const edge = at(x - 1, y) === LAND || at(x + 1, y) === LAND || at(x, y + 1) === LAND;
        let level = vnoise(wx * 0.09, wy * 0.09, seed + 5) > 0.5 ? 3 : 2;
        if (edge) level = 1;
        else if (at(x, y - 1) === LAND) level = 4;
        else if (hash2(wx, wy, seed + 6) > 0.96) level = 4;
        else if (hash2(wx, wy, seed + 7) < 0.04) level = 1;
        color = path[Math.min(path.length - 1, level)];
      } else if (v === POND) {
        // The bank casts a little depth onto the water just below it.
        if (solid(at(x, y - 1))) [color, alpha] = [PAL.water[0], 170];
        else if (solid(at(x, y - 2))) [color, alpha] = [PAL.water[0], 90];
      } else if (layout.floating) {
        const d = underside(layout, wx - layout.at[0], wy - layout.at[1]);
        if (d > 0) {
          let k = 0.86 - d * 0.7 + (hash2(wx >> 1, wy >> 2, seed) - 0.5) * 0.25;
          if (hash2(wx >> 2, wy >> 2, seed + 8) > 0.82) k += 0.15;
          color = shade(cliff, k);
        }
      } else {
        // Sea: is there land within cliff height straight above? Then this is the cliff face.
        const tall = WORLD.cliff + (hash2(wx >> 2, 0, seed) < 0.3 ? 1 : 0);
        let k = 0;
        for (let i = 1; i <= tall + 5; i++) {
          if (solid(at(x, y - i)) || at(x, y - i) === POND) {
            k = i;
            break;
          }
        }
        if (k > 0 && k <= tall) {
          let level = k <= 2 ? 3 : k <= 4 ? 2 : 1;
          if (k === tall) level = 0;
          else if (hash2(wx >> 1, 0, seed + 9) < 0.3) level -= 1;
          else if (hash2(wx >> 2, wy >> 2, seed + 10) > 0.86) level += 1;
          color = cliff[Math.max(0, Math.min(cliff.length - 1, level))];
        } else if (k > tall) {
          // Contact shade where the cliff meets the sea.
          [color, alpha] = [PAL.water[0], Math.round(110 * (1 - (k - tall) / 6))];
        }
      }
      if (color >= 0) out[y * w + x] = abgr(color, alpha);
    }
  }
  return out;
}

function paintFoam(t: Terrain, frame: number): HTMLCanvasElement {
  const { w, h, mask, layout } = t;
  const out = new Uint32Array(w * h);
  if (layout.floating) return toCanvas(w, h, out);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? SEA : mask[y * w + x]);
  // "Shore" = land, or the cliff face hanging below it.
  const shore = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] !== SEA) {
        shore[y * w + x] = mask[y * w + x] === POND ? 0 : 1;
        continue;
      }
      for (let i = 1; i <= WORLD.cliff; i++) {
        if (at(x, y - i) !== SEA) {
          shore[y * w + x] = 1;
          break;
        }
      }
    }
  }
  const reach = 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (shore[y * w + x]) continue;
      const pond = mask[y * w + x] === POND;
      let d = reach + 1;
      for (let dy = -reach; dy <= (pond ? 1 : reach) && d > 1; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx < 0 || sy < 0 || sx >= w || sy >= h || !shore[sy * w + sx]) continue;
          // Foam gathers below and beside the shore, not on the far side behind it.
          if (dy > 0 && !pond) continue;
          d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      }
      if (d > reach) continue;
      const wx = t.x + x;
      const wy = t.y + y;
      const roll = hash2(wx >> 1, wy, WORLD.seed + 20 + frame);
      if (pond) {
        if (d === 1 && roll < 0.55) out[y * w + x] = abgr(PAL.water[4], 150);
      } else if (d === 1) out[y * w + x] = abgr(PAL.water[5], roll < 0.85 ? 235 : 150);
      else if (d === 2 && roll < 0.5) out[y * w + x] = abgr(PAL.water[5], 170);
      else if (d === 3 && roll < 0.16) out[y * w + x] = abgr(PAL.water[4], 150);
    }
  }
  return toCanvas(w, h, out);
}
