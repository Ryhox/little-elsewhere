import { useState } from 'react';
import { rt } from '@/app/runtime';
import { RENDER } from '@/config/render';
import { setHelper } from '@/game/actions';
import { exportCode, importCode, wipeSave } from '@/game/save';
import type { HelperRule } from '@/game/types';
import { DEFAULT_SETTINGS, useUI, type Settings } from '@/store/ui';
import { Btn, Icon, SectionTitle, useTick } from '../widgets';

const TARGETS: readonly [HelperRule['target'], string, string?][] = [
  ['any', 'Any building'],
  ['flora', 'Plants'],
  ['fauna', 'Creature homes'],
  ['craft', 'Crafts'],
  ['mystic', 'Magic'],
  ['upgrades', 'Upgrades', 'autoUpgrades'],
  ['regions', 'New lands', 'autoRegions'],
];
const BUDGETS = [0.1, 0.25, 0.5, 1];

/** Program the Tinkers: what each one buys and how much of the bank it may spend. */
export function HelpersTab() {
  useTick();
  const { game } = rt();
  const { s, mods } = game;
  const bump = useUI((u) => u.bump);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm leading-snug text-ink-soft">Each Tinker follows one routine. It picks the cheapest thing that fits and buys as many as its budget allows.</div>
      {s.helpers.map((rule, i) => (
        <div key={i} className="skin-slot flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Icon name="tinker_0" size={26} />
            <span className="flex-1 font-bold">Tinker {i + 1}</span>
            <Btn tone={rule.on ? 'green' : 'tan'} className="text-sm" onClick={() => setHelper(game, i, { on: !rule.on })}>
              {rule.on ? 'Working' : 'Resting'}
            </Btn>
          </div>
          <label className="flex items-center justify-between gap-2 text-sm">
            Buys
            <select
              className="border-2 border-[#4e2c20] bg-cream px-1 py-0.5 font-[inherit]"
              value={rule.target}
              onChange={(e) => {
                setHelper(game, i, { target: e.target.value as HelperRule['target'] });
                bump();
              }}
            >
              {TARGETS.filter(([, , flag]) => !flag || mods.flags[flag]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-1 text-sm">
            Budget
            <span className="flex gap-1">
              {BUDGETS.map((b) => (
                <Btn key={b} tone={rule.budget === b ? 'green' : 'tan'} className={`text-xs ${rule.budget === b ? 'is-down' : ''}`} onClick={() => setHelper(game, i, { budget: b })}>
                  {b * 100}%
                </Btn>
              ))}
            </span>
          </div>
        </div>
      ))}
      {mods.flags.autoSeason ? (
        <>
          <SectionTitle>Season Clock</SectionTitle>
          <div className="skin-slot flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span>Turn the season by itself</span>
              <Btn
                tone={s.autoSeason.on ? 'green' : 'tan'}
                className="text-sm"
                onClick={() => {
                  s.autoSeason.on = !s.autoSeason.on;
                }}
              >
                {s.autoSeason.on ? 'On' : 'Off'}
              </Btn>
            </div>
            <label className="flex items-center justify-between gap-2">
              once it would yield at least
              <input
                type="number"
                min={1}
                className="w-24 border-2 border-[#4e2c20] bg-cream px-1 py-0.5 text-right font-[inherit]"
                value={s.autoSeason.minTokens}
                onChange={(e) => {
                  s.autoSeason.minTokens = Math.max(1, Number(e.target.value) || 1);
                  bump();
                }}
              />
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-16">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} className="flex-1 accent-[#52ae35]" onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-9 text-right">{Math.round(value * 100)}%</span>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Btn tone={value ? 'green' : 'tan'} className="text-sm" onClick={() => onChange(!value)}>
        {value ? 'On' : 'Off'}
      </Btn>
    </div>
  );
}

const FPS_OPTIONS: readonly [number, string][] = [
  [30, '30'],
  [60, '60'],
  [0, 'Max'],
];

export function SettingsTab() {
  const settings = useUI((u) => u.settings);
  const setSettings = useUI((u) => u.setSettings);
  const toast = useUI((u) => u.toast);
  const [code, setCode] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings({ [key]: value } as Pick<Settings, K>);

  return (
    <div className="flex flex-col gap-1">
      <SectionTitle>Sound</SectionTitle>
      <div className="skin-slot flex flex-col gap-1">
        <Slider label="Master" value={settings.master} onChange={(v) => set('master', v)} />
        <Slider label="Effects" value={settings.sfx} onChange={(v) => set('sfx', v)} />
        <Slider label="Music" value={settings.music} onChange={(v) => set('music', v)} />
      </div>

      <SectionTitle>Performance</SectionTitle>
      <div className="skin-slot flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between">
          <span>Detail</span>
          <span className="flex gap-1">
            {RENDER.quality.map((q, i) => (
              <Btn key={q.name} tone={settings.quality === i ? 'green' : 'tan'} className={`text-xs ${settings.quality === i ? 'is-down' : ''}`} onClick={() => set('quality', i)}>
                {q.name}
              </Btn>
            ))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Frame rate</span>
          <span className="flex gap-1">
            {FPS_OPTIONS.map(([fps, label]) => (
              <Btn key={fps} tone={settings.fps === fps ? 'green' : 'tan'} className={`text-xs ${settings.fps === fps ? 'is-down' : ''}`} onClick={() => set('fps', fps)}>
                {label}
              </Btn>
            ))}
          </span>
        </div>
        <div className="leading-tight text-ink-soft">Lower detail thins out particles and wildlife and switches off reflections and cast shadows.</div>
      </div>

      <SectionTitle>Play</SectionTitle>
      <div className="skin-slot flex flex-col gap-1">
        <Toggle label="Floating numbers" value={settings.numbers} onChange={(v) => set('numbers', v)} />
        <Toggle label="Camera follows new lands" value={settings.autoCamera} onChange={(v) => set('autoCamera', v)} />
        <Toggle label="Short season transition" value={settings.shortCutscene} onChange={(v) => set('shortCutscene', v)} />
        <Btn className="text-sm" onClick={() => setSettings(DEFAULT_SETTINGS)}>
          Restore defaults
        </Btn>
      </div>

      <SectionTitle>Save</SectionTitle>
      <div className="skin-slot flex flex-col gap-1 text-sm">
        <div className="leading-tight text-ink-soft">The game saves itself every few seconds. Export a code to keep a backup or move to another device.</div>
        <div className="flex gap-1">
          <Btn
            tone="green"
            className="flex-1 text-sm"
            onClick={() => {
              rt().save();
              toast('Game saved.', 'ic_check');
            }}
          >
            Save now
          </Btn>
          <Btn
            className="flex-1 text-sm"
            onClick={() => {
              const text = exportCode(rt().game);
              setCode(text);
              void navigator.clipboard?.writeText(text).then(() => toast('Save code copied to the clipboard.', 'ic_check'));
            }}
          >
            Export
          </Btn>
        </div>
        <textarea className="h-16 w-full resize-none border-2 border-[#4e2c20] bg-cream p-1 font-mono text-xs select-text" placeholder="Paste a save code here to import it" value={code} onChange={(e) => setCode(e.target.value)} />
        <Btn
          className="text-sm"
          disabled={!code.trim()}
          onClick={() => {
            if (importCode(rt().game, code)) {
              rt().save();
              setCode('');
              toast('Save imported. Welcome back!', 'ic_check', true);
            } else toast('That does not look like a Little Elsewhere save code.', 'ic_close');
          }}
        >
          Import this code
        </Btn>
        {confirmWipe ? (
          <div className="flex items-center gap-1">
            <span className="flex-1 leading-tight text-rose">Erase everything, including Evergreen upgrades?</span>
            <Btn
              tone="red"
              className="text-sm"
              onClick={() => {
                wipeSave(rt().game);
                setConfirmWipe(false);
                toast('A brand new world.', 'ic_seed');
              }}
            >
              Erase
            </Btn>
            <Btn className="text-sm" onClick={() => setConfirmWipe(false)}>
              Keep
            </Btn>
          </div>
        ) : (
          <Btn tone="red" className="text-sm" onClick={() => setConfirmWipe(true)}>
            Start over…
          </Btn>
        )}
      </div>

      <div className="mt-1 text-center text-xs leading-tight text-ink-soft">
        Drag to look around · scroll or pinch to zoom
        <br />
        Space: tap the spring · H: hide menus · 1–5: abilities
      </div>
    </div>
  );
}
