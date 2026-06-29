import { describe, it, expect } from 'vitest';
import { WeaponsSystem } from '../../../../src/game/systems/weapons-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState } from '../../../../src/game/core/types.js';
import type { WeaponsFactory } from '../../../../src/game/core/combat.js';

function createTestState(): GameState {
  return createInitialState('usa');
}

describe('WeaponsSystem', () => {
  const system = new WeaponsSystem();

  describe('getMilitaryPower', () => {
    it('should return 0 for empty arsenal', () => {
      const state = createTestState();
      // Arsenal starts at all zeros
      state.weapons.arsenal = {
        conventional: 0,
        missile: 0,
        cyber: 0,
        energy: 0,
        orbital: 0,
      };

      expect(system.getMilitaryPower(state)).toBe(0);
    });

    it('should correctly sum arsenal × power per unit', () => {
      const state = createTestState();
      // conventional=1, missile=5, cyber=3, energy=10, orbital=20
      state.weapons.arsenal = {
        conventional: 10,
        missile: 5,
        cyber: 2,
        energy: 1,
        orbital: 1,
      };

      // 10*1 + 5*5 + 2*3 + 1*10 + 1*20 = 10 + 25 + 6 + 10 + 20 = 71
      expect(system.getMilitaryPower(state)).toBe(71);
    });
  });

  describe('update', () => {
    it('should produce weapons when factory has materials available (steel for conventional)', () => {
      const state = createTestState();
      state.materials.stockpiles.steel = 100;
      const factory: WeaponsFactory = {
        id: 'factory-1',
        level: 1,
        producing: 'conventional',
        productionRate: 2,
      };
      state.weapons.factories = [factory];

      const update = system.update(state, 1);

      // Should produce 2 conventional (rate=2, deltaTicks=1)
      const arsenalMutation = update.mutations?.find((m) => m.path === 'weapons.arsenal.conventional');
      expect(arsenalMutation).toBeDefined();
      expect(arsenalMutation!.value).toBe(2);
    });

    it('should not produce when materials are insufficient', () => {
      const state = createTestState();
      state.materials.stockpiles.steel = 0; // No steel available
      const factory: WeaponsFactory = {
        id: 'factory-1',
        level: 1,
        producing: 'conventional',
        productionRate: 2,
      };
      state.weapons.factories = [factory];

      const update = system.update(state, 1);

      // Should produce nothing - empty update
      expect(update).toEqual({});
    });

    it('should deduct materials on production', () => {
      const state = createTestState();
      state.materials.stockpiles.steel = 10;
      const factory: WeaponsFactory = {
        id: 'factory-1',
        level: 1,
        producing: 'conventional',
        productionRate: 3,
      };
      state.weapons.factories = [factory];

      const update = system.update(state, 1);

      // Conventional needs 1 steel each, producing 3 => deduct 3 steel
      expect(update.materials?.stockpiles?.steel).toBe(7);
    });

    it('should recalculate military power after production', () => {
      const state = createTestState();
      state.materials.stockpiles.steel = 100;
      state.weapons.arsenal = {
        conventional: 5,
        missile: 0,
        cyber: 0,
        energy: 0,
        orbital: 0,
      };
      const factory: WeaponsFactory = {
        id: 'factory-1',
        level: 1,
        producing: 'conventional',
        productionRate: 2,
      };
      state.weapons.factories = [factory];

      const update = system.update(state, 1);

      const powerMutation = update.mutations?.find((m) => m.path === 'weapons.militaryPower');
      expect(powerMutation).toBeDefined();
      // 5 existing + 2 new = 7 conventional * 1 power = 7
      expect(powerMutation!.value).toBe(7);
    });

    it('should handle multiple factories', () => {
      const state = createTestState();
      state.materials.stockpiles.steel = 100;
      // Unlock missile via research
      (state.research.trees.weapons.nodes as Record<string, { status: string; progress: number }>)['weapons_missile_1'] = {
        status: 'completed',
        progress: 0,
      };
      state.materials.stockpiles.electronics = 50;
      state.materials.stockpiles.fuel = 50;

      const factory1: WeaponsFactory = {
        id: 'factory-1',
        level: 1,
        producing: 'conventional',
        productionRate: 1,
      };
      const factory2: WeaponsFactory = {
        id: 'factory-2',
        level: 1,
        producing: 'missile',
        productionRate: 1,
      };
      state.weapons.factories = [factory1, factory2];

      const update = system.update(state, 1);

      const conventionalMutation = update.mutations?.find(
        (m) => m.path === 'weapons.arsenal.conventional',
      );
      const missileMutation = update.mutations?.find(
        (m) => m.path === 'weapons.arsenal.missile',
      );
      expect(conventionalMutation).toBeDefined();
      expect(conventionalMutation!.value).toBe(1);
      expect(missileMutation).toBeDefined();
      expect(missileMutation!.value).toBe(1);
    });
  });

  describe('getWeaponCategories', () => {
    it('should show conventional as always unlocked', () => {
      const state = createTestState();

      const categories = system.getWeaponCategories(state);
      const conventional = categories.find((c) => c.id === 'conventional');

      expect(conventional).toBeDefined();
      expect(conventional!.unlocked).toBe(true);
    });

    it('should show missile as locked without weapons_missile_1 research', () => {
      const state = createTestState();

      const categories = system.getWeaponCategories(state);
      const missile = categories.find((c) => c.id === 'missile');

      expect(missile).toBeDefined();
      expect(missile!.unlocked).toBe(false);
    });

    it('should show missile as unlocked after weapons_missile_1 completed', () => {
      const state = createTestState();
      // Complete the weapons_missile_1 research node
      (state.research.trees.weapons.nodes as Record<string, { status: string; progress: number }>)['weapons_missile_1'] = {
        status: 'completed',
        progress: 0,
      };

      const categories = system.getWeaponCategories(state);
      const missile = categories.find((c) => c.id === 'missile');

      expect(missile).toBeDefined();
      expect(missile!.unlocked).toBe(true);
    });
  });

  describe('canPerform', () => {
    it('should return true for build_weapons_factory with unlocked category', () => {
      const state = createTestState();

      const result = system.canPerform(state, {
        type: 'build_weapons_factory',
        payload: { producing: 'conventional' },
      });

      expect(result).toBe(true);
    });

    it('should return false for locked category', () => {
      const state = createTestState();

      const result = system.canPerform(state, {
        type: 'build_weapons_factory',
        payload: { producing: 'missile' },
      });

      expect(result).toBe(false);
    });
  });

  describe('perform', () => {
    it('should create a new factory for build_weapons_factory', () => {
      const state = createTestState();
      state.weapons.factories = [];

      const update = system.perform(state, {
        type: 'build_weapons_factory',
        payload: { producing: 'conventional' },
      });

      const factoriesMutation = update.mutations?.find((m) => m.path === 'weapons.factories');
      expect(factoriesMutation).toBeDefined();

      const factories = factoriesMutation!.value as WeaponsFactory[];
      expect(factories).toHaveLength(1);
      expect(factories[0].producing).toBe('conventional');
      expect(factories[0].level).toBe(1);
      expect(factories[0].productionRate).toBe(1);
    });

    it('should change factory producing type for set_factory_production', () => {
      const state = createTestState();
      const factory: WeaponsFactory = {
        id: 'factory-1',
        level: 1,
        producing: 'conventional',
        productionRate: 1,
      };
      state.weapons.factories = [factory];

      // Unlock missile
      (state.research.trees.weapons.nodes as Record<string, { status: string; progress: number }>)['weapons_missile_1'] = {
        status: 'completed',
        progress: 0,
      };

      const update = system.perform(state, {
        type: 'set_factory_production',
        payload: { factoryId: 'factory-1', producing: 'missile' },
      });

      const factoriesMutation = update.mutations?.find((m) => m.path === 'weapons.factories');
      expect(factoriesMutation).toBeDefined();

      const factories = factoriesMutation!.value as WeaponsFactory[];
      expect(factories[0].producing).toBe('missile');
    });
  });

  describe('production capping by available materials', () => {
    it('should cap production by available materials (can only make as many as materials allow)', () => {
      const state = createTestState();
      // Only 3 steel available, but factory wants to make 5 per tick
      state.materials.stockpiles.steel = 3;
      const factory: WeaponsFactory = {
        id: 'factory-1',
        level: 1,
        producing: 'conventional',
        productionRate: 5,
      };
      state.weapons.factories = [factory];

      const update = system.update(state, 1);

      // Should only produce 3 (limited by steel)
      const arsenalMutation = update.mutations?.find(
        (m) => m.path === 'weapons.arsenal.conventional',
      );
      expect(arsenalMutation).toBeDefined();
      expect(arsenalMutation!.value).toBe(3);

      // All steel should be consumed
      expect(update.materials?.stockpiles?.steel).toBe(0);
    });
  });
});
