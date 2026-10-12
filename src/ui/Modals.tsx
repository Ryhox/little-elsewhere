import type { ReactNode } from 'react';
import { rt } from '@/app/runtime';
import { ACHIEVEMENTS } from '@/config/achievements';
import { EVERGREEN, RESOURCES } from '@/config/resources';
import { BLESSING_BY_ID } from '@/config/seasons';
import { chooseBlessing } from '@/game/actions';
import { canAfford } from '@/game/economy';
import { trade } from '@/game/events';
import { fmt, fmtTime } from '@/game/format';
import { tokenBreakdown } from '@/game/prestige';
import { RES } from '@/game/types';
import { useUI } from '@/store/ui';
import { Constellations, EvergreenTree } from './Tree';
import { Btn, CostLine, Icon, useTick } from './widgets';

function Frame({ title, children, wide, onClose }: { title: string; children: ReactNode; wide?: boolean; onClose?: () => void }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#161a3c]/55 p-3" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`skin-panel anim-pop flex max-h-full w-full flex-col ${wide ? 'max-w-[960px]' : 'max-w-[460px]'}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-2xl leading-none font-bold">{title}</h2>
          {onClose && (
            <Btn tone="red" className="text-sm" onClick={onClose}>
              Close
            </Btn>
          )}
        </div>
        <div className="scroll-pixel min-h-0 flex-1 pr-1">{children}</div>
      </div>
    </div>
  );
}

/** Confirmation before a rebirth: exactly what is lost, kept and gained. */
function TurnModal({ close }: { close(): void }) {
  useTick();
  const { game, turn } = rt();
  const b = tokenBreakdown(game);
  return (
    <Frame title="Rebirth: turn the season?" onClose={close}>
      <div className="flex flex-col gap-2">
        <div className="skin-slot-lit flex items-center justify-center gap-2 text-2xl font-bold">
          <Icon name={EVERGREEN.icon} size={32} />+{fmt(b.total)} Evergreen Tokens
        </div>
        <div className="leading-snug">Your world starts over from the spring, but you keep Evergreen Tokens. Spend them on the Evergreen tree and every future season goes further, faster.</div>
        <div className="grid grid-cols-2 gap-2 text-sm leading-snug">
          <div className="skin-slot">
            <div className="mb-0.5 font-bold text-rose">You give up</div>
            All your Dew · every building · this season&apos;s upgrades · discovered lands · Wonders not kept on a shelf
          </div>
          <div className="skin-slot">
            <div className="mb-0.5 font-bold text-leaf">You keep forever</div>
            Evergreen Tokens · the Evergreen tree · achievements · the journal · constellations · Elder rings
          </div>
        </div>
        <div className="flex gap-2">
          <Btn className="flex-1" onClick={close}>
            Not yet
          </Btn>
          <Btn tone="gold" className="flex-1 text-lg" sound={null} disabled={b.total < 1} onClick={turn}>
            Rebirth
          </Btn>
        </div>
      </div>
    </Frame>
  );
}

function TurnedModal({ tokens, close }: { tokens: number; close(): void }) {
  const { game } = rt();
  const setModal = useUI((s) => s.setModal);
  return (
    <Frame title={`Spring again — season ${game.s.seasons + 1}`}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Icon name={EVERGREEN.icon} size={56} />
        <div className="text-3xl font-bold">+{fmt(tokens)}</div>
        <div className="leading-snug">Evergreen Tokens earned. Grow something permanent with them on the Evergreen tree — it will make this season quicker than the last.</div>
        <div className="flex w-full gap-2">
          <Btn className="flex-1" onClick={close}>
            Begin
          </Btn>
          <Btn tone="green" className="flex-1" onClick={() => setModal({ kind: 'tree' })}>
            Evergreen tree
          </Btn>
        </div>
      </div>
    </Frame>
  );
}

function OfflineModal({ seconds, gained, close }: { seconds: number; gained: Record<string, number>; close(): void }) {
  const rows = RES.filter((r) => gained[r] > 0);
  return (
    <Frame title="Welcome back">
      <div className="flex flex-col gap-2">
        <div className="leading-snug">Your little world kept busy for {fmtTime(seconds)} while you were away.</div>
        <div className="skin-slot flex flex-col gap-0.5">
          {rows.length === 0 && <span className="text-ink-soft">Not much happened. It was a quiet time.</span>}
          {rows.map((r) => (
            <span key={r} className="flex items-center gap-2 text-lg">
              <Icon name={RESOURCES[r].icon} size={22} />
              <span className="flex-1">{RESOURCES[r].name}</span>
              <b>+{fmt(gained[r])}</b>
            </span>
          ))}
        </div>
        <Btn tone="green" onClick={close}>
          Lovely
        </Btn>
      </div>
    </Frame>
  );
}

function MerchantModal({ close }: { close(): void }) {
  useTick();
  const { game } = rt();
  const merchant = game.s.merchant;
  if (!merchant) {
    return (
      <Frame title="Peddler Toad" onClose={close}>
        <div className="py-3 text-center">Old Mr. Bramble has packed up and rolled on. He will be back.</div>
      </Frame>
    );
  }
  return (
    <Frame title="Peddler Toad" onClose={close}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 leading-snug">
          <Icon name="peddler_0" size={40} />
          <span>Curios and charms, fair prices! He rolls on in {fmtTime(merchant.left)}.</span>
        </div>
        {merchant.offers.length === 0 && <div className="skin-slot py-2 text-center">Sold out! A pleasure doing business.</div>}
        {merchant.offers.map((offer, i) => (
          <div key={offer.label} className="skin-slot flex items-center gap-2">
            <div className="min-w-0 flex-1 leading-tight">{offer.label}</div>
            <Btn tone="gold" disabled={!canAfford(game.s, offer.give)} sound={null} className="w-[92px] text-sm" onClick={() => trade(game, i)}>
              <span className="block">Buy</span>
              <CostLine cost={offer.give} check={false} />
            </Btn>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function BlessingModal({ close }: { close(): void }) {
  const { game } = rt();
  return (
    <Frame title="Choose a blessing">
      <div className="flex flex-col gap-1.5">
        <div className="leading-snug">The new season offers three gifts. Whichever you choose lasts until your next rebirth.</div>
        {game.s.blessingChoices.map((id) => {
          const def = BLESSING_BY_ID[id];
          return (
            <button
              key={id}
              type="button"
              className="skin-slot-lit flex cursor-pointer items-center gap-2 text-left hover:brightness-105"
              onClick={() => {
                chooseBlessing(game, id);
                rt().sound.play('achievement');
                close();
              }}
            >
              <Icon name={def.icon} size={36} />
              <span>
                <span className="block text-lg font-bold">{def.name}</span>
                <span className="block text-sm">{def.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Frame>
  );
}

/** The closing words, shown once the Elder Tree has bloomed. Play carries on afterwards. */
function EndingModal({ close }: { close(): void }) {
  const { s } = rt().game;
  const rows: [string, string][] = [
    ['Time played', fmtTime(s.stats.endedAt ?? s.stats.playSeconds ?? 0)],
    ['Seasons turned', String(s.seasons)],
    ['Evergreen Tokens earned', fmt(s.tokensEarned)],
    ['Dew gathered in all', fmt(s.life.dew)],
    ['Achievements', `${Object.keys(s.ach).length} / ${ACHIEVEMENTS.length}`],
  ];
  return (
    <Frame title="The Everbloom">
      <div className="flex flex-col items-center gap-2 text-center">
        <Icon name="elder_bloom" size={150} />
        <div className="text-lg leading-snug font-bold">The Elder Tree is in full bloom.</div>
        <div className="leading-snug">From one small spring you grew a whole world, season after season — and now its heart has opened. Little Elsewhere is as it was always meant to be. Thank you for tending it.</div>
        <div className="skin-slot grid w-full grid-cols-2 gap-x-3 text-left">
          {rows.map(([label, value]) => (
            <span key={label} className="contents">
              <span>{label}</span>
              <span className="text-right font-bold">{value}</span>
            </span>
          ))}
        </div>
        <div className="text-sm leading-snug text-ink-soft">The story ends here, but the world does not. Stay as long as you like — there are still secrets, constellations and the Evergreen Shoals to find.</div>
        <Btn tone="green" className="w-full text-lg" onClick={close}>
          Keep tending the world
        </Btn>
      </div>
    </Frame>
  );
}

/** Whichever dialog is open, if any. */
export function Modals() {
  const modal = useUI((s) => s.modal);
  const setModal = useUI((s) => s.setModal);
  const close = () => setModal(null);
  if (!modal) return null;
  switch (modal.kind) {
    case 'turn':
      return <TurnModal close={close} />;
    case 'turned':
      return <TurnedModal tokens={modal.tokens} close={close} />;
    case 'offline':
      return <OfflineModal seconds={modal.seconds} gained={modal.gained} close={close} />;
    case 'merchant':
      return <MerchantModal close={close} />;
    case 'blessing':
      return <BlessingModal close={close} />;
    case 'ending':
      return <EndingModal close={close} />;
    case 'tree':
      return (
        <Frame title="The Evergreen tree" wide onClose={close}>
          <EvergreenTree />
        </Frame>
      );
    case 'stars':
      return (
        <Frame title="Constellations" wide onClose={close}>
          <Constellations />
        </Frame>
      );
    default:
      return null;
  }
}
