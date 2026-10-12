/**
 * The tutorial's teacher: who she is and every way she moves. She can be shown two ways, chosen by
 * `TEACHER.look`:
 *
 *   - as the portrait made from a picture: what the game uses. Everything about it is in the
 *     second half of this file (TEACHER_PICTURE, PICTURE_ANIMS), and art/teacherPicture.ts paints it;
 *   - as one of the drawn looks in TEACHER_LOOKS, painted from scratch by art/teacher.ts from the
 *     poses in `TEACHER.anims`.
 *
 * Both have a gesture for every name in `TEACHER.anims`; the guide's lines (config/guide.ts) pick
 * gestures by those names. To add a gesture, add it under the same name in both.
 */

export type TeacherEyes = 'open' | 'closed' | 'happy' | 'left' | 'right' | 'down' | 'wink';
export type TeacherMouth = 'smile' | 'open' | 'grin' | 'oh';
/** What a hand is doing: an open wave, pointing sideways, a raised finger, a cupped palm, a flat sweep, thrown up in joy. */
export type TeacherHand = 'wave' | 'point' | 'finger' | 'hold' | 'sweep' | 'cheer';
/** Things she can hold in a cupped palm. */
export type TeacherItem = 'sprout' | 'bush' | 'sproutling' | 'book' | 'map' | 'glass' | 'token' | 'hat';
/** Marks in the air around her. */
export type TeacherFx = 'sparkle' | 'hearts' | 'drops' | 'leaves' | 'tap';

export interface TeacherPose {
  eyes?: TeacherEyes;
  mouth?: TeacherMouth;
  /** Eyebrows lifted by this many pixels. */
  brows?: number;
  /** Head moved by [x, y] pixels (a nod, a tilt, a bow). */
  head?: [number, number];
  /** Which way the hat's tassel swings: -1, 0 or 1. */
  swing?: number;
  /** The hat floats this many pixels above her head (a little toss), or is 'off' (she is holding it). */
  hat?: number | 'off';
  /** Her hand: what it does, where ([x, y] away from that gesture's usual place), what it holds and which look of that thing. */
  hand?: { does: TeacherHand; at?: [number, number]; holds?: TeacherItem; look?: number };
  /** Her other hand mirrors the first (cheering). */
  both?: boolean;
  /** Marks in the air, and which arrangement of them. */
  fx?: [TeacherFx, number];
}

/**
 * How she is drawn. Each field picks one of the painter's options (art/teacher.ts knows what
 * each one means). Open the game with `?looks` to see every look below side by side.
 */
export interface TeacherLook {
  id: string;
  /** A few words describing it, shown on the chooser sheet. */
  label: string;
  hair: 'gold' | 'honey' | 'blonde' | 'copper';
  /** How the hair lies: a few big soft waves, or many finer strands. */
  waves: 'broad' | 'fine';
  /** Her fringe: parted in the middle, swept to one side, or wisps on the forehead. */
  bangs: 'curtain' | 'swept' | 'wispy';
  face: 'slim' | 'oval' | 'heart';
  eyes: 'big' | 'soft';
  iris: 'blue' | 'grey' | 'green' | 'brown';
  outfit: 'pink' | 'blue' | 'teal' | 'lilac';
  glasses: 'round' | 'oval';
  rim: 'brown' | 'gold' | 'navy';
  /** Her outline: warm and coloured by what it runs along, or the darker line the rest of the world gets. */
  outline: 'warm' | 'dark';
}

/** Looks to choose from. Add one, or change the fields of one, and it appears on the `?looks` sheet. */
export const TEACHER_LOOKS: TeacherLook[] = [
  { id: 'A', label: 'golden waves, curtain bangs, slim face, blue eyes, pink dress', hair: 'gold', waves: 'broad', bangs: 'curtain', face: 'slim', eyes: 'big', iris: 'blue', outfit: 'pink', glasses: 'round', rim: 'brown', outline: 'warm' },
  { id: 'B', label: 'golden waves, side-swept fringe, slim face, blue eyes, blue dress', hair: 'gold', waves: 'broad', bangs: 'swept', face: 'slim', eyes: 'big', iris: 'blue', outfit: 'blue', glasses: 'round', rim: 'gold', outline: 'warm' },
  { id: 'C', label: 'honey waves, curtain bangs, oval face, grey eyes, pink dress', hair: 'honey', waves: 'broad', bangs: 'curtain', face: 'oval', eyes: 'big', iris: 'grey', outfit: 'pink', glasses: 'round', rim: 'brown', outline: 'warm' },
  { id: 'D', label: 'honey, fine strands, wispy fringe, slim face, green eyes, teal dress', hair: 'honey', waves: 'fine', bangs: 'wispy', face: 'slim', eyes: 'big', iris: 'green', outfit: 'teal', glasses: 'oval', rim: 'gold', outline: 'warm' },
  { id: 'E', label: 'pale blonde waves, curtain bangs, slim face, grey eyes, pink dress', hair: 'blonde', waves: 'broad', bangs: 'curtain', face: 'slim', eyes: 'big', iris: 'grey', outfit: 'pink', glasses: 'round', rim: 'brown', outline: 'warm' },
  { id: 'F', label: 'pale blonde, fine strands, side-swept, heart face, softer eyes, lilac dress', hair: 'blonde', waves: 'fine', bangs: 'swept', face: 'heart', eyes: 'soft', iris: 'blue', outfit: 'lilac', glasses: 'round', rim: 'navy', outline: 'warm' },
  { id: 'G', label: 'golden, fine strands, curtain bangs, heart face, blue dress, dark outline', hair: 'gold', waves: 'fine', bangs: 'curtain', face: 'heart', eyes: 'big', iris: 'blue', outfit: 'blue', glasses: 'oval', rim: 'brown', outline: 'dark' },
  { id: 'H', label: 'copper waves, side-swept fringe, slim face, green eyes, teal dress', hair: 'copper', waves: 'broad', bangs: 'swept', face: 'slim', eyes: 'big', iris: 'green', outfit: 'teal', glasses: 'round', rim: 'gold', outline: 'warm' },
  { id: 'I', label: 'honey waves, wispy fringe, heart face, blue eyes, pink dress', hair: 'honey', waves: 'broad', bangs: 'wispy', face: 'heart', eyes: 'big', iris: 'blue', outfit: 'pink', glasses: 'round', rim: 'navy', outline: 'warm' },
  { id: 'J', label: 'golden waves, wispy fringe, oval face, softer brown eyes, lilac dress', hair: 'gold', waves: 'broad', bangs: 'wispy', face: 'oval', eyes: 'soft', iris: 'brown', outfit: 'lilac', glasses: 'oval', rim: 'brown', outline: 'warm' },
  { id: 'K', label: 'pale blonde waves, wispy fringe, slim face, blue eyes, blue dress, dark outline', hair: 'blonde', waves: 'broad', bangs: 'wispy', face: 'slim', eyes: 'big', iris: 'blue', outfit: 'blue', glasses: 'round', rim: 'gold', outline: 'dark' },
  { id: 'L', label: 'copper, fine strands, curtain bangs, oval face, grey eyes, pink dress', hair: 'copper', waves: 'fine', bangs: 'curtain', face: 'oval', eyes: 'big', iris: 'grey', outfit: 'pink', glasses: 'oval', rim: 'navy', outline: 'warm' },
];

export interface TeacherAnim {
  /** Frames per second. */
  fps: number;
  frames: TeacherPose[];
}

const blink: TeacherPose = { eyes: 'closed' };
const holding = (holds: TeacherItem, look = 0, at: [number, number] = [0, 0]) => ({ does: 'hold', holds, look, at }) as const;

export const TEACHER = {
  name: 'Claudia',
  /** What she looks like in the game: 'picture' (the portrait made from a picture) or the letter of one of the drawn looks above. */
  look: 'picture',
  /** The size of a drawn look's portrait in its own pixels, and the part of it that shows her face (for small versions). */
  portrait: { w: 64, h: 64 },
  face: { x: 12, y: 0, w: 40, h: 46 },
  /** How she is shown when nothing in particular is happening. */
  resting: 'idle',
  /** The drawn looks' gestures, frame by frame. (The picture's are in PICTURE_ANIMS, under the same names.) */
  anims: {
    idle: { fps: 3, frames: [{}, {}, {}, {}, { swing: 1 }, { swing: 1 }, blink, {}, {}, {}, { swing: -1 }, {}, {}, blink, {}] },
    wave: {
      fps: 5,
      frames: [
        { eyes: 'happy', mouth: 'grin', hand: { does: 'wave', at: [-2, 0] } },
        { eyes: 'happy', mouth: 'grin', hand: { does: 'wave', at: [2, -1] }, swing: 1 },
        { eyes: 'happy', mouth: 'grin', hand: { does: 'wave', at: [-2, 0] }, head: [0, 1] },
        { eyes: 'open', mouth: 'grin', hand: { does: 'wave', at: [2, -1] }, swing: -1 },
      ],
    },
    /** A raised finger, tapping the air: "do this". */
    tap: {
      fps: 4,
      frames: [
        { eyes: 'open', brows: 1, hand: { does: 'finger', at: [0, -3] } },
        { eyes: 'open', brows: 1, hand: { does: 'finger' }, fx: ['tap', 0] },
        { eyes: 'right', hand: { does: 'finger', at: [0, -3] } },
        { eyes: 'right', hand: { does: 'finger' }, fx: ['tap', 0] },
      ],
    },
    /** A seedling in a pot that grows as she watches. */
    plant: {
      fps: 2.5,
      frames: [
        { eyes: 'down', hand: holding('sprout', 0) },
        { eyes: 'down', hand: holding('sprout', 1) },
        { eyes: 'down', brows: 1, mouth: 'oh', hand: holding('sprout', 2), fx: ['sparkle', 0] },
        { eyes: 'happy', mouth: 'grin', hand: holding('sprout', 2), fx: ['sparkle', 1] },
      ],
    },
    /** A flat hand passing back and forth through glittering drops. */
    sweep: {
      fps: 5,
      frames: [
        { eyes: 'left', hand: { does: 'sweep', at: [-7, 0] }, fx: ['drops', 0] },
        { eyes: 'down', hand: { does: 'sweep', at: [-2, -1] }, fx: ['drops', 1] },
        { eyes: 'right', hand: { does: 'sweep', at: [4, 0] }, fx: ['drops', 2] },
        { eyes: 'down', mouth: 'grin', hand: { does: 'sweep', at: [-2, -1] }, fx: ['drops', 1] },
      ],
    },
    /** Shaking a little bush until its leaves fly. */
    shake: {
      fps: 7,
      frames: [
        { eyes: 'open', mouth: 'grin', hand: holding('bush', 0, [-2, 0]), fx: ['leaves', 0] },
        { eyes: 'happy', mouth: 'grin', hand: holding('bush', 0, [2, -1]), fx: ['leaves', 1] },
      ],
    },
    /** A Sproutling sitting happily in her palm. */
    pet: {
      fps: 3,
      frames: [
        { eyes: 'down', hand: holding('sproutling', 0) },
        { eyes: 'happy', mouth: 'grin', hand: holding('sproutling', 1), fx: ['hearts', 0] },
        { eyes: 'happy', mouth: 'grin', hand: holding('sproutling', 1, [0, -1]), fx: ['hearts', 1] },
        { eyes: 'down', hand: holding('sproutling', 0), fx: ['hearts', 0] },
      ],
    },
    /** Reading, then looking up with something worth saying. */
    book: {
      fps: 2,
      frames: [
        { eyes: 'down', hand: holding('book', 0) },
        { eyes: 'down', hand: holding('book', 1) },
        { eyes: 'down', hand: holding('book', 0) },
        { eyes: 'open', brows: 1, mouth: 'grin', hand: holding('book', 0), fx: ['sparkle', 0] },
      ],
    },
    /** Finding something on a map. */
    map: {
      fps: 2.5,
      frames: [
        { eyes: 'down', hand: holding('map', 0) },
        { eyes: 'down', hand: holding('map', 0), head: [0, 1] },
        { eyes: 'open', brows: 2, mouth: 'oh', hand: holding('map', 1), fx: ['sparkle', 1] },
        { eyes: 'happy', mouth: 'grin', hand: holding('map', 1) },
      ],
    },
    /** Peering about with a magnifying glass. */
    spy: {
      fps: 2.5,
      frames: [
        { eyes: 'left', hand: holding('glass', 0, [-3, 0]) },
        { eyes: 'left', brows: 1, hand: holding('glass', 0, [-3, 0]) },
        { eyes: 'right', hand: holding('glass', 0, [3, -1]) },
        { eyes: 'right', brows: 1, hand: holding('glass', 0, [3, -1]) },
      ],
    },
    /** Pointing across at the menus. */
    point: {
      fps: 3,
      frames: [{ eyes: 'right', hand: { does: 'point' } }, { eyes: 'right', mouth: 'grin', hand: { does: 'point', at: [3, 0] } }, { eyes: 'open', hand: { does: 'point' } }, { eyes: 'open', mouth: 'grin', hand: { does: 'point', at: [3, 0] } }],
    },
    /** Both hands in the air and the hat with them. */
    cheer: {
      fps: 5,
      frames: [
        { eyes: 'happy', mouth: 'grin', hand: { does: 'cheer' }, both: true, hat: 2, fx: ['sparkle', 0] },
        { eyes: 'happy', mouth: 'grin', hand: { does: 'cheer', at: [0, -3] }, both: true, hat: 4, head: [0, -1], fx: ['sparkle', 1] },
      ],
    },
    /** A pleased nod. */
    nod: {
      fps: 4,
      frames: [{ eyes: 'happy', mouth: 'grin' }, { eyes: 'happy', mouth: 'grin', head: [0, 2] }, { eyes: 'happy', mouth: 'grin' }, { eyes: 'wink', mouth: 'grin', swing: 1, fx: ['sparkle', 0] }],
    },
    /** Showing an Evergreen Token. */
    token: {
      fps: 3,
      frames: [{ eyes: 'down', hand: holding('token', 0) }, { eyes: 'open', brows: 1, hand: holding('token', 1), fx: ['sparkle', 1] }, { eyes: 'happy', mouth: 'grin', hand: holding('token', 0, [0, -1]), fx: ['sparkle', 0] }],
    },
    /** Hat off, and a bow: thank you. */
    thanks: {
      fps: 2.5,
      frames: [
        { hat: 'off', eyes: 'happy', mouth: 'grin', hand: holding('hat', 0) },
        { hat: 'off', eyes: 'closed', head: [0, 2], hand: holding('hat', 0, [0, 1]) },
        { hat: 'off', eyes: 'closed', head: [0, 3], hand: holding('hat', 0, [0, 1]), fx: ['hearts', 0] },
        { hat: 'off', eyes: 'happy', mouth: 'grin', head: [0, 1], hand: holding('hat', 0), fx: ['hearts', 1] },
      ],
    },
  },
} as const satisfies { name: string; look: string; resting: string; portrait: { w: number; h: number }; face: { x: number; y: number; w: number; h: number }; anims: Record<string, TeacherAnim> };

export type TeacherAnimName = keyof typeof TEACHER.anims;

/** Sprite name of one frame of a drawn look's animation; `talking` picks the variant with her mouth open. */
export const teacherFrame = (anim: TeacherAnimName, index: number, talking = false) => `teacher_${anim}_${index}${talking ? '_t' : ''}`;

/** Is she shown as the portrait made from a picture (rather than one of the drawn looks)? */
export const teacherIsPicture = (): boolean => (TEACHER.look as string) === 'picture';

/* ───────────────────────────── The portrait made from a picture ───────────────────────────── */

/**
 * When her look is 'picture', she is the portrait in art/portrait.data.ts (made from a picture by
 * `npm run portrait`), brought to life in art/teacherPicture.ts: the picture itself is bent a pixel
 * or two to move her head, her eyes and mouth are redrawn in the picture's own colours,
 * and her own arms are lifted out of the picture and bent at the shoulder and elbow.
 * Everything here says where things are in that portrait, in its own pixels (x to the right, y down).
 * Re-check these after generating a new portrait.
 */
export const TEACHER_PICTURE = {
  label: 'your picture, turned into pixel art',
  size: { w: 64, h: 69 },
  /** Room around the portrait for raised hands and marks in the air. */
  pad: { x: 6, top: 6 },
  /** How many times a second she moves. */
  fps: 10,
  /** The part of the portrait that shows her face, for small versions. */
  face: { x: 14, y: 3, w: 36, h: 36 },
  /**
   * The skin of her face, as [row, first column, last column]. Her eyes, nose and mouth are only
   * ever drawn inside it, so they can never end up on top of her hair.
   */
  skin: [[19, 25, 38], [20, 25, 38], [21, 24, 38], [22, 24, 38], [23, 24, 38], [24, 24, 38], [25, 24, 38], [26, 24, 38], [27, 24, 38], [28, 25, 37], [29, 26, 37], [30, 26, 36], [31, 28, 35]],
  /**
   * The top-left corner of each eye and of her mouth, and where her nose is. Her eyes are drawn
   * level and as mirror images of each other, each in a box five pixels wide and four tall; her
   * mouth is drawn in a box seven pixels wide.
   */
  eyeLeft: [24, 20],
  eyeRight: [34, 20],
  mouth: [29, 27],
  nose: [33, 24],
  /**
   * The picture's own eyes and mouth, as boxes [x, y, w, h]: they are wiped to bare skin, since
   * she is drawn with her own (in the picture her head is tilted, so one eye sits higher than the
   * other and her smile slants).
   */
  wipe: [[24, 20, 5, 5], [34, 19, 5, 5], [29, 26, 7, 4]],
  /**
   * The brow under her fringe over the eye on the left, as [x, y, width]. It is what joins her
   * fringe to her eyes, so it stays, and the same brow is drawn mirrored over the other eye.
   */
  brow: [25, 19, 4],
  /** Where her cheeks glow when she is pleased. */
  cheeks: [[25, 25], [26, 25], [25, 26], [26, 26], [27, 26], [36, 25], [37, 25], [36, 26], [37, 26]],
  /**
   * Her head and how it moves: everything above `chin` moves with it, everything below `shoulders`
   * stays put, and the rows between stretch. `still` is the lowest row that rises as she breathes.
   */
  chin: 32,
  shoulders: 44,
  still: 64,
  /**
   * Her arms, as the picture shows them hanging at her sides: the shoulder each one turns about,
   * and where its elbow and wrist are at rest (the wrist is below the picture's edge). `side` is
   * the column that parts the arm from her body: the sleeve is everything of her sweater beyond
   * it, from row `top` down. `body` is the line of her body under that arm, as [from this row
   * down, column]: it is drawn when the arm is lifted away, so that her side curves in to her waist
   * and out again to her hip instead of ending where the arm used to cover it.
   * 'right' and 'left' are as you look at the picture.
   */
  arms: {
    right: { shoulder: [46, 43], elbow: [46, 62], wrist: [47, 84], side: 42, top: 38, body: [[47, 43], [51, 42], [54, 41], [58, 40], [64, 41], [67, 42]] },
    left: { shoulder: [18, 44], elbow: [17, 62], wrist: [16, 84], side: 22, top: 50, body: [[47, 21], [51, 22], [54, 23], [58, 24], [64, 23], [67, 22]] },
  },
  /** How thick her sleeve is, and the box [x, y, w, h] of plain sleeve in the picture that a bent arm is knitted from. */
  sleeveWidth: 9,
  sleeve: [42, 49, 8, 18],
  /**
   * The curve of her figure under the sweater, shaded onto the picture: the middle of each side,
   * and how many pixels the shading reaches (0 leaves the picture exactly as it is).
   */
  bust: { at: [[28, 51], [36.5, 51]], size: 5.4 },
} as const;

export type PictureEyes = 'open' | 'half' | 'closed' | 'happy' | 'left' | 'right' | 'down' | 'wink';
export type PictureMouth = 'smile' | 'closed' | 'open' | 'wide' | 'oh';
/** What a hand is doing: open with the palm showing, one finger raised, pointing sideways, cupped to hold something, flat, or resting on her heart. */
export type PictureHandShape = 'open' | 'finger' | 'point' | 'hold' | 'sweep' | 'heart';
export type PictureItem = Exclude<TeacherItem, 'hat'>;

/** One of her arms away from her side: where its wrist and elbow are, what the hand does and holds. */
export interface PictureArm {
  does: PictureHandShape;
  wrist: readonly [number, number];
  elbow: readonly [number, number];
  holds?: PictureItem;
  /** Which look of the thing she holds (a seedling that has grown, a page turned). */
  look?: number;
}

/** How she is at one moment. Anything left out is as in the picture. */
export interface PicturePose {
  eyes?: PictureEyes;
  mouth?: PictureMouth;
  /** Head moved by [x, y] pixels (a nod, a bow). */
  head?: readonly [number, number];
  /** Her head leans this many pixels to the right (negative: left), on top of `head`. */
  tilt?: number;
  /** Her face turned a pixel to the right (1) or left (-1): her nose and mouth shift that way (her eyes stay put and glance instead). */
  turn?: number;
  /** Her whole upper body lifted (negative) or dipped (positive) by this many pixels: a bounce. */
  bob?: number;
  /** Pink cheeks. */
  blush?: boolean;
  /** The arm on the right of the picture, and the one on the left. Left out, it hangs as in the picture. */
  right?: PictureArm;
  left?: PictureArm;
  /** Marks in the air, and which arrangement of them. */
  fx?: readonly [TeacherFx, number];
}

export interface PictureAnim {
  /** The gesture plays from its first frame, then keeps repeating from this one. */
  loop: number;
  frames: PicturePose[];
}

/** How a move arrives at a key pose: gently at both ends, quickly then settling, shooting past and coming back, or at an even pace. */
type Ease = 'soft' | 'out' | 'spring' | 'even';
/** A key pose: the frame it is reached on, the pose, and how she gets there from the one before. */
type Key = readonly [frame: number, pose: PicturePose, ease?: Ease];

const EASES: Record<Ease, (t: number) => number> = {
  soft: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) ** 3,
  spring: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
  even: (t) => t,
};

const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const mixPoint = (from: readonly number[], to: readonly number[], t: number): [number, number] => [mix(from[0], to[0], t), mix(from[1], to[1], t)];

/** An arm part-way between two poses. Hanging at her side counts as a pose too: a hand on its way up or down keeps its shape. */
function mixArm(side: 'right' | 'left', from: PictureArm | undefined, to: PictureArm | undefined, t: number): PictureArm | undefined {
  // Not yet moved from her side (or never leaving it): the arm is still the one in the picture.
  if (!from && (!to || t === 0)) return undefined;
  const rest = TEACHER_PICTURE.arms[side];
  const shape = from ?? to!;
  return { ...shape, wrist: mixPoint(from?.wrist ?? rest.wrist, to?.wrist ?? rest.wrist, t), elbow: mixPoint(from?.elbow ?? rest.elbow, to?.elbow ?? rest.elbow, t) };
}

/**
 * Every frame of a gesture, from its key poses. Between two keys her head, body and arms glide
 * from one to the other; her eyes, mouth and what she holds stay as in the earlier key until the
 * next one is reached. `length` is the number of frames.
 */
function frames(length: number, keys: readonly Key[]): PicturePose[] {
  const out: PicturePose[] = [];
  for (let f = 0; f < length; f++) {
    let k = 0;
    while (k + 1 < keys.length && keys[k + 1][0] <= f) k++;
    const [at, pose] = keys[k];
    const next = keys[k + 1];
    if (!next) {
      out.push({ ...pose });
      continue;
    }
    const t = EASES[next[2] ?? 'soft']((f - at) / (next[0] - at));
    const to = next[1];
    out.push({
      ...pose,
      head: mixPoint(pose.head ?? [0, 0], to.head ?? [0, 0], t),
      tilt: mix(pose.tilt ?? 0, to.tilt ?? 0, t),
      turn: mix(pose.turn ?? 0, to.turn ?? 0, t),
      bob: mix(pose.bob ?? 0, to.bob ?? 0, t),
      right: mixArm('right', pose.right, to.right, t),
      left: mixArm('left', pose.left, to.left, t),
    });
  }
  return out;
}

/** The arm on the right of the picture, somewhere other than at her side. */
const arm = (does: PictureHandShape, wrist: readonly [number, number], elbow: readonly [number, number], holds?: PictureItem, look = 0): PictureArm => ({ does, wrist, elbow, holds, look });
/** The same arm on the other side of her. */
const mirrored = (a: PictureArm): PictureArm => ({ ...a, wrist: [63 - a.wrist[0], a.wrist[1]], elbow: [63 - a.elbow[0], a.elbow[1]] });
/** A cupped palm in front of her, holding something. */
const cup = (holds: PictureItem, look = 0, dx = 0, dy = 0) => arm('hold', [44 + dx, 61 + dy], [50, 63], holds, look);
/** Her open hand beside her face, at either end of a wave. */
const waveIn = arm('open', [56, 40], [54, 59]);
const waveOut = arm('open', [62, 41], [54, 59]);
/** Both hands in the air, low and high. */
const yayLow = arm('open', [58, 32], [56, 51]);
const yayHigh = arm('open', [59, 27], [56, 49]);
/** A raised finger, up and tapped down. */
const fingerUp = arm('finger', [55, 45], [53, 61]);
const fingerDown = arm('finger', [55, 49], [53, 61]);

const pleased: PicturePose = { eyes: 'happy', blush: true };

/**
 * Her gestures, one for every name in TEACHER.anims (the guide's lines pick them by name).
 * Each is a list of key poses on a timeline of frames, `TEACHER_PICTURE.fps` to the second.
 */
export const PICTURE_ANIMS: Record<TeacherAnimName, PictureAnim> = {
  /** Waiting: she looks at you, glances aside, tilts her head with a smile, looks the other way. */
  idle: {
    loop: 0,
    frames: frames(160, [
      [0, {}],
      [22, {}],
      [25, { eyes: 'right', turn: 1 }],
      [42, { eyes: 'right', turn: 1 }],
      [45, {}],
      [62, {}],
      [66, { ...pleased, tilt: -1, head: [0, 1] }, 'spring'],
      [86, { ...pleased, tilt: -1, head: [0, 1] }],
      [90, {}],
      [106, {}],
      [109, { eyes: 'left', turn: -1 }],
      [122, { eyes: 'left', turn: -1 }],
      [125, {}],
      [138, {}],
      [141, { tilt: 1, mouth: 'closed' }, 'spring'],
      [154, { tilt: 1, mouth: 'closed' }],
      [158, {}],
    ]),
  },
  /** Hello! A little dip, then her hand comes up beside her face and waves. */
  wave: {
    loop: 7,
    frames: frames(39, [
      [0, {}],
      [2, { bob: 1 }],
      [7, { ...pleased, tilt: 1, right: waveIn }, 'spring'],
      [11, { ...pleased, tilt: 1, right: waveOut }],
      [15, { ...pleased, tilt: 1, right: waveIn }],
      [19, { ...pleased, tilt: 1, right: waveOut }],
      [23, { blush: true, tilt: 1, right: waveIn }],
      [27, { blush: true, tilt: 1, right: waveOut }],
      [31, { blush: true, tilt: 1, right: waveIn }],
      [35, { ...pleased, tilt: 1, right: waveOut }],
      [39, { ...pleased, tilt: 1, right: waveIn }],
    ]),
  },
  /** A raised finger, tapping the air: "do this". */
  tap: {
    loop: 6,
    frames: frames(30, [
      [0, {}],
      [6, { eyes: 'right', turn: 1, right: fingerUp }, 'spring'],
      [9, { eyes: 'right', turn: 1, right: fingerDown, fx: ['tap', 0] }, 'out'],
      [10, { eyes: 'right', turn: 1, right: fingerDown, fx: ['tap', 1] }],
      [14, { eyes: 'right', turn: 1, right: fingerUp }],
      [17, { mouth: 'open', right: fingerUp }],
      [21, { right: fingerDown, fx: ['tap', 0] }, 'out'],
      [22, { right: fingerDown, fx: ['tap', 1] }],
      [26, { right: fingerUp }],
      [30, { eyes: 'right', turn: 1, right: fingerUp }],
    ]),
  },
  /** A seedling in a pot that grows as she watches. */
  plant: {
    loop: 6,
    frames: frames(56, [
      [0, {}],
      [6, { eyes: 'down', right: cup('sprout', 0) }, 'spring'],
      [18, { eyes: 'down', head: [0, 1], right: cup('sprout', 1) }],
      [30, { eyes: 'down', head: [0, 1], right: cup('sprout', 2), mouth: 'oh', fx: ['sparkle', 0] }],
      [34, { ...pleased, tilt: -1, right: cup('sprout', 2, 0, -2), fx: ['sparkle', 1] }, 'spring'],
      [48, { ...pleased, tilt: -1, right: cup('sprout', 2, 0, -2), fx: ['sparkle', 0] }],
      [52, { right: cup('sprout', 2) }],
      [56, { eyes: 'down', right: cup('sprout', 0) }],
    ]),
  },
  /** A flat hand passing back and forth through glittering drops. */
  sweep: {
    loop: 6,
    frames: frames(30, [
      [0, {}],
      [6, { eyes: 'left', turn: -1, right: arm('sweep', [41, 56], [51, 62]), fx: ['drops', 0] }, 'out'],
      [12, { eyes: 'down', right: arm('sweep', [48, 53], [52, 62]), fx: ['drops', 1] }],
      [18, { eyes: 'right', turn: 1, right: arm('sweep', [55, 55], [53, 62]), fx: ['drops', 2] }],
      [24, { ...pleased, right: arm('sweep', [48, 53], [52, 62]), fx: ['drops', 1] }],
      [30, { eyes: 'left', turn: -1, right: arm('sweep', [41, 56], [51, 62]), fx: ['drops', 0] }],
    ]),
  },
  /** Shaking a little bush until its leaves fly. */
  shake: {
    loop: 6,
    frames: frames(26, [
      [0, {}],
      [6, { eyes: 'down', right: cup('bush', 0) }, 'spring'],
      [8, { mouth: 'open', right: cup('bush', 0, -3, -1), fx: ['leaves', 0] }, 'out'],
      [10, { mouth: 'open', right: cup('bush', 0, 3, 0), fx: ['leaves', 1] }, 'out'],
      [12, { ...pleased, right: cup('bush', 0, -3, -1), fx: ['leaves', 2] }, 'out'],
      [14, { ...pleased, right: cup('bush', 0, 3, 0), fx: ['leaves', 3] }, 'out'],
      [16, { ...pleased, right: cup('bush', 0, -2, -1), fx: ['leaves', 0] }, 'out'],
      [18, { ...pleased, right: cup('bush', 0, 2, 0), fx: ['leaves', 1] }, 'out'],
      [22, { eyes: 'down', right: cup('bush', 0), fx: ['leaves', 2] }],
      [26, { eyes: 'down', right: cup('bush', 0) }],
    ]),
  },
  /** A Sproutling sitting happily in her palm. */
  pet: {
    loop: 6,
    frames: frames(38, [
      [0, {}],
      [6, { eyes: 'down', right: cup('sproutling', 0) }, 'spring'],
      [14, { eyes: 'down', head: [0, 1], right: cup('sproutling', 0) }],
      [18, { ...pleased, tilt: -1, right: cup('sproutling', 1, 0, -1), fx: ['hearts', 0] }, 'spring'],
      [24, { ...pleased, tilt: -1, right: cup('sproutling', 1, 0, 0), fx: ['hearts', 1] }],
      [30, { ...pleased, tilt: -1, right: cup('sproutling', 1, 0, -1), fx: ['hearts', 2] }],
      [34, { eyes: 'down', blush: true, right: cup('sproutling', 0), fx: ['hearts', 3] }],
      [38, { eyes: 'down', right: cup('sproutling', 0) }],
    ]),
  },
  /** Reading, then looking up with something worth saying. */
  book: {
    loop: 6,
    frames: frames(52, [
      [0, {}],
      [6, { eyes: 'down', head: [0, 1], right: cup('book', 0) }, 'spring'],
      [16, { eyes: 'down', head: [0, 1], turn: -1, right: cup('book', 0) }],
      [24, { eyes: 'down', head: [0, 1], turn: 1, right: cup('book', 0) }],
      [26, { eyes: 'down', head: [0, 1], turn: 1, right: cup('book', 1) }],
      [30, { eyes: 'down', head: [0, 1], turn: -1, right: cup('book', 0) }],
      [36, { eyes: 'down', head: [0, 1], right: cup('book', 0) }],
      [39, { mouth: 'open', tilt: 1, right: cup('book', 0, 0, -1), fx: ['sparkle', 0] }, 'spring'],
      [48, { blush: true, tilt: 1, right: cup('book', 0, 0, -1), fx: ['sparkle', 1] }],
      [52, { eyes: 'down', head: [0, 1], right: cup('book', 0) }],
    ]),
  },
  /** Finding something on a map. */
  map: {
    loop: 6,
    frames: frames(50, [
      [0, {}],
      [6, { eyes: 'down', right: cup('map', 0) }, 'spring'],
      [14, { eyes: 'down', head: [0, 1], turn: -1, right: cup('map', 0) }],
      [22, { eyes: 'down', head: [0, 1], turn: 1, right: cup('map', 0) }],
      [26, { mouth: 'oh', bob: -1, right: cup('map', 1, 0, -2), fx: ['sparkle', 1] }, 'spring'],
      [34, { mouth: 'oh', right: cup('map', 1, 0, -2), fx: ['sparkle', 0] }],
      [37, { ...pleased, tilt: -1, right: cup('map', 1, 0, -1) }, 'spring'],
      [46, { ...pleased, tilt: -1, right: cup('map', 1, 0, -1) }],
      [50, { eyes: 'down', right: cup('map', 0) }],
    ]),
  },
  /** Peering about with a magnifying glass. */
  spy: {
    loop: 6,
    frames: frames(46, [
      [0, {}],
      [6, { eyes: 'left', turn: -1, right: cup('glass', 0, 0, -2) }, 'spring'],
      [16, { eyes: 'left', turn: -1, tilt: -1, right: cup('glass', 0, -3, -3) }],
      [22, { right: cup('glass', 0, 4, -4) }],
      [26, { eyes: 'right', turn: 1, right: cup('glass', 0, 9, -3) }],
      [36, { eyes: 'right', turn: 1, tilt: 1, right: cup('glass', 0, 12, -4) }],
      [42, { right: cup('glass', 0, 5, -4) }],
      [46, { eyes: 'left', turn: -1, right: cup('glass', 0, 0, -2) }],
    ]),
  },
  /** Pointing across at the menus. */
  point: {
    loop: 6,
    frames: frames(30, [
      [0, {}],
      [6, { eyes: 'right', turn: 1, right: arm('point', [53, 53], [50, 61]) }, 'spring'],
      [9, { eyes: 'right', turn: 1, right: arm('point', [57, 53], [51, 61]) }, 'out'],
      [13, { eyes: 'right', turn: 1, right: arm('point', [53, 53], [50, 61]) }],
      [16, { eyes: 'right', turn: 1, right: arm('point', [57, 53], [51, 61]) }, 'out'],
      [20, { blush: true, right: arm('point', [53, 53], [50, 61]) }],
      [26, { blush: true, tilt: 1, right: arm('point', [53, 53], [50, 61]) }],
      [30, { eyes: 'right', turn: 1, right: arm('point', [53, 53], [50, 61]) }],
    ]),
  },
  /** Both hands in the air, bouncing. */
  cheer: {
    loop: 5,
    frames: frames(21, [
      [0, {}],
      [2, { bob: 2 }],
      [5, { ...pleased, mouth: 'wide', bob: -2, right: yayHigh, left: mirrored(yayHigh), fx: ['sparkle', 0] }, 'spring'],
      [9, { ...pleased, mouth: 'wide', bob: 1, right: yayLow, left: mirrored(yayLow), fx: ['sparkle', 1] }],
      [13, { ...pleased, mouth: 'wide', bob: -2, right: yayHigh, left: mirrored(yayHigh), fx: ['sparkle', 0] }, 'out'],
      [17, { ...pleased, mouth: 'wide', bob: 1, right: yayLow, left: mirrored(yayLow), fx: ['sparkle', 1] }],
      [21, { ...pleased, mouth: 'wide', bob: -2, right: yayHigh, left: mirrored(yayHigh), fx: ['sparkle', 0] }, 'out'],
    ]),
  },
  /** A pleased nod, and a wink. */
  nod: {
    loop: 0,
    frames: frames(34, [
      [0, { ...pleased }],
      [3, { ...pleased, head: [0, 2] }, 'out'],
      [7, { ...pleased, head: [0, 0] }],
      [10, { ...pleased, head: [0, 2] }, 'out'],
      [14, { ...pleased, head: [0, 0] }],
      [18, { eyes: 'wink', blush: true, tilt: 1, fx: ['sparkle', 0] }, 'spring'],
      [26, { eyes: 'wink', blush: true, tilt: 1, fx: ['sparkle', 1] }],
      [30, { blush: true }],
      [34, { ...pleased }],
    ]),
  },
  /** Showing an Evergreen Token. */
  token: {
    loop: 6,
    frames: frames(40, [
      [0, {}],
      [6, { eyes: 'down', right: cup('token', 0) }, 'spring'],
      [14, { eyes: 'down', right: cup('token', 0) }],
      [18, { mouth: 'open', right: cup('token', 1, 0, -4), fx: ['sparkle', 1] }, 'spring'],
      [26, { blush: true, right: cup('token', 1, 0, -4), fx: ['sparkle', 0] }],
      [30, { ...pleased, tilt: 1, right: cup('token', 0, 0, -3) }],
      [36, { ...pleased, tilt: 1, right: cup('token', 0, 0, -3) }],
      [40, { eyes: 'down', right: cup('token', 0) }],
    ]),
  },
  /** A hand on her heart and a little bow: thank you. */
  thanks: {
    loop: 7,
    frames: frames(47, [
      [0, {}],
      [7, { ...pleased, right: arm('heart', [43, 54], [50, 62]) }, 'spring'],
      [13, { eyes: 'closed', blush: true, head: [0, 3], bob: 1, right: arm('heart', [43, 55], [50, 62]), fx: ['hearts', 0] }],
      [23, { eyes: 'closed', blush: true, head: [0, 3], bob: 1, right: arm('heart', [43, 55], [50, 62]), fx: ['hearts', 1] }],
      [28, { ...pleased, tilt: -1, right: arm('heart', [43, 54], [50, 62]), fx: ['hearts', 2] }, 'spring'],
      [38, { ...pleased, tilt: -1, right: arm('heart', [43, 54], [50, 62]), fx: ['hearts', 3] }],
      [43, { blush: true, right: arm('heart', [43, 54], [50, 62]) }],
      [47, { ...pleased, right: arm('heart', [43, 54], [50, 62]) }],
    ]),
  },
};

/** The part of her portrait that shows her face, for small versions of it. */
export const teacherFace = () => (teacherIsPicture() ? TEACHER_PICTURE.face : TEACHER.face);
