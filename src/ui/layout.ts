import { clamp } from '@/engine/rng';

export interface FreeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Sizes of the menus, in interface pixels, shared by everything that needs to know how much of the screen is free. */
export const LAYOUT = {
  /** The roomy interface (a desktop window): its panel, its strip of tabs, and the height of the purse in the corner. */
  panel: 396,
  tabs: 70,
  top: 96,
  /**
   * It needs a window at least this wide and this tall (a little less where the lesson card fits
   * beside the purse). Any narrower and its menu, purse and corner buttons start to overlap.
   */
  wide: 1000,
  high: 600,
  beside: 1280,
  highBeside: 520,
  /** The compact interface (phones, small windows): its tabs along the bottom, or down the side of a screen lying flat. */
  bar: 54,
  strip: 60,
  /** Its panel covers this share of the screen: as a sheet from the bottom, or as a drawer from the side. */
  sheet: 0.46,
  drawer: 0.42,
  /** A sheet pulled all the way up still leaves this much at the top, so the purse stays in sight. */
  sheetGap: 62,
  /** The smallest screens the compact interface is drawn for, upright and lying flat. Anything smaller sees it scaled down. */
  upright: { w: 360, h: 540 },
  flat: { w: 600, h: 340 },
} as const;

/** How far the bottom sheet is pulled up. */
export type SheetSize = 'half' | 'full';

/** How the interface arranges itself on this screen. Worked out afresh whenever the screen changes. */
export interface Layout {
  /** The menu sits down the side of the screen, or along the bottom. */
  dock: 'side' | 'bottom';
  /** The small interface for phones and little windows (false: the roomy one for a desktop). */
  compact: boolean;
  /** How much the whole interface is shrunk to fit a screen smaller than it was drawn for (1: not at all). */
  scale: number;
  /** The screen in interface pixels: its real size divided by `scale`. */
  w: number;
  h: number;
  /** Notches, rounded corners and home bars to keep clear of, in interface pixels. */
  safe: FreeArea;
  /** Thickness of the strip of tabs, and of the open panel beside it (a sheet's height when half and fully pulled up). */
  tabs: number;
  panel: number;
  full: number;
}

const NO_EDGES: FreeArea = { left: 0, right: 0, top: 0, bottom: 0 };

/** The layout before the screen has been measured: the roomy one, as on a desktop. */
export const DEFAULT_LAYOUT: Layout = { dock: 'side', compact: false, scale: 1, w: 1280, h: 720, safe: NO_EDGES, tabs: LAYOUT.tabs, panel: LAYOUT.panel, full: LAYOUT.panel };

/** Does the roomy interface fit a window of this size? */
const roomy = (width: number, height: number) => width >= LAYOUT.wide && height >= (width >= LAYOUT.beside ? LAYOUT.highBeside : LAYOUT.high);

/**
 * Choose the interface for a screen of `width` × `height` CSS pixels. A big window gets the roomy
 * one. Anything else gets the compact one, with its menu along the bottom when the screen stands
 * upright and down the side when it lies flat, and scaled down as a whole if even that is too big.
 */
export function measureLayout(width: number, height: number, edges: FreeArea = NO_EDGES): Layout {
  if (roomy(width, height)) {
    const w = width - edges.left - edges.right;
    const h = height - edges.top - edges.bottom;
    return { dock: 'side', compact: false, scale: 1, w, h, safe: edges, tabs: LAYOUT.tabs, panel: LAYOUT.panel, full: LAYOUT.panel };
  }
  const fit = (min: { w: number; h: number }) => Math.min(1, width / min.w, height / min.h);
  const upright = fit(LAYOUT.upright);
  const flat = fit(LAYOUT.flat);
  // The way the screen is held decides, unless the other way round would need noticeably less shrinking.
  const side = width > height ? flat >= upright * 0.92 : flat > upright * 1.08;
  const scale = clamp(side ? flat : upright, 0.25, 1);
  const w = width / scale;
  const h = height / scale;
  const safe = { left: edges.left / scale, right: edges.right / scale, top: edges.top / scale, bottom: edges.bottom / scale };
  if (side) {
    const tabs = LAYOUT.strip + safe.right;
    const panel = Math.round(clamp(w * LAYOUT.drawer, 280, Math.min(360, w - tabs - safe.left - 150)));
    return { dock: 'side', compact: true, scale, w, h, safe, tabs, panel, full: panel };
  }
  const tabs = LAYOUT.bar + safe.bottom;
  const full = Math.round(h - tabs - safe.top - LAYOUT.sheetGap);
  const panel = Math.round(clamp(h * LAYOUT.sheet, 230, full));
  return { dock: 'bottom', compact: true, scale, w, h, safe, tabs, panel, full };
}

export const sameLayout = (a: Layout, b: Layout) =>
  a.dock === b.dock &&
  a.compact === b.compact &&
  a.scale === b.scale &&
  a.w === b.w &&
  a.h === b.h &&
  a.tabs === b.tabs &&
  a.panel === b.panel &&
  a.full === b.full &&
  a.safe.left === b.safe.left &&
  a.safe.right === b.safe.right &&
  a.safe.top === b.safe.top &&
  a.safe.bottom === b.safe.bottom;

/** How thick the open panel is right now: a drawer's width, or a sheet's height. */
export const panelSize = (layout: Layout, sheet: SheetSize) => (layout.dock === 'bottom' && sheet === 'full' ? layout.full : layout.panel);

/**
 * How much of each screen edge the menus cover, in interface pixels. The world view and anything
 * centred on it use what is left. In the compact interface `top` is where the purse ends and
 * `left` where the lesson card beside the world does (both measured; see CompactHud).
 */
export function freeArea(layout: Layout, panelOpen: boolean, sheet: SheetSize = 'half', top: number = LAYOUT.top, left = 0): FreeArea {
  const open = panelOpen ? panelSize(layout, sheet) : 0;
  if (!layout.compact) return { left: 0, right: layout.tabs + open, top: LAYOUT.top, bottom: 0 };
  if (layout.dock === 'side') return { left: Math.max(layout.safe.left, left), right: layout.tabs + open, top, bottom: layout.safe.bottom };
  return { left: 0, right: 0, top, bottom: layout.tabs + open };
}

/** The notches and bars of this device, in CSS pixels, read from the browser's safe-area insets. */
export function readSafeArea(): FreeArea {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const edges = { left: parseFloat(style.paddingLeft) || 0, right: parseFloat(style.paddingRight) || 0, top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
  probe.remove();
  return edges;
}
