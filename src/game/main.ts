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
import { areEraConditionsMet } from './data/eras.js';
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

import { GameShell } from './ui/game-shell.js';

// ─── Bootstrap ──────────────────────────────────────────────────────────────

const container = document.querySelector<HTMLElement>('#app')!;
container.innerHTML = '';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

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

// ─── Build Queue & Morale (harder difficulty) ───────────────────────────────

interface BuildOrder {
  action: { type: string; payload: Record<string, unknown> };
  label: string;
  ticksRemaining: number;
  totalTicks: number;
}

const buildQueue: BuildOrder[] = [];

// Build times (in seconds) per action type — makes the game slower/harder.
const BUILD_TIMES: Record<string, number> = {
  build_power_plant: 8,
  build_solar_panel: 5,
  build_mine: 6,
  build_distribution_network: 12,
  build_weapons_factory: 10,
  build_lab: 10,
  build_orbital_platform: 20,
  upgrade_storage: 6,
};

// Morale: 0-100. Affects production efficiency. Persisted in localStorage.
let morale = 100;
try {
  const savedMorale = localStorage.getItem('shg_morale');
  if (savedMorale) morale = parseFloat(savedMorale);
} catch { /* ignore */ }

function getBuildLabel(type: string): string {
  const labels: Record<string, string> = {
    build_power_plant: 'Power Plant',
    build_solar_panel: 'Solar Panel',
    build_mine: 'Mine',
    build_distribution_network: 'Distribution Network',
    build_weapons_factory: 'Weapons Factory',
    build_lab: 'Research Lab',
    build_orbital_platform: 'Orbital Platform',
    upgrade_storage: 'Storage Upgrade',
  };
  return labels[type] ?? type;
}

// Wire action handler.
shell.setActionHandler((action) => {
  if (!gameLoop) return;

  // Special actions handled directly (not by game systems).
  if (action.type === 'advance_era') {
    handleAdvanceEra(gameLoop);
    shell.render(gameLoop.getState());
    return;
  }

  // Buildable actions go through the build queue (build time).
  if (action.type in BUILD_TIMES) {
    const state = gameLoop.getState();
    const cost = (action.payload.cost as number) ?? 0;
    // Validate currency upfront (deduct on queue, build completes later).
    if (cost > 0 && state.resources.currency < cost) {
      shell.notify('Not enough currency!', 'error');
      return;
    }
    // Limit queue size for difficulty (can't spam-build).
    if (buildQueue.length >= 3) {
      shell.notify('Build queue full (max 3). Wait for completion.', 'warning');
      return;
    }
    // Deduct cost immediately.
    if (cost > 0) {
      gameLoop.setState(applyUpdate(state, {
        resources: { currency: state.resources.currency - cost },
      }));
    }
    const buildTime = BUILD_TIMES[action.type];
    buildQueue.push({
      action,
      label: getBuildLabel(action.type),
      ticksRemaining: buildTime,
      totalTicks: buildTime,
    });
    shell.notify(`${getBuildLabel(action.type)} construction started (${buildTime}s)`, 'info');
    shell.setBuildQueue(buildQueue);
    shell.render(gameLoop.getState());
    return;
  }

  const state = gameLoop.getState();
  for (const system of gameSystems) {
    if (system.canPerform(state, { type: action.type, payload: action.payload })) {
      const update = system.perform(state, { type: action.type, payload: action.payload });
      if (update && (update.mutations || update.resources || update.materials || update.events)) {
        const newState = applyUpdate(state, update);
        gameLoop.setState(newState);
        if (update.events) {
          eventController.enqueue(update.events);
          eventController.dispatch();
        }
        shell.render(gameLoop.getState());
        break;
      }
    }
  }
});

/** Complete a build order by running the action (cost already deducted). */
function completeBuild(loop: GameLoop, order: BuildOrder): void {
  const state = loop.getState();
  const payloadNoCost = { ...order.action.payload, cost: 0 };

  // Lab and storage are special.
  if (order.action.type === 'build_lab') {
    loop.setState(applyUpdate(state, {
      mutations: [{ path: 'statistics.totalResearchCompleted', value: state.statistics.totalResearchCompleted + 1 }],
    }));
    return;
  }
  if (order.action.type === 'upgrade_storage') {
    loop.setState(applyUpdate(state, {
      mutations: [{ path: 'energy.maxStorage', value: state.energy.maxStorage + 200 }],
    }));
    return;
  }

  for (const system of gameSystems) {
    if (system.canPerform(state, { type: order.action.type, payload: payloadNoCost })) {
      const update = system.perform(state, { type: order.action.type, payload: payloadNoCost });
      if (update) {
        loop.setState(applyUpdate(state, update));
        if (update.events) {
          eventController.enqueue(update.events);
          eventController.dispatch();
        }
      }
      break;
    }
  }
}

// ─── Start Game ─────────────────────────────────────────────────────────────

function startGame(country: CountryId): void {
  let state: GameState | null = SaveSystem.load();
  if (!state || state.country !== country) {
    state = createInitialState(country);
  }

  const loop = new GameLoop(state);
  gameLoop = loop;

  for (const system of gameSystems) {
    loop.registerSystem(system);
  }

  // Render at 1fps for HUD updates (panels re-render on action, not on tick).
  let lastRender = 0;
  loop.setRenderCallback((currentState) => {
    const now = performance.now();
    if (now - lastRender < 1000) return;
    lastRender = now;

    // ── Process build queue (1 second per render tick) ──
    if (buildQueue.length > 0) {
      const order = buildQueue[0];
      order.ticksRemaining -= 1;
      if (order.ticksRemaining <= 0) {
        completeBuild(loop, order);
        buildQueue.shift();
        shell.notify(`${order.label} construction complete!`, 'success');
        currentState = loop.getState();
      }
      shell.setBuildQueue(buildQueue);
    }

    // ── Labs generate knowledge (reduced by low morale) ──
    const labCount = currentState.statistics.totalResearchCompleted;
    if (labCount > 0) {
      const moraleMultiplier = 0.4 + (morale / 100) * 0.6; // 40%-100%
      const knowledgeGain = labCount * 2 * moraleMultiplier;
      const updated = applyUpdate(currentState, {
        resources: { knowledgePoints: currentState.resources.knowledgePoints + knowledgeGain },
      });
      loop.setState(updated);
      currentState = updated;
    }

    // ── Weapons factories consume energy (HARDER: 12/tick instead of 5) ──
    const weaponFactoryCount = currentState.weapons.factories.length;
    if (weaponFactoryCount > 0) {
      const energyDrain = weaponFactoryCount * 12;
      const newStored = Math.max(0, currentState.energy.stored - energyDrain);
      const updated = applyUpdate(currentState, {
        mutations: [{ path: 'energy.stored', value: newStored }],
      });
      loop.setState(updated);
      currentState = updated;
    }

    // ── Morale dynamics (HARDER difficulty) ──
    updateMorale(currentState);

    // ── Income penalty when morale is low ──
    if (morale < 50 && currentState.resources.currency > 0) {
      const penalty = currentState.resources.currency * 0.002 * (1 - morale / 100);
      const updated = applyUpdate(currentState, {
        resources: { currency: Math.max(0, currentState.resources.currency - penalty) },
      });
      loop.setState(updated);
      currentState = updated;
    }

    shell.setMorale(morale);
    shell.render(currentState);
  });

  loop.calculateOfflineEarnings();
  loop.start();
  shell.render(loop.getState());
  shell.startTutorial();
}

// ─── Morale Dynamics ─────────────────────────────────────────────────────────

/**
 * Morale rises with public approval and energy surplus, falls with nuclear
 * plants, low approval, UN hostility, and zero/low currency. Persisted.
 */
function updateMorale(state: GameState): void {
  let delta = 0;

  // Public approval pulls morale toward it.
  delta += (state.opposition.publicApproval - 50) * 0.02;

  // Nuclear plants hurt morale.
  const nuclearPlants = state.energy.powerPlants.filter((p) => p.type === 'nuclear').length;
  delta -= nuclearPlants * 0.15;

  // UN hostility hurts morale.
  delta -= state.opposition.unHostility * 0.01;

  // Energy shortage (stored near zero) hurts morale.
  if (state.energy.stored < state.energy.maxStorage * 0.1) {
    delta -= 0.5;
  }

  // Broke = morale tanks.
  if (state.resources.currency < 100) {
    delta -= 1.0;
  }

  // Net positive income helps slightly.
  if (state.resources.incomeRate > state.resources.expenseRate) {
    delta += 0.1;
  }

  morale = Math.max(0, Math.min(100, morale + delta));
  try { localStorage.setItem('shg_morale', morale.toFixed(1)); } catch { /* ignore */ }
}

// ─── Era Progression ────────────────────────────────────────────────────────

// Era advancement costs — HARDER (roughly 2x previous values + morale requirement).
const ERA_COSTS: Record<string, { currency: number; knowledge: number; steel: number; energy: number }> = {
  nuclear: { currency: 12000, knowledge: 400, steel: 120, energy: 4000 },
  solar: { currency: 35000, knowledge: 1200, steel: 350, energy: 12000 },
  orbital: { currency: 120000, knowledge: 3500, steel: 1200, energy: 35000 },
  mars_colonization: { currency: 350000, knowledge: 12000, steel: 5000, energy: 120000 },
  space_mining: { currency: 1200000, knowledge: 35000, steel: 18000, energy: 350000 },
  dyson_ring: { currency: 5000000, knowledge: 120000, steel: 70000, energy: 1200000 },
};

export function getNextEraCost(state: GameState) {
  const currentIndex = ERA_ORDER.indexOf(state.currentEra);
  if (currentIndex >= ERA_ORDER.length - 1) return null;
  const nextEra = ERA_ORDER[currentIndex + 1];
  const cost = ERA_COSTS[nextEra];
  if (!cost) return null;
  return { era: nextEra, ...cost };
}

export function canAdvanceEra(state: GameState): boolean {
  const cost = getNextEraCost(state);
  if (!cost) return false;
  return (
    state.resources.currency >= cost.currency &&
    state.resources.knowledgePoints >= cost.knowledge &&
    (state.materials.stockpiles.steel ?? 0) >= cost.steel &&
    state.energy.stored >= cost.energy &&
    morale >= 40 // HARDER: need decent morale to advance
  );
}

function handleAdvanceEra(loop: GameLoop): void {
  const state = loop.getState();
  const cost = getNextEraCost(state);
  if (!cost || !canAdvanceEra(state)) return;

  // Deduct resources.
  const update = applyUpdate(state, {
    resources: {
      currency: state.resources.currency - cost.currency,
      knowledgePoints: state.resources.knowledgePoints - cost.knowledge,
    },
    materials: {
      stockpiles: {
        ...state.materials.stockpiles,
        steel: (state.materials.stockpiles.steel ?? 0) - cost.steel,
      },
    },
    mutations: [
      { path: 'energy.stored', value: state.energy.stored - cost.energy },
      { path: 'eraProgress.' + state.currentEra, value: 100 },
    ],
  });

  // Advance era.
  const advanced = advanceEra(update);
  loop.setState(advanced);
  eventController.enqueue([{
    id: `era_unlock_${advanced.currentEra}_${Date.now()}`,
    type: 'era_unlock',
    payload: { era: advanced.currentEra },
    timestamp: Date.now(),
  }]);
  eventController.dispatch();
}

// ─── Launch ─────────────────────────────────────────────────────────────────

// Global error handler: if anything crashes, show a recovery screen instead
// of a blank page (common cause: incompatible old save in localStorage).
function showCrashScreen(message: string): void {
  container.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:16px;background:#0f172a;
      color:#f8fafc;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:24px;">⚠️ Something went wrong</h1>
      <p style="color:#cbd5e1;max-width:480px;">${message}</p>
      <p style="color:#94a3b8;font-size:13px;">This is often caused by an old save from a previous version.</p>
      <button id="crash-reset" style="background:#fbbf24;color:#0f172a;border:none;
        padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
        🔄 Reset & Restart
      </button>
    </div>
  `;
  const btn = document.getElementById('crash-reset');
  btn?.addEventListener('click', () => {
    try { localStorage.clear(); } catch { /* ignore */ }
    window.location.reload();
  });
}

window.addEventListener('error', (e) => {
  showCrashScreen(String(e.message ?? 'Unknown error'));
});
window.addEventListener('unhandledrejection', (e) => {
  showCrashScreen(String(e.reason ?? 'Unknown error'));
});

try {
  // Validate saved game; if it's malformed, discard it and start fresh.
  let saved: GameState | null = null;
  try {
    saved = SaveSystem.load();
    // Sanity check: ensure all critical fields exist (guards old saves).
    if (saved && (!saved.alien || !saved.weapons || !saved.energy || !saved.resources || !saved.country)) {
      console.warn('[main] Saved game missing fields, discarding.');
      saved = null;
    }
  } catch (err) {
    console.warn('[main] Failed to load save, starting fresh:', err);
    saved = null;
  }

  if (saved) {
    startGame(saved.country);
  } else {
    shell.showCountrySelection((country) => {
      startGame(country);
    });
  }
} catch (err) {
  showCrashScreen(err instanceof Error ? err.message : String(err));
}
