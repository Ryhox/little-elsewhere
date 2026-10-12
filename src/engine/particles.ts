import { abgr } from './pix';
import { clamp } from './rng';

/**
 * A pooled, allocation-free particle system.
 *
 * Particles live in flat typed arrays (struct-of-arrays) and are rasterised straight
 * into a pixel buffer, so tens of thousands of them cost a handful of array writes each
 * and never touch the garbage collector. Every particle type is plain data (ParticleKind).
 */

export type ParticleShape = 'dot' | 'block' | 'plus' | 'streak' | 'dash' | 'ring';

export interface ParticleKind {
  /** Colour ramp over the particle's life, 0xRRGGBB, start → end. */
  colors: readonly number[];
  /** Lifetime range in seconds. */
  life: readonly [number, number];
  /** One shape, or several to step through over its life. */
  shape?: ParticleShape | readonly ParticleShape[];
  /** Downward pull on the height axis, px/s². Particles with gravity land on the ground. */
  gravity?: number;
  /** Fraction of velocity lost per second. */
  drag?: number;
  /** Steady upward drift in px/s (smoke, embers, sparkles). */
  rise?: number;
  /** Sideways sway: [pixels, cycles per second]. */
  wobble?: readonly [number, number];
  /** Share of life spent fading in and out (0..1). */
  fadeIn?: number;
  fadeOut?: number;
  /** Peak opacity, 0..1. */
  alpha?: number;
  /** Drawn after lighting, so it shines in the dark. */
  glow?: boolean;
  /** Energy kept when hitting the ground; 0 removes the particle on landing. */
  bounce?: number;
  /** Another kind spawned where this one lands (e.g. a droplet leaves a ripple). */
  lands?: string;
  /** Final radius of a `ring` shape. */
  ringSize?: number;
}

/** How to throw a handful of particles at once. Angles in radians, 0 = right. */
export interface Burst {
  kind: string;
  count: readonly [number, number];
  /** Speed along the ground, px/s. */
  speed?: readonly [number, number];
  angle?: readonly [number, number];
  /** Initial upward speed, px/s. */
  up?: readonly [number, number];
  /** Random offset from the origin, px. */
  spread?: number;
  /** Starting height above the ground, px. */
  height?: readonly [number, number];
}

const SHAPES: Record<Exclude<ParticleShape, 'ring'>, readonly number[]> = {
  dot: [0, 0],
  block: [0, 0, 1, 0, 0, 1, 1, 1],
  plus: [0, 0, -1, 0, 1, 0, 0, -1, 0, 1],
  streak: [0, 0, 0, 1, 0, 2],
  dash: [0, 0, 1, 0],
};
const ALPHA_STEPS = 8;
const RING = -1;

interface Baked {
  /** colours × alpha steps, pre-packed for direct buffer writes. */
  table: Uint32Array;
  /** Index of this kind's first colour in the system-wide colour list. */
  colorBase: number;
  colorCount: number;
  life0: number;
  life1: number;
  shapes: (readonly number[] | typeof RING)[];
  gravity: number;
  drag: number;
  rise: number;
  wobbleAmp: number;
  wobbleHz: number;
  fadeIn: number;
  fadeOut: number;
  glow: boolean;
  bounce: number;
  lands: number;
  ringSize: number;
}

/** A canvas-backed pixel buffer that only clears and uploads the rows that were touched. */
export class PixelLayer {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private image!: ImageData;
  px!: Uint32Array;
  w = 0;
  h = 0;
  private top = Infinity;
  private bottom = -1;
  private lastTop = Infinity;
  private lastBottom = -1;

  resize(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.w = this.canvas.width = w;
    this.h = this.canvas.height = h;
    this.image = this.ctx.createImageData(w, h);
    this.px = new Uint32Array(this.image.data.buffer);
    this.top = this.lastTop = Infinity;
    this.bottom = this.lastBottom = -1;
  }

  /** Wipe whatever was drawn last frame. */
  begin(): void {
    if (this.bottom >= this.top) this.px.fill(0, this.top * this.w, (this.bottom + 1) * this.w);
    this.lastTop = this.top;
    this.lastBottom = this.bottom;
    this.top = Infinity;
    this.bottom = -1;
  }

  mark(y0: number, y1: number): void {
    if (y0 < this.top) this.top = y0 < 0 ? 0 : y0;
    if (y1 > this.bottom) this.bottom = y1 >= this.h ? this.h - 1 : y1;
  }

  /** Upload the changed rows to the canvas. Returns false when the layer is empty. */
  end(): boolean {
    const top = Math.min(this.top, this.lastTop);
    const bottom = Math.max(this.bottom, this.lastBottom);
    if (bottom < top) return false;
    this.ctx.putImageData(this.image, 0, 0, 0, top, this.w, bottom - top + 1);
    return this.bottom >= this.top;
  }
}

export class ParticleSystem {
  /** 0..1: scales how many particles are actually spawned (the quality setting). */
  density = 1;
  count = 0;

  private readonly cap: number;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly z: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly vz: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly phase: Float32Array;
  private readonly kind: Uint8Array;
  private readonly baked: Baked[] = [];
  private readonly ids = new Map<string, number>();
  private carry = 0;
  /** Scratch space for the rectangle renderer: per-particle group and position, and the sorted order. */
  private readonly key: Int32Array;
  private readonly px: Int32Array;
  private readonly py: Int32Array;
  private readonly order: Int32Array;
  /** One entry per colour across all kinds: its CSS colour and peak opacity. */
  private readonly css: string[] = [];
  private readonly peak: number[] = [];
  private groupSize!: Int32Array;
  private groupStart!: Int32Array;

  constructor(kinds: Record<string, ParticleKind>, capacity: number) {
    this.cap = capacity;
    this.key = new Int32Array(capacity);
    this.px = new Int32Array(capacity);
    this.py = new Int32Array(capacity);
    this.order = new Int32Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.phase = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
    const names = Object.keys(kinds);
    names.forEach((name, i) => this.ids.set(name, i));
    for (const name of names) this.baked.push(this.bake(kinds[name]));
    this.groupSize = new Int32Array(this.css.length * ALPHA_STEPS);
    this.groupStart = new Int32Array(this.css.length * ALPHA_STEPS);
  }

  private bake(k: ParticleKind): Baked {
    const peak = k.alpha ?? 1;
    const colorBase = this.css.length;
    for (const color of k.colors) {
      this.css.push(`#${color.toString(16).padStart(6, '0')}`);
      this.peak.push(peak);
    }
    const table = new Uint32Array(k.colors.length * ALPHA_STEPS);
    k.colors.forEach((color, c) => {
      for (let a = 0; a < ALPHA_STEPS; a++) table[c * ALPHA_STEPS + a] = abgr(color, Math.round(((a + 1) / ALPHA_STEPS) * 255 * peak));
    });
    const shapes = (Array.isArray(k.shape) ? k.shape : [k.shape ?? 'dot']) as ParticleShape[];
    return {
      table,
      colorBase,
      colorCount: k.colors.length,
      life0: k.life[0],
      life1: k.life[1],
      shapes: shapes.map((s) => (s === 'ring' ? RING : SHAPES[s])),
      gravity: k.gravity ?? 0,
      drag: k.drag ?? 0,
      rise: k.rise ?? 0,
      wobbleAmp: k.wobble?.[0] ?? 0,
      wobbleHz: k.wobble?.[1] ?? 0,
      fadeIn: k.fadeIn ?? 0,
      fadeOut: k.fadeOut ?? 0.3,
      glow: !!k.glow,
      bounce: k.bounce ?? 0,
      lands: k.lands ? (this.ids.get(k.lands) ?? -1) : -1,
      ringSize: k.ringSize ?? 6,
    };
  }

  /** Numeric id of a kind, for hot paths that spawn every frame. */
  id(name: string): number {
    const id = this.ids.get(name);
    if (id === undefined) throw new Error(`Unknown particle kind "${name}"`);
    return id;
  }

  /** Spawn one particle. `z` is height above the ground; `vz` is upward speed. */
  spawn(kind: number, x: number, y: number, z = 0, vx = 0, vy = 0, vz = 0): void {
    if (this.count >= this.cap) return;
    const i = this.count++;
    const b = this.baked[kind];
    this.kind[i] = kind;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.age[i] = 0;
    this.life[i] = b.life0 + Math.random() * (b.life1 - b.life0);
    this.phase[i] = Math.random() * 6.2832;
  }

  /** Throw a burst of particles from a point. `scale` multiplies the count. */
  burst(spec: Burst, x: number, y: number, scale = 1): void {
    const kind = this.id(spec.kind);
    const wanted = (spec.count[0] + Math.random() * (spec.count[1] - spec.count[0])) * scale * this.density + this.carry;
    const n = Math.floor(wanted);
    this.carry = wanted - n;
    const [s0, s1] = spec.speed ?? [0, 0];
    const [a0, a1] = spec.angle ?? [0, 6.2832];
    const [u0, u1] = spec.up ?? [0, 0];
    const [h0, h1] = spec.height ?? [0, 0];
    const spread = spec.spread ?? 0;
    for (let i = 0; i < n; i++) {
      const a = a0 + Math.random() * (a1 - a0);
      const s = s0 + Math.random() * (s1 - s0);
      this.spawn(kind, x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread, h0 + Math.random() * (h1 - h0), Math.cos(a) * s, Math.sin(a) * s * 0.6, u0 + Math.random() * (u1 - u0));
    }
  }

  update(dt: number): void {
    const { x, y, z, vx, vy, vz, age, life, kind, baked } = this;
    for (let i = this.count - 1; i >= 0; i--) {
      const b = baked[kind[i]];
      age[i] += dt;
      let dead = age[i] >= life[i];
      if (!dead) {
        if (b.drag) {
          const keep = 1 - b.drag * dt;
          vx[i] *= keep;
          vy[i] *= keep;
        }
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        if (b.gravity) {
          vz[i] -= b.gravity * dt;
          z[i] += vz[i] * dt;
          if (z[i] <= 0 && vz[i] < 0) {
            if (b.lands >= 0) this.spawn(b.lands, x[i], y[i]);
            if (b.bounce > 0 && vz[i] < -12) {
              z[i] = 0;
              vz[i] = -vz[i] * b.bounce;
            } else dead = true;
          }
        } else if (b.rise || vz[i]) z[i] += (b.rise + vz[i]) * dt;
      }
      if (dead) {
        // Swap-remove: the last live particle takes this slot.
        const last = --this.count;
        if (i !== last) {
          x[i] = x[last];
          y[i] = y[last];
          z[i] = z[last];
          vx[i] = vx[last];
          vy[i] = vy[last];
          vz[i] = vz[last];
          age[i] = age[last];
          life[i] = life[last];
          this.phase[i] = this.phase[last];
          kind[i] = kind[last];
        }
      }
    }
  }

  /** Rasterise either the lit or the glowing particles into a pixel layer. */
  render(layer: PixelLayer, glow: boolean, camX: number, camY: number, time: number): void {
    const { x, y, z, age, life, kind, baked, phase } = this;
    const { px, w, h } = layer;
    for (let i = 0; i < this.count; i++) {
      const b = baked[kind[i]];
      if (b.glow !== glow) continue;
      const t = age[i] / life[i];
      let sx = x[i] - camX;
      if (b.wobbleAmp) sx += Math.sin(phase[i] + time * b.wobbleHz * 6.2832) * b.wobbleAmp;
      const px0 = Math.floor(sx);
      const py0 = Math.floor(y[i] - z[i] - camY);
      if (px0 < -8 || py0 < -8 || px0 >= w + 8 || py0 >= h + 8) continue;
      let a = 1;
      if (b.fadeIn && t < b.fadeIn) a = t / b.fadeIn;
      else if (b.fadeOut && t > 1 - b.fadeOut) a = (1 - t) / b.fadeOut;
      const color = b.table[Math.min(b.colorCount - 1, Math.floor(t * b.colorCount)) * ALPHA_STEPS + clamp(Math.floor(a * ALPHA_STEPS), 0, ALPHA_STEPS - 1)];
      const shape = b.shapes[Math.min(b.shapes.length - 1, Math.floor(t * b.shapes.length))];
      if (shape === RING) {
        const r = 1 + t * b.ringSize;
        const steps = Math.ceil(r * 5);
        for (let k = 0; k < steps; k++) {
          const ang = (k / steps) * 6.2832;
          const qx = Math.round(px0 + Math.cos(ang) * r);
          const qy = Math.round(py0 + Math.sin(ang) * r * 0.5);
          if (qx >= 0 && qy >= 0 && qx < w && qy < h) px[qy * w + qx] = color;
        }
        layer.mark(py0 - Math.ceil(r), py0 + Math.ceil(r));
        continue;
      }
      for (let k = 0; k < shape.length; k += 2) {
        const qx = px0 + shape[k];
        const qy = py0 + shape[k + 1];
        if (qx >= 0 && qy >= 0 && qx < w && qy < h) px[qy * w + qx] = color;
      }
      layer.mark(py0 - 1, py0 + 2);
    }
  }

  /**
   * The other way to draw: as batched rectangles straight onto a canvas.
   *
   * Uploading a pixel buffer costs the same however few particles there are, which is a
   * bargain for a small view and a waste for a huge one. This path costs only what is drawn:
   * particles are counting-sorted by colour and opacity, then each group is filled as one path.
   * The scene picks whichever is cheaper for the current view size.
   */
  renderRects(ctx: CanvasRenderingContext2D, glow: boolean, camX: number, camY: number, time: number, viewW: number, viewH: number): void {
    const { x, y, z, age, life, kind, baked, phase, key, px, py, groupSize, order } = this;
    groupSize.fill(0);
    let visible = 0;
    for (let i = 0; i < this.count; i++) {
      const b = baked[kind[i]];
      key[i] = -1;
      if (b.glow !== glow) continue;
      const t = age[i] / life[i];
      let sx = x[i] - camX;
      if (b.wobbleAmp) sx += Math.sin(phase[i] + time * b.wobbleHz * 6.2832) * b.wobbleAmp;
      const qx = Math.floor(sx);
      const qy = Math.floor(y[i] - z[i] - camY);
      if (qx < -8 || qy < -8 || qx >= viewW + 8 || qy >= viewH + 8) continue;
      let a = 1;
      if (b.fadeIn && t < b.fadeIn) a = t / b.fadeIn;
      else if (b.fadeOut && t > 1 - b.fadeOut) a = (1 - t) / b.fadeOut;
      const group = (b.colorBase + Math.min(b.colorCount - 1, Math.floor(t * b.colorCount))) * ALPHA_STEPS + clamp(Math.floor(a * ALPHA_STEPS), 0, ALPHA_STEPS - 1);
      key[i] = group;
      px[i] = qx;
      py[i] = qy;
      groupSize[group]++;
      visible++;
    }
    if (!visible) return;

    // Turn sizes into start offsets, then drop each particle into its group's run.
    const starts = this.groupStart;
    let offset = 0;
    for (let g = 0; g < groupSize.length; g++) {
      starts[g] = offset;
      offset += groupSize[g];
    }
    for (let i = 0; i < this.count; i++) if (key[i] >= 0) order[starts[key[i]]++] = i;

    let at = 0;
    for (let g = 0; g < groupSize.length; g++) {
      const n = groupSize[g];
      if (!n) continue;
      ctx.fillStyle = this.css[Math.floor(g / ALPHA_STEPS)];
      ctx.globalAlpha = (((g % ALPHA_STEPS) + 1) / ALPHA_STEPS) * this.peak[Math.floor(g / ALPHA_STEPS)];
      ctx.beginPath();
      for (let k = at; k < at + n; k++) {
        const i = order[k];
        const b = baked[kind[i]];
        const t = age[i] / life[i];
        const shape = b.shapes[Math.min(b.shapes.length - 1, Math.floor(t * b.shapes.length))];
        if (shape === RING) {
          const r = 1 + t * b.ringSize;
          const steps = Math.ceil(r * 5);
          for (let s = 0; s < steps; s++) {
            const ang = (s / steps) * 6.2832;
            ctx.rect(Math.round(px[i] + Math.cos(ang) * r), Math.round(py[i] + Math.sin(ang) * r * 0.5), 1, 1);
          }
        } else for (let s = 0; s < shape.length; s += 2) ctx.rect(px[i] + shape[s], py[i] + shape[s + 1], 1, 1);
      }
      ctx.fill();
      at += n;
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.count = 0;
  }
}
