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
        // Force a re-render so the panel updates.
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
    shell.render(currentState);
    checkEraProgression(loop);
  });

  loop.calculateOfflineEarnings();
  loop.start();
  shell.render(loop.getState());
  shell.startTutorial();
}

// ─── Era Progression ────────────────────────────────────────────────────────

function checkEraProgression(loop: GameLoop): void {
  const state = loop.getState();
  const currentIndex = ERA_ORDER.indexOf(state.currentEra);
  if (currentIndex >= ERA_ORDER.length - 1) return;
  const nextEra = ERA_ORDER[currentIndex + 1];
  if (areEraConditionsMet(nextEra, state)) {
    const advanced = advanceEra({
      ...state,
      eraProgress: { ...state.eraProgress, [state.currentEra]: 100 },
    });
    if (advanced.currentEra !== state.currentEra) {
      loop.setState(advanced);
      eventController.enqueue([{
        id: `era_unlock_${advanced.currentEra}_${Date.now()}`,
        type: 'era_unlock',
        payload: { era: advanced.currentEra },
        timestamp: Date.now(),
      }]);
      eventController.dispatch();
    }
  }
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
