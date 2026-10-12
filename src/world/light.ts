import { LIGHT_BAKE_RADIUS } from '@/art/fx';
import { BALANCE } from '@/config/balance';
import { RENDER } from '@/config/render';
import type { Atlas, Sprite } from '@/engine/atlas';
import { lerp } from '@/engine/rng';

/**
 * The three systems that make the world feel lit rather than painted:
 *
 *  • Lighting    — a light map (ambient colour + every lamp) multiplied over the scene.
 *  • Shadows     — each sprite's own silhouette, projected onto the ground away from the light.
 *  • Reflections — sprites mirrored into the water and rippled.
 *
 * All three work on layers the size of the view, so their cost does not grow with the world.
 */

function layer(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

function fit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.imageSmoothingEnabled = false;
}

/** Where the sun (or moon) is, expressed as the ground-plane vector a shadow of unit height is thrown along. */
export interface SunState {
  dx: number;
  dy: number;
  /** Opacity of sun/moon shadows right now. */
  alpha: number;
  /** 0 = day, 1 = night. */
  night: number;
}

/** Sun position from the time of day. Shadows swing from west to east and are shortest at noon. */
export function sunState(dayFraction: number, night: number): SunState {
  const s = RENDER.shadows;
  const d = BALANCE.day;
  const daylight = d.nightStart + 1 - d.nightEnd;
  const p = Math.min(1, Math.max(0, ((dayFraction - d.nightEnd + 1) % 1) / daylight));
  const angle = lerp(Math.PI - 0.3, 0.3, p);
  const length = lerp(s.noonLength, s.lowLength, Math.abs(2 * p - 1) ** 1.6);
  const sunDx = Math.cos(angle) * length;
  const sunDy = Math.sin(angle) * length * s.groundSquash;
  const moonDx = Math.cos(s.moonAngle) * s.moonLength;
  const moonDy = Math.sin(s.moonAngle) * s.moonLength * s.groundSquash;
  // Shadows fade out through dusk before the moon's own take over.
  const sun = Math.max(0, 1 - night * 2);
  const moon = Math.max(0, night * 2 - 1);
  return {
    dx: sun > 0 ? sunDx : moonDx,
    dy: sun > 0 ? sunDy : moonDy,
    alpha: sun > 0 ? s.sunAlpha * sun : s.moonAlpha * moon,
    night,
  };
}

/** A lamp in view space, gathered each frame from glowing sprites. */
export interface Lamp {
  x: number;
  y: number;
  r: number;
  tone: string;
}

/**
 * Cast one sprite's shadow onto a canvas. (x, y) is where its feet touch the ground;
 * (dx, dy) is how far a point one pixel above the ground is thrown.
 * Leaves the context's transform changed — reset it when done with a batch.
 */
export function castShadow(ctx: CanvasRenderingContext2D, atlas: Atlas, sprite: Sprite, x: number, y: number, dx: number, dy: number, flip: boolean, lift = 0): void {
  const sx = flip ? sprite.fx : sprite.x;
  const left = flip ? sprite.ax - sprite.w + 1 : -sprite.ax;
  // Shear the silhouette so height maps onto the ground plane.
  ctx.setTransform(1, 0, -dx, -dy, x + dx * lift, y + dy * lift);
  ctx.drawImage(atlas.silhouette, sx, sprite.y, sprite.w, sprite.h, left, -sprite.ay, sprite.w, sprite.h);
  // Contact shadow: the same silhouette pressed flat under the feet, so things sit on the ground
  // whatever the angle of the light. Things in the air leave none.
  if (lift > 1) return;
  ctx.setTransform(1, 0, 0, -RENDER.shadows.contact, x, y + 1);
  ctx.drawImage(atlas.silhouette, sx, sprite.y, sprite.w, sprite.h, left, -sprite.ay, sprite.w, sprite.h);
}

/** Mirror a sprite in the water plane onto a canvas; `mirrorY` is where its feet appear. */
export function castReflection(ctx: CanvasRenderingContext2D, atlas: Atlas, sprite: Sprite, x: number, mirrorY: number, flip: boolean): void {
  ctx.setTransform(1, 0, 0, -RENDER.water.reflection.squash, x, mirrorY);
  ctx.drawImage(atlas.canvas, flip ? sprite.fx : sprite.x, sprite.y, sprite.w, sprite.h, flip ? sprite.ax - sprite.w + 1 : -sprite.ax, -sprite.ay, sprite.w, sprite.h);
}

export class Shadows {
  private l = layer();

  constructor(private readonly atlas: Atlas) {}

  begin(w: number, h: number): void {
    fit(this.l.canvas, this.l.ctx, w, h);
    this.l.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.l.ctx.globalCompositeOperation = 'source-over';
    this.l.ctx.clearRect(0, 0, w, h);
  }

  /** Cast the shadow of something that moves (view pixels). */
  cast(sprite: Sprite, x: number, y: number, dx: number, dy: number, flip: boolean, lift = 0): void {
    castShadow(this.l.ctx, this.atlas, sprite, x, y, dx, dy, flip, lift);
  }

  /** Add a pre-rendered batch of shadows (a land's cached static shadows). */
  stamp(image: CanvasImageSource, x: number, y: number): void {
    this.l.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.l.ctx.drawImage(image, x, y);
  }

  /** Lay the gathered shadows over the scene as one even tone (overlaps never double up). */
  apply(target: CanvasRenderingContext2D, alpha: number): void {
    if (alpha <= 0.005) return;
    const { canvas, ctx } = this.l;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = RENDER.shadows.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    target.globalAlpha = alpha;
    target.drawImage(canvas, 0, 0);
    target.globalAlpha = 1;
  }
}

export class Reflections {
  private l = layer();
  active = false;

  constructor(private readonly atlas: Atlas) {}

  begin(w: number, h: number): void {
    fit(this.l.canvas, this.l.ctx, w, h);
    this.l.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.l.ctx.globalCompositeOperation = 'source-over';
    this.l.ctx.globalAlpha = 1;
    this.l.ctx.clearRect(0, 0, w, h);
    this.active = false;
  }

  /**
   * Mirror a sprite in the water plane. `mirrorY` is where its feet appear in the reflection
   * (view pixels): the feet themselves for things afloat, a little lower for things on a bank.
   * Whatever lands over solid ground is cut away afterwards, so only the part that would
   * really show in the water remains — a tree set back from the shore reflects just its crown.
   */
  add(sprite: Sprite, x: number, mirrorY: number, flip: boolean): void {
    castReflection(this.l.ctx, this.atlas, sprite, x, mirrorY, flip);
    this.active = true;
  }

  /** Add a ready-made reflection image (the mirrored shoreline of a land). */
  image(image: CanvasImageSource, x: number, y: number): void {
    const ctx = this.l.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(image, x, y);
    this.active = true;
  }

  /** Erase reflections wherever something solid (land, a bridge) covers the water. */
  cut(image: CanvasImageSource, x: number, y: number): void {
    const ctx = this.l.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(image, x, y);
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Draw the reflections onto the water in thin strips that slide sideways with the ripples.
   * Zoomed out, each world pixel is tiny on screen, so the strips are made taller to match —
   * the ripple looks the same and far fewer strips are drawn.
   */
  apply(target: CanvasRenderingContext2D, time: number, camY: number, zoom: number): void {
    if (!this.active) return;
    const r = RENDER.water.reflection;
    const { canvas } = this.l;
    const strip = Math.max(r.strip, Math.ceil((r.strip * r.fullDetailZoom) / Math.max(1, zoom)));
    target.globalAlpha = r.alpha;
    for (let y = 0; y < canvas.height; y += strip) {
      const shift = Math.round(Math.sin((y + camY) * r.scale + time * r.speed) * r.wobble);
      target.drawImage(canvas, 0, y, canvas.width, strip, shift, y, canvas.width, strip);
    }
    target.globalAlpha = 1;
  }
}

const rgb = (c: readonly number[]) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const mix = (a: readonly number[], b: readonly number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const tint = (a: readonly number[], b: readonly number[]) => [(a[0] * b[0]) / 255, (a[1] * b[1]) / 255, (a[2] * b[2]) / 255];

/** Ambient light colour for the moment: day → dusk/dawn → night, tinted by weather and season. */
export function ambientColor(night: number, rising: boolean, storm: number, seasonA: number, seasonB: number, seasonBlend: number): number[] {
  const sky = RENDER.sky;
  const horizon = rising ? sky.dawn : sky.dusk;
  let c = night < 0.5 ? mix(sky.day, horizon, night * 2) : mix(horizon, sky.night, night * 2 - 1);
  if (storm > 0) c = mix(c, tint(c, sky.storm), storm);
  return tint(c, mix(sky.seasons[seasonA], sky.seasons[seasonB], seasonBlend));
}

export class Lighting {
  private l = layer();
  private dark = false;

  constructor(private readonly atlas: Atlas) {}

  /** Start the light map with the ambient colour. Returns false when the scene is fully lit and can skip lighting. */
  begin(w: number, h: number, ambient: readonly number[]): boolean {
    this.dark = ambient[0] < 252 || ambient[1] < 252 || ambient[2] < 252;
    if (!this.dark) return false;
    fit(this.l.canvas, this.l.ctx, w, h);
    const ctx = this.l.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgb(ambient);
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    return true;
  }

  private cookie(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, r: number): void {
    const s = this.atlas.get(name);
    const scale = r / LIGHT_BAKE_RADIUS;
    ctx.drawImage(this.atlas.canvas, s.x, s.y, s.w, s.h, Math.round(x - s.ax * scale), Math.round(y - s.ay * scale), Math.round(s.w * scale), Math.round(s.h * scale));
  }

  /** Add a lamp's pool of light to the map. */
  add(lamp: Lamp, strength: number): void {
    if (!this.dark) return;
    this.l.ctx.globalAlpha = strength;
    this.cookie(this.l.ctx, 'light_hole', lamp.x, lamp.y, lamp.r);
  }

  /**
   * Mark part of a sprite as giving off its own light, so the darkness does not dim it.
   * (sx, sy) is the sprite's top-left in view pixels; `rect` is [x, y, w, h, lamplit?] inside it.
   * Lamplit rectangles (windows) are lit whole; anything else only where the sprite has pixels.
   * Because this is part of the light map rather than drawn on top, depth stays correct:
   * something standing in front is simply lit by the glow instead of being painted over.
   */
  emit(sprite: Sprite, sx: number, sy: number, rect: readonly number[], strength: number, lamplit: boolean): void {
    if (!this.dark) return;
    const ctx = this.l.ctx;
    ctx.globalAlpha = strength;
    if (lamplit) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + rect[0], sy + rect[1], rect[2], rect[3]);
    } else ctx.drawImage(this.atlas.mask, sprite.x + rect[0], sprite.y + rect[1], rect[2], rect[3], sx + rect[0], sy + rect[1], rect[2], rect[3]);
  }

  /** Multiply the light map over everything drawn so far. */
  apply(target: CanvasRenderingContext2D): void {
    if (!this.dark) return;
    target.globalCompositeOperation = 'multiply';
    target.drawImage(this.l.canvas, 0, 0);
    target.globalCompositeOperation = 'source-over';
  }

  /** Coloured halo around a lamp, added after the darkness so it glows. */
  bloom(target: CanvasRenderingContext2D, lamp: Lamp, strength: number): void {
    target.globalCompositeOperation = 'lighter';
    target.globalAlpha = strength * RENDER.light.bloom;
    this.cookie(target, `light_${lamp.tone}`, lamp.x, lamp.y, lamp.r * 0.8);
    target.globalAlpha = 1;
    target.globalCompositeOperation = 'source-over';
  }
}
