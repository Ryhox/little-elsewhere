import { BIRD_KINDS, BUTTERFLY_KINDS } from '@/art/creatures';
import { AMBIENT } from '@/config/creatures';
import { LEAF_KINDS } from '@/config/particles';
import { RENDER } from '@/config/render';
import { WORLD } from '@/config/world';
import { makeEntity, type Entity } from './entity';
import type { Stage } from './stage';

interface Bird {
  entity: Entity;
  vx: number;
  vy: number;
  phase: number;
}

interface Butterfly {
  entity: Entity;
  tx: number;
  ty: number;
  phase: number;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How hard it is snowing / how many leaves are falling, set by the season cutscene. */
export interface Weather {
  leaves: number;
  snow: number;
}

/**
 * Everything that moves without being asked to: birds, butterflies, chimney smoke,
 * glitter on the water, the stream's flow, fireflies, falling leaves, rain and drifting cloud shadows.
 */
export class Ambience {
  private birds: Bird[] = [];
  private butterflies: Butterfly[] = [];
  clouds: Cloud[] = [];
  weather: Weather = { leaves: 0, snow: 0 };
  private flockClock = 4;
  /** Fractional particle debts, so low spawn rates still add up correctly. */
  private owed: Record<string, number> = {};

  constructor(private readonly s: Stage) {
    for (let i = 0; i < RENDER.clouds.count; i++) this.clouds.push(this.cloud(Math.random() * WORLD.width));
  }

  reset(): void {
    this.birds.length = 0;
    this.butterflies.length = 0;
    this.weather = { leaves: 0, snow: 0 };
  }

  entities(): Entity[] {
    return [...this.birds.map((b) => b.entity), ...this.butterflies.map((b) => b.entity)];
  }

  private cloud(x: number): Cloud {
    const [lo, hi] = RENDER.clouds.size;
    const w = lo + Math.random() * (hi - lo);
    return { x, y: Math.random() * WORLD.height, w, h: w * (0.4 + Math.random() * 0.2) };
  }

  /** Turn a per-second rate into whole particles this frame, carrying the remainder. */
  private due(key: string, rate: number, dt: number): number {
    const total = (this.owed[key] ?? 0) + rate * dt * this.s.particles.density;
    const whole = Math.floor(total);
    this.owed[key] = total - whole;
    return whole;
  }

  /* ───────────────────────────── Wildlife ───────────────────────────── */

  /** The stretch of world a bird has to cross: everything on screen, with room to spare on both sides. */
  private skyline(): { left: number; right: number; top: number; bottom: number } {
    const cam = this.s.camera;
    const margin = AMBIENT.birds.margin;
    return { left: cam.toWorldX(0) - margin, right: cam.toWorldX(cam.viewW) + margin, top: cam.toWorldY(0), bottom: cam.toWorldY(cam.viewH) };
  }

  private flock(): void {
    const cfg = AMBIENT.birds;
    const sky = this.skyline();
    const fromLeft = Math.random() < 0.5;
    const count = cfg.perFlock[0] + Math.floor(Math.random() * (cfg.perFlock[1] - cfg.perFlock[0] + 1));
    const speed = cfg.speed[0] + Math.random() * (cfg.speed[1] - cfg.speed[0]);
    // Birds fly at altitude, so they are drawn that much higher than where they "are".
    const y = sky.top + cfg.altitude + (0.15 + Math.random() * 0.7) * (sky.bottom - sky.top);
    const kind = Math.floor(Math.random() * BIRD_KINDS);
    for (let i = 0; i < count; i++) {
      // The leader starts at the very edge; the rest trail behind it, further off screen still.
      const entity = makeEntity(this.s.atlas, `bird_${kind}`, (fromLeft ? sky.left : sky.right) - (fromLeft ? 1 : -1) * i * 12, y + (i % 2 ? 8 : -6) * Math.ceil(i / 2), { frames: 3, tag: 'bird', secret: cfg.secret });
      entity.lift = cfg.altitude;
      entity.flip = !fromLeft;
      this.birds.push({ entity, vx: fromLeft ? speed : -speed, vy: (Math.random() - 0.5) * 6, phase: Math.random() * 6 });
    }
  }

  private syncButterflies(): void {
    const cfg = AMBIENT.butterflies;
    const want = Math.round((cfg.always + (this.s.game.mods.flags[cfg.flag] ? cfg.withFlag : 0)) * this.s.ambient);
    while (this.butterflies.length > want) this.butterflies.pop();
    while (this.butterflies.length < want) {
      const spot = this.s.randomSpot();
      if (!spot) break;
      const entity = makeEntity(this.s.atlas, `butterfly_${this.butterflies.length % BUTTERFLY_KINDS}`, spot.x, spot.y, { frames: 3, tag: 'butterfly', region: spot.region });
      entity.lift = cfg.altitude;
      entity.shadow = false;
      this.butterflies.push({ entity, tx: spot.x, ty: spot.y, phase: Math.random() * 6 });
    }
  }

  private updateWildlife(dt: number): void {
    const cfg = AMBIENT.birds;
    const flags = this.s.game.mods.flags;
    const flocks = (cfg.flocks + (flags[cfg.bonusFlag] ? 0.5 : 0) + (flags[cfg.migrationFlag] ? 1 : 0)) * this.s.ambient;
    this.flockClock -= dt * flocks;
    if (this.flockClock <= 0 && this.s.night < 0.6) {
      this.flockClock = cfg.every[0] + Math.random() * (cfg.every[1] - cfg.every[0]);
      this.flock();
    }
    const sky = this.skyline();
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      const e = b.entity;
      e.x += b.vx * dt;
      e.y += (b.vy + Math.sin(this.s.time * 1.3 + b.phase) * 5) * dt;
      e.frame = Math.floor((this.s.time + b.phase) * 9) % 3;
      // A bird is done once it has flown out past the far edge of the screen (wherever the screen is by then).
      if (b.vx > 0 ? e.x > sky.right : e.x < sky.left) this.birds.splice(i, 1);
    }

    this.syncButterflies();
    const day = this.s.night < 0.5 && this.s.season.winter < 0.5;
    for (const b of this.butterflies) {
      const e = b.entity;
      e.alpha += ((day ? 1 : 0) - e.alpha) * Math.min(1, dt * 2);
      const dx = b.tx - e.x;
      const dy = b.ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        const spot = Math.random() < 0.7 ? this.s.randomSpot() : null;
        // Mostly flutter nearby; now and then set off across the world.
        if (spot && Math.hypot(spot.x - e.x, spot.y - e.y) < 220) [b.tx, b.ty] = [spot.x, spot.y];
        else [b.tx, b.ty] = [e.x + (Math.random() - 0.5) * 50, e.y + (Math.random() - 0.5) * 30];
      } else {
        const speed = AMBIENT.butterflies.speed;
        e.x += (dx / d) * speed * dt + Math.sin(this.s.time * 5 + b.phase) * dt * 9;
        e.y += (dy / d) * speed * dt + Math.cos(this.s.time * 4 + b.phase) * dt * 6;
        e.flip = dx < 0;
      }
      e.lift = AMBIENT.butterflies.altitude + Math.sin(this.s.time * 3 + b.phase) * 2;
      e.frame = Math.floor((this.s.time + b.phase) * 9) % 3;
    }
  }

  /* ───────────────────────────── Emitters ───────────────────────────── */

  private updateEmitters(dt: number): void {
    const { particles: p, camera: cam, game } = this.s;
    const night = this.s.night;
    const viewW = cam.viewW / cam.zoom;
    const viewH = cam.viewH / cam.zoom;
    const left = cam.toWorldX(0);
    const top = cam.toWorldY(0);
    const area = (viewW * viewH) / 10000;
    const winter = this.s.season.winter;

    // Glitter on open water: sunlight by day, moonlight by night.
    const glints = this.due('glint', RENDER.water.glitter * area * (1 - winter * 0.7), dt);
    for (let i = 0; i < glints; i++) {
      const x = left + Math.random() * viewW;
      const y = top + Math.random() * viewH;
      if (this.s.isWater(x, y)) p.spawn(p.id(night > 0.6 ? 'moonglint' : 'glint'), x, y);
    }

    for (const view of this.s.views.values()) {
      const t = view.terrain;
      const [ox, oy] = t.layout.at;
      if (ox + t.w / 2 < left - 40 || ox - t.w / 2 > left + viewW + 40 || oy + t.h / 2 < top - 40 || oy - t.h / 2 > top + viewH + 40) continue;

      // Streams run from their first point to their last, and spill off the island's edge.
      for (const stream of t.layout.streams ?? []) {
        for (let i = 0; i + 1 < stream.line.length; i++) {
          const [ax, ay] = stream.line[i];
          const [bx, by] = stream.line[i + 1];
          const len = Math.hypot(bx - ax, by - ay);
          const n = this.due(`flow${t.id}${i}`, RENDER.water.flowRate * len, dt);
          for (let k = 0; k < n; k++) {
            const u = Math.random();
            const side = (Math.random() - 0.5) * stream.width * 0.6;
            p.spawn(p.id('flow'), ox + ax + (bx - ax) * u, oy + ay + (by - ay) * u + side, 0, ((bx - ax) / len) * RENDER.water.flowSpeed, ((by - ay) / len) * RENDER.water.flowSpeed);
          }
        }
        const [ex, ey] = stream.line[stream.line.length - 1];
        const fall = this.due(`fall${t.id}`, 14, dt);
        for (let k = 0; k < fall; k++) p.spawn(p.id('foam'), ox + ex + (Math.random() - 0.5) * 6, oy + ey + WORLD.cliff + Math.random() * 3, 0, (Math.random() - 0.5) * 14, 4 + Math.random() * 8);
      }

      // Chimneys.
      for (const list of view.buildings.values()) {
        for (const e of list) {
          const smoke = e.frames[0][0].smoke;
          if (!smoke || e.born > this.s.time) continue;
          const sprite = e.frames[0][0];
          const n = this.due(`smoke${e.x}${e.y}`, 1.6, dt);
          for (let k = 0; k < n; k++) p.spawn(p.id('smoke'), e.x - sprite.ax + smoke[0], e.y, sprite.ay - smoke[1], 2 + Math.random() * 3, 0, 0);
        }
      }

      // Fireflies drift up at night; falling leaves and petals by day.
      const fireflies = AMBIENT.fireflies;
      const flyRate = night > 0.5 && winter < 0.5 ? (game.mods.flags[fireflies.flag] ? fireflies.rate : fireflies.baseRate) * 3 : 0;
      const flies = this.due(`fly${t.id}`, flyRate, dt);
      for (let k = 0; k < flies; k++) p.spawn(p.id('firefly'), t.bounds.x + Math.random() * t.bounds.w, t.bounds.y + Math.random() * t.bounds.h, 3 + Math.random() * 10, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3);

      const seasonIndex = this.s.season.blend > 0.5 ? this.s.season.b : this.s.season.a;
      const kinds = LEAF_KINDS[seasonIndex] ?? [];
      const leaves = kinds.length ? this.due(`leaf${t.id}`, 0.5 + this.weather.leaves * 16, dt) : 0;
      for (let k = 0; k < leaves; k++) {
        const tree = view.decor[Math.floor(Math.random() * view.decor.length)];
        if (!tree || !tree.sway || tree.flat || tree.tender) continue;
        p.spawn(p.id(kinds[Math.floor(Math.random() * kinds.length)]), tree.x + (Math.random() - 0.5) * 20, tree.y + 2, 22 + Math.random() * 14, 5 + Math.random() * 6, 1, 0);
      }
    }

    // Weather falls across the whole view.
    const raining = (game.s.buffs.rain ?? 0) > 0 || (game.s.buffs.storm ?? 0) > 0;
    const drops = raining ? this.due('rain', 26 * area, dt) : 0;
    for (let i = 0; i < drops; i++) p.spawn(p.id('rain'), left + Math.random() * viewW, top + Math.random() * (viewH + 60), 60 + Math.random() * 40, -8, 0, -150);
    const flakes = this.weather.snow > 0 ? this.due('snow', this.weather.snow * 7 * area, dt) : 0;
    for (let i = 0; i < flakes; i++) p.spawn(p.id('snow'), left + Math.random() * viewW, top + Math.random() * (viewH + 40), 30 + Math.random() * 40, -3 + Math.random() * 6, 0, -8);
  }

  update(dt: number): void {
    this.updateWildlife(dt);
    this.updateEmitters(dt);
    for (const c of this.clouds) {
      c.x += RENDER.clouds.speed * dt;
      if (c.x - c.w > WORLD.width) Object.assign(c, this.cloud(-RENDER.clouds.size[1]));
    }
  }
}
