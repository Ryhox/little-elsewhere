import { BALANCE } from '@/config/balance';
import { BUILDING_BY_ID } from '@/config/buildings';
import { RENDER } from '@/config/render';
import { RESOURCES } from '@/config/resources';
import type { Point } from '@/config/world';
import { fmt } from '@/game/format';
import { noteWatering, pet, shake, sweep } from '@/game/play';
import type { Actor } from './actors';
import { currentSprite, hits, makeEntity, type Entity } from './entity';
import type { RegionView } from './populate';
import type { Stage } from './stage';

const PLAY = BALANCE.play;
const LOOK = RENDER.play;

/**
 * Hands-on play in the world: dewdrops to sweep up, plants to shake, creatures to pet
 * and a rain cloud to drag around. Also where buildings show off what they are earning.
 */
export class Play {
  private drops: Entity[] = [];
  private spawnClock = 2;
  private chain = 0;
  private chainClock = 0;
  private cloud: Entity | null = null;
  private held = false;
  private rainCarry = 0;
  private waterClock = 0;
  private incomeCarry = 0;

  constructor(private readonly s: Stage) {}

  reset(): void {
    this.drops.length = 0;
    this.cloud = null;
    this.held = false;
    this.chain = 0;
    this.s.game.watered = {};
  }

  entities(): Entity[] {
    return this.cloud ? [...this.drops, this.cloud] : this.drops;
  }

  private views(): RegionView[] {
    return [...this.s.views.values()];
  }

  /** A random standing thing somewhere in the world (favouring buildings), or null if there is nothing yet. */
  private anything(buildingsOnly = false): Entity | null {
    const views = this.views();
    for (let tries = 0; tries < 12; tries++) {
      const view = views[Math.floor(Math.random() * views.length)];
      if (!view) return null;
      const lists = [...view.buildings.values()].filter((l) => l.length);
      const list = lists.length && (buildingsOnly || Math.random() < 0.65) ? lists[Math.floor(Math.random() * lists.length)] : buildingsOnly ? null : view.decor;
      const e = list?.[Math.floor(Math.random() * list.length)];
      if (e && !e.hidden && e.born <= this.s.time && (!e.flag || this.s.game.mods.flags[e.flag])) return e;
    }
    return null;
  }

  /* ───────────────────────────── Sweeping dew ───────────────────────────── */

  private spawnDrop(): void {
    const host = this.anything();
    if (!host) return;
    const sprite = currentSprite(host, this.s.season);
    const drop = makeEntity(this.s.atlas, 'item_dew', host.x + Math.round((Math.random() - 0.5) * sprite.w * 0.5), host.y + 1, { tag: 'drop', born: this.s.time, shadow: false, region: host.region });
    // Flat things (lily pads, farm plots) hold their drops low; tall things up among their leaves.
    drop.lift = host.flat ? 3 : 4 + Math.random() * sprite.h * 0.5;
    this.drops.push(drop);
  }

  /**
   * The pointer is here: gather any dewdrop it is touching. A finger covers more than a mouse
   * pointer does, so it may pass a wider `reach`. Returns true if it gathered anything.
   */
  hover(wx: number, wy: number, reach: number = PLAY.sweep.reach): boolean {
    const p = PLAY.sweep;
    let gathered = false;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (Math.abs(wx - d.x) > reach || Math.abs(wy - (d.y - d.lift)) > reach) continue;
      gathered = true;
      this.drops.splice(i, 1);
      const amount = sweep(this.s.game, this.chain);
      this.chain++;
      this.chainClock = p.chainWindow;
      this.s.burst('collect', d.x, d.y - d.lift, 0.7);
      const streak = this.chain > 2 ? ` ×${this.chain}` : '';
      this.s.say(`+${fmt(amount, 1)}${streak}`, d.x, d.y - d.lift - 4, RESOURCES.dew.color);
    }
    return gathered;
  }

  /* ───────────────────────────── The rain cloud ───────────────────────────── */

  /** Is the rain cloud under this world point (or within `reach` of it, for a finger)? */
  overCloud(wx: number, wy: number, reach = 0): boolean {
    const c = this.cloud;
    return !!c && hits(c, currentSprite(c, this.s.season), wx, wy, 5 + reach);
  }

  /** Try to pick up the cloud at a world point. */
  grab(wx: number, wy: number, reach = 0): boolean {
    if (!this.overCloud(wx, wy, reach)) return false;
    this.held = true;
    return true;
  }

  drag(wx: number, wy: number): void {
    if (!this.cloud || !this.held) return;
    // The cloud hangs above the spot it rains on; the pointer holds the cloud itself.
    this.cloud.x = wx;
    this.cloud.y = wy + LOOK.cloudLift;
  }

  release(): void {
    this.held = false;
  }

  get dragging(): boolean {
    return this.held;
  }

  private rain(dt: number): void {
    const c = this.cloud!;
    const { particles } = this.s;
    this.rainCarry += dt * LOOK.rainPerSecond * particles.density;
    while (this.rainCarry >= 1) {
      this.rainCarry -= 1;
      particles.spawn(particles.id('rain'), c.x + (Math.random() - 0.5) * LOOK.rainWidth, c.y + (Math.random() - 0.5) * 8, LOOK.cloudLift - 4, 0, 0, -90);
    }
    const until = this.s.time + PLAY.cloud.seconds;
    const r = PLAY.cloud.radius;
    let fresh = false;
    for (const view of this.views()) {
      const b = view.terrain.bounds;
      if (c.x < b.x - r || c.x > b.x + b.w + r || c.y < b.y - r || c.y > b.y + b.h + r) continue;
      for (const list of view.buildings.values()) {
        for (const e of list) {
          if (Math.abs(e.x - c.x) > r || Math.abs(e.y - c.y) > r * 0.7) continue;
          if (e.wet < this.s.time) fresh = true;
          e.wet = until;
        }
      }
    }
    if (fresh) noteWatering(this.s.game);
  }

  /** Work out what share of each kind of building is currently watered, for the economy. */
  private measureWatering(): void {
    const watered: Record<string, number> = {};
    const totals: Record<string, number> = {};
    for (const view of this.views()) {
      for (const [id, list] of view.buildings) {
        for (const e of list) {
          totals[id] = (totals[id] ?? 0) + 1;
          if (e.wet > this.s.time) watered[id] = (watered[id] ?? 0) + 1;
        }
      }
    }
    for (const id in watered) watered[id] /= totals[id];
    this.s.game.watered = watered;
  }

  /* ───────────────────────────── Shaking and petting ───────────────────────────── */

  /** What a tap on this entity would do right now, if anything. */
  offer(e: Entity | null): 'pet' | 'shake' | null {
    if (!e || e.ready > this.s.time) return null;
    const actor = e as Partial<Actor>;
    if (actor.def) return actor.def.move !== 'swim' ? 'pet' : null;
    const tall = currentSprite(e, this.s.season).h >= LOOK.shakeableHeight;
    return e.tag === 'decor' && e.sway && !e.flat && tall ? 'shake' : null;
  }

  /** A tap landed on this entity (the topmost under the pointer). Returns true if it responded. */
  tap(e: Entity | null): boolean {
    const offer = this.offer(e);
    if (!e || !offer) return false;
    if (offer === 'pet') {
      const actor = e as Actor;
      pet(this.s.game);
      e.ready = this.s.time + PLAY.pet.cooldown;
      e.badge = this.s.atlas.get('emote_heart');
      actor.hop = 0.5;
      this.s.burst('collect', e.x, e.y - e.lift - 8, 0.8);
      return true;
    }
    const { amount, seed } = shake(this.s.game);
    e.jolt = this.s.time;
    e.ready = this.s.time + PLAY.shake.cooldown;
    const top = e.y - currentSprite(e, this.s.season).h * 0.6;
    this.s.burst('bloom', e.x, top, 1);
    this.s.burst('springAuto', e.x, top, 2);
    this.s.say(seed ? `+${fmt(amount, 1)} and a seed!` : `+${fmt(amount, 1)}`, e.x, top - 6, RESOURCES.dew.color, seed);
    return true;
  }

  /* ───────────────────────────── Showing income ───────────────────────────── */

  /** Now and then a building on screen pops a "+N": what one copy of it gathered in the last couple of seconds. */
  private showIncome(dt: number): void {
    const { perSecond, seconds } = RENDER.income;
    this.incomeCarry += dt * perSecond;
    while (this.incomeCarry >= 1) {
      this.incomeCarry -= 1;
      const e = this.anything(true);
      const def = e && BUILDING_BY_ID[e.tag];
      if (!e || !def) continue;
      const owned = this.s.game.s.b[def.id] ?? 0;
      const each = owned > 0 ? (this.s.game.rates.b[def.id] ?? 0) / owned : 0;
      const cam = this.s.camera;
      const sx = cam.toScreenX(e.x);
      const sy = cam.toScreenY(e.y);
      if (each <= 0 || sx < 0 || sy < 0 || sx > cam.viewW || sy > cam.viewH) continue;
      this.s.say(`+${fmt(each * seconds, 1)}`, e.x, e.y - currentSprite(e, this.s.season).h - 2, RESOURCES.dew.color);
    }
  }

  update(dt: number, showNumbers: boolean): void {
    const { game, time } = this.s;
    const p = PLAY.sweep;

    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      this.spawnClock = p.every;
      if (this.drops.length < p.cap) this.spawnDrop();
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (time - d.born > p.lifetime) this.drops.splice(i, 1);
      else if (Math.random() < dt * LOOK.dropSparkle) this.s.particles.spawn(this.s.particles.id('sparkle'), d.x, d.y, d.lift + 2);
    }
    this.chainClock -= dt;
    if (this.chainClock <= 0) this.chain = 0;

    // The cloud arrives with its upgrade and waits over the clearing until it is picked up.
    if (game.mods.flags.cloud && !this.cloud) {
      const [x, y] = this.s.spring;
      const [dx, dy] = LOOK.cloudHome;
      this.cloud = makeEntity(this.s.atlas, 'raincloud', x + dx, y + dy + LOOK.cloudLift, { tag: 'cloud', born: time });
      this.cloud.lift = LOOK.cloudLift;
    } else if (!game.mods.flags.cloud && this.cloud) this.cloud = null;
    if (this.cloud) {
      this.cloud.lift = LOOK.cloudLift + Math.sin(time * 1.4) * LOOK.cloudBob;
      if (this.held) this.rain(dt);
    }
    this.waterClock -= dt;
    if (this.waterClock <= 0) {
      this.waterClock = LOOK.waterCheckSeconds;
      this.measureWatering();
    }
    if (showNumbers) this.showIncome(dt);
  }

  /** A dewdrop was swept up a moment ago (the chain is still alive). */
  get sweeping(): boolean {
    return this.chainClock > 0;
  }

  /** Where the tutorial should point for shaking: the plant nearest the spring that is ready to be shaken. */
  shakeable(): Point | null {
    const [sx, sy] = this.s.spring;
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const view of this.views()) {
      for (const e of view.decor) {
        if (this.offer(e) !== 'shake' || e.born > this.s.time) continue;
        const d = Math.hypot(e.x - sx, e.y - sy);
        if (d < bestD) [best, bestD] = [e, d];
      }
    }
    return best ? [best.x, best.y - currentSprite(best, this.s.season).h + 14] : null;
  }

  /** Where the tutorial should point for sweeping: the nearest waiting dewdrop, if any. */
  nearestDrop(): Point | null {
    const d = this.drops[0];
    return d ? [d.x, d.y - d.lift] : null;
  }
}
