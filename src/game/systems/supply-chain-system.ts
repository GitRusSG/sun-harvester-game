import type { GameState, GameAction, StateUpdate, StateMutation, Era, GameEvent } from '../core/types.js';
import type { MaterialType } from '../core/resources.js';
import type { MaterialRequirement, Factory, CraftOrder } from '../core/infrastructure.js';
import { RECIPES, getRecipeById } from '../data/recipes.js';
import type { Recipe } from '../data/recipes.js';
import { generateId } from '../utils/id.js';
import { ERA_ORDER } from '../core/state-manager.js';

/**
 * Result of a canCraft check indicating whether crafting is possible
 * and what materials are missing if not.
 */
export interface CraftCheckResult {
  possible: boolean;
  missing: MaterialRequirement[];
}

/**
 * SupplyChainSystem manages crafting recipes, craft queues, and automation.
 * Active in all eras.
 *
 * Responsibilities:
 * - Determine available recipes based on era and research
 * - Check material availability for crafting
 * - Queue craft orders, reserving materials
 * - Progress craft orders each tick, emitting crafting_complete on finish
 * - Auto-craft when materials available for automated recipes
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 11.3, 11.4
 */
export class SupplyChainSystem {
  readonly id = 'supply_chain';

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
   * Returns all recipes that are currently unlocked based on era and research.
   */
  getRecipes(state: GameState): Recipe[] {
    return RECIPES.filter((recipe) => this.isRecipeUnlocked(state, recipe));
  }

  /**
   * Checks whether the player can craft a given recipe.
   * Returns whether it's possible and which materials are missing.
   */
  canCraft(state: GameState, recipeId: string): CraftCheckResult {
    const recipe = getRecipeById(recipeId);
    if (!recipe) {
      return { possible: false, missing: [] };
    }

    if (!this.isRecipeUnlocked(state, recipe)) {
      return { possible: false, missing: [] };
    }

    const missing: MaterialRequirement[] = [];

    for (const input of recipe.inputs) {
      const available = state.materials.stockpiles[input.material] ?? 0;
      if (available < input.quantity) {
        missing.push({
          material: input.material,
          quantity: input.quantity - available,
        });
      }
    }

    return {
      possible: missing.length === 0,
      missing,
    };
  }

  /**
   * Queues a crafting order. Reserves materials by deducting from stockpiles
   * and adds the order to the first available crafting factory.
   * If no factory exists, one is created.
   */
  queueCraft(state: GameState, recipeId: string, quantity: number): StateUpdate {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return {};

    // Verify materials for the total quantity
    const totalMissing: MaterialRequirement[] = [];
    for (const input of recipe.inputs) {
      const required = input.quantity * quantity;
      const available = state.materials.stockpiles[input.material] ?? 0;
      if (available < required) {
        totalMissing.push({
          material: input.material,
          quantity: required - available,
        });
      }
    }

    if (totalMissing.length > 0) {
      return {}; // Cannot craft — insufficient materials
    }

    // Reserve materials (deduct from stockpiles)
    const updatedStockpiles: Partial<Record<MaterialType, number>> = {};
    for (const input of recipe.inputs) {
      const deduction = input.quantity * quantity;
      const current = state.materials.stockpiles[input.material] ?? 0;
      updatedStockpiles[input.material] = current - deduction;
    }

    // Create the craft order
    const order: CraftOrder = {
      recipeId,
      quantity,
      progress: 0,
      totalTime: recipe.craftTime * quantity,
    };

    // Find or create a crafting factory
    const factories = [...state.infrastructure.factories];
    let targetFactory = factories.find((f) => f.type === 'crafting');

    if (!targetFactory) {
      targetFactory = {
        id: generateId(),
        type: 'crafting',
        level: 1,
        currentOrders: [],
        automatedRecipes: [],
      };
      factories.push(targetFactory);
    }

    // Add the order to the factory
    const factoryIndex = factories.indexOf(targetFactory);
    factories[factoryIndex] = {
      ...targetFactory,
      currentOrders: [...targetFactory.currentOrders, order],
    };

    return {
      materials: {
        stockpiles: updatedStockpiles as Record<MaterialType, number>,
      },
      mutations: [
        { path: 'infrastructure.factories', value: factories },
      ],
    };
  }

  /**
   * Returns the list of recipe IDs that are currently set to automated.
   */
  getAutomatedRecipes(state: GameState): string[] {
    return state.supplyChain.automatedRecipes;
  }

  /**
   * Enables or disables automation for a recipe.
   */
  setAutomate(state: GameState, recipeId: string, enabled: boolean): StateUpdate {
    const currentAutomated = [...state.supplyChain.automatedRecipes];

    if (enabled && !currentAutomated.includes(recipeId)) {
      currentAutomated.push(recipeId);
    } else if (!enabled) {
      const index = currentAutomated.indexOf(recipeId);
      if (index !== -1) {
        currentAutomated.splice(index, 1);
      }
    }

    return {
      mutations: [
        { path: 'supplyChain.automatedRecipes', value: currentAutomated },
      ],
    };
  }

  /**
   * Processes craft progress each tick. Decrements remaining time on active orders.
   * When an order completes, adds outputs to stockpiles and emits crafting_complete.
   * Also handles automation: auto-queues recipes when materials are available.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    const events: GameEvent[] = [];
    const stockpileChanges: Partial<Record<MaterialType, number>> = {};
    let factories = [...state.infrastructure.factories];
    let totalMaterialsCrafted = 0;

    // Process each crafting factory's orders
    for (let fi = 0; fi < factories.length; fi++) {
      const factory = factories[fi];
      if (factory.type !== 'crafting') continue;

      const completedOrders: number[] = [];
      const updatedOrders = factory.currentOrders.map((order, oi) => {
        const newProgress = order.progress + deltaTicks;

        if (newProgress >= order.totalTime) {
          // Order complete
          completedOrders.push(oi);
          const recipe = getRecipeById(order.recipeId);
          if (recipe) {
            // Add outputs to stockpile changes
            for (const output of recipe.outputs) {
              const outputQty = output.quantity * order.quantity;
              const current = stockpileChanges[output.material]
                ?? state.materials.stockpiles[output.material]
                ?? 0;
              stockpileChanges[output.material] = current + outputQty;
              totalMaterialsCrafted += outputQty;
            }

            events.push({
              id: `crafting_complete_${Date.now()}_${oi}`,
              type: 'crafting_complete',
              payload: {
                recipeId: order.recipeId,
                recipeName: recipe.name,
                quantity: order.quantity,
              },
              timestamp: Date.now(),
            });
          }

          return { ...order, progress: order.totalTime };
        }

        return { ...order, progress: newProgress };
      });

      // Remove completed orders
      const remainingOrders = updatedOrders.filter((_, i) => !completedOrders.includes(i));

      factories[fi] = {
        ...factory,
        currentOrders: remainingOrders,
      };
    }

    // Handle automation: auto-craft when materials available
    const automationUpdate = this.processAutomation(state, factories, stockpileChanges);
    if (automationUpdate.factories) {
      factories = automationUpdate.factories;
    }
    if (automationUpdate.stockpileChanges) {
      Object.assign(stockpileChanges, automationUpdate.stockpileChanges);
    }

    const mutations: StateMutation[] = [
      { path: 'infrastructure.factories', value: factories },
    ];

    // Update statistics for materials crafted
    if (totalMaterialsCrafted > 0) {
      mutations.push({
        path: 'statistics.totalMaterialsCrafted',
        value: state.statistics.totalMaterialsCrafted + totalMaterialsCrafted,
      });
    }

    const result: StateUpdate = {
      mutations,
    };

    if (Object.keys(stockpileChanges).length > 0) {
      result.materials = {
        stockpiles: stockpileChanges as Record<MaterialType, number>,
      };
    }

    if (events.length > 0) {
      result.events = events;
    }

    return result;
  }

  /**
   * Checks if a specific action can be performed by this system.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    switch (action.type) {
      case 'queue_craft': {
        const { recipeId } = action.payload as { recipeId: string; quantity: number };
        const check = this.canCraft(state, recipeId);
        return check.possible;
      }
      case 'set_automate': {
        const { recipeId } = action.payload as { recipeId: string; enabled: boolean };
        const recipe = getRecipeById(recipeId);
        if (!recipe) return false;
        return recipe.automatable && this.isRecipeUnlocked(state, recipe);
      }
      default:
        return false;
    }
  }

  /**
   * Executes a player action.
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    switch (action.type) {
      case 'queue_craft': {
        const { recipeId, quantity } = action.payload as { recipeId: string; quantity: number };
        return this.queueCraft(state, recipeId, quantity);
      }
      case 'set_automate': {
        const { recipeId, enabled } = action.payload as { recipeId: string; enabled: boolean };
        return this.setAutomate(state, recipeId, enabled);
      }
      default:
        return {};
    }
  }

  /**
   * Checks if a recipe is unlocked based on the current era and research state.
   */
  private isRecipeUnlocked(state: GameState, recipe: Recipe): boolean {
    // Check era requirement
    const currentEraIndex = ERA_ORDER.indexOf(state.currentEra);
    const requiredEraIndex = ERA_ORDER.indexOf(recipe.unlockedByEra);

    if (currentEraIndex < requiredEraIndex) {
      return false;
    }

    // Check research requirement if specified
    if (recipe.unlockedByResearch) {
      const researchNodeId = recipe.unlockedByResearch;
      // Search all trees for the node
      for (const treeId of Object.keys(state.research.trees) as Array<keyof typeof state.research.trees>) {
        const tree = state.research.trees[treeId];
        const node = tree.nodes[researchNodeId];
        if (node && node.status === 'completed') {
          return true;
        }
      }
      // Research node not completed
      return false;
    }

    return true;
  }

  /**
   * Processes automation: for each automated recipe, checks if materials
   * are available and queues a single craft if possible.
   */
  private processAutomation(
    state: GameState,
    factories: Factory[],
    currentStockpileChanges: Partial<Record<MaterialType, number>>,
  ): { factories?: Factory[]; stockpileChanges?: Partial<Record<MaterialType, number>> } {
    const automatedRecipes = state.supplyChain.automatedRecipes;
    if (automatedRecipes.length === 0) return {};

    const stockpileChanges: Partial<Record<MaterialType, number>> = {};
    let factoriesModified = false;

    for (const recipeId of automatedRecipes) {
      const recipe = getRecipeById(recipeId);
      if (!recipe) continue;
      if (!this.isRecipeUnlocked(state, recipe)) continue;

      // Check if materials are available (accounting for current changes)
      let canAutomate = true;
      for (const input of recipe.inputs) {
        const available = currentStockpileChanges[input.material]
          ?? state.materials.stockpiles[input.material]
          ?? 0;
        if (available < input.quantity) {
          canAutomate = false;
          break;
        }
      }

      if (!canAutomate) continue;

      // Check if there's not already an order for this recipe in queue
      const hasExistingOrder = factories.some(
        (f) => f.type === 'crafting' && f.currentOrders.some((o) => o.recipeId === recipeId),
      );
      if (hasExistingOrder) continue;

      // Reserve materials
      for (const input of recipe.inputs) {
        const current = currentStockpileChanges[input.material]
          ?? state.materials.stockpiles[input.material]
          ?? 0;
        stockpileChanges[input.material] = current - input.quantity;
        currentStockpileChanges[input.material] = current - input.quantity;
      }

      // Add order to first crafting factory (or create one)
      let targetFactory = factories.find((f) => f.type === 'crafting');
      if (!targetFactory) {
        targetFactory = {
          id: generateId(),
          type: 'crafting',
          level: 1,
          currentOrders: [],
          automatedRecipes: [],
        };
        factories.push(targetFactory);
      }

      const factoryIndex = factories.indexOf(targetFactory);
      const order: CraftOrder = {
        recipeId,
        quantity: 1,
        progress: 0,
        totalTime: recipe.craftTime,
      };

      factories[factoryIndex] = {
        ...targetFactory,
        currentOrders: [...targetFactory.currentOrders, order],
      };
      factoriesModified = true;
    }

    return {
      factories: factoriesModified ? factories : undefined,
      stockpileChanges: Object.keys(stockpileChanges).length > 0 ? stockpileChanges : undefined,
    };
  }
}
