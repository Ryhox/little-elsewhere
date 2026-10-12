import { rt } from '@/app/runtime';
import { BRANCHES, PERM_BY_ID, PERMS } from '@/config/evergreen';
import { EVERGREEN, RESOURCES } from '@/config/resources';
import { CONSTELLATIONS } from '@/config/seasons';
import { buyConstellation, buyPerm, permAvailable, permCost } from '@/game/actions';
import { fmt } from '@/game/format';
import type { Branch, PermDef } from '@/game/types';
import { useUI } from '@/store/ui';
import { Icon, tip, useTick } from './widgets';

const ROW_HEIGHT = 66;
const NODE = 46;
/** Horizontal position of each lane inside a branch column, as a fraction of its width. */
const LANES = [0.27, 0.73];

function nodeTip(def: PermDef) {
  const { game } = rt();
  const level = game.s.perm[def.id] ?? 0;
  const lines = [def.desc, def.max > 1 ? `Level ${level} / ${def.max}` : level ? 'Owned' : 'Not owned'];
  const missing = def.needs.filter((n) => !game.s.perm[n]).map((n) => PERM_BY_ID[n].name);
  if (missing.length) lines.push(`Requires ${missing.join(' and ')}.`);
  if ((def.seasons ?? 0) > game.s.seasons) lines.push(`Requires ${def.seasons} seasons turned (you have ${game.s.seasons}).`);
  if (level < def.max) lines.push(`Cost: ${fmt(permCost(game, def.id))} Evergreen Tokens`);
  return { title: def.name, lines };
}

function BranchColumn({ branch }: { branch: Branch }) {
  const { game } = rt();
  const info = BRANCHES[branch];
  const nodes = PERMS.filter((p) => p.branch === branch);
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  const at = (def: PermDef) => ({ x: LANES[def.col] * 100, y: def.row * ROW_HEIGHT + NODE / 2 + 4 });

  return (
    <div className="min-w-[150px] flex-1">
      <div className="mb-1 flex items-center justify-center gap-1 border-b-4 pb-1 font-bold" style={{ borderColor: info.color }}>
        <Icon name={info.icon} size={22} />
        {info.name}
      </div>
      <div className="mb-1 h-8 text-center text-xs leading-tight text-ink-soft">{info.blurb}</div>
      <div className="relative" style={{ height: rows * ROW_HEIGHT }}>
        <svg className="absolute inset-0 h-full w-full" shapeRendering="crispEdges">
          {nodes.flatMap((def) =>
            def.needs
              .map((id) => PERM_BY_ID[id])
              .filter((need) => need.branch === branch)
              .map((need) => {
                const a = at(need);
                const b = at(def);
                const lit = !!game.s.perm[need.id];
                return <line key={`${need.id}-${def.id}`} x1={`${a.x}%`} y1={a.y} x2={`${b.x}%`} y2={b.y} stroke={lit ? info.color : '#c9ad7c'} strokeWidth={4} />;
              }),
          )}
        </svg>
        {nodes.map((def) => {
          const level = game.s.perm[def.id] ?? 0;
          const open = permAvailable(game, def.id);
          const cost = permCost(game, def.id);
          const affordable = open && game.s.tokens >= cost;
          const p = at(def);
          return (
            <button
              key={def.id}
              type="button"
              className={`absolute grid place-items-center ${level > 0 ? 'skin-slot-lit' : 'skin-slot'} ${affordable ? 'anim-shimmer cursor-pointer' : open || level ? '' : 'opacity-45 grayscale'}`}
              style={{ left: `calc(${p.x}% - ${NODE / 2}px)`, top: p.y - NODE / 2, width: NODE, height: NODE, outline: affordable ? `3px solid ${info.color}` : undefined }}
              {...tip(() => nodeTip(def))}
              onClick={() => {
                rt().sound.unlock();
                if (!buyPerm(game, def.id)) rt().sound.play('deny');
                useUI.getState().bump();
              }}
            >
              <Icon name={def.icon} size={26} />
              {def.max > 1 && (
                <span className="absolute -right-1 -bottom-1 bg-ink px-0.5 text-[10px] leading-tight text-cream">
                  {level}/{def.max}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The permanent upgrade tree: five boughs, bought with Evergreen Tokens and never lost. */
export function EvergreenTree() {
  useTick();
  const { s } = rt().game;
  const owned = Object.values(s.perm).reduce((a, b) => a + b, 0);
  const total = PERMS.reduce((a, p) => a + p.max, 0);
  return (
    <div className="flex max-h-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xl font-bold">
          <Icon name={EVERGREEN.icon} size={26} /> {fmt(s.tokens)} Evergreen Tokens
        </span>
        <span className="text-sm text-ink-soft">
          {owned} / {total} levels grown · these last forever
        </span>
      </div>
      <div className="scroll-pixel flex gap-3 overflow-x-auto pb-2">
        {(Object.keys(BRANCHES) as Branch[]).map((branch) => (
          <BranchColumn key={branch} branch={branch} />
        ))}
      </div>
    </div>
  );
}

/** The star chart: permanent gifts bought with Starlight. */
export function Constellations() {
  useTick();
  const { game } = rt();
  const { s } = game;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 font-bold">
          <Icon name={RESOURCES.dew.icon} size={20} /> {fmt(s.res.dew)} Dew
        </span>
        <span className="text-sm text-ink-soft">Lit stars stay lit through every season.</span>
      </div>
      <div className="relative h-[340px] w-full overflow-hidden border-4 border-[#241a2e] bg-[#161a3c]">
        <svg className="absolute inset-0 h-full w-full" shapeRendering="crispEdges">
          {CONSTELLATIONS.slice(1).map((c, i) => {
            const from = CONSTELLATIONS[i];
            return <line key={c.id} x1={`${from.x * 100}%`} y1={`${from.y * 100}%`} x2={`${c.x * 100}%`} y2={`${c.y * 100}%`} stroke={s.stars[from.id] && s.stars[c.id] ? '#dccdf3' : '#343c80'} strokeWidth={2} strokeDasharray="4 4" />;
          })}
        </svg>
        {CONSTELLATIONS.map((c) => {
          const lit = !!s.stars[c.id];
          const affordable = !lit && s.res.dew >= c.cost;
          return (
            <button
              key={c.id}
              type="button"
              className={`absolute -translate-x-1/2 -translate-y-1/2 text-center text-xs text-[#dccdf3] ${affordable ? 'anim-shimmer cursor-pointer' : ''} ${lit || affordable ? '' : 'opacity-50'}`}
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
              {...tip(() => ({ title: c.name, lines: [c.desc, lit ? 'Lit.' : `Costs ${fmt(c.cost)} Dew.`] }))}
              onClick={() => {
                if (buyConstellation(game, c.id)) rt().sound.play('achievement');
                else rt().sound.play('deny');
                useUI.getState().bump();
              }}
            >
              <Icon name={lit ? 'ic_star' : 'res_starlight'} size={lit ? 30 : 22} />
              <div>{c.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
