import { clamp } from './rng';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Screen space the UI covers, in device pixels, so the camera can centre on what is actually visible. */
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CameraOptions {
  minZoom: number;
  maxZoom: number;
  /** Higher = snappier follow. */
  stiffness: number;
  /** How quickly a flung view slows down. Higher = stops sooner. */
  friction?: number;
  /** World bounds the view may not leave. */
  world: Rect;
}

/** A flung view is taken to have stopped below this speed, in world pixels per second. */
const DRIFT_STOP = 4;

/**
 * A smooth 2D camera. `zoom` is device pixels per world pixel; targets snap to
 * whole numbers so pixel art stays crisp once the motion settles.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 3;
  targetX = 0;
  targetY = 0;
  targetZoom = 3;
  viewW = 1;
  viewH = 1;
  /**
   * How much of the screen the UI covers right now. It glides towards what `setInsets` asked for
   * rather than jumping, so opening or hiding a menu slides the world aside instead of snapping it.
   */
  insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private targetInsets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  /** What `frame` takes to be covered when it works out a zoom (see `setInsets`). */
  private frameInsets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  /** How far in and out the player can zoom, and the furthest out `frame` goes by itself. */
  minZoom: number;
  maxZoom: number;
  frameFloor: number;
  /** True while the view is where `frame` last put it. Any move the player makes clears it. */
  auto = true;
  /** The speed a flung view still has, in world pixels per second. */
  private drift = { x: 0, y: 0 };

  constructor(private readonly options: CameraOptions) {
    this.minZoom = options.minZoom;
    this.maxZoom = options.maxZoom;
    this.frameFloor = options.minZoom;
  }

  resize(viewW: number, viewH: number): void {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  /** Set how far in and out the view can go: by the player, and (no further out than `floor`) by `frame`. */
  setLimits(min: number, max: number, floor = min): void {
    this.minZoom = min;
    this.maxZoom = Math.max(min, max);
    this.frameFloor = clamp(floor, this.minZoom, this.maxZoom);
  }

  /**
   * Say how much of the screen the UI covers from now on. `frame` fits things into what is left;
   * pass `framed` to have it fit them into a different area, for instance the one left when a
   * menu is shut, so that opening the menu slides the view aside without also shrinking it.
   */
  setInsets(next: Insets, framed: Insets = next): void {
    this.targetInsets = next;
    this.frameInsets = framed;
  }

  /** Jump straight to the target (no easing). */
  snap(): void {
    this.x = this.targetX;
    this.y = this.targetY;
    this.zoom = this.targetZoom;
    this.insets = { ...this.targetInsets };
    this.halt();
  }

  update(dt: number): void {
    if (this.drift.x || this.drift.y) {
      this.targetX += this.drift.x * dt;
      this.targetY += this.drift.y * dt;
      this.clampTarget();
      this.x = this.targetX;
      this.y = this.targetY;
      const slow = Math.exp(-dt * (this.options.friction ?? 5));
      this.drift.x *= slow;
      this.drift.y *= slow;
      if (Math.hypot(this.drift.x, this.drift.y) < DRIFT_STOP) this.halt();
    }
    const k = 1 - Math.exp(-dt * this.options.stiffness);
    this.x += (this.targetX - this.x) * k;
    this.y += (this.targetY - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * k;
    if (Math.abs(this.zoom - this.targetZoom) < 0.002) this.zoom = this.targetZoom;
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      const gap = this.targetInsets[side] - this.insets[side];
      this.insets[side] = Math.abs(gap) < 0.5 ? this.targetInsets[side] : this.insets[side] + gap * k;
    }
  }

  /** Centre of the unobstructed part of the screen, in device pixels. */
  private focusX(): number {
    return (this.insets.left + this.viewW - this.insets.right) / 2;
  }

  private focusY(): number {
    return (this.insets.top + this.viewH - this.insets.bottom) / 2;
  }

  toWorldX(screenX: number): number {
    return this.x + (screenX - this.focusX()) / this.zoom;
  }

  toWorldY(screenY: number): number {
    return this.y + (screenY - this.focusY()) / this.zoom;
  }

  toScreenX(worldX: number): number {
    return (worldX - this.x) * this.zoom + this.focusX();
  }

  toScreenY(worldY: number): number {
    return (worldY - this.y) * this.zoom + this.focusY();
  }

  /** Aim at a point, keeping the current zoom. */
  lookAt(x: number, y: number): void {
    this.halt();
    this.targetX = x;
    this.targetY = y;
    this.clampTarget();
  }

  /** How many device pixels per world pixel would show the whole rectangle (with `padding` world pixels around it) in the free area. */
  fit(bounds: Rect, padding = 24): number {
    // Fit to where the free area will be once it has settled, not to wherever it is on the way.
    const freeW = this.viewW - this.frameInsets.left - this.frameInsets.right;
    const freeH = this.viewH - this.frameInsets.top - this.frameInsets.bottom;
    return Math.min(freeW / Math.max(1, bounds.w + padding * 2), freeH / Math.max(1, bounds.h + padding * 2));
  }

  /** Choose the largest whole zoom that shows the whole rectangle (but go no further out than `floor`), and centre on it. */
  frame(bounds: Rect, padding = 24, floor = this.frameFloor): void {
    this.halt();
    this.targetZoom = clamp(Math.floor(this.fit(bounds, padding)), floor, this.maxZoom);
    this.targetX = bounds.x + bounds.w / 2;
    this.targetY = bounds.y + bounds.h / 2;
    this.clampTarget();
    this.auto = true;
  }

  /** Drag by a screen-space delta. */
  pan(dx: number, dy: number): void {
    this.halt();
    this.targetX -= dx / this.zoom;
    this.targetY -= dy / this.zoom;
    this.clampTarget();
    this.x = this.targetX;
    this.y = this.targetY;
    this.auto = false;
  }

  /** Step the zoom in or out, keeping the world point under the cursor fixed. */
  zoomAt(screenX: number, screenY: number, steps: number): void {
    const next = clamp(Math.round(this.targetZoom + steps), this.minZoom, this.maxZoom);
    if (next === this.targetZoom) return;
    this.halt();
    const wx = this.toWorldX(screenX);
    const wy = this.toWorldY(screenY);
    this.targetZoom = next;
    this.targetX = wx - (screenX - this.focusX()) / next;
    this.targetY = wy - (screenY - this.focusY()) / next;
    this.clampTarget();
    this.auto = false;
  }

  /**
   * Two fingers on the world: go straight to `zoom` (any zoom, not just whole steps), keeping the
   * world point between the fingers under them. (screenX, screenY) is where the middle of the
   * fingers is now, and (dx, dy) how far it has moved since the last call.
   */
  pinch(screenX: number, screenY: number, zoom: number, dx: number, dy: number): void {
    this.halt();
    const wx = this.toWorldX(screenX - dx);
    const wy = this.toWorldY(screenY - dy);
    this.zoom = this.targetZoom = clamp(zoom, this.minZoom, this.maxZoom);
    this.targetX = wx - (screenX - this.focusX()) / this.zoom;
    this.targetY = wy - (screenY - this.focusY()) / this.zoom;
    this.clampTarget();
    this.x = this.targetX;
    this.y = this.targetY;
    this.auto = false;
  }

  /** The fingers have let go: ease to the nearest whole zoom, so that pixels come out even again. */
  settle(screenX: number, screenY: number): void {
    const next = clamp(Math.round(this.zoom), this.minZoom, this.maxZoom);
    const wx = this.toWorldX(screenX);
    const wy = this.toWorldY(screenY);
    this.targetZoom = next;
    this.targetX = wx - (screenX - this.focusX()) / next;
    this.targetY = wy - (screenY - this.focusY()) / next;
    this.clampTarget();
  }

  /** Let go of a drag with some speed left (screen pixels per second): the view glides on and slows to a stop. */
  fling(vx: number, vy: number): void {
    this.drift.x = -vx / this.zoom;
    this.drift.y = -vy / this.zoom;
  }

  /** Stop gliding. */
  halt(): void {
    this.drift.x = 0;
    this.drift.y = 0;
  }

  private clampTarget(): void {
    const { world } = this.options;
    this.targetX = clamp(this.targetX, world.x, world.x + world.w);
    this.targetY = clamp(this.targetY, world.y, world.y + world.h);
  }
}
