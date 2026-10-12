import { rt } from '@/app/runtime';
import { EVERGREEN } from '@/config/resources';
import { BLESSING_BY_ID, WONDER_BY_ID } from '@/config/seasons';
import { CATS } from '@/game/types';
import { BUILDINGS } from '@/config/buildings';
import { wonderSlots } from '@/game/events';
import { fmt, fmtMult, fmtPct, fmtTime } from '@/game/format';
import { canTurnSeason, dewForNextToken, nextMilestone, tokenBreakdown } from '@/game/prestige';
import { useUI } from '@/store/ui';
import { describeGlobal } from '../describe';
import { Bar, Btn, Icon, SectionTitle, tip, useTick } from '../widgets';

const CAT_COLORS: Record<string, string> = { flora: '#52ae35', fauna: '#f08aa0', craft: '#c48748', mystic: '#8872bb' };
const CAT_LABELS: Record<string, string> = { flora: 'Plants', fauna: 'Creatures', craft: 'Crafts', mystic: 'Magic' };

/** How many buildings of each kind the player owns: the thing Harmony wants kept even. */
function BalanceMeter() {
  const { game } = rt();
  const totals = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<string, number>;
  for (const def of BUILDINGS) totals[def.cat] += game.s.b[def.id] ?? 0;
  const most = Math.max(1, ...Object.values(totals));
  return (
    <div className="skin-slot" {...tip(() => ({ title: 'Harmony', lines: ['A bonus to all income. It is strongest when plants, creatures, crafts and magic are owned in even numbers.', `Balance: ${fmtPct(game.rates.balance)}`] }))}>
      <div className="mb-0.5 flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1 font-bold">
          <Icon name="res_harmony" size={16} /> Harmony
        </span>
        <span className="font-bold">+{fmtPct(game.rates.harmony)} income</span>
      </div>
      {CATS.map((cat) => (
        <div key={cat} className="flex items-center gap-1 text-xs">
          <span className="w-16">{CAT_LABELS[cat]}</span>
          <Bar className="flex-1" value={totals[cat] / most} color={CAT_COLORS[cat]} />
          <span className="w-8 text-right">{totals[cat]}</span>
        </div>
      ))}
    </div>
  );
}

export function SeasonTab() {
  useTick();
  const { game } = rt();
  const { s, mods } = game;
  const setModal = useUI((u) => u.setModal);
  const breakdown = tokenBreakdown(game);
  const ready = canTurnSeason(game);
  const milestone = nextMilestone(game);
  const needDew = dewForNextToken(game);
  const best = s.history.reduce((m, h) => Math.max(m, h.tokens), 0);
  const locked = s.seasons === 0 && !mods.flags.sundial;

  return (
    <div className="flex flex-col gap-1">
      <div className="skin-slot-lit flex items-center gap-2">
        <Icon name={EVERGREEN.icon} size={36} />
        <div className="flex-1">
          <div className="text-sm text-ink-soft">Evergreen Tokens</div>
          <div className="text-2xl leading-none font-bold">{fmt(s.tokens)}</div>
        </div>
        <Btn tone="green" onClick={() => setModal({ kind: 'tree' })}>
          Evergreen tree
        </Btn>
      </div>

      <SectionTitle>Rebirth: turning the season</SectionTitle>
      {locked ? (
        <div className="skin-slot text-sm leading-snug">
          Seasons cannot turn yet. Reach the <b>Hearthside Hamlet</b> and raise the <b>Season Sundial</b>. Then you can end the season, keep Evergreen Tokens forever, and begin again far stronger.
        </div>
      ) : (
        <div className="skin-slot flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span>If you turn the season now</span>
            <span className="inline-flex items-center gap-1 text-lg font-bold">
              <Icon name={EVERGREEN.icon} size={18} />+{fmt(breakdown.total)}
            </span>
          </div>
          <div className="flex justify-between text-ink-soft" {...tip(() => ({ title: 'Where tokens come from', lines: ['Dew earned this season gives tokens with diminishing returns: the further you push, the slower they come, so at some point it pays to start over.', 'Discovering lands and growing Wonders add tokens on top.'] }))}>
            <span>From dew {fmt(breakdown.fromDew, 1)}</span>
            <span>Milestones {fmt(breakdown.fromMilestones)}</span>
            <span>{fmtMult(breakdown.multiplier)}</span>
          </div>
          {needDew > 0 && (
            <>
              <Bar value={s.earned.dew / needDew} color="#f2bc36" />
              <div className="text-ink-soft">
                Next token at {fmt(needDew)} dew earned ({fmt(s.earned.dew)} so far)
              </div>
            </>
          )}
          {milestone && (
            <div className="text-ink-soft">
              Next milestone: {milestone.text} (+{milestone.tokens})
            </div>
          )}
          <Btn tone="gold" disabled={!ready} className="mt-1 text-lg" onClick={() => setModal({ kind: 'turn' })}>
            Turn the Season
          </Btn>
        </div>
      )}

      {mods.flags.harmony ? <BalanceMeter /> : null}

      <SectionTitle>This season</SectionTitle>
      <div className="skin-slot grid grid-cols-2 gap-x-3 text-sm" {...tip(() => ({ title: 'What multiplies everything', lines: describeGlobal(game) }))}>
        <span>Season</span>
        <span className="text-right font-bold">{s.seasons + 1}</span>
        <span>Time</span>
        <span className="text-right">{fmtTime(s.time)}</span>
        <span>Dew earned</span>
        <span className="text-right">{fmt(s.earned.dew)}</span>
        <span>All production</span>
        <span className="text-right">{fmtMult(game.rates.global)}</span>
        {s.blessing && (
          <>
            <span>Blessing</span>
            <span className="text-right">{BLESSING_BY_ID[s.blessing]?.name}</span>
          </>
        )}
        {mods.flags.heartwood ? (
          <>
            <span>Elder rings</span>
            <span className="text-right">{s.rings}</span>
          </>
        ) : null}
      </div>

      {(s.wonders.length > 0 || s.plot || s.seeds > 0) && (
        <>
          <SectionTitle right={<span className="text-xs normal-case">{s.wonders.length} / {wonderSlots(game)}</span>}>Wonders</SectionTitle>
          <div className="flex flex-col gap-1">
            {s.wonders.map((id) => (
              <div key={id} className="skin-slot flex items-center gap-2 text-sm">
                <Icon name={`wonder_${id}`} size={30} />
                <div>
                  <div className="font-bold">{WONDER_BY_ID[id].name}</div>
                  <div className="leading-tight text-ink-soft">{WONDER_BY_ID[id].text}</div>
                </div>
              </div>
            ))}
            {s.plot && (
              <div className="skin-slot text-sm">
                <div className="mb-0.5 flex items-center gap-1">
                  <Icon name="ic_seed" size={18} /> A mysterious seed is growing…
                </div>
                <Bar value={s.plot.progress} color="#8872bb" />
              </div>
            )}
            {s.seeds > 0 && <div className="text-sm text-ink-soft">{s.seeds} more seed{s.seeds === 1 ? '' : 's'} waiting for a free plot.</div>}
          </div>
        </>
      )}

      {mods.flags.constellations ? (
        <Btn tone="blue" onClick={() => setModal({ kind: 'stars' })}>
          Constellations
        </Btn>
      ) : null}

      {s.seasons > 0 && (
        <>
          <SectionTitle>Past seasons</SectionTitle>
          <div className="skin-slot grid grid-cols-2 gap-x-3 text-sm">
            <span>Seasons turned</span>
            <span className="text-right font-bold">{s.seasons}</span>
            <span>Tokens earned in all</span>
            <span className="text-right">{fmt(s.tokensEarned)}</span>
            <span>Best season</span>
            <span className="text-right">{fmt(best)}</span>
            {s.history
              .slice(-5)
              .reverse()
              .map((h, i) => (
                <span key={i} className="col-span-2 flex justify-between text-ink-soft">
                  <span>{i === 0 ? 'Last season' : `${i + 1} seasons ago`}</span>
                  <span>
                    +{fmt(h.tokens)} in {fmtTime(h.seconds)}
                  </span>
                </span>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
