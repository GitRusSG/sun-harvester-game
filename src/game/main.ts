/**
 * Sun Harvester — Game entry point.
 *
 * Wires all systems into the game loop, connects the renderer, handles
 * country selection, save/load, offline earnings, and era progression.
 */
import '../style.css';
import './ui/ui.css';

import type { CountryId, GameState, GameSystem } from './core/types.js';
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

// Shared system instances used for both the game loop AND action handling.
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

// Connect event controller to renderer notifications.
eventController.subscribe((event) => {
  switch (event.type) {
    case 'era_unlock':
      renderer.showNotification(`New era unlocked: ${event.payload.era}`, 'success');
      break;
    case 'research_complete':
      renderer.showNotification(`Research complete: ${event.payload.nodeId}`, 'info');
      break;
    case 'crafting_complete':
      renderer.showNotification(`Crafted: ${event.payload.recipeName} ×${event.payload.quantity}`, 'info');
      break;
    case 'dyson_segment_complete':
      renderer.showNotification(`Dyson segment complete: ${event.payload.segmentName}`, 'success');
      break;
    case 'victory':
      renderer.showNotification('🏆 Dyson Ring complete — Victory!', 'success');
      break;
    case 'un_attack':
      renderer.showNotification(`UN attack: ${event.payload.attackType}`, 'warning');
      break;
    case 'alien_signal':
      renderer.showNotification('Alien signal detected!', 'warning');
      break;
    case 'protest':
      renderer.showNotification('Protest activity detected', 'warning');
      break;
    case 'politician_installed':
      renderer.showNotification(`Politician installed in ${event.payload.country}`, 'success');
      break;
    case 'coup':
      renderer.showNotification(`Coup in ${event.payload.country}! Politician removed.`, 'error');
      break;
    default:
      break;
  }
});

// ─── Game Loop Reference ────────────────────────────────────────────────────

let gameLoop: GameLoop | null = null;

// ─── Start Game ─────────────────────────────────────────────────────────────

function startGame(country: CountryId): void {
  let state: GameState | null = SaveSystem.load();
  if (!state || state.country !== country) {
    state = createInitialState(country);
  }

  const loop = new GameLoop(state);
  gameLoop = loop;

  // Register shared system instances.
  for (const system of gameSystems) {
    loop.registerSystem(system);
  }

  // Connect render callback (throttled to ~2 DOM updates/sec to keep buttons clickable).
  let lastRenderTime = 0;
  loop.setRenderCallback((currentState) => {
    const now = performance.now();
    if (now - lastRenderTime < 500) return;
    lastRenderTime = now;
    renderer.render(currentState);
    checkEraProgression(loop);
  });

  // Calculate offline earnings.
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

  loop.start();
  tutorial.start(renderer);
}

// ─── UI Action Handler ──────────────────────────────────────────────────────

// Listen for UI action events (dispatched by the renderer on button clicks).
container.addEventListener('shg-action', ((e: CustomEvent) => {
  if (!gameLoop) return;
  const { type, payload } = e.detail as { type: string; payload: Record<string, unknown> };
  handleAction(gameLoop, type, payload);
}) as EventListener);

function handleAction(
  loop: GameLoop,
  type: string,
  payload: Record<string, unknown>,
): void {
  const state = loop.getState();
  const action = { type, payload };

  // Try each shared system instance to find one that handles this action.
  for (const system of gameSystems) {
    if (system.canPerform(state, action)) {
      const update = system.perform(state, action);
      if (update && (update.mutations || update.resources || update.materials || update.events)) {
        const newState = applyUpdate(state, update);
        loop.setState(newState);

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ─── Launch ─────────────────────────────────────────────────────────────────

const saved = SaveSystem.load();
if (saved) {
  startGame(saved.country);
} else {
  renderer.showCountrySelection((country) => {
    startGame(country);
  });
}
