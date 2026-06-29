import type { GameState, GameAction, StateUpdate, Era, StateMutation } from '../core/types.js';
import type { MaterialType } from '../core/resources.js';

/** Costs to build initial Mars base */
const BUILD_MARS_BASE_FUEL = 50;
const BUILD_MARS_BASE_STEEL = 30;
const BUILD_MARS_BASE_ELECTRONICS = 20;

/** Costs to upgrade Mars base per level */
const UPGRADE_MARS_BASE_FUEL = 20;
const UPGRADE_MARS_BASE_STEEL = 15;

/** Mars launch cost reduction multiplier (38% cheaper due to lower gravity) */
const MARS_LAUNCH_COST_REDUCTION = 0.62;

/** Transfer cost: 1 fuel per N units transferred */
const EARTH_TO_MARS_FUEL_PER_UNITS = 5; // 1 fuel per 5 units (no reduction)
const MARS_TO_EARTH_FUEL_PER_UNITS = 10; // 1 fuel per 10 units (reduced by launchCostReduction)

/**
 * MarsSystem manages Mars base construction and resource operations.
 *
 * Responsibilities:
 * - Build Mars base with significant launch costs (fuel + steel + electronics)
 * - Produce Mars-unique resources: regolith_iron, martian_ice, co2
 * - Lower-cost orbital launches due to reduced gravity (0.62 multiplier)
 * - Earth-Mars resource allocation balancing via transfer actions
 *
 * Active from Mars Colonization Era onwards.
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5
 */
export class MarsSystem {
  readonly id = 'mars';

  readonly activeEras: Era[] = ['mars_colonization', 'space_mining', 'dyson_ring'];

  /**
   * Main update loop: produces Mars-unique resources per tick based on baseLevel.
   * Production rates:
   * - regolith_iron: baseLevel * 2
   * - martian_ice: baseLevel * 1.5
   * - co2: baseLevel * 1
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    if (!state.mars.unlocked) {
      return {};
    }

    const baseLevel = state.mars.baseLevel;
    if (baseLevel <= 0) {
      return {};
    }

    const mutations: StateMutation[] = [];

    // Produce Mars-unique resources
    const regolithProduced = baseLevel * 2 * deltaTicks;
    const iceProduced = baseLevel * 1.5 * deltaTicks;
    const co2Produced = baseLevel * 1 * deltaTicks;

    const newMarsResources = { ...state.mars.resources };
    newMarsResources.regolith_iron = (newMarsResources.regolith_iron ?? 0) + regolithProduced;
    newMarsResources.martian_ice = (newMarsResources.martian_ice ?? 0) + iceProduced;
    newMarsResources.co2 = (newMarsResources.co2 ?? 0) + co2Produced;

    mutations.push({ path: 'mars.resources', value: newMarsResources });

    return { mutations };
  }

  /**
   * Checks if a specific action is valid given the current state.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    switch (action.type) {
      case 'build_mars_base':
        return this.canBuildMarsBase(state);
      case 'upgrade_mars_base':
        return this.canUpgradeMarsBase(state);
      case 'transfer_to_earth':
        return this.canTransferToEarth(state, action.payload);
      case 'transfer_to_mars':
        return this.canTransferToMars(state, action.payload);
      default:
        return false;
    }
  }

  /**
   * Executes a player action.
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    switch (action.type) {
      case 'build_mars_base':
        return this.buildMarsBase(state);
      case 'upgrade_mars_base':
        return this.upgradeMarsBase(state);
      case 'transfer_to_earth':
        return this.transferToEarth(state, action.payload);
      case 'transfer_to_mars':
        return this.transferToMars(state, action.payload);
      default:
        return {};
    }
  }

  // --- Private helpers ---

  private canBuildMarsBase(state: GameState): boolean {
    if (state.mars.unlocked) return false; // Already built
    return (
      state.materials.stockpiles.fuel >= BUILD_MARS_BASE_FUEL &&
      state.materials.stockpiles.steel >= BUILD_MARS_BASE_STEEL &&
      state.materials.stockpiles.electronics >= BUILD_MARS_BASE_ELECTRONICS
    );
  }

  private canUpgradeMarsBase(state: GameState): boolean {
    if (!state.mars.unlocked) return false;
    return (
      state.materials.stockpiles.fuel >= UPGRADE_MARS_BASE_FUEL &&
      state.materials.stockpiles.steel >= UPGRADE_MARS_BASE_STEEL
    );
  }

  private canTransferToEarth(state: GameState, payload: Record<string, unknown>): boolean {
    if (!state.mars.unlocked) return false;

    const material = payload.material as MaterialType;
    const amount = payload.amount as number;

    if (!material || !amount || amount <= 0) return false;

    // Check Mars has enough of the material
    if ((state.mars.resources[material] ?? 0) < amount) return false;

    // Check Mars has enough fuel for transfer cost (reduced by launchCostReduction)
    const fuelCost = Math.ceil((amount / MARS_TO_EARTH_FUEL_PER_UNITS) * state.mars.launchCostReduction);
    return (state.mars.resources.fuel ?? 0) + state.materials.stockpiles.fuel >= fuelCost;
  }

  private canTransferToMars(state: GameState, payload: Record<string, unknown>): boolean {
    if (!state.mars.unlocked) return false;

    const material = payload.material as MaterialType;
    const amount = payload.amount as number;

    if (!material || !amount || amount <= 0) return false;

    // Check Earth has enough of the material
    if ((state.materials.stockpiles[material] ?? 0) < amount) return false;

    // Check Earth has enough fuel for transfer cost (no reduction for Earth→Mars)
    const fuelCost = Math.ceil(amount / EARTH_TO_MARS_FUEL_PER_UNITS);
    return state.materials.stockpiles.fuel >= fuelCost;
  }

  private buildMarsBase(state: GameState): StateUpdate {
    if (!this.canBuildMarsBase(state)) return {};

    const mutations: StateMutation[] = [
      { path: 'mars.unlocked', value: true },
      { path: 'mars.baseLevel', value: 1 },
      { path: 'mars.launchCostReduction', value: MARS_LAUNCH_COST_REDUCTION },
      {
        path: 'mars.productionRates',
        value: {
          ...state.mars.productionRates,
          regolith_iron: 2,
          martian_ice: 1.5,
          co2: 1,
        },
      },
    ];

    // Deduct costs from Earth stockpiles
    const newStockpiles = { ...state.materials.stockpiles };
    newStockpiles.fuel -= BUILD_MARS_BASE_FUEL;
    newStockpiles.steel -= BUILD_MARS_BASE_STEEL;
    newStockpiles.electronics -= BUILD_MARS_BASE_ELECTRONICS;

    return {
      materials: { stockpiles: newStockpiles },
      mutations,
    };
  }

  private upgradeMarsBase(state: GameState): StateUpdate {
    if (!this.canUpgradeMarsBase(state)) return {};

    const newLevel = state.mars.baseLevel + 1;

    const mutations: StateMutation[] = [
      { path: 'mars.baseLevel', value: newLevel },
      {
        path: 'mars.productionRates',
        value: {
          ...state.mars.productionRates,
          regolith_iron: newLevel * 2,
          martian_ice: newLevel * 1.5,
          co2: newLevel * 1,
        },
      },
    ];

    // Deduct costs from Earth stockpiles
    const newStockpiles = { ...state.materials.stockpiles };
    newStockpiles.fuel -= UPGRADE_MARS_BASE_FUEL;
    newStockpiles.steel -= UPGRADE_MARS_BASE_STEEL;

    return {
      materials: { stockpiles: newStockpiles },
      mutations,
    };
  }

  private transferToEarth(state: GameState, payload: Record<string, unknown>): StateUpdate {
    if (!this.canTransferToEarth(state, payload)) return {};

    const material = payload.material as MaterialType;
    const amount = payload.amount as number;

    // Calculate fuel cost (reduced by Mars' lower gravity)
    const fuelCost = Math.ceil((amount / MARS_TO_EARTH_FUEL_PER_UNITS) * state.mars.launchCostReduction);

    const mutations: StateMutation[] = [];

    // Deduct material from Mars resources
    const newMarsResources = { ...state.mars.resources };
    newMarsResources[material] = (newMarsResources[material] ?? 0) - amount;

    // Deduct fuel cost from Earth stockpiles
    const newStockpiles = { ...state.materials.stockpiles };
    newStockpiles.fuel -= fuelCost;

    // Add material to Earth stockpiles
    newStockpiles[material] = (newStockpiles[material] ?? 0) + amount;

    mutations.push({ path: 'mars.resources', value: newMarsResources });

    return {
      materials: { stockpiles: newStockpiles },
      mutations,
    };
  }

  private transferToMars(state: GameState, payload: Record<string, unknown>): StateUpdate {
    if (!this.canTransferToMars(state, payload)) return {};

    const material = payload.material as MaterialType;
    const amount = payload.amount as number;

    // Calculate fuel cost (no reduction for Earth→Mars)
    const fuelCost = Math.ceil(amount / EARTH_TO_MARS_FUEL_PER_UNITS);

    const mutations: StateMutation[] = [];

    // Deduct material and fuel from Earth stockpiles
    const newStockpiles = { ...state.materials.stockpiles };
    newStockpiles[material] = (newStockpiles[material] ?? 0) - amount;
    newStockpiles.fuel -= fuelCost;

    // Add material to Mars resources
    const newMarsResources = { ...state.mars.resources };
    newMarsResources[material] = (newMarsResources[material] ?? 0) + amount;

    mutations.push({ path: 'mars.resources', value: newMarsResources });

    return {
      materials: { stockpiles: newStockpiles },
      mutations,
    };
  }
}
