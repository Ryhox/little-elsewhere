import { useCallback, useEffect, useState } from 'react';
import { rt } from '@/app/runtime';
import { ABILITIES } from '@/config/abilities';
import { BUILDING_BY_ID } from '@/config/buildings';
import { JOURNAL_BY_ID } from '@/config/journal';
import { castAbility } from '@/game/actions';
import { useUI } from '@/store/ui';
import { describeBuilding, describeSpring } from './describe';
import { GameCanvas } from './GameCanvas';
import { GuideLayer } from './Guide';
import { Hud } from './Hud';
import { freeArea } from './layout';
import { Modals } from './Modals';
import { Tooltip, Toasts } from './Overlays';
import { SidePanel } from './SidePanel';
import { Btn, Icon } from './widgets';

/** Keep the camera's idea of the free screen area in step with the menus. */
function useCameraInsets(ready: boolean) {
  const open = useUI((s) => s.panelOpen);
  const zen = useUI((s) => s.zen);
  useEffect(() => {
    if (!ready) return;
    const apply = () => rt().setInsets(zen ? { left: 0, right: 0, top: 0, bottom: 0 } : freeArea(open));
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [ready, open, zen]);
}

/** Tooltips for things in the world itself. */
function useWorldTooltips(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const runtime = rt();
    runtime.onHover = (hover, x, y) => {
      const ui = useUI.getState();
      if (!hover || ui.zen || ui.modal) return ui.tip && ui.setTip(null);
      const { game } = runtime;
      if (hover.kind === 'spring') ui.setTip({ title: 'The Spring', lines: describeSpring(game), x, y });
      else if (hover.kind === 'building') {
        const def = BUILDING_BY_ID[hover.id];
        ui.setTip({ title: `${def.name} ×${game.s.b[def.id] ?? 0}`, lines: describeBuilding(game, def), x, y });
      } else {
        const entry = JOURNAL_BY_ID[hover.id];
        const known = entry && game.s.journal[entry.id];
        ui.setTip({ title: known ? entry.name : '?', lines: [known ? entry.text : 'Something about this seems worth a closer look…'], x, y });
      }
    };
    return () => {
      runtime.onHover = () => {};
    };
  }, [ready]);
}

function useHotkeys(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const ui = useUI.getState();
      const runtime = rt();
      runtime.sound.unlock();
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) runtime.world.tapAt(runtime.world.spring[0], runtime.world.spring[1]);
      } else if (e.key === 'h' || e.key === 'H') ui.setZen(!ui.zen);
      else if (e.key === 'Escape') {
        if (ui.cutscene) runtime.skipCutscene();
        else if (ui.modal && ui.modal.kind !== 'blessing') ui.setModal(null);
        else if (ui.zen) ui.setZen(false);
      } else if (/^[1-9]$/.test(e.key)) {
        const ability = ABILITIES.filter((a) => runtime.game.mods.flags[`ability_${a.id}`])[Number(e.key) - 1];
        if (ability) castAbility(runtime.game, ability.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready]);
}

/** Small round controls that are always within reach. */
function Corner() {
  const zen = useUI((s) => s.zen);
  const setZen = useUI((s) => s.setZen);
  return (
    <div className={`pointer-events-auto absolute top-2 right-2 z-10 flex gap-1 ${zen ? '' : 'md:right-[456px]'}`}>
      {!zen && (
        <button type="button" className="skin-plaque grid h-11 w-11 cursor-pointer place-items-center hover:brightness-110" title="Show the whole world" onClick={() => rt().world.frameAll()}>
          <Icon name="ic_home" size={22} />
        </button>
      )}
      <button type="button" className={`skin-plaque grid h-11 w-11 cursor-pointer place-items-center hover:brightness-110 ${zen ? 'opacity-60' : ''}`} title={zen ? 'Show menus (H)' : 'Just watch (H)'} onClick={() => setZen(!zen)}>
        <Icon name="ic_eye" size={22} />
      </button>
    </div>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const zen = useUI((s) => s.zen);
  const cutscene = useUI((s) => s.cutscene);
  useCameraInsets(ready);
  useWorldTooltips(ready);
  useHotkeys(ready);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameCanvas onReady={onReady} />
      {!ready && <div className="absolute inset-0 grid place-items-center text-2xl text-cream">Little Elsewhere is waking up…</div>}
      {ready && !cutscene && (
        <>
          {!zen && <Hud />}
          {!zen && <SidePanel />}
          {!zen && <GuideLayer />}
          <Corner />
          <Toasts />
          <Modals />
          <Tooltip />
        </>
      )}
      {ready && cutscene && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-6">
          <div className="text-shadow text-3xl font-bold text-cream">The season turns…</div>
          <Btn className="pointer-events-auto" onClick={() => rt().skipCutscene()}>
            Skip
          </Btn>
        </div>
      )}
    </div>
  );
}
