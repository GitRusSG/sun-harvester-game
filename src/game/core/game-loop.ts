import type { GameState, GameSystem, StateUpdate, Era } from './types.js';
import { applyUpdate } from './state-manager.js';
import { SaveSystem } from './save-system.js';

/**
 * Maximum offline duration in seconds (24 hours).
 */
const MAX_OFFLINE_SECONDS = 86400;

/**
 * Auto-save interval in milliseconds (60 seconds).
 */
const AUTO_SAVE_INTERVAL_MS = 60_000;

/**
 * Simulation tick interval in milliseconds (1 second).
 */
const TICK_INTERVAL_MS = 1000;

export type RenderCallback = (state: GameState) => void;
export type EventsCallback = (events: import('./types.js').GameEvent[]) => void;

/**
 * The GameLoop class is the central orchestrator for the Sun Harvester game.
 *
 * It manages:
 * - 1-second interval tick scheduling for simulation updates
 * - requestAnimationFrame-based rendering loop (separate from simulation)
 * - Offline bulk-tick calculation (capped at 24 hours)
 * - System registration and dependency-ordered updates
 * - Era-based system filtering
 * - Auto-save every 60 seconds
 * - beforeunload handler for final save
 */
export class GameLoop {
  private systems: GameSystem[] = [];
  private state: GameState;
  private renderCallback: RenderCallback | null = null;
  private eventsCallback: EventsCallback | null = null;

  private tickIntervalId: ReturnType<typeof setInterval> | null = null;
  private autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private animationFrameId: number | null = null;
  private running = false;

  private boundBeforeUnload: (() => void) | null = null;

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  /**
   * Registers a game system to be updated each tick.
   * Systems should be registered in dependency order.
   */
  registerSystem(system: GameSystem): void {
    this.systems.push(system);
  }

  /**
   * Sets the render callback invoked on each animation frame.
   */
  setRenderCallback(callback: RenderCallback): void {
    this.renderCallback = callback;
  }

  /** Sets a callback invoked with any GameEvents produced during a tick. */
  setEventsCallback(callback: EventsCallback): void {
    this.eventsCallback = callback;
  }

  /**
   * Returns the current game state.
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Sets the game state directly (useful for loading saves).
   */
  setState(state: GameState): void {
    this.state = state;
  }

  /**
   * Starts the game loop:
   * - Begins the simulation tick interval (1 second)
   * - Begins the render loop (requestAnimationFrame)
   * - Begins auto-save interval (60 seconds)
   * - Registers the beforeunload handler
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Start simulation ticks
    this.tickIntervalId = setInterval(() => {
      this.tick(1);
    }, TICK_INTERVAL_MS);

    // Start render loop
    this.startRenderLoop();

    // Start auto-save
    this.autoSaveIntervalId = setInterval(() => {
      SaveSystem.save(this.state);
    }, AUTO_SAVE_INTERVAL_MS);

    // Register beforeunload handler
    this.boundBeforeUnload = () => {
      SaveSystem.save(this.state);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.boundBeforeUnload);
    }
  }

  /**
   * Stops the game loop:
   * - Clears the simulation tick interval
   * - Cancels the render loop
   * - Clears the auto-save interval
   * - Removes the beforeunload handler
   * - Performs a final save
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.tickIntervalId !== null) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }

    if (this.animationFrameId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.animationFrameId = null;
    }

    if (this.autoSaveIntervalId !== null) {
      clearInterval(this.autoSaveIntervalId);
      this.autoSaveIntervalId = null;
    }

    if (this.boundBeforeUnload && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      this.boundBeforeUnload = null;
    }

    // Final save on stop
    SaveSystem.save(this.state);
  }

  /**
   * Returns whether the game loop is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Calculates offline earnings based on elapsed time since last save.
   * Caps the elapsed time at 24 hours (86400 seconds).
   * Runs a bulk tick calculation through all active systems.
   *
   * Returns the updated state after applying offline ticks.
   */
  calculateOfflineEarnings(): GameState {
    const lastSaveTimestamp = SaveSystem.getLastSaveTimestamp();
    if (lastSaveTimestamp === null) {
      return this.state;
    }

    const now = Date.now();
    const elapsedMs = now - lastSaveTimestamp;
    const elapsedSeconds = Math.min(
      Math.max(Math.floor(elapsedMs / 1000), 0),
      MAX_OFFLINE_SECONDS
    );

    if (elapsedSeconds <= 0) {
      return this.state;
    }

    // Run bulk tick calculation with the capped elapsed seconds
    this.tick(elapsedSeconds);

    return this.state;
  }

  /**
   * Processes one or more simulation ticks.
   * Iterates over all registered systems in dependency order,
   * filters by activeEras matching the current era,
   * calls update() on each active system, and applies the resulting StateUpdates.
   */
  tick(deltaTicks: number): void {
    const currentEra = this.state.currentEra;
    const activeSystems = this.getActiveSystemsForEra(currentEra);

    const collectedEvents: import('./types.js').GameEvent[] = [];
    for (const system of activeSystems) {
      const update: StateUpdate = system.update(this.state, deltaTicks);
      if (update.events && update.events.length > 0) {
        collectedEvents.push(...update.events);
      }
      this.state = applyUpdate(this.state, update);
    }

    if (collectedEvents.length > 0 && this.eventsCallback) {
      this.eventsCallback(collectedEvents);
    }

    // Update play time statistics
    this.state = {
      ...this.state,
      statistics: {
        ...this.state.statistics,
        playTimeTicks: this.state.statistics.playTimeTicks + deltaTicks,
      },
    };
  }

  /**
   * Filters registered systems to only those active in the given era.
   * Preserves the registration (dependency) order.
   */
  getActiveSystemsForEra(era: Era): GameSystem[] {
    return this.systems.filter((system) => system.activeEras.includes(era));
  }

  /**
   * Starts the requestAnimationFrame rendering loop.
   * Calls the registered render callback with the current state on each frame.
   */
  private startRenderLoop(): void {
    if (typeof requestAnimationFrame === 'undefined') return;

    const renderFrame = () => {
      if (!this.running) return;

      if (this.renderCallback) {
        this.renderCallback(this.state);
      }

      this.animationFrameId = requestAnimationFrame(renderFrame);
    };

    this.animationFrameId = requestAnimationFrame(renderFrame);
  }
}
