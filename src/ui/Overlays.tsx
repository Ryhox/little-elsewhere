import { useEffect, type CSSProperties } from 'react';
import { useUI, type Toast } from '@/store/ui';
import { freeArea } from './layout';
import { CostLine, Icon, useLayout } from './widgets';

const TOAST_SECONDS = 4.5;
const TIP_WIDTH = 270;
/** A small screen shows fewer messages at once. */
const COMPACT_TOASTS = 3;

/**
 * The tooltip. With a mouse it follows the pointer and flips sides so it never leaves the screen.
 * Asked for by a finger, it sits right above or below the thing it describes, whichever has more room.
 */
export function Tooltip() {
  const tipState = useUI((s) => s.tip);
  const { w, h } = useLayout();
  if (!tipState) return null;
  const width = Math.min(TIP_WIDTH, w - 12);
  let place: CSSProperties;
  if (tipState.anchor) {
    const { left, right, top, bottom } = tipState.anchor;
    const x = Math.max(6, Math.min(w - width - 6, (left + right) / 2 - width / 2));
    place = top > h - bottom ? { left: x, bottom: h - top + 6 } : { left: x, top: bottom + 6 };
  } else {
    const left = tipState.x + 18 + width > w ? tipState.x - width - 14 : tipState.x + 18;
    const below = tipState.y < h * 0.6;
    place = { left: Math.max(4, left), ...(below ? { top: tipState.y + 14 } : { bottom: h - tipState.y + 10 }) };
  }
  return (
    <div className={`skin-plaque pointer-events-none absolute z-40 text-sm leading-snug ${tipState.anchor ? 'anim-pop' : ''}`} style={{ width, ...place }}>
      <div className="text-base font-bold text-[#fbd45a]">{tipState.title}</div>
      {tipState.lines.filter(Boolean).map((line, i) => (
        <div key={i} className={i === 0 ? '' : 'opacity-80'}>
          {line}
        </div>
      ))}
      {tipState.cost && <CostLine cost={tipState.cost} className="mt-0.5" />}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUI((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);
  return (
    <div className={`anim-toast pointer-events-auto flex max-w-[420px] cursor-pointer items-center gap-2 text-sm leading-snug ${toast.gold ? 'skin-slot-lit' : 'skin-plaque'}`} onClick={() => dismiss(toast.id)}>
      {toast.icon && <Icon name={toast.icon} size={24} />}
      <span>{toast.text}</span>
    </div>
  );
}

/**
 * Short messages that fade on their own. They rise from the bottom of the screen, except where
 * the menu lives there (a phone held upright): then they hang under the purse instead, clear of it.
 */
export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const layout = useLayout();
  const open = useUI((s) => s.panelOpen);
  const sheet = useUI((s) => s.sheet);
  const hudTop = useUI((s) => s.hudTop);
  const hudRow = useUI((s) => s.hudRow);
  const talking = useUI((s) => s.guideTalking);
  if (!layout.compact) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-1 px-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    );
  }
  const free = freeArea(layout, open, sheet, hudTop);
  // While Claudia is speaking her lesson card is away, and she stands where it would hang a message over her: keep to the purse.
  const place: CSSProperties = layout.dock === 'bottom' ? { left: 0, right: 0, top: (talking ? hudRow : free.top) + 4 } : { left: free.left, right: free.right, bottom: free.bottom + 6 };
  return (
    <div className="pointer-events-none absolute z-20 flex flex-col items-center gap-1 px-2 transition-[right] duration-[220ms] ease-out motion-reduce:transition-none" style={place}>
      {toasts.slice(-COMPACT_TOASTS).map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
