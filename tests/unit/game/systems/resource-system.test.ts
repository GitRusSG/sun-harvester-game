import { describe, it, expect } from 'vitest';
import { ResourceSystem } from '../../../../src/game/systems/resource-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState } from '../../../../src/game/core/types.js';
import type { SolarPanel, PowerPlant } from '../../../../src/game/core/resources.js';

function createTestState(): GameState {
  return createInitialState('usa');
}

describe('ResourceSystem', () => {
  const system = new ResourceSystem();

  describe('basic properties', () => {
    it('should have id "resources"', () => {
      expect(system.id).toBe('resources');
    });

    it('should be active in all eras', () => {
      expect(system.activeEras).toHaveLength(7);
      expect(system.activeEras).toContain('fossil');
      expect(system.activeEras).toContain('dyson_ring');
    });
  });

  describe('applyWeatherModifier', () => {
    it('should return full output for sunny weather', () => {
      expect(system.applyWeatherModifier(100, 'sunny')).toBe(100);
    });

    it('should return 70% for partly_cloudy', () => {
      expect(system.applyWeatherModifier(100, 'partly_cloudy')).toBeCloseTo(70);
    });

    it('should return 40% for overcast', () => {
      expect(system.applyWeatherModifier(100, 'overcast')).toBeCloseTo(40);
    });

    it('should return 20% for rainy', () => {
      expect(system.applyWeatherModifier(100, 'rainy')).toBeCloseTo(20);
    });
  });

  describe('calculateProduction', () => {
    it('should return zero production for empty state', () => {
      const state = createTestState();
      const report = system.calculateProduction(state);

      expect(report.energyPerSecond).toBe(0);
      expect(report.maintenanceCostPerSecond).toBe(0);
    });

    it('should calculate solar panel output with weather modifier', () => {
      const state = createTestState();
      const panel: SolarPanel = {
        id: 'panel-1',
        locationId: 'loc-1',
        efficiency: 1.0,
        baseOutput: 10,
      };
      state.energy.solarPanels = [panel];
      state.weather.current = 'sunny';

      const report = system.calculateProduction(state);
      // 10 * 1.0 * 1.0 (sunny) * 0.8 (default irradiance) = 8
      expect(report.energyPerSecond).toBeCloseTo(8);
    });

    it('should reduce solar output in cloudy weather', () => {
      const state = createTestState();
      const panel: SolarPanel = {
        id: 'panel-1',
        locationId: 'loc-1',
        efficiency: 1.0,
        baseOutput: 10,
      };
      state.energy.solarPanels = [panel];
      state.weather.current = 'overcast';

      const report = system.calculateProduction(state);
      // 10 * 1.0 * 0.4 (overcast) * 0.8 (default irradiance) = 3.2
      expect(report.energyPerSecond).toBeCloseTo(3.2);
    });

    it('should sum multiple solar panels', () => {
      const state = createTestState();
      state.energy.solarPanels = [
        { id: 'p1', locationId: 'loc-1', efficiency: 1.0, baseOutput: 10 },
        { id: 'p2', locationId: 'loc-2', efficiency: 0.5, baseOutput: 20 },
      ];
      state.weather.current = 'sunny';

      const report = system.calculateProduction(state);
      // p1: 10*1.0*1.0*0.8 = 8, p2: 20*0.5*1.0*0.8 = 8, total = 16
      expect(report.energyPerSecond).toBeCloseTo(16);
    });

    it('should calculate power plant output when fuel is available', () => {
      const state = createTestState();
      const plant: PowerPlant = {
        id: 'plant-1',
        type: 'coal',
        level: 1,
        fuelType: 'coal',
        consumptionRate: 2,
        outputRate: 15,
        active: true,
      };
      state.energy.powerPlants = [plant];
      state.materials.stockpiles.coal = 100;

      const report = system.calculateProduction(state);
      expect(report.energyPerSecond).toBe(15);
    });

    it('should halt power plant when fuel is depleted', () => {
      const state = createTestState();
      const plant: PowerPlant = {
        id: 'plant-1',
        type: 'coal',
        level: 1,
        fuelType: 'coal',
        consumptionRate: 2,
        outputRate: 15,
        active: true,
      };
      state.energy.powerPlants = [plant];
      state.materials.stockpiles.coal = 1; // less than consumptionRate

      const report = system.calculateProduction(state);
      expect(report.energyPerSecond).toBe(0);
    });

    it('should not produce from inactive power plants', () => {
      const state = createTestState();
      const plant: PowerPlant = {
        id: 'plant-1',
        type: 'coal',
        level: 1,
        fuelType: 'coal',
        consumptionRate: 2,
        outputRate: 15,
        active: false,
      };
      state.energy.powerPlants = [plant];
      state.materials.stockpiles.coal = 100;

      const report = system.calculateProduction(state);
      expect(report.energyPerSecond).toBe(0);
    });

    it('should calculate revenue from stored energy with dynamic pricing', () => {
      const state = createTestState();
      state.energy.stored = 500;
      state.energy.distributionRate = 1;

      const report = system.calculateProduction(state);
      // pricePerUnit = 1.0 / (1 + 500 / 10000) = 1 / 1.05 ≈ 0.9524
      // revenue = 500 * 1 * 0.9524 ≈ 476.19
      expect(report.currencyPerSecond).toBeCloseTo(500 / 1.05);
    });

    it('should return zero revenue when no stored energy', () => {
      const state = createTestState();
      state.energy.stored = 0;

      const report = system.calculateProduction(state);
      expect(report.currencyPerSecond).toBe(0);
    });

    it('should calculate maintenance costs based on infrastructure', () => {
      const state = createTestState();
      state.energy.solarPanels = [
        { id: 'p1', locationId: 'loc-1', efficiency: 1.0, baseOutput: 10 },
      ];
      state.energy.powerPlants = [
        { id: 'pp1', type: 'coal', level: 1, fuelType: 'coal', consumptionRate: 1, outputRate: 5, active: true },
      ];
      state.infrastructure.mines = [
        { id: 'm1', materialType: 'coal', level: 1, depositQuality: 0.8, productionRate: 3 },
      ];
      state.infrastructure.factories = [
        { id: 'f1', type: 'crafting', level: 1, currentOrders: [], automatedRecipes: [] },
      ];

      const report = system.calculateProduction(state);
      // 1*0.5 + 1*2 + 1*1 + 1*1.5 = 5.0
      expect(report.maintenanceCostPerSecond).toBe(5.0);
    });

    it('should calculate material rates from mines', () => {
      const state = createTestState();
      state.infrastructure.mines = [
        { id: 'm1', materialType: 'coal', level: 1, depositQuality: 0.8, productionRate: 3 },
        { id: 'm2', materialType: 'iron_ore', level: 2, depositQuality: 0.6, productionRate: 5 },
        { id: 'm3', materialType: 'coal', level: 1, depositQuality: 0.5, productionRate: 2 },
      ];

      const report = system.calculateProduction(state);
      expect(report.materialRates.coal).toBe(5);
      expect(report.materialRates.iron_ore).toBe(5);
      expect(report.materialRates.silicon).toBe(0);
    });
  });

  describe('calculateOfflineEarnings', () => {
    it('should cap offline earnings at 24 hours', () => {
      const state = createTestState();
      state.energy.solarPanels = [
        { id: 'p1', locationId: 'loc-1', efficiency: 1.0, baseOutput: 10 },
      ];
      state.weather.current = 'sunny';

      const earnings48h = system.calculateOfflineEarnings(state, 86400 * 2);
      const earnings24h = system.calculateOfflineEarnings(state, 86400);

      // Both should produce same result due to 24h cap
      expect(earnings48h.energy).toBe(earnings24h.energy);
    });

    it('should calculate energy gain capped at storage', () => {
      const state = createTestState();
      state.energy.solarPanels = [
        { id: 'p1', locationId: 'loc-1', efficiency: 1.0, baseOutput: 10 },
      ];
      state.weather.current = 'sunny';
      state.energy.stored = 400;
      state.energy.maxStorage = 500;

      const earnings = system.calculateOfflineEarnings(state, 100);
      // Available storage = 100
      // Energy generated = 8 * 100 = 800, but capped at available storage = 100
      expect(earnings.energy).toBe(100);
    });

    it('should include material production in offline earnings', () => {
      const state = createTestState();
      state.infrastructure.mines = [
        { id: 'm1', materialType: 'coal', level: 1, depositQuality: 0.8, productionRate: 3 },
      ];

      const earnings = system.calculateOfflineEarnings(state, 60);
      expect(earnings.materials.coal).toBe(180); // 3 * 60
    });
  });

  describe('update', () => {
    it('should increase stored energy based on production', () => {
      const state = createTestState();
      state.energy.solarPanels = [
        { id: 'p1', locationId: 'loc-1', efficiency: 1.0, baseOutput: 10 },
      ];
      state.weather.current = 'sunny';
      state.energy.stored = 0;
      state.energy.maxStorage = 1000;

      const update = system.update(state, 1);
      // energyPerSecond = 10 * 1.0 * 1.0 * 0.8 = 8
      const storedMutation = update.mutations?.find(m => m.path === 'energy.stored');
      expect(storedMutation?.value).toBeCloseTo(8);
    });

    it('should cap stored energy at maxStorage', () => {
      const state = createTestState();
      state.energy.solarPanels = [
        { id: 'p1', locationId: 'loc-1', efficiency: 1.0, baseOutput: 100 },
      ];
      state.weather.current = 'sunny';
      state.energy.stored = 490;
      state.energy.maxStorage = 500;

      const update = system.update(state, 1);
      const storedMutation = update.mutations?.find(m => m.path === 'energy.stored');
      expect(storedMutation?.value).toBe(500);
    });

    it('should emit zero-currency event when currency depletes', () => {
      const state = createTestState();
      state.resources.currency = 0;
      // Add infrastructure for maintenance cost
      state.energy.powerPlants = [
        { id: 'pp1', type: 'coal', level: 1, fuelType: 'coal', consumptionRate: 1, outputRate: 5, active: true },
      ];
      state.materials.stockpiles.coal = 100;

      const update = system.update(state, 1);
      expect(update.resources?.currency).toBe(0);
      expect(update.events).toBeDefined();
      expect(update.events!.length).toBeGreaterThan(0);
      expect(update.events![0].payload.cause).toBe('zero_currency');
    });

    it('should consume fuel from power plants', () => {
      const state = createTestState();
      state.energy.powerPlants = [
        { id: 'pp1', type: 'coal', level: 1, fuelType: 'coal', consumptionRate: 2, outputRate: 10, active: true },
      ];
      state.materials.stockpiles.coal = 100;

      const update = system.update(state, 5);
      // Consumes 2 * 5 = 10 coal
      expect(update.materials?.stockpiles?.coal).toBe(90);
    });

    it('should update income and expense rates in resource state', () => {
      const state = createTestState();
      state.energy.stored = 1000;
      state.energy.distributionRate = 1;
      state.energy.solarPanels = [
        { id: 'p1', locationId: 'loc-1', efficiency: 1.0, baseOutput: 10 },
      ];

      const update = system.update(state, 1);
      expect(update.resources?.incomeRate).toBeGreaterThan(0);
      expect(update.resources?.expenseRate).toBe(0.5); // 1 panel * 0.5
    });
  });

  describe('canPerform', () => {
    it('should block construction actions when currency is zero', () => {
      const state = createTestState();
      state.resources.currency = 0;

      expect(system.canPerform(state, { type: 'build_solar_panel', payload: {} })).toBe(false);
      expect(system.canPerform(state, { type: 'build_power_plant', payload: {} })).toBe(false);
      expect(system.canPerform(state, { type: 'build_mine', payload: {} })).toBe(false);
      expect(system.canPerform(state, { type: 'build_factory', payload: {} })).toBe(false);
      expect(system.canPerform(state, { type: 'build_distribution_network', payload: {} })).toBe(false);
    });

    it('should allow construction actions when currency is positive', () => {
      const state = createTestState();
      state.resources.currency = 100;

      expect(system.canPerform(state, { type: 'build_solar_panel', payload: {} })).toBe(true);
      expect(system.canPerform(state, { type: 'build_power_plant', payload: {} })).toBe(true);
    });

    it('should allow non-construction actions even with zero currency', () => {
      const state = createTestState();
      state.resources.currency = 0;

      expect(system.canPerform(state, { type: 'sell_energy', payload: {} })).toBe(true);
    });

    it('should block action when currency is less than cost', () => {
      const state = createTestState();
      state.resources.currency = 50;

      expect(system.canPerform(state, { type: 'build_solar_panel', payload: { cost: 100 } })).toBe(false);
    });

    it('should allow action when currency equals cost', () => {
      const state = createTestState();
      state.resources.currency = 100;

      expect(system.canPerform(state, { type: 'build_solar_panel', payload: { cost: 100 } })).toBe(true);
    });

    it('should block nuclear power plant in fossil era', () => {
      const state = createTestState();
      state.resources.currency = 1000;
      state.currentEra = 'fossil';

      expect(system.canPerform(state, { type: 'build_power_plant', payload: { type: 'nuclear', cost: 200 } })).toBe(false);
    });

    it('should allow nuclear power plant in nuclear era', () => {
      const state = createTestState();
      state.resources.currency = 1000;
      state.currentEra = 'nuclear';

      expect(system.canPerform(state, { type: 'build_power_plant', payload: { type: 'nuclear', cost: 200 } })).toBe(true);
    });

    it('should allow coal power plant in fossil era', () => {
      const state = createTestState();
      state.resources.currency = 1000;
      state.currentEra = 'fossil';

      expect(system.canPerform(state, { type: 'build_power_plant', payload: { type: 'coal', cost: 100 } })).toBe(true);
    });
  });

  describe('perform', () => {
    describe('build_solar_panel', () => {
      it('should deduct cost from currency', () => {
        const state = createTestState();
        state.resources.currency = 500;

        const update = system.perform(state, {
          type: 'build_solar_panel',
          payload: { locationId: 'loc-1', cost: 100 },
        });

        expect(update.resources?.currency).toBe(400);
      });

      it('should create a solar panel with correct properties', () => {
        const state = createTestState();
        state.resources.currency = 500;

        const update = system.perform(state, {
          type: 'build_solar_panel',
          payload: { locationId: 'loc-1', cost: 100 },
        });

        const panelsMutation = update.mutations?.find(m => m.path === 'energy.solarPanels');
        expect(panelsMutation).toBeDefined();

        const panels = panelsMutation!.value as SolarPanel[];
        expect(panels).toHaveLength(1);
        expect(panels[0].locationId).toBe('loc-1');
        expect(panels[0].efficiency).toBe(1.0);
        expect(panels[0].baseOutput).toBe(10);
        expect(panels[0].id).toBeDefined();
      });

      it('should append to existing solar panels', () => {
        const state = createTestState();
        state.resources.currency = 500;
        state.energy.solarPanels = [
          { id: 'existing', locationId: 'loc-0', efficiency: 0.9, baseOutput: 8 },
        ];

        const update = system.perform(state, {
          type: 'build_solar_panel',
          payload: { locationId: 'loc-1', cost: 100 },
        });

        const panelsMutation = update.mutations?.find(m => m.path === 'energy.solarPanels');
        const panels = panelsMutation!.value as SolarPanel[];
        expect(panels).toHaveLength(2);
        expect(panels[0].id).toBe('existing');
        expect(panels[1].locationId).toBe('loc-1');
      });
    });

    describe('build_power_plant', () => {
      it('should build a coal power plant with correct properties', () => {
        const state = createTestState();
        state.resources.currency = 500;

        const update = system.perform(state, {
          type: 'build_power_plant',
          payload: { type: 'coal', cost: 150 },
        });

        expect(update.resources?.currency).toBe(350);
        const plantsMutation = update.mutations?.find(m => m.path === 'energy.powerPlants');
        expect(plantsMutation).toBeDefined();

        const plants = plantsMutation!.value as PowerPlant[];
        expect(plants).toHaveLength(1);
        expect(plants[0].type).toBe('coal');
        expect(plants[0].fuelType).toBe('coal');
        expect(plants[0].consumptionRate).toBe(2);
        expect(plants[0].outputRate).toBe(15);
        expect(plants[0].active).toBe(true);
        expect(plants[0].level).toBe(1);
      });

      it('should build a nuclear power plant with correct properties', () => {
        const state = createTestState();
        state.resources.currency = 1000;
        state.currentEra = 'nuclear';

        const update = system.perform(state, {
          type: 'build_power_plant',
          payload: { type: 'nuclear', cost: 300 },
        });

        expect(update.resources?.currency).toBe(700);
        const plantsMutation = update.mutations?.find(m => m.path === 'energy.powerPlants');
        const plants = plantsMutation!.value as PowerPlant[];
        expect(plants).toHaveLength(1);
        expect(plants[0].type).toBe('nuclear');
        expect(plants[0].fuelType).toBe('uranium');
        expect(plants[0].consumptionRate).toBe(1);
        expect(plants[0].outputRate).toBe(40);
        expect(plants[0].active).toBe(true);
      });
    });

    describe('build_mine', () => {
      it('should build a mine with correct properties', () => {
        const state = createTestState();
        state.resources.currency = 500;

        const update = system.perform(state, {
          type: 'build_mine',
          payload: { materialType: 'iron_ore', cost: 80, depositQuality: 0.8 },
        });

        expect(update.resources?.currency).toBe(420);
        const minesMutation = update.mutations?.find(m => m.path === 'infrastructure.mines');
        expect(minesMutation).toBeDefined();

        const mines = minesMutation!.value as Array<{ id: string; materialType: string; level: number; depositQuality: number; productionRate: number }>;
        expect(mines).toHaveLength(1);
        expect(mines[0].materialType).toBe('iron_ore');
        expect(mines[0].level).toBe(1);
        expect(mines[0].depositQuality).toBe(0.8);
        expect(mines[0].productionRate).toBe(4); // 0.8 * 5
      });

      it('should calculate production rate from deposit quality', () => {
        const state = createTestState();
        state.resources.currency = 500;

        const update = system.perform(state, {
          type: 'build_mine',
          payload: { materialType: 'coal', cost: 50, depositQuality: 0.5 },
        });

        const minesMutation = update.mutations?.find(m => m.path === 'infrastructure.mines');
        const mines = minesMutation!.value as Array<{ productionRate: number }>;
        expect(mines[0].productionRate).toBe(2.5); // 0.5 * 5
      });
    });

    describe('build_distribution_network', () => {
      it('should build a distribution network with correct properties', () => {
        const state = createTestState();
        state.resources.currency = 500;

        const update = system.perform(state, {
          type: 'build_distribution_network',
          payload: { cost: 200 },
        });

        expect(update.resources?.currency).toBe(300);
        const networksMutation = update.mutations?.find(m => m.path === 'infrastructure.distributionNetworks');
        expect(networksMutation).toBeDefined();

        const networks = networksMutation!.value as Array<{ id: string; level: number; conversionBonus: number }>;
        expect(networks).toHaveLength(1);
        expect(networks[0].level).toBe(1);
        expect(networks[0].conversionBonus).toBe(0.1);
      });

      it('should increase distribution rate by 0.1', () => {
        const state = createTestState();
        state.resources.currency = 500;
        state.energy.distributionRate = 1.0;

        const update = system.perform(state, {
          type: 'build_distribution_network',
          payload: { cost: 200 },
        });

        const rateMutation = update.mutations?.find(m => m.path === 'energy.distributionRate');
        expect(rateMutation).toBeDefined();
        expect(rateMutation!.value).toBeCloseTo(1.1);
      });

      it('should stack distribution rate with multiple networks', () => {
        const state = createTestState();
        state.resources.currency = 500;
        state.energy.distributionRate = 1.2; // already has 2 networks
        state.infrastructure.distributionNetworks = [
          { id: 'dn1', level: 1, conversionBonus: 0.1 },
          { id: 'dn2', level: 1, conversionBonus: 0.1 },
        ];

        const update = system.perform(state, {
          type: 'build_distribution_network',
          payload: { cost: 200 },
        });

        const rateMutation = update.mutations?.find(m => m.path === 'energy.distributionRate');
        expect(rateMutation!.value).toBeCloseTo(1.3);

        const networksMutation = update.mutations?.find(m => m.path === 'infrastructure.distributionNetworks');
        const networks = networksMutation!.value as Array<{ id: string }>;
        expect(networks).toHaveLength(3);
      });
    });

    it('should return empty update for unknown action types', () => {
      const state = createTestState();
      const update = system.perform(state, { type: 'unknown_action', payload: {} });
      expect(update).toEqual({});
    });
  });
});
