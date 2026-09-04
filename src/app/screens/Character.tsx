import { PLAYER } from '../../game/config';
import { computeStats, FLAME_LEVEL_NAMES, UPGRADES, upgradeLevel } from '../progression';
import { ACHIEVEMENTS, actions, useAppState } from '../store';
import { Bar, Currency, Icon, Panel, ScreenFrame } from '../ui/primitives';

export function Character() {
  const { save } = useAppState();
  const stats = computeStats(save);
  const abilities = [
    { name: 'Ember Blade', desc: '3-hit combo · heavy finisher', on: true },
    { name: 'Ash Dash', desc: 'Invulnerable burst of speed', on: true },
    { name: 'Cinder Leap', desc: 'Double jump', on: stats.doubleJump },
    { name: 'Flame Strike', desc: 'Special · 35 Flame', on: stats.specialUnlocked },
  ];
  const equipment = [
    { slot: 'Weapon', item: stats.flameLevel >= 3 ? 'Ignited Ember Blade' : 'Ember Blade', note: `+${Math.round((stats.attackMult - 1) * 100)}% dmg` },
    { slot: 'Armor', item: 'Wayfarer Leathers', note: `${Math.round((1 - stats.damageTakenMult) * 100)}% resist` },
    { slot: 'Cloak', item: 'Crimson Vow', note: 'Bound to the flame' },
    { slot: 'Relic', item: '—', note: 'No relic found' },
  ];
  const learned = UPGRADES.filter((u) => upgradeLevel(save, u.id) > 0);

  return (
    <ScreenFrame title="The Flamebearer" subtitle="Chosen by the last living flame" onBack={() => actions.navigate('menu')} right={<Currency coins={save.currency.coins} essence={save.currency.essence} compact />}>
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
        {/* Portrait & core stats */}
        <Panel className="flex flex-col overflow-hidden">
          <div className="relative h-40 shrink-0 sm:h-48">
            <img src="/images/ui_portrait_flamebearer.jpg" alt="The Flamebearer" className="h-full w-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-ash-900 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-3">
              <p className="t-sub text-[0.58rem] text-flame-400">Flame Level {stats.flameLevel}</p>
              <p className="t-heading text-xs text-ash-100">{FLAME_LEVEL_NAMES[stats.flameLevel - 1]}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 p-3 text-xs">
            <StatRow label="Health" value={`${stats.maxHp}`} bar={<Bar value={stats.maxHp} max={PLAYER.MAX_HP + 60} kind="health" />} />
            <StatRow label="Ash Flame" value={`${stats.maxFlame}`} bar={<Bar value={stats.maxFlame} max={PLAYER.MAX_FLAME + 60} kind="flame" />} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
              <Mini label="Attack" v={`×${stats.attackMult.toFixed(2)}`} />
              <Mini label="Speed" v={`×${stats.moveMult.toFixed(2)}`} />
              <Mini label="Dash CD" v={`${(PLAYER.DASH_COOLDOWN * stats.dashCooldownMult).toFixed(2)}s`} />
              <Mini label="Flame regen" v={`×${stats.flameRegenMult.toFixed(1)}`} />
            </div>
          </div>
        </Panel>

        {/* Equipment & abilities */}
        <div className="flex min-h-0 flex-col gap-3">
          <Panel flat className="p-3">
            <p className="t-sub mb-2 text-[0.6rem] text-ash-300">Equipment</p>
            <div className="flex flex-col gap-1.5">
              {equipment.map((e) => (
                <div key={e.slot} className="flex items-center justify-between border-b border-ash-700/60 pb-1.5 text-xs last:border-0">
                  <span>
                    <span className="t-caption block text-[0.55rem]">{e.slot}</span>
                    <span className="text-ash-100">{e.item}</span>
                  </span>
                  <span className="t-caption text-[0.6rem] text-flame-300/80">{e.note}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel flat className="p-3">
            <p className="t-sub mb-2 text-[0.6rem] text-ash-300">Abilities</p>
            <div className="grid grid-cols-2 gap-1.5">
              {abilities.map((a) => (
                <div key={a.name} className={`flex items-center gap-2 border px-2 py-1.5 ${a.on ? 'border-flame-500/40 bg-flame-600/10' : 'border-ash-700 opacity-50'}`}>
                  <Icon name={a.on ? 'flame' : 'lock'} size={14} className={a.on ? 'text-flame-400' : 'text-ash-400'} />
                  <span className="min-w-0">
                    <span className="t-heading block truncate text-[0.58rem] text-ash-100">{a.name}</span>
                    <span className="t-caption block truncate text-[0.55rem]">{a.desc}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Records */}
        <div className="flex min-h-0 flex-col gap-3">
          <Panel flat className="p-3">
            <p className="t-sub mb-2 text-[0.6rem] text-ash-300">Journey</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Mini label="Levels cleared" v={`${save.stats.levelsCompleted}`} />
              <Mini label="Enemies purged" v={`${save.stats.enemiesDefeated}`} />
              <Mini label="Deaths" v={`${save.stats.deaths}`} />
              <Mini label="Playtime" v={`${Math.floor(save.stats.playtimeSec / 60)}m`} />
            </div>
          </Panel>
          <Panel flat className="scroll-y min-h-0 flex-1 p-3">
            <p className="t-sub mb-2 text-[0.6rem] text-ash-300">Relics of Deed</p>
            <div className="flex flex-col gap-1.5">
              {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
                const got = save.achievements.includes(id);
                return (
                  <div key={id} className={`flex items-center gap-2 text-xs ${got ? '' : 'opacity-45'}`}>
                    <Icon name="star" size={14} className={got ? 'text-flame-400' : 'text-ash-500'} />
                    <span>
                      <span className="block text-ash-100">{a.name}</span>
                      <span className="t-caption block text-[0.58rem]">{a.desc}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            {learned.length > 0 && (
              <>
                <p className="t-sub mt-3 mb-1 text-[0.6rem] text-ash-300">Learned</p>
                <p className="t-caption text-[0.62rem]">{learned.map((u) => `${u.name} ${upgradeLevel(save, u.id)}`).join(' · ')}</p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </ScreenFrame>
  );
}

function StatRow({ label, value, bar }: { label: string; value: string; bar: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="t-caption">{label}</span>
        <span className="t-stat text-ash-100">{value}</span>
      </div>
      {bar}
    </div>
  );
}
function Mini({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-ash-700/50 pb-0.5 text-[0.7rem]">
      <span className="t-caption text-[0.6rem]">{label}</span>
      <span className="t-stat text-ash-100">{v}</span>
    </div>
  );
}
