import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from '../../../../src/game/core/game-loop.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import { SaveSystem } from '../../../../src/game/core/save-system.js';
import type { GameState, GameSystem, StateUpdate, Era } from '../../../../src/game/core/types.js';

// Helper to create a mock system
function createMockSystem(
  id: string,
  activeEras: Era[],
  updateFn?: (state: GameState, deltaTicks: number) => StateUpdate
): GameSystem {
  return {
    id,
    activeEras,
    update: updateFn ?? (() => ({})),
    canPerform: () => false,
    perform: () => ({}),
  };
}

describe('GameLoop', () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = createInitialState('usa');
    vi.useFakeTimers();
    // Mock localStorage for SaveSystem
    const storage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('constructor and basic methods', () => {
    it('should initialize with the given state', () => {
      const loop = new GameLoop(initialState);
      expect(loop.getState()).toBe(initialState);
    });

    it('should allow setting state directly', () => {
      const loop = new GameLoop(initialState);
      const newState = { ...initialState, currentEra: 'nuclear' as Era };
      loop.setState(newState);
      expect(loop.getState()).toBe(newState);
    });

    it('should not be running initially', () => {
      const loop = new GameLoop(initialState);
      expect(loop.isRunning()).toBe(false);
    });
  });

  describe('system registration', () => {
    it('should register systems', () => {
      const loop = new GameLoop(initialState);
      const system = createMockSystem('weather', ['fossil']);
      loop.registerSystem(system);

      const activeSystems = loop.getActiveSystemsForEra('fossil');
      expect(activeSystems).toContain(system);
    });

    it('should preserve registration order', () => {
      const loop = new GameLoop(initialState);
      const system1 = createMockSystem('weather', ['fossil']);
      const system2 = createMockSystem('resource', ['fossil']);
      const system3 = createMockSystem('tech', ['fossil']);

      loop.registerSystem(system1);
      loop.registerSystem(system2);
      loop.registerSystem(system3);

      const activeSystems = loop.getActiveSystemsForEra('fossil');
      expect(activeSystems[0]).toBe(system1);
      expect(activeSystems[1]).toBe(system2);
      expect(activeSystems[2]).toBe(system3);
    });
  });

  describe('era filtering', () => {
    it('should filter systems by active eras', () => {
      const loop = new GameLoop(initialState);
      const fossilSystem = createMockSystem('weather', ['fossil', 'nuclear']);
      const nuclearSystem = createMockSystem('nuclear-only', ['nuclear']);
      const spaceSystem = createMockSystem('space', ['space_mining']);

      loop.registerSystem(fossilSystem);
      loop.registerSystem(nuclearSystem);
      loop.registerSystem(spaceSystem);

      const fossilActive = loop.getActiveSystemsForEra('fossil');
      expect(fossilActive).toHaveLength(1);
      expect(fossilActive[0].id).toBe('weather');

      const nuclearActive = loop.getActiveSystemsForEra('nuclear');
      expect(nuclearActive).toHaveLength(2);
      expect(nuclearActive[0].id).toBe('weather');
      expect(nuclearActive[1].id).toBe('nuclear-only');
    });

    it('should return empty array for era with no active systems', () => {
      const loop = new GameLoop(initialState);
      const system = createMockSystem('space', ['dyson_ring']);
      loop.registerSystem(system);

      const active = loop.getActiveSystemsForEra('fossil');
      expect(active).toHaveLength(0);
    });
  });

  describe('tick', () => {
    it('should call update on active systems in order', () => {
      const loop = new GameLoop(initialState);
      const callOrder: string[] = [];

      const system1 = createMockSystem('first', ['fossil'], () => {
        callOrder.push('first');
        return {};
      });
      const system2 = createMockSystem('second', ['fossil'], () => {
        callOrder.push('second');
        return {};
      });

      loop.registerSystem(system1);
      loop.registerSystem(system2);
      loop.tick(1);

      expect(callOrder).toEqual(['first', 'second']);
    });

    it('should pass deltaTicks to system update', () => {
      const loop = new GameLoop(initialState);
      let receivedDelta = 0;

      const system = createMockSystem('test', ['fossil'], (_state, dt) => {
        receivedDelta = dt;
        return {};
      });

      loop.registerSystem(system);
      loop.tick(5);

      expect(receivedDelta).toBe(5);
    });

    it('should apply state updates from systems', () => {
      const loop = new GameLoop(initialState);
      const system = createMockSystem('resource', ['fossil'], () => ({
        resources: { currency: 1500 },
      }));

      loop.registerSystem(system);
      loop.tick(1);

      expect(loop.getState().resources.currency).toBe(1500);
    });

    it('should chain state updates across systems', () => {
      const loop = new GameLoop(initialState);

      // First system sets currency to 2000
      const system1 = createMockSystem('first', ['fossil'], () => ({
        resources: { currency: 2000 },
      }));

      // Second system reads state and adds to it
      const system2 = createMockSystem('second', ['fossil'], (state) => ({
        resources: { currency: state.resources.currency + 100 },
      }));

      loop.registerSystem(system1);
      loop.registerSystem(system2);
      loop.tick(1);

      expect(loop.getState().resources.currency).toBe(2100);
    });

    it('should increment playTimeTicks', () => {
      const loop = new GameLoop(initialState);
      loop.tick(5);
      expect(loop.getState().statistics.playTimeTicks).toBe(5);

      loop.tick(3);
      expect(loop.getState().statistics.playTimeTicks).toBe(8);
    });

    it('should skip inactive systems for current era', () => {
      const loop = new GameLoop(initialState); // fossil era
      const called: string[] = [];

      const fossilSystem = createMockSystem('fossil-sys', ['fossil'], () => {
        called.push('fossil-sys');
        return {};
      });
      const nuclearSystem = createMockSystem('nuclear-sys', ['nuclear'], () => {
        called.push('nuclear-sys');
        return {};
      });

      loop.registerSystem(fossilSystem);
      loop.registerSystem(nuclearSystem);
      loop.tick(1);

      expect(called).toEqual(['fossil-sys']);
    });
  });

  describe('start and stop', () => {
    it('should start the tick interval', () => {
      const loop = new GameLoop(initialState);
      const system = createMockSystem('test', ['fossil'], () => ({
        resources: { currency: loop.getState().resources.currency + 1 },
      }));
      loop.registerSystem(system);

      loop.start();
      expect(loop.isRunning()).toBe(true);

      // Advance time by 3 seconds
      vi.advanceTimersByTime(3000);

      // Should have ticked 3 times
      expect(loop.getState().statistics.playTimeTicks).toBe(3);

      loop.stop();
    });

    it('should stop the tick interval on stop()', () => {
      const loop = new GameLoop(initialState);
      const system = createMockSystem('test', ['fossil'], () => ({
        resources: { currency: loop.getState().resources.currency + 1 },
      }));
      loop.registerSystem(system);

      loop.start();
      vi.advanceTimersByTime(2000);
      loop.stop();

      const ticksAtStop = loop.getState().statistics.playTimeTicks;
      vi.advanceTimersByTime(5000);

      // Should not have advanced further
      expect(loop.getState().statistics.playTimeTicks).toBe(ticksAtStop);
    });

    it('should not start twice', () => {
      const loop = new GameLoop(initialState);
      loop.start();
      loop.start(); // should not throw or create duplicate intervals
      expect(loop.isRunning()).toBe(true);
      loop.stop();
    });

    it('should not stop if not running', () => {
      const loop = new GameLoop(initialState);
      loop.stop(); // should not throw
      expect(loop.isRunning()).toBe(false);
    });
  });

  describe('auto-save', () => {
    it('should auto-save every 60 seconds', () => {
      const saveSpy = vi.spyOn(SaveSystem, 'save');
      const loop = new GameLoop(initialState);

      loop.start();

      // Advance time by 60 seconds
      vi.advanceTimersByTime(60_000);
      expect(saveSpy).toHaveBeenCalled();

      loop.stop();
      saveSpy.mockRestore();
    });

    it('should save on stop', () => {
      const saveSpy = vi.spyOn(SaveSystem, 'save');
      const loop = new GameLoop(initialState);

      loop.start();
      saveSpy.mockClear();
      loop.stop();

      expect(saveSpy).toHaveBeenCalledWith(loop.getState());
      saveSpy.mockRestore();
    });
  });

  describe('render callback', () => {
    it('should accept a render callback', () => {
      const loop = new GameLoop(initialState);
      const callback = vi.fn();
      loop.setRenderCallback(callback);
      // callback is stored but not called until render loop runs
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('calculateOfflineEarnings', () => {
    it('should return current state if no save timestamp exists', () => {
      const loop = new GameLoop(initialState);
      vi.spyOn(SaveSystem, 'getLastSaveTimestamp').mockReturnValue(null);

      const result = loop.calculateOfflineEarnings();
      expect(result).toBe(initialState);
    });

    it('should calculate offline earnings for elapsed time', () => {
      const loop = new GameLoop(initialState);
      // Simulate a save from 10 seconds ago
      const now = Date.now();
      vi.spyOn(SaveSystem, 'getLastSaveTimestamp').mockReturnValue(now - 10_000);

      const system = createMockSystem('resource', ['fossil'], (state, dt) => ({
        resources: { currency: state.resources.currency + dt * 10 },
      }));
      loop.registerSystem(system);

      loop.calculateOfflineEarnings();

      // 10 seconds * 10 currency/tick = 100 added
      expect(loop.getState().resources.currency).toBe(initialState.resources.currency + 100);
    });

    it('should cap offline earnings at 24 hours (86400 seconds)', () => {
      const loop = new GameLoop(initialState);
      // Simulate a save from 48 hours ago (much more than 24h)
      const now = Date.now();
      vi.spyOn(SaveSystem, 'getLastSaveTimestamp').mockReturnValue(now - 48 * 3600 * 1000);

      let receivedDelta = 0;
      const system = createMockSystem('resource', ['fossil'], (_state, dt) => {
        receivedDelta = dt;
        return {};
      });
      loop.registerSystem(system);

      loop.calculateOfflineEarnings();

      // Should be capped at 86400
      expect(receivedDelta).toBe(86400);
    });

    it('should not tick if elapsed time is zero or negative', () => {
      const loop = new GameLoop(initialState);
      const now = Date.now();
      // Save timestamp in the future (clock skew edge case)
      vi.spyOn(SaveSystem, 'getLastSaveTimestamp').mockReturnValue(now + 5000);

      let wasCalled = false;
      const system = createMockSystem('resource', ['fossil'], () => {
        wasCalled = true;
        return {};
      });
      loop.registerSystem(system);

      loop.calculateOfflineEarnings();
      expect(wasCalled).toBe(false);
    });
  });

  describe('beforeunload handler', () => {
    let mockWindow: { addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockWindow = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      vi.stubGlobal('window', mockWindow);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      // Re-stub localStorage for other tests
      const storage: Record<string, string> = {};
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => { storage[key] = value; },
        removeItem: (key: string) => { delete storage[key]; },
      });
    });

    it('should register beforeunload handler on start', () => {
      const loop = new GameLoop(initialState);

      loop.start();
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      loop.stop();
    });

    it('should remove beforeunload handler on stop', () => {
      const loop = new GameLoop(initialState);

      loop.start();
      loop.stop();
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('should save when beforeunload fires', () => {
      const saveSpy = vi.spyOn(SaveSystem, 'save');
      const loop = new GameLoop(initialState);

      loop.start();
      saveSpy.mockClear();

      // Get the handler that was registered
      const handler = mockWindow.addEventListener.mock.calls[0][1] as () => void;
      handler();

      expect(saveSpy).toHaveBeenCalled();

      loop.stop();
      saveSpy.mockRestore();
    });
  });
});
