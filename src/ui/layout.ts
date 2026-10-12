/** Sizes of the menus, in CSS pixels, shared by everything that needs to know how much of the screen is free. */
export const LAYOUT = { wide: 768, panel: 396, tabs: 70, sheet: 0.44, top: 96, bar: 64 };

export interface FreeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** How much of each screen edge the menus cover right now. The world view and anything centred on it use what is left. */
export function freeArea(panelOpen: boolean): FreeArea {
  const wide = window.innerWidth >= LAYOUT.wide;
  return {
    left: 0,
    right: wide ? (panelOpen ? LAYOUT.panel + LAYOUT.tabs : LAYOUT.tabs) : 0,
    top: LAYOUT.top,
    bottom: wide ? 0 : panelOpen ? window.innerHeight * LAYOUT.sheet + LAYOUT.bar : LAYOUT.bar,
  };
}
