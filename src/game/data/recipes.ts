import type { Era } from '../core/types.js';
import type { MaterialRequirement } from '../core/infrastructure.js';

/**
 * Recipe definition for crafting components from raw materials.
 */
export interface Recipe {
  id: string;
  name: string;
  inputs: MaterialRequirement[];
  outputs: MaterialRequirement[];
  craftTime: number; // ticks
  unlockedByEra: Era;
  unlockedByResearch?: string;
  automatable: boolean;
}

/**
 * All crafting recipes in the game, defined as static data.
 * Recipes are unlocked by era and optionally by a research node.
 *
 * Validates: Requirements 13.1, 11.3, 11.4
 */
export const RECIPES: Recipe[] = [
  {
    id: 'steel_beams',
    name: 'Steel Beams',
    inputs: [
      { material: 'iron_ore', quantity: 3 },
      { material: 'coal', quantity: 1 },
    ],
    outputs: [
      { material: 'steel', quantity: 1 },
    ],
    craftTime: 30,
    unlockedByEra: 'fossil',
    automatable: true,
  },
  {
    id: 'solar_cells',
    name: 'Solar Cells',
    inputs: [
      { material: 'silicon', quantity: 2 },
      { material: 'copper', quantity: 1 },
    ],
    outputs: [
      { material: 'solar_cells', quantity: 1 },
    ],
    craftTime: 45,
    unlockedByEra: 'solar',
    automatable: true,
  },
  {
    id: 'electronics',
    name: 'Electronics',
    inputs: [
      { material: 'copper', quantity: 2 },
      { material: 'silicon', quantity: 1 },
    ],
    outputs: [
      { material: 'electronics', quantity: 1 },
    ],
    craftTime: 40,
    unlockedByEra: 'nuclear',
    automatable: true,
  },
  {
    id: 'fuel_rods',
    name: 'Fuel Rods',
    inputs: [
      { material: 'uranium', quantity: 2 },
      { material: 'steel', quantity: 1 },
    ],
    outputs: [
      { material: 'fuel_rods', quantity: 1 },
    ],
    craftTime: 60,
    unlockedByEra: 'nuclear',
    automatable: true,
  },
  {
    id: 'advanced_circuits',
    name: 'Advanced Circuits',
    inputs: [
      { material: 'rare_earth', quantity: 2 },
      { material: 'electronics', quantity: 1 },
    ],
    outputs: [
      { material: 'advanced_circuits', quantity: 1 },
    ],
    craftTime: 90,
    unlockedByEra: 'orbital',
    automatable: true,
  },
];

/**
 * Retrieves a recipe by its ID.
 */
export function getRecipeById(recipeId: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === recipeId);
}
