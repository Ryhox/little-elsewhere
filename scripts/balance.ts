/**
 * Headless playthrough. A simple bot plays several seasons and prints when it reached
 * each milestone, so pacing changes in src/config can be checked without playing by hand.
 *
 *   npm run balance            → 6 seasons
 *   npm run balance -- 12      → 12 seasons
 */
import { ABILITIES } from '../src/config/abilities';
import { BUILDINGS } from '../src/config/buildings';
import { PERMS } from '../src/config/evergreen';
import { REGION_BY_ID, REGIONS } from '../src/config/regions';
import { mulberry } from '../src/engine/rng';
import { availableUpgrades, buyBuilding, buyPerm, buyRegion, buyUpgrade, castAbility, chooseBlessing, discoverableRegions, permAvailable, permCost, regionCost, tap, upgradeCost } from '../src/game/actions';
import { createGame, newState } from '../src/game/context';
import { buildingCost, canAfford, computeRates, costShare, refresh, roomFor, totalBuildings } from '../src/game/economy';
import { collect } from '../src/game/events';
import { fmt, fmtTime } from '../src/game/format';
import { canTurnSeason, tokensOnTurn, turnSeason } from '../src/game/prestige';
import { step } from '../src/game/tick';

const SEASONS = Number(process.argv[2] ?? 6);
const DT = 0.1;
/** Taps per second: an eager start, then an occasional poke. */
const tapRate = (seasonTime: number) => (seasonTime < 480 ? 4 : 1);
/** The bot turns the season once tokens grew by less than this factor over the last window. */
const STALL_GROWTH = 1.1;
const WINDOW_STEPS = 180 / DT;
const MAX_SEASON_SECONDS = 2 * 3600;
/** How long the bot will keep one season going while it tries to reach the ending. */
const FINAL_PUSH_SECONDS = 25 * 60;
/** `--minutes=<n>`: cut every season off after this long (for quick plateau measurements with `--stop`). */
const LIMIT_SECONDS = Number(process.argv.find((a) => a.startsWith('--minutes='))?.split('=')[1] ?? Infinity) * 60;
const REPORT_EVERY = 300;

const game = createGame(newState(), mulberry(7));
refresh(game);

const pendingCollects: { id: string; at: number }[] = [];
game.bus.on('spawn', ({ id }) => {
  if (['treasure', 'golden', 'visitor', 'rainbow', 'whale'].includes(id) && game.rand() < 0.75) pendingCollects.push({ id, at: game.s.time + 4 });
});

let log: string[] = [];
let totalSeconds = 0;
/** Tokens the previous rebirth gave. */
let lastHarvest = 0;

/** `--trace=<land>`: after that land is discovered, log every purchase for a minute (to chase down sudden jumps). */
const TRACE_LAND = process.argv.find((a) => a.startsWith('--trace='))?.split('=')[1];
const TRACE_SECONDS = 60;
let traceUntil = -1;
const tracing = () => game.s.time < traceUntil;
game.bus.on('region', ({ id }) => {
  if (id === TRACE_LAND) traceUntil = game.s.time + TRACE_SECONDS;
});
game.bus.on('buy', ({ id, count }) => tracing() && note(`  buy ${id} ×${count} → ${fmt(game.rates.res.dew)}/s, bank ${fmt(game.s.res.dew)}`));
game.bus.on('upgrade', ({ id }) => tracing() && note(`  upgrade ${id} → ${fmt(game.rates.res.dew)}/s, bank ${fmt(game.s.res.dew)}`));
game.bus.on('reward', ({ text }) => tracing() && note(`  reward: ${text}`));
game.bus.on('ability', ({ id }) => tracing() && note(`  cast ${id}, bank ${fmt(game.s.res.dew)}`));
const note = (text: string) => log.push(`  ${fmtTime(game.s.time).padStart(8)}  ${text}`);
game.bus.on('region', ({ id }) => note(`discovered ${REGION_BY_ID[id].name} (at ${fmt(game.rates.res.dew)} dew/s)`));

/** Dew per second gained by buying one more of a building. */
function dewGain(id: string): number {
  const before = game.rates.res.dew;
  game.s.b[id] += 1;
  const after = computeRates(game).res.dew;
  game.s.b[id] -= 1;
  return after - before;
}

/**
 * `--stop=<land>`: the bot never discovers that land (or any after it). Run one season this way to see
 * what income a player plateaus at with everything before it: the number land prices are set from.
 */
const STOP_LAND = process.argv.find((a) => a.startsWith('--stop='))?.split('=')[1];
const stopIndex = STOP_LAND ? REGIONS.findIndex((r) => r.id === STOP_LAND) : Infinity;
const allowed = (id: string) => REGIONS.findIndex((r) => r.id === id) < stopIndex;

function decide(firsts: Record<string, boolean>): void {
  const { s } = game;
  for (const region of discoverableRegions(game)) if (allowed(region.id) && canAfford(s, regionCost(game, region))) buyRegion(game, region.id);
  for (const def of availableUpgrades(game).sort((a, b) => costShare(s, upgradeCost(game, a)) - costShare(s, upgradeCost(game, b)))) {
    if (!canAfford(s, upgradeCost(game, def))) break;
    buyUpgrade(game, def.id);
    if (!firsts.upgrade) {
      firsts.upgrade = true;
      note(`first upgrade (${def.name})`);
    }
    if (def.id === 'b_burrow_2') note('first automation (Spring Tappers)');
    if (def.id === 'w_sundial') note('Season Sundial built');
  }
  // Buildings that only give bonuses are picked up whenever they are cheap relative to the bank…
  for (const def of BUILDINGS) {
    if (!s.regions[def.region] || def.base) continue;
    for (let guard = 0; guard < 20 && roomFor(s, def.id) > 0 && costShare(s, buildingCost(game, def.id, 1)) <= 0.2; guard++) buyBuilding(game, def.id, 1);
  }
  // …and among dew makers, the best payback wins.
  for (let guard = 0; guard < 40; guard++) {
    let best: { id: string; score: number } | null = null;
    for (const def of BUILDINGS) {
      if (!s.regions[def.region] || !def.base || roomFor(s, def.id) <= 0) continue;
      const cost = buildingCost(game, def.id, 1);
      if (!canAfford(s, cost) || !cost.dew) continue;
      const score = dewGain(def.id) / cost.dew;
      if (score > 0 && (!best || score > best.score)) best = { id: def.id, score };
    }
    if (!best) break;
    buyBuilding(game, best.id, 1);
    if (!firsts.building) {
      firsts.building = true;
      note('first building');
    }
    if (best.id === 'burrow' && !firsts.helper) {
      firsts.helper = true;
      note('first helper creature (Sproutling)');
    }
  }
  for (const def of ABILITIES) castAbility(game, def.id);
  if (s.blessingChoices.length) chooseBlessing(game, s.blessingChoices[0]);
}

/** The permanent upgrades that lead to the ending, in order. The bot heads for these first, as a goal-minded player would. */
const STORY_PATH = ['l_bloom', 'g_soil', 'l_founders', 'l_sky', 'l_heartwood'];

function spendTokens(): string[] {
  const bought: string[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const next = STORY_PATH.find((id) => !game.s.perm[id]);
    if (next && permAvailable(game, next) && permCost(game, next) <= game.s.tokens) {
      buyPerm(game, next);
      bought.push(`${next}*`);
      continue;
    }
    // While saving for the next story step, only small purchases are allowed.
    const allowance = next ? game.s.tokens * 0.3 : game.s.tokens;
    const options = PERMS.filter((p) => permAvailable(game, p.id) && permCost(game, p.id) <= allowance).sort((a, b) => permCost(game, a.id) - permCost(game, b.id));
    if (!options.length) break;
    buyPerm(game, options[0].id);
    bought.push(options[0].name);
  }
  refresh(game);
  return bought;
}

for (let season = 1; season <= SEASONS; season++) {
  log = [];
  const firsts: Record<string, boolean> = {};
  let tapCarry = 0;
  let decideClock = 0;
  let firstTurnable = -1;
  let nextReport = REPORT_EVERY;
  const history: number[] = [];

  for (;;) {
    step(game, DT);
    const { s } = game;
    tapCarry += tapRate(s.time) * DT;
    while (tapCarry >= 1) {
      tapCarry -= 1;
      tap(game);
    }
    for (let i = pendingCollects.length - 1; i >= 0; i--) {
      if (s.time >= pendingCollects[i].at) collect(game, pendingCollects.splice(i, 1)[0].id);
    }
    decideClock -= DT;
    if (decideClock <= 0) {
      decideClock = 0.5;
      decide(firsts);
    }
    const tokens = tokensOnTurn(game);
    if (s.time >= nextReport) {
      nextReport += REPORT_EVERY;
      note(`… ${fmt(game.rates.res.dew)} dew/s, ${totalBuildings(s)} buildings, ${tokens} tokens on turn`);
    }
    // The season is "done" once waiting three more minutes would add less than a tenth to the harvest.
    history.push(tokens);
    const past = history.length > WINDOW_STEPS ? history[history.length - 1 - WINDOW_STEPS] : 0;
    if (canTurnSeason(game)) {
      if (firstTurnable < 0) {
        firstTurnable = s.time;
        note(`season can turn (${tokens} tokens)`);
      }
      // With the Elder Heartwood in sight, the bot stays to finish the story instead of turning the season.
      const finishing = !!s.perm.l_heartwood && s.time < FINAL_PUSH_SECONDS;
      // No sensible player rebirths for less than they got last time.
      const worthwhile = tokens >= Math.max(5, lastHarvest * 0.8);
      const stalled = past > 0 && tokens < past * STALL_GROWTH && s.time - firstTurnable > 60;
      if (!finishing && ((worthwhile && stalled) || s.time > MAX_SEASON_SECONDS)) break;
      if (finishing && s.time > FINAL_PUSH_SECONDS - 1) break;
    }
    if (s.stats.ended || s.time > LIMIT_SECONDS) break;
  }

  const { s } = game;
  totalSeconds += s.time;
  const summary = `Season ${season}: ${fmtTime(s.time)} · ${fmt(s.earned.dew)} dew earned · ${fmt(game.rates.res.dew)}/s · ${totalBuildings(s)} buildings · ${Object.keys(s.up).length} upgrades · ${Object.keys(s.regions).length} lands`;
  if (s.stats.ended) {
    console.log(`\n${summary}`);
    console.log(log.join('\n'));
    console.log(`\n★ THE EVERBLOOM: story complete after ${fmtTime(totalSeconds)} of play, in season ${season}.`);
    break;
  }
  const tokens = turnSeason(game);
  lastHarvest = tokens;
  pendingCollects.length = 0;
  console.log(`\n${summary} → +${tokens} tokens (total played ${fmtTime(totalSeconds)})`);
  console.log(log.join('\n'));
  const bought = spendTokens();
  console.log(`  bought ${bought.length} permanent levels, ${fmt(game.s.tokens)} tokens left${bought.length ? `: ${[...new Set(bought)].join(', ')}` : ''}`);
}
