import { describe, it, expect, vi } from 'vitest';
import { AlienSystem } from '../../../../src/game/systems/alien-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState } from '../../../../src/game/core/types.js';
import type { AlienSignal, AlienThreat } from '../../../../src/game/core/combat.js';

function createTestState(): GameState {
  const state = createInitialState('usa');
  // Set up space mining era context
  state.currentEra = 'space_mining';
  return state;
}

function createStateWithTerritories(count: number): GameState {
  const state = createTestState();
  state.space.territories = Array.from({ length: count }, (_, i) => ({
    id: `territory_${i}`,
    name: `Asteroid ${i}`,
    resourceProfile: {} as any,
    depositQuality: 0.8,
    surveyed: true,
    miningLevel: 1,
    productionRate: 10,
  }));
  return state;
}

function createStateWithSignal(): GameState {
  const state = createStateWithTerritories(1);
  const signal: AlienSignal = {
    id: 'signal_test_1',
    detectedTick: 100,
    investigated: false,
  };
  state.alien.signals = [signal];
  return state;
}

describe('AlienSystem', () => {
  const system = new AlienSystem();

  describe('activeEras', () => {
    it('should be active from Space Mining Era onwards', () => {
      expect(system.activeEras).toContain('space_mining');
      expect(system.activeEras).toContain('dyson_ring');
      expect(system.activeEras).not.toContain('fossil');
      expect(system.activeEras).not.toContain('nuclear');
      expect(system.activeEras).not.toContain('solar');
      expect(system.activeEras).not.toContain('orbital');
      expect(system.activeEras).not.toContain('mars_colonization');
    });
  });

  describe('update - signal detection', () => {
    it('should detect signals based on territory count and probability', () => {
      const state = createStateWithTerritories(3);
      // With 3 territories, chance per tick = 3 * 0.005 = 0.015
      vi.spyOn(Math, 'random').mockReturnValue(0.001); // Always triggers

      const update = system.update(state, 1);
      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals.length).toBeGreaterThan(0);

      // Should emit alien_signal event
      expect(update.events).toBeDefined();
      const signalEvent = update.events!.find((e) => e.type === 'alien_signal');
      expect(signalEvent).toBeDefined();

      vi.restoreAllMocks();
    });

    it('should not detect signals when no territories exist', () => {
      const state = createTestState();
      state.space.territories = [];

      vi.spyOn(Math, 'random').mockReturnValue(0.001);

      const update = system.update(state, 10);
      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals).toHaveLength(0);

      vi.restoreAllMocks();
    });

    it('should not detect signals when random exceeds threshold', () => {
      const state = createStateWithTerritories(1);
      // With 1 territory, chance = 0.005; random 0.9 > 0.005
      vi.spyOn(Math, 'random').mockReturnValue(0.9);

      const update = system.update(state, 1);
      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals).toHaveLength(0);

      vi.restoreAllMocks();
    });
  });

  describe('update - threat processing', () => {
    it('should decrement threat remainingTicks', () => {
      const state = createTestState();
      state.alien.activeThreat = {
        severity: 3,
        defenseRequired: 60,
        remainingTicks: 20,
      };
      state.weapons.militaryPower = 10; // Not enough

      const update = system.update(state, 5);
      const threatMutation = update.mutations?.find((m) => m.path === 'alien.activeThreat');
      const threat = threatMutation!.value as AlienThreat;
      expect(threat).not.toBeNull();
      expect(threat.remainingTicks).toBe(15);
    });

    it('should repel threat when military power meets defense requirement', () => {
      const state = createTestState();
      state.alien.activeThreat = {
        severity: 3,
        defenseRequired: 60,
        remainingTicks: 20,
      };
      state.weapons.militaryPower = 60; // Meets requirement

      const update = system.update(state, 1);
      const threatMutation = update.mutations?.find((m) => m.path === 'alien.activeThreat');
      expect(threatMutation!.value).toBeNull();
    });

    it('should reduce relations when threat expires without sufficient defense', () => {
      const state = createTestState();
      state.alien.relationsScore = 50;
      state.alien.activeThreat = {
        severity: 3,
        defenseRequired: 60,
        remainingTicks: 5,
      };
      state.weapons.militaryPower = 10; // Not enough

      const update = system.update(state, 10); // Passes remaining ticks
      const relationsMutation = update.mutations?.find((m) => m.path === 'alien.relationsScore');
      expect(relationsMutation!.value).toBe(40); // 50 - 10

      const threatMutation = update.mutations?.find((m) => m.path === 'alien.activeThreat');
      expect(threatMutation!.value).toBeNull();
    });
  });

  describe('update - forced contact escalation', () => {
    it('should trigger forced contact when ignored signals >= 5', () => {
      const state = createStateWithTerritories(1);
      state.alien.ignoredSignals = 5; // At threshold

      // Force signal detection
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.001) // Signal detected
        .mockReturnValueOnce(0.9); // Encounter outcome (cooperative: 0.9 * 200 + 0 = 180 > 100)

      const update = system.update(state, 1);

      // Should emit alien_encounter event with forced: true
      expect(update.events).toBeDefined();
      const encounterEvent = update.events!.find((e) => e.type === 'alien_encounter');
      expect(encounterEvent).toBeDefined();
      expect(encounterEvent!.payload.forced).toBe(true);

      // Should reset ignored count
      const ignoredMutation = update.mutations?.find((m) => m.path === 'alien.ignoredSignals');
      expect(ignoredMutation!.value).toBe(0);

      vi.restoreAllMocks();
    });
  });

  describe('perform - investigate_signal', () => {
    it('should mark signal as investigated with cooperative outcome', () => {
      const state = createStateWithSignal();
      state.alien.relationsScore = 50;
      // High relations + high random = cooperative
      // Formula: random * 200 + 50 > 100 → needs random > 0.25
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.8) // determineOutcome: 0.8 * 200 + 50 = 210 > 100 → cooperative
        .mockReturnValue(0.5); // generateId calls

      const update = system.perform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      });

      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals[0].investigated).toBe(true);
      expect(signals[0].outcome).toBe('cooperative');

      // Relations should increase by 15
      const relationsMutation = update.mutations?.find((m) => m.path === 'alien.relationsScore');
      expect(relationsMutation!.value).toBe(65); // 50 + 15

      // Should add to tradesCompleted
      const tradesMutation = update.mutations?.find((m) => m.path === 'alien.tradesCompleted');
      expect(tradesMutation).toBeDefined();

      // Should emit alien_encounter event
      expect(update.events).toBeDefined();
      const encounterEvent = update.events!.find((e) => e.type === 'alien_encounter');
      expect(encounterEvent).toBeDefined();
      expect(encounterEvent!.payload.outcome).toBe('cooperative');

      vi.restoreAllMocks();
    });

    it('should mark signal as investigated with hostile outcome', () => {
      const state = createStateWithSignal();
      state.alien.relationsScore = -50;
      // Low relations + low random = hostile
      // Formula: random * 200 + (-50) > 100 → needs random > 0.75
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.2) // determineOutcome: 0.2 * 200 - 50 = -10 < 100 → hostile
        .mockReturnValue(0.5); // for threat creation and ID

      const update = system.perform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      });

      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals[0].outcome).toBe('hostile');

      // Relations should decrease by 10
      const relationsMutation = update.mutations?.find((m) => m.path === 'alien.relationsScore');
      expect(relationsMutation!.value).toBe(-60); // -50 + (-10)

      // Should create an active threat
      const threatMutation = update.mutations?.find((m) => m.path === 'alien.activeThreat');
      expect(threatMutation).toBeDefined();
      expect(threatMutation!.value).not.toBeNull();

      vi.restoreAllMocks();
    });
  });

  describe('perform - ignore_signal', () => {
    it('should mark signal as ignored and increment ignored count', () => {
      const state = createStateWithSignal();
      state.alien.ignoredSignals = 2;
      state.alien.relationsScore = 10;

      const update = system.perform(state, {
        type: 'ignore_signal',
        payload: { signalId: 'signal_test_1' },
      });

      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals[0].outcome).toBe('ignored');

      const ignoredMutation = update.mutations?.find((m) => m.path === 'alien.ignoredSignals');
      expect(ignoredMutation!.value).toBe(3);

      // Relations should decrease by 5
      const relationsMutation = update.mutations?.find((m) => m.path === 'alien.relationsScore');
      expect(relationsMutation!.value).toBe(5); // 10 - 5
    });
  });

  describe('perform - broadcast_response', () => {
    it('should give +10 relations bonus before determining outcome', () => {
      const state = createStateWithSignal();
      state.alien.relationsScore = 0;
      // With broadcast bonus, adjusted relations = 10
      // Formula: random * 200 + 10 > 100 → needs random > 0.45
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.8) // 0.8 * 200 + 10 = 170 > 100 → cooperative
        .mockReturnValue(0.5);

      const update = system.perform(state, {
        type: 'broadcast_response',
        payload: { signalId: 'signal_test_1' },
      });

      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals[0].investigated).toBe(true);
      expect(signals[0].outcome).toBe('cooperative');

      // Relations: start 0, +10 broadcast bonus = 10, then +15 cooperative = 25
      const relationsMutation = update.mutations?.find((m) => m.path === 'alien.relationsScore');
      expect(relationsMutation!.value).toBe(25);

      // Should emit event with broadcast: true
      expect(update.events).toBeDefined();
      const encounterEvent = update.events!.find((e) => e.type === 'alien_encounter');
      expect(encounterEvent!.payload.broadcast).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe('canPerform', () => {
    it('should return true for investigate_signal with valid uninvestigated signal', () => {
      const state = createStateWithSignal();
      expect(system.canPerform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      })).toBe(true);
    });

    it('should return false for investigate_signal with already investigated signal', () => {
      const state = createStateWithSignal();
      state.alien.signals[0].investigated = true;
      expect(system.canPerform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      })).toBe(false);
    });

    it('should return false for investigate_signal with nonexistent signal', () => {
      const state = createStateWithSignal();
      expect(system.canPerform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'nonexistent' },
      })).toBe(false);
    });

    it('should return false for unknown action type', () => {
      const state = createTestState();
      expect(system.canPerform(state, { type: 'unknown', payload: {} })).toBe(false);
    });

    it('should return true for ignore_signal with valid uninvestigated signal', () => {
      const state = createStateWithSignal();
      expect(system.canPerform(state, {
        type: 'ignore_signal',
        payload: { signalId: 'signal_test_1' },
      })).toBe(true);
    });

    it('should return true for broadcast_response with valid uninvestigated signal', () => {
      const state = createStateWithSignal();
      expect(system.canPerform(state, {
        type: 'broadcast_response',
        payload: { signalId: 'signal_test_1' },
      })).toBe(true);
    });

    it('should return false for signal that already has an outcome', () => {
      const state = createStateWithSignal();
      state.alien.signals[0].outcome = 'ignored';
      expect(system.canPerform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      })).toBe(false);
    });
  });

  describe('relations score clamping', () => {
    it('should not exceed 100', () => {
      const state = createStateWithSignal();
      state.alien.relationsScore = 95;
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.9) // cooperative
        .mockReturnValue(0.5);

      const update = system.perform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      });

      const relationsMutation = update.mutations?.find((m) => m.path === 'alien.relationsScore');
      expect(relationsMutation!.value).toBe(100); // Capped

      vi.restoreAllMocks();
    });

    it('should not go below -100', () => {
      const state = createStateWithSignal();
      state.alien.relationsScore = -95;
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1) // hostile: 0.1 * 200 + (-95) = -75 < 100
        .mockReturnValue(0.5);

      const update = system.perform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      });

      const relationsMutation = update.mutations?.find((m) => m.path === 'alien.relationsScore');
      expect(relationsMutation!.value).toBe(-100); // Capped

      vi.restoreAllMocks();
    });
  });

  describe('encounter outcome probability', () => {
    it('should be cooperative when random * 200 + relationsScore > 100', () => {
      const state = createStateWithSignal();
      state.alien.relationsScore = 50;
      // 0.5 * 200 + 50 = 150 > 100 → cooperative
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5)
        .mockReturnValue(0.5);

      const update = system.perform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      });

      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals[0].outcome).toBe('cooperative');

      vi.restoreAllMocks();
    });

    it('should be hostile when random * 200 + relationsScore <= 100', () => {
      const state = createStateWithSignal();
      state.alien.relationsScore = -50;
      // 0.3 * 200 + (-50) = 10 < 100 → hostile
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.3)
        .mockReturnValue(0.5);

      const update = system.perform(state, {
        type: 'investigate_signal',
        payload: { signalId: 'signal_test_1' },
      });

      const signalsMutation = update.mutations?.find((m) => m.path === 'alien.signals');
      const signals = signalsMutation!.value as AlienSignal[];
      expect(signals[0].outcome).toBe('hostile');

      vi.restoreAllMocks();
    });
  });
});
