import type { Quality } from '@/config/render';
import type { Camera } from '@/engine/camera';
import type { ParticleSystem } from '@/engine/particles';
import type { Actors, Habitat } from './actors';
import type { SeasonBlend } from './entity';
import type { RegionView } from './populate';

/** A spot on dry land, with the land it belongs to. */
export interface Spot {
  x: number;
  y: number;
  region: string;
}

/**
 * What the world offers to the systems that live inside it (events, ambience, the cutscene).
 * They depend on this interface rather than on the scene itself.
 */
export interface Stage extends Habitat {
  camera: Camera;
  particles: ParticleSystem;
  views: Map<string, RegionView>;
  actors: Actors;
  season: SeasonBlend;
  quality: Quality;
  /** Seconds since the world was (re)built. */
  time: number;
  /** A random walkable point on a discovered land, or null if none was found. */
  randomSpot(): Spot | null;
  /** True when a world point is open water (sea or pond). */
  isWater(x: number, y: number): boolean;
  /** Rising text at a world position. */
  say(text: string, x: number, y: number, color?: string, big?: boolean): void;
  /** Bounds of everything discovered so far, in world pixels. */
  extent(): { x: number; y: number; w: number; h: number };
}
