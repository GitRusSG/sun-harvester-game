/**
 * Sun Harvester — Game entry point.
 * Uses GameShell (3D solar system as main view, slide-in panels on click).
 */
import './ui/game-shell.css';

import type { CountryId, GameState, GameSystem } from './core/types.js';
import { GameLoop } from './core/game-loop.js';
import { EventController } from './core/event-controller.js';
import { SaveSystem } from './core/save-system.js';
import { createInitialState, advanceEra, applyUpdate } from './core/state-manager.js';
import { ERA_ORDER } from './core/state-manager.js';

import { WeatherSystem } from './systems/weather-system.js';
import { ResourceSystem } from './systems/resource-system.js';
import { SupplyChainSystem } from './systems/supply-chain-system.js';
import { TechSystem } from './systems/tech-system.js';
import { WeaponsSystem } from './systems/weapons-system.js';
import { PoliticalSystem } from './systems/political-system.js';
import { OppositionSystem } from './systems/opposition-system.js';
import { AlienSystem } from './systems/alien-system.js';
import { SpaceSystem } from './systems/space-system.js';
import { MarsSystem } from './systems/mars-system.js';
import { DysonSystem } from './systems/dyson-system.js';
import { EducationSystem } from './systems/education-system.js';
import { IMMUNE_COUNTRIES } from './data/countries.js';
import {
  isInfiniteUnlocked,
  MAX_QUEUE_SIZE,
  MAX_BUILD_SPEED,
  MAX_KNOWLEDGE_SPEED,
  MAX_RESEARCH_SPEED,
  MAX_PROTEST_SUPPRESSION,
  MAX_MORALE_RETAINMENT,
  PAYOFF_PROTESTERS_BASE_COST,
  INSTANT_BUILD_TICKS,
  INFINITE_QUEUE_SIZE,
  TIMEWARP_COST,
  TIMEWARP_SPEED,
} from './data/commands.js';

import { GameShell } from './ui/game-shell.js';
import { formatNumber } from './utils/format.js';

// ─── Crash Handler (registered FIRST) ──────────────────────────────────────

const container = document.querySelector<HTMLElement>('#app')!;
container.innerHTML = '';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

function showCrashScreen(message: string): void {
  document.body.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:16px;background:#0f172a;
      color:#f8fafc;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:24px;">⚠️ Something went wrong</h1>
      <p style="color:#cbd5e1;max-width:480px;word-break:break-word;">${message}</p>
      <button onclick="try{localStorage.clear()}catch(e){};location.reload()" style="background:#fbbf24;color:#0f172a;border:none;
        padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
        🔄 Reset & Restart
      </button>
    </div>`;
}

window.addEventListener('error', (e) => showCrashScreen(e.message ?? 'Unknown error'));
window.addEventListener('unhandledrejection', (e) => showCrashScreen(String(e.reason ?? 'Unknown error')));

// ─── Main Game Init (wrapped in try/catch) ──────────────────────────────────

try {
  boot();
} catch (err) {
  showCrashScreen(err instanceof Error ? err.message : String(err));
}

function boot(): void {
  const shell = new GameShell(container);
  const eventController = new EventController();

  const gameSystems: GameSystem[] = [
    new WeatherSystem(),
    new ResourceSystem(),
    new SupplyChainSystem(),
    new TechSystem(),
    new WeaponsSystem(),
    new PoliticalSystem(),
    new OppositionSystem(),
    new AlienSystem(),
    new SpaceSystem(),
    new MarsSystem(),
    new DysonSystem(),
    new EducationSystem(),
  ];

  let gameLoop: GameLoop | null = null;
  let simulationIntervalId: ReturnType<typeof setInterval> | null = null;
  let morale = 75;
  let quizTickCounter = 0;
  let maxQueueSize = 6;
  let buildSpeedMultiplier = 1.0;
  let knowledgeSpeedMultiplier = 1.0;
  let researchSpeedMultiplier = 1.0;
  let protestSuppressionLevel = 0;
  let autoMoraleEnabled = false;
  let autoMoraleThreshold = 50;
  let timewarpUnlocked = false;
  let timewarpActive = false;
  let moraleRetainmentLevel = 0; // reduces morale decay per level
  try { const m = localStorage.getItem('shg_morale'); if (m) morale = parseFloat(m); } catch { /* */ }
  try { const q = localStorage.getItem('shg_queue_max'); if (q) maxQueueSize = parseInt(q); } catch { /* */ }
  try { const s = localStorage.getItem('shg_build_speed'); if (s) buildSpeedMultiplier = parseFloat(s); } catch { /* */ }
  try { const k = localStorage.getItem('shg_knowledge_speed'); if (k) knowledgeSpeedMultiplier = parseFloat(k); } catch { /* */ }
  try { const r = localStorage.getItem('shg_research_speed'); if (r) researchSpeedMultiplier = parseFloat(r); } catch { /* */ }
  try { const p = localStorage.getItem('shg_protest_suppress'); if (p) protestSuppressionLevel = parseInt(p); } catch { /* */ }
  try { const a = localStorage.getItem('shg_auto_morale'); if (a) { autoMoraleEnabled = a === '1'; } } catch { /* */ }
  try { const t = localStorage.getItem('shg_auto_morale_threshold'); if (t) autoMoraleThreshold = parseInt(t); } catch { /* */ }
  try { const tw = localStorage.getItem('shg_timewarp_unlocked'); if (tw) timewarpUnlocked = tw === '1'; } catch { /* */ }
  try { const ta = localStorage.getItem('shg_timewarp_active'); if (ta) timewarpActive = ta === '1'; } catch { /* */ }
  try { const mr = localStorage.getItem('shg_morale_retain'); if (mr) moraleRetainmentLevel = parseInt(mr); } catch { /* */ }

  // ─── Build Queue ────────────────────────────────────────────────────────

  interface BuildOrder {
    action: { type: string; payload: Record<string, unknown> };
    label: string;
    ticksRemaining: number;
    totalTicks: number;
  }

  const buildQueue: BuildOrder[] = [];

  const BUILD_TIMES: Record<string, number> = {
    build_power_plant: 30,
    build_solar_panel: 20,
    build_mine: 25,
    build_distribution_network: 45,
    build_weapons_factory: 40,
    build_military_unit: 25,
    build_lab: 35,
    build_orbital_platform: 75,
    upgrade_storage: 20,
  };

  function getBuildLabel(type: string): string {
    const labels: Record<string, string> = {
      build_power_plant: 'Power Plant', build_solar_panel: 'Solar Panel',
      build_mine: 'Mine', build_distribution_network: 'Distribution',
      build_weapons_factory: 'Weapons Factory', build_military_unit: 'Military Unit',
      build_lab: 'Lab',
      build_orbital_platform: 'Orbital Platform', upgrade_storage: 'Storage',
    };
    return labels[type] ?? type;
  }

  // ─── Era Costs ──────────────────────────────────────────────────────────

  const ERA_COSTS: Record<string, { currency: number; knowledge: number; steel: number; energy: number }> = {
    nuclear: { currency: 25000, knowledge: 800, steel: 250, energy: 8000 },
    solar: { currency: 80000, knowledge: 3000, steel: 800, energy: 25000 },
    orbital: { currency: 300000, knowledge: 10000, steel: 3000, energy: 80000 },
    mars_colonization: { currency: 900000, knowledge: 30000, steel: 12000, energy: 250000 },
    space_mining: { currency: 3000000, knowledge: 80000, steel: 40000, energy: 800000 },
    dyson_ring: { currency: 12000000, knowledge: 300000, steel: 150000, energy: 3000000 },
  };

  function canAdvanceEra(state: GameState): boolean {
    const idx = ERA_ORDER.indexOf(state.currentEra);
    if (idx >= ERA_ORDER.length - 1) return false;
    const cost = ERA_COSTS[ERA_ORDER[idx + 1]];
    if (!cost) return false;
    return state.resources.currency >= cost.currency &&
      state.resources.knowledgePoints >= cost.knowledge &&
      (state.materials.stockpiles.steel ?? 0) >= cost.steel &&
      state.energy.stored >= cost.energy && morale >= 40;
  }

  function handleAdvanceEra(loop: GameLoop): void {
    const state = loop.getState();
    if (!canAdvanceEra(state)) return;
    const idx = ERA_ORDER.indexOf(state.currentEra);
    const nextEra = ERA_ORDER[idx + 1];
    const cost = ERA_COSTS[nextEra];
    const updated = applyUpdate(state, {
      resources: { currency: state.resources.currency - cost.currency, knowledgePoints: state.resources.knowledgePoints - cost.knowledge },
      materials: { stockpiles: { ...state.materials.stockpiles, steel: (state.materials.stockpiles.steel ?? 0) - cost.steel } },
      mutations: [{ path: 'energy.stored', value: state.energy.stored - cost.energy }, { path: `eraProgress.${state.currentEra}`, value: 100 }],
    });
    const advanced = advanceEra(updated);
    loop.setState(advanced);

    // Auto-unlock systems tied to specific eras.
    let postAdvance = advanced;
    if (postAdvance.currentEra === 'mars_colonization' && !postAdvance.mars.unlocked) {
      postAdvance = applyUpdate(postAdvance, { mutations: [
        { path: 'mars.unlocked', value: true },
        { path: 'mars.baseLevel', value: 1 },
      ] });
      loop.setState(postAdvance);
    }
    if (postAdvance.currentEra === 'space_mining' && !postAdvance.space.unlocked) {
      postAdvance = applyUpdate(postAdvance, { mutations: [
        { path: 'space.unlocked', value: true },
        { path: 'space.maxTerritories', value: 3 },
      ] });
      loop.setState(postAdvance);
    }
    if (postAdvance.currentEra === 'dyson_ring' && !postAdvance.dyson.unlocked) {
      postAdvance = applyUpdate(postAdvance, { mutations: [
        { path: 'dyson.unlocked', value: true },
      ] });
      loop.setState(postAdvance);
    }

    eventController.enqueue([{ id: `era_${Date.now()}`, type: 'era_unlock', payload: { era: postAdvance.currentEra }, timestamp: Date.now() }]);
    eventController.dispatch();
    shell.celebrate();
    shell.notify(`🎉 Advanced to the ${postAdvance.currentEra.replace('_', ' ')} era!`, 'success');
    // Force an immediate HUD + panel refresh so the era label updates at once.
    shell.render(postAdvance);
    shell.refreshActivePanel();
  }

  function completeBuild(loop: GameLoop, order: BuildOrder): void {
    const state = loop.getState();
    const payload = { ...order.action.payload, cost: 0 };
    if (order.action.type === 'build_lab') {
      loop.setState(applyUpdate(state, { mutations: [{ path: 'statistics.totalResearchCompleted', value: state.statistics.totalResearchCompleted + 1 }] }));
      return;
    }
    if (order.action.type === 'upgrade_storage') {
      const amount = (order.action.payload.amount as number) ?? 200;
      loop.setState(applyUpdate(state, { mutations: [{ path: 'energy.maxStorage', value: state.energy.maxStorage + amount }] }));
      return;
    }
    // Military units (era-gated) just grant a flat power bonus — no factory.
    if (order.action.type === 'build_military_unit') {
      const producing = (order.action.payload.producing as string) ?? 'conventional';
      const UNIT_POWER: Record<string, number> = {
        missile: 15, cyber: 10, energy: 25, orbital: 40,
      };
      const bonus = UNIT_POWER[producing] ?? 5;
      loop.setState(applyUpdate(state, {
        mutations: [{ path: 'weapons.militaryPower', value: state.weapons.militaryPower + bonus }],
      }));
      return;
    }
    // Era-gated weapon tiers grant a flat power bonus directly (era is the gate,
    // not the weapons tech tree), since the UI only offers them in the right era.
    const WEAPON_POWER: Record<string, number> = {
      conventional: 5, missile: 15, cyber: 10, energy: 25, orbital: 40,
    };
    if (order.action.type === 'build_weapons_factory') {
      const producing = (order.action.payload.producing as string) ?? 'conventional';
      const bonus = WEAPON_POWER[producing] ?? 5;
      // Try the weapons system first (creates a real factory if unlocked)...
      let newState = state;
      for (const system of gameSystems) {
        if (system.canPerform(state, { type: order.action.type, payload })) {
          const update = system.perform(state, { type: order.action.type, payload });
          if (update) newState = applyUpdate(state, update);
          break;
        }
      }
      // ...then always grant the power bonus so the build has an effect.
      newState = applyUpdate(newState, {
        mutations: [{ path: 'weapons.militaryPower', value: newState.weapons.militaryPower + bonus }],
      });
      loop.setState(newState);
      return;
    }

    for (const system of gameSystems) {
      if (system.canPerform(state, { type: order.action.type, payload })) {
        const update = system.perform(state, { type: order.action.type, payload });
        if (update) {
          loop.setState(applyUpdate(state, update));
        }
        break;
      }
    }
  }

  // ─── Event Notifications ────────────────────────────────────────────────

  eventController.subscribe((event) => {
    // Quiz result feedback.
    if (event.type === 'quiz' && event.payload.subType === 'quiz_result') {
      if (event.payload.correct) {
        shell.notify(`✅ Correct! +${event.payload.reward} knowledge points`, 'success');
      } else {
        shell.notify(`❌ Wrong. ${event.payload.explanation ?? ''}`, 'error');
      }
      return;
    }
    const msgs: Record<string, string> = {
      era_unlock: `New era: ${event.payload.era}`,
      research_complete: `Research done: ${event.payload.nodeId}`,
      crafting_complete: `Crafted: ${event.payload.recipeName}`,
      victory: '🏆 Dyson Ring complete!',
      un_attack: `🌐 UN attack: ${event.payload.attackType}${event.payload.severity ? ` (severity ${Number(event.payload.severity).toFixed(1)})` : ''}`,
      protest: `✊ Protest: ${event.payload.cause} — construction slowed`,
      alien_signal: 'Alien signal detected!',
      politician_installed: `🎩 Politician installed in ${event.payload.country}`,
      coup: `💥 Coup! Lost control of ${event.payload.country}`,
    };
    const type = event.type === 'un_attack' ? 'error' : event.type === 'protest' || event.type === 'coup' ? 'warning' : 'info';
    if (msgs[event.type]) shell.notify(msgs[event.type], type);
  });

  // ─── Action Handler ─────────────────────────────────────────────────────

  shell.setActionHandler((action) => {
    if (!gameLoop) return;

    if (action.type === 'advance_era') {
      handleAdvanceEra(gameLoop);
      shell.render(gameLoop.getState());
      return;
    }

    // ─── Restart Game (show country selection) ──────────────────────────
    if (action.type === 'restart_game') {
      // Stop the loop FIRST (its final save would otherwise re-write old state),
      // THEN clear storage so nothing is left behind.
      if (simulationIntervalId !== null) { clearInterval(simulationIntervalId); simulationIntervalId = null; }
      if (gameLoop) { gameLoop.stop(); gameLoop = null; }
      try {
        localStorage.removeItem('shg_save');
        localStorage.removeItem('shg_morale');
        localStorage.removeItem('shg_tutorial_done');
        localStorage.clear();
      } catch { /* */ }
      morale = 100;
      maxQueueSize = 6;
      buildSpeedMultiplier = 1.0;
      knowledgeSpeedMultiplier = 1.0;
      researchSpeedMultiplier = 1.0;
      protestSuppressionLevel = 0;
      autoMoraleEnabled = false;
      autoMoraleThreshold = 50;
      timewarpUnlocked = false;
      timewarpActive = false;
      moraleRetainmentLevel = 0;
      buildQueue.length = 0;
      shell.setBuildQueue(buildQueue);
      shell.setMorale(morale);
      shell.showCountrySelection((country) => startGame(country));
      return;
    }

    // ─── Country Attack (luck + quantity combat) ────────────────────────
    if (action.type === 'attack_country') {
      const state = gameLoop.getState();
      const targetCountry = action.payload.country as CountryId;

      if (IMMUNE_COUNTRIES.has(targetCountry)) {
        shell.notify(`🚫 ${targetCountry.replace('_', ' ')} cannot be attacked.`, 'error');
        return;
      }

      const baseGarrison = (action.payload.garrison as number) ?? 10;
      // Garrisons are far tougher now — defenders dig in (×4) and get a home
      // advantage, so conquest requires a real military buildup.
      const garrison = baseGarrison * 4;
      const attackPower = state.weapons.militaryPower;

      if (attackPower < 10) { shell.notify('Need at least 10 military power!', 'error'); return; }

      // Luck factor: attacker 0.6–1.2, defender 0.8–1.5 (home advantage).
      const attackLuck = 0.6 + Math.random() * 0.6;
      const defenseLuck = 0.8 + Math.random() * 0.7;
      const attackStrength = attackPower * attackLuck;
      const defenseStrength = garrison * defenseLuck;
      const won = attackStrength > defenseStrength;

      // Attacking always costs you troops, win or lose.
      const baseLoss = garrison * 0.4;

      const playerName = state.countryProfile?.name ?? 'You';
      const defName = targetCountry.replace('_', ' ');

      // Play the battle animation, then apply the outcome.
      void shell.showBattle(playerName, defName, won).then(() => {
        const s = gameLoop!.getState();
        if (won) {
          const influence = { ...s.political.influence, [targetCountry]: 100 };
          const installed = [...s.political.installedPoliticians];
          if (!installed.includes(targetCountry)) installed.push(targetCountry);
          gameLoop!.setState(applyUpdate(s, {
            mutations: [
              { path: 'political.influence', value: influence },
              { path: 'political.installedPoliticians', value: installed },
              { path: 'weapons.militaryPower', value: Math.max(0, s.weapons.militaryPower - baseLoss) },
            ],
          }));
          shell.celebrate();
          shell.notify(`⚔️ Victory! You conquered ${defName}! (${attackStrength.toFixed(0)} vs ${defenseStrength.toFixed(0)}) — lost ${baseLoss.toFixed(0)} power`, 'success');
        } else {
          const loss = Math.min(s.weapons.militaryPower, garrison * 0.7);
          gameLoop!.setState(applyUpdate(s, {
            mutations: [{ path: 'weapons.militaryPower', value: Math.max(0, s.weapons.militaryPower - loss) }],
          }));
          shell.notify(`💀 Defeat! Their garrison held. Lost ${loss.toFixed(0)} military power. (${attackStrength.toFixed(0)} vs ${defenseStrength.toFixed(0)})`, 'error');
        }
        shell.render(gameLoop!.getState());
      });
      return;
    }

    // ─── Produce Rifles (instant, consumes steel) ───────────────────────
    if (action.type === 'produce_rifles') {
      const state = gameLoop.getState();
      const steel = state.materials.stockpiles.steel ?? 0;
      if (steel < 1) { shell.notify('Need 1 steel to produce rifles!', 'error'); return; }
      const newConventional = (state.weapons.arsenal.conventional ?? 0) + 1;
      const updated = applyUpdate(state, {
        materials: { stockpiles: { ...state.materials.stockpiles, steel: steel - 1 } },
        mutations: [
          { path: 'weapons.arsenal.conventional', value: newConventional },
          { path: 'weapons.militaryPower', value: state.weapons.militaryPower + 1 },
        ],
      });
      gameLoop.setState(updated);
      shell.notify('🔫 Produced rifles! +1 military power', 'success');
      shell.render(gameLoop.getState());
      return;
    }

    // ─── Market Sell ────────────────────────────────────────────────────
    if (action.type === 'market_sell') {
      const state = gameLoop.getState();
      const material = action.payload.material as string;
      const quantity = action.payload.quantity as number;
      const currentQty = (state.materials.stockpiles as Record<string, number>)[material] ?? 0;
      if (quantity <= 0 || currentQty < quantity) { shell.notify('Not enough material!', 'error'); return; }
      const PRICES: Record<string, number> = {
        coal: 5, iron_ore: 8, steel: 25, silicon: 12, solar_cells: 40,
        copper: 10, electronics: 50, uranium: 80, fuel_rods: 120,
        rare_earth: 100, advanced_circuits: 200, fuel: 15,
        regolith_iron: 30, martian_ice: 20, co2: 10,
      };
      const price = PRICES[material] ?? 10;
      const revenue = price * quantity;
      const newStockpiles = { ...state.materials.stockpiles, [material]: currentQty - quantity };
      gameLoop.setState(applyUpdate(state, {
        resources: { currency: state.resources.currency + revenue },
        materials: { stockpiles: newStockpiles },
      }));
      shell.notify(`💰 Sold ${quantity} ${material.replace('_', ' ')} for $${formatNumber(revenue)}`, 'success');
      shell.render(gameLoop.getState());
      shell.refreshActivePanel();
      return;
    }

    // ─── Custom quantity craft (reads input from DOM) ──────────────────
    if (action.type === 'queue_craft_custom') {
      const recipeId = action.payload.recipeId as string;
      const input = document.querySelector<HTMLInputElement>(`.gs-craft-input[data-recipe="${recipeId}"]`);
      const qty = Math.max(1, Math.min(999, parseInt(input?.value ?? '1') || 1));
      // Redirect to the standard queue_craft flow.
      shell.setActionHandler && void 0; // no-op, just dispatching below
      const state = gameLoop.getState();
      for (const system of gameSystems) {
        if (system.canPerform(state, { type: 'queue_craft', payload: { recipeId, quantity: qty } })) {
          const update = system.perform(state, { type: 'queue_craft', payload: { recipeId, quantity: qty } });
          if (update && (update.mutations || update.resources || update.materials || update.events)) {
            gameLoop.setState(applyUpdate(state, update));
            if (update.events) { eventController.enqueue(update.events); eventController.dispatch(); }
            shell.notify(`⚒️ Queued ×${qty} ${recipeId}`, 'success');
            shell.render(gameLoop.getState());
            break;
          }
        }
      }
      return;
    }

    // ─── Auto-fix for Mars/Space unlock on existing saves ────────────────
    if (action.type === 'fix_mars_unlock') {
      const state = gameLoop.getState();
      if (!state.mars.unlocked) {
        gameLoop.setState(applyUpdate(state, { mutations: [
          { path: 'mars.unlocked', value: true },
          { path: 'mars.baseLevel', value: 1 },
        ] }));
      }
      return;
    }

    // ─── Upgrades ───────────────────────────────────────────────────────
    if (action.type === 'upgrade_buy') {
      const state = gameLoop.getState();
      const kind = action.payload.kind as string;
      const cost = (action.payload.cost as number) ?? 0;
      if (state.resources.currency < cost) { shell.notify('Not enough currency!', 'error'); return; }
      let upd = applyUpdate(state, { resources: { currency: state.resources.currency - cost } });
      switch (kind) {
        case 'storage':
          upd = applyUpdate(upd, { mutations: [{ path: 'energy.maxStorage', value: upd.energy.maxStorage + 500 }] });
          shell.notify('🔋 Grid expanded! +500 storage', 'success');
          break;
        case 'solar_eff': {
          const panels = upd.energy.solarPanels.map((p) => ({ ...p, efficiency: p.efficiency * 1.1 }));
          upd = applyUpdate(upd, { mutations: [{ path: 'energy.solarPanels', value: panels }] });
          shell.notify('☀️ Solar efficiency +10%', 'success');
          break;
        }
        case 'military':
          upd = applyUpdate(upd, { mutations: [{ path: 'weapons.militaryPower', value: upd.weapons.militaryPower + 20 }] });
          shell.notify('🎖️ Military power +20', 'success');
          break;
        case 'knowledge':
          upd = applyUpdate(upd, { resources: { knowledgePoints: upd.resources.knowledgePoints + 500 } });
          shell.notify('📚 +500 knowledge points', 'success');
          break;
        case 'queue_size':
          if (maxQueueSize >= MAX_QUEUE_SIZE) { shell.notify('Queue size maxed out!', 'warning'); break; }
          maxQueueSize = Math.min(MAX_QUEUE_SIZE, maxQueueSize + 2);
          try { localStorage.setItem('shg_queue_max', String(maxQueueSize)); } catch { /* */ }
          shell.notify(`📦 Queue expanded! Now holds ${maxQueueSize}`, 'success');
          break;
        case 'build_speed':
          if (buildSpeedMultiplier >= MAX_BUILD_SPEED) { shell.notify('Build speed maxed out!', 'warning'); break; }
          buildSpeedMultiplier = Math.min(MAX_BUILD_SPEED, buildSpeedMultiplier + 0.25);
          try { localStorage.setItem('shg_build_speed', buildSpeedMultiplier.toFixed(2)); } catch { /* */ }
          shell.notify(`⚡ Build speed ×${buildSpeedMultiplier.toFixed(2)}!`, 'success');
          break;
        case 'knowledge_speed':
          if (knowledgeSpeedMultiplier >= MAX_KNOWLEDGE_SPEED) { shell.notify('Knowledge speed maxed out!', 'warning'); break; }
          knowledgeSpeedMultiplier = Math.min(MAX_KNOWLEDGE_SPEED, knowledgeSpeedMultiplier + 0.5);
          try { localStorage.setItem('shg_knowledge_speed', knowledgeSpeedMultiplier.toFixed(2)); } catch { /* */ }
          shell.notify(`🧠 Knowledge speed ×${knowledgeSpeedMultiplier.toFixed(1)}!`, 'success');
          break;
        case 'research_speed':
          if (researchSpeedMultiplier >= MAX_RESEARCH_SPEED) { shell.notify('Research speed maxed out!', 'warning'); break; }
          researchSpeedMultiplier = Math.min(MAX_RESEARCH_SPEED, researchSpeedMultiplier + 0.5);
          try { localStorage.setItem('shg_research_speed', researchSpeedMultiplier.toFixed(2)); } catch { /* */ }
          shell.notify(`🔬 Research speed ×${researchSpeedMultiplier.toFixed(1)}!`, 'success');
          break;
        case 'protest_suppress':
          if (protestSuppressionLevel >= MAX_PROTEST_SUPPRESSION) { shell.notify('Protest suppression maxed out!', 'warning'); break; }
          protestSuppressionLevel = Math.min(MAX_PROTEST_SUPPRESSION, protestSuppressionLevel + 1);
          try { localStorage.setItem('shg_protest_suppress', String(protestSuppressionLevel)); } catch { /* */ }
          shell.notify(`🛡️ Protest suppression level ${protestSuppressionLevel}! UN hostility reduced.`, 'success');
          break;
        case 'auto_morale_toggle':
          autoMoraleEnabled = !autoMoraleEnabled;
          try { localStorage.setItem('shg_auto_morale', autoMoraleEnabled ? '1' : '0'); } catch { /* */ }
          shell.notify(autoMoraleEnabled ? '🤖 Auto-morale ON (threshold: ' + autoMoraleThreshold + ')' : '🤖 Auto-morale OFF', 'info');
          break;
        case 'timewarp_buy':
          if (timewarpUnlocked) { shell.notify('Already unlocked! Use the toggle.', 'warning'); break; }
          timewarpUnlocked = true;
          try { localStorage.setItem('shg_timewarp_unlocked', '1'); } catch { /* */ }
          shell.notify('⏩ Time Warp unlocked! Toggle it in Upgrades.', 'success');
          break;
        case 'timewarp_toggle':
          if (!timewarpUnlocked) { shell.notify('Unlock Time Warp first!', 'error'); break; }
          timewarpActive = !timewarpActive;
          try { localStorage.setItem('shg_timewarp_active', timewarpActive ? '1' : '0'); } catch { /* */ }
          shell.notify(timewarpActive ? '⏩ Time Warp ACTIVE! (×' + TIMEWARP_SPEED + ' speed)' : '⏸️ Time Warp OFF', 'info');
          break;
        case 'morale_retainment':
          if (MAX_MORALE_RETAINMENT > 0 && moraleRetainmentLevel >= MAX_MORALE_RETAINMENT) { shell.notify('Morale retainment maxed!', 'warning'); break; }
          moraleRetainmentLevel += 1;
          try { localStorage.setItem('shg_morale_retain', String(moraleRetainmentLevel)); } catch { /* */ }
          shell.notify(`😊 Morale retainment level ${moraleRetainmentLevel}! Decay reduced.`, 'success');
          break;
        case 'payoff_protesters': {
          const hostility = gameLoop.getState().opposition.unHostility;
          const payoffCost = Math.floor(PAYOFF_PROTESTERS_BASE_COST * Math.max(1, hostility / 10));
          if (upd.resources.currency < payoffCost) { shell.notify('Not enough currency!', 'error'); break; }
          upd = applyUpdate(upd, {
            resources: { currency: upd.resources.currency - payoffCost },
            mutations: [{ path: 'opposition.unHostility', value: Math.max(0, hostility - 15) }],
          });
          shell.notify(`💰 Paid off protesters! Hostility -15 (cost $${formatNumber(payoffCost)})`, 'success');
          break;
        }
      }
      gameLoop.setState(upd);
      shell.render(gameLoop.getState());
      shell.refreshActivePanel();
      return;
    }

    // ─── Morale Festival ────────────────────────────────────────────────
    if (action.type === 'morale_festival') {
      const state = gameLoop.getState();
      const cost = (action.payload.cost as number) ?? 2000;
      if (state.resources.currency < cost) { shell.notify('Not enough currency!', 'error'); return; }
      gameLoop.setState(applyUpdate(state, { resources: { currency: state.resources.currency - cost } }));
      morale = Math.min(100, morale + 20);
      try { localStorage.setItem('shg_morale', morale.toFixed(1)); } catch { /* */ }
      shell.setMorale(morale);
      shell.celebrate();
      shell.notify('🎉 Festival! Morale +20', 'success');
      shell.render(gameLoop.getState());
      shell.refreshActivePanel();
      return;
    }

    // Buildable actions go through build queue.
    if (action.type in BUILD_TIMES) {
      const state = gameLoop.getState();
      const cost = (action.payload.cost as number) ?? 0;
      if (cost > 0 && state.resources.currency < cost) { shell.notify('Not enough currency!', 'error'); return; }
      const infinite = isInfiniteUnlocked(state.currentEra);
      const effectiveQueueMax = infinite ? INFINITE_QUEUE_SIZE : maxQueueSize;
      if (buildQueue.length >= effectiveQueueMax) { shell.notify(`Queue full (max ${effectiveQueueMax})`, 'warning'); return; }
      if (cost > 0) gameLoop.setState(applyUpdate(state, { resources: { currency: state.resources.currency - cost } }));
      const buildTime = infinite ? INSTANT_BUILD_TICKS : Math.max(1, Math.round(BUILD_TIMES[action.type] / buildSpeedMultiplier));
      buildQueue.push({ action, label: getBuildLabel(action.type), ticksRemaining: buildTime, totalTicks: buildTime });
      shell.notify(`Building ${getBuildLabel(action.type)} (${buildTime}s)`, 'info');
      shell.setBuildQueue(buildQueue);
      shell.render(gameLoop.getState());
      return;
    }

    // Direct system actions.
    const state = gameLoop.getState();
    for (const system of gameSystems) {
      if (system.canPerform(state, { type: action.type, payload: action.payload })) {
        const update = system.perform(state, { type: action.type, payload: action.payload });
        if (update && (update.mutations || update.resources || update.materials || update.events)) {
          gameLoop.setState(applyUpdate(state, update));
          if (update.events) { eventController.enqueue(update.events); eventController.dispatch(); }
          shell.render(gameLoop.getState());
          break;
        }
      }
    }
  });

  // ─── Start Game ─────────────────────────────────────────────────────────

  function startGame(country: CountryId): void {
    let state: GameState | null = null;
    try { state = SaveSystem.load(); } catch { /* */ }
    if (!state || state.country !== country || !state.alien || !state.weapons) {
      state = createInitialState(country);
    }

    const loop = new GameLoop(state);
    gameLoop = loop;
    if (simulationIntervalId !== null) { clearInterval(simulationIntervalId); simulationIntervalId = null; }
    for (const system of gameSystems) loop.registerSystem(system);

    // Dispatch events produced by system ticks (UN attacks, protests, etc.).
    loop.setEventsCallback((events) => {
      eventController.enqueue(events);
      eventController.dispatch();
    });

    let lastRender = 0;
    // ─── Simulation step (runs on a 1s interval, independent of rendering) ──
    // Keeping this OUT of the render callback ensures the economy, morale,
    // build queue, and quizzes keep advancing even when no menu is open or
    // the tab is backgrounded (requestAnimationFrame throttles; setInterval does not).
    function simulationStep(): void {
      const ticks = timewarpActive ? TIMEWARP_SPEED : 1;
      for (let _t = 0; _t < ticks; _t++) {
        simulationTick();
      }
      shell.render(loop.getState());
    }

    function simulationTick(): void {
      let currentState = loop.getState();

      // Process build queue.
      if (buildQueue.length > 0) {
        buildQueue[0].ticksRemaining -= 1;
        if (buildQueue[0].ticksRemaining <= 0) {
          completeBuild(loop, buildQueue[0]);
          shell.notify(`${buildQueue[0].label} complete!`, 'success');
          buildQueue.shift();
          currentState = loop.getState();
        }
        shell.setBuildQueue(buildQueue);
      }

      // Labs produce knowledge (scaled by morale and knowledge speed upgrades).
      const labs = currentState.statistics.totalResearchCompleted;
      if (labs > 0) {
        const moraleMultiplier = 0.4 + (morale / 100) * 0.6;
        currentState = applyUpdate(currentState, { resources: { knowledgePoints: currentState.resources.knowledgePoints + labs * 2 * moraleMultiplier * knowledgeSpeedMultiplier } });
        loop.setState(currentState);
      }

      // Periodically pop a knowledge quiz (every ~30s) if none is pending.
      quizTickCounter += 1;
      if (quizTickCounter >= 30 && !currentState.education.pendingQuiz) {
        quizTickCounter = 0;
        const eduSystem = gameSystems.find((s) => s.id === 'education') as EducationSystem | undefined;
        if (eduSystem) {
          const topics = ['fossil_fuels', 'solar', 'nuclear', 'materials', 'orbital_mechanics'] as const;
          const topic = topics[Math.floor(Math.random() * topics.length)];
          const update = eduSystem.generateQuiz(currentState, topic);
          if (update) {
            currentState = applyUpdate(currentState, update);
            loop.setState(currentState);
          }
        }
      }

      // Weapons drain energy.
      const wf = currentState.weapons.factories.length;
      if (wf > 0) {
        currentState = applyUpdate(currentState, { mutations: [{ path: 'energy.stored', value: Math.max(0, currentState.energy.stored - wf * 12) }] });
        loop.setState(currentState);
      }

      // Protest suppression — reduces UN hostility over time (each level = -0.5/tick).
      if (protestSuppressionLevel > 0 && currentState.opposition.unHostility > 0) {
        const reduction = protestSuppressionLevel * 0.5;
        const newHostility = Math.max(0, currentState.opposition.unHostility - reduction);
        currentState = applyUpdate(currentState, {
          mutations: [{ path: 'opposition.unHostility', value: newHostility }],
        });
        loop.setState(currentState);
      }

      // Auto-morale — spend currency each tick to maintain morale above threshold.
      if (autoMoraleEnabled && morale < autoMoraleThreshold && currentState.resources.currency > 500) {
        const cost = 200; // flat cost per tick when below threshold
        currentState = applyUpdate(currentState, { resources: { currency: currentState.resources.currency - cost } });
        loop.setState(currentState);
        morale = Math.min(100, morale + 3);
      }

      // Morale dynamics — drifts based on living conditions.
      // BOOSTERS:
      let md = 0;
      md += (currentState.opposition.publicApproval - 45) * 0.025; // approval above 45 helps
      if (currentState.resources.incomeRate > currentState.resources.expenseRate) md += 0.25; // profitable = happy
      if (currentState.energy.stored > currentState.energy.maxStorage * 0.5) md += 0.1; // plenty of energy
      if (currentState.resources.currency > 5000) md += 0.08; // financially secure
      md += currentState.political.installedPoliticians.length * 0.05; // global power pride
      // DRAINS:
      md -= currentState.energy.powerPlants.filter(p => p.type === 'nuclear').length * 0.12;
      md -= currentState.opposition.unHostility * 0.008;
      md -= currentState.weapons.factories.length * 0.05;
      if (currentState.energy.stored < currentState.energy.maxStorage * 0.1) md -= 0.3;
      if (currentState.resources.currency < 100) md -= 0.6;
      md -= 0.02; // very mild constant decay
      // Morale retainment reduces all negative drift
      if (md < 0 && moraleRetainmentLevel > 0) {
        md *= Math.max(0.2, 1 - moraleRetainmentLevel * 0.15); // each level blocks 15% of decay
      }
      morale = Math.max(0, Math.min(100, morale + md));
      try { localStorage.setItem('shg_morale', morale.toFixed(1)); } catch { /* */ }

      // Low morale penalty — economy bleeds when people are unhappy.
      if (morale < 40 && currentState.resources.currency > 0) {
        const pen = currentState.resources.currency * 0.004 * (1 - morale / 100);
        currentState = applyUpdate(currentState, { resources: { currency: Math.max(0, currentState.resources.currency - pen) } });
        loop.setState(currentState);
      }
      // Very low morale — buildings break (random infrastructure damage).
      if (morale < 20 && Math.random() < 0.03) {
        const mines = currentState.infrastructure.mines;
        if (mines.length > 0) {
          const broken = mines.slice(0, -1); // lose a mine
          currentState = applyUpdate(currentState, { mutations: [{ path: 'infrastructure.mines', value: broken }] });
          loop.setState(currentState);
          shell.notify('💥 Low morale! A mine broke down.', 'error');
        }
      }

      // High morale bonus — a happy populace boosts the economy.
      if (morale > 70 && currentState.resources.incomeRate > 0) {
        const bonus = currentState.resources.incomeRate * 0.15 * ((morale - 70) / 30);
        currentState = applyUpdate(currentState, { resources: { currency: currentState.resources.currency + bonus } });
        loop.setState(currentState);
      }

      shell.setMorale(morale);
    }

    // Drive the simulation step every second, independent of the render loop.
    simulationIntervalId = setInterval(simulationStep, 1000);

    // Render callback is now purely visual (HUD/panel refresh on each frame).
    loop.setRenderCallback((currentState) => {
      const now = performance.now();
      if (now - lastRender < 250) return;
      lastRender = now;
      shell.render(currentState);
    });

    try { loop.calculateOfflineEarnings(); } catch { /* */ }
    loop.start();
    shell.render(loop.getState());
    shell.startTutorial();
  }

  // ─── Launch ───────────────────────────────────────────────────────────────

  let saved: GameState | null = null;
  try { saved = SaveSystem.load(); } catch { /* */ }
  if (saved && saved.alien && saved.weapons && saved.country) {
    startGame(saved.country);
  } else {
    shell.showCountrySelection((country) => startGame(country));
  }
}
