import { useEffect, useRef } from 'react';
import { startRuntime } from '@/app/runtime';

/** The world itself. Mounting this starts the game; unmounting stops and saves it. */
export function GameCanvas({ onReady }: { onReady(): void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const runtime = startRuntime(ref.current);
    onReady();
    return () => runtime.dispose();
  }, [onReady]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full cursor-grab" />;
}
