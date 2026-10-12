import { rt } from '@/app/runtime';
import { ACHIEVEMENTS } from '@/config/achievements';
import { BALANCE } from '@/config/balance';
import { JOURNAL, JOURNAL_KINDS } from '@/config/journal';
import { fmtPct } from '@/game/format';
import type { JournalKind } from '@/game/types';
import { Bar, Icon, SectionTitle, tip, useTick } from '../widgets';

/** The discovery journal: everything met, found and figured out. */
export function JournalTab() {
  useTick();
  const { s } = rt().game;
  const found = JOURNAL.filter((j) => s.journal[j.id]).length;
  return (
    <div className="flex flex-col gap-1">
      <div className="skin-slot text-sm">
        <div className="mb-0.5 flex justify-between">
          <span className="font-bold">
            {found} / {JOURNAL.length} discovered
          </span>
          <span className="text-ink-soft">+{fmtPct(found * BALANCE.discoveryTokenBonus)} tokens</span>
        </div>
        <Bar value={found / JOURNAL.length} color="#8872bb" />
      </div>
      {(Object.keys(JOURNAL_KINDS) as JournalKind[]).map((kind) => {
        const entries = JOURNAL.filter((j) => j.kind === kind);
        return (
          <div key={kind}>
            <SectionTitle right={<span className="text-xs normal-case">{entries.filter((e) => s.journal[e.id]).length} / {entries.length}</span>}>{JOURNAL_KINDS[kind]}</SectionTitle>
            <div className="grid grid-cols-6 gap-1">
              {entries.map((entry) => {
                const known = !!s.journal[entry.id];
                return (
                  <span
                    key={entry.id}
                    className={`grid aspect-square place-items-center ${known ? 'skin-slot-lit' : 'skin-slot'}`}
                    {...tip(() => (known ? { title: entry.name, lines: [entry.text] } : { title: '???', lines: [entry.hint] }))}
                  >
                    {known ? <Icon name={entry.icon} size={26} /> : <span className="text-lg font-bold text-parchment-deep">?</span>}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrophiesTab() {
  useTick();
  const { s, mods } = rt().game;
  const earned = ACHIEVEMENTS.filter((a) => s.ach[a.id]).length;
  return (
    <div className="flex flex-col gap-1">
      <div className="skin-slot text-sm">
        <div className="mb-0.5 flex justify-between">
          <span className="font-bold">
            {earned} / {ACHIEVEMENTS.length} achievements
          </span>
          <span className="text-ink-soft">+{fmtPct(earned * mods.ach)} production</span>
        </div>
        <Bar value={earned / ACHIEVEMENTS.length} color="#f2bc36" />
      </div>
      <div className="grid grid-cols-6 gap-1">
        {ACHIEVEMENTS.map((a) => {
          const done = !!s.ach[a.id];
          return (
            <span key={a.id} className={`grid aspect-square place-items-center ${done ? 'skin-slot-lit' : 'skin-slot opacity-60'}`} {...tip(() => ({ title: a.name, lines: [a.desc, done ? 'Earned!' : 'Not yet earned.'] }))}>
              <Icon name={a.icon} size={26} className={done ? '' : 'grayscale'} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
