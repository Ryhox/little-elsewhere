import type { ReactNode } from 'react';
import { rt } from '@/app/runtime';
import { PERMS } from '@/config/evergreen';
import { availableUpgrades, discoverableRegions, permAvailable, permCost, regionCost, upgradeCost } from '@/game/actions';
import { canAfford } from '@/game/economy';
import { canTurnSeason } from '@/game/prestige';
import { useUI, type PanelId } from '@/store/ui';
import { describeWant, GuideArrow, useGuide } from './Guide';
import { JournalTab, TrophiesTab } from './tabs/Collections';
import { SeasonTab } from './tabs/Season';
import { BuildTab, UpgradesTab } from './tabs/Shop';
import { HelpersTab, SettingsTab } from './tabs/System';
import { Icon, tip, usePresence } from './widgets';

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

/**
 * The menu: a strip of labelled tabs and, when open, the panel for the chosen one. Sits on the
 * right on wide screens and along the bottom on narrow ones. The panel opens and closes like a
 * drawer, and `away` slides the whole menu off the screen (for "Just watch").
 */
export function SidePanel({ away = false }: { away?: boolean }) {
  const { game, want } = useGuide();
  const panel = useUI((s) => s.panel);
  const open = useUI((s) => s.panelOpen);
  const setPanel = useUI((s) => s.setPanel);
  const drawer = usePresence(open);
  const pulledOut = drawer.mounted && !drawer.away;
  const tabs = TABS.filter((t) => !t.when || t.when());
  const current = tabs.find((t) => t.id === panel) ?? tabs[0];
  // The tab that holds whatever the lesson asks for.
  const pointed = want ? describeWant(game, want).panel : null;

  return (
    <div className={`slide slide-menu pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col md:inset-y-0 md:right-0 md:left-auto md:flex-row md:p-2 ${away ? 'is-away' : ''}`} inert={away}>
      <div className="pointer-events-auto flex justify-center gap-1 px-1 md:flex-col md:justify-start md:px-0 md:pt-1 md:pr-1">
        {tabs.map((t) => {
          const active = open && t.id === current.id;
          // The lesson points at a tab until the player has it open.
          const guided = pointed === t.id && !active;
          return (
            <button
              key={t.id}
              type="button"
              className={`relative flex h-[58px] w-[62px] flex-col items-center justify-center ${active ? 'skin-slot-lit text-ink' : 'skin-plaque'} ${guided ? 'guide-wanted' : ''} hover:brightness-110`}
              {...tip(() => ({ title: t.label, lines: [t.about] }))}
              onClick={() => {
                rt().sound.unlock();
                rt().sound.play('click');
                setPanel(t.id);
              }}
            >
              {guided && <GuideArrow to="down" className="-top-7 left-1/2 md:hidden" />}
              {guided && <GuideArrow to="right" className="top-1/2 -left-8 hidden md:block" />}
              <Icon name={t.icon} size={24} />
              <span className="text-[11px] leading-none font-bold">{t.label}</span>
              {!active && t.nudge?.() && <span className="anim-shimmer absolute -top-1 -right-1 h-3 w-3 border-2 border-[#241a2e] bg-gold" />}
            </button>
          );
        })}
      </div>
      {/* The drawer: this box grows and shrinks, and the panel inside keeps its full size, so nothing in it is squeezed on the way. */}
      <div className={`pointer-events-auto flex shrink-0 overflow-hidden transition-[width,height] duration-[220ms] ease-out motion-reduce:transition-none md:h-auto ${pulledOut ? 'h-[44vh] md:w-[372px]' : 'h-0 md:w-0'}`} inert={!open}>
        {drawer.mounted && (
          <div className="skin-panel flex h-[44vh] min-h-0 w-full shrink-0 flex-col md:h-auto md:w-[372px]">
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
