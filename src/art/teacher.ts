import { PAL } from '@/config/palette';
import { TEACHER, TEACHER_LOOKS, teacherFrame, teacherIsPicture, type TeacherAnim, type TeacherAnimName, type TeacherEyes, type TeacherFx, type TeacherItem, type TeacherLook, type TeacherMouth, type TeacherPose } from '@/config/teacher';
import type { Atlas } from '@/engine/atlas';
import { Pix, shade, type Ramp } from '@/engine/pix';
import { ink } from './kit';
import { PICTURE_FRAME, pictureFrame } from './teacherPicture';

/**
 * Claudia, the teacher, in one of the drawn looks: a head-and-shoulders portrait painted fresh
 * for every pose in config/teacher.ts. (The look made from a picture, which is the one the game
 * uses, lives in art/teacherPicture.ts.) She is drawn in the portrait's own coordinates (centred
 * on x = CX) on a canvas with room around it for raised hands and a tossed hat.
 *
 * The portrait is built the way a pixel artist would layer it: hair behind, shoulders, face,
 * features, the hair that falls in front, hat, then hands and whatever they hold.
 */

const W = TEACHER.portrait.w;
const H = TEACHER.portrait.h;
const PAD_X = 16;
const PAD_TOP = 14;
const CX = W / 2;

const SKIN: Ramp = PAL.skin;
const SILVER: Ramp = PAL.metal;
const HAT: Ramp = PAL.night;
const LASH = PAL.woodDark[0];
const BROW = PAL.wood[1];
const LIPS: Ramp = PAL.blossom;
const MOUTH = PAL.red[0];

/* ───────────────────────────── What each choice in a look means ───────────────────────────── */

const HAIRS: Record<TeacherLook['hair'], Ramp> = { gold: PAL.gold, honey: PAL.honey, blonde: PAL.blonde, copper: PAL.copper };
/** The iris from its shaded top to its light lower edge. */
const IRISES: Record<TeacherLook['iris'], Ramp> = {
  blue: PAL.blue.slice(1, 4),
  grey: PAL.frost.slice(0, 3),
  green: [PAL.leaf[1], PAL.leaf[3], PAL.leaf[4]],
  brown: [PAL.wood[0], PAL.wood[2], PAL.wood[3]],
};
/** Dress colours, from the folds to where the light catches. */
const OUTFITS: Record<TeacherLook['outfit'], Ramp> = { pink: PAL.pink.slice(1), blue: PAL.blue.slice(0, 4), teal: PAL.roofTeal.slice(1), lilac: PAL.lilac.slice(1) };
const RIMS: Record<TeacherLook['rim'], number> = { brown: PAL.woodDark[2], gold: PAL.gold[1], navy: PAL.night[1] };
/**
 * Face shapes: half the width of the cheeks, where the chin ends, and how long the cheeks stay
 * full before narrowing (higher = rounder). All are slim, so her hair looks big around her face.
 */
const FACES: Record<TeacherLook['face'], { wide: number; bottom: number; soft: number }> = {
  slim: { wide: 11.2, bottom: 45, soft: 2.0 },
  oval: { wide: 11.8, bottom: 46, soft: 2.3 },
  heart: { wide: 11.6, bottom: 46, soft: 1.7 },
};

/** A painter working in portrait coordinates, carrying the look being painted. */
class Sheet {
  readonly p = new Pix(W + PAD_X * 2, H + PAD_TOP + 4);
  readonly hair: Ramp;
  readonly dress: Ramp;
  readonly iris: Ramp;
  /** Locks are this much wider or narrower than usual. */
  readonly body: number;

  constructor(readonly look: TeacherLook) {
    this.hair = HAIRS[look.hair];
    this.dress = OUTFITS[look.outfit];
    this.iris = IRISES[look.iris];
    this.body = look.waves === 'broad' ? 1.2 : 0.82;
  }

  set(x: number, y: number, color: number): void {
    this.p.set(PAD_X + x, PAD_TOP + y, color);
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    this.p.rect(PAD_X + Math.round(x), PAD_TOP + Math.round(y), w, h, color);
  }

  ball(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, seed = 0): void {
    this.p.ball(PAD_X + cx, PAD_TOP + cy, rx, ry, ramp, 0.02, seed);
  }

  /** Blend a colour into whatever is already painted (blush, the glint on a lens). */
  mix(x: number, y: number, color: number, amount: number): void {
    const px = PAD_X + Math.round(x);
    const py = PAD_TOP + Math.round(y);
    if (!this.p.solid(px, py)) return;
    const raw = this.p.d[py * this.p.w + px];
    const blend = (from: number, to: number) => Math.round(from + (to - from) * amount);
    this.p.set(px, py, (blend(raw & 0xff, (color >> 16) & 0xff) << 16) | (blend((raw >> 8) & 0xff, (color >> 8) & 0xff) << 8) | blend((raw >> 16) & 0xff, color & 0xff));
  }

  /** Stamp a small hand-drawn grid; each character names a colour in `inks`. `mirror` draws it right-to-left from x. */
  glyph(rows: readonly string[], x: number, y: number, inks: Record<string, number>, mirror = false): void {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch !== '.') this.set(mirror ? x - i : x + i, y + j, inks[ch]);
      });
    });
  }

  /** Remove everything below the portrait's lower edge. */
  trimBelow(y: number): void {
    for (let py = PAD_TOP + y + 1; py < this.p.h; py++) for (let px = 0; px < this.p.w; px++) this.p.clear(px, py);
  }

}

/* ───────────────────────────── Hair ───────────────────────────── */

/**
 * One lock of hair: a ribbon from (x0, y0) to (x1, y1) that waves as it goes and tapers to a
 * point. It is lit from the upper left: a bright band down the side facing the light, and a
 * single dark seam down the other, so locks laid side by side read as soft clumps rather than
 * stripes. `root` is how much of its length, from the start, is the darker colour of new growth.
 */
function lock(s: Sheet, x0: number, y0: number, x1: number, y1: number, width: number, sway: number, waves: number, phase: number, root = 0): void {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / length;
  const ny = (x1 - x0) / length;
  // Which side of the ribbon faces the light.
  const towards = -(nx * 0.8 + ny * 0.6) >= 0 ? 1 : -1;
  const steps = Math.ceil(length * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wave = Math.sin(t * Math.PI * 2 * waves + phase) * sway * (0.3 + t * 0.7);
    const cx = x0 + (x1 - x0) * t + nx * wave;
    const cy = y0 + (y1 - y0) * t + ny * wave;
    const half = ((width * s.body) / 2) * (t > 0.78 ? 0.3 + ((1 - t) / 0.22) * 0.7 : t < 0.1 ? 0.55 + (t / 0.1) * 0.45 : 1);
    for (let d = -half; d <= half; d += 0.5) {
      const side = (d / half) * towards;
      const level = side < -0.72 ? 1 : side > 0.2 ? (side > 0.42 && side < 0.82 && t > 0.14 && t < 0.52 ? 4 : 3) : 2;
      s.set(Math.round(cx + nx * d), Math.round(cy + ny * d), s.hair[t < root ? Math.max(0, level - 1) : level]);
    }
  }
}

/** A lock and its twin on the other side of her head. */
function locks(s: Sheet, hx: number, hy: number, x0: number, y0: number, x1: number, y1: number, width: number, sway: number, waves: number, phase: number): void {
  lock(s, x0 + hx, y0 + hy, x1 + hx, y1, width, sway, waves, phase);
  lock(s, W - 1 - x0 + hx, y0 + hy, W - 1 - x1 + hx, y1, width, sway, waves, phase + 1.4);
}

/** The mass of hair behind her head and shoulders. */
function backHair(s: Sheet, hx: number, hy: number): void {
  // A solid shape first, so no gaps show between the locks laid over it.
  for (let y = 7; y <= H - 1; y++) {
    const grow = Math.min(1, (y - 7) / 12);
    const half = 12 + grow * 10 + Math.max(0, y - 40) * 0.12;
    s.rect(Math.round(CX - half) + hx, y, Math.round(half * 2), 1, s.hair[2]);
  }
  locks(s, hx, hy, 12, 26, 4, H + 2, 8, 2.6, 1.2, 3.3);
  locks(s, hx, hy, 17, 12, 8, H + 4, 11, 2.8, 1.5, 0.4);
  locks(s, hx, hy, 22, 10, 15, H + 6, 10, 2.4, 1.3, 2.1);
  if (s.look.waves === 'fine') {
    locks(s, hx, hy, 19, 14, 11, H + 4, 7, 2.2, 1.6, 4.4);
    locks(s, hx, hy, 14, 20, 6, H + 2, 6, 2.4, 1.4, 5.2);
  }
  // Curls that turn outward where the hair ends.
  locks(s, hx, hy, 9, 40, 1, 54, 6, 1.6, 0.6, 0.8);
  locks(s, hx, hy, 8, 50, 2, 63, 5.5, 1.4, 0.6, 2.6);
}

/** The hair that falls in front: her fringe, in whichever style the look asks for, and a wavy lock down each side. */
function frontHair(s: Sheet, hx: number, hy: number): void {
  const py = 8 + hy;
  if (s.look.bangs === 'swept') {
    // Parted to one side: a long sweep across the forehead, and a short lock tucked back on the other.
    const px = CX + 6 + hx;
    lock(s, px, py, 15 + hx, 20 + hy, 7.5, 1, 0.5, 4, 0.2);
    lock(s, px, py, 18 + hx, 26 + hy, 8.5, 1.4, 0.55, 0.4, 0.2);
    lock(s, px, py + 1, 26 + hx, 20 + hy, 6, 0.9, 0.5, 2, 0.2);
    lock(s, px, py, W - 14 + hx, 20 + hy, 6.5, 0.9, 0.5, 1, 0.2);
  } else {
    // Parted in the middle, sweeping out to her temples and down past her brows to her cheekbones.
    const px = CX + hx;
    lock(s, px - 1, py, 14 + hx, 19 + hy, 7, 0.9, 0.5, 4, 0.22);
    lock(s, px + 1, py, W - 15 + hx, 19 + hy, 7, 0.9, 0.5, 1, 0.22);
    lock(s, px - 1, py, 18 + hx, 26 + hy, 8, 1.3, 0.55, 0.4, 0.2);
    lock(s, px + 1, py, W - 19 + hx, 26 + hy, 8, 1.3, 0.55, 2.4, 0.2);
    if (s.look.bangs === 'wispy') {
      // A few fine strands falling onto her forehead.
      for (const [x, y, phase] of [[24, 19, 0.3], [28, 18, 1.7], [35, 18, 3.1], [39, 19, 4.6]]) lock(s, px + (x < CX ? -1 : 1), py + 1, x + hx, y + hy, 3.4 / s.body, 0.6, 0.5, phase);
    }
  }
  locks(s, hx, hy, 17, 22, 14, 58, 7, 2.3, 1.5, 1.2);
}

/* ───────────────────────────── Face and clothes ───────────────────────────── */

function torso(s: Sheet): void {
  // A slim neck, in the soft shadow of her chin.
  s.rect(CX - 3, 43, 7, 10, SKIN[2]);
  s.rect(CX - 3, 43, 7, 5, SKIN[1]);
  s.rect(CX + 2, 48, 2, 5, SKIN[1]);
  // Narrow, sloping bare shoulders and chest, lit from the upper left.
  const widthAt = (y: number) => Math.min(19, 4.5 + (y - 49) * 3.3);
  for (let y = 49; y <= H - 1; y++) {
    const half = widthAt(y);
    for (let x = Math.round(CX - half); x <= Math.round(CX + half) - 1; x++) s.set(x, y, x + 0.5 - CX > 8 ? SKIN[1] : SKIN[2]);
  }
  // Collarbones, and the soft curve of her figure.
  s.rect(CX - 9, 52, 5, 1, SKIN[1]);
  s.rect(CX + 4, 52, 5, 1, SKIN[1]);
  s.ball(CX - 5.6, 59.5, 6.2, 5.4, SKIN.slice(1), 3);
  s.ball(CX + 5.6, 59.5, 6.2, 5.4, SKIN.slice(1), 4);
  s.rect(CX - 0.5, 55, 1, 5, SKIN[1]);

  // Her dress: a scooped neckline between two straps, shaded to follow her figure, with a pale trim and a few sequins.
  for (let y = 49; y <= H - 1; y++) {
    const half = widthAt(y);
    for (let x = Math.round(CX - half); x <= Math.round(CX + half) - 1; x++) {
      const dx = x + 0.5 - CX;
      const out = Math.abs(dx);
      if (out > 13.5) continue;
      const edge = out > 10 ? 50 : 60 - Math.min(1, out / 10.5) ** 1.8 * 7.5;
      if (y < edge) continue;
      const round = Math.max(0, 1 - Math.hypot((out - 5.6) / 7, (y - 60.5) / 6));
      const light = 0.4 - dx / 70 - (y - 52) / 44 + round * 0.24 - (out < 1.3 ? 0.2 : 0);
      s.set(x, y, y - edge < 1 ? s.dress[3] : (x * 7 + y * 13) % 29 === 0 && y > 57 ? PAL.white : shade(s.dress, light));
    }
  }
  // A little ruffle on each shoulder.
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) s.set(Math.round(CX + side * (14 + i)), 51 + j + Math.floor(i / 2), s.dress[1 + ((i + j) % 2)]);

  // A silver necklace with a drop.
  for (let i = -6; i <= 5; i++) s.set(CX + i, 48 + Math.round(3 * (1 - (i + 0.5) ** 2 / 36)), SILVER[i % 2 ? 3 : 4]);
  s.rect(CX - 1, 52, 2, 2, PAL.white);
  s.rect(CX - 1, 54, 2, 1, SILVER[3]);
}

/**
 * Her face: a slim oval that narrows smoothly into a small, soft chin. There is no drawn jaw line:
 * the chin shows against the shadow it throws on her neck, which keeps the whole face soft.
 */
function face(s: Sheet, hx: number, hy: number): void {
  const shape = FACES[s.look.face];
  for (let y = 13; y <= shape.bottom; y++) {
    const upper = (y - 28) / 15.5;
    const lower = (y - 31) / (shape.bottom + 0.7 - 31);
    const half = y <= 31 ? shape.wide * Math.sqrt(Math.max(0, 1 - upper * upper)) : shape.wide * 0.982 * Math.sqrt(Math.max(0, 1 - lower ** shape.soft));
    for (let x = Math.round(CX - half); x <= Math.round(CX + half) - 1; x++) {
      const u = (x + 0.5 - CX) / shape.wide;
      let color = SKIN[2];
      // Mostly one even tone: a narrow turn of shadow at the far edge and under the fringe, and light on the near cheek.
      if (u > 0.8 || y < 19 || y >= shape.bottom) color = SKIN[1];
      else if (u < -0.1 && u > -0.76 && y > 30 && y < 40) color = SKIN[3];
      s.set(x + hx, y + hy, color);
    }
  }
  // Nose: a touch of light down its bridge, a small shadow beside it and the hint of a nostril.
  s.rect(CX - 1 + hx, 31 + hy, 1, 3, SKIN[3]);
  s.set(CX + 1 + hx, 34 + hy, SKIN[1]);
  s.set(CX + 1 + hx, 35 + hy, SKIN[1]);
  s.set(CX + hx, 36 + hy, SKIN[1]);
  // Warm cheeks, softest at their edges.
  for (const cheek of [CX - 9, CX + 5]) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) s.mix(cheek + i + hx, 34 + j + hy, PAL.pink[2], (i === 0 || i === 3 ? 0.2 : 0.42) * (j === 1 ? 1 : 0.6));
}

type EyeLook = Exclude<TeacherEyes, 'wink'>;

/**
 * One eye, seven pixels across: a wing of lash at the outer corner (column 0), then six columns
 * of eye. `x` is the outer corner; a mirrored eye is drawn from there towards the nose.
 */
function eye(s: Sheet, x: number, y: number, look: EyeLook, mirror: boolean): void {
  const tall = s.look.eyes === 'big' ? 5 : 4;
  const put = (i: number, j: number, color: number) => s.set(mirror ? x - i : x + i, y + j, color);
  if (look === 'closed') {
    for (let i = 0; i <= 6; i++) put(i, i === 0 || i === 6 ? tall - 2 : tall - 1, LASH);
    put(0, tall - 1, LASH);
    return;
  }
  if (look === 'happy') {
    for (let i = 0; i <= 6; i++) put(i, Math.round(1 + ((i - 3) / 3) ** 2 * 2.2), LASH);
    return;
  }
  // Which way she looks moves the iris; mirrored eyes count columns the other way.
  const glance = look === 'left' ? -1 : look === 'right' ? 1 : 0;
  const from = 2 + (mirror ? -glance : glance);
  const drop = look === 'down' ? 1 : 0;
  // A thick upper lash that sweeps out into a wing at the outer corner.
  for (let i = 1; i <= 6; i++) put(i, 0, LASH);
  put(0, 1, LASH);
  // The white of the eye (shaded by the lid along its top, rounded off below), showing on both sides of the iris.
  for (let j = 1; j <= tall; j++) {
    for (let i = 1; i <= 6; i++) if (j < tall || (i > 1 && i < 6)) put(i, j, j === 1 ? PAL.grassWinter[2] : PAL.white);
  }
  // A large iris, four pixels wide: dark under the lid, lighter towards its lower edge.
  for (let j = 1 + drop; j <= tall; j++) {
    for (let i = from; i < from + 4; i++) if (i >= 1 && i <= 6) put(i, j, j === 1 + drop ? s.iris[0] : j === tall ? s.iris[2] : s.iris[1]);
  }
  for (let j = 2 + drop; j <= Math.min(3 + drop, tall - 1); j++) for (let i = from + 1; i <= from + 2; i++) put(i, j, PAL.night[0]);
  // The catch-light sits on the side the light comes from, whichever eye this is.
  put(mirror ? from + 3 : from, 2 + drop, PAL.white);
  for (let i = 2; i <= 5; i++) put(i, tall + 1, SKIN[1]);
}

const MOUTHS: Record<TeacherMouth, readonly string[]> = {
  smile: ['c....c', '.uuuu.', '.dddd.', '..lL..'],
  grin: ['c....c', 'uuuuuu', '.wwww.', '.mmmm.', '..ll..'],
  open: ['.uuuu.', '.mmmm.', '.mttm.', '..ll..'],
  oh: ['..uu..', '.ummu.', '.ummu.', '..ll..'],
};
const MOUTH_INKS = { c: LIPS[0], u: LIPS[1], d: LIPS[0], l: LIPS[2], L: LIPS[3], w: PAL.white, m: MOUTH, t: LIPS[2] };

function features(s: Sheet, pose: TeacherPose, mouth: TeacherMouth, hx: number, hy: number): void {
  const eyes = pose.eyes ?? 'open';
  const big = s.look.eyes === 'big';
  const eyeY = (big ? 26 : 27) + hy;
  const browY = (big ? 22 : 23) - (pose.brows ?? 0) + hy;
  // Brows: a fine arch over each eye, lower at its outer end.
  for (let i = 0; i < 7; i++) {
    const lift = i < 2 ? 1 : 0;
    s.set(CX - 10 + i + hx, browY + lift, BROW);
    s.set(CX + 9 - i + hx, browY + lift, BROW);
  }
  eye(s, CX - 10 + hx, eyeY, eyes === 'wink' ? 'open' : eyes, false);
  eye(s, CX + 9 + hx, eyeY, eyes === 'wink' ? 'happy' : eyes, true);

  // Glasses: one-pixel rims around each eye, joined over the nose, with arms running back into her hair and a glint on each lens.
  const rim = RIMS[s.look.rim];
  const [rx, ry] = s.look.glasses === 'oval' ? [5.9, 4.7] : [5.4, 5.4];
  for (const c of [CX - 6.5, CX + 5.5]) {
    for (let py = 22; py <= 36; py++) {
      for (let px = Math.floor(c - 8); px <= Math.ceil(c + 8); px++) {
        const d = Math.hypot((px - c) / rx, (py - 29) / ry);
        if (d > 0.84 && d <= 1) s.set(px + hx, py + hy, rim);
      }
    }
    s.mix(c - 2 + hx, 26 + hy, PAL.white, 0.5);
    s.mix(c - 3 + hx, 27 + hy, PAL.white, 0.5);
  }
  s.rect(CX - 1 + hx, 28 + hy, 2, 1, rim);
  s.rect(CX - 13 + hx, 28 + hy, 2, 1, rim);
  s.rect(CX + 11 + hx, 28 + hy, 2, 1, rim);

  s.glyph(MOUTHS[mouth], CX - 3 + hx, 39 + hy, MOUTH_INKS);
}

/** Her mortarboard. (x, y) is the middle of the band's lower edge; `small` is the one she holds in her hand. */
function hat(s: Sheet, x: number, y: number, swing: number, small = false): void {
  const rows: [number, number, number][] = small
    ? [[3, -7, 3], [8, -6, 2], [12, -5, 2], [8, -4, 1], [6, -3, 1], [6, -2, 1], [6, -1, 0]]
    : [[4, -9, 3], [10, -8, 3], [16, -7, 2], [20, -6, 2], [15, -5, 1], [10, -4, 1], [10, -3, 1], [10, -2, 1], [10, -1, 0]];
  for (const [half, dy, level] of rows) s.rect(x - half, y + dy, half * 2, 1, HAT[level]);
  const reach = small ? 12 : 19;
  const top = y + (small ? -7 : -9);
  const fall = small ? 2 : 3;
  s.rect(x - 1, top, 2, 1, PAL.gold[2]);
  // The cord runs across the board to its corner and the tassel hangs from there.
  for (let i = 2; i < reach; i++) s.set(x + i, top + Math.round((i / reach) * fall), PAL.gold[1]);
  const drop = small ? 5 : 11;
  for (let i = 0; i <= drop; i++) s.set(x + reach + Math.round((swing * i) / drop), top + fall + i, PAL.gold[1]);
  const tx = x + reach + swing;
  const ty = top + fall + drop;
  s.rect(tx - 1, ty, 3, 4, PAL.gold[2]);
  s.rect(tx - 1, ty, 1, 4, PAL.gold[3]);
  s.rect(tx - 1, ty + 4, 3, 1, PAL.gold[1]);
}

/* ───────────────────────────── Hands and what they hold ───────────────────────────── */

const OPEN_HAND = ['..h.h.h..', '..s.s.s.h', '..s.s.s.s', '..sdsdsds', 'h.sssssss', 's.sssssss', 'sdsssssss', '.ssssssss', '..ssssss.'];

/** Where her arm leaves her shoulder (on the right of the picture). */
const SHOULDER: [number, number] = [46, 57];

/**
 * Hand shapes, drawn for the hand on the right of the picture. `home` is where the shape's
 * top-left corner usually sits, `wrist` where her arm meets it (inside the shape), and
 * `elbow` where her arm bends on the way there from her shoulder: a bent arm stays short
 * however high the hand goes.
 */
const HANDS: Record<string, { rows: readonly string[]; home: [number, number]; wrist: [number, number]; elbow: [number, number] }> = {
  wave: { rows: OPEN_HAND, home: [47, 28], wrist: [5, 9], elbow: [56, 50] },
  cheer: { rows: OPEN_HAND, home: [49, 19], wrist: [5, 9], elbow: [57, 45] },
  finger: { rows: ['.h....', '.s....', '.s....', '.s....', '.sdsds', 'ssssss', 'ssssss', 'sdssss', '.ssss.'], home: [50, 28], wrist: [3, 9], elbow: [56, 50] },
  point: { rows: ['.ssss.....', 'sssssssssh', 'sssssdddd.', 'ssdsds....', 'ssssss....', '.ssss.....'], home: [46, 38], wrist: [2, 6], elbow: [51, 55] },
  hold: { rows: ['s.........s', 'ss.......ss', '.sdsssssds.', '..sssssss..'], home: [38, 51], wrist: [9, 4], elbow: [54, 62] },
  sweep: { rows: ['.hssssssss', 'sssdsdssss', '.ssssssss.'], home: [39, 46], wrist: [9, 3], elbow: [55, 59] },
};

/** Things that sit in her cupped palm. (x, y) is the middle of the palm; each grows upward from there. */
const ITEMS: Record<TeacherItem, (s: Sheet, x: number, y: number, look: number) => void> = {
  sprout: (s, x, y, look) => {
    s.rect(x - 3, y - 4, 7, 4, PAL.copper[2]);
    s.rect(x - 3, y - 4, 2, 4, PAL.copper[3]);
    s.rect(x - 4, y - 5, 9, 1, PAL.copper[3]);
    s.rect(x - 3, y - 5, 7, 1, PAL.soil[1]);
    const tall = 2 + look * 3;
    s.rect(x, y - 5 - tall, 1, tall, PAL.leaf[3]);
    for (let i = 0; i <= look; i++) {
      const ly = y - 6 - i * 3;
      s.rect(x - 2 - (i % 2), ly, 2 + (i % 2), 1, PAL.leaf[4]);
      s.rect(x + 1, ly - 1, 2 + (i % 2), 1, PAL.leaf[5]);
    }
  },
  bush: (s, x, y) => {
    s.ball(x + 0.5, y - 6, 7, 6, PAL.leaf.slice(1), 5);
    s.ball(x - 3, y - 4, 4, 3.4, PAL.leaf.slice(1), 6);
    for (const [dx, dy] of [[-3, -7], [2, -5], [4, -9], [-1, -3]]) {
      s.set(x + dx, y + dy, PAL.red[3]);
      s.set(x + dx + 1, y + dy, PAL.red[2]);
    }
  },
  sproutling: (s, x, y, look) => {
    s.ball(x + 0.5, y - 5, 5, 5, PAL.grass.slice(1), 7);
    s.ball(x + 0.5, y - 3.5, 3, 2.6, [PAL.cream[2], PAL.cream[3], PAL.cream[3]], 8);
    for (const ex of [x - 2, x + 2]) {
      if (look) {
        s.set(ex - 1, y - 6, PAL.ink);
        s.set(ex, y - 7, PAL.ink);
        s.set(ex + 1, y - 6, PAL.ink);
      } else s.rect(ex, y - 7, 1, 2, PAL.ink);
    }
    s.set(x - 3, y - 4, PAL.pink[2]);
    s.set(x + 3, y - 4, PAL.pink[2]);
    s.rect(x, y - 12, 1, 2, PAL.leaf[2]);
    s.rect(x - 2, y - 13, 2, 1, PAL.leaf[4]);
    s.rect(x + 1, y - 14, 2, 1, PAL.leaf[5]);
  },
  book: (s, x, y, look) => {
    s.rect(x - 9, y - 2, 19, 2, PAL.blue[1]);
    s.rect(x - 8, y - 7, 8, 6, PAL.cream[3]);
    s.rect(x + 1, y - 7, 8, 6, PAL.cream[3]);
    s.rect(x, y - 7, 1, 6, PAL.cream[1]);
    for (let row = 0; row < 2; row++) {
      s.rect(x - 7, y - 6 + row * 2, 5, 1, PAL.cream[1]);
      s.rect(x + 3, y - 6 + row * 2, 5, 1, PAL.cream[1]);
    }
    if (look) {
      s.rect(x, y - 11, 1, 5, PAL.cream[3]);
      s.rect(x + 1, y - 10, 2, 3, PAL.cream[2]);
    }
  },
  map: (s, x, y, look) => {
    s.rect(x - 9, y - 11, 19, 10, PAL.sand[3]);
    s.rect(x - 10, y - 12, 2, 12, PAL.sand[1]);
    s.rect(x + 9, y - 12, 2, 12, PAL.sand[1]);
    s.rect(x - 6, y - 9, 4, 3, PAL.leaf[4]);
    s.rect(x - 5, y - 10, 2, 1, PAL.leaf[4]);
    for (const [dx, dy] of [[-1, -5], [1, -4], [3, -5], [5, -7]]) s.set(x + dx, y + dy, PAL.bark[2]);
    const mark = look ? PAL.red[3] : PAL.red[2];
    for (let i = -1; i <= 1; i++) {
      s.set(x + 6 + i, y - 9 + i, mark);
      s.set(x + 6 + i, y - 9 - i, mark);
    }
  },
  glass: (s, x, y) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= 4.6) s.set(x + dx, y - 10 + dy, d > 3.4 ? PAL.gold[2] : PAL.magic[4]);
    }
    s.set(x - 2, y - 12, PAL.white);
    s.set(x - 1, y - 13, PAL.white);
    s.rect(x, y - 5, 2, 5, PAL.wood[2]);
    s.rect(x, y - 5, 1, 5, PAL.wood[3]);
  },
  token: (s, x, y, look) => {
    s.ball(x + 0.5, y - 6, 5.2, 5.2, PAL.gold, 9);
    for (let i = 0; i < 4; i++) s.rect(x - i, y - 9 + i * 2, 1 + i * 2, 2, i % 2 ? PAL.pine[2] : PAL.pine[3]);
    s.rect(x, y - 2, 1, 1, PAL.bark[1]);
    if (look) {
      s.set(x - 3, y - 9, PAL.white);
      s.set(x - 2, y - 10, PAL.white);
    }
  },
  hat: (s, x, y) => hat(s, x, y, 0, true),
};

function hand(s: Sheet, pose: NonNullable<TeacherPose['hand']>, mirror: boolean): void {
  const shape = HANDS[pose.does];
  const [ox, oy] = pose.at ?? [0, 0];
  const gx = shape.home[0] + ox;
  const gy = shape.home[1] + oy;
  // Sides swap for her other hand.
  const side = (x: number) => (mirror ? W - 1 - x : x);
  // Her bare arm: out from the shoulder to the elbow, then the forearm up to the wrist.
  const wrist: [number, number] = [gx + shape.wrist[0], gy + shape.wrist[1]];
  const elbow: [number, number] = [shape.elbow[0] + ox * 0.4, shape.elbow[1] + oy * 0.4];
  const limb = (from: [number, number], to: [number, number]) => {
    const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]));
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      s.ball(side(from[0] + (to[0] - from[0]) * t) + 0.5, from[1] + (to[1] - from[1]) * t + 0.5, 2.6, 2.6, SKIN.slice(1), 12);
    }
  };
  limb(SHOULDER, elbow);
  limb(elbow, wrist);
  s.glyph(shape.rows, side(gx), gy, { s: SKIN[2], h: SKIN[3], d: SKIN[1] }, mirror);
  if (pose.holds) ITEMS[pose.holds](s, side(gx + 5), gy + 2, pose.look ?? 0);
}

/* ───────────────────────────── Marks in the air ───────────────────────────── */

const sparkleAt = (s: Sheet, x: number, y: number, big: boolean) => {
  const reach = big ? 2 : 1;
  for (let i = 1; i <= reach; i++) for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) s.set(x + dx, y + dy, PAL.gold[i === reach ? 2 : 3]);
  s.set(x, y, PAL.white);
};

const heartAt = (s: Sheet, x: number, y: number) => s.glyph(['.p.p.', 'pPppp', 'ppppp', '.ppp.', '..p..'], x, y, { p: PAL.pink[2], P: PAL.pink[4] });

const FX: Record<TeacherFx, (s: Sheet, look: number) => void> = {
  sparkle: (s, look) => {
    for (const [x, y, big] of look ? [[57, 12, 1], [5, 32, 0], [58, 44, 0]] : [[6, 16, 1], [59, 28, 0], [4, 48, 0]]) sparkleAt(s, x, y, !!big);
  },
  hearts: (s, look) => {
    heartAt(s, look ? 55 : 53, look ? 6 : 12);
    if (look) heartAt(s, 3, 14);
  },
  drops: (s, look) => {
    for (let i = 0; i < 4; i++) {
      const x = 34 + ((i * 7 + look * 5) % 24);
      const y = 37 + ((i * 5 + look * 3) % 6);
      s.rect(x, y, 2, 2, PAL.magic[2]);
      s.set(x, y - 1, PAL.magic[3]);
      s.set(x, y, PAL.white);
    }
    sparkleAt(s, 38 + look * 8, 34, false);
  },
  leaves: (s, look) => {
    for (const [x, y] of look ? [[35, 34], [58, 40], [51, 30], [39, 48]] : [[37, 38], [59, 34], [53, 46], [41, 30]]) {
      s.rect(x, y, 2, 1, PAL.leaf[4]);
      s.set(x + 1, y + 1, PAL.leaf[3]);
    }
  },
  tap: (s) => {
    for (const [x, y] of [[50, 24], [53, 22], [56, 24]]) s.set(x, y, PAL.gold[3]);
    s.set(53, 20, PAL.gold[2]);
  },
};

/* ───────────────────────────── Putting her together ───────────────────────────── */

/** While she talks, her mouth moves on alternate frames; this is the shape it moves to from each resting one. */
const SPEAKING: Record<TeacherMouth, TeacherMouth> = { smile: 'open', grin: 'smile', open: 'smile', oh: 'open' };

function portrait(look: TeacherLook, pose: TeacherPose, talking: boolean): Pix {
  const s = new Sheet(look);
  const [hx, hy] = pose.head ?? [0, 0];
  const mouth = pose.mouth ?? 'smile';
  backHair(s, hx, hy);
  torso(s);
  face(s, hx, hy);
  features(s, pose, talking ? SPEAKING[mouth] : mouth, hx, hy);
  frontHair(s, hx, hy);
  if (pose.hat !== 'off') hat(s, CX + hx, 11 + hy - (pose.hat ?? 0), pose.swing ?? 0);
  s.trimBelow(H - 1);
  if (pose.hand) {
    hand(s, pose.hand, false);
    if (pose.both) hand(s, pose.hand, true);
    s.trimBelow(H - 1);
  }
  if (pose.fx) FX[pose.fx[0]](s, pose.fx[1]);
  // A warm outline takes its colour from what it runs along; the dark one is the same line the rest of the world gets.
  return look.outline === 'warm' ? s.p.outlineTinted(PAL.woodDark[0], 0.28) : ink(s.p);
}

/** The middle of the portrait's lower edge. Every frame shares it, so she stays put as she moves. */
const ANCHOR = { ax: PAD_X + CX, ay: PAD_TOP + H - 1 };

const lookById = (id: string) => TEACHER_LOOKS.find((look) => look.id === id) ?? TEACHER_LOOKS[0];

export function paintTeacher(atlas: Atlas): void {
  // The portrait made from a picture is painted as it plays (see ui/Guide.tsx), not kept in the atlas.
  if (teacherIsPicture()) return;
  const look = lookById(TEACHER.look);
  const paint = (pose: TeacherPose, talking: boolean) => portrait(look, pose, talking);
  for (const [name, anim] of Object.entries(TEACHER.anims) as [TeacherAnimName, TeacherAnim][]) {
    anim.frames.forEach((pose, i) => {
      atlas.add(teacherFrame(name, i), paint(pose, false), ANCHOR);
      atlas.add(teacherFrame(name, i, true), paint(pose, true), ANCHOR);
    });
  }
}

/** Every look as a still portrait (`teacher_look_picture`, and `teacher_look_<id>` for each drawn one), for choosing between them. */
export function paintTeacherLooks(atlas: Atlas): void {
  atlas.add('teacher_look_picture', pictureFrame(TEACHER.resting, 0), { ax: PICTURE_FRAME.w / 2, ay: PICTURE_FRAME.h - 1 });
  for (const look of TEACHER_LOOKS) atlas.add(`teacher_look_${look.id}`, portrait(look, {}, false), ANCHOR);
}
