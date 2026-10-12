import { BUILDING_BY_ID } from '@/config/buildings';
import { AMBIENT, ANIM_FPS, CREATURES, IDLE_CYCLE, SKIFFS, TINKER, WALK_CYCLE, WORK_CYCLE, type CreatureDef } from '@/config/creatures';
import type { Point } from '@/config/world';
import type { Atlas, Sprite } from '@/engine/atlas';
import type { Game } from '@/game/context';
import { framesOf, makeEntity, type Entity } from './entity';
import type { Nav } from './nav';
import type { RegionView } from './populate';
import { POND, terrainAt } from './terrain';

type State = 'rest' | 'go' | 'work' | 'return' | 'greet' | 'asleep';

/** A living thing: an Entity plus a little state machine. */
export interface Actor extends Entity {
  def: CreatureDef;
  state: State;
  /** State to resume after a greeting. */
  resume: State;
  timer: number;
  route: Point[];
  step: number;
  home: Point;
  homeRegion: string;
  targetRegion: string;
  anim: number;
  carry: Sprite | null;
  greetCooldown: number;
  /** Seconds left of a startled hop. */
  hop: number;
  /** For followers (ducklings): who they trail, and their place in line. */
  leader: Actor | null;
  rank: number;
  /** Tinkers and other one-offs carry an extra key so they can be told apart. */
  key: string;
  /** World time it last brought its gatherings home. */
  paidAt: number;
}

/** What the creature system needs from the world around it. */
export interface Habitat {
  atlas: Atlas;
  nav: Nav;
  game: Game;
  time: number;
  /** 0..1 darkness. */
  night: number;
  view(region: string): RegionView | undefined;
  /** World position of the spring. */
  spring: Point;
  /** Play a named particle burst at a world position. */
  burst(effect: string, x: number, y: number, scale?: number): void;
  /** How much wildlife the quality setting allows, 0..1. */
  ambient: number;
  /**
   * A creature has brought its gatherings home: show what its kind of home earned in the meantime.
   * `share` is this creature's part of that (1 ÷ how many of its kind are out working).
   */
  payout(x: number, y: number, building: string, seconds: number, share: number): void;
}

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pickOne = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export class Actors {
  list: Actor[] = [];
  /** When set, everyone heads home and fades away (the season is ending). */
  recall = false;
  private greetClock = 0;
  private emotes: Record<string, Sprite>;

  constructor(private readonly h: Habitat) {
    this.emotes = Object.fromEntries(['heart', 'note', 'zzz', 'bang', 'spark'].map((n) => [n, h.atlas.get(`emote_${n}`)]));
  }

  reset(): void {
    this.list.length = 0;
    this.recall = false;
  }

  /* ───────────────────────────── Population ───────────────────────────── */

  /** All the places a creature could work at, as world points with the land they are on. */
  private sites(tags: readonly string[]): { x: number; y: number; region: string }[] {
    const out: { x: number; y: number; region: string }[] = [];
    for (const tag of tags) {
      if (tag === 'spring') {
        out.push({ x: this.h.spring[0], y: this.h.spring[1] + 14, region: 'clearing' });
        continue;
      }
      const region = BUILDING_BY_ID[tag]?.region;
      const view = region ? this.h.view(region) : undefined;
      for (const e of view?.buildings.get(tag) ?? []) out.push({ x: e.x, y: e.y + 3, region: region! });
    }
    return out;
  }

  private wanted(def: CreatureDef): number {
    const { s, mods } = this.h.game;
    if (def.flag && !mods.flags[def.flag]) return 0;
    if (def.region && !this.h.view(def.region)) return 0;
    let n = def.max;
    if (def.home) {
      if (!this.h.view(BUILDING_BY_ID[def.home].region)) return 0;
      n = Math.min(def.max, Math.ceil((s.b[def.home] ?? 0) * (def.perHome ?? 1)));
    }
    // Workers are part of the economy and always shown; purely decorative ones follow the quality setting.
    return def.home ? n : Math.ceil(n * this.h.ambient);
  }

  private homeOf(def: CreatureDef, index: number): { at: Point; region: string } | null {
    if (def.home) {
      const region = BUILDING_BY_ID[def.home].region;
      const homes = this.h.view(region)?.buildings.get(def.home) ?? [];
      if (!homes.length) return null;
      const e = homes[index % homes.length];
      return { at: [e.x + ((index * 7) % 9) - 4, e.y + 3], region };
    }
    const region = def.region ?? (def.works[0] ? BUILDING_BY_ID[def.works[0]]?.region : undefined) ?? 'clearing';
    const view = this.h.view(region);
    if (!view) return null;
    if (def.move === 'swim' || def.move === 'hop') return { at: this.pondPoint(view) ?? [view.terrain.layout.at[0], view.terrain.layout.at[1]], region };
    if (def.move === 'perch') {
      const perches = this.sites(def.works);
      if (!perches.length) return null;
      const p = perches[index % perches.length];
      return { at: [p.x - 8, p.y - 6], region: p.region };
    }
    const [ox, oy] = view.terrain.layout.at;
    return { at: [ox + view.terrain.layout.hub[0] + index * 6 - 9, oy + view.terrain.layout.hub[1] + 6], region };
  }

  private spawn(def: CreatureDef, index: number, key: string): Actor | null {
    const home = this.homeOf(def, index);
    if (!home) return null;
    let frameCount = 0;
    while (this.h.atlas.has(`${def.sprite}_${frameCount}`)) frameCount++;
    const base = makeEntity(this.h.atlas, def.sprite, home.at[0], home.at[1], { frames: frameCount, region: home.region, tag: def.sprite, secret: def.secret, born: this.h.time });
    const actor: Actor = {
      ...base,
      // Fish are seen through the water, so they sit in the flat layer and cast no shadow.
      flat: def.sprite.startsWith('fish'),
      shadow: !def.sprite.startsWith('fish'),
      def,
      state: 'rest',
      resume: 'rest',
      timer: rnd(0, 2.5),
      route: [],
      step: 0,
      home: home.at,
      homeRegion: home.region,
      targetRegion: home.region,
      anim: Math.random() * 10,
      carry: null,
      greetCooldown: rnd(2, AMBIENT.greeting.cooldown),
      hop: 0,
      leader: null,
      rank: 0,
      key,
      paidAt: this.h.time,
    };
    if (def.move === 'swim' || def.move === 'hop') actor.waterline = actor.y;
    this.h.burst('poof', actor.x, actor.y);
    return actor;
  }

  /** Bring the population in line with what the player owns. Cheap; call it whenever counts may have changed. */
  sync(): void {
    const defs: CreatureDef[] = [...CREATURES];
    const skiffs: CreatureDef = { sprite: 'skiff', move: 'swim', region: 'pond', max: Math.min(SKIFFS.max, this.h.game.s.b.skiff ?? 0), works: [], speed: SKIFFS.speed, workTime: [2, 5], restTime: [0, 2], secret: SKIFFS.secret };
    const tinkers: CreatureDef = { sprite: TINKER.sprite, move: 'walk', max: Math.floor(this.h.game.mods.helperSlots), works: Object.keys(BUILDING_BY_ID), speed: TINKER.speed, workTime: [0.7, 1.4], restTime: [0.2, 0.8], roams: true, workFx: 'collect' };
    for (const def of [...defs, skiffs, tinkers]) {
      const want = def.sprite === 'skiff' || def.sprite === TINKER.sprite ? def.max : this.wanted(def);
      const mine = this.list.filter((a) => a.def.sprite === def.sprite && !a.leader);
      for (let i = mine.length; i < want; i++) {
        const spriteDef = def.sprite === 'skiff' ? { ...def, sprite: SKIFFS.sprites[i % SKIFFS.sprites.length] } : def;
        const actor = this.spawn(spriteDef, i, `${def.sprite}:${i}`);
        if (!actor) break;
        // Skiffs keep the shared 'skiff' identity so they are counted together.
        if (def.sprite === 'skiff') {
          actor.def = def;
          actor.frames = framesOf(this.h.atlas, SKIFFS.sprites[i % SKIFFS.sprites.length]);
        }
        this.list.push(actor);
        for (let f = 0; f < (def.followers?.[1] ?? 0); f++) {
          const follower = this.spawn({ ...def, sprite: def.followers![0], followers: undefined }, i, `${def.sprite}:${i}:f${f}`);
          if (!follower) continue;
          follower.leader = actor;
          follower.rank = f + 1;
          this.list.push(follower);
        }
      }
      if (mine.length > want) {
        const extra = new Set(mine.slice(want));
        this.list = this.list.filter((a) => !extra.has(a) && !(a.leader && extra.has(a.leader)));
      }
    }
  }

  /* ───────────────────────────── Helpers ───────────────────────────── */

  /** A random point on the water of a land's pond. */
  private pondPoint(view: RegionView): Point | null {
    const ponds = view.terrain.layout.ponds;
    if (!ponds?.length) return null;
    const [ox, oy] = view.terrain.layout.at;
    for (let tries = 0; tries < 30; tries++) {
      const [px, py, rx, ry] = pickOne(ponds);
      const x = ox + px + (Math.random() * 2 - 1) * rx * 0.82;
      const y = oy + py + (Math.random() * 2 - 1) * ry * 0.78;
      if (terrainAt(view.terrain, x, y) === POND && terrainAt(view.terrain, x, y + 5) === POND && terrainAt(view.terrain, x, y - 5) === POND) return [x, y];
    }
    return null;
  }

  /** A worker arrives home with what it gathered: the income its home made while it was out pops up above it. */
  private bringHome(a: Actor): void {
    const home = a.def.home;
    if (!home || !a.carry) return;
    let peers = 0;
    for (const other of this.list) if (other.def === a.def) peers++;
    this.h.payout(a.x, a.y, home, this.h.time - a.paidAt, 1 / Math.max(1, peers));
    a.paidAt = this.h.time;
  }

  private emote(a: Actor, name: string): void {
    a.badge = this.emotes[name];
  }

  /** Everyone near a point jumps (something exciting just happened there). */
  startle(x: number, y: number, radius: number): void {
    for (const a of this.list) {
      if (a.def.move !== 'walk' || a.hop > 0) continue;
      if (Math.abs(a.x - x) < radius && Math.abs(a.y - y) < radius) a.hop = 0.4 + Math.random() * 0.15;
    }
  }

  /** A burst of feeling across the whole population (rain, festivals, a new season). */
  cheer(emote: string, chance: number): void {
    for (const a of this.list) if (a.def.move === 'walk' && Math.random() < chance) this.emote(a, emote);
  }

  private setRoute(a: Actor, x: number, y: number, region: string): boolean {
    const route = this.h.nav.route(a.x, a.y, a.region, x, y, region);
    if (!route) return false;
    a.route = route;
    a.step = 0;
    a.targetRegion = region;
    return true;
  }

  /** Move toward the current waypoint. Returns true on reaching the end of the route. */
  private follow(a: Actor, dt: number, speed: number): boolean {
    const target = a.route[a.step];
    if (!target) return true;
    const dx = target[0] - a.x;
    const dy = target[1] - a.y;
    const d = Math.hypot(dx, dy);
    const move = speed * dt;
    if (d <= move) {
      a.x = target[0];
      a.y = target[1];
      a.step++;
      if (a.step >= a.route.length) {
        a.region = a.targetRegion;
        return true;
      }
      return false;
    }
    a.x += (dx / d) * move;
    a.y += (dy / d) * move;
    if (Math.abs(dx) > 0.4) a.flip = dx < 0;
    return false;
  }

  /* ───────────────────────────── Behaviour ───────────────────────────── */

  private walker(a: Actor, dt: number): void {
    const { def } = a;
    const speed = def.speed * (this.h.game.mods.flags.quickFeet ? 1.35 : 1) * ((this.h.game.s.buffs.call ?? 0) > 0 ? 1.6 : 1);
    const sleepy = this.h.night > 0.75 && !def.nocturnal && def.sprite !== TINKER.sprite;
    switch (a.state) {
      case 'rest': {
        a.timer -= dt;
        if (this.recall || a.timer > 0) break;
        if (sleepy && Math.random() < 0.6) {
          a.state = 'asleep';
          this.emote(a, 'zzz');
          break;
        }
        const sites = this.sites(def.works).filter((s) => def.roams || s.region === a.homeRegion || Math.random() < 0.35);
        const site = sites.length ? pickOne(sites) : null;
        if (site && this.setRoute(a, site.x + rnd(-6, 6), site.y + rnd(0, 4), site.region)) {
          a.state = 'go';
          a.badge = a.carry;
        } else a.timer = rnd(1, 3);
        break;
      }
      case 'asleep':
        if (this.h.night < 0.5) {
          a.state = 'rest';
          a.badge = null;
          a.timer = rnd(0, 2);
        }
        break;
      case 'go':
        if (this.follow(a, dt, speed)) {
          a.state = 'work';
          a.timer = rnd(def.workTime[0], def.workTime[1]);
          a.badge = null;
        }
        break;
      case 'work':
        a.timer -= dt;
        if (def.workFx && Math.random() < dt * 1.6) this.h.burst(def.workFx, a.x, a.y - 4, 0.6);
        if (a.timer > 0) break;
        a.carry = def.carries ? this.h.atlas.get(def.carries) : null;
        a.badge = a.carry;
        a.state = this.setRoute(a, a.home[0], a.home[1], a.homeRegion) ? 'return' : 'rest';
        break;
      case 'return':
        if (this.follow(a, dt, speed)) {
          this.bringHome(a);
          a.carry = null;
          a.badge = null;
          a.state = 'rest';
          a.timer = rnd(def.restTime[0], def.restTime[1]);
        }
        break;
      case 'greet':
        a.timer -= dt;
        if (a.timer <= 0) {
          a.state = a.resume;
          a.badge = a.carry;
        }
        break;
    }
    if (this.recall && a.state !== 'return' && a.state !== 'rest') {
      a.state = this.setRoute(a, a.home[0], a.home[1], a.homeRegion) ? 'return' : 'rest';
      a.badge = null;
    }
    if (this.recall && a.state === 'rest') a.alpha = Math.max(0, a.alpha - dt * 1.5);

    const cycle = a.state === 'go' || a.state === 'return' ? WALK_CYCLE : a.state === 'work' ? WORK_CYCLE : IDLE_CYCLE;
    const fps = a.state === 'work' ? ANIM_FPS.work : cycle === WALK_CYCLE ? ANIM_FPS.walk : ANIM_FPS.idle;
    a.frame = cycle[Math.floor(a.anim * fps) % cycle.length];
    if (a.hop > 0) {
      a.hop -= dt;
      a.lift = Math.max(0, Math.sin((a.hop / 0.5) * Math.PI) * 6);
    } else a.lift = 0;
  }

  private flier(a: Actor, dt: number): void {
    const { def } = a;
    const awake = def.nocturnal === undefined ? true : def.nocturnal ? this.h.night > 0.45 : this.h.night < 0.6;
    const altitude = def.altitude ?? 10;
    a.frame = Math.floor(a.anim * ANIM_FPS.fly) % a.frames.length;
    if (!awake || this.recall) {
      // Head home and tuck in.
      a.route = [a.home];
      a.step = 0;
      const there = this.follow(a, dt, def.speed);
      a.lift = Math.max(2, a.lift - dt * 10);
      a.alpha = Math.max(0, a.alpha - (there ? dt * 1.2 : 0));
      a.state = 'rest';
      a.timer = rnd(0, 2);
      a.badge = null;
      return;
    }
    a.alpha = Math.min(1, a.alpha + dt * 1.5);
    a.lift += (altitude + Math.sin(a.anim * 2.3) * 2.5 - a.lift) * Math.min(1, dt * 3);
    switch (a.state) {
      case 'rest': {
        a.timer -= dt;
        if (a.timer > 0) break;
        const sites = this.sites(def.works);
        const site = sites.length ? pickOne(sites) : null;
        a.route = [site ? [site.x + rnd(-8, 8), site.y + rnd(-4, 4)] : [a.home[0] + rnd(-40, 40), a.home[1] + rnd(-26, 26)]];
        a.step = 0;
        a.state = 'go';
        break;
      }
      case 'go':
        if (this.follow(a, dt, def.speed)) {
          a.state = 'work';
          a.timer = rnd(def.workTime[0], def.workTime[1]);
        }
        break;
      case 'work':
        a.timer -= dt;
        a.x += Math.sin(a.anim * 3.1) * dt * 5;
        if (def.workFx && Math.random() < dt * 1.2) this.h.burst(def.workFx, a.x, a.y, 0.5);
        if (a.timer > 0) break;
        a.carry = def.carries ? this.h.atlas.get(def.carries) : null;
        a.route = [[a.home[0] + rnd(-5, 5), a.home[1] + rnd(-3, 3)]];
        a.step = 0;
        a.state = 'return';
        break;
      case 'return':
        if (this.follow(a, dt, def.speed)) {
          this.bringHome(a);
          a.carry = null;
          a.state = 'rest';
          a.timer = rnd(def.restTime[0], def.restTime[1]);
        }
        break;
      default:
        a.state = 'rest';
    }
    a.badge = a.carry;
  }

  private swimmer(a: Actor, dt: number): void {
    const view = this.h.view(a.homeRegion);
    a.frame = Math.floor(a.anim * ANIM_FPS.swim) % a.frames.length;
    a.waterline = a.y;
    if (a.leader) {
      // Ducklings paddle in a line behind their mother.
      const gap = 9 * a.rank;
      const tx = a.leader.x + (a.leader.flip ? gap : -gap);
      const ty = a.leader.y + 1;
      const d = Math.hypot(tx - a.x, ty - a.y);
      if (d > 1) {
        a.x += ((tx - a.x) / d) * Math.min(d, a.def.speed * 1.5 * dt);
        a.y += ((ty - a.y) / d) * Math.min(d, a.def.speed * 1.5 * dt);
        a.flip = tx < a.x - 0.5 ? true : tx > a.x + 0.5 ? false : a.flip;
      }
      return;
    }
    if (!view) return;
    if (a.state === 'go') {
      if (this.follow(a, dt, a.def.speed)) {
        a.state = 'rest';
        a.timer = rnd(a.def.workTime[0], a.def.workTime[1]);
      } else if (!a.flat && Math.random() < dt * 2.2) this.h.burst('wake', a.x + (a.flip ? 5 : -5), a.y + 1);
      return;
    }
    a.timer -= dt;
    if (a.timer > 0) return;
    const point = this.pondPoint(view);
    if (point) {
      a.route = [point];
      a.step = 0;
      a.state = 'go';
    } else a.timer = 2;
  }

  private hopper(a: Actor, dt: number): void {
    const view = this.h.view(a.homeRegion);
    a.waterline = a.y;
    if (a.state === 'go') {
      const from = a.home;
      const to = a.route[0];
      a.timer += dt * 2.4;
      const t = Math.min(1, a.timer);
      a.x = from[0] + (to[0] - from[0]) * t;
      a.y = from[1] + (to[1] - from[1]) * t;
      a.lift = Math.sin(t * Math.PI) * 11;
      a.frame = 2;
      if (t >= 1) {
        a.home = to;
        a.lift = 0;
        a.state = 'rest';
        a.timer = rnd(a.def.workTime[0], a.def.workTime[1]);
        this.h.burst('splash', a.x, a.y, 0.5);
      }
      return;
    }
    a.frame = IDLE_CYCLE[Math.floor(a.anim * ANIM_FPS.idle) % IDLE_CYCLE.length];
    a.timer -= dt;
    if (a.timer > 0 || !view) return;
    const pads = [...(view.buildings.get('lily') ?? []), ...view.decor.filter((e) => e.flat && e.tag === 'decor' && terrainAt(view.terrain, e.x, e.y) === POND)];
    const pad = pads.length ? pickOne(pads) : null;
    const to: Point | null = pad ? [pad.x + rnd(-2, 2), pad.y - 1] : this.pondPoint(view);
    if (!to) {
      a.timer = 2;
      return;
    }
    a.flip = to[0] < a.x;
    a.home = [a.x, a.y];
    a.route = [to];
    a.timer = 0;
    a.state = 'go';
  }

  private percher(a: Actor, dt: number): void {
    a.lift = 26;
    a.frame = IDLE_CYCLE[Math.floor(a.anim * ANIM_FPS.idle * (this.h.night > 0.5 ? 1 : 0.4)) % IDLE_CYCLE.length];
    a.timer -= dt;
    if (a.timer <= 0) {
      a.timer = rnd(a.def.workTime[0], a.def.workTime[1]);
      a.flip = !a.flip;
    }
  }

  /** Walkers that pass close by stop to say hello. */
  private greetings(): void {
    const g = AMBIENT.greeting;
    const walkers = this.list.filter((a) => a.def.move === 'walk' && (a.state === 'go' || a.state === 'return') && a.greetCooldown <= 0);
    for (let i = 0; i < walkers.length; i++) {
      for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i];
        const b = walkers[j];
        if (a.greetCooldown > 0 || b.greetCooldown > 0 || Math.abs(a.x - b.x) > g.distance || Math.abs(a.y - b.y) > g.distance * 0.6) continue;
        for (const [me, other] of [[a, b], [b, a]] as const) {
          me.resume = me.state;
          me.state = 'greet';
          me.timer = g.seconds;
          me.greetCooldown = g.cooldown + Math.random() * g.cooldown;
          me.flip = other.x < me.x;
        }
        this.emote(a, this.h.game.mods.flags.festival || Math.random() < 0.5 ? 'heart' : 'note');
        this.emote(b, 'note');
      }
    }
  }

  update(dt: number): void {
    this.greetClock -= dt;
    if (this.greetClock <= 0) {
      this.greetClock = 0.3;
      this.greetings();
    }
    for (const a of this.list) {
      a.anim += dt;
      a.greetCooldown -= dt;
      if (a.def.move === 'walk') this.walker(a, dt);
      else if (a.def.move === 'fly') this.flier(a, dt);
      else if (a.def.move === 'swim') this.swimmer(a, dt);
      else if (a.def.move === 'hop') this.hopper(a, dt);
      else this.percher(a, dt);
    }
  }
}
