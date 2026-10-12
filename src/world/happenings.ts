import { BALANCE } from '@/config/balance';
import { EVENT_BY_ID, REWARDS } from '@/config/events';
import { ELDER, LAYOUT_BY_ID, WORLD } from '@/config/world';
import { collect, findSecret } from '@/game/events';
import { framesOf, hits, makeEntity, type Entity, type SeasonBlend } from './entity';
import type { Stage } from './stage';

/** Something that appears for a while and can be clicked. */
interface Happening {
  id: string;
  entity: Entity;
  /** Seconds until it leaves on its own. */
  left: number;
  /** Seconds it has been around. */
  age: number;
  /** Once collected it lingers briefly, then goes. */
  done: boolean;
  vx: number;
  vy: number;
  /** Where a falling star will land. */
  landY: number;
}

const MAGPIE_DELAY = 3.5;
const STAR_EVERY = 1.4;
const STAR_LINGER = 7;

/**
 * The world-side of random events and long-lived special objects:
 * treasure glints, golden butterflies, falling stars, visitors, the merchant's cart,
 * rainbows, the seed plot, Wonders and the Elder Tree.
 */
export class Happenings {
  private list: Happening[] = [];
  /** Standing objects that follow the save rather than a timer. */
  private fixtures = new Map<string, Entity>();
  private starClock = 0;
  /** Rainbow: where it stands and how long it has left. */
  rainbow: { x: number; y: number; left: number } | null = null;
  /** Called when the merchant's cart is clicked. */
  onMerchant: () => void = () => {};

  constructor(private readonly s: Stage) {}

  reset(): void {
    this.list.length = 0;
    this.fixtures.clear();
    this.rainbow = null;
  }

  /** Entities to draw this frame (the scene sorts and lights them with everything else). */
  entities(): Entity[] {
    return [...this.list.map((h) => h.entity), ...this.fixtures.values()];
  }

  /* ───────────────────────────── Appearing ───────────────────────────── */

  private add(id: string, sprite: string, x: number, y: number, left: number, frames = 1): Happening {
    const entity = makeEntity(this.s.atlas, sprite, x, y, { frames, tag: id, born: this.s.time });
    const h: Happening = { id, entity, left, age: 0, done: false, vx: 0, vy: 0, landY: y };
    this.list.push(h);
    return h;
  }

  /** A random event began in the simulation; give it a body in the world. */
  spawn(id: string): void {
    const lasts = EVENT_BY_ID[id]?.lasts ?? 30;
    if (id === 'treasure') {
      const spot = this.s.randomSpot();
      if (!spot) return;
      // The glint itself is drawn with particles; the chest only appears when it is dug up.
      const h = this.add(id, 'chest', spot.x, spot.y, lasts);
      h.entity.hidden = true;
    } else if (id === 'golden') {
      const box = this.s.extent();
      const h = this.add(id, 'golden', box.x - 20, box.y + box.h * (0.3 + Math.random() * 0.4), lasts, 3);
      h.vx = (box.w + 40) / lasts;
      h.entity.lift = 14;
    } else if (id === 'visitor') {
      const spot = this.s.randomSpot();
      if (!spot) return;
      this.add(id, 'gloamcat', spot.x, spot.y, lasts, 5);
      this.s.burst('poof', spot.x, spot.y);
    } else if (id === 'whale') {
      const at = LAYOUT_BY_ID.isles.at;
      const h = this.add(id, 'whale', at[0] - 150, at[1] - 60, lasts, 2);
      h.vx = 300 / lasts;
      h.entity.lift = 40;
    } else if (id === 'rainbow') {
      const spot = this.s.randomSpot();
      if (spot) this.rainbow = { x: spot.x, y: spot.y, left: REWARDS.rainbowLasts };
    } else if (id === 'storm') {
      this.s.actors.cheer('note', 0.6);
    }
  }

  despawn(id: string): void {
    for (const h of this.list) if (h.id === id) h.left = 0;
  }

  private fallingStar(): void {
    const spot = this.s.randomSpot();
    if (!spot) return;
    const h = this.add('star', 'item_starlight', spot.x - 60, spot.y, STAR_LINGER + 1);
    h.entity.lift = 120;
    h.landY = spot.y;
    h.vx = 60;
    h.vy = -120;
  }

  /* ───────────────────────────── Fixtures ───────────────────────────── */

  private fixture(key: string, sprite: string, region: string, at: readonly [number, number], frames = 1): Entity | null {
    const view = this.s.view(region);
    if (!view) return null;
    const existing = this.fixtures.get(key);
    if (existing && existing.tag === sprite) return existing;
    const [ox, oy] = view.terrain.layout.at;
    const entity = makeEntity(this.s.atlas, sprite, ox + at[0], oy + at[1], { frames, tag: sprite, region, born: existing ? -100 : this.s.time });
    this.fixtures.set(key, entity);
    if (!existing) this.s.burst('build', entity.x, entity.y);
    return entity;
  }

  /** Keep the standing specials in step with the save: seed plot, Wonders, merchant, Elder Tree. */
  private syncFixtures(): void {
    const { s } = this.s.game;
    const live = new Set<string>();
    const keep = (key: string, entity: Entity | null) => entity && live.add(key);

    if (s.plot || s.seeds > 0 || s.wonders.length > 0) {
      const stage = s.plot ? Math.min(3, 1 + Math.floor(s.plot.progress * 3)) : 0;
      keep('plot', this.fixture('plot', `seedplot_${stage}`, WORLD.seedPlot[0], WORLD.seedPlot[1]));
    }
    s.wonders.forEach((id, i) => {
      const spot = WORLD.wonderSpots[i % WORLD.wonderSpots.length];
      keep(`wonder${i}`, this.fixture(`wonder${i}`, `wonder_${id}`, spot[0], spot[1]));
    });
    if (s.merchant) {
      const [region, at] = WORLD.merchantSpot;
      keep('cart', this.fixture('cart', 'cart', region, at));
      const toad = this.fixture('peddler', 'peddler_0', region, [at[0] - 22, at[1] + 4]);
      if (toad && toad.frames.length === 1) toad.frames = framesOf(this.s.atlas, 'peddler', 5);
      keep('peddler', toad);
    }
    if (this.s.view(ELDER.region)) {
      const stages = BALANCE.prestige.ringStages;
      let stage = 0;
      for (let i = 0; i < stages.length; i++) if (s.rings >= stages[i]) stage = i;
      const elder = this.fixture('elder', this.s.game.mods.flags.everbloom ? 'elder_bloom' : `elder_${stage}`, ELDER.region, ELDER.at);
      if (elder) elder.sway = 0.7;
      keep('elder', elder);
    }
    for (const key of [...this.fixtures.keys()]) {
      if (live.has(key)) continue;
      const gone = this.fixtures.get(key)!;
      this.s.burst('poof', gone.x, gone.y);
      this.fixtures.delete(key);
    }
  }

  /* ───────────────────────────── Each frame ───────────────────────────── */

  update(dt: number): void {
    const { game } = this.s;
    this.syncFixtures();

    if ((game.s.buffs.meteor ?? 0) > 0) {
      this.starClock -= dt;
      if (this.starClock <= 0) {
        this.starClock = STAR_EVERY * (0.6 + Math.random() * 0.8);
        this.fallingStar();
      }
    }
    if (this.rainbow) {
      this.rainbow.left -= dt;
      if (this.rainbow.left <= 0) this.rainbow = null;
    }
    const peddler = this.fixtures.get('peddler');
    if (peddler) peddler.frame = [0, 0, 0, 1, 0, 0, 4, 0][Math.floor(this.s.time * 2.5) % 8];

    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      const e = h.entity;
      h.age += dt;
      h.left -= dt;
      if (h.id === 'treasure' && !h.done) {
        if (Math.random() < dt * 5) this.s.particles.spawn(this.s.particles.id('sparkle'), e.x + (Math.random() - 0.5) * 8, e.y, 2 + Math.random() * 6);
      } else if (h.id === 'golden' || h.id === 'whale') {
        e.x += h.vx * dt;
        e.y += Math.sin(h.age * (h.id === 'golden' ? 2.2 : 0.5)) * dt * (h.id === 'golden' ? 16 : 5);
        e.frame = Math.floor(h.age * (h.id === 'golden' ? 10 : 1.5)) % e.frames.length;
        if (h.id === 'golden' && Math.random() < dt * 9) this.s.particles.spawn(this.s.particles.id('sparkle'), e.x, e.y, e.lift);
      } else if (h.id === 'star') {
        if (e.lift > 0) {
          e.lift = Math.max(0, e.lift + h.vy * dt);
          e.x += h.vx * dt;
          this.s.particles.spawn(this.s.particles.id('star'), e.x, e.y, e.lift);
          if (e.lift === 0) this.s.burst('starCatch', e.x, e.y, 0.6);
        } else if (Math.random() < dt * 3) this.s.particles.spawn(this.s.particles.id('star'), e.x + (Math.random() - 0.5) * 6, e.y, 2 + Math.random() * 5);
      } else if (h.id === 'visitor') {
        e.frame = [0, 0, 0, 1, 0, 4, 0, 0][Math.floor(h.age * 2) % 8];
      }
      // A friendly magpie fetches treasure and butterflies after a moment.
      if (!h.done && game.mods.flags.autoCollect && (h.id === 'treasure' || h.id === 'golden') && h.age > MAGPIE_DELAY) this.take(h, BALANCE.automation.magpieShare);
      if (h.left <= 0) {
        e.alpha -= dt * 2.5;
        if (e.alpha <= 0) this.list.splice(i, 1);
      }
    }
  }

  private take(h: Happening, share = 1): void {
    const e = h.entity;
    if (h.done || !collect(this.s.game, h.id, share)) return;
    h.done = true;
    h.left = h.id === 'treasure' ? 1.6 : h.id === 'visitor' ? 1.2 : 0.01;
    if (h.id === 'treasure') {
      e.hidden = false;
      e.born = this.s.time;
      e.frames = framesOf(this.s.atlas, 'chest_open');
      this.s.burst('treasure', e.x, e.y);
    } else if (h.id === 'star') this.s.burst('starCatch', e.x, e.y);
    else {
      this.s.burst('collect', e.x, e.y - e.lift, 1.6);
      if (h.id === 'visitor') e.badge = this.s.atlas.get('emote_heart');
    }
  }

  /**
   * Handle a tap at a world point. Returns true when something here responded.
   * Checks timed events first, then the rainbow's end and the merchant.
   */
  tap(wx: number, wy: number, season: SeasonBlend): boolean {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      if (h.done || h.left <= 0) continue;
      const e = h.entity;
      const sprite = e.frames[e.frame % e.frames.length][season.a];
      // Fast, small things get a generous hit box.
      const near = e.hidden ? Math.abs(wx - e.x) < 9 && Math.abs(wy - e.y) < 9 : hits(e, sprite, wx, wy, h.id === 'golden' || h.id === 'star' ? 7 : 3);
      if (!near) continue;
      this.take(h);
      return true;
    }
    if (this.rainbow && Math.abs(wx - this.rainbow.x) < 12 && Math.abs(wy - this.rainbow.y) < 12) {
      const { x, y } = this.rainbow;
      this.rainbow = null;
      collect(this.s.game, 'rainbow');
      this.s.burst('treasure', x, y);
      return true;
    }
    for (const key of ['cart', 'peddler']) {
      const e = this.fixtures.get(key);
      if (e && hits(e, e.frames[0][season.a], wx, wy, 3)) {
        this.onMerchant();
        return true;
      }
    }
    return false;
  }

  /** The moon's reflection on the pond is a secret; only there at night. */
  tapMoon(wx: number, wy: number, moon: readonly [number, number] | null): boolean {
    if (!moon || this.s.night < 0.7 || Math.abs(wx - moon[0]) > 8 || Math.abs(wy - moon[1]) > 6) return false;
    if (findSecret(this.s.game, 's_moon')) this.s.burst('starCatch', moon[0], moon[1]);
    return true;
  }
}
