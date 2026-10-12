import { PAL } from '@/config/palette';
import { PICTURE_ANIMS, TEACHER_PICTURE as T, type PictureArm, type PictureEyes, type PictureHandShape, type PictureItem, type PictureMouth, type PicturePose, type TeacherAnimName, type TeacherFx } from '@/config/teacher';
import { Pix } from '@/engine/pix';
import { hash2 } from '@/engine/rng';
import { PORTRAIT_DATA } from './portrait.data';

/**
 * Claudia as the portrait made from a picture, brought to life. Nothing is pasted on top of
 * her: every frame starts from the picture itself (art/portrait.data.ts) and
 *
 *   - bends it by a pixel or two, so her head nods, leans and turns and she breathes;
 *   - draws her eyes and mouth afresh, in the picture's own colours, and only on the skin of
 *     her face: her fringe always stays in front;
 *   - when an arm moves, takes that arm out of the picture and draws it again from the same
 *     shoulder, bent at the elbow and knitted from the picture's own sleeve, and draws the side
 *     of her body that the arm was covering.
 *
 * Her hair, skin and sweater are the picture's, pixel for pixel; her face is tidied (level eyes, a
 * neat smile) and her figure shaded as TEACHER_PICTURE asks. Where everything is in the picture is
 * set in config/teacher.ts.
 */

const W = PORTRAIT_DATA.w;
const H = PORTRAIT_DATA.h;
const PAD_X = T.pad.x;
const PAD_TOP = T.pad.top;
const NONE = -1;

/** The size of every frame, and where the portrait's own top-left corner is inside it. */
export const PICTURE_FRAME = { w: W + PAD_X * 2, h: H + PAD_TOP, x: PAD_X, y: PAD_TOP } as const;

const blend = (from: number, to: number, amount: number) => {
  const channel = (shift: number) => Math.round(((from >> shift) & 0xff) + (((to >> shift) & 0xff) - ((from >> shift) & 0xff)) * amount) << shift;
  return channel(16) | channel(8) | channel(0);
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

/* ───────────────────────────── The picture, taken apart ───────────────────────────── */

/** The picture's colours (NONE where it is see-through). */
const PICTURE = new Int32Array(W * H).fill(NONE);
PORTRAIT_DATA.rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && (PICTURE[y * W + x] = PORTRAIT_DATA.palette[PORTRAIT_DATA.alphabet.indexOf(ch)])));

const lightness = (c: number) => (((c >> 16) & 0xff) * 3 + ((c >> 8) & 0xff) * 6 + (c & 0xff)) / 10;
const isWarm = (c: number) => c !== NONE && ((c >> 16) & 0xff) > (c & 0xff) * 1.5 && ((c >> 16) & 0xff) >= 70;

/** Her hair and skin (1) as opposed to her sweater (0): what an upper arm disappears behind. */
const WARM = new Uint8Array(W * H);
/** Her sweater. */
const CLOTH = new Uint8Array(W * H);
PICTURE.forEach((c, i) => {
  if (c === NONE) return;
  if (isWarm(c)) WARM[i] = 1;
  else if (Math.floor(i / W) > T.chin) CLOTH[i] = 1;
});
// A warm speck in the middle of her sweater is a sequin, not hair.
for (let pass = 0; pass < 2; pass++) {
  for (let y = T.chin + 1; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!WARM[i]) continue;
      const cloth = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => !inside(nx, ny) || CLOTH[ny * W + nx]).length;
      if (cloth >= 3) [WARM[i], CLOTH[i]] = [0, 1];
    }
  }
}

/** The pixels of each arm as it hangs in the picture. */
const sleeveOf = (side: 'right' | 'left') => {
  const { side: edge, top } = T.arms[side];
  const out: number[] = [];
  for (let y = top; y < H; y++) for (let x = 0; x < W; x++) if (CLOTH[y * W + x] && (side === 'right' ? x >= edge : x <= edge)) out.push(y * W + x);
  return out;
};
const ARM = { right: sleeveOf('right'), left: sleeveOf('left') };

const SLEEVE_EDGE = 0x241739;
const SLEEVE_DARK = 0x281e47;
const SLEEVE_MID = 0x31295a;
const SLEEVE_LIGHT = 0x413c7a;

/** A patch of plain sleeve from the picture; a bent arm is knitted from it, sequins and all. */
const [knitX, knitY, knitW, knitH] = T.sleeve;
const knit = (across: number, along: number) => {
  const u = Math.max(0, Math.min(knitW - 1, Math.round(across + (knitW - 1) / 2)));
  const wrap = ((Math.floor(along) % (knitH * 2)) + knitH * 2) % (knitH * 2);
  const c = PICTURE[(knitY + (wrap < knitH ? wrap : knitH * 2 - 1 - wrap)) * W + knitX + u];
  return c === NONE ? SLEEVE_MID : c;
};

/** The curve of her figure, shaded onto the sweater in its own blues. Sequins are left alone. */
function shapeFigure(pixels: Int32Array): void {
  const { at, size } = T.bust;
  if (!size) return;
  for (const [cx, cy] of at) {
    for (let y = Math.floor(cy - size - 2); y <= cy + size + 2; y++) {
      for (let x = Math.floor(cx - size - 2); x <= cx + size + 2; x++) {
        const i = y * W + x;
        if (!inside(x, y) || !CLOTH[i] || lightness(pixels[i]) > 78) continue;
        const nx = (x + 0.5 - cx) / size;
        const ny = (y + 0.5 - cy) / size;
        const d = Math.hypot(nx, ny);
        const grain = hash2(x, y, 31);
        if (d <= 1) {
          // Lit from the upper left, rounding away into shadow below.
          const light = -(nx * 0.42 + ny * 0.72) + (grain - 0.5) * 0.3;
          if (light > 0.5) pixels[i] = SLEEVE_LIGHT;
          else if (light > 0.2) pixels[i] = 0x3b326a;
          else if (ny > 0.5) pixels[i] = SLEEVE_DARK;
          else if (grain < 0.5) pixels[i] = SLEEVE_MID;
        } else if (d <= 1.22 && ny > 0.55 && Math.abs(nx) < 0.8) {
          // The fold of shadow underneath.
          pixels[i] = 0x20122b;
        }
      }
    }
  }
  // A soft shadow where the two sides meet.
  const mid = Math.round((at[0][0] + at[1][0]) / 2);
  for (let y = Math.round(at[0][1] - size * 0.2); y <= at[0][1] + size * 0.9; y++) {
    const i = y * W + mid;
    if (inside(mid, y) && CLOTH[i] && lightness(pixels[i]) <= 78) pixels[i] = SLEEVE_EDGE;
  }
}

/** The skin of her face: the only place her eyes, nose and mouth may be drawn. */
const SKIN_AREA = new Uint8Array(W * H);
for (const [y, from, to] of T.skin) for (let x = from; x <= to; x++) SKIN_AREA[y * W + x] = 1;

/** Her usual skin colour: the commonest one on her face. */
const SKIN = (() => {
  const counts = new Map<number, number>();
  SKIN_AREA.forEach((on, i) => on && counts.set(PICTURE[i], (counts.get(PICTURE[i]) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
})();

/* ───────────────────────────── Her face ───────────────────────────── */

/** The colours her features are drawn in: the picture's own eye, lip and skin tones, and a white for her eyes. */
const INK: Record<string, number> = {
  K: 0x20122b, // lashes
  P: 0x150c1e, // her pupils
  B: 0x4d3f7c, // the dark blue-violet of her eyes
  L: 0x6a5580, // the same, where the light reaches it at the bottom (the blue of the eyes in the picture)
  H: 0xf0c094, // the light in them
  w: 0xf2e6da, // the whites of her eyes
  S: SKIN,
  s: 0xf4994e, // skin in shade
  r: 0xb53825, // lips
  o: 0x8a2e21,
  i: 0x5a1722, // inside her mouth
  g: 0xdc5f44, // tongue
};

/** A small drawing, as colours row by row (NONE = leave what is there). */
type Glyph = number[][];
const glyph = (rows: readonly string[]): Glyph => rows.map((row) => [...row].map((ch) => (ch === '.' ? NONE : INK[ch])));
/** A box of the picture itself as a glyph (her nose is the picture's own, moved with her face). */
const fromPicture = (x: number, y: number, w: number, h: number): Glyph => Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => PICTURE[(y + j) * W + x + i]));

type EyeShape = 'open' | 'half' | 'down' | 'closed' | 'happy' | 'left' | 'right';

/**
 * Her eyes, each in a box five pixels wide and the same on both sides: a dark lash arching over
 * the top and down both corners; under it a dark blue-violet eye three pixels wide with a pupil
 * down its middle and a small light in its upper corner; a touch of white at either side; and a
 * lighter row along the bottom. The pupil is in the middle, so she looks straight at you.
 */
const EYE: Record<EyeShape, Glyph> = {
  open: glyph(['.KKK.', 'KHPBK', 'wBPBw', '.LLL.']),
  /**
   * Glancing to one side or the other: the whole eye slides that way inside its lashes, pupil and
   * light with it, and more white shows behind it.
   */
  left: glyph(['.KKK.', 'KPBwK', 'HPBww', 'LLL..']),
  right: glyph(['.KKK.', 'KHPBK', 'wwBPB', '..LLL']),
  /** Looking down at something in her hand: the lash lowered, the pupil at the bottom of the eye. */
  down: glyph(['.....', '.KKK.', 'KBPBK', '.LPL.']),
  /** Half shut: a blink on its way. */
  half: glyph(['.....', '.KKK.', 'KBPBK', '.LLL.']),
  closed: glyph(['.....', '.....', 'K...K', '.KKK.']),
  /** Shut in a smile. */
  happy: glyph(['.....', '.KKK.', 'K...K', '.....']),
};
/** Her mouth: small, soft and the same on both sides, in the picture's lip colours (drawn in a box seven pixels wide). */
const MOUTHS: Record<PictureMouth, Glyph> = {
  /** Her usual smile: lips together, the corners turned up. */
  smile: glyph(['.o...o.', '..rrr..', '.......']),
  closed: glyph(['.o...o.', '..rrr..', '.......']),
  /** A little open, mid-word. */
  open: glyph(['..rrr..', '..iii..', '...r...']),
  /** Wide open: laughing, or a big vowel. */
  wide: glyph(['.orrro.', '..iii..', '..rgr..']),
  /** A small round "oh". */
  oh: glyph(['...r...', '..rir..', '...r...']),
};

const NOSE = fromPicture(T.nose[0] - 1, T.nose[1] - 2, 2, 3);

/** Draw a glyph with its top-left corner at (x, y), but only on the skin of her face. */
function stamp(pixels: Int32Array, shape: Glyph, x: number, y: number): void {
  shape.forEach((row, j) =>
    row.forEach((color, i) => {
      const at = (y + j) * W + x + i;
      if (color !== NONE && inside(x + i, y + j) && SKIN_AREA[at]) pixels[at] = color;
    }),
  );
}

/** Which shape each eye takes for a way of looking: [the eye on the left, the eye on the right]. */
const EYES: Record<PictureEyes, readonly [EyeShape, EyeShape]> = {
  open: ['open', 'open'],
  half: ['half', 'half'],
  down: ['down', 'down'],
  closed: ['closed', 'closed'],
  happy: ['happy', 'happy'],
  left: ['left', 'left'],
  right: ['right', 'right'],
  wink: ['open', 'happy'],
};

const BLUSH = 0xe8563c;

/** The picture with her figure shaded and its own eyes and mouth wiped to bare skin, ready for a fresh face each frame. */
const BARE = PICTURE.slice();
shapeFigure(BARE);
// Each wiped pixel takes the colour of the skin just below its box, so the shading at the sides of
// her face carries on up through where the features were: nothing shows when her eyes are shut.
for (const [x, y, w, h] of T.wipe) {
  for (let i = 0; i < w; i++) {
    const below = (y + h) * W + x + i;
    const skin = SKIN_AREA[below] ? PICTURE[below] : SKIN;
    for (let j = 0; j < h; j++) if (SKIN_AREA[(y + j) * W + x + i]) BARE[(y + j) * W + x + i] = skin;
  }
}

// The brow over one eye, mirrored over the other.
{
  const [x, y, w] = T.brow;
  for (let i = 0; i < w; i++) BARE[y * W + T.eyeRight[0] + 4 - (x + i - T.eyeLeft[0])] = PICTURE[y * W + x + i];
}

/** The sequins on her sweater: pixels much brighter than the knit around them. */
const SEQUINS: number[] = [];
CLOTH.forEach((on, i) => on && (lightness(PICTURE[i]) > 78 || isWarm(PICTURE[i])) && SEQUINS.push(i));

/* ───────────────────────────── Hands and what they hold ───────────────────────────── */

const HAND_INK = { s: SKIN, h: 0xfeb774, d: 0xeb6f3c };
const HAND_LINE = 0x6d2420;

/**
 * Hand shapes, drawn for the arm on the right of the picture (the other arm mirrors them).
 * `wrist` is the cell of the shape that sits on the end of her forearm.
 */
const HANDS: Record<PictureHandShape, { rows: readonly string[]; wrist: readonly [number, number] }> = {
  open: { rows: ['....h....', '..h.s.h..', '..s.s.s.h', '..s.s.s.s', '..sdsdsds', 'h.sssssss', 's.sssssss', 'sdsssssss', '.ssssssss', '..ssssss.'], wrist: [5, 10] },
  finger: { rows: ['..h....', '..s....', '..s....', '..s....', '..sdsds', '.ssssss', 'sssssss', 'sdsssss', '.sssss.'], wrist: [3, 9] },
  point: { rows: ['.ssss.....', 'sssssssssh', 'sssssdddd.', 'ssdsds....', 'ssssss....', '.ssss.....'], wrist: [1, 5] },
  hold: { rows: ['s.........s', 'ss.......ss', '.sdsssssds.', '..sssssss..'], wrist: [9, 4] },
  sweep: { rows: ['.hssssssss', 'sssdsdssss', '.ssssssss.'], wrist: [10, 1] },
  heart: { rows: ['..hss...', '.sssss..', 'sdsdsss.', 'ssssssss', '.sssssss', '...ssss.'], wrist: [7, 5] },
};

/** A painter working in the portrait's own coordinates, on a frame with room around it. */
class Sheet {
  readonly p = new Pix(PICTURE_FRAME.w, PICTURE_FRAME.h);

  set(x: number, y: number, color: number): void {
    this.p.set(PAD_X + Math.round(x), PAD_TOP + Math.round(y), color);
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    this.p.rect(PAD_X + Math.round(x), PAD_TOP + Math.round(y), w, h, color);
  }

  ball(cx: number, cy: number, rx: number, ry: number, ramp: readonly number[], seed = 0): void {
    this.p.ball(PAD_X + cx, PAD_TOP + cy, rx, ry, ramp, 0.02, seed);
  }
}

/** Things that sit in her cupped palm. (x, y) is the middle of the palm; each grows upward from there. */
const ITEMS: Record<PictureItem, (s: Sheet, x: number, y: number, look: number, tick: number) => void> = {
  sprout: (s, x, y, look, tick) => {
    s.rect(x - 4, y - 5, 9, 5, PAL.copper[2]);
    s.rect(x - 4, y - 5, 2, 5, PAL.copper[3]);
    s.rect(x + 3, y - 5, 2, 5, PAL.copper[1]);
    s.rect(x - 5, y - 6, 11, 1, PAL.copper[3]);
    s.rect(x - 4, y - 6, 9, 1, PAL.soil[1]);
    // The seedling leans a little from side to side as it grows.
    const lean = look && tick % 12 < 6 ? 1 : 0;
    const tall = 2 + look * 3;
    for (let i = 0; i < tall; i++) s.set(x + (i > tall / 2 ? lean : 0), y - 7 - i, PAL.leaf[3]);
    for (let i = 0; i <= look; i++) {
      const ly = y - 8 - i * 3;
      const lx = x + (i > 0 ? lean : 0);
      s.rect(lx - 3 - (i % 2), ly, 3 + (i % 2), 1, PAL.leaf[4]);
      s.set(lx - 2, ly - 1, PAL.leaf[5]);
      s.rect(lx + 1, ly - 1, 3 + (i % 2), 1, PAL.leaf[4]);
      s.set(lx + 2, ly - 2, PAL.leaf[5]);
    }
  },
  bush: (s, x, y) => {
    s.ball(x + 0.5, y - 7, 8, 6.5, PAL.leaf.slice(1), 5);
    s.ball(x - 4, y - 4, 4.5, 3.6, PAL.leaf.slice(1), 6);
    s.ball(x + 5, y - 4, 4, 3.2, PAL.leaf.slice(1), 7);
    for (const [dx, dy] of [[-4, -8], [2, -6], [5, -10], [-1, -3], [-6, -4]]) {
      s.set(x + dx, y + dy, PAL.red[3]);
      s.set(x + dx + 1, y + dy, PAL.red[2]);
    }
  },
  sproutling: (s, x, y, look, tick) => {
    // It bobs when it is happy, and its leaf flicks.
    const up = look && tick % 6 < 3 ? 1 : 0;
    s.ball(x + 0.5, y - 5 - up, 5.5, 5.5 - up * 0.4, PAL.grass.slice(1), 7);
    s.ball(x + 0.5, y - 3.5 - up, 3.2, 2.6, [PAL.cream[2], PAL.cream[3], PAL.cream[3]], 8);
    for (const ex of [x - 2, x + 2]) {
      if (look) {
        s.set(ex - 1, y - 6 - up, PAL.ink);
        s.set(ex, y - 7 - up, PAL.ink);
        s.set(ex + 1, y - 6 - up, PAL.ink);
      } else s.rect(ex, y - 7, 1, 2, PAL.ink);
    }
    s.set(x - 4, y - 4 - up, PAL.pink[2]);
    s.set(x + 4, y - 4 - up, PAL.pink[2]);
    s.rect(x, y - 13 - up, 1, 3, PAL.leaf[2]);
    const flick = tick % 10 < 5 ? 0 : 1;
    s.rect(x - 3, y - 14 - up + flick, 3, 1, PAL.leaf[4]);
    s.rect(x + 1, y - 15 - up - flick, 3, 1, PAL.leaf[5]);
  },
  book: (s, x, y, look) => {
    s.rect(x - 10, y - 2, 21, 2, PAL.blue[1]);
    s.rect(x - 9, y - 8, 9, 7, PAL.cream[3]);
    s.rect(x + 1, y - 8, 9, 7, PAL.cream[3]);
    s.rect(x, y - 8, 1, 7, PAL.cream[1]);
    for (let row = 0; row < 3; row++) {
      s.rect(x - 8, y - 7 + row * 2, 6 - (row === 2 ? 2 : 0), 1, PAL.cream[1]);
      s.rect(x + 3, y - 7 + row * 2, 6 - (row === 1 ? 2 : 0), 1, PAL.cream[1]);
    }
    if (look) {
      // A page caught mid-turn.
      s.rect(x, y - 12, 1, 5, PAL.cream[3]);
      s.rect(x + 1, y - 11, 2, 4, PAL.cream[2]);
      s.rect(x + 3, y - 10, 1, 2, PAL.cream[2]);
    }
  },
  map: (s, x, y, look) => {
    s.rect(x - 10, y - 12, 21, 11, PAL.sand[3]);
    s.rect(x - 11, y - 13, 2, 13, PAL.sand[1]);
    s.rect(x + 10, y - 13, 2, 13, PAL.sand[1]);
    s.rect(x - 7, y - 10, 5, 3, PAL.leaf[4]);
    s.rect(x - 6, y - 11, 3, 1, PAL.leaf[4]);
    s.rect(x - 8, y - 5, 4, 2, PAL.magic[2]);
    for (const [dx, dy] of [[-1, -5], [1, -4], [3, -5], [5, -7]]) s.set(x + dx, y + dy, PAL.bark[2]);
    const mark = look ? PAL.red[3] : PAL.red[1];
    for (let i = -1; i <= 1; i++) {
      s.set(x + 6 + i, y - 9 + i, mark);
      s.set(x + 6 + i, y - 9 - i, mark);
    }
  },
  glass: (s, x, y, _look, tick) => {
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 5.4) s.set(x + dx, y - 11 + dy, d > 4.1 ? PAL.gold[2] : PAL.magic[4]);
      }
    }
    // A glint that slides across the lens.
    const slide = tick % 16 < 8 ? 0 : 1;
    s.set(x - 2 + slide, y - 13, PAL.white);
    s.set(x - 1 + slide, y - 14, PAL.white);
    s.rect(x, y - 5, 2, 5, PAL.wood[2]);
    s.rect(x, y - 5, 1, 5, PAL.wood[3]);
  },
  token: (s, x, y, look) => {
    s.ball(x + 0.5, y - 7, 6.2, 6.2, PAL.gold, 9);
    for (let i = 0; i < 4; i++) s.rect(x - i, y - 11 + i * 2, 1 + i * 2, 2, i % 2 ? PAL.pine[2] : PAL.pine[3]);
    s.rect(x, y - 3, 1, 1, PAL.bark[1]);
    if (look) {
      s.set(x - 3, y - 11, PAL.white);
      s.set(x - 2, y - 12, PAL.white);
      s.set(x - 4, y - 10, PAL.white);
    }
  },
};

/* ───────────────────────────── Her arms ───────────────────────────── */

type Point = readonly [number, number];

/**
 * One length of sleeve from `from` to `to`, rounded at both ends, with the picture's dark line
 * down each side. `behind` marks pixels it must not cover (her hair and face); `cuff` ends it in a cuff.
 */
function sleeve(s: Sheet, from: Point, to: Point, behind: Uint8Array | null, cuff: boolean, along: number): void {
  const half = T.sleeveWidth / 2;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 0.01;
  const ux = (to[0] - from[0]) / length;
  const uy = (to[1] - from[1]) / length;
  for (let y = Math.floor(Math.min(from[1], to[1]) - half - 1); y <= Math.ceil(Math.max(from[1], to[1]) + half + 1); y++) {
    for (let x = Math.floor(Math.min(from[0], to[0]) - half - 1); x <= Math.ceil(Math.max(from[0], to[0]) + half + 1); x++) {
      const px = x - from[0];
      const py = y - from[1];
      const t = Math.max(0, Math.min(length, px * ux + py * uy));
      const distance = Math.hypot(px - ux * t, py - uy * t);
      if (distance > half) continue;
      if (behind && inside(x, y) && behind[y * W + x]) continue;
      const across = py * ux - px * uy;
      let color = distance > half - 1 ? SLEEVE_EDGE : knit(across, t + along);
      // A ribbed cuff where the sleeve ends.
      if (cuff && t > length - 2.4 && distance <= half - 1) color = (Math.round(across) & 1) === 0 ? SLEEVE_LIGHT : SLEEVE_MID;
      s.set(x, y, color);
    }
  }
}

/** One arm away from her side: upper arm, forearm, hand, and whatever the hand holds. */
function drawArm(s: Sheet, side: 'right' | 'left', arm: PictureArm, lift: number, behind: Uint8Array, tick: number): void {
  const shoulder: Point = [T.arms[side].shoulder[0], T.arms[side].shoulder[1] + lift];
  const elbow: Point = [arm.elbow[0], arm.elbow[1] + lift];
  const wrist: Point = [arm.wrist[0], arm.wrist[1] + lift];
  // Her upper arm comes out from under her hair; her forearm and hand pass in front of everything.
  sleeve(s, shoulder, elbow, behind, false, 0);
  sleeve(s, elbow, wrist, null, true, 20);

  const hand = HANDS[arm.does];
  const mirror = side === 'left';
  const top = new Sheet();
  const wx = Math.round(wrist[0]);
  const wy = Math.round(wrist[1]);
  const at = (i: number) => (mirror ? wx + hand.wrist[0] - i : wx - hand.wrist[0] + i);
  hand.rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && top.set(at(i), wy - hand.wrist[1] + j, HAND_INK[ch as keyof typeof HAND_INK])));
  if (arm.holds) ITEMS[arm.holds](top, at(5), wy - hand.wrist[1] + 2, arm.look ?? 0, tick);
  // The same dark line the picture draws around her.
  top.p.outline(HAND_LINE);
  s.p.blit(top.p, 0, 0);
}

/* ───────────────────────────── Marks in the air ───────────────────────────── */

/** A four-pointed sparkle that swells and shrinks. `size` runs 0 (a dot) to 3. */
function sparkle(s: Sheet, x: number, y: number, size: number): void {
  if (size <= 0) return s.set(x, y, PAL.gold[3]);
  const reach = size >= 3 ? 3 : size;
  for (let i = 1; i <= reach; i++) for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) s.set(x + dx, y + dy, i === reach ? PAL.gold[2] : PAL.gold[3]);
  if (size >= 2) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) s.set(x + dx, y + dy, PAL.gold[3]);
  s.set(x, y, PAL.white);
}

const HEART_BIG = ['.pp.pp.', 'pPppppp', 'ppppppp', '.ppppp.', '..ppp..', '...p...'];
const HEART_SMALL = ['p.p', 'ppp', '.p.'];

function heart(s: Sheet, x: number, y: number, small: boolean): void {
  const top = new Sheet();
  (small ? HEART_SMALL : HEART_BIG).forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && top.set(x + i, y + j, ch === 'P' ? PAL.pink[4] : PAL.pink[2])));
  top.p.outline(PAL.pink[0]);
  s.p.blit(top.p, 0, 0);
}

const SPARKLES = [
  [[1, 8], [66, 12], [-2, 44], [52, -2]],
  [[62, 2], [-3, 22], [67, 46], [10, -3]],
];
const DROPS = [[30, 48], [35, 45], [41, 49], [46, 45], [52, 48], [57, 45]];

const FX: Record<TeacherFx, (s: Sheet, look: number, tick: number, pose: PicturePose) => void> = {
  sparkle: (s, look, tick) => {
    SPARKLES[look % 2].forEach(([x, y], k) => sparkle(s, x, y, [1, 2, 3, 2, 1, 0][(tick + k * 2) % 6]));
  },
  hearts: (s, look, tick) => {
    // Hearts drift up beside her, shrinking as they go; a new one sets off as the gesture goes on.
    [[53, 30], [4, 34], [56, 14], [7, 16]].slice(0, look + 1).forEach(([x, y], k) => {
      const step = (tick + k * 5) % 14;
      heart(s, x + (step % 8 < 4 ? 0 : 1), y - step, step > 9);
    });
  },
  drops: (s, _look, tick, pose) => {
    const hand = pose.right ? pose.right.wrist[0] - 5 : -99;
    DROPS.forEach(([x, y], k) => {
      // A drop the hand has reached is swept up in a little flash.
      if (Math.abs(x - hand) < 5) return sparkle(s, x, y, 1);
      const bobbing = (tick + k * 3) % 8 < 4 ? 0 : 1;
      s.rect(x, y + bobbing, 2, 2, PAL.magic[2]);
      s.set(x, y - 1 + bobbing, PAL.magic[3]);
      s.set(x, y + bobbing, (tick + k) % 5 === 0 ? PAL.white : PAL.magic[4]);
      s.set(x + 1, y + 2 + bobbing, PAL.magic[1]);
    });
  },
  leaves: (s, look, tick, pose) => {
    const [cx, cy] = pose.right ? [pose.right.wrist[0] - 5, pose.right.wrist[1] - 10] : [39, 50];
    for (let k = 0; k < 7; k++) {
      const step = (tick + look + k * 3) % 9;
      const angle = k * 0.9 - 0.4;
      const x = cx + Math.cos(angle) * (5 + step * 1.5);
      const y = cy - Math.abs(Math.sin(angle)) * (4 + step) + step * step * 0.14;
      s.rect(x, y, 2, 1, PAL.leaf[k % 2 ? 4 : 5]);
      s.set(x + (step % 2), y + 1, PAL.leaf[3]);
    }
  },
  tap: (s, look, _tick, pose) => {
    if (!pose.right) return;
    const x = pose.right.wrist[0] - 1;
    const y = pose.right.wrist[1] - 11;
    const out = look ? 3 : 1;
    for (const [dx, dy] of [[-2 - out, -out], [0, -2 - out], [2 + out, -out]]) {
      s.set(x + dx, y + dy, PAL.gold[2]);
      s.set(x + dx + Math.sign(dx), y + dy - 1, PAL.gold[3]);
    }
    if (look) s.set(x, y - 2, PAL.white);
  },
};

/* ───────────────────────────── Putting her together ───────────────────────────── */

const [BREATH_EVERY, BREATH_IN] = [34, 15];
const BODY_LINE = 0x20122b;

/**
 * Take an arm out of the picture and draw the side of her body it was covering: her own dark
 * line, following TEACHER_PICTURE's `body` in to her waist and out to her hip, with sweater
 * knitted up to it and nothing beyond it.
 */
function liftArm(pixels: Int32Array, side: 'right' | 'left'): void {
  for (const i of ARM[side]) pixels[i] = NONE;
  const { body } = T.arms[side];
  const inward = side === 'right' ? -1 : 1;
  for (let y = body[0][0]; y < H; y++) {
    const line = body.filter(([from]) => from <= y).pop()![1];
    const row = y * W;
    // Her hair hangs in front of all this: wherever it does, the picture stays as it is.
    const mine = (x: number) => !WARM[row + x];
    for (const x of [line - inward, line - inward * 2]) if (mine(x)) pixels[row + x] = NONE;
    for (const x of [line + inward, line + inward * 2]) if (mine(x) && (pixels[row + x] === NONE || lightness(pixels[row + x]) < 34)) pixels[row + x] = knit(x - line, y);
    if (mine(line)) pixels[row + line] = BODY_LINE;
  }
}

/** Her face for this pose, drawn onto the bare picture. */
function drawFace(pixels: Int32Array, pose: PicturePose, eyes: PictureEyes, mouth: PictureMouth): void {
  const turn = Math.round(pose.turn ?? 0);
  if (pose.blush) for (const [x, y] of T.cheeks) pixels[y * W + x + turn] = blend(pixels[y * W + x + turn], BLUSH, 0.5);
  const [left, right] = EYES[eyes];
  // Her eyes reach from one side of her face to the other, so they stay put when it turns
  // (a shifted eye would be cut off by her cheek): her nose and mouth turn, and her gaze.
  stamp(pixels, EYE[left], T.eyeLeft[0], T.eyeLeft[1]);
  stamp(pixels, EYE[right], T.eyeRight[0], T.eyeRight[1]);
  stamp(pixels, NOSE, T.nose[0] - 1 + turn, T.nose[1] - 2);
  stamp(pixels, MOUTHS[mouth], T.mouth[0] + turn, T.mouth[1]);
}

/**
 * One frame of her. `tick` counts frames since she appeared: it drives everything that goes on by
 * itself (breathing, sequins catching the light). `eyes` and `mouth` override the
 * pose's own, for a blink or a word.
 */
export function paintPictureTeacher(pose: PicturePose, tick: number, eyes: PictureEyes = pose.eyes ?? 'open', mouth: PictureMouth = pose.mouth ?? 'smile'): Pix {
  const pixels = BARE.slice();
  for (const side of ['right', 'left'] as const) if (pose[side]) liftArm(pixels, side);

  // Sequins catch the light in turn: each flares up for a moment, then dims.
  SEQUINS.forEach((i, k) => {
    if (pixels[i] === NONE) return;
    const glint = Math.sin(tick * 0.55 + hash2(k, 7, 3) * 6.283);
    if (glint > 0.82) pixels[i] = blend(pixels[i], PAL.white, 0.45);
    else if (glint < -0.7) pixels[i] = blend(pixels[i], SLEEVE_MID, 0.55);
  });

  drawFace(pixels, pose, eyes, mouth);

  // Bend the picture: her head by its own amount, the rest by her breathing and bounce.
  const s = new Sheet();
  const [headX, headY] = pose.head ?? [0, 0];
  const lean = headX + (pose.tilt ?? 0);
  const bob = (pose.bob ?? 0) + (tick % BREATH_EVERY < BREATH_IN ? -1 : 0);
  const neck = T.shoulders - T.chin;
  const behind = new Uint8Array(W * H);
  /** How far the row at y rises or dips with her breathing and bounce: fully above `still`, not at all at the bottom edge. */
  const lift = (y: number) => Math.round(bob * clamp01((T.still - y) / 6));
  for (let y = 0; y < H; y++) {
    // Everything above her chin moves as one piece, so no line of pixels ever shears through her face.
    const withHead = clamp01((T.shoulders - y) / neck);
    const dx = Math.round(lean * withHead);
    const dy = Math.round(headY * withHead) + lift(y);
    for (let x = 0; x < W; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (!inside(sx, sy)) continue;
      const color = pixels[sy * W + sx];
      if (color === NONE) continue;
      s.set(x, y, color);
      behind[y * W + x] = WARM[sy * W + sx];
    }
  }

  if (pose.left) drawArm(s, 'left', pose.left, Math.round(bob), behind, tick);
  if (pose.right) drawArm(s, 'right', pose.right, Math.round(bob), behind, tick);
  if (pose.fx) FX[pose.fx[0]](s, pose.fx[1], tick, pose);
  return s.p;
}

/* ───────────────────────────── A gesture over time ───────────────────────────── */

/** Mouth shapes for a line being spoken, each held for two frames; 'smile' leaves the pose's own. */
const TALK: readonly PictureMouth[] = ['open', 'wide', 'open', 'closed', 'open', 'smile', 'closed', 'wide', 'open', 'closed', 'smile', 'open', 'closed'];
/** She blinks this often (in frames), and now and then twice in a row. */
const BLINK_EVERY = 37;
const BLINK: readonly (PictureEyes | null)[] = ['half', 'closed', 'half'];

/** The pose `n` frames into a gesture: it plays through once, then repeats from its loop point. */
export function picturePose(anim: TeacherAnimName, n: number): PicturePose {
  const { frames, loop } = PICTURE_ANIMS[anim];
  return frames[n < frames.length ? n : loop + ((n - loop) % (frames.length - loop))];
}

/** The frame `n` frames into a gesture, blinking by herself and, if `talking`, speaking. */
export function pictureFrame(anim: TeacherAnimName, n: number, talking = false): Pix {
  const pose = picturePose(anim, n);
  let eyes = pose.eyes ?? 'open';
  if (eyes === 'open' || eyes === 'left' || eyes === 'right') {
    const beat = (n + 14) % BLINK_EVERY;
    const twice = Math.floor((n + 14) / BLINK_EVERY) % 3 === 2;
    eyes = BLINK[beat] ?? (twice ? BLINK[beat - 4] : null) ?? eyes;
  }
  let mouth = pose.mouth ?? 'smile';
  if (talking) {
    const word = TALK[(n >> 1) % TALK.length];
    if (word !== 'smile') mouth = mouth === 'oh' && word === 'wide' ? 'oh' : word;
  }
  return paintPictureTeacher(pose, n, eyes, mouth);
}
