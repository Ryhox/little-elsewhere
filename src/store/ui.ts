import { create } from 'zustand';
import { BALANCE } from '@/config/balance';
import { RENDER } from '@/config/render';
import { DEFAULT_LAYOUT, measureLayout, readSafeArea, type Layout, type SheetSize } from '@/ui/layout';

/** Player preferences. Stored separately from the save so they survive a wipe or an import. */
export interface Settings {
  master: number;
  sfx: number;
  music: number;
  /** Index into RENDER.quality. */
  quality: number;
  /** Frame-rate cap; 0 = as fast as the display allows. */
  fps: number;
  numbers: boolean;
  autoCamera: boolean;
  shortCutscene: boolean;
  /** A tiny buzz under the finger when the spring is tapped, on phones that can. */
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = { master: 0.7, sfx: 0.8, music: 0.45, quality: RENDER.quality.length - 1, fps: 0, numbers: true, autoCamera: true, shortCutscene: false, haptics: true };

export type PanelId = 'build' | 'upgrades' | 'season' | 'journal' | 'trophies' | 'helpers' | 'settings';

export type Modal =
  | null
  | { kind: 'turn' }
  | { kind: 'turned'; tokens: number }
  | { kind: 'offline'; seconds: number; gained: Record<string, number> }
  | { kind: 'merchant' }
  | { kind: 'blessing' }
  | { kind: 'tree' }
  | { kind: 'stars' }
  | { kind: 'ending' };

export interface Toast {
  id: number;
  text: string;
  icon?: string;
  /** Big moments get a gold frame. */
  gold?: boolean;
}

export interface Tip {
  title: string;
  lines: string[];
  /** Cost line, shown with resource icons. */
  cost?: Partial<Record<string, number>>;
  /** Where the pointer is, in interface pixels. */
  x: number;
  y: number;
  /** Set when a finger asked for it: the box of the thing it describes. It stays put until something else is touched. */
  anchor?: { left: number; top: number; right: number; bottom: number };
}

interface UIState {
  /** Bumped a few times a second so components re-read the live game. */
  tick: number;
  bump(): void;
  /** How the interface is arranged on this screen (see ui/layout.ts). */
  layout: Layout;
  setLayout(layout: Layout): void;
  /**
   * The player is using a finger rather than a mouse right now: nothing can be hovered, so
   * tooltips are asked for by touch. It follows whatever last pointed at the game.
   */
  touch: boolean;
  setTouch(touch: boolean): void;
  /**
   * This is a touch-first device (a phone, a tablet). Unlike `touch` it never changes while the
   * game runs, so the things that hang on it (how big buttons are, how close the world is framed)
   * do not jump about on a laptop that has both a touch screen and a mouse.
   */
  coarse: boolean;
  /**
   * Where the top of the compact interface ends, in interface pixels: `hudRow` is the purse and
   * its neighbours alone, `hudTop` whatever the world must keep clear of (on an upright phone,
   * that includes the lesson card under them). On a phone lying flat the card sits beside the
   * world instead, and `hudLeft` is where it ends (0 when it is not there).
   */
  hudRow: number;
  hudTop: number;
  hudLeft: number;
  setHudEdges(hudRow: number, hudTop: number, hudLeft: number): void;
  /** How far the bottom sheet is pulled up. */
  sheet: SheetSize;
  setSheet(sheet: SheetSize): void;
  panel: PanelId;
  panelOpen: boolean;
  setPanel(panel: PanelId): void;
  /** Open the menu on a tab (unlike `setPanel`, never closes it). */
  openPanel(panel: PanelId): void;
  togglePanel(): void;
  /** The teacher is talking in the middle of the screen (her card in the corner waits out of sight). */
  guideTalking: boolean;
  setGuideTalking(talking: boolean): void;
  /** Bumped to ask for the current lesson to be said again. */
  guideReplay: number;
  replayGuide(): void;
  /** Bumped to make the thing the lesson asks for scroll into view. */
  guidePing: number;
  pingGuide(): void;
  /** "Just watch" mode: every menu hidden. */
  zen: boolean;
  setZen(zen: boolean): void;
  /** 1, 10, 100 or -1 for "max". */
  buyAmount: number;
  setBuyAmount(amount: number): void;
  modal: Modal;
  setModal(modal: Modal): void;
  toasts: Toast[];
  toast(text: string, icon?: string, gold?: boolean): void;
  dismiss(id: number): void;
  tip: Tip | null;
  setTip(tip: Tip | null): void;
  cutscene: boolean;
  setCutscene(active: boolean): void;
  settings: Settings;
  setSettings(patch: Partial<Settings>): void;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(BALANCE.save.settingsKey);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** The screen as it is when the game starts (the roomy layout if it cannot be measured yet). */
function firstLayout(): Layout {
  try {
    return measureLayout(window.innerWidth, window.innerHeight, readSafeArea());
  } catch {
    return DEFAULT_LAYOUT;
  }
}

const startLayout = firstLayout();
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const MAX_TOASTS = 4;
let toastId = 0;

export const useUI = create<UIState>((set, get) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
  layout: startLayout,
  setLayout: (layout) => set({ layout, tip: null }),
  touch: coarse,
  setTouch: (touch) => set({ touch, tip: null }),
  coarse,
  hudRow: 64,
  hudTop: 64,
  hudLeft: 0,
  setHudEdges: (hudRow, hudTop, hudLeft) => set({ hudRow, hudTop, hudLeft }),
  sheet: 'half',
  setSheet: (sheet) => set({ sheet }),
  panel: 'build',
  // On a small screen the world gets the stage first: the menu waits until it is asked for.
  panelOpen: !startLayout.compact,
  setPanel: (panel) => set((s) => ({ panel, panelOpen: s.panel === panel ? !s.panelOpen : true, tip: null })),
  openPanel: (panel) => set({ panel, panelOpen: true, tip: null }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen, tip: null })),
  guideTalking: false,
  setGuideTalking: (guideTalking) => set({ guideTalking }),
  guideReplay: 0,
  replayGuide: () => set((s) => ({ guideReplay: s.guideReplay + 1 })),
  guidePing: 0,
  pingGuide: () => set((s) => ({ guidePing: s.guidePing + 1 })),
  zen: false,
  setZen: (zen) => set({ zen, tip: null }),
  buyAmount: 1,
  setBuyAmount: (buyAmount) => set({ buyAmount }),
  modal: null,
  setModal: (modal) => set({ modal, tip: null }),
  toasts: [],
  toast: (text, icon, gold) => set((s) => ({ toasts: [...s.toasts, { id: ++toastId, text, icon, gold }].slice(-MAX_TOASTS) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  tip: null,
  setTip: (tip) => set({ tip }),
  cutscene: false,
  setCutscene: (cutscene) => set({ cutscene }),
  settings: loadSettings(),
  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    try {
      localStorage.setItem(BALANCE.save.settingsKey, JSON.stringify(settings));
    } catch {
      // Preferences simply will not persist if storage is unavailable.
    }
    set({ settings });
  },
}));
