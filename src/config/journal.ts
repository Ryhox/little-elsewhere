import { boost, flag, mul } from '@/game/effects';
import type { JournalDef } from '@/game/types';
import { BEEFOLK, FLOWERS, NIGHTFOLK } from './buildings';
import { WONDERS } from './seasons';

/**
 * The discovery journal. Entries with a `req` fill themselves in when it is met;
 * the rest are discovered by things that happen in the world (events, secrets, wonders).
 * Combos also grant `effects` for as long as their requirement holds.
 */

const CREATURES: JournalDef[] = [
  { id: 'c_bird', kind: 'creature', name: 'Skylark', text: 'Always somewhere overhead, always in a hurry.', hint: 'Look up.', icon: 'bird_0_0', req: [{ region: 'clearing' }] },
  { id: 'c_sproutling', kind: 'creature', name: 'Sproutling', text: 'A seed that decided to go for a walk. Tends ferns and flowers with great seriousness.', hint: 'Dig a burrow.', icon: 'sproutling_0', req: [{ building: ['burrow', 1] }] },
  { id: 'c_butterfly', kind: 'creature', name: 'Butterfly', text: 'Comes for the bushes, stays for the company.', hint: 'Plant something butterflies like.', icon: 'butterfly_0_0', req: [{ upgrade: 'w_butterflies' }] },
  { id: 'c_mossling', kind: 'creature', name: 'Mossling', text: 'Shaggy foragers who carry more than seems possible. Never in a rush.', hint: 'Lives in hollow logs.', icon: 'mossling_0', req: [{ building: ['den', 1] }] },
  { id: 'c_frog', kind: 'creature', name: 'Dewfrog', text: 'Sits very still. Thinks about flies.', hint: 'Find somewhere wet.', icon: 'frog_0', req: [{ region: 'pond' }] },
  { id: 'c_duck', kind: 'creature', name: 'Paddler', text: 'A duck and her line of ducklings, doing laps.', hint: 'Make the pond more welcoming.', icon: 'duck_0', req: [{ upgrade: 'w_ducks' }] },
  { id: 'c_bee', kind: 'creature', name: 'Bumblebud', text: 'Round, loud, and far too heavy to fly. Flies anyway.', hint: 'Set up a hive.', icon: 'bee_0', req: [{ building: ['hive', 1] }] },
  { id: 'c_flutterling', kind: 'creature', name: 'Flutterling', text: 'Carries dew from blossom to blossom, leaving ribbons of it in the air.', hint: 'Hang a nest in the meadow.', icon: 'flutterling_0', req: [{ building: ['nest', 1] }] },
  { id: 'c_pebblefolk', kind: 'creature', name: 'Pebblefolk', text: 'Small, sturdy, and very fond of a job well done.', hint: 'Build them a home.', icon: 'pebblefolk_0', req: [{ building: ['cottage', 1] }] },
  { id: 'c_tumblebug', kind: 'creature', name: 'Tumblebug', text: 'The post must get through. So must the crates.', hint: 'Workshops need deliveries.', icon: 'tumblebug_0', req: [{ upgrade: 'b_workshop_2' }] },
  { id: 'c_thistlehog', kind: 'creature', name: 'Thistlehog', text: 'A prickly farmer with a soft spot for pumpkins.', hint: 'Till a farm plot.', icon: 'thistlehog_0', req: [{ building: ['farm', 1] }] },
  { id: 'c_moonmoth', kind: 'creature', name: 'Moonmoth', text: 'Sleeps all day in silk. At dusk it rises to sip dew from the moonlight.', hint: 'Roosts in the woods.', icon: 'moonmoth_0', req: [{ building: ['roost', 1] }] },
  { id: 'c_owl', kind: 'creature', name: 'Puffowl', text: 'Keeps the night shift. Delivers letters nobody remembers writing.', hint: 'Set up a post in the trees.', icon: 'owl_0', req: [{ upgrade: 'w_owlpost' }] },
  { id: 'c_tinker', kind: 'creature', name: 'Tinker', text: 'A clockwork helper wound up by your past seasons.', hint: 'A gift of the Evergreen.', icon: 'tinker_0', req: [{ perm: 'a_helper' }] },
  { id: 'c_gloamcat', kind: 'creature', name: 'Gloamcat', text: 'A cat made of dusk. It visits when it likes and leaves when it likes.', hint: 'A shy visitor. Be gentle.', icon: 'gloamcat_0' },
  { id: 'c_whale', kind: 'creature', name: 'Cloud Whale', text: 'Drifts between the isles, singing to the weather.', hint: 'Something large lives in the sky.', icon: 'whale_0' },
];

const EVENTS: JournalDef[] = [
  { id: 'e_treasure', kind: 'event', name: 'Buried Treasure', text: 'Something glints in the grass. Somebody hid it; you found it.', hint: 'Watch for a glint.', icon: 'chest' },
  { id: 'e_golden', kind: 'event', name: 'Golden Butterfly', text: 'It only passes through. Catch it and the whole world shines.', hint: 'Rare wings cross the garden.', icon: 'golden_0' },
  { id: 'e_storm', kind: 'event', name: 'Magical Rain', text: 'Warm rain that smells of spring. Plants drink it greedily.', hint: 'Wait for the weather.', icon: 'res_dew' },
  { id: 'e_rainbow', kind: 'event', name: 'Rainbow', text: 'It ends somewhere. Somewhere specific.', hint: 'After the rain.', icon: 'ic_sun' },
  { id: 'e_merchant', kind: 'event', name: 'Peddler Toad', text: 'Old Mr. Bramble and his cart of curios. Prices firm, hat magnificent.', hint: 'A cart rolls in by the pond.', icon: 'peddler_0' },
  { id: 'e_meteor', kind: 'event', name: 'Meteor Shower', text: 'The sky comes down in handfuls. Catch what you can.', hint: 'Watch the night sky.', icon: 'res_starlight' },
  { id: 'e_seed', kind: 'event', name: 'Mysterious Seed', text: 'It hums faintly. Plant it and see.', hint: 'Treasures sometimes hold more than dew.', icon: 'ic_seed' },
];

const SECRETS: JournalDef[] = [
  { id: 's_bird', kind: 'secret', name: 'Birdwatcher', text: 'You tapped a skylark mid-flight. It was not amused.', hint: 'Some things move too fast to tap. Try anyway.', icon: 'bird_1_0' },
  { id: 's_windmill', kind: 'secret', name: 'Whirligig', text: 'You gave the windmill a spin. It appreciated the help.', hint: 'Give something a push.', icon: 'blades_0' },
  { id: 's_skiff', kind: 'secret', name: 'Ahoy', text: 'You waved at a skiff and it rang its tiny bell back.', hint: 'Greet a sailor.', icon: 'skiff_0' },
  { id: 's_scarecrow', kind: 'secret', name: 'Hat Tip', text: 'The scarecrow tipped its hat. Probably the wind.', hint: 'Be polite to the one who never moves.', icon: 'scarecrow' },
  { id: 's_chime', kind: 'secret', name: 'Perfect Fifth', text: 'You rang the Harmony Chime. The whole hamlet hummed along.', hint: 'Make some music.', icon: 'chime' },
  { id: 's_frog', kind: 'secret', name: 'Ribbit', text: 'You booped a Dewfrog. It booped the pond.', hint: 'Boop.', icon: 'frog_1' },
  { id: 's_moon', kind: 'secret', name: 'Moon in the Water', text: 'You touched the moon’s reflection and came away with a handful of stardew.', hint: 'The moon visits the pond at night.', icon: 'ic_moon' },
  { id: 's_rainbow', kind: 'secret', name: "Rainbow's End", text: 'There really was something there.', hint: 'Follow the colours down.', icon: 'ic_sun' },
];

const COMBOS: JournalDef[] = [
  { id: 'k_faerie', kind: 'combo', name: 'Faerie Ring', text: 'Glowcaps and lantern light together call something old. Night-gatherers +50%.', hint: 'Mushrooms love lamplight.', icon: 'glowcap_0', req: [{ building: ['glowcap', 25] }, { building: ['lantern', 10] }], effects: [...boost(NIGHTFOLK, 1.5), flag('faerieRing')] },
  { id: 'k_honeyed', kind: 'combo', name: 'Honeyed Meadow', text: 'So many flowers, so many bees. Hives and nests +50%, flower patches +25%.', hint: 'Bees and blooms in great number.', icon: 'hive_0', req: [{ building: ['hive', 15] }, { building: ['bed', 25] }], effects: [...boost(BEEFOLK, 1.5), ...boost(FLOWERS, 1.25)] },
  { id: 'k_regatta', kind: 'combo', name: 'Regatta', text: 'With this much wind, the skiffs race. Dew Skiffs ×3.', hint: 'Sails need wind.', icon: 'skiff_1', req: [{ building: ['skiff', 6] }, { building: ['windmill', 4] }], effects: [mul('b.skiff', 3)] },
  { id: 'k_cottage', kind: 'combo', name: 'Cottage Gardens', text: 'Roses round every door. All plants +30%.', hint: 'Homes and roses.', icon: 'trellis', req: [{ building: ['cottage', 10] }, { building: ['trellis', 10] }], effects: [mul('cat.flora', 1.3)] },
  { id: 'k_ballet', kind: 'combo', name: 'Moth Ballet', text: 'Moonmoths and Flutterlings dance at dusk. Creature homes +40%.', hint: 'Two kinds of wings.', icon: 'moonmoth_0', req: [{ building: ['roost', 10] }, { building: ['nest', 10] }], effects: [mul('cat.fauna', 1.4)] },
  { id: 'k_harvest', kind: 'combo', name: 'Clockwork Harvest', text: 'Workshop-built reapers. Farm Plots ×2, Workshops +50%.', hint: 'Tools for the fields.', icon: 'farm_1', req: [{ building: ['workshop', 10] }, { building: ['farm', 15] }], effects: [mul('b.farm', 2), mul('b.workshop', 1.5)] },
  { id: 'k_tidy', kind: 'combo', name: 'Tidy Little World', text: 'A little of everything, in its place. All production +25%.', hint: 'Ten of each of the first eight.', icon: 'res_harmony', req: ['fern', 'burrow', 'bed', 'trellis', 'glowcap', 'den', 'lily', 'skiff'].map((id) => ({ building: [id, 10] as [string, number] })), effects: [mul('all', 1.25)] },
  { id: 'k_picnic', kind: 'combo', name: "Stargazer's Picnic", text: 'Fifty Sproutlings on a hill, looking up. Night-gatherers ×2.', hint: 'Bring everyone to the stars.', icon: 'observatory', req: [{ building: ['observatory', 3] }, { building: ['burrow', 50] }], effects: boost(NIGHTFOLK, 2) },
  { id: 'k_choir', kind: 'combo', name: 'Crystal Choir', text: 'The crystals answer the chime. Harmony is twice as strong.', hint: 'Chime below, crystals above.', icon: 'crystal_1', req: [{ building: ['crystal', 8] }, { upgrade: 'w_chime' }], effects: [mul('harmony', 2)] },
  { id: 'k_friends', kind: 'combo', name: 'Old Friends', text: 'They remember you from seasons past. Creature homes +50%.', hint: 'Return, and gather the first folk again.', icon: 'emote_heart', req: [{ seasons: 3 }, { building: ['burrow', 25] }, { building: ['den', 25] }], effects: [mul('cat.fauna', 1.5)] },
];

const WONDER_ENTRIES: JournalDef[] = WONDERS.map((w) => ({ id: `w_${w.id}`, kind: 'wonder', name: w.name, text: w.text, hint: 'Grows from a mysterious seed.', icon: `wonder_${w.id}` }));

export const JOURNAL: JournalDef[] = [...CREATURES, ...WONDER_ENTRIES, ...SECRETS, ...COMBOS, ...EVENTS];
export const JOURNAL_BY_ID: Record<string, JournalDef> = Object.fromEntries(JOURNAL.map((j) => [j.id, j]));

/** Section titles for the journal tabs. */
export const JOURNAL_KINDS: Record<JournalDef['kind'], string> = {
  creature: 'Creatures',
  wonder: 'Wonders',
  secret: 'Secrets',
  combo: 'Combinations',
  event: 'Happenings',
};
