import { BALANCE } from '@/config/balance';
import { RENDER } from '@/config/render';
import type { Hover, World } from './scene';

export interface InputCallbacks {
  /** The pointer is over something worth a tooltip (or over nothing: null). Positions are in CSS pixels. */
  onHover(hover: Hover | null, clientX: number, clientY: number): void;
  /** Any deliberate interaction — used to unlock audio and note that the player is present. */
  onActivity(): void;
  /** The player moved or zoomed the camera themselves. */
  onLook(): void;
}

const PINCH_STEP = 1.22;
const HOLD_DELAY = 0.28;

/**
 * Mouse and touch for the world: tap things, drag to pan, wheel or pinch to zoom,
 * and hold the spring to keep tapping it.
 */
export class WorldInput {
  private pointers = new Map<number, { x: number; y: number }>();
  private start = { x: 0, y: 0 };
  private dragging = false;
  private pinch = 0;
  /** Seconds the spring has been held, or -1 when it is not. */
  private held = -1;
  private holdCarry = 0;
  private detach: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly world: World,
    private readonly callbacks: InputCallbacks,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(type: K, handler: (e: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
      canvas.addEventListener(type, handler, options);
      this.detach.push(() => canvas.removeEventListener(type, handler, options));
    };
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.cancel(e));
    on('pointerleave', () => this.callbacks.onHover(null, 0, 0));
    on('wheel', (e) => this.wheel(e), { passive: false });
    on('contextmenu', (e) => e.preventDefault());
  }

  dispose(): void {
    for (const off of this.detach) off();
  }

  /** Device pixels per CSS pixel for this canvas. */
  private get ratio(): number {
    return this.canvas.width / Math.max(1, this.canvas.clientWidth);
  }

  private worldPoint(e: { clientX: number; clientY: number }): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const cam = this.world.camera;
    return [cam.toWorldX((e.clientX - rect.left) * this.ratio), cam.toWorldY((e.clientY - rect.top) * this.ratio)];
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.callbacks.onActivity();
    if (this.pointers.size === 1) {
      this.start = { x: e.clientX, y: e.clientY };
      this.dragging = false;
      const [wx, wy] = this.worldPoint(e);
      this.held = this.world.onSpring(wx, wy) ? 0 : -1;
    } else {
      this.held = -1;
      this.pinch = this.spread();
    }
  }

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private move(e: PointerEvent): void {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) {
      const [wx, wy] = this.worldPoint(e);
      const hover = this.world.hoverAt(wx, wy);
      this.canvas.style.cursor = hover ? 'pointer' : 'grab';
      this.callbacks.onHover(hover, e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - previous.x;
    const dy = e.clientY - previous.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size >= 2) {
      const spread = this.spread();
      if (this.pinch > 0 && (spread > this.pinch * PINCH_STEP || spread < this.pinch / PINCH_STEP)) {
        const rect = this.canvas.getBoundingClientRect();
        const [a, b] = [...this.pointers.values()];
        this.world.camera.zoomAt(((a.x + b.x) / 2 - rect.left) * this.ratio, ((a.y + b.y) / 2 - rect.top) * this.ratio, spread > this.pinch ? 1 : -1);
        this.pinch = spread;
      }
      return;
    }
    if (!this.dragging && Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > RENDER.camera.dragThreshold) {
      this.dragging = true;
      this.held = -1;
      this.canvas.style.cursor = 'grabbing';
      this.callbacks.onHover(null, 0, 0);
      this.callbacks.onLook();
    }
    if (this.dragging) this.world.camera.pan(dx * this.ratio, dy * this.ratio);
  }

  private up(e: PointerEvent): void {
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(e.pointerId);
    // A hold that already produced taps should not add one more on release.
    const tapped = wasSingle && !this.dragging && this.held < HOLD_DELAY;
    if (tapped) {
      const [wx, wy] = this.worldPoint(e);
      this.world.tapAt(wx, wy);
    }
    this.held = -1;
    this.dragging = false;
    this.canvas.style.cursor = 'grab';
  }

  private cancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.held = -1;
    this.dragging = false;
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.world.camera.zoomAt((e.clientX - rect.left) * this.ratio, (e.clientY - rect.top) * this.ratio, e.deltaY < 0 ? 1 : -1);
    this.callbacks.onLook();
  }

  /** Called every frame: while the spring is held down, it keeps getting tapped. */
  update(dt: number): void {
    if (this.held < 0) return;
    this.held += dt;
    if (this.held < HOLD_DELAY) return;
    this.holdCarry += dt * BALANCE.click.holdRate;
    while (this.holdCarry >= 1) {
      this.holdCarry -= 1;
      this.world.tapAt(this.world.spring[0], this.world.spring[1]);
    }
  }
}
