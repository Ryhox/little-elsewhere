import { useLayoutEffect, useRef } from 'react';
import { rt } from '@/app/runtime';
import { ABILITIES, BUFF_INFO } from '@/config/abilities';
import { BALANCE } from '@/config/balance';
import { BUILDING_BY_ID } from '@/config/buildings';
import { REGION_BY_ID } from '@/config/regions';
import { EVERGREEN, RESOURCES } from '@/config/resources';
import { UPGRADE_BY_ID } from '@/config/upgrades';
import { abilityUnlocked, castAbility, upgradeCost, upgradeVisible } from '@/game/actions';
import type { Game } from '@/game/context';
import { fmt, fmtMult, fmtRate, fmtTime } from '@/game/format';
import { canTurnSeason, dewForNextToken, tokensOnTurn } from '@/game/prestige';
import { useUI } from '@/store/ui';
import { describeGlobal, describeSpring } from './describe';
import { GUIDE_CARD_ID, GuideCard } from './Guide';
import { freeArea } from './layout';
import { Btn, Icon, tip, useLayout, useTick } from './widgets';

/** The two currencies, stacked: Dew on top, Evergreen Tokens right under it. */
function Purse() {
  const { game } = rt();
  const { s, rates } = game;
  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1">
      <div className="skin-plaque flex min-w-[168px] items-center gap-2" {...tip(() => ({ title: RESOURCES.dew.name, lines: [RESOURCES.dew.blurb, ...describeSpring(game), ...describeGlobal(game)] }))}>
        <Icon name={RESOURCES.dew.icon} size={34} />
        <div className="leading-none">
          <div className="text-xs font-bold tracking-wide opacity-80">DEW</div>
          <div className="text-shadow text-2xl font-bold">{fmt(s.res.dew)}</div>
          <div className="text-sm text-[#8fe8ff]">+{fmtRate(rates.res.dew)} per second</div>
        </div>
      </div>
      <div className="skin-plaque flex min-w-[168px] items-center gap-2" {...tip(() => ({ title: EVERGREEN.name, lines: [EVERGREEN.blurb, `Turning the season now would give +${fmt(tokensOnTurn(game))}.`] }))}>
        <Icon name={EVERGREEN.icon} size={34} />
        <div className="leading-none">
          <div className="text-xs font-bold tracking-wide opacity-80">EVERGREEN TOKENS</div>
          <div className="text-shadow text-2xl font-bold">{fmt(s.tokens)}</div>
          <div className="text-sm text-[#c2ea78]">+{fmt(tokensOnTurn(game))} if you rebirth</div>
        </div>
      </div>
    </div>
  );
}

/** Time of day, the season number, and whatever buffs are running. */
function Clock() {
  const { game } = rt();
  const { s, rates } = game;
  const night = rates.night > 0.5;
  const t = (s.day % BALANCE.day.length) / BALANCE.day.length;
  const buffs = Object.keys(s.buffs).filter((id) => BUFF_INFO[id]);
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1">
      <div className="skin-plaque flex items-center gap-1.5" {...tip(() => ({ title: night ? 'Night' : 'Day', lines: ['Some things only gather dew at night: lanterns, moonmoths and observatories.', `Season ${s.seasons + 1}, ${fmtTime(s.time)} in.`] }))}>
        <Icon name={night ? 'ic_moon' : 'ic_sun'} size={22} />
        <span className="leading-none">
          <span className="block text-sm font-bold">
            {night ? 'Night' : 'Day'} · Season {s.seasons + 1}
          </span>
          <span className="mt-1 block h-1.5 w-full bg-[#161a3c]">
            <span className="block h-full" style={{ width: `${t * 100}%`, background: night ? '#b5a0de' : '#f2bc36' }} />
          </span>
        </span>
      </div>
      {buffs.map((id) => (
        <div key={id} className="skin-plaque anim-pop flex items-center gap-1" {...tip(() => ({ title: BUFF_INFO[id].name, lines: [`${fmtTime(s.buffs[id])} left`] }))}>
          <Icon name={BUFF_INFO[id].icon} size={20} />
          <span className="text-sm">
            {BUFF_INFO[id].name} {Math.ceil(s.buffs[id])}s
          </span>
        </div>
      ))}
    </div>
  );
}

/** What an ability's tooltip says. Its number key is only named where there is a keyboard to press it on. */
function abilityTip(game: Game, a: (typeof ABILITIES)[number], index: number) {
  const { s, mods } = game;
  const cooldown = s.cooldowns[a.id] ?? 0;
  return {
    title: useUI.getState().touch ? a.name : `${a.name}  [${index + 1}]`,
    lines: [a.desc, cooldown > 0 ? `Ready in ${fmtTime(cooldown)}` : 'Ready!', a.duration ? `Lasts ${Math.round(a.duration * mods.abilityDur)}s` : 'Instant'],
  };
}

/** Castable abilities with their cooldowns, and the Flow meter. */
function Abilities() {
  const { game } = rt();
  const { s, mods } = game;
  const unlocked = ABILITIES.filter((a) => abilityUnlocked(game, a.id));
  if (!unlocked.length && mods.flowMax <= 0) return null;
  return (
    <div className="pointer-events-auto flex items-end gap-1">
      {unlocked.map((a, i) => {
        const cooldown = s.cooldowns[a.id] ?? 0;
        const total = a.cooldown * mods.abilityCd;
        const active = (s.buffs[a.id] ?? 0) > 0;
        return (
          <button
            key={a.id}
            type="button"
            className={`skin-plaque relative grid h-[60px] w-[60px] place-items-center ${cooldown > 0 ? '' : 'anim-shimmer cursor-pointer'}`}
            style={{ outline: active ? '3px solid #f2bc36' : undefined }}
            {...tip(() => abilityTip(game, a, i))}
            onClick={() => {
              rt().sound.unlock();
              if (!castAbility(game, a.id)) rt().sound.play('deny');
              useUI.getState().bump();
            }}
          >
            <Icon name={a.icon} size={28} className={cooldown > 0 ? 'opacity-40' : ''} />
            {cooldown > 0 && <span className="absolute inset-x-0 bottom-0 bg-[#161a3c]/70" style={{ height: `${(cooldown / total) * 100}%` }} />}
            {cooldown > 0 && <span className="text-shadow absolute text-sm font-bold">{Math.ceil(cooldown)}</span>}
          </button>
        );
      })}
      {mods.flowMax > 0 && (
        <div className="skin-plaque w-28" {...tip(() => ({ title: 'Flow', lines: ['Tapping in rhythm builds Flow, which multiplies every tap.'] }))}>
          <div className="mb-0.5 flex justify-between text-xs">
            <span>Flow</span>
            <span>{fmtMult(1 + s.flow * mods.flowMax)}</span>
          </div>
          <div className="h-1.5 bg-[#161a3c]">
            <div className="h-full bg-[#47c9e3]" style={{ width: `${s.flow * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** The upgrade that teaches the first rebirth. */
const SUNDIAL = UPGRADE_BY_ID.w_sundial;

/**
 * Where the player stands with Rebirth: the small print on its button, and the fuller story for
 * its tooltip. Before the first rebirth it says which upgrade is missing, and whether that upgrade
 * can be bought yet or what still has to be done for it to appear.
 */
function rebirthAdvice(game: Game): { hint: string; lines: string[] } {
  const { s } = game;
  const gain = tokensOnTurn(game);
  const about = 'Rebirth starts your world over from the spring and pays you Evergreen Tokens, which make every later season faster.';
  if (canTurnSeason(game)) return { hint: `Turn the season: +${fmt(gain)}`, lines: [about, `Turning the season now would give +${fmt(gain)}.`] };
  if (game.mods.flags.sundial || s.seasons > 0) {
    return { hint: 'Gather more dew first', lines: [about, `It would not earn a token yet. The first one comes at ${fmt(dewForNextToken(game))} dew gathered this season (you have ${fmt(s.earned.dew)}).`] };
  }
  if (upgradeVisible(game, SUNDIAL)) {
    return { hint: `Buy the "${SUNDIAL.name}" upgrade first`, lines: [about, `First buy the "${SUNDIAL.name}" upgrade. It is waiting in the Upgrades menu and costs ${fmt(upgradeCost(game, SUNDIAL).dew ?? 0)} dew.`] };
  }
  const needs = (SUNDIAL.req ?? [])
    .map((r) => (r.region ? `discover ${REGION_BY_ID[r.region].name}` : r.building ? `build ${r.building[1]} ${BUILDING_BY_ID[r.building[0]].name}s` : ''))
    .filter(Boolean)
    .join(' and ');
  return {
    hint: `"${SUNDIAL.name}" upgrade not unlocked yet`,
    lines: [about, `For that you need the "${SUNDIAL.name}" upgrade, and you have not unlocked it yet. It appears in the Upgrades menu once you ${needs}.`],
  };
}

/** Rebirth, always in the same corner: turn the season, and spend what it earns. */
function Rebirth() {
  const { game } = rt();
  const setModal = useUI((s) => s.setModal);
  const ready = canTurnSeason(game);
  const { hint } = rebirthAdvice(game);
  return (
    <div className="pointer-events-auto flex items-stretch gap-1">
      {/* The tooltip hangs on a wrapper: a button that cannot be pressed does not notice the mouse. */}
      <span className="flex" {...tip(() => ({ title: 'Rebirth', lines: rebirthAdvice(game).lines }))}>
        <Btn tone="gold" disabled={!ready} className={`text-left ${ready ? 'anim-shimmer' : 'pointer-events-none'}`} onClick={() => setModal({ kind: 'turn' })}>
          <span className="flex items-center gap-1.5">
            <Icon name="ic_season" size={26} />
            <span>
              <span className="block text-base">Rebirth</span>
              <span className="block max-w-[190px] text-xs font-normal whitespace-normal">{hint}</span>
            </span>
          </span>
        </Btn>
      </span>
      <Btn tone="green" className="text-left" onClick={() => setModal({ kind: 'tree' })}>
        <span className="flex items-center gap-1.5">
          <Icon name={EVERGREEN.icon} size={26} />
          <span>
            <span className="block text-base">Evergreen tree</span>
            <span className="block text-xs font-normal">Permanent upgrades</span>
          </span>
        </span>
      </Btn>
    </div>
  );
}

/* ───────────────────────────── The compact interface (phones, small windows) ───────────────────────────── */

/** The purse in one row: Dew, with what it earns, and the Evergreen Tokens, which open their tree. */
function CompactPurse({ stretch }: { stretch: boolean }) {
  const { game } = rt();
  const { s, rates } = game;
  const setModal = useUI((u) => u.setModal);
  return (
    <>
      <div className={`skin-plaque pointer-events-auto flex min-w-[124px] items-center gap-1.5 ${stretch ? 'max-w-[220px] flex-1' : ''}`} {...tip(() => ({ title: RESOURCES.dew.name, lines: [RESOURCES.dew.blurb, ...describeSpring(game), ...describeGlobal(game)] }))}>
        <Icon name={RESOURCES.dew.icon} size={26} />
        <div>
          <div className="text-shadow text-xl leading-none font-bold">{fmt(s.res.dew)}</div>
          <div className="mt-0.5 text-xs leading-none whitespace-nowrap text-[#8fe8ff]">+{fmtRate(rates.res.dew)} a second</div>
        </div>
      </div>
      <button
        type="button"
        className="skin-plaque pointer-events-auto flex cursor-pointer items-center gap-1 text-left hover:brightness-110"
        {...tip(() => ({ title: EVERGREEN.name, lines: [EVERGREEN.blurb, `Turning the season now would give +${fmt(tokensOnTurn(game))}.`, 'Press to open the Evergreen tree.'] }))}
        onClick={() => {
          rt().sound.unlock();
          rt().sound.play('click');
          setModal({ kind: 'tree' });
        }}
      >
        <Icon name={EVERGREEN.icon} size={24} />
        <span>
          <span className="text-shadow block text-xl leading-none font-bold">{fmt(s.tokens)}</span>
          <span className="mt-0.5 block text-xs leading-none whitespace-nowrap text-[#c2ea78]">+{fmt(tokensOnTurn(game))}</span>
        </span>
      </button>
    </>
  );
}

/** Day or night, the season, and whatever buffs are running, as small chips. */
function CompactClock() {
  const { game } = rt();
  const { s, rates } = game;
  const night = rates.night > 0.5;
  const t = (s.day % BALANCE.day.length) / BALANCE.day.length;
  const buffs = Object.keys(s.buffs).filter((id) => BUFF_INFO[id]);
  return (
    <>
      <div className="skin-plaque pointer-events-auto flex items-center gap-1" {...tip(() => ({ title: night ? 'Night' : 'Day', lines: ['Some things only gather dew at night: lanterns, moonmoths and observatories.', `Season ${s.seasons + 1}, ${fmtTime(s.time)} in.`] }))}>
        <Icon name={night ? 'ic_moon' : 'ic_sun'} size={22} />
        <span>
          <span className="block text-xs leading-none font-bold whitespace-nowrap">Season {s.seasons + 1}</span>
          <span className="mt-1 block h-1.5 w-full bg-[#161a3c]">
            <span className="block h-full" style={{ width: `${t * 100}%`, background: night ? '#b5a0de' : '#f2bc36' }} />
          </span>
        </span>
      </div>
      {buffs.map((id) => (
        <div key={id} className="skin-plaque anim-pop pointer-events-auto flex items-center gap-1" {...tip(() => ({ title: BUFF_INFO[id].name, lines: [`${fmtTime(s.buffs[id])} left`] }))}>
          <Icon name={BUFF_INFO[id].icon} size={20} />
          <span className="text-sm leading-none">{Math.ceil(s.buffs[id])}s</span>
        </div>
      ))}
    </>
  );
}

/** Rebirth joins the purse row the moment the season can be turned. Until then it waits in the Season menu. */
function CompactRebirth() {
  const { game } = rt();
  const setModal = useUI((s) => s.setModal);
  if (!canTurnSeason(game)) return null;
  return (
    <Btn tone="gold" className="anim-shimmer pointer-events-auto text-sm" onClick={() => setModal({ kind: 'turn' })}>
      <span className="flex items-center gap-1">
        <Icon name="ic_season" size={20} />
        Rebirth +{fmt(tokensOnTurn(game))}
      </span>
    </Btn>
  );
}

/** Abilities and the Flow meter, a size smaller, in a row that wraps upwards when it runs out of room. */
function CompactAbilities() {
  const { game } = rt();
  const { s, mods } = game;
  const unlocked = ABILITIES.filter((a) => abilityUnlocked(game, a.id));
  if (!unlocked.length && mods.flowMax <= 0) return null;
  return (
    <>
      {unlocked.map((a, i) => {
        const cooldown = s.cooldowns[a.id] ?? 0;
        const total = a.cooldown * mods.abilityCd;
        const active = (s.buffs[a.id] ?? 0) > 0;
        return (
          <button
            key={a.id}
            type="button"
            aria-label={a.name}
            className={`skin-plaque pointer-events-auto relative grid h-12 w-12 place-items-center ${cooldown > 0 ? '' : 'anim-shimmer cursor-pointer'}`}
            style={{ outline: active ? '3px solid #f2bc36' : undefined }}
            {...tip(() => abilityTip(game, a, i))}
            onClick={() => {
              rt().sound.unlock();
              if (!castAbility(game, a.id)) rt().sound.play('deny');
              useUI.getState().bump();
            }}
          >
            <Icon name={a.icon} size={26} className={cooldown > 0 ? 'opacity-40' : ''} />
            {cooldown > 0 && <span className="absolute inset-x-0 bottom-0 bg-[#161a3c]/70" style={{ height: `${(cooldown / total) * 100}%` }} />}
            {cooldown > 0 && <span className="text-shadow absolute text-sm font-bold">{Math.ceil(cooldown)}</span>}
          </button>
        );
      })}
      {mods.flowMax > 0 && (
        <div className="skin-plaque pointer-events-auto w-24" {...tip(() => ({ title: 'Flow', lines: ['Tapping in rhythm builds Flow, which multiplies every tap.'] }))}>
          <div className="mb-1 flex justify-between text-xs leading-none">
            <span>Flow</span>
            <span>{fmtMult(1 + s.flow * mods.flowMax)}</span>
          </div>
          <div className="h-1.5 bg-[#161a3c]">
            <div className="h-full bg-[#47c9e3]" style={{ width: `${s.flow * 100}%` }} />
          </div>
        </div>
      )}
    </>
  );
}

/** Room kept clear for the two round controls, in whichever row they share. */
const CORNER_ROOM = 92;

/**
 * The compact interface over the world: the purse along the top, the lesson card under it, and
 * the abilities down by the thumb. It keeps to the part of the screen the menu leaves free.
 */
function CompactHud({ away }: { away: boolean }) {
  const layout = useLayout();
  const open = useUI((s) => s.panelOpen);
  const sheet = useUI((s) => s.sheet);
  const setHudEdges = useUI((s) => s.setHudEdges);
  const side = layout.dock === 'side';
  const { safe, scale } = layout;
  const free = freeArea(layout, open, sheet);
  // A sheet pulled all the way up leaves room for the purse and nothing else.
  const crowded = !side && open && sheet === 'full';
  // The camera keeps the world clear of the purse, and messages hang under it: say where the purse row ends, and
  // where the whole block does. Upright, the lesson card spans the screen and counts; lying flat, it sits beside the world.
  const row = useRef<HTMLDivElement>(null);
  const block = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!row.current || !block.current) return;
    const [purse, all] = [row.current, block.current];
    const measure = () => {
      const rowEnd = Math.round(purse.getBoundingClientRect().bottom / scale);
      const blockEnd = side ? rowEnd : Math.round(all.getBoundingClientRect().bottom / scale);
      const card = side ? document.getElementById(GUIDE_CARD_ID) : null;
      const cardEnd = card ? Math.round(card.getBoundingClientRect().right / scale) + 4 : 0;
      const ui = useUI.getState();
      if (rowEnd !== ui.hudRow || blockEnd !== ui.hudTop || cardEnd !== ui.hudLeft) setHudEdges(rowEnd, blockEnd, cardEnd);
    };
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(purse);
    watcher.observe(all);
    return () => watcher.disconnect();
  }, [scale, side, safe.top, setHudEdges]);

  return (
    <div className={`slide slide-left pointer-events-none absolute inset-0 ${away ? 'is-away' : ''}`} inert={away}>
      <div
        className="absolute flex flex-col justify-between gap-1 transition-[right,bottom] duration-[220ms] ease-out motion-reduce:transition-none"
        style={{ left: safe.left + 6, top: safe.top + 6, right: (side ? free.right : safe.right) + 6, bottom: (side ? safe.bottom : free.bottom) + 6 }}
      >
        <div ref={block} className="flex flex-col items-start gap-1">
          <div ref={row} className="flex w-full flex-wrap items-stretch gap-1" style={{ paddingRight: side ? CORNER_ROOM : 0 }}>
            <CompactPurse stretch={!side} />
            <CompactClock />
            <CompactRebirth />
          </div>
          <GuideCard />
        </div>
        <div className={`flex flex-wrap-reverse items-end gap-1 transition-opacity duration-[220ms] ${crowded ? 'invisible opacity-0' : ''}`} style={{ paddingRight: side ? 0 : CORNER_ROOM }}>
          <CompactAbilities />
        </div>
      </div>
    </div>
  );
}

/** Everything drawn over the world that is not a menu. `away` slides it off to the side (for "Just watch"). */
export function Hud({ away = false }: { away?: boolean }) {
  useTick();
  const compact = useLayout().compact;
  if (compact) return <CompactHud away={away} />;
  return (
    <div className={`slide slide-left pointer-events-none absolute inset-0 flex flex-col justify-between p-2 ${away ? 'is-away' : ''}`} inert={away}>
      {/* On a wide screen the lesson card sits beside the purse, over open sea, instead of over the islands. */}
      <div className="flex flex-col items-start gap-1 xl:flex-row xl:gap-2">
        <div className="flex flex-col items-start gap-1">
          <Purse />
          <Clock />
        </div>
        <GuideCard />
      </div>
      <div className="flex flex-col items-start gap-1">
        <Abilities />
        <Rebirth />
      </div>
    </div>
  );
}
