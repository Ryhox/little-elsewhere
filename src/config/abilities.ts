import type { AbilityDef } from '@/game/types';

/**
 * Castable abilities. Each one switches on a buff of the same id for `duration` seconds;
 * what that buff does is defined by BALANCE.buffs and the economy formulas.
 */
export const ABILITIES: AbilityDef[] = [
  { id: 'rain', name: 'Rain Dance', desc: 'A warm shower triples every plant.', icon: 'res_dew', duration: 30, cooldown: 180, unlock: 'a_rain' },
  { id: 'bloom', name: 'Bloom Burst', desc: 'Instantly gather two minutes of income.', icon: 'res_petals', duration: 0, cooldown: 240, unlock: 'a_bloom' },
  { id: 'surge', name: 'Spring Surge', desc: 'Taps are worth ×10.', icon: 'ic_bolt', duration: 15, cooldown: 120, unlock: 'a_surge' },
  { id: 'moon', name: 'Moonrise', desc: 'Night falls at once, waking every night-gatherer.', icon: 'ic_moon', duration: 45, cooldown: 300, unlock: 'a_moon' },
  { id: 'call', name: 'Gathering Call', desc: 'Every creature works three times as hard.', icon: 'ic_paw', duration: 40, cooldown: 200, unlock: 'a_call' },
];

export const ABILITY_BY_ID: Record<string, AbilityDef> = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

/** Seconds of production Bloom Burst hands over at once. */
export const BLOOM_BURST_SECONDS = 120;

/** Display names and icons for every timed buff (abilities and events alike). */
export const BUFF_INFO: Record<string, { name: string; icon: string }> = {
  rain: { name: 'Rain Dance', icon: 'res_dew' },
  storm: { name: 'Magical Rain', icon: 'res_dew' },
  surge: { name: 'Spring Surge', icon: 'ic_bolt' },
  moon: { name: 'Moonrise', icon: 'ic_moon' },
  call: { name: 'Gathering Call', icon: 'ic_paw' },
  golden: { name: 'Golden Hour', icon: 'golden_0' },
  frenzy: { name: 'Tap Frenzy', icon: 'ic_star' },
  meteor: { name: 'Meteor Shower', icon: 'res_starlight' },
  dawn: { name: 'Dawn Chorus', icon: 'ic_sun' },
  boon: { name: "Merchant's Boon", icon: 'peddler_0' },
  momentum: { name: 'Momentum', icon: 'ic_bolt' },
  cheer: { name: 'Cheered creatures', icon: 'emote_heart' },
};
