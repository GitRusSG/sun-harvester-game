import type { GameState, GameAction, StateUpdate, Era, StateMutation } from '../core/types.js';
import type { WeaponCategoryId, WeaponsFactory } from '../core/combat.js';
import type { MaterialType } from '../core/resources.js';
import { WEAPON_CATEGORIES, getWeaponCategory } from '../data/weapons.js';
import type { WeaponCategoryDefinition } from '../data/weapons.js';

/**
 * Represents an unlocked weapon category visible to the player.
 */
export interface WeaponCategory {
  id: WeaponCategoryId;
  name: string;
  powerPerUnit: number;
  unlocked: boolean;
}

/**
 * WeaponsSystem manages weapon production factories, arsenal tracking,
 * and military power calculation.
 *
 * Responsibilities:
 * - Produce weapons at factories each tick (consuming materials)
 * - Track arsenal counts per weapon category
 * - Compute composite military power score
 * - Unlock weapon categories via tech tree research
 * - Support building new weapons factories via perform()
 *
 * Active from Fossil Era onwards (all eras).
 *
 * Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6
 */
export class WeaponsSystem {
  readonly id = 'weapons';

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
   * Computes total military power as the sum of (arsenal[category] * powerPerUnit[category]).
   */
  getMilitaryPower(state: GameState): number {
    let total = 0;
    for (const category of WEAPON_CATEGORIES) {
      const count = state.weapons.arsenal[category.id] ?? 0;
      total += count * category.powerPerUnit;
    }
    return total;
  }

  /**
   * Returns all weapon categories with their unlock status based on current research.
   */
  getWeaponCategories(state: GameState): WeaponCategory[] {
    return WEAPON_CATEGORIES.map((cat) => ({
      id: cat.id,
      name: cat.name,
      powerPerUnit: cat.powerPerUnit,
      unlocked: this.isCategoryUnlocked(state, cat),
    }));
  }

  /**
   * Produces weapons at a specific factory for the given number of ticks.
   * Checks material availability and deducts materials for each unit produced.
   * Returns a StateUpdate with material deductions, arsenal additions, and military power recalc.
   */
  produceWeapons(state: GameState, factoryId: string, deltaTicks: number): StateUpdate {
    const factory = state.weapons.factories.find((f) => f.id === factoryId);
    if (!factory) return {};

    const category = getWeaponCategory(factory.producing);
    if (!category) return {};

    // Check if this category is unlocked
    if (!this.isCategoryUnlocked(state, category)) return {};

    // Calculate how many units can be produced in deltaTicks
    const maxProduction = factory.productionRate * deltaTicks;

    // Check how many units we can actually afford with available materials
    const affordableUnits = this.getAffordableUnits(state, category, maxProduction);

    if (affordableUnits <= 0) return {};

    // Deduct materials
    const updatedStockpiles = { ...state.materials.stockpiles };
    for (const req of category.materials) {
      updatedStockpiles[req.material] = (updatedStockpiles[req.material] ?? 0) - req.quantity * affordableUnits;
    }

    // Add to arsenal
    const newArsenalCount = (state.weapons.arsenal[category.id] ?? 0) + affordableUnits;

    // Recalculate military power with the updated arsenal
    let newMilitaryPower = 0;
    for (const cat of WEAPON_CATEGORIES) {
      if (cat.id === category.id) {
        newMilitaryPower += newArsenalCount * cat.powerPerUnit;
      } else {
        newMilitaryPower += (state.weapons.arsenal[cat.id] ?? 0) * cat.powerPerUnit;
      }
    }

    const mutations: StateMutation[] = [
      { path: `weapons.arsenal.${category.id}`, value: newArsenalCount },
      { path: 'weapons.militaryPower', value: newMilitaryPower },
    ];

    return {
      materials: {
        stockpiles: updatedStockpiles,
      },
      mutations,
    };
  }

  /**
   * Main update loop: for each factory, produce weapons if materials are available.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    if (state.weapons.factories.length === 0) return {};

    // Process all factories and accumulate state changes
    const allMutations: StateMutation[] = [];
    let finalStockpiles = { ...state.materials.stockpiles };
    const arsenalUpdates: Partial<Record<WeaponCategoryId, number>> = {};

    for (const factory of state.weapons.factories) {
      const category = getWeaponCategory(factory.producing);
      if (!category) continue;

      // Check if this category is unlocked
      if (!this.isCategoryUnlocked(state, category)) continue;

      // Calculate how many units can be produced
      const maxProduction = factory.productionRate * deltaTicks;
      const affordableUnits = this.getAffordableUnitsFromStockpiles(finalStockpiles, category, maxProduction);

      if (affordableUnits <= 0) continue;

      // Deduct materials from running stockpile
      for (const req of category.materials) {
        finalStockpiles[req.material] = (finalStockpiles[req.material] ?? 0) - req.quantity * affordableUnits;
      }

      // Track arsenal additions
      const currentCount = arsenalUpdates[category.id] ?? (state.weapons.arsenal[category.id] ?? 0);
      arsenalUpdates[category.id] = currentCount + affordableUnits;
    }

    // If nothing was produced, return empty update
    if (Object.keys(arsenalUpdates).length === 0) return {};

    // Build final arsenal and calculate military power
    const finalArsenal = { ...state.weapons.arsenal, ...arsenalUpdates };
    let newMilitaryPower = 0;
    for (const cat of WEAPON_CATEGORIES) {
      newMilitaryPower += (finalArsenal[cat.id] ?? 0) * cat.powerPerUnit;
    }

    // Build mutations for arsenal changes
    for (const [catId, count] of Object.entries(arsenalUpdates)) {
      allMutations.push({ path: `weapons.arsenal.${catId}`, value: count });
    }
    allMutations.push({ path: 'weapons.militaryPower', value: newMilitaryPower });

    return {
      materials: {
        stockpiles: finalStockpiles,
      },
      mutations: allMutations,
    };
  }

  /**
   * Checks if a specific action is valid.
   * Supports 'build_weapons_factory' and 'set_factory_production'.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    if (action.type === 'build_weapons_factory') {
      const producing = action.payload.producing as WeaponCategoryId;
      if (!producing) return false;
      const category = getWeaponCategory(producing);
      if (!category) return false;
      return this.isCategoryUnlocked(state, category);
    }

    if (action.type === 'set_factory_production') {
      const factoryId = action.payload.factoryId as string;
      const producing = action.payload.producing as WeaponCategoryId;
      if (!factoryId || !producing) return false;

      const factory = state.weapons.factories.find((f) => f.id === factoryId);
      if (!factory) return false;

      const category = getWeaponCategory(producing);
      if (!category) return false;

      return this.isCategoryUnlocked(state, category);
    }

    return false;
  }

  /**
   * Executes a player action.
   * - 'build_weapons_factory': creates a new factory producing the specified weapon category
   * - 'set_factory_production': changes what a factory is producing
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    if (action.type === 'build_weapons_factory') {
      return this.buildFactory(state, action);
    }

    if (action.type === 'set_factory_production') {
      return this.setFactoryProduction(state, action);
    }

    return {};
  }

  /**
   * Builds a new weapons factory.
   */
  private buildFactory(state: GameState, action: GameAction): StateUpdate {
    const producing = action.payload.producing as WeaponCategoryId;
    const category = getWeaponCategory(producing);
    if (!category || !this.isCategoryUnlocked(state, category)) return {};

    const newFactory: WeaponsFactory = {
      id: `weapons_factory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      level: 1,
      producing,
      productionRate: 1, // 1 unit per tick at level 1
    };

    const updatedFactories = [...state.weapons.factories, newFactory];

    return {
      mutations: [
        { path: 'weapons.factories', value: updatedFactories },
      ],
    };
  }

  /**
   * Changes what a factory is producing.
   */
  private setFactoryProduction(state: GameState, action: GameAction): StateUpdate {
    const factoryId = action.payload.factoryId as string;
    const producing = action.payload.producing as WeaponCategoryId;

    const category = getWeaponCategory(producing);
    if (!category || !this.isCategoryUnlocked(state, category)) return {};

    const updatedFactories = state.weapons.factories.map((f) =>
      f.id === factoryId ? { ...f, producing } : f,
    );

    return {
      mutations: [
        { path: 'weapons.factories', value: updatedFactories },
      ],
    };
  }

  /**
   * Checks whether a weapon category is unlocked via research.
   * Categories with unlockedByTech === null are always available.
   */
  private isCategoryUnlocked(state: GameState, category: WeaponCategoryDefinition): boolean {
    if (category.unlockedByTech === null) return true;

    // Check if the required tech node is completed in the weapons tree
    const weaponsTree = state.research.trees.weapons;
    const nodeState = weaponsTree.nodes[category.unlockedByTech];
    return nodeState?.status === 'completed';
  }

  /**
   * Determines how many units of a weapon can be afforded given current stockpiles.
   */
  private getAffordableUnits(
    state: GameState,
    category: WeaponCategoryDefinition,
    maxUnits: number,
  ): number {
    return this.getAffordableUnitsFromStockpiles(state.materials.stockpiles, category, maxUnits);
  }

  /**
   * Determines how many units of a weapon can be afforded given stockpiles map.
   */
  private getAffordableUnitsFromStockpiles(
    stockpiles: Record<MaterialType, number>,
    category: WeaponCategoryDefinition,
    maxUnits: number,
  ): number {
    let affordable = maxUnits;

    for (const req of category.materials) {
      const available = stockpiles[req.material] ?? 0;
      const canAfford = Math.floor(available / req.quantity);
      affordable = Math.min(affordable, canAfford);
    }

    return Math.max(0, affordable);
  }
}
