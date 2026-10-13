import { useCallback, useEffect, useState, type CSSProperties } from 'react';
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
import { freeArea, measureLayout, readSafeArea, sameLayout, type FreeArea } from './layout';
import { Modals } from './Modals';
import { Tooltip, Toasts } from './Overlays';
import { SidePanel } from './SidePanel';
import { Btn, clearTip, Icon, toUi, useLayout, usePresence, watchTips } from './widgets';

/** Half the size of the box a finger's tap is taken to cover, when a tooltip is pinned to a spot in the world. */
const FINGERTIP = 16;

/**
 * Keep the interface's idea of the screen up to date: its size and safe edges (which choose the
 * layout), and whether the player is using a finger or a mouse.
 */
function useScreen() {
  useEffect(() => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    const measure = () => {
      const ui = useUI.getState();
      const field = document.activeElement;
      const typing = field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && field.type !== 'range');
      // A keyboard sliding up makes some browsers' windows shorter. That is not a new screen, and must not rearrange the menu being typed in.
      if (typing && window.innerWidth === width && window.innerHeight < height) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const next = measureLayout(width, height, readSafeArea());
      if (!sameLayout(ui.layout, next)) ui.setLayout(next);
    };
    const pointed = (e: PointerEvent) => {
      const ui = useUI.getState();
      const touch = e.pointerType === 'touch';
      if ((touch || e.pointerType === 'mouse') && touch !== ui.touch) ui.setTouch(touch);
    };
    // A long press on a picture would otherwise open the browser's own menu for it.
    const menu = (e: Event) => {
      if (!(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) e.preventDefault();
    };
    // Some phones only show a button as pressed if the page listens for touches at all.
    const touched = () => {};
    measure();
    const stopTips = watchTips();
    document.addEventListener('touchstart', touched, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.addEventListener('focusout', measure);
    window.addEventListener('pointerdown', pointed, true);
    window.addEventListener('contextmenu', menu);
    return () => {
      stopTips();
      document.removeEventListener('touchstart', touched);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('focusout', measure);
      window.removeEventListener('pointerdown', pointed, true);
      window.removeEventListener('contextmenu', menu);
    };
  }, []);
}

/** Keep the camera's idea of the free screen area in step with the menus. */
function useCameraInsets(ready: boolean) {
  const open = useUI((s) => s.panelOpen);
  const zen = useUI((s) => s.zen);
  const layout = useLayout();
  const sheet = useUI((s) => s.sheet);
  const hudTop = useUI((s) => s.hudTop);
  const hudLeft = useUI((s) => s.hudLeft);
  const coarse = useUI((s) => s.coarse);
  useEffect(() => {
    if (!ready) return;
    // From interface pixels to the screen's own: the compact interface may be scaled, the roomy one starts inside the safe edges.
    const onScreen = (area: FreeArea): FreeArea =>
      layout.compact
        ? { left: area.left * layout.scale, right: area.right * layout.scale, top: area.top * layout.scale, bottom: area.bottom * layout.scale }
        : { left: area.left + layout.safe.left, right: area.right + layout.safe.right, top: area.top + layout.safe.top, bottom: area.bottom + layout.safe.bottom };
    const none = { left: 0, right: 0, top: 0, bottom: 0 };
    const covered = zen ? none : onScreen(freeArea(layout, open, sheet, hudTop, hudLeft));
    // On a small screen the world is framed for the menu shut: opening it slides the view aside without shrinking it.
    const framed = zen ? none : layout.compact ? onScreen(freeArea(layout, false, sheet, hudTop, hudLeft)) : covered;
    rt().setView(covered, framed, layout.compact || coarse);
  }, [ready, open, zen, layout, sheet, hudTop, hudLeft, coarse]);
}

/** Tooltips for things in the world itself. */
function useWorldTooltips(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const runtime = rt();
    runtime.onHover = (hover, clientX, clientY, pinned = false) => {
      const ui = useUI.getState();
      if (!hover || ui.zen || ui.modal) return clearTip();
      const { game } = runtime;
      const [x, y] = toUi(clientX, clientY);
      // A finger's tap pins the tooltip to the spot; a mouse carries it along.
      const at = pinned ? { x, y, anchor: { left: x - FINGERTIP, right: x + FINGERTIP, top: y - FINGERTIP, bottom: y + FINGERTIP } } : { x, y };
      if (hover.kind === 'spring') ui.setTip({ title: 'The Spring', lines: describeSpring(game), ...at });
      else if (hover.kind === 'building') {
        const def = BUILDING_BY_ID[hover.id];
        ui.setTip({ title: `${def.name} ×${game.s.b[def.id] ?? 0}`, lines: describeBuilding(game, def), ...at });
      } else {
        const entry = JOURNAL_BY_ID[hover.id];
        const known = entry && game.s.journal[entry.id];
        ui.setTip({ title: known ? entry.name : '?', lines: [known ? entry.text : 'Something about this seems worth a closer look…'], ...at });
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

/**
 * Small round controls that are always within reach: at the top, beside the menu, where the menu
 * is at the side; and down by the thumb, just above the menu, where it runs along the bottom.
 */
function Corner() {
  const zen = useUI((s) => s.zen);
  const setZen = useUI((s) => s.setZen);
  const layout = useLayout();
  const open = useUI((s) => s.panelOpen);
  const sheet = useUI((s) => s.sheet);
  const touch = useUI((s) => s.touch);
  const { compact, safe } = layout;
  const size = compact ? 'h-10 w-10' : 'h-11 w-11';
  const free = freeArea(layout, open, sheet);
  // A sheet pulled all the way up has the screen to itself: the buttons wait until it comes down again.
  const covered = compact && layout.dock === 'bottom' && open && sheet === 'full' && !zen;
  const place: CSSProperties | undefined = !compact
    ? undefined
    : layout.dock === 'bottom'
      ? { right: safe.right + 6, bottom: (zen ? safe.bottom : free.bottom) + 6 }
      : { right: (zen ? safe.right : free.right) + 6, top: safe.top + 6 };
  return (
    <div
      className={`absolute z-10 flex gap-1 transition-[right,bottom,opacity] duration-[220ms] ease-out motion-reduce:transition-none ${covered ? 'pointer-events-none opacity-0' : 'pointer-events-auto'} ${compact ? '' : `top-2 ${zen ? 'right-2' : 'right-[456px]'}`}`}
      style={place}
      inert={covered}
    >
      <button
        type="button"
        className={`skin-plaque grid ${size} cursor-pointer place-items-center transition-opacity duration-[220ms] hover:brightness-110 motion-reduce:transition-none ${zen ? 'pointer-events-none opacity-0' : ''}`}
        title={touch ? undefined : 'Show the whole world'}
        aria-label="Show the whole world"
        tabIndex={zen ? -1 : undefined}
        onClick={() => rt().world.home()}
      >
        <Icon name="ic_home" size={22} />
      </button>
      <button
        type="button"
        className={`skin-plaque grid ${size} cursor-pointer place-items-center transition-opacity duration-[220ms] hover:brightness-110 motion-reduce:transition-none ${zen ? 'opacity-60' : ''}`}
        title={touch ? undefined : zen ? 'Show menus (H)' : 'Just watch (H)'}
        aria-label={zen ? 'Show menus' : 'Just watch'}
        onClick={() => setZen(!zen)}
      >
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
  const layout = useLayout();
  const touch = useUI((s) => s.touch);
  const coarse = useUI((s) => s.coarse);
  // The menus slide out for "Just watch" and back in afterwards, rather than vanishing.
  const menus = usePresence(!zen);
  useScreen();
  useCameraInsets(ready);
  useWorldTooltips(ready);
  useHotkeys(ready);

  const { compact, scale, safe } = layout;
  // The interface lives in its own box over the world: scaled as a whole where the screen is too small for it.
  const box: CSSProperties = !compact
    ? { left: safe.left, top: safe.top, right: safe.right, bottom: safe.bottom }
    : scale === 1
      ? { inset: 0 }
      : { left: 0, top: 0, width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: '0 0' };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameCanvas onReady={onReady} />
      <div className="pointer-events-none absolute overflow-hidden" style={box} data-dock={layout.dock} data-compact={compact ? '' : undefined} data-touch={touch ? '' : undefined} data-coarse={coarse ? '' : undefined}>
        {!ready && <div className="absolute inset-0 grid place-items-center px-4 text-center text-2xl text-cream">Little Elsewhere is waking up…</div>}
        {ready && !cutscene && (
          <>
            {menus.mounted && <Hud away={menus.away} />}
            {menus.mounted && <SidePanel away={menus.away} />}
            {!zen && <GuideLayer />}
            <Corner />
            <Toasts />
            <Modals />
            <Tooltip />
          </>
        )}
        {ready && cutscene && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-6" style={compact ? { paddingTop: safe.top + 24, paddingBottom: safe.bottom + 24 } : undefined}>
            <div className="text-shadow text-center text-3xl font-bold text-cream">The season turns…</div>
            <Btn className="pointer-events-auto" onClick={() => rt().skipCutscene()}>
              Skip
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
