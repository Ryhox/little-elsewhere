import { PAL } from '@/config/palette';
import type { Atlas } from '@/engine/atlas';
import { Pix } from '@/engine/pix';
import { ink, ROOM } from './kit';

const roomy = (w: number, h: number) => new Pix(w + ROOM * 2, h + ROOM * 2);

/** Character → colour table for hand-drawn glyph grids. Upper case is the lit shade. */
const INKS: Record<string, number> = {
  a: PAL.magic[2], A: PAL.magic[4], b: PAL.magic[1],
  g: PAL.leaf[3], G: PAL.leaf[5], h: PAL.leaf[1],
  y: PAL.gold[2], Y: PAL.gold[4], z: PAL.gold[1],
  r: PAL.red[2], R: PAL.red[4], q: PAL.red[1],
  p: PAL.pink[2], P: PAL.pink[4], o: PAL.pink[1],
  v: PAL.lilac[2], V: PAL.lilac[4], u: PAL.violet[1],
  m: PAL.metal[2], M: PAL.metal[4], n: PAL.metal[1],
  w: PAL.wood[2], W: PAL.wood[4], x: PAL.wood[1],
  c: PAL.cream[1], C: PAL.cream[3], k: PAL.ink,
};

/** Hand-drawn glyphs. Add a grid here and it becomes available as `ic_<name>`. */
const GLYPHS: Record<string, readonly string[]> = {
  build: ['.MMMm....', 'MmmmmW...', 'mmmnWWw..', '.nn..Wwx.', '......Wwx', '.......wx'],
  upgrades: ['....Y....', '...YyY...', '..YyyyY..', '.YyyyyyY.', '...yyy...', '...yyy...', '...yzy...', '...zzz...'],
  season: ['......hG.', '....hGGg.', '...GGGgg.', '..GGggg..', '.hGgggh..', '.hggghh..', '.xhhh....', 'x........'],
  journal: ['.rrrr.rrrr.', 'rCCCCrCCCCr', 'rCkkCrCkkCr', 'rCCCCrCCCCr', 'rCkkCrCkkCr', 'rCCCCrCCCCr', '.qqqqqqqqq.'],
  trophies: ['yYYYYYYYy', 'yYyyyyyzy', '.yYyyyz..', '..yyyz...', '...yz....', '...yz....', '..yyyz...', '.zzzzzz..'],
  settings: ['mmmYYmmmm', '...YY....', '.........', 'mmmmmmYYm', '......YY.', '.........', 'mYYmmmmmm', '.YY......'],
  eye: ['..kkkkk..', '.kCCCCCk.', 'kCCaaaCCk', 'kCCakaCCk', '.kCCCCCk.', '..kkkkk..'],
  home: ['....r....', '...rrr...', '..rrrrr..', '.rrrrrrr.', '.CCCCCCC.', '.CCwwCCC.', '.CCwwCCC.'],
  lock: ['..mmmm..', '.m....m.', '.m....m.', 'yyyyyyyy', 'yYyyzyyz', 'yYyzzyyz', 'yyyyyyyz', '.zzzzzz.'],
  check: ['.......G', '......Gg', '.....Gg.', 'G...Gg..', 'gG.Gg...', '.gGg....', '..g.....'],
  close: ['r.....r', 'rr...rr', '.rr.rr.', '..rrr..', '.rr.rr.', 'rr...rr', 'r.....r'],
  sound: ['...m..y.', '..mm...y', 'mmmm.y.y', 'mmmm.y.y', 'mmmm.y.y', '..mm...y', '...m..y.'],
  paw: ['..w...w..', '.ww.w.ww.', '.ww.w.ww.', '....w....', '..wwwww..', '.wWwwwww.', '.wwwwwww.', '..ww.ww..'],
  bolt: ['....YYy', '...YYy.', '..YYy..', '.YYYYYy', '...YYy.', '..YYy..', '.Yy....'],
  heart: ['.Pp.pp.', 'PPppppo', 'ppppppo', '.ppppo.', '..ppo..', '...o...'],
  wind: ['..aaa....', '.....a...', 'AAAAAa...', '.........', 'aaaaaaaa.', '........a', '.....aaa.'],
  moon: ['..VVv...', '.VVv....', 'VVv.....', 'VVv.....', 'VVvv...v', '.VVvvvv.', '..vvvv..'],
  note: ['...yyyy', '...y..y', '...y..y', '...y..y', '.yyy.yyy', 'yYyy.yYy', '.yy...y.'],
  hourglass: ['wwwwwww', '.CCCCC.', '..yyy..', '...y...', '..C.C..', '.CyyyC.', 'wwwwwww'],
  map: ['CCc.CCc.C', 'CcCcCCcCC', 'CCcCrCcCC', 'CcCCcCCcC', 'CCcCCcCCC', 'C.CCc.CCc'],
  wing: ['..CCCC...', '.CCCCCC..', 'CCCcCCCc.', '.cCCcCCCc', '..ccCCcc.', '....cc...'],
  crown: ['y..y..y', 'yy.y.yy', 'yYyyyyy', 'yYyryyz', 'zzzzzzz'],
  arrow: ['...g....', '...gg...', 'ggggGg..', 'gGGGGGg.', 'ggggGg..', '...gg...', '...g....'],
  pointer: ['..yyyyy..', '..yYYyy..', '..yYYyy..', '..yYYyy..', 'yyyYYyyyz', '.yYYYYyz.', '..yYYyz..', '...yYz...', '....z....'],
};

function glyph(rows: readonly string[]): Pix {
  const width = Math.max(...rows.map((r) => r.length));
  const p = roomy(width, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.set(ROOM + x, ROOM + y, INKS[ch] ?? PAL.white)));
  return ink(p);
}

/** Painted (non-grid) icons: resources and a few round symbols. */
const PAINTED: Record<string, (p: Pix, cx: number, cy: number) => void> = {
  res_dew: (p, cx, cy) => {
    p.poly([[cx - 3, cy], [cx, cy - 6], [cx + 3, cy]], PAL.magic[2]);
    p.ball(cx, cy + 1, 4, 4, PAL.magic, 0, 1);
    p.set(cx - 2, cy, PAL.white);
    p.set(cx - 1, cy - 1, PAL.white);
  },
  res_petals: (p, cx, cy) => {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      p.ball(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, 2.4, 2.4, PAL.pink, 0, i);
    }
    p.ell(cx, cy, 1.6, 1.6, PAL.yellow[3]);
  },
  res_pollen: (p, cx, cy) => {
    for (let i = 0; i < 8; i++) p.set(cx - 0.5 + Math.cos((i / 8) * Math.PI * 2) * 5, cy - 0.5 + Math.sin((i / 8) * Math.PI * 2) * 5, PAL.yellow[3]);
    p.ball(cx, cy, 3.8, 3.8, PAL.gold, 0.2, 2);
  },
  res_starlight: (p, cx, cy) => {
    p.poly([[cx, cy - 6], [cx + 1.5, cy - 1.5], [cx + 6, cy], [cx + 1.5, cy + 1.5], [cx, cy + 6], [cx - 1.5, cy + 1.5], [cx - 6, cy], [cx - 1.5, cy - 1.5]], PAL.lilac[3]);
    p.ell(cx, cy, 2.2, 2.2, PAL.lilac[4]);
    p.ell(cx, cy, 1, 1, PAL.white);
  },
  res_harmony: (p, cx, cy) => {
    p.ball(cx - 2, cy, 3.8, 3.8, PAL.teal, 0, 1);
    p.ball(cx + 2, cy, 3.8, 3.8, PAL.pink, 0, 2);
    p.ell(cx, cy, 1.5, 3, PAL.gold[4]);
  },
  res_evergreen: (p, cx, cy) => {
    p.ball(cx, cy, 5.6, 5.6, PAL.gold, 0, 3);
    p.poly([[cx - 3.5, cy + 3], [cx, cy - 4.5], [cx + 3.5, cy + 3]], PAL.pine[2]);
    p.poly([[cx - 2, cy], [cx, cy - 4], [cx + 2, cy]], PAL.pine[4]);
    p.rect(cx - 0.5, cy + 3, 1, 1, PAL.bark[1]);
  },
  ic_sun: (p, cx, cy) => {
    for (let i = 0; i < 8; i++) p.rect(cx - 0.5 + Math.cos((i / 8) * Math.PI * 2) * 5.4, cy - 0.5 + Math.sin((i / 8) * Math.PI * 2) * 5.4, 1, 1, PAL.gold[3]);
    p.ball(cx, cy, 3.4, 3.4, PAL.gold.slice(1), 0, 1);
  },
  ic_star: (p, cx, cy) => {
    p.poly([[cx, cy - 5], [cx + 1.5, cy - 1.5], [cx + 5, cy], [cx + 1.5, cy + 1.5], [cx, cy + 5], [cx - 1.5, cy + 1.5], [cx - 5, cy], [cx - 1.5, cy - 1.5]], PAL.gold[3]);
    p.ell(cx, cy, 1.4, 1.4, PAL.white);
  },
  ic_coin: (p, cx, cy) => {
    p.ball(cx, cy, 4.6, 4.6, PAL.gold, 0, 2);
    p.rect(cx - 0.5, cy - 2, 1, 4, PAL.gold[1]);
  },
  ic_clover: (p, cx, cy) => {
    p.line(cx, cy + 1, cx + 2, cy + 5, PAL.leaf[1]);
    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) p.ball(cx + dx, cy + dy - 1, 2.3, 2.3, PAL.leaf.slice(1), 0, dx + dy);
  },
  ic_gear: (p, cx, cy) => {
    for (let i = 0; i < 8; i++) p.rect(cx - 1 + Math.cos((i / 8) * Math.PI * 2) * 4.6, cy - 1 + Math.sin((i / 8) * Math.PI * 2) * 4.6, 2, 2, PAL.metal[2]);
    p.ball(cx, cy, 4, 4, PAL.metal, 0, 4);
    p.ell(cx, cy, 1.5, 1.5, PAL.ink);
  },
  ic_seed: (p, cx, cy) => {
    p.ball(cx, cy + 2, 3.4, 2.8, PAL.bark.slice(1), 0, 5);
    p.rect(cx - 0.5, cy - 3, 1, 3, PAL.leaf[3]);
    p.rect(cx + 0.5, cy - 4, 2, 1, PAL.leaf[5]);
    p.rect(cx - 2.5, cy - 3, 2, 1, PAL.leaf[4]);
  },
  ic_compass: (p, cx, cy) => {
    p.ell(cx, cy, 5.4, 5.4, PAL.gold[2]);
    p.ell(cx, cy, 4.2, 4.2, PAL.cream[3]);
    p.poly([[cx - 1, cy], [cx, cy - 4], [cx + 1, cy]], PAL.red[2]);
    p.poly([[cx - 1, cy], [cx, cy + 4], [cx + 1, cy]], PAL.metal[2]);
  },
};

export function paintIcons(atlas: Atlas): void {
  for (const [name, rows] of Object.entries(GLYPHS)) atlas.add(`ic_${name}`, glyph(rows));
  for (const [name, paint] of Object.entries(PAINTED)) {
    const p = roomy(14, 14);
    paint(p, p.w / 2, p.h / 2);
    atlas.add(name, ink(p));
  }
}
