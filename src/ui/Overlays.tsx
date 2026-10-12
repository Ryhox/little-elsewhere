import { useEffect } from 'react';
import { useUI, type Toast } from '@/store/ui';
import { CostLine, Icon } from './widgets';

const TOAST_SECONDS = 4.5;
const TIP_WIDTH = 270;

/** The tooltip that follows the pointer. Flips sides so it never leaves the screen. */
export function Tooltip() {
  const tipState = useUI((s) => s.tip);
  if (!tipState) return null;
  const left = tipState.x + 18 + TIP_WIDTH > window.innerWidth ? tipState.x - TIP_WIDTH - 14 : tipState.x + 18;
  const below = tipState.y < window.innerHeight * 0.6;
  return (
    <div className="skin-plaque pointer-events-none absolute z-40 text-sm leading-snug" style={{ left: Math.max(4, left), width: TIP_WIDTH, ...(below ? { top: tipState.y + 14 } : { bottom: window.innerHeight - tipState.y + 10 }) }}>
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

/** Short messages that rise from the bottom of the screen and fade on their own. */
export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex flex-col items-center gap-1 px-2 md:bottom-3">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
