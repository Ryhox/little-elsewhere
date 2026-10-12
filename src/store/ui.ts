import { create } from 'zustand';
import { BALANCE } from '@/config/balance';
import { RENDER } from '@/config/render';

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
}

export const DEFAULT_SETTINGS: Settings = { master: 0.7, sfx: 0.8, music: 0.45, quality: RENDER.quality.length - 1, fps: 0, numbers: true, autoCamera: true, shortCutscene: false };

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
  x: number;
  y: number;
}

interface UIState {
  /** Bumped a few times a second so components re-read the live game. */
  tick: number;
  bump(): void;
  panel: PanelId;
  panelOpen: boolean;
  setPanel(panel: PanelId): void;
  togglePanel(): void;
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

const MAX_TOASTS = 4;
let toastId = 0;

export const useUI = create<UIState>((set, get) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
  panel: 'build',
  panelOpen: true,
  setPanel: (panel) => set((s) => ({ panel, panelOpen: s.panel === panel ? !s.panelOpen : true })),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
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
