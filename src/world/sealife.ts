import { BOAT_FRAMES, BOAT_KINDS, LEAP_FRAMES, REEF_BEDS, SEA_FISH_KINDS, SEA_ROCKS } from '@/art/sea';
import { SEA } from '@/config/sea';
import { LAYOUT_BY_ID, LINKS, REGION_LAYOUTS, WORLD, type RegionLayout } from '@/config/world';
import type { Atlas, Sprite } from '@/engine/atlas';
import { mulberry, seedOf, type Rand } from '@/engine/rng';
import { blit, makeEntity, type Entity } from './entity';
import type { Stage } from './stage';

/** Something lying on the sea floor. */
interface FloorPiece {
  x: number;
  y: number;
  frames: Sprite[];
  phase: number;
}

/** A shelf of sunken rock in an island's shallows, and what grows on it. */
interface Reef {
  bed: FloorPiece;
  pieces: FloorPiece[];
}

interface Fish {
  dx: number;
  dy: number;
  phase: number;
}

interface School {
  x: number;
  y: number;
  heading: number;
  /** Which way the fish are drawn facing: 1 right, -1 left. Changes only on a clear turn, so they never flicker. */
  facing: number;
  speed: number;
  frames: Sprite[];
  kind: number;
  fish: Fish[];
}

interface Leap {
  entity: Entity;
  x0: number;
  dir: number;
  age: number;
}

interface Boat {
  entity: Entity;
  tx: number;
  ty: number;
  rest: number;
  phase: number;
}

const between = (r: Rand, [lo, hi]: readonly [number, number]) => lo + r() * (hi - lo);

/**
 * Distance from a point to the nearest island's shore (negative inside one). Every land there will
 * ever be counts, discovered or not, and so do the islands in the sky: nothing in the sea should end
 * up underneath any of them.
 */
function shoreDistance(x: number, y: number): number {
  let best = Infinity;
  for (const layout of REGION_LAYOUTS) {
    for (const [bx, by, rx, ry] of layout.land) {
      const d = (Math.hypot((x - layout.at[0] - bx) / rx, (y - layout.at[1] - by) / ry) - 1) * Math.min(rx, ry);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Distance from a point to the nearest bridge (or to where one will be built). */
function bridgeDistance(x: number, y: number): number {
  let best = Infinity;
  for (const link of LINKS) {
    const a = LAYOUT_BY_ID[link.a].at;
    const b = LAYOUT_BY_ID[link.b].at;
    const along = link.axis === 'h' ? x : y;
    const across = link.axis === 'h' ? y : x;
    const from = link.axis === 'h' ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
    const to = link.axis === 'h' ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
    if (along >= from && along <= to) best = Math.min(best, Math.abs(across - link.at));
  }
  return best;
}

/**
 * Life in the sea: reefs in the shallows of every discovered island, schools of fish beneath
 * the surface (one leaping out now and then), rocks that break the surface, and little boats
 * sailing between the islands. Reefs and fish are drawn under the waves; boats, rocks and
 * leaping fish are ordinary entities, so they are lit, reflected and sorted like everything else.
 */
export class SeaLife {
  private reefs = new Map<string, Reef[]>();
  private rocks: Entity[] = [];
  private schools: School[] = [];
  private leaps: Leap[] = [];
  private boats: Boat[] = [];
  private leapClock = 3;
  private wakeOwed = 0;
  private readonly bounds: { x: number; y: number; w: number; h: number };

  constructor(
    private readonly s: Stage,
    private readonly atlas: Atlas,
  ) {
    const m = SEA.margin;
    this.bounds = { x: -m, y: -m, w: WORLD.width + m * 2, h: WORLD.height + m * 2 };
    const rand = mulberry(SEA.rocks.seed);
    const area = (this.bounds.w * this.bounds.h) / 1e6;
    for (let i = 0; i < SEA.rocks.count; i++) this.addRock(rand);
    for (let i = 0, n = Math.round(SEA.fish.density * area); i < n; i++) this.addSchool(rand);
    for (let i = 0; i < SEA.boats.count; i++) this.addBoat(rand, i);
  }

  /** The world was rebuilt: forget the reefs (they return as each land is added again). */
  reset(): void {
    this.reefs.clear();
    this.leaps.length = 0;
  }

  /** A random point in the sea at least `clearance` px from any island. */
  private openWater(rand: Rand, clearance: number): [number, number] | null {
    const b = this.bounds;
    for (let tries = 0; tries < 40; tries++) {
      const x = Math.round(b.x + rand() * b.w);
      const y = Math.round(b.y + rand() * b.h);
      if (shoreDistance(x, y) >= clearance) return [x, y];
    }
    return null;
  }

  private piece(sprite: string, frames: number, x: number, y: number, rand: Rand): FloorPiece {
    const names = frames > 1 ? Array.from({ length: frames }, (_, f) => `${sprite}_${f}`) : [sprite];
    return { x: Math.round(x), y: Math.round(y), frames: names.map((n) => this.atlas.get(n)), phase: rand() * 6 };
  }

  /** A land has been discovered: lay reefs in the shallows around it. The same land always gets the same reefs. */
  addRegion(layout: RegionLayout): void {
    if (layout.floating || this.reefs.has(layout.id)) return;
    const cfg = SEA.reefs;
    const rand = mulberry(seedOf(layout.id) ^ cfg.seed);
    const total = cfg.kinds.reduce((sum, kind) => sum + kind[2], 0);
    const pickKind = () => {
      let roll = rand() * total;
      for (const kind of cfg.kinds) if ((roll -= kind[2]) <= 0) return kind;
      return cfg.kinds[0];
    };
    const reefs: Reef[] = [];
    for (let tries = 0; tries < cfg.perIsland * 12 && reefs.length < cfg.perIsland; tries++) {
      // Step out from the edge of one of the island's lobes, then check the spot really is in open shallows.
      const [bx, by, rx, ry] = layout.land[Math.floor(rand() * layout.land.length)];
      const angle = rand() * Math.PI * 2;
      const out = between(rand, cfg.band);
      const x = layout.at[0] + bx + Math.cos(angle) * (rx + out);
      const y = layout.at[1] + by + Math.sin(angle) * (ry + out);
      const shore = shoreDistance(x, y);
      if (shore < cfg.band[0] || shore > cfg.band[1] || bridgeDistance(x, y) < cfg.bridgeClearance) continue;
      if (reefs.some((reef) => Math.hypot(reef.bed.x - x, reef.bed.y - y) < cfg.spread * 4)) continue;
      const pieces: FloorPiece[] = [];
      for (let k = 0, n = Math.round(between(rand, cfg.pieces)); k < n; k++) {
        const [sprite, frames] = pickKind();
        pieces.push(this.piece(sprite, frames, x + (rand() - 0.5) * cfg.spread * 2.4, y + (rand() - 0.5) * cfg.spread * 0.9 + 2, rand));
      }
      // Further back first, so nearer pieces overlap them.
      pieces.sort((a, b) => a.y - b.y);
      reefs.push({ bed: this.piece(`reef_bed_${Math.floor(rand() * REEF_BEDS)}`, 1, x, y, rand), pieces });
    }
    this.reefs.set(layout.id, reefs);
  }

  private addRock(rand: Rand): void {
    const cfg = SEA.rocks;
    const at = this.openWater(rand, cfg.clearance);
    if (!at || bridgeDistance(at[0], at[1]) < cfg.clearance) return;
    const rock = makeEntity(this.atlas, `searock_${Math.floor(rand() * SEA_ROCKS)}`, at[0], at[1], { tag: 'searock', shadow: false, flip: rand() < 0.5 });
    rock.waterline = rock.y;
    this.rocks.push(rock);
  }

  private addSchool(rand: Rand): void {
    const cfg = SEA.fish;
    const at = this.openWater(rand, cfg.clearance + cfg.lookAhead);
    if (!at) return;
    const kind = Math.floor(rand() * SEA_FISH_KINDS);
    const count = Math.round(between(rand, cfg.perSchool));
    this.schools.push({
      x: at[0],
      y: at[1],
      heading: rand() * Math.PI * 2,
      facing: 1,
      speed: between(rand, cfg.speed),
      kind,
      frames: [0, 1].map((f) => this.atlas.get(`seafish_${kind}_${f}`)),
      fish: Array.from({ length: count }, () => ({ dx: (rand() - 0.5) * 34, dy: (rand() - 0.5) * 18, phase: rand() * 6 })),
    });
  }

  private addBoat(rand: Rand, index: number): void {
    const at = this.openWater(rand, SEA.boats.clearance);
    if (!at) return;
    const entity = makeEntity(this.atlas, `boat_${index % BOAT_KINDS}`, at[0], at[1], { frames: BOAT_FRAMES, tag: 'boat', shadow: false });
    entity.waterline = entity.y;
    this.boats.push({ entity, tx: at[0], ty: at[1], rest: rand() * 3, phase: rand() * 6 });
  }

  /** Things that stand above the water this frame. */
  entities(): Entity[] {
    return [...this.rocks, ...this.boats.map((b) => b.entity), ...this.leaps.map((l) => l.entity)];
  }

  /* ───────────────────────────── Each frame ───────────────────────────── */

  /** Is this point open sea (inside the populated area and clear of every island)? */
  private sailable(x: number, y: number, clearance: number): boolean {
    const b = this.bounds;
    return x > b.x && y > b.y && x < b.x + b.w && y < b.y + b.h && shoreDistance(x, y) >= clearance;
  }

  private updateSchools(dt: number): void {
    const cfg = SEA.fish;
    for (const school of this.schools) {
      const ahead = cfg.lookAhead;
      const blocked = (heading: number) => !this.sailable(school.x + Math.cos(heading) * ahead, school.y + Math.sin(heading) * ahead, cfg.clearance);
      if (blocked(school.heading)) {
        // Turn toward whichever side is clearer.
        school.heading += (blocked(school.heading + 0.8) ? -1 : 1) * cfg.avoid * dt;
      } else school.heading += Math.sin(this.s.time * 0.31 + school.x * 0.01) * cfg.wander * dt;
      school.x += Math.cos(school.heading) * school.speed * dt;
      school.y += Math.sin(school.heading) * school.speed * dt * 0.7;
      const across = Math.cos(school.heading);
      if (Math.abs(across) > 0.3) school.facing = across < 0 ? -1 : 1;
    }
  }

  private startLeap(): void {
    const cam = this.s.camera;
    const left = cam.toWorldX(0);
    const top = cam.toWorldY(0);
    const right = cam.toWorldX(cam.viewW);
    const bottom = cam.toWorldY(cam.viewH);
    // A leap nobody sees is wasted: pick a school that is on screen.
    const seen = this.schools.filter((sc) => sc.x > left && sc.x < right && sc.y > top && sc.y < bottom);
    const school = seen[Math.floor(Math.random() * seen.length)];
    if (!school) return;
    const dir = school.facing;
    // One of its fish jumps, from where that fish is. It must come up out of open water and go back into open water.
    const cfg = SEA.fish;
    const jumper = school.fish[Math.floor(Math.random() * school.fish.length)];
    const x = school.x + jumper.dx;
    const y = school.y + jumper.dy;
    if (!this.sailable(x, y, cfg.leapClearance) || !this.sailable(x + dir * cfg.leapLength, y, cfg.leapClearance)) return;
    const entity = makeEntity(this.atlas, `leap_${school.kind}`, x, y, { frames: LEAP_FRAMES, tag: 'leap', shadow: false, flip: dir < 0 });
    entity.waterline = entity.y;
    this.leaps.push({ entity, x0: x, dir, age: 0 });
    this.s.burst('splash', x, y);
  }

  private updateLeaps(dt: number): void {
    const cfg = SEA.fish;
    this.leapClock -= dt * this.s.ambient;
    if (this.leapClock <= 0) {
      this.leapClock = cfg.leapEvery[0] + Math.random() * (cfg.leapEvery[1] - cfg.leapEvery[0]);
      this.startLeap();
    }
    for (let i = this.leaps.length - 1; i >= 0; i--) {
      const leap = this.leaps[i];
      leap.age += dt;
      const t = leap.age / cfg.leapSeconds;
      const e = leap.entity;
      e.x = leap.x0 + leap.dir * cfg.leapLength * t;
      e.lift = Math.max(0, 4 * cfg.leapHeight * t * (1 - t));
      e.frame = Math.min(LEAP_FRAMES - 1, Math.floor(t * LEAP_FRAMES));
      if (t >= 1) {
        this.s.burst('splash', e.x, e.y);
        this.leaps.splice(i, 1);
      }
    }
  }

  /** Can a boat sail straight from one point to another without meeting land or a bridge? */
  private clearPath(x0: number, y0: number, x1: number, y1: number): boolean {
    const cfg = SEA.boats;
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / Math.max(1, steps);
      const y = y0 + ((y1 - y0) * i) / Math.max(1, steps);
      if (!this.sailable(x, y, cfg.clearance) || bridgeDistance(x, y) < cfg.bridgeClearance) return false;
    }
    return true;
  }

  private updateBoats(dt: number): void {
    const cfg = SEA.boats;
    const { particles } = this.s;
    for (const boat of this.boats) {
      const e = boat.entity;
      e.frame = Math.floor(this.s.time * 1.5 + boat.phase) % BOAT_FRAMES;
      e.lift = (Math.sin(this.s.time * cfg.bobSpeed + boat.phase) * 0.5 + 0.5) * cfg.bob;
      const dx = boat.tx - e.x;
      const dy = boat.ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) {
        boat.rest -= dt;
        if (boat.rest > 0) continue;
        // Choose somewhere new to sail to; if nothing is reachable this moment, try again shortly.
        for (let tries = 0; tries < 8; tries++) {
          const x = e.x + (Math.random() - 0.5) * 520;
          const y = e.y + (Math.random() - 0.5) * 320;
          if (!this.clearPath(e.x, e.y, x, y)) continue;
          boat.tx = x;
          boat.ty = y;
          boat.rest = cfg.rest[0] + Math.random() * (cfg.rest[1] - cfg.rest[0]);
          break;
        }
        continue;
      }
      e.x += (dx / d) * cfg.speed * dt;
      e.y += (dy / d) * cfg.speed * dt;
      e.waterline = e.y;
      if (Math.abs(dx) > 1) e.flip = dx < 0;
      this.wakeOwed += cfg.wake * dt * particles.density;
      while (this.wakeOwed >= 1) {
        this.wakeOwed -= 1;
        particles.spawn(particles.id('wake'), e.x - (e.flip ? -9 : 9) + (Math.random() - 0.5) * 3, e.y + 1 + Math.random() * 2, 0, (e.flip ? 1 : -1) * 3, 0);
      }
    }
  }

  update(dt: number): void {
    this.updateSchools(dt);
    this.updateLeaps(dt);
    this.updateBoats(dt);
  }

  /** Draw what lies under the surface: the reefs, then the fish above them. Call between the sea bed and the waves. */
  drawUnder(ctx: CanvasRenderingContext2D, ox: number, oy: number, vw: number, vh: number): void {
    const { time } = this.s;
    const margin = 40;
    const sway = Math.floor(time * SEA.reefs.swayFps);
    for (const reefs of this.reefs.values()) {
      for (const reef of reefs) {
        const x = reef.bed.x - ox;
        const y = reef.bed.y - oy;
        if (x < -margin || y < -margin || x > vw + margin || y > vh + margin) continue;
        ctx.globalAlpha = SEA.reefs.bedAlpha;
        blit(ctx, this.atlas, reef.bed.frames[0], x, y, false);
        ctx.globalAlpha = SEA.reefs.alpha;
        for (const piece of reef.pieces) blit(ctx, this.atlas, piece.frames[(sway + Math.floor(piece.phase)) % piece.frames.length], piece.x - ox, piece.y - oy, false);
      }
    }
    const cfg = SEA.fish;
    ctx.globalAlpha = cfg.alpha;
    for (const school of this.schools) {
      const sx = school.x - ox;
      const sy = school.y - oy;
      if (sx < -60 || sy < -60 || sx > vw + 60 || sy > vh + 60) continue;
      const flip = school.facing < 0;
      for (const fish of school.fish) {
        const x = Math.round(sx + fish.dx + Math.sin(time * 0.9 + fish.phase) * 2);
        const y = Math.round(sy + fish.dy + Math.cos(time * 0.7 + fish.phase) * 1.5);
        blit(ctx, this.atlas, school.frames[Math.floor(time * cfg.tailFps + fish.phase) % 2], x, y, flip);
      }
    }
    ctx.globalAlpha = 1;
  }
}
