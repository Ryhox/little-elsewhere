import { PAL } from './palette';

/** Everything that shapes how the world is drawn. Tweak freely: none of this affects the simulation. */
export const RENDER = {
  camera: {
    minZoom: 1,
    maxZoom: 8,
    /** Higher = the camera catches up faster. */
    stiffness: 4.5,
    /** World pixels kept free around the discovered lands when framing them. */
    padding: 30,
    /** Pixels of pointer travel before a press counts as a drag rather than a tap. */
    dragThreshold: 6,
  },

  /** Wind: plants lean with a smooth shear as occasional gusts travel across the world. */
  wind: {
    /** How far the top of a tall tree leans in a full gust, px. */
    lean: 2.4,
    /** A gentle always-on breath: how far (px) and how fast. */
    idle: 0.45,
    idleSpeed: 0.9,
    /** Gusts: how fast they travel, their wavelength, and how brief they are (higher = rarer, sharper). */
    speed: 0.5,
    scale: 0.009,
    sharpness: 3,
    /** Extra lean during rain. */
    stormBoost: 1.9,
    /** Sprites at least this tall are trees: the bottom `trunk` share of them stays rooted. */
    tall: 26,
    trunk: 0.4,
    /** A shaken plant shudders this far (px), this fast, for this long. */
    joltLean: 3.5,
    joltSpeed: 38,
    joltSeconds: 0.55,
  },

  /** Squash-and-stretch when something is built or bought. */
  pop: { seconds: 0.5, overshoot: 0.22 },

  spring: {
    /** How far the spring compresses on a tap (0..1) and how fast it recovers. */
    squash: 0.3,
    stiffness: 190,
    damping: 11,
    frameRate: 7,
    /** Taps within this radius of the spring count, in world px. */
    radius: 30,
  },

  /** Sun and moon. */
  sky: {
    /** Ambient light colours multiplied over the scene: [r, g, b] 0..255. */
    day: [255, 255, 255],
    dusk: [255, 190, 142],
    dawn: [255, 196, 196],
    night: [82, 98, 172],
    storm: [196, 208, 232],
    /** Tint per season: lush, autumn, winter. */
    seasons: [
      [255, 255, 255],
      [255, 240, 218],
      [228, 238, 255],
    ],
  },

  shadows: {
    /** Opacity of sun, moon and lamp shadows. */
    sunAlpha: 0.3,
    moonAlpha: 0.16,
    lampAlpha: 0.3,
    /** Shadow length as a multiple of the caster's height: at noon, and at dawn/dusk. */
    noonLength: 0.42,
    lowLength: 1.2,
    /** The sun's bearing at dawn and dusk, in radians off due west/east. Smaller = flatter, more sideways shadows. */
    lowAngle: 0.45,
    /** How flat shadows lie (vertical squash of the ground plane). */
    groundSquash: 0.55,
    /** Contact shadow: each silhouette pressed flat under its feet, as a fraction of its height. */
    contact: 0.12,
    moonAngle: 0.85,
    moonLength: 0.75,
    /** Lamps cast shadows from things within this multiple of their radius. */
    lampReach: 1.5,
    color: '#0c1030',
  },

  light: {
    /** How much coloured glow lamps add on top of simply lifting the darkness (0..1). */
    bloom: 0.42,
    /** Lamps breathe: radius varies by this fraction. */
    flicker: 0.07,
    flickerSpeed: 6,
    /** Windows and other glow rectangles fade in with this colour at night. */
    lamplit: '#ffd77a',
  },

  water: {
    /** The sea-depth map is painted at 1/scale resolution for chunkier bands. */
    depthScale: 2,
    /** Distance from shore (px) where the shallows and the mid-water end. */
    shallow: 14,
    mid: 40,
    /**
     * Darker deeps mottle the open sea. They come from a noise texture that repeats every
     * `cells` × `cell` px, so the sea carries on unbroken however far the view reaches.
     * `level` (0..1) is how much of the sea stays ordinary depth: higher = fewer dark patches.
     */
    deeps: { cell: 96, cells: 8, level: 0.6 },
    colors: { deep: PAL.water[1], mid: PAL.water[2], shallow: PAL.water[3], foam: PAL.water[5], crest: PAL.water[4], trough: PAL.water[0] },
    /** Animated wave texture. */
    tile: 96,
    frames: 5,
    fps: 2.2,
    crests: 34,
    /** Shoreline foam animation speed. */
    foamFps: 1.8,
    /** Sun glitter: sparkles per second per 10,000 px² of visible water. */
    glitter: 1.6,
    reflection: {
      alpha: 0.4,
      /** Ripple distortion: pixels of sideways wobble, its speed and wavelength, and the strip height it is drawn in. */
      wobble: 1.4,
      speed: 2.4,
      scale: 0.42,
      strip: 2,
      /** At this zoom and closer the strips are drawn at full detail; further out they get proportionally taller. */
      fullDetailZoom: 3,
      /** Reflections fade out this far below the thing they mirror, as a multiple of its height. */
      squash: 0.8,
    },
    /** Streams: flow streaks per second per px of stream, and their speed. */
    flowRate: 0.35,
    flowSpeed: 26,
  },

  /** Drifting cloud shadows by day. */
  clouds: { count: 5, alpha: 0.1, speed: 5, size: [90, 170] as [number, number] },

  /** New lands rise from the sea. */
  rise: { seconds: 2.4, depth: 26 },

  /** Floating numbers and reward text. */
  floaters: { rise: 22, seconds: 1.1, max: 70 },

  /**
   * Buildings show what they are making: now and then one pops a small `+N` above itself,
   * the dew a single copy gathered over `seconds`. `perSecond` caps how many pop across the
   * whole view, so a busy world stays readable.
   */
  income: { perSecond: 2.5, seconds: 2 },

  /** Mouse pointers: how long one keeps its "doing it" look after a click that did something. */
  cursor: { pulseSeconds: 0.18 },

  /** How the hands-on toys look (what they are worth lives in BALANCE.play). */
  play: {
    /** The rain cloud floats this high above the ground it waters, bobbing by `cloudBob` px. */
    cloudLift: 30,
    cloudBob: 1.5,
    /** Where a new cloud waits, relative to the spring. */
    cloudHome: [46, -26] as [number, number],
    /** Raindrops per second at full particle density, falling across this width. */
    rainPerSecond: 60,
    rainWidth: 22,
    /** How often the watered share of each building is measured for the economy. */
    waterCheckSeconds: 0.3,
    /** Plants shorter than this many pixels are too small to shake. */
    shakeableHeight: 12,
    /** Chance per second that a waiting dewdrop glints. */
    dropSparkle: 0.9,
  },

  /** Maximum particles alive at once. */
  particleCapacity: 12000,
  /**
   * Particles are drawn one of two ways. Up to this many view pixels, they are written into a
   * pixel buffer (cheapest when the view is small, however many particles there are); above it,
   * as batched rectangles (cheapest when the view is large).
   */
  particlePixelArea: 420000,

  /** Performance presets, lowest to highest. */
  quality: [
    { name: 'Low', particles: 0.35, reflections: false, shadows: false, ambient: 0.5, clouds: false },
    { name: 'Medium', particles: 0.7, reflections: true, shadows: true, ambient: 0.8, clouds: true },
    { name: 'High', particles: 1, reflections: true, shadows: true, ambient: 1, clouds: true },
  ],
} as const;

export type Quality = (typeof RENDER.quality)[number];
