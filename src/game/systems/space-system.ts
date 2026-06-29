import type { GameState, GameAction, StateUpdate, Era, StateMutation } from '../core/types.js';
import type { MaterialType } from '../core/resources.js';
import type { OrbitalPlatform, AsteroidTerritory } from '../core/space.js';
import { generateId } from '../utils/id.js';

/** Cost to build an orbital platform: fuel + steel */
const PLATFORM_FUEL_COST = 10;
const PLATFORM_STEEL_COST = 20;

/** Cost to claim an asteroid territory: fuel + steel */
const TERRITORY_FUEL_COST = 15;
const TERRITORY_STEEL_COST = 10;

/** Cost to expand fleet: steel + electronics */
const FLEET_STEEL_COST = 30;
const FLEET_ELECTRONICS_COST = 10;

/** Fuel consumed per territory per tick */
const FUEL_PER_TERRITORY_PER_TICK = 0.1;

/** Fuel capacity granted per fleet unit */
const FUEL_CAPACITY_PER_FLEET = 50;

/**
 * SpaceSystem manages orbital platforms and asteroid territory operations.
 *
 * Responsibilities:
 * - Build orbital platforms (solar collectors, stations, launch platforms) with fuel + material costs
 * - Orbital solar collectors produce energy at a flat rate (no weather penalty)
 * - Claim asteroid territories with cost and resource surveys
 * - Track territory resource profiles (iron-rich, rare-earth-rich, ice-rich)
 * - Limit territories based on fleet size (maxTerritories = fleet.size * 2)
 * - Produce resources from territories based on deposit quality and mining level
 * - Consume fleet fuel per active territory per tick
 *
 * Active from Orbital Era (platforms) and Space Mining Era (territories).
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.5, 20.1, 20.2, 20.3, 20.4, 20.5
 */
export class SpaceSystem {
  readonly id = 'space';

  readonly activeEras: Era[] = ['orbital', 'mars_colonization', 'space_mining', 'dyson_ring'];

  /**
   * Main update loop: produces energy from orbital solar collectors (no weather penalty),
   * produces materials from active territories, and consumes fleet fuel.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    const mutations: StateMutation[] = [];
    const materialUpdates: Partial<Record<MaterialType, number>> = {};

    // --- Orbital solar collectors produce flat energy (no weather penalty) ---
    let energyFromCollectors = 0;
    for (const platform of state.space.orbitalPlatforms) {
      if (platform.type === 'solar_collector') {
        energyFromCollectors += platform.output * deltaTicks;
      }
    }

    if (energyFromCollectors > 0) {
      const newStored = Math.min(
        state.energy.stored + energyFromCollectors,
        state.energy.maxStorage,
      );
      mutations.push({ path: 'energy.stored', value: newStored });
    }

    // --- Territory production and fuel consumption ---
    const territories = state.space.territories;
    if (territories.length > 0) {
      // Check if we're in space_mining era or later (territories only produce in these eras)
      const spaceEras: Era[] = ['space_mining', 'dyson_ring'];
      const canMine = spaceEras.includes(state.currentEra);

      if (canMine) {
        // Produce materials from each territory
        for (const territory of territories) {
          if (territory.surveyed) {
            const effectiveRate = territory.productionRate * territory.depositQuality * territory.miningLevel;
            for (const [material, weight] of Object.entries(territory.resourceProfile)) {
              if (weight > 0) {
                const produced = effectiveRate * weight * deltaTicks;
                const matKey = material as MaterialType;
                materialUpdates[matKey] = (materialUpdates[matKey] ?? 0) + produced;
              }
            }
          }
        }
      }

      // Consume fleet fuel (per territory per tick)
      const fuelConsumed = territories.length * FUEL_PER_TERRITORY_PER_TICK * deltaTicks;
      const newFuel = Math.max(0, state.space.fleet.currentFuel - fuelConsumed);
      mutations.push({ path: 'space.fleet.currentFuel', value: newFuel });
    }

    // Apply material updates to stockpiles
    if (Object.keys(materialUpdates).length > 0) {
      const newStockpiles = { ...state.materials.stockpiles };
      for (const [mat, amount] of Object.entries(materialUpdates)) {
        const matKey = mat as MaterialType;
        newStockpiles[matKey] = (newStockpiles[matKey] ?? 0) + amount;
      }
      return {
        materials: { stockpiles: newStockpiles },
        mutations,
      };
    }

    return { mutations: mutations.length > 0 ? mutations : undefined };
  }

  /**
   * Checks if a specific action is valid given the current state.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    switch (action.type) {
      case 'build_orbital_platform':
        return this.canBuildPlatform(state);
      case 'claim_territory':
        return this.canClaimTerritory(state);
      case 'expand_fleet':
        return this.canExpandFleet(state);
      default:
        return false;
    }
  }

  /**
   * Executes a player action.
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    switch (action.type) {
      case 'build_orbital_platform':
        return this.buildPlatform(state, action.payload);
      case 'claim_territory':
        return this.claimTerritory(state, action.payload);
      case 'expand_fleet':
        return this.expandFleet(state);
      default:
        return {};
    }
  }

  // --- Private helpers ---

  private canBuildPlatform(state: GameState): boolean {
    return (
      state.materials.stockpiles.fuel >= PLATFORM_FUEL_COST &&
      state.materials.stockpiles.steel >= PLATFORM_STEEL_COST
    );
  }

  private canClaimTerritory(state: GameState): boolean {
    const maxTerritories = state.space.fleet.size * 2;
    if (state.space.territories.length >= maxTerritories) return false;
    return (
      state.materials.stockpiles.fuel >= TERRITORY_FUEL_COST &&
      state.materials.stockpiles.steel >= TERRITORY_STEEL_COST
    );
  }

  private canExpandFleet(state: GameState): boolean {
    return (
      state.materials.stockpiles.steel >= FLEET_STEEL_COST &&
      state.materials.stockpiles.electronics >= FLEET_ELECTRONICS_COST
    );
  }

  private buildPlatform(state: GameState, payload: Record<string, unknown>): StateUpdate {
    if (!this.canBuildPlatform(state)) return {};

    const platformType = (payload.type as OrbitalPlatform['type']) ?? 'solar_collector';
    const level = (payload.level as number) ?? 1;
    const output = (payload.output as number) ?? 10;

    const newPlatform: OrbitalPlatform = {
      id: `platform_${generateId()}`,
      type: platformType,
      level,
      output,
    };

    const mutations: StateMutation[] = [
      {
        path: 'space.orbitalPlatforms',
        value: [...state.space.orbitalPlatforms, newPlatform],
      },
    ];

    // Deduct costs
    const newStockpiles = { ...state.materials.stockpiles };
    newStockpiles.fuel -= PLATFORM_FUEL_COST;
    newStockpiles.steel -= PLATFORM_STEEL_COST;

    return {
      materials: { stockpiles: newStockpiles },
      mutations,
    };
  }

  private claimTerritory(state: GameState, payload: Record<string, unknown>): StateUpdate {
    if (!this.canClaimTerritory(state)) return {};

    const name = (payload.name as string) ?? `Asteroid ${state.space.territories.length + 1}`;
    const resourceProfile = (payload.resourceProfile as Record<MaterialType, number>) ?? { iron_ore: 1 };
    const depositQuality = (payload.depositQuality as number) ?? 0.5;

    const newTerritory: AsteroidTerritory = {
      id: `territory_${generateId()}`,
      name,
      resourceProfile,
      depositQuality,
      surveyed: false,
      miningLevel: 1,
      productionRate: 5,
    };

    const mutations: StateMutation[] = [
      {
        path: 'space.territories',
        value: [...state.space.territories, newTerritory],
      },
      {
        path: 'space.maxTerritories',
        value: state.space.fleet.size * 2,
      },
    ];

    // Deduct costs
    const newStockpiles = { ...state.materials.stockpiles };
    newStockpiles.fuel -= TERRITORY_FUEL_COST;
    newStockpiles.steel -= TERRITORY_STEEL_COST;

    return {
      materials: { stockpiles: newStockpiles },
      mutations,
    };
  }

  private expandFleet(state: GameState): StateUpdate {
    if (!this.canExpandFleet(state)) return {};

    const newFleet = {
      size: state.space.fleet.size + 1,
      fuelCapacity: state.space.fleet.fuelCapacity + FUEL_CAPACITY_PER_FLEET,
      currentFuel: state.space.fleet.currentFuel,
    };

    const mutations: StateMutation[] = [
      { path: 'space.fleet', value: newFleet },
      { path: 'space.maxTerritories', value: newFleet.size * 2 },
    ];

    // Deduct costs
    const newStockpiles = { ...state.materials.stockpiles };
    newStockpiles.steel -= FLEET_STEEL_COST;
    newStockpiles.electronics -= FLEET_ELECTRONICS_COST;

    return {
      materials: { stockpiles: newStockpiles },
      mutations,
    };
  }
}
