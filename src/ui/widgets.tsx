import { useEffect, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { rt } from '@/app/runtime';
import { RESOURCES } from '@/config/resources';
import { refresh } from '@/game/economy';
import { fmt } from '@/game/format';
import { RES, type Cost } from '@/game/types';
import { useUI, type Tip } from '@/store/ui';

/** Re-render with the live game a few times a second. */
export const useTick = () => useUI((s) => s.tick);

/** How the interface is arranged on this screen. */
export const useLayout = () => useUI((s) => s.layout);

/** A point on the screen (CSS pixels, as events give it) in the interface's own pixels. */
export function toUi(clientX: number, clientY: number): [number, number] {
  const { scale, compact, safe } = useUI.getState().layout;
  // The roomy interface starts inside the screen's safe edges; the compact one reaches the edges and is scaled.
  return compact ? [clientX / scale, clientY / scale] : [clientX - safe.left, clientY - safe.top];
}

/** How long the menus take to slide in or out, in milliseconds (the `.slide` and drawer transitions in index.css match it). */
export const SLIDE_MS = 220;

/**
 * For something that slides in and out instead of popping: it stays `mounted` while it leaves,
 * and starts out `away` for an instant when it arrives, so that both ways there is a moment to animate.
 */
export function usePresence(show: boolean): { mounted: boolean; away: boolean } {
  const [mounted, setMounted] = useState(show);
  const [away, setAway] = useState(!show);
  useEffect(() => {
    if (show) {
      setMounted(true);
      // Let it be drawn once in its "away" place before it is sent to its real one.
      const id = setTimeout(() => setAway(false), 20);
      return () => clearTimeout(id);
    }
    setAway(true);
    const id = setTimeout(() => setMounted(false), SLIDE_MS);
    return () => clearTimeout(id);
  }, [show]);
  return { mounted, away };
}

/** A sprite from the atlas, scaled by whole numbers whenever it fits so the pixels stay square. */
export function Icon({ name, size = 24, className = '' }: { name: string; size?: number; className?: string }) {
  const atlas = rt().atlas;
  const sprite = atlas.has(name) ? atlas.get(name) : atlas.get('ic_star');
  const longest = Math.max(sprite.w, sprite.h);
  // Whole or half steps keep pixels close to square while still filling the box.
  const scale = longest <= size ? Math.max(1, Math.floor((size / longest) * 2) / 2) : size / longest;
  return (
    <span className={`inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      <img src={atlas.url(sprite.name)} alt="" draggable={false} style={{ width: sprite.w * scale, height: sprite.h * scale }} />
    </span>
  );
}

/** A price or reward: icon + amount for each resource, red where the player cannot afford it. */
export function CostLine({ cost, check = true, className = '' }: { cost: Cost; check?: boolean; className?: string }) {
  const bank = rt().game.s.res;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {RES.filter((r) => cost[r] !== undefined).map((r) => (
        <span key={r} className={`inline-flex items-center gap-0.5 ${check && bank[r] < cost[r]! ? 'text-rose' : ''}`}>
          <Icon name={RESOURCES[r].icon} size={16} />
          {fmt(cost[r]!)}
        </span>
      ))}
    </span>
  );
}

/* ───────────────────────────── Tooltips ───────────────────────────── */

type TipWords = () => Omit<Tip, 'x' | 'y' | 'anchor'>;

/** How long a finger rests on something before its tooltip appears, and how far it may wander meanwhile. */
const HOLD_MS = 420;
const HOLD_SLACK = 10;
/** After a tooltip was held open, the click that follows letting go is not meant as a press. */
const SWALLOW_MS = 700;

/** What a finger pinned a tooltip to, and the hold that is waiting to do so. */
let pinnedTo: Element | null = null;
let hold: { timer: number; x: number; y: number } | null = null;
let swallowUntil = 0;

const byMouse = (e: PointerEvent) => e.pointerType !== 'touch';

function cancelHold(): void {
  if (hold) clearTimeout(hold.timer);
  hold = null;
}

/** Pin a tooltip beside an element, for a finger: it stays until something else is touched. */
function pin(el: Element, words: TipWords): void {
  const r = el.getBoundingClientRect();
  const [left, top] = toUi(r.left, r.top);
  const [right, bottom] = toUi(r.right, r.bottom);
  pinnedTo = el;
  useUI.getState().setTip({ ...words(), x: (left + right) / 2, y: top, anchor: { left, top, right, bottom } });
}

/** Take down a tooltip a finger pinned. */
function unpin(): void {
  pinnedTo = null;
  if (useUI.getState().tip?.anchor) useUI.getState().setTip(null);
}

/** Take down whatever tooltip is showing. */
export function clearTip(): void {
  pinnedTo = null;
  if (useUI.getState().tip) useUI.getState().setTip(null);
}

/**
 * Handlers that show a tooltip for an element. A mouse sees it while hovering. A finger cannot
 * hover: a tap on something that does nothing else shows it, and so does resting the finger on
 * anything, buttons included, for a moment.
 */
export function tip(words: TipWords) {
  const show = (e: PointerEvent) => {
    if (!byMouse(e)) return;
    const [x, y] = toUi(e.clientX, e.clientY);
    useUI.getState().setTip({ ...words(), x, y });
  };
  return {
    onPointerEnter: show,
    onPointerMove: (e: PointerEvent) => {
      if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLACK) cancelHold();
      show(e);
    },
    onPointerLeave: (e: PointerEvent) => {
      cancelHold();
      if (byMouse(e)) useUI.getState().setTip(null);
    },
    onPointerDown: (e: PointerEvent) => {
      if (byMouse(e)) return;
      const el = e.currentTarget;
      cancelHold();
      hold = {
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          hold = null;
          swallowUntil = Infinity;
          pin(el, words);
        }, HOLD_MS),
      };
    },
    onClick: (e: MouseEvent) => {
      if (!useUI.getState().touch) return;
      // A press on a button inside (Buy, say) is for the button, not a question about the row.
      const inner = (e.target as Element).closest('button, a, input, select, textarea, label');
      if (inner && inner !== e.currentTarget && e.currentTarget.contains(inner)) return;
      if (pinnedTo === e.currentTarget) unpin();
      else pin(e.currentTarget, words);
    },
  };
}

/**
 * Listen, once, for what tooltips need to know about the whole page: touching anything else
 * takes a pinned one down, and so does scrolling. Returns how to stop listening.
 */
export function watchTips(): () => void {
  const down = (e: globalThis.PointerEvent) => {
    if (useUI.getState().tip?.anchor && !(pinnedTo && e.target instanceof Node && pinnedTo.contains(e.target))) unpin();
  };
  const click = (e: globalThis.MouseEvent) => {
    if (performance.now() > swallowUntil) return;
    swallowUntil = 0;
    e.stopPropagation();
    e.preventDefault();
  };
  // The finger lifts: a hold that never got that far is off, and one that did has a click coming that means nothing.
  const up = () => {
    cancelHold();
    if (swallowUntil === Infinity) swallowUntil = performance.now() + SWALLOW_MS;
  };
  const scroll = () => useUI.getState().tip?.anchor && unpin();
  window.addEventListener('pointerdown', down, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
  window.addEventListener('click', click, true);
  window.addEventListener('scroll', scroll, true);
  return () => {
    window.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', up, true);
    window.removeEventListener('click', click, true);
    window.removeEventListener('scroll', scroll, true);
  };
}

/** A chunky pixel button. Plays a click, or a dull thud when it cannot be pressed. */
export function Btn({
  children,
  onClick,
  disabled,
  tone = 'tan',
  className = '',
  style,
  title,
  sound = 'click',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'tan' | 'green' | 'gold' | 'red' | 'blue';
  className?: string;
  style?: CSSProperties;
  title?: string;
  sound?: string | null;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      style={style}
      className={`btn btn-${tone} ${className}`}
      onClick={() => {
        rt().sound.unlock();
        if (sound) rt().sound.play(sound);
        onClick?.();
        // What was just bought counts at once: without this the menu would show, until the next tick, the old income shared out among one more.
        const { game } = rt();
        if (game.dirty) refresh(game);
        useUI.getState().bump();
      }}
    >
      {children}
    </button>
  );
}

/** A segmented pixel progress bar, 0..1. */
export function Bar({ value, color = '#52ae35', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-2 border-2 border-[#4e2c20] bg-[#d0b481] ${className}`}>
      <div className="h-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-2 mb-1 flex items-center justify-between border-b-2 border-parchment-deep pb-0.5 text-sm font-bold tracking-wide text-ink-soft uppercase first:mt-0">
      <span>{children}</span>
      {right}
    </div>
  );
}
