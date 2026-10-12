/**
 * Turns a picture of pixel art drawn large (one "pixel" = a block of many screen pixels) into a
 * true pixel-art portrait for the teacher, written out as code like the rest of the game's art.
 *
 *   npm run portrait -- <picture.png> <block> <left> <top> [width] [height] [colours] [--hair=x,y;… --cloth=x,y;… --erase=x,y,w,h;… --mend=x,y;… --shorten=y,rows --edge=78]
 *
 *   block    roughly how many screen pixels one art pixel is (e.g. 13). Pictures like this are rarely
 *            drawn on an even grid, so the real grid lines are found from the picture itself: every
 *            line is put where the colours actually change, about this far apart.
 *   left/top which art pixel the portrait's top-left corner is
 *   width/height  the portrait's size in art pixels (default: TEACHER_PICTURE.size)
 *   colours  how many colours to keep (default and at most 64)
 *   --hair, --cloth and --erase cut the person out of her surroundings (all in portrait pixels):
 *            from the --hair points the figure grows through every touching pixel that is warm and
 *            bright (hair, skin), stopping at the dark line drawn around her, which it keeps as her
 *            outline; from the --cloth points it grows through the dark blues of her clothes.
 *            Whatever she walls in (eyes, teeth, sequins) is hers too. Greens, sky blues and sunset
 *            pinks are never part of her, and neither is anything inside an --erase box.
 *   --mend   single pixels of scenery showing through a gap in her: each takes the colour of the hair beside it
 *            (or, with no hair beside it, of whatever part of her is)
 *   --shorten  leaves out that many rows of the finished portrait from row y on (a neck drawn too
 *            long): everything above moves down to close the gap. The other flags count rows before this.
 *   --edge   how bright a warm pixel must be to count as hair rather than outline (default 78)
 *
 * It writes src/art/portrait.data.ts. Where her eyes, mouth and arms are in the result is set by hand
 * in config/teacher.ts (TEACHER_PICTURE), since that is what she is animated from.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { TEACHER_PICTURE } from '../src/config/teacher';

type Rgb = [number, number, number];

/** A minimal PNG reader: 8 bits per channel, not interlaced. Returns RGBA bytes. */
function readPng(file: string): { w: number; h: number; data: Uint8Array } {
  const buf = readFileSync(file);
  let pos = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + length);
    if (kind === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      type = body[9];
      if (body[8] !== 8 || body[12]) throw new Error('Only 8-bit, non-interlaced PNG files are supported.');
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'IDAT') idat.push(body);
    pos += 12 + length;
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const data = new Uint8Array(w * h * 4);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      const paeth = () => {
        const p = a + b - c;
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      };
      line[i] = (line[i] + [0, a, b, (a + b) >> 1, paeth()][filter]) & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const rgb: Rgb =
        type === 2 || type === 6 ? [line[x * channels], line[x * channels + 1], line[x * channels + 2]] : type === 3 ? [palette![line[x] * 3], palette![line[x] * 3 + 1], palette![line[x] * 3 + 2]] : [line[x * channels], line[x * channels], line[x * channels]];
      data.set([...rgb, 255], o);
    }
    previous = line;
  }
  return { w, h, data };
}

/**
 * Reduce a set of colours to at most `count`: median cut for a first palette, then a few rounds of
 * moving each palette colour to the middle of the pixels nearest to it, so that rare colours (a
 * sequin, a glint in an eye) are not averaged away. Returns the palette and each input's place in it.
 */
function quantise(colours: Rgb[], count: number): { palette: Rgb[]; index: number[] } {
  let boxes: number[][] = [colours.map((_, i) => i)];
  const spread = (box: number[], channel: number) => {
    let lo = 255;
    let hi = 0;
    for (const i of box) {
      lo = Math.min(lo, colours[i][channel]);
      hi = Math.max(hi, colours[i][channel]);
    }
    return hi - lo;
  };
  while (boxes.length < count) {
    // Split the box whose colours differ the most, along the channel where they differ most.
    let pick = -1;
    let widest = 0;
    let along = 0;
    boxes.forEach((box, b) => {
      for (let channel = 0; channel < 3; channel++) {
        const range = box.length > 1 ? spread(box, channel) : 0;
        if (range > widest) [widest, pick, along] = [range, b, channel];
      }
    });
    if (pick < 0) break;
    const sorted = [...boxes[pick]].sort((p, q) => colours[p][along] - colours[q][along]);
    const half = sorted.length >> 1;
    boxes = [...boxes.slice(0, pick), sorted.slice(0, half), sorted.slice(half), ...boxes.slice(pick + 1)];
  }
  let palette = boxes.map((box) => {
    const sum = [0, 0, 0];
    for (const i of box) for (let channel = 0; channel < 3; channel++) sum[channel] += colours[i][channel];
    return sum.map((v) => v / box.length) as Rgb;
  });
  const nearest = (c: Rgb) => {
    let best = 0;
    let least = Infinity;
    palette.forEach((p, i) => {
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
      if (d < least) [least, best] = [d, i];
    });
    return best;
  };
  let index = colours.map(nearest);
  for (let round = 0; round < 12; round++) {
    const sums = palette.map(() => [0, 0, 0, 0]);
    index.forEach((p, i) => {
      for (let channel = 0; channel < 3; channel++) sums[p][channel] += colours[i][channel];
      sums[p][3]++;
    });
    palette = palette.map((old, p) => (sums[p][3] ? (sums[p].slice(0, 3).map((v) => v / sums[p][3]) as Rgb) : old));
    index = colours.map(nearest);
  }
  // Keep only the colours in use, dark to light, so the palette reads sensibly.
  const used = [...new Set(index)].sort((p, q) => palette[p][0] * 3 + palette[p][1] * 6 + palette[p][2] - (palette[q][0] * 3 + palette[q][1] * 6 + palette[q][2]));
  return { palette: used.map((p) => palette[p].map(Math.round) as Rgb), index: index.map((p) => used.indexOf(p)) };
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/';
const flags = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
const flag = (name: string) => flags.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const numbers = (name: string) => (flag(name) ?? '').split(';').filter(Boolean).map((group) => group.split(',').map(Number));
const [file, blockArg, leftArg, topArg, widthArg, heightArg, coloursArg] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (!file || !topArg) throw new Error('Usage: npm run portrait -- <picture.png> <block> <left> <top> [width] [height] [colours]');
const block = Number(blockArg);
const left = Number(leftArg);
const top = Number(topArg);
const W = Number(widthArg ?? TEACHER_PICTURE.size.w);
const H = Number(heightArg ?? TEACHER_PICTURE.size.h);
const keep = Math.min(ALPHABET.length, Number(coloursArg ?? ALPHABET.length));
const edge = Number(flag('edge') ?? 78);
const image = readPng(file);

/* ───────────────────────────── Finding the picture's own grid ───────────────────────────── */

/** How much the colours change between each column (or row) of screen pixels and the one before it. */
function changes(across: boolean): Float64Array {
  const out = new Float64Array(across ? image.w : image.h);
  const step = across ? 4 : image.w * 4;
  for (let y = across ? 0 : 1; y < image.h; y++) {
    for (let x = across ? 1 : 0; x < image.w; x++) {
      const o = (y * image.w + x) * 4;
      out[across ? x : y] += Math.abs(image.data[o] - image.data[o - step]) + Math.abs(image.data[o + 1] - image.data[o + 1 - step]) + Math.abs(image.data[o + 2] - image.data[o + 2 - step]);
    }
  }
  return out;
}

/**
 * The grid lines along one direction: positions about `block` apart, chosen so that together they
 * sit on the strongest changes of colour. Returns the edges of every art pixel, first to last.
 */
function gridLines(change: Float64Array): number[] {
  const n = change.length;
  const mean = change.reduce((sum, v) => sum + v, 0) / n;
  const pull = (i: number) => (change[i] + 0.5 * ((change[i - 1] ?? 0) + (change[i + 1] ?? 0))) / mean;
  const lo = Math.max(2, Math.floor(block * 0.87));
  const hi = Math.ceil(block * 1.15);
  const score = new Float64Array(n).fill(-Infinity);
  const from = new Int32Array(n).fill(-1);
  for (let i = 0; i < Math.min(n, hi); i++) score[i] = pull(i);
  for (let i = 0; i < n; i++) {
    if (score[i] === -Infinity) continue;
    for (let step = lo; step <= hi && i + step < n; step++) {
      const s = score[i] + pull(i + step) - Math.abs(step - block) * 0.35;
      if (s > score[i + step]) [score[i + step], from[i + step]] = [s, i];
    }
  }
  let end = n - 1;
  for (let i = Math.max(0, n - hi); i < n; i++) if (score[i] > score[end]) end = i;
  const lines: number[] = [];
  for (let i = end; i >= 0; i = from[i]) lines.push(i);
  lines.reverse();
  // The picture's own edges close the first and last art pixel.
  if (lines[0] > block / 2) lines.unshift(0);
  else lines[0] = 0;
  if (n - lines[lines.length - 1] > block / 2) lines.push(n);
  else lines[lines.length - 1] = n;
  return lines;
}

const columns = gridLines(changes(true));
const lines = gridLines(changes(false));

/** The colour of one art pixel: the median of the screen pixels well inside it (its edges are often smeared). */
function artPixel(cx: number, cy: number): Rgb {
  if (cx < 0 || cy < 0 || cx >= columns.length - 1 || cy >= lines.length - 1) return [0, 255, 0];
  const [x0, x1, y0, y1] = [columns[cx], columns[cx + 1], lines[cy], lines[cy + 1]];
  const insetX = Math.max(1, Math.round((x1 - x0) * 0.25));
  const insetY = Math.max(1, Math.round((y1 - y0) * 0.25));
  const channels: number[][] = [[], [], []];
  for (let y = y0 + insetY; y < y1 - insetY; y++) {
    for (let x = x0 + insetX; x < x1 - insetX; x++) for (let channel = 0; channel < 3; channel++) channels[channel].push(image.data[(y * image.w + x) * 4 + channel]);
  }
  return channels.map((values) => (values.length ? values.sort((p, q) => p - q)[values.length >> 1] : 0)) as Rgb;
}

const pixels: Rgb[] = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pixels.push(artPixel(left + x, top + y));

/* ───────────────────────────── Cutting her out ───────────────────────────── */

const light = ([r, g, b]: Rgb) => (r * 3 + g * 6 + b) / 10;
const green = ([r, g, b]: Rgb) => g > r * 0.94 && g >= b * 0.85;
/** Greens however dark, sky and water, the pinks of a sunset. */
const scenery = (c: Rgb) => green(c) || (light(c) >= 62 && ((c[2] > c[0] * 0.92 && c[2] > c[1]) || (c[2] > c[1] * 0.86 && c[0] > 150)));
/** Warm and bright enough to be hair or skin rather than the line around them. */
const warm = (c: Rgb) => !scenery(c) && c[0] > c[2] * 1.5 && light(c) >= edge;
/** The dark blues and purples of her clothes. */
const cloth = (c: Rgb) => !scenery(c) && c[2] >= c[0] * 0.95 && c[2] > c[1] && light(c) < 110;

const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const around = (x: number, y: number) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => inside(nx, ny));
const erase = numbers('erase');
const erased = (x: number, y: number) => erase.some(([ex, ey, ew, eh]) => x >= ex && x < ex + ew && y >= ey && y < ey + eh);

/** Every pixel reached from the seeds through touching pixels that pass. */
function grow(seeds: number[][], pass: (c: Rgb) => boolean): boolean[] {
  const got = pixels.map(() => false);
  const queue = seeds.filter(([x, y]) => inside(x, y));
  for (const [x, y] of queue) got[y * W + x] = true;
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of around(x, y)) {
      if (got[ny * W + nx] || erased(nx, ny) || !pass(pixels[ny * W + nx])) continue;
      got[ny * W + nx] = true;
      queue.push([nx, ny]);
    }
  }
  return got;
}

/** Which pixels belong to the person. Everything, unless a cut-out was asked for. */
function figure(): boolean[] {
  const hairSeeds = numbers('hair');
  if (!hairSeeds.length) return pixels.map(() => true);
  const hair = grow(hairSeeds, warm);
  const clothes = grow(numbers('cloth'), cloth);
  // The dark line right against her hair and skin is her outline.
  const kept = pixels.map((c, i) => {
    if (hair[i] || clothes[i]) return true;
    const [x, y] = [i % W, Math.floor(i / W)];
    return !erased(x, y) && !scenery(c) && light(c) < edge && around(x, y).some(([nx, ny]) => hair[ny * W + nx]);
  });
  // Anything she walls in is part of her (eyes, teeth, the sparkle on a sweater). The bottom edge
  // counts as a wall: that is where the portrait cuts her off, so what reaches it is still her.
  const outside = pixels.map(() => false);
  const open: number[][] = [];
  for (let i = 0; i < W; i++) open.push([i, 0]);
  for (let i = 0; i < H; i++) open.push([0, i], [W - 1, i]);
  const queue = open.filter(([x, y]) => !kept[y * W + x]);
  for (const [x, y] of queue) outside[y * W + x] = true;
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of around(x, y)) {
      if (kept[ny * W + nx] || outside[ny * W + nx]) continue;
      outside[ny * W + nx] = true;
      queue.push([nx, ny]);
    }
  }
  const whole = pixels.map((_, i) => !outside[i] && !erased(i % W, Math.floor(i / W)));
  // A speck of scenery showing through her hair takes the colour of the hair beside it.
  const mend = numbers('mend');
  for (const [x, y] of mend) whole[y * W + x] = true;
  whole.forEach((on, i) => {
    const asked = mend.some(([x, y]) => y * W + x === i);
    if (!on || !(green(pixels[i]) || asked)) return;
    const mine = around(i % W, Math.floor(i / W)).filter(([nx, ny]) => whole[ny * W + nx] && !green(pixels[ny * W + nx]) && !mend.some(([x, y]) => x === nx && y === ny));
    const beside = mine.filter(([nx, ny]) => warm(pixels[ny * W + nx]));
    if (beside.length >= 2 || (asked && beside.length)) pixels[i] = pixels[beside[0][1] * W + beside[0][0]];
    else if (asked && mine.length) pixels[i] = pixels[mine[0][1] * W + mine[0][0]];
    else if (beside.length) whole[i] = false;
  });
  return whole;
}

const inFigure = figure();

// Leave out rows of the finished portrait, moving everything above them down.
const [shortenAt, shortenBy] = numbers('shorten')[0] ?? [0, 0];
for (let y = shortenAt + shortenBy - 1; y >= 0; y--) {
  for (let x = 0; x < W; x++) {
    pixels[y * W + x] = y >= shortenBy ? pixels[(y - shortenBy) * W + x] : [0, 255, 0];
    inFigure[y * W + x] = y >= shortenBy && inFigure[(y - shortenBy) * W + x];
  }
}
const used = pixels.filter((_, i) => inFigure[i]);
const { palette, index } = quantise(used, keep);
let next = 0;
const rows = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (inFigure[y * W + x] ? ALPHABET[index[next++]] : '.')).join(''));
const hex = (rgb: Rgb) => `0x${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const worst = used.reduce((most, c, i) => Math.max(most, Math.abs(c[0] - palette[index[i]][0]) + Math.abs(c[1] - palette[index[i]][1]) + Math.abs(c[2] - palette[index[i]][2])), 0);

writeFileSync(
  new URL('../src/art/portrait.data.ts', import.meta.url),
  `/**
 * The teacher's portrait as pixels: one character per pixel, each naming a colour in \`palette\`
 * by its place in \`alphabet\` (a dot is see-through). Generated by scripts/portrait.ts from a picture. Do not edit by hand;
 * run \`npm run portrait\` again instead:
 *
 *   npm run portrait -- <picture.png> ${process.argv.slice(3).join(' ')}
 */
export const PORTRAIT_DATA = {
  w: ${W},
  h: ${H},
  alphabet: '${ALPHABET}',
  palette: [${palette.map(hex).join(', ')}],
  rows: [
${rows.map((row) => `    '${row}',`).join('\n')}
  ],
} as const;
`,
);
console.log(`Wrote src/art/portrait.data.ts: ${W}×${H} pixels in ${palette.length} colours, ${used.length} of them part of the figure (the furthest any pixel is from its true colour: ${worst} of 765).`);
console.log(`The picture's grid: ${columns.length - 1} × ${lines.length - 1} art pixels.`);
