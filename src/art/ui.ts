import { PAL } from '@/config/palette';
import { Pix, type Ramp } from '@/engine/pix';

/** How much the UI skin is magnified. Borders in CSS must use multiples of this. */
export const UI_SCALE = 3;
/** The compact interface (phones, small windows) wears the same skin one size smaller. */
export const UI_SCALE_COMPACT = 2;

/** Colours of the parchment-and-wood interface. */
export const UI_COLORS = {
  parchment: 0xf7e8c6,
  parchmentShade: 0xe6d0a2,
  parchmentDeep: 0xd0b481,
  inkText: 0x4a2f2a,
  night: 0x2c2238,
  nightLight: 0x5c4a70,
} as const;

function upscaled(p: Pix, scale: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = p.w * scale;
  canvas.height = p.h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p.toCanvas(), 0, 0, canvas.width, canvas.height);
  return `url(${canvas.toDataURL()})`;
}

/** Carved wooden frame around a parchment sheet (9-slice, 5px border). */
function panelFrame(): Pix {
  const s = 16;
  const p = new Pix(s, s);
  p.rect(1, 0, s - 2, s, PAL.woodDark[0]);
  p.rect(0, 1, s, s - 2, PAL.woodDark[0]);
  p.rect(1, 1, s - 2, s - 2, PAL.wood[2]);
  p.rect(1, 1, s - 2, 1, PAL.wood[4]);
  p.rect(1, 1, 1, s - 2, PAL.wood[4]);
  p.rect(1, s - 2, s - 2, 1, PAL.wood[1]);
  p.rect(s - 2, 1, 1, s - 2, PAL.wood[1]);
  p.rect(3, 3, s - 6, s - 6, PAL.woodDark[1]);
  p.rect(4, 4, s - 8, s - 8, UI_COLORS.parchment);
  p.rect(4, 4, s - 8, 1, UI_COLORS.parchmentShade);
  for (const [x, y] of [[2, 2], [s - 3, 2], [2, s - 3], [s - 3, s - 3]]) p.set(x, y, PAL.gold[3]);
  return p;
}

/** Chunky raised button with a thick lower lip (9-slice, 4px border). */
function button(ramp: Ramp, pressed: boolean): Pix {
  const s = 12;
  const p = new Pix(s, s);
  const top = pressed ? 1 : 0;
  p.rect(1, top, s - 2, s - top, PAL.woodDark[0]);
  p.rect(0, top + 1, s, s - top - 2, PAL.woodDark[0]);
  p.rect(1, top + 1, s - 2, s - top - 2, ramp[1]);
  p.rect(1, top + 1, s - 2, s - top - (pressed ? 3 : 4), ramp[3]);
  p.rect(1, top + 1, s - 2, 1, ramp[4]);
  p.rect(2, top + 2, s - 4, 1, ramp[3]);
  return p;
}

/** Recessed slot for icons and list rows (9-slice, 3px border). */
function slot(fill: number, edge: number): Pix {
  const s = 9;
  const p = new Pix(s, s);
  p.rect(1, 0, s - 2, s, edge);
  p.rect(0, 1, s, s - 2, edge);
  p.rect(1, 1, s - 2, s - 2, fill);
  p.rect(1, 1, s - 2, 1, UI_COLORS.parchmentDeep);
  p.rect(1, 1, 1, s - 2, UI_COLORS.parchmentDeep);
  return p;
}

/** Dark plaque used for the HUD, tooltips and toasts (9-slice, 4px border). */
function plaque(): Pix {
  const s = 12;
  const p = new Pix(s, s);
  p.rect(1, 0, s - 2, s, PAL.outline);
  p.rect(0, 1, s, s - 2, PAL.outline);
  p.rect(1, 1, s - 2, s - 2, UI_COLORS.nightLight);
  p.rect(2, 2, s - 4, s - 4, UI_COLORS.night);
  p.set(1, 1, PAL.gold[3]);
  p.set(s - 2, 1, PAL.gold[3]);
  p.set(1, s - 2, PAL.gold[2]);
  p.set(s - 2, s - 2, PAL.gold[2]);
  return p;
}

const grey: Ramp = [0x6f6a66, 0x8d8782, 0xaaa49d, 0xc2bcb4, 0xd9d4cc];

/** Button colour families: CSS name → ramp. */
const BUTTONS: Record<string, Ramp> = {
  green: PAL.leaf.slice(1),
  gold: PAL.gold,
  tan: [PAL.wood[1], PAL.wood[2], PAL.wood[3], PAL.wood[4], PAL.wood[5]],
  red: PAL.red,
  blue: PAL.blue,
  off: grey,
};

/**
 * Paint the interface skin. Returns CSS custom properties (name → `url(...)`)
 * that index.css turns into 9-slice borders. Every piece comes in two sizes:
 * `--skin-name` for the roomy interface and `--skin-name-s` for the compact one.
 */
export function buildUiSkin(): Record<string, string> {
  const skin: Record<string, string> = {};
  const paint = (name: string, piece: Pix) => {
    skin[`--skin-${name}`] = upscaled(piece, UI_SCALE);
    skin[`--skin-${name}-s`] = upscaled(piece, UI_SCALE_COMPACT);
  };
  paint('panel', panelFrame());
  paint('slot', slot(UI_COLORS.parchmentShade, PAL.wood[1]));
  paint('slot-lit', slot(0xfff3c9, PAL.gold[1]));
  paint('plaque', plaque());
  for (const [name, ramp] of Object.entries(BUTTONS)) {
    paint(`btn-${name}`, button(ramp, false));
    paint(`btn-${name}-down`, button(ramp, true));
  }
  return skin;
}
