/**
 * Life in the open sea: reefs on the sea floor, fish below the surface and little boats on it.
 * Everything here is scaled by the quality setting's wildlife level.
 */
export const SEA = {
  /** How far past the edge of the world map the sea is still populated, px. */
  margin: 260,

  /**
   * Reefs lie in the shallows around each discovered island: a bed of sunken rock with a few
   * corals, weeds and shells on it. They are painted muted and drawn faint, so they read as
   * shapes under the water rather than things floating on it.
   */
  reefs: {
    perIsland: 5,
    /** How far from an island's shore a reef may lie: [nearest, furthest], px. */
    band: [9, 26] as [number, number],
    pieces: [3, 6] as [number, number],
    spread: 9,
    alpha: 0.62,
    bedAlpha: 0.5,
    /** What a reef is made of: [sprite, animation frames, how common]. Sprites are painted in art/sea.ts. */
    kinds: [
      ['reef_branch_0', 1, 3],
      ['reef_branch_1', 1, 3],
      ['reef_branch_2', 1, 2],
      ['reef_dome_0', 1, 2],
      ['reef_dome_1', 1, 2],
      ['reef_fan_0', 1, 2],
      ['reef_fan_1', 1, 2],
      ['reef_tube_0', 1, 2],
      ['reef_tube_1', 1, 1],
      ['reef_weed_0', 2, 4],
      ['reef_weed_1', 2, 3],
      ['reef_anemone', 2, 2],
      ['reef_star', 1, 1],
      ['reef_shell', 1, 1],
      ['reef_stone_0', 1, 2],
      ['reef_stone_1', 1, 2],
    ] as readonly (readonly [string, number, number])[],
    /** Reefs keep this far from bridges. */
    bridgeClearance: 14,
    /** Seaweed and anemones sway at this many frames per second. */
    swayFps: 1.6,
    seed: 77,
  },

  /** Rocks that break the surface, out in open water away from every island and bridge. */
  rocks: { count: 9, clearance: 34, seed: 31 },

  fish: {
    /** Schools per million px² of sea, and fish in each. */
    density: 9,
    perSchool: [3, 8] as [number, number],
    speed: [6, 12] as [number, number],
    /** How sharply a school wanders, and how hard it turns away from land (radians per second). */
    wander: 0.5,
    avoid: 2.4,
    /** A school keeps its middle this far from every shore: a little more than the school is wide, so fish come close to an island but never swim under it. */
    clearance: 24,
    /** How far ahead a school looks for land, px. */
    lookAhead: 22,
    /** A leaping fish needs this much open water around where it takes off and where it lands. */
    leapClearance: 12,
    alpha: 0.78,
    tailFps: 5,
    /** A fish leaps now and then: seconds between leaps, how high and far it goes, and how long it is in the air. */
    leapEvery: [2.5, 7] as [number, number],
    leapHeight: 14,
    leapLength: 24,
    leapSeconds: 0.9,
  },

  boats: {
    count: 4,
    speed: 5,
    /** Boats steer this far clear of islands and bridges. */
    clearance: 34,
    bridgeClearance: 22,
    /** Gentle rocking: pixels, and how fast. */
    bob: 1,
    bobSpeed: 1.7,
    /** Foam particles per second left in the wake. */
    wake: 5,
    /** Seconds a boat rests when it arrives somewhere. */
    rest: [2, 7] as [number, number],
  },
} as const;
