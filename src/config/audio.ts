/**
 * Every sound in the game is synthesised from these recipes — there are no audio files.
 * A sound is a list of voices played together; tweak or add recipes freely.
 */
export interface Voice {
  wave: OscillatorType | 'noise';
  /** Pitch glides from the first frequency to the second, in Hz. */
  freq: readonly [number, number];
  /** Length in seconds, and delay before it starts. */
  for: number;
  at?: number;
  /** Peak loudness, 0..1. */
  gain: number;
  /** Seconds to reach peak (default: almost instant). */
  attack?: number;
  /** Low-pass cutoff in Hz, for softening noise and bright waves. */
  lowpass?: number;
}

const note = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);
const C5 = note(3);
const E5 = note(7);
const G5 = note(10);
const C6 = note(15);

/** A short bell-like note. */
const chime = (freq: number, at: number, gain = 0.22, length = 0.4): Voice[] => [
  { wave: 'sine', freq: [freq, freq], for: length, at, gain },
  { wave: 'triangle', freq: [freq * 2, freq * 2], for: length * 0.5, at, gain: gain * 0.3 },
];

export const SOUNDS: Record<string, Voice[]> = {
  tap: [
    { wave: 'sine', freq: [420, 860], for: 0.08, gain: 0.34 },
    { wave: 'noise', freq: [0, 0], for: 0.045, gain: 0.07, lowpass: 2600 },
  ],
  glimmer: [...chime(C6, 0, 0.2, 0.3), ...chime(note(19), 0.05, 0.18, 0.35), { wave: 'sine', freq: [420, 980], for: 0.1, gain: 0.3 }],
  buy: [...chime(G5, 0, 0.16, 0.16), ...chime(C6, 0.06, 0.16, 0.24)],
  upgrade: [...chime(C5, 0, 0.16, 0.2), ...chime(E5, 0.07, 0.16, 0.2), ...chime(G5, 0.14, 0.18, 0.4)],
  region: [
    { wave: 'noise', freq: [0, 0], for: 1.3, gain: 0.12, attack: 0.5, lowpass: 900 },
    ...chime(note(-2), 0.3, 0.2, 0.7),
    ...chime(C5, 0.5, 0.2, 0.7),
    ...chime(E5, 0.7, 0.2, 0.7),
    ...chime(G5, 0.9, 0.22, 1.1),
  ],
  deny: [{ wave: 'triangle', freq: [190, 120], for: 0.12, gain: 0.2 }],
  click: [{ wave: 'triangle', freq: [760, 620], for: 0.035, gain: 0.14 }],
  collect: [...chime(E5, 0, 0.16, 0.2), ...chime(C6, 0.06, 0.16, 0.3)],
  treasure: [...chime(C5, 0, 0.16, 0.2), ...chime(E5, 0.06, 0.16, 0.2), ...chime(G5, 0.12, 0.16, 0.2), ...chime(C6, 0.18, 0.2, 0.6)],
  ability: [
    { wave: 'noise', freq: [0, 0], for: 0.5, gain: 0.14, attack: 0.2, lowpass: 3200 },
    { wave: 'sine', freq: [300, 900], for: 0.45, gain: 0.16, attack: 0.1 },
  ],
  achievement: [...chime(G5, 0, 0.18, 0.2), ...chime(C6, 0.1, 0.18, 0.2), ...chime(note(19), 0.2, 0.2, 0.7)],
  discovery: [...chime(note(5), 0, 0.16, 0.3), ...chime(note(12), 0.12, 0.18, 0.7)],
  season: [
    { wave: 'noise', freq: [0, 0], for: 2.6, gain: 0.12, attack: 1.2, lowpass: 1400 },
    ...chime(note(-9), 0, 0.2, 2.4),
    ...chime(note(-2), 0.3, 0.18, 2.2),
    ...chime(C5, 0.6, 0.18, 2),
    ...chime(G5, 0.9, 0.18, 1.8),
    ...chime(C6, 1.3, 0.2, 2),
  ],
  splash: [{ wave: 'noise', freq: [0, 0], for: 0.14, gain: 0.1, lowpass: 1800 }],
};

/** The gentle generative music: one soft note at a time, picked from a pentatonic scale. */
export const MUSIC = {
  /** Scales as semitones from A4, for day and night. */
  day: [-9, -7, -5, -2, 0, 3, 5, 7, 10, 12],
  night: [-12, -9, -7, -4, -2, 0, 3, 5, 8],
  /** Seconds between notes: [shortest, longest]. */
  gap: [0.9, 3.2] as [number, number],
  noteLength: 2.6,
  gain: 0.12,
  /** Echo that gives the music its sense of space. */
  echoSeconds: 0.42,
  echoFeedback: 0.36,
  /** Chance per second of a bird chirp by day or a cricket by night. */
  birdChance: 0.16,
  cricketChance: 0.55,
} as const;

export const noteFrequency = note;
