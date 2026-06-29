/**
 * Sun Harvester — Game entry point.
 *
 * Wires all systems into the game loop, connects the renderer, handles
 * country selection, save/load, offline earnings, and era progression.
 */
import '../style.css';
import './ui/ui.css';

import type { CountryId, GameState } from './core/types.js';
import { GameLoop } from './core/game-loop.js';
import { EventController } from './core/event-controller.js';
import { SaveSystem } from './core/save-system.js';
import { createInitialState, advanceEra, applyUpdate } from './core/state-manager.js';
import { areEraConditionsMet } from './data/eras.js';
import { ERA_ORDER } from './core/state-manager.js';

// Systems (registered in dependency order).
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

// Renderer (swap ThreeRenderer ↔ DomRenderer here to change backends).
import { ThreeRenderer } from './ui/renderer-three.js';
import { TutorialController } from './ui/tutorial.js';

// ─── Bootstrap ──────────────────────────────────────────────────────────────

const container = document.querySelector<HTMLElement>('#app')!;
container.innerHTML = '';

const renderer = new ThreeRenderer();
renderer.init(container);

const tutorial = new TutorialController();
const eventController = new EventController();

// Connect event controller to renderer notifications.
eventController.subscribe((event) => {
  switch (event.type) {
    case 'era_unlock':
      renderer.showNotification(
        `New era unlocked: ${event.payload.era}`,
        'success',
      );
      break;
    case 'research_complete':
      renderer.showNotification(
        `Research complete: ${event.payload.nodeId}`,
        'info',
      );
      break;
    case 'crafting_complete':
      renderer.showNotification(
        `Crafted: ${event.payload.recipeName} ×${event.payload.quantity}`,
        'info',
      );
      break;
    case 'dyson_segment_complete':
      renderer.showNotification(
        `Dyson segment complete: ${event.payload.segmentName}`,
        'success',
      );
      break;
    case 'victory':
      renderer.showNotification('🏆 Dyson Ring complete — Victory!', 'success');
      break;
    case 'un_attack':
      renderer.showNotification(
        `UN attack: ${event.payload.attackType}`,
        'warning',
      );
      break;
    case 'alien_signal':
      renderer.showNotification('Alien signal detected!', 'warning');
      break;
    case 'protest':
      renderer.showNotification('Protest activity detected', 'warning');
      break;
    case 'politician_installed':
      renderer.showNotification(
        `Politician installed in ${event.payload.country}`,
        'success',
      );
      break;
    case 'coup':
      renderer.showNotification(
        `Coup in ${event.payload.country}! Politician removed.`,
        'error',
      );
      break;
    default:
      break;
  }
});

// ─── Start Game ─────────────────────────────────────────────────────────────

function startGame(country: CountryId): void {
  // Attempt to load a saved game; fall back to new game.
  let state: GameState | null = SaveSystem.load();
  if (!state || state.country !== country) {
    state = createInitialState(country);
  }

  const loop = new GameLoop(state);

  // Register all 12 systems in dependency order.
  loop.registerSystem(new WeatherSystem());
  loop.registerSystem(new ResourceSystem());
  loop.registerSystem(new SupplyChainSystem());
  loop.registerSystem(new TechSystem());
  loop.registerSystem(new WeaponsSystem());
  loop.registerSystem(new PoliticalSystem());
  loop.registerSystem(new OppositionSystem());
  loop.registerSystem(new AlienSystem());
  loop.registerSystem(new SpaceSystem());
  loop.registerSystem(new MarsSystem());
  loop.registerSystem(new DysonSystem());
  loop.registerSystem(new EducationSystem());

  // Connect render callback.
  loop.setRenderCallback((currentState) => {
    renderer.render(currentState);

    // Check era progression on each frame.
    checkEraProgression(loop);
  });

  // Calculate and display offline earnings.
  const offlineState = loop.calculateOfflineEarnings();
  if (offlineState !== state) {
    const elapsed = Math.min(
      86400,
      Math.floor((Date.now() - (state.lastSaveTimestamp || Date.now())) / 1000),
    );
    if (elapsed > 5) {
      renderer.showNotification(
        `Welcome back! Earned offline for ${formatDuration(elapsed)}.`,
        'success',
      );
    }
  }

  // Wire UI action events from the renderer to the game systems.
  container.addEventListener('shg-action', ((e: CustomEvent) => {
    const { type, payload } = e.detail as { type: string; payload: Record<string, unknown> };
    handleAction(loop, type, payload);
  }) as EventListener);

  loop.start();

  // Show tutorial for first-time players.
  tutorial.start(renderer);
}

// ─── UI Action Handler ──────────────────────────────────────────────────────

function handleAction(
  loop: GameLoop,
  type: string,
  payload: Record<string, unknown>,
): void {
  const state = loop.getState();
  const action = { type, payload };

  // Route the action to the appropriate system.
  // For simplicity we try each system and apply the first non-empty update.
  const systems = [
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

  for (const system of systems) {
    if (system.canPerform(state, action)) {
      const update = system.perform(state, action);
      if (update && (update.mutations || update.resources || update.materials || update.events)) {
        const newState = applyUpdate(state, update);
        loop.setState(newState);

        // Process any events emitted by the action.
        if (update.events) {
          eventController.enqueue(update.events);
          eventController.dispatch();
        }
        break;
      }
    }
  }
}

// ─── Era Progression ────────────────────────────────────────────────────────

function checkEraProgression(loop: GameLoop): void {
  const state = loop.getState();
  const currentIndex = ERA_ORDER.indexOf(state.currentEra);
  if (currentIndex >= ERA_ORDER.length - 1) return;

  const nextEra = ERA_ORDER[currentIndex + 1];
  if (areEraConditionsMet(nextEra, state)) {
    const advanced = advanceEra({ ...state, eraProgress: { ...state.eraProgress, [state.currentEra]: 100 } });
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ─── Launch ─────────────────────────────────────────────────────────────────

// Check if we have a saved game to resume.
const saved = SaveSystem.load();
if (saved) {
  // Resume directly with the saved country.
  startGame(saved.country);
} else {
  // Show country selection for a new game.
  renderer.showCountrySelection((country) => {
    startGame(country);
  });
}
