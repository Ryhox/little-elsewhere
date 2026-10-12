import { Pix } from './pix';

/** A point light attached to a sprite, in sprite-local pixels. */
export interface SpriteLight {
  x: number;
  y: number;
  /** Radius in world pixels. */
  r: number;
  /** Light colour key, resolved by the lighting pass. */
  tone?: string;
}

export interface SpriteMeta {
  /** Anchor (the "feet"). Defaults to bottom-centre. */
  ax?: number;
  ay?: number;
  /** Also bake a mirrored copy (for things that face left and right). */
  flip?: boolean;
  /** Auto-generate a snow-capped winter variant. */
  snow?: boolean;
  /** Edge-to-edge art meant to be tiled; keep it untrimmed and skip the clipping check. */
  tile?: boolean;
  lights?: SpriteLight[];
  /** Rectangles that glow at night: [x, y, w, h]. */
  glow?: number[][];
  /** Where chimney smoke rises from, sprite-local. */
  smoke?: [number, number];
}

export interface Sprite {
  name: string;
  /** Position inside the atlas texture. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Atlas x of the mirrored copy (equals x when none was baked). */
  fx: number;
  ax: number;
  ay: number;
  lights?: SpriteLight[];
  glow?: number[][];
  smoke?: [number, number];
}

/** The three looks a sprite can have: lush, autumn, winter. */
export type SeasonSet = readonly [Sprite, Sprite, Sprite];

const PAD = 1;
const ATLAS_WIDTH = 1024;
const SILHOUETTE_COLOR = '#000';
const MASK_COLOR = '#fff';
const SEASON_COUNT = 3;

/** Season suffix convention: `name`, `name@1` (autumn), `name@2` (winter). */
export const seasonKey = (name: string, season: number) => (season === 0 ? name : `${name}@${season}`);

interface Pending {
  name: string;
  pix: Pix;
  meta: SpriteMeta;
}

/**
 * Collects procedurally painted sprites and packs them into a single texture,
 * so the renderer only ever samples one canvas.
 */
export class Atlas {
  canvas!: HTMLCanvasElement;
  /** Same layout as `canvas`, but every sprite is a flat silhouette — the shape shadows are cast from. */
  silhouette!: HTMLCanvasElement;
  /** The same in pure white — the shape of each sprite as light, for things that glow. */
  mask!: HTMLCanvasElement;
  private pending: Pending[] = [];
  private sprites = new Map<string, Sprite>();
  private sets = new Map<string, SeasonSet>();
  private urls = new Map<string, string>();
  private snowPainter: ((pix: Pix) => Pix) | null = null;

  /** Register the post-process used to derive winter variants. */
  useSnow(painter: (pix: Pix) => Pix): void {
    this.snowPainter = painter;
  }

  /**
   * Register a painted sprite. The painting is trimmed to its content, so generators
   * can work on a roomy canvas; anchors, lights and glow rects are shifted to match.
   * Default anchor: horizontal centre of the canvas, bottom-most painted row.
   */
  add(name: string, pix: Pix, meta: SpriteMeta = {}): void {
    if (import.meta.env?.DEV && !meta.tile && pix.touchesEdge()) console.warn(`[atlas] "${name}" touches its canvas edge and may be clipped`);
    const [bx, by, bw, bh] = meta.tile ? [0, 0, pix.w, pix.h] : pix.bounds();
    const shift = <T extends { x: number; y: number }>(item: T): T => ({ ...item, x: item.x - bx, y: item.y - by });
    this.pending.push({
      name,
      pix: pix.crop(bx, by, bw, bh),
      meta: {
        ...meta,
        ax: (meta.ax ?? Math.floor(pix.w / 2)) - bx,
        ay: (meta.ay ?? by + bh - 1) - by,
        lights: meta.lights?.map(shift),
        glow: meta.glow?.map(([x, y, w, h]) => [x - bx, y - by, w, h]),
        smoke: meta.smoke ? [meta.smoke[0] - bx, meta.smoke[1] - by] : undefined,
      },
    });
  }

  has(name: string): boolean {
    return this.sprites.has(name);
  }

  get(name: string): Sprite {
    const sprite = this.sprites.get(name);
    if (!sprite) throw new Error(`Unknown sprite "${name}"`);
    return sprite;
  }

  /** Resolve the lush / autumn / winter variants once, so drawing never builds strings. */
  seasons(name: string): SeasonSet {
    let set = this.sets.get(name);
    if (!set) {
      const base = this.get(name);
      const autumn = this.sprites.get(seasonKey(name, 1)) ?? base;
      const winter = this.sprites.get(seasonKey(name, 2)) ?? autumn;
      set = [base, autumn, winter];
      this.sets.set(name, set);
    }
    return set;
  }

  names(): string[] {
    return [...this.sprites.keys()];
  }

  /** Standalone PNG data URL of one sprite, for DOM use. */
  url(name: string): string {
    let url = this.urls.get(name);
    if (!url) {
      const s = this.get(name);
      const c = document.createElement('canvas');
      c.width = s.w;
      c.height = s.h;
      c.getContext('2d')!.drawImage(this.canvas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
      url = c.toDataURL();
      this.urls.set(name, url);
    }
    return url;
  }

  /** Pack everything that was added. Call once after all generators have run. */
  pack(): void {
    const items = [...this.pending];
    const named = new Set(items.map((i) => i.name));
    if (this.snowPainter) {
      for (const item of this.pending) {
        const winter = seasonKey(item.name, SEASON_COUNT - 1);
        if (item.meta.snow && !item.name.includes('@') && !named.has(winter)) {
          items.push({ name: winter, pix: this.snowPainter(item.pix), meta: item.meta });
        }
      }
    }
    items.sort((a, b) => b.pix.h - a.pix.h);

    let x = PAD;
    let y = PAD;
    let rowH = 0;
    const place = (w: number, h: number): [number, number] => {
      if (x + w + PAD > ATLAS_WIDTH) {
        x = PAD;
        y += rowH + PAD;
        rowH = 0;
      }
      const at: [number, number] = [x, y];
      x += w + PAD;
      rowH = Math.max(rowH, h);
      return at;
    };

    const placed: { item: Pending; at: [number, number]; flipAt: [number, number] | null }[] = [];
    for (const item of items) {
      const at = place(item.pix.w, item.pix.h);
      const flipAt = item.meta.flip ? place(item.pix.w, item.pix.h) : null;
      placed.push({ item, at, flipAt });
    }

    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_WIDTH;
    canvas.height = y + rowH + PAD;
    const ctx = canvas.getContext('2d')!;
    for (const { item, at, flipAt } of placed) {
      const { pix, meta, name } = item;
      ctx.putImageData(pix.toImageData(), at[0], at[1]);
      if (flipAt) ctx.putImageData(pix.flipped().toImageData(), flipAt[0], flipAt[1]);
      this.sprites.set(name, {
        name,
        x: at[0],
        y: at[1],
        w: pix.w,
        h: pix.h,
        fx: flipAt ? flipAt[0] : at[0],
        ax: meta.ax ?? 0,
        ay: meta.ay ?? 0,
        lights: meta.lights,
        glow: meta.glow,
        smoke: meta.smoke,
      });
    }
    this.canvas = canvas;
    this.silhouette = this.tinted(SILHOUETTE_COLOR);
    this.mask = this.tinted(MASK_COLOR);
    this.pending = [];
  }

  /** A copy of the whole atlas with every pixel painted one colour (alpha preserved). */
  private tinted(color: string): HTMLCanvasElement {
    const copy = document.createElement('canvas');
    copy.width = this.canvas.width;
    copy.height = this.canvas.height;
    const ctx = copy.getContext('2d')!;
    ctx.drawImage(this.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, copy.width, copy.height);
    return copy;
  }
}
