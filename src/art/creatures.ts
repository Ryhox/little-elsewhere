import { PAL } from '@/config/palette';
import type { Atlas } from '@/engine/atlas';
import { Pix, type Ramp } from '@/engine/pix';
import { hash2 } from '@/engine/rng';
import { ink, ROOM } from './kit';

const roomy = (w: number, h: number) => new Pix(w + ROOM * 2, h + ROOM * 2);

/** A body pose. Every walking creature is baked in all of these. */
interface Pose {
  /** Squash by this many pixels. */
  bob: number;
  /** Which foot leads: -1, 0 or 1. */
  step: number;
  blink: boolean;
}

/** Frame order shared by all walkers. Animation tables in config/creatures.ts index into this. */
export const WALKER_POSES: readonly Pose[] = [
  { bob: 0, step: 0, blink: false },
  { bob: 1, step: 0, blink: false },
  { bob: 0, step: 1, blink: false },
  { bob: 0, step: -1, blink: false },
  { bob: 0, step: 0, blink: true },
];

type Brush = (p: Pix, cx: number, cy: number, pose: Pose) => void;

interface WalkerSpec {
  w: number;
  h: number;
  rx: number;
  ry: number;
  body: Ramp;
  belly?: number;
  eye?: number;
  /** Eye spacing from the face centre, and how far the face is turned toward the right. */
  eyeGap?: number;
  face?: number;
  eyeY?: number;
  blush?: boolean;
  feet?: number;
  feetGap?: number;
  /** Painted behind the body (tails, spikes, shells). */
  back?: Brush;
  /** Painted over the body (leaves, hats, markings). */
  deco?: Brush;
}

function walker(spec: WalkerSpec, pose: Pose, seed: number): Pix {
  const p = roomy(spec.w, spec.h);
  const cx = Math.floor(p.w / 2);
  const ground = ROOM + spec.h - 1;
  const cy = ground - spec.ry - 1 + pose.bob;
  spec.back?.(p, cx, cy, pose);

  if (spec.feet !== undefined) {
    const gap = spec.feetGap ?? 2;
    const lead = pose.step;
    p.rect(cx - gap - 1 + (lead > 0 ? 1 : 0), ground - (lead < 0 ? 1 : 0), 2, 1, spec.feet);
    p.rect(cx + gap + (lead < 0 ? 1 : 0), ground - (lead > 0 ? 1 : 0), 2, 1, spec.feet);
  }
  p.ball(cx + 0.5, cy, spec.rx, spec.ry - pose.bob * 0.5, spec.body, 0.1, seed);
  if (spec.belly !== undefined) {
    for (let y = 0; y <= spec.ry; y++) for (let x = -spec.rx; x <= spec.rx; x++) {
      const nx = (x - 0.6) / (spec.rx * 0.62);
      const ny = (y - spec.ry * 0.45) / (spec.ry * 0.6);
      if (nx * nx + ny * ny <= 1) p.over(cx + x, cy + y, spec.belly);
    }
  }
  const face = spec.face ?? 1;
  const gap = spec.eyeGap ?? 2;
  const eyeY = cy - 1 + (spec.eyeY ?? 0);
  const eye = spec.eye ?? PAL.ink;
  for (const ex of [cx + face - gap, cx + face + gap]) {
    if (pose.blink) p.over(ex, eyeY + 1, eye);
    else {
      p.over(ex, eyeY, eye);
      p.over(ex, eyeY + 1, eye);
    }
  }
  if (spec.blush) {
    p.over(cx + face - gap - 1, eyeY + 2, PAL.pink[2]);
    p.over(cx + face + gap + 1, eyeY + 2, PAL.pink[2]);
  }
  spec.deco?.(p, cx, cy, pose);
  return ink(p);
}

/** The walking folk of Little Elsewhere. Add a spec here and it is baked in every pose. */
const WALKERS: Record<string, WalkerSpec> = {
  sproutling: {
    w: 13, h: 16, rx: 5, ry: 5, body: PAL.grass.slice(1), belly: PAL.cream[3], blush: true, feet: PAL.grass[0],
    deco: (p, cx, cy, pose) => {
      const top = cy - 5 + pose.bob;
      p.set(cx, top - 1, PAL.leaf[2]);
      p.set(cx, top - 2, PAL.leaf[2]);
      p.rect(cx - 2, top - 3 + pose.bob, 2, 1, PAL.leaf[4]);
      p.set(cx - 3, top - 2 + pose.bob, PAL.leaf[3]);
      p.rect(cx + 1, top - 3, 2, 1, PAL.leaf[5]);
      p.set(cx + 3, top - 4 + pose.bob, PAL.leaf[4]);
    },
  },
  mossling: {
    w: 15, h: 14, rx: 6, ry: 5, body: [PAL.leafDeep[0], PAL.moss[0], PAL.moss[1], PAL.moss[2], PAL.moss[3]], feet: PAL.bark[1], feetGap: 3, eye: PAL.cream[3],
    back: (p, cx, cy) => {
      for (let a = 0; a < 26; a++) {
        const t = (a / 26) * Math.PI * 2;
        if (hash2(a, 0, 3) < 0.6) p.set(cx + 0.5 + Math.cos(t) * 6.8, cy + Math.sin(t) * 5.6, PAL.moss[1 + (a % 2)]);
      }
    },
    deco: (p, cx, cy, pose) => {
      const top = cy - 5 + pose.bob;
      p.rect(cx - 4, top - 2, 3, 2, PAL.red[2]);
      p.set(cx - 4, top - 2, PAL.cream[3]);
      p.set(cx - 3, top, PAL.cream[2]);
      p.set(cx + 3, top - 1, PAL.bark[3]);
      p.set(cx + 4, top - 2, PAL.bark[3]);
    },
  },
  pebblefolk: {
    w: 13, h: 15, rx: 5, ry: 5.5, body: PAL.stone.slice(1), feet: PAL.stone[0], eye: PAL.magic[3],
    deco: (p, cx, cy, pose) => {
      const top = cy - 5 + pose.bob;
      p.rect(cx - 2, top - 1, 4, 1, PAL.moss[2]);
      p.set(cx - 1, top - 2, PAL.moss[3]);
      p.set(cx + 1, top - 2, PAL.moss[2]);
      p.over(cx - 3, cy + 2, PAL.stone[1]);
      p.over(cx - 2, cy + 3, PAL.stone[1]);
      p.set(cx - 6, cy + 1 - pose.step, PAL.stone[3]);
      p.set(cx + 6, cy + 1 + pose.step, PAL.stone[2]);
    },
  },
  thistlehog: {
    w: 16, h: 12, rx: 6.5, ry: 4.4, body: PAL.cream, feet: PAL.bark[1], feetGap: 3, face: 4, eyeGap: 1, eyeY: 1,
    back: (p, cx, cy, pose) => {
      for (let i = -6; i <= 4; i++) {
        const lift = 3 - Math.abs(i + 1) * 0.35 + (i & 1);
        for (let j = 0; j < lift + 4; j++) p.set(cx + i, cy - 2 - j + pose.bob, j > lift ? PAL.bark[3] : PAL.bark[1 + (i & 1)]);
      }
    },
    deco: (p, cx, cy) => {
      for (let i = -6; i <= 2; i++) for (let j = -4; j <= 0; j++) if ((i + j) % 2 === 0) p.over(cx + i, cy + j, PAL.bark[2]);
      p.set(cx + 7, cy + 1, PAL.ink);
    },
  },
  tumblebug: {
    w: 15, h: 13, rx: 6, ry: 4.4, body: PAL.orange, feet: PAL.ink, feetGap: 3, face: 4, eyeGap: 1, eyeY: 1,
    deco: (p, cx, cy, pose) => {
      p.rect(cx - 1, cy - 4, 1, 7, PAL.orange[0]);
      for (const [dx, dy] of [[-4, -1], [-3, 2], [2, -2]]) p.over(cx + dx, cy + dy, PAL.ink);
      p.set(cx + 6, cy - 3 - pose.bob, PAL.ink);
      p.set(cx + 7, cy - 4 - pose.bob, PAL.ink);
      p.set(cx, cy + 5 - (pose.step ? 1 : 0), PAL.ink);
    },
  },
  tinker: {
    w: 13, h: 16, rx: 4.6, ry: 5, body: PAL.copper, feet: PAL.metal[1], eye: PAL.magic[3], belly: PAL.copper[4],
    back: (p, cx, cy, pose) => {
      p.rect(cx - 7, cy - 1, 3, 1, PAL.metal[3]);
      p.rect(cx - 8, cy - 2 - pose.step, 1, 3 + pose.step * 2, PAL.gold[3]);
    },
    deco: (p, cx, cy, pose) => {
      const top = cy - 5 + pose.bob;
      p.rect(cx, top - 3, 1, 3, PAL.metal[2]);
      p.rect(cx - 1, top - 4, 3, 2, pose.blink ? PAL.ember[2] : PAL.ember[4]);
      p.over(cx - 1, cy + 2, PAL.metal[1]);
      p.over(cx + 1, cy + 2, PAL.metal[1]);
    },
  },
  frog: {
    w: 13, h: 11, rx: 5, ry: 3.8, body: PAL.teal, belly: PAL.cream[3], feet: PAL.teal[1], feetGap: 3, eyeY: -3, eye: PAL.ink,
    back: (p, cx, cy, pose) => {
      p.ball(cx - 1.5, cy - 3 + pose.bob, 1.8, 1.8, PAL.teal, 0, 1);
      p.ball(cx + 3.5, cy - 3 + pose.bob, 1.8, 1.8, PAL.teal, 0, 2);
    },
    deco: (p, cx, cy, pose) => {
      if (pose.bob) p.ell(cx + 1, cy + 2, 2.4, 1.8, PAL.cream[3]);
    },
  },
  owl: {
    w: 13, h: 15, rx: 5, ry: 5.6, body: PAL.bark.slice(1), belly: PAL.cream[2], face: 0, eyeGap: 2, eyeY: -1,
    back: (p, cx, cy) => {
      p.set(cx - 4, cy - 6, PAL.bark[2]);
      p.set(cx + 4, cy - 6, PAL.bark[2]);
      p.set(cx - 3, cy - 5, PAL.bark[3]);
      p.set(cx + 4, cy - 5, PAL.bark[3]);
    },
    deco: (p, cx, cy, pose) => {
      for (const ex of [cx - 2, cx + 2]) {
        p.ell(ex + 0.5, cy - 1.5, 1.9, 1.9, PAL.cream[3]);
        if (pose.blink) p.rect(ex - 1, cy - 1, 3, 1, PAL.bark[1]);
        else p.set(ex, cy - 2, PAL.ink);
      }
      p.set(cx, cy, PAL.gold[2]);
      for (let i = -2; i <= 2; i += 2) p.over(cx + i, cy + 3, PAL.bark[2]);
    },
  },
  gloamcat: {
    w: 16, h: 16, rx: 5, ry: 5, body: PAL.night, eye: PAL.gold[3], face: 1, eyeGap: 2, eyeY: -3,
    back: (p, cx, cy, pose) => {
      for (let i = 0; i < 7; i++) p.set(cx - 5 - Math.round(Math.sin(i * 0.6) * 2), cy + 4 - i + pose.bob, PAL.night[2]);
      p.ball(cx + 1.5, cy - 5, 4.2, 3.8, PAL.night, 0.05, 2);
      p.poly([[cx - 2, cy - 7], [cx - 2, cy - 11], [cx + 1, cy - 8]], PAL.night[2]);
      p.poly([[cx + 3, cy - 8], [cx + 5, cy - 11], [cx + 5, cy - 7]], PAL.night[1]);
    },
    deco: (p, cx, cy) => {
      for (const [dx, dy] of [[-2, 1], [2, 3], [0, -1], [3, 0]]) p.over(cx + dx, cy + dy, PAL.white);
      p.set(cx + 2, cy - 4, PAL.pink[2]);
    },
  },
  peddler: {
    w: 18, h: 18, rx: 7, ry: 5.6, body: [PAL.leafDeep[0], PAL.leafDeep[1], PAL.moss[1], PAL.moss[2], PAL.moss[3]], belly: PAL.cream[3], feet: PAL.leafDeep[1], feetGap: 4, eyeY: -4, blush: true,
    back: (p, cx, cy, pose) => {
      p.ball(cx - 2, cy - 4 + pose.bob, 2.2, 2.2, PAL.moss, 0, 1);
      p.ball(cx + 4, cy - 4 + pose.bob, 2.2, 2.2, PAL.moss, 0, 2);
    },
    deco: (p, cx, cy, pose) => {
      const top = cy - 7 + pose.bob;
      p.rect(cx - 4, top, 10, 1, PAL.violet[1]);
      p.rect(cx - 2, top - 5, 6, 5, PAL.violet[2]);
      p.rect(cx - 2, top - 5, 2, 5, PAL.violet[3]);
      p.rect(cx - 2, top - 2, 6, 1, PAL.gold[3]);
    },
  },
};
export const WALKER_NAMES = Object.keys(WALKERS);

/** Wing-beat frames for fliers, as wing lift in -1..1 (up → down). */
const FLAP: readonly number[] = [1, 0.2, -0.8];
export const FLAP_FRAMES = FLAP.length;

interface FlierSpec {
  wing: Ramp;
  body: Ramp;
  span: number;
  /** Extra markings, painted last. */
  mark?: (p: Pix, cx: number, cy: number) => void;
}

function flier(spec: FlierSpec, lift: number): Pix {
  const p = roomy(spec.span * 2 + 4, spec.span * 2 + 2);
  const cx = Math.floor(p.w / 2);
  const cy = Math.floor(p.h / 2);
  for (const side of [-1, 1]) {
    for (let u = 1; u <= spec.span; u++) {
      const reach = Math.round(spec.span * 0.9 * (1 - Math.abs(u / spec.span - 0.55) * 1.3)) + 1;
      for (let v = 0; v < reach; v++) {
        const y = cy - Math.round(u * 0.45 * lift) - Math.round(v * (lift >= 0 ? 1 : -0.6));
        p.set(cx + side * u, y, spec.wing[Math.min(spec.wing.length - 1, 1 + ((u + v) % 2) + (v === reach - 1 ? 1 : 0) + (side < 0 ? 1 : 0))]);
      }
    }
  }
  p.rect(cx, cy - 1, 1, 4, spec.body[1]);
  p.set(cx, cy - 2, spec.body[2]);
  spec.mark?.(p, cx, cy);
  return ink(p);
}

/** Flying creatures. Butterfly colours live here; add a ramp to see a new kind in the world. */
const BUTTERFLY_WINGS: readonly Ramp[] = [PAL.orange, PAL.blue, PAL.pink, PAL.yellow, PAL.violet];
export const BUTTERFLY_KINDS = BUTTERFLY_WINGS.length;

const FLIERS: Record<string, FlierSpec> = {
  flutterling: {
    wing: PAL.lilac, body: PAL.pink, span: 5,
    mark: (p, cx, cy) => {
      p.ball(cx + 0.5, cy + 0.5, 2.2, 2.4, PAL.pink.slice(1), 0, 1);
      p.set(cx - 1, cy, PAL.ink);
      p.set(cx + 1, cy, PAL.ink);
      p.set(cx - 1, cy - 3, PAL.pink[1]);
      p.set(cx + 1, cy - 3, PAL.pink[1]);
    },
  },
  moonmoth: {
    wing: PAL.grassWinter, body: PAL.lilac, span: 6,
    mark: (p, cx, cy) => {
      p.ball(cx + 0.5, cy + 0.5, 2, 2.8, PAL.lilac, 0.1, 2);
      p.over(cx - 4, cy - 1, PAL.gold[3]);
      p.over(cx + 4, cy - 1, PAL.gold[3]);
      p.set(cx - 1, cy - 3, PAL.lilac[1]);
      p.set(cx + 1, cy - 3, PAL.lilac[1]);
    },
  },
  golden: { wing: PAL.gold, body: PAL.copper, span: 5, mark: (p, cx, cy) => p.over(cx - 3, cy - 1, PAL.white).over(cx + 3, cy - 1, PAL.white) },
};

function bee(frame: number): Pix {
  const p = roomy(8, 8);
  const cx = Math.floor(p.w / 2);
  const cy = Math.floor(p.h / 2);
  p.rect(cx - 2, cy, 5, 3, PAL.yellow[2]);
  p.rect(cx - 1, cy, 1, 3, PAL.ink);
  p.rect(cx + 1, cy, 1, 3, PAL.ink);
  p.set(cx + 2, cy, PAL.yellow[3]);
  p.rect(cx - 1, cy - 2 + frame, 3, 2 - frame, PAL.white);
  return ink(p);
}

function bird(body: Ramp, lift: number): Pix {
  const p = roomy(14, 10);
  const cx = Math.floor(p.w / 2);
  const cy = Math.floor(p.h / 2);
  for (const side of [-1, 1]) {
    for (let u = 1; u <= 6; u++) {
      const y = cy - Math.round(u * 0.6 * lift);
      p.rect(cx + side * u, y, 1, u < 4 ? 2 : 1, body[u > 4 ? 1 : 2]);
    }
  }
  p.rect(cx - 1, cy - 1, 3, 4, body[3]);
  p.set(cx, cy - 2, body[4]);
  p.set(cx, cy - 3, PAL.gold[2]);
  p.set(cx, cy + 3, body[1]);
  return ink(p);
}

function duck(body: Ramp, small: boolean, frame: number): Pix {
  const p = roomy(14, 11);
  const cx = Math.floor(p.w / 2);
  const base = ROOM + 10;
  const scale = small ? 0.7 : 1;
  p.ball(cx, base - 3 * scale, 5 * scale, 3.2 * scale, body, 0.05, 1);
  p.ball(cx + 4 * scale, base - 6.4 * scale + frame * 0.6, 2.6 * scale, 2.6 * scale, body, 0, 2);
  p.rect(cx + 6 * scale, base - 6 * scale + frame, 2, 1, PAL.orange[2]);
  p.set(cx + 4 * scale, base - 7 * scale + frame, PAL.ink);
  p.over(cx - 2, base - 3 * scale, body[1]);
  for (let x = 0; x < p.w; x++) p.clear(x, base);
  return ink(p);
}

function fish(body: Ramp, frame: number): Pix {
  const p = roomy(12, 7);
  const cx = Math.floor(p.w / 2);
  const cy = Math.floor(p.h / 2);
  p.alpha = 190;
  p.ell(cx + 1, cy + 0.5, 4, 1.8, body[2]);
  p.rect(cx - 1, cy, 3, 1, PAL.white);
  p.poly([[cx - 3, cy + 0.5], [cx - 6, cy - 2 + frame], [cx - 6, cy + 3 - frame]], body[3]);
  p.set(cx + 3, cy, PAL.ink);
  p.alpha = 255;
  return p;
}

function wisp(frame: number): Pix {
  const p = roomy(8, 10);
  const cx = p.w / 2;
  const cy = ROOM + 4;
  p.ball(cx, cy, 2.8, 2.8, PAL.magic.slice(1), 0, 1);
  p.set(cx - 1 + frame, cy + 3, PAL.magic[3]);
  p.set(cx - frame, cy + 5, PAL.magic[2]);
  p.set(cx - 1, cy - 1, PAL.white);
  return p;
}

function cloudWhale(frame: number): Pix {
  const p = roomy(60, 30);
  const cx = p.w / 2;
  const cy = p.h / 2;
  const sky: Ramp = [PAL.lilac[1], PAL.lilac[2], PAL.lilac[3], PAL.grassWinter[4], PAL.white];
  p.poly([[cx - 20, cy], [cx - 30, cy - 8 + frame * 3], [cx - 26, cy + 1], [cx - 30, cy + 7 - frame * 2]], sky[2]);
  p.ball(cx + 2, cy, 24, 10, sky, 0.05, 4);
  for (let x = -14; x < 20; x += 4) p.over(cx + x, cy + 6, sky[1]);
  for (let x = -12; x < 18; x += 4) p.over(cx + x + 2, cy + 8, sky[1]);
  p.poly([[cx + 4, cy + 6], [cx - 2, cy + 13 + frame], [cx + 9, cy + 8]], sky[2]);
  p.rect(cx + 17, cy - 2, 2, 2, PAL.ink);
  p.set(cx + 17, cy - 2, PAL.white);
  for (const [dx, dy] of [[-8, -6], [0, -8], [8, -5], [-14, -2]]) p.over(cx + dx, cy + dy, PAL.gold[4]);
  return ink(p);
}

/** Light tone a glowing flier carries with it. */
const FLIER_GLOW: Record<string, string> = { moonmoth: 'moon', golden: 'gold' };
const BIRD_BODIES: readonly Ramp[] = [PAL.blue, PAL.red, PAL.cream];
export const BIRD_KINDS = BIRD_BODIES.length;

/** Things that hover are anchored at their middle, not their feet. */
function addCentered(atlas: Atlas, name: string, pix: Pix, tone?: string): void {
  const ax = Math.floor(pix.w / 2);
  const ay = Math.floor(pix.h / 2);
  atlas.add(name, pix, { flip: true, ax, ay, lights: tone ? [{ x: ax, y: ay, r: 13, tone }] : undefined });
}

export function paintCreatures(atlas: Atlas): void {
  Object.entries(WALKERS).forEach(([name, spec], index) => {
    WALKER_POSES.forEach((pose, i) => atlas.add(`${name}_${i}`, walker(spec, pose, 500 + index), { flip: true }));
  });
  for (const [name, spec] of Object.entries(FLIERS)) {
    FLAP.forEach((lift, i) => addCentered(atlas, `${name}_${i}`, flier(spec, lift), FLIER_GLOW[name]));
  }
  BUTTERFLY_WINGS.forEach((wing, kind) => FLAP.forEach((lift, i) => addCentered(atlas, `butterfly_${kind}_${i}`, flier({ wing, body: PAL.bark, span: 3 }, lift))));
  BIRD_BODIES.forEach((body, kind) => FLAP.forEach((lift, i) => addCentered(atlas, `bird_${kind}_${i}`, bird(body, lift))));
  for (let f = 0; f < 2; f++) {
    addCentered(atlas, `bee_${f}`, bee(f));
    addCentered(atlas, `fish_0_${f}`, fish(PAL.orange, f));
    addCentered(atlas, `fish_1_${f}`, fish(PAL.cream, f));
    addCentered(atlas, `wisp_${f}`, wisp(f), 'cool');
    addCentered(atlas, `whale_${f}`, cloudWhale(f));
    atlas.add(`duck_${f}`, duck(PAL.grassWinter, false, f), { flip: true });
    atlas.add(`duckling_${f}`, duck(PAL.yellow, true, f), { flip: true });
  }
}
