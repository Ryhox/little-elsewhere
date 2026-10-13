import { cursorCss, pressed, type CursorName } from '@/art/cursors';
import { BALANCE } from '@/config/balance';
import { RENDER } from '@/config/render';
import type { Hover, World, WorldCursor } from './scene';

export interface InputCallbacks {
  /**
   * The pointer is over something worth a tooltip (or over nothing: null). Positions are in CSS
   * pixels. `pinned` is set when a finger asked by tapping: the tooltip then stays where it is.
   */
  onHover(hover: Hover | null, clientX: number, clientY: number, pinned?: boolean): void;
  /** Any deliberate interaction: used to unlock audio and note that the player is present. */
  onActivity(): void;
  /** The player moved or zoomed the camera themselves. */
  onLook(): void;
  /** A finger's tap did something in the world. */
  onTouch(): void;
}

const HOLD_DELAY = 0.28;
/** A finger that rested this long (milliseconds) before lifting has stopped, and does not fling the view. */
const FLING_REST = 90;

/** One mouse button held down, or one finger on the screen. */
interface Finger {
  /** Where it is, and where it came down, in CSS pixels. */
  x: number;
  y: number;
  startX: number;
  startY: number;
  /** A real finger rather than a mouse or a pen. */
  touch: boolean;
  /** It has travelled too far to be a tap. */
  moved: boolean;
  /** What it is doing: pointing (tapping, dragging the view), carrying the rain cloud, or sweeping up dewdrops. */
  role: 'point' | 'cloud' | 'sweep';
  /** How fast it is moving, in CSS pixels a second, and when it last moved. */
  vx: number;
  vy: number;
  moment: number;
}

/**
 * Mouse and touch for the world: tap things, drag to pan, wheel or pinch to zoom, and hold the
 * spring to keep tapping it. Fingers get a few things of their own: each one taps by itself (so
 * two thumbs can drum on the spring), a stroke that starts on a dewdrop sweeps instead of moving
 * the view, taps reach for the nearest thing they could have meant, and a flick sends the view
 * gliding. It also chooses the mouse pointer, so the pointer always shows what a click would do,
 * and, for a moment, that it did it.
 */
export class WorldInput {
  private fingers = new Map<number, Finger>();
  private dragging = false;
  /** The rain cloud is being carried by the pointer. */
  private carrying = false;
  /** Two fingers on the world: how far apart and where they were when last measured, and the zoom they started from. */
  private gauge: { spread: number; x: number; y: number; zoom: number } | null = null;
  private pinching = false;
  /** The finger holding the spring down, and for how many seconds (-1 when none is). */
  private holder = -1;
  private held = -1;
  private holdCarry = 0;
  /** The pointer the world asks for where the mouse is now, and the one actually showing. */
  private over: WorldCursor = 'pan';
  private showing: CursorName | null = null;
  /** Seconds the pointer keeps its "doing it" look after a click. */
  private pulse = 0;
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
    // A finger "leaves" every time it lifts. Only a mouse going elsewhere takes its tooltip with it.
    on('pointerleave', (e) => e.pointerType !== 'touch' && this.callbacks.onHover(null, 0, 0));
    on('wheel', (e) => this.wheel(e), { passive: false });
    on('contextmenu', (e) => e.preventDefault());
    this.point();
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

  /** How far around a touched point a fingertip reaches, in world pixels at the current zoom. */
  private get reach(): number {
    return (RENDER.camera.fingerReach * this.ratio) / this.world.camera.zoom;
  }

  /** How close a finger must come to a dewdrop to gather it: never less than a mouse pointer must. */
  private get sweepReach(): number {
    return Math.max(BALANCE.play.sweep.reach, this.reach);
  }

  /** Show the right mouse pointer for what is going on. */
  private point(): void {
    const base: CursorName = this.carrying ? 'cloud' : this.dragging ? 'pan' : this.over;
    const busy = this.carrying || this.dragging || this.pulse > 0 || this.held >= 0;
    const name = busy ? pressed(base) : base;
    if (name === this.showing) return;
    this.showing = name;
    this.canvas.style.cursor = cursorCss(name);
  }

  /** The two fingers that would make a pinch: the first two that are not busy carrying or sweeping. */
  private pair(): [Finger, Finger] | null {
    let first: Finger | null = null;
    for (const f of this.fingers.values()) {
      if (f.role !== 'point') continue;
      if (first) return [first, f];
      first = f;
    }
    return null;
  }

  /** Take a fresh measure of the two fingers, to compare later ones against. */
  private measure(): void {
    const pair = this.pair();
    this.gauge = pair ? { spread: Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y), x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2, zoom: this.world.camera.zoom } : null;
  }

  private letGoOfSpring(): void {
    this.holder = -1;
    this.held = -1;
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    const touch = e.pointerType === 'touch';
    const finger: Finger = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, touch, moved: false, role: 'point', vx: 0, vy: 0, moment: e.timeStamp };
    this.fingers.set(e.pointerId, finger);
    this.callbacks.onActivity();
    // Touching the world again puts away a tooltip a tap pinned, and stops a view that was still gliding.
    if (touch) this.callbacks.onHover(null, 0, 0);
    this.world.camera.halt();
    const [wx, wy] = this.worldPoint(e);
    const reach = touch ? this.reach : 0;
    if (!this.pinching && !this.carrying && this.world.play.grab(wx, wy, reach)) {
      // Picking up the rain cloud takes over the drag: the camera stays put while it is carried.
      finger.role = 'cloud';
      this.carrying = true;
    } else if (touch && !this.pinching && this.world.play.hover(wx, wy)) {
      // So does a finger that lands right on a dewdrop: it sweeps wherever it goes next. (Only right on one: anywhere else must stay free for moving the view.)
      finger.role = 'sweep';
      this.callbacks.onTouch();
    } else if (this.pair()) {
      // A second finger: the two may be about to pinch. Until they move, each is still a tap in waiting.
      this.measure();
    } else if (this.world.onSpring(wx, wy)) {
      this.holder = e.pointerId;
      this.held = 0;
    }
    this.point();
  }

  private move(e: PointerEvent): void {
    const finger = this.fingers.get(e.pointerId);
    const [wx, wy] = this.worldPoint(e);
    if (!finger) {
      // A mouse with no button down. Wherever it goes, it sweeps up dewdrops.
      this.world.play.hover(wx, wy);
      const at = this.world.pointAt(wx, wy);
      this.over = at.cursor;
      this.point();
      this.callbacks.onHover(at.hover, e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - finger.x;
    const dy = e.clientY - finger.y;
    const seconds = (e.timeStamp - finger.moment) / 1000;
    if (seconds > 0) {
      // A running average, so one jittery reading does not decide where a flick goes.
      finger.vx += (dx / seconds - finger.vx) * 0.6;
      finger.vy += (dy / seconds - finger.vy) * 0.6;
    }
    finger.x = e.clientX;
    finger.y = e.clientY;
    finger.moment = e.timeStamp;

    if (finger.role === 'cloud') return this.world.play.drag(wx, wy);
    if (finger.role === 'sweep') return void this.world.play.hover(wx, wy, this.sweepReach);
    if (!finger.touch) this.world.play.hover(wx, wy);

    const pair = this.pair();
    if (pair && this.gauge) return this.squeeze(pair);

    const threshold = finger.touch ? RENDER.camera.touchDragThreshold : RENDER.camera.dragThreshold;
    if (!finger.moved && Math.hypot(e.clientX - finger.startX, e.clientY - finger.startY) > threshold) {
      finger.moved = true;
      this.dragging = true;
      if (this.holder === e.pointerId) this.letGoOfSpring();
      this.callbacks.onHover(null, 0, 0);
      this.callbacks.onLook();
      this.point();
    }
    if (finger.moved) this.world.camera.pan(dx * this.ratio, dy * this.ratio);
  }

  /** Two fingers have moved: once they have moved enough to mean it, zoom and slide the view with them. */
  private squeeze([a, b]: [Finger, Finger]): void {
    const gauge = this.gauge!;
    const spread = Math.hypot(a.x - b.x, a.y - b.y);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    if (!this.pinching) {
      const slack = RENDER.camera.pinchSlack;
      if (Math.abs(spread - gauge.spread) < slack && Math.hypot(x - gauge.x, y - gauge.y) < slack) return;
      this.pinching = true;
      this.dragging = true;
      a.moved = b.moved = true;
      this.letGoOfSpring();
      this.callbacks.onLook();
      // Start from here, so the view does not jump by the slack that was just used up.
      this.measure();
      this.point();
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const zoom = gauge.zoom * (spread / Math.max(1, gauge.spread));
    this.world.camera.pinch((x - rect.left) * this.ratio, (y - rect.top) * this.ratio, zoom, (x - gauge.x) * this.ratio, (y - gauge.y) * this.ratio);
    gauge.x = x;
    gauge.y = y;
  }

  /** A finger has gone. If it was half of a pinch, the pinch is over and the view settles on a whole zoom. */
  private endPinch(): void {
    if (!this.pinching || this.pair()) return this.measure();
    const gauge = this.gauge;
    this.pinching = false;
    this.gauge = null;
    if (gauge) {
      const rect = this.canvas.getBoundingClientRect();
      this.world.camera.settle((gauge.x - rect.left) * this.ratio, (gauge.y - rect.top) * this.ratio);
    }
    // The finger still down carries on dragging the view from where it is.
    for (const f of this.fingers.values()) if (f.role === 'point') f.moved = true;
  }

  private up(e: PointerEvent): void {
    const finger = this.fingers.get(e.pointerId);
    if (!finger) return;
    this.fingers.delete(e.pointerId);
    // Some phones only let sound begin when a finger lifts, not when it lands.
    this.callbacks.onActivity();
    const [wx, wy] = this.worldPoint(e);
    const wasPinching = this.pinching;
    if (finger.role === 'cloud') {
      this.carrying = false;
      this.world.play.release();
    } else if (finger.role === 'point') {
      this.endPinch();
      // A hold that already produced taps should not add one more on release.
      const heldLong = this.holder === e.pointerId && this.held >= HOLD_DELAY;
      if (!finger.moved && !wasPinching && !heldLong) this.tap(finger, wx, wy, e);
      else if (finger.moved && finger.touch && !wasPinching && !this.fingers.size) this.flick(finger, e.timeStamp);
    }
    if (this.holder === e.pointerId) this.letGoOfSpring();
    if (![...this.fingers.values()].some((f) => f.moved)) this.dragging = false;
    // What is under the pointer may have just changed (a tree was shaken, a treasure taken).
    if (!finger.touch) this.over = this.world.pointAt(wx, wy).cursor;
    this.point();
  }

  /** A press that never became a drag: act on whatever is there. A finger also asks about buildings this way. */
  private tap(finger: Finger, wx: number, wy: number, e: PointerEvent): void {
    // A fingertip that comes down beside a dewdrop meant the dewdrop.
    const answered = finger.touch ? this.world.play.hover(wx, wy, this.sweepReach) || this.world.touchAt(wx, wy, this.reach) : this.world.tapAt(wx, wy);
    if (answered) {
      this.pulse = RENDER.cursor.pulseSeconds;
      if (finger.touch) this.callbacks.onTouch();
    } else if (finger.touch) {
      // Nothing to do here, but perhaps something to read: a finger cannot hover to find out.
      const hover = this.world.hoverNear(wx, wy, this.reach);
      if (hover) this.callbacks.onHover(hover, e.clientX, e.clientY, true);
    }
  }

  /** A finger let go of the view while still moving: send the view on its way. */
  private flick(finger: Finger, now: number): void {
    if (now - finger.moment > FLING_REST || Math.hypot(finger.vx, finger.vy) < RENDER.camera.flingSpeed) return;
    this.world.camera.fling(finger.vx * this.ratio, finger.vy * this.ratio);
  }

  private cancel(e: PointerEvent): void {
    const finger = this.fingers.get(e.pointerId);
    this.fingers.delete(e.pointerId);
    if (finger?.role === 'cloud' || !this.fingers.size) {
      this.carrying = false;
      this.world.play.release();
    }
    if (finger?.role === 'point') this.endPinch();
    if (this.holder === e.pointerId || !this.fingers.size) this.letGoOfSpring();
    if (![...this.fingers.values()].some((f) => f.moved)) this.dragging = false;
    this.point();
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.world.camera.zoomAt((e.clientX - rect.left) * this.ratio, (e.clientY - rect.top) * this.ratio, e.deltaY < 0 ? 1 : -1);
    this.callbacks.onLook();
  }

  /** Called every frame: while the spring is held down, it keeps getting tapped. */
  update(dt: number): void {
    if (this.pulse > 0) {
      this.pulse -= dt;
      if (this.pulse <= 0) this.point();
    }
    // Sweeping ends on its own, without the mouse moving.
    if (this.over === 'sweep' && !this.world.play.sweeping) {
      this.over = 'pan';
      this.point();
    } else if (this.over === 'pan' && this.world.play.sweeping) {
      this.over = 'sweep';
      this.point();
    }
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
