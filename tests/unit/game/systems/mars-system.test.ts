import { describe, it, expect } from 'vitest';
import { MarsSystem } from '../../../../src/game/systems/mars-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState } from '../../../../src/game/core/types.js';
import type { MaterialType } from '../../../../src/game/core/resources.js';

function createMarsEraState(): GameState {
  const state = createInitialState('usa');
  state.currentEra = 'mars_colonization';
  return state;
}

function createStateWithResources(): GameState {
  const state = createMarsEraState();
  state.materials.stockpiles.fuel = 100;
  state.materials.stockpiles.steel = 100;
  state.materials.stockpiles.electronics = 50;
  return state;
}

function createUnlockedMarsState(): GameState {
  const state = createStateWithResources();
  state.mars.unlocked = true;
  state.mars.baseLevel = 1;
  state.mars.launchCostReduction = 0.62;
  state.mars.productionRates.regolith_iron = 2;
  state.mars.productionRates.martian_ice = 1.5;
  state.mars.productionRates.co2 = 1;
  return state;
}

describe('MarsSystem', () => {
  const system = new MarsSystem();

  describe('activeEras', () => {
    it('should be active from Mars Colonization Era onwards', () => {
      expect(system.activeEras).toContain('mars_colonization');
      expect(system.activeEras).toContain('space_mining');
      expect(system.activeEras).toContain('dyson_ring');
    });

    it('should not be active in early eras', () => {
      expect(system.activeEras).not.toContain('fossil');
      expect(system.activeEras).not.toContain('nuclear');
      expect(system.activeEras).not.toContain('solar');
      expect(system.activeEras).not.toContain('orbital');
    });
  });

  describe('update - Mars resource production', () => {
    it('should produce regolith_iron, martian_ice, and co2 when Mars is unlocked', () => {
      const state = createUnlockedMarsState();

      const update = system.update(state, 1);
      const marsResources = update.mutations?.find((m) => m.path === 'mars.resources');
      const resources = marsResources!.value as Record<MaterialType, number>;

      // baseLevel 1: regolith_iron = 1*2 = 2, martian_ice = 1*1.5 = 1.5, co2 = 1*1 = 1
      expect(resources.regolith_iron).toBe(2);
      expect(resources.martian_ice).toBe(1.5);
      expect(resources.co2).toBe(1);
    });

    it('should scale production with baseLevel', () => {
      const state = createUnlockedMarsState();
      state.mars.baseLevel = 3;

      const update = system.update(state, 1);
      const marsResources = update.mutations?.find((m) => m.path === 'mars.resources');
      const resources = marsResources!.value as Record<MaterialType, number>;

      // baseLevel 3: regolith_iron = 3*2 = 6, martian_ice = 3*1.5 = 4.5, co2 = 3*1 = 3
      expect(resources.regolith_iron).toBe(6);
      expect(resources.martian_ice).toBe(4.5);
      expect(resources.co2).toBe(3);
    });

    it('should scale production with deltaTicks', () => {
      const state = createUnlockedMarsState();

      const update = system.update(state, 5);
      const marsResources = update.mutations?.find((m) => m.path === 'mars.resources');
      const resources = marsResources!.value as Record<MaterialType, number>;

      // baseLevel 1, 5 ticks: regolith_iron = 1*2*5 = 10, martian_ice = 1*1.5*5 = 7.5, co2 = 1*1*5 = 5
      expect(resources.regolith_iron).toBe(10);
      expect(resources.martian_ice).toBe(7.5);
      expect(resources.co2).toBe(5);
    });

    it('should accumulate resources over multiple updates', () => {
      const state = createUnlockedMarsState();
      state.mars.resources.regolith_iron = 10;
      state.mars.resources.martian_ice = 5;
      state.mars.resources.co2 = 3;

      const update = system.update(state, 1);
      const marsResources = update.mutations?.find((m) => m.path === 'mars.resources');
      const resources = marsResources!.value as Record<MaterialType, number>;

      expect(resources.regolith_iron).toBe(12); // 10 + 2
      expect(resources.martian_ice).toBe(6.5); // 5 + 1.5
      expect(resources.co2).toBe(4); // 3 + 1
    });

    it('should not produce resources when Mars is not unlocked', () => {
      const state = createMarsEraState();
      state.mars.unlocked = false;

      const update = system.update(state, 1);
      expect(update.mutations).toBeUndefined();
    });

    it('should not produce resources when baseLevel is 0', () => {
      const state = createMarsEraState();
      state.mars.unlocked = true;
      state.mars.baseLevel = 0;

      const update = system.update(state, 1);
      expect(update.mutations).toBeUndefined();
    });
  });

  describe('perform - build_mars_base', () => {
    it('should build Mars base and deduct resources', () => {
      const state = createStateWithResources();

      const update = system.perform(state, {
        type: 'build_mars_base',
        payload: {},
      });

      // Check costs deducted: 50 fuel + 30 steel + 20 electronics
      expect(update.materials?.stockpiles?.fuel).toBe(50); // 100 - 50
      expect(update.materials?.stockpiles?.steel).toBe(70); // 100 - 30
      expect(update.materials?.stockpiles?.electronics).toBe(30); // 50 - 20

      // Check Mars state mutations
      const unlockedMutation = update.mutations?.find((m) => m.path === 'mars.unlocked');
      expect(unlockedMutation!.value).toBe(true);

      const levelMutation = update.mutations?.find((m) => m.path === 'mars.baseLevel');
      expect(levelMutation!.value).toBe(1);

      const launchMutation = update.mutations?.find((m) => m.path === 'mars.launchCostReduction');
      expect(launchMutation!.value).toBe(0.62);

      const ratesMutation = update.mutations?.find((m) => m.path === 'mars.productionRates');
      const rates = ratesMutation!.value as Record<string, number>;
      expect(rates.regolith_iron).toBe(2);
      expect(rates.martian_ice).toBe(1.5);
      expect(rates.co2).toBe(1);
    });

    it('should fail if Mars is already unlocked', () => {
      const state = createUnlockedMarsState();

      const update = system.perform(state, {
        type: 'build_mars_base',
        payload: {},
      });

      expect(update.mutations).toBeUndefined();
      expect(update.materials).toBeUndefined();
    });

    it('should fail if insufficient fuel', () => {
      const state = createMarsEraState();
      state.materials.stockpiles.fuel = 10; // Not enough (need 50)
      state.materials.stockpiles.steel = 100;
      state.materials.stockpiles.electronics = 50;

      const update = system.perform(state, {
        type: 'build_mars_base',
        payload: {},
      });

      expect(update.mutations).toBeUndefined();
    });

    it('should fail if insufficient steel', () => {
      const state = createMarsEraState();
      state.materials.stockpiles.fuel = 100;
      state.materials.stockpiles.steel = 10; // Not enough (need 30)
      state.materials.stockpiles.electronics = 50;

      const update = system.perform(state, {
        type: 'build_mars_base',
        payload: {},
      });

      expect(update.mutations).toBeUndefined();
    });

    it('should fail if insufficient electronics', () => {
      const state = createMarsEraState();
      state.materials.stockpiles.fuel = 100;
      state.materials.stockpiles.steel = 100;
      state.materials.stockpiles.electronics = 5; // Not enough (need 20)

      const update = system.perform(state, {
        type: 'build_mars_base',
        payload: {},
      });

      expect(update.mutations).toBeUndefined();
    });
  });

  describe('perform - upgrade_mars_base', () => {
    it('should upgrade Mars base level and update production rates', () => {
      const state = createUnlockedMarsState();

      const update = system.perform(state, {
        type: 'upgrade_mars_base',
        payload: {},
      });

      // Check costs deducted: 20 fuel + 15 steel
      expect(update.materials?.stockpiles?.fuel).toBe(80); // 100 - 20
      expect(update.materials?.stockpiles?.steel).toBe(85); // 100 - 15

      // Check level increased
      const levelMutation = update.mutations?.find((m) => m.path === 'mars.baseLevel');
      expect(levelMutation!.value).toBe(2);

      // Check production rates updated
      const ratesMutation = update.mutations?.find((m) => m.path === 'mars.productionRates');
      const rates = ratesMutation!.value as Record<string, number>;
      expect(rates.regolith_iron).toBe(4); // 2 * 2
      expect(rates.martian_ice).toBe(3); // 2 * 1.5
      expect(rates.co2).toBe(2); // 2 * 1
    });

    it('should fail if Mars is not unlocked', () => {
      const state = createStateWithResources();

      const update = system.perform(state, {
        type: 'upgrade_mars_base',
        payload: {},
      });

      expect(update.mutations).toBeUndefined();
    });

    it('should fail if insufficient resources', () => {
      const state = createUnlockedMarsState();
      state.materials.stockpiles.fuel = 5; // Not enough (need 20)
      state.materials.stockpiles.steel = 5; // Not enough (need 15)

      const update = system.perform(state, {
        type: 'upgrade_mars_base',
        payload: {},
      });

      expect(update.mutations).toBeUndefined();
    });
  });

  describe('perform - transfer_to_earth', () => {
    it('should transfer material from Mars to Earth and deduct fuel', () => {
      const state = createUnlockedMarsState();
      state.mars.resources.regolith_iron = 50;
      state.materials.stockpiles.fuel = 100;

      const update = system.perform(state, {
        type: 'transfer_to_earth',
        payload: { material: 'regolith_iron', amount: 20 },
      });

      // Fuel cost: ceil((20 / 10) * 0.62) = ceil(1.24) = 2
      expect(update.materials?.stockpiles?.fuel).toBe(98); // 100 - 2
      expect(update.materials?.stockpiles?.regolith_iron).toBe(20); // 0 + 20

      // Mars resources should be reduced
      const marsResources = update.mutations?.find((m) => m.path === 'mars.resources');
      const resources = marsResources!.value as Record<MaterialType, number>;
      expect(resources.regolith_iron).toBe(30); // 50 - 20
    });

    it('should apply launch cost reduction to Mars→Earth transfers', () => {
      const state = createUnlockedMarsState();
      state.mars.resources.regolith_iron = 100;
      state.materials.stockpiles.fuel = 100;

      const update = system.perform(state, {
        type: 'transfer_to_earth',
        payload: { material: 'regolith_iron', amount: 100 },
      });

      // Fuel cost: ceil((100 / 10) * 0.62) = ceil(6.2) = 7
      expect(update.materials?.stockpiles?.fuel).toBe(93); // 100 - 7
    });

    it('should fail if Mars does not have enough material', () => {
      const state = createUnlockedMarsState();
      state.mars.resources.regolith_iron = 5;

      const update = system.perform(state, {
        type: 'transfer_to_earth',
        payload: { material: 'regolith_iron', amount: 20 },
      });

      expect(update.mutations).toBeUndefined();
    });

    it('should fail if Mars is not unlocked', () => {
      const state = createMarsEraState();

      const update = system.perform(state, {
        type: 'transfer_to_earth',
        payload: { material: 'regolith_iron', amount: 10 },
      });

      expect(update.mutations).toBeUndefined();
    });
  });

  describe('perform - transfer_to_mars', () => {
    it('should transfer material from Earth to Mars and deduct fuel', () => {
      const state = createUnlockedMarsState();
      state.materials.stockpiles.steel = 100;
      state.materials.stockpiles.fuel = 100;

      const update = system.perform(state, {
        type: 'transfer_to_mars',
        payload: { material: 'steel', amount: 20 },
      });

      // Fuel cost: ceil(20 / 5) = 4
      expect(update.materials?.stockpiles?.fuel).toBe(96); // 100 - 4
      expect(update.materials?.stockpiles?.steel).toBe(80); // 100 - 20

      // Mars resources should be increased
      const marsResources = update.mutations?.find((m) => m.path === 'mars.resources');
      const resources = marsResources!.value as Record<MaterialType, number>;
      expect(resources.steel).toBe(20); // 0 + 20
    });

    it('should not apply launch cost reduction for Earth→Mars transfers', () => {
      const state = createUnlockedMarsState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.fuel = 200;

      const update = system.perform(state, {
        type: 'transfer_to_mars',
        payload: { material: 'steel', amount: 100 },
      });

      // Fuel cost: ceil(100 / 5) = 20 (no reduction)
      expect(update.materials?.stockpiles?.fuel).toBe(180); // 200 - 20
    });

    it('should fail if Earth does not have enough material', () => {
      const state = createUnlockedMarsState();
      state.materials.stockpiles.steel = 5; // Not enough
      state.materials.stockpiles.fuel = 100;

      const update = system.perform(state, {
        type: 'transfer_to_mars',
        payload: { material: 'steel', amount: 20 },
      });

      expect(update.mutations).toBeUndefined();
    });

    it('should fail if Earth does not have enough fuel for transfer', () => {
      const state = createUnlockedMarsState();
      state.materials.stockpiles.steel = 100;
      state.materials.stockpiles.fuel = 1; // Not enough (need ceil(20/5) = 4)

      const update = system.perform(state, {
        type: 'transfer_to_mars',
        payload: { material: 'steel', amount: 20 },
      });

      expect(update.mutations).toBeUndefined();
    });

    it('should fail if Mars is not unlocked', () => {
      const state = createMarsEraState();
      state.materials.stockpiles.steel = 100;
      state.materials.stockpiles.fuel = 100;

      const update = system.perform(state, {
        type: 'transfer_to_mars',
        payload: { material: 'steel', amount: 10 },
      });

      expect(update.mutations).toBeUndefined();
    });
  });

  describe('canPerform', () => {
    it('should return true for build_mars_base with sufficient resources', () => {
      const state = createStateWithResources();
      expect(system.canPerform(state, { type: 'build_mars_base', payload: {} })).toBe(true);
    });

    it('should return false for build_mars_base when already unlocked', () => {
      const state = createUnlockedMarsState();
      expect(system.canPerform(state, { type: 'build_mars_base', payload: {} })).toBe(false);
    });

    it('should return true for upgrade_mars_base with sufficient resources', () => {
      const state = createUnlockedMarsState();
      expect(system.canPerform(state, { type: 'upgrade_mars_base', payload: {} })).toBe(true);
    });

    it('should return false for upgrade_mars_base when not unlocked', () => {
      const state = createStateWithResources();
      expect(system.canPerform(state, { type: 'upgrade_mars_base', payload: {} })).toBe(false);
    });

    it('should return true for transfer_to_earth with valid payload', () => {
      const state = createUnlockedMarsState();
      state.mars.resources.regolith_iron = 50;
      state.materials.stockpiles.fuel = 100;
      expect(system.canPerform(state, { type: 'transfer_to_earth', payload: { material: 'regolith_iron', amount: 10 } })).toBe(true);
    });

    it('should return true for transfer_to_mars with valid payload', () => {
      const state = createUnlockedMarsState();
      state.materials.stockpiles.steel = 100;
      state.materials.stockpiles.fuel = 100;
      expect(system.canPerform(state, { type: 'transfer_to_mars', payload: { material: 'steel', amount: 10 } })).toBe(true);
    });

    it('should return false for unknown action', () => {
      const state = createUnlockedMarsState();
      expect(system.canPerform(state, { type: 'unknown_action', payload: {} })).toBe(false);
    });
  });

  describe('launch cost reduction', () => {
    it('should set launchCostReduction to 0.62 on base construction', () => {
      const state = createStateWithResources();

      const update = system.perform(state, {
        type: 'build_mars_base',
        payload: {},
      });

      const launchMutation = update.mutations?.find((m) => m.path === 'mars.launchCostReduction');
      expect(launchMutation!.value).toBe(0.62);
    });

    it('Mars→Earth transfer cost should be 38% cheaper than full price', () => {
      const state = createUnlockedMarsState();
      state.mars.resources.co2 = 100;
      state.materials.stockpiles.fuel = 100;

      // Transfer 50 units: full cost = ceil(50/10) = 5, reduced = ceil(5 * 0.62) = ceil(3.1) = 4
      const update = system.perform(state, {
        type: 'transfer_to_earth',
        payload: { material: 'co2', amount: 50 },
      });

      // Fuel cost: ceil((50 / 10) * 0.62) = ceil(3.1) = 4
      expect(update.materials?.stockpiles?.fuel).toBe(96); // 100 - 4
    });
  });
});
