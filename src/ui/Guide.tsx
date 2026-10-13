import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { rt } from '@/app/runtime';
import { PICTURE_FRAME, pictureFrame } from '@/art/teacherPicture';
import { BUILDING_BY_ID } from '@/config/buildings';
import { GUIDE, GUIDE_FAREWELL, GUIDE_FEEL, GUIDE_STAT, wordsFor, type GuideLine, type GuideWant, type Words } from '@/config/guide';
import { REGION_BY_ID } from '@/config/regions';
import { TEACHER, TEACHER_PICTURE, teacherFace, teacherFrame, teacherIsPicture, type TeacherAnimName } from '@/config/teacher';
import { UPGRADE_BY_ID } from '@/config/upgrades';
import { discoverableRegions, regionCost, upgradeCost, upgradeVisible } from '@/game/actions';
import type { Game } from '@/game/context';
import { buildingCost, canAfford } from '@/game/economy';
import { fmt } from '@/game/format';
import { guideWant } from '@/game/progress';
import type { Cost } from '@/game/types';
import { useUI, type PanelId } from '@/store/ui';
import { freeArea } from './layout';
import { Bar, Btn, CostLine, Icon, useLayout, useTick } from './widgets';

/**
 * The tutorial as the player meets it: Claudia speaks each lesson in the middle of the
 * screen, then her card slides up into the corner and waits there with a reminder and the exact
 * thing to buy, which is also marked in the menus.
 */

/* ───────────────────────────── What the guide wants ───────────────────────────── */

/** The guide's state, re-read with the tick. */
export function useGuide() {
  useTick();
  const { game } = rt();
  const index = game.s.stats[GUIDE_STAT.step] ?? 0;
  const hidden = !!game.s.stats[GUIDE_STAT.hidden];
  return { game, index, hidden, step: hidden ? null : (GUIDE[index] ?? null), want: guideWant(game.s) };
}

/** Her words as this player should hear them: about taps for a finger, about clicks for a mouse. */
const phrase = (words: Words) => wordsFor(words, useUI.getState().touch, useUI.getState().layout.compact);

/** Is this the very thing the current lesson asks the player to buy? */
export const isWanted = (want: GuideWant | null, kind: 'building' | 'upgrade' | 'region', id: string) => !!want && (want as Partial<Record<string, string>>)[kind] === id;

interface WantInfo {
  icon: string;
  name: string;
  cost: Cost;
  /** The menu tab it is bought in, and that tab's name. */
  panel: PanelId;
  menu: string;
  /** Is it on offer there right now? */
  offered: boolean;
}

export function describeWant(game: Game, want: GuideWant): WantInfo {
  if ('building' in want) {
    const def = BUILDING_BY_ID[want.building];
    return { icon: def.icon, name: def.name, cost: buildingCost(game, def.id, 1), panel: 'build', menu: 'Build', offered: !!game.s.regions[def.region] };
  }
  if ('upgrade' in want) {
    const def = UPGRADE_BY_ID[want.upgrade];
    return { icon: def.icon, name: def.name, cost: upgradeCost(game, def), panel: 'upgrades', menu: 'Upgrades', offered: upgradeVisible(game, def) };
  }
  const def = REGION_BY_ID[want.region];
  return { icon: 'ic_map', name: def.name, cost: regionCost(game, def), panel: 'build', menu: 'Build', offered: discoverableRegions(game).includes(def) };
}

/** Open the right menu and bring the wanted thing into view. */
function showWant(panel: PanelId): void {
  const ui = useUI.getState();
  ui.openPanel(panel);
  ui.pingGuide();
}

/**
 * For a menu row: when it is what the lesson asks for, it glows, and it scrolls itself into
 * view whenever the player asks to be shown. Spread `ref` and `className` onto the row.
 */
export function useWantedRow(wanted: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const ping = useUI((s) => s.guidePing);
  useEffect(() => {
    if (wanted) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [wanted, ping]);
  // Room at the top for the ribbon, so it never sits on the row's own words.
  return { ref, className: wanted ? 'guide-wanted pt-3' : '' };
}

/** A bouncing arrow pointing at what to press. `to` is the way it points. */
export function GuideArrow({ to, className = '' }: { to: 'right' | 'down'; className?: string }) {
  return (
    <span className={`guide-arrow guide-arrow-${to} pointer-events-none absolute z-10 ${className}`}>
      <Icon name="ic_pointer" size={24} />
    </span>
  );
}

/** The little ribbon on the wanted row. */
export function GuideTag({ children }: { children: ReactNode }) {
  return <span className="guide-tag pointer-events-none absolute -top-2 left-2 z-10">{children}</span>;
}

/* ───────────────────────────── The teacher ───────────────────────────── */

interface Box {
  left: number;
  up: number;
  w: number;
  h: number;
}

let wholeBox: Box | null = null;

/** The space a drawn look's portrait needs around its anchor over every frame of every gesture, so she never jumps. */
function portraitBox(): Box {
  if (wholeBox) return wholeBox;
  const { atlas } = rt();
  let left = 0;
  let right = 0;
  let up = 0;
  let down = 0;
  for (const name of atlas.names()) {
    if (!name.startsWith('teacher_')) continue;
    const s = atlas.get(name);
    left = Math.max(left, s.ax);
    right = Math.max(right, s.w - s.ax);
    up = Math.max(up, s.ay);
    down = Math.max(down, s.h - s.ay);
  }
  return (wholeBox = { left, up, w: left + right, h: up + down });
}

interface TeacherProps {
  anim: TeacherAnimName;
  talking?: boolean;
  scale: number;
  /** Show just her face, for small places. */
  faceOnly?: boolean;
}

/** Claudia, animated. */
export function Teacher(props: TeacherProps) {
  return teacherIsPicture() ? <PictureTeacher {...props} /> : <DrawnTeacher {...props} />;
}

/**
 * The portrait made from a picture: painted afresh many times a second, so that her gesture, her
 * blinking, her breathing and her talking can each go at their own pace.
 */
function PictureTeacher({ anim, talking = false, scale, faceOnly = false }: TeacherProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Whether she is speaking changes with every line; it must not start her gesture over.
  const speaking = useRef(talking);
  speaking.current = talking;
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    const draw = () => ctx.putImageData(pictureFrame(anim, frame++, speaking.current).toImageData(), 0, 0);
    draw();
    const id = setInterval(draw, 1000 / TEACHER_PICTURE.fps);
    return () => clearInterval(id);
  }, [anim]);
  const { face } = TEACHER_PICTURE;
  const view = faceOnly ? { x: PICTURE_FRAME.x + face.x, y: PICTURE_FRAME.y + face.y, w: face.w, h: face.h } : { x: 0, y: 0, w: PICTURE_FRAME.w, h: PICTURE_FRAME.h };
  return (
    <span className="relative block overflow-hidden" style={{ width: view.w * scale, height: view.h * scale }}>
      <canvas
        ref={canvas}
        width={PICTURE_FRAME.w}
        height={PICTURE_FRAME.h}
        className="absolute max-w-none"
        style={{ left: -view.x * scale, top: -view.y * scale, width: PICTURE_FRAME.w * scale, height: PICTURE_FRAME.h * scale, imageRendering: 'pixelated' }}
      />
    </span>
  );
}

/** A conversation narrower than this (interface pixels) stacks her portrait over her words. */
const TALK_ROW = 520;
/**
 * On an upright phone she speaks from the lower part of the screen, near the thumb, and this far
 * above the tabs: clear of the row of abilities, with the purse and any messages free above her.
 */
const TALK_LIFT = 54;

/**
 * Claudia saying something outside her lessons (a welcome back, the ending): her portrait
 * making a gesture, and her words appearing as she speaks them. A click brings out the rest at once.
 */
export function TeacherSays({ anim, words }: { anim: TeacherAnimName; words: string }) {
  const { compact, w, h } = useLayout();
  const [letters, setLetters] = useState(0);
  const spoken = letters >= words.length;
  useEffect(() => {
    if (spoken) return;
    const id = setTimeout(() => {
      if (GUIDE_FEEL.blipEvery && letters % GUIDE_FEEL.blipEvery === 0 && words[letters] !== ' ') rt().sound.play('speak', 0.92 + Math.random() * 0.2, 0.6);
      setLetters(letters + 1);
    }, 1000 / GUIDE_FEEL.lettersPerSecond);
    return () => clearTimeout(id);
  }, [letters, words, spoken]);
  return (
    <div className={`flex gap-3 ${compact && w < TALK_ROW ? 'flex-col items-center' : 'flex-row items-stretch'}`} onClick={() => setLetters(words.length)}>
      <div className="guide-stage skin-slot shrink-0 self-center">
        <Teacher anim={anim} talking={!spoken} scale={compact && (w < TALK_ROW ? h < 700 : h < 380) ? GUIDE_FEEL.smallPortraitScale : GUIDE_FEEL.portraitScale} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        <span className="text-2xl leading-none font-bold">{TEACHER.name}</span>
        <div className={`guide-bubble skin-slot-lit relative mt-2 flex-1 leading-snug ${compact ? 'text-base' : 'text-lg'}`}>
          {words.slice(0, letters)}
          {/* The words still to come hold their place, so the dialog never changes size as she speaks. */}
          <span className="invisible">{words.slice(letters)}</span>
        </div>
      </div>
    </div>
  );
}

/** One of the drawn looks: its frames come ready-painted from the atlas. */
function DrawnTeacher({ anim, talking = false, scale, faceOnly = false }: TeacherProps) {
  const { fps, frames } = TEACHER.anims[anim];
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(0);
    const id = setInterval(() => setTick((t) => t + 1), 1000 / fps);
    return () => clearInterval(id);
  }, [anim, fps]);
  const { atlas } = rt();
  // Her mouth opens on every other beat while she speaks.
  const sprite = atlas.get(teacherFrame(anim, tick % frames.length, talking && tick % 2 === 1));
  const box = portraitBox();
  const { portrait } = TEACHER;
  const face = teacherFace();
  // Where the portrait's own top-left corner sits inside the box (its anchor is the middle of its lower edge).
  const originX = box.left - portrait.w / 2;
  const originY = box.up - (portrait.h - 1);
  const view = faceOnly ? { x: originX + face.x, y: originY + face.y, w: face.w, h: face.h } : { x: 0, y: 0, w: box.w, h: box.h };
  return (
    <span className="relative block overflow-hidden" style={{ width: view.w * scale, height: view.h * scale }}>
      <img
        src={atlas.url(sprite.name)}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={{ left: (box.left - sprite.ax - view.x) * scale, top: (box.up - sprite.ay - view.y) * scale, width: sprite.w * scale, height: sprite.h * scale }}
      />
    </span>
  );
}

/* ───────────────────────────── Her card in the corner ───────────────────────────── */

const DOCK_ID = 'guide-card';
/** The lesson card's id on the page, for whoever needs to know where it is. */
export const GUIDE_CARD_ID = DOCK_ID;

/** What the lesson asks the player to buy: its price, how close they are, and (unless `bare`) a way to be shown it. */
function WantChip({ want, bare = false }: { want: GuideWant; bare?: boolean }) {
  const { game } = rt();
  const info = describeWant(game, want);
  const price = info.cost.dew ?? 0;
  const affordable = canAfford(game.s, info.cost);
  return (
    <div className="skin-slot-lit mt-1.5 flex items-center gap-2">
      <Icon name={info.icon} size={32} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex flex-wrap items-center gap-x-2 font-bold">
          {info.name}
          <CostLine cost={info.cost} />
        </div>
        {affordable ? (
          <div className="text-sm text-leaf">You have enough. It is marked in the {info.menu} menu.</div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs">
            <Bar className="flex-1" value={game.s.res.dew / Math.max(1, price)} color="#47c9e3" />
            <span>
              {fmt(game.s.res.dew)} / {fmt(price)}
            </span>
          </div>
        )}
      </div>
      {!bare && (
        <Btn tone="gold" className="text-sm" onClick={() => showWant(info.panel)}>
          Show me
        </Btn>
      )}
    </div>
  );
}

/** The lesson card that lives in the corner of the screen between conversations. */
export function GuideCard() {
  const { game, index, hidden, step, want } = useGuide();
  const talking = useUI((s) => s.guideTalking);
  const replay = useUI((s) => s.replayGuide);
  const layout = useLayout();
  const menuOpen = useUI((s) => s.panelOpen);
  // Re-read when the player switches between mouse and finger: the reminder words follow.
  useUI((s) => s.touch);
  const setHidden = (value: number) => {
    game.s.stats[GUIDE_STAT.hidden] = value;
    useUI.getState().bump();
  };
  if (index >= GUIDE.length) return null;
  if (hidden || !step) {
    return (
      <button type="button" className="skin-plaque pointer-events-auto flex items-center gap-1.5 hover:brightness-110" onClick={() => setHidden(0)}>
        <Teacher anim={TEACHER.resting} scale={1} faceOnly />
        <span className="text-sm font-bold">Show the guide</span>
      </button>
    );
  }
  // On a small screen an open menu leaves little of the world to see. The card makes itself small while
  // that lasts: who she is, what the lesson is, and what it wants bought (which the menu itself marks).
  if (layout.compact && menuOpen) {
    return (
      <div id={DOCK_ID} className={`skin-panel pointer-events-auto max-w-full ${layout.dock === 'bottom' ? 'w-full max-w-[460px]' : 'w-[230px]'} ${talking ? 'invisible' : ''}`}>
        <div className="flex items-center gap-2">
          <button type="button" className="guide-stage skin-slot shrink-0" aria-label="Hear that again" onClick={replay}>
            <Teacher anim={TEACHER.resting} scale={1} faceOnly />
          </button>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">
              Lesson {index + 1} of {GUIDE.length}
            </div>
            <div className="truncate text-base font-bold">{step.title}</div>
          </div>
        </div>
        {want ? <WantChip want={want} bare /> : <div className="mt-1 text-sm leading-snug">{phrase(step.text)}</div>}
      </div>
    );
  }
  const world = rt().world;
  // A desktop has room for a wide card beside the purse. A small screen gets one as wide as the screen, or a narrow one beside the world.
  const width = !layout.compact ? 'w-[320px] xl:w-[460px]' : layout.dock === 'bottom' ? 'w-full max-w-[460px]' : 'w-[300px]';
  return (
    <div id={DOCK_ID} className={`skin-panel pointer-events-auto max-w-full ${width} ${talking ? 'invisible' : ''}`}>
      <div className="flex gap-2">
        <button type="button" className="guide-stage skin-slot shrink-0 self-start" title="Hear that again" onClick={replay}>
          <Teacher anim={TEACHER.resting} scale={GUIDE_FEEL.cardScale} faceOnly />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
            <span>
              Lesson {index + 1} of {GUIDE.length}
            </span>
            <button type="button" className="underline touch:-m-2 touch:p-2" onClick={() => setHidden(1)}>
              hide
            </button>
          </div>
          <div className="text-lg leading-tight font-bold">{step.title}</div>
          <div className="text-sm leading-snug">{phrase(step.text)}</div>
        </div>
      </div>
      {want && <WantChip want={want} />}
      {step.point && world.pointer && (
        <Btn tone="gold" className="mt-1.5 w-full text-sm" onClick={() => world.pointer && world.camera.lookAt(world.pointer[0], world.pointer[1])}>
          Show me where
        </Btn>
      )}
    </div>
  );
}

/* ───────────────────────────── The conversation ───────────────────────────── */

interface Beat {
  anim: TeacherAnimName;
  words: string;
}

interface Script {
  beats: Beat[];
  /** Afterwards the card settles into its corner (false for her farewell, when there is no card left). */
  docks: boolean;
}

/** Where the conversation is in its journey: finding its place, starting from the corner, in the middle, or leaving. */
type Phase = 'measure' | 'from' | 'here' | 'to';

const toBeat = ([anim, words]: GuideLine): Beat => ({ anim, words: phrase(words) });
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Runs the conversations: decides when Claudia speaks, types out her lines and flies the card to and from its corner. */
export function GuideLayer() {
  const { game, index, hidden, want } = useGuide();
  const modal = useUI((s) => s.modal);
  const panelOpen = useUI((s) => s.panelOpen);
  const layout = useLayout();
  const hudRow = useUI((s) => s.hudRow);
  const replay = useUI((s) => s.guideReplay);
  const setTalking = useUI((s) => s.setGuideTalking);
  const [script, setScript] = useState<Script | null>(null);
  const [beat, setBeat] = useState(0);
  const [letters, setLetters] = useState(0);
  const [phase, setPhase] = useState<Phase>('measure');
  const [away, setAway] = useState('');
  const known = useRef<number | null>(null);
  const heard = useRef(replay);
  const box = useRef<HTMLDivElement>(null);

  const begin = (beats: Beat[], docks: boolean) => {
    setScript({ beats, docks });
    setBeat(0);
    setLetters(0);
    setPhase('measure');
  };

  // A new lesson (or the end of the last one) starts a conversation.
  useEffect(() => {
    const previous = known.current;
    known.current = index;
    if (hidden) return setScript(null);
    if (previous === index || (game.s.stats[GUIDE_STAT.seen] ?? 0) > index) return;
    const beats: Beat[] = [];
    // If a lesson was just finished, she says well done first.
    if (previous !== null && index > previous && GUIDE[index - 1]) beats.push(toBeat(GUIDE[index - 1].done));
    for (const line of GUIDE[index]?.say ?? GUIDE_FAREWELL) beats.push(toBeat(line));
    begin(beats, index < GUIDE.length);
  }, [index, hidden]);

  // The player asked to hear the lesson again.
  useEffect(() => {
    if (replay === heard.current) return;
    heard.current = replay;
    const step = GUIDE[index];
    if (step && !hidden) begin(step.say.map(toBeat), true);
  }, [replay]);

  useEffect(() => {
    setTalking(!!script);
    return () => setTalking(false);
  }, [script, setTalking]);

  /** The move that carries the conversation onto the corner card (or just away, when there is none). */
  const flight = (docks: boolean): string => {
    const here = box.current?.getBoundingClientRect();
    const there = docks ? document.getElementById(DOCK_ID)?.getBoundingClientRect() : null;
    if (!here || !there?.width) return 'translateY(30px) scale(0.6)';
    const size = Math.max(0.25, Math.min(1, there.width / here.width));
    // Measured on the screen, but moved inside the interface, which may be drawn smaller than life.
    const { scale } = useUI.getState().layout;
    return `translate(${Math.round((there.left + there.width / 2 - here.left - here.width / 2) / scale)}px, ${Math.round((there.top + there.height / 2 - here.top - here.height / 2) / scale)}px) scale(${size.toFixed(3)})`;
  };

  // Arriving: find where the corner card is, start from there, then glide to the middle.
  useLayoutEffect(() => {
    if (!script || phase !== 'measure' || modal) return;
    setAway(flight(script.docks));
    setPhase(reducedMotion() ? 'here' : 'from');
  }, [script, phase, modal]);
  useEffect(() => {
    if (phase !== 'from') return;
    const id = setTimeout(() => setPhase('here'), 40);
    return () => clearTimeout(id);
  }, [phase]);

  const current = script?.beats[beat];
  const spoken = !!current && letters >= current.words.length;
  const last = !!script && beat >= script.beats.length - 1;

  const leave = (shown: boolean) => {
    if (!script || phase === 'to') return;
    game.s.stats[GUIDE_STAT.seen] = index + 1;
    setAway(flight(script.docks));
    setPhase('to');
    setTimeout(
      () => {
        setScript(null);
        // Having said "got it", the player is taken straight to the thing to buy. Where the lesson is out in
        // the world instead, a small screen puts its menu away, so that there is a world to do it in.
        if (shown && want) showWant(describeWant(game, want).panel);
        else if (shown && GUIDE[index]?.point && useUI.getState().layout.compact && useUI.getState().panelOpen) useUI.getState().togglePanel();
      },
      reducedMotion() ? 0 : GUIDE_FEEL.flyMs,
    );
  };

  const next = () => {
    if (!script || !current || phase !== 'here') return;
    if (!spoken) setLetters(current.words.length);
    else if (!last) {
      setBeat(beat + 1);
      setLetters(0);
    } else leave(true);
  };

  // Her words appear a letter at a time; a finished line waits a while, then she carries on by herself.
  useEffect(() => {
    if (!script || !current || phase !== 'here' || modal) return;
    if (spoken) {
      const id = setTimeout(() => (last ? leave(false) : next()), (GUIDE_FEEL.lingerSeconds + current.words.length * GUIDE_FEEL.lingerPerLetter) * 1000);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      if (GUIDE_FEEL.blipEvery && letters % GUIDE_FEEL.blipEvery === 0 && current.words[letters] !== ' ') rt().sound.play('speak', 0.92 + Math.random() * 0.2, 0.6);
      setLetters(letters + 1);
    }, 1000 / GUIDE_FEEL.lettersPerSecond);
    return () => clearTimeout(id);
  }, [script, current, letters, phase, modal]);

  if (!script || !current || modal) return null;

  const glide = `transform ${GUIDE_FEEL.flyMs}ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity ${Math.round(GUIDE_FEEL.flyMs * 0.7)}ms ease`;
  const style: CSSProperties =
    phase === 'measure' ? { opacity: 0 } : phase === 'from' ? { transform: away, opacity: 0.2 } : phase === 'here' ? { transform: 'none', opacity: 1, transition: glide } : { transform: away, opacity: 0, transition: glide };
  const { compact, safe } = layout;
  // A desktop keeps her clear of the menu. A small screen has no room for that: she speaks over the menu, clear only of its tabs and of the purse.
  const room = compact
    ? { left: safe.left + 8, top: hudRow + 6, right: (layout.dock === 'side' ? layout.tabs : safe.right) + 8, bottom: (layout.dock === 'bottom' ? layout.tabs + TALK_LIFT : safe.bottom) + 8 }
    : { left: 12, top: 12, right: freeArea(layout, panelOpen).right + 12, bottom: 12 };
  const wide = layout.w - room.left - room.right;
  const high = layout.h - room.top - room.bottom;
  // Side by side where there is room for it; stacked on a narrow screen, with a smaller portrait on a short one.
  const row = !compact || wide >= TALK_ROW;
  const portrait = compact && (row ? high < 300 : high < 600) ? GUIDE_FEEL.smallPortraitScale : GUIDE_FEEL.portraitScale;
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 transition-[padding] duration-[220ms] ease-out motion-reduce:transition-none ${!compact ? 'grid grid-cols-[minmax(0,1fr)] place-items-center' : layout.dock === 'bottom' ? 'flex items-end justify-center' : 'flex items-center justify-center'}`}
      style={{ paddingLeft: room.left, paddingTop: room.top, paddingRight: room.right, paddingBottom: room.bottom }}
    >
      <div ref={box} className={`guide-talk skin-panel cursor-pointer pointer-events-auto ${compact ? 'w-full max-w-[640px]' : 'w-[640px] max-w-full'}`} style={style} onClick={next}>
        <div className={`flex gap-3 ${row ? 'flex-row items-stretch' : 'flex-col items-center'}`}>
          <div className="guide-stage skin-slot shrink-0 self-center">
            <Teacher anim={current.anim} talking={phase === 'here' && !spoken} scale={portrait} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col self-stretch">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl leading-none font-bold">{TEACHER.name}</span>
              <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">{script.docks ? `Lesson ${index + 1} of ${GUIDE.length}` : 'Goodbye'}</span>
            </div>
            <div className={`guide-bubble skin-slot-lit relative mt-2 flex-1 leading-snug ${compact ? 'text-base' : 'text-lg'}`}>
              {current.words.slice(0, letters)}
              {/* The words still to come hold their place, so the card never changes size as she speaks. */}
              <span className="invisible">{current.words.slice(letters)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-ink-soft">{script.beats.map((_, i) => (i === beat ? '●' : '○')).join(' ')}</span>
              <Btn tone="green" className="min-w-24">
                {!spoken || !last ? 'Next' : script.docks ? 'Got it!' : 'Goodbye!'}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
