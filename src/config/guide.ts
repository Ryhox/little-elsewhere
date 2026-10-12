import type { Requirement } from '@/game/types';

/** Where a guide step points the player: the spring in the world, or one of the menu tabs. */
export type GuideTarget = 'spring' | 'drop' | 'build' | 'upgrades' | 'season';

export interface GuideStep {
  id: string;
  title: string;
  text: string;
  /** Finished when all of these hold… */
  req?: Requirement[];
  /** …and/or when this counter (see game/progress.ts) reaches the number. */
  stat?: [string, number];
  point?: GuideTarget;
}

/**
 * The tutorial, as an ordered list of small goals. Each one explains a single idea and
 * completes itself when the player has done it. Reorder, reword or add steps freely.
 */
export const GUIDE: GuideStep[] = [
  { id: 'tap', title: 'Wake the spring', text: 'Tap the glowing spring to gather Dewdrops. You can hold it down, too.', stat: ['clicks', 10], point: 'spring' },
  { id: 'fern', title: 'Plant a Dew Fern', text: 'Open Build and plant a Dew Fern. It gathers dew by itself, forever.', req: [{ building: ['fern', 1] }], point: 'build' },
  { id: 'sweep', title: 'Sweep the dew', text: 'Dewdrops gather on everything in your world. Just move your mouse over the glittering drops to collect them — no clicking. Sweep several quickly for a chain bonus.', stat: ['sweeps', 5], point: 'drop' },
  { id: 'upgrade', title: 'Learn something new', text: 'Upgrades make what you own stronger. Buy Mossy Stones in the Upgrades tab.', req: [{ upgrade: 's_moss' }], point: 'upgrades' },
  { id: 'burrow', title: 'Invite a helper', text: 'Dig a Sproutling Burrow in Build. A little creature will move in and get to work.', req: [{ building: ['burrow', 1] }], point: 'build' },
  { id: 'shake', title: 'Shake and pet', text: 'Click a tree or bush to shake the dew out of it. Click a creature to pet it — happy creatures work harder.', stat: ['shakes', 1] },
  { id: 'look', title: 'Look around', text: 'Drag the world to move and scroll (or pinch) to zoom. Everything you buy shows up here.', stat: ['looked', 1] },
  { id: 'garden', title: 'Discover new land', text: 'New lands rise from the sea. Explore the Petal Garden from the top of the Build tab.', req: [{ region: 'garden' }], point: 'build' },
  { id: 'cloud', title: 'A cloud of your own', text: 'Buy the Little Rain Cloud in Upgrades, then drag it across your plants. Whatever it rains on works twice as hard for a while.', stat: ['watered', 1], point: 'upgrades' },
  { id: 'bed', title: 'Grow flowers', text: 'Flower Beds gather far more dew than ferns. Plant three of them.', req: [{ building: ['bed', 3] }], point: 'build' },
  { id: 'ten', title: 'Strength in numbers', text: 'Owning 10 of a building doubles everything it makes. Reach 10 Dew Ferns.', req: [{ building: ['fern', 10] }], point: 'build' },
  { id: 'grove', title: 'Into the mushrooms', text: 'Save up and discover the Mushroom Grove, home of the Mosslings.', req: [{ region: 'grove' }], point: 'build' },
  { id: 'treasure', title: 'Keep your eyes open', text: 'A sparkle in the grass is buried treasure — tap it. Golden butterflies, falling stars and visitors reward a quick tap too.', stat: ['treasures', 1] },
  { id: 'waters', title: 'Water and honey', text: 'Discover the Lilypad Pond and the Honey Meadow. Ponds water your plants and bees make your flowers thrive.', req: [{ region: 'pond' }, { region: 'meadow' }], point: 'build' },
  { id: 'hamlet', title: 'A place to call home', text: 'Discover the Hearthside Hamlet, where the Pebblefolk build cottages and workshops.', req: [{ region: 'hamlet' }], point: 'build' },
  { id: 'chime', title: 'Find harmony', text: 'Raise the Harmony Chime (Upgrades). Harmony grows when plants, creatures, crafts and magic are balanced — and it lifts everything.', req: [{ upgrade: 'w_chime' }], point: 'upgrades' },
  { id: 'sundial', title: 'Keeper of seasons', text: 'Raise the Season Sundial (Upgrades). It lets you end the season and begin again, stronger.', req: [{ upgrade: 'w_sundial' }], point: 'upgrades' },
  { id: 'turn', title: 'Turn the Season', text: 'Open the Season tab and turn the season. You start over, but keep Evergreen Tokens that make every future season faster.', req: [{ seasons: 1 }], point: 'season' },
  { id: 'tree', title: 'Grow the Evergreen tree', text: 'Spend your tokens on the Evergreen tree in the Season tab. What grows there is yours forever.', stat: ['perms', 1], point: 'season' },
];

/** Counters the guide keeps in the save's stats. */
export const GUIDE_STAT = { step: 'guideStep', hidden: 'guideHidden' } as const;
