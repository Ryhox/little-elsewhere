import type { Requirement } from '@/game/types';
import type { TeacherAnimName } from './teacher';

/** Something in the world the bouncing arrow can point at. */
export type GuidePoint = 'spring' | 'drop' | 'plant';

/**
 * The exact thing in the menus a lesson asks for. It gets a glowing frame and an arrow there,
 * its price and a "Show me" button on the lesson card.
 */
export type GuideWant = { building: string } | { upgrade: string } | { region: string };

/**
 * Something the teacher says. A plain sentence suits everyone. Where it depends on how the game
 * is being played, it is a list: first for a mouse, then for a finger on a touch screen, and
 * (only where the two differ) a third for a mouse in a window too small for the desktop menus.
 */
export type Words = string | readonly [mouse: string, finger: string, small?: string];

/** The right wording for this player: `touch` when they use a finger, `compact` on a small screen. */
export const wordsFor = (words: Words, touch: boolean, compact: boolean): string => (typeof words === 'string' ? words : touch ? words[1] : ((compact && words[2]) || words[0]));

/** One thing the teacher says, and the gesture she makes while saying it (see config/teacher.ts). */
export type GuideLine = readonly [gesture: TeacherAnimName, words: Words];

export interface GuideStep {
  id: string;
  title: string;
  /** The short reminder shown on the lesson card once she has finished talking. */
  text: Words;
  /** What she says to introduce the lesson, a line at a time. */
  say: readonly GuideLine[];
  /** What she says when the lesson is done. */
  done: GuideLine;
  /** Finished when all of these hold… */
  req?: Requirement[];
  /** …and/or when this counter (see game/progress.ts) reaches the number. */
  stat?: [string, number];
  point?: GuidePoint;
  want?: GuideWant;
}

/**
 * The tutorial: a handful of short lessons covering the basics: tap, build, sweep, shake and
 * pet, upgrade, expand. Each completes itself when the player has done it. Reorder, reword or
 * add lessons freely; keep it short.
 */
export const GUIDE: GuideStep[] = [
  {
    id: 'tap',
    title: 'Wake the spring',
    text: ['Click the glowing spring ten times. You can hold the button down, too.', 'Tap the glowing spring ten times. You can keep your finger on it, too.'],
    say: [
      ['wave', 'Hello there! I am Claudia, and I teach here in Little Elsewhere. Let me show you the basics. It will only take a minute.'],
      [
        'tap',
        [
          'See the glowing spring in the middle? Click it ten times. Every click gives you Dew, and Dew buys everything.',
          'See the glowing spring in the middle? Tap it ten times. Every tap gives you Dew, and Dew buys everything.',
        ],
      ],
    ],
    done: ['cheer', 'Hear it bubble? That is your first Dew!'],
    stat: ['clicks', 10],
    point: 'spring',
  },
  {
    id: 'fern',
    title: 'Build something',
    text: 'Buy a Dew Fern in the Build menu. It gathers dew by itself, forever.',
    say: [
      [
        'plant',
        [
          'Clicking is only the start. Buy a Dew Fern. I have marked it for you in the Build menu on the right. It gathers dew all by itself.',
          'Tapping is only the start. Buy a Dew Fern. I have marked it for you in the Build menu. It gathers dew all by itself.',
          'Clicking is only the start. Buy a Dew Fern. I have marked it for you in the Build menu. It gathers dew all by itself.',
        ],
      ],
    ],
    done: ['nod', 'A fine fern! Everything you build shows up out in the world.'],
    req: [{ building: ['fern', 1] }],
    want: { building: 'fern' },
  },
  {
    id: 'sweep',
    title: 'Sweep the dew',
    text: ['Move your mouse over the glittering dewdrops to collect them, no clicking. Collect five.', 'Touch the glittering dewdrops to collect them, or slide your finger across several in one go. Collect five.'],
    say: [
      [
        'sweep',
        [
          'Now look at your world: glittering dewdrops gather on everything. Just move your mouse over them, no clicking needed. Sweep up five.',
          'Now look at your world: glittering dewdrops gather on everything. Touch one to collect it, or slide your finger across several in one go. Sweep up five.',
        ],
      ],
    ],
    done: ['cheer', 'Lovely! Sweep several in a row and each one is worth more.'],
    stat: ['sweeps', 5],
    point: 'drop',
  },
  {
    id: 'shake',
    title: 'Shake and pet',
    text: ['Click a tree or bush to shake dew out of it. Later, click creatures to pet them.', 'Tap a tree or bush to shake dew out of it. Later, tap creatures to pet them.'],
    say: [
      [
        'shake',
        ['Here is another trick: click a tree or a bush to shake the dew out of it. Sometimes a seed falls out as well.', 'Here is another trick: tap a tree or a bush to shake the dew out of it. Sometimes a seed falls out as well.'],
      ],
      [
        'pet',
        ['And when little creatures move in, click them to give them a pat. Happy creatures work harder for a while.', 'And when little creatures move in, tap them to give them a pat. Happy creatures work harder for a while.'],
      ],
    ],
    done: ['nod', 'Ha! Did you see it rain down? Give it a moment and you can shake it again.'],
    stat: ['shakes', 1],
    point: 'plant',
  },
  {
    id: 'upgrade',
    title: 'Learn an upgrade',
    text: 'Buy Mossy Stones in the Upgrades menu. Upgrades make what you have stronger.',
    say: [['book', 'Time for some book learning. Upgrades make what you already own stronger. Buy Mossy Stones. I have marked it in the Upgrades menu.']],
    done: ['cheer', ['Twice the dew from every click. New upgrades appear as your world grows.', 'Twice the dew from every tap. New upgrades appear as your world grows.']],
    req: [{ upgrade: 's_moss' }],
    want: { upgrade: 's_moss' },
  },
  {
    id: 'garden',
    title: 'Discover new land',
    text: 'Save up and explore the Petal Garden. It is at the top of the Build menu.',
    say: [
      ['map', 'My map shows land hiding under the sea! Save up your dew and explore the Petal Garden. It waits at the top of the Build menu.'],
      [
        'spy',
        [
          'While you save: drag the world to move around, and scroll to zoom in and out. There is a lot to see.',
          'While you save: drag the world to move around, and pinch with two fingers to zoom in and out. There is a lot to see.',
        ],
      ],
    ],
    done: ['cheer', 'Land ho! Every new land brings new things to build.'],
    req: [{ region: 'garden' }],
    want: { region: 'garden' },
  },
];

/** Where Rebirth is found on a small screen, which has no room to keep its button in the corner. */
const REBIRTH_SMALL = 'One last thing for later: when your world grows slowly, open the Season menu and turn the season. You start again, but with Evergreen Tokens that make everything faster for good.';

/** Her last words, once every lesson is done. */
export const GUIDE_FAREWELL: readonly GuideLine[] = [
  [
    'token',
    ['One last thing for later: when your world grows slowly, press Rebirth in the bottom-left corner. You start again, but with Evergreen Tokens that make everything faster for good.', REBIRTH_SMALL, REBIRTH_SMALL],
  ],
  ['thanks', 'And that is everything I can teach you. Thank you for being such a wonderful student, and thank you for looking after Little Elsewhere!'],
];

/**
 * What she says when you come back after being away. `time` is how long the world ran without
 * you; the first line is for when it gathered something, the second for when it did not.
 */
export const GUIDE_WELCOME = {
  gesture: 'wave',
  busy: (time: string) => `Welcome back! Your little world kept busy for ${time} while you were away. Look what it gathered for you.`,
  quiet: (time: string) => `Welcome back! You were away for ${time}. It was a quiet time, and not much happened.`,
} as const satisfies { gesture: TeacherAnimName; busy(time: string): string; quiet(time: string): string };

/** Her closing words, once the Elder Tree has bloomed. */
export const GUIDE_ENDING: readonly [gesture: TeacherAnimName, words: string] = [
  'thanks',
  'The Elder Tree is in full bloom! From one small spring you grew a whole world, season after season, and now its heart has opened. Little Elsewhere is as it was always meant to be. Thank you for tending it.',
];

/** Counters the guide keeps in the save's stats. */
export const GUIDE_STAT = { step: 'guideStep', hidden: 'guideHidden', seen: 'guideSeen' } as const;

/** How the conversation with the teacher feels. */
export const GUIDE_FEEL = {
  /** Letters she speaks per second. */
  lettersPerSecond: 42,
  /** After a line is fully spoken it stays this long (plus a little per letter) before she moves on by herself. */
  lingerSeconds: 3.5,
  lingerPerLetter: 0.045,
  /** How long the card takes to fly between the middle of the screen and its corner, in milliseconds. */
  flyMs: 520,
  /** How big she is drawn: in conversation, on a screen too small for that, and on the small card in the corner. */
  portraitScale: 3,
  smallPortraitScale: 2,
  cardScale: 2,
  /** A soft blip every this many letters as she speaks (0 = silent). */
  blipEvery: 3,
} as const;
