import type { GameState, GameAction, StateUpdate, Era, GameEvent, StateMutation } from '../core/types.js';
import type { MaterialType, EnergyState, SolarPanel, PowerPlant } from '../core/resources.js';
import type { Mine, DistributionNetwork } from '../core/infrastructure.js';
import type { WeatherCondition } from '../core/weather.js';
import { WEATHER_MODIFIERS } from '../core/weather.js';
import { generateId } from '../utils/id.js';

/**
 * Production report summarizing per-second rates for the current game state.
 */
export interface ProductionReport {
  energyPerSecond: number;
  currencyPerSecond: number;
  maintenanceCostPerSecond: number;
  netCurrencyPerSecond: number;
  materialRates: Record<MaterialType, number>;
}

/** Default location irradiance when no location data is available */
const DEFAULT_IRRADIANCE = 0.8;

/** Base price per unit of energy for revenue calculation */
const BASE_ENERGY_PRICE = 1.0;

/** Dynamic pricing denominator - higher supply reduces unit price */
const DYNAMIC_PRICING_DIVISOR = 10000;

/** Maintenance costs per infrastructure type per second */
const MAINTENANCE_COSTS = {
  solarPanel: 0.5,
  powerPlant: 2,
  mine: 1,
  factory: 1.5,
} as const;

/**
 * ResourceSystem manages energy production, currency generation, maintenance,
 * and material rates. Active in all eras.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.2, 4.1, 4.2, 4.3, 4.4, 8.1, 8.2, 8.3, 8.4, 12.2, 12.4, 12.5, 12.6
 */
export class ResourceSystem {
  readonly id = 'resources';

  readonly activeEras: Era[] = [
    'fossil',
    'nuclear',
    'solar',
    'orbital',
    'mars_colonization',
    'space_mining',
    'dyson_ring',
  ];

  /**
   * Applies a weather modifier to a base production value.
   */
  applyWeatherModifier(base: number, weather: WeatherCondition): number {
    return base * WEATHER_MODIFIERS[weather];
  }

  /**
   * Calculates the full production report for the current game state.
   * Computes energy/second, currency/second, maintenance costs, net currency, and material rates.
   */
  calculateProduction(state: GameState): ProductionReport {
    const weather = state.weather.current;
    const energy = state.energy;

    // --- Energy per second ---
    const solarEnergy = this.calculateSolarOutput(energy, weather);
    const plantEnergy = this.calculatePlantOutput(energy, state);
    const energyPerSecond = solarEnergy + plantEnergy;

    // --- Currency per second (revenue from stored energy) ---
    const currencyPerSecond = this.calculateRevenue(energy);

    // --- Maintenance cost per second ---
    const maintenanceCostPerSecond = this.calculateMaintenanceCost(state);

    // --- Net currency ---
    const netCurrencyPerSecond = currencyPerSecond - maintenanceCostPerSecond;

    // --- Material rates (from mines) ---
    const materialRates = this.calculateMaterialRates(state);

    return {
      energyPerSecond,
      currencyPerSecond,
      maintenanceCostPerSecond,
      netCurrencyPerSecond,
      materialRates,
    };
  }

  /**
   * Calculates offline earnings given elapsed seconds.
   * Applies production * elapsed, capped at 24 hours (86400 seconds).
   * Returns a map of resource changes to apply.
   */
  calculateOfflineEarnings(
    state: GameState,
    elapsedSeconds: number,
  ): { currency: number; energy: number; materials: Partial<Record<MaterialType, number>> } {
    const cappedSeconds = Math.min(elapsedSeconds, 86400);
    const report = this.calculateProduction(state);

    // Energy generated offline
    const rawEnergyGain = report.energyPerSecond * cappedSeconds;
    const availableStorage = state.energy.maxStorage - state.energy.stored;
    const energyGain = Math.min(rawEnergyGain, availableStorage);

    // Currency earned offline (net of maintenance)
    const currencyGain = report.netCurrencyPerSecond * cappedSeconds;

    // Materials produced offline
    const materials: Partial<Record<MaterialType, number>> = {};
    for (const [mat, rate] of Object.entries(report.materialRates)) {
      if (rate > 0) {
        materials[mat as MaterialType] = rate * cappedSeconds;
      }
    }

    return {
      currency: currencyGain,
      energy: energyGain,
      materials,
    };
  }

  /**
   * Processes one or more ticks of simulation.
   * Applies production per deltaTicks, caps energy storage,
   * and emits warning events if currency hits zero.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    const report = this.calculateProduction(state);
    const events: GameEvent[] = [];

    // Calculate energy changes
    const energyGenerated = report.energyPerSecond * deltaTicks;
    let newStored = state.energy.stored + energyGenerated;

    // Cap at max storage (discard excess)
    if (newStored > state.energy.maxStorage) {
      newStored = state.energy.maxStorage;
    }

    // Calculate currency changes
    const currencyChange = report.netCurrencyPerSecond * deltaTicks;
    let newCurrency = state.resources.currency + currencyChange;

    // Zero-currency warning state
    if (newCurrency <= 0) {
      newCurrency = 0;
      events.push({
        id: `zero_currency_${Date.now()}`,
        type: 'protest', // reuse existing event type for warning
        payload: {
          cause: 'zero_currency',
          message: 'Currency depleted! New construction halted until currency is positive.',
        },
        timestamp: Date.now(),
      });
    }

    // Calculate material stockpile changes
    const materialUpdates: Partial<Record<MaterialType, number>> = {};
    for (const [mat, rate] of Object.entries(report.materialRates)) {
      if (rate !== 0) {
        const currentStock = state.materials.stockpiles[mat as MaterialType] ?? 0;
        materialUpdates[mat as MaterialType] = Math.max(0, currentStock + rate * deltaTicks);
      }
    }

    // Fuel consumption for power plants
    const fuelConsumption = this.calculateFuelConsumption(state.energy, state);
    for (const [mat, amount] of Object.entries(fuelConsumption)) {
      const consumed = amount * deltaTicks;
      const currentStock = materialUpdates[mat as MaterialType]
        ?? state.materials.stockpiles[mat as MaterialType]
        ?? 0;
      materialUpdates[mat as MaterialType] = Math.max(0, currentStock - consumed);
    }

    return {
      resources: {
        currency: newCurrency,
        incomeRate: report.currencyPerSecond,
        expenseRate: report.maintenanceCostPerSecond,
      },
      materials: {
        stockpiles: materialUpdates as Record<MaterialType, number>,
      },
      mutations: [
        { path: 'energy.stored', value: newStored },
        { path: 'energy.generated', value: report.energyPerSecond },
      ],
      events: events.length > 0 ? events : undefined,
    };
  }

  /**
   * Checks if a specific action can be performed.
   * Validates currency sufficiency and era requirements.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    const constructionActions = [
      'build_solar_panel',
      'build_power_plant',
      'build_mine',
      'build_factory',
      'build_distribution_network',
    ];

    if (!constructionActions.includes(action.type)) {
      return true;
    }

    // Block construction when currency is zero or below
    if (state.resources.currency <= 0) {
      return false;
    }

    // Validate currency >= cost for build actions
    const cost = (action.payload as { cost?: number }).cost ?? 0;
    if (state.resources.currency < cost) {
      return false;
    }

    // Nuclear power plant requires non-fossil era
    if (action.type === 'build_power_plant') {
      const plantType = (action.payload as { type?: string }).type;
      if (plantType === 'nuclear' && state.currentEra === 'fossil') {
        return false;
      }
    }

    return true;
  }

  /**
   * Executes a player action. Handles building solar panels, power plants, mines, and distribution networks.
   * Validates: Requirements 2.1, 2.3, 2.4, 4.3, 11.2, 12.1, 12.3
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    switch (action.type) {
      case 'build_solar_panel':
        return this.buildSolarPanel(state, action.payload as { locationId: string; cost: number });
      case 'build_power_plant':
        return this.buildPowerPlant(state, action.payload as { type: 'coal' | 'nuclear'; cost: number });
      case 'build_mine':
        return this.buildMine(state, action.payload as { materialType: MaterialType; cost: number; depositQuality: number });
      case 'build_distribution_network':
        return this.buildDistributionNetwork(state, action.payload as { cost: number });
      default:
        return {};
    }
  }

  private buildSolarPanel(
    state: GameState,
    payload: { locationId: string; cost: number },
  ): StateUpdate {
    const newCurrency = state.resources.currency - payload.cost;
    const newPanel: SolarPanel = {
      id: generateId(),
      locationId: payload.locationId,
      efficiency: 1.0,
      baseOutput: 10,
    };
    const updatedPanels = [...state.energy.solarPanels, newPanel];

    return {
      resources: { currency: newCurrency },
      mutations: [
        { path: 'energy.solarPanels', value: updatedPanels },
      ],
    };
  }

  private buildPowerPlant(
    state: GameState,
    payload: { type: 'coal' | 'nuclear'; cost: number },
  ): StateUpdate {
    const newCurrency = state.resources.currency - payload.cost;
    const isNuclear = payload.type === 'nuclear';
    const newPlant: PowerPlant = {
      id: generateId(),
      type: payload.type,
      level: 1,
      fuelType: isNuclear ? 'uranium' : 'coal',
      consumptionRate: isNuclear ? 1 : 2,
      outputRate: isNuclear ? 40 : 15,
      active: true,
    };
    const updatedPlants = [...state.energy.powerPlants, newPlant];

    return {
      resources: { currency: newCurrency },
      mutations: [
        { path: 'energy.powerPlants', value: updatedPlants },
      ],
    };
  }

  private buildMine(
    state: GameState,
    payload: { materialType: MaterialType; cost: number; depositQuality: number },
  ): StateUpdate {
    const newCurrency = state.resources.currency - payload.cost;
    const newMine: Mine = {
      id: generateId(),
      materialType: payload.materialType,
      level: 1,
      depositQuality: payload.depositQuality,
      productionRate: payload.depositQuality * 5,
    };
    const updatedMines = [...state.infrastructure.mines, newMine];

    return {
      resources: { currency: newCurrency },
      mutations: [
        { path: 'infrastructure.mines', value: updatedMines },
      ],
    };
  }

  private buildDistributionNetwork(
    state: GameState,
    payload: { cost: number },
  ): StateUpdate {
    const newCurrency = state.resources.currency - payload.cost;
    const newNetwork: DistributionNetwork = {
      id: generateId(),
      level: 1,
      conversionBonus: 0.1,
    };
    const updatedNetworks = [...state.infrastructure.distributionNetworks, newNetwork];
    const newDistributionRate = state.energy.distributionRate + 0.1;

    return {
      resources: { currency: newCurrency },
      mutations: [
        { path: 'infrastructure.distributionNetworks', value: updatedNetworks },
        { path: 'energy.distributionRate', value: newDistributionRate },
      ],
    };
  }

  // --- Private calculation helpers ---

  /**
   * Calculates total solar panel output considering weather and location irradiance.
   * Formula: sum of (panel.baseOutput * panel.efficiency * weatherModifier * locationIrradiance)
   */
  private calculateSolarOutput(energy: EnergyState, weather: WeatherCondition): number {
    const weatherModifier = WEATHER_MODIFIERS[weather];
    let totalOutput = 0;

    for (const panel of energy.solarPanels) {
      const irradiance = DEFAULT_IRRADIANCE; // Use default until location data is available (Task 19)
      totalOutput += panel.baseOutput * panel.efficiency * weatherModifier * irradiance;
    }

    return totalOutput;
  }

  /**
   * Calculates total power plant output.
   * Plants are halted if their fuel stockpile is insufficient for consumption.
   */
  private calculatePlantOutput(energy: EnergyState, state: GameState): number {
    let totalOutput = 0;

    for (const plant of energy.powerPlants) {
      if (!plant.active) continue;

      // Check if fuel is available
      const fuelAvailable = state.materials.stockpiles[plant.fuelType] ?? 0;
      if (fuelAvailable < plant.consumptionRate) {
        // Fuel depleted — halt this plant (output = 0)
        continue;
      }

      totalOutput += plant.outputRate;
    }

    return totalOutput;
  }

  /**
   * Calculates fuel consumption rates for all active power plants.
   * Returns a map of materialType -> consumption per tick.
   */
  private calculateFuelConsumption(
    energy: EnergyState,
    state: GameState,
  ): Partial<Record<MaterialType, number>> {
    const consumption: Partial<Record<MaterialType, number>> = {};

    for (const plant of energy.powerPlants) {
      if (!plant.active) continue;

      // Only consume fuel if plant has enough to operate
      const fuelAvailable = state.materials.stockpiles[plant.fuelType] ?? 0;
      if (fuelAvailable < plant.consumptionRate) continue;

      const current = consumption[plant.fuelType] ?? 0;
      consumption[plant.fuelType] = current + plant.consumptionRate;
    }

    return consumption;
  }

  /**
   * Calculates revenue from stored energy using dynamic pricing.
   * Formula: stored * distributionRate * pricePerUnit
   * where pricePerUnit = basePrice / (1 + stored / DYNAMIC_PRICING_DIVISOR)
   *
   * Higher stored energy → lower unit price (supply/demand dynamics).
   */
  private calculateRevenue(energy: EnergyState): number {
    if (energy.stored <= 0) return 0;

    const pricePerUnit = BASE_ENERGY_PRICE / (1 + energy.stored / DYNAMIC_PRICING_DIVISOR);
    return energy.stored * energy.distributionRate * pricePerUnit;
  }

  /**
   * Calculates total maintenance cost per second based on infrastructure.
   * panels * 0.5 + powerPlants * 2 + mines * 1 + factories * 1.5
   */
  private calculateMaintenanceCost(state: GameState): number {
    const panelCount = state.energy.solarPanels.length;
    const plantCount = state.energy.powerPlants.length;
    const mineCount = state.infrastructure.mines.length;
    const factoryCount = state.infrastructure.factories.length;

    return (
      panelCount * MAINTENANCE_COSTS.solarPanel +
      plantCount * MAINTENANCE_COSTS.powerPlant +
      mineCount * MAINTENANCE_COSTS.mine +
      factoryCount * MAINTENANCE_COSTS.factory
    );
  }

  /**
   * Calculates material production rates from mines.
   * Each mine produces at its productionRate for its materialType.
   */
  private calculateMaterialRates(state: GameState): Record<MaterialType, number> {
    const allMaterials: MaterialType[] = [
      'coal', 'iron_ore', 'steel', 'silicon', 'solar_cells',
      'copper', 'electronics', 'uranium', 'fuel_rods',
      'rare_earth', 'advanced_circuits', 'water', 'fuel',
      'regolith_iron', 'martian_ice', 'co2',
    ];

    const rates = {} as Record<MaterialType, number>;
    for (const mat of allMaterials) {
      rates[mat] = 0;
    }

    for (const mine of state.infrastructure.mines) {
      rates[mine.materialType] += mine.productionRate;
    }

    return rates;
  }
}
