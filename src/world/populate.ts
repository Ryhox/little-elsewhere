import { BUILDING_LOOKS, ELDER, LAYOUT_BY_ID, WORLD, type LinkDef, type Point, type ScatterDef, type Zone } from '@/config/world';
import type { Atlas } from '@/engine/atlas';
import { mulberry, seedOf, type Rand } from '@/engine/rng';
import { framesOf, makeEntity, type Entity } from './entity';
import { LAND, PATH, POND, SEA, shoreBelow, terrainAt, type Terrain } from './terrain';

/** Everything standing on one land. */
export interface RegionView {
  terrain: Terrain;
  /** Trees, rocks, flowers, props — never change after the land is built. */
  decor: Entity[];
  /** Building id → the copies currently standing. */
  buildings: Map<string, Entity[]>;
  /** World time the land surfaced (for the rising animation). */
  risen: number;
}

/** A bridge deck between two lands. */
export interface Bridge {
  link: LinkDef;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  born: number;
}

/** Space kept clear around building sites and the spring. */
const SLOT_RADIUS = 9;
const SPRING_RADIUS = 30;
/** Things standing within this distance north of water may show in it (roughly the tallest sprite). */
const REFLECT_REACH = 60;
/** A pond lies this far below its banks. */
const POND_DROP = 1;
/** How much of a scatter rule's gap applies against things that are not its own kind. */
const GAP_SHARE = 0.6;

/** Is any point on a small ring around (x, y) of the given kind? */
function ringHas(t: Terrain, x: number, y: number, radius: number, kind: number): boolean {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (terrainAt(t, x + Math.cos(a) * radius, y + Math.sin(a) * radius) === kind) return true;
  }
  return false;
}

const ZONES: Record<Zone, (t: Terrain, x: number, y: number) => boolean> = {
  rim: (t, x, y) => terrainAt(t, x, y) === LAND && ringHas(t, x, y, 17, SEA) && !ringHas(t, x, y, 6, SEA) && !ringHas(t, x, y, 5, PATH) && !ringHas(t, x, y, 5, POND),
  inner: (t, x, y) => terrainAt(t, x, y) === LAND && !ringHas(t, x, y, 26, SEA) && !ringHas(t, x, y, 6, PATH) && !ringHas(t, x, y, 6, POND),
  any: (t, x, y) => terrainAt(t, x, y) === LAND && !ringHas(t, x, y, 5, SEA) && !ringHas(t, x, y, 3, PATH) && !ringHas(t, x, y, 3, POND),
  pond: (t, x, y) => terrainAt(t, x, y) === POND && !ringHas(t, x, y, 6, LAND) && !ringHas(t, x, y, 6, SEA),
  shore: (t, x, y) => terrainAt(t, x, y) === LAND && (ringHas(t, x, y, 5, POND) || ringHas(t, x, y, 6, SEA)) && !ringHas(t, x, y, 2, SEA) && !ringHas(t, x, y, 2, POND),
};

/**
 * The world y at which a thing's feet appear in its reflection, or NaN when it stands too far
 * from any water to show in it. Things afloat mirror about their own feet. Land sits a cliff's
 * height above the sea, so things on land mirror that much lower — and the land itself then
 * hides whatever part of the reflection would fall behind the bank.
 */
export function waterlineFor(t: Terrain, x: number, y: number): number {
  if (t.layout.floating) return NaN;
  const here = terrainAt(t, x, y);
  if (here === POND || here === SEA) return y;
  for (let dy = 1; dy <= REFLECT_REACH; dy++) if (terrainAt(t, x, y + dy) === POND) return y + POND_DROP;
  const shore = shoreBelow(t, x);
  return shore - y <= REFLECT_REACH ? y + WORLD.cliff : NaN;
}

function scatter(t: Terrain, atlas: Atlas, rule: ScatterDef, rand: Rand, taken: number[][], out: Entity[]): void {
  const inZone = ZONES[rule.zone];
  let placed = 0;
  for (let tries = 0; tries < rule.count * 50 && placed < rule.count; tries++) {
    const x = Math.round(t.x + rand() * t.w);
    const y = Math.round(t.y + rand() * t.h);
    if (!inZone(t, x, y)) continue;
    let free = true;
    for (const [tx, ty, tr] of taken) {
      const reach = tr + rule.gap * GAP_SHARE;
      if (Math.abs(tx - x) < reach && Math.abs(ty - y) < reach * 0.75) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    const sprite = rule.sprites[Math.floor(rand() * rule.sprites.length)];
    const e = makeEntity(atlas, sprite, x, y, { region: t.id, sway: rule.sway, tender: rule.tender, flat: rule.flat, flag: rule.flag, tag: 'decor' });
    e.waterline = waterlineFor(t, x, y);
    out.push(e);
    // Tiny ground cover does not reserve space, so it can tuck in around everything else.
    if (!rule.flat) taken.push([x, y, rule.gap * 0.5]);
    placed++;
  }
}

/** Build the unchanging contents of a land: hand-placed props, then procedural decoration around them. */
export function populate(t: Terrain, atlas: Atlas, now: number): RegionView {
  const { layout } = t;
  const [ox, oy] = layout.at;
  const rand = mulberry(seedOf(layout.id) ^ WORLD.seed);
  const decor: Entity[] = [];
  const taken: number[][] = [];

  for (const points of Object.values(layout.slots)) for (const [sx, sy] of points) taken.push([ox + sx, oy + sy, SLOT_RADIUS]);
  taken.push([ox + layout.hub[0], oy + layout.hub[1], 8]);
  if (layout.id === 'clearing') taken.push([ox + WORLD.spring[0], oy + WORLD.spring[1], SPRING_RADIUS]);
  if (WORLD.seedPlot[0] === layout.id) taken.push([ox + WORLD.seedPlot[1][0], oy + WORLD.seedPlot[1][1], 12]);
  for (const [region, [wx, wy]] of WORLD.wonderSpots) if (region === layout.id) taken.push([ox + wx, oy + wy, 13]);
  if (WORLD.merchantSpot[0] === layout.id) taken.push([ox + WORLD.merchantSpot[1][0], oy + WORLD.merchantSpot[1][1], 22]);
  if (ELDER.region === layout.id) taken.push([ox + ELDER.at[0], oy + ELDER.at[1], 40]);

  for (const prop of layout.props ?? []) {
    const x = ox + prop.at[0];
    const y = oy + prop.at[1];
    const e = makeEntity(atlas, prop.sprite, x, y, { region: t.id, frames: prop.frames, fps: prop.fps, flat: prop.flat, flag: prop.flag, secret: prop.secret, tag: 'prop' });
    if (prop.spinner) e.spinner = { frames: framesOf(atlas, prop.spinner[0], prop.spinner[1]), dx: prop.spinner[2], dy: prop.spinner[3], rate: 7 };
    e.waterline = waterlineFor(t, x, y);
    decor.push(e);
    taken.push([x, y, 10]);
  }
  for (const rule of layout.scatter) scatter(t, atlas, rule, rand, taken, decor);
  return { terrain: t, decor, buildings: new Map(), risen: now };
}

/**
 * Make the standing copies of a building match how many are owned.
 * New copies pop in one after another; returns the ones that were added.
 */
export function syncBuilding(view: RegionView, atlas: Atlas, id: string, owned: number, now: number): Entity[] {
  const look = BUILDING_LOOKS[id];
  const slots = view.terrain.layout.slots[id];
  if (!look || !slots || look.afloat) return [];
  const list = view.buildings.get(id) ?? [];
  view.buildings.set(id, list);
  const want = Math.min(owned, slots.length);
  if (list.length > want) list.length = want;
  const added: Entity[] = [];
  const [ox, oy] = view.terrain.layout.at;
  while (list.length < want) {
    const i = list.length;
    const x = ox + slots[i][0];
    const y = oy + slots[i][1];
    const e = makeEntity(atlas, look.sprites[i % look.sprites.length], x, y, { region: view.terrain.id, flat: look.flat, sway: look.sway, tag: id, born: now + added.length * 0.09 });
    if (look.spinner) e.spinner = { frames: framesOf(atlas, look.spinner[0], look.spinner[1]), dx: look.spinner[2], dy: look.spinner[3], rate: look.spinner[4] };
    e.waterline = waterlineFor(view.terrain, x, y);
    list.push(e);
    added.push(e);
  }
  return added;
}

/** Find where a bridge meets each shore by walking out from both lands along its axis. */
export function spanBridge(link: LinkDef, a: Terrain, b: Terrain, now: number): Bridge {
  const overlap = 5;
  if (link.axis === 'h') {
    let x0 = a.layout.at[0];
    while (terrainAt(a, x0 + 1, link.at) !== SEA && x0 < a.x + a.w) x0++;
    let x1 = b.layout.at[0];
    while (terrainAt(b, x1 - 1, link.at) !== SEA && x1 > b.x) x1--;
    return { link, x0: x0 - overlap, y0: link.at, x1: x1 + overlap, y1: link.at, born: now };
  }
  let y0 = a.layout.at[1];
  while (terrainAt(a, link.at, y0 + 1) !== SEA && y0 < a.y + a.h) y0++;
  let y1 = b.layout.at[1];
  while (terrainAt(b, link.at, y1 - 1) !== SEA && y1 > b.y) y1--;
  return { link, x0: link.at, y0: y0 - overlap, x1: link.at, y1: y1 + overlap, born: now };
}

export const bridgeEnds = (bridge: Bridge): [Point, Point] => [
  [bridge.x0, bridge.y0],
  [bridge.x1, bridge.y1],
];

export const layoutOf = (id: string) => LAYOUT_BY_ID[id];
