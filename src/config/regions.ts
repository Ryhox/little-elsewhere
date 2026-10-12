import type { RegionDef } from '@/game/types';

/**
 * The lands of Little Elsewhere, in the order they are usually discovered.
 * Where each one sits on the map is described separately in config/world.ts.
 */
export const REGIONS: RegionDef[] = [
  { id: 'clearing', name: 'Dewdrop Clearing', blurb: 'A mossy clearing around a spring that hums when you touch it.', cost: {}, needs: [], tokens: 0 },
  { id: 'garden', name: 'Petal Garden', blurb: 'Tidy beds and tangled trellises, every petal holding a drop.', cost: { dew: 250 }, needs: ['clearing'], tokens: 0 },
  { id: 'grove', name: 'Mushroom Grove', blurb: 'Giant toadstools and soft glowing caps. Home of the Mosslings.', cost: { dew: 6000 }, needs: ['clearing'], tokens: 1 },
  { id: 'pond', name: 'Lilypad Pond', blurb: 'Still water, lilies and little boats. Ponds water every plant.', cost: { dew: 150000 }, needs: ['grove'], tokens: 1 },
  { id: 'meadow', name: 'Honey Meadow', blurb: 'Hives hum among the wildflowers. Bees make flowers thrive.', cost: { dew: 6e6 }, needs: ['garden'], tokens: 1 },
  { id: 'hamlet', name: 'Hearthside Hamlet', blurb: 'Cottages, workshops and lantern light. Where seasons are kept.', cost: { dew: 6e8 }, needs: ['pond', 'meadow'], tokens: 2 },
  { id: 'hill', name: 'Windmill Hill', blurb: 'Breezy slopes of windmills and little farms.', cost: { dew: 1.5e12 }, needs: ['hamlet'], tokens: 3 },
  { id: 'woods', name: 'Whispering Woods', blurb: 'Old trees with houses in their branches. Moonmoths roost here.', cost: { dew: 3e15 }, needs: ['hill'], tokens: 4 },
  { id: 'rise', name: 'Stargazer Rise', blurb: 'A quiet height for watching the sky and catching stardew.', cost: { dew: 3e18 }, needs: ['woods'], tokens: 6 },
  { id: 'isles', name: 'Floating Isles', blurb: 'Islands that forgot to stay down, crowned with sky crystals.', cost: { dew: 2e21 }, needs: ['rise'], perm: 'l_sky', tokens: 10 },
  { id: 'heartwood', name: 'Elder Heartwood', blurb: 'The oldest tree in Elsewhere. It remembers every season.', cost: { dew: 1e24 }, needs: ['grove'], perm: 'l_heartwood', tokens: 15 },
  { id: 'shoals', name: 'Evergreen Shoals', blurb: 'Sandy shallows where evergreen saplings take root.', cost: { dew: 1e28 }, needs: ['pond'], perm: 'l_shoals', tokens: 25 },
];

export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const START_REGION = REGIONS[0].id;
