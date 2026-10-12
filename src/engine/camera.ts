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
  /** World bounds the view may not leave. */
  world: Rect;
}

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
  insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };

  constructor(private readonly options: CameraOptions) {}

  resize(viewW: number, viewH: number): void {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  /** Jump straight to the target (no easing). */
  snap(): void {
    this.x = this.targetX;
    this.y = this.targetY;
    this.zoom = this.targetZoom;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * this.options.stiffness);
    this.x += (this.targetX - this.x) * k;
    this.y += (this.targetY - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * k;
    if (Math.abs(this.zoom - this.targetZoom) < 0.002) this.zoom = this.targetZoom;
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
    this.targetX = x;
    this.targetY = y;
    this.clampTarget();
  }

  /** Choose the largest whole zoom that shows the whole rectangle, and centre on it. */
  frame(bounds: Rect, padding = 24): void {
    const freeW = this.viewW - this.insets.left - this.insets.right;
    const freeH = this.viewH - this.insets.top - this.insets.bottom;
    const fit = Math.min(freeW / (bounds.w + padding * 2), freeH / (bounds.h + padding * 2));
    this.targetZoom = clamp(Math.floor(fit), this.options.minZoom, this.options.maxZoom);
    this.targetX = bounds.x + bounds.w / 2;
    this.targetY = bounds.y + bounds.h / 2;
    this.clampTarget();
  }

  /** Drag by a screen-space delta. */
  pan(dx: number, dy: number): void {
    this.targetX -= dx / this.zoom;
    this.targetY -= dy / this.zoom;
    this.clampTarget();
    this.x = this.targetX;
    this.y = this.targetY;
  }

  /** Step the zoom in or out, keeping the world point under the cursor fixed. */
  zoomAt(screenX: number, screenY: number, steps: number): void {
    const next = clamp(Math.round(this.targetZoom + steps), this.options.minZoom, this.options.maxZoom);
    if (next === this.targetZoom) return;
    const wx = this.toWorldX(screenX);
    const wy = this.toWorldY(screenY);
    this.targetZoom = next;
    this.targetX = wx - (screenX - this.focusX()) / next;
    this.targetY = wy - (screenY - this.focusY()) / next;
    this.clampTarget();
  }

  private clampTarget(): void {
    const { world } = this.options;
    this.targetX = clamp(this.targetX, world.x, world.x + world.w);
    this.targetY = clamp(this.targetY, world.y, world.y + world.h);
  }
}
