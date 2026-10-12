import { GLOW_LAMPLIT } from '@/art/kit';
import { SPRING_FRAMES } from '@/art/landmarks';
import { BALANCE } from '@/config/balance';
import { BUILDING_BY_ID, BUILDING_IDS } from '@/config/buildings';
import { EFFECTS, PARTICLES } from '@/config/particles';
import { PAL } from '@/config/palette';
import { REGIONS } from '@/config/regions';
import { RENDER, type Quality } from '@/config/render';
import { RESOURCES } from '@/config/resources';
import { SPRING_TIER_UPGRADES } from '@/config/upgrades';
import { ELDER, LAYOUT_BY_ID, LINKS, WORLD, type Point } from '@/config/world';
import type { Atlas } from '@/engine/atlas';
import { Camera, type Rect } from '@/engine/camera';
import { PixelFont } from '@/engine/font';
import { ParticleSystem, PixelLayer } from '@/engine/particles';
import { clamp } from '@/engine/rng';
import { tap } from '@/game/actions';
import type { Game } from '@/game/context';
import { findSecret } from '@/game/events';
import { fmt } from '@/game/format';
import { Actors } from './actors';
import { Ambience } from './ambience';
import { bakeMirror, bakeShadows, fingerprint, groundLamps, newBake, SHADE_MARGIN, type Bake } from './bake';
import { Cutscene } from './cutscene';
import { currentSprite, drawEntity, hits, makeEntity, type Entity, type SeasonBlend } from './entity';
import { Floaters } from './floaters';
import { Happenings } from './happenings';
import { ambientColor, Lighting, Reflections, Shadows, sunState, type Lamp } from './light';
import { Nav } from './nav';
import { Play } from './play';
import { SeaLife } from './sealife';
import { bridgeEnds, populate, spanBridge, syncBuilding, type Bridge, type RegionView } from './populate';
import { buildTerrain, FOAM_FRAMES, LAND, PATH, POND, SEA, terrainAt } from './terrain';
import type { Spot, Stage } from './stage';
import { Water } from './water';

const BRIDGE_SEGMENT = 8;
const BRIDGE_BUILD_SECONDS = 1.1;
/** At most this many cached shadow/reflection images are refreshed per frame. */
const BAKES_PER_FRAME = 2;
/** The sun's shadow vector is rounded to 1/SUN_STEPS before deciding a cache is stale. */
const SUN_STEPS = 24;
/** How far above its target the guide's arrow floats, in world pixels. */
const POINTER_LIFT = 44;
const CULL_MARGIN = 48;
const SYNC_EVERY = 1;
/** Rainbow bands, outermost first. */
const RAINBOW = [PAL.red[2], PAL.orange[2], PAL.yellow[2], PAL.leaf[4], PAL.blue[3], PAL.violet[2]];
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const GOLD = hex(PAL.gold[4]);

/** Something under the pointer that has a tooltip. */
export interface Hover {
  kind: 'spring' | 'building' | 'thing';
  id: string;
}

/** Which mouse pointer the world asks for: it says what a click here would do. */
export type WorldCursor = 'pan' | 'spring' | 'sweep' | 'shake' | 'pet' | 'cloud' | 'find' | 'look';

/**
 * The living world: owns every land, creature and effect, keeps them in step with the
 * simulation, and draws the lot. Rendering happens at one world pixel per pixel on an
 * off-screen view, which is then scaled up crisply to the screen.
 */
export class World implements Stage {
  readonly camera = new Camera({ ...RENDER.camera, world: { x: 0, y: 0, w: WORLD.width, h: WORLD.height } });
  readonly particles = new ParticleSystem(PARTICLES, RENDER.particleCapacity);
  nav = new Nav();
  readonly views = new Map<string, RegionView>();
  readonly season: SeasonBlend = { a: 0, b: 0, blend: 0, winter: 0 };
  readonly actors: Actors;
  readonly happenings: Happenings;
  readonly ambience: Ambience;
  readonly floaters = new Floaters();
  readonly cutscene: Cutscene;
  readonly play: Play;
  readonly sealife: SeaLife;

  quality: Quality = RENDER.quality[2];
  time = 0;
  night = 0;
  spring: Point = [0, 0];
  /** Where the tutorial's bouncing arrow points in the world, if anywhere. */
  pointer: Point | null = null;
  /** Follow new lands with the camera. */
  autoFrame = true;
  showNumbers = true;

  private readonly water = new Water();
  private readonly shadows: Shadows;
  private readonly reflections: Reflections;
  private readonly lighting: Lighting;
  private readonly font = new PixelFont(hex(PAL.outline));
  /** The off-screen frame, one pixel per world pixel. */
  private readonly buffer = document.createElement('canvas');
  private readonly bctx = this.buffer.getContext('2d')!;
  private readonly lit = new PixelLayer();
  private readonly glow = new PixelLayer();
  private bridges: Bridge[] = [];
  private springEntity!: Entity;
  private springTier = -1;
  /** Spring-damper driving the spring's squash: compression and its velocity. */
  private squash = 0;
  private squashV = 0;
  private autoTaps = { amount: 0, clock: 0 };
  private syncClock = 0;
  private lastTap: Point = [0, 0];
  private standing: Entity[] = [];
  private flats: Entity[] = [];
  private movers: Entity[] = [];
  private visibleViews: RegionView[] = [];
  /** Cached static shadows and reflections, one set per land. */
  private bakes = new Map<string, Bake>();
  private lamps: (Lamp & { gx: number; gy: number })[] = [];
  private offsets = new Map<string, number>();
  private moon: Point | null = null;
  private unsubscribe: (() => void)[] = [];

  constructor(
    readonly game: Game,
    readonly atlas: Atlas,
  ) {
    this.shadows = new Shadows(atlas);
    this.reflections = new Reflections(atlas);
    this.lighting = new Lighting(atlas);
    this.actors = new Actors(this);
    this.happenings = new Happenings(this);
    this.ambience = new Ambience(this);
    this.cutscene = new Cutscene(this, this.ambience);
    this.play = new Play(this);
    this.sealife = new SeaLife(this, atlas);
    this.listen();
    this.rebuild();
  }

  get ambient(): number {
    return this.quality.ambient;
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
  }

  /* ───────────────────────────── Keeping in step with the game ───────────────────────────── */

  private listen(): void {
    const bus = this.game.bus;
    this.unsubscribe.push(
      bus.on('reset', () => this.rebuild()),
      bus.on('season', () => this.rebuild()),
      bus.on('region', ({ id, quiet }) => this.addRegion(id, !quiet)),
      bus.on('buy', ({ id }) => this.onBuy(id)),
      bus.on('upgrade', () => this.onUpgrade()),
      bus.on('tap', (e) => this.onTap(e.amount, e.crit, e.auto)),
      bus.on('spawn', ({ id }) => this.happenings.spawn(id)),
      bus.on('despawn', ({ id }) => this.happenings.despawn(id)),
      bus.on('reward', ({ gains, tokens }) => this.onReward(gains, tokens ?? 0)),
      bus.on('wonder', () => this.burst('treasure', this.spring[0], this.spring[1])),
      bus.on('daybreak', ({ night }) => this.actors.cheer(night ? 'zzz' : 'note', 0.25)),
      bus.on('ability', () => this.burst('upgrade', this.spring[0], this.spring[1], 2)),
      bus.on('ending', () => this.bloom()),
    );
  }

  /** The ending: the camera goes to the Elder Tree as it bursts into blossom and everyone celebrates. */
  private bloom(): void {
    const land = this.views.get(ELDER.region);
    if (!land) return;
    const x = land.terrain.layout.at[0] + ELDER.at[0];
    const y = land.terrain.layout.at[1] + ELDER.at[1];
    this.camera.lookAt(x, y - 40);
    this.camera.targetZoom = Math.max(this.camera.targetZoom, 3);
    for (let i = 0; i < 6; i++) this.burst('bloom', x + (Math.random() - 0.5) * 80, y - 60 - Math.random() * 50, 3);
    this.burst('tokens', x, y - 30, 2);
    this.actors.cheer('heart', 1);
  }

  /** Throw everything away and build the world again from the save. */
  rebuild(): void {
    this.views.clear();
    this.bakes.clear();
    this.bridges = [];
    this.nav = new Nav();
    this.actors.reset();
    this.happenings.reset();
    this.ambience.reset();
    this.play.reset();
    this.sealife.reset();
    this.floaters.clear();
    this.particles.clear();
    this.springTier = -1;
    for (const region of REGIONS) if (this.game.s.regions[region.id]) this.addRegion(region.id, false);
    const clearing = LAYOUT_BY_ID.clearing;
    this.spring = [clearing.at[0] + WORLD.spring[0], clearing.at[1] + WORLD.spring[1]];
    this.lastTap = this.spring;
    this.refreshSpring();
    this.syncBuildings(false);
    this.actors.sync();
    this.frameAll();
    this.camera.snap();
  }

  private addRegion(id: string, animate: boolean): void {
    const layout = LAYOUT_BY_ID[id];
    if (!layout || this.views.has(id)) return;
    const view = populate(buildTerrain(layout), this.atlas, animate ? this.time : -100);
    if (animate) {
      // Decoration pops up once the land has surfaced, in a ripple rather than all at once.
      for (const e of view.decor) e.born = this.time + RENDER.rise.seconds * 0.55 + Math.random() * 1.1;
    }
    this.views.set(id, view);
    this.nav.addRegion(view.terrain);
    this.sealife.addRegion(layout);
    for (const link of LINKS) {
      const a = this.views.get(link.a);
      const b = this.views.get(link.b);
      if (!a || !b || this.bridges.some((br) => br.link === link)) continue;
      const bridge = spanBridge(link, a.terrain, b.terrain, animate ? this.time + RENDER.rise.seconds * 0.6 : -100);
      this.bridges.push(bridge);
      const [endA, endB] = bridgeEnds(bridge);
      this.nav.addBridge(endA, link.a, endB, link.b);
    }
    this.water.repaintDepth([...this.views.values()].map((v) => v.terrain));
    const pond = this.views.get('pond');
    this.moon = pond ? [pond.terrain.layout.at[0] + 30, pond.terrain.layout.at[1] + 18] : null;
    if (animate) {
      if (this.autoFrame) this.frameAll();
      this.actors.sync();
    }
  }

  private syncBuildings(celebrate: boolean): void {
    for (const id of BUILDING_IDS) {
      const view = this.views.get(BUILDING_BY_ID[id].region);
      if (!view) continue;
      const added = syncBuilding(view, this.atlas, id, this.game.s.b[id] ?? 0, this.time);
      if (celebrate) for (const e of added) this.burst('build', e.x, e.y);
    }
  }

  private onBuy(id: string): void {
    const view = this.views.get(BUILDING_BY_ID[id].region);
    if (!view) return;
    const before = view.buildings.get(id)?.length ?? 0;
    const added = syncBuilding(view, this.atlas, id, this.game.s.b[id], this.time);
    for (const e of added) this.burst('build', e.x, e.y);
    // Every slot is full: the newest copies still deserve a flourish somewhere visible.
    if (!added.length && before > 0) {
      const list = view.buildings.get(id)!;
      const e = list[Math.floor(Math.random() * list.length)];
      this.burst('upgrade', e.x, e.y - 6, 0.5);
    }
    this.actors.sync();
  }

  private onUpgrade(): void {
    this.refreshSpring();
    this.burst('upgrade', this.spring[0], this.spring[1] - 4, 1.4);
    this.actors.sync();
  }

  private refreshSpring(): void {
    let tier = 0;
    for (const id of SPRING_TIER_UPGRADES) if (this.game.s.up[id]) tier++;
    if (tier === this.springTier) return;
    const popped = this.springTier >= 0;
    this.springTier = tier;
    this.springEntity = makeEntity(this.atlas, `spring_${tier}`, this.spring[0], this.spring[1] + 11, { frames: SPRING_FRAMES, region: 'clearing', tag: 'spring', born: popped ? this.time : -100 });
    this.springEntity.waterline = NaN;
    if (popped) this.burst('build', this.spring[0], this.spring[1] + 8, 2);
  }

  private onTap(amount: number, crit: boolean, auto: boolean): void {
    const [x, y] = this.spring;
    if (auto) {
      this.autoTaps.amount += amount;
      return;
    }
    this.squashV += crit ? 15 : 10;
    this.burst(crit ? 'springGlimmer' : 'springTap', x, y);
    if (this.showNumbers) this.floaters.add(`+${fmt(amount, 1)}${crit ? '!' : ''}`, x, y - 16, crit ? GOLD : RESOURCES.dew.color, crit);
    this.actors.startle(x, y, 46);
  }

  private onReward(gains: Partial<Record<string, number>>, tokens: number): void {
    const [x, y] = this.lastTap;
    let line = 0;
    for (const res in gains) {
      const def = RESOURCES[res as keyof typeof RESOURCES];
      if (this.showNumbers && def) this.floaters.add(`+${fmt(gains[res]!, 1)}`, x, y - 12 - line++ * 8, def.color, true);
    }
    if (tokens > 0) {
      this.floaters.add(`+${tokens} Evergreen`, x, y - 22 - line * 8, GOLD, true);
      this.burst('tokens', x, y);
    }
  }

  /* ───────────────────────────── Stage services ───────────────────────────── */

  view(region: string): RegionView | undefined {
    return this.views.get(region);
  }

  burst(effect: string, x: number, y: number, scale = 1): void {
    for (const spec of EFFECTS[effect] ?? []) this.particles.burst(spec, x, y, scale);
  }

  payout(x: number, y: number, building: string, seconds: number, share: number): void {
    const amount = (this.game.rates.b[building] ?? 0) * seconds * share;
    if (amount <= 0) return;
    this.burst('collect', x, y - 6, 0.5);
    if (this.showNumbers) this.floaters.add(`+${fmt(amount, 1)}`, x, y - 12, RESOURCES.dew.color);
  }

  say(text: string, x: number, y: number, color = '#ffffff', big = false): void {
    this.floaters.add(text, x, y, color, big);
  }

  extent(): Rect {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const v of this.views.values()) {
      const b = v.terrain.bounds;
      const lift = v.terrain.layout.floating ? WORLD.floatHeight : 0;
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y - lift);
      x1 = Math.max(x1, b.x + b.w);
      y1 = Math.max(y1, b.y + b.h);
    }
    return x1 < x0 ? { x: 0, y: 0, w: WORLD.width, h: WORLD.height } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  frameAll(): void {
    this.camera.frame(this.extent(), RENDER.camera.padding);
  }

  randomSpot(): Spot | null {
    const lands = [...this.views.values()].filter((v) => !v.terrain.layout.floating);
    if (!lands.length) return null;
    for (let tries = 0; tries < 24; tries++) {
      const t = lands[Math.floor(Math.random() * lands.length)].terrain;
      const x = Math.round(t.bounds.x + Math.random() * t.bounds.w);
      const y = Math.round(t.bounds.y + Math.random() * t.bounds.h);
      const clear = [[0, 0], [7, 0], [-7, 0], [0, 7], [0, -5]].every(([dx, dy]) => terrainAt(t, x + dx, y + dy) === LAND);
      if (clear) return { x, y, region: t.id };
    }
    return null;
  }

  isWater(x: number, y: number): boolean {
    for (const v of this.views.values()) {
      if (v.terrain.layout.floating) continue;
      const here = terrainAt(v.terrain, x, y);
      if (here === POND) return true;
      if (here === LAND || here === PATH) return false;
      // Just below the land is cliff face, not water.
      if (terrainAt(v.terrain, x, y - WORLD.cliff - 3) !== SEA) return false;
    }
    return true;
  }

  /* ───────────────────────────── Input ───────────────────────────── */

  /** Is this world point on the spring? */
  onSpring(wx: number, wy: number): boolean {
    return Math.hypot(wx - this.spring[0], (wy - this.spring[1]) * 1.5) < RENDER.spring.radius;
  }

  private topEntityAt(wx: number, wy: number): Entity | null {
    for (let i = this.standing.length - 1; i >= 0; i--) {
      const e = this.standing[i];
      if (e.born > this.time || e.alpha < 0.5) continue;
      if (hits(e, currentSprite(e, this.season), wx, wy - (this.offsets.get(e.region) ?? 0), e.secret ? 5 : 0)) return e;
    }
    return null;
  }

  /** A tap or click at a world point. Returns true if anything responded. */
  tapAt(wx: number, wy: number): boolean {
    if (this.cutscene.active) return false;
    this.lastTap = [wx, wy];
    if (this.happenings.tap(wx, wy, this.season) || this.happenings.tapMoon(wx, wy, this.moon)) return true;
    const e = this.topEntityAt(wx, wy);
    const secret = e?.secret || (e?.tag === 'windmill' ? 's_windmill' : '');
    if (e && secret) {
      if (!findSecret(this.game, secret)) this.burst('collect', e.x, e.y - e.lift - 8, 0.6);
      else this.burst('treasure', e.x, e.y - e.lift);
      return true;
    }
    if (this.onSpring(wx, wy)) {
      this.lastTap = this.spring;
      tap(this.game);
      return true;
    }
    // Anything else under the pointer might enjoy a shake or a pat.
    return this.play.tap(e);
  }

  /**
   * What is at a world point: the tooltip to show (if any) and the mouse pointer that says what
   * a click would do. Checks things in the same order `tapAt` acts on them.
   */
  pointAt(wx: number, wy: number): { hover: Hover | null; cursor: WorldCursor } {
    const idle: WorldCursor = this.play.sweeping ? 'sweep' : 'pan';
    if (this.cutscene.active) return { hover: null, cursor: idle };
    if (this.play.overCloud(wx, wy)) return { hover: null, cursor: 'cloud' };
    if (this.happenings.over(wx, wy, this.season) || this.happenings.overMoon(wx, wy, this.moon)) return { hover: null, cursor: 'find' };
    const e = this.topEntityAt(wx, wy);
    const building = e && BUILDING_BY_ID[e.tag] ? ({ kind: 'building', id: e.tag } as const) : null;
    const secret = e?.secret || (e?.tag === 'windmill' ? 's_windmill' : '');
    if (secret && !this.game.s.journal[secret]) return { hover: building ?? { kind: 'thing', id: secret }, cursor: 'find' };
    if (this.onSpring(wx, wy)) return { hover: { kind: 'spring', id: 'spring' }, cursor: 'spring' };
    const offer = this.play.offer(e);
    if (offer) return { hover: building, cursor: offer };
    if (building) return { hover: building, cursor: 'look' };
    return { hover: e?.secret ? { kind: 'thing', id: e.secret } : null, cursor: idle };
  }

  /* ───────────────────────────── Update ───────────────────────────── */

  update(dt: number): void {
    this.time += dt;
    this.night = this.game.rates.night;
    this.particles.density = this.quality.particles;
    this.camera.update(dt);

    // The spring wobbles on a damped spring of its own.
    const sp = RENDER.spring;
    this.squashV += (-sp.stiffness * this.squash - sp.damping * this.squashV) * dt;
    this.squash = clamp(this.squash + this.squashV * dt, -0.7, 1);

    this.autoTaps.clock -= dt;
    if (this.autoTaps.amount > 0 && this.autoTaps.clock <= 0) {
      this.autoTaps.clock = 0.55;
      this.squashV += 4;
      this.burst('springAuto', this.spring[0], this.spring[1]);
      if (this.showNumbers) this.floaters.add(`+${fmt(this.autoTaps.amount, 1)}`, this.spring[0] + 12, this.spring[1] - 8, RESOURCES.dew.color);
      this.autoTaps.amount = 0;
    }
    if (Math.random() < dt * (1.5 + this.game.s.flow * 14)) this.burst(this.game.s.flow > 0.3 ? 'springTap' : 'bubbles', this.spring[0], this.spring[1], this.game.s.flow > 0.3 ? 0.25 : 1);

    this.syncClock -= dt;
    if (this.syncClock <= 0 && !this.cutscene.active) {
      this.syncClock = SYNC_EVERY;
      this.syncBuildings(true);
      this.refreshSpring();
      this.actors.sync();
    }

    this.cutscene.update(dt);
    this.actors.update(dt);
    this.happenings.update(dt);
    this.ambience.update(dt);
    this.sealife.update(dt);
    if (!this.cutscene.active) this.play.update(dt, this.showNumbers);
    this.particles.update(dt);
    this.floaters.update(dt);
    for (const v of this.views.values()) for (const e of v.decor) if (e.fps) e.frame = Math.floor(this.time * e.fps);
    this.springEntity.frame = Math.floor(this.time * sp.frameRate);
  }

  /* ───────────────────────────── Draw ───────────────────────────── */

  private regionOffset(view: RegionView): number {
    const t = clamp((this.time - view.risen) / RENDER.rise.seconds, 0, 1);
    let off = (1 - t) ** 2 * RENDER.rise.depth;
    if (view.terrain.layout.floating) off -= WORLD.floatHeight + Math.sin(this.time * 0.9) * 2;
    return Math.round(off);
  }

  private gather(ox: number, oy: number, vw: number, vh: number): void {
    const flags = this.game.mods.flags;
    const x0 = ox - CULL_MARGIN;
    const x1 = ox + vw + CULL_MARGIN;
    const y0 = oy - CULL_MARGIN;
    const y1 = oy + vh + CULL_MARGIN * 2;
    const { standing, flats, movers } = this;
    standing.length = 0;
    flats.length = 0;
    movers.length = 0;
    const push = (e: Entity): boolean => {
      if (e.hidden || e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1 || (e.flag && !flags[e.flag])) return false;
      (e.flat ? flats : standing).push(e);
      return true;
    };
    // Things that move are also listed on their own: their shadows and reflections cannot be cached.
    const pushMover = (e: Entity) => push(e) && movers.push(e);
    this.offsets.clear();
    this.visibleViews.length = 0;
    for (const v of this.views.values()) {
      this.offsets.set(v.terrain.id, this.regionOffset(v));
      const t = v.terrain;
      if (t.x - SHADE_MARGIN > x1 || t.x + t.w + SHADE_MARGIN < x0 || t.y - SHADE_MARGIN > y1 || t.y + t.h + SHADE_MARGIN < y0) continue;
      this.visibleViews.push(v);
      for (const e of v.decor) push(e);
      for (const list of v.buildings.values()) for (const e of list) push(e);
    }
    pushMover(this.springEntity);
    for (const a of this.actors.list) pushMover(a);
    for (const e of this.happenings.entities()) pushMover(e);
    for (const e of this.ambience.entities()) pushMover(e);
    for (const e of this.play.entities()) pushMover(e);
    for (const e of this.sealife.entities()) pushMover(e);
    standing.sort((a, b) => a.y - b.y);
  }

  private wind(x: number): number {
    const w = RENDER.wind;
    const stormy = (this.game.s.buffs.storm ?? 0) > 0 || (this.game.s.buffs.rain ?? 0) > 0;
    // A gust is the crest of a slow travelling wave; between crests the air is nearly still.
    const wave = Math.sin(this.time * w.speed - x * w.scale);
    return (wave > 0 ? wave ** w.sharpness : 0) * (stormy ? w.stormBoost : 1);
  }

  private drawSpring(ctx: CanvasRenderingContext2D, e: Entity, vx: number, vy: number): void {
    const s = e.frames[e.frame % e.frames.length][this.season.blend > 0.5 ? this.season.b : this.season.a];
    const k = this.squash * RENDER.spring.squash;
    const sy = 1 - k;
    const sx = 1 + k * 0.55;
    ctx.drawImage(this.atlas.canvas, s.x, s.y, s.w, s.h, Math.round(vx - s.ax * sx), Math.round(vy - s.ay * sy), Math.round(s.w * sx), Math.round(s.h * sy));
  }

  private drawBridges(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const h = this.atlas.get('bridge_h');
    const v = this.atlas.get('bridge_v');
    for (const b of this.bridges) {
      const built = clamp((this.time - b.born) / BRIDGE_BUILD_SECONDS, 0, 1);
      if (built <= 0) continue;
      if (b.link.axis === 'h') {
        const len = Math.round((b.x1 - b.x0) * built);
        for (let i = 0; i < len; i += BRIDGE_SEGMENT) {
          const w = Math.min(BRIDGE_SEGMENT, len - i);
          ctx.drawImage(this.atlas.canvas, h.x, h.y, w, h.h, b.x0 + i - ox, b.y0 - h.ay - oy, w, h.h);
        }
      } else {
        const len = Math.round((b.y1 - b.y0) * built);
        for (let i = 0; i < len; i += BRIDGE_SEGMENT) {
          const hh = Math.min(BRIDGE_SEGMENT, len - i);
          ctx.drawImage(this.atlas.canvas, v.x, v.y, v.w, hh, b.x0 - v.ax - ox, b.y0 + i - oy, v.w, hh);
        }
      }
    }
  }

  /** The moon's reflection on the pond: a pale disc broken up by ripples. */
  private drawMoon(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    if (!this.moon || this.night < 0.4) return;
    ctx.globalAlpha = (this.night - 0.4) * 1.4;
    ctx.fillStyle = hex(PAL.lilac[4]);
    for (let dy = -4; dy <= 4; dy++) {
      const half = Math.round(Math.sqrt(20 - dy * dy * 1.2));
      const shift = Math.round(Math.sin(this.time * 2 + dy * 1.3) * 1.2);
      if (half > 0 && (dy + Math.floor(this.time * 3)) % 3 !== 0) ctx.fillRect(this.moon[0] - half + shift - ox, this.moon[1] + dy - oy, half * 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawRainbow(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const r = this.happenings.rainbow;
    if (!r) return;
    const radius = 64;
    ctx.globalAlpha = 0.5 * Math.min(1, r.left / 4);
    RAINBOW.forEach((color, band) => {
      ctx.fillStyle = hex(color);
      const rr = radius - band * 2;
      for (let a = 0; a <= 90; a++) {
        const t = Math.PI + (a / 90) * Math.PI;
        ctx.fillRect(Math.round(r.x + radius + Math.cos(t) * rr - ox), Math.round(r.y + Math.sin(t) * rr * 0.85 - oy), 2, 2);
      }
    });
    ctx.globalAlpha = 1;
    if (Math.random() < 0.3) this.particles.spawn(this.particles.id('sparkle'), r.x + (Math.random() - 0.5) * 10, r.y, Math.random() * 8);
  }

  /** Draw one pass of particles (lit or glowing) by whichever method suits the view size. */
  private drawParticles(ctx: CanvasRenderingContext2D, layer: PixelLayer, glow: boolean, pixelPath: boolean, ox: number, oy: number, vw: number, vh: number): void {
    if (!pixelPath) {
      this.particles.renderRects(ctx, glow, ox, oy, this.time, vw, vh);
      return;
    }
    layer.resize(vw, vh);
    layer.begin();
    this.particles.render(layer, glow, ox, oy, this.time);
    if (layer.end()) ctx.drawImage(layer.canvas, 0, 0);
  }

  /** Paint one frame to the screen. */
  draw(screen: CanvasRenderingContext2D): void {
    const cam = this.camera;
    const zoom = cam.zoom;
    const vw = Math.ceil(cam.viewW / zoom) + 2;
    const vh = Math.ceil(cam.viewH / zoom) + 2;
    if (this.buffer.width !== vw || this.buffer.height !== vh) {
      this.buffer.width = vw;
      this.buffer.height = vh;
    }
    const ctx = this.bctx;
    ctx.imageSmoothingEnabled = false;
    const left = cam.toWorldX(0);
    const top = cam.toWorldY(0);
    const ox = Math.floor(left);
    const oy = Math.floor(top);
    const { season, time, atlas } = this;
    const night = this.night;
    this.gather(ox, oy, vw, vh);
    const { standing, flats, offsets } = this;
    const vy = (e: Entity) => e.y - oy + (offsets.get(e.region) ?? 0);

    // 1. The sea, what lives under its surface, the waves over that, and then what the water reflects.
    this.water.drawBed(ctx, ox, oy, vw, vh);
    if (this.quality.ambient > 0) this.sealife.drawUnder(ctx, ox, oy, vw, vh);
    this.water.drawSurface(ctx, ox, oy, vw, vh, time);
    const flags = this.game.mods.flags;
    const seasonIndex = season.blend > 0.5 ? season.b : season.a;
    // Stale caches are refreshed a couple per frame, so a change of light never causes a hitch.
    let budget = BAKES_PER_FRAME;
    const views = this.visibleViews;
    const prints = views.map((v) => fingerprint(v, flags, time));
    const bakeOf = (v: RegionView) => {
      let bake = this.bakes.get(v.terrain.id);
      if (!bake) this.bakes.set(v.terrain.id, (bake = newBake(v)));
      return bake;
    };

    if (this.quality.reflections) {
      const refl = this.reflections;
      refl.begin(vw, vh);
      // Each land's shoreline and standing things come ready-mirrored from its cache…
      views.forEach((v, i) => {
        const t = v.terrain;
        if (t.layout.floating || time < v.risen + RENDER.rise.seconds) return;
        const bake = bakeOf(v);
        const key = `${seasonIndex}|${prints[i].sum}`;
        if ((bake.mirror.key !== key || prints[i].settling) && budget-- > 0) {
          bakeMirror(bake, v, atlas, flags, time, season);
          bake.mirror.key = key;
        }
        refl.image(bake.mirror.canvas, t.x - ox, t.y - oy);
      });
      // …and only what moves (boats, ducks, frogs) is mirrored afresh.
      let moving = false;
      for (const e of this.movers) {
        if (!Number.isFinite(e.waterline) || e.born > time || e.alpha < 0.5) continue;
        refl.add(currentSprite(e, season), e.x - ox, e.waterline - oy + e.lift * RENDER.water.reflection.squash, e.flip);
        moving = true;
      }
      if (moving) for (const v of views) refl.cut(v.terrain.patches[season.a], v.terrain.x - ox, v.terrain.y - oy + (offsets.get(v.terrain.id) ?? 0));
      refl.apply(ctx, time, oy, zoom);
    }
    this.drawMoon(ctx, ox, oy);

    // 2. Land.
    const foam = Math.floor(time * RENDER.water.foamFps) % FOAM_FRAMES;
    for (const v of this.views.values()) {
      const t = v.terrain;
      if (t.x - ox > vw || t.x + t.w < ox || t.y - oy > vh + 40 || t.y + t.h < oy - 40) continue;
      const off = offsets.get(t.id) ?? 0;
      const surfaced = clamp(((time - v.risen) / RENDER.rise.seconds) * 2.2, 0, 1);
      if (t.layout.floating) {
        // An island in the air darkens the sea beneath it.
        ctx.globalAlpha = 0.22 * surfaced;
        ctx.fillStyle = RENDER.shadows.color;
        for (const [bx, by, rx, ry] of t.layout.land) {
          ctx.beginPath();
          ctx.ellipse(t.layout.at[0] + bx - ox, t.layout.at[1] + by + WORLD.floatDepth - oy, rx * 0.9, ry * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = surfaced;
      if (season.winter < 0.9) ctx.drawImage(t.foam[foam], t.x - ox, t.y - oy + off);
      ctx.drawImage(t.patches[season.a], t.x - ox, t.y - oy + off);
      if (season.blend > 0.01 && season.b !== season.a) {
        ctx.globalAlpha = surfaced * season.blend;
        ctx.drawImage(t.patches[season.b], t.x - ox, t.y - oy + off);
      }
      ctx.globalAlpha = 1;
    }
    this.drawBridges(ctx, ox, oy);
    for (const e of flats) drawEntity(ctx, atlas, e, e.x - ox, vy(e), season, 0, time);

    // 3. Lamps are gathered first: at night they are what casts the shadows.
    const lamps = this.lamps;
    lamps.length = 0;
    if (night > 0.03) {
      for (const list of [flats, standing]) {
        for (const e of list) {
          const s = currentSprite(e, season);
          if (!s.lights || e.born > time || e.alpha < 0.3) continue;
          const gy = vy(e);
          for (const l of s.lights) {
            const flicker = 1 + Math.sin(time * RENDER.light.flickerSpeed + e.x * 0.7 + l.x) * RENDER.light.flicker;
            lamps.push({ x: e.x - ox + (e.flip ? s.ax - l.x : l.x - s.ax), y: gy - e.lift - s.ay + l.y, r: l.r * flicker, tone: l.tone ?? 'warm', gx: e.x - ox, gy });
          }
        }
      }
    }

    // 4. Shadows, cast from each sprite's own silhouette.
    if (this.quality.shadows && season.winter < 0.98) {
      const sun = sunState((this.game.s.day % BALANCE.day.length) / BALANCE.day.length, night);
      const sh = RENDER.shadows;
      const lampLit = night > 0.5 && lamps.length > 0;
      const lightKey = lampLit ? 'lamps' : `${Math.round(sun.dx * SUN_STEPS)}|${Math.round(sun.dy * SUN_STEPS)}`;
      this.shadows.begin(vw, vh);
      // Everything that stands still: one cached image per land, redrawn only when the light has moved.
      views.forEach((v, i) => {
        const bake = bakeOf(v);
        const key = `${lightKey}|${seasonIndex}|${prints[i].sum}`;
        if ((bake.shade.key !== key || prints[i].settling) && budget-- > 0) {
          bakeShadows(bake, v, atlas, flags, time, season, sun.dx, sun.dy, lampLit ? groundLamps(v, flags, time, season) : null);
          bake.shade.key = key;
        }
        this.shadows.stamp(bake.shade.canvas, v.terrain.x - SHADE_MARGIN - ox, v.terrain.y - SHADE_MARGIN - oy + (offsets.get(v.terrain.id) ?? 0));
      });
      // Everything that moves casts its own, fresh each frame.
      for (const e of this.movers) {
        if (!e.shadow || e.flat || e.born > time || e.alpha < 0.4) continue;
        const x = e.x - ox;
        const y = vy(e);
        let dx = sun.dx;
        let dy = sun.dy;
        if (lampLit) {
          // The nearest lamp wins: its light throws the shadow directly away from it.
          let best = Infinity;
          for (const lamp of lamps) {
            const d = Math.hypot(x - lamp.gx, (y - lamp.gy) * 1.6);
            const reach = lamp.r * sh.lampReach;
            if (d < reach && d < best && d > 2) {
              best = d;
              const len = 0.45 + (d / reach) * 0.9;
              dx = ((x - lamp.gx) / d) * len;
              dy = (((y - lamp.gy) * 1.6) / d) * len * sh.groundSquash;
            }
          }
        }
        this.shadows.cast(currentSprite(e, season), x, y, dx, dy, e.flip, e.lift);
      }
      this.shadows.apply(ctx, lampLit ? Math.max(sun.alpha, sh.lampAlpha * (night * 2 - 1)) : sun.alpha);
    }

    // 5. Everything standing, back to front.
    const glowStrength = clamp(night * 1.25, 0, 1);
    for (const e of standing) {
      if (e === this.springEntity && e.born + RENDER.pop.seconds < time) this.drawSpring(ctx, e, e.x - ox, vy(e));
      else drawEntity(ctx, atlas, e, e.x - ox, vy(e), season, e.sway ? this.wind(e.x) : 0, time, glowStrength);
    }
    this.drawRainbow(ctx, ox, oy);

    // 6. Particles that are part of the lit world.
    const pixelPath = vw * vh <= RENDER.particlePixelArea;
    this.drawParticles(ctx, this.lit, false, pixelPath, ox, oy, vw, vh);

    // 7. Cloud shadows drift over by day.
    if (this.quality.clouds && night < 0.7) {
      ctx.fillStyle = RENDER.shadows.color;
      ctx.globalAlpha = RENDER.clouds.alpha * (1 - night / 0.7);
      for (const c of this.ambience.clouds) {
        if (c.x - c.w - ox > vw || c.x + c.w < ox || c.y - c.h - oy > vh || c.y + c.h < oy) continue;
        ctx.beginPath();
        ctx.ellipse(c.x - ox, c.y - oy, c.w, c.h, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x - ox + c.w * 0.5, c.y - oy + c.h * 0.3, c.w * 0.6, c.h * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 8. Light: ambient colour and lamps, multiplied over the scene.
    const d = BALANCE.day;
    const rising = (this.game.s.day % d.length) / d.length > d.nightEnd - d.fade * 2;
    const stormy = Math.min(1, Math.max(this.game.s.buffs.storm ?? 0, this.game.s.buffs.rain ?? 0) / 3);
    const dark = this.lighting.begin(vw, vh, ambientColor(night, rising, stormy, season.a, season.b, season.blend));
    if (dark) {
      for (const lamp of lamps) this.lighting.add(lamp, glowStrength);
      // Things that give off their own light (windows, crystals, glowing caps) keep their colour in the dark.
      if (glowStrength > 0.03) {
        for (const list of [flats, standing]) {
          for (const e of list) {
            const s = currentSprite(e, season);
            if (!s.glow || e.born + RENDER.pop.seconds > time || e.alpha < 0.3 || e.flip) continue;
            const sx = e.x - ox - s.ax;
            const sy = vy(e) - e.lift - s.ay;
            for (const g of s.glow) this.lighting.emit(s, sx, sy, g, glowStrength, g[4] === GLOW_LAMPLIT);
          }
        }
      }
      this.lighting.apply(ctx);
    }
    // 9. A coloured halo around every lamp.
    if (glowStrength > 0.03) for (const lamp of lamps) this.lighting.bloom(ctx, lamp, glowStrength);
    this.drawParticles(ctx, this.glow, true, pixelPath, ox, oy, vw, vh);

    // The guide's pointer bobs above whatever it wants tapped, always fully lit.
    if (this.pointer) {
      const arrow = atlas.get('ic_pointer');
      const bob = Math.round(Math.sin(time * 6) * 2.5);
      ctx.drawImage(atlas.canvas, arrow.x, arrow.y, arrow.w, arrow.h, Math.round(this.pointer[0] - ox - arrow.w / 2), Math.round(this.pointer[1] - oy - POINTER_LIFT + bob), arrow.w, arrow.h);
    }

    if (this.cutscene.white > 0) {
      ctx.globalAlpha = this.cutscene.white;
      ctx.fillStyle = '#f4f9ff';
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }

    // 10. Scale the finished view up to the screen, then add crisp screen-space text.
    screen.imageSmoothingEnabled = false;
    screen.drawImage(this.buffer, 0, 0, vw, vh, Math.round((ox - left) * zoom), Math.round((oy - top) * zoom), vw * zoom, vh * zoom);
    this.floaters.draw(screen, cam, this.font, Math.max(2, Math.round(zoom * 0.75)));
  }
}
