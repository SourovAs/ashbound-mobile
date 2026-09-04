import { useState } from 'react';
import { cn } from '../../utils/cn';
import { canBuy, UPGRADE_CATEGORIES, UPGRADES, upgradeCost, upgradeLevel, upgradeUnlocked, type UpgradeCategory, type UpgradeDef } from '../progression';
import { actions, useAppState } from '../store';
import { Button, Currency, Icon, Panel, ScreenFrame } from '../ui/primitives';

export function Upgrades() {
  const { save } = useAppState();
  const [cat, setCat] = useState<UpgradeCategory>('combat');
  const [selectedId, setSelectedId] = useState<string>(UPGRADES.find((u) => u.category === 'combat')!.id);
  const list = UPGRADES.filter((u) => u.category === cat);
  const selected = UPGRADES.find((u) => u.id === selectedId) ?? list[0];

  const pickCat = (c: UpgradeCategory) => {
    setCat(c);
    setSelectedId(UPGRADES.find((u) => u.category === c)!.id);
  };

  return (
    <ScreenFrame title="Upgrades" subtitle="Shape the flame that carries you" onBack={() => actions.navigate('menu')} right={<Currency coins={save.currency.coins} essence={save.currency.essence} compact />}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* Tabs */}
        <div className="flex gap-1.5">
          {UPGRADE_CATEGORIES.map((c) => (
            <Button key={c.id} size="sm" selected={cat === c.id} variant={cat === c.id ? 'default' : 'ghost'} onClick={() => pickCat(c.id)}>
              {c.label}
            </Button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          {/* Node list */}
          <div className="scroll-y flex w-1/2 flex-col gap-2 pr-1">
            {list.map((u) => (
              <UpgradeRow key={u.id} u={u} selected={u.id === selected.id} onSelect={() => setSelectedId(u.id)} level={upgradeLevel(save, u.id)} unlocked={upgradeUnlocked(save, u)} />
            ))}
          </div>

          {/* Detail */}
          <Panel className="flex w-1/2 flex-col p-4">
            <UpgradeDetail u={selected} />
          </Panel>
        </div>
      </div>
    </ScreenFrame>
  );
}

function UpgradeRow({ u, selected, onSelect, level, unlocked }: { u: UpgradeDef; selected: boolean; onSelect: () => void; level: number; unlocked: boolean }) {
  const maxed = level >= u.maxLevel;
  return (
    <button
      onClick={onSelect}
      className={cn(
        'panel-flat flex items-center gap-3 px-3 py-2 text-left transition',
        selected && 'border-flame-400/60 shadow-[0_0_14px_rgba(245,158,43,0.15)]',
        !unlocked && 'opacity-55',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center border', maxed ? 'border-flame-400/70 bg-flame-600/20 text-flame-300' : level > 0 ? 'border-ash-400/50 text-flame-400' : 'border-ash-600 text-ash-400')}>
        {unlocked ? <Icon name="flame" size={18} /> : <Icon name="lock" size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-heading block truncate text-[0.7rem] text-ash-100">{u.name}</span>
        <span className="t-caption block text-[0.6rem]">{maxed ? 'Mastered' : `Level ${level} / ${u.maxLevel}`}</span>
      </span>
      <span className="flex gap-0.5">
        {Array.from({ length: u.maxLevel }, (_, i) => (
          <span key={i} className={cn('h-1.5 w-3', i < level ? 'bg-flame-400' : 'bg-ash-600')} />
        ))}
      </span>
    </button>
  );
}

function UpgradeDetail({ u }: { u: UpgradeDef }) {
  const { save } = useAppState();
  const level = upgradeLevel(save, u.id);
  const cost = upgradeCost(save, u);
  const unlocked = upgradeUnlocked(save, u);
  const affordable = canBuy(save, u);
  const missing = (u.requires ?? []).filter((r) => upgradeLevel(save, r) < 1).map((r) => UPGRADES.find((x) => x.id === r)?.name ?? r);

  return (
    <>
      <p className="t-sub text-[0.6rem] text-flame-400/80">{UPGRADE_CATEGORIES.find((c) => c.id === u.category)?.label}</p>
      <h2 className="t-title text-lg text-ash-100">{u.name}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ash-200">{u.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="panel-flat px-3 py-2">
          <p className="t-caption text-[0.58rem]">Current</p>
          <p className="t-stat text-ash-100">{level === 0 ? 'Not learned' : u.effect(level)}</p>
        </div>
        <div className="panel-flat px-3 py-2">
          <p className="t-caption text-[0.58rem]">Next</p>
          <p className="t-stat text-flame-300">{level >= u.maxLevel ? 'Mastered' : u.effect(level + 1)}</p>
        </div>
      </div>

      {u.requires && u.requires.length > 0 && (
        <p className="t-caption mt-3 text-[0.65rem]">
          Requires: {u.requires.map((r) => UPGRADES.find((x) => x.id === r)?.name).join(', ')}
          {missing.length > 0 && <span className="text-blood-500"> · missing {missing.join(', ')}</span>}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between pt-4">
        <div className="flex items-center gap-1.5 text-flame-300">
          <Icon name="coin" size={16} />
          <span className="t-stat text-sm">{cost === null ? '—' : cost}</span>
          <span className="t-caption text-[0.6rem]">Ash Coins</span>
        </div>
        <Button variant="primary" disabled={!affordable} locked={!unlocked} onClick={() => cost !== null && actions.buyUpgrade(u.id, cost)}>
          {cost === null ? 'Mastered' : !unlocked ? 'Locked' : level === 0 ? 'Learn' : 'Upgrade'}
        </Button>
      </div>
    </>
  );
}
