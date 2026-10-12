# Working on Little Elsewhere

Notes for anyone who wants to change the game. For what the game is and how to run it, see the
[README](../README.md).

## Commands

```
npm install
npm run dev        # play at http://localhost:5183
npm run build      # type-check and build to dist/
npm run typecheck  # type-check only
npm run balance    # headless playthrough that prints pacing (see below)
npm run portrait   # turn a picture into the teacher's pixel portrait (see scripts/portrait.ts)
npm run site       # redraw the page's icons and link preview, and rewrite the other files in public/
```

A few addresses on the dev server are useful while working:

| Address            | What it shows                                                        |
| ------------------ | -------------------------------------------------------------------- |
| `/?sheet`          | Every generated sprite (`/?sheet=oak&zoom=6` to filter and magnify)  |
| `/?teacher`        | All of Claudia's gestures playing at once (`&talk` makes her speak)  |
| `/?looks`          | The teacher's alternative drawn looks, side by side                  |
| `/?slot=name`      | The game on a separate save, so you can try things without touching your real one |

## How the code is organised

```
src/
  config/   Everything you would want to tweak, as plain data. No logic.
  engine/   Reusable systems that know nothing about this game.
  art/      Sprite generators (paint into the atlas at boot).
  game/     The simulation. Pure TypeScript, no DOM: runs headless.
  world/    The living scene: terrain, creatures, lighting, rendering.
  audio/    Synthesised sound.
  app/      Wires simulation, world, audio and UI together; owns the frame loop.
  store/    UI state (Zustand).
  ui/       React interface.
scripts/    balance.ts: the headless pacing bot. portrait.ts: the portrait converter.
            site.ts: the page's icons, link preview and privacy page.
public/     What the web page needs around the game. Written by `npm run site`; do not edit by hand.
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
| Add an upgrade                     | `upgrades.ts`: effects are declarative, no code needed          |
| Add a permanent (Evergreen) upgrade| `evergreen.ts`                                                   |
| Change the map                     | `world.ts`: islands, ponds, streams, paths, bridges, decoration |
| Add a creature                     | `creatures.ts` (behaviour) and `art/creatures.ts` (sprite)       |
| Add a particle effect              | `particles.ts`                                                   |
| Change colours                     | `palette.ts`: every sprite follows                              |
| Change lighting, water, wind       | `render.ts`                                                      |
| Change a sound                     | `audio.ts`                                                       |
| Reword the tutorial                | `guide.ts`: lessons, what Claudia says and which gesture she makes, her welcome back and her closing words |
| Give Claudia a new gesture         | `teacher.ts` (key poses, as data, in `PICTURE_ANIMS`): she is painted from them in `art/teacherPicture.ts` |
| Change where Claudia's eyes, mouth and arms are | `teacher.ts` (`TEACHER_PICTURE`)                    |
| Change the sea life                | `sea.ts`: reefs, fish schools, leaping fish, boats, rocks       |
| Change a mouse pointer             | `art/cursors.ts`: each is a small character grid                |
| Change the page's title, description, address or author links | `site.ts`, then `npm run site` |
| Tune sweeping, shaking, petting, the rain cloud | `balance.ts` (`play`: what they are worth) and `render.ts` (`play`, `income`: how they look) |

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

### Claudia's portrait

Claudia is a small pixel portrait stored as text in `src/art/portrait.data.ts`. It is made from a
picture by `npm run portrait`; the exact command is recorded at the top of that file. Every frame
of her is painted from it in `src/art/teacherPicture.ts`: the picture is bent a pixel or two to
move her head, her eyes and mouth are drawn fresh, and a moving arm is taken out of the picture
and drawn again from the shoulder.

## Design notes

- **Two currencies.** Dew is earned and spent within a season; Evergreen Tokens are earned by
  rebirth and kept forever.
- **More to do than tap.** Besides tapping the spring, the pointer sweeps up dewdrops that form
  on everything, shakes trees and bushes, pets creatures (their homes work harder for a while)
  and drags a rain cloud that doubles whatever it waters.
- **A teacher, not a wall of text.** Claudia introduces each of six short lessons in the
  middle of the screen, then her card slides into the corner with a reminder. Whatever a lesson
  asks you to buy is marked in the menus, with its price and a "Show me" button on the card.
  She also welcomes you back after time away, and has the last word at the ending.
- **The pointer tells you what a click does.** Every kind of thing in the world has its own
  mouse pointer (tap, sweep, shake, pet, carry the cloud, something to find, something to read
  about), and it changes for a moment when the click lands.
- **A finite world.** Every building has a maximum, so each season eventually hits a wall
  (that is the cue to rebirth) and the story can actually be completed.
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
