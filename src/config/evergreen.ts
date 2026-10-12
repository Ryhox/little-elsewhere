import { add, boost, flag, mul } from '@/game/effects';
import { BEEFOLK, FLOWERS } from './buildings';
import type { Branch, PermDef } from '@/game/types';

/** The five boughs of the Evergreen tree, in display order. */
export const BRANCHES: Record<Branch, { name: string; blurb: string; color: string; icon: string }> = {
  growth: { name: 'Growth', blurb: 'Faster starts and bigger numbers.', color: '#8cd040', icon: 'fern_0' },
  nature: { name: 'Nature', blurb: 'Plants and creatures that help each other.', color: '#f08aa0', icon: 'res_petals' },
  automation: { name: 'Automation', blurb: 'Helpers that run the world for you.', color: '#e29c5c', icon: 'ic_gear' },
  fortune: { name: 'Fortune', blurb: 'Luck, treasure and rare visitors.', color: '#f2bc36', icon: 'ic_clover' },
  legacy: { name: 'Legacy', blurb: 'What each season leaves behind.', color: '#b5a0de', icon: 'res_evergreen' },
};

/**
 * Permanent upgrades, bought with Evergreen Tokens and kept forever.
 * `cost` is the first level; each further level costs `scale` times more.
 * `row`/`col` place a node inside its branch; `needs` draws the connecting twigs.
 */
export const PERMS: PermDef[] = [
  // ── Growth ──
  { id: 'g_soil', name: 'Rich Soil', branch: 'growth', desc: 'All income +20% per level (each level multiplies the last).', cost: 1, scale: 2.2, max: 5, needs: [], effects: [mul('all', 1.2)], icon: 'fern_1', row: 0, col: 0 },
  { id: 'g_seed', name: 'Seed Money', branch: 'growth', desc: 'Begin each season with dew in hand — ten times more per level.', cost: 1, scale: 3, max: 6, needs: [], effects: [add('startDew', 1)], icon: 'res_dew', row: 0, col: 1 },
  { id: 'g_vigor', name: 'Evergreen Vigor', branch: 'growth', desc: 'All production +2% per level for every Evergreen Token you have ever earned.', cost: 3, scale: 10, max: 3, needs: ['g_seed'], effects: [add('flags.vigor', 1)], icon: 'res_evergreen', row: 1, col: 1 },
  { id: 'g_thrift', name: 'Thrifty Builders', branch: 'growth', desc: 'Buildings cost 7% less per level.', cost: 2, scale: 2.5, max: 5, needs: ['g_soil'], effects: [mul('cost', 0.93)], icon: 'ic_coin', row: 1, col: 0 },
  { id: 'g_memory', name: 'Spring Memory', branch: 'growth', desc: 'The spring remembers you: taps ×3 per level, plus 1% of dew per second.', cost: 4, scale: 5, max: 3, needs: ['g_vigor'], effects: [mul('click', 3), add('clickPct', 0.01)], icon: 'spring_1_0', row: 2, col: 1 },
  { id: 'g_momentum', name: 'Momentum', branch: 'growth', desc: 'All production is tripled for the first 3 minutes of a season, per level.', cost: 8, scale: 5, max: 3, needs: ['g_thrift'], effects: [add('momentum', 180)], icon: 'ic_bolt', row: 2, col: 0 },
  { id: 'g_slopes', name: 'Gentle Slopes', branch: 'growth', desc: 'Building prices climb more slowly (growth −1% per level).', cost: 40, scale: 10, max: 2, needs: ['g_memory'], effects: [add('growth', 0.01)], icon: 'ic_arrow', row: 3, col: 1 },
  { id: 'g_perennial', name: 'Perennial Growth', branch: 'growth', desc: 'Owning 10, 25, 50… of a building multiplies it by 2.5 instead of 2.', cost: 250, max: 1, needs: ['g_momentum', 'g_slopes'], effects: [add('mile', 0.5)], icon: 'ic_star', row: 3, col: 0 },
  { id: 'g_abundance', name: 'Abundance', branch: 'growth', desc: 'All income +50% per level. There is always more.', cost: 20, scale: 1.3, max: 25, needs: ['g_perennial'], effects: [mul('all', 1.5)], icon: 'ic_crown', row: 4, col: 0 },

  // ── Nature ──
  { id: 'n_wild', name: 'Wildflowers', branch: 'nature', desc: 'Wildflowers bloom in every land: flower patches +15% per land discovered.', cost: 2, max: 1, needs: [], effects: [add('syn.regionPetal', 0.15), flag('wildflowers')], icon: 'flower_poppy', row: 0, col: 0 },
  { id: 'n_queens', name: 'Queen Bees', branch: 'nature', desc: 'Hives and nests ×2, and bees help flowers 2% more per hive.', cost: 8, max: 1, needs: ['n_wild'], effects: [...boost(BEEFOLK, 2), add('syn.hivePetal', 0.02)], icon: 'bee_0', row: 1, col: 0 },
  { id: 'n_mycelium', name: 'Mycelium Network', branch: 'nature', desc: 'Every Glowcap Ring makes all plants 1% better.', cost: 12, max: 1, needs: ['n_wild'], effects: [add('syn.glowFlora', 0.01)], icon: 'shroom_pink', row: 1, col: 1 },
  { id: 'n_rain', name: 'Rain Cycle', branch: 'nature', desc: 'Showers come twice as often, and every rainbow leaves a Golden Hour behind.', cost: 30, max: 1, needs: ['n_queens'], seasons: 2, effects: [mul('rate.storm', 2), flag('rainCycle')], icon: 'ic_wind', row: 2, col: 0 },
  { id: 'n_symbiosis', name: 'Symbiosis', branch: 'nature', desc: 'Every creature home helps plants by 0.4%, and every plant patch helps creatures by 0.4%.', cost: 45, max: 1, needs: ['n_mycelium'], effects: [add('syn.faunaFlora', 0.004), add('syn.floraFauna', 0.004)], icon: 'ic_heart', row: 2, col: 1 },
  { id: 'n_nightbloom', name: 'Night Blooms', branch: 'nature', desc: 'Flowers glow after dark and work double at night.', cost: 100, max: 1, needs: ['n_rain'], effects: [...FLOWERS.map((id) => add(`nightBoost.${id}`, 1)), flag('nightBloom')], icon: 'ic_moon', row: 3, col: 0 },
  { id: 'n_resonance', name: 'Harmony Resonance', branch: 'nature', desc: 'Harmony is 30% stronger per level.', cost: 60, scale: 4, max: 3, needs: ['n_symbiosis'], effects: [mul('harmony', 1.3)], icon: 'res_harmony', row: 3, col: 1 },
  { id: 'n_migration', name: 'Great Migration', branch: 'nature', desc: 'Flocks and herds arrive from afar. All creature homes ×2.', cost: 350, max: 1, needs: ['n_nightbloom', 'n_resonance'], seasons: 4, effects: [mul('cat.fauna', 2), flag('migration')], icon: 'bird_0_0', row: 4, col: 0 },

  // ── Automation ──
  { id: 'a_early', name: 'Early Risers', branch: 'automation', desc: 'Start each season with ferns and Sproutlings already at work.', cost: 2, scale: 4, max: 3, needs: [], effects: [add('flags.earlyKit', 1)], icon: 'sproutling_0', row: 0, col: 0 },
  { id: 'a_tappers', name: 'Tireless Tappers', branch: 'automation', desc: 'The spring taps itself twice a second, per level.', cost: 3, scale: 4, max: 3, needs: [], effects: [add('selfTap', 2)], icon: 'ic_hourglass', row: 0, col: 1 },
  { id: 'a_helper', name: 'First Helper', branch: 'automation', desc: 'A clockwork Tinker joins you. Give it a routine and it buys buildings on its own.', cost: 6, max: 1, needs: ['a_early'], effects: [add('helperSlots', 1)], icon: 'tinker_0', row: 1, col: 0 },
  { id: 'a_dreams', name: 'Sweet Dreams', branch: 'automation', desc: 'Offline progress +12.5% and four more hours counted, per level.', cost: 4, scale: 3, max: 4, needs: ['a_tappers'], effects: [add('offline', 0.125), add('offlineCap', 4)], icon: 'emote_zzz', row: 1, col: 1 },
  { id: 'a_guild', name: 'Helper Guild', branch: 'automation', desc: 'One more Tinker, with its own routine, per level.', cost: 40, scale: 5, max: 3, needs: ['a_helper'], effects: [add('helperSlots', 1)], icon: 'tinker_2', row: 2, col: 0 },
  { id: 'a_magpie', name: 'Magpie Friend', branch: 'automation', desc: 'A magpie gathers treasures and golden butterflies for you (at 60% value).', cost: 30, max: 1, needs: ['a_dreams'], effects: [flag('autoCollect')], icon: 'bird_2_0', row: 2, col: 1 },
  { id: 'a_research', name: 'Self-Taught', branch: 'automation', desc: 'Tinkers can be told to buy upgrades.', cost: 50, max: 1, needs: ['a_guild'], effects: [flag('autoUpgrades')], icon: 'ic_upgrades', row: 3, col: 0 },
  { id: 'a_cast', name: 'Rehearsed Rituals', branch: 'automation', desc: 'Abilities cast themselves the moment they are ready.', cost: 70, max: 1, needs: ['a_magpie'], effects: [flag('autoAbilities')], icon: 'ic_bolt', row: 3, col: 1 },
  { id: 'a_carto', name: 'Cartographer', branch: 'automation', desc: 'Tinkers can be told to discover new regions.', cost: 120, max: 1, needs: ['a_research'], effects: [flag('autoRegions')], icon: 'ic_map', row: 4, col: 0 },
  { id: 'a_swift', name: 'Swift Hands', branch: 'automation', desc: 'Tinkers work twice as fast, per level.', cost: 100, scale: 3, max: 4, needs: ['a_cast'], effects: [mul('helperSpeed', 2)], icon: 'ic_wing', row: 4, col: 1 },
  { id: 'a_clock', name: 'Season Clock', branch: 'automation', desc: 'The season can turn itself once it would yield the tokens you ask for.', cost: 800, max: 1, needs: ['a_carto', 'a_swift'], seasons: 6, effects: [flag('autoSeason')], icon: 'sundial', row: 5, col: 0 },

  // ── Fortune ──
  { id: 'f_glints', name: 'Lucky Glints', branch: 'fortune', desc: 'Buried treasures are worth twice as much, per level.', cost: 2, scale: 4, max: 3, needs: [], effects: [mul('treasure', 2)], icon: 'chest', row: 0, col: 0 },
  { id: 'f_glimmer', name: 'Glimmer Drops', branch: 'fortune', desc: '+4% chance per level that a tap is a Glimmer worth ×10.', cost: 3, scale: 3, max: 5, needs: [], effects: [add('crit', 0.04)], icon: 'ic_star', row: 0, col: 1 },
  { id: 'f_golden', name: 'Golden Wings', branch: 'fortune', desc: 'Golden butterflies visit twice as often.', cost: 8, max: 1, needs: ['f_glints'], effects: [mul('rate.golden', 2)], icon: 'golden_0', row: 1, col: 0 },
  { id: 'f_seeds', name: 'Seed Sense', branch: 'fortune', desc: 'Mysterious seeds turn up twice as often and grow twice as fast, per level.', cost: 12, scale: 6, max: 2, needs: ['f_glimmer'], effects: [mul('seedRate', 2), mul('wonderGrow', 2)], icon: 'ic_seed', row: 1, col: 1 },
  { id: 'f_merchant', name: "Merchant's Friend", branch: 'fortune', desc: 'The merchant brings a fourth, rarer offer and gentler prices.', cost: 25, max: 1, needs: ['f_golden'], effects: [flag('merchantFriend')], icon: 'peddler_0', row: 2, col: 0 },
  { id: 'f_clover', name: 'Four-Leaf Clover', branch: 'fortune', desc: 'Luck +25% per level. Luck improves every random reward.', cost: 30, scale: 5, max: 3, needs: ['f_seeds'], effects: [add('luck', 0.25)], icon: 'ic_clover', row: 2, col: 1 },
  { id: 'f_starfall', name: 'Starfall', branch: 'fortune', desc: 'Meteor showers are twice as likely and last twice as long.', cost: 40, max: 1, needs: ['f_merchant'], effects: [mul('rate.meteor', 2), flag('starfall')], icon: 'res_starlight', row: 3, col: 0 },
  { id: 'f_maps', name: 'Treasure Maps', branch: 'fortune', desc: 'Every treasure found this season adds 2% to all production.', cost: 150, max: 1, needs: ['f_clover'], effects: [flag('treasureMaps')], icon: 'ic_map', row: 3, col: 1 },
  { id: 'f_jackpot', name: 'Evergreen Jackpot', branch: 'fortune', desc: 'Treasures and golden butterflies sometimes hide Evergreen Tokens.', cost: 500, max: 1, needs: ['f_starfall', 'f_maps'], seasons: 5, effects: [add('shard', 0.04)], icon: 'res_evergreen', row: 4, col: 0 },

  // ── Legacy ──
  { id: 'l_bloom', name: 'Token Bloom', branch: 'legacy', desc: 'Earn 10% more Evergreen Tokens per level.', cost: 5, scale: 1.7, max: 10, needs: [], effects: [add('token', 0.1)], icon: 'res_evergreen', row: 0, col: 0 },
  { id: 'l_heirloom', name: 'Heirloom Spring', branch: 'legacy', desc: 'The spring keeps its first three upgrades between seasons, per level.', cost: 3, scale: 4, max: 4, needs: [], effects: [add('flags.heirloom', 1)], icon: 'spring_2_0', row: 0, col: 1 },
  { id: 'l_founders', name: "Founders' Garden", branch: 'legacy', desc: 'Start with lands already discovered: the Garden, then the Grove, then the Pond and Meadow.', cost: 8, scale: 5, max: 3, needs: ['l_bloom'], effects: [add('flags.founders', 1)], icon: 'bed_0', row: 1, col: 0 },
  { id: 'l_blessings', name: 'Seasonal Blessings', branch: 'legacy', desc: 'Each new season offers three Blessings. Choose one to shape the whole season.', cost: 20, max: 1, needs: ['l_heirloom'], seasons: 2, effects: [flag('blessings')], icon: 'ic_sun', row: 1, col: 1 },
  { id: 'l_sky', name: 'Sky Seeds', branch: 'legacy', desc: 'Reveals the Floating Isles, where Sky Crystals pull dew from the clouds.', cost: 60, max: 1, needs: ['l_founders'], seasons: 2, effects: [flag('skySeeds')], icon: 'crystal_0', row: 2, col: 0 },
  { id: 'l_keepsake', name: 'Keepsake Shelf', branch: 'legacy', desc: 'One more Wonder may grow each season, and one Wonder is kept when the season turns, per level.', cost: 30, scale: 5, max: 3, needs: ['l_blessings'], effects: [add('keepsakes', 1), add('wonderSlots', 1)], icon: 'wonder_golden_acorn', row: 2, col: 1 },
  { id: 'l_heartwood', name: 'Heartwood', branch: 'legacy', desc: 'Reveals the Elder Tree. It grows a ring every season, and each ring lifts all production by 5%.', cost: 120, max: 1, needs: ['l_sky'], seasons: 3, effects: [flag('heartwood')], icon: 'elder_0', row: 3, col: 0 },
  { id: 'l_memory', name: 'Memory of Gardens', branch: 'legacy', desc: 'Start each season with 10% of the buildings you ended the last one with, per level.', cost: 150, scale: 4, max: 3, needs: ['l_keepsake'], effects: [add('memory', 0.1)], icon: 'ic_journal', row: 3, col: 1 },
  { id: 'l_stars', name: 'Star Charts', branch: 'legacy', desc: 'Opens the Constellations: pour Dew into the night sky for gifts that last forever.', cost: 900, max: 1, needs: ['l_heartwood'], seasons: 8, effects: [flag('constellations')], icon: 'observatory', row: 4, col: 0 },
  { id: 'l_shoals', name: 'Evergreen Shoals', branch: 'legacy', desc: 'Reveals the Shoals, where Evergreen Saplings swell every season’s token harvest.', cost: 2500, max: 1, needs: ['l_stars', 'l_memory'], seasons: 10, effects: [flag('shoals')], icon: 'sapling', row: 5, col: 0 },
];

export const PERM_BY_ID: Record<string, PermDef> = Object.fromEntries(PERMS.map((p) => [p.id, p]));

/** Lands granted by each level of Founders' Garden. */
export const FOUNDER_REGIONS: string[][] = [['garden'], ['grove'], ['pond', 'meadow']];
/** Spring upgrades kept per level of Heirloom Spring. */
export const HEIRLOOM_PER_LEVEL = 3;
/** Evergreen Jackpot pays this share of the season's current token harvest (at least one token). */
export const JACKPOT_SHARE = 0.02;
