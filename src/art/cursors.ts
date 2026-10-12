import { PAL } from '@/config/palette';
import { Pix } from '@/engine/pix';

/**
 * The mouse pointers. Each is a hand-drawn grid (one character per pixel) with an optional small
 * badge in its lower-right corner saying what a click will do, so the pointer itself tells the
 * player what they are over. They are turned into CSS `cursor` values at boot.
 */

/** How much the pointers are magnified on screen. */
const CURSOR_SCALE = 2;

/** Character → colour. `k` is the outline, `w` the glove. */
const INKS: Record<string, number> = {
  k: PAL.outline,
  w: PAL.cream[3],
  c: PAL.cream[1],
  b: PAL.magic[2],
  B: PAL.magic[4],
  r: PAL.pink[2],
  R: PAL.pink[4],
  g: PAL.leaf[3],
  G: PAL.leaf[5],
  y: PAL.gold[2],
  Y: PAL.gold[4],
  s: PAL.grassWinter[2],
};

/** The shapes a pointer can take. */
const SHAPES: Record<string, readonly string[]> = {
  arrow: [
    'k',
    'kk',
    'kwk',
    'kwwk',
    'kwwwk',
    'kwwwwk',
    'kwwwwwk',
    'kwwwwwwk',
    'kwwwwwwwk',
    'kwwwwwkkkk',
    'kwwkwwk',
    'kwk.kwwk',
    'kk..kwwk',
    'k....kwwk',
    '.....kwwk',
    '......kk',
  ],
  point: [
    '.....kk.......',
    '....kwwk......',
    '....kwwk......',
    '....kwwk......',
    '....kwwkkk....',
    '....kwwkwwkk..',
    '.kk.kwwkwwkwk.',
    'kwwkkwwwwwwwwk',
    'kwwwkwwwwwwwwk',
    '.kwwwwwwwwwwwk',
    '..kwwwwwwwwwwk',
    '..kwwwwwwwwwk.',
    '...kwwwwwwwwk.',
    '....kcwwwwck..',
    '....kkkkkkkk..',
  ],
  /** The same finger, pressed down a little. */
  press: [
    '..............',
    '..............',
    '.....kk.......',
    '....kwwk......',
    '....kwwkkk....',
    '....kwwkwwkk..',
    '.kk.kwwkwwkwk.',
    'kwwkkwwwwwwwwk',
    'kwwwkwwwwwwwwk',
    '.kwwwwwwwwwwwk',
    '..kwwwwwwwwwwk',
    '..kwwwwwwwwwk.',
    '...kwwwwwwwwk.',
    '....kcwwwwck..',
    '....kkkkkkkk..',
  ],
  open: [
    '....kk.kk......',
    '...kwwkwwkkk...',
    '...kwwkwwkwwk..',
    '.kkkwwkwwkwwk..',
    'kwwkwwkwwkwwkk.',
    'kwwkwwwwwwwwkwk',
    'kwwkwwwwwwwwwwk',
    '.kwwwwwwwwwwwwk',
    '.kwwwwwwwwwwwwk',
    '..kwwwwwwwwwwk.',
    '..kwwwwwwwwwwk.',
    '...kwwwwwwwwk..',
    '....kcwwwwck...',
    '....kkkkkkkk...',
  ],
  fist: [
    '...............',
    '...............',
    '...............',
    '....kk.kk.kk...',
    '...kwwkwwkwwkk.',
    '..kkwwkwwkwwkwk',
    '.kwkccwccwccwwk',
    '.kwwwwwwwwwwwwk',
    '.kwwwwwwwwwwwwk',
    '..kwwwwwwwwwwk.',
    '..kwwwwwwwwwwk.',
    '...kwwwwwwwwk..',
    '....kcwwwwck...',
    '....kkkkkkkk...',
  ],
  glass: [
    '...kkkk.......',
    '..kyyyyk......',
    '.kysssByk.....',
    'kysBsssByk....',
    'kysssssByk....',
    'kysssssByk....',
    'kyBsssBByk....',
    '.kyBBBByk.....',
    '..kyyyyykk....',
    '...kkkkyyk....',
    '.......kyyk...',
    '........kyyk..',
    '.........kyyk.',
    '..........kkk.',
  ],
};

/** Small marks added to a pointer's lower-right corner. */
const BADGES: Record<string, readonly string[]> = {
  drop: ['...k...', '..kbk..', '..kbk..', '.kbBbk.', '.kbbbk.', '.kbbbk.', '..kkk..'],
  heart: ['.kk.kk.', 'krRkrrk', 'krrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'],
  leaf: ['....kk.', '..kkgGk', '.kgGGgk', '.kgGggk', 'kgGggk.', 'kkggk..', 'k.kk...'],
  star: ['...k...', '..kyk..', '.kyYyk.', 'kyYYYyk', '.kyYyk.', '..kyk..', '...k...'],
  cloud: ['..kkk..', '.kwwwkk', 'kwwwwwk', 'kwwwwwk', '.kkkkk.', '.b.b.b.', 'b.b.b..'],
};

interface CursorDef {
  shape: keyof typeof SHAPES;
  badge?: keyof typeof BADGES;
  /** The pixel that does the pointing, in the shape's own grid. */
  hot: [number, number];
  /** What the browser shows if the picture cannot be used. */
  fallback: string;
}

/**
 * Every pointer in the game, by name. The interface uses `arrow` and `point`; the world picks the
 * rest by what is under the mouse (see World.cursorAt). A name ending in `-on` is that pointer's
 * look for the moment something is actually happening (a click, a carry).
 */
const CURSORS = {
  arrow: { shape: 'arrow', hot: [0, 0], fallback: 'default' },
  point: { shape: 'point', hot: [5, 0], fallback: 'pointer' },
  'point-on': { shape: 'press', hot: [5, 2], fallback: 'pointer' },
  // The world.
  pan: { shape: 'open', hot: [7, 6], fallback: 'grab' },
  'pan-on': { shape: 'fist', hot: [7, 7], fallback: 'grabbing' },
  spring: { shape: 'point', badge: 'drop', hot: [5, 0], fallback: 'pointer' },
  'spring-on': { shape: 'press', badge: 'drop', hot: [5, 2], fallback: 'pointer' },
  sweep: { shape: 'open', badge: 'drop', hot: [7, 6], fallback: 'grab' },
  shake: { shape: 'open', badge: 'leaf', hot: [7, 6], fallback: 'pointer' },
  'shake-on': { shape: 'fist', badge: 'leaf', hot: [7, 7], fallback: 'pointer' },
  pet: { shape: 'open', badge: 'heart', hot: [7, 6], fallback: 'pointer' },
  'pet-on': { shape: 'fist', badge: 'heart', hot: [7, 7], fallback: 'pointer' },
  cloud: { shape: 'open', badge: 'cloud', hot: [7, 6], fallback: 'grab' },
  'cloud-on': { shape: 'fist', badge: 'cloud', hot: [7, 7], fallback: 'grabbing' },
  find: { shape: 'point', badge: 'star', hot: [5, 0], fallback: 'pointer' },
  'find-on': { shape: 'press', badge: 'star', hot: [5, 2], fallback: 'pointer' },
  look: { shape: 'glass', hot: [4, 4], fallback: 'help' },
} satisfies Record<string, CursorDef>;

export type CursorName = keyof typeof CURSORS;

const GRID = 16;
const BADGE_AT = 9;

function stamp(p: Pix, rows: readonly string[], x: number, y: number): void {
  rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && p.set(x + i, y + j, INKS[ch] ?? PAL.white)));
}

function paint(def: CursorDef): string {
  const p = new Pix(GRID, GRID);
  stamp(p, SHAPES[def.shape], 0, 0);
  if (def.badge) stamp(p, BADGES[def.badge], BADGE_AT, BADGE_AT);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GRID * CURSOR_SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p.toCanvas(), 0, 0, canvas.width, canvas.height);
  // Just the picture and its hot spot: whoever uses it adds the plain pointer to fall back on (CSS allows only one).
  return `url(${canvas.toDataURL()}) ${def.hot[0] * CURSOR_SCALE} ${def.hot[1] * CURSOR_SCALE}`;
}

/** The CSS variable holding a pointer, for use as `cursor: var(--cur-name)`. */
export const cursorVar = (name: CursorName) => `--cur-${name}`;

/** A complete CSS `cursor` value for a pointer. */
export const cursorCss = (name: CursorName) => `var(${cursorVar(name)}), ${CURSORS[name].fallback}`;

/** The look a pointer takes while it is doing its job (the same pointer if it has no such look). */
export const pressed = (name: CursorName): CursorName => (`${name}-on` in CURSORS ? (`${name}-on` as CursorName) : name);

/** Paint every pointer. Returns CSS custom properties (name → picture and hot spot, used as `cursor: var(--cur-name), fallback`). */
export function buildCursors(): Record<string, string> {
  return Object.fromEntries((Object.keys(CURSORS) as CursorName[]).map((name) => [cursorVar(name), paint(CURSORS[name])]));
}
