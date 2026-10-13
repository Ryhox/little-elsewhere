import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { rt } from '@/app/runtime';
import { PERMS } from '@/config/evergreen';
import { availableUpgrades, discoverableRegions, permAvailable, permCost, regionCost, upgradeCost } from '@/game/actions';
import { canAfford } from '@/game/economy';
import { canTurnSeason } from '@/game/prestige';
import { useUI, type PanelId } from '@/store/ui';
import { describeWant, GuideArrow, useGuide } from './Guide';
import { panelSize } from './layout';
import { JournalTab, TrophiesTab } from './tabs/Collections';
import { SeasonTab } from './tabs/Season';
import { BuildTab, UpgradesTab } from './tabs/Shop';
import { HelpersTab, SettingsTab } from './tabs/System';
import { Icon, tip, useLayout, usePresence } from './widgets';

interface TabDef {
  id: PanelId;
  label: string;
  /** One line saying what this screen is for. */
  about: string;
  icon: string;
  view: () => ReactNode;
  /** Hidden until this returns true. */
  when?: () => boolean;
  /** Shows a dot when there is something to do here. */
  nudge?: () => boolean;
}

/** The menu tabs, in order. Add an entry here to add a screen. */
const TABS: TabDef[] = [
  {
    id: 'build',
    label: 'Build',
    about: 'Plants, creature homes and buildings that gather dew for you.',
    icon: 'ic_build',
    view: () => <BuildTab />,
    nudge: () => discoverableRegions(rt().game).some((r) => canAfford(rt().game.s, regionCost(rt().game, r))),
  },
  {
    id: 'upgrades',
    label: 'Upgrades',
    about: 'One-off improvements for this season.',
    icon: 'ic_upgrades',
    view: () => <UpgradesTab />,
    nudge: () => availableUpgrades(rt().game).some((u) => canAfford(rt().game.s, upgradeCost(rt().game, u))),
  },
  {
    id: 'season',
    label: 'Season',
    about: 'Rebirth, Evergreen Tokens and how this season is going.',
    icon: 'ic_season',
    view: () => <SeasonTab />,
    nudge: () => canTurnSeason(rt().game) || PERMS.some((p) => permAvailable(rt().game, p.id) && permCost(rt().game, p.id) <= rt().game.s.tokens),
  },
  { id: 'journal', label: 'Journal', about: 'Creatures, secrets and wonders you have discovered.', icon: 'ic_journal', view: () => <JournalTab /> },
  { id: 'trophies', label: 'Awards', about: 'Achievements. Each one adds a little income.', icon: 'ic_trophies', view: () => <TrophiesTab /> },
  { id: 'helpers', label: 'Tinkers', about: 'Helpers that buy things for you.', icon: 'ic_gear', view: () => <HelpersTab />, when: () => rt().game.mods.helperSlots > 0 || !!rt().game.mods.flags.autoSeason },
  { id: 'settings', label: 'Options', about: 'Sound, performance and your save.', icon: 'ic_settings', view: () => <SettingsTab /> },
];

function pressTab(id: PanelId): void {
  rt().sound.unlock();
  rt().sound.play('click');
  useUI.getState().setPanel(id);
}

/**
 * The menu: a strip of labelled tabs and, when open, the panel for the chosen one. A desktop
 * window has it on the right. A small screen gets the compact one: along the bottom when held
 * upright, down the right-hand side when lying flat. The panel opens and closes like a drawer,
 * and `away` slides the whole menu off the screen (for "Just watch").
 */
export function SidePanel({ away = false }: { away?: boolean }) {
  const { game, want } = useGuide();
  const layout = useLayout();
  const panel = useUI((s) => s.panel);
  const open = useUI((s) => s.panelOpen);
  const drawer = usePresence(open);
  const tabs = TABS.filter((t) => !t.when || t.when());
  const current = tabs.find((t) => t.id === panel) ?? tabs[0];
  // The tab that holds whatever the lesson asks for.
  const pointed = want ? describeWant(game, want).panel : null;
  const menu: MenuProps = { away, tabs, current, open, drawer, pointed };
  if (!layout.compact) return <RoomyMenu {...menu} />;
  return layout.dock === 'bottom' ? <SheetMenu {...menu} /> : <StripMenu {...menu} />;
}

interface MenuProps {
  away: boolean;
  tabs: TabDef[];
  current: TabDef;
  open: boolean;
  drawer: { mounted: boolean; away: boolean };
  pointed: PanelId | null;
}

/* ───────────────────────────── A desktop window: tabs and panel on the right ───────────────────────────── */

function RoomyMenu({ away, tabs, current, open, drawer, pointed }: MenuProps) {
  const pulledOut = drawer.mounted && !drawer.away;
  return (
    <div className={`slide slide-menu pointer-events-none absolute inset-y-0 right-0 z-10 flex flex-row p-2 ${away ? 'is-away' : ''}`} inert={away}>
      <div className="pointer-events-auto flex flex-col justify-start gap-1 pt-1 pr-1">
        {tabs.map((t) => {
          const active = open && t.id === current.id;
          // The lesson points at a tab until the player has it open.
          const guided = pointed === t.id && !active;
          return (
            <button key={t.id} type="button" className={`relative flex h-[58px] w-[62px] flex-col items-center justify-center ${active ? 'skin-slot-lit text-ink' : 'skin-plaque'} ${guided ? 'guide-wanted' : ''} hover:brightness-110`} {...tip(() => ({ title: t.label, lines: [t.about] }))} onClick={() => pressTab(t.id)}>
              {guided && <GuideArrow to="right" className="top-1/2 -left-8" />}
              <Icon name={t.icon} size={24} />
              <span className="text-[11px] leading-none font-bold">{t.label}</span>
              {!active && t.nudge?.() && <span className="anim-shimmer absolute -top-1 -right-1 h-3 w-3 border-2 border-[#241a2e] bg-gold" />}
            </button>
          );
        })}
      </div>
      {/* The drawer: this box grows and shrinks, and the panel inside keeps its full size, so nothing in it is squeezed on the way. */}
      <div className={`pointer-events-auto flex h-auto shrink-0 overflow-hidden transition-[width,height] duration-[220ms] ease-out motion-reduce:transition-none ${pulledOut ? 'w-[372px]' : 'w-0'}`} inert={!open}>
        {drawer.mounted && (
          <div className="skin-panel flex h-auto min-h-0 w-[372px] shrink-0 flex-col">
            <h2 className="flex items-center gap-2 text-2xl leading-none font-bold">
              <Icon name={current.icon} size={24} />
              {current.label}
            </h2>
            <div className="mb-1.5 border-b-2 border-parchment-deep pb-1 text-sm leading-tight text-ink-soft">{current.about}</div>
            <div className="scroll-pixel min-h-0 flex-1 pr-1">{current.view()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── A small screen: one strip of tabs, and a panel that slides out of it ───────────────────────────── */

/** The compact strip of tabs: one dark bar, the open tab lit. `column` stands it up along the side. */
function TabStrip({ tabs, current, open, pointed, column }: Pick<MenuProps, 'tabs' | 'current' | 'open' | 'pointed'> & { column: boolean }) {
  return (
    <>
      {tabs.map((t) => {
        const active = open && t.id === current.id;
        const guided = pointed === t.id && !active;
        return (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            aria-pressed={active}
            className={`relative flex min-h-0 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 ${active ? 'bg-[#fff3c9] text-ink outline-2 outline-[#c8841c]' : 'text-cream'} ${guided ? 'guide-wanted' : ''}`}
            onClick={() => pressTab(t.id)}
          >
            {guided && <GuideArrow to={column ? 'right' : 'down'} className={column ? 'top-1/2 -left-8' : '-top-8 left-1/2'} />}
            <Icon name={t.icon} size={22} />
            <span className="text-[10px] leading-none font-bold tracking-tight whitespace-nowrap">{t.label}</span>
            {!active && t.nudge?.() && <span className="anim-shimmer absolute top-0 right-0.5 h-2.5 w-2.5 border-2 border-[#241a2e] bg-gold" />}
          </button>
        );
      })}
    </>
  );
}

/** The top of a compact panel: what it is, and a button that puts it away. */
function PanelTitle({ tab }: { tab: TabDef }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon name={tab.icon} size={20} />
      <h2 className="text-xl leading-none font-bold">{tab.label}</h2>
      <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{tab.about}</span>
      <button type="button" aria-label="Close the menu" className="skin-slot -my-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center" onClick={() => pressTab(tab.id)}>
        <Icon name="ic_close" size={14} />
      </button>
    </div>
  );
}

/** Lying flat: the tabs stand along the right edge, and the panel slides out beside them. */
function StripMenu({ away, tabs, current, open, drawer, pointed }: MenuProps) {
  const { safe, tabs: strip, panel: width } = useLayout();
  const pulledOut = drawer.mounted && !drawer.away;
  return (
    <div className={`slide slide-menu pointer-events-none absolute inset-y-0 right-0 z-10 flex flex-row ${away ? 'is-away' : ''}`} style={{ paddingTop: safe.top }} inert={away}>
      <div className="pointer-events-auto flex shrink-0 overflow-hidden transition-[width] duration-[220ms] ease-out motion-reduce:transition-none" style={{ width: pulledOut ? width : 0 }} inert={!open}>
        {drawer.mounted && (
          <div className="skin-panel flex min-h-0 shrink-0 flex-col" style={{ width, paddingBottom: safe.bottom }}>
            <div className="mb-1 border-b-2 border-parchment-deep pb-1.5">
              <PanelTitle tab={current} />
            </div>
            <div className="scroll-pixel min-h-0 flex-1 pr-1">{current.view()}</div>
          </div>
        )}
      </div>
      <nav className="skin-plaque pointer-events-auto flex shrink-0 flex-col" style={{ width: strip, paddingRight: safe.right, paddingBottom: safe.bottom }}>
        <TabStrip tabs={tabs} current={current} open={open} pointed={pointed} column />
      </nav>
    </div>
  );
}

/** How far a finger must pull the sheet's handle before it counts as a pull and not a tap. */
const PULL_SLACK = 6;

/**
 * Held upright: the tabs run along the bottom, and the panel rises out of them as a sheet. Its
 * top edge is a handle: pull it up for the whole screen, down to half, further down to put it away.
 */
function SheetMenu({ away, tabs, current, open, drawer, pointed }: MenuProps) {
  const layout = useLayout();
  const sheet = useUI((s) => s.sheet);
  const setSheet = useUI((s) => s.setSheet);
  const { safe, tabs: bar, panel: half, full, scale } = layout;
  const resting = panelSize(layout, sheet);
  // While the handle is held, the sheet follows the finger.
  const [pulled, setPulled] = useState<number | null>(null);
  const grip = useRef<{ y: number; from: number; moved: boolean } | null>(null);
  const pulledOut = drawer.mounted && !drawer.away;
  const height = pulled ?? resting;

  const onDown = (e: PointerEvent) => {
    // The button that puts the sheet away sits on the handle, and is pressed like any other.
    if ((e.target as Element).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    grip.current = { y: e.clientY, from: resting, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const g = grip.current;
    if (!g) return;
    const dy = (e.clientY - g.y) / scale;
    if (!g.moved && Math.abs(dy) < PULL_SLACK) return;
    g.moved = true;
    setPulled(Math.max(60, Math.min(full, g.from - dy)));
  };
  const onUp = () => {
    const g = grip.current;
    grip.current = null;
    setPulled(null);
    if (!g) return;
    // A tap on the handle switches between half and the whole screen.
    if (!g.moved || pulled === null) return setSheet(sheet === 'half' ? 'full' : 'half');
    if (pulled < half * 0.6) {
      // Pulled right down: put it away, to come back at its usual height.
      pressTab(current.id);
      setSheet('half');
    } else setSheet(pulled > (half + full) / 2 ? 'full' : 'half');
  };

  return (
    <div className={`slide slide-menu pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col ${away ? 'is-away' : ''}`} inert={away}>
      <div
        className={`pointer-events-auto flex shrink-0 flex-col justify-start overflow-hidden ${pulled === null ? 'transition-[height] duration-[220ms] ease-out motion-reduce:transition-none' : ''}`}
        style={{ height: pulledOut ? height : 0 }}
        inert={!open}
      >
        {drawer.mounted && (
          <div className="skin-panel flex min-h-0 shrink-0 flex-col" style={{ height, paddingLeft: safe.left, paddingRight: safe.right }}>
            <div className="-mt-1 mb-1 cursor-ns-resize touch-none border-b-2 border-parchment-deep pb-1.5" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <div className="mx-auto mb-1.5 h-1.5 w-12 bg-[#9d6236]" />
              <PanelTitle tab={current} />
            </div>
            <div className="scroll-pixel min-h-0 flex-1 pr-1">{current.view()}</div>
          </div>
        )}
      </div>
      <nav className="skin-plaque pointer-events-auto flex shrink-0" style={{ height: bar, paddingBottom: safe.bottom, paddingLeft: safe.left, paddingRight: safe.right }}>
        <TabStrip tabs={tabs} current={current} open={open} pointed={pointed} column={false} />
      </nav>
    </div>
  );
}
