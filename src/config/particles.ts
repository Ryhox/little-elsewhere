import type { Burst, ParticleKind } from '@/engine/particles';
import { PAL } from './palette';

/**
 * Every kind of particle in the game, as data. To add an effect, describe a kind here
 * and (optionally) a named burst below: no engine changes needed.
 */
export const PARTICLES: Record<string, ParticleKind> = {
  /* Water */
  droplet: { colors: [PAL.magic[4], PAL.magic[3], PAL.magic[2]], life: [0.5, 0.95], gravity: 170, shape: ['block', 'dot'], fadeOut: 0.2 },
  splash: { colors: [PAL.water[5], PAL.water[4]], life: [0.4, 0.8], gravity: 170, shape: ['block', 'dot'], lands: 'ripple', fadeOut: 0.2 },
  ripple: { colors: [PAL.water[5], PAL.water[4]], life: [0.7, 1.1], shape: 'ring', ringSize: 7, alpha: 0.85, fadeOut: 0.6 },
  ripplet: { colors: [PAL.water[5]], life: [0.3, 0.45], shape: 'ring', ringSize: 3, alpha: 0.7, fadeOut: 0.6 },
  bubble: { colors: [PAL.magic[4], PAL.white], life: [0.5, 1], rise: 9, wobble: [1, 1.4], fadeOut: 0.4 },
  glint: { colors: [PAL.white, PAL.water[5]], life: [0.35, 0.8], shape: 'dash', fadeIn: 0.35, fadeOut: 0.45, alpha: 0.9 },
  moonglint: { colors: [PAL.lilac[4], PAL.lilac[3]], life: [0.5, 1.1], shape: 'dash', fadeIn: 0.4, fadeOut: 0.45, alpha: 0.8, glow: true },
  flow: { colors: [PAL.water[5], PAL.water[4]], life: [0.6, 1.1], shape: 'dash', fadeIn: 0.2, fadeOut: 0.35, alpha: 0.9 },
  foam: { colors: [PAL.white, PAL.water[5]], life: [0.3, 0.6], shape: ['block', 'dot'], drag: 2.5, fadeOut: 0.5 },
  wake: { colors: [PAL.water[5], PAL.water[4]], life: [0.5, 1], shape: 'dash', drag: 1.5, fadeOut: 0.6, alpha: 0.8 },
  rain: { colors: [PAL.water[5], PAL.water[4]], life: [0.6, 0.9], gravity: 60, shape: 'streak', alpha: 0.8, lands: 'ripplet' },

  /* Earth and air */
  dust: { colors: [PAL.dirt[4], PAL.dirt[3]], life: [0.35, 0.75], drag: 3, rise: 8, shape: ['block', 'dot'], alpha: 0.85, fadeOut: 0.5 },
  puff: { colors: [PAL.white, PAL.cream[3], PAL.cream[2]], life: [0.3, 0.6], drag: 4, rise: 10, shape: ['block', 'block', 'dot'], fadeOut: 0.5 },
  smoke: { colors: [0xeeeef4, 0xcfcfdc, 0xa9a9c0], life: [1.6, 2.8], rise: 9, wobble: [1.8, 0.3], shape: 'block', alpha: 0.75, fadeIn: 0.12, fadeOut: 0.55 },
  leaf: { colors: [PAL.leaf[4], PAL.leaf[3]], life: [4, 7], gravity: 4, wobble: [4, 0.45], shape: 'dash', fadeOut: 0.15 },
  leafOrange: { colors: [PAL.autumnOrange[3], PAL.autumnOrange[2]], life: [4, 7], gravity: 4, wobble: [4, 0.45], shape: 'dash', fadeOut: 0.15 },
  leafRed: { colors: [PAL.autumnRed[3], PAL.autumnRed[2]], life: [4, 7], gravity: 4, wobble: [5, 0.4], shape: 'dash', fadeOut: 0.15 },
  leafGold: { colors: [PAL.autumnGold[3], PAL.autumnGold[2]], life: [4, 7], gravity: 4, wobble: [4, 0.5], shape: 'dash', fadeOut: 0.15 },
  petal: { colors: [PAL.pink[4], PAL.pink[3]], life: [2.5, 4.5], gravity: 6, wobble: [4, 0.5], shape: 'dash', fadeOut: 0.2 },
  snow: { colors: [PAL.white, PAL.grassWinter[4]], life: [5, 8], gravity: 2.5, wobble: [3.5, 0.35], fadeOut: 0.15 },
  pollen: { colors: [PAL.gold[4], PAL.gold[3]], life: [1, 2.2], rise: 5, wobble: [2, 0.9], fadeIn: 0.2, fadeOut: 0.4 },

  /* Light and magic (these ignore the dark) */
  sparkle: { colors: [PAL.white, PAL.gold[4], PAL.gold[3]], life: [0.4, 0.95], rise: 7, shape: ['plus', 'dot'], glow: true, fadeOut: 0.4 },
  magic: { colors: [PAL.white, PAL.magic[4], PAL.magic[3]], life: [0.6, 1.3], rise: 14, wobble: [1.6, 1.1], shape: ['plus', 'dot'], glow: true, fadeOut: 0.4 },
  star: { colors: [PAL.white, PAL.lilac[4], PAL.lilac[3]], life: [0.3, 0.7], shape: ['plus', 'dot'], glow: true, fadeOut: 0.5 },
  ember: { colors: [PAL.ember[4], PAL.ember[3], PAL.ember[2]], life: [0.6, 1.3], rise: 16, wobble: [1.5, 1], glow: true, fadeOut: 0.5 },
  firefly: { colors: [0xf2ffd8, PAL.glow[3], PAL.glow[2]], life: [3, 6.5], rise: 1, wobble: [5, 0.22], glow: true, fadeIn: 0.25, fadeOut: 0.3 },
  mote: { colors: [PAL.gold[4], PAL.cream[3]], life: [3, 6], rise: 2, wobble: [4, 0.2], fadeIn: 0.3, fadeOut: 0.3, alpha: 0.7 },
  evergreen: { colors: [PAL.gold[4], PAL.leaf[5], PAL.leaf[4]], life: [1, 1.8], gravity: 90, bounce: 0.4, shape: ['plus', 'block', 'dot'], glow: true, fadeOut: 0.3 },
};

/** Named bursts the world plays by name. Each entry is a list of handfuls thrown together. */
export const EFFECTS: Record<string, Burst[]> = {
  springTap: [
    { kind: 'droplet', count: [6, 10], speed: [10, 34], up: [44, 84], spread: 7, height: [5, 9] },
    { kind: 'ripple', count: [1, 1] },
    { kind: 'magic', count: [1, 3], spread: 10, height: [4, 10] },
  ],
  springGlimmer: [
    { kind: 'droplet', count: [14, 20], speed: [14, 46], up: [60, 110], spread: 8, height: [5, 9] },
    { kind: 'sparkle', count: [10, 16], speed: [10, 34], up: [10, 40], spread: 8, height: [6, 12] },
    { kind: 'ripple', count: [2, 2] },
  ],
  springAuto: [{ kind: 'droplet', count: [1, 3], speed: [6, 20], up: [30, 60], spread: 6, height: [5, 8] }],
  bubbles: [{ kind: 'bubble', count: [1, 1], spread: 12, height: [2, 4] }],
  build: [
    { kind: 'dust', count: [8, 13], speed: [10, 28], spread: 9 },
    { kind: 'sparkle', count: [3, 5], speed: [4, 14], up: [8, 22], spread: 8, height: [4, 14] },
  ],
  upgrade: [{ kind: 'sparkle', count: [9, 14], speed: [8, 24], up: [10, 34], spread: 8, height: [4, 16] }],
  poof: [{ kind: 'puff', count: [6, 9], speed: [8, 22], spread: 5, height: [2, 8] }],
  treasure: [
    { kind: 'sparkle', count: [14, 22], speed: [10, 36], up: [20, 60], spread: 6, height: [4, 10] },
    { kind: 'dust', count: [6, 9], speed: [8, 20], spread: 8 },
  ],
  collect: [{ kind: 'sparkle', count: [6, 10], speed: [6, 20], up: [10, 30], spread: 6, height: [4, 12] }],
  starCatch: [{ kind: 'star', count: [10, 16], speed: [10, 40], up: [0, 30], spread: 4, height: [2, 10] }],
  bloom: [{ kind: 'petal', count: [5, 8], speed: [8, 26], up: [20, 46], spread: 8, height: [6, 14] }],
  splash: [{ kind: 'splash', count: [4, 7], speed: [6, 18], up: [26, 52], spread: 3 }, { kind: 'ripple', count: [1, 1] }],
  smoke: [{ kind: 'smoke', count: [1, 1], spread: 1 }],
  embers: [{ kind: 'ember', count: [1, 2], spread: 2, height: [3, 6] }],
  tend: [{ kind: 'pollen', count: [1, 2], spread: 4, height: [3, 8] }],
  tokens: [{ kind: 'evergreen', count: [34, 46], speed: [14, 60], up: [50, 120], spread: 10, height: [8, 14] }],
  rise: [
    { kind: 'splash', count: [5, 8], speed: [6, 22], up: [30, 70], spread: 6 },
    { kind: 'foam', count: [3, 5], speed: [4, 14], spread: 8 },
  ],
};

/** Leaf colours shed by trees in each season: lush, autumn, winter (none). */
export const LEAF_KINDS: readonly (readonly string[])[] = [['leaf', 'petal'], ['leafOrange', 'leafRed', 'leafGold'], []];
