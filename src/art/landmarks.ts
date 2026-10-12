import { PAL } from '@/config/palette';
import type { Atlas } from '@/engine/atlas';
import { Pix, shade } from '@/engine/pix';
import { hash2, mulberry } from '@/engine/rng';
import { berryStamp, blossomStamp, boards, chevronRoof, foliage, ink, masonry, ornaments, planks, ROOM, trunk, windowAt } from './kit';
import { mushroomCap, paintFlower } from './nature';

const roomy = (w: number, h: number) => new Pix(w + ROOM * 2, h + ROOM * 2);

/** How many looks the spring has as it is upgraded, and how many frames its water animates through. */
export const SPRING_TIERS = 5;
export const SPRING_FRAMES = 4;

function spring(tier: number, frame: number, atlas: Atlas): void {
  const p = roomy(52, 40);
  const cx = p.w / 2;
  const cy = ROOM + 26;
  const count = 14;
  // A bed of trodden earth and dark turf roots the basin in the ground.
  p.ell(cx, cy + 2.5, 26, 13.5, PAL.grass[0]);
  p.ell(cx, cy + 2, 24.5, 12.4, PAL.cliff[2]);
  p.ell(cx - 1, cy + 1.4, 22.5, 11, PAL.cliff[3]);
  const rock = PAL.stone.slice(0, 5);
  const stone = (i: number) => {
    const a = (i / count) * Math.PI * 2 + 0.2;
    const x = cx + Math.cos(a) * 19;
    const y = cy + Math.sin(a) * 9;
    const gilded = tier >= 4 && i % 2 === 0;
    p.ball(x, y, 4.2 + (i % 3) * 0.5, 3.4 + (i % 2) * 0.4, gilded ? PAL.gold : rock, 0.2, i);
    if (tier >= 1 && !gilded && i % 3 !== 1) for (let k = -2; k <= 1; k++) p.over(x + k, y - 3, PAL.moss[2 + (k & 1)]);
    if (tier >= 2 && Math.sin(a) > 0.3 && i % 2 === 1) {
      p.over(x, y - 1, PAL.magic[3]);
      p.over(x, y, PAL.magic[4]);
      p.over(x + 1, y + 1, PAL.magic[3]);
    }
  };
  for (let i = 0; i < count; i++) if (Math.sin((i / count) * Math.PI * 2 + 0.2) < 0) stone(i);

  p.ell(cx, cy, 16.5, 7.4, PAL.magic[1]);
  p.ell(cx, cy - 0.4, 15, 6.2, PAL.magic[2]);
  const phase = (frame / SPRING_FRAMES) * Math.PI * 2;
  p.ell(cx + Math.cos(phase) * 3, cy - 1 + Math.sin(phase) * 1.2, 8, 2.6, PAL.magic[3]);
  const r = mulberry(40 + frame);
  for (let i = 0; i < 6; i++) p.over(cx - 12 + r() * 24, cy - 4 + r() * 8, PAL.magic[4]);

  if (tier >= 3) {
    p.poly([[cx - 4, cy - 2], [cx - 4, cy - 15], [cx, cy - 20], [cx, cy - 2]], PAL.crystal[3]);
    p.poly([[cx, cy - 2], [cx, cy - 20], [cx + 4, cy - 15], [cx + 4, cy - 2]], PAL.crystal[1]);
    p.line(cx - 3, cy - 14, cx - 3, cy - 4, PAL.crystal[4]);
  }
  const jet = (tier >= 3 ? 9 : 7) + [0, 2, 3, 1][frame];
  const ringRx = 4 + frame;
  for (let a = 0; a < 20; a++) {
    const t = (a / 20) * Math.PI * 2;
    if (a % 2 === frame % 2) p.over(cx + Math.cos(t) * ringRx, cy + 1 + Math.sin(t) * (1.4 + frame * 0.5), PAL.magic[4]);
  }
  if (tier < 3) for (let j = 0; j < jet; j++) p.rect(cx - 1, cy - 1 - j, 3, 1, j % 2 ? PAL.magic[4] : PAL.magic[3]);
  const crest = tier >= 3 ? cy - 21 : cy - 1 - jet;
  p.rect(cx - 2, crest - 1, 5, 2, PAL.white);
  p.rect(cx - 1, crest - 2, 3, 1, PAL.magic[4]);
  p.set(cx - 4, crest + 1 + frame, PAL.magic[4]);
  p.set(cx + 4, crest + 2 + ((frame + 2) % SPRING_FRAMES), PAL.magic[4]);
  p.set(cx - 6, crest + 4 + ((frame + 1) % SPRING_FRAMES), PAL.white);

  for (let i = 0; i < count; i++) if (Math.sin((i / count) * Math.PI * 2 + 0.2) >= 0) stone(i);
  if (tier >= 1) {
    paintFlower(p, 'daisy', PAL.cream, cx - 24, cy + 9);
    paintFlower(p, 'tulip', PAL.pink, cx + 24, cy + 8);
  }
  if (tier >= 2) paintFlower(p, 'bell', PAL.blue, cx - 20, cy - 7);
  ink(p);
  atlas.add(`spring_${tier}_${frame}`, p, {
    ax: cx,
    ay: cy + 11,
    glow: [[cx - 12, cy - 4, 24, 8]],
    lights: [{ x: cx, y: cy - 2, r: 34 + tier * 5, tone: 'cool' }],
  });
}

/** The Elder Tree grows through these stages as rings are earned: [scale, lanterns, hollow home]. */
const ELDER_STAGES: readonly [number, number, boolean][] = [
  [1.9, 0, false],
  [2.6, 4, false],
  [3.3, 8, true],
];
export const ELDER_STAGE_COUNT = ELDER_STAGES.length;

/** `bloom` paints the Elder Tree as it looks at the end of the story: its last stage, covered in blossom. */
function elderTree(stage: number, atlas: Atlas, bloom = false): void {
  const [scale, lanterns, hollow] = ELDER_STAGES[stage];
  const w = Math.round(34 * scale);
  const h = Math.round(42 * scale);
  const p = roomy(w, h);
  const cx = p.w / 2;
  const base = ROOM + h - 2;
  const trunkW = Math.round(7 * scale);
  trunk(p, cx, ROOM + Math.round(h * 0.5), base, trunkW);
  for (const side of [-1, 1]) {
    p.line(cx + side * trunkW * 0.5, base - 4, cx + side * (trunkW * 0.5 + 6), base, PAL.bark[2]);
    p.line(cx + side * trunkW * 0.5, base - 3, cx + side * (trunkW * 0.5 + 5), base, PAL.bark[1]);
  }
  foliage(p, cx, ROOM + h * 0.34, w * 0.45, h * 0.31, bloom ? PAL.blossom : PAL.leafDeep, 300 + stage, Math.round(10 * scale));
  // Golden elder-fruit ripen in the canopy as the tree ages; in bloom, blossoms join them.
  if (bloom) ornaments(p, 60, 77, 6, blossomStamp(p, PAL.cream), ROOM + Math.round(h * 0.58));
  ornaments(p, 6 + stage * 8, 9 + stage, 8, berryStamp(p, PAL.gold), ROOM + Math.round(h * 0.56));
  const glow: number[][] = [];
  const lights = [{ x: cx, y: ROOM + h * 0.36, r: 40 + stage * 14, tone: 'gold' }];
  // Lanterns hang from the underside of the canopy, spread evenly on either side of the trunk.
  const clear = trunkW / 2 + 9;
  const reach = w * 0.4;
  for (let i = 0; i < lanterns; i++) {
    const side = i % 2 ? 1 : -1;
    const slot = Math.floor(i / 2);
    const perSide = Math.ceil(lanterns / 2);
    const x = Math.round(cx + side * (clear + ((slot + 0.5) / perSide) * (reach - clear)));
    let branch = base;
    while (branch > ROOM && !p.solid(x, branch)) branch--;
    const cord = 2 + ((i * 3) % 4);
    const y = branch + cord + 1;
    p.rect(x, branch + 1, 1, cord, PAL.ink);
    p.rect(x - 1, y, 3, 1, PAL.metal[1]);
    p.rect(x - 1, y + 1, 3, 3, PAL.ember[3]);
    p.set(x, y + 2, PAL.ember[4]);
    p.set(x, y + 4, PAL.metal[1]);
    glow.push([x - 1, y + 1, 3, 3]);
    lights.push({ x, y: y + 2, r: 14, tone: 'warm' });
  }
  if (hollow) {
    p.ell(cx, base - 6, 4.5, 7, PAL.woodDark[0]);
    boards(p, cx - 3, base - 10, 6, 10, PAL.wood, 2);
    p.set(cx + 1, base - 5, PAL.gold[3]);
    glow.push(windowAt(p, cx - 8, base - 22, 4, 4), windowAt(p, cx + 4, base - 26, 4, 4));
  }
  ink(p);
  atlas.add(bloom ? 'elder_bloom' : `elder_${stage}`, p, { glow, lights });
}

function sundial(): Pix {
  const p = roomy(24, 18);
  const cx = p.w / 2;
  const cy = ROOM + 10;
  p.ell(cx, cy + 2, 11, 6, PAL.stone[1]);
  p.ell(cx, cy, 11, 6, PAL.stone[4]);
  p.ell(cx, cy, 8.6, 4.4, PAL.stone[5]);
  for (let i = 0; i < 12; i++) p.set(cx + Math.cos((i / 12) * Math.PI * 2) * 9.4, cy + Math.sin((i / 12) * Math.PI * 2) * 4.8, PAL.stone[1]);
  p.line(cx, cy, cx + 6, cy + 2, PAL.stone[2]);
  p.poly([[cx - 1, cy + 1], [cx + 1, cy + 1], [cx + 1, cy - 8]], PAL.gold[2]);
  p.set(cx, cy - 6, PAL.gold[4]);
  return ink(p);
}

function chime(atlas: Atlas): void {
  const p = roomy(26, 30);
  const x0 = ROOM;
  const base = ROOM + 29;
  for (const x of [1, 22]) boards(p, x0 + x, base - 24, 3, 25, PAL.wood, 3);
  planks(p, x0 - 1, base - 27, 28, 3, PAL.woodDark);
  p.rect(x0 - 1, base - 27, 28, 1, PAL.wood[4]);
  [6, 10, 16, 20].forEach((x, i) => {
    const len = 8 + ((i * 5) % 7);
    p.rect(x0 + x, base - 24, 1, 3, PAL.ink);
    p.rect(x0 + x - 1, base - 21, 2, len, PAL.gold[2]);
    p.rect(x0 + x - 1, base - 21, 1, len, PAL.gold[4]);
  });
  p.rect(x0 + 13, base - 24, 1, 6, PAL.ink);
  p.ball(x0 + 13.5, base - 14, 3.4, 3.4, PAL.gold, 0, 1);
  ink(p);
  atlas.add('chime', p, { snow: true, glow: [[x0 + 11, base - 17, 5, 6]], lights: [{ x: x0 + 13, y: base - 14, r: 26, tone: 'gold' }] });
}

function fountain(frame: number): Pix {
  const p = roomy(28, 26);
  const cx = p.w / 2;
  const cy = ROOM + 18;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    p.ball(cx + Math.cos(a) * 11, cy + Math.sin(a) * 5, 3, 2.6, PAL.stone, 0.2, i);
  }
  p.ell(cx, cy, 9.4, 3.8, PAL.water[3]);
  p.ell(cx + (frame ? 2 : -2), cy - 0.6, 5, 1.6, PAL.water[4]);
  masonry(p, cx - 2, cy - 12, 4, 12, PAL.stone, 2);
  p.ell(cx, cy - 12, 5, 2, PAL.stone[4]);
  p.ell(cx, cy - 12.4, 3.4, 1.2, PAL.water[4]);
  for (const side of [-1, 1]) {
    for (let t = 0; t < 8; t++) {
      const y = cy - 13 - Math.sin((t / 7) * Math.PI) * 4 + t * 1.2;
      if ((t + frame) % 2 === 0) p.set(cx + side * (2 + t), y, PAL.water[5]);
    }
  }
  p.rect(cx - 1, cy - 16 - frame, 2, 3 + frame, PAL.water[5]);
  return ink(p);
}

function scarecrow(): Pix {
  const p = roomy(20, 28);
  const cx = Math.floor(p.w / 2);
  const base = ROOM + 27;
  p.rect(cx, base - 20, 1, 21, PAL.wood[2]);
  p.rect(cx - 8, base - 17, 17, 1, PAL.wood[2]);
  p.rect(cx - 4, base - 18, 9, 8, PAL.red[2]);
  p.rect(cx - 4, base - 18, 2, 8, PAL.red[3]);
  p.rect(cx - 1, base - 15, 3, 3, PAL.blue[2]);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) p.set(cx + side * (8 + (i % 2)), base - 17 + i, PAL.thatch[3]);
  p.ball(cx + 0.5, base - 22, 3.6, 3.4, PAL.cream, 0.1, 2);
  p.set(cx - 1, base - 22, PAL.ink);
  p.set(cx + 2, base - 22, PAL.ink);
  p.rect(cx - 1, base - 20, 3, 1, PAL.red[1]);
  p.rect(cx - 5, base - 25, 11, 1, PAL.thatch[2]);
  p.rect(cx - 3, base - 28, 7, 3, PAL.thatch[3]);
  p.rect(cx - 3, base - 26, 7, 1, PAL.red[2]);
  return ink(p);
}

function well(): Pix {
  const p = roomy(22, 28);
  const cx = p.w / 2;
  const base = ROOM + 27;
  for (const x of [-8, 6]) boards(p, cx + x, base - 20, 2, 14, PAL.wood, 2);
  chevronRoof(p, cx - 11, base - 27, 22, 5, 5, PAL.roofRed);
  masonry(p, cx - 9, base - 8, 18, 9, PAL.stone, 5);
  p.ell(cx, base - 8, 9, 3, PAL.stone[4]);
  p.ell(cx, base - 8, 6.6, 1.8, PAL.water[1]);
  p.rect(cx, base - 21, 1, 9, PAL.ink);
  p.rect(cx - 1, base - 13, 3, 3, PAL.wood[3]);
  return ink(p);
}

export const WHEEL_FRAMES = 4;
const WHEEL_CANVAS = 36;

function waterWheel(frame: number): Pix {
  const p = new Pix(WHEEL_CANVAS, WHEEL_CANVAS);
  const c = p.w / 2;
  const spin = (frame / WHEEL_FRAMES) * (Math.PI / 4);
  for (let a = 0; a < 120; a++) {
    const t = (a / 120) * Math.PI * 2;
    p.set(c + Math.cos(t) * 11, c + Math.sin(t) * 11, PAL.wood[2]);
    p.set(c + Math.cos(t) * 10, c + Math.sin(t) * 10, PAL.wood[4]);
    p.set(c + Math.cos(t) * 6, c + Math.sin(t) * 6, PAL.wood[3]);
  }
  for (let i = 0; i < 8; i++) {
    const a = spin + (i / 8) * Math.PI * 2;
    p.line(c, c, c + Math.cos(a) * 11, c + Math.sin(a) * 11, PAL.woodDark[2]);
    p.rect(c + Math.cos(a) * 12 - 1, c + Math.sin(a) * 12 - 1, 3, 3, PAL.wood[1]);
  }
  p.ell(c, c, 2, 2, PAL.metal[3]);
  return ink(p);
}

function wheelhouse(atlas: Atlas): void {
  const p = roomy(26, 30);
  const x0 = ROOM + 2;
  const base = ROOM + 29;
  planks(p, x0, base - 14, 22, 15, PAL.wood);
  masonry(p, x0, base - 3, 22, 4, PAL.stone, 2);
  chevronRoof(p, x0 - 2, base - 26, 26, 8, 6, PAL.roofTeal);
  for (let i = 2; i < 24; i++) for (let j = base - 20 + Math.round(Math.abs(i - 12.5) * 0.64); j < base - 14; j++) p.under(x0 - 2 + i, j, PAL.wood[2]);
  const glow = [windowAt(p, x0 + 3, base - 11, 5, 5)];
  boards(p, x0 + 13, base - 10, 5, 8, PAL.woodDark, 2);
  ink(p);
  atlas.add('wheelhouse', p, { snow: true, glow, lights: [{ x: x0 + 5, y: base - 8, r: 16, tone: 'warm' }] });
}

function signpost(): Pix {
  const p = roomy(14, 16);
  const cx = Math.floor(p.w / 2);
  const base = ROOM + 15;
  p.rect(cx, base - 13, 2, 14, PAL.wood[2]);
  planks(p, cx - 5, base - 13, 11, 5, PAL.wood, 5);
  p.set(cx + 6, base - 11, PAL.wood[3]);
  p.rect(cx - 3, base - 11, 6, 1, PAL.woodDark[1]);
  return ink(p);
}

function birdbath(): Pix {
  const p = roomy(14, 16);
  const cx = p.w / 2;
  const base = ROOM + 15;
  masonry(p, cx - 1, base - 9, 3, 9, PAL.stone, 1);
  p.ell(cx + 0.5, base, 3.5, 1.4, PAL.stone[2]);
  p.ell(cx + 0.5, base - 10, 6, 2.6, PAL.stone[4]);
  p.ell(cx + 0.5, base - 10.4, 4.4, 1.5, PAL.water[4]);
  return ink(p);
}

function cart(atlas: Atlas): void {
  const p = roomy(34, 30);
  const x0 = ROOM;
  const base = ROOM + 29;
  planks(p, x0 + 3, base - 13, 28, 9, PAL.wood);
  p.rect(x0 + 3, base - 13, 28, 1, PAL.wood[5]);
  for (const x of [4, 28]) boards(p, x0 + x, base - 24, 2, 11, PAL.woodDark, 2);
  for (let i = 0; i < 32; i++) {
    const stripe = Math.floor(i / 4) % 2 ? PAL.cream[3] : PAL.red[2];
    for (let j = 0; j < 6; j++) if (!(j === 5 && i % 4 > 1)) p.set(x0 + 1 + i, base - 29 + j, j === 0 ? PAL.white : stripe);
  }
  for (const x of [9, 25]) {
    p.ell(x0 + x, base - 3, 4.4, 4.4, PAL.woodDark[1]);
    p.ell(x0 + x, base - 3, 2.8, 2.8, PAL.wood[4]);
    p.set(x0 + x, base - 3, PAL.metal[3]);
  }
  p.rect(x0 + 8, base - 17, 3, 4, PAL.blue[3]);
  p.rect(x0 + 13, base - 16, 4, 3, PAL.gold[2]);
  p.rect(x0 + 20, base - 18, 3, 5, PAL.pink[2]);
  p.rect(x0 + 30, base - 22, 3, 4, PAL.ember[3]);
  ink(p);
  atlas.add('cart', p, { snow: true, glow: [[x0 + 30, base - 22, 3, 4]], lights: [{ x: x0 + 31, y: base - 20, r: 24, tone: 'warm' }] });
}

function chest(open: boolean, atlas: Atlas): void {
  const p = roomy(16, 16);
  const x0 = ROOM + 1;
  const base = ROOM + 15;
  planks(p, x0, base - 7, 14, 8, PAL.wood);
  for (const x of [1, 11]) p.rect(x0 + x, base - 7, 2, 8, PAL.gold[2]);
  if (open) {
    p.rect(x0, base - 9, 14, 2, PAL.gold[3]);
    p.rect(x0 + 2, base - 10, 10, 2, PAL.gold[4]);
    planks(p, x0, base - 15, 14, 5, PAL.woodDark);
    p.rect(x0, base - 15, 14, 1, PAL.gold[2]);
  } else {
    planks(p, x0, base - 12, 14, 5, PAL.wood);
    p.rect(x0, base - 12, 14, 1, PAL.wood[5]);
    for (const x of [1, 11]) p.rect(x0 + x, base - 12, 2, 5, PAL.gold[3]);
    p.rect(x0 + 6, base - 8, 2, 3, PAL.gold[4]);
  }
  ink(p);
  atlas.add(open ? 'chest_open' : 'chest', p, open ? { glow: [[x0, base - 10, 14, 3]], lights: [{ x: x0 + 7, y: base - 9, r: 20, tone: 'gold' }] } : {});
}

export const SEED_STAGES = 4;

function seedPlot(stage: number, atlas: Atlas): void {
  const p = roomy(18, 22);
  const cx = Math.floor(p.w / 2);
  const base = ROOM + 21;
  p.ball(cx + 0.5, base - 1, 8, 4, PAL.soil, 0.4, 3);
  for (let x = 0; x < p.w; x++) p.clear(x, base + 1);
  for (let i = 0; i < 5; i++) p.ball(cx - 7 + i * 3.6, base, 1.6, 1.3, PAL.stone, 0.2, i);
  const glow: number[][] = [];
  if (stage >= 1) {
    const height = 2 + stage * 3;
    for (let i = 0; i < height; i++) p.set(cx + (i > 4 ? 1 : 0), base - 4 - i, PAL.leaf[3]);
    p.set(cx - 1, base - 5, PAL.leaf[4]);
    p.set(cx + 1, base - 6, PAL.leaf[5]);
    if (stage >= 2) {
      const top = base - 5 - height;
      p.ball(cx + 1, top, 1.4 + stage * 0.6, 1.6 + stage * 0.6, stage === 3 ? PAL.gold : PAL.lilac, 0, 1);
      p.set(cx, top - 1, PAL.white);
      glow.push([cx - 1, top - 2, 4, 4]);
    }
  } else {
    p.set(cx, base - 4, PAL.gold[3]);
    p.set(cx + 1, base - 4, PAL.gold[1]);
  }
  ink(p);
  atlas.add(`seedplot_${stage}`, p, glow.length ? { glow, lights: [{ x: cx, y: base - 12, r: 10 + stage * 4, tone: 'gold' }] } : {});
}

/** Wonder painters, keyed by wonder id. Each returns its painting plus the tone it glows with. */
const WONDER_ART: Record<string, (p: Pix, cx: number, base: number) => string> = {
  singing_tree: (p, cx, base) => {
    trunk(p, cx, base - 12, base, 3, PAL.barkPale);
    foliage(p, cx, base - 17, 8, 7, PAL.lilac, 7, 6);
    for (const [dx, dy] of [[-4, -19], [3, -21], [5, -15]]) {
      p.set(cx + dx, base + dy, PAL.gold[3]);
      p.set(cx + dx, base + dy - 1, PAL.gold[3]);
      p.set(cx + dx + 1, base + dy - 2, PAL.gold[4]);
    }
    return 'moon';
  },
  bubble_bloom: (p, cx, base) => {
    for (let i = 0; i < 8; i++) p.set(cx, base - i, PAL.leaf[3]);
    p.ball(cx + 0.5, base - 13, 6, 6, PAL.crystal, 0.05, 1);
    p.ell(cx - 1.5, base - 15, 1.6, 1.6, PAL.white);
    p.set(cx - 2, base - 3, PAL.leaf[4]);
    p.set(cx + 2, base - 4, PAL.leaf[4]);
    return 'cool';
  },
  lantern_vine: (p, cx, base) => {
    for (let i = 0; i < 20; i++) p.set(cx + Math.round(Math.sin(i * 0.7) * 2), base - i, PAL.leaf[2 + (i % 2)]);
    for (const [dx, dy] of [[-4, -8], [4, -12], [-3, -17]]) {
      p.rect(cx + dx - 1, base + dy, 3, 4, PAL.ember[2]);
      p.set(cx + dx, base + dy + 1, PAL.ember[4]);
    }
    return 'warm';
  },
  clockwork_rose: (p, cx, base) => {
    for (let i = 0; i < 9; i++) p.set(cx, base - i, PAL.copper[1]);
    for (let a = 0; a < 8; a++) p.rect(cx + Math.cos((a / 8) * Math.PI * 2) * 5 - 0.5, base - 13 + Math.sin((a / 8) * Math.PI * 2) * 5 - 0.5, 2, 2, PAL.copper[3]);
    p.ball(cx + 0.5, base - 13, 4, 4, PAL.copper, 0.1, 2);
    p.ell(cx + 0.5, base - 13, 1.6, 1.6, PAL.red[2]);
    return 'warm';
  },
  honey_fountain: (p, cx, base) => {
    masonry(p, cx - 1, base - 9, 3, 9, PAL.stone, 2);
    p.ell(cx + 0.5, base - 1, 6, 2.4, PAL.stone[3]);
    p.ell(cx + 0.5, base - 1.4, 4.4, 1.4, PAL.gold[2]);
    p.ball(cx + 0.5, base - 12, 4, 3, PAL.gold, 0, 3);
    p.rect(cx - 3, base - 10, 1, 6, PAL.gold[3]);
    p.rect(cx + 3, base - 10, 1, 5, PAL.gold[3]);
    return 'gold';
  },
  rainbow_cap: (p, cx, base) => {
    trunk(p, cx + 0.5, base - 9, base, 4, PAL.cream);
    mushroomCap(p, cx + 0.5, base - 12, 8, 5.4, PAL.red, 1);
    const bands = [PAL.red[2], PAL.orange[2], PAL.yellow[2], PAL.leaf[4], PAL.blue[2], PAL.violet[2]];
    for (let x = -8; x <= 8; x++) for (let y = -18; y < -9; y++) if (p.solid(cx + x, base + y) && y < -11) p.set(cx + x, base + y, bands[Math.floor(((x + 8) / 17) * bands.length)]);
    return 'gold';
  },
  cloud_cotton: (p, cx, base) => {
    for (let i = 0; i < 10; i++) p.set(cx, base - i, PAL.leaf[2]);
    for (const [dx, dy, r] of [[-4, -11, 3.4], [4, -13, 3.6], [0, -17, 4.2]]) p.ball(cx + dx + 0.5, base + dy, r, r * 0.84, PAL.grassWinter, 0.06, dx);
    return 'cool';
  },
  moon_lily: (p, cx, base) => {
    for (let i = 0; i < 11; i++) p.set(cx, base - i, PAL.leafDeep[3]);
    p.poly([[cx - 5, base - 12], [cx, base - 20], [cx + 6, base - 12], [cx, base - 10]], PAL.lilac[3]);
    p.poly([[cx - 2, base - 13], [cx, base - 19], [cx + 3, base - 13]], PAL.lilac[4]);
    p.set(cx, base - 13, PAL.gold[3]);
    p.set(cx - 2, base - 4, PAL.leafDeep[4]);
    p.set(cx + 2, base - 6, PAL.leafDeep[4]);
    return 'moon';
  },
  golden_acorn: (p, cx, base) => {
    masonry(p, cx - 4, base - 5, 9, 6, PAL.stone, 1);
    p.rect(cx - 5, base - 6, 11, 1, PAL.stone[5]);
    p.ball(cx + 0.5, base - 10, 4, 4.4, PAL.gold, 0, 1);
    p.rect(cx - 4, base - 15, 9, 3, PAL.copper[2]);
    p.rect(cx - 4, base - 15, 9, 1, PAL.copper[4]);
    p.set(cx, base - 16, PAL.copper[1]);
    return 'gold';
  },
  whisper_reed: (p, cx, base) => {
    for (const [dx, len] of [[-4, 14], [-1, 20], [2, 17], [5, 12]]) {
      for (let i = 0; i < len; i++) p.set(cx + dx + (i > len * 0.7 ? 1 : 0), base - i, PAL.teal[2 + (i % 2)]);
      p.rect(cx + dx, base - len - 2, 2, 3, PAL.glow[3]);
    }
    return 'green';
  },
};
export const WONDER_SPRITE_IDS = Object.keys(WONDER_ART);

function wonder(id: string, atlas: Atlas): void {
  const p = roomy(22, 26);
  const cx = Math.floor(p.w / 2);
  const base = ROOM + 25;
  const tone = WONDER_ART[id](p, cx, base);
  ink(p);
  atlas.add(`wonder_${id}`, p, { glow: [[cx - 4, base - 20, 9, 12]], lights: [{ x: cx, y: base - 13, r: 26, tone }] });
}

function runestone(lit: boolean, atlas: Atlas): void {
  const p = roomy(12, 18);
  const cx = p.w / 2;
  const base = ROOM + 17;
  p.ball(cx, base - 7, 4.6, 9, PAL.stone, 0.2, 6);
  for (let x = 0; x < p.w; x++) p.clear(x, base + 1);
  const mark = lit ? PAL.magic[4] : PAL.stone[1];
  p.rect(cx - 1, base - 11, 1, 6, mark);
  p.set(cx, base - 10, mark);
  p.set(cx + 1, base - 9, mark);
  p.set(cx, base - 7, mark);
  ink(p);
  atlas.add(lit ? 'rune_on' : 'rune_off', p, lit ? { glow: [[cx - 2, base - 12, 4, 8]], lights: [{ x: cx, y: base - 8, r: 18, tone: 'cool' }] } : { snow: true });
}

function campfire(frame: number, atlas: Atlas): void {
  const p = roomy(14, 16);
  const cx = p.w / 2;
  const base = ROOM + 15;
  for (let i = 0; i < 6; i++) p.ball(cx + Math.cos(i * 1.05) * 5, base - 1 + Math.sin(i * 1.05) * 1.6, 1.8, 1.4, PAL.stone, 0.2, i);
  p.line(cx - 4, base - 1, cx + 3, base - 3, PAL.bark[2]);
  p.line(cx + 4, base - 1, cx - 3, base - 3, PAL.bark[1]);
  const lean = frame ? 1 : -1;
  p.poly([[cx - 3, base - 3], [cx + lean, base - 12 - frame], [cx + 3, base - 3]], PAL.ember[1]);
  p.poly([[cx - 2, base - 3], [cx - lean * 0.5, base - 9], [cx + 2, base - 3]], PAL.ember[3]);
  p.set(cx, base - 4, PAL.ember[4]);
  ink(p);
  atlas.add(`campfire_${frame}`, p, { glow: [[cx - 3, base - 12, 6, 10]], lights: [{ x: cx, y: base - 6, r: 30, tone: 'warm' }] });
}

/** A wooden tankard of golden beer with a head of foam, painted with its top-left at (x, y). */
export function paintMug(p: Pix, x: number, y: number, small = false): void {
  const w = small ? 4 : 7;
  const h = small ? 5 : 8;
  p.rect(x, y, w, h, PAL.gold[2]);
  p.rect(x, y, Math.ceil(w / 3), h, PAL.gold[3]);
  p.rect(x + w - Math.ceil(w / 3), y, Math.ceil(w / 3), h, PAL.gold[1]);
  p.rect(x, y + Math.floor(h / 2), w, 1, PAL.wood[2]);
  p.rect(x, y + h - 1, w, 1, PAL.wood[1]);
  // Handle.
  p.rect(x + w, y + 1, small ? 1 : 2, 1, PAL.wood[3]);
  p.rect(x + w + (small ? 1 : 2), y + 2, 1, h - 4, PAL.wood[3]);
  p.rect(x + w, y + h - 2, small ? 1 : 2, 1, PAL.wood[2]);
  // Foam spilling over the rim.
  p.ell(x + w / 2, y - 0.4, w / 2 + 0.9, small ? 1.4 : 2.2, PAL.white);
  p.rect(x + 1, y + 1, 1, small ? 1 : 2, PAL.white);
  p.set(x + w - 2, y - 1, PAL.cream[2]);
}

/** Small set-dressing props: name → painter. Add an entry to make a new prop placeable in any region. */
const PROPS: Record<string, () => Pix> = {
  mug: () => {
    const p = roomy(12, 12);
    paintMug(p, ROOM + 1, ROOM + 3);
    return ink(p);
  },
  tavern_table: () => {
    const p = roomy(20, 16);
    const x0 = ROOM;
    const base = ROOM + 15;
    for (const x of [2, 15]) boards(p, x0 + x, base - 6, 3, 7, PAL.woodDark, 3);
    planks(p, x0, base - 9, 20, 3, PAL.wood, 3);
    p.rect(x0, base - 9, 20, 1, PAL.wood[5]);
    paintMug(p, x0 + 3, base - 14, true);
    paintMug(p, x0 + 12, base - 14, true);
    return ink(p);
  },
  signpost,
  birdbath,
  scarecrow,
  well,
  sundial,
  bench: () => {
    const p = roomy(16, 10);
    planks(p, ROOM, ROOM + 2, 16, 3, PAL.wood, 3);
    planks(p, ROOM, ROOM + 6, 16, 2, PAL.wood, 2);
    for (const x of [1, 13]) p.rect(ROOM + x, ROOM + 5, 2, 5, PAL.woodDark[2]);
    return ink(p);
  },
  fence: () => {
    const p = roomy(16, 10);
    for (const x of [1, 8, 14]) boards(p, ROOM + x, ROOM, 2, 10, PAL.wood, 2);
    p.rect(ROOM, ROOM + 2, 16, 1, PAL.wood[4]);
    p.rect(ROOM, ROOM + 6, 16, 1, PAL.wood[3]);
    return ink(p);
  },
  crate: () => {
    const p = roomy(10, 10);
    planks(p, ROOM, ROOM, 10, 10, PAL.wood, 3);
    p.rect(ROOM, ROOM, 10, 1, PAL.wood[5]);
    p.line(ROOM + 1, ROOM + 1, ROOM + 8, ROOM + 8, PAL.wood[1]);
    return ink(p);
  },
  barrel: () => {
    const p = roomy(10, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 9; x++) p.set(ROOM + x, ROOM + y, y === 2 || y === 9 ? PAL.metal[2] : PAL.wood[x < 3 ? 4 : x > 6 ? 1 : 3]);
    p.ell(ROOM + 4.5, ROOM + 0.6, 4.5, 1.6, PAL.wood[5]);
    return ink(p);
  },
  haybale: () => {
    const p = roomy(14, 10);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 14; x++) p.set(ROOM + x, ROOM + y, shade(PAL.thatch, 0.75 - y * 0.06 + (hash2(x, y, 2) - 0.5) * 0.3));
    p.rect(ROOM + 4, ROOM, 1, 9, PAL.red[1]);
    p.rect(ROOM + 9, ROOM, 1, 9, PAL.red[1]);
    return ink(p);
  },
  pumpkin: () => {
    const p = roomy(10, 9);
    p.ball(ROOM + 5, ROOM + 5, 4.6, 3.6, PAL.orange, 0.05, 1);
    p.rect(ROOM + 5, ROOM + 2, 1, 6, PAL.orange[1]);
    p.rect(ROOM + 4, ROOM, 2, 2, PAL.leaf[2]);
    return ink(p);
  },
  dock: () => {
    const p = roomy(20, 14);
    planks(p, ROOM, ROOM, 20, 10, PAL.wood, 3);
    p.rect(ROOM, ROOM, 20, 1, PAL.wood[5]);
    for (const x of [1, 17]) p.rect(ROOM + x, ROOM + 9, 2, 5, PAL.woodDark[1]);
    return ink(p);
  },
  stepstone: () => {
    const p = roomy(10, 7);
    p.ell(ROOM + 5, ROOM + 4, 4.6, 2.6, PAL.stone[2]);
    p.ell(ROOM + 4.6, ROOM + 3.4, 3.8, 1.9, PAL.stone[4]);
    return ink(p);
  },
};

/** Bridges are drawn from short repeating deck segments. */
function bridgeSegment(vertical: boolean): Pix {
  if (vertical) {
    const p = new Pix(22, 8);
    planks(p, 3, 0, 16, 8, PAL.wood, 4);
    for (const x of [2, 19]) p.rect(x, 0, 1, 8, PAL.woodDark[1]);
    for (const x of [1, 20]) p.rect(x, 0, 1, 8, PAL.wood[4]);
    for (const x of [0, 20]) p.rect(x, 2, 2, 3, PAL.woodDark[2]);
    return p;
  }
  const p = new Pix(8, 24);
  boards(p, 0, 5, 8, 14, PAL.wood, 4);
  p.rect(0, 5, 8, 1, PAL.woodDark[1]);
  p.rect(0, 18, 8, 1, PAL.woodDark[0]);
  p.rect(0, 3, 8, 1, PAL.wood[4]);
  p.rect(0, 16, 8, 1, PAL.wood[4]);
  p.rect(2, 0, 2, 6, PAL.woodDark[2]);
  p.rect(2, 13, 2, 8, PAL.woodDark[2]);
  p.set(2, 0, PAL.wood[4]);
  p.set(2, 13, PAL.wood[4]);
  p.rect(2, 21, 2, 3, PAL.woodDark[0]);
  return p;
}

export function paintLandmarks(atlas: Atlas): void {
  for (let tier = 0; tier < SPRING_TIERS; tier++) for (let frame = 0; frame < SPRING_FRAMES; frame++) spring(tier, frame, atlas);
  for (let stage = 0; stage < ELDER_STAGE_COUNT; stage++) elderTree(stage, atlas);
  elderTree(ELDER_STAGE_COUNT - 1, atlas, true);
  chime(atlas);
  for (let f = 0; f < 2; f++) atlas.add(`fountain_${f}`, fountain(f), { snow: true });
  for (let f = 0; f < WHEEL_FRAMES; f++) atlas.add(`wheel_${f}`, waterWheel(f), { ax: WHEEL_CANVAS / 2, ay: WHEEL_CANVAS / 2 });
  wheelhouse(atlas);
  cart(atlas);
  chest(false, atlas);
  chest(true, atlas);
  for (let s = 0; s < SEED_STAGES; s++) seedPlot(s, atlas);
  for (const id of WONDER_SPRITE_IDS) wonder(id, atlas);
  runestone(false, atlas);
  runestone(true, atlas);
  for (let f = 0; f < 2; f++) campfire(f, atlas);
  for (const [name, paint] of Object.entries(PROPS)) atlas.add(name, paint(), { snow: true });
  atlas.add('bridge_h', bridgeSegment(false), { ax: 0, ay: 12, tile: true });
  atlas.add('bridge_v', bridgeSegment(true), { ax: 11, ay: 0, tile: true });
}
