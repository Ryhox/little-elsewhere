import { useState } from 'react';
import { rt } from '@/app/runtime';
import { BUILDINGS } from '@/config/buildings';
import { REGIONS } from '@/config/regions';
import { UPGRADE_BY_ID } from '@/config/upgrades';
import { availableUpgrades, buyBuilding, buyCount, buyRegion, buyUpgrade, discoverableRegions, regionCost, upgradeCost } from '@/game/actions';
import { buildingCost, canAfford, costShare } from '@/game/economy';
import { fmt } from '@/game/format';
import type { BuildingDef, Cat, UpgradeCat, UpgradeDef } from '@/game/types';
import { useUI } from '@/store/ui';
import { buildingYield, describeBuilding } from '../describe';
import { Bar, Btn, CostLine, Icon, SectionTitle, tip, useTick } from '../widgets';

const BUY_AMOUNTS: readonly [number, string][] = [
  [1, '×1'],
  [10, '×10'],
  [-1, 'Max'],
];

/** What each kind of building is, in a word and a colour. */
export const KINDS: Record<Cat, { label: string; color: string }> = {
  flora: { label: 'Plant', color: '#3f8a2a' },
  fauna: { label: 'Creature', color: '#c4507a' },
  craft: { label: 'Craft', color: '#9d6236' },
  mystic: { label: 'Magic', color: '#6e4fa0' },
};

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className="px-1 text-[11px] leading-[14px] font-bold text-cream uppercase" style={{ background: color }}>
      {label}
    </span>
  );
}

function BuildingRow({ def, amount }: { def: BuildingDef; amount: number }) {
  const { game } = rt();
  const owned = game.s.b[def.id] ?? 0;
  const full = owned >= def.max;
  const count = Math.max(1, buyCount(game, def.id, amount));
  const cost = buildingCost(game, def.id, count);
  const affordable = !full && canAfford(game.s, cost);
  const kind = KINDS[def.cat];
  return (
    <div className={`flex items-center gap-2 ${affordable ? 'skin-slot-lit' : 'skin-slot'}`} {...tip(() => ({ title: def.name, lines: describeBuilding(game, def) }))}>
      <Icon name={def.icon} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <span className="text-[17px] leading-tight font-bold">{def.name}</span>
          <Chip {...kind} />
        </div>
        <div className="text-sm leading-tight">{buildingYield(game, def)}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <Bar className="flex-1" value={owned / def.max} color={kind.color} />
          <span className="text-sm leading-none font-bold">
            {owned}/{def.max}
          </span>
        </div>
      </div>
      {full ? (
        <span className="w-[86px] text-center text-sm font-bold text-leaf">Complete</span>
      ) : (
        <Btn
          tone="green"
          disabled={!affordable}
          sound={null}
          className="w-[86px] text-sm"
          onClick={() => {
            if (!buyBuilding(game, def.id, count)) rt().sound.play('deny');
          }}
        >
          <span className="block">Buy{count > 1 ? ` ×${count}` : ''}</span>
          <CostLine cost={cost} check={false} />
        </Btn>
      )}
    </div>
  );
}

/** The next land to discover, with how close the player is to affording it. */
function DiscoverCard({ id }: { id: string }) {
  const { game } = rt();
  const region = REGIONS.find((r) => r.id === id)!;
  const cost = regionCost(game, region);
  const price = cost.dew ?? 0;
  const affordable = canAfford(game.s, cost);
  return (
    <div className={`flex flex-col gap-1 ${affordable ? 'skin-slot-lit anim-shimmer' : 'skin-slot'}`}>
      <div className="flex items-center gap-2">
        <Icon name="ic_map" size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold tracking-wide text-ink-soft uppercase">New land</div>
          <div className="text-[17px] leading-tight font-bold">{region.name}</div>
        </div>
        <Btn tone="gold" disabled={!affordable} sound={null} className="w-[86px] text-sm" onClick={() => buyRegion(game, region.id)}>
          <span className="block">Explore</span>
          <CostLine cost={cost} check={false} />
        </Btn>
      </div>
      <div className="text-sm leading-tight">{region.blurb}</div>
      {!affordable && price > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <Bar className="flex-1" value={game.s.res.dew / price} color="#47c9e3" />
          <span>
            {fmt(game.s.res.dew)} / {fmt(price)}
          </span>
        </div>
      )}
    </div>
  );
}

export function BuildTab() {
  useTick();
  const { game } = rt();
  const amount = useUI((s) => s.buyAmount);
  const setAmount = useUI((s) => s.setBuyAmount);
  const lands = REGIONS.filter((r) => game.s.regions[r.id]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="mr-auto text-sm font-bold">Buy at a time:</span>
        {BUY_AMOUNTS.map(([value, label]) => (
          <Btn key={value} tone={amount === value ? 'green' : 'tan'} className={`min-w-11 text-sm ${amount === value ? 'is-down' : ''}`} onClick={() => setAmount(value)}>
            {label}
          </Btn>
        ))}
      </div>

      {discoverableRegions(game).map((region) => (
        <DiscoverCard key={region.id} id={region.id} />
      ))}

      {[...lands].reverse().map((region) => {
        const list = BUILDINGS.filter((b) => b.region === region.id);
        if (!list.length) return null;
        return (
          <div key={region.id}>
            <SectionTitle>{region.name}</SectionTitle>
            <div className="flex flex-col gap-1.5">
              {list.map((def) => (
                <BuildingRow key={def.id} def={def} amount={amount} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CATEGORY_LABELS: Record<UpgradeCat | 'all', string> = { all: 'All', spring: 'Spring', flora: 'Plants', fauna: 'Creatures', craft: 'Crafts', mystic: 'Magic', synergy: 'Teamwork', world: 'World', ability: 'Abilities' };
const CATEGORY_COLORS: Record<UpgradeCat, string> = { spring: '#1f93c2', flora: KINDS.flora.color, fauna: KINDS.fauna.color, craft: KINDS.craft.color, mystic: KINDS.mystic.color, synergy: '#2a8882', world: '#c8841c', ability: '#b42d36' };

function UpgradeRow({ def }: { def: UpgradeDef }) {
  const { game } = rt();
  const cost = upgradeCost(game, def);
  const affordable = canAfford(game.s, cost);
  return (
    <div className={`flex items-center gap-2 ${affordable ? 'skin-slot-lit' : 'skin-slot'}`}>
      <Icon name={def.icon} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <span className="text-[17px] leading-tight font-bold">{def.name}</span>
          <Chip label={CATEGORY_LABELS[def.cat]} color={CATEGORY_COLORS[def.cat]} />
        </div>
        <div className="text-sm leading-tight">{def.desc}</div>
      </div>
      <Btn
        tone="green"
        disabled={!affordable}
        sound={null}
        className="w-[86px] text-sm"
        onClick={() => {
          if (!buyUpgrade(game, def.id)) rt().sound.play('deny');
        }}
      >
        <span className="block">Buy</span>
        <CostLine cost={cost} check={false} />
      </Btn>
    </div>
  );
}

export function UpgradesTab() {
  useTick();
  const { game } = rt();
  const [filter, setFilter] = useState<UpgradeCat | 'all'>('all');
  const [showOwned, setShowOwned] = useState(false);
  const all = availableUpgrades(game);
  const available = all.filter((u) => filter === 'all' || u.cat === filter).sort((a, b) => costShare(game.s, upgradeCost(game, a)) - costShare(game.s, upgradeCost(game, b)));
  const present = new Set(all.map((u) => u.cat));
  const owned = Object.keys(game.s.up)
    .map((id) => UPGRADE_BY_ID[id])
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm leading-tight">Upgrades last until the season turns. New ones appear as your world grows.</div>
      {present.size > 1 && (
        <div className="flex flex-wrap gap-1">
          {(Object.keys(CATEGORY_LABELS) as (UpgradeCat | 'all')[])
            .filter((cat) => cat === 'all' || present.has(cat))
            .map((cat) => (
              <Btn key={cat} tone={filter === cat ? 'green' : 'tan'} className={`text-xs ${filter === cat ? 'is-down' : ''}`} onClick={() => setFilter(cat)}>
                {CATEGORY_LABELS[cat]}
              </Btn>
            ))}
        </div>
      )}
      {available.length === 0 && <div className="skin-slot py-3 text-center">Nothing new to learn just yet. Keep growing — more will appear.</div>}
      {available.map((def) => (
        <UpgradeRow key={def.id} def={def} />
      ))}
      {owned.length > 0 && (
        <>
          <SectionTitle
            right={
              <button type="button" className="cursor-pointer text-sm underline" onClick={() => setShowOwned(!showOwned)}>
                {showOwned ? 'hide' : 'show'}
              </button>
            }
          >
            Already bought ({owned.length})
          </SectionTitle>
          {showOwned && (
            <div className="flex flex-wrap gap-1">
              {owned.map((def) => (
                <span key={def.id} className="skin-slot" {...tip(() => ({ title: def.name, lines: [def.desc] }))}>
                  <Icon name={def.icon} size={24} />
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
