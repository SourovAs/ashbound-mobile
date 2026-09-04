# ASHBOUND: THE LAST FLAME — Production Notes

Vertical slice: **Ashen Forest 1-1 "The Waking Ember"** (quality benchmark for all future content).

## 1. Architecture

```
src/
├── App.tsx                     Application root: boot splash, orientation guard, router
├── app/                        APPLICATION LAYER (React) — menus, meta systems, persistence
│   ├── store.ts                External store (useSyncExternalStore) + actions; persists on mutation
│   ├── save.ts                 Versioned save (SAVE_VERSION), migrations, backup + corruption recovery
│   ├── progression.ts          Skill tree (5 categories), PlayerStats derivation, chapter/level catalog
│   ├── ui/primitives.tsx       Design system: Button/Panel/Bar/Icon/Currency/Embers/ScreenFrame
│   ├── ui/uiSound.ts           App-layer audio (menu music, UI feedback)
│   └── screens/                MainMenu · LevelSelect · Upgrades · Character · Settings · game/*
└── game/                       GAME RUNTIME — no React, no per-frame React state
    ├── engine.ts               GameRuntime: fixed-step loop, hit-stop, entities, lighting, events
    ├── config.ts               ALL tuning values + palette (single source of truth)
    ├── input.ts                Keyboard + virtual input aggregation, edge detection
    ├── player.ts               Flamebearer FSM: run/jump/double-jump/dash/3-hit combo/special/hurt/dead
    ├── enemies.ts              Enemy framework (shared FSM) + AshGrunt + AshBeast
    ├── physics.ts              AABB axis-separated collision, one-way platforms, ledge/wall probes
    ├── camera.ts               Side-view camera: look-ahead, vertical deadzone, trauma shake
    ├── particles.ts            Fixed pool (600), zero per-frame allocation
    ├── audio.ts                WebAudio Music/SFX buses; procedural SFX & adaptive drone
    ├── render/rigs.ts          Segmented character rig (head/hair/torso/cloak/limbs/boots/sword/flame)
    ├── render/environment.ts   Seeded parallax tiles (pre-rendered), platforms, props, interactables
    └── levels/forest_1_1.ts    Level data (solids, hazards, enemies, collectibles, checkpoints, gates)
```

**React ↔ Runtime contract** (`types.ts`): React constructs `GameRuntime(canvas, container, options)` and
calls `start/pause/resume/respawn/restart/destroy/setVirtual/setVirtualAxis/updateSettings`.
The runtime emits coarse events: `hud` (throttled 10 Hz + change-detected), `checkpoint`, `death`,
`respawn`, `victory`, `toast`, `hitflash`. Nothing else crosses the boundary.

For the Android build this same runtime can be hosted in React Native via a WebView or a canvas
bridge (e.g. react-native-skia / expo-gl) behind the identical imperative API — no message-passing
coupling exists in gameplay code.

## 2. Game feel implementation
- Acceleration/friction, coyote time (0.10 s), jump buffer (0.12 s), variable jump height
- Dash: 0.16 s, i-frames, cooldown ring in HUD
- Combo: 3 hits, buffered inputs, lunge, heavy finisher, hit-stop (55/90 ms), trauma-based shake
- Enemy telegraphs: wind-up pose + pulsing glow; stagger; knockback; death shards/embers
- Landing squash & dust scaled by impact; footstep dust; dash flame trail; attack arc trail
- Lighting: darkness pass with the flame as primary light; lanterns, checkpoints, altar, exit as secondary

## 3. Save system
- `SAVE_VERSION = 2`, migration table keyed by source version, structural validation/repair
- Primary + backup slots; load order: primary → backup → fresh (user is notified)
- Persists: currency, currentLevel, checkpoint, unlockedLevels, per-level records/stars, upgrades,
  achievements, stats, settings

## 4. Asset naming
Images: `public/images/ui_menu_hero.jpg`, `ui_chapter_forest.jpg`, `ui_portrait_flamebearer.jpg`.
Future sprite atlases follow `player_<state>_<nn>`, `enemy_<kind>_<state>`, `env_<biome>_<asset>`,
`vfx_<name>`, `ui_icon_<name>`.

## 5. Android release checklist
- [ ] Application ID `com.ashbound.lastflame`, versionCode/versionName from CI
- [ ] Landscape-only activity, immersive sticky, display-cutout `shortEdges`
- [ ] Adaptive icon (flame on charcoal), splash aligned with BootSplash
- [ ] Release signing + Android App Bundle; R8 enabled
- [ ] Permissions: `VIBRATE` only
- [ ] Crash reporting + analytics behind a consent flag; Data Safety form: no data collected
- [ ] Store: 8 landscape screenshots (menu, 1-1 forest, combat, altar/gate, checkpoint, upgrades, character, victory), 1024×500 feature graphic
- [ ] Content rating: Fantasy violence (mild)
- [ ] Device matrix QA: low/mid/high-end, 16:9 · 19.5:9 · 20:9 · tablets

## 6. Known scope (vertical slice)
Playable: 1-1. Levels 1-2 → 5-5 are catalogued and unlock logic is live, but content is
"In production" and routed to level select. Enemy framework includes Ash Grunt and Ash Beast;
Shieldbearer/Flame Mage/Boss extend `Enemy` in `enemies.ts`.
