import { describe, it, expect } from 'vitest';
import { SpaceSystem } from '../../../../src/game/systems/space-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState } from '../../../../src/game/core/types.js';
import type { MaterialType } from '../../../../src/game/core/resources.js';

function createTestState(): GameState {
  const state = createInitialState('usa');
  state.currentEra = 'orbital';
  return state;
}

function createSpaceMiningState(): GameState {
  const state = createInitialState('usa');
  state.currentEra = 'space_mining';
  state.space.fleet = { size: 3, fuelCapacity: 150, currentFuel: 100 };
  state.space.maxTerritories = 6;
  return state;
}

function createStateWithResources(): GameState {
  const state = createTestState();
  state.materials.stockpiles.fuel = 100;
  state.materials.stockpiles.steel = 100;
  state.materials.stockpiles.electronics = 50;
  return state;
}

describe('SpaceSystem', () => {
  const system = new SpaceSystem();

  describe('activeEras', () => {
    it('should be active from Orbital Era onwards', () => {
      expect(system.activeEras).toContain('orbital');
      expect(system.activeEras).toContain('mars_colonization');
      expect(system.activeEras).toContain('space_mining');
      expect(system.activeEras).toContain('dyson_ring');
    });

    it('should not be active in early eras', () => {
      expect(system.activeEras).not.toContain('fossil');
      expect(system.activeEras).not.toContain('nuclear');
      expect(system.activeEras).not.toContain('solar');
    });
  });

  describe('update - orbital solar collectors', () => {
    it('should produce energy at flat rate with no weather penalty', () => {
      const state = createTestState();
      state.space.orbitalPlatforms = [
        { id: 'p1', type: 'solar_collector', level: 1, output: 10 },
      ];
      state.energy.stored = 50;
      state.energy.maxStorage = 500;
      // Set overcast weather - should NOT affect orbital collectors
      state.weather.current = 'overcast';

      const update = system.update(state, 5);
      const storedMutation = update.mutations?.find((m) => m.path === 'energy.stored');
      // 10 output * 5 ticks = 50 energy added → 50 + 50 = 100
      expect(storedMutation!.value).toBe(100);
    });

    it('should cap energy at maxStorage', () => {
      const state = createTestState();
      state.space.orbitalPlatforms = [
        { id: 'p1', type: 'solar_collector', level: 1, output: 100 },
      ];
      state.energy.stored = 450;
      state.energy.maxStorage = 500;

      const update = system.update(state, 5);
      const storedMutation = update.mutations?.find((m) => m.path === 'energy.stored');
      // 100 * 5 = 500, but cap at 500
      expect(storedMutation!.value).toBe(500);
    });

    it('should not produce energy from non-solar_collector platforms', () => {
      const state = createTestState();
      state.space.orbitalPlatforms = [
        { id: 'p1', type: 'station', level: 1, output: 10 },
        { id: 'p2', type: 'launch_platform', level: 1, output: 5 },
      ];
      state.energy.stored = 50;
      state.energy.maxStorage = 500;

      const update = system.update(state, 5);
      const storedMutation = update.mutations?.find((m) => m.path === 'energy.stored');
      // No solar collectors, so no energy produced
      expect(storedMutation).toBeUndefined();
    });

    it('should sum output from multiple solar collectors', () => {
      const state = createTestState();
      state.space.orbitalPlatforms = [
        { id: 'p1', type: 'solar_collector', level: 1, output: 10 },
        { id: 'p2', type: 'solar_collector', level: 2, output: 20 },
      ];
      state.energy.stored = 0;
      state.energy.maxStorage = 500;

      const update = system.update(state, 2);
      const storedMutation = update.mutations?.find((m) => m.path === 'energy.stored');
      // (10 + 20) * 2 = 60
      expect(storedMutation!.value).toBe(60);
    });
  });

  describe('update - territory production', () => {
    it('should produce materials from surveyed territories in space_mining era', () => {
      const state = createSpaceMiningState();
      state.materials.stockpiles.iron_ore = 0;
      state.materials.stockpiles.copper = 0;
      state.space.territories = [
        {
          id: 't1',
          name: 'Iron Rock',
          resourceProfile: { iron_ore: 0.8, copper: 0.2 } as Record<MaterialType, number>,
          depositQuality: 1.0,
          surveyed: true,
          miningLevel: 1,
          productionRate: 10,
        },
      ];

      const update = system.update(state, 1);
      // effectiveRate = 10 * 1.0 * 1 = 10
      // iron_ore: 10 * 0.8 * 1 = 8
      // copper: 10 * 0.2 * 1 = 2
      expect(update.materials?.stockpiles?.iron_ore).toBe(8);
      expect(update.materials?.stockpiles?.copper).toBe(2);
    });

    it('should not produce materials from unsurveyed territories', () => {
      const state = createSpaceMiningState();
      state.space.territories = [
        {
          id: 't1',
          name: 'Unknown Rock',
          resourceProfile: { iron_ore: 1.0 } as Record<MaterialType, number>,
          depositQuality: 0.8,
          surveyed: false,
          miningLevel: 1,
          productionRate: 10,
        },
      ];

      const update = system.update(state, 1);
      // Unsurveyed should not produce
      expect(update.materials?.stockpiles?.iron_ore).toBeUndefined();
    });

    it('should not produce territory materials in orbital era', () => {
      const state = createTestState(); // orbital era
      state.space.fleet = { size: 2, fuelCapacity: 100, currentFuel: 50 };
      state.space.territories = [
        {
          id: 't1',
          name: 'Test Rock',
          resourceProfile: { iron_ore: 1.0 } as Record<MaterialType, number>,
          depositQuality: 1.0,
          surveyed: true,
          miningLevel: 1,
          productionRate: 10,
        },
      ];

      const update = system.update(state, 1);
      // In orbital era, territories don't produce
      expect(update.materials?.stockpiles?.iron_ore).toBeUndefined();
    });

    it('should scale production with deposit quality and mining level', () => {
      const state = createSpaceMiningState();
      state.space.territories = [
        {
          id: 't1',
          name: 'Rich Rock',
          resourceProfile: { rare_earth: 1.0 } as Record<MaterialType, number>,
          depositQuality: 0.5,
          surveyed: true,
          miningLevel: 3,
          productionRate: 10,
        },
      ];

      const update = system.update(state, 2);
      // effectiveRate = 10 * 0.5 * 3 = 15
      // rare_earth: 15 * 1.0 * 2 ticks = 30
      expect(update.materials?.stockpiles?.rare_earth).toBe(30);
    });
  });

  describe('update - fuel consumption', () => {
    it('should consume fuel per territory per tick', () => {
      const state = createSpaceMiningState();
      state.space.territories = [
        {
          id: 't1',
          name: 'Rock 1',
          resourceProfile: { iron_ore: 1.0 } as Record<MaterialType, number>,
          depositQuality: 0.8,
          surveyed: true,
          miningLevel: 1,
          productionRate: 5,
        },
        {
          id: 't2',
          name: 'Rock 2',
          resourceProfile: { copper: 1.0 } as Record<MaterialType, number>,
          depositQuality: 0.5,
          surveyed: true,
          miningLevel: 1,
          productionRate: 5,
        },
      ];
      state.space.fleet.currentFuel = 50;

      const update = system.update(state, 10);
      const fuelMutation = update.mutations?.find((m) => m.path === 'space.fleet.currentFuel');
      // 2 territories * 0.1 fuel/territory/tick * 10 ticks = 2
      // 50 - 2 = 48
      expect(fuelMutation!.value).toBe(48);
    });

    it('should not reduce fuel below zero', () => {
      const state = createSpaceMiningState();
      state.space.territories = [
        {
          id: 't1',
          name: 'Rock 1',
          resourceProfile: { iron_ore: 1.0 } as Record<MaterialType, number>,
          depositQuality: 0.5,
          surveyed: true,
          miningLevel: 1,
          productionRate: 5,
        },
      ];
      state.space.fleet.currentFuel = 0.5;

      const update = system.update(state, 100);
      const fuelMutation = update.mutations?.find((m) => m.path === 'space.fleet.currentFuel');
      // 1 * 0.1 * 100 = 10 consumed, but only 0.5 available
      expect(fuelMutation!.value).toBe(0);
    });
  });

  describe('perform - build_orbital_platform', () => {
    it('should create a platform and deduct fuel + steel', () => {
      const state = createStateWithResources();

      const update = system.perform(state, {
        type: 'build_orbital_platform',
        payload: { type: 'solar_collector', output: 15 },
      });

      // Check costs deducted (10 fuel + 20 steel)
      expect(update.materials?.stockpiles?.fuel).toBe(90);
      expect(update.materials?.stockpiles?.steel).toBe(80);

      // Check platform created
      const platformsMutation = update.mutations?.find((m) => m.path === 'space.orbitalPlatforms');
      const platforms = platformsMutation!.value as any[];
      expect(platforms).toHaveLength(1);
      expect(platforms[0].type).toBe('solar_collector');
      expect(platforms[0].output).toBe(15);
    });

    it('should default to solar_collector type if not specified', () => {
      const state = createStateWithResources();

      const update = system.perform(state, {
        type: 'build_orbital_platform',
        payload: {},
      });

      const platformsMutation = update.mutations?.find((m) => m.path === 'space.orbitalPlatforms');
      const platforms = platformsMutation!.value as any[];
      expect(platforms[0].type).toBe('solar_collector');
    });

    it('should fail if insufficient resources', () => {
      const state = createTestState();
      state.materials.stockpiles.fuel = 5; // Not enough
      state.materials.stockpiles.steel = 100;

      const update = system.perform(state, {
        type: 'build_orbital_platform',
        payload: { type: 'solar_collector' },
      });

      // Should return empty update
      expect(update.mutations).toBeUndefined();
      expect(update.materials).toBeUndefined();
    });
  });

  describe('perform - claim_territory', () => {
    it('should claim a territory and deduct fuel + steel', () => {
      const state = createStateWithResources();
      state.space.fleet = { size: 2, fuelCapacity: 100, currentFuel: 50 };
      state.space.maxTerritories = 4;

      const update = system.perform(state, {
        type: 'claim_territory',
        payload: {
          name: 'Ceres Belt',
          resourceProfile: { iron_ore: 0.7, rare_earth: 0.3 },
          depositQuality: 0.8,
        },
      });

      // Check costs deducted (15 fuel + 10 steel)
      expect(update.materials?.stockpiles?.fuel).toBe(85);
      expect(update.materials?.stockpiles?.steel).toBe(90);

      // Check territory created
      const territoriesMutation = update.mutations?.find((m) => m.path === 'space.territories');
      const territories = territoriesMutation!.value as any[];
      expect(territories).toHaveLength(1);
      expect(territories[0].name).toBe('Ceres Belt');
      expect(territories[0].depositQuality).toBe(0.8);
      expect(territories[0].surveyed).toBe(false);
      expect(territories[0].miningLevel).toBe(1);
    });

    it('should fail if territory limit reached', () => {
      const state = createStateWithResources();
      state.space.fleet = { size: 1, fuelCapacity: 50, currentFuel: 50 };
      state.space.maxTerritories = 2;
      state.space.territories = [
        { id: 't1', name: 'A', resourceProfile: {} as any, depositQuality: 0.5, surveyed: true, miningLevel: 1, productionRate: 5 },
        { id: 't2', name: 'B', resourceProfile: {} as any, depositQuality: 0.5, surveyed: true, miningLevel: 1, productionRate: 5 },
      ];

      const update = system.perform(state, {
        type: 'claim_territory',
        payload: { name: 'New Territory' },
      });

      expect(update.mutations).toBeUndefined();
      expect(update.materials).toBeUndefined();
    });

    it('should fail if insufficient resources', () => {
      const state = createTestState();
      state.space.fleet = { size: 2, fuelCapacity: 100, currentFuel: 50 };
      state.materials.stockpiles.fuel = 5; // Not enough
      state.materials.stockpiles.steel = 100;

      const update = system.perform(state, {
        type: 'claim_territory',
        payload: { name: 'Test' },
      });

      expect(update.mutations).toBeUndefined();
    });
  });

  describe('perform - expand_fleet', () => {
    it('should increase fleet size and fuel capacity', () => {
      const state = createStateWithResources();
      state.space.fleet = { size: 1, fuelCapacity: 50, currentFuel: 30 };

      const update = system.perform(state, {
        type: 'expand_fleet',
        payload: {},
      });

      // Check costs deducted (30 steel + 10 electronics)
      expect(update.materials?.stockpiles?.steel).toBe(70);
      expect(update.materials?.stockpiles?.electronics).toBe(40);

      // Check fleet expanded
      const fleetMutation = update.mutations?.find((m) => m.path === 'space.fleet');
      expect(fleetMutation!.value).toEqual({
        size: 2,
        fuelCapacity: 100, // 50 + 50
        currentFuel: 30,
      });

      // Check maxTerritories updated
      const maxMutation = update.mutations?.find((m) => m.path === 'space.maxTerritories');
      expect(maxMutation!.value).toBe(4); // 2 * 2
    });

    it('should fail if insufficient steel', () => {
      const state = createTestState();
      state.materials.stockpiles.steel = 10; // Not enough
      state.materials.stockpiles.electronics = 50;

      const update = system.perform(state, {
        type: 'expand_fleet',
        payload: {},
      });

      expect(update.mutations).toBeUndefined();
    });

    it('should fail if insufficient electronics', () => {
      const state = createTestState();
      state.materials.stockpiles.steel = 50;
      state.materials.stockpiles.electronics = 5; // Not enough

      const update = system.perform(state, {
        type: 'expand_fleet',
        payload: {},
      });

      expect(update.mutations).toBeUndefined();
    });
  });

  describe('canPerform', () => {
    it('should return true for build_orbital_platform with sufficient resources', () => {
      const state = createStateWithResources();
      expect(system.canPerform(state, { type: 'build_orbital_platform', payload: {} })).toBe(true);
    });

    it('should return false for build_orbital_platform with insufficient fuel', () => {
      const state = createTestState();
      state.materials.stockpiles.fuel = 5;
      state.materials.stockpiles.steel = 100;
      expect(system.canPerform(state, { type: 'build_orbital_platform', payload: {} })).toBe(false);
    });

    it('should return false for build_orbital_platform with insufficient steel', () => {
      const state = createTestState();
      state.materials.stockpiles.fuel = 100;
      state.materials.stockpiles.steel = 5;
      expect(system.canPerform(state, { type: 'build_orbital_platform', payload: {} })).toBe(false);
    });

    it('should return true for claim_territory when under limit with resources', () => {
      const state = createStateWithResources();
      state.space.fleet = { size: 2, fuelCapacity: 100, currentFuel: 50 };
      expect(system.canPerform(state, { type: 'claim_territory', payload: {} })).toBe(true);
    });

    it('should return false for claim_territory when at limit', () => {
      const state = createStateWithResources();
      state.space.fleet = { size: 1, fuelCapacity: 50, currentFuel: 50 };
      state.space.territories = [
        { id: 't1', name: 'A', resourceProfile: {} as any, depositQuality: 0.5, surveyed: true, miningLevel: 1, productionRate: 5 },
        { id: 't2', name: 'B', resourceProfile: {} as any, depositQuality: 0.5, surveyed: true, miningLevel: 1, productionRate: 5 },
      ];
      expect(system.canPerform(state, { type: 'claim_territory', payload: {} })).toBe(false);
    });

    it('should return true for expand_fleet with sufficient resources', () => {
      const state = createStateWithResources();
      expect(system.canPerform(state, { type: 'expand_fleet', payload: {} })).toBe(true);
    });

    it('should return false for unknown action', () => {
      const state = createTestState();
      expect(system.canPerform(state, { type: 'unknown_action', payload: {} })).toBe(false);
    });
  });

  describe('territory resource profiles', () => {
    it('should handle iron-rich territory', () => {
      const state = createSpaceMiningState();
      state.materials.stockpiles.iron_ore = 0;
      state.materials.stockpiles.copper = 0;
      state.space.territories = [
        {
          id: 't1',
          name: 'Iron Belt',
          resourceProfile: { iron_ore: 0.9, copper: 0.1 } as Record<MaterialType, number>,
          depositQuality: 1.0,
          surveyed: true,
          miningLevel: 1,
          productionRate: 10,
        },
      ];

      const update = system.update(state, 1);
      expect(update.materials?.stockpiles?.iron_ore).toBe(9);
      expect(update.materials?.stockpiles?.copper).toBe(1);
    });

    it('should handle rare-earth-rich territory', () => {
      const state = createSpaceMiningState();
      state.space.territories = [
        {
          id: 't1',
          name: 'Rare Earth Rock',
          resourceProfile: { rare_earth: 0.8, silicon: 0.2 } as Record<MaterialType, number>,
          depositQuality: 0.7,
          surveyed: true,
          miningLevel: 2,
          productionRate: 8,
        },
      ];

      const update = system.update(state, 1);
      // effectiveRate = 8 * 0.7 * 2 = 11.2
      // rare_earth: 11.2 * 0.8 = 8.96
      // silicon: 11.2 * 0.2 = 2.24
      expect(update.materials?.stockpiles?.rare_earth).toBeCloseTo(8.96);
      expect(update.materials?.stockpiles?.silicon).toBeCloseTo(2.24);
    });

    it('should handle ice-rich territory', () => {
      const state = createSpaceMiningState();
      state.space.territories = [
        {
          id: 't1',
          name: 'Ice Rock',
          resourceProfile: { water: 0.7, fuel: 0.3 } as Record<MaterialType, number>,
          depositQuality: 0.9,
          surveyed: true,
          miningLevel: 1,
          productionRate: 6,
        },
      ];

      const update = system.update(state, 1);
      // effectiveRate = 6 * 0.9 * 1 = 5.4
      // water: 5.4 * 0.7 = 3.78
      // fuel: 5.4 * 0.3 = 1.62
      expect(update.materials?.stockpiles?.water).toBeCloseTo(3.78);
      expect(update.materials?.stockpiles?.fuel).toBeCloseTo(1.62);
    });
  });

  describe('territory limit based on fleet size', () => {
    it('maxTerritories should equal fleet.size * 2', () => {
      const state = createStateWithResources();
      state.space.fleet = { size: 3, fuelCapacity: 150, currentFuel: 100 };

      // Claim should set maxTerritories
      const update = system.perform(state, {
        type: 'claim_territory',
        payload: { name: 'Test', resourceProfile: { iron_ore: 1.0 }, depositQuality: 0.5 },
      });

      const maxMutation = update.mutations?.find((m) => m.path === 'space.maxTerritories');
      expect(maxMutation!.value).toBe(6); // 3 * 2
    });

    it('should allow claiming up to the limit', () => {
      const state = createStateWithResources();
      state.space.fleet = { size: 1, fuelCapacity: 50, currentFuel: 50 };
      state.space.territories = [
        { id: 't1', name: 'A', resourceProfile: {} as any, depositQuality: 0.5, surveyed: true, miningLevel: 1, productionRate: 5 },
      ];

      // fleet.size * 2 = 2, have 1 territory, should be able to claim one more
      expect(system.canPerform(state, { type: 'claim_territory', payload: {} })).toBe(true);
    });
  });
});
