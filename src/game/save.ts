import { BALANCE } from '@/config/balance';
import { BUILDING_BY_ID, BUILDING_IDS } from '@/config/buildings';
import { PERM_BY_ID } from '@/config/evergreen';
import { REGION_BY_ID } from '@/config/regions';
import { UPGRADE_BY_ID } from '@/config/upgrades';
import { newState, type Game } from './context';
import { refresh } from './economy';
import { RES, type GameState } from './types';

/**
 * Saving, loading and sharing a game. Storage access is isolated here.
 *
 * Saves are sealed: the text carries a checksum of its contents, and anything that does not
 * match is refused. Whatever does load is then clamped to values the game could really have
 * produced. Together these stop casual editing of the save from the browser console; like any
 * game that runs entirely in the browser, they cannot stop someone determined to rebuild it.
 */

const SEAL_PREFIX = 'LE1';
const SEAL_SALT = 'dew-on-the-ferns·little-elsewhere·v1';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A 53-bit string hash (cyrb53), as hex. */
function checksum(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const encode = (json: string) => btoa(unescape(encodeURIComponent(json)));
const decode = (packed: string) => decodeURIComponent(escape(atob(packed)));

/** Wrap save JSON as `LE1.<checksum>.<payload>`. */
function seal(json: string): string {
  const payload = encode(json);
  return `${SEAL_PREFIX}.${checksum(payload + SEAL_SALT)}.${payload}`;
}

/** Unwrap sealed save text. Throws when it is not a save or has been altered. */
function unseal(text: string): string {
  const [prefix, sum, payload] = text.trim().split('.');
  if (prefix !== SEAL_PREFIX || !sum || !payload || checksum(payload + SEAL_SALT) !== sum) throw new Error('This save has been altered or is not a Little Elsewhere save');
  return decode(payload);
}

const safeNumber = (value: unknown, max: number = BALANCE.maxNumber) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0);

/** Keep only entries whose keys the game knows, with values clamped to what is possible. */
function clampRecord(source: unknown, known: (key: string) => number | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(source)) return out;
  for (const key of Object.keys(source)) {
    const max = known(key);
    if (max === undefined) continue;
    const value = Math.floor(safeNumber(source[key], max));
    if (value > 0) out[key] = value;
  }
  return out;
}

/** Lay a loaded save over a fresh state, so new fields exist and nothing is out of range. */
function restore(parsed: Record<string, unknown>): GameState {
  const state = newState() as unknown as Record<string, unknown>;
  for (const key of Object.keys(state)) {
    const incoming = parsed[key];
    if (incoming === undefined || incoming === null) continue;
    state[key] = isRecord(state[key]) && isRecord(incoming) ? { ...(state[key] as object), ...incoming } : incoming;
  }
  const s = state as unknown as GameState;
  for (const r of RES) {
    s.res[r] = safeNumber(s.res[r]);
    s.earned[r] = safeNumber(s.earned[r]);
    s.life[r] = safeNumber(s.life[r]);
  }
  const counts = clampRecord(s.b, (id) => BUILDING_BY_ID[id]?.max);
  s.b = Object.fromEntries(BUILDING_IDS.map((id) => [id, counts[id] ?? 0]));
  s.up = clampRecord(s.up, (id) => (UPGRADE_BY_ID[id] ? 1 : undefined));
  s.regions = clampRecord(s.regions, (id) => (REGION_BY_ID[id] ? 1 : undefined));
  s.perm = clampRecord(s.perm, (id) => PERM_BY_ID[id]?.max);
  s.tokensEarned = safeNumber(s.tokensEarned);
  // Tokens can only ever have been earned.
  s.tokens = Math.min(safeNumber(s.tokens), s.tokensEarned);
  s.seasons = Math.floor(safeNumber(s.seasons, 1e6));
  s.rings = Math.min(Math.floor(safeNumber(s.rings)), s.seasons);
  s.time = safeNumber(s.time);
  s.flow = safeNumber(s.flow, 1);
  return s;
}

/** The current game as sealed save text (also what "Export" hands the player). */
export function serialize(game: Game): string {
  game.s.lastSeen = Date.now();
  return seal(JSON.stringify(game.s));
}

/** Parse sealed save text. Throws when it is not a Little Elsewhere save or has been tampered with. */
export function parseSave(text: string): GameState {
  const parsed: unknown = JSON.parse(unseal(text));
  if (!isRecord(parsed) || !isRecord(parsed.res) || typeof parsed.version !== 'number') throw new Error('Not a Little Elsewhere save');
  return restore(parsed);
}

/** Replace the running game's state and tell every system to rebuild from it. */
export function replaceState(game: Game, state: GameState): void {
  game.s = state;
  game.tapCarry = 0;
  game.helperClock = [];
  game.dirty = true;
  refresh(game);
  game.bus.emit('reset', {});
}

export function saveToStorage(game: Game): boolean {
  try {
    localStorage.setItem(BALANCE.save.key, serialize(game));
    return true;
  } catch {
    return false;
  }
}

/** Load from storage. Returns seconds since the save was written, or null when there was none (or it was refused). */
export function loadFromStorage(game: Game): number | null {
  try {
    const text = localStorage.getItem(BALANCE.save.key);
    if (!text) return null;
    const state = parseSave(text);
    // A clock set into the future earns nothing.
    const away = Math.max(0, (Date.now() - state.lastSeen) / 1000);
    replaceState(game, state);
    return away;
  } catch (error) {
    console.warn('Save not loaded:', error);
    return null;
  }
}

export const exportCode = serialize;

export function importCode(game: Game, code: string): boolean {
  try {
    replaceState(game, parseSave(code));
    return true;
  } catch {
    return false;
  }
}

export function wipeSave(game: Game): void {
  try {
    localStorage.removeItem(BALANCE.save.key);
  } catch {
    // Storage may be unavailable; a fresh state is still correct.
  }
  replaceState(game, newState());
}
