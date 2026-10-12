import { hash2 } from './rng';

/** A colour ramp, ordered dark → light. Colours are 0xRRGGBB. */
export type Ramp = readonly number[];

/** Pack 0xRRGGBB + alpha into the little-endian ABGR layout ImageData uses. */
export function abgr(color: number, alpha = 255): number {
  return ((alpha << 24) | ((color & 0xff) << 16) | (color & 0xff00) | ((color >> 16) & 0xff)) >>> 0;
}

/** Pick a ramp entry from a 0..1 brightness. */
export function shade(ramp: Ramp, t: number): number {
  const i = Math.floor(t * ramp.length);
  return ramp[i < 0 ? 0 : i >= ramp.length ? ramp.length - 1 : i];
}

/**
 * A tiny software pixel painter. Every sprite in the game is drawn through this,
 * then baked into the texture atlas. All coordinates are in whole pixels.
 */
export class Pix {
  readonly d: Uint32Array;
  /** Alpha applied to subsequent writes. */
  alpha = 255;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Uint32Array(w * h);
  }

  /** True when the pixel is inside the canvas and mostly opaque. */
  solid(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] >>> 24 > 127;
  }

  set(x: number, y: number, color: number): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = abgr(color, this.alpha);
    return this;
  }

  /** Write only where nothing has been drawn yet. */
  under(x: number, y: number, color: number): this {
    if (!this.solid(Math.floor(x), Math.floor(y))) this.set(x, y, color);
    return this;
  }

  /** Write only on top of existing pixels (for details and texture). */
  over(x: number, y: number, color: number): this {
    if (this.solid(Math.floor(x), Math.floor(y))) this.set(x, y, color);
    return this;
  }

  clear(x: number, y: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = 0;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
    return this;
  }

  /** Filled ellipse. Centre may sit on half pixels. */
  ell(cx: number, cy: number, rx: number, ry: number, color: number): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, color);
      }
    }
    return this;
  }

  /** Shaded ellipsoid lit from the top-left, with optional dithered texture. */
  ball(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, texture = 0.12, seed = 0): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const light = 0.56 - (dx * 0.42 + dy * 0.6) * 0.62 + (hash2(x, y, seed) - 0.5) * texture;
        this.set(x, y, shade(ramp, light));
      }
    }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, color: number): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Filled convex or concave polygon (even-odd scanline). Points are [x, y] pairs. */
  poly(points: readonly (readonly number[])[], color: number): this {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const cy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (a[1] <= cy !== b[1] <= cy) xs.push(a[0] + ((cy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, color);
      }
    }
    return this;
  }

  /** Paint a 1px outline on transparent pixels that touch solid ones. */
  outline(color: number, corners = false): this {
    const src = this.d.slice();
    const { w, h } = this;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 127;
    const c = abgr(color, 255);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (on(x, y)) continue;
        const edge = on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1);
        const diag = corners && (on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1));
        if (edge || diag) this.d[y * w + x] = c;
      }
    }
    return this;
  }

  /**
   * Outline tinted by whatever it borders: each edge pixel takes a deep, slightly
   * violet version of its neighbour's colour. Softer and warmer than a black line.
   */
  outlineTinted(base: number, mix = 0.4): this {
    const src = this.d.slice();
    const { w, h } = this;
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 127 ? src[y * w + x] : 0);
    const br = (base >> 16) & 0xff;
    const bg = (base >> 8) & 0xff;
    const bb = base & 0xff;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (at(x, y)) continue;
        const n = at(x, y + 1) || at(x + 1, y) || at(x - 1, y) || at(x, y - 1);
        if (!n) continue;
        const r = ((n & 0xff) * 0.36 * (1 - mix) + br * mix) | 0;
        const g = (((n >> 8) & 0xff) * 0.32 * (1 - mix) + bg * mix) | 0;
        const b = (((n >> 16) & 0xff) * 0.44 * (1 - mix) + bb * mix) | 0;
        this.d[y * w + x] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
      }
    }
    return this;
  }

  /** True when something was painted on the outermost pixels (a sign it may be clipped). */
  touchesEdge(): boolean {
    const { w, h } = this;
    for (let x = 0; x < w; x++) if (this.d[x] >>> 24 || this.d[(h - 1) * w + x] >>> 24) return true;
    for (let y = 0; y < h; y++) if (this.d[y * w] >>> 24 || this.d[y * w + w - 1] >>> 24) return true;
    return false;
  }

  /** Copy of a sub-rectangle. */
  crop(x: number, y: number, w: number, h: number): Pix {
    const out = new Pix(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.d[j * w + i] = this.d[(y + j) * this.w + x + i];
    return out;
  }

  /** Copy another painter onto this one, skipping transparent pixels. */
  blit(src: Pix, dx: number, dy: number, flip = false): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const v = src.d[y * src.w + (flip ? src.w - 1 - x : x)];
        if (v >>> 24 === 0) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.d[ty * this.w + tx] = v;
      }
    }
    return this;
  }

  /** Visit every solid pixel; return a colour to repaint it or undefined to leave it. */
  map(fn: (x: number, y: number, raw: number) => number | undefined): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const raw = this.d[y * this.w + x];
        if (raw >>> 24 < 128) continue;
        const out = fn(x, y, raw);
        if (out !== undefined) this.d[y * this.w + x] = abgr(out, raw >>> 24);
      }
    }
    return this;
  }

  /** Swap exact colours (used for palette variants). */
  recolor(pairs: readonly (readonly [number, number])[]): this {
    const table = new Map(pairs.map(([from, to]) => [abgr(from), abgr(to)]));
    for (let i = 0; i < this.d.length; i++) {
      const to = table.get(this.d[i]);
      if (to !== undefined) this.d[i] = to;
    }
    return this;
  }

  clone(): Pix {
    const out = new Pix(this.w, this.h);
    out.d.set(this.d);
    return out;
  }

  /** Mirrored copy. */
  flipped(): Pix {
    return new Pix(this.w, this.h).blit(this, 0, 0, true);
  }

  /** Tight bounds of everything drawn: [x, y, w, h]. */
  bounds(): [number, number, number, number] {
    let x0 = this.w;
    let y0 = this.h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.d[y * this.w + x] >>> 24 === 0) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    return x1 < 0 ? [0, 0, 1, 1] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  }

  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.d.buffer.slice(0) as ArrayBuffer), this.w, this.h);
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.getContext('2d')!.putImageData(this.toImageData(), 0, 0);
    return canvas;
  }
}
