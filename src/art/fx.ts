import { LIGHT_TONES, PAL } from '@/config/palette';
import type { Atlas } from '@/engine/atlas';
import { Pix } from '@/engine/pix';
import { hash2 } from '@/engine/rng';
import { ink, ROOM } from './kit';
import { paintMug } from './landmarks';

const roomy = (w: number, h: number) => new Pix(w + ROOM * 2, h + ROOM * 2);

/** Radius the light cookies are baked at; the renderer scales them to each light's size. */
export const LIGHT_BAKE_RADIUS = 32;

/** A soft, banded, dithered disc of light: pixel-art falloff instead of a smooth gradient. */
function lightCookie(color: number, strength: number): Pix {
  const size = LIGHT_BAKE_RADIUS * 2;
  const p = new Pix(size, size);
  const bands = 5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - LIGHT_BAKE_RADIUS, y + 0.5 - LIGHT_BAKE_RADIUS) / LIGHT_BAKE_RADIUS;
      if (d >= 1) continue;
      const level = (1 - d) * bands + (hash2(x, y, 9) - 0.5) * 0.9;
      const band = Math.max(0, Math.min(bands, Math.floor(level + 0.5)));
      if (band === 0) continue;
      p.alpha = Math.round((band / bands) ** 1.4 * 255 * strength);
      p.set(x, y, color);
    }
  }
  p.alpha = 255;
  return p;
}

/** Tiny emote glyphs that pop over creatures' heads. */
const EMOTES: Record<string, readonly string[]> = {
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  note: ['...###.', '...#.#.', '...#...', '.###...', '.###...'],
  zzz: ['####...', '..#....', '.#..###', '####.#.', '....###'],
  bang: ['.##.', '.##.', '.##.', '....', '.##.'],
  spark: ['...#...', '..###..', '#######', '..###..', '...#...'],
};
const EMOTE_COLORS: Record<string, number> = { heart: PAL.pink[2], note: PAL.blue[3], zzz: PAL.lilac[3], bang: PAL.gold[3], spark: PAL.gold[4] };

function stamp(rows: readonly string[], color: number): Pix {
  const p = roomy(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && p.set(ROOM + x, ROOM + y, color)));
  return ink(p);
}

/** Things creatures carry between buildings. */
const ITEMS: Record<string, (p: Pix, x: number, y: number) => void> = {
  dew: (p, x, y) => {
    p.ball(x + 2, y + 3, 2.2, 2.2, PAL.magic, 0, 1);
    p.set(x + 2, y, PAL.magic[3]);
    p.set(x + 1, y + 2, PAL.white);
  },
  petals: (p, x, y) => {
    p.ell(x + 2, y + 2.5, 2.4, 2, PAL.pink[2]);
    p.set(x + 1, y + 1, PAL.pink[4]);
    p.set(x + 3, y + 3, PAL.pink[1]);
  },
  pollen: (p, x, y) => {
    p.ball(x + 2, y + 2.5, 2.3, 2.3, PAL.gold, 0, 1);
  },
  starlight: (p, x, y) => {
    p.rect(x + 2, y, 1, 5, PAL.lilac[4]);
    p.rect(x, y + 2, 5, 1, PAL.lilac[4]);
    p.set(x + 2, y + 2, PAL.white);
  },
  crate: (p, x, y) => {
    p.rect(x, y, 5, 5, PAL.wood[3]);
    p.rect(x, y, 5, 1, PAL.wood[5]);
    p.rect(x, y + 4, 5, 1, PAL.wood[1]);
  },
  shroom: (p, x, y) => {
    p.rect(x + 2, y + 2, 1, 3, PAL.cream[3]);
    p.rect(x, y + 1, 5, 2, PAL.red[2]);
    p.rect(x + 1, y, 3, 1, PAL.red[3]);
    p.set(x + 1, y + 1, PAL.cream[3]);
  },
  mug: (p, x, y) => paintMug(p, x, y + 1, true),
};

/** The little rain cloud the player drags around: a huddle of soft puffs with a flat, heavy underside. */
function rainCloud(): Pix {
  const p = roomy(34, 18);
  const cx = p.w / 2;
  const base = ROOM + 15;
  const puffs: number[][] = [[-9, -4, 6.5, 5.5], [9, -4, 7, 5.5], [0, -8, 8.5, 7], [-4, -2, 10, 4.5], [5, -2, 9, 4.5]];
  for (const [dx, dy, rx, ry] of puffs) p.ball(cx + dx, base + dy, rx, ry, PAL.grassWinter, 0.06, dx);
  for (let x = 0; x < p.w; x++) for (let y = base + 1; y < p.h; y++) p.clear(x, y);
  for (let x = -12; x <= 12; x++) p.over(cx + x, base, PAL.frost[1]);
  return ink(p);
}

export function paintFx(atlas: Atlas): void {
  atlas.add('raincloud', rainCloud());
  const framedCookie = (color: number, strength: number) => {
    const cookie = lightCookie(color, strength);
    return new Pix(cookie.w + 2, cookie.h + 2).blit(cookie, 1, 1);
  };
  const centre = { ax: LIGHT_BAKE_RADIUS + 1, ay: LIGHT_BAKE_RADIUS + 1 };
  atlas.add('light_hole', framedCookie(0xffffff, 1), centre);
  for (const [tone, color] of Object.entries(LIGHT_TONES)) atlas.add(`light_${tone}`, framedCookie(color, 0.5), centre);

  for (const [name, rows] of Object.entries(EMOTES)) atlas.add(`emote_${name}`, stamp(rows, EMOTE_COLORS[name]));
  for (const [name, paint] of Object.entries(ITEMS)) {
    const p = roomy(5, 6);
    paint(p, ROOM, ROOM);
    atlas.add(`item_${name}`, ink(p));
  }
}
