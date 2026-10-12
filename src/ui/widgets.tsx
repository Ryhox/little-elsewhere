import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { rt } from '@/app/runtime';
import { RESOURCES } from '@/config/resources';
import { fmt } from '@/game/format';
import { RES, type Cost } from '@/game/types';
import { useUI, type Tip } from '@/store/ui';

/** Re-render with the live game a few times a second. */
export const useTick = () => useUI((s) => s.tick);

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

/** Handlers that show a tooltip while the pointer is over an element. */
export function tip(build: () => Omit<Tip, 'x' | 'y'>) {
  const show = (e: MouseEvent) => useUI.getState().setTip({ ...build(), x: e.clientX, y: e.clientY });
  return { onMouseEnter: show, onMouseMove: show, onMouseLeave: () => useUI.getState().setTip(null) };
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
