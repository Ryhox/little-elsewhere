import { buildAtlas } from '@/art';
import { Sound } from '@/audio/sound';
import { ACHIEVEMENT_BY_ID } from '@/config/achievements';
import { BALANCE } from '@/config/balance';
import { JOURNAL_BY_ID } from '@/config/journal';
import { REGION_BY_ID } from '@/config/regions';
import { RENDER } from '@/config/render';
import { WONDER_BY_ID } from '@/config/seasons';
import type { Atlas } from '@/engine/atlas';
import { seasonClockDue } from '@/game/automation';
import { createGame, type Game } from '@/game/context';
import { refresh } from '@/game/economy';
import { canTurnSeason, turnSeason } from '@/game/prestige';
import { guideStep } from '@/game/progress';
import { loadFromStorage, saveToStorage } from '@/game/save';
import { fastForward, step } from '@/game/tick';
import { useUI, type Settings } from '@/store/ui';
import { Cutscene } from '@/world/cutscene';
import { WorldInput } from '@/world/input';
import { World, type Hover } from '@/world/scene';

/** The one running game and everything attached to it. Created once at boot. */
export interface Runtime {
  game: Game;
  atlas: Atlas;
  world: World;
  sound: Sound;
  /** Begin Turning the Season (plays the transition, then resets). */
  turn(): void;
  skipCutscene(): void;
  save(): void;
  /** Tell the camera how much of the screen the UI covers (CSS pixels). */
  setInsets(insets: { left: number; right: number; top: number; bottom: number }): void;
  /** What the pointer is over in the world, for tooltips. */
  onHover: (hover: Hover | null, x: number, y: number) => void;
  dispose(): void;
}

let current: Runtime | null = null;

// Hot reload swaps modules one at a time, but the running game is all of a piece. If this module is
// ever loaded a second time (because a config, simulation or world file was edited), start clean
// instead of leaving the interface talking to a copy that was never started. Edits to interface
// files alone do not come through here and still refresh in place.
if (import.meta.hot) {
  if (import.meta.hot.data.loaded) location.reload();
  import.meta.hot.data.loaded = true;
}

/** The live runtime. Only valid after boot. */
export function rt(): Runtime {
  if (!current) throw new Error('Runtime not started');
  return current;
}

const UI_REFRESH = 0.2;
/** A frame gap longer than this means the tab was asleep; the time is credited as time away. */
const ASLEEP_SECONDS = 4;
const MAX_FRAME = 0.25;
const MAX_STEPS = 8;
const ENDING_PAUSE_MS = 5000;

function applySettings(world: World, sound: Sound, settings: Settings): void {
  world.quality = RENDER.quality[Math.min(RENDER.quality.length - 1, Math.max(0, settings.quality))];
  world.showNumbers = settings.numbers;
  world.autoFrame = settings.autoCamera;
  sound.setVolumes({ master: settings.master, sfx: settings.sfx, music: settings.music });
}

/** Route simulation events to sound and to the little messages at the edge of the screen. */
function wire(game: Game, sound: Sound): (() => void)[] {
  const ui = () => useUI.getState();
  const bus = game.bus;
  return [
    bus.on('tap', ({ crit, auto }) => !auto && sound.play(crit ? 'glimmer' : 'tap', 1 + game.s.flow * 0.5 + Math.random() * 0.06)),
    bus.on('buy', ({ auto }) => !auto && sound.play('buy', 0.96 + Math.random() * 0.1)),
    bus.on('upgrade', ({ auto }) => !auto && sound.play('upgrade')),
    bus.on('perm', () => sound.play('upgrade', 0.8)),
    bus.on('ability', () => sound.play('ability')),
    bus.on('region', ({ id, quiet }) => {
      if (quiet) return;
      sound.play('region');
      ui().toast(`Discovered ${REGION_BY_ID[id].name}!`, 'ic_map', true);
    }),
    bus.on('achievement', ({ id }) => {
      sound.play('achievement', 1, 1, 0.4);
      ui().toast(`Achievement: ${ACHIEVEMENT_BY_ID[id].name}`, ACHIEVEMENT_BY_ID[id].icon, true);
    }),
    bus.on('journal', ({ id }) => {
      sound.play('discovery', 1, 1, 0.4);
      ui().toast(`Journal: ${JOURNAL_BY_ID[id].name}`, JOURNAL_BY_ID[id].icon);
    }),
    bus.on('reward', ({ source, text }) => {
      sound.play(source === 'treasure' || source === 'rainbow' ? 'treasure' : 'collect');
      ui().toast(text, source === 'treasure' ? 'chest_open' : 'ic_star');
    }),
    bus.on('wonder', ({ id }) => {
      sound.play('achievement');
      ui().toast(`A Wonder has grown: ${WONDER_BY_ID[id].name}!`, `wonder_${id}`, true);
    }),
    bus.on('seedPlanted', () => ui().toast('A mysterious seed has been planted in the clearing.', 'ic_seed')),
    bus.on('sweep', ({ chain }) => sound.play('tap', 1.2 + Math.min(chain, 12) * 0.06, 0.7, 0.02)),
    bus.on('shake', ({ seed }) => sound.play(seed ? 'treasure' : 'splash', 1, 1.6)),
    bus.on('pet', () => sound.play('collect', 1.3, 0.7)),
    bus.on('guide', () => sound.play('discovery', 1.2, 0.8, 0.2)),
    bus.on('ending', () => {
      sound.play('season');
      // Let the tree be seen in bloom for a moment before the closing words appear.
      setTimeout(() => ui().setModal({ kind: 'ending' }), ENDING_PAUSE_MS);
    }),
    bus.on('spawn', ({ id }) => {
      if (id === 'merchant') ui().toast('A travelling merchant has rolled in by the pond.', 'peddler_0');
      else if (id === 'storm') ui().toast('Magical rain! Every plant is thriving.', 'res_dew');
      else if (id === 'meteor') ui().toast('A meteor shower! Catch the falling stars.', 'res_starlight');
      else if (id === 'rainbow') ui().toast('A rainbow! Find where it ends.', 'ic_sun');
      else if (id === 'golden') sound.play('discovery', 1.4, 0.6);
    }),
  ];
}

export function startRuntime(canvas: HTMLCanvasElement): Runtime {
  current?.dispose();
  const ui = () => useUI.getState();
  const game = createGame();
  const away = loadFromStorage(game);
  refresh(game);
  const atlas = buildAtlas();
  const world = new World(game, atlas);
  const sound = new Sound();
  const ctx = canvas.getContext('2d')!;
  const unwire = wire(game, sound);
  applySettings(world, sound, ui().settings);
  const unsubscribeSettings = useUI.subscribe((state, previous) => {
    if (state.settings !== previous.settings) applySettings(world, sound, state.settings);
  });

  if (away !== null && away > BALANCE.offline.minSeconds) {
    const gained = fastForward(game, away);
    world.rebuild();
    ui().setModal({ kind: 'offline', seconds: Math.min(away, game.mods.offlineCap * 3600), gained });
  }
  if (game.s.blessingChoices.length && !ui().modal) ui().setModal({ kind: 'blessing' });

  let insets = { left: 0, right: 0, top: 0, bottom: 0 };
  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    world.camera.resize(w, h);
    world.camera.insets = { left: insets.left * ratio, right: insets.right * ratio, top: insets.top * ratio, bottom: insets.bottom * ratio };
  };
  resize();
  world.frameAll();
  world.camera.snap();
  window.addEventListener('resize', resize);

  const input = new WorldInput(canvas, world, {
    onHover: (hover, x, y) => runtime.onHover(hover, x, y),
    onActivity: () => sound.unlock(),
    onLook: () => {
      game.s.stats.looked = 1;
    },
  });

  const save = () => saveToStorage(game);
  const turn = () => {
    if (world.cutscene.active || !canTurnSeason(game)) return;
    const state = ui();
    state.setModal(null);
    state.setCutscene(true);
    const seconds = state.settings.shortCutscene ? BALANCE.prestige.cutsceneMinSeconds : Cutscene.lengthFor(game.s.seasons);
    let tokens = 0;
    sound.play('season');
    world.cutscene.start(
      seconds,
      () => {
        tokens = turnSeason(game);
        save();
      },
      () => {
        ui().setCutscene(false);
        ui().setModal(game.s.blessingChoices.length ? { kind: 'blessing' } : { kind: 'turned', tokens });
        world.burst('tokens', world.spring[0], world.spring[1]);
      },
    );
  };

  let raf = 0;
  let last = performance.now();
  let lastDraw = 0;
  let carry = 0;
  let uiClock = 0;
  let saveClock = BALANCE.save.intervalSeconds;
  const stepSeconds = 1 / BALANCE.tickRate;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const { settings, zen } = ui();
    if (settings.fps > 0 && now - lastDraw < 1000 / settings.fps - 2) return;
    lastDraw = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > ASLEEP_SECONDS) {
      // The tab was in the background: credit the time the way an absence is credited.
      fastForward(game, dt);
      dt = stepSeconds;
    }
    dt = Math.min(dt, MAX_FRAME);

    carry += dt;
    for (let i = 0; i < MAX_STEPS && carry >= stepSeconds; i++) {
      step(game, stepSeconds);
      carry -= stepSeconds;
    }
    if (carry > stepSeconds * MAX_STEPS) carry = 0;
    if (zen) game.s.stats.zenSeconds = (game.s.stats.zenSeconds ?? 0) + dt;
    const pointAt = zen ? undefined : guideStep(game.s)?.point;
    world.pointer = pointAt === 'spring' ? world.spring : pointAt === 'drop' ? world.play.nearestDrop() : pointAt === 'plant' ? world.play.shakeable() : null;
    if (seasonClockDue(game) && !world.cutscene.active) turn();

    input.update(dt);
    world.update(dt);
    sound.update(world.night);
    world.draw(ctx);

    uiClock -= dt;
    if (uiClock <= 0) {
      uiClock = UI_REFRESH;
      ui().bump();
    }
    saveClock -= dt;
    if (saveClock <= 0) {
      saveClock = BALANCE.save.intervalSeconds;
      save();
    }
  };
  raf = requestAnimationFrame(frame);

  const onHide = () => document.visibilityState === 'hidden' && save();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('beforeunload', save);

  const runtime: Runtime = {
    game,
    atlas,
    world,
    sound,
    turn,
    skipCutscene: () => world.cutscene.skip(),
    save,
    setInsets: (next) => {
      const changed = next.left !== insets.left || next.right !== insets.right || next.top !== insets.top || next.bottom !== insets.bottom;
      insets = next;
      resize();
      if (changed && ui().settings.autoCamera) world.frameAll();
    },
    onHover: () => {},
    dispose: () => {
      cancelAnimationFrame(raf);
      save();
      input.dispose();
      world.dispose();
      unsubscribeSettings();
      for (const off of unwire) off();
      window.removeEventListener('resize', resize);
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', onHide);
      if (current === runtime) current = null;
    },
  };
  world.happenings.onMerchant = () => ui().setModal({ kind: 'merchant' });
  current = runtime;
  // Nothing is ever attached to `window`: the game is only reachable through its own interface.
  // For development there is an explicit opt-in (`?dev` on a dev server) that exposes it for debugging.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('dev')) (window as unknown as { le: Runtime }).le = runtime;
  return runtime;
}
