import { GLOW_LAMPLIT } from '@/art/kit';
import { RENDER } from '@/config/render';
import type { Atlas, SeasonSet, Sprite } from '@/engine/atlas';

/**
 * Anything drawn in the world: a tree, a cottage, a Sproutling.
 * Static things and living things share this shape so one code path sorts, lights,
 * shadows and reflects them all.
 */
export interface Entity {
  /** Where its feet touch the ground, in world pixels. */
  x: number;
  y: number;
  /** Height above the ground (fliers, hopping frogs). Shadows stay on the ground. */
  lift: number;
  /** Animation frames; each frame knows its look in every season. */
  frames: SeasonSet[];
  frame: number;
  /** Frames per second for self-animating props (0 = driven externally). */
  fps: number;
  flip: boolean;
  alpha: number;
  /** Lies flat: drawn beneath everything standing, casts no shadow. */
  flat: boolean;
  /** 0 = rigid. Otherwise a phase offset; the sprite leans with the wind. */
  sway: number;
  /** Dies back in winter. */
  tender: boolean;
  /** Only visible while this modifier flag is set ('' = always). */
  flag: string;
  /** World time it appeared, for the pop-in. */
  born: number;
  region: string;
  /** World y of the waterline it is mirrored about; NaN = casts no reflection. */
  waterline: number;
  shadow: boolean;
  /** A second sprite stacked on top (windmill blades, water wheel). */
  spinner: { frames: SeasonSet[]; dx: number; dy: number; rate: number } | null;
  /** What it is: a building id, 'spring', 'prop', a creature name… */
  tag: string;
  /** Journal secret discovered by clicking it ('' = none). */
  secret: string;
  hidden: boolean;
  /** A small sprite floating above it: something carried, or an emote. */
  badge: Sprite | null;
  /** World time it was last shaken (plants shudder for a moment afterwards). */
  jolt: number;
  /** World time until which the rain cloud's water keeps it boosted. */
  wet: number;
  /** World time from which it can be shaken or petted for a reward again. */
  ready: number;
}

export interface EntityOptions {
  frames?: number;
  fps?: number;
  flat?: boolean;
  sway?: boolean;
  tender?: boolean;
  flag?: string;
  born?: number;
  region?: string;
  tag?: string;
  secret?: string;
  shadow?: boolean;
  flip?: boolean;
}

/** Resolve `name` (or `name_0 … name_{n-1}`) into season-aware frames. */
export function framesOf(atlas: Atlas, name: string, count = 1): SeasonSet[] {
  if (count <= 1 && atlas.has(name)) return [atlas.seasons(name)];
  return Array.from({ length: Math.max(1, count) }, (_, i) => atlas.seasons(`${name}_${i}`));
}

export function makeEntity(atlas: Atlas, sprite: string, x: number, y: number, o: EntityOptions = {}): Entity {
  return {
    x,
    y,
    lift: 0,
    frames: framesOf(atlas, sprite, o.frames),
    frame: 0,
    fps: o.fps ?? 0,
    flip: o.flip ?? false,
    alpha: 1,
    flat: o.flat ?? false,
    sway: o.sway ? 0.5 + ((x * 7 + y * 13) % 97) / 16 : 0,
    tender: o.tender ?? false,
    flag: o.flag ?? '',
    born: o.born ?? -100,
    region: o.region ?? '',
    waterline: NaN,
    shadow: o.shadow ?? !o.flat,
    spinner: null,
    tag: o.tag ?? 'prop',
    secret: o.secret ?? '',
    hidden: false,
    badge: null,
    jolt: -100,
    wet: -100,
    ready: 0,
  };
}

/** Seasons are blended by drawing look A, then look B on top at `blend` opacity. */
export interface SeasonBlend {
  a: number;
  b: number;
  blend: number;
  /** How wintry it is, 0..1: tender plants fade by this. */
  winter: number;
}

export function blit(ctx: CanvasRenderingContext2D, atlas: Atlas, s: Sprite, x: number, y: number, flip: boolean): void {
  ctx.drawImage(atlas.canvas, flip ? s.fx : s.x, s.y, s.w, s.h, x - (flip ? s.w - 1 - s.ax : s.ax), y - s.ay, s.w, s.h);
}

/**
 * Draw a sprite leaning in the wind. The lean is a smooth shear, so the top drifts over
 * gradually instead of jumping. Tall things (trees) keep their trunk rooted and only the
 * crown moves; small plants bend from the ground. `lean` is how far the very top travels, in px.
 */
function blitSwaying(ctx: CanvasRenderingContext2D, atlas: Atlas, s: Sprite, x: number, y: number, lean: number): void {
  const w = RENDER.wind;
  const left = x - s.ax;
  const top = y - s.ay;
  const rooted = s.h >= w.tall ? Math.round(s.h * w.trunk) : 0;
  const moving = s.h - rooted;
  if (rooted) ctx.drawImage(atlas.canvas, s.x, s.y + moving, s.w, rooted, left, top + moving, s.w, rooted);
  // Shear about the line where the moving part meets the rooted part.
  ctx.setTransform(1, 0, -lean / moving, 1, left, top + moving);
  ctx.drawImage(atlas.canvas, s.x, s.y, s.w, moving, 0, -moving, s.w, moving);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Squash-and-stretch as something pops into the world: 0 → overshoot → 1. */
function popScale(t: number): number {
  const c = 1 + RENDER.pop.overshoot * 6;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/**
 * Draw one entity at view position (vx, vy).
 * `wind` is the current gust strength at the entity (0..1 or so), `time` the world clock,
 * and `lamplight` how strongly windows should glow (0 by day, 1 at night).
 */
export function drawEntity(ctx: CanvasRenderingContext2D, atlas: Atlas, e: Entity, vx: number, vy: number, season: SeasonBlend, wind: number, time: number, lamplight = 0): void {
  let alpha = e.alpha;
  if (e.tender) alpha *= 1 - season.winter;
  if (alpha <= 0.02) return;
  const age = (time - e.born) / RENDER.pop.seconds;
  // Not built yet (queued to pop in a moment from now).
  if (age < 0) return;
  const set = e.frames[e.frame % e.frames.length];
  const y = vy - Math.round(e.lift);

  for (let pass = 0; pass < 2; pass++) {
    const sprite = set[pass === 0 ? season.a : season.b];
    if (pass === 1 && (season.blend <= 0.01 || sprite === set[season.a])) break;
    ctx.globalAlpha = pass === 0 ? alpha : alpha * season.blend;
    if (age < 1 && age >= 0) {
      const sy = popScale(age);
      const sx = 1 + (1 - sy) * 0.35;
      const w = sprite.w * sx;
      const h = sprite.h * sy;
      ctx.drawImage(atlas.canvas, sprite.x, sprite.y, sprite.w, sprite.h, Math.round(vx - sprite.ax * sx), Math.round(y - sprite.ay * sy), Math.round(w), Math.round(h));
    } else if (e.sway && !e.flip) {
      // A slow idle breath, plus whatever gust is passing; small plants bend less far than tall trees.
      const w = RENDER.wind;
      const reach = Math.min(1, sprite.h / w.tall);
      // A shaken plant shudders hard for a moment, then settles.
      const since = time - e.jolt;
      const shudder = since < w.joltSeconds ? Math.sin(since * w.joltSpeed) * w.joltLean * (1 - since / w.joltSeconds) : 0;
      blitSwaying(ctx, atlas, sprite, vx, y, (Math.sin(e.sway * 9 + time * w.idleSpeed) * w.idle + wind * w.lean) * reach + shudder);
    } else blit(ctx, atlas, sprite, vx, y, e.flip);
  }
  // Windows light up as part of the sprite itself, so whatever stands in front still covers them.
  const base = set[season.a];
  if (lamplight > 0.03 && base.glow && age >= 1 && !e.flip) {
    ctx.fillStyle = RENDER.light.lamplit;
    ctx.globalAlpha = alpha * lamplight;
    for (const g of base.glow) if (g[4] === GLOW_LAMPLIT) ctx.fillRect(vx - base.ax + g[0], y - base.ay + g[1], g[2], g[3]);
  }
  if (e.spinner && age >= 1) {
    const frames = e.spinner.frames;
    const s = frames[Math.floor(time * e.spinner.rate) % frames.length][season.a];
    ctx.globalAlpha = alpha;
    blit(ctx, atlas, s, vx + e.spinner.dx, y + e.spinner.dy, false);
  }
  if (e.badge) {
    ctx.globalAlpha = alpha;
    const top = set[season.a];
    blit(ctx, atlas, e.badge, vx, y - top.ay - 2 + Math.round(Math.sin(time * 5 + e.x) * 0.6), false);
  }
  ctx.globalAlpha = 1;
}

/** The sprite an entity currently shows, for shadows, reflections and hit-testing. */
export const currentSprite = (e: Entity, season: SeasonBlend): Sprite => e.frames[e.frame % e.frames.length][season.blend > 0.5 ? season.b : season.a];

/** True when a world point falls inside the entity's sprite box. */
export function hits(e: Entity, s: Sprite, wx: number, wy: number, grow = 2): boolean {
  const left = e.x - (e.flip ? s.w - 1 - s.ax : s.ax);
  const top = e.y - e.lift - s.ay;
  return wx >= left - grow && wx <= left + s.w + grow && wy >= top - grow && wy <= top + s.h + grow;
}
