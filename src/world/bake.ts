import { RENDER } from '@/config/render';
import type { Atlas } from '@/engine/atlas';
import { currentSprite, type Entity, type SeasonBlend } from './entity';
import { castReflection, castShadow } from './light';
import type { RegionView } from './populate';

/**
 * Trees and buildings never move, so their shadows and reflections do not need to be
 * recomputed every frame. Each land keeps both as ready-made images: the shadow image is
 * redrawn only when the light has moved noticeably, the reflection image only when something
 * is built. Per frame the scene then stamps one image per land and handles only what moves.
 */

/** How far beyond a land's patch its shadows may reach (long evening shadows of tall trees). */
export const SHADE_MARGIN = 96;
/** How far below a land's patch reflections may reach. */
const MIRROR_EXTRA = 60;

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Describes what the image currently shows; a different key means it is stale. */
  key: string;
}

export interface Bake {
  shade: Layer;
  mirror: Layer;
}

/** A static lamp on the ground, in world pixels. */
export interface GroundLamp {
  x: number;
  y: number;
  r: number;
}

function layer(w: number, h: number): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx, key: '' };
}

export function newBake(view: RegionView): Bake {
  const t = view.terrain;
  return { shade: layer(t.w + SHADE_MARGIN * 2, t.h + SHADE_MARGIN * 2), mirror: layer(t.w, t.h + MIRROR_EXTRA) };
}

/** Visit every unmoving thing on a land that is currently visible. */
export function eachStatic(view: RegionView, flags: Record<string, number>, time: number, visit: (e: Entity) => void): void {
  const seen = (e: Entity) => !e.hidden && e.born <= time && (!e.flag || flags[e.flag]);
  for (const e of view.decor) if (seen(e)) visit(e);
  for (const list of view.buildings.values()) for (const e of list) if (seen(e)) visit(e);
}

/**
 * A cheap fingerprint of a land's static contents, and whether anything on it is still
 * popping into place (in which case its images must keep being refreshed).
 */
export function fingerprint(view: RegionView, flags: Record<string, number>, time: number): { sum: number; settling: boolean } {
  let sum = 0;
  let settling = false;
  const settledBy = time - RENDER.pop.seconds - 0.1;
  const visit = (e: Entity) => {
    if (e.hidden || (e.flag && !flags[e.flag])) return;
    if (e.born > settledBy) settling = true;
    if (e.born <= time) sum += 1;
  };
  for (const e of view.decor) visit(e);
  for (const list of view.buildings.values()) for (const e of list) visit(e);
  return { sum, settling };
}

/** The lamps that stand on a land (lanterns, lit windows, glowing crystals). */
export function groundLamps(view: RegionView, flags: Record<string, number>, time: number, season: SeasonBlend): GroundLamp[] {
  const lamps: GroundLamp[] = [];
  eachStatic(view, flags, time, (e) => {
    for (const light of currentSprite(e, season).lights ?? []) lamps.push({ x: e.x, y: e.y, r: light.r });
  });
  return lamps;
}

/** Redraw a land's static shadows for the given light. With `lamps`, each thing is shadowed by its nearest lamp instead of the sun. */
export function bakeShadows(bake: Bake, view: RegionView, atlas: Atlas, flags: Record<string, number>, time: number, season: SeasonBlend, dx: number, dy: number, lamps: readonly GroundLamp[] | null): void {
  const { canvas, ctx } = bake.shade;
  const sh = RENDER.shadows;
  const ox = view.terrain.x - SHADE_MARGIN;
  const oy = view.terrain.y - SHADE_MARGIN;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  eachStatic(view, flags, time, (e) => {
    if (!e.shadow || e.flat || (e.tender && season.winter > 0.5)) return;
    let sx = dx;
    let sy = dy;
    if (lamps) {
      let best = Infinity;
      for (const lamp of lamps) {
        const d = Math.hypot(e.x - lamp.x, (e.y - lamp.y) * 1.6);
        const reach = lamp.r * sh.lampReach;
        if (d < reach && d < best && d > 2) {
          best = d;
          const length = 0.45 + (d / reach) * 0.9;
          sx = ((e.x - lamp.x) / d) * length;
          sy = (((e.y - lamp.y) * 1.6) / d) * length * sh.groundSquash;
        }
      }
    }
    castShadow(ctx, atlas, currentSprite(e, season), e.x - ox, e.y - oy, sx, sy, e.flip);
  });
  // A shadow lies on the ground: whatever would reach past the shore is cut off instead of streaking over the sea.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(view.terrain.patches[season.blend > 0.5 ? season.b : season.a], SHADE_MARGIN, SHADE_MARGIN);
  ctx.globalCompositeOperation = 'source-over';
}

/** Redraw a land's static reflections: its mirrored shoreline plus everything standing near water, with the land itself cut out. */
export function bakeMirror(bake: Bake, view: RegionView, atlas: Atlas, flags: Record<string, number>, time: number, season: SeasonBlend): void {
  const { canvas, ctx } = bake.mirror;
  const t = view.terrain;
  const index = season.blend > 0.5 ? season.b : season.a;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(t.mirrors[index], 0, 0);
  eachStatic(view, flags, time, (e) => {
    if (!Number.isFinite(e.waterline) || (e.tender && season.winter > 0.5)) return;
    castReflection(ctx, atlas, currentSprite(e, season), e.x - t.x, e.waterline - t.y, e.flip);
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(t.patches[index], 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
