# Little Elsewhere

A cozy pixel-art incremental game about growing a tiny magical world from a single spring.

Tap the spring for Dew, plant and build until the world is alive with creatures, and when
progress slows, **rebirth** (Turn the Season) for Evergreen Tokens that permanently make every
future season faster. A full playthrough to the ending takes roughly two hours.

Every sprite, sound and UI frame is generated in code — there are no image or audio files.

## Running it

```
npm install
npm run dev        # play at http://localhost:5183
npm run build      # type-check and build to dist/
npm run balance    # headless playthrough that prints pacing (see below)
```

Open `/?sheet` on the dev server to browse every generated sprite (`/?sheet=oak&zoom=6` to filter and magnify).

## How the code is organised

```
src/
  config/   Everything you would want to tweak, as plain data. No logic.
  engine/   Reusable systems that know nothing about this game.
  art/      Sprite generators (paint into the atlas at boot).
  game/     The simulation. Pure TypeScript, no DOM — runs headless.
  world/    The living scene: terrain, creatures, lighting, rendering.
  audio/    Synthesised sound.
  app/      Wires simulation, world, audio and UI together; owns the frame loop.
  store/    UI state (Zustand).
  ui/       React interface.
scripts/    balance.ts — the headless pacing bot.
```

Dependencies point one way: `config` ← `game` ← `world`/`ui`, with `engine` usable from anywhere.
The simulation never imports rendering code, which is what lets `npm run balance` play the game
in Node.

## Changing things

Almost every change is a data edit in `src/config/`:

| I want to…                         | Edit                                                             |
| ---------------------------------- | ---------------------------------------------------------------- |
| Re-balance pacing                  | `balance.ts`, then costs in `buildings.ts` / `regions.ts`        |
| Add or change a building           | `buildings.ts` (economy) and `world.ts` (`BUILDING_LOOKS`, slots) |
| Add an upgrade                     | `upgrades.ts` — effects are declarative, no code needed          |
| Add a permanent (Evergreen) upgrade| `evergreen.ts`                                                   |
| Change the map                     | `world.ts` — islands, ponds, streams, paths, bridges, decoration |
| Add a creature                     | `creatures.ts` (behaviour) and `art/creatures.ts` (sprite)       |
| Add a particle effect              | `particles.ts`                                                   |
| Change colours                     | `palette.ts` — every sprite follows                              |
| Change lighting, water, wind       | `render.ts`                                                      |
| Change a sound                     | `audio.ts`                                                       |
| Reword the tutorial                | `guide.ts`                                                       |

### How effects work

Upgrades, Wonders, blessings and constellations all describe what they do as data:

```ts
effects: [mul('b.fern', 2), add('syn.hivePetal', 0.02), flag('butterflies')]
```

Each effect writes into one "modifier sheet" (`Mods` in `game/types.ts`) that every formula reads
from. So a new upgrade is one line in a config file, and it is impossible for an upgrade to be
bought without taking effect.

### Balancing

`npm run balance` plays the game with a simple bot and prints when it reached each milestone.

```
npm run balance -- 12              # play 12 seasons (or until the ending)
npm run balance -- 1 --stop=hill   # never discover the Hill: shows the income plateau before it
npm run balance -- 1 --trace=hamlet  # log every purchase for a minute after the Hamlet
```

Land prices are set from those plateaus: a land should cost a few minutes of the income a player
has once everything before it is built.

## Design notes

- **Two currencies.** Dew is earned and spent within a season; Evergreen Tokens are earned by
  rebirth and kept forever.
- **A finite world.** Every building has a maximum, so each season eventually hits a wall —
  that is the cue to rebirth — and the story can actually be completed.
- **Rendering.** The world is drawn at one pixel per world pixel into an off-screen buffer and
  scaled up by whole numbers, so pixels stay crisp at every zoom. Shadows are each sprite's own
  silhouette projected from the sun (or the nearest lamp at night), lighting is a light map
  multiplied over the scene, and reflections are sprites mirrored into the water. Things that
  never move have their shadows and reflections cached per island.
- **Particles** live in typed arrays and are drawn either into a pixel buffer or as batched
  rectangles, whichever is cheaper for the current view.
- **Saves** are stored in `localStorage`, sealed with a checksum and range-checked on load.
  Like any game that runs entirely in the browser, this deters casual tampering rather than
  making it impossible.
