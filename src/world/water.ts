import { RENDER } from '@/config/render';
import { WORLD } from '@/config/world';
import { abgr } from '@/engine/pix';
import { hash2, mulberry, vnoise } from '@/engine/rng';
import type { Terrain } from './terrain';

const W = RENDER.water;

/**
 * The sea, lakes and streams. Four layers make up the water surface:
 *  1. open sea, mottled with darker deeps: a repeating texture, so it has no edge;
 *  2. the shallows that hug every shore;
 *  3. an animated wave texture drifting over both;
 *  4. foam, reflections, glitter and flow, which the scene adds on top.
 */
export class Water {
  /** The shallows around the discovered lands. Painted at reduced resolution and scaled up, for chunky bands. */
  private depth = document.createElement('canvas');
  /** One tile of the open sea's dark patches. */
  private deeps = this.paintDeeps();
  private deepsPattern: CanvasPattern | null = null;
  private waves: HTMLCanvasElement[] = [];
  private patterns: (CanvasPattern | null)[] = [];
  private deepFill = `#${W.colors.deep.toString(16).padStart(6, '0')}`;

  constructor() {
    this.depth.width = Math.ceil(WORLD.width / W.depthScale);
    this.depth.height = Math.ceil(WORLD.height / W.depthScale);
    for (let frame = 0; frame < W.frames; frame++) this.waves.push(this.paintWaves(frame));
    this.repaintDepth([]);
  }

  /** The dark patches of the open sea, as a seamless tile (chunky, like the shallows). */
  private paintDeeps(): HTMLCanvasElement {
    const { cell, cells, level } = W.deeps;
    const size = cell * cells;
    const step = W.depthScale;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const out = new Uint32Array(size * size);
    const trough = abgr(W.colors.trough);
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        if (vnoise(x / cell, y / cell, 5, cells) <= level) continue;
        for (let j = 0; j < step; j++) for (let i = 0; i < step; i++) out[(y + j) * size + x + i] = trough;
      }
    }
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out.buffer as ArrayBuffer), size, size), 0, 0);
    return canvas;
  }

  /** Recompute where the shallows are. Call whenever the set of discovered lands changes. */
  repaintDepth(terrains: readonly Terrain[]): void {
    const { width, height } = this.depth;
    const out = new Uint32Array(width * height);
    const blobs: number[][] = [];
    for (const t of terrains) {
      if (t.layout.floating) continue;
      for (const [bx, by, rx, ry] of t.layout.land) blobs.push([t.layout.at[0] + bx, t.layout.at[1] + by, rx, ry, Math.min(rx, ry)]);
    }
    const mid = abgr(W.colors.mid);
    const shallow = abgr(W.colors.shallow);
    for (let cy = 0; cy < height; cy++) {
      for (let cx = 0; cx < width; cx++) {
        const wx = cx * W.depthScale;
        const wy = cy * W.depthScale;
        let dist = Infinity;
        for (const b of blobs) {
          const d = (Math.hypot((wx - b[0]) / b[2], (wy - b[1]) / b[3]) - 1) * b[4];
          if (d < dist) dist = d;
        }
        // Wobble the band edges so the shallows read as soft, irregular shapes rather than rings.
        dist += (vnoise(wx * 0.03, wy * 0.03, 11) - 0.5) * 22 + (vnoise(wx * 0.09, wy * 0.09, 12) - 0.5) * 8;
        // Beyond the shallows the map stays clear, and the open sea shows through.
        if (dist < W.shallow) out[cy * width + cx] = shallow;
        else if (dist < W.mid) out[cy * width + cx] = mid;
      }
    }
    this.depth.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out.buffer as ArrayBuffer), width, height), 0, 0);
  }

  /** One frame of the tiling wave texture: little crests with a darker trough beneath, which drift and flicker. */
  private paintWaves(frame: number): HTMLCanvasElement {
    const size = W.tile;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const out = new Uint32Array(size * size);
    const r = mulberry(909);
    const set = (x: number, y: number, color: number, alpha: number) => {
      out[(((y % size) + size) % size) * size + (((x % size) + size) % size)] = abgr(color, alpha);
    };
    for (let i = 0; i < W.crests; i++) {
      const x = Math.floor(r() * size);
      const y = Math.floor(r() * size);
      const len = 2 + Math.floor(r() * r() * 9);
      const phase = Math.floor(r() * W.frames);
      const bright = 110 + Math.floor(r() * 90);
      // Each crest swells, drifts sideways, and fades before the cycle repeats.
      const age = (frame + phase) % W.frames;
      if (age === W.frames - 1) continue;
      const fade = age === 0 || age === W.frames - 2 ? 0.6 : 1;
      for (let k = 0; k < len; k++) {
        // Longer crests curl down at their ends; short ones are simple glints.
        const lift = len > 4 && (k === 0 || k === len - 1) ? 1 : 0;
        set(x + k + age, y + lift, W.colors.crest, Math.round(bright * fade));
        if (len > 3 && k > 0 && k < len - 1) set(x + k + age, y + 2, W.colors.trough, 55);
      }
    }
    for (let i = 0; i < 18; i++) if (hash2(i, frame, 3) < 0.5) set(Math.floor(r() * size), Math.floor(r() * size), W.colors.crest, 90);
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out.buffer as ArrayBuffer), size, size), 0, 0);
    return canvas;
  }

  /** Fill the view with the sea itself: open water and shallows. (camX, camY) is the world position of the view's top-left pixel. */
  drawBed(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number): void {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = this.deepFill;
    ctx.fillRect(0, 0, viewW, viewH);
    this.deepsPattern ??= ctx.createPattern(this.deeps, 'repeat');
    this.tile(ctx, this.deepsPattern, this.deeps.width, camX, camY, viewW, viewH);
    ctx.drawImage(this.depth, camX / W.depthScale, camY / W.depthScale, viewW / W.depthScale, viewH / W.depthScale, 0, 0, viewW, viewH);
  }

  /** The waves that drift over everything beneath the surface. */
  drawSurface(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number, time: number): void {
    const frame = Math.floor(time * W.fps) % W.frames;
    this.patterns[frame] ??= ctx.createPattern(this.waves[frame], 'repeat');
    this.tile(ctx, this.patterns[frame], W.tile, camX, camY, viewW, viewH);
  }

  /** Cover the view with a repeating texture that stays fixed to the world as the camera moves. */
  private tile(ctx: CanvasRenderingContext2D, pattern: CanvasPattern | null, size: number, camX: number, camY: number, viewW: number, viewH: number): void {
    if (!pattern) return;
    const ox = -(((camX % size) + size) % size);
    const oy = -(((camY % size) + size) % size);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, viewW - ox, viewH - oy);
    ctx.restore();
  }
}
