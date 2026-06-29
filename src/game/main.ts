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

// Wire action handler.
shell.setActionHandler((action) => {
  if (!gameLoop) return;

  // Special actions handled directly (not by game systems).
  if (action.type === 'advance_era') {
    handleAdvanceEra(gameLoop);
    shell.render(gameLoop.getState());
    return;
  }
  if (action.type === 'upgrade_storage') {
    const state = gameLoop.getState();
    const cost = (action.payload.cost as number) ?? 300;
    if (state.resources.currency < cost) return;
    const newState = applyUpdate(state, {
      resources: { currency: state.resources.currency - cost },
      mutations: [{ path: 'energy.maxStorage', value: state.energy.maxStorage + 200 }],
    });
    gameLoop.setState(newState);
    shell.render(gameLoop.getState());
    return;
  }
  if (action.type === 'build_lab') {
    const state = gameLoop.getState();
    const cost = (action.payload.cost as number) ?? 250;
    if (state.resources.currency < cost) return;
    // Labs are tracked as a knowledge production bonus via a stat mutation.
    // We store lab count in statistics.totalResearchCompleted as a proxy (hacky but works).
    // Better: add a knowledgeRate field. For now, directly add knowledge per tick via resource rate.
    const newState = applyUpdate(state, {
      resources: {
        currency: state.resources.currency - cost,
        knowledgePoints: state.resources.knowledgePoints + 0, // no immediate bonus
      },
      mutations: [
        // Increase the knowledge point rate by storing it in a custom stat.
        // We'll bump knowledgePoints directly in the render callback.
        { path: 'statistics.totalResearchCompleted', value: state.statistics.totalResearchCompleted + 1 },
      ],
    });
    gameLoop.setState(newState);
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

    // Labs generate knowledge: 2 per tick per lab (labs stored as totalResearchCompleted).
    const labCount = currentState.statistics.totalResearchCompleted;
    if (labCount > 0) {
      const knowledgeGain = labCount * 2;
      const updated = applyUpdate(currentState, {
        resources: { knowledgePoints: currentState.resources.knowledgePoints + knowledgeGain },
      });
      loop.setState(updated);
      currentState = updated;
    }

    // Weapons factories consume energy (5 per factory per tick).
    const weaponFactoryCount = currentState.weapons.factories.length;
    if (weaponFactoryCount > 0) {
      const energyDrain = weaponFactoryCount * 5;
      const newStored = Math.max(0, currentState.energy.stored - energyDrain);
      const updated = applyUpdate(currentState, {
        mutations: [{ path: 'energy.stored', value: newStored }],
      });
      loop.setState(updated);
      currentState = updated;
    }

    shell.render(currentState);
  });

  loop.calculateOfflineEarnings();
  loop.start();
  shell.render(loop.getState());
  shell.startTutorial();
}

// ─── Era Progression ────────────────────────────────────────────────────────

// Era advancement costs (currency, knowledge, steel, energy stored).
const ERA_COSTS: Record<string, { currency: number; knowledge: number; steel: number; energy: number }> = {
  nuclear: { currency: 5000, knowledge: 200, steel: 50, energy: 2000 },
  solar: { currency: 15000, knowledge: 500, steel: 150, energy: 5000 },
  orbital: { currency: 50000, knowledge: 1500, steel: 500, energy: 15000 },
  mars_colonization: { currency: 150000, knowledge: 5000, steel: 2000, energy: 50000 },
  space_mining: { currency: 500000, knowledge: 15000, steel: 8000, energy: 150000 },
  dyson_ring: { currency: 2000000, knowledge: 50000, steel: 30000, energy: 500000 },
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
    state.energy.stored >= cost.energy
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

const saved = SaveSystem.load();
if (saved) {
  startGame(saved.country);
} else {
  shell.showCountrySelection((country) => {
    startGame(country);
  });
}
