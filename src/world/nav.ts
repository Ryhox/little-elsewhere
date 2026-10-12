import type { Point } from '@/config/world';
import type { Terrain } from './terrain';

interface Node {
  x: number;
  y: number;
  region: string;
  links: number[];
}

/**
 * A small waypoint graph: the dirt paths of each land, joined by bridges.
 * Creatures walk node to node, so they keep to the paths and cross water only on bridges.
 * Routes are cached, so asking for the same journey twice costs nothing.
 */
export class Nav {
  private nodes: Node[] = [];
  private byRegion = new Map<string, number[]>();
  private cache = new Map<number, number[]>();

  private add(x: number, y: number, region: string): number {
    const list = this.byRegion.get(region) ?? [];
    for (const i of list) if (Math.abs(this.nodes[i].x - x) < 1.5 && Math.abs(this.nodes[i].y - y) < 1.5) return i;
    const index = this.nodes.push({ x, y, region, links: [] }) - 1;
    list.push(index);
    this.byRegion.set(region, list);
    return index;
  }

  private link(a: number, b: number): void {
    if (a === b) return;
    if (!this.nodes[a].links.includes(b)) this.nodes[a].links.push(b);
    if (!this.nodes[b].links.includes(a)) this.nodes[b].links.push(a);
    this.cache.clear();
  }

  hasRegion(region: string): boolean {
    return this.byRegion.has(region);
  }

  /** Register a land's paths. Polylines that share a point become connected there. */
  addRegion(t: Terrain): void {
    if (this.byRegion.has(t.id)) return;
    const [ox, oy] = t.layout.at;
    const hub = this.add(ox + t.layout.hub[0], oy + t.layout.hub[1], t.id);
    for (const path of t.layout.paths ?? []) {
      let previous = -1;
      for (const [px, py] of path) {
        const node = this.add(ox + px, oy + py, t.id);
        if (previous >= 0) this.link(previous, node);
        previous = node;
      }
    }
    // A land with no path through its hub still needs the hub reachable.
    if (!this.nodes[hub].links.length) {
      const nearest = this.nearest(this.nodes[hub].x, this.nodes[hub].y, t.id, hub);
      if (nearest >= 0) this.link(hub, nearest);
    }
  }

  /** Join two lands with a bridge between two world points. */
  addBridge(a: Point, regionA: string, b: Point, regionB: string): void {
    const endA = this.add(a[0], a[1], regionA);
    const endB = this.add(b[0], b[1], regionB);
    const nearA = this.nearest(a[0], a[1], regionA, endA);
    const nearB = this.nearest(b[0], b[1], regionB, endB);
    if (nearA >= 0) this.link(endA, nearA);
    if (nearB >= 0) this.link(endB, nearB);
    this.link(endA, endB);
  }

  private nearest(x: number, y: number, region: string, except = -1): number {
    let best = -1;
    let bestD = Infinity;
    for (const i of this.byRegion.get(region) ?? []) {
      if (i === except) continue;
      const d = (this.nodes[i].x - x) ** 2 + (this.nodes[i].y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** Shortest node path between two nodes (Dijkstra over a few dozen nodes). */
  private path(from: number, to: number): number[] {
    const key = from * 4096 + to;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const n = this.nodes.length;
    const dist = new Float32Array(n).fill(Infinity);
    const prev = new Int16Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[from] = 0;
    for (;;) {
      let current = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (current < 0 || dist[i] < dist[current])) current = i;
      if (current < 0 || dist[current] === Infinity || current === to) break;
      done[current] = 1;
      const node = this.nodes[current];
      for (const next of node.links) {
        const d = dist[current] + Math.hypot(this.nodes[next].x - node.x, this.nodes[next].y - node.y);
        if (d < dist[next]) {
          dist[next] = d;
          prev[next] = current;
        }
      }
    }
    const out: number[] = [];
    if (dist[to] < Infinity) for (let i = to; i >= 0; i = prev[i]) out.unshift(i);
    this.cache.set(key, out);
    return out;
  }

  /**
   * Waypoints for walking from one spot to another (the destination is the last point).
   * Returns null when the two lands are not connected.
   */
  route(fromX: number, fromY: number, fromRegion: string, toX: number, toY: number, toRegion: string): Point[] | null {
    const start = this.nearest(fromX, fromY, fromRegion);
    const end = this.nearest(toX, toY, toRegion);
    if (start < 0 || end < 0) return null;
    // Close by in the same land: walk straight there rather than detouring to a path.
    if (fromRegion === toRegion && Math.hypot(toX - fromX, toY - fromY) < 46) return [[toX, toY]];
    const nodes = this.path(start, end);
    if (!nodes.length) return null;
    const out: Point[] = nodes.map((i) => [this.nodes[i].x, this.nodes[i].y] as const);
    out.push([toX, toY]);
    return out;
  }

  /** A random waypoint in a land, for creatures with nowhere particular to be. */
  wander(region: string, rand: number): Point | null {
    const list = this.byRegion.get(region);
    if (!list?.length) return null;
    const node = this.nodes[list[Math.floor(rand * list.length) % list.length]];
    return [node.x, node.y];
  }
}
